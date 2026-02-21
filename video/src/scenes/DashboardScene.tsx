import { staticFile } from 'remotion'
import { AnimatedScreenshot } from '../components/AnimatedScreenshot'

export const DashboardScene: React.FC = () => {
  return (
    <AnimatedScreenshot
      src={staticFile('screenshots/01-dashboard.png')}
      startScale={1}
      endScale={1.12}
      panY={-20}
    />
  )
}
