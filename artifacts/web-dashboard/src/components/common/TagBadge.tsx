interface TagBadgeProps {
  label: string;
  variant?: 'user' | 'ai';
}

export default function TagBadge({ label, variant = 'user' }: TagBadgeProps) {
  return (
    <span className={variant === 'ai' ? 'tag-purple' : 'tag-blue'}>
      {label}
    </span>
  );
}
