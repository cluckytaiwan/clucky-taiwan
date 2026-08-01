/**
 * src/utils/imageUrl.js
 * 
 * Helper untuk mendapatkan URL gambar yang sudah dioptimasi oleh Supabase Image Transformations.
 * Mengubah URL bucket Supabase publik menjadi URL teroptimasi (webp, resolusi lebih rendah).
 * 
 * Fitur ini membutuhkan Supabase Pro, namun secara default query params akan diabaikan 
 * oleh Supabase free tier dan akan mengembalikan gambar aslinya dengan aman tanpa error.
 */

export function getOptimizedImageUrl(url, { width = 400, quality = 80 } = {}) {
  if (!url) return url;
  
  // Hanya optimasi URL dari Supabase Storage milik kita
  if (!url.includes("supabase.co/storage/v1/object/public/")) {
    return url;
  }
  
  // Format Supabase Image Transformations:
  // /storage/v1/render/image/public/bucket/path
  const optimizedUrl = url.replace(
    "/storage/v1/object/public/", 
    "/storage/v1/render/image/public/"
  );
  
  return `${optimizedUrl}?width=${width}&quality=${quality}&format=webp`;
}
