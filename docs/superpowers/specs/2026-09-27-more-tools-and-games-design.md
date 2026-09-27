# More tools and games — Design

**Date:** 2026-09-27
**Status:** Approved. The user asked for all twelve ideas and delegated every decision ("take all decisions and implement them").
**Builds on:** `2026-09-26-harmonica-tools-design.md`, whose architecture, constraints and conventions all still apply. This spec adds features; it doesn't change the approach.

## 0. Scope and delivery

Twelve features, delivered in two plans:

| Plan | Features |
|---|---|
| **Plan 3: model, quick tools, quizzes, log** | 3 alternate tunings · 6 position & key finder · 1 hole finder · 11 note-name quiz · 12 practice log · 4 better reference sound |
| **Plan 4: audio-heavy tools and games** | 5 harp health check · 7 tone & breath meter · 10 rhythm trainer · 2 tab reader · 9 lick trainer · 8 blues play-along |

Plan 4 depends on the tuning-aware harp model from Plan 3 (§1). Every new page follows the existing conventions:
- hash route;
- `AudioGate` for any page that makes or hears sound;
- the shared `Stage` / `ScorePanel` / `PlayAgain` / `ModeToggle` / `PoolFilterPanel` / `GameLayout` components for games;
- pure logic in `src/core` with timestamps and randomness injected;
- mic access only through `useGameAudio` (games) or `usePitch` (tools);
- the stable-layout rule: anything that can appear during a session has its space reserved.

**Home page:** reorganised into four groups:

| Group | Pages |
|---|---|
| **Tools** | Tuner, Metronome, Tone meter, Harp health check, Positions & keys |
| **Games** | Echo, Bend trainer, Scale runner, Interval training, Melody echo, Hole finder, Note quiz, Tab reader, Lick trainer, Rhythm trainer |
| **Jam** | Blues play-along |
| **Progress** | Practice log |

The header nav gains "Log".

## 1. Alternate tunings (feature 3)

**Model.** `src/core/harmonica/tunings.ts` defines each tuning as blow and draw MIDI arrays for a harp labelled **C**; other keys transpose them as today.

| Tuning | Blow (holes 1–10) | Draw (holes 1–10) | What differs from Richter |
|---|---|---|---|
| **Richter** (`richter`) | C4 E4 G4 C5 E5 G5 C6 E6 G6 C7 | D4 G4 B4 D5 F5 A5 B5 D6 F6 A6 | — |
| **Paddy Richter** (`paddy`) | C4 E4 **A4** C5 E5 G5 C6 E6 G6 C7 | D4 G4 B4 D5 F5 A5 B5 D6 F6 A6 | hole 3 blow up to A (tunes for 1st-position melodies) |
| **Country** (`country`) | Richter | D4 G4 B4 D5 **F#5** A5 B5 D6 F6 A6 | hole 5 draw up to F# (the major 7th in 2nd position, so no bend is needed for it) |
| **Natural minor** (`naturalMinor`) | C4 **Eb4** G4 C5 **Eb5** G5 C6 **Eb6** G6 C7 | D4 G4 **Bb4** D5 F5 **Ab5** **Bb5** D6 F6 **Ab6** | minor 3rd, 6th and 7th; the harp is labelled by its blow key (1st-position minor) |

**API.** `buildHarp(key, tuning = 'richter')` gains the optional second argument, so existing callers keep working. `TUNINGS` lists id, display name and one-line description.

**Rules for derived notes** are the existing ones, applied per hole to whichever reed is higher:
- bends on the higher reed, one per semitone of gap minus one;
- the over-note one semitone above the higher reed;
- it's an overblow if the draw reed is higher, an overdraw if the blow reed is higher.

**Two edge cases:**
- **Equal reeds** (possible in some tunings, not these four): no bends and no over-note.
- **`common` flag:** Richter keeps its current flags. In the other tunings an over-note is `common` if it sits on holes 1, 4, 5 or 6 (overblow) or 7, 9 or 10 (overdraw), the same holes as Richter. Every bend is `common`.

**Setting.** `Settings.tuning` (default `'richter'`, sanitised). A tuning selector sits next to the key selector in the header, showing "C harp · Richter". Every harp-using page reads `settings.tuning`. Best-score keys include `tuning` whenever it isn't Richter; the Richter keys stay as they are so existing scores survive.

