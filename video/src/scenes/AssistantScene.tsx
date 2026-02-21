import { staticFile } from 'remotion'
import { AnimatedScreenshot } from '../components/AnimatedScreenshot'

export const AssistantScene: React.FC = () => {
  return (
    <AnimatedScreenshot
      src={staticFile('screenshots/05-assistant.png')}
      startScale={1.02}
      endScale={1.1}
      panY={-15}
    />
  )
}
