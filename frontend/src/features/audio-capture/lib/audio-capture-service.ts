import {
  calculateRMS,
  downsampleBuffer,
  interleaveAndEncodeTo16BitPCM,
} from "./pcm-encoder";

export interface AudioCaptureCallbacks {
  onPCMChunk?: (chunk: ArrayBuffer) => void;
  onVolumeChange?: (levels: { micVolume: number; tabVolume: number }) => void;
  onEnded?: (source: "mic" | "tab") => void;
  onError?: (error: Error) => void;
}

export class DualAudioCaptureService {
  private displayStream: MediaStream | null = null;
  private micStream: MediaStream | null = null;
  private tabStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private mergerNode: ChannelMergerNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private tabSource: MediaStreamAudioSourceNode | null = null;
  private dummyDestination: MediaStreamAudioDestinationNode | null = null;
  private isRunning: boolean = false;
  private targetSampleRate: number = 16000;

  constructor(targetSampleRate: number = 16000) {
    this.targetSampleRate = targetSampleRate;
  }

  /**
   * Prompts user for both DisplayMedia (Meet Tab Audio) and UserMedia (Mic).
   */
  async startCapture(callbacks: AudioCaptureCallbacks): Promise<{
    micStream: MediaStream;
    tabStream: MediaStream;
  }> {
    if (this.isRunning) {
      this.stop();
    }

    try {
      // 1. Capture Google Meet Tab Audio
      // Note: Video must be true in getDisplayMedia specifications, audio can capture tab sound.
      const tabDisplayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          suppressLocalAudioPlayback: false,
        },
        systemAudio: "include",
        selfBrowserSurface: "exclude",
      } as DisplayMediaStreamOptions);

      const tabAudioTracks = tabDisplayStream.getAudioTracks();
      if (tabAudioTracks.length === 0) {
        // Stop any video tracks opened
        tabDisplayStream.getTracks().forEach((t) => t.stop());
        throw new Error(
          "Meetタブの音声が選択されていません。「タブの音声を共有」にチェックを入れてください。"
        );
      }

      this.displayStream = tabDisplayStream;
      this.tabStream = new MediaStream(tabAudioTracks);

      // Listen for tab stream finish (e.g. user clicks "Stop sharing")
      tabDisplayStream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          if (callbacks.onEnded) callbacks.onEnded("tab");
        };
      });
      tabAudioTracks.forEach((track) => {
        track.onended = () => {
          if (callbacks.onEnded) callbacks.onEnded("tab");
        };
      });

      // 2. Capture Local Microphone (自社PM)
      const userMicStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.micStream = userMicStream;

      userMicStream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (callbacks.onEnded) callbacks.onEnded("mic");
        };
      });

      // 3. Setup Web Audio graph
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioCtx = new AudioCtx();
      this.audioContext = audioCtx;

      // Resume context if suspended (browser autoplay policy)
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      // Channel 0: Mic (Left), Channel 1: Tab (Right)
      const merger = audioCtx.createChannelMerger(2);
      this.mergerNode = merger;

      const micSource = audioCtx.createMediaStreamSource(this.micStream);
      this.micSource = micSource;
      micSource.connect(merger, 0, 0); // mic -> merger channel 0

      const tabSource = audioCtx.createMediaStreamSource(this.tabStream);
      this.tabSource = tabSource;
      tabSource.connect(merger, 0, 1); // tab -> merger channel 1

      // ScriptProcessorNode for standard 2ch PCM extraction & volume analysis
      // Buffer size 4096 gives approx ~85ms buffer at 48kHz
      const bufferSize = 4096;
      const processor = audioCtx.createScriptProcessor(bufferSize, 2, 2);
      this.processorNode = processor;

      processor.onaudioprocess = (event: AudioProcessingEvent) => {
        if (!this.isRunning) return;

        const leftInput = event.inputBuffer.getChannelData(0);
        const rightInput = event.inputBuffer.getChannelData(1);

        // Calculate volumes
        if (callbacks.onVolumeChange) {
          const micVol = calculateRMS(leftInput);
          const tabVol = calculateRMS(rightInput);
          callbacks.onVolumeChange({ micVolume: micVol, tabVolume: tabVol });
        }

        // Downsample to 16kHz
        const sourceRate = audioCtx.sampleRate;
        const downsampledLeft = downsampleBuffer(
          leftInput,
          sourceRate,
          this.targetSampleRate
        );
        const downsampledRight = downsampleBuffer(
          rightInput,
          sourceRate,
          this.targetSampleRate
        );

        // Interleave & Encode to 16-bit PCM (Left: Mic, Right: Tab)
        const pcmBuffer = interleaveAndEncodeTo16BitPCM(
          downsampledLeft,
          downsampledRight
        );

        if (callbacks.onPCMChunk) {
          callbacks.onPCMChunk(pcmBuffer);
        }
      };

      merger.connect(processor);

      // Connect to dummy destination so processor remains active without echoing to local speakers
      const dummyDest = audioCtx.createMediaStreamDestination();
      this.dummyDestination = dummyDest;
      processor.connect(dummyDest);

      this.isRunning = true;

      return {
        micStream: this.micStream,
        tabStream: this.tabStream,
      };
    } catch (err: unknown) {
      this.stop();
      const error =
        err instanceof Error ? err : new Error("音声キャプチャに失敗しました");
      if (callbacks.onError) {
        callbacks.onError(error);
      }
      throw error;
    }
  }

  stop(): void {
    this.isRunning = false;

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }

    if (this.mergerNode) {
      this.mergerNode.disconnect();
      this.mergerNode = null;
    }

    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }

    if (this.tabSource) {
      this.tabSource.disconnect();
      this.tabSource = null;
    }

    if (this.dummyDestination) {
      this.dummyDestination.disconnect();
      this.dummyDestination = null;
    }

    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }

    if (this.tabStream) {
      this.tabStream.getTracks().forEach((track) => track.stop());
      this.tabStream = null;
    }

    if (this.displayStream) {
      this.displayStream.getTracks().forEach((track) => track.stop());
      this.displayStream = null;
    }
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }
}
