import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Surfaced clearly at build/runtime instead of a cryptic client error.
  console.warn(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY — set them in .env.local"
  );
}

// One shared browser client. Auth session is persisted in localStorage
// by default, which is what lets a rep stay logged in between visits.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
