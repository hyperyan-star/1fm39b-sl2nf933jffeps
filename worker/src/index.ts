import { SCORING_PROMPT } from "./prompt";
import { renderReportEmail } from "./email";

export interface Env {
  PLANS: KVNamespace;
  ANTHROPIC_API_KEY: string;
  POSTMARK_TOKEN: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_LINK_AI: string;
  FROM_EMAIL: string;
  SITE_ORIGIN: string;
}

interface PlanSubmission {
  name: string;
  email: string;
  plan: string;
  notes?: string;
  stage?: string;
  business_type?: string;
  business_type_other?: string;
  endorsing_body?: string;
  tier: "ai" | "expert";
  createdAt: number;
  status: "pending_payment" | "paid" | "report_sent" | "failed";
}

interface ClaudeReport {
  scores: { innovation: number; viability: number; scalability: number };
  overall_assessment: string;
  criteria: {
    innovation: CriterionDetail;
    viability: CriterionDetail;
    scalability: CriterionDetail;
  };
  rejection_risks: string[];
  next_steps: string[];
}

interface CriterionDetail {
  strengths: string[];
  weaknesses: { issue: string; why_it_matters: string; fix: string }[];
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Preflight CORS for the wizard
    if (request.method === "OPTIONS") return cors(env, new Response(null, { status: 204 }));

    if (url.pathname === "/health") return cors(env, json({ ok: true }));
    if (url.pathname === "/submit" && request.method === "POST") return cors(env, await handleSubmit(request, env));
    if (url.pathname === "/webhook/stripe" && request.method === "POST") return handleStripeWebhook(request, env);

    return cors(env, json({ error: "not found" }, 404));
  },
};

// ─────────────────────────────────────────────────────────────
// /submit — wizard sends plan here, gets back a Stripe URL
// ─────────────────────────────────────────────────────────────
async function handleSubmit(request: Request, env: Env): Promise<Response> {
  let body: Partial<PlanSubmission>;
  try {
    body = await request.json<Partial<PlanSubmission>>();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return json({ error: "invalid email" }, 400);
  if (!body.name || body.name.trim().length < 1) return json({ error: "name required" }, 400);
  if (!body.plan || body.plan.trim().length < 50) return json({ error: "plan too short (min 50 chars)" }, 400);
  if (body.plan.length > 100_000) return json({ error: "plan too long (max 100k chars)" }, 400);
  if (body.tier !== "ai" && body.tier !== "expert") return json({ error: "invalid tier" }, 400);

  const submissionId = crypto.randomUUID();
  const submission: PlanSubmission = {
    name: body.name.trim(),
    email: body.email.trim().toLowerCase(),
    plan: body.plan.trim(),
    notes: body.notes?.trim(),
    stage: body.stage,
    business_type: body.business_type,
    business_type_other: body.business_type_other,
    endorsing_body: body.endorsing_body,
    tier: body.tier,
    createdAt: Date.now(),
    status: "pending_payment",
  };

  // Store in KV with 7-day TTL — long enough for slow buyers, short enough to garbage-collect abandoned carts
  await env.PLANS.put(`plan:${submissionId}`, JSON.stringify(submission), {
    expirationTtl: 60 * 60 * 24 * 7,
  });

  const stripeUrl = new URL(env.STRIPE_LINK_AI);
  stripeUrl.searchParams.set("client_reference_id", submissionId);
  stripeUrl.searchParams.set("prefilled_email", submission.email);

  return json({ submissionId, stripeUrl: stripeUrl.toString() });
}

// ─────────────────────────────────────────────────────────────
// /webhook/stripe — Stripe pings here when payment completes
// ─────────────────────────────────────────────────────────────
async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  const signature = request.headers.get("Stripe-Signature");
  const payload = await request.text();

  if (!signature) return json({ error: "missing signature" }, 400);
  if (!(await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET))) {
    return json({ error: "bad signature" }, 400);
  }

  let event: { type: string; data: { object: { client_reference_id?: string; customer_email?: string } } };
  try {
    event = JSON.parse(payload);
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  // Only act on completed checkout sessions; ack everything else
  if (event.type !== "checkout.session.completed") return json({ received: true });

  const submissionId = event.data.object.client_reference_id;
  if (!submissionId) {
    console.error("checkout.session.completed missing client_reference_id");
    return json({ received: true }); // Ack so Stripe doesn't retry
  }

  const stored = await env.PLANS.get(`plan:${submissionId}`);
  if (!stored) {
    console.error(`No KV entry for submission ${submissionId} — submission may have expired`);
    return json({ received: true });
  }

  const submission: PlanSubmission = JSON.parse(stored);
  submission.status = "paid";
  await env.PLANS.put(`plan:${submissionId}`, JSON.stringify(submission), {
    expirationTtl: 60 * 60 * 24 * 30, // extend to 30d after payment for support purposes
  });

  // Generate the AI report and email it. We do this synchronously so any error
  // is visible in Stripe's webhook log; if it takes >25s we'd need waitUntil.
  try {
    const report = await generateReport(submission, env);
    await sendReportEmail(submission, report, env);
    submission.status = "report_sent";
    await env.PLANS.put(`plan:${submissionId}`, JSON.stringify(submission), {
      expirationTtl: 60 * 60 * 24 * 30,
    });
  } catch (err) {
    submission.status = "failed";
    await env.PLANS.put(`plan:${submissionId}`, JSON.stringify(submission), {
      expirationTtl: 60 * 60 * 24 * 30,
    });
    console.error(`Report generation failed for ${submissionId}:`, err);
    // Send a holding email so the customer knows we got their payment
    await sendHoldingEmail(submission, env).catch((e) => console.error("Holding email also failed:", e));
  }

  return json({ received: true });
}

