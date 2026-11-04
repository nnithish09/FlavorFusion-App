// Generates the dish photos shown on the landing page into public/landing/.
// Usage: npm run landing:images   (needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in .env.development.local)
// Re-run for a single dish with: npm run landing:images -- souffle
import { mkdir, writeFile } from "node:fs/promises";
import { lookupDishLook } from "../src/dishes.js";

const MODEL = process.env.CLOUDFLARE_IMAGE_MODEL || "@cf/black-forest-labs/flux-2-klein-9b";
if (/flux-1-schnell$/.test(MODEL)) { console.error("This script needs a FLUX.2 model (multipart). Use flux-2-klein-9b or flux-2-dev."); process.exit(1); }
const { CLOUDFLARE_ACCOUNT_ID: acc, CLOUDFLARE_API_TOKEN: token } = process.env;
if (!acc || !token) { console.error("Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (see .env.development.local)."); process.exit(1); }

// file name, dish title (matched against src/dishes.js), cuisine
const DISHES = [
  ["chingri-malai", "Chingri malai curry", "Bengali"],
  ["souffle", "Cheese soufflé", "French"],
  ["xiaolongbao", "Xiaolongbao", "Shanghainese"],
  ["paella", "Paella Valenciana", "Spanish"],
  ["mole-poblano", "Mole poblano", "Mexican"],
  ["galouti-kebab", "Galouti kebab", "Awadhi"],
];

const only = process.argv[2];
await mkdir(new URL("../public/landing/", import.meta.url), { recursive: true });
for (const [file, title, cuisine] of DISHES) {
  if (only && only !== file) continue;
  const look = lookupDishLook(title);
  const prompt = [
    `Professional editorial food photograph of ${title}, a traditional ${cuisine} dish, exactly as it is served.`,
    look ? `What ${title} looks like: ${look}.` : "",
    "One cooked, ready-to-eat serving in its authentic serving ware, close 45-degree view, soft natural window light, shallow depth of field, true-to-life appetizing colour, realistic food texture, uncluttered table, landscape composition. Single dish only, no text, labels, watermark, people, hands, illustration or CGI.",
  ].filter(Boolean).join("\n\n");
  const form = new FormData();
  form.append("prompt", prompt); form.append("width", "1024"); form.append("height", "768");
  if (/flux-2-dev$/.test(MODEL)) form.append("steps", "28");
  process.stdout.write(`${file} ... `);
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acc}/ai/run/${MODEL}`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
  const j = await r.json().catch(() => ({}));
  const img = j?.result?.image || j?.image;
  if (!r.ok || !img) { console.log("failed:", j?.errors?.[0]?.message || r.status); continue; }
  await writeFile(new URL(`../public/landing/${file}.png`, import.meta.url), Buffer.from(img, "base64"));
  console.log("saved");
}
console.log("Check each image. Re-run a single one with: npm run landing:images -- <name>");
