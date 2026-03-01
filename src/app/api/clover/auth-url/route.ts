import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCloverAuthUrl } from "@/lib/clover/clover";

/**
 * POST /api/clover/auth-url
 *
 * Returns the Clover OAuth URL for the given restaurant.
 */
export async function POST(req: Request) {
    const serverClient = await createClient();
    const {
        data: { session },
    } = await serverClient.auth.getSession();

    if (!session?.user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { restaurantId } = await req.json();
    if (!restaurantId) {
        return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });
    }

    const url = getCloverAuthUrl(restaurantId);
    return NextResponse.json({ url });
}
