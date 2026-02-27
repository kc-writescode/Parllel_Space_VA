import { createBrowserClient } from "@supabase/ssr";

// When you connect your Supabase project, generate types with:
// npx supabase gen types typescript --project-id <your-project-id> > src/types/database.ts
// Then add the generic back: createBrowserClient<Database>(...)

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
