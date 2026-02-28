import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRetellClient } from "@/lib/retell/client";

function mapStatus(callStatus: string, disconnection?: string | null): string {
  if (callStatus === "ongoing") return "in_progress";
  if (callStatus === "error") return "error";
  if (disconnection === "voicemail_reached") return "voicemail";
  return "completed";
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("restaurant_members")
    .select("restaurant_id")
    .eq("user_id", user.id)
    .single();
  if (!member) return NextResponse.json({ error: "No restaurant" }, { status: 404 });

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, retell_agent_id")
    .eq("id", member.restaurant_id)
    .single();

  if (!restaurant?.retell_agent_id) {
    return NextResponse.json({ calls: [], nextCursor: null });
  }

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor") || undefined;

  const retell = getRetellClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let retellCalls: any[] = [];
  try {
    retellCalls = await retell.call.list({
      filter_criteria: { agent_id: [restaurant.retell_agent_id] },
      sort_order: "descending",
      limit: 25,
      ...(cursor ? { pagination_key: cursor } : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  } catch (err) {
    console.error("Retell call.list failed:", err);
    return NextResponse.json({ calls: [], nextCursor: null });
  }

  if (!retellCalls.length) return NextResponse.json({ calls: [], nextCursor: null });

  // Enrich with DB records (for DB UUID + order link)
  const retellIds = retellCalls.map((c) => c.call_id);
  const { data: dbCalls } = await supabase
    .from("calls")
    .select("id, retell_call_id, order_id")
    .in("retell_call_id", retellIds);

  const dbMap = new Map(dbCalls?.map((c) => [c.retell_call_id, c]) || []);

  const orderIds = (dbCalls || [])
    .filter((c) => c.order_id)
    .map((c) => c.order_id as string);

  const orderMap = new Map<string, {
    id: string;
    order_number: number;
    total: number;
    status: string;
    payment_status: string;
    order_type: string;
  }>();

  if (orderIds.length) {
    const { data: orders } = await supabase
      .from("orders")
      .select("id, order_number, total, status, payment_status, order_type")
      .in("id", orderIds);
    orders?.forEach((o) => orderMap.set(o.id, o));
  }

  const calls = retellCalls.map((rc) => {
    const db = dbMap.get(rc.call_id);
    const order = db?.order_id ? orderMap.get(db.order_id) ?? null : null;
    return {
      id: db?.id ?? null,
      retell_call_id: rc.call_id,
      caller_phone: rc.from_number ?? null,
      status: mapStatus(rc.call_status, rc.disconnection_reason),
      started_at: rc.start_timestamp
        ? new Date(rc.start_timestamp).toISOString()
        : null,
      duration_ms: rc.duration_ms ?? null,
      recording_url: rc.recording_url ?? null,
      transcript: rc.transcript_object ?? null,
      call_analysis: rc.call_analysis ?? null,
      disconnection_reason: rc.disconnection_reason ?? null,
      order,
    };
  });

  const nextCursor =
    retellCalls.length === 25
      ? retellCalls[retellCalls.length - 1].call_id
      : null;

  return NextResponse.json({ calls, nextCursor });
}
