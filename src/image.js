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
  const items = (ingredients || []).map((x) => String(x || "").trim()).filter(Boolean).slice(0, 14);
  const details = String(description || "").trim();
  const core = [
    `Create one premium, photorealistic editorial food photograph of the exact finished dish: “${dish}”.`,
    cuisine ? `Cuisine: ${String(cuisine).slice(0, 80)}.` : "",
    items.length ? `Visible recipe ingredients: ${items.join(", ")}. Do not replace the main ingredients.` : "",
    `DISH FIDELITY IS ESSENTIAL: unmistakably depict ${dish}, respecting its customary preparation, recognizable shape, colour, texture and serving style. Do not turn it into a generic curry, rice bowl or unrelated dish.`,
    "Show one cooked, ready-to-eat serving in an appropriate real plate or bowl. Natural window light, appetizing believable colour, crisp realistic food texture, uncluttered tabletop, professional restaurant food photography, close 45-degree view, landscape composition.",
    "One dish only. No text, labels, logos, watermark, collage, people, hands, illustration, painting, CGI or plastic-looking food."
  ].filter(Boolean);
  const detailLine = details ? `Author appearance guidance (only if consistent with the named dish): ${details}` : "";
  let prompt = [...core.slice(0, 3), detailLine, ...core.slice(3)].filter(Boolean).join("\n\n");
  if (prompt.length <= 2048) return prompt;

  // Trim optional author prose first; preserve the recipe name, core food identity and photo direction.
  const availableForDetails = Math.max(0, 2048 - (prompt.length - details.length));
  const shortenedDetails = details.slice(0, Math.min(details.length, availableForDetails));
  prompt = [...core.slice(0, 3), shortenedDetails ? `Author guidance: ${shortenedDetails}` : "", ...core.slice(3)].filter(Boolean).join("\n\n");
  if (prompt.length <= 2048) return prompt;

  // If still too long, reduce ingredient detail while keeping the exact dish and photography constraints.
  const compactIngredients = items.join(", ").slice(0, 300);
  const compactCore = [
    `Photorealistic editorial food photograph of the exact finished dish: “${dish}”.`,
    cuisine ? `Cuisine: ${String(cuisine).slice(0, 60)}.` : "",
    compactIngredients ? `Ingredients: ${compactIngredients}.` : "",
    `It must unmistakably look like ${dish}, with its customary preparation, shape, colour, texture and serving style; never substitute the dish.`,
    "One cooked serving, appropriately plated. Natural window light, realistic appetizing food texture, uncluttered tabletop, professional restaurant photography, close 45-degree landscape composition.",
    "One dish only; no text, watermark, collage, people, hands, illustration or CGI."
  ].filter(Boolean).join("\n\n");
  return compactCore.slice(0, 2048);
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
    throw new Error("The image provider returned no image. Please try again.");
  }
  return toJpeg(payload.image.data, payload.image.mimeType);
}
