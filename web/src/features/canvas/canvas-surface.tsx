'use client'

import '@xyflow/react/dist/style.css'

import {
  applyNodeChanges,
  Background,
  type ColorMode,
  Controls,
  type Edge,
  type Node,
  type NodeChange,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react'
import { LayersIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  type CanvasState,
  type CanvasView,
  PROFILE_NODE_ID,
  useCanvas,
} from '@/features/canvas/canvas-state'
import { MatchEdge } from '@/features/canvas/edges/match-edge'
import { ExportShortlistButton } from '@/features/canvas/export/export-shortlist-button'
import { AdNode } from '@/features/canvas/nodes/ad-node'
import { CompareDiffNode } from '@/features/canvas/nodes/compare-diff-node'
import { GroupNode } from '@/features/canvas/nodes/group-node'
import { ProfileNode } from '@/features/canvas/nodes/profile-node'
import { shouldShowProfileNode } from '@/features/canvas/profile-node-visibility'
import {
  compareLayout,
  gridLayout,
  groupLayout,
  type LayoutEdge,
  type LayoutNode,
  profileNodeLayout,
  shortlistLayout,
  timelineAxisTicks,
  timelineLayout,
} from '@/features/canvas/views/layout'
import { TimelineAxisOverlay } from '@/features/canvas/views/timeline-axis-overlay'
import { cn } from '@/lib/utils'

const NODE_TYPES = {
  ad: AdNode,
  profile: ProfileNode,
  group: GroupNode,
  compareDiff: CompareDiffNode,
} as const

const EDGE_TYPES = {
  match: MatchEdge,
} as const

const VIEWS: ReadonlyArray<{ id: CanvasView; label: string }> = [
  { id: 'triage', label: 'Triage' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'compare', label: 'Compare' },
  { id: 'shortlist', label: 'Shortlist' },
]

interface CanvasSurfaceProps {
  readonly onEditProfile: () => void
}

export function CanvasSurface({ onEditProfile }: CanvasSurfaceProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner onEditProfile={onEditProfile} />
    </ReactFlowProvider>
  )
}

function CanvasInner({ onEditProfile }: CanvasSurfaceProps) {
  const { state, dispatch } = useCanvas()
  const reactFlow = useReactFlow()
  const { resolvedTheme } = useTheme()
  const colorMode: ColorMode =
    resolvedTheme === 'dark'
      ? 'dark'
      : resolvedTheme === 'light'
        ? 'light'
        : 'system'

  const layout = useMemo(() => buildLayout(state), [state])

  const layoutNodes = useMemo<Node[]>(() => {
    const ads: Node[] = layout.nodes.map((node) => toFlowNode(node, state))
    if (!shouldShowProfileNode(state.view, state.pinnedAdIds.length)) return ads
    const profileNode: Node = {
      ...profileNodeLayout(),
      data: { onEdit: onEditProfile },
      draggable: false,
    }
    return [profileNode, ...ads]
  }, [layout.nodes, state, onEditProfile])

  const [nodes, setNodes] = useState<Node[]>(layoutNodes)
  const [seenLayout, setSeenLayout] = useState(layoutNodes)
  if (seenLayout !== layoutNodes) {
    setSeenLayout(layoutNodes)
    setNodes(layoutNodes)
  }

  const edges = useMemo<Edge[]>(() => {
    const baseEdges: Edge[] = layout.edges.map((edge) => toFlowEdge(edge))
    if (state.profileMatches.length === 0) return baseEdges
    const visible = new Set(state.visibleAdIds)
    const matchEdges: Edge[] = state.profileMatches
      .filter((link) => visible.has(link.adId))
      .map((link) => ({
        id: `match-${link.adId}`,
        source: PROFILE_NODE_ID,
        target: link.adId,
        type: 'match',
        data: { score: link.score, rationale: link.rationale },
      }))
    return [...baseEdges, ...matchEdges]
  }, [layout.edges, state.profileMatches, state.visibleAdIds])

  useEffect(() => {
    if (state.visibleAdIds.length === 0) return
    const id = window.setTimeout(() => {
      reactFlow.fitView({ padding: 0.2, duration: 250, maxZoom: 1 })
    }, 50)
    return () => window.clearTimeout(id)
  }, [reactFlow, state.view, state.visibleAdIds])

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((current) => applyNodeChanges(changes, current))
      for (const change of changes) {
        if (
          change.type === 'position' &&
          change.dragging === false &&
          change.position
        ) {
          dispatch({
            type: 'setNodePosition',
            nodeId: change.id,
            position: change.position,
          })
        }
      }
    },
    [dispatch],
  )

  return (
    <div className="relative flex size-full flex-col bg-background">
      <ViewSwitcher
        view={state.view}
        onChange={(view) => dispatch({ type: 'setView', view })}
        pinnedCount={state.pinnedAdIds.length}
        demoUrl={resolveDemoUrl()}
      />
      <div className="relative min-h-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodesChange={handleNodesChange}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
          minZoom={0.25}
          maxZoom={2}
          colorMode={colorMode}
          nodesConnectable={false}
          edgesFocusable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
        {state.view === 'timeline' && state.timeline ? (
          <TimelineAxisOverlay ticks={timelineAxisTicks()} />
        ) : null}
        {state.view === 'shortlist' && state.pinnedAdIds.length === 0 ? (
          <ShortlistEmptyState
            onSwitchToTriage={() =>
              dispatch({ type: 'setView', view: 'triage' })
            }
          />
        ) : null}
      </div>
    </div>
  )
}

