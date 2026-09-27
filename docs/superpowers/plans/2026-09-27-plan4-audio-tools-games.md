# Audio Tools and Games (Plan 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The six audio-heavy features: a harp health check, a tone & breath meter, a rhythm trainer, a tab reader with a song library and "Your tab", a lick trainer, and a blues play-along with a synthesised backing band. Plus the shared pieces they need: `NoteSlots`, `TabText`, `parseTab` and the chart's new `'hint'` highlight.

**Architecture:** All rules live in pure TypeScript with injected time and randomness:
- `src/core/health` for the reed measurement and summary;
- `src/core/tone` for hold statistics, vibrato and chart paths;
- `src/core/rhythm` for patterns, onsets, the beat grid and grading;
- `src/core/tab` for the tab parser, timeline, songs, licks and the judge for tab played at tempo;
- `src/core/jam` for the 12-bar form, the chord tones and a pure look-ahead backing scheduler.

The browser layer adds a `BackingScheduler` and synth voices in `src/audio/backing`, plus timed prompts in `NoteSequencer`. Pages reuse the existing game components (`Stage`, `ScorePanel`, `PlayAgain`, `ModeToggle`, `GameLayout`), `useGameAudio` (games) or `usePitch` (tools), and Plan 3's `useHarp`, `tuningPart`, `usePracticeTimer` and `HOME_GROUPS`.

Live charts and lanes update the DOM through refs on animation frames, and the tone meter and the play-along host `usePitch` in a small `MicFeed` child. So nothing re-renders a whole page 60 times a second.

**Tech Stack:** Vite, React 19, TypeScript (strict), Web Audio API, Vitest + jsdom + React Testing Library, ESLint (typescript-eslint, react-hooks v7), Prettier. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-27-more-tools-and-games-design.md` (binding). This plan implements:
- §7 harp health check;
- §8 tone & breath meter;
- §9 rhythm trainer;
- §10 tab reader;
- §11 lick trainer;
- §12 blues play-along;
- the parts of §13 those need;
- the Home entries of §0 for these pages.

Conventions come from `docs/superpowers/specs/2026-09-26-harmonica-tools-design.md`.

**Scope:** This is **Plan 4**. It runs **after Plan 3** (`docs/superpowers/plans/2026-09-27-plan3-tunings-quick-tools-log.md`) is merged, and it relies on these Plan 3 interfaces. Task 1 checks each one before anything else is done:
- `buildHarp(key: HarpKey, tuning: TuningId = 'richter')`
- `type TuningId = 'richter' | 'paddy' | 'country' | 'naturalMinor'`, `TUNINGS`
- `Settings.tuning: TuningId`, `Settings.sound: SoundVoice`
- `useHarp(): HarpNote[]` in `src/ui/hooks/useHarp.ts`
- `tuningPart(tuning: TuningId): Record<string, string>` and `GameId` in `src/ui/scores/bestScores.ts`
- `usePracticeTimer(pageId: string, opts?: { requireAudio?: boolean })` in `src/ui/hooks/usePracticeTimer.ts`. Every new page calls it with its Home entry id.
- `useScoring(mode, bestKey, totalRounds?)`, which appends a practice-log session itself when a scored session finishes
- `HOME_GROUPS` (`HomeEntry { id, icon, title, text }`) in `src/ui/pages/homeGroups.ts` and its test `src/ui/pages/homeGroups.test.ts`
- `pitchClassName(pc, spelling)` (`src/core/music/noteNames.ts`); `positionTonicPc(harpKey, position)` and `positionLabel(position)` (`src/core/harmonica/positions.ts`); `localDate(ms)` (`src/core/log/dates.ts`)
- the global `.visually-hidden` class in `src/ui/theme.css`

**Decisions this plan makes where the spec is open.** Each one is repeated in the task that implements it.

1. **Shared pieces.**
   - `SessionState` gains `roundMax` (default 200), and `useScoring` gains an optional fourth argument for it. The rhythm trainer and the tab reader score at most 100 per hit, so the final line should read "/ 3200", not "/ 6400".
   - `NoteSequencer.playTimed` (with `GameAudio.playTimed`) plays notes and rests with their own lengths. Each note sounds for 90 % of its slot.
   - `mean`, `median` and `stdDev` live in `src/core/stats.ts`.
   - `'hint'` is the technique colour at 55 % fill, with no ring.
2. **Health check.**
   - Every reed after the first waits for a moment of silence before it is measured. Neighbouring reeds can share a pitch: 2 draw and 3 blow are both G on a Richter harp.
   - A dropped frame (a gap of 100 ms or less) doesn't break the steady second.
   - "Redo reed" goes back to the previous reed.
   - Changing the key, tuning or A4 restarts the check.
   - An A4 suggestion needs at least 5 measured reeds and an average offset of at least 5 cents. It is rounded to the Hz and kept inside the A4 setting's range.
   - Deltas against the previous check are shown only when that check used the same A4.
3. **Tone meter.**
   - The stats panel refreshes every 250 ms. The last note's stats stay visible, dimmed, until the next note.
   - Vibrato depth is twice the median peak of the complete half-cycles, and crossings use ±2 cents of hysteresis.
   - Pitch and level share one chart, each with its own scale.
4. **Rhythm trainer.**
   - The beat grid is the median fit of the last 8 heard beats (`BeatAnchor`).
   - A change of note only counts as a new onset 100 ms or more after the previous onset.
   - Both modes start with the count-in bar.
   - Practice shows the average over the last 8 hits.
   - Each expected hit is one scored round worth up to 100 points.
   - The best-score key is pattern + BPM bucket only. Pitch doesn't matter here, so the key, the tuning and the matching settings aren't part of it.
5. **Tab reader.**
   - The count-in is one bar of the song's metre (3 or 4 beats). The tempo is the shared BPM.
   - The metronome clicks only when playing at tempo.
   - "Wait for me" follows the notes with `ScaleRun` at a 250 ms hold.
   - The mic can't hear a tongued repeat, so a repeated pitch that is still sounding counts as played on time.
   - The best score is per song, plus `tuningPart`. "Your tab" is keyed by a hash of its text.
   - A row of 6 `NoteSlots` shows the previous note and the next five.
6. **Songs.**
   - They are written from memory in 1st position, in holes 4–9 without bends (Ode to Joy has one low `-2`). Leading rests line pickups up with the bars.
   - Every song and lick parses on all 12 keys in all 4 tunings (pinned by a test).
7. **Lick trainer.**
   - Practice never moves on by itself.
   - The tab line is revealed on the result too.
   - The best key is style + key + BPM + matcher thresholds + `tuningPart`.
8. **Play-along.**
   - The straight feel's bass is root–3rd–5th–6th in quarters. Chord stabs fall on every offbeat and last 120 ms.
   - The bass root is in C2–B2, and the chords are voiced with their root in E3–D#4.
   - The tempo slider writes the shared BPM; the backing clamps it to 60–160.
   - Chord names use the harp key's spelling.
   - With the mic on, detected notes override the chord and scale marks.

## Global Constraints

- Fully static build; **hash-based routing** (`/#/health`, `/#/tone`, `/#/rhythm`, `/#/tab-reader`, `/#/licks`, `/#/jam`); Vite `base: './'`. No backend, no accounts.
- **Vite + React 19 + TypeScript strict mode**. No UI component library, no global store library, no router library, **no new npm dependencies**.
- **English-only UI.** No i18n layer.
- **Persistence: `localStorage` only**, always through functions that tolerate missing, corrupt or throwing storage. New keys: `harp-tools:health` (the last check per key + tuning) and `harp-tools:your-tab`.
- `src/core/` never imports browser APIs or React and never calls `Date.now()`, `performance.now()`, `Math.random()` or `setTimeout`; time and randomness are passed in. `src/audio/` never imports React.
- **Mic access only through `useGameAudio` (games) or `usePitch` (tools).** `AudioGate` wraps every page that makes or hears sound.
- **Every page uses `settings.tuning`** (through `useHarp()`), and every new page calls `usePracticeTimer(<its Home entry id>)`.
- **Stable layout:** every area that can appear during a session is always rendered, and each new page gets a layout-stability test (`layoutShape` from `src/test/layout.ts`).
- **Performance:** the tone meter, the tab reader lane and the backing track must not re-render the whole page 60 times a second. Chart and lane layers are updated through refs, in effects or animation-frame callbacks, never during render.
- **Health check:** 20 unbent reeds (hole 1 blow … hole 10 draw); a reed is measured after **1 s** of continuous readings within **±60 cents**, recording the **median** cents; cells coloured with the tuner's thresholds (**±10 / ±25**).
- **Tone meter:** a rolling **6-second** chart at **30 fps**; pitch in cents from the nearest note (**±50**), level in dB (**−60 to 0**); a held note resets on **> 150 ms** of silence or a change of note; vibrato only after **1 s**, over the last **2 s**, "None" if depth **< 8 cents** or rate outside **3–9 Hz**.
- **Rhythm trainer:** onsets after **≥ 80 ms** without a pitched reading or on a change of note, timestamped minus **60 ms**; matched within **±250 ms**; Perfect **≤ 40 ms**, Good **≤ 100 ms**, Off **≤ 250 ms**, else Miss; points **100 / 70 / 30 / 0**; scored = **1 count-in bar + 8 bars**; best per pattern and BPM rounded to the nearest **10**.
- **Tab format:** space-separated tokens: notes in tab notation, `_` rest, `:beats` duration (default 1), `|` bar line (no time). Key-relative, resolved against the current tuning. Invalid tokens are reported with their position.
- **Tab reader:** practice "Wait for me" (default on) pauses at each note until it is held **250 ms**. At tempo, a note is hit when held ≥ **min(250 ms, 60 % of its length)**, starting within **±150 ms**. Points = **100 × timing factor** (1 within ±50 ms, falling linearly to 0.5 at ±150 ms). One scored session is the whole song.
- **Lick trainer:** **16** original licks (**10** 2nd-position blues, **3** 1st-position folk, **3** 3rd-position minor), played at the chosen BPM with durations. Echoing uses `MelodyRound` (melody hold, 250 ms default). Scored = **10** random licks, melody points.
- **Play-along:** 2nd position by default (1st and 3rd optional); 12-bar I–IV–V with an optional quick change, turnaround I–V in bars 11–12; **60–160 BPM**; Shuffle (2:1, default) or Straight. Kick on 1 and 3, snare on 2 and 4, hat on the (swung) eighths, walking bass, dominant-7th stabs on the offbeats. Volume and mute per instrument. The mic is off by default and there is no scoring.
- `HarmonicaDiagram` gains exactly one styling change: the `'hint'` highlight.
- Tests are colocated as `*.test.ts(x)` next to the source file.
- Code style: Prettier with `semi: false`, `singleQuote: true`, `printWidth: 100`. Run `npx prettier --write` on every file a task creates or changes.
- React code must pass `eslint-plugin-react-hooks` v7:
  - no `ref.current` reads during render;
  - no `Date.now()`, `performance.now()` or `Math.random()` calls during render;
  - no synchronous `setState` in effect bodies;
  - no manual memoization the compiler can't preserve.

  Mutable objects live in `useState`-held instances and are only touched from handlers, effects and callbacks.

## Review Focus

