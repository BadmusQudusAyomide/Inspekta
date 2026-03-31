import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

interface StoredHistoryEntry {
  id: string;
  normalizedUrl: string;
  kind: "github" | "website";
  label: string;
  subtitle: string;
  inspectedAt: string;
  favorite: boolean;
  score: number | null;
}

interface HistoryStore {
  entries: StoredHistoryEntry[];
}

const dataDirectory = path.resolve(process.cwd(), "data");
const dataFile = path.join(dataDirectory, "inspections.json");

export async function listHistory() {
  const store = await readStore();
  return dedupeEntries(store.entries).sort((left, right) => right.inspectedAt.localeCompare(left.inspectedAt));
}

export async function saveAnalysisToHistory(result: {
  kind: "github" | "website";
  normalizedUrl: string;
  inspectedAt: string;
  summary?: string;
  repo?: { fullName: string };
  page?: { title: string };
  vitality?: { score: number };
  scores?: { overall: number };
}) {
  const store = await readStore();
  const existing = store.entries.find((entry) => entry.normalizedUrl === result.normalizedUrl);
  const nextEntry: StoredHistoryEntry = {
    id: existing?.id ?? buildId(result.normalizedUrl),
    normalizedUrl: result.normalizedUrl,
    kind: result.kind,
    label: result.kind === "github" ? result.repo?.fullName ?? result.normalizedUrl : result.page?.title || result.normalizedUrl,
    subtitle: result.summary?.slice(0, 160) ?? "",
    inspectedAt: result.inspectedAt,
    favorite: existing?.favorite ?? false,
    score: result.kind === "github" ? result.vitality?.score ?? null : result.scores?.overall ?? null
  };

  const withoutCurrent = store.entries.filter((entry) => entry.normalizedUrl !== result.normalizedUrl);
  store.entries = dedupeEntries([nextEntry, ...withoutCurrent]).slice(0, 25);
  await writeStore(store);

  return nextEntry;
}

export async function toggleFavorite(id: string) {
  const store = await readStore();
  const entry = store.entries.find((item) => item.id === id);

  if (!entry) {
    throw new Error("History entry not found.");
  }

  entry.favorite = !entry.favorite;
  await writeStore(store);

  return entry;
}

export async function clearHistory() {
  await writeStore({ entries: [] });
}

async function readStore(): Promise<HistoryStore> {
  await mkdir(dataDirectory, { recursive: true });

  try {
    const raw = await readFile(dataFile, "utf8");
    const parsed = JSON.parse(raw) as HistoryStore;
    return {
      entries: dedupeEntries(Array.isArray(parsed.entries) ? parsed.entries : [])
    };
  } catch {
    return { entries: [] };
  }
}

async function writeStore(store: HistoryStore) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(dataFile, JSON.stringify(store, null, 2), "utf8");
}

function buildId(value: string) {
  return Buffer.from(value).toString("base64url");
}

function dedupeEntries(entries: StoredHistoryEntry[]) {
  const map = new Map<string, StoredHistoryEntry>();

  for (const entry of entries) {
    const existing = map.get(entry.normalizedUrl);
    if (!existing || existing.inspectedAt < entry.inspectedAt) {
      map.set(entry.normalizedUrl, entry);
    }
  }

  return Array.from(map.values()).sort((left, right) => right.inspectedAt.localeCompare(left.inspectedAt));
}
