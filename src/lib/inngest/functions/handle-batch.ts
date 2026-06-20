import { inngest } from "@/lib/inngest";
import { planActions, executePlan } from "@/lib/planner";
import { getSupabase } from "@/lib/supabase";
import { transcribeAudio } from "@/lib/transcribe";

export const handleBatch = inngest.createFunction(
  {
    id: "handle-message-batch",
    triggers: [{ event: "message.batch_ready" }],
  },
  async ({ event, step }) => {
    const { contactId, messageIds } = event.data as { contactId: string; messageIds: string[] };

    const { data: messages } = await getSupabase()
      .from("raw_messages")
      .select("*")
      .in("id", messageIds)
      .order("created_at", { ascending: true });

    if (!messages || messages.length === 0) {
      return { status: "empty" };
    }

    for (const message of messages) {
      if (message.audio_url && !message.content) {
        const transcript = await step.run(`transcribe-${message.id}`, async () => transcribeAudio(message.audio_url as string));
        await getSupabase().from("raw_messages").update({ content: transcript }).eq("id", message.id);
        message.content = transcript;
      }
    }

    const [{ data: contact }, { data: recentMessages }, { data: openTasks }, { data: teamMembers }] = await Promise.all([
      getSupabase().from("contacts").select("*").eq("id", contactId).single(),
      getSupabase().from("raw_messages").select("content, created_at").eq("contact_id", contactId).order("created_at", { ascending: false }).limit(5),
      getSupabase().from("tasks").select("id, title, status").eq("contact_id", contactId).neq("status", "done").order("created_at", { ascending: false }).limit(10),
      getSupabase().from("team_members").select("id, name, team"),
    ]);

    const startedAt = Date.now();
    const plan = await step.run("planner", async () =>
      planActions({
        messageBatch: messages.map((message) => ({ content: message.content })),
        contact,
        recentMessages: recentMessages || [],
        openTasks: openTasks || [],
        teamMembers: teamMembers || [],
      }),
    );

    const { results } = await executePlan(plan, {
      messageId: messages[0]?.id,
      contactId,
      teamMembers: teamMembers || [],
    });

    await getSupabase().from("runs").insert({
      raw_message_id: messages[0]?.id,
      model: process.env.GROQ_PLANNER_MODEL || "llama-3.3-70b-versatile",
      plan_json: plan,
      outcome_json: { results },
      latency_ms: Date.now() - startedAt,
    });

    await getSupabase().from("raw_messages").update({ status: "extracted" }).in("id", messageIds);

    return { status: "ok", resultsCount: results.length };
  },
);
