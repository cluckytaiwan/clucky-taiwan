import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/**
 * URL situs untuk meta tag, robots.txt, dan sitemap.xml.
 * Urutan: VITE_SITE_URL (manual) → domain production Vercel (otomatis saat build
 * di Vercel) → kosong (build lokal: tag memakai path relatif, sitemap dilewati).
 */
function resolveSiteUrl(env) {
  const manual = env.VITE_SITE_URL || process.env.VITE_SITE_URL;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const raw = manual || (vercel ? `https://${vercel}` : "");
  return raw.replace(/\/$/, "");
}

/** Ambil id produk aktif untuk sitemap. Gagal/lambat → sitemap hanya berisi beranda. */
async function fetchProductIds(env) {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];
  try {
    const res = await fetch(`${url}/rest/v1/produk?select=id&aktif=eq.true`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    return (await res.json()).map((p) => p.id);
  } catch {
    return [];
  }
}

function seoPlugin(env) {
  const site = resolveSiteUrl(env);
  return {
    name: "clucky-seo",
    // __SITE_URL__ di index.html → URL situs (atau kosong)
    transformIndexHtml: (html) => html.replaceAll("__SITE_URL__", site),
    async generateBundle() {
      const lines = [
        "User-agent: *",
        "Disallow: /admin",
        "Disallow: /checkout",
        "Disallow: /cek-pesanan",
        "Allow: /",
      ];
      if (site) lines.push("", `Sitemap: ${site}/sitemap.xml`);
      this.emitFile({ type: "asset", fileName: "robots.txt", source: lines.join("\n") + "\n" });

      if (site) {
        const ids = await fetchProductIds(env);
        const urls = [`${site}/`, ...ids.map((id) => `${site}/produk/${id}`)];
        const xml =
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n") +
          `\n</urlset>\n`;
        this.emitFile({ type: "asset", fileName: "sitemap.xml", source: xml });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), seoPlugin(env)],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            "react-vendor": ["react", "react-dom", "react-router-dom"],
            "supabase": ["@supabase/supabase-js"],
            "ui-vendor": ["lucide-react", "vaul", "zustand"],
          },
        },
      },
    },
  };
});
