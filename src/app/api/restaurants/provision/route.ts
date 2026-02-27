import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createRestaurantAgent,
  provisionPhoneNumber,
  getOrderingTools,
} from "@/lib/retell/client";
import { buildSystemPrompt } from "@/lib/retell/prompt-builder";

/**
 * POST /api/restaurants/provision
 *
 * Accepts pre-fetched restaurant + menu data from the browser (avoiding
 * server-side DB calls that time out due to undici network issues).
 * Only makes external Retell API calls — no DB access.
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

    if (!restaurant?.id || !restaurant?.name) {
      return NextResponse.json(
        { error: "restaurant data required" },
        { status: 400 }
      );
    }

    // Build system prompt from the data passed by the browser
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
      },
      menu || []
    );

    // Create Retell agent + LLM (external API — not Supabase, no timeout issue)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const tools = getOrderingTools(appUrl);
    const { agentId, llmId } = await createRestaurantAgent(
      restaurant.name,
      systemPrompt,
      tools
    );

    // Provision phone number via Retell
    const { phoneNumber, phoneNumberId } = await provisionPhoneNumber(agentId);

    return NextResponse.json({
      agent_id: agentId,
      llm_id: llmId,
      phone_number: phoneNumber,
      phone_number_id: phoneNumberId,
    });
  } catch (error) {
    console.error("Provisioning error:", error);
    const message =
      error instanceof Error ? error.message : "Provisioning failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
