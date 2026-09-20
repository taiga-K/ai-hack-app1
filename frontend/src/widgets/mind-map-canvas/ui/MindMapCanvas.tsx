"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  useStore,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  MIND_MAP_KIND_LABELS,
  MIND_MAP_RELATION_LABELS,
  decorationForMindMapNode,
  describeMindMapNode,
  getMindMapNodePresentation,
  layoutMindMap,
  resolveMindMapVisibility,
  selectedMindMapNode,
  summarizeMindMapBranch,
  summarizeMindMapDecisions,
  type MindMapEdgeKind,
  type MindMapNode,
  type MindMapNodeTone,
  type MindMapSnapshot,
  type MindMapVisibility,
} from "@/entities/mind-map";
import {
  formatUtteranceClock,
  getSpeakerLabel,
  type Utterance,
} from "@/entities/utterance";
import { Button } from "@/shared/ui";
import { cn } from "cn";
import {
  didMindMapPaneWidthChange,
  shouldCommitMindMapCameraMemory,
  shouldDeferMindMapResizeFit,
  shouldRefitMindMapCamera,
  usesStackedMindMapLayout,
} from "../model/should-refit-camera";
import { viewportFromMindMapLayout } from "../model/viewport-from-layout";

export interface MindMapCanvasProps {
  snapshot: MindMapSnapshot;
  compact?: boolean;
  /** Finalized speech, so a claim can show who said what and when. */
  utterances?: readonly Utterance[];
}

const HANDLE_IN_LEFT = "in-left";
const HANDLE_IN_RIGHT = "in-right";
const HANDLE_OUT_RIGHT = "out-right";
const HANDLE_OUT_LEFT = "out-left";
const EVIDENCE_LIMIT = 3;
const EVIDENCE_TEXT_MAX = 72;
const SUMMARY_LIMIT = 3;

interface TopicNodeData extends Record<string, unknown> {
  label: string;
  depth: number;
  chip: string | null;
  tone: MindMapNodeTone;
  struck: boolean;
  hiddenChildren: number;
  hasChildren: boolean;
  expanded: boolean;
  selected: boolean;
  stacked: boolean;
}

const PILL_TONE: Record<MindMapNodeTone, string> = {
  root: "bg-secondary text-secondary-foreground",
  topic: "bg-muted text-foreground",
  proposal: "bg-accent/60 text-foreground",
  concern: "bg-chart-1/25 text-foreground",
  decision: "bg-ours/10 text-foreground",
  action: "bg-chart-2/40 text-foreground",
  history: "bg-muted/60 text-muted-foreground",
};

const CHIP_TONE: Record<MindMapNodeTone, string> = {
  root: "border-secondary-foreground/40 text-secondary-foreground",
  topic: "border-muted-foreground/40 text-muted-foreground",
  proposal: "border-accent-foreground/40 text-accent-foreground",
  concern: "border-destructive/40 text-destructive",
  decision: "border-ours/50 bg-ours text-primary-foreground",
  action: "border-accent-foreground/50 text-accent-foreground",
  history: "border-muted-foreground/40 text-muted-foreground",
};

function TopicNode({ data }: NodeProps<Node<TopicNodeData>>) {
  const toneClass =
    data.tone === "topic" && data.depth % 2 === 1
      ? "bg-accent/70 text-accent-foreground"
      : PILL_TONE[data.tone];

  return (
    <div className="motion-safe:animate-cute-label-enter relative h-full w-full">
      <Handle
        id={HANDLE_IN_LEFT}
        type="target"
        position={data.stacked ? Position.Top : Position.Left}
        className="!size-2 !border-0 !bg-transparent"
      />
      <Handle
        id={HANDLE_OUT_LEFT}
        type="source"
        position={Position.Left}
        className="!size-2 !border-0 !bg-transparent"
      />
      <button
        type="button"
        aria-pressed={data.selected}
        aria-expanded={data.hasChildren ? data.expanded : undefined}
        aria-label={
          data.hiddenChildren > 0
            ? `${data.label}（中に${String(data.hiddenChildren)}件）`
            : data.label
        }
        className={cn(
          "flex h-full w-full cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-center text-sm leading-5 break-words whitespace-normal outline-none transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ours",
          toneClass,
          data.selected &&
            "ring-2 ring-ring ring-offset-2 ring-offset-background"
        )}
      >
        {data.chip !== null ? (
          <span
            className={cn(
              "shrink-0 rounded-full border px-1.5 text-[10px] leading-4 font-medium",
              CHIP_TONE[data.tone]
            )}
          >
            {data.chip}
          </span>
        ) : null}
        <span className={cn(data.struck && "line-through")}>{data.label}</span>
        {data.hiddenChildren > 0 ? (
          <span
            aria-hidden="true"
            className="shrink-0 rounded-full bg-background/80 px-1.5 text-xs leading-4 text-muted-foreground"
          >
            +{String(data.hiddenChildren)}件
          </span>
        ) : null}
      </button>
      <Handle
        id={HANDLE_OUT_RIGHT}
        type="source"
        position={data.stacked ? Position.Bottom : Position.Right}
        className="!size-2 !border-0 !bg-transparent"
      />
      <Handle
        id={HANDLE_IN_RIGHT}
        type="target"
        position={Position.Right}
        className="!size-2 !border-0 !bg-transparent"
      />
    </div>
  );
}

