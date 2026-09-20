import type { MindMapEvent, MindMapNode, MindMapSnapshot } from "./types";

export function applyMindMapEvent(
  current: MindMapSnapshot,
  event: MindMapEvent
): MindMapSnapshot {
  if (event.meetingId !== current.meetingId) {
    return current;
  }
  if (event.revision <= current.revision) {
    return current;
  }

  const byId = new Map<string, MindMapNode>(
    current.nodes.map((node) => [node.id, node])
  );
  for (const nodeId of event.removes) {
    byId.delete(nodeId);
  }
  for (const node of event.upserts) {
    byId.set(node.id, node);
  }

  return {
    meetingId: event.meetingId,
    revision: event.revision,
    nodes: [...byId.values()],
  };
}
