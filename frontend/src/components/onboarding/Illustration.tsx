/** Original welcome artwork: a phone with two chat bubbles and a lock badge (no third-party artwork). */
export function Illustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 240" className={className} role="img" aria-label="A phone showing a private conversation">
      <defs>
        <linearGradient id="scr" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#2c4fb0" />
        </linearGradient>
      </defs>
      <circle cx="120" cy="120" r="108" fill="currentColor" opacity="0.06" />
      <rect x="66" y="22" width="108" height="196" rx="20" fill="#f4f5f8" />
      <rect x="73" y="34" width="94" height="172" rx="13" fill="url(#scr)" />
      <rect x="107" y="26" width="26" height="4" rx="2" fill="#c9ccd6" />
      <g>
        <rect x="82" y="62" width="62" height="26" rx="13" fill="#ffffff" />
        <circle cx="96" cy="75" r="2.6" fill="#9aa3b8" /><circle cx="106" cy="75" r="2.6" fill="#9aa3b8" /><circle cx="116" cy="75" r="2.6" fill="#9aa3b8" />
        <rect x="98" y="100" width="62" height="26" rx="13" fill="#e8527c" />
        <rect x="108" y="110" width="42" height="5" rx="2.5" fill="#ffffff" opacity="0.85" />
        <rect x="82" y="138" width="50" height="26" rx="13" fill="#ffffff" />
        <rect x="92" y="148" width="30" height="5" rx="2.5" fill="#9aa3b8" />
        <rect x="76" y="176" width="78" height="22" rx="11" fill="#ffffff" opacity="0.2" />
      </g>
      <g transform="translate(150 150)">
        <circle r="24" fill="#f29d38" />
        <rect x="-9" y="-4" width="18" height="14" rx="3" fill="#ffffff" />
        <path d="M-5 -4v-4a5 5 0 0 1 10 0v4" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}
