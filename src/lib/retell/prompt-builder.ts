import { formatBusinessHours } from "@/lib/utils/formatters";

interface MenuItem {
  name: string;
  description: string | null;
  base_price: number;
  modifier_groups?: {
    name: string;
    required: boolean;
    options: {
      name: string;
      price_adjustment: number;
    }[];
  }[];
}

interface MenuCategory {
  name: string;
  items: MenuItem[];
}

interface RestaurantInfo {
  name: string;
  address: string | null;
  business_hours: Record<string, { open: string; close: string }>;
  delivery_enabled: boolean;
  delivery_fee: number;
  delivery_radius_miles: number | null;
  tax_rate: number;
  pickup_wait_minutes: number;
  delivery_wait_minutes: number;
}

export function buildSystemPrompt(
  restaurant: RestaurantInfo,
  menu: MenuCategory[]
): string {
  const menuText = formatMenuForPrompt(menu);

  return `You are a friendly and efficient phone ordering assistant for ${restaurant.name}.
Your job is to help callers place food orders for pickup or delivery.

## RESTAURANT INFO
- Name: ${restaurant.name}
- Address: ${restaurant.address || "Not provided"}
- Business Hours:
${formatBusinessHours(restaurant.business_hours)}
- Delivery Available: ${restaurant.delivery_enabled ? "Yes" : "No"}
${restaurant.delivery_enabled ? `- Delivery Fee: $${restaurant.delivery_fee.toFixed(2)}` : ""}
${restaurant.delivery_enabled && restaurant.delivery_radius_miles ? `- Delivery Radius: ${restaurant.delivery_radius_miles} miles` : ""}
- Tax Rate: ${(restaurant.tax_rate * 100).toFixed(2)}%

## MENU
${menuText}

## CONVERSATION FLOW
1. Greet the caller warmly. Ask if they'd like pickup or delivery.
2. If delivery, collect the delivery address.
3. Help them browse the menu. Suggest popular items if they're unsure.
4. For each item, ask about any required modifiers (e.g., size, preparation style).
5. After they're done ordering, use the get_order_summary tool and read back the full order with prices.
6. Confirm the order total (subtotal + tax + delivery fee if applicable).
7. Ask for their name and confirm the phone number.
8. Let them know they can pay when they pick up the order (or upon delivery if delivery order).
9. Thank them and give an estimated wait time (${restaurant.pickup_wait_minutes}-${restaurant.pickup_wait_minutes + 5} min for pickup, ${restaurant.delivery_wait_minutes}-${restaurant.delivery_wait_minutes + 10} for delivery).

## RULES
- Only offer items on the menu. If they ask for something unavailable, politely say so and suggest alternatives.
- Always confirm required modifiers for items that have them.
- Be conversational but efficient. Don't ramble.
- If asked about allergens or ingredients you're unsure about, suggest they call the restaurant directly.
- You can only take orders — not process complaints, reservations, or other requests.
- Speak prices clearly (e.g., "twelve fifty" for $12.50).
- If the caller changes their mind, update the order using the tools.
- Always use add_to_order when the customer confirms an item.
- Always use get_order_summary before reading back the final order.`;
}

function formatMenuForPrompt(menu: MenuCategory[]): string {
  return menu
    .map((cat) => {
      const items = cat.items
        .map((item) => {
          let line = `  - ${item.name}: $${item.base_price.toFixed(2)}`;
          if (item.description) line += ` — ${item.description}`;
          if (item.modifier_groups?.length) {
            line +=
              "\n" +
              item.modifier_groups
                .map((mg) => {
                  const opts = mg.options
                    .map(
                      (o) =>
                        `${o.name}${o.price_adjustment > 0 ? ` (+$${o.price_adjustment.toFixed(2)})` : ""}`
                    )
                    .join(", ");
                  return `    ${mg.required ? "[REQUIRED]" : "[OPTIONAL]"} ${mg.name}: ${opts}`;
                })
                .join("\n");
          }
          return line;
        })
        .join("\n");
      return `### ${cat.name}\n${items}`;
    })
    .join("\n\n");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getMenuForPrompt(
  supabaseAdmin: any,
  restaurantId: string
): Promise<MenuCategory[]> {
  const { data: categories } = await supabaseAdmin
    .from("menu_categories")
    .select("id, name")
    .eq("restaurant_id", restaurantId)
    .eq("is_available", true)
    .order("sort_order");

  if (!categories?.length) return [];

  const { data: items } = await supabaseAdmin
    .from("menu_items")
    .select("id, name, description, base_price, category_id")
    .eq("restaurant_id", restaurantId)
    .eq("is_available", true)
    .order("sort_order");

  const { data: modifierGroups } = await supabaseAdmin
    .from("modifier_groups")
    .select("id, name, required, menu_item_id")
    .eq("restaurant_id", restaurantId)
    .order("sort_order");

  const { data: modifierOptions } = await supabaseAdmin
    .from("modifier_options")
    .select("id, name, price_adjustment, modifier_group_id")
    .order("sort_order");

  // Build modifier map
  interface ModOption { id: string; name: string; price_adjustment: number; modifier_group_id: string }
  interface ModGroup { id: string; name: string; required: boolean; menu_item_id: string }

  const optionsByGroup = new Map<string, ModOption[]>();
  (modifierOptions as ModOption[] | null)?.forEach((opt: ModOption) => {
    const list = optionsByGroup.get(opt.modifier_group_id) || [];
    list.push(opt);
    optionsByGroup.set(opt.modifier_group_id, list);
  });

  const groupsByItem = new Map<string, ModGroup[]>();
  (modifierGroups as ModGroup[] | null)?.forEach((mg: ModGroup) => {
    const list = groupsByItem.get(mg.menu_item_id) || [];
    list.push(mg);
    groupsByItem.set(mg.menu_item_id, list);
  });

  interface Cat { id: string; name: string }
  interface Item { id: string; name: string; description: string | null; base_price: number; category_id: string }

  return (categories as Cat[]).map((cat: Cat) => ({
    name: cat.name,
    items: ((items as Item[] | null)?.filter((i: Item) => i.category_id === cat.id) || []).map((item: Item) => ({
      name: item.name,
      description: item.description,
      base_price: item.base_price,
      modifier_groups: (groupsByItem.get(item.id) || []).map((mg: ModGroup) => ({
        name: mg.name,
        required: mg.required,
        options: (optionsByGroup.get(mg.id) || []).map((o: ModOption) => ({
          name: o.name,
          price_adjustment: o.price_adjustment,
        })),
      })),
    })),
  }));
}
