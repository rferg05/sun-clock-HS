# Sun Arc Clock

A Home Screens module based on the built-in Sunrise / Sunset arc view, with:

- **The current time** drawn inside the arc, above the horizon (toggle, size, seconds, 12/24-hour).
- **A center icon** that changes through the day: rising sun → full sun → setting sun → tonight's moon phase.
  The rising/setting sun shows for a configurable window (default 45 min) either side of sunrise/sunset.
- **Sunrise and sunset icons** beside the sunrise (left) and sunset (right) times.
- **Golden hour** shaded at both ends of the arc, and a **countdown** to sunset (or, after dark, to sunrise) above the clock.
- **The moon at night:** after sunset the arc follows the moon, with moonrise, moonset, its position and its phase name on top.
- The sun's position on the arc, with the part of the day already passed drawn solid.

Sun times and the moon phase are computed locally from the display's location; nothing is fetched.

## Install

In the Home Screens editor, open the Plugin Store, choose **Install from URL**, and paste:

```
https://github.com/rferg05/sun-clock-HS/releases/latest/download/sun-clock.tar.gz
```

This always points at the newest release. To update: Plugin Store > **Installed**, then the download icon on Sun Arc Clock, then **Install**.

## Developing

```bash
npm install
npm run preview   # http://localhost:5178 — try ?at=06:55, ?at=13:00, ?at=21:00, ?iconStyle=line, ?speed=600
npm test
npm run build     # dist/bundle.js
```

To package: copy `manifest.json` and `dist/bundle.js(.map)` into `release/pkg/sun-clock/` and
`tar -czf release/sun-clock-<version>.tar.gz -C release/pkg sun-clock`, copy it to `release/sun-clock.tar.gz`, and attach both to a
GitHub release tagged `v<version>` so the `latest/download` URL keeps working.
