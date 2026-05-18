import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import type { NoteCard as NoteCardType } from '../../shared/types';
import TagBadge from '../common/TagBadge';
import StarDone from '../common/StarDone';
import PixelCluster from '../common/PixelCluster';

interface NoteCardProps {
  note: NoteCardType;
  onDelete?: (id: string) => void;
}

function accentColor(status: NoteCardType['aiStatus']) {
  if (status === 'done') return 'var(--color-signal)';
  if (status === 'pending') return 'var(--color-pending)';
  return 'var(--color-failed)';
}

function domain(url: string | null) {
  if (!url) return '';
  try { return new URL(url).hostname; } catch { return url; }
}

export default function NoteCard({ note, onDelete }: NoteCardProps) {
  const navigate = useNavigate();

  const allTags = note.tags.map((t) => ({ label: t, variant: 'ai' as const }));

  const timeAgo = formatDistanceToNow(new Date(note.createdAt), { addSuffix: true, locale: zhTW });

  return (
    <div
      className={`memory-card${note.aiStatus === 'pending' ? ' pending-card' : ''}`}
      style={{
        borderLeft: `3px solid ${accentColor(note.aiStatus)}`,
        borderRadius: `0 var(--radius-card) var(--radius-card) 0`,
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        cursor: 'pointer',
      }}
      onClick={() => navigate(`/notes/${note.id}`)}
    >
      {/* Status indicator */}
      <div style={{ marginTop: 2, flexShrink: 0 }}>
        {note.aiStatus === 'done' && <StarDone />}
        {note.aiStatus === 'pending' && <PixelCluster />}
        {note.aiStatus === 'failed' && (
          <span style={{ fontSize: 13, color: 'var(--color-failed)' }}>✕</span>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Title */}
        <div
          style={{
            fontWeight: 600,
            fontSize: 14,
            color: 'var(--color-text-hi)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {note.aiTitle ?? (note.aiStatus === 'pending' ? 'AI 處理中...' : '無標題')}
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {allTags.slice(0, 4).map((t, i) => (
              <TagBadge key={i} label={t.label} variant={t.variant} />
            ))}
          </div>
        )}

        {/* Summary */}
        {note.aiSummary && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--color-text-mid)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {note.aiSummary}
          </div>
        )}

        {/* Meta */}
        <div style={{ fontSize: 11, color: 'var(--color-text-lo)', display: 'flex', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{domain(note.sourceUrl)}</span>
          <span>·</span>
          <span>{timeAgo}</span>
          <span>·</span>
          <span>{note.noteType === 'image' ? '🖼 截圖' : '📄 文字'}</span>
        </div>
      </div>

      {/* Actions */}
      {onDelete && (
        <button
          className="btn-ghost"
          style={{ fontSize: 12, padding: '4px 8px', flexShrink: 0 }}
          onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
        >
          刪除
        </button>
      )}
    </div>
  );
}
