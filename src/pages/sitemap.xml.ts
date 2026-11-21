import type { APIRoute } from 'astro';

const SITE_URL = 'https://audio-joiner.pages.dev';

const PAGES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/how-to-use', changefreq: 'monthly', priority: '0.8' },
  { path: '/hire-me', changefreq: 'monthly', priority: '0.7' },
];

export const GET: APIRoute = () => {
  const lastmod = new Date().toISOString().split('T')[0];

  const urls = PAGES.map(
    (page) => `  <url>
    <loc>${SITE_URL}${page.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  ).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
