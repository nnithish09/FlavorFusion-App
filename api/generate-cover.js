import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const MODEL = "gemini-3.1-flash-image";
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 8;
const requestBuckets = new Map();

function getAllowedOrigins() {
  const configured = (process.env.ALLOWED_ORIGINS || process.env.APP_ORIGIN || "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  if (process.env.VERCEL_URL) configured.push(`https://${process.env.VERCEL_URL}`);
  if (process.env.NODE_ENV !== "production") configured.push("http://localhost:5173", "http://localhost:3000");
  return new Set(configured.map((value) => value.replace(/\/$/, "")));
}

function checkOrigin(req, res) {
  const origin = req.headers.origin;
  const allowed = getAllowedOrigins();
  if (!origin || !allowed.has(origin.replace(/\/$/, ""))) {
    res.status(403).json({ error: "This website is not allowed to use the image-generation service. Check ALLOWED_ORIGINS in Vercel." });
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
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]) || "unknown";
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Server configuration is missing GEMINI_API_KEY." });

  try {
    const authorization = req.headers.authorization || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ error: "Please sign in before generating a cover image." });

    const decoded = await getAdminAuth().verifyIdToken(match[1], true);
    if (!decoded.uid) return res.status(401).json({ error: "Your sign-in session could not be verified. Please sign in again." });
    if (!checkRateLimit(req, res, decoded.uid)) return;

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt || prompt.length > 6000) {
      return res.status(400).json({ error: "A valid image prompt of 1–6000 characters is required." });
    }

    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["IMAGE"],
        },
      }),
    });

    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const detail = result?.error?.message || `Gemini API returned HTTP ${upstream.status}.`;
      console.error("Gemini image generation failed:", upstream.status, detail);
      const status = upstream.status === 429 ? 429 : upstream.status >= 500 ? 502 : 400;
      return res.status(status).json({ error: detail });
    }

    const parts = result?.candidates?.flatMap((candidate) => candidate?.content?.parts || []) || [];
    const imagePart = parts.find((part) => part.inlineData?.data || part.inline_data?.data);
    const imageData = imagePart?.inlineData || imagePart?.inline_data;
    if (!imageData?.data) {
      const reason = result?.promptFeedback?.blockReason || result?.candidates?.[0]?.finishReason;
      console.error("Gemini returned no image part:", reason || "unknown response", JSON.stringify(result).slice(0, 1200));
      return res.status(502).json({ error: reason ? `Gemini did not generate an image (${reason}). Try a more specific food description.` : "Gemini returned no image. Please try again with a more specific food description." });
    }

    return res.status(200).json({ image: { mimeType: imageData.mimeType || imageData.mime_type || "image/png", data: imageData.data } });
  } catch (error) {
    console.error("Cover generation error:", error);
    const message = error?.message || "Unexpected image-generation error.";
    const status = /service-account|FIREBASE_SERVICE_ACCOUNT_JSON/.test(message) ? 500 : /Firebase ID token|auth\/|expired/i.test(message) ? 401 : 500;
    return res.status(status).json({ error: status === 401 ? "Your sign-in session is invalid or expired. Please sign in again." : message });
  }
}
