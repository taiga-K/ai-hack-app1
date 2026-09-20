"use client";

import { useState } from "react";
import { Bell, BellOff } from "lucide-react";
import type { MeetingPhase } from "@/entities/meeting";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Switch,
} from "@/shared/ui";
import type { MeetingConnectionState } from "../model/types";

export interface MeetingControlsProps {
  phase: MeetingPhase;
  connection: MeetingConnectionState;
  chimeEnabled: boolean;
  onToggleChime: (enabled: boolean) => void;
  onStart: () => void;
  onStop: () => void;
  onEndMeeting: () => void;
}

export function MeetingControls({
  phase,
  connection,
  chimeEnabled,
  onToggleChime,
  onStart,
  onStop,
  onEndMeeting,
}: MeetingControlsProps) {
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const isEnded = phase === "ended" || phase === "finalizing";
  const isRequestingPermission = connection.status === "requesting_permission";
  const isListening = connection.isRecording && !isEnded;
  const endDisabled = isEnded || isRequestingPermission;

  function handleConfirmEnd() {
    onEndMeeting();
    setEndDialogOpen(false);
  }

  return (
    <section
      aria-label="会議の操作"
      className="flex shrink-0 flex-wrap items-center gap-2 px-1 py-3"
    >
      {!isListening ? (
        <Button
          size="lg"
          onClick={onStart}
          disabled={isEnded || isRequestingPermission}
        >
          {isRequestingPermission ? "まっててね" : "ききはじめる"}
        </Button>
      ) : (
        <Button variant="outline" size="lg" onClick={onStop}>
          きくのをやめる
        </Button>
      )}

      <Dialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
        <DialogTrigger
          disabled={endDisabled}
          render={<Button variant="ghost" size="lg" disabled={endDisabled} />}
        >
          おわる
        </DialogTrigger>
        <DialogContent showCloseButton={false} className="rounded-3xl ring-0">
          <DialogHeader>
            <DialogTitle>おわりますか？</DialogTitle>
            <DialogDescription>
              おわると、いままでの話からまとめが出来ます。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="rounded-none border-0 bg-transparent">
            <Button variant="outline" onClick={() => setEndDialogOpen(false)}>
              まだつづける
            </Button>
            <Button onClick={handleConfirmEnd}>はい、おわる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
        {chimeEnabled ? (
          <Bell className="size-4" />
        ) : (
          <BellOff className="size-4" />
        )}
        <Switch
          aria-label="音で知らせる"
          size="sm"
          checked={chimeEnabled}
          onCheckedChange={onToggleChime}
          disabled={isEnded}
        />
      </label>
    </section>
  );
}
