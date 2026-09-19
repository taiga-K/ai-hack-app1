export const DOCUMENT_EDITOR_VIEWS = ["preview", "split", "source"] as const;

export type DocumentEditorView = (typeof DOCUMENT_EDITOR_VIEWS)[number];
