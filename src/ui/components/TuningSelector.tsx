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
