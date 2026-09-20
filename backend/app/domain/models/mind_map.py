"""Meeting map: typed nodes, relations, operations delta, pending, silence buffer.

The map is a shallow tree of claims (root depth 1, at most depth 5).
Information growth and tree depth are separate: supplements go into a node's
``detail``, alternatives are siblings, reasons and objections are relations,
and corrections keep history instead of deleting.
"""

from dataclasses import dataclass, replace
from enum import StrEnum

MIND_MAP_MAX_DEPTH = 5
MIND_MAP_SILENCE_MS = 1000
MIND_MAP_MAX_RETRY_BACKOFF_STEPS = 3
MIND_MAP_LABEL_MAX_CHARS = 22
MIND_MAP_DETAIL_PIECE_MAX_CHARS = 200
MIND_MAP_PENDING_MAX_ITEMS = 5
MIND_MAP_PENDING_TEXT_MAX_CHARS = 80


class MindMapNodeKind(StrEnum):
    """What kind of claim a node carries."""

    TOPIC = "topic"
    REPORT = "report"
    PROPOSAL = "proposal"
    REASON = "reason"
    CONCERN = "concern"
    DECISION = "decision"
    ACTION = "action"


class MindMapNodeStatus(StrEnum):
    """Decided vs. undecided is read from the same data."""

    OPEN = "open"
    DECIDED = "decided"
    PENDING = "pending"
    SUPERSEDED = "superseded"


class MindMapRelationKind(StrEnum):
    """Internal relations. The screen draws only the lines it needs."""

    SUPPORTS = "supports"
    OPPOSES = "opposes"
    SUPERSEDES = "supersedes"


@dataclass(frozen=True)
class MindMapRelation:
    """Directed relation from the owning node to ``target_id``."""

    kind: MindMapRelationKind
    target_id: str


@dataclass(frozen=True)
class MindMapNode:
    """One claim on the meeting map."""

    id: str
    label: str
    parent_id: str | None
    kind: MindMapNodeKind = MindMapNodeKind.TOPIC
    status: MindMapNodeStatus = MindMapNodeStatus.OPEN
    detail: str = ""
    relations: tuple[MindMapRelation, ...] = ()
    history: tuple[str, ...] = ()
    pinned: bool = False
    source_utterance_ids: tuple[str, ...] = ()


@dataclass(frozen=True)
class MindMapPendingItem:
    """A fragment that could not be placed yet and is carried to the next window."""

    text: str
    source_utterance_ids: tuple[str, ...] = ()


@dataclass(frozen=True)
class MindMapSnapshot:
    """Revisioned meeting map for one meeting."""

    meeting_id: str
    revision: int
    nodes: tuple[MindMapNode, ...] = ()
    pending: tuple[MindMapPendingItem, ...] = ()
    source_utterance_count: int = 0

    def node_lookup(self) -> dict[str, MindMapNode]:
        """Index nodes by id."""
        return {node.id: node for node in self.nodes}

    def root_id(self) -> str | None:
        """Return the single root id, if the map has one."""
        for node in self.nodes:
            if node.parent_id is None:
                return node.id
        return None


@dataclass(frozen=True)
class AddNodeOperation:
    """追加: a new claim under an existing parent."""

    node: MindMapNode


@dataclass(frozen=True)
class AnnotateNodeOperation:
    """補足: append to the detail of the same node."""

    node_id: str
    detail: str
    source_utterance_ids: tuple[str, ...] = ()


@dataclass(frozen=True)
class CorrectNodeOperation:
    """訂正: relabel and/or add detail; the previous label stays in history."""

    node_id: str
    label: str | None = None
    detail: str | None = None
    source_utterance_ids: tuple[str, ...] = ()


@dataclass(frozen=True)
class RelateNodesOperation:
    """関連づけ: supports / opposes / supersedes from ``node_id`` to ``target_id``."""

    node_id: str
    relation: MindMapRelationKind
    target_id: str
    source_utterance_ids: tuple[str, ...] = ()


