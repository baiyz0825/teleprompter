import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import { ArrowLeft, Save, Play } from 'lucide-react';
import { toast } from 'sonner';
import { getScript, updateScript } from '../api';
import type { Script } from '../lib/types';

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [script, setScript] = useState<Script | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        const data = await getScript(id);
        setScript(data);
        setTitle(data.title);
        setContent(data.content);
      } catch {
        toast.error('加载稿件失败');
        navigate('/');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  const doSave = useCallback(async () => {
    if (!id || !dirtyRef.current) return;
    try {
      setSaving(true);
      await updateScript(id, { title, content });
      dirtyRef.current = false;
    } catch {
      toast.error('自动保存失败');
    } finally {
      setSaving(false);
    }
  }, [id, title, content]);

  // Schedule auto-save
  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(doSave, 3000);
  }, [doSave]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  function handleTitleChange(v: string) {
    setTitle(v);
    scheduleSave();
  }

  function handleContentChange(v: string | undefined) {
    setContent(v ?? '');
    scheduleSave();
  }

  async function handleManualSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    dirtyRef.current = true;
    await doSave();
    toast.success('已保存');
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg-primary)]">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/80 px-6 py-3 backdrop-blur-md">
        <button
          onClick={() => navigate('/')}
          className="rounded-lg p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-card)] hover:text-[var(--color-text-primary)]"
          title="返回"
        >
          <ArrowLeft size={20} />
        </button>

        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="稿件标题..."
          className="flex-1 bg-transparent text-lg font-semibold text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] outline-none"
        />

        <div className="flex items-center gap-2">
          {saving && (
            <span className="text-xs text-[var(--color-text-secondary)]">
              保存中...
            </span>
          )}
          <button
            onClick={handleManualSave}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
          >
            <Save size={14} />
            保存
          </button>
          <button
            onClick={() => navigate(`/prompter/${id}`)}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-success)] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-success)]/80"
          >
            <Play size={14} />
            开始提词
          </button>
        </div>
      </header>

      {/* Editor body */}
      <div className="flex-1 p-4" data-color-mode="dark">
        <MDEditor
          value={content}
          onChange={handleContentChange}
          height="calc(100vh - 64px)"
          preview="live"
        />
      </div>
    </div>
  );
}
