// src/lib/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// Publishable key memang boleh terlihat di browser: aksesnya dibatasi RLS (aturan
// akses per baris di database). Key server (service role) hanya ada di Edge Function.
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
