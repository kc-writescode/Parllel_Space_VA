import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createPaymentLink } from "@/lib/stripe/client";

// POST /api/payments/create-link — create or regenerate a Stripe payment link for an order
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: member } = await admin
      .from("restaurant_members")
      .select("restaurant_id")
      .eq("user_id", user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: "No restaurant found" }, { status: 404 });
    }

    const body = await request.json();
    const { order_id } = body;

    if (!order_id) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    // Get order and verify it belongs to this restaurant
    const { data: order } = await admin
      .from("orders")
      .select("*, restaurants(name)")
      .eq("id", order_id)
      .eq("restaurant_id", member.restaurant_id)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.payment_status === "paid") {
      return NextResponse.json(
        { error: "Order is already paid" },
        { status: 400 }
      );
    }

    if (order.total <= 0) {
      return NextResponse.json(
        { error: "Order total must be greater than zero" },
        { status: 400 }
      );
    }

    // Get customer email if available
    let customerEmail: string | undefined;
    if (order.customer_id) {
      const { data: customer } = await admin
        .from("customers")
        .select("email")
        .eq("id", order.customer_id)
        .single();
      customerEmail = customer?.email || undefined;
    }

    const restaurantName =
      (order.restaurants as { name: string } | null)?.name || "Restaurant";

    const { url, sessionId } = await createPaymentLink({
      orderId: order.id,
      restaurantName,
      total: order.total,
      customerEmail,
    });

    // Update order with the new payment link
    await admin
      .from("orders")
      .update({
        stripe_payment_link_url: url,
        stripe_payment_link_id: sessionId,
        payment_status: "link_sent",
      })
      .eq("id", order_id);

    return NextResponse.json({ success: true, url, sessionId });
  } catch (error) {
    console.error("Create payment link error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
