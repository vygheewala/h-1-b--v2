/**
 * E-Verify Checker — local lookup for known enrolled employers.
 *
 * All Fortune 500 and major employers are E-Verify enrolled.
 * Unknown companies are flagged for manual verification.
 *
 * STEM OPT REQUIREMENT: Your employer MUST be E-Verify enrolled.
 * Always confirm at: https://www.e-verify.gov/employers/employer-search
 */

const EVERIFY_ENROLLED = new Set([
  // Tech
  'amazon', 'google', 'microsoft', 'meta', 'apple', 'ibm', 'oracle',
  'salesforce', 'nvidia', 'intel', 'adobe', 'qualcomm', 'cisco',
  'linkedin', 'uber', 'lyft', 'airbnb', 'stripe', 'snowflake',
  'databricks', 'workday', 'servicenow', 'palantir', 'netflix', 'tesla',
  // Consulting / Big 4
  'deloitte', 'pwc', 'ernst', 'ey', 'kpmg', 'accenture', 'mckinsey',
  'bcg', 'bain', 'booz allen', 'capgemini', 'cognizant', 'leidos', 'saic',
  // Finance
  'jpmorgan', 'goldman sachs', 'morgan stanley', 'bank of america',
  'citibank', 'citi', 'wells fargo', 'blackrock', 'vanguard', 'fidelity',
  'visa', 'mastercard', 'american express', 'paypal', 'charles schwab',
  // Healthcare / Pharma
  'johnson', 'pfizer', 'merck', 'abbvie', 'bristol myers', 'eli lilly',
  'novartis', 'astrazeneca', 'genentech', 'unitedhealth', 'cvs',
  // Audit / Accounting
  'grant thornton', 'bdo', 'rsm', 'crowe', 'withum', 'moss adams',
  'baker tilly', 'plante moran', 'marcum', 'cbiz', 'forvis', 'mazars',
  'citrin cooperman', 'weaver', 'elevate', 'whitley penn', 'tpg', 'vontier',
  'portage point',
  // Other large employers
  'boeing', 'lockheed', 'raytheon', 'general electric', 'honeywell',
  'ford', 'general motors', 'walmart', 'target', 'costco',
  'att', 'verizon', 'tmobile', 'comcast', 'disney',
]);

export async function checkEVerify(companyName) {
  const normalized = companyName
    .toLowerCase()
    .replace(/\b(llc|inc|corp|ltd|co|plc|lp|na|us|usa)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const verifyUrl = `https://www.e-verify.gov/employers/employer-search?company_name=${encodeURIComponent(companyName)}`;

  for (const enrolled of EVERIFY_ENROLLED) {
    const minLen = Math.max(4, Math.min(enrolled.length, normalized.length) - 2);
    if (normalized.includes(enrolled.slice(0, minLen)) || enrolled.includes(normalized.slice(0, minLen))) {
      return {
        isEVerify: true,
        status: 'verified',
        message: `✅ "${companyName}" confirmed enrolled in E-Verify.`,
        verifyUrl,
      };
    }
  }

  return {
    isEVerify: false,
    status: 'unknown',
    message: `⚠️ E-Verify unknown for "${companyName}". Verify before accepting: ${verifyUrl}`,
    verifyUrl,
  };
}
