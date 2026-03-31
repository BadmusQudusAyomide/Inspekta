import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { analyzeInput } from "./services/analyze.js";
import { analyzeGithubCodeStats } from "./services/github-code-stats.js";
import { clearHistory, listHistory, saveAnalysisToHistory, toggleFavorite } from "./services/history.js";


dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 8787);
const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

app.use(cors({ origin: clientOrigin }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/history", async (_request, response) => {
  const history = await listHistory();
  response.json({ entries: history });
});

app.post("/api/history/:id/favorite", async (request, response) => {
  try {
    const entry = await toggleFavorite(request.params.id);
    response.json(entry);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update favorite.";
    response.status(404).json({ error: message });
  }
});

app.delete("/api/history", async (_request, response) => {
  await clearHistory();
  response.status(204).send();
});

app.post("/api/analyze", async (request, response) => {
  try {
    const { url } = request.body as { url?: string };
    if (!url?.trim()) {
      response.status(400).json({ error: "A URL is required." });
      return;
    }

    const result = await analyzeInput(url);
    await saveAnalysisToHistory(result);
    response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected analysis error.";
    response.status(500).json({ error: message });
  }
});

app.post("/api/github/code-stats", async (request, response) => {
  try {
    const { url } = request.body as { url?: string };
    if (!url?.trim()) {
      response.status(400).json({ error: "A GitHub URL is required." });
      return;
    }

    const parsedUrl = normalizeGithubUrl(url);
    const result = await analyzeGithubCodeStats(parsedUrl);
    response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected code stats error.";
    response.status(500).json({ error: message });
  }
});

app.listen(port, () => {
  console.log(`Inspekta server listening on http://localhost:${port}`);
});

function normalizeGithubUrl(input: string) {
  const trimmed = input.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);

  if (parsed.hostname.toLowerCase() !== "github.com") {
    throw new Error("This tool only supports GitHub repository URLs.");
  }

  return parsed;
}
