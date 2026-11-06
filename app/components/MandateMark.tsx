// The Mandate mark: a dial that stops short of completing its circle — a
// cap, drawn. The accent dot is where the allowance runs out.
export function MandateMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        d="M28 16A12 12 0 1 1 16 4"
        stroke="currentColor"
        strokeWidth="3.25"
        strokeLinecap="round"
      />
      <circle cx="28" cy="16" r="2.5" fill="#00ec97" />
    </svg>
  );
}
