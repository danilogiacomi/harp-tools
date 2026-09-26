# Harmonica Tools & Games — Design

**Date:** 2026-09-26
**Status:** Approved design, pending implementation plan

## 1. Purpose and scope

A website with practice tools and ear/technique games for **diatonic harmonica** players.

- **Audience:** hobby project — the author and friends. No accounts, no backend, no monetisation.
- **Deployment:** fully static build, deployable to GitHub Pages or any static web server (the author deploys it). Deployment is not a v1 priority, but nothing in the design may prevent it.
- **Language:** English-only UI. No i18n layer.
- **Platform:** desktop-first, must remain usable on a phone (practising with a phone on a music stand).

### v1 features

| Kind | Feature |
|---|---|
| Tool | Metronome |
| Tool | Tuner — listen (mic pitch detection) and play (reference notes) |
| Game | Echo the note |
| Game | Bend trainer |
| Game | Scale runner |
| Game | Interval ear training |
| Game | Melody echo |

### Later (explicitly out of v1)

- Hole finder game (shown a note name, play it anywhere on the harp)
- Tab reader (scrolling tab played in time with the metronome)
- Alternate tunings (Paddy Richter, Country, Natural Minor, …)
- Recorded harmonica samples (replacing the synth)
- AudioWorklet-based pitch detection (needed if the tab reader demands tighter timing)
- i18n / Italian UI

## 2. Technology

