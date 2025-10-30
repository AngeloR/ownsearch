export type SearchResult = {
  documentId: string;
  url: string;
  title: string;
  snippet: string;
  score: number;
  textScore: number;
  vectorScore: number;
  metadata?: Record<string, unknown> | null;
};

export type SearchResponseBody = {
  results: SearchResult[];
};
