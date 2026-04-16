function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface ReportSubmission {
  name: string;
  email: string;
  endorsing_body?: string;
}

interface RubricQuestion {
  id: number;
  name: string;
  criterion: "innovation" | "viability" | "scalability";
  score: number;
  max: number;
  commentary: string;
}

interface PriorityFix {
  question_id: number;
  criterion: "innovation" | "viability" | "scalability";
  headline: string;
  fix: string;
}

interface RebuildWeek {
  focus: string;
  tasks: string[];
  deliverable: string;
}

interface Report {
  scores: { innovation: number; viability: number; scalability: number };
  total: number;
  verdict: "likely_pass" | "borderline" | "likely_fail";
  overall_assessment: string;
  priority_fixes: PriorityFix[];
  questions: RubricQuestion[];
  criteria: Record<"innovation" | "viability" | "scalability", {
    strengths: string[];
    weaknesses: { issue: string; why_it_matters: string; fix: string }[];
  }>;
  rejection_risks: string[];
  rebuild_plan: { week_1: RebuildWeek; week_2: RebuildWeek; week_3: RebuildWeek };
}

const CRITERION_MAX = { innovation: 18, viability: 26, scalability: 14 } as const;

const VERDICT_COPY = {
  likely_pass: {
    label: "Likely PASS",
    colour: "#10b981",
    note: "Your plan is in shape to submit. Address any 0-point questions first to maximise approval probability.",
    headline: "",
  },
  borderline: {
    label: "Borderline",
    colour: "#f59e0b",
    note: "Your plan has the bones but needs material work before submission. Focus on the lowest-scoring questions in priority order.",
    headline: "Most plans we score this way pass after one focused rewrite cycle.",
  },
  likely_fail: {
    label: "Likely FAIL",
    colour: "#ef4444",
    note: "Your plan would likely be rejected as-is — but the issues are fixable. Below are the 3 highest-impact rewrites in priority order.",
    headline: "Most plans we score this way pass after a focused rewrite. Don't submit yet.",
  },
} as const;

