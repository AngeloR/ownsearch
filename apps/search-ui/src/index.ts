type SearchResult = {
  documentId: string;
  url: string;
  title: string;
  snippet: string;
  score: number;
  textScore: number;
  vectorScore: number;
  metadata?: Record<string, unknown> | null;
};

type SearchResponse = {
  results: SearchResult[];
};

type EnqueueResponse = {
  url: string;
  queue: string;
  alreadyQueued?: boolean;
};

type RescanResponse = {
  attempted: number;
  enqueued: number;
  queue: string;
};

type HostInfo = {
  hostname: string;
  lastCrawledAt: string | null;
};

type HostListResponse = {
  hosts: HostInfo[];
};

const API_BASE_URL =
  (window as { __API_BASE_URL__?: string }).__API_BASE_URL__ ??
  "http://localhost:8000";

function createResultCard(result: SearchResult): HTMLElement {
  const card = document.createElement("article");
  card.className = "result-card";

  const header = document.createElement("header");
  header.className = "result-header";

  const titleLink = document.createElement("a");
  titleLink.href = result.url;
  titleLink.target = "_blank";
  titleLink.rel = "noopener noreferrer";
  titleLink.textContent = result.title || result.url;
  titleLink.className = "result-title";

  const urlSpan = document.createElement("span");
  urlSpan.className = "result-url";
  urlSpan.textContent = new URL(result.url).hostname;

  header.appendChild(titleLink);
  header.appendChild(urlSpan);

  const snippet = document.createElement("p");
  snippet.className = "result-snippet";
  snippet.textContent = result.snippet;

  const meta = document.createElement("footer");
  meta.className = "result-meta";
  meta.textContent = `score ${result.score.toFixed(3)} • text ${result.textScore.toFixed(
    3,
  )} • vector ${result.vectorScore.toFixed(3)}`;

  card.appendChild(header);
  card.appendChild(snippet);
  card.appendChild(meta);

  return card;
}

async function performSearch(query: string): Promise<SearchResult[]> {
  const response = await fetch(
    `${API_BASE_URL.replace(/\/$/, "")}/search?q=${encodeURIComponent(query)}`,
  );
  if (!response.ok) {
    throw new Error(`Search failed with status ${response.status}`);
  }

  const data = (await response.json()) as SearchResponse;
  return data.results ?? [];
}

function setSearchLoading(isLoading: boolean, button: HTMLButtonElement): void {
  button.disabled = isLoading;
  button.textContent = isLoading ? "Searching…" : "Search";
}

function renderResults(results: SearchResult[], container: HTMLElement): void {
  container.innerHTML = "";
  if (results.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No results yet. Try refining your search.";
    container.appendChild(empty);
    return;
  }

  for (const result of results) {
    container.appendChild(createResultCard(result));
  }
}

function showError(message: string, container: HTMLElement): void {
  container.innerHTML = "";
  const error = document.createElement("p");
  error.className = "error-state";
  error.textContent = message;
  container.appendChild(error);
}

