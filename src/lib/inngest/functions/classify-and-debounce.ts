import { inngest } from "@/lib/inngest";
import { classifyMessage } from "@/lib/classifier";
import { getSupabase } from "@/lib/supabase";
import { isDemoMode } from "@/lib/utils";

export const classifyAndDebounce = inngest.createFunction(
  {
    id: "classify-and-debounce",
    triggers: [{ event: "message.received" }],
    debounce: {
      key: "event.data.contactId",
      period: isDemoMode() ? "3s" : "30s",
      timeout: isDemoMode() ? "5s" : "60s",
    },
  },
  async ({ event, step }) => {
    const messageId = event.data.messageId as string;
    const contactId = event.data.contactId as string;

    const { data: message } = await getSupabase()
      .from("raw_messages")
      .select("*")
      .eq("id", messageId)
      .single();

    if (!message) {
      throw new Error("Message not found");
    }

    const classification = await step.run("classify-message", async () => {
      return classifyMessage(message.content || "");
    });

    if (classification === "noise") {
      await getSupabase().from("raw_messages").update({ status: "noise" }).eq("id", messageId);
      return { status: "noise" };
    }

    const { data: pendingMessages } = await getSupabase()
      .from("raw_messages")
      .select("id")
      .eq("contact_id", contactId)
      .eq("status", "pending")
      .eq("direction", "inbound")
      .order("created_at", { ascending: true });

    await inngest.send({
      name: "message.batch_ready",
      data: {
        contactId,
        messageIds: pendingMessages?.map((item) => item.id) || [messageId],
      },
    });

    return {
      status: "batched",
      count: pendingMessages?.length || 1,
    };
  },
);
