import { useEffect, useMemo, useRef, useState } from 'react'

type AppId = 'notes' | 'browser' | 'paint' | 'music' | 'terminal'
type BrowserTab = 'feed' | 'bookmarks' | 'discover'
type SnapHint = 'left' | 'right' | 'top' | null
type SnapMode = 'none' | 'left' | 'right'
type WorkspaceId = 'A' | 'B'

type RingWindow = {
  id: number
  appId: AppId
  title: string
  x: number
  y: number
  width: number
  height: number
  minimized: boolean
  maximized: boolean
  z: number
  snap: SnapMode
  workspace: WorkspaceId
}

type DragState = {
  id: number
  offsetX: number
  offsetY: number
}

type ResizeState = {
  id: number
  startX: number
  startY: number
  startWidth: number
  startHeight: number
}

type RingSession = {
  windows: RingWindow[]
  nextId: number
  topZ: number
  notesValue: string
  activeTrack: string | null
  terminalLog: string[]
  browserTab: BrowserTab
  currentWorkspace: WorkspaceId
  pinnedByWorkspace: Record<WorkspaceId, AppId[]>
}

type PaletteCommand = {
  id: string
  label: string
  hint: string
  run: () => void
}

type WorkspaceProfile = {
  title: string
  subtitle: string
  chips: string[]
  starterApps: AppId[]
}

const APP_DEFS: Record<AppId, { title: string; icon: string; color: string }> = {
  notes: { title: 'Notes', icon: 'N', color: '#ff8f00' },
  browser: { title: 'RingSurf', icon: 'R', color: '#f4511e' },
  paint: { title: 'Paint', icon: 'P', color: '#00897b' },
  music: { title: 'Music', icon: 'M', color: '#2e7d32' },
  terminal: { title: 'Terminal', icon: 'T', color: '#263238' },
}

const STARTUP_APPS: AppId[] = ['notes', 'browser']
const DESKTOP_TOP = 52
const DESKTOP_BOTTOM = 68
const SESSION_KEY = 'ringos.session.v1'

const DEFAULT_NOTES = 'Welcome to RingOs.\n\nWrite ideas for your Flavortown build here.'
const DEFAULT_TERMINAL = ['RingShell v1.0', 'Type "help" to list available commands.']
const DEFAULT_PINS: Record<WorkspaceId, AppId[]> = {
  A: ['notes', 'browser', 'terminal'],
  B: ['paint', 'music', 'notes'],
}

const WORKSPACE_PROFILES: Record<WorkspaceId, WorkspaceProfile> = {
  A: {
    title: 'Build Bay',
    subtitle: 'Code, plan, and ship quickly with focused tools.',
    chips: ['Notes + Browser', 'Terminal Workflow', 'Sprint Focus'],
    starterApps: ['notes', 'browser', 'terminal'],
  },
  B: {
    title: 'Creative Kitchen',
    subtitle: 'Sketch, soundtrack, and shape visual ideas.',
    chips: ['Paint + Music', 'Idea Drafts', 'Mood Space'],
    starterApps: ['paint', 'music', 'notes'],
  },
}

