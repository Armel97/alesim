import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { LEGAL_DOCS } from "@/lib/legal-content";

const BASE_URL = "https://alesimspeak.dev";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        // Uniquement les pages publiques indexables (les espaces authentifiés
        // et les vues contenant des données personnelles sont exclus).
        const legal: SitemapEntry[] = (
          [
            ["/legal/confidentialite", LEGAL_DOCS.confidentialite],
            ["/legal/rgpd", LEGAL_DOCS.rgpd],
            ["/legal/cgu", LEGAL_DOCS.cgu],
            ["/legal/cookies", LEGAL_DOCS.cookies],
            ["/legal/mentions-legales", LEGAL_DOCS["mentions-legales"]],
          ] as const
        ).map(([path, doc]) => ({
          path,
          lastmod: doc.updatedAt,
          changefreq: "yearly" as const,
          priority: "0.4",
        }));

        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/practice", changefreq: "weekly", priority: "0.8" },
          {
            path: "/legal",
            lastmod: legal
              .map((e) => e.lastmod!)
              .sort()
              .at(-1),
            changefreq: "yearly",
            priority: "0.4",
          },
          ...legal,
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
