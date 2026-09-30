# Installable, offline and phone-friendly — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Harp Tools installable, able to open offline after one visit, usable at 360 px without swiping sideways, and keep the screen on while the mic or audio runs.

**Architecture:**
- `vite-plugin-pwa` (Workbox `generateSW`, `registerType: 'prompt'`) precaches the whole build. The UI gets two small components: an update/offline bar in `App`, and an install button on the home page.
- A ref-counted `ScreenAwake` module in `src/audio/` is held by `Microphone`, `Metronome` and `BackingScheduler`.
- Phone layout is CSS-first: a container query on the harmonica chart and a media query on the header and metronome. JS is used only where CSS can't do the job: the transposed health table (via `useMediaQuery`) and the note-slot auto-scroll.

**Tech Stack:** Vite 8, React 19, TypeScript (strict), Vitest + React Testing Library (jsdom), `vite-plugin-pwa` 1.3, `workbox-window` 7, `@vite-pwa/assets-generator` 1.x.

**Spec:** `docs/superpowers/specs/2026-09-30-pwa-and-mobile-design.md`

## Global Constraints

- Target phone viewport: **360 × 740 CSS px**. The only element allowed to scroll sideways is `.slots` (the note-slot row).
- Chart compact breakpoint: `@container (max-width: 34rem)` on the chart's `.wrap`. Header/metronome breakpoint: `@media (max-width: 30rem)`. Health table breakpoint: `(max-width: 34rem)`.
- Manifest: `name`/`short_name` "Harp Tools"; `description` "Practice tools and ear-training games for diatonic harmonica"; `display: standalone`; no forced `orientation`; `start_url: './'`, `scope: './'`; `theme_color` and `background_color` `#14161a`.
- Every URL in `dist/manifest.webmanifest` and `dist/index.html` must be relative. The same build serves `/harp-tools/` on GitHub Pages and any other sub-path.
- Updates never reload by themselves: only the **Reload** button calls `updateServiceWorker(true)`.
- Copy, exactly:
  - "A new version is ready"
  - "Reload"
  - "Ready to work offline"
  - "Install app"
  - "On iPhone or iPad: Share → Add to Home Screen"
- A missing Wake Lock API, a refused Wake Lock request, or a missing service worker: silent no-op, no UI message.
- Existing conventions still apply:
  - `useSpelling()` for note names;
  - mic pages must not re-render per frame;
  - **stable-layout rule:** anything that can appear during a session has its space reserved, or sits outside the flow (`position: fixed`).
- Commit style: Conventional Commits (`feat(pwa): …`, `fix(ui): …`), each ending with the `Co-Authored-By` trailer the session provides.
- Commands: `npm test` (all tests), `npx vitest run <path>` (one file), `npm run typecheck`, `npm run lint`, `npm run build`.

## Review Focus

1. **Wake Lock refused (battery saver).** Expected: no retry loop; exactly one request per new hold or per return to visibility. Pinned in Task 1 ("a refused request is not retried in a loop").
2. **Mic unplugged or permission revoked mid-session.** Expected: the wake lock is released even though nobody called `release()`. Pinned in Task 2 ("releases the screen when the stream ends on its own").
3. **Tab labels on the compact chart.** The widest labels (`-3'''`, `10''`, `-10`) with advanced over-notes on must fit a ~30 px column without clipping. Pinned in Task 10's sweep: no chart cell may have `scrollWidth > clientWidth`.
4. **Browsers or tests without `window.matchMedia`.** Expected: `useMediaQuery` returns `false` and the page renders the wide layout instead of crashing. Pinned in Task 8 ("returns false when matchMedia is missing").
5. **App hidden while the metronome runs, then shown again.** Expected: the lock is requested again (browsers drop it on hide). Pinned in Task 1 ("asks again when the page becomes visible while held").

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `src/audio/screenAwake.ts` | create | ref-counted Wake Lock wrapper, `screenAwake` singleton |
| `src/audio/screenAwake.test.ts` | create | its tests |
| `src/audio/Microphone.ts`, `Metronome.ts`, `backing/BackingScheduler.ts` | modify | hold the screen while running |
| `vite.config.ts`, `tsconfig.json`, `index.html`, `package.json` | modify | PWA plugin, types, meta tags, scripts |
| `public/icon.svg` + generated PNG/ICO | create | app icons |
| `scripts/check-pwa.ts` | create | post-build assertions |
| `.github/workflows/deploy.yml` | modify | run lint + `check:pwa` |
| `src/test/pwaRegisterStub.ts` | create | Vitest stand-in for `virtual:pwa-register/react` |
| `src/ui/components/UpdateBar.tsx` (+ `.module.css`, `.test.tsx`) | create | offline-ready / new-version bar |
| `src/ui/components/InstallButton.tsx` (+ `.module.css`, `.test.tsx`) | create | install prompt / iOS hint |
| `src/ui/App.tsx`, `App.module.css`, `pages/HomePage.tsx` | modify | mount the two components, safe areas |
| `src/ui/components/HarmonicaDiagram.tsx` / `.module.css` / `.test.tsx` | modify | compact mode, octave span |
| `src/ui/components/Header.tsx` / `.module.css` / `.test.tsx` | modify | two-row phone header |
| `src/ui/pages/metronome/MetronomePage.module.css` | modify | 2 px overflow |
| `src/ui/hooks/useMediaQuery.ts` (+ `.test.ts`) | create | `matchMedia` hook |
| `src/ui/pages/health/HealthCheckPage.tsx` / `.module.css` / `.test.tsx` | modify | transposed table |
| `src/ui/components/game/NoteSlots.tsx` (+ `.test.tsx`), `Game.module.css` | modify | keep the current slot in view |
| `README.md` | modify | mention install/offline |

---

### Task 1: `ScreenAwake`, the ref-counted wake lock

**Files:**
- Create: `src/audio/screenAwake.ts`
- Test: `src/audio/screenAwake.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface KeepAwake { hold(): () => void }`
  - `interface WakeLockSentinelLike { release(): Promise<void>; addEventListener(type: 'release', listener: () => void): void }`
  - `interface WakeLockApi { request(type: 'screen'): Promise<WakeLockSentinelLike> }`
  - `interface VisibilitySource { readonly visibilityState: DocumentVisibilityState; addEventListener(type: 'visibilitychange', listener: () => void): void }`
  - `class ScreenAwake implements KeepAwake { constructor(api?: WakeLockApi, doc?: VisibilitySource) }`
  - `const screenAwake: ScreenAwake`

- [ ] **Step 1: Write the failing tests**

