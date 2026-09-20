export interface MindMapNode {
  id: string;
  label: string;
  parentId: string | null;
  sourceUtteranceIds: string[];
}

export interface MindMapSnapshot {
  meetingId: string;
  revision: number;
  nodes: MindMapNode[];
}

export interface MindMapEvent {
  type: "mindmap";
  meetingId: string;
  revision: number;
  upserts: MindMapNode[];
  removes: string[];
}

export function createEmptyMindMap(meetingId: string): MindMapSnapshot {
  return {
    meetingId,
    revision: 0,
    nodes: [],
  };
}
