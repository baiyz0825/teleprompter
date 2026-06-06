import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Settings,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Hand,
  Gauge,
  Mic,
  MicOff,
  Maximize,
  Minimize,
} from 'lucide-react';
import { toast } from 'sonner';
import { getScript } from '../api';
import { useStore } from '../store';
import { FunAsrClient, AudioCapture } from '../lib/asr-client';
import { alignText } from '../lib/alignment';
import SettingsPanel from './SettingsPanel';
import type { Script } from '../lib/types';

/** Convert markdown to plain text for character-by-character rendering */
function mdToPlainText(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '') // headings
    .replace(/\*{1,3}(.+?)\*{1,3}/g, '$1') // bold/italic
    .replace(/`{1,3}[^`]*`{1,3}/g, '') // code blocks
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '') // images
    .replace(/^[-*+]\s+/gm, '') // list markers
    .replace(/^\d+\.\s+/gm, '') // ordered list
    .replace(/^>\s+/gm, '') // blockquotes
    .replace(/---+/g, '') // horizontal rules
    .replace(/\n{2,}/g, '\n') // multiple newlines
    .trim();
}

type ScrollMode = 'manual' | 'auto' | 'asr';

export default function TeleprompterView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    tpSettings,
    updateTpSettings,
    cursorPositions,
    setCursorPosition,
    serverSettings,
  } = useStore();

  const [script, setScript] = useState<Script | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Teleprompter state
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scrollMode, setScrollMode] = useState<ScrollMode>(tpSettings.scrollMode);

  // ASR state
  const [asrConnected, setAsrConnected] = useState(false);
  const [asrText, setAsrText] = useState('');
  const asrClientRef = useRef<FunAsrClient | null>(null);
  const audioCaptureRef = useRef<AudioCapture | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const charRefs = useRef<Map<number, HTMLSpanElement>>(new Map());
  const autoScrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Immersive / fullscreen mode
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [speedPopupOpen, setSpeedPopupOpen] = useState(false);
  const speedPopupRef = useRef<HTMLDivElement>(null);

  const speedPresets = [
    { label: '慢速', wpm: 80 },
    { label: '标准', wpm: 160 },
    { label: '快语', wpm: 240 },
    { label: '极速', wpm: 320 },
    { label: '直播', wpm: 345 },
  ];

  // Plain text characters
  const plainText = useMemo(
    () => (script ? mdToPlainText(script.content) : ''),
    [script],
  );
  const totalChars = plainText.length;

  // Load script
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        const data = await getScript(id);
        setScript(data);
        // Restore cursor
        const saved = cursorPositions[id] ?? 0;
        setCurrentCharIndex(Math.min(saved, mdToPlainText(data.content).length - 1));
      } catch {
        toast.error('加载稿件失败');
        navigate('/');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  // Persist cursor
  useEffect(() => {
    if (id) setCursorPosition(id, currentCharIndex);
  }, [id, currentCharIndex, setCursorPosition]);

  // Scroll current char into view
  const scrollToChar = useCallback((idx: number) => {
    const el = charRefs.current.get(idx);
    if (el && containerRef.current) {
      const container = containerRef.current;
      const elTop = el.offsetTop;
      const containerHeight = container.clientHeight;
      // Position the current char at 1/3 from top (reading zone)
      container.scrollTo({
        top: elTop - containerHeight / 3,
        behavior: 'smooth',
      });
    }
  }, []);

  useEffect(() => {
    scrollToChar(currentCharIndex);
  }, [currentCharIndex, scrollToChar]);

  // Auto-scroll mode
  useEffect(() => {
    if (scrollMode === 'auto' && isPlaying) {
      // Calculate interval based on WPM
      // Average Chinese char ~= 1 word, English word ~= 5 chars
      // Simplified: 1 char per (60/wpm) seconds for Chinese
      const charsPerSecond = tpSettings.wpm / 60;
      const intervalMs = Math.max(16, Math.round(1000 / charsPerSecond));

      autoScrollTimerRef.current = setInterval(() => {
        setCurrentCharIndex((prev) => {
          if (prev >= totalChars - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, intervalMs);
    }
    return () => {
      if (autoScrollTimerRef.current) {
        clearInterval(autoScrollTimerRef.current);
        autoScrollTimerRef.current = null;
      }
    };
  }, [scrollMode, isPlaying, tpSettings.wpm, totalChars]);

  // ASR mode
  async function startAsr() {
    try {
      const client = new FunAsrClient();
      asrClientRef.current = client;

      client.onResult = (text: string, isFinal: boolean) => {
        setAsrText((prev) => (isFinal ? '' : prev + text));

        if (script) {
          const result = alignText(
            script.content,
            asrText + text,
            currentCharIndex,
          );
          if (result.confidence > 0.3) {
            setCurrentCharIndex(result.charIndex);
          }
        }
      };

      client.onError = (err: string) => {
        toast.error(`语音识别错误: ${err}`);
        setAsrConnected(false);
      };

      await client.connect({ url: serverSettings.asrWebSocketURL });

      const capture = new AudioCapture();
      audioCaptureRef.current = capture;
      await capture.start({
        sampleRate: 16000,
        onAudioData: (pcm) => client.sendAudio(pcm),
      });

      setAsrConnected(true);
      setIsPlaying(true);
      toast.success('语音识别已连接');
    } catch (err) {
      toast.error(`启动语音识别失败: ${err}`);
      setAsrConnected(false);
    }
  }

  function stopAsr() {
    audioCaptureRef.current?.stop();
    audioCaptureRef.current = null;
    asrClientRef.current?.end();
    asrClientRef.current?.disconnect();
    asrClientRef.current = null;
    setAsrConnected(false);
    setIsPlaying(false);
    setAsrText('');
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAsr();
    };
  }, []);

  // Close speed popup on outside click
  useEffect(() => {
    if (!speedPopupOpen) return;
    function handleClick(e: MouseEvent) {
      if (speedPopupRef.current && !speedPopupRef.current.contains(e.target as Node)) {
        setSpeedPopupOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [speedPopupOpen]);

  // Exit immersive mode on Escape key
  useEffect(() => {
    if (!immersiveMode) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setImmersiveMode(false);
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [immersiveMode]);

  // Sync state when user exits fullscreen via browser controls
  useEffect(() => {
    function handleFullscreenChange() {
      if (!document.fullscreenElement && immersiveMode) {
        setImmersiveMode(false);
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [immersiveMode]);

  // Fullscreen toggle
  function toggleImmersive() {
    if (immersiveMode) {
      setImmersiveMode(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } else {
      setImmersiveMode(true);
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    }
  }

  // Scroll mode switch
  function switchMode(mode: ScrollMode) {
    if (scrollMode === 'asr' && mode !== 'asr') {
      stopAsr();
    }
    setScrollMode(mode);
    setIsPlaying(false);
    if (mode === 'asr') {
      startAsr();
    }
  }

  // Controls
  function togglePlay() {
    if (scrollMode === 'asr') {
      if (asrConnected) {
        stopAsr();
      } else {
        startAsr();
      }
      return;
    }
    setIsPlaying((p) => !p);
  }

  function skipForward() {
    setCurrentCharIndex((prev) => Math.min(totalChars - 1, prev + 50));
  }

  function skipBack() {
    setCurrentCharIndex((prev) => Math.max(0, prev - 50));
  }

  function handleCharClick(idx: number) {
    setCurrentCharIndex(idx);
    if (scrollMode === 'manual') {
      setIsPlaying(false);
    }
  }

  const progress = totalChars > 0 ? ((currentCharIndex + 1) / totalChars) * 100 : 0;

  // Transform styles for mirroring
  const mirrorTransform = [
    tpSettings.mirrorModeX ? 'scaleX(-1)' : '',
    tpSettings.mirrorModeY ? 'scaleY(-1)' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
      </div>
    );
  }

  if (!script) return null;

  return (
    <div className="flex h-screen flex-col bg-black text-white select-none">
      {/* Top info bar */}
      {!immersiveMode && (
        <div className="flex items-center justify-between bg-black/80 px-4 py-2 backdrop-blur-sm z-10">
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-sm font-medium text-gray-300 truncate max-w-[40%]">
            {script.title}
          </h1>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>{totalChars} 字</span>
            <span>{progress.toFixed(1)}%</span>
            <button
              onClick={toggleImmersive}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              title="全屏沉浸模式"
            >
              <Maximize size={18} />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="h-0.5 bg-gray-800">
        <motion.div
          className="h-full bg-blue-500"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Reading zone indicator + text area */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-y-auto"
        style={{ padding: `0 ${tpSettings.paddingX}px` }}
      >
        {/* Reading zone border indicator */}
        <div
          className="pointer-events-none fixed left-0 right-0 z-20 border-y-2 border-yellow-400/40"
          style={{
            top: 'calc(33.33vh - 2px)',
            height: 'calc(33.33vh + 4px)',
          }}
        />

        {/* Spacer for initial scroll */}
        <div style={{ height: '33vh' }} />

        {/* Character-by-character rendering */}
        <div
          className="whitespace-pre-wrap break-all"
          style={{
            fontSize: `${tpSettings.fontSize}px`,
            lineHeight: tpSettings.lineHeight,
            transform: mirrorTransform || undefined,
          }}
        >
          {plainText.split('').map((char, i) => {
            const isCurrent = i === currentCharIndex;
            const isPast = i < currentCharIndex;
            return (
              <span
                key={i}
                ref={(el) => {
                  if (el) charRefs.current.set(i, el);
                  else charRefs.current.delete(i);
                }}
                onClick={() => handleCharClick(i)}
                className={`cursor-pointer transition-colors duration-100 ${
                  isCurrent
                    ? 'text-yellow-300'
                    : isPast
                      ? 'text-white/70'
                      : 'text-white/30'
                }`}
                style={
                  isCurrent
                    ? {
                        textShadow: '0 0 8px rgba(250, 204, 21, 0.5)',
                      }
                    : undefined
                }
              >
                {char}
              </span>
            );
          })}
        </div>

        {/* Bottom spacer */}
        <div style={{ height: '50vh' }} />
      </div>

      {/* ASR recognized text */}
      {!immersiveMode && scrollMode === 'asr' && asrText && (
        <div className="bg-gray-900/80 px-4 py-2 text-center text-sm text-gray-400 backdrop-blur-sm">
          <Mic className="mr-2 inline-block text-green-400" size={14} />
          {asrText}
        </div>
      )}

      {/* Bottom toolbar */}
      {!immersiveMode && (
        <div className="flex items-center justify-between border-t border-gray-800 bg-black/80 px-4 py-3 backdrop-blur-sm">
          {/* Mode switches */}
          <div className="flex gap-1">
            {(
              [
                { mode: 'manual' as const, icon: Hand, label: '手动' },
                { mode: 'auto' as const, icon: Gauge, label: '自动' },
                { mode: 'asr' as const, icon: Mic, label: '语音跟读' },
              ] as const
            ).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => switchMode(mode)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  scrollMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Playback controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={skipBack}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <SkipBack size={18} />
            </button>
            <button
              onClick={togglePlay}
              className="rounded-full bg-white p-3 text-black transition-transform hover:scale-105"
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button
              onClick={skipForward}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <SkipForward size={18} />
            </button>
          </div>

          {/* Status / speed control */}
          <div className="relative text-xs text-gray-500" ref={speedPopupRef}>
            {scrollMode === 'asr' ? (
              asrConnected ? (
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                  正在聆听
                </span>
              ) : (
                <button
                  onClick={startAsr}
                  className="flex items-center gap-1 text-gray-400 hover:text-white"
                >
                  <MicOff size={14} />
                  连接
                </button>
              )
            ) : scrollMode === 'auto' ? (
              <>
                <button
                  onClick={() => setSpeedPopupOpen((p) => !p)}
                  className="rounded-lg px-2 py-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {tpSettings.wpm} WPM
                </button>
                {speedPopupOpen && (
                  <div className="absolute bottom-full right-0 mb-2 w-48 rounded-lg border border-gray-700 bg-gray-900 p-3 shadow-xl z-30">
                    <div className="mb-2 text-[11px] text-gray-400">语速预设</div>
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {speedPresets.map((p) => (
                        <button
                          key={p.wpm}
                          onClick={() => {
                            updateTpSettings({ wpm: p.wpm });
                            setSpeedPopupOpen(false);
                          }}
                          className={`rounded-md px-2 py-1 text-[11px] transition-colors ${
                            tpSettings.wpm === p.wpm
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <div className="mb-1 flex items-center justify-between text-[11px] text-gray-400">
                      <span>自定义</span>
                      <span>{tpSettings.wpm} WPM</span>
                    </div>
                    <input
                      type="range"
                      min={60}
                      max={400}
                      step={10}
                      value={tpSettings.wpm}
                      onChange={(e) => updateTpSettings({ wpm: Number(e.target.value) })}
                      className="w-full accent-blue-500"
                    />
                  </div>
                )}
              </>
            ) : (
              <span>手动</span>
            )}
          </div>
        </div>
      )}

      {/* Immersive mode floating close button */}
      {immersiveMode && (
        <button
          onClick={toggleImmersive}
          className="fixed top-4 right-4 z-50 rounded-full bg-black/50 p-2 text-white/60 transition-colors hover:bg-black/80 hover:text-white"
          title="退出沉浸模式 (Esc)"
        >
          <Minimize size={18} />
        </button>
      )}

      {/* Settings panel */}
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
