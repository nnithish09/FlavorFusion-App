import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const MODEL = "@cf/black-forest-labs/flux-1-schnell";
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

    const upstream = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${MODEL}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({ prompt, steps: 4 }),
      },
    );

    const result = await upstream.json().catch(() => ({}));
    const imageData = result?.result?.image || result?.image;
    if (!upstream.ok || result?.success === false) {
      const detail = cloudflareErrorMessage(result, upstream.status);
      console.error("Cloudflare image generation failed:", upstream.status, detail);
      const status = upstream.status === 429 ? 429 : upstream.status >= 500 ? 502 : upstream.status === 401 || upstream.status === 403 ? upstream.status : 400;
      return res.status(status).json({ error: detail });
    }

    if (typeof imageData !== "string" || !imageData) {
      console.error("Cloudflare returned no image data:", JSON.stringify(result).slice(0, 1000));
      return res.status(502).json({ error: "Cloudflare did not return an image. Please try again with a more specific food description." });
    }

    // Workers AI FLUX.1 Schnell returns a Base64-encoded PNG.
    return res.status(200).json({ image: { mimeType: "image/png", data: imageData } });
  } catch (error) {
    console.error("Cover generation error:", error);
    const message = error?.message || "Unexpected image-generation error.";
    const status = /service-account|FIREBASE_SERVICE_ACCOUNT_JSON/.test(message) ? 500 : /Firebase ID token|auth\/|expired/i.test(message) ? 401 : 500;
    return res.status(status).json({ error: status === 401 ? "Your sign-in session is invalid or expired. Please sign in again." : message });
  }
}
