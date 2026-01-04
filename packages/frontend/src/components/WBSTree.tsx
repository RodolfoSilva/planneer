import { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, Edit2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WBS } from '@planneer/shared';

interface WBSTreeProps {
  wbsItems: WBS[];
  onAdd?: (parentId: string | null) => void;
  onEdit?: (wbs: WBS) => void;
  onDelete?: (wbs: WBS) => void;
  selectedWbsId?: string | null;
  onSelect?: (wbsId: string | null) => void;
}

interface WBSNode extends WBS {
  children?: WBSNode[];
  activities?: any[];
}

// Build tree structure from flat array
function buildTree(items: WBS[]): WBSNode[] {
  const map = new Map<string, WBSNode>();
  const roots: WBSNode[] = [];

  // Create map of all items
  items.forEach(item => {
    map.set(item.id, { ...item, children: [] });
  });

  // Build tree
  items.forEach(item => {
    const node = map.get(item.id)!;
    if (item.parentId) {
      const parent = map.get(item.parentId);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  // Sort children by sortOrder
  const sortChildren = (nodes: WBSNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    nodes.forEach(node => {
      if (node.children) {
        sortChildren(node.children);
      }
    });
  };

  sortChildren(roots);
  return roots;
}

function WBSTreeNode({
  node,
  level = 0,
  expanded,
  onToggle,
  onAdd,
  onEdit,
  onDelete,
  selectedWbsId,
  onSelect,
}: {
  node: WBSNode;
  level?: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onAdd?: (parentId: string | null) => void;
  onEdit?: (wbs: WBS) => void;
  onDelete?: (wbs: WBS) => void;
  selectedWbsId?: string | null;
  onSelect?: (wbsId: string | null) => void;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedWbsId === node.id;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-50 transition-colors group",
          isSelected && "bg-primary-50 border border-primary-200"
        )}
        style={{ paddingLeft: `${level * 1.5 + 0.75}rem` }}
      >
        {/* Expand/Collapse button */}
        <button
          onClick={() => onToggle(node.id)}
          className={cn(
            "w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200 transition-colors",
            !hasChildren && "invisible"
          )}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          )}
        </button>

        {/* Icon */}
        <div className="flex-shrink-0">
          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-primary-500" />
          ) : (
            <Folder className="w-4 h-4 text-slate-400" />
          )}
        </div>

        {/* Content */}
        <div
          className="flex-1 flex items-center gap-2 cursor-pointer min-w-0"
          onClick={() => onSelect?.(node.id)}
        >
          <span className="text-sm font-mono text-slate-600 font-medium">
            {node.code}
          </span>
          <span className="text-sm text-slate-900 truncate">
            {node.name}
          </span>
          {node.activities && node.activities.length > 0 && (
            <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              {node.activities.length}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdd?.(node.id);
            }}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
            title="Adicionar filho"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(node);
            }}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
            title="Editar"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(node);
            }}
            className="p-1.5 rounded hover:bg-red-100 text-red-600 hover:text-red-700 transition-colors"
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <WBSTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              expanded={expanded}
              onToggle={onToggle}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
              selectedWbsId={selectedWbsId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function WBSTree({
  wbsItems,
  onAdd,
  onEdit,
  onDelete,
  selectedWbsId,
  onSelect,
}: WBSTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpanded(newExpanded);
  };

  const tree = buildTree(wbsItems);

  if (tree.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500">
        <Folder className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p className="text-sm">Nenhuma WBS cadastrada</p>
        <button
          onClick={() => onAdd?.(null)}
          className="mt-4 btn-primary text-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar primeira WBS
        </button>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg bg-white">
      <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Estrutura WBS</h3>
        <button
          onClick={() => onAdd?.(null)}
          className="btn-primary text-xs py-1 px-2"
        >
          <Plus className="w-3 h-3 mr-1" />
          Adicionar
        </button>
      </div>
      <div className="divide-y divide-slate-100">
        {tree.map((node) => (
          <WBSTreeNode
            key={node.id}
            node={node}
            expanded={expanded}
            onToggle={toggleExpanded}
            onAdd={onAdd}
            onEdit={onEdit}
            onDelete={onDelete}
            selectedWbsId={selectedWbsId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

