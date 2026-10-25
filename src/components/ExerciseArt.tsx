export default function ExerciseArt({ type, large = false }: { type: string; large?: boolean }) {
  return (
    <svg
      className={`exercise-art ${large ? 'large' : ''}`}
      viewBox="0 0 160 150"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="80" cy="133" rx="57" ry="7" fill="currentColor" opacity=".1" />
      {type === 'knee' ? (
        <>
          <path d="M31 73h22v55M32 94h23" stroke="#8CADA4" strokeWidth="5" strokeLinecap="round" />
          <circle cx="87" cy="25" r="12" fill="#F4C5A5" />
          <path d="M84 43l-5 44h24" stroke="#148B7B" strokeWidth="21" strokeLinecap="round" />
          <path d="M80 53L59 77H43" stroke="#F4C5A5" strokeWidth="10" strokeLinecap="round" />
          <path
            d="M82 88l-1 36M101 88l22 16-15 20"
            stroke="#294D49"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path d="M73 128h14m14 0h14" stroke="#FCFCF6" strokeWidth="8" strokeLinecap="round" />
          <path
            d="M123 71c14 12 15 23 11 33m-1-1 8-5m-8 6-4-8"
            stroke="#5AB9A2"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      ) : type === 'shoulder' ? (
        <>
          <circle cx="79" cy="28" r="12" fill="#F4C5A5" />
          <path d="M79 51v41" stroke="#D78E71" strokeWidth="27" strokeLinecap="round" />
          <path
            d="M65 53L43 33l-9-19M92 54l23-24 9-19"
            stroke="#F4C5A5"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M70 95l-5 30m24-30 7 30"
            stroke="#294D49"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path d="M56 130h14m20 0h14" stroke="#FCFCF6" strokeWidth="8" strokeLinecap="round" />
          <path
            d="M25 64c-9-10-10-23-7-32m0 0-6 6m6-6 4 8M132 65c11-13 11-23 8-33"
            stroke="#D49C80"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <circle cx="82" cy="26" r="12" fill="#F4C5A5" />
          <path d="M80 50v42" stroke="#8B85B8" strokeWidth="27" strokeLinecap="round" />
          <path
            d="M68 55L50 77l-12-29M94 54l19 28 13-28"
            stroke="#F4C5A5"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M72 96l-5 29m21-29 7 29"
            stroke="#294D49"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path d="M59 130h14m17 0h14" stroke="#FCFCF6" strokeWidth="8" strokeLinecap="round" />
          <path
            d="M20 72c-7-10-6-22 0-30m-1 1-7 3m7-3 2 8"
            stroke="#9F98C3"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}
