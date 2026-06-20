import dotenv from "dotenv";
import * as path from "node:path";

// Load .env.local explicitly since vitest doesn't pick up Next.js env files automatically.
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Force demo mode for tool-handler unit tests so they exercise the in-memory
// branch instead of touching live Supabase. The Supabase integration test
// imports getSupabase() directly and bypasses safeSupabase(), but hasSupabaseEnv()
// also short-circuits when FORCE_DEMO_MODE is set, so unset it for that test.
if (process.env.RUN_SUPABASE_TESTS !== "1") {
  process.env.FORCE_DEMO_MODE = "true";
} else {
  delete process.env.FORCE_DEMO_MODE;
}