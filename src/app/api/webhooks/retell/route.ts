import { NextRequest, NextResponse } from "next/server";
import Retell from "retell-sdk";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Verify webhook signature
  const apiKey = process.env.RETELL_API_KEY!;
  const signature = req.headers.get("x-retell-signature");
  if (!Retell.verify(JSON.stringify(body), apiKey, signature || "")) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const event = body.event;
  const callData = body.data;

  try {
    if (event === "call_started") {
      await handleCallStarted(supabase, callData);
    } else if (event === "call_ended") {
      await handleCallEnded(supabase, callData);
    } else if (event === "call_analyzed") {
      await handleCallAnalyzed(supabase, callData);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`Error handling ${event}:`, error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function handleCallStarted(
  supabase: ReturnType<typeof createAdminClient>,
  callData: Record<string, unknown>
) {
  // Find restaurant by the phone number that was called
  const toNumber = callData.to_number as string;
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id")
    .eq("retell_phone_number", toNumber)
    .single();

  if (!restaurant) {
    console.error("No restaurant found for phone number:", toNumber);
    return;
  }

  await supabase.from("calls").insert({
    restaurant_id: restaurant.id,
    retell_call_id: callData.call_id as string,
    caller_phone: callData.from_number as string || null,
    status: "in_progress",
    started_at: new Date().toISOString(),
  });
}

async function handleCallEnded(
  supabase: ReturnType<typeof createAdminClient>,
  callData: Record<string, unknown>
) {
  const retellCallId = callData.call_id as string;

  // Determine final call status from disconnection reason
  const disconnectionReason = callData.disconnection_reason as string | null;
  let finalStatus: "completed" | "error" | "voicemail" = "completed";
  if (disconnectionReason === "voicemail_reached") {
    finalStatus = "voicemail";
  } else if (
    disconnectionReason === "dial_failed" ||
    disconnectionReason === "call_failed" ||
    disconnectionReason === "error"
  ) {
    finalStatus = "error";
  }

  // Update call record
  const { data: call } = await supabase
    .from("calls")
    .update({
      status: finalStatus,
      ended_at: new Date().toISOString(),
      duration_ms: callData.duration_ms as number || null,
      transcript: callData.transcript as unknown || null,
      recording_url: callData.recording_url as string || null,
      disconnection_reason: disconnectionReason,
    })
    .eq("retell_call_id", retellCallId)
    .select("*, restaurants(*)")
    .single();

  if (!call) return;

  // Extract order from transcript tool calls
  // Retell sends tool call data in `transcript_with_tool_calls`, not in `transcript`
  const transcriptWithTools = callData.transcript_with_tool_calls as TranscriptEntry[] | undefined;
  const order = extractOrderFromTranscript(transcriptWithTools || null);
  if (!order || !order.items.length) return;

  // Get restaurant details for pricing
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("*")
    .eq("id", call.restaurant_id)
    .single();

  if (!restaurant) return;

  // Create or update customer
  const callerPhone = call.caller_phone || order.customerPhone;
  let customerId: string | null = null;

  if (callerPhone) {
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("phone", callerPhone)
      .eq("restaurant_id", call.restaurant_id)
      .single();

    if (existingCustomer) {
      customerId = existingCustomer.id;
      if (order.customerName) {
        await supabase
          .from("customers")
          .update({ name: order.customerName })
          .eq("id", existingCustomer.id);
      }
    } else {
      const { data: newCustomer } = await supabase
        .from("customers")
        .insert({
          phone: callerPhone,
          name: order.customerName || null,
          restaurant_id: call.restaurant_id,
        })
        .select("id")
        .single();
      customerId = newCustomer?.id || null;
    }
  }

  // Resolve menu items and calculate prices
  const { data: menuItems } = await supabase
    .from("menu_items")
    .select("id, name, base_price")
    .eq("restaurant_id", call.restaurant_id);

  const resolvedItems = order.items.map((item) => {
    const match = findBestMenuItemMatch(item.name, menuItems || []);
    const unitPrice = match?.base_price || 0;
    const modifierTotal = item.modifiers.reduce(
      (sum, m) => sum + (m.price || 0),
      0
    );
    const itemTotal = (unitPrice + modifierTotal) * item.quantity;

    return {
      menu_item_id: match?.id || null,
      name: match?.name || item.name,
      quantity: item.quantity,
      unit_price: unitPrice,
      modifiers: item.modifiers,
      item_total: itemTotal,
      special_instructions: item.specialInstructions || null,
    };
  });

  const subtotal = resolvedItems.reduce((sum, i) => sum + i.item_total, 0);
  const tax = Math.round(subtotal * restaurant.tax_rate * 100) / 100;
  const deliveryFee = order.orderType === "delivery" ? restaurant.delivery_fee : 0;
  const total = subtotal + tax + deliveryFee;

  // Create the order
  const { data: newOrder } = await supabase
    .from("orders")
    .insert({
      restaurant_id: call.restaurant_id,
      customer_id: customerId,
      call_id: call.id,
      order_type: order.orderType,
      status: "pending",
      delivery_address: order.deliveryAddress || null,
      subtotal,
      tax,
      delivery_fee: deliveryFee,
      total,
    })
    .select("id, order_number")
    .single();

  if (!newOrder) return;

  // Insert order items
  await supabase.from("order_items").insert(
    resolvedItems.map((item) => ({
      order_id: newOrder.id,
      ...item,
    }))
  );

  // Update call with order reference
  await supabase
    .from("calls")
    .update({ order_id: newOrder.id, customer_id: customerId })
    .eq("id", call.id);

  // Payment is collected at pickup/delivery — no payment link needed
}

async function handleCallAnalyzed(
  supabase: ReturnType<typeof createAdminClient>,
  callData: Record<string, unknown>
) {
  await supabase
    .from("calls")
    .update({ call_analysis: callData.call_analysis as unknown })
    .eq("retell_call_id", callData.call_id as string);
}

// ── Order extraction from transcript tool calls ──

interface TranscriptEntry {
  role: string;
  content: string;
  // Retell uses "tool_call_invocation" entries with this structure
  tool_call_invocation?: {
    tool_call_id: string;
    name: string;
    arguments: string; // JSON string
  };
  // Also handle array format for tool_calls
  tool_calls?: {
    function_name?: string;
    arguments?: Record<string, unknown>;
    function?: {
      name: string;
      arguments: string;
    };
  }[];
}

interface ExtractedOrder {
  orderType: "pickup" | "delivery";
  items: {
    name: string;
    quantity: number;
    modifiers: { group: string; option: string; price: number }[];
    specialInstructions?: string;
  }[];
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
}

function extractOrderFromTranscript(
  transcript: TranscriptEntry[] | null
): ExtractedOrder | null {
  if (!transcript) return null;

  const order: ExtractedOrder = {
    orderType: "pickup",
    items: [],
  };

  for (const entry of transcript) {
    // Handle Retell's tool_call_invocation format (individual entries)
    if (entry.tool_call_invocation) {
      const inv = entry.tool_call_invocation;
      let args: Record<string, unknown> = {};
      try {
        args = typeof inv.arguments === "string" ? JSON.parse(inv.arguments) : inv.arguments;
      } catch { /* ignore parse errors */ }
      processToolCall(inv.name, args, order);
      continue;
    }

    // Handle tool_calls array format
    if (!entry.tool_calls) continue;
    for (const toolCall of entry.tool_calls) {
      // Support both flat and nested formats
      const funcName = toolCall.function_name || toolCall.function?.name || "";
      let args: Record<string, unknown> = {};
      if (toolCall.arguments && typeof toolCall.arguments === "object") {
        args = toolCall.arguments;
      } else if (toolCall.function?.arguments) {
        try {
          args = typeof toolCall.function.arguments === "string"
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function.arguments;
        } catch { /* ignore parse errors */ }
      }
      processToolCall(funcName, args, order);
    }
  }

  return order.items.length > 0 ? order : null;
}

function processToolCall(
  funcName: string,
  args: Record<string, unknown>,
  order: ExtractedOrder
) {
  switch (funcName) {
    case "add_to_order":
      order.items.push({
        name: args.item_name as string,
        quantity: (args.quantity as number) || 1,
        modifiers: ((args.modifiers as { group: string; option: string; price?: number }[]) || []).map(
          (m) => ({ group: m.group, option: m.option, price: m.price || 0 })
        ),
        specialInstructions: args.special_instructions as string | undefined,
      });
      break;

    case "remove_from_order": {
      const removeName = (args.item_name as string).toLowerCase();
      order.items = order.items.filter(
        (i) => i.name.toLowerCase() !== removeName
      );
      break;
    }

    case "set_order_type":
      order.orderType = args.order_type as "pickup" | "delivery";
      break;

    case "set_delivery_address":
      order.deliveryAddress = args.address as string;
      break;

    case "set_customer_info":
      if (args.name) order.customerName = args.name as string;
      if (args.phone) order.customerPhone = args.phone as string;
      break;
  }
}

function findBestMenuItemMatch(
  name: string,
  menuItems: { id: string; name: string; base_price: number }[]
): { id: string; name: string; base_price: number } | null {
  const lower = name.toLowerCase().trim();

  // Exact match
  const exact = menuItems.find((m) => m.name.toLowerCase() === lower);
  if (exact) return exact;

  // Contains match
  const contains = menuItems.find(
    (m) =>
      m.name.toLowerCase().includes(lower) ||
      lower.includes(m.name.toLowerCase())
  );
  if (contains) return contains;

  // Word overlap match
  const nameWords = lower.split(/\s+/);
  let bestMatch: (typeof menuItems)[0] | null = null;
  let bestScore = 0;

  for (const item of menuItems) {
    const itemWords = item.name.toLowerCase().split(/\s+/);
    const overlap = nameWords.filter((w) => itemWords.includes(w)).length;
    const score = overlap / Math.max(nameWords.length, itemWords.length);
    if (score > bestScore && score > 0.3) {
      bestScore = score;
      bestMatch = item;
    }
  }

  return bestMatch;
}
