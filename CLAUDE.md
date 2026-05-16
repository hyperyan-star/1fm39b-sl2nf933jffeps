# CLAUDE.md — Founder Endorsed

## Project: Founder Endorsed
- **What it is:** 1:1 consulting & advisory for the UK **Innovator Founder Visa**
- **Domain:** founderendorsed.co.uk
- **Value prop:** Bespoke engagements that pressure-test a business plan against the actual endorsement criteria and the chosen endorsing body's scoring lens. Free 30-min discovery call → fixed scope + quote within 48h → delivery in 1–4 weeks. Engagements from £499. No retainers, no monthly contracts.
- **Four service lanes (on-page):** (1) Plan review & brainstorming, (2) Endorsing body strategy, (3) Interview & rejection rebuild, (4) Post-endorsement advisory (12/24/36-mo milestones — job creation, investment, growth proof).
- **Target user:** Prospective Innovator Founder Visa applicants — including rejected applicants rebuilding for resubmission (one of the most common engagements). Works with applicants worldwide via Zoom/Google Meet.
- **Founder story (on-page):** Yan rebuilt his own rejected plan against the actual endorsement criteria, got endorsed on the rebuild, and now does the same for other founders.
- **Not a law firm:** Plan and endorsement strategy only — no immigration legal advice. Complements an immigration solicitor; doesn't replace one. The plan must remain the founder's own (no ghostwriting from scratch).
- **Confidentiality promise (on-page):** Plans never shared, never used for marketing, never used to train models.

## Who You're Working With
- **Yan (Ian)** — Founder, based in UK
- Non-technical — explain code/technical concepts in plain English
- Prefers brief, direct communication
- Runs multiple ventures (Flarepoint is the main SaaS; Founder Endorsed is a separate advisory site)
- Uses: VSCode + Claude Code, Google Workspace, Calendly, Google Ads, Google Analytics

---

## Tech Stack (THIS repo only)
- **Single static site** — no framework, no build step
- [index.html](index.html) — one file containing all HTML, inline CSS, and vanilla JS
- [sitemap.xml](sitemap.xml), [robots.txt](robots.txt), [CNAME](CNAME) — GitHub Pages hosting
- **Booking / lead capture:** Calendly (`calendly.com/hello-founderendorsed/30min`) — the only CTA. Every "Book a call" button links here. No Stripe, no Formspree, no payment on-site.
- **Analytics:** Google Ads (`AW-18006245330`) + GA4 (`G-LYZFFLDV2N`) sharing one gtag.js loader. `trackEvent(...)` fires conversion events on every CTA click (`nav_cta_click`, `hero_cta_click`, `how_we_work_cta_click`, `final_cta_click`).
- **SEO:** Structured data (ProfessionalService + FAQPage JSON-LD), OG tags, canonical URL

### What this repo is NOT
- Not React, not Lovable, not Supabase, not a SaaS app
- No package.json, no node_modules, no build tooling
- Do NOT suggest React components, Supabase RLS, or Edge Functions here — those rules belong to the Flarepoint repo

---

## Code Standards (for this static site)

### Editing index.html
- It's a single file — be surgical with Edit, don't rewrite whole sections
- Keep inline CSS variables (`:root`) consistent — the design system lives there
- Preserve existing `trackEvent(...)` calls on CTAs — they're wired to Google Ads conversion events
- Don't break the Calendly CTA links — every CTA points to `https://calendly.com/hello-founderendorsed/30min` with `target="_blank" rel="noopener"`
- Don't reintroduce paywall / payment / "£99 report" copy — that model is dead (see commit `bf5a507`)
- Test changes by opening index.html in a browser — no build step needed
- Mobile-first: check responsive breakpoints before shipping layout changes

### SEO & marketing assets
- Keep [sitemap.xml](sitemap.xml) and canonical URLs in sync if routes change
- Structured data (JSON-LD) must stay valid — test with Google's Rich Results Test if edited
- Don't break OG image references (`og-image.png`)

### Security

- Never commit API keys, tokens, or any credentials
- Public IDs that are safe to ship: Calendly link, Google Ads ID (`AW-...`), GA4 ID (`G-...`). Private secrets must never land in the repo.
- No on-site form posts or payment flows today — if one is added later, validate input on the client and never trust it

---

## Self-Checking & Quality Rules

### The 3-Strike Rule
If you hit 3 consecutive errors on the same approach:
1. **STOP** — don't keep retrying
2. Reassess: "Am I solving the right problem?"
3. Consider 2 alternatives before continuing
4. Tell the user what went wrong and what you're changing

### Mandatory Verification
Before marking a task complete:
- **HTML/CSS edits:** Verify the file still parses, check the affected section renders correctly
- **SEO changes:** Validate structured data, confirm sitemap references exist
- **Copy changes:** Re-read aloud — does it match the tone of surrounding copy?
- **Claims/facts (e.g. visa rules):** If <95% sure, search first — visa criteria change

### Anti-Tunnel-Vision
- After every 5 tool calls on the same task, pause: "Still on the right track?"
- If a task takes 3× longer than expected, stop and tell the user
- Read error messages carefully before trying a fix
- "Let me try one more time" = signal to change approach

### Honest Uncertainty
- If guessing, say "I'm not certain, but..."
- "I don't know, let me check" > confident wrong answer
- For visa rules, pricing, or anything current: always search first

---

## Communication Style
- Brief and direct by default — no preamble
- Plain English for technical concepts
- One question at a time
- Use analogies for complex concepts
- Don't over-apologise — fix it and move on

---

## Decision-Making Priority
1. **Security** — never compromise on secrets or user data
2. **Correctness** — right answer > fast answer
3. **Simplicity** — simplest solution that works (this is a static site; keep it that way)
4. **Speed** — after the above are satisfied, be efficient
