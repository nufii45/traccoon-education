import { useState, type ReactNode } from 'react';
import { Rokki } from '../../components/Rokki';
import '../../styles/traccoon-tokens.css';
import './onboarding.css';

type Step = 0 | 1 | 2 | 3 | 4;
type GlyphName = 'arrow' | 'back' | 'file' | 'check' | 'cloud' | 'book' | 'plus' | 'home' | 'folder' | 'profile' | 'sparkle';

function Glyph({ name, size = 20 }: { name: GlyphName; size?: number }) {
  const path: Record<GlyphName, ReactNode> = {
    arrow: <><path d="M4 12h16M13 5l7 7-7 7" /></>,
    back: <><path d="M15 18l-6-6 6-6" /></>,
    file: <><path d="M6 3h9l4 4v14H6zM15 3v5h4M9 12h7M9 16h7" /></>,
    check: <><path d="M4 12l5 5L20 6" /></>,
    cloud: <><path d="M7 18H6a4 4 0 0 1-.4-8A6 6 0 0 1 17 9a4.5 4.5 0 0 1 1 9H7z" /></>,
    book: <><path d="M12 6C8 4 5 4 2 5v14c4-1 7-1 10 1 3-2 6-2 10-1V5c-3-1-6-1-10 1zM12 6v14" /></>,
    plus: <><path d="M12 4v16M4 12h16" /></>,
    home: <><path d="M3 10l9-7 9 7v11h-7v-7h-4v7H3z" /></>,
    folder: <><path d="M3 7h7l2 3h9v11H3zM3 7V4h7l2 3" /></>,
    profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    sparkle: <><path d="M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2z" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path[name]}</svg>;
}

export type TraccoonOnboardingProps = {
  /** Only use for preview/testing; initial experience starts on Welcome. */
  initialStep?: Step;
  displayName?: string;
  /** Choose the actual app's local-account initialization here. */
  onChooseLocal?: () => void | Promise<void>;
  /** Open the actual identity-provider/auth page here. */
  onSignIn?: () => void;
  onCreateFromPdf?: () => void;
  onCreateManually?: () => void;
  onOpenPantry?: () => void;
  onOpenRokki?: () => void;
  onOpenProfile?: () => void;
};

