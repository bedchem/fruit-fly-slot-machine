/**
 * Starts one experiment page. Every page of Fly Lab that runs the fly — the
 * casino, the bar — mounts its app through this, so they share the fonts and
 * the stylesheet.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
// fonts are served from this site, never fetched from Google: no visitor data
// leaves the domain (see the privacy notice)
import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import './styles/app.css';

export function mount(App) {
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
