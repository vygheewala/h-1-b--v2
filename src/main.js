/**
 * ============================================================
 * H1B JOB HUNTER v2 — MAIN ACTOR
 * ============================================================
 *
 * PIPELINE:
 *
 *  [INPUT: keywords + location + timeFilter + skills]
 *           │
 *           ▼
 *  [Google ATS Search]
 *  site:greenhouse.io "CPA" Chicago, IL  &tbs=qdr:d
 *  site:lever.co "GAAP"                  &tbs=qdr:d
 *  ... (keywords × 8 ATS platforms)
 *           │
 *           ▼
 *  [For each job URL found:]
 *   ├─ Fetch full description (Playwright)
 *   ├─ Sponsorship language detector  ← catches "no H1B" disclaimers
 *   ├─ H1B history checker            ← local DOL LCA data
 *   ├─ E-Verify checker               ← local lookup
 *   ├─ Agency detector
 *   ├─ Skill match score (1–10)
 *   └─ Visa friendliness score (1–10)
 *           │
 *           ▼
 *  [Ranked CSV + JSON output]
 */

import { Actor, Dataset } from 'apify';
import { scrapeATSJobs, isValidCompany } from './scrapers/ats-google.js';
import { checkH1BHistory }         from './checkers/h1b-checker.js';
import { checkEVerify }            from './checkers/everify-checker.js';
import { detectStaffingAgency }    from './utils/agency-detector.js';
import { calculateSkillScore, calculateVisaScore, calculateUrgency, buildEnrichedSkillsList } from './utils/scorer.js';
import { detectSponsorshipLanguage } from './utils/sponsorship-detector.js';
import { fetchJobDescription }       from './utils/description-fetcher.js';
import { createObjectCsvWriter }   from 'csv-writer';