**Tests:** pin each tuning's table plus derived bends and over-notes on a C harp, for example:
- Country: hole 5 draw is F#5, with 1 draw bend (F5).
- Natural minor: hole 3 draw is Bb4, with 2 bends (A4, Ab4).
- Paddy: hole 3 blow A4 against draw B4 gives 1 draw bend (Bb4) and overblow C5.

## 2. Position & key finder (feature 6)

Route `/positions`. A tool with no audio.

**Core** (`src/core/harmonica/positions.ts`, extended):

| Function | Returns |
|---|---|
| `positionTonicPc(harpKey, position)` | the tonic pitch class a position plays, for positions 1–12 (circle of fifths: each position is a fifth above the previous one) |
| `harpForPosition(songTonicPc, position)` | the `HarpKey` to use |
| `POSITION_INFO` | the mode and typical use for positions 1, 2, 3, 4, 5 and 12 |

`POSITION_INFO` contents:

| Position | Mode | Typical use |
|---|---|---|
| 1st | Ionian | major, folk |
| 2nd | Mixolydian | blues, rock, country |
| 3rd | Dorian | minor blues |
| 4th | Aeolian | natural minor |
| 5th | Phrygian | — |
| 12th | Lydian | — |

**UI:** two panels.
- **"I have a song in…":** pick a tonic (12 pitch classes, in key spelling) and a style (Major/folk → 1st, Blues/rock → 2nd, Minor → 3rd, Natural minor → 4th, or "show all"). It shows the recommended harp key(s) and a table of every listed position with its harp and mode.
- **"I have a … harp":** starts at the header's current key. It shows what each position plays, e.g. "C harp: 1st C major · 2nd G blues · 3rd D minor · 4th A minor · 5th E Phrygian · 12th F Lydian".

**Tests:** core round-trips for all 12 keys × 6 positions (`harpForPosition(positionTonicPc(k, p), p) === k`); known facts (a G blues song → C harp; an A minor song in 3rd → G harp); a render test.

## 3. Hole finder (feature 1)

Route `/hole-finder`. A game.

**How it plays:**
- The page shows a note name with octave (e.g. "A4") taken from the note pool (`PoolFilterPanel`, default holes 1–10, plain notes).
- The site plays **no** sound; that's the point, you find the note yourself.
- You play it anywhere on the harp (any hole or technique producing that exact pitch), matched by `ListenRound` with the global matcher settings.

**Modes:**
- **Practice:** untimed, with a "👀 Show me" button in the stage controls that reveals the holes (the Echo reveal text via `describeNote`, plus chart highlight) and a "Skip" button.
- **Scored:** 10 rounds, 8 s per note, the Echo points formula, and the best score saved under `hole-finder`.

**Layout and reuse:** it uses `Stage`. The headline is the note name, in large type through the headline slot. It reuses `echoRoundConfig`-style configuration (with help disabled), the `pickTarget`-style no-immediate-repeat selection and `echoPoints`, factored as shared helpers if needed.

**Tests:** hit, timeout, reveal, no immediate repeat, and layout stability (the same `layoutShape` pattern as the other games).

## 4. Note-name quiz (feature 11)

Route `/quiz`. A game that never uses the mic.

**Two tasks** (`ModeToggle`-style "Task" group), both drawn from the pool filter:
- **Name the note:** a chart box is highlighted `target`, and you pick its note name from 12 buttons (pitch class in key spelling; no octave asked).
- **Find the hole:** a note name with octave is shown, and you click a matching chart box. Any box with that exact pitch is correct. This task makes the chart interactive, as `onNoteDown` already allows.

**Modes:**
- **Practice:** untimed. A wrong answer shows the right one and the next round starts after 1.5 s.
- **Scored:** 10 rounds with a 10 s speed bonus. Wrong = 0 points, right = `roundPoints(1, speedBonus(t, 10000))`. The best score is saved under `quiz` with the task in the key.

**Other rules:** clicking the chart never plays sound in this game. The answer grid is always rendered, and disabled between rounds.

**Tests:** both tasks, scoring, answer grid disabled outside answering, enharmonic spelling per key.

## 5. Practice log (feature 12)

Route `/log`. Storage is `localStorage` key `harp-tools:log`, always read and written through storage-tolerant functions in `src/ui/log/practiceLog.ts`. Aggregation lives in `src/core/log/`.

