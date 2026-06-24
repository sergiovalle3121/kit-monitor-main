import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // lucide-react se importa en ~219 archivos y recharts en varios módulos:
    // optimizePackageImports hace tree-shaking de los imports nombrados → bundles
    // por ruta más chicos sin tocar el código de las pantallas.
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
};

export default nextConfig;
