import { useEffect, useState } from 'react'
import { AlertCircleIcon, CheckmarkCircle02Icon, Loading03Icon } from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/react'
import { Icon } from '../../components/Icon/Icon'
import { LOCAL_COMPATIBILITY_MODEL_ID, LOCAL_MODEL_ID, type LocalAiStatus } from '../local-ai/localAiClient'
import { checkModelCache, checkWebGpu, expectedModelId, type ModelCacheState, type WebGpuSupport } from './modelReadiness'
import { compactModelStatus, type ModelStatusTone } from './generationStages'
import { ModelReadinessPanel } from './ModelReadinessPanel'
import styles from './ModelStatusRow.module.css'

const TONE_ICON: Record<ModelStatusTone, IconSvgElement> = {
  ok: CheckmarkCircle02Icon,
  info: Loading03Icon,
  pending: Loading03Icon,
  error: AlertCircleIcon,
}

/** Short, friendly model name for the status row ("Qwen3.5 4B"). */
const friendlyModelName = (modelId: string): string =>
  /q4f32/i.test(modelId) ? 'Qwen3.5 4B (compatibility)' : 'Qwen3.5 4B'

/**
 * Compact, student-facing model status for Step 02. Shows a single readiness
 * line and an optional offline-ready label, with the full technical panel
 * tucked behind a collapsed "Model details" disclosure for curious users.
 *
 * The readiness checks are the same browser-only WebGPU and Cache Storage
 * probes the detailed panel uses, so no study content ever leaves the device.
 */
export function ModelStatusRow({ status }: { status: LocalAiStatus }) {
  const [webGpu, setWebGpu] = useState<WebGpuSupport>()
  const [cache, setCache] = useState<ModelCacheState>()
  const [modelId, setModelId] = useState(LOCAL_MODEL_ID)
  const isModelLoaded = status.stage === 'ready'

  useEffect(() => {
    let isActive = true

    const check = async () => {
      const gpu = await checkWebGpu()
      if (!isActive) return
      setWebGpu(gpu.support)
      if (gpu.support !== 'available') return
      const expected = expectedModelId(gpu.halfPrecision, { primary: LOCAL_MODEL_ID, compatibility: LOCAL_COMPATIBILITY_MODEL_ID })
      setModelId(expected)
      const cacheState = await checkModelCache(expected)
      if (isActive) setCache(cacheState)
    }

    void check()
    return () => {
      isActive = false
    }
  }, [isModelLoaded])

  const compact = compactModelStatus(status, { webGpu, cache })

  return (
    <div className={styles.container}>
      <p className={`${styles.statusLine} ${styles[compact.tone]}`} role="status">
        <Icon icon={TONE_ICON[compact.tone]} size={16} />
        <span>
          <strong>{compact.message}</strong>
          <span className={styles.sep}> · </span>
          <span className={styles.modelName}>Powered by {friendlyModelName(modelId)}</span>
        </span>
      </p>
      {compact.offlineReady ? (
        <p className={styles.offlineLabel}>On-device AI · Offline ready</p>
      ) : null}

      <details className={styles.details}>
        <summary className={styles.summary}>Model details</summary>
        <div className={styles.detailBody}>
          <ModelReadinessPanel status={status} />
        </div>
      </details>
    </div>
  )
}
