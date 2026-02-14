import { useId } from 'react'

import { cn } from '~/lib/utils'

const TILE = 48
const HALF = TILE / 2
const INSET = 9
const R = 12

export function AzulejoOverlay({
  opacity = 0.1,
  className,
}: {
  opacity?: number
  className?: string
}) {
  const patternId = useId()

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100',
        className,
      )}
    >
      <svg
        className="text-primary h-full w-full animate-[azulejo-drift_8s_linear_infinite]"
        style={{ opacity }}
        aria-hidden="true"
      >
        <defs>
          <pattern id={patternId} width={TILE} height={TILE} patternUnits="userSpaceOnUse">
            <rect width={TILE} height={TILE} fill="none" stroke="currentColor" strokeWidth={0.5} />
            <polygon
              points={`${HALF},${INSET} ${TILE - INSET},${HALF} ${HALF},${TILE - INSET} ${INSET},${HALF}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={0.5}
            />
            <path
              d={`M 0,${R} A ${R} ${R} 0 0 1 ${R},0`}
              fill="none"
              stroke="currentColor"
              strokeWidth={0.5}
            />
            <path
              d={`M ${TILE - R},0 A ${R} ${R} 0 0 1 ${TILE},${R}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={0.5}
            />
            <path
              d={`M ${TILE},${TILE - R} A ${R} ${R} 0 0 1 ${TILE - R},${TILE}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={0.5}
            />
            <path
              d={`M ${R},${TILE} A ${R} ${R} 0 0 1 0,${TILE - R}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={0.5}
            />
            <circle cx={HALF} cy={HALF} r={1.5} fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    </div>
  )
}