function App() {
  const restored = loadSession()
  const [windows, setWindows] = useState<RingWindow[]>(restored.windows)
  const [nextId, setNextId] = useState(restored.nextId)
  const [topZ, setTopZ] = useState(restored.topZ)
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceId>(restored.currentWorkspace)
  const [activeWindowId, setActiveWindowId] = useState<number | null>(null)
  const [launcherOpen, setLauncherOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [snapHint, setSnapHint] = useState<SnapHint>(null)
  const [clock, setClock] = useState(() => new Date())
  const [notesValue, setNotesValue] = useState(restored.notesValue)
  const [activeTrack, setActiveTrack] = useState<string | null>(restored.activeTrack)
  const [terminalLog, setTerminalLog] = useState<string[]>(restored.terminalLog)
  const [terminalInput, setTerminalInput] = useState('')
  const [browserTab, setBrowserTab] = useState<BrowserTab>(restored.browserTab)
  const [pinnedByWorkspace, setPinnedByWorkspace] = useState<Record<WorkspaceId, AppId[]>>(
    restored.pinnedByWorkspace,
  )

  const dragRef = useRef<DragState | null>(null)
  const resizeRef = useRef<ResizeState | null>(null)
  const paletteInputRef = useRef<HTMLInputElement | null>(null)
  const paintCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const paintCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const paintDrawingRef = useRef(false)

  const workspaceProfile = WORKSPACE_PROFILES[currentWorkspace]

  useEffect(() => {
    if (windows.length > 0) {
      return
    }

    const created = STARTUP_APPS.map((appId, idx) => makeWindow(appId, idx + 1, 10 + idx, 'A'))
    setWindows(created)
    setNextId(created.length + 1)
    setTopZ(10 + created.length)
    setCurrentWorkspace('A')
    setActiveWindowId(created[created.length - 1]?.id ?? null)
  }, [windows.length])

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (paletteOpen) {
      window.setTimeout(() => paletteInputRef.current?.focus(), 0)
    }
  }, [paletteOpen])

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (drag) {
        const hint = getSnapHint(event.clientX, event.clientY)
        setSnapHint(hint)
        setWindows((prev) =>
          prev.map((w) => {
            if (w.id !== drag.id || w.maximized) {
              return w
            }

            const nextX = Math.max(8, Math.min(window.innerWidth - 220, event.clientX - drag.offsetX))
            const maxHeight = window.innerHeight - DESKTOP_TOP - DESKTOP_BOTTOM - 8
            const nextY = Math.max(DESKTOP_TOP, Math.min(window.innerHeight - 140, event.clientY - drag.offsetY))

            return {
              ...w,
              x: nextX,
              y: nextY,
              height: Math.min(w.height, maxHeight),
            }
          }),
        )
      }

      const resize = resizeRef.current
      if (resize) {
        setWindows((prev) =>
          prev.map((w) => {
            if (w.id !== resize.id || w.maximized) {
              return w
            }

            const width = Math.max(320, resize.startWidth + (event.clientX - resize.startX))
            const maxHeight = window.innerHeight - DESKTOP_TOP - DESKTOP_BOTTOM - w.y - 8
            const height = Math.max(240, Math.min(maxHeight, resize.startHeight + (event.clientY - resize.startY)))
            return { ...w, width, height, snap: 'none' }
          }),
        )
      }
    }

    const onPointerUp = () => {
      const drag = dragRef.current
      if (drag) {
        applySnap(drag.id, snapHint)
      }

      dragRef.current = null
      resizeRef.current = null
      setSnapHint(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [snapHint])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTypingContext = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }

      if (event.key === 'Escape') {
        setLauncherOpen(false)
        setPaletteOpen(false)
        setShortcutHelpOpen(false)
        return
      }

      if (isTypingContext) {
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key === '1') {
        event.preventDefault()
        setCurrentWorkspace('A')
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key === '2') {
        event.preventDefault()
        setCurrentWorkspace('B')
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'm') {
        event.preventDefault()
        if (activeWindowId) {
          minimizeWindow(activeWindowId)
        }
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.shiftKey) {
        if (event.key === 'ArrowLeft' && activeWindowId) {
          event.preventDefault()
          applySnap(activeWindowId, 'left')
          return
        }

        if (event.key === 'ArrowRight' && activeWindowId) {
          event.preventDefault()
          applySnap(activeWindowId, 'right')
          return
        }

        if (event.key === 'ArrowUp' && activeWindowId) {
          event.preventDefault()
          applySnap(activeWindowId, 'top')
          return
        }
      }

      if (event.altKey && event.key === '`') {
        event.preventDefault()
        cycleWindow()
      }

      if (event.key === '?') {
        event.preventDefault()
        setShortcutHelpOpen((v) => !v)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeWindowId, currentWorkspace, windows])

  useEffect(() => {
    const canvas = paintCanvasRef.current
    if (!canvas || paintCtxRef.current) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    ctx.fillStyle = '#fffdf6'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 4
    ctx.strokeStyle = '#f4511e'
    paintCtxRef.current = ctx
  }, [])

  useEffect(() => {
    const session: RingSession = {
      windows,
      nextId,
      topZ,
      notesValue,
      activeTrack,
      terminalLog,
      browserTab,
      currentWorkspace,
      pinnedByWorkspace,
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  }, [windows, nextId, topZ, notesValue, activeTrack, terminalLog, browserTab, currentWorkspace, pinnedByWorkspace])

  useEffect(() => {
    if (!activeWindowId) {
      return
    }

    const active = windows.find((w) => w.id === activeWindowId)
    if (!active || active.workspace !== currentWorkspace || active.minimized) {
      const replacement = [...windows]
        .filter((w) => w.workspace === currentWorkspace && !w.minimized)
        .sort((a, b) => b.z - a.z)[0]
      setActiveWindowId(replacement?.id ?? null)
    }
  }, [activeWindowId, windows, currentWorkspace])

  const mood = useMemo(() => {
    const hour = clock.getHours()
    if (hour < 10) {
      return 'Sunrise Soda'
    }
    if (hour < 18) {
      return 'Citrus Shift'
    }
    return 'Neon Diner'
  }, [clock])

  const visibleWindows = useMemo(() => {
    return windows
      .filter((w) => !w.minimized && w.workspace === currentWorkspace)
      .sort((a, b) => a.z - b.z)
  }, [windows, currentWorkspace])

  const appCounts = useMemo(() => {
    return windows.reduce<Record<AppId, number>>(
      (acc, win) => {
        if (!win.minimized && win.workspace === currentWorkspace) {
          acc[win.appId] += 1
        }
        return acc
      },
      { notes: 0, browser: 0, paint: 0, music: 0, terminal: 0 },
    )
  }, [windows, currentWorkspace])

  const pinnedApps = pinnedByWorkspace[currentWorkspace]

  const dockApps = useMemo(() => {
    const all = Object.keys(APP_DEFS) as AppId[]
    const ordered = [...pinnedApps]
    const remainder = all.filter((appId) => !ordered.includes(appId))
    return [...ordered, ...remainder]
  }, [pinnedApps])

  const workspaceWidgets = useMemo(() => {
    const notesWordCount = notesValue.trim() ? notesValue.trim().split(/\s+/).length : 0
    const totalVisible = visibleWindows.length
    const focusedApp = visibleWindows.find((win) => win.id === activeWindowId)?.appId
    const focusedTitle = focusedApp ? APP_DEFS[focusedApp].title : 'None'

    return [
      {
        title: 'Open Windows',
        value: String(totalVisible),
        detail: `${currentWorkspace} workspace active`,
      },
      {
        title: 'Focus App',
        value: focusedTitle,
        detail: 'Current attention target',
      },
      {
        title: 'Notes Words',
        value: String(notesWordCount),
        detail: 'Quick writing momentum',
      },
      {
        title: 'Pinned Apps',
        value: String(pinnedApps.length),
        detail: 'Dock favorites in this workspace',
      },
    ]
  }, [activeWindowId, currentWorkspace, notesValue, pinnedApps.length, visibleWindows])

  const openApp = (appId: AppId) => {
    const id = nextId
    const z = topZ + 1
    const win = makeWindow(appId, id, z, currentWorkspace)

    setWindows((prev) => [...prev, win])
    setNextId((v) => v + 1)
    setTopZ(z)
    setActiveWindowId(id)
    setLauncherOpen(false)
  }

  const bringToFront = (id: number) => {
    const z = topZ + 1
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, z, minimized: false } : w)))
    setTopZ(z)
    setActiveWindowId(id)
  }

  const closeWindow = (id: number) => {
    setWindows((prev) => prev.filter((w) => w.id !== id))
    if (activeWindowId === id) {
      setActiveWindowId(null)
    }
  }

  const minimizeWindow = (id: number) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)))
    if (activeWindowId === id) {
      setActiveWindowId(null)
    }
  }

  const toggleMaximize = (id: number) => {
    bringToFront(id)
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== id) {
          return w
        }
        return { ...w, maximized: !w.maximized, snap: 'none' }
      }),
    )
  }

  const restoreWindowByApp = (appId: AppId) => {
    const target = [...windows]
      .filter((w) => w.appId === appId && w.workspace === currentWorkspace)
      .sort((a, b) => b.z - a.z)
      .find((w) => w.minimized)

    if (target) {
      bringToFront(target.id)
      return
    }

    openApp(appId)
  }

  const toggleDockPin = (appId: AppId) => {
    setPinnedByWorkspace((prev) => {
      const currentPins = prev[currentWorkspace]
      const isPinned = currentPins.includes(appId)
      const nextPins = isPinned ? currentPins.filter((id) => id !== appId) : [...currentPins, appId]
      return {
        ...prev,
        [currentWorkspace]: nextPins,
      }
    })
  }

  const cycleWindow = () => {
    const candidates = [...windows]
      .filter((w) => w.workspace === currentWorkspace && !w.minimized)
      .sort((a, b) => b.z - a.z)

    if (candidates.length === 0) {
      return
    }

    if (!activeWindowId) {
      bringToFront(candidates[0].id)
      return
    }

    const currentIndex = candidates.findIndex((w) => w.id === activeWindowId)
    const next = candidates[(currentIndex + 1) % candidates.length]
    bringToFront(next.id)
  }

  const moveWindowToWorkspace = (id: number, workspace: WorkspaceId) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, workspace, minimized: false } : w)))
  }

  const moveActiveWindowToWorkspace = (workspace: WorkspaceId) => {
    if (!activeWindowId) {
      return
    }

    moveWindowToWorkspace(activeWindowId, workspace)
    setCurrentWorkspace(workspace)
  }

  const switchWorkspace = (workspace: WorkspaceId) => {
    setCurrentWorkspace(workspace)
    setLauncherOpen(false)
    setPaletteOpen(false)
  }

  const loadWorkspacePack = (workspace: WorkspaceId) => {
    const profile = WORKSPACE_PROFILES[workspace]
    const visibleInWorkspace = windows.filter((w) => w.workspace === workspace && !w.minimized)
    const nextWindows: RingWindow[] = []
    let localNextId = nextId
    let localTopZ = topZ

    for (const appId of profile.starterApps) {
      const alreadyOpen = visibleInWorkspace.some((w) => w.appId === appId)
      if (!alreadyOpen) {
        localTopZ += 1
        nextWindows.push(makeWindow(appId, localNextId, localTopZ, workspace))
        localNextId += 1
      }
    }

    if (nextWindows.length > 0) {
      setWindows((prev) => [...prev, ...nextWindows])
      setNextId(localNextId)
      setTopZ(localTopZ)
      setActiveWindowId(nextWindows[nextWindows.length - 1].id)
    }

    switchWorkspace(workspace)
  }

  const startDrag = (event: React.PointerEvent, win: RingWindow) => {
    if (win.maximized) {
      return
    }

    const target = event.currentTarget as HTMLElement
    const rect = target.parentElement?.getBoundingClientRect()
    if (!rect) {
      return
    }

    dragRef.current = {
      id: win.id,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    }

    bringToFront(win.id)
  }

  const startResize = (event: React.PointerEvent, win: RingWindow) => {
    if (win.maximized) {
      return
    }

    event.stopPropagation()
    resizeRef.current = {
      id: win.id,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: win.width,
      startHeight: win.height,
    }
    bringToFront(win.id)
  }

  const applySnap = (id: number, hint: SnapHint) => {
    if (!hint) {
      setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, snap: 'none' } : w)))
      return
    }

    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== id) {
          return w
        }

        if (hint === 'top') {
          return { ...w, maximized: true, snap: 'none', y: DESKTOP_TOP }
        }

        const width = Math.floor(window.innerWidth / 2)
        const height = window.innerHeight - DESKTOP_TOP - DESKTOP_BOTTOM
        return {
          ...w,
          maximized: false,
          snap: hint,
          x: hint === 'left' ? 0 : width,
          y: DESKTOP_TOP,
          width,
          height,
        }
      }),
    )
  }

  const runTerminalCommand = () => {
    const command = terminalInput.trim().toLowerCase()
    if (!command) {
      return
    }

    const nextLines = [`$ ${command}`]
    if (command === 'help') {
      nextLines.push('help, clear, vibe, apps, about, date, pulse, ws-a, ws-b')
    } else if (command === 'clear') {
      setTerminalLog([])
      setTerminalInput('')
      return
    } else if (command === 'vibe' || command === 'pulse') {
      nextLines.push(`Flavor Pulse: ${mood}`)
    } else if (command === 'apps') {
      nextLines.push('notes, ringsurf, paint, music, terminal')
    } else if (command === 'about') {
      nextLines.push('RingOs for Hack Club Flavortown. Crafted to be playful and focused.')
    } else if (command === 'date') {
      nextLines.push(new Date().toString())
    } else if (command === 'ws-a') {
      switchWorkspace('A')
      nextLines.push('Switched to Workspace A')
    } else if (command === 'ws-b') {
      switchWorkspace('B')
      nextLines.push('Switched to Workspace B')
    } else {
      nextLines.push(`Unknown command: ${command}`)
    }

    setTerminalLog((prev) => [...prev, ...nextLines])
    setTerminalInput('')
  }

  const onPaintStart = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = paintCtxRef.current
    if (!ctx) {
      return
    }

    const canvas = event.currentTarget
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(event.clientX - rect.left, event.clientY - rect.top)
    paintDrawingRef.current = true
  }

  const onPaintMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = paintCtxRef.current
    if (!ctx || !paintDrawingRef.current) {
      return
    }

    const canvas = event.currentTarget
    const rect = canvas.getBoundingClientRect()
    ctx.lineTo(event.clientX - rect.left, event.clientY - rect.top)
    ctx.stroke()
  }

  const onPaintEnd = () => {
    paintDrawingRef.current = false
  }

  const clearCanvas = () => {
    const ctx = paintCtxRef.current
    const canvas = paintCanvasRef.current
    if (!ctx || !canvas) {
      return
    }

    ctx.fillStyle = '#fffdf6'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#f4511e'
  }

  const setPaintColor = (color: string) => {
    if (paintCtxRef.current) {
      paintCtxRef.current.strokeStyle = color
    }
  }

  const clearSession = () => {
    localStorage.removeItem(SESSION_KEY)
    window.location.reload()
  }

  const paletteCommands: PaletteCommand[] = [
    {
      id: 'open-notes',
      label: 'Open Notes',
      hint: 'Capture ideas quickly',
      run: () => openApp('notes'),
    },
    {
      id: 'open-paint',
      label: 'Open Paint',
      hint: 'Sketch concepts',
      run: () => openApp('paint'),
    },
    {
      id: 'focus-terminal',
      label: 'Open Terminal',
      hint: 'Run RingShell commands',
      run: () => openApp('terminal'),
    },
    {
      id: 'workspace-a',
      label: 'Switch to Workspace A',
      hint: 'Focused coding area',
      run: () => switchWorkspace('A'),
    },
    {
      id: 'workspace-b',
      label: 'Switch to Workspace B',
      hint: 'Creative sandbox area',
      run: () => switchWorkspace('B'),
    },
    {
      id: 'pack-a',
      label: 'Load Workspace A Pack',
      hint: 'Open Notes, RingSurf, and Terminal',
      run: () => loadWorkspacePack('A'),
    },
    {
      id: 'pack-b',
      label: 'Load Workspace B Pack',
      hint: 'Open Paint, Music, and Notes',
      run: () => loadWorkspacePack('B'),
    },
    {
      id: 'move-active-workspace',
      label: 'Move Active Window to Other Workspace',
      hint: 'Shift focus context quickly',
      run: () => moveActiveWindowToWorkspace(currentWorkspace === 'A' ? 'B' : 'A'),
    },
    {
      id: 'toggle-launcher',
      label: 'Toggle Launcher',
      hint: 'Open or close app grid',
      run: () => setLauncherOpen((v) => !v),
    },
    {
      id: 'pulse-hint',
      label: 'Show Flavor Pulse',
      hint: `Current mood: ${mood}`,
      run: () => setTerminalLog((prev) => [...prev, `$ pulse`, `Flavor Pulse: ${mood}`]),
    },
    {
      id: 'clear-session',
      label: 'Reset Session',
      hint: 'Clear saved windows and restart',
      run: clearSession,
    },
    {
      id: 'show-shortcuts',
      label: 'Show Keyboard Shortcuts',
      hint: 'Open quick cheat sheet',
      run: () => setShortcutHelpOpen(true),
    },
  ]

  const filteredCommands = paletteCommands.filter((cmd) => {
    if (!paletteQuery.trim()) {
      return true
    }
    const q = paletteQuery.toLowerCase()
    return cmd.label.toLowerCase().includes(q) || cmd.hint.toLowerCase().includes(q)
  })

  return (
    <main className="ringos-root">
      <header className="ringos-topbar">
        <div className="brand">
          <span className="ring">Ring</span>
          <span className="os">Os</span>
          <small>
            Flavor Pulse: {mood} | Workspace {currentWorkspace}: {workspaceProfile.title}
          </small>
        </div>
        <div className="topbar-actions">
          <div className="workspace-switch" role="tablist" aria-label="Workspaces">
            <button
              className={currentWorkspace === 'A' ? 'active' : ''}
              onClick={() => switchWorkspace('A')}
            >
              A
            </button>
            <button
              className={currentWorkspace === 'B' ? 'active' : ''}
              onClick={() => switchWorkspace('B')}
            >
              B
            </button>
          </div>
          <button className="chip" onClick={() => loadWorkspacePack(currentWorkspace)}>
            Load Pack
          </button>
          <button className="chip" onClick={() => setLauncherOpen((v) => !v)}>
            Launcher
          </button>
          <button
            className="chip"
            onClick={() => setPaletteOpen((v) => !v)}
            title="Command palette (Ctrl/Cmd + K)"
          >
            Pulse AI
          </button>
          <button className="chip" onClick={() => setShortcutHelpOpen((v) => !v)} title="Shortcut help (?)">
            ?
          </button>
          <div className="clock">{clock.toLocaleTimeString()}</div>
        </div>
      </header>

      <section className={`desktop-area workspace-${currentWorkspace.toLowerCase()}`} aria-label="RingOs desktop">
        <aside className="desktop-ideas">
          <h1>{workspaceProfile.title}</h1>
          <p>{workspaceProfile.subtitle}</p>
          <div className="ideas-list">
            {workspaceProfile.chips.map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
          <p className="shortcut-hint">
            Cmd/Ctrl+K palette, Cmd/Ctrl+1/2 workspace, ? for help overlay.
          </p>
        </aside>

        <section className="workspace-widgets" aria-label="Workspace widgets">
          {workspaceWidgets.map((widget) => (
            <article key={widget.title} className="widget-card">
              <h3>{widget.title}</h3>
              <strong>{widget.value}</strong>
              <small>{widget.detail}</small>
            </article>
          ))}
        </section>

        {shortcutHelpOpen && (
          <div className="shortcut-help" role="dialog" aria-label="Keyboard shortcuts">
            <div className="shortcut-help-head">
              <h2>RingOs Shortcuts</h2>
              <button onClick={() => setShortcutHelpOpen(false)} aria-label="Close shortcuts">
                x
              </button>
            </div>
            <ul>
              <li>Cmd/Ctrl + K: Open Pulse AI palette</li>
              <li>Cmd/Ctrl + 1: Switch to Workspace A</li>
              <li>Cmd/Ctrl + 2: Switch to Workspace B</li>
              <li>Cmd/Ctrl + Shift + Left/Right: Snap active window</li>
              <li>Cmd/Ctrl + Shift + Up: Maximize active window</li>
              <li>Cmd/Ctrl + M: Minimize active window</li>
              <li>Alt + `: Cycle active window</li>
              <li>?: Toggle this shortcuts panel</li>
            </ul>
          </div>
        )}

        {launcherOpen && (
          <div className="launcher" role="dialog" aria-label="Application launcher">
            <h2>Open App</h2>
            <div className="launcher-grid">
              {(Object.keys(APP_DEFS) as AppId[]).map((appId) => {
                const app = APP_DEFS[appId]
                return (
                  <button key={appId} onClick={() => openApp(appId)}>
                    <span className="app-icon" style={{ backgroundColor: app.color }}>
                      {app.icon}
                    </span>
                    {app.title}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {paletteOpen && (
          <div className="palette" role="dialog" aria-label="AI command palette">
            <input
              ref={paletteInputRef}
              value={paletteQuery}
              onChange={(e) => setPaletteQuery(e.target.value)}
              placeholder="Ask Pulse AI to do something..."
            />
            <div className="palette-list">
              {filteredCommands.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => {
                    cmd.run()
                    setPaletteOpen(false)
                    setPaletteQuery('')
                  }}
                >
                  <strong>{cmd.label}</strong>
                  <small>{cmd.hint}</small>
                </button>
              ))}
            </div>
          </div>
        )}

        {snapHint && <div className={`snap-hint ${snapHint}`} aria-hidden="true" />}

        {visibleWindows.map((win) => {
          const app = APP_DEFS[win.appId]
          const width = win.maximized ? '100%' : win.snap !== 'none' ? '50%' : `${win.width}px`

          return (
            <article
              key={win.id}
              className={`window ${win.maximized ? 'maximized' : ''} ${activeWindowId === win.id ? 'active' : ''}`}
              style={{
                left: win.maximized ? 0 : win.x,
                top: win.maximized ? DESKTOP_TOP : win.y,
                width,
                height: win.maximized ? `calc(100% - ${DESKTOP_TOP + DESKTOP_BOTTOM}px)` : win.height,
                zIndex: win.z,
              }}
              onMouseDown={() => bringToFront(win.id)}
            >
              <div className="window-titlebar" onPointerDown={(e) => startDrag(e, win)}>
                <div className="title-left">
                  <span className="app-icon" style={{ backgroundColor: app.color }}>
                    {app.icon}
                  </span>
                  {app.title}
                </div>
                <div className="window-actions">
                  <button onClick={() => minimizeWindow(win.id)} aria-label="Minimize">
                    _
                  </button>
                  <button onClick={() => toggleMaximize(win.id)} aria-label="Maximize">
                    []
                  </button>
                  <button onClick={() => closeWindow(win.id)} aria-label="Close">
                    x
                  </button>
                </div>
              </div>

              <div className="window-body">
                {win.appId === 'notes' && (
                  <div className="notes-app">
                    <textarea
                      value={notesValue}
                      onChange={(e) => setNotesValue(e.target.value)}
                      placeholder="Write notes..."
                    />
                  </div>
                )}

                {win.appId === 'browser' && (
                  <div className="browser-app">
                    <div className="browser-tabs">
                      <button onClick={() => setBrowserTab('feed')}>Flavor Feed</button>
                      <button onClick={() => setBrowserTab('bookmarks')}>Bookmarks</button>
                      <button onClick={() => setBrowserTab('discover')}>Discover</button>
                    </div>
                    {browserTab === 'feed' && (
                      <div className="browser-card">
                        <h3>Today in Flavortown</h3>
                        <p>
                          Build one cool thing end-to-end. Start with notes, sketch in paint,
                          and commit before midnight.
                        </p>
                      </div>
                    )}
                    {browserTab === 'bookmarks' && (
                      <div className="browser-card link-list">
                        <a href="https://hackclub.com" target="_blank" rel="noreferrer">
                          Hack Club
                        </a>
                        <a href="https://flavortown.dev" target="_blank" rel="noreferrer">
                          Flavortown
                        </a>
                        <a href="https://vite.dev" target="_blank" rel="noreferrer">
                          Vite Docs
                        </a>
                      </div>
                    )}
                    {browserTab === 'discover' && (
                      <div className="browser-card">
                        <h3>RingSurf Suggestion</h3>
                        <p>Try "build in public" threads and save ideas into Notes.</p>
                      </div>
                    )}
                  </div>
                )}

                {win.appId === 'paint' && (
                  <div className="paint-app">
                    <div className="paint-toolbar">
                      <button onClick={() => setPaintColor('#f4511e')}>Sauce</button>
                      <button onClick={() => setPaintColor('#ffb300')}>Cheese</button>
                      <button onClick={() => setPaintColor('#00897b')}>Mint</button>
                      <button onClick={() => setPaintColor('#212121')}>Ink</button>
                      <button onClick={clearCanvas}>Clear</button>
                    </div>
                    <canvas
                      ref={paintCanvasRef}
                      width={720}
                      height={360}
                      onPointerDown={onPaintStart}
                      onPointerMove={onPaintMove}
                      onPointerUp={onPaintEnd}
                      onPointerLeave={onPaintEnd}
                    />
                  </div>
                )}

                {win.appId === 'music' && (
                  <div className="music-app">
                    <h3>Lo-fi Kitchen Radio</h3>
                    <div className="track-list">
                      {[
                        {
                          name: 'Flavor Loop 01',
                          url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
                        },
                        {
                          name: 'Flavor Loop 02',
                          url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
                        },
                      ].map((track) => (
                        <button
                          key={track.url}
                          className={activeTrack === track.url ? 'active' : ''}
                          onClick={() => setActiveTrack(track.url)}
                        >
                          {track.name}
                        </button>
                      ))}
                    </div>
                    <audio controls src={activeTrack ?? undefined} />
                  </div>
                )}

                {win.appId === 'terminal' && (
                  <div className="terminal-app">
                    <div className="terminal-log">
                      {terminalLog.map((line, idx) => (
                        <div key={`${line}-${idx}`}>{line}</div>
                      ))}
                    </div>
                    <div className="terminal-input-row">
                      <span>$</span>
                      <input
                        value={terminalInput}
                        onChange={(e) => setTerminalInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            runTerminalCommand()
                          }
                        }}
                        placeholder="Type command"
                      />
                      <button onClick={runTerminalCommand}>Run</button>
                    </div>
                  </div>
                )}
              </div>

              {!win.maximized && <div className="window-resize" onPointerDown={(e) => startResize(e, win)} />}
            </article>
          )
        })}
      </section>

      <footer className="dock">
        {dockApps.map((appId) => {
          const app = APP_DEFS[appId]
          const isPinned = pinnedApps.includes(appId)
          return (
            <div key={appId} className="dock-item">
              <button onClick={() => restoreWindowByApp(appId)}>
                <span className="app-icon" style={{ backgroundColor: app.color }}>
                  {app.icon}
                </span>
                <span>{app.title}</span>
                {appCounts[appId] > 0 && <em>{appCounts[appId]}</em>}
              </button>
              <button
                className={`pin-toggle ${isPinned ? 'pinned' : ''}`}
                onClick={() => toggleDockPin(appId)}
                title={isPinned ? 'Unpin from this workspace dock' : 'Pin to this workspace dock'}
              >
                {isPinned ? 'Pinned' : 'Pin'}
              </button>
            </div>
          )
        })}
      </footer>
    </main>
  )
}

function makeWindow(appId: AppId, id: number, z: number, workspace: WorkspaceId): RingWindow {
  const title = APP_DEFS[appId].title
  return {
    id,
    appId,
    title,
    x: 120 + (id % 4) * 40,
    y: 90 + (id % 4) * 36,
    width: appId === 'paint' ? 780 : 640,
    height: appId === 'paint' ? 520 : 440,
    minimized: false,
    maximized: false,
    z,
    snap: 'none',
    workspace,
  }
}

function getSnapHint(x: number, y: number): SnapHint {
  if (y <= 24) {
    return 'top'
  }
  if (x <= 32) {
    return 'left'
  }
  if (x >= window.innerWidth - 32) {
    return 'right'
  }
  return null
}

function loadSession(): RingSession {
  const fallback: RingSession = {
    windows: [],
    nextId: 1,
    topZ: 10,
    notesValue: DEFAULT_NOTES,
    activeTrack: null,
    terminalLog: DEFAULT_TERMINAL,
    browserTab: 'feed',
    currentWorkspace: 'A',
    pinnedByWorkspace: DEFAULT_PINS,
  }

  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) {
    return fallback
  }

  try {
    const parsed = JSON.parse(raw) as Partial<RingSession>
    if (!Array.isArray(parsed.windows)) {
      return fallback
    }

    const normalizedWindows: RingWindow[] = parsed.windows.map((w) => ({
      ...w,
      workspace: w.workspace === 'B' ? 'B' : 'A',
    }))

    return {
      windows: normalizedWindows,
      nextId: typeof parsed.nextId === 'number' ? parsed.nextId : 1,
      topZ: typeof parsed.topZ === 'number' ? parsed.topZ : 10,
      notesValue: typeof parsed.notesValue === 'string' ? parsed.notesValue : DEFAULT_NOTES,
      activeTrack: typeof parsed.activeTrack === 'string' ? parsed.activeTrack : null,
      terminalLog: Array.isArray(parsed.terminalLog) ? parsed.terminalLog : DEFAULT_TERMINAL,
      browserTab:
        parsed.browserTab === 'feed' || parsed.browserTab === 'bookmarks' || parsed.browserTab === 'discover'
          ? parsed.browserTab
          : 'feed',
      currentWorkspace: parsed.currentWorkspace === 'B' ? 'B' : 'A',
      pinnedByWorkspace: normalizePins(parsed.pinnedByWorkspace),
    }
  } catch {
    return fallback
  }
}

function normalizePins(value: unknown): Record<WorkspaceId, AppId[]> {
  const safe = { ...DEFAULT_PINS }
  if (!value || typeof value !== 'object') {
    return safe
  }

  const source = value as Partial<Record<WorkspaceId, unknown>>
  for (const workspace of ['A', 'B'] as const) {
    const arr = source[workspace]
    if (!Array.isArray(arr)) {
      continue
    }

    const filtered = arr.filter((item): item is AppId => {
      return item === 'notes' || item === 'browser' || item === 'paint' || item === 'music' || item === 'terminal'
    })

    safe[workspace] = [...new Set(filtered)]
  }

  return safe
}

export default App