`src/audio/screenAwake.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { ScreenAwake, type VisibilitySource, type WakeLockApi } from './screenAwake'

/** A fake Wake Lock API whose requests resolve (or reject) when the test says so. */
function fakeApi() {
  const sentinels: { release: ReturnType<typeof vi.fn>; drop: () => void }[] = []
  const pending: { resolve: () => void; reject: () => void }[] = []
  const api: WakeLockApi = {
    request: vi.fn(
      () =>
        new Promise((resolve, reject) => {
          const listeners: (() => void)[] = []
          const sentinel = {
            release: vi.fn(async () => listeners.forEach((l) => l())),
            addEventListener: (_t: 'release', l: () => void) => listeners.push(l),
            /** The browser drops the lock by itself (tab hidden). */
            drop: () => listeners.forEach((l) => l()),
          }
          pending.push({
            resolve: () => {
              sentinels.push(sentinel)
              resolve(sentinel)
            },
            reject: () => reject(new DOMException('no', 'NotAllowedError')),
          })
        }),
    ),
  }
  return { api, sentinels, pending }
}

function fakeDoc() {
  let listener: (() => void) | undefined
  const doc = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (_t: 'visibilitychange', l: () => void) => {
      listener = l
    },
  }
  const setVisibility = (state: DocumentVisibilityState) => {
    doc.visibilityState = state
    listener?.()
  }
  return { doc: doc as VisibilitySource, setVisibility }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('ScreenAwake', () => {
  it('requests the lock on the first hold and releases it after the last', async () => {
    const { api, sentinels, pending } = fakeApi()
    const awake = new ScreenAwake(api, fakeDoc().doc)

    const a = awake.hold()
    const b = awake.hold()
    expect(api.request).toHaveBeenCalledTimes(1)
    pending[0].resolve()
    await flush()

    a()
    expect(sentinels[0].release).not.toHaveBeenCalled()
    b()
    expect(sentinels[0].release).toHaveBeenCalledTimes(1)
  })

  it('treats a second call of the same release function as a no-op', async () => {
    const { api, sentinels, pending } = fakeApi()
    const awake = new ScreenAwake(api, fakeDoc().doc)
    const a = awake.hold()
    const b = awake.hold()
    pending[0].resolve()
    await flush()

    a()
    a()
    expect(sentinels[0].release).not.toHaveBeenCalled()
    b()
    expect(sentinels[0].release).toHaveBeenCalledTimes(1)
  })

  it('asks again when the page becomes visible while held', async () => {
    const { api, sentinels, pending } = fakeApi()
    const { doc, setVisibility } = fakeDoc()
    const awake = new ScreenAwake(api, doc)
    awake.hold()
    pending[0].resolve()
    await flush()

    sentinels[0].drop()
    setVisibility('hidden')
    expect(api.request).toHaveBeenCalledTimes(1)
    setVisibility('visible')
    expect(api.request).toHaveBeenCalledTimes(2)
  })

  it('does not ask on visibility when nothing is held', () => {
    const { api } = fakeApi()
    const { setVisibility } = (() => {
      const d = fakeDoc()
      new ScreenAwake(api, d.doc)
      return d
    })()
    setVisibility('visible')
    expect(api.request).not.toHaveBeenCalled()
  })

  it('is a no-op without the Wake Lock API', () => {
    const awake = new ScreenAwake(undefined, fakeDoc().doc)
    const release = awake.hold()
    expect(() => release()).not.toThrow()
  })

  it('a refused request is not retried in a loop', async () => {
    const { api, pending } = fakeApi()
    const awake = new ScreenAwake(api, fakeDoc().doc)
    awake.hold()
    pending[0].reject()
    await flush()
    await flush()
    expect(api.request).toHaveBeenCalledTimes(1)
    // A new hold is a new user action, so one more try is fine.
    awake.hold()
    expect(api.request).toHaveBeenCalledTimes(2)
  })

  it('releases a lock that arrives after everyone let go', async () => {
    const { api, sentinels, pending } = fakeApi()
    const awake = new ScreenAwake(api, fakeDoc().doc)
    const release = awake.hold()
    release()
    pending[0].resolve()
    await flush()
    expect(sentinels[0].release).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `npx vitest run src/audio/screenAwake.test.ts`
Expected: FAIL, because `./screenAwake` cannot be resolved.

- [ ] **Step 3: Implement**

`src/audio/screenAwake.ts`:

```ts
/** Something that can keep the screen on while at least one caller holds it. */
export interface KeepAwake {
  /** Keep the screen on until the returned function is called (calling it twice is harmless). */
  hold(): () => void
}

export interface WakeLockSentinelLike {
  release(): Promise<void>
  addEventListener(type: 'release', listener: () => void): void
}

export interface WakeLockApi {
  request(type: 'screen'): Promise<WakeLockSentinelLike>
}

export interface VisibilitySource {
  readonly visibilityState: DocumentVisibilityState
  addEventListener(type: 'visibilitychange', listener: () => void): void
}

function browserWakeLock(): WakeLockApi | undefined {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return undefined
  return navigator.wakeLock as unknown as WakeLockApi
}

/**
 * Keeps the screen on while the mic listens or the app plays, so a phone on a music stand
 * doesn't sleep mid-exercise. Browsers drop the lock whenever the page is hidden, so it is
 * requested again on return. Unsupported or refused requests are silently ignored.
 */
export class ScreenAwake implements KeepAwake {
  private holds = 0
  private sentinel: WakeLockSentinelLike | null = null
  private requesting = false

  constructor(
    private readonly api: WakeLockApi | undefined = browserWakeLock(),
    doc: VisibilitySource | undefined = typeof document === 'undefined' ? undefined : document,
  ) {
    doc?.addEventListener('visibilitychange', () => {
      if (doc.visibilityState === 'visible') this.sync()
    })
  }

  hold(): () => void {
    this.holds++
    this.sync()
    let released = false
    return () => {
      if (released) return
      released = true
      this.holds--
      this.sync()
    }
  }

  private sync(): void {
    if (!this.api) return
    if (this.holds > 0 && !this.sentinel && !this.requesting) {
      void this.request(this.api)
    } else if (this.holds === 0 && this.sentinel) {
      const sentinel = this.sentinel
      this.sentinel = null
      sentinel.release().catch(() => {})
    }
  }

  private async request(api: WakeLockApi): Promise<void> {
    this.requesting = true
    try {
      const sentinel = await api.request('screen')
      sentinel.addEventListener('release', () => {
        if (this.sentinel === sentinel) this.sentinel = null
      })
      this.sentinel = sentinel
    } catch {
      // Refused (battery saver, hidden page, permissions policy). No retry here: the next
      // hold() or return to the page tries again, so a refusal can't loop.
      return
    } finally {
      this.requesting = false
    }
    this.sync() // everyone may have let go while the request was pending
  }
}

export const screenAwake = new ScreenAwake()
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `npx vitest run src/audio/screenAwake.test.ts && npm run typecheck`
Expected: 7 passed; typecheck clean. If `tsc` rejects `document` as a `VisibilitySource` because of the overloads, change the default to `document as VisibilitySource`.

- [ ] **Step 5: Commit**

```bash
git add src/audio/screenAwake.ts src/audio/screenAwake.test.ts
git commit -m "feat(audio): ref-counted screen wake lock"
```

---

### Task 2: Mic, metronome and band keep the screen on

**Files:**
- Modify: `src/audio/Microphone.ts`, `src/audio/Metronome.ts`, `src/audio/backing/BackingScheduler.ts`
- Test: `src/audio/Microphone.test.ts`, `src/audio/Metronome.test.ts`, `src/audio/backing/BackingScheduler.test.ts`

**Interfaces:**
- Consumes: `KeepAwake`, `screenAwake` from `src/audio/screenAwake.ts` (Task 1).
- Produces (new optional trailing constructor parameters; defaults keep every existing call site working):
  - `new Microphone(awake?: KeepAwake)`
  - `new Metronome(config, onBeat, awake?: KeepAwake)`
  - `new BackingScheduler(config, onBar, mix?: Mix, awake?: KeepAwake)`

