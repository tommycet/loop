import { CodeBlock } from "../../components/docs/CodeBlock";
import { DocCallout, DocTable } from "../../components/docs/DocCallout";

export default function DocsIndex() {
  return (
    <article className="prose-doc">
      <div className="text-eyebrow mb-3">Documentation</div>
      <h1>Build with Loop</h1>
      <p className="text-[1.0625rem] text-fg-secondary">
        Everything you need to wire Loop into your ops stack: webhooks, the REST API,
        and the data model behind every message, task and follow-up.
      </p>

      <h2 id="install">Install</h2>
      <p>
        The Loop SDK is a thin TypeScript client. Install it in any Node 18+ project:
      </p>
      <CodeBlock
        language="bash"
        code={`npm install @loop/sdk`}
      />

      <h2 id="quickstart">Quickstart</h2>
      <p>
        Send your first classified message in 4 lines:
      </p>
      <CodeBlock
        language="typescript"
        code={`import { Loop } from "@loop/sdk";

const loop = new Loop({ apiKey: process.env.LOOP_API_KEY });

const { tasks, followUps } = await loop.classify({
  contact: { phone: "+923001234567", name: "Ali Traders" },
  message: "Please send quotation for 500 units, urgent delivery",
});`}
      />

      <DocCallout kind="tip">
        <strong>Tip:</strong> Loop never sends a WhatsApp message without your team's
        approval. Drafts are returned in <code>followUps</code> — review, edit, then call{" "}
        <code>followUps[id].approve()</code>.
      </DocCallout>

      <h2 id="core">Core concepts</h2>
      <DocTable
        headers={["Concept", "What it is", "Where it lives"]}
        rows={[
          ["Message", "Raw inbound WhatsApp / email / voice text", "raw_messages"],
          ["Task", "An actionable unit of work, with owner and deadline", "tasks"],
          ["Follow-up", "A scheduled outbound nudge — WhatsApp or in-app", "follow_ups"],
          ["Run", "One AI classification + planning attempt", "runs"],
        ]}
      />

      <h2 id="endpoints">Endpoints you'll use first</h2>
      <DocTable
        headers={["Method", "Path", "Purpose"]}
        rows={[
          ["POST", "/api/test/webhook", "Send a synthetic message for testing"],
          ["GET", "/api/tasks", "List tasks (filter by status, owner)"],
          ["PATCH", "/api/tasks/:id", "Update task status / priority / owner"],
          ["POST", "/api/wappfly/send", "Send a WhatsApp message"],
          ["GET", "/api/digest", "Today's standup summary"],
        ]}
      />

      <h2 id="next">Next steps</h2>
      <p>
        Read the <a href="/docs/api/auth" className="link">Authentication guide</a> or
        follow the <a href="/docs/guides/getting-started" className="link">10-minute quickstart</a>.
      </p>
    </article>
  );
}