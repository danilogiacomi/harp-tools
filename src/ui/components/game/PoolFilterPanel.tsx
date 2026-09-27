import {
  TECHNIQUE_GROUPS,
  type PoolFilter,
  type TechniqueGroup,
} from '../../../core/games/notePool'
import type { Hole } from '../../../core/harmonica/harp'
import { useSettings } from '../../settings/SettingsContext'
import styles from './Game.module.css'

const HOLES: Hole[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const ALL_GROUPS = TECHNIQUE_GROUPS.map((g) => g.id)

interface Props {
  filter: PoolFilter
  onChange: (filter: PoolFilter) => void
  /** Which technique checkboxes to offer (default: all). */
  groups?: readonly TechniqueGroup[]
  /** Offer the global "Advanced over-notes" switch (default: yes). */
  advancedToggle?: boolean
}

/** Spec §8.1 NotePool filters: hole range, techniques, include advanced. */
export function PoolFilterPanel({
  filter,
  onChange,
  groups = ALL_GROUPS,
  advancedToggle = true,
}: Props) {
  const { settings, update } = useSettings()
  const toggle = (g: TechniqueGroup) =>
    onChange({
      ...filter,
      groups: filter.groups.includes(g)
        ? filter.groups.filter((x) => x !== g)
        : [...filter.groups, g],
    })
  const holeSelect = (label: string, value: Hole, set: (hole: Hole) => void) => (
    <label className={styles.field}>
      {label}
      <select value={value} onChange={(e) => set(Number(e.target.value) as Hole)}>
        {HOLES.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <fieldset className={styles.pool}>
      <legend>Notes</legend>
      {holeSelect('From hole', filter.fromHole, (fromHole) => onChange({ ...filter, fromHole }))}
      {holeSelect('To hole', filter.toHole, (toHole) => onChange({ ...filter, toHole }))}
      {TECHNIQUE_GROUPS.filter((g) => groups.includes(g.id)).map((g) => (
        <label key={g.id} className={styles.field}>
          <input
            type="checkbox"
            checked={filter.groups.includes(g.id)}
            onChange={() => toggle(g.id)}
          />
          {g.label}
        </label>
      ))}
      {advancedToggle && (
        <label className={styles.field}>
          <input
            type="checkbox"
            checked={settings.showAdvanced}
            onChange={(e) => update({ showAdvanced: e.target.checked })}
          />
          Advanced over-notes
        </label>
      )}
    </fieldset>
  )
}
