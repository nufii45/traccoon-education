import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { validateGeneratedCard } from './features/local-ai/cardRules'
import { chunkSourcePages, selectSourcePages } from './features/local-ai/chunks'
import {
  generateCardsLocally,
  LocalGenerationCancelledError,
  LocalGenerationUnsupportedError,
  type LocalAiStatus,
} from './features/local-ai/localAiClient'
import { MAX_CARDS_PER_RUN, MAX_SELECTED_PAGES } from './features/local-ai/policy'
import type { GeneratedCard } from './features/local-ai/types'
import { KeptCard } from './features/pantries/KeptCard'
import { ManualCardForm } from './features/pantries/ManualCardForm'
import { loadPdfSource, type PdfSource } from './features/pantries/pdfText'
import { PdfPagePicker } from './features/pantries/PdfPagePicker'
import { ReviewCard } from './features/pantries/ReviewCard'
import { StudySession } from './features/study/StudySession'
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
  SquareLock02Icon,
} from '@hugeicons/core-free-icons'
import rokkiMark from './assets/rokki-educ.webp'
import { Icon } from './components/Icon/Icon'
import { HomeDashboard } from './features/onboarding/HomeDashboard'
import { OnboardingFlow } from './features/onboarding/OnboardingFlow'
import { useOnboarding } from './features/onboarding/useOnboarding'
import './App.css'

type AppView = 'home' | 'import' | 'workspace' | 'study'

const titleFromFileName = (name: string) => name.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ').trim()

function App() {
  const onboarding = useOnboarding()
  const [view, setView] = useState<AppView>('home')
  const [summaries, setSummaries] = useState<PantrySummary[]>([])
  const [activePantry, setActivePantry] = useState<Pantry>()
  const [showManualStarter, setShowManualStarter] = useState(false)
  const [error, setError] = useState<string>()

  const refreshPantries = async () => {
    setSummaries(await pantryRepository.listPantries())
  }

  useEffect(() => {
    void refreshPantries()
  }, [])

  const openPantry = async (id: string) => {
    const pantry = await pantryRepository.getPantry(id)
    setActivePantry(pantry)
    setShowManualStarter(false)
    setError(undefined)
    setView('workspace')
  }

  const createManualPantry = async (title: string) => {
    const pantry = await pantryRepository.createPantry({
      title,
      sourceName: 'Written by hand',
      sourcePages: [],
    })
    await refreshPantries()
    setActivePantry(pantry)
    setShowManualStarter(false)
    setView('workspace')
  }

  const handlePantryChange = async () => {
    if (!activePantry) {
      return
    }

    const refreshed = await pantryRepository.getPantry(activePantry.id)
    setActivePantry(refreshed)
    await refreshPantries()
  }

  const goHome = () => {
    setActivePantry(undefined)
    setShowManualStarter(false)
    setError(undefined)
    setView('home')
  }

  const startPdfImport = () => {
    setActivePantry(undefined)
    setShowManualStarter(false)
    setError(undefined)
    setView('import')
  }

  const startManualAuthoring = () => {
    setActivePantry(undefined)
    setShowManualStarter(true)
    setError(undefined)
    setView('import')
  }

  const deleteActivePantry = async () => {
    if (!activePantry) {
      return
    }

    await pantryRepository.deletePantry(activePantry.id)
    await refreshPantries()
    goHome()
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

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Pantries">
        <button className="brand" onClick={goHome} type="button">
          <img alt="" className="brand-mark" height="40" src={rokkiMark} width="40" />
          <span>traccoon <b>education</b></span>
        </button>

        <button className="new-source-button" onClick={startPdfImport} type="button">
          <Icon icon={Add01Icon} /> New source
        </button>

        <div className="sidebar-label">Your pantries</div>
        <nav className="pantry-nav">
          {summaries.length === 0 ? (
            <p className="empty-nav">Your study sets stay on this device.</p>
          ) : (
            summaries.map((pantry) => (
              <button
                className={activePantry?.id === pantry.id ? 'pantry-link active' : 'pantry-link'}
                key={pantry.id}
                onClick={() => void openPantry(pantry.id)}
                type="button"
              >
                <span>{pantry.title}</span>
                <small>{pantry.cardCount} {pantry.cardCount === 1 ? 'card' : 'cards'}</small>
              </button>
            ))
          )}
        </nav>

        <div className="sidebar-footer">
          <Icon icon={SquareLock02Icon} size={16} />
          Local Private: no study content sent for generation
        </div>
      </aside>

      <main className="main-content">
        {error ? <div className="global-error" role="alert"><Icon icon={AlertCircleIcon} /><span>{error}</span></div> : null}
        {activePantry ? (
          <PantryWorkspace
            key={activePantry.id}
            onDelete={() => void deleteActivePantry()}
            onPantryChange={() => void handlePantryChange()}
            onStudy={() => setView((current) => current === 'study' ? 'workspace' : 'study')}
            pantry={activePantry}
            showStudy={view === 'study'}
          />
        ) : view === 'import' ? (
          showManualStarter ? (
            <ManualPantryStarter
              onCancel={goHome}
              onCreate={(title) => void createManualPantry(title)}
            />
          ) : (
            <ImportWorkspace
              onError={setError}
              onPantryCreated={async (id) => {
                await refreshPantries()
                await openPantry(id)
              }}
              onStartManual={() => setShowManualStarter(true)}
            />
          )
        ) : (
          <HomeDashboard
            mode={onboarding.state.mode}
            onCreateFromPdf={startPdfImport}
            onCreateManually={startManualAuthoring}
            onOpenPantry={(id) => void openPantry(id)}
            onReplayIntro={onboarding.restartOnboarding}
            pantries={summaries}
          />
        )}
      </main>
    </div>
  )
}

