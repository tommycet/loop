const WAPPFLY_BASE = "https://wappfly.com/api";

function getApiKey(): string {
  const key = process.env.WAPPFLY_API_KEY;
  if (!key) throw new Error("WAPPFLY_API_KEY is missing");
  return key;
}

function headers(): Record<string, string> {
  return {
    "X-API-Token": getApiKey(),
    "Content-Type": "application/json",
  };
}

export interface WappflySession {
  id: number;
  name: string;
  status: string;
  phone_jid: string;
  me?: { id: string; name: string; lid?: string };
}

export interface WappflyQuota {
  quota: number;
  requests_used: number;
  requests_left: number;
  plan: { code: string; name: string };
}

export async function getSessionInfo(): Promise<{ session: WappflySession; user: { quota: WappflyQuota } }> {
  const res = await fetch(`${WAPPFLY_BASE}/me`, { headers: headers() });
  if (!res.ok) throw new Error(`Wappfly /me failed: ${res.status}`);
  return res.json();
}

export async function getConnectionStatus(): Promise<WappflySession> {
  const res = await fetch(`${WAPPFLY_BASE}/status`, { headers: headers() });
  if (!res.ok) throw new Error(`Wappfly /status failed: ${res.status}`);
  return res.json();
}

export async function sendMessage(to: string, text: string): Promise<{ queued: boolean; msg_id: string }> {
  // to should be in format: phone@s.whatsapp.net
  const jid = to.includes("@") ? to : `${to}@s.whatsapp.net`;
  const res = await fetch(`${WAPPFLY_BASE}/messages/send`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ to: jid, text }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Wappfly send failed: ${res.status} - ${err}`);
  }
  return res.json();
}

export async function sendReply(to: string, text: string, quotedMsgId: string): Promise<{ queued: boolean; msg_id: string }> {
  const jid = to.includes("@") ? to : `${to}@s.whatsapp.net`;
  const res = await fetch(`${WAPPFLY_BASE}/messages/reply`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ to: jid, text, quoted_msg_id: quotedMsgId }),
  });
  if (!res.ok) throw new Error(`Wappfly reply failed: ${res.status}`);
  return res.json();
}

export async function getRecentMessages(limit = 20): Promise<any[]> {
  const res = await fetch(`${WAPPFLY_BASE}/messages/recent?limit=${limit}`, { headers: headers() });
  if (!res.ok) throw new Error(`Wappfly /messages/recent failed: ${res.status}`);
  return res.json();
}

export async function getChatHistory(jid: string, limit = 50): Promise<any[]> {
  const res = await fetch(`${WAPPFLY_BASE}/history?jid=${jid}&limit=${limit}`, { headers: headers() });
  if (!res.ok) throw new Error(`Wappfly /history failed: ${res.status}`);
  return res.json();
}

export async function getChats(): Promise<any[]> {
  const res = await fetch(`${WAPPFLY_BASE}/chats`, { headers: headers() });
  if (!res.ok) throw new Error(`Wappfly /chats failed: ${res.status}`);
  return res.json();
}
