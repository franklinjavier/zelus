import { Composition } from 'remotion'
import { HeroVideo } from './HeroVideo'

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="HeroVideo"
      component={HeroVideo}
      durationInFrames={1050}
      fps={30}
      width={1280}
      height={720}
    />
  )
}
