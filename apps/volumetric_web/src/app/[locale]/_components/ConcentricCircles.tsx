export function ConcentricCircles() {
  const circles = [80, 140, 210, 290, 380, 480, 600];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none top-0">
      <div className="absolute left-1/2  -translate-x-1/2 -translate-y-1/2 w-[2600px] h-[1600px]">
        {circles.map((size, i) => (
          <div
            key={size}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/20"
            style={{
              width: size,
              height: size,
              opacity: 1 - i * 0.12,
            }}
          />
        ))}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at center, transparent 0%, transparent 20%, hsl(var(--background)) 70%)",
          }}
        />
      </div>
    </div>
  );
}
