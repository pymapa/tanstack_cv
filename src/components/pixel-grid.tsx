/** The 3×3 pixel grid from the Kipinä logo mark. Decorative only (kipina-brand skill). */
const CELLS = ['#fff200', '#d8ff2b', '#b7fb2e', '#cbff2b', '#9ef534', '#5ff58c', '#7cf03c', '#4df5a0', '#00a896']

export function PixelGrid({ size = 18, className = '' }: { size?: number; className?: string }) {
  const cell = size / 3
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {CELLS.map((fill, i) => (
        <rect key={fill} x={(i % 3) * cell} y={Math.floor(i / 3) * cell} width={cell} height={cell} fill={fill} />
      ))}
    </svg>
  )
}
