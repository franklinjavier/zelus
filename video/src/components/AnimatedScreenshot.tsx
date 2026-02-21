import { Img, useCurrentFrame, useVideoConfig, interpolate } from 'remotion'

type Props = {
  src: string
  startScale?: number
  endScale?: number
  panX?: number
  panY?: number
}

export const AnimatedScreenshot: React.FC<Props> = ({
  src,
  startScale = 1,
  endScale = 1.08,
  panX = 0,
  panY = 0,
}) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  const scale = interpolate(frame, [0, durationInFrames], [startScale, endScale], {
    extrapolateRight: 'clamp',
  })

  const translateX = interpolate(frame, [0, durationInFrames], [0, panX], {
    extrapolateRight: 'clamp',
  })

  const translateY = interpolate(frame, [0, durationInFrames], [0, panY], {
    extrapolateRight: 'clamp',
  })

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#f8f9fa' }}>
      <Img
        src={src}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
        }}
      />
    </div>
  )
}