function ImportWorkspace({
  onError,
  onPantryCreated,
  onStartManual,
}: {
  onError: (message: string | undefined) => void
  onPantryCreated: (id: string) => Promise<void>
  onStartManual: () => void
}) {
  const [title, setTitle] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [pdfSource, setPdfSource] = useState<PdfSource>()
  const [selectedPages, setSelectedPages] = useState<number[]>([])
  const [isPagePickerOpen, setIsPagePickerOpen] = useState(false)
  const [isReading, setIsReading] = useState(false)
  const sourceRef = useRef<PdfSource | undefined>(undefined)
  const importRequest = useRef(0)
  const sourcePages = pdfSource?.pages ?? []

  useEffect(() => () => {
    importRequest.current += 1
    void sourceRef.current?.destroy()
  }, [])

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
    <section className="welcome-workspace">
      <div className="eyebrow"><span /> LOCAL PRIVATE STUDY STUDIO</div>
      <h1>Study from your source. <em>Locally.</em></h1>
      <p className="hero-copy">Turn a few pages of a text-based PDF into reviewable cards without sending the document to a server.</p>

      <div className="privacy-callout">
        <strong>Your material stays here.</strong>
        <span>No upload. No account. No cloud generation in this MVP.</span>
      </div>

      <div className="import-panel">
        <div className="step-label">01 / BRING A SOURCE</div>
        <label className="file-drop" htmlFor="pdf-file">
          <input accept="application/pdf,.pdf" aria-label="Choose a PDF" id="pdf-file" onChange={(event) => void onFileSelected(event)} type="file" />
          <span className="file-icon"><Icon icon={FileUploadIcon} size={32} /></span>
          <strong>{isReading ? 'Reading local PDF…' : sourceName || 'Choose a PDF'}</strong>
          <small>{sourceName ? `${sourcePages.length} text pages found` : 'Text-based PDF only. Scanned PDFs need OCR, which is not in this demo.'}</small>
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
              <button className="secondary-button" onClick={() => setIsPagePickerOpen(true)} type="button">
                {selectedPages.length ? 'Edit page selection' : 'Select pages'}
              </button>
            </div>
            <button className="primary-button" disabled={selectedPages.length === 0} onClick={() => void createPantry()} type="button">
              Create local pantry <Icon icon={ArrowRight02Icon} />
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
  showStudy,
}: {
  onDelete: () => void
  onPantryChange: () => void
  onStudy: () => void
  pantry: Pantry
  showStudy: boolean
}) {
  const [selectedPages, setSelectedPages] = useState<number[]>(() => pantry.sourcePages.slice(0, MAX_SELECTED_PAGES).map((page) => page.pageNumber))
  const [candidates, setCandidates] = useState<GeneratedCard[]>([])
  const [generationStatus, setGenerationStatus] = useState<LocalAiStatus>({ stage: 'idle', detail: 'Ready when you are.' })
  const [showManualAuthor, setShowManualAuthor] = useState(false)
  const [confirmingDeletion, setConfirmingDeletion] = useState(false)
  const hasPdfSource = pantry.sourcePages.length > 0
  const [attemptSummary, setAttemptSummary] = useState<AttemptSummary>()
  const [attemptLoadError, setAttemptLoadError] = useState(false)

  // Reload recorded answers when the pantry opens and when leaving study.
  useEffect(() => {
    if (showStudy) {
      return
    }
    pantryRepository
      .listAttempts(pantry.id)
      .then((attempts) => {
        setAttemptSummary(summarizeAttempts(attempts))
        setAttemptLoadError(false)
      })
      .catch(() => setAttemptLoadError(true))
  }, [pantry.id, showStudy])
  const [generationController, setGenerationController] = useState<AbortController>()

  const generate = async () => {
    const controller = new AbortController()
    setGenerationController(controller)

    try {
      const pages = selectSourcePages(pantry.sourcePages, selectedPages)
      const result = await generateCardsLocally({
        chunks: chunkSourcePages(pages),
        sourcePages: pages,
        requestedCount: MAX_CARDS_PER_RUN,
        onStatus: setGenerationStatus,
        signal: controller.signal,
      })
      setCandidates(result.cards)
    } catch (reason) {
      if (reason instanceof LocalGenerationCancelledError || reason instanceof LocalGenerationUnsupportedError) {
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
    setCandidates((current) => current.filter((candidate) => candidate.id !== card.id))
    await onPantryChange()
  }

  const saveManualCard = async (card: GeneratedCard) => {
    await pantryRepository.saveCards(pantry.id, [card])
    setShowManualAuthor(false)
    await onPantryChange()
  }

  return (
    <section className="workspace">
      <header className="workspace-header">
        <div>
          <div className="eyebrow"><span /> LOCAL PANTRY</div>
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
          <button className="secondary-button" disabled={pantry.cards.length === 0} onClick={onStudy} type="button">Study {pantry.cards.length} {pantry.cards.length === 1 ? 'card' : 'cards'}</button>
          <button className="danger-button" onClick={() => setConfirmingDeletion(true)} type="button"><Icon icon={Delete02Icon} />Delete pantry</button>
        </div>
      </header>

      {confirmingDeletion ? (
        <div className="delete-confirmation" role="alert">
          <span>Delete this pantry, its source text, cards, and answer attempts from this browser?</span>
          <div>
            <button className="secondary-button" onClick={() => setConfirmingDeletion(false)} type="button">Keep pantry</button>
            <button className="danger-button" onClick={onDelete} type="button">Confirm local deletion</button>
          </div>
        </div>
      ) : null}

      {showStudy ? (
        <StudySession
          cards={pantry.cards}
          sourceName={pantry.sourceName}
          sourcePages={pantry.sourcePages}
          onAttempt={(selectedIndex, isCorrect, cardId) =>
            pantryRepository.saveAttempt({
              pantryId: pantry.id,
              cardId,
              selectedIndex,
              isCorrect,
            })
          }
          onBack={onStudy}
        />
      ) : null}

      {!showStudy ? (
        <>
          {hasPdfSource ? (
          <>
          <section className="generation-panel">
            <div className="panel-header">
              <div>
                <div className="step-label">02 / MAKE A SMALL BATCH</div>
                <h2>Generate up to {MAX_CARDS_PER_RUN} reviewable cards</h2>
              </div>
              <span className={`model-status ${generationStatus.stage}`}>{generationStatus.stage.replace('-', ' ')}</span>
            </div>
            <p className="panel-copy">WebLLM runs in a worker on this browser when WebGPU is ready. Every suggestion must pass a local source-quote check before you can keep it.</p>
            <fieldset className="page-picker compact">
              <legend>Source pages</legend>
              <div className="page-options">
                {pantry.sourcePages.map((page) => (
                  <label key={page.id}>
                    <input checked={selectedPages.includes(page.pageNumber)} onChange={() => togglePage(page.pageNumber)} type="checkbox" />
                    <span>p. {page.pageNumber}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="generation-actions">
              <button className="primary-button" disabled={selectedPages.length === 0 || generationStatus.stage === 'downloading' || generationStatus.stage === 'generating'} onClick={() => void generate()} type="button">
                {generationStatus.stage === 'downloading' || generationStatus.stage === 'generating' ? 'Working locally…' : 'Generate local cards'}
              </button>
              {generationController ? <button className="secondary-button" onClick={() => generationController.abort()} type="button">Cancel</button> : null}
              <span className="status-copy">{generationStatus.detail}</span>
            </div>
          </section>

          <section className="card-section">
            <div className="section-heading">
              <div>
                <div className="step-label">03 / REVIEW BEFORE KEEPING</div>
                <h2>Suggested cards</h2>
              </div>
              <span>{candidates.length} waiting</span>
            </div>
            {candidates.length === 0 ? (
              <div className="empty-state">Generate from one to three selected pages, then review each source-linked suggestion here.</div>
            ) : (
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
            )}
          </section>
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
                {pantry.cards.map((card) => <KeptCard card={card} key={card.id} />)}
              </div>
            )}
          </section>
        </>
      ) : null}
    </section>
  )
}

export default App
