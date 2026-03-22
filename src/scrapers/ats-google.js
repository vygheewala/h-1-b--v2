/**
 * ============================================================
 * GOOGLE ATS SCRAPER — v3 (Full Brian's Job Search platform list)
 * ============================================================
 *
 * Searches Google using site: operator across all major ATS
 * platforms and job boards. Inspired by Brian's Job Search.
 *
 * SOURCES: 40 platforms total
 *   - ATS platforms (direct employer job postings)
 *   - Job boards (LinkedIn, Glassdoor, Builtin, Wellfound, etc.)
 *   - Subdomain patterns (jobs.*, careers.*, talent.*, people.*)
 *
 * TIME FILTER: Maps dropdown selection to Google's tbs parameter.
 * NO "remote" SUFFIX — returns onsite, hybrid, and remote jobs.
 *
 * QUERY FORMAT:
 *   site:greenhouse.io "CPA" Chicago, IL &tbs=qdr:d
 */

import { PlaywrightCrawler } from 'crawlee';

// ── ALL ATS PLATFORMS & JOB BOARDS ───────────────────────────
// Keeping taleo.net even though it's not in Brian's list —
// many large enterprises (Oracle, IBM, gov contractors) use it.
export const ATS_SITES = [
  // ── CORE ATS (from Brian's list) ──────────────────────────
  { site: 'greenhouse.io',                name: 'Greenhouse'            },
  { site: 'lever.co',                     name: 'Lever'                 },
  { site: 'jobs.ashbyhq.com',             name: 'Ashby'                 },
  { site: 'remoterocketship.com',         name: 'Remote Rocketship'     },
  { site: 'pinpointhq.com',               name: 'Pinpoint'              },
  { site: 'recruiting.paylocity.com',     name: 'Paylocity'             },
  { site: 'keka.com',                     name: 'Keka'                  },
  { site: 'apply.workable.com',           name: 'Workable'              },
  { site: 'app.breezy.hr',               name: 'BreezyHR'              },
  { site: 'wellfound.com',               name: 'Wellfound'             },
  { site: 'workatastartup.com',           name: 'Y Combinator'          },
  { site: 'myworkdayjobs.com',            name: 'Workday Jobs'          },
  { site: 'recruitee.com',               name: 'Recruitee'             },
  { site: 'rippling.com',                name: 'Rippling'              },
  { site: 'gusto.com',                   name: 'Gusto'                 },
  { site: 'careerpuck.com',              name: 'CareerPuck'            },
  { site: 'teamtailor.com',              name: 'Teamtailor'            },
  { site: 'jobs.smartrecruiters.com',     name: 'SmartRecruiters'       },
  { site: 'talentreef.com',              name: 'TalentReef'            },
  { site: 'homerun.co',                  name: 'Homerun'               },
  { site: 'gem.com',                     name: 'Gem'                   },
  { site: 'trakstar.com',                name: 'Trakstar'              },
  { site: 'catsone.com',                 name: 'CATS'                  },
  { site: 'app.jazz.co',                 name: 'JazzHR'                },
  { site: 'jobvite.com',                 name: 'Jobvite'               },
  { site: 'icims.com',                   name: 'iCIMS'                 },
  { site: 'dover.com',                   name: 'Dover'                 },
  { site: 'notion.so',                   name: 'Notion'                },
  { site: 'builtin.com',                 name: 'Builtin'               },
  { site: 'jobs.adp.com',               name: 'ADP'                   },
  { site: 'linkedin.com/jobs',           name: 'LinkedIn'              },
  { site: 'glassdoor.com',              name: 'Glassdoor'             },
  { site: 'factorialhr.com',             name: 'Factorial'             },
  { site: 'trinet.com',                  name: 'TriNet Hire'           },
  { site: 'oracle.com/careers',          name: 'Oracle Cloud'          },

  // ── SUBDOMAIN PATTERNS ────────────────────────────────────
  // Brian uses these to catch company-specific career microsites
  // e.g. jobs.stripe.com, careers.shopify.com, talent.spotify.com
  { site: 'jobs.',                       name: 'Jobs Subdomain',    isSubdomain: true },
  { site: 'careers.',                    name: 'Careers Pages',     isSubdomain: true },
  { site: 'people.',                     name: 'People Subdomain',  isSubdomain: true },
  { site: 'talent.',                     name: 'Talent Subdomain',  isSubdomain: true },

  // ── KEPT FROM OUR ORIGINAL LIST (not in Brian's) ─────────
  { site: 'taleo.net',                   name: 'Taleo'                 },
];

