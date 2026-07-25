export type IconName =
  | "home"
  | "users"
  | "network"
  | "library"
  | "settings"
  | "logout"
  | "menu"
  | "plus"
  | "mic"
  | "chevron"
  | "building"
  | "file"
  | "mail"
  | "trash"
  | "refresh"
  | "shield"
  | "close"
  | "search"
  | "activity"
  | "play"
  | "upload"
  | "camera"
  | "pill"
  | "bell"
  | "message-circle"
  | "help-circle"
  | "download";

const paths: Record<IconName, React.ReactNode> = {
  home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  network: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M10 6.5h4a3 3 0 0 1 3 3V14"/><path d="M6.5 10v4a3 3 0 0 0 3 3H14"/></>,
  library: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M8 7h8M8 11h6"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1V21H9.6v-.1A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4H3V9.6h.1A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1V3h4v.1A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.28.36.48.7.6 1 .12.3.2.64.2 1v2c0 .36-.08.7-.2 1-.12.3-.32.64-.6 1Z"/></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  mic: <><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/></>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  building: <><rect x="3" y="2" width="14" height="20" rx="1"/><path d="M17 7h4v15H3M7 6h2M12 6h1M7 10h2M12 10h1M7 14h2M12 14h1M8 22v-4h4v4"/></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
  trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 16H6L5 6M10 11v6M14 11v6"/></>,
  refresh: <><path d="M20 11a8 8 0 1 0 2 5"/><path d="M20 4v7h-7"/></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
  close: <><path d="m18 6-12 12M6 6l12 12"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  activity: <><path d="M3 12h4l2-6 4 12 2-6h6"/></>,
  play: <><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4Z"/></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 20h14"/></>,
  camera: <><path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="4"/></>,
  pill: <><path d="m10.5 20.5-7-7a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7Z"/><path d="m8 11 5-5"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  "message-circle": <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3 1.7-5A8 8 0 1 1 21 15Z"/><path d="M8 11h8M8 14h5"/></>,
  "help-circle": <><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.7 2c-1 .7-1.5 1.1-1.5 2.3M12 17h.01"/></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></>,
};

export function Icon({ name, size = 18, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {paths[name]}
    </svg>
  );
}
