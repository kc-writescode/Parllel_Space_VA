"use client";

import { useState, useEffect, useRef } from "react";
import { useRealtimeOrders } from "@/hooks/use-realtime-orders";
import { useAudioAlert } from "@/hooks/use-audio-alert";
import { useRestaurant } from "@/hooks/use-restaurant";
import { OrderCard } from "./order-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

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
  const [search, setSearch] = useState("");
  const prevCountRef = useRef(orders.length);

  // Play audio alert on new order
  useEffect(() => {
    if (orders.length > prevCountRef.current) {
      playAlert();
    }
    prevCountRef.current = orders.length;
  }, [orders.length, playAlert]);

  const q = search.trim().toLowerCase();

  const filteredOrders = orders
    .filter((o) => (filter === "all" ? true : o.status === filter))
    .filter((o) => {
      if (!q) return true;
      if (String(o.order_number).includes(q)) return true;
      if (o.customer?.name?.toLowerCase().includes(q)) return true;
      if (o.customer?.phone?.toLowerCase().includes(q)) return true;
      return false;
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading orders...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <Input
          placeholder="Search by order #, name, or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

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
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500">
            {q ? `No orders matching "${search}"` : "No orders yet. They'll appear here in real-time."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
