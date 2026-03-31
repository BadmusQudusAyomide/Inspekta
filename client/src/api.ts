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

  return normalizeGithubCodeStats(payload);
}

function normalizeGithubCodeStats(payload: any): GithubCodeStats {
  const totals = payload?.totals ?? {
    lines: Number(payload?.totalLines ?? 0),
    blanks: 0,
    comments: 0,
    linesOfCode: Number(payload?.totalLines ?? 0)
  };

  return {
    repo: String(payload?.repo ?? ""),
    branch: String(payload?.branch ?? "unknown"),
    totalFiles: Number(payload?.totalFiles ?? 0),
    rawFileCount: Number(payload?.rawFileCount ?? payload?.totalFiles ?? 0),
    codeFiles: Number(payload?.codeFiles ?? 0),
    analyzedFiles: Number(payload?.analyzedFiles ?? 0),
    truncated: Boolean(payload?.truncated),
    ignored: Array.isArray(payload?.ignored) ? payload.ignored : [],
    totals: {
      lines: Number(totals.lines ?? 0),
      blanks: Number(totals.blanks ?? 0),
      comments: Number(totals.comments ?? 0),
      linesOfCode: Number(totals.linesOfCode ?? totals.lines ?? 0)
    },
    languages: Array.isArray(payload?.languages)
      ? payload.languages.map((item: any) => ({
          language: String(item?.language ?? "Unknown"),
          files: Number(item?.files ?? 0),
          lines: Number(item?.lines ?? 0),
          blanks: Number(item?.blanks ?? 0),
          comments: Number(item?.comments ?? 0),
          linesOfCode: Number(item?.linesOfCode ?? item?.lines ?? 0)
        }))
      : [],
    largestFiles: Array.isArray(payload?.largestFiles)
      ? payload.largestFiles.map((item: any) => ({
          path: String(item?.path ?? ""),
          sha: String(item?.sha ?? ""),
          language: String(item?.language ?? "Unknown"),
          lines: Number(item?.lines ?? 0),
          blanks: Number(item?.blanks ?? 0),
          comments: Number(item?.comments ?? 0),
          linesOfCode: Number(item?.linesOfCode ?? item?.lines ?? 0)
        }))
      : []
  };
}
