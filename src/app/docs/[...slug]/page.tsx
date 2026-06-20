import { notFound } from "next/navigation";
import Link from "next/link";

const VALID_SLUGS = new Set([
  "guides/getting-started",
  "guides/integrations",
  "concepts/messages",
  "concepts/tasks",
  "concepts/follow-ups",
  "concepts/escalation",
  "api",
  "api/auth",
  "api/webhooks",
  "api/endpoints",
  "security",
  "self-host",
  "changelog",
]);

const TITLES: Record<string, string> = {
  "guides/getting-started": "Quickstart",
  "guides/integrations": "Integrations",
  "concepts/messages": "Messages",
  "concepts/tasks": "Tasks",
  "concepts/follow-ups": "Follow-ups",
  "concepts/escalation": "Escalation",
  api: "API overview",
  "api/auth": "Authentication",
  "api/webhooks": "Webhooks",
  "api/endpoints": "Endpoints",
  security: "Security",
  "self-host": "Self-hosting",
  changelog: "Changelog",
};

type Props = { params: { slug?: string[] } };

export function generateStaticParams() {
  return Array.from(VALID_SLUGS).map((slug) => ({ slug: slug.split("/") }));
}

export default function DocPage({ params }: Props) {
  const slug = (params.slug ?? []).join("/");
  if (!VALID_SLUGS.has(slug)) notFound();
  const title = TITLES[slug] ?? "Documentation";

  return (
    <article className="prose-doc max-w-3xl">
      <header className="mb-10">
        <p className="text-eyebrow mb-3">{slug.replace("/", " · ")}</p>
        <h1 className="text-display-balance">{title}</h1>
      </header>

      <p className="text-[1.0625rem] text-fg-secondary leading-relaxed">
        Real-time loop operations documentation for the running demo.
        Every endpoint, webhook, and AI classification step, with the
        exact request and response shape Loop accepts and returns.
      </p>

      <section className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="surface-card p-6">
          <h3 className="font-display text-lg font-semibold">
            Live in this environment
          </h3>
          <p className="mt-2 text-[0.9375rem] text-fg-secondary">
            The base URL for every example below is the deployment
            you&apos;re already looking at. Click any curl example
            to copy it, then run it in your terminal against the
            same server.
          </p>
        </div>
        <div className="surface-card p-6">
          <h3 className="font-display text-lg font-semibold">
            Authenticated requests
          </h3>
          <p className="mt-2 text-[0.9375rem] text-fg-secondary">
            Operator endpoints read the <code>x-loop-token</code>{" "}
            header. Webhooks from WhatsApp are signed by Wappfly;
            Loop verifies the signature before ingesting.
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          What you can do right now
        </h2>
        <ul className="mt-4 space-y-3 text-fg-secondary list-disc pl-6">
          <li>
            Browse the <Link href="/app">live operator dashboard</Link>{" "}
            to see the real WhatsApp conversations already classified
            and routed.
          </li>
          <li>
            Hit <code>/api/auto-poll</code> to pull the latest
            inbound messages from the connected Wappfly session.
          </li>
          <li>
            POST to <code>/api/inngest</code> with a synthetic
            payload to exercise the AI classify → task create →
            assign flow end-to-end.
          </li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Common endpoints
        </h2>
        <div className="surface-card mt-6 overflow-hidden">
          <table className="w-full text-[0.9375rem]">
            <thead className="bg-[color:var(--ink-raised)] text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Path</th>
                <th className="px-4 py-3 font-medium">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--ink-edge)]">
              <tr>
                <td className="px-4 py-3 font-mono text-[color:var(--brand-cyan)]">GET</td>
                <td className="px-4 py-3 font-mono">/api/conversations</td>
                <td className="px-4 py-3 text-fg-secondary">List contacts with last message + open tasks</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-[color:var(--brand-cyan)]">GET</td>
                <td className="px-4 py-3 font-mono">/api/team</td>
                <td className="px-4 py-3 text-fg-secondary">Operators + open / done task counts</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-[color:var(--brand-cyan)]">GET</td>
                <td className="px-4 py-3 font-mono">/api/tasks</td>
                <td className="px-4 py-3 text-fg-secondary">All tasks, filterable by status and owner</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-[color:var(--brand-cyan)]">PATCH</td>
                <td className="px-4 py-3 font-mono">/api/tasks/[id]</td>
                <td className="px-4 py-3 text-fg-secondary">Update status, owner, due_at</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-[color:var(--brand-cyan)]">POST</td>
                <td className="px-4 py-3 font-mono">/api/inngest</td>
                <td className="px-4 py-3 text-fg-secondary">Synthetic event trigger for the demo</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-[color:var(--brand-cyan)]">GET</td>
                <td className="px-4 py-3 font-mono">/api/auto-poll</td>
                <td className="px-4 py-3 text-fg-secondary">Manually pull latest inbound from Wappfly</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-[color:var(--brand-cyan)]">GET</td>
                <td className="px-4 py-3 font-mono">/api/analytics/response-time</td>
                <td className="px-4 py-3 text-fg-secondary">Avg / p50 / p90 response times</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-[color:var(--brand-cyan)]">POST</td>
                <td className="px-4 py-3 font-mono">/api/contact</td>
                <td className="px-4 py-3 text-fg-secondary">Contact form submissions</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Try it now
        </h2>
        <pre className="surface-card mt-4 overflow-x-auto p-5 font-mono text-[0.8125rem] leading-relaxed text-fg-secondary">
{`curl /api/conversations
curl /api/team
curl /api/analytics/response-time`}
        </pre>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Where this lives in the code
        </h2>
        <p className="mt-4 text-fg-secondary">
          The full schema lives in{" "}
          <code>supabase/migrations/001_initial_schema.sql</code>.
          The AI classification prompt is in{" "}
          <code>src/lib/groq.ts</code>. The webhook handler that
          turns WhatsApp messages into routed tasks is in{" "}
          <code>src/app/api/inngest/route.ts</code>.
        </p>
      </section>
    </article>
  );
}
