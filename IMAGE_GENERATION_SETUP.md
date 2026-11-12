# FlavorFusion image generation (Cloudflare Workers AI + FLUX.2)

Pollinations and Gemini image generation have been removed. Cover images are generated server-side through Cloudflare Workers AI.

- **Primary model:** `@cf/black-forest-labs/flux-2-klein-9b`, fast, cheaper, and much better at following prompts than FLUX.1 Schnell.
- **Fallback model:** `@cf/black-forest-labs/flux-1-schnell`, used automatically if the primary fails or the daily quota is hit. It is the weakest on regional dishes, so it relies most on the dish dictionary below.
- **Best quality:** set `CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-2-dev`. It uses far more of the free daily allocation (10,000 neurons), so expect only a few images per day without the Workers Paid plan.
- Set `CLOUDFLARE_IMAGE_FALLBACK_MODEL=none` to disable the fallback. Check [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) for current costs.

## Why dishes like upma used to come out as rice

Image models map an unfamiliar dish name to the closest thing they know. Two changes address that:

1. A stronger model (above).
2. `src/dishes.js` holds a dictionary of Indian dishes with their visual appearance (grain size, consistency, colour, serving vessel). When the recipe title matches, that description is placed right after the dish name in the prompt, and is also given to the Groq prompt writer as authoritative context. To fix another dish, add an entry there. Describe appearance in positive terms; image models draw whatever you name, so avoid writing "not rice".

## Server environment variables

Set these in your hosting provider's server-side environment (for Vercel: Project → Settings → Environment Variables):

- `CLOUDFLARE_ACCOUNT_ID`: your Cloudflare account ID.
- `CLOUDFLARE_API_TOKEN`: a Cloudflare API token with Workers AI permissions. Keep it secret; never use a `VITE_` prefix.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: the complete Firebase service-account JSON for the same Firebase project used by the web app. This is used only to verify Firebase Authentication ID tokens.
- `ALLOWED_ORIGINS`: exact allowed website origins, comma-separated. Include your production origin, for example `https://flavorfusion-ai.vercel.app`.

The existing `VITE_FIREBASE_*` variables remain the Firebase Web App configuration. They are not substitutes for the Admin service-account JSON.

## Cloudflare setup

1. Open Cloudflare Dashboard → Workers AI → Use REST API.
2. Create a Workers AI API token. Use the token template or grant the token Workers AI permissions (Read/Write as required by your account's token flow).
3. Copy the Account ID and API token into the server environment variables above.
4. Check the [FLUX.2 dev](https://developers.cloudflare.com/workers-ai/models/flux-2-dev/) and [FLUX.2 klein 9B](https://developers.cloudflare.com/workers-ai/models/flux-2-klein-9b/) model documentation and [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/).

The prompt is capped at 2,048 characters. The frontend prompt builder keeps the exact recipe title and core dish identity while shortening optional details to fit.

## Firebase service account

In Firebase Console, open Project settings → Service accounts → Firebase Admin SDK. Use a service account for the same project as `VITE_FIREBASE_PROJECT_ID`. Store its JSON only in `FIREBASE_SERVICE_ACCOUNT_JSON`; never commit the key file or paste it into a `VITE_` variable. Rotate any service-account private key that has previously been exposed.

## Local development (without Vercel login)

The Vite dev server proxies `/api` requests to `local-api.js`. Add these server-only variables to `.env.development.local`:

```env
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Keep `FIREBASE_SERVICE_ACCOUNT_JSON` as one line of valid JSON. Do not share or commit this file.

Open two terminals in the project folder:

Terminal 1:
```powershell
npm run dev:api
```

Terminal 2:
```powershell
npm run dev
```

Then open the Vite URL (normally `http://localhost:5173`). No Vercel CLI login or access to another person's Vercel project is needed for local testing.

## Image generation flow and safeguards

- The browser sends the prompt and Firebase ID token to `/api/generate-cover`.
- The server verifies the ID token using Firebase Admin.
- The server applies a best-effort in-memory rate limit (8 requests per 10 minutes per user/IP; serverless instances do not share this counter).
- The Cloudflare API token remains server-side.
- The model returns a Base64 image (requested at 1024x768). The existing browser code converts it to a 720×540 JPEG data URL.
- The app's existing Firestore thumbnail field and storage flow remain unchanged. No Firebase Storage migration is required.
- There is no Pollinations or Gemini fallback. Provider errors are surfaced to the UI.
- Workers AI free usage is subject to Cloudflare's current daily allocation, account limits and pricing terms; it is not unlimited.
