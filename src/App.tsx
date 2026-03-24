import { useEffect, useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'

type AppId = 'notes' | 'browser' | 'paint' | 'music' | 'terminal'
type BrowserTab = 'feed' | 'bookmarks' | 'history' | 'discover' | 'tools'
type SnapHint = 'left' | 'right' | 'top' | null
type SnapMode = 'none' | 'left' | 'right'
type WorkspaceId = 'A' | 'B'
type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
type LayoutPresetId =
  | 'left-third'
  | 'center-third'
  | 'right-third'
  | 'left-two-thirds'
  | 'right-two-thirds'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
type WorkspaceLayoutId = 'tile-quarters' | 'tile-thirds' | 'cascade'
type OverlayPanelId = 'launcher' | 'palette' | 'layout' | 'shortcuts'
type OverlayAnchor = {
  x: number
  y: number
}
type WindowArrangement = {
  windowId: number
  x: number
  y: number
  width: number
  height: number
  minimized: boolean
  maximized: boolean
  snap: SnapMode
  z: number
}
type ArrangementPreset = {
  id: string
  name: string
  items: WindowArrangement[]
  updatedAt: number
}
type WalkthroughTarget = 'layout' | 'launcher' | 'palette'

type TooltipState = {
  open: boolean
  text: string
  x: number
  y: number
}

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
  direction: ResizeDirection
  startX: number
  startY: number
  startLeft: number
  startTop: number
  startWidth: number
  startHeight: number
}

type RingSession = {
  windows: RingWindow[]
  nextId: number
  topZ: number
  notesValue: string
  notesTitle: string
  activeTrack: string | null
  musicTracks: MusicTrack[]
  musicVolume: number
  terminalLog: string[]
  browserTab: BrowserTab
  browserQuickUrl: string
  browserBookmarks: BrowserBookmark[]
  browserHistory: BrowserHistoryEntry[]
  browserNavIndex: number
  browserSessionTabs: BrowserSessionTab[]
  activeBrowserSessionTabId: string
  browserCollapsedGroups: string[]
  currentWorkspace: WorkspaceId
  paintColor: string
  paintSize: number
  paintMode: 'brush' | 'eraser'
  paintHistory: string[]
  paintRedo: string[]
  pinnedByWorkspace: Record<WorkspaceId, AppId[]>
  preferredLayoutByWorkspace: Partial<Record<WorkspaceId, WorkspaceLayoutId>>
  arrangementPresetsByWorkspace: Partial<Record<WorkspaceId, ArrangementPreset[]>>
  selectedArrangementPresetByWorkspace: Partial<Record<WorkspaceId, string>>
}

type PaletteCommand = {
  id: string
  label: string
  hint: string
  run: () => void
}

type DockMenuState = {
  appId: AppId
  x: number
  y: number
} | null

type DockMenuAction = {
  id: string
  label: string
  danger?: boolean
  run: () => void
}

type WorkspaceProfile = {
  title: string
  subtitle: string
  chips: string[]
  starterApps: AppId[]
}

type MusicTrack = {
  id: string
  name: string
  url: string
  source: 'built-in' | 'uploaded'
}

type BrowserBookmark = {
  id: string
  label: string
  url: string
  tags: string[]
}

type BrowserHistoryEntry = {
  id: string
  url: string
  title: string
  visitedAt: number
}

type BrowserSessionTab = {
  id: string
  title: string
  url: string
  address: string
  history: BrowserHistoryEntry[]
  navIndex: number
  pinned: boolean
  group: string
  lastVisitedAt: number
}

const APP_DEFS: Record<
  AppId,
  { title: string; icon: string; color: string; gradientA: string; gradientB: string }
> = {
  notes: { title: 'Notes', icon: '📝', color: '#ff8f00', gradientA: '#ffb74d', gradientB: '#fb8c00' },
  browser: { title: 'RingSurf', icon: '🌐', color: '#f4511e', gradientA: '#ff8a65', gradientB: '#e64a19' },
  paint: { title: 'Paint', icon: '🎨', color: '#00897b', gradientA: '#4db6ac', gradientB: '#00796b' },
  music: { title: 'Music', icon: '♫', color: '#2e7d32', gradientA: '#81c784', gradientB: '#2e7d32' },
  terminal: { title: 'Terminal', icon: '⌘', color: '#263238', gradientA: '#546e7a', gradientB: '#263238' },
}

const STARTUP_APPS: AppId[] = ['notes', 'browser']
const DESKTOP_TOP = 52
const DESKTOP_BOTTOM = 68
const SESSION_KEY = 'ringos.session.v1'
const WALKTHROUGH_KEY = 'ringos.walkthrough.v1'

const DEFAULT_NOTES = 'Welcome to RingOs.\n\nWrite ideas for your Flavortown build here.'
const DEFAULT_TERMINAL = ['RingShell v1.0', 'Type "help" to list available commands.']
const DEFAULT_NOTES_TITLE = 'Flavor Notes'
const DEFAULT_BROWSER_URL = 'https://hackclub.com'
const DEFAULT_TRACKS: MusicTrack[] = [
  {
    id: 'built-in-1',
    name: 'Flavor Loop 01',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    source: 'built-in',
  },
  {
    id: 'built-in-2',
    name: 'Flavor Loop 02',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    source: 'built-in',
  },
]
const DEFAULT_BROWSER_BOOKMARKS: BrowserBookmark[] = [
  {
    id: 'bm-hackclub',
    label: 'Hack Club',
    url: 'https://hackclub.com',
    tags: ['community', 'build'],
  },
  {
    id: 'bm-vite',
    label: 'Vite Docs',
    url: 'https://vite.dev',
    tags: ['docs', 'frontend'],
  },
  {
    id: 'bm-mdn',
    label: 'MDN Web Docs',
    url: 'https://developer.mozilla.org',
    tags: ['docs', 'web'],
  },
]
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

const LAYOUT_PRESETS: Array<{ id: LayoutPresetId; label: string; detail: string }> = [
  { id: 'left-third', label: 'Left Third', detail: 'Focus sidebar layout' },
  { id: 'center-third', label: 'Center Third', detail: 'Single focused column' },
  { id: 'right-third', label: 'Right Third', detail: 'Reference pane layout' },
  { id: 'left-two-thirds', label: 'Left Two Thirds', detail: 'Primary content area' },
  { id: 'right-two-thirds', label: 'Right Two Thirds', detail: 'Secondary content area' },
  { id: 'top-left', label: 'Top Left Quarter', detail: 'Quadrant placement' },
  { id: 'top-right', label: 'Top Right Quarter', detail: 'Quadrant placement' },
  { id: 'bottom-left', label: 'Bottom Left Quarter', detail: 'Quadrant placement' },
  { id: 'bottom-right', label: 'Bottom Right Quarter', detail: 'Quadrant placement' },
]

const WORKSPACE_LAYOUTS: Array<{ id: WorkspaceLayoutId; label: string; detail: string }> = [
  { id: 'tile-quarters', label: 'Tile Quarters', detail: 'Arrange all visible windows in a 2-column grid' },
  { id: 'tile-thirds', label: 'Tile Thirds', detail: 'Arrange all visible windows in a 3-column grid' },
  { id: 'cascade', label: 'Cascade', detail: 'Layer windows diagonally for quick browsing' },
]

const OVERLAY_WIDTH: Record<OverlayPanelId, number> = {
  launcher: 420,
  palette: 560,
  layout: 440,
  shortcuts: 430,
}

const COACHMARK_TEXT: Record<WalkthroughTarget, { title: string; body: string }> = {
  layout: {
    title: 'Layouts',
    body: 'Use visual presets, auto-arrange, and save exact arrangements per workspace.',
  },
  launcher: {
    title: 'Launcher',
    body: 'Search and open apps fast, then pin favorites for each workspace dock.',
  },
  palette: {
    title: 'Pulse AI',
    body: 'Run quick commands and layout actions from one keyboard-first panel.',
  },
}

const RINGSURF_DISCOVER_ITEMS: Array<{
  id: string
  title: string
  summary: string
  url: string
  tags: string[]
}> = [
  {
    id: 'discover-build-public',
    title: 'Build In Public',
    summary: 'Find makers shipping daily and borrow momentum from public progress logs.',
    url: 'https://x.com/search?q=build%20in%20public',
    tags: ['community', 'build'],
  },
  {
    id: 'discover-design',
    title: 'Design Inspiration',
    summary: 'Curated galleries for layout ideas, typography direction, and color systems.',
    url: 'https://www.awwwards.com/websites/',
    tags: ['design', 'ui'],
  },
  {
    id: 'discover-devtools',
    title: 'Frontend Toolchain',
    summary: 'Stay current with modern build tools, bundlers, and DX workflows.',
    url: 'https://vite.dev/guide/',
    tags: ['docs', 'frontend'],
  },
  {
    id: 'discover-learning',
    title: 'Deep Web Platform',
    summary: 'Reference platform APIs and browser primitives straight from canonical docs.',
    url: 'https://developer.mozilla.org/en-US/docs/Web',
    tags: ['docs', 'web'],
  },
]

