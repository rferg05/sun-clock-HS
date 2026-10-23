import { describe, expect, it } from 'vitest';
import { dayPhase, dayProgress, moonPhase, moonPhaseName, sunTimes, todaysSunTimes } from './astro';

const CHICAGO = [41.8781, -87.6298] as const;
const MIN = 60_000;

describe('sun times', () => {
  it('matches published Chicago sunrise and sunset', () => {
    // 2026-10-22: sunrise 7:12 AM, sunset 6:00 PM CDT (UTC-5).
    const t = todaysSunTimes(Date.parse('2026-10-22T15:00:00Z'), ...CHICAGO, 'America/Chicago');
    expect(Math.abs(t.sunrise! - Date.parse('2026-10-22T12:12:00Z'))).toBeLessThan(3 * MIN);
    expect(Math.abs(t.sunset! - Date.parse('2026-10-22T23:00:00Z'))).toBeLessThan(3 * MIN);
  });

  it('keeps today\'s times just after local midnight', () => {
    const t = todaysSunTimes(Date.parse('2026-10-22T05:30:00Z'), ...CHICAGO, 'America/Chicago'); // 12:30 AM CDT
    expect(new Date(t.sunrise!).toISOString().slice(0, 10)).toBe('2026-10-22');
  });

  it('reports polar day and night', () => {
    expect(sunTimes(Date.parse('2026-06-21T12:00:00Z'), 78, 15).polar).toBe('day');
    expect(sunTimes(Date.parse('2026-12-21T12:00:00Z'), 78, 15).polar).toBe('night');
  });
});

describe('day phase', () => {
  const t = { sunrise: 1000 * MIN, sunset: 1600 * MIN, solarNoon: 1300 * MIN };
  const w = 45 * MIN;
  it('walks rising, day, setting, night', () => {
    expect(dayPhase(900 * MIN, t, w)).toBe('night');
    expect(dayPhase(970 * MIN, t, w)).toBe('rising');
    expect(dayPhase(1040 * MIN, t, w)).toBe('rising');
    expect(dayPhase(1300 * MIN, t, w)).toBe('day');
    expect(dayPhase(1590 * MIN, t, w)).toBe('setting');
    expect(dayPhase(1700 * MIN, t, w)).toBe('night');
  });
  it('tracks progress across the arc', () => {
    expect(dayProgress(1300 * MIN, t)).toBeCloseTo(0.5);
    expect(dayProgress(900 * MIN, t)).toBeNull();
  });
});

describe('moon phase', () => {
  it('is full and new on known dates', () => {
    // Full moon 2026-01-03 10:03 UTC; new moon 2026-01-18 19:52 UTC.
    const full = moonPhase(Date.parse('2026-01-03T10:03:00Z'));
    expect(full.phase).toBeCloseTo(0.5, 1);
    expect(full.fraction).toBeGreaterThan(0.98);
    const nu = moonPhase(Date.parse('2026-01-18T19:52:00Z'));
    expect(Math.min(nu.phase, 1 - nu.phase)).toBeLessThan(0.03);
    expect(moonPhaseName(0.37)).toBe('Waxing gibbous');
  });
});
