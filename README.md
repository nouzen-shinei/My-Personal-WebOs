# RingOs

RingOs is a browser-based WebOS concept for Hack Club Flavortown.

This MVP is a hybrid experience:
- Flavortown-inspired visual personality
- AI-native productivity vibe
- Complete windowed desktop shell with core apps

## Included MVP Features

- Desktop shell with top bar, launcher, and dock
- Draggable window manager with:
  - open
  - close
  - minimize
  - maximize
  - focus layering (z-index)
  - resizing from all sides and corners
  - edge snap zones (left, right, top)
- Desktop session restore (window positions, app states, notes, and terminal log)
- AI command palette (Pulse AI) with shortcuts and app actions
- Virtual desktops: Workspace A and Workspace B
- Per-workspace visual themes and starter app packs
- Per-workspace dock pinning
- Dock edit mode for drag-reordering pinned apps
- Dock right-click context menu with quick actions
- Dock hover previews (including minimized windows)
- Layout panel with active-window presets and workspace auto-arrange (quarters, thirds, cascade)
- Smart priority tiling keeps Terminal/Notes larger while other windows tile around them
- Saved layout profile per workspace (auto-restores preferred layout when switching workspaces)
- One-click exact arrangement save/restore per workspace (stores precise window positions and sizes)
- Visual layout diagrams in layout controls for at-a-glance understanding
- Smooth animated layout reflow transitions
- Launcher, Pulse AI, Layouts, and Shortcut panels open anchored below their top-bar controls
- Anchored panels close when clicking anywhere outside, and support animated enter/exit motion
- Tiny first-run coachmark walkthrough for Layouts, Launcher, and Pulse AI
- RingSurf advanced browsing workspace with:
  - multi-tab sessions with per-tab history stacks
  - drag-to-reorder tab strip
  - pin/favorite tabs and tab grouping
  - collapsible tab-group lanes
  - pinned tabs are protected from accidental close
  - smart address bar (URL or search query)
  - bookmark save/remove
  - discover + power tools views
  - recent history mini preview cards
  - drop-target highlights and reorder animation feedback
  - data import/export as JSON
- Keyboard multitasking controls
- In-app shortcut help overlay
- Workspace widget cards (focus, open windows, note momentum, pinned count)
- Five apps:
  - Notes (title, word count, export txt, clear)
  - RingSurf (multi-tab sessions, history, bookmarks, discover, tools, import/export)
  - Paint (brush/eraser, size, color picker, undo/redo, PNG export)
  - Music (playlist, next/prev, volume, local file upload)
  - Terminal simulator (workspace commands, app open command, utility commands)
- Flavor Pulse mood engine by time-of-day

## Stack

- React
- TypeScript
- Vite
- CSS with design tokens and responsive layout

## Run Locally

```bash
npm install
npm run dev
```

Then open the local URL shown by Vite.

## Build

```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages

This repo includes an automated Pages workflow at `.github/workflows/deploy-pages.yml`.

1. Push this project to a GitHub repository.
2. Ensure your default branch is `main` (or update the workflow branch trigger).
3. In GitHub, open **Settings > Pages**.
4. Set **Source** to **GitHub Actions**.
5. Push to `main` and wait for the **Deploy RingOs to Pages** workflow to finish.

Your app will be available at:

- `https://<your-username>.github.io/<your-repo-name>/`

Notes:

- `vite.config.ts` automatically sets the correct `base` path in GitHub Actions builds.
- Local development still runs at root (`/`) with `npm run dev`.

## Notes

- RingOs session persists in local storage under `ringos.session.v1`.
- Open Pulse AI from the top bar or with Ctrl/Cmd + K.
- Toggle shortcut help with `?` or the `?` top bar button.
- Click a dock app to focus visible window, restore minimized window, or open a new one if none exist.
- Dock pin icon appears directly on each dock app to pin/unpin quickly.
- Use `Edit Dock` to drag pinned apps and reorder workspace-specific dock priority.
- Unpinning removes an app from dock when it has no running windows in that workspace.
- Launcher shows pin controls so apps can be pinned before opening.
- Right-click a dock app for quick actions: open new window, pin/unpin, move app windows to other workspace, close all app windows.
- Launcher includes app search for fast filtering.
- Keyboard context menu access:
  - Focus a dock app button, then press Shift+F10 or Menu key to open menu.
  - Use Arrow Up/Down, Home/End, Enter/Space, and Esc inside the menu.
- Direct dock launch shortcuts:
  - Alt + 1..9 launches/restores dock apps by current workspace order
- Workspace shortcuts:
  - Ctrl/Cmd + 1 switch to Workspace A
  - Ctrl/Cmd + 2 switch to Workspace B
- Window shortcuts:
  - Ctrl/Cmd + Shift + Left Arrow snap active window left
  - Ctrl/Cmd + Shift + Right Arrow snap active window right
  - Ctrl/Cmd + Shift + Up Arrow maximize active window
  - Ctrl/Cmd + Shift + 3 tile visible windows in thirds
  - Ctrl/Cmd + Shift + 4 tile visible windows in quarters
  - Ctrl/Cmd + Shift + 0 cascade visible windows
  - Ctrl/Cmd + M minimize active window
  - Alt + ` cycle active window focus
- RingSurf shortcuts (when browser window is focused):
  - Ctrl/Cmd + L focus/select RingSurf address bar
  - Ctrl/Cmd + [ navigate back in RingSurf history
  - Ctrl/Cmd + ] navigate forward in RingSurf history
- Terminal layout command:
  - layout quarters
  - layout thirds
  - layout cascade
  - layout save
  - layout restore
- Planning docs:
  - `docs/RINGOS_ROADMAP.md`
  - `docs/RINGOS_PLAN.md`
- Music app currently uses sample remote tracks for demo purposes.
- RingSurf uses curated links and cards (not a full browser engine).
