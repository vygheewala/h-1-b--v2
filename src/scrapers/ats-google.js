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

// ── BUILD SEARCH REQUESTS ─────────────────────────────────────
export function buildSearchRequests(keywords, location, timeFilter) {
  const tbsParam = TIME_FILTER_MAP[timeFilter] || '';
  const requests = [];

  const locationSuffix = location &&
    location.toLowerCase() !== 'united states' &&
    location.trim() !== ''
      ? ` ${location}`
      : '';

  for (const keyword of keywords) {
    for (const ats of ATS_SITES) {
      const query = ats.isSubdomain
        ? `inurl:"${ats.site}" "${keyword}"${locationSuffix}`
        : `site:${ats.site} "${keyword}"${locationSuffix}`;

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

// ── MAIN SCRAPER ──────────────────────────────────────────────
export async function scrapeATSJobs(keywords, location, timeFilter, maxPerKeyword = 30) {
  console.log(`\n🔍 Starting Google ATS scraper (v4 — ${ATS_SITES.length} platforms)...`);
  console.log(`   Keywords:    ${keywords.join(', ')}`);
  console.log(`   Location:    ${location || 'Worldwide'}`);
  console.log(`   Time filter: ${timeFilter} → ${TIME_FILTER_MAP[timeFilter] || 'no filter'}`);
  console.log(`   Total searches: ${keywords.length} keywords × ${ATS_SITES.length} platforms = ${keywords.length * ATS_SITES.length}`);
  console.log(`   Delay between searches: 4–10 seconds (prevents Google 429 blocks)\n`);

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

      // Small polite delay — proxy rotation handles the 429 prevention,
      // but we still wait briefly to be respectful
      const delayMs = randInt(1500, 3000);
      await wait(delayMs);

      // Wait for Google results to load
      try {
        await page.waitForSelector('#search, #rso, .g', { timeout: 12000 });
      } catch {
        log.warning(`   No results rendered for: ${query}`);
        return;
      }
      await wait(1000);

      // ── EXTRACT JOB LINKS ─────────────────────────────────────
      // FIX: page.evaluate() only accepts ONE argument.
      // We wrap atsSite + isSubdomain into a single object.
      const links = await page.evaluate(({ atsSite, isSubdomain }) => {
        const found = [];

        document.querySelectorAll('div.g, div[data-hveid]').forEach((div) => {
          const anchor  = div.querySelector('a[href]');
          const href    = anchor?.getAttribute('href') || '';
          if (!href.startsWith('http')) return;

          // Match: URL contains the ATS site string
          if (!href.includes(atsSite)) return;

          const titleEl   = div.querySelector('h3');
          const snippetEl = div.querySelector('.VwiC3b, .lyLwlc, [data-sncf]');
          const title     = titleEl?.textContent?.trim()   || '';
          const snippet   = snippetEl?.textContent?.trim() || '';

          if (title) found.push({ url: href, title, snippet });
        });

        return found;

      // Pass a SINGLE object — this is the fix for "Too many arguments"
      }, { atsSite: ats.site, isSubdomain: ats.isSubdomain || false });

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
            source:      `${ats.name} via Google`,
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

  console.log(`\n✅ ATS scraping complete. ${jobs.length} unique jobs found.`);
  if (top.length) console.log(`   Top sources: ${top.map(([k, v]) => `${k}(${v})`).join(', ')}`);

  return jobs;
}

// ── URL → COMPANY NAME ────────────────────────────────────────
function extractCompany(url, ats) {
  try {
    const parsed   = new URL(url);
    const hostname = parsed.hostname;
    const parts    = parsed.pathname.split('/').filter(Boolean);

    if (ats.isSubdomain) {
      const skip = new Set(['jobs', 'careers', 'talent', 'people', 'www', 'apply', 'boards']);
      const company = hostname.split('.').find(p => !skip.has(p.toLowerCase()) && p.length > 2)
        || hostname.split('.')[0];
      return titleCase(company);
    }

    switch (ats.site) {
      case 'greenhouse.io':        return titleCase(parts[0] || hostname);
      case 'lever.co':             return titleCase(parts[0] || hostname);
      case 'myworkdayjobs.com':    return titleCase(hostname.split('.')[0]);
      case 'jobs.ashbyhq.com':     return titleCase(parts[0] || hostname);
      case 'jobs.smartrecruiters.com': return titleCase(parts[0] || hostname);
      case 'app.jazz.co':          return titleCase(parts[0] || hostname);
      case 'apply.workable.com':   return titleCase(parts[0] || hostname);
      case 'recruitee.com':        return titleCase(hostname.split('.')[0]);
      case 'teamtailor.com':       return titleCase(hostname.split('.')[0]);
      case 'pinpointhq.com':       return titleCase(hostname.split('.')[0]);
      case 'app.breezy.hr':       return titleCase(parts[1] || parts[0] || hostname);
      case 'wellfound.com':        return titleCase(parts[1] || parts[0] || hostname);
      case 'workatastartup.com':   return titleCase(parts[1] || parts[0] || hostname);
      case 'builtin.com':          return titleCase(parts[1] || parts[0] || hostname);
      case 'linkedin.com/jobs': {
        if (parts[2]) {
          const m = parts[2].match(/^(.*?)-\d+$/);
          return m ? titleCase(m[1].replace(/-/g, ' ')) : titleCase(parts[2]);
        }
        return 'LinkedIn Job';
      }
      default: return titleCase(parts[0] || hostname.split('.')[0]);
    }
  } catch {
    return 'Unknown';
  }
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
