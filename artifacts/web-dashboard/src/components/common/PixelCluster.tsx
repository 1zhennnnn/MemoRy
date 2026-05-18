const GRID = 3;
const CELL = 4;
const GAP = 2;

export default function PixelCluster() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${GRID}, ${CELL}px)`,
        gap: GAP,
      }}
    >
      {Array.from({ length: GRID * GRID }).map((_, i) => (
        <div
          key={i}
          className="status-pending"
          style={{
            width: CELL,
            height: CELL,
            background: 'var(--color-pending)',
            borderRadius: 1,
            animationDelay: `${(i * 0.15) % 1.5}s`,
          }}
        />
      ))}
    </div>
  );
}
