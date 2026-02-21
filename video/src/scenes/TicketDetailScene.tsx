import { staticFile } from 'remotion'
import { AnimatedScreenshot } from '../components/AnimatedScreenshot'

export const TicketDetailScene: React.FC = () => {
  return (
    <AnimatedScreenshot
      src={staticFile('screenshots/03-ticket-detail.png')}
      startScale={1}
      endScale={1.15}
      panY={-25}
    />
  )
}
