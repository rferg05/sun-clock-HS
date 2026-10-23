import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PluginComponentProps } from './hs-plugin';
import { hostFrameStyle } from './host-style';
import { readConfig } from './config';
import type { Config } from './config';
import { dayPhase, dayProgress, moonPhase, todaysSunTimes } from './astro';
import type { SunTimes } from './astro';
import { PhaseIcon, SunHorizonGlyph } from './icons';

/** The manifest's default text size, which every proportion below is tuned to. */
const BASE_FONT_SIZE = 18;

// ── Formatting ──────────────────────────────────────────────────────────────

interface ClockText { main: string; period: string }

function clockFormatter(config: Config, hostFormat: '12h' | '24h' | undefined, timezone: string | undefined, seconds: boolean) {
  const fmt = config.timeFormat === 'auto' ? hostFormat : config.timeFormat;
  const opts: Intl.DateTimeFormatOptions = {
    hour: 'numeric', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}),
    ...(fmt ? { hour12: fmt === '12h' } : {}),
  };
  let f: Intl.DateTimeFormat;
  try {
    f = new Intl.DateTimeFormat('en-US', { ...opts, timeZone: timezone || undefined });
  } catch {
    f = new Intl.DateTimeFormat('en-US', opts);
  }
  return (ms: number): ClockText => {
    const v: Record<string, string> = {};
    for (const p of f.formatToParts(new Date(ms))) v[p.type] = p.value;
    const hour = v.dayPeriod ? v.hour : v.hour.padStart(2, '0');
    const main = `${hour}:${v.minute}${seconds ? `:${v.second}` : ''}`;
    return { main, period: v.dayPeriod ?? '' };
  };
}

/** A rough width in em for the layout, close enough for Inter and the
 *  system stacks: digits are tabular, colons and spaces narrow. */
function widthEm(text: string): number {
  let w = 0;
  for (const ch of text) w += /[0-9]/.test(ch) ? 0.6 : ch === ':' ? 0.3 : ch === ' ' ? 0.28 : 0.7;
  return w;
}

// ── Ticking ─────────────────────────────────────────────────────────────────

/** Now, re-read on each second or minute boundary so the clock flips on time. */
function useNow(stepMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => { setNow(Date.now()); schedule(); }, stepMs - (Date.now() % stepMs) + 20);
    };
    setNow(Date.now());
    schedule();
    return () => clearTimeout(timer);
  }, [stepMs]);
  return now;
}

function useBoxSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize((s) => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    const ro = new ResizeObserver(read);
    ro.observe(el);
    read();
    return () => ro.disconnect();
  }, []);
  return { ref, ...size };
}

// ── Module ──────────────────────────────────────────────────────────────────

export default function SunClock(props: PluginComponentProps) {
  const { style, timezone } = props;
  const config = useMemo(() => readConfig(props.config ?? {}), [props.config]);
  const now = useNow(config.showClock && config.showSeconds ? 1000 : 60_000);
  const { ref, w, h } = useBoxSize();

  const host = window.__HS_SDK__?.getHostSettings?.();
  const lat = typeof props.latitude === 'number' ? props.latitude : host?.latitude ?? null;
  const lng = typeof props.longitude === 'number' ? props.longitude : host?.longitude ?? null;
  const hasLocation = typeof lat === 'number' && typeof lng === 'number';

  const clock = useMemo(() => clockFormatter(config, props.timeFormat, timezone, config.showClock && config.showSeconds),
    [config, props.timeFormat, timezone]);
  const shortTime = useMemo(() => clockFormatter(config, props.timeFormat, timezone, false),
    [config, props.timeFormat, timezone]);

  const times: SunTimes | null = hasLocation ? todaysSunTimes(now, lat, lng, timezone) : null;
  const phase = times ? dayPhase(now, times, config.phaseWindow * 60_000) : 'night';
  const progress = times ? dayProgress(now, times) : null;
  const moon = moonPhase(now).phase;

  const fmtSun = (ms: number | null | undefined) => {
    if (ms == null) return '--:--';
    const t = shortTime(ms);
    return t.period ? `${t.main} ${t.period}` : t.main;
  };

  return (
    <div style={hostFrameStyle(style, { baseFontSize: BASE_FONT_SIZE })}>
      <div ref={ref} style={{ width: '100%', height: '100%', position: 'relative' }}>
        {w > 0 && h > 0 && (
          <Scene
            w={w} h={h} fs={Number.isFinite(style.fontSize) && style.fontSize > 0 ? style.fontSize : BASE_FONT_SIZE}
            config={config} clock={config.showClock ? clock(now) : null}
            rise={fmtSun(times?.sunrise)} set={fmtSun(times?.sunset)}
            progress={progress} phase={phase} moon={moon} mirrorMoon={hasLocation && lat < 0}
            notice={hasLocation ? null : 'Set a location in Settings'}
          />
        )}
      </div>
    </div>
  );
}

interface SceneProps {
  w: number; h: number; fs: number; config: Config;
  clock: ClockText | null; rise: string; set: string;
  progress: number | null; phase: ReturnType<typeof dayPhase>; moon: number; mirrorMoon: boolean;
  notice: string | null;
}

function Scene({ w, h, fs, config, clock, rise, set, progress, phase, moon, mirrorMoon, notice }: SceneProps) {
  const glowId = `${useId().replace(/:/g, '')}-glow`;

  // ── Bottom row: the rise and set blocks under the arc's two feet.
  const timeFs = fs * 1.35;
  const labelFs = fs * 0.9;
  const blockH = timeFs * 1.05 + (config.showLabels ? labelFs * 1.35 : 0);
  const below = fs * 0.45;
  const horizonY = h - blockH - below;
  const iconSize = config.showSideIcons ? blockH * 0.95 : 0;
  const iconGap = config.showSideIcons ? fs * 0.4 : 0;
  const textW = Math.max(widthEm(rise), widthEm(set)) * timeFs;

  // ── The arc: as wide as the blocks allow, as tall as the space above the horizon.
  const strokeW = Math.max(2, fs * 0.3);
  const topSpace = config.showNoon || notice ? fs * 1.8 : strokeW + fs * 0.3;
  const R = Math.max(4, Math.min(w / 2 - textW / 2 - iconGap - iconSize - 2, horizonY - topSpace));
  const cx = w / 2;
  const top = horizonY - R;

  // ── The sun's place on the arc.
  const sun = progress == null ? null : {
    x: cx - R * Math.cos(Math.PI * progress),
    y: horizonY - R * Math.sin(Math.PI * progress),
  };

  // ── The clock, sized to sit inside the arc above the horizon.
  let clockEl: React.ReactNode = null;
  if (clock) {
    const periodScale = 0.42;
    const em = widthEm(clock.main) + (clock.period ? widthEm(` ${clock.period}`) * periodScale : 0);
    const size = Math.min(R * 0.4 * config.clockScale, (R * 1.5) / em);
    const baseline = horizonY - Math.max(fs * 0.45, R * 0.14);
    clockEl = (
      <text x={cx} y={baseline} textAnchor="middle" fontSize={size} fontWeight={300}
        style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
        {clock.main}
        {clock.period && <tspan fontSize={size * periodScale} fontWeight={400} dx={size * 0.12} opacity={0.75}>{clock.period}</tspan>}
      </text>
    );
  }

  // ── The phase icon, centered under the horizon.
  // A little taller than the space under the horizon, so it rides up just
  // over the line the way the sun sits on it.
  const iconD = Math.min((blockH + below) * 1.4 * config.phaseIconScale, R * 0.7);
  const iconCy = h - iconD / 2;

  const timeY = horizonY + below + timeFs * 0.85;
  const labelY = timeY + labelFs * 1.35;
  const iconY = horizonY + below + (blockH - iconSize) / 2;
  const showArrows = !config.showSideIcons;
  const halfLine = R + fs * 1.4;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="currentColor"
      style={{ display: 'block', overflow: 'visible', filter: config.softShadow ? 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.55))' : undefined }}>
      <defs>
        <radialGradient id={glowId}>
          <stop offset="0" stopColor={config.accentColor} stopOpacity={0.55} />
          <stop offset="1" stopColor={config.accentColor} stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* Horizon */}
      <line x1={Math.max(0, cx - halfLine)} x2={Math.min(w, cx + halfLine)} y1={horizonY} y2={horizonY}
        stroke="currentColor" strokeOpacity={0.35} strokeWidth={Math.max(1, fs * 0.09)} />

      {/* The day's path, dotted, with the part already travelled drawn solid. */}
      <path d={`M${cx - R} ${horizonY}A${R} ${R} 0 0 1 ${cx + R} ${horizonY}`} fill="none"
        stroke="currentColor" strokeOpacity={0.3} strokeWidth={strokeW}
        strokeDasharray={`${strokeW * 1.5} ${strokeW * 1.4}`} />
      {sun && config.showSunOnArc && (
        <path d={`M${cx - R} ${horizonY}A${R} ${R} 0 0 1 ${sun.x} ${sun.y}`} fill="none"
          stroke={config.accentColor} strokeOpacity={0.85} strokeWidth={strokeW} strokeLinecap="round" />
      )}

      {/* Noon */}
      {config.showNoon && !notice && (
        <g opacity={0.6}>
          <line x1={cx} x2={cx} y1={top - fs * 0.5} y2={top + fs * 0.5} stroke="currentColor" strokeWidth={Math.max(1, fs * 0.1)} />
          <text x={cx} y={top - fs * 0.8} textAnchor="middle" fontSize={fs}>noon</text>
        </g>
      )}
      {notice && <text x={cx} y={top - fs * 0.8} textAnchor="middle" fontSize={fs} opacity={0.7}>{notice}</text>}

      {clockEl}

      {sun && config.showSunOnArc && (
        <g>
          <circle cx={sun.x} cy={sun.y} r={fs * 1.5} fill={`url(#${glowId})`} />
          <circle cx={sun.x} cy={sun.y} r={fs * 0.55} fill={config.accentColor} />
        </g>
      )}

      {/* Sunrise, left */}
      <g>
        <text x={cx - R} y={timeY} textAnchor="middle" fontSize={timeFs} style={{ fontVariantNumeric: 'tabular-nums' }}>{rise}</text>
        {config.showLabels && (
          <text x={cx - R} y={labelY} textAnchor="middle" fontSize={labelFs} opacity={0.6}>{showArrows ? '↑ rise' : 'rise'}</text>
        )}
        {config.showSideIcons && (
          <svg x={cx - R - textW / 2 - iconGap - iconSize} y={iconY} width={iconSize} height={iconSize} viewBox="0 0 24 24" overflow="visible">
            <SunHorizonGlyph direction="up" iconStyle={config.iconStyle} />
          </svg>
        )}
      </g>

      {/* Sunset, right */}
      <g>
        <text x={cx + R} y={timeY} textAnchor="middle" fontSize={timeFs} style={{ fontVariantNumeric: 'tabular-nums' }}>{set}</text>
        {config.showLabels && (
          <text x={cx + R} y={labelY} textAnchor="middle" fontSize={labelFs} opacity={0.6}>{showArrows ? 'set ↓' : 'set'}</text>
        )}
        {config.showSideIcons && (
          <svg x={cx + R + textW / 2 + iconGap} y={iconY} width={iconSize} height={iconSize} viewBox="0 0 24 24" overflow="visible">
            <SunHorizonGlyph direction="down" iconStyle={config.iconStyle} />
          </svg>
        )}
      </g>

      {config.showPhaseIcon && iconD > 4 && (
        <PhaseIcon cx={cx} cy={iconCy} d={iconD} phase={phase} moon={moon}
          iconStyle={config.iconStyle} backdrop={config.iconBackdrop} mirrorMoon={mirrorMoon} />
      )}
    </svg>
  );
}
