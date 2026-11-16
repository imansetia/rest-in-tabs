import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buryTabs, countIdleTabs } from './burial.js';
import type { ExtractAdapter } from './adapters.js';
import { makeTab, fakeStorage, fakeTabs, fakeExtract } from './test-fakes.js';

/** Mostly false, so enough generated tabs are unprotected. */
const mostlyFalse = fc.oneof(
  { weight: 3, arbitrary: fc.constant(false) },
  { weight: 1, arbitrary: fc.constant(true) },
);

const tabSpec = fc.record({
  active: mostlyFalse,
  pinned: mostlyFalse,
  audible: mostlyFalse,
  incognito: mostlyFalse,
  scheme: fc.constantFrom('https', 'https', 'http', 'chrome'),
  host: fc.constantFrom('a.example.com', 'b.example.com', 'protected.example', 'docs.protected.example'),
  idle: fc.boolean(),
});

describe('countIdleTabs', () => {
  it('for the same tabs, the count equals the number a manual run buries', async () => {
    const seen = { some: 0, none: 0, autoBuryOff: 0, protectedSkipped: 0 };

    await fc.assert(
      fc.asyncProperty(
        fc.array(tabSpec, { maxLength: 8 }),
        fc.boolean(),
        fc.constantFrom<string[]>([], ['protected.example']),
        async (specs, autoBury, protectedSites) => {
          const now = Date.now();
          // installedAt = now: the manual selection must ignore it (Requirement 1.7).
          const storage = fakeStorage({ settings: { autoBury, protectedSites }, installedAt: now });
          const tabs = fakeTabs(
            specs.map((s, i) =>
              makeTab(i + 1, {
                url: `${s.scheme}://${s.host}/page${i}`,
                active: s.active,
                pinned: s.pinned,
                audible: s.audible,
                incognito: s.incognito,
                lastAccessed: s.idle ? 0 : now,
              }),
            ),
          );

          const count = await countIdleTabs(storage.adapter, tabs.adapter);
          // Counting never writes or closes anything.
          expect(storage.graves()).toEqual([]);
          expect(storage.stats()).toEqual({ buried: 0, resurrected: 0 });
          expect(tabs.removeCalls).toEqual([]);

          const buried = await buryTabs(storage.adapter, tabs.adapter, fakeExtract(), false);
          expect(count).toBe(buried);
          expect(tabs.removeCalls).toHaveLength(count);

          if (count > 0) seen.some++;
          else seen.none++;
          if (!autoBury && count > 0) seen.autoBuryOff++;
          const idleOnProtected = specs.some((s) => s.idle && s.host.endsWith('protected.example'));
          if (protectedSites.length > 0 && idleOnProtected) seen.protectedSkipped++;
        },
      ),
      { numRuns: 150 },
    );

    for (const n of Object.values(seen)) expect(n).toBeGreaterThan(0);
  });

  it('answers while a burial run is still in progress (does not wait in the run queue)', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    // Extraction blocks until the gate opens, so the run holds the run queue.
    const slowExtract: ExtractAdapter = {
      extractPageInfo: async (id) => {
        await gate;
        return { title: `Page ${id}` };
      },
    };
    const storage = fakeStorage({ installedAt: 0 });
    const tabs = fakeTabs([makeTab(1), makeTab(2)]);

    const run = buryTabs(storage.adapter, tabs.adapter, slowExtract, false);
    // If countIdleTabs were queued behind the run, this would never resolve.
    expect(await countIdleTabs(storage.adapter, tabs.adapter)).toBe(2);
    expect(tabs.removeCalls).toEqual([]);

    release();
    expect(await run).toBe(2);
  });
});