export function TraccoonOnboarding({
  initialStep = 0,
  displayName = 'Learner',
  onChooseLocal,
  onSignIn,
  onCreateFromPdf,
  onCreateManually,
  onOpenPantry,
  onOpenRokki,
  onOpenProfile,
}: TraccoonOnboardingProps) {
  const [step, setStep] = useState<Step>(initialStep);
  const [notice, setNotice] = useState('');
  const [localPending, setLocalPending] = useState(false);
  const go = (next: Step) => { setNotice(''); setStep(next); };
  const next = () => go(Math.min(step + 1, 4) as Step);
  const back = () => go(Math.max(step - 1, 0) as Step);
  const needHandler = (handler: (() => void) | undefined, message: string) => {
    if (handler) handler(); else setNotice(message);
  };
  const continueLocally = async () => {
    if (localPending) return;
    setLocalPending(true);
    setNotice('');
    try {
      await onChooseLocal?.();
      go(4);
    } catch {
      setNotice('Could not prepare local study. Please try again.');
    } finally {
      setLocalPending(false);
    }
  };

  return (
    <div className="tc-shell">
      {step < 4 ? (
        <main className="tc-onboarding" key={step}>
          <header className="tc-header">
            <div className="tc-brand" aria-label="Traccoon Education"><strong>traccoon<span>.</span></strong><small>EDUCATION</small></div>
            {step > 0 ? <button type="button" className="tc-back" onClick={back} aria-label="Previous onboarding screen"><Glyph name="back" /></button> : <span className="tc-header-spacer" />}
            <span className="tc-header-meta">{step === 0 ? 'TRACCOON EDUCATION' : `${String(step).padStart(2, '0')} / 04`}</span>
          </header>

          {step === 0 && <section className="tc-stage tc-stage--hero" aria-labelledby="tc-title">
            <div className="tc-copy tc-copy--welcome">
              <p className="tc-eyebrow">STUDY FROM YOUR PDF</p>
              <h1 id="tc-title">study the material<br />that matters<span className="tc-dot">.</span></h1>
              <p className="tc-lede">Turn selected PDF pages into editable study cards.</p>
              <button className="tc-btn tc-btn--primary" onClick={next}>Get started <Glyph name="arrow" /></button>
              <button className="tc-text-button" onClick={() => needHandler(onSignIn, 'Connect your app’s sign-in route to enable this action.')}>I already have an account</button>
            </div>
            <div className="tc-art tc-art--hero"><div className="tc-aura" /><div className="tc-orbit tc-orbit--one" /><div className="tc-decor tc-decor--document"><Glyph name="file" size={26} /><span>YOUR NOTES</span></div><Rokki variant="welcome" priority motion="float" size="min(100%, 680px)" /></div>
          </section>}

          {step === 1 && <section className="tc-stage tc-stage--how" aria-labelledby="tc-title">
            <div className="tc-copy">
              <p className="tc-eyebrow">HOW IT WORKS</p>
              <h1 id="tc-title">from your notes<br />to recall<span className="tc-dot">.</span></h1>
              <p className="tc-lede">Choose pages, review cards, then study.</p>
              <button className="tc-btn tc-btn--primary" onClick={next}>Continue <Glyph name="arrow" /></button>
            </div>
            <div className="tc-steps-panel">
              <div className="tc-steps-art"><div className="tc-aura" /><Rokki variant="pages" motion="gentle" /></div>
              <div className="tc-steps-list">
                <article><span className="tc-step-index">01</span><div><h2>CHOOSE PAGES</h2><p>Select only the pages relevant to your class.</p></div><Glyph name="file" size={25} /></article>
                <article><span className="tc-step-index">02</span><div><h2>REVIEW CARDS</h2><p>Check and edit AI-generated questions before studying.</p></div><Glyph name="sparkle" size={25} /></article>
                <article><span className="tc-step-index">03</span><div><h2>STUDY ANYWHERE</h2><p>Saved study material remains available offline.</p></div><Glyph name="book" size={25} /></article>
              </div>
            </div>
          </section>}

          {step === 2 && <section className="tc-stage tc-stage--offline" aria-labelledby="tc-title">
            <div className="tc-copy">
              <p className="tc-eyebrow">OFFLINE FIRST</p>
              <h1 id="tc-title">your study material<br />goes with you<span className="tc-dot">.</span></h1>
              <p className="tc-lede">Prepare material with a connection. Keep reviewing when you're offline.</p>
              <div className="tc-capabilities">
                <div><span className="tc-cap-icon"><Glyph name="cloud" /></span><div><strong>GENERATE</strong><p>Requires internet</p></div></div>
                <div className="tc-capabilities--highlight"><span className="tc-cap-icon"><Glyph name="book" /></span><div><strong>STUDY</strong><p>Available offline after save</p></div><Glyph name="check" /></div>
              </div>
              <button className="tc-btn tc-btn--primary" onClick={next}>Continue <Glyph name="arrow" /></button>
            </div>
            <div className="tc-art tc-art--offline"><div className="tc-aura" /><div className="tc-orbit tc-orbit--two" /><Rokki variant="offline" motion="float" size="min(100%, 680px)" /></div>
          </section>}

          {step === 3 && <section className="tc-stage tc-stage--choice" aria-labelledby="tc-title">
            <div className="tc-copy">
              <p className="tc-eyebrow">YOUR SPACE</p>
              <h1 id="tc-title">How do you want<br />to start?</h1>
              <p className="tc-lede">You can start studying without creating an account.</p>
              <div className="tc-options">
                <button className="tc-option tc-option--selected" onClick={() => void continueLocally()} disabled={localPending}>
                  <small>RECOMMENDED</small><strong>{localPending ? 'Preparing local study…' : 'Continue locally'}</strong><span>Study without creating an account.</span><Glyph name="arrow" />
                </button>
                <button className="tc-option" onClick={() => needHandler(onSignIn, 'Connect your app’s sign-in route to enable cloud sync.')}>
                  <small>OPTIONAL</small><strong>Sign in for cloud sync</strong><span>Keep your library across devices.</span><Glyph name="cloud" />
                </button>
              </div>
              <p className="tc-footnote">You can add an account later. Local studying is always available.</p>
            </div>
            <div className="tc-art tc-art--choice"><div className="tc-aura" /><Rokki variant="choice" motion="gentle" size="min(100%, 680px)" /></div>
          </section>}
          {notice && <div className="tc-notice" role="status">{notice}</div>}
        </main>
      ) : (
        <div className="tc-app" key="dashboard">
          <aside className="tc-sidebar" aria-label="Main navigation">
            <div className="tc-brand"><strong>traccoon<span>.</span></strong><small>EDUCATION</small></div>
            <nav aria-label="Main"><button className="tc-nav--active" aria-current="page"><Glyph name="home" /> Home</button><button onClick={() => needHandler(onOpenPantry, 'Connect your Pantry route here.')}><Glyph name="folder" /> Pantry</button><button onClick={() => needHandler(onOpenRokki, 'Connect your Rokki route here.')}><Glyph name="sparkle" /> Rokki</button><button className="tc-nav--create" onClick={() => needHandler(onCreateManually, 'Connect your manual card creation route here.')}><Glyph name="plus" /> Create</button></nav>
            <button className="tc-sidebar-profile" onClick={() => needHandler(onOpenProfile, 'Connect your Profile route here.')}><Glyph name="profile" /> Profile</button>
          </aside>
          <main className="tc-dashboard">
            <div className="tc-dashboard-top"><div><p className="tc-eyebrow">WELCOME TO YOUR SPACE</p><h1>{displayName}<span className="tc-dot">.</span></h1></div><div className="tc-avatar" aria-label="Traccoon profile">t.</div></div>
            <div className="tc-empty">
              <div className="tc-empty-art"><div className="tc-aura" /><Rokki variant="classic" motion="gentle" size="min(100%, 480px)" /></div>
              <section className="tc-empty-text"><p className="tc-eyebrow">BEGIN HERE</p><h2>Your pantry is empty.</h2><p>Add your first study material to get started.</p><button className="tc-btn tc-btn--primary" onClick={() => needHandler(onCreateFromPdf, 'Connect your PDF intake route here.')}>Create from PDF <Glyph name="file" /></button><button className="tc-btn tc-btn--secondary" onClick={() => needHandler(onCreateManually, 'Connect your manual card creation route here.')}>Create manually <Glyph name="plus" /></button><div className="tc-dashboard-note"><Glyph name="book" size={17} /> LOCAL STUDY AVAILABLE</div></section>
            </div>
            {notice && <div className="tc-notice" role="status">{notice}</div>}
          </main>
        </div>
      )}
    </div>
  );
}
