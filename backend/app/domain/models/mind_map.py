"""Mind-map snapshot, depth cap, and silence-window buffer."""

from dataclasses import dataclass

MIND_MAP_MAX_DEPTH = 5
MIND_MAP_SILENCE_MS = 3000


@dataclass(frozen=True)
class MindMapNode:
    """One topic on the meeting mind map."""

    id: str
    label: str
    parent_id: str | None
    source_utterance_ids: tuple[str, ...] = ()


@dataclass(frozen=True)
class MindMapSnapshot:
    """Revisioned set of mind-map topics for one meeting."""

    meeting_id: str
    revision: int
    nodes: tuple[MindMapNode, ...] = ()
    source_utterance_count: int = 0

    def node_lookup(self) -> dict[str, MindMapNode]:
        """Index nodes by id."""
        return {node.id: node for node in self.nodes}


@dataclass(frozen=True)
class MindMapSilenceBuffer:
    """Hold finalized utterance ids until conversation silence, not an STT turn cut."""

    pending_ids: tuple[str, ...] = ()
    quiet_ms: int = 0
    silence_ms: int = MIND_MAP_SILENCE_MS

    def accumulate(self, utterance_ids: tuple[str, ...]) -> "MindMapSilenceBuffer":
        """Append new finals and restart the silence clock."""
        if not utterance_ids:
            return self
        known = set(self.pending_ids)
        merged = self.pending_ids + tuple(
            item_id for item_id in utterance_ids if item_id not in known
        )
        if merged == self.pending_ids:
            return self
        return MindMapSilenceBuffer(
            pending_ids=merged,
            quiet_ms=0,
            silence_ms=self.silence_ms,
        )

    def observe_audio(
        self, *, speech: bool, duration_ms: int
    ) -> "MindMapSilenceBuffer":
        """Advance quiet time from PCM energy. Speech resets the clock."""
        if duration_ms <= 0:
            return self
        if speech:
            if self.quiet_ms == 0:
                return self
            return MindMapSilenceBuffer(
                pending_ids=self.pending_ids,
                quiet_ms=0,
                silence_ms=self.silence_ms,
            )
        return MindMapSilenceBuffer(
            pending_ids=self.pending_ids,
            quiet_ms=self.quiet_ms + duration_ms,
            silence_ms=self.silence_ms,
        )

    def should_flush(self) -> bool:
        """True when pending text exists and silence reached the map threshold."""
        return bool(self.pending_ids) and self.quiet_ms >= self.silence_ms

    def take(self) -> tuple["MindMapSilenceBuffer", tuple[str, ...]]:
        """Detach the pending window and clear the buffer."""
        emptied = MindMapSilenceBuffer(
            pending_ids=(),
            quiet_ms=0,
            silence_ms=self.silence_ms,
        )
        return emptied, self.pending_ids

    def requeue(self, utterance_ids: tuple[str, ...]) -> "MindMapSilenceBuffer":
        """Put a failed window back in front of any newer finals."""
        if not utterance_ids:
            return self
        known = set(utterance_ids)
        rest = tuple(item_id for item_id in self.pending_ids if item_id not in known)
        return MindMapSilenceBuffer(
            pending_ids=utterance_ids + rest,
            quiet_ms=0,
            silence_ms=self.silence_ms,
        )


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


def _depth_if_attached(
    node: MindMapNode,
    by_id: dict[str, MindMapNode],
) -> int | None:
    if node.parent_id is None:
        return 1
    if node.parent_id not in by_id:
        return None
    parent_depth = mind_map_node_depth(node.parent_id, by_id)
    if parent_depth is None:
        return None
    return parent_depth + 1


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


def apply_mind_map_delta(
    snapshot: MindMapSnapshot,
    *,
    revision: int,
    upserts: tuple[MindMapNode, ...],
    removes: tuple[str, ...],
    source_utterance_count: int,
) -> MindMapSnapshot:
    """Apply an incremental mind-map update and return the next snapshot.

    Nodes that would sit at depth 6 or below the cap never persist.
    """
    by_id = snapshot.node_lookup()
    for node_id in removes:
        by_id.pop(node_id, None)
    _prune_illegal_nodes(by_id)

    pending = list(upserts)
    progressed = True
    while pending and progressed:
        progressed = False
        leftover: list[MindMapNode] = []
        for node in pending:
            depth = _depth_if_attached(node, by_id)
            if depth is None:
                leftover.append(node)
                continue
            if depth > MIND_MAP_MAX_DEPTH:
                continue
            by_id[node.id] = node
            _prune_illegal_nodes(by_id)
            if node.id not in by_id:
                continue
            progressed = True
        pending = leftover

    return MindMapSnapshot(
        meeting_id=snapshot.meeting_id,
        revision=revision,
        nodes=tuple(by_id.values()),
        source_utterance_count=source_utterance_count,
    )
