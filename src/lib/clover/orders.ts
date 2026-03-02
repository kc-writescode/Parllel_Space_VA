/**
 * Clover Orders API client — push orders to Clover POS.
 *
 * Uses the Atomic Order endpoint to create a complete order
 * (with line items and modifiers) in a single API call.
 *
 * Endpoint: POST /v3/merchants/{mId}/atomic_order/orders
 *
 * Clover environments:
 *   Sandbox: https://apisandbox.dev.clover.com
 *   Production (US/Canada): https://api.clover.com
 */

const CLOVER_API_BASE =
    process.env.CLOVER_ENVIRONMENT === "sandbox"
        ? "https://apisandbox.dev.clover.com"
        : "https://api.clover.com";

// ── Types ──

interface CloverLineItem {
    /** Clover inventory item ID — if set, Clover uses the inventory item's price/tax */
    item?: { id: string };
    /** Name (used for custom/ad-hoc line items without a Clover inventory ID) */
    name?: string;
    /** Price in cents (required for custom line items) */
    price?: number;
    /** Note/special instructions for this line item */
    note?: string;
    /** Modifiers applied to this line item */
    modifications?: { modifier: { id: string } }[];
}

interface CloverAtomicOrderRequest {
    orderCart: {
        lineItems: CloverLineItem[];
        orderType?: { id: string };
        note?: string;
    };
}

interface CloverAtomicOrderResponse {
    id: string;
    state: string;
    total: number;
    lineItems?: { elements?: { id: string; name: string; price: number }[] };
}

// ── Public API ──

export interface OrderItemForClover {
    /** Clover inventory item ID (from menu_items.clover_item_id) */
    cloverItemId: string | null;
    /** Item name (fallback for custom line items) */
    name: string;
    /** Quantity */
    quantity: number;
    /** Unit price in dollars */
    unitPrice: number;
    /** Special instructions */
    specialInstructions?: string | null;
    /** Modifier Clover IDs to apply */
    cloverModifierIds?: string[];
}

export interface CreateCloverOrderParams {
    merchantId: string;
    accessToken: string;
    items: OrderItemForClover[];
    orderNote?: string;
}

/**
 * Creates an order on Clover POS using the atomic order endpoint.
 *
 * Items with a `cloverItemId` are added as inventory references.
 * Items without one are added as custom/ad-hoc line items with name + price.
 *
 * Returns the Clover order ID on success, or null if the request fails.
 */
export async function createCloverOrder(
    params: CreateCloverOrderParams
): Promise<string | null> {
    const { merchantId, accessToken, items, orderNote } = params;

    // Build line items — expand quantity into individual Clover line items
    // (Clover doesn't have a quantity field; each line item = 1 unit)
    const lineItems: CloverLineItem[] = [];

    for (const item of items) {
        for (let i = 0; i < item.quantity; i++) {
            const lineItem: CloverLineItem = {};

            if (item.cloverItemId) {
                // Reference existing Clover inventory item
                lineItem.item = { id: item.cloverItemId };
            } else {
                // Custom/ad-hoc line item
                lineItem.name = item.name;
                lineItem.price = Math.round(item.unitPrice * 100); // dollars → cents
            }

            if (item.specialInstructions) {
                lineItem.note = item.specialInstructions;
            }

            // Add modifiers if available
            if (item.cloverModifierIds?.length) {
                lineItem.modifications = item.cloverModifierIds.map((modId) => ({
                    modifier: { id: modId },
                }));
            }

            lineItems.push(lineItem);
        }
    }

    if (lineItems.length === 0) {
        console.warn("No line items to push to Clover");
        return null;
    }

    const body: CloverAtomicOrderRequest = {
        orderCart: {
            lineItems,
            ...(orderNote ? { note: orderNote } : {}),
        },
    };

    try {
        const res = await fetch(
            `${CLOVER_API_BASE}/v3/merchants/${merchantId}/atomic_order/orders`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify(body),
            }
        );

        if (!res.ok) {
            const errorText = await res.text();
            console.error(
                `Clover order creation failed (${res.status}):`,
                errorText
            );
            return null;
        }

        const data: CloverAtomicOrderResponse = await res.json();
        console.log(`Clover order created: ${data.id}`);
        return data.id;
    } catch (error) {
        console.error("Clover order creation error:", error);
        return null;
    }
}
