import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { validateGeneratedCard } from './features/local-ai/cardRules'
import { chunkSourcePages, selectSourcePages } from './features/local-ai/chunks'
import {
  generateCardsLocally,
  LocalGenerationCancelledError,
  LocalGenerationUnsupportedError,
  type LocalAiStatus,
} from './features/local-ai/localAiClient'
import { MAX_CARDS_PER_RUN, MAX_SELECTED_PAGES } from './features/local-ai/policy'
import { formatPageList, generationModeForPages, hasUsablePageText, pageTextLabel } from './features/local-ai/provenance'
import type { GeneratedCard, SourcePage } from './features/local-ai/types'
import { CLOUD_OCR_MODEL_NAME } from './features/pantries/CloudOcrConsentDialog'
import { KeptCard } from './features/pantries/KeptCard'
import { releaseLocalOcr } from './features/pantries/localOcrLoader'
import { PageOcrPanel, type OcrTextSource } from './features/pantries/PageOcrPanel'
import { GenerationExperience } from './features/pantries/GenerationExperience'
import { ModelStatusRow } from './features/pantries/ModelStatusRow'
import { deriveGenerationView, isGenerationBusy } from './features/pantries/generationStages'
import { ManualCardForm } from './features/pantries/ManualCardForm'
import { loadPdfSource, type PdfSource } from './features/pantries/pdfText'
import { PdfPagePicker } from './features/pantries/PdfPagePicker'
import { ReviewCard } from './features/pantries/ReviewCard'
import { summarizeAttempts, type AttemptSummary } from './features/study/attemptSummary'
import {
  pantryRepository,
  type Pantry,
  type PantrySummary,
  type CardToSave,
} from './features/pantries/repository'
import {
  Add01Icon,
  AlertCircleIcon,
  ArrowRight02Icon,
  Delete02Icon,
  FileUploadIcon,
} from '@hugeicons/core-free-icons'
import { BrowserRouter, matchPath, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router'
import { pantryPath, practicePath, TREATS_PATH, type PracticeRouteState } from './app/navigation'
import { Sidebar } from './app/Sidebar'
import { Icon } from './components/Icon/Icon'
import { RokkiLoader } from './components/RokkiLoader/RokkiLoader'
import { LearningHub } from './features/learning/LearningHub'
import { PracticePicker } from './features/learning/PracticePicker'
import { PracticeSession } from './features/learning/PracticeSession'
import { QuizPicker } from './features/learning/QuizPicker'
import { QuizSession } from './features/learning/QuizSession'
import { PRACTICE_ROUND_SIZE, practiceRoundLength } from './features/learning/practiceRound'
import { PantryNotFound } from './features/pantries/PantryNotFound'
import { usePantry } from './features/pantries/usePantry'
import { HomeDashboard } from './features/onboarding/HomeDashboard'
import { OnboardingFlow } from './features/onboarding/OnboardingFlow'
import { useOnboarding } from './features/onboarding/useOnboarding'
import { TreatKitchen } from './features/treats/TreatKitchen'
import './App.css'

const IMPORT_PATH = '/pantries/import'
const MANUAL_PATH = '/pantries/manual'

interface ImportRouteState {
  openFilePicker?: boolean
}

/** "Study 3 cards", or "Study 5 of 12 cards" when a Practice round covers only part of the pantry. */
const studyButtonLabel = (cardCount: number) =>
  cardCount > PRACTICE_ROUND_SIZE
    ? `Study ${practiceRoundLength(cardCount)} of ${cardCount} cards`
    : `Study ${cardCount} ${cardCount === 1 ? 'card' : 'cards'}`

const titleFromFileName = (name: string) => name.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ').trim()

/** "2 text pages found", plus how many pages have no text layer when some do not. */
const textPagesFoundLabel = (textPages: number, pagesWithoutText: number) => {
  const found = `${textPages} text ${textPages === 1 ? 'page' : 'pages'} found`
  return pagesWithoutText > 0 ? `${found} · ${pagesWithoutText} without a text layer` : found
}

/** Chip style for a page's text source: Cloud OCR and missing text stand out. */
const pageSourceChipClass = (page: SourcePage) => {
  if (!hasUsablePageText(page)) return 'local-badge needs-text'
  return page.textSource === 'cloud-ocr' ? 'local-badge cloud' : 'local-badge'
}

/** The merged Step 02 sub-view: choose pages, watch Rokki work, then review. */
type BatchView = 'select' | 'generating' | 'review'

// A short success beat so the filled five-segment indicator registers before
// the review cards replace it. Not an artificial progress delay.
const SUCCESS_TRANSITION_MS = 650

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Student-facing failure copy for each non-working stop state. */
const failureMessage = (
  phase: 'failed' | 'unsupported' | 'cancelled',
  detail: string,
): string => {
  switch (phase) {
    case 'unsupported':
      return detail || 'This device can’t run the selected on-device AI model.'
    case 'cancelled':
      return 'Generation was cancelled. Your source pages are unchanged.'
    default:
      return detail || 'Rokki couldn’t finish your cards. Please try again.'
  }
}

/** Root component: real URLs via the browser history. */
function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

function AppRoutes() {
  const onboarding = useOnboarding()
  const navigate = useNavigate()
  const location = useLocation()
  const [summaries, setSummaries] = useState<PantrySummary[]>([])
  const [error, setError] = useState<string>()

  const routePantryId = matchPath('/pantries/:pantryId', location.pathname)?.params.pantryId
  const activePantryId = routePantryId === 'import' || routePantryId === 'manual' ? undefined : routePantryId
  const studyPantryId =
    matchPath('/learn/practice/:pantryId', location.pathname)?.params.pantryId ?? matchPath('/learn/quiz/:pantryId', location.pathname)?.params.pantryId
  const isStudying = studyPantryId !== undefined

  const refreshPantries = async () => {
    setSummaries(await pantryRepository.listPantries())
  }

  useEffect(() => {
    void refreshPantries()
  }, [])

  // An error belongs to the screen that raised it, and a new screen starts at
  // the top: client-side navigation keeps the previous scroll position otherwise.
  useEffect(() => {
    setError(undefined)
    document.documentElement.scrollTop = 0
  }, [location.pathname])

  const goHome = () => navigate('/pantries')
  const startPdfImport = () => navigate(IMPORT_PATH, { state: { openFilePicker: true } satisfies ImportRouteState })
  const startManualAuthoring = () => navigate(MANUAL_PATH)
  const openPantry = (id: string) => navigate(pantryPath(id))

  const createManualPantry = async (title: string) => {
    const pantry = await pantryRepository.createPantry({
      title,
      sourceName: 'Written by hand',
      sourcePages: [],
    })
    await refreshPantries()
    openPantry(pantry.id)
  }

  if (onboarding.shouldShowOnboarding) {
    return (
      <OnboardingFlow
        initialMode={onboarding.state.mode}
        onComplete={(mode) => {
          onboarding.completeOnboarding(mode)
          goHome()
        }}
        onModeChange={onboarding.setMode}
      />
    )
  }

  const myPantries = (
    <HomeDashboard
      mode={onboarding.state.mode}
      onCreateFromPdf={startPdfImport}
      onCreateManually={startManualAuthoring}
      onOpenPantry={openPantry}
      onReplayIntro={onboarding.restartOnboarding}
      pantries={summaries}
    />
  )
  const importState = location.state as ImportRouteState | null

  return (
    <div className={isStudying ? 'app-shell is-studying' : 'app-shell'}>
      {/* While studying, the studied pantry decides the Local Private or Cloud Enhanced footer. */}
      <Sidebar activePantryId={activePantryId ?? studyPantryId} onNewSource={startPdfImport} summaries={summaries} />

      <main className="main-content">
        {error ? <div className="global-error" role="alert"><Icon icon={AlertCircleIcon} /><span>{error}</span></div> : null}
        <Routes>
          <Route element={myPantries} path="/" />
          <Route element={myPantries} path="/pantries" />
          <Route
            element={(
              <ImportWorkspace
                // A new "New source" click is a new history entry, so it remounts the view.
                key={location.key}
                onError={setError}
                onPantryCreated={async (id) => {
                  await refreshPantries()
                  openPantry(id)
                }}
                onStartManual={startManualAuthoring}
                openFilePickerOnMount={importState?.openFilePicker === true}
              />
            )}
            path={IMPORT_PATH}
          />
          <Route
            element={<ManualPantryStarter onCancel={goHome} onCreate={(title) => void createManualPantry(title)} />}
            path={MANUAL_PATH}
          />
          <Route element={<PantryRoute onPantriesChange={refreshPantries} />} path="/pantries/:pantryId" />
          <Route element={<LearningHub pantries={summaries} />} path="/learn" />
          <Route element={<PracticePicker pantries={summaries} />} path="/learn/practice" />
          <Route element={<PracticeSession />} path="/learn/practice/:pantryId" />
          <Route element={<QuizPicker pantries={summaries} />} path="/learn/quiz" />
          <Route element={<QuizSession />} path="/learn/quiz/:pantryId" />
          <Route element={<TreatKitchen />} path={TREATS_PATH} />
          <Route element={<Navigate replace to="/pantries" />} path="*" />
        </Routes>
      </main>
    </div>
  )
}

function PantryRoute({ onPantriesChange }: { onPantriesChange: () => Promise<void> }) {
  const { pantryId = '' } = useParams()
  const navigate = useNavigate()
  const { pantry, reload } = usePantry(pantryId)

  if (pantry === undefined) return null
  if (pantry === null) return <PantryNotFound />

  return (
    <PantryWorkspace
      key={pantry.id}
      onDelete={async () => {
        await pantryRepository.deletePantry(pantry.id)
        await onPantriesChange()
        navigate('/pantries')
      }}
      onPantryChange={async () => {
        await reload()
        await onPantriesChange()
      }}
      // The pantry's Study button is a shortcut into Learning Hub Practice.
      onStudy={() => navigate(practicePath(pantry.id), { state: { from: 'pantry' } satisfies PracticeRouteState })}
      pantry={pantry}
    />
  )
}

function ImportWorkspace({
  onError,
  onPantryCreated,
  onStartManual,
  openFilePickerOnMount,
}: {
  onError: (message: string | undefined) => void
  onPantryCreated: (id: string) => Promise<void>
  onStartManual: () => void
  openFilePickerOnMount: boolean
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [pdfSource, setPdfSource] = useState<PdfSource>()
  const [selectedPages, setSelectedPages] = useState<number[]>([])
  const [isPagePickerOpen, setIsPagePickerOpen] = useState(false)
  const [isReading, setIsReading] = useState(false)
  const [isOcrBusy, setIsOcrBusy] = useState(false)
  const sourceRef = useRef<PdfSource | undefined>(undefined)
  const importRequest = useRef(0)
  const sourcePages = pdfSource?.pages ?? []
  const selectedSourcePages = sourcePages.filter((page) => selectedPages.includes(page.pageNumber))
  // Scanned or image-only pages need OCR before they can become cards.
  const pagesNeedingText = selectedSourcePages.filter((page) => !hasUsablePageText(page))
  const textPageCount = sourcePages.filter(hasUsablePageText).length
  const cloudOcrPageNumbers = sourcePages.filter((page) => page.textSource === 'cloud-ocr').map((page) => page.pageNumber)
  // The pantry stores only the selected pages, so they decide its mode.
  const importMode = generationModeForPages(selectedSourcePages)

  useEffect(() => () => {
    importRequest.current += 1
    void sourceRef.current?.destroy()
    void releaseLocalOcr()
  }, [])

  /** OCR text replaces the page's empty text layer and records where it came from. */
  const applyOcrText = (pageNumber: number, text: string, textSource: OcrTextSource, document: PdfSource['document']) => {
    setPdfSource((current) => (current && current.document === document
      ? {
          ...current,
          pages: current.pages.map((page) => (page.pageNumber === pageNumber ? { ...page, text, textSource } : page)),
        }
      : current))
  }

  // Runs in the same task as the "Create from a PDF" click, so the browser
  // still treats opening the file picker as user-initiated. If the learner
  // cancels it, this view stays as the fallback. The ref keeps StrictMode's
  // development double-mount from opening a second picker.
  const hasOpenedFilePicker = useRef(false)
  useLayoutEffect(() => {
    // A reload restores the history state but has no click behind it; skip
    // the picker then instead of triggering a blocked-dialog warning.
    const hasUserActivation = navigator.userActivation?.isActive ?? true
    if (openFilePickerOnMount && hasUserActivation && !hasOpenedFilePicker.current) {
      hasOpenedFilePicker.current = true
      fileInputRef.current?.click()
    }
  }, [openFilePickerOnMount])

  const onFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    event.target.value = ''
    const request = ++importRequest.current
    void sourceRef.current?.destroy()
    sourceRef.current = undefined
    setPdfSource(undefined)
    setSourceName('')
    setTitle('')
    setSelectedPages([])
    setIsPagePickerOpen(false)
    onError(undefined)
    setIsReading(true)

    try {
      const source = await loadPdfSource(file)
      if (request !== importRequest.current) {
        await source.destroy()
        return
      }
      sourceRef.current = source
      setPdfSource(source)
      setSourceName(file.name)
      setTitle(titleFromFileName(file.name))
      setIsPagePickerOpen(true)
    } catch (reason) {
      if (request !== importRequest.current) return
      onError(reason instanceof Error ? reason.message : 'Traccoon could not read that PDF.')
    } finally {
      if (request === importRequest.current) setIsReading(false)
    }
  }

  const createPantry = async () => {
    if (sourcePages.length === 0 || selectedPages.length === 0) {
      onError('Choose a text-based PDF and select one to three pages first.')
      return
    }
    if (pagesNeedingText.length > 0) {
      onError('Read the selected scanned pages with OCR, or choose pages that have text, before creating the pantry.')
      return
    }

    try {
      const selected = selectSourcePages(sourcePages, selectedPages)
      const pantry = await pantryRepository.createPantry({
        title: title || titleFromFileName(sourceName),
        sourceName,
        sourcePages: selected,
      })
      await onPantryCreated(pantry.id)
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'Traccoon could not create this pantry.')
    }
  }

  return (
    <section className="welcome-workspace import-workspace">
      <h1>Import a PDF</h1>

      {cloudOcrPageNumbers.length > 0 ? (
        <div className="privacy-callout cloud-callout">
          <strong>Cloud Enhanced.</strong>
          <span>
            With your consent, images of {formatPageList(cloudOcrPageNumbers)} were sent through Traccoon’s server to {CLOUD_OCR_MODEL_NAME} on
            Baidu AI Studio. Cards are still generated on this device.
          </span>
        </div>
      ) : (
        <div className="privacy-callout">
          <strong>Your material stays here.</strong>
          <span>No upload. No account. No cloud generation in this MVP.</span>
          <span>Scanned pages can be read with on-device OCR. Cloud OCR is optional and always asks first.</span>
        </div>
      )}

      <div className="import-panel">
        <div className="step-label">01 / BRING A SOURCE</div>
        <label className="file-drop" htmlFor="pdf-file">
          <input accept="application/pdf,.pdf" aria-label="Choose a PDF" id="pdf-file" ref={fileInputRef} onChange={(event) => void onFileSelected(event)} type="file" />
          {isReading
            ? <RokkiLoader mode="preparing" showLabel={false} size="sm" title="Reading your PDF on this device." />
            : <span className="file-icon"><Icon icon={FileUploadIcon} size={32} /></span>}
          <strong>{isReading ? 'Reading local PDF…' : sourceName || 'Choose a PDF'}</strong>
          <small>
            {sourceName
              ? textPagesFoundLabel(textPageCount, sourcePages.length - textPageCount)
              : 'Text-based PDFs work right away. Scanned pages can be read with OCR after you select them.'}
          </small>
        </label>

        {sourcePages.length > 0 ? (
          <div className="source-setup">
            <label className="field-label" htmlFor="pantry-title">Pantry name</label>
            <input id="pantry-title" onChange={(event) => setTitle(event.target.value)} value={title} />
            <div className="page-selection-summary">
              <div>
                <strong>Pages for the first card batch</strong>
                <p>{selectedPages.length ? `Selected pages: ${selectedPages.join(', ')}` : 'Preview your PDF and choose 1–3 pages.'}</p>
              </div>
              <button className="secondary-button" disabled={isOcrBusy} onClick={() => setIsPagePickerOpen(true)} type="button">
                {selectedPages.length ? 'Edit page selection' : 'Select pages'}
              </button>
            </div>
            {selectedSourcePages.length > 0 ? (
              <ul aria-label="Text source of each selected page" aria-live="polite" className="page-source-list">
                {selectedSourcePages.map((page) => (
                  <li className={pageSourceChipClass(page)} key={page.id}>p. {page.pageNumber} · {pageTextLabel(page)}</li>
                ))}
              </ul>
            ) : null}
            {pdfSource && pagesNeedingText.length > 0 ? (
              <PageOcrPanel
                document={pdfSource.document}
                onBusyChange={setIsOcrBusy}
                onPageText={(pageNumber, text, textSource) => applyOcrText(pageNumber, text, textSource, pdfSource.document)}
                onStartManual={onStartManual}
                pages={pagesNeedingText}
              />
            ) : null}
            <button
              className="primary-button"
              disabled={selectedPages.length === 0 || pagesNeedingText.length > 0 || isOcrBusy}
              onClick={() => void createPantry()}
              type="button"
            >
              {importMode === 'cloud-enhanced' ? 'Create Cloud Enhanced pantry' : 'Create local pantry'} <Icon icon={ArrowRight02Icon} />
            </button>
          </div>
        ) : null}
      </div>

      {pdfSource ? (
        <PdfPagePicker
          isOpen={isPagePickerOpen}
          onClose={() => setIsPagePickerOpen(false)}
          onSave={(pages) => {
            setSelectedPages(pages)
            setIsPagePickerOpen(false)
          }}
          selectedPages={selectedPages}
          source={pdfSource}
          sourceName={sourceName}
        />
      ) : null}

      <div className="manual-row">
        <span>Already have questions in mind?</span>
        <button onClick={onStartManual} type="button">Start a manual pantry</button>
      </div>
    </section>
  )
}

