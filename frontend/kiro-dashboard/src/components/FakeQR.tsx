/**
 * Deterministic stub QR code — a 21×21 grid with three corner markers.
 * Used wherever we'd render a real PIX BR Code in production.
 */
export function FakeQR({ size = 140 }: { size?: number }) {
  const N = 21;
  let seed = 12345;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const cells: { x: number; y: number; on: boolean }[] = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      cells.push({ x, y, on: rand() > 0.5 });
    }
  }
  const cs = size / N;
  const inMarker = (x: number, y: number) =>
    (x < 7 && y < 7) || (x > N - 8 && y < 7) || (x < 7 && y > N - 8);

  const marker = (cx: number, cy: number) => (
    <g key={`m-${cx}-${cy}`}>
      <rect x={cx * cs} y={cy * cs} width={7 * cs} height={7 * cs} fill="#0A0B10" />
      <rect x={(cx + 1) * cs} y={(cy + 1) * cs} width={5 * cs} height={5 * cs} fill="#FFFFFF" />
      <rect x={(cx + 2) * cs} y={(cy + 2) * cs} width={3 * cs} height={3 * cs} fill="#0A0B10" />
    </g>
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ background: '#FFFFFF', borderRadius: 10 }}
    >
      {cells.map(
        (c, i) =>
          c.on &&
          !inMarker(c.x, c.y) && (
            <rect
              key={i}
              x={c.x * cs}
              y={c.y * cs}
              width={cs * 0.9}
              height={cs * 0.9}
              fill="#0A0B10"
            />
          ),
      )}
      {marker(0, 0)}
      {marker(N - 7, 0)}
      {marker(0, N - 7)}
      {/* Center K isotype */}
      <rect
        x={(N / 2 - 2) * cs}
        y={(N / 2 - 2) * cs}
        width={4 * cs}
        height={4 * cs}
        fill="#FFFFFF"
      />
      <text
        x={size / 2}
        y={size / 2 + 4 * cs * 0.15}
        textAnchor="middle"
        fontFamily="Space Grotesk, sans-serif"
        fontWeight={700}
        fontSize={cs * 3.2}
        fill="#00B85F"
      >
        K
      </text>
    </svg>
  );
}
