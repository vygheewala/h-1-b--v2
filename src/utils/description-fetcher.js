/**
 * Full Job Description Fetcher
 *
 * Visits each ATS job URL with a real browser (Playwright)
 * to extract the complete description text — including the
 * legal fine print where "no sponsorship" disclaimers appear.
 *
 * Images/fonts are blocked to speed up loading.
 */

import { chromium } from 'playwright';

const DELAY_MS = 1500;
const wait = (ms) => new Promise(res => setTimeout(res, ms));

export async function fetchJobDescription(jobUrl) {
  if (!jobUrl?.startsWith('http')) return '';

  let browser = null;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Block images/fonts — we only need text
    await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,otf}',
      route => route.abort());

    await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // Try to find the description container
    try {
      await page.waitForSelector(
        '.content, .job-description, [class*="description"], [class*="jobDescription"], article, main',
        { timeout: 8000 }
      );
    } catch { /* page loaded but selector not found — still try to extract */ }

    await wait(1000);

    const text = await page.evaluate(() => {
      // Priority order: specific containers → article → main → body
      const selectors = [
        '.content-intro', '.job-description__content',
        '[data-automation="jobDescription"]', // Workday
        '.show-more-less-html__markup',        // LinkedIn (fallback)
        '.jobs-description__content',
        'article', 'main', '.content', 'body',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el?.innerText?.trim().length > 100) return el.innerText.trim();
      }
      return document.body?.innerText?.trim() || '';
    });

    await browser.close();
    await wait(DELAY_MS);
    return text;

  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.warn(`     ⚠️  Could not fetch description: ${err.message}`);
    return '';
  }
}
