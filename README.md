# Where in the World is Joe Johnson

An app to track me, and show where I am at all times.

## Architecture

- **Client** (`/`): React 19 + Vite. Calls one same-origin endpoint, `/api/location`. Holds **no secrets**.
- **API** (`/api`): Azure Static Web Apps managed Functions (Node 20). Holds the Life360 token + OpenCage key, fetches both upstreams, and **coarsens coordinates** before returning them.
- **Map**: react-leaflet 5 + OpenStreetMap tiles.

## Local development

```bash
# Frontend
npm install
npm run dev          # http://localhost:3000

# In a second terminal — Azure Functions runtime
cd api
npm install
cp local.settings.json.example local.settings.json   # then fill in real values
npm start            # http://localhost:7071
```

Vite proxies `/api/*` to the Functions host, so the dev experience matches production.

## Deployment

The GitHub Actions workflow builds the static site and deploys both the build output and the `/api` functions to Azure Static Web Apps. **No secrets are passed at build time.** Set these in Azure Portal → your Static Web App → *Configuration → Application settings*:

| Name | Value |
| --- | --- |
| `LIFE360_BEARER_TOKEN` | your *new, rotated* Life360 token |
| `LIFE360_CIRCLE_ID` | your Life360 circle UUID |
| `LIFE360_MEMBER_ID` | your Life360 member UUID |
| `OPENCAGE_API_KEY` | your *new, rotated* OpenCage key |

## Rotating compromised secrets

The previous version of this app shipped both keys in the static JS bundle. They are publicly readable to anyone who has visited the live site since then. **Both must be rotated before the new architecture is meaningful**:

1. **Life360**: log out from all sessions on Life360, then re-authenticate with `curl -X POST https://api.life360.com/v3/oauth2/token` (use a Life360 client) to mint a new bearer token. The old one cannot be invalidated server-side from a normal user account, so re-authenticating + waiting for session expiry is the practical mitigation.
2. **OpenCage**: log into <https://opencagedata.com/dashboard>, click the existing key, *Regenerate*. The old value is dead immediately.
3. Update the Azure SWA Application settings (above) with the new values.
4. Remove the old GitHub Actions secrets (`REACT_APP_BEARER_TOKEN`, `REACT_APP_OPENCAGE_API_KEY`) — the new workflow doesn't reference them.
5. Delete the local `.env` file at the repo root — it's no longer used by the client.

## Privacy

The server in `api/src/lib/privacy.js` controls how precisely your location is published. By default it rounds to one decimal degree (≈ 11 km). Read the comments in that file and tune it to taste before deploying.
