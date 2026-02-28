import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRetellClient } from "@/lib/retell/client";

function mapStatus(callStatus: string, disconnection?: string | null): string {
  if (callStatus === "ongoing") return "in_progress";
  if (callStatus === "error") return "error";
  if (disconnection === "voicemail_reached") return "voicemail";
  return "completed";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { callId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch DB call record to get retell_call_id and verify ownership
  const { data: dbCall } = await supabase
    .from("calls")
    .select("id, retell_call_id, order_id, restaurant_id")
    .eq("id", callId)
    .single();

  if (!dbCall) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  const { data: member } = await supabase
    .from("restaurant_members")
    .select("restaurant_id")
    .eq("user_id", user.id)
    .eq("restaurant_id", dbCall.restaurant_id)
    .single();

  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  // Fetch fresh data from Retell
  const retell = getRetellClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rc: any = null;
  try {
    rc = await retell.call.retrieve(dbCall.retell_call_id);
  } catch (err) {
    console.error("Retell call.retrieve failed:", err);
  }

  // Fetch linked order + items
  let order = null;
  let orderItems = null;
  if (dbCall.order_id) {
    const { data: orderData } = await supabase
      .from("orders")
      .select(
        "id, order_number, total, subtotal, tax, delivery_fee, status, payment_status, order_type, delivery_address"
      )
      .eq("id", dbCall.order_id)
      .single();
    order = orderData;

    const { data: items } = await supabase
      .from("order_items")
      .select("id, name, quantity, unit_price, item_total, modifiers, special_instructions")
      .eq("order_id", dbCall.order_id);
    orderItems = items;
  }

  return NextResponse.json({
    id: dbCall.id,
    retell_call_id: dbCall.retell_call_id,
    caller_phone: rc?.from_number ?? null,
    status: rc ? mapStatus(rc.call_status, rc.disconnection_reason) : "completed",
    started_at: rc?.start_timestamp
      ? new Date(rc.start_timestamp).toISOString()
      : null,
    ended_at: rc?.end_timestamp
      ? new Date(rc.end_timestamp).toISOString()
      : null,
    duration_ms: rc?.duration_ms ?? null,
    recording_url: rc?.recording_url ?? null,
    transcript: rc?.transcript_object ?? null,
    call_analysis: rc?.call_analysis ?? null,
    disconnection_reason: rc?.disconnection_reason ?? null,
    order,
    order_items: orderItems,
  });
}
