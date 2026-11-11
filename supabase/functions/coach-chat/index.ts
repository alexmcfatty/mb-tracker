// Supabase Edge Function: coach-chat
// Sits between the student's browser and Anthropic. The API key and the
// knowledge base live only here (secret + private table), never in the page.
//
// Secrets needed (Supabase dashboard > Edge Functions > Secrets):
//   ANTHROPIC_API_KEY
// Provided automatically: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const DAILY_LIMIT = 30;
const CHAT_MODEL = "claude-sonnet-5-5";
const PROFILE_MODEL = "claude-haiku-5-5";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

// Cache the KB for a few minutes inside the running function to save database reads.
let kbCache: { text: string; at: number } | null = null;
async function loadKB(): Promise<string> {
  if (kbCache && Date.now() - kbCache.at < 5 * 60 * 1000) return kbCache.text;
  const { data, error } = await admin.from("coach_kb").select("content").order("sort");
  if (error || !data?.length) throw new Error("Knowledge base not available");
  const text = data.map((r) => r.content).join("\n\n");
  kbCache = { text, at: Date.now() };
  return text;
}

async function callAnthropic(body: Record<string, unknown>) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok || data.error) {
    throw new Error(data?.error?.message || `Anthropic error ${resp.status}`);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    // 1. Who is this?
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(token);
    const user = u?.user;
    if (!user) return json({ error: "Not logged in" }, 401);

    // 2. Do they have coaching access?
    const { data: access } = await admin
      .from("ai_access").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!access) return json({ error: "no_access" }, 403);

    const body = await req.json().catch(() => ({}));

    // ---- Profile notes update (cheap model, not counted against the daily limit) ----
    if (body.action === "profile") {
      const notes = String(body.notes || "(none yet — first session)").slice(0, 6000);
      const convo = String(body.convo || "").slice(0, 12000);
      const data = await callAnthropic({
        model: PROFILE_MODEL,
        max_tokens: 1500,
        messages: [{
          role: "user",
          content: `You are maintaining coaching notes for a matched betting student. Update the notes based on the recent conversation.

CURRENT NOTES:
${notes}

RECENT CONVERSATION:
${convo}

Write updated coaching notes covering:
- Name (if they mentioned it)
- Their experience level and how long they've been going
- What they understand well
- What they struggle with or ask about repeatedly
- Their personality/communication style (anxious, confident, impatient, etc.)
- Any specific goals, concerns or situations they've raised
- Things to follow up on or check next session
- Any rules they've tried to bend or needed reminding about

Keep it under 400 words. Write as brief coaching notes, not a transcript. Only include things genuinely learned. If nothing new was learned, return the current notes unchanged.`,
        }],
      });
      const text = data.content?.find((b: { type: string }) => b.type === "text")?.text || null;
      return json({ notes: text });
    }

    // ---- Chat ----
    let messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
    messages = messages
      .filter((m: { role: string; content: unknown }) =>
        (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content.slice(0, 20000) }));
    while (messages.length && messages[0].role !== "user") messages.shift();
    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return json({ error: "bad_request" }, 400);
    }

    // Daily limit
    const { data: used, error: bumpErr } = await admin.rpc("coach_bump_usage", { uid: user.id });
    if (bumpErr) throw new Error("Usage check failed");
    if ((used as number) > DAILY_LIMIT) {
      return json({ error: "daily_limit", limit: DAILY_LIMIT }, 429);
    }

    // Checkpoint is read from the database, so the student cannot fake it.
    const { data: row } = await admin
      .from("user_data").select("data").eq("user_id", user.id).maybeSingle();
    const settings = row?.data?.settings || {};
    const cp = parseInt(settings.checkpoint, 10);
    const verified = settings.cpDone
      ? "[SERVER-VERIFIED STUDENT STATE]\ncp_mode: general_reference"
      : `[SERVER-VERIFIED STUDENT STATE]\nStudent checkpoint (set by coach): ${cp >= 1 ? "CP " + cp : "not set"}`;

    const kb = await loadKB();
    const system: Record<string, unknown>[] = [
      { type: "text", text: kb, cache_control: { type: "ephemeral", ttl: "1h" } },
    ];
    const profile = String(body.profile || "").slice(0, 3000);
    if (profile) {
      system.push({
        type: "text",
        text: "\n\n[STUDENT COACHING PROFILE — COACHING NOTES FROM PREVIOUS SESSIONS]\n" + profile,
        cache_control: { type: "ephemeral", ttl: "1h" },
      });
    }
    system.push({ type: "text", text: "\n\n" + verified });

    const data = await callAnthropic({ model: CHAT_MODEL, max_tokens: 2048, system, messages });
    const reply = data.content?.find((b: { type: string }) => b.type === "text")?.text || null;
    return json({ reply, stop_reason: data.stop_reason, usage: data.usage, blocks: (data.content || []).map((b: { type: string }) => b.type), remaining: Math.max(0, DAILY_LIMIT - (used as number)) });
  } catch (e) {
    return json({ error: (e as Error).message || "Server error" }, 500);
  }
});
