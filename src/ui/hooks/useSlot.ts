import { useState } from 'react'

/**
 * A mutable box, e.g. for the live round a mic callback feeds 60 times a second. Reading and
 * replacing it doesn't re-render; only call get()/set() from handlers and callbacks.
 */
export class Slot<T> {
  private value: T | null = null

  get(): T | null {
    return this.value
  }

  set(value: T | null): void {
    this.value = value
  }
}

export function useSlot<T>(): Slot<T> {
  const [slot] = useState(() => new Slot<T>())
  return slot
}
