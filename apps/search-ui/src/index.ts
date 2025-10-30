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

function setLoading(isLoading: boolean, button: HTMLButtonElement): void {
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

function init(): void {
  const form = document.querySelector<HTMLFormElement>("#search-form");
  const input = document.querySelector<HTMLInputElement>("#search-input");
  const button = document.querySelector<HTMLButtonElement>("#search-button");
  const resultsContainer = document.querySelector<HTMLElement>("#results");

  if (!form || !input || !button || !resultsContainer) {
    console.error("Search UI failed to initialize: elements missing.");
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

    setLoading(true, button);
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
      setLoading(false, button);
    }
  };

  form.addEventListener("submit", handleSearch);
  button.addEventListener("click", handleSearch);
}

document.addEventListener("DOMContentLoaded", init);
