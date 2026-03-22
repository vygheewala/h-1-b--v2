/**
 * Staffing Agency & Body-Shop Detector
 *
 * ATS-sourced jobs are mostly direct employers, but this
 * provides a safety net for any that slip through.
 */

const KNOWN_AGENCIES = new Set([
  'infosys bpo', 'wipro', 'tcs', 'tata consultancy', 'hcl technologies',
  'hcl america', 'tech mahindra', 'mphasis', 'hexaware', 'mastech',
  'mastech digital', 'syntel', 'staffmark', 'manpower', 'adecco',
  'kelly services', 'spherion', 'randstad', 'volt information',
  'teksystems', 'tek systems', 'insight global', 'apex systems',
  'diversant', 'diverse lynx', 'compunnel', 'nityo infotech',
  'datamatics', 'system soft technologies', 'softpath system',
]);

const STAFFING_KEYWORDS = [
  'staffing', 'recruiting', 'recruitment', 'placement', 'workforce solutions',
  'talent solutions', 'corp to corp', 'c2c', 'contract staffing',
];

const WHITELIST = new Set([
  'deloitte', 'mckinsey', 'boston consulting', 'bain', 'accenture',
  'pwc', 'ernst', 'kpmg', 'ibm consulting',
]);

export function detectStaffingAgency(companyName) {
  const norm = companyName.toLowerCase().trim();

  for (const safe of WHITELIST) {
    if (norm.includes(safe)) return { isAgency: false, reason: 'Whitelisted', confidence: 'high' };
  }
  for (const agency of KNOWN_AGENCIES) {
    if (norm.includes(agency)) return { isAgency: true, reason: `Known agency: "${agency}"`, confidence: 'high' };
  }
  for (const kw of STAFFING_KEYWORDS) {
    if (norm.includes(kw)) return { isAgency: true, reason: `Staffing keyword: "${kw}"`, confidence: 'medium' };
  }
  return { isAgency: false, reason: 'No agency indicators', confidence: 'high' };
}