interface ViewSwitcherProps {
  readonly view: CanvasView
  readonly onChange: (view: CanvasView) => void
  readonly pinnedCount: number
  readonly demoUrl: string
}

function ViewSwitcher({
  view,
  onChange,
  pinnedCount,
  demoUrl,
}: ViewSwitcherProps) {
  return (
    <div className="flex shrink-0 items-center gap-1 border-b bg-card/50 px-3 py-2 backdrop-blur">
      <LayersIcon className="size-4 text-muted-foreground" aria-hidden />
      <span className="mr-2 text-xs font-medium text-muted-foreground">
        Canvas view
      </span>
      <div
        role="group"
        aria-label="Canvas view"
        className="flex items-center gap-1"
      >
        {VIEWS.map((entry) => {
          const isActive = view === entry.id
          const showCount = entry.id === 'shortlist' && pinnedCount > 0
          return (
            <Button
              key={entry.id}
              type="button"
              aria-pressed={isActive}
              size="sm"
              variant={isActive ? 'secondary' : 'ghost'}
              className={cn('h-7 px-2.5 text-xs', isActive && 'font-semibold')}
              onClick={() => onChange(entry.id)}
            >
              {entry.label}
              {showCount ? (
                <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
                  {pinnedCount}
                </span>
              ) : null}
            </Button>
          )
        })}
      </div>
      <ExportShortlistButton demoUrl={demoUrl} className="ml-auto" />
    </div>
  )
}

interface ShortlistEmptyStateProps {
  readonly onSwitchToTriage: () => void
}

function ShortlistEmptyState({ onSwitchToTriage }: ShortlistEmptyStateProps) {
  return (
    <div
      data-testid="shortlist-empty-state"
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <div className="pointer-events-auto max-w-xs rounded-md border bg-card/90 px-4 py-3 text-center shadow-sm backdrop-blur">
        <p className="text-sm font-medium text-foreground">No pinned ads yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Pin ads from the triage view to build a shortlist.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 h-7 px-2 text-xs"
          onClick={onSwitchToTriage}
        >
          Go to triage
        </Button>
      </div>
    </div>
  )
}

function resolveDemoUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (envUrl) return envUrl
  if (typeof window !== 'undefined') return window.location.origin
  return 'https://jobtriage.vercel.app'
}

function buildLayout(state: CanvasState) {
  if (state.view === 'compare') return compareLayout(state)
  if (state.view === 'timeline') return timelineLayout(state)
  if (state.view === 'shortlist') return shortlistLayout(state)
  if (state.groups.length > 0) return groupLayout(state.groups)
  if (state.visibleAdIds.length === 0) return { nodes: [], edges: [] }
  const grid = gridLayout(state.visibleAdIds)
  return {
    nodes: state.visibleAdIds.map((adId) => ({
      id: adId,
      type: 'ad' as const,
      position: grid.positions[adId],
      data: { adId },
      zIndex: 1,
    })),
    edges: [],
  }
}

function toFlowNode(node: LayoutNode, state: CanvasState): Node {
  const persisted = state.nodePositions[node.id]
  return {
    id: node.id,
    type: node.type,
    position: persisted ?? node.position,
    data: node.data,
    draggable: node.draggable ?? node.type === 'ad',
    selectable: node.selectable ?? true,
    zIndex: node.zIndex,
  }
}

function toFlowEdge(edge: LayoutEdge): Edge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type,
    data: edge.data,
  }
}
