"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, GripVertical } from "lucide-react";

interface ModifierOption {
  id?: string;
  name: string;
  price_adjustment: number;
}

interface ModifierGroup {
  id?: string;
  name: string;
  required: boolean;
  min_selections: number;
  max_selections: number;
  options: ModifierOption[];
}

export default function MenuItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.itemId as string;
  const isNew = itemId === "new";
  const { restaurant } = useRestaurant();
  const supabase = createClient();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [available, setAvailable] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);

  const fetchItem = useCallback(async () => {
    if (isNew || !restaurant) return;

    const { data: item } = await supabase
      .from("menu_items")
      .select("*")
      .eq("id", itemId)
      .single();

    if (!item) {
      toast.error("Menu item not found");
      router.push("/menu");
      return;
    }

    setName(item.name);
    setDescription(item.description || "");
    setBasePrice(item.base_price?.toString() || "");
    setCategoryId(item.category_id);
    setAvailable(item.is_available);

    // Fetch modifier groups + options
    const { data: groups } = await supabase
      .from("modifier_groups")
      .select("*, modifier_options(*)")
      .eq("menu_item_id", itemId)
      .order("sort_order", { ascending: true });

    if (groups) {
      setModifierGroups(
        groups.map((g: any) => ({
          id: g.id,
          name: g.name,
          required: g.required,
          min_selections: g.min_selections,
          max_selections: g.max_selections,
          options: (g.modifier_options || []).map((o: any) => ({
            id: o.id,
            name: o.name,
            price_adjustment: o.price_adjustment,
          })),
        }))
      );
    }

    setLoading(false);
  }, [isNew, restaurant, itemId, supabase, router]);

  useEffect(() => {
    if (!restaurant) return;

    // Fetch categories
    supabase
      .from("menu_categories")
      .select("id, name")
      .eq("restaurant_id", restaurant.id)
      .order("sort_order", { ascending: true })
      .then(({ data }) => setCategories(data || []));

    fetchItem();
  }, [restaurant, supabase, fetchItem]);

  function addModifierGroup() {
    setModifierGroups((prev) => [
      ...prev,
      {
        name: "",
        required: false,
        min_selections: 0,
        max_selections: 1,
        options: [{ name: "", price_adjustment: 0 }],
      },
    ]);
  }

  function removeModifierGroup(index: number) {
    setModifierGroups((prev) => prev.filter((_, i) => i !== index));
  }

  function updateModifierGroup(index: number, field: string, value: any) {
    setModifierGroups((prev) =>
      prev.map((g, i) => (i === index ? { ...g, [field]: value } : g))
    );
  }

  function addOption(groupIndex: number) {
    setModifierGroups((prev) =>
      prev.map((g, i) =>
        i === groupIndex
          ? { ...g, options: [...g.options, { name: "", price_adjustment: 0 }] }
          : g
      )
    );
  }

  function removeOption(groupIndex: number, optionIndex: number) {
    setModifierGroups((prev) =>
      prev.map((g, i) =>
        i === groupIndex
          ? { ...g, options: g.options.filter((_, j) => j !== optionIndex) }
          : g
      )
    );
  }

  function updateOption(groupIndex: number, optionIndex: number, field: string, value: any) {
    setModifierGroups((prev) =>
      prev.map((g, i) =>
        i === groupIndex
          ? {
              ...g,
              options: g.options.map((o, j) =>
                j === optionIndex ? { ...o, [field]: value } : o
              ),
            }
          : g
      )
    );
  }

  async function handleSave() {
    if (!restaurant || !name || !basePrice || !categoryId) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);

    try {
      let menuItemId = itemId;

      if (isNew) {
        // Get max sort_order
        const { data: existingItems } = await supabase
          .from("menu_items")
          .select("sort_order")
          .eq("category_id", categoryId)
          .order("sort_order", { ascending: false })
          .limit(1);

        const nextSort = (existingItems?.[0]?.sort_order || 0) + 1;

        const { data: newItem, error } = await supabase
          .from("menu_items")
          .insert({
            restaurant_id: restaurant.id,
            category_id: categoryId,
            name,
            description: description || null,
            base_price: parseFloat(basePrice),
            is_available: available,
            sort_order: nextSort,
          })
          .select()
          .single();

        if (error || !newItem) throw error || new Error("Failed to create item");
        menuItemId = newItem.id;
      } else {
        const { error } = await supabase
          .from("menu_items")
          .update({
            name,
            description: description || null,
            base_price: parseFloat(basePrice),
            category_id: categoryId,
            is_available: available,
          })
          .eq("id", itemId);

        if (error) throw error;

        // Delete existing modifier groups (cascade deletes options)
        await supabase.from("modifier_groups").delete().eq("menu_item_id", itemId);
      }

      // Insert modifier groups and options
      for (let i = 0; i < modifierGroups.length; i++) {
        const group = modifierGroups[i];
        if (!group.name) continue;

        const { data: newGroup, error: groupError } = await supabase
          .from("modifier_groups")
          .insert({
            restaurant_id: restaurant.id,
            menu_item_id: menuItemId,
            name: group.name,
            required: group.required,
            min_selections: group.min_selections,
            max_selections: group.max_selections,
            sort_order: i,
          })
          .select()
          .single();

        if (groupError || !newGroup) continue;

        const validOptions = group.options.filter((o) => o.name);
        if (validOptions.length > 0) {
          await supabase.from("modifier_options").insert(
            validOptions.map((o, j) => ({
              modifier_group_id: newGroup.id,
              name: o.name,
              price_adjustment: o.price_adjustment || 0,
              sort_order: j,
            }))
          );
        }
      }

      toast.success(isNew ? "Menu item created" : "Menu item updated");
      router.push("/menu");
    } catch (err) {
      toast.error("Failed to save menu item");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/menu">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Menu
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">
          {isNew ? "New Menu Item" : `Edit: ${name}`}
        </h1>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Item Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Category *</Label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="">Select category...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Item Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Margherita Pizza" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this item..."
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Base Price ($) *</Label>
              <Input
                type="number"
                step="0.01"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={available} onCheckedChange={setAvailable} />
              <Label>Available</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modifier Groups */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Modifier Groups</CardTitle>
          <Button variant="outline" size="sm" onClick={addModifierGroup}>
            <Plus className="h-4 w-4 mr-1" /> Add Group
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {modifierGroups.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              No modifier groups. Add groups like &quot;Size&quot;, &quot;Toppings&quot;, etc.
            </p>
          )}

          {modifierGroups.map((group, gi) => (
            <div key={gi} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Input
                  value={group.name}
                  onChange={(e) => updateModifierGroup(gi, "name", e.target.value)}
                  placeholder="Group name (e.g. Size)"
                  className="max-w-48"
                />
                <Button variant="ghost" size="sm" onClick={() => removeModifierGroup(gi)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={group.required}
                    onCheckedChange={(v) => updateModifierGroup(gi, "required", v)}
                  />
                  <span>Required</span>
                </div>
                <div className="flex items-center gap-1">
                  <Label className="text-xs">Min:</Label>
                  <Input
                    type="number"
                    className="w-16 h-8"
                    value={group.min_selections}
                    onChange={(e) => updateModifierGroup(gi, "min_selections", parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Label className="text-xs">Max:</Label>
                  <Input
                    type="number"
                    className="w-16 h-8"
                    value={group.max_selections}
                    onChange={(e) => updateModifierGroup(gi, "max_selections", parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>

              <Separator />

              {/* Options */}
              <div className="space-y-2">
                {group.options.map((option, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <Input
                      value={option.name}
                      onChange={(e) => updateOption(gi, oi, "name", e.target.value)}
                      placeholder="Option name"
                      className="flex-1"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">+$</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={option.price_adjustment}
                        onChange={(e) =>
                          updateOption(gi, oi, "price_adjustment", parseFloat(e.target.value) || 0)
                        }
                        className="w-20"
                        placeholder="0.00"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOption(gi, oi)}
                      disabled={group.options.length <= 1}
                    >
                      <Trash2 className="h-3 w-3 text-gray-400" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={() => addOption(gi)} className="text-xs">
                <Plus className="h-3 w-3 mr-1" /> Add Option
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? "Saving..." : isNew ? "Create Item" : "Save Changes"}
        </Button>
        <Link href="/menu">
          <Button variant="outline" size="lg">Cancel</Button>
        </Link>
      </div>
    </div>
  );
}
