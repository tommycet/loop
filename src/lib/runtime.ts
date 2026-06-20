import { getSupabase } from "./supabase";

export function hasSupabaseEnv() {
  if (process.env.FORCE_DEMO_MODE === "true") return false;
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function safeSupabase() {
  if (!hasSupabaseEnv()) {
    return null;
  }
  return getSupabase();
}

export function isForcedDemo() {
  return process.env.FORCE_DEMO_MODE === "true";
}
