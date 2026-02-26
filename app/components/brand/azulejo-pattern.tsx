import { LazyMotion, domAnimation, m } from 'motion/react'
import { useEffect, useState } from 'react'

const TILE_SIZE = 64
const STEP = TILE_SIZE + 1

function Tile({
  x,
  y,
  baseOpacity,
  hoverOpacity,
}: {
  x: number
  y: number
  baseOpacity: number
  hoverOpacity: number
}) {
  const cx = x + TILE_SIZE / 2
  const cy = y + TILE_SIZE / 2

  return (
    <m.g
      initial={{ opacity: baseOpacity }}
      whileHover={{ opacity: hoverOpacity }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* Invisible hit area for hover detection */}
      <rect x={x} y={y} width={TILE_SIZE} height={TILE_SIZE} fill="transparent" />

      {/* Tile border */}
      <rect
        x={x}
        y={y}
        width={TILE_SIZE}
        height={TILE_SIZE}
        fill="none"
        stroke="currentColor"
        strokeWidth={0.5}
      />

      {/* Center diamond */}
      <polygon
        points={`${cx},${y + 12} ${x + TILE_SIZE - 12},${cy} ${cx},${y + TILE_SIZE - 12} ${x + 12},${cy}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={0.5}
      />

      {/* Corner arcs — four-fold symmetry */}
      <path
        d={`M ${x},${y + 16} A 16 16 0 0 1 ${x + 16},${y}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={0.5}
      />
      <path
        d={`M ${x + TILE_SIZE - 16},${y} A 16 16 0 0 1 ${x + TILE_SIZE},${y + 16}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={0.5}
      />
      <path
        d={`M ${x + TILE_SIZE},${y + TILE_SIZE - 16} A 16 16 0 0 1 ${x + TILE_SIZE - 16},${y + TILE_SIZE}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={0.5}
      />
      <path
        d={`M ${x + 16},${y + TILE_SIZE} A 16 16 0 0 1 ${x},${y + TILE_SIZE - 16}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={0.5}
      />

      {/* Center dot */}
      <circle cx={cx} cy={cy} r={2} fill="currentColor" />
    </m.g>
  )
}

export function AzulejoPattern({
  baseOpacity = 0.07,
  hoverOpacity = 0.35,
}: {
  baseOpacity?: number
  hoverOpacity?: number
} = {}) {
  const [grid, setGrid] = useState({ cols: 0, rows: 0 })

  useEffect(() => {
    function update() {
      setGrid({
        cols: Math.ceil(window.innerWidth / STEP) + 1,
        rows: Math.ceil(window.innerHeight / STEP) + 1,
      })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  if (grid.cols === 0) return null

  const tiles: { x: number; y: number; key: string }[] = []
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      tiles.push({ x: col * STEP, y: row * STEP, key: `${col}-${row}` })
    }
  }

  return (
    <div className="text-primary absolute inset-0 overflow-hidden">
      <LazyMotion features={domAnimation}>
        <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
          {tiles.map((tile) => (
            <Tile
              key={tile.key}
              x={tile.x}
              y={tile.y}
              baseOpacity={baseOpacity}
              hoverOpacity={hoverOpacity}
            />
          ))}
        </svg>
      </LazyMotion>
    </div>
  )
}