const nodeTypes = {
  topic: TopicNode,
};

const MIN_ZOOM = 0.12;
const MAX_ZOOM = 1.45;
const FIT_MAX_ZOOM = 1.2;
/** 14px labels stay about 12px on a phone; the map pans instead of shrinking. */
const STACKED_FIT_MIN_ZOOM = 0.85;
const FIT_PADDING = 0.12;
const RESIZE_FIT_MS = 220;

const EDGE_STYLE: Record<MindMapEdgeKind, { stroke: string; dash?: string }> = {
  tree: { stroke: "var(--border)" },
  supports: { stroke: "var(--accent-foreground)", dash: "6 4" },
  opposes: { stroke: "var(--destructive)", dash: "6 4" },
  supersedes: { stroke: "var(--muted-foreground)", dash: "2 4" },
};

function readVisiblePaneSize(
  pane: HTMLDivElement | null,
  fallbackWidth: number,
  fallbackHeight: number
): { width: number; height: number } {
  if (pane !== null && pane.clientWidth > 8 && pane.clientHeight > 8) {
    return { width: pane.clientWidth, height: pane.clientHeight };
  }
  return { width: fallbackWidth, height: fallbackHeight };
}

function fitMaxZoom(stacked: boolean): number {
  return stacked ? 1 : FIT_MAX_ZOOM;
}

/** On a phone, keep labels legible and let the user pan instead of shrinking. */
function fitMinZoom(stacked: boolean): number {
  return stacked ? STACKED_FIT_MIN_ZOOM : MIN_ZOOM;
}

