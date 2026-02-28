"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { ScrapeForm } from "@/components/menu/scrape-form";
import { MenuItemForm } from "@/components/menu/menu-item-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils/formatters";
import { Plus, Pencil, Trash2, FolderPlus, Search } from "lucide-react";
import { toast } from "sonner";
import type { ExtractedMenu } from "@/lib/scraper/ai-extractor";
import type { Database } from "@/types/database";

type MenuCategory = Database["public"]["Tables"]["menu_categories"]["Row"];
type MenuItem = Database["public"]["Tables"]["menu_items"]["Row"];

export default function MenuPage() {
  const { restaurant } = useRestaurant();
  const supabase = createClient();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [search, setSearch] = useState("");

  const fetchMenu = useCallback(async () => {
    if (!restaurant) return;

    const [catResult, itemResult] = await Promise.all([
      supabase
        .from("menu_categories")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("sort_order"),
      supabase
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("sort_order"),
    ]);

    setCategories(catResult.data || []);
    setItems(itemResult.data || []);
    setLoading(false);
  }, [restaurant, supabase]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  async function addCategory() {
    if (!restaurant || !newCategoryName.trim()) return;

    const { error } = await supabase.from("menu_categories").insert({
      restaurant_id: restaurant.id,
      name: newCategoryName.trim(),
      sort_order: categories.length,
    });

    if (error) {
      toast.error("Failed to add category");
      return;
    }

    setNewCategoryName("");
    setShowCategoryInput(false);
    fetchMenu();
    toast.success("Category added");
  }

  async function deleteCategory(id: string) {
    await supabase.from("menu_categories").delete().eq("id", id);
    fetchMenu();
    toast.success("Category deleted");
  }

  async function saveItem(data: {
    name: string;
    description: string;
    base_price: number;
    is_available: boolean;
    modifier_groups: { name: string; required: boolean; options: { name: string; price_adjustment: number }[] }[];
  }) {
    if (!restaurant || !selectedCategoryId) return;

    if (editingItem) {
      // Update existing
      await supabase
        .from("menu_items")
        .update({
          name: data.name,
          description: data.description,
          base_price: data.base_price,
          is_available: data.is_available,
        })
        .eq("id", editingItem.id);

      // Delete existing modifiers and recreate
      const { data: existingGroups } = await supabase
        .from("modifier_groups")
        .select("id")
        .eq("menu_item_id", editingItem.id);
      if (existingGroups) {
        for (const g of existingGroups) {
          await supabase.from("modifier_options").delete().eq("modifier_group_id", g.id);
        }
        await supabase.from("modifier_groups").delete().eq("menu_item_id", editingItem.id);
      }

      // Recreate modifier groups
      for (const mg of data.modifier_groups) {
        const { data: group } = await supabase
          .from("modifier_groups")
          .insert({
            menu_item_id: editingItem.id,
            restaurant_id: restaurant.id,
            name: mg.name,
            required: mg.required,
          })
          .select("id")
          .single();

        if (group) {
          await supabase.from("modifier_options").insert(
            mg.options.map((o, i) => ({
              modifier_group_id: group.id,
              name: o.name,
              price_adjustment: o.price_adjustment,
              sort_order: i,
            }))
          );
        }
      }
    } else {
      // Create new
      const { data: newItem } = await supabase
        .from("menu_items")
        .insert({
          category_id: selectedCategoryId,
          restaurant_id: restaurant.id,
          name: data.name,
          description: data.description,
          base_price: data.base_price,
          is_available: data.is_available,
          sort_order: items.filter((i) => i.category_id === selectedCategoryId).length,
        })
        .select("id")
        .single();

      if (newItem) {
        for (const mg of data.modifier_groups) {
          const { data: group } = await supabase
            .from("modifier_groups")
            .insert({
              menu_item_id: newItem.id,
              restaurant_id: restaurant.id,
              name: mg.name,
              required: mg.required,
            })
            .select("id")
            .single();

          if (group) {
            await supabase.from("modifier_options").insert(
              mg.options.map((o, i) => ({
                modifier_group_id: group.id,
                name: o.name,
                price_adjustment: o.price_adjustment,
                sort_order: i,
              }))
            );
          }
        }
      }
    }

    setEditingItem(null);
    fetchMenu();
    syncRetellAgent();
    toast.success(editingItem ? "Item updated" : "Item added");
  }

  async function deleteItem(id: string) {
    await supabase.from("menu_items").delete().eq("id", id);
    fetchMenu();
    syncRetellAgent();
    toast.success("Item deleted");
  }

  async function toggleItemAvailability(id: string, available: boolean) {
    await supabase.from("menu_items").update({ is_available: available }).eq("id", id);
    fetchMenu();
    syncRetellAgent();
  }

  async function syncRetellAgent() {
    if (!restaurant?.retell_llm_id) return;
    try {
      // Fetch latest menu via RPC (avoids server-side DB timeout)
      const { data: provisionData } = await supabase.rpc(
        "get_restaurant_for_provisioning",
        { p_restaurant_id: restaurant.id }
      );
      if (!provisionData) return;

      // Fire-and-forget — non-blocking, only external Retell API call
      fetch("/api/restaurants/sync-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant: { ...provisionData.restaurant, retell_llm_id: restaurant.retell_llm_id },
          menu: provisionData.menu || [],
        }),
      }).catch(() => {/* best-effort */});
    } catch {
      // Non-critical
    }
  }

  async function handleMenuExtracted(menu: ExtractedMenu) {
    if (!restaurant) return;

    // Save all extracted categories and items
    for (const cat of menu.categories) {
      const { data: category } = await supabase
        .from("menu_categories")
        .insert({
          restaurant_id: restaurant.id,
          name: cat.name,
          sort_order: categories.length + menu.categories.indexOf(cat),
        })
        .select("id")
        .single();

      if (!category) continue;

      for (const item of cat.items) {
        const { data: menuItem } = await supabase
          .from("menu_items")
          .insert({
            category_id: category.id,
            restaurant_id: restaurant.id,
            name: item.name,
            description: item.description,
            base_price: item.price,
            sort_order: cat.items.indexOf(item),
          })
          .select("id")
          .single();

        if (menuItem && item.modifiers) {
          for (const mod of item.modifiers) {
            const { data: group } = await supabase
              .from("modifier_groups")
              .insert({
                menu_item_id: menuItem.id,
                restaurant_id: restaurant.id,
                name: mod.group_name,
                required: mod.required,
              })
              .select("id")
              .single();

            if (group) {
              await supabase.from("modifier_options").insert(
                mod.options.map((o, i) => ({
                  modifier_group_id: group.id,
                  name: o.name,
                  price_adjustment: o.price_adjustment,
                  sort_order: i,
                }))
              );
            }
          }
        }
      }
    }

    fetchMenu();
    syncRetellAgent();
    toast.success(`Imported ${menu.categories.length} categories from website`);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Loading menu...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Menu</h1>
      </div>

      <ScrapeForm onMenuExtracted={handleMenuExtracted} />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <Input
          placeholder="Search menu items…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Add Category */}
      <div className="flex items-center gap-3">
        {showCategoryInput ? (
          <>
            <Input
              placeholder="Category name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
              className="max-w-xs"
              autoFocus
            />
            <Button size="sm" onClick={addCategory}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCategoryInput(false)}>Cancel</Button>
          </>
        ) : (
          <Button variant="outline" onClick={() => setShowCategoryInput(true)}>
            <FolderPlus className="h-4 w-4 mr-2" /> Add Category
          </Button>
        )}
      </div>

      {/* Categories & Items */}
      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No menu items yet. Scan your website or add items manually.
          </CardContent>
        </Card>
      ) : (
        categories.map((cat) => {
            const q = search.trim().toLowerCase();
          const catItems = items
            .filter((i) => i.category_id === cat.id)
            .filter((i) => !q || i.name.toLowerCase().includes(q) || (i.description ?? "").toLowerCase().includes(q));
          return (
            <Card key={cat.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-lg">{cat.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedCategoryId(cat.id);
                      setEditingItem(null);
                      setShowItemForm(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add Item
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteCategory(cat.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {catItems.length === 0 ? (
                  <p className="text-sm text-gray-400">No items in this category</p>
                ) : (
                  <div className="space-y-2">
                    {catItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.name}</span>
                            <span className="text-sm text-gray-600">
                              {formatCurrency(item.base_price)}
                            </span>
                            {!item.is_available && (
                              <Badge variant="secondary" className="text-xs">Unavailable</Badge>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-sm text-gray-500 mt-0.5">{item.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={item.is_available}
                            onCheckedChange={(v) => toggleItemAvailability(item.id, v)}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedCategoryId(cat.id);
                              setEditingItem(item);
                              setShowItemForm(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Item Form Dialog */}
      <MenuItemForm
        open={showItemForm}
        onClose={() => {
          setShowItemForm(false);
          setEditingItem(null);
        }}
        onSave={saveItem}
        initialData={
          editingItem
            ? {
                name: editingItem.name,
                description: editingItem.description || "",
                base_price: editingItem.base_price,
                is_available: editingItem.is_available,
              }
            : undefined
        }
        title={editingItem ? "Edit Item" : "Add Item"}
      />
    </div>
  );
}
