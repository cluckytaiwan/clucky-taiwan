/**
 * src/utils/imageUrl.js
 * 
 * Helper untuk mendapatkan URL gambar yang sudah dioptimasi oleh Supabase Image Transformations.
 * Mengubah URL bucket Supabase publik menjadi URL teroptimasi (webp, resolusi lebih rendah).
 * 
 * Fitur ini membutuhkan Supabase Pro, namun secara default query params akan diabaikan 
 * oleh Supabase free tier dan akan mengembalikan gambar aslinya dengan aman tanpa error.
 */

export function getOptimizedImageUrl(url, { width = 400, height = width, quality = 80 } = {}) {
  // Menggunakan URL asli karena proyek saat ini belum mengaktifkan Supabase Image Transformations
  // yang sebelumnya menyebabkan gambar tidak terbuka (error dari path /render/image/).
  return url;
}
