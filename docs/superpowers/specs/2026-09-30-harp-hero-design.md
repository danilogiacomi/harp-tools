# Harp Hero, stage 1: the song run — Design

**Date:** 2026-09-30
**Status:** Approved section by section in chat (tracks and clock, highway, scoring, page and testing).
**Builds on:** `2026-09-26-harmonica-tools-design.md`, `2026-09-27-more-tools-and-games-design.md` and `2026-09-30-pwa-and-mobile-design.md`. Their conventions still apply: the stable-layout rule, `useSpelling()`, no per-frame re-renders on mic pages, and the practice/scored split.

## 0. Goal and scope

**Goal:** a Guitar Hero–style game for the harmonica. A synth band plays an original blues or rock track that never stops for you. Notes fall down one lane per hole onto a strike line above the harp chart. You play them on your harp through the mic, and earn grades, combos, a multiplier and stars. A rock meter can fail you.

**Stages** (each gets its own spec, plan and implementation):
1. **The song run** (this spec): the highway, the band, scoring, and six rated tracks.
2. **Endless mode:** generated riffs that get faster and harder until the rock meter empties.
3. **Career:** tiers of tracks unlocked by stars across sessions. It reads stars from the best scores that stage 1 already saves (§3.6), so stage 1 needs no extra storage for it.

**Done means:**
1. `/hero` plays any of six tracks in any harp key, with the band in 2nd position, and judges every note against the band's clock.
2. The highway's lanes line up with the chart's holes at every width, down to 360 px, and the page never re-renders per frame.
3. In scored mode, an emptied rock meter stops the song and saves nothing. A finished run saves a best score, and stars are shown from it.
4. In practice mode you always finish the song, and a 75% speed option is offered.

**Out of scope:** endless mode, career and unlocks, star power, overblows and overdraws in tracks, a fade when the band stops (already deferred polish), playing your own tab here, and calibration settings.

## 1. Tracks and the song clock

### 1.1 Track format

A new file, `src/core/arcade/tracks.ts`:

```ts
export interface Track {
  id: string            // 'porch-shuffle'
  title: string         // 'Porch Shuffle'
  rating: 1 | 2 | 3 | 4 | 5
  bpm: number
  feel: Feel            // from core/jam/backingSchedule
  choruses: number      // repeats of the 12-bar form
  quickChange: boolean  // passed to bluesForm()
  part: string          // the harp part in the Tab reader's notation (parseTab)
}
export const TRACKS: readonly Track[]
```

- **Key:** parts are written as hole numbers. The band's `tonicPc` is `(harp key + 7) % 12`, which is 2nd position, the same as the blues play-along. So a track plays on every harp key with no extra charting.
- **Tuning:** parts are written for Richter. On another tuning, `parseTab` errors show the existing "This tab can't be played on this harp" notice, and `WrittenForRichter` is shown, as on the Tab reader.
- **Form:** `bluesForm(quickChange)` repeated `choruses` times. The band config is `{ bpm, feel, form, tonicPc }`.
- **Length:** a song is one count-in bar (hi-hat only), then `choruses × 12` bars. A track's part must fill exactly `choruses × 12` bars of 4 beats, which a test checks (§5).

### 1.2 Tempo

- Each track has its own BPM. The global Tempo field isn't shown on this page.
- **Speed** is shown in practice mode only: 100% (the default) or 75%. It scales the band and the chart together.
- Scored mode always plays at 100%.

### 1.3 The clock

The band is the clock.
- `BackingScheduler` gets a read-only `startTime`: the AudioContext time, in seconds, of the first beat it schedules. It's set when the scheduler starts, and `null` when stopped.
- `songZeroMs = startTime × 1000` is in the same time base as `audio.now()` and the mic frames' `timeMs`.
- The first bar is the count-in. Chart time 0 is `songZeroMs + 4 × beatMs(bpm)`.
- Each mic frame is passed to `TabJudge.push(freq, timeMs − chartZeroMs)`. `TabJudge` already corrects for detection latency.
- The highway position on each frame is `(audio.now() − songZeroMs) / beatMs` beats, count-in included.
- The metronome is not used on this page.

**Band during the count-in:**
- `BackingScheduler` plays the count-in bar with hi-hat only. This is a new `countInBars` option in `BackingConfig`, default 0, so the Jam page is unchanged.
- In the schedule, bar numbers from `countInBars` onwards map to the form.

**Stopping:**
- The band stops, via the existing `stop()`, after the last bar of the last chorus.
- It also stops on Stop, on leaving the page (unmount), and on failing (§3.4).

### 1.4 Lifecycle

- **idle** → Start → **running**. Start builds a `TabJudge` from the parsed part and starts the band.
- **running** → last note judged and last bar done → **done**.
- **running** → Stop → **idle**.
- **running** → rock meter 0 in scored mode → **failed**.
- **failed** and **done** show the end panel (§3.7), with Retry or Again.
- The run is keyed, as on the Tab reader, by `mode | track | speed | key | tuning | a4 | tolerance`. A settings change restarts the run but not the mic.

## 2. The highway

### 2.1 Layout

