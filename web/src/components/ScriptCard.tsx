import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Pencil, Trash2 } from 'lucide-react';
import type { Script } from '../lib/types';

interface Props {
  script: Script;
  onDelete: (id: string) => void;
}

function getPreview(content: string, maxLen = 120): string {
  // Strip markdown syntax for preview
  const plain = content
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*{1,3}(.+?)\*{1,3}/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')
    .replace(/\n+/g, ' ')
    .trim();
  return plain.length > maxLen ? plain.slice(0, maxLen) + '...' : plain;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin}分钟前`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}小时前`;
    return d.toLocaleDateString('zh-CN');
  } catch {
    return iso;
  }
}

export default function ScriptCard({ script, onDelete }: Props) {
  const navigate = useNavigate();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={() => navigate(`/editor/${script.id}`)}
      className="group relative cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 transition-colors hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-card-hover)]"
    >
      {/* Cover gradient bar */}
      <div className="mb-3 h-1 w-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />

      <h3 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)] truncate">
        {script.title || '未命名'}
      </h3>

      <p className="mb-4 text-sm leading-relaxed text-[var(--color-text-secondary)] line-clamp-3">
        {getPreview(script.content)}
      </p>

      {/* Start teleprompter button - always visible */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/prompter/${script.id}`);
        }}
        title="开始提词"
        className="relative z-10 mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
      >
        <Play size={14} />
        开始提词
      </button>

      <div className="relative z-10 flex items-center justify-between">
        <span className="text-xs text-[var(--color-text-secondary)]">
          {formatDate(script.updatedAt)}
        </span>

        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/editor/${script.id}`);
            }}
            title="编辑"
            className="rounded-lg p-2 text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/10"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(script.id);
            }}
            title="删除"
            className="rounded-lg p-2 text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)]/10"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
