import { RokkiLoader } from '../../components/RokkiLoader/RokkiLoader'
import type { LocalAiStatus } from '../local-ai/localAiClient'

/**
 * Rokki in the suggested-cards area while local generation is actually
 * working. Renders nothing for idle, ready, cancelled, unsupported, or error,
 * so those states keep their own recoverable messages. GenerationProgress
 * beside the Generate button is the live region, so this one stays silent. Only model download
 * reports real progress; generation itself stays indeterminate.
 */
export function GenerationLoader({ status }: { status: LocalAiStatus }) {
  switch (status.stage) {
    case 'checking':
      return <RokkiLoader announce={false} description="Checking this browser can run the model locally." mode="preparing" title="Rokki is getting ready." />
    case 'downloading':
      return (
        <RokkiLoader
          announce={false}
          description="The model is saved in this browser so next time starts faster. Your pages stay here."
          mode="preparing"
          progress={status.progress}
          title="Preparing the local model."
        />
      )
    case 'generating':
      return <RokkiLoader announce={false} mode="generating" />
    default:
      return null
  }
}
