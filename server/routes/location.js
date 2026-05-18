import { Router } from 'express';
// cycletls has a phantom dep on form-data — we declare it directly in package.json.
import initCycleTLS from 'cycletls';
import { coarsen } from '../lib/privacy.js';

const router = Router();

const CACHE_TTL_MS = 15 * 60 * 1000;
const OPENCAGE_TIMEOUT_MS = 10_000;
let cache = { fetchedAt: 0, payload: null };
let inFlight = null;

// Life360 sits behind Cloudflare bot protection that rejects Node's default
// TLS fingerprint (Undici). cycletls spawns a Go subprocess that emits a TLS
// handshake matching Chrome. The Go process is reused across requests —
// initialize lazily and keep a singleton.
let cycleClientPromise = null;
function getCycleClient() {
  if (!cycleClientPromise) {
    cycleClientPromise = initCycleTLS().catch((err) => {
      cycleClientPromise = null;
      throw err;
    });
  }
  return cycleClientPromise;
}

const CHROME_JA3 = '771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-17513-21,29-23-24,0';
const LIFE360_USER_AGENT = 'com.life360.android.safetymapd/KOKO/24.16.0 android/13';

async function fetchLife360() {
  const token = process.env.LIFE360_BEARER_TOKEN?.trim();
  const circleId = process.env.LIFE360_CIRCLE_ID?.trim();
  const memberId = process.env.LIFE360_MEMBER_ID?.trim();
  if (!token || !circleId || !memberId) {
    throw new Error('Missing LIFE360_* environment configuration');
  }

  const url = `https://api.life360.com/v3/circles/${encodeURIComponent(circleId)}/members/${encodeURIComponent(memberId)}`;
  const cycleTLS = await getCycleClient();

  const res = await cycleTLS(url, {
    ja3: CHROME_JA3,
    userAgent: LIFE360_USER_AGENT,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    timeout: 15,
  }, 'get');

  if (res.status < 200 || res.status >= 300) {
    const snippet = typeof res.body === 'string' ? res.body.slice(0, 500) : JSON.stringify(res.body).slice(0, 500);
    console.error(`Life360 responded ${res.status}: ${snippet}`);
    throw new Error(`Life360 upstream error: ${res.status}`);
  }

  const body = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
  const lat = Number(body?.location?.latitude);
  const lon = Number(body?.location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('Life360 returned no usable coordinates');
  }
  return { lat, lon };
}

async function fetchOpenCage(lat, lon) {
  const key = process.env.OPENCAGE_API_KEY?.trim();
  if (!key) throw new Error('Missing OPENCAGE_API_KEY');

  const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${encodeURIComponent(key)}&no_annotations=1&limit=1`;
  const res = await fetch(url, { signal: AbortSignal.timeout(OPENCAGE_TIMEOUT_MS) });
  if (!res.ok) {
    console.error(`OpenCage responded ${res.status}`);
    throw new Error(`OpenCage upstream error: ${res.status}`);
  }
  const body = await res.json();
  const components = body?.results?.[0]?.components ?? {};
  return {
    city: components.city || components.town || components.village || components.hamlet || null,
    state: components.state || components.region || null,
    country: components.country || null,
  };
}

router.get('/location', async (req, res) => {
  const now = Date.now();
  if (cache.payload && now - cache.fetchedAt < CACHE_TTL_MS) {
    return sendJson(res, 200, cache.payload, 'HIT');
  }

  if (!inFlight) {
    inFlight = (async () => {
      try {
        const { lat, lon } = await fetchLife360();
        const place = await fetchOpenCage(lat, lon);
        const safe = coarsen({ lat, lon, place });
        cache = { fetchedAt: Date.now(), payload: safe };
        return safe;
      } finally {
        inFlight = null;
      }
    })();
  }

  try {
    const safe = await inFlight;
    sendJson(res, 200, safe, 'MISS');
  } catch (err) {
    console.error(`location handler failed: ${err.message}`);
    sendJson(res, 502, { error: 'upstream_failure' });
  }
});

function sendJson(res, status, body, cacheStatus) {
  const ok = status >= 200 && status < 300;
  res.set('Content-Type', 'application/json');
  res.set('Cache-Control', ok ? 'public, max-age=300' : 'no-store');
  if (cacheStatus) res.set('X-Cache', cacheStatus);
  res.status(status).send(JSON.stringify(body));
}

export default router;
