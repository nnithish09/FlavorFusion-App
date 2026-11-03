import { askJSON } from "./groq";
import { auth } from "./firebase";

const PROMPT_SYSTEM = `You are a culinary food photographer and food-styling director. Write a concise visual description for a photograph of the EXACT named recipe. Never rename, generalize, substitute, or reinterpret the dish. Preserve the defining preparation method and recognizable regional appearance. Use only the supplied ingredients; do not invent a different main ingredient. Describe the real cooked appearance, dominant colours, texture, visible ingredients, realistic garnish, and a suitable plate or bowl. Avoid vague phrases such as "delicious food". Do not request text, labels, logos, watermarks, people, hands, collages, multiple dishes, or illustration. Return JSON only: {"prompt":"..."}.`;

export async function writeImagePrompt({ title, cuisine, ingredients }) {
  const dish = String(title || "").trim();
  if (!dish) throw new Error("Add a recipe title before writing the image description.");
  const cleanIngredients = (ingredients || []).map((x) => String(x || "").trim()).filter(Boolean).slice(0, 20);
  const fallback = `${dish}${cuisine ? `, a ${cuisine} dish` : ""}. Show the exact finished dish with its characteristic preparation, colour, texture and visible ingredients${cleanIngredients.length ? `: ${cleanIngredients.join(", ")}` : ""}.`;
  try {
    const result = await askJSON(PROMPT_SYSTEM, JSON.stringify({ dish, cuisine: cuisine || "", ingredients: cleanIngredients }));
    return String(result.prompt || "").trim() || fallback;
  } catch (error) {
    console.warn("Could not rewrite the image description; using the recipe details directly.", error);
    return fallback;
  }
}

// Build the final instruction from structured recipe data as well as the editable description.
// The structured title and ingredients always take precedence over free-form prompt text.
function buildFoodPrompt({ title, cuisine, ingredients, description }) {
  const dish = String(title || "").trim();
  if (!dish) throw new Error("A recipe title is required to generate its cover image.");
  const items = (ingredients || []).map((x) => String(x || "").trim()).filter(Boolean).slice(0, 18);
  const details = String(description || "").trim().slice(0, 1800);
  return [
    `Create one premium, photorealistic editorial food photograph of the exact finished dish: “${dish}”.`,
    cuisine ? `Cuisine / culinary context: ${String(cuisine).slice(0, 100)}.` : "",
    items.length ? `Recipe ingredients (show a plausible selection visibly in the finished dish; do not replace the main ingredients): ${items.join(", ")}.` : "",
    details ? `Additional appearance guidance from the recipe author (use only when consistent with the exact dish and ingredient list): ${details}` : "",
    `DISH FIDELITY IS THE HIGHEST PRIORITY: the food must unmistakably look like ${dish}, not a generic curry, rice bowl, stew, or unrelated dish. Respect the dish's customary preparation, shape, colour, texture, and serving style. Do not substitute ingredients or invent a different cuisine. If the dish is region-specific, depict its recognizable traditional form.`,
    "Photograph the cooked, ready-to-eat food only, attractively plated in one appropriate real plate or bowl. Natural window light, appetizing but believable colour, crisp realistic food texture, subtle uncluttered tabletop, professional restaurant/editorial food photography, close 45-degree three-quarter view, shallow depth of field. Landscape 4:3 composition with the dish filling most of the frame.",
    "One dish only. No text, typography, labels, logos, watermark, border, collage, split panel, people, hands, utensils covering the food, raw ingredient arrangement, illustration, painting, CGI, plastic-looking surfaces, or decorative objects unrelated to the recipe."
  ].filter(Boolean).join("\n\n");
}

async function toJpeg(data, mimeType, width = 720, height = 540) {
  const blob = await (await fetch(`data:${mimeType};base64,${data}`)).blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const scale = Math.max(width / bitmap.width, height / bitmap.height);
  const drawWidth = bitmap.width * scale;
  const drawHeight = bitmap.height * scale;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Your browser could not prepare the generated cover image.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.84);
}

export async function generateCover({ title, cuisine, ingredients, description }) {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in again before generating a cover image.");
  const idToken = await user.getIdToken();
  const prompt = buildFoodPrompt({ title, cuisine, ingredients, description });
  const response = await fetch("/api/generate-cover", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ prompt }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error || `Image generation failed (${response.status}).`;
    throw new Error(message);
  }
  if (!payload.image?.data || !payload.image?.mimeType) {
    throw new Error("Gemini returned a response without an image. Please try again.");
  }
  return toJpeg(payload.image.data, payload.image.mimeType);
}
