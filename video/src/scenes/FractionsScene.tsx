import { staticFile } from 'remotion'
import { AnimatedScreenshot } from '../components/AnimatedScreenshot'

export const FractionsScene: React.FC = () => {
  return (
    <AnimatedScreenshot
      src={staticFile('screenshots/04-fractions.png')}
      startScale={1}
      endScale={1.08}
    />
  )
}
