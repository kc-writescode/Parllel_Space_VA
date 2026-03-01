import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchCloverMenu } from "@/lib/clover/clover";
import { updateAgentPrompt, getOrderingTools } from "@/lib/retell/client";
import { buildSystemPrompt, getMenuForPrompt } from "@/lib/retell/prompt-builder";

/**
 * POST /api/clover/sync
 *
 * Fetches the menu from Clover, replaces the restaurant's current menu in
 * Supabase, then re-syncs the Retell AI agent prompt.
 */
export async function POST(req: NextRequest) {
    try {
        // Auth check
        const serverClient = await createClient();
        const {
            data: { session },
        } = await serverClient.auth.getSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const { restaurantId } = await req.json();
        if (!restaurantId) {
            return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });
        }

        const supabase = createAdminClient();

        // Get restaurant with Clover credentials
        const { data: restaurant } = await supabase
            .from("restaurants")
            .select("*")
            .eq("id", restaurantId)
            .single();

        if (!restaurant) {
            return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
        }
        if (!restaurant.clover_merchant_id || !restaurant.clover_access_token) {
            return NextResponse.json({ error: "Clover not connected" }, { status: 400 });
        }

        // 1. Fetch menu from Clover
        const cloverMenu = await fetchCloverMenu(
            restaurant.clover_merchant_id,
            restaurant.clover_access_token
        );

        // 2. Clear existing menu for this restaurant
        // (cascading deletes handle items → modifier_groups → modifier_options)
        await supabase
            .from("menu_categories")
            .delete()
            .eq("restaurant_id", restaurantId);

        // 3. Insert new categories + items + modifiers from Clover
        let catOrder = 0;

        // Helper to insert a list of items into a category
        async function insertItems(
            categoryId: string,
            items: typeof cloverMenu.categories[0]["items"]
        ) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const { data: menuItem } = await supabase
                    .from("menu_items")
                    .insert({
                        category_id: categoryId,
                        restaurant_id: restaurantId,
                        name: item.name,
                        description: item.description,
                        base_price: item.price,
                        is_available: item.available,
                        sort_order: i,
                    })
                    .select("id")
                    .single();

                if (menuItem && item.modifierGroups.length > 0) {
                    for (let g = 0; g < item.modifierGroups.length; g++) {
                        const mg = item.modifierGroups[g];
                        const { data: group } = await supabase
                            .from("modifier_groups")
                            .insert({
                                menu_item_id: menuItem.id,
                                restaurant_id: restaurantId,
                                name: mg.name,
                                required: mg.required,
                                sort_order: g,
                            })
                            .select("id")
                            .single();

                        if (group && mg.options.length > 0) {
                            await supabase.from("modifier_options").insert(
                                mg.options.map((o, idx) => ({
                                    modifier_group_id: group.id,
                                    name: o.name,
                                    price_adjustment: o.priceAdjustment,
                                    sort_order: idx,
                                }))
                            );
                        }
                    }
                }
            }
        }

        // Insert categorized items
        for (const cat of cloverMenu.categories) {
            const { data: category } = await supabase
                .from("menu_categories")
                .insert({
                    restaurant_id: restaurantId,
                    name: cat.name,
                    sort_order: catOrder++,
                })
                .select("id")
                .single();

            if (category) {
                await insertItems(category.id, cat.items);
            }
        }

        // Insert uncategorized items under "Other"
        if (cloverMenu.uncategorizedItems.length > 0) {
            const { data: otherCat } = await supabase
                .from("menu_categories")
                .insert({
                    restaurant_id: restaurantId,
                    name: "Other",
                    sort_order: catOrder++,
                })
                .select("id")
                .single();

            if (otherCat) {
                await insertItems(otherCat.id, cloverMenu.uncategorizedItems);
            }
        }

        // 4. Update sync timestamp
        await supabase
            .from("restaurants")
            .update({
                clover_last_synced_at: new Date().toISOString(),
                menu_sync_source: "clover",
            })
            .eq("id", restaurantId);

        // 5. Re-sync Retell agent with new menu
        if (restaurant.retell_llm_id) {
            const menu = await getMenuForPrompt(supabase, restaurantId);
            const systemPrompt = buildSystemPrompt(
                {
                    name: restaurant.name,
                    address: restaurant.address,
                    business_hours: (restaurant.business_hours || {}) as Record<
                        string,
                        { open: string; close: string }
                    >,
                    delivery_enabled: restaurant.delivery_enabled,
                    delivery_fee: restaurant.delivery_fee,
                    delivery_radius_miles: restaurant.delivery_radius_miles,
                    tax_rate: restaurant.tax_rate,
                    pickup_wait_minutes: restaurant.pickup_wait_minutes ?? 15,
                    delivery_wait_minutes: restaurant.delivery_wait_minutes ?? 35,
                },
                menu
            );
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            await updateAgentPrompt(restaurant.retell_llm_id, systemPrompt, getOrderingTools(appUrl));
        }

        const totalItems =
            cloverMenu.categories.reduce((sum, c) => sum + c.items.length, 0) +
            cloverMenu.uncategorizedItems.length;

        return NextResponse.json({
            synced: true,
            categories: cloverMenu.categories.length + (cloverMenu.uncategorizedItems.length > 0 ? 1 : 0),
            items: totalItems,
        });
    } catch (error) {
        console.error("Clover sync error:", error);
        const message = error instanceof Error ? error.message : "Sync failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