- **Vite + React 19 + TypeScript** (strict mode).
- **Hash-based routing** (`/#/tuner`) so the build works on GitHub Pages and plain static hosting without rewrite rules. Vite `base` path configurable.
- **Styling:** CSS Modules + CSS custom properties (technique colours, theme). Dark theme. No UI component library.
- **Pitch detection:** [`pitchy`](https://github.com/ianprime0509/pitchy) (McLeod Pitch Method) running on the main thread (approach A), behind a `PitchDetector` interface.
- **Persistence:** `localStorage` only (settings, best scores).
- **Tooling:** ESLint, Prettier, Vitest, React Testing Library.

## 3. Architecture

Three layers with one-directional dependencies: `ui → audio → core` (`ui` may also use `core` directly). `core` never imports browser or React APIs; `audio` never imports React.

```
src/
  core/            pure TypeScript, no React, no browser APIs, fully unit-tested
    music/         notes, frequencies, cents, intervals, scales
    harmonica/     Richter layout, 12 keys, blow/draw/bends/overblows/overdraws,
                   pitch → hole lookup, position → scale path
    games/         game logic as plain state machines (NoteMatcher, NotePool,
                   Session, per-game logic)
  audio/           browser audio, no React
    AudioEngine    single AudioContext, user-gesture unlock
    Microphone     getUserMedia + AnalyserNode lifecycle
    PitchDetector  interface + PitchyDetector
    NotePlayer     interface + SynthNotePlayer
    Metronome      look-ahead scheduler on the audio clock
  ui/              React
    hooks/         usePitch(), useMetronome(), useSettings(), …
    components/    HarmonicaDiagram, TunerNeedle, BendMeter, KeySelector, …
    pages/         Home, Metronome, Tuner, EchoNote, BendTrainer,
                   ScaleRunner, Intervals, MelodyEcho
```

**Global state:** one `SettingsContext` — harp key, A4 reference (default 440 Hz), include-advanced-over-notes flag, matcher thresholds, metronome BPM, noise floor. Persisted to `localStorage`. No global store library.

**Adding a game** = one state machine in `core/games` + one page in `ui/pages`.

## 4. Note model (`core/music`, `core/harmonica`)

### 4.1 Music basics

- Notes are represented internally as **MIDI numbers** (C4 = 60).
- `midiToFreq(midi, a4 = 440): number`
- `freqToMidi(freq, a4 = 440): { midi: number; cents: number }` — nearest note plus deviation in cents (−50…+50).
- Note naming respects the harp key's conventional spelling (flats for flat keys, sharps for sharp keys).
- Intervals (m2 … octave) and scale definitions (major, minor pentatonic, blues) as semitone patterns.

### 4.2 Richter layout (C harp reference)

| Hole | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Blow | C4 | E4 | G4 | C5 | E5 | G5 | C6 | E6 | G6 | C7 |
| Draw | D4 | G4 | B4 | D5 | F5 | A5 | B5 | D6 | F6 | A6 |

### 4.3 Derived notes (computed by rule, correct for every key)

- **Bends** occur on the higher-pitched reed of a hole: there are `(gap in semitones − 1)` bend steps, each one semitone below the previous.
  - Draw bends (draw higher than blow): holes 1, 2, 3, 4, 6. Hole 2 has 2 steps, hole 3 has 3.
  - Blow bends (blow higher than draw): holes 8, 9, 10. Hole 10 has 2 steps.
  - Holes 5 and 7 (1-semitone gap) have no bends.
- **Overblows** on holes 1–6 and **overdraws** on holes 7–10: one semitone above the *higher* reed's note (overblows: draw + 1 semitone, e.g. 6o on a C harp = Bb5; overdraws: blow + 1 semitone, e.g. 7od = C#6).
- **`common` flag:** overblows on 1, 4, 5, 6 and overdraws on 7, 9, 10 are `common: true`. Others (overblows 2, 3; overdraw 8) are `common: false` ("advanced"), hidden unless the include-advanced setting is on. All blow/draw/bend notes are `common: true`.

### 4.4 Keys

All 12 keys, standard Richter tuning. Pitch convention: **G, Ab, A, Bb, B** harps are pitched *below* C (hole 1 blow below C4); **Db, D, Eb, E, F, F#** harps are pitched *above* C.

### 4.5 Types and functions

```ts
type Technique = 'blow' | 'draw' | 'drawBend' | 'blowBend' | 'overblow' | 'overdraw'

interface HarpNote {
  hole: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  technique: Technique
  bendSteps: 0 | 1 | 2 | 3   // semitones bent; 0 for non-bends
  midi: number
  common: boolean
}

buildHarp(key: HarpKey): HarpNote[]
findNotes(harp: HarpNote[], midi: number): HarpNote[]   // G on C harp → [2 draw, 3 blow]
tabLabel(note: HarpNote): string
```

### 4.6 Tab notation

- Blow: `4` · Draw: `-4`
- Bends: one `'` per half-step — `-3'`, `-3''`, `-3'''`, `10'`, `10''`
- Overblow: `6o` · Overdraw: `7od`

## 5. HarmonicaDiagram component

The shared chart used by every tool and game.

### 5.1 Layout

Hole-number row in the middle. Blow side above, draw side below. Derived notes are extra boxes stacked away from the centre (deeper bends further out). Example (C harp):

```
  overblow        D#4  G#4  C5   D#5  F#5  A#5                       ← blow side
  blow bend ''                                                   A#6
  blow bend '                                          D#6  F#6  B6
  blow            C4   E4   G4   C5   E5   G5   C6   E6   G6   C7
  ─────────────── 1    2    3    4    5    6    7    8    9    10 ───
  draw            D4   G4   B4   D5   F5   A5   B5   D6   F6   A6
  draw bend '     C#4  F#4  A#4  C#5       G#5
  draw bend ''         F4   A4
  draw bend '''             G#4
  overdraw                                      C#6  F6   G#6  C#7   ← draw side
```

Row order from the top: overblows, blow bends (deepest step furthest from the centre), blow, **hole numbers**, draw, draw bends (deepest step furthest from the centre), overdraws.

### 5.2 Colour coding (one colour per technique, CSS variables)

| Technique | Colour |
|---|---|
| Blow | neutral grey (shade A) |
| Draw | neutral grey (shade B) |
| Bends (blow and draw, any depth) | amber |
| Overblows | teal |
| Overdraws | violet |
| Advanced (`common: false`) | technique colour, dashed outline, faded; hidden when include-advanced is off |

A small legend is shown under the chart.

### 5.3 Behaviour

- **Highlight states:** `detected` (live mic note), `target`, `correct`, `wrong`.
- **Clickable:** clicking a box plays its note via NotePlayer.
- **Label toggle:** note names (`C4`) ↔ tab labels (`-3''`).
- Tuner: highlights every box matching the detected pitch, with a cents indicator.

## 6. Audio engine (`audio/`)

### 6.1 AudioEngine

- Singleton owning the single `AudioContext`.
- Lazily created and unlocked on the first user gesture. Audio pages show a "Tap to start" overlay until unlocked (iOS/Chrome autoplay policy handled in one place).
- Exposes `ctx`, `now()`, and a master output bus with volume.
- Resumes automatically if suspended (tab backgrounded, iOS interruption); re-shows the overlay if a resume needs a gesture.

### 6.2 Microphone

- `start()`: `getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })` — processing filters distort harmonica tone.
- Connects to an `AnalyserNode`, `fftSize` 2048 (raise to 4096 if low harps — down to ~G3 — are unstable).
- Reference-counted: tracks stop when the last consumer releases it.

### 6.3 PitchDetector

```ts
interface PitchReading { freq: number; clarity: number; rms: number }
interface PitchDetector {
  start(): Promise<void>   // resolves once the mic is open; rejects with MicrophoneError
  stop(): void
  // rms is always reported (even when the reading is gated to null) so the UI can draw a level meter
  onPitch(cb: (r: PitchReading | null, rms: number) => void): () => void  // returns unsubscribe
}
```

- `PitchyDetector` samples the analyser on `requestAnimationFrame`.
- Emits `null` unless `clarity ≥ 0.9` and `rms` ≥ the noise floor (silence/breath noise).
- Median filter over the last 3 readings to suppress spikes.
- Consumers convert via `freqToMidi` + `findNotes`.

### 6.4 NotePlayer

```ts
interface NotePlayer {
  play(midi: number, opts?: { durationMs?: number }): Promise<void>  // resolves when the note ends
  start(midi: number): void   // sustain until stop()
  stop(): void
  readonly isSounding: boolean
}
```

- `SynthNotePlayer`: sawtooth + triangle oscillators → low-pass filter → envelope with short attack/release, for a reed-like tone.
- A future `SampleNotePlayer` implements the same interface.

### 6.5 Metronome

- Standard look-ahead scheduler: a 25 ms timer schedules clicks up to 100 ms ahead on the audio clock.
- Emits `onBeat(beatIndex, audioTime)` for UI sync.

### 6.6 Feedback avoidance

Games ignore mic readings while `NotePlayer.isSounding` and for 150 ms after it stops.

## 7. Tools

### 7.1 Metronome page

- BPM 30–250: slider, +/− buttons, tap tempo (average of last 4 taps).
- Time signatures: 2/4, 3/4, 4/4, 6/8, 12/8, accented first beat.
- Subdivisions: off / 8ths / triplets / 16ths (quieter clicks).
- Beat dots flash in sync. Spacebar toggles start/stop.
- BPM stored in shared settings (reusable by scale runner and future tab reader).

### 7.2 Tuner page

- **Listen mode (default):** large note name + octave, cents needle/bar (−50…+50), frequency in Hz. Colour: green within ±10¢, amber within ±25¢, red beyond. HarmonicaDiagram for the selected key lights every matching box. A "not on this harp" indicator shows when the detected pitch doesn't exist on the selected harp (e.g. over-bent). Small input-level meter to help set the noise floor.
- **Play mode:** click a diagram box or pick from a list; plays while held, with a sustain toggle.
- **Settings:** harp key, A4 calibration 430–450 Hz (default 440), show advanced over-notes.

### 7.3 Home page

Card grid linking the 2 tools and 5 games; global key selector in the header.

## 8. Games

### 8.1 Shared logic (`core/games`)

- **NoteMatcher:** given a target MIDI note and a stream of timestamped readings, reports `progress` (0–1) and `matched` once the pitch has been held within ±25 cents for 500 ms. Both thresholds are configurable in settings. A `null` reading or out-of-tolerance reading resets the hold.
- **NotePool:** builds candidate target notes from the current key plus filters — hole range (1–10), techniques (blow/draw, bends, overblows/overdraws), include advanced.
- **Session:** practice and scored modes.
  - Practice: untimed, no score.
  - Scored: 10 rounds; points = accuracy × speed bonus; best score saved per game and per settings combination in `localStorage`.

All games show the HarmonicaDiagram with the target highlighted (where the mode allows) and the live detected note.

### 8.2 Echo the note

Site plays a random note from the pool; player holds the same note.
- Practice: untimed. After ~3 s of wrong attempts, offer "hear again" or "show me" (highlights the box).
- Scored: 8 s per note.

### 8.3 Bend trainer

Pick a target bend (or random from pool bends). A vertical **BendMeter** shows the hole's unbent note at the top, each bend step as a marker, and the live pitch as a moving dot. Hit the target and hold. Scored mode: timed, plus a stability score (low pitch variance during the hold).

### 8.4 Scale runner

Choose scale (major, minor pentatonic, blues) and position (1st, 2nd, 3rd). The path through the harp is computed from the note model, using bends where the scale requires them. Next box highlighted; advance on match. Direction: up, down, or up-and-down. Optional metronome: in scored mode, reward notes landing on the beat within ±100 ms.

### 8.5 Interval ear training

Site plays two notes.
- **Name mode:** pick the interval from buttons (m2 … octave).
- **Play mode:** site plays the first note, player plays the second.
- Configurable interval pool.

### 8.6 Melody echo

Site plays a 2–5 note phrase generated from the pool, biased toward small steps. Player plays it back in order; each note uses a shorter 250 ms hold. On error, show which note was wrong. Scored mode increases phrase length as the player succeeds.

## 9. Error handling

- **Mic permission denied / no device:** clear message with per-browser re-enable instructions. Metronome and tuner play mode still work; mic-dependent games show a "mic needed" state.
- **Insecure context:** detect missing `navigator.mediaDevices` and explain HTTPS/localhost requirement.
- **Suspended AudioContext:** auto-resume on next interaction or re-show tap overlay.
- **Noisy room:** adjustable rms noise floor + input-level meter on the tuner.
- **No Web Audio support:** single fallback notice.

## 10. Testing

- **Vitest unit tests for all of `core/`:** MIDI/frequency/cents maths; harp layout for all 12 keys (checked against known charts); bend/overblow/overdraw rules and `common` flags; `findNotes`; `tabLabel`; NoteMatcher timing with fake reading streams and a fake clock; NotePool filters; scale-path generation per position; Session scoring.
- **Pitch detection test:** generate sine and sawtooth buffers, run them through PitchyDetector's analysis function, assert detection within ±5 cents from G3 to G7 (G harp hole 1 blow up to the F# harp's hole 10 overdraw).
- **React Testing Library:** HarmonicaDiagram rendering (row layout, colours by technique, advanced hiding) and highlight states; KeySelector.
- **Manual verification with a real harmonica** for each tool and game before it is considered done (performed by the author).

## 11. Build and deploy

- `npm run build` → static `dist/`.
- Vite `base` configurable for GitHub Pages sub-path deployment.
- The mic requires HTTPS in production (GitHub Pages provides it; the author's own server must too).

## 12. Repository extras

- A polished `README.md` describing the project, features, and development setup.
- The **built-by-agents** tooling (`scripts/usage-self.ts` + `.githooks/pre-commit`) keeps a "Built by agents" token-usage section in the README up to date on each commit. Requires Bun on the developer machine.