function MindMapFlow({
  snapshot,
  compact,
  visibility,
  expandedIds,
  selectedId,
  onPick,
}: {
  snapshot: MindMapSnapshot;
  compact: boolean;
  visibility: MindMapVisibility;
  expandedIds: ReadonlySet<string>;
  selectedId: string | null;
  onPick: (nodeId: string) => void;
}) {
  const didInitialFit = useRef(false);
  const compactRef = useRef(compact);
  const stackedForFitRef = useRef(compact);
  const lastSizeRef = useRef({ width: 0, height: 0 });
  const lastNodeSignatureRef = useRef("");
  const isFittingRef = useRef(false);
  const [userTookCamera, setUserTookCamera] = useState(false);
  const [measuredPane, setMeasuredPane] = useState({ width: 0, height: 0 });
  const paneRef = useRef<HTMLDivElement>(null);
  const { setViewport } = useReactFlow();
  // Controlled nodes never get `measured` written back, so the store flag stays
  // false; walking the lookup (includeHiddenNodes) reads the measured handles.
  const nodesInitialized = useNodesInitialized({ includeHiddenNodes: true });
  const storeWidth = useStore((state) => state.width);
  const storeHeight = useStore((state) => state.height);
  const width = measuredPane.width > 8 ? measuredPane.width : storeWidth;
  const height = measuredPane.height > 8 ? measuredPane.height : storeHeight;
  const stacked = usesStackedMindMapLayout(width, compact);
  const layout = useMemo(
    () =>
      layoutMindMap(visibility.visible, {
        compact: stacked,
        direction: stacked ? "TB" : "LR",
        decorationFor: (node) => decorationForMindMapNode(node, visibility),
      }),
    [visibility, stacked]
  );
  const nodeById = useMemo(
    () => new Map(snapshot.nodes.map((node) => [node.id, node])),
    [snapshot.nodes]
  );
  const parentIds = useMemo(
    () =>
      new Set(
        snapshot.nodes.flatMap((node) =>
          node.parentId === null ? [] : [node.parentId]
        )
      ),
    [snapshot.nodes]
  );
  const nodes: Node<TopicNodeData>[] = useMemo(
    () =>
      layout.nodes.flatMap((placed) => {
        const source = nodeById.get(placed.id);
        if (source === undefined) {
          return [];
        }
        const depth = visibility.depthById.get(placed.id) ?? 1;
        const presentation = getMindMapNodePresentation(source, depth);
        return [
          {
            id: placed.id,
            type: "topic",
            position: { x: placed.x, y: placed.y },
            data: {
              label: placed.label,
              depth,
              chip: presentation.chip,
              tone: presentation.tone,
              struck: presentation.struck,
              hiddenChildren: visibility.hiddenChildCount.get(placed.id) ?? 0,
              hasChildren: parentIds.has(placed.id),
              expanded: expandedIds.has(placed.id),
              selected: placed.id === selectedId,
              stacked,
            },
            width: placed.width,
            height: placed.height,
            style: { width: placed.width, height: placed.height },
            draggable: false,
            selectable: false,
          },
        ];
      }),
    [
      layout.nodes,
      nodeById,
      parentIds,
      visibility,
      expandedIds,
      selectedId,
      stacked,
    ]
  );
  const edges: Edge[] = useMemo(() => {
    const placedById = new Map(layout.nodes.map((node) => [node.id, node]));
    // The phone column lists relations in the detail instead of drawing them.
    const drawn = stacked
      ? layout.edges.filter((edge) => edge.kind === "tree")
      : layout.edges;
    return drawn.map((edge) => {
      const style = EDGE_STYLE[edge.kind];
      const isRelation = edge.kind !== "tree";
      const from = placedById.get(edge.source);
      const to = placedById.get(edge.target);
      // Leave from the side that faces the target; siblings in one column
      // get a bracket on the right so no line runs behind a pill.
      let sourceHandle = HANDLE_OUT_RIGHT;
      let targetHandle = HANDLE_IN_LEFT;
      if (isRelation && from !== undefined && to !== undefined) {
        if (to.x + to.width <= from.x) {
          sourceHandle = HANDLE_OUT_LEFT;
          targetHandle = HANDLE_IN_RIGHT;
        } else if (to.x < from.x + from.width) {
          sourceHandle = HANDLE_OUT_RIGHT;
          targetHandle = HANDLE_IN_RIGHT;
        }
      }
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle,
        targetHandle,
        type: isRelation ? "simplebezier" : "smoothstep",
        label:
          edge.kind === "supports" || edge.kind === "opposes"
            ? MIND_MAP_RELATION_LABELS[edge.kind]
            : undefined,
        labelStyle: { fontSize: 10, fill: style.stroke },
        labelBgStyle: { fill: "var(--background)" },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 8,
        style: {
          stroke: style.stroke,
          strokeWidth: 1.5,
          strokeDasharray: style.dash,
          opacity: isRelation ? 0.85 : 1,
        },
      };
    });
  }, [layout.edges, layout.nodes, stacked]);
  const hasNodes = layout.nodes.length > 0;
  // Visible set, not just snapshot growth: opening a branch must bring its
  // children into view, and a fold gives the room back.
  const nodeSignature = `${String(snapshot.revision)}:${layout.nodes
    .map((node) => node.id)
    .join(",")}`;
  const keepInView =
    selectedId === null
      ? null
      : (layout.nodes.find((node) => node.id === selectedId) ?? null);
  const layoutWidth = layout.nodes.reduce(
    (widest, node) => Math.max(widest, node.x + node.width),
    0
  );
  const layoutHeight = layout.nodes.reduce(
    (tallest, node) => Math.max(tallest, node.y + node.height),
    0
  );
  const minFitZoom = fitMinZoom(stacked);
  const overflowsX = stacked && width > 8 && layoutWidth * minFitZoom > width;
  const overflowsY =
    stacked && height > 8 && layoutHeight * minFitZoom > height;

  useEffect(() => {
    const pane = paneRef.current;
    if (pane === null) {
      return;
    }
    const syncPane = (nextWidth: number, nextHeight: number): void => {
      setMeasuredPane((current) => {
        if (
          Math.abs(current.width - nextWidth) <= 4 &&
          Math.abs(current.height - nextHeight) <= 4
        ) {
          return current;
        }
        return { width: nextWidth, height: nextHeight };
      });
    };
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry === undefined) {
        return;
      }
      syncPane(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(pane);
    syncPane(pane.clientWidth, pane.clientHeight);
    return () => {
      observer.disconnect();
    };
  }, [hasNodes]);

  useEffect(() => {
    if (
      compactRef.current !== compact ||
      stackedForFitRef.current !== stacked
    ) {
      compactRef.current = compact;
      stackedForFitRef.current = stacked;
      didInitialFit.current = false;
      lastSizeRef.current = { width: 0, height: 0 };
    }
    const visible = readVisiblePaneSize(paneRef.current, width, height);
    const previous = lastSizeRef.current;
    const widthChanged = didMindMapPaneWidthChange(
      previous.width,
      visible.width
    );
    const heightChanged =
      previous.height > 0 && Math.abs(previous.height - visible.height) > 2;
    const isFirstLayout = !didInitialFit.current;
    const previousSignature = lastNodeSignatureRef.current;
    const nodesChanged =
      previousSignature.length > 0 && previousSignature !== nodeSignature;
    const shouldFit = shouldRefitMindMapCamera({
      hasNodes,
      nodesInitialized,
      width: visible.width,
      height: visible.height,
      isFirstLayout,
      sizeChanged: widthChanged || heightChanged,
      nodesChanged,
      userTookCamera,
    });
    if (!shouldFit) {
      if (
        shouldCommitMindMapCameraMemory({
          fitRan: false,
          nodesInitialized,
          userTookCamera,
        })
      ) {
        lastSizeRef.current = visible;
        lastNodeSignatureRef.current = nodeSignature;
      }
      return;
    }
    // Splitter drags arrive as a burst, so they wait; the branch detail
    // opening below the map only changes the height and refits at once.
    const deferResize = shouldDeferMindMapResizeFit({
      sizeChanged: widthChanged,
      isFirstLayout,
      nodesChanged,
    });
    const runFit = (): void => {
      const nextVisible = readVisiblePaneSize(paneRef.current, width, height);
      const viewport = viewportFromMindMapLayout(
        layout.nodes,
        nextVisible.width,
        nextVisible.height,
        FIT_PADDING,
        fitMinZoom(stacked),
        fitMaxZoom(stacked),
        isFirstLayout ? null : keepInView
      );
      if (viewport === null) {
        return;
      }
      lastSizeRef.current = nextVisible;
      lastNodeSignatureRef.current = nodeSignature;
      didInitialFit.current = true;
      const duration = deferResize ? 0 : isFirstLayout ? 320 : 200;
      if (duration > 0) {
        isFittingRef.current = true;
      }
      void setViewport(viewport, {
        duration,
      }).finally(() => {
        isFittingRef.current = false;
      });
    };
    if (deferResize) {
      const timer = window.setTimeout(runFit, RESIZE_FIT_MS);
      return () => {
        window.clearTimeout(timer);
      };
    }
    const frame = window.requestAnimationFrame(runFit);
    return () => {
      window.cancelAnimationFrame(frame);
      isFittingRef.current = false;
    };
  }, [
    compact,
    keepInView,
    layout.nodes,
    setViewport,
    stacked,
    hasNodes,
    height,
    nodeSignature,
    nodesInitialized,
    userTookCamera,
    width,
  ]);

  return (
    <div
      ref={paneRef}
      className="relative h-full min-h-0 overflow-hidden"
      onWheel={() => {
        if (userTookCamera) {
          return;
        }
        setUserTookCamera(true);
      }}
    >
      {userTookCamera ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="absolute right-2 top-2 z-10"
          onClick={() => {
            setUserTookCamera(false);
            const visible = readVisiblePaneSize(paneRef.current, width, height);
            const viewport = viewportFromMindMapLayout(
              layout.nodes,
              visible.width,
              visible.height,
              FIT_PADDING,
              fitMinZoom(stacked),
              fitMaxZoom(stacked)
            );
            if (viewport === null) {
              setUserTookCamera(false);
              return;
            }
            isFittingRef.current = true;
            void setViewport(viewport, { duration: 280 }).finally(() => {
              isFittingRef.current = false;
            });
          }}
        >
          ぜんぶ見る
        </Button>
      ) : null}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        panOnDrag
        zoomOnScroll
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        elementsSelectable={false}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        className="h-full bg-transparent"
        onNodeClick={(_, node) => {
          onPick(node.id);
        }}
        onMove={(event) => {
          if (event === null || isFittingRef.current || userTookCamera) {
            return;
          }
          setUserTookCamera(true);
        }}
      >
        <Background gap={22} size={1} color="var(--border)" />
      </ReactFlow>
      {(overflowsX || overflowsY) && !userTookCamera ? (
        <p className="pointer-events-none absolute bottom-1 left-0 text-xs text-muted-foreground">
          {overflowsX ? "地図は横にうごかせます" : "地図はたてにうごかせます"}
        </p>
      ) : null}
    </div>
  );
}

