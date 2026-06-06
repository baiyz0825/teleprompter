export interface AsrClientOptions {
  url: string;
  model?: string;
}

export class FunAsrClient {
  private ws: WebSocket | null = null;

  onResult: ((text: string, accumulated: string, isFinal: boolean) => void) | null = null;
  onError: ((error: string) => void) | null = null;

  async connect(options: AsrClientOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(options.url);

        this.ws.onopen = () => {
          // 发送 config（协议要求的第一条消息）
          const config = {
            type: 'config',
            model: options.model || 'paraformer-streaming',
          };
          this.ws!.send(JSON.stringify(config));
          resolve();
        };

        this.ws.onmessage = (event) => {
          if (typeof event.data === 'string') {
            try {
              const result = JSON.parse(event.data);

              if (result.type === 'error') {
                this.onError?.(result.message || 'Unknown ASR error');
                return;
              }

              if (result.type === 'result') {
                this.onResult?.(
                  result.text || '',
                  result.accumulated || '',
                  result.is_final === true,
                );
              }
              // config_ack 等其他消息类型忽略
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

  sendAudio(pcmFloat32: ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Float32 PCM → Int16 PCM
    const float32 = new Float32Array(pcmFloat32);
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    // base64 编码
    const bytes = new Uint8Array(int16.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    // 发送 JSON 格式
    this.ws.send(JSON.stringify({ type: 'audio', data: base64 }));
  }

  end(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'end' }));
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
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
