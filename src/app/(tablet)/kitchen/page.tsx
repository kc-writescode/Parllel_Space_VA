"use client";

import { useEffect, useRef } from "react";
import { useRealtimeOrders } from "@/hooks/use-realtime-orders";
import { useAudioAlert } from "@/hooks/use-audio-alert";
import { useRestaurant } from "@/hooks/use-restaurant";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatTimeAgo } from "@/lib/utils/formatters";
import { MapPin, ShoppingBag, Wifi } from "lucide-react";
import type { Database } from "@/types/database";

type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  order_items?: Database["public"]["Tables"]["order_items"]["Row"][];
  customer?: Database["public"]["Tables"]["customers"]["Row"] | null;
};

export default function KitchenPage() {
  const { restaurant } = useRestaurant();
  const { orders } = useRealtimeOrders(restaurant?.id || null);
  const { playAlert } = useAudioAlert();
  const supabase = createClient();
  const prevCountRef = useRef(0);

  // Play alert on new orders
  useEffect(() => {
    const pendingCount = orders.filter((o) => o.status === "pending").length;
    if (pendingCount > prevCountRef.current) {
      playAlert();
    }
    prevCountRef.current = pendingCount;
  }, [orders, playAlert]);

  const newOrders = orders.filter((o) => o.status === "pending" || o.status === "confirmed");
  const preparing = orders.filter((o) => o.status === "preparing");
  const ready = orders.filter((o) => o.status === "ready");

  async function updateStatus(orderId: string, status: string) {
    const updateData: Record<string, unknown> = { status };
    if (status === "confirmed") updateData.confirmed_at = new Date().toISOString();
    if (status === "preparing") updateData.confirmed_at = new Date().toISOString();
    if (status === "ready") updateData.ready_at = new Date().toISOString();
    if (status === "completed") updateData.completed_at = new Date().toISOString();

    await supabase.from("orders").update(updateData).eq("id", orderId);
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
        <h1 className="text-xl font-bold">{restaurant?.name || "Kitchen Display"}</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <Wifi className="h-5 w-5 text-green-400" />
        </div>
      </header>

      {/* Columns */}
      <div className="flex-1 grid grid-cols-3 gap-4 p-4 overflow-hidden">
        {/* New Orders */}
        <Column
          title="New Orders"
          count={newOrders.length}
          color="text-yellow-400"
          bgColor="bg-yellow-400/10"
        >
          {newOrders.map((order) => (
            <KitchenOrderCard
              key={order.id}
              order={order}
              actionLabel="Accept"
              actionColor="bg-green-600 hover:bg-green-700"
              onAction={() => updateStatus(order.id, "preparing")}
            />
          ))}
        </Column>

        {/* Preparing */}
        <Column
          title="Preparing"
          count={preparing.length}
          color="text-orange-400"
          bgColor="bg-orange-400/10"
        >
          {preparing.map((order) => (
            <KitchenOrderCard
              key={order.id}
              order={order}
              actionLabel="Mark Ready"
              actionColor="bg-blue-600 hover:bg-blue-700"
              onAction={() => updateStatus(order.id, "ready")}
            />
          ))}
        </Column>

        {/* Ready */}
        <Column
          title="Ready"
          count={ready.length}
          color="text-green-400"
          bgColor="bg-green-400/10"
        >
          {ready.map((order) => (
            <KitchenOrderCard
              key={order.id}
              order={order}
              actionLabel="Complete"
              actionColor="bg-gray-600 hover:bg-gray-700"
              onAction={() => updateStatus(order.id, "completed")}
            />
          ))}
        </Column>
      </div>
    </div>
  );
}

function Column({
  title,
  count,
  color,
  bgColor,
  children,
}: {
  title: string;
  count: number;
  color: string;
  bgColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-0">
      <div className={`flex items-center justify-between px-4 py-2 rounded-t-lg ${bgColor}`}>
        <h2 className={`text-lg font-bold ${color}`}>{title}</h2>
        <span className={`text-2xl font-bold ${color}`}>{count}</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 pt-3">
        {children}
      </div>
    </div>
  );
}

function KitchenOrderCard({
  order,
  actionLabel,
  actionColor,
  onAction,
}: {
  order: Order;
  actionLabel: string;
  actionColor: string;
  onAction: () => void;
}) {
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      {/* Order Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-4xl font-bold">#{order.order_number}</span>
        <div className="text-right">
          <div className="flex items-center gap-1 text-sm">
            {order.order_type === "delivery" ? (
              <><MapPin className="h-4 w-4 text-blue-400" /> <span className="text-blue-400">Delivery</span></>
            ) : (
              <><ShoppingBag className="h-4 w-4 text-green-400" /> <span className="text-green-400">Pickup</span></>
            )}
          </div>
          <span className="text-xs text-gray-500">{formatTimeAgo(order.created_at)}</span>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-2 mb-3">
        {order.order_items?.map((item) => (
          <div key={item.id} className="text-lg">
            <span className="font-semibold text-yellow-300">{item.quantity}x</span>{" "}
            <span>{item.name}</span>
            {item.modifiers && Array.isArray(item.modifiers) && (item.modifiers as { group: string; option: string }[]).length > 0 && (
              <div className="text-sm text-gray-400 ml-6">
                {(item.modifiers as { group: string; option: string }[]).map((m, i) => (
                  <span key={i}>{m.option}{i < (item.modifiers as unknown[]).length - 1 ? ", " : ""}</span>
                ))}
              </div>
            )}
            {item.special_instructions && (
              <div className="text-sm text-red-400 ml-6">
                Note: {item.special_instructions}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Customer & Total */}
      <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
        <span>{order.customer?.name || "Unknown"}</span>
        <span className="font-semibold text-white">{formatCurrency(order.total)}</span>
      </div>

      {order.delivery_address && (
        <p className="text-sm text-gray-500 mb-3">{order.delivery_address}</p>
      )}

      {/* Action Button */}
      <button
        onClick={onAction}
        className={`w-full py-4 rounded-lg text-lg font-bold text-white transition-colors ${actionColor}`}
      >
        {actionLabel}
      </button>
    </div>
  );
}
