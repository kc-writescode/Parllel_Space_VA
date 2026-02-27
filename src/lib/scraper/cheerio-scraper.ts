import * as cheerio from "cheerio";

export async function scrapeWebsiteText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Remove non-content elements
  $("script, style, nav, footer, header, iframe, noscript, svg, img").remove();
  $('[role="navigation"]').remove();
  $('[class*="nav"], [class*="footer"], [class*="header"], [class*="cookie"]').remove();

  // Try to find menu-specific content first
  const menuSelectors = [
    '[class*="menu"]',
    '[id*="menu"]',
    '[class*="food"]',
    '[class*="dish"]',
    '[class*="item"]',
    "main",
    "article",
    ".content",
    "#content",
  ];

  let text = "";

  for (const selector of menuSelectors) {
    const el = $(selector);
    if (el.length && el.text().trim().length > 100) {
      text = el.text();
      break;
    }
  }

  // Fallback to body text
  if (!text) {
    text = $("body").text();
  }

  // Clean up whitespace
  return text
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim()
    .slice(0, 15000); // Limit to ~15k chars for LLM context
}
