/**
 * Client-side image compression using the Canvas API.
 *
 * - Only compresses images (never videos).
 * - Skips HEIC/HEIF (canvas cannot decode them in most browsers).
 * - Skips GIF (lossy re-encode would destroy animation).
 * - Skips SVG (vector, no rasterization needed).
 * - Resizes any dimension that exceeds MAX_DIMENSION.
 * - Re-encodes as JPEG at JPEG_QUALITY.
 * - If the result is LARGER than the original, the original is returned.
 * - Falls back to the original file on any error — uploads always continue.
 */

const MAX_DIMENSION = 2500;   // px — largest side allowed
const JPEG_QUALITY  = 0.82;   // 0–1; 0.82 is visually near-lossless for photos
const MIN_SIZE      = 400 * 1024; // skip files already under 400 KB

/** MIME types that cannot be decoded by HTMLImageElement + Canvas. */
const SKIP_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/gif",
  "image/svg+xml",
]);

/**
 * Compress a single image File.
 * Returns a new File (JPEG) or the original if compression is skipped / fails.
 */
export async function compressImage(file: File): Promise<File> {
  // ── Guard: only process compressible images ──────────────────────────────
  if (!file.type.startsWith("image/")) return file;
  if (SKIP_TYPES.has(file.type))        return file;
  if (file.size < MIN_SIZE)             return file;

  return new Promise<File>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    const release = () => URL.revokeObjectURL(objectUrl);

    img.onload = () => {
      release();

      // ── Calculate target dimensions ────────────────────────────────────
      let w = img.naturalWidth;
      let h = img.naturalHeight;

      if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
        if (w >= h) {
          h = Math.round((h / w) * MAX_DIMENSION);
          w = MAX_DIMENSION;
        } else {
          w = Math.round((w / h) * MAX_DIMENSION);
          h = MAX_DIMENSION;
        }
      }

      // ── Draw to canvas ─────────────────────────────────────────────────
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }

      // White background prevents black fill on transparent PNGs → JPEG
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      // ── Encode ─────────────────────────────────────────────────────────
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            // Compressed is no smaller — keep original
            resolve(file);
            return;
          }
          resolve(
            new File([blob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            })
          );
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      release();
      resolve(file); // fallback: upload original
    };

    img.src = objectUrl;
  });
}

/**
 * Returns true when the file is an image that will benefit from compression.
 * Use this to decide whether to show the "Pripravujem fotky…" status.
 */
export function isCompressible(file: File): boolean {
  if (!file.type.startsWith("image/")) return false;
  if (SKIP_TYPES.has(file.type))        return false;
  if (file.size < MIN_SIZE)             return false;
  return true;
}