function clipEvidence(text: string): string {
  const chars = Array.from(text);
  if (chars.length <= EVIDENCE_TEXT_MAX) {
    return text;
  }
  return `${chars.slice(0, EVIDENCE_TEXT_MAX - 1).join("")}…`;
}

function joinLabels(nodes: readonly MindMapNode[]): string {
  const shown = nodes.slice(0, SUMMARY_LIMIT).map((node) => node.label);
  const rest = nodes.length - shown.length;
  return rest > 0
    ? `${shown.join(" ／ ")} ほか${String(rest)}件`
    : shown.join(" ／ ");
}

function BranchStatusLine({
  node,
  nodes,
}: {
  node: MindMapNode;
  nodes: readonly MindMapNode[];
}) {
  if (node.kind !== "topic" && node.kind !== "report") {
    return (
      <p className="text-xs text-muted-foreground">
        {describeMindMapNode(node)}
      </p>
    );
  }
  const summary = summarizeMindMapBranch(node, nodes);
  const decided = [...summary.decisions, ...summary.adopted];
  if (decided.length === 0 && summary.actions.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {MIND_MAP_KIND_LABELS[node.kind]}
        ・この枝で決まったことは、まだありません
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
      {decided.length > 0 ? (
        <p>この枝で決まったこと: {joinLabels(decided)}</p>
      ) : null}
      {summary.actions.length > 0 ? (
        <p>つぎにやること: {joinLabels(summary.actions)}</p>
      ) : null}
      {summary.openCount > 0 ? (
        <p>まだ決まっていないこと: {String(summary.openCount)}件</p>
      ) : null}
    </div>
  );
}

