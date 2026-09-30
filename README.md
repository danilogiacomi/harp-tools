<div align="center">

# 🎵 Harp Tools

**Practice tools and ear-training games for diatonic harmonica players — right in your browser.**

Tuner · Tone meter · Ear games · Tab reader · Lick trainer · Blues play-along · Practice log

**[▶ Try it live](https://danilogiacomi.github.io/harp-tools/)**

![Status](https://img.shields.io/badge/status-in%20development-yellow)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-static%20build-646cff?logo=vite&logoColor=white)

</div>

---

Harp Tools listens to your harmonica through the microphone, tells you exactly which
hole and technique you're playing, and turns that into games that train your ear, your
bends, and your knowledge of the instrument. It supports **all 12 keys** in Richter, Paddy Richter, Country and Natural minor
tuning, including **bends, overblows and overdraws**.

No accounts, no server. It's a static site that runs entirely in your browser — and you can
**install it** on your phone or computer and practise **offline**. On a phone the whole harp fits
the screen, and the screen stays on while you play.

## ✨ Features

### Tools

| | Tool | What it does |
|---|---|---|
| 🥁 | **Metronome** | 30–250 BPM, tap tempo, time signatures, subdivisions, sample-accurate timing |
| 🎯 | **Tuner — listen** | Detects the note you play, shows cents offset and lights up every matching hole |
| 🔊 | **Tuner — play** | Click any hole on the chart to hear its reference note |
| 🧭 | **Positions & keys** | Which harp to use for a song, and what each harp plays in every position |
| 🌬️ | **Tone & breath meter** | A live pitch and level chart, with steadiness and vibrato for the note you hold |
| 🩺 | **Harp health check** | Measures all 20 reeds and shows which ones are out of tune |
| 📈 | **Practice log** | Daily streaks, time practised per day and page, recent scores — kept in your browser |

### Games

| | Game | How it works |
|---|---|---|
| 👂 | **Echo the note** | The site plays a note — you play it back on your harp |
| 〰️ | **Bend trainer** | Hit and hold a target bend on a live bend meter |
| 🪜 | **Scale runner** | Play major, minor pentatonic and blues scales in 1st, 2nd and 3rd position |
| 🎼 | **Interval training** | Name the interval you hear, or play the second note yourself |
| 🔁 | **Melody echo** | Repeat short phrases that grow longer as you improve |
| 🔎 | **Hole finder** | A note name appears — find it on your harp, no hints by ear |
| 🎓 | **Note quiz** | Name the highlighted hole, or click the hole for a note; no mic needed |
| 📜 | **Tab reader** | Play songs from scrolling tab — it can wait for you — or type your own |
| 🎸 | **Lick trainer** | Hear a short blues, folk or minor lick at your tempo, then play it back |
| ⏱️ | **Rhythm trainer** | Play any note on every hit of a pattern, graded against the metronome |

Every game has a relaxed **practice** mode and a **scored** mode with best scores saved locally.

### Jam

| | | |
|---|---|---|
| 🎷 | **Blues play-along** | A synthesised 12-bar band in your harp's 2nd-position key; the chart shows the chord tones of every bar |

### The harmonica chart

At the heart of every screen is an interactive chart of your harp: blow notes above the
hole numbers, draw notes below, with every bend, overblow and overdraw laid out around
them and colour-coded by technique.

```
  overblow        D#4  G#4  C5   D#5  F#5  A#5
                                                                 A#6
  blow bend                                            D#6  F#6  B6
  blow            C4   E4   G4   C5   E5   G5   C6   E6   G6   C7
  ─────────────── 1    2    3    4    5    6    7    8    9    10
  draw            D4   G4   B4   D5   F5   A5   B5   D6   F6   A6
  draw bend       C#4  F#4  A#4  C#5       G#5
                       F4   A4
                            G#4
  overdraw                                      C#6  F6   G#6  C#7
```

## 🚀 Getting started

> Everything listed above works today. Each game has a relaxed practice mode and a scored
> mode; best scores are kept in your browser.

```sh
npm install
npm run dev      # start the dev server at http://localhost:5173
npm test         # run the unit tests
npm run build    # produce a static site in dist/
```

The microphone only works on **HTTPS or `localhost`**, and your browser will ask for
permission the first time.

### Deploying

`npm run build` outputs a plain static site. Serve `dist/` from any web server with HTTPS,
or publish it to GitHub Pages (the app uses hash-based routing, so no rewrite rules are needed).
This repo deploys itself: every push to `main` runs the tests, builds and publishes to
[danilogiacomi.github.io/harp-tools](https://danilogiacomi.github.io/harp-tools/) via GitHub Actions.

## 🏗️ How it's built

- **Vite + React 19 + TypeScript** (strict)
- **Web Audio API** for sound, the metronome scheduler and microphone input
- **[pitchy](https://github.com/ianprime0509/pitchy)** (McLeod Pitch Method) for pitch detection
- **Vitest** + React Testing Library for tests

The code is split into three layers: a pure-TypeScript `core/` (music theory, the
harmonica model and game logic, fully unit-tested), a browser `audio/` layer, and the
React `ui/`. See the [design spec](docs/superpowers/specs/2026-09-26-harmonica-tools-design.md)
for the details.

## 🗺️ Roadmap

- [x] Core note model — all 12 keys, bends, overblows, overdraws
- [x] Audio engine — mic, pitch detection, synth note player, metronome
- [x] Metronome and tuner
- [x] Echo the note
- [x] Bend trainer
- [x] Scale runner
- [x] Interval training
- [x] Melody echo
- [x] Alternate tunings — Paddy Richter, Country, Natural minor
- [x] Positions & keys, hole finder, note quiz
- [x] Practice log with streaks
- [x] Reed-like reference sound (Pure voice still available)
- [x] Harp health check, tone & breath meter
- [x] Rhythm trainer, tab reader, lick trainer
- [x] Blues play-along
- [x] Installable, offline, phone-friendly
- [ ] Later: recorded harp samples

<!-- usage:self:start -->

## 🤖 Built by agents

This project is built largely by coding agents. The numbers below are this repo's own
development footprint, read from the local agent logs (Claude Code transcripts and
Codex rollouts) on the machine that generated this section.

| Metric | Value |
|---|---|
| **Total tokens** | **281.8M** |
| Token breakdown | 903.2K output · 1.6K input · 7.6M cache-write · 273.3M cache-read |
| Agent time | ~5h 8m active (52h 33m wall-clock) |
| Turns | 631 assistant turns · 323 tool calls |
| Agents / models | Claude Code — claude-opus-5-5 |
| As of | 2026-09-26 → 2026-09-28 |

> 💡 Most of those tokens are *cache reads* — re-reading the growing conversation each
> turn — which is why the total dwarfs the tokens actually written.

_Regenerated by `bun run usage:self` (kept fresh via the repo's pre-commit hook)._

<!-- usage:self:end -->
