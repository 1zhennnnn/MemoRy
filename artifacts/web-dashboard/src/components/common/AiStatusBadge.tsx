import type { AiStatus } from '../../shared/types';

interface AiStatusBadgeProps {
  status: AiStatus;
}

const CONFIG = {
  done:    { color: 'var(--color-done)',    label: '完成',   pulse: false },
  pending: { color: 'var(--color-pending)', label: '處理中', pulse: true  },
  failed:  { color: 'var(--color-failed)',  label: '失敗',   pulse: false },
} as const;

export default function AiStatusBadge({ status }: AiStatusBadgeProps) {
  const { color, label, pulse } = CONFIG[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span
        className={pulse ? 'status-pending' : ''}
        style={{
          display: 'inline-block',
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 11, color }}>{label}</span>
    </span>
  );
}
