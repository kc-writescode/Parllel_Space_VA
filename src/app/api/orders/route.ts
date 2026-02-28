import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// GET /api/orders — list orders for the user's restaurant
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session: getSession } } = await supabase.auth.getSession();
    const user = getSession?.user ?? null;

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

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    let query = admin
      .from("orders")
      .select("*, order_items(*), customers(*)", { count: "exact" })
      .eq("restaurant_id", member.restaurant_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: orders, error, count } = await query;

    if (error) {
      console.error("Failed to fetch orders:", error);
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
    }

    return NextResponse.json({ orders, total: count });
  } catch (error) {
    console.error("Orders GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/orders — create a manual order from the dashboard
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session: postSession } } = await supabase.auth.getSession();
    const user = postSession?.user ?? null;

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
    const {
      order_type,
      items,
      customer_name,
      customer_phone,
      delivery_address,
      delivery_notes,
    } = body;

    if (!order_type || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "order_type and items are required" },
        { status: 400 }
      );
    }

    // Get restaurant for tax/delivery config
    const { data: restaurant } = await admin
      .from("restaurants")
      .select("*")
      .eq("id", member.restaurant_id)
      .single();

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    // Create or find customer if phone provided
    let customerId: string | null = null;
    if (customer_phone) {
      const { data: existing } = await admin
        .from("customers")
        .select("id")
        .eq("phone", customer_phone)
        .eq("restaurant_id", restaurant.id)
        .single();

      if (existing) {
        customerId = existing.id;
        if (customer_name) {
          await admin
            .from("customers")
            .update({ name: customer_name })
            .eq("id", existing.id);
        }
      } else {
        const { data: newCustomer } = await admin
          .from("customers")
          .insert({
            phone: customer_phone,
            name: customer_name || null,
            restaurant_id: restaurant.id,
          })
          .select("id")
          .single();
        customerId = newCustomer?.id || null;
      }
    }

    // Calculate totals
    const subtotal = items.reduce(
      (sum: number, item: { unit_price: number; quantity: number }) =>
        sum + item.unit_price * item.quantity,
      0
    );
    const tax = Math.round(subtotal * restaurant.tax_rate * 100) / 100;
    const deliveryFee = order_type === "delivery" ? restaurant.delivery_fee : 0;
    const total = subtotal + tax + deliveryFee;

    // Create order
    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        restaurant_id: restaurant.id,
        customer_id: customerId,
        order_type,
        status: "pending",
        delivery_address: delivery_address || null,
        delivery_notes: delivery_notes || null,
        subtotal,
        tax,
        delivery_fee: deliveryFee,
        total,
      })
      .select("id, order_number")
      .single();

    if (orderError || !order) {
      console.error("Failed to create order:", orderError);
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    // Insert order items
    const orderItems = items.map(
      (item: {
        menu_item_id?: string;
        name: string;
        quantity: number;
        unit_price: number;
        modifiers?: unknown;
        special_instructions?: string;
      }) => ({
        order_id: order.id,
        menu_item_id: item.menu_item_id || null,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        item_total: item.unit_price * item.quantity,
        modifiers: item.modifiers || [],
        special_instructions: item.special_instructions || null,
      })
    );

    const { error: itemsError } = await admin.from("order_items").insert(orderItems);

    if (itemsError) {
      console.error("Failed to insert order items:", itemsError);
    }

    return NextResponse.json({
      success: true,
      order_id: order.id,
      order_number: order.order_number,
      total,
    });
  } catch (error) {
    console.error("Orders POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/orders — update order status
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session: patchSession } } = await supabase.auth.getSession();
    const user = patchSession?.user ?? null;

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
    const { order_id, status, payment_status } = body;

    if (!order_id) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    // Verify order belongs to this restaurant
    const { data: order } = await admin
      .from("orders")
      .select("id, restaurant_id")
      .eq("id", order_id)
      .eq("restaurant_id", member.restaurant_id)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Build update object with timestamps
    const update: Record<string, unknown> = {};

    if (status) {
      update.status = status;
      const now = new Date().toISOString();
      if (status === "confirmed") update.confirmed_at = now;
      if (status === "ready") update.ready_at = now;
      if (status === "completed") update.completed_at = now;
      if (status === "cancelled") update.cancelled_at = now;
    }

    if (payment_status) {
      update.payment_status = payment_status;
      if (payment_status === "paid") update.paid_at = new Date().toISOString();
    }

    const { error: updateError } = await admin
      .from("orders")
      .update(update)
      .eq("id", order_id);

    if (updateError) {
      console.error("Failed to update order:", updateError);
      return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
    }

    void (async () => {
      try {
        await admin.from("audit_logs").insert({
          restaurant_id: member.restaurant_id,
          user_id: user.id,
          action: "order.status_changed",
          entity_type: "order",
          entity_id: order_id,
          metadata: { status, payment_status },
        });
      } catch (_) { /* non-blocking */ }
    })();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Orders PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
