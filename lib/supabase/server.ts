import { NextRequest } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

/**
 * Builds a Supabase client that acts as the signed-in user (so row-level security
 * applies) from the request's "Authorization: Bearer <access token>" header.
 */
export async function supabaseForRequest(req: NextRequest): Promise<{ supabase: SupabaseClient; user: User } | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { global: { headers: { Authorization: "Bearer " + token } } }
  );
  const { data } = await supabase.auth.getUser(token);
  if (!data.user) return null;
  return { supabase, user: data.user };
}