@dataclass(frozen=True)
class SetNodeStatusOperation:
    """決定・保留: change the status of an existing node."""

    node_id: str
    status: MindMapNodeStatus
    source_utterance_ids: tuple[str, ...] = ()


MindMapOperation = (
    AddNodeOperation
    | AnnotateNodeOperation
    | CorrectNodeOperation
    | RelateNodesOperation
    | SetNodeStatusOperation
)


@dataclass(frozen=True)
class MindMapDelta:
    """What one analysis window changes. Unchanged parts are not listed."""

    operations: tuple[MindMapOperation, ...] = ()
    pending: tuple[MindMapPendingItem, ...] | None = None


@dataclass(frozen=True)
class MindMapApplyResult:
    """Next snapshot plus the ids whose content changed."""

    snapshot: MindMapSnapshot
    changed_node_ids: tuple[str, ...] = ()
    pending_changed: bool = False

    @property
    def changed(self) -> bool:
        return bool(self.changed_node_ids) or self.pending_changed


@dataclass(frozen=True)
class MindMapSilenceBuffer:
    """Hold finalized utterance ids until PCM silence, not an STT turn cut.

    ``quiet_ms`` is driven by audio energy only. New finals do not restart it,
    so a final that lands during an ongoing pause flushes at once. A failed
    window is requeued in front and doubles the required silence, capped.
    """

    pending_ids: tuple[str, ...] = ()
    quiet_ms: int = 0
    silence_ms: int = MIND_MAP_SILENCE_MS
    failures: int = 0

    def accumulate(self, utterance_ids: tuple[str, ...]) -> "MindMapSilenceBuffer":
        """Append new finals while people keep talking."""
        known = set(self.pending_ids)
        merged = self.pending_ids + tuple(
            item_id for item_id in utterance_ids if item_id not in known
        )
        if merged == self.pending_ids:
            return self
        return replace(self, pending_ids=merged)

    def observe_audio(
        self, *, speech: bool, duration_ms: int
    ) -> "MindMapSilenceBuffer":
        """Advance quiet time from PCM energy. Speech resets the clock."""
        if duration_ms <= 0:
            return self
        if speech:
            if self.quiet_ms == 0:
                return self
            return replace(self, quiet_ms=0)
        return replace(self, quiet_ms=self.quiet_ms + duration_ms)

    @property
    def required_silence_ms(self) -> int:
        """Silence needed before the next flush, longer after failures."""
        steps = min(self.failures, MIND_MAP_MAX_RETRY_BACKOFF_STEPS)
        return self.silence_ms << steps

    def should_flush(self) -> bool:
        """True when pending text exists and the pause reached the threshold."""
        return bool(self.pending_ids) and self.quiet_ms >= self.required_silence_ms

    def take(self) -> tuple["MindMapSilenceBuffer", tuple[str, ...]]:
        """Detach the pending window. The next window needs its own pause."""
        return replace(self, pending_ids=(), quiet_ms=0), self.pending_ids

    def requeue(self, utterance_ids: tuple[str, ...]) -> "MindMapSilenceBuffer":
        """Put a failed window back in front of newer finals and back off."""
        if not utterance_ids:
            return self
        known = set(utterance_ids)
        rest = tuple(item_id for item_id in self.pending_ids if item_id not in known)
        return replace(
            self,
            pending_ids=utterance_ids + rest,
            quiet_ms=0,
            failures=self.failures + 1,
        )

    def settle(self) -> "MindMapSilenceBuffer":
        """Forget past failures after a window was analyzed."""
        if self.failures == 0:
            return self
        return replace(self, failures=0)


def mind_map_node_depth(node_id: str, by_id: dict[str, MindMapNode]) -> int | None:
    """Return 1-based depth from this node to the root, or None on a cycle."""
    seen: set[str] = set()
    depth = 1
    current_id: str | None = node_id
    while current_id is not None:
        if current_id in seen:
            return None
        seen.add(current_id)
        node = by_id.get(current_id)
        if node is None or node.parent_id is None:
            return depth
        current_id = node.parent_id
        depth += 1
    return depth


