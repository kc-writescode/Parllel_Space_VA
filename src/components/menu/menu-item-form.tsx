"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";

interface ModifierOption {
  name: string;
  price_adjustment: number;
}

interface ModifierGroup {
  name: string;
  required: boolean;
  options: ModifierOption[];
}

interface MenuItemFormData {
  name: string;
  description: string;
  base_price: number;
  is_available: boolean;
  modifier_groups: ModifierGroup[];
}

interface MenuItemFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: MenuItemFormData) => void;
  initialData?: Partial<MenuItemFormData>;
  title?: string;
}

export function MenuItemForm({
  open,
  onClose,
  onSave,
  initialData,
  title = "Add Menu Item",
}: MenuItemFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [basePrice, setBasePrice] = useState(initialData?.base_price?.toString() || "");
  const [isAvailable, setIsAvailable] = useState(initialData?.is_available ?? true);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>(
    initialData?.modifier_groups || []
  );

  function addModifierGroup() {
    setModifierGroups([
      ...modifierGroups,
      { name: "", required: false, options: [{ name: "", price_adjustment: 0 }] },
    ]);
  }

  function removeModifierGroup(index: number) {
    setModifierGroups(modifierGroups.filter((_, i) => i !== index));
  }

  function updateModifierGroup(index: number, field: keyof ModifierGroup, value: unknown) {
    const updated = [...modifierGroups];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updated[index] as any)[field] = value;
    setModifierGroups(updated);
  }

  function addOption(groupIndex: number) {
    const updated = [...modifierGroups];
    updated[groupIndex].options.push({ name: "", price_adjustment: 0 });
    setModifierGroups(updated);
  }

  function removeOption(groupIndex: number, optionIndex: number) {
    const updated = [...modifierGroups];
    updated[groupIndex].options = updated[groupIndex].options.filter(
      (_, i) => i !== optionIndex
    );
    setModifierGroups(updated);
  }

  function updateOption(
    groupIndex: number,
    optionIndex: number,
    field: keyof ModifierOption,
    value: string | number
  ) {
    const updated = [...modifierGroups];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updated[groupIndex].options[optionIndex] as any)[field] = value;
    setModifierGroups(updated);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      name,
      description,
      base_price: parseFloat(basePrice),
      is_available: isAvailable,
      modifier_groups: modifierGroups.filter((mg) => mg.name && mg.options.some((o) => o.name)),
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="item-name">Name</Label>
              <Input
                id="item-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Margherita Pizza"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-price">Price ($)</Label>
              <Input
                id="item-price"
                type="number"
                step="0.01"
                min="0"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                placeholder="12.99"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-desc">Description</Label>
            <Textarea
              id="item-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Fresh mozzarella, tomato sauce, basil"
              rows={2}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
            <Label>Available</Label>
          </div>

          {/* Modifier Groups */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Modifiers</Label>
              <Button type="button" variant="outline" size="sm" onClick={addModifierGroup}>
                <Plus className="h-4 w-4 mr-1" /> Add Group
              </Button>
            </div>

            {modifierGroups.map((group, gi) => (
              <div key={gi} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Input
                    value={group.name}
                    onChange={(e) => updateModifierGroup(gi, "name", e.target.value)}
                    placeholder="Size, Toppings, etc."
                    className="flex-1"
                  />
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={group.required}
                      onCheckedChange={(v) => updateModifierGroup(gi, "required", v)}
                    />
                    <Label className="text-xs">Required</Label>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeModifierGroup(gi)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>

                {group.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2 ml-4">
                    <Input
                      value={opt.name}
                      onChange={(e) => updateOption(gi, oi, "name", e.target.value)}
                      placeholder="Option name"
                      className="flex-1"
                    />
                    <div className="flex items-center gap-1 w-32">
                      <span className="text-sm text-gray-500">+$</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={opt.price_adjustment}
                        onChange={(e) =>
                          updateOption(gi, oi, "price_adjustment", parseFloat(e.target.value) || 0)
                        }
                        className="w-20"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOption(gi, oi)}
                    >
                      <Trash2 className="h-3 w-3 text-red-400" />
                    </Button>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-4"
                  onClick={() => addOption(gi)}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Option
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save Item</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
