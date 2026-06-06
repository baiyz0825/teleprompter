import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Monitor, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { nanoid } from 'nanoid';
import ScriptCard from '../components/ScriptCard';
import { listScripts, createScript, deleteScript } from '../api';
import { useStore } from '../store';
import type { Script } from '../lib/types';

export default function Home() {
  const navigate = useNavigate();
  const { serverSettings, setServerSettings } = useStore();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [asrTestStatus, setAsrTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [asrTestMsg, setAsrTestMsg] = useState('');

  useEffect(() => {
    loadScripts();
  }, []);

  async function loadScripts() {
    try {
      setLoading(true);
      const data = await listScripts();
      setScripts(data);
    } catch {
      toast.error('加载稿件失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleNew() {
    try {
      const id = nanoid();
      const script = await createScript({
        title: '未命名稿件',
        content: '# 新稿件\n\n在此开始编写...',
      });
      navigate(`/editor/${script.id}`);
    } catch {
      toast.error('创建稿件失败');
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteScript(id);
      setScripts((prev) => prev.filter((s) => s.id !== id));
      toast.success('稿件已删除');
    } catch {
      toast.error('删除稿件失败');
    }
  }

  function testAsrConnection() {
    const url = serverSettings.asrWebSocketURL;
    if (!url) {
      toast.error('请先填写语音识别服务地址');
      return;
    }
    setAsrTestStatus('testing');
    setAsrTestMsg('');
    try {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => {
        ws.close();
        setAsrTestStatus('error');
        setAsrTestMsg('连接超时 (5秒)');
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timer);
        setAsrTestStatus('success');
        setAsrTestMsg('连接成功！服务正常运行');
        ws.close();
      };
      ws.onerror = () => {
        clearTimeout(timer);
        setAsrTestStatus('error');
        setAsrTestMsg('连接失败，请检查地址和服务状态');
      };
      ws.onclose = (e) => {
        clearTimeout(timer);
        if (asrTestStatus === 'testing') {
          setAsrTestStatus('error');
          setAsrTestMsg(`连接关闭 (code: ${e.code})`);
        }
      };
    } catch {
      setAsrTestStatus('error');
      setAsrTestMsg('无效的 WebSocket 地址');
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return scripts;
    const q = search.toLowerCase();
    return scripts.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.content.toLowerCase().includes(q),
    );
  }, [scripts, search]);

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Monitor className="text-[var(--color-accent)]" size={28} />
            <h1 className="text-xl font-bold tracking-tight">提词器</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]"
                size={16}
              />
              <input
                type="text"
                placeholder="搜索稿件..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-2 pl-9 pr-4 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] outline-none transition-colors focus:border-[var(--color-accent)] w-64"
              />
            </div>

            <button
              onClick={handleNew}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
            >
              <Plus size={16} />
              新建稿件
            </button>

            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded-lg p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-card)] hover:text-[var(--color-text-primary)]"
              title="设置"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <Monitor className="mb-4 text-[var(--color-text-secondary)]" size={48} />
            <h2 className="mb-2 text-lg font-medium">暂无稿件</h2>
            <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
              创建你的第一篇稿件开始使用
            </p>
            <button
              onClick={handleNew}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
            >
              <Plus size={16} />
              新建稿件
            </button>
          </motion.div>
        ) : (
          <motion.div
            layout
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <AnimatePresence mode="popLayout">
              {filtered.map((script) => (
                <ScriptCard
                  key={script.id}
                  script={script}
                  onDelete={handleDelete}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      {/* ASR 设置面板 */}
      <AnimatePresence>
        {settingsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60"
              onClick={() => setSettingsOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 z-50 flex h-full w-80 flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
            >
              <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
                <h2 className="text-base font-semibold">设置</h2>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="rounded-lg p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-card)] hover:text-[var(--color-text-primary)]"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
                {/* ASR 语音识别服务地址 */}
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
                  <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                    FunASR 实时语音识别 WebSocket 地址，用于语音跟读模式。
                  </p>

                  {/* 测试连接 */}
                  <div className="mt-3">
                    <button
                      onClick={testAsrConnection}
                      disabled={asrTestStatus === 'testing'}
                      className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
                    >
                      {asrTestStatus === 'testing' ? (
                        <>
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          测试中...
                        </>
                      ) : (
                        '测试连接'
                      )}
                    </button>
                    {asrTestStatus !== 'idle' && asrTestStatus !== 'testing' && (
                      <p className={`mt-2 text-xs ${asrTestStatus === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                        {asrTestStatus === 'success' ? '✓ ' : '✗ '}{asrTestMsg}
                      </p>
                    )}
                  </div>
                </div>

                {/* 服务信息 */}
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
                  <h3 className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">
                    关于语音跟读
                  </h3>
                  <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
                    语音跟读模式通过 FunASR 实时识别你的朗读声音，自动滚动提词器跟随你的进度。
                    需要部署 FunASR 服务并配置上方地址。
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
