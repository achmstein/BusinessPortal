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
    case 'settings': return (<svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z" /></svg>)
    case 'eye': return (<svg {...common}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>)
    case 'eye-off': return (<svg {...common}><path d="M17.94 17.94A10.6 10.6 0 0 1 12 19c-6.5 0-10-7-10-7a17.6 17.6 0 0 1 4.1-4.9" /><path d="M9.9 5.2A9.4 9.4 0 0 1 12 5c6.5 0 10 7 10 7a17.7 17.7 0 0 1-2.2 3.1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="M3 3l18 18" /></svg>)
    default: return null
  }
}
