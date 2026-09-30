// index.js — Cloudflare Worker: the only place the API key exists.
//
// The static site on GitHub Pages cannot hold a key. This sits in front of
// Gemini, holds the key as a secret, and refuses everything it should refuse.
//
// Free tier arithmetic: Workers allows 100,000 requests/day; the Gemini free
// tier is around 1,500/day. So the Worker is never the constraint — its job is
// to make sure ONE person cannot drink the day's model quota, and to fail in a
// way the interface can explain.

import { EXTRACTION_SCHEMA, SYSTEM_PROMPT } from './schema.js';

const MODEL = 'gemini-2.5-flash-lite';
const MAX_IMAGE_BYTES = 1_500_000;      // the client resizes to ~150 KB; this is the backstop
const PER_IP_PER_DAY = 40;              // generous for one student, useless for a scraper
const PER_IP_PER_MINUTE = 6;

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405, cors);
    if (!allowedOrigin(origin, env)) return json({ error: 'Not allowed from this origin.' }, 403, cors);

    const url = new URL(request.url);
    if (url.pathname !== '/extract') return json({ error: 'Not found' }, 404, cors);

    // ── rate limit ────────────────────────────────────────────────────────
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const limited = await rateLimit(env, ip);
    if (limited) {
      return json({
        error: 'rate_limited',
        message: limited.message,
        retryAfter: limited.retryAfter,
      }, 429, cors);
    }

    // ── body ──────────────────────────────────────────────────────────────
    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'Body must be JSON.' }, 400, cors); }

    const { imageBase64, mimeType = 'image/jpeg', hint } = body || {};
    if (typeof imageBase64 !== 'string' || !imageBase64.length) {
      return json({ error: 'imageBase64 is required.' }, 400, cors);
    }
    if (imageBase64.length * 0.75 > MAX_IMAGE_BYTES) {
      return json({
        error: 'image_too_large',
        message: 'That image is too big. Resize it to about 1024 px wide before sending.',
      }, 413, cors);
    }
    if (!/^image\/(jpeg|png|webp)$/.test(mimeType)) {
      return json({ error: 'mimeType must be image/jpeg, image/png or image/webp.' }, 400, cors);
    }

    if (!env.GEMINI_API_KEY) return json({ error: 'Server is not configured.' }, 500, cors);

    // ── call the model ────────────────────────────────────────────────────
    const parts = [{ inline_data: { mime_type: mimeType, data: imageBase64 } }];
    if (typeof hint === 'string' && hint.trim()) {
      parts.push({ text: `The student adds: ${hint.trim().slice(0, 400)}` });
    }

    const payload = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0,                         // extraction, not writing
        maxOutputTokens: 700,
        responseMimeType: 'application/json',
        responseSchema: toGeminiSchema(EXTRACTION_SCHEMA),
      },
    };

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
    let res;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(25_000),
      });
    } catch (e) {
      return json({
        error: 'upstream_unreachable',
        message: 'Could not reach the reader. Type the numbers in instead.',
      }, 502, cors);
    }

    if (res.status === 429) {
      // The day's free quota is gone. This is expected, not broken.
      return json({
        error: 'quota_exhausted',
        message: "Photo reading has run out for today. Type the numbers in instead — everything else still works.",
      }, 429, cors);
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('gemini error', res.status, detail.slice(0, 500));
      return json({
        error: 'upstream_error',
        message: 'The reader failed. Type the numbers in instead.',
      }, 502, cors);
    }

    // ── unwrap ────────────────────────────────────────────────────────────
    let extraction;
    try {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('no text part');
      extraction = JSON.parse(text);
    } catch (e) {
      console.error('parse failure', e);
      return json({
        error: 'unreadable_response',
        message: 'Could not make sense of that image. Try a clearer photo, or type the numbers in.',
      }, 502, cors);
    }

    return json({ ok: true, extraction }, 200, cors);
  },
};

/* ── helpers ──────────────────────────────────────────────────────────── */

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function allowedOrigin(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!allowed.length) return true;               // unset = open, for local testing
  return allowed.includes(origin);
}

function corsHeaders(origin, env) {
  return {
    'Access-Control-Allow-Origin': allowedOrigin(origin, env) ? (origin || '*') : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

/**
 * Two windows: a burst limit and a daily limit, both per IP.
 *
 * Uses KV if it is bound. KV's free tier allows 1,000 writes/day, which is
 * fewer than the model's own quota — so we only write when a counter actually
 * changes bucket, and if KV is absent we fall through rather than fail closed.
 * The model's own 429 is the real backstop; this is about politeness.
 */
async function rateLimit(env, ip) {
  if (!env.RATE_KV) return null;                  // not bound — rely on upstream 429
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const minute = Math.floor(now / 60_000);

  try {
    const dayKey = `d:${day}:${ip}`;
    const minKey = `m:${minute}:${ip}`;

    const [dayRaw, minRaw] = await Promise.all([env.RATE_KV.get(dayKey), env.RATE_KV.get(minKey)]);
    const dayCount = Number(dayRaw || 0);
    const minCount = Number(minRaw || 0);

    if (minCount >= PER_IP_PER_MINUTE) {
      return { message: 'Slow down a moment — try again in a minute.', retryAfter: 60 };
    }
    if (dayCount >= PER_IP_PER_DAY) {
      return { message: "You've used today's photo readings. Type the numbers in instead.", retryAfter: 3600 };
    }

    await Promise.all([
      env.RATE_KV.put(dayKey, String(dayCount + 1), { expirationTtl: 172800 }),
      env.RATE_KV.put(minKey, String(minCount + 1), { expirationTtl: 120 }),
    ]);
  } catch (e) {
    console.error('rate limit store failed', e);   // never block on the limiter breaking
  }
  return null;
}

/** Gemini takes an OpenAPI-ish subset: strip `description` noise it ignores, keep structure. */
function toGeminiSchema(s) {
  if (Array.isArray(s)) return s.map(toGeminiSchema);
  if (s && typeof s === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(s)) {
      if (k === 'description') { out[k] = v; continue; }
      out[k] = toGeminiSchema(v);
    }
    return out;
  }
  return s;
}
