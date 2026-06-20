import type { ToolCall } from "../types";

export function parsePlannerContent(content: string): ToolCall[] {
  const parsed = JSON.parse(content);
  return Array.isArray(parsed.plan) ? parsed.plan : [];
}
