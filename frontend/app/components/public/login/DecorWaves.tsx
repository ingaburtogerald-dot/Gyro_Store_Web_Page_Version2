export function DecorWaves() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden text-accent/[0.06]">
      <svg className="absolute -left-24 -top-24 h-[520px] w-[520px]" viewBox="0 0 400 400" fill="none">
        <circle cx="200" cy="200" r="150" stroke="currentColor" strokeWidth="1" />
        <circle cx="200" cy="200" r="110" stroke="currentColor" strokeWidth="1" />
        <circle cx="200" cy="200" r="70" stroke="currentColor" strokeWidth="1" />
      </svg>
      <svg className="absolute -bottom-32 -right-24 h-[560px] w-[560px]" viewBox="0 0 400 400" fill="none">
        <path d="M0 300 Q100 220 200 300 T400 300" stroke="currentColor" strokeWidth="1" />
        <path d="M0 340 Q100 260 200 340 T400 340" stroke="currentColor" strokeWidth="1" />
      </svg>
    </div>
  );
}
