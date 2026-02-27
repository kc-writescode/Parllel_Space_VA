import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendPaymentLinkSMS } from "@/lib/sms/twilio";
import { formatCurrency } from "@/lib/utils/formatters";

// POST /api/payments/send-sms — send (or resend) the payment link SMS for an order
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
    const { order_id, phone_override } = body;

    if (!order_id) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    // Get order with customer and restaurant info
    const { data: order } = await admin
      .from("orders")
      .select("*, customers(*), restaurants(name)")
      .eq("id", order_id)
      .eq("restaurant_id", member.restaurant_id)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!order.stripe_payment_link_url) {
      return NextResponse.json(
        { error: "No payment link exists for this order. Create one first." },
        { status: 400 }
      );
    }

    if (order.payment_status === "paid") {
      return NextResponse.json(
        { error: "Order is already paid" },
        { status: 400 }
      );
    }

    // Determine phone number: use override, or customer's phone
    const customer = order.customers as { phone: string; name: string | null } | null;
    const phone = phone_override || customer?.phone;

    if (!phone) {
      return NextResponse.json(
        { error: "No phone number available. Provide phone_override or ensure the order has a customer with a phone number." },
        { status: 400 }
      );
    }

    const restaurantName =
      (order.restaurants as { name: string } | null)?.name || "Restaurant";

    const messageSid = await sendPaymentLinkSMS({
      to: phone,
      customerName: customer?.name || "there",
      orderNumber: order.order_number,
      restaurantName,
      total: formatCurrency(order.total),
      paymentUrl: order.stripe_payment_link_url,
    });

    return NextResponse.json({ success: true, message_sid: messageSid });
  } catch (error) {
    console.error("Send SMS error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
