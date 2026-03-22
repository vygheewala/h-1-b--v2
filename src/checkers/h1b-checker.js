/**
 * H1B Checker — wraps the local DOL lookup.
 * Instant, no network requests, never blocked.
 */
import { lookupH1BLocal } from './h1b-data-lookup.js';

export async function checkH1BHistory(companyName) {
  const result = lookupH1BLocal(companyName);
  if (result.found) {
    console.log(`       ✅ H1B: ${result.petitionCount} petitions (${result.source})`);
  } else {
    console.log(`       ℹ️  H1B: Not in local DB — ${result.profileUrl}`);
  }
  return result;
}
