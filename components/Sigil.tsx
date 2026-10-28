export function Sigil({ className = "" }: { className?: string }) {
  return (
    <span className={`sigil ${className}`} aria-hidden="true">
      A
    </span>
  );
}
