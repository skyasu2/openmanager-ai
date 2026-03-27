/**
 * 🗺️ Dynamic Sitemap Generator
 *
 * Next.js 자동 sitemap.xml 생성
 * /sitemap.xml 경로에서 자동 제공
 */

import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site-url';

const SITE_URL = getSiteUrl();

export default function sitemap(): MetadataRoute.Sitemap {
  const currentDate = new Date().toISOString();

  return [
    {
      url: SITE_URL,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/main`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    // 참고: /dashboard, /login 등은 robots.txt에서 Disallow로 차단됨
    // SEO가 필요한 공개 페이지만 포함
  ];
}
