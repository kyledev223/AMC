/** The gold ring with conic rays. Position it with className or style. */
export function Halo({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`halo ${className}`} style={style} aria-hidden="true" />;
}
