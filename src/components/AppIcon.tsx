import type { ReactNode } from 'react'

const paths: Record<string, ReactNode> = {
  clipboard: <><path d="M9 5H6a2 2 0 0 0-2 2v13h16V7a2 2 0 0 0-2-2h-3"/><rect x="9" y="2" width="6" height="6" rx="2"/><path d="M8 12h8m-8 4h6"/></>,
  trash: <><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/></>,
  list: <><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="4"/><path d="M7 3v4m10-4v4M3 10h18m-13 5h3m3 0h2"/></>,
  calculator: <><rect x="5" y="2" width="14" height="20" rx="4"/><path d="M8 6h8M8 11h2m4 0h2m-8 4h2m4 0h2m-8 4h2m4 0h2"/></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="4"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>,
  archive: <><rect x="4" y="8" width="16" height="13" rx="3"/><path d="M3 3h18v5H3zM10 12h4"/></>,
  settings: <><path d="M4 7h8m4 0h4M4 17h3m4 0h9"/><circle cx="14" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  eye: <><path d="M2 12c2.6-4.4 5.9-6.6 10-6.6s7.4 2.2 10 6.6c-2.6 4.4-5.9 6.6-10 6.6S4.6 16.4 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  edit: <><path d="m14.5 5 4.5 4.5M4 20l4.5-1 11-11a3.2 3.2 0 0 0-4.5-4.5l-11 11L3 21"/><path d="M14 21h7"/></>,
  chart: <><path d="M4 4v16h16M8 15v-3m4 3V8m4 7v-5"/><path d="m16 4 2-2 2 2"/></>,
  download: <><path d="M12 3v11m-4-4 4 4 4-4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></>,
  sparkles: <><path d="m10 3 2.4 6.6L19 12l-6.6 2.4L10 21l-2.4-6.6L1 12l6.6-2.4L10 3ZM20 2v5m-2.5-2.5h5M20 17v5m-2.5-2.5h5"/></>,
  pages: <><path d="M7 3h9l4 4v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M15 3v5h5M9 12h7m-7 4h5"/></>,
  chevron: <path d="m9 6 6 6-6 6"/>,
  back: <path d="m12 5-7 7 7 7M5 12h15"/>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
}

export default function AppIcon({ name }: { name: keyof typeof paths }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
