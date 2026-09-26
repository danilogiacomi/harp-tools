import { useEffect, useState } from 'react'
import type { NotePlayer } from '../../audio/NotePlayer'
import { SynthNotePlayer } from '../../audio/SynthNotePlayer'
import { useSettings } from '../settings/SettingsContext'

/** A note player tuned to the current A4 setting; silenced on unmount. */
export function useNotePlayer(): NotePlayer {
  const { settings } = useSettings()
  const [player] = useState(() => new SynthNotePlayer(() => settings.a4))
  // react-hooks' ref-escape analysis forbids handing a ref-reading closure to a constructor
  // during render, so instead of a `useRef`-backed "latest a4" getter, swap in a fresh closure
  // (over the plain, already-current `settings.a4` value) from an effect after each render.
  useEffect(() => {
    player.setA4Getter(() => settings.a4)
  }, [player, settings.a4])
  useEffect(() => () => player.stop(), [player])
  return player
}