**Data kept:**
- **Per day** (local date `YYYY-MM-DD`): seconds practised per page id.
- **Per finished scored session:** date, game id, score, max score. The last 200 are kept.

**Recording:**
- `usePracticeTimer(pageId)` counts time only while the page is visible **and** audio is unlocked (so time just sitting on the page doesn't count). It flushes every 15 s and on page hide or unmount.
- It is used by every tool and game page. The positions page and the quiz count visible time, since they don't use audio.
- `useScoring` appends a session entry when a scored session finishes.

**Page shows:**
- current streak (consecutive days, ending today or yesterday, with ≥ 60 s practised) and longest streak;
- total time today, this week and in all;
- a 14-day bar chart (inline SVG, bars per day with minutes labelled; follows the existing CSS tokens and works in dark theme);
- time per page this week;
- recent scored sessions (last 10);
- a "Clear log" button with a confirm step.

**Tests:** streak and aggregation in core (including crossing midnight, gaps and the yesterday rule), storage tolerance, the timer hook with fake timers and visibility events, the scoring hook appending entries, page render.

## 6. Better reference sound (feature 4)

Recordings aren't available, so the synth gets a more reed-like **Reed** voice and the current one becomes **Pure**.

**Reed voice** (still behind `NotePlayer`, so a future `SampleNotePlayer` can replace it):
- additive partials: 1, 2, 3, 4, 5 at amplitudes 1, 0.55, 0.35, 0.2, 0.12, through a gentle low-pass at ~5 × f₀;
- a short breath-noise burst at onset (band-passed noise around 2 kHz, 60 ms decay);
- a slightly slower attack (35 ms);
- no vibrato.

**Setting:** `Settings.sound: 'reed' | 'pure'` (default `'reed'`), toggled in the tuner's Play toolbar and in the games' "Note matching" settings panel.

**Pitch accuracy:** the fundamental must stay exact, because pitch detection of the prompt is gated and irrelevant but players tune by ear. A test with an `OfflineAudioContext` render is impossible in jsdom, so a unit test checks the oscillator frequencies set on a fake context.

## 7. Harp health check (feature 5)

Route `/health`. A tool; it uses `usePitch`.

**Guided check:**
- It steps through the 20 unbent reeds of the selected harp and tuning: hole 1 blow, hole 1 draw … hole 10 draw.
- For each reed it shows "Play hole N blow (X)" and waits for a steady reading. A reed counts as measured after 1 s of continuous readings within ±60 cents of the target. It records the **median cents** of that second and moves on.
- Controls: Skip reed, Redo reed, Restart.

**Results:**
- a 10-column table in the chart's layout: blow row above, draw row below, each cell showing ±cents, coloured with the tuner's in-tune/close/off thresholds (±10 / ±25);
- an overall summary: the most out-of-tune reeds, and the average offset (a large average suggests the harp is tuned to 442 or 443 Hz; if so, it suggests the matching A4 setting);
- a note that ±5–10 cents is normal, and that many harps use compromise tuning where the 3rd and 5th reeds are deliberately a little off.

**Saving:** the last result per key + tuning is kept in `localStorage` (`harp-tools:health`) and shown as "Previous check" deltas.

**Tests:** core median/steady-window logic with fake readings (steady, drifting, too far off, silence), result summary and A4 suggestion, storage tolerance, page flow with a mocked `usePitch`.

## 8. Tone & breath meter (feature 7)

Route `/tone`. A tool; it uses `usePitch`.

**Chart:** a live, rolling 6-second SVG chart with two lines:
- pitch: cents from the nearest note, range ±50;
- level: dB, range −60 to 0.

It's drawn at 30 fps from a ring buffer.

**Stats panel** (fixed layout), computed over the current held note: a run of pitched readings on the same nearest MIDI, reset on silence of more than 150 ms or a change of note.

| Stat | How it's computed |
|---|---|
| Note name + tab | — |
| Hold time | — |
| Pitch steadiness | σ of cents |
| Average level | mean dB |
| Level steadiness | σ of dB |
| Vibrato | only once the note has been held ≥ 1 s: rate in Hz and depth in cents peak-to-peak, estimated from zero-crossings of the detrended cents series over the last 2 s. "None" if depth < 8 cents or rate is outside 3–9 Hz. |

**Core:** `src/core/tone/analysis.ts` with `analyzeHold(samples)` returning the stats. Samples are `{ tMs, cents, midi, db }`.

**Tests:** synthetic sample series (steady, with 5 Hz ± 20 cent vibrato, with a level swell, with a break) → expected stats.

## 9. Rhythm trainer (feature 10)

Route `/rhythm`. A game; it uses `useGameAudio` and the metronome.

**Patterns**, each one bar of 4/4 as onsets in beats:

| Pattern | Onsets |
|---|---|
| Quarters | 0 1 2 3 |
| Eighths | 0 0.5 1 … 3.5 |
| Shuffle | 0 0.67 1 1.67 … |
| Offbeats | 0.5 1.5 2.5 3.5 |
| Charleston | 0 1.5 |
| Train | 0 0.5 1 1.5 2 2.5 3 3.5, with accents shown on 0 and 2 |

**How it plays:**
- You play **any** note (pitch doesn't matter) on each onset.
- An onset is detected when a pitched reading follows ≥ 80 ms without one (silence or noise), or when the nearest MIDI changes. It's timestamped at the first pitched reading, minus the 60 ms detection latency.
- Onsets are matched to the nearest expected hit within ±250 ms. Expected hits are computed from the metronome's beat times, using the same clock basis as the scale runner's `lastBeatMs`.
- Grades: Perfect ≤ 40 ms, Good ≤ 100 ms, Off ≤ 250 ms (the early/late sign is shown), and Miss if nothing arrives.

**Modes:**
- **Practice:** continuous, showing the last 8 hits and the running average offset ("you're 30 ms late on average").
- **Scored:** one count-in bar, then 8 bars. Points per hit: Perfect 100, Good 70, Off 30, Miss 0. The best score is saved per pattern and BPM rounded to the nearest 10.

**Important:** metronome clicks are **not** heard as notes. They're percussive, low-clarity sounds that `analyzeFrame` gates out as unpitched. This must be verified in the manual pass. If needed, the fix is a feedback gate for 30 ms around each click, applied through `useGameAudio`.

**Tests:** onset detection core with synthetic readings; matching and grading with fake beat times; pattern definitions; scoring.

## 10. Tab reader (feature 2)

Route `/tab-reader`. A game.

**Tab format**, parsed by `src/core/tab/parseTab.ts`: tokens separated by spaces.

| Token | Meaning |
|---|---|
| `4` `-4` `-3'` `-3''` `6o` `7od` | a note (existing tab notation) |
| `_` | a rest |
| `4:2` or `-4:0.5` | an optional duration in beats (default 1) |
| `\|` | a bar line (ignored for timing, shown in the lane) |

- Invalid tokens are reported with their position.
- Tab is key-relative, so every song works on every key, and it's resolved against the current tuning; a token that doesn't exist in that tuning is an error.

**Songs:** a built-in library in `src/core/tab/songs.ts`, all public domain, written for 1st position:
- Mary Had a Little Lamb
- Twinkle Twinkle Little Star
- Ode to Joy
- Oh! Susanna
- When the Saints Go Marching In
- Amazing Grace (3/4, written as beats)
- Red River Valley
- Happy Birthday — excluded; its copyright status is ambiguous in some countries. Swing Low, Sweet Chariot takes its place.

Plus a "Your tab" textarea, with the text kept in `localStorage`.

**UI:**
- a horizontal lane that scrolls at the metronome BPM with a fixed playhead, one bar of count-in, notes drawn as boxes sized by duration and labelled with tab;
- the chart highlights the upcoming note as `target`.

**Modes:**
- **Practice:** a "Wait for me" toggle, on by default. The lane pauses at each note until it's matched (hold 250 ms), so it's pitch-only.
- **Scored:** continuous at tempo. A note counts as hit if the right pitch is held ≥ min(250 ms, 60 % of its duration), starting within ±150 ms of its onset (after latency). Points per note: 100 × onset-timing factor (1 within ±50 ms, falling linearly to 0.5 at ±150 ms). The session is the whole song. The best score is saved per song.

**Tests:** parser (valid, durations, rests, bars, errors, tuning resolution), song library parses on every tuning or is flagged, timeline/beat maths, hit judging with fake readings, page flow.

## 11. Lick trainer (feature 9)

Route `/licks`. A game.

**Library:** 16 original short licks in `src/core/tab/licks.ts`, each written in the §10 tab format with durations, and each with a name, style and position.
- **2nd-position blues (10):** straight blues phrases around holes 2–6 using `-2` `-3'` `-3` `4` `-4'` `-4` `5` `-5` `6`, including turnaround-style endings and one 1-step bend lick.
- **1st-position folk (3):** simple melodic runs in holes 4–7.
- **3rd-position minor (3):** runs around `-4` `-5` `-6` `6`.

Licks are written by us: short generic scale fragments, not transcriptions of recordings.

**How it plays:** the site plays the lick at the chosen BPM (synth, durations respected), then you echo it. Pitch order is matched with the existing `MelodyRound` rules (250 ms hold, stray-note detection). Rhythm isn't scored.

**Modes:**
- **Practice:** pick a lick or random; Hear again, Show tab (reveals the tab under the lick slots), Try again.
- **Scored:** 10 random licks from the chosen style, melody points formula.

The lick slots row reuses the Melody phrase-slot component.

**Tests:** library parses on Richter for every key (or is flagged as unplayable in other tunings), round flow, reveal, layout stability.

## 12. Blues play-along (feature 8)

Route `/jam`.

**Backing track:** generated live with Web Audio. A new `src/audio/backing/` holds the synth voices plus a look-ahead `BackingScheduler`, reusing the metronome's pattern.

**Key:** the 2nd-position key of the selected harp (C harp → G blues), with an option for 1st or 3rd position.

**Form:** 12-bar blues I–IV–V with a quick-change option (bar 2 IV) and a turnaround in bars 11–12 (I–V).

**Tempo:** the shared BPM setting, 60–160.

**Feel:** Shuffle (default; swung eighths at 2:1) or Straight.

**Instruments, all synthesised:**

| Instrument | Pattern | Sound |
|---|---|---|
| Kick | beats 1 and 3 | sine drop 120 → 50 Hz |
| Snare | beats 2 and 4 | noise with a 180 Hz body |
| Closed hi-hat | on the (swung) eighths | high-passed noise |
| Bass | walking shuffle pattern per chord (root–3rd–5th–6th–♭7th–6th–5th–3rd in eighths, simplified to quarters on straight feel) | triangle + square mix, low-pass 900 Hz |
| Chords | dominant-7th stabs on the offbeats | 3 detuned saws through a low-pass 1.8 kHz, short envelope |

The mixer gives each instrument a volume slider plus mutes.

**Display:**
- the current chord name large (e.g. "C7") with bar x/12 and a 12-box form strip;
- on the chart, the chord tones of the current chord that exist on the harp are highlighted `target`, and the rest of the position's blues scale is shown with a new dim style;
- a small legend: "Chord tones · Blues scale".

**New highlight state.** `HarmonicaDiagram` gains `'hint'`: the technique colour at low opacity, weaker than `target`. It's the only diagram styling change.

**Mic:** optional, off by default ("Show what I play"). When it's on, detected notes are highlighted `detected`, with a notice to use headphones so the mic doesn't pick up the backing track. No scoring; this is free play.

**Tests:** chord progression and the chord-per-bar maths, chord tones per key and position, swing timing maths, scheduler window logic (pure), highlight computation, page render (audio stubbed).

## 13. Cross-cutting

**Shared helpers:**
- `describeNote`, `pickNote`, tab label and parsing are shared.
- **Tab rendering:** a small `TabText` component formats tokens consistently.
- **Phrase/slot rows:** the Melody phrase slots are generalised into a `NoteSlots` component used by Melody, Licks and Tab reader.

**Accessibility:**
- every new control has an accessible name;
- charts have a text alternative (a stats panel or table);
- the log bar chart has a visually hidden table.

**Performance:** the tone meter and tab reader draw with requestAnimationFrame and must not re-render the whole page 60 times a second. Chart layers are updated through refs to SVG elements or a single small component; this is allowed under react-hooks v7 when done in effects or callbacks, not during render.

**Tests:** every core module gets unit tests and every page gets a render/flow test plus a layout-stability test where it has phases.

**Manual checks** (author, real harp and device):
- tuning tables versus real alternate-tuned harps;
- health-check accuracy;
- vibrato detection;
- rhythm latency (confirm the 60 ms figure);
- whether metronome and backing sounds leak into detection;
- how the backing track sounds.

## 14. Out of scope

- Real recorded samples.
- MIDI or audio file import.
- Accounts or cloud sync.
- User-editable licks library (only "Your tab" in the tab reader).
- Tunings beyond the four above.
- Chromatic harmonicas.
