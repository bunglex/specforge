import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import Canvas from '../components/Canvas';
import ClausePickerModal from '../components/ClausePickerModal';
import Inspector from '../components/Inspector';
import TreeMenu, { TreeNodeItem } from '../components/TreeMenu';
import { useDocument } from '../hooks/useDocument';

type EditorPageProps = {
  clauses: any[];
};

type EditorState = {
  selectedBlockId: string;
  clausePickerOpen: boolean;
};

type EditorAction =
  | { type: 'initialize_selection'; blockId: string }
  | { type: 'select_block'; blockId: string }
  | { type: 'toggle_clause_picker'; open: boolean };

type DesktopWindowKey = 'library' | 'browser' | 'properties';
type DockSlot = 'left' | 'center' | 'right';

type DesktopWindowState = {
  x: number;
  y: number;
  z: number;
  visible: boolean;
  minimized: boolean;
  maximized: boolean;
  docked: boolean;
  dockSlot: DockSlot;
  restore?: {
    x: number;
    y: number;
    docked: boolean;
    dockSlot: DockSlot;
  };
};

type DragState = {
  key: DesktopWindowKey;
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'initialize_selection':
      return state.selectedBlockId ? state : { ...state, selectedBlockId: action.blockId };
    case 'select_block':
      return { ...state, selectedBlockId: action.blockId };
    case 'toggle_clause_picker':
      return { ...state, clausePickerOpen: action.open };
    default:
      return state;
  }
}

function getFirstBlockId(document: any) {
  const sections = document?.structure?.sections || [];
  for (const section of sections) {
    if (section?.blocks?.[0]?.id) {
      return String(section.blocks[0].id);
    }
  }
  return '';
}

function updateDocumentBlock(document: any, blockId: string, updater: (block: any) => any) {
  const sections = document?.structure?.sections || [];

  let updated = false;
  const nextSections = sections.map((section: any) => {
    const index = (section.blocks || []).findIndex((block: any) => String(block.id) === blockId);
    if (index === -1) return section;

    const nextBlocks = [...section.blocks];
    nextBlocks[index] = updater(nextBlocks[index]);
    updated = true;
    return { ...section, blocks: nextBlocks };
  });

  if (!updated) return document;
  return { ...document, structure: { ...document.structure, sections: nextSections } };
}

