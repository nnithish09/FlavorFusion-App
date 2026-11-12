import { askJSON } from "./groq";
import { auth } from "./firebase";

import { lookupDishLook } from "./dishes";

const MAX_PROMPT = 2048;

const PROMPT_SYSTEM = `You are a food photographer and food-styling director writing a brief for an image model that has NEVER seen the named dish. Describe how the EXACT named recipe looks when finished, as if explaining it to an illustrator: the grain or piece size, consistency (dry, moist, batter, thick gravy, soup), shape, dominant colours, surface texture, visible ingredients, realistic garnish, and the traditional serving vessel. If "knownAppearance" is supplied it is authoritative: build on it and never contradict it. Never rename, generalize or substitute the dish, and never invent a different main ingredient. Describe only what should be visible; do not mention other dishes, and do not use negations such as "not rice". No text, labels, logos, watermarks, people, hands, collages, multiple dishes or illustration. Keep it under 110 words. Return JSON only: {"prompt":"..."}.`;

export async function writeImagePrompt({ title, cuisine, ingredients }) {
  const dish = String(title || "").trim();
  if (!dish) throw new Error("Add a recipe title before writing the image description.");
  const cleanIngredients = (ingredients || []).map((x) => String(x || "").trim()).filter(Boolean).slice(0, 20);
  const knownAppearance = lookupDishLook(dish);
  const fallback = knownAppearance || `${dish}${cuisine ? `, a ${cuisine} dish` : ""}. Show the exact finished dish with its characteristic preparation, colour, texture and visible ingredients${cleanIngredients.length ? `: ${cleanIngredients.join(", ")}` : ""}.`;
  try {
    const result = await askJSON(PROMPT_SYSTEM, JSON.stringify({ dish, cuisine: cuisine || "", ingredients: cleanIngredients, knownAppearance }));
    return String(result.prompt || "").trim() || fallback;
  } catch (error) {
    console.warn("Could not rewrite the image description; using the recipe details directly.", error);
    return fallback;
  }
}

// Build the final instruction from structured recipe data plus the editable description.
// Priority (earlier text carries more weight with image models, and the budget is trimmed from the end):
//   1. exact dish name  2. dictionary appearance  3. ingredients  4. photo direction  5. author guidance
function buildFoodPrompt({ title, cuisine, ingredients, description }) {
  const dish = String(title || "").trim();
  if (!dish) throw new Error("A recipe title is required to generate its cover image.");
  const items = (ingredients || []).map((x) => String(x || "").trim()).filter(Boolean).slice(0, 12);
  const look = lookupDishLook(dish);
  const details = String(description || "").trim();

  const head = `Professional editorial food photograph of ${dish}${cuisine ? `, a traditional ${String(cuisine).slice(0, 60)} dish` : ""}, exactly as it is served.`;
  const appearance = look ? `What ${dish} looks like: ${look}.` : "";
  const ingredientLine = items.length ? `Visible ingredients: ${items.join(", ")}.` : "";
  const photo = "One cooked, ready-to-eat serving in its authentic serving ware, close 45-degree view, soft natural window light, shallow depth of field, true-to-life appetizing colour, realistic food texture, uncluttered table, landscape composition. Single dish only, no text, labels, watermark, people, hands, illustration or CGI.";

  const fixed = [head, appearance, ingredientLine, photo].filter(Boolean);
  const fixedLength = fixed.join("\n\n").length;
  const room = MAX_PROMPT - fixedLength - 40;
  if (room < 0) {
    // Extremely long ingredient list: keep identity, appearance and photo direction.
    return [head, appearance, ingredientLine.slice(0, 200), photo].filter(Boolean).join("\n\n").slice(0, MAX_PROMPT);
  }
  const guidance = details && room > 60 ? `Styling notes (follow only if consistent with ${dish}): ${details.slice(0, room)}` : "";
  return [head, appearance, ingredientLine, guidance, photo].filter(Boolean).join("\n\n");
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
