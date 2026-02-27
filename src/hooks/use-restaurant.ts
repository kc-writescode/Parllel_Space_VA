"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

export function useRestaurant() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchRestaurant() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user ?? null;
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: member, error: memberError } = await supabase
          .from("restaurant_members")
          .select("restaurant_id")
          .eq("user_id", user.id)
          .single();

        // No membership found — create restaurant + membership via SECURITY DEFINER
        // function to bypass RLS (auth.uid() is null on direct inserts in this env).
        if (!member) {
          const restaurantName = user.user_metadata?.restaurant_name;
          if (restaurantName) {
            const slug =
              restaurantName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "") +
              "-" +
              Date.now().toString(36);

            const { data: newRestaurant } = await supabase.rpc(
              "create_restaurant_for_user",
              { p_name: restaurantName, p_slug: slug }
            );

            if (newRestaurant) {
              setRestaurant(newRestaurant);
            }
          }
          setLoading(false);
          return;
        }

        if (memberError || !member) {
          setLoading(false);
          return;
        }

        const { data: restaurantData, error: restaurantError } = await supabase
          .from("restaurants")
          .select("*")
          .eq("id", member.restaurant_id)
          .single();

        if (restaurantError) {
          console.error("Failed to fetch restaurant:", restaurantError.message);
        }

        setRestaurant(restaurantData);
      } catch (err) {
        console.error("Error fetching restaurant:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchRestaurant();
  }, [supabase]);

  return { restaurant, loading };
}