function BranchDetail({
  node,
  nodes,
  utterances,
  expanded,
  hiddenChildren,
  onCollapse,
  onClose,
}: {
  node: MindMapNode;
  nodes: readonly MindMapNode[];
  utterances: readonly Utterance[];
  expanded: boolean;
  hiddenChildren: number;
  onCollapse: () => void;
  onClose: () => void;
}) {
  const nodeById = new Map(nodes.map((item) => [item.id, item]));
  const detailLines = node.detail
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const relations = node.relations.filter((relation) =>
    nodeById.has(relation.targetId)
  );
  const utteranceById = new Map(utterances.map((item) => [item.id, item]));
  const evidence = node.sourceUtteranceIds
    .flatMap((id) => {
      const found = utteranceById.get(id);
      return found === undefined ? [] : [found];
    })
    .slice(-EVIDENCE_LIMIT);
  const childCount = nodes.filter((item) => item.parentId === node.id).length;

  return (
    <div
      aria-label={`${node.label} のくわしい話`}
      role="region"
      className="motion-safe:animate-cute-enter mt-2 max-h-[14rem] shrink-0 overflow-y-auto border-t border-border pt-3 pb-1"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-6 text-foreground">{node.label}</p>
          <BranchStatusLine node={node} nodes={nodes} />
        </div>
        {childCount > 0 && expanded ? (
          <Button type="button" variant="link" size="sm" onClick={onCollapse}>
            枝をたたむ
          </Button>
        ) : null}
        <Button type="button" variant="link" size="sm" onClick={onClose}>
          とじる
        </Button>
      </div>
      {detailLines.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          くわしい話は、まだありません。
        </p>
      ) : (
        <div className="mt-2 flex flex-col gap-1">
          {detailLines.map((line, index) => (
            <p
              key={`${String(index)}-${line}`}
              className="text-sm leading-relaxed text-foreground"
            >
              {line}
            </p>
          ))}
        </div>
      )}
      {node.history.length > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          言いなおし前: {node.history.join(" → ")}
        </p>
      ) : null}
      {relations.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-0.5 text-xs text-muted-foreground">
          {relations.map((relation) => {
            const target = nodeById.get(relation.targetId);
            if (target === undefined) {
              return null;
            }
            const stale =
              target.status === "superseded" || node.status === "superseded";
            const earlier =
              target.history.length > 0
                ? `（言いなおし前は「${target.history[target.history.length - 1] ?? ""}」）`
                : "";
            return (
              <li key={`${relation.kind}-${relation.targetId}`}>
                {MIND_MAP_RELATION_LABELS[relation.kind]}: {target.label}
                {earlier}
                {stale ? "（いまは対象外）" : ""}
              </li>
            );
          })}
        </ul>
      ) : null}
      {evidence.length > 0 ? (
        <ul
          aria-label="もとの発話"
          className="mt-2 flex flex-col gap-0.5 text-xs text-muted-foreground"
        >
          {evidence.map((item) => (
            <li key={item.id}>
              {formatUtteranceClock(item.startMs)}{" "}
              {getSpeakerLabel(item.speaker)}「{clipEvidence(item.text)}」
            </li>
          ))}
        </ul>
      ) : null}
      {childCount > 0 && !expanded && hiddenChildren > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          中に {String(hiddenChildren)} 件。もう一度おすと、ひらきます。
        </p>
      ) : null}
    </div>
  );
}

