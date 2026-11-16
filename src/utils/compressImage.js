// src/utils/compressImage.js
//
// Kecilkan foto produk di browser sebelum diunggah. Foto dari kamera HP biasanya
// 3–10 MB; untuk kartu menu cukup ±1200px. Hasil: WebP (fallback JPEG).

const MAX_SIDE = 1200;
const QUALITY = 0.85;
export const MAX_INPUT_BYTES = 15 * 1024 * 1024; // tolak file > 15 MB sebelum diproses

function canvasToBlob(canvas, type) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

/**
 * @param {File} file
 * @returns {Promise<{ blob: Blob, ext: string }>}
 */
export async function compressImage(file) {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    throw new Error("File harus berupa foto (JPG, PNG, atau WebP)");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("Ukuran foto maksimal 15 MB");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  const webp = await canvasToBlob(canvas, "image/webp");
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
  const jpeg = await canvasToBlob(canvas, "image/jpeg");
  return { blob: jpeg, ext: "jpg" };
}
