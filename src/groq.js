const e = import.meta.env;
const BASE = e.VITE_GROQ_BASE_URL || "https://api.groq.com/openai/v1";

export async function askJSON(system, user) {
  if (!e.VITE_GROQ_API_KEY) throw new Error("Missing VITE_GROQ_API_KEY in .env");
  const r = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${e.VITE_GROQ_API_KEY}` },
    body: JSON.stringify({
      model: e.VITE_GROQ_MODEL || "openai/gpt-oss-120b",
      reasoning_effort: e.VITE_GROQ_REASONING_EFFORT || "low",
      temperature: Number(e.VITE_GROQ_TEMPERATURE ?? 0.7),
      max_completion_tokens: Number(e.VITE_GROQ_MAX_TOKENS || 6000),
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system + " Respond with valid JSON only." }, { role: "user", content: user }],
    }),
  });
  if (!r.ok) throw new Error(`Groq ${r.status}: ${await r.text()}`);
  return JSON.parse((await r.json()).choices[0].message.content);
}

// Groq hosts no image model, so thumbnails use Pollinations, driven by a Groq-written prompt.
export function thumbUrl(prompt, seed = 1) {
  const p = new URLSearchParams({
    width: e.VITE_POLLINATIONS_WIDTH || "1024",
    height: e.VITE_POLLINATIONS_HEIGHT || "768",
    nologo: "true",
    seed: String(seed),
  });
  if (e.VITE_POLLINATIONS_MODEL) p.set("model", e.VITE_POLLINATIONS_MODEL);
  if (e.VITE_POLLINATIONS_REFERRER) p.set("referrer", e.VITE_POLLINATIONS_REFERRER);
  if (e.VITE_POLLINATIONS_TOKEN) p.set("token", e.VITE_POLLINATIONS_TOKEN);
  const base = e.VITE_POLLINATIONS_BASE_URL || "https://image.pollinations.ai/prompt";
  return `${base}/${encodeURIComponent(prompt)}?${p}`;
}