function reorderById<T extends { id: string | number }>(items: T[], fromId: string, toId: string): T[] {
  const fromIndex = items.findIndex((item) => String(item.id) === fromId);
  const toIndex = items.findIndex((item) => String(item.id) === toId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return items;

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

const LIBRARY_TABS = ['project', 'clauses', 'assembly', 'materials', 'products'] as const;
const WINDOW_KEYS: DesktopWindowKey[] = ['library', 'browser', 'properties'];
const DEFAULT_WINDOWS: Record<DesktopWindowKey, DesktopWindowState> = {
  library: { x: 16, y: 16, z: 1, visible: true, minimized: false, maximized: false, docked: true, dockSlot: 'left' },
  browser: { x: 336, y: 16, z: 2, visible: true, minimized: false, maximized: false, docked: true, dockSlot: 'center' },
  properties: { x: 980, y: 16, z: 3, visible: true, minimized: false, maximized: false, docked: true, dockSlot: 'right' }
};

type LibraryTab = typeof LIBRARY_TABS[number];

export default function EditorPage({ clauses }: EditorPageProps) {
  const { documentId } = useParams();
  const { document, setDocument, loading, error, saveState, saveDocumentDebounced } = useDocument(documentId);
  const [state, dispatch] = useReducer(reducer, { selectedBlockId: '', clausePickerOpen: false });
  const [activeLibrary, setActiveLibrary] = useState<LibraryTab>('project');
  const [desktopWindows, setDesktopWindows] = useState<Record<DesktopWindowKey, DesktopWindowState>>(DEFAULT_WINDOWS);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [highestZ, setHighestZ] = useState(3);
  const [openMenu, setOpenMenu] = useState<'file' | 'edit' | 'view' | 'help' | null>(null);
  const [openCascade, setOpenCascade] = useState<'view-windows' | null>(null);
  const [helpMessage, setHelpMessage] = useState('Tip: use View → Reset layout if windows overlap.');
  const menuRef = useRef<HTMLDivElement | null>(null);
  const desktopRef = useRef<HTMLElement | null>(null);

  const clauseMap = useMemo(() => new Map((clauses || []).map((clause) => [String(clause.id), clause])), [clauses]);
  const sections = document?.structure?.sections || [];

  useEffect(() => {
    const firstBlockId = getFirstBlockId(document);
    if (firstBlockId) {
      dispatch({ type: 'initialize_selection', blockId: firstBlockId });
    }
  }, [document?.id]);

  const maybeGetDockSlot = (clientX: number, clientY: number): DockSlot | null => {
    const bounds = desktopRef.current?.getBoundingClientRect();
    if (!bounds) return null;

    const relativeX = clientX - bounds.left;
    const relativeY = clientY - bounds.top;
    const snapDistance = 140;
    const topSnapBand = Math.min(180, bounds.height * 0.3);

    if (relativeX <= snapDistance) return 'left';
    if (relativeX >= bounds.width - snapDistance) return 'right';
    if (relativeY <= topSnapBand) {
      if (relativeX < bounds.width * 0.33) return 'left';
      if (relativeX > bounds.width * 0.66) return 'right';
      return 'center';
    }
    return null;
  };

  const dockWindowToSlot = (key: DesktopWindowKey, slot: DockSlot) => {
    setDesktopWindows((prev) => {
      const current = prev[key];
      const next: Record<DesktopWindowKey, DesktopWindowState> = {
        ...prev,
        [key]: { ...current, docked: true, dockSlot: slot }
      };

      const conflictKey = (Object.keys(prev) as DesktopWindowKey[]).find((candidate) => (
        candidate !== key && prev[candidate].docked && prev[candidate].dockSlot === slot
      ));

      if (!conflictKey) return next;
      if (current.docked) {
        next[conflictKey] = { ...prev[conflictKey], dockSlot: current.dockSlot };
      } else {
        next[conflictKey] = { ...prev[conflictKey], docked: false };
      }
      return next;
    });
    setHelpMessage(`${key} snapped to ${slot} dock.`);
  };

  useEffect(() => {
    if (!dragState) return;

    const onPointerMove = (event: PointerEvent) => {
      const desktopBounds = desktopRef.current?.getBoundingClientRect();
      const maxX = desktopBounds ? Math.max(0, desktopBounds.width - 260) : Number.POSITIVE_INFINITY;
      const maxY = desktopBounds ? Math.max(0, desktopBounds.height - 120) : Number.POSITIVE_INFINITY;
      setDesktopWindows((prev) => ({
        ...prev,
        [dragState.key]: {
          ...prev[dragState.key],
          x: Math.min(maxX, Math.max(0, dragState.originX + event.clientX - dragState.startX)),
          y: Math.min(maxY, Math.max(0, dragState.originY + event.clientY - dragState.startY)),
          docked: false,
          maximized: false
        }
      }));
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId === dragState.pointerId) {
        const dockSlot = maybeGetDockSlot(event.clientX, event.clientY);
        if (dockSlot) {
          dockWindowToSlot(dragState.key, dockSlot);
        } else {
          setDesktopWindows((prev) => ({
            ...prev,
            [dragState.key]: {
              ...prev[dragState.key],
              x: Math.round(prev[dragState.key].x / 12) * 12,
              y: Math.round(prev[dragState.key].y / 12) * 12
            }
          }));
        }
        setDragState(null);
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [dragState]);

  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
        setOpenCascade(null);
      }
    };
    window.addEventListener('mousedown', closeMenus);
    return () => window.removeEventListener('mousedown', closeMenus);
  }, []);

  const selectedBlock = useMemo(() => {
    for (const section of sections) {
      for (const block of section.blocks || []) {
        if (String(block.id) === state.selectedBlockId) {
          return block;
        }
      }
    }
    return null;
  }, [sections, state.selectedBlockId]);

  const projectTreeNodes = useMemo<TreeNodeItem[]>(() => (
    sections.map((section: any) => ({
      id: `section-${section.id}`,
      label: section.title,
      count: (section.blocks || []).length,
      data: { type: 'section', id: String(section.id) },
      children: (section.blocks || []).map((block: any) => ({
        id: `block-${block.id}`,
        label: block.type === 'clause_ref' ? clauseMap.get(String(block.clause_id))?.title || 'Clause block' : 'Custom block',
        data: { type: 'block', id: String(block.id), sectionId: String(section.id) }
      }))
    }))
  ), [sections, clauseMap]);

  const sharedLibraryNodes = useMemo<Record<Exclude<LibraryTab, 'project'>, TreeNodeItem[]>>(() => ({
    clauses: [
      { id: 'cl-generic', label: 'General', count: 12, children: [{ id: 'cl-g1', label: 'Project Description' }, { id: 'cl-g2', label: 'Compliance Notes' }] },
      { id: 'cl-walls', label: 'External Walls', count: 8, children: [{ id: 'cl-w1', label: 'Cavity wall build-up' }, { id: 'cl-w2', label: 'Facing brick finish' }] }
    ],
    assembly: [
      { id: 'as-wall', label: 'Wall Assemblies', count: 6, children: [{ id: 'as-w1', label: 'Party Wall Robust' }, { id: 'as-w2', label: 'Lightweight Partition' }] }
    ],
    materials: [
      { id: 'ma-insulation', label: 'Insulation', count: 4, children: [{ id: 'ma-i1', label: 'PIR board 100mm' }, { id: 'ma-i2', label: 'Mineral wool 50mm' }] }
    ],
    products: [
      { id: 'pr-bricks', label: 'Brick Products', count: 5, children: [{ id: 'pr-b1', label: 'Facing brick A' }, { id: 'pr-b2', label: 'Facing brick B' }] }
    ]
  }), []);

  const activeNodes = activeLibrary === 'project' ? projectTreeNodes : sharedLibraryNodes[activeLibrary];
  const visibleWindowCount = (Object.values(desktopWindows) as DesktopWindowState[]).filter((windowState) => windowState.visible && !windowState.minimized).length;
  const minimizedKeys = WINDOW_KEYS.filter((key) => desktopWindows[key].visible && desktopWindows[key].minimized);

  const updateSelectedBlock = (updater: (block: any) => any) => {
    if (!document || !state.selectedBlockId) return;
    const nextDocument = updateDocumentBlock(document, state.selectedBlockId, updater);
    setDocument(nextDocument);
    saveDocumentDebounced();
  };

  const bringToFront = (key: DesktopWindowKey) => {
    setHighestZ((current) => {
      const next = current + 1;
      setDesktopWindows((prev) => ({ ...prev, [key]: { ...prev[key], z: next } }));
      return next;
    });
  };

  const setWindowVisibility = (key: DesktopWindowKey, visible: boolean) => {
    setDesktopWindows((prev) => ({ ...prev, [key]: { ...prev[key], visible, minimized: false } }));
    if (visible) {
      bringToFront(key);
    }
  };

  const minimizeWindow = (key: DesktopWindowKey) => {
    setDesktopWindows((prev) => ({ ...prev, [key]: { ...prev[key], minimized: true, maximized: false } }));
    setHelpMessage(`${key} minimized.`);
  };

  const restoreWindow = (key: DesktopWindowKey) => {
    setDesktopWindows((prev) => ({ ...prev, [key]: { ...prev[key], visible: true, minimized: false } }));
    bringToFront(key);
  };

  const toggleMaximizeWindow = (key: DesktopWindowKey) => {
    setDesktopWindows((prev) => {
      const current = prev[key];
      if (current.maximized) {
        return {
          ...prev,
          [key]: {
            ...current,
            maximized: false,
            ...(current.restore || {})
          }
        };
      }

      return {
        ...prev,
        [key]: {
          ...current,
          minimized: false,
          maximized: true,
          docked: false,
          restore: {
            x: current.x,
            y: current.y,
            docked: current.docked,
            dockSlot: current.dockSlot
          }
        }
      };
    });
    bringToFront(key);
  };

  const resetLayout = () => {
    setDesktopWindows(DEFAULT_WINDOWS);
    setHighestZ(3);
    setHelpMessage('Layout reset. All windows restored.');
  };

  const showAllWindows = () => {
    setDesktopWindows((prev) => {
      const next: Record<DesktopWindowKey, DesktopWindowState> = { ...prev };
      (Object.keys(prev) as DesktopWindowKey[]).forEach((key) => {
        next[key] = { ...prev[key], visible: true, minimized: false };
      });
      return next;
    });
    setHelpMessage('All windows shown.');
  };

  const cascadeWindows = () => {
    setDesktopWindows((prev) => {
      const next: Record<DesktopWindowKey, DesktopWindowState> = { ...prev };
      WINDOW_KEYS.forEach((key, index) => {
        next[key] = {
          ...prev[key],
          visible: true,
          minimized: false,
          maximized: false,
          docked: false,
          x: 24 + index * 44,
          y: 24 + index * 40,
          z: highestZ + index + 1
        };
      });
      return next;
    });
    setHighestZ((value) => value + WINDOW_KEYS.length + 1);
    setHelpMessage('Windows cascaded.');
  };

  const closeWindow = (key: DesktopWindowKey) => {
    setDesktopWindows((prev) => ({ ...prev, [key]: { ...prev[key], visible: false, minimized: false, maximized: false } }));
    setHelpMessage(`${key} window closed. Use View → Windows to show it again.`);
  };

  const getWindowStyle = (key: DesktopWindowKey) => {
    const state = desktopWindows[key];
    if (state.maximized) {
      return { left: 12, right: 12, top: 12, bottom: minimizedKeys.length ? 54 : 12, zIndex: state.z };
    }
    if (!state.docked) {
      return { left: state.x, top: state.y, zIndex: state.z };
    }

    if (state.dockSlot === 'left') {
      return { left: 12, top: 12, bottom: 12, width: 'clamp(260px, 22%, 320px)', zIndex: state.z };
    }
    if (state.dockSlot === 'center') {
      return {
        left: 'calc(clamp(260px, 22%, 320px) + 20px)',
        top: 12,
        bottom: 12,
        right: 'calc(clamp(280px, 24%, 360px) + 20px)',
        minWidth: 340,
        zIndex: state.z
      };
    }
    return { right: 12, top: 12, bottom: 12, width: 'clamp(280px, 24%, 360px)', zIndex: state.z };
  };

  const handleTreeSelection = (node: TreeNodeItem) => {
    if (node.data?.type === 'block') {
      dispatch({ type: 'select_block', blockId: node.data.id });
    }
    if (node.data?.type === 'section') {
      const section = sections.find((item: any) => String(item.id) === node.data.id);
      const blockId = section?.blocks?.[0]?.id;
      if (blockId) {
        dispatch({ type: 'select_block', blockId: String(blockId) });
      }
    }
  };

  const reorderProjectTree = (fromId: string, toId: string) => {
    if (!document) return;

    if (fromId.startsWith('section-') && toId.startsWith('section-')) {
      const nextSections = reorderById(sections, fromId.replace('section-', ''), toId.replace('section-', ''));
      setDocument({ ...document, structure: { ...document.structure, sections: nextSections } });
      saveDocumentDebounced();
      return;
    }

    if (fromId.startsWith('block-') && toId.startsWith('block-')) {
      const sourceBlockId = fromId.replace('block-', '');
      const targetBlockId = toId.replace('block-', '');
      const nextSections = sections.map((section: any) => {
        const hasSource = (section.blocks || []).some((block: any) => String(block.id) === sourceBlockId);
        const hasTarget = (section.blocks || []).some((block: any) => String(block.id) === targetBlockId);
        if (!hasSource || !hasTarget) return section;
        return { ...section, blocks: reorderById(section.blocks || [], sourceBlockId, targetBlockId) };
      });
      setDocument({ ...document, structure: { ...document.structure, sections: nextSections } });
      saveDocumentDebounced();
    }
  };

  if (loading) {
    return <AppShell><section className="panel"><p>Loading editor…</p></section></AppShell>;
  }

  if (error || !document) {
    return <AppShell><section className="panel error-panel"><p>{error || 'Document not found'}</p><Link to="/"><button className="ghost">Back</button></Link></section></AppShell>;
  }

  return (
    <AppShell
      header={(
        <>
          <header className="topbar panel">
            <div>
              <h1>{document.title}</h1>
              <p>{saveState}</p>
            </div>
            <div className="row">
              <Link to="/"><button className="ghost">Dashboard</button></Link>
              <button onClick={() => saveDocumentDebounced({ immediate: true })}>Save now</button>
            </div>
          </header>

          <div className="panel windows-menubar" ref={menuRef}>
            <div className="menu-root">
              <button type="button" className="menu-trigger" onClick={() => { setOpenCascade(null); setOpenMenu((value) => (value === 'file' ? null : 'file')); }}>File</button>
              {openMenu === 'file' ? (
                <div className="menu-dropdown">
                  <button type="button" className="menu-item" onClick={() => { saveDocumentDebounced({ immediate: true }); setOpenMenu(null); }}>Save</button>
                  <Link to="/"><button type="button" className="menu-item">Exit to dashboard</button></Link>
                </div>
              ) : null}
            </div>

            <div className="menu-root">
              <button type="button" className="menu-trigger" onClick={() => { setOpenCascade(null); setOpenMenu((value) => (value === 'edit' ? null : 'edit')); }}>Edit</button>
              {openMenu === 'edit' ? (
                <div className="menu-dropdown">
                  <button type="button" className="menu-item" onClick={() => { dispatch({ type: 'toggle_clause_picker', open: true }); setOpenMenu(null); }}>Change clause in selected block</button>
                </div>
              ) : null}
            </div>

            <div className="menu-root">
              <button type="button" className="menu-trigger" onClick={() => setOpenMenu((value) => (value === 'view' ? null : 'view'))}>View</button>
              {openMenu === 'view' ? (
                <div className="menu-dropdown">
                  <div
                    className="menu-cascade"
                    onMouseEnter={() => setOpenCascade('view-windows')}
                    onMouseLeave={() => setOpenCascade((value) => (value === 'view-windows' ? null : value))}
                  >
                    <button type="button" className="menu-item menu-item-cascade" onClick={() => setOpenCascade((value) => (value === 'view-windows' ? null : 'view-windows'))}>
                      Windows ▸
                    </button>
                    {openCascade === 'view-windows' ? (
                      <div className="menu-dropdown menu-dropdown-cascade">
                        {WINDOW_KEYS.map((key) => (
                          <button key={key} type="button" className="menu-item" onClick={() => setWindowVisibility(key, !desktopWindows[key].visible)}>
                            {desktopWindows[key].visible && !desktopWindows[key].minimized ? '✓' : ''} {key}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <button type="button" className="menu-item" onClick={() => { cascadeWindows(); setOpenMenu(null); setOpenCascade(null); }}>Cascade windows</button>
                  <button type="button" className="menu-item" onClick={() => { showAllWindows(); setOpenMenu(null); setOpenCascade(null); }}>Show all windows</button>
                  <button type="button" className="menu-item" onClick={() => { resetLayout(); setOpenMenu(null); setOpenCascade(null); }}>Reset layout</button>
                </div>
              ) : null}
            </div>

            <div className="menu-root">
              <button type="button" className="menu-trigger" onClick={() => { setOpenCascade(null); setOpenMenu((value) => (value === 'help' ? null : 'help')); }}>Help</button>
              {openMenu === 'help' ? (
                <div className="menu-dropdown">
                  <button type="button" className="menu-item" onClick={() => { setHelpMessage('Drag a window to the left, right, or top edge to dock. Drag away from edge to float. Use View → Windows to show/hide panes.'); setOpenMenu(null); }}>Window controls</button>
                  <button type="button" className="menu-item" onClick={() => { setHelpMessage('Spec Writer desktop workspace using standard desktop dock + cascade menu patterns.'); setOpenMenu(null); }}>About</button>
                </div>
              ) : null}
            </div>

            <p className="muted windows-help-copy">{helpMessage}</p>
          </div>
        </>
      )}
    >
      <section className="windows-desktop" ref={desktopRef}>
        {visibleWindowCount === 0 ? (
          <div className="panel windows-empty-state">
            <p>All editor windows are hidden.</p>
            <div className="row">
              <button type="button" onClick={() => resetLayout()}>Restore default layout</button>
              <button
                type="button"
                className="ghost"
                onClick={() => showAllWindows()}
              >
                Show all windows
              </button>
            </div>
          </div>
        ) : null}

        {desktopWindows.library.visible && !desktopWindows.library.minimized ? (
          <aside
            className="panel app-window app-window-library"
            style={getWindowStyle('library')}
            onPointerDown={() => bringToFront('library')}
          >
            <div
              className="window-titlebar draggable"
              onPointerDown={(event) => {
                event.preventDefault();
                bringToFront('library');
                if (desktopWindows.library.maximized) return;
                setDragState({ key: 'library', pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: desktopWindows.library.x, originY: desktopWindows.library.y });
              }}
            >
              <span>Library browser</span>
              <div className="window-controls">
                <button type="button" className="window-control" aria-label="Minimize library browser" onPointerDown={(event) => event.stopPropagation()} onClick={() => minimizeWindow('library')}>—</button>
                <button type="button" className="window-control" aria-label="Maximize library browser" onPointerDown={(event) => event.stopPropagation()} onClick={() => toggleMaximizeWindow('library')}>{desktopWindows.library.maximized ? '❐' : '□'}</button>
                <button type="button" className="window-close" aria-label="Close library browser" onPointerDown={(event) => event.stopPropagation()} onClick={() => closeWindow('library')}>×</button>
              </div>
            </div>
            <div className="left-tabs">
              {LIBRARY_TABS.map((tab) => (
                <button key={tab} type="button" className={activeLibrary === tab ? 'active ghost' : 'ghost'} onClick={() => setActiveLibrary(tab)}>
                  {tab}
                </button>
              ))}
            </div>
            <TreeMenu
              title={activeLibrary === 'project' ? 'Project Library' : `${activeLibrary} library`}
              nodes={activeNodes}
              selectedNodeId={state.selectedBlockId ? `block-${state.selectedBlockId}` : ''}
              onSelectNode={handleTreeSelection}
              onReorder={activeLibrary === 'project' ? reorderProjectTree : undefined}
              getNodeActions={(node) => {
                if (activeLibrary === 'project' && node.data?.type === 'block') {
                  return [
                    { label: 'Edit block', onClick: () => dispatch({ type: 'select_block', blockId: node.data.id }) },
                    { label: 'Swap clause', onClick: () => dispatch({ type: 'toggle_clause_picker', open: true }) }
                  ];
                }
                return [{ label: 'Open item', onClick: () => handleTreeSelection(node) }];
              }}
            />
          </aside>
        ) : null}

        {desktopWindows.browser.visible && !desktopWindows.browser.minimized ? (
          <section
            className="panel app-window app-window-browser"
            style={getWindowStyle('browser')}
            onPointerDown={() => bringToFront('browser')}
          >
            <div
              className="window-titlebar draggable"
              onPointerDown={(event) => {
                event.preventDefault();
                bringToFront('browser');
                if (desktopWindows.browser.maximized) return;
                setDragState({ key: 'browser', pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: desktopWindows.browser.x, originY: desktopWindows.browser.y });
              }}
            >
              <span>Document browser</span>
              <div className="window-controls">
                <button type="button" className="window-control" aria-label="Minimize document browser" onPointerDown={(event) => event.stopPropagation()} onClick={() => minimizeWindow('browser')}>—</button>
                <button type="button" className="window-control" aria-label="Maximize document browser" onPointerDown={(event) => event.stopPropagation()} onClick={() => toggleMaximizeWindow('browser')}>{desktopWindows.browser.maximized ? '❐' : '□'}</button>
                <button type="button" className="window-close" aria-label="Close document browser" onPointerDown={(event) => event.stopPropagation()} onClick={() => closeWindow('browser')}>×</button>
              </div>
            </div>
            <Canvas
              sections={sections}
              clauseMap={clauseMap}
              variableValues={document.variable_values || {}}
              selectedBlockId={state.selectedBlockId}
              onSelectBlock={(blockId) => dispatch({ type: 'select_block', blockId })}
              compact
            />
          </section>
        ) : null}

        {desktopWindows.properties.visible && !desktopWindows.properties.minimized ? (
          <aside
            className="panel app-window app-window-properties"
            style={getWindowStyle('properties')}
            onPointerDown={() => bringToFront('properties')}
          >
            <div
              className="window-titlebar draggable"
              onPointerDown={(event) => {
                event.preventDefault();
                bringToFront('properties');
                if (desktopWindows.properties.maximized) return;
                setDragState({ key: 'properties', pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: desktopWindows.properties.x, originY: desktopWindows.properties.y });
              }}
            >
              <span>Properties</span>
              <div className="window-controls">
                <button type="button" className="window-control" aria-label="Minimize properties" onPointerDown={(event) => event.stopPropagation()} onClick={() => minimizeWindow('properties')}>—</button>
                <button type="button" className="window-control" aria-label="Maximize properties" onPointerDown={(event) => event.stopPropagation()} onClick={() => toggleMaximizeWindow('properties')}>{desktopWindows.properties.maximized ? '❐' : '□'}</button>
                <button type="button" className="window-close" aria-label="Close properties" onPointerDown={(event) => event.stopPropagation()} onClick={() => closeWindow('properties')}>×</button>
              </div>
            </div>
            <Inspector
              className="window-inspector"
              document={document}
              selectedBlock={selectedBlock}
              clauseMap={clauseMap}
              onSelectedBodyChange={(body) => {
                updateSelectedBlock((block) => (
                  block.type === 'clause_ref'
                    ? { ...block, overrides: { ...(block.overrides || {}), body } }
                    : { ...block, body }
                ));
              }}
              onSelectedLevelChange={(level) => {
                updateSelectedBlock((block) => ({ ...block, level }));
              }}
              onOpenClausePicker={() => dispatch({ type: 'toggle_clause_picker', open: true })}
            />
          </aside>
        ) : null}
      </section>
      {minimizedKeys.length ? (
        <div className="panel windows-taskbar">
          {minimizedKeys.map((key) => (
            <button key={key} type="button" className="ghost taskbar-item" onClick={() => restoreWindow(key)}>
              Restore {key}
            </button>
          ))}
        </div>
      ) : null}

      <ClausePickerModal
        clauses={clauses}
        open={state.clausePickerOpen}
        onClose={() => dispatch({ type: 'toggle_clause_picker', open: false })}
        onPickClause={(clauseId) => {
          updateSelectedBlock((block) => ({ ...block, clause_id: clauseId }));
          dispatch({ type: 'toggle_clause_picker', open: false });
        }}
      />
    </AppShell>
  );
}
