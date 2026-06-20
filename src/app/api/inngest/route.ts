import { serve } from "inngest/next";

import { inngest } from "@/lib/inngest";
import { classifyAndDebounce, escalationCheck, handleBatch, onTaskCreated } from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [classifyAndDebounce, handleBatch, onTaskCreated, escalationCheck],
});
