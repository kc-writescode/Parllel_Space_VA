"use client";

import { useState, useEffect, useRef } from "react";
import { useRealtimeOrders } from "@/hooks/use-realtime-orders";
import { useAudioAlert } from "@/hooks/use-audio-alert";
import { useRestaurant } from "@/hooks/use-restaurant";
import { OrderCard } from "./order-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "preparing", label: "Preparing" },
  { value: "ready", label: "Ready" },
  { value: "completed", label: "Completed" },
];

export function OrderQueue() {
  const { restaurant } = useRestaurant();
  const { orders, loading } = useRealtimeOrders(restaurant?.id || null);
  const { playAlert } = useAudioAlert();
  const [filter, setFilter] = useState("all");
  const prevCountRef = useRef(orders.length);

  // Play audio alert on new order
  useEffect(() => {
    if (orders.length > prevCountRef.current) {
      playAlert();
    }
    prevCountRef.current = orders.length;
  }, [orders.length, playAlert]);

  const filteredOrders =
    filter === "all"
      ? orders
      : orders.filter((o) => o.status === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading orders...</p>
      </div>
    );
  }

  return (
    <div>
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          {STATUS_FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>
              {f.label}
              {f.value !== "all" && (
                <span className="ml-1 text-xs">
                  ({orders.filter((o) => o.status === f.value).length})
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filteredOrders.length === 0 ? (
        <div className="flex items-center justify-center h-48 mt-6">
          <p className="text-gray-500">No orders yet. They&apos;ll appear here in real-time.</p>
        </div>
      ) : (
        <div className="grid gap-4 mt-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
