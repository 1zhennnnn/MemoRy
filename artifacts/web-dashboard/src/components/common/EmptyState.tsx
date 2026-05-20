import Icon from './Icon';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Icon>['name'];

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon = 'note', title, description, action }: EmptyStateProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 48, color: 'var(--color-text-lo)', textAlign: 'center' }}>
      <div style={{ color: 'var(--color-text-lo)', opacity: 0.5 }}>
        <Icon name={icon} size={40} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-mid)' }}>{title}</div>
      {description && <div style={{ fontSize: 13, maxWidth: 320 }}>{description}</div>}
      {action && (
        <button className="btn-primary" style={{ marginTop: 8 }} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
