# Inspekta

Inspekta analyzes a single URL and decides whether it points to a public GitHub repository or a live website. It then runs the appropriate inspection pipeline and shows the results in a clean dashboard.

## Stack

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Optional AI summaries: Gemini API
- Website inspection: Puppeteer + Cheerio
- GitHub data: GitHub REST API

## Getting started

```bash
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and the backend runs on `http://localhost:8787`.

## Environment

Create `server/.env` if you want AI summaries:

```bash
GEMINI_API_KEY=your_key_here
PORT=8787
CLIENT_ORIGIN=http://localhost:5173
```
