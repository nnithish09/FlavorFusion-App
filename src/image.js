import { askJSON } from "./groq";
const e = import.meta.env;
const rand = () => Math.floor(Math.random() * 1e6);

const SYS = `You write prompts for a text-to-image model so the picture matches ONE specific dish exactly as it is traditionally served. Rules: start with the dish name, its cuisine and a plain description of what the dish is (for example "Upma, a South Indian breakfast porridge made from roasted semolina"). Then describe its true colour and texture, up to six visible ingredients taken from the ingredient list, the garnish, and the traditional serving vessel. Then add the photography style: overhead 45 degree angle, natural window light, shallow depth of field, realistic professional food photography, appetizing. End with: single dish only, no text, no watermark, no people, no hands. Keep it under 90 words and use concrete visual words, not abstract ones. Return {"prompt":""}.`;

export async function writeImagePrompt({ title, cuisine, ingredients }) {
  const r = await askJSON(SYS, JSON.stringify({ dish: title, cuisine: cuisine || "", ingredients: (ingredients || []).filter(Boolean).slice(0, 16) }));
  return String(r.prompt || "").trim() || `${title}, realistic professional food photography`;
}

// Shrinks the result to a small JPEG so it can be stored with the blog and never regenerates or expires.
async function toJpeg(blob, w = 720, h = 540) {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const s = Math.max(w / bmp.width, h / bmp.height), dw = bmp.width * s, dh = bmp.height * s;
  c.getContext("2d").drawImage(bmp, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return c.toDataURL("image/jpeg", 0.8);
}

export async function generateCover(prompt) {
  const key = e.VITE_POLLINATIONS_TOKEN, seed = String(rand()), enc = encodeURIComponent(prompt);
  const qs = (model) => new URLSearchParams({ width: "1024", height: "768", nologo: "true", seed, model });
  const legacy = `${e.VITE_POLLINATIONS_BASE_URL || "https://image.pollinations.ai/prompt"}/${enc}?${qs("flux")}`;
  const base = key ? e.VITE_POLLINATIONS_API_URL || "https://gen.pollinations.ai/image" : e.VITE_POLLINATIONS_BASE_URL || "https://image.pollinations.ai/prompt";
  try {
    const r = await fetch(`${base}/${enc}?${qs(e.VITE_POLLINATIONS_MODEL || "flux")}`, key ? { headers: { Authorization: `Bearer ${key}` } } : undefined);
    if (!r.ok) throw new Error(`Image API ${r.status}`);
    const blob = await r.blob();
    if (!blob.type.startsWith("image/")) throw new Error("Image API returned no image");
    return await toJpeg(blob);
  } catch (err) {
    console.warn("Cover generation fell back to the free flux URL:", err);
    return legacy;
  }
}
