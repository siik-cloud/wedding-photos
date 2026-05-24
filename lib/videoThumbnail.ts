/**
 * Client-side video thumbnail generation.
 *
 * Loads the video from a local blob URL (the original File before upload),
 * seeks to an early frame, and captures it via Canvas → JPEG Blob.
 *
 * Why local file, not the signed URL?
 *   - Avoids CORS canvas-taint restrictions on remote videos.
 *   - Works offline and on mobile without any network round-trip.
 *   - The thumbnail is uploaded as a separate small JPEG after the video is stored.
 *
 * Falls back gracefully to null on any failure — thumbnail generation must
 * never block or fail a video upload.
 */

export interface ThumbnailResult {
  blob: Blob;
  width: number;
  height: number;
}

const MAX_DIMENSION = 800;   // cap so the JPEG stays under ~100 KB
const JPEG_QUALITY  = 0.82;
const TIMEOUT_MS    = 8_000; // give up after 8 s — don't hang the upload

export async function generateVideoThumbnail(
  file: File,
  seekSecs = 1
): Promise<ThumbnailResult | null> {
  if (typeof document === "undefined") return null; // SSR guard

  return new Promise<ThumbnailResult | null>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video     = document.createElement("video");

    let resolved = false;
    const done = (value: ThumbnailResult | null) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      // Detach src so the browser releases the decode pipeline
      video.src = "";
      URL.revokeObjectURL(objectUrl);
      resolve(value);
    };

    const timer = setTimeout(() => done(null), TIMEOUT_MS);

    const captureFrame = () => {
      if (resolved) return;
      const rawW = video.videoWidth  || 640;
      const rawH = video.videoHeight || 360;
      if (rawW === 0 || rawH === 0) { done(null); return; }

      const scale = Math.min(1, MAX_DIMENSION / Math.max(rawW, rawH));
      const w = Math.round(rawW * scale);
      const h = Math.round(rawH * scale);

      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) { done(null); return; }

      ctx.drawImage(video, 0, 0, w, h);
      canvas.toBlob(
        (blob) => done(blob ? { blob, width: w, height: h } : null),
        "image/jpeg",
        JPEG_QUALITY
      );
    };

    video.onseeked = captureFrame;

    // Some Android browsers fire canplay instead of onseeked after seek
    video.oncanplay = () => {
      if (!resolved && video.videoWidth > 0) captureFrame();
    };

    video.onloadedmetadata = () => {
      // Seek to 1 s or 10 % of duration (whichever is less)
      const dur = video.duration;
      const t   = isFinite(dur) && dur > 0
        ? Math.min(seekSecs, dur * 0.1)
        : 0;
      video.currentTime = Math.max(0, t);
    };

    video.onerror   = () => done(null);
    video.onstalled = () => done(null);

    // Required for iOS Safari to load video metadata without a user gesture
    video.muted    = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.preload  = "metadata";
    video.src      = objectUrl;
  });
}
