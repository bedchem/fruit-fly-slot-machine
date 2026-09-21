/** The small line icons the pills and the byline share. */

/** A page with lines of text: the legal notice. */
export function LegalIcon() {
  return (
    <svg className="pill-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5 2.5h7l3.5 3.5v11.5H5z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" />
      <path d="M12 2.5V6h3.5" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" />
      <path d="M7.8 10h4.6M7.8 13h4.6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  );
}

/** The GitHub mark. */
export function GitHubIcon() {
  return (
    <svg className="pill-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}

/** A speaker: sound waves when on, a cross when muted. */
export function SoundIcon({ muted }) {
  return (
    <svg className="pill-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 7.5h3l4-3.5v12l-4-3.5H3z" fill="currentColor" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.2" />
      {muted ? (
        <path d="M13 7.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      ) : (
        <>
          <path d="M13 7.3a3.6 3.6 0 0 1 0 5.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
          <path d="M15.4 5a7 7 0 0 1 0 10" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
        </>
      )}
    </svg>
  );
}

/** A small grid of four: back to the Fly Lab hub. */
export function LabIcon() {
  return (
    <svg className="pill-icon" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="3" y="3" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11" y="3" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3" y="11" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11" y="11" width="6" height="6" rx="1.5" fill="currentColor" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
