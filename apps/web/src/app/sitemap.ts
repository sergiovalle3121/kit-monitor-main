import type { MetadataRoute } from 'next';

const routes = ['/', '/login'];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.axos-os.com';
  const updatedAt = new Date('2026-06-27T00:00:00.000Z');

  return routes.map((route) => ({
    url: new URL(route, baseUrl).toString(),
    lastModified: updatedAt,
    changeFrequency: route === '/' ? 'monthly' : 'yearly',
    priority: route === '/' ? 1 : 0.4,
  }));
}
