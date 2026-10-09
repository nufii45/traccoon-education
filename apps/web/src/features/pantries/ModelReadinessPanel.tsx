import { useEffect, useState } from 'react'
import { AlertCircleIcon, CheckmarkCircle02Icon, Download04Icon, Loading03Icon } from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/react'
import { Icon } from '../../components/Icon/Icon'
import { LOCAL_MODEL_ID, type LocalAiStatus } from '../local-ai/localAiClient'
import { checkModelCache, checkWebGpu, type ModelCacheState, type WebGpuSupport } from './modelReadiness'
import styles from './ModelReadinessPanel.module.css'

interface ReadinessRow {
  label: string
  value: string
  icon: IconSvgElement
  tone: 'ok' | 'info' | 'error' | 'pending'
}

const browserRow = (webGpu: WebGpuSupport | undefined): ReadinessRow => {
  if (!webGpu) {
    return { label: 'This browser', value: 'Checking for WebGPU…', icon: Loading03Icon, tone: 'pending' }
  }

  return webGpu === 'available'
    ? { label: 'This browser', value: 'WebGPU is available', icon: CheckmarkCircle02Icon, tone: 'ok' }
    : { label: 'This browser', value: 'No WebGPU here. Use Chrome or Edge, or add cards by hand below.', icon: AlertCircleIcon, tone: 'error' }
}

const filesRow = (cache: ModelCacheState | undefined): ReadinessRow => {
  switch (cache) {
    case 'cached':
      return { label: 'Model files', value: 'Saved on this device. Works offline.', icon: CheckmarkCircle02Icon, tone: 'ok' }
    case 'not-cached':
      return { label: 'Model files', value: 'Not downloaded yet. The first run downloads them once, then it works offline.', icon: Download04Icon, tone: 'info' }
    case 'unknown':
      return { label: 'Model files', value: 'Could not check this browser’s cache. The first run may download them.', icon: AlertCircleIcon, tone: 'info' }
    default:
      return { label: 'Model files', value: 'Checking this browser…', icon: Loading03Icon, tone: 'pending' }
  }
}

/**
 * Shows whether Local Private generation can run before the learner starts it:
 * the model identifier, WebGPU support, whether the model files are already
 * saved, and download progress while they arrive.
 */
export function ModelReadinessPanel({ status }: { status: LocalAiStatus }) {
  const [webGpu, setWebGpu] = useState<WebGpuSupport>()
  const [cache, setCache] = useState<ModelCacheState>()
  const isModelLoaded = status.stage === 'ready'

  // Re-check after a successful load so the files row flips to "saved".
  useEffect(() => {
    let isActive = true

    const check = async () => {
      const support = await checkWebGpu()
      if (!isActive) return
      setWebGpu(support)
      if (support !== 'available') return
      const cacheState = await checkModelCache(LOCAL_MODEL_ID)
      if (isActive) setCache(cacheState)
    }

    void check()
    return () => {
      isActive = false
    }
  }, [isModelLoaded])

  const rows = webGpu === 'available' ? [browserRow(webGpu), filesRow(isModelLoaded ? 'cached' : cache)] : [browserRow(webGpu)]
  const downloadProgress = status.stage === 'downloading' ? status.progress : undefined

  return (
    <div className={styles.panel}>
      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt>On-device model</dt>
          <dd><code className={styles.modelId}>{LOCAL_MODEL_ID}</code></dd>
        </div>
        {rows.map((row) => (
          <div className={styles.row} key={row.label}>
            <dt>{row.label}</dt>
            <dd className={styles[row.tone]}>
              <Icon icon={row.icon} size={16} />
              <span>{row.value}</span>
            </dd>
          </div>
        ))}
      </dl>
      {downloadProgress !== undefined ? (
        <div className={styles.progress}>
          <progress aria-label="Model download progress" max={100} value={downloadProgress} />
          <span>{downloadProgress}%</span>
        </div>
      ) : null}
    </div>
  )
}
