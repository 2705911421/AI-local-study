import { memo, useCallback, useMemo, useState } from "react";
import {
  CaretDown,
  CaretRight,
  DotsThreeVertical,
  FileText,
  Sparkle,
  Trash,
  TreeStructure,
} from "@phosphor-icons/react";
import type { MindMap, MindMapNode } from "../../types";

interface MindMapPaneProps {
  mindMap: MindMap | null;
  onGenerate: () => void;
  onDelete: () => void;
  isGenerating: boolean;
}

export const MindMapPane = memo(function MindMapPane({
  mindMap,
  onGenerate,
  onDelete,
  isGenerating,
}: MindMapPaneProps) {
  const [expandedRoots, setExpandedRoots] = useState<Set<string>>(new Set());
  const [showMenu, setShowMenu] = useState(false);

  const toggleRoot = useCallback((nodeId: string) => {
    setExpandedRoots((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const allExpanded = useMemo(() => {
    if (!mindMap) return false;
    return mindMap.rootIds.every((id) => expandedRoots.has(id));
  }, [mindMap, expandedRoots]);

  const expandAll = useCallback(() => {
    if (!mindMap) return;
    setExpandedRoots(new Set(mindMap.rootIds));
  }, [mindMap]);

  const collapseAll = useCallback(() => {
    setExpandedRoots(new Set());
  }, []);

  if (!mindMap) {
    return (
      <div className="mindmap-pane empty">
        <div className="mindmap-empty-state">
          <TreeStructure size={40} weight="thin" />
          <strong>生成思维导图</strong>
          <span>AI 将分析当前章节的内容结构，自动生成知识点层级关系图。</span>
          <button
            type="button"
            className="primary-button"
            onClick={onGenerate}
            disabled={isGenerating}
          >
            <Sparkle size={15} />
            {isGenerating ? "正在生成…" : "生成思维导图"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mindmap-pane">
      <div className="mindmap-header">
        <h3>
          <TreeStructure size={16} />
          {mindMap.title}
        </h3>
        <div className="mindmap-header-actions">
          <button
            type="button"
            onClick={allExpanded ? collapseAll : expandAll}
            title={allExpanded ? "全部折叠" : "全部展开"}
          >
            {allExpanded ? <CaretRight size={14} /> : <CaretDown size={14} />}
            {allExpanded ? "折叠" : "展开"}
          </button>
          <div className="mindmap-menu-wrapper">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              aria-label="思维导图操作"
            >
              <DotsThreeVertical size={16} />
            </button>
            {showMenu && (
              <div className="mindmap-menu">
                <button
                  type="button"
                  onClick={() => {
                    onGenerate();
                    setShowMenu(false);
                  }}
                >
                  <Sparkle size={14} />
                  重新生成
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    onDelete();
                    setShowMenu(false);
                  }}
                >
                  <Trash size={14} />
                  删除
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mindmap-content">
        {mindMap.rootIds.map((rootId) => {
          const rootNode = mindMap.nodes[rootId];
          if (!rootNode) return null;
          return (
            <MindMapNodeView
              key={rootId}
              node={rootNode}
              nodes={mindMap.nodes}
              depth={0}
              isExpanded={expandedRoots.has(rootId)}
              onToggle={() => toggleRoot(rootId)}
            />
          );
        })}
      </div>
    </div>
  );
});

// ─── Recursive node renderer ───

interface MindMapNodeViewProps {
  node: MindMapNode;
  nodes: Record<string, MindMapNode>;
  depth: number;
  isExpanded: boolean;
  onToggle: () => void;
}

const MindMapNodeView = memo(function MindMapNodeView({
  node,
  nodes,
  depth,
  isExpanded,
  onToggle,
}: MindMapNodeViewProps) {
  const hasChildren = node.children.length > 0;
  const indent = depth * 16;

  return (
    <div className="mindmap-node-wrapper">
      <div
        className={`mindmap-node depth-${Math.min(depth, 4)} ${
          hasChildren ? "has-children" : ""
        } ${isExpanded ? "is-expanded" : ""}`}
        style={{ paddingLeft: `${indent + 12}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="mindmap-node-toggle"
            onClick={onToggle}
            aria-label={isExpanded ? "折叠" : "展开"}
          >
            {isExpanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
          </button>
        ) : (
          <span className="mindmap-node-dot" />
        )}
        <span
          className={`mindmap-node-label ${node.color ? `color-${node.color}` : ""}`}
        >
          {node.label}
        </span>
        {node.blockIds && node.blockIds.length > 0 && (
          <span className="mindmap-node-ref" title="关联教材段落">
            <FileText size={10} />
            {node.blockIds.length}
          </span>
        )}
      </div>
      {isExpanded &&
        hasChildren &&
        node.children.map((childId) => {
          const childNode = nodes[childId];
          if (!childNode) return null;
          return (
            <MindMapNodeView
              key={childId}
              node={childNode}
              nodes={nodes}
              depth={depth + 1}
              isExpanded={!childNode.collapsed}
              onToggle={() => {}}
            />
          );
        })}
    </div>
  );
});
