# suvat-reader

The Cloudflare Worker that reads a photo of an exam question and returns the
numbers printed on it. It exists for one reason: a static site on GitHub Pages
has nowhere to hide an API key, and this does.

**The key never goes in this repo.** It is set as a Worker secret.

---

## Setup — about five minutes

### 1 · Get a Gemini key

[aistudio.google.com/apikey](https://aistudio.google.com/apikey) → **Create API key**.
No card required.

> **Read this before uploading anything.** On the free tier, Google's terms say
> it "uses the content you submit… to provide, improve, and develop Google
> products", and that "human reviewers may read, annotate, and process your API
> input and output". For exam questions that is probably fine — but the upload
> button should say so, and students should photograph the *question*, not a
> whole page with their name on it.

### 2 · Install and log in

```bash
cd worker
npm install
npx wrangler login
```

### 3 · Give it the key

```bash
npx wrangler secret put GEMINI_API_KEY
```

Paste the key at the prompt. It is stored encrypted by Cloudflare. It is not in
`wrangler.toml`, not in git, and not visible to anyone reading the repo.

### 4 · (Optional) per-person rate limiting

```bash
npx wrangler kv namespace create RATE_KV
```

Paste the printed id into `wrangler.toml` and uncomment that block. Without it
the Worker still works — it just leans on Gemini's own quota instead of
stopping one person draining the day's allowance.

### 5 · Deploy

```bash
npx wrangler deploy
```

Wrangler prints the URL. Put that in the site as the reader endpoint.

---

## Check it works

```bash
curl -X POST https://suvat-reader.<your-subdomain>.workers.dev/extract \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://abtbinrashid.github.io' \
  -d "{\"imageBase64\":\"$(base64 -w0 question.jpg)\",\"mimeType\":\"image/jpeg\"}"
```

Expected shape:

```json
{ "ok": true,
  "extraction": {
    "understood": true,
    "confidence": "high",
    "scenario": "angled_from_height",
    "summary": "A ball is projected from the top of a 25 m cliff at 45 degrees.",
    "angle": { "degrees": 45 },
    "h": 25,
    "range": 100,
    "asks": ["the value of U", "the greatest height"]
  }}
```

Note what is **not** there: no launch speed, because the question asks you to
find it; and no `36.87`, because a ratio is returned as a ratio.
`js/core/question.js` does that arithmetic, with tests.

---

## What it refuses

| Situation | Response |
|---|---|
| Not a POST to `/extract` | 404 / 405 |
| Origin not in `ALLOWED_ORIGINS` | 403 |
| Image over ~1.5 MB | 413, "resize to about 1024 px" |
| Too many requests from one IP | 429 with a friendly message |
| Gemini's daily quota gone | 429 `quota_exhausted` — "type the numbers in instead" |
| Gemini down or slow | 502 after 25 s |
| Response not valid JSON | 502, asks for a clearer photo |

Every failure resolves to the same fallback: the student types the numbers in.
Nothing about this feature is load-bearing.

---

## Free tier limits

| | Free allowance | Reality |
|---|---|---|
| Workers | 100,000 req/day | never the constraint |
| Gemini Flash-Lite | ~1,500 req/day | the real ceiling |
| KV writes | 1,000/day | why rate limiting is optional |

Google no longer publishes the rate-limit table publicly, so treat ~1,500 as
the right order of magnitude rather than a guarantee. Check your live limits at
[AI Studio](https://aistudio.google.com/rate-limit).

---

## The rule this is built on

**The model reads. The engine calculates.**

The model returns only what is printed on the page. Every derived quantity —
degrees from a ratio, a launch speed from a range — is computed in
`js/core/question.js` against `js/core/projectile.js`, both under test. Language
models make arithmetic slips, and a student revising from a confidently wrong
number is worse off than one who got no help at all.
