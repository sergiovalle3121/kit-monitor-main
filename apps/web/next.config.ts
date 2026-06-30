import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl SIN routing por segmento: el idioma se resuelve desde la cookie en
// `src/i18n/request.ts`. El plugin sólo enlaza ese archivo de configuración.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    // lucide-react se importa en ~219 archivos y recharts en varios módulos:
    // optimizePackageImports hace tree-shaking de los imports nombrados → bundles
    // por ruta más chicos sin tocar el código de las pantallas.
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
};

export default withNextIntl(nextConfig);
