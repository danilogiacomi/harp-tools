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
    if (typeof value !== 'string' || !isRelative(value))
      errors.push(`manifest ${key} is not relative: ${value}`)
  }
  if (manifest.display !== 'standalone') errors.push(`manifest display is ${manifest.display}`)
  const icons = manifest.icons ?? []
  if (icons.length === 0) errors.push('manifest has no icons')
  if (!icons.some((i) => i.purpose?.includes('maskable')))
    errors.push('manifest has no maskable icon')
  for (const icon of icons) {
    if (!isRelative(icon.src)) errors.push(`icon src is not relative: ${icon.src}`)
    need(icon.src)
  }
}

if (existsSync(join(DIST, 'index.html'))) {
  const html = readFileSync(join(DIST, 'index.html'), 'utf8')
  if (!html.includes('manifest.webmanifest')) errors.push('index.html does not link the manifest')
  for (const [, url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (!isRelative(url) && !url.startsWith('https://'))
      errors.push(`index.html URL is not relative: ${url}`)
  }
}

if (errors.length > 0) {
  console.error(`check:pwa failed:\n- ${errors.join('\n- ')}`)
  process.exit(1)
}
console.log('check:pwa ok')
