import { inngest } from "@/lib/inngest";
import { getSupabase } from "@/lib/supabase";

export const onTaskCreated = inngest.createFunction(
  {
    id: "on-task-created",
    triggers: [{ event: "task.created" }],
  },
  async ({ event }) => {
    const taskId = event.data.taskId as string;

    await getSupabase().from("follow_ups").insert({
      task_id: taskId,
      scheduled_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      channel: "app",
      message_draft: "Reminder: follow up on this task.",
    });

    return { status: "scheduled" };
  },
);

export const escalationCheck = inngest.createFunction(
  {
    id: "escalation-check",
    triggers: [{ cron: "0 * * * *" }],
  },
  async () => {
    const { data: overdue } = await getSupabase()
      .from("tasks")
      .select("id, title")
      .lt("due_at", new Date().toISOString())
      .neq("status", "done");

    for (const task of overdue || []) {
      await getSupabase().from("follow_ups").insert({
        task_id: task.id,
        scheduled_at: new Date().toISOString(),
        escalation_level: 1,
        channel: "app",
        message_draft: `Escalated: ${task.title}`,
      });
    }

    return { status: "checked", count: overdue?.length || 0 };
  },
);
