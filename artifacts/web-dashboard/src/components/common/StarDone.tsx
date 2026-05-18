interface StarDoneProps {
  size?: number;
}

export default function StarDone({ size = 14 }: StarDoneProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      style={{ animation: 'starAppear 0.4s ease-out forwards' }}
    >
      <polygon
        points="7,1 8.5,5.5 13,7 8.5,8.5 7,13 5.5,8.5 1,7 5.5,5.5"
        fill="var(--color-done)"
      />
    </svg>
  );
}
