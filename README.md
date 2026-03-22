# 🎯 H1B Job Hunter v2
### Google ATS Edition — Built for F1 Visa Students on OPT / STEM OPT

---

## 📌 What This Does

This Apify actor automates the most tedious part of job hunting as an international student — finding employers who **actually sponsor H1B visas** for roles that **actually match your skills**.

Instead of scrolling through LinkedIn and Indeed (which are flooded with staffing agencies and no-sponsor jobs), this actor searches **40 ATS platforms and job boards directly via Google**, inspired by [Brian's Job Search](https://briansjobsearch.com/).

### For every job found, it tells you:

| Output Column | What it means |
|---|---|
| **Visa Friendliness Score (1–10)** | How likely this employer is to sponsor your H1B |
| **Skill Match Score (1–10)** | How well your skills match this specific job |
| **Sponsorship in Job Description** | `HAS_SPONSORSHIP` / `NO_SPONSORSHIP` / `UNKNOWN` |
| **Sponsorship Warning** | Exact phrase found — e.g. PwC's "does not intend to hire…" |
| **H1B Petition Count** | How many H1B petitions this company has filed (DOL data) |
| **H1B Approval Rate** | % of petitions approved |
| **E-Verify Status** | Whether the employer is enrolled (required for STEM OPT) |
| **Staffing Agency?** | Flags body shops and consulting firms to avoid |

---

## 🗂️ File Structure

```
h1b-job-hunter-v2/
│
├── .actor/
│   ├── actor.json            ← Apify actor metadata
│   └── input_schema.json     ← defines the input form in Apify UI
│
├── src/
│   ├── main.js               ← orchestrates the full pipeline
│   │
│   ├── scrapers/
│   │   └── ats-google.js     ← searches 40 platforms via Google
│   │
│   ├── checkers/
│   │   ├── h1b-checker.js        ← looks up H1B history
│   │   ├── h1b-data-lookup.js    ← local DOL LCA database (FY2024)
│   │   └── everify-checker.js    ← checks E-Verify enrollment
│   │
│   └── utils/
│       ├── agency-detector.js        ← flags staffing agencies
│       ├── description-fetcher.js    ← fetches full job description
│       ├── scorer.js                 ← calculates visa + skill scores
│       └── sponsorship-detector.js  ← detects "no H1B" language
│
├── package.json
├── Dockerfile
└── README.md
```

---

## 🚀 How to Set Up on Apify

### Step 1 — Create Apify Account
Go to [apify.com](https://apify.com) → Sign up free.
The free tier gives **$5 of compute credits/month** — enough for 2–5 runs.

### Step 2 — Create a GitHub Repository
1. Go to [github.com](https://github.com) → **"New repository"**
2. Name it `h1b-job-hunter-v2` → set to **Public** → Create
3. Upload all 13 files preserving the exact folder structure above
4. For `.actor/` folder: use **"Add file → Create new file"** and type `.actor/actor.json` in the name box — the dot prefix is required

### Step 3 — Connect GitHub to Apify
1. In Apify Console → **Actors → Create new → Start from scratch**
2. Name it `h1b-job-hunter-v2` → Create
3. Click **Source tab → GitHub** → Authorize → Select your repo
4. Click **Save** → Apify builds automatically (~2 min)

### Step 4 — Configure Your Search (Input Tab)
Fill in the form that appears:

| Field | Example |
|---|---|
| **Keywords** (one per line) | `CPA` `GAAP` `internal audit` `SOX` |
| **Location** | `Chicago, IL` or `United States` |
| **Time Filter** | `Past 24 Hours` |
| **Your Skills** (one per line) | `CPA` `Excel` `SQL` `GAAP` `SOX` |
| **OPT End Date** | `2026-06-30` |
| **Max Jobs Per Keyword** | `30` |
| **Minimum Visa Score** | `3` |

### Step 5 — Run
Click the green **"Run"** button. Runtime: **10–30 minutes** depending on keyword count.

### Step 6 — Download Results
**Apify Console → Storage → Key-Value Store → `OUTPUT_CSV` → Download**

Or: **Storage → Datasets → Export as CSV**

---

## 🔍 How the Scraper Works

### Why Google + ATS instead of LinkedIn/Indeed?
- LinkedIn and Indeed **block cloud server IPs** (Apify runs on AWS) — you get `ECONNREFUSED` errors
- ATS platforms like Greenhouse and Lever host **direct employer postings only** — no staffing agencies
- Google search is always accessible from cloud servers

### The Google Query Format
```
site:greenhouse.io "CPA" Chicago, IL &tbs=qdr:d
site:lever.co "GAAP" &tbs=qdr:d
inurl:"careers." "internal audit" United States &tbs=qdr:d
```

### 40 Platforms Searched
| Category | Platforms |
|---|---|
| ATS Platforms | Greenhouse, Lever, Ashby, Workday, SmartRecruiters, iCIMS, Jobvite, Taleo, Paylocity, Workable, BreezyHR, Recruitee, Rippling, Teamtailor, Pinpoint, JazzHR, TalentReef, CATS, Gusto, CareerPuck, Homerun, Gem, Trakstar, Dover, Factorial, TriNet Hire, Oracle Cloud |
| Job Boards | LinkedIn, Glassdoor, Wellfound, Builtin, Remote Rocketship, Y Combinator, Keka, ADP, Notion |
| Subdomain Patterns | `jobs.*`, `careers.*`, `talent.*`, `people.*` |

### Time Filter Options
| Selection | Google Parameter | Use Case |
|---|---|---|
| Past Hour | `tbs=qdr:h` | Live monitoring |
| Past 24 Hours | `tbs=qdr:d` | Daily runs (recommended) |
| Past Week | `tbs=qdr:w` | Weekly batch search |
| Past Month | `tbs=qdr:m` | Broad initial search |
| All | none | No restriction |

---

## 📊 Understanding Your Scores

### Visa Friendliness Score (1–10)
Points are added based on:

| Factor | Max Points |
|---|---|
| H1B petition count (more = better) | 4 pts |
| H1B approval rate (≥90% = full points) | 2 pts |
| E-Verify registered | 2 pts |
| Direct employer (not a staffing agency) | 1 pt |
| Large company size | 1 pt |

**What it means:**
- **8–10** → Strong H1B sponsor — prioritise these
- **5–7** → Some history — worth applying, verify manually
- **1–4** → Little/no history — risky, proceed with caution
- **0** → Job description explicitly says NO sponsorship — skip

### Skill Match Score (1–10)
Counts how many of your listed skills appear in the full job description text. More skills listed = more accurate score.

### Sponsorship Status (Job-Level)
This is the **most important column** — it reads the actual job description:

| Value | Meaning | Action |
|---|---|---|
| `HAS_SPONSORSHIP` | Job explicitly says sponsorship available | ✅ Apply with confidence |
| `NO_SPONSORSHIP` | Job explicitly says no H1B sponsorship | 🚫 Skip — don't waste time |
| `UNKNOWN` | No explicit language found | ❓ Check manually or email HR |

---

## 🏦 H1B Data Source

All H1B history data comes from the **official Department of Labor LCA Disclosure Data (FY2024)**, pre-loaded as a local lookup table in `h1b-data-lookup.js`.

**Why local instead of scraping myvisajobs.com?**
Both myvisajobs.com and h1bdata.info use Cloudflare bot protection that blocks automated browsers — even Playwright — on cloud server IPs. The DOL data is more accurate anyway since it's the primary source.

**To update the data yearly:**
1. Go to: https://www.dol.gov/agencies/eta/foreign-labor/performance
2. Download the H-1B LCA Excel file for the new fiscal year
3. Update the `H1B_DB` object in `src/checkers/h1b-data-lookup.js`

---

## ⚠️ Important Notes for F1/STEM OPT Students

### E-Verify is Non-Negotiable
Under STEM OPT rules, your employer **must** be enrolled in E-Verify. This is a legal requirement — not optional. Always verify at:
👉 https://www.e-verify.gov/employers/employer-search

### Staffing Agencies to Avoid
The actor automatically flags known staffing firms. Warning signs:
- Company name contains: "staffing," "solutions LLC," "IT services," "corp to corp"
- Never heard of the company but they claim to have many openings
- Ask you to work on "bench" between projects

### Your Rights as an OPT Worker
- Employers **cannot** charge you for H1B filing fees — it is illegal
- You must be paid market wage — unpaid bench time violates USCIS rules
- If something feels wrong, contact your school's DSO immediately

### H1B Lottery Timeline
| Month | Action |
|---|---|
| **October–February** | Find job offer + employer files LCA |
| **March 1** | USCIS opens H1B registration |
| **March 31** | Registration deadline |
| **April** | Lottery selection announced |
| **October 1** | H1B status begins |

---

## 🔧 Customisation

### Add More Keywords
In the Apify Input form, add any skill or certification that appears in job descriptions you're targeting. Examples:
- Accounting: `CPA`, `GAAP`, `SOX`, `PCAOB`, `Big 4`
- Data: `SQL`, `Python`, `Tableau`, `Power BI`, `dbt`
- Finance: `FP&A`, `financial modeling`, `CFA`, `Bloomberg`
- Tech: `AWS`, `React`, `Kubernetes`, `machine learning`

### Add More Companies to H1B Database
Edit `src/checkers/h1b-data-lookup.js` and add entries to `H1B_DB`:
```javascript
"your company name": { count: 500, approvalRate: 0.94, avgWage: "$110,000", latestYear: 2024 },
```

### Add More No-Sponsorship Phrases
Edit `src/utils/sponsorship-detector.js` and add to `NO_SPONSORSHIP_PHRASES`:
```javascript
'your custom phrase here',
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---|---|
| 0 jobs found | Try `timeFilter: "Past Week"` or `"All"` and broader keywords |
| All visa scores = 1 | Company not in local DB — check manually at myvisajobs.com |
| Google blocking searches | Reduce `maxJobsPerKeyword` to 10, try again in 1 hour |
| Build fails on Apify | Check that `.actor/actor.json` exists (dot-folder is hidden in GitHub UI) |
| E-Verify shows Unknown | Verify manually at e-verify.gov before accepting any offer |

---

## 📄 Output CSV Columns

| Column | Description |
|---|---|
| Rank | Overall ranking (1 = best) |
| Job Title | Title from ATS posting |
| Company | Extracted from ATS URL |
| Location | Your search location |
| Visa Score (1-10) | Visa friendliness score |
| Skill Score (1-10) | Your skill match score |
| Sponsorship in Job Description | HAS_SPONSORSHIP / NO_SPONSORSHIP / UNKNOWN |
| Sponsorship Warning | Human-readable warning message |
| Matched Phrase | Exact phrase that triggered the sponsorship flag |
| H1B History | Yes / Unknown |
| H1B Petition Count | Number of petitions from DOL data |
| H1B Approval Rate | % approved |
| H1B Avg Wage | Average wage from DOL data |
| E-Verify | Yes / No / Unknown |
| Staffing Agency? | Yes / No |
| Search Keyword | Which keyword found this job |
| Time Filter Used | Which time filter was active |
| ATS Platform | Which platform the job was found on |
| Job URL | Direct link to apply |
| H1B Profile URL | myvisajobs.com link for manual verification |
| OPT Urgency | CRITICAL / HIGH / MODERATE / LOW |

---

*Built for the international student community. Good luck with your search! 🍀*
