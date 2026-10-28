/** The hero sun behind the lineup: aura, two ray layers turning slowly in opposite directions, a lit disc and a double ring. */
export function Sun({ className = "" }: { className?: string }) {
  return (
    <div className={`sun ${className}`} aria-hidden="true">
      <div className="sun-aura" />
      <div className="sun-rays sun-rays-major" />
      <div className="sun-rays sun-rays-minor" />
      <div className="sun-disc" />
      <div className="sun-ring" />
    </div>
  );
}