await Actor.main(async () => {
  console.log('🚀 H1B Job Hunter v2 starting...');
  console.log('═'.repeat(60));

  // ── STEP 1: READ INPUTS ──────────────────────────────────────
  const input = await Actor.getInput();

  const {
    keywords             = 'CPA\nGAAP\ninternal audit',
    location             = 'United States',
    timeFilter           = 'Past 24 Hours',
    skills               = '',
    resumeText           = '',
    optEndDate           = '',
    maxJobsPerKeyword    = 30,
    excludeStaffingAgencies = true,
    minimumVisaScore     = 3,
    outputFormat         = 'both',
  } = input || {};

  const keywordsArray = keywords.split('\n').map(k => k.trim()).filter(Boolean);
  // Skills from the form field
  const skillsFromForm = skills.split("\n").map(s => s.trim()).filter(Boolean);

  // Build enriched skills list: form skills + skills extracted from resume
  // This is then matched against JOB descriptions (not mixed with them)
  const enrichedSkills = buildEnrichedSkillsList(skillsFromForm, resumeText);

  console.log(`\n📋 CONFIGURATION`);
  console.log(`   Keywords:    ${keywordsArray.join(', ')}`);
  console.log(`   Location:    ${location}`);
  console.log(`   Time filter: ${timeFilter}`);
  console.log(`   Skills:      ${skillsFromForm.slice(0, 6).join(", ")}${skillsFromForm.length > 6 ? ` (+${skillsFromForm.length - 6} more)` : ""} + ${enrichedSkills.length - skillsFromForm.length} from resume`);
  console.log(`   Resume:      ${resumeText.length > 0 ? resumeText.length + " chars provided" : "Not provided"}`);
  if (optEndDate) {
    const u = calculateUrgency(optEndDate);
    console.log(`\n⏰ OPT STATUS: ${u.urgencyLevel}`);
    console.log(`   ${u.message}`);
  }
  console.log('─'.repeat(60));

  // ── STEP 2: SCRAPE ATS JOBS VIA GOOGLE ──────────────────────
  console.log('\n📡 Phase 1: Searching ATS platforms via Google...');

  let allJobs = [];
  try {
    allJobs = await scrapeATSJobs(keywordsArray, location, timeFilter, maxJobsPerKeyword);
    console.log(`   ✅ ${allJobs.length} unique jobs found across all ATS platforms`);
  } catch (err) {
    console.error(`   ❌ Scraper error: ${err.message}`);
  }

  if (allJobs.length === 0) {
    console.error('\n❌ No jobs found.');
    console.error('   Tips:');
    console.error('   • Try broader keywords (e.g. "CPA" instead of "CPA audit manager")');
    console.error('   • Change time filter to "Past Week" or "All"');
    console.error('   • Try "United States" as location for wider results');
    await Actor.exit();
    return;
  }

  // ── STEP 3: ANALYZE EACH JOB ─────────────────────────────────
  console.log(`\n🔬 Phase 2: Analyzing ${allJobs.length} jobs...`);
  console.log('   (Fetching descriptions + H1B + E-Verify + sponsorship check)\n');

  const analyzedJobs = [];

  for (let i = 0; i < allJobs.length; i++) {
    const job = allJobs[i];
    console.log(`   [${i + 1}/${allJobs.length}] ${job.title}`);
    console.log(`       Company: ${job.company} | Source: ${job.source}`);

    try {
      // 1. Company name validation — skip if URL extraction clearly failed
      if (!isValidCompany(job.company)) {
        console.log(`       ⛔ Skipped — could not extract valid company name (got: "${job.company}")`);
        continue;
      }

      // 2. Non-US filter — skip jobs that appear to be outside the US
      // Detected by 2-letter locale codes like /de/, /fr/, /uk/ in the URL
      const nonUsPattern = /\/(de|fr|uk|au|ca|gb|es|nl|it|br|mx|in|sg|jp|cn)\//i;
      if (nonUsPattern.test(job.jobUrl)) {
        console.log(`       ⛔ Skipped — appears to be a non-US job posting`);
        continue;
      }

      // 3. Agency check
      const agencyResult = detectStaffingAgency(job.company);
      if (excludeStaffingAgencies && agencyResult.isAgency && agencyResult.confidence !== 'low') {
        console.log(`       ⛔ Skipped — ${agencyResult.reason}`);
        continue;
      }

      // 2. Fetch full description from the ATS page
      const fullDesc    = await fetchJobDescription(job.jobUrl);
      const descText    = fullDesc || job.description || '';
      console.log(`       Description: ${descText.length > 50 ? descText.length + ' chars' : 'unavailable'}`);

      // 3. Sponsorship language detection (job-level — most critical)
      const sponsorship = detectSponsorshipLanguage(descText, job.title, job.company);
      if (sponsorship.sponsorshipStatus === 'NO_SPONSORSHIP') {
        console.log(`       🚫 NO SPONSORSHIP — "${sponsorship.matchedPhrase}"`);
      } else if (sponsorship.sponsorshipStatus === 'HAS_SPONSORSHIP') {
        console.log(`       ✅ SPONSORSHIP CONFIRMED`);
      } else if (sponsorship.warningMessage) {
        console.log(`       ⚠️  ${sponsorship.warningMessage}`);
      } else {
        console.log(`       ❓ Sponsorship: not mentioned explicitly`);
      }

      // 4. H1B history (company-level)
      const h1bData = await checkH1BHistory(job.company);

      // 5. E-Verify
      const everify = await checkEVerify(job.company);
      console.log(`       E-Verify: ${everify.status}`);

      // 6. Scoring
      const companySize  = h1bData.petitionCount >= 200 ? 'large' : h1bData.petitionCount >= 20 ? 'medium' : 'small';
      // Skill score: match user skills against job description ONLY (not resume)
      // Resume text is kept separate to avoid inflating all scores to 10/10
      // Match enriched skills (form + resume-extracted) against job description only
      const skillScore   = calculateSkillScore(enrichedSkills, job.title, descText);
      const visaResult   = calculateVisaScore(h1bData, everify.isEVerify, agencyResult.isAgency, companySize);
      const finalVisa    = sponsorship.visaScoreOverride !== null ? sponsorship.visaScoreOverride : visaResult.score;

      // 7. Filter
      if (finalVisa < minimumVisaScore) {
        const why = sponsorship.sponsorshipStatus === 'NO_SPONSORSHIP'
          ? 'Explicitly no H1B sponsorship'
          : `Visa score ${finalVisa} < minimum ${minimumVisaScore}`;
        console.log(`       ⬇️  Excluded — ${why}`);
        continue;
      }

      console.log(`       → Visa: ${finalVisa}/10 | Skill: ${skillScore}/10 ✓`);

      analyzedJobs.push({
        jobTitle:              job.title,
        company:               job.company,
        location:              job.location,
        jobUrl:                job.jobUrl,
        datePosted:            job.datePosted,
        source:                job.source,
        keyword:               job.keyword,
        timeFilter,

        // Scores
        visaFriendlinessScore: finalVisa,
        skillMatchScore:       skillScore,

        // Sponsorship (job-level)
        sponsorshipInJobDesc:  sponsorship.sponsorshipStatus,
        sponsorshipWarning:    sponsorship.warningMessage || '',
        matchedPhrase:         sponsorship.matchedPhrase || '',

        // H1B (company-level)
        h1bSponsorshipHistory: h1bData.found ? 'Yes' : 'Unknown',
        h1bPetitionCount:      h1bData.petitionCount,
        h1bApprovalRate:       h1bData.approvalRate ? `${Math.round(h1bData.approvalRate * 100)}%` : 'Unknown',
        h1bAvgWage:            h1bData.avgWage || 'Unknown',
        h1bProfileUrl:         h1bData.profileUrl || '',

        // E-Verify
        eVerifyStatus:         everify.isEVerify ? 'Yes' : (everify.status === 'not_found' ? 'No' : 'Unknown'),

        // Agency
        isStaffingAgency:      agencyResult.isAgency ? 'Yes' : 'No',

        // OPT context
        optUrgency:            optEndDate ? calculateUrgency(optEndDate).urgencyLevel : 'Not provided',
      });

    } catch (err) {
      console.warn(`       ⚠️  Error: ${err.message}`);
    }
  }

  // ── STEP 4: RANK ─────────────────────────────────────────────
  console.log('\n📈 Phase 3: Ranking...');

  analyzedJobs.sort((a, b) => {
    const sa = (a.visaFriendlinessScore * 0.6) + (a.skillMatchScore * 0.4);
    const sb = (b.visaFriendlinessScore * 0.6) + (b.skillMatchScore * 0.4);
    return sb - sa;
  });
  analyzedJobs.forEach((j, i) => { j.rank = i + 1; });

  console.log(`\n🏆 TOP 5:`);
  analyzedJobs.slice(0, 5).forEach(j => {
    console.log(`   ${j.rank}. ${j.jobTitle} @ ${j.company}`);
    console.log(`      Visa ${j.visaFriendlinessScore}/10 | Skill ${j.skillMatchScore}/10 | H1B: ${j.h1bSponsorshipHistory} | Sponsorship: ${j.sponsorshipInJobDesc}`);
  });

  // ── STEP 5: SAVE ─────────────────────────────────────────────
  console.log('\n💾 Phase 4: Saving...');
  await Dataset.pushData(analyzedJobs);
  console.log(`   ✅ ${analyzedJobs.length} jobs → Apify Dataset`);

  if (outputFormat === 'csv' || outputFormat === 'both') {
    await saveCsv(analyzedJobs);
  }

  // ── SUMMARY ───────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('✅ COMPLETE');
  console.log('═'.repeat(60));
  console.log(`   Keywords searched:      ${keywordsArray.join(', ')}`);
  console.log(`   Time filter:            ${timeFilter}`);
  console.log(`   Raw jobs found:         ${allJobs.length}`);
  console.log(`   After filtering:        ${analyzedJobs.length}`);
  console.log(`   H1B history found:      ${analyzedJobs.filter(j => j.h1bSponsorshipHistory === 'Yes').length}`);
  console.log(`   E-Verify confirmed:     ${analyzedJobs.filter(j => j.eVerifyStatus === 'Yes').length}`);
  console.log(`   Sponsorship confirmed:  ${analyzedJobs.filter(j => j.sponsorshipInJobDesc === 'HAS_SPONSORSHIP').length}`);
  console.log(`   No-sponsor excluded:    (filtered automatically)`);
  if (optEndDate) console.log(`\n⏰ ${calculateUrgency(optEndDate).message}`);
  console.log('\n📂 Download: Apify → Storage → Key-Value Store → OUTPUT_CSV');
  console.log('═'.repeat(60));
});