async function enqueueUrl(url: string): Promise<EnqueueResponse> {
  const response = await fetch(`${API_BASE_URL.replace(/\/$/, "")}/crawl`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  let data: EnqueueResponse | { error?: string } | null = null;

  try {
    data = (await response.json()) as EnqueueResponse | { error?: string };
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errorMessage =
      (data && "error" in data && typeof data.error === "string" && data.error) ||
      `Failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  if (
    !data ||
    typeof data !== "object" ||
    !("url" in data) ||
    !("queue" in data)
  ) {
    throw new Error("Unexpected response from server.");
  }

  const payload = data as EnqueueResponse;

  return {
    url: String(payload.url),
    queue: String(payload.queue),
    alreadyQueued: Boolean(payload.alreadyQueued),
  };
}

function normalizeIsoString(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const coerced = String(value);
  const date = new Date(coerced);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatLastCrawled(value: string | null): string {
  if (!value) {
    return "Last crawled: unknown";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Last crawled: unknown";
  }
  return `Last crawled: ${date.toLocaleString()}`;
}

async function fetchHosts(): Promise<HostInfo[]> {
  const response = await fetch(`${API_BASE_URL.replace(/\/$/, "")}/hosts`);

  let data: HostListResponse | { error?: string } | null = null;

  try {
    data = (await response.json()) as HostListResponse | { error?: string };
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errorMessage =
      (data && "error" in data && typeof data.error === "string" && data.error) ||
      `Failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  if (!data || !("hosts" in data) || !Array.isArray(data.hosts)) {
    throw new Error("Unexpected response from server.");
  }

  const rawHosts = data.hosts as unknown[];

  return rawHosts
    .map((host) => {
      if (!host || typeof host !== "object") {
        return undefined;
      }
      const entry = host as Record<string, unknown>;
      const hostnameRaw = entry.hostname;
      if (typeof hostnameRaw !== "string") {
        return undefined;
      }

      const hostname = hostnameRaw.trim();
      if (!hostname) {
        return undefined;
      }

      const lastCrawledAt = normalizeIsoString(entry.lastCrawledAt);

      return {
        hostname,
        lastCrawledAt,
      };
    })
    .filter((host): host is HostInfo => Boolean(host));
}

async function triggerRescan(): Promise<RescanResponse> {
  const response = await fetch(
    `${API_BASE_URL.replace(/\/$/, "")}/admin/rescan`,
    { method: "POST" },
  );

  let data: RescanResponse | { error?: string } | null = null;

  try {
    data = (await response.json()) as RescanResponse | { error?: string };
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errorMessage =
      (data && "error" in data && typeof data.error === "string" && data.error) ||
      `Failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  if (
    !data ||
    typeof data !== "object" ||
    !("attempted" in data) ||
    !("enqueued" in data) ||
    !("queue" in data)
  ) {
    throw new Error("Unexpected response from server.");
  }

  const payload = data as RescanResponse;

  return {
    attempted: Number(payload.attempted) || 0,
    enqueued: Number(payload.enqueued) || 0,
    queue: String(payload.queue),
  };
}

function setSeedLoading(isLoading: boolean, button: HTMLButtonElement): void {
  button.disabled = isLoading;
  button.textContent = isLoading ? "Enqueuing…" : "Enqueue";
}

function setSeedStatus(
  element: HTMLElement,
  message: string,
  variant: "info" | "success" | "error",
): void {
  element.textContent = message;
  element.classList.remove("empty-state", "error-state", "success-state");

  if (variant === "success") {
    element.classList.add("success-state");
  } else if (variant === "error") {
    element.classList.add("error-state");
  } else {
    element.classList.add("empty-state");
  }
}

function setHostsLoading(button: HTMLButtonElement | null, isLoading: boolean): void {
  if (!button) {
    return;
  }
  button.disabled = isLoading;
  button.textContent = isLoading ? "Refreshing…" : "Refresh";
}

function setHostsMessage(
  container: HTMLElement,
  message: string,
  variant: "info" | "success" | "error",
): void {
  container.innerHTML = "";
  const messageElement = document.createElement("p");
  messageElement.textContent = message;
  if (variant === "success") {
    messageElement.className = "success-state";
  } else if (variant === "error") {
    messageElement.className = "error-state";
  } else {
    messageElement.className = "empty-state";
  }
  container.appendChild(messageElement);
}

function setRescanLoading(
  button: HTMLButtonElement | null,
  isLoading: boolean,
): void {
  if (!button) {
    return;
  }
  button.disabled = isLoading;
  button.textContent = isLoading ? "Rescanning…" : "Rescan All";
}

function setRescanStatus(
  element: HTMLElement | null,
  message: string,
  variant: "info" | "success" | "error",
): void {
  if (!element) {
    return;
  }
  element.textContent = message;
  element.classList.remove("empty-state", "error-state", "success-state");
  if (variant === "success") {
    element.classList.add("success-state");
  } else if (variant === "error") {
    element.classList.add("error-state");
  } else {
    element.classList.add("empty-state");
  }
}

function renderHostList(hosts: HostInfo[], container: HTMLElement): void {
  container.innerHTML = "";

  if (hosts.length === 0) {
    setHostsMessage(container, "No hostnames found yet.", "info");
    return;
  }

  const list = document.createElement("ul");
  for (const host of hosts) {
    const item = document.createElement("li");
    item.className = "host-item";
    item.textContent = `${host.hostname} - ${formatLastCrawled(host.lastCrawledAt)}`;
    list.appendChild(item);
  }

  container.appendChild(list);
}

function initSearchPage(): void {
  const form = document.querySelector<HTMLFormElement>("#search-form");
  const input = document.querySelector<HTMLInputElement>("#search-input");
  const button = document.querySelector<HTMLButtonElement>("#search-button");
  const resultsContainer = document.querySelector<HTMLElement>("#results");

  if (!form || !input || !button || !resultsContainer) {
    return;
  }

  let currentController: AbortController | null = null;

  const handleSearch = async (event?: Event) => {
    event?.preventDefault();

    const query = input.value.trim();
    if (!query) {
      showError("Please enter a search term.", resultsContainer);
      return;
    }

    currentController?.abort();
    currentController = new AbortController();

    setSearchLoading(true, button);
    resultsContainer.innerHTML = "";

    try {
      const results = await performSearch(query);
      renderResults(results, resultsContainer);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while searching.";
      showError(message, resultsContainer);
    } finally {
      setSearchLoading(false, button);
    }
  };

  form.addEventListener("submit", handleSearch);
  button.addEventListener("click", handleSearch);
}

function initAdminPage(): void {
  const form = document.querySelector<HTMLFormElement>("#seed-form");
  const input = document.querySelector<HTMLInputElement>("#seed-input");
  const button = document.querySelector<HTMLButtonElement>("#seed-button");
  const status = document.querySelector<HTMLElement>("#seed-status");
  const hostsContainer = document.querySelector<HTMLElement>("#hosts-container");
  const hostsRefreshButton =
    document.querySelector<HTMLButtonElement>("#hosts-refresh");
  const hostsRescanButton =
    document.querySelector<HTMLButtonElement>("#hosts-rescan");
  const rescanStatus = document.querySelector<HTMLElement>("#rescan-status");

  if (!form || !input || !button || !status) {
    return;
  }

  const loadHosts = async () => {
    if (!hostsContainer) {
      return;
    }

    setHostsLoading(hostsRefreshButton, true);
    setHostsMessage(hostsContainer, "Loading hostnames…", "info");

    try {
      const hosts = await fetchHosts();
      renderHostList(hosts, hostsContainer);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load hostnames.";
      setHostsMessage(hostsContainer, message, "error");
    } finally {
      setHostsLoading(hostsRefreshButton, false);
    }
  };

  const handleRescan = async () => {
    setRescanLoading(hostsRescanButton, true);
    setRescanStatus(rescanStatus, "Scheduling rescan…", "info");

    try {
      const result = await triggerRescan();
      const skipped = Math.max(result.attempted - result.enqueued, 0);
      let message: string;
      let variant: "info" | "success";

      if (result.attempted === 0) {
        message = "No hosts available for rescan.";
        variant = "info";
      } else if (result.enqueued === 0) {
        message = "All hosts are already queued for crawling.";
        variant = "info";
      } else {
        message = `Queued ${result.enqueued} of ${result.attempted} ${result.attempted === 1 ? "host" : "hosts"} for crawling${skipped > 0 ? ` (${skipped} already queued).` : "."}`;
        variant = "success";
      }

      setRescanStatus(rescanStatus, message, variant);

      if (hostsContainer) {
        await loadHosts();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to schedule rescan.";
      setRescanStatus(rescanStatus, message, "error");
    } finally {
      setRescanLoading(hostsRescanButton, false);
    }
  };

  const handleSubmit = async (event: Event) => {
    event.preventDefault();

    const url = input.value.trim();
    if (!url) {
      setSeedStatus(status, "Enter a URL to enqueue.", "error");
      input.focus();
      return;
    }

    try {
      // Validate URL locally before hitting the API.
      new URL(url);
    } catch {
      setSeedStatus(status, "Enter a valid, absolute URL (including protocol).", "error");
      input.focus();
      return;
    }

    setSeedLoading(true, button);
    setSeedStatus(status, "Submitting URL…", "info");

    try {
      const result = await enqueueUrl(url);
      const message = result.alreadyQueued
        ? `${result.url} is already scheduled on queue ${result.queue}.`
        : `Enqueued ${result.url} onto queue ${result.queue}.`;
      setSeedStatus(status, message, result.alreadyQueued ? "info" : "success");
      form.reset();
      input.focus();
      if (hostsContainer) {
        await loadHosts();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to enqueue URL. Please try again.";
      setSeedStatus(status, message, "error");
    } finally {
      setSeedLoading(false, button);
    }
  };

  form.addEventListener("submit", handleSubmit);
  button.addEventListener("click", handleSubmit);

  if (hostsRefreshButton) {
    hostsRefreshButton.addEventListener("click", () => {
      void loadHosts();
    });
  }

  if (hostsRescanButton) {
    hostsRescanButton.addEventListener("click", () => {
      void handleRescan();
    });
  }

  if (hostsContainer) {
    void loadHosts();
  }

  if (rescanStatus) {
    setRescanStatus(
      rescanStatus,
      "Trigger a rescan to requeue all known hosts.",
      "info",
    );
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initSearchPage();
  initAdminPage();
});
