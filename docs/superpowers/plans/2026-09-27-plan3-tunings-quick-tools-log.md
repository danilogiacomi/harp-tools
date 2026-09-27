# Tunings, Quick Tools, Quizzes and Practice Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alternate tunings across the whole site, a Positions & keys tool, the Hole finder and Note quiz games, a local practice log with streaks and a 14-day chart, and a more reed-like reference sound.

**Architecture:** The harp model becomes tuning-aware (`buildHarp(key, tuning)` over a `TUNINGS` table in `src/core/harmonica/tunings.ts`), and a one-line `useHarp()` hook gives every page the harp for the header's key and tuning. The practice log is split three ways: pure date/aggregation logic in `src/core/log/`, storage-tolerant read/write functions in `src/ui/log/practiceLog.ts`, and a `usePracticeTimer` hook that counts visible (and, by default, audio-unlocked) time and flushes it every 15 s. The new games reuse the existing `Stage` / `ScorePanel` / `PlayAgain` / `ModeToggle` / `PoolFilterPanel` / `GameLayout` components, `ListenRound`, `pickTarget` and `echoPoints`; the Reed voice lives behind the existing `NotePlayer` interface.

**Tech Stack:** Vite, React 19, TypeScript (strict), Vitest + jsdom + React Testing Library, ESLint (typescript-eslint, react-hooks v7), Prettier. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-27-more-tools-and-games-design.md` (binding) — this plan implements §1, §2, §3, §4, §5, §6 and the Home/header parts of §0. Conventions come from `docs/superpowers/specs/2026-09-26-harmonica-tools-design.md`.

**Scope:** This is **Plan 3**. Plan 4 (audio-heavy tools and games, §7–§12) is written in parallel and depends on these exact interfaces, which must not change:
- `buildHarp(key: HarpKey, tuning: TuningId = 'richter')`
- `type TuningId = 'richter' | 'paddy' | 'country' | 'naturalMinor'`, `TUNINGS`
- `Settings.tuning: TuningId` and `Settings.sound: 'reed' | 'pure'`
- `usePracticeTimer(pageId: string, opts?: { requireAudio?: boolean })` in `src/ui/hooks/usePracticeTimer.ts`
- `appendSession()` in `src/ui/log/practiceLog.ts`, called from `useScoring` when a scored session finishes
- the Home page as a data-driven list of groups (`HOME_GROUPS` in `src/ui/pages/homeGroups.ts`: Tools / Games / Jam / Progress) that Plan 4 appends entries to

**Decisions this plan makes where the spec is open** (each is repeated in the task that implements it):

1. **`useHarp()`** (`src/ui/hooks/useHarp.ts`) is the one place pages build the harp: `buildHarp(settings.key, settings.tuning)`, memoised. Every game's run key gains `settings.tuning`, so switching tuning mid-round restarts the round.
2. **Best-score keys** get tuning through `tuningPart(tuning)`, which returns `{}` for Richter and `{ tuning }` otherwise, so every existing Richter key is byte-for-byte unchanged.
3. **Tuning selector:** a second `<select aria-label="Tuning">` right after the key selector, joined by a "·", so the header reads "C harp · Richter".
4. **Positions page:** the song-key picker uses key-name spelling (C, Db, D, Eb, E, F, F#, G, Ab, A, Bb, B — the same names as `HARP_KEYS`). The "I have a … harp" panel spells each tonic with that harp's `keySpelling`, e.g. "A harp: … 5th C# Phrygian". It defaults to the song **G, Blues / rock** (→ C harp). With "Show all" the recommendation line lists the 1st, 2nd and 3rd position harps. The harp picker on that page starts at the header key and follows it when the header changes, but picking a harp there doesn't change the header.
5. **Hole finder:** practice "Skip" moves straight to a different note and records nothing. The reveal text stays visible on the result line. The idle headline is empty, as in Echo.
6. **Note quiz:** there's no timeout. The speed bonus falls from ×2 to ×1 over 10 s and then stays at ×1, like the interval game's "Name it". Both right and wrong answers move on after 1.5 s. The chart always shows **tab labels** in the quiz and in the hole finder, because note-name labels would give away the answer (the cells' accessible names still include the note).
7. **Practice log week** means the calendar week starting on **Monday**, up to today.
8. **Timer:** `requireAudio` defaults to `true`. Time is kept in spans of at most **30 s**, so a laptop that sleeps with the page open doesn't log hours. `AudioEngine.unlock()` now notifies its listeners, so the timer notices a context that starts out already running.
9. **Session game id** is the first `|` segment of the best-score key (`echo|key=C|…` → `echo`), so `useScoring`'s signature doesn't change. Every finished scored session is logged, including one that scored 0.
10. **Page names in the log** come from `HOME_GROUPS` titles (an unknown id shows as the id itself), so Plan 4's pages are named as soon as it adds their Home entries. The log page doesn't count its own time.
11. **Home groups** with no entries aren't rendered (Jam stays hidden until Plan 4 adds the play-along).
12. **Sound setting UI:** a "Reference sound" Reed / Pure segmented group (`SoundToggle`), used in the tuner's Play toolbar and in the games' "Note matching" panel.

## Global Constraints

- Fully static build; **hash-based routing** (`/#/positions`, `/#/hole-finder`, `/#/quiz`, `/#/log`); Vite `base: './'`. No backend, no accounts.
- **Vite + React 19 + TypeScript strict mode**. No UI component library, no global store library, no router library, **no new npm dependencies**.
- **English-only UI.** No i18n layer.
- **Persistence: `localStorage` only**, always through functions that tolerate missing, corrupt or throwing storage. New keys: `harp-tools:log`. Existing: `harp-tools:settings`, `harp-tools:best-scores`.
- `src/core/` never imports browser APIs or React and never calls `Date.now()`, `performance.now()`, `Math.random()` or `setTimeout`; time and randomness are passed in. (`new Date(ms)` on a passed-in timestamp is allowed for local-date maths.) `src/audio/` never imports React.
- **Tunings** (C harp, holes 1–10): Richter blow C4 E4 G4 C5 E5 G5 C6 E6 G6 C7 / draw D4 G4 B4 D5 F5 A5 B5 D6 F6 A6; Paddy: hole 3 blow **A4**; Country: hole 5 draw **F#5**; Natural minor: blow C4 **Eb4** G4 C5 **Eb5** G5 C6 **Eb6** G6 C7 / draw D4 G4 **Bb4** D5 F5 **Ab5** **Bb5** D6 F6 **Ab6**.
- **Derived notes:** bends on the higher reed, one per semitone of gap minus one; the over-note one semitone above the higher reed (overblow if draw is higher, overdraw if blow is higher); **equal reeds: no bends, no over-note**. Over-notes are `common` on holes 1, 4, 5, 6 (overblow) and 7, 9, 10 (overdraw); every bend is `common`.
- `Settings.tuning` default `'richter'`; `Settings.sound` default `'reed'`; both sanitised.
- **Hole finder:** the site plays **no** sound; scored = 10 rounds, **8 s** per note, Echo points formula; best under `hole-finder`.
- **Note quiz:** never uses the mic; clicking the chart never plays sound; scored = 10 rounds, wrong = 0, right = `roundPoints(1, speedBonus(t, 10000))`; practice advances **1.5 s** after an answer; best under `quiz` with the task in the key; the answer grid is always rendered and disabled outside answering.
- **Practice log:** per local day (`YYYY-MM-DD`) seconds per page id; the last **200** scored sessions; streak = consecutive days with **≥ 60 s**, ending today or yesterday; timer flushes every **15 s** and on hide/unmount.
- **Reed voice:** partials 1–5 at 1, 0.55, 0.35, 0.2, 0.12; low-pass ≈ 5 × f₀; breath noise band-passed around 2 kHz with a 60 ms decay; **35 ms** attack; no vibrato; the fundamental is exact.
- **Stable layout:** every area that can appear during a session is always rendered; each new page gets a layout-stability test (`layoutShape` from `src/test/layout.ts`).
- Games hear the mic only through `useGameAudio`; tools only through `usePitch`.
- Tests are colocated as `*.test.ts(x)` next to the source file.
- Code style: Prettier with `semi: false`, `singleQuote: true`, `printWidth: 100`.
- React code must pass `eslint-plugin-react-hooks` v7: no `ref.current` reads during render, no `Date.now()` / `performance.now()` / `Math.random()` calls during render, no synchronous `setState` in effect bodies. Mutable objects live in `useState`-held instances and are only touched from handlers, effects and callbacks.

## Review Focus

1. **Changing the tuning (or key) in the header mid-round** → the round stops, the chart redraws for the new tuning and nothing is scored against the old harp. Pinned by the Echo test added in Task 3 ("follows the tuning and abandons the round when it changes").
2. **Corrupt, hand-edited, blocked or full `localStorage` for the log** (bad JSON, an array, negative or string seconds, malformed dates, `setItem` throwing) → the log reads as empty or partially repaired, timers and scoring keep working, and the log page renders. Pinned by the `sanitizeLog` tests in Task 5 and the storage tests in Task 6.
3. **Time that isn't practice**: a hidden tab, audio still locked behind "Tap to start", a laptop asleep with the page open, a session running past midnight → hidden or locked time isn't counted, a sleeping gap counts at most 30 s, and time after midnight goes to the new day. Pinned by the `ActiveClock` and `secondsByDay` tests (Tasks 5–6) and the `usePracticeTimer` tests (Task 6).
4. **A second answer to the same quiz round** (a double-click, clicking the chart after answering or before Start, clicking the chart in "Name the note") → only the first answer in the answer phase counts, and the round counter moves by one. Pinned by the quiz page tests in Task 13.
5. **Filters that leave no notes** (hole finder or quiz with "Blow / draw" unticked) → an alert and no Start button; nothing throws. Pinned by the hole finder test (Task 11) and the quiz test (Task 13).

---

## File Structure

```
src/
  core/
    harmonica/tunings.ts        (new) TuningId, Tuning, TUNINGS, TUNING_IDS, tuningById
    harmonica/harp.ts           (modify) harpFromReeds, buildHarp(key, tuning = 'richter')
    harmonica/keys.ts           (modify) keyForPitchClass
    harmonica/positions.ts      (modify) positionTonicPc, harpForPosition, POSITION_INFO, positionLabel
    music/noteNames.ts          (modify) pitchClassName
    games/holeFinder.ts         (new) holeFinderRoundConfig
    games/noteQuiz.ts           (new) QUIZ_BONUS_MS, PITCH_CLASSES, pickQuizNote, isRightName,
                                      isRightHole, quizPoints
    log/dates.ts                (new) localDate, addDays, weekStart, secondsByDay
    log/logModel.ts             (new) PracticeLog, SessionEntry, MAX_SESSIONS, emptyLog,
                                      sanitizeLog, addPractice, addSession
    log/stats.ts                (new) STREAK_MIN_SECONDS, dayTotal, streaks, totals, dailySeconds,
                                      pageSecondsThisWeek, recentSessions, formatDuration
    log/activeClock.ts          (new) Span, MAX_SPAN_MS, ActiveClock
  audio/
    NotePlayer.ts               (modify) SoundVoice, SOUND_VOICES
    voices.ts                   (new) REED_PARTIALS, REED_LOWPASS_MULTIPLE, attacks, BREATH,
                                      reedFrequencies
    SynthNotePlayer.ts          (modify) Reed and Pure voices, setSound
    AudioEngine.ts              (modify) unlock() notifies listeners
  ui/
    settings/settings.ts        (modify) tuning, sound
    scores/bestScores.ts        (modify) GameId + 'hole-finder' | 'quiz', tuningPart
    log/practiceLog.ts          (new) LOG_KEY, loadLog, saveLog, recordPractice, appendSession,
                                      clearLog
    hooks/useHarp.ts            (new) the harp for the header key + tuning
    hooks/usePracticeTimer.ts   (new) FLUSH_MS, usePracticeTimer
    hooks/useScoring.ts         (modify) appends a log session when a scored session ends
    hooks/useNotePlayer.ts      (modify) follows Settings.sound
    components/TuningSelector.tsx (new)
    components/SoundToggle.tsx  (new)
    components/Header.tsx       (+ .module.css) (modify) tuning selector, "Log" nav link
    components/game/MatchSettings.tsx (modify) SoundToggle
    components/game/Game.module.css   (modify) .bigNote, .noteAnswers
    pages/homeGroups.ts         (new) HomeEntry, HomeGroup, HOME_GROUPS, pageTitle
    pages/HomePage.tsx          (modify) renders HOME_GROUPS
    pages/positions/PositionsPage.tsx (+ .module.css) (new)
    pages/holeFinder/HoleFinderPage.tsx (new)
    pages/quiz/NoteQuizPage.tsx (new)
    pages/log/PracticeLogPage.tsx (+ .module.css) (new)
    pages/log/DayChart.tsx      (new) 14-day SVG bars + visually hidden table
    pages/tuner/TunerPage.tsx, pages/metronome/MetronomePage.tsx,
    pages/echo/…, pages/bend/…, pages/scales/…, pages/intervals/…, pages/melody/…
                                (modify) useHarp, tuning in run/best keys, usePracticeTimer
    App.tsx                     (modify) four new routes
    theme.css                   (modify) .visually-hidden
README.md                       (modify) features and roadmap
```

---
### Task 1: Tuning tables and a tuning-aware harp model

**Files:**
- Create: `src/core/harmonica/tunings.ts`
- Modify: `src/core/harmonica/harp.ts` (replace the `C_BLOW`/`C_DRAW` constants and `buildHarp`)
- Test: `src/core/harmonica/tunings.test.ts`, `src/core/harmonica/harp.test.ts` (append)

**Interfaces:**
- Consumes: `keyOffset(key: HarpKey): number` (keys.ts), `diagramLayout` (layout.ts, test only)
- Produces:
  - `type TuningId = 'richter' | 'paddy' | 'country' | 'naturalMinor'`
  - `interface Tuning { readonly id: TuningId; readonly name: string; readonly description: string; readonly blow: readonly number[]; readonly draw: readonly number[] }` — `blow`/`draw` are holes 1–10 as MIDI for a harp labelled C
  - `TUNINGS: readonly Tuning[]` (order: richter, paddy, country, naturalMinor)
  - `TUNING_IDS: readonly TuningId[]`
  - `tuningById(id: TuningId): Tuning`
  - `harpFromReeds(blow: readonly number[], draw: readonly number[], offset: number): HarpNote[]`
  - `buildHarp(key: HarpKey, tuning: TuningId = 'richter'): HarpNote[]`

Spec §1. The derivation rules stay exactly as today, applied per hole to whichever reed is higher, plus the new equal-reed rule (no bends, no over-note). The common-flag holes (1, 4, 5, 6 overblow; 7, 9, 10 overdraw) are the ones Richter already uses, so one rule serves all four tunings. The spec's Country note says "(major 3rd in 2nd position)"; F# is actually the major **7th** in 2nd position (G), so the description below says what the reed does instead.

- [ ] **Step 1: Write the failing tests**

`src/core/harmonica/tunings.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { TUNINGS, TUNING_IDS, tuningById } from './tunings'

describe('TUNINGS', () => {
  it('lists the four tunings in order, with names and descriptions', () => {
    expect(TUNING_IDS).toEqual(['richter', 'paddy', 'country', 'naturalMinor'])
    expect(TUNINGS.map((t) => t.name)).toEqual([
      'Richter',
      'Paddy Richter',
      'Country',
      'Natural minor',
    ])
    for (const t of TUNINGS) {
      expect(t.description.length).toBeGreaterThan(10)
      expect(t.blow).toHaveLength(10)
      expect(t.draw).toHaveLength(10)
    }
  })

  it('pins each tuning table for a C harp', () => {
    expect(tuningById('richter').blow).toEqual([60, 64, 67, 72, 76, 79, 84, 88, 91, 96])
    expect(tuningById('richter').draw).toEqual([62, 67, 71, 74, 77, 81, 83, 86, 89, 93])
    expect(tuningById('paddy').blow).toEqual([60, 64, 69, 72, 76, 79, 84, 88, 91, 96])
    expect(tuningById('paddy').draw).toEqual([62, 67, 71, 74, 77, 81, 83, 86, 89, 93])
    expect(tuningById('country').blow).toEqual([60, 64, 67, 72, 76, 79, 84, 88, 91, 96])
    expect(tuningById('country').draw).toEqual([62, 67, 71, 74, 78, 81, 83, 86, 89, 93])
    expect(tuningById('naturalMinor').blow).toEqual([60, 63, 67, 72, 75, 79, 84, 87, 91, 96])
    expect(tuningById('naturalMinor').draw).toEqual([62, 67, 70, 74, 77, 80, 82, 86, 89, 92])
  })
})
```

Append to `src/core/harmonica/harp.test.ts` (it already imports `buildHarp`, `describeNote`, `noteId`, `HARP_KEYS`, `HarpNote`, `Technique` and defines `get`). Add these imports at the top of the file:

```ts
import { diagramLayout } from './layout'
import { TUNING_IDS } from './tunings'
```

and add `harpFromReeds` to the existing `import { … } from './harp'` list.

```ts
const bendsOf = (harp: HarpNote[], technique: Technique) =>
  harp.filter((n) => n.technique === technique).map((n) => [n.hole, n.bendSteps, n.midi])
const oversOf = (harp: HarpNote[], technique: Technique) =>
  harp.filter((n) => n.technique === technique).map((n) => [n.hole, n.midi, n.common])
const row = (harp: HarpNote[], technique: Technique) =>
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((h) => get(harp, h, technique).midi)

describe('buildHarp — tunings', () => {
  it('defaults to Richter, and Richter is unchanged', () => {
    expect(buildHarp('C', 'richter')).toEqual(buildHarp('C'))
    expect(buildHarp('G', 'richter')).toEqual(buildHarp('G'))
  })

  it('Paddy: hole 3 blow A4 against draw B4 gives one draw bend (Bb4) and overblow C5', () => {
    const p = buildHarp('C', 'paddy')
    expect(row(p, 'blow')).toEqual([60, 64, 69, 72, 76, 79, 84, 88, 91, 96])
    expect(p.filter((n) => n.hole === 3 && n.technique === 'drawBend').map((n) => n.midi)).toEqual([
      70,
    ])
    expect(get(p, 3, 'overblow')).toMatchObject({ midi: 72, common: false })
    expect(p).toHaveLength(40)
  })

  it('Country: hole 5 draw is F#5, with one draw bend (F5) and a common overblow', () => {
    const c = buildHarp('C', 'country')
    expect(row(c, 'draw')).toEqual([62, 67, 71, 74, 78, 81, 83, 86, 89, 93])
    expect(c.filter((n) => n.hole === 5 && n.technique === 'drawBend').map((n) => n.midi)).toEqual([
      77,
    ])
    expect(get(c, 5, 'overblow')).toMatchObject({ midi: 79, common: true })
    expect(c).toHaveLength(43)
  })

  it('Natural minor: hole 3 draw is Bb4 with two bends (A4, Ab4); all bends and over-notes', () => {
    const m = buildHarp('C', 'naturalMinor')
    expect(row(m, 'blow')).toEqual([60, 63, 67, 72, 75, 79, 84, 87, 91, 96])
    expect(row(m, 'draw')).toEqual([62, 67, 70, 74, 77, 80, 82, 86, 89, 92])
    expect(bendsOf(m, 'drawBend')).toEqual([
      [1, 1, 61],
      [2, 1, 66],
      [2, 2, 65],
      [2, 3, 64],
      [3, 1, 69],
      [3, 2, 68],
      [4, 1, 73],
      [5, 1, 76],
    ])
    expect(bendsOf(m, 'blowBend')).toEqual([
      [7, 1, 83],
      [9, 1, 90],
      [10, 1, 95],
      [10, 2, 94],
      [10, 3, 93],
    ])
    expect(oversOf(m, 'overblow')).toEqual([
      [1, 63, true],
      [2, 68, false],
      [3, 71, false],
      [4, 75, true],
      [5, 78, true],
      [6, 81, true],
    ])
    expect(oversOf(m, 'overdraw')).toEqual([
      [7, 85, true],
      [8, 88, false],
      [9, 92, true],
      [10, 97, true],
    ])
    expect(m).toHaveLength(43)
  })

  it('describes a three-step blow bend', () => {
    expect(describeNote(get(buildHarp('C', 'naturalMinor'), 10, 'blowBend', 3))).toBe(
      "Hole 10 · blow, bent a step and a half (10''')",
    )
  })

  it('lays out three blow-bend and three draw-bend rows for natural minor', () => {
    const layout = diagramLayout(buildHarp('C', 'naturalMinor'), false)
    expect(layout.above.map((r) => r.id)).toEqual([
      'overblow',
      'blowBend-3',
      'blowBend-2',
      'blowBend-1',
      'blow',
    ])
    expect(layout.below.map((r) => r.id)).toEqual([
      'draw',
      'drawBend-1',
      'drawBend-2',
      'drawBend-3',
      'overdraw',
    ])
  })

  it('transposes every tuning by the key, keeping ids unique', () => {
    expect(get(buildHarp('G', 'country'), 5, 'draw').midi).toBe(73)
    expect(get(buildHarp('A', 'paddy'), 3, 'blow').midi).toBe(66)
    for (const tuning of TUNING_IDS) {
      const c = buildHarp('C', tuning)
      const ids = c.map(noteId)
      expect(new Set(ids).size).toBe(ids.length)
      for (const key of HARP_KEYS) expect(buildHarp(key, tuning).map(noteId)).toEqual(ids)
    }
  })

  it('gives equal reeds no bends and no over-note', () => {
    const blow = [60, 64, 67, 72, 76, 79, 84, 88, 91, 96]
    const draw = [60, 67, 71, 74, 77, 81, 83, 86, 89, 93]
    const harp = harpFromReeds(blow, draw, 0)
    expect(harp.filter((n) => n.hole === 1).map((n) => [n.technique, n.midi])).toEqual([
      ['blow', 60],
      ['draw', 60],
    ])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/harmonica/tunings.test.ts src/core/harmonica/harp.test.ts`
Expected: FAIL — `./tunings` cannot be resolved; `harpFromReeds` is not exported.

- [ ] **Step 3: Write the tuning tables**

`src/core/harmonica/tunings.ts`:

```ts
export type TuningId = 'richter' | 'paddy' | 'country' | 'naturalMinor'

export interface Tuning {
  readonly id: TuningId
  readonly name: string
  readonly description: string
  /** Holes 1–10 as MIDI numbers on a harp labelled C; other keys transpose these. */
  readonly blow: readonly number[]
  readonly draw: readonly number[]
}

const RICHTER_BLOW = [60, 64, 67, 72, 76, 79, 84, 88, 91, 96]
const RICHTER_DRAW = [62, 67, 71, 74, 77, 81, 83, 86, 89, 93]

export const TUNINGS: readonly Tuning[] = [
  {
    id: 'richter',
    name: 'Richter',
    description: 'Standard diatonic tuning.',
    blow: RICHTER_BLOW,
    draw: RICHTER_DRAW,
  },
  {
    id: 'paddy',
    name: 'Paddy Richter',
    description: 'Hole 3 blow raised a whole step (A on a C harp), for 1st-position melodies.',
    blow: [60, 64, 69, 72, 76, 79, 84, 88, 91, 96],
    draw: RICHTER_DRAW,
  },
  {
    id: 'country',
    name: 'Country',
    description: 'Hole 5 draw raised a half step (F# on a C harp), for major keys in 2nd position.',
    blow: RICHTER_BLOW,
    draw: [62, 67, 71, 74, 78, 81, 83, 86, 89, 93],
  },
  {
    id: 'naturalMinor',
    name: 'Natural minor',
    description: 'Minor 3rd, 6th and 7th; labelled by its blow key, for minor in 1st position.',
    blow: [60, 63, 67, 72, 75, 79, 84, 87, 91, 96],
    draw: [62, 67, 70, 74, 77, 80, 82, 86, 89, 92],
  },
]

export const TUNING_IDS: readonly TuningId[] = TUNINGS.map((t) => t.id)

export function tuningById(id: TuningId): Tuning {
  return TUNINGS.find((t) => t.id === id) ?? TUNINGS[0]
}
```

- [ ] **Step 4: Make `buildHarp` tuning-aware**

In `src/core/harmonica/harp.ts`, change the first import line to:

```ts
import { keyOffset, type HarpKey } from './keys'
import { tuningById, type TuningId } from './tunings'
```

Delete the `// Standard Richter C harmonica…` comment together with the `C_BLOW` and `C_DRAW` constants. Then replace the whole `export function buildHarp(key: HarpKey): HarpNote[] { … }` with:

