import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCloverCode } from "@/lib/clover/clover";

/**
 * GET /api/clover/callback
 *
 * Handles the Clover OAuth redirect. Exchanges the auth code for an access
 * token and stores it against the restaurant (passed via `state` param).
 */
export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const restaurantId = url.searchParams.get("state"); // we pass restaurant ID as state
    const merchantId = url.searchParams.get("merchant_id");

    if (!code || !restaurantId) {
        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/settings?clover=error&reason=missing_params`
        );
    }

    try {
        const { accessToken, merchantId: mId } = await exchangeCloverCode(code);

        const supabase = createAdminClient();
        await supabase
            .from("restaurants")
            .update({
                clover_merchant_id: merchantId || mId,
                clover_access_token: accessToken,
                menu_sync_source: "clover",
            })
            .eq("id", restaurantId);

        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/settings?clover=connected`
        );
    } catch (error) {
        console.error("Clover OAuth error:", error);
        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/settings?clover=error&reason=oauth_failed`
        );
    }
}
