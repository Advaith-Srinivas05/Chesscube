// Three stacked cubes rising left to right: one more each day. Colour comes from currentColor.
export default function StreakIcon({ size = 20 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.5" y="15" width="5.5" height="6" rx="1" />
      <rect x="9.25" y="10" width="5.5" height="11" rx="1" />
      <rect x="16" y="4" width="5.5" height="17" rx="1" fill="currentColor" />
    </svg>
  );
}
