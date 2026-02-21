import { staticFile } from 'remotion'
import { AnimatedScreenshot } from '../components/AnimatedScreenshot'

export const SuppliersScene: React.FC = () => {
  return (
    <AnimatedScreenshot
      src={staticFile('screenshots/06-suppliers.png')}
      panY={-20}
      startScale={1}
    />
  )
}
