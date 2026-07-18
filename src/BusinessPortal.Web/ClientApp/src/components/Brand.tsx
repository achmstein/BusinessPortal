// Ported verbatim from the original app's components/brand.tsx.

export function BrandMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#bg)" />
      <path
        d="M11 27 L20 11 L29 27 M14.5 21 L25.5 21"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

export function BrandLockup({
  className = '',
  inverted = false,
}: {
  className?: string
  inverted?: boolean
}) {
  return (
    <div className={`flex items-center ${className}`}>
      <div className="leading-tight">
        <div className={`text-base font-bold tracking-tight ${inverted ? 'text-white' : 'text-navy-900'}`}>
          Business Portal
        </div>
        <div className={`text-[11px] uppercase tracking-wider ${inverted ? 'text-navy-300' : 'text-navy-500'}`}>
          Member area
        </div>
      </div>
    </div>
  )
}