def _prune_illegal_nodes(by_id: dict[str, MindMapNode]) -> None:
    """Drop cycles, depth > 5, and children of missing parents."""
    while True:
        drop_ids = [
            node_id
            for node_id, node in by_id.items()
            if (node.parent_id is not None and node.parent_id not in by_id)
            or (depth := mind_map_node_depth(node_id, by_id)) is None
            or depth > MIND_MAP_MAX_DEPTH
        ]
        if not drop_ids:
            return
        for node_id in drop_ids:
            by_id.pop(node_id, None)


def _merge_ids(current: tuple[str, ...], extra: tuple[str, ...]) -> tuple[str, ...]:
    known = set(current)
    return current + tuple(item for item in extra if item not in known)


def _append_detail(detail: str, piece: str) -> str:
    text = piece.strip()
    if not text or text in detail:
        return detail
    if not detail:
        return text
    return f"{detail}\n{text}"


def _parent_first_operations(
    operations: list[MindMapOperation],
) -> list[MindMapOperation]:
    """Put same-batch parents before their children, then non-add operations."""
    adds = [op for op in operations if isinstance(op, AddNodeOperation)]
    others = [op for op in operations if not isinstance(op, AddNodeOperation)]
    pending = {op.node.id: op for op in adds}
    ordered: list[MindMapOperation] = []
    while pending:
        ready_ids = [
            node_id
            for node_id, operation in pending.items()
            if operation.node.parent_id not in pending
        ]
        if not ready_ids:
            ready_ids = list(pending)
        for node_id in ready_ids:
            ordered.append(pending.pop(node_id))
    return ordered + others


