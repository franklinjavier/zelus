import { Series, useCurrentFrame, useVideoConfig, interpolate } from 'remotion'
import { DashboardScene } from './scenes/DashboardScene'
import { TicketsScene } from './scenes/TicketsScene'
import { TicketDetailScene } from './scenes/TicketDetailScene'
import { FractionsScene } from './scenes/FractionsScene'
import { AssistantScene } from './scenes/AssistantScene'
import { SuppliersScene } from './scenes/SuppliersScene'
import { BrandScene } from './scenes/BrandScene'

const TRANSITION_FRAMES = 15

const FadeIn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  const fadeIn = interpolate(frame, [0, TRANSITION_FRAMES], [0, 1], {
    extrapolateRight: 'clamp',
  })

  const fadeOut = interpolate(
    frame,
    [durationInFrames - TRANSITION_FRAMES, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp' },
  )

  return (
    <div style={{ opacity: Math.min(fadeIn, fadeOut), width: '100%', height: '100%' }}>
      {children}
    </div>
  )
}

export const HeroVideo: React.FC = () => {
  return (
    <div style={{ background: '#ffffff', width: '100%', height: '100%' }}>
      <Series>
        <Series.Sequence durationInFrames={120}>
          <FadeIn>
            <DashboardScene />
          </FadeIn>
        </Series.Sequence>
        <Series.Sequence durationInFrames={180} offset={-TRANSITION_FRAMES}>
          <FadeIn>
            <TicketsScene />
          </FadeIn>
        </Series.Sequence>
        <Series.Sequence durationInFrames={180} offset={-TRANSITION_FRAMES}>
          <FadeIn>
            <TicketDetailScene />
          </FadeIn>
        </Series.Sequence>
        <Series.Sequence durationInFrames={150} offset={-TRANSITION_FRAMES}>
          <FadeIn>
            <FractionsScene />
          </FadeIn>
        </Series.Sequence>
        <Series.Sequence durationInFrames={180} offset={-TRANSITION_FRAMES}>
          <FadeIn>
            <AssistantScene />
          </FadeIn>
        </Series.Sequence>
        <Series.Sequence durationInFrames={150} offset={-TRANSITION_FRAMES}>
          <FadeIn>
            <SuppliersScene />
          </FadeIn>
        </Series.Sequence>
        <Series.Sequence durationInFrames={90} offset={-TRANSITION_FRAMES}>
          <FadeIn>
            <BrandScene />
          </FadeIn>
        </Series.Sequence>
      </Series>
    </div>
  )
}