```ts
/**
 * Every note of a harp whose holes 1–10 have these blow and draw reeds (MIDI on a C harp),
 * transposed by `offset` semitones.
 */
export function harpFromReeds(
  blowReeds: readonly number[],
  drawReeds: readonly number[],
  offset: number,
): HarpNote[] {
  const notes: HarpNote[] = []
  for (let i = 0; i < 10; i++) {
    const hole = (i + 1) as Hole
    const blow = blowReeds[i] + offset
    const draw = drawReeds[i] + offset
    notes.push({ hole, technique: 'blow', bendSteps: 0, midi: blow, common: true })
    notes.push({ hole, technique: 'draw', bendSteps: 0, midi: draw, common: true })

    // Equal reeds: nothing to bend towards and no over-note.
    if (draw === blow) continue

    // Bends pull the higher reed down, one semitone per step, stopping short of the lower
    // reed. Over-notes sound a semitone above the higher reed.
    const gap = Math.abs(draw - blow)
    if (draw > blow) {
      for (let s = 1; s < gap; s++) {
        notes.push({
          hole,
          technique: 'drawBend',
          bendSteps: s as BendSteps,
          midi: draw - s,
          common: true,
        })
      }
      notes.push({
        hole,
        technique: 'overblow',
        bendSteps: 0,
        midi: draw + 1,
        common: COMMON_OVERBLOWS.has(hole),
      })
    } else {
      for (let s = 1; s < gap; s++) {
        notes.push({
          hole,
          technique: 'blowBend',
          bendSteps: s as BendSteps,
          midi: blow - s,
          common: true,
        })
      }
      notes.push({
        hole,
        technique: 'overdraw',
        bendSteps: 0,
        midi: blow + 1,
        common: COMMON_OVERDRAWS.has(hole),
      })
    }
  }
  return notes
}

/** The harp for `key` in `tuning` (spec §1); Richter unless told otherwise. */
export function buildHarp(key: HarpKey, tuning: TuningId = 'richter'): HarpNote[] {
  const t = tuningById(tuning)
  return harpFromReeds(t.blow, t.draw, keyOffset(key))
}
```

`BendSteps` stays `0 | 1 | 2 | 3`: the largest gap in the four tunings is 4 semitones (natural minor holes 2 and 10), i.e. 3 bend steps.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/core/harmonica`
Expected: PASS (all harp, tunings, layout and positions tests, including the existing Richter ones).

- [ ] **Step 6: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/core/harmonica/tunings.ts src/core/harmonica/tunings.test.ts src/core/harmonica/harp.ts src/core/harmonica/harp.test.ts
git commit -m "feat(core): alternate tunings — Paddy Richter, Country, Natural minor"
```

---

### Task 2: Tuning and sound settings, tuning-aware best-score keys

**Files:**
- Modify: `src/audio/NotePlayer.ts`
- Modify: `src/ui/settings/settings.ts`
- Modify: `src/ui/scores/bestScores.ts`
- Test: `src/ui/settings/settings.test.ts` (append), `src/ui/scores/bestScores.test.ts` (append)

**Interfaces:**
- Consumes: `TuningId`, `TUNING_IDS` (Task 1)
- Produces:
  - `type SoundVoice = 'reed' | 'pure'` and `SOUND_VOICES: readonly SoundVoice[]` in `src/audio/NotePlayer.ts`
  - `Settings.tuning: TuningId` (default `'richter'`), `Settings.sound: SoundVoice` (default `'reed'`)
  - `type GameId = 'echo' | 'bend' | 'scales' | 'intervals' | 'melody' | 'hole-finder' | 'quiz'`
  - `tuningPart(tuning: TuningId): Record<string, string>` — `{}` for Richter, `{ tuning }` otherwise

`SoundVoice` lives next to the `NotePlayer` interface because `src/audio` must not import from `src/ui`, and both the settings and the synth need it.

- [ ] **Step 1: Write the failing tests**

Append to `src/ui/settings/settings.test.ts`:

```ts
describe('tuning and sound', () => {
  it('default to Richter and the Reed voice', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ tuning: 'richter', sound: 'reed' })
  })
  it('keep valid saved values', () => {
    expect(sanitizeSettings({ tuning: 'naturalMinor', sound: 'pure' })).toMatchObject({
      tuning: 'naturalMinor',
      sound: 'pure',
    })
  })
  it('repair unknown or wrongly typed values', () => {
    expect(sanitizeSettings({ tuning: 'solo', sound: 'organ' })).toEqual(DEFAULT_SETTINGS)
    expect(sanitizeSettings({ tuning: 3, sound: null })).toEqual(DEFAULT_SETTINGS)
  })
})
```

Append to `src/ui/scores/bestScores.test.ts` (add `tuningPart` to its import from `./bestScores`):

```ts
describe('tuningPart', () => {
  it('leaves Richter keys exactly as before, so saved bests survive', () => {
    expect(bestScoreKey('echo', { key: 'C', tol: 25, ...tuningPart('richter') })).toBe(
      'echo|key=C|tol=25',
    )
  })
  it('adds the tuning for the other tunings', () => {
    expect(bestScoreKey('echo', { key: 'C', tol: 25, ...tuningPart('paddy') })).toBe(
      'echo|key=C|tol=25|tuning=paddy',
    )
    expect(bestScoreKey('quiz', { key: 'G', ...tuningPart('naturalMinor') })).toBe(
      'quiz|key=G|tuning=naturalMinor',
    )
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/settings/settings.test.ts src/ui/scores/bestScores.test.ts`
Expected: FAIL — `tuning`/`sound` missing from `DEFAULT_SETTINGS`; `tuningPart` is not exported; `'quiz'` is not a `GameId` (a type error vitest doesn't report, but `npm run typecheck` will).

- [ ] **Step 3: Add `SoundVoice` to the audio layer**

At the top of `src/audio/NotePlayer.ts`, before the interface:

```ts
/** Spec §6: the synth's two reference voices. */
export type SoundVoice = 'reed' | 'pure'
export const SOUND_VOICES: readonly SoundVoice[] = ['reed', 'pure']
```

- [ ] **Step 4: Add the two settings**

In `src/ui/settings/settings.ts`, add imports below the existing ones:

```ts
import { SOUND_VOICES, type SoundVoice } from '../../audio/NotePlayer'
import { TUNING_IDS, type TuningId } from '../../core/harmonica/tunings'
```

Add to `interface Settings`, right after `key: HarpKey`:

```ts
  /** Spec §1: the harp's tuning; every harp-using page follows it. */
  tuning: TuningId
  /** Spec §6: the reference note voice. */
  sound: SoundVoice
```

Add to `DEFAULT_SETTINGS`, right after `key: 'C',`:

```ts
  tuning: 'richter',
  sound: 'reed',
```

Add to the object returned by `sanitizeSettings`, right after the `key:` line:

```ts
    tuning: TUNING_IDS.includes(r.tuning as TuningId) ? (r.tuning as TuningId) : d.tuning,
    sound: SOUND_VOICES.includes(r.sound as SoundVoice) ? (r.sound as SoundVoice) : d.sound,
```

- [ ] **Step 5: Extend the best-score keys**

In `src/ui/scores/bestScores.ts`, add at the top:

```ts
import type { TuningId } from '../../core/harmonica/tunings'
```

Replace the `GameId` line with:

```ts
export type GameId = 'echo' | 'bend' | 'scales' | 'intervals' | 'melody' | 'hole-finder' | 'quiz'
```

Add after `bestScoreKey`:

```ts
/**
 * The tuning part of a best-score key (spec §1): nothing for Richter, so the keys saved before
 * tunings existed still match; `{ tuning }` for the others.
 */
export function tuningPart(tuning: TuningId): Record<string, string> {
  return tuning === 'richter' ? {} : { tuning }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/ui/settings src/ui/scores && npm run typecheck`
Expected: PASS; no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/audio/NotePlayer.ts src/ui/settings/settings.ts src/ui/settings/settings.test.ts src/ui/scores/bestScores.ts src/ui/scores/bestScores.test.ts
git commit -m "feat(settings): tuning and reference-sound settings; tuning in best-score keys"
```

---
### Task 3: Tuning selector in the header; every harp page follows the tuning

**Files:**
- Create: `src/ui/components/TuningSelector.tsx`, `src/ui/hooks/useHarp.ts`
- Modify: `src/ui/components/Header.tsx`, `src/ui/components/Header.module.css`
- Modify: `src/ui/pages/tuner/TunerPage.tsx`, `src/ui/pages/echo/EchoNotePage.tsx`, `src/ui/pages/bend/BendTrainerPage.tsx`, `src/ui/pages/scales/ScaleRunnerPage.tsx`, `src/ui/pages/intervals/IntervalsPage.tsx`, `src/ui/pages/melody/MelodyEchoPage.tsx`
- Test: `src/ui/components/TuningSelector.test.tsx`, `src/ui/components/Header.test.tsx`, `src/ui/hooks/useHarp.test.tsx`, `src/ui/pages/echo/EchoNotePage.test.tsx` (append)

**Interfaces:**
- Consumes: `TUNINGS`, `TuningId`, `buildHarp(key, tuning)` (Task 1); `Settings.tuning`, `tuningPart` (Task 2)
- Produces:
  - `TuningSelector({ value: TuningId; onChange: (tuning: TuningId) => void })` — a `<select aria-label="Tuning">`
  - `useHarp(): HarpNote[]` — `buildHarp(settings.key, settings.tuning)`, memoised on both
  - Header: a `role="group" aria-label="Your harp"` holding the key select, a "·" and the tuning select

Decision 1: pages get their harp from `useHarp()`, and every game's run key gains `settings.tuning`, so a tuning change remounts the run (timers cleared, prompt cancelled, score reset) exactly like a key change does. Decision 2: best-score keys spread `tuningPart(settings.tuning)`. Decision 3: two selects joined by "·".

- [ ] **Step 1: Write the failing tests**

`src/ui/components/TuningSelector.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TuningSelector } from './TuningSelector'

describe('TuningSelector', () => {
  it('offers the four tunings by name and reports changes', () => {
    const onChange = vi.fn()
    render(<TuningSelector value="richter" onChange={onChange} />)
    const select = screen.getByRole('combobox', { name: 'Tuning' })
    expect([...select.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      'Richter',
      'Paddy Richter',
      'Country',
      'Natural minor',
    ])
    fireEvent.change(select, { target: { value: 'country' } })
    expect(onChange).toHaveBeenCalledWith('country')
  })

  it("explains the selected tuning in the select's tooltip", () => {
    render(<TuningSelector value="paddy" onChange={vi.fn()} />)
    expect(screen.getByRole('combobox', { name: 'Tuning' })).toHaveAttribute(
      'title',
      'Hole 3 blow raised a whole step (A on a C harp), for 1st-position melodies.',
    )
  })
})
```

`src/ui/components/Header.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SettingsProvider, useSettings } from '../settings/SettingsContext'
import { Header } from './Header'

function Probe() {
  const { settings } = useSettings()
  return <output aria-label="probe">{`${settings.key} ${settings.tuning}`}</output>
}

const selected = (name: string) =>
  (screen.getByRole('combobox', { name }) as HTMLSelectElement).selectedOptions[0].textContent

describe('Header', () => {
  it('shows the harp as "C harp · Richter" and edits the tuning setting', () => {
    render(
      <SettingsProvider storage={null}>
        <Header />
        <Probe />
      </SettingsProvider>,
    )
    const harp = screen.getByRole('group', { name: 'Your harp' })
    expect(within(harp).getByRole('combobox', { name: 'Harp key' })).toBeInTheDocument()
    expect(harp).toHaveTextContent('·')
    expect(selected('Harp key')).toBe('C harp')
    expect(selected('Tuning')).toBe('Richter')

    fireEvent.change(screen.getByRole('combobox', { name: 'Tuning' }), {
      target: { value: 'naturalMinor' },
    })
    expect(screen.getByLabelText('probe')).toHaveTextContent('C naturalMinor')
    expect(selected('Tuning')).toBe('Natural minor')
  })
})
```

`src/ui/hooks/useHarp.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { SettingsProvider, useSettings } from '../settings/SettingsContext'
import { useHarp } from './useHarp'

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider storage={null}>{children}</SettingsProvider>
)

