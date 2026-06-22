import { useEffect, useState, type DependencyList } from "react"

export function useAsyncValue<T>(loader: () => Promise<T>, deps: DependencyList = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let active = true

    loader()
      .then((value) => {
        if (active) {
          setData(value)
        }
      })
      .catch((caughtError) => {
        if (active) {
          setError(caughtError)
          setData(null)
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error }
}
