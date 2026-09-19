import { DocumentViewPage } from "@/_pages/document-view";

interface DocumentRouteProps {
  params: Promise<{ meetingId: string }>;
  searchParams: Promise<{ title?: string; demo?: string }>;
}

export default async function DocumentRoute({
  params,
  searchParams,
}: DocumentRouteProps) {
  const { meetingId } = await params;
  const query = await searchParams;

  return (
    <DocumentViewPage
      meetingId={meetingId}
      title={query.title}
      preview={query.demo === "1"}
    />
  );
}