1. **Two neighbouring reeds with the same pitch** (2 draw and 3 blow are both G4 on a Richter harp). The player keeps drawing after hole 2 draw is measured → 3 blow is **not** measured from that same breath. The check waits for silence and says "Stop, then play the next reed." Pinned by the `afterSilence` test in Task 5 and the page test in Task 6.
2. **A repeated note played legato** in the tab reader (Mary Had a Little Lamb's "E E E", where the mic hears one long E) → every repeat counts as played on time, not as a miss. Pinned by the `TabJudge` test in Task 11.
3. **"Your tab" that can't be played**: empty text, only rests and bar lines, garbage tokens, or a note the current tuning lacks (`-3''` on a Paddy harp) → an alert that names each bad token and its position, and no Start button. Nothing throws. Pinned by the parser tests in Task 3 and the page tests in Task 12.
4. **A throttled background tab** while the backing track plays → the scheduler skips the missed beats instead of firing a burst of drums when the tab wakes up. Pinned by the `scheduleBacking` test in Task 15.
5. **Changing tempo, key or tuning mid-song** → the song stops, nothing is scored against the old settings, and the next run starts clean. Pinned by the tempo-change test in Task 12 (every page uses the same keyed-remount pattern).

---

## File Structure

```
src/
  core/
    stats.ts                    (new) mean, median, stdDev
    games/session.ts            (modify) SessionState.roundMax, startSession(mode, rounds, roundMax)
    health/healthCheck.ts       (new) Reed, healthReeds, ReedMeasure, summarizeHealth
    tone/analysis.ts            (new) ToneSample, HoldStats, detectVibrato, analyzeHold, HoldTracker
    tone/history.ts             (new) TonePoint, ToneHistory (6 s ring), tracePath (SVG paths)
    rhythm/beatAnchor.ts        (new) BeatAnchor: the metronome grid from heard beats
    rhythm/rhythmTrainer.ts     (new) RHYTHM_PATTERNS, gradeOffset, OnsetDetector, RhythmSession,
                                      averageOffset, bpmBucket
    tab/parseTab.ts             (new) parseTab, tabTimeline, beatMs, textHash
    tab/songs.ts                (new) Song, SONGS
    tab/licks.ts                (new) LickStyle, LICK_STYLES, Lick, LICKS
    tab/tabJudge.ts             (new) requiredHoldMs, timingFactor, TabJudge, WaitClock
    tab/lickTrainer.ts          (new) lickNotes, playableLicks, pickLick, promptNotes
    jam/blues.ts                (new) Degree, bluesForm, chordRootPc, chordPcs, chordName, jamMarks
    jam/backingSchedule.ts      (new) Feel, Instrument, BackingConfig, scheduleBacking (pure)
  audio/
    NoteSequencer.ts            (modify) TimedPrompt, LEGATO, playTimed
    backing/voices.ts           (new) noise buffer, kick, snare, hat, bass, chord voices
    backing/BackingScheduler.ts (new) look-ahead scheduler + mixer channels, Mix, DEFAULT_MIX
  test/
    fakeGameAudio.ts            (modify) playTimed, fakeAudio.timed
  ui/
    theme.css                   (modify) .micStatus
    scores/bestScores.ts        (modify) GameId + 'rhythm' | 'tab-reader' | 'licks'
    health/healthStore.ts       (new) HEALTH_KEY, healthId, loadHealth, saveHealth
    tab/yourTab.ts              (new) YOUR_TAB_KEY, EXAMPLE_TAB, loadYourTab, saveYourTab
    hooks/useAnimationFrame.ts  (new) rAF loop with a minimum interval, latest callback
    hooks/useScoring.ts         (modify) optional roundMax
    hooks/useGameAudio.ts       (modify) playTimed
    hooks/useBacking.ts         (new) the play-along's scheduler: running, bar, toggle
    components/HarmonicaDiagram.tsx (+ .module.css) (modify) 'hint' highlight
    components/TabText.tsx      (+ .module.css) (new) TabText, TabLine
    components/MicFeed.tsx      (new) hosts usePitch so only its status line re-renders per frame
    components/game/NoteSlots.tsx (new) NoteSlots, NoteSlot, SlotState
    components/game/Game.module.css (modify) scrolling .slots, .tabLine
    pages/melody/MelodyEchoPage.tsx (modify) uses NoteSlots and TabText
    pages/health/HealthCheckPage.tsx (+ .module.css) (new)
    pages/tone/ToneMeterPage.tsx, ToneChart.tsx (+ .module.css) (new)
    pages/rhythm/RhythmTrainerPage.tsx (+ .module.css) (new)
    pages/tabReader/TabReaderPage.tsx (+ .module.css) (new)
    pages/licks/LickTrainerPage.tsx (new)
    pages/jam/JamPage.tsx       (+ .module.css) (new)
    pages/homeGroups.ts         (modify) six entries; homeGroups.test.ts rows
    App.tsx                     (modify) six routes; App.test.tsx titles
README.md                       (modify) features and roadmap
```

---

### Task 1: Check that Plan 3's interfaces exist

**Files:**
- Read only: `src/core/harmonica/harp.ts`, `src/core/harmonica/tunings.ts`, `src/core/harmonica/positions.ts`, `src/core/music/noteNames.ts`, `src/core/log/dates.ts`, `src/ui/settings/settings.ts`, `src/ui/hooks/useHarp.ts`, `src/ui/hooks/usePracticeTimer.ts`, `src/ui/hooks/useScoring.ts`, `src/ui/scores/bestScores.ts`, `src/ui/pages/homeGroups.ts`, `src/ui/pages/homeGroups.test.ts`, `src/ui/theme.css`

**Interfaces:**
- Consumes: Plan 3, merged
- Produces: nothing. This task changes no file.

Every later task assumes these names and signatures. **If any check below prints nothing, or prints something different, stop and report which interface is missing. Don't write stand-ins.**

- [ ] **Step 1: Check the harp, tuning, position and date helpers**

Run:

```bash
grep -n "export function buildHarp(key: HarpKey, tuning: TuningId = 'richter')" src/core/harmonica/harp.ts
grep -n "export type TuningId = 'richter' | 'paddy' | 'country' | 'naturalMinor'" src/core/harmonica/tunings.ts
grep -n "export const TUNINGS" src/core/harmonica/tunings.ts
grep -nE "export function (positionTonicPc|positionLabel)" src/core/harmonica/positions.ts
grep -n "export function pitchClassName" src/core/music/noteNames.ts
grep -n "export function localDate(ms: number): string" src/core/log/dates.ts
```

Expected: one line for each command, and two for the `positions.ts` one.

- [ ] **Step 2: Check the settings, hooks and best-score helpers**

Run:

```bash
grep -nE "^  (tuning: TuningId|sound: SoundVoice)$" src/ui/settings/settings.ts
grep -n "export function useHarp(): HarpNote\[\]" src/ui/hooks/useHarp.ts
grep -n "export function usePracticeTimer(pageId: string" src/ui/hooks/usePracticeTimer.ts
grep -n "export function tuningPart(tuning: TuningId): Record<string, string>" src/ui/scores/bestScores.ts
grep -n "export type GameId = 'echo' | 'bend' | 'scales' | 'intervals' | 'melody' | 'hole-finder' | 'quiz'" src/ui/scores/bestScores.ts
grep -n "appendSession" src/ui/hooks/useScoring.ts
grep -n "export function useScoring(mode: GameMode, bestKey: string, totalRounds = SCORED_ROUNDS): Scoring {" src/ui/hooks/useScoring.ts
```

Expected: two lines for `settings.ts` and at least one line for each of the others. Task 9 edits the `useScoring` signature line exactly as printed here.

- [ ] **Step 3: Check the Home groups and the global utility class**

Run:

```bash
grep -n "export const HOME_GROUPS: readonly HomeGroup\[\]" src/ui/pages/homeGroups.ts
grep -nE "\['(tools|games|jam|progress)'" src/ui/pages/homeGroups.test.ts
grep -n "^\.visually-hidden" src/ui/theme.css
```

Expected: the `HOME_GROUPS` line, the `.visually-hidden` line, and these four rows from the test:

```
      ['tools', 'Tools', ['tuner', 'metronome', 'positions']],
      ['games', 'Games', ['echo', 'bend', 'scales', 'intervals', 'melody', 'hole-finder', 'quiz']],
      ['jam', 'Jam', []],
      ['progress', 'Progress', ['log']],
```

Tasks 6, 8, 10, 12, 14 and 17 change these rows one at a time.

- [ ] **Step 4: Check that the suite is green before starting**

Run: `npm test && npm run typecheck && npm run lint`
Expected: every test passes; no type or lint errors.

Nothing to commit.

---

### Task 2: Shared UI: the `'hint'` highlight, `TabText`, `NoteSlots`, `MicFeed`, `useAnimationFrame`

**Files:**
- Modify: `src/ui/components/HarmonicaDiagram.tsx`, `src/ui/components/HarmonicaDiagram.module.css`
- Create: `src/ui/components/TabText.tsx`, `src/ui/components/TabText.module.css`
- Create: `src/ui/components/game/NoteSlots.tsx`
- Modify: `src/ui/components/game/Game.module.css`
- Create: `src/ui/components/MicFeed.tsx`
- Modify: `src/ui/theme.css`
- Create: `src/ui/hooks/useAnimationFrame.ts`
- Modify: `src/ui/pages/melody/MelodyEchoPage.tsx`
- Test: `src/ui/components/HarmonicaDiagram.test.tsx` (append), `src/ui/components/TabText.test.tsx`, `src/ui/components/game/GameComponents.test.tsx` (append), `src/ui/components/MicFeed.test.tsx`, `src/ui/hooks/useAnimationFrame.test.tsx`

**Interfaces:**
- Consumes: `usePitch(enabled: boolean, onReading?: PitchListener): PitchState` (hooks/usePitch.ts); `MicErrorNotice`; `PitchListener` (audio/pitch/PitchDetector.ts)
- Produces:
  - `type Highlight = 'detected' | 'target' | 'correct' | 'wrong' | 'hint'` (HarmonicaDiagram.tsx)
  - `TabText({ tab: string })` and `TabLine({ tabs: readonly string[] })` (components/TabText.tsx)
  - `type SlotState = 'todo' | 'current' | 'done' | 'wrong'`, `interface NoteSlot { label: ReactNode; state: SlotState }`, `NoteSlots({ label: string; slots: readonly NoteSlot[] })`: an `<ol aria-label={label}>` (components/game/NoteSlots.tsx)
  - `.tabLine` class in `Game.module.css`: a reserved one-line row under a slot row
  - `MicFeed({ onReading: PitchListener; enabled?: boolean })`: renders the mic error and an always-present `<p className="micStatus">`
  - `useAnimationFrame(draw: (nowMs: number) => void, minIntervalMs = 0): void`

Spec §12 ("new highlight state") and §13 (shared tab rendering, the generalised phrase slots, performance).

`usePitch` re-renders its host on every mic frame. `MicFeed` gives it a host of its own, so a page with a live chart only re-renders this status line 60 times a second. `useAnimationFrame` keeps the latest `draw` in a ref that it updates in an effect, which is the pattern react-hooks v7 allows.

The Melody phrase row becomes `NoteSlots`. Its accessible name stays "Phrase", so the Melody tests pass unchanged. The `.slots` row now scrolls sideways instead of clipping, because licks can have up to 8 notes.

- [ ] **Step 1: Write the failing tests**

Append to `src/ui/components/HarmonicaDiagram.test.tsx`, inside `describe('HarmonicaDiagram', …)` (the file already imports `noteId` and defines `harp` and `renderDiagram`):

```tsx
  it('marks hint notes with their own, weaker highlight', () => {
    const g4 = harp.find((n) => n.hole === 2 && n.technique === 'draw')!
    renderDiagram({ highlights: new Map([[noteId(g4), 'hint']]) })
    expect(screen.getByRole('button', { name: '-2 G4' })).toHaveAttribute('data-highlight', 'hint')
  })
```

`src/ui/components/TabText.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TabLine, TabText } from './TabText'

describe('TabText', () => {
  it('shows the token as written', () => {
    render(<TabText tab="-3''" />)
    expect(screen.getByText("-3''")).toHaveClass('tab')
  })

  it('lays out a row of tokens in order', () => {
    const { container } = render(<TabLine tabs={['-2', "-3'", '4']} />)
    expect([...container.querySelectorAll('.tab')].map((e) => e.textContent)).toEqual([
      '-2',
      "-3'",
      '4',
    ])
  })
})
```

Append to `src/ui/components/game/GameComponents.test.tsx`, and add `import { NoteSlots } from './NoteSlots'` to its imports:

```tsx
describe('NoteSlots', () => {
  it('renders one slot per note with its state', () => {
    render(
      <NoteSlots
        label="Lick"
        slots={[
          { label: 'G4', state: 'done' },
          { label: 2, state: 'current' },
          { label: 3, state: 'todo' },
        ]}
      />,
    )
    const items = screen.getAllByRole('listitem')
    expect(items.map((li) => [li.textContent, li.dataset.state])).toEqual([
      ['G4', 'done'],
      ['2', 'current'],
      ['3', 'todo'],
    ])
    expect(screen.getByRole('list', { name: 'Lick' })).toBeInTheDocument()
  })
})
```

`src/ui/components/MicFeed.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PitchListener } from '../../audio/pitch/PitchDetector'
import type { PitchState } from '../hooks/usePitch'
import { MicFeed } from './MicFeed'

const pitch = vi.hoisted(() => ({
  state: { reading: null, rms: 0, status: 'starting', error: null } as PitchState,
  enabled: null as boolean | null,
  listener: null as PitchListener | null,
}))
vi.mock('../hooks/usePitch', () => ({
  usePitch: (enabled: boolean, onReading: PitchListener) => {
    pitch.enabled = enabled
    pitch.listener = onReading
    return pitch.state
  },
}))

describe('MicFeed', () => {
  it('passes readings through and keeps its status line in every state', () => {
    const onReading = vi.fn()
    const { container, rerender } = render(<MicFeed onReading={onReading} />)
    expect(pitch.enabled).toBe(true)
    expect(screen.getByText('Waiting for microphone permission…')).toBeInTheDocument()
    const shape = [...container.children].map((e) => e.tagName)

    pitch.state = { reading: null, rms: 0, status: 'listening', error: null }
    rerender(<MicFeed onReading={onReading} />)
    expect(screen.queryByText('Waiting for microphone permission…')).toBeNull()
    expect([...container.children].map((e) => e.tagName)).toEqual(shape)

    pitch.listener?.({ freq: 440, clarity: 1, rms: 0.1 }, 0.1)
    expect(onReading).toHaveBeenCalledWith({ freq: 440, clarity: 1, rms: 0.1 }, 0.1)
  })

  it('shows the mic error', () => {
    pitch.state = { reading: null, rms: 0, status: 'error', error: 'denied' }
    render(<MicFeed onReading={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Microphone permission was denied')
  })
})
```

`src/ui/hooks/useAnimationFrame.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAnimationFrame } from './useAnimationFrame'

describe('useAnimationFrame', () => {
  let callbacks: FrameRequestCallback[] = []
  beforeEach(() => {
    callbacks = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => callbacks.push(cb))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })
  afterEach(() => vi.unstubAllGlobals())

  /** Runs the pending frame at `t`. */
  const frame = (t: number) => {
    const pending = callbacks
    callbacks = []
    pending.forEach((cb) => cb(t))
  }

  it('draws at most once per interval', () => {
    const draw = vi.fn()
    renderHook(() => useAnimationFrame(draw, 30))
    ;[0, 16, 33, 50, 66].forEach(frame)
    expect(draw.mock.calls.map((c) => c[0])).toEqual([0, 33, 66])
  })

  it('always calls the latest draw function and stops on unmount', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender, unmount } = renderHook(({ draw }) => useAnimationFrame(draw), {
      initialProps: { draw: first },
    })
    frame(0)
    rerender({ draw: second })
    frame(16)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledWith(16)
    unmount()
    expect(cancelAnimationFrame).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/components src/ui/hooks/useAnimationFrame.test.tsx`
Expected: FAIL. `./TabText`, `./NoteSlots`, `./MicFeed` and `./useAnimationFrame` can't be resolved. The hint test fails on the `Highlight` type only under `npm run typecheck`, since vitest doesn't type-check.

- [ ] **Step 3: Add the `'hint'` highlight**

In `src/ui/components/HarmonicaDiagram.tsx`, replace the `Highlight` line with:

```tsx
/** `hint` is a weaker suggestion than `target` (the jam page's blues-scale notes). */
export type Highlight = 'detected' | 'target' | 'correct' | 'wrong' | 'hint'
```

In `src/ui/components/HarmonicaDiagram.module.css`, add right before the `.cell[data-highlight='correct']` rule:

```css
/* Weaker than target: the technique colour filled in at low opacity, with no ring. */
.cell[data-highlight='hint'] {
  opacity: 1;
  background: color-mix(in srgb, var(--c) 55%, var(--surface));
}
```

- [ ] **Step 4: Write `TabText`, `NoteSlots`, `MicFeed` and `useAnimationFrame`**

`src/ui/components/TabText.tsx`:

```tsx
import styles from './TabText.module.css'

/** One tab token (`-3'`, `6o`, `_`) in the site's tab style: monospace, never wrapped. */
export function TabText({ tab }: { tab: string }) {
  return <span className={styles.tab}>{tab}</span>
}

/** A row of tab tokens separated by thin gaps, e.g. a lick's "Show tab" line. */
export function TabLine({ tabs }: { tabs: readonly string[] }) {
  return (
    <span className={styles.line}>
      {tabs.map((t, i) => (
        <TabText key={i} tab={t} />
      ))}
    </span>
  )
}
```

`src/ui/components/TabText.module.css`:

```css
.tab {
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.line {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.2rem 0.6rem;
}
```

`src/ui/components/game/NoteSlots.tsx`:

```tsx
import type { ReactNode } from 'react'
import styles from './Game.module.css'

export type SlotState = 'todo' | 'current' | 'done' | 'wrong'

export interface NoteSlot {
  label: ReactNode
  state: SlotState
}

/**
 * A row of note slots (a melody phrase, a lick, the tab reader's next notes). The row is always
 * rendered at a fixed height, so filling or emptying it never moves the page.
 */
export function NoteSlots({ label, slots }: { label: string; slots: readonly NoteSlot[] }) {
  return (
    <ol className={styles.slots} aria-label={label}>
      {slots.map((s, i) => (
        <li key={i} className={styles.slot} data-state={s.state}>
          {s.label}
        </li>
      ))}
    </ol>
  )
}
```

In `src/ui/components/game/Game.module.css`, replace the `.slots` rule and its comment with:

```css
/* One row of slots, always rendered: 5 slots fit at 390 px; longer rows (licks) scroll. */
.slots {
  display: flex;
  height: 2.75rem;
  margin: 0 0 1rem;
  overflow-x: auto;
  overflow-y: hidden;
  gap: 0.5rem;
  padding: 0;
  list-style: none;
}
```

add `flex: none;` as the first declaration of the `.slot` rule, and append:

```css
/* A reserved line under a slot row (the lick trainer's "Show tab"). */
.tabLine {
  height: 1.5rem;
  margin: -0.5rem 0 1rem;
  overflow: hidden;
  color: var(--text-dim);
  white-space: nowrap;
}
```

`src/ui/components/MicFeed.tsx`:

```tsx
import type { PitchListener } from '../../audio/pitch/PitchDetector'
import { usePitch } from '../hooks/usePitch'
import { MicErrorNotice } from './MicErrorNotice'

interface Props {
  /** Receives every detector frame, outside render. */
  onReading: PitchListener
  enabled?: boolean
}

/**
 * Hosts `usePitch` in a component of its own: the hook re-renders its host on every mic frame,
 * so a page with a live chart keeps it here and only this status line re-renders 60 times a
 * second. The line is always rendered, so the page doesn't jump while the mic starts.
 */
export function MicFeed({ onReading, enabled = true }: Props) {
  const { status, error } = usePitch(enabled, onReading)
  return (
    <>
      {error && <MicErrorNotice kind={error} />}
      <p className="micStatus">{status === 'starting' && 'Waiting for microphone permission…'}</p>
    </>
  )
}
```

Append to `src/ui/theme.css`:

```css

/* The mic's "waiting for permission" line: always one line tall, empty once listening. */
.micStatus {
  min-height: 1.5em;
  margin: 0.5rem 0;
  color: var(--text-dim);
}
```

`src/ui/hooks/useAnimationFrame.ts`:

```ts
import { useEffect, useRef } from 'react'

/**
 * Calls `draw(nowMs)` on animation frames at most every `minIntervalMs`, for charts and lanes
 * that update the DOM through refs instead of re-rendering. `nowMs` is on the performance.now()
 * clock, the same one mic readings use. Stops on unmount.
 */
export function useAnimationFrame(draw: (nowMs: number) => void, minIntervalMs = 0): void {
  const latest = useRef(draw)
  useEffect(() => {
    latest.current = draw
  })
  useEffect(() => {
    let id = 0
    let last = -Infinity
    const frame = (nowMs: number) => {
      if (nowMs - last >= minIntervalMs) {
        last = nowMs
        latest.current(nowMs)
      }
      id = requestAnimationFrame(frame)
    }
    id = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(id)
  }, [minIntervalMs])
}
```

- [ ] **Step 5: Move Melody echo onto `NoteSlots` and `TabText`**

In `src/ui/pages/melody/MelodyEchoPage.tsx`:
- Add these imports:

  ```tsx
  import { TabText } from '../../components/TabText'
  import { NoteSlots, type SlotState } from '../../components/game/NoteSlots'
  ```

- Change `const slotState = (i: number) => {` to `const slotState = (i: number): SlotState => {`.
- In `slotLabel`, change `if (hole) return tabLabel(hole)` to `if (hole) return <TabText tab={tabLabel(hole)} />`.
- Replace the whole `<ol className={styles.slots} aria-label="Phrase"> … </ol>` element (keep the comment above it) with:

```tsx
      <NoteSlots
        label="Phrase"
        slots={
          phrase.length > 0
            ? phrase.map((m, i) => ({ label: slotLabel(m, i), state: slotState(i) }))
            : Array.from({ length }, (_, i) => ({ label: i + 1, state: 'todo' as const }))
        }
      />
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/ui && npm run typecheck && npm run lint`
Expected: PASS, including the unchanged Melody echo tests; no type or lint errors.

- [ ] **Step 7: Commit**

```bash
git add src/ui/components src/ui/hooks/useAnimationFrame.ts src/ui/hooks/useAnimationFrame.test.tsx src/ui/theme.css src/ui/pages/melody/MelodyEchoPage.tsx
git commit -m "feat(ui): hint highlight, TabText, NoteSlots, MicFeed and an animation-frame hook"
```

---

### Task 3: Tab parser and timeline

**Files:**
- Create: `src/core/tab/parseTab.ts`
- Test: `src/core/tab/parseTab.test.ts`

**Interfaces:**
- Consumes: `tabLabel(note: HarpNote): string`, `HarpNote` (harmonica/harp.ts); `buildHarp(key, tuning)` (Plan 3, test only)
- Produces:
  - `interface TabNoteItem { kind: 'note'; tab: string; note: HarpNote; beats: number }`, `interface TabRestItem { kind: 'rest'; beats: number }`, `interface TabBarItem { kind: 'bar' }`, `type TabItem`
  - `interface TabError { position: number; token: string; message: string }`, where `position` is the token's 1-based number
  - `parseTab(text: string, harp: readonly HarpNote[]): { items: TabItem[]; errors: TabError[] }`
  - `interface TimedNote { index: number; tab: string; note: HarpNote; startBeat: number; beats: number }`
  - `tabTimeline(items: readonly TabItem[]): { notes: TimedNote[]; bars: number[]; totalBeats: number }`, exported as `TabTimeline`
  - `beatMs(bpm: number): number`
  - `textHash(text: string): string`

Spec §10, tab format.
- A note token must look like a tab label (`-?` hole 1–10, then `'`–`'''`, `o` or `od`). It resolves through `tabLabel` against the harp it's given, so tab is key-relative and follows the tuning. A shape that the harp doesn't have (`4'`, `2od`, `-3''` on a Paddy harp) is an error.
- Bad tokens are skipped and reported. The good ones are still returned, so the page can list every error at once.
- `textHash` (djb2, base 36) keys "Your tab" best scores to the text they were set with.

- [ ] **Step 1: Write the failing test**

`src/core/tab/parseTab.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildHarp } from '../harmonica/harp'
import { beatMs, parseTab, tabTimeline, textHash, type TabItem } from './parseTab'

const c = buildHarp('C')
const summary = (items: TabItem[]) =>
  items.map((i) =>
    i.kind === 'note'
      ? `${i.tab}=${i.note.midi}:${i.beats}`
      : i.kind === 'rest'
        ? `_:${i.beats}`
        : '|',
  )

describe('parseTab', () => {
  it('reads notes in every technique', () => {
    const { items, errors } = parseTab("4 -4 -3' -3'' 6o 7od 10''", c)
    expect(errors).toEqual([])
    expect(summary(items)).toEqual([
      '4=72:1',
      '-4=74:1',
      "-3'=70:1",
      "-3''=69:1",
      '6o=82:1',
      '7od=85:1',
      "10''=94:1",
    ])
  })

  it('reads durations, rests and bar lines, and ignores extra spaces', () => {
    const { items, errors } = parseTab('  4:2   -4:0.5 _ | _:1.5 5:.5\n6 ', c)
    expect(errors).toEqual([])
    expect(summary(items)).toEqual([
      '4=72:2',
      '-4=74:0.5',
      '_:1',
      '|',
      '_:1.5',
      '5=76:0.5',
      '6=79:1',
    ])
  })

  it('reports each bad token with its position', () => {
    const { items, errors } = parseTab("4 x -11 4:0 4:-1 4:: -4:2:1 4' 2od |", c)
    expect(summary(items)).toEqual(['4=72:1', '|'])
    expect(errors).toEqual([
      { position: 2, token: 'x', message: 'is not a note, rest (_) or bar line (|)' },
      { position: 3, token: '-11', message: 'is not a note, rest (_) or bar line (|)' },
      { position: 4, token: '4:0', message: 'the duration must be a positive number of beats' },
      { position: 5, token: '4:-1', message: 'the duration must be a positive number of beats' },
      { position: 6, token: '4::', message: 'has more than one duration' },
      { position: 7, token: '-4:2:1', message: 'has more than one duration' },
      { position: 8, token: "4'", message: "isn't on this harp" },
      { position: 9, token: '2od', message: "isn't on this harp" },
    ])
  })

  it('is key-relative: the same tab plays in any key', () => {
    const g = parseTab('4 -4', buildHarp('G'))
    expect(summary(g.items)).toEqual(['4=67:1', '-4=69:1'])
  })

  it("resolves against the tuning: a Paddy harp has no -3'' but a Country harp has -5'", () => {
    expect(parseTab("-3''", c).errors).toEqual([])
    expect(parseTab("-3''", buildHarp('C', 'paddy')).errors).toEqual([
      { position: 1, token: "-3''", message: "isn't on this harp" },
    ])
    expect(summary(parseTab("-5 -5'", buildHarp('C', 'country')).items)).toEqual([
      '-5=78:1',
      "-5'=77:1",
    ])
    expect(parseTab("-5'", c).errors).toHaveLength(1)
  })

  it('returns nothing for empty text', () => {
    expect(parseTab('   ', c)).toEqual({ items: [], errors: [] })
  })
})

describe('tabTimeline', () => {
  it('places notes on the beat grid; rests take time, bar lines do not', () => {
    const { items } = parseTab('4 -4:2 | _:0.5 5:1.5 |', c)
    const t = tabTimeline(items)
    expect(t.notes.map((n) => [n.index, n.tab, n.startBeat, n.beats])).toEqual([
      [0, '4', 0, 1],
      [1, '-4', 1, 2],
      [2, '5', 3.5, 1.5],
    ])
    expect(t.bars).toEqual([3, 5])
    expect(t.totalBeats).toBe(5)
  })
})

describe('beatMs', () => {
  it('is the length of a beat at a tempo', () => {
    expect(beatMs(120)).toBe(500)
    expect(beatMs(90)).toBeCloseTo(666.667, 3)
  })
})

describe('textHash', () => {
  it('is stable and tells different texts apart', () => {
    expect(textHash('4 -4 5')).toBe(textHash('4 -4 5'))
    expect(textHash('4 -4 5')).not.toBe(textHash('4 -4 6'))
    expect(textHash('')).toBe('45h')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/core/tab/parseTab.test.ts`
Expected: FAIL, because `./parseTab` can't be resolved.

- [ ] **Step 3: Write the parser**

`src/core/tab/parseTab.ts`:

```ts
import { tabLabel, type HarpNote } from '../harmonica/harp'

export interface TabNoteItem {
  kind: 'note'
  /** The token's tab without its duration, e.g. `-3'`. */
  tab: string
  note: HarpNote
  beats: number
}

export interface TabRestItem {
  kind: 'rest'
  beats: number
}

export interface TabBarItem {
  kind: 'bar'
}

export type TabItem = TabNoteItem | TabRestItem | TabBarItem

export interface TabError {
  /** 1-based position of the token in the text. */
  position: number
  token: string
  message: string
}

export interface ParsedTab {
  items: TabItem[]
  errors: TabError[]
}

// A hole (1–10), optionally drawn (-), then bend ticks or an over-note suffix.
const NOTE = /^-?(10|[1-9])('{1,3}|od|o)?$/
const DURATION = /^(\d+(\.\d+)?|\.\d+)$/

/**
 * Spec §10: space-separated tokens — notes in tab notation (`4` `-4` `-3'` `6o` `7od`), `_` for a
 * rest, `|` for a bar line, and an optional `:beats` duration on notes and rests (default 1).
 * Notes resolve against `harp` (its key and tuning); a token it can't play is an error.
 */
export function parseTab(text: string, harp: readonly HarpNote[]): ParsedTab {
  const byTab = new Map(harp.map((n) => [tabLabel(n), n]))
  const items: TabItem[] = []
  const errors: TabError[] = []
  const tokens = text.split(/\s+/).filter((t) => t !== '')

  tokens.forEach((token, i) => {
    const fail = (message: string) => errors.push({ position: i + 1, token, message })
    if (token === '|') {
      items.push({ kind: 'bar' })
      return
    }
    const [body, duration, extra] = token.split(':')
    if (extra !== undefined || duration === '') return fail('has more than one duration')
    let beats = 1
    if (duration !== undefined) {
      if (!DURATION.test(duration) || Number(duration) <= 0) {
        return fail('the duration must be a positive number of beats')
      }
      beats = Number(duration)
    }
    if (body === '_') {
      items.push({ kind: 'rest', beats })
      return
    }
    if (!NOTE.test(body)) return fail('is not a note, rest (_) or bar line (|)')
    const note = byTab.get(body)
    if (!note) return fail("isn't on this harp")
    items.push({ kind: 'note', tab: body, note, beats })
  })
  return { items, errors }
}

export interface TimedNote {
  /** Index among the tab's notes (rests and bars don't count). */
  index: number
  tab: string
  note: HarpNote
  startBeat: number
  beats: number
}

export interface TabTimeline {
  notes: TimedNote[]
  /** Beat positions of the bar lines. */
  bars: number[]
  totalBeats: number
}

/** Places notes on a beat grid from 0: durations add up, bar lines take no time. */
export function tabTimeline(items: readonly TabItem[]): TabTimeline {
  const notes: TimedNote[] = []
  const bars: number[] = []
  let beat = 0
  for (const item of items) {
    if (item.kind === 'bar') {
      bars.push(beat)
      continue
    }
    if (item.kind === 'note') {
      notes.push({
        index: notes.length,
        tab: item.tab,
        note: item.note,
        startBeat: beat,
        beats: item.beats,
      })
    }
    beat += item.beats
  }
  return { notes, bars, totalBeats: beat }
}

export function beatMs(bpm: number): number {
  return 60000 / bpm
}

/** A short stable id for a text (djb2), so a custom tab's best score is kept per tab. */
export function textHash(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0
  return h.toString(36)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/core/tab/parseTab.test.ts && npm run typecheck`
Expected: PASS (9 tests); no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/core/tab/parseTab.ts src/core/tab/parseTab.test.ts
git commit -m "feat(tab): tab parser with durations, rests, bar lines and positioned errors"
```

---

### Task 4: Song and lick libraries

**Files:**
- Create: `src/core/tab/songs.ts`, `src/core/tab/licks.ts`
- Test: `src/core/tab/library.test.ts`

**Interfaces:**
- Consumes: `parseTab`, `tabTimeline` (Task 3); `Position` (harmonica/positions.ts); `TUNINGS`, `buildHarp(key, tuning)` (Plan 3); `HARP_KEYS`
- Produces:
  - `interface Song { id: string; title: string; beatsPerBar: 3 | 4; tab: string }`, `SONGS: readonly Song[]` (8 songs, ids `mary`, `twinkle`, `ode`, `susanna`, `saints`, `amazing-grace`, `red-river`, `swing-low`)
  - `type LickStyle = 'blues2' | 'folk1' | 'minor3'`, `interface LickStyleInfo { id: LickStyle; name: string; position: Position }`, `LICK_STYLES`
  - `interface Lick { id: string; name: string; style: LickStyle; tab: string }`, `LICKS: readonly Lick[]` (16)

**Songs** (spec §10): all public domain, written in 1st position. Happy Birthday is left out as the spec says, and Swing Low, Sweet Chariot takes its place.
- The songs are written out from the traditional tunes (decision 6). They stay in holes 4–9 without bends; Ode to Joy's one low G is `-2`.
- A leading rest lines each pickup up with its bar, so the metronome's downbeat falls where the music's does.
- Amazing Grace is in 3/4 and is written in beats, like the others.

**Licks** (spec §11): 16 short, generic scale fragments written for this site, not transcriptions.
- The 10 blues licks use only `-2 -3' -3 4 -4' -4 5 -5 6`. They include two turnaround-style endings and one bend lick (`-3'` released to `-3`).
- The 3 folk licks stay in holes 4–7, and the 3 minor licks run around `-4 -5 -6 6`.

The tests pin the contents: every bar of every song adds up to its metre, and every song and lick parses on all 12 keys in all four tunings. None needs `-3''`, the one Richter note the Paddy tuning loses. The lick trainer (Task 14) still flags a lick that doesn't fit, for tunings added later.

- [ ] **Step 1: Write the failing test**

`src/core/tab/library.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildHarp } from '../harmonica/harp'
import { HARP_KEYS } from '../harmonica/keys'
import { TUNINGS } from '../harmonica/tunings'
import { LICKS, LICK_STYLES } from './licks'
import { parseTab, tabTimeline } from './parseTab'
import { SONGS } from './songs'

const richterC = buildHarp('C')
const tabsOf = (tab: string) => tabTimeline(parseTab(tab, richterC).items).notes.map((n) => n.tab)

describe('song library', () => {
  it('has the eight spec songs, Happy Birthday replaced by Swing Low', () => {
    expect(SONGS.map((s) => s.title)).toEqual([
      'Mary Had a Little Lamb',
      'Twinkle Twinkle Little Star',
      'Ode to Joy',
      'Oh! Susanna',
      'When the Saints Go Marching In',
      'Amazing Grace',
      'Red River Valley',
      'Swing Low, Sweet Chariot',
    ])
    expect(new Set(SONGS.map((s) => s.id)).size).toBe(SONGS.length)
  })

  it('fills every bar with exactly the song’s beats', () => {
    for (const song of SONGS) {
      const { items } = parseTab(song.tab, richterC)
      let beats = 0
      for (const item of items) {
        if (item.kind === 'bar') {
          expect([song.id, beats]).toEqual([song.id, song.beatsPerBar])
          beats = 0
        } else beats += item.beats
      }
      expect([song.id, beats]).toEqual([song.id, 0])
    }
  })

  it('stays in holes 4–9 without bends, except one low -2 in Ode to Joy', () => {
    const tabs = SONGS.flatMap((s) => tabsOf(s.tab))
    expect(tabs.filter((t) => !/^-?[4-9]$/.test(t))).toEqual(['-2'])
  })
})

describe('lick library', () => {
  it('has 10 blues, 3 folk and 3 minor licks with unique ids', () => {
    const count = (style: string) => LICKS.filter((l) => l.style === style).length
    expect(LICK_STYLES.map((s) => [s.id, count(s.id)])).toEqual([
      ['blues2', 10],
      ['folk1', 3],
      ['minor3', 3],
    ])
    expect(new Set(LICKS.map((l) => l.id)).size).toBe(16)
  })

  it('keeps licks short: 4–8 notes', () => {
    for (const lick of LICKS) {
      const n = tabsOf(lick.tab).length
      expect([lick.id, n >= 4 && n <= 8]).toEqual([lick.id, true])
    }
  })

  it('uses only the notes each style is written around', () => {
    const allowed = {
      blues2: ['-2', "-3'", '-3', '4', "-4'", '-4', '5', '-5', '6'],
      folk1: ['4', '-4', '5', '-5', '6', '-6', '-7', '7'],
      minor3: ['-4', '5', '-5', '6', '-6', '7'],
    }
    for (const lick of LICKS) {
      const extra = tabsOf(lick.tab).filter((t) => !allowed[lick.style].includes(t))
      expect([lick.id, extra]).toEqual([lick.id, []])
    }
  })

  it('has one bend-focused blues lick (a 1-step bend and its release)', () => {
    expect(tabsOf(LICKS.find((l) => l.id === 'bend-release')!.tab).slice(0, 2)).toEqual([
      "-3'",
      '-3',
    ])
  })
})

describe('every song and lick', () => {
  it('parses on every key and tuning', () => {
    const failures: string[] = []
    for (const tuning of TUNINGS) {
      for (const key of HARP_KEYS) {
        const harp = buildHarp(key, tuning.id)
        for (const { id, tab } of [...SONGS, ...LICKS]) {
          for (const e of parseTab(tab, harp).errors)
            failures.push(`${id} on ${key} ${tuning.id}: ${e.token}`)
        }
      }
    }
    expect(failures).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/core/tab/library.test.ts`
Expected: FAIL, because `./licks` and `./songs` can't be resolved.

- [ ] **Step 3: Write the libraries**

`src/core/tab/songs.ts`:

```ts
/** A built-in tune for the tab reader: public domain, 1st position, key-relative tab. */
export interface Song {
  id: string
  title: string
  /** Beats per bar, for the count-in and the metronome (the tab itself is written in beats). */
  beatsPerBar: 3 | 4
  tab: string
}

export const SONGS: readonly Song[] = [
  {
    id: 'mary',
    title: 'Mary Had a Little Lamb',
    beatsPerBar: 4,
    tab: '5 -4 4 -4 | 5 5 5:2 | -4 -4 -4:2 | 5 6 6:2 | 5 -4 4 -4 | 5 5 5 5 | -4 -4 5 -4 | 4:4 |',
  },
  {
    id: 'twinkle',
    title: 'Twinkle Twinkle Little Star',
    beatsPerBar: 4,
    tab:
      '4 4 6 6 | -6 -6 6:2 | -5 -5 5 5 | -4 -4 4:2 | 6 6 -5 -5 | 5 5 -4:2 | ' +
      '6 6 -5 -5 | 5 5 -4:2 | 4 4 6 6 | -6 -6 6:2 | -5 -5 5 5 | -4 -4 4:2 |',
  },
  {
    id: 'ode',
    title: 'Ode to Joy',
    beatsPerBar: 4,
    tab:
      '5 5 -5 6 | 6 -5 5 -4 | 4 4 -4 5 | 5:1.5 -4:0.5 -4:2 | ' +
      '5 5 -5 6 | 6 -5 5 -4 | 4 4 -4 5 | -4:1.5 4:0.5 4:2 | ' +
      '-4 -4 5 4 | -4 5:0.5 -5:0.5 5 4 | -4 5:0.5 -5:0.5 5 -4 | 4 -4 -2:2 | ' +
      '5 5 -5 6 | 6 -5 5 -4 | 4 4 -4 5 | -4:1.5 4:0.5 4:2 |',
  },
  {
    id: 'susanna',
    title: 'Oh! Susanna',
    beatsPerBar: 4,
    tab:
      '_:3 4:0.5 -4:0.5 | 5 6 6:1.5 -6:0.5 | 6 5 4:1.5 -4:0.5 | 5 5 -4 4 | -4:3 4:0.5 -4:0.5 | ' +
      '5 6 6:1.5 -6:0.5 | 6 5 4:1.5 -4:0.5 | 5 5 -4 -4 | 4:4 | ' +
      '-5:2 -5 -6 | -6:2 6 6 | 5 4 -4:2 | _:3 4:0.5 -4:0.5 | ' +
      '5 6 6:1.5 -6:0.5 | 6 5 4:1.5 -4:0.5 | 5 5 -4 -4 | 4:4 |',
  },
  {
    id: 'saints',
    title: 'When the Saints Go Marching In',
    beatsPerBar: 4,
    tab:
      '_ 4 5 -5 | 6:4 | _ 4 5 -5 | 6:4 | _ 4 5 -5 | 6:2 5:2 | 4:2 5:2 | -4:4 | ' +
      '_ 5 5 -4 | 4:3 4 | 5:2 6 6 | -5:3 5 | -5 6:2 5 | 4:2 -4:2 | 4:4 |',
  },
  {
    id: 'amazing-grace',
    title: 'Amazing Grace',
    beatsPerBar: 3,
    tab:
      '_:2 6 | 7:2 8:0.5 7:0.5 | 8:2 -8 | 7:2 -6 | 6:2 6 | 7:2 8:0.5 7:0.5 | 8:2 -8 | 9:3 | ' +
      '_:2 8 | 9:2 8:0.5 9:0.5 | 8:2 7 | 6:2 -6 | 7:2 -6 | 6:2 6 | 7:2 8:0.5 7:0.5 | 8:2 -8 | 7:3 |',
  },
  {
    id: 'red-river',
    title: 'Red River Valley',
    beatsPerBar: 4,
    tab:
      '_:2 6 7 | 8:1.5 8:0.5 8 -8 | 8:1.5 -8:0.5 7:2 | _:2 6 7 | 8:1.5 7:0.5 8 9 | 8:2 -8:2 | ' +
      '_:2 9 -9 | 8:1.5 8:0.5 -8 7 | -8:1.5 8:0.5 9:2 | _:2 -9 8 | -8:1.5 -8:0.5 8 -8 | 7:4 |',
  },
  {
    id: 'swing-low',
    title: 'Swing Low, Sweet Chariot',
    beatsPerBar: 4,
    tab:
      '5:2 4:1.5 5:0.5 | 5 5:0.5 5:0.5 6:2 | -6:1.5 6:0.5 6 5 | 6:1.5 5:0.5 -4:2 | ' +
      '5:2 4:1.5 5:0.5 | 5 5:0.5 5:0.5 6:2 | -6:1.5 6:0.5 6 5 | -4:1.5 -4:0.5 4:2 |',
  },
]
```

`src/core/tab/licks.ts`:

```ts
import type { Position } from '../harmonica/positions'

export type LickStyle = 'blues2' | 'folk1' | 'minor3'

export interface LickStyleInfo {
  id: LickStyle
  name: string
  position: Position
}

export const LICK_STYLES: readonly LickStyleInfo[] = [
  { id: 'blues2', name: '2nd-position blues', position: 2 },
  { id: 'folk1', name: '1st-position folk', position: 1 },
  { id: 'minor3', name: '3rd-position minor', position: 3 },
]

export interface Lick {
  id: string
  name: string
  style: LickStyle
  /** Key-relative tab with durations in beats (spec §10 format). */
  tab: string
}

/** Spec §11: short, generic scale fragments written for this site — not transcriptions. */
export const LICKS: readonly Lick[] = [
  { id: 'blues-up', name: 'Blues scale up', style: 'blues2', tab: "-2 -3' 4 -4' -4 -5 6:2" },
  { id: 'blues-down', name: 'Blues scale down', style: 'blues2', tab: "6 -5 -4 -4' 4 -3' -2:2" },
  { id: 'root-fifth', name: 'Root to fifth', style: 'blues2', tab: '-2 -3 4 -4:3' },
  {
    id: 'bend-release',
    name: 'Bend and release',
    style: 'blues2',
    tab: "-3':0.5 -3:0.5 4 -3 -2:2",
  },
  { id: 'call', name: 'Call', style: 'blues2', tab: '-4 -5 6:2 -5 -4:2' },
  { id: 'response', name: 'Response', style: 'blues2', tab: "-4 4 -3' -2:3" },
  { id: 'fifth-slide', name: 'Slide to the fifth', style: 'blues2', tab: "4 -4' -4:2 -5 -4:2" },
  {
    id: 'shuffle-riff',
    name: 'Shuffle riff',
    style: 'blues2',
    tab: '-2:0.67 -3:0.33 4:0.67 -4:0.33 5 -4 -2:2',
  },
  { id: 'turnaround-down', name: 'Turnaround down', style: 'blues2', tab: '6 -5 5 -4 4 -3 -4:2' },
  { id: 'turnaround-up', name: 'Turnaround up', style: 'blues2', tab: "-2 -3 4 -4' -4:3" },
  { id: 'major-run', name: 'Major run', style: 'folk1', tab: '4 -4 5 -5 6 -6 -7 7:2' },
  { id: 'folk-turn', name: 'Folk turn', style: 'folk1', tab: '6 -6 6 5 -4 4:2' },
  { id: 'arpeggio', name: 'Arpeggio', style: 'folk1', tab: '4 5 6 7:2 6 5 4:2' },
  { id: 'dorian-up', name: 'Dorian climb', style: 'minor3', tab: '-4 5 -5 6 -6:2 -5 -4:2' },
  { id: 'minor-sigh', name: 'Minor sigh', style: 'minor3', tab: '-6 6 -5 -4:3' },
  { id: 'minor-pent', name: 'Minor pentatonic', style: 'minor3', tab: '-4 -5 6 -6 7:2 -6 6 -4:2' },
]
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/core/tab && npm run typecheck`
Expected: PASS; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/core/tab/songs.ts src/core/tab/licks.ts src/core/tab/library.test.ts
git commit -m "feat(tab): public-domain song library and 16 original licks"
```

---

### Task 5: Health check logic and its storage

**Files:**
- Create: `src/core/stats.ts`, `src/core/health/healthCheck.ts`, `src/ui/health/healthStore.ts`
- Test: `src/core/stats.test.ts`, `src/core/health/healthCheck.test.ts`, `src/ui/health/healthStore.test.ts`

**Interfaces:**
- Consumes: `centsOff(freq, midi, a4)`, `midiToFreq` (music/pitch.ts); `HarpNote`, `Hole` (harmonica/harp.ts); `HarpKey`; `TuningId`, `buildHarp(key, tuning)` (Plan 3)
- Produces:
  - `mean(values: readonly number[]): number`, `median(values): number`, `stdDev(values): number` (core/stats.ts; all throw on an empty list)
  - `interface Reed { hole: Hole; technique: 'blow' | 'draw'; midi: number }`, `healthReeds(harp: readonly HarpNote[]): Reed[]`
  - `STEADY_MS = 1000`, `WINDOW_CENTS = 60`, `MAX_GAP_MS = 100`
  - `type MeasureStatus = 'waiting' | 'measuring' | 'done'`, `interface MeasureState { status; progress: number; cents: number | null; result: number | null }`
  - `class ReedMeasure { constructor(midi: number, a4 = 440, opts?: { afterSilence?: boolean }); readonly midi; get state(); push(freq: number | null, timeMs: number): MeasureState }`
  - `interface ReedResult extends Reed { cents: number | null }`, `interface HealthSummary { measured: number; averageCents: number | null; worst: ReedResult[]; suggestedA4: number | null }`
  - `summarizeHealth(results: readonly ReedResult[], a4: number, a4Range: readonly [number, number]): HealthSummary`
  - `HEALTH_KEY = 'harp-tools:health'`, `interface SavedHealth { date: string; a4: number; cents: (number | null)[] }` (20 entries in `healthReeds` order), `healthId(key: HarpKey, tuning: TuningId): string` (`'C|richter'`), `loadHealth(storage, id): SavedHealth | null`, `saveHealth(storage, id, saved): void`

Spec §7.
- A reed is measured after 1 s of readings within ±60 cents, and the result is the median cents of that run.
- An out-of-window reading, or silence longer than `MAX_GAP_MS` (decision 2), restarts the second. A single dropped frame doesn't.
- `afterSilence` is what the page uses for every reed after the first. Readings count only once a `null` has been seen, because 2 draw and 3 blow are the same G on a Richter harp (Review Focus 1).
- The A4 suggestion (decision 2):
  - `round(a4 × 2^(avg / 1200))`, clamped to the setting's range;
  - only with 5+ measured reeds and |avg| ≥ 5 cents;
  - only when it differs from the current A4.

  +8 cents against 440 Hz gives 442.03 → **442**, and +12 cents gives 443.06 → **443**.
- `mean`, `median` and `stdDev` go into a shared `src/core/stats.ts`, because the tone meter and the rhythm trainer need them too.

- [ ] **Step 1: Write the failing tests**

`src/core/stats.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mean, median, stdDev } from './stats'

describe('stats', () => {
  it('mean', () => {
    expect(mean([1, 2, 6])).toBe(3)
  })

  it('median takes the middle value, or the mean of the two middle ones', () => {
    expect(median([5, 1, 3])).toBe(3)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })

  it('stdDev is the population σ', () => {
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2)
    expect(stdDev([3, 3, 3])).toBe(0)
  })

  it('refuses an empty list', () => {
    expect(() => mean([])).toThrow()
    expect(() => median([])).toThrow()
  })
})
```

`src/core/health/healthCheck.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildHarp } from '../harmonica/harp'
import { midiToFreq } from '../music/pitch'
import {
  ReedMeasure,
  healthReeds,
  summarizeHealth,
  type MeasureState,
  type ReedResult,
} from './healthCheck'

/** Feeds `cents(t)` from the reed's note (null = silence) every 50 ms from `from` to `to`
 *  inclusive; returns the last state. */
function feed(m: ReedMeasure, from: number, to: number, cents: (t: number) => number | null) {
  let state: MeasureState = m.state
  for (let t = from; t <= to; t += 50) {
    const c = cents(t)
    state = m.push(c === null ? null : midiToFreq(m.midi) * 2 ** (c / 1200), t)
  }
  return state
}

describe('healthReeds', () => {
  it('lists the 20 unbent reeds, blow then draw per hole', () => {
    const reeds = healthReeds(buildHarp('C'))
    expect(reeds).toHaveLength(20)
    expect(reeds.slice(0, 3)).toEqual([
      { hole: 1, technique: 'blow', midi: 60 },
      { hole: 1, technique: 'draw', midi: 62 },
      { hole: 2, technique: 'blow', midi: 64 },
    ])
    expect(reeds[19]).toEqual({ hole: 10, technique: 'draw', midi: 93 })
  })

  it('follows the tuning', () => {
    expect(healthReeds(buildHarp('C', 'paddy'))[4]).toEqual({
      hole: 3,
      technique: 'blow',
      midi: 69,
    })
  })
})

describe('ReedMeasure', () => {
  it('measures a steady reed after one second', () => {
    const m = new ReedMeasure(69)
    expect(feed(m, 0, 950, () => 12)).toMatchObject({ status: 'measuring', progress: 0.95 })
    const done = feed(m, 1000, 1000, () => 12)
    expect(done.status).toBe('done')
    expect(done.result).toBeCloseTo(12, 6)
  })

  it('records the median of a drifting second', () => {
    const m = new ReedMeasure(69)
    // −20, −18, … +20 cents over 0–1000 ms
    const done = feed(m, 0, 1000, (t) => -20 + t / 25)
    expect(done.status).toBe('done')
    expect(done.result).toBeCloseTo(0, 6)
  })

  it('ignores a note more than 60 cents off, and restarts the second after one', () => {
    const m = new ReedMeasure(69)
    const off = feed(m, 0, 2000, () => 70)
    expect(off).toMatchObject({ status: 'waiting', progress: 0, result: null })
    expect(off.cents).toBeCloseTo(70, 6)
    feed(m, 2050, 2500, () => 0)
    feed(m, 2550, 2550, () => -61)
    expect(feed(m, 2600, 3550, () => 0).status).toBe('measuring')
    expect(feed(m, 3600, 3600, () => 0).status).toBe('done')
  })

  it('bridges a dropped frame but restarts after real silence', () => {
    const blip = new ReedMeasure(69)
    feed(blip, 0, 400, () => 5)
    expect(feed(blip, 450, 450, () => null)).toMatchObject({ status: 'measuring', cents: null })
    expect(feed(blip, 500, 1000, () => 5).status).toBe('done')

    const gap = new ReedMeasure(69)
    feed(gap, 0, 500, () => 5)
    expect(feed(gap, 550, 700, () => null).status).toBe('waiting')
    expect(feed(gap, 750, 1700, () => 5).status).toBe('measuring')
    expect(feed(gap, 1750, 1750, () => 5).status).toBe('done')
  })

  it('with afterSilence, waits for the previous note to stop', () => {
    const m = new ReedMeasure(67, 440, { afterSilence: true })
    expect(feed(m, 0, 2000, () => 0).status).toBe('waiting')
    feed(m, 2050, 2050, () => null)
    expect(feed(m, 2100, 3100, () => 0).status).toBe('done')
  })

  it('stays done', () => {
    const m = new ReedMeasure(69)
    const done = feed(m, 0, 1000, () => 3)
    expect(m.push(null, 1050)).toBe(done)
  })
})

describe('summarizeHealth', () => {
  const reeds = healthReeds(buildHarp('C'))
  const results = (cents: (number | null)[]): ReedResult[] =>
    reeds.map((r, i) => ({ ...r, cents: cents[i] ?? null }))

  it('lists the worst reeds and the average offset', () => {
    const s = summarizeHealth(results([2, -30, 12, 0, -8, 40, null, 5]), 440, [430, 450])
    expect(s.measured).toBe(7)
    expect(s.averageCents).toBeCloseTo(3, 6)
    expect(s.worst.map((r) => [r.hole, r.technique, r.cents])).toEqual([
      [3, 'draw', 40],
      [1, 'draw', -30],
      [2, 'blow', 12],
    ])
    expect(s.suggestedA4).toBeNull()
  })

  it('suggests the A4 a sharp harp is tuned to', () => {
    // +8 cents on average: 440 × 2^(8/1200) = 442.03 Hz
    expect(summarizeHealth(results(Array(20).fill(8)), 440, [430, 450]).suggestedA4).toBe(442)
    // +12 cents: 443.06 Hz
    expect(summarizeHealth(results(Array(20).fill(12)), 440, [430, 450]).suggestedA4).toBe(443)
    // measured against 442 already, a +0.5 cent harp needs nothing
    expect(summarizeHealth(results(Array(20).fill(0.5)), 442, [430, 450]).suggestedA4).toBeNull()
    // stays inside the setting's range
    expect(summarizeHealth(results(Array(20).fill(60)), 448, [430, 450]).suggestedA4).toBe(450)
  })

  it('needs five measured reeds before suggesting anything', () => {
    expect(summarizeHealth(results([9, 9, 9, 9]), 440, [430, 450]).suggestedA4).toBeNull()
    expect(summarizeHealth(results([9, 9, 9, 9, 9]), 440, [430, 450]).suggestedA4).toBe(442)
  })

  it('says nothing when every reed was skipped', () => {
    expect(summarizeHealth(results([]), 440, [430, 450])).toEqual({
      measured: 0,
      averageCents: null,
      worst: [],
      suggestedA4: null,
    })
  })
})
```

`src/ui/health/healthStore.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { HEALTH_KEY, healthId, loadHealth, saveHealth, type SavedHealth } from './healthStore'

const memory = (initial: Record<string, string> = {}) => {
  const data = { ...initial }
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v
    },
  }
}
const check: SavedHealth = { date: '2026-09-27', a4: 440, cents: Array(20).fill(3) }

describe('health store', () => {
  it('saves and loads the latest check per key and tuning', () => {
    const s = memory()
    saveHealth(s, healthId('C', 'richter'), check)
    saveHealth(s, healthId('G', 'country'), { ...check, a4: 442 })
    expect(loadHealth(s, 'C|richter')).toEqual(check)
    expect(loadHealth(s, 'G|country')?.a4).toBe(442)
    expect(loadHealth(s, 'A|richter')).toBeNull()
  })

  it('ignores corrupt, hand-edited or missing storage', () => {
    expect(loadHealth(memory({ [HEALTH_KEY]: 'not json' }), 'C|richter')).toBeNull()
    expect(loadHealth(memory({ [HEALTH_KEY]: '[1,2]' }), 'C|richter')).toBeNull()
    const bad = JSON.stringify({ 'C|richter': { ...check, cents: [1, 2] } })
    expect(loadHealth(memory({ [HEALTH_KEY]: bad }), 'C|richter')).toBeNull()
    expect(loadHealth(null, 'C|richter')).toBeNull()
  })

  it('survives storage that throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('full')
      },
    }
    expect(loadHealth(throwing, 'C|richter')).toBeNull()
    expect(() => saveHealth(throwing, 'C|richter', check)).not.toThrow()
    expect(() => saveHealth(null, 'C|richter', check)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/stats.test.ts src/core/health src/ui/health`
Expected: FAIL, because `./stats`, `./healthCheck` and `./healthStore` can't be resolved.

- [ ] **Step 3: Write the statistics helpers**

`src/core/stats.ts`:

```ts
export function mean(values: readonly number[]): number {
  if (values.length === 0) throw new Error('mean: no values')
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** The middle value, or the mean of the two middle ones. */
export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error('median: no values')
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Population standard deviation (σ). */
export function stdDev(values: readonly number[]): number {
  const m = mean(values)
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)))
}
```

- [ ] **Step 4: Write the reed measurement and summary**

`src/core/health/healthCheck.ts`:

```ts
import type { HarpNote, Hole } from '../harmonica/harp'
import { centsOff } from '../music/pitch'
import { mean, median } from '../stats'

export interface Reed {
  hole: Hole
  technique: 'blow' | 'draw'
  midi: number
}

/** The 20 unbent reeds in check order: hole 1 blow, hole 1 draw … hole 10 draw. */
export function healthReeds(harp: readonly HarpNote[]): Reed[] {
  const reeds: Reed[] = []
  for (let hole = 1; hole <= 10; hole++) {
    for (const technique of ['blow', 'draw'] as const) {
      const n = harp.find((x) => x.hole === hole && x.technique === technique)
      if (n) reeds.push({ hole: n.hole, technique, midi: n.midi })
    }
  }
  return reeds
}

/** Spec §7: a reed is measured after 1 s of continuous readings within ±60 cents. */
export const STEADY_MS = 1000
export const WINDOW_CENTS = 60
/** A dropped frame or two (shorter than this) doesn't break the second. */
export const MAX_GAP_MS = 100

export type MeasureStatus = 'waiting' | 'measuring' | 'done'

export interface MeasureState {
  status: MeasureStatus
  /** 0–1 share of the steady second held so far. */
  progress: number
  /** Cents from the reed's note of the latest reading; null for silence. */
  cents: number | null
  /** The median cents of the steady second, once done. */
  result: number | null
}

/** Measures one reed from a stream of timestamped readings (null = silence). */
export class ReedMeasure {
  private run: number[] = []
  private runStart: number | null = null
  private lastInWindow: number | null = null
  private current: MeasureState = { status: 'waiting', progress: 0, cents: null, result: null }
  private heardSilence: boolean

  /**
   * With `afterSilence`, readings only count once the mic has heard silence: neighbouring reeds
   * can share a pitch (2 draw and 3 blow are both G on a Richter harp), so the note that
   * finished the previous reed must stop before this one is measured.
   */
  constructor(
    readonly midi: number,
    private readonly a4 = 440,
    { afterSilence = false }: { afterSilence?: boolean } = {},
  ) {
    this.heardSilence = !afterSilence
  }

  get state(): MeasureState {
    return this.current
  }

  push(freq: number | null, timeMs: number): MeasureState {
    if (this.current.status === 'done') return this.current
    if (freq === null) this.heardSilence = true
    if (!this.heardSilence) return this.current
    const cents = freq === null ? null : centsOff(freq, this.midi, this.a4)
    const gapTooLong = this.lastInWindow !== null && timeMs - this.lastInWindow > MAX_GAP_MS

    if (cents !== null && Math.abs(cents) <= WINDOW_CENTS) {
      if (this.runStart === null || gapTooLong) {
        this.runStart = timeMs
        this.run = []
      }
      this.run.push(cents)
      this.lastInWindow = timeMs
      const held = timeMs - this.runStart
      this.current =
        held >= STEADY_MS
          ? { status: 'done', progress: 1, cents, result: median(this.run) }
          : { status: 'measuring', progress: held / STEADY_MS, cents, result: null }
      return this.current
    }

    if (cents !== null || gapTooLong) this.reset()
    this.current =
      this.runStart === null
        ? { status: 'waiting', progress: 0, cents, result: null }
        : { ...this.current, cents }
    return this.current
  }

  private reset(): void {
    this.run = []
    this.runStart = null
    this.lastInWindow = null
  }
}

export interface ReedResult extends Reed {
  /** Median cents off; null when the reed was skipped. */
  cents: number | null
}

export interface HealthSummary {
  measured: number
  averageCents: number | null
  /** Up to three reeds more than 10 cents off, worst first. */
  worst: ReedResult[]
  /** An A4 setting that matches the harp's overall offset, when it clearly differs. */
  suggestedA4: number | null
}

/** Below this many measured reeds the average says little about the harp. */
export const SUGGEST_MIN_REEDS = 5
/** An average offset this large (≈ 442 Hz against 440) suggests another reference pitch. */
export const SUGGEST_MIN_CENTS = 5

export function summarizeHealth(
  results: readonly ReedResult[],
  a4: number,
  a4Range: readonly [number, number],
): HealthSummary {
  const measured = results.filter((r): r is ReedResult & { cents: number } => r.cents !== null)
  if (measured.length === 0)
    return { measured: 0, averageCents: null, worst: [], suggestedA4: null }
  const averageCents = mean(measured.map((r) => r.cents))
  const worst = measured
    .filter((r) => Math.abs(r.cents) > 10)
    .sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents))
    .slice(0, 3)
  let suggestedA4: number | null = null
  if (measured.length >= SUGGEST_MIN_REEDS && Math.abs(averageCents) >= SUGGEST_MIN_CENTS) {
    const hz = Math.round(a4 * 2 ** (averageCents / 1200))
    const clamped = Math.min(a4Range[1], Math.max(a4Range[0], hz))
    if (clamped !== a4) suggestedA4 = clamped
  }
  return { measured: measured.length, averageCents, worst, suggestedA4 }
}
```

- [ ] **Step 5: Write the storage**

`src/ui/health/healthStore.ts`:

```ts
import type { HarpKey } from '../../core/harmonica/keys'
import type { TuningId } from '../../core/harmonica/tunings'