export function renderReportEmail(submission: ReportSubmission, r: Report, reportId: string): string {
  const verdict = VERDICT_COPY[r.verdict];

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Your Innovator Founder Visa Plan Review</title>
</head>
<body style="margin:0;padding:0;background:#f3f0ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111827;line-height:1.6;">
<div style="max-width:680px;margin:0 auto;background:#ffffff;">

  <div style="background:#070b14;padding:32px;text-align:center;">
    <div style="color:#10b981;font-weight:700;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;">Founder Endorsed</div>
    <div style="color:#ffffff;font-size:22px;font-weight:800;margin-top:8px;">Your Plan Review</div>
  </div>

  <div style="padding:32px;">
    <p style="margin:0 0 24px;font-size:16px;">Hi ${escapeHtml(submission.name)},</p>
    <p style="margin:0 0 24px;font-size:16px;">Here is your AI-powered review, scored against the 29-question rubric used by UK Innovator Founder Visa endorsing-body assessors.</p>

    ${verdict.headline ? `<p style="margin:0 0 16px;font-size:15px;font-weight:600;color:${verdict.colour};">${escapeHtml(verdict.headline)}</p>` : ""}

    ${verdictBlock(r, verdict)}

    ${scoreCard("Innovation (Q1–Q9)", r.scores.innovation, CRITERION_MAX.innovation)}
    ${scoreCard("Viability (Q10–Q22)", r.scores.viability, CRITERION_MAX.viability)}
    ${scoreCard("Scalability (Q23–Q29)", r.scores.scalability, CRITERION_MAX.scalability)}

    <div style="background:#f8fafb;border-left:4px solid #10b981;padding:16px 20px;margin:24px 0;border-radius:0 8px 8px 0;">
      <div style="font-weight:700;font-size:14px;color:#10b981;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Assessor's overall view</div>
      <div style="font-size:15px;line-height:1.6;">${escapeHtml(r.overall_assessment)}</div>
    </div>

    ${r.verdict === "likely_fail" ? failUpsellCard() : ""}

    ${priorityFixesSection(r.priority_fixes)}

    ${r.rejection_risks.length ? `
      <h2 style="font-size:18px;font-weight:700;margin:32px 0 12px;color:#ef4444;">Rejection risks to fix before submitting</h2>
      <ul style="margin:0 0 24px;padding-left:20px;">
        ${r.rejection_risks.map((risk) => `<li style="margin-bottom:8px;font-size:15px;">${escapeHtml(risk)}</li>`).join("")}
      </ul>
    ` : ""}

    ${rebuildPlanSection(r.rebuild_plan)}

    <h2 style="font-size:18px;font-weight:700;margin:40px 0 8px;color:#111827;">Full rubric breakdown — all 29 questions</h2>
    <p style="font-size:13px;color:#6b7280;margin:0 0 16px;">The full audit trail behind your scores. Sorted with lowest-scoring questions first.</p>

    ${rubricSection("Innovation", r.questions.filter(q => q.criterion === "innovation"))}
    ${criterionFixes("Innovation", r.criteria.innovation)}

    ${rubricSection("Viability", r.questions.filter(q => q.criterion === "viability"))}
    ${criterionFixes("Viability", r.criteria.viability)}

    ${rubricSection("Scalability", r.questions.filter(q => q.criterion === "scalability"))}
    ${criterionFixes("Scalability", r.criteria.scalability)}

    ${r.verdict !== "likely_fail" ? bottomUpsellNote() : ""}

    ${methodologyFooter(reportId)}
  </div>

  <div style="background:#f3f0ea;padding:20px;text-align:center;font-size:12px;color:#9ca3af;">
    Founder Endorsed · <a href="https://founderendorsed.co.uk" style="color:#9ca3af;">founderendorsed.co.uk</a> · Report ${escapeHtml(reportId)}
  </div>
</div>
</body>
</html>`;
}

function verdictBlock(r: Report, verdict: typeof VERDICT_COPY[keyof typeof VERDICT_COPY]): string {
  return `
    <div style="background:#0e1420;border-radius:14px;padding:24px;margin-bottom:24px;text-align:center;color:#fff;">
      <div style="font-size:13px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Overall verdict</div>
      <div style="font-size:36px;font-weight:800;color:${verdict.colour};line-height:1;margin-bottom:6px;">${r.total}/58</div>
      <div style="font-size:18px;font-weight:700;color:${verdict.colour};margin-bottom:10px;">${verdict.label}</div>
      <div style="font-size:14px;color:rgba(255,255,255,0.75);max-width:480px;margin:0 auto;">${escapeHtml(verdict.note)}</div>
    </div>`;
}

function failUpsellCard(): string {
  return `
    <div style="background:linear-gradient(135deg,#fef3c7,#fde68a);border:1px solid #f59e0b;border-radius:12px;padding:20px;margin:24px 0;">
      <div style="font-weight:800;font-size:16px;color:#92400e;margin-bottom:6px;">This plan needs a rewrite, not just edits.</div>
      <div style="font-size:14px;color:#78350f;margin-bottom:12px;line-height:1.55;">Expert Review (£349, with £149 credited from this report) — a senior reviewer rewrites the 3 weakest sections + 30-min strategy call to walk through the rewrite. Best for plans scoring below 24/58.</div>
      <a href="https://founderendorsed.co.uk/#pricing" style="display:inline-block;background:#92400e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">Upgrade to Expert Review →</a>
    </div>`;
}

function bottomUpsellNote(): string {
  return `
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;">
    <p style="font-size:14px;color:#4b5563;margin:0 0 12px;">Need a deeper review with a senior human reviewer + 30-min strategy call? Upgrade to <a href="https://founderendorsed.co.uk/#pricing" style="color:#10b981;font-weight:600;text-decoration:none;">Expert Review (£349)</a> — we credit your £149 toward it if you upgrade within 7 days.</p>`;
}

function priorityFixesSection(fixes: PriorityFix[]): string {
  if (!fixes.length) return "";
  return `
    <h2 style="font-size:18px;font-weight:700;margin:32px 0 12px;color:#111827;">Top 3 priority fixes</h2>
    <p style="font-size:13px;color:#6b7280;margin:0 0 16px;">The highest-impact rewrites across all 29 questions, ordered by impact on your score.</p>
    ${fixes.map((f, i) => `
      <div style="background:#f8fafb;border-left:4px solid #10b981;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;gap:12px;">
          <div style="font-weight:800;font-size:15px;color:#111827;">${i + 1}. ${escapeHtml(f.headline)}</div>
          <div style="font-size:12px;color:#6b7280;font-weight:600;white-space:nowrap;">Q${f.question_id} · ${f.criterion}</div>
        </div>
        <div style="font-size:14px;color:#374151;line-height:1.6;">${escapeHtml(f.fix)}</div>
      </div>
    `).join("")}
  `;
}

function rebuildPlanSection(plan: Report["rebuild_plan"]): string {
  const weekCard = (n: number, w: RebuildWeek) => `
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:16px 18px;margin-bottom:12px;">
      <div style="font-weight:800;font-size:15px;color:#10b981;margin-bottom:4px;">Week ${n}</div>
      <div style="font-weight:700;font-size:14px;color:#111827;margin-bottom:8px;">${escapeHtml(w.focus)}</div>
      <ul style="margin:0 0 10px;padding-left:18px;">
        ${w.tasks.map(t => `<li style="font-size:13px;color:#4b5563;margin-bottom:4px;line-height:1.5;">${escapeHtml(t)}</li>`).join("")}
      </ul>
      <div style="font-size:13px;color:#374151;border-top:1px solid #f3f4f6;padding-top:8px;"><strong style="color:#10b981;">Deliverable:</strong> ${escapeHtml(w.deliverable)}</div>
    </div>`;
  return `
    <h2 style="font-size:18px;font-weight:700;margin:32px 0 12px;color:#111827;">Your 3-week rebuild plan</h2>
    <p style="font-size:13px;color:#6b7280;margin:0 0 16px;">A structured sequence to address the highest-impact gaps before resubmitting.</p>
    ${weekCard(1, plan.week_1)}
    ${weekCard(2, plan.week_2)}
    ${weekCard(3, plan.week_3)}
  `;
}

function scoreCard(label: string, score: number, max: number): string {
  const pct = (score / max) * 100;
  const colour = pct >= 60 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444";
  return `
    <div style="margin:16px 0;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
        <div style="font-size:14px;font-weight:600;color:#4b5563;">${label}</div>
        <div style="font-size:18px;font-weight:800;color:${colour};">${score}/${max}</div>
      </div>
      <div style="background:#e5e7eb;height:6px;border-radius:3px;overflow:hidden;">
        <div style="background:${colour};width:${pct}%;height:100%;"></div>
      </div>
    </div>`;
}

function questionRowColour(score: number, max: number): string {
  if (score >= max) return "#10b981";
  if (score === 0) return "#ef4444";
  return "#f59e0b";
}

function rubricSection(label: string, questions: RubricQuestion[]): string {
  // Sort: lowest scores first so the customer sees the worst questions first
  const sorted = [...questions].sort((a, b) => a.score - b.score || a.id - b.id);
  return `
    <h3 style="font-size:15px;font-weight:700;margin:24px 0 8px;color:#111827;">${label}</h3>
    <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:14px;">
      ${sorted.map((q) => {
        const colour = questionRowColour(q.score, q.max);
        return `
          <tr style="border-top:1px solid #e5e7eb;">
            <td style="padding:10px 8px 10px 0;vertical-align:top;width:46px;">
              <div style="border-left:3px solid ${colour};padding-left:8px;font-weight:700;color:#9ca3af;">Q${q.id}</div>
            </td>
            <td style="padding:10px 8px;vertical-align:top;">
              <div style="font-weight:600;color:#111827;">${escapeHtml(q.name)}</div>
              <div style="font-size:13px;color:#4b5563;line-height:1.5;margin-top:4px;">${escapeHtml(q.commentary)}</div>
            </td>
            <td style="padding:10px 0 10px 8px;vertical-align:top;text-align:right;font-weight:700;color:${colour};white-space:nowrap;">${q.score}/${q.max}</td>
          </tr>`;
      }).join("")}
    </table>`;
}

function criterionFixes(label: string, c: { strengths: string[]; weaknesses: { issue: string; why_it_matters: string; fix: string }[] }): string {
  if (!c.strengths.length && !c.weaknesses.length) return "";
  return `
    ${c.strengths.length ? `
      <div style="font-size:13px;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:0.05em;margin:16px 0 8px;">${label} — what's working</div>
      <ul style="margin:0 0 20px;padding-left:20px;">
        ${c.strengths.map((s) => `<li style="margin-bottom:6px;font-size:14px;">${escapeHtml(s)}</li>`).join("")}
      </ul>
    ` : ""}

    ${c.weaknesses.length ? `
      <div style="font-size:13px;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:0.05em;margin:16px 0 8px;">${label} — what to fix</div>
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

function methodologyFooter(reportId: string): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  return `
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 20px;">
    <div style="background:#f9fafb;border-radius:8px;padding:14px 16px;font-size:12px;color:#6b7280;line-height:1.6;">
      <div style="font-weight:700;color:#374151;margin-bottom:6px;">Methodology</div>
      Scored against a 29-criterion rubric mirroring UKES endorsing-body assessment (Innovation 9 questions / Viability 13 / Scalability 7). Scoring uses anchored 0/1/2 scales calibrated against real pass and fail patterns. Report version 1.0 · Generated ${escapeHtml(dateStr)} · Report ID ${escapeHtml(reportId)}.
      <br><br>
      Questions, edits, or want a human to second-opinion the AI? Reply to this email and we'll get back to you within 24 hours.
      <br><br>
      This is plan analysis, not immigration legal advice. Always consult an OISC-registered adviser for legal guidance.
    </div>`;
}
