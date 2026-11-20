// Supabase Edge Function: create-student
// Coach-only. Creates a student login, gives them AI coach access, and emails the welcome message.
// Called from the coach dashboard's "Add student" form.
//
// Secrets needed (Supabase dashboard > Edge Functions > Secrets):
//   RESEND_API_KEY   the API key from resend.com
//   WELCOME_FROM     the sender, e.g.  MB Tracker <welcome@matchedbtracker.com>
// Provided automatically: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// The password is only ever passed through this function to the student's email.
// It is never stored by this function and never written to the logs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const SUBJECT = "You're in: here's your login";

function welcomeHtml(name: string, email: string, password: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#EEF1F5;font-family:Arial,Helvetica,sans-serif;color:#14213D">
<div style="max-width:620px;margin:0 auto;padding:16px">
<div style="background:#ffffff;border-radius:12px;padding:32px;line-height:1.55">
<h1 style="margin:0 0 8px;font-size:24px">Welcome aboard, ${esc(name)}</h1>
<p style="margin:0 0 20px;color:#4A5A75">Your matched betting tracker is ready. Here's your login.</p>
<div style="background:#E6F6F4;border:1px solid #0E9F8E;border-radius:10px;padding:16px 20px;margin:0 0 8px">
<div style="font-size:12px;letter-spacing:1px;color:#0A7F71;font-weight:bold">YOUR LOGIN</div>
<table style="margin-top:8px;font-size:15px" cellpadding="3">
<tr><td style="color:#4A5A75">Website</td><td><a href="https://matchedbtracker.com" style="color:#0A7F71">matchedbtracker.com</a></td></tr>
<tr><td style="color:#4A5A75">Email</td><td><b>${esc(email)}</b></td></tr>
<tr><td style="color:#4A5A75">Password</td><td><b>${esc(password)}</b></td></tr>
</table></div>
<p style="font-size:13px;color:#4A5A75;margin:0 0 24px">Keep this to yourself. Don't share your login with anyone.</p>
<p style="margin:0 0 24px"><a href="https://matchedbtracker.com" style="background:#0E9F8E;color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:8px;font-weight:bold;display:inline-block">Open the tracker</a></p>
<h2 style="font-size:18px;margin:0 0 10px">Your first steps</h2>
<ol style="padding-left:22px;margin:0 0 24px">
<li style="margin-bottom:12px"><b>Fill out your onboarding form as soon as you can.</b> <a href="https://docs.google.com/forms/d/e/1FAIpQLSckWUEbhKP9lFOHeMySxESzSlczACvr2z0-gHqWihEpyyPveQ/viewform" style="color:#0A7F71">Open the onboarding form</a>. It only takes a few minutes and we need it before your onboarding call.</li>
<li style="margin-bottom:12px"><b>Save it as an app on your phone.</b><br><span style="color:#4A5A75">iPhone: open the site in Safari, tap Share, then Add to Home Screen.<br>Android: open it in Chrome, tap the menu, then Install app or Add to home screen.<br>Laptop: in Chrome, click the install icon at the right of the address bar.</span></li>
<li style="margin-bottom:12px"><b>Sign in</b> with the email and password above.</li>
<li style="margin-bottom:12px"><b>Watch this video first:</b> <a href="https://www.youtube.com/watch?v=Ly0eq77XRkA" style="color:#0A7F71">How to Use the Tracker</a>. It's also in the Learn tab of the app.</li>
<li style="margin-bottom:12px"><b>Download Telegram:</b> <a href="https://telegram.org/apps" style="color:#0A7F71">telegram.org/apps</a>. We'll add you to the group on your onboarding call.</li>
<li style="margin-bottom:12px"><b>Say hi to the AI coach</b> in the app. It will help you work out your bankroll and your unit size.</li>
<li><b>Your first checkpoint (CP1):</b> open TAB, Bet365 and Neds, and set up Betfair with about $300 to $500 in it. Don't sign up to any other bookies yet. They unlock at later checkpoints.</li>
</ol>
<h2 style="font-size:18px;margin:0 0 10px">Good to know</h2>
<ul style="padding-left:22px;margin:0 0 24px">
<li>Matched betting isn't fully risk-free and results build over time. Only use money you can afford to lose.</li>
<li>If betting ever stops feeling in your control, Gambling Help Online is free and open 24/7 on 1800 858 858.</li>
</ul>
<p style="margin:0;color:#4A5A75">Stuck on anything? Ask us on your onboarding call or in Telegram.</p>
</div></div></body></html>`;
}

function welcomeText(name: string, email: string, password: string) {
  return `Welcome aboard, ${name}!

Your login for the tracker:
Website: matchedbtracker.com
Email: ${email}
Password: ${password}

Keep this to yourself and don't share your login with anyone.

Your first steps:

1. Fill out your onboarding form as soon as you can. It only takes a few minutes and we need it before your onboarding call.
   https://docs.google.com/forms/d/e/1FAIpQLSckWUEbhKP9lFOHeMySxESzSlczACvr2z0-gHqWihEpyyPveQ/viewform
2. Save it as an app on your phone.
   iPhone: open matchedbtracker.com in Safari, tap Share, then Add to Home Screen.
   Android: open it in Chrome, tap the menu, then Install app or Add to home screen.
   Laptop: in Chrome, click the install icon at the right of the address bar.
3. Sign in with the email and password above.
4. Watch this video first: How to Use the Tracker
   https://www.youtube.com/watch?v=Ly0eq77XRkA
   It's also in the Learn tab of the app.
5. Download Telegram: https://telegram.org/apps
   We'll add you to the group on your onboarding call.
6. Say hi to the AI coach in the app. It will help you work out your bankroll and your unit size.
7. Your first checkpoint (CP1): open TAB, Bet365 and Neds, and set up Betfair with about $300 to $500 in it. Don't sign up to any other bookies yet. They unlock at later checkpoints.

Good to know:
- Matched betting isn't fully risk-free and results build over time. Only use money you can afford to lose.
- If betting ever stops feeling in your control, Gambling Help Online is free and open 24/7 on 1800 858 858.

Stuck on anything? Ask us on your onboarding call or in Telegram.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    // 1. Who is calling? Only people listed in coach_users may use this.
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(token);
    const caller = u?.user;
    if (!caller?.email) return json({ error: "Not logged in" }, 401);
    const { data: coach } = await admin
      .from("coach_users").select("email")
      .in("email", [caller.email, caller.email.toLowerCase()]).limit(1).maybeSingle();
    if (!coach) return json({ error: "Not authorised as coach" }, 403);

    // 2. Check what was sent.
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!name || name.length > 80) return json({ error: "Enter a name (up to 80 characters)" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
      return json({ error: "Enter a valid email address" }, 400);
    }
    if (password.length < 8 || password.length > 72) {
      return json({ error: "Password must be 8 to 72 characters" }, 400);
    }

    // 3. Create the login (already confirmed, so they can sign in straight away).
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: name, full_name: name },
    });
    if (createErr || !created?.user) {
      const msg = createErr?.message || "Could not create the user";
      const exists = /already|registered|exists/i.test(msg);
      return json({ error: exists ? "That email already has an account" : msg }, exists ? 409 : 500);
    }
    const userId = created.user.id;

    // 4. Give them AI coach access, with their name. If this fails, undo the login so nothing is half-made.
    const { error: accessErr } = await admin.from("ai_access").insert({ user_id: userId, name, granted_at: new Date().toISOString() });
    if (accessErr) {
      await admin.auth.admin.deleteUser(userId);
      return json({ error: "Could not give AI coach access: " + accessErr.message }, 500);
    }

    // 5. Send the welcome email.
    let emailSent = false;
    let emailError: string | null = null;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("WELCOME_FROM");
    if (!resendKey || !from) {
      emailError = "Email is not set up yet (missing RESEND_API_KEY or WELCOME_FROM)";
    } else {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [email],
          subject: SUBJECT,
          html: welcomeHtml(name, email, password),
          text: welcomeText(name, email, password),
        }),
      });
      if (resp.ok) {
        emailSent = true;
      } else {
        const detail = await resp.json().catch(() => ({}));
        emailError = detail?.message || `Email provider error ${resp.status}`;
      }
    }

    return json({ ok: true, userId, emailSent, emailError });
  } catch (e) {
    return json({ error: (e as Error).message || "Server error" }, 500);
  }
});
