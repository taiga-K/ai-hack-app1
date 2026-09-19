let activeContext: AudioContext | null = null;

export function playSoftChime(): void {
  if (typeof window === "undefined") {
    return;
  }

  const AudioContextCtor = window.AudioContext;
  if (!AudioContextCtor) {
    return;
  }

  if (activeContext) {
    void activeContext.close();
    activeContext = null;
  }

  const context = new AudioContextCtor();
  activeContext = context;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(
    660,
    context.currentTime + 0.14
  );

  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.07, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.24);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.26);
  oscillator.onended = () => {
    void context.close();
    if (activeContext === context) {
      activeContext = null;
    }
  };
}
