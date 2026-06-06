import { create } from 'zustand';
import type { TeleprompterSettings, Settings } from '../lib/types';

const STORAGE_KEY_TP = 'teleprompter-settings';
const STORAGE_KEY_CURSOR = 'teleprompter-cursor';

function loadTpSettings(): TeleprompterSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_TP);
    if (saved) return { ...defaultTpSettings(), ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return defaultTpSettings();
}

function defaultTpSettings(): TeleprompterSettings {
  return {
    fontSize: 48,
    lineHeight: 1.6,
    mirrorModeX: false,
    mirrorModeY: false,
    paddingX: 80,
    scrollMode: 'manual',
    wpm: 150,
    isScrolling: false,
    useResponsivePreset: true,
  };
}

function loadCursorPositions(): Record<string, number> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CURSOR);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return {};
}

interface AppState {
  tpSettings: TeleprompterSettings;
  updateTpSettings: (patch: Partial<TeleprompterSettings>) => void;

  cursorPositions: Record<string, number>;
  setCursorPosition: (scriptId: string, pos: number) => void;

  serverSettings: Settings;
  setServerSettings: (s: Settings) => void;
}

export const useStore = create<AppState>((set, get) => ({
  tpSettings: loadTpSettings(),
  updateTpSettings: (patch) => {
    set((s) => {
      const next = { ...s.tpSettings, ...patch };
      localStorage.setItem(STORAGE_KEY_TP, JSON.stringify(next));
      return { tpSettings: next };
    });
  },

  cursorPositions: loadCursorPositions(),
  setCursorPosition: (scriptId, pos) => {
    set((s) => {
      const next = { ...s.cursorPositions, [scriptId]: pos };
      localStorage.setItem(STORAGE_KEY_CURSOR, JSON.stringify(next));
      return { cursorPositions: next };
    });
  },

  serverSettings: { asrWebSocketURL: 'ws://localhost:7860/ws/stream' },
  setServerSettings: (serverSettings) => set({ serverSettings }),
}));
