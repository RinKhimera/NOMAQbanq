import { useEffect, useRef, useState } from "react"

/**
 * Valeur retardée de `delay` ms après la dernière modification. `onSettle`
 * s'exécute au même instant, dans le callback du timer : l'endroit où
 * remettre une pagination à zéro sans requête intermédiaire sur l'ancien
 * terme (et sans `setState` synchrone dans un effet).
 */
export const useDebouncedValue = <T>(
  value: T,
  delay = 300,
  onSettle?: (value: T) => void,
): T => {
  const [debounced, setDebounced] = useState(value)
  const onSettleRef = useRef(onSettle)

  useEffect(() => {
    onSettleRef.current = onSettle
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value)
      onSettleRef.current?.(value)
    }, delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
