export default function BrandMark() {
  return (
    <svg viewBox="0 0 42 48" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="brandMint" x1="4" y1="6" x2="35" y2="43">
          <stop stopColor="#83d5bb" />
          <stop offset="1" stopColor="#138f7c" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="6" r="4.5" fill="#67bfa2" />
      <path
        d="M8 13 28 33M7 32 33 12M19 42 29 31"
        stroke="url(#brandMint)"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <path d="M8 32 32 12" stroke="#effff9" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
