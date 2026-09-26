import { HARP_KEYS, type HarpKey } from '../../core/harmonica/keys'

interface Props {
  value: HarpKey
  onChange: (key: HarpKey) => void
}

export function KeySelector({ value, onChange }: Props) {
  return (
    <select
      aria-label="Harp key"
      value={value}
      onChange={(e) => onChange(e.target.value as HarpKey)}
    >
      {HARP_KEYS.map((k) => (
        <option key={k} value={k}>
          {k} harp
        </option>
      ))}
    </select>
  )
}
