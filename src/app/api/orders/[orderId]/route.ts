import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/orders/[orderId]
 * Fetch a single order with items, customer, and call data.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Get the user's restaurant
    const { data: member } = await admin
      .from("restaurant_members")
      .select("restaurant_id")
      .eq("user_id", user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: "No restaurant found" }, { status: 404 });
    }

    // Fetch the order with joins
    const { data: order, error } = await admin
      .from("orders")
      .select("*, order_items(*), customer:customers(*), call:calls(*)")
      .eq("id", orderId)
      .eq("restaurant_id", member.restaurant_id)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error("Order GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