A `Highway` component in `src/ui/pages/hero/Highway.tsx` sits directly above the `HarmonicaDiagram`.

- **Columns:** the same grid as the chart. That's a row-label spacer (`minmax(6rem, auto)`) plus `repeat(10, minmax(2.75rem, 1fr))`. In the chart's compact mode (`@container (max-width: 34rem)`) it's `repeat(10, minmax(0, 1fr))`. The highway sits in the same container context, so lane *n* is always above hole *n*.
- **Window:** a fixed height of 18rem, or 12rem in compact mode, with `overflow: hidden`. The strike line is at the bottom edge, touching the chart. The window's size never changes during a song.
- **Bar lines:** faint horizontal rules across all lanes. The first bar of each 12-bar chorus gets a stronger rule. The count-in bar is labelled "count-in".

### 2.2 Motion

- All notes are laid out once, at the start, in one tall `track` element. A note's bottom edge is `beatsFromStart × PX_PER_BEAT` above the track's origin, and its height is `beats × PX_PER_BEAT − 4px`.
- `PX_PER_BEAT = 48`. This is per beat, not per second, so faster tracks scroll faster. About 3–4 bars are visible.
- `useAnimationFrame` sets `track.style.transform = translateY(position × PX_PER_BEAT px)` through a ref. React re-renders only when a note is judged or the phase changes.

### 2.3 Notes

- The lane is the note's `hole`, and `data-color` is its `technique`. These are the chart's colour tokens.
- **Blow** notes are hollow: a coloured border on the surface colour. **Draw** notes are solid. Shape tells them apart as well as colour.
- Each note shows its tab with `TabText` (`-3'`, `4`, `-2''`), fitted to the lane. In compact mode, if the lane is too narrow for the label, only the bend marks (`'`) are shown.
- `data-state` is one of `todo`, `perfect`, `good` or `miss`:
  - A hit flashes then fades.
  - A miss turns grey and keeps falling.
  - No state change affects layout.

### 2.4 Around the highway

- **Grade word:** "Perfect", "Good" or "Miss" in a fixed-size slot just above the strike line, shown for 600 ms.
- **Chart highlights:** the harp chart below keeps the usual highlights: `target` for the next note and `detected` for the pitch heard.
- **Accessibility:** the highway is `aria-hidden`. A visually hidden `aria-live="polite"` region announces "Next: -4 (D5)" and the last grade. Note names come from `useSpelling()`.

## 3. Scoring

Pure functions in `src/core/arcade/arcadeScore.ts`, with no React or audio.

### 3.1 Grades

Grades come from `TabJudge`'s `JudgedNote`.

| Grade | Rule | Base points |
|---|---|---|
| Perfect | `hit` and `|offsetMs| ≤ FULL_TIMING_MS` (50) | 100 |
| Good | `hit` and 50 < `|offsetMs|` ≤ 150 | `tabNotePoints(offsetMs)` (50–99) |
| Miss | `!hit` | 0 |

### 3.2 Combo and multiplier

- A hit adds 1 to the combo, and a miss sets it to 0.
- `multiplier(combo)` is based on the combo before this note: 0–9 → ×1, 10–19 → ×2, 20–29 → ×3, 30+ → ×4.
- A note scores base × multiplier.
- `maxScore(noteCount)` is the score of an all-Perfect run: `Σ 100 × multiplier(i)` for `i = 0 … noteCount − 1`.

### 3.3 Rock meter

- The meter runs from 0 to 100 and starts at 50.
- A Perfect adds 3, a Good adds 2 and a Miss subtracts 8. It's clamped to 0–100.
- **Display:** a fixed-width bar, red below 25, yellow below 50, green otherwise, with a text label ("Rock meter: 62%").

### 3.4 Failing

- **Scored mode:** a miss that brings the meter to 0 fails the song.
  - The band stops, the highway freezes, and the page shows "Song failed at bar *b* of *n*" with Retry.
  - A failed run saves no best and writes no practice-log session. The practice timer still counts the time.
- **Practice mode:** the meter stops at 0 and never fails the song.

### 3.5 Stars

`stars(score, max)`:
- ★ for finishing;
- ★★ at 40% of max;
- ★★★ at 60%;
- ★★★★ at 80%;
- ★★★★★ at 95%.

### 3.6 Saving

- There's a new `GameId`, `'harp-hero'`.
- The best key is `bestScoreKey('harp-hero', { track: track.id, ...tuningPart(tuning) })`.
- Only a finished scored run can save a best. Scored mode is always 100% speed.
- **Stars are never stored.** The track picker and the end panel compute them as `stars(best, maxScore(noteCount))`. Stage 3 reads them the same way.
- **`useScoring`** is used with `totalRounds = noteCount` and `roundMax = 400`. It gains an optional `maxOverride`, which is used for the practice-log `max`, so the log records `maxScore(noteCount)` instead of `noteCount × 400`. Existing callers are unchanged.

### 3.7 End panel

```
Porch Shuffle  ★★★★☆   Score 41,300   New best!
Perfect 58 · Good 17 · Miss 5 · Longest streak 34
```

