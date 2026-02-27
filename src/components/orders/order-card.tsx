"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OrderStatusBadge, PaymentStatusBadge } from "./order-status-badge";
import { formatCurrency, formatTimeAgo } from "@/lib/utils/formatters";
import { createClient } from "@/lib/supabase/client";
import { MapPin, ShoppingBag } from "lucide-react";
import type { Database } from "@/types/database";

type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  order_items?: Database["public"]["Tables"]["order_items"]["Row"][];
  customer?: Database["public"]["Tables"]["customers"]["Row"] | null;
};

interface OrderCardProps {
  order: Order;
  onSelect?: (order: Order) => void;
}

const nextStatus: Record<string, string> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "ready",
  ready: "completed",
};

const actionLabels: Record<string, string> = {
  pending: "Confirm",
  confirmed: "Start Preparing",
  preparing: "Mark Ready",
  ready: "Complete",
};

export function OrderCard({ order, onSelect }: OrderCardProps) {
  const supabase = createClient();

  async function updateStatus() {
    const next = nextStatus[order.status];
    if (!next) return;

    const updateData: Record<string, unknown> = { status: next };
    if (next === "confirmed") updateData.confirmed_at = new Date().toISOString();
    if (next === "ready") updateData.ready_at = new Date().toISOString();
    if (next === "completed") updateData.completed_at = new Date().toISOString();

    await supabase.from("orders").update(updateData).eq("id", order.id);
  }

  async function cancelOrder() {
    await supabase
      .from("orders")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", order.id);
  }

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onSelect?.(order)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">#{order.order_number}</span>
            <Badge variant="outline" className="text-xs">
              {order.order_type === "delivery" ? (
                <><MapPin className="h-3 w-3 mr-1" /> Delivery</>
              ) : (
                <><ShoppingBag className="h-3 w-3 mr-1" /> Pickup</>
              )}
            </Badge>
          </div>
          <span className="text-xs text-gray-500">{formatTimeAgo(order.created_at)}</span>
        </div>
        <div className="flex gap-2 mt-1">
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.payment_status} />
        </div>
      </CardHeader>
      <CardContent>
        {/* Items */}
        <div className="space-y-1 mb-3">
          {order.order_items?.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>
                {item.quantity}x {item.name}
              </span>
              <span className="text-gray-600">{formatCurrency(item.item_total)}</span>
            </div>
          ))}
        </div>

        {/* Customer */}
        {order.customer && (
          <p className="text-sm text-gray-600 mb-2">
            {order.customer.name || "Unknown"} &middot; {order.customer.phone}
          </p>
        )}

        {order.delivery_address && (
          <p className="text-xs text-gray-500 mb-2">{order.delivery_address}</p>
        )}

        {/* Total */}
        <div className="flex justify-between font-semibold text-sm border-t pt-2 mb-3">
          <span>Total</span>
          <span>{formatCurrency(order.total)}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {nextStatus[order.status] && (
            <Button size="sm" className="flex-1" onClick={updateStatus}>
              {actionLabels[order.status]}
            </Button>
          )}
          {order.status === "pending" && (
            <Button size="sm" variant="destructive" onClick={cancelOrder}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
