// Inline SVG icons — ported verbatim from the original components/nav.tsx and
// components/admin-nav.tsx Icon() sets.
export function Icon({ name }: { name: string }) {
  const stroke = 'currentColor'
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke,
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'home': return (<svg {...common}><path d="M3 11 12 3l9 8" /><path d="M5 10v10h14V10" /></svg>)
    case 'user': return (<svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-7 8-7s8 3 8 7" /></svg>)
    case 'users': return (<svg {...common}><circle cx="9" cy="8" r="3.5" /><path d="M3 21c0-3 2.5-5 6-5s6 2 6 5" /><circle cx="17" cy="9" r="2.5" /><path d="M16 21c0-2 2-4 5-4" /></svg>)
    case 'book': return (<svg {...common}><path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2Z" /><path d="M9 3v18" /></svg>)
    case 'briefcase': return (<svg {...common}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>)
    case 'id': return (<svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="12" r="2.5" /><path d="M14 10h5M14 14h3" /></svg>)
    case 'bell': return (<svg {...common}><path d="M6 8a6 6 0 0 1 12 0c0 6 3 7 3 9H3c0-2 3-3 3-9Z" /><path d="M10 21a2 2 0 0 0 4 0" /></svg>)
    case 'link': return (<svg {...common}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5" /></svg>)
    case 'chat': return (<svg {...common}><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" /></svg>)
    case 'logout': return (<svg {...common}><path d="M10 17l-5-5 5-5" /><path d="M5 12h12" /><path d="M21 5v14" /></svg>)
    case 'menu': return (<svg {...common}><path d="M4 6h16M4 12h16M4 18h16" /></svg>)
    case 'close': return (<svg {...common}><path d="M6 6l12 12M18 6 6 18" /></svg>)
    default: return null
  }
}
