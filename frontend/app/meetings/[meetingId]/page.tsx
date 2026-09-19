import { MeetingRoomPage } from "@/_pages/meeting-room";

interface MeetingRouteProps {
  params: Promise<{ meetingId: string }>;
  searchParams: Promise<{ title?: string; demo?: string }>;
}

export default async function MeetingRoute({
  params,
  searchParams,
}: MeetingRouteProps) {
  const { meetingId } = await params;
  const query = await searchParams;

  return (
    <MeetingRoomPage
      meetingId={meetingId}
      title={query.title}
      preview={query.demo === "1"}
    />
  );
}
