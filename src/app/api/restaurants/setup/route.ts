import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function getAuthenticatedUser() {
  const supabase = await createClient();
  // Use getSession() to read the user from the cookie-based JWT without a
  // network roundtrip. getUser() makes a Supabase server call which can
  // timeout in certain network environments.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user ?? null;
}

/**
 * POST /api/restaurants/setup
 *
 * Creates a restaurant and owner membership for the authenticated user.
 * Uses the admin client to bypass RLS.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { restaurant_name } = body;

    const admin = createAdminClient();

    // Always check for existing restaurant first (bypasses RLS via admin client)
    const { data: existingMember } = await admin
      .from("restaurant_members")
      .select("restaurant_id")
      .eq("user_id", user.id)
      .single();

    if (existingMember) {
      // User already has a restaurant — return it regardless of restaurant_name
      const { data: existingRestaurant } = await admin
        .from("restaurants")
        .select("*")
        .eq("id", existingMember.restaurant_id)
        .single();

      return NextResponse.json({ restaurant: existingRestaurant });
    }

    // No existing restaurant — restaurant_name is required to create one
    if (!restaurant_name) {
      return NextResponse.json(
        { error: "Restaurant name is required" },
        { status: 400 }
      );
    }

    // Create restaurant using admin client (bypasses RLS)
    const slug =
      restaurant_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") +
      "-" +
      Date.now().toString(36);

    const { data: restaurant, error: restaurantError } = await admin
      .from("restaurants")
      .insert({ name: restaurant_name, slug })
      .select()
      .single();

    if (restaurantError || !restaurant) {
      console.error("Failed to create restaurant:", restaurantError);
      return NextResponse.json(
        { error: "Failed to create restaurant" },
        { status: 500 }
      );
    }

    // Create owner membership
    const { error: memberError } = await admin
      .from("restaurant_members")
      .insert({
        restaurant_id: restaurant.id,
        user_id: user.id,
        role: "owner",
      });

    if (memberError) {
      console.error("Failed to create membership:", memberError);
      // Clean up the restaurant we just created
      await admin.from("restaurants").delete().eq("id", restaurant.id);
      return NextResponse.json(
        { error: "Failed to set up account" },
        { status: 500 }
      );
    }

    return NextResponse.json({ restaurant });
  } catch (error) {
    console.error("Restaurant setup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/restaurants/setup
 *
 * Updates restaurant fields. Uses admin client to bypass RLS.
 * Verifies the user is a member of the restaurant before allowing updates.
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { restaurant_id, ...updates } = body;

    if (!restaurant_id) {
      return NextResponse.json(
        { error: "restaurant_id is required" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Verify user is a member of this restaurant
    const { data: member } = await admin
      .from("restaurant_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("restaurant_id", restaurant_id)
      .single();

    if (!member) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { data: restaurant, error } = await admin
      .from("restaurants")
      .update(updates)
      .eq("id", restaurant_id)
      .select()
      .single();

    if (error) {
      console.error("Failed to update restaurant:", error);
      return NextResponse.json(
        { error: "Failed to update restaurant" },
        { status: 500 }
      );
    }

    return NextResponse.json({ restaurant });
  } catch (error) {
    console.error("Restaurant update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
