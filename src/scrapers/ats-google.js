/**
 * ============================================================
 * GOOGLE ATS SCRAPER — v4
 * ============================================================
 *
 * FIXES FROM v3:
 * 1. page.evaluate() now receives a single object argument
 *    (Playwright only allows 1 argument — wrapping fixes the
 *    "Too many arguments" error)
 *
 * 2. Random 4–10 second delay between every Google search
 *    prevents 429 rate-limit blocks. Google allows ~8–10
 *    automated searches/minute before blocking cloud IPs.
 *
 * 3. Randomised User-Agent per request to further reduce
 *    Google's bot detection confidence.
 *
 * SOURCES: 40 platforms (Brian's full list + Taleo)
 */

import { PlaywrightCrawler } from 'crawlee';
import { Actor } from 'apify';

// ── ATS PLATFORMS & JOB BOARDS ────────────────────────────────
export const ATS_SITES = [
  { site: 'greenhouse.io',                name: 'Greenhouse'           },
  { site: 'lever.co',                     name: 'Lever'                },
  { site: 'jobs.ashbyhq.com',             name: 'Ashby'                },
  { site: 'remoterocketship.com',         name: 'Remote Rocketship'    },
  { site: 'pinpointhq.com',               name: 'Pinpoint'             },
  { site: 'recruiting.paylocity.com',     name: 'Paylocity'            },
  { site: 'keka.com',                     name: 'Keka'                 },
  { site: 'apply.workable.com',           name: 'Workable'             },
  { site: 'app.breezy.hr',               name: 'BreezyHR'             },
  { site: 'wellfound.com',               name: 'Wellfound'            },
  { site: 'workatastartup.com',           name: 'Y Combinator'         },
  { site: 'myworkdayjobs.com',            name: 'Workday Jobs'         },
  { site: 'recruitee.com',               name: 'Recruitee'            },
  { site: 'rippling.com',                name: 'Rippling'             },
  { site: 'gusto.com',                   name: 'Gusto'                },
  { site: 'careerpuck.com',              name: 'CareerPuck'           },
  { site: 'teamtailor.com',              name: 'Teamtailor'           },
  { site: 'jobs.smartrecruiters.com',     name: 'SmartRecruiters'      },
  { site: 'talentreef.com',              name: 'TalentReef'           },
  { site: 'homerun.co',                  name: 'Homerun'              },
  { site: 'gem.com',                     name: 'Gem'                  },
  { site: 'trakstar.com',                name: 'Trakstar'             },
  { site: 'catsone.com',                 name: 'CATS'                 },
  { site: 'app.jazz.co',                 name: 'JazzHR'               },
  { site: 'jobvite.com',                 name: 'Jobvite'              },
  { site: 'icims.com',                   name: 'iCIMS'                },
  { site: 'dover.com',                   name: 'Dover'                },
  { site: 'notion.so',                   name: 'Notion'               },
  { site: 'builtin.com',                 name: 'Builtin'              },
  { site: 'jobs.adp.com',               name: 'ADP'                  },
  { site: 'linkedin.com/jobs',           name: 'LinkedIn'             },
  { site: 'glassdoor.com',              name: 'Glassdoor'            },
  { site: 'factorialhr.com',             name: 'Factorial'            },
  { site: 'trinet.com',                  name: 'TriNet Hire'          },
  { site: 'oracle.com/careers',          name: 'Oracle Cloud'         },
  { site: 'jobs.',      name: 'Jobs Subdomain',   isSubdomain: true   },
  { site: 'careers.',   name: 'Careers Pages',    isSubdomain: true   },
  { site: 'people.',    name: 'People Subdomain',  isSubdomain: true  },
  { site: 'talent.',    name: 'Talent Subdomain',  isSubdomain: true  },
  { site: 'taleo.net',                   name: 'Taleo'                },
];

// ── TIME FILTER → GOOGLE TBS ──────────────────────────────────
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

// ── RANDOM USER AGENTS ────────────────────────────────────────
// Rotate between real browser UA strings to reduce bot detection
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

// ── HELPERS ───────────────────────────────────────────────────

// Random integer between min and max (inclusive)
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Pause execution for ms milliseconds
const wait = (ms) => new Promise(res => setTimeout(res, ms));

