import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

// Database types live in ./database.types.ts — use them for explicit type
// annotations at query sites. The @supabase/ssr 0.5.x type definitions import
// from a non-existent path in supabase-js v2, breaking GenericSchema constraint
// resolution, so we don't pass the Database generic to the client directly.
export function createClient() {
  return createBrowserClient(env.supabase.url, env.supabase.anonKey);
}
