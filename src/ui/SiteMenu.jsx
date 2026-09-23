import { HowItWorksButton } from './HowItWorks.jsx';
import { LegalIcon, BackIcon, SoundIcon, FlyLogo } from './icons.jsx';

/** The shared control menu used by every interactive Fly Lab experiment. */
export function SiteMenu({ muted, onToggleSound, howOpen, onToggleHow }) {
  return (
    <nav className="dock-left site-menu" aria-label="Controls">
      <a className="pill info home" href="/"><BackIcon />Back</a>
      <button
        type="button"
        className={`pill sound ${muted ? 'off' : ''}`}
        aria-pressed={!muted}
        onClick={onToggleSound}
      >
        <SoundIcon muted={muted} />
        {muted ? 'Sound off' : 'Sound on'}
      </button>
      <a className="pill info" href="/legal.html"><LegalIcon />Legal</a>
      <HowItWorksButton open={howOpen} onToggle={onToggleHow} />
    </nav>
  );
}

/** Top left of every experiment: the way back to the Fly Lab landing page. */
export function LabHome() {
  return <a className="lab-home" href="/"><FlyLogo />Fly Lab</a>;
}
