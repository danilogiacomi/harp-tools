export const YOUR_TAB_KEY = 'harp-tools:your-tab'

/** What "Your tab" starts with: a short example of every part of the format. */
export const EXAMPLE_TAB = '4 -4 5 -5 | 6:2 6:2 | -6 -6 6:2 | _ 5 -4 4 |'

export function loadYourTab(storage: Pick<Storage, 'getItem'> | null): string {
  try {
    return storage?.getItem(YOUR_TAB_KEY) ?? EXAMPLE_TAB
  } catch {
    return EXAMPLE_TAB
  }
}

export function saveYourTab(storage: Pick<Storage, 'setItem'> | null, text: string): void {
  try {
    storage?.setItem(YOUR_TAB_KEY, text)
  } catch {
    // Storage full or blocked: the tab just won't be there next time.
  }
}
