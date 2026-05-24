/**
 * Client-side image thumbnail generator (Canvas API).
 *
 * Produces a JPEG at max 600 px on the longest side, quality 0.75.
 * Used during upload so grid tiles can show a small thumbnail instead
 * of loading the full-resolution original.
 *
 * Skips HEIC/HEIF (canvas cannot decode them in most browsers) and GIF
 * (re-encoding destroys animation). Returns null for those — the gallery
 * falls back to the original URL.
 */

export interface ImageThumbnailResult {
  blob: Blob;
  width: number;
  height: number;
}

const MAX_DIMENSION = 600;
const JPEG_QUALITY  = 0.75;

/** Returns null when the file cannot / should not be thumbnailed. */
export async function generateImageThumbnail(
  source: File | Blob
): Promise<ImageThumbnailResult | null> {
  // Name/type checks only apply when source is a File
  if (source instanceof File) {
    const ext  = source.name.split(".").pop()?.toLowerCase() ?? "";
    const mime = source.type.toLowerCase();
    if (mime.includes("heic") || mime.includes("heif") || ext === "heic" || ext === "heif") {
      return null; // canvas cannot decode HEIC
    }
    if (mime === "image/gif") return null; // re-encoding kills animation
  }

  return new Promise((resolve) => {
    const blobUrl = URL.createObjectURL(source);
    const img     = new Image();

    img.onload = () => {
      URL.revokeObjectURL(blobUrl);

      let { naturalWidth: w, naturalHeight: h } = img;

      // Scale down so the longest side ≤ MAX_DIMENSION
      if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
        if (w >= h) {
          h = Math.round(h * (MAX_DIMENSION / w));
          w = MAX_DIMENSION;
        } else {
          w = Math.round(w * (MAX_DIMENSION / h));
          h = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(null); return; }

      // White background prevents transparent areas from going black → JPEG
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(null); return; }
          resolve({ blob, width: w, height: h });
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      resolve(null);
    };

    img.src = blobUrl;
  });
}
