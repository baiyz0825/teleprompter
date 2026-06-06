import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useStore } from '../store';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ open, onClose }: Props) {
  const { tpSettings, updateTpSettings, serverSettings, setServerSettings } =
    useStore();

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 z-50 flex h-full w-80 flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
              <h2 className="text-base font-semibold">设置</h2>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-card)] hover:text-[var(--color-text-primary)]"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              {/* Font Size */}
              <div>
                <label className="mb-2 flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
                  <span>字体大小</span>
                  <span className="text-[var(--color-text-primary)]">
                    {tpSettings.fontSize}px
                  </span>
                </label>
                <input
                  type="range"
                  min={24}
                  max={120}
                  step={2}
                  value={tpSettings.fontSize}
                  onChange={(e) =>
                    updateTpSettings({ fontSize: Number(e.target.value) })
                  }
                  className="w-full accent-[var(--color-accent)]"
                />
              </div>

              {/* Line Height */}
              <div>
                <label className="mb-2 flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
                  <span>行高</span>
                  <span className="text-[var(--color-text-primary)]">
                    {tpSettings.lineHeight.toFixed(1)}
                  </span>
                </label>
                <input
                  type="range"
                  min={1.0}
                  max={2.5}
                  step={0.1}
                  value={tpSettings.lineHeight}
                  onChange={(e) =>
                    updateTpSettings({ lineHeight: Number(e.target.value) })
                  }
                  className="w-full accent-[var(--color-accent)]"
                />
              </div>

              {/* Padding X */}
              <div>
                <label className="mb-2 flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
                  <span>水平边距</span>
                  <span className="text-[var(--color-text-primary)]">
                    {tpSettings.paddingX}px
                  </span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={200}
                  step={10}
                  value={tpSettings.paddingX}
                  onChange={(e) =>
                    updateTpSettings({ paddingX: Number(e.target.value) })
                  }
                  className="w-full accent-[var(--color-accent)]"
                />
              </div>

              {/* WPM (for auto mode) */}
              <div>
                <label className="mb-2 flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
                  <span>每分钟字数 (WPM)</span>
                  <span className="text-[var(--color-text-primary)]">
                    {tpSettings.wpm}
                  </span>
                </label>
                <input
                  type="range"
                  min={60}
                  max={400}
                  step={10}
                  value={tpSettings.wpm}
                  onChange={(e) =>
                    updateTpSettings({ wpm: Number(e.target.value) })
                  }
                  className="w-full accent-[var(--color-accent)]"
                />
              </div>

              {/* Mirror X */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">
                  水平镜像
                </span>
                <button
                  onClick={() =>
                    updateTpSettings({ mirrorModeX: !tpSettings.mirrorModeX })
                  }
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    tpSettings.mirrorModeX
                      ? 'bg-[var(--color-accent)]'
                      : 'bg-[var(--color-bg-card)]'
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      tpSettings.mirrorModeX ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Mirror Y */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">
                  垂直镜像
                </span>
                <button
                  onClick={() =>
                    updateTpSettings({ mirrorModeY: !tpSettings.mirrorModeY })
                  }
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    tpSettings.mirrorModeY
                      ? 'bg-[var(--color-accent)]'
                      : 'bg-[var(--color-bg-card)]'
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      tpSettings.mirrorModeY ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>

              {/* ASR WebSocket URL */}
              <div>
                <label className="mb-2 block text-sm text-[var(--color-text-secondary)]">
                  语音识别服务地址
                </label>
                <input
                  type="text"
                  value={serverSettings.asrWebSocketURL}
                  onChange={(e) =>
                    setServerSettings({
                      ...serverSettings,
                      asrWebSocketURL: e.target.value,
                    })
                  }
                  placeholder="wss://192.168.9.207:7860/ws/stream"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] outline-none transition-colors focus:border-[var(--color-accent)]"
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
