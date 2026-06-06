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

    // base64 编码（分块处理避免单次字符串过大）
    const bytes = new Uint8Array(int16.buffer);
    const CHUNK = 8192;
    let base64 = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
      base64 += String.fromCharCode.apply(null, slice as unknown as number[]);
    }
    base64 = btoa(base64);

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
  sampleRate?: number; // target sample rate, default 16000
  onAudioData: (pcmFloat32: ArrayBuffer) => void;
}

export class AudioCapture {
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private targetRate = 16000;

  /**
   * Linear interpolation resample from sourceRate → targetRate
   */
  private resample(input: Float32Array, sourceRate: number): Float32Array {
    if (sourceRate === this.targetRate) return input;
    const ratio = sourceRate / this.targetRate;
    const outputLen = Math.floor(input.length / ratio);
    const output = new Float32Array(outputLen);
    for (let i = 0; i < outputLen; i++) {
      const srcIdx = i * ratio;
      const lo = Math.floor(srcIdx);
      const hi = Math.min(lo + 1, input.length - 1);
      const frac = srcIdx - lo;
      output[i] = input[lo] * (1 - frac) + input[hi] * frac;
    }
    return output;
  }

  async start(options: AudioCaptureOptions): Promise<void> {
    this.targetRate = options.sampleRate ?? 16000;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    // 优先请求目标采样率，现代浏览器通常会尊重这个设置
    this.audioCtx = new AudioContext({ sampleRate: this.targetRate });
    const actualRate = this.audioCtx.sampleRate;
    if (actualRate !== this.targetRate) {
      console.warn(`[AudioCapture] 浏览器未支持请求的采样率: 请求 ${this.targetRate}Hz, 实际 ${actualRate}Hz, 将进行重采样`);
    }

    const source = this.audioCtx.createMediaStreamSource(this.stream);

    // ScriptProcessorNode (deprecated but widely supported)
    this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const resampled = this.resample(inputData, actualRate);
      // Copy to a standalone ArrayBuffer (inputData is reused by the browser)
      const buffer = new ArrayBuffer(resampled.byteLength);
      new Float32Array(buffer).set(resampled);
      options.onAudioData(buffer);
    };

    source.connect(this.processor);
    // Connect to a silent gain node — avoids mic audio playing back through speakers
    const silent = this.audioCtx.createGain();
    silent.gain.value = 0;
    this.processor.connect(silent);
    silent.connect(this.audioCtx.destination);
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