- It shows the counts per grade and the longest combo. In practice mode it shows the same line with no best.
- The primary button comes first: Again, or Retry after a failed song.

## 4. The page

### 4.1 Route and registration

- `/hero` → `HarpHeroPage` in `src/ui/pages/hero/`. It's listed under Games in `homeGroups.ts`, with a 🎸-style emoji distinct from the Lick trainer's, and in the practice log's page names.
- `usePracticeTimer('harp-hero')`.

### 4.2 Layout, top to bottom

1. **Toolbar:** Practice/Scored `ModeToggle`; the Track select (`Porch Shuffle · ●○○○○ · ★★★☆☆`, where stars come from your best score and show ☆☆☆☆☆ if you have none); Speed (practice only).
2. `WrittenForRichter`, parse-error notice, and `MicErrorNotice`.
3. **Headphones hint:** "Headphones help: the band's chords can sound like harp notes to the mic."
4. **Score row**, at a fixed height: score · ×multiplier · combo · rock meter. Below 30rem it wraps onto two fixed rows.
5. The grade slot and the highway.
6. The `HarmonicaDiagram`.
7. Start / Stop / Again controls.

### 4.3 Phones

- The highway uses the chart's compact 10-column grid and is 12rem tall below 34rem.
- The screen stays awake through `BackingScheduler`'s existing wake lock.

### 4.4 The tracks

All are Richter, 2nd position, 4 beats per bar.

| # | id | Title | Rating | Feel | BPM | Choruses | Quick change | Part |
|---|---|---|---|---|---|---|---|---|
| 1 | porch-shuffle | Porch Shuffle | 1 | shuffle | 80 | 2 | no | holes 4–6, long notes (2–4 beats), no bends |
| 2 | three-chord-train | Three Chord Train | 1 | straight | 92 | 2 | no | the I/IV/V riff on -4 4 -5 5 -6, quarter notes |
| 3 | low-down | Low Down | 2 | shuffle | 76 | 2 | no | -2 -3 -4 draws and blow/draw changes in holes 1–4 |
| 4 | bent-out-of-shape | Bent Out of Shape | 3 | shuffle | 70 | 2 | no | half-step `-4'` and `-3'` bends on a slow blues |
| 5 | second-gear | Second Gear | 4 | straight | 108 | 3 | yes | `-3''` and `-2'` bends, eighth-note runs |
| 6 | overdrive | Overdrive | 5 | shuffle | 120 | 3 | yes | `-2''`, `-3'''`, fast runs across holes 1–6 |

**Technique limits by rating** (checked by test):
- Ratings 1–2: blow and draw only.
- Rating 3: plus half-step draw bends.
- Ratings 4–5: any draw bend.
- No track uses blow bends, overblows or overdraws in stage 1.

Each part follows the chords: bars on IV and V land on that chord's tones on the harp.

## 5. Testing

TDD, as in earlier plans.

- **`arcadeScore`:**
  - grade edges at 50/51 and 150/151 ms;
  - multiplier steps at combo 9/10, 19/20 and 29/30;
  - a miss resetting the combo;
  - the meter clamped at 0 and 100;
  - failing only in scored mode;
  - star thresholds at 39.9/40, 60, 80 and 95%;
  - `maxScore` for 0, 9, 10 and 35 notes.
- **Tracks** (one test per track):
  - the part parses with no errors on Richter in all 12 keys;
  - it fills exactly `choruses × 12` bars;
  - it uses only the techniques its rating allows;
  - ids are unique and ratings are in 1–5.
- **Backing:**
  - `startTime` equals the first beat's time, and is `null` after `stop()`;
  - `countInBars: 1` schedules hi-hat only in bar 0, and the form starts at bar 1;
  - the Jam page's config (with no `countInBars`) behaves as before.
- **`Highway` render:**
  - 10 lanes;
  - each note in its hole's lane, with its technique colour and a height matching its beats;
  - `data-state` updating when a note is judged.
- **Page** (fake audio and a fake scheduler):
  - Start starts the band;
  - pitches pushed at the right times give Perfect, Good and Miss;
  - the combo and multiplier are shown;
  - an emptied meter in scored mode stops the band and saves nothing;
  - a finished scored run saves the best and shows stars;
  - Speed is shown in practice only;
  - a parse error on a non-Richter tuning shows the notice;
  - unmounting stops the band.
- **`useScoring`:** `maxOverride` reaches the practice log, and callers without it are unchanged.
- **Checks on a real harp** (by the user, after merge):
  - timing feels right at 70 and 120 BPM, with speakers and with headphones;
  - `-3''` and `-3'''` on Overdrive register as hits;
  - band bleed-through on holes 1–4 with speakers;
  - the highway is readable on a phone in portrait.

## 6. Error handling

- **Mic denied or missing:** `MicErrorNotice`, and Start is hidden, as on other mic pages.
- **Track can't be played on this tuning:** the parse-error notice, and no Start.
- **Audio context suspended** (iOS): Start resumes it through the existing `AudioEngine` path before starting the band.
- **Tab hidden mid-song:** the band keeps its audio-clock schedule and the judge keeps judging. Notes missed while the tab was hidden count as misses. The page doesn't pause.
