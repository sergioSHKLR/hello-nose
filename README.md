# Hello Nose

Single-button PWA that plays Motorola’s stock **Hello** notification (not the 15-second “Hello Moto” ringtone).

Source file: firmware `product/media/audio/notifications/Hello.ogg`  
Artist metadata: Justin McGrath · ~2.4 s

## Use

1. Tap the red clown nose → play once.
2. **Every** — repeat every N seconds.
3. **Random** — wait a random interval between min and max seconds, optionally stop after M minutes (`0` = run until Stop).
4. Optional OS notification on each play (permission prompt on Start).
5. Screen Wake Lock while the timer is armed (keeps the tab from sleeping; browsers still throttle background tabs).

Install: Chrome / Edge / Android → “Add to Home Screen”. iOS Safari → Share → Add to Home Screen.

## Deploy

Static files. GitHub Pages from `/` on `main`:

Repo → Settings → Pages → Deploy from a branch → `main` / `/ (root)`.

Live URL after Pages is on:

`https://sergioshklr.github.io/hello-nose/`

Timer audio only fires while the PWA/tab is allowed to run. That is a browser limit, not an app bug.

## Files

| Path | Role |
|---|---|
| `index.html` | UI |
| `app.js` | Play + timers |
| `hello-audio.js` | Embedded MP3 (transcoded from firmware Hello.ogg) |
| `icons/nose.svg` | Clown-nose app / notification icon |
| `sw.js` | Offline cache |

Motorola / Lenovo own the sound. This repo is a personal soundboard, not a product.