function MapSummaryLine({ nodes }: { nodes: readonly MindMapNode[] }) {
  const summary = summarizeMindMapDecisions(nodes);
  if (summary.decided.length === 0 && summary.actions.length === 0) {
    return null;
  }
  return (
    <p
      aria-label="決まったことと、つぎにやること"
      className="shrink-0 pb-2 text-xs text-muted-foreground"
    >
      {summary.decided.length > 0 ? (
        <span>決まったこと: {joinLabels(summary.decided)}</span>
      ) : null}
      {summary.decided.length > 0 && summary.actions.length > 0 ? (
        <span>　</span>
      ) : null}
      {summary.actions.length > 0 ? (
        <span>つぎにやること: {joinLabels(summary.actions)}</span>
      ) : null}
    </p>
  );
}

export function MindMapCanvas({
  snapshot,
  compact = false,
  utterances = [],
}: MindMapCanvasProps) {
  const isEmpty = snapshot.nodes.length === 0;
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedMindMapNode(snapshot.nodes, selectedId);
  const visibility = useMemo(
    () => resolveMindMapVisibility(snapshot.nodes, expandedIds),
    [snapshot.nodes, expandedIds]
  );

  // A click always opens: pick the claim and unfold its branch. Folding is
  // an explicit action in the detail, so re-reading a node never hides children.
  const handlePick = useCallback((nodeId: string): void => {
    setSelectedId(nodeId);
    setExpandedIds((current) =>
      current.has(nodeId) ? current : new Set([...current, nodeId])
    );
  }, []);

  return (
    <section
      aria-label="マインドマップ"
      className="flex h-full min-h-0 flex-col overflow-hidden px-6"
    >
      {isEmpty ? null : <MapSummaryLine nodes={snapshot.nodes} />}
      <div className="min-h-0 flex-1 overflow-hidden">
        {isEmpty ? (
          <p className="py-8 text-sm text-muted-foreground">
            マインドマップが作られます
          </p>
        ) : (
          <ReactFlowProvider>
            <MindMapFlow
              snapshot={snapshot}
              compact={compact}
              visibility={visibility}
              expandedIds={expandedIds}
              selectedId={selected?.id ?? null}
              onPick={handlePick}
            />
          </ReactFlowProvider>
        )}
      </div>
      {selected !== null ? (
        <BranchDetail
          node={selected}
          nodes={snapshot.nodes}
          utterances={utterances}
          expanded={expandedIds.has(selected.id)}
          hiddenChildren={visibility.hiddenChildCount.get(selected.id) ?? 0}
          onCollapse={() => {
            setExpandedIds((current) => {
              const next = new Set(current);
              next.delete(selected.id);
              return next;
            });
          }}
          onClose={() => {
            setSelectedId(null);
          }}
        />
      ) : null}
      {selected === null && visibility.hiddenChildCount.size > 0 ? (
        <p className="shrink-0 pt-2 text-xs text-muted-foreground">
          枝をおすと、くわしい話がひらきます。
        </p>
      ) : null}
      {snapshot.pending.length > 0 ? (
        <p className="shrink-0 pt-2 pb-1 text-xs text-muted-foreground">
          まだ地図に置けていない話:{" "}
          {snapshot.pending.map((item) => item.text).join(" ／ ")}
        </p>
      ) : null}
    </section>
  );
}
