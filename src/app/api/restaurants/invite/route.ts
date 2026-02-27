import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

    const body = await request.json();
    const { restaurant_id, email, role } = body;

    if (!restaurant_id || !email || !role) {
      return NextResponse.json(
        { error: "restaurant_id, email, and role are required" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Verify the current user is an owner/manager of this restaurant
    const { data: currentMember } = await admin
      .from("restaurant_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("restaurant_id", restaurant_id)
      .single();

    if (!currentMember || !["owner", "manager"].includes(currentMember.role)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Look up the invited user by email using admin auth API
    const { data: usersData } = await admin.auth.admin.listUsers();
    const invitedUser = usersData?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!invitedUser) {
      return NextResponse.json(
        {
          error:
            "No account found with that email. They need to sign up first, then you can add them.",
        },
        { status: 404 }
      );
    }

    // Check if already a member
    const { data: existingMember } = await admin
      .from("restaurant_members")
      .select("id")
      .eq("restaurant_id", restaurant_id)
      .eq("user_id", invitedUser.id)
      .single();

    if (existingMember) {
      return NextResponse.json(
        { error: "This user is already a team member" },
        { status: 409 }
      );
    }

    // Create the membership
    const { error: insertError } = await admin
      .from("restaurant_members")
      .insert({
        restaurant_id,
        user_id: invitedUser.id,
        role,
      });

    if (insertError) {
      console.error("Failed to create membership:", insertError);
      return NextResponse.json(
        { error: "Failed to add team member" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, user_id: invitedUser.id });
  } catch (error) {
    console.error("Invite member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
