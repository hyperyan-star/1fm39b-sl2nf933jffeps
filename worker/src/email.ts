function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

interface ReportSubmission {
  name: string;
  email: string;
  endorsing_body?: string;
}

interface Report {
  scores: { innovation: number; viability: number; scalability: number };
  overall_assessment: string;
  criteria: Record<"innovation" | "viability" | "scalability", {
    strengths: string[];
    weaknesses: { issue: string; why_it_matters: string; fix: string }[];
  }>;
  rejection_risks: string[];
  next_steps: string[];
}

export function renderReportEmail(submission: ReportSubmission, r: Report): string {
  const avg = (r.scores.innovation + r.scores.viability + r.scores.scalability) / 3;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Your Innovator Founder Visa Plan Review</title>
</head>
<body style="margin:0;padding:0;background:#f3f0ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111827;line-height:1.6;">
<div style="max-width:640px;margin:0 auto;background:#ffffff;">

  <div style="background:#070b14;padding:32px;text-align:center;">
    <div style="color:#10b981;font-weight:700;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;">Founder Endorsed</div>
    <div style="color:#ffffff;font-size:22px;font-weight:800;margin-top:8px;">Your Plan Review</div>
  </div>

  <div style="padding:32px;">
    <p style="margin:0 0 24px;font-size:16px;">Hi ${escapeHtml(submission.name)},</p>
    <p style="margin:0 0 24px;font-size:16px;">Here's the AI-powered review of your Innovator Founder Visa business plan, scored against the 3 endorsement criteria.</p>

    ${scoreCard("Innovation", r.scores.innovation)}
    ${scoreCard("Viability", r.scores.viability)}
    ${scoreCard("Scalability", r.scores.scalability)}

    <div style="background:#f8fafb;border-left:4px solid #10b981;padding:16px 20px;margin:24px 0;border-radius:0 8px 8px 0;">
      <div style="font-weight:700;font-size:14px;color:#10b981;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Overall (${avg.toFixed(1)}/10)</div>
      <div style="font-size:15px;line-height:1.6;">${escapeHtml(r.overall_assessment)}</div>
    </div>

    ${criterionSection("Innovation", r.criteria.innovation)}
    ${criterionSection("Viability", r.criteria.viability)}
    ${criterionSection("Scalability", r.criteria.scalability)}

    ${r.rejection_risks.length ? `
      <h2 style="font-size:18px;font-weight:700;margin:32px 0 12px;color:#ef4444;">Rejection risks to fix before submitting</h2>
      <ul style="margin:0 0 24px;padding-left:20px;">
        ${r.rejection_risks.map((risk) => `<li style="margin-bottom:8px;font-size:15px;">${escapeHtml(risk)}</li>`).join("")}
      </ul>
    ` : ""}

    ${r.next_steps.length ? `
      <h2 style="font-size:18px;font-weight:700;margin:32px 0 12px;color:#111827;">Your next steps (in priority order)</h2>
      <ol style="margin:0 0 24px;padding-left:20px;">
        ${r.next_steps.map((step) => `<li style="margin-bottom:10px;font-size:15px;">${escapeHtml(step)}</li>`).join("")}
      </ol>
    ` : ""}

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;">

    <p style="font-size:14px;color:#4b5563;margin:0 0 12px;">Need a deeper review with a senior human reviewer + 30-min strategy call? Upgrade to <a href="https://founderendorsed.co.uk/#pricing" style="color:#10b981;font-weight:600;text-decoration:none;">Expert Review (£349)</a> — we credit your £149 toward it if you upgrade within 7 days.</p>

    <p style="font-size:13px;color:#9ca3af;margin:24px 0 0;">Reviewed for the UK Innovator Founder Visa endorsement criteria (2026). This is plan analysis, not immigration legal advice.</p>
  </div>

  <div style="background:#f3f0ea;padding:20px;text-align:center;font-size:12px;color:#9ca3af;">
    Founder Endorsed · <a href="https://founderendorsed.co.uk" style="color:#9ca3af;">founderendorsed.co.uk</a>
  </div>
</div>
</body>
</html>`;
}

function scoreCard(label: string, score: number): string {
  const colour = score >= 7 ? "#10b981" : score >= 5 ? "#f59e0b" : "#ef4444";
  const pct = (score / 10) * 100;
  return `
    <div style="margin:16px 0;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
        <div style="font-size:14px;font-weight:600;color:#4b5563;">${label}</div>
        <div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:18px;font-weight:800;color:${colour};">${score}/10</div>
      </div>
      <div style="background:#e5e7eb;height:6px;border-radius:3px;overflow:hidden;">
        <div style="background:${colour};width:${pct}%;height:100%;"></div>
      </div>
    </div>`;
}

function criterionSection(label: string, c: { strengths: string[]; weaknesses: { issue: string; why_it_matters: string; fix: string }[] }): string {
  return `
    <h2 style="font-size:18px;font-weight:700;margin:32px 0 12px;color:#111827;">${label}</h2>

    ${c.strengths.length ? `
      <div style="font-size:13px;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">What's working</div>
      <ul style="margin:0 0 20px;padding-left:20px;">
        ${c.strengths.map((s) => `<li style="margin-bottom:6px;font-size:15px;">${escapeHtml(s)}</li>`).join("")}
      </ul>
    ` : ""}

    ${c.weaknesses.length ? `
      <div style="font-size:13px;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">What to fix</div>
      ${c.weaknesses.map((w) => `
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 16px;margin-bottom:12px;">
          <div style="font-weight:600;font-size:15px;color:#111827;margin-bottom:6px;">${escapeHtml(w.issue)}</div>
          <div style="font-size:14px;color:#4b5563;margin-bottom:8px;"><strong>Why it matters:</strong> ${escapeHtml(w.why_it_matters)}</div>
          <div style="font-size:14px;color:#111827;"><strong>Fix:</strong> ${escapeHtml(w.fix)}</div>
        </div>
      `).join("")}
    ` : ""}
  `;
}
