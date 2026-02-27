import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scrapeMenuFromUrl } from "@/lib/scraper";
import { scrapeMenuSchema } from "@/lib/utils/validators";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { url } = scrapeMenuSchema.parse(body);

    const menu = await scrapeMenuFromUrl(url);

    return NextResponse.json({ menu });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to scrape menu";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