export const HEALTH_KEY = 'harp-tools:health'

/** One finished check: cents per reed in `healthReeds` order (null = skipped). */
export interface SavedHealth {
  /** Local date, YYYY-MM-DD. */
  date: string
  a4: number
  cents: (number | null)[]
}

export function healthId(key: HarpKey, tuning: TuningId): string {
  return `${key}|${tuning}`
}

const isSaved = (v: unknown): v is SavedHealth => {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  return (
    typeof r.date === 'string' &&
    typeof r.a4 === 'number' &&
    Number.isFinite(r.a4) &&
    Array.isArray(r.cents) &&
    r.cents.length === 20 &&
    r.cents.every((c) => c === null || (typeof c === 'number' && Number.isFinite(c)))
  )
}

function readAll(storage: Pick<Storage, 'getItem'> | null): Record<string, SavedHealth> {
  try {
    const raw: unknown = JSON.parse(storage?.getItem(HEALTH_KEY) ?? '{}')
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => isSaved(v))) as Record<
      string,
      SavedHealth
    >
  } catch {
    return {}
  }
}

export function loadHealth(
  storage: Pick<Storage, 'getItem'> | null,
  id: string,
): SavedHealth | null {
  return readAll(storage)[id] ?? null
}

/** Keeps only the latest check per key + tuning. Storage errors are ignored. */
export function saveHealth(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  id: string,
  saved: SavedHealth,
): void {
  if (!storage) return
  try {
    storage.setItem(HEALTH_KEY, JSON.stringify({ ...readAll(storage), [id]: saved }))
  } catch {
    // Storage full or blocked: the previous check just won't be shown next time.
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/core/stats.test.ts src/core/health src/ui/health && npm run typecheck && npm run lint`
Expected: PASS; no type or lint errors.

- [ ] **Step 7: Commit**

```bash
git add src/core/stats.ts src/core/stats.test.ts src/core/health src/ui/health
git commit -m "feat(health): steady-second reed measurement, summary with A4 suggestion, storage"
```

---

### Task 6: Harp health check page

**Files:**
- Create: `src/ui/pages/health/HealthCheckPage.tsx`, `src/ui/pages/health/HealthCheckPage.module.css`
- Modify: `src/ui/App.tsx` (route), `src/ui/pages/homeGroups.ts` (Tools entry)
- Test: `src/ui/pages/health/HealthCheckPage.test.tsx`, `src/ui/pages/homeGroups.test.ts` (update), `src/ui/App.test.tsx` (append)

**Interfaces:**
- Consumes:
  - `ReedMeasure`, `healthReeds`, `summarizeHealth`, `MeasureState`, `Reed`, `healthId`, `loadHealth`, `saveHealth`, `HEALTH_KEY` (Task 5)
  - `usePitch(enabled, onReading)`
  - `Slot`
  - `Stage`
  - `formatCents`, `tuneQuality` (pages/tuner/tunerMath.ts)
  - `A4_RANGE`, `browserStorage`
  - `useHarp`, `usePracticeTimer`, `localDate` (Plan 3)
- Produces: `HealthCheckPage()` (route `/health`, practice-timer id `health`); `HealthCheck({ now?: () => number; storage?: Storage | null })`

Spec §7. The page is a tool, so it hears the mic through `usePitch`. Its layout reuses the game `Stage`:
- the prompt "Play hole N blow (X)";
- the steady-second progress bar;
- the live cents.

Below it there's a 2 × 10 results table in the chart's layout (blow above draw), then a summary with its A4 suggestion and the compromise-tuning note. Every one of these is always rendered.

Decision 2:
- Skip records nothing for the reed.
- Redo reed goes back to the previous reed (the one just measured).
- Restart clears everything.
- A new key, tuning or A4 restarts the check (the run is keyed on them).
- The finished check is saved when at least one reed was measured.
- "Previous check" deltas show only when that check used the same A4.
- Choosing "Use 442 Hz" changes the A4 setting, so the next check measures against it.

- [ ] **Step 1: Write the failing test**

`src/ui/pages/health/HealthCheckPage.test.tsx`:

```tsx
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PitchListener } from '../../../audio/pitch/PitchDetector'
import { midiToFreq } from '../../../core/music/pitch'
import { layoutShape } from '../../../test/layout'
import { HEALTH_KEY } from '../../health/healthStore'
import type { PitchState } from '../../hooks/usePitch'
import { SettingsProvider, useSettings } from '../../settings/SettingsContext'
import { HealthCheck } from './HealthCheckPage'

const mic = vi.hoisted(() => ({
  listener: null as PitchListener | null,
  state: { reading: null, rms: 0, status: 'listening', error: null } as PitchState,
}))
vi.mock('../../hooks/usePitch', () => ({
  usePitch: (_enabled: boolean, onReading: PitchListener) => {
    mic.listener = onReading
    return mic.state
  },
}))

const clock = { t: 0 }
/** Plays `midi` `cents` off (null = silence) every 50 ms for `ms`, starting after the last frame. */
const play = (midi: number | null, ms: number, cents = 0) =>
  act(() => {
    for (let elapsed = 0; elapsed < ms; elapsed += 50) {
      clock.t += 50
      const freq = midi === null ? null : midiToFreq(midi) * 2 ** (cents / 1200)
      mic.listener?.(freq === null ? null : { freq, clarity: 1, rms: 0.1 }, 0.1)
    }
  })

function A4Readout() {
  const { settings } = useSettings()
  return <output aria-label="A4">{settings.a4}</output>
}

const renderCheck = () =>
  render(
    <SettingsProvider storage={null}>
      <A4Readout />
      <HealthCheck now={() => clock.t} storage={localStorage} />
    </SettingsProvider>,
  )
const cell = (technique: 'Blow' | 'Draw', hole: number) =>
  within(screen.getByRole('row', { name: new RegExp(`^${technique}`) })).getAllByRole('cell')[
    hole - 1
  ]
const skip = (n: number) => {
  for (let i = 0; i < n; i++) fireEvent.click(screen.getByRole('button', { name: /Skip reed/ }))
}

describe('HealthCheck', () => {
  beforeEach(() => {
    localStorage.clear()
    clock.t = 0
    mic.state = { reading: null, rms: 0, status: 'listening', error: null }
  })

  it('measures each reed after a steady second and moves on', () => {
    renderCheck()
    expect(screen.getByText('Play hole 1 blow (C4)')).toBeInTheDocument()
    play(60, 600, 12)
    expect(screen.getByText('+12¢ — hold it steady')).toBeInTheDocument()
    play(60, 500, 12)
    expect(cell('Blow', 1)).toHaveTextContent('+12¢')
    expect(cell('Blow', 1)).toHaveAttribute('data-quality', 'close')
    expect(screen.getByText('Play hole 1 draw (D4)')).toBeInTheDocument()
  })

  it('needs a break between reeds that share a pitch (2 draw and 3 blow are both G4)', () => {
    renderCheck()
    skip(3)
    expect(screen.getByText('Play hole 2 draw (G4)')).toBeInTheDocument()
    play(null, 100)
    play(67, 1100, -4)
    expect(cell('Draw', 2)).toHaveTextContent('-4¢')
    expect(screen.getByText('Play hole 3 blow (G4)')).toBeInTheDocument()
    play(67, 2000, -4)
    expect(cell('Blow', 3)).toHaveTextContent('–')
    expect(screen.getByText('Stop, then play the next reed.')).toBeInTheDocument()
    play(null, 100)
    play(67, 1100, 2)
    expect(cell('Blow', 3)).toHaveTextContent('+2¢')
  })

  it('skips and redoes reeds', () => {
    renderCheck()
    play(60, 1100, 30)
    expect(cell('Blow', 1)).toHaveAttribute('data-quality', 'off')
    fireEvent.click(screen.getByRole('button', { name: /Redo reed/ }))
    expect(cell('Blow', 1)).toHaveTextContent('–')
    expect(screen.getByText('Play hole 1 blow (C4)')).toBeInTheDocument()
    play(null, 100)
    play(60, 1100, 3)
    expect(cell('Blow', 1)).toHaveAttribute('data-quality', 'in-tune')
    skip(1)
    expect(cell('Draw', 1)).toHaveTextContent('–')
    expect(screen.getByText('Play hole 2 blow (E4)')).toBeInTheDocument()
  })

  it('summarises, suggests a matching A4 and saves the check', () => {
    renderCheck()
    const reeds = [60, 62, 64, 67, 67]
    reeds.forEach((midi) => {
      play(null, 100)
      play(midi, 1100, 8)
    })
    skip(15)
    expect(screen.getByText('✓ Check complete')).toBeInTheDocument()
    expect(screen.getByLabelText('Summary')).toHaveTextContent('Average offset +8¢.')
    expect(screen.getByText('5 of 20 reeds measured.')).toBeInTheDocument()
    const saved = JSON.parse(localStorage.getItem(HEALTH_KEY)!)['C|richter']
    expect(saved.a4).toBe(440)
    expect(saved.cents.slice(0, 6).map((c: number | null) => c && Math.round(c))).toEqual([
      8,
      8,
      8,
      8,
      8,
      null,
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Use 442 Hz' }))
    expect(screen.getByLabelText('A4')).toHaveTextContent('442')
  })

  it('shows the change since the previous check at the same A4', () => {
    localStorage.setItem(
      HEALTH_KEY,
      JSON.stringify({
        'C|richter': { date: '2026-09-20', a4: 440, cents: [10, ...Array(19).fill(null)] },
      }),
    )
    renderCheck()
    expect(screen.getByText(/Δ against the previous check \(2026-09-20\)/)).toBeInTheDocument()
    play(60, 1100, 4)
    expect(cell('Blow', 1)).toHaveTextContent('+4¢Δ -6¢')
  })

  it('keeps the same layout from the first reed to the end', () => {
    const { container } = renderCheck()
    const shape = () =>
      layoutShape(container, ['table', 'tbody tr', 'td', '[aria-label="Summary"] > p'])
    const start = shape()
    expect(start.stageRows).toHaveLength(3)
    play(60, 500)
    expect(shape()).toEqual(start)
    skip(20)
    expect(screen.getByText('✓ Check complete')).toBeInTheDocument()
    expect(shape()).toEqual(start)
  })

  it('shows mic errors', () => {
    mic.state = { reading: null, rms: 0, status: 'error', error: 'denied' }
    renderCheck()
    expect(screen.getByRole('alert')).toHaveTextContent('Microphone permission was denied')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/pages/health`
Expected: FAIL, because `./HealthCheckPage` can't be resolved.

- [ ] **Step 3: Write the page**

`src/ui/pages/health/HealthCheckPage.tsx`:

```tsx
import { useMemo, useState } from 'react'
import {
  ReedMeasure,
  healthReeds,
  summarizeHealth,
  type MeasureState,
  type Reed,
} from '../../../core/health/healthCheck'
import { keySpelling } from '../../../core/harmonica/keys'
import { localDate } from '../../../core/log/dates'
import { noteName } from '../../../core/music/noteNames'
import { AudioGate } from '../../components/AudioGate'
import { MicErrorNotice } from '../../components/MicErrorNotice'
import { Stage } from '../../components/game/Stage'
import gameStyles from '../../components/game/Game.module.css'
import { healthId, loadHealth, saveHealth } from '../../health/healthStore'
import { useHarp } from '../../hooks/useHarp'
import { usePitch } from '../../hooks/usePitch'
import { usePracticeTimer } from '../../hooks/usePracticeTimer'
import { Slot } from '../../hooks/useSlot'
import { A4_RANGE, browserStorage } from '../../settings/settings'
import { useSettings } from '../../settings/SettingsContext'
import { formatCents, tuneQuality } from '../tuner/tunerMath'
import styles from './HealthCheckPage.module.css'

export function HealthCheckPage() {
  usePracticeTimer('health')
  return (
    <>
      <h1>Harp health check</h1>
      <p className={gameStyles.intro}>
        Play every hole, blow and draw, one at a time. Each reed is measured once you hold it
        steadily for a second.
      </p>
      <AudioGate>
        <HealthCheck />
      </AudioGate>
    </>
  )
}

interface Props {
  /** The readings' clock (performance.now() in the app; a fake one in tests). */
  now?: () => number
  storage?: Storage | null
}

const perfNow = () => performance.now()

export function HealthCheck({ now = perfNow, storage = browserStorage() }: Props) {
  const { settings } = useSettings()
  // A new key, tuning or reference pitch makes every measurement so far meaningless.
  return (
    <HealthRun
      key={[settings.key, settings.tuning, settings.a4].join('|')}
      now={now}
      storage={storage}
    />
  )
}

const TECHNIQUES = ['blow', 'draw'] as const
const HOLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const WAITING: MeasureState = { status: 'waiting', progress: 0, cents: null, result: null }

function HealthRun({ now, storage }: Required<Props>) {
  const { settings, update } = useSettings()
  const harp = useHarp()
  const reeds = useMemo(() => healthReeds(harp), [harp])
  const spelling = keySpelling(settings.key)
  const id = healthId(settings.key, settings.tuning)
  const [previous] = useState(() => loadHealth(storage, id))
  const [step, setStep] = useState(0)
  const [results, setResults] = useState<(number | null)[]>(() => reeds.map(() => null))
  const [live, setLive] = useState<MeasureState>(WAITING)
  const [measure] = useState(() => {
    const slot = new Slot<ReedMeasure>()
    slot.set(new ReedMeasure(reeds[0].midi, settings.a4))
    return slot
  })
  const finished = step >= reeds.length

  /** Moves to reed `next`; the first reed may start at once, later ones after a silence. */
  const goTo = (next: number, values: (number | null)[]) => {
    setStep(next)
    setLive(WAITING)
    if (next < reeds.length) {
      measure.set(new ReedMeasure(reeds[next].midi, settings.a4, { afterSilence: next > 0 }))
      return
    }
    measure.set(null)
    if (values.some((c) => c !== null)) {
      saveHealth(storage, id, { date: localDate(Date.now()), a4: settings.a4, cents: values })
    }
  }
  const record = (value: number | null) => {
    const values = results.map((c, i) => (i === step ? value : c))
    setResults(values)
    goTo(step + 1, values)
  }

  const pitch = usePitch(!finished, (reading) => {
    const m = measure.get()
    if (!m) return
    const state = m.push(reading?.freq ?? null, now())
    setLive(state)
    if (state.status === 'done') record(state.result)
  })

  const redo = () => {
    const back = Math.max(0, step - 1)
    const values = results.map((c, i) => (i === back ? null : c))
    setResults(values)
    setLive(WAITING)
    setStep(back)
    measure.set(new ReedMeasure(reeds[back].midi, settings.a4, { afterSilence: true }))
  }
  const restart = () => {
    const values = reeds.map(() => null)
    setResults(values)
    setLive(WAITING)
    setStep(0)
    measure.set(new ReedMeasure(reeds[0].midi, settings.a4, { afterSilence: true }))
  }

  const reed: Reed | undefined = reeds[step]
  const summary = summarizeHealth(
    reeds.map((r, i) => ({ ...r, cents: results[i] })),
    settings.a4,
    A4_RANGE,
  )
  const comparable = previous !== null && previous.a4 === settings.a4
  const indexOf = (hole: number, technique: Reed['technique']) =>
    reeds.findIndex((r) => r.hole === hole && r.technique === technique)
  const reedName = (r: Reed) => `${r.hole} ${r.technique}`

  return (
    <>
      {pitch.error && <MicErrorNotice kind={pitch.error} />}
      <Stage
        controls={
          <>
            {finished ? (
              <button type="button" className={gameStyles.primary} onClick={restart}>
                ↺ Check again
              </button>
            ) : (
              <button type="button" onClick={() => record(null)}>
                ⏭ Skip reed
              </button>
            )}
            <button type="button" onClick={redo} disabled={step === 0}>
              🔁 Redo reed
            </button>
            {!finished && (
              <button type="button" onClick={restart}>
                ↺ Restart
              </button>
            )}
          </>
        }
        headline={
          reed
            ? `Play hole ${reed.hole} ${reed.technique} (${noteName(reed.midi, spelling)})`
            : '✓ Check complete'
        }
        result={finished ? 'ok' : undefined}
        progress={finished ? undefined : live.progress}
        detail={
          finished
            ? `${summary.measured} of ${reeds.length} reeds measured.`
            : pitch.status === 'starting'
              ? 'Waiting for microphone permission…'
              : live.cents !== null
                ? `${formatCents(live.cents)} — hold it steady`
                : step > 0 && live.status === 'waiting'
                  ? 'Stop, then play the next reed.'
                  : 'Reed ' + (step + 1) + ' of ' + reeds.length
        }
      />
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className={styles.caption}>
            Cents off per reed
            {comparable && ` · Δ against the previous check (${previous.date})`}
          </caption>
          <thead>
            <tr>
              <th scope="col">Hole</th>
              {HOLES.map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TECHNIQUES.map((technique) => (
              <tr key={technique}>
                <th scope="row">{technique === 'blow' ? 'Blow' : 'Draw'}</th>
                {HOLES.map((hole) => {
                  const i = indexOf(hole, technique)
                  const cents = i >= 0 ? results[i] : null
                  const before = comparable && i >= 0 ? previous.cents[i] : null
                  return (
                    <td
                      key={hole}
                      className={styles.cell}
                      data-quality={cents === null ? undefined : tuneQuality(cents)}
                      data-current={i === step || undefined}
                    >
                      <span>{cents === null ? '–' : formatCents(cents)}</span>
                      <small className={styles.delta}>
                        {cents !== null && before !== null && `Δ ${formatCents(cents - before)}`}
                      </small>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.summary} aria-label="Summary">
        <p>
          {summary.averageCents === null
            ? 'Play each reed to see a summary.'
            : `Average offset ${formatCents(summary.averageCents)}.`}
          {summary.worst.length > 0 &&
            ` Most out of tune: ${summary.worst.map((r) => `${reedName(r)} (${formatCents(r.cents ?? 0)})`).join(', ')}.`}
        </p>
        <p>
          {summary.suggestedA4 !== null && (
            <>
              Your harp seems to be tuned to A4 = {summary.suggestedA4} Hz.{' '}
              <button
                type="button"
                onClick={() => update({ a4: summary.suggestedA4 ?? settings.a4 })}
              >
                Use {summary.suggestedA4} Hz
              </button>
            </>
          )}
        </p>
        <p className={gameStyles.hint}>
          ±5–10 cents is normal. Many harps use compromise tuning: the 3rds and 5ths of their chords
          are deliberately a little off, so the chords sound sweeter.
        </p>
      </div>
    </>
  )
}
```

`src/ui/pages/health/HealthCheckPage.module.css`:

```css
.tableWrap {
  overflow-x: auto;
  margin-bottom: 1rem;
}

.table {
  width: 100%;
  min-width: 34rem;
  border-collapse: separate;
  border-spacing: 4px;
  font-variant-numeric: tabular-nums;
}

.caption {
  margin-bottom: 0.25rem;
  color: var(--text-dim);
  text-align: left;
}

.table th {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-dim);
}

.cell {
  height: 3rem;
  padding: 0.25rem;
  border: 2px solid var(--border);
  border-radius: 6px;
  text-align: center;
  font-size: 0.85rem;
}

.cell > span,
.delta {
  display: block;
  line-height: 1.2rem;
  white-space: nowrap;
}

.delta {
  height: 1.2rem;
  color: var(--text-dim);
  font-size: 0.7rem;
}

.cell[data-quality='in-tune'] {
  border-color: var(--ok);
}
.cell[data-quality='close'] {
  border-color: var(--warn);
}
.cell[data-quality='off'] {
  border-color: var(--bad);
}
.cell[data-current] {
  box-shadow: 0 0 0 3px var(--target);
}

/* Fixed lines, so the summary never pushes the page around as results come in. */
.summary > p {
  min-height: 1.5em;
  margin: 0 0 0.5rem;
}
```

- [ ] **Step 4: Route and Home entry**

In `src/ui/App.tsx`, add `import { HealthCheckPage } from './pages/health/HealthCheckPage'` and the route `'/health': HealthCheckPage,` after the `'/metronome'` route.

In `src/ui/pages/homeGroups.ts`, add to the Tools `entries`, right after the metronome entry (before `positions`):

```ts
      {
        id: 'health',
        icon: '🩺',
        title: 'Harp health check',
        text: 'Measure every reed against the tuner and find the ones out of tune.',
      },
```

In `src/ui/pages/homeGroups.test.ts`, change the Tools row of the expected list to:

```ts
      ['tools', 'Tools', ['tuner', 'metronome', 'health', 'positions']],
```

In `src/ui/App.test.tsx`, add `['#/health', 'Harp health check'],` to the list of the `it.each([…])('routes %s to its game', …)` test.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/ui && npm run typecheck && npm run lint`
Expected: PASS; no type or lint errors.

- [ ] **Step 6: Try it**

Run: `npm run dev` and open `#/health` with a real harp. Expected:
- each reed is taken after about a second of steady playing;
- keeping a note going doesn't also fill in the next reed;
- the table colours match the tuner's in-tune/close/off colours.

Accuracy against a reference tuner is one of the spec's §13 manual checks.

- [ ] **Step 7: Commit**

```bash
git add src/ui/pages/health src/ui/App.tsx src/ui/App.test.tsx src/ui/pages/homeGroups.ts src/ui/pages/homeGroups.test.ts
git commit -m "feat: harp health check — reed by reed tuning table and A4 suggestion"
```

---

### Task 7: Tone analysis: hold stats, vibrato, the rolling history

**Files:**
- Create: `src/core/tone/analysis.ts`, `src/core/tone/history.ts`
- Test: `src/core/tone/analysis.test.ts`, `src/core/tone/history.test.ts`

**Interfaces:**
- Consumes: `mean`, `median`, `stdDev` (Task 5, core/stats.ts)
- Produces:
  - `interface ToneSample { tMs: number; cents: number; midi: number; db: number }`
  - `interface Vibrato { rateHz: number; depthCents: number }`
  - `interface HoldStats { midi; holdMs; pitchSigma; meanDb; dbSigma; vibratoReady: boolean; vibrato: Vibrato | null }`
  - `HOLD_BREAK_MS = 150`, `VIBRATO_MIN_HOLD_MS = 1000`, `VIBRATO_WINDOW_MS = 2000`, `VIBRATO_MIN_DEPTH = 8`, `VIBRATO_RATE_RANGE = [3, 9]`
  - `detectVibrato(samples: readonly ToneSample[]): Vibrato | null`
  - `analyzeHold(samples: readonly ToneSample[]): HoldStats | null`
  - `class HoldTracker { push(sample: ToneSample): void; get hold(): readonly ToneSample[]; isActive(nowMs: number): boolean }`
  - `interface TonePoint { tMs: number; cents: number | null; db: number | null }`, `HISTORY_MS = 6000`
  - `class ToneHistory { constructor(windowMs = HISTORY_MS); push(point: TonePoint): void; get points(): readonly TonePoint[] }`
  - `interface TraceBox { nowMs; windowMs; width; height; range: readonly [number, number] }`
  - `tracePath(points: readonly TonePoint[], series: 'cents' | 'db', box: TraceBox): string`, an SVG path (`M x y L x y …`, 1 decimal)

Spec §8.
- **The held note.** It is a run of pitched readings on the same nearest MIDI note, ended by a change of note or by more than 150 ms without a reading. The tracker keeps the last hold after it ends (decision 3), so the stats stay readable until the next note.
- **Vibrato**, only once the hold is ≥ 1 s:
  - Take the last 2 s and fit a least-squares line.
  - Count the crossings of the residual, with ±2 cents of hysteresis so jitter doesn't count.
  - Rate = (crossings − 1) / 2 / span. Depth (peak-to-peak) = 2 × the median peak of the complete half-cycles.
  - "None" (`null`) if depth < 8 cents or the rate is outside 3–9 Hz.

  A 5 Hz ±20-cent sine sampled every 25 ms comes out at 5.00 Hz and 40.17 cents.
- **The chart.** `tracePath` turns the history into SVG path data for the chart's two lines. Silence breaks a line, and values outside the range are clamped to its edge.

- [ ] **Step 1: Write the failing tests**

`src/core/tone/analysis.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { HoldTracker, analyzeHold, detectVibrato, type ToneSample } from './analysis'

/** Samples every `stepMs` from 0 to `ms` inclusive: G4 at 0 cents and −20 dB unless `f` says. */
const series = (ms: number, stepMs: number, f: (t: number) => Partial<ToneSample> = () => ({})) => {
  const out: ToneSample[] = []
  for (let t = 0; t <= ms; t += stepMs) out.push({ tMs: t, cents: 0, midi: 67, db: -20, ...f(t) })
  return out
}
const sine = (hz: number, amp: number) => (t: number) =>
  amp * Math.sin((2 * Math.PI * hz * t) / 1000)

describe('analyzeHold', () => {
  it('reports a steady note as steady, with no vibrato', () => {
    const s = analyzeHold(series(1500, 20, () => ({ cents: 3 })))!
    expect(s).toEqual({
      midi: 67,
      holdMs: 1500,
      pitchSigma: 0,
      meanDb: -20,
      dbSigma: 0,
      vibratoReady: true,
      vibrato: null,
    })
  })

  it('finds a 5 Hz, ±20 cent vibrato', () => {
    const s = analyzeHold(series(2500, 25, (t) => ({ cents: sine(5, 20)(t) })))!
    expect(s.vibrato!.rateHz).toBeCloseTo(5, 6)
    expect(s.vibrato!.depthCents).toBeCloseTo(40.17, 2)
    expect(s.pitchSigma).toBeCloseTo(14.06, 2)
  })

  it('finds vibrato on top of a slow drift', () => {
    const s = analyzeHold(series(2000, 25, (t) => ({ cents: -10 + t / 100 + sine(6, 15)(t) })))!
    expect(s.vibrato!.rateHz).toBeCloseTo(6.03, 2)
    expect(s.vibrato!.depthCents).toBeCloseTo(28.96, 2)
  })

  it('says "none" for shallow, too fast or too slow wobbles', () => {
    expect(analyzeHold(series(2000, 25, (t) => ({ cents: sine(5, 3)(t) })))!.vibrato).toBeNull()
    expect(analyzeHold(series(2000, 10, (t) => ({ cents: sine(12, 20)(t) })))!.vibrato).toBeNull()
    expect(analyzeHold(series(2000, 25, (t) => ({ cents: sine(2, 20)(t) })))!.vibrato).toBeNull()
  })

  it('waits for a one-second hold before judging vibrato', () => {
    const s = analyzeHold(series(900, 25, (t) => ({ cents: sine(5, 20)(t) })))!
    expect(s.vibratoReady).toBe(false)
    expect(s.vibrato).toBeNull()
  })

  it('measures a level swell', () => {
    const s = analyzeHold(series(2000, 25, (t) => ({ db: -40 + (30 * t) / 2000 })))!
    expect(s.meanDb).toBeCloseTo(-25, 6)
    expect(s.dbSigma).toBeCloseTo(8.77, 2)
    expect(s.pitchSigma).toBe(0)
  })

  it('returns null without samples', () => {
    expect(analyzeHold([])).toBeNull()
    expect(detectVibrato([])).toBeNull()
  })
})

describe('HoldTracker', () => {
  it('starts a new hold after a break of more than 150 ms', () => {
    const tracker = new HoldTracker()
    series(1000, 50).forEach((s) => tracker.push(s))
    expect(tracker.isActive(1100)).toBe(true)
    expect(tracker.isActive(1200)).toBe(false)
    // the last hold stays readable until the next note
    expect(analyzeHold(tracker.hold)!.holdMs).toBe(1000)
    series(300, 50).forEach((s) => tracker.push({ ...s, tMs: s.tMs + 1200 }))
    expect(analyzeHold(tracker.hold)!.holdMs).toBe(300)
  })

  it('bridges gaps up to 150 ms', () => {
    const tracker = new HoldTracker()
    tracker.push({ tMs: 0, cents: 0, midi: 67, db: -20 })
    tracker.push({ tMs: 150, cents: 0, midi: 67, db: -20 })
    expect(tracker.hold).toHaveLength(2)
  })

  it('starts a new hold on a change of note', () => {
    const tracker = new HoldTracker()
    tracker.push({ tMs: 0, cents: 0, midi: 67, db: -20 })
    tracker.push({ tMs: 20, cents: 0, midi: 69, db: -20 })
    expect(tracker.hold.map((s) => s.midi)).toEqual([69])
  })
})
```

`src/core/tone/history.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ToneHistory, tracePath } from './history'

describe('ToneHistory', () => {
  it('keeps the last six seconds', () => {
    const h = new ToneHistory()
    for (let t = 0; t <= 8000; t += 1000) h.push({ tMs: t, cents: 0, db: -20 })
    expect(h.points.map((p) => p.tMs)).toEqual([2000, 3000, 4000, 5000, 6000, 7000, 8000])
  })
})

describe('tracePath', () => {
  const box = { nowMs: 6000, windowMs: 6000, width: 600, height: 100, range: [-50, 50] as const }

  it('maps time to x and value to y, newest on the right', () => {
    const points = [
      { tMs: 0, cents: -50, db: null },
      { tMs: 3000, cents: 0, db: null },
      { tMs: 6000, cents: 25, db: null },
    ]
    expect(tracePath(points, 'cents', box)).toBe('M0.0 100.0 L300.0 50.0 L600.0 25.0')
  })

  it('breaks the line at silence and clamps out-of-range values', () => {
    const points = [
      { tMs: 1000, cents: 80, db: null },
      { tMs: 2000, cents: null, db: null },
      { tMs: 3000, cents: -10, db: null },
      { tMs: 4000, cents: -10, db: null },
    ]
    expect(tracePath(points, 'cents', box)).toBe('M100.0 0.0 M300.0 60.0 L400.0 60.0')
  })

  it('draws the level series on its own range', () => {
    const points = [{ tMs: 6000, cents: null, db: -30 }]
    expect(tracePath(points, 'db', { ...box, range: [-60, 0] })).toBe('M600.0 50.0')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/tone`
Expected: FAIL, because `./analysis` and `./history` can't be resolved.

- [ ] **Step 3: Write the analysis**

`src/core/tone/analysis.ts`:

```ts
import { mean, median, stdDev } from '../stats'

/** One pitched mic reading: cents from the nearest note (`midi`) and the level in dBFS. */
export interface ToneSample {
  tMs: number
  cents: number
  midi: number
  db: number
}

export interface Vibrato {
  rateHz: number
  /** Peak-to-peak, in cents. */
  depthCents: number
}

export interface HoldStats {
  midi: number
  holdMs: number
  /** σ of cents: lower is steadier. */
  pitchSigma: number
  meanDb: number
  /** σ of dB: lower is steadier. */
  dbSigma: number
  /** False until the note has been held long enough to judge vibrato. */
  vibratoReady: boolean
  vibrato: Vibrato | null
}

/** Spec §8: a held note ends on a change of note or more than 150 ms without a reading. */
export const HOLD_BREAK_MS = 150
export const VIBRATO_MIN_HOLD_MS = 1000
export const VIBRATO_WINDOW_MS = 2000
export const VIBRATO_MIN_DEPTH = 8
export const VIBRATO_RATE_RANGE = [3, 9] as const
/** Cents the detrended pitch must swing past zero to count as a crossing (ignores jitter). */
const HYSTERESIS_CENTS = 2

/**
 * Rate and depth from the zero-crossings of the detrended cents over the last 2 s. Depth is
 * twice the median peak of the complete half-cycles, which a leftover trend or one noisy
 * reading barely moves.
 */
export function detectVibrato(samples: readonly ToneSample[]): Vibrato | null {
  const last = samples.at(-1)
  if (!last) return null
  const w = samples.filter((s) => s.tMs >= last.tMs - VIBRATO_WINDOW_MS)
  if (w.length < 8) return null

  // Least-squares line through (t, cents): the vibrato is what's left around it.
  const mt = mean(w.map((s) => s.tMs))
  const mc = mean(w.map((s) => s.cents))
  const den = w.reduce((sum, s) => sum + (s.tMs - mt) ** 2, 0)
  const slope = den === 0 ? 0 : w.reduce((sum, s) => sum + (s.tMs - mt) * (s.cents - mc), 0) / den
  const residual = w.map((s) => s.cents - (mc + slope * (s.tMs - mt)))

  const crossings: number[] = []
  const peaks: number[] = []
  let side = 0
  let peak = 0
  residual.forEach((r, i) => {
    const now = r > HYSTERESIS_CENTS ? 1 : r < -HYSTERESIS_CENTS ? -1 : 0
    if (now !== 0 && now !== side) {
      // The half-cycle before the first crossing is partial: only later ones count.
      if (side !== 0) {
        if (crossings.length > 0) peaks.push(peak)
        crossings.push(w[i].tMs)
      }
      side = now
      peak = 0
    }
    peak = Math.max(peak, Math.abs(r))
  })
  if (crossings.length < 3) return null
  const spanS = (crossings[crossings.length - 1] - crossings[0]) / 1000
  const rateHz = (crossings.length - 1) / 2 / spanS
  const depthCents = 2 * median(peaks)
  const [lo, hi] = VIBRATO_RATE_RANGE
  if (depthCents < VIBRATO_MIN_DEPTH || rateHz < lo || rateHz > hi) return null
  return { rateHz, depthCents }
}

/** Stats of one held note (all samples share a MIDI note). */
export function analyzeHold(samples: readonly ToneSample[]): HoldStats | null {
  const first = samples[0]
  const last = samples.at(-1)
  if (!first || !last) return null
  const holdMs = last.tMs - first.tMs
  const vibratoReady = holdMs >= VIBRATO_MIN_HOLD_MS
  return {
    midi: first.midi,
    holdMs,
    pitchSigma: stdDev(samples.map((s) => s.cents)),
    meanDb: mean(samples.map((s) => s.db)),
    dbSigma: stdDev(samples.map((s) => s.db)),
    vibratoReady,
    vibrato: vibratoReady ? detectVibrato(samples) : null,
  }
}

/** Collects the samples of the current held note; the last hold stays until a new one starts. */
export class HoldTracker {
  private samples: ToneSample[] = []

  push(sample: ToneSample): void {
    const last = this.samples.at(-1)
    if (!last || last.midi !== sample.midi || sample.tMs - last.tMs > HOLD_BREAK_MS) {
      this.samples = []
    }
    this.samples.push(sample)
  }

  get hold(): readonly ToneSample[] {
    return this.samples
  }

  /** True while the note is still sounding at `nowMs`. */
  isActive(nowMs: number): boolean {
    const last = this.samples.at(-1)
    return last !== undefined && nowMs - last.tMs <= HOLD_BREAK_MS
  }
}
```

- [ ] **Step 4: Write the history and the chart paths**

`src/core/tone/history.ts`:

```ts
/** A chart point: null values break the line (silence). */
export interface TonePoint {
  tMs: number
  cents: number | null
  db: number | null
}

/** Spec §8: the chart rolls over the last 6 seconds. */
export const HISTORY_MS = 6000

/** The last 6 s of readings, oldest first; older points are dropped as new ones arrive. */
export class ToneHistory {
  private items: TonePoint[] = []

  constructor(private readonly windowMs = HISTORY_MS) {}

  push(point: TonePoint): void {
    this.items.push(point)
    const cutoff = point.tMs - this.windowMs
    let drop = 0
    while (drop < this.items.length && this.items[drop].tMs < cutoff) drop++
    if (drop > 0) this.items.splice(0, drop)
  }

  get points(): readonly TonePoint[] {
    return this.items
  }
}

export interface TraceBox {
  nowMs: number
  windowMs: number
  width: number
  height: number
  /** Value range drawn bottom to top; values outside are clamped to the edge. */
  range: readonly [number, number]
}

/** An SVG path for one series: x runs from `nowMs − windowMs` (left) to `nowMs` (right). */
export function tracePath(
  points: readonly TonePoint[],
  series: 'cents' | 'db',
  box: TraceBox,
): string {
  const [lo, hi] = box.range
  const parts: string[] = []
  let pen = false
  for (const p of points) {
    const v = p[series]
    const age = box.nowMs - p.tMs
    if (v === null || age > box.windowMs || age < 0) {
      pen = false
      continue
    }
    const x = box.width * (1 - age / box.windowMs)
    const clamped = Math.min(hi, Math.max(lo, v))
    const y = box.height * (1 - (clamped - lo) / (hi - lo))
    parts.push(`${pen ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`)
    pen = true
  }
  return parts.join(' ')
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/core/tone && npm run typecheck && npm run lint`
Expected: PASS; no type or lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/tone
git commit -m "feat(tone): hold statistics, vibrato detection and rolling chart paths"
```

---

### Task 8: Tone & breath meter page

**Files:**
- Create: `src/ui/pages/tone/ToneChart.tsx`, `src/ui/pages/tone/ToneMeterPage.tsx`, `src/ui/pages/tone/ToneMeterPage.module.css`
- Modify: `src/ui/App.tsx` (route), `src/ui/pages/homeGroups.ts` (Tools entry)
- Test: `src/ui/pages/tone/ToneMeterPage.test.tsx`, `src/ui/pages/homeGroups.test.ts` (update), `src/ui/App.test.tsx` (append)

**Interfaces:**
- Consumes: `HoldTracker`, `analyzeHold`, `HoldStats`, `ToneHistory`, `HISTORY_MS`, `tracePath` (Task 7); `MicFeed`, `TabText`, `useAnimationFrame` (Task 2); `freqToMidi`, `findNotes`, `tabLabel`, `noteName`, `keySpelling`; `useHarp`, `usePracticeTimer` (Plan 3)
- Produces: `ToneMeterPage()` (route `/tone`, practice-timer id `tone`); `ToneMeter({ now?: () => number })`; `STATS_REFRESH_MS = 250`; `ToneChart({ history, now })`

Spec §8 and the §13 performance rule.
- Mic frames only go into the `ToneHistory` and `HoldTracker` buffers, held in `useState`.
- `MicFeed` hosts `usePitch`, so only its status line re-renders per frame.
- The two chart lines are redrawn about 30 times a second: `useAnimationFrame` sets the `d` attribute of two `<path>` refs.
- The stats panel (six fixed rows, the chart's text alternative) re-renders every 250 ms from an interval, a readable rate (decision 3). The test proves the page commits nothing for mic frames.

- [ ] **Step 1: Write the failing test**

`src/ui/pages/tone/ToneMeterPage.test.tsx`:

```tsx
import { act, render, screen, within } from '@testing-library/react'
import { Profiler } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PitchListener } from '../../../audio/pitch/PitchDetector'
import { midiToFreq } from '../../../core/music/pitch'
import type { PitchState } from '../../hooks/usePitch'
import { SettingsProvider } from '../../settings/SettingsContext'
import { STATS_REFRESH_MS, ToneMeter } from './ToneMeterPage'

// A static mic state: frames only arrive through the listener, so any re-render the test sees
// comes from the page itself.
const mic = vi.hoisted(() => ({
  listener: null as PitchListener | null,
  state: { reading: null, rms: 0, status: 'listening', error: null } as PitchState,
}))
vi.mock('../../hooks/usePitch', () => ({
  usePitch: (_enabled: boolean, onReading: PitchListener) => {
    mic.listener = onReading
    return mic.state
  },
}))

const clock = { t: 0 }
/** Plays `midi` `cents` off at `rms` (null = silence) every 20 ms for `ms`. */
const play = (midi: number | null, ms: number, cents = 0, rms = 0.1) => {
  for (let elapsed = 0; elapsed < ms; elapsed += 20) {
    clock.t += 20
    const reading =
      midi === null ? null : { freq: midiToFreq(midi) * 2 ** (cents / 1200), clarity: 1, rms }
    mic.listener?.(reading, rms)
  }
}
const stat = (name: string) => {
  const dts = within(screen.getByLabelText('Held note')).getAllByRole('term')
  const dt = dts.find((d) => d.textContent === name)!
  return dt.nextElementSibling!.textContent
}

describe('ToneMeter', () => {
  let commits = 0
  const renderMeter = () =>
    render(
      <SettingsProvider storage={null}>
        <Profiler id="tone" onRender={() => commits++}>
          <ToneMeter now={() => clock.t} />
        </Profiler>
      </SettingsProvider>,
    )

  beforeEach(() => {
    vi.useFakeTimers()
    clock.t = 0
    commits = 0
  })
  afterEach(() => vi.useRealTimers())

  it('shows the held note’s stats, refreshed a few times a second', () => {
    renderMeter()
    expect(stat('Note')).toBe('–')
    act(() => play(67, 1200, 5))
    expect(stat('Note')).toBe('–')
    act(() => vi.advanceTimersByTime(STATS_REFRESH_MS))
    expect(stat('Note')).toBe('G4 (-2 or 3)')
    expect(stat('Hold time')).toBe('1.2 s')
    expect(stat('Pitch steadiness')).toBe('±0.0¢')
    expect(stat('Average level')).toBe('-20 dB')
    expect(stat('Vibrato')).toBe('None')
  })

  it('does not re-render for mic frames, only for the stats refresh', () => {
    renderMeter()
    const before = commits
    act(() => play(67, 1000))
    expect(commits).toBe(before)
    act(() => vi.advanceTimersByTime(STATS_REFRESH_MS))
    expect(commits).toBe(before + 1)
  })

  it('draws the pitch and level lines on animation frames', () => {
    const { container } = renderMeter()
    act(() => play(67, 500, 10, 0.1))
    act(() => vi.advanceTimersByTime(100))
    expect(container.querySelector('path.pitch')!.getAttribute('d')).toMatch(/^M/)
    expect(container.querySelector('path.level')!.getAttribute('d')).toMatch(/^M/)
  })

  it('keeps the same layout with and without a note', () => {
    const { container } = renderMeter()
    const shape = () => [...container.querySelectorAll('dd, dt, svg, p')].map((e) => e.tagName)
    const empty = shape()
    act(() => play(67, 1200))
    act(() => vi.advanceTimersByTime(STATS_REFRESH_MS))
    expect(shape()).toEqual(empty)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/pages/tone`
Expected: FAIL, because `./ToneMeterPage` can't be resolved.

- [ ] **Step 3: Write the chart**

`src/ui/pages/tone/ToneChart.tsx`:

```tsx
import { useRef } from 'react'
import { HISTORY_MS, tracePath, type ToneHistory } from '../../../core/tone/history'
import { useAnimationFrame } from '../../hooks/useAnimationFrame'
import styles from './ToneMeterPage.module.css'

const W = 600
const H = 200
/** Spec §8: redrawn at 30 fps. */
const FRAME_MS = 1000 / 30 - 3

interface Props {
  history: ToneHistory
  now: () => number
}

/**
 * The rolling 6-second chart. Its lines are updated through refs on animation frames, so the
 * page doesn't re-render for them; the stats panel is the text alternative.
 */
export function ToneChart({ history, now }: Props) {
  const pitch = useRef<SVGPathElement>(null)
  const level = useRef<SVGPathElement>(null)

  useAnimationFrame(() => {
    const box = { nowMs: now(), windowMs: HISTORY_MS, width: W, height: H }
    pitch.current?.setAttribute(
      'd',
      tracePath(history.points, 'cents', { ...box, range: [-50, 50] }),
    )
    level.current?.setAttribute('d', tracePath(history.points, 'db', { ...box, range: [-60, 0] }))
  }, FRAME_MS)

  return (
    <figure className={styles.figure}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Pitch and level over the last 6 seconds"
      >
        <line className={styles.grid} x1={0} x2={W} y1={H / 4} y2={H / 4} />
        <line className={styles.center} x1={0} x2={W} y1={H / 2} y2={H / 2} />
        <line className={styles.grid} x1={0} x2={W} y1={(3 * H) / 4} y2={(3 * H) / 4} />
        <path ref={level} className={styles.level} />
        <path ref={pitch} className={styles.pitch} />
      </svg>
      <figcaption className={styles.legend}>
        <span className={styles.pitchKey}>Pitch, ±50¢ (centre line = in tune)</span>
        <span className={styles.levelKey}>Level, −60 to 0 dB</span>
      </figcaption>
    </figure>
  )
}
```

- [ ] **Step 4: Write the page and its styles**

`src/ui/pages/tone/ToneMeterPage.tsx`:

```tsx
import { Fragment, useEffect, useState } from 'react'
import type { PitchListener } from '../../../audio/pitch/PitchDetector'
import { findNotes, tabLabel } from '../../../core/harmonica/harp'
import { keySpelling } from '../../../core/harmonica/keys'
import { noteName } from '../../../core/music/noteNames'
import { freqToMidi } from '../../../core/music/pitch'
import { HoldTracker, analyzeHold, type HoldStats } from '../../../core/tone/analysis'
import { ToneHistory } from '../../../core/tone/history'
import { AudioGate } from '../../components/AudioGate'
import { MicFeed } from '../../components/MicFeed'
import { TabText } from '../../components/TabText'
import gameStyles from '../../components/game/Game.module.css'
import { useHarp } from '../../hooks/useHarp'
import { usePracticeTimer } from '../../hooks/usePracticeTimer'
import { useSettings } from '../../settings/SettingsContext'
import { ToneChart } from './ToneChart'
import styles from './ToneMeterPage.module.css'

/** How often the stats panel refreshes: a readable rate, far below the mic's 60 per second. */
export const STATS_REFRESH_MS = 250

export function ToneMeterPage() {
  usePracticeTimer('tone')
  return (
    <>
      <h1>Tone &amp; breath meter</h1>
      <p className={gameStyles.intro}>
        Hold a note and watch how steady your pitch and breath are. Vibrato shows up after a second.
      </p>
      <AudioGate>
        <ToneMeter />
      </AudioGate>
    </>
  )
}

interface View {
  stats: HoldStats | null
  /** The note is still sounding (not just the last one heard). */
  active: boolean
}

const perfNow = () => performance.now()

export function ToneMeter({ now = perfNow }: { now?: () => number }) {
  const { settings } = useSettings()
  const harp = useHarp()
  const spelling = keySpelling(settings.key)
  const [history] = useState(() => new ToneHistory())
  const [tracker] = useState(() => new HoldTracker())
  const [view, setView] = useState<View>({ stats: null, active: false })

  // Every mic frame lands here, outside render, and only updates the buffers.
  const onReading: PitchListener = (reading) => {
    const tMs = now()
    if (!reading) {
      history.push({ tMs, cents: null, db: null })
      return
    }
    const { midi, cents } = freqToMidi(reading.freq, settings.a4)
    const db = 20 * Math.log10(Math.max(reading.rms, 1e-6))
    history.push({ tMs, cents, db })
    tracker.push({ tMs, cents, midi, db })
  }

  useEffect(() => {
    const id = setInterval(
      () => setView({ stats: analyzeHold(tracker.hold), active: tracker.isActive(now()) }),
      STATS_REFRESH_MS,
    )
    return () => clearInterval(id)
  }, [tracker, now])

  const { stats } = view
  const tabs = stats ? findNotes(harp, stats.midi).map(tabLabel) : []
  const dash = '–'
  const vibrato = !stats
    ? dash
    : !stats.vibratoReady
      ? 'Hold for 1 s…'
      : stats.vibrato
        ? `${stats.vibrato.rateHz.toFixed(1)} Hz · ${Math.round(stats.vibrato.depthCents)}¢`
        : 'None'

  return (
    <>
      <MicFeed onReading={onReading} />
      <ToneChart history={history} now={now} />
      <dl className={styles.stats} aria-label="Held note" data-active={view.active || undefined}>
        <dt>Note</dt>
        <dd>
          {stats ? (
            <>
              {noteName(stats.midi, spelling)}{' '}
              {tabs.length > 0 ? (
                <span>
                  (
                  {tabs.map((t, i) => (
                    <Fragment key={t}>
                      {i > 0 && ' or '}
                      <TabText tab={t} />
                    </Fragment>
                  ))}
                  )
                </span>
              ) : (
                '(not on this harp)'
              )}
            </>
          ) : (
            dash
          )}
        </dd>
        <dt>Hold time</dt>
        <dd>{stats ? `${(stats.holdMs / 1000).toFixed(1)} s` : dash}</dd>
        <dt>Pitch steadiness</dt>
        <dd>{stats ? `±${stats.pitchSigma.toFixed(1)}¢` : dash}</dd>
        <dt>Average level</dt>
        <dd>{stats ? `${Math.round(stats.meanDb)} dB` : dash}</dd>
        <dt>Level steadiness</dt>
        <dd>{stats ? `±${stats.dbSigma.toFixed(1)} dB` : dash}</dd>
        <dt>Vibrato</dt>
        <dd>{vibrato}</dd>
      </dl>
      <p className={gameStyles.hint}>
        Steadiness is the spread (σ) over the note you're holding: lower is steadier.
      </p>
    </>
  )
}
```

`src/ui/pages/tone/ToneMeterPage.module.css`:

```css
.figure {
  margin: 0 0 1rem;
}

.chart {
  display: block;
  width: 100%;
  height: 12rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}

.grid,
.center {
  stroke: var(--border);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.center {
  stroke: var(--text-dim);
  stroke-dasharray: 4 4;
}

.pitch,
.level {
  fill: none;
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.pitch {
  stroke: var(--target);
}

.level {
  stroke: var(--accent);
  opacity: 0.8;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1.25rem;
  margin-top: 0.4rem;
  color: var(--text-dim);
  font-size: 0.85rem;
}

.pitchKey::before,
.levelKey::before {
  content: '';
  display: inline-block;
  width: 1rem;
  height: 3px;
  margin-right: 0.4rem;
  vertical-align: middle;
}

.pitchKey::before {
  background: var(--target);
}

.levelKey::before {
  background: var(--accent);
}

/* Six fixed rows: the panel never changes size as notes come and go. */
.stats {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 0.35rem 1.25rem;
  margin: 0 0 1rem;
  font-variant-numeric: tabular-nums;
}

.stats dt {
  color: var(--text-dim);
}

.stats dd {
  display: flex;
  gap: 0.5rem;
  height: 1.5rem;
  margin: 0;
  overflow: hidden;
  white-space: nowrap;
}

.stats:not([data-active]) dd {
  color: var(--text-dim);
}
```

- [ ] **Step 5: Route and Home entry**

In `src/ui/App.tsx`, add `import { ToneMeterPage } from './pages/tone/ToneMeterPage'` and the route `'/tone': ToneMeterPage,` after the `'/health'` route.

In `src/ui/pages/homeGroups.ts`, add to the Tools `entries`, right after the metronome entry (before `health`):

```ts
      {
        id: 'tone',
        icon: '🌬️',
        title: 'Tone & breath meter',
        text: 'See how steady your pitch and breath are, and measure your vibrato.',
      },
```

In `src/ui/pages/homeGroups.test.ts`, change the Tools row to:

```ts
      ['tools', 'Tools', ['tuner', 'metronome', 'tone', 'health', 'positions']],
```

In `src/ui/App.test.tsx`, add `['#/tone', 'Tone & breath meter'],` to the `routes %s to its game` list.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/ui && npm run typecheck && npm run lint`
Expected: PASS; no type or lint errors.

- [ ] **Step 7: Try it**

Run `npm run dev` and open `#/tone`. Hold a note:
- both lines scroll smoothly;
- the stats settle, and a deliberate throat or hand vibrato reads about 4–7 Hz.

React DevTools' "Highlight updates" shows only the status line flashing on every frame, with the stats panel updating about 4 times a second. Vibrato accuracy is a spec §13 manual check.

- [ ] **Step 8: Commit**

```bash
git add src/ui/pages/tone src/ui/App.tsx src/ui/App.test.tsx src/ui/pages/homeGroups.ts src/ui/pages/homeGroups.test.ts
git commit -m "feat: tone & breath meter — rolling pitch/level chart and hold stats"
```

---

### Task 9: Rhythm logic: patterns, onsets, the beat grid, grading; per-round maximum

**Files:**
- Create: `src/core/rhythm/beatAnchor.ts`, `src/core/rhythm/rhythmTrainer.ts`
- Modify: `src/core/games/session.ts`, `src/ui/hooks/useScoring.ts`
- Test: `src/core/rhythm/beatAnchor.test.ts`, `src/core/rhythm/rhythmTrainer.test.ts`, `src/core/games/session.test.ts` (append), `src/ui/hooks/useScoring.test.tsx` (append)

**Interfaces:**
- Consumes: `median` (Task 5); `freqToMidi`; `DETECTION_LATENCY_MS = 60` (games/scaleRunner.ts); `MAX_ROUND_POINTS` (session.ts)
- Produces:
  - `class BeatAnchor { constructor(periodMs: number); sync(beatMs: number): void; get originMs(): number | null; beatTime(index: number): number | null }`
  - `type PatternId = 'quarters' | 'eighths' | 'shuffle' | 'offbeats' | 'charleston' | 'train'`, `interface RhythmPattern { id; name; onsets: readonly number[]; accents: readonly number[] }`, `RHYTHM_PATTERNS`, `patternById(id)`, `BEATS_PER_BAR = 4`
  - `type Grade = 'perfect' | 'good' | 'off' | 'miss'`, `PERFECT_MS = 40`, `GOOD_MS = 100`, `MATCH_WINDOW_MS = 250`, `GRADE_POINTS`, `ONSET_GAP_MS = 80`, `NOTE_CHANGE_DEBOUNCE_MS = 100`, `gradeOffset(offsetMs): Exclude<Grade, 'miss'>`
  - `class OnsetDetector { constructor(a4 = 440); push(freq: number | null, timeMs: number): number | null }`, which returns the latency-corrected onset
  - `interface RhythmHit { index; bar; beat; expectedMs; offsetMs: number | null; grade: Grade }`
  - `interface RhythmConfig { pattern; bpm; countInBars; bars: number | null; a4 }`
  - `class RhythmSession { constructor(config); get totalHits(): number | null; get done(): boolean; syncBeat(beatMs): void; expectedMs(index): number | null; push(freq, timeMs): RhythmHit[] }`
  - `averageOffset(hits): number | null`, `bpmBucket(bpm): number`
  - `SessionState.roundMax: number`, `startSession(mode, totalRounds = SCORED_ROUNDS, roundMax = MAX_ROUND_POINTS)`, `maxScore(s) = totalRounds × roundMax`
  - `useScoring(mode, bestKey, totalRounds = SCORED_ROUNDS, roundMax = MAX_ROUND_POINTS)`

Spec §9.
- **Expected hits.** Each is due at `origin + (bar × 4 + onset) × period`, starting after the count-in bars. `origin` comes from `BeatAnchor`: the median over the last 8 heard beats of `beat − k × period` (decision 4), so one late `setTimeout` doesn't shift the grid. The heard beats are `useMetronome`'s `lastBeatMs`, on the same `performance.now()` clock as the mic frames.
- **Onsets.** An onset is a pitched reading after ≥ 80 ms without one, or a change of note at least 100 ms after the previous onset. It is timestamped minus 60 ms.
- **Matching.** An onset takes the nearest unresolved hit within ±250 ms. A hit becomes a Miss once `time − 60 > due + 250`.
- **The per-round maximum** (decision 1). One rhythm hit, or one tab note in Task 12, is worth at most 100, so `ScorePanel`'s "Final score: x / max" needs a smaller maximum per round. The default stays 200, so every existing game is unchanged.

- [ ] **Step 1: Write the failing tests**

`src/core/rhythm/beatAnchor.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { BeatAnchor } from './beatAnchor'

describe('BeatAnchor', () => {
  it('knows nothing before the first beat', () => {
    const a = new BeatAnchor(500)
    expect(a.originMs).toBeNull()
    expect(a.beatTime(3)).toBeNull()
  })

  it('puts beat 0 on the first heard beat and extrapolates the grid', () => {
    const a = new BeatAnchor(500)
    a.sync(1000)
    expect(a.beatTime(0)).toBe(1000)
    expect(a.beatTime(4.5)).toBe(3250)
  })

  it('fits the grid to the median of recent beats, so one late timer does not move it', () => {
    const a = new BeatAnchor(500)
    ;[1004, 1502, 2030, 2503, 3001].forEach((t) => a.sync(t))
    // origins 1004, 1002, 1030, 1003, 1001 → median 1003
    expect(a.originMs).toBe(1003)
  })

  it('ignores the same beat reported twice', () => {
    const a = new BeatAnchor(500)
    a.sync(1000)
    a.sync(1000)
    a.sync(1510)
    expect(a.originMs).toBe(1005)
  })
})
```

`src/core/rhythm/rhythmTrainer.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { midiToFreq } from '../music/pitch'
import {
  GRADE_POINTS,
  OnsetDetector,
  RHYTHM_PATTERNS,
  RhythmSession,
  averageOffset,
  bpmBucket,
  gradeOffset,
  patternById,
  type RhythmHit,
} from './rhythmTrainer'

const G4 = midiToFreq(67)
const A4 = midiToFreq(69)

describe('RHYTHM_PATTERNS', () => {
  it('defines one bar of each pattern', () => {
    expect(RHYTHM_PATTERNS.map((p) => [p.id, p.onsets.length])).toEqual([
      ['quarters', 4],
      ['eighths', 8],
      ['shuffle', 8],
      ['offbeats', 4],
      ['charleston', 2],
      ['train', 8],
    ])
    expect(patternById('shuffle').onsets[1]).toBeCloseTo(0.667, 3)
    expect(patternById('shuffle').onsets[7]).toBeCloseTo(3.667, 3)
    expect(patternById('offbeats').onsets).toEqual([0.5, 1.5, 2.5, 3.5])
    expect(patternById('charleston').onsets).toEqual([0, 1.5])
    expect(patternById('train').accents).toEqual([0, 2])
  })
})

describe('gradeOffset', () => {
  it('grades by distance from the beat', () => {
    expect([0, 40, -41, 100, 101, -250].map(gradeOffset)).toEqual([
      'perfect',
      'perfect',
      'good',
      'good',
      'off',
      'off',
    ])
    expect(GRADE_POINTS).toEqual({ perfect: 100, good: 70, off: 30, miss: 0 })
  })
})

describe('OnsetDetector', () => {
  it('finds a note after 80 ms without one, timestamped 60 ms early', () => {
    const d = new OnsetDetector()
    expect(d.push(G4, 1000)).toBe(940)
    expect(d.push(G4, 1016)).toBeNull()
    expect(d.push(null, 1032)).toBeNull()
    expect(d.push(G4, 1080)).toBeNull() // 64 ms since the last pitched reading
    expect(d.push(G4, 1200)).toBe(1140) // 120 ms
  })

  it('counts a change of note as an onset, but not a flicker', () => {
    const d = new OnsetDetector()
    d.push(G4, 0)
    expect(d.push(A4, 150)).toBe(90)
    expect(d.push(G4, 166)).toBeNull() // 16 ms after the last onset
  })
})

/** Feeds `freq` (null = silence) every 10 ms from `from` to `to`; collects the resolved hits. */
function feed(s: RhythmSession, from: number, to: number, freq: number | null): RhythmHit[] {
  const hits: RhythmHit[] = []
  for (let t = from; t <= to; t += 10) hits.push(...s.push(freq, t))
  return hits
}
/** A 150 ms note whose onset (after latency) is at `onsetMs`, then silence until `untilMs`. */
function note(s: RhythmSession, onsetMs: number, untilMs: number): RhythmHit[] {
  const start = onsetMs + 60
  return [...feed(s, start, start + 150, G4), ...feed(s, start + 160, untilMs, null)]
}

describe('RhythmSession', () => {
  // 120 BPM: a beat every 500 ms. Metronome beat 0 heard at 1000 → count-in bar 1000–2999,
  // first hit at 3000.
  const session = (bars: number | null, id: 'quarters' | 'charleston' = 'quarters') => {
    const s = new RhythmSession({
      pattern: patternById(id),
      bpm: 120,
      countInBars: 1,
      bars,
      a4: 440,
    })
    s.syncBeat(1000)
    return s
  }

  it('computes the expected hits after the count-in', () => {
    const s = session(1, 'charleston')
    expect([0, 1, 2].map((i) => s.expectedMs(i))).toEqual([3000, 3750, 5000])
  })

  it('grades each hit and times out the ones never played', () => {
    const s = session(1)
    const hits = [
      ...feed(s, 2000, 3000, null),
      ...note(s, 3020, 3400),
      ...note(s, 3430, 3900),
      ...note(s, 4180, 4900),
    ]
    expect(hits.map((h) => [h.index, h.grade, h.offsetMs])).toEqual([
      [0, 'perfect', 20],
      [1, 'good', -70],
      [2, 'off', 180],
      [3, 'miss', null],
    ])
    expect(s.done).toBe(true)
    expect(s.totalHits).toBe(4)
  })

  it('ignores onsets too far from any hit, and extra onsets near a hit already taken', () => {
    const s = session(1)
    const hits = [
      ...note(s, 2600, 2950), // 400 ms before the first hit
      ...note(s, 3000, 3200),
      ...note(s, 3220, 3440), // 220 ms after hit 0 (taken), 280 ms before hit 1
    ]
    expect(hits.map((h) => [h.index, h.grade])).toEqual([[0, 'perfect']])
  })

  it('ignores the mic until the metronome has been heard', () => {
    const s = new RhythmSession({
      pattern: patternById('quarters'),
      bpm: 120,
      countInBars: 1,
      bars: 1,
      a4: 440,
    })
    expect(note(s, 3000, 3300)).toEqual([])
    expect(s.expectedMs(0)).toBeNull()
  })

  it('keeps going in practice', () => {
    const s = session(null)
    expect(s.totalHits).toBeNull()
    const hits = feed(s, 2000, 9000, null)
    expect(hits.map((h) => h.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(s.done).toBe(false)
  })
})

describe('averageOffset', () => {
  const hit = (offsetMs: number | null): RhythmHit => ({
    index: 0,
    bar: 0,
    beat: 0,
    expectedMs: 0,
    offsetMs,
    grade: offsetMs === null ? 'miss' : gradeOffset(offsetMs),
  })
  it('averages the hits that landed', () => {
    expect(averageOffset([hit(20), hit(40), hit(null)])).toBe(30)
    expect(averageOffset([hit(null)])).toBeNull()
  })
})

describe('bpmBucket', () => {
  it('rounds to the nearest 10 BPM', () => {
    expect([84, 85, 90, 96].map(bpmBucket)).toEqual([80, 90, 90, 100])
  })
})
```

Append to `src/core/games/session.test.ts`, inside `describe('scored session', …)`:

```ts
  it('can cap rounds at fewer points (rhythm hits are worth up to 100)', () => {
    const s = startSession('scored', 32, 100)
    expect(s.roundMax).toBe(100)
    expect(maxScore(s)).toBe(3200)
  })
```

Append to `src/ui/hooks/useScoring.test.tsx`, inside the first `describe('useScoring', …)`, and add `maxScore` to its import from `'../../core/games/session'`:

```tsx
  it('passes the per-round maximum to the session', () => {
    const { result } = renderHook(() => useScoring('scored', 'rhythm|x', 8, 100))
    expect(maxScore(result.current.session)).toBe(800)
    act(() => result.current.restart())
    expect(maxScore(result.current.session)).toBe(800)
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/rhythm src/core/games/session.test.ts src/ui/hooks/useScoring.test.tsx`
Expected: FAIL. `./beatAnchor` and `./rhythmTrainer` can't be resolved, `s.roundMax` is undefined, and `maxScore` returns 1600 instead of 800.

- [ ] **Step 3: Write the beat grid and the rhythm logic**

`src/core/rhythm/beatAnchor.ts`:

```ts
import { median } from '../stats'

/** How many recent beats the grid is fitted to. */
const KEEP = 8

/**
 * The metronome's beat grid on the page's clock, from the times its beats were heard. Each heard
 * beat arrives a few milliseconds late (a JS timer), so the grid's origin is the median over the
 * recent beats rather than the first one alone.
 */
export class BeatAnchor {
  private first: number | null = null
  private last: number | null = null
  private origins: number[] = []

  constructor(readonly periodMs: number) {}

  /** Feed each heard beat; repeats of the same time are ignored. The first beat is beat 0. */
  sync(beatMs: number): void {
    if (beatMs === this.last) return
    this.last = beatMs
    if (this.first === null) this.first = beatMs
    const index = Math.round((beatMs - this.first) / this.periodMs)
    this.origins.push(beatMs - index * this.periodMs)
    if (this.origins.length > KEEP) this.origins.shift()
  }

  /** The time of beat 0, or null before any beat was heard. */
  get originMs(): number | null {
    return this.origins.length > 0 ? median(this.origins) : null
  }

  /** The time of beat `index` (fractional beats allowed), or null before any beat was heard. */
  beatTime(index: number): number | null {
    const origin = this.originMs
    return origin === null ? null : origin + index * this.periodMs
  }
}
```

`src/core/rhythm/rhythmTrainer.ts`:

```ts
import { DETECTION_LATENCY_MS } from '../games/scaleRunner'
import { freqToMidi } from '../music/pitch'
import { BeatAnchor } from './beatAnchor'

export type PatternId = 'quarters' | 'eighths' | 'shuffle' | 'offbeats' | 'charleston' | 'train'

export interface RhythmPattern {
  id: PatternId
  name: string
  /** One bar of 4/4, as onsets in beats from the downbeat. */
  onsets: readonly number[]
  /** Onsets drawn accented. */
  accents: readonly number[]
}

export const BEATS_PER_BAR = 4
const SWING = 2 / 3

export const RHYTHM_PATTERNS: readonly RhythmPattern[] = [
  { id: 'quarters', name: 'Quarters', onsets: [0, 1, 2, 3], accents: [] },
  { id: 'eighths', name: 'Eighths', onsets: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], accents: [] },
  {
    id: 'shuffle',
    name: 'Shuffle',
    onsets: [0, SWING, 1, 1 + SWING, 2, 2 + SWING, 3, 3 + SWING],
    accents: [],
  },
  { id: 'offbeats', name: 'Offbeats', onsets: [0.5, 1.5, 2.5, 3.5], accents: [] },
  { id: 'charleston', name: 'Charleston', onsets: [0, 1.5], accents: [] },
  { id: 'train', name: 'Train', onsets: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], accents: [0, 2] },
]

export function patternById(id: PatternId): RhythmPattern {
  const p = RHYTHM_PATTERNS.find((x) => x.id === id)
  if (!p) throw new Error(`Unknown pattern: ${id}`)
  return p
}

export type Grade = 'perfect' | 'good' | 'off' | 'miss'

/** Spec §9 grading windows (|offset|, ms) and points per hit. */
export const PERFECT_MS = 40
export const GOOD_MS = 100
export const MATCH_WINDOW_MS = 250
export const GRADE_POINTS: Record<Grade, number> = { perfect: 100, good: 70, off: 30, miss: 0 }
/** A pitched reading after at least this long without one starts a note. */
export const ONSET_GAP_MS = 80
/** A change of note only counts as a new onset this long after the previous one (ignores a
 *  reading that flickers between two neighbouring notes). */
export const NOTE_CHANGE_DEBOUNCE_MS = 100

export function gradeOffset(offsetMs: number): Exclude<Grade, 'miss'> {
  const a = Math.abs(offsetMs)
  if (a <= PERFECT_MS) return 'perfect'
  if (a <= GOOD_MS) return 'good'
  return 'off'
}

/** Finds note onsets in the mic stream; pitch doesn't matter, only when a note starts. */
export class OnsetDetector {
  private lastPitchedMs: number | null = null
  private lastMidi: number | null = null
  private lastOnsetMs = -Infinity

  constructor(private readonly a4 = 440) {}

  /** The onset time, corrected for detection latency, when this reading starts a note. */
  push(freq: number | null, timeMs: number): number | null {
    if (freq === null) return null
    const midi = freqToMidi(freq, this.a4).midi
    const afterGap = this.lastPitchedMs === null || timeMs - this.lastPitchedMs >= ONSET_GAP_MS
    const newNote = midi !== this.lastMidi && timeMs - this.lastOnsetMs >= NOTE_CHANGE_DEBOUNCE_MS
    this.lastPitchedMs = timeMs
    this.lastMidi = midi
    if (!afterGap && !newNote) return null
    this.lastOnsetMs = timeMs
    return timeMs - DETECTION_LATENCY_MS
  }
}

export interface RhythmHit {
  /** 0 = the first expected hit after the count-in. */
  index: number
  bar: number
  /** Onset within the bar, in beats. */
  beat: number
  expectedMs: number
  /** Positive = late. Null for a miss. */
  offsetMs: number | null
  grade: Grade
}

export interface RhythmConfig {
  pattern: RhythmPattern
  bpm: number
  countInBars: number
  /** Bars to play after the count-in; null = keep going (practice). */
  bars: number | null
  a4: number
}

/**
 * Matches the player's onsets to the pattern's expected hits on the metronome grid. Feed it every
 * heard beat (`syncBeat`) and every mic frame (`push`); each push returns the hits it resolved.
 */
export class RhythmSession {
  private readonly anchor: BeatAnchor
  private readonly detector: OnsetDetector
  private pending: { index: number; expectedMs: number }[] = []
  private nextIndex = 0
  private resolvedCount = 0

  constructor(private readonly config: RhythmConfig) {
    this.anchor = new BeatAnchor(60000 / config.bpm)
    this.detector = new OnsetDetector(config.a4)
  }

  get totalHits(): number | null {
    const { bars, pattern } = this.config
    return bars === null ? null : bars * pattern.onsets.length
  }

  get done(): boolean {
    const total = this.totalHits
    return total !== null && this.resolvedCount >= total
  }

  syncBeat(beatMs: number): void {
    this.anchor.sync(beatMs)
  }

  /** When hit `index` is due, or null before the metronome's first beat. */
  expectedMs(index: number): number | null {
    const { onsets } = this.config.pattern
    const bar = this.config.countInBars + Math.floor(index / onsets.length)
    return this.anchor.beatTime(bar * BEATS_PER_BAR + onsets[index % onsets.length])
  }

  push(freq: number | null, timeMs: number): RhythmHit[] {
    const onset = this.detector.push(freq, timeMs)
    if (this.anchor.originMs === null || this.done) return []
    const heardUpTo = timeMs - DETECTION_LATENCY_MS
    const total = this.totalHits

    // Every hit an onset heard so far could still match.
    for (;;) {
      if (total !== null && this.nextIndex >= total) break
      const expectedMs = this.expectedMs(this.nextIndex)!
      if (expectedMs > heardUpTo + MATCH_WINDOW_MS) break
      this.pending.push({ index: this.nextIndex, expectedMs })
      this.nextIndex++
    }

    const resolved: RhythmHit[] = []
    if (onset !== null) {
      let best: { index: number; expectedMs: number } | null = null
      for (const p of this.pending) {
        const d = Math.abs(onset - p.expectedMs)
        if (d <= MATCH_WINDOW_MS && (!best || d < Math.abs(onset - best.expectedMs))) best = p
      }
      if (best) {
        const offsetMs = onset - best.expectedMs
        resolved.push(this.hit(best, offsetMs, gradeOffset(offsetMs)))
        this.pending = this.pending.filter((p) => p !== best)
      }
    }
    // Too late for any onset still to come: a miss.
    const missed = this.pending.filter((p) => p.expectedMs + MATCH_WINDOW_MS < heardUpTo)
    for (const p of missed) resolved.push(this.hit(p, null, 'miss'))
    this.pending = this.pending.filter((p) => !missed.includes(p))

    this.resolvedCount += resolved.length
    return resolved.sort((a, b) => a.index - b.index)
  }

  private hit(
    p: { index: number; expectedMs: number },
    offsetMs: number | null,
    grade: Grade,
  ): RhythmHit {
    const { onsets } = this.config.pattern
    return {
      index: p.index,
      bar: Math.floor(p.index / onsets.length),
      beat: onsets[p.index % onsets.length],
      expectedMs: p.expectedMs,
      offsetMs,
      grade,
    }
  }
}

/** Mean signed offset of the hits that landed (misses don't count); null if none did. */
export function averageOffset(hits: readonly RhythmHit[]): number | null {
  const landed = hits.filter((h): h is RhythmHit & { offsetMs: number } => h.offsetMs !== null)
  if (landed.length === 0) return null
  return landed.reduce((sum, h) => sum + h.offsetMs, 0) / landed.length
}

/** Best scores are kept per pattern and tempo, the tempo rounded to the nearest 10 BPM. */
export function bpmBucket(bpm: number): number {
  return Math.round(bpm / 10) * 10
}
```

- [ ] **Step 4: Add the per-round maximum**

In `src/core/games/session.ts`, replace `interface SessionState` and `startSession` with:

```ts
export interface SessionState {
  readonly mode: GameMode
  readonly totalRounds: number
  /** The most one round can earn (200 with the speed bonus; 100 for per-hit games). */
  readonly roundMax: number
  readonly results: readonly RoundResult[]
}

export function startSession(
  mode: GameMode,
  totalRounds = SCORED_ROUNDS,
  roundMax = MAX_ROUND_POINTS,
): SessionState {
  return { mode, totalRounds, roundMax, results: [] }
}
```

and change the body of `maxScore` to `return s.totalRounds * s.roundMax`.

In `src/ui/hooks/useScoring.ts`, add `MAX_ROUND_POINTS,` to the import from `'../../core/games/session'`. Then replace the signature line `export function useScoring(mode: GameMode, bestKey: string, totalRounds = SCORED_ROUNDS): Scoring {` (and the comment above it) with:

```ts
/**
 * A page's session plus its best score for `bestKey`, saved when a scored session ends.
 * `roundMax` is the most one round can earn (see `startSession`).
 */
export function useScoring(
  mode: GameMode,
  bestKey: string,
  totalRounds = SCORED_ROUNDS,
  roundMax = MAX_ROUND_POINTS,
): Scoring {
```

Change both `startSession(mode, totalRounds)` calls in the hook (the `useState` initialiser and `restart`) to `startSession(mode, totalRounds, roundMax)`. Leave everything else untouched, including Plan 3's `appendSession` call. That call uses `maxScore(next)`, so logged maximums follow `roundMax` automatically.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/core src/ui/hooks src/ui/components && npm run typecheck && npm run lint`
Expected: PASS; no type or lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/rhythm src/core/games/session.ts src/core/games/session.test.ts src/ui/hooks/useScoring.ts src/ui/hooks/useScoring.test.tsx
git commit -m "feat(rhythm): patterns, onset detection, beat grid and hit grading"
```

---

### Task 10: Rhythm trainer page

**Files:**
- Create: `src/ui/pages/rhythm/RhythmTrainerPage.tsx`, `src/ui/pages/rhythm/RhythmTrainerPage.module.css`
- Modify: `src/ui/scores/bestScores.ts` (`GameId`), `src/ui/App.tsx` (route), `src/ui/pages/homeGroups.ts` (Games entry)
- Test: `src/ui/pages/rhythm/RhythmTrainerPage.test.tsx`, `src/ui/pages/homeGroups.test.ts` (update), `src/ui/App.test.tsx` (append)

**Interfaces:**
- Consumes:
  - `RhythmSession`, `RHYTHM_PATTERNS`, `patternById`, `GRADE_POINTS`, `averageOffset`, `bpmBucket`, `RhythmHit`, `Grade` (Task 9)
  - `useScoring(mode, key, rounds, roundMax)` (Task 9)
  - `useGameAudio`, `useMetronome` (`running`, `beat`, `lastBeatMs`, `toggle`), `useSlot`
  - `GameLayout`, `ModeToggle`, `Stage`, `ScorePanel`, `PlayAgain`
  - `clampBpm`, `BPM_MIN`, `BPM_MAX`, `TIME_SIGNATURES`
  - `fakeAudio`, `hold` (test/fakeGameAudio.ts), `layoutShape`
  - `usePracticeTimer` (Plan 3)
- Produces: `RhythmTrainerPage()` (route `/rhythm`, practice-timer id `rhythm`); `RhythmGame()`; `SCORED_BARS = 8`; `GameId` gains `'rhythm'`

Spec §9. It's a game, so the mic comes through `useGameAudio`.
- **Start** starts the metronome (4/4, the shared BPM) and a `RhythmSession`. Every heard frame first syncs the session to `metronome.lastBeatMs`, then pushes the frame.
- **Practice** runs until stopped. It shows the last 8 hits (signed offsets) and "You're N ms late/early on average".
- **Scored** is 1 count-in bar + 8 bars. Every expected hit is a round worth up to 100 (decision 4), and the best score is saved under `rhythm|bpm=<bucket>|pattern=<id>`.
- **The pattern strip** is one bar with a dot per onset: Train's accents on 1 and 3 are bigger, and the current beat is ringed.
- **Pitch doesn't matter**, so the run key is only mode, pattern, BPM and A4. The page has its own tempo slider, which writes the shared BPM.

Whether the metronome's clicks leak into detection is a spec §13 manual check. The clicks are short and unpitched, so `analyzeFrame` should gate them out.

- [ ] **Step 1: Write the failing test**

`src/ui/pages/rhythm/RhythmTrainerPage.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeAudio, hold } from '../../../test/fakeGameAudio'
import { layoutShape } from '../../../test/layout'
import { loadBest } from '../../scores/bestScores'
import { SettingsProvider } from '../../settings/SettingsContext'
import { RhythmGame } from './RhythmTrainerPage'

vi.mock('../../hooks/useGameAudio', () => import('../../../test/fakeGameAudio'))
// The metronome's first beat was heard at 1000 ms: at 120 BPM the count-in bar is 1000–2999
// and the first hit is due at 3000.
const metronome = vi.hoisted(() => ({
  running: false,
  beat: null as number | null,
  lastBeatMs: 1000 as number | null,
  toggle: () => {
    metronome.running = !metronome.running
  },
}))
vi.mock('../../hooks/useMetronome', () => ({ useMetronome: () => metronome }))

const renderGame = () => {
  const result = render(
    <SettingsProvider storage={null}>
      <RhythmGame />
    </SettingsProvider>,
  )
  fireEvent.change(screen.getByRole('slider', { name: /Tempo/ }), { target: { value: '120' } })
  return result
}
/** A 100 ms note heard from `onsetMs + 60` (the detection latency), then silence for 200 ms. */
const play = (onsetMs: number) => {
  hold(67, onsetMs + 60, onsetMs + 160)
  hold(null, onsetMs + 210, onsetMs + 410)
}
const hits = () =>
  within(screen.getByRole('list', { name: 'Last hits' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent)

describe('RhythmGame', () => {
  beforeEach(() => {
    fakeAudio.reset()
    localStorage.clear()
    metronome.running = false
  })

  it('starts the metronome, counts in, then grades each hit', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
    expect(metronome.running).toBe(true)
    expect(screen.getByText('Count-in: listen to one bar, then play')).toBeInTheDocument()
    play(3020)
    expect(screen.getByText('Perfect')).toBeInTheDocument()
    play(3430)
    expect(screen.getByText('Good · 70 ms early')).toBeInTheDocument()
    expect(hits().slice(0, 3)).toEqual(['+20 ms', '-70 ms', '·'])
    expect(screen.getByText("You're 25 ms early on average")).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '■ Stop' }))
    expect(metronome.running).toBe(false)
  })

  it('marks a hit that never came as a miss', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
    hold(null, 2000, 3400)
    expect(screen.getByText('Miss')).toBeInTheDocument()
    expect(hits()[0]).toBe('✗')
  })

  it('scores one count-in bar and eight bars, and saves the best per pattern and tempo', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Pattern' }), {
      target: { value: 'charleston' },
    })
    fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
    expect(screen.getByRole('status')).toHaveTextContent('Round 1 of 16')
    // Charleston: hits on beats 0 and 1.5 of each bar → 3000, 3750, 5000, 5750, …
    for (let bar = 0; bar < 8; bar++) {
      play(3000 + bar * 2000)
      play(3750 + bar * 2000 + 50)
    }
    hold(null, 19000, 19500)
    // 8 perfect (100) + 8 off by 50 ms (good, 70) = 1360
    expect(screen.getByRole('status')).toHaveTextContent('Final score: 1360 / 1600')
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument()
    expect(metronome.running).toBe(false)
    expect(loadBest(localStorage, 'rhythm|bpm=120|pattern=charleston')).toBe(1360)
  })

  it('shows the pattern with its accents', () => {
    renderGame()
    fireEvent.change(screen.getByRole('combobox', { name: 'Pattern' }), {
      target: { value: 'train' },
    })
    const dots = within(screen.getByRole('list', { name: 'Pattern' })).getAllByRole('listitem')
    expect(dots).toHaveLength(8)
    expect(dots.map((d) => d.hasAttribute('data-accent'))).toEqual([
      true,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
    ])
  })

  it.each(['Practice', 'Scored'])('keeps the same layout in every phase (%s)', (mode) => {
    const { container } = renderGame()
    fireEvent.click(screen.getByRole('button', { name: mode }))
    const shape = () =>
      layoutShape(container, ['[aria-label="Pattern"] li', '[aria-label="Last hits"] li'])
    const idle = shape()
    expect(idle.stageRows).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
    expect(shape()).toEqual(idle)
    play(3020)
    expect(shape()).toEqual(idle)
    hold(null, 3500, 4000)
    expect(shape()).toEqual(idle)
  })

  it('waits for the microphone before offering Start', () => {
    fakeAudio.micStatus = 'starting'
    renderGame()
    expect(screen.getByText('Waiting for microphone…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '▶ Start' })).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/pages/rhythm`
Expected: FAIL, because `./RhythmTrainerPage` can't be resolved.

- [ ] **Step 3: Add the game id**

In `src/ui/scores/bestScores.ts`, replace the `GameId` line with:

```ts
export type GameId =
  | 'echo'
  | 'bend'
  | 'scales'
  | 'intervals'
  | 'melody'
  | 'hole-finder'
  | 'quiz'
  | 'rhythm'
```

- [ ] **Step 4: Write the page and its styles**

`src/ui/pages/rhythm/RhythmTrainerPage.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import {
  GRADE_POINTS,
  RHYTHM_PATTERNS,
  RhythmSession,
  averageOffset,
  bpmBucket,
  patternById,
  type Grade,
  type PatternId,
  type RhythmHit,
  type RhythmPattern,
} from '../../../core/rhythm/rhythmTrainer'
import { isFinished, type GameMode } from '../../../core/games/session'
import { TIME_SIGNATURES, type MetronomeConfig } from '../../../core/rhythm/schedule'
import { BPM_MAX, BPM_MIN, clampBpm } from '../../../core/rhythm/tempo'
import { MicErrorNotice } from '../../components/MicErrorNotice'
import { GameLayout } from '../../components/game/GameLayout'
import { ModeToggle } from '../../components/game/ModeToggle'
import { PlayAgain, ScorePanel } from '../../components/game/ScorePanel'
import { Stage } from '../../components/game/Stage'
import styles from '../../components/game/Game.module.css'
import { useGameAudio, type GameAudio, type HeardListener } from '../../hooks/useGameAudio'
import { useMetronome } from '../../hooks/useMetronome'
import { usePracticeTimer } from '../../hooks/usePracticeTimer'
import { useScoring } from '../../hooks/useScoring'
import { useSlot } from '../../hooks/useSlot'
import { bestScoreKey } from '../../scores/bestScores'
import { useSettings } from '../../settings/SettingsContext'
import rhythmStyles from './RhythmTrainerPage.module.css'

/** Spec §9: one count-in bar, then 8 scored bars. */
export const SCORED_BARS = 8
const SHOWN_HITS = 8

export function RhythmTrainerPage() {
  usePracticeTimer('rhythm')
  return (
    <GameLayout
      title="Rhythm trainer"
      intro="Play any note on every hit of the pattern, in time with the metronome. Pitch doesn't matter."
    >
      <RhythmGame />
    </GameLayout>
  )
}

export function RhythmGame() {
  const { settings, update } = useSettings()
  // Owned here, not by the keyed run, so a settings change doesn't restart the mic.
  const audio = useGameAudio(true)
  const [mode, setMode] = useState<GameMode>('practice')
  const [patternId, setPatternId] = useState<PatternId>('quarters')
  const runKey = [mode, patternId, settings.bpm, settings.a4].join('|')
  return (
    <>
      <div className={styles.toolbar}>
        <ModeToggle mode={mode} onChange={setMode} />
        <label className={styles.field}>
          Pattern
          <select
            aria-label="Pattern"
            value={patternId}
            onChange={(e) => setPatternId(e.target.value as PatternId)}
          >
            {RHYTHM_PATTERNS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Tempo
          <input
            type="range"
            min={BPM_MIN}
            max={BPM_MAX}
            step={1}
            value={settings.bpm}
            onChange={(e) => update({ bpm: clampBpm(Number(e.target.value)) })}
          />
          <span>{settings.bpm} BPM</span>
        </label>
      </div>
      <RhythmRun key={runKey} audio={audio} mode={mode} pattern={patternById(patternId)} />
    </>
  )
}

interface View {
  phase: 'idle' | 'running' | 'done'
  hits: RhythmHit[]
}

const IDLE: View = { phase: 'idle', hits: [] }

const GRADE_LABEL: Record<Grade, string> = {
  perfect: 'Perfect',
  good: 'Good',
  off: 'Off',
  miss: 'Miss',
}

const signed = (ms: number) => `${ms > 0 ? '+' : ''}${Math.round(ms)} ms`

/** "Perfect", "Good · 70 ms late", "Off · 180 ms early", "Miss". */
function describeHit(hit: RhythmHit): string {
  if (hit.offsetMs === null || hit.grade === 'perfect') return GRADE_LABEL[hit.grade]
  const ms = Math.round(Math.abs(hit.offsetMs))
  return `${GRADE_LABEL[hit.grade]} · ${ms} ms ${hit.offsetMs > 0 ? 'late' : 'early'}`
}

interface RunProps {
  audio: GameAudio
  mode: GameMode
  pattern: RhythmPattern
}

function RhythmRun({ audio, mode, pattern }: RunProps) {
  const { settings } = useSettings()
  const totalHits = SCORED_BARS * pattern.onsets.length
  const scoring = useScoring(
    mode,
    bestScoreKey('rhythm', { pattern: pattern.id, bpm: bpmBucket(settings.bpm) }),
    totalHits,
    GRADE_POINTS.perfect,
  )
  const metronomeConfig = useMemo<MetronomeConfig>(
    () => ({ bpm: settings.bpm, signature: TIME_SIGNATURES[2], subdivision: 1 }),
    [settings.bpm],
  )
  const metronome = useMetronome(metronomeConfig)
  const slot = useSlot<RhythmSession>()
  const [view, setView] = useState<View>(IDLE)

  const start = () => {
    if (mode === 'scored') scoring.restart()
    slot.set(
      new RhythmSession({
        pattern,
        bpm: settings.bpm,
        countInBars: 1,
        bars: mode === 'scored' ? SCORED_BARS : null,
        a4: settings.a4,
      }),
    )
    setView({ ...IDLE, phase: 'running' })
    if (!metronome.running) metronome.toggle()
  }
  const finish = (phase: View['phase']) => {
    slot.set(null)
    if (metronome.running) metronome.toggle()
    setView((v) => ({ ...v, phase }))
  }

  const onHeard: HeardListener = (freq, timeMs) => {
    const session = slot.get()
    if (!session) return
    if (metronome.lastBeatMs !== null) session.syncBeat(metronome.lastBeatMs)
    const hits = session.push(freq, timeMs)
    if (hits.length === 0) return
    for (const h of hits)
      scoring.record({ correct: h.grade !== 'miss', points: GRADE_POINTS[h.grade] })
    setView((v) => ({ ...v, hits: [...v.hits, ...hits] }))
    if (session.done) finish('done')
  }
  useEffect(() => audio.listen(onHeard))

  const last = view.hits.at(-1)
  const shown = view.hits.slice(-SHOWN_HITS)
  const average = averageOffset(mode === 'practice' ? shown : view.hits)
  const bar = last ? last.bar + 1 : 0

  return (
    <>
      {audio.error && <MicErrorNotice kind={audio.error} />}
      <ScorePanel scoring={scoring} />
      <Stage
        controls={
          <>
            {/* The primary action always comes first. */}
            {isFinished(scoring.session) && <PlayAgain onClick={start} />}
            {view.phase === 'idle' &&
              !audio.error &&
              (audio.status === 'listening' ? (
                <button type="button" className={styles.primary} onClick={start}>
                  ▶ Start
                </button>
              ) : (
                <p className={styles.hint}>Waiting for microphone…</p>
              ))}
            {view.phase === 'running' && (
              <button type="button" onClick={() => finish('idle')}>
                ■ Stop
              </button>
            )}
            {view.phase === 'done' && mode === 'practice' && (
              <button type="button" className={styles.primary} onClick={start}>
                ▶ Again
              </button>
            )}
          </>
        }
        headline={
          view.phase === 'running' && !last
            ? 'Count-in: listen to one bar, then play'
            : last &&
              `${describeHit(last)}${mode === 'scored' ? ` · +${GRADE_POINTS[last.grade]}` : ''}`
        }
        result={last ? (last.grade === 'miss' || last.grade === 'off' ? 'bad' : 'ok') : undefined}
        detail={
          <>
            {mode === 'scored' &&
              view.phase === 'running' &&
              `Bar ${Math.max(1, bar)} of ${SCORED_BARS}`}
            {mode === 'practice' &&
              average !== null &&
              `You're ${Math.round(Math.abs(average))} ms ${average > 0 ? 'late' : 'early'} on average`}
          </>
        }
      />
      <ol className={rhythmStyles.bar} aria-label="Pattern">
        {pattern.onsets.map((beat) => (
          <li
            key={beat}
            className={rhythmStyles.onset}
            style={{ left: `${(beat / 4) * 100}%` }}
            data-accent={pattern.accents.includes(beat) || undefined}
            data-now={
              metronome.beat !== null && Math.floor(beat) === metronome.beat ? 'true' : undefined
            }
          >
            <span className="visually-hidden">Beat {Math.round(beat * 100) / 100 + 1}</span>
          </li>
        ))}
      </ol>
      <ol className={rhythmStyles.hits} aria-label="Last hits">
        {Array.from({ length: SHOWN_HITS }, (_, i) => {
          const hit = shown[i]
          return (
            <li key={i} className={rhythmStyles.hit} data-grade={hit?.grade}>
              {hit ? (hit.offsetMs === null ? '✗' : signed(hit.offsetMs)) : '·'}
            </li>
          )
        })}
      </ol>
    </>
  )
}
```

`src/ui/pages/rhythm/RhythmTrainerPage.module.css`:

```css
/* One bar of the pattern: four beats wide, a dot per onset. */
.bar {
  position: relative;
  height: 2.5rem;
  margin: 0 0 1rem;
  padding: 0;
  border-bottom: 2px solid var(--border);
  background: repeating-linear-gradient(to right, var(--border) 0 2px, transparent 2px 25%);
  list-style: none;
}

.onset {
  position: absolute;
  top: 0.75rem;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: var(--text-dim);
  transform: translateX(-0.5rem);
}

.onset[data-accent] {
  top: 0.5rem;
  width: 1.5rem;
  height: 1.5rem;
  background: var(--accent);
  transform: translateX(-0.75rem);
}

.onset[data-now] {
  box-shadow: 0 0 0 3px var(--target);
}

/* Eight fixed slots for the latest hits. */
.hits {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 0.4rem;
  height: 2.5rem;
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}

.hit {
  display: grid;
  place-items: center;
  border: 2px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  white-space: nowrap;
}

.hit[data-grade='perfect'] {
  border-color: var(--ok);
}
.hit[data-grade='good'] {
  border-color: color-mix(in srgb, var(--ok) 55%, var(--border));
}
.hit[data-grade='off'] {
  border-color: var(--warn);
}
.hit[data-grade='miss'] {
  border-color: var(--bad);
}
```

- [ ] **Step 5: Route and Home entry**

In `src/ui/App.tsx`, add `import { RhythmTrainerPage } from './pages/rhythm/RhythmTrainerPage'` and the route `'/rhythm': RhythmTrainerPage,` after the `'/quiz'` route.

In `src/ui/pages/homeGroups.ts`, append to the Games `entries` (after the quiz entry):

```ts
      {
        id: 'rhythm',
        icon: '⏱️',
        title: 'Rhythm trainer',
        text: 'Play in time with the metronome: quarters, shuffles, the train beat.',
      },
```

In `src/ui/pages/homeGroups.test.ts`, change the Games row to:

```ts
      [
        'games',
        'Games',
        ['echo', 'bend', 'scales', 'intervals', 'melody', 'hole-finder', 'quiz', 'rhythm'],
      ],
```

In `src/ui/App.test.tsx`, add `['#/rhythm', 'Rhythm trainer'],` to the `routes %s to its game` list.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/ui && npm run typecheck && npm run lint`
Expected: PASS; no type or lint errors.

- [ ] **Step 7: Try it**

Run `npm run dev` and open `#/rhythm`. Play quarters at 90 BPM with a real harp. Expected:
- steady playing grades mostly Perfect/Good;
- the metronome's clicks alone produce no hits.

If the average is consistently late by a similar amount, note the figure: the spec's §13 manual check confirms the 60 ms latency.

- [ ] **Step 8: Commit**

```bash
git add src/ui/pages/rhythm src/ui/scores/bestScores.ts src/ui/App.tsx src/ui/App.test.tsx src/ui/pages/homeGroups.ts src/ui/pages/homeGroups.test.ts
git commit -m "feat: rhythm trainer — play patterns in time with the metronome"
```

---

### Task 11: Tab reader logic: judging notes at tempo, the "wait for me" clock

**Files:**
- Create: `src/core/tab/tabJudge.ts`
- Test: `src/core/tab/tabJudge.test.ts`

**Interfaces:**
- Consumes: `freqToMidi`; `DETECTION_LATENCY_MS` (games/scaleRunner.ts)
- Produces:
  - `TAB_HOLD_MS = 250`, `ONSET_WINDOW_MS = 150`, `FULL_TIMING_MS = 50`
  - `requiredHoldMs(durationMs): number` = min(250, 0.6 × duration)
  - `timingFactor(offsetMs): number` (1 within ±50, linear to 0.5 at ±150, 0 beyond), `tabNotePoints(offsetMs): number`
  - `interface JudgeNote { midi: number; startMs: number; durationMs: number }` (times from the song's start)
  - `interface JudgedNote { index: number; hit: boolean; offsetMs: number | null; points: number }`
  - `class TabJudge { constructor(notes: readonly JudgeNote[], config: { toleranceCents: number; a4: number }); get done(): boolean; get current(): number; push(freq: number | null, timeMs: number): JudgedNote[] }`
  - `class WaitClock { constructor(startMs: number, beatMs: number); position(nowMs: number, stopBeat: number): number; release(nowMs: number, stopBeat: number): void }`

Spec §10, the scored hit rule.
- **The held pitch.** The judge tracks the pitch being held (within the matcher tolerance) and when it started, corrected for latency. A note is hit when that pitch started within ±150 ms of the note's onset and has been held for `requiredHoldMs`.
- **Misses.** A note is a miss once its window has passed without a qualifying hold.
- **Repeated pitches** (decision 5, Review Focus 2). The mic can't hear a tongued repeat, so a repeated pitch still sounding from the note before counts as starting on time.
- **`WaitClock`** drives the practice lane. It moves at tempo but never past the next note's start until that note has been played, then carries on from where it stopped.

- [ ] **Step 1: Write the failing test**

`src/core/tab/tabJudge.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { midiToFreq } from '../music/pitch'
import {
  TabJudge,
  WaitClock,
  requiredHoldMs,
  tabNotePoints,
  timingFactor,
  type JudgedNote,
} from './tabJudge'

describe('timing', () => {
  it('needs min(250 ms, 60 % of the note)', () => {
    expect(requiredHoldMs(1000)).toBe(250)
    expect(requiredHoldMs(250)).toBe(150)
  })

  it('gives full credit within ±50 ms, half at ±150 ms, none beyond', () => {
    expect([0, 50, -50, 100, -150, 151].map(timingFactor)).toEqual([1, 1, 1, 0.75, 0.5, 0])
    expect(tabNotePoints(100)).toBe(75)
  })
})

/** Feeds `midi` (null = silence) every 10 ms from `from` to `to`, song time. */
function feed(j: TabJudge, from: number, to: number, midi: number | null): JudgedNote[] {
  const out: JudgedNote[] = []
  for (let t = from; t <= to; t += 10)
    out.push(...j.push(midi === null ? null : midiToFreq(midi), t))
  return out
}
const judge = (notes: [number, number, number][]) =>
  new TabJudge(
    notes.map(([midi, startMs, durationMs]) => ({ midi, startMs, durationMs })),
    { toleranceCents: 25, a4: 440 },
  )

describe('TabJudge', () => {
  // Readings arrive 60 ms after the sound (detection latency), so playing a note that starts at
  // `s` means readings from s + 60.
  it('scores a note by how close its start was', () => {
    const j = judge([
      [72, 0, 500],
      [74, 500, 500],
      [76, 1000, 500],
    ])
    const out = [
      ...feed(j, 60, 400, 72), // on time
      ...feed(j, 410, 660, null),
      ...feed(j, 660, 950, 74), // starts at 600: 100 ms late
      ...feed(j, 1160, 1500, 76), // starts at 1100: 100 ms late
    ]
    expect(out).toEqual([
      { index: 0, hit: true, offsetMs: 0, points: 100 },
      { index: 1, hit: true, offsetMs: 100, points: 75 },
      { index: 2, hit: true, offsetMs: 100, points: 75 },
    ])
    expect(j.done).toBe(true)
  })

  it('misses a note played too late, too short or not at all', () => {
    const j = judge([
      [72, 0, 500],
      [74, 500, 500],
      [76, 1000, 500],
    ])
    const out = [
      ...feed(j, 260, 500, 72), // starts at 200: outside ±150 ms
      ...feed(j, 560, 700, 74), // held 140 ms of the 250 needed
      ...feed(j, 710, 1400, null),
    ]
    expect(out.map((n) => [n.index, n.hit])).toEqual([
      [0, false],
      [1, false],
      [2, false],
    ])
  })

  it('accepts a wrong note before the right one, if the right one starts in time', () => {
    const j = judge([[72, 0, 500]])
    expect([...feed(j, 0, 100, 74), ...feed(j, 110, 400, 72)]).toEqual([
      { index: 0, hit: true, offsetMs: 50, points: 100 },
    ])
  })

  it('counts a repeated pitch that is still sounding as played on time', () => {
    // Mary Had a Little Lamb's "E E E": the mic hears one long E.
    const j = judge([
      [76, 0, 500],
      [76, 500, 500],
      [76, 1000, 1000],
    ])
    expect(feed(j, 60, 1400, 76).map((n) => [n.index, n.hit, n.offsetMs])).toEqual([
      [0, true, 0],
      [1, true, 0],
      [2, true, 0],
    ])
  })

  it('shortens the hold for fast notes', () => {
    const j = judge([[72, 0, 200]]) // needs 120 ms
    expect(feed(j, 60, 180, 72)).toEqual([{ index: 0, hit: true, offsetMs: 0, points: 100 }])
  })
})

describe('WaitClock', () => {
  it('moves at tempo, stops at the awaited note and carries on once it is played', () => {
    const c = new WaitClock(1000, 500)
    expect(c.position(1000, 4)).toBe(0)
    expect(c.position(2000, 4)).toBe(2)
    expect(c.position(4000, 4)).toBe(4)
    c.release(4000, 4)
    expect(c.position(4500, 5)).toBe(5)
    expect(c.position(4250, 5)).toBe(4.5)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/core/tab/tabJudge.test.ts`
Expected: FAIL, because `./tabJudge` can't be resolved.

- [ ] **Step 3: Write the judge and the clock**

`src/core/tab/tabJudge.ts`:

```ts
import { DETECTION_LATENCY_MS } from '../games/scaleRunner'
import { freqToMidi } from '../music/pitch'

/** Spec §10: "Wait for me" accepts a note held this long; scored notes need at most this. */
export const TAB_HOLD_MS = 250
/** A scored note must start within this of its onset. */
export const ONSET_WINDOW_MS = 150
/** Onsets this close earn full timing credit. */
export const FULL_TIMING_MS = 50

/** A scored note must be held min(250 ms, 60 % of its length). */
export function requiredHoldMs(durationMs: number): number {
  return Math.min(TAB_HOLD_MS, 0.6 * durationMs)
}

/** 1 within ±50 ms, falling linearly to 0.5 at ±150 ms; 0 beyond. */
export function timingFactor(offsetMs: number): number {
  const a = Math.abs(offsetMs)
  if (a > ONSET_WINDOW_MS) return 0
  if (a <= FULL_TIMING_MS) return 1
  return 1 - (0.5 * (a - FULL_TIMING_MS)) / (ONSET_WINDOW_MS - FULL_TIMING_MS)
}

export function tabNotePoints(offsetMs: number): number {
  return Math.round(100 * timingFactor(offsetMs))
}

export interface JudgeNote {
  midi: number
  /** From the start of the song (after the count-in). */
  startMs: number
  durationMs: number
}

export interface JudgedNote {
  index: number
  hit: boolean
  /** Positive = late; null for a miss. */
  offsetMs: number | null
  points: number
}

/**
 * Judges a tab played at tempo. Feed every mic frame with its time from the song's start; each
 * push returns the notes it decided. A note is hit when its pitch is held long enough, starting
 * within ±150 ms of its onset (after the detection latency).
 */
export class TabJudge {
  private index = 0
  /** The pitch being held now and when it started (latency-corrected). */
  private run: { midi: number; startMs: number } | null = null

  constructor(
    private readonly notes: readonly JudgeNote[],
    private readonly config: { toleranceCents: number; a4: number },
  ) {}

  get done(): boolean {
    return this.index >= this.notes.length
  }

  /** Index of the next note to be judged. */
  get current(): number {
    return this.index
  }

  push(freq: number | null, timeMs: number): JudgedNote[] {
    const t = timeMs - DETECTION_LATENCY_MS
    const heard = freq === null ? null : freqToMidi(freq, this.config.a4)
    const midi =
      heard !== null && Math.abs(heard.cents) <= this.config.toleranceCents ? heard.midi : null
    if (midi === null) this.run = null
    else if (this.run?.midi !== midi) this.run = { midi, startMs: t }

    const judged: JudgedNote[] = []
    while (this.index < this.notes.length) {
      const note = this.notes[this.index]
      const onset = this.onsetFor(this.index)
      const inWindow = onset !== null && Math.abs(onset - note.startMs) <= ONSET_WINDOW_MS
      if (inWindow && t - onset >= requiredHoldMs(note.durationMs)) {
        const offsetMs = onset - note.startMs
        judged.push({ index: this.index, hit: true, offsetMs, points: tabNotePoints(offsetMs) })
      } else if (!inWindow && t > note.startMs + ONSET_WINDOW_MS) {
        judged.push({ index: this.index, hit: false, offsetMs: null, points: 0 })
      } else {
        break
      }
      this.index++
    }
    return judged
  }

  /**
   * When the held pitch started, for note `i`. The mic can't reliably hear a tongued repeat, so
   * a repeated pitch that is still sounding from the note before counts as starting on time.
   */
  private onsetFor(i: number): number | null {
    const note = this.notes[i]
    if (!this.run || this.run.midi !== note.midi) return null
    const previous = this.notes[i - 1]
    const early = this.run.startMs < note.startMs - ONSET_WINDOW_MS
    if (early && previous?.midi === note.midi) return note.startMs
    return this.run.startMs
  }
}

/**
 * "Wait for me": the lane moves at tempo but stops at the next note until it has been played.
 * Positions are in beats along the lane.
 */
export class WaitClock {
  private fromBeat = 0
  private fromMs: number

  constructor(
    startMs: number,
    private readonly beatMs: number,
  ) {
    this.fromMs = startMs
  }

  position(nowMs: number, stopBeat: number): number {
    return Math.min(stopBeat, this.fromBeat + Math.max(0, nowMs - this.fromMs) / this.beatMs)
  }

  /** The awaited note was played: carry on at tempo from where the lane is now. */
  release(nowMs: number, stopBeat: number): void {
    this.fromBeat = this.position(nowMs, stopBeat)
    this.fromMs = nowMs
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/core/tab && npm run typecheck && npm run lint`
Expected: PASS; no type or lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/core/tab/tabJudge.ts src/core/tab/tabJudge.test.ts
git commit -m "feat(tab): judge tab played at tempo; wait-for-me lane clock"
```

---

### Task 12: Tab reader page and "Your tab"

**Files:**
- Create: `src/ui/tab/yourTab.ts`, `src/ui/pages/tabReader/TabReaderPage.tsx`, `src/ui/pages/tabReader/TabReaderPage.module.css`
- Modify: `src/ui/scores/bestScores.ts` (`GameId`), `src/ui/App.tsx` (route), `src/ui/pages/homeGroups.ts` (Games entry)
- Test: `src/ui/tab/yourTab.test.ts`, `src/ui/pages/tabReader/TabReaderPage.test.tsx`, `src/ui/pages/homeGroups.test.ts` (update), `src/ui/App.test.tsx` (append)

**Interfaces:**
- Consumes:
  - `parseTab`, `tabTimeline`, `beatMs`, `textHash`, `TabTimeline` (Task 3)
  - `SONGS` (Task 4)
  - `TabJudge`, `WaitClock`, `TAB_HOLD_MS`, `JudgedNote` (Task 11)
  - `BeatAnchor`, `useScoring(…, roundMax)` (Task 9)
  - `NoteSlots`, `TabText`, `useAnimationFrame` (Task 2)
  - `ScaleRun` (games/scaleRunner.ts), `useGameAudio`, `useMetronome`, `useSlot`
  - `useHarp`, `tuningPart`, `usePracticeTimer` (Plan 3)
- Produces:
  - `YOUR_TAB_KEY = 'harp-tools:your-tab'`, `EXAMPLE_TAB`, `loadYourTab(storage): string`, `saveYourTab(storage, text): void`
  - `TabReaderPage()` (route `/tab-reader`, practice-timer id `tab-reader`); `TabReaderGame({ storage?: Storage | null })`; `PX_PER_BEAT = 64`, `PLAYHEAD_PX = 96`
  - `GameId` gains `'tab-reader'`

Spec §10.
- **Songs.** The Song select lists the library plus "Your tab" (a textarea saved to `localStorage` on every edit). The tab is parsed against the current harp. Errors are listed with their token positions, and an empty tab says so; in both cases there is no Start button (Review Focus 3).
- **The lane.** It is a fixed window with a fixed playhead and a track that the `useAnimationFrame` callback moves through a ref:
  - a count-in region one bar long;
  - bar lines;
  - one box per note, sized by its beats, coloured by technique and labelled with `TabText`.

  The page re-renders only when a note is decided (decision 5).
- **Also on the page:**
  - a `NoteSlots` row of the previous and next five notes;
  - the chart, with the upcoming note on `target`.
- **Practice with "Wait for me"** (default on): `ScaleRun` with a 250 ms hold follows the notes, `WaitClock` holds the lane at the next note, and there is no metronome.
- **At tempo** (scored, or practice with "Wait for me" off):
  - the metronome clicks in the song's metre, and `BeatAnchor` finds its grid;
  - the song starts one bar after the first beat, and `TabJudge` decides each note;
  - a scored song is one session, one round per note, each worth up to 100;
  - the best score is per song + `tuningPart` (a custom tab is keyed by `textHash` of its text).
- **Settings changes.** Tempo, key, tuning, A4 and tolerance are in the run key, so a change mid-song stops it and resets the score (Review Focus 5).

- [ ] **Step 1: Write the failing tests**

`src/ui/tab/yourTab.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { EXAMPLE_TAB, YOUR_TAB_KEY, loadYourTab, saveYourTab } from './yourTab'

describe('your tab storage', () => {
  it('saves and loads the text, including an empty one', () => {
    const data: Record<string, string> = {}
    const storage = {
      getItem: (k: string) => data[k] ?? null,
      setItem: (k: string, v: string) => void (data[k] = v),
    }
    expect(loadYourTab(storage)).toBe(EXAMPLE_TAB)
    saveYourTab(storage, '4 -4')
    expect(data[YOUR_TAB_KEY]).toBe('4 -4')
    expect(loadYourTab(storage)).toBe('4 -4')
    saveYourTab(storage, '')
    expect(loadYourTab(storage)).toBe('')
  })

  it('falls back to the example when storage is missing or throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('full')
      },
    }
    expect(loadYourTab(null)).toBe(EXAMPLE_TAB)
    expect(loadYourTab(throwing)).toBe(EXAMPLE_TAB)
    expect(() => saveYourTab(throwing, 'x')).not.toThrow()
  })
})
```

`src/ui/pages/tabReader/TabReaderPage.test.tsx`:

```tsx
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { textHash } from '../../../core/tab/parseTab'
import { fakeAudio, hold } from '../../../test/fakeGameAudio'
import { layoutShape } from '../../../test/layout'
import { loadBest } from '../../scores/bestScores'
import { SettingsProvider, useSettings } from '../../settings/SettingsContext'
import { YOUR_TAB_KEY } from '../../tab/yourTab'
import { TabReaderGame } from './TabReaderPage'

vi.mock('../../hooks/useGameAudio', () => import('../../../test/fakeGameAudio'))
// The metronome's first beat was heard at 1000 ms. At 120 BPM (set by the test) a 4-beat
// count-in ends at 3000, where the song starts.
const metronome = vi.hoisted(() => ({
  running: false,
  beat: null as number | null,
  lastBeatMs: 1000 as number | null,
  toggle: () => {
    metronome.running = !metronome.running
  },
}))
vi.mock('../../hooks/useMetronome', () => ({ useMetronome: () => metronome }))

function Tempo() {
  const { update } = useSettings()
  return (
    <>
      <button type="button" onClick={() => update({ bpm: 120 })}>
        set 120 BPM
      </button>
      <button type="button" onClick={() => update({ bpm: 100 })}>
        set 100 BPM
      </button>
    </>
  )
}

const renderGame = (tab = '4 -4 5') => {
  localStorage.setItem(YOUR_TAB_KEY, tab)
  const result = render(
    <SettingsProvider storage={null}>
      <Tempo />
      <TabReaderGame storage={localStorage} />
    </SettingsProvider>,
  )
  fireEvent.change(screen.getByRole('combobox', { name: 'Song' }), { target: { value: 'custom' } })
  return result
}
const start = () => fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
const slots = () =>
  within(screen.getByRole('list', { name: 'Next notes' }))
    .getAllByRole('listitem')
    .map((li) => `${li.textContent}:${li.dataset.state}`)

describe('TabReaderGame', () => {
  beforeEach(() => {
    fakeAudio.reset()
    localStorage.clear()
    metronome.running = false
  })

  it('waits for each note in practice', () => {
    renderGame()
    start()
    expect(screen.getByText('Next: 4 (C5)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '4 C5' })).toHaveAttribute('data-highlight', 'target')
    expect(metronome.running).toBe(false)
    hold(72, 0, 250)
    expect(screen.getByText('Next: -4 (D5)')).toBeInTheDocument()
    expect(slots().slice(0, 3)).toEqual(['4:done', '-4:current', '5:todo'])
    hold(74, 300, 550)
    hold(76, 600, 850)
    expect(screen.getByText('✓ Done — 3 of 3 notes')).toBeInTheDocument()
  })

  it('scores notes at tempo by their timing, and saves the best per tab', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    fireEvent.click(screen.getByRole('button', { name: 'set 120 BPM' }))
    start()
    expect(metronome.running).toBe(true)
    expect(screen.getByRole('status')).toHaveTextContent('Round 1 of 3')
    hold(72, 3060, 3360) // on time: 100
    hold(74, 3610, 3910) // 50 ms late: 100
    hold(76, 4160, 4460) // 100 ms late: 75
    expect(screen.getByRole('status')).toHaveTextContent('Final score: 275 / 300')
    expect(metronome.running).toBe(false)
    expect(loadBest(localStorage, `tab-reader|song=custom-${textHash('4 -4 5')}`)).toBe(275)
  })

  it('reports tab errors and offers no Start', () => {
    renderGame("4 x 4'")
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Token 2 “x” is not a note, rest (_) or bar line (|).')
    expect(alert).toHaveTextContent("Token 3 “4'” isn't on this harp.")
    expect(screen.queryByRole('button', { name: '▶ Start' })).toBeNull()
  })

  it('says so when the tab has no notes', () => {
    renderGame('_ | _:2 |')
    expect(screen.getByRole('alert')).toHaveTextContent('This tab has no notes yet.')
  })

  it('keeps your tab between visits', () => {
    const { unmount } = renderGame('4 -4 5')
    fireEvent.change(screen.getByRole('textbox', { name: /Your tab/ }), {
      target: { value: '6 -6 7' },
    })
    expect(localStorage.getItem(YOUR_TAB_KEY)).toBe('6 -6 7')
    unmount()
    render(
      <SettingsProvider storage={null}>
        <TabReaderGame storage={localStorage} />
      </SettingsProvider>,
    )
    fireEvent.change(screen.getByRole('combobox', { name: 'Song' }), {
      target: { value: 'custom' },
    })
    expect(screen.getByRole('textbox', { name: /Your tab/ })).toHaveValue('6 -6 7')
  })

  it('stops the song when the tempo changes', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    fireEvent.click(screen.getByRole('button', { name: 'set 120 BPM' }))
    start()
    hold(72, 3060, 3360)
    fireEvent.click(screen.getByRole('button', { name: 'set 100 BPM' }))
    expect(screen.getByRole('button', { name: '▶ Start' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Round 1 of 3 · Score 0')
  })

  it.each(['Practice', 'Scored'])('keeps the same layout in every phase (%s)', (mode) => {
    const { container } = renderGame()
    fireEvent.click(screen.getByRole('button', { name: mode }))
    fireEvent.click(screen.getByRole('button', { name: 'set 120 BPM' }))
    const shape = () => layoutShape(container, ['[aria-label="Next notes"] li', '.lane', '.note'])
    const idle = shape()
    expect(idle.areas['[aria-label="Next notes"] li']).toBe(6)
    start()
    expect(shape()).toEqual(idle)
    const t0 = mode === 'Scored' ? 3060 : 0
    hold(72, t0, t0 + 300)
    expect(shape()).toEqual(idle)
  })

  describe('the lane', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('scrolls at tempo and stops at the note it waits for', () => {
      const { container } = renderGame()
      const track = () => (container.querySelector('.track') as HTMLElement).style.transform
      start()
      // 90 BPM default: 666.7 ms a beat; 4-beat count-in, first note at beat 4.
      fakeAudio.time = 1000
      act(() => vi.advanceTimersByTime(20))
      expect(track()).toBe(`translateX(${96 - 1.5 * 64}px)`)
      fakeAudio.time = 10000
      act(() => vi.advanceTimersByTime(20))
      expect(track()).toBe(`translateX(${96 - 4 * 64}px)`)
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/tab src/ui/pages/tabReader`
Expected: FAIL, because `./yourTab` and `./TabReaderPage` can't be resolved.

- [ ] **Step 3: Write the "Your tab" storage**

`src/ui/tab/yourTab.ts`:

```ts
export const YOUR_TAB_KEY = 'harp-tools:your-tab'

/** What "Your tab" starts with: a short example of every part of the format. */
export const EXAMPLE_TAB = '4 -4 5 -5 | 6:2 6:2 | -6 -6 6:2 | _ 5 -4 4 |'

export function loadYourTab(storage: Pick<Storage, 'getItem'> | null): string {
  try {
    return storage?.getItem(YOUR_TAB_KEY) ?? EXAMPLE_TAB
  } catch {
    return EXAMPLE_TAB
  }
}

export function saveYourTab(storage: Pick<Storage, 'setItem'> | null, text: string): void {
  try {
    storage?.setItem(YOUR_TAB_KEY, text)
  } catch {
    // Storage full or blocked: the tab just won't be there next time.
  }
}
```

- [ ] **Step 4: Add the game id**

In `src/ui/scores/bestScores.ts`, add `| 'tab-reader'` as a new last line of the `GameId` union (after `| 'rhythm'`).

- [ ] **Step 5: Write the page and its styles**

`src/ui/pages/tabReader/TabReaderPage.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { ScaleRun } from '../../../core/games/scaleRunner'
import { isFinished, type GameMode } from '../../../core/games/session'
import { findNotes, noteId } from '../../../core/harmonica/harp'
import { keySpelling } from '../../../core/harmonica/keys'
import { noteName } from '../../../core/music/noteNames'
import { BeatAnchor } from '../../../core/rhythm/beatAnchor'
import { TIME_SIGNATURES, type MetronomeConfig } from '../../../core/rhythm/schedule'
import {
  beatMs,
  parseTab,
  tabTimeline,
  textHash,
  type TabTimeline,
} from '../../../core/tab/parseTab'
import { SONGS } from '../../../core/tab/songs'
import { TAB_HOLD_MS, TabJudge, WaitClock, type JudgedNote } from '../../../core/tab/tabJudge'
import { HarmonicaDiagram, type Highlight } from '../../components/HarmonicaDiagram'
import { MicErrorNotice } from '../../components/MicErrorNotice'
import { TabText } from '../../components/TabText'
import { GameLayout } from '../../components/game/GameLayout'
import { ModeToggle } from '../../components/game/ModeToggle'
import { NoteSlots, type NoteSlot } from '../../components/game/NoteSlots'
import { PlayAgain, ScorePanel } from '../../components/game/ScorePanel'
import { Stage } from '../../components/game/Stage'
import styles from '../../components/game/Game.module.css'
import { useAnimationFrame } from '../../hooks/useAnimationFrame'
import { useGameAudio, type GameAudio, type HeardListener } from '../../hooks/useGameAudio'
import { useHarp } from '../../hooks/useHarp'
import { useMetronome } from '../../hooks/useMetronome'
import { usePracticeTimer } from '../../hooks/usePracticeTimer'
import { useScoring } from '../../hooks/useScoring'
import { useSlot } from '../../hooks/useSlot'
import { bestScoreKey, tuningPart } from '../../scores/bestScores'
import { browserStorage } from '../../settings/settings'
import { useSettings } from '../../settings/SettingsContext'
import { loadYourTab, saveYourTab } from '../../tab/yourTab'
import laneStyles from './TabReaderPage.module.css'

const CUSTOM = 'custom'
/** Lane scale and where the playhead sits. */
export const PX_PER_BEAT = 64
export const PLAYHEAD_PX = 96
/** How many upcoming notes the slot row shows (the last one played, then the next ones). */
const WINDOW = 6

export function TabReaderPage() {
  usePracticeTimer('tab-reader')
  return (
    <GameLayout
      title="Tab reader"
      intro="The tab scrolls towards the line: play each note as it reaches it."
    >
      <TabReaderGame />
    </GameLayout>
  )
}

export function TabReaderGame({ storage = browserStorage() }: { storage?: Storage | null }) {
  const { settings } = useSettings()
  const harp = useHarp()
  // Owned here, not by the keyed run, so a settings change doesn't restart the mic.
  const audio = useGameAudio(true)
  const [mode, setMode] = useState<GameMode>('practice')
  const [songId, setSongId] = useState(SONGS[0].id)
  const [waitForMe, setWaitForMe] = useState(true)
  const [yourTab, setYourTab] = useState(() => loadYourTab(storage))

  const song = SONGS.find((s) => s.id === songId)
  const text = song ? song.tab : yourTab
  const parsed = parseTab(text, harp)
  const timeline = tabTimeline(parsed.items)
  const wait = mode === 'practice' && waitForMe
  const songKey = song ? song.id : `${CUSTOM}-${textHash(yourTab)}`

  const runKey = [
    mode,
    wait,
    songKey,
    settings.key,
    settings.tuning,
    settings.a4,
    settings.bpm,
    settings.toleranceCents,
  ].join('|')
  const bestKey = bestScoreKey('tab-reader', {
    song: songKey,
    ...tuningPart(settings.tuning),
  })

  return (
    <>
      <div className={styles.toolbar}>
        <ModeToggle mode={mode} onChange={setMode} />
        <label className={styles.field}>
          Song
          <select aria-label="Song" value={songId} onChange={(e) => setSongId(e.target.value)}>
            {SONGS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
            <option value={CUSTOM}>Your tab</option>
          </select>
        </label>
        {mode === 'practice' && (
          <label className={styles.field}>
            <input
              type="checkbox"
              checked={waitForMe}
              onChange={(e) => setWaitForMe(e.target.checked)}
            />
            Wait for me
          </label>
        )}
        <span className={styles.hint}>{settings.bpm} BPM (set it on the metronome)</span>
      </div>
      {!song && (
        <label className={laneStyles.yourTab}>
          Your tab
          <textarea
            rows={3}
            spellCheck={false}
            value={yourTab}
            onChange={(e) => {
              setYourTab(e.target.value)
              saveYourTab(storage, e.target.value)
            }}
          />
          <span className={styles.hint}>
            Notes like 4 -4 -3&apos; 6o, _ for a rest, | for a bar line, :2 for two beats.
          </span>
        </label>
      )}
      {parsed.errors.length > 0 ? (
        <div role="alert" className="notice">
          <strong>This tab can't be played on this harp:</strong>
          <ul>
            {parsed.errors.map((e) => (
              <li key={e.position}>
                Token {e.position} “{e.token}” {e.message}.
              </li>
            ))}
          </ul>
        </div>
      ) : timeline.notes.length === 0 ? (
        <p role="alert" className="notice">
          This tab has no notes yet.
        </p>
      ) : (
        <TabRun
          key={runKey}
          audio={audio}
          mode={mode}
          wait={wait}
          timeline={timeline}
          beatsPerBar={song?.beatsPerBar ?? 4}
          bestKey={bestKey}
        />
      )}
    </>
  )
}

type Runtime =
  | { kind: 'wait'; follower: ScaleRun; clock: WaitClock }
  | { kind: 'tempo'; judge: TabJudge; anchor: BeatAnchor }

interface View {
  phase: 'idle' | 'running' | 'done'
  /** The note being waited for / judged next. */
  index: number
  results: (JudgedNote | null)[]
}

interface RunProps {
  audio: GameAudio
  mode: GameMode
  wait: boolean
  timeline: TabTimeline
  beatsPerBar: 3 | 4
  bestKey: string
}

function TabRun({ audio, mode, wait, timeline, beatsPerBar, bestKey }: RunProps) {
  const { settings } = useSettings()
  const harp = useHarp()
  const spelling = keySpelling(settings.key)
  const { notes } = timeline
  const scoring = useScoring(mode, bestKey, notes.length, 100)
  const metronomeConfig = useMemo<MetronomeConfig>(
    () => ({
      bpm: settings.bpm,
      signature: TIME_SIGNATURES[beatsPerBar === 3 ? 1 : 2],
      subdivision: 1,
    }),
    [settings.bpm, beatsPerBar],
  )
  const metronome = useMetronome(metronomeConfig)
  const runtime = useSlot<Runtime>()
  const track = useRef<HTMLDivElement>(null)
  const idle = (): View => ({ phase: 'idle', index: 0, results: notes.map(() => null) })
  const [view, setView] = useState<View>(idle)
  const beat = beatMs(settings.bpm)
  const countIn = beatsPerBar
  /** Lane position (in beats, count-in included) where note `i` starts. */
  const laneBeat = (i: number) => countIn + notes[i].startBeat

  const start = () => {
    if (mode === 'scored') scoring.restart()
    setView({ ...idle(), phase: 'running' })
    if (wait) {
      const matcher = { toleranceCents: settings.toleranceCents, holdMs: TAB_HOLD_MS }
      const follower = new ScaleRun(
        notes.map((n) => n.note.midi),
        { matcher, a4: settings.a4 },
        audio.now(),
      )
      runtime.set({ kind: 'wait', follower, clock: new WaitClock(audio.now(), beat) })
      return
    }
    const judge = new TabJudge(
      notes.map((n) => ({
        midi: n.note.midi,
        startMs: n.startBeat * beat,
        durationMs: n.beats * beat,
      })),
      { toleranceCents: settings.toleranceCents, a4: settings.a4 },
    )
    runtime.set({ kind: 'tempo', judge, anchor: new BeatAnchor(beat) })
    if (!metronome.running) metronome.toggle()
  }
  const finish = (phase: View['phase']) => {
    runtime.set(null)
    if (metronome.running) metronome.toggle()
    setView((v) => ({ ...v, phase }))
  }

  const onHeard: HeardListener = (freq, timeMs) => {
    const rt = runtime.get()
    if (!rt) return
    if (rt.kind === 'wait') {
      const state = rt.follower.push(freq, timeMs)
      if (!state.completed) return
      const i = state.completed.index
      rt.clock.release(timeMs, laneBeat(i))
      const result: JudgedNote = { index: i, hit: true, offsetMs: 0, points: 0 }
      scoring.record({ correct: true, points: 0 })
      setView((v) => ({
        ...v,
        index: i + 1,
        results: v.results.map((r, k) => (k === i ? result : r)),
      }))
      if (state.done) finish('done')
      return
    }
    if (metronome.lastBeatMs !== null) rt.anchor.sync(metronome.lastBeatMs)
    const origin = rt.anchor.originMs
    if (origin === null) return
    const judged = rt.judge.push(freq, timeMs - (origin + countIn * beat))
    if (judged.length === 0) return
    for (const j of judged) scoring.record({ correct: j.hit, points: j.points })
    setView((v) => ({
      ...v,
      index: rt.judge.current,
      results: v.results.map((r, k) => judged.find((j) => j.index === k) ?? r),
    }))
    if (rt.judge.done) finish('done')
  }
  useEffect(() => audio.listen(onHeard))

  // The lane scrolls through a ref on animation frames: no re-render per frame.
  useAnimationFrame(() => {
    const rt = runtime.get()
    let position = 0
    if (rt?.kind === 'wait') {
      const i = rt.follower.state.index
      position = rt.clock.position(
        audio.now(),
        i < notes.length ? laneBeat(i) : countIn + timeline.totalBeats,
      )
    } else if (rt?.kind === 'tempo' && rt.anchor.originMs !== null) {
      position = (audio.now() - rt.anchor.originMs) / beat
    }
    if (track.current) {
      track.current.style.transform = `translateX(${PLAYHEAD_PX - position * PX_PER_BEAT}px)`
    }
  })

  const current = view.phase === 'running' ? notes[view.index] : undefined
  const highlights = new Map<string, Highlight>()
  if (audio.detectedMidi !== null) {
    for (const n of findNotes(harp, audio.detectedMidi)) highlights.set(noteId(n), 'detected')
  }
  if (current) highlights.set(noteId(current.note), 'target')

  const slotState = (i: number): NoteSlot['state'] => {
    const r = view.results[i]
    if (r) return r.hit ? 'done' : 'wrong'
    return i === view.index && view.phase === 'running' ? 'current' : 'todo'
  }
  const first = Math.max(0, Math.min(view.index - 1, notes.length - WINDOW))
  const slots: NoteSlot[] = Array.from({ length: WINDOW }, (_, k) => {
    const i = first + k
    return i < notes.length
      ? { label: <TabText tab={notes[i].tab} />, state: slotState(i) }
      : { label: '', state: 'todo' }
  })
  const hits = view.results.filter((r) => r?.hit).length
  const lastPoints = mode === 'scored' ? view.results[view.index - 1]?.points : undefined

  return (
    <>
      {audio.error && <MicErrorNotice kind={audio.error} />}
      <ScorePanel scoring={scoring} />
      <Stage
        controls={
          <>
            {/* The primary action always comes first. */}
            {isFinished(scoring.session) && <PlayAgain onClick={start} />}
            {view.phase !== 'running' &&
              !isFinished(scoring.session) &&
              !audio.error &&
              (audio.status === 'listening' ? (
                <button type="button" className={styles.primary} onClick={start}>
                  ▶ {view.phase === 'done' ? 'Again' : 'Start'}
                </button>
              ) : (
                <p className={styles.hint}>Waiting for microphone…</p>
              ))}
            {view.phase === 'running' && (
              <button type="button" onClick={() => finish('idle')}>
                ■ Stop
              </button>
            )}
          </>
        }
        headline={
          current
            ? `Next: ${current.tab} (${noteName(current.note.midi, spelling)})`
            : view.phase === 'done' &&
              mode === 'practice' &&
              `✓ Done — ${hits} of ${notes.length} notes`
        }
        result={view.phase === 'done' && mode === 'practice' ? 'ok' : undefined}
        detail={
          current && (
            <>
              Note {view.index + 1} of {notes.length}
              {wait ? ' · the tab waits for you' : ` · ${settings.bpm} BPM, one bar of count-in`}
              {lastPoints !== undefined && ` · last +${lastPoints}`}
            </>
          )
        }
      />
      <div className={laneStyles.lane} aria-hidden>
        <div className={laneStyles.playhead} style={{ left: PLAYHEAD_PX }} />
        <div
          ref={track}
          className={laneStyles.track}
          style={{ transform: `translateX(${PLAYHEAD_PX}px)` }}
        >
          <div className={laneStyles.countIn} style={{ width: countIn * PX_PER_BEAT }}>
            count-in
          </div>
          {timeline.bars.map((b, i) => (
            <div key={i} className={laneStyles.bar} style={{ left: (countIn + b) * PX_PER_BEAT }} />
          ))}
          {notes.map((n, i) => (
            <div
              key={i}
              className={laneStyles.note}
              data-color={n.note.technique}
              data-state={slotState(i)}
              style={{ left: laneBeat(i) * PX_PER_BEAT, width: n.beats * PX_PER_BEAT - 4 }}
            >
              <TabText tab={n.tab} />
            </div>
          ))}
        </div>
      </div>
      <NoteSlots label="Next notes" slots={slots} />
      <HarmonicaDiagram
        harp={harp}
        spelling={spelling}
        labelMode={settings.labelMode}
        showAdvanced={settings.showAdvanced}
        highlights={highlights}
      />
    </>
  )
}
```

`src/ui/pages/tabReader/TabReaderPage.module.css`:

```css
.yourTab {
  display: grid;
  gap: 0.35rem;
  margin: 0 0 1rem;
}

.yourTab textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
}

/* A fixed-height window onto the scrolling track; the playhead never moves. */
.lane {
  position: relative;
  height: 4rem;
  margin: 0 0 1rem;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}

.playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 1;
  width: 2px;
  background: var(--target);
}

.track {
  position: absolute;
  inset: 0;
  will-change: transform;
}

.countIn {
  position: absolute;
  top: 0.4rem;
  bottom: 0.4rem;
  display: grid;
  place-items: center;
  color: var(--text-dim);
  font-size: 0.8rem;
}

.bar {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--border);
}

.note {
  --c: var(--c-blow);
  position: absolute;
  top: 0.9rem;
  height: 2.2rem;
  display: flex;
  align-items: center;
  padding: 0 0.4rem;
  overflow: hidden;
  border: 2px solid var(--c);
  border-radius: 6px;
  background: color-mix(in srgb, var(--c) 28%, var(--surface));
  font-size: 0.85rem;
}

.note[data-color='draw'] {
  --c: var(--c-draw);
}
.note[data-color='drawBend'],
.note[data-color='blowBend'] {
  --c: var(--c-bend);
}
.note[data-color='overblow'] {
  --c: var(--c-overblow);
}
.note[data-color='overdraw'] {
  --c: var(--c-overdraw);
}

.note[data-state='current'] {
  box-shadow: 0 0 0 3px var(--target);
}
.note[data-state='done'] {
  border-color: var(--ok);
}
.note[data-state='wrong'] {
  border-color: var(--bad);
  opacity: 0.7;
}
```

- [ ] **Step 6: Route and Home entry**

In `src/ui/App.tsx`, add `import { TabReaderPage } from './pages/tabReader/TabReaderPage'` and the route `'/tab-reader': TabReaderPage,` after the `'/rhythm'` route.

In `src/ui/pages/homeGroups.ts`, add to the Games `entries`, right after the quiz entry (before `rhythm`):

```ts
      {
        id: 'tab-reader',
        icon: '📜',
        title: 'Tab reader',
        text: 'Play songs from scrolling tab, or type in your own.',
      },
```

In `src/ui/pages/homeGroups.test.ts`, change the Games row to:

```ts
      [
        'games',
        'Games',
        ['echo', 'bend', 'scales', 'intervals', 'melody', 'hole-finder', 'quiz', 'tab-reader', 'rhythm'],
      ],
```

In `src/ui/App.test.tsx`, add `['#/tab-reader', 'Tab reader'],` to the `routes %s to its game` list.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/ui && npm run typecheck && npm run lint`
Expected: PASS; no type or lint errors.

- [ ] **Step 8: Try it**

Run `npm run dev` and open `#/tab-reader`. Play Mary Had a Little Lamb with "Wait for me" on: the lane stops at each note until it is played. Then turn it off and play Ode to Joy at 80 BPM: the lane scrolls smoothly after a bar of clicks.

The songs were written from the traditional tunes (decision 6). Play each one through once and correct any note that sounds wrong; `library.test.ts` checks that each bar still adds up.

- [ ] **Step 9: Commit**

```bash
git add src/ui/tab src/ui/pages/tabReader src/ui/scores/bestScores.ts src/ui/App.tsx src/ui/App.test.tsx src/ui/pages/homeGroups.ts src/ui/pages/homeGroups.test.ts
git commit -m "feat: tab reader — scrolling tab lane, song library, Your tab"
```

---

### Task 13: Timed prompts: notes and rests with their own lengths

**Files:**
- Modify: `src/audio/NoteSequencer.ts`, `src/ui/hooks/useGameAudio.ts`, `src/test/fakeGameAudio.ts`
- Test: `src/audio/NoteSequencer.test.ts` (append), `src/ui/hooks/useGameAudio.test.tsx` (append)

**Interfaces:**
- Consumes: `NotePlayer.play(midi, { durationMs })`
- Produces:
  - `interface TimedPrompt { midi: number | null; ms: number }`, `LEGATO = 0.9` (audio/NoteSequencer.ts)
  - `NoteSequencer.playTimed(notes: readonly TimedPrompt[]): Promise<boolean>`: true when it played through, false if cancelled or superseded
  - `GameAudio.playTimed(notes: readonly TimedPrompt[]): Promise<boolean>`
  - fake: `fakeAudio.timed: TimedPrompt[][]` (whole timed prompts), and `fakeAudio.played` also gets each timed prompt's pitches

Spec §11: "the site plays the lick at the chosen BPM (synth, durations respected)".
- Each note sounds for 90 % of its slot and the rest is silence, so repeated notes stay distinct (decision 1). A rest just waits.
- It shares the sequencer's generation counter with `play`, so a new prompt or `cancel()` abandons it.
- It plays through the same `NotePlayer`, so the §6.6 feedback gate in `useGameAudio` covers timed prompts with no extra code.

- [ ] **Step 1: Write the failing tests**

Append to `src/audio/NoteSequencer.test.ts`, inside `describe('NoteSequencer', …)`:

```ts
  it('plays timed notes and rests with their own lengths', async () => {
    const { player, played } = fakePlayer()
    const waits: number[] = []
    const seq = new NoteSequencer(player, (ms) => {
      waits.push(ms)
      return instant()
    })
    await expect(
      seq.playTimed([
        { midi: 67, ms: 500 },
        { midi: null, ms: 250 },
        { midi: 70, ms: 1000 },
      ]),
    ).resolves.toBe(true)
    expect(played).toEqual([
      { midi: 67, durationMs: 450 },
      { midi: 70, durationMs: 900 },
    ])
    expect(waits).toEqual([50, 250, 100])
  })

  it('abandons a timed prompt when cancelled or superseded', async () => {
    const { player, played } = fakePlayer()
    const seq = new NoteSequencer(player, instant)
    const first = seq.playTimed([
      { midi: 60, ms: 100 },
      { midi: 62, ms: 100 },
    ])
    const second = seq.play([70])
    await expect(first).resolves.toBe(false)
    await expect(second).resolves.toBe(true)
    expect(played.map((p) => p.midi)).toEqual([60, 70])
  })
```

Append to `src/ui/hooks/useGameAudio.test.tsx`, inside `describe('useGameAudio', …)`:

```tsx
  it('plays timed prompts through the same player, so the feedback gate covers them', async () => {
    const { result } = renderHook(() => useGameAudio(true), { wrapper })
    await act(async () => {
      await result.current.playTimed([{ midi: 67, ms: 10 }])
    })
    expect(player.play).toHaveBeenCalledWith(67, { durationMs: 9 })
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/audio/NoteSequencer.test.ts src/ui/hooks/useGameAudio.test.tsx`
Expected: FAIL: `seq.playTimed is not a function` and `result.current.playTimed is not a function`.

- [ ] **Step 3: Add `playTimed` to the sequencer**

In `src/audio/NoteSequencer.ts`, add after the `NotePlayer` import:

```ts
/** One step of a timed prompt: a note, or a rest when `midi` is null. `ms` is its full length. */
export interface TimedPrompt {
  midi: number | null
  ms: number
}

/** Share of a timed note that sounds; the rest is silence, so repeated notes are heard apart. */
export const LEGATO = 0.9
```

and add this method to the class, right before `cancel`:

```ts
  /** Plays notes and rests with their own lengths (a lick at tempo). Resolves like play(). */
  playTimed = async (notes: readonly TimedPrompt[]): Promise<boolean> => {
    const generation = ++this.generation
    for (const n of notes) {
      if (n.midi === null) {
        await this.wait(n.ms)
      } else {
        const soundMs = n.ms * LEGATO
        await this.player.play(n.midi, { durationMs: soundMs })
        if (generation !== this.generation) return false
        await this.wait(n.ms - soundMs)
      }
      if (generation !== this.generation) return false
    }
    return true
  }
```

- [ ] **Step 4: Expose it from `useGameAudio`**

In `src/ui/hooks/useGameAudio.ts`:
- change the sequencer import to `import { NoteSequencer, type TimedPrompt } from '../../audio/NoteSequencer'`;
- add to `interface GameAudio`, after `playSequence`:

  ```ts
  /** Plays notes and rests with their own lengths; resolves false if cancelled or superseded. */
  playTimed: (notes: readonly TimedPrompt[]) => Promise<boolean>
  ```

- add `playTimed: sequencer.playTimed,` after `playSequence: sequencer.play,` in the returned object.

- [ ] **Step 5: Teach the test fake**

In `src/test/fakeGameAudio.ts`:
- add `import type { TimedPrompt } from '../audio/NoteSequencer'`;
- in the doc comment, change "Tests read `fakeAudio.played` and drive …" to "Tests read `fakeAudio.played` (the pitches of every prompt, timed or not; `timed` keeps the timed prompts whole) and drive …";
- add `timed: [] as TimedPrompt[][],` after `played` in `fakeAudio`, and `this.timed = []` after `this.played = []` in `reset()`;
- replace the `playSequence` constant with:

```ts
const prompt = (midis: readonly number[]) => {
  fakeAudio.played.push([...midis])
  if (!fakeAudio.deferPlayback) return Promise.resolve(true)
  abandonPending()
  return new Promise<boolean>((resolve) => fakeAudio.pending.push(resolve))
}
const playSequence = (midis: readonly number[]) => prompt(midis)
const playTimed = (notes: readonly TimedPrompt[]) => {
  fakeAudio.timed.push([...notes])
  return prompt(notes.flatMap((n) => (n.midi === null ? [] : [n.midi])))
}
```

- add `playTimed,` after `playSequence,` in the object `useGameAudio` returns.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/audio src/ui && npm run typecheck && npm run lint`
Expected: PASS, including every existing game test; no type or lint errors.

- [ ] **Step 7: Commit**

```bash
git add src/audio/NoteSequencer.ts src/audio/NoteSequencer.test.ts src/ui/hooks/useGameAudio.ts src/ui/hooks/useGameAudio.test.tsx src/test/fakeGameAudio.ts
git commit -m "feat(audio): timed prompts with per-note lengths and rests"
```

---

### Task 14: Lick trainer

**Files:**
- Create: `src/core/tab/lickTrainer.ts`, `src/ui/pages/licks/LickTrainerPage.tsx`
- Modify: `src/ui/scores/bestScores.ts` (`GameId`), `src/ui/App.tsx` (route), `src/ui/pages/homeGroups.ts` (Games entry)
- Test: `src/core/tab/lickTrainer.test.ts`, `src/ui/pages/licks/LickTrainerPage.test.tsx`, `src/ui/pages/homeGroups.test.ts` (update), `src/ui/App.test.tsx` (append)

**Interfaces:**
- Consumes:
  - `parseTab`, `tabTimeline`, `beatMs`, `TabItem`, `TimedNote` (Task 3)
  - `LICKS`, `LICK_STYLES`, `Lick`, `LickStyle` (Task 4)
  - `NoteSlots`, `TabLine` (Task 2)
  - `GameAudio.playTimed`, `fakeAudio.timed` (Task 13)
  - `MelodyRound`, `melodyPoints`, `MELODY_NOTE_LIMIT_MS` (games/melodyEcho.ts); `pickOne`, `Rng`, `scriptedRng`
  - `useHarp`, `tuningPart`, `usePracticeTimer` (Plan 3)
- Produces:
  - `lickNotes(lick, harp): TimedNote[] | null`, `playableLicks(licks, harp): Lick[]`, `pickLick(licks, rng, previousId: string | null): Lick`, `promptNotes(items, bpm): { midi: number | null; ms: number }[]`
  - `LickTrainerPage()` (route `/licks`, practice-timer id `licks`); `LickGame({ rng?: Rng })`
  - `GameId` gains `'licks'`

Spec §11.
- **Hearing the lick.** The site plays it at the shared BPM with `playTimed`, durations and rests included. Then the player echoes it: `MelodyRound` with the melody hold judges pitch order and catches stray held notes. Rhythm isn't scored.
- **Practice.**
  - Pick a style and a lick (or Random).
  - Hear again; Show tab, which reveals the tab line under the slots and rings the notes on the chart.
  - Try again; Next lick.
  - A lick that the tuning can't play is listed as disabled "(not on this harp)".
- **Scored** is 10 random licks of the style with no immediate repeat, melody points, and the best score keyed by style, key, BPM, matcher thresholds and tuning (decision 7).
- **Stable layout.** The slot row ("Lick notes") and the tab line are always rendered.

- [ ] **Step 1: Write the failing tests**

`src/core/tab/lickTrainer.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildHarp } from '../harmonica/harp'
import { scriptedRng } from '../games/random'
import { LICKS } from './licks'
import { lickNotes, pickLick, playableLicks, promptNotes } from './lickTrainer'
import { parseTab } from './parseTab'

const c = buildHarp('C')
const blues = LICKS.filter((l) => l.style === 'blues2')

describe('lickNotes', () => {
  it('gives the lick’s pitches and beats on this harp', () => {
    const notes = lickNotes(
      LICKS.find((l) => l.id === 'root-fifth')!,
      c,
    )!
    expect(notes.map((n) => [n.tab, n.note.midi, n.beats])).toEqual([
      ['-2', 67, 1],
      ['-3', 71, 1],
      ['4', 72, 1],
      ['-4', 74, 3],
    ])
  })
})

describe('playableLicks', () => {
  it('drops licks that need a note the harp lacks', () => {
    expect(playableLicks(blues, c)).toHaveLength(10)
    const noBends = c.filter((n) => n.technique !== 'drawBend')
    expect(playableLicks(blues, noBends).map((l) => l.id)).toEqual([
      'root-fifth',
      'call',
      'shuffle-riff',
      'turnaround-down',
    ])
  })
})

describe('pickLick', () => {
  it('picks at random without repeating the previous lick', () => {
    expect(pickLick(blues, scriptedRng([0.25]), null).id).toBe('root-fifth')
    // without 'root-fifth' the list is 9 long: 0.25 × 9 = 2.25 → index 2 = 'bend-release'
    expect(pickLick(blues, scriptedRng([0.25]), 'root-fifth').id).toBe('bend-release')
    expect(pickLick(blues.slice(0, 1), scriptedRng([0.9]), 'blues-up').id).toBe('blues-up')
  })
})

describe('promptNotes', () => {
  it('times notes and rests at the tempo and skips bar lines', () => {
    const { items } = parseTab('-2:0.5 _ | 4:2', c)
    expect(promptNotes(items, 120)).toEqual([
      { midi: 67, ms: 250 },
      { midi: null, ms: 500 },
      { midi: 72, ms: 1000 },
    ])
  })
})
```

`src/ui/pages/licks/LickTrainerPage.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { scriptedRng } from '../../../core/games/random'
import { fakeAudio, finishPlayback, hold } from '../../../test/fakeGameAudio'
import { layoutShape } from '../../../test/layout'
import { SettingsProvider } from '../../settings/SettingsContext'
import { LickGame } from './LickTrainerPage'

vi.mock('../../hooks/useGameAudio', () => import('../../../test/fakeGameAudio'))

// rng 0.25 picks index 2 of the ten blues licks: "Root to fifth", -2 -3 4 -4:3 = G4 B4 C5 D5.
const renderGame = () =>
  render(
    <SettingsProvider storage={null}>
      <LickGame rng={scriptedRng([0.25])} />
    </SettingsProvider>,
  )
const start = async () => {
  fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
  expect(await screen.findByText('Your turn — play it back')).toBeInTheDocument()
}
const slots = () =>
  within(screen.getByRole('list', { name: 'Lick notes' }))
    .getAllByRole('listitem')
    .map((li) => li.dataset.state)
const playLick = () => {
  hold(67, 0, 250)
  hold(71, 300, 550)
  hold(72, 600, 850)
  hold(74, 900, 1150)
}

describe('LickGame', () => {
  beforeEach(() => {
    fakeAudio.reset()
    localStorage.clear()
  })

  it('plays the lick at the tempo, then accepts it played back', async () => {
    renderGame()
    await start()
    expect(fakeAudio.played).toEqual([[67, 71, 72, 74]])
    // 90 BPM: 666.7 ms a beat; the last note is 3 beats
    expect(fakeAudio.timed[0].map((n) => Math.round(n.ms))).toEqual([667, 667, 667, 2000])
    expect(screen.getByText('Root to fifth · 4 notes')).toBeInTheDocument()
    hold(67, 0, 250)
    expect(slots()).toEqual(['done', 'current', 'todo', 'todo'])
    hold(71, 300, 550)
    hold(72, 600, 850)
    hold(74, 900, 1150)
    expect(screen.getByText('✓ Well done!')).toBeInTheDocument()
    expect(screen.getByLabelText('Lick tab')).toHaveTextContent('-2-34-4')
  })

  it('reveals the tab under the slots on request in practice', async () => {
    renderGame()
    await start()
    expect(screen.getByLabelText('Lick tab')).toHaveTextContent('')
    fireEvent.click(screen.getByRole('button', { name: /Show tab/ }))
    expect(screen.getByLabelText('Lick tab')).toHaveTextContent('-2-34-4')
    expect(screen.getByRole('button', { name: '-2 G4' })).toHaveAttribute(
      'data-highlight',
      'target',
    )
  })

  it('names a wrong note and replays the same lick on Try again', async () => {
    renderGame()
    await start()
    hold(67, 0, 250)
    hold(69, 300, 550)
    expect(screen.getByText('✗ Note 2: you played A4, it was B4')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }))
    expect(await screen.findByText('Your turn — play it back')).toBeInTheDocument()
    expect(fakeAudio.played).toEqual([
      [67, 71, 72, 74],
      [67, 71, 72, 74],
    ])
  })

  it('practises the lick chosen in the toolbar', async () => {
    renderGame()
    fireEvent.change(screen.getByRole('combobox', { name: 'Lick' }), { target: { value: 'call' } })
    await start()
    expect(fakeAudio.played).toEqual([[74, 77, 79, 77, 74]])
  })

  it('scores ten random licks with the melody points, and hides the tab', async () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    await start()
    expect(screen.queryByRole('button', { name: /Show tab/ })).toBeNull()
    playLick()
    // 1 + (1 − 1150 / 12000) = 1.904 → 190
    expect(screen.getByRole('status')).toHaveTextContent('Round 2 of 10 · Score 190')
  })

  it.each(['Practice', 'Scored'])(
    'keeps the same stage rows, slot row and tab line in every phase (%s)',
    async (mode) => {
      fakeAudio.deferPlayback = true
      const { container } = renderGame()
      fireEvent.click(screen.getByRole('button', { name: mode }))
      const shape = () =>
        layoutShape(container, ['[aria-label="Lick notes"]', '[aria-label="Lick tab"]'])
      const idle = shape()
      expect(idle.stageRows).toHaveLength(3)
      fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
      expect(screen.getByText('Listen…')).toBeInTheDocument()
      expect(shape()).toEqual(idle)
      await finishPlayback()
      expect(shape()).toEqual(idle)
      hold(67, 0, 250)
      hold(69, 300, 550)
      expect(screen.getByText(/✗ Note 2/)).toBeInTheDocument()
      expect(shape()).toEqual(idle)
    },
  )
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/tab/lickTrainer.test.ts src/ui/pages/licks`
Expected: FAIL, because `./lickTrainer` and `./LickTrainerPage` can't be resolved.

- [ ] **Step 3: Write the lick helpers**

`src/core/tab/lickTrainer.ts`:

```ts
import type { HarpNote } from '../harmonica/harp'
import { pickOne, type Rng } from '../games/random'
import type { Lick } from './licks'
import { beatMs, parseTab, tabTimeline, type TabItem, type TimedNote } from './parseTab'

/** A lick's notes on this harp, or null when its tab doesn't fit the harp's tuning. */
export function lickNotes(lick: Lick, harp: readonly HarpNote[]): TimedNote[] | null {
  const { items, errors } = parseTab(lick.tab, harp)
  return errors.length > 0 ? null : tabTimeline(items).notes
}

/** The licks whose tab fits this harp (a missing bend makes a lick unplayable). */
export function playableLicks(licks: readonly Lick[], harp: readonly HarpNote[]): Lick[] {
  return licks.filter((l) => lickNotes(l, harp) !== null)
}

/** A random lick, not the previous one when there is a choice. */
export function pickLick(licks: readonly Lick[], rng: Rng, previousId: string | null): Lick {
  const choices = licks.length > 1 ? licks.filter((l) => l.id !== previousId) : licks
  return pickOne(choices, rng)
}

/** The notes and rests to play at `bpm`, each with its length in ms (bar lines skipped). */
export function promptNotes(
  items: readonly TabItem[],
  bpm: number,
): { midi: number | null; ms: number }[] {
  const beat = beatMs(bpm)
  return items.flatMap((i) =>
    i.kind === 'bar' ? [] : [{ midi: i.kind === 'note' ? i.note.midi : null, ms: i.beats * beat }],
  )
}
```

- [ ] **Step 4: Add the game id**

In `src/ui/scores/bestScores.ts`, add `| 'licks'` as a new last line of the `GameId` union (after `| 'tab-reader'`).

- [ ] **Step 5: Write the page**

`src/ui/pages/licks/LickTrainerPage.tsx`:

```tsx
import { useEffect, useState } from 'react'
import {
  MELODY_NOTE_LIMIT_MS,
  MelodyRound,
  melodyPoints,
  type MelodyState,
} from '../../../core/games/melodyEcho'
import type { Rng } from '../../../core/games/random'
import { isFinished, type GameMode } from '../../../core/games/session'
import { findNotes, noteId } from '../../../core/harmonica/harp'
import { keySpelling } from '../../../core/harmonica/keys'
import { noteName } from '../../../core/music/noteNames'
import { LICKS, LICK_STYLES, type Lick, type LickStyle } from '../../../core/tab/licks'
import { lickNotes, pickLick, playableLicks, promptNotes } from '../../../core/tab/lickTrainer'
import { parseTab, type TimedNote } from '../../../core/tab/parseTab'
import { HarmonicaDiagram, type Highlight } from '../../components/HarmonicaDiagram'
import { MicErrorNotice } from '../../components/MicErrorNotice'
import { TabLine } from '../../components/TabText'
import { GameLayout } from '../../components/game/GameLayout'
import { ModeToggle } from '../../components/game/ModeToggle'
import { NoteSlots, type SlotState } from '../../components/game/NoteSlots'
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
const RANDOM = 'random'

export function LickTrainerPage() {
  usePracticeTimer('licks')
  return (
    <GameLayout
      title="Lick trainer"
      intro="Hear a short lick at your tempo, then play it back note by note."
      melodyHold
    >
      <LickGame />
    </GameLayout>
  )
}

export function LickGame({ rng = Math.random }: { rng?: Rng }) {
  const { settings } = useSettings()
  const harp = useHarp()
  // Owned here, not by the keyed run, so a settings change doesn't restart the mic.
  const audio = useGameAudio(true)
  const [mode, setMode] = useState<GameMode>('practice')
  const [style, setStyle] = useState<LickStyle>('blues2')
  const [choice, setChoice] = useState(RANDOM)
  const inStyle = LICKS.filter((l) => l.style === style)
  const playable = playableLicks(inStyle, harp)
  const runKey = [
    mode,
    style,
    mode === 'practice' ? choice : RANDOM,
    settings.key,
    settings.tuning,
    settings.a4,
    settings.bpm,
    settings.toleranceCents,
    settings.melodyHoldMs,
  ].join('|')

  return (
    <>
      <div className={styles.toolbar}>
        <ModeToggle mode={mode} onChange={setMode} />
        <label className={styles.field}>
          Style
          <select
            aria-label="Style"
            value={style}
            onChange={(e) => {
              setStyle(e.target.value as LickStyle)
              setChoice(RANDOM)
            }}
          >
            {LICK_STYLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {mode === 'practice' && (
          <label className={styles.field}>
            Lick
            <select aria-label="Lick" value={choice} onChange={(e) => setChoice(e.target.value)}>
              <option value={RANDOM}>Random</option>
              {inStyle.map((l) => (
                <option key={l.id} value={l.id} disabled={!playable.includes(l)}>
                  {l.name}
                  {!playable.includes(l) && ' (not on this harp)'}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className={styles.hint}>{settings.bpm} BPM</span>
      </div>
      {playable.length === 0 ? (
        <p role="alert" className="notice">
          None of these licks can be played in this tuning. Choose another style or tuning.
        </p>
      ) : (
        <LickRun
          key={runKey}
          audio={audio}
          mode={mode}
          style={style}
          licks={playable}
          chosen={mode === 'practice' ? (playable.find((l) => l.id === choice) ?? null) : null}
          rng={rng}
        />
      )}
    </>
  )
}

interface View {
  phase: 'idle' | 'prompt' | 'listening' | 'result'
  lick: Lick | null
  notes: TimedNote[]
  state: MelodyState | null
  points: number
  showTab: boolean
}

const IDLE: View = {
  phase: 'idle',
  lick: null,
  notes: [],
  state: null,
  points: 0,
  showTab: false,
}

interface RunProps {
  audio: GameAudio
  mode: GameMode
  style: LickStyle
  licks: Lick[]
  /** Practice: the lick picked in the toolbar; null = random. */
  chosen: Lick | null
  rng: Rng
}

function LickRun({ audio, mode, style, licks, chosen, rng }: RunProps) {
  const { settings } = useSettings()
  const harp = useHarp()
  const spelling = keySpelling(settings.key)
  const scoring = useScoring(
    mode,
    bestScoreKey('licks', {
      style,
      key: settings.key,
      bpm: settings.bpm,
      tol: settings.toleranceCents,
      hold: settings.melodyHoldMs,
      ...tuningPart(settings.tuning),
    }),
  )
  const slot = useSlot<MelodyRound>()
  const timeouts = useTimeouts()
  const [view, setView] = useState<View>(IDLE)

  const playLick = async (lick: Lick, showTab = false) => {
    timeouts.clear()
    slot.set(null)
    const notes = lickNotes(lick, harp) ?? []
    setView({ ...IDLE, phase: 'prompt', lick, notes, showTab })
    const { items } = parseTab(lick.tab, harp)
    if (!(await audio.playTimed(promptNotes(items, settings.bpm)))) return
    const matcher = { toleranceCents: settings.toleranceCents, holdMs: settings.melodyHoldMs }
    const midis = notes.map((n) => n.note.midi)
    const limitMs = mode === 'scored' ? MELODY_NOTE_LIMIT_MS * midis.length : null
    slot.set(new MelodyRound(midis, { matcher, a4: settings.a4 }, audio.now(), limitMs))
    setView((v) => ({ ...v, phase: 'listening' }))
  }
  const nextLick = (previous: Lick | null) =>
    void playLick(chosen ?? pickLick(licks, rng, previous?.id ?? null))

  const onHeard: HeardListener = (freq, timeMs) => {
    const round = slot.get()
    if (!round) return
    const state = round.push(freq, timeMs)
    if (state.status === 'listening') {
      setView((v) => ({ ...v, state }))
      return
    }
    slot.set(null)
    const points = melodyPoints(state, view.notes.length)
    const session = scoring.record({ correct: state.status === 'success', points })
    setView((v) => ({ ...v, phase: 'result', state, points }))
    if (mode === 'scored' && !isFinished(session)) {
      timeouts.after(ADVANCE_MS, () => nextLick(view.lick))
    }
  }
  useEffect(() => audio.listen(onHeard))
  // The prompt player outlives this run; a remount must not leave its prompt sounding.
  const { cancelPlayback } = audio
  useEffect(() => cancelPlayback, [cancelPlayback])

  const stop = () => {
    timeouts.clear()
    slot.set(null)
    audio.cancelPlayback()
    setView(IDLE)
  }
  const restart = () => {
    scoring.restart()
    nextLick(null)
  }

  const { lick, notes, state } = view
  const reveal = view.phase === 'result'
  const slotState = (i: number): SlotState => {
    if (state?.wrongIndex === i) return 'wrong'
    if (i < (state?.index ?? 0)) return 'done'
    if (view.phase === 'listening' && i === (state?.index ?? 0)) return 'current'
    return 'todo'
  }

  const highlights = new Map<string, Highlight>()
  if (audio.detectedMidi !== null) {
    for (const n of findNotes(harp, audio.detectedMidi)) highlights.set(noteId(n), 'detected')
  }
  if (view.showTab) {
    notes.slice(state?.index ?? 0).forEach((n) => highlights.set(noteId(n.note), 'target'))
  }
  notes.slice(0, state?.index ?? 0).forEach((n) => highlights.set(noteId(n.note), 'correct'))
  if (reveal && state?.wrongIndex != null) {
    highlights.set(noteId(notes[state.wrongIndex].note), 'target')
    if (state.wrongMidi !== null) {
      findNotes(harp, state.wrongMidi).forEach((n) => highlights.set(noteId(n), 'wrong'))
    }
  }

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
                <button type="button" className={styles.primary} onClick={() => nextLick(null)}>
                  ▶ Start
                </button>
              ) : (
                <p className={styles.hint}>Waiting for microphone…</p>
              ))}
            {view.phase === 'listening' && lick && (
              <button
                type="button"
                onClick={() => {
                  const { items } = parseTab(lick.tab, harp)
                  void audio.playTimed(promptNotes(items, settings.bpm))
                }}
              >
                🔊 Hear again
              </button>
            )}
            {/* The tab would give the answer away in scored mode. */}
            {view.phase === 'listening' && mode === 'practice' && !view.showTab && (
              <button type="button" onClick={() => setView((v) => ({ ...v, showTab: true }))}>
                👀 Show tab
              </button>
            )}
            {mode === 'practice' && reveal && lick && (
              <>
                <button type="button" onClick={() => void playLick(lick, view.showTab)}>
                  🔁 Try again
                </button>
                <button type="button" onClick={() => nextLick(lick)}>
                  ▶ Next lick
                </button>
              </>
            )}
            {view.phase !== 'idle' && !isFinished(scoring.session) && (
              <button type="button" onClick={stop}>
                ■ Stop
              </button>
            )}
          </>
        }
        headline={
          reveal && state ? (
            <>
              {state.status === 'success' && '✓ Well done!'}
              {state.status === 'wrong' &&
                state.wrongIndex !== null &&
                state.wrongMidi !== null &&
                `✗ Note ${state.wrongIndex + 1}: you played ${noteName(state.wrongMidi, spelling)}, it was ${noteName(notes[state.wrongIndex].note.midi, spelling)}`}
              {state.status === 'timeout' && "✗ Time's up"}
              {mode === 'scored' && ` · +${view.points}`}
            </>
          ) : view.phase === 'prompt' ? (
            'Listen…'
          ) : (
            view.phase === 'listening' && 'Your turn — play it back'
          )
        }
        result={reveal && state ? (state.status === 'success' ? 'ok' : 'bad') : undefined}
        progress={view.phase === 'listening' ? (state?.progress ?? 0) : undefined}
        detail={lick && `${lick.name} · ${notes.length} notes`}
      />
      {/* Always rendered; numbered slots until notes are played. */}
      <NoteSlots
        label="Lick notes"
        slots={notes.map((n, i) => ({
          label: reveal || slotState(i) === 'done' ? noteName(n.note.midi, spelling) : i + 1,
          state: slotState(i),
        }))}
      />
      <p className={styles.tabLine} aria-label="Lick tab">
        {(view.showTab || reveal) && <TabLine tabs={notes.map((n) => n.tab)} />}
      </p>
      <HarmonicaDiagram
        harp={harp}
        spelling={spelling}
        labelMode={settings.labelMode}
        showAdvanced={settings.showAdvanced}
        highlights={highlights}
      />
    </>
  )
}
```

- [ ] **Step 6: Route and Home entry**

In `src/ui/App.tsx`, add `import { LickTrainerPage } from './pages/licks/LickTrainerPage'` and the route `'/licks': LickTrainerPage,` after the `'/tab-reader'` route.

In `src/ui/pages/homeGroups.ts`, add to the Games `entries`, right after the tab-reader entry (before `rhythm`):

```ts
      {
        id: 'licks',
        icon: '🎸',
        title: 'Lick trainer',
        text: 'Hear a blues, folk or minor lick at your tempo, then play it back.',
      },
```

In `src/ui/pages/homeGroups.test.ts`, change the Games row to:

```ts
      [
        'games',
        'Games',
        [
          'echo',
          'bend',
          'scales',
          'intervals',
          'melody',
          'hole-finder',
          'quiz',
          'tab-reader',
          'licks',
          'rhythm',
        ],
      ],
```

In `src/ui/App.test.tsx`, add `['#/licks', 'Lick trainer'],` to the `routes %s to its game` list.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/core src/ui && npm run typecheck && npm run lint`
Expected: PASS; no type or lint errors.

- [ ] **Step 8: Commit**

```bash
git add src/core/tab/lickTrainer.ts src/core/tab/lickTrainer.test.ts src/ui/pages/licks src/ui/scores/bestScores.ts src/ui/App.tsx src/ui/App.test.tsx src/ui/pages/homeGroups.ts src/ui/pages/homeGroups.test.ts
git commit -m "feat: lick trainer — hear a lick at tempo, echo it back"
```

---

### Task 15: Blues logic: the 12-bar form, chord tones, the pure backing scheduler

**Files:**
- Create: `src/core/jam/blues.ts`, `src/core/jam/backingSchedule.ts`
- Test: `src/core/jam/blues.test.ts`, `src/core/jam/backingSchedule.test.ts`

**Interfaces:**
- Consumes: `noteId`, `tabLabel`, `HarpNote` (harmonica/harp.ts); `scaleById('blues')` (music/scales.ts); `pitchClassName`, `positionTonicPc` (Plan 3); `Spelling`
- Produces:
  - `type Degree = 'I' | 'IV' | 'V'`, `bluesForm(quickChange: boolean): Degree[]` (12 entries)
  - `chordRootPc(tonicPc, degree): number`, `DOMINANT_7TH = [0, 4, 7, 10]`, `chordPcs(rootPc): number[]`, `chordName(rootPc, spelling): string` (`'G7'`)
  - `type JamMark = 'chord' | 'scale'`, `jamMarks(harp, tonicPc, rootPc): Map<string, JamMark>` (keyed by `noteId`)
  - `type Feel = 'shuffle' | 'straight'`, `type Instrument = 'kick' | 'snare' | 'hat' | 'bass' | 'chords'`, `INSTRUMENTS`
  - `interface BackingConfig { bpm; feel; form: readonly Degree[]; tonicPc }`, `interface BackingState { nextBeatTime; bar; beat }`
  - `type BackingEvent`: `{ kind: 'kick' | 'snare' | 'hat'; time }` | `{ kind: 'bass'; time; midi; duration }` | `{ kind: 'chords'; time; midis; duration }` | `{ kind: 'bar'; time; bar }`
  - `offbeatFraction(feel)`, `SHUFFLE_BASS`, `STRAIGHT_BASS`, `STAB_S = 0.12`, `bassMidi(rootPc, semitones)`, `chordMidis(rootPc)`
  - `scheduleBacking(state, config, now, lookahead): { events: BackingEvent[]; state: BackingState }`

Spec §12.
- **The form** is I I I I | IV IV I I | V IV I V, with the turnaround I–V in bars 11–12; the quick change puts IV in bar 2.
- **The tonic** is `positionTonicPc(harpKey, position)`, so a C harp in 2nd position plays G7, C7 and D7.
- **The chart marks.** Chord tones are the dominant-7th pitch classes. The rest of the tonic's blues scale (0 3 5 6 7 10) is the `'scale'` mark.
- **The scheduler** is `scheduleAhead`'s pattern, one beat at a time:
  - kick on beats 1 and 3, snare on 2 and 4;
  - a hat on the beat and on the (swung) offbeat, at 2/3 of the beat on the shuffle and halfway when straight;
  - the walking bass: root–3rd–5th–6th–♭7th–6th–5th–3rd in eighths on the shuffle, root–3rd–5th–6th in quarters when straight (decision 8);
  - a dominant-7th stab on every offbeat;
  - a `'bar'` event on each downbeat.

  A timer that fell behind (a background tab) skips the missed beats instead of playing them all at once (Review Focus 4).

- [ ] **Step 1: Write the failing tests**

`src/core/jam/blues.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildHarp, noteId, tabLabel } from '../harmonica/harp'
import { positionTonicPc } from '../harmonica/positions'
import { bluesForm, chordName, chordPcs, chordRootPc, jamMarks } from './blues'

describe('bluesForm', () => {
  it('is a 12-bar I–IV–V with the I–V turnaround', () => {
    expect(bluesForm(false).join(' ')).toBe('I I I I IV IV I I V IV I V')
  })

  it('moves to IV in bar 2 with the quick change', () => {
    expect(bluesForm(true).join(' ')).toBe('I IV I I IV IV I I V IV I V')
  })
})

describe('chords', () => {
  const g = positionTonicPc('C', 2)

  it('plays G blues on a C harp in 2nd position: G7, C7, D7', () => {
    expect(g).toBe(7)
    expect((['I', 'IV', 'V'] as const).map((d) => chordName(chordRootPc(g, d), 'sharp'))).toEqual([
      'G7',
      'C7',
      'D7',
    ])
  })

  it('spells chords in the harp key’s spelling', () => {
    const f = positionTonicPc('Bb', 2) // F blues on a Bb harp
    expect((['I', 'IV', 'V'] as const).map((d) => chordName(chordRootPc(f, d), 'flat'))).toEqual([
      'F7',
      'Bb7',
      'C7',
    ])
  })

  it('builds dominant 7ths', () => {
    expect(chordPcs(7)).toEqual([7, 11, 2, 5]) // G B D F
  })

  it('follows the position: 1st and 3rd on a C harp are C and D', () => {
    expect(chordName(chordRootPc(positionTonicPc('C', 1), 'I'), 'sharp')).toBe('C7')
    expect(chordName(chordRootPc(positionTonicPc('C', 3), 'V'), 'sharp')).toBe('A7')
  })
})

describe('jamMarks', () => {
  const harp = buildHarp('C')
  const markOf = (marks: Map<string, string>) => (tab: string) =>
    marks.get(noteId(harp.find((n) => tabLabel(n) === tab)!)) ?? null

  it('marks the chord tones and the rest of the blues scale', () => {
    const of = markOf(jamMarks(harp, 7, 7)) // G blues, a G7 bar
    expect(['-2', '-3', '-4', '-5', '6'].map(of)).toEqual([
      'chord',
      'chord',
      'chord',
      'chord',
      'chord',
    ])
    expect(["-3'", '4', "-4'", '1'].map(of)).toEqual(['scale', 'scale', 'scale', 'scale'])
    expect(['5', '-6', '2'].map(of)).toEqual([null, null, null])
  })

  it('moves the chord tones with the bar', () => {
    const of = markOf(jamMarks(harp, 7, 0)) // a C7 bar: C E G Bb
    expect(['4', '5', '6', "-3'"].map(of)).toEqual(['chord', 'chord', 'chord', 'chord'])
    expect(['-3', '-4'].map(of)).toEqual([null, 'scale'])
  })
})
```

`src/core/jam/backingSchedule.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { bluesForm } from './blues'
import {
  bassMidi,
  chordMidis,
  offbeatFraction,
  scheduleBacking,
  type BackingConfig,
  type BackingEvent,
} from './backingSchedule'

// 120 BPM: a beat every 0.5 s; the shuffle offbeat 1/3 s after it.
const G_SHUFFLE: BackingConfig = { bpm: 120, feel: 'shuffle', form: bluesForm(false), tonicPc: 7 }
const start = { nextBeatTime: 1, bar: 0, beat: 0 }
const ms = (s: number) => Math.round(s * 1000) / 1000
/** Times and durations to the millisecond, for readable expectations. */
const round = (events: BackingEvent[]) =>
  events.map((e) =>
    'duration' in e
      ? { ...e, time: ms(e.time), duration: ms(e.duration) }
      : { ...e, time: ms(e.time) },
  )

describe('swing', () => {
  it('puts the offbeat 2/3 through the beat on the shuffle, halfway when straight', () => {
    expect(offbeatFraction('shuffle')).toBeCloseTo(0.667, 3)
    expect(offbeatFraction('straight')).toBe(0.5)
  })
})

describe('voicing', () => {
  it('puts the bass in the second octave and the chords around middle C', () => {
    expect(bassMidi(7, 0)).toBe(43) // G2
    expect(chordMidis(7)).toEqual([55, 59, 62, 65]) // G3 B3 D4 F4
    expect(chordMidis(4)).toEqual([52, 56, 59, 62]) // E3 …
    expect(chordMidis(3)).toEqual([63, 67, 70, 73]) // Eb4 …
  })
})

describe('scheduleBacking', () => {
  it('schedules one shuffle beat: bar, kick, swung hats and bass, an offbeat stab', () => {
    const { events, state } = scheduleBacking(start, G_SHUFFLE, 1, 0.1)
    expect(round(events)).toEqual([
      { kind: 'bar', time: 1, bar: 0 },
      { kind: 'kick', time: 1 },
      { kind: 'hat', time: 1 },
      { kind: 'hat', time: 1.333 },
      { kind: 'bass', time: 1, midi: 43, duration: 0.3 },
      { kind: 'bass', time: 1.333, midi: 47, duration: 0.15 },
      { kind: 'chords', time: 1.333, midis: [55, 59, 62, 65], duration: 0.12 },
    ])
    expect(state).toEqual({ nextBeatTime: 1.5, bar: 0, beat: 1 })
  })

  it('plays the snare on beats 2 and 4 and walks the bass through the bar', () => {
    const { events } = scheduleBacking(start, G_SHUFFLE, 1, 2)
    expect(events.filter((e) => e.kind === 'snare').map((e) => e.time)).toEqual([1.5, 2.5])
    expect(events.filter((e) => e.kind === 'kick').map((e) => e.time)).toEqual([1, 2])
    expect(events.flatMap((e) => (e.kind === 'bass' ? [e.midi - 43] : []))).toEqual([
      0, 4, 7, 9, 10, 9, 7, 4,
    ])
  })

  it('plays quarters in the bass and straight eighths on the hat when straight', () => {
    const { events } = scheduleBacking(start, { ...G_SHUFFLE, feel: 'straight' }, 1, 2)
    expect(events.flatMap((e) => (e.kind === 'bass' ? [e.midi - 43] : []))).toEqual([0, 4, 7, 9])
    expect(events.filter((e) => e.kind === 'hat').map((e) => e.time)).toEqual([
      1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75,
    ])
  })

  it('follows the form: a new chord every bar, round and round', () => {
    const { events } = scheduleBacking(start, { ...G_SHUFFLE, form: bluesForm(true) }, 1, 26)
    const bars = events.filter((e) => e.kind === 'bar')
    expect(bars.map((e) => (e.kind === 'bar' ? e.bar : -1))).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0,
    ])
    // Quick change: bar 2 is on C7, so its first bass note is C2.
    const bass = events.filter((e) => e.kind === 'bass' && e.time === 3)
    expect(bass).toEqual([{ kind: 'bass', time: 3, midi: 36, duration: 0.3 }])
  })

  it('skips beats a throttled timer missed instead of playing them all at once', () => {
    const { events, state } = scheduleBacking(start, G_SHUFFLE, 10, 0.1)
    expect(events[0]).toEqual({ kind: 'bar', time: 10, bar: 0 })
    expect(state.nextBeatTime).toBe(10.5)
  })

  it('applies a new tempo from the next beat', () => {
    const first = scheduleBacking(start, G_SHUFFLE, 1, 0.1)
    const next = scheduleBacking(first.state, { ...G_SHUFFLE, bpm: 60 }, 1.45, 0.1)
    expect(next.state.nextBeatTime).toBe(2.5)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/jam`
Expected: FAIL, because `./blues` and `./backingSchedule` can't be resolved.

- [ ] **Step 3: Write the blues model**

`src/core/jam/blues.ts`:

```ts
import { noteId, type HarpNote } from '../harmonica/harp'
import { pitchClassName, type Spelling } from '../music/noteNames'
import { scaleById } from '../music/scales'

export type Degree = 'I' | 'IV' | 'V'

const DEGREE_SEMITONES: Record<Degree, number> = { I: 0, IV: 5, V: 7 }

/**
 * Spec §12: a 12-bar blues, I–IV–V, with the turnaround (I–V) in bars 11–12. The quick change
 * moves to IV in bar 2.
 */
export function bluesForm(quickChange: boolean): Degree[] {
  return ['I', quickChange ? 'IV' : 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V']
}

const pc = (n: number) => ((n % 12) + 12) % 12

export function chordRootPc(tonicPc: number, degree: Degree): number {
  return pc(tonicPc + DEGREE_SEMITONES[degree])
}

/** Root, major 3rd, 5th and minor 7th: the dominant-7th chord every blues bar uses. */
export const DOMINANT_7TH = [0, 4, 7, 10] as const

export function chordPcs(rootPc: number): number[] {
  return DOMINANT_7TH.map((i) => pc(rootPc + i))
}

/** "G7", "Bb7": the chord's name in the harp key's spelling. */
export function chordName(rootPc: number, spelling: Spelling): string {
  return `${pitchClassName(rootPc, spelling)}7`
}

export type JamMark = 'chord' | 'scale'

const BLUES = scaleById('blues').steps

/**
 * What the chart shows for the current bar (keyed by noteId): every harp note that is a tone of
 * the current chord, and the rest of the tonic's blues scale.
 */
export function jamMarks(
  harp: readonly HarpNote[],
  tonicPc: number,
  rootPc: number,
): Map<string, JamMark> {
  const chord = new Set(chordPcs(rootPc))
  const scale = new Set(BLUES.map((s) => pc(tonicPc + s)))
  const marks = new Map<string, JamMark>()
  for (const n of harp) {
    const p = pc(n.midi)
    if (chord.has(p)) marks.set(noteId(n), 'chord')
    else if (scale.has(p)) marks.set(noteId(n), 'scale')
  }
  return marks
}
```

- [ ] **Step 4: Write the scheduler**

`src/core/jam/backingSchedule.ts`:

```ts
import { chordRootPc, DOMINANT_7TH, type Degree } from './blues'

export type Feel = 'shuffle' | 'straight'
export type Instrument = 'kick' | 'snare' | 'hat' | 'bass' | 'chords'
export const INSTRUMENTS: readonly Instrument[] = ['kick', 'snare', 'hat', 'bass', 'chords']

export interface BackingConfig {
  bpm: number
  feel: Feel
  form: readonly Degree[]
  /** The tonic of the I chord. */
  tonicPc: number
}

/** Where the scheduler is: the next beat to schedule. */
export interface BackingState {
  /** AudioContext time in seconds. */
  nextBeatTime: number
  bar: number
  /** 0–3 within the bar. */
  beat: number
}

export type BackingEvent =
  | { kind: 'kick' | 'snare' | 'hat'; time: number }
  | { kind: 'bass'; time: number; midi: number; duration: number }
  | { kind: 'chords'; time: number; midis: number[]; duration: number }
  /** A new bar starts: the page shows its chord. */
  | { kind: 'bar'; time: number; bar: number }

export const BEATS_PER_BAR = 4
/** Spec §12: shuffle swings the eighths 2:1, so the offbeat falls 2/3 of the way through a beat. */
export function offbeatFraction(feel: Feel): number {
  return feel === 'shuffle' ? 2 / 3 : 1 / 2
}

/** Walking shuffle bass per chord, in eighths: root–3rd–5th–6th–♭7th–6th–5th–3rd. */
export const SHUFFLE_BASS = [0, 4, 7, 9, 10, 9, 7, 4] as const
/** On the straight feel, simplified to quarters: the pattern's climb, root–3rd–5th–6th. */
export const STRAIGHT_BASS = [0, 4, 7, 9] as const
/** How long a chord stab sounds, in seconds. */
export const STAB_S = 0.12
/** Notes sound for this share of their slot, so repeated notes stay distinct. */
const GATE = 0.9

/** The bass root sits in C2–B2. */
export function bassMidi(rootPc: number, semitones: number): number {
  return 36 + rootPc + semitones
}

/** A close dominant-7th voicing with its root in E3–D#4. */
export function chordMidis(rootPc: number): number[] {
  const root = 52 + ((rootPc - 4 + 12) % 12)
  return DOMINANT_7TH.map((i) => root + i)
}

/**
 * Events for every beat starting in [now, now + lookahead), and the state to resume from: the
 * metronome's look-ahead pattern, one beat at a time. Config changes apply from the next beat.
 */
export function scheduleBacking(
  state: BackingState,
  config: BackingConfig,
  now: number,
  lookahead: number,
): { events: BackingEvent[]; state: BackingState } {
  let { nextBeatTime, bar, beat } = state
  // A throttled timer (background tab) can leave us behind: skip the missed beats rather than
  // playing them all at once.
  if (nextBeatTime < now) nextBeatTime = now
  bar %= config.form.length

  const beatS = 60 / config.bpm
  const offS = offbeatFraction(config.feel) * beatS
  const events: BackingEvent[] = []
  while (nextBeatTime < now + lookahead) {
    const t = nextBeatTime
    const root = chordRootPc(config.tonicPc, config.form[bar])
    if (beat === 0) events.push({ kind: 'bar', time: t, bar })
    events.push({ kind: beat % 2 === 0 ? 'kick' : 'snare', time: t })
    events.push({ kind: 'hat', time: t }, { kind: 'hat', time: t + offS })
    if (config.feel === 'shuffle') {
      events.push(
        {
          kind: 'bass',
          time: t,
          midi: bassMidi(root, SHUFFLE_BASS[beat * 2]),
          duration: offS * GATE,
        },
        {
          kind: 'bass',
          time: t + offS,
          midi: bassMidi(root, SHUFFLE_BASS[beat * 2 + 1]),
          duration: (beatS - offS) * GATE,
        },
      )
    } else {
      events.push({
        kind: 'bass',
        time: t,
        midi: bassMidi(root, STRAIGHT_BASS[beat]),
        duration: beatS * GATE,
      })
    }
    events.push({ kind: 'chords', time: t + offS, midis: chordMidis(root), duration: STAB_S })

    beat += 1
    if (beat === BEATS_PER_BAR) {
      beat = 0
      bar = (bar + 1) % config.form.length
    }
    nextBeatTime += beatS
  }
  return { events, state: { nextBeatTime, bar, beat } }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/core/jam && npm run typecheck && npm run lint`
Expected: PASS; no type or lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/jam
git commit -m "feat(jam): 12-bar blues form, chord tones and a pure backing scheduler"
```

---

### Task 16: Backing band: synth voices, the look-ahead scheduler, `useBacking`

**Files:**
- Create: `src/audio/backing/voices.ts`, `src/audio/backing/BackingScheduler.ts`, `src/ui/hooks/useBacking.ts`
- Test: `src/audio/backing/BackingScheduler.test.ts`, `src/ui/hooks/useBacking.test.tsx`

**Interfaces:**
- Consumes: `scheduleBacking`, `INSTRUMENTS`, `BackingConfig`, `BackingEvent`, `BackingState`, `Instrument` (Task 15); `bluesForm` (Task 15, tests); `audioEngine` (`ctx`, `master`, `now()`); `midiToFreq`; `useSettings`
- Produces:
  - voices: `makeNoiseBuffer(ctx)`, `playKick(ctx, out, t)`, `playSnare(ctx, out, t, noise)`, `playHat(ctx, out, t, noise)`, `playBass(ctx, out, t, freq, duration)`, `playChord(ctx, out, t, freqs, duration)`
  - `interface MixLevel { volume: number; muted: boolean }`, `type Mix = Record<Instrument, MixLevel>`, `DEFAULT_MIX` (kick 0.8, snare 0.6, hat 0.4, bass 0.8, chords 0.5)
  - `class BackingScheduler { constructor(config, onBar: (bar: number) => void, mix = DEFAULT_MIX); isRunning; setConfig(config); setA4(a4); setMix(mix); start(); stop() }`
  - `useBacking(config: BackingConfig, mix: Mix): { running: boolean; bar: number | null; toggle: () => void }`

Spec §12's instruments table, all synthesised:

| Instrument | Sound |
|---|---|
| Kick | a sine dropping 120 → 50 Hz |
| Snare | noise (high-passed at 1 kHz) over a 180 Hz body |
| Closed hi-hat | noise high-passed at 7 kHz |
| Bass | triangle + square through a 900 Hz low-pass |
| Chords | three saws per note, detuned −7/0/+7 cents, through a 1.8 kHz low-pass, with a short envelope |

- **Mixer.** Each instrument plays into its own `GainNode` channel on `audioEngine.master`. The channel's gain is the mixer volume, or 0 when muted, and it changes live.
- **Scheduling.** This mirrors `Metronome`: a 25 ms timer, 100 ms of look-ahead and a 50 ms start delay. Each `'bar'` event is reported to the page with a `setTimeout` at the moment it is heard, so the page re-renders once a bar, not every frame.
- **Tuning.** Frequencies follow the A4 setting, so the band is in tune with a harp tuned to 442 Hz.

- [ ] **Step 1: Write the failing tests**

`src/audio/backing/BackingScheduler.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bluesForm } from '../../core/jam/blues'
import type { BackingConfig } from '../../core/jam/backingSchedule'
import { audioEngine } from '../AudioEngine'
import { BackingScheduler, DEFAULT_MIX } from './BackingScheduler'

const param = () => ({
  value: 0,
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
})
const node = () => ({ connect: vi.fn((dest: unknown) => dest) })

/** Records every source node the voices start, with its type and frequency. */
class FakeAudioContext {
  currentTime = 0
  sampleRate = 8000
  started: { type: string; freq: number; at: number }[] = []
  gains: { gain: ReturnType<typeof param> }[] = []
  createGain = () => {
    const g = { ...node(), gain: param() }
    this.gains.push(g)
    return g
  }
  createBiquadFilter = () => ({ ...node(), type: '', frequency: param() })
  createBuffer = (_channels: number, length: number) => {
    const data = new Float32Array(length)
    return { getChannelData: () => data }
  }
  createOscillator = () => {
    const osc = {
      ...node(),
      type: 'sine',
      frequency: param(),
      detune: param(),
      start: (at: number) => this.started.push({ type: osc.type, freq: osc.frequency.value, at }),
      stop: vi.fn(),
    }
    return osc
  }
  createBufferSource = () => {
    const src = {
      ...node(),
      buffer: null,
      start: (at: number) => this.started.push({ type: 'noise', freq: 0, at }),
      stop: vi.fn(),
    }
    return src
  }
}

// 120 BPM: a beat every 0.5 s. G blues (C harp, 2nd position).
const CONFIG: BackingConfig = { bpm: 120, feel: 'shuffle', form: bluesForm(false), tonicPc: 7 }

describe('BackingScheduler', () => {
  let ctx: FakeAudioContext
  let master: ReturnType<typeof node>

  beforeEach(() => {
    vi.useFakeTimers()
    ctx = new FakeAudioContext()
    master = node()
    vi.spyOn(audioEngine, 'now').mockImplementation(() => ctx.currentTime)
    vi.spyOn(audioEngine, 'ctx', 'get').mockReturnValue(ctx as unknown as AudioContext)
    vi.spyOn(audioEngine, 'master', 'get').mockReturnValue(master as unknown as GainNode)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  /** Moves the audio clock and the timers on together, 25 ms at a time. */
  const run = (ms: number) => {
    for (let t = 0; t < ms; t += 25) {
      ctx.currentTime += 0.025
      vi.advanceTimersByTime(25)
    }
  }

  it('schedules the first beat just after start: kick, hats, bass and a chord stab', () => {
    const s = new BackingScheduler(CONFIG, vi.fn())
    s.start()
    const at = (t: number) => ctx.started.filter((n) => Math.abs(n.at - t) < 1e-9)
    // Beat 1 at 0.05 s: kick (sine), a hat (noise), the bass root (triangle + square at G2).
    expect(at(0.05).map((n) => n.type)).toEqual(['sine', 'noise', 'triangle', 'square'])
    expect(at(0.05)[2].freq).toBeCloseTo(98, 1) // G2
    // The swung offbeat at 0.05 + 1/3 s: a hat, the bass 3rd and 12 saws (4 notes × 3).
    const off = at(0.05 + 1 / 3)
    expect(off.filter((n) => n.type === 'sawtooth')).toHaveLength(12)
    expect(off.filter((n) => n.type === 'noise')).toHaveLength(1)
  })

  it('keeps scheduling on its timer and reports each bar when it is heard', () => {
    const onBar = vi.fn()
    const s = new BackingScheduler(CONFIG, onBar)
    s.start()
    run(100)
    expect(onBar).toHaveBeenCalledWith(0)
    run(2000) // one bar is 2 s at 120 BPM
    expect(onBar).toHaveBeenLastCalledWith(1)
    expect(ctx.started.filter((n) => n.type === 'sine').length).toBe(3) // kicks on beats 1 and 3
  })

  it('stops scheduling and cancels a pending bar report', () => {
    const onBar = vi.fn()
    const s = new BackingScheduler(CONFIG, onBar)
    s.start()
    s.stop()
    const count = ctx.started.length
    run(3000)
    expect(ctx.started.length).toBe(count)
    expect(onBar).not.toHaveBeenCalled()
    expect(s.isRunning).toBe(false)
  })

  it('sets one mixer channel per instrument, live', () => {
    const s = new BackingScheduler(CONFIG, vi.fn())
    s.start()
    const channels = ctx.gains.slice(0, 5).map((g) => g.gain.value)
    expect(channels).toEqual([0.8, 0.6, 0.4, 0.8, 0.5])
    s.setMix({
      ...DEFAULT_MIX,
      bass: { volume: 0.3, muted: true },
      hat: { volume: 0.9, muted: false },
    })
    expect(ctx.gains.slice(0, 5).map((g) => g.gain.value)).toEqual([0.8, 0.6, 0.9, 0, 0.5])
  })

  it('tunes to the A4 setting', () => {
    const s = new BackingScheduler(CONFIG, vi.fn())
    s.setA4(442)
    s.start()
    const bass = ctx.started.find((n) => n.type === 'triangle')!
    expect(bass.freq).toBeCloseTo(98.44, 2) // G2 at A4 = 442
  })
})
```

`src/ui/hooks/useBacking.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_MIX } from '../../audio/backing/BackingScheduler'
import { bluesForm } from '../../core/jam/blues'
import { SettingsProvider } from '../settings/SettingsContext'
import { useBacking } from './useBacking'

const fake = vi.hoisted(() => ({
  onBar: null as ((bar: number) => void) | null,
  configs: [] as unknown[],
  mixes: [] as unknown[],
  a4s: [] as number[],
  stops: 0,
}))

vi.mock('../../audio/backing/BackingScheduler', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../audio/backing/BackingScheduler')>()
  return {
    ...real,
    BackingScheduler: class {
      isRunning = false
      constructor(_config: unknown, onBar: (bar: number) => void) {
        fake.onBar = onBar
      }
      setConfig(c: unknown) {
        fake.configs.push(c)
      }
      setMix(m: unknown) {
        fake.mixes.push(m)
      }
      setA4(a4: number) {
        fake.a4s.push(a4)
      }
      start() {
        this.isRunning = true
      }
      stop() {
        this.isRunning = false
        fake.stops++
      }
    },
  }
})

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider storage={null}>{children}</SettingsProvider>
)
const CONFIG = { bpm: 100, feel: 'shuffle' as const, form: bluesForm(false), tonicPc: 7 }

describe('useBacking', () => {
  it('starts and stops, reports the bar, and passes config, mix and A4 on', () => {
    const { result, unmount } = renderHook(() => useBacking(CONFIG, DEFAULT_MIX), { wrapper })
    expect(fake.configs.at(-1)).toBe(CONFIG)
    expect(fake.mixes.at(-1)).toBe(DEFAULT_MIX)
    expect(fake.a4s.at(-1)).toBe(440)
    act(() => result.current.toggle())
    expect(result.current.running).toBe(true)
    act(() => fake.onBar?.(3))
    expect(result.current.bar).toBe(3)
    act(() => result.current.toggle())
    expect(result.current).toMatchObject({ running: false, bar: null })
    const stops = fake.stops
    unmount()
    expect(fake.stops).toBe(stops + 1)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/audio/backing src/ui/hooks/useBacking.test.tsx`
Expected: FAIL, because `./BackingScheduler` and `./useBacking` can't be resolved.

- [ ] **Step 3: Write the voices**

`src/audio/backing/voices.ts`:

```ts
/**
 * Spec §12's synthesised band. Each function schedules one hit on the audio clock at `t` into
 * `out` (the instrument's mixer channel); the nodes stop and are collected on their own.
 */

/** One second of white noise, shared by the snare and the hi-hat. */
export function makeNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

/** Kick: a sine dropping from 120 to 50 Hz. */
export function playKick(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  const osc = ctx.createOscillator()
  const env = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(120, t)
  osc.frequency.exponentialRampToValueAtTime(50, t + 0.12)
  env.gain.setValueAtTime(0.9, t)
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
  osc.connect(env).connect(out)
  osc.start(t)
  osc.stop(t + 0.32)
}

/** Snare: a burst of noise over a short 180 Hz body. */
export function playSnare(
  ctx: BaseAudioContext,
  out: AudioNode,
  t: number,
  noise: AudioBuffer,
): void {
  const src = ctx.createBufferSource()
  src.buffer = noise
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 1000
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.5, t)
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
  src.connect(hp).connect(env).connect(out)
  src.start(t)
  src.stop(t + 0.2)

  const body = ctx.createOscillator()
  const bodyEnv = ctx.createGain()
  body.type = 'triangle'
  body.frequency.value = 180
  bodyEnv.gain.setValueAtTime(0.4, t)
  bodyEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
  body.connect(bodyEnv).connect(out)
  body.start(t)
  body.stop(t + 0.12)
}

/** Closed hi-hat: very short high-passed noise. */
export function playHat(
  ctx: BaseAudioContext,
  out: AudioNode,
  t: number,
  noise: AudioBuffer,
): void {
  const src = ctx.createBufferSource()
  src.buffer = noise
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 7000
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.25, t)
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
  src.connect(hp).connect(env).connect(out)
  src.start(t)
  src.stop(t + 0.06)
}

/** Bass: triangle + square through a 900 Hz low-pass. */
export function playBass(
  ctx: BaseAudioContext,
  out: AudioNode,
  t: number,
  freq: number,
  duration: number,
): void {
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 900
  const env = ctx.createGain()
  env.gain.setValueAtTime(0, t)
  env.gain.linearRampToValueAtTime(0.5, t + 0.01)
  env.gain.setValueAtTime(0.5, t + Math.max(0.01, duration - 0.03))
  env.gain.linearRampToValueAtTime(0, t + duration)
  lp.connect(env).connect(out)
  for (const [type, level] of [
    ['triangle', 0.7],
    ['square', 0.3],
  ] as const) {
    const osc = ctx.createOscillator()
    const mix = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    mix.gain.value = level
    osc.connect(mix).connect(lp)
    osc.start(t)
    osc.stop(t + duration + 0.02)
  }
}

/** Chord stab: three slightly detuned saws per note through a 1.8 kHz low-pass. */
export function playChord(
  ctx: BaseAudioContext,
  out: AudioNode,
  t: number,
  freqs: readonly number[],
  duration: number,
): void {
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1800
  const env = ctx.createGain()
  env.gain.setValueAtTime(0, t)
  env.gain.linearRampToValueAtTime(0.3, t + 0.005)
  env.gain.exponentialRampToValueAtTime(0.001, t + duration)
  lp.connect(env).connect(out)
  const level = 1 / (3 * freqs.length)
  for (const freq of freqs) {
    for (const detune of [-7, 0, 7]) {
      const osc = ctx.createOscillator()
      const mix = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.value = freq
      osc.detune.value = detune
      mix.gain.value = level
      osc.connect(mix).connect(lp)
      osc.start(t)
      osc.stop(t + duration + 0.02)
    }
  }
}
```

- [ ] **Step 4: Write the scheduler**

`src/audio/backing/BackingScheduler.ts`:

```ts
import {
  INSTRUMENTS,
  scheduleBacking,
  type BackingConfig,
  type BackingEvent,
  type BackingState,
  type Instrument,
} from '../../core/jam/backingSchedule'
import { midiToFreq } from '../../core/music/pitch'
import { audioEngine } from '../AudioEngine'
import { makeNoiseBuffer, playBass, playChord, playHat, playKick, playSnare } from './voices'

const TICK_MS = 25
const LOOKAHEAD_S = 0.1
const START_DELAY_S = 0.05

export interface MixLevel {
  /** 0–1. */
  volume: number
  muted: boolean
}

export type Mix = Record<Instrument, MixLevel>

export const DEFAULT_MIX: Mix = {
  kick: { volume: 0.8, muted: false },
  snare: { volume: 0.6, muted: false },
  hat: { volume: 0.4, muted: false },
  bass: { volume: 0.8, muted: false },
  chords: { volume: 0.5, muted: false },
}

export type BarListener = (bar: number) => void

/**
 * The backing track: the metronome's look-ahead pattern (a coarse timer schedules each beat
 * slightly ahead on the audio clock), feeding one mixer channel per instrument.
 */
export class BackingScheduler {
  private timer: ReturnType<typeof setInterval> | undefined
  private state: BackingState = { nextBeatTime: 0, bar: 0, beat: 0 }
  private pendingBars = new Set<ReturnType<typeof setTimeout>>()
  private channels: Record<Instrument, GainNode> | null = null
  private noise: AudioBuffer | null = null
  private a4 = 440

  constructor(
    private config: BackingConfig,
    private readonly onBar: BarListener,
    private mix: Mix = DEFAULT_MIX,
  ) {}

  get isRunning(): boolean {
    return this.timer !== undefined
  }

  setConfig(config: BackingConfig): void {
    this.config = config
  }

  setA4(a4: number): void {
    this.a4 = a4
  }

  setMix(mix: Mix): void {
    this.mix = mix
    if (this.channels) this.applyMix(this.channels)
  }

  start(): void {
    if (this.isRunning) return
    const ctx = audioEngine.ctx
    if (!this.channels) {
      const channels = {} as Record<Instrument, GainNode>
      for (const i of INSTRUMENTS) {
        channels[i] = ctx.createGain()
        channels[i].connect(audioEngine.master)
      }
      this.channels = channels
      this.applyMix(channels)
    }
    this.noise ??= makeNoiseBuffer(ctx)
    this.state = { nextBeatTime: audioEngine.now() + START_DELAY_S, bar: 0, beat: 0 }
    this.tick()
    this.timer = setInterval(this.tick, TICK_MS)
  }

  stop(): void {
    clearInterval(this.timer)
    this.timer = undefined
    this.pendingBars.forEach(clearTimeout)
    this.pendingBars.clear()
  }

  private applyMix(channels: Record<Instrument, GainNode>): void {
    for (const i of INSTRUMENTS) {
      const { volume, muted } = this.mix[i]
      channels[i].gain.value = muted ? 0 : volume
    }
  }

  private tick = (): void => {
    const ctx = audioEngine.ctx
    const { events, state } = scheduleBacking(this.state, this.config, ctx.currentTime, LOOKAHEAD_S)
    this.state = state
    for (const e of events) this.play(ctx, e)
  }

  private play(ctx: AudioContext, e: BackingEvent): void {
    const ch = this.channels
    const noise = this.noise
    if (!ch || !noise) return
    switch (e.kind) {
      case 'kick':
        return playKick(ctx, ch.kick, e.time)
      case 'snare':
        return playSnare(ctx, ch.snare, e.time, noise)
      case 'hat':
        return playHat(ctx, ch.hat, e.time, noise)
      case 'bass':
        return playBass(ctx, ch.bass, e.time, midiToFreq(e.midi, this.a4), e.duration)
      case 'chords':
        return playChord(
          ctx,
          ch.chords,
          e.time,
          e.midis.map((m) => midiToFreq(m, this.a4)),
          e.duration,
        )
      case 'bar':
        return this.notifyAt(ctx, e.time, e.bar)
    }
  }

  /** Tells the page about the new bar when it is actually heard. */
  private notifyAt(ctx: AudioContext, time: number, bar: number): void {
    const delayMs = Math.max(0, (time - ctx.currentTime) * 1000)
    const id = setTimeout(() => {
      this.pendingBars.delete(id)
      this.onBar(bar)
    }, delayMs)
    this.pendingBars.add(id)
  }
}
```

- [ ] **Step 5: Write the hook**

`src/ui/hooks/useBacking.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { BackingScheduler, type Mix } from '../../audio/backing/BackingScheduler'
import type { BackingConfig } from '../../core/jam/backingSchedule'
import { useSettings } from '../settings/SettingsContext'

/**
 * The play-along's backing track. `config` and `mix` should be memoised by the caller; changes
 * apply live while it plays. `bar` changes once per bar, so the page re-renders once a bar.
 */
export function useBacking(config: BackingConfig, mix: Mix) {
  const { settings } = useSettings()
  const [running, setRunning] = useState(false)
  const [bar, setBar] = useState<number | null>(null)
  const [scheduler] = useState(() => new BackingScheduler(config, setBar, mix))

  useEffect(() => scheduler.setConfig(config), [scheduler, config])
  useEffect(() => scheduler.setMix(mix), [scheduler, mix])
  useEffect(() => scheduler.setA4(settings.a4), [scheduler, settings.a4])
  useEffect(() => () => scheduler.stop(), [scheduler])

  const toggle = useCallback(() => {
    if (scheduler.isRunning) {
      scheduler.stop()
      setRunning(false)
      setBar(null)
    } else {
      scheduler.start()
      setRunning(true)
    }
  }, [scheduler])

  return { running, bar, toggle }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/audio src/ui/hooks && npm run typecheck && npm run lint`
Expected: PASS; no type or lint errors.

- [ ] **Step 7: Commit**

```bash
git add src/audio/backing src/ui/hooks/useBacking.ts src/ui/hooks/useBacking.test.tsx
git commit -m "feat(audio): synthesised blues band with a look-ahead scheduler and mixer"
```

---

### Task 17: Blues play-along page

**Files:**
- Create: `src/ui/pages/jam/JamPage.tsx`, `src/ui/pages/jam/JamPage.module.css`
- Modify: `src/ui/App.tsx` (route), `src/ui/pages/homeGroups.ts` (Jam entry)
- Test: `src/ui/pages/jam/JamPage.test.tsx`, `src/ui/pages/homeGroups.test.ts` (update), `src/ui/App.test.tsx` (append)

**Interfaces:**
- Consumes:
  - `useBacking`, `DEFAULT_MIX`, `Mix` (Task 16)
  - `bluesForm`, `chordName`, `chordRootPc`, `jamMarks`, `INSTRUMENTS`, `Feel`, `Instrument` (Task 15)
  - `MicFeed`, the `'hint'` highlight (Task 2)
  - `POSITIONS`, `Position`; `freqToMidi`; `Slot`
  - `useHarp`, `usePracticeTimer`, `positionTonicPc`, `positionLabel`, `pitchClassName` (Plan 3)
- Produces: `JamPage()` (route `/jam`, practice-timer id `jam`); `Jam()`; `JAM_BPM = [60, 160]`

Spec §12.
- **Controls:** Play/Stop; Position (2nd by default, showing each position's blues key); Feel (Shuffle/Straight); Quick change; Tempo 60–160, which writes the shared BPM, clamped for the backing (decision 8).
- **The bar display:** the current chord large, "Bar x/12" and a 12-box form strip.
- **The chart:** the current chord's tones on `target` and the rest of the blues scale on the new `'hint'`, with a "Chord tones · Blues scale" legend.
- **The mixer:** a volume slider and a mute per instrument.
- **"Show what I play"** (off by default) mounts `MicFeed` and a headphones notice. Detected notes override the marks, and the page re-renders only when the detected note changes. There is no scoring.
- **Rendering.** Nothing here draws per frame: the page re-renders once a bar (from `useBacking`) and on note changes.

- [ ] **Step 1: Write the failing test**

`src/ui/pages/jam/JamPage.test.tsx`:

```tsx
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { Profiler } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mix } from '../../../audio/backing/BackingScheduler'
import type { PitchListener } from '../../../audio/pitch/PitchDetector'
import type { BackingConfig } from '../../../core/jam/backingSchedule'
import { midiToFreq } from '../../../core/music/pitch'
import type { PitchState } from '../../hooks/usePitch'
import { layoutShape } from '../../../test/layout'
import { SettingsProvider } from '../../settings/SettingsContext'
import { Jam } from './JamPage'

const backing = vi.hoisted(() => ({
  running: false,
  bar: null as number | null,
  toggle: vi.fn(),
  config: null as BackingConfig | null,
  mix: null as Mix | null,
}))
vi.mock('../../hooks/useBacking', () => ({
  useBacking: (config: BackingConfig, mix: Mix) => {
    backing.config = config
    backing.mix = mix
    return { running: backing.running, bar: backing.bar, toggle: backing.toggle }
  },
}))
const mic = vi.hoisted(() => ({
  listener: null as PitchListener | null,
  state: { reading: null, rms: 0, status: 'listening', error: null } as PitchState,
}))
vi.mock('../../hooks/usePitch', () => ({
  usePitch: (_enabled: boolean, onReading: PitchListener) => {
    mic.listener = onReading
    return mic.state
  },
}))

let commits = 0
const renderJam = () =>
  render(
    <SettingsProvider storage={null}>
      <Profiler id="jam" onRender={() => commits++}>
        <Jam />
      </Profiler>
    </SettingsProvider>,
  )
const cell = (name: string) => screen.getByRole('button', { name })

describe('Jam', () => {
  beforeEach(() => {
    backing.running = false
    backing.bar = null
    backing.toggle.mockClear()
    mic.listener = null
    commits = 0
  })

  it('plays G blues on a C harp: chord tones on target, the rest of the scale as hints', () => {
    renderJam()
    expect(backing.config).toMatchObject({ bpm: 90, feel: 'shuffle', tonicPc: 7 })
    expect(screen.getByLabelText('Current chord')).toHaveTextContent('G7')
    expect(cell('-2 G4')).toHaveAttribute('data-highlight', 'target')
    expect(cell('-3 B4')).toHaveAttribute('data-highlight', 'target')
    expect(cell("-3' A#4")).toHaveAttribute('data-highlight', 'hint')
    expect(cell('4 C5')).toHaveAttribute('data-highlight', 'hint')
    expect(cell('5 E5')).not.toHaveAttribute('data-highlight')
    fireEvent.click(screen.getByRole('button', { name: '▶ Play' }))
    expect(backing.toggle).toHaveBeenCalled()
  })

  it('follows the bar: the chord, the form strip and the chart', () => {
    backing.running = true
    backing.bar = 4
    renderJam()
    expect(screen.getByText('Bar 5/12')).toBeInTheDocument()
    const strip = within(screen.getByRole('list', { name: '12-bar form' })).getAllByRole('listitem')
    expect(strip.map((li) => li.textContent).join(' ')).toBe('G7 G7 G7 G7 C7 C7 G7 G7 D7 C7 G7 D7')
    expect(strip[4]).toHaveAttribute('data-current', 'true')
    expect(screen.getByRole('button', { name: '■ Stop' })).toBeInTheDocument()
    expect(cell('5 E5')).toHaveAttribute('data-highlight', 'target') // E is in C7
  })

  it('switches position, feel, quick change and tempo', () => {
    renderJam()
    fireEvent.change(screen.getByRole('combobox', { name: 'Position' }), { target: { value: '1' } })
    expect(backing.config?.tonicPc).toBe(0)
    expect(screen.getByLabelText('Current chord')).toHaveTextContent('C7')
    fireEvent.click(screen.getByRole('button', { name: 'Straight' }))
    expect(backing.config?.feel).toBe('straight')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Quick change' }))
    expect(backing.config?.form[1]).toBe('IV')
    fireEvent.change(screen.getByRole('slider', { name: /Tempo/ }), { target: { value: '140' } })
    expect(backing.config?.bpm).toBe(140)
  })

  it('keeps the tempo inside 60–160 BPM', () => {
    render(
      <SettingsProvider storage={null}>
        <Jam />
      </SettingsProvider>,
    )
    fireEvent.change(screen.getByRole('slider', { name: /Tempo/ }), { target: { value: '40' } })
    expect(backing.config?.bpm).toBe(60)
  })

  it('has a volume and a mute for every instrument', () => {
    renderJam()
    fireEvent.change(screen.getByRole('slider', { name: 'Bass' }), { target: { value: '0.25' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mute hi-hat' }))
    expect(backing.mix?.bass).toEqual({ volume: 0.25, muted: false })
    expect(backing.mix?.hat).toEqual({ volume: 0.4, muted: true })
    for (const name of ['Kick', 'Snare', 'Hi-hat', 'Chords']) {
      expect(screen.getByRole('slider', { name })).toBeInTheDocument()
    }
  })

  it('shows what I play only when asked, re-rendering only when the note changes', () => {
    renderJam()
    expect(mic.listener).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show what I play' }))
    expect(screen.getByText(/Use headphones/)).toBeInTheDocument()
    const reading = { freq: midiToFreq(67), clarity: 1, rms: 0.1 }
    act(() => mic.listener?.(reading, 0.1))
    expect(cell('-2 G4')).toHaveAttribute('data-highlight', 'detected')
    const before = commits
    act(() => {
      for (let i = 0; i < 30; i++) mic.listener?.(reading, 0.1)
    })
    expect(commits).toBe(before)
  })

  it('keeps the same layout stopped and playing', () => {
    const shape = () => {
      const { container, unmount } = renderJam()
      const areas = layoutShape(container, ['output', '[aria-label="12-bar form"] li', 'fieldset'])
      const children = [...container.children].map((e) => e.tagName)
      unmount()
      return { areas, children }
    }
    const stopped = shape()
    backing.running = true
    backing.bar = 9
    expect(shape()).toEqual(stopped)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/pages/jam`
Expected: FAIL, because `./JamPage` can't be resolved.

- [ ] **Step 3: Write the page and its styles**

`src/ui/pages/jam/JamPage.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { DEFAULT_MIX, type Mix } from '../../../audio/backing/BackingScheduler'
import type { PitchListener } from '../../../audio/pitch/PitchDetector'
import { findNotes, noteId } from '../../../core/harmonica/harp'
import { keySpelling } from '../../../core/harmonica/keys'
import {
  positionLabel,
  positionTonicPc,
  POSITIONS,
  type Position,
} from '../../../core/harmonica/positions'
import { INSTRUMENTS, type Feel, type Instrument } from '../../../core/jam/backingSchedule'
import { bluesForm, chordName, chordRootPc, jamMarks } from '../../../core/jam/blues'
import { pitchClassName } from '../../../core/music/noteNames'
import { freqToMidi } from '../../../core/music/pitch'
import { AudioGate } from '../../components/AudioGate'
import { HarmonicaDiagram, type Highlight } from '../../components/HarmonicaDiagram'
import { MicFeed } from '../../components/MicFeed'
import gameStyles from '../../components/game/Game.module.css'
import { useBacking } from '../../hooks/useBacking'
import { useHarp } from '../../hooks/useHarp'
import { usePracticeTimer } from '../../hooks/usePracticeTimer'
import { Slot } from '../../hooks/useSlot'
import { useSettings } from '../../settings/SettingsContext'
import styles from './JamPage.module.css'

/** Spec §12: the backing plays between 60 and 160 BPM. */
export const JAM_BPM = [60, 160] as const

const INSTRUMENT_NAMES: Record<Instrument, string> = {
  kick: 'Kick',
  snare: 'Snare',
  hat: 'Hi-hat',
  bass: 'Bass',
  chords: 'Chords',
}

export function JamPage() {
  usePracticeTimer('jam')
  return (
    <>
      <h1>Blues play-along</h1>
      <p className={gameStyles.intro}>
        A 12-bar blues band in your harp's key. The chart lights up the notes that fit each bar.
      </p>
      <AudioGate>
        <Jam />
      </AudioGate>
    </>
  )
}

export function Jam() {
  const { settings, update } = useSettings()
  const harp = useHarp()
  const spelling = keySpelling(settings.key)
  const [position, setPosition] = useState<Position>(2)
  const [feel, setFeel] = useState<Feel>('shuffle')
  const [quickChange, setQuickChange] = useState(false)
  const [mix, setMix] = useState<Mix>(DEFAULT_MIX)
  const [showMine, setShowMine] = useState(false)
  const [detected, setDetected] = useState<number | null>(null)
  const [lastMidi] = useState(() => new Slot<number>())

  const bpm = Math.min(JAM_BPM[1], Math.max(JAM_BPM[0], settings.bpm))
  const tonicPc = positionTonicPc(settings.key, position)
  const form = useMemo(() => bluesForm(quickChange), [quickChange])
  const config = useMemo(() => ({ bpm, feel, form, tonicPc }), [bpm, feel, form, tonicPc])
  const backing = useBacking(config, mix)

  const bar = backing.bar ?? 0
  const rootPc = chordRootPc(tonicPc, form[bar])
  const highlights = new Map<string, Highlight>()
  for (const [id, mark] of jamMarks(harp, tonicPc, rootPc)) {
    highlights.set(id, mark === 'chord' ? 'target' : 'hint')
  }
  if (showMine && detected !== null) {
    for (const n of findNotes(harp, detected)) highlights.set(noteId(n), 'detected')
  }

  // Mic frames arrive 60 times a second; the page only re-renders when the note changes.
  const onReading: PitchListener = (reading) => {
    const midi = reading ? freqToMidi(reading.freq, settings.a4).midi : null
    if (midi === lastMidi.get()) return
    lastMidi.set(midi)
    setDetected(midi)
  }
  const setLevel = (i: Instrument, patch: Partial<Mix[Instrument]>) =>
    setMix((m) => ({ ...m, [i]: { ...m[i], ...patch } }))
  const tonicName = (p: Position) => pitchClassName(positionTonicPc(settings.key, p), spelling)

  return (
    <>
      <div className={gameStyles.toolbar}>
        <button type="button" className={gameStyles.primary} onClick={backing.toggle}>
          {backing.running ? '■ Stop' : '▶ Play'}
        </button>
        <label className={gameStyles.field}>
          Position
          <select
            aria-label="Position"
            value={position}
            onChange={(e) => setPosition(Number(e.target.value) as Position)}
          >
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {positionLabel(p)} ({tonicName(p)} blues)
              </option>
            ))}
          </select>
        </label>
        <div role="group" aria-label="Feel" className={gameStyles.segmented}>
          <button
            type="button"
            aria-pressed={feel === 'shuffle'}
            onClick={() => setFeel('shuffle')}
          >
            Shuffle
          </button>
          <button
            type="button"
            aria-pressed={feel === 'straight'}
            onClick={() => setFeel('straight')}
          >
            Straight
          </button>
        </div>
        <label className={gameStyles.field}>
          <input
            type="checkbox"
            checked={quickChange}
            onChange={(e) => setQuickChange(e.target.checked)}
          />
          Quick change
        </label>
        <label className={gameStyles.field}>
          Tempo
          <input
            type="range"
            min={JAM_BPM[0]}
            max={JAM_BPM[1]}
            step={1}
            value={bpm}
            onChange={(e) => update({ bpm: Number(e.target.value) })}
          />
          <span>{bpm} BPM</span>
        </label>
      </div>

      <div className={styles.now}>
        <output className={styles.chord} aria-label="Current chord">
          {chordName(rootPc, spelling)}
        </output>
        <p className={styles.bar}>{backing.running ? `Bar ${bar + 1}/12` : 'Stopped'}</p>
      </div>
      <ol className={styles.form} aria-label="12-bar form">
        {form.map((degree, i) => (
          <li key={i} data-current={backing.running && i === bar ? 'true' : undefined}>
            {chordName(chordRootPc(tonicPc, degree), spelling)}
          </li>
        ))}
      </ol>

      <HarmonicaDiagram
        harp={harp}
        spelling={spelling}
        labelMode={settings.labelMode}
        showAdvanced={settings.showAdvanced}
        highlights={highlights}
      />
      <ul className={styles.legend} aria-label="Chart legend">
        <li>
          <span className={styles.swatch} data-kind="chord" /> Chord tones
        </li>
        <li>
          <span className={styles.swatch} data-kind="scale" /> Blues scale
        </li>
      </ul>

      <fieldset className={styles.mixer}>
        <legend>Mixer</legend>
        {INSTRUMENTS.map((i) => (
          <div key={i} className={gameStyles.field}>
            <label className={gameStyles.field}>
              {INSTRUMENT_NAMES[i]}
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={mix[i].volume}
                onChange={(e) => setLevel(i, { volume: Number(e.target.value) })}
              />
            </label>
            <label className={gameStyles.field}>
              <input
                type="checkbox"
                checked={mix[i].muted}
                onChange={(e) => setLevel(i, { muted: e.target.checked })}
              />
              Mute {INSTRUMENT_NAMES[i].toLowerCase()}
            </label>
          </div>
        ))}
      </fieldset>

      <label className={gameStyles.field}>
        <input type="checkbox" checked={showMine} onChange={(e) => setShowMine(e.target.checked)} />
        Show what I play
      </label>
      {showMine ? (
        <>
          <p className={gameStyles.hint}>
            Use headphones, so the mic hears your harp and not the backing track.
          </p>
          <MicFeed onReading={onReading} />
        </>
      ) : (
        <p className={gameStyles.hint}>The mic is off. Nothing is scored here: just play.</p>
      )}
    </>
  )
}
```

`src/ui/pages/jam/JamPage.module.css`:

```css
.now {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  margin: 0.5rem 0;
}

.chord {
  display: block;
  min-width: 5ch;
  margin: 0;
  font-size: 3rem;
  font-weight: 700;
  line-height: 1.1;
}

.bar {
  margin: 0;
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}

/* The 12 bars in one fixed row; the current one is outlined. */
.form {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 0.3rem;
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
  font-size: 0.75rem;
  text-align: center;
}

.form li {
  padding: 0.35rem 0;
  overflow: hidden;
  border: 2px solid var(--border);
  border-radius: 6px;
}

.form li[data-current] {
  border-color: var(--target);
  color: var(--text);
}

.legend {
  display: flex;
  gap: 1rem;
  margin: 0.25rem 0 1rem;
  padding: 0;
  list-style: none;
  color: var(--text-dim);
  font-size: 0.85rem;
}

.swatch {
  display: inline-block;
  width: 0.8rem;
  height: 0.8rem;
  margin-right: 0.35rem;
  border-radius: 3px;
  vertical-align: -0.1rem;
}

.swatch[data-kind='chord'] {
  background: var(--surface);
  box-shadow: 0 0 0 3px var(--target);
}

.swatch[data-kind='scale'] {
  background: color-mix(in srgb, var(--c-draw) 55%, var(--surface));
  border: 2px solid var(--c-draw);
}

.mixer {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
  margin: 0 0 1rem;
  padding: 0.5rem 1rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
```

- [ ] **Step 4: Route and Home entry**

In `src/ui/App.tsx`, add `import { JamPage } from './pages/jam/JamPage'` and the route `'/jam': JamPage,` after the `'/licks'` route.

In `src/ui/pages/homeGroups.ts`, replace `{ id: 'jam', title: 'Jam', entries: [] },` with:

```ts
  {
    id: 'jam',
    title: 'Jam',
    entries: [
      {
        id: 'jam',
        icon: '🎷',
        title: 'Blues play-along',
        text: 'A 12-bar blues band in your key, with the notes that fit each bar.',
      },
    ],
  },
```

In `src/ui/pages/homeGroups.test.ts`, change the Jam row to `['jam', 'Jam', ['jam']],`. The Jam group now shows on Home, because Plan 3's page renders non-empty groups.

In `src/ui/App.test.tsx`, add `['#/jam', 'Blues play-along'],` to the `routes %s to its game` list.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/ui && npm run typecheck && npm run lint`
Expected: PASS; no type or lint errors.

- [ ] **Step 6: Try it**

Run `npm run dev` and open `#/jam` with a C harp selected. Press Play: a G shuffle starts, the chord follows the 12-bar form, and the chart moves its rings with each chord.

Check each mute and slider. Change the tempo while it plays: the band follows from the next beat. The sound itself is a spec §13 manual check.

- [ ] **Step 7: Commit**

```bash
git add src/ui/pages/jam src/ui/App.tsx src/ui/App.test.tsx src/ui/pages/homeGroups.ts src/ui/pages/homeGroups.test.ts
git commit -m "feat: blues play-along — synthesised 12-bar band with chord-tone chart"
```

---

### Task 18: README, full verification, manual pass

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: everything above
- Produces: nothing new

- [ ] **Step 1: Update the README**

In `README.md`:

Replace the tagline line `Tuner · Metronome · Positions & keys · Ear games · Note quiz · Practice log` with:

```markdown
Tuner · Tone meter · Ear games · Tab reader · Lick trainer · Blues play-along · Practice log
```

In the Tools table, add after the `Positions & keys` row:

```markdown
| 🌬️ | **Tone & breath meter** | A live pitch and level chart, with steadiness and vibrato for the note you hold |
| 🩺 | **Harp health check** | Measures all 20 reeds and shows which ones are out of tune |
```

In the Games table, add after the `Note quiz` row:

```markdown
| 📜 | **Tab reader** | Play songs from scrolling tab — it can wait for you — or type your own |
| 🎸 | **Lick trainer** | Hear a short blues, folk or minor lick at your tempo, then play it back |
| ⏱️ | **Rhythm trainer** | Play any note on every hit of a pattern, graded against the metronome |
```

After the Games table and its "Every game has…" sentence, add:

```markdown
### Jam

| | | |
|---|---|---|
| 🎷 | **Blues play-along** | A synthesised 12-bar band in your harp's 2nd-position key; the chart shows the chord tones of every bar |
```

In the Roadmap, replace `- [ ] Next: harp health check, tone meter, rhythm trainer, tab reader, lick trainer, blues play-along` with:

```markdown
- [x] Harp health check, tone & breath meter
- [x] Rhythm trainer, tab reader, lick trainer
- [x] Blues play-along
```

- [ ] **Step 2: Run the full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: no lint or type errors; every test passes; `dist/` is built.

Run: `grep -rnE "Date\.now|performance\.now|Math\.random|setTimeout|window\.|document\." src/core --include=*.ts | grep -v '\.test\.ts'`
Expected: only the comment line in `src/core/games/random.ts` ("like Math.random"): `src/core` stays free of clocks, randomness and browser APIs.

- [ ] **Step 3: Manual pass (real browser, real harp, spec §13)**

Run `npm run preview` and check each page with a real harp, on a laptop and on a phone at 390 px:

- **Health check:**
  - A freshly tuned harp reads within about ±10 ¢ on most reeds.
  - Compare three reeds with a reference tuner.
  - A harp known to be at 442 Hz gets the "Use 442 Hz" suggestion.
- **Tone meter:**
  - A steady note reads a σ of a few cents.
  - A deliberate vibrato reads about 4–7 Hz with a plausible depth.
  - No vibrato reads "None".
- **Rhythm trainer:**
  - The metronome's clicks alone produce no hits, with laptop speakers and with headphones.
  - Steady quarters at 90 BPM average within ±30 ms. If the average is off by a constant amount, record the figure against the 60 ms latency.
- **Tab reader:**
  - Each song sounds right when played from its tab; fix any wrong note in `songs.ts`.
  - "Wait for me" never runs ahead of you.
- **Lick trainer:** licks play at the chosen BPM with their rhythm, and a sustained previous note isn't counted as a mistake.
- **Blues play-along:**
  - The band sounds like a shuffle, then a straight groove.
  - With "Show what I play" on and laptop speakers, check whether the backing lights up the chart. The headphones notice covers this.
  - Leave the tab in the background for a minute: coming back doesn't produce a burst of drums.
- **Every page:**
  - nothing jumps between phases;
  - the lane, the tables and the mixer fit or scroll sideways at 390 px;
  - the practice log counts time on each new page after "Tap to start audio".

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README for the health check, tone meter, rhythm, tab reader, licks and play-along"
```
