# Where in the World is Joe Johnson

An app to track me, and show where I am at all times.

## Architecture

A single Node process serves both the static React app and the location API:

- **React 19 + Vite** front-end. Calls one same-origin endpoint, `/api/location`. Holds **no secrets**.
- **Express** server-side that:
  - serves the Vite build output from `/build`
  - hosts `/api/location`, which calls Life360 (via `cycletls` to bypass Cloudflare TLS fingerprint checks) and OpenCage server-side
  - **coarsens the coordinates** before responding so the public response never contains street-level precision
- **Helmet + CSP** for security headers (CSP, HSTS, frame-ancestors, etc.).
- **Azure App Service** (Linux, Node 20) hosts the deployed app.

## Local development

```bash
npm install

# In one terminal — Vite dev server with HMR
npm run dev          # http://localhost:3000

# In a second terminal — Express server (loads /api/location)
npm run dev:server   # http://localhost:3000 if PORT not set; pick a different port to avoid clashing
```

Most of the time you only need `npm run dev` (the React app) plus a separately-running Express on a different port for the API.

To exercise the production-equivalent flow (Express serves the built React + the API):

```bash
npm run build
PORT=3000 npm start
```

Open http://localhost:3000.

## Local environment variables

Create a `.env` file at the repo root (gitignored) — Express reads these via `process.env`:

```
LIFE360_BEARER_TOKEN=...
LIFE360_CIRCLE_ID=e54367f0-24b6-4cc3-94da-29d998174daa
LIFE360_MEMBER_ID=8f1d8944-bb77-48c6-91f5-c0a181f31b3b
OPENCAGE_API_KEY=...
```

(For Node to actually read `.env`, prefix `npm start` with `node --env-file=.env`, or use a process manager.)

## Deployment

The repo is wired up to deploy automatically to Azure App Service. App Service runs `npm install` then `npm run build` (Oryx auto-detects), then `npm start`. The Express server boots on `process.env.PORT`.

### App Service application settings to configure

In Azure Portal → your App Service → **Configuration → Application settings**:

| Name | Value |
| --- | --- |
| `LIFE360_BEARER_TOKEN` | your **rotated** Life360 bearer token |
| `LIFE360_CIRCLE_ID` | `e54367f0-24b6-4cc3-94da-29d998174daa` |
| `LIFE360_MEMBER_ID` | `8f1d8944-bb77-48c6-91f5-c0a181f31b3b` |
| `OPENCAGE_API_KEY` | your **rotated** OpenCage API key |
| `WEBSITE_NODE_DEFAULT_VERSION` | `~20` |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `true` |

## Privacy

`server/lib/privacy.js` controls how precisely your location is published. By default it rounds to one decimal degree (≈ 11 km). Tune it to taste — see comments in that file.