async function saveCsv(jobs) {
  if (!jobs.length) { console.log('   ⚠️  No jobs to save.'); return; }

  const writer = createObjectCsvWriter({
    path: '/tmp/h1b_results.csv',
    header: [
      { id: 'rank',                  title: 'Rank' },
      { id: 'jobTitle',              title: 'Job Title' },
      { id: 'company',               title: 'Company' },
      { id: 'location',              title: 'Location' },
      { id: 'visaFriendlinessScore', title: 'Visa Score (1-10)' },
      { id: 'skillMatchScore',       title: 'Skill Score (1-10)' },
      { id: 'sponsorshipInJobDesc',  title: 'Sponsorship in Job Description' },
      { id: 'sponsorshipWarning',    title: 'Sponsorship Warning' },
      { id: 'matchedPhrase',         title: 'Matched Phrase' },
      { id: 'h1bSponsorshipHistory', title: 'H1B History (Yes/Unknown)' },
      { id: 'h1bPetitionCount',      title: 'H1B Petition Count' },
      { id: 'h1bApprovalRate',       title: 'H1B Approval Rate' },
      { id: 'h1bAvgWage',            title: 'H1B Avg Wage' },
      { id: 'eVerifyStatus',         title: 'E-Verify (Yes/No/Unknown)' },
      { id: 'isStaffingAgency',      title: 'Staffing Agency?' },
      { id: 'keyword',               title: 'Search Keyword' },
      { id: 'timeFilter',            title: 'Time Filter Used' },
      { id: 'source',                title: 'ATS Platform' },
      { id: 'jobUrl',                title: 'Job URL' },
      { id: 'h1bProfileUrl',         title: 'H1B Profile URL' },
      { id: 'optUrgency',            title: 'OPT Urgency' },
    ],
  });

  await writer.writeRecords(jobs);
  const { readFile } = await import('fs/promises');
  await Actor.setValue('OUTPUT_CSV', await readFile('/tmp/h1b_results.csv'), { contentType: 'text/csv' });
  console.log('   ✅ CSV → Storage → Key-Value Store → OUTPUT_CSV');
}
