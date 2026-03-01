/**
 * Clover POS API client for menu/inventory sync.
 *
 * Clover environments:
 *   Sandbox: https://sandbox.dev.clover.com
 *   Production (US/Canada): https://api.clover.com
 */

const CLOVER_BASE =
    process.env.CLOVER_ENVIRONMENT === "sandbox"
        ? "https://sandbox.dev.clover.com"
        : "https://api.clover.com";

const CLOVER_AUTH_BASE =
    process.env.CLOVER_ENVIRONMENT === "sandbox"
        ? "https://sandbox.dev.clover.com"
        : "https://www.clover.com";

// ── OAuth helpers ──

export function getCloverAuthUrl(restaurantId: string): string {
    const clientId = process.env.CLOVER_APP_ID!;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/clover/callback`;
    return (
        `${CLOVER_AUTH_BASE}/oauth/v2/authorize` +
        `?client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&state=${restaurantId}` +
        `&response_type=code`
    );
}

export async function exchangeCloverCode(code: string): Promise<{
    accessToken: string;
    merchantId: string;
}> {
    const res = await fetch(`${CLOVER_AUTH_BASE}/oauth/v2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: process.env.CLOVER_APP_ID!,
            client_secret: process.env.CLOVER_APP_SECRET!,
            code,
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Clover token exchange failed: ${text}`);
    }

    const data = await res.json();
    return {
        accessToken: data.access_token,
        merchantId: data.merchant_id,
    };
}

// ── Menu fetch ──

interface CloverCategory {
    id: string;
    name: string;
    sortOrder?: number;
}

interface CloverModifier {
    id: string;
    name: string;
    price?: number; // in cents
}

interface CloverModifierGroup {
    id: string;
    name: string;
    modifiers?: { elements?: CloverModifier[] };
    minRequired?: number;
    maxAllowed?: number;
}

interface CloverItem {
    id: string;
    name: string;
    price: number; // in cents
    priceType?: string;
    available?: boolean;
    description?: string;
    categories?: { elements?: CloverCategory[] };
    modifierGroups?: { elements?: CloverModifierGroup[] };
}

export interface CloverMenuResult {
    categories: {
        name: string;
        sortOrder: number;
        items: {
            name: string;
            description: string | null;
            price: number; // in dollars
            available: boolean;
            modifierGroups: {
                name: string;
                required: boolean;
                options: { name: string; priceAdjustment: number }[];
            }[];
        }[];
    }[];
    uncategorizedItems: {
        name: string;
        description: string | null;
        price: number;
        available: boolean;
        modifierGroups: {
            name: string;
            required: boolean;
            options: { name: string; priceAdjustment: number }[];
        }[];
    }[];
}

export async function fetchCloverMenu(
    merchantId: string,
    accessToken: string
): Promise<CloverMenuResult> {
    const headers = { Authorization: `Bearer ${accessToken}` };

    // Fetch items with expanded categories and modifierGroups
    const itemsRes = await fetch(
        `${CLOVER_BASE}/v3/merchants/${merchantId}/items` +
        `?expand=categories,modifierGroups.modifiers` +
        `&filter=deleted=false` +
        `&limit=500`,
        { headers }
    );

    if (!itemsRes.ok) {
        throw new Error(`Clover items fetch failed: ${itemsRes.status}`);
    }

    const itemsData = await itemsRes.json();
    const cloverItems: CloverItem[] = itemsData.elements || [];

    // Fetch categories for ordering
    const catsRes = await fetch(
        `${CLOVER_BASE}/v3/merchants/${merchantId}/categories?limit=200`,
        { headers }
    );
    const catsData = await catsRes.json();
    const cloverCategories: CloverCategory[] = catsData.elements || [];

    // Build category map
    const categoryMap = new Map<
        string,
        CloverMenuResult["categories"][0]
    >();

    for (const cat of cloverCategories) {
        categoryMap.set(cat.id, {
            name: cat.name,
            sortOrder: cat.sortOrder ?? 0,
            items: [],
        });
    }

    const uncategorizedItems: CloverMenuResult["uncategorizedItems"] = [];

    for (const item of cloverItems) {
        const mappedItem = {
            name: item.name,
            description: item.description || null,
            price: item.price / 100, // cents → dollars
            available: item.available !== false,
            modifierGroups: (item.modifierGroups?.elements || []).map((mg) => ({
                name: mg.name,
                required: (mg.minRequired ?? 0) > 0,
                options: (mg.modifiers?.elements || []).map((mod) => ({
                    name: mod.name,
                    priceAdjustment: (mod.price || 0) / 100, // cents → dollars
                })),
            })),
        };

        const itemCats = item.categories?.elements || [];
        if (itemCats.length > 0) {
            // Add to first category (primary)
            const cat = categoryMap.get(itemCats[0].id);
            if (cat) {
                cat.items.push(mappedItem);
            } else {
                uncategorizedItems.push(mappedItem);
            }
        } else {
            uncategorizedItems.push(mappedItem);
        }
    }

    // Sort categories by sortOrder
    const categories = Array.from(categoryMap.values()).sort(
        (a, b) => a.sortOrder - b.sortOrder
    );

    return { categories, uncategorizedItems };
}
