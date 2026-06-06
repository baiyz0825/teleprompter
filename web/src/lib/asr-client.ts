export interface AsrClientOptions {
  url: string;
  model?: string;
  language?: string;
}

export class FunAsrClient {
  private ws: WebSocket | null = null;
  private streamStarted = false;

  onResult: ((text: string, isFinal: boolean) => void) | null = null;
  onError: ((error: string) => void) | null = null;

  async connect(options: AsrClientOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(options.url);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
          this.streamStarted = false;
          // Send initial config
          const config = {
            mode: 'online',
            chunk_size: [5, 10, 5],
            wav_name: 'microphone',
            is_speaking: true,
            itn: true,
            ...(options.model && { model: options.model }),
            ...(options.language && { language: options.language }),
          };
          this.ws!.send(JSON.stringify(config));
          resolve();
        };

        this.ws.onmessage = (event) => {
          if (typeof event.data === 'string') {
            try {
              const result = JSON.parse(event.data);
              if (result.text !== undefined) {
                const isFinal = result.is_final === true || result.mode === '2pass-online';
                this.onResult?.(result.text, isFinal);
              }
            } catch { /* ignore parse errors */ }
          }
        };

        this.ws.onerror = () => {
          this.onError?.('WebSocket error');
          reject(new Error('WebSocket error'));
        };

        this.ws.onclose = () => {
          this.ws = null;
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  sendAudio(pcmData: ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    // Convert float32 PCM to int16 then base64
    const float32 = new Float32Array(pcmData);
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    // Send as binary (raw int16 bytes)
    this.ws.send(int16.buffer);
  }

  end(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ is_speaking: false }));
    this.streamStarted = false;
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.streamStarted = false;
  }
}

export interface AudioCaptureOptions {
  sampleRate?: number; // default 16000
  onAudioData: (pcmFloat32: ArrayBuffer) => void;
}

export class AudioCapture {
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;

  async start(options: AudioCaptureOptions): Promise<void> {
    const sampleRate = options.sampleRate ?? 16000;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    this.audioCtx = new AudioContext({ sampleRate });
    const source = this.audioCtx.createMediaStreamSource(this.stream);

    // ScriptProcessorNode (deprecated but widely supported)
    // bufferSize 4096, 1 input channel, 1 output channel
    this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      // Copy the data (it gets reused)
      const buffer = new ArrayBuffer(inputData.byteLength);
      new Float32Array(buffer).set(inputData);
      options.onAudioData(buffer);
    };

    source.connect(this.processor);
    this.processor.connect(this.audioCtx.destination);
  }

  stop(): void {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }
}
