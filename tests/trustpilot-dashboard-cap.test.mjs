import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('dashboard uses saved Trustpilot cap and recorded invitation history', async () => {
  const home = await readFile(new URL('../src/components/admin/DashboardHome.js', import.meta.url), 'utf8');

  assert.match(home, /adminFetch\('\/api\/admin\/reviews\/stats'\)/);
  assert.match(home, /trustpilotStatus\?\.trustpilotCap/);
  assert.match(home, /trustpilotStatus\?\.trustpilotThisMonth/);
  assert.doesNotMatch(home, /TRUSTPILOT_MONTHLY_LIMIT|const TRUSTPILOT_GO_LIVE/);
  assert.doesNotMatch(home, /Estimate only from completed orders/);
});
