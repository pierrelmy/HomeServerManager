import { useSyncExternalStore } from "react"

export interface Store<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
  setState(next: T): void
  update(recipe: (current: T) => T): void
}

export function createStore<T>(initialState: T): Store<T> {
  let state = initialState
  const listeners = new Set<() => void>()

  const notify = () => {
    listeners.forEach((listener) => listener())
  }

  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
    setState: (next) => {
      if (Object.is(state, next)) {
        return
      }

      state = next
      notify()
    },
    update: (recipe) => {
      const next = recipe(state)
      if (Object.is(state, next)) {
        return
      }

      state = next
      notify()
    },
  }
}

export function useStoreValue<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