function ManualPantryStarter({ onCancel, onCreate }: { onCancel: () => void; onCreate: (title: string) => void }) {
  const [title, setTitle] = useState('My study set')

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onCreate(title)
  }

  return (
    <section className="manual-starter">
      <div className="eyebrow"><span /> MANUAL AUTHORING</div>
      <h1>Build your first card</h1>
      <p className="hero-copy">Skip local generation and author a small, evidence-linked study set yourself.</p>
      <form className="starter-form" onSubmit={submit}>
        <label className="field-label" htmlFor="manual-pantry-title">Pantry name</label>
        <input id="manual-pantry-title" onChange={(event) => setTitle(event.target.value)} value={title} />
        <div className="form-actions">
          <button className="secondary-button" onClick={onCancel} type="button">Back</button>
          <button className="primary-button" type="submit">Create manual pantry <Icon icon={ArrowRight02Icon} /></button>
        </div>
      </form>
    </section>
  )
}

function PantryWorkspace({
  onDelete,
  onPantryChange,
  onStudy,
  pantry,
}: {
  onDelete: () => Promise<void>
  onPantryChange: () => Promise<void>
  onStudy: () => void
  pantry: Pantry
}) {
  const [selectedPages, setSelectedPages] = useState<number[]>(() => pantry.sourcePages.slice(0, MAX_SELECTED_PAGES).map((page) => page.pageNumber))
  const [candidates, setCandidates] = useState<GeneratedCard[]>([])
  const [generationStatus, setGenerationStatus] = useState<LocalAiStatus>({ stage: 'idle', detail: 'Ready when you are.' })
  // The merged Step 02 view: pick pages, watch Rokki work, then review.
  const [batchView, setBatchView] = useState<BatchView>('select')
  const [showManualAuthor, setShowManualAuthor] = useState(false)
  const [confirmingDeletion, setConfirmingDeletion] = useState(false)
  const hasPdfSource = pantry.sourcePages.length > 0
  // Any page read by Cloud OCR makes the whole pantry and its cards Cloud Enhanced.
  const pantryMode = generationModeForPages(pantry.sourcePages)
  const isCloudEnhanced = pantryMode === 'cloud-enhanced'
  const cloudOcrPageNumbers = pantry.sourcePages.filter((page) => page.textSource === 'cloud-ocr').map((page) => page.pageNumber)
  const [attemptSummary, setAttemptSummary] = useState<AttemptSummary>()
  const [attemptLoadError, setAttemptLoadError] = useState(false)

  // Studying is its own route, so returning from it remounts and reloads answers.
  useEffect(() => {
    pantryRepository
      .listAttempts(pantry.id)
      .then((attempts) => {
        setAttemptSummary(summarizeAttempts(attempts))
        setAttemptLoadError(false)
      })
      .catch(() => setAttemptLoadError(true))
  }, [pantry.id])
  const [generationController, setGenerationController] = useState<AbortController>()

  // The five-stage view is derived from the real status plus whether
  // review-ready cards exist, so segments never advance ahead of the pipeline.
  const generationView = deriveGenerationView(generationStatus, candidates.length > 0)

  // Returns to page selection without carrying broken generation state. Page
  // selections are preserved so an error or cancel does not lose the choice.
  const returnToSelection = () => {
    setBatchView('select')
    setCandidates([])
    setGenerationStatus({ stage: 'idle', detail: 'Ready when you are.' })
  }

  const generate = async () => {
    const controller = new AbortController()
    setGenerationController(controller)
    setCandidates([])
    setBatchView('generating')
    setGenerationStatus({ stage: 'checking', detail: 'Checking this browser for WebGPU…' })

    try {
      const pages = selectSourcePages(pantry.sourcePages, selectedPages)
      const result = await generateCardsLocally({
        chunks: chunkSourcePages(pages),
        sourcePages: pages,
        requestedCount: MAX_CARDS_PER_RUN,
        onStatus: setGenerationStatus,
        signal: controller.signal,
      })
      if (controller.signal.aborted) {
        return
      }
      if (result.cards.length === 0) {
        // A run that produced nothing valid is a retryable failure, not a
        // reason to open an empty review screen.
        setGenerationStatus({ stage: 'error', detail: 'Rokki couldn’t verify the generated questions against your pages.' })
        return
      }
      // The generator runs on this device and marks cards Local Private. Cards
      // from a pantry with Cloud OCR text take the pantry's Cloud Enhanced mode.
      setCandidates(result.cards.map((card) => ({ ...card, generationMode: pantryMode })))
      // A brief success beat so the filled segments read before review opens.
      await delay(SUCCESS_TRANSITION_MS)
      if (!controller.signal.aborted) {
        setBatchView('review')
      }
    } catch (reason) {
      if (reason instanceof LocalGenerationCancelledError) {
        // Cancellation keeps the page selection and returns to the picker.
        returnToSelection()
        return
      }
      if (reason instanceof LocalGenerationUnsupportedError) {
        // Status already carries the unsupported message; stay on the loader
        // so the compatibility guidance and retry are visible.
        return
      }
      setGenerationStatus({
        stage: 'error',
        detail: reason instanceof Error ? reason.message : 'Local generation could not start.',
      })
    } finally {
      setGenerationController(undefined)
    }
  }

  const togglePage = (pageNumber: number) => {
    setSelectedPages((current) => {
      if (current.includes(pageNumber)) {
        return current.filter((page) => page !== pageNumber)
      }
      if (current.length === MAX_SELECTED_PAGES) {
        setGenerationStatus({ stage: 'error', detail: `Choose no more than ${MAX_SELECTED_PAGES} pages for one generation run.` })
        return current
      }
      return [...current, pageNumber].sort((a, b) => a - b)
    })
  }

  const keepCard = async (card: CardToSave) => {
    const validation = validateGeneratedCard(card, pantry.sourcePages)
    if (!validation.valid) {
      setGenerationStatus({ stage: 'error', detail: validation.errors.join(' ') })
      return
    }

    await pantryRepository.saveCards(pantry.id, [card])
    setGenerationStatus({ stage: 'idle', detail: 'Ready when you are.' })
    setCandidates((current) => current.filter((candidate) => candidate.id !== card.id))
    await onPantryChange()
  }

  const saveManualCard = async (card: GeneratedCard) => {
    await pantryRepository.saveCards(pantry.id, [{ ...card, generationMode: pantryMode }])
    setShowManualAuthor(false)
    await onPantryChange()
  }

  return (
    <section className="workspace">
      <header className="workspace-header">
        <div>
          <div className="eyebrow"><span /> {isCloudEnhanced ? 'CLOUD ENHANCED PANTRY' : 'LOCAL PANTRY'}</div>
          <h1>{pantry.title}</h1>
          <p>
            {hasPdfSource
              ? `${pantry.sourceName} · ${pantry.sourcePages.length} local source ${pantry.sourcePages.length === 1 ? 'page' : 'pages'}`
              : 'Written by hand · no PDF'}
          </p>
          {attemptSummary ? (
            <p className="attempt-summary">
              Recorded on this device: {attemptSummary.correct} of {attemptSummary.answered} answers correct · last studied{' '}
              {new Date(attemptSummary.lastStudiedAt).toLocaleString()}
            </p>
          ) : null}
          {attemptLoadError ? <p className="form-error" role="alert">Answer history could not be loaded from this device.</p> : null}
        </div>
        <div className="header-actions">
          <button className="secondary-button" disabled={pantry.cards.length === 0} onClick={onStudy} type="button">{studyButtonLabel(pantry.cards.length)}</button>
          <button className="danger-button" onClick={() => setConfirmingDeletion(true)} type="button"><Icon icon={Delete02Icon} />Delete pantry</button>
        </div>
      </header>

      {confirmingDeletion ? (
        <div className="delete-confirmation" role="alert">
          <span>
            Delete this pantry, its source text, cards, and answer attempts from this browser?
            {isCloudEnhanced ? ' This removes the copy on this device only; it can’t recall page images already sent to Cloud OCR.' : null}
          </span>
          <div>
            <button className="secondary-button" onClick={() => setConfirmingDeletion(false)} type="button">Keep pantry</button>
            <button className="danger-button" onClick={() => void onDelete()} type="button">Confirm local deletion</button>
          </div>
        </div>
      ) : null}

      <>
          {hasPdfSource ? (
          <>
          <section className="generation-panel">
            <div className="panel-header">
              <div>
                <div className="step-label">02 / MAKE A SMALL BATCH</div>
                <h2>Generate up to {MAX_CARDS_PER_RUN} reviewable cards</h2>
              </div>
            </div>

            {batchView === 'select' ? (
              <>
                <p className="panel-copy">
                  {isCloudEnhanced
                    ? `Runs in this browser on this laptop. Text for ${formatPageList(cloudOcrPageNumbers)} came from Cloud OCR with your consent, so this pantry and its cards are Cloud Enhanced. Each suggestion must match a quote on its page before you can keep it.`
                    : 'Runs in this browser on this laptop. Nothing is uploaded. Each suggestion must match a quote on its page before you can keep it.'}
                </p>
                <ModelStatusRow status={generationStatus} />
                <fieldset className="page-picker compact">
                  <legend>Source pages</legend>
                  <div className="page-options">
                    {pantry.sourcePages.map((page) => (
                      <label key={page.id}>
                        <input checked={selectedPages.includes(page.pageNumber)} onChange={() => togglePage(page.pageNumber)} type="checkbox" />
                        <span>p. {page.pageNumber} · {pageTextLabel(page)}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {generationStatus.stage === 'error' ? (
                  <p className="form-error" role="alert">{generationStatus.detail}</p>
                ) : null}
                <div className="generation-actions">
                  <button
                    className="primary-button"
                    disabled={selectedPages.length === 0 || isGenerationBusy(generationStatus)}
                    onClick={() => void generate()}
                    type="button"
                  >
                    Generate my study cards <Icon icon={ArrowRight02Icon} />
                  </button>
                </div>
              </>
            ) : null}

            {batchView === 'generating' ? (
              <div className="generation-loader">
                {generationView.phase === 'failed'
                || generationView.phase === 'unsupported'
                || generationView.phase === 'cancelled' ? (
                  <div className="generation-failure" role="alert">
                    <p>{failureMessage(generationView.phase, generationStatus.detail)}</p>
                    <div className="generation-actions">
                      <button className="primary-button" onClick={() => void generate()} type="button">Try again</button>
                      <button className="secondary-button" onClick={returnToSelection} type="button">Back to pages</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <GenerationExperience status={generationStatus} view={generationView} />
                    {generationController ? (
                      <div className="generation-actions generation-actions-centered">
                        <button className="secondary-button" onClick={() => generationController.abort()} type="button">Cancel</button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </section>

          {batchView === 'review' ? (
          <section className="card-section">
            <div className="section-heading">
              <div>
                <div className="step-label">03 / REVIEW YOUR CARDS</div>
                <h2>Suggested cards</h2>
              </div>
              <span>{candidates.length} waiting</span>
            </div>
            {generationStatus.stage === 'error' ? (
              <p className="form-error" role="alert">{generationStatus.detail}</p>
            ) : null}
            {candidates.length === 0 ? (
              <div className="empty-state">
                Rokki couldn’t verify any questions against your pages this time.
                <div className="generation-actions">
                  <button className="primary-button" onClick={returnToSelection} type="button">Choose pages again</button>
                </div>
              </div>
            ) : (
              <>
                {candidates.length < MAX_CARDS_PER_RUN ? (
                  <p className="panel-copy">Rokki verified {candidates.length} of up to {MAX_CARDS_PER_RUN} cards against your pages. Keep the ones you want.</p>
                ) : null}
                <div className="candidate-stack">
                  {candidates.map((card) => (
                    <ReviewCard
                      card={card}
                      key={card.id}
                      onDiscard={() => setCandidates((current) => current.filter((candidate) => candidate.id !== card.id))}
                      onKeep={(updated) => void keepCard(updated)}
                      sourcePages={pantry.sourcePages}
                    />
                  ))}
                </div>
                <div className="generation-actions">
                  <button className="secondary-button" onClick={returnToSelection} type="button">Back to page selection</button>
                </div>
              </>
            )}
          </section>
          ) : null}
          </>
          ) : null}

          <section className={hasPdfSource ? 'card-section kept-section' : 'card-section'}>
            <div className="section-heading">
              <div>
                <div className="step-label">{hasPdfSource ? '04 / YOUR STUDY SET' : 'YOUR STUDY SET'}</div>
                <h2>Kept cards</h2>
              </div>
              <button className="text-button" onClick={() => setShowManualAuthor((current) => !current)} type="button"><Icon icon={Add01Icon} />Add manual card</button>
            </div>
            {showManualAuthor ? <ManualCardForm onCancel={() => setShowManualAuthor(false)} onSave={(card) => void saveManualCard(card)} sourcePages={pantry.sourcePages} /> : null}
            {pantry.cards.length === 0 ? (
              <div className="empty-state">{hasPdfSource ? 'Nothing kept yet. You can review local suggestions or create a card by hand.' : 'No cards yet. Add your first card by hand.'}</div>
            ) : (
              <div className="kept-grid">
                {pantry.cards.map((card) => <KeptCard card={card} key={card.id} sourcePages={pantry.sourcePages} />)}
              </div>
            )}
          </section>
      </>
    </section>
  )
}

export default App
