import { staticFile } from 'remotion'
import { AnimatedScreenshot } from '../components/AnimatedScreenshot'

export const TicketsScene: React.FC = () => {
  return (
    <AnimatedScreenshot
      src={staticFile('screenshots/02-tickets.png')}
      panX={-30}
      startScale={1.05}
    />
  )
}
