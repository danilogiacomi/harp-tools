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
        visible.find(
          (n) => n.hole === hole && n.technique === technique && n.bendSteps === bendSteps,
        ) ?? null,
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
    above: [
      row('overblow', 'Overblow', 'overblow'),
      ...blowBends,
      row('blow', 'Blow', 'blow'),
    ].filter(nonEmpty),
    below: [
      row('draw', 'Draw', 'draw'),
      ...drawBends,
      row('overdraw', 'Overdraw', 'overdraw'),
    ].filter(nonEmpty),
  }
}