// ── TIME FILTER → GOOGLE TBS PARAMETER ───────────────────────
const TIME_FILTER_MAP = {
  'All':          '',
  'Past Hour':    'tbs=qdr:h',
  'Past 4 Hours': 'tbs=qdr:h4',
  'Past 8 Hours': 'tbs=qdr:h8',
  'Past 12 Hours':'tbs=qdr:h12',
  'Past 24 Hours':'tbs=qdr:d',
  'Past 48 Hours':'tbs=qdr:d2',
  'Past 72 Hours':'tbs=qdr:d3',
  'Past Week':    'tbs=qdr:w',
  'Past Month':   'tbs=qdr:m',
};

/**
 * Build all Google search request objects.
 * One request per: keyword × ATS platform.
 *
 * For subdomain patterns (jobs.*, careers.*), we use
 * Google's inurl: operator instead of site: because
 * site:jobs. is not valid — Google needs a full domain.
 *
 * @param {string[]} keywords   - From INPUT (e.g. ["CPA", "GAAP"])
 * @param {string}   location   - From INPUT (e.g. "Chicago, IL")
 * @param {string}   timeFilter - From INPUT dropdown
 * @returns {Array}  Array of crawler request objects
 */
export function buildSearchRequests(keywords, location, timeFilter) {
  const tbsParam = TIME_FILTER_MAP[timeFilter] || '';
  const requests = [];

  // Location suffix — skip for US-wide searches to maximise results
  const locationSuffix = location &&
    location.toLowerCase() !== 'united states' &&
    location.trim() !== ''
      ? ` ${location}`
      : '';

  for (const keyword of keywords) {
    for (const ats of ATS_SITES) {

      let query;

      if (ats.isSubdomain) {
        // Subdomain pattern: use inurl: instead of site:
        // e.g. inurl:"jobs." "CPA" Chicago, IL
        query = `inurl:"${ats.site}" "${keyword}"${locationSuffix}`;
      } else {
        // Standard: site:greenhouse.io "CPA" Chicago, IL
        query = `site:${ats.site} "${keyword}"${locationSuffix}`;
      }

      let googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=20`;
      if (tbsParam) googleUrl += `&${tbsParam}`;

      requests.push({
        url: googleUrl,
        label: 'GOOGLE_SEARCH',
        userData: { keyword, ats, query },
      });
    }
  }

  return requests;
}

/**
 * Main scraper — runs all Google ATS searches and returns
 * a deduplicated flat list of job objects.
 *
 * @param {string[]} keywords
 * @param {string}   location
 * @param {string}   timeFilter
 * @param {number}   maxPerKeyword
 * @returns {Promise<Array>}
 */
export async function scrapeATSJobs(keywords, location, timeFilter, maxPerKeyword = 30) {
  console.log(`\n🔍 Starting Google ATS scraper (v3 — ${ATS_SITES.length} platforms)...`);
  console.log(`   Keywords:    ${keywords.join(', ')}`);
  console.log(`   Location:    ${location || 'Worldwide'}`);
  console.log(`   Time filter: ${timeFilter} → ${TIME_FILTER_MAP[timeFilter] || 'no tbs'}`);
  console.log(`   Platforms:   ${ATS_SITES.length} (${ATS_SITES.filter(a => !a.isSubdomain).length} ATS + ${ATS_SITES.filter(a => a.isSubdomain).length} subdomain patterns + Taleo)\n`);

  const requests = buildSearchRequests(keywords, location, timeFilter);
  console.log(`   Total Google searches: ${requests.length} (${keywords.length} keywords × ${ATS_SITES.length} platforms)`);

  // Deduplication map: jobUrl → job object
  const jobMap = new Map();

  // Per-keyword job count tracker
  const keywordCounts = {};

  const crawler = new PlaywrightCrawler({
    maxConcurrency: 1,            // polite — one Google search at a time
    navigationTimeoutSecs: 30,
    maxRequestsPerCrawl: requests.length,

    async requestHandler({ page, request, log }) {
      const { keyword, ats, query } = request.userData;
      log.info(`Searching: ${query}`);

      // Wait for Google results container
      try {
        await page.waitForSelector('#search, #rso, .g', { timeout: 12000 });
      } catch {
        log.warning(`No Google results for: ${query}`);
        return;
      }
      await page.waitForTimeout(1200);

      // ── EXTRACT LINKS FROM GOOGLE RESULTS ──────────────────
      const links = await page.evaluate((atsSite, isSubdomain) => {
        const found = [];

        document.querySelectorAll('div.g, div[data-hveid]').forEach((div) => {
          const anchor = div.querySelector('a[href]');
          const href   = anchor?.getAttribute('href') || '';
          if (!href.startsWith('http')) return;

          // For subdomain patterns, check URL contains the subdomain keyword
          const matches = isSubdomain
            ? href.includes(atsSite)
            : href.includes(atsSite);

          if (!matches) return;

          const titleEl   = div.querySelector('h3');
          const snippetEl = div.querySelector('.VwiC3b, .lyLwlc, [data-sncf]');
          const title     = titleEl?.textContent?.trim()   || '';
          const snippet   = snippetEl?.textContent?.trim() || '';

          if (title) found.push({ url: href, title, snippet });
        });

        return found;
      }, ats.site, ats.isSubdomain || false);

      log.info(`  → ${links.length} results | "${keyword}" on ${ats.name}`);

      // ── ADD TO JOB MAP (deduplicated) ───────────────────────
      for (const link of links) {
        const kCount = keywordCounts[keyword] || 0;
        if (kCount >= maxPerKeyword) break;

        if (!jobMap.has(link.url)) {
          jobMap.set(link.url, {
            jobUrl:      link.url,
            title:       cleanTitle(link.title, ats.name),
            description: link.snippet,
            company:     extractCompany(link.url, ats),
            location,
            source:      `${ats.name} via Google`,
            atsName:     ats.name,
            keyword,
            datePosted:  'Unknown',
          });
          keywordCounts[keyword] = kCount + 1;
        }
      }
    },

    failedRequestHandler({ request, log }) {
      // Non-fatal — just log and continue with remaining searches
      log.warning(`Search skipped: ${request.userData?.query}`);
    },
  });

  await crawler.run(requests);

  const jobs = Array.from(jobMap.values());
  console.log(`\n✅ ATS scraping complete. ${jobs.length} unique job listings found.`);

  // Print breakdown by platform
  const byPlatform = {};
  jobs.forEach(j => { byPlatform[j.atsName] = (byPlatform[j.atsName] || 0) + 1; });
  const topPlatforms = Object.entries(byPlatform).sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log(`   Top sources: ${topPlatforms.map(([k, v]) => `${k}(${v})`).join(', ')}`);

  return jobs;
}

// ── HELPERS ───────────────────────────────────────────────────

/**
 * Clean noisy Google title text.
 * Google often appends "- Greenhouse", "| Lever", "Jobs" etc.
 */
function cleanTitle(raw, atsName) {
  return raw
    .replace(new RegExp(`\\s*[-–|]\\s*${atsName}\\s*$`, 'i'), '')
    .replace(/\s*[-–|]\s*(jobs?|careers?|hiring)\s*$/i, '')
    .trim();
}

/**
 * Extract a human-readable company name from the ATS job URL.
 *
 * Examples:
 *   boards.greenhouse.io/stripe/jobs/123       → "Stripe"
 *   jobs.lever.co/airbnb/abc-123               → "Airbnb"
 *   amazon.myworkdayjobs.com/en-US/...         → "Amazon"
 *   jobs.ashbyhq.com/openai/job-id             → "Openai"
 *   jobs.stripe.com/listing/123                → "Stripe" (subdomain)
 *   careers.shopify.com/en/jobs/123            → "Shopify" (subdomain)
 *   app.jazz.co/companyname/jobs/123           → "Companyname"
 *   recruiting.paylocity.com/recruiting/jobs/  → host fallback
 */
function extractCompany(url, ats) {
  try {
    const parsed   = new URL(url);
    const hostname = parsed.hostname;                           // e.g. "boards.greenhouse.io"
    const parts    = parsed.pathname.split('/').filter(Boolean);

    // Subdomain patterns: company name is the second-level domain
    // jobs.stripe.com → "stripe"
    // careers.shopify.com → "shopify"
    if (ats.isSubdomain) {
      const hostParts = hostname.split('.');
      // Remove common prefixes: jobs, careers, talent, people, www
      const skip = new Set(['jobs', 'careers', 'talent', 'people', 'www', 'apply', 'boards']);
      const company = hostParts.find(p => !skip.has(p.toLowerCase()) && p.length > 2) || hostParts[0];
      return titleCase(company);
    }

    switch (ats.site) {
      case 'greenhouse.io':
        // boards.greenhouse.io/COMPANY/jobs/ID
        return titleCase(parts[0] || hostname);

      case 'lever.co':
        // jobs.lever.co/COMPANY/job-id
        return titleCase(parts[0] || hostname);

      case 'myworkdayjobs.com':
        // COMPANY.myworkdayjobs.com
        return titleCase(hostname.split('.')[0]);

      case 'jobs.ashbyhq.com':
        // jobs.ashbyhq.com/COMPANY/job-id
        return titleCase(parts[0] || hostname);

      case 'jobs.smartrecruiters.com':
        // jobs.smartrecruiters.com/COMPANY/job-id
        return titleCase(parts[0] || hostname);

      case 'app.jazz.co':
        // app.jazz.co/COMPANY/jobs/ID
        return titleCase(parts[0] || hostname);

      case 'apply.workable.com':
        // apply.workable.com/COMPANY/j/ID
        return titleCase(parts[0] || hostname);

      case 'recruitee.com':
        // COMPANY.recruitee.com/o/job-title
        return titleCase(hostname.split('.')[0]);

      case 'teamtailor.com':
        // COMPANY.teamtailor.com/jobs/ID
        return titleCase(hostname.split('.')[0]);

      case 'pinpointhq.com':
        // COMPANY.pinpointhq.com/jobs/ID
        return titleCase(hostname.split('.')[0]);

      case 'app.breezy.hr':
        // app.breezy.hr/p/COMPANY
        return titleCase(parts[1] || parts[0] || hostname);

      case 'wellfound.com':
        // wellfound.com/company/COMPANY/jobs/ID
        return titleCase(parts[1] || parts[0] || hostname);

      case 'workatastartup.com':
        // workatastartup.com/companies/COMPANY
        return titleCase(parts[1] || parts[0] || hostname);

      case 'builtin.com':
        // builtin.com/job/CITY/ROLE/ID or builtin.com/company/COMPANY
        return titleCase(parts[1] || parts[0] || hostname);

      case 'linkedin.com/jobs':
        // linkedin.com/jobs/view/ROLE-AT-COMPANY-ID
        // Company name is embedded in the slug — extract before the last dash-number
        if (parts[2]) {
          const slug = parts[2];
          const match = slug.match(/^(.*?)-\d+$/);
          return match ? titleCase(match[1].replace(/-/g, ' ')) : titleCase(slug);
        }
        return 'LinkedIn Job';

      case 'glassdoor.com':
        // glassdoor.com/job-listing/ROLE-AT-COMPANY-...
        return titleCase(parts[1]?.replace(/-/g, ' ') || 'Glassdoor Job');

      default:
        // Generic fallback: try first path segment, then subdomain
        return titleCase(parts[0] || hostname.split('.')[0]);
    }
  } catch {
    return 'Unknown';
  }
}

/**
 * Convert "portage-point-partners" → "Portage Point Partners"
 * Handles hyphens, underscores, and plain lowercase.
 */
function titleCase(str) {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}