// Pick a random item from an array
const randItem = (arr) => arr[randInt(0, arr.length - 1)];

// ── TIME FILTER → DUCKDUCKGO df PARAMETER ────────────────────
// DuckDuckGo uses df= for date filtering
const DDG_TIME_MAP = {
  'All':          '',
  'Past Hour':    'df=h',
  'Past 4 Hours': 'df=h',   // DDG doesn't support sub-day, use h as closest
  'Past 8 Hours': 'df=h',
  'Past 12 Hours':'df=h',
  'Past 24 Hours':'df=d',
  'Past 48 Hours':'df=d',
  'Past 72 Hours':'df=w',
  'Past Week':    'df=w',
  'Past Month':   'df=m',
};

// ── BUILD SEARCH REQUESTS ─────────────────────────────────────
export function buildSearchRequests(keywords, location, timeFilter) {
  const dfParam = DDG_TIME_MAP[timeFilter] || '';
  const requests = [];

  const locationSuffix = location &&
    location.toLowerCase() !== 'united states' &&
    location.trim() !== ''
      ? ` ${location}`
      : '';

  for (const keyword of keywords) {
    for (const ats of ATS_SITES) {
      const query = ats.isSubdomain
        ? `inurl:${ats.site} "${keyword}"${locationSuffix}`
        : `site:${ats.site} "${keyword}"${locationSuffix}`;

      // DuckDuckGo HTML endpoint — no JS rendering needed, no consent walls,
      // no rate limiting, works perfectly on cloud/datacenter IPs
      // Using html.duckduckgo.com which returns plain HTML (faster + more reliable)
      let ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en`;
      if (dfParam) ddgUrl += `&${dfParam}`;

      requests.push({
        url: ddgUrl,
        label: 'DDG_SEARCH',
        userData: { keyword, ats, query },
      });
    }
  }

  return requests;
}

// ── MAIN SCRAPER ──────────────────────────────────────────────
export async function scrapeATSJobs(keywords, location, timeFilter, maxPerKeyword = 30) {
  console.log(`\n🔍 Starting DuckDuckGo ATS scraper (v4 — ${ATS_SITES.length} platforms)...`);
  console.log(`   Keywords:    ${keywords.join(', ')}`);
  console.log(`   Location:    ${location || 'Worldwide'}`);
  console.log(`   Time filter: ${timeFilter} → ${TIME_FILTER_MAP[timeFilter] || 'no filter'}`);
  console.log(`   Total searches: ${keywords.length} keywords × ${ATS_SITES.length} platforms = ${keywords.length * ATS_SITES.length}`);
  console.log(`   Search engine: DuckDuckGo (no rate limiting, no consent walls)\n`);

  const requests    = buildSearchRequests(keywords, location, timeFilter);
  const jobMap      = new Map();   // URL → job (deduplication)
  const kCounts     = {};          // keyword → count (per-keyword limit)
  let   searchsDone = 0;

  // ── APIFY PROXY CONFIGURATION ───────────────────────────────
  // This rotates the IP address for every Google search request.
  // Google rate-limits by IP — rotating IPs eliminates 429 errors.
  // Apify's datacenter proxies are included in the free plan.
  // If proxy creation fails (e.g. running locally), we continue without it.
  let proxyConfiguration;
  try {
    proxyConfiguration = await Actor.createProxyConfiguration();
    console.log('   ✅ Apify proxy enabled — IP rotation active');
  } catch {
    console.log('   ⚠️  Proxy unavailable — running without IP rotation');
  }

  const crawler = new PlaywrightCrawler({
    maxConcurrency: 1,             // one search at a time — still needed for orderly execution
    navigationTimeoutSecs: 30,
    maxRequestsPerCrawl: requests.length,
    proxyConfiguration,            // rotate IP per request — prevents Google 429

    // Set a random User-Agent before each navigation
    preNavigationHooks: [
      async ({ page }) => {
        await page.setExtraHTTPHeaders({
          'User-Agent': randItem(USER_AGENTS),
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        });
      },
    ],

    async requestHandler({ page, request, log }) {
      const { keyword, ats, query } = request.userData;
      searchsDone++;
      log.info(`[${searchsDone}/${requests.length}] Searching: ${query}`);

      // Small polite delay — DuckDuckGo is much more lenient than Google
      // but we still wait briefly to be respectful
      const delayMs = randInt(800, 2000);
      await wait(delayMs);

      // ── WAIT FOR DUCKDUCKGO RESULTS ───────────────────────────
      // DuckDuckGo HTML endpoint returns a plain HTML page with results
      // in <div class="result"> elements — no JavaScript needed
      try {
        await page.waitForSelector('.result, .results, #links, .web-result', { timeout: 12000 });
      } catch {
        log.warning(`   No results for: ${query}`);
        return;
      }
      await wait(500);

      // ── EXTRACT JOB LINKS FROM DUCKDUCKGO RESULTS ────────────
      const links = await page.evaluate(({ atsSite }) => {
        const found = [];

        // DuckDuckGo HTML results are in <div class="result"> containers
        // Each has an <a class="result__a"> with the actual URL
        const resultDivs = document.querySelectorAll(
          '.result, .web-result, [data-testid="result"]'
        );

        resultDivs.forEach((div) => {
          // Get the main result link
          const anchor = div.querySelector('a.result__a, a[data-testid="result-title-a"], h2 a, .result__title a');
          const href   = anchor?.getAttribute('href') || '';

          // DuckDuckGo sometimes wraps URLs in a redirect — extract the real URL
          let realUrl = href;
          if (href.includes('duckduckgo.com/l/?uddg=')) {
            try {
              const urlParam = new URL(href).searchParams.get('uddg');
              if (urlParam) realUrl = decodeURIComponent(urlParam);
            } catch { /* keep original href */ }
          }

          if (!realUrl.startsWith('http')) return;
          if (!realUrl.includes(atsSite)) return;

          const titleEl   = div.querySelector('.result__a, .result__title a, h2 a');
          const snippetEl = div.querySelector('.result__snippet, [data-testid="result-snippet"]');
          const title     = titleEl?.textContent?.trim()   || '';
          const snippet   = snippetEl?.textContent?.trim() || '';

          if (title) found.push({ url: realUrl, title, snippet });
        });

        return found;

      }, { atsSite: ats.site });

      log.info(`   → ${links.length} job links found on ${ats.name}`);

      // Add to deduplication map
      for (const link of links) {
        if ((kCounts[keyword] || 0) >= maxPerKeyword) break;
        if (!jobMap.has(link.url)) {
          jobMap.set(link.url, {
            jobUrl:      link.url,
            title:       cleanTitle(link.title, ats.name),
            description: link.snippet,
            company:     extractCompany(link.url, ats),
            location,
            source:      `${ats.name} via DuckDuckGo`,
            atsName:     ats.name,
            keyword,
            datePosted:  'Unknown',
          });
          kCounts[keyword] = (kCounts[keyword] || 0) + 1;
        }
      }
    },

    failedRequestHandler({ request, log }) {
      log.warning(`Skipped (will continue): ${request.userData?.query}`);
    },
  });

  await crawler.run(requests);

  const jobs = Array.from(jobMap.values());

  // Print breakdown by platform
  const byPlatform = {};
  jobs.forEach(j => { byPlatform[j.atsName] = (byPlatform[j.atsName] || 0) + 1; });
  const top = Object.entries(byPlatform).sort((a, b) => b[1] - a[1]).slice(0, 8);

  console.log(`\n✅ DuckDuckGo ATS scraping complete. ${jobs.length} unique jobs found.`);
  if (top.length) console.log(`   Top sources: ${top.map(([k, v]) => `${k}(${v})`).join(', ')}`);

  return jobs;
}

// ── URL → COMPANY NAME ────────────────────────────────────────
// Words that appear in URL paths but are NOT company names
const PATH_NOISE = new Set([
  'jobs', 'job', 'careers', 'career', 'recruiting', 'recruitment',
  'hiring', 'apply', 'application', 'boards', 'board', 'listing',
  'listings', 'details', 'view', 'opening', 'openings', 'position',
  'positions', 'en', 'us', 'de', 'fr', 'uk', 'au', 'ca', 'gb',
  'external', 'internal', 'req', 'requisition', 'posting', 'postings',
]);

function extractCompany(url, ats) {
  try {
    const parsed   = new URL(url);
    const hostname = parsed.hostname;
    const parts    = parsed.pathname.split('/').filter(p =>
      p.length > 2 &&
      !PATH_NOISE.has(p.toLowerCase()) &&
      !/^\d+$/.test(p) &&           // skip pure numbers (job IDs)
      !/^[a-f0-9-]{20,}$/.test(p)   // skip UUIDs
    );

    // SUBDOMAIN PATTERNS (jobs.stripe.com → "Stripe")
    if (ats.isSubdomain) {
      const skipHost = new Set(['jobs', 'careers', 'talent', 'people', 'www', 'apply', 'boards']);
      const company = hostname.split('.')
        .find(p => !skipHost.has(p.toLowerCase()) && p.length > 2 && p !== 'com' && p !== 'io')
        || hostname.split('.')[0];
      return titleCase(company);
    }

    switch (ats.site) {
      // Subdomain-based: company name is the first subdomain
      case 'myworkdayjobs.com':  return titleCase(hostname.split('.')[0]);
      case 'recruitee.com':      return titleCase(hostname.split('.')[0]);
      case 'teamtailor.com':     return titleCase(hostname.split('.')[0]);
      case 'pinpointhq.com':     return titleCase(hostname.split('.')[0]);
      case 'rippling.com':       return titleCase(hostname.split('.')[0]);

      // Path-based: company name is first meaningful path segment
      case 'greenhouse.io':      return titleCase(parts[0] || hostname);
      case 'lever.co':           return titleCase(parts[0] || hostname);
      case 'jobs.ashbyhq.com':   return titleCase(parts[0] || hostname);
      case 'jobs.smartrecruiters.com': return titleCase(parts[0] || hostname);
      case 'app.jazz.co':        return titleCase(parts[0] || hostname);
      case 'apply.workable.com': return titleCase(parts[0] || hostname);
      case 'app.breezy.hr':     return titleCase(parts[0] || hostname);
      case 'wellfound.com':      return titleCase(parts[1] || parts[0] || hostname);
      case 'workatastartup.com': return titleCase(parts[1] || parts[0] || hostname);

      // Paylocity: recruiting.paylocity.com/Recruiting/Jobs/Details/ID/COMPANY
      // The company name is usually in the job title, not the URL
      // Fall back to 'Unknown' and let the title provide context
      case 'recruiting.paylocity.com': return parts[2] || 'Unknown';

      // Builtin: builtin.com/company/COMPANY-NAME/jobs/TITLE-ID
      // Path is: ["company", "company-name", "jobs", "job-title-123"]
      case 'builtin.com': {
        const compIdx = parsed.pathname.toLowerCase().indexOf('/company/');
        if (compIdx !== -1) {
          const afterCompany = parsed.pathname.slice(compIdx + 9).split('/')[0];
          if (afterCompany && !PATH_NOISE.has(afterCompany.toLowerCase())) {
            return titleCase(afterCompany);
          }
        }
        // Fallback: jobs/CITY/TITLE/ID — use parts[1] but only if it looks like a company
        return parts[0]?.length > 3 ? titleCase(parts[0]) : 'Unknown';
      }

      // LinkedIn: job title slug contains company — too unreliable, return Unknown
      case 'linkedin.com/jobs': return 'Unknown';

      default: return titleCase(parts[0] || hostname.split('.')[0]);
    }
  } catch {
    return 'Unknown';
  }
}

// Filter out jobs where company extraction clearly failed
export function isValidCompany(name) {
  if (!name || name === 'Unknown') return false;
  const n = name.toLowerCase();
  // Reject if the "company" is just a noise word, 2-letter locale code, or looks like a job title
  if (PATH_NOISE.has(n)) return false;
  if (n.length <= 2) return false;
  return true;
}

function cleanTitle(raw, atsName) {
  return raw
    .replace(new RegExp(`\\s*[-–|]\\s*${atsName}\\s*$`, 'i'), '')
    .replace(/\s*[-–|]\s*(jobs?|careers?|hiring)\s*$/i, '')
    .trim();
}

function titleCase(str) {
  return str.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
}
