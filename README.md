# Where in the World is Joe Johnson

A small public site, [whereintheworldisjoejohnson.com](https://whereintheworldisjoejohnson.com), that drops a pin on a map showing roughly where I am right now. The exact location is pulled from Life360 server-side, reverse-geocoded for a human-readable label, and **coarsened to ~11 km** before it ever reaches the browser.

![logo](public/logo192.png)

## What it does

1. The React SPA loads, shows a brief animated splash screen.
2. It fetches `/api/location` from its own origin.
3. The Express server pulls my current coordinates from **Life360**, reverse-geocodes them via **OpenCage**, rounds the coordinates so no street-level data leaves the box, caches the result for 15 minutes, and returns JSON.
4. The SPA drops a custom marker on a [Leaflet](https://leafletjs.com/) / [OpenStreetMap](https://www.openstreetmap.org/) map with a tooltip showing the city, state, and country.

The whole thing is one Node process behind one ingress. No client secrets, no third-party scripts, no tracking.

## Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │  AKS pod (single container, port 8080)       │
 browser  ─────►    │  ┌────────────────────────────────────────┐  │
  fetch             │  │  Express + Helmet + compression        │  │
 /api/location      │  │                                        │  │
                    │  │  GET /api/location ──┐                 │  │
                    │  │                      │  cycletls →     │──┼──►  api.life360.com
                    │  │  static /assets/     │  (Chrome JA3)   │  │
                    │  │  SPA fallback        │                 │  │
                    │  │                      └─ fetch       ───┼──┼──►  api.opencagedata.com
                    │  │  coarsen() to 1 decimal ≈ 11 km        │  │
                    │  │  in-memory cache (15 min, coalesced)   │  │
                    │  └────────────────────────────────────────┘  │
                    └──────────────────────────────────────────────┘
```

Key pieces:

| Path | What it is |
| --- | --- |
| [src/](src) | React 19 SPA, Vite-built. One screen, one `useEffect`, one Leaflet map. |
| [server/index.js](server/index.js) | Express app: Helmet CSP, gzip, static-serves `build/`, mounts the API router, SPA fallback. |
| [server/routes/location.js](server/routes/location.js) | The only API endpoint. Calls Life360 (via `cycletls`), then OpenCage, then `coarsen()`, then caches. |
| [server/lib/privacy.js](server/lib/privacy.js) | `coarsen()` — the privacy hinge. Decides what precision the public sees. |
| [Dockerfile](Dockerfile) | Multi-stage build on `node:22-bookworm-slim` (glibc is needed by `cycletls`'s embedded Go binary). |
| [.github/workflows/build-and-deploy.yml](.github/workflows/build-and-deploy.yml) | Builds image, pushes to Azure Container Registry, then GitOps-bumps the tag in a separate `platform-infra` repo. |

### Why `cycletls`?

Life360's edge sits behind Cloudflare bot protection that rejects Node's default TLS fingerprint (Undici's). [`cycletls`](https://www.npmjs.com/package/cycletls) spawns a small Go subprocess that emits a TLS handshake matching Chrome's JA3, which Cloudflare lets through. The Go process is reused across requests as a lazily-initialized singleton.

This is the single reason the container is Debian-based and not Alpine — Alpine's musl libc breaks the embedded Go binary in flaky, hard-to-diagnose ways.

### Privacy model

`coarsen()` in [server/lib/privacy.js](server/lib/privacy.js) is the *only* thing between Life360's street-accurate fix and the public web. It rounds the latitude/longitude before they leave the server.

Default: 1 decimal degree ≈ 11 km. Tunable in the file. The reverse-geocoded place label (city, state, country) is already coarse and is passed through as-is.

The cache layer (`CACHE_TTL_MS = 15 * 60 * 1000`) is also a privacy primitive — it limits how often Life360 is polled and how often the public response updates.

## Local development

You need Node 20+. Create a `.env` at the repo root with the variables described below.

```bash
npm install
```

Run the front end and the API in two terminals:

```bash
# Terminal 1 — Vite dev server with HMR on :3000
npm run dev

# Terminal 2 — Express on :8080 (where Vite proxies /api)
PORT=8080 node --env-file=.env --watch server/index.js
```

Then open <http://localhost:3000>. The Vite dev server proxies `/api/*` to `http://localhost:8080` (the same port the production container listens on), where Express handles the location endpoint.

To exercise the production-equivalent path (Express serves both the built React **and** the API on one port):

```bash
npm run build
PORT=8080 node --env-file=.env server/index.js
# → http://localhost:8080
```

## Environment variables

Required for the API to function. All read by the Express process, never exposed to the client.

| Name | Purpose |
| --- | --- |
| `LIFE360_BEARER_TOKEN` | Auth token for the Life360 API. Rotate periodically. |
| `LIFE360_CIRCLE_ID` | UUID of the Life360 circle to query. |
| `LIFE360_MEMBER_ID` | UUID of the circle member whose location is shown. |
| `OPENCAGE_API_KEY` | API key for OpenCage reverse geocoding. Free tier is sufficient. |
| `PORT` | Port to listen on. Defaults to `3000` locally, `8080` in the container. |

In production these are mounted as a Kubernetes Secret referenced by the Deployment in the `platform-infra` repo.

## Production deployment

Production runs as a single container on **AKS**, deployed via **GitOps**.

```
push to main
   │
   ▼
GitHub Actions: build-and-deploy.yml
   │
   ├─► docker build (linux/amd64)
   ├─► push azacr1.azurecr.io/witwijmfj:<sha>  and  :latest
   │
   └─► checkout hikarukujo/platform-infra
        sed -i image tag in apps/witwijmfj/deployment.yaml
        git commit + push
                │
                ▼
        Flux / ArgoCD reconciles AKS to the new image tag
```

This repo never talks to the cluster directly. CI's only privileged action is pushing a tag commit to `platform-infra`, which the cluster's GitOps controller pulls and reconciles. That gives a single auditable history of what's deployed (the YAML in `platform-infra`).

The build job uses Azure federated identity (`azure/login@v2` with `id-token: write`) — no long-lived service-principal secrets in this repo.

## Project layout

```
.
├── Dockerfile                  Multi-stage build, tini PID 1, port 8080
├── index.html                  Vite entrypoint
├── vite.config.js              React plugin, dev proxy to Express
├── eslint.config.js            Flat config, React + react-hooks
├── package.json                Vite/Express/Leaflet/cycletls
├── public/                     Static assets copied as-is (logos, favicon, manifest, robots.txt)
├── src/                        React SPA
│   ├── App.jsx                 The whole UI: splash + map
│   ├── App.css                 Splash animation, layout
│   ├── main.jsx                React root
│   ├── index.css               Body reset
│   └── jmfj.png                Map marker icon
├── server/                     Production Node process
│   ├── index.js                Express app, CSP, static + SPA fallback
│   ├── lib/privacy.js          coarsen() — privacy hinge
│   └── routes/location.js      /api/location with cache + cycletls
└── .github/workflows/
    ├── build-and-deploy.yml    Docker → ACR → bump platform-infra
    ├── claude.yml              @claude bot in issues / PRs
    └── claude-code-review.yml  Auto code review on PR open/update
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on :3000 with HMR |
| `npm run dev:server` | `node --watch server/index.js` (set `PORT=8080` to match the Vite proxy) |
| `npm run build` | Vite production build into `build/` |
| `npm run preview` | Vite preview server on :4173 (serves `build/` without the API) |
| `npm start` | Node + Express in production mode |
| `npm run lint` | ESLint flat config |
| `npm test` | Stub (`echo "no tests configured"`) — no test runner installed yet |

## Stack

- **Runtime:** Node 22 (Bookworm slim) in production, Node 20+ locally
- **Frontend:** React 19, Vite 7, react-leaflet 5, Leaflet 1.9, FontAwesome 7
- **Server:** Express 4, Helmet 8, compression, `cycletls` for Cloudflare-friendly TLS
- **Map tiles:** OpenStreetMap
- **Reverse geocoding:** OpenCage
- **Container registry:** Azure Container Registry (`azacr1`)
- **Orchestration:** AKS via GitOps (`platform-infra`)
- **CI:** GitHub Actions, OIDC federation to Azure

## License

[CC0 1.0 Universal](LICENSE). Public domain — do whatever you want with it.
