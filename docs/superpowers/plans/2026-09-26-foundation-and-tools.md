# Foundation + Tuner + Metronome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working static website with a harmonica-aware tuner (listen + play) and a metronome, built on a tested note model and audio engine that the games (Plan 2) will reuse.

**Architecture:** Three layers with one-directional dependencies: pure-TypeScript `src/core/` (music maths, Richter harmonica model, rhythm scheduling — no browser or React imports), browser `src/audio/` (AudioContext, mic, pitch detection with `pitchy`, synth note player, metronome — no React), and React `src/ui/`. Hash routing, relative Vite base, `localStorage` for settings.

**Tech Stack:** Vite, React 19, TypeScript (strict), pitchy, Vitest + jsdom + React Testing Library, ESLint (typescript-eslint, react-hooks), Prettier.

**Spec:** `docs/superpowers/specs/2026-09-26-harmonica-tools-design.md`

**Scope:** This is **Plan 1 of 2**. It implements spec §2–§7, §9, §11 and the §10 tests for those parts. **Plan 2 (Games)** will cover §8: NoteMatcher, NotePool, Session, intervals/scales, feedback avoidance, and the five games. The Home page lists the games as "Coming soon".

## Global Constraints

- Fully static build; **hash-based routing** (`/#/tuner`); Vite `base: './'` so `dist/` works on GitHub Pages or any sub-path.
- **Vite + React 19 + TypeScript strict mode**. No UI component library, no global store library, no router library.
- **English-only UI.** No i18n layer.
- **Persistence: `localStorage` only.** No backend, no accounts.
- `src/core/` never imports browser APIs or React. `src/audio/` never imports React.
- Mic constraints: `{ echoCancellation: false, noiseSuppression: false, autoGainControl: false }`; `AnalyserNode.fftSize` 2048.
- Pitch gate: emit `null` unless `clarity ≥ 0.9` and `rms ≥ noiseFloor`; median filter over the last 3 readings.
- Technique colours via CSS variables: blow/draw neutral greys, bends amber, overblows teal, overdraws violet; advanced (`common: false`) = dashed + faded, hidden unless `showAdvanced`.
- A4 calibration range 430–450 Hz (default 440). BPM range 30–250.
- Desktop-first but usable on a phone: the diagram scrolls horizontally, toolbars wrap.
- Tests are colocated as `*.test.ts(x)` next to the source file.
- Code style: Prettier with `semi: false`, `singleQuote: true`, `printWidth: 100`.

## Review Focus

1. **Silence, breath noise, room noise** → the tuner shows "Play a note…", never a stale or random note. Pinned by the silence / quiet / white-noise tests in Task 9 and the null-reading test in Task 12.
2. **Extreme notes across all 12 keys** → from the G harp's hole 1 blow (G3, 196 Hz) up to the F# harp's hole 10 overdraw (G7, ~3136 Hz), detection lands within ±5 cents. Pinned by the MIDI 55–103 sweep in Task 9.
3. **Corrupt, old or blocked `localStorage`** (bad JSON, out-of-range values, a private window whose storage throws) → defaults load and nothing crashes. Pinned by the Task 6 tests.
4. **Mic denied, missing, busy or insecure context** → a specific explanatory message; the rest of the page keeps working. Pinned by the Task 10 tests.
5. **Metronome in a throttled background tab, or BPM/signature changed mid-run** → no burst of catch-up clicks and no stray pulse index. Pinned by the Task 5 tests.

---

## File Structure

```
index.html
package.json, tsconfig.json, vite.config.ts, eslint.config.js, .prettierrc
src/
  main.tsx                         entry: mounts <App/>, imports theme.css
  test/setup.ts                    jest-dom matchers + RTL cleanup
  core/
    music/pitch.ts                 midiToFreq, freqToMidi, centsOff
    music/noteNames.ts             Spelling, noteName
    harmonica/keys.ts              HARP_KEYS, HarpKey, keyOffset, keySpelling
    harmonica/harp.ts              HarpNote & friends, buildHarp, findNotes, tabLabel, noteId
    harmonica/layout.ts            diagramLayout (rows above/below the hole numbers)
    rhythm/schedule.ts             time signatures, accentKind, scheduleAhead
    rhythm/tempo.ts                BPM_MIN/MAX, clampBpm, TapTempo
  audio/
    AudioEngine.ts                 single AudioContext, unlock, master bus, state events
    Microphone.ts                  ref-counted getUserMedia + AnalyserNode, mapMicError
    pitch/analysis.ts              computeRms, analyzeFrame, MedianSmoother
    pitch/PitchDetector.ts         PitchReading, PitchDetector interface
    pitch/PitchyDetector.ts        rAF loop over the mic analyser
    NotePlayer.ts                  NotePlayer interface
    SynthNotePlayer.ts             reed-ish synth voice
    Metronome.ts                   look-ahead scheduler playing clicks
  ui/
    theme.css                      colour tokens, base element styles, .notice
    App.tsx, App.module.css        providers + header + route switch
    router.ts                      parseHash, useHashRoute
    settings/settings.ts           Settings, defaults, sanitize/load/save
    settings/SettingsContext.tsx   SettingsProvider, useSettings
    hooks/usePitch.ts              mic pitch state for components
    hooks/useNotePlayer.ts         SynthNotePlayer bound to settings.a4
    hooks/useMetronome.ts          Metronome bound to React state
    components/HarmonicaDiagram.tsx (+ .module.css)
    components/AudioGate.tsx (+ .module.css)
    components/Header.tsx (+ .module.css)
    components/KeySelector.tsx
    components/MicErrorNotice.tsx
    pages/HomePage.tsx (+ .module.css)
    pages/tuner/tunerMath.ts       tuneQuality, levelPercent, formatCents
    pages/tuner/TunerReadout.tsx (+ .module.css)
    pages/tuner/LevelMeter.tsx (+ .module.css)
    pages/tuner/TunerPage.tsx (+ .module.css)
    pages/metronome/MetronomePage.tsx (+ .module.css)
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc`, `index.html`, `src/main.tsx`, `src/test/setup.ts`, `src/ui/theme.css`, `src/ui/App.tsx`, `src/ui/App.test.tsx`
- Modify: `.githooks/pre-commit` (line 11)

**Interfaces:**
- Consumes: nothing
- Produces: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run usage:self`; `App` component exported from `src/ui/App.tsx`; CSS variables listed in `theme.css`; a global `.notice` class.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "harp-tools",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc",
    "lint": "eslint .",
    "format": "prettier --write .",
    "usage:self": "bun run scripts/usage-self.ts"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install react@^19 react-dom@^19 pitchy
npm install -D vite @vitejs/plugin-react typescript vitest jsdom \
  @testing-library/react @testing-library/dom @testing-library/jest-dom \
  @types/react@^19 @types/react-dom@^19 \
  eslint @eslint/js typescript-eslint eslint-plugin-react-hooks globals prettier
```

Expected: installs complete; `package.json` gains `dependencies` and `devDependencies`.

- [ ] **Step 3: Create config files**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`vite.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative base + hash routing: the build works from any sub-path (GitHub Pages or own server).
  base: './',
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
})
```

`eslint.config.js`:

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'scripts', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
)
```

`.prettierrc`:

```json
{ "semi": false, "singleQuote": true, "printWidth": 100 }
```

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#14161a" />
    <title>Harp Tools</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())
```

- [ ] **Step 4: Create the theme**

`src/ui/theme.css`:

```css
:root {
  color-scheme: dark;
  --bg: #14161a;
  --surface: #1d2026;
  --surface-2: #262a32;
  --border: #353a44;
  --text: #e8eaed;
  --text-dim: #9aa0aa;
  --accent: #f0b429;

  /* Technique colours — one per technique family */
  --c-blow: #6b7280;
  --c-draw: #4b5260;
  --c-bend: #e0a526;
  --c-overblow: #2bb3a3;
  --c-overdraw: #9b6be0;

  --ok: #3ecf6e;
  --warn: #f0b429;
  --bad: #ef5350;
  --target: #4da3ff;

  --radius: 8px;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.5;
  background: var(--bg);
  color: var(--text);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg);
}

a {
  color: var(--accent);
}

button,
select,
input {
  font: inherit;
  color: inherit;
}

button {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.5rem 1rem;
  cursor: pointer;
}

button:hover {
  border-color: var(--text-dim);
}

button[aria-pressed='true'] {
  background: var(--accent);
  border-color: var(--accent);
  color: #111;
}

select {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.4rem 0.6rem;
}

.notice {
  border: 1px solid var(--bad);
  background: color-mix(in srgb, var(--bad) 12%, var(--surface));
  border-radius: var(--radius);
  padding: 0.75rem 1rem;
  margin: 1rem 0;
}
```

- [ ] **Step 5: Write the failing smoke test**

`src/ui/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('renders the site name', () => {
    render(<App />)
    expect(screen.getByText(/Harp Tools/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/ui/App.test.tsx`
Expected: FAIL — cannot resolve `./App`.

- [ ] **Step 7: Create the minimal app and entry point**

`src/ui/App.tsx`:

```tsx
export function App() {
  return <h1>Harp Tools</h1>
}
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './ui/App'
import './ui/theme.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 8: Run the full check suite**

Run: `npm test && npm run lint && npm run typecheck && npm run build`
Expected: 1 test passes; lint and typecheck clean; `dist/index.html` exists with relative `./assets/...` URLs.

- [ ] **Step 9: Point the pre-commit hook at the npm script**

`package.json` now defines `usage:self`, so in `.githooks/pre-commit` change

```sh
bun run --silent scripts/usage-self.ts || exit 0       # never block a commit on this
```

to

```sh
bun run --silent usage:self || exit 0       # never block a commit on this
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TypeScript project"
```

---

### Task 2: Pitch maths and note names

**Files:**
- Create: `src/core/music/pitch.ts`, `src/core/music/noteNames.ts`
- Test: `src/core/music/pitch.test.ts`, `src/core/music/noteNames.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `midiToFreq(midi: number, a4?: number): number`
  - `freqToMidi(freq: number, a4?: number): { midi: number; cents: number }`
  - `centsOff(freq: number, midi: number, a4?: number): number`
  - `type Spelling = 'sharp' | 'flat'`
  - `noteName(midi: number, spelling?: Spelling): string` (e.g. `'C#4'`)

- [ ] **Step 1: Write the failing tests**

`src/core/music/pitch.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { centsOff, freqToMidi, midiToFreq } from './pitch'

describe('midiToFreq', () => {
  it('maps A4 (69) to the reference', () => {
    expect(midiToFreq(69)).toBe(440)
    expect(midiToFreq(69, 442)).toBe(442)
  })
  it('maps middle C', () => {
    expect(midiToFreq(60)).toBeCloseTo(261.6256, 3)
  })
  it('doubles per octave', () => {
    expect(midiToFreq(81)).toBeCloseTo(880, 6)
  })
})

describe('freqToMidi', () => {
  it('finds exact notes with ~0 cents', () => {
    const r = freqToMidi(440)
    expect(r.midi).toBe(69)
    expect(r.cents).toBeCloseTo(0, 6)
  })
  it('reports sharp and flat deviation', () => {
    expect(freqToMidi(445).cents).toBeCloseTo(19.56, 1)
    const flat = freqToMidi(midiToFreq(64) * 2 ** (-30 / 1200))
    expect(flat.midi).toBe(64)
    expect(flat.cents).toBeCloseTo(-30, 6)
  })
  it('rounds to the nearest note near the ±50 cent boundary', () => {
    const r = freqToMidi(440 * 2 ** (49 / 1200))
    expect(r.midi).toBe(69)
    expect(r.cents).toBeCloseTo(49, 6)
  })
  it('honours a custom A4', () => {
    const r = freqToMidi(442, 442)
    expect(r.midi).toBe(69)
    expect(r.cents).toBeCloseTo(0, 6)
  })
})

describe('centsOff', () => {
  it('measures distance to an arbitrary target note', () => {
    expect(centsOff(440, 67)).toBeCloseTo(200, 6)
  })
})
```

`src/core/music/noteNames.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { noteName } from './noteNames'

describe('noteName', () => {
  it('names natural notes with octave numbers', () => {
    expect(noteName(60)).toBe('C4')
    expect(noteName(55)).toBe('G3')
    expect(noteName(59)).toBe('B3')
    expect(noteName(96)).toBe('C7')
  })
  it('uses sharps by default and flats on request', () => {
    expect(noteName(61)).toBe('C#4')
    expect(noteName(61, 'flat')).toBe('Db4')
    expect(noteName(70, 'flat')).toBe('Bb4')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/music`
Expected: FAIL — modules `./pitch` and `./noteNames` not found.

- [ ] **Step 3: Implement**

`src/core/music/pitch.ts`:

```ts
const A4_MIDI = 69

export function midiToFreq(midi: number, a4 = 440): number {
  return a4 * 2 ** ((midi - A4_MIDI) / 12)
}

/** Nearest MIDI note to `freq`, plus how far off it is in cents (−50…+50). */
export function freqToMidi(freq: number, a4 = 440): { midi: number; cents: number } {
  const exact = A4_MIDI + 12 * Math.log2(freq / a4)
  const midi = Math.round(exact)
  return { midi, cents: (exact - midi) * 100 }
}

export function centsOff(freq: number, midi: number, a4 = 440): number {
  return 1200 * Math.log2(freq / midiToFreq(midi, a4))
}
```

`src/core/music/noteNames.ts`:

```ts
export type Spelling = 'sharp' | 'flat'

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

export function noteName(midi: number, spelling: Spelling = 'sharp'): string {
  const pitchClass = ((midi % 12) + 12) % 12
  const octave = Math.floor(midi / 12) - 1
  return (spelling === 'flat' ? FLAT_NAMES : SHARP_NAMES)[pitchClass] + octave
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/core/music`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/music
git commit -m "feat(core): pitch maths and note names"
```

---

### Task 3: Richter harmonica model (all 12 keys)

**Files:**
- Create: `src/core/harmonica/keys.ts`, `src/core/harmonica/harp.ts`
- Test: `src/core/harmonica/keys.test.ts`, `src/core/harmonica/harp.test.ts`

**Interfaces:**
- Consumes: `Spelling` from `src/core/music/noteNames.ts`
- Produces:
  - `HARP_KEYS: readonly ['G','Ab','A','Bb','B','C','Db','D','Eb','E','F','F#']`, `type HarpKey`
  - `keyOffset(key: HarpKey): number` (semitones from a C harp; G = −5 … F# = +6)
  - `keySpelling(key: HarpKey): Spelling`
  - `type Hole = 1|2|3|4|5|6|7|8|9|10`
  - `type Technique = 'blow'|'draw'|'drawBend'|'blowBend'|'overblow'|'overdraw'`
  - `type BendSteps = 0|1|2|3`
  - `interface HarpNote { readonly hole: Hole; readonly technique: Technique; readonly bendSteps: BendSteps; readonly midi: number; readonly common: boolean }`
  - `buildHarp(key: HarpKey): HarpNote[]`
  - `findNotes(harp: readonly HarpNote[], midi: number): HarpNote[]`
  - `tabLabel(note: HarpNote): string`
  - `noteId(note: HarpNote): string` — key-independent id such as `'3:drawBend:2'`

- [ ] **Step 1: Write the failing tests**

`src/core/harmonica/keys.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { HARP_KEYS, keyOffset, keySpelling } from './keys'

