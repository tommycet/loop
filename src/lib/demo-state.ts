import type { ApprovalRequest, AuditEvent, AuthorityRule, Commitment, Contact, FollowUp, RawMessage, Task } from "../types";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  DEMO_APPROVAL_REQUESTS,
  DEMO_AUDIT_EVENTS,
  DEMO_COMMITMENTS,
  DEFAULT_AUTHORITY_RULES,
} from "./commitments";

export type DemoState = {
  messages: RawMessage[];
  tasks: Task[];
  approvals: FollowUp[];
  contacts: Contact[];
  commitments: Commitment[];
  approvalRequests: ApprovalRequest[];
  auditEvents: AuditEvent[];
  authorityRules: AuthorityRule[];
};

const stateDir = path.join(process.cwd(), ".demo-state");
const statePath = path.join(stateDir, "loop-demo-state.json");

function buildInitialState(): DemoState {
  const now = Date.now();

  return {
    messages: [
      {
        id: "msg-demo-1",
        contact_id: "contact-ali",
        external_id: "demo-whatsapp-1",
        channel: "whatsapp",
        direction: "inbound",
        content: "Need a quote for 20 office chairs by Friday. Deliver to DHA Lahore.",
        status: "extracted",
        raw_payload: {},
        created_at: new Date(now).toISOString(),
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
        created_at: new Date(now - 1000 * 60 * 12).toISOString(),
      },
      {
        id: "msg-demo-3",
        contact_id: "contact-ali",
        external_id: "demo-whatsapp-3",
        channel: "whatsapp",
        direction: "inbound",
        content: "Need urgent 20 chairs by Friday and a discount if I pay today.",
        status: "extracted",
        raw_payload: {},
        created_at: new Date(now - 1000 * 60 * 8).toISOString(),
      },
      {
        id: "msg-demo-4",
        contact_id: "contact-ali",
        external_id: "demo-voice-1",
        channel: "voice",
        direction: "inbound",
        content: "Tell him Friday for sure. Stock is short but we'll manage.",
        status: "extracted",
        raw_payload: { transcript: "Tell him Friday for sure. Stock is short but we'll manage." },
        created_at: new Date(now - 1000 * 60 * 25).toISOString(),
      },
      {
        id: "msg-demo-5",
        contact_id: "contact-ali",
        external_id: "demo-whatsapp-5",
        channel: "whatsapp",
        direction: "inbound",
        content: "Payment sent. [image: payment_screenshot.png]",
        status: "extracted",
        raw_payload: {},
        created_at: new Date(now - 1000 * 60 * 35).toISOString(),
      },
      {
        id: "msg-demo-6",
        contact_id: "contact-ali",
        external_id: "demo-whatsapp-6",
        channel: "whatsapp",
        direction: "inbound",
        content: "This is the second time you promised Friday and missed. If it slips again I'm cancelling.",
        status: "review_needed",
        raw_payload: {},
        created_at: new Date(now - 1000 * 60 * 5).toISOString(),
      },
    ],
    tasks: [
      {
        id: "task-demo-1",
        raw_message_id: "msg-demo-1",
        contact_id: "contact-ali",
        title: "Prepare quote for 20 office chairs",
        description: "Customer expects turnaround before Friday dispatch planning.",
        status: "open",
        priority: "high",
        owner_id: "11111111-1111-1111-1111-111111111111",
        due_at: new Date(now + 1000 * 60 * 60 * 4).toISOString(),
        source_url: null,
        plan_snapshot: {},
        created_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString(),
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
        due_at: new Date(now + 1000 * 60 * 60 * 2).toISOString(),
        source_url: null,
        plan_snapshot: {},
        created_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString(),
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
        due_at: new Date(now - 1000 * 60 * 30).toISOString(),
        source_url: null,
        plan_snapshot: {},
        created_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString(),
      },
    ],
    approvals: [
      {
        id: "approval-demo-1",
        task_id: "task-demo-3",
        scheduled_at: new Date(now).toISOString(),
        sent_at: null,
        escalation_level: 1,
        channel: "app",
        message_draft: "Finance reminder: please confirm the clinic billing packet before 5 PM.",
        status: "scheduled",
        created_at: new Date(now).toISOString(),
      },
    ],
    contacts: [
      {
        id: "contact-ali",
        name: "Ali Traders",
        phone: "+923001234567",
        email: null,
        metadata: { source: "whatsapp", location: "DHA Lahore" },
        created_at: new Date(now).toISOString(),
      },
      {
        id: "contact-clinic",
        name: "City Clinic Admin",
        phone: null,
        email: "admin@cityclinic.pk",
        metadata: { source: "email", type: "clinic" },
        created_at: new Date(now - 1000 * 60 * 12).toISOString(),
      },
      {
        id: "contact-demo",
        name: "Demo Contact",
        phone: null,
        email: null,
        metadata: { source: "manual" },
        created_at: new Date(now).toISOString(),
      },
    ],
    commitments: DEMO_COMMITMENTS,
    approvalRequests: DEMO_APPROVAL_REQUESTS,
    auditEvents: DEMO_AUDIT_EVENTS,
    authorityRules: DEFAULT_AUTHORITY_RULES,
  };
}

export function readDemoState(): DemoState {
  if (!fs.existsSync(statePath)) {
    const initial = buildInitialState();
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(initial, null, 2));
    return initial;
  }

  const persisted = JSON.parse(fs.readFileSync(statePath, "utf8")) as Partial<DemoState>;
  const initial = buildInitialState();
  // Merge: keep persisted data but fill in any fields added after initial write
  return {
    messages: persisted.messages ?? initial.messages,
    tasks: persisted.tasks ?? initial.tasks,
    approvals: persisted.approvals ?? initial.approvals,
    contacts: persisted.contacts ?? initial.contacts,
    commitments: persisted.commitments ?? initial.commitments,
    approvalRequests: persisted.approvalRequests ?? initial.approvalRequests,
    auditEvents: persisted.auditEvents ?? initial.auditEvents,
    authorityRules: persisted.authorityRules ?? initial.authorityRules,
  };
}

export function writeDemoState(state: DemoState): DemoState {
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  return state;
}

export function getDemoDashboard(state: DemoState) {
  const overdue = state.tasks.filter((task) => task.due_at && new Date(task.due_at).getTime() < Date.now() && task.status !== "done").length;
  const openCommitments = state.commitments.filter((c) => c.status !== "closed" && c.status !== "executed").length;
  const pendingApprovals = state.approvalRequests.filter((a) => a.decision === "pending").length;
  return {
    messages: state.messages.length,
    openTasks: state.tasks.filter((task) => task.status !== "done").length,
    approvals: state.approvals.filter((approval) => approval.status === "scheduled").length,
    overdue,
    openCommitments,
    pendingApprovals,
  };
}
