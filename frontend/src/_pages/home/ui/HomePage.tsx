import { StartMeetingForm } from "@/features/meeting-control";
import { Toaster } from "@/shared/ui";

export function HomePage() {
  return (
    <div className="relative isolate min-h-dvh overflow-hidden bg-background">
      <span
        aria-hidden
        className="motion-safe:animate-cute-blob pointer-events-none absolute -top-16 -left-10 size-56 rounded-full bg-secondary/80"
      />
      <span
        aria-hidden
        className="motion-safe:animate-cute-blob pointer-events-none absolute top-24 -right-8 size-40 rounded-full bg-accent/70 [animation-delay:1.2s]"
      />
      <span
        aria-hidden
        className="motion-safe:animate-cute-bob pointer-events-none absolute bottom-16 left-1/4 size-16 rounded-full bg-ours/25"
      />
      <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 py-16">
        <div className="motion-safe:animate-cute-pop flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">会議のまとめ</p>
          <h1 className="font-heading text-3xl leading-tight font-medium tracking-tight">
            会議がおわると、
            <br />
            まとめが出来てます
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            話しながら、聞きそびれやあいまいなところを教えてくれます。相手の画面には出ません。
          </p>
        </div>
        <StartMeetingForm />
      </main>
      <Toaster />
    </div>
  );
}