const DEFAULT_OVERLAY_ANCHORS: Record<OverlayPanelId, OverlayAnchor> = {
  launcher: { x: window.innerWidth - 220, y: 76 },
  palette: { x: window.innerWidth / 2, y: 76 },
  layout: { x: window.innerWidth - 240, y: 76 },
  shortcuts: { x: window.innerWidth - 250, y: 76 },
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
  const [dockEditMode, setDockEditMode] = useState(false)
  const [layoutPanelOpen, setLayoutPanelOpen] = useState(false)
  const [dockMenu, setDockMenu] = useState<DockMenuState>(null)
  const [dockPreviewApp, setDockPreviewApp] = useState<AppId | null>(null)
  const [dockMenuIndex, setDockMenuIndex] = useState(0)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [snapHint, setSnapHint] = useState<SnapHint>(null)
  const [tooltip, setTooltip] = useState<TooltipState>({
    open: false,
    text: '',
    x: 0,
    y: 0,
  })
  const [clock, setClock] = useState(() => new Date())
  const [notesValue, setNotesValue] = useState(restored.notesValue)
  const [notesTitle, setNotesTitle] = useState(restored.notesTitle)
  const [activeTrack, setActiveTrack] = useState<string | null>(restored.activeTrack)
  const [terminalLog, setTerminalLog] = useState<string[]>(restored.terminalLog)
  const [terminalInput, setTerminalInput] = useState('')
  const [launcherSearch, setLauncherSearch] = useState('')
  const [browserTab, setBrowserTab] = useState<BrowserTab>(restored.browserTab)
  const [browserQuickUrl, setBrowserQuickUrl] = useState(restored.browserQuickUrl)
  const [browserAddress, setBrowserAddress] = useState(restored.browserQuickUrl)
  const [browserSearch, setBrowserSearch] = useState('')
  const [browserBookmarks, setBrowserBookmarks] = useState<BrowserBookmark[]>(restored.browserBookmarks)
  const [browserHistory, setBrowserHistory] = useState<BrowserHistoryEntry[]>(restored.browserHistory)
  const [browserNavIndex, setBrowserNavIndex] = useState(restored.browserNavIndex)
  const [browserSessionTabs, setBrowserSessionTabs] = useState<BrowserSessionTab[]>(restored.browserSessionTabs)
  const [activeBrowserSessionTabId, setActiveBrowserSessionTabId] = useState(restored.activeBrowserSessionTabId)
  const [browserCollapsedGroups, setBrowserCollapsedGroups] = useState<string[]>(restored.browserCollapsedGroups)
  const [recentlyClosedBrowserTabs, setRecentlyClosedBrowserTabs] = useState<BrowserSessionTab[]>([])
  const [browserTabDropTargetId, setBrowserTabDropTargetId] = useState<string | null>(null)
  const [recentlyReorderedTabId, setRecentlyReorderedTabId] = useState<string | null>(null)
  const [browserTabGroupDraft, setBrowserTabGroupDraft] = useState('General')
  const [browserTabGroupFilter, setBrowserTabGroupFilter] = useState('All')
  const [browserBookmarkName, setBrowserBookmarkName] = useState('')
  const [browserStatus, setBrowserStatus] = useState('Ready to surf')
  const [paintColor, setPaintColor] = useState(restored.paintColor)
  const [paintSize, setPaintSize] = useState(restored.paintSize)
  const [paintMode, setPaintMode] = useState<'brush' | 'eraser'>(restored.paintMode)
  const [paintHistory, setPaintHistory] = useState<string[]>(restored.paintHistory)
  const [paintRedo, setPaintRedo] = useState<string[]>(restored.paintRedo)
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>(restored.musicTracks)
  const [musicVolume, setMusicVolume] = useState(restored.musicVolume)
  const [pinnedByWorkspace, setPinnedByWorkspace] = useState<Record<WorkspaceId, AppId[]>>(
    restored.pinnedByWorkspace,
  )
  const [preferredLayoutByWorkspace, setPreferredLayoutByWorkspace] = useState<
    Partial<Record<WorkspaceId, WorkspaceLayoutId>>
  >(restored.preferredLayoutByWorkspace)
  const [arrangementPresetsByWorkspace, setArrangementPresetsByWorkspace] = useState<
    Partial<Record<WorkspaceId, ArrangementPreset[]>>
  >(restored.arrangementPresetsByWorkspace)
  const [selectedArrangementPresetByWorkspace, setSelectedArrangementPresetByWorkspace] = useState<
    Partial<Record<WorkspaceId, string>>
  >(restored.selectedArrangementPresetByWorkspace)
  const [arrangementNameDraft, setArrangementNameDraft] = useState('')
  const [overlayAnchors, setOverlayAnchors] = useState<Record<OverlayPanelId, OverlayAnchor>>(DEFAULT_OVERLAY_ANCHORS)
  const [closingPanels, setClosingPanels] = useState<Partial<Record<OverlayPanelId, boolean>>>({})
  const [windowSnapshots, setWindowSnapshots] = useState<Record<number, string>>({})
  const [layoutAnimatingIds, setLayoutAnimatingIds] = useState<number[]>([])
  const [walkthroughOpen, setWalkthroughOpen] = useState(false)
  const [walkthroughStep, setWalkthroughStep] = useState(0)
  const [walkthroughAnchor, setWalkthroughAnchor] = useState<OverlayAnchor>({ x: window.innerWidth / 2, y: 76 })

  const dragRef = useRef<DragState | null>(null)
  const resizeRef = useRef<ResizeState | null>(null)
  const dockDragRef = useRef<AppId | null>(null)
  const dockPreviewHideTimerRef = useRef<number | null>(null)
  const browserTabDragRef = useRef<string | null>(null)
  const dockMenuButtonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const paletteInputRef = useRef<HTMLInputElement | null>(null)
  const browserAddressInputRef = useRef<HTMLInputElement | null>(null)
  const browserImportInputRef = useRef<HTMLInputElement | null>(null)
  const musicAudioRef = useRef<HTMLAudioElement | null>(null)
  const paintCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const paintCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const paintDrawingRef = useRef(false)
  const windowRefs = useRef<Record<number, HTMLElement | null>>({})
  const layoutAnimationTimerRef = useRef<number | null>(null)
  const layoutButtonRef = useRef<HTMLButtonElement | null>(null)
  const launcherButtonRef = useRef<HTMLButtonElement | null>(null)
  const paletteButtonRef = useRef<HTMLButtonElement | null>(null)
  const shortcutsButtonRef = useRef<HTMLButtonElement | null>(null)

  const workspaceProfile = WORKSPACE_PROFILES[currentWorkspace]
  const walkthroughTarget: WalkthroughTarget = walkthroughStep === 0 ? 'layout' : walkthroughStep === 1 ? 'launcher' : 'palette'

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
    if (!launcherOpen && launcherSearch) {
      setLauncherSearch('')
    }
  }, [launcherOpen, launcherSearch])

  useEffect(() => {
    const activeTab = browserSessionTabs.find((tab) => tab.id === activeBrowserSessionTabId)
    if (!activeTab) {
      return
    }

    setBrowserQuickUrl(activeTab.url)
    setBrowserAddress(activeTab.address)
    setBrowserHistory(activeTab.history)
    setBrowserNavIndex(activeTab.navIndex)
    setBrowserStatus(`Switched to ${activeTab.title}`)
  }, [activeBrowserSessionTabId])

  useEffect(() => {
    setBrowserNavIndex((prev) => {
      if (browserHistory.length === 0) {
        return -1
      }
      return Math.max(0, Math.min(prev, browserHistory.length - 1))
    })
  }, [browserHistory])

  useEffect(() => {
    if (!activeBrowserSessionTabId) {
      return
    }

    setBrowserSessionTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== activeBrowserSessionTabId) {
          return tab
        }
        return {
          ...tab,
          title: browserHistory[browserNavIndex]?.title ?? tab.title,
          url: browserQuickUrl,
          address: browserAddress,
          history: browserHistory,
          navIndex: browserNavIndex,
          lastVisitedAt: Date.now(),
        }
      }),
    )
  }, [activeBrowserSessionTabId, browserQuickUrl, browserAddress, browserHistory, browserNavIndex])

  useEffect(() => {
    if (!recentlyReorderedTabId) {
      return
    }
    const timer = window.setTimeout(() => {
      setRecentlyReorderedTabId(null)
    }, 280)
    return () => window.clearTimeout(timer)
  }, [recentlyReorderedTabId])

  useEffect(() => {
    setArrangementNameDraft('')
  }, [currentWorkspace])

  useEffect(() => {
    if (localStorage.getItem(WALKTHROUGH_KEY) === 'done') {
      return
    }
    setWalkthroughOpen(true)
    setWalkthroughStep(0)
  }, [])

  useEffect(() => {
    if (!walkthroughOpen) {
      return
    }

    const target: WalkthroughTarget = walkthroughStep === 0 ? 'layout' : walkthroughStep === 1 ? 'launcher' : 'palette'
    const node = target === 'layout' ? layoutButtonRef.current : target === 'launcher' ? launcherButtonRef.current : paletteButtonRef.current
    const rect = node?.getBoundingClientRect()
    if (!rect) {
      return
    }

    const width = 260
    const center = rect.left + rect.width / 2
    const minCenter = 12 + width / 2
    const maxCenter = window.innerWidth - 12 - width / 2
    const clampedCenter = minCenter > maxCenter ? window.innerWidth / 2 : Math.max(minCenter, Math.min(maxCenter, center))
    setWalkthroughAnchor({ x: clampedCenter, y: rect.bottom + 8 })
  }, [walkthroughOpen, walkthroughStep])

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

            const nextX = Math.max(0, Math.min(window.innerWidth - 220, event.clientX - drag.offsetX))
            const maxHeight = window.innerHeight - 8
            const nextY = Math.max(0, Math.min(window.innerHeight - 140, event.clientY - drag.offsetY))

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

            const minWidth = 320
            const minHeight = 240
            const dx = event.clientX - resize.startX
            const dy = event.clientY - resize.startY

            let width = resize.startWidth
            let height = resize.startHeight
            let x = resize.startLeft
            let y = resize.startTop

            if (resize.direction.includes('e')) {
              width = Math.max(minWidth, resize.startWidth + dx)
            }
            if (resize.direction.includes('s')) {
              height = Math.max(minHeight, resize.startHeight + dy)
            }
            if (resize.direction.includes('w')) {
              width = Math.max(minWidth, resize.startWidth - dx)
              x = resize.startLeft + (resize.startWidth - width)
            }
            if (resize.direction.includes('n')) {
              height = Math.max(minHeight, resize.startHeight - dy)
              y = resize.startTop + (resize.startHeight - height)
            }

            x = Math.max(0, Math.min(x, window.innerWidth - minWidth))
            y = Math.max(0, Math.min(y, window.innerHeight - minHeight))
            width = Math.min(width, window.innerWidth - x)
            height = Math.min(height, window.innerHeight - y)

            return { ...w, x, y, width, height, snap: 'none' }
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
      const activeWindow = windows.find((win) => win.id === activeWindowId)
      const isBrowserFocused =
        Boolean(activeWindow) &&
        activeWindow?.workspace === currentWorkspace &&
        activeWindow?.appId === 'browser' &&
        !activeWindow?.minimized

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'l' && isBrowserFocused) {
        event.preventDefault()
        browserAddressInputRef.current?.focus()
        browserAddressInputRef.current?.select()
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key === '[' && isBrowserFocused) {
        event.preventDefault()
        goBackRingSurf()
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key === ']' && isBrowserFocused) {
        event.preventDefault()
        goForwardRingSurf()
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (paletteOpen) {
          closePanel('palette')
        } else {
          openAnchoredPanel('palette')
        }
        return
      }

      if (event.key === 'Escape') {
        closeAllAnchoredPanels()
        setDockEditMode(false)
        setDockMenu(null)
        setDockPreviewApp(null)
        setWalkthroughOpen(false)
        return
      }

      if (isTypingContext) {
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key === '1') {
        event.preventDefault()
        switchWorkspace('A')
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key === '2') {
        event.preventDefault()
        switchWorkspace('B')
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

        if (event.key === '3') {
          event.preventDefault()
          applyWorkspaceLayout('tile-thirds')
          return
        }

        if (event.key === '4') {
          event.preventDefault()
          applyWorkspaceLayout('tile-quarters')
          return
        }

        if (event.key === '0') {
          event.preventDefault()
          applyWorkspaceLayout('cascade')
          return
        }
      }

      if (event.altKey && event.key === '`') {
        event.preventDefault()
        cycleWindow()
      }

      if (event.altKey && /^[1-9]$/.test(event.key)) {
        const allApps = Object.keys(APP_DEFS) as AppId[]
        const quickOrder = [
          ...pinnedByWorkspace[currentWorkspace],
          ...allApps.filter((appId) => !pinnedByWorkspace[currentWorkspace].includes(appId)),
        ]
        const appIndex = Number(event.key) - 1
        const appId = quickOrder[appIndex]
        if (appId) {
          event.preventDefault()
          restoreWindowByApp(appId)
        }
        return
      }

      if (event.key === '?') {
        event.preventDefault()
        if (shortcutHelpOpen) {
          closePanel('shortcuts')
        } else {
          openAnchoredPanel('shortcuts')
        }
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeWindowId, currentWorkspace, windows, pinnedByWorkspace, paletteOpen, shortcutHelpOpen, browserHistory, browserNavIndex])

  useEffect(() => {
    if (!dockMenu) {
      return
    }

    window.setTimeout(() => {
      dockMenuButtonRefs.current[dockMenuIndex]?.focus()
    }, 0)
  }, [dockMenu, dockMenuIndex])

  useEffect(() => {
    const onGlobalPointerDown = () => {
      setDockMenu(null)
    }

    window.addEventListener('pointerdown', onGlobalPointerDown)
    return () => window.removeEventListener('pointerdown', onGlobalPointerDown)
  }, [])

  useEffect(() => {
    const onGlobalPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('.anchored-overlay') || target?.closest('.topbar-actions') || target?.closest('.coachmark')) {
        return
      }
      closeAllAnchoredPanels()
    }

    window.addEventListener('pointerdown', onGlobalPointerDown)
    return () => window.removeEventListener('pointerdown', onGlobalPointerDown)
  }, [launcherOpen, paletteOpen, layoutPanelOpen, shortcutHelpOpen, closingPanels])

  useEffect(() => {
    return () => {
      if (dockPreviewHideTimerRef.current) {
        window.clearTimeout(dockPreviewHideTimerRef.current)
      }
      if (layoutAnimationTimerRef.current) {
        window.clearTimeout(layoutAnimationTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const onResize = () => {
      setOverlayAnchors((prev) => {
        const next: Record<OverlayPanelId, OverlayAnchor> = { ...prev }
        for (const panelId of ['launcher', 'palette', 'layout', 'shortcuts'] as const) {
          const width = OVERLAY_WIDTH[panelId]
          const minCenter = 16 + width / 2
          const maxCenter = window.innerWidth - 16 - width / 2
          next[panelId] = {
            x:
              minCenter > maxCenter
                ? window.innerWidth / 2
                : Math.max(minCenter, Math.min(maxCenter, prev[panelId].x)),
            y: prev[panelId].y,
          }
        }
        return next
      })

      if (walkthroughOpen) {
        const target: WalkthroughTarget = walkthroughStep === 0 ? 'layout' : walkthroughStep === 1 ? 'launcher' : 'palette'
        const node = target === 'layout' ? layoutButtonRef.current : target === 'launcher' ? launcherButtonRef.current : paletteButtonRef.current
        const rect = node?.getBoundingClientRect()
        if (rect) {
          const width = 260
          const center = rect.left + rect.width / 2
          const minCenter = 12 + width / 2
          const maxCenter = window.innerWidth - 12 - width / 2
          const clampedCenter = minCenter > maxCenter ? window.innerWidth / 2 : Math.max(minCenter, Math.min(maxCenter, center))
          setWalkthroughAnchor({ x: clampedCenter, y: rect.bottom + 8 })
        }
      }
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [walkthroughOpen, walkthroughStep])

  useEffect(() => {
    const onPointerOver = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      const node = target?.closest<HTMLElement>('[data-tooltip]')
      if (!node) {
        return
      }
      const text = node.dataset.tooltip
      if (!text) {
        return
      }
      setTooltip({
        open: true,
        text,
        x: event.clientX,
        y: event.clientY,
      })
    }

    const onPointerMove = (event: PointerEvent) => {
      setTooltip((prev) => {
        if (!prev.open) {
          return prev
        }
        return {
          ...prev,
          x: event.clientX,
          y: event.clientY,
        }
      })
    }

    const onPointerOut = (event: PointerEvent) => {
      const related = event.relatedTarget as HTMLElement | null
      const nextTooltipNode = related?.closest<HTMLElement>('[data-tooltip]')
      if (!nextTooltipNode) {
        setTooltip((prev) => (prev.open ? { ...prev, open: false } : prev))
      }
    }

    window.addEventListener('pointerover', onPointerOver)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerout', onPointerOut)
    return () => {
      window.removeEventListener('pointerover', onPointerOver)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerout', onPointerOut)
    }
  }, [])

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
    ctx.lineWidth = paintSize
    ctx.strokeStyle = paintColor
    paintCtxRef.current = ctx

    if (paintHistory.length > 0) {
      const snapshot = paintHistory[paintHistory.length - 1]
      drawSnapshotToCanvas(snapshot, ctx, canvas, paintSize, paintColor, paintMode)
      return
    }

    setPaintHistory([canvas.toDataURL('image/png')])
  }, [])

  useEffect(() => {
    const ctx = paintCtxRef.current
    if (!ctx) {
      return
    }

    ctx.lineWidth = paintSize
    ctx.strokeStyle = paintColor
    ctx.globalCompositeOperation = paintMode === 'eraser' ? 'destination-out' : 'source-over'
  }, [paintColor, paintSize, paintMode])

  useEffect(() => {
    const audio = musicAudioRef.current
    if (!audio) {
      return
    }

    audio.volume = musicVolume
  }, [musicVolume])

  useEffect(() => {
    const session: RingSession = {
      windows,
      nextId,
      topZ,
      notesValue,
      notesTitle,
      activeTrack,
      musicTracks,
      musicVolume,
      terminalLog,
      browserTab,
      browserQuickUrl,
      browserBookmarks,
      browserHistory,
      browserNavIndex,
      browserSessionTabs,
      activeBrowserSessionTabId,
      browserCollapsedGroups,
      currentWorkspace,
      paintColor,
      paintSize,
      paintMode,
      paintHistory,
      paintRedo,
      pinnedByWorkspace,
      preferredLayoutByWorkspace,
      arrangementPresetsByWorkspace,
      selectedArrangementPresetByWorkspace,
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  }, [
    windows,
    nextId,
    topZ,
    notesValue,
    notesTitle,
    activeTrack,
    musicTracks,
    musicVolume,
    terminalLog,
    browserTab,
    browserQuickUrl,
    browserBookmarks,
    browserHistory,
    browserNavIndex,
    browserSessionTabs,
    activeBrowserSessionTabId,
    browserCollapsedGroups,
    currentWorkspace,
    paintColor,
    paintSize,
    paintMode,
    paintHistory,
    paintRedo,
    pinnedByWorkspace,
    preferredLayoutByWorkspace,
    arrangementPresetsByWorkspace,
    selectedArrangementPresetByWorkspace,
  ])

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
        if (win.workspace === currentWorkspace) {
          acc[win.appId] += 1
        }
        return acc
      },
      { notes: 0, browser: 0, paint: 0, music: 0, terminal: 0 },
    )
  }, [windows, currentWorkspace])

  const pinnedApps = pinnedByWorkspace[currentWorkspace]

  const runningApps = useMemo(() => {
    const set = new Set<AppId>()
    for (const win of windows) {
      if (win.workspace === currentWorkspace) {
        set.add(win.appId)
      }
    }
    return set
  }, [windows, currentWorkspace])

  const dockApps = useMemo(() => {
    const ordered = [...pinnedApps]
    const dynamic = [...runningApps].filter((appId) => !ordered.includes(appId))
    return [...ordered, ...dynamic]
  }, [pinnedApps, runningApps])

  const dockPreviewWindows = useMemo(() => {
    if (!dockPreviewApp) {
      return []
    }

    return windows
      .filter((w) => w.workspace === currentWorkspace && w.appId === dockPreviewApp)
      .sort((a, b) => b.z - a.z)
  }, [dockPreviewApp, windows, currentWorkspace])

  useEffect(() => {
    if (!dockPreviewApp || dockPreviewWindows.length === 0) {
      return
    }

    const candidates = dockPreviewWindows.filter((w) => !w.minimized).slice(0, 4)
    candidates.forEach((win) => {
      captureWindowSnapshot(win.id)
    })

    const timer = window.setInterval(() => {
      candidates.forEach((win) => captureWindowSnapshot(win.id))
    }, 2200)

    return () => window.clearInterval(timer)
  }, [dockPreviewApp, dockPreviewWindows])

  const activeTrackName = useMemo(() => {
    return musicTracks.find((track) => track.url === activeTrack)?.name ?? 'No track selected'
  }, [musicTracks, activeTrack])

  const notesPreview = useMemo(() => {
    if (!notesValue.trim()) {
      return 'No notes yet. Start writing ideas...'
    }
    return notesValue.trim().slice(0, 180)
  }, [notesValue])

  const browserPageTitle = useMemo(() => {
    return browserHistory[browserNavIndex]?.title ?? 'Untitled Page'
  }, [browserHistory, browserNavIndex])

  const filteredBrowserBookmarks = useMemo(() => {
    const query = browserSearch.toLowerCase().trim()
    if (!query) {
      return browserBookmarks
    }

    return browserBookmarks.filter((bookmark) => {
      return (
        bookmark.label.toLowerCase().includes(query) ||
        bookmark.url.toLowerCase().includes(query) ||
        bookmark.tags.some((tag) => tag.toLowerCase().includes(query))
      )
    })
  }, [browserBookmarks, browserSearch])

  const filteredDiscoverItems = useMemo(() => {
    const query = browserSearch.toLowerCase().trim()
    if (!query) {
      return RINGSURF_DISCOVER_ITEMS
    }

    return RINGSURF_DISCOVER_ITEMS.filter((item) => {
      return (
        item.title.toLowerCase().includes(query) ||
        item.summary.toLowerCase().includes(query) ||
        item.tags.some((tag) => tag.toLowerCase().includes(query))
      )
    })
  }, [browserSearch])

  const activeBrowserSessionTab = useMemo(() => {
    return browserSessionTabs.find((tab) => tab.id === activeBrowserSessionTabId) ?? null
  }, [browserSessionTabs, activeBrowserSessionTabId])

  const browserTabGroupOptions = useMemo(() => {
    const groups = new Set<string>(['All', 'Pinned'])
    browserSessionTabs.forEach((tab) => {
      groups.add(tab.group || 'General')
    })
    return [...groups]
  }, [browserSessionTabs])

  const filteredBrowserSessionTabs = useMemo(() => {
    if (browserTabGroupFilter === 'All') {
      return browserSessionTabs
    }
    if (browserTabGroupFilter === 'Pinned') {
      return browserSessionTabs.filter((tab) => tab.pinned)
    }
    return browserSessionTabs.filter((tab) => (tab.group || 'General') === browserTabGroupFilter)
  }, [browserSessionTabs, browserTabGroupFilter])

  const browserSessionTabsByGroup = useMemo(() => {
    const grouped: Record<string, BrowserSessionTab[]> = {}
    for (const tab of filteredBrowserSessionTabs) {
      const group = tab.group || 'General'
      if (!grouped[group]) {
        grouped[group] = []
      }
      grouped[group].push(tab)
    }
    for (const group of Object.keys(grouped)) {
      const tabs = grouped[group]
      const pinned = tabs.filter((tab) => tab.pinned)
      const normal = tabs.filter((tab) => !tab.pinned)
      grouped[group] = [...pinned, ...normal]
    }
    return grouped
  }, [filteredBrowserSessionTabs])

  const browserVisibleGroupEntries = useMemo(() => {
    const entries = Object.entries(browserSessionTabsByGroup)
    return entries.sort((a, b) => a[0].localeCompare(b[0]))
  }, [browserSessionTabsByGroup])

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

  const getOverlayAnchor = (panelId: OverlayPanelId, sourceRect?: DOMRect): OverlayAnchor => {
    const fallbackRect =
      panelId === 'layout'
        ? layoutButtonRef.current?.getBoundingClientRect()
        : panelId === 'launcher'
        ? launcherButtonRef.current?.getBoundingClientRect()
        : panelId === 'palette'
        ? paletteButtonRef.current?.getBoundingClientRect()
        : panelId === 'shortcuts'
        ? shortcutsButtonRef.current?.getBoundingClientRect()
        : undefined

    const activeRect = sourceRect ?? fallbackRect
    if (!activeRect) {
      return { x: window.innerWidth / 2, y: 66 }
    }

    const width = OVERLAY_WIDTH[panelId]
    const center = activeRect.left + activeRect.width / 2
    const minCenter = 16 + width / 2
    const maxCenter = window.innerWidth - 16 - width / 2
    const clampedCenter = minCenter > maxCenter ? window.innerWidth / 2 : Math.max(minCenter, Math.min(maxCenter, center))

    return {
      x: clampedCenter,
      y: activeRect.bottom + 6,
    }
  }

  const isPanelOpen = (panelId: OverlayPanelId) => {
    if (panelId === 'launcher') {
      return launcherOpen
    }
    if (panelId === 'palette') {
      return paletteOpen
    }
    if (panelId === 'layout') {
      return layoutPanelOpen
    }
    return shortcutHelpOpen
  }

  const setPanelOpenState = (panelId: OverlayPanelId, open: boolean) => {
    if (panelId === 'launcher') {
      setLauncherOpen(open)
      return
    }
    if (panelId === 'palette') {
      setPaletteOpen(open)
      return
    }
    if (panelId === 'layout') {
      setLayoutPanelOpen(open)
      return
    }
    setShortcutHelpOpen(open)
  }

  const closePanel = (panelId: OverlayPanelId, immediate = false) => {
    const open = isPanelOpen(panelId)
    if (!open && !closingPanels[panelId]) {
      return
    }

    if (immediate) {
      setPanelOpenState(panelId, false)
      setClosingPanels((prev) => ({ ...prev, [panelId]: false }))
      return
    }

    setClosingPanels((prev) => ({ ...prev, [panelId]: true }))
    window.setTimeout(() => {
      setPanelOpenState(panelId, false)
      setClosingPanels((prev) => ({ ...prev, [panelId]: false }))
    }, 170)
  }

  const closeAllAnchoredPanels = (immediate = false) => {
    closePanel('launcher', immediate)
    closePanel('palette', immediate)
    closePanel('layout', immediate)
    closePanel('shortcuts', immediate)
  }

  const openAnchoredPanel = (panelId: OverlayPanelId, sourceRect?: DOMRect) => {
    const nextAnchor = getOverlayAnchor(panelId, sourceRect)
    setOverlayAnchors((prev) => ({
      ...prev,
      [panelId]: nextAnchor,
    }))
    closeAllAnchoredPanels(true)
    setClosingPanels((prev) => ({ ...prev, [panelId]: false }))
    setPanelOpenState(panelId, true)
  }

  const toggleAnchoredPanel = (panelId: OverlayPanelId, event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (isPanelOpen(panelId) || closingPanels[panelId]) {
      closePanel(panelId)
      return
    }

    openAnchoredPanel(panelId, rect)
  }

  const animateWindows = (ids: number[]) => {
    if (layoutAnimationTimerRef.current) {
      window.clearTimeout(layoutAnimationTimerRef.current)
    }

    setLayoutAnimatingIds(ids)
    layoutAnimationTimerRef.current = window.setTimeout(() => {
      setLayoutAnimatingIds([])
      layoutAnimationTimerRef.current = null
    }, 320)
  }

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
    const scoped = [...windows]
      .filter((w) => w.appId === appId && w.workspace === currentWorkspace)
      .sort((a, b) => b.z - a.z)

    const visible = scoped.find((w) => !w.minimized)
    if (visible) {
      bringToFront(visible.id)
      return
    }

    const minimized = scoped.find((w) => w.minimized)
    if (minimized) {
      bringToFront(minimized.id)
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

  const reorderDockPins = (sourceAppId: AppId, targetAppId: AppId) => {
    if (sourceAppId === targetAppId) {
      return
    }

    setPinnedByWorkspace((prev) => {
      const currentPins = prev[currentWorkspace]
      const sourceIndex = currentPins.indexOf(sourceAppId)
      const targetIndex = currentPins.indexOf(targetAppId)
      if (sourceIndex === -1 || targetIndex === -1) {
        return prev
      }

      const nextPins = [...currentPins]
      nextPins.splice(sourceIndex, 1)
      nextPins.splice(targetIndex, 0, sourceAppId)
      return {
        ...prev,
        [currentWorkspace]: nextPins,
      }
    })
  }

  const showDockPreview = (appId: AppId) => {
    if (dockPreviewHideTimerRef.current) {
      window.clearTimeout(dockPreviewHideTimerRef.current)
      dockPreviewHideTimerRef.current = null
    }
    setDockPreviewApp(appId)
  }

  const hideDockPreviewSoon = () => {
    if (dockPreviewHideTimerRef.current) {
      window.clearTimeout(dockPreviewHideTimerRef.current)
    }
    dockPreviewHideTimerRef.current = window.setTimeout(() => {
      setDockPreviewApp(null)
      dockPreviewHideTimerRef.current = null
    }, 150)
  }

  const hideDockPreviewNow = () => {
    if (dockPreviewHideTimerRef.current) {
      window.clearTimeout(dockPreviewHideTimerRef.current)
      dockPreviewHideTimerRef.current = null
    }
    setDockPreviewApp(null)
  }

  const openDockMenu = (event: React.MouseEvent, appId: AppId) => {
    event.preventDefault()
    event.stopPropagation()
    openDockMenuAt(appId, event.clientX, event.clientY)
  }

  const openDockMenuAt = (appId: AppId, x: number, y: number) => {
    const menuWidth = 320
    const menuHeight = 210
    const clampedX = Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8))
    const clampedY = Math.max(8, Math.min(y, window.innerHeight - menuHeight - 8))

    setDockMenu({
      appId,
      x: clampedX,
      y: clampedY,
    })
    setDockMenuIndex(0)
  }

  const closeDockMenu = () => {
    setDockMenu(null)
    setDockMenuIndex(0)
  }

  const moveAppWindowsToWorkspace = (appId: AppId, targetWorkspace: WorkspaceId) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.appId === appId && w.workspace === currentWorkspace) {
          return { ...w, workspace: targetWorkspace, minimized: false }
        }
        return w
      }),
    )
    setCurrentWorkspace(targetWorkspace)
    setActiveWindowId(null)
    closeDockMenu()
  }

  const closeAllAppWindows = (appId: AppId) => {
    const activeMatchesTarget = windows.some(
      (w) => w.id === activeWindowId && w.appId === appId && w.workspace === currentWorkspace,
    )
    setWindows((prev) => prev.filter((w) => !(w.appId === appId && w.workspace === currentWorkspace)))
    if (activeMatchesTarget) {
      setActiveWindowId(null)
    }
    closeDockMenu()
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
    closeAllAnchoredPanels(true)
    const presets = arrangementPresetsByWorkspace[workspace] ?? []
    const selectedPresetId = selectedArrangementPresetByWorkspace[workspace]
    const selectedPreset = presets.find((preset) => preset.id === selectedPresetId)
    const fallbackPreset = selectedPreset ?? presets[0]
    window.setTimeout(() => {
      if (fallbackPreset) {
        restoreSavedArrangement(workspace, fallbackPreset.id)
        return
      }
      const preferredLayout = preferredLayoutByWorkspace[workspace]
      if (preferredLayout) {
        applyWorkspaceLayout(preferredLayout, workspace, false)
      }
    }, 0)
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

  const startResize = (event: React.PointerEvent, win: RingWindow, direction: ResizeDirection) => {
    if (win.maximized) {
      return
    }

    event.stopPropagation()
    resizeRef.current = {
      id: win.id,
      direction,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: win.x,
      startTop: win.y,
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
          return { ...w, maximized: true, snap: 'none', y: 0 }
        }

        const width = Math.floor(window.innerWidth / 2)
        const height = window.innerHeight
        return {
          ...w,
          maximized: false,
          snap: hint,
          x: hint === 'left' ? 0 : width,
          y: 0,
          width,
          height,
        }
      }),
    )
  }

  const applyLayoutPreset = (presetId: LayoutPresetId) => {
    if (!activeWindowId) {
      return
    }

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const third = Math.floor(viewportWidth / 3)
    const halfWidth = Math.floor(viewportWidth / 2)
    const halfHeight = Math.floor(viewportHeight / 2)

    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== activeWindowId) {
          return w
        }

        if (presetId === 'left-third') {
          return { ...w, x: 0, y: 0, width: third, height: viewportHeight, maximized: false, minimized: false, snap: 'none' }
        }
        if (presetId === 'center-third') {
          return {
            ...w,
            x: third,
            y: 0,
            width: third,
            height: viewportHeight,
            maximized: false,
            minimized: false,
            snap: 'none',
          }
        }
        if (presetId === 'right-third') {
          return {
            ...w,
            x: third * 2,
            y: 0,
            width: viewportWidth - third * 2,
            height: viewportHeight,
            maximized: false,
            minimized: false,
            snap: 'none',
          }
        }
        if (presetId === 'left-two-thirds') {
          return {
            ...w,
            x: 0,
            y: 0,
            width: third * 2,
            height: viewportHeight,
            maximized: false,
            minimized: false,
            snap: 'none',
          }
        }
        if (presetId === 'right-two-thirds') {
          return {
            ...w,
            x: third,
            y: 0,
            width: viewportWidth - third,
            height: viewportHeight,
            maximized: false,
            minimized: false,
            snap: 'none',
          }
        }
        if (presetId === 'top-left') {
          return { ...w, x: 0, y: 0, width: halfWidth, height: halfHeight, maximized: false, minimized: false, snap: 'none' }
        }
        if (presetId === 'top-right') {
          return {
            ...w,
            x: halfWidth,
            y: 0,
            width: viewportWidth - halfWidth,
            height: halfHeight,
            maximized: false,
            minimized: false,
            snap: 'none',
          }
        }
        if (presetId === 'bottom-left') {
          return {
            ...w,
            x: 0,
            y: halfHeight,
            width: halfWidth,
            height: viewportHeight - halfHeight,
            maximized: false,
            minimized: false,
            snap: 'none',
          }
        }
        return {
          ...w,
          x: halfWidth,
          y: halfHeight,
          width: viewportWidth - halfWidth,
          height: viewportHeight - halfHeight,
          maximized: false,
          minimized: false,
          snap: 'none',
        }
      }),
    )

    bringToFront(activeWindowId)
  }

  const saveCurrentArrangement = (workspace: WorkspaceId = currentWorkspace, nameInput?: string) => {
    const arrangement = windows
      .filter((w) => w.workspace === workspace)
      .map((w) => ({
        windowId: w.id,
        x: w.x,
        y: w.y,
        width: w.width,
        height: w.height,
        minimized: w.minimized,
        maximized: w.maximized,
        snap: w.snap,
        z: w.z,
      }))

    if (arrangement.length === 0) {
      return
    }

    const existing = arrangementPresetsByWorkspace[workspace] ?? []
    const providedName = (nameInput ?? arrangementNameDraft).trim()
    const name = providedName || `Preset ${existing.length + 1}`
    const id = `preset-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const preset: ArrangementPreset = {
      id,
      name,
      items: arrangement,
      updatedAt: Date.now(),
    }

    setArrangementPresetsByWorkspace((prev) => ({
      ...prev,
      [workspace]: [preset, ...(prev[workspace] ?? [])].slice(0, 12),
    }))
    setSelectedArrangementPresetByWorkspace((prev) => ({
      ...prev,
      [workspace]: id,
    }))
    setArrangementNameDraft('')
  }

  const restoreSavedArrangement = (workspace: WorkspaceId = currentWorkspace, presetId?: string) => {
    const presets = arrangementPresetsByWorkspace[workspace] ?? []
    const selectedPresetId = presetId ?? selectedArrangementPresetByWorkspace[workspace]
    const preset =
      presets.find((entry) => entry.id === selectedPresetId) ??
      presets[0]

    if (!preset || preset.items.length === 0) {
      return
    }

    setSelectedArrangementPresetByWorkspace((prev) => ({
      ...prev,
      [workspace]: preset.id,
    }))

    const updates = new Map(preset.items.map((entry) => [entry.windowId, entry]))
    const animatingIds: number[] = []

    setWindows((prev) =>
      prev.map((w) => {
        if (w.workspace !== workspace) {
          return w
        }
        const update = updates.get(w.id)
        if (!update) {
          return w
        }
        animatingIds.push(w.id)
        return {
          ...w,
          x: update.x,
          y: update.y,
          width: update.width,
          height: update.height,
          minimized: update.minimized,
          maximized: update.maximized,
          snap: update.snap,
          z: update.z,
        }
      }),
    )

    animateWindows(animatingIds)
  }

  const deleteArrangementPreset = (workspace: WorkspaceId, presetId: string) => {
    let nextSelected: string | undefined
    setArrangementPresetsByWorkspace((prev) => {
      const next = (prev[workspace] ?? []).filter((preset) => preset.id !== presetId)
      nextSelected = next[0]?.id
      return {
        ...prev,
        [workspace]: next,
      }
    })
    setSelectedArrangementPresetByWorkspace((prev) => {
      if (prev[workspace] !== presetId) {
        return prev
      }
      return {
        ...prev,
        [workspace]: nextSelected,
      }
    })
  }

  const resetWorkspaceToDefaultLayout = (workspace: WorkspaceId = currentWorkspace) => {
    const scoped = windows
      .filter((w) => w.workspace === workspace)
      .sort((a, b) => a.id - b.id)
    const ids: number[] = []

    setWindows((prev) =>
      prev.map((w) => {
        if (w.workspace !== workspace) {
          return w
        }
        const idx = scoped.findIndex((entry) => entry.id === w.id)
        ids.push(w.id)
        return {
          ...w,
          x: 120 + (idx % 4) * 40,
          y: 90 + (idx % 4) * 36,
          width: w.appId === 'paint' ? 780 : 640,
          height: w.appId === 'paint' ? 520 : 440,
          minimized: false,
          maximized: false,
          snap: 'none',
        }
      }),
    )

    animateWindows(ids)
  }

  const applyWorkspaceLayout = (
    layoutId: WorkspaceLayoutId,
    workspace: WorkspaceId = currentWorkspace,
    persistPreference = true,
  ) => {
    const viewportWidth = window.innerWidth
    const viewportHeight = Math.max(320, window.innerHeight - DESKTOP_TOP - DESKTOP_BOTTOM)
    const priorityOrder: AppId[] = ['terminal', 'notes']

    if (persistPreference) {
      setPreferredLayoutByWorkspace((prev) => ({
        ...prev,
        [workspace]: layoutId,
      }))
    }

    const animatingIds: number[] = []

    setWindows((prev) => {
      const scoped = prev
        .filter((w) => w.workspace === workspace && !w.minimized)
        .sort((a, b) => a.z - b.z)

      if (scoped.length === 0) {
        return prev
      }

      const updates = new Map<number, Partial<RingWindow>>()

      if (layoutId === 'cascade') {
        const offsetX = 34
        const offsetY = 30
        const width = Math.min(760, Math.max(420, viewportWidth - 240))
        const height = Math.min(520, Math.max(300, viewportHeight - 150))

        scoped.forEach((win, idx) => {
          const maxX = Math.max(0, viewportWidth - width)
          const maxY = Math.max(0, viewportHeight - height)
          animatingIds.push(win.id)
          updates.set(win.id, {
            x: Math.min(idx * offsetX, maxX),
            y: Math.min(idx * offsetY, maxY),
            width,
            height,
            maximized: false,
            snap: 'none',
          })
        })
      } else {
        const priorityWindow = scoped.find((win) => priorityOrder.includes(win.appId))

        if (priorityWindow && scoped.length > 1) {
          const others = scoped.filter((win) => win.id !== priorityWindow.id)

          if (layoutId === 'tile-thirds') {
            const focusWidth = Math.max(440, Math.floor(viewportWidth * 0.67))
            const sideWidth = Math.max(320, viewportWidth - focusWidth)
            const sideRows = Math.max(1, others.length)
            const sideHeight = Math.max(240, Math.floor(viewportHeight / sideRows))

            animatingIds.push(priorityWindow.id)
            updates.set(priorityWindow.id, {
              x: 0,
              y: 0,
              width: focusWidth,
              height: viewportHeight,
              maximized: false,
              snap: 'none',
            })

            others.forEach((win, idx) => {
              animatingIds.push(win.id)
              const y = idx * sideHeight
              updates.set(win.id, {
                x: focusWidth,
                y,
                width: sideWidth,
                height: idx === sideRows - 1 ? viewportHeight - y : sideHeight,
                maximized: false,
                snap: 'none',
              })
            })
          } else {
            const focusWidth = Math.max(420, Math.floor(viewportWidth * 0.56))
            const sideWidth = Math.max(320, viewportWidth - focusWidth)
            const rows = Math.max(1, Math.ceil(others.length / 2))
            const sideCellWidth = Math.floor(sideWidth / 2)
            const sideCellHeight = Math.max(220, Math.floor(viewportHeight / rows))

            animatingIds.push(priorityWindow.id)
            updates.set(priorityWindow.id, {
              x: 0,
              y: 0,
              width: focusWidth,
              height: viewportHeight,
              maximized: false,
              snap: 'none',
            })

            others.forEach((win, idx) => {
              animatingIds.push(win.id)
              const row = Math.floor(idx / 2)
              const col = idx % 2
              const x = focusWidth + col * sideCellWidth
              const y = row * sideCellHeight
              const isLastCol = col === 1
              const isLastRow = row === rows - 1
              updates.set(win.id, {
                x,
                y,
                width: isLastCol ? sideWidth - sideCellWidth : sideCellWidth,
                height: isLastRow ? viewportHeight - y : sideCellHeight,
                maximized: false,
                snap: 'none',
              })
            })
          }
        } else {
          const columns = layoutId === 'tile-thirds' ? 3 : 2
          const rows = Math.max(1, Math.ceil(scoped.length / columns))
          const cellWidth = Math.max(320, Math.floor(viewportWidth / columns))
          const cellHeight = Math.max(240, Math.floor(viewportHeight / rows))

          scoped.forEach((win, idx) => {
            const row = Math.floor(idx / columns)
            const col = idx % columns
            const x = col * cellWidth
            const y = row * cellHeight
            const width = col === columns - 1 ? viewportWidth - x : cellWidth
            const height = row === rows - 1 ? viewportHeight - y : cellHeight
            animatingIds.push(win.id)
            updates.set(win.id, {
              x,
              y,
              width,
              height,
              maximized: false,
              snap: 'none',
            })
          })
        }
      }

      return prev.map((win) => {
        const update = updates.get(win.id)
        if (!update) {
          return win
        }
        return {
          ...win,
          ...update,
        }
      })
    })

    animateWindows(animatingIds)

    const topVisible = [...windows]
      .filter((w) => w.workspace === workspace && !w.minimized)
      .sort((a, b) => b.z - a.z)[0]
    if (topVisible && workspace === currentWorkspace) {
      setActiveWindowId(topVisible.id)
    }
  }

  const captureWindowSnapshot = async (windowId: number) => {
    const target = windowRefs.current[windowId]
    if (!target) {
      return
    }

    try {
      const canvas = await html2canvas(target, {
        backgroundColor: '#fffdf6',
        scale: 0.28,
        useCORS: true,
        logging: false,
      })
      const image = canvas.toDataURL('image/jpeg', 0.82)
      setWindowSnapshots((prev) => ({ ...prev, [windowId]: image }))
    } catch {
      // Ignore capture failures and keep last thumbnail.
    }
  }

  const runTerminalCommand = () => {
    const command = terminalInput.trim().toLowerCase()
    if (!command) {
      return
    }

    const commandParts = command.split(' ')
    const primary = commandParts[0]
    const secondary = commandParts[1]
    const rest = commandParts.slice(2).join(' ').trim()

    const nextLines = [`$ ${command}`]
    if (command === 'help') {
      nextLines.push('help, clear, vibe, apps, about, date, pulse, ws-a, ws-b, open <app>, dock, layout <quarters|thirds|cascade|save [name]|restore [name]|reset>')
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
    } else if (primary === 'open' && secondary) {
      if (secondary === 'notes' || secondary === 'browser' || secondary === 'paint' || secondary === 'music' || secondary === 'terminal') {
        openApp(secondary)
        nextLines.push(`Opened ${secondary}`)
      } else {
        nextLines.push(`Unknown app: ${secondary}`)
      }
    } else if (command === 'dock') {
      nextLines.push(`Dock order: ${dockApps.join(', ')}`)
    } else if (primary === 'layout' && secondary) {
      if (secondary === 'quarters') {
        applyWorkspaceLayout('tile-quarters')
        nextLines.push('Applied workspace layout: tile quarters')
      } else if (secondary === 'thirds') {
        applyWorkspaceLayout('tile-thirds')
        nextLines.push('Applied workspace layout: tile thirds')
      } else if (secondary === 'cascade') {
        applyWorkspaceLayout('cascade')
        nextLines.push('Applied workspace layout: cascade')
      } else if (secondary === 'save') {
        saveCurrentArrangement(currentWorkspace, rest || undefined)
        nextLines.push(`Saved exact window arrangement${rest ? ` as "${rest}"` : ''} for current workspace`)
      } else if (secondary === 'restore') {
        if (rest) {
          const match = (arrangementPresetsByWorkspace[currentWorkspace] ?? []).find(
            (preset) => preset.name.toLowerCase() === rest,
          )
          restoreSavedArrangement(currentWorkspace, match?.id)
          nextLines.push(match ? `Restored arrangement "${match.name}"` : `No arrangement named "${rest}" found; restored selected/latest preset`)
        } else {
          restoreSavedArrangement()
          nextLines.push('Restored saved window arrangement for current workspace')
        }
      } else if (secondary === 'reset') {
        resetWorkspaceToDefaultLayout()
        nextLines.push('Reset current workspace layout to default')
      } else {
        nextLines.push('Unknown layout. Use: quarters, thirds, cascade, save [name], restore [name], or reset')
      }
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
    if (paintDrawingRef.current) {
      pushPaintSnapshot()
    }
    paintDrawingRef.current = false
  }

  const clearCanvas = () => {
    const ctx = paintCtxRef.current
    const canvas = paintCanvasRef.current
    if (!ctx || !canvas) {
      return
    }

    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = '#fffdf6'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = paintColor
    setPaintRedo([])
    pushPaintSnapshot()
  }

  const applyPaintColor = (color: string) => {
    setPaintColor(color)
    setPaintMode('brush')
    if (paintCtxRef.current) {
      paintCtxRef.current.strokeStyle = color
      paintCtxRef.current.globalCompositeOperation = 'source-over'
    }
  }

  const pushPaintSnapshot = () => {
    const canvas = paintCanvasRef.current
    if (!canvas) {
      return
    }

    const snapshot = canvas.toDataURL('image/png')
    setPaintHistory((prev) => {
      if (prev[prev.length - 1] === snapshot) {
        return prev
      }
      const next = [...prev, snapshot]
      if (next.length > 30) {
        next.shift()
      }
      return next
    })
    setPaintRedo([])
  }

  const drawSnapshot = (snapshot: string) => {
    const canvas = paintCanvasRef.current
    const ctx = paintCtxRef.current
    if (!canvas || !ctx) {
      return
    }
    drawSnapshotToCanvas(snapshot, ctx, canvas, paintSize, paintColor, paintMode)
  }

  const undoPaint = () => {
    setPaintHistory((prev) => {
      if (prev.length <= 1) {
        return prev
      }
      const current = prev[prev.length - 1]
      const next = prev.slice(0, -1)
      setPaintRedo((redo) => [...redo, current])
      drawSnapshot(next[next.length - 1])
      return next
    })
  }

  const redoPaint = () => {
    setPaintRedo((prev) => {
      if (prev.length === 0) {
        return prev
      }
      const snapshot = prev[prev.length - 1]
      setPaintHistory((history) => [...history, snapshot])
      drawSnapshot(snapshot)
      return prev.slice(0, -1)
    })
  }

  const downloadPaint = () => {
    const canvas = paintCanvasRef.current
    if (!canvas) {
      return
    }
    const link = document.createElement('a')
    link.download = `ringos-paint-${Date.now()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const exportNotes = () => {
    const blob = new Blob([`${notesTitle}\n\n${notesValue}`], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${notesTitle.toLowerCase().replace(/\s+/g, '-') || 'ringos-notes'}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  const clearNotes = () => {
    setNotesValue('')
  }

  const resolveRingSurfDestination = (input: string) => {
    const raw = input.trim()
    if (!raw) {
      return null
    }

    if (/^https?:\/\//i.test(raw)) {
      return {
        url: raw,
        title: raw.replace(/^https?:\/\//i, ''),
      }
    }

    if (raw.includes('.') && !raw.includes(' ')) {
      const url = `https://${raw}`
      return {
        url,
        title: raw,
      }
    }

    const queryUrl = `https://duckduckgo.com/?q=${encodeURIComponent(raw)}`
    return {
      url: queryUrl,
      title: `Search: ${raw}`,
    }
  }

  const visitRingSurf = (rawInput: string, titleOverride?: string) => {
    const destination = resolveRingSurfDestination(rawInput)
    if (!destination) {
      return
    }

    const entry: BrowserHistoryEntry = {
      id: `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      url: destination.url,
      title: titleOverride ?? destination.title,
      visitedAt: Date.now(),
    }

    setBrowserQuickUrl(destination.url)
    setBrowserAddress(destination.url)
    setBrowserTab('feed')
    setBrowserStatus(`Opened ${entry.title}`)
    setBrowserHistory((prev) => {
      const base = browserNavIndex >= 0 ? prev.slice(0, browserNavIndex + 1) : prev
      const next = [...base, entry].slice(-80)
      setBrowserNavIndex(next.length - 1)
      return next
    })
  }

  const goBackRingSurf = () => {
    if (browserNavIndex <= 0) {
      setBrowserStatus('No previous page in history')
      return
    }
    const nextIndex = browserNavIndex - 1
    const entry = browserHistory[nextIndex]
    if (!entry) {
      return
    }
    setBrowserNavIndex(nextIndex)
    setBrowserQuickUrl(entry.url)
    setBrowserAddress(entry.url)
    setBrowserStatus(`Back: ${entry.title}`)
  }

  const goForwardRingSurf = () => {
    if (browserNavIndex >= browserHistory.length - 1) {
      setBrowserStatus('No forward page in history')
      return
    }
    const nextIndex = browserNavIndex + 1
    const entry = browserHistory[nextIndex]
    if (!entry) {
      return
    }
    setBrowserNavIndex(nextIndex)
    setBrowserQuickUrl(entry.url)
    setBrowserAddress(entry.url)
    setBrowserStatus(`Forward: ${entry.title}`)
  }

  const refreshRingSurf = () => {
    if (!browserQuickUrl.trim()) {
      return
    }
    setBrowserStatus(`Refreshed at ${new Date().toLocaleTimeString()}`)
  }

  const addCurrentToBookmarks = () => {
    const url = browserQuickUrl.trim()
    if (!url) {
      return
    }
    if (browserBookmarks.some((bookmark) => bookmark.url === url)) {
      setBrowserStatus('Already in bookmarks')
      return
    }

    const label = browserBookmarkName.trim() || browserPageTitle || url.replace(/^https?:\/\//i, '')
    const next: BrowserBookmark = {
      id: `bm-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      label,
      url,
      tags: ['saved'],
    }
    setBrowserBookmarks((prev) => [next, ...prev].slice(0, 80))
    setBrowserBookmarkName('')
    setBrowserStatus(`Bookmarked: ${label}`)
  }

  const removeBookmark = (bookmarkId: string) => {
    setBrowserBookmarks((prev) => prev.filter((bookmark) => bookmark.id !== bookmarkId))
  }

  const clearRingSurfHistory = () => {
    setBrowserHistory([])
    setBrowserNavIndex(-1)
    setBrowserStatus('History cleared')
  }

  const openRingSurfExternal = () => {
    if (!browserQuickUrl.trim()) {
      return
    }
    window.open(browserQuickUrl, '_blank', 'noreferrer')
  }

  const copyRingSurfLink = async () => {
    if (!browserQuickUrl.trim()) {
      return
    }
    try {
      await navigator.clipboard.writeText(browserQuickUrl)
      setBrowserStatus('Copied current URL')
    } catch {
      setBrowserStatus('Clipboard unavailable in this browser')
    }
  }

  const openNewRingSurfTab = (seedInput?: string, seedTitle?: string) => {
    const destination = resolveRingSurfDestination(seedInput ?? DEFAULT_BROWSER_URL)
    if (!destination) {
      return
    }

    const historyEntry: BrowserHistoryEntry = {
      id: `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      url: destination.url,
      title: seedTitle ?? destination.title,
      visitedAt: Date.now(),
    }
    const tab: BrowserSessionTab = {
      id: `tab-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: historyEntry.title,
      url: historyEntry.url,
      address: historyEntry.url,
      history: [historyEntry],
      navIndex: 0,
      pinned: false,
      group: 'General',
      lastVisitedAt: Date.now(),
    }

    setBrowserSessionTabs((prev) => [...prev, tab].slice(-10))
    setActiveBrowserSessionTabId(tab.id)
    setBrowserQuickUrl(tab.url)
    setBrowserAddress(tab.address)
    setBrowserHistory(tab.history)
    setBrowserNavIndex(tab.navIndex)
    setBrowserStatus(`Opened tab: ${tab.title}`)
    setBrowserTab('feed')
  }

  const switchRingSurfTab = (tabId: string) => {
    if (tabId === activeBrowserSessionTabId) {
      return
    }
    setActiveBrowserSessionTabId(tabId)
  }

  const closeRingSurfTab = (tabId: string) => {
    setBrowserSessionTabs((prev) => {
      if (prev.length <= 1) {
        setBrowserStatus('Keep at least one tab open')
        return prev
      }

      const closingIndex = prev.findIndex((tab) => tab.id === tabId)
      if (closingIndex === -1) {
        return prev
      }

      if (prev[closingIndex].pinned) {
        setBrowserStatus('Pinned tabs are protected. Unpin before closing.')
        return prev
      }

      const closing = prev[closingIndex]
      const next = prev.filter((tab) => tab.id !== tabId)
      setRecentlyClosedBrowserTabs((history) => [closing, ...history].slice(0, 8))

      if (activeBrowserSessionTabId === tabId) {
        const fallback = next[Math.max(0, closingIndex - 1)] ?? next[0]
        setActiveBrowserSessionTabId(fallback.id)
      }

      return next
    })
  }

  const reopenClosedRingSurfTab = () => {
    if (recentlyClosedBrowserTabs.length === 0) {
      setBrowserStatus('No recently closed tabs')
      return
    }

    const [nextTab, ...remaining] = recentlyClosedBrowserTabs
    setRecentlyClosedBrowserTabs(remaining)
    setBrowserSessionTabs((prev) => [...prev, { ...nextTab, lastVisitedAt: Date.now() }].slice(-10))
    setActiveBrowserSessionTabId(nextTab.id)
  }

  const togglePinRingSurfTab = (tabId: string) => {
    setBrowserSessionTabs((prev) => {
      const next = prev.map((tab) => (tab.id === tabId ? { ...tab, pinned: !tab.pinned } : tab))
      const pinned = next.filter((tab) => tab.pinned)
      const normal = next.filter((tab) => !tab.pinned)
      return [...pinned, ...normal]
    })
  }

  const setRingSurfTabGroup = (tabId: string, group: string) => {
    const normalized = group.trim() || 'General'
    setBrowserSessionTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, group: normalized } : tab)),
    )
    setBrowserStatus(`Tab group set: ${normalized}`)
  }

  const reorderRingSurfTabs = (sourceTabId: string, targetTabId: string) => {
    if (sourceTabId === targetTabId) {
      return
    }

    setBrowserSessionTabs((prev) => {
      const sourceIndex = prev.findIndex((tab) => tab.id === sourceTabId)
      const targetIndex = prev.findIndex((tab) => tab.id === targetTabId)
      if (sourceIndex === -1 || targetIndex === -1) {
        return prev
      }

      const next = [...prev]
      const [source] = next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, source)
      const pinned = next.filter((tab) => tab.pinned)
      const normal = next.filter((tab) => !tab.pinned)
      return [...pinned, ...normal]
    })
    setRecentlyReorderedTabId(sourceTabId)
  }

  const toggleBrowserGroupCollapsed = (group: string) => {
    setBrowserCollapsedGroups((prev) =>
      prev.includes(group) ? prev.filter((entry) => entry !== group) : [...prev, group],
    )
  }

  const exportRingSurfData = () => {
    const payload = {
      version: 1,
      exportedAt: Date.now(),
      bookmarks: browserBookmarks,
      sessionTabs: browserSessionTabs,
      activeSessionTabId: activeBrowserSessionTabId,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ringsurf-data-${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
    setBrowserStatus('Exported RingSurf data')
  }

  const importRingSurfData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as {
        bookmarks?: unknown
        sessionTabs?: unknown
        activeSessionTabId?: unknown
      }

      const nextBookmarks = normalizeBrowserBookmarks(parsed.bookmarks)
      const nextTabs = normalizeBrowserSessionTabs(parsed.sessionTabs, browserQuickUrl, browserHistory)
      const nextActiveTabId = normalizeActiveBrowserSessionTabId(parsed.activeSessionTabId, nextTabs)

      setBrowserBookmarks(nextBookmarks)
      setBrowserSessionTabs(nextTabs)
      setActiveBrowserSessionTabId(nextActiveTabId)
      setBrowserStatus('Imported RingSurf data')
    } catch {
      setBrowserStatus('Import failed: invalid JSON')
    } finally {
      event.target.value = ''
    }
  }

  const onMusicFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) {
      return
    }

    const additions = await Promise.all(
      files.map(async (file, idx) => ({
        id: `uploaded-${Date.now()}-${idx}`,
        name: file.name.replace(/\.[^.]+$/, ''),
        url: await fileToDataUrl(file),
        source: 'uploaded' as const,
      })),
    )

    setMusicTracks((prev) => [...prev, ...additions])
    if (!activeTrack && additions[0]) {
      setActiveTrack(additions[0].url)
    }
    event.target.value = ''
  }

  const playNextTrack = () => {
    if (musicTracks.length === 0) {
      return
    }
    const idx = musicTracks.findIndex((track) => track.url === activeTrack)
    const next = musicTracks[(idx + 1 + musicTracks.length) % musicTracks.length]
    setActiveTrack(next.url)
  }

  const playPrevTrack = () => {
    if (musicTracks.length === 0) {
      return
    }
    const idx = musicTracks.findIndex((track) => track.url === activeTrack)
    const prev = musicTracks[(idx - 1 + musicTracks.length) % musicTracks.length]
    setActiveTrack(prev.url)
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
      run: () => {
        if (launcherOpen || closingPanels.launcher) {
          closePanel('launcher')
        } else {
          openAnchoredPanel('launcher')
        }
      },
    },
    {
      id: 'toggle-layout-panel',
      label: 'Toggle Layout Panel',
      hint: 'Open window layout presets and auto arrange controls',
      run: () => {
        if (layoutPanelOpen || closingPanels.layout) {
          closePanel('layout')
        } else {
          openAnchoredPanel('layout')
        }
      },
    },
    {
      id: 'layout-quarters',
      label: 'Auto Arrange: Tile Quarters',
      hint: 'Arrange all visible windows in 2 columns',
      run: () => applyWorkspaceLayout('tile-quarters'),
    },
    {
      id: 'layout-thirds',
      label: 'Auto Arrange: Tile Thirds',
      hint: 'Arrange all visible windows in 3 columns',
      run: () => applyWorkspaceLayout('tile-thirds'),
    },
    {
      id: 'layout-cascade',
      label: 'Auto Arrange: Cascade',
      hint: 'Stack visible windows diagonally',
      run: () => applyWorkspaceLayout('cascade'),
    },
    {
      id: 'arrangement-save',
      label: 'Save Current Arrangement',
      hint: 'Store exact positions and sizes for this workspace',
      run: () => saveCurrentArrangement(),
    },
    {
      id: 'arrangement-restore',
      label: 'Restore Saved Arrangement',
      hint: 'Restore exact saved positions and sizes',
      run: () => restoreSavedArrangement(),
    },
    {
      id: 'layout-reset-default',
      label: 'Reset Workspace Layout',
      hint: 'Return windows to default app positions and sizes',
      run: () => resetWorkspaceToDefaultLayout(),
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
      run: () => openAnchoredPanel('shortcuts'),
    },
    {
      id: 'toggle-dock-edit',
      label: dockEditMode ? 'Finish Dock Edit Mode' : 'Enable Dock Edit Mode',
      hint: 'Drag pinned apps to reorder this workspace dock',
      run: () => setDockEditMode((v) => !v),
    },
  ]

  const filteredCommands = paletteCommands.filter((cmd) => {
    if (!paletteQuery.trim()) {
      return true
    }
    const q = paletteQuery.toLowerCase()
    return cmd.label.toLowerCase().includes(q) || cmd.hint.toLowerCase().includes(q)
  })

  const dockMenuActions: DockMenuAction[] = dockMenu
    ? [
        {
          id: 'open-new',
          label: 'Open New Window',
          run: () => {
            openApp(dockMenu.appId)
            closeDockMenu()
          },
        },
        {
          id: 'pin-toggle',
          label: pinnedApps.includes(dockMenu.appId) ? 'Unpin from Workspace Dock' : 'Pin to Workspace Dock',
          run: () => {
            toggleDockPin(dockMenu.appId)
            closeDockMenu()
          },
        },
        {
          id: 'move-workspace',
          label: `Move App Windows to Workspace ${currentWorkspace === 'A' ? 'B' : 'A'}`,
          run: () => moveAppWindowsToWorkspace(dockMenu.appId, currentWorkspace === 'A' ? 'B' : 'A'),
        },
        {
          id: 'close-all',
          label: `Close All ${APP_DEFS[dockMenu.appId].title} Windows`,
          danger: true,
          run: () => closeAllAppWindows(dockMenu.appId),
        },
      ]
    : []

  const onDockMenuKeyDown = (event: React.KeyboardEvent) => {
    if (!dockMenu || dockMenuActions.length === 0) {
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      closeDockMenu()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setDockMenuIndex((v) => (v + 1) % dockMenuActions.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setDockMenuIndex((v) => (v - 1 + dockMenuActions.length) % dockMenuActions.length)
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      setDockMenuIndex(0)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      setDockMenuIndex(dockMenuActions.length - 1)
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      dockMenuActions[dockMenuIndex]?.run()
    }
  }

  const getAppIconStyle = (appId: AppId) => {
    const app = APP_DEFS[appId]
    return {
      background: `linear-gradient(145deg, ${app.gradientA}, ${app.gradientB})`,
      boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 6px 12px ${app.color}55`,
      border: '1px solid rgba(255, 255, 255, 0.4)',
    }
  }

  const renderDockPreviewMini = (win: RingWindow) => {
    const snapshot = windowSnapshots[win.id]
    if (snapshot) {
      return (
        <div className="dock-preview-mini-image-wrap">
          <img src={snapshot} alt={`${win.title} preview`} className="dock-preview-mini-image" />
        </div>
      )
    }

    if (win.appId === 'paint') {
      const latestPaint = paintHistory[paintHistory.length - 1]
      if (latestPaint) {
        return (
          <div className="dock-preview-mini-image-wrap">
            <img src={latestPaint} alt="Paint snapshot" className="dock-preview-mini-image" />
          </div>
        )
      }
    }

    if (win.appId === 'notes') {
      return (
        <div className="dock-preview-mini fallback notes">
          <h4>{notesTitle}</h4>
          <p>{notesPreview}</p>
        </div>
      )
    }

    if (win.appId === 'browser') {
      return (
        <div className="dock-preview-mini fallback browser">
          <h4>RingSurf - {browserTab}</h4>
          <p>{browserQuickUrl}</p>
        </div>
      )
    }

    if (win.appId === 'music') {
      return (
        <div className="dock-preview-mini fallback music">
          <h4>{activeTrackName}</h4>
          <p>{musicTracks.length} tracks loaded</p>
        </div>
      )
    }

    return (
      <div className="dock-preview-mini fallback terminal">
        {terminalLog.slice(-3).map((line, idx) => (
          <span key={`${line}-${idx}`}>{line}</span>
        ))}
      </div>
    )
  }

  const renderPresetDiagram = (presetId: LayoutPresetId) => {
    return (
      <div className={`layout-diagram preset-${presetId}`} aria-hidden="true">
        <span className="box a" />
        <span className="box b" />
        <span className="box c" />
        <span className="box d" />
      </div>
    )
  }

  const renderWorkspaceLayoutDiagram = (layoutId: WorkspaceLayoutId) => {
    return (
      <div className={`layout-diagram workspace-${layoutId}`} aria-hidden="true">
        <span className="box a" />
        <span className="box b" />
        <span className="box c" />
        <span className="box d" />
      </div>
    )
  }

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
              data-tooltip="Switch to Workspace A"
            >
              A
            </button>
            <button
              className={currentWorkspace === 'B' ? 'active' : ''}
              onClick={() => switchWorkspace('B')}
              data-tooltip="Switch to Workspace B"
            >
              B
            </button>
          </div>
          <button className="chip" onClick={() => loadWorkspacePack(currentWorkspace)} data-tooltip="Open starter apps for this workspace">
            Load Pack
          </button>
          <button className="chip" onClick={() => setDockEditMode((v) => !v)} data-tooltip="Customize dock pins and order">
            {dockEditMode ? 'Done Dock' : 'Edit Dock'}
          </button>
          <button
            ref={layoutButtonRef}
            className={`chip ${walkthroughOpen && walkthroughTarget === 'layout' ? 'coach-target-active' : ''}`.trim()}
            onClick={(event) => toggleAnchoredPanel('layout', event)}
            data-tooltip="Open snap layouts panel"
          >
            Layouts
          </button>
          <button
            ref={launcherButtonRef}
            className={`chip ${walkthroughOpen && walkthroughTarget === 'launcher' ? 'coach-target-active' : ''}`.trim()}
            onClick={(event) => toggleAnchoredPanel('launcher', event)}
            data-tooltip="Open app launcher"
          >
            Launcher
          </button>
          <button
            ref={paletteButtonRef}
            className={`chip ${walkthroughOpen && walkthroughTarget === 'palette' ? 'coach-target-active' : ''}`.trim()}
            onClick={(event) => toggleAnchoredPanel('palette', event)}
            data-tooltip="Command palette (Ctrl/Cmd + K)"
          >
            Pulse AI
          </button>
          <button
            ref={shortcutsButtonRef}
            className="chip"
            onClick={(event) => toggleAnchoredPanel('shortcuts', event)}
            data-tooltip="Shortcut help (?)"
          >
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

        {(shortcutHelpOpen || closingPanels.shortcuts) && (
          <div
            className={`shortcut-help anchored-overlay origin-shortcuts ${closingPanels.shortcuts ? 'closing' : 'opening'}`}
            role="dialog"
            aria-label="Keyboard shortcuts"
            style={{ left: overlayAnchors.shortcuts.x, top: overlayAnchors.shortcuts.y }}
          >
            <div className="shortcut-help-head">
              <h2>RingOs Shortcuts</h2>
              <button onClick={() => closePanel('shortcuts')} aria-label="Close shortcuts">
                x
              </button>
            </div>
            <ul>
              <li>Cmd/Ctrl + K: Open Pulse AI palette</li>
              <li>Cmd/Ctrl + 1: Switch to Workspace A</li>
              <li>Cmd/Ctrl + 2: Switch to Workspace B</li>
              <li>Cmd/Ctrl + Shift + Left/Right: Snap active window</li>
              <li>Cmd/Ctrl + Shift + Up: Maximize active window</li>
              <li>Cmd/Ctrl + Shift + 3: Tile visible windows in thirds</li>
              <li>Cmd/Ctrl + Shift + 4: Tile visible windows in quarters</li>
              <li>Cmd/Ctrl + Shift + 0: Cascade visible windows</li>
              <li>Cmd/Ctrl + M: Minimize active window</li>
              <li>Alt + `: Cycle active window</li>
              <li>Alt + 1..9: Launch or restore dock apps by order</li>
              <li>?: Toggle this shortcuts panel</li>
            </ul>
          </div>
        )}

        {(launcherOpen || closingPanels.launcher) && (
          <div
            className={`launcher anchored-overlay origin-launcher ${closingPanels.launcher ? 'closing' : 'opening'}`}
            role="dialog"
            aria-label="Application launcher"
            style={{ left: overlayAnchors.launcher.x, top: overlayAnchors.launcher.y }}
          >
            <h2>Open App</h2>
            <input
              className="launcher-search"
              value={launcherSearch}
              onChange={(e) => setLauncherSearch(e.target.value)}
              placeholder="Find apps..."
              data-tooltip="Filter apps by name"
            />
            <div className="launcher-grid">
              {(Object.keys(APP_DEFS) as AppId[])
                .filter((appId) => {
                  const q = launcherSearch.trim().toLowerCase()
                  if (!q) {
                    return true
                  }
                  const app = APP_DEFS[appId]
                  return app.title.toLowerCase().includes(q)
                })
                .map((appId) => {
                const app = APP_DEFS[appId]
                const isPinned = pinnedApps.includes(appId)
                return (
                  <div key={appId} className="launcher-item">
                    <button onClick={() => openApp(appId)} data-tooltip={`Open ${app.title}`}>
                      <span className="app-icon" style={getAppIconStyle(appId)}>
                        {app.icon}
                      </span>
                      {app.title}
                    </button>
                    <button
                      className={`launcher-pin ${isPinned ? 'pinned' : ''}`}
                      data-tooltip={isPinned ? `Unpin ${app.title} from dock` : `Pin ${app.title} to dock`}
                      onClick={() => toggleDockPin(appId)}
                    >
                      {isPinned ? '📌 Unpin' : '📍 Pin'}
                    </button>
                  </div>
                )
                })}
            </div>
          </div>
        )}

        {(paletteOpen || closingPanels.palette) && (
          <div
            className={`palette anchored-overlay origin-palette ${closingPanels.palette ? 'closing' : 'opening'}`}
            role="dialog"
            aria-label="AI command palette"
            style={{ left: overlayAnchors.palette.x, top: overlayAnchors.palette.y }}
          >
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
                    closePanel('palette')
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

        {(layoutPanelOpen || closingPanels.layout) && (
          <section
            className={`layout-panel anchored-overlay origin-layout ${closingPanels.layout ? 'closing' : 'opening'}`}
            role="dialog"
            aria-label="Window layout presets"
            style={{ left: overlayAnchors.layout.x, top: overlayAnchors.layout.y }}
          >
            <header>
              <strong>Window Layouts</strong>
              <small>{activeWindowId ? 'Apply presets to active window' : 'Select a window first for single-window presets'}</small>
            </header>
            <div className="layout-saved-profile">
              Saved strategy: <strong>{preferredLayoutByWorkspace[currentWorkspace] ?? 'none'}</strong> | Exact arrangement:{' '}
              <strong>{(arrangementPresetsByWorkspace[currentWorkspace] ?? []).length > 0 ? 'saved' : 'none'}</strong>
            </div>
            <div className="layout-arrangement-input-row">
              <input
                value={arrangementNameDraft}
                onChange={(e) => setArrangementNameDraft(e.target.value)}
                placeholder="Preset name (optional)"
                data-tooltip="Name this saved arrangement"
              />
              <button onClick={() => saveCurrentArrangement()} data-tooltip="Save as a named arrangement preset">
                Save Preset
              </button>
            </div>
            <div className="layout-actions">
              <button
                onClick={() => restoreSavedArrangement()}
                data-tooltip="Restore exact saved positions and sizes"
                disabled={(arrangementPresetsByWorkspace[currentWorkspace] ?? []).length === 0}
              >
                Restore Selected
              </button>
              <button
                onClick={() => resetWorkspaceToDefaultLayout()}
                data-tooltip="Reset current workspace windows to default positions"
              >
                Reset To Default
              </button>
            </div>
            {(arrangementPresetsByWorkspace[currentWorkspace] ?? []).length > 0 && (
              <div className="layout-preset-list" aria-label="Saved arrangement presets">
                {(arrangementPresetsByWorkspace[currentWorkspace] ?? []).map((preset) => {
                  const selected = selectedArrangementPresetByWorkspace[currentWorkspace] === preset.id
                  return (
                    <div key={preset.id} className={`layout-preset-item ${selected ? 'selected' : ''}`.trim()}>
                      <button
                        className="layout-preset-restore"
                        onClick={() => restoreSavedArrangement(currentWorkspace, preset.id)}
                        data-tooltip={`Restore ${preset.name}`}
                      >
                        <strong>{preset.name}</strong>
                        <small>{new Date(preset.updatedAt).toLocaleString()}</small>
                      </button>
                      <button
                        className="layout-preset-delete"
                        onClick={() => deleteArrangementPreset(currentWorkspace, preset.id)}
                        data-tooltip={`Delete ${preset.name}`}
                      >
                        x
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="layout-panel-section">
              <h4>Active Window Presets</h4>
              <p>Fast snap presets for the focused window.</p>
            </div>
            <div className="layout-grid">
              {LAYOUT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyLayoutPreset(preset.id)}
                  disabled={!activeWindowId}
                  data-tooltip={preset.detail}
                >
                  {renderPresetDiagram(preset.id)}
                  <strong>{preset.label}</strong>
                  <small>{preset.detail}</small>
                </button>
              ))}
            </div>
            <div className="layout-panel-section">
              <h4>Workspace Auto Arrange</h4>
              <p>Reflow all visible windows in this workspace at once.</p>
            </div>
            <div className="layout-grid layout-grid-wide">
              {WORKSPACE_LAYOUTS.map((layout) => (
                <button
                  key={layout.id}
                  onClick={() => applyWorkspaceLayout(layout.id)}
                  disabled={visibleWindows.length === 0}
                  data-tooltip={layout.detail}
                >
                  {renderWorkspaceLayoutDiagram(layout.id)}
                  <strong>{layout.label}</strong>
                  <small>{layout.detail}</small>
                </button>
              ))}
            </div>
          </section>
        )}

        {walkthroughOpen && (
          <section
            className="coachmark"
            role="dialog"
            aria-label="RingOs quick walkthrough"
            style={{ left: walkthroughAnchor.x, top: walkthroughAnchor.y }}
          >
            <strong>{COACHMARK_TEXT[walkthroughTarget].title}</strong>
            <p>{COACHMARK_TEXT[walkthroughTarget].body}</p>
            <div className="coachmark-actions">
              <button
                onClick={() => {
                  setWalkthroughOpen(false)
                  localStorage.setItem(WALKTHROUGH_KEY, 'done')
                }}
              >
                Skip
              </button>
              <button
                onClick={() => {
                  if (walkthroughStep >= 2) {
                    setWalkthroughOpen(false)
                    localStorage.setItem(WALKTHROUGH_KEY, 'done')
                  } else {
                    setWalkthroughStep((s) => s + 1)
                  }
                }}
              >
                {walkthroughStep >= 2 ? 'Done' : 'Next'}
              </button>
            </div>
          </section>
        )}

        {snapHint && <div className={`snap-hint ${snapHint}`} aria-hidden="true" />}

        {visibleWindows.map((win) => {
          const app = APP_DEFS[win.appId]
          const width = win.maximized ? '100%' : win.snap !== 'none' ? '50%' : `${win.width}px`

          return (
            <article
              key={win.id}
              className={`window ${win.maximized ? 'maximized' : ''} ${activeWindowId === win.id ? 'active' : ''} ${layoutAnimatingIds.includes(win.id) ? 'layout-animating' : ''}`.trim()}
              ref={(node) => {
                windowRefs.current[win.id] = node
              }}
              style={{
                left: win.maximized ? 0 : win.x,
                top: win.maximized ? -DESKTOP_TOP : win.y,
                width,
                height: win.maximized ? `calc(100% + ${DESKTOP_TOP + DESKTOP_BOTTOM}px)` : win.height,
                zIndex: win.z,
              }}
              onMouseDown={() => bringToFront(win.id)}
            >
              <div className="window-titlebar" onPointerDown={(e) => startDrag(e, win)}>
                <div className="title-left">
                  <span className="app-icon" style={getAppIconStyle(win.appId)}>
                    {app.icon}
                  </span>
                  {app.title}
                </div>
                <div className="window-actions">
                  <button onClick={() => minimizeWindow(win.id)} aria-label="Minimize" data-tooltip="Minimize window">
                    _
                  </button>
                  <button onClick={() => toggleMaximize(win.id)} aria-label="Maximize" data-tooltip="Maximize or restore window">
                    []
                  </button>
                  <button onClick={() => closeWindow(win.id)} aria-label="Close" data-tooltip="Close window">
                    x
                  </button>
                </div>
              </div>

              <div className="window-body">
                {win.appId === 'notes' && (
                  <div className="notes-app">
                    <div className="notes-toolbar">
                      <input
                        value={notesTitle}
                        onChange={(e) => setNotesTitle(e.target.value)}
                        placeholder="Note title"
                        data-tooltip="Edit note title"
                      />
                      <button className="btn-primary" onClick={exportNotes} data-tooltip="Export notes to text file">
                        Export
                      </button>
                      <button className="btn-danger" onClick={clearNotes} data-tooltip="Clear note content">
                        Clear
                      </button>
                      <small>{notesValue.trim() ? notesValue.trim().split(/\s+/).length : 0} words</small>
                    </div>
                    <textarea
                      value={notesValue}
                      onChange={(e) => setNotesValue(e.target.value)}
                      placeholder="Write notes..."
                    />
                  </div>
                )}

                {win.appId === 'browser' && (
                  <div className="browser-app">
                    <div className="browser-session-groups">
                      {browserTabGroupOptions.map((group) => (
                        <button
                          key={group}
                          className={`btn-ghost btn-compact ${browserTabGroupFilter === group ? 'active' : ''}`.trim()}
                          onClick={() => setBrowserTabGroupFilter(group)}
                        >
                          {group}
                        </button>
                      ))}
                    </div>
                    <div className="browser-session-tabs" aria-label="RingSurf session tabs">
                      {browserVisibleGroupEntries.map(([group, tabs]) => {
                        const collapsed = browserCollapsedGroups.includes(group)
                        return (
                          <section key={group} className="browser-tab-lane">
                            <header className="browser-tab-lane-head">
                              <button className="btn-ghost btn-compact" onClick={() => toggleBrowserGroupCollapsed(group)}>
                                {collapsed ? '+' : '-'} {group}
                              </button>
                              <small>{tabs.length} tabs</small>
                            </header>
                            {!collapsed && (
                              <div className="browser-tab-lane-list">
                                {tabs.map((tab) => (
                                  <div
                                    key={tab.id}
                                    className={`browser-session-tab ${tab.id === activeBrowserSessionTabId ? 'active' : ''} ${browserTabDropTargetId === tab.id ? 'drop-target' : ''} ${recentlyReorderedTabId === tab.id ? 'reordered-flash' : ''}`.trim()}
                                    draggable
                                    onDragStart={() => {
                                      browserTabDragRef.current = tab.id
                                    }}
                                    onDragOver={(event) => {
                                      event.preventDefault()
                                      setBrowserTabDropTargetId(tab.id)
                                    }}
                                    onDrop={() => {
                                      if (!browserTabDragRef.current) {
                                        return
                                      }
                                      reorderRingSurfTabs(browserTabDragRef.current, tab.id)
                                      browserTabDragRef.current = null
                                      setBrowserTabDropTargetId(null)
                                    }}
                                    onDragEnd={() => {
                                      browserTabDragRef.current = null
                                      setBrowserTabDropTargetId(null)
                                    }}
                                  >
                                    <button className="btn-linklike" onClick={() => switchRingSurfTab(tab.id)}>
                                      {tab.pinned ? '★ ' : ''}
                                      {tab.title}
                                    </button>
                                    <small>{tab.group || 'General'}</small>
                                    <button className="btn-ghost btn-compact" onClick={() => togglePinRingSurfTab(tab.id)}>
                                      {tab.pinned ? 'Unpin' : 'Pin'}
                                    </button>
                                    {!tab.pinned ? (
                                      <button className="btn-danger btn-compact" onClick={() => closeRingSurfTab(tab.id)}>
                                        x
                                      </button>
                                    ) : (
                                      <span className="tab-protected-pill">Protected</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </section>
                        )
                      })}
                      <button className="btn-primary btn-compact" onClick={() => openNewRingSurfTab()} data-tooltip="Open new tab">
                        + Tab
                      </button>
                      <button className="btn-ghost btn-compact" onClick={reopenClosedRingSurfTab} data-tooltip="Reopen last closed tab">
                        Reopen
                      </button>
                    </div>
                    <div className="browser-toolbar">
                      <button className="btn-ghost btn-compact" onClick={goBackRingSurf} data-tooltip="Go back">
                        Prev
                      </button>
                      <button className="btn-ghost btn-compact" onClick={goForwardRingSurf} data-tooltip="Go forward">
                        Next
                      </button>
                      <button className="btn-ghost btn-compact" onClick={refreshRingSurf} data-tooltip="Refresh current page">
                        Refresh
                      </button>
                      <input
                        ref={browserAddressInputRef}
                        value={browserAddress}
                        onChange={(e) => setBrowserAddress(e.target.value)}
                        placeholder="Type URL or search query"
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            visitRingSurf(browserAddress)
                          }
                        }}
                      />
                      <button className="btn-primary" onClick={() => visitRingSurf(browserAddress)} data-tooltip="Open URL or run search">
                        Open URL
                      </button>
                      <button className="btn-ghost" onClick={openRingSurfExternal} data-tooltip="Open current page externally">
                        Open External
                      </button>
                      <button className="btn-ghost" onClick={copyRingSurfLink} data-tooltip="Copy current URL">
                        Copy Link
                      </button>
                      <input
                        value={browserSearch}
                        onChange={(e) => setBrowserSearch(e.target.value)}
                        placeholder="Filter bookmarks, history, discover"
                      />
                    </div>
                    <div className="browser-tabs">
                      <button className={browserTab === 'feed' ? 'active' : ''} onClick={() => setBrowserTab('feed')}>Flavor Feed</button>
                      <button className={browserTab === 'bookmarks' ? 'active' : ''} onClick={() => setBrowserTab('bookmarks')}>Bookmarks</button>
                      <button className={browserTab === 'history' ? 'active' : ''} onClick={() => setBrowserTab('history')}>History</button>
                      <button className={browserTab === 'discover' ? 'active' : ''} onClick={() => setBrowserTab('discover')}>Discover</button>
                      <button className={browserTab === 'tools' ? 'active' : ''} onClick={() => setBrowserTab('tools')}>Tools</button>
                    </div>
                    <div className="browser-status-row">
                      <strong>{browserPageTitle}</strong>
                      <span>{browserStatus}</span>
                    </div>
                    <div className="browser-tab-meta-row">
                      <label>
                        Group
                        <input
                          value={browserTabGroupDraft}
                          onChange={(e) => setBrowserTabGroupDraft(e.target.value)}
                          placeholder="General"
                        />
                      </label>
                      <button
                        className="btn-ghost btn-compact"
                        onClick={() => {
                          if (!activeBrowserSessionTab) {
                            return
                          }
                          setRingSurfTabGroup(activeBrowserSessionTab.id, browserTabGroupDraft)
                        }}
                      >
                        Apply Group
                      </button>
                    </div>
                    {browserTab === 'feed' && (
                      <div className="browser-card">
                        <h3>Live Navigation</h3>
                        <p>
                          RingSurf accepts direct URLs and search terms in one bar.
                          Use Prev/Next to travel your in-app history timeline.
                        </p>
                        <a href={browserQuickUrl} target="_blank" rel="noreferrer">
                          {browserQuickUrl}
                        </a>
                        <div className="browser-mini-history-grid">
                          {(browserHistory.length > 0 ? browserHistory : activeBrowserSessionTab?.history ?? [])
                            .slice()
                            .reverse()
                            .slice(0, 6)
                            .map((entry) => (
                              <button
                                key={entry.id}
                                className="browser-mini-history-card"
                                onClick={() => visitRingSurf(entry.url, entry.title)}
                              >
                                <strong>{entry.title}</strong>
                                <small>{new Date(entry.visitedAt).toLocaleTimeString()}</small>
                                <span>{entry.url.replace(/^https?:\/\//, '')}</span>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                    {browserTab === 'bookmarks' && (
                      <div className="browser-card browser-bookmarks">
                        <div className="browser-bookmark-form">
                          <input
                            value={browserBookmarkName}
                            onChange={(e) => setBrowserBookmarkName(e.target.value)}
                            placeholder="Bookmark name"
                          />
                          <button className="btn-primary btn-compact" onClick={addCurrentToBookmarks}>
                            Save Current
                          </button>
                        </div>
                        <div className="link-list">
                          {filteredBrowserBookmarks.length === 0 && <p>No bookmarks match this filter.</p>}
                          {filteredBrowserBookmarks.map((bookmark) => (
                            <div key={bookmark.id} className="browser-link-row">
                              <button
                                className="btn-linklike"
                                onClick={() => visitRingSurf(bookmark.url, bookmark.label)}
                                data-tooltip={`Open ${bookmark.label}`}
                              >
                                {bookmark.label}
                              </button>
                              <small>{bookmark.tags.join(', ')}</small>
                              <button
                                className="btn-danger btn-compact"
                                onClick={() => removeBookmark(bookmark.id)}
                                data-tooltip="Remove bookmark"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {browserTab === 'history' && (
                      <div className="browser-card browser-history">
                        <div className="browser-history-head">
                          <strong>{browserHistory.length} visits</strong>
                          <button className="btn-danger btn-compact" onClick={clearRingSurfHistory}>
                            Clear History
                          </button>
                        </div>
                        <div className="link-list">
                          {browserHistory
                            .slice()
                            .reverse()
                            .filter((entry) => {
                              const q = browserSearch.toLowerCase().trim()
                              if (!q) {
                                return true
                              }
                              return entry.title.toLowerCase().includes(q) || entry.url.toLowerCase().includes(q)
                            })
                            .map((entry) => (
                              <button
                                key={entry.id}
                                className="btn-linklike"
                                onClick={() => visitRingSurf(entry.url, entry.title)}
                              >
                                {entry.title} - {new Date(entry.visitedAt).toLocaleTimeString()}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                    {browserTab === 'discover' && (
                      <div className="browser-card browser-discover-grid">
                        {filteredDiscoverItems.map((item) => (
                          <article key={item.id} className="discover-tile">
                            <h4>{item.title}</h4>
                            <p>{item.summary}</p>
                            <div>
                              {item.tags.map((tag) => (
                                <span key={tag}>{tag}</span>
                              ))}
                            </div>
                            <button className="btn-primary btn-compact" onClick={() => visitRingSurf(item.url, item.title)}>
                              Open
                            </button>
                          </article>
                        ))}
                      </div>
                    )}
                    {browserTab === 'tools' && (
                      <div className="browser-card browser-tools">
                        <h3>Power Tools</h3>
                        <div className="browser-tools-grid">
                          <button className="btn-primary" onClick={exportRingSurfData}>
                            Export Data
                          </button>
                          <button
                            className="btn-ghost"
                            onClick={() => browserImportInputRef.current?.click()}
                          >
                            Import Data
                          </button>
                          <input
                            ref={browserImportInputRef}
                            type="file"
                            accept="application/json"
                            onChange={importRingSurfData}
                            className="ringsurf-import-input"
                          />
                          <button className="btn-ghost" onClick={() => visitRingSurf('site:hackclub.com jams', 'Search Hack Club Jams')}>
                            Search Hack Club Jams
                          </button>
                          <button className="btn-ghost" onClick={() => visitRingSurf('javascript array cheat sheet', 'Search JS Cheatsheet')}>
                            Search JS Cheatsheet
                          </button>
                          <button className="btn-ghost" onClick={() => visitRingSurf('https://web.dev/', 'web.dev')}>
                            Open web.dev
                          </button>
                          <button className="btn-ghost" onClick={() => visitRingSurf('https://caniuse.com/', 'Can I Use')}>
                            Open Can I Use
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {win.appId === 'paint' && (
                  <div className="paint-app">
                    <div className="paint-toolbar">
                      <button className="btn-ghost" onClick={() => applyPaintColor('#f4511e')} data-tooltip="Switch to sauce brush">
                        Sauce
                      </button>
                      <button className="btn-ghost" onClick={() => applyPaintColor('#ffb300')} data-tooltip="Switch to cheese brush">
                        Cheese
                      </button>
                      <button className="btn-ghost" onClick={() => applyPaintColor('#00897b')} data-tooltip="Switch to mint brush">
                        Mint
                      </button>
                      <button className="btn-ghost" onClick={() => applyPaintColor('#212121')} data-tooltip="Switch to ink brush">
                        Ink
                      </button>
                      <button className="btn-ghost" onClick={() => setPaintMode((m) => (m === 'brush' ? 'eraser' : 'brush'))}>
                        {paintMode === 'brush' ? 'Eraser' : 'Brush'}
                      </button>
                      <label>
                        Size
                        <input
                          type="range"
                          min={1}
                          max={32}
                          value={paintSize}
                          onChange={(e) => setPaintSize(Number(e.target.value))}
                        />
                      </label>
                      <label>
                        Color
                        <input
                          type="color"
                          value={paintColor}
                          onChange={(e) => applyPaintColor(e.target.value)}
                          data-tooltip="Pick custom color"
                        />
                      </label>
                      <button className="btn-ghost" onClick={undoPaint} data-tooltip="Undo last stroke" disabled={paintHistory.length <= 1}>
                        Undo
                      </button>
                      <button className="btn-ghost" onClick={redoPaint} data-tooltip="Redo undone stroke" disabled={paintRedo.length === 0}>
                        Redo
                      </button>
                      <button className="btn-danger" onClick={clearCanvas} data-tooltip="Clear canvas">
                        Clear
                      </button>
                      <button className="btn-primary" onClick={downloadPaint} data-tooltip="Download canvas as PNG">
                        Export PNG
                      </button>
                      <small>
                        History: {paintHistory.length} | Redo: {paintRedo.length}
                      </small>
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
                    <div className="music-controls">
                      <button className="btn-ghost" onClick={playPrevTrack} data-tooltip="Play previous track">
                        Prev
                      </button>
                      <button className="btn-ghost" onClick={playNextTrack} data-tooltip="Play next track">
                        Next
                      </button>
                      <label>
                        Volume
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={musicVolume}
                          onChange={(e) => setMusicVolume(Number(e.target.value))}
                        />
                      </label>
                      <label className="file-picker-label">
                        Local Files
                        <input type="file" accept="audio/*" multiple onChange={onMusicFileUpload} />
                        <span className="btn-primary btn-compact">Choose Files</span>
                      </label>
                    </div>
                    <div className="track-list">
                      {musicTracks.map((track) => (
                        <button
                          key={track.id}
                          className={activeTrack === track.url ? 'active' : ''}
                          onClick={() => setActiveTrack(track.url)}
                          data-tooltip={`Play ${track.name}`}
                        >
                          {track.name}
                        </button>
                      ))}
                    </div>
                    <audio
                      ref={musicAudioRef}
                      controls
                      src={activeTrack ?? undefined}
                      onEnded={playNextTrack}
                    />
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

              {!win.maximized && (
                <>
                  {(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as ResizeDirection[]).map((direction) => (
                    <div
                      key={direction}
                      className={`window-resize-handle ${direction}`}
                      onPointerDown={(e) => startResize(e, win, direction)}
                    />
                  ))}
                </>
              )}
            </article>
          )
        })}
      </section>

      {dockPreviewApp && dockPreviewWindows.length > 0 && (
        <section
          className="dock-preview"
          onMouseEnter={() => showDockPreview(dockPreviewApp)}
          onMouseLeave={hideDockPreviewSoon}
        >
          <header>
            <strong>{APP_DEFS[dockPreviewApp].title}</strong>
            <span>{dockPreviewWindows.length} windows</span>
          </header>
          <div className="dock-preview-grid">
            {dockPreviewWindows.map((win) => (
              <button
                key={win.id}
                className={`dock-preview-card ${win.minimized ? 'minimized' : ''}`}
                onClick={() => {
                  bringToFront(win.id)
                  hideDockPreviewNow()
                }}
                data-tooltip={win.minimized ? 'Restore and focus window' : 'Focus window'}
              >
                {renderDockPreviewMini(win)}
                <strong>{win.title}</strong>
                <small>#{win.id}</small>
                <em>{win.minimized ? 'Minimized' : 'Visible'}</em>
              </button>
            ))}
          </div>
        </section>
      )}

      <footer className="dock" onMouseLeave={hideDockPreviewSoon}>
        {dockApps.map((appId) => {
          const app = APP_DEFS[appId]
          const isPinned = pinnedApps.includes(appId)
          return (
            <div
              key={appId}
              className={`dock-item ${dockEditMode && isPinned ? 'editable' : ''}`}
              draggable={dockEditMode && isPinned}
              onContextMenu={(event) => openDockMenu(event, appId)}
              onDragStart={() => {
                dockDragRef.current = appId
              }}
              onDragOver={(event) => {
                if (dockEditMode && isPinned) {
                  event.preventDefault()
                }
              }}
              onDrop={() => {
                if (!dockEditMode || !isPinned || !dockDragRef.current) {
                  return
                }
                reorderDockPins(dockDragRef.current, appId)
                dockDragRef.current = null
              }}
              onDragEnd={() => {
                dockDragRef.current = null
              }}
              onMouseEnter={() => showDockPreview(appId)}
            >
              <button
                className="dock-launch-btn"
                onClick={() => restoreWindowByApp(appId)}
                data-tooltip={`Open or restore ${app.title}`}
                onKeyDown={(event) => {
                  if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                    event.preventDefault()
                    const rect = event.currentTarget.getBoundingClientRect()
                    openDockMenuAt(appId, rect.left + 12, rect.bottom + 6)
                  }
                }}
                aria-haspopup="menu"
                aria-expanded={dockMenu?.appId === appId}
              >
                <span className="app-icon" style={getAppIconStyle(appId)}>
                  {app.icon}
                </span>
                <span>{app.title}</span>
              </button>
              <div className="dock-item-meta">
                {appCounts[appId] > 0 && <span className="dock-count">{appCounts[appId]}</span>}
                {dockEditMode && (
                  <button
                    className={`dock-pin-icon ${isPinned ? 'pinned' : ''}`}
                    onClick={() => toggleDockPin(appId)}
                    data-tooltip={isPinned ? `Unpin ${app.title}` : `Pin ${app.title}`}
                  >
                    📌
                  </button>
                )}
              </div>
              {dockEditMode && isPinned && (
                <button
                  className="dock-reorder-hint"
                  data-tooltip="Drag pinned apps to reorder"
                >
                  Drag
                </button>
              )}
            </div>
          )
        })}
      </footer>

      {dockMenu && (
        <section
          className="dock-menu"
          style={{ left: dockMenu.x, top: dockMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={onDockMenuKeyDown}
          role="menu"
          aria-label={`${APP_DEFS[dockMenu.appId].title} dock actions`}
        >
          {dockMenuActions.map((action, idx) => (
            <button
              key={action.id}
              ref={(node) => {
                dockMenuButtonRefs.current[idx] = node
              }}
              role="menuitem"
              tabIndex={idx === dockMenuIndex ? 0 : -1}
              className={`${action.danger ? 'danger' : ''} ${idx === dockMenuIndex ? 'active' : ''}`.trim()}
              onMouseEnter={() => setDockMenuIndex(idx)}
              onClick={() => action.run()}
            >
              {action.label}
            </button>
          ))}
        </section>
      )}

      {tooltip.open && (
        <div className="ring-tooltip" style={{ left: tooltip.x + 12, top: tooltip.y + 16 }} role="tooltip">
          {tooltip.text}
        </div>
      )}
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
  if (y <= 8) {
    return 'top'
  }
  if (x <= 20) {
    return 'left'
  }
  if (x >= window.innerWidth - 20) {
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
    notesTitle: DEFAULT_NOTES_TITLE,
    activeTrack: null,
    musicTracks: DEFAULT_TRACKS,
    musicVolume: 1,
    terminalLog: DEFAULT_TERMINAL,
    browserTab: 'feed',
    browserQuickUrl: DEFAULT_BROWSER_URL,
    browserBookmarks: DEFAULT_BROWSER_BOOKMARKS,
    browserHistory: [
      {
        id: 'hist-default',
        url: DEFAULT_BROWSER_URL,
        title: 'Hack Club',
        visitedAt: Date.now(),
      },
    ],
    browserNavIndex: 0,
    browserSessionTabs: [
      {
        id: 'tab-default',
        title: 'Hack Club',
        url: DEFAULT_BROWSER_URL,
        address: DEFAULT_BROWSER_URL,
        history: [
          {
            id: 'hist-default',
            url: DEFAULT_BROWSER_URL,
            title: 'Hack Club',
            visitedAt: Date.now(),
          },
        ],
        navIndex: 0,
        pinned: true,
        group: 'General',
        lastVisitedAt: Date.now(),
      },
    ],
    activeBrowserSessionTabId: 'tab-default',
    browserCollapsedGroups: [],
    currentWorkspace: 'A',
    paintColor: '#f4511e',
    paintSize: 4,
    paintMode: 'brush',
    paintHistory: [],
    paintRedo: [],
    pinnedByWorkspace: DEFAULT_PINS,
    preferredLayoutByWorkspace: {},
    arrangementPresetsByWorkspace: {},
    selectedArrangementPresetByWorkspace: {},
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
    const normalizedBrowserHistory = normalizeBrowserHistory(parsed.browserHistory)
    const normalizedBrowserTabs = normalizeBrowserSessionTabs(
      parsed.browserSessionTabs,
      typeof parsed.browserQuickUrl === 'string' ? parsed.browserQuickUrl : DEFAULT_BROWSER_URL,
      normalizedBrowserHistory,
    )
    const normalizedActiveBrowserTabId = normalizeActiveBrowserSessionTabId(
      parsed.activeBrowserSessionTabId,
      normalizedBrowserTabs,
    )
    const activeBrowserTab =
      normalizedBrowserTabs.find((tab) => tab.id === normalizedActiveBrowserTabId) ?? normalizedBrowserTabs[0]

    return {
      windows: normalizedWindows,
      nextId: typeof parsed.nextId === 'number' ? parsed.nextId : 1,
      topZ: typeof parsed.topZ === 'number' ? parsed.topZ : 10,
      notesValue: typeof parsed.notesValue === 'string' ? parsed.notesValue : DEFAULT_NOTES,
      notesTitle: typeof parsed.notesTitle === 'string' ? parsed.notesTitle : DEFAULT_NOTES_TITLE,
      activeTrack: typeof parsed.activeTrack === 'string' ? parsed.activeTrack : null,
      musicTracks: normalizeTracks(parsed.musicTracks),
      musicVolume: typeof parsed.musicVolume === 'number' ? Math.max(0, Math.min(parsed.musicVolume, 1)) : 1,
      terminalLog: Array.isArray(parsed.terminalLog) ? parsed.terminalLog : DEFAULT_TERMINAL,
      browserTab:
        parsed.browserTab === 'feed' ||
        parsed.browserTab === 'bookmarks' ||
        parsed.browserTab === 'history' ||
        parsed.browserTab === 'discover' ||
        parsed.browserTab === 'tools'
          ? parsed.browserTab
          : 'feed',
          browserQuickUrl: activeBrowserTab?.url ?? (typeof parsed.browserQuickUrl === 'string' ? parsed.browserQuickUrl : DEFAULT_BROWSER_URL),
      browserBookmarks: normalizeBrowserBookmarks(parsed.browserBookmarks),
          browserHistory: activeBrowserTab?.history ?? normalizedBrowserHistory,
          browserNavIndex: activeBrowserTab?.navIndex ?? normalizeBrowserNavIndex(parsed.browserNavIndex, normalizedBrowserHistory),
          browserSessionTabs: normalizedBrowserTabs,
          activeBrowserSessionTabId: normalizedActiveBrowserTabId,
          browserCollapsedGroups: normalizeBrowserCollapsedGroups(parsed.browserCollapsedGroups),
      currentWorkspace: parsed.currentWorkspace === 'B' ? 'B' : 'A',
      paintColor: typeof parsed.paintColor === 'string' ? parsed.paintColor : '#f4511e',
      paintSize: typeof parsed.paintSize === 'number' ? Math.max(1, Math.min(parsed.paintSize, 32)) : 4,
      paintMode: parsed.paintMode === 'eraser' ? 'eraser' : 'brush',
      paintHistory: Array.isArray(parsed.paintHistory)
        ? parsed.paintHistory.filter((entry): entry is string => typeof entry === 'string').slice(-30)
        : [],
      paintRedo: Array.isArray(parsed.paintRedo)
        ? parsed.paintRedo.filter((entry): entry is string => typeof entry === 'string').slice(-30)
        : [],
      pinnedByWorkspace: normalizePins(parsed.pinnedByWorkspace),
      preferredLayoutByWorkspace: normalizePreferredLayouts(parsed.preferredLayoutByWorkspace),
      arrangementPresetsByWorkspace: normalizeArrangementPresets(
        parsed.arrangementPresetsByWorkspace,
        (parsed as { savedArrangementByWorkspace?: unknown }).savedArrangementByWorkspace,
      ),
      selectedArrangementPresetByWorkspace: normalizeSelectedArrangementPreset(
        parsed.selectedArrangementPresetByWorkspace,
        normalizeArrangementPresets(
          parsed.arrangementPresetsByWorkspace,
          (parsed as { savedArrangementByWorkspace?: unknown }).savedArrangementByWorkspace,
        ),
      ),
    }
  } catch {
    return fallback
  }
}

function normalizeWindowArrangementEntries(value: unknown): WindowArrangement[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }
      const entry = item as Partial<WindowArrangement>
      if (
        typeof entry.windowId !== 'number' ||
        typeof entry.x !== 'number' ||
        typeof entry.y !== 'number' ||
        typeof entry.width !== 'number' ||
        typeof entry.height !== 'number' ||
        typeof entry.z !== 'number'
      ) {
        return null
      }

      return {
        windowId: entry.windowId,
        x: entry.x,
        y: entry.y,
        width: entry.width,
        height: entry.height,
        minimized: Boolean(entry.minimized),
        maximized: Boolean(entry.maximized),
        snap: entry.snap === 'left' || entry.snap === 'right' ? entry.snap : 'none',
        z: entry.z,
      } as WindowArrangement
    })
    .filter((entry): entry is WindowArrangement => Boolean(entry))
}

function normalizeArrangementPresets(
  value: unknown,
  legacyValue?: unknown,
): Partial<Record<WorkspaceId, ArrangementPreset[]>> {
  const safe: Partial<Record<WorkspaceId, ArrangementPreset[]>> = {}

  if (value && typeof value === 'object') {
    const source = value as Partial<Record<WorkspaceId, unknown>>
    for (const workspace of ['A', 'B'] as const) {
      const presetsValue = source[workspace]
      if (!Array.isArray(presetsValue)) {
        continue
      }

      const presets = presetsValue
        .map((item, idx) => {
          if (!item || typeof item !== 'object') {
            return null
          }
          const preset = item as Partial<ArrangementPreset>
          const items = normalizeWindowArrangementEntries(preset.items)
          if (!preset.id || typeof preset.id !== 'string' || !preset.name || typeof preset.name !== 'string' || items.length === 0) {
            return null
          }
          return {
            id: preset.id,
            name: preset.name,
            items,
            updatedAt: typeof preset.updatedAt === 'number' ? preset.updatedAt : Date.now() - idx,
          } as ArrangementPreset
        })
        .filter((preset): preset is ArrangementPreset => Boolean(preset))

      if (presets.length > 0) {
        safe[workspace] = presets
      }
    }
  }

  if (Object.keys(safe).length > 0) {
    return safe
  }

  if (!legacyValue || typeof legacyValue !== 'object') {
    return safe
  }

  const legacy = legacyValue as Partial<Record<WorkspaceId, unknown>>
  for (const workspace of ['A', 'B'] as const) {
    const items = normalizeWindowArrangementEntries(legacy[workspace])
    if (items.length === 0) {
      continue
    }
    safe[workspace] = [
      {
        id: `legacy-${workspace}`,
        name: 'Legacy Preset',
        items,
        updatedAt: Date.now(),
      },
    ]
  }

  return safe
}

function normalizeSelectedArrangementPreset(
  value: unknown,
  presetsByWorkspace: Partial<Record<WorkspaceId, ArrangementPreset[]>>,
): Partial<Record<WorkspaceId, string>> {
  const safe: Partial<Record<WorkspaceId, string>> = {}
  if (value && typeof value === 'object') {
    const source = value as Partial<Record<WorkspaceId, unknown>>
    for (const workspace of ['A', 'B'] as const) {
      const selected = source[workspace]
      if (typeof selected === 'string' && (presetsByWorkspace[workspace] ?? []).some((preset) => preset.id === selected)) {
        safe[workspace] = selected
      }
    }
  }

  for (const workspace of ['A', 'B'] as const) {
    if (safe[workspace]) {
      continue
    }
    const first = presetsByWorkspace[workspace]?.[0]
    if (first) {
      safe[workspace] = first.id
    }
  }

  return safe
}

function normalizeBrowserBookmarks(value: unknown): BrowserBookmark[] {
  if (!Array.isArray(value)) {
    return DEFAULT_BROWSER_BOOKMARKS
  }

  const normalized = value
    .map((entry, idx) => {
      if (!entry || typeof entry !== 'object') {
        return null
      }
      const item = entry as Partial<BrowserBookmark>
      if (typeof item.label !== 'string' || typeof item.url !== 'string') {
        return null
      }
      return {
        id: typeof item.id === 'string' ? item.id : `bookmark-${idx}`,
        label: item.label,
        url: item.url,
        tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 6) : [],
      } as BrowserBookmark
    })
    .filter((entry): entry is BrowserBookmark => Boolean(entry))

  return normalized.length > 0 ? normalized : DEFAULT_BROWSER_BOOKMARKS
}

function normalizeBrowserHistory(value: unknown): BrowserHistoryEntry[] {
  if (!Array.isArray(value)) {
    return [
      {
        id: 'hist-default',
        url: DEFAULT_BROWSER_URL,
        title: 'Hack Club',
        visitedAt: Date.now(),
      },
    ]
  }

  const normalized = value
    .map((entry, idx) => {
      if (!entry || typeof entry !== 'object') {
        return null
      }
      const item = entry as Partial<BrowserHistoryEntry>
      if (typeof item.url !== 'string' || typeof item.title !== 'string') {
        return null
      }
      return {
        id: typeof item.id === 'string' ? item.id : `history-${idx}`,
        url: item.url,
        title: item.title,
        visitedAt: typeof item.visitedAt === 'number' ? item.visitedAt : Date.now() - idx,
      } as BrowserHistoryEntry
    })
    .filter((entry): entry is BrowserHistoryEntry => Boolean(entry))
    .slice(-80)

  if (normalized.length === 0) {
    return [
      {
        id: 'hist-default',
        url: DEFAULT_BROWSER_URL,
        title: 'Hack Club',
        visitedAt: Date.now(),
      },
    ]
  }

  return normalized
}

function normalizeBrowserNavIndex(value: unknown, history: BrowserHistoryEntry[]): number {
  if (history.length === 0) {
    return -1
  }
  if (typeof value !== 'number') {
    return history.length - 1
  }
  return Math.max(0, Math.min(history.length - 1, Math.floor(value)))
}

function normalizeBrowserSessionTabs(
  value: unknown,
  fallbackUrl: string,
  fallbackHistory: BrowserHistoryEntry[],
): BrowserSessionTab[] {
  if (!Array.isArray(value)) {
    const history = fallbackHistory.length > 0 ? fallbackHistory : normalizeBrowserHistory(undefined)
    const index = normalizeBrowserNavIndex(undefined, history)
    return [
      {
        id: 'tab-default',
        title: history[index]?.title ?? 'Hack Club',
        url: fallbackUrl || history[index]?.url || DEFAULT_BROWSER_URL,
        address: fallbackUrl || history[index]?.url || DEFAULT_BROWSER_URL,
        history,
        navIndex: index,
        pinned: true,
        group: 'General',
        lastVisitedAt: Date.now(),
      },
    ]
  }

  const normalized = value
    .map((entry, idx) => {
      if (!entry || typeof entry !== 'object') {
        return null
      }
      const item = entry as Partial<BrowserSessionTab>
      const history = normalizeBrowserHistory(item.history)
      const navIndex = normalizeBrowserNavIndex(item.navIndex, history)
      const url = typeof item.url === 'string' ? item.url : history[navIndex]?.url ?? fallbackUrl

      return {
        id: typeof item.id === 'string' ? item.id : `tab-${idx}`,
        title: typeof item.title === 'string' ? item.title : history[navIndex]?.title ?? 'RingSurf Tab',
        url,
        address: typeof item.address === 'string' ? item.address : url,
        history,
        navIndex,
        pinned: Boolean(item.pinned),
        group: typeof item.group === 'string' && item.group.trim().length > 0 ? item.group.trim().slice(0, 24) : 'General',
        lastVisitedAt: typeof item.lastVisitedAt === 'number' ? item.lastVisitedAt : Date.now() - idx,
      } as BrowserSessionTab
    })
    .filter((entry): entry is BrowserSessionTab => Boolean(entry))
    .slice(-10)

  return normalized.length > 0 ? normalized : normalizeBrowserSessionTabs(undefined, fallbackUrl, fallbackHistory)
}

function normalizeActiveBrowserSessionTabId(value: unknown, tabs: BrowserSessionTab[]): string {
  if (tabs.length === 0) {
    return 'tab-default'
  }
  if (typeof value === 'string' && tabs.some((tab) => tab.id === value)) {
    return value
  }
  return tabs[0].id
}

function normalizeBrowserCollapsedGroups(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .slice(0, 24)
}

function normalizePreferredLayouts(value: unknown): Partial<Record<WorkspaceId, WorkspaceLayoutId>> {
  const safe: Partial<Record<WorkspaceId, WorkspaceLayoutId>> = {}
  if (!value || typeof value !== 'object') {
    return safe
  }

  const source = value as Partial<Record<WorkspaceId, unknown>>
  for (const workspace of ['A', 'B'] as const) {
    const layout = source[workspace]
    if (layout === 'tile-quarters' || layout === 'tile-thirds' || layout === 'cascade') {
      safe[workspace] = layout
    }
  }

  return safe
}

function normalizeTracks(value: unknown): MusicTrack[] {
  if (!Array.isArray(value)) {
    return DEFAULT_TRACKS
  }

  const normalized = value
    .map((item, idx) => {
      if (!item || typeof item !== 'object') {
        return null
      }
      const raw = item as Partial<MusicTrack>
      if (typeof raw.name !== 'string' || typeof raw.url !== 'string') {
        return null
      }
      return {
        id: typeof raw.id === 'string' ? raw.id : `restored-${idx}`,
        name: raw.name,
        url: raw.url,
        source: raw.source === 'uploaded' ? 'uploaded' : 'built-in',
      } as MusicTrack
    })
    .filter((track): track is MusicTrack => Boolean(track))

  return normalized.length > 0 ? normalized : DEFAULT_TRACKS
}

function drawSnapshotToCanvas(
  snapshot: string,
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  paintSize: number,
  paintColor: string,
  paintMode: 'brush' | 'eraser',
) {
  const img = new Image()
  img.onload = () => {
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#fffdf6'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    ctx.lineWidth = paintSize
    ctx.strokeStyle = paintColor
    ctx.globalCompositeOperation = paintMode === 'eraser' ? 'destination-out' : 'source-over'
  }
  img.src = snapshot
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to read file as data URL'))
      }
    }
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
    reader.readAsDataURL(file)
  })
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
