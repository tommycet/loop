import { NextRequest, NextResponse } from "next/server";
import { readDemoState, writeDemoState, type DemoState } from "../../../../lib/demo-state";
import { safeSupabase, hasSupabaseEnv, isForcedDemo } from "../../../../lib/runtime";
import { classifyMessage } from "../../../../lib/classifier";
import { planActions, executePlanDemo } from "../../../../lib/planner";
import { inngest } from "../../../../lib/inngest";
import type { RawMessage, Task, FollowUp, Contact, MessageStatus, TaskStatus, Priority } from "../../../../types";

export const dynamic = "force-dynamic";

const TEAM_MEMBERS = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Sarah (Sales)", team: "sales" as const },
  { id: "22222222-2222-2222-2222-222222222222", name: "Omar (Ops)", team: "operations" as const },
  { id: "33333333-3333-3333-3333-333333333333", name: "Fatima (Finance)", team: "finance" as const },
  { id: "44444444-4444-4444-4444-444444444444", name: "Ahmed (Admin)", team: "admin" as const },
];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  // Accept multiple field names for flexibility
  const content = body.content || body.message || body.text || "Test message from Loop";
  const phone = body.phone || "+923****4567";
  const name = body.name || body.contactName || "Test Contact";
  const channel = body.channel || "manual";

  const supabase = safeSupabase();

  // --- DEMO MODE: Use file-backed state + real AI APIs ---
  if (!supabase) {
    const state = readDemoState();
    
    // 1. Find or create contact
    let contact: Contact | undefined = state.contacts.find(c => c.phone === phone);
    if (!contact) {
      contact = {
        id: `contact-${Date.now()}`,
        name,
        phone,
        email: null,
        metadata: { source: channel },
        created_at: new Date().toISOString(),
      };
      state.contacts.unshift(contact);
    }

    // 2. Insert message
    const message: RawMessage = {
      id: `msg-${Date.now()}`,
      contact_id: contact.id,
      external_id: `test-${Date.now()}`,
      channel: channel as RawMessage["channel"],
      direction: "inbound",
      content,
      status: "pending",
      raw_payload: { test: true, ...body },
      created_at: new Date().toISOString(),
    };
    state.messages.unshift(message);

    // 3. Run REAL AI classification
    let classification = "unclear";
    let classificationError = null;
    try {
      classification = await classifyMessage(content);
    } catch (e: any) {
      classificationError = e.message;
    }

    // 4. Update message status based on classification
    if (classification === "noise") {
      message.status = "noise";
      writeDemoState(state);
      return NextResponse.json({
        ok: true,
        mode: "demo",
        classification,
        message: { id: message.id, content: message.content, status: message.status },
        contact: { id: contact.id, name: contact.name, phone: contact.phone },
      });
    }

    // 5. Run REAL AI planner
    let plan: any[] = [];
    let planError = null;
    try {
      plan = await planActions({
        messageBatch: [{ content }],
        contact: { name: contact.name, phone: contact.phone },
        recentMessages: state.messages.slice(0, 5).map(m => ({ content: m.content })),
        openTasks: state.tasks.filter(t => t.contact_id === contact.id && t.status !== "done").map(t => ({ title: t.title, status: t.status })),
        teamMembers: TEAM_MEMBERS,
      });
    } catch (e: any) {
      planError = e.message;
    }

    // 6. Execute plan in demo state
    const createdTasks: Task[] = [];
    const createdFollowUps: FollowUp[] = [];
    for (const action of plan) {
      if (action.tool === "create_task") {
        // Accept multiple arg name variants from AI
        const title = String(action.args.title ?? action.args.task_name ?? action.args.name ?? "Untitled task");
        const description = typeof (action.args.description ?? action.args.task_description) === "string" 
          ? String(action.args.description ?? action.args.task_description) : null;
        const priorityVal = String(action.args.priority ?? action.args.urgency ?? "medium") as Priority;
        
        const task: Task = {
          id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          raw_message_id: message.id,
          contact_id: contact.id,
          title,
          description,
          status: "open",
          priority: priorityVal,
          owner_id: null,
          due_at: action.args.due_in_hours 
            ? new Date(Date.now() + (action.args.due_in_hours as number) * 3600000).toISOString()
            : new Date(Date.now() + 2 * 3600000).toISOString(),
          source_url: null,
          plan_snapshot: action.args,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        state.tasks.unshift(task);
        createdTasks.push(task);

        // Auto-assign owner based on team or owner name
        const teamArg = String(action.args.team ?? action.args.owner_team ?? "");
        const ownerArg = String(action.args.owner ?? action.args.owner_name ?? action.args.assignee ?? "");
        if (teamArg) {
          const member = TEAM_MEMBERS.find(m => m.team === teamArg);
          if (member) task.owner_id = member.id;
        }
        if (ownerArg && !task.owner_id) {
          // Try to match by name (e.g., "Sarah (Sales)" → match "Sarah")
          const member = TEAM_MEMBERS.find(m => 
            ownerArg.toLowerCase().includes(m.name.split(" ")[0].toLowerCase()) ||
            m.name.toLowerCase().includes(ownerArg.toLowerCase())
          );
          if (member) task.owner_id = member.id;
        }
      } else if (action.tool === "schedule_followup") {
        const followUp: FollowUp = {
          id: `followup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          task_id: createdTasks[createdTasks.length - 1]?.id || `task-${Date.now()}`,
          scheduled_at: new Date(Date.now() + 2 * 3600000).toISOString(),
          sent_at: null,
          escalation_level: 1,
          channel: "app",
          message_draft: typeof action.args.message === "string" ? action.args.message : "Follow up on this task.",
          status: "scheduled",
          created_at: new Date().toISOString(),
        };
        state.approvals.unshift(followUp);
        createdFollowUps.push(followUp);
      } else if (action.tool === "draft_message") {
        const followUp: FollowUp = {
          id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          task_id: createdTasks[createdTasks.length - 1]?.id || `task-${Date.now()}`,
          scheduled_at: new Date().toISOString(),
          sent_at: null,
          escalation_level: 0,
          channel: "whatsapp",
          message_draft: typeof (action.args.message ?? action.args.text ?? action.args.content) === "string" 
            ? String(action.args.message ?? action.args.text ?? action.args.content) : "Draft message.",
          status: "scheduled",
          created_at: new Date().toISOString(),
        };
        state.approvals.unshift(followUp);
        createdFollowUps.push(followUp);
      } else if (action.tool === "assign_owner") {
        // Assign owner to the last created task
        if (createdTasks.length > 0) {
          const lastTask = createdTasks[createdTasks.length - 1];
          const ownerArg = String(action.args.owner ?? action.args.owner_name ?? action.args.assignee ?? "");
          const teamArg = String(action.args.team ?? action.args.owner_team ?? "");
          if (teamArg) {
            const member = TEAM_MEMBERS.find(m => m.team === teamArg);
            if (member) lastTask.owner_id = member.id;
          }
          if (ownerArg && !lastTask.owner_id) {
            const member = TEAM_MEMBERS.find(m => 
              ownerArg.toLowerCase().includes(m.name.split(" ")[0].toLowerCase()) ||
              m.name.toLowerCase().includes(ownerArg.toLowerCase())
            );
            if (member) lastTask.owner_id = member.id;
          }
        }
      }
    }

    // 7. Update message status
    message.status = createdTasks.length > 0 ? "extracted" : "review_needed";

    // 8. Save state
    writeDemoState(state);

    return NextResponse.json({
      ok: true,
      mode: "demo",
      aiPowered: true,
      classification,
      classificationError,
      plan: plan.map(p => ({ tool: p.tool, args: p.args, ref: p.ref })),
      planError,
      message: { id: message.id, content: message.content, status: message.status },
      contact: { id: contact.id, name: contact.name, phone: contact.phone },
      createdTasks: createdTasks.map(t => ({ id: t.id, title: t.title, priority: t.priority, owner_id: t.owner_id })),
      createdFollowUps: createdFollowUps.map(f => ({ id: f.id, message_draft: f.message_draft, channel: f.channel })),
    });
  }

  // --- LIVE MODE: Use Supabase + Inngest ---
  try {
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .upsert({ phone, name }, { onConflict: "phone" })
      .select()
      .single();
    if (contactError) throw new Error(`Contact: ${contactError.message}`);

    const externalId = `test-${Date.now()}`;
    const { data: message, error: msgError } = await supabase
      .from("raw_messages")
      .insert({
        contact_id: contact.id,
        external_id: externalId,
        channel,
        direction: "inbound",
        content,
        status: "pending",
        raw_payload: { test: true, ...body },
      })
      .select()
      .single();
    if (msgError) throw new Error(`Message: ${msgError.message}`);

    let inngestSent = false;
    try {
      await inngest.send({
        name: "message.received",
        data: { messageId: message.id, contactId: contact.id },
      });
      inngestSent = true;
    } catch (e) {
      console.error("Inngest send error (non-fatal, running direct AI):", e);
    }

    // Also run direct AI processing as fallback (so it works without Inngest dev server)
    let classification = "unclear";
    let createdTasks: any[] = [];
    let createdFollowUps: any[] = [];
    try {
      classification = await classifyMessage(content);

      if (classification !== "noise") {
        // Get context for planner
        const [{ data: recentMsgs }, { data: openTasks }, { data: teamMembers }] = await Promise.all([
          supabase.from("raw_messages").select("content").eq("contact_id", contact.id).order("created_at", { ascending: false }).limit(5),
          supabase.from("tasks").select("title, status").eq("contact_id", contact.id).neq("status", "done").limit(10),
          supabase.from("team_members").select("id, name, team"),
        ]);

        const plan = await planActions({
          messageBatch: [{ content }],
          contact: { name: contact.name, phone: contact.phone },
          recentMessages: recentMsgs || [],
          openTasks: openTasks || [],
          teamMembers: teamMembers || [],
        });

        // Execute plan in Supabase
        for (const action of plan) {
          if (action.tool === "create_task") {
            const title = String(action.args.title ?? action.args.task_name ?? action.args.name ?? "Untitled task");
            const priorityVal = String(action.args.priority ?? "medium") as Priority;
            const { data: task } = await supabase.from("tasks").insert({
              raw_message_id: message.id,
              contact_id: contact.id,
              title,
              description: typeof (action.args.description ?? action.args.task_description) === "string" ? String(action.args.description ?? action.args.task_description) : null,
              status: "open",
              priority: priorityVal,
              due_at: new Date(Date.now() + 2 * 3600000).toISOString(),
              plan_snapshot: action.args,
            }).select().single();

            if (task) {
              createdTasks.push(task);
              // Auto-assign owner
              const teamArg = String(action.args.team ?? action.args.owner_team ?? "");
              const ownerArg = String(action.args.owner ?? action.args.owner_name ?? "");
              if (teamArg) {
                const member = (teamMembers || []).find((m: any) => m.team === teamArg);
                if (member) await supabase.from("tasks").update({ owner_id: member.id }).eq("id", task.id);
              }
              if (ownerArg && !task.owner_id) {
                const member = (teamMembers || []).find((m: any) => ownerArg.toLowerCase().includes(m.name.split(" ")[0].toLowerCase()));
                if (member) await supabase.from("tasks").update({ owner_id: member.id }).eq("id", task.id);
              }
            }
          } else if (action.tool === "draft_message" || action.tool === "schedule_followup") {
            const lastTaskId = createdTasks[createdTasks.length - 1]?.id;
            if (lastTaskId) {
              const { data: fu } = await supabase.from("follow_ups").insert({
                task_id: lastTaskId,
                scheduled_at: new Date().toISOString(),
                channel: action.tool === "draft_message" ? "whatsapp" : "app",
                message_draft: String(action.args.message ?? action.args.text ?? "Follow up"),
                status: "scheduled",
              }).select().single();
              if (fu) createdFollowUps.push(fu);
            }
          }
        }

        // Update message status
        await supabase.from("raw_messages").update({ status: createdTasks.length > 0 ? "extracted" : "review_needed" }).eq("id", message.id);
      } else {
        await supabase.from("raw_messages").update({ status: "noise" }).eq("id", message.id);
      }
    } catch (e: any) {
      console.error("Direct AI processing error:", e);
    }

    return NextResponse.json({
      ok: true,
      mode: "live",
      aiPowered: true,
      classification,
      message: { id: message.id, content: message.content, status: createdTasks.length > 0 ? "extracted" : classification === "noise" ? "noise" : "pending" },
      contact: { id: contact.id, name: contact.name, phone: contact.phone },
      inngestTriggered: inngestSent,
      createdTasks: createdTasks.map((t: any) => ({ id: t.id, title: t.title, priority: t.priority })),
      createdFollowUps: createdFollowUps.map((f: any) => ({ id: f.id, message_draft: f.message_draft })),
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
