import { NextResponse } from "next/server";
import { getRecentMessages, sendMessage } from "@/lib/wappfly";
import { readDemoState, writeDemoState } from "../../../../lib/demo-state";
import { safeSupabase } from "../../../../lib/runtime";
import { classifyMessage } from "../../../../lib/classifier";
import { planActions } from "../../../../lib/planner";
import type { RawMessage, Task, FollowUp, Contact, Priority } from "../../../../types";

export const dynamic = "force-dynamic";

const TEAM_MEMBERS = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Sarah (Sales)", team: "sales" },
  { id: "22222222-2222-2222-2222-222222222222", name: "Omar (Ops)", team: "operations" },
  { id: "33333333-3333-3333-3333-333333333333", name: "Fatima (Finance)", team: "finance" },
  { id: "44444444-4444-4444-4444-444444444444", name: "Ahmed (Admin)", team: "admin" },
];

export async function POST() {
  try {
    const recentMsgs = await getRecentMessages(20);
    const inboundMsgs = recentMsgs.filter((m: any) => m.from_me === 0);
    
    if (inboundMsgs.length === 0) {
      return NextResponse.json({ ok: true, message: "No inbound messages", processed: 0 });
    }
    
    const supabase = safeSupabase();
    const processed: any[] = [];
    
    if (!supabase) {
      const state = readDemoState();
      const processedIds = new Set(state.messages.map(m => m.external_id));
      
      for (const msg of inboundMsgs) {
        if (processedIds.has(msg.msg_id)) continue;
        
        const phone = msg.sender_jid?.replace("@s.whatsapp.net", "") || "";
        const content = msg.body || "";
        
        let contact = state.contacts.find(c => c.phone === phone);
        if (!contact) {
          contact = {
            id: `contact-wa-${Date.now()}`,
            name: phone,
            phone,
            email: null,
            metadata: { source: "whatsapp" },
            created_at: new Date().toISOString(),
          } as Contact;
          state.contacts.unshift(contact);
        }
        
        const message: RawMessage = {
          id: `msg-wa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          contact_id: contact.id,
          external_id: msg.msg_id,
          channel: "whatsapp",
          direction: "inbound",
          content,
          status: "pending",
          raw_payload: msg,
          created_at: new Date().toISOString(),
        };
        state.messages.unshift(message);
        
        let classification = "unclear";
        try { classification = await classifyMessage(content); } catch (e) {}
        
        if (classification === "noise") {
          message.status = "noise";
          processed.push({ msgId: msg.msg_id, classification, content: content.substring(0, 50) });
          continue;
        }
        
        let plan: any[] = [];
        try {
          plan = await planActions({
            messageBatch: [{ content }],
            contact: { name: contact.name, phone: contact.phone },
            recentMessages: state.messages.slice(0, 5).map(m => ({ content: m.content })),
            openTasks: state.tasks.filter(t => t.contact_id === contact.id && t.status !== "done").map(t => ({ title: t.title, status: t.status })),
            teamMembers: TEAM_MEMBERS,
          });
        } catch (e) {}
        
        const createdTasks: Task[] = [];
        for (const action of plan) {
          if (action.tool === "create_task") {
            const title = String(action.args.title ?? action.args.task_name ?? action.args.name ?? "Untitled task");
            const task: Task = {
              id: `task-wa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              raw_message_id: message.id,
              contact_id: contact.id,
              title,
              description: typeof (action.args.description ?? action.args.task_description) === "string" ? String(action.args.description ?? action.args.task_description) : null,
              status: "open",
              priority: String(action.args.priority ?? "medium") as Priority,
              owner_id: null,
              due_at: new Date(Date.now() + 2 * 3600000).toISOString(),
              source_url: null,
              plan_snapshot: action.args,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            const ownerArg = String(action.args.owner ?? action.args.owner_name ?? "");
            const teamArg = String(action.args.team ?? action.args.owner_team ?? "");
            if (teamArg) { const m = TEAM_MEMBERS.find(m => m.team === teamArg); if (m) task.owner_id = m.id; }
            if (ownerArg && !task.owner_id) { const m = TEAM_MEMBERS.find(m => ownerArg.toLowerCase().includes(m.name.split(" ")[0].toLowerCase())); if (m) task.owner_id = m.id; }
            state.tasks.unshift(task);
            createdTasks.push(task);
          } else if (action.tool === "draft_message" || action.tool === "schedule_followup") {
            state.approvals.unshift({
              id: `fu-wa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              task_id: createdTasks[createdTasks.length - 1]?.id || message.id,
              scheduled_at: new Date().toISOString(),
              sent_at: null,
              escalation_level: 0,
              channel: "whatsapp",
              message_draft: String(action.args.message ?? action.args.text ?? "Follow up"),
              status: "scheduled",
              created_at: new Date().toISOString(),
            } as FollowUp);
          }
        }
        message.status = createdTasks.length > 0 ? "extracted" : "review_needed";
        processed.push({ msgId: msg.msg_id, classification, content: content.substring(0, 50), tasksCreated: createdTasks.length, planActions: plan.length });
      }
      writeDemoState(state);
    } else {
      // --- LIVE MODE: Use Supabase ---
      const processedIds = new Set<string>();
      
      // Get list of already-processed external_ids
      const { data: existingMsgs } = await supabase
        .from("raw_messages")
        .select("external_id")
        .in("external_id", inboundMsgs.map((m: any) => m.msg_id));
      
      if (existingMsgs) {
        for (const em of existingMsgs) {
          if (em.external_id) processedIds.add(em.external_id);
        }
      }
      
      for (const msg of inboundMsgs) {
        if (processedIds.has(msg.msg_id)) continue;
        
        const phone = msg.sender_jid?.replace("@s.whatsapp.net", "") || "";
        const content = msg.body || "";
        
        // Find or create contact in Supabase
        const { data: existingContact } = await supabase
          .from("contacts")
          .select()
          .eq("phone", phone)
          .maybeSingle();
        
        let contact: any = existingContact;
        if (!contact) {
          const { data: newContact } = await supabase
            .from("contacts")
            .insert({ name: phone, phone, metadata: { source: "whatsapp" } })
            .select()
            .single();
          contact = newContact;
        }
        
        if (!contact) continue;
        
        // Insert message
        const { data: insertedMsg } = await supabase
          .from("raw_messages")
          .insert({
            contact_id: contact.id,
            external_id: msg.msg_id,
            channel: "whatsapp",
            direction: "inbound",
            content,
            status: "pending",
            raw_payload: msg,
          })
          .select()
          .single();
        
        if (!insertedMsg) continue;
        
        // Run AI classification + plan
        let classification = "unclear";
        try { classification = await classifyMessage(content); } catch (e) {}
        
        if (classification === "noise") {
          await supabase.from("raw_messages").update({ status: "noise" }).eq("id", insertedMsg.id);
          processed.push({ msgId: msg.msg_id, classification, content: content.substring(0, 50) });
          continue;
        }
        
        // Get context for planner
        const [{ data: recentMsgs }, { data: openTasks }, { data: teamMembers }] = await Promise.all([
          supabase.from("raw_messages").select("content").eq("contact_id", contact.id).order("created_at", { ascending: false }).limit(5),
          supabase.from("tasks").select("title, status").eq("contact_id", contact.id).neq("status", "done").limit(10),
          supabase.from("team_members").select("id, name, team"),
        ]);
        
        let plan: any[] = [];
        try {
          plan = await planActions({
            messageBatch: [{ content }],
            contact: { name: contact.name, phone: contact.phone },
            recentMessages: recentMsgs || [],
            openTasks: openTasks || [],
            teamMembers: teamMembers || [],
          });
        } catch (e) {}
        
        const createdTasks: any[] = [];
        for (const action of plan) {
          if (action.tool === "create_task") {
            const title = String(action.args.title ?? action.args.task_name ?? action.args.name ?? "Untitled task");
            const priorityVal = String(action.args.priority ?? "medium") as Priority;
            const { data: task } = await supabase.from("tasks").insert({
              raw_message_id: insertedMsg.id,
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
              const teamArg = String(action.args.team ?? action.args.owner_team ?? "");
              const ownerArg = String(action.args.owner ?? action.args.owner_name ?? "");
              if (teamArg) {
                const m = (teamMembers || []).find((m: any) => m.team === teamArg);
                if (m) await supabase.from("tasks").update({ owner_id: m.id }).eq("id", task.id);
              }
              if (ownerArg && !task.owner_id) {
                const m = (teamMembers || []).find((m: any) => ownerArg.toLowerCase().includes(m.name.split(" ")[0].toLowerCase()));
                if (m) await supabase.from("tasks").update({ owner_id: m.id }).eq("id", task.id);
              }
            }
          } else if (action.tool === "draft_message" || action.tool === "schedule_followup") {
            const lastTaskId = createdTasks[createdTasks.length - 1]?.id;
            if (lastTaskId) {
              await supabase.from("follow_ups").insert({
                task_id: lastTaskId,
                scheduled_at: new Date().toISOString(),
                channel: action.tool === "draft_message" ? "whatsapp" : "app",
                message_draft: String(action.args.message ?? action.args.text ?? "Follow up"),
                status: "scheduled",
              });
            }
          }
        }
        
        await supabase.from("raw_messages").update({ status: createdTasks.length > 0 ? "extracted" : "review_needed" }).eq("id", insertedMsg.id);
        processed.push({ msgId: msg.msg_id, classification, content: content.substring(0, 50), tasksCreated: createdTasks.length, planActions: plan.length });
      }
    }
    
    return NextResponse.json({ ok: true, mode: supabase ? "live" : "demo", totalInbound: inboundMsgs.length, processed: processed.length, results: processed });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const msgs = await getRecentMessages(10);
    return NextResponse.json({ ok: true, count: msgs.length, messages: msgs });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
