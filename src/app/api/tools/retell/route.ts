import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/tools/retell
 *
 * Receives tool calls from Retell AI during a live call.
 * Returns a simple acknowledgement so the AI can continue.
 * The actual order data is extracted from the transcript after the call ends
 * via the /api/webhooks/retell handler.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const toolName = body.name as string;
  const args = body.args as Record<string, unknown>;

  // Respond with a confirmation message so the AI can continue naturally
  const responses: Record<string, string> = {
    add_to_order: `Added ${args?.quantity || 1}x ${args?.item_name} to the order.`,
    remove_from_order: `Removed ${args?.item_name} from the order.`,
    get_order_summary: "Order summary noted.",
    set_order_type: `Order type set to ${args?.order_type}.`,
    set_delivery_address: `Delivery address set to ${args?.address}.`,
    set_customer_info: `Customer info recorded.`,
  };

  return NextResponse.json({
    result: responses[toolName] || "Done.",
  });
}
