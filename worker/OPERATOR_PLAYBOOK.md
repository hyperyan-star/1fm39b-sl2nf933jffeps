# Operator Playbook — Manual £149 Fulfilment

This is the workflow until the Worker is deployed. You're the human in the loop. Each £149 sale = ~30–45 minutes of work using Claude.ai + Postmark.

The Worker code (in this folder) is built and ready. We're keeping it in git but **not deploying it** until you've manually fulfilled ~10 paid customers and the prompt has been hardened against real plans.

---

## When a £149 order comes in

Stripe sends you a payment email. Formspree sends you the wizard submission email with the customer's plan text and metadata.

### Step 1 — Verify the pair (1 min)

- Match the Stripe `client_reference_id` (or just the customer's email) to a Formspree submission with `tier=ai`.
- If you can't find the matching submission, email the customer asking them to forward their plan.
- Note the customer's name, email, and plan length.

### Step 2 — Generate the report in Claude.ai (10–15 min)

1. Open Claude.ai and pick **Sonnet 4.6** (or Opus 4.6 if the plan is genuinely complex / you want maximum quality).
2. Copy the entire contents of [`src/prompt.ts`](src/prompt.ts) (just the prompt string between the backticks — not the `export const` wrapper).
3. Paste as a **system prompt** in Claude.ai's "Customise" / project settings, OR paste at the top of a new conversation.
4. In the user message, paste:
   - First line: `Target endorsing body: [from Formspree submission]`
   - Second line: `Business type: [from Formspree submission]`
   - Third line: `Applicant stage: [from Formspree submission]`
   - Fourth line: `Notes: [from Formspree submission, if any]`
   - Then a separator line: `── BUSINESS PLAN ──`
   - Then the entire plan text from the Formspree submission.
5. Send. Wait for the JSON response (typically 30–60 seconds).

### Step 3 — Validate the JSON output (5 min)

Before sending anything to the customer, manually spot-check:

- **Arithmetic**: sum the 29 question scores. Does it equal `total`? Do the criterion subtotals match (Q1–Q9 = `scores.innovation`, Q10–Q22 = `scores.viability`, Q23–Q29 = `scores.scalability`)?
- **Verdict consistency**: `total ≥ 36` → `likely_pass`, `24–35` → `borderline`, `<24` → `likely_fail`. Fix the verdict if Claude got it wrong.
- **Quote verification**: pick 2–3 commentaries that quote the plan ("the plan states..."). Ctrl-F the plan to confirm the quotes are real, not hallucinated. **If a quote is fake, edit the commentary or regenerate that question's scoring.**
- **All 29 questions present**: count them. Should be exactly 29.
- **Priority fixes count**: should be exactly 3.
- **Rebuild plan**: should have week_1, week_2, week_3, each with focus + tasks + deliverable.

If any of the above fails, regenerate (or edit by hand if the fix is small).

### Step 4 — Render the email (5 min)

You have two options:

**Option A (faster) — render via local Node script:**
```bash
cd worker
npm install        # first time only
node -e "
  const { renderReportEmail } = require('./src/email.ts');
  const report = JSON.parse(require('fs').readFileSync('/tmp/report.json'));
  const submission = { name: 'Customer Name', email: 'customer@example.com' };
  const reportId = 'FE-' + Math.random().toString(36).slice(2, 10).toUpperCase();
  console.log(renderReportEmail(submission, report, reportId));
" > /tmp/report.html
```
(You'll need to set up `ts-node` first; or compile email.ts to JS.)

**Option B (no setup) — paste into a saved Postmark template:**
1. In Postmark dashboard, create a template called "AI Review Report" using the HTML structure from [`src/email.ts`](src/email.ts).
2. Substitute the JSON values into the template using Postmark's `{{variable}}` syntax.
3. Send via Postmark's "Send test" feature.

For the next 10 customers, **Option B is faster**. Once you're past 10, deploy the Worker (Option A becomes automatic).

### Step 5 — Send via Postmark + log the customer (5 min)

1. Send the rendered HTML to the customer's email via Postmark.
   - From: `hello@founderendorsed.co.uk`
   - Subject: `Your Innovator Founder Visa plan review (X/58 — verdict)`
   - Tag: `ai-review`
2. Save a copy of the Claude conversation + the rendered HTML in a folder named `customers/{report-id}/`.
3. In a tracking spreadsheet, log: date, customer name, plan length, verdict, total score, prompt issues you noticed (for iteration).

---

## What to iterate after every customer

After each fulfilment, ask:
- Did Claude follow the prompt? (Voice authentic? JSON valid? Calibration honest?)
- Did the customer receive the email cleanly? (Render correctly? Mobile-readable?)
- Did the report identify the same weaknesses you'd identify yourself?
- What did Claude miss or over-emphasise? (Note in tracking sheet.)

Every 5 customers, **revise the prompt** based on the patterns you've seen. Tweak anchors, add edge-case handling, sharpen calibration.

When you've done 10 fulfilments and the prompt has been stable for 5 in a row, you're ready to deploy the Worker.

---

## Deploying the Worker (when ready)

Pre-deployment checklist (from agents' critique):
- [ ] Set Claude `temperature` to **0** in `src/index.ts` (currently 0.3 — fine for manual but risks scoring drift in production).
- [ ] Add a quote-verification post-processing step in `generateReport()`: regex-match every quoted phrase in the JSON against the source plan. Strip unverifiable quotes or regenerate.
- [ ] Add Stripe webhook idempotency: dedupe on Stripe event ID via KV (key: `stripe-event:{id}`, TTL 24h).
- [ ] Add retry logic on Anthropic 429/529 (3 attempts with exponential backoff).
- [ ] Add a daily cron to alert on KV records stuck in `paid` status without `report_sent` after 1 hour.
- [ ] Consider splitting the single Claude call into two passes (scoring → narrative) for robustness. Cost goes from £0.10 to £0.40 per report — still 99% margin on £149.
- [ ] Position the £349 Expert Review upsell in the AI report's "what an AI cannot resolve" section to enable rather than cannibalise.

Then follow the deployment steps in [README.md](README.md).

---

## Why we're doing it this way

The decision to fulfil manually first is deliberate. Three reasons:
1. **Validation**: zero paying customers today. Don't optimise infrastructure for imaginary tenth customer.
2. **Prompt iteration**: the prompt is theoretically calibrated. It needs ~10 real plans to harden. Manual fulfilment is the QA loop.
3. **Quality safety net**: at £149, one broken email = refund + reputational hit. Manual oversight catches the failure modes the prompt hasn't anticipated yet.

Ship manual. Sell ten. Then automate.
