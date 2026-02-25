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

type DesktopWindowState = {
  x: number;
  y: number;
  z: number;
  visible: boolean;
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
const DEFAULT_WINDOWS: Record<DesktopWindowKey, DesktopWindowState> = {
  library: { x: 16, y: 16, z: 1, visible: true },
  browser: { x: 336, y: 16, z: 2, visible: true },
  properties: { x: 980, y: 16, z: 3, visible: true }
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
  const [helpMessage, setHelpMessage] = useState('Tip: use View → Reset layout if windows overlap.');
  const menuRef = useRef<HTMLDivElement | null>(null);

  const clauseMap = useMemo(() => new Map((clauses || []).map((clause) => [String(clause.id), clause])), [clauses]);
  const sections = document?.structure?.sections || [];

  useEffect(() => {
    const firstBlockId = getFirstBlockId(document);
    if (firstBlockId) {
      dispatch({ type: 'initialize_selection', blockId: firstBlockId });
    }
  }, [document?.id]);

  useEffect(() => {
    if (!dragState) return;

    const onPointerMove = (event: PointerEvent) => {
      setDesktopWindows((prev) => ({
        ...prev,
        [dragState.key]: {
          ...prev[dragState.key],
          x: Math.max(0, dragState.originX + event.clientX - dragState.startX),
          y: Math.max(0, dragState.originY + event.clientY - dragState.startY)
        }
      }));
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId === dragState.pointerId) {
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
    setDesktopWindows((prev) => ({ ...prev, [key]: { ...prev[key], visible } }));
    if (visible) {
      bringToFront(key);
    }
  };

  const resetLayout = () => {
    setDesktopWindows(DEFAULT_WINDOWS);
    setHighestZ(3);
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
              <button type="button" className="ghost" onClick={() => setOpenMenu((value) => (value === 'file' ? null : 'file'))}>File</button>
              {openMenu === 'file' ? (
                <div className="menu-dropdown">
                  <button type="button" className="ghost" onClick={() => { saveDocumentDebounced({ immediate: true }); setOpenMenu(null); }}>Save</button>
                  <Link to="/"><button type="button" className="ghost">Exit to dashboard</button></Link>
                </div>
              ) : null}
            </div>

            <div className="menu-root">
              <button type="button" className="ghost" onClick={() => setOpenMenu((value) => (value === 'edit' ? null : 'edit'))}>Edit</button>
              {openMenu === 'edit' ? (
                <div className="menu-dropdown">
                  <button type="button" className="ghost" onClick={() => { dispatch({ type: 'toggle_clause_picker', open: true }); setOpenMenu(null); }}>Change clause in selected block</button>
                </div>
              ) : null}
            </div>

            <div className="menu-root">
              <button type="button" className="ghost" onClick={() => setOpenMenu((value) => (value === 'view' ? null : 'view'))}>View</button>
              {openMenu === 'view' ? (
                <div className="menu-dropdown">
                  {(['library', 'browser', 'properties'] as DesktopWindowKey[]).map((key) => (
                    <button key={key} type="button" className="ghost" onClick={() => setWindowVisibility(key, !desktopWindows[key].visible)}>
                      {desktopWindows[key].visible ? 'Hide' : 'Show'} {key}
                    </button>
                  ))}
                  <button type="button" className="ghost" onClick={() => { resetLayout(); setOpenMenu(null); }}>Reset layout</button>
                </div>
              ) : null}
            </div>

            <div className="menu-root">
              <button type="button" className="ghost" onClick={() => setOpenMenu((value) => (value === 'help' ? null : 'help'))}>Help</button>
              {openMenu === 'help' ? (
                <div className="menu-dropdown">
                  <button type="button" className="ghost" onClick={() => { setHelpMessage('Drag windows by their title bars. Use View to hide/show tools.'); setOpenMenu(null); }}>Window controls</button>
                  <button type="button" className="ghost" onClick={() => { setHelpMessage('Spec Writer desktop prototype inspired by classic Windows UI patterns.'); setOpenMenu(null); }}>About</button>
                </div>
              ) : null}
            </div>

            <p className="muted windows-help-copy">{helpMessage}</p>
          </div>
        </>
      )}
    >
      <section className="windows-desktop">
        {desktopWindows.library.visible ? (
          <aside
            className="panel app-window app-window-library"
            style={{ left: desktopWindows.library.x, top: desktopWindows.library.y, zIndex: desktopWindows.library.z }}
            onPointerDown={() => bringToFront('library')}
          >
            <div
              className="window-titlebar draggable"
              onPointerDown={(event) => {
                event.preventDefault();
                bringToFront('library');
                setDragState({ key: 'library', pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: desktopWindows.library.x, originY: desktopWindows.library.y });
              }}
            >
              Library browser
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

        {desktopWindows.browser.visible ? (
          <section
            className="panel app-window app-window-browser"
            style={{ left: desktopWindows.browser.x, top: desktopWindows.browser.y, zIndex: desktopWindows.browser.z }}
            onPointerDown={() => bringToFront('browser')}
          >
            <div
              className="window-titlebar draggable"
              onPointerDown={(event) => {
                event.preventDefault();
                bringToFront('browser');
                setDragState({ key: 'browser', pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: desktopWindows.browser.x, originY: desktopWindows.browser.y });
              }}
            >
              Document browser
            </div>
            <Canvas
              sections={sections}
              clauseMap={clauseMap}
              variableValues={document.variable_values || {}}
              selectedBlockId={state.selectedBlockId}
              onSelectBlock={(blockId) => dispatch({ type: 'select_block', blockId })}
            />
          </section>
        ) : null}

        {desktopWindows.properties.visible ? (
          <aside
            className="panel app-window app-window-properties"
            style={{ left: desktopWindows.properties.x, top: desktopWindows.properties.y, zIndex: desktopWindows.properties.z }}
            onPointerDown={() => bringToFront('properties')}
          >
            <div
              className="window-titlebar draggable"
              onPointerDown={(event) => {
                event.preventDefault();
                bringToFront('properties');
                setDragState({ key: 'properties', pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: desktopWindows.properties.x, originY: desktopWindows.properties.y });
              }}
            >
              Properties
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