- [ ] **Step 1: Write the failing tests**

Add this helper at the top of each of the three test files (after the imports), plus `import type { KeepAwake } from './screenAwake'` (use `'../screenAwake'` in `backing/`):

```ts
/** Counts how many holds are currently active. */
function fakeAwake() {
  let active = 0
  const awake: KeepAwake = {
    hold: () => {
      active++
      let done = false
      return () => {
        if (!done) active--
        done = true
      }
    },
  }
  return { awake, active: () => active }
}
```

In `src/audio/Microphone.test.ts`, inside `describe('Microphone', …)`:

```ts
  it('holds the screen while the mic is open', async () => {
    const { stream } = fakeStream()
    stubMediaDevices(vi.fn().mockResolvedValue(stream))
    vi.spyOn(audioEngine, 'ctx', 'get').mockReturnValue(fakeCtx())
    const { awake, active } = fakeAwake()
    const mic = new Microphone(awake)

    await mic.acquire()
    expect(active()).toBe(1)
    mic.release()
    expect(active()).toBe(0)
  })

  it('releases the screen when the stream ends on its own', async () => {
    const { stream, track } = fakeStream()
    stubMediaDevices(vi.fn().mockResolvedValue(stream))
    vi.spyOn(audioEngine, 'ctx', 'get').mockReturnValue(fakeCtx())
    const { awake, active } = fakeAwake()
    const mic = new Microphone(awake)

    await mic.acquire()
    track.end()
    expect(active()).toBe(0)
  })

  it('does not hold the screen when opening fails', async () => {
    stubMediaDevices(vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')))
    const { awake, active } = fakeAwake()
    const mic = new Microphone(awake)

    await expect(mic.acquire()).rejects.toMatchObject({ kind: 'denied' })
    expect(active()).toBe(0)
  })
```

In `src/audio/Metronome.test.ts`, inside `describe('Metronome', …)`:

```ts
  it('holds the screen from start() to stop(), once', () => {
    const { awake, active } = fakeAwake()
    const metronome = new Metronome(makeConfig(), vi.fn(), awake)

    metronome.start()
    metronome.start()
    expect(active()).toBe(1)
    metronome.stop()
    expect(active()).toBe(0)
    metronome.stop()
    expect(active()).toBe(0)
  })
```

In `src/audio/backing/BackingScheduler.test.ts`, inside `describe('BackingScheduler', …)`:

```ts
  it('holds the screen while playing, and releases it on stop and on dispose', () => {
    const { awake, active } = fakeAwake()
    const s = new BackingScheduler(CONFIG, vi.fn(), DEFAULT_MIX, awake)

    s.start()
    expect(active()).toBe(1)
    s.stop()
    expect(active()).toBe(0)
    s.start()
    s.dispose()
    expect(active()).toBe(0)
  })
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `npx vitest run src/audio/Microphone.test.ts src/audio/Metronome.test.ts src/audio/backing/BackingScheduler.test.ts`
Expected: the 5 new tests FAIL (`active()` stays 0). TypeScript may also flag the extra constructor argument; Vitest still runs.

- [ ] **Step 3: Implement**

`src/audio/Microphone.ts`:
- add `import { screenAwake, type KeepAwake } from './screenAwake'`;
- add a field and a constructor to the class;
- take the hold where the stream is stored;
- drop it in `close()`.

```ts
export class Microphone {
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private pending: Promise<AnalyserNode> | null = null
  private users = 0
  private endedListeners = new Set<() => void>()
  private releaseScreen: (() => void) | null = null

  constructor(private readonly awake: KeepAwake = screenAwake) {}
```

In `open()`, replace `this.stream = stream` with:

```ts
    this.stream = stream
    this.releaseScreen = this.awake.hold()
```

Replace `close()` with:

```ts
  private close(): void {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.source?.disconnect()
    this.stream = null
    this.source = null
    this.pending = null
    this.releaseScreen?.()
    this.releaseScreen = null
  }
```

`src/audio/Metronome.ts`:
- add `import { screenAwake, type KeepAwake } from './screenAwake'`;
- extend the constructor and `start`/`stop`.

```ts
  private releaseScreen: (() => void) | null = null

  constructor(
    private config: MetronomeConfig,
    private readonly onBeat: BeatListener,
    private readonly awake: KeepAwake = screenAwake,
  ) {}
```

```ts
  start(): void {
    if (this.isRunning) return
    this.releaseScreen = this.awake.hold()
    this.state = { nextTime: audioEngine.now() + START_DELAY_S, pulse: 0, sub: 0 }
    this.tick()
    this.timer = setInterval(this.tick, TICK_MS)
  }

