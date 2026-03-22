/**
 * Scoring Engine
 *
 * SKILL MATCH SCORE (1–10):
 *   How many of your skills appear in the job description.
 *
 * VISA FRIENDLINESS SCORE (1–10):
 *   Based on H1B petition count, approval rate, E-Verify,
 *   direct employer status, and company size.
 *
 * URGENCY (informational):
 *   Based on your OPT end date.
 */

export function calculateSkillScore(userSkills, jobTitle, jobDescription) {
  if (!userSkills?.length) return 5;
  const text = `${jobTitle} ${jobDescription}`.toLowerCase();
  let matched = 0;
  for (const skill of userSkills) {
    if (skill.trim() && text.includes(skill.toLowerCase().trim())) matched++;
  }
  return Math.min(10, Math.max(1, Math.round((matched / userSkills.length) * 9) + 1));
}

export function calculateVisaScore(h1bData, isEVerify, isAgency, companySize = 'unknown') {
  let score = 0;
  const breakdown = {};

  // H1B petition count (0–4 pts)
  const pc = h1bData?.petitionCount ?? 0;
  const pp = pc >= 100 ? 4 : pc >= 20 ? 3 : pc >= 5 ? 2 : pc >= 1 ? 1 : 0;
  score += pp;
  breakdown.petitions = { pts: pp, value: pc };

  // Approval rate (0–2 pts)
  const ar = h1bData?.approvalRate ?? null;
  const ap = ar === null ? 0 : ar >= 0.9 ? 2 : ar >= 0.7 ? 1 : 0;
  score += ap;
  breakdown.approvalRate = { pts: ap, value: ar };

  // E-Verify (0–2 pts)
  const ep = isEVerify ? 2 : 0;
  score += ep;
  breakdown.eVerify = { pts: ep, value: isEVerify };

  // Direct employer (0–1 pt)
  const dp = isAgency ? 0 : 1;
  score += dp;
  breakdown.directEmployer = { pts: dp };

  // Company size (0–1 pt)
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