class _MindMapEditor:
    """Mutable working copy used while applying one delta."""

    def __init__(self, snapshot: MindMapSnapshot) -> None:
        self._by_id = snapshot.node_lookup()
        _prune_illegal_nodes(self._by_id)
        self._order = list(self._by_id)
        self._changed: list[str] = []

    @property
    def nodes(self) -> tuple[MindMapNode, ...]:
        return tuple(self._by_id[node_id] for node_id in self._order)

    @property
    def changed_node_ids(self) -> tuple[str, ...]:
        return tuple(self._changed)

    def _root_id(self) -> str | None:
        for node_id in self._order:
            if self._by_id[node_id].parent_id is None:
                return node_id
        return None

    def _put(self, node: MindMapNode) -> None:
        if node.id not in self._by_id:
            self._order.append(node.id)
        self._by_id[node.id] = node
        if node.id not in self._changed:
            self._changed.append(node.id)

    def apply(self, operations: tuple[MindMapOperation, ...]) -> None:
        """Apply in order; operations that reference later additions wait a pass."""
        remaining = list(operations)
        while remaining:
            deferred: list[MindMapOperation] = []
            for operation in remaining:
                if not self._apply_one(operation, final_pass=False):
                    deferred.append(operation)
            if len(deferred) == len(remaining):
                for operation in _parent_first_operations(deferred):
                    self._apply_one(operation, final_pass=True)
                return
            remaining = deferred

    def _apply_one(self, operation: MindMapOperation, *, final_pass: bool) -> bool:
        if isinstance(operation, AddNodeOperation):
            return self._add(operation.node, final_pass=final_pass)
        if isinstance(operation, AnnotateNodeOperation):
            return self._annotate(
                operation.node_id, operation.detail, operation.source_utterance_ids
            )
        if isinstance(operation, CorrectNodeOperation):
            return self._correct(operation)
        if isinstance(operation, RelateNodesOperation):
            return self._relate(operation)
        return self._set_status(operation)

    def _add(self, node: MindMapNode, *, final_pass: bool) -> bool:
        if node.id in self._by_id:
            self._annotate(node.id, node.detail, node.source_utterance_ids)
            return True
        root_id = self._root_id()
        parent_id = node.parent_id
        if parent_id is None and root_id is not None:
            parent_id = root_id
        if parent_id is not None and parent_id not in self._by_id:
            if not final_pass:
                return False
            # Unknown parent: hang it on the root, or let it become the root
            # of an empty map rather than losing the first topic.
            parent_id = root_id
        if parent_id is None:
            self._put(replace(node, parent_id=None))
            return True
        parent_depth = mind_map_node_depth(parent_id, self._by_id)
        if parent_depth is None:
            return True
        if parent_depth + 1 > MIND_MAP_MAX_DEPTH:
            piece = node.label if not node.detail else f"{node.label}: {node.detail}"
            self._annotate(parent_id, piece, node.source_utterance_ids)
            return True
        self._put(replace(node, parent_id=parent_id))
        return True

    def _annotate(self, node_id: str, detail: str, source_ids: tuple[str, ...]) -> bool:
        node = self._by_id.get(node_id)
        if node is None:
            return False
        next_detail = _append_detail(node.detail, detail)
        next_sources = _merge_ids(node.source_utterance_ids, source_ids)
        if next_detail == node.detail and next_sources == node.source_utterance_ids:
            return True
        self._put(replace(node, detail=next_detail, source_utterance_ids=next_sources))
        return True

    def _correct(self, operation: CorrectNodeOperation) -> bool:
        node = self._by_id.get(operation.node_id)
        if node is None:
            return False
        if node.pinned:
            return True
        label = node.label
        history = node.history
        if operation.label is not None and operation.label.strip():
            new_label = operation.label.strip()
            if new_label != node.label:
                history = history + (node.label,)
                label = new_label
        detail = node.detail
        if operation.detail is not None:
            detail = _append_detail(detail, operation.detail)
        sources = _merge_ids(node.source_utterance_ids, operation.source_utterance_ids)
        updated = replace(
            node,
            label=label,
            history=history,
            detail=detail,
            source_utterance_ids=sources,
        )
        if updated != node:
            self._put(updated)
        return True

    def _relate(self, operation: RelateNodesOperation) -> bool:
        node = self._by_id.get(operation.node_id)
        target = self._by_id.get(operation.target_id)
        if node is None or target is None:
            return False
        if node.id == target.id:
            return True
        relation = MindMapRelation(kind=operation.relation, target_id=target.id)
        if relation not in node.relations:
            self._put(
                replace(
                    node,
                    relations=node.relations + (relation,),
                    source_utterance_ids=_merge_ids(
                        node.source_utterance_ids, operation.source_utterance_ids
                    ),
                )
            )
        if (
            operation.relation == MindMapRelationKind.SUPERSEDES
            and not target.pinned
            and target.status != MindMapNodeStatus.SUPERSEDED
        ):
            self._put(replace(target, status=MindMapNodeStatus.SUPERSEDED))
        return True

    def _set_status(self, operation: SetNodeStatusOperation) -> bool:
        node = self._by_id.get(operation.node_id)
        if node is None:
            return False
        if node.pinned or node.status == operation.status:
            return True
        self._put(
            replace(
                node,
                status=operation.status,
                source_utterance_ids=_merge_ids(
                    node.source_utterance_ids, operation.source_utterance_ids
                ),
            )
        )
        return True


def apply_mind_map_delta(
    snapshot: MindMapSnapshot,
    delta: MindMapDelta,
    *,
    source_utterance_count: int,
) -> MindMapApplyResult:
    """Apply one delta and return the next snapshot.

    Nothing is discarded: a node that would sit at depth 6 becomes detail on
    its parent, unknown parents fall back to the root (the first such node on
    an empty map becomes the root), corrections keep the previous label in
    ``history``, and pinned nodes are never overwritten.
    The revision advances only when a node or the pending list changed.
    """
    editor = _MindMapEditor(snapshot)
    editor.apply(delta.operations)
    pending = snapshot.pending if delta.pending is None else delta.pending
    pending_changed = pending != snapshot.pending
    changed_ids = editor.changed_node_ids
    changed = bool(changed_ids) or pending_changed
    return MindMapApplyResult(
        snapshot=MindMapSnapshot(
            meeting_id=snapshot.meeting_id,
            revision=snapshot.revision + 1 if changed else snapshot.revision,
            nodes=editor.nodes,
            pending=pending,
            source_utterance_count=source_utterance_count,
        ),
        changed_node_ids=changed_ids,
        pending_changed=pending_changed,
    )
