// Simple line icons for rating categories. Colour comes from currentColor.
const PATHS = {
  bullet: (
    <>
      <path d="M9 8h5.5a4.5 4 0 0 1 0 8H9z" />
      <path d="M9 8v8M3 10.5h3.5M2 13.5h4.5" />
    </>
  ),
  blitz: <path d="M13.5 2.5 5.5 13h6l-1.5 8.5 8.5-11h-6z" />,
  rapid: (
    <>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 13.5V9.5M10 2.5h4M12 2.5V6M18 7l1.5-1.5" />
    </>
  ),
  classical: <path d="M6.5 3h11M6.5 21h11M8 3c0 4.5 4 6 4 9s-4 4.5-4 9M16 3c0 4.5-4 6-4 9s4 4.5 4 9" />,
  chess960: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <g fill="currentColor" stroke="none">
        <circle cx="8.25" cy="8.25" r="1.4" />
        <circle cx="12" cy="12" r="1.4" />
        <circle cx="15.75" cy="15.75" r="1.4" />
      </g>
    </>
  ),
  puzzle: <path d="M4.5 8.5h3.2a2.3 2.3 0 1 1 4.6 0h3.2v3.2a2.3 2.3 0 1 1 0 4.6v3.2h-11z" />,
};

export default function CategoryIcon({ category, size = 22, className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[category]}
    </svg>
  );
}
