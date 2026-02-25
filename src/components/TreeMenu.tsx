import { useEffect, useMemo, useState } from 'react';

export type TreeNodeItem = {
  id: string;
  label: string;
  count?: number;
  children?: TreeNodeItem[];
  data?: any;
};

type TreeAction = {
  label: string;
  onClick: () => void;
  danger?: boolean;
};

type ContextMenuState = {
  x: number;
  y: number;
  nodeId: string;
};

type TreeMenuProps = {
  title: string;
  nodes: TreeNodeItem[];
  selectedNodeId?: string;
  onSelectNode?: (node: TreeNodeItem) => void;
  onReorder?: (fromId: string, toId: string) => void;
  getNodeActions?: (node: TreeNodeItem) => TreeAction[];
};

function flattenNodeMap(nodes: TreeNodeItem[], map = new Map<string, TreeNodeItem>()) {
  nodes.forEach((node) => {
    map.set(node.id, node);
    flattenNodeMap(node.children || [], map);
  });
  return map;
}

function collectExpandableIds(nodes: TreeNodeItem[], store = new Set<string>()) {
  nodes.forEach((node) => {
    if ((node.children || []).length > 0) {
      store.add(node.id);
      collectExpandableIds(node.children || [], store);
    }
  });
  return store;
}

function findSiblingIds(nodes: TreeNodeItem[], targetId: string): string[] {
  for (const node of nodes) {
    if ((node.children || []).some((child) => child.id === targetId)) {
      return (node.children || []).map((child) => child.id);
    }

    const nested = findSiblingIds(node.children || [], targetId);
    if (nested.length > 0) return nested;
  }

  if (nodes.some((node) => node.id === targetId)) {
    return nodes.map((node) => node.id);
  }

  return [];
}

function TreeMenuNode({
  node,
  depth,
  selectedNodeId,
  expanded,
  setExpanded,
  onSelectNode,
  onDragStart,
  onDropOnNode,
  onOpenContextMenu
}: any) {
  const hasChildren = (node.children || []).length > 0;
  const isExpanded = expanded.has(node.id);

  return (
    <div className="tree-node-row" style={{ '--tree-depth': depth } as any}>
      <div
        role="button"
        tabIndex={0}
        className={`tree-node-button ${selectedNodeId === node.id ? 'active' : ''}`}
        draggable
        onClick={() => onSelectNode?.(node)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelectNode?.(node);
          }
        }}
        onDragStart={() => onDragStart(node.id)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => onDropOnNode(node.id)}
        onContextMenu={(event) => {
          event.preventDefault();
          onOpenContextMenu(event.clientX, event.clientY, node.id);
        }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="tree-expander"
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((prev: Set<string>) => {
                const next = new Set(prev);
                if (next.has(node.id)) {
                  next.delete(node.id);
                } else {
                  next.add(node.id);
                }
                return next;
              });
            }}
          >
            {isExpanded ? '▾' : '▸'}
          </button>
        ) : <span className="tree-expander-placeholder" />} 
        <span className="tree-node-label">{node.label}</span>
        {typeof node.count === 'number' ? <span className="tree-node-count">{node.count}</span> : null}
      </div>

      {hasChildren && isExpanded ? (
        <div className="tree-node-children">
          {node.children.map((child: TreeNodeItem) => (
            <TreeMenuNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedNodeId={selectedNodeId}
              expanded={expanded}
              setExpanded={setExpanded}
              onSelectNode={onSelectNode}
              onDragStart={onDragStart}
              onDropOnNode={onDropOnNode}
              onOpenContextMenu={onOpenContextMenu}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function TreeMenu({
  title,
  nodes,
  selectedNodeId,
  onSelectNode,
  onReorder,
  getNodeActions
}: TreeMenuProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dragNodeId, setDragNodeId] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const nodeMap = useMemo(() => flattenNodeMap(nodes), [nodes]);

  useEffect(() => {
    setExpanded(collectExpandableIds(nodes));
  }, [nodes]);

  useEffect(() => {
    const closeContext = () => setContextMenu(null);
    window.addEventListener('click', closeContext);
    return () => window.removeEventListener('click', closeContext);
  }, []);

  const contextNode = contextMenu ? nodeMap.get(contextMenu.nodeId) : null;
  const actions = contextNode && getNodeActions ? getNodeActions(contextNode) : [];

  return (
    <section className="tree-menu-panel">
      <div className="tree-menu-title-row">
        <h2>{title}</h2>
      </div>

      <div className="tree-menu-scroll">
        {nodes.map((node) => (
          <TreeMenuNode
            key={node.id}
            node={node}
            depth={0}
            selectedNodeId={selectedNodeId}
            expanded={expanded}
            setExpanded={setExpanded}
            onSelectNode={onSelectNode}
            onDragStart={(nodeId: string) => setDragNodeId(nodeId)}
            onDropOnNode={(nodeId: string) => {
              if (!dragNodeId || dragNodeId === nodeId) return;
              const siblings = findSiblingIds(nodes, nodeId);
              if (!siblings.includes(dragNodeId)) return;
              onReorder?.(dragNodeId, nodeId);
              setDragNodeId('');
            }}
            onOpenContextMenu={(x: number, y: number, nodeId: string) => {
              if (!getNodeActions) return;
              setContextMenu({ x, y, nodeId });
            }}
          />
        ))}
        {nodes.length === 0 ? <p className="muted">No items yet.</p> : null}
      </div>

      {contextMenu && contextNode && actions.length > 0 ? (
        <div className="tree-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={`tree-context-action ${action.danger ? 'danger' : ''}`}
              onClick={() => {
                action.onClick();
                setContextMenu(null);
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
