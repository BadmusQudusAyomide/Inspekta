import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { analyzeInput } from "./services/analyze.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 8787);
const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

app.use(cors({ origin: clientOrigin }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.post("/api/analyze", async (request, response) => {
  try {
    const { url } = request.body as { url?: string };
    if (!url?.trim()) {
      response.status(400).json({ error: "A URL is required." });
      return;
    }

    const result = await analyzeInput(url);
    response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected analysis error.";
    response.status(500).json({ error: message });
  }
});

app.listen(port, () => {
  console.log(`Inspekta server listening on http://localhost:${port}`);
});
