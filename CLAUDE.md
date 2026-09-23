# Fly Lab — notes for Claude

## Loading must be fast: always optimise 3D models

- Working copies of the models live in `assets/models/` (plain glTF). The dev tools
  (`tools/measure-*.mjs`, `fit-*.mjs`, `poses.mjs`, `preview.mjs`, `build-*.mjs`) read and write these.
- The site ships compressed copies in `public/models/` (Draco geometry + WebP textures).
  **Never put an uncompressed model in `public/models/`.**
- After adding or changing any model in `assets/models/`, run `npm run models`
  (`tools/compress-models.mjs`) and commit both copies. `npm run assets` runs it too.
- Load models with the self-hosted Draco decoder: `useGLTF('/models/x.glb', '/draco/')`
  and the same for `useGLTF.preload`. Never load the decoder from a CDN (privacy notice:
  no requests leave the domain).
- Use Draco, not meshopt, for the fly: its leg/head rig in `Fly.jsx` is baked from raw
  vertex positions, and meshopt quantization would move them into another space.
- Keep node and material names intact (`SlotMachine.jsx` looks up `Lever`, `Stool`,
  `Glass*`; `OldBar.jsx` looks up `TextureMaterial_*`). Don't join, flatten or dedup materials.
- Textures: WebP, 2048px max, 1024px for backdrops such as the bar.
- Check the size of anything new in `public/` before committing; a few MB total per page is the budget.

## One loading screen

- Each experiment's `index.html` has the only loading screen (`#boot`): the Fly Lab logo,
  one progress bar and a percentage. Nothing else.
- `src/ui/Loader.jsx` renders nothing; it reports model progress (drei `useProgress`) and
  connectome readiness to `window.__boot`, which fades the screen out.
- A new experiment page copies that `#boot` block and renders `<Loader ready={cnsReady} />`.
- Don't drive the bar with `requestAnimationFrame`: background tabs pause it.

## Layout conventions

- Experiment pages: `<LabHome />` (logo + "Fly Lab", links to `/`) top left above the title;
  the bottom-left menu starts with "← Back".
- Credit is "by BedChem", linking to https://github.com/orgs/bedchem/people.
- Build with `npx vite build` from PowerShell. From Git Bash with `/c/...` paths, vite can fail to resolve its own config.
