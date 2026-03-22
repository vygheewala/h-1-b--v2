/**
 * Job-Level Sponsorship Language Detector
 *
 * Scans full job description text for explicit H1B sponsorship
 * signals — both "will NOT sponsor" and "WILL sponsor."
 *
 * This catches cases like PwC where company history shows 7,000+
 * H1B filings but individual postings say "no sponsorship for this role."
 */

const NO_SPONSORSHIP_PHRASES = [
  // Direct refusals
  'will not sponsor', 'does not sponsor', 'cannot sponsor', 'unable to sponsor',
  'not able to sponsor', 'no sponsorship', 'sponsorship is not available',
  'sponsorship will not be provided', 'does not provide sponsorship',
  'not offering sponsorship', 'visa sponsorship is not available',
  'we are not able to sponsor', 'we do not sponsor', 'we cannot sponsor',
  'not eligible for sponsorship', 'sponsorship not available',
  // PwC-style wording
  'does not intend to hire experienced or entry level job seekers who will need',
  'will need, now or in the future', 'h-1b lottery', 'h1b lottery',
  // Authorization-required phrasing
  'must be authorized to work in the united states without sponsorship',
  'must be authorized to work without sponsorship',
  'authorized to work in the us without sponsorship',
  'without visa sponsorship', 'without employer sponsorship',
  'does not support work visa', 'not support visa sponsorship',
  'must have unrestricted work authorization',
  // Citizenship requirements (almost never sponsor)
  'requires us citizenship', 'must be a us citizen',
  'active security clearance required', 'top secret clearance',
];

const HAS_SPONSORSHIP_PHRASES = [
  'will sponsor', 'visa sponsorship available', 'sponsorship available',
  'sponsorship provided', 'h1b sponsorship', 'h-1b sponsorship',
  'we sponsor', 'open to sponsoring', 'willing to sponsor',
  'sponsorship considered', 'will consider sponsorship',
  'offer visa sponsorship', 'provides visa sponsorship',
  'support h1b', 'support h-1b', 'employer will sponsor',
  'welcome candidates who require', 'candidates requiring sponsorship',
];

const CAUTION_PHRASES = [
  'must be legally authorized', 'legally authorized to work',
  'right to work in the', 'employment eligibility',
];

export function detectSponsorshipLanguage(descriptionText, jobTitle = '', companyName = '') {
  if (!descriptionText || descriptionText.trim().length < 20) {
    return {
      sponsorshipStatus: 'UNKNOWN', confidence: 'low',
      matchedPhrase: null, visaScoreOverride: null,
      warningMessage: 'Description too short — check manually',
    };
  }

  const text = descriptionText.toLowerCase().replace(/\s+/g, ' ');

  // Check no-sponsorship FIRST — most important
  for (const phrase of NO_SPONSORSHIP_PHRASES) {
    if (text.includes(phrase.toLowerCase())) {
      return {
        sponsorshipStatus: 'NO_SPONSORSHIP', confidence: 'high',
        matchedPhrase: phrase,
        visaScoreOverride: 0,
        warningMessage: `🚫 SKIP — "${companyName}" explicitly states NO H1B sponsorship. Phrase: "${phrase}"`,
      };
    }
  }

  // Check positive sponsorship signals
  for (const phrase of HAS_SPONSORSHIP_PHRASES) {
    if (text.includes(phrase.toLowerCase())) {
      return {
        sponsorshipStatus: 'HAS_SPONSORSHIP', confidence: 'high',
        matchedPhrase: phrase,
        visaScoreOverride: null,
        warningMessage: null,
      };
    }
  }

  // Caution signals
  for (const phrase of CAUTION_PHRASES) {
    if (text.includes(phrase.toLowerCase())) {
      return {
        sponsorshipStatus: 'UNKNOWN', confidence: 'medium',
        matchedPhrase: phrase,
        visaScoreOverride: null,
        warningMessage: `⚠️ Contains work-auth language ("${phrase}") — ask HR if they sponsor before applying`,
      };
    }
  }

  return {
    sponsorshipStatus: 'UNKNOWN', confidence: 'low',
    matchedPhrase: null, visaScoreOverride: null, warningMessage: null,
  };
}
