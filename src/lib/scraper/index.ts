import { scrapeWebsiteText } from "./cheerio-scraper";
import { extractMenuFromText, type ExtractedMenu } from "./ai-extractor";

export type { ExtractedMenu };

export async function scrapeMenuFromUrl(url: string): Promise<ExtractedMenu> {
  const websiteText = await scrapeWebsiteText(url);

  if (websiteText.length < 50) {
    throw new Error(
      "Could not extract enough text from the website. The page may require JavaScript rendering."
    );
  }

  const menu = await extractMenuFromText(websiteText);

  if (!menu.categories?.length) {
    throw new Error("Could not identify any menu items from the website content.");
  }

  return menu;
}
