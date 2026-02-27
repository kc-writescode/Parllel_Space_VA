import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Retell Inbound Webhook
 *
 * Called by Retell before each inbound call to get per-call agent overrides.
 * This allows injecting dynamic data (business hours, daily specials, etc.)
 * into the agent prompt for each call.
 *
 * Retell sends: { agent_id, from_number, to_number }
 * We respond with optional overrides: { dynamic_variables, metadata }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agent_id, from_number, to_number } = body;

    const supabase = createAdminClient();

    // Find restaurant by Retell agent ID
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("*")
      .eq("retell_agent_id", agent_id)
      .single();

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    // Check if restaurant is currently open
    const now = new Date();
    const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const currentDay = dayNames[now.getDay()];
    const hours = (restaurant.business_hours as Record<string, any>)?.[currentDay];

    let isOpen = true;
    let closingTime = "";
    if (hours) {
      const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      isOpen = currentTime >= hours.open && currentTime <= hours.close;
      closingTime = hours.close;
    }

    // Look up or note the caller
    let customerName = "";
    if (from_number) {
      const { data: customer } = await supabase
        .from("customers")
        .select("name")
        .eq("restaurant_id", restaurant.id)
        .eq("phone", from_number)
        .single();

      if (customer?.name) {
        customerName = customer.name;
      }
    }

    // Build dynamic variables for the agent prompt
    const dynamicVariables: Record<string, string> = {};

    if (!isOpen) {
      dynamicVariables["store_status"] =
        "The restaurant is currently CLOSED. Politely inform the caller of the business hours and that they cannot place an order right now.";
    } else {
      dynamicVariables["store_status"] = closingTime
        ? `The restaurant is currently OPEN and closes at ${closingTime}.`
        : "The restaurant is currently OPEN.";
    }

    if (customerName) {
      dynamicVariables["returning_customer"] =
        `This is a returning customer named ${customerName}. Greet them by name.`;
    }

    if (!restaurant.delivery_enabled) {
      dynamicVariables["delivery_note"] =
        "This restaurant only offers pickup. If the customer asks for delivery, let them know pickup is the only option.";
    }

    return NextResponse.json({
      dynamic_variables: dynamicVariables,
      metadata: {
        restaurant_id: restaurant.id,
        caller_phone: from_number,
        is_open: isOpen,
      },
    });
  } catch (error) {
    console.error("Retell inbound webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
