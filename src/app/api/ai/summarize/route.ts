import { NextRequest, NextResponse } from "next/server";
import { readDemoState } from "../../../../lib/demo-state";
import { safeSupabase } from "../../../../lib/runtime";
import { getGroq } from "../../../../lib/groq";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const contactId = req.nextUrl.searchParams.get("contactId");
  const type = req.nextUrl.searchParams.get("type") || "contact"; // contact, tasks, all
  
  const supabase = safeSupabase();
  
  if (!supabase) {
    const state = readDemoState();
    
    let context = "";
    let label = "";
    
    if (type === "contact" && contactId) {
      const contact = state.contacts.find(c => c.id === contactId);
      const messages = state.messages.filter(m => m.contact_id === contactId);
      const tasks = state.tasks.filter(t => t.contact_id === contactId);
      
      context = `Contact: ${contact?.name || "Unknown"} (${contact?.phone || "no phone"})
Messages:
${messages.map(m => `- [${m.channel}] ${m.content}`).join("\n") || "None"}

Tasks:
${tasks.map(t => `- [${t.status}] [${t.priority}] ${t.title}`).join("\n") || "None"}`;
      label = "contact summary";
    } else if (type === "tasks") {
      const openTasks = state.tasks.filter(t => t.status !== "done");
      context = `Open tasks (${openTasks.length}):
${openTasks.map(t => `- [${t.priority}] ${t.title} (due: ${t.due_at})`).join("\n")}`;
      label = "task summary";
    } else {
      context = `Total messages: ${state.messages.length}
Total tasks: ${state.tasks.length}
Total contacts: ${state.contacts.length}
Total follow-ups: ${state.approvals.length}

Recent messages:
${state.messages.slice(0, 10).map(m => `- [${m.channel}] ${m.content?.substring(0, 80)}`).join("\n")}

Open tasks:
${state.tasks.filter(t => t.status !== "done").map(t => `- [${t.priority}] ${t.title}`).join("\n")}`;
      label = "operations summary";
    }
    
    try {
      const prompt = `You are Loop, an AI ops agent. Summarize the following information concisely. Highlight what needs attention.

${context}

Provide a 2-3 sentence summary.`;

      const response = await getGroq().chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 200,
      });
      
      const summary = response.choices[0]?.message?.content || "No summary generated.";
      
      return NextResponse.json({
        ok: true,
        type: label,
        summary,
      });
    } catch (error: any) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  }
  
  return NextResponse.json({ ok: true, mode: "live" });
}
