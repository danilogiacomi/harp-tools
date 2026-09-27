/**
 * The structure of a game's play area, for "keeps the same layout in every phase" tests: the
 * stage's status rows plus how many of each reserved area (by selector) are rendered. Capture it
 * in one phase and expect it unchanged in the others.
 */
export function layoutShape(container: HTMLElement, areas: readonly string[] = []) {
  const status = container.querySelector('.stageSplit .status')
  return {
    stageRows: status ? [...status.children].map((row) => row.tagName) : null,
    areas: Object.fromEntries(areas.map((sel) => [sel, container.querySelectorAll(sel).length])),
  }
}
