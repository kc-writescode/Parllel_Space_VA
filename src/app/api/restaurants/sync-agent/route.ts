import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  updateAgentPrompt,
  getOrderingTools,
} from "@/lib/retell/client";
import { buildSystemPrompt } from "@/lib/retell/prompt-builder";

/**
 * POST /api/restaurants/sync-agent
 *
 * Re-builds the Retell LLM system prompt from updated restaurant + menu data
 * sent by the browser. No DB calls server-side — only Retell API call.
 */
export async function POST(req: NextRequest) {
  try {
    // Auth check via local JWT read only (no network call)
    const serverClient = await createClient();
    const {
      data: { session },
    } = await serverClient.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { restaurant, menu } = await req.json();

    if (!restaurant?.retell_llm_id) {
      return NextResponse.json(
        { error: "No Retell LLM ID — agent not provisioned yet" },
        { status: 400 }
      );
    }

    const systemPrompt = buildSystemPrompt(
      {
        name: restaurant.name,
        address: restaurant.address,
        business_hours: (restaurant.business_hours || {}) as Record<
          string,
          { open: string; close: string }
        >,
        delivery_enabled: restaurant.delivery_enabled,
        delivery_fee: restaurant.delivery_fee,
        delivery_radius_miles: restaurant.delivery_radius_miles,
        tax_rate: restaurant.tax_rate,
        pickup_wait_minutes: restaurant.pickup_wait_minutes ?? 15,
        delivery_wait_minutes: restaurant.delivery_wait_minutes ?? 35,
      },
      menu || []
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const tools = getOrderingTools(appUrl);

    await updateAgentPrompt(restaurant.retell_llm_id, systemPrompt, tools);

    return NextResponse.json({ synced: true });
  } catch (error) {
    console.error("Agent sync error:", error);
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
