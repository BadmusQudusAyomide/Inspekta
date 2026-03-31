# Inspekta

Inspekta analyzes a single URL and decides whether it points to a public GitHub repository or a live website. It then runs the appropriate inspection pipeline and shows the results in a clean dashboard.

## Stack

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Optional AI summaries: Gemini API
- Website inspection: Puppeteer + Cheerio
- GitHub data: GitHub REST API

## Features

- One URL input for both websites and public GitHub repos
- Website inspection with stack hints, SEO checks, Open Graph validation, screenshot preview, and scorecards
- GitHub inspection with AI summary, README scoring, activity signals, vitality verdict, and stack detection from manifests
- Persistent history with favorites stored in `server/data/inspections.json`

## Prerequisites

- Node.js 20+ recommended
- npm 10+ recommended
- Internet access for live website and GitHub analysis
- Optional Gemini API key for richer summaries

## Setup

1. Install dependencies from the repo root:

```bash
npm install
```

2. Create your server environment file:

```bash
copy server\\.env.example server\\.env
```

3. Edit `server/.env` if needed:

```bash
PORT=8787
CLIENT_ORIGIN=http://localhost:5173
GEMINI_API_KEY=your_key_here
GITHUB_TOKEN=your_github_token_here
```

4. Start both apps:

```bash
npm run dev
```

The frontend runs on `http://localhost:5173` and the backend runs on `http://localhost:8787`.

## Deploying on Vercel + Render

This setup works well for Inspekta:

- Frontend on Vercel
- Backend on Render

### Frontend on Vercel

Deploy the `client` app and set this environment variable in Vercel:

```bash
VITE_API_BASE_URL=https://your-render-backend.onrender.com
```

You can use [client/.env.example](c:/Users/HP/Documents/Inspekta/client/.env.example) as the local reference.

Recommended Vercel settings:

- Root directory: `client`
- Build command: `npm run build`
- Output directory: `dist`

### Backend on Render

Deploy the `server` app and set these environment variables in Render:

```bash
PORT=10000
CLIENT_ORIGIN=https://your-frontend.vercel.app,https://*.vercel.app,http://localhost:5173
GEMINI_API_KEY=your_key_here
GITHUB_TOKEN=your_github_token_here
```

Recommended Render settings:

- Root directory: `server`
- Build command: `npm install && npm run build`
- Start command: `npm run start`

Notes:

- `CLIENT_ORIGIN` now supports multiple comma-separated values
- It also supports simple wildcard origins like `https://*.vercel.app`
- Keep your permanent Vercel production domain in that list even if you also allow previews

## How it works

- Paste a URL into the frontend
- The backend checks whether it is a GitHub repo or a website
- The matching analyzer runs
- The result is shown in the dashboard
- A lightweight history record is saved on the server

## How to test it

### Quick manual test

1. Open `http://localhost:5173`
2. Paste a GitHub repo URL like `https://github.com/expressjs/express`
3. Confirm you get repo details like stars, vitality, README score, and recent commit
4. Paste a website URL like `https://example.com`
5. Confirm you get a screenshot, SEO data, scorecards, and technology hints
6. Confirm the inspected URLs appear in the recent history area
7. Click `Star` on a history item and confirm it stays starred after refresh

### API test

With the backend running, test these endpoints:

```bash
curl http://localhost:8787/api/health
curl http://localhost:8787/api/history
curl -X POST http://localhost:8787/api/analyze -H "Content-Type: application/json" -d "{\"url\":\"https://github.com/expressjs/express\"}"
```

### Build test

Run production builds from the repo root:

```bash
npm run build --workspace server
npm run build --workspace client
```

## Data persistence

- Recent inspections and favorites are stored in `server/data/inspections.json`
- The backend keeps up to 25 recent entries
- Clearing history from the UI also clears that file content

## Environment

Create `server/.env` if you want AI summaries:

```bash
GEMINI_API_KEY=your_key_here
PORT=8787
CLIENT_ORIGIN=http://localhost:5173
```

## Common issues

- If website screenshots fail, make sure Puppeteer can launch Chrome in your environment
- If Gemini summaries do not appear, confirm `GEMINI_API_KEY` is set in `server/.env`
- If CORS errors appear, make sure `CLIENT_ORIGIN` matches your frontend URL
- If GitHub code inventory returns a 403, add `GITHUB_TOKEN` to `server/.env` because LOC scanning makes many GitHub API requests
