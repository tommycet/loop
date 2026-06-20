import type { FollowUp, RawMessage, Task } from "@/types";

export const demoMessages: RawMessage[] = [
  {
    id: "msg-demo-1",
    contact_id: "contact-ali",
    external_id: "demo-whatsapp-1",
    channel: "whatsapp",
    direction: "inbound",
    content: "Need a quote for 20 office chairs by Friday. Deliver to DHA Lahore.",
    status: "extracted",
    raw_payload: {},
    created_at: new Date().toISOString(),
  },
  {
    id: "msg-demo-2",
    contact_id: "contact-clinic",
    external_id: "demo-email-1",
    channel: "email",
    direction: "inbound",
    content: "Reminder: confirm tomorrow's appointment batch and billing notes.",
    status: "pending",
    raw_payload: {},
    created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
];

export const demoTasks: Task[] = [
  {
    id: "task-demo-1",
    raw_message_id: "msg-demo-1",
    contact_id: "contact-ali",
    title: "Prepare quote for 20 office chairs",
    description: "Customer expects turnaround before Friday dispatch planning.",
    status: "open",
    priority: "high",
    owner_id: "11111111-1111-1111-1111-111111111111",
    due_at: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
    source_url: null,
    plan_snapshot: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "task-demo-2",
    raw_message_id: "msg-demo-2",
    contact_id: "contact-clinic",
    title: "Confirm clinic billing packet",
    description: "Ops should verify tomorrow's patient block and payment notes.",
    status: "in_progress",
    priority: "medium",
    owner_id: "22222222-2222-2222-2222-222222222222",
    due_at: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(),
    source_url: null,
    plan_snapshot: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "task-demo-3",
    raw_message_id: "msg-demo-2",
    contact_id: "contact-clinic",
    title: "Send finance follow-up",
    description: "Agent drafted a reminder, waiting for human approval.",
    status: "open",
    priority: "critical",
    owner_id: "33333333-3333-3333-3333-333333333333",
    due_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    source_url: null,
    plan_snapshot: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const demoApprovals: FollowUp[] = [
  {
    id: "approval-demo-1",
    task_id: "task-demo-3",
    scheduled_at: new Date().toISOString(),
    sent_at: null,
    escalation_level: 1,
    channel: "app",
    message_draft: "Finance reminder: please confirm the clinic billing packet before 5 PM.",
    status: "scheduled",
    created_at: new Date().toISOString(),
  },
];

export function getDemoDashboard() {
  const overdue = demoTasks.filter((task) => task.due_at && new Date(task.due_at).getTime() < Date.now() && task.status !== "done").length;
  return {
    messages: demoMessages.length,
    openTasks: demoTasks.filter((task) => task.status !== "done").length,
    approvals: demoApprovals.length,
    overdue,
  };
}
