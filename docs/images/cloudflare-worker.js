/**
 * Cloudflare Worker for the Foundry VTT Toolkit's scene image generation.
 *
 * It turns a prompt into an image with Workers AI (FLUX.1 schnell) on Cloudflare's free daily
 * allowance, and answers the browser with the image (with CORS headers, which Cloudflare's own API
 * doesn't send, so Foundry can't call that directly).
 *
 * Setup (see docs/notebooklm/format.md, "Scene images"):
 * 1. Cloudflare dashboard → Workers & Pages → Create → Worker → paste this file → Deploy.
 * 2. Worker → Settings → Bindings → Add → Workers AI, variable name AI.
 * 3. Optional but recommended: Settings → Variables and secrets → add a secret TOKEN; put the same
 *    value in the toolkit's "Cloudflare Worker token" setting.
 * 4. Put the Worker's URL (https://<name>.<account>.workers.dev) in the toolkit's settings.
 */

const MODEL = "@cf/black-forest-labs/flux-1-schnell";

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ORIGIN || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return new Response("POST {\"prompt\": \"...\"}", { status: 405, headers: cors });
    if (env.TOKEN && request.headers.get("Authorization") !== `Bearer ${env.TOKEN}`) {
      return new Response("Unauthorized", { status: 401, headers: cors });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Body must be JSON", { status: 400, headers: cors });
    }
    const prompt = String(body.prompt ?? "").slice(0, 2048);
    if (!prompt) return new Response("Missing prompt", { status: 400, headers: cors });

    try {
      const input = { prompt, steps: 6 };
      if (Number.isInteger(body.seed)) input.seed = body.seed;
      const result = await env.AI.run(MODEL, input);
      const bytes = Uint8Array.from(atob(result.image), c => c.charCodeAt(0));
      return new Response(bytes, { headers: { ...cors, "Content-Type": "image/jpeg" } });
    } catch (err) {
      // 429/500 let the toolkit retry; the free allowance resets daily.
      return new Response(String(err?.message ?? err), { status: /limit|quota|429/i.test(String(err)) ? 429 : 500, headers: cors });
    }
  }
};