// ─────────────────────────────────────────────────────────────
// Claude API call
// ─────────────────────────────────────────────────────────────
async function generateReport(submission: PlanSubmission, env: Env): Promise<ClaudeReport> {
  const userMessage = [
    submission.endorsing_body ? `Target endorsing body: ${submission.endorsing_body}` : "",
    submission.business_type
      ? `Business type: ${submission.business_type}${submission.business_type_other ? ` (${submission.business_type_other})` : ""}`
      : "",
    submission.stage ? `Applicant stage: ${submission.stage}` : "",
    submission.notes ? `Applicant notes: ${submission.notes}` : "",
    "",
    "── BUSINESS PLAN ──",
    submission.plan,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      temperature: 0.3,
      system: SCORING_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as { content: { type: string; text: string }[] };
  const text = data.content.find((c) => c.type === "text")?.text;
  if (!text) throw new Error("Anthropic returned no text content");

  // Claude returns prose-wrapped JSON; extract the JSON block
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Could not extract JSON from Claude response");

  try {
    return JSON.parse(match[0]) as ClaudeReport;
  } catch (e) {
    throw new Error(`Could not parse Claude JSON: ${e}\nRaw: ${match[0].slice(0, 500)}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Postmark email send
// ─────────────────────────────────────────────────────────────
async function sendReportEmail(submission: PlanSubmission, report: ClaudeReport, env: Env): Promise<void> {
  const html = renderReportEmail(submission, report);
  const subject = `Your Innovator Founder Visa plan review (${avgScore(report).toFixed(1)}/10)`;

  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "X-Postmark-Server-Token": env.POSTMARK_TOKEN,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      From: env.FROM_EMAIL,
      To: submission.email,
      Subject: subject,
      HtmlBody: html,
      TextBody: stripHtml(html),
      MessageStream: "outbound",
      Tag: "ai-review",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Postmark ${res.status}: ${errText}`);
  }
}

async function sendHoldingEmail(submission: PlanSubmission, env: Env): Promise<void> {
  const html = `<p>Hi ${escapeHtml(submission.name)},</p>
    <p>Your payment for the £149 AI Review came through — thank you.</p>
    <p>Our automated report had a hiccup generating this time. A reviewer has been notified
    and will email you the full report manually within 24 hours.</p>
    <p>If you need anything sooner, just reply to this email.</p>
    <p>— Founder Endorsed</p>`;

  await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "X-Postmark-Server-Token": env.POSTMARK_TOKEN,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      From: env.FROM_EMAIL,
      To: submission.email,
      Subject: "Your AI Review — quick update",
      HtmlBody: html,
      MessageStream: "outbound",
      Tag: "ai-review-holding",
    }),
  });
}

// ─────────────────────────────────────────────────────────────
// Stripe webhook signature verification (HMAC-SHA256)
// ─────────────────────────────────────────────────────────────
async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  // Stripe-Signature looks like: t=1234567890,v1=hex,v1=hex
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const [k, ...v] = kv.split("=");
      return [k!, v.join("=")];
    })
  );
  const timestamp = parts.t;
  const sigs = header
    .split(",")
    .filter((kv) => kv.startsWith("v1="))
    .map((kv) => kv.slice(3));

  if (!timestamp || sigs.length === 0) return false;

  // Reject events older than 5 min to defeat replay attacks
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (ageSeconds > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expectedBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expectedHex = [...new Uint8Array(expectedBuf)].map((b) => b.toString(16).padStart(2, "0")).join("");

  return sigs.some((sig) => timingSafeEqual(sig, expectedHex));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function cors(env: Env, response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", env.SITE_ORIGIN || "*");
  headers.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "86400");
  return new Response(response.body, { status: response.status, headers });
}

function avgScore(r: ClaudeReport): number {
  return (r.scores.innovation + r.scores.viability + r.scores.scalability) / 3;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
