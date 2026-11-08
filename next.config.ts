import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // İkinci bir geliştirme sunucusu (ör. testler için başka port) aynı .next klasörünü paylaşırsa
  // çalışan sunucunun derlemesi bozulur; NEXT_DIST_DIR ile ayrı klasör verilir.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
