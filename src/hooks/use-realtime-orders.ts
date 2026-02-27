"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  order_items?: Database["public"]["Tables"]["order_items"]["Row"][];
  customer?: Database["public"]["Tables"]["customers"]["Row"] | null;
};

export function useRealtimeOrders(restaurantId: string | null) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return;

    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*), customer:customers(*)")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(50);

    setOrders((data as Order[]) || []);
    setLoading(false);
  }, [restaurantId, supabase]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel(`orders:${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        async (payload) => {
          // Fetch full order with joins
          const { data } = await supabase
            .from("orders")
            .select("*, order_items(*), customer:customers(*)")
            .eq("id", payload.new.id)
            .single();

          if (data) {
            setOrders((prev) => [data as Order, ...prev]);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === payload.new.id ? { ...o, ...payload.new } : o
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, supabase]);

  return { orders, loading, refetch: fetchOrders };
}
