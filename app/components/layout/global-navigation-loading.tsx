import { useEffect, useState } from 'react'
import { useNavigation } from 'react-router'

import { Item, ItemContent, ItemMedia, ItemTitle } from '~/components/ui/item'
import { Spinner } from '~/components/ui/spinner'
import { cn } from '~/lib/utils'

export function GlobalNavigationLoading() {
  const navigation = useNavigation()
  const isNavigating = navigation.state !== 'idle'
  const [isVisible, setIsVisible] = useState(false)
  const [showSlowHint, setShowSlowHint] = useState(false)

  useEffect(() => {
    let showTimer: number | undefined
    let hideTimer: number | undefined
    let slowHintTimer: number | undefined

    if (isNavigating) {
      showTimer = window.setTimeout(() => setIsVisible(true), 120)
      slowHintTimer = window.setTimeout(() => setShowSlowHint(true), 900)
    } else {
      hideTimer = window.setTimeout(() => {
        setShowSlowHint(false)
        setIsVisible(false)
      }, 160)
    }

    return () => {
      if (showTimer) window.clearTimeout(showTimer)
      if (hideTimer) window.clearTimeout(hideTimer)
      if (slowHintTimer) window.clearTimeout(slowHintTimer)
    }
  }, [isNavigating])

  return (
    <>
      <div
        aria-hidden
        className={cn(
          'pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 transition-opacity duration-200',
          isVisible ? 'opacity-100' : 'opacity-0',
        )}
      >
        <div className="bg-primary/15 relative h-full w-full overflow-hidden">
          <div className="rr-route-progress-indicator bg-primary absolute inset-y-0 w-2/5" />
        </div>
      </div>

      <div
        aria-live="polite"
        aria-atomic="true"
        role="status"
        className={cn(
          'pointer-events-none fixed inset-x-0 top-3 z-[101] flex justify-center transition-all duration-200',
          showSlowHint ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0',
        )}
      >
        {showSlowHint && (
          <Item variant="outline" size="xs" className="w-auto backdrop-blur">
            <ItemMedia>
              <Spinner />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>A carregar...</ItemTitle>
            </ItemContent>
          </Item>
        )}
      </div>
    </>
  )
}
