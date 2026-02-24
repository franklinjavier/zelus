import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion'

export const BrandScene: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const opacity = spring({ frame, fps, config: { damping: 20 } })
  const scale = interpolate(
    spring({ frame, fps, config: { damping: 15, mass: 0.8 } }),
    [0, 1],
    [0.9, 1],
  )

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <svg width="80" height="80" viewBox="0 0 200 200" fill="none">
        <rect width="200" height="200" rx="40" fill="#2563EB" />
        <path
          d="M60 60h80l-80 80h80"
          stroke="white"
          strokeWidth="16"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <h1
        style={{
          fontSize: 42,
          fontWeight: 700,
          color: '#0f172a',
          marginTop: 24,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        Zelus
      </h1>
      <p
        style={{
          fontSize: 22,
          color: '#64748b',
          marginTop: 8,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        Gestao de condominios, simplificada.
      </p>
      <p
        style={{
          fontSize: 16,
          color: '#94a3b8',
          marginTop: 16,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        zelus.sh
      </p>
    </div>
  )
}