  stop(): void {
    clearInterval(this.timer)
    this.timer = undefined
    this.pendingBeats.forEach(clearTimeout)
    this.pendingBeats.clear()
    this.releaseScreen?.()
    this.releaseScreen = null
  }
```

`src/audio/backing/BackingScheduler.ts`:
- add `import { screenAwake, type KeepAwake } from '../screenAwake'`;
- add `private releaseScreen: (() => void) | null = null`;
- extend the constructor:

```ts
  constructor(
    private config: BackingConfig,
    private readonly onBar: BarListener,
    private mix: Mix = DEFAULT_MIX,
    private readonly awake: KeepAwake = screenAwake,
  ) {}
```

In `start()`, right after `if (this.isRunning) return`, add `this.releaseScreen = this.awake.hold()`. In `stop()`, after `this.pendingBars.clear()`, add:

```ts
    this.releaseScreen?.()
    this.releaseScreen = null
```

`dispose()` already calls `stop()`.

- [ ] **Step 4: Run the tests and see them pass**

Run: `npm test && npm run typecheck`
Expected: the whole suite passes (837 existing + 12 new so far). In jsdom `navigator.wakeLock` is undefined, so the default singleton is a no-op and existing tests are unaffected.

- [ ] **Step 5: Commit**

```bash
git add src/audio
git commit -m "feat(audio): keep the screen on while the mic, metronome or band runs"
```

---

### Task 3: PWA build: plugin, manifest, icons, build check

**Files:**
- Modify: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.github/workflows/deploy.yml`
- Create: `public/icon.svg`, generated `public/pwa-64x64.png`, `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/maskable-icon-512x512.png`, `public/apple-touch-icon-180x180.png`, `public/favicon.ico`
- Create: `scripts/check-pwa.ts`, `src/test/pwaRegisterStub.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - the virtual module `virtual:pwa-register/react` (typed via `vite-plugin-pwa/react`);
  - the Vitest stub `src/test/pwaRegisterStub.ts` exporting `pwaStub` and `useRegisterSW`, used by Task 4;
  - the npm scripts `icons` and `check:pwa`.

- [ ] **Step 1: Install**

```bash
npm install workbox-window@^7.4.1
npm install -D vite-plugin-pwa@^1.3.0 @vite-pwa/assets-generator@^1.0.4
```

- [ ] **Step 2: Write the build check first (it is this task's test)**

`scripts/check-pwa.ts` (run with Node's built-in type stripping; erasable syntax only, no enums):

```ts
// Post-build checks for the installable/offline build. Run after `npm run build`.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIST = 'dist'
const errors: string[] = []
const need = (file: string) => {
  if (!existsSync(join(DIST, file))) errors.push(`missing dist/${file}`)
}
/** Relative to the page: no scheme, no protocol-relative `//`, no leading `/`. */
const isRelative = (url: string) => !/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith('/')

need('index.html')
need('sw.js')
need('manifest.webmanifest')

if (existsSync(join(DIST, 'manifest.webmanifest'))) {
  const manifest = JSON.parse(readFileSync(join(DIST, 'manifest.webmanifest'), 'utf8')) as {
    start_url?: string
    scope?: string
    display?: string
    icons?: { src: string; purpose?: string }[]
  }
  for (const key of ['start_url', 'scope'] as const) {
    const value = manifest[key]
    if (typeof value !== 'string' || !isRelative(value)) errors.push(`manifest ${key} is not relative: ${value}`)
  }
  if (manifest.display !== 'standalone') errors.push(`manifest display is ${manifest.display}`)
  const icons = manifest.icons ?? []
  if (icons.length === 0) errors.push('manifest has no icons')
  if (!icons.some((i) => i.purpose?.includes('maskable'))) errors.push('manifest has no maskable icon')
  for (const icon of icons) {
    if (!isRelative(icon.src)) errors.push(`icon src is not relative: ${icon.src}`)
    need(icon.src)
  }
}

if (existsSync(join(DIST, 'index.html'))) {
  const html = readFileSync(join(DIST, 'index.html'), 'utf8')
  if (!html.includes('manifest.webmanifest')) errors.push('index.html does not link the manifest')
  for (const [, url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (!isRelative(url) && !url.startsWith('https://')) errors.push(`index.html URL is not relative: ${url}`)
  }
}

if (errors.length > 0) {
  console.error(`check:pwa failed:\n- ${errors.join('\n- ')}`)
  process.exit(1)
}
console.log('check:pwa ok')
```

In `package.json` `scripts`, add:

```json
    "check:pwa": "node scripts/check-pwa.ts",
    "icons": "pwa-assets-generator --preset minimal-2023 public/icon.svg"
```

- [ ] **Step 3: Run the check and see it fail**

Run: `npm run build && npm run check:pwa`
Expected: FAIL with `missing dist/sw.js` and `missing dist/manifest.webmanifest`.

- [ ] **Step 4: Icon**

`public/icon.svg`: a dark rounded square with two rows of five holes. The mark sits inside the central 80% so maskable crops keep it.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#14161a"/>
  <rect x="96" y="176" width="320" height="160" rx="28" fill="#f0b429"/>
  <g fill="#14161a">
    <rect x="124" y="212" width="36" height="36" rx="6"/>
    <rect x="176" y="212" width="36" height="36" rx="6"/>
    <rect x="228" y="212" width="36" height="36" rx="6"/>
    <rect x="280" y="212" width="36" height="36" rx="6"/>
    <rect x="332" y="212" width="36" height="36" rx="6"/>
    <rect x="124" y="264" width="36" height="36" rx="6"/>
    <rect x="176" y="264" width="36" height="36" rx="6"/>
    <rect x="228" y="264" width="36" height="36" rx="6"/>
    <rect x="280" y="264" width="36" height="36" rx="6"/>
    <rect x="332" y="264" width="36" height="36" rx="6"/>
  </g>
</svg>
```

Before committing, check that `#f0b429` matches `--accent` in `src/ui/theme.css`. If not, use the `--accent` value.

Run: `npm run icons`
Expected: writes `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png` and `favicon.ico` into `public/`.

- [ ] **Step 5: Configure the plugin**

`vite.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // A new version waits for the user's Reload (UpdateBar); it never reloads mid-session.
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Harp Tools',
        short_name: 'Harp Tools',
        description: 'Practice tools and ear-training games for diatonic harmonica',
        display: 'standalone',
        start_url: './',
        scope: './',
        theme_color: '#14161a',
        background_color: '#14161a',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // No runtime fetches: precaching the build is the whole offline story.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
    }),
  ],
  // Relative base + hash routing: the build works from any sub-path (GitHub Pages or own server).
  base: './',
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
    alias: {
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/test/pwaRegisterStub.ts', import.meta.url),
      ),
    },
  },
})
```

`tsconfig.json`: change `"types": ["vite/client"]` to `"types": ["vite/client", "vite-plugin-pwa/react"]`.

`index.html` `<head>`:
- change the viewport meta to `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />`;
- add after the theme-color meta:

```html
    <meta name="description" content="Practice tools and ear-training games for diatonic harmonica" />
    <link rel="icon" href="./favicon.ico" sizes="48x48" />
    <link rel="icon" href="./icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="./apple-touch-icon-180x180.png" />
```

- [ ] **Step 6: Vitest stub for the virtual module**

`src/test/pwaRegisterStub.ts`:

```ts
import { useState } from 'react'

/** Test control for `virtual:pwa-register/react` (aliased here in vite.config.ts). */
export const pwaStub = {
  offlineReady: false,
  needRefresh: false,
  updateServiceWorker: async (_reload?: boolean): Promise<void> => {},
  reset() {
    this.offlineReady = false
    this.needRefresh = false
    this.updateServiceWorker = async () => {}
  },
}

export function useRegisterSW(_options?: unknown) {
  const offlineReady = useState(pwaStub.offlineReady)
  const needRefresh = useState(pwaStub.needRefresh)
  return {
    offlineReady,
    needRefresh,
    updateServiceWorker: (reload?: boolean) => pwaStub.updateServiceWorker(reload),
  }
}
```

- [ ] **Step 7: CI**

In `.github/workflows/deploy.yml`, replace the build job's `- run: npm test` / `- run: npm run build` steps with:

```yaml
      - run: npm run lint
      - run: npm test
      - run: npm run build
      - run: npm run check:pwa
```

- [ ] **Step 8: Run everything**

Run: `npm run lint && npm test && npm run build && npm run check:pwa`
Expected: all green; the last line is `check:pwa ok`.

If lint fails only on pre-existing code, not on files this plan touches: do **not** fix it here. Leave `npm run lint` out of the workflow, note it in the task report, and continue.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json index.html public scripts/check-pwa.ts src/test/pwaRegisterStub.ts .github/workflows/deploy.yml
git commit -m "feat(pwa): installable, offline build with icons and a post-build check"
```

---

### Task 4: Update bar (new version / ready offline)

**Files:**
- Create: `src/ui/components/UpdateBar.tsx`, `src/ui/components/UpdateBar.module.css`, `src/ui/components/UpdateBar.test.tsx`
- Modify: `src/ui/App.tsx`, `src/ui/App.module.css`

**Interfaces:**
- Consumes: `useRegisterSW` from `virtual:pwa-register/react`, and in tests `pwaStub` from `src/test/pwaRegisterStub.ts` (Task 3).
- Produces: `function UpdateBar(): JSX.Element | null`, exported constant `OFFLINE_NOTICE_MS = 6000`.

- [ ] **Step 1: Write the failing tests**

`src/ui/components/UpdateBar.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pwaStub } from '../../test/pwaRegisterStub'
import { OFFLINE_NOTICE_MS, UpdateBar } from './UpdateBar'

afterEach(() => {
  pwaStub.reset()
  vi.useRealTimers()
})

describe('UpdateBar', () => {
  it('renders nothing when there is no news', () => {
    const { container } = render(<UpdateBar />)
    expect(container).toBeEmptyDOMElement()
  })

  it('offers a reload for a new version and only reloads when asked', () => {
    pwaStub.needRefresh = true
    const update = vi.spyOn(pwaStub, 'updateServiceWorker')
    render(<UpdateBar />)
    expect(screen.getByRole('status')).toHaveTextContent('A new version is ready')
    expect(update).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(update).toHaveBeenCalledWith(true)
  })

  it('can dismiss the new-version bar', () => {
    pwaStub.needRefresh = true
    render(<UpdateBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('says "Ready to work offline" once, then hides it by itself', () => {
    vi.useFakeTimers()
    pwaStub.offlineReady = true
    render(<UpdateBar />)
    expect(screen.getByRole('status')).toHaveTextContent('Ready to work offline')
    act(() => vi.advanceTimersByTime(OFFLINE_NOTICE_MS))
    expect(screen.queryByRole('status')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `npx vitest run src/ui/components/UpdateBar.test.tsx`
Expected: FAIL, because `./UpdateBar` cannot be resolved.

- [ ] **Step 3: Implement**

`src/ui/components/UpdateBar.tsx`:

```tsx
import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import styles from './UpdateBar.module.css'

export const OFFLINE_NOTICE_MS = 6000

/**
 * Service-worker news, fixed at the bottom of the screen so it never moves the page. A new
 * version waits for the user's Reload; it is never applied mid-session.
 */
export function UpdateBar() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: (error: unknown) => console.warn('Service worker registration failed', error),
  })

  useEffect(() => {
    if (!offlineReady) return
    const timer = setTimeout(() => setOfflineReady(false), OFFLINE_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [offlineReady, setOfflineReady])

  if (!needRefresh && !offlineReady) return null
  const dismiss = () => {
    setNeedRefresh(false)
    setOfflineReady(false)
  }
  return (
    <div className={styles.bar} role="status">
      <span>{needRefresh ? 'A new version is ready' : 'Ready to work offline'}</span>
      {needRefresh && (
        <button type="button" className={styles.reload} onClick={() => updateServiceWorker(true)}>
          Reload
        </button>
      )}
      <button type="button" className={styles.dismiss} aria-label="Dismiss" onClick={dismiss}>
        ✕
      </button>
    </div>
  )
}
```

`src/ui/components/UpdateBar.module.css`:

```css
.bar {
  position: fixed;
  left: 50%;
  bottom: calc(1rem + env(safe-area-inset-bottom));
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  max-width: calc(100vw - 2rem);
  padding: 0.6rem 0.75rem 0.6rem 1rem;
  transform: translateX(-50%);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
  box-shadow: 0 4px 16px rgb(0 0 0 / 40%);
  white-space: nowrap;
}

.reload {
  padding: 0.35rem 0.9rem;
}

.dismiss {
  padding: 0.2rem 0.5rem;
  border: none;
  background: none;
  color: var(--text-dim);
}
```

`src/ui/App.tsx`: import `UpdateBar` from `./components/UpdateBar` and render `<UpdateBar />` after `</main>`, inside `SettingsProvider`.

`src/ui/App.module.css`: give `.main` safe-area padding.

```css
.main {
  max-width: 64rem;
  margin: 0 auto;
  padding: 1rem max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom))
    max(1rem, env(safe-area-inset-left));
}
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `npm test && npm run typecheck`
Expected: all pass, including the existing `src/ui/App.test.tsx`, which now renders `UpdateBar` through the stub.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/UpdateBar.* src/ui/App.tsx src/ui/App.module.css
git commit -m "feat(pwa): update bar — reload for a new version, offline-ready notice"
```

---

### Task 5: Install button on the home page

**Files:**
- Create: `src/ui/components/InstallButton.tsx`, `src/ui/components/InstallButton.module.css`, `src/ui/components/InstallButton.test.tsx`
- Modify: `src/ui/pages/HomePage.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `interface InstallEnv { standalone: boolean; ios: boolean }`
  - `function browserInstallEnv(): InstallEnv`
  - `function InstallButton({ env }: { env?: InstallEnv })`

- [ ] **Step 1: Write the failing tests**

`src/ui/components/InstallButton.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { InstallButton } from './InstallButton'

const DESKTOP = { standalone: false, ios: false }

function firePrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>
    userChoice: Promise<{ outcome: string }>
  }
  event.prompt = vi.fn(async () => {})
  event.userChoice = Promise.resolve({ outcome })
  act(() => {
    window.dispatchEvent(event)
  })
  return event
}

describe('InstallButton', () => {
  it('shows nothing until the browser offers installation', () => {
    const { container } = render(<InstallButton env={DESKTOP} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows "Install app" after beforeinstallprompt and prompts on click', async () => {
    render(<InstallButton env={DESKTOP} />)
    const event = firePrompt()
    expect(event.defaultPrevented).toBe(true)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Install app' }))
    })
    expect(event.prompt).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Install app' })).toBeNull()
  })

  it('hides after the app is installed', () => {
    render(<InstallButton env={DESKTOP} />)
    firePrompt()
    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })
    expect(screen.queryByRole('button', { name: 'Install app' })).toBeNull()
  })

  it('shows the Add to Home Screen hint on iOS', () => {
    render(<InstallButton env={{ standalone: false, ios: true }} />)
    expect(screen.getByText('On iPhone or iPad: Share → Add to Home Screen')).toBeInTheDocument()
  })

  it('shows nothing when already running as an installed app', () => {
    const { container } = render(<InstallButton env={{ standalone: true, ios: true }} />)
    firePrompt()
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `npx vitest run src/ui/components/InstallButton.test.tsx`
Expected: FAIL, because `./InstallButton` cannot be resolved.

- [ ] **Step 3: Implement**

`src/ui/components/InstallButton.tsx`:

```tsx
import { useEffect, useState } from 'react'
import styles from './InstallButton.module.css'

/** Chrome/Edge/Android's install event (not in TypeScript's DOM types). */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface InstallEnv {
  /** Already running as an installed app. */
  standalone: boolean
  /** iPhone/iPad Safari, which never offers an install prompt. */
  ios: boolean
}

export function browserInstallEnv(): InstallEnv {
  const standalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches
  const ua = navigator.userAgent
  const ios =
    (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) &&
    !('onbeforeinstallprompt' in window)
  return { standalone, ios }
}

export function InstallButton({ env = browserInstallEnv() }: { env?: InstallEnv }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPrompt(e as InstallPromptEvent)
    }
    const onInstalled = () => {
      setPrompt(null)
      setInstalled(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (env.standalone || installed) return null
  if (prompt) {
    const install = async () => {
      await prompt.prompt()
      await prompt.userChoice
      setPrompt(null) // the event can only be used once
    }
    return (
      <p className={styles.install}>
        <button type="button" onClick={install}>
          Install app
        </button>
      </p>
    )
  }
  if (env.ios) return <p className={styles.install}>On iPhone or iPad: Share → Add to Home Screen</p>
  return null
}
```

`src/ui/components/InstallButton.module.css`:

```css
.install {
  margin: 0 0 1.5rem;
  color: var(--text-dim);
  font-size: 0.9rem;
}
```

`src/ui/pages/HomePage.tsx`: import `InstallButton` from `../components/InstallButton` and render `<InstallButton />` right after the `<p className={styles.lead}>…</p>`.

- [ ] **Step 4: Run the tests and see them pass**

Run: `npm test && npm run typecheck`
Expected: all pass. This includes existing home page tests; in jsdom `matchMedia` is missing, so `browserInstallEnv` returns `standalone: false` and a non-iOS user agent gives `ios: false`.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/InstallButton.* src/ui/pages/HomePage.tsx
git commit -m "feat(pwa): install button on the home page, with an iOS hint"
```

---

### Task 6: Compact harmonica chart

**Files:**
- Modify: `src/ui/components/HarmonicaDiagram.tsx`, `src/ui/components/HarmonicaDiagram.module.css`
- Test: `src/ui/components/HarmonicaDiagram.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: exported helper `splitOctave(name: string): [pitch: string, octave: string]`. Cell markup for note labels becomes `D#<span class="octave">4</span>`. `aria-label`s are unchanged.

- [ ] **Step 1: Write the failing tests**

Append to `src/ui/components/HarmonicaDiagram.test.tsx` (and add `splitOctave` to the import from `./HarmonicaDiagram`):

```tsx
describe('splitOctave', () => {
  it.each([
    ['C4', ['C', '4']],
    ['D#5', ['D#', '5']],
    ['Eb6', ['Eb', '6']],
    ['A', ['A', '']],
  ])('%s → %j', (name, parts) => {
    expect(splitOctave(name)).toEqual(parts)
  })
})

describe('HarmonicaDiagram octave digits', () => {
  it('puts the octave digit of a note label in its own span, keeping the text and name', () => {
    renderDiagram()
    const cell = screen.getByRole('button', { name: '1 C4' })
    expect(cell).toHaveTextContent('C4')
    expect(cell.querySelector('.octave')).toHaveTextContent('4')
  })

  it('leaves tab labels whole', () => {
    renderDiagram({ labelMode: 'tab' })
    expect(screen.getByRole('button', { name: '1 C4' }).querySelector('.octave')).toBeNull()
  })
})
```

(`classNameStrategy: 'non-scoped'` in the Vitest config keeps CSS-module class names readable, so `.octave` matches.)

- [ ] **Step 2: Run the tests and see them fail**

Run: `npx vitest run src/ui/components/HarmonicaDiagram.test.tsx`
Expected: FAIL, because `splitOctave` is not exported and there is no `.octave` element.

- [ ] **Step 3: Implement**

`src/ui/components/HarmonicaDiagram.tsx`, add above the component:

```tsx
/** 'D#4' → ['D#', '4']: the octave gets its own span so compact cells can shrink it. */
export function splitOctave(name: string): [string, string] {
  const m = /^(.*?)(\d+)$/.exec(name)
  return m ? [m[1], m[2]] : [name, '']
}
```

Replace the cell's children `{labelMode === 'note' ? name : tab}` with:

```tsx
        {labelMode === 'note' ? <NoteLabel name={name} /> : tab}
```

and add below `splitOctave`:

```tsx
function NoteLabel({ name }: { name: string }) {
  const [pitch, octave] = splitOctave(name)
  return (
    <>
      {pitch}
      {octave && <span className={styles.octave}>{octave}</span>}
    </>
  )
}
```

`src/ui/components/HarmonicaDiagram.module.css`:
- in `.wrap`, add `container-type: inline-size;`;
- append at the end of the file:

```css
/* Phone widths: drop the row labels (colour, legend and accessible names carry the technique)
   so all ten holes fit without scrolling sideways. */
@container (max-width: 34rem) {
  .grid {
    grid-template-columns: repeat(10, minmax(0, 1fr));
    gap: 3px;
    min-width: 0;
  }

  .rowLabel {
    display: none;
  }

  .hole {
    padding: 0.25rem 0;
    font-size: 0.85rem;
  }

  .cell {
    padding: 0.35rem 0;
    font-size: 0.7rem;
    white-space: nowrap;
  }

  .octave {
    font-size: 0.75em;
    vertical-align: sub;
    line-height: 0;
  }

  /* Nothing scrolls sideways any more, so a vertical swipe that starts on a cell scrolls the page.
     Playable cells keep a 44 px tall touch target. */
  .cell[data-interactive] {
    min-height: 2.75rem;
    touch-action: pan-y;
  }
}
```

`.octave` needs no wide-screen rule: a plain inline span looks exactly like today.

- [ ] **Step 4: Run the tests and see them pass**

Run: `npm test`
Expected: all pass, including every existing page test that queries chart cells by accessible name.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/HarmonicaDiagram.*
git commit -m "feat(ui): compact harmonica chart — all ten holes fit a phone"
```

---

### Task 7: Two-row phone header, safe areas, metronome overflow

**Files:**
- Modify: `src/ui/components/Header.tsx`, `src/ui/components/Header.module.css`, `src/ui/pages/metronome/MetronomePage.module.css`
- Test: `src/ui/components/Header.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: the star link's text is wrapped in `<span className={styles.starText}>`. Its accessible name stays "★ Star on GitHub".

- [ ] **Step 1: Write the failing test**

Append inside `describe('Header', …)` in `src/ui/components/Header.test.tsx`:

```tsx
  it('keeps the GitHub link named when its text is hidden on phones', () => {
    render(
      <SettingsProvider storage={null}>
        <Header />
      </SettingsProvider>,
    )
    const star = screen.getByRole('link', { name: '★ Star on GitHub' })
    expect(star.querySelector('.starText')).toHaveTextContent('★ Star on GitHub')
  })
```

- [ ] **Step 2: Run the test and see it fail**

Run: `npx vitest run src/ui/components/Header.test.tsx`
Expected: the new test FAILS (`.starText` is not found).

- [ ] **Step 3: Implement**

`src/ui/components/Header.tsx`: replace the text node `★ Star on GitHub` inside the star link with:

```tsx
        <span className={styles.starText}>★ Star on GitHub</span>
```

`src/ui/components/Header.module.css`:
- change `.header`'s padding line to

```css
  padding: max(0.75rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) 0.75rem
    max(1rem, env(safe-area-inset-left));
```

- append:

```css
/* Phones: brand + links on the first row, harp + an icon-only star on the second. */
@media (max-width: 30rem) {
  .header {
    gap: 0.5rem 1rem;
  }

  .nav {
    gap: 0.75rem;
  }

  .star {
    padding: 0.35rem 0.5rem;
  }

  /* Same rules as the global .visually-hidden: still the link's accessible name. */
  .starText {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
}
```

`src/ui/pages/metronome/MetronomePage.module.css`, append (the ± buttons, 20 px gaps and a 4 rem BPM add up to about 346 px, 33 px more than a phone has):

```css
@media (max-width: 30rem) {
  .tempo {
    gap: 0.75rem;
  }

  .bpm {
    font-size: 3.25rem;
  }
}
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/Header.* src/ui/pages/metronome/MetronomePage.module.css
git commit -m "fix(ui): two-row header on phones, safe areas, metronome fits 360 px"
```

---

### Task 8: `useMediaQuery` and the transposed health table

**Files:**
- Create: `src/ui/hooks/useMediaQuery.ts`, `src/ui/hooks/useMediaQuery.test.ts`
- Modify: `src/ui/pages/health/HealthCheckPage.tsx`, `src/ui/pages/health/HealthCheckPage.module.css`
- Test: `src/ui/pages/health/HealthCheckPage.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `function useMediaQuery(query: string): boolean`, and `NARROW_TABLE = '(max-width: 34rem)'` exported from `HealthCheckPage.tsx`. The table gets `data-layout="wide" | "narrow"`.

- [ ] **Step 1: Write the failing hook tests**

`src/ui/hooks/useMediaQuery.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useMediaQuery } from './useMediaQuery'

/** A controllable matchMedia: `set(true)` flips every query and fires 'change'. */
function stubMatchMedia(initial: boolean) {
  let matches = initial
  const listeners = new Set<() => void>()
  window.matchMedia = ((query: string) => ({
    get matches() {
      return matches
    },
    media: query,
    addEventListener: (_: 'change', l: () => void) => listeners.add(l),
    removeEventListener: (_: 'change', l: () => void) => listeners.delete(l),
  })) as unknown as typeof window.matchMedia
  return (next: boolean) => {
    matches = next
    listeners.forEach((l) => l())
  }
}

afterEach(() => {
  // jsdom has no matchMedia; put it back the way it was.
  delete (window as { matchMedia?: unknown }).matchMedia
})

describe('useMediaQuery', () => {
  it('returns false when matchMedia is missing', () => {
    delete (window as { matchMedia?: unknown }).matchMedia
    const { result } = renderHook(() => useMediaQuery('(max-width: 34rem)'))
    expect(result.current).toBe(false)
  })

  it('follows the query as it changes', () => {
    const set = stubMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(max-width: 34rem)'))
    expect(result.current).toBe(false)
    act(() => set(true))
    expect(result.current).toBe(true)
  })
})
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run src/ui/hooks/useMediaQuery.test.ts`
Expected: FAIL, because the module cannot be resolved.

- [ ] **Step 3: Implement the hook**

`src/ui/hooks/useMediaQuery.ts`:

```ts
import { useCallback, useSyncExternalStore } from 'react'

const hasMatchMedia = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'

/** Whether a CSS media query matches now; false where matchMedia doesn't exist. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!hasMatchMedia()) return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => hasMatchMedia() && window.matchMedia(query).matches)
}
```

Run: `npx vitest run src/ui/hooks/useMediaQuery.test.ts`
Expected: 2 passed.

- [ ] **Step 4: Write the failing health-table test**

In `src/ui/pages/health/HealthCheckPage.test.tsx`:
- add `afterEach` to the `vitest` import;
- copy `stubMatchMedia` from Step 1 below the file's `skip` helper;
- append this block, which uses the file's existing `renderCheck()` helper:

```tsx
describe('HealthCheck table on a phone', () => {
  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia
  })

  it('lists holes as rows with Blow and Draw columns', () => {
    stubMatchMedia(true)
    renderCheck()
    const table = screen.getByRole('table')
    expect(table).toHaveAttribute('data-layout', 'narrow')
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent)
    expect(headers).toEqual(['Hole', 'Blow', 'Draw'])
    expect(within(table).getAllByRole('rowheader').map((h) => h.textContent)).toEqual(
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    )
  })

  it('keeps the wide layout on larger screens', () => {
    stubMatchMedia(false)
    renderCheck()
    expect(screen.getByRole('table')).toHaveAttribute('data-layout', 'wide')
  })
})
```

Run: `npx vitest run src/ui/pages/health/HealthCheckPage.test.tsx`
Expected: the 2 new tests FAIL (no `data-layout`).

- [ ] **Step 5: Implement the transposed table**

In `src/ui/pages/health/HealthCheckPage.tsx`:
- import `useMediaQuery` from `../../hooks/useMediaQuery`;
- add `export const NARROW_TABLE = '(max-width: 34rem)'` next to `HOLES`;
- in the component that renders the table (the one holding `shown`, `previous`, `step`, `indexOf`), call `const narrow = useMediaQuery(NARROW_TABLE)`;
- replace the whole `<table>…</table>` with the version below. The per-cell code moves unchanged into `reedCell`.

```tsx
        <table className={styles.table} data-layout={narrow ? 'narrow' : 'wide'}>
          <caption className={styles.caption}>
            Cents off per reed
            {previous && ` · Δ against the previous check (${previous.date})`}
          </caption>
          {narrow ? (
            <>
              <thead>
                <tr>
                  <th scope="col">Hole</th>
                  <th scope="col">Blow</th>
                  <th scope="col">Draw</th>
                </tr>
              </thead>
              <tbody>
                {HOLES.map((hole) => (
                  <tr key={hole}>
                    <th scope="row">{hole}</th>
                    {TECHNIQUES.map((technique) => reedCell(hole, technique, technique))}
                  </tr>
                ))}
              </tbody>
            </>
          ) : (
            <>
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
                    {HOLES.map((hole) => reedCell(hole, technique, hole))}
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </table>
```

Put `reedCell` just before the component's `return`:

```tsx
  const reedCell = (hole: number, technique: (typeof TECHNIQUES)[number], key: string | number) => {
    const i = indexOf(hole, technique)
    const cents = i >= 0 ? shown[i] : null
    const saved = previous && i >= 0 ? previous.cents[i] : null
    const before = previous && saved !== null ? centsAtA4(saved, previous.a4, settings.a4) : null
    return (
      <td
        key={key}
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
  }
```

`src/ui/pages/health/HealthCheckPage.module.css`: remove `min-width: 34rem;` from `.table` and add

```css
.table[data-layout='wide'] {
  min-width: 34rem;
}
```

- [ ] **Step 6: Run the tests and see them pass**

Run: `npm test && npm run typecheck`
Expected: all pass. Existing health tests run without `matchMedia`, so they get the wide layout they were written for.

- [ ] **Step 7: Commit**

```bash
git add src/ui/hooks/useMediaQuery.* src/ui/pages/health
git commit -m "feat(health): the reed table lists holes as rows on phones"
```

---

### Task 9: Note slots keep the current slot in view

**Files:**
- Modify: `src/ui/components/game/NoteSlots.tsx`, `src/ui/components/game/Game.module.css`
- Create: `src/ui/components/game/NoteSlots.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: exported pure helper `scrollLeftToShow(slot: { left: number; width: number }, view: { scrollLeft: number; width: number }, margin?: number): number | null`.

- [ ] **Step 1: Write the failing tests**

`src/ui/components/game/NoteSlots.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NoteSlots, scrollLeftToShow, type NoteSlot } from './NoteSlots'

describe('scrollLeftToShow', () => {
  const view = { scrollLeft: 0, width: 300 }
  it('leaves a visible slot alone', () => {
    expect(scrollLeftToShow({ left: 100, width: 56 }, view)).toBeNull()
  })
  it('scrolls right to a slot past the right edge, keeping a margin before it', () => {
    expect(scrollLeftToShow({ left: 400, width: 56 }, view)).toBe(392)
  })
  it('scrolls back to a slot left of the view', () => {
    expect(scrollLeftToShow({ left: 20, width: 56 }, { scrollLeft: 200, width: 300 })).toBe(12)
  })
  it('never goes below 0', () => {
    expect(scrollLeftToShow({ left: 4, width: 56 }, { scrollLeft: 100, width: 300 })).toBe(0)
  })
})

const slots = (current: number, n = 10): NoteSlot[] =>
  Array.from({ length: n }, (_, i) => ({
    label: String(i + 1),
    state: i < current ? 'done' : i === current ? 'current' : 'todo',
  }))

describe('NoteSlots', () => {
  it('scrolls its own row, not the page, to the current slot', () => {
    const { rerender } = render(<NoteSlots label="Lick" slots={slots(0)} />)
    const list = screen.getByRole('list', { name: 'Lick' })
    // jsdom has no layout: give the row and its 8th slot some geometry.
    Object.defineProperty(list, 'clientWidth', { value: 300 })
    Object.defineProperty(list, 'scrollLeft', { value: 0, writable: true })
    const eighth = list.children[7] as HTMLElement
    Object.defineProperty(eighth, 'offsetLeft', { value: 448 })
    Object.defineProperty(eighth, 'offsetWidth', { value: 56 })

    rerender(<NoteSlots label="Lick" slots={slots(7)} />)
    expect(list.scrollLeft).toBe(440)
  })
})
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `npx vitest run src/ui/components/game/NoteSlots.test.tsx`
Expected: FAIL, because `scrollLeftToShow` is not exported.

- [ ] **Step 3: Implement**

`src/ui/components/game/NoteSlots.tsx`:

```tsx
import { useEffect, useRef, type ReactNode } from 'react'
import styles from './Game.module.css'

export type SlotState = 'todo' | 'current' | 'done' | 'wrong'

export interface NoteSlot {
  label: ReactNode
  state: SlotState
}

/** The row's scrollLeft that brings a slot into view, or null when it is already visible. */
export function scrollLeftToShow(
  slot: { left: number; width: number },
  view: { scrollLeft: number; width: number },
  margin = 8,
): number | null {
  const visible = slot.left >= view.scrollLeft && slot.left + slot.width <= view.scrollLeft + view.width
  return visible ? null : Math.max(0, slot.left - margin)
}

/**
 * A row of note slots (a melody phrase, a lick, the tab reader's next notes). The row is always
 * rendered at a fixed height, so filling or emptying it never moves the page. A long row scrolls
 * itself (never the page) to keep the current slot in view.
 */
export function NoteSlots({ label, slots }: { label: string; slots: readonly NoteSlot[] }) {
  const listRef = useRef<HTMLOListElement>(null)
  const current = slots.findIndex((s) => s.state === 'current')

  useEffect(() => {
    const list = listRef.current
    const slot = current >= 0 ? (list?.children[current] as HTMLElement | undefined) : undefined
    if (!list || !slot) return
    const left = scrollLeftToShow(
      { left: slot.offsetLeft, width: slot.offsetWidth },
      { scrollLeft: list.scrollLeft, width: list.clientWidth },
    )
    if (left !== null) list.scrollLeft = left
  }, [current])

  return (
    <ol ref={listRef} className={styles.slots} aria-label={label}>
      {slots.map((s, i) => (
        <li key={i} className={styles.slot} data-state={s.state}>
          {s.label}
        </li>
      ))}
    </ol>
  )
}
```

`src/ui/components/game/Game.module.css`: add `position: relative;` to `.slots`, so each slot's `offsetLeft` is measured from the row.

- [ ] **Step 4: Run the tests and see them pass**

Run: `npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/game/NoteSlots.* src/ui/components/game/Game.module.css
git commit -m "feat(ui): long note-slot rows keep the current note in view"
```

---

### Task 10: Phone sweep, offline check, README

**Files:**
- Modify: `README.md`, plus whatever CSS the sweep shows still overflows.

**Interfaces:**
- Consumes: everything above.
- Produces: verified behaviour and docs.

- [ ] **Step 1: Build and serve the production build**

```bash
npm run build && npm run check:pwa
npx vite preview --port 4173 --strictPort
```

(Run `preview` in the background. The service worker only runs in the production build, so don't use `npm run dev`.)

- [ ] **Step 2: 360 px sweep (Playwright MCP)**

At 360 × 740:
1. Open `http://localhost:4173/#/tuner`.
2. Click **Tap to start audio**.
3. For each of the 18 routes in `src/ui/App.tsx`, set `location.hash`, wait 500 ms, and evaluate:

```js
() => {
  const vw = document.documentElement.clientWidth
  const inSlots = (e) => e.closest('ol[aria-label]') && getComputedStyle(e.closest('ol')).overflowX === 'auto'
  const out = [...document.querySelectorAll('main *')].filter((e) => {
    const r = e.getBoundingClientRect()
    return r.width > 0 && r.right > vw + 0.5 && !inSlots(e)
  })
  const clipped = [...document.querySelectorAll('[aria-label="Harmonica chart"] button')].filter(
    (b) => b.scrollWidth > b.clientWidth + 1,
  )
  return { page: document.documentElement.scrollWidth <= vw, out: out.length, clipped: clipped.length,
           header: Math.round(document.querySelector('header').getBoundingClientRect().height) }
}
```

Expected for every route: `page: true`, `out: 0`, `clipped: 0`, and `header` under 110. Repeat the tuner, echo and jam routes with **Tab labels** and **Advanced over-notes** switched on (tuner page controls). This is Review Focus item 3.

If a chart cell is clipped: lower the compact `.cell` `font-size` in `HarmonicaDiagram.module.css` to `0.65rem` and re-run. Fix any other overflow in the owning page's CSS module, under `@media (max-width: 30rem)`. Take a screenshot of the tuner and the health check at 360 px for the report.

- [ ] **Step 3: Offline check (Playwright MCP)**

1. Open `http://localhost:4173/` and wait until `navigator.serviceWorker.controller` is non-null. Reload once if needed; evaluate `() => !!navigator.serviceWorker.controller`.
2. Go offline with `browser_run_code_unsafe` → `await page.context().setOffline(true)`.
3. Reload, then open `#/tuner` and `#/jam`. Expected: both render. The browser's offline error page means failure.
4. Check that `manifest.webmanifest`, `pwa-192x192.png` and `favicon.ico` loaded with status 200 (`browser_network_requests`), and that the console has no errors (the favicon 404 on the live site should be gone).
5. Go back online.

- [ ] **Step 4: README**

In `README.md`:
- under the intro line "No accounts, no server, no installs — it's a static site that runs entirely in your browser.", replace it with:

```markdown
No accounts, no server. It's a static site that runs entirely in your browser — and you can
**install it** on your phone or computer and practise **offline**. On a phone the whole harp fits
the screen, and the screen stays on while you play.
```

- in the Roadmap list, add `- [x] Installable, offline, phone-friendly` before the `Later: recorded harp samples` line.

- [ ] **Step 5: Full verification and commit**

Run: `npm run lint && npm test && npm run typecheck && npm run build && npm run check:pwa`
Expected: all green.

```bash
git add -A README.md src
git commit -m "docs: README for install, offline and phones"
```

(Include any CSS fixes from Step 2 in this commit with a `fix(ui): …` subject line, or commit them separately first.)

- [ ] **Step 6: Hand off device checks to the user**

Report, and ask the user to check:
- install on Android (Chrome menu → Install app) and iPhone (Share → Add to Home Screen);
- open it in airplane mode;
- the screen stays on through a few minutes of the tuner;
- after the next deploy, "A new version is ready" appears and Reload works.
