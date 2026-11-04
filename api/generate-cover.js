import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Default: FLUX.2 [klein] 9B, a fast distilled model that follows prompts much better than FLUX.1 schnell
// and costs far less than FLUX.2 [dev]. FLUX.1 schnell is the fallback if klein fails or the quota is hit.
// For the best quality (and a paid Workers plan) set CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-2-dev.
// Set CLOUDFLARE_IMAGE_FALLBACK_MODEL to "none" to disable the fallback.
const DEFAULT_MODEL = "@cf/black-forest-labs/flux-2-klein-9b";
const DEFAULT_FALLBACK_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const MODEL_PATTERN = /^@cf\/[\w.-]+\/[\w.-]+$/;
const IMAGE_WIDTH = 1024;
const IMAGE_HEIGHT = 768; // 4:3, matching the 720x540 cover the browser produces
const PRIMARY_TIMEOUT_MS = 40_000;
const FALLBACK_TIMEOUT_MS = 16_000;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 8;
const MAX_PROMPT_LENGTH = 2048;
const requestBuckets = new Map();

function getAllowedOrigins() {
  const configured = (process.env.ALLOWED_ORIGINS || process.env.APP_ORIGIN || "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  if (process.env.VERCEL_URL) configured.push(`https://${process.env.VERCEL_URL}`);
  if (process.env.NODE_ENV !== "production") {
    configured.push("http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:3000");
  }
  return new Set(configured.map((value) => value.replace(/\/$/, "")));
}

function checkOrigin(req, res) {
  const origin = req.headers.origin;
  const allowed = getAllowedOrigins();
  if (!origin || !allowed.has(origin.replace(/\/$/, ""))) {
    res.status(403).json({ error: "This website is not allowed to use the image-generation service. Check ALLOWED_ORIGINS." });
    return false;
  }
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  return true;
}

function getAdminAuth() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Server configuration is missing FIREBASE_SERVICE_ACCOUNT_JSON.");
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must contain the full service-account JSON.");
  }
  const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount) });
  return getAuth(app);
}

function checkRateLimit(req, res, uid) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]) || req.socket?.remoteAddress || "unknown";
  const key = `${uid}:${ip}`;
  const now = Date.now();
  const current = requestBuckets.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    requestBuckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({ error: "Too many image requests. Please wait a few minutes before generating another cover." });
    return false;
  }
  current.count += 1;
  return true;
}

function cloudflareErrorMessage(result, status) {
  const messages = Array.isArray(result?.errors)
    ? result.errors.map((item) => item?.message).filter(Boolean)
    : [];
  return messages.join(" ") || result?.error?.message || `Cloudflare Workers AI returned HTTP ${status}.`;
}

function pickModel(value, fallbackValue) {
  const candidate = (value || "").trim();
  return MODEL_PATTERN.test(candidate) ? candidate : fallbackValue;
}

// FLUX.2 models on Workers AI take multipart/form-data even for text-only prompts.
// klein is distilled with a fixed 4 steps, so `steps` is only sent to the full dev model.
async function runModel({ accountId, apiToken, model, prompt, timeoutMs }) {
  let body, headers = { Authorization: `Bearer ${apiToken}` }; // for multipart, fetch sets the boundary itself
  if (/flux-1-schnell$/.test(model)) {
    // FLUX.1 schnell takes JSON, not multipart.
    body = JSON.stringify({ prompt, steps: 4 });
    headers["Content-Type"] = "application/json";
  } else {
    body = new FormData();
    body.append("prompt", prompt);
    body.append("width", String(IMAGE_WIDTH));
    body.append("height", String(IMAGE_HEIGHT));
    if (/flux-2-dev$/.test(model)) body.append("steps", "28");
  }

  let upstream;
  try {
    upstream = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`,
      {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    return { ok: false, status: 504, detail: timedOut ? "The image model took too long to respond. Please try again." : `Could not reach Cloudflare: ${error?.message || error}` };
  }

  const result = await upstream.json().catch(() => ({}));
  if (!upstream.ok || result?.success === false) {
    return { ok: false, status: upstream.status || 502, detail: cloudflareErrorMessage(result, upstream.status) };
  }
  const image = result?.result?.image || result?.image;
  if (typeof image !== "string" || !image) {
    console.error("Cloudflare returned no image data:", JSON.stringify(result).slice(0, 1000));
    return { ok: false, status: 502, detail: "Cloudflare did not return an image. Please try again with a more specific food description." };
  }
  return { ok: true, image, model };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    if (!checkOrigin(req, res)) return;
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }
  if (!checkOrigin(req, res)) return;

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    return res.status(500).json({ error: "Server configuration is missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN." });
  }

  try {
    const authorization = req.headers.authorization || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ error: "Please sign in before generating a cover image." });

    const decoded = await getAdminAuth().verifyIdToken(match[1], true);
    if (!decoded.uid) return res.status(401).json({ error: "Your sign-in session could not be verified. Please sign in again." });
    if (!checkRateLimit(req, res, decoded.uid)) return;

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
      return res.status(400).json({ error: `A valid image prompt of 1–${MAX_PROMPT_LENGTH} characters is required.` });
    }

    const primary = pickModel(process.env.CLOUDFLARE_IMAGE_MODEL, DEFAULT_MODEL);
    const fallbackRaw = process.env.CLOUDFLARE_IMAGE_FALLBACK_MODEL;
    const fallback = fallbackRaw?.trim().toLowerCase() === "none" ? "" : pickModel(fallbackRaw, DEFAULT_FALLBACK_MODEL);

    let outcome = await runModel({ accountId, apiToken, model: primary, prompt, timeoutMs: PRIMARY_TIMEOUT_MS });
    if (!outcome.ok && fallback && fallback !== primary && outcome.status !== 401 && outcome.status !== 403) {
      console.warn(`Primary image model ${primary} failed (${outcome.status}): ${outcome.detail}. Trying ${fallback}.`);
      const second = await runModel({ accountId, apiToken, model: fallback, prompt, timeoutMs: FALLBACK_TIMEOUT_MS });
      if (second.ok) outcome = second;
    }

    if (!outcome.ok) {
      console.error("Cloudflare image generation failed:", outcome.status, outcome.detail);
      const status = outcome.status === 429 ? 429 : outcome.status >= 500 ? 502 : outcome.status === 401 || outcome.status === 403 ? outcome.status : 400;
      return res.status(status).json({ error: outcome.detail });
    }
    const imageData = outcome.image;

    // Workers AI image models return the image as a Base64 string (PNG or JPEG); sniff the real type.
    const mimeType = imageData.startsWith("/9j/") ? "image/jpeg" : "image/png";
    return res.status(200).json({ image: { mimeType, data: imageData }, model: outcome.model });
  } catch (error) {
    console.error("Cover generation error:", error);
    const message = error?.message || "Unexpected image-generation error.";
    const status = /service-account|FIREBASE_SERVICE_ACCOUNT_JSON/.test(message) ? 500 : /Firebase ID token|auth\/|expired/i.test(message) ? 401 : 500;
    return res.status(status).json({ error: status === 401 ? "Your sign-in session is invalid or expired. Please sign in again." : message });
  }
}