describe('harp keys', () => {
  it('lists all 12 keys from lowest to highest', () => {
    expect(HARP_KEYS).toEqual(['G', 'Ab', 'A', 'Bb', 'B', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#'])
  })
  it('pitches G–B below C and Db–F# above C', () => {
    expect(keyOffset('G')).toBe(-5)
    expect(keyOffset('B')).toBe(-1)
    expect(keyOffset('C')).toBe(0)
    expect(keyOffset('Db')).toBe(1)
    expect(keyOffset('F#')).toBe(6)
  })
  it('spells flat keys with flats and the rest with sharps', () => {
    for (const k of ['F', 'Bb', 'Eb', 'Ab', 'Db'] as const) expect(keySpelling(k)).toBe('flat')
    for (const k of ['C', 'G', 'D', 'A', 'E', 'B', 'F#'] as const) expect(keySpelling(k)).toBe('sharp')
  })
})
```

`src/core/harmonica/harp.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildHarp, findNotes, noteId, tabLabel, type HarpNote, type Technique } from './harp'
import { HARP_KEYS } from './keys'

const c = buildHarp('C')
const get = (harp: HarpNote[], hole: number, technique: Technique, bendSteps = 0) => {
  const n = harp.find((x) => x.hole === hole && x.technique === technique && x.bendSteps === bendSteps)
  if (!n) throw new Error(`missing ${hole} ${technique} ${bendSteps}`)
  return n
}

describe('buildHarp — C Richter', () => {
  it('has the standard blow and draw notes', () => {
    const blow = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((h) => get(c, h, 'blow').midi)
    const draw = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((h) => get(c, h, 'draw').midi)
    expect(blow).toEqual([60, 64, 67, 72, 76, 79, 84, 88, 91, 96])
    expect(draw).toEqual([62, 67, 71, 74, 77, 81, 83, 86, 89, 93])
  })

  it('derives draw bends on holes 1, 2, 3, 4, 6', () => {
    const bends = c.filter((n) => n.technique === 'drawBend')
    expect(bends.map((n) => [n.hole, n.bendSteps, n.midi])).toEqual([
      [1, 1, 61],
      [2, 1, 66],
      [2, 2, 65],
      [3, 1, 70],
      [3, 2, 69],
      [3, 3, 68],
      [4, 1, 73],
      [6, 1, 80],
    ])
  })

  it('derives blow bends on holes 8, 9, 10', () => {
    const bends = c.filter((n) => n.technique === 'blowBend')
    expect(bends.map((n) => [n.hole, n.bendSteps, n.midi])).toEqual([
      [8, 1, 87],
      [9, 1, 90],
      [10, 1, 95],
      [10, 2, 94],
    ])
  })

  it('puts overblows a semitone above the draw note on holes 1–6', () => {
    const ob = c.filter((n) => n.technique === 'overblow')
    expect(ob.map((n) => [n.hole, n.midi, n.common])).toEqual([
      [1, 63, true],
      [2, 68, false],
      [3, 72, false],
      [4, 75, true],
      [5, 78, true],
      [6, 82, true],
    ])
  })

  it('puts overdraws a semitone above the blow note on holes 7–10', () => {
    const od = c.filter((n) => n.technique === 'overdraw')
    expect(od.map((n) => [n.hole, n.midi, n.common])).toEqual([
      [7, 85, true],
      [8, 89, false],
      [9, 92, true],
      [10, 97, true],
    ])
  })

  it('has no bends on holes 5 and 7', () => {
    expect(c.filter((n) => (n.hole === 5 || n.hole === 7) && n.bendSteps > 0)).toEqual([])
  })

  it('has 42 notes in total', () => {
    expect(c).toHaveLength(42)
  })
})

describe('buildHarp — other keys', () => {
  it('transposes every key by its offset', () => {
    expect(get(buildHarp('G'), 1, 'blow').midi).toBe(55)
    expect(get(buildHarp('A'), 1, 'blow').midi).toBe(57)
    expect(get(buildHarp('D'), 4, 'draw').midi).toBe(76)
    expect(get(buildHarp('F#'), 10, 'overdraw').midi).toBe(103)
  })
  it('keeps the same 42-note shape in every key', () => {
    for (const key of HARP_KEYS) expect(buildHarp(key)).toHaveLength(42)
  })
})

describe('findNotes', () => {
  it('returns every hole that produces a pitch', () => {
    const g4 = findNotes(c, 67).map(tabLabel)
    expect(g4.sort()).toEqual(['-2', '3'])
  })
  it('returns [] for pitches not on the harp', () => {
    expect(findNotes(c, 59)).toEqual([])
  })
})

describe('tabLabel', () => {
  it('uses standard tab notation', () => {
    expect(tabLabel(get(c, 4, 'blow'))).toBe('4')
    expect(tabLabel(get(c, 4, 'draw'))).toBe('-4')
    expect(tabLabel(get(c, 3, 'drawBend', 2))).toBe("-3''")
    expect(tabLabel(get(c, 10, 'blowBend', 2))).toBe("10''")
    expect(tabLabel(get(c, 6, 'overblow'))).toBe('6o')
    expect(tabLabel(get(c, 7, 'overdraw'))).toBe('7od')
  })
})

describe('noteId', () => {
  it('is unique within a harp and the same across keys', () => {
    const ids = c.map(noteId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(buildHarp('A').map(noteId)).toEqual(ids)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/harmonica`
Expected: FAIL — modules `./keys` and `./harp` not found.

- [ ] **Step 3: Implement**

`src/core/harmonica/keys.ts`:

```ts
import type { Spelling } from '../music/noteNames'

/** Lowest to highest: G–B harps are pitched below C, Db–F# above. */
export const HARP_KEYS = ['G', 'Ab', 'A', 'Bb', 'B', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#'] as const
export type HarpKey = (typeof HARP_KEYS)[number]

const OFFSETS: Record<HarpKey, number> = {
  G: -5, Ab: -4, A: -3, Bb: -2, B: -1, C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6,
}

const FLAT_KEYS: ReadonlySet<HarpKey> = new Set<HarpKey>(['F', 'Bb', 'Eb', 'Ab', 'Db'])

/** Semitones between this key's harp and a C harp. */
export function keyOffset(key: HarpKey): number {
  return OFFSETS[key]
}

export function keySpelling(key: HarpKey): Spelling {
  return FLAT_KEYS.has(key) ? 'flat' : 'sharp'
}
```

`src/core/harmonica/harp.ts`:

```ts
import { keyOffset, type HarpKey } from './keys'

export type Hole = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
export type Technique = 'blow' | 'draw' | 'drawBend' | 'blowBend' | 'overblow' | 'overdraw'
export type BendSteps = 0 | 1 | 2 | 3

export interface HarpNote {
  readonly hole: Hole
  readonly technique: Technique
  /** Semitones bent below the unbent note; 0 for anything that isn't a bend. */
  readonly bendSteps: BendSteps
  readonly midi: number
  /** False for over-notes most harps can't play reliably ("advanced"). */
  readonly common: boolean
}

// Standard Richter C harmonica, holes 1–10, as MIDI numbers. Other keys transpose this.
const C_BLOW = [60, 64, 67, 72, 76, 79, 84, 88, 91, 96]
const C_DRAW = [62, 67, 71, 74, 77, 81, 83, 86, 89, 93]

const COMMON_OVERBLOWS: ReadonlySet<number> = new Set([1, 4, 5, 6])
const COMMON_OVERDRAWS: ReadonlySet<number> = new Set([7, 9, 10])

export function buildHarp(key: HarpKey): HarpNote[] {
  const offset = keyOffset(key)
  const notes: HarpNote[] = []
  for (let i = 0; i < 10; i++) {
    const hole = (i + 1) as Hole
    const blow = C_BLOW[i] + offset
    const draw = C_DRAW[i] + offset
    notes.push({ hole, technique: 'blow', bendSteps: 0, midi: blow, common: true })
    notes.push({ hole, technique: 'draw', bendSteps: 0, midi: draw, common: true })

    // Bends pull the higher reed down, one semitone per step, stopping short of the lower
    // reed. Over-notes sound a semitone above the higher reed.
    const gap = Math.abs(draw - blow)
    if (draw > blow) {
      for (let s = 1; s < gap; s++) {
        notes.push({ hole, technique: 'drawBend', bendSteps: s as BendSteps, midi: draw - s, common: true })
      }
      notes.push({ hole, technique: 'overblow', bendSteps: 0, midi: draw + 1, common: COMMON_OVERBLOWS.has(hole) })
    } else {
      for (let s = 1; s < gap; s++) {
        notes.push({ hole, technique: 'blowBend', bendSteps: s as BendSteps, midi: blow - s, common: true })
      }
      notes.push({ hole, technique: 'overdraw', bendSteps: 0, midi: blow + 1, common: COMMON_OVERDRAWS.has(hole) })
    }
  }
  return notes
}

export function findNotes(harp: readonly HarpNote[], midi: number): HarpNote[] {
  return harp.filter((n) => n.midi === midi)
}

export function tabLabel(note: HarpNote): string {
  const ticks = "'".repeat(note.bendSteps)
  switch (note.technique) {
    case 'blow':
      return `${note.hole}`
    case 'draw':
      return `-${note.hole}`
    case 'drawBend':
      return `-${note.hole}${ticks}`
    case 'blowBend':
      return `${note.hole}${ticks}`
    case 'overblow':
      return `${note.hole}o`
    case 'overdraw':
      return `${note.hole}od`
  }
}

export function noteId(note: HarpNote): string {
  return `${note.hole}:${note.technique}:${note.bendSteps}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/core/harmonica`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/harmonica
git commit -m "feat(core): Richter harmonica model for all 12 keys"
```

---

### Task 4: Harmonica chart layout

**Files:**
- Create: `src/core/harmonica/layout.ts`
- Test: `src/core/harmonica/layout.test.ts`

**Interfaces:**
- Consumes: `HarpNote`, `Hole`, `buildHarp` from `./harp`
- Produces:
  - `interface DiagramRow { id: string; label: string; cells: (HarpNote | null)[] }` — `cells` always has 10 entries, index 0 = hole 1
  - `interface DiagramLayout { above: DiagramRow[]; below: DiagramRow[] }` — `above` is ordered top→down ending with the blow row; `below` is ordered top→down starting with the draw row. Row ids: `overblow`, `blowBend-N`, `blow`, `draw`, `drawBend-N`, `overdraw`.
  - `diagramLayout(harp: readonly HarpNote[], showAdvanced: boolean): DiagramLayout`

- [ ] **Step 1: Write the failing test**

`src/core/harmonica/layout.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildHarp } from './harp'
import { diagramLayout } from './layout'

const c = buildHarp('C')
const midis = (cells: ({ midi: number } | null)[]) => cells.map((n) => n?.midi ?? null)

describe('diagramLayout', () => {
  it('stacks rows outward from the hole numbers, deepest bends furthest out', () => {
    const { above, below } = diagramLayout(c, false)
    expect(above.map((r) => r.id)).toEqual(['overblow', 'blowBend-2', 'blowBend-1', 'blow'])
    expect(below.map((r) => r.id)).toEqual([
      'draw',
      'drawBend-1',
      'drawBend-2',
      'drawBend-3',
      'overdraw',
    ])
  })

  it('always has 10 cells per row, aligned by hole', () => {
    const { above, below } = diagramLayout(c, true)
    for (const row of [...above, ...below]) expect(row.cells).toHaveLength(10)
    const blowBend2 = above.find((r) => r.id === 'blowBend-2')!
    expect(midis(blowBend2.cells)).toEqual([null, null, null, null, null, null, null, null, null, 94])
    const drawBend3 = below.find((r) => r.id === 'drawBend-3')!
    expect(midis(drawBend3.cells)).toEqual([null, null, 68, null, null, null, null, null, null, null])
  })

  it('hides advanced over-notes unless requested', () => {
    const hidden = diagramLayout(c, false).above[0]
    expect(midis(hidden.cells)).toEqual([63, null, null, 75, 78, 82, null, null, null, null])
    const shown = diagramLayout(c, true).above[0]
    expect(midis(shown.cells)).toEqual([63, 68, 72, 75, 78, 82, null, null, null, null])
    const overdraw = diagramLayout(c, false).below.at(-1)!
    expect(midis(overdraw.cells)).toEqual([null, null, null, null, null, null, 85, null, 92, 97])
  })

  it('labels rows for display', () => {
    const { above, below } = diagramLayout(c, false)
    expect(above.map((r) => r.label)).toEqual(['Overblow', "Blow bend ''", "Blow bend '", 'Blow'])
    expect(below.map((r) => r.label)).toEqual([
      'Draw',
      "Draw bend '",
      "Draw bend ''",
      "Draw bend '''",
      'Overdraw',
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/harmonica/layout.test.ts`
Expected: FAIL — module `./layout` not found.

- [ ] **Step 3: Implement**

`src/core/harmonica/layout.ts`:

```ts
import type { HarpNote, Hole, Technique } from './harp'

export interface DiagramRow {
  id: string
  label: string
  /** 10 entries, index 0 = hole 1; null where this row has no note for that hole. */
  cells: (HarpNote | null)[]
}

export interface DiagramLayout {
  /** Top to bottom, ending with the blow row (just above the hole numbers). */
  above: DiagramRow[]
  /** Top to bottom, starting with the draw row (just below the hole numbers). */
  below: DiagramRow[]
}

const HOLES: Hole[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export function diagramLayout(harp: readonly HarpNote[], showAdvanced: boolean): DiagramLayout {
  const visible = harp.filter((n) => showAdvanced || n.common)

  const row = (id: string, label: string, technique: Technique, bendSteps = 0): DiagramRow => ({
    id,
    label,
    cells: HOLES.map(
      (hole) =>
        visible.find((n) => n.hole === hole && n.technique === technique && n.bendSteps === bendSteps) ??
        null,
    ),
  })

  const maxSteps = (technique: Technique) =>
    Math.max(0, ...visible.filter((n) => n.technique === technique).map((n) => n.bendSteps))

  const bendRow = (technique: 'blowBend' | 'drawBend', steps: number) =>
    row(
      `${technique}-${steps}`,
      `${technique === 'blowBend' ? 'Blow' : 'Draw'} bend ${"'".repeat(steps)}`,
      technique,
      steps,
    )

  const blowBends: DiagramRow[] = []
  for (let s = maxSteps('blowBend'); s >= 1; s--) blowBends.push(bendRow('blowBend', s))
  const drawBends: DiagramRow[] = []
  for (let s = 1; s <= maxSteps('drawBend'); s++) drawBends.push(bendRow('drawBend', s))

  const nonEmpty = (r: DiagramRow) => r.cells.some((c) => c !== null)
  return {
    above: [row('overblow', 'Overblow', 'overblow'), ...blowBends, row('blow', 'Blow', 'blow')].filter(nonEmpty),
    below: [row('draw', 'Draw', 'draw'), ...drawBends, row('overdraw', 'Overdraw', 'overdraw')].filter(nonEmpty),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/harmonica/layout.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/harmonica/layout.ts src/core/harmonica/layout.test.ts
git commit -m "feat(core): harmonica chart row layout"
```

---

### Task 5: Rhythm core — click scheduling and tap tempo

**Files:**
- Create: `src/core/rhythm/schedule.ts`, `src/core/rhythm/tempo.ts`
- Test: `src/core/rhythm/schedule.test.ts`, `src/core/rhythm/tempo.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `interface TimeSignature { label: string; beats: number; unit: 4 | 8 }`
  - `TIME_SIGNATURES: readonly TimeSignature[]` — `2/4, 3/4, 4/4, 6/8, 12/8` in that order (index 2 = 4/4)
  - `type Subdivision = 1 | 2 | 3 | 4`
  - `interface MetronomeConfig { bpm: number; signature: TimeSignature; subdivision: Subdivision }`
  - `type ClickKind = 'bar' | 'group' | 'beat' | 'sub'`
  - `interface Click { time: number; kind: ClickKind; pulse: number }`
  - `interface SchedulerState { nextTime: number; pulse: number; sub: number }`
  - `accentKind(pulse: number, signature: TimeSignature): Exclude<ClickKind, 'sub'>`
  - `scheduleAhead(state: SchedulerState, config: MetronomeConfig, now: number, lookahead: number): { clicks: Click[]; state: SchedulerState }`
  - `BPM_MIN = 30`, `BPM_MAX = 250`, `clampBpm(bpm: number): number`
  - `class TapTempo { tap(nowMs: number): number | null }`

- [ ] **Step 1: Write the failing tests**

`src/core/rhythm/schedule.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  TIME_SIGNATURES,
  accentKind,
  scheduleAhead,
  type MetronomeConfig,
  type SchedulerState,
} from './schedule'

const sig = (label: string) => TIME_SIGNATURES.find((s) => s.label === label)!
const cfg = (bpm: number, label = '4/4', subdivision: MetronomeConfig['subdivision'] = 1) => ({
  bpm,
  signature: sig(label),
  subdivision,
})
const start: SchedulerState = { nextTime: 0, pulse: 0, sub: 0 }

describe('accentKind', () => {
  it('accents the downbeat and the dotted-quarter groups in compound time', () => {
    expect([0, 1, 2, 3].map((p) => accentKind(p, sig('4/4')))).toEqual(['bar', 'beat', 'beat', 'beat'])
    expect([0, 1, 2, 3, 4, 5].map((p) => accentKind(p, sig('6/8')))).toEqual([
      'bar', 'beat', 'beat', 'group', 'beat', 'beat',
    ])
  })
})

describe('scheduleAhead', () => {
  it('schedules every click inside the look-ahead window', () => {
    const { clicks, state } = scheduleAhead(start, cfg(120), 0, 2)
    expect(clicks.map((c) => c.time)).toEqual([0, 0.5, 1, 1.5])
    expect(clicks.map((c) => c.kind)).toEqual(['bar', 'beat', 'beat', 'beat'])
    expect(state).toEqual({ nextTime: 2, pulse: 0, sub: 0 })
  })

  it('continues seamlessly across calls', () => {
    const first = scheduleAhead(start, cfg(120), 0, 2)
    const { clicks } = scheduleAhead(first.state, cfg(120), 2, 1)
    expect(clicks.map((c) => [c.time, c.kind])).toEqual([
      [2, 'bar'],
      [2.5, 'beat'],
    ])
  })

  it('adds quieter subdivision clicks between beats', () => {
    const eighths = scheduleAhead(start, cfg(60, '4/4', 2), 0, 1).clicks
    expect(eighths.map((c) => [c.time, c.kind])).toEqual([
      [0, 'bar'],
      [0.5, 'sub'],
    ])
    const triplets = scheduleAhead(start, cfg(60, '4/4', 3), 0, 0.9).clicks
    expect(triplets.map((c) => c.kind)).toEqual(['bar', 'sub', 'sub'])
    expect(triplets[1].time).toBeCloseTo(1 / 3, 9)
  })

  it('applies a BPM change from the next click on', () => {
    const fast = scheduleAhead(start, cfg(120), 0, 1)
    const slow = scheduleAhead(fast.state, cfg(60), 1, 2).clicks
    expect(slow.map((c) => c.time)).toEqual([1, 2])
  })

  it('skips missed clicks instead of bursting after the timer was throttled', () => {
    const behind: SchedulerState = { nextTime: 1, pulse: 1, sub: 0 }
    const { clicks } = scheduleAhead(behind, cfg(120), 5, 0.1)
    expect(clicks).toHaveLength(1)
    expect(clicks[0].time).toBeGreaterThanOrEqual(5)
  })

  it('wraps the pulse when the time signature shrinks mid-run', () => {
    const state: SchedulerState = { nextTime: 0, pulse: 3, sub: 0 }
    const { clicks } = scheduleAhead(state, cfg(120, '3/4'), 0, 0.1)
    expect(clicks[0]).toMatchObject({ pulse: 0, kind: 'bar' })
  })
})
```

`src/core/rhythm/tempo.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { TapTempo, clampBpm } from './tempo'

describe('clampBpm', () => {
  it('rounds and clamps to 30–250', () => {
    expect(clampBpm(10)).toBe(30)
    expect(clampBpm(300)).toBe(250)
    expect(clampBpm(99.6)).toBe(100)
  })
})

describe('TapTempo', () => {
  it('needs two taps before reporting', () => {
    const t = new TapTempo()
    expect(t.tap(0)).toBeNull()
    expect(t.tap(500)).toBe(120)
  })
  it('averages the last 4 taps', () => {
    const t = new TapTempo()
    // All five taps would average 550 ms (109 BPM); the last four average 500 ms.
    ;[0, 700, 1200, 1700].forEach((ms) => t.tap(ms))
    expect(t.tap(2200)).toBe(120)
  })
  it('starts over after a long pause', () => {
    const t = new TapTempo()
    t.tap(0)
    t.tap(500)
    expect(t.tap(5000)).toBeNull()
  })
  it('clamps extreme tapping', () => {
    const t = new TapTempo()
    t.tap(0)
    expect(t.tap(100)).toBe(250)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/rhythm`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/core/rhythm/schedule.ts`:

```ts
export interface TimeSignature {
  label: string
  beats: number
  unit: 4 | 8
}

export const TIME_SIGNATURES: readonly TimeSignature[] = [
  { label: '2/4', beats: 2, unit: 4 },
  { label: '3/4', beats: 3, unit: 4 },
  { label: '4/4', beats: 4, unit: 4 },
  { label: '6/8', beats: 6, unit: 8 },
  { label: '12/8', beats: 12, unit: 8 },
]

export type Subdivision = 1 | 2 | 3 | 4

export interface MetronomeConfig {
  /** Pulses per minute of the signature's unit (quarters in x/4, eighths in x/8). */
  bpm: number
  signature: TimeSignature
  subdivision: Subdivision
}

export type ClickKind = 'bar' | 'group' | 'beat' | 'sub'

export interface Click {
  /** AudioContext time in seconds. */
  time: number
  kind: ClickKind
  /** Pulse index within the bar. */
  pulse: number
}

export interface SchedulerState {
  nextTime: number
  pulse: number
  sub: number
}

export function accentKind(pulse: number, signature: TimeSignature): Exclude<ClickKind, 'sub'> {
  if (pulse === 0) return 'bar'
  // Compound time (6/8, 12/8) groups eighths in threes.
  if (signature.unit === 8 && pulse % 3 === 0) return 'group'
  return 'beat'
}

/** Clicks falling in [now, now + lookahead), plus the state to resume from next time. */
export function scheduleAhead(
  state: SchedulerState,
  config: MetronomeConfig,
  now: number,
  lookahead: number,
): { clicks: Click[]; state: SchedulerState } {
  let { nextTime, pulse, sub } = state
  const { beats } = config.signature

  // A throttled timer (background tab) can leave us behind: skip the missed clicks rather
  // than firing them all at once.
  if (nextTime < now) nextTime = now
  // The signature or subdivision may have shrunk since the last call.
  if (sub >= config.subdivision) {
    sub = 0
    pulse += 1
  }
  pulse %= beats

  const step = 60 / config.bpm / config.subdivision
  const clicks: Click[] = []
  while (nextTime < now + lookahead) {
    clicks.push({ time: nextTime, kind: sub === 0 ? accentKind(pulse, config.signature) : 'sub', pulse })
    sub += 1
    if (sub >= config.subdivision) {
      sub = 0
      pulse = (pulse + 1) % beats
    }
    nextTime += step
  }
  return { clicks, state: { nextTime, pulse, sub } }
}
```

`src/core/rhythm/tempo.ts`:

```ts
export const BPM_MIN = 30
export const BPM_MAX = 250

export function clampBpm(bpm: number): number {
  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(bpm)))
}

/** Tap tempo over the last `window` taps; a pause longer than `maxGapMs` starts over. */
export class TapTempo {
  private taps: number[] = []

  constructor(
    private readonly maxGapMs = 2000,
    private readonly window = 4,
  ) {}

  tap(nowMs: number): number | null {
    const last = this.taps.at(-1)
    if (last !== undefined && nowMs - last > this.maxGapMs) this.taps = []
    this.taps.push(nowMs)
    if (this.taps.length > this.window) this.taps.shift()
    if (this.taps.length < 2) return null
    const avgMs = (nowMs - this.taps[0]) / (this.taps.length - 1)
    return clampBpm(60000 / avgMs)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/core/rhythm`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/rhythm
git commit -m "feat(core): metronome click scheduling and tap tempo"
```

---

### Task 6: Settings (persisted to localStorage)

**Files:**
- Create: `src/ui/settings/settings.ts`, `src/ui/settings/SettingsContext.tsx`
- Test: `src/ui/settings/settings.test.ts`, `src/ui/settings/SettingsContext.test.tsx`

**Interfaces:**
- Consumes: `HARP_KEYS`, `HarpKey` (Task 3); `BPM_MIN`, `BPM_MAX` (Task 5)
- Produces:
  - `type LabelMode = 'note' | 'tab'`
  - `interface Settings { key: HarpKey; a4: number; showAdvanced: boolean; labelMode: LabelMode; bpm: number; noiseFloor: number }`
  - `DEFAULT_SETTINGS`, `STORAGE_KEY = 'harp-tools:settings'`, `A4_RANGE = [430, 450]`, `NOISE_FLOOR_RANGE = [0.001, 0.1]`
  - `sanitizeSettings(raw: unknown): Settings`
  - `loadSettings(storage: Pick<Storage, 'getItem'> | null): Settings`
  - `saveSettings(storage: Pick<Storage, 'setItem'> | null, settings: Settings): void`
  - `browserStorage(): Storage | null`
  - `SettingsProvider({ children, storage? })`, `useSettings(): { settings: Settings; update(patch: Partial<Settings>): void }`

- [ ] **Step 1: Write the failing tests**

`src/ui/settings/settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, STORAGE_KEY, loadSettings, sanitizeSettings, saveSettings } from './settings'

const storageWith = (text: string | null) => ({ getItem: () => text })

describe('loadSettings', () => {
  it('returns defaults without storage or saved data', () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(loadSettings(storageWith(null))).toEqual(DEFAULT_SETTINGS)
  })
  it('returns defaults for corrupt JSON', () => {
    expect(loadSettings(storageWith('{not json'))).toEqual(DEFAULT_SETTINGS)
  })
  it('returns defaults when storage throws (blocked / private mode)', () => {
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError')
      },
    }
    expect(loadSettings(throwing)).toEqual(DEFAULT_SETTINGS)
  })
  it('keeps valid saved fields and repairs invalid ones', () => {
    const saved = JSON.stringify({ key: 'A', a4: 999, showAdvanced: true, labelMode: 'nope', bpm: 120 })
    expect(loadSettings(storageWith(saved))).toEqual({
      ...DEFAULT_SETTINGS,
      key: 'A',
      showAdvanced: true,
      bpm: 120,
    })
  })
})

describe('sanitizeSettings', () => {
  it('rejects unknown keys and out-of-range numbers', () => {
    expect(sanitizeSettings({ key: 'H', bpm: 10, noiseFloor: 5 })).toEqual(DEFAULT_SETTINGS)
    expect(sanitizeSettings('garbage')).toEqual(DEFAULT_SETTINGS)
  })
})

describe('saveSettings', () => {
  it('writes JSON under the storage key', () => {
    const written: Record<string, string> = {}
    saveSettings({ setItem: (k, v) => void (written[k] = v) }, DEFAULT_SETTINGS)
    expect(JSON.parse(written[STORAGE_KEY])).toEqual(DEFAULT_SETTINGS)
  })
  it('swallows storage errors', () => {
    const full = {
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(() => saveSettings(full, DEFAULT_SETTINGS)).not.toThrow()
  })
})
```

`src/ui/settings/SettingsContext.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SettingsProvider, useSettings } from './SettingsContext'
import { STORAGE_KEY } from './settings'

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size
    },
  }
}

function Probe() {
  const { settings, update } = useSettings()
  return <button onClick={() => update({ key: 'A' })}>{settings.key}</button>
}

describe('SettingsProvider', () => {
  it('provides settings and persists updates', () => {
    const storage = memoryStorage()
    render(
      <SettingsProvider storage={storage}>
        <Probe />
      </SettingsProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'C' }))
    expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument()
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).key).toBe('A')
  })

  it('throws a helpful error outside the provider', () => {
    expect(() => render(<Probe />)).toThrow(/SettingsProvider/)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui/settings`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/ui/settings/settings.ts`:

```ts
import { HARP_KEYS, type HarpKey } from '../../core/harmonica/keys'
import { BPM_MAX, BPM_MIN } from '../../core/rhythm/tempo'

export type LabelMode = 'note' | 'tab'

export interface Settings {
  key: HarpKey
  /** Reference pitch for A4 in Hz. */
  a4: number
  /** Show over-notes most harps can't play reliably. */
  showAdvanced: boolean
  labelMode: LabelMode
  bpm: number
  /** Linear RMS below which mic input counts as silence. */
  noiseFloor: number
}

export const DEFAULT_SETTINGS: Settings = {
  key: 'C',
  a4: 440,
  showAdvanced: false,
  labelMode: 'note',
  bpm: 90,
  noiseFloor: 0.01,
}

export const STORAGE_KEY = 'harp-tools:settings'
export const A4_RANGE = [430, 450] as const
export const NOISE_FLOOR_RANGE = [0.001, 0.1] as const

const inRange = (v: unknown, [lo, hi]: readonly [number, number]): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi

/** Coerce anything (e.g. old or hand-edited storage) into valid Settings, field by field. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const d = DEFAULT_SETTINGS
  return {
    key: HARP_KEYS.includes(r.key as HarpKey) ? (r.key as HarpKey) : d.key,
    a4: inRange(r.a4, A4_RANGE) ? r.a4 : d.a4,
    showAdvanced: typeof r.showAdvanced === 'boolean' ? r.showAdvanced : d.showAdvanced,
    labelMode: r.labelMode === 'note' || r.labelMode === 'tab' ? r.labelMode : d.labelMode,
    bpm: inRange(r.bpm, [BPM_MIN, BPM_MAX]) ? r.bpm : d.bpm,
    noiseFloor: inRange(r.noiseFloor, NOISE_FLOOR_RANGE) ? r.noiseFloor : d.noiseFloor,
  }
}

export function loadSettings(storage: Pick<Storage, 'getItem'> | null): Settings {
  try {
    const text = storage?.getItem(STORAGE_KEY)
    return sanitizeSettings(text ? JSON.parse(text) : {})
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(storage: Pick<Storage, 'setItem'> | null, settings: Settings): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Storage full or blocked — settings just won't persist this session.
  }
}

export function browserStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
```

`src/ui/settings/SettingsContext.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { browserStorage, loadSettings, sanitizeSettings, saveSettings, type Settings } from './settings'

interface SettingsApi {
  settings: Settings
  update: (patch: Partial<Settings>) => void
}

const SettingsContext = createContext<SettingsApi | null>(null)

interface Props {
  children: ReactNode
  storage?: Storage | null
}

export function SettingsProvider({ children, storage = browserStorage() }: Props) {
  const [settings, setSettings] = useState(() => loadSettings(storage))

  useEffect(() => saveSettings(storage, settings), [storage, settings])

  const update = useCallback(
    (patch: Partial<Settings>) => setSettings((prev) => sanitizeSettings({ ...prev, ...patch })),
    [],
  )
  const value = useMemo(() => ({ settings, update }), [settings, update])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsApi {
  const api = useContext(SettingsContext)
  if (!api) throw new Error('useSettings must be used inside <SettingsProvider>')
  return api
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/ui/settings`
Expected: PASS. (React logs the expected error for the "outside the provider" test to stderr; that's fine.)

- [ ] **Step 5: Commit**

```bash
git add src/ui/settings
git commit -m "feat(ui): persisted settings with validation"
```

---

### Task 7: HarmonicaDiagram component

**Files:**
- Create: `src/ui/components/HarmonicaDiagram.tsx`, `src/ui/components/HarmonicaDiagram.module.css`
- Test: `src/ui/components/HarmonicaDiagram.test.tsx`

**Interfaces:**
- Consumes: `diagramLayout`, `DiagramRow` (Task 4); `HarpNote`, `noteId`, `tabLabel`, `buildHarp` (Task 3); `noteName`, `Spelling` (Task 2); `LabelMode` (Task 6)
- Produces:
  - `type Highlight = 'detected' | 'target' | 'correct' | 'wrong'`
  - `HarmonicaDiagram(props: { harp: readonly HarpNote[]; spelling: Spelling; labelMode: LabelMode; showAdvanced: boolean; highlights?: ReadonlyMap<string, Highlight>; onNoteDown?: (n: HarpNote) => void; onNoteUp?: (n: HarpNote) => void })` — `highlights` is keyed by `noteId(note)`. Each note is a `<button>` with `aria-label` `"<tab> <name>"` (e.g. `"-3'' A4"`), `data-color` (`blow|draw|bend|overblow|overdraw`), `data-advanced="true"` when `!common`, and `data-highlight` when highlighted. Hole cells have `data-testid="hole-N"`.

- [ ] **Step 1: Write the failing test**

`src/ui/components/HarmonicaDiagram.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { buildHarp, noteId } from '../../core/harmonica/harp'
import { HarmonicaDiagram } from './HarmonicaDiagram'

const harp = buildHarp('C')
type Props = Parameters<typeof HarmonicaDiagram>[0]
const renderDiagram = (props: Partial<Props> = {}) =>
  render(<HarmonicaDiagram harp={harp} spelling="sharp" labelMode="note" showAdvanced={false} {...props} />)

describe('HarmonicaDiagram', () => {
  it('renders the hole numbers', () => {
    renderDiagram()
    for (let h = 1; h <= 10; h++) expect(screen.getByTestId(`hole-${h}`)).toHaveTextContent(String(h))
  })

  it('puts blow notes above the hole numbers and draw notes below', () => {
    renderDiagram()
    const hole1 = screen.getByTestId('hole-1')
    const blow = screen.getByRole('button', { name: '1 C4' })
    const draw = screen.getByRole('button', { name: '-1 D4' })
    expect(hole1.compareDocumentPosition(blow) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    expect(hole1.compareDocumentPosition(draw) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('colour-codes notes by technique', () => {
    renderDiagram()
    expect(screen.getByRole('button', { name: '4 C5' })).toHaveAttribute('data-color', 'blow')
    expect(screen.getByRole('button', { name: '-4 D5' })).toHaveAttribute('data-color', 'draw')
    expect(screen.getByRole('button', { name: "-3'' A4" })).toHaveAttribute('data-color', 'bend')
    expect(screen.getByRole('button', { name: "10'' A#6" })).toHaveAttribute('data-color', 'bend')
    expect(screen.getByRole('button', { name: '6o A#5' })).toHaveAttribute('data-color', 'overblow')
    expect(screen.getByRole('button', { name: '7od C#6' })).toHaveAttribute('data-color', 'overdraw')
  })

  it('hides advanced over-notes unless showAdvanced is on', () => {
    const { rerender } = renderDiagram()
    expect(screen.queryByRole('button', { name: '2o G#4' })).toBeNull()
    rerender(<HarmonicaDiagram harp={harp} spelling="sharp" labelMode="note" showAdvanced />)
    expect(screen.getByRole('button', { name: '2o G#4' })).toHaveAttribute('data-advanced', 'true')
  })

  it('shows tab labels in tab mode', () => {
    renderDiagram({ labelMode: 'tab' })
    expect(screen.getByRole('button', { name: "-3'' A4" })).toHaveTextContent("-3''")
  })

  it('uses flat spelling when asked', () => {
    renderDiagram({ harp: buildHarp('F'), spelling: 'flat' })
    expect(screen.getByRole('button', { name: '4 F5' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '-4 G5' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1 F4' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "-3' Eb5" })).toBeInTheDocument()
  })

  it('applies highlights by note id', () => {
    const c4 = harp.find((n) => n.hole === 1 && n.technique === 'blow')!
    renderDiagram({ highlights: new Map([[noteId(c4), 'detected']]) })
    expect(screen.getByRole('button', { name: '1 C4' })).toHaveAttribute('data-highlight', 'detected')
  })

  it('reports press and release', () => {
    const onNoteDown = vi.fn()
    const onNoteUp = vi.fn()
    renderDiagram({ onNoteDown, onNoteUp })
    const a4 = screen.getByRole('button', { name: "-3'' A4" })
    fireEvent.pointerDown(a4)
    expect(onNoteDown).toHaveBeenCalledWith(expect.objectContaining({ midi: 69 }))
    fireEvent.pointerUp(a4)
    expect(onNoteUp).toHaveBeenCalledWith(expect.objectContaining({ midi: 69 }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/components/HarmonicaDiagram.test.tsx`
Expected: FAIL — module `./HarmonicaDiagram` not found.

- [ ] **Step 3: Implement**

`src/ui/components/HarmonicaDiagram.tsx`:

```tsx
import type { KeyboardEvent, PointerEvent } from 'react'
import { noteId, tabLabel, type HarpNote, type Technique } from '../../core/harmonica/harp'
import { diagramLayout, type DiagramRow } from '../../core/harmonica/layout'
import { noteName, type Spelling } from '../../core/music/noteNames'
import type { LabelMode } from '../settings/settings'
import styles from './HarmonicaDiagram.module.css'

export type Highlight = 'detected' | 'target' | 'correct' | 'wrong'

interface Props {
  harp: readonly HarpNote[]
  spelling: Spelling
  labelMode: LabelMode
  showAdvanced: boolean
  /** Keyed by noteId(note). */
  highlights?: ReadonlyMap<string, Highlight>
  onNoteDown?: (note: HarpNote) => void
  onNoteUp?: (note: HarpNote) => void
}

const COLOR: Record<Technique, string> = {
  blow: 'blow',
  draw: 'draw',
  blowBend: 'bend',
  drawBend: 'bend',
  overblow: 'overblow',
  overdraw: 'overdraw',
}

const LEGEND = [
  ['blow', 'Blow'],
  ['draw', 'Draw'],
  ['bend', 'Bend'],
  ['overblow', 'Overblow'],
  ['overdraw', 'Overdraw'],
] as const

const HOLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export function HarmonicaDiagram({
  harp,
  spelling,
  labelMode,
  showAdvanced,
  highlights,
  onNoteDown,
  onNoteUp,
}: Props) {
  const { above, below } = diagramLayout(harp, showAdvanced)

  const cell = (note: HarpNote | null, rowId: string, i: number) => {
    if (!note) return <div key={`${rowId}-${i}`} />
    const name = noteName(note.midi, spelling)
    const tab = tabLabel(note)
    const isKey = (e: KeyboardEvent) => e.key === 'Enter' || e.key === ' '
    return (
      <button
        key={noteId(note)}
        type="button"
        className={styles.cell}
        data-color={COLOR[note.technique]}
        data-advanced={note.common ? undefined : 'true'}
        data-highlight={highlights?.get(noteId(note))}
        aria-label={`${tab} ${name}`}
        onPointerDown={() => onNoteDown?.(note)}
        onPointerUp={() => onNoteUp?.(note)}
        onPointerLeave={(e: PointerEvent) => e.buttons > 0 && onNoteUp?.(note)}
        onKeyDown={(e) => isKey(e) && !e.repeat && onNoteDown?.(note)}
        onKeyUp={(e) => isKey(e) && onNoteUp?.(note)}
      >
        {labelMode === 'note' ? name : tab}
      </button>
    )
  }

  const row = (r: DiagramRow) => [
    <div key={`${r.id}-label`} className={styles.rowLabel}>
      {r.label}
    </div>,
    ...r.cells.map((n, i) => cell(n, r.id, i)),
  ]

  return (
    <div className={styles.wrap}>
      <div className={styles.grid} role="group" aria-label="Harmonica chart">
        {above.flatMap(row)}
        <div className={styles.rowLabel}>Hole</div>
        {HOLES.map((h) => (
          <div key={`hole-${h}`} className={styles.hole} data-testid={`hole-${h}`}>
            {h}
          </div>
        ))}
        {below.flatMap(row)}
      </div>
      <ul className={styles.legend} aria-label="Legend">
        {LEGEND.map(([color, label]) => (
          <li key={color}>
            <span className={styles.swatch} data-color={color} />
            {label}
          </li>
        ))}
        {showAdvanced && (
          <li>
            <span className={styles.swatch} data-advanced="true" />
            Advanced
          </li>
        )}
      </ul>
    </div>
  )
}
```

`src/ui/components/HarmonicaDiagram.module.css`:

```css
.wrap {
  overflow-x: auto;
  padding-bottom: 0.5rem;
}

.grid {
  display: grid;
  grid-template-columns: minmax(6rem, auto) repeat(10, minmax(2.75rem, 1fr));
  gap: 4px;
  min-width: 38rem;
}

.rowLabel {
  align-self: center;
  padding-right: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-dim);
  white-space: nowrap;
}

.hole {
  padding: 0.35rem 0;
  border-block: 2px solid var(--border);
  text-align: center;
  font-weight: 700;
}

.cell,
.swatch {
  --c: var(--c-blow);
}

[data-color='draw'] {
  --c: var(--c-draw);
}
[data-color='bend'] {
  --c: var(--c-bend);
}
[data-color='overblow'] {
  --c: var(--c-overblow);
}
[data-color='overdraw'] {
  --c: var(--c-overdraw);
}

.cell {
  padding: 0.4rem 0.1rem;
  border: 2px solid var(--c);
  border-radius: 6px;
  background: color-mix(in srgb, var(--c) 28%, var(--surface));
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  touch-action: none;
  user-select: none;
}

.cell[data-advanced] {
  border-style: dashed;
  opacity: 0.55;
}

.cell[data-highlight='detected'] {
  background: var(--c);
  color: #111;
  opacity: 1;
  box-shadow: 0 0 0 3px var(--text);
}

.cell[data-highlight='target'] {
  opacity: 1;
  box-shadow: 0 0 0 3px var(--target);
}

.cell[data-highlight='correct'] {
  background: var(--ok);
  color: #111;
}

.cell[data-highlight='wrong'] {
  background: var(--bad);
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1rem;
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.8rem;
  color: var(--text-dim);
}

.swatch {
  display: inline-block;
  width: 0.8rem;
  height: 0.8rem;
  margin-right: 0.35rem;
  border: 2px solid var(--c);
  border-radius: 3px;
  background: color-mix(in srgb, var(--c) 28%, var(--surface));
  vertical-align: -0.1rem;
}

.swatch[data-advanced] {
  border-style: dashed;
  opacity: 0.55;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/components/HarmonicaDiagram.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/HarmonicaDiagram.tsx src/ui/components/HarmonicaDiagram.module.css src/ui/components/HarmonicaDiagram.test.tsx
git commit -m "feat(ui): colour-coded harmonica chart component"
```

---

### Task 8: AudioEngine and AudioGate

**Files:**
- Create: `src/audio/AudioEngine.ts`, `src/ui/components/AudioGate.tsx`, `src/ui/components/AudioGate.module.css`
- Test: `src/ui/components/AudioGate.test.tsx`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `class AudioEngine { readonly isUnlocked: boolean; readonly ctx: AudioContext; readonly master: GainNode; now(): number; unlock(): Promise<void>; onStateChange(l: () => void): () => void }` — `ctx`/`master` throw before `unlock()`
  - `audioEngine: AudioEngine` (singleton), `isWebAudioSupported(): boolean`
  - `interface UnlockableEngine { readonly isUnlocked: boolean; unlock(): Promise<void>; onStateChange(l: () => void): () => void }`
  - `AudioGate({ children, engine?, supported? })` — renders children only while audio is unlocked

- [ ] **Step 1: Write the failing test**

`src/ui/components/AudioGate.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AudioGate } from './AudioGate'

function fakeEngine() {
  let unlocked = false
  const listeners = new Set<() => void>()
  return {
    get isUnlocked() {
      return unlocked
    },
    unlock: vi.fn(async () => {
      unlocked = true
    }),
    onStateChange(l: () => void) {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
    /** Simulate the browser suspending the context (e.g. iOS interruption). */
    suspend() {
      unlocked = false
      listeners.forEach((l) => l())
    },
  }
}

describe('AudioGate', () => {
  it('asks for a tap before showing audio content', async () => {
    const engine = fakeEngine()
    render(
      <AudioGate engine={engine} supported>
        <p>audio stuff</p>
      </AudioGate>,
    )
    expect(screen.queryByText('audio stuff')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /tap to start/i }))
    expect(await screen.findByText('audio stuff')).toBeInTheDocument()
    expect(engine.unlock).toHaveBeenCalledOnce()
  })

  it('asks again if the browser suspends audio', async () => {
    const engine = fakeEngine()
    await engine.unlock()
    render(
      <AudioGate engine={engine} supported>
        <p>audio stuff</p>
      </AudioGate>,
    )
    expect(screen.getByText('audio stuff')).toBeInTheDocument()
    act(() => engine.suspend())
    expect(screen.getByRole('button', { name: /tap to start/i })).toBeInTheDocument()
  })

  it('explains when Web Audio is not supported', () => {
    render(
      <AudioGate engine={fakeEngine()} supported={false}>
        <p>audio stuff</p>
      </AudioGate>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/Web Audio/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/components/AudioGate.test.tsx`
Expected: FAIL — module `./AudioGate` not found.

- [ ] **Step 3: Implement**

`src/audio/AudioEngine.ts`:

```ts
type Listener = () => void

/** Owns the app's single AudioContext. Browsers only allow starting it from a user gesture. */
export class AudioEngine {
  private context: AudioContext | null = null
  private output: GainNode | null = null
  private listeners = new Set<Listener>()

  get isUnlocked(): boolean {
    return this.context?.state === 'running'
  }

  get ctx(): AudioContext {
    if (!this.context) throw new Error('AudioEngine used before unlock()')
    return this.context
  }

  /** Everything audible connects here. */
  get master(): GainNode {
    if (!this.output) throw new Error('AudioEngine used before unlock()')
    return this.output
  }

  now(): number {
    return this.ctx.currentTime
  }

  /** Call from a user gesture (click/tap). Safe to call repeatedly. */
  async unlock(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: 'interactive' })
      this.output = this.context.createGain()
      this.output.connect(this.context.destination)
      this.context.addEventListener('statechange', () => this.listeners.forEach((l) => l()))
    }
    if (this.context.state !== 'running') await this.context.resume()
  }

  onStateChange(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}

export const audioEngine = new AudioEngine()

export function isWebAudioSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.AudioContext === 'function'
}
```

`src/ui/components/AudioGate.tsx`:

```tsx
import { useEffect, useState, type ReactNode } from 'react'
import { audioEngine, isWebAudioSupported } from '../../audio/AudioEngine'
import styles from './AudioGate.module.css'

export interface UnlockableEngine {
  readonly isUnlocked: boolean
  unlock(): Promise<void>
  onStateChange(listener: () => void): () => void
}

interface Props {
  children: ReactNode
  engine?: UnlockableEngine
  supported?: boolean
}

/** Renders its children only once audio is running; otherwise shows a "tap to start" button. */
export function AudioGate({ children, engine = audioEngine, supported = isWebAudioSupported() }: Props) {
  const [unlocked, setUnlocked] = useState(() => engine.isUnlocked)
  const [failed, setFailed] = useState(false)

  useEffect(() => engine.onStateChange(() => setUnlocked(engine.isUnlocked)), [engine])

  if (!supported) {
    return (
      <p role="alert" className="notice">
        This browser doesn't support the Web Audio API, so the audio tools can't run here. Try a
        recent version of Chrome, Firefox, Safari or Edge.
      </p>
    )
  }

  if (unlocked) return <>{children}</>

  const start = async () => {
    try {
      await engine.unlock()
      setFailed(false)
      setUnlocked(engine.isUnlocked)
    } catch {
      setFailed(true)
    }
  }

  return (
    <div className={styles.gate}>
      <button type="button" className={styles.start} onClick={start}>
        Tap to start audio
      </button>
      <p className={styles.hint}>Browsers only allow sound after you interact with the page.</p>
      {failed && (
        <p role="alert" className="notice">
          Couldn't start audio. Try tapping again.
        </p>
      )}
    </div>
  )
}
```

`src/ui/components/AudioGate.module.css`:

```css
.gate {
  display: grid;
  place-items: center;
  gap: 0.75rem;
  padding: 3rem 1rem;
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  text-align: center;
}

.start {
  padding: 1rem 2rem;
  font-size: 1.15rem;
  background: var(--accent);
  border-color: var(--accent);
  color: #111;
}

.hint {
  margin: 0;
  color: var(--text-dim);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/components/AudioGate.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/audio/AudioEngine.ts src/ui/components/AudioGate.tsx src/ui/components/AudioGate.module.css src/ui/components/AudioGate.test.tsx
git commit -m "feat(audio): AudioContext engine with tap-to-start gate"
```

---

### Task 9: App shell — router, header, key selector, home page

**Files:**
- Create: `src/ui/router.ts`, `src/ui/components/Header.tsx`, `src/ui/components/Header.module.css`, `src/ui/components/KeySelector.tsx`, `src/ui/pages/HomePage.tsx`, `src/ui/pages/HomePage.module.css`, `src/ui/App.module.css`
- Modify: `src/ui/App.tsx` (replace), `src/ui/App.test.tsx` (replace)
- Test: `src/ui/router.test.ts`, `src/ui/components/KeySelector.test.tsx`, `src/ui/App.test.tsx`

**Interfaces:**
- Consumes: `SettingsProvider`, `useSettings` (Task 6); `HARP_KEYS`, `HarpKey` (Task 3)
- Produces:
  - `parseHash(hash: string): string`, `useHashRoute(): string`
  - `KeySelector({ value: HarpKey; onChange(key: HarpKey): void })`
  - `Header()`, `HomePage()`
  - `App()` with a `ROUTES: Record<string, ComponentType>` map in `App.tsx` that Tasks 12 and 13 extend with `'/tuner'` and `'/metronome'`

- [ ] **Step 1: Write the failing tests**

`src/ui/router.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseHash } from './router'

describe('parseHash', () => {
  it('normalises hashes to paths', () => {
    expect(parseHash('')).toBe('/')
    expect(parseHash('#')).toBe('/')
    expect(parseHash('#/')).toBe('/')
    expect(parseHash('#/tuner')).toBe('/tuner')
    expect(parseHash('#tuner')).toBe('/tuner')
    expect(parseHash('#/tuner?x=1')).toBe('/tuner')
  })
})
```

`src/ui/components/KeySelector.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { KeySelector } from './KeySelector'

describe('KeySelector', () => {
  it('offers all 12 keys and reports changes', () => {
    const onChange = vi.fn()
    render(<KeySelector value="C" onChange={onChange} />)
    const select = screen.getByLabelText('Harp key')
    expect(select.querySelectorAll('option')).toHaveLength(12)
    fireEvent.change(select, { target: { value: 'A' } })
    expect(onChange).toHaveBeenCalledWith('A')
  })
})
```

`src/ui/App.test.tsx` (replace the Task 1 smoke test):

```tsx
import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from './App'

afterEach(() => {
  window.location.hash = ''
})

describe('App', () => {
  it('shows the home page with the tools and upcoming games', () => {
    window.location.hash = '#/'
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/diatonic harmonica/i)
    // The header nav also links to the tools, so look inside the Tools card list.
    const tools = screen.getByRole('list', { name: 'Tools' })
    expect(within(tools).getByRole('link', { name: /Tuner/ })).toHaveAttribute('href', '#/tuner')
    expect(within(tools).getByRole('link', { name: /Metronome/ })).toHaveAttribute(
      'href',
      '#/metronome',
    )
    expect(screen.getAllByText('Coming soon')).toHaveLength(5)
  })

  it('falls back to the home page for unknown routes', () => {
    window.location.hash = '#/nope'
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/diatonic harmonica/i)
  })
})
```


- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui/router.test.ts src/ui/components/KeySelector.test.tsx src/ui/App.test.tsx`
Expected: FAIL — `./router` and `./KeySelector` not found; App test fails on missing heading/links.

- [ ] **Step 3: Implement**

`src/ui/router.ts`:

```ts
import { useSyncExternalStore } from 'react'

/** '#/tuner?x=1' → '/tuner'; '' → '/'. */
export function parseHash(hash: string): string {
  const path = hash.replace(/^#/, '').split('?')[0]
  return path.startsWith('/') ? path : `/${path}`
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useHashRoute(): string {
  return useSyncExternalStore(subscribe, () => parseHash(window.location.hash))
}
```

`src/ui/components/KeySelector.tsx`:

```tsx
import { HARP_KEYS, type HarpKey } from '../../core/harmonica/keys'

interface Props {
  value: HarpKey
  onChange: (key: HarpKey) => void
}

export function KeySelector({ value, onChange }: Props) {
  return (
    <select aria-label="Harp key" value={value} onChange={(e) => onChange(e.target.value as HarpKey)}>
      {HARP_KEYS.map((k) => (
        <option key={k} value={k}>
          {k} harp
        </option>
      ))}
    </select>
  )
}
```

`src/ui/components/Header.tsx`:

```tsx
import { useSettings } from '../settings/SettingsContext'
import { KeySelector } from './KeySelector'
import styles from './Header.module.css'

export function Header() {
  const { settings, update } = useSettings()
  return (
    <header className={styles.header}>
      <a href="#/" className={styles.brand}>
        🎵 Harp Tools
      </a>
      <nav className={styles.nav} aria-label="Main">
        <a href="#/tuner">Tuner</a>
        <a href="#/metronome">Metronome</a>
      </nav>
      <KeySelector value={settings.key} onChange={(key) => update({ key })} />
    </header>
  )
}
```

`src/ui/components/Header.module.css`:

```css
.header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.brand {
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--text);
  text-decoration: none;
}

.nav {
  display: flex;
  gap: 1rem;
  margin-right: auto;
}

.nav a {
  color: var(--text-dim);
  text-decoration: none;
}

.nav a:hover {
  color: var(--text);
}
```

`src/ui/pages/HomePage.tsx`:

```tsx
import styles from './HomePage.module.css'

const TOOLS = [
  {
    href: '#/tuner',
    icon: '🎯',
    title: 'Tuner',
    text: 'See which hole and technique you are playing, or hear any note on your harp.',
  },
  {
    href: '#/metronome',
    icon: '🥁',
    title: 'Metronome',
    text: 'Steady time with tap tempo, accents and subdivisions.',
  },
]

const GAMES = [
  { icon: '👂', title: 'Echo the note', text: 'Hear a note, then play it back.' },
  { icon: '〰️', title: 'Bend trainer', text: 'Hit and hold a target bend on a live meter.' },
  { icon: '🪜', title: 'Scale runner', text: 'Scales in 1st, 2nd and 3rd position.' },
  { icon: '🎼', title: 'Interval training', text: 'Name or play the interval you hear.' },
  { icon: '🔁', title: 'Melody echo', text: 'Repeat phrases that grow as you improve.' },
]

export function HomePage() {
  return (
    <>
      <h1 className={styles.title}>Practice tools for diatonic harmonica</h1>
      <p className={styles.lead}>
        Pick your harp's key at the top — everything on the site follows it.
      </p>

      <h2>Tools</h2>
      <ul className={styles.cards} aria-label="Tools">
        {TOOLS.map((t) => (
          <li key={t.href}>
            <a href={t.href} className={styles.card}>
              <span className={styles.icon} aria-hidden>
                {t.icon}
              </span>
              <strong>{t.title}</strong>
              <span className={styles.text}>{t.text}</span>
            </a>
          </li>
        ))}
      </ul>

      <h2>Games</h2>
      <ul className={styles.cards} aria-label="Games">
        {GAMES.map((g) => (
          <li key={g.title}>
            <div className={styles.card} data-disabled="true">
              <span className={styles.icon} aria-hidden>
                {g.icon}
              </span>
              <strong>{g.title}</strong>
              <span className={styles.text}>{g.text}</span>
              <span className={styles.badge}>Coming soon</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
```

`src/ui/pages/HomePage.module.css`:

```css
.title {
  margin-bottom: 0.25rem;
}

.lead {
  margin-top: 0;
  color: var(--text-dim);
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 1rem;
  margin: 0 0 2rem;
  padding: 0;
  list-style: none;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  height: 100%;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  text-decoration: none;
}

a.card:hover {
  border-color: var(--accent);
}

.card[data-disabled] {
  opacity: 0.6;
}

.icon {
  font-size: 1.75rem;
}

.text {
  color: var(--text-dim);
  font-size: 0.9rem;
}

.badge {
  align-self: flex-start;
  margin-top: auto;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: var(--surface-2);
  font-size: 0.75rem;
  color: var(--text-dim);
}
```

`src/ui/App.tsx` (replace):

```tsx
import type { ComponentType } from 'react'
import { Header } from './components/Header'
import { HomePage } from './pages/HomePage'
import { useHashRoute } from './router'
import { SettingsProvider } from './settings/SettingsContext'
import styles from './App.module.css'

const ROUTES: Record<string, ComponentType> = {
  '/': HomePage,
}

function CurrentPage() {
  const Page = ROUTES[useHashRoute()] ?? HomePage
  return <Page />
}

export function App() {
  return (
    <SettingsProvider>
      <Header />
      <main className={styles.main}>
        <CurrentPage />
      </main>
    </SettingsProvider>
  )
}
```

`src/ui/App.module.css`:

```css
.main {
  max-width: 64rem;
  margin: 0 auto;
  padding: 1rem;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Check it in the browser**

Run: `npm run dev`, open `http://localhost:5173`. Expected: header with key selector, home page with 2 tool cards and 5 "Coming soon" game cards; changing the key and reloading keeps the choice; the layout wraps on a narrow window.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): app shell with hash routing, key selector and home page"
```

---

### Task 10: Pitch analysis (pure DSP around pitchy)

**Files:**
- Create: `src/audio/pitch/analysis.ts`
- Test: `src/audio/pitch/analysis.test.ts`

**Interfaces:**
- Consumes: `pitchy` (`PitchDetector.forFloat32Array(n).findPitch(buf, sampleRate): [pitch, clarity]`); `freqToMidi`, `midiToFreq`, `centsOff` (Task 2) in tests
- Produces:
  - `interface GateOptions { minClarity: number; noiseFloor: number }`
  - `interface FrameAnalyzer { findPitch(input: Float32Array, sampleRate: number): [number, number] }`
  - `computeRms(buf: Float32Array): number`
  - `analyzeFrame(buf: Float32Array, sampleRate: number, analyzer: FrameAnalyzer, gate: GateOptions): { reading: { freq: number; clarity: number; rms: number } | null; rms: number }`
  - `class MedianSmoother { constructor(size?: number); push(value: number | null): number | null; reset(): void }`

> This task covers Review Focus items 1 and 2.

- [ ] **Step 1: Write the failing test**

`src/audio/pitch/analysis.test.ts`:

```ts
import { PitchDetector as Mpm } from 'pitchy'
import { describe, expect, it } from 'vitest'
import { centsOff } from '../../core/music/pitch'
import { MedianSmoother, analyzeFrame, computeRms } from './analysis'

const SR = 48000
const N = 2048
const GATE = { minClarity: 0.9, noiseFloor: 0.01 }
const mpm = Mpm.forFloat32Array(N)
const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12)

function tone(freq: number, shape: 'sine' | 'saw', amp = 0.5): Float32Array {
  const buf = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const phase = (freq * i) / SR - Math.floor((freq * i) / SR)
    buf[i] = amp * (shape === 'sine' ? Math.sin(2 * Math.PI * phase) : 2 * phase - 1)
  }
  return buf
}

function noise(amp: number, seed = 1): Float32Array {
  let s = seed
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1
  return Float32Array.from({ length: N }, () => amp * rand())
}

// G harp hole 1 blow (G3) up to F# harp hole 10 overdraw (G7).
const MIDI_RANGE = Array.from({ length: 103 - 55 + 1 }, (_, i) => 55 + i)

describe('computeRms', () => {
  it('measures signal level', () => {
    expect(computeRms(new Float32Array(N))).toBe(0)
    expect(computeRms(new Float32Array(N).fill(0.5))).toBeCloseTo(0.5, 9)
    expect(computeRms(tone(440, 'sine', 1))).toBeCloseTo(Math.SQRT1_2, 2)
  })
})

describe('analyzeFrame', () => {
  it.each(MIDI_RANGE)('detects a sine at MIDI %i within ±5 cents', (midi) => {
    const { reading } = analyzeFrame(tone(midiToHz(midi), 'sine'), SR, mpm, GATE)
    expect(reading).not.toBeNull()
    expect(Math.abs(centsOff(reading!.freq, midi))).toBeLessThan(5)
  })

  it.each(MIDI_RANGE)('detects a harmonic-rich sawtooth at MIDI %i within ±5 cents', (midi) => {
    const { reading } = analyzeFrame(tone(midiToHz(midi), 'saw'), SR, mpm, GATE)
    expect(reading).not.toBeNull()
    expect(Math.abs(centsOff(reading!.freq, midi))).toBeLessThan(5)
  })

  it('returns null for silence but still reports the level', () => {
    expect(analyzeFrame(new Float32Array(N), SR, mpm, GATE)).toEqual({ reading: null, rms: 0 })
  })

  it('returns null for a tone below the noise floor', () => {
    const { reading, rms } = analyzeFrame(tone(440, 'sine', 0.005), SR, mpm, GATE)
    expect(reading).toBeNull()
    expect(rms).toBeGreaterThan(0)
  })

  it('returns null for breath-like noise', () => {
    const { reading, rms } = analyzeFrame(noise(0.3), SR, mpm, GATE)
    expect(reading).toBeNull()
    expect(rms).toBeGreaterThan(GATE.noiseFloor)
  })
})

describe('MedianSmoother', () => {
  it('suppresses a single octave spike', () => {
    const m = new MedianSmoother(3)
    expect(m.push(440)).toBe(440)
    expect(m.push(880)).toBe(440)
    expect(m.push(441)).toBe(441)
  })
  it('resets on silence', () => {
    const m = new MedianSmoother(3)
    m.push(440)
    m.push(440)
    expect(m.push(null)).toBeNull()
    expect(m.push(220)).toBe(220)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/audio/pitch/analysis.test.ts`
Expected: FAIL — module `./analysis` not found.

- [ ] **Step 3: Implement**

`src/audio/pitch/analysis.ts`:

```ts
export interface GateOptions {
  /** pitchy clarity (0–1) required to trust a reading. */
  minClarity: number
  /** Linear RMS below which the frame counts as silence. */
  noiseFloor: number
}

/** The part of pitchy's PitchDetector we use — lets tests or other detectors stand in. */
export interface FrameAnalyzer {
  findPitch(input: Float32Array, sampleRate: number): [number, number]
}

export function computeRms(buf: Float32Array): number {
  let sum = 0
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
  return Math.sqrt(sum / buf.length)
}

export function analyzeFrame(
  buf: Float32Array,
  sampleRate: number,
  analyzer: FrameAnalyzer,
  gate: GateOptions,
): { reading: { freq: number; clarity: number; rms: number } | null; rms: number } {
  const rms = computeRms(buf)
  if (rms < gate.noiseFloor) return { reading: null, rms }
  const [freq, clarity] = analyzer.findPitch(buf, sampleRate)
  if (clarity < gate.minClarity || !Number.isFinite(freq) || freq <= 0) return { reading: null, rms }
  return { reading: { freq, clarity, rms }, rms }
}

/** Median over the last `size` readings; a null (silence) clears the history. */
export class MedianSmoother {
  private values: number[] = []

  constructor(private readonly size = 3) {}

  push(value: number | null): number | null {
    if (value === null) {
      this.reset()
      return null
    }
    this.values.push(value)
    if (this.values.length > this.size) this.values.shift()
    const sorted = [...this.values].sort((a, b) => a - b)
    // Lower median for even counts, so a single upward octave spike can't win.
    return sorted[Math.floor((sorted.length - 1) / 2)]
  }

  reset(): void {
    this.values = []
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/audio/pitch/analysis.test.ts`
Expected: PASS (≈100 detection cases + the rest).

If any sawtooth case fails at the top of the range, **don't loosen the tolerance**. Check first whether it's an octave error (reading ≈ 2× or ½× the target). If so, report it back rather than papering over it: the real harp is the ground truth, and Plan 2's matcher depends on it.

- [ ] **Step 5: Commit**

```bash
git add src/audio/pitch/analysis.ts src/audio/pitch/analysis.test.ts
git commit -m "feat(audio): gated pitch analysis with median smoothing"
```

---

### Task 11: Microphone, PitchyDetector, usePitch, mic error messages

**Files:**
- Create: `src/audio/Microphone.ts`, `src/audio/pitch/PitchDetector.ts`, `src/audio/pitch/PitchyDetector.ts`, `src/ui/hooks/usePitch.ts`, `src/ui/components/MicErrorNotice.tsx`
- Test: `src/audio/Microphone.test.ts`, `src/ui/components/MicErrorNotice.test.tsx`

**Interfaces:**
- Consumes: `audioEngine` (Task 8); `analyzeFrame`, `MedianSmoother`, `GateOptions` (Task 10); `useSettings` (Task 6)
- Produces:
  - `type MicErrorKind = 'insecure' | 'denied' | 'no-device' | 'busy' | 'unknown'`
  - `class MicrophoneError extends Error { readonly kind: MicErrorKind }`
  - `mapMicError(error: unknown): MicErrorKind`
  - `microphone: { acquire(): Promise<AnalyserNode>; release(): void }`
  - `interface PitchReading { freq: number; clarity: number; rms: number }`
  - `type PitchListener = (reading: PitchReading | null, rms: number) => void`
  - `interface PitchDetector { start(): Promise<void>; stop(): void; onPitch(l: PitchListener): () => void }`
  - `class PitchyDetector implements PitchDetector { constructor(gate: () => GateOptions) }`
  - `usePitch(enabled: boolean): { reading: PitchReading | null; rms: number; status: 'idle' | 'starting' | 'listening' | 'error'; error: MicErrorKind | null }`
  - `MicErrorNotice({ kind: MicErrorKind })`

> This task covers Review Focus item 4.

- [ ] **Step 1: Write the failing tests**

`src/audio/Microphone.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mapMicError } from './Microphone'

describe('mapMicError', () => {
  it.each([
    ['NotAllowedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotFoundError', 'no-device'],
    ['OverconstrainedError', 'no-device'],
    ['NotReadableError', 'busy'],
    ['AbortError', 'busy'],
    ['SomethingElse', 'unknown'],
  ])('maps %s to %s', (name, kind) => {
    expect(mapMicError(new DOMException('x', name))).toBe(kind)
  })
  it('handles non-DOMException values', () => {
    expect(mapMicError(new Error('boom'))).toBe('unknown')
    expect(mapMicError(null)).toBe('unknown')
  })
})
```

`src/ui/components/MicErrorNotice.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MicErrorNotice } from './MicErrorNotice'

describe('MicErrorNotice', () => {
  it.each([
    ['denied', /permission/i],
    ['insecure', /HTTPS/],
    ['no-device', /No microphone/],
    ['busy', /another app/],
    ['unknown', /reload/i],
  ] as const)('explains the %s case', (kind, text) => {
    render(<MicErrorNotice kind={kind} />)
    expect(screen.getByRole('alert')).toHaveTextContent(text)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/audio/Microphone.test.ts src/ui/components/MicErrorNotice.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the microphone**

`src/audio/Microphone.ts`:

```ts
import { audioEngine } from './AudioEngine'

export type MicErrorKind = 'insecure' | 'denied' | 'no-device' | 'busy' | 'unknown'

export class MicrophoneError extends Error {
  constructor(readonly kind: MicErrorKind) {
    super(`Microphone unavailable: ${kind}`)
    this.name = 'MicrophoneError'
  }
}

export function mapMicError(error: unknown): MicErrorKind {
  const name = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'denied'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'no-device'
    case 'NotReadableError':
    case 'AbortError':
      return 'busy'
    default:
      return 'unknown'
  }
}

const FFT_SIZE = 2048

/** Shared, reference-counted mic input: opened on first acquire(), closed on last release(). */
class Microphone {
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private pending: Promise<AnalyserNode> | null = null
  private users = 0

  async acquire(): Promise<AnalyserNode> {
    if (!navigator.mediaDevices?.getUserMedia) throw new MicrophoneError('insecure')
    this.users++
    try {
      return await (this.pending ??= this.open())
    } catch (e) {
      this.users = Math.max(0, this.users - 1)
      this.pending = null
      throw e
    }
  }

  release(): void {
    if (this.users === 0) return
    this.users--
    if (this.users > 0) return
    this.close()
  }

  private async open(): Promise<AnalyserNode> {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        // Browser voice processing distorts a harmonica's tone and confuses pitch detection.
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
    } catch (e) {
      throw new MicrophoneError(mapMicError(e))
    }
    if (this.users === 0) {
      // Everyone released while the permission prompt was open.
      stream.getTracks().forEach((t) => t.stop())
      throw new MicrophoneError('unknown')
    }
    const ctx = audioEngine.ctx
    this.stream = stream
    this.source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = FFT_SIZE
    this.source.connect(analyser)
    return analyser
  }

  private close(): void {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.source?.disconnect()
    this.stream = null
    this.source = null
    this.pending = null
  }
}

export const microphone = new Microphone()
```

- [ ] **Step 4: Implement the detector**

`src/audio/pitch/PitchDetector.ts`:

```ts
export interface PitchReading {
  freq: number
  clarity: number
  rms: number
}

/** `rms` is always reported, even when the reading is gated to null, for level meters. */
export type PitchListener = (reading: PitchReading | null, rms: number) => void

export interface PitchDetector {
  /** Resolves once the mic is open; rejects with MicrophoneError. */
  start(): Promise<void>
  stop(): void
  onPitch(listener: PitchListener): () => void
}
```

`src/audio/pitch/PitchyDetector.ts`:

```ts
import { PitchDetector as Mpm } from 'pitchy'
import { microphone } from '../Microphone'
import { MedianSmoother, analyzeFrame, type GateOptions } from './analysis'
import type { PitchDetector, PitchListener } from './PitchDetector'

/** Reads the shared mic on every animation frame and runs pitchy (McLeod) on it. */
export class PitchyDetector implements PitchDetector {
  private listeners = new Set<PitchListener>()
  private smoother = new MedianSmoother(3)
  private frame = 0
  private running = false
  private acquired = false

  constructor(private readonly gate: () => GateOptions) {}

  async start(): Promise<void> {
    if (this.running) return
    this.running = true
    let analyser: AnalyserNode
    try {
      analyser = await microphone.acquire()
    } catch (e) {
      this.running = false
      throw e
    }
    if (!this.running) {
      // stop() was called while the permission prompt was open.
      microphone.release()
      return
    }
    this.acquired = true

    const buf = new Float32Array(analyser.fftSize)
    const mpm = Mpm.forFloat32Array(analyser.fftSize)
    const sampleRate = analyser.context.sampleRate
    const tick = () => {
      analyser.getFloatTimeDomainData(buf)
      const { reading, rms } = analyzeFrame(buf, sampleRate, mpm, this.gate())
      const freq = this.smoother.push(reading?.freq ?? null)
      const out = reading && freq !== null ? { ...reading, freq } : null
      this.listeners.forEach((l) => l(out, rms))
      this.frame = requestAnimationFrame(tick)
    }
    this.frame = requestAnimationFrame(tick)
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    cancelAnimationFrame(this.frame)
    this.smoother.reset()
    if (this.acquired) {
      this.acquired = false
      microphone.release()
    }
  }

  onPitch(listener: PitchListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}
```

- [ ] **Step 5: Implement the hook and the notice**

`src/ui/hooks/usePitch.ts`:

```ts
import { useEffect, useRef, useState } from 'react'
import { MicrophoneError, type MicErrorKind } from '../../audio/Microphone'
import type { PitchReading } from '../../audio/pitch/PitchDetector'
import { PitchyDetector } from '../../audio/pitch/PitchyDetector'
import { useSettings } from '../settings/SettingsContext'

const MIN_CLARITY = 0.9

export type PitchStatus = 'idle' | 'starting' | 'listening' | 'error'

export interface PitchState {
  reading: PitchReading | null
  rms: number
  status: PitchStatus
  error: MicErrorKind | null
}

interface Live {
  reading: PitchReading | null
  rms: number
  live: boolean
  error: MicErrorKind | null
}

const IDLE: PitchState = { reading: null, rms: 0, status: 'idle', error: null }
const EMPTY: Live = { reading: null, rms: 0, live: false, error: null }

/** Live mic pitch while `enabled`; the mic is released when disabled or unmounted. */
export function usePitch(enabled: boolean): PitchState {
  const { settings } = useSettings()
  const noiseFloor = useRef(settings.noiseFloor)
  const [live, setLive] = useState<Live>(EMPTY)

  useEffect(() => {
    noiseFloor.current = settings.noiseFloor
  }, [settings.noiseFloor])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const detector = new PitchyDetector(() => ({
      minClarity: MIN_CLARITY,
      noiseFloor: noiseFloor.current,
    }))
    const off = detector.onPitch((reading, rms) => setLive({ reading, rms, live: true, error: null }))
    detector.start().catch((e: unknown) => {
      if (!cancelled) {
        setLive({ ...EMPTY, error: e instanceof MicrophoneError ? e.kind : 'unknown' })
      }
    })
    return () => {
      cancelled = true
      off()
      detector.stop()
      setLive(EMPTY)
    }
  }, [enabled])

  if (!enabled) return IDLE
  if (live.error) return { reading: null, rms: 0, status: 'error', error: live.error }
  return { reading: live.reading, rms: live.rms, status: live.live ? 'listening' : 'starting', error: null }
}
```

`src/ui/components/MicErrorNotice.tsx`:

```tsx
import type { MicErrorKind } from '../../audio/Microphone'

const MESSAGES: Record<MicErrorKind, string> = {
  insecure:
    'The microphone only works when the site is served over HTTPS (or from localhost).',
  denied:
    "Microphone permission was denied. Allow it from the microphone icon in your browser's address bar (Safari: Settings → Websites → Microphone), then reload the page.",
  'no-device': 'No microphone was found. Plug one in or check your system sound settings.',
  busy: "The microphone is in use by another app or can't be opened. Close other apps using it and try again.",
  unknown: 'The microphone could not be started. Reload the page and try again.',
}

export function MicErrorNotice({ kind }: { kind: MicErrorKind }) {
  return (
    <div role="alert" className="notice">
      <strong>Microphone unavailable.</strong> {MESSAGES[kind]}
    </div>
  )
}
```

- [ ] **Step 6: Run tests, lint and typecheck**

Run: `npm test && npm run lint && npm run typecheck`
Expected: all PASS / clean.

- [ ] **Step 7: Commit**

```bash
git add src/audio/Microphone.ts src/audio/Microphone.test.ts src/audio/pitch/PitchDetector.ts src/audio/pitch/PitchyDetector.ts src/ui/hooks/usePitch.ts src/ui/components/MicErrorNotice.tsx src/ui/components/MicErrorNotice.test.tsx
git commit -m "feat(audio): microphone input and live pitch detection"
```

---

### Task 12: Synth note player and the Tuner page

**Files:**
- Create: `src/audio/NotePlayer.ts`, `src/audio/SynthNotePlayer.ts`, `src/ui/hooks/useNotePlayer.ts`, `src/ui/pages/tuner/tunerMath.ts`, `src/ui/pages/tuner/TunerReadout.tsx`, `src/ui/pages/tuner/TunerReadout.module.css`, `src/ui/pages/tuner/LevelMeter.tsx`, `src/ui/pages/tuner/LevelMeter.module.css`, `src/ui/pages/tuner/TunerPage.tsx`, `src/ui/pages/tuner/TunerPage.module.css`
- Modify: `src/ui/App.tsx` (add the `/tuner` route)
- Test: `src/ui/pages/tuner/tunerMath.test.ts`, `src/ui/pages/tuner/TunerReadout.test.tsx`

**Interfaces:**
- Consumes: `audioEngine` (Task 8); `midiToFreq`, `freqToMidi` (Task 2); `noteName` (Task 2); `buildHarp`, `findNotes`, `noteId`, `tabLabel`, `HarpNote` (Task 3); `keySpelling` (Task 3); `HarmonicaDiagram`, `Highlight` (Task 7); `AudioGate` (Task 8); `usePitch`, `MicErrorNotice` (Task 11); `useSettings`, `A4_RANGE`, `NOISE_FLOOR_RANGE` (Task 6)
- Produces:
  - `interface NotePlayer { play(midi: number, opts?: { durationMs?: number }): Promise<void>; start(midi: number): void; stop(): void; readonly isSounding: boolean }`
  - `class SynthNotePlayer implements NotePlayer { constructor(a4: () => number) }`
  - `useNotePlayer(): NotePlayer`
  - `type TuneQuality = 'in-tune' | 'close' | 'off'`; `tuneQuality(cents)`, `levelPercent(rms)`, `formatCents(cents)`
  - `TunerReadout({ reading: { noteLabel: string; cents: number; freq: number; tabs: string[]; onHarp: boolean } | null })`
  - `LevelMeter({ rms, noiseFloor, onNoiseFloorChange })`
  - `TunerPage()` at route `/tuner`

- [ ] **Step 1: Write the failing tests**

`src/ui/pages/tuner/tunerMath.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatCents, levelPercent, tuneQuality } from './tunerMath'

describe('tuneQuality', () => {
  it('is in tune within ±10 cents, close within ±25, off beyond', () => {
    expect(tuneQuality(0)).toBe('in-tune')
    expect(tuneQuality(10)).toBe('in-tune')
    expect(tuneQuality(-10)).toBe('in-tune')
    expect(tuneQuality(10.1)).toBe('close')
    expect(tuneQuality(-25)).toBe('close')
    expect(tuneQuality(26)).toBe('off')
  })
})

describe('levelPercent', () => {
  it('maps −60…0 dBFS onto 0…100', () => {
    expect(levelPercent(0)).toBe(0)
    expect(levelPercent(0.001)).toBe(0)
    expect(levelPercent(0.01)).toBe(33)
    expect(levelPercent(1)).toBe(100)
    expect(levelPercent(2)).toBe(100)
  })
})

describe('formatCents', () => {
  it('shows a sign and rounds', () => {
    expect(formatCents(3.4)).toBe('+3¢')
    expect(formatCents(-12.6)).toBe('-13¢')
    expect(formatCents(-0.2)).toBe('0¢')
  })
})
```

`src/ui/pages/tuner/TunerReadout.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TunerReadout } from './TunerReadout'

describe('TunerReadout', () => {
  it('prompts to play when there is no reading', () => {
    render(<TunerReadout reading={null} />)
    expect(screen.getByText(/Play a note/)).toBeInTheDocument()
  })

  it('shows the note, cents, frequency and holes', () => {
    render(
      <TunerReadout
        reading={{ noteLabel: 'A4', cents: 3.2, freq: 440.8, tabs: ["-3''"], onHarp: true }}
      />,
    )
    expect(screen.getByText('A4')).toHaveAttribute('data-quality', 'in-tune')
    expect(screen.getByText('+3¢')).toBeInTheDocument()
    expect(screen.getByText('440.8 Hz')).toBeInTheDocument()
    expect(screen.getByText("-3''")).toBeInTheDocument()
  })

  it('flags pitches that are not on the harp', () => {
    render(
      <TunerReadout reading={{ noteLabel: 'B3', cents: -30, freq: 241, tabs: [], onHarp: false }} />,
    )
    expect(screen.getByText('Not on this harp')).toBeInTheDocument()
    expect(screen.getByText('B3')).toHaveAttribute('data-quality', 'off')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui/pages/tuner`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the tuner maths and readout**

`src/ui/pages/tuner/tunerMath.ts`:

```ts
export type TuneQuality = 'in-tune' | 'close' | 'off'

export function tuneQuality(cents: number): TuneQuality {
  const a = Math.abs(cents)
  if (a <= 10) return 'in-tune'
  if (a <= 25) return 'close'
  return 'off'
}

/** Linear RMS → 0–100 on a −60…0 dBFS scale. */
export function levelPercent(rms: number): number {
  if (rms <= 0) return 0
  const db = 20 * Math.log10(rms)
  return Math.round(Math.min(100, Math.max(0, ((db + 60) / 60) * 100)))
}

export function formatCents(cents: number): string {
  const r = Math.round(cents) || 0 // avoid "-0"
  return r > 0 ? `+${r}¢` : `${r}¢`
}
```

`src/ui/pages/tuner/TunerReadout.tsx`:

```tsx
import { formatCents, tuneQuality } from './tunerMath'
import styles from './TunerReadout.module.css'

export interface ReadoutData {
  noteLabel: string
  cents: number
  freq: number
  /** Tab labels of every hole producing this pitch. */
  tabs: string[]
  onHarp: boolean
}

export function TunerReadout({ reading }: { reading: ReadoutData | null }) {
  if (!reading) {
    return (
      <div className={styles.readout}>
        <div className={styles.note}>–</div>
        <p className={styles.hint}>Play a note…</p>
      </div>
    )
  }
  const quality = tuneQuality(reading.cents)
  const needle = 50 + Math.max(-50, Math.min(50, reading.cents))
  return (
    <div className={styles.readout}>
      <div className={styles.note} data-quality={quality}>
        {reading.noteLabel}
      </div>
      <div className={styles.scale} aria-hidden>
        <div className={styles.zone} />
        <div className={styles.needle} data-quality={quality} style={{ left: `${needle}%` }} />
      </div>
      <div className={styles.meta}>
        <span>{formatCents(reading.cents)}</span>
        <span>{reading.freq.toFixed(1)} Hz</span>
      </div>
      <p className={styles.tabs}>
        {reading.onHarp ? (
          reading.tabs.map((t) => (
            <span key={t} className={styles.tab}>
              {t}
            </span>
          ))
        ) : (
          <span className={styles.offHarp}>Not on this harp</span>
        )}
      </p>
    </div>
  )
}
```

`src/ui/pages/tuner/TunerReadout.module.css`:

```css
.readout {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  margin: 1.5rem 0;
}

.note {
  font-size: 4.5rem;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.note[data-quality='in-tune'] {
  color: var(--ok);
}
.note[data-quality='close'] {
  color: var(--warn);
}
.note[data-quality='off'] {
  color: var(--bad);
}
.needle[data-quality='in-tune'] {
  background: var(--ok);
}
.needle[data-quality='close'] {
  background: var(--warn);
}
.needle[data-quality='off'] {
  background: var(--bad);
}

.scale {
  position: relative;
  width: min(100%, 24rem);
  height: 1.25rem;
  border-radius: 999px;
  background: var(--surface-2);
}

.zone {
  position: absolute;
  inset: 0 40%;
  background: color-mix(in srgb, var(--ok) 25%, transparent);
}

.needle {
  position: absolute;
  top: -0.25rem;
  bottom: -0.25rem;
  width: 4px;
  margin-left: -2px;
  border-radius: 2px;
  transition: left 60ms linear;
}

.meta {
  display: flex;
  gap: 1.5rem;
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}

.hint {
  margin: 0;
  color: var(--text-dim);
}

.tabs {
  display: flex;
  gap: 0.5rem;
  min-height: 1.75rem;
  margin: 0;
}

.tab {
  padding: 0.1rem 0.6rem;
  border-radius: var(--radius);
  background: var(--surface-2);
  font-weight: 600;
}

.offHarp {
  color: var(--bad);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/ui/pages/tuner`
Expected: PASS.

- [ ] **Step 5: Implement the note player**

`src/audio/NotePlayer.ts`:

```ts
/** Plays reference notes. SynthNotePlayer now; a sample-based player can replace it later. */
export interface NotePlayer {
  /** Plays for `durationMs` (default 1000); resolves when the note ends. */
  play(midi: number, opts?: { durationMs?: number }): Promise<void>
  /** Sustains until stop(). Starting a new note stops the previous one. */
  start(midi: number): void
  stop(): void
  readonly isSounding: boolean
}
```

`src/audio/SynthNotePlayer.ts`:

```ts
import { midiToFreq } from '../core/music/pitch'
import { audioEngine } from './AudioEngine'
import type { NotePlayer } from './NotePlayer'

const PEAK = 0.25
const ATTACK_S = 0.02
const RELEASE_S = 0.08

interface Voice {
  oscillators: OscillatorNode[]
  envelope: GainNode
}

/** Sawtooth + triangle through a low-pass filter: a reed-ish tone rather than a beep. */
export class SynthNotePlayer implements NotePlayer {
  private voice: Voice | null = null

  constructor(private readonly a4: () => number) {}

  get isSounding(): boolean {
    return this.voice !== null
  }

  start(midi: number): void {
    this.stop()
    const ctx = audioEngine.ctx
    const t = ctx.currentTime
    const freq = midiToFreq(midi, this.a4())

    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0, t)
    envelope.gain.linearRampToValueAtTime(PEAK, t + ATTACK_S)
    envelope.connect(audioEngine.master)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = Math.min(freq * 4, 8000)
    filter.Q.value = 1
    filter.connect(envelope)

    const oscillators = (['sawtooth', 'triangle'] as const).map((type, i) => {
      const osc = ctx.createOscillator()
      osc.type = type
      osc.frequency.value = freq
      const mix = ctx.createGain()
      mix.gain.value = i === 0 ? 0.35 : 0.65
      osc.connect(mix).connect(filter)
      osc.start(t)
      return osc
    })
    oscillators[0].onended = () => envelope.disconnect()

    this.voice = { oscillators, envelope }
  }

  stop(): void {
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
}
```

`src/ui/hooks/useNotePlayer.ts`:

```ts
import { useEffect, useRef, useState } from 'react'
import type { NotePlayer } from '../../audio/NotePlayer'
import { SynthNotePlayer } from '../../audio/SynthNotePlayer'
import { useSettings } from '../settings/SettingsContext'

/** A note player tuned to the current A4 setting; silenced on unmount. */
export function useNotePlayer(): NotePlayer {
  const { settings } = useSettings()
  const a4 = useRef(settings.a4)
  useEffect(() => {
    a4.current = settings.a4
  }, [settings.a4])
  const [player] = useState(() => new SynthNotePlayer(() => a4.current))
  useEffect(() => () => player.stop(), [player])
  return player
}
```

- [ ] **Step 6: Implement the level meter and the page**

`src/ui/pages/tuner/LevelMeter.tsx`:

```tsx
import { NOISE_FLOOR_RANGE } from '../../settings/settings'
import { levelPercent } from './tunerMath'
import styles from './LevelMeter.module.css'

interface Props {
  rms: number
  noiseFloor: number
  onNoiseFloorChange: (noiseFloor: number) => void
}

const toDb = (v: number) => Math.round(20 * Math.log10(v))
const fromDb = (db: number) => 10 ** (db / 20)

export function LevelMeter({ rms, noiseFloor, onNoiseFloorChange }: Props) {
  const [lo, hi] = NOISE_FLOOR_RANGE
  return (
    <div className={styles.wrap}>
      <div className={styles.meter} aria-label="Input level" role="meter" aria-valuenow={levelPercent(rms)} aria-valuemin={0} aria-valuemax={100}>
        <div className={styles.bar} data-active={rms >= noiseFloor || undefined} style={{ width: `${levelPercent(rms)}%` }} />
        <div className={styles.floor} style={{ left: `${levelPercent(noiseFloor)}%` }} />
      </div>
      <label className={styles.label}>
        Noise gate
        <input
          type="range"
          min={toDb(lo)}
          max={toDb(hi)}
          step={1}
          value={toDb(noiseFloor)}
          onChange={(e) => onNoiseFloorChange(fromDb(Number(e.target.value)))}
        />
        <span>{toDb(noiseFloor)} dB</span>
      </label>
    </div>
  )
}
```

`src/ui/pages/tuner/LevelMeter.module.css`:

```css
.wrap {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  margin-bottom: 1.25rem;
}

.meter {
  position: relative;
  flex: 1 1 12rem;
  height: 0.5rem;
  border-radius: 999px;
  background: var(--surface-2);
  overflow: hidden;
}

.bar {
  height: 100%;
  background: var(--text-dim);
  transition: width 60ms linear;
}

.bar[data-active] {
  background: var(--ok);
}

.floor {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--bad);
}

.label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--text-dim);
}
```

`src/ui/pages/tuner/TunerPage.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { buildHarp, findNotes, noteId, tabLabel, type HarpNote } from '../../../core/harmonica/harp'
import { keySpelling } from '../../../core/harmonica/keys'
import { noteName, type Spelling } from '../../../core/music/noteNames'
import { freqToMidi } from '../../../core/music/pitch'
import { AudioGate } from '../../components/AudioGate'
import { HarmonicaDiagram, type Highlight } from '../../components/HarmonicaDiagram'
import { MicErrorNotice } from '../../components/MicErrorNotice'
import { useNotePlayer } from '../../hooks/useNotePlayer'
import { usePitch } from '../../hooks/usePitch'
import { A4_RANGE } from '../../settings/settings'
import { useSettings } from '../../settings/SettingsContext'
import { LevelMeter } from './LevelMeter'
import { TunerReadout } from './TunerReadout'
import styles from './TunerPage.module.css'

type Mode = 'listen' | 'play'

interface ModeProps {
  harp: HarpNote[]
  spelling: Spelling
}

export function TunerPage() {
  return (
    <>
      <h1>Tuner</h1>
      <AudioGate>
        <Tuner />
      </AudioGate>
    </>
  )
}

function Tuner() {
  const { settings, update } = useSettings()
  const harp = useMemo(() => buildHarp(settings.key), [settings.key])
  const spelling = keySpelling(settings.key)
  const [mode, setMode] = useState<Mode>('listen')

  return (
    <>
      <div className={styles.toolbar}>
        <div role="group" aria-label="Mode" className={styles.segmented}>
          <button type="button" aria-pressed={mode === 'listen'} onClick={() => setMode('listen')}>
            🎤 Listen
          </button>
          <button type="button" aria-pressed={mode === 'play'} onClick={() => setMode('play')}>
            🔊 Play
          </button>
        </div>
        <label className={styles.field}>
          A4
          <input
            type="range"
            min={A4_RANGE[0]}
            max={A4_RANGE[1]}
            step={1}
            value={settings.a4}
            onChange={(e) => update({ a4: Number(e.target.value) })}
          />
          <span>{settings.a4} Hz</span>
        </label>
        <label className={styles.field}>
          <input
            type="checkbox"
            checked={settings.showAdvanced}
            onChange={(e) => update({ showAdvanced: e.target.checked })}
          />
          Advanced over-notes
        </label>
        <button
          type="button"
          aria-pressed={settings.labelMode === 'tab'}
          onClick={() => update({ labelMode: settings.labelMode === 'tab' ? 'note' : 'tab' })}
        >
          Tab labels
        </button>
      </div>
      {mode === 'listen' ? (
        <ListenMode harp={harp} spelling={spelling} />
      ) : (
        <PlayMode harp={harp} spelling={spelling} />
      )}
    </>
  )
}

function ListenMode({ harp, spelling }: ModeProps) {
  const { settings, update } = useSettings()
  const { reading, rms, status, error } = usePitch(true)

  const detected = reading ? freqToMidi(reading.freq, settings.a4) : null
  const matches = detected ? findNotes(harp, detected.midi) : []
  const highlights = new Map<string, Highlight>(matches.map((n) => [noteId(n), 'detected']))

  return (
    <>
      {error && <MicErrorNotice kind={error} />}
      {status === 'starting' && <p className={styles.hint}>Waiting for microphone permission…</p>}
      <TunerReadout
        reading={
          reading && detected
            ? {
                noteLabel: noteName(detected.midi, spelling),
                cents: detected.cents,
                freq: reading.freq,
                tabs: matches.map(tabLabel),
                onHarp: matches.length > 0,
              }
            : null
        }
      />
      <LevelMeter
        rms={rms}
        noiseFloor={settings.noiseFloor}
        onNoiseFloorChange={(noiseFloor) => update({ noiseFloor })}
      />
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

function PlayMode({ harp, spelling }: ModeProps) {
  const { settings } = useSettings()
  const player = useNotePlayer()
  const [sustain, setSustain] = useState(false)
  const [playing, setPlaying] = useState<HarpNote | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const byPitch = harp
    .filter((n) => settings.showAdvanced || n.common)
    .sort((a, b) => a.midi - b.midi || a.hole - b.hole)
  const selected = byPitch.find((n) => noteId(n) === selectedId) ?? byPitch[0]

  const startNote = (note: HarpNote) => {
    player.start(note.midi)
    setPlaying(note)
  }
  const stopNote = () => {
    player.stop()
    setPlaying(null)
  }
  const press = (note: HarpNote) => {
    if (sustain && playing && noteId(playing) === noteId(note)) stopNote()
    else startNote(note)
  }
  const release = () => {
    if (!sustain) stopNote()
  }

  const highlights = new Map<string, Highlight>(playing ? [[noteId(playing), 'target']] : [])

  return (
    <>
      <div className={styles.toolbar}>
        <label className={styles.field}>
          <input
            type="checkbox"
            checked={sustain}
            onChange={(e) => {
              setSustain(e.target.checked)
              stopNote()
            }}
          />
          Sustain
        </label>
        <label className={styles.field}>
          Note
          <select value={noteId(selected)} onChange={(e) => setSelectedId(e.target.value)}>
            {byPitch.map((n) => (
              <option key={noteId(n)} value={noteId(n)}>
                {noteName(n.midi, spelling)} — {tabLabel(n)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => (playing ? stopNote() : startNote(selected))}>
          {playing ? '■ Stop' : '▶ Play'}
        </button>
      </div>
      <p className={styles.hint}>
        {sustain ? 'Click a hole to start or stop its note.' : 'Press and hold a hole to hear it.'}
      </p>
      <HarmonicaDiagram
        harp={harp}
        spelling={spelling}
        labelMode={settings.labelMode}
        showAdvanced={settings.showAdvanced}
        highlights={highlights}
        onNoteDown={press}
        onNoteUp={release}
      />
    </>
  )
}
```

`src/ui/pages/tuner/TunerPage.module.css`:

```css
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.25rem;
  margin-bottom: 1rem;
}

.segmented {
  display: flex;
}

.segmented button:first-child {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.segmented button:last-child {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-left: none;
}

.field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.hint {
  color: var(--text-dim);
}
```

In `src/ui/App.tsx`, add the route:

```tsx
import { TunerPage } from './pages/tuner/TunerPage'

const ROUTES: Record<string, ComponentType> = {
  '/': HomePage,
  '/tuner': TunerPage,
}
```

- [ ] **Step 7: Run all checks**

Run: `npm test && npm run lint && npm run typecheck && npm run build`
Expected: all PASS / clean.

- [ ] **Step 8: Manual check in the browser (dev server + real harmonica)**

Run `npm run dev` and open `http://localhost:5173/#/tuner`:
1. "Tap to start audio" appears; tapping it shows the tuner.
2. The browser asks for the mic. Denying it shows the "permission was denied" notice, while the Play mode still works.
3. Allowing it: silence shows "Play a note…" and the level meter moves with room noise.
4. Playing hole 4 blow on a C harp shows `C5`, the cents needle, and highlights box `4`. Hole 2 draw highlights both `-2` and `3`.
5. A 3 draw whole-step bend lights up `-3''`. Change the key selector to match another harp and check that detection follows.
6. Play mode: press and hold a hole to hear it; release stops it. With Sustain on, a click toggles the note. Moving A4 to 442 shifts the pitch.

If you're implementing without a harp or mic, do 1, 2 and 6 and report 3–5 as needing the user's check.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: tuner page with live hole detection and reference notes"
```

---

### Task 13: Metronome page

**Files:**
- Create: `src/audio/Metronome.ts`, `src/ui/hooks/useMetronome.ts`, `src/ui/pages/metronome/MetronomePage.tsx`, `src/ui/pages/metronome/MetronomePage.module.css`
- Modify: `src/ui/App.tsx` (add the `/metronome` route)
- Test: `src/ui/pages/metronome/MetronomePage.test.tsx`

**Interfaces:**
- Consumes: `scheduleAhead`, `accentKind`, `TIME_SIGNATURES`, `MetronomeConfig`, `ClickKind`, `Subdivision`, `TimeSignature` (Task 5); `clampBpm`, `TapTempo`, `BPM_MIN`, `BPM_MAX` (Task 5); `audioEngine` (Task 8); `AudioGate` (Task 8); `useSettings` (Task 6)
- Produces:
  - `class Metronome { constructor(config: MetronomeConfig, onBeat: (pulse: number, kind: ClickKind) => void); readonly isRunning: boolean; setConfig(c: MetronomeConfig): void; start(): void; stop(): void }`
  - `useMetronome(config: MetronomeConfig): { running: boolean; beat: number | null; toggle(): void }`
  - `MetronomePage()` at route `/metronome`; its inner `MetronomePanel` is exported for testing

- [ ] **Step 1: Write the failing test**

The panel needs the audio engine only when started, so its tempo controls can be tested without Web Audio.

`src/ui/pages/metronome/MetronomePage.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SettingsProvider } from '../../settings/SettingsContext'
import { MetronomePanel } from './MetronomePage'

const renderPanel = () =>
  render(
    <SettingsProvider storage={null}>
      <MetronomePanel />
    </SettingsProvider>,
  )

describe('MetronomePanel', () => {
  it('adjusts the tempo within 30–250 BPM', () => {
    renderPanel()
    expect(screen.getByLabelText('BPM')).toHaveTextContent('90')
    fireEvent.click(screen.getByRole('button', { name: 'Faster' }))
    expect(screen.getByLabelText('BPM')).toHaveTextContent('91')
    fireEvent.change(screen.getByRole('slider', { name: 'Tempo' }), { target: { value: '250' } })
    fireEvent.click(screen.getByRole('button', { name: 'Faster' }))
    expect(screen.getByLabelText('BPM')).toHaveTextContent('250')
  })

  it('shows one beat dot per pulse of the time signature', () => {
    renderPanel()
    expect(screen.getAllByTestId('beat-dot')).toHaveLength(4)
    fireEvent.change(screen.getByLabelText('Time signature'), { target: { value: '6/8' } })
    const dots = screen.getAllByTestId('beat-dot')
    expect(dots).toHaveLength(6)
    expect(dots.map((d) => d.dataset.accent)).toEqual(['bar', 'beat', 'beat', 'group', 'beat', 'beat'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/pages/metronome`
Expected: FAIL — module `./MetronomePage` not found.

- [ ] **Step 3: Implement the audio metronome**

`src/audio/Metronome.ts`:

```ts
import { scheduleAhead, type Click, type ClickKind, type MetronomeConfig, type SchedulerState } from '../core/rhythm/schedule'
import { audioEngine } from './AudioEngine'

const TICK_MS = 25
const LOOKAHEAD_S = 0.1
const START_DELAY_S = 0.05

const CLICK_SOUND: Record<ClickKind, { freq: number; gain: number }> = {
  bar: { freq: 1600, gain: 0.6 },
  group: { freq: 1250, gain: 0.45 },
  beat: { freq: 1000, gain: 0.35 },
  sub: { freq: 800, gain: 0.15 },
}

export type BeatListener = (pulse: number, kind: ClickKind) => void

/**
 * Look-ahead scheduler: a coarse JS timer schedules clicks slightly ahead on the precise
 * audio clock, so timing stays tight even when the main thread is busy.
 */
export class Metronome {
  private timer: ReturnType<typeof setInterval> | undefined
  private state: SchedulerState = { nextTime: 0, pulse: 0, sub: 0 }
  private pendingBeats = new Set<ReturnType<typeof setTimeout>>()

  constructor(
    private config: MetronomeConfig,
    private readonly onBeat: BeatListener,
  ) {}

  get isRunning(): boolean {
    return this.timer !== undefined
  }

  setConfig(config: MetronomeConfig): void {
    this.config = config
  }

  start(): void {
    if (this.isRunning) return
    this.state = { nextTime: audioEngine.now() + START_DELAY_S, pulse: 0, sub: 0 }
    this.tick()
    this.timer = setInterval(this.tick, TICK_MS)
  }

  stop(): void {
    clearInterval(this.timer)
    this.timer = undefined
    this.pendingBeats.forEach(clearTimeout)
    this.pendingBeats.clear()
  }

  private tick = (): void => {
    const ctx = audioEngine.ctx
    const { clicks, state } = scheduleAhead(this.state, this.config, ctx.currentTime, LOOKAHEAD_S)
    this.state = state
    for (const click of clicks) {
      this.playClick(ctx, click)
      if (click.kind !== 'sub') this.notifyAt(ctx, click)
    }
  }

  private playClick(ctx: AudioContext, click: Click): void {
    const { freq, gain } = CLICK_SOUND[click.kind]
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.frequency.value = freq
    env.gain.setValueAtTime(gain, click.time)
    env.gain.exponentialRampToValueAtTime(0.001, click.time + 0.04)
    osc.connect(env).connect(audioEngine.master)
    osc.start(click.time)
    osc.stop(click.time + 0.05)
  }

  /** Fire the UI callback when the click is actually heard. */
  private notifyAt(ctx: AudioContext, click: Click): void {
    const delayMs = Math.max(0, (click.time - ctx.currentTime) * 1000)
    const id = setTimeout(() => {
      this.pendingBeats.delete(id)
      this.onBeat(click.pulse, click.kind)
    }, delayMs)
    this.pendingBeats.add(id)
  }
}
```

`src/ui/hooks/useMetronome.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { Metronome } from '../../audio/Metronome'
import type { MetronomeConfig } from '../../core/rhythm/schedule'

/** `config` should be memoised by the caller; changes apply live while running. */
export function useMetronome(config: MetronomeConfig) {
  const [running, setRunning] = useState(false)
  const [beat, setBeat] = useState<number | null>(null)
  const [metronome] = useState(() => new Metronome(config, (pulse) => setBeat(pulse)))

  useEffect(() => metronome.setConfig(config), [metronome, config])
  useEffect(() => () => metronome.stop(), [metronome])

  const toggle = useCallback(() => {
    if (metronome.isRunning) {
      metronome.stop()
      setRunning(false)
      setBeat(null)
    } else {
      metronome.start()
      setRunning(true)
    }
  }, [metronome])

  return { running, beat, toggle }
}
```

- [ ] **Step 4: Implement the page**

`src/ui/pages/metronome/MetronomePage.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { TIME_SIGNATURES, accentKind, type Subdivision, type TimeSignature } from '../../../core/rhythm/schedule'
import { BPM_MAX, BPM_MIN, TapTempo, clampBpm } from '../../../core/rhythm/tempo'
import { AudioGate } from '../../components/AudioGate'
import { useMetronome } from '../../hooks/useMetronome'
import { useSettings } from '../../settings/SettingsContext'
import styles from './MetronomePage.module.css'

const SUBDIVISIONS: { value: Subdivision; label: string }[] = [
  { value: 1, label: 'Off' },
  { value: 2, label: '2 per beat' },
  { value: 3, label: '3 per beat (triplets)' },
  { value: 4, label: '4 per beat' },
]

export function MetronomePage() {
  return (
    <>
      <h1>Metronome</h1>
      <AudioGate>
        <MetronomePanel />
      </AudioGate>
    </>
  )
}

export function MetronomePanel() {
  const { settings, update } = useSettings()
  const [signature, setSignature] = useState<TimeSignature>(TIME_SIGNATURES[2])
  const [subdivision, setSubdivision] = useState<Subdivision>(1)
  const [tapper] = useState(() => new TapTempo())

  const config = useMemo(
    () => ({ bpm: settings.bpm, signature, subdivision }),
    [settings.bpm, signature, subdivision],
  )
  const { running, beat, toggle } = useMetronome(config)
  const setBpm = (bpm: number) => update({ bpm: clampBpm(bpm) })

  // Space toggles, unless a control has focus (buttons already treat Space as a click).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      if (e.target instanceof HTMLElement && e.target.closest('input, select, textarea, button')) return
      e.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  return (
    <div className={styles.panel}>
      <div className={styles.tempo}>
        <button type="button" aria-label="Slower" onClick={() => setBpm(settings.bpm - 1)}>
          −
        </button>
        <output className={styles.bpm} aria-label="BPM">
          {settings.bpm}
        </output>
        <button type="button" aria-label="Faster" onClick={() => setBpm(settings.bpm + 1)}>
          +
        </button>
      </div>
      <input
        className={styles.slider}
        type="range"
        aria-label="Tempo"
        min={BPM_MIN}
        max={BPM_MAX}
        value={settings.bpm}
        onChange={(e) => setBpm(Number(e.target.value))}
      />

      <div className={styles.beats} aria-hidden>
        {Array.from({ length: signature.beats }, (_, i) => (
          <span
            key={i}
            className={styles.dot}
            data-testid="beat-dot"
            data-accent={accentKind(i, signature)}
            data-active={beat === i || undefined}
          />
        ))}
      </div>

      <div className={styles.controls}>
        <label>
          Time signature{' '}
          <select
            aria-label="Time signature"
            value={signature.label}
            onChange={(e) => setSignature(TIME_SIGNATURES.find((s) => s.label === e.target.value)!)}
          >
            {TIME_SIGNATURES.map((s) => (
              <option key={s.label} value={s.label}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Subdivision{' '}
          <select
            value={subdivision}
            onChange={(e) => setSubdivision(Number(e.target.value) as Subdivision)}
          >
            {SUBDIVISIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            const bpm = tapper.tap(performance.now())
            if (bpm !== null) setBpm(bpm)
          }}
        >
          Tap tempo
        </button>
      </div>

      <button type="button" className={styles.startStop} aria-pressed={running} onClick={toggle}>
        {running ? '■ Stop' : '▶ Start'}
      </button>
      <p className={styles.hint}>Press Space to start or stop.</p>
    </div>
  )
}
```

`src/ui/pages/metronome/MetronomePage.module.css`:

```css
.panel {
  display: grid;
  justify-items: center;
  gap: 1.25rem;
  max-width: 32rem;
  margin: 1rem auto;
}

.tempo {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.tempo button {
  width: 3rem;
  height: 3rem;
  padding: 0;
  font-size: 1.5rem;
  border-radius: 50%;
}

.bpm {
  min-width: 5ch;
  font-size: 4rem;
  font-weight: 700;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.slider {
  width: 100%;
}

.beats {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.6rem;
}

.dot {
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 50%;
  background: var(--surface-2);
  border: 2px solid var(--border);
  transition: background 40ms;
}

.dot[data-accent='bar'] {
  border-color: var(--accent);
}

.dot[data-accent='group'] {
  border-color: var(--text-dim);
}

.dot[data-active] {
  background: var(--accent);
}

.controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 0.75rem 1.25rem;
}

.startStop {
  min-width: 10rem;
  padding: 0.85rem 2rem;
  font-size: 1.25rem;
}

.hint {
  margin: 0;
  color: var(--text-dim);
  font-size: 0.85rem;
}
```

In `src/ui/App.tsx`, add the route:

```tsx
import { MetronomePage } from './pages/metronome/MetronomePage'

const ROUTES: Record<string, ComponentType> = {
  '/': HomePage,
  '/tuner': TunerPage,
  '/metronome': MetronomePage,
}
```

- [ ] **Step 5: Run all checks**

Run: `npm test && npm run lint && npm run typecheck && npm run build`
Expected: all PASS / clean.

- [ ] **Step 6: Manual check in the browser**

Open `http://localhost:5173/#/metronome`:
1. Start at 90 BPM: steady clicks, an accented first beat, and the dots flash in time with the sound.
2. Drag the tempo while it's running: the tempo changes smoothly, with no double clicks.
3. 6/8 accents pulses 1 and 4. Subdivisions add quieter clicks. Tap tempo, with 4 taps, sets the BPM.
4. Space toggles start/stop (click on empty page space first so no control has focus).
5. Switch to another browser tab for 10 s and come back: no burst of catch-up clicks.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: metronome with accents, subdivisions and tap tempo"
```

---

### Task 14: Wrap-up — README, full verification

**Files:**
- Modify: `README.md` (status badge, getting-started note, roadmap)

**Interfaces:**
- Consumes: everything above
- Produces: an up-to-date README; a green, buildable `main`

- [ ] **Step 1: Update the README**

In `README.md`:
- Change the badge `![Status](https://img.shields.io/badge/status-in%20design-orange)` to `![Status](https://img.shields.io/badge/status-in%20development-yellow)`.
- Replace the line `> The project is currently in the design phase — code is on its way.` with `> The tuner and metronome work today; the games are next.`
- In **Roadmap**, tick the first three items:

```markdown
- [x] Core note model — all 12 keys, bends, overblows, overdraws
- [x] Audio engine — mic, pitch detection, synth note player, metronome
- [x] Metronome and tuner
```

- [ ] **Step 2: Full verification**

Run: `npm test && npm run lint && npm run typecheck && npm run build && npx vite preview --port 4173`
Expected: all green. `http://localhost:4173` serves the built site. The home, tuner and metronome pages work from the production build, including hash links and the relative asset paths.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: update README for working tuner and metronome"
```

The pre-commit hook refreshes the "Built by agents" section automatically if the user has enabled `core.hooksPath`. If `git config --get core.hooksPath` prints nothing, run `bun run usage:self` and amend it into this commit (`git add README.md && git commit --amend --no-edit`).
