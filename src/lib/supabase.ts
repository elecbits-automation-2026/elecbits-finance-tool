import { createClient } from "@supabase/supabase-js";

// Vite exposes env vars prefixed with VITE_ to the browser.
// Set these in .env.local (see .env.example).
const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  // Fail loudly during development so a missing config isn't mistaken for a data bug.
  console.error(
    "Missing Supabase config. Create .env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example)."
  );
}

export const supabase = createClient(url ?? "", anonKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
