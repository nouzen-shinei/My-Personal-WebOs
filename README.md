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
  - bottom-right resize handle
  - edge snap zones (left, right, top)
- Desktop session restore (window positions, app states, notes, and terminal log)
- AI command palette (Pulse AI) with shortcuts and app actions
- Virtual desktops: Workspace A and Workspace B
- Per-workspace visual themes and starter app packs
- Per-workspace dock pinning
- Keyboard multitasking controls
- In-app shortcut help overlay
- Workspace widget cards (focus, open windows, note momentum, pinned count)
- Five apps:
  - Notes (autosave to localStorage)
  - RingSurf (browser-like feed + bookmarks)
  - Paint (canvas drawing with color controls)
  - Music (playlist + audio playback)
  - Terminal simulator (themed commands)
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

## Notes

- RingOs session persists in local storage under `ringos.session.v1`.
- Open Pulse AI from the top bar or with Ctrl/Cmd + K.
- Toggle shortcut help with `?` or the `?` top bar button.
- Use Dock `Pin` / `Pinned` controls to customize favorites per workspace.
- Workspace shortcuts:
  - Ctrl/Cmd + 1 switch to Workspace A
  - Ctrl/Cmd + 2 switch to Workspace B
- Window shortcuts:
  - Ctrl/Cmd + Shift + Left Arrow snap active window left
  - Ctrl/Cmd + Shift + Right Arrow snap active window right
  - Ctrl/Cmd + Shift + Up Arrow maximize active window
  - Ctrl/Cmd + M minimize active window
  - Alt + ` cycle active window focus
- Music app currently uses sample remote tracks for demo purposes.
- RingSurf uses curated links and cards (not a full browser engine).
