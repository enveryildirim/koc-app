import type { NextConfig } from "next";

/** Bütün yanıtlara eklenen güvenlik başlıkları. Sayfalar yalnızca kendi sitesinde çerçevelenebilir (önizleme / yazdırma). */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const nextConfig: NextConfig = {
  // İkinci bir geliştirme sunucusu (ör. testler için başka port) aynı .next klasörünü paylaşırsa
  // çalışan sunucunun derlemesi bozulur; NEXT_DIST_DIR ile ayrı klasör verilir.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Docker imajı için: yalnızca gereken dosyalarla çalışan sunucu (.next/standalone). Bkz. Dockerfile
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
