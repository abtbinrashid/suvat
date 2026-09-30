// capture.js — prepare a photo for the reader, and send it.
//
// The resize here matters more than any model choice. A phone photo is 3–4 MB;
// at 1024 px wide it is around 150 KB. On school wifi that is the difference
// between roughly 2 seconds and roughly 8. The model does not need the pixels:
// it is reading printed numbers, not fine detail.

const MAX_EDGE = 1024;
const QUALITY = 0.82;

/** File or Blob → { base64, mimeType, bytes }, resized and re-encoded. */
export async function prepareImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', QUALITY));
  const base64 = await blobToBase64(blob);
  return { base64, mimeType: 'image/jpeg', bytes: blob.size, width: w, height: h };
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1]);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

/**
 * Send a prepared image to the reader.
 * Resolves to { ok:true, extraction } or { ok:false, error, message } — it
 * never throws, because every failure path here has a sensible fallback:
 * the student types the numbers in.
 */
export async function readQuestion(endpoint, prepared, { hint, signal } = {}) {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: prepared.base64, mimeType: prepared.mimeType, hint }),
      signal: signal || AbortSignal.timeout(30_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error || 'failed', message: data.message || 'Could not read that image.' };
    }
    return data;
  } catch (e) {
    return {
      ok: false,
      error: e.name === 'TimeoutError' ? 'timeout' : 'network',
      message: 'No response from the reader. Type the numbers in instead.',
    };
  }
}
