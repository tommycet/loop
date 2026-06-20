# Product

## Register

brand

## Users

Operations leads and small-business owners in emerging markets (Pakistan first, SE Asia next) running sales, support, and delivery on WhatsApp. Their context is messy inboxes, missed follow-ups, and staff who forget. They want one cockpit that turns the noise into accountable work.

## Product Purpose

Loop is an AI operations agent for chat-first businesses. It ingests WhatsApp, voice notes, and email; classifies every message; drafts responses and follow-ups; assigns tasks to a real team; and keeps pressure on open loops until they close. Success = no message sits unanswered, no commitment gets dropped, every team member has a queue they trust.

## Brand Personality

- **Three words:** ruthless, kinetic, human.
- **Voice:** confident, technical, never cute. Sentences are short. The product sounds like a senior operator who has seen things.
- **Emotional goal:** the user feels *in command* within 10 seconds. Not impressed — in command.
- **Anti-tropes:** no SaaS-cream backgrounds, no "AI co-pilot" metaphors, no gradient-mesh hero blobs, no emoji decorations, no startup founder headshots.

## Anti-references

The interface must NOT look like:

- **Linear / Notion / Vercel marketing pages** — the polished-but-soft, mono-on-white minimalism that has become SaaS wallpaper. Loop is darker, louder, more textured.
- **Intercom / Zendesk dashboards** — the dense blue-grey agent UIs with rounded chips and modal-heavy flows.
- **Generic AI-product hero pages** — the gradient sphere + "Introducing our AI" + 5 screenshots in a row template.
- **Stripe / Linear product pages** — the over-explained, scroll-storytelling-without-storytelling pattern.
- **Midjourney / Runway aesthetic pages** — the all-black-with-one-colored-glow runway look. Distinct enough by motion and density.

## Design Principles

1. **Make pressure visible.** Every screen should answer "what's open, who's blocked, what fires next" before it answers "what is this product." Operations is a state of urgency, not a brochure.
2. **Show the loop, not the tool.** The hero motion is a closed-loop arc — message in, task out, follow-up fired, message back. The 3D scene is a torus knot or rotating closed loop, not a generic blob.
3. **Operator-grade density, consumer-grade clarity.** Information is dense where operators live (dashboard, tasks, messages), spacious where buyers decide (landing, pricing). Never the reverse.
4. **Performance is a feature.** WebGL only on the marketing surface and the hero. The dashboard must stay under 200KB of JS. No motion library on the operator path.
5. **Identity over templates.** No "AI workflow tool" layout grid. Every section earns its shape; variety of grid, type scale, and motion rhythm across pages is the point.

## Accessibility & Inclusion

- WCAG 2.1 AA across the marketing site.
- Full `prefers-reduced-motion` fallbacks: WebGL canvas unmounts, GSAP/Framer timelines snap to end state, transitions crossfade.
- Color choices verified against deuteranopia + protanopia. Primary cyan has 4.6:1 contrast on the dark base; danger red has a paired icon, not color alone.
- The dashboard is keyboard-navigable end to end: Tab order matches reading order, focus rings visible on dark surfaces, escape closes any modal/popover.
- All form fields have visible labels (not placeholder-as-label), 16px min font size, ≥44px hit targets.
- Live regions for any task/message updates triggered by background ingestion (no silent state changes for screen-reader users).