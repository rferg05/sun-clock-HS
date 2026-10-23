import React from 'react';
import { createRoot } from 'react-dom/client';
import manifest from '../manifest.json';
import SunClock from '../src/index';
import { makeHostDisplayCache } from './host-cache';

// Stand-in for the host: just enough SDK for the module to run.
// `?w=&h=` module size, `fs=` text size, `bg=bright|busy|dark` background,
// `tz=` timezone, `lat=&lng=` location, `at=HH:MM` pretend it's that time
// today (or `date=YYYY-MM-DD` too), `speed=N` run the clock N times fast,
// and any config key (`iconStyle=line`, `showSeconds=true`...).
const params = new URLSearchParams(location.search);
const timezone = params.get('tz') ?? 'America/Chicago';
document.body.className = params.get('bg') ?? 'dark';

const at = params.get('at');
const date = params.get('date');
const speed = Number(params.get('speed') ?? 1);
if (at || date || speed !== 1) {
  const realNow = Date.now.bind(Date);
  const start = realNow();
  // Chicago is UTC-5 in daylight time; close enough for a preview.
  const today = new Date(start - 5 * 3_600_000).toISOString().slice(0, 10);
  const fake = at || date ? Date.parse(`${date ?? today}T${at ?? '12:00'}:00-05:00`) : start;
  Date.now = () => fake + (realNow() - start) * speed;
}

(window as unknown as { React: typeof React }).React = React;
(window as unknown as { __HS_SDK__: unknown }).__HS_SDK__ = {
  displayCache: makeHostDisplayCache(),
  getHostSettings: () => ({ timezone, units: 'imperial', latitude: null, longitude: null, displayWidth: 1920, displayHeight: 1080, appVersion: 'dev' }),
};

const style = {
  fontSize: Number(params.get('fs') ?? manifest.defaultStyle.fontSize), fontFamily: 'inter', textColor: '#ffffff',
  backgroundColor: manifest.defaultStyle.backgroundColor, borderRadius: 12, padding: manifest.defaultStyle.padding,
  opacity: 1, backdropBlur: 12,
};
const w = Number(params.get('w') ?? manifest.defaultSize.w);
const h = Number(params.get('h') ?? manifest.defaultSize.h);
const reserved = ['w', 'h', 'fs', 'bg', 'tz', 'lat', 'lng', 'at', 'date', 'speed'];
const config = {
  ...manifest.defaultConfig,
  ...Object.fromEntries([...params].filter(([k]) => !reserved.includes(k))),
};
const lat = params.has('lat') ? Number(params.get('lat')) : 41.8781;
const lng = params.has('lng') ? Number(params.get('lng')) : -87.6298;

createRoot(document.getElementById('root')!).render(
  <div style={{ width: w, height: h }}>
    <SunClock config={config} style={style} timezone={timezone} latitude={lat} longitude={lng} />
  </div>,
);
