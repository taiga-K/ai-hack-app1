"""Mind-map snapshot and incremental update models."""

from dataclasses import dataclass


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


def apply_mind_map_delta(
    snapshot: MindMapSnapshot,
    *,
    revision: int,
    upserts: tuple[MindMapNode, ...],
    removes: tuple[str, ...],
    source_utterance_count: int,
) -> MindMapSnapshot:
    """Apply an incremental mind-map update and return the next snapshot."""
    by_id = snapshot.node_lookup()
    for node_id in removes:
        by_id.pop(node_id, None)
    for node in upserts:
        by_id[node.id] = node
    return MindMapSnapshot(
        meeting_id=snapshot.meeting_id,
        revision=revision,
        nodes=tuple(by_id.values()),
        source_utterance_count=source_utterance_count,
    )
