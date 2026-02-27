export interface ExtractedMenu {
  categories: {
    name: string;
    items: {
      name: string;
      description: string;
      price: number;
      modifiers?: {
        group_name: string;
        required: boolean;
        options: {
          name: string;
          price_adjustment: number;
        }[];
      }[];
    }[];
  }[];
}

/**
 * Heuristic menu extractor — no AI API needed.
 *
 * Scans text for lines containing prices ($X.XX) and groups them
 * into categories based on heading-like patterns.
 */
export async function extractMenuFromText(
  websiteText: string
): Promise<ExtractedMenu> {
  const lines = websiteText
    .replace(/\r\n/g, "\n")
    .replace(/\s{2,}/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const categories: ExtractedMenu["categories"] = [];
  let currentCategory: ExtractedMenu["categories"][0] = {
    name: "Menu",
    items: [],
  };

  // Price patterns: $12.99, $12, 12.99, etc.
  const priceRegex = /\$\s?(\d{1,4}(?:\.\d{1,2})?)/;
  // Range price: $12 - $15 or $12-$15
  const rangePriceRegex =
    /\$\s?(\d{1,4}(?:\.\d{1,2})?)\s*[-–—]\s*\$?\s?(\d{1,4}(?:\.\d{1,2})?)/;

  // Heuristic: a line is a "category heading" if it's short, has no price,
  // and is followed by lines with prices
  function looksLikeCategory(line: string, idx: number): boolean {
    if (priceRegex.test(line)) return false;
    if (line.length > 60 || line.length < 2) return false;

    // Common category keywords
    const categoryWords =
      /\b(appetizer|starter|entre|entree|main|salad|soup|sandwich|burger|pizza|pasta|seafood|dessert|drink|beverage|side|breakfast|lunch|dinner|special|combo|kid|plate|taco|sushi|roll|noodle|rice|curry|grill|fried|baked|wings|wrap|bowl|platter|brunch|happy hour|shareables?|small plates?)\b/i;
    if (categoryWords.test(line)) return true;

    // ALL CAPS short line (common for menu category headers)
    if (line === line.toUpperCase() && line.length >= 3 && line.length <= 40)
      return true;

    // Check if following lines have prices (look ahead up to 5 lines)
    let priceCount = 0;
    for (let j = idx + 1; j < Math.min(idx + 6, lines.length); j++) {
      if (priceRegex.test(lines[j])) priceCount++;
    }
    if (priceCount >= 2) return true;

    return false;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this is a category heading
    if (looksLikeCategory(line, i)) {
      // Save current category if it has items
      if (currentCategory.items.length > 0) {
        categories.push(currentCategory);
      }
      currentCategory = {
        name: toTitleCase(line.replace(/[:\-–—]+$/, "").trim()),
        items: [],
      };
      continue;
    }

    // Try to extract a menu item with price
    const rangeMatch = line.match(rangePriceRegex);
    const priceMatch = line.match(priceRegex);

    if (priceMatch) {
      const price = rangeMatch
        ? parseFloat(rangeMatch[1])
        : parseFloat(priceMatch[1]);

      // Extract item name — everything before the price
      const priceIndex = line.indexOf(priceMatch[0]);
      let itemName = line.slice(0, priceIndex).trim();

      // Clean up common separators at end of name
      itemName = itemName.replace(/[.\-–—:,•·]+$/, "").trim();

      // Skip if name is too short or looks like a non-menu item
      if (itemName.length < 2 || price <= 0) continue;
      if (/\b(tax|tip|gratuity|total|subtotal|delivery|fee|service)\b/i.test(itemName)) continue;

      // Check if next line is a description (no price, reasonable length)
      let description = "";
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (
          !priceRegex.test(nextLine) &&
          nextLine.length > 10 &&
          nextLine.length < 200 &&
          !looksLikeCategory(nextLine, i + 1)
        ) {
          description = nextLine;
          i++; // skip the description line
        }
      }

      currentCategory.items.push({
        name: cleanItemName(itemName),
        description: description.slice(0, 100),
        price,
      });
    }
  }

  // Push the last category
  if (currentCategory.items.length > 0) {
    categories.push(currentCategory);
  }

  // If we got items but all in one "Menu" category, try to keep as-is
  // If we got nothing, throw
  if (categories.length === 0 || categories.every((c) => c.items.length === 0)) {
    throw new Error(
      "Could not identify any menu items from the website content."
    );
  }

  // Deduplicate items by name within each category
  for (const cat of categories) {
    const seen = new Set<string>();
    cat.items = cat.items.filter((item) => {
      const key = item.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Remove empty categories
  return {
    categories: categories.filter((c) => c.items.length > 0),
  };
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/(?:^|\s)\w/g, (match) => match.toUpperCase());
}

function cleanItemName(name: string): string {
  // Remove leading numbers/bullets
  name = name.replace(/^[\d.)\-•·*#]+\s*/, "");
  // Remove trailing dots/dashes
  name = name.replace(/[.\-–—:,]+$/, "");
  // Title case if all caps
  if (name === name.toUpperCase() && name.length > 3) {
    name = toTitleCase(name);
  }
  return name.trim();
}
