import * as cheerio from "cheerio";

export async function parseUrl(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": "LearnForge/1.0" } });
  if (!res.ok) throw new Error(`Failed to fetch URL: ${url} (${res.status})`);
  const html = await res.text();
  const $ = cheerio.load(html);

  // Remove non-content elements
  $("script, style, nav, header, footer, aside, [role='navigation'], [role='banner']").remove();

  const text = $("body").text();
  return text.replace(/\s+/g, " ").trim();
}
