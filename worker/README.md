# Founder Endorsed — AI Review Worker

Cloudflare Worker that turns a £149 Stripe payment into an AI-generated business plan review email within ~60 seconds.

## Flow

```
Wizard ──► POST /submit ──► stores plan in KV ──► returns Stripe URL with submissionId
                                                          │
                                                          ▼
                                                   Customer pays
                                                          │
Stripe ──► POST /webhook/stripe ──► fetch plan from KV ──► Claude API ──► Postmark email
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/submit` | Wizard submits plan, gets back Stripe URL |
| POST | `/webhook/stripe` | Stripe signals payment completion → triggers report |

## Required secrets (set via Cloudflare dashboard)

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` from console.anthropic.com |
| `POSTMARK_TOKEN` | Server API Token from postmarkapp.com |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from Stripe webhook config |
| `STRIPE_LINK_AI` | `https://buy.stripe.com/...` for £149 AI Review |
| `FROM_EMAIL` | Verified Postmark sender, e.g. `hello@founderendorsed.co.uk` |
| `SITE_ORIGIN` | `https://founderendorsed.co.uk` (CORS) |

## Deploy

Pushed via Git integration. Cloudflare auto-deploys on push to `main`.
Root directory: `/worker`.

## Local dev (optional)

```bash
cd worker
npm install
cp .dev.vars.example .dev.vars  # add your secrets here, gitignored
npm run dev
```
