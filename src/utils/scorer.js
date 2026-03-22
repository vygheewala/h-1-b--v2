/**
 * ============================================================
 * SCORING ENGINE
 * ============================================================
 *
 * SKILL MATCH SCORE (1–10):
 *
 *   Uses TWO inputs on YOUR side, matched against the job:
 *
 *   1. skillsArray  — explicit skills you listed in the form
 *      e.g. ["CPA", "GAAP", "Excel", "SQL"]
 *
 *   2. resumeText   — your full resume, used to EXTRACT additional
 *      skills via keyword recognition (certifications, tools,
 *      technologies, job titles, industries)
 *
 *   Both are combined into a single enriched skills list, then
 *   matched against the JOB DESCRIPTION TEXT only.
 *
 *   WHY NOT append resume to job description:
 *   If resume is added to the job text, your own skills are
 *   always found → every job scores 10/10 regardless of fit.
 *   The resume must stay on YOUR side of the comparison.
 *
 * VISA FRIENDLINESS SCORE (1–10):
 *   Based on H1B petition count, approval rate, E-Verify,
 *   direct employer status, and company size.
 */

// ── RESUME SKILL EXTRACTOR ────────────────────────────────────
// Common professional keywords that signal a skill when found
// in resume text. We extract these to enrich the skills list.
const RESUME_SKILL_PATTERNS = [
  // Accounting / Audit
  'cpa', 'cfa', 'cma', 'cia', 'gaap', 'ifrs', 'sox', 'pcaob',
  'audit', 'assurance', 'tax', 'reconciliation', 'financial reporting',
  'internal controls', 'risk assessment', 'compliance',
  'accounts payable', 'accounts receivable', 'general ledger',
  'financial statements', 'budget', 'forecasting', 'variance analysis',
  // Data / Tech
  'sql', 'python', 'excel', 'tableau', 'power bi', 'r programming',
  'data analysis', 'machine learning', 'data visualization',
  'bloomberg', 'quickbooks', 'sap', 'oracle', 'hyperion', 'workday',
  'netsuite', 'salesforce',
  // Finance
  'financial modeling', 'valuation', 'dcf', 'lbo', 'm&a', 'ipo',
  'equity research', 'investment banking', 'private equity',
  'fp&a', 'treasury', 'cash flow', 'working capital',
  // Soft skills / leadership
  'project management', 'team leadership', 'cross-functional',
  'stakeholder management', 'client management', 'communication',
  // Degrees / certs
  'mba', 'master', 'bachelor', 'bsc', 'msc', 'phd',
  // Industries
  'healthcare', 'real estate', 'manufacturing', 'technology',
  'financial services', 'private equity', 'venture capital',
];

/**
 * Extract recognisable skills from free-form resume text.
 * Returns an array of matched skill strings.
 *
 * @param {string} resumeText
 * @returns {string[]} extracted skill keywords
 */
export function extractSkillsFromResume(resumeText) {
  if (!resumeText || resumeText.trim().length < 20) return [];

  const text = resumeText.toLowerCase();
  const found = [];

  for (const skill of RESUME_SKILL_PATTERNS) {
    if (text.includes(skill)) {
      found.push(skill);
    }
  }

  return found;
}

/**
 * Build the combined skills list used for matching.
 * Merges explicit skills (from form) + extracted skills (from resume),
 * deduplicates, and returns a clean array.
 *
 * @param {string[]} skillsFromForm  - skills the user typed in the form
 * @param {string}   resumeText      - full resume text
 * @returns {string[]} enriched, deduplicated skills list
 */
export function buildEnrichedSkillsList(skillsFromForm, resumeText) {
  const fromResume = extractSkillsFromResume(resumeText);

  // Merge: form skills take priority, resume skills are supplementary
  const combined = [
    ...skillsFromForm.map(s => s.toLowerCase().trim()),
    ...fromResume,
  ];

  // Deduplicate
  return [...new Set(combined)].filter(Boolean);
}

/**
 * Calculate Skill Match Score (1–10).
 *
 * Matches enrichedSkills against the job description text only.
 * Resume text is NOT mixed into the job description side —
 * it has already been used to enrich the skills list above.
 *
 * @param {string[]} enrichedSkills  - output of buildEnrichedSkillsList()
 * @param {string}   jobTitle        - job title string
 * @param {string}   jobDescription  - full job description text
 * @returns {number} score 1–10
 */
export function calculateSkillScore(enrichedSkills, jobTitle, jobDescription) {
  if (!enrichedSkills?.length) return 5;

  // Only search the JOB side — never mix in resume text here
  const jobText = `${jobTitle} ${jobDescription}`.toLowerCase();

  let matched = 0;
  for (const skill of enrichedSkills) {
    if (skill.trim() && jobText.includes(skill.toLowerCase().trim())) {
      matched++;
    }
  }

  // Scale to 1–10
  return Math.min(10, Math.max(1, Math.round((matched / enrichedSkills.length) * 9) + 1));
}

/**
 * Calculate Visa Friendliness Score (1–10).
 *
 * Factors:
 *   H1B petition count   → 0–4 pts
 *   H1B approval rate    → 0–2 pts
 *   E-Verify registered  → 0–2 pts
 *   Direct employer      → 0–1 pt
 *   Company size         → 0–1 pt
 */
export function calculateVisaScore(h1bData, isEVerify, isAgency, companySize = 'unknown') {
  let score = 0;
  const breakdown = {};

  const pc = h1bData?.petitionCount ?? 0;
  const pp = pc >= 100 ? 4 : pc >= 20 ? 3 : pc >= 5 ? 2 : pc >= 1 ? 1 : 0;
  score += pp;
  breakdown.petitions = { pts: pp, value: pc };

  const ar = h1bData?.approvalRate ?? null;
  const ap = ar === null ? 0 : ar >= 0.9 ? 2 : ar >= 0.7 ? 1 : 0;
  score += ap;
  breakdown.approvalRate = { pts: ap, value: ar };

  const ep = isEVerify ? 2 : 0;
  score += ep;
  breakdown.eVerify = { pts: ep, value: isEVerify };

  const dp = isAgency ? 0 : 1;
  score += dp;
  breakdown.directEmployer = { pts: dp };

  const sp = companySize === 'large' ? 1 : 0;
  score += sp;
  breakdown.companySize = { pts: sp, value: companySize };

  return { score: Math.max(1, score), breakdown };
}

export function calculateUrgency(optEndDate) {
  if (!optEndDate) return { monthsLeft: null, urgencyLevel: 'unknown', message: 'OPT end date not provided' };

  const monthsLeft = Math.floor((new Date(optEndDate) - new Date()) / (1000 * 60 * 60 * 24 * 30));

  if (monthsLeft < 0)   return { monthsLeft, urgencyLevel: 'EXPIRED',   message: '⛔ OPT may have expired. Contact your DSO immediately.' };
  if (monthsLeft <= 6)  return { monthsLeft, urgencyLevel: 'CRITICAL',  message: `🚨 Only ${monthsLeft} months left! Focus on companies that file H1B by April. Act NOW.` };
  if (monthsLeft <= 12) return { monthsLeft, urgencyLevel: 'HIGH',      message: `⚠️ ${monthsLeft} months left. Start applying to H1B sponsors this month.` };
  if (monthsLeft <= 24) return { monthsLeft, urgencyLevel: 'MODERATE',  message: `📅 ${monthsLeft} months left. Prioritise high-sponsorship employers.` };
  return                       { monthsLeft, urgencyLevel: 'LOW',       message: `✅ ${monthsLeft} months left. Good runway — focus on fit, not just urgency.` };
}
