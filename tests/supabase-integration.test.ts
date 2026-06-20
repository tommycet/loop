import "dotenv/config";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { resolveAuthority } from "../src/lib/authority";
import { classifyRisk } from "../src/lib/risk";
import { DEFAULT_AUTHORITY_RULES } from "../src/lib/commitments";
import { getSupabase } from "../src/lib/supabase";
import { hasSupabaseEnv } from "../src/lib/runtime";

const RUN = process.env.RUN_SUPABASE_TESTS === "1";

describe.skipIf(!RUN || !hasSupabaseEnv())(
  "Supabase integration: end-to-end commitment flow",
  () => {
    const supabase = getSupabase();
    const tag = `test-${Date.now()}`;
    let commitmentId = "";
    let approvalId = "";

    beforeAll(async () => {
      // Create a contact for the test.
      const { data: contact, error: cErr } = await supabase
        .from("contacts")
        .insert({ name: `Test Contact ${tag}`, phone: `+1999${tag.slice(-6)}`, metadata: { test: true } })
        .select()
        .single();
      if (cErr || !contact) throw cErr ?? new Error("contact insert failed");
      // Store the id on the closure via a side-channel.
      (globalThis as { __testContactId?: string }).__testContactId = contact.id;
    });

    afterAll(async () => {
      const contactId = (globalThis as { __testContactId?: string }).__testContactId;
      if (contactId) await supabase.from("contacts").delete().eq("id", contactId);
      if (commitmentId) await supabase.from("commitments").delete().eq("id", commitmentId);
      if (approvalId) await supabase.from("approval_requests").delete().eq("id", approvalId);
    });

    it("creates a commitment, routes approval, decides, executes, and writes audit", async () => {
      const contactId = (globalThis as { __testContactId?: string }).__testContactId!;

      // 1. Insert commitment.
      const tier = classifyRisk({
        type: "discount_offer",
        text: "10% off if paid today",
        normalizedObbligation: { discountPct: 10, actorRole: "sales" },
      });
      const { data: cmt, error: cmtErr } = await supabase
        .from("commitments")
        .insert({
          contact_id: contactId,
          type: "discount_offer",
          extracted_text: "10% off if paid today",
          normalized_obligation: { discountPct: 10, actorRole: "sales" },
          risk_tier: tier,
          status: "detected",
          confidence: 0.9,
          evidence: { transcript: ["Customer asked for 10% off"] },
        })
        .select()
        .single();
      expect(cmtErr).toBeNull();
      expect(cmt).toBeTruthy();
      commitmentId = cmt.id;

      // 2. Route approval.
      const decision = resolveAuthority(
        { actionType: "discount_offer", riskTier: tier, actorRole: "sales", discountPct: 10 },
        DEFAULT_AUTHORITY_RULES,
      );
      expect(decision.required_role).toBe("admin");

      const { data: approval, error: appErr } = await supabase
        .from("approval_requests")
        .insert({
          commitment_id: commitmentId,
          required_role: decision.required_role,
          decision: "pending",
          proposed_action: { body: "We can confirm 10% off if paid today." },
        })
        .select()
        .single();
      expect(appErr).toBeNull();
      approvalId = approval.id;

      await supabase
        .from("commitments")
        .update({ status: "needs_approval", required_role: "admin" })
        .eq("id", commitmentId);

      // 3. Approve with edits.
      const { error: decErr } = await supabase
        .from("approval_requests")
        .update({
          decision: "edited",
          edited_action: { body: "We can confirm 7% off if paid today." },
          decision_reason: "discount capped per policy",
          decided_at: new Date().toISOString(),
        })
        .eq("id", approvalId);
      expect(decErr).toBeNull();

      await supabase
        .from("commitments")
        .update({ status: "approved" })
        .eq("id", commitmentId);

      // 4. Write audit events.
      await supabase.from("audit_events").insert([
        {
          entity_type: "commitment",
          entity_id: commitmentId,
          event_type: "route_approval",
          actor_type: "ai",
          payload: { required_role: "admin" },
        },
        {
          entity_type: "approval",
          entity_id: approvalId,
          event_type: "approval_edited",
          actor_type: "human",
          payload: { edited_action: { body: "7% off" } },
        },
      ]);

      // 5. Verify the proof chain.
      const { data: audit } = await supabase
        .from("audit_events")
        .select("*")
        .or(`entity_id.eq.${commitmentId},entity_id.eq.${approvalId}`)
        .order("created_at", { ascending: true });
      expect((audit ?? []).length).toBeGreaterThanOrEqual(2);

      const { data: refreshed } = await supabase
        .from("commitments")
        .select("status,required_role")
        .eq("id", commitmentId)
        .single();
      expect(refreshed?.status).toBe("approved");
      expect(refreshed?.required_role).toBe("admin");

      const { data: refreshedApproval } = await supabase
        .from("approval_requests")
        .select("decision,edited_action,decision_reason")
        .eq("id", approvalId)
        .single();
      expect(refreshedApproval?.decision).toBe("edited");
      expect(refreshedApproval?.edited_action).toMatchObject({ body: "We can confirm 7% off if paid today." });
    });
  },
);