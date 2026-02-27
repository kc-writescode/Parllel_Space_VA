"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/formatters";
import { Plus, Minus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface MenuItem {
  id: string;
  name: string;
  base_price: number;
  category_id: string;
}

interface MenuCategory {
  id: string;
  name: string;
}

interface OrderItem {
  menu_item_id: string;
  name: string;
  unit_price: number;
  quantity: number;
}

export function CreateOrderDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { restaurant } = useRestaurant();
  const supabase = createClient();

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderType, setOrderType] = useState<"pickup" | "delivery">("pickup");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurant || !open) return;

    async function fetchMenu() {
      const [catRes, itemRes] = await Promise.all([
        supabase
          .from("menu_categories")
          .select("id, name")
          .eq("restaurant_id", restaurant!.id)
          .order("sort_order"),
        supabase
          .from("menu_items")
          .select("id, name, base_price, category_id")
          .eq("restaurant_id", restaurant!.id)
          .eq("is_available", true)
          .order("sort_order"),
      ]);
      setCategories(catRes.data || []);
      setMenuItems(itemRes.data || []);
      if (catRes.data?.length) setSelectedCategory(catRes.data[0].id);
    }

    fetchMenu();
  }, [restaurant, open, supabase]);

  function addItem(item: MenuItem) {
    setOrderItems((prev) => {
      const existing = prev.find((o) => o.menu_item_id === item.id);
      if (existing) {
        return prev.map((o) =>
          o.menu_item_id === item.id ? { ...o, quantity: o.quantity + 1 } : o
        );
      }
      return [
        ...prev,
        {
          menu_item_id: item.id,
          name: item.name,
          unit_price: item.base_price,
          quantity: 1,
        },
      ];
    });
  }

  function updateQuantity(menuItemId: string, delta: number) {
    setOrderItems((prev) =>
      prev
        .map((o) =>
          o.menu_item_id === menuItemId
            ? { ...o, quantity: o.quantity + delta }
            : o
        )
        .filter((o) => o.quantity > 0)
    );
  }

  const subtotal = orderItems.reduce(
    (sum, o) => sum + o.unit_price * o.quantity,
    0
  );

  async function handleSubmit() {
    if (orderItems.length === 0) {
      toast.error("Add at least one item");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_type: orderType,
          items: orderItems,
          customer_name: customerName || undefined,
          customer_phone: customerPhone || undefined,
          delivery_address:
            orderType === "delivery" ? deliveryAddress : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`Order #${data.order_number} created`);
      resetForm();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setOrderItems([]);
    setOrderType("pickup");
    setCustomerName("");
    setCustomerPhone("");
    setDeliveryAddress("");
  }

  const filteredItems = selectedCategory
    ? menuItems.filter((i) => i.category_id === selectedCategory)
    : menuItems;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          resetForm();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Manual Order</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left - Menu Items */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Menu</Label>

            {/* Category tabs */}
            <div className="flex flex-wrap gap-1">
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  size="sm"
                  variant={selectedCategory === cat.id ? "default" : "outline"}
                  onClick={() => setSelectedCategory(cat.id)}
                  className="text-xs"
                >
                  {cat.name}
                </Button>
              ))}
            </div>

            {/* Items list */}
            <div className="space-y-1 max-h-60 overflow-y-auto border rounded-lg p-2">
              {filteredItems.length === 0 ? (
                <p className="text-xs text-gray-400 p-2">No items in this category</p>
              ) : (
                filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => addItem(item)}
                    className="w-full flex items-center justify-between p-2 rounded hover:bg-gray-50 text-left text-sm"
                  >
                    <span>{item.name}</span>
                    <span className="text-gray-500 text-xs">
                      {formatCurrency(item.base_price)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right - Order Summary */}
          <div className="space-y-4">
            {/* Order Type */}
            <div>
              <Label className="text-sm font-medium">Order Type</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  size="sm"
                  variant={orderType === "pickup" ? "default" : "outline"}
                  onClick={() => setOrderType("pickup")}
                >
                  Pickup
                </Button>
                <Button
                  size="sm"
                  variant={orderType === "delivery" ? "default" : "outline"}
                  onClick={() => setOrderType("delivery")}
                >
                  Delivery
                </Button>
              </div>
            </div>

            {/* Customer Info */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Customer (optional)</Label>
              <Input
                placeholder="Name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="text-sm"
              />
              <Input
                placeholder="Phone (+1...)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="text-sm"
              />
              {orderType === "delivery" && (
                <Input
                  placeholder="Delivery address"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="text-sm"
                />
              )}
            </div>

            <Separator />

            {/* Cart */}
            <div>
              <Label className="text-sm font-medium">Items</Label>
              {orderItems.length === 0 ? (
                <p className="text-xs text-gray-400 mt-1">
                  Click menu items to add them
                </p>
              ) : (
                <div className="space-y-2 mt-2">
                  {orderItems.map((item) => (
                    <div
                      key={item.menu_item_id}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() =>
                              updateQuantity(item.menu_item_id, -1)
                            }
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Badge variant="secondary" className="text-xs min-w-[24px] justify-center">
                            {item.quantity}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() =>
                              updateQuantity(item.menu_item_id, 1)
                            }
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <span className="truncate">{item.name}</span>
                      </div>
                      <span className="text-gray-600 ml-2">
                        {formatCurrency(item.unit_price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {orderItems.length > 0 && (
              <>
                <Separator />
                <div className="flex justify-between font-medium text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <p className="text-xs text-gray-400">
                  Tax and delivery fee calculated automatically
                </p>
              </>
            )}

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={submitting || orderItems.length === 0}
            >
              {submitting ? "Creating..." : "Create Order"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
