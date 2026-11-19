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

// Videos in the app's Learn tab. Keep in step with LEARNING_VIDEOS in index.html.
// Only videos that are recorded and live belong here ("The Maths Behind Back & Lay" is added once it is up).
const VIDEOS = [
  { cp: 1, title: "How to Use the Tracker", desc: "a walk through every section of the app" },
  { cp: 1, title: "How to Use Betfair", desc: "setting up Betfair and reading live prices" },
  { cp: 1, title: "How to place a lay bet", desc: "turning a bonus bet into cash, step by step" },
];

// The student only hears about videos for their own checkpoint and earlier.
function videosBlock(cp: number): string {
  const list = VIDEOS.filter((v) => v.cp <= cp)
    .map((v) => `- "${v.title}": ${v.desc}`).join("\n");
  return "[VIDEOS THIS STUDENT CAN WATCH, in the Learn tab of the app]\n" + list +
    "\nWhen one of these covers what the student is asking, or would help, point them to it by its exact title and say it is in the Learn tab. " +
    "Do this early for anything new to them. Never mention a video that is not on this list. Do not make up links.";
}

// Rule updates from the coaches. These replace anything in the knowledge base that says otherwise.
const RULE_UPDATES = `[COACH RULE UPDATES, these replace anything above that says otherwise]
1. The order reminder (bonus bet at the bookie FIRST and accepted, then the lay on Betfair, never lay first) is only given when the student asks how to do a bonus turnover, or is about to place a bonus bet and lay it. Do not mention it when answering anything else.
2. When a student first asks about Betfair, do not start by asking for a live lay price or TAB price. Send them to the video "How to Use Betfair" in the Learn tab first, and ask if they have watched it. Take their word for it.
3. You cannot see live markets or place bets. Never offer to check a price "before you place anything". If a student wants to practise, they can give you practice odds and you can work through the calculator numbers with them. They place real bets themselves at the bookie and on Betfair.
4. Give plain text only, no markdown.`;

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

    // Has this student been briefed on the checkpoint they are in? (The table is only read and
    // written here by the server; it does not touch the student's synced app data.)
    const briefCp: number | null = settings.cpDone ? null : (cp >= 1 ? cp : 1);
    let briefNow = false;
    if (briefCp !== null) {
      const { data: seen, error: seenErr } = await admin
        .from("coach_cp_briefed").select("cp").eq("user_id", user.id).eq("cp", briefCp).maybeSingle();
      briefNow = !seenErr && !seen; // if the table is missing, skip the briefing rather than repeat it every time
    }

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
    system.push({ type: "text", text: "\n\n" + RULE_UPDATES });
    system.push({ type: "text", text: "\n\n" + videosBlock(settings.cpDone ? 10 : (cp >= 1 ? cp : 1)) });
    if (briefNow) {
      system.push({
        type: "text",
        text: `\n\n[NEW CHECKPOINT: FIRST MESSAGE AT CP ${briefCp}]\nThis student has just started CP ${briefCp} with you. Begin your reply with a short summary (3 to 5 short lines, plain text) of what they need to do to tick off CP ${briefCp}, taken from that checkpoint's goal and its "Ready to move on when" list in the knowledge base. If nothing is written for it yet (CP8 to CP10), say so and tell them to check in with the coach. Then answer whatever they asked, in the same reply. Never skip their question.`,
      });
    }

    const data = await callAnthropic({ model: CHAT_MODEL, max_tokens: 2048, system, messages });
    const reply = data.content?.find((b: { type: string }) => b.type === "text")?.text || null;
    if (briefNow && reply && briefCp !== null) {
      await admin.from("coach_cp_briefed").upsert({ user_id: user.id, cp: briefCp });
    }
    return json({ reply, stop_reason: data.stop_reason, usage: data.usage, blocks: (data.content || []).map((b: { type: string }) => b.type), remaining: Math.max(0, DAILY_LIMIT - (used as number)) });
  } catch (e) {
    return json({ error: (e as Error).message || "Server error" }, 500);
  }
});