describe('useHarp', () => {
  it('builds the harp for the current key and tuning, and keeps it until they change', () => {
    const { result } = renderHook(() => ({ harp: useHarp(), api: useSettings() }), { wrapper })
    const first = result.current.harp
    const hole5Draw = () =>
      result.current.harp.find((n) => n.hole === 5 && n.technique === 'draw')!.midi
    expect(hole5Draw()).toBe(77)
    act(() => result.current.api.update({ bpm: 100 }))
    expect(result.current.harp).toBe(first)
    act(() => result.current.api.update({ tuning: 'country' }))
    expect(hole5Draw()).toBe(78)
    act(() => result.current.api.update({ key: 'G' }))
    expect(hole5Draw()).toBe(73)
  })
})
```

Append to `src/ui/pages/echo/EchoNotePage.test.tsx`, inside `describe('EchoGame', …)` (add `import { Header } from '../../components/Header'` at the top):

```tsx
  it('follows the tuning and abandons the round when it changes', async () => {
    render(
      <SettingsProvider storage={null}>
        <Header />
        <EchoGame rng={scriptedRng([0])} />
      </SettingsProvider>,
    )
    expect(screen.queryByRole('button', { name: '-5 F#5' })).toBeNull()
    await start()
    fireEvent.change(screen.getByRole('combobox', { name: 'Tuning' }), {
      target: { value: 'country' },
    })
    expect(screen.getByRole('button', { name: '-5 F#5' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '▶ Start' })).toBeInTheDocument()
    hold(60, 0, 500)
    expect(screen.queryByText(/Correct/)).toBeNull()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/components src/ui/hooks/useHarp.test.tsx src/ui/pages/echo`
Expected: FAIL — `./TuningSelector` and `./useHarp` cannot be resolved; the header has no "Your harp" group; the Echo chart never shows `-5 F#5`.

- [ ] **Step 3: Write the selector and the hook**

`src/ui/components/TuningSelector.tsx`:

```tsx
import { TUNINGS, type TuningId } from '../../core/harmonica/tunings'

interface Props {
  value: TuningId
  onChange: (tuning: TuningId) => void
}

export function TuningSelector({ value, onChange }: Props) {
  const current = TUNINGS.find((t) => t.id === value)
  return (
    <select
      aria-label="Tuning"
      title={current?.description}
      value={value}
      onChange={(e) => onChange(e.target.value as TuningId)}
    >
      {TUNINGS.map((t) => (
        <option key={t.id} value={t.id} title={t.description}>
          {t.name}
        </option>
      ))}
    </select>
  )
}
```

`src/ui/hooks/useHarp.ts`:

```ts
import { useMemo } from 'react'
import { buildHarp, type HarpNote } from '../../core/harmonica/harp'
import { useSettings } from '../settings/SettingsContext'

/** The harp for the header's key and tuning (spec §1). Every harp-using page reads it here. */
export function useHarp(): HarpNote[] {
  const { settings } = useSettings()
  return useMemo(() => buildHarp(settings.key, settings.tuning), [settings.key, settings.tuning])
}
```

- [ ] **Step 4: Put the selector in the header**

In `src/ui/components/Header.tsx`, add the import:

```tsx
import { TuningSelector } from './TuningSelector'
```

and replace the line `<KeySelector value={settings.key} onChange={(key) => update({ key })} />` with:

```tsx
      <div className={styles.harp} role="group" aria-label="Your harp">
        <KeySelector value={settings.key} onChange={(key) => update({ key })} />
        <span className={styles.dot} aria-hidden="true">
          ·
        </span>
        <TuningSelector value={settings.tuning} onChange={(tuning) => update({ tuning })} />
      </div>
```

Append to `src/ui/components/Header.module.css`:

```css
.harp {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.dot {
  color: var(--text-dim);
}
```

- [ ] **Step 5: Make every harp page follow the tuning**

Apply these edits to each file listed. They are mechanical; `npm run typecheck` (with `noUnusedLocals`) flags anything missed.

**All six files** (`TunerPage.tsx`, `EchoNotePage.tsx`, `BendTrainerPage.tsx`, `ScaleRunnerPage.tsx`, `IntervalsPage.tsx`, `MelodyEchoPage.tsx`):
- add `import { useHarp } from '../../hooks/useHarp'`;
- replace `const harp = useMemo(() => buildHarp(settings.key), [settings.key])` with `const harp = useHarp()`;
- remove `buildHarp` from the `'../../../core/harmonica/harp'` import (keep the other names).

**`TunerPage.tsx` only:** `useMemo` is now unused; change `import { useEffect, useMemo, useState } from 'react'` to `import { useEffect, useState } from 'react'`.

**The five game files** (all but the tuner):
- change `import { bestScoreKey } from '../../scores/bestScores'` to `import { bestScoreKey, tuningPart } from '../../scores/bestScores'`;
- in the `runKey` array, add `settings.tuning,` on the line right after `settings.key,`;
- in the object passed to `bestScoreKey(…)`, add `...tuningPart(settings.tuning),` as the last property.

For example, Echo's run key and best key become:

```tsx
  const runKey = [
    mode,
    poolLabel(filter),
    settings.key,
    settings.tuning,
    settings.a4,
    settings.showAdvanced,
    settings.toleranceCents,
    settings.holdMs,
  ].join('|')
```

```tsx
    bestScoreKey('echo', {
      key: settings.key,
      pool: poolLabel(filter),
      adv: settings.showAdvanced,
      tol: settings.toleranceCents,
      hold: settings.holdMs,
      ...tuningPart(settings.tuning),
    }),
```

In `ScaleRunnerPage.tsx` the harp, `runKey` and `bestKey` are all in `ScaleGame`; apply the same three edits there.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/ui && npm run typecheck && npm run lint`
Expected: PASS; no type or lint errors. The existing page tests are unchanged, because Richter is the default.

- [ ] **Step 7: Commit**

```bash
git add src/ui/components/TuningSelector.tsx src/ui/components/TuningSelector.test.tsx src/ui/components/Header.tsx src/ui/components/Header.module.css src/ui/components/Header.test.tsx src/ui/hooks/useHarp.ts src/ui/hooks/useHarp.test.tsx src/ui/pages
git commit -m "feat(ui): tuning selector next to the key; every harp page follows the tuning"
```

---

### Task 4: Reed reference voice and the sound toggle

**Files:**
- Create: `src/audio/voices.ts`, `src/ui/components/SoundToggle.tsx`
- Modify: `src/audio/SynthNotePlayer.ts` (full replacement below), `src/ui/hooks/useNotePlayer.ts`, `src/ui/components/game/MatchSettings.tsx`, `src/ui/pages/tuner/TunerPage.tsx`
- Test: `src/audio/voices.test.ts`, `src/audio/SynthNotePlayer.test.ts` (replace), `src/ui/components/SoundToggle.test.tsx`, `src/ui/components/game/GameComponents.test.tsx` (append), `src/ui/pages/tuner/TunerPage.test.tsx` (append)

**Interfaces:**
- Consumes: `SoundVoice` (Task 2), `Settings.sound` (Task 2)
- Produces:
  - `REED_PARTIALS: readonly { multiple: number; gain: number }[]`, `REED_LOWPASS_MULTIPLE = 5`, `REED_ATTACK_S = 0.035`, `PURE_ATTACK_S = 0.02`, `BREATH = { centerHz: 2000, q: 1, peak: 0.05, decayS: 0.06, stopS: 0.07 }`, `reedFrequencies(freq: number): number[]`
  - `new SynthNotePlayer(a4: () => number, sound: SoundVoice = 'reed')`, `setSound(sound: SoundVoice): void`
  - `SoundToggle()` — `role="group" aria-label="Reference sound"` with Reed / Pure buttons bound to `Settings.sound`

Spec §6. The Reed voice is five sine partials at exact integer multiples of f₀ (so the fundamental is exact), mixed 1 : 0.55 : 0.35 : 0.2 : 0.12 and normalised to the same peak as before, through a low-pass at 5 × f₀ (Q 0.5, capped at 12 kHz). A 60 ms band-passed noise burst at 2 kHz goes straight to the master output as a fire-and-forget source, so releasing a note never has to stop it. The attack is 35 ms, with no vibrato. The current sawtooth + triangle voice becomes **Pure**, unchanged. Decision 12: the toggle is a segmented "Reference sound" group.

- [ ] **Step 1: Write the failing tests**

`src/audio/voices.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { REED_PARTIALS, reedFrequencies } from './voices'

describe('reed voice', () => {
  it('uses partials 1–5 at the spec amplitudes', () => {
    expect(REED_PARTIALS).toEqual([
      { multiple: 1, gain: 1 },
      { multiple: 2, gain: 0.55 },
      { multiple: 3, gain: 0.35 },
      { multiple: 4, gain: 0.2 },
      { multiple: 5, gain: 0.12 },
    ])
  })
  it('keeps the fundamental exact and the overtones at exact multiples', () => {
    expect(reedFrequencies(440)).toEqual([440, 880, 1320, 1760, 2200])
    expect(reedFrequencies(261.6255653005986)[0]).toBe(261.6255653005986)
  })
})
```

Replace `src/audio/SynthNotePlayer.test.ts` with:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { audioEngine } from './AudioEngine'
import { SynthNotePlayer } from './SynthNotePlayer'

interface FakeParam {
  value: number
  setValueAtTime: ReturnType<typeof vi.fn>
  linearRampToValueAtTime: ReturnType<typeof vi.fn>
  cancelScheduledValues: ReturnType<typeof vi.fn>
}
interface FakeOscillator {
  type: string
  frequency: { value: number }
  connect: (dest: unknown) => unknown
  start: (t: number) => void
  stop: (t: number) => void
  onended: (() => void) | null
}
interface FakeFilter {
  type: string
  frequency: { value: number }
  Q: { value: number }
}

/** Stand-in for the AudioContext methods SynthNotePlayer uses; records what it creates. */
function fakeCtx() {
  const oscillators: FakeOscillator[] = []
  const filters: FakeFilter[] = []
  const gains: { gain: FakeParam }[] = []
  const sources: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = []
  const param = (): FakeParam => ({
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  })
  const ctx = {
    currentTime: 0,
    sampleRate: 48000,
    createGain: vi.fn(() => {
      const g = { gain: param(), connect: vi.fn((d: unknown) => d), disconnect: vi.fn() }
      gains.push(g)
      return g
    }),
    createBiquadFilter: vi.fn(() => {
      const f = { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect: vi.fn((d: unknown) => d) }
      filters.push(f)
      return f
    }),
    createOscillator: vi.fn(() => {
      const osc: FakeOscillator = {
        type: '',
        frequency: { value: 0 },
        connect: vi.fn((d: unknown) => d),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      }
      oscillators.push(osc)
      return osc
    }),
    createBuffer: vi.fn((_channels: number, length: number) => {
      const data = new Float32Array(length)
      return { getChannelData: () => data }
    }),
    createBufferSource: vi.fn(() => {
      const s = { buffer: null, connect: vi.fn((d: unknown) => d), start: vi.fn(), stop: vi.fn() }
      sources.push(s)
      return s
    }),
  }
  return { ctx: ctx as unknown as AudioContext, oscillators, filters, gains, sources }
}

let fake: ReturnType<typeof fakeCtx>

describe('SynthNotePlayer', () => {
  beforeEach(() => {
    fake = fakeCtx()
    vi.spyOn(audioEngine, 'ctx', 'get').mockReturnValue(fake.ctx)
    vi.spyOn(audioEngine, 'master', 'get').mockReturnValue({
      connect: vi.fn(),
    } as unknown as GainNode)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Reed (default): sine partials at exact multiples, low-pass at 5 × f0, 35 ms attack', () => {
    const player = new SynthNotePlayer(() => 440)
    player.start(69) // A4
    expect(fake.oscillators.map((o) => [o.type, o.frequency.value])).toEqual([
      ['sine', 440],
      ['sine', 880],
      ['sine', 1320],
      ['sine', 1760],
      ['sine', 2200],
    ])
    expect(fake.filters.map((f) => [f.type, f.frequency.value])).toEqual([
      ['lowpass', 2200],
      ['bandpass', 2000],
    ])
    // gains[0] is the note envelope.
    expect(fake.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.25, 0.035)
  })

  it('Reed: a short breath-noise burst at the onset that stops on its own', () => {
    const player = new SynthNotePlayer(() => 440)
    player.start(60)
    expect(fake.sources).toHaveLength(1)
    expect(fake.sources[0].start).toHaveBeenCalledWith(0)
    expect(fake.sources[0].stop).toHaveBeenCalledWith(0.07)
    player.stop()
    // Releasing the note stops the oscillators, never the (already scheduled) breath again.
    expect(fake.sources[0].stop).toHaveBeenCalledTimes(1)
    // The noise buffer is made once per context and reused.
    player.start(62)
    expect(fake.ctx.createBuffer).toHaveBeenCalledTimes(1)
  })

  it('Pure: the old sawtooth + triangle voice with a 20 ms attack', () => {
    const player = new SynthNotePlayer(() => 440, 'pure')
    player.start(69)
    expect(fake.oscillators.map((o) => [o.type, o.frequency.value])).toEqual([
      ['sawtooth', 440],
      ['triangle', 440],
    ])
    expect(fake.sources).toHaveLength(0)
    expect(fake.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.25, 0.02)
  })

  it('switches voice with setSound() for the next note', () => {
    const player = new SynthNotePlayer(() => 440)
    player.setSound('pure')
    player.start(69)
    expect(fake.oscillators.map((o) => o.type)).toEqual(['sawtooth', 'triangle'])
  })

  it('uses the latest A4 after setA4Getter(), on the same instance', () => {
    const player = new SynthNotePlayer(() => 440)
    player.start(69)
    expect(fake.oscillators[0].frequency.value).toBe(440)
    player.setA4Getter(() => 442)
    player.start(69)
    expect(fake.oscillators[5].frequency.value).toBe(442)
    expect(player.isSounding).toBe(true)
  })

  it('reports when it starts and stops sounding, not when one note replaces another', () => {
    const player = new SynthNotePlayer(() => 440)
    const events: boolean[] = []
    const off = player.onSoundingChange((s) => events.push(s))
    player.start(60)
    player.start(62)
    player.stop()
    player.stop()
    expect(events).toEqual([true, false])
    off()
    player.start(60)
    expect(events).toEqual([true, false])
  })
})
```

`src/ui/components/SoundToggle.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SettingsProvider } from '../settings/SettingsContext'
import { SoundToggle } from './SoundToggle'

describe('SoundToggle', () => {
  it('shows Reed by default and switches the setting to Pure', () => {
    render(
      <SettingsProvider storage={null}>
        <SoundToggle />
      </SettingsProvider>,
    )
    expect(screen.getByRole('group', { name: 'Reference sound' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reed' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Pure' }))
    expect(screen.getByRole('button', { name: 'Pure' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Reed' })).toHaveAttribute('aria-pressed', 'false')
  })
})
```

Append to the `describe('MatchSettings', …)` block in `src/ui/components/game/GameComponents.test.tsx`:

```tsx
  it('offers the reference sound toggle', () => {
    withSettings(<MatchSettings />)
    fireEvent.click(screen.getByRole('button', { name: 'Pure' }))
    expect(screen.getByRole('button', { name: 'Pure' })).toHaveAttribute('aria-pressed', 'true')
  })
```

Append to the `describe('PlayMode', …)` block in `src/ui/pages/tuner/TunerPage.test.tsx`:

```tsx
  it('offers the Reed / Pure reference sound in the Play toolbar', () => {
    renderPlay()
    expect(screen.getByRole('group', { name: 'Reference sound' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reed' })).toHaveAttribute('aria-pressed', 'true')
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/audio src/ui/components src/ui/pages/tuner`
Expected: FAIL — `./voices` and `./SoundToggle` cannot be resolved; the synth still makes sawtooth + triangle oscillators by default.

- [ ] **Step 3: Write the voice constants**

`src/audio/voices.ts`:

```ts
/** Spec §6 Reed voice: the first five harmonics of a free reed. */
export const REED_PARTIALS: readonly { multiple: number; gain: number }[] = [
  { multiple: 1, gain: 1 },
  { multiple: 2, gain: 0.55 },
  { multiple: 3, gain: 0.35 },
  { multiple: 4, gain: 0.2 },
  { multiple: 5, gain: 0.12 },
]

/** The Reed voice's gentle low-pass sits at this multiple of the fundamental. */
export const REED_LOWPASS_MULTIPLE = 5
export const REED_ATTACK_S = 0.035
export const PURE_ATTACK_S = 0.02

/** The breath at a Reed note's onset: band-passed noise that fades out on its own. */
export const BREATH = { centerHz: 2000, q: 1, peak: 0.05, decayS: 0.06, stopS: 0.07 } as const

/** The frequencies a Reed note sounds: exact multiples of `freq`, the fundamental first. */
export function reedFrequencies(freq: number): number[] {
  return REED_PARTIALS.map((p) => freq * p.multiple)
}
```

- [ ] **Step 4: Give the synth both voices**

Replace `src/audio/SynthNotePlayer.ts` with:

```ts
import { midiToFreq } from '../core/music/pitch'
import { audioEngine } from './AudioEngine'
import type { NotePlayer, SoundVoice } from './NotePlayer'
import {
  BREATH,
  PURE_ATTACK_S,
  REED_ATTACK_S,
  REED_LOWPASS_MULTIPLE,
  REED_PARTIALS,
  reedFrequencies,
} from './voices'

const PEAK = 0.25
const RELEASE_S = 0.08
const NOISE_SECONDS = 0.1
const REED_TOTAL_GAIN = REED_PARTIALS.reduce((sum, p) => sum + p.gain, 0)

interface Voice {
  oscillators: OscillatorNode[]
  envelope: GainNode
}

/**
 * The reference-note synth (spec §6). "Reed": additive harmonics plus a breath at the onset.
 * "Pure": sawtooth + triangle through a low-pass. Either way the fundamental is exact.
 */
export class SynthNotePlayer implements NotePlayer {
  private voice: Voice | null = null
  private a4: () => number
  private sound: SoundVoice
  private noise: { ctx: AudioContext; buffer: AudioBuffer } | null = null
  private soundingListeners = new Set<(sounding: boolean) => void>()

  constructor(a4: () => number, sound: SoundVoice = 'reed') {
    this.a4 = a4
    this.sound = sound
  }

  get isSounding(): boolean {
    return this.voice !== null
  }

  /** Swaps the A4 getter, e.g. when a caller can't safely hand a ref-reading closure to the
   * constructor during render; lets it update the getter later from an effect instead. */
  setA4Getter(a4: () => number): void {
    this.a4 = a4
  }

  /** Changes the voice for the next note; a sounding note keeps its voice. */
  setSound(sound: SoundVoice): void {
    this.sound = sound
  }

  onSoundingChange(listener: (sounding: boolean) => void): () => void {
    this.soundingListeners.add(listener)
    return () => {
      this.soundingListeners.delete(listener)
    }
  }

  start(midi: number): void {
    const wasSounding = this.voice !== null
    this.release()
    const ctx = audioEngine.ctx
    const t = ctx.currentTime
    const freq = midiToFreq(midi, this.a4())
    const reed = this.sound === 'reed'

    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0, t)
    envelope.gain.linearRampToValueAtTime(PEAK, t + (reed ? REED_ATTACK_S : PURE_ATTACK_S))
    envelope.connect(audioEngine.master)

    const oscillators = reed
      ? this.reedOscillators(ctx, freq, t, envelope)
      : this.pureOscillators(ctx, freq, t, envelope)
    oscillators[0].onended = () => envelope.disconnect()
    if (reed) this.breath(ctx, t)

    this.voice = { oscillators, envelope }
    if (!wasSounding) this.soundingListeners.forEach((l) => l(true))
  }

  stop(): void {
    if (!this.voice) return
    this.release()
    this.soundingListeners.forEach((l) => l(false))
  }

  play(midi: number, { durationMs = 1000 }: { durationMs?: number } = {}): Promise<void> {
    this.start(midi)
    const voice = this.voice
    return new Promise((resolve) =>
      setTimeout(() => {
        if (this.voice === voice) this.stop()
        resolve()
      }, durationMs),
    )
  }

  private pureOscillators(
    ctx: AudioContext,
    freq: number,
    t: number,
    out: AudioNode,
  ): OscillatorNode[] {
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = Math.min(freq * 4, 8000)
    filter.Q.value = 1
    filter.connect(out)
    return (['sawtooth', 'triangle'] as const).map((type, i) => {
      const osc = ctx.createOscillator()
      osc.type = type
      osc.frequency.value = freq
      const mix = ctx.createGain()
      mix.gain.value = i === 0 ? 0.35 : 0.65
      osc.connect(mix).connect(filter)
      osc.start(t)
      return osc
    })
  }

  private reedOscillators(
    ctx: AudioContext,
    freq: number,
    t: number,
    out: AudioNode,
  ): OscillatorNode[] {
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = Math.min(freq * REED_LOWPASS_MULTIPLE, 12000)
    filter.Q.value = 0.5
    filter.connect(out)
    const frequencies = reedFrequencies(freq)
    return REED_PARTIALS.map((partial, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = frequencies[i]
      const mix = ctx.createGain()
      mix.gain.value = partial.gain / REED_TOTAL_GAIN
      osc.connect(mix).connect(filter)
      osc.start(t)
      return osc
    })
  }

  /** A fire-and-forget noise burst: it fades out and stops by itself. */
  private breath(ctx: AudioContext, t: number): void {
    const source = ctx.createBufferSource()
    source.buffer = this.noiseBuffer(ctx)
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = BREATH.centerHz
    band.Q.value = BREATH.q
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(BREATH.peak, t)
    gain.gain.linearRampToValueAtTime(0, t + BREATH.decayS)
    source.connect(band).connect(gain).connect(audioEngine.master)
    source.start(t)
    source.stop(t + BREATH.stopS)
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noise && this.noise.ctx === ctx) return this.noise.buffer
    const length = Math.ceil(ctx.sampleRate * NOISE_SECONDS)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    this.noise = { ctx, buffer }
    return buffer
  }

  /** Fades the current voice out without telling listeners (start() uses it to swap notes). */
  private release(): void {
    const voice = this.voice
    if (!voice) return
    this.voice = null
    const t = audioEngine.ctx.currentTime
    const gain = voice.envelope.gain
    gain.cancelScheduledValues(t)
    gain.setValueAtTime(gain.value, t)
    gain.linearRampToValueAtTime(0, t + RELEASE_S)
    voice.oscillators.forEach((o) => o.stop(t + RELEASE_S + 0.02))
  }
}
```

- [ ] **Step 5: Make the player follow the setting**

In `src/ui/hooks/useNotePlayer.ts`, change the `useState` line to:

```ts
  const [player] = useState(() => new SynthNotePlayer(() => settings.a4, settings.sound))
```

and add, after the existing `setA4Getter` effect:

```ts
  useEffect(() => player.setSound(settings.sound), [player, settings.sound])
```

- [ ] **Step 6: Write the toggle and place it**

`src/ui/components/SoundToggle.tsx`:

```tsx
import { useSettings } from '../settings/SettingsContext'
import styles from './game/Game.module.css'

/** Spec §6: Reed (default) or Pure reference notes, saved with the settings. */
export function SoundToggle() {
  const { settings, update } = useSettings()
  return (
    <div role="group" aria-label="Reference sound" className={styles.segmented}>
      <button
        type="button"
        aria-pressed={settings.sound === 'reed'}
        onClick={() => update({ sound: 'reed' })}
      >
        Reed
      </button>
      <button
        type="button"
        aria-pressed={settings.sound === 'pure'}
        onClick={() => update({ sound: 'pure' })}
      >
        Pure
      </button>
    </div>
  )
}
```

In `src/ui/components/game/MatchSettings.tsx`, add `import { SoundToggle } from '../SoundToggle'` and insert just before the closing `<p className={styles.hint}>Changing these restarts the current game.</p>`:

```tsx
      <div className={styles.field}>
        Reference sound
        <SoundToggle />
      </div>
```

In `src/ui/pages/tuner/TunerPage.tsx`, add `import { SoundToggle } from '../../components/SoundToggle'` and, in `PlayMode`'s toolbar, insert `<SoundToggle />` right after the `▶ Play` / `■ Stop` button (still inside `<div className={styles.toolbar}>`).

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/audio src/ui && npm run typecheck && npm run lint`
Expected: PASS; no type or lint errors.

- [ ] **Step 8: Commit**

```bash
git add src/audio src/ui/hooks/useNotePlayer.ts src/ui/components/SoundToggle.tsx src/ui/components/SoundToggle.test.tsx src/ui/components/game/MatchSettings.tsx src/ui/components/game/GameComponents.test.tsx src/ui/pages/tuner
git commit -m "feat(audio): Reed reference voice; Reed / Pure toggle in the tuner and games"
```

---
### Task 5: Practice log core — dates, the log model, statistics, the active clock

**Files:**
- Create: `src/core/log/dates.ts`, `src/core/log/logModel.ts`, `src/core/log/stats.ts`, `src/core/log/activeClock.ts`
- Test: `src/core/log/dates.test.ts`, `src/core/log/logModel.test.ts`, `src/core/log/stats.test.ts`, `src/core/log/activeClock.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `DATE_RE: RegExp`; `localDate(ms: number): string` (`YYYY-MM-DD`, local time); `addDays(date: string, days: number): string`; `weekStart(date: string): string` (that week's Monday); `secondsByDay(startMs: number, endMs: number): { date: string; seconds: number }[]`
  - `interface SessionEntry { readonly date: string; readonly game: string; readonly score: number; readonly max: number }`
  - `interface PracticeLog { readonly days: Readonly<Record<string, Readonly<Record<string, number>>>>; readonly sessions: readonly SessionEntry[] }` — `days[date][pageId]` = seconds
  - `MAX_SESSIONS = 200`; `emptyLog(): PracticeLog`; `sanitizeLog(raw: unknown): PracticeLog`; `addPractice(log: PracticeLog, date: string, pageId: string, seconds: number): PracticeLog`; `addSession(log: PracticeLog, entry: SessionEntry): PracticeLog`
  - `STREAK_MIN_SECONDS = 60`; `dayTotal(log, date): number`; `streaks(log, today): { current: number; longest: number }`; `totals(log, today): { today: number; week: number; all: number }`; `dailySeconds(log, today, count = 14): { date: string; seconds: number }[]` (oldest first); `pageSecondsThisWeek(log, today): { pageId: string; seconds: number }[]` (most first); `recentSessions(log, count = 10): SessionEntry[]` (newest first); `formatDuration(seconds: number): string`
  - `interface Span { readonly startMs: number; readonly endMs: number }`; `MAX_SPAN_MS = 30_000`; `class ActiveClock { get running(): boolean; start(nowMs: number): void; flush(nowMs: number): Span | null; stop(nowMs: number): Span | null }`

Spec §5. Everything here is pure: callers pass timestamps and "today". Local dates use `new Date(ms)` on the passed-in timestamp. Date arithmetic on `YYYY-MM-DD` strings goes through UTC, so daylight-saving changes can't shift a day. Decision 7: "this week" starts on Monday. Decision 8: `ActiveClock.flush` never returns more than the last 30 s. With a 15 s flush interval, a longer gap means the computer slept or the clock jumped, not that someone practised.

- [ ] **Step 1: Write the failing tests**

`src/core/log/dates.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { addDays, localDate, secondsByDay, weekStart } from './dates'

const at = (y: number, m: number, d: number, h = 0, min = 0, s = 0) =>
  new Date(y, m - 1, d, h, min, s).getTime()

describe('localDate', () => {
  it('formats the local calendar date', () => {
    expect(localDate(at(2026, 9, 27, 23, 59, 59))).toBe('2026-09-27')
    expect(localDate(at(2026, 1, 5))).toBe('2026-01-05')
  })
})

describe('addDays', () => {
  it('crosses month, year and leap-day boundaries', () => {
    expect(addDays('2026-09-27', 1)).toBe('2026-09-28')
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-09-27', -13)).toBe('2026-09-14')
  })
})

describe('weekStart', () => {
  it('is the Monday of the same week', () => {
    expect(weekStart('2026-09-27')).toBe('2026-09-21') // Sunday
    expect(weekStart('2026-09-21')).toBe('2026-09-21') // Monday
    expect(weekStart('2026-09-23')).toBe('2026-09-21')
    expect(weekStart('2026-10-01')).toBe('2026-09-28')
  })
})

describe('secondsByDay', () => {
  it('keeps a span within one day in one piece', () => {
    expect(secondsByDay(at(2026, 9, 27, 10), at(2026, 9, 27, 10, 0, 15))).toEqual([
      { date: '2026-09-27', seconds: 15 },
    ])
  })
  it('splits a span at local midnight', () => {
    expect(secondsByDay(at(2026, 9, 27, 23, 59, 50), at(2026, 9, 28, 0, 0, 20))).toEqual([
      { date: '2026-09-27', seconds: 10 },
      { date: '2026-09-28', seconds: 20 },
    ])
  })
  it('returns nothing for empty or backwards spans', () => {
    expect(secondsByDay(1000, 1000)).toEqual([])
    expect(secondsByDay(2000, 1000)).toEqual([])
  })
})
```

`src/core/log/logModel.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { MAX_SESSIONS, addPractice, addSession, emptyLog, sanitizeLog } from './logModel'

const session = (score: number) => ({ date: '2026-09-27', game: 'echo', score, max: 2000 })

describe('sanitizeLog', () => {
  it('turns anything that is not a log object into an empty log', () => {
    expect(sanitizeLog(null)).toEqual(emptyLog())
    expect(sanitizeLog('x')).toEqual(emptyLog())
    expect(sanitizeLog([1, 2])).toEqual(emptyLog())
    expect(sanitizeLog({ days: [], sessions: {} })).toEqual(emptyLog())
  })

  it('keeps valid days and drops bad dates, pages and amounts', () => {
    const raw = {
      days: {
        '2026-09-27': { tuner: 120, echo: '60', bend: -5, melody: Infinity, scales: 0 },
        '2026-9-1': { tuner: 10 },
        yesterday: { tuner: 10 },
        '2026-09-26': 'lots',
        '2026-09-25': { echo: 'x' },
      },
    }
    expect(sanitizeLog(raw)).toEqual({ days: { '2026-09-27': { tuner: 120 } }, sessions: [] })
  })

  it('keeps valid sessions, strips extra fields and keeps only the last 200', () => {
    const raw = {
      sessions: [
        { ...session(5), extra: true },
        { date: 'today', game: 'echo', score: 1, max: 2 },
        { date: '2026-09-27', game: '', score: 1, max: 2 },
        { date: '2026-09-27', game: 'echo', score: '1', max: 2 },
        null,
      ],
    }
    expect(sanitizeLog(raw).sessions).toEqual([session(5)])
    const many = { sessions: Array.from({ length: 250 }, (_, i) => session(i)) }
    const kept = sanitizeLog(many).sessions
    expect(kept).toHaveLength(MAX_SESSIONS)
    expect(kept[0].score).toBe(50)
    expect(kept[199].score).toBe(249)
  })
})

describe('addPractice', () => {
  it('adds seconds per day and page without mutating the log', () => {
    const empty = emptyLog()
    const once = addPractice(empty, '2026-09-27', 'tuner', 15)
    const twice = addPractice(once, '2026-09-27', 'tuner', 15)
    const other = addPractice(twice, '2026-09-27', 'echo', 7.25)
    expect(empty).toEqual(emptyLog())
    expect(once.days).toEqual({ '2026-09-27': { tuner: 15 } })
    expect(other.days).toEqual({ '2026-09-27': { tuner: 30, echo: 7.3 } })
  })
  it('ignores zero or negative amounts', () => {
    const log = emptyLog()
    expect(addPractice(log, '2026-09-27', 'tuner', 0)).toBe(log)
    expect(addPractice(log, '2026-09-27', 'tuner', -3)).toBe(log)
  })
})

describe('addSession', () => {
  it('appends and keeps only the last 200', () => {
    let log = emptyLog()
    for (let i = 0; i < MAX_SESSIONS; i++) log = addSession(log, session(i))
    log = addSession(log, session(999))
    expect(log.sessions).toHaveLength(MAX_SESSIONS)
    expect(log.sessions[0].score).toBe(1)
    expect(log.sessions[MAX_SESSIONS - 1].score).toBe(999)
  })
})
```

`src/core/log/stats.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { emptyLog, type PracticeLog } from './logModel'
import {
  dailySeconds,
  dayTotal,
  formatDuration,
  pageSecondsThisWeek,
  recentSessions,
  streaks,
  totals,
} from './stats'

const TODAY = '2026-09-27' // a Sunday
const logOf = (days: Record<string, Record<string, number>>): PracticeLog => ({
  days,
  sessions: [],
})
const everyDay = (dates: string[], seconds = 60) =>
  logOf(Object.fromEntries(dates.map((d) => [d, { tuner: seconds }])))

describe('streaks', () => {
  it('is zero for an empty log', () => {
    expect(streaks(emptyLog(), TODAY)).toEqual({ current: 0, longest: 0 })
  })
  it('counts consecutive days ending today', () => {
    expect(streaks(everyDay(['2026-09-25', '2026-09-26', '2026-09-27']), TODAY)).toEqual({
      current: 3,
      longest: 3,
    })
  })
  it('still counts a streak that ended yesterday (today is not over yet)', () => {
    expect(streaks(everyDay(['2026-09-24', '2026-09-25', '2026-09-26'], 120), TODAY)).toEqual({
      current: 3,
      longest: 3,
    })
  })
  it('breaks the current streak after a missed day, but remembers the longest', () => {
    expect(streaks(everyDay(['2026-09-24', '2026-09-25']), TODAY)).toEqual({
      current: 0,
      longest: 2,
    })
    const gap = everyDay(['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-26', TODAY])
    expect(streaks(gap, TODAY)).toEqual({ current: 2, longest: 4 })
  })
  it('needs at least 60 s in a day, summed over pages', () => {
    const log = logOf({
      '2026-09-25': { tuner: 60 },
      '2026-09-26': { tuner: 59 },
      [TODAY]: { tuner: 30, echo: 30 },
    })
    expect(streaks(log, TODAY)).toEqual({ current: 1, longest: 1 })
  })
  it('runs across the end of a month', () => {
    expect(streaks(everyDay(['2026-09-30', '2026-10-01']), '2026-10-01').current).toBe(2)
  })
})

const WEEK = logOf({
  [TODAY]: { tuner: 100, echo: 50 },
  '2026-09-21': { bend: 200 }, // Monday of this week
  '2026-09-20': { melody: 1000 }, // last Sunday
})

describe('totals', () => {
  it('sums today, this week (from Monday) and all time', () => {
    expect(dayTotal(WEEK, TODAY)).toBe(150)
    expect(totals(WEEK, TODAY)).toEqual({ today: 150, week: 350, all: 1350 })
  })
})

describe('dailySeconds', () => {
  it('lists the last 14 days, oldest first, with zero for days off', () => {
    const days = dailySeconds(WEEK, TODAY)
    expect(days).toHaveLength(14)
    expect(days[0]).toEqual({ date: '2026-09-14', seconds: 0 })
    expect(days[6]).toEqual({ date: '2026-09-20', seconds: 1000 })
    expect(days[7]).toEqual({ date: '2026-09-21', seconds: 200 })
    expect(days[13]).toEqual({ date: TODAY, seconds: 150 })
  })
})

describe('pageSecondsThisWeek', () => {
  it('sums each page over this week, most practised first', () => {
    expect(pageSecondsThisWeek(WEEK, TODAY)).toEqual([
      { pageId: 'bend', seconds: 200 },
      { pageId: 'tuner', seconds: 100 },
      { pageId: 'echo', seconds: 50 },
    ])
  })
})

describe('recentSessions', () => {
  it('returns the last 10, newest first', () => {
    const log: PracticeLog = {
      days: {},
      sessions: Array.from({ length: 12 }, (_, i) => ({
        date: TODAY,
        game: 'echo',
        score: i,
        max: 2000,
      })),
    }
    expect(recentSessions(log).map((s) => s.score)).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
  })
})

describe('formatDuration', () => {
  it('uses seconds, then minutes, then hours and minutes', () => {
    expect(formatDuration(0)).toBe('0 s')
    expect(formatDuration(45)).toBe('45 s')
    expect(formatDuration(59.6)).toBe('1 min')
    expect(formatDuration(754)).toBe('12 min')
    expect(formatDuration(3600)).toBe('1 h 00 min')
    expect(formatDuration(3900)).toBe('1 h 05 min')
    expect(formatDuration(37000)).toBe('10 h 16 min')
  })
})
```

`src/core/log/activeClock.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ActiveClock } from './activeClock'

describe('ActiveClock', () => {
  it('has nothing to report while stopped', () => {
    const clock = new ActiveClock()
    expect(clock.running).toBe(false)
    expect(clock.flush(1000)).toBeNull()
    expect(clock.stop(1000)).toBeNull()
  })

  it('hands out the time since the last flush, and nothing once stopped', () => {
    const clock = new ActiveClock()
    clock.start(1000)
    expect(clock.flush(16000)).toEqual({ startMs: 1000, endMs: 16000 })
    expect(clock.flush(31000)).toEqual({ startMs: 16000, endMs: 31000 })
    expect(clock.stop(35000)).toEqual({ startMs: 31000, endMs: 35000 })
    expect(clock.running).toBe(false)
    expect(clock.flush(40000)).toBeNull()
  })

  it('ignores start() while already running', () => {
    const clock = new ActiveClock()
    clock.start(0)
    clock.start(5000)
    expect(clock.stop(10000)).toEqual({ startMs: 0, endMs: 10000 })
  })

  it('counts at most the last 30 s of a long gap (the computer slept)', () => {
    const clock = new ActiveClock()
    clock.start(0)
    expect(clock.flush(3_600_000)).toEqual({ startMs: 3_570_000, endMs: 3_600_000 })
  })

  it('survives the clock going backwards', () => {
    const clock = new ActiveClock()
    clock.start(10000)
    expect(clock.flush(5000)).toBeNull()
    expect(clock.flush(8000)).toEqual({ startMs: 5000, endMs: 8000 })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/log`
Expected: FAIL — none of the four modules exist.

- [ ] **Step 3: Write the date helpers**

`src/core/log/dates.ts`:

```ts
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const DAY_MS = 86_400_000
const pad = (n: number) => String(n).padStart(2, '0')

/** The local calendar date of a timestamp, as `YYYY-MM-DD`. */
export function localDate(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Arithmetic on date strings goes through UTC midnight, so DST changes can't shift a day.
const toUtc = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
const fromUtc = (ms: number) => {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY_MS)
}

/** The Monday of `date`'s week. */
export function weekStart(date: string): string {
  const weekday = new Date(toUtc(date)).getUTCDay() // 0 = Sunday
  return addDays(date, -((weekday + 6) % 7))
}

/** A span of practice split at local midnights, in seconds per date. */
export function secondsByDay(startMs: number, endMs: number): { date: string; seconds: number }[] {
  const out: { date: string; seconds: number }[] = []
  let t = startMs
  while (t < endMs) {
    const d = new Date(t)
    const nextMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime()
    const end = Math.min(endMs, nextMidnight)
    out.push({ date: localDate(t), seconds: (end - t) / 1000 })
    t = end
  }
  return out
}
```

- [ ] **Step 4: Write the log model**

`src/core/log/logModel.ts`:

```ts
import { DATE_RE } from './dates'

export interface SessionEntry {
  readonly date: string
  readonly game: string
  readonly score: number
  readonly max: number
}

export interface PracticeLog {
  /** `days[date][pageId]` = seconds practised on that page that day. */
  readonly days: Readonly<Record<string, Readonly<Record<string, number>>>>
  /** Finished scored sessions, oldest first. */
  readonly sessions: readonly SessionEntry[]
}

export const MAX_SESSIONS = 200

export function emptyLog(): PracticeLog {
  return { days: {}, sessions: [] }
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isAmount = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0

function cleanSession(v: unknown): SessionEntry | null {
  if (!isObject(v)) return null
  const { date, game, score, max } = v
  if (typeof date !== 'string' || !DATE_RE.test(date)) return null
  if (typeof game !== 'string' || game === '') return null
  if (!isAmount(score) || !isAmount(max)) return null
  return { date, game, score, max }
}

/** Anything read from storage → a valid log; bad entries are dropped one by one. */
export function sanitizeLog(raw: unknown): PracticeLog {
  if (!isObject(raw)) return emptyLog()
  const days: Record<string, Record<string, number>> = {}
  if (isObject(raw.days)) {
    for (const [date, pages] of Object.entries(raw.days)) {
      if (!DATE_RE.test(date) || !isObject(pages)) continue
      const kept: Record<string, number> = {}
      for (const [pageId, seconds] of Object.entries(pages)) {
        if (pageId !== '' && isAmount(seconds) && seconds > 0) kept[pageId] = seconds
      }
      if (Object.keys(kept).length > 0) days[date] = kept
    }
  }
  const sessions = Array.isArray(raw.sessions)
    ? raw.sessions
        .map(cleanSession)
        .filter((s): s is SessionEntry => s !== null)
        .slice(-MAX_SESSIONS)
    : []
  return { days, sessions }
}

export function addPractice(
  log: PracticeLog,
  date: string,
  pageId: string,
  seconds: number,
): PracticeLog {
  if (!(seconds > 0)) return log
  const day = log.days[date] ?? {}
  // Tenths of a second are plenty, and keep the stored JSON short.
  const total = Math.round(((day[pageId] ?? 0) + seconds) * 10) / 10
  return { ...log, days: { ...log.days, [date]: { ...day, [pageId]: total } } }
}

export function addSession(log: PracticeLog, entry: SessionEntry): PracticeLog {
  return { ...log, sessions: [...log.sessions, entry].slice(-MAX_SESSIONS) }
}
```

- [ ] **Step 5: Write the statistics**

`src/core/log/stats.ts`:

```ts
import { addDays, weekStart } from './dates'
import type { PracticeLog, SessionEntry } from './logModel'

/** Spec §5: a day counts towards a streak with at least this much practice. */
export const STREAK_MIN_SECONDS = 60

export function dayTotal(log: PracticeLog, date: string): number {
  return Object.values(log.days[date] ?? {}).reduce((sum, s) => sum + s, 0)
}

const practised = (log: PracticeLog, date: string) => dayTotal(log, date) >= STREAK_MIN_SECONDS

/** Current streak ends today or yesterday (today isn't over); longest is the best run ever. */
export function streaks(log: PracticeLog, today: string): { current: number; longest: number } {
  let current = 0
  let day = practised(log, today) ? today : addDays(today, -1)
  while (practised(log, day)) {
    current++
    day = addDays(day, -1)
  }

  let longest = 0
  let run = 0
  let previous: string | null = null
  const dates = Object.keys(log.days)
    .filter((d) => practised(log, d))
    .sort()
  for (const date of dates) {
    run = previous !== null && addDays(previous, 1) === date ? run + 1 : 1
    longest = Math.max(longest, run)
    previous = date
  }
  return { current, longest }
}

const inThisWeek = (date: string, today: string) => date >= weekStart(today) && date <= today

export function totals(
  log: PracticeLog,
  today: string,
): { today: number; week: number; all: number } {
  let week = 0
  let all = 0
  for (const date of Object.keys(log.days)) {
    const total = dayTotal(log, date)
    all += total
    if (inThisWeek(date, today)) week += total
  }
  return { today: dayTotal(log, today), week, all }
}

/** The last `count` days up to today, oldest first. */
export function dailySeconds(
  log: PracticeLog,
  today: string,
  count = 14,
): { date: string; seconds: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(today, i - count + 1)
    return { date, seconds: dayTotal(log, date) }
  })
}

export function pageSecondsThisWeek(
  log: PracticeLog,
  today: string,
): { pageId: string; seconds: number }[] {
  const byPage = new Map<string, number>()
  for (const [date, pages] of Object.entries(log.days)) {
    if (!inThisWeek(date, today)) continue
    for (const [pageId, seconds] of Object.entries(pages)) {
      byPage.set(pageId, (byPage.get(pageId) ?? 0) + seconds)
    }
  }
  return [...byPage]
    .map(([pageId, seconds]) => ({ pageId, seconds }))
    .sort((a, b) => b.seconds - a.seconds || a.pageId.localeCompare(b.pageId))
}

export function recentSessions(log: PracticeLog, count = 10): SessionEntry[] {
  return log.sessions.slice(-count).reverse()
}

/** "45 s", "12 min", "1 h 05 min". */
export function formatDuration(seconds: number): string {
  const s = Math.round(seconds)
  if (s < 60) return `${s} s`
  const minutes = Math.floor(s / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`
}
```

- [ ] **Step 6: Write the active clock**

`src/core/log/activeClock.ts`:

```ts
export interface Span {
  readonly startMs: number
  readonly endMs: number
}

/** A span longer than this means the computer slept or the clock jumped (flushes are 15 s). */
export const MAX_SPAN_MS = 30_000

/** Accumulates "active" time; the practice timer flushes it into the log as spans. */
export class ActiveClock {
  private since: number | null = null

  get running(): boolean {
    return this.since !== null
  }

  start(nowMs: number): void {
    if (this.since === null) this.since = nowMs
  }

  /** The time since the last flush (at most MAX_SPAN_MS); keeps running from `nowMs`. */
  flush(nowMs: number): Span | null {
    if (this.since === null) return null
    const from = this.since
    this.since = nowMs
    if (nowMs <= from) return null
    return { startMs: Math.max(from, nowMs - MAX_SPAN_MS), endMs: nowMs }
  }

  stop(nowMs: number): Span | null {
    const span = this.flush(nowMs)
    this.since = null
    return span
  }
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/core/log && npm run typecheck`
Expected: PASS; no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/core/log
git commit -m "feat(core): practice log model — dates, streaks, totals, active clock"
```

---
### Task 6: Log storage and the practice timer hook

**Files:**
- Create: `src/ui/log/practiceLog.ts`, `src/ui/hooks/usePracticeTimer.ts`
- Modify: `src/audio/AudioEngine.ts` (`unlock()` notifies)
- Test: `src/ui/log/practiceLog.test.ts`, `src/ui/hooks/usePracticeTimer.test.tsx`, `src/audio/AudioEngine.test.ts` (append)

**Interfaces:**
- Consumes: `secondsByDay`, `localDate` (Task 5), `PracticeLog`, `SessionEntry`, `emptyLog`, `sanitizeLog`, `addPractice`, `addSession` (Task 5), `ActiveClock`, `Span` (Task 5), `browserStorage()` (settings.ts), `audioEngine.isUnlocked`, `audioEngine.onStateChange` (AudioEngine.ts)
- Produces:
  - `LOG_KEY = 'harp-tools:log'`
  - `loadLog(storage: Pick<Storage, 'getItem'> | null): PracticeLog`
  - `saveLog(storage: Pick<Storage, 'setItem'> | null, log: PracticeLog): boolean`
  - `recordPractice(storage: Pick<Storage, 'getItem' | 'setItem'> | null, pageId: string, startMs: number, endMs: number): void`
  - `appendSession(storage: Pick<Storage, 'getItem' | 'setItem'> | null, entry: Omit<SessionEntry, 'date'>, nowMs: number): void`
  - `clearLog(storage: Pick<Storage, 'removeItem'> | null): void`
  - `FLUSH_MS = 15_000`; `usePracticeTimer(pageId: string, opts?: { requireAudio?: boolean }): void` (`requireAudio` defaults to `true`)

Spec §5. The hook is active while `document.visibilityState === 'visible'` and, unless `requireAudio: false`, while `audioEngine.isUnlocked`. It re-checks on `visibilitychange`, on audio state changes, on `pageshow` and on every 15 s tick. It saves on the tick, on becoming inactive, on `pagehide` and on unmount. Decision 8: `AudioEngine.unlock()` now notifies its listeners at the end. Without that, a context that is already `'running'` when created (Chrome in a click handler fires no `statechange`) would stay uncounted until the next tick.

- [ ] **Step 1: Write the failing tests**

`src/ui/log/practiceLog.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { emptyLog } from '../../core/log/logModel'
import {
  LOG_KEY,
  appendSession,
  clearLog,
  loadLog,
  recordPractice,
  saveLog,
} from './practiceLog'

function memoryStorage(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial }
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v
    },
    removeItem: (k: string) => {
      delete data[k]
    },
  }
}

const throwing = {
  getItem: () => {
    throw new Error('SecurityError')
  },
  setItem: () => {
    throw new Error('QuotaExceededError')
  },
  removeItem: () => {
    throw new Error('SecurityError')
  },
}

const at = (h: number, m: number, s: number, day = 27) => new Date(2026, 8, day, h, m, s).getTime()

describe('loadLog', () => {
  it('is empty without storage, without data, or for corrupt data', () => {
    expect(loadLog(null)).toEqual(emptyLog())
    expect(loadLog(memoryStorage())).toEqual(emptyLog())
    expect(loadLog(memoryStorage({ [LOG_KEY]: '{nope' }))).toEqual(emptyLog())
    expect(loadLog(memoryStorage({ [LOG_KEY]: '[1,2,3]' }))).toEqual(emptyLog())
    expect(loadLog(throwing)).toEqual(emptyLog())
  })
  it('repairs what it can', () => {
    const s = memoryStorage({
      [LOG_KEY]: JSON.stringify({ days: { '2026-09-27': { tuner: 30, echo: 'x' } } }),
    })
    expect(loadLog(s)).toEqual({ days: { '2026-09-27': { tuner: 30 } }, sessions: [] })
  })
})

describe('recordPractice', () => {
  it('adds a span to the day it happened in', () => {
    const s = memoryStorage()
    recordPractice(s, 'tuner', at(10, 0, 0), at(10, 0, 15))
    recordPractice(s, 'tuner', at(10, 0, 15), at(10, 0, 30))
    expect(loadLog(s).days).toEqual({ '2026-09-27': { tuner: 30 } })
  })
  it('splits a span that crosses midnight', () => {
    const s = memoryStorage()
    recordPractice(s, 'echo', at(23, 59, 50), at(0, 0, 5, 28))
    expect(loadLog(s).days).toEqual({
      '2026-09-27': { echo: 10 },
      '2026-09-28': { echo: 5 },
    })
  })
  it('never throws, even when storage does', () => {
    expect(() => recordPractice(throwing, 'tuner', at(10, 0, 0), at(10, 0, 15))).not.toThrow()
    expect(() => recordPractice(null, 'tuner', at(10, 0, 0), at(10, 0, 15))).not.toThrow()
  })
})

describe('appendSession', () => {
  it('stamps the local date and appends the session', () => {
    const s = memoryStorage()
    appendSession(s, { game: 'echo', score: 1450, max: 2000 }, at(21, 0, 0))
    expect(loadLog(s).sessions).toEqual([
      { date: '2026-09-27', game: 'echo', score: 1450, max: 2000 },
    ])
  })
  it('never throws, even when storage does', () => {
    expect(() => appendSession(throwing, { game: 'echo', score: 1, max: 2 }, 0)).not.toThrow()
  })
})

describe('saveLog and clearLog', () => {
  it('report a failed write and tolerate storage that throws', () => {
    expect(saveLog(throwing, emptyLog())).toBe(false)
    expect(saveLog(null, emptyLog())).toBe(false)
    expect(() => clearLog(throwing)).not.toThrow()
  })
  it('clear the whole log', () => {
    const s = memoryStorage()
    expect(saveLog(s, { days: { '2026-09-27': { tuner: 5 } }, sessions: [] })).toBe(true)
    clearLog(s)
    expect(s.data[LOG_KEY]).toBeUndefined()
    expect(loadLog(s)).toEqual(emptyLog())
  })
})
```

`src/ui/hooks/usePracticeTimer.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { audioEngine } from '../../audio/AudioEngine'
import { loadLog } from '../log/practiceLog'
import { usePracticeTimer } from './usePracticeTimer'

let visibility: DocumentVisibilityState = 'visible'
let unlocked = false
let audioListeners = new Set<() => void>()

const setVisibility = (v: DocumentVisibilityState) => {
  visibility = v
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}
const setUnlocked = (u: boolean) => {
  unlocked = u
  act(() => audioListeners.forEach((l) => l()))
}
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))
const seconds = (pageId: string, date = '2026-09-27') =>
  loadLog(localStorage).days[date]?.[pageId] ?? 0

describe('usePracticeTimer', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 27, 10, 0, 0))
    visibility = 'visible'
    unlocked = false
    audioListeners = new Set()
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
    vi.spyOn(audioEngine, 'isUnlocked', 'get').mockImplementation(() => unlocked)
    vi.spyOn(audioEngine, 'onStateChange').mockImplementation((listener) => {
      audioListeners.add(listener)
      return () => {
        audioListeners.delete(listener)
      }
    })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('counts visible time on a page without audio, saving every 15 s', () => {
    renderHook(() => usePracticeTimer('quiz', { requireAudio: false }))
    advance(14_000)
    expect(seconds('quiz')).toBe(0)
    advance(1_000)
    expect(seconds('quiz')).toBe(15)
    advance(15_000)
    expect(seconds('quiz')).toBe(30)
  })

  it('does not count time while the page is hidden', () => {
    renderHook(() => usePracticeTimer('quiz', { requireAudio: false }))
    advance(5_000)
    setVisibility('hidden')
    expect(seconds('quiz')).toBe(5)
    advance(60_000)
    expect(seconds('quiz')).toBe(5)
    setVisibility('visible') // at 65 s; the next tick is at 75 s
    advance(10_000)
    expect(seconds('quiz')).toBe(15)
  })

  it('by default waits until audio is unlocked, and stops when it is suspended', () => {
    renderHook(() => usePracticeTimer('tuner'))
    advance(30_000)
    expect(seconds('tuner')).toBe(0)
    setUnlocked(true)
    advance(15_000)
    expect(seconds('tuner')).toBe(15)
    advance(5_000)
    setUnlocked(false)
    expect(seconds('tuner')).toBe(20)
    advance(30_000)
    expect(seconds('tuner')).toBe(20)
  })

  it('saves the last partial span on unmount', () => {
    const { unmount } = renderHook(() => usePracticeTimer('quiz', { requireAudio: false }))
    advance(5_000)
    unmount()
    expect(seconds('quiz')).toBe(5)
    advance(30_000)
    expect(seconds('quiz')).toBe(5)
  })

  it('saves on pagehide and resumes on pageshow', () => {
    renderHook(() => usePracticeTimer('quiz', { requireAudio: false }))
    advance(3_000)
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(seconds('quiz')).toBe(3)
    act(() => {
      window.dispatchEvent(new Event('pageshow'))
    })
    advance(15_000)
    expect(seconds('quiz')).toBe(15)
  })

  it('gives time after midnight to the new day', () => {
    vi.setSystemTime(new Date(2026, 8, 27, 23, 59, 55))
    renderHook(() => usePracticeTimer('quiz', { requireAudio: false }))
    advance(15_000)
    expect(seconds('quiz', '2026-09-27')).toBe(5)
    expect(seconds('quiz', '2026-09-28')).toBe(10)
  })
})
```

In the pageshow test, the interval started at mount keeps ticking every 15 s from t = 0. The `pagehide` at 3 s saves 3 s, `pageshow` restarts the clock, and the tick at 15 s saves 12 s, for 15 s in total.

Append to `src/audio/AudioEngine.test.ts`, inside `describe('AudioEngine', …)`:

```ts
  it('tells listeners when unlock() succeeds, even if the context starts out running', async () => {
    class RunningContext extends FakeAudioContext {
      state: AudioContextState = 'running'
    }
    vi.stubGlobal('AudioContext', RunningContext)
    const engine = new AudioEngine()
    const listener = vi.fn()
    engine.onStateChange(listener)
    await engine.unlock()
    expect(engine.isUnlocked).toBe(true)
    expect(listener).toHaveBeenCalled()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/log src/ui/hooks/usePracticeTimer.test.tsx src/audio/AudioEngine.test.ts`
Expected: FAIL — `./practiceLog` and `./usePracticeTimer` cannot be resolved; the new AudioEngine test fails because the listener is never called.

- [ ] **Step 3: Notify on unlock**

In `src/audio/AudioEngine.ts`, at the end of `unlock()`, after `this.resumeFailed = false`, add:

```ts
    // A context created already running fires no statechange; tell listeners either way.
    this.notify()
```

- [ ] **Step 4: Write the storage functions**

`src/ui/log/practiceLog.ts`:

```ts
import { localDate, secondsByDay } from '../../core/log/dates'
import {
  addPractice,
  addSession,
  emptyLog,
  sanitizeLog,
  type PracticeLog,
  type SessionEntry,
} from '../../core/log/logModel'

export const LOG_KEY = 'harp-tools:log'

export function loadLog(storage: Pick<Storage, 'getItem'> | null): PracticeLog {
  try {
    const text = storage?.getItem(LOG_KEY)
    return text ? sanitizeLog(JSON.parse(text)) : emptyLog()
  } catch {
    return emptyLog()
  }
}

/** False when there is no storage or the write failed (full or blocked). */
export function saveLog(storage: Pick<Storage, 'setItem'> | null, log: PracticeLog): boolean {
  if (!storage) return false
  try {
    storage.setItem(LOG_KEY, JSON.stringify(log))
    return true
  } catch {
    return false
  }
}

/** Adds a span of practice on `pageId`, split at local midnight (spec §5). */
export function recordPractice(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  pageId: string,
  startMs: number,
  endMs: number,
): void {
  const pieces = secondsByDay(startMs, endMs)
  if (!storage || pieces.length === 0) return
  let log = loadLog(storage)
  for (const { date, seconds } of pieces) log = addPractice(log, date, pageId, seconds)
  saveLog(storage, log)
}

/** Logs a finished scored session, dated by the local day of `nowMs`. */
export function appendSession(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  entry: Omit<SessionEntry, 'date'>,
  nowMs: number,
): void {
  if (!storage) return
  saveLog(storage, addSession(loadLog(storage), { date: localDate(nowMs), ...entry }))
}

export function clearLog(storage: Pick<Storage, 'removeItem'> | null): void {
  try {
    storage?.removeItem(LOG_KEY)
  } catch {
    // Blocked storage: there is nothing we can clear.
  }
}
```

- [ ] **Step 5: Write the timer hook**

`src/ui/hooks/usePracticeTimer.ts`:

```ts
import { useEffect } from 'react'
import { audioEngine } from '../../audio/AudioEngine'
import { ActiveClock, type Span } from '../../core/log/activeClock'
import { recordPractice } from '../log/practiceLog'
import { browserStorage } from '../settings/settings'

/** Spec §5: practice time is saved this often while it runs. */
export const FLUSH_MS = 15_000

/**
 * Logs time spent on `pageId` while the page is visible and — unless `requireAudio` is false —
 * audio is unlocked, so a page just left open behind "Tap to start audio" doesn't count.
 */
export function usePracticeTimer(pageId: string, opts: { requireAudio?: boolean } = {}): void {
  const requireAudio = opts.requireAudio ?? true

  useEffect(() => {
    const clock = new ActiveClock()
    const save = (span: Span | null) => {
      if (span) recordPractice(browserStorage(), pageId, span.startMs, span.endMs)
    }
    const isActive = () =>
      document.visibilityState === 'visible' && (!requireAudio || audioEngine.isUnlocked)
    // Saves what has run so far, then keeps running only while still active.
    const sync = () => {
      const now = Date.now()
      if (isActive()) {
        save(clock.flush(now))
        clock.start(now)
      } else {
        save(clock.stop(now))
      }
    }
    const hide = () => save(clock.stop(Date.now()))

    sync()
    const timer = setInterval(sync, FLUSH_MS)
    const offAudio = audioEngine.onStateChange(sync)
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('pageshow', sync)
    window.addEventListener('pagehide', hide)
    return () => {
      clearInterval(timer)
      offAudio()
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('pageshow', sync)
      window.removeEventListener('pagehide', hide)
      hide()
    }
  }, [pageId, requireAudio])
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/ui/log src/ui/hooks src/audio src/ui/components/AudioGate.test.tsx && npm run typecheck && npm run lint`
Expected: PASS; no type or lint errors. The `AudioGate` tests still pass: the extra notification only confirms the unlocked state it already set.

- [ ] **Step 7: Commit**

```bash
git add src/ui/log src/ui/hooks/usePracticeTimer.ts src/ui/hooks/usePracticeTimer.test.tsx src/audio/AudioEngine.ts src/audio/AudioEngine.test.ts
git commit -m "feat(log): storage-tolerant practice log and a visible-time practice timer"
```

---
### Task 7: Scored sessions go to the log; existing pages count practice time

**Files:**
- Modify: `src/ui/hooks/useScoring.ts`
- Modify: `src/ui/pages/tuner/TunerPage.tsx`, `src/ui/pages/metronome/MetronomePage.tsx`, `src/ui/pages/echo/EchoNotePage.tsx`, `src/ui/pages/bend/BendTrainerPage.tsx`, `src/ui/pages/scales/ScaleRunnerPage.tsx`, `src/ui/pages/intervals/IntervalsPage.tsx`, `src/ui/pages/melody/MelodyEchoPage.tsx`
- Test: `src/ui/hooks/useScoring.test.tsx` (append), `src/ui/App.test.tsx` (append)

**Interfaces:**
- Consumes: `appendSession` (Task 6), `usePracticeTimer` (Task 6), `maxScore(s: SessionState): number` (session.ts)
- Produces: `useScoring` (signature unchanged) calls `appendSession(browserStorage(), { game, score, max }, Date.now())` once per finished scored session, where `game` is the first `|` segment of `bestKey`

Decision 9: the game id comes from the best-score key (`bestScoreKey` always starts with it), so no caller changes. Every finished scored session is logged, including one that scored 0; practice is never logged. The page ids are the route names without the slash: `tuner`, `metronome`, `echo`, `bend`, `scales`, `intervals`, `melody`. All of these pages make or hear sound, so they use the default `requireAudio: true`.

- [ ] **Step 1: Write the failing tests**

Append to `src/ui/hooks/useScoring.test.tsx` (add `import { localDate } from '../../core/log/dates'` and `import { loadLog } from '../log/practiceLog'` at the top):

```tsx
describe('useScoring — practice log', () => {
  it('logs every finished scored session, including a zero score', () => {
    const { result } = renderHook(() => useScoring('scored', 'echo|key=C', 2))
    act(() => {
      result.current.record({ correct: true, points: 150 })
    })
    expect(loadLog(localStorage).sessions).toEqual([])
    act(() => {
      result.current.record({ correct: false, points: 0 })
    })
    expect(loadLog(localStorage).sessions).toEqual([
      { date: localDate(Date.now()), game: 'echo', score: 150, max: 400 },
    ])

    const zero = renderHook(() => useScoring('scored', 'quiz|task=name', 1))
    act(() => {
      zero.result.current.record({ correct: false, points: 0 })
    })
    expect(loadLog(localStorage).sessions[1]).toMatchObject({ game: 'quiz', score: 0, max: 200 })
  })

  it('logs a finished session once, even if more rounds are recorded after it', () => {
    const { result } = renderHook(() => useScoring('scored', 'bend|key=C', 1))
    act(() => {
      result.current.record({ correct: true, points: 100 })
      result.current.record({ correct: true, points: 100 })
    })
    expect(loadLog(localStorage).sessions).toHaveLength(1)
  })

  it('never logs practice', () => {
    const { result } = renderHook(() => useScoring('practice', 'echo|key=C', 2))
    act(() => {
      for (let i = 0; i < 5; i++) result.current.record({ correct: true, points: 100 })
    })
    expect(loadLog(localStorage).sessions).toEqual([])
  })
})
```

Append to `src/ui/App.test.tsx`. Add at the top of the file, after the imports:

```tsx
import { beforeEach, vi } from 'vitest'

const timers = vi.hoisted(() => ({
  calls: [] as [string, { requireAudio?: boolean } | undefined][],
}))
vi.mock('./hooks/usePracticeTimer', () => ({
  usePracticeTimer: (pageId: string, opts?: { requireAudio?: boolean }) => {
    timers.calls.push([pageId, opts])
  },
}))
```

(merge `beforeEach` and `vi` into the existing `import { afterEach, describe, expect, it } from 'vitest'` line), and add a new block at the end:

```tsx
describe('practice time', () => {
  beforeEach(() => {
    timers.calls = []
  })

  it.each([
    ['#/tuner', 'tuner'],
    ['#/metronome', 'metronome'],
    ['#/echo', 'echo'],
    ['#/bend', 'bend'],
    ['#/scales', 'scales'],
    ['#/intervals', 'intervals'],
    ['#/melody', 'melody'],
  ])('%s counts practice time under "%s", only while audio runs', (hash, pageId) => {
    window.location.hash = hash
    render(<App />)
    expect(timers.calls).toContainEqual([pageId, undefined])
  })

  it('the home page does not count practice time', () => {
    window.location.hash = '#/'
    render(<App />)
    expect(timers.calls).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/hooks/useScoring.test.tsx src/ui/App.test.tsx`
Expected: FAIL — no sessions are logged; no page calls `usePracticeTimer`.

- [ ] **Step 3: Log finished sessions**

In `src/ui/hooks/useScoring.ts`, change the session import to add `maxScore`:

```ts
import {
  SCORED_ROUNDS,
  isFinished,
  maxScore,
  recordRound,
  sessionScore,
  startSession,
  type GameMode,
  type RoundResult,
  type SessionState,
} from '../../core/games/session'
```

add `import { appendSession } from '../log/practiceLog'`, and replace the `if (isFinished(next)) { … }` block inside `record` with:

```ts
    if (isFinished(next)) {
      const score = sessionScore(next)
      // Spec §5: every finished scored session goes to the practice log. The game id is the
      // best-score key's first segment ("echo|key=C|…" → "echo").
      appendSession(
        browserStorage(),
        { game: bestKey.split('|')[0], score, max: maxScore(next) },
        Date.now(),
      )
      if (score > 0 && saveBestIfHigher(browserStorage(), bestKey, score)) {
        setBest(score)
        setNewBest(true)
      }
    }
```

`recordRound` returns the same object for a finished session, and `record` returns early when `next === current`, so a finished session is logged only once.

- [ ] **Step 4: Call the timer from every existing tool and game page**

In each file, add the import `import { usePracticeTimer } from '../../hooks/usePracticeTimer'` and make the call the first statement of the page component (the exported `…Page` function, not the inner game component, so a run remount doesn't restart it):

| File | Component | Call |
|---|---|---|
| `pages/tuner/TunerPage.tsx` | `TunerPage` | `usePracticeTimer('tuner')` |
| `pages/metronome/MetronomePage.tsx` | `MetronomePage` | `usePracticeTimer('metronome')` |
| `pages/echo/EchoNotePage.tsx` | `EchoNotePage` | `usePracticeTimer('echo')` |
| `pages/bend/BendTrainerPage.tsx` | `BendTrainerPage` | `usePracticeTimer('bend')` |
| `pages/scales/ScaleRunnerPage.tsx` | `ScaleRunnerPage` | `usePracticeTimer('scales')` |
| `pages/intervals/IntervalsPage.tsx` | `IntervalsPage` | `usePracticeTimer('intervals')` |
| `pages/melody/MelodyEchoPage.tsx` | `MelodyEchoPage` | `usePracticeTimer('melody')` |

For example:

```tsx
export function EchoNotePage() {
  usePracticeTimer('echo')
  return (
    <GameLayout
      title="Echo the note"
      intro="Listen to a note, then play it back on your harp and hold it."
    >
      <EchoGame />
    </GameLayout>
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/ui && npm run typecheck && npm run lint`
Expected: PASS; no type or lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/ui/hooks/useScoring.ts src/ui/hooks/useScoring.test.tsx src/ui/App.test.tsx src/ui/pages
git commit -m "feat(log): log finished scored sessions; tools and games count practice time"
```

---

### Task 8: Home page as data-driven groups

**Files:**
- Create: `src/ui/pages/homeGroups.ts`
- Modify: `src/ui/pages/HomePage.tsx` (full replacement)
- Test: `src/ui/pages/homeGroups.test.ts`, `src/ui/App.test.tsx` (replace the first test)

**Interfaces:**
- Consumes: nothing
- Produces:
  - `interface HomeEntry { readonly id: string; readonly icon: string; readonly title: string; readonly text: string }` — `id` is the route without its slash and the practice-timer page id
  - `type HomeGroupId = 'tools' | 'games' | 'jam' | 'progress'`
  - `interface HomeGroup { readonly id: HomeGroupId; readonly title: string; readonly entries: readonly HomeEntry[] }`
  - `HOME_GROUPS: readonly HomeGroup[]` (Tools, Games, Jam, Progress, in that order)
  - `entryHref(entry: HomeEntry): string` → `#/${entry.id}`
  - `pageTitle(pageId: string): string` — the entry's title, or `pageId` if there's none

Spec §0. Plan 4 appends its entries to the `entries` arrays in `homeGroups.ts`. Decision 11: a group with no entries isn't rendered, so "Jam" appears once Plan 4 adds the play-along. Decision 10: the log page names pages through `pageTitle`.

- [ ] **Step 1: Write the failing tests**

`src/ui/pages/homeGroups.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { HOME_GROUPS, entryHref, pageTitle } from './homeGroups'

describe('HOME_GROUPS', () => {
  it('lists the pages in four groups', () => {
    expect(HOME_GROUPS.map((g) => [g.id, g.title, g.entries.map((e) => e.id)])).toEqual([
      ['tools', 'Tools', ['tuner', 'metronome']],
      ['games', 'Games', ['echo', 'bend', 'scales', 'intervals', 'melody']],
      ['jam', 'Jam', []],
      ['progress', 'Progress', []],
    ])
  })

  it('uses each id once, as the route', () => {
    const ids = HOME_GROUPS.flatMap((g) => g.entries.map((e) => e.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(entryHref(HOME_GROUPS[0].entries[0])).toBe('#/tuner')
  })
})

describe('pageTitle', () => {
  it("names a page by its Home entry, falling back to the id", () => {
    expect(pageTitle('echo')).toBe('Echo the note')
    expect(pageTitle('tuner')).toBe('Tuner')
    expect(pageTitle('something-new')).toBe('something-new')
  })
})
```

In `src/ui/App.test.tsx`, add `import { HOME_GROUPS, entryHref } from './pages/homeGroups'` and replace the test `'shows the home page with links to the tools and games'` with these two:

```tsx
  it('shows the home page with one card list per non-empty group', () => {
    window.location.hash = '#/'
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/diatonic harmonica/i)
    for (const group of HOME_GROUPS) {
      if (group.entries.length === 0) {
        expect(screen.queryByRole('list', { name: group.title })).toBeNull()
        continue
      }
      // The header nav also links to some pages, so look inside the card list.
      const list = screen.getByRole('list', { name: group.title })
      expect(
        within(list)
          .getAllByRole('link')
          .map((a) => a.getAttribute('href')),
      ).toEqual(group.entries.map(entryHref))
    }
  })

  it.each(HOME_GROUPS.flatMap((g) => g.entries.map((e) => [entryHref(e), e.title])))(
    'the Home card %s opens its own page',
    (hash) => {
      window.location.hash = hash
      render(<App />)
      expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent(
        /diatonic harmonica/i,
      )
    },
  )
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/pages/homeGroups.test.ts src/ui/App.test.tsx`
Expected: FAIL — `./homeGroups` cannot be resolved.

- [ ] **Step 3: Write the groups**

`src/ui/pages/homeGroups.ts`:

```ts
export interface HomeEntry {
  /** The route without its slash (`#/echo`) and the page's practice-log id. */
  readonly id: string
  readonly icon: string
  readonly title: string
  readonly text: string
}

export type HomeGroupId = 'tools' | 'games' | 'jam' | 'progress'

export interface HomeGroup {
  readonly id: HomeGroupId
  readonly title: string
  readonly entries: readonly HomeEntry[]
}

/** Spec §0: the Home page, in order. New pages add their entry here. */
export const HOME_GROUPS: readonly HomeGroup[] = [
  {
    id: 'tools',
    title: 'Tools',
    entries: [
      {
        id: 'tuner',
        icon: '🎯',
        title: 'Tuner',
        text: 'See which hole and technique you are playing, or hear any note on your harp.',
      },
      {
        id: 'metronome',
        icon: '🥁',
        title: 'Metronome',
        text: 'Steady time with tap tempo, accents and subdivisions.',
      },
    ],
  },
  {
    id: 'games',
    title: 'Games',
    entries: [
      { id: 'echo', icon: '👂', title: 'Echo the note', text: 'Hear a note, then play it back.' },
      {
        id: 'bend',
        icon: '〰️',
        title: 'Bend trainer',
        text: 'Hit and hold a target bend on a live meter.',
      },
      {
        id: 'scales',
        icon: '🪜',
        title: 'Scale runner',
        text: 'Scales in 1st, 2nd and 3rd position.',
      },
      {
        id: 'intervals',
        icon: '🎼',
        title: 'Interval training',
        text: 'Name or play the interval you hear.',
      },
      {
        id: 'melody',
        icon: '🔁',
        title: 'Melody echo',
        text: 'Repeat phrases that grow as you improve.',
      },
    ],
  },
  { id: 'jam', title: 'Jam', entries: [] },
  { id: 'progress', title: 'Progress', entries: [] },
]

export function entryHref(entry: HomeEntry): string {
  return `#/${entry.id}`
}

export function pageTitle(pageId: string): string {
  for (const group of HOME_GROUPS) {
    const entry = group.entries.find((e) => e.id === pageId)
    if (entry) return entry.title
  }
  return pageId
}
```

- [ ] **Step 4: Render them**

Replace `src/ui/pages/HomePage.tsx` with:

```tsx
import { HOME_GROUPS, entryHref, type HomeEntry } from './homeGroups'
import styles from './HomePage.module.css'

function CardList({ label, cards }: { label: string; cards: readonly HomeEntry[] }) {
  return (
    <ul className={styles.cards} aria-label={label}>
      {cards.map((c) => (
        <li key={c.id}>
          <a href={entryHref(c)} className={styles.card}>
            <span className={styles.icon} aria-hidden>
              {c.icon}
            </span>
            <strong>{c.title}</strong>
            <span className={styles.text}>{c.text}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

export function HomePage() {
  return (
    <>
      <h1 className={styles.title}>Practice tools for diatonic harmonica</h1>
      <p className={styles.lead}>
        Pick your harp's key and tuning at the top — everything on the site follows them.
      </p>
      {HOME_GROUPS.filter((g) => g.entries.length > 0).map((g) => (
        <section key={g.id} aria-labelledby={`home-${g.id}`}>
          <h2 id={`home-${g.id}`}>{g.title}</h2>
          <CardList label={g.title} cards={g.entries} />
        </section>
      ))}
    </>
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/ui && npm run typecheck && npm run lint`
Expected: PASS; no type or lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/ui/pages/homeGroups.ts src/ui/pages/homeGroups.test.ts src/ui/pages/HomePage.tsx src/ui/App.test.tsx
git commit -m "refactor(home): data-driven Tools / Games / Jam / Progress groups"
```

---
### Task 9: Positions core — tonic for any position, harp for a song

**Files:**
- Modify: `src/core/harmonica/keys.ts`, `src/core/harmonica/positions.ts`, `src/core/music/noteNames.ts`
- Test: `src/core/harmonica/keys.test.ts` (append), `src/core/harmonica/positions.test.ts` (append), `src/core/music/noteNames.test.ts` (append)

**Interfaces:**
- Consumes: `HARP_KEYS`, `keyOffset` (keys.ts)
- Produces:
  - `keyForPitchClass(pc: number): HarpKey` — the key whose harp sits on pitch class `pc` (any integer, taken mod 12)
  - `pitchClassName(pc: number, spelling: Spelling = 'sharp'): string` — `'C#'` / `'Db'`, no octave
  - `positionTonicPc(harpKey: HarpKey, position: number): number` — positions 1–12, each a fifth above the last
  - `harpForPosition(songTonicPc: number, position: number): HarpKey`
  - `interface PositionInfo { readonly position: number; readonly mode: string; readonly use: string | null; readonly short: string }`
  - `POSITION_INFO: readonly PositionInfo[]` — positions 1, 2, 3, 4, 5, 12
  - `positionLabel(position: number): string` — `'1st'`, `'2nd'`, `'3rd'`, `'4th'`, `'12th'`
  - `positionRootPc(key, position: Position)` keeps its signature and now delegates to `positionTonicPc`

Spec §2. `short` is the word the "I have a … harp" panel uses after the tonic ("2nd G blues", "3rd D minor"). `use` is `null` where the spec's table shows "—".

- [ ] **Step 1: Write the failing tests**

Append to `src/core/harmonica/keys.test.ts` (add `keyForPitchClass` to its import from `./keys`):

```ts
describe('keyForPitchClass', () => {
  it('finds the harp key for each pitch class, wrapping any integer', () => {
    expect(keyForPitchClass(0)).toBe('C')
    expect(keyForPitchClass(7)).toBe('G')
    expect(keyForPitchClass(1)).toBe('Db')
    expect(keyForPitchClass(6)).toBe('F#')
    expect(keyForPitchClass(10)).toBe('Bb')
    expect(keyForPitchClass(-5)).toBe('G')
    expect(keyForPitchClass(19)).toBe('G')
  })
})
```

Append to `src/core/music/noteNames.test.ts` (add `pitchClassName` to its import from `./noteNames`):

```ts
describe('pitchClassName', () => {
  it('names a pitch class without an octave, in either spelling', () => {
    expect(pitchClassName(0)).toBe('C')
    expect(pitchClassName(1, 'sharp')).toBe('C#')
    expect(pitchClassName(1, 'flat')).toBe('Db')
    expect(pitchClassName(10, 'flat')).toBe('Bb')
    expect(pitchClassName(13)).toBe('C#')
  })
})
```

Append to `src/core/harmonica/positions.test.ts` (add `POSITION_INFO`, `harpForPosition`, `positionLabel` and `positionTonicPc` to its import from `./positions`):

```ts
describe('positionTonicPc', () => {
  it('moves up a fifth per position, through 12th', () => {
    expect([1, 2, 3, 4, 5, 12].map((p) => positionTonicPc('C', p))).toEqual([0, 7, 2, 9, 4, 5])
    expect(positionTonicPc('G', 2)).toBe(2)
    expect(positionTonicPc('F#', 12)).toBe(11)
  })
  it('agrees with positionRootPc for 1st–3rd', () => {
    for (const key of HARP_KEYS)
      for (const p of [1, 2, 3] as const) expect(positionRootPc(key, p)).toBe(positionTonicPc(key, p))
  })
})

describe('harpForPosition', () => {
  it('round-trips every key and listed position', () => {
    for (const key of HARP_KEYS) {
      for (const { position } of POSITION_INFO) {
        expect(harpForPosition(positionTonicPc(key, position), position)).toBe(key)
      }
    }
  })
  it('knows the classic choices', () => {
    expect(harpForPosition(7, 2)).toBe('C') // G blues → C harp
    expect(harpForPosition(9, 3)).toBe('G') // A minor in 3rd → G harp
    expect(harpForPosition(0, 1)).toBe('C') // C major in 1st → C harp
    expect(harpForPosition(9, 4)).toBe('C') // A natural minor in 4th → C harp
  })
})

describe('POSITION_INFO', () => {
  it('gives the mode and typical use of 1st–5th and 12th', () => {
    expect(POSITION_INFO.map((i) => [i.position, i.mode, i.use, i.short])).toEqual([
      [1, 'Ionian', 'major, folk', 'major'],
      [2, 'Mixolydian', 'blues, rock, country', 'blues'],
      [3, 'Dorian', 'minor blues', 'minor'],
      [4, 'Aeolian', 'natural minor', 'minor'],
      [5, 'Phrygian', null, 'Phrygian'],
      [12, 'Lydian', null, 'Lydian'],
    ])
  })
})

describe('positionLabel', () => {
  it('writes English ordinals', () => {
    expect([1, 2, 3, 4, 5, 11, 12].map(positionLabel)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '5th',
      '11th',
      '12th',
    ])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/harmonica src/core/music/noteNames.test.ts`
Expected: FAIL — the new functions are not exported.

- [ ] **Step 3: Add the key and name helpers**

Append to `src/core/harmonica/keys.ts`:

```ts
const mod12 = (n: number) => ((n % 12) + 12) % 12

/** The key whose harp is pitched on pitch class `pc` (0 = C); any integer is taken mod 12. */
export function keyForPitchClass(pc: number): HarpKey {
  const target = mod12(pc)
  const key = HARP_KEYS.find((k) => mod12(OFFSETS[k]) === target)
  if (!key) throw new Error(`no harp key for pitch class ${pc}`) // unreachable: offsets cover all 12
  return key
}
```

Append to `src/core/music/noteNames.ts`:

```ts
/** A pitch class name without octave, e.g. 1 → 'C#' or 'Db'. */
export function pitchClassName(pc: number, spelling: Spelling = 'sharp'): string {
  const i = ((pc % 12) + 12) % 12
  return (spelling === 'flat' ? FLAT_NAMES : SHARP_NAMES)[i]
}
```

- [ ] **Step 4: Add the position functions**

In `src/core/harmonica/positions.ts`, change the keys import to:

```ts
import { keyForPitchClass, keyOffset, type HarpKey } from './keys'
```

and replace the existing `positionRootPc` function with:

```ts
/** Tonic pitch class (0 = C) of `position` (1–12) on a `harpKey` harp: each is a fifth higher. */
export function positionTonicPc(harpKey: HarpKey, position: number): number {
  return (((keyOffset(harpKey) + 7 * (position - 1)) % 12) + 12) % 12
}

/** Tonic pitch class for `key` played in `position`: each position is a fifth higher. */
export function positionRootPc(key: HarpKey, position: Position): number {
  return positionTonicPc(key, position)
}

/** The harp to play a song whose tonic is `songTonicPc` in `position`. */
export function harpForPosition(songTonicPc: number, position: number): HarpKey {
  return keyForPitchClass(songTonicPc - 7 * (position - 1))
}

export interface PositionInfo {
  readonly position: number
  readonly mode: string
  /** Spec §2's "typical use"; null where it has none. */
  readonly use: string | null
  /** One word after the tonic in "2nd G blues". */
  readonly short: string
}

export const POSITION_INFO: readonly PositionInfo[] = [
  { position: 1, mode: 'Ionian', use: 'major, folk', short: 'major' },
  { position: 2, mode: 'Mixolydian', use: 'blues, rock, country', short: 'blues' },
  { position: 3, mode: 'Dorian', use: 'minor blues', short: 'minor' },
  { position: 4, mode: 'Aeolian', use: 'natural minor', short: 'minor' },
  { position: 5, mode: 'Phrygian', use: null, short: 'Phrygian' },
  { position: 12, mode: 'Lydian', use: null, short: 'Lydian' },
]

/** '1st', '2nd', '3rd', '4th' … '11th', '12th'. */
export function positionLabel(position: number): string {
  const tens = position % 100
  const ones = position % 10
  const suffix =
    tens >= 11 && tens <= 13 ? 'th' : ones === 1 ? 'st' : ones === 2 ? 'nd' : ones === 3 ? 'rd' : 'th'
  return `${position}${suffix}`
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/core && npm run typecheck`
Expected: PASS; no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/harmonica/keys.ts src/core/harmonica/keys.test.ts src/core/harmonica/positions.ts src/core/harmonica/positions.test.ts src/core/music/noteNames.ts src/core/music/noteNames.test.ts
git commit -m "feat(core): positions 1–12, harp for a song key, position info"
```

---

### Task 10: Positions & keys page

**Files:**
- Create: `src/ui/pages/positions/PositionsPage.tsx`, `src/ui/pages/positions/PositionsPage.module.css`
- Modify: `src/ui/App.tsx` (route), `src/ui/pages/homeGroups.ts` (Tools entry)
- Test: `src/ui/pages/positions/PositionsPage.test.tsx`, `src/ui/pages/homeGroups.test.ts` (update), `src/ui/App.test.tsx` (append)

**Interfaces:**
- Consumes: `keyForPitchClass`, `pitchClassName`, `positionTonicPc`, `harpForPosition`, `POSITION_INFO`, `positionLabel` (Task 9); `HARP_KEYS`, `keySpelling` (keys.ts); `usePracticeTimer` (Task 6); `layoutShape` (src/test/layout.ts)
- Produces: `PositionsPage()` at `#/positions`; Home entry `{ id: 'positions', icon: '🧭', title: 'Positions & keys', … }` in Tools

Spec §2: no audio, so the timer counts visible time (`requireAudio: false`) and there's no `AudioGate`. Decision 4: song keys use key-name spelling; the harp panel spells tonics with the harp's own spelling; the default is G / Blues; "Show all" recommends the 1st/2nd/3rd harps. The harp panel follows the header key when that changes, but its own choice doesn't change the header. It uses the same render-time reset pattern as the tuner's `PlayMode`.

- [ ] **Step 1: Write the failing tests**

`src/ui/pages/positions/PositionsPage.test.tsx`:

```tsx
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { localDate } from '../../../core/log/dates'
import { layoutShape } from '../../../test/layout'
import { loadLog } from '../../log/practiceLog'
import { SettingsProvider, useSettings } from '../../settings/SettingsContext'
import { PositionsPage } from './PositionsPage'

function SetHeaderKey() {
  const { update } = useSettings()
  return (
    <button type="button" onClick={() => update({ key: 'F' })}>
      header F
    </button>
  )
}

const renderPage = () =>
  render(
    <SettingsProvider storage={null}>
      <SetHeaderKey />
      <PositionsPage />
    </SettingsProvider>,
  )
const recommendation = () => screen.getByTestId('recommendation').textContent
const choose = (name: string, value: string) =>
  fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } })
const tableRows = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((r) => [...r.children].map((c) => c.textContent))

describe('PositionsPage — I have a song in…', () => {
  it('recommends a C harp for a G blues by default', () => {
    const { container } = renderPage()
    expect(recommendation()).toBe('Use a C harp — 2nd position (Mixolydian)')
    expect(container.querySelector('tr[data-recommended]')).toHaveTextContent('2nd')
  })

  it('recommends a G harp for an A minor song (3rd position)', () => {
    renderPage()
    choose('Song key', '9')
    choose('Style', 'minor')
    expect(recommendation()).toBe('Use a G harp — 3rd position (Dorian)')
  })

  it('lists every position with its harp, mode and typical use', () => {
    renderPage()
    expect(screen.getByRole('table')).toHaveTextContent('Every position for a song in G')
    expect(tableRows()).toEqual([
      ['1st', 'G harp', 'Ionian', 'major, folk'],
      ['2nd', 'C harp', 'Mixolydian', 'blues, rock, country'],
      ['3rd', 'F harp', 'Dorian', 'minor blues'],
      ['4th', 'Bb harp', 'Aeolian', 'natural minor'],
      ['5th', 'Eb harp', 'Phrygian', '—'],
      ['12th', 'D harp', 'Lydian', '—'],
    ])
  })

  it('names song keys the way keys are written', () => {
    renderPage()
    const options = [...screen.getByRole('combobox', { name: 'Song key' }).querySelectorAll('option')]
    expect(options.map((o) => o.textContent)).toEqual([
      'C',
      'Db',
      'D',
      'Eb',
      'E',
      'F',
      'F#',
      'G',
      'Ab',
      'A',
      'Bb',
      'B',
    ])
  })

  it('with "Show all", suggests the most played positions and marks no row', () => {
    const { container } = renderPage()
    choose('Style', 'all')
    expect(recommendation()).toBe('Most played: G harp (1st) · C harp (2nd) · F harp (3rd)')
    expect(container.querySelector('tr[data-recommended]')).toBeNull()
  })

  it('keeps its layout when the song or style changes', () => {
    const { container } = renderPage()
    const areas = ['tbody tr', '[data-testid="recommendation"]', 'caption', '[data-testid="harp-summary"]']
    const shape = layoutShape(container, areas)
    choose('Style', 'all')
    expect(layoutShape(container, areas)).toEqual(shape)
    choose('Song key', '1')
    choose('Style', 'naturalMinor')
    expect(layoutShape(container, areas)).toEqual(shape)
  })
})

describe('PositionsPage — I have a … harp', () => {
  it('starts at the header key and says what each position plays', () => {
    renderPage()
    expect(screen.getByTestId('harp-summary')).toHaveTextContent(
      'C harp: 1st C major · 2nd G blues · 3rd D minor · 4th A minor · 5th E Phrygian · 12th F Lydian',
    )
  })

  it('spells tonics the way the chosen harp does', () => {
    renderPage()
    choose('Harp', 'A')
    expect(screen.getByTestId('harp-summary')).toHaveTextContent(
      'A harp: 1st A major · 2nd E blues · 3rd B minor · 4th F# minor · 5th C# Phrygian · 12th D Lydian',
    )
  })

  it('follows the header key when that changes', () => {
    renderPage()
    choose('Harp', 'A')
    fireEvent.click(screen.getByRole('button', { name: 'header F' }))
    expect(screen.getByTestId('harp-summary')).toHaveTextContent(
      'F harp: 1st F major · 2nd C blues · 3rd G minor · 4th D minor · 5th A Phrygian · 12th Bb Lydian',
    )
  })
})

describe('PositionsPage — practice time', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('counts visible time without needing audio', () => {
    localStorage.clear() // earlier tests' unmounts may have logged a few real milliseconds
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 27, 10, 0, 0))
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    renderPage()
    act(() => vi.advanceTimersByTime(15_000))
    expect(loadLog(localStorage).days[localDate(Date.now())]).toEqual({ positions: 15 })
  })
})
```

In `src/ui/pages/homeGroups.test.ts`, change the Tools row of the expected list to:

```ts
      ['tools', 'Tools', ['tuner', 'metronome', 'positions']],
```

Append to the `describe('practice time', …)` block in `src/ui/App.test.tsx`:

```tsx
  it('#/positions counts visible time without audio', () => {
    window.location.hash = '#/positions'
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Positions & keys')
    expect(timers.calls).toContainEqual(['positions', { requireAudio: false }])
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/pages/positions src/ui/pages/homeGroups.test.ts src/ui/App.test.tsx`
Expected: FAIL — `./PositionsPage` cannot be resolved; no `positions` Home entry or route.

- [ ] **Step 3: Write the page**

`src/ui/pages/positions/PositionsPage.tsx`:

```tsx
import { useState } from 'react'
import { HARP_KEYS, keyForPitchClass, keySpelling, type HarpKey } from '../../../core/harmonica/keys'
import {
  POSITION_INFO,
  harpForPosition,
  positionLabel,
  positionTonicPc,
} from '../../../core/harmonica/positions'
import { pitchClassName } from '../../../core/music/noteNames'
import { usePracticeTimer } from '../../hooks/usePracticeTimer'
import { useSettings } from '../../settings/SettingsContext'
import styles from './PositionsPage.module.css'

type Style = 'major' | 'blues' | 'minor' | 'naturalMinor' | 'all'

const STYLES: readonly { id: Style; label: string; position: number | null }[] = [
  { id: 'major', label: 'Major / folk', position: 1 },
  { id: 'blues', label: 'Blues / rock', position: 2 },
  { id: 'minor', label: 'Minor', position: 3 },
  { id: 'naturalMinor', label: 'Natural minor', position: 4 },
  { id: 'all', label: 'Show all', position: null },
]

const PITCH_CLASSES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
/** Offered when the style is "Show all". */
const MOST_PLAYED = [1, 2, 3]

const infoFor = (position: number) => POSITION_INFO.find((i) => i.position === position)!

export function PositionsPage() {
  usePracticeTimer('positions', { requireAudio: false })
  return (
    <>
      <h1>Positions &amp; keys</h1>
      <p className={styles.intro}>
        Which harp to grab for a song, and what each harp plays in each position.
      </p>
      <div className={styles.panels}>
        <SongPanel />
        <HarpPanel />
      </div>
    </>
  )
}

function SongPanel() {
  const [tonic, setTonic] = useState(7) // G
  const [style, setStyle] = useState<Style>('blues')
  const chosen = STYLES.find((s) => s.id === style)?.position ?? null
  const harpFor = (position: number) => harpForPosition(tonic, position)

  const recommendation =
    chosen === null
      ? `Most played: ${MOST_PLAYED.map((p) => `${harpFor(p)} harp (${positionLabel(p)})`).join(' · ')}`
      : `Use a ${harpFor(chosen)} harp — ${positionLabel(chosen)} position (${infoFor(chosen).mode})`

  return (
    <section className={styles.panel} aria-labelledby="song-heading">
      <h2 id="song-heading">I have a song in…</h2>
      <div className={styles.fields}>
        <label className={styles.field}>
          Key
          <select
            aria-label="Song key"
            value={tonic}
            onChange={(e) => setTonic(Number(e.target.value))}
          >
            {PITCH_CLASSES.map((pc) => (
              <option key={pc} value={pc}>
                {keyForPitchClass(pc)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Style
          <select aria-label="Style" value={style} onChange={(e) => setStyle(e.target.value as Style)}>
            {STYLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className={styles.recommendation} data-testid="recommendation">
        {recommendation}
      </p>
      <table className={styles.table}>
        <caption>Every position for a song in {keyForPitchClass(tonic)}</caption>
        <thead>
          <tr>
            <th scope="col">Position</th>
            <th scope="col">Harp</th>
            <th scope="col">Mode</th>
            <th scope="col">Typical use</th>
          </tr>
        </thead>
        <tbody>
          {POSITION_INFO.map((info) => (
            <tr
              key={info.position}
              data-recommended={info.position === chosen ? 'true' : undefined}
            >
              <th scope="row">{positionLabel(info.position)}</th>
              <td>{harpFor(info.position)} harp</td>
              <td>{info.mode}</td>
              <td>{info.use ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function HarpPanel() {
  const { settings } = useSettings()
  // Starts at the header key and follows it when it changes; a local pick doesn't touch it.
  const [choice, setChoice] = useState({ harp: settings.key, headerKey: settings.key })
  if (choice.headerKey !== settings.key) {
    setChoice({ harp: settings.key, headerKey: settings.key })
  }
  const harp = choice.harp
  const spelling = keySpelling(harp)
  const summary = POSITION_INFO.map(
    (info) =>
      `${positionLabel(info.position)} ${pitchClassName(positionTonicPc(harp, info.position), spelling)} ${info.short}`,
  ).join(' · ')

  return (
    <section className={styles.panel} aria-labelledby="harp-heading">
      <h2 id="harp-heading">I have a … harp</h2>
      <div className={styles.fields}>
        <label className={styles.field}>
          Harp
          <select
            aria-label="Harp"
            value={harp}
            onChange={(e) => setChoice((c) => ({ ...c, harp: e.target.value as HarpKey }))}
          >
            {HARP_KEYS.map((k) => (
              <option key={k} value={k}>
                {k} harp
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className={styles.summary} data-testid="harp-summary">
        <strong>{harp} harp:</strong> {summary}
      </p>
    </section>
  )
}
```

`src/ui/pages/positions/PositionsPage.module.css`:

```css
.intro {
  color: var(--text-dim);
}

.panels {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(20rem, 100%), 1fr));
  gap: 1.5rem;
}

.panel {
  min-width: 0;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}

.panel h2 {
  margin-top: 0;
}

.fields {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  margin-bottom: 0.75rem;
}

.field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Two lines reserved, so switching style (one line vs. the longer "Most played") never moves the table. */
.recommendation {
  min-height: 3.2rem;
  margin: 0 0 0.75rem;
  font-size: 1.1rem;
  font-weight: 700;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table caption {
  margin-bottom: 0.25rem;
  color: var(--text-dim);
  text-align: left;
}

.table th,
.table td {
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid var(--border);
  text-align: left;
}

.table tr[data-recommended='true'] {
  background: color-mix(in srgb, var(--accent) 18%, var(--surface));
}

.summary {
  margin: 0;
  line-height: 1.8;
}
```

The harp summary puts "C harp:" in `<strong>`; `toHaveTextContent` matches the whole text, "C harp: 1st C major · …", across the elements.

- [ ] **Step 4: Route and Home entry**

In `src/ui/App.tsx`, add `import { PositionsPage } from './pages/positions/PositionsPage'` and the route `'/positions': PositionsPage,` after `'/metronome': MetronomePage,`.

In `src/ui/pages/homeGroups.ts`, append to the Tools `entries` (after the metronome entry):

```ts
      {
        id: 'positions',
        icon: '🧭',
        title: 'Positions & keys',
        text: 'Which harp to use for a song, and what each harp plays in every position.',
      },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/ui && npm run typecheck && npm run lint`
Expected: PASS; no type or lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/ui/pages/positions src/ui/App.tsx src/ui/pages/homeGroups.ts src/ui/pages/homeGroups.test.ts src/ui/App.test.tsx
git commit -m "feat: Positions & keys tool — harp for a song, positions of a harp"
```

---
### Task 11: Hole finder game

**Files:**
- Create: `src/core/games/holeFinder.ts`, `src/ui/pages/holeFinder/HoleFinderPage.tsx`
- Modify: `src/ui/components/game/Game.module.css` (`.bigNote`), `src/ui/App.tsx` (route), `src/ui/pages/homeGroups.ts` (Games entry)
- Test: `src/core/games/holeFinder.test.ts`, `src/ui/pages/holeFinder/HoleFinderPage.test.tsx`, `src/ui/pages/homeGroups.test.ts` (update), `src/ui/App.test.tsx` (update)

**Interfaces:**
- Consumes: `echoRoundConfig`, `echoPoints`, `pickTarget`, `ECHO_LIMIT_MS` (echoNote.ts); `ListenRound` (listenRound.ts); `buildPool`, `uniqueMidis`, `poolLabel`, `DEFAULT_POOL_FILTER` (notePool.ts); `useGameAudio`, `useScoring`, `useSlot`, `useTimeouts`; `useHarp` (Task 3); `usePracticeTimer` (Task 6); `bestScoreKey`, `tuningPart` (Task 2); `Stage`, `ScorePanel`, `PlayAgain`, `ModeToggle`, `PoolFilterPanel`, `GameLayout`; `layoutShape`; `fakeAudio`, `hold` (src/test/fakeGameAudio.ts)
- Produces:
  - `holeFinderRoundConfig(mode: GameMode, matcher: MatcherConfig, a4: number): ListenRoundConfig` — Echo's config with `helpAfterMs: null`
  - `HoleFinderPage()` at `#/hole-finder`, `HoleFinderGame({ rng?: Rng })`
  - `.bigNote` in `Game.module.css`: a large note name for the Stage headline slot
  - Home entry `{ id: 'hole-finder', icon: '🔎', title: 'Hole finder', … }` in Games

Spec §3. The site plays **no** sound: there's no prompt phase, and a round goes from Start straight to listening. The note name shows large in the Stage headline slot. Any hole or technique that sounds the exact pitch counts, because `ListenRound` matches pitch, not hole. Practice has "👀 Show me" (Echo's `describeNote` reveal plus a chart highlight) and "Skip" (decision 5). Scored is 10 rounds, 8 s per note, `echoPoints`, and the best is saved under `hole-finder`. The layout follows the stable-layout rule: Stage rows are always rendered, and the chart is always there.

- [ ] **Step 1: Write the failing tests**

`src/core/games/holeFinder.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { holeFinderRoundConfig } from './holeFinder'

const matcher = { toleranceCents: 25, holdMs: 500 }

describe('holeFinderRoundConfig', () => {
  it('is untimed and offers no automatic help in practice', () => {
    expect(holeFinderRoundConfig('practice', matcher, 440)).toEqual({
      matcher,
      a4: 440,
      limitMs: null,
      helpAfterMs: null,
    })
  })
  it('gives 8 s per note in scored mode', () => {
    expect(holeFinderRoundConfig('scored', matcher, 442)).toEqual({
      matcher,
      a4: 442,
      limitMs: 8000,
      helpAfterMs: null,
    })
  })
})
```

`src/ui/pages/holeFinder/HoleFinderPage.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scriptedRng } from '../../../core/games/random'
import { fakeAudio, hold } from '../../../test/fakeGameAudio'
import { layoutShape } from '../../../test/layout'
import { SettingsProvider } from '../../settings/SettingsContext'
import { HoleFinderGame } from './HoleFinderPage'

vi.mock('../../hooks/useGameAudio', () => import('../../../test/fakeGameAudio'))

// rng 0 → the lowest pool note: C4 (hole 1 blow). rng 0.2 → G4 (index 3 of the 19-note pool).
const renderGame = (rng: number[] = [0]) =>
  render(
    <SettingsProvider storage={null}>
      <HoleFinderGame rng={scriptedRng(rng)} />
    </SettingsProvider>,
  )
const start = () => fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
const target = () => screen.getByTestId('target-note').textContent
const box = (name: string) => screen.getByRole('button', { name })

describe('HoleFinderGame', () => {
  beforeEach(() => {
    fakeAudio.reset()
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a note name and plays nothing', () => {
    renderGame()
    start()
    expect(target()).toBe('C4')
    expect(fakeAudio.played).toEqual([])
    expect(box('1 C4')).not.toHaveAttribute('data-highlight')
  })

  it('accepts the note played on any hole that has it', () => {
    renderGame([0.2])
    start()
    expect(target()).toBe('G4')
    hold(67, 0, 500)
    expect(screen.getByText('✓ G4 (-2 or 3)')).toBeInTheDocument()
    expect(box('-2 G4')).toHaveAttribute('data-highlight', 'correct')
    expect(box('3 G4')).toHaveAttribute('data-highlight', 'correct')
  })

  it('reveals where the note is in practice', () => {
    renderGame()
    start()
    expect(screen.queryByText(/Hole 1/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Show me/ }))
    expect(screen.getByText('C4: Hole 1 · blow (1)')).toBeInTheDocument()
    expect(box('1 C4')).toHaveAttribute('data-highlight', 'target')
    expect(screen.queryByRole('button', { name: /Show me/ })).toBeNull()
  })

  it('skips to a different note', () => {
    renderGame()
    start()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(target()).toBe('D4')
  })

  it('moves on 1.5 s after a hit, never to the same note', () => {
    vi.useFakeTimers()
    renderGame()
    start()
    hold(60, 0, 500)
    expect(screen.getByText('✓ C4 (1)')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1500))
    expect(target()).toBe('D4')
  })

  it('offers no help in scored mode and scores a quick hit', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    start()
    expect(screen.queryByRole('button', { name: /Show me/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull()
    hold(60, 0, 500)
    // 1 + (1 − 500 / 8000) = 1.9375 → 194
    expect(screen.getByText(/\+194/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Round 2 of 10 · Score 194')
  })

  it('times out after 8 s in scored mode and shows where the note was', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    start()
    hold(null, 0, 7950)
    expect(screen.getByText('1 s left')).toBeInTheDocument()
    hold(null, 8000, 8000)
    expect(screen.getByText("✗ Time's up — it was C4 (1)")).toBeInTheDocument()
    expect(screen.getByText('C4: Hole 1 · blow (1)')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Round 2 of 10 · Score 0')
  })

  it.each(['Practice', 'Scored'])(
    'keeps the same layout in every phase (%s), so nothing jumps',
    (mode) => {
      const { container } = renderGame()
      fireEvent.click(screen.getByRole('button', { name: mode }))
      const shape = layoutShape(container, ['[aria-label="Harmonica chart"]'])
      expect(shape.stageRows).toEqual(['P', 'DIV', 'P'])
      start()
      expect(layoutShape(container, ['[aria-label="Harmonica chart"]'])).toEqual(shape)
      hold(60, 0, 500)
      expect(screen.getByText(/✓ C4/)).toBeInTheDocument()
      expect(layoutShape(container, ['[aria-label="Harmonica chart"]'])).toEqual(shape)
    },
  )

  it('says so when the filters leave no notes', () => {
    renderGame()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Blow / draw' }))
    expect(screen.getByRole('alert')).toHaveTextContent('No notes match these filters')
    expect(screen.queryByRole('button', { name: '▶ Start' })).toBeNull()
  })

  it('waits for the microphone before offering Start', () => {
    fakeAudio.micStatus = 'starting'
    renderGame()
    expect(screen.getByText('Waiting for microphone…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '▶ Start' })).toBeNull()
  })
})
```

In `src/ui/pages/homeGroups.test.ts`, change the Games row of the expected list to:

```ts
      ['games', 'Games', ['echo', 'bend', 'scales', 'intervals', 'melody', 'hole-finder']],
```

In `src/ui/App.test.tsx`, add `['#/hole-finder', 'hole-finder'],` to the `it.each` table of the `practice time` block, after `['#/melody', 'melody'],`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/games/holeFinder.test.ts src/ui/pages/holeFinder src/ui/pages/homeGroups.test.ts src/ui/App.test.tsx`
Expected: FAIL — `./holeFinder` and `./HoleFinderPage` cannot be resolved; no `hole-finder` Home entry or route.

- [ ] **Step 3: Write the round config**

`src/core/games/holeFinder.ts`:

```ts
import { echoRoundConfig } from './echoNote'
import type { ListenRoundConfig } from './listenRound'
import type { MatcherConfig } from './noteMatcher'
import type { GameMode } from './session'

/**
 * Spec §3: Echo's timing (8 s per note when scored) without Echo's automatic help — in practice
 * the player asks for help with "Show me".
 */
export function holeFinderRoundConfig(
  mode: GameMode,
  matcher: MatcherConfig,
  a4: number,
): ListenRoundConfig {
  return { ...echoRoundConfig(mode, matcher, a4), helpAfterMs: null }
}
```

- [ ] **Step 4: Add the large-note style**

Append to `src/ui/components/game/Game.module.css`:

```css
/* A note name as the whole prompt (hole finder, note quiz); fits the 3.6rem headline row. */
.bigNote {
  font-size: 2.4rem;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 5: Write the page**

`src/ui/pages/holeFinder/HoleFinderPage.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { ECHO_LIMIT_MS, echoPoints, pickTarget } from '../../../core/games/echoNote'
import { holeFinderRoundConfig } from '../../../core/games/holeFinder'
import { ListenRound, type ListenRoundState } from '../../../core/games/listenRound'
import {
  DEFAULT_POOL_FILTER,
  buildPool,
  poolLabel,
  uniqueMidis,
  type PoolFilter,
} from '../../../core/games/notePool'
import type { Rng } from '../../../core/games/random'
import { isFinished, type GameMode } from '../../../core/games/session'
import { describeNote, findNotes, noteId, tabLabel } from '../../../core/harmonica/harp'
import { keySpelling } from '../../../core/harmonica/keys'
import { noteName } from '../../../core/music/noteNames'
import { HarmonicaDiagram, type Highlight } from '../../components/HarmonicaDiagram'
import { MicErrorNotice } from '../../components/MicErrorNotice'
import { GameLayout } from '../../components/game/GameLayout'
import { ModeToggle } from '../../components/game/ModeToggle'
import { PoolFilterPanel } from '../../components/game/PoolFilterPanel'
import { PlayAgain, ScorePanel } from '../../components/game/ScorePanel'
import { Stage } from '../../components/game/Stage'
import styles from '../../components/game/Game.module.css'
import { useGameAudio, type GameAudio, type HeardListener } from '../../hooks/useGameAudio'
import { useHarp } from '../../hooks/useHarp'
import { usePracticeTimer } from '../../hooks/usePracticeTimer'
import { useScoring } from '../../hooks/useScoring'
import { useSlot } from '../../hooks/useSlot'
import { useTimeouts } from '../../hooks/useTimeouts'
import { bestScoreKey, tuningPart } from '../../scores/bestScores'
import { useSettings } from '../../settings/SettingsContext'

const ADVANCE_MS = 1500

export function HoleFinderPage() {
  usePracticeTimer('hole-finder')
  return (
    <GameLayout
      title="Hole finder"
      intro="A note name appears: find it on your harp and play it. The site stays silent — it's all you."
    >
      <HoleFinderGame />
    </GameLayout>
  )
}

export function HoleFinderGame({ rng = Math.random }: { rng?: Rng }) {
  const { settings } = useSettings()
  // Owned here, not by the keyed run, so a settings change doesn't restart the mic.
  const audio = useGameAudio(true)
  const [mode, setMode] = useState<GameMode>('practice')
  const [filter, setFilter] = useState<PoolFilter>(DEFAULT_POOL_FILTER)
  // Any change here remounts the run: timers stop and the score resets.
  const runKey = [
    mode,
    poolLabel(filter),
    settings.key,
    settings.tuning,
    settings.a4,
    settings.showAdvanced,
    settings.toleranceCents,
    settings.holdMs,
  ].join('|')
  return (
    <>
      <div className={styles.toolbar}>
        <ModeToggle mode={mode} onChange={setMode} />
      </div>
      <PoolFilterPanel filter={filter} onChange={setFilter} />
      <HoleFinderRun key={runKey} audio={audio} mode={mode} filter={filter} rng={rng} />
    </>
  )
}

interface View {
  phase: 'idle' | 'listening' | 'result'
  target: number | null
  round: ListenRoundState | null
  revealed: boolean
  points: number
}

const IDLE: View = { phase: 'idle', target: null, round: null, revealed: false, points: 0 }

interface RunProps {
  audio: GameAudio
  mode: GameMode
  filter: PoolFilter
  rng: Rng
}

function HoleFinderRun({ audio, mode, filter, rng }: RunProps) {
  const { settings } = useSettings()
  const harp = useHarp()
  const midis = useMemo(
    () => uniqueMidis(buildPool(harp, filter, settings.showAdvanced)),
    [harp, filter, settings.showAdvanced],
  )
  const spelling = keySpelling(settings.key)
  const scoring = useScoring(
    mode,
    bestScoreKey('hole-finder', {
      key: settings.key,
      pool: poolLabel(filter),
      adv: settings.showAdvanced,
      tol: settings.toleranceCents,
      hold: settings.holdMs,
      ...tuningPart(settings.tuning),
    }),
  )
  const slot = useSlot<ListenRound>()
  const timeouts = useTimeouts()
  const [view, setView] = useState<View>(IDLE)

  // Nothing to play first: a round starts listening straight away.
  const startRound = (previous: number | null) => {
    timeouts.clear()
    const target = pickTarget(midis, rng, previous)
    const matcher = { toleranceCents: settings.toleranceCents, holdMs: settings.holdMs }
    slot.set(new ListenRound(target, holeFinderRoundConfig(mode, matcher, settings.a4), audio.now()))
    setView({ ...IDLE, phase: 'listening', target })
  }

  const onHeard: HeardListener = (freq, timeMs) => {
    const round = slot.get()
    if (!round) return
    const state = round.push(freq, timeMs)
    if (state.status === 'listening') {
      setView((v) => ({ ...v, round: state }))
      return
    }
    slot.set(null)
    const points = echoPoints(state)
    const session = scoring.record({ correct: state.status === 'hit', points })
    setView((v) => ({ ...v, phase: 'result', round: state, revealed: true, points }))
    if (!isFinished(session)) timeouts.after(ADVANCE_MS, () => startRound(round.target))
  }
  useEffect(() => audio.listen(onHeard))

  const skip = () => {
    const round = slot.get()
    if (round) startRound(round.target)
  }
  const stop = () => {
    timeouts.clear()
    slot.set(null)
    setView(IDLE)
  }
  const restart = () => {
    scoring.restart()
    startRound(null)
  }

  if (midis.length === 0) {
    return (
      <p role="alert" className="notice">
        No notes match these filters. Choose more holes or techniques.
      </p>
    )
  }

  const visible = (midi: number) =>
    findNotes(harp, midi).filter((n) => settings.showAdvanced || n.common)
  const labelOf = (midi: number) =>
    `${noteName(midi, spelling)} (${visible(midi).map(tabLabel).join(' or ')})`

  const target = view.target
  const hit = view.round?.status === 'hit'
  const highlights = new Map<string, Highlight>()
  if (audio.detectedMidi !== null) {
    for (const n of findNotes(harp, audio.detectedMidi)) highlights.set(noteId(n), 'detected')
  }
  if (target !== null && view.revealed) {
    for (const n of findNotes(harp, target)) {
      highlights.set(noteId(n), view.phase === 'result' && hit ? 'correct' : 'target')
    }
  }
  const secondsLeft = Math.max(0, Math.ceil((ECHO_LIMIT_MS - (view.round?.elapsedMs ?? 0)) / 1000))

  return (
    <>
      {audio.error && <MicErrorNotice kind={audio.error} />}
      <ScorePanel scoring={scoring} />
      <Stage
        controls={
          <>
            {/* The primary action always comes first. */}
            {isFinished(scoring.session) && <PlayAgain onClick={restart} />}
            {view.phase === 'idle' &&
              !audio.error &&
              (audio.status === 'listening' ? (
                <button type="button" className={styles.primary} onClick={() => startRound(null)}>
                  ▶ Start
                </button>
              ) : (
                <p className={styles.hint}>Waiting for microphone…</p>
              ))}
            {/* Help would give the answer away in scored mode. */}
            {view.phase === 'listening' && mode === 'practice' && !view.revealed && (
              <button type="button" onClick={() => setView((v) => ({ ...v, revealed: true }))}>
                👀 Show me
              </button>
            )}
            {view.phase === 'listening' && mode === 'practice' && (
              <button type="button" onClick={skip}>
                Skip
              </button>
            )}
            {view.phase !== 'idle' && !isFinished(scoring.session) && (
              <button type="button" onClick={stop}>
                ■ Stop
              </button>
            )}
          </>
        }
        headline={
          view.phase === 'result' && target !== null ? (
            <>
              {hit ? `✓ ${labelOf(target)}` : `✗ Time's up — it was ${labelOf(target)}`}
              {mode === 'scored' && hit && ` · +${view.points}`}
            </>
          ) : view.phase === 'listening' && target !== null ? (
            <span className={styles.bigNote} data-testid="target-note">
              {noteName(target, spelling)}
            </span>
          ) : null
        }
        result={view.phase === 'result' && target !== null ? (hit ? 'ok' : 'bad') : undefined}
        progress={view.phase === 'listening' ? (view.round?.progress ?? 0) : undefined}
        detail={
          <>
            {view.phase === 'listening' && mode === 'scored' && `${secondsLeft} s left`}
            {view.phase === 'listening' &&
              mode === 'practice' &&
              !view.revealed &&
              'Play it on any hole that has it, and hold it.'}
            {view.revealed &&
              target !== null &&
              `${noteName(target, spelling)}: ${visible(target).map(describeNote).join(' or ')}`}
          </>
        }
      />
      {/* Tab labels only: note names on the chart would give the answer away (decision 6). */}
      <HarmonicaDiagram
        harp={harp}
        spelling={spelling}
        labelMode="tab"
        showAdvanced={settings.showAdvanced}
        highlights={highlights}
      />
    </>
  )
}
```

- [ ] **Step 6: Route and Home entry**

In `src/ui/App.tsx`, add `import { HoleFinderPage } from './pages/holeFinder/HoleFinderPage'` and the route `'/hole-finder': HoleFinderPage,` after `'/melody': MelodyEchoPage,`.

In `src/ui/pages/homeGroups.ts`, append to the Games `entries` (after the melody entry):

```ts
      {
        id: 'hole-finder',
        icon: '🔎',
        title: 'Hole finder',
        text: 'See a note name, find it on your harp and play it.',
      },
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/core/games src/ui && npm run typecheck && npm run lint`
Expected: PASS; no type or lint errors.

- [ ] **Step 8: Commit**

```bash
git add src/core/games/holeFinder.ts src/core/games/holeFinder.test.ts src/ui/pages/holeFinder src/ui/components/game/Game.module.css src/ui/App.tsx src/ui/pages/homeGroups.ts src/ui/pages/homeGroups.test.ts src/ui/App.test.tsx
git commit -m "feat: Hole finder game — see a note name, find it on the harp"
```

---
### Task 12: Note quiz core

**Files:**
- Create: `src/core/games/noteQuiz.ts`
- Test: `src/core/games/noteQuiz.test.ts`

**Interfaces:**
- Consumes: `HarpNote`, `noteId` (harp.ts); `pickOne`, `Rng` (random.ts); `roundPoints`, `speedBonus` (session.ts)
- Produces:
  - `QUIZ_BONUS_MS = 10_000`
  - `PITCH_CLASSES: readonly number[]` — `[0, 1, …, 11]`
  - `pickQuizNote(pool: readonly HarpNote[], rng: Rng, previous: HarpNote | null): HarpNote` — never the same box twice in a row when there's a choice
  - `isRightName(note: HarpNote, pc: number): boolean`
  - `isRightHole(targetMidi: number, clicked: HarpNote): boolean` — any box with that exact pitch
  - `quizPoints(correct: boolean, elapsedMs: number): number` — wrong = 0, right = `roundPoints(1, speedBonus(elapsedMs, QUIZ_BONUS_MS))`

Spec §4. Decision 6: there's no timeout; `speedBonus` already clamps at ×1 past 10 s. "Find the hole" picks its pitch with `pickTarget` (echoNote.ts) on the unique pitches, so it never repeats a pitch; "Name the note" picks a box, so it never repeats a box.

- [ ] **Step 1: Write the failing tests**

`src/core/games/noteQuiz.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildHarp, tabLabel, type HarpNote } from '../harmonica/harp'
import { DEFAULT_POOL_FILTER, buildPool } from './notePool'
import {
  PITCH_CLASSES,
  isRightHole,
  isRightName,
  pickQuizNote,
  quizPoints,
} from './noteQuiz'

const c = buildHarp('C')
const tab = (label: string): HarpNote => c.find((n) => tabLabel(n) === label)!

describe('quizPoints', () => {
  it('gives 0 for a wrong answer and a speed bonus over 10 s for a right one', () => {
    expect(quizPoints(false, 0)).toBe(0)
    expect(quizPoints(true, 0)).toBe(200)
    expect(quizPoints(true, 5000)).toBe(150)
    expect(quizPoints(true, 10000)).toBe(100)
    expect(quizPoints(true, 25000)).toBe(100)
  })
})

describe('answers', () => {
  it('checks a name by pitch class', () => {
    expect(PITCH_CLASSES).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(isRightName(tab('1'), 0)).toBe(true)
    expect(isRightName(tab('1'), 1)).toBe(false)
    expect(isRightName(tab("-3'"), 10)).toBe(true) // Bb4
    const f = buildHarp('F')
    expect(isRightName(f.find((n) => tabLabel(n) === '1')!, 5)).toBe(true)
  })
  it('accepts any box with the exact pitch, but not another octave', () => {
    expect(isRightHole(67, tab('-2'))).toBe(true)
    expect(isRightHole(67, tab('3'))).toBe(true)
    expect(isRightHole(67, tab('-3'))).toBe(false)
    expect(isRightHole(67, tab('6'))).toBe(false) // G5
  })
})

describe('pickQuizNote', () => {
  const pool = buildPool(c, DEFAULT_POOL_FILTER, false)
  it('picks from the pool and never the same box twice in a row', () => {
    const first = pickQuizNote(pool, () => 0, null)
    expect(tabLabel(first)).toBe('1')
    expect(tabLabel(pickQuizNote(pool, () => 0, first))).toBe('-1')
  })
  it('repeats when the pool has only one box', () => {
    const one = [tab('4')]
    expect(pickQuizNote(one, () => 0.9, one[0])).toBe(one[0])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/games/noteQuiz.test.ts`
Expected: FAIL — `./noteQuiz` cannot be resolved.

- [ ] **Step 3: Write the module**

`src/core/games/noteQuiz.ts`:

```ts
import { noteId, type HarpNote } from '../harmonica/harp'
import { pickOne, type Rng } from './random'
import { roundPoints, speedBonus } from './session'

/** Spec §4: the speed bonus runs from ×2 (instant) to ×1 at 10 s; there is no timeout. */
export const QUIZ_BONUS_MS = 10_000

export const PITCH_CLASSES: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

/** A random box from the pool, not the previous one when there is a choice. */
export function pickQuizNote(
  pool: readonly HarpNote[],
  rng: Rng,
  previous: HarpNote | null,
): HarpNote {
  const choices =
    previous && pool.length > 1 ? pool.filter((n) => noteId(n) !== noteId(previous)) : pool
  return pickOne(choices, rng)
}

export function isRightName(note: HarpNote, pc: number): boolean {
  return ((note.midi % 12) + 12) % 12 === pc
}

/** Any box that sounds exactly the asked pitch is right. */
export function isRightHole(targetMidi: number, clicked: HarpNote): boolean {
  return clicked.midi === targetMidi
}

export function quizPoints(correct: boolean, elapsedMs: number): number {
  return correct ? roundPoints(1, speedBonus(elapsedMs, QUIZ_BONUS_MS)) : 0
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/core/games && npm run typecheck`
Expected: PASS; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/core/games/noteQuiz.ts src/core/games/noteQuiz.test.ts
git commit -m "feat(core): note quiz answers, box picking and scoring"
```

---

### Task 13: Note quiz page

**Files:**
- Create: `src/ui/pages/quiz/NoteQuizPage.tsx`
- Modify: `src/ui/components/game/Game.module.css` (`.noteAnswers`), `src/ui/App.tsx` (route), `src/ui/pages/homeGroups.ts` (Games entry)
- Test: `src/ui/pages/quiz/NoteQuizPage.test.tsx`, `src/ui/pages/homeGroups.test.ts` (update), `src/ui/App.test.tsx` (append)

**Interfaces:**
- Consumes: `PITCH_CLASSES`, `pickQuizNote`, `isRightName`, `isRightHole`, `quizPoints` (Task 12); `pickTarget` (echoNote.ts); `pitchClassName` (Task 9); `buildPool`, `uniqueMidis`, `poolLabel`, `DEFAULT_POOL_FILTER`; `useHarp`, `usePracticeTimer`, `useScoring`, `useSlot`, `useTimeouts`; `bestScoreKey`, `tuningPart`; `Stage`, `ScorePanel`, `PlayAgain`, `ModeToggle`, `PoolFilterPanel`; `.bigNote` (Task 11); `HarmonicaDiagram`'s `onNoteDown`
- Produces: `NoteQuizPage()` at `#/quiz`; `QuizGame({ rng?: Rng; now?: () => number })`; `.noteAnswers` (six equal columns); Home entry `{ id: 'quiz', icon: '🎓', title: 'Note quiz', … }` in Games

Spec §4. No mic, no sound and no `AudioGate`: the page renders its own title and intro and counts visible time (`requireAudio: false`). "Name the note" highlights a box `target` and asks for its pitch class from 12 always-rendered buttons (disabled outside answering), spelled for the harp key. "Find the hole" shows a note with octave large and makes the chart clickable through `onNoteDown`; any box with the exact pitch is right. Clicking the chart never plays anything, because this page has no player. `now` is injected so tests control the speed bonus; it's only called from handlers. A `Slot` marks the open question, so a second answer before React re-renders (a fast double-click) is ignored (Review Focus 4). Decision 6: the chart shows tab labels, there's no timeout, and every answer moves on after 1.5 s.

- [ ] **Step 1: Write the failing tests**

`src/ui/pages/quiz/NoteQuizPage.test.tsx`:

```tsx
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scriptedRng } from '../../../core/games/random'
import { layoutShape } from '../../../test/layout'
import { loadBest } from '../../scores/bestScores'
import { SettingsProvider } from '../../settings/SettingsContext'
import { QuizGame } from './NoteQuizPage'

let clock = 0

// rng 0 → the first pool box: hole 1 blow (C4 on a C harp). rng 0.2 → G4 in "Find the hole".
const renderGame = (rng: number[] = [0], storage: Storage | null = null) =>
  render(
    <SettingsProvider storage={storage}>
      <QuizGame rng={scriptedRng(rng)} now={() => clock} />
    </SettingsProvider>,
  )
const start = () => fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
const answers = () => within(screen.getByRole('group', { name: 'Answers' })).getAllByRole('button')
const box = (name: string) => screen.getByRole('button', { name })
const findTask = () => fireEvent.click(screen.getByRole('button', { name: 'Find the hole' }))

describe('QuizGame — name the note', () => {
  beforeEach(() => {
    clock = 0
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('highlights a hole and accepts its note name', () => {
    renderGame()
    start()
    expect(screen.getByText('Which note is this?')).toBeInTheDocument()
    expect(box('1 C4')).toHaveAttribute('data-highlight', 'target')
    expect(box('1 C4')).toHaveTextContent('1') // tab labels: the name isn't given away
    fireEvent.click(screen.getByRole('button', { name: 'C' }))
    expect(screen.getByText('✓ C')).toBeInTheDocument()
    expect(box('1 C4')).toHaveAttribute('data-highlight', 'correct')
  })

  it('shows the right name after a wrong answer', () => {
    renderGame()
    start()
    fireEvent.click(screen.getByRole('button', { name: 'D' }))
    expect(screen.getByText('✗ It was C')).toBeInTheDocument()
    expect(box('1 C4')).toHaveAttribute('data-highlight', 'wrong')
  })

  it('always shows the 12 answers, enabled only while answering', () => {
    renderGame()
    expect(answers()).toHaveLength(12)
    expect(answers().every((b) => b.hasAttribute('disabled'))).toBe(true)
    start()
    expect(answers().some((b) => b.hasAttribute('disabled'))).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'C' }))
    expect(answers().every((b) => b.hasAttribute('disabled'))).toBe(true)
  })

  it('moves on 1.5 s after an answer, to a different hole', () => {
    vi.useFakeTimers()
    renderGame()
    start()
    fireEvent.click(screen.getByRole('button', { name: 'C' }))
    act(() => vi.advanceTimersByTime(1499))
    expect(screen.getByText('✓ C')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByText('Which note is this?')).toBeInTheDocument()
    expect(box('-1 D4')).toHaveAttribute('data-highlight', 'target')
    expect(box('1 C4')).not.toHaveAttribute('data-highlight')
  })

  it('spells the answers for the harp key', () => {
    renderGame()
    expect(answers().map((b) => b.textContent)).toEqual([
      'C',
      'C#',
      'D',
      'D#',
      'E',
      'F',
      'F#',
      'G',
      'G#',
      'A',
      'A#',
      'B',
    ])
  })

  it('uses flats on a flat-key harp', () => {
    localStorage.setItem('harp-tools:settings', JSON.stringify({ key: 'F' }))
    renderGame([0], localStorage)
    expect(answers().map((b) => b.textContent)).toEqual([
      'C',
      'Db',
      'D',
      'Eb',
      'E',
      'F',
      'Gb',
      'G',
      'Ab',
      'A',
      'Bb',
      'B',
    ])
    start()
    fireEvent.click(screen.getByRole('button', { name: 'F' }))
    expect(screen.getByText('✓ F')).toBeInTheDocument()
  })

  it('does not take answers from the chart in this task', () => {
    renderGame()
    start()
    fireEvent.pointerDown(box('1 C4'))
    expect(screen.getByText('Which note is this?')).toBeInTheDocument()
  })
})

describe('QuizGame — find the hole', () => {
  beforeEach(() => {
    clock = 0
    localStorage.clear()
  })

  it('asks for a note and accepts any hole with that exact pitch', () => {
    renderGame([0.2])
    findTask()
    start()
    expect(screen.getByTestId('target-note')).toHaveTextContent('G4')
    fireEvent.pointerDown(box('3 G4'))
    expect(screen.getByText('✓ G4 — 3')).toBeInTheDocument()
    expect(box('3 G4')).toHaveAttribute('data-highlight', 'correct')
  })

  it('marks a wrong hole and shows the right ones', () => {
    renderGame()
    findTask()
    start()
    fireEvent.pointerDown(box('-1 D4'))
    expect(screen.getByText('✗ C4 is 1')).toBeInTheDocument()
    expect(box('-1 D4')).toHaveAttribute('data-highlight', 'wrong')
    expect(box('1 C4')).toHaveAttribute('data-highlight', 'target')
  })

  it('ignores the chart before Start and after answering', () => {
    renderGame()
    findTask()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    fireEvent.pointerDown(box('1 C4'))
    expect(screen.queryByText(/✓|✗/)).toBeNull()
    start()
    fireEvent.pointerDown(box('1 C4'))
    fireEvent.pointerDown(box('-1 D4'))
    expect(screen.getByText(/✓ C4 — 1/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Round 2 of 10 · Score 200')
  })

  it('has no answer grid', () => {
    renderGame()
    findTask()
    expect(screen.queryByRole('group', { name: 'Answers' })).toBeNull()
  })
})

describe('QuizGame — scored', () => {
  beforeEach(() => {
    clock = 0
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('scores a right answer by speed and a wrong one as 0', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    start()
    clock = 5000
    fireEvent.click(screen.getByRole('button', { name: 'C' }))
    expect(screen.getByText('✓ C · +150')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Round 2 of 10 · Score 150')
  })

  it('counts one answer per round, even on a double click', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    start()
    const c = screen.getByRole('button', { name: 'C' })
    act(() => {
      c.click()
      c.click()
    })
    expect(screen.getByRole('status')).toHaveTextContent('Round 2 of 10 · Score 200')
  })

  it('saves the best score under quiz, with the task in the key', () => {
    vi.useFakeTimers()
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    start()
    // rng 0 without repeats alternates between hole 1 blow (C) and hole 1 draw (D).
    for (let round = 0; round < 10; round++) {
      fireEvent.click(screen.getByRole('button', { name: round % 2 === 0 ? 'C' : 'D' }))
      act(() => vi.advanceTimersByTime(1500))
    }
    expect(screen.getByRole('status')).toHaveTextContent('Final score: 2000 / 2000')
    expect(loadBest(localStorage, 'quiz|adv=false|key=C|pool=1-10:plain|task=name')).toBe(2000)
  })
})

describe('QuizGame — layout and filters', () => {
  beforeEach(() => {
    clock = 0
    localStorage.clear()
  })

  it.each([
    ['Name the note', 'C'],
    ['Find the hole', '1 C4'],
  ])('keeps the same layout in every phase (%s)', (task, answer) => {
    const { container } = renderGame()
    fireEvent.click(screen.getByRole('button', { name: task }))
    const areas = ['[aria-label="Answers"] button', '[aria-label="Harmonica chart"]']
    const shape = layoutShape(container, areas)
    expect(shape.stageRows).toEqual(['P', 'DIV', 'P'])
    start()
    expect(layoutShape(container, areas)).toEqual(shape)
    const target = screen.getByRole('button', { name: answer })
    if (answer === 'C') fireEvent.click(target)
    else fireEvent.pointerDown(target)
    expect(screen.getByText(/^✓/)).toBeInTheDocument()
    expect(layoutShape(container, areas)).toEqual(shape)
  })

  it('says so when the filters leave no notes', () => {
    renderGame()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Blow / draw' }))
    expect(screen.getByRole('alert')).toHaveTextContent('No notes match these filters')
    expect(screen.queryByRole('button', { name: '▶ Start' })).toBeNull()
  })
})
```

In `src/ui/pages/homeGroups.test.ts`, change the Games row of the expected list to:

```ts
      ['games', 'Games', ['echo', 'bend', 'scales', 'intervals', 'melody', 'hole-finder', 'quiz']],
```

Append to the `describe('practice time', …)` block in `src/ui/App.test.tsx`:

```tsx
  it('#/quiz counts visible time without audio', () => {
    window.location.hash = '#/quiz'
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Note quiz')
    expect(timers.calls).toContainEqual(['quiz', { requireAudio: false }])
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/pages/quiz src/ui/pages/homeGroups.test.ts src/ui/App.test.tsx`
Expected: FAIL — `./NoteQuizPage` cannot be resolved; no `quiz` Home entry or route.

- [ ] **Step 3: Add the answer-grid style**

Append to `src/ui/components/game/Game.module.css`:

```css
/* The quiz's 12 note names: two fixed rows of six, at any width. */
.noteAnswers {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}
```

- [ ] **Step 4: Write the page**

`src/ui/pages/quiz/NoteQuizPage.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { pickTarget } from '../../../core/games/echoNote'
import {
  PITCH_CLASSES,
  isRightHole,
  isRightName,
  pickQuizNote,
  quizPoints,
} from '../../../core/games/noteQuiz'
import {
  DEFAULT_POOL_FILTER,
  buildPool,
  poolLabel,
  uniqueMidis,
  type PoolFilter,
} from '../../../core/games/notePool'
import type { Rng } from '../../../core/games/random'
import { isFinished, type GameMode } from '../../../core/games/session'
import { findNotes, noteId, tabLabel, type HarpNote } from '../../../core/harmonica/harp'
import { keySpelling } from '../../../core/harmonica/keys'
import { noteName, pitchClassName } from '../../../core/music/noteNames'
import { HarmonicaDiagram, type Highlight } from '../../components/HarmonicaDiagram'
import { ModeToggle } from '../../components/game/ModeToggle'
import { PoolFilterPanel } from '../../components/game/PoolFilterPanel'
import { PlayAgain, ScorePanel } from '../../components/game/ScorePanel'
import { Stage } from '../../components/game/Stage'
import styles from '../../components/game/Game.module.css'
import { useHarp } from '../../hooks/useHarp'
import { usePracticeTimer } from '../../hooks/usePracticeTimer'
import { useScoring } from '../../hooks/useScoring'
import { useSlot } from '../../hooks/useSlot'
import { useTimeouts } from '../../hooks/useTimeouts'
import { bestScoreKey, tuningPart } from '../../scores/bestScores'
import { useSettings } from '../../settings/SettingsContext'

const ADVANCE_MS = 1500

type Task = 'name' | 'find'

export function NoteQuizPage() {
  usePracticeTimer('quiz', { requireAudio: false })
  return (
    <>
      <h1>Note quiz</h1>
      <p className={styles.intro}>
        Learn where every note lives: name the highlighted hole, or find the hole for a note. No
        sound and no microphone — just you and the chart.
      </p>
      <QuizGame />
    </>
  )
}

interface GameProps {
  rng?: Rng
  /** Milliseconds, for the speed bonus; only called from handlers. */
  now?: () => number
}

export function QuizGame({ rng = Math.random, now = () => performance.now() }: GameProps) {
  const { settings } = useSettings()
  const [mode, setMode] = useState<GameMode>('practice')
  const [task, setTask] = useState<Task>('name')
  const [filter, setFilter] = useState<PoolFilter>(DEFAULT_POOL_FILTER)
  // Any change here remounts the run: timers stop and the score resets.
  const runKey = [
    mode,
    task,
    poolLabel(filter),
    settings.key,
    settings.tuning,
    settings.showAdvanced,
  ].join('|')
  return (
    <>
      <div className={styles.toolbar}>
        <ModeToggle mode={mode} onChange={setMode} />
        <div role="group" aria-label="Task" className={styles.segmented}>
          <button type="button" aria-pressed={task === 'name'} onClick={() => setTask('name')}>
            Name the note
          </button>
          <button type="button" aria-pressed={task === 'find'} onClick={() => setTask('find')}>
            Find the hole
          </button>
        </div>
      </div>
      <PoolFilterPanel filter={filter} onChange={setFilter} />
      <QuizRun key={runKey} mode={mode} task={task} filter={filter} rng={rng} now={now} />
    </>
  )
}

interface View {
  phase: 'idle' | 'answer' | 'result'
  /** "Name": the highlighted box. "Find": a box with the asked pitch. */
  note: HarpNote | null
  askedAt: number
  correct: boolean
  points: number
  /** "Find": the box the player clicked. */
  picked: HarpNote | null
}

const IDLE: View = { phase: 'idle', note: null, askedAt: 0, correct: false, points: 0, picked: null }

interface RunProps {
  mode: GameMode
  task: Task
  filter: PoolFilter
  rng: Rng
  now: () => number
}

function QuizRun({ mode, task, filter, rng, now }: RunProps) {
  const { settings } = useSettings()
  const harp = useHarp()
  const pool = useMemo(
    () => buildPool(harp, filter, settings.showAdvanced),
    [harp, filter, settings.showAdvanced],
  )
  const midis = useMemo(() => uniqueMidis(pool), [pool])
  const spelling = keySpelling(settings.key)
  const scoring = useScoring(
    mode,
    bestScoreKey('quiz', {
      key: settings.key,
      task,
      pool: poolLabel(filter),
      adv: settings.showAdvanced,
      ...tuningPart(settings.tuning),
    }),
  )
  // The open question; cleared by the first answer, so a second one in the same frame is ignored.
  const open = useSlot<HarpNote>()
  const timeouts = useTimeouts()
  const [view, setView] = useState<View>(IDLE)

  const nextNote = (previous: HarpNote | null): HarpNote => {
    if (task === 'name') return pickQuizNote(pool, rng, previous)
    const midi = pickTarget(midis, rng, previous?.midi ?? null)
    return pool.find((n) => n.midi === midi)!
  }

  const startRound = (previous: HarpNote | null) => {
    timeouts.clear()
    const note = nextNote(previous)
    open.set(note)
    setView({ ...IDLE, phase: 'answer', note, askedAt: now() })
  }

  const conclude = (note: HarpNote, correct: boolean, picked: HarpNote | null) => {
    open.set(null)
    const points = quizPoints(correct, now() - view.askedAt)
    setView((v) => ({ ...v, phase: 'result', correct, points, picked }))
    const session = scoring.record({ correct, points })
    if (!isFinished(session)) timeouts.after(ADVANCE_MS, () => startRound(note))
  }

  const answerName = (pc: number) => {
    const note = open.get()
    if (note) conclude(note, isRightName(note, pc), null)
  }
  const answerHole = (clicked: HarpNote) => {
    const note = open.get()
    if (note) conclude(note, isRightHole(note.midi, clicked), clicked)
  }

  const stop = () => {
    timeouts.clear()
    open.set(null)
    setView(IDLE)
  }
  const restart = () => {
    scoring.restart()
    startRound(null)
  }

  if (pool.length === 0) {
    return (
      <p role="alert" className="notice">
        No notes match these filters. Choose more holes or techniques.
      </p>
    )
  }

  const visible = (midi: number) =>
    findNotes(harp, midi).filter((n) => settings.showAdvanced || n.common)
  const note = view.note
  const highlights = new Map<string, Highlight>()
  if (note && task === 'name') {
    highlights.set(
      noteId(note),
      view.phase === 'result' ? (view.correct ? 'correct' : 'wrong') : 'target',
    )
  }
  if (note && task === 'find' && view.phase === 'result') {
    for (const n of visible(note.midi)) highlights.set(noteId(n), 'target')
    if (view.picked) highlights.set(noteId(view.picked), view.correct ? 'correct' : 'wrong')
  }

  const resultText = (n: HarpNote) => {
    if (task === 'name') {
      const name = pitchClassName(n.midi, spelling)
      return view.correct ? `✓ ${name}` : `✗ It was ${name}`
    }
    const name = noteName(n.midi, spelling)
    return view.correct && view.picked
      ? `✓ ${name} — ${tabLabel(view.picked)}`
      : `✗ ${name} is ${visible(n.midi).map(tabLabel).join(' or ')}`
  }

  return (
    <>
      <ScorePanel scoring={scoring} />
      <Stage
        controls={
          <>
            {/* The primary action always comes first. */}
            {isFinished(scoring.session) && <PlayAgain onClick={restart} />}
            {view.phase === 'idle' && (
              <button type="button" className={styles.primary} onClick={() => startRound(null)}>
                ▶ Start
              </button>
            )}
            {view.phase !== 'idle' && !isFinished(scoring.session) && (
              <button type="button" onClick={stop}>
                ■ Stop
              </button>
            )}
          </>
        }
        headline={
          view.phase === 'result' && note ? (
            <>
              {resultText(note)}
              {mode === 'scored' && view.correct && ` · +${view.points}`}
            </>
          ) : view.phase === 'answer' && note ? (
            task === 'name' ? (
              'Which note is this?'
            ) : (
              <span className={styles.bigNote} data-testid="target-note">
                {noteName(note.midi, spelling)}
              </span>
            )
          ) : null
        }
        result={view.phase === 'result' && note ? (view.correct ? 'ok' : 'bad') : undefined}
        detail={
          view.phase === 'answer' &&
          `${task === 'name' ? 'Pick its name below.' : 'Click a hole that plays it.'}${
            mode === 'scored' ? ' Faster answers score more.' : ''
          }`
        }
      />
      {/* Always rendered in "Name the note", so the chart doesn't move when a question comes. */}
      {task === 'name' && (
        <div role="group" aria-label="Answers" className={`${styles.answers} ${styles.noteAnswers}`}>
          {PITCH_CLASSES.map((pc) => (
            <button
              key={pc}
              type="button"
              disabled={view.phase !== 'answer'}
              onClick={() => answerName(pc)}
            >
              {pitchClassName(pc, spelling)}
            </button>
          ))}
        </div>
      )}
      {/* Tab labels only: note names would give the answer away. The chart never plays sound. */}
      <HarmonicaDiagram
        harp={harp}
        spelling={spelling}
        labelMode="tab"
        showAdvanced={settings.showAdvanced}
        highlights={highlights}
        onNoteDown={task === 'find' ? answerHole : undefined}
      />
    </>
  )
}
```

`view.askedAt` is read from the render in which the answer button was clicked, and that render is always the one that started the question, because the first answer closes the question through the `Slot`.

- [ ] **Step 5: Route and Home entry**

In `src/ui/App.tsx`, add `import { NoteQuizPage } from './pages/quiz/NoteQuizPage'` and the route `'/quiz': NoteQuizPage,` after `'/hole-finder': HoleFinderPage,`.

In `src/ui/pages/homeGroups.ts`, append to the Games `entries` (after the hole-finder entry):

```ts
      {
        id: 'quiz',
        icon: '🎓',
        title: 'Note quiz',
        text: 'Name the highlighted hole, or find the hole for a note. No mic needed.',
      },
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/ui && npm run typecheck && npm run lint`
Expected: PASS; no type or lint errors.

- [ ] **Step 7: Commit**

```bash
git add src/ui/pages/quiz src/ui/components/game/Game.module.css src/ui/App.tsx src/ui/pages/homeGroups.ts src/ui/pages/homeGroups.test.ts src/ui/App.test.tsx
git commit -m "feat: Note quiz — name the highlighted hole, or find the hole for a note"
```

---
### Task 14: Practice log page

**Files:**
- Create: `src/ui/pages/log/PracticeLogPage.tsx`, `src/ui/pages/log/DayChart.tsx`, `src/ui/pages/log/PracticeLogPage.module.css`
- Modify: `src/ui/theme.css` (`.visually-hidden`), `src/ui/components/Header.tsx` ("Log" link), `src/ui/App.tsx` (route), `src/ui/pages/homeGroups.ts` (Progress entry)
- Test: `src/ui/pages/log/PracticeLogPage.test.tsx`, `src/ui/pages/log/DayChart.test.tsx`, `src/ui/components/Header.test.tsx` (append), `src/ui/pages/homeGroups.test.ts` (update), `src/ui/App.test.tsx` (append)

**Interfaces:**
- Consumes: `localDate` (Task 5); `emptyLog` (Task 5); `streaks`, `totals`, `dailySeconds`, `pageSecondsThisWeek`, `recentSessions`, `formatDuration` (Task 5); `loadLog`, `clearLog`, `LOG_KEY` (Task 6); `pageTitle` (Task 8); `browserStorage()`; `layoutShape`
- Produces:
  - `PracticeLogPage({ now?: () => number })` at `#/log` (`now` defaults to `Date.now` and is read once, when the page opens)
  - `DayChart({ days: readonly { date: string; seconds: number }[] })` — inline SVG bars labelled in minutes, plus a visually hidden table
  - global `.visually-hidden` utility class
  - Header nav: Tuner · Metronome · Log
  - Home entry `{ id: 'log', icon: '📈', title: 'Practice log', … }` in Progress

Spec §5 "Page shows" and §13 accessibility. The chart's SVG is `aria-hidden`; its visually hidden table (caption "Minutes practised per day") is the text alternative. Colours come from the existing tokens (`--accent` bars, `--text-dim` labels, `--border` axis). The site's theme is dark-only, so the chart works in dark by construction. Decision 10: the log page doesn't count its own time, and it names pages through `pageTitle`. The page reads the log once when it opens; it's a report, not a live view. Every section (the five stats, the chart, both tables, the clear row) is always rendered, with "Nothing yet" rows when it's empty, so an empty and a full log have the same layout.

- [ ] **Step 1: Write the failing tests**

`src/ui/pages/log/DayChart.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DayChart } from './DayChart'

const days = [
  { date: '2026-09-26', seconds: 0 },
  { date: '2026-09-27', seconds: 90 },
  { date: '2026-09-28', seconds: 1500 },
]

describe('DayChart', () => {
  it('draws one labelled bar per day, tallest for the most minutes', () => {
    const { container } = render(<DayChart days={days} />)
    const bars = [...container.querySelectorAll('[data-testid="day-bar"]')]
    expect(bars).toHaveLength(3)
    const heights = bars.map((g) => Number(g.querySelector('rect')!.getAttribute('height')))
    expect(heights[0]).toBe(0)
    expect(heights[2]).toBe(100)
    expect(heights[1]).toBeGreaterThan(0)
    expect(bars.map((g) => g.querySelectorAll('text')[0].textContent)).toEqual(['', '2', '25'])
    expect(bars.map((g) => g.querySelectorAll('text')[1].textContent)).toEqual(['26', '27', '28'])
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('has a table with the same numbers for screen readers', () => {
    render(<DayChart days={days} />)
    const table = screen.getByRole('table', { name: 'Minutes practised per day' })
    expect(table).toHaveClass('visually-hidden')
    const rows = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((r) => [...r.children].map((c) => c.textContent))
    expect(rows).toEqual([
      ['2026-09-26', '0'],
      ['2026-09-27', '2'],
      ['2026-09-28', '25'],
    ])
  })
})
```

`src/ui/pages/log/PracticeLogPage.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { layoutShape } from '../../../test/layout'
import { LOG_KEY } from '../../log/practiceLog'
import { PracticeLogPage } from './PracticeLogPage'

const NOON = new Date(2026, 8, 27, 12, 0, 0).getTime() // Sunday 27 September 2026
const LOG = {
  days: {
    '2026-09-27': { tuner: 600, echo: 300 },
    '2026-09-26': { quiz: 120 },
    '2026-09-25': { positions: 90 },
    '2026-09-21': { bend: 1200 }, // Monday of this week
    '2026-09-20': { melody: 3600 }, // last week
  },
  sessions: [
    { date: '2026-09-26', game: 'echo', score: 1450, max: 2000 },
    { date: '2026-09-27', game: 'quiz', score: 1800, max: 2000 },
  ],
}

const renderPage = () => render(<PracticeLogPage now={() => NOON} />)
const stats = (container: HTMLElement) =>
  [...container.querySelectorAll('dl dt')].map((dt) => [
    dt.textContent,
    dt.nextElementSibling?.textContent,
  ])
const rowsOf = (name: string) =>
  within(screen.getByRole('table', { name }))
    .getAllByRole('row')
    .slice(1)
    .map((r) => [...r.children].map((c) => c.textContent))
const SHAPE_AREAS = ['h2', 'dl dt', '[data-testid="day-bar"]', 'table']

describe('PracticeLogPage', () => {
  beforeEach(() => localStorage.clear())

  it('shows streaks and totals', () => {
    localStorage.setItem(LOG_KEY, JSON.stringify(LOG))
    const { container } = renderPage()
    expect(stats(container)).toEqual([
      ['Current streak', '3 days'],
      ['Longest streak', '3 days'],
      ['Today', '15 min'],
      ['This week', '38 min'],
      ['All time', '1 h 38 min'],
    ])
  })

  it('charts the last 14 days', () => {
    localStorage.setItem(LOG_KEY, JSON.stringify(LOG))
    const { container } = renderPage()
    expect(container.querySelectorAll('[data-testid="day-bar"]')).toHaveLength(14)
    const minutes = rowsOf('Minutes practised per day')
    expect(minutes[0]).toEqual(['2026-09-14', '0'])
    expect(minutes[6]).toEqual(['2026-09-20', '60'])
    expect(minutes[13]).toEqual(['2026-09-27', '15'])
  })

  it('lists time per page this week, by page name', () => {
    localStorage.setItem(LOG_KEY, JSON.stringify(LOG))
    renderPage()
    expect(rowsOf('This week by page')).toEqual([
      ['Bend trainer', '20 min'],
      ['Tuner', '10 min'],
      ['Echo the note', '5 min'],
      ['Note quiz', '2 min'],
      ['Positions & keys', '1 min'],
    ])
  })

  it('lists recent scored sessions, newest first', () => {
    localStorage.setItem(LOG_KEY, JSON.stringify(LOG))
    renderPage()
    expect(rowsOf('Recent scored sessions')).toEqual([
      ['2026-09-27', 'Note quiz', '1800 / 2000'],
      ['2026-09-26', 'Echo the note', '1450 / 2000'],
    ])
  })

  it('clears the log only after confirming', () => {
    localStorage.setItem(LOG_KEY, JSON.stringify(LOG))
    const { container } = renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Clear log' }))
    expect(screen.getByText("Clear the whole log? This can't be undone.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(localStorage.getItem(LOG_KEY)).not.toBeNull()
    expect(stats(container)[0]).toEqual(['Current streak', '3 days'])

    fireEvent.click(screen.getByRole('button', { name: 'Clear log' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, clear the log' }))
    expect(localStorage.getItem(LOG_KEY)).toBeNull()
    expect(stats(container)[0]).toEqual(['Current streak', '0 days'])
    expect(rowsOf('This week by page')).toEqual([['Nothing yet this week.']])
    expect(screen.getByRole('button', { name: 'Clear log' })).toBeInTheDocument()
  })

  it('shows an empty log with the same layout as a full one', () => {
    const empty = renderPage()
    const emptyShape = layoutShape(empty.container, SHAPE_AREAS)
    expect(rowsOf('Recent scored sessions')).toEqual([['No scored sessions yet.']])
    expect(stats(empty.container)[2]).toEqual(['Today', '0 s'])
    empty.unmount()

    localStorage.setItem(LOG_KEY, JSON.stringify(LOG))
    const full = renderPage()
    expect(layoutShape(full.container, SHAPE_AREAS)).toEqual(emptyShape)
  })

  it('treats a corrupt log as empty', () => {
    localStorage.setItem(LOG_KEY, '{nope')
    const { container } = renderPage()
    expect(stats(container)[4]).toEqual(['All time', '0 s'])
  })
})
```

Append to `src/ui/components/Header.test.tsx`, inside `describe('Header', …)`:

```tsx
  it('links to the tools and the practice log', () => {
    render(
      <SettingsProvider storage={null}>
        <Header />
      </SettingsProvider>,
    )
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(
      within(nav)
        .getAllByRole('link')
        .map((a) => [a.textContent, a.getAttribute('href')]),
    ).toEqual([
      ['Tuner', '#/tuner'],
      ['Metronome', '#/metronome'],
      ['Log', '#/log'],
    ])
  })
```

In `src/ui/pages/homeGroups.test.ts`, change the Progress row of the expected list to:

```ts
      ['progress', 'Progress', ['log']],
```

Append to the `describe('practice time', …)` block in `src/ui/App.test.tsx`:

```tsx
  it('#/log shows the practice log and does not count its own time', () => {
    window.location.hash = '#/log'
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Practice log')
    expect(timers.calls).toEqual([])
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/pages/log src/ui/components/Header.test.tsx src/ui/pages/homeGroups.test.ts src/ui/App.test.tsx`
Expected: FAIL — `./PracticeLogPage` and `./DayChart` cannot be resolved; no "Log" link, Home entry or route.

- [ ] **Step 3: Add the visually hidden utility**

Append to `src/ui/theme.css`:

```css
/* Present for screen readers, invisible on screen (e.g. a chart's data table). */
.visually-hidden {
  position: absolute !important;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
```

- [ ] **Step 4: Write the chart**

`src/ui/pages/log/DayChart.tsx`:

```tsx
import styles from './PracticeLogPage.module.css'

interface Props {
  days: readonly { date: string; seconds: number }[]
}

const BAR_W = 14
const GAP = 6
const SLOT = BAR_W + GAP
const TOP = 16
const PLOT_H = 100
const BOTTOM = 18

/** Minutes per day as bars (spec §5), with a hidden table as the text alternative. */
export function DayChart({ days }: Props) {
  const minutes = days.map((d) => Math.round(d.seconds / 60))
  const max = Math.max(1, ...minutes)
  const width = days.length * SLOT
  const height = TOP + PLOT_H + BOTTOM
  const baseline = TOP + PLOT_H

  return (
    <figure className={styles.chart}>
      <svg
        className={styles.chartSvg}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
        focusable="false"
      >
        {days.map((d, i) => {
          const h = minutes[i] === 0 ? 0 : Math.max(2, (minutes[i] / max) * PLOT_H)
          const x = i * SLOT + GAP / 2
          return (
            <g key={d.date} data-testid="day-bar">
              <rect className={styles.bar} x={x} y={baseline - h} width={BAR_W} height={h} rx={2} />
              <text className={styles.barLabel} x={x + BAR_W / 2} y={baseline - h - 4} textAnchor="middle">
                {minutes[i] > 0 ? minutes[i] : ''}
              </text>
              <text className={styles.dayLabel} x={x + BAR_W / 2} y={height - 4} textAnchor="middle">
                {Number(d.date.slice(8))}
              </text>
            </g>
          )
        })}
        <line className={styles.axis} x1={0} x2={width} y1={baseline} y2={baseline} />
      </svg>
      <figcaption className={styles.caption}>Minutes per day (day of the month below)</figcaption>
      <table className="visually-hidden">
        <caption>Minutes practised per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Minutes</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d, i) => (
            <tr key={d.date}>
              <td>{d.date}</td>
              <td>{minutes[i]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
```

The DayChart test's middle bar (90 s → 2 min against a 25 min maximum) is `2 / 25 × 100 = 8` units tall; the test only asks for it to be above 0, and the maximum is 100.

- [ ] **Step 5: Write the page and its styles**

`src/ui/pages/log/PracticeLogPage.tsx`:

```tsx
import { useState } from 'react'
import { localDate } from '../../../core/log/dates'
import { emptyLog } from '../../../core/log/logModel'
import {
  dailySeconds,
  formatDuration,
  pageSecondsThisWeek,
  recentSessions,
  streaks,
  totals,
} from '../../../core/log/stats'
import { clearLog, loadLog } from '../../log/practiceLog'
import { browserStorage } from '../../settings/settings'
import { pageTitle } from '../homeGroups'
import { DayChart } from './DayChart'
import styles from './PracticeLogPage.module.css'

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

export function PracticeLogPage({ now = Date.now }: { now?: () => number }) {
  // A report, read once when the page opens.
  const [state, setState] = useState(() => ({
    log: loadLog(browserStorage()),
    today: localDate(now()),
  }))
  const [confirming, setConfirming] = useState(false)
  const { log, today } = state

  const streak = streaks(log, today)
  const total = totals(log, today)
  const pages = pageSecondsThisWeek(log, today)
  const sessions = recentSessions(log)

  const clear = () => {
    clearLog(browserStorage())
    setState((s) => ({ ...s, log: emptyLog() }))
    setConfirming(false)
  }

  return (
    <>
      <h1>Practice log</h1>
      <p className={styles.intro}>
        Time counts while a tool or game is open with its audio running (the positions page and
        the note quiz count while they're on screen). Everything stays in this browser.
      </p>

      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt>Current streak</dt>
          <dd>{days(streak.current)}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Longest streak</dt>
          <dd>{days(streak.longest)}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Today</dt>
          <dd>{formatDuration(total.today)}</dd>
        </div>
        <div className={styles.stat}>
          <dt>This week</dt>
          <dd>{formatDuration(total.week)}</dd>
        </div>
        <div className={styles.stat}>
          <dt>All time</dt>
          <dd>{formatDuration(total.all)}</dd>
        </div>
      </dl>
      <p className={styles.hint}>A streak day needs at least a minute of practice.</p>

      <section aria-labelledby="log-days">
        <h2 id="log-days">Last 14 days</h2>
        <DayChart days={dailySeconds(log, today)} />
      </section>

      <section aria-labelledby="log-pages">
        <h2 id="log-pages">This week by page</h2>
        <table className={styles.table} aria-labelledby="log-pages">
          <thead>
            <tr>
              <th scope="col">Page</th>
              <th scope="col">Time</th>
            </tr>
          </thead>
          <tbody>
            {pages.length === 0 ? (
              <tr>
                <td colSpan={2} className={styles.empty}>
                  Nothing yet this week.
                </td>
              </tr>
            ) : (
              pages.map((p) => (
                <tr key={p.pageId}>
                  <td>{pageTitle(p.pageId)}</td>
                  <td>{formatDuration(p.seconds)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="log-sessions">
        <h2 id="log-sessions">Recent scored sessions</h2>
        <table className={styles.table} aria-labelledby="log-sessions">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Game</th>
              <th scope="col">Score</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={3} className={styles.empty}>
                  No scored sessions yet.
                </td>
              </tr>
            ) : (
              sessions.map((s, i) => (
                <tr key={`${s.date}-${i}`}>
                  <td>{s.date}</td>
                  <td>{pageTitle(s.game)}</td>
                  <td>
                    {s.score} / {s.max}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* One fixed-height row for both states, so confirming doesn't move anything. */}
      <div className={styles.clear}>
        {confirming ? (
          <>
            <span>Clear the whole log? This can't be undone.</span>
            <button type="button" onClick={clear}>
              Yes, clear the log
            </button>
            <button type="button" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirming(true)}>
            Clear log
          </button>
        )}
      </div>
    </>
  )
}
```

`src/ui/pages/log/PracticeLogPage.module.css`:

```css
.intro,
.hint,
.empty,
.caption {
  color: var(--text-dim);
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: 0.75rem;
  margin: 0 0 0.5rem;
}

.stat {
  padding: 0.75rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}

.stat dt {
  color: var(--text-dim);
  font-size: 0.9rem;
}

.stat dd {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.chart {
  margin: 0 0 1.5rem;
}

.chartSvg {
  display: block;
  width: 100%;
  max-width: 40rem;
  height: auto;
}

.bar {
  fill: var(--accent);
}

.barLabel,
.dayLabel {
  fill: var(--text-dim);
  font-family: inherit;
  font-size: 8px;
  font-variant-numeric: tabular-nums;
}

.axis {
  stroke: var(--border);
  stroke-width: 1;
}

.caption {
  font-size: 0.85rem;
}

.table {
  width: 100%;
  max-width: 40rem;
  margin-bottom: 1.5rem;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

.table th,
.table td {
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid var(--border);
  text-align: left;
}

.clear {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  min-height: 2.75rem;
}
```

- [ ] **Step 6: Link, route and Home entry**

In `src/ui/components/Header.tsx`, add `<a href="#/log">Log</a>` after `<a href="#/metronome">Metronome</a>` inside the nav.

In `src/ui/App.tsx`, add `import { PracticeLogPage } from './pages/log/PracticeLogPage'` and the route `'/log': PracticeLogPage,` after `'/quiz': NoteQuizPage,`. `ROUTES` is typed `Record<string, ComponentType>`, and `PracticeLogPage`'s only prop is optional, so it fits.

In `src/ui/pages/homeGroups.ts`, replace `{ id: 'progress', title: 'Progress', entries: [] },` with:

```ts
  {
    id: 'progress',
    title: 'Progress',
    entries: [
      {
        id: 'log',
        icon: '📈',
        title: 'Practice log',
        text: 'Streaks, time practised per day and page, and your recent scores.',
      },
    ],
  },
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/ui && npm run typecheck && npm run lint`
Expected: PASS; no type or lint errors.

- [ ] **Step 8: Commit**

```bash
git add src/ui/pages/log src/ui/theme.css src/ui/components/Header.tsx src/ui/components/Header.test.tsx src/ui/App.tsx src/ui/pages/homeGroups.ts src/ui/pages/homeGroups.test.ts src/ui/App.test.tsx
git commit -m "feat(log): practice log page — streaks, 14-day chart, time per page, recent scores"
```

---

### Task 15: README, full verification, manual pass

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: everything above
- Produces: nothing new

- [ ] **Step 1: Update the README**

In `README.md`:

Replace the line `Tuner · Metronome · Bend trainer · Ear games` with:

```markdown
Tuner · Metronome · Positions & keys · Ear games · Note quiz · Practice log
```

Replace the sentence `It supports **all 12 keys** in standard
Richter tuning, including **bends, overblows and overdraws**.` (it spans two lines) with:

```markdown
It supports **all 12 keys** in Richter, Paddy Richter, Country and Natural minor
tuning, including **bends, overblows and overdraws**.
```

In the Tools table, add after the `Tuner — play` row:

```markdown
| 🧭 | **Positions & keys** | Which harp to use for a song, and what each harp plays in every position |
| 📈 | **Practice log** | Daily streaks, time practised per day and page, recent scores — kept in your browser |
```

In the Games table, add after the `Melody echo` row:

```markdown
| 🔎 | **Hole finder** | A note name appears — find it on your harp, no hints by ear |
| 🎓 | **Note quiz** | Name the highlighted hole, or click the hole for a note; no mic needed |
```

In the Roadmap, replace `- [ ] Later: hole finder, tab reader, alternate tunings, recorded harp samples` with:

```markdown
- [x] Alternate tunings — Paddy Richter, Country, Natural minor
- [x] Positions & keys, hole finder, note quiz
- [x] Practice log with streaks
- [x] Reed-like reference sound (Pure voice still available)
- [ ] Next: harp health check, tone meter, rhythm trainer, tab reader, lick trainer, blues play-along
- [ ] Later: recorded harp samples
```

- [ ] **Step 2: Run the full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: no lint or type errors; every test passes; `dist/` is built with no warnings about missing modules.

- [ ] **Step 3: Manual pass (real browser, real harp)**

Run: `npm run dev` and open `http://localhost:5173`. Check:
- Header reads "C harp · Richter"; switching to Country redraws the tuner chart with `-5 F#5`, and Natural minor shows three blow-bend rows. Compare each tuning's table with a real alternate-tuned harp if one is available (spec §13 manual check).
- Tuner → Play: Reed sounds reed-like with a soft breath at the onset; Pure sounds like before; both are in tune with a reference tuner (the fundamental is exact).
- Positions & keys: G / Blues says C harp; A / Minor says G harp.
- Hole finder: plays nothing; the note name is large; playing it on either hole that has it counts.
- Note quiz: no mic prompt ever appears; clicking the chart in "Find the hole" makes no sound.
- Practice log: after a minute on the tuner with audio started, "Today" shows about 1 min; a page left behind "Tap to start audio" adds nothing; a finished scored game appears under "Recent scored sessions"; "Clear log" asks before clearing.
- At phone width (390 px), the log chart, the positions tables and the quiz answer grid fit without horizontal scrolling, and nothing on the game pages jumps between phases.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README for tunings, positions, hole finder, note quiz and practice log"
```
