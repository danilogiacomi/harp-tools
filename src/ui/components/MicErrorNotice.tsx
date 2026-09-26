import type { MicErrorKind } from '../../audio/Microphone'

const MESSAGES: Record<MicErrorKind, string> = {
  insecure: 'The microphone only works when the site is served over HTTPS (or from localhost).',
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
