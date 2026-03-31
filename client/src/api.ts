import { AnalyzeResponse } from "./types";

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";

export interface HistoryEntry {
  id: string;
  normalizedUrl: string;
  kind: AnalyzeResponse["kind"];
  label: string;
  subtitle: string;
  favorite: boolean;
  score: number | null;
  inspectedAt: string;
}

export interface GithubCodeStats {
  repo: string;
  branch: string;
  totalFiles: number;
  rawFileCount: number;
  codeFiles: number;
  analyzedFiles: number;
  truncated: boolean;
  ignored: string[];
  totals: {
    lines: number;
    blanks: number;
    comments: number;
    linesOfCode: number;
  };
  languages: Array<{
    language: string;
    files: number;
    lines: number;
    blanks: number;
    comments: number;
    linesOfCode: number;
  }>;
  largestFiles: Array<{
    path: string;
    sha: string;
    language: string;
    lines: number;
    blanks: number;
    comments: number;
    linesOfCode: number;
  }>;
}

export async function analyzeUrl(url: string) {
  const response = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ url })
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "Analysis failed.");
  }

  return payload as AnalyzeResponse;
}

export async function fetchHistory() {
  const response = await fetch(`${API_BASE}/api/history`);
  if (!response.ok) {
    throw new Error("Unable to load history.");
  }

  const payload = (await response.json()) as { entries: HistoryEntry[] };
  return payload.entries;
}

export async function clearHistoryFromApi() {
  const response = await fetch(`${API_BASE}/api/history`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error("Unable to clear history.");
  }
}

export async function toggleFavoriteInApi(id: string) {
  const response = await fetch(`${API_BASE}/api/history/${id}/favorite`, {
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("Unable to update favorite.");
  }
}

export async function loadHistoryIntoState(setHistory: (entries: HistoryEntry[]) => void) {
  try {
    const entries = await fetchHistory();
    setHistory(entries);
  } catch {
    setHistory([]);
  }
}

export async function fetchGithubCodeStats(input: { url: string; branch?: string; ignored?: string[] }) {
  const response = await fetch(`${API_BASE}/api/github/code-stats`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to load code inventory.");
  }

  return payload as GithubCodeStats;
}
