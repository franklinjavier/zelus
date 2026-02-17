import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

export function NoPriorityIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <rect width={3} height={1.5} x={1.5} y={7.25} opacity={0.9} rx={0.5} />
      <rect width={3} height={1.5} x={6.5} y={7.25} opacity={0.9} rx={0.5} />
      <rect width={3} height={1.5} x={11.5} y={7.25} opacity={0.9} rx={0.5} />
    </svg>
  )
}

export function UrgentIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 1c-1.09 0-2 .91-2 2v10c0 1.09.91 2 2 2h10c1.09 0 2-.91 2-2V3c0-1.09-.91-2-2-2H3Zm4 3h2l-.246 4.998H7.25L7 4Zm2 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
    </svg>
  )
}

export function HighPriorityIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 1 16 14"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <rect width={3} height={6} x={1.5} y={8} rx={1} />
      <rect width={3} height={9} x={6.5} y={5} rx={1} />
      <rect width={3} height={12} x={11.5} y={2} rx={1} />
    </svg>
  )
}

export function MediumPriorityIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 1 16 14"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <rect width={3} height={6} x={1.5} y={8} rx={1} />
      <rect width={3} height={9} x={6.5} y={5} rx={1} />
      <rect width={3} height={12} x={11.5} y={2} fillOpacity={0.4} rx={1} />
    </svg>
  )
}

export function LowPriorityIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 1 16 14"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <rect width={3} height={6} x={1.5} y={8} rx={1} />
      <rect width={3} height={9} x={6.5} y={5} fillOpacity={0.4} rx={1} />
      <rect width={3} height={12} x={11.5} y={2} fillOpacity={0.4} rx={1} />
    </svg>
  )
}
