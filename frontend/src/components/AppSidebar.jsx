import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { getCustomMenus } from '../api/admin';

const W_OPEN = 240;
const W_RAIL = 62;

/* ── SVG icons ── */
const Icon = ({ name, active }) => {
  const c = active ? '#fff' : 'rgba(255,255,255,.5)';
  const s = { width: 18, height: 18, display: 'block', flexShrink: 0 };
  switch (name) {
    case 'dashboard': return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>;
    case 'meetings':  return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><rect x="1.5" y="2.5" width="13" height="12" rx="2"/><path d="M5 1v3M11 1v3M1.5 6.5h13"/></svg>;
    case 'planner':   return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><rect x="1.5" y="2.5" width="13" height="12" rx="2"/><path d="M5 1v3M11 1v3M1.5 6.5h13M5 10.5l2 2 4-4"/></svg>;
    case 'minutes':   return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><rect x="2.5" y="1" width="11" height="14" rx="1.5"/><path d="M5 5h6M5 8h6M5 11h4"/></svg>;
    case 'items':     return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M8 5v3.5L10.5 10"/></svg>;
    case 'documents': return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><path d="M9.5 1H3.5A1.5 1.5 0 0 0 2 2.5v11A1.5 1.5 0 0 0 3.5 15h9A1.5 1.5 0 0 0 14 13.5V5.5L9.5 1z"/><path d="M9 1v5h5M5 9h6M5 12h4"/></svg>;
    case 'admin':     return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41"/></svg>;
    case 'grid':      return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>;
    case 'list':      return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><line x1="1" y1="4" x2="15" y2="4"/><line x1="1" y1="8" x2="15" y2="8"/><line x1="1" y1="12" x2="15" y2="12"/></svg>;
    case 'document':  return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><rect x="2.5" y="1" width="11" height="14" rx="1.5"/><path d="M5 5h6M5 8h6M5 11h4"/></svg>;
    case 'chart':     return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><rect x="1" y="9" width="3" height="6" rx="1"/><rect x="6.5" y="5" width="3" height="10" rx="1"/><rect x="12" y="2" width="3" height="13" rx="1"/></svg>;
    case 'folder':    return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3l2 2H13.5A1.5 1.5 0 0 1 15 5.5v7A1.5 1.5 0 0 1 13.5 14h-11A1.5 1.5 0 0 1 1 12.5V3.5z"/></svg>;
    case 'star':      return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><polygon points="8,1.5 10,6 15,6.5 11.5,10 12.5,15 8,12.5 3.5,15 4.5,10 1,6.5 6,6"/></svg>;
    case 'settings':  return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41"/></svg>;
    case 'users':     return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><circle cx="6" cy="5" r="2.5"/><path d="M1 14s0-4 5-4 5 4 5 4"/><path d="M11 2s2 0 2 2.5S11 7 11 7M15 14s0-3-4-4"/></svg>;
    case 'calendar':  return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><rect x="1.5" y="2.5" width="13" height="12" rx="2"/><path d="M5 1v3M11 1v3M1.5 6.5h13"/></svg>;
    case 'tag':       return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><path d="M2 2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 0 1.414l-4.586 4.586a1 1 0 0 1-1.414 0L2.293 8.293A1 1 0 0 1 2 7.586V2z"/><circle cx="5.5" cy="5.5" r="1"/></svg>;
    default:          return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><circle cx="8" cy="8" r="6.5"/></svg>;
  }
};

const NAV_ADMIN = [
  { path: 'dashboard',   label: 'Dashboard',    icon: 'dashboard'  },
  { path: 'meetings',    label: 'Meetings',     icon: 'meetings'   },
  { path: 'planner',     label: 'Planner',      icon: 'planner'    },
  { path: 'minutes',     label: 'Minutes',      icon: 'minutes'    },
  { path: 'items',       label: 'Item Tracker', icon: 'items'      },
  { path: 'documents',   label: 'D.O. Letters', icon: 'documents'  },
  { path: 'admin-panel', label: 'Admin Panel',  icon: 'admin'      },
];
const NAV_POC = [
  { path: 'dashboard', label: 'My Dashboard', icon: 'dashboard' },
  { path: 'meetings',  label: 'Meetings',     icon: 'meetings'  },
  { path: 'items',     label: 'Create Item',  icon: 'items'     },
  { path: 'documents', label: 'D.O. Letters', icon: 'documents' },
];

export default function AppSidebar() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const location   = useLocation();
  const [hovered, setHovered] = useState(false);

  // Fetch active custom menus (cached 60 s)
  const { data: customMenus = [] } = useQuery({
    queryKey: ['custom-menus'],
    queryFn:  getCustomMenus,
    staleTime: 60_000,
  });

  const navItems = user?.role === 'admin' ? NAV_ADMIN : NAV_POC;
  const cur      = location.pathname.replace(/^\//, '');
  const expanded = hovered;

  // Filter custom menus visible to this user
  const visibleCustomMenus = customMenus.filter(m => {
    if (!m.is_active) return false;
    if (m.access === 'admin' && user?.role !== 'admin') return false;
    if (m.access === 'poc'   && !['admin','poc'].includes(user?.role)) return false;
    return true;
  });

  const handleNav = (path) => {
    navigate(`/${path}`);
  };

  const NavBtn = ({ path, label, icon }) => {
    const isActive = cur === path;
    return (
      <button
        onClick={() => handleNav(path)}
        style={{
          display: 'flex', alignItems: 'center',
          width: '100%', border: 'none', cursor: 'pointer',
          padding: '10px 0', margin: '1px 0',
          background: isActive ? 'rgba(96,165,250,.2)' : 'transparent',
          borderLeft: `3px solid ${isActive ? '#60a5fa' : 'transparent'}`,
          transition: 'background .13s, border-color .13s',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,.07)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = isActive ? 'rgba(96,165,250,.2)' : 'transparent'; }}
      >
        <span style={{ width: W_RAIL, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} active={isActive} />
        </span>
        <span style={{
          whiteSpace: 'nowrap', fontFamily: 'var(--fb)',
          fontSize: 13, fontWeight: isActive ? 600 : 500,
          color: isActive ? '#fff' : 'rgba(255,255,255,.8)',
          opacity: expanded ? 1 : 0,
          transition: 'opacity .15s ease',
        }}>
          {label}
        </span>
      </button>
    );
  };

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0,
          width: expanded ? W_OPEN : W_RAIL,
          overflow: 'hidden',
          background: '#1e2333',
          zIndex: 1029,
          display: 'flex', flexDirection: 'column',
          transition: 'width .22s cubic-bezier(.4,0,.2,1)',
          userSelect: 'none',
        }}
      >
        {/* ── Nav ── starts below header (paddingTop=57) ── */}
        <nav style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          paddingTop: 57, overflowY: 'auto', overflowX: 'hidden',
        }}>

          {/* Brand — sits below the header, visible when expanded */}
          <div style={{
            paddingLeft: 18, paddingTop: 10, paddingBottom: 10,
            borderBottom: '1px solid rgba(255,255,255,.08)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            flexShrink: 0,
          }}>
            <div style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 15, color: '#fff', lineHeight: 1, marginBottom: 3, letterSpacing: '-.01em' }}>Convergence</div>
            <div style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: 11, color: 'rgba(255,255,255,.5)', lineHeight: 1, letterSpacing: '.04em', textTransform: 'uppercase' }}>Management System</div>
          </div>

          {/* Static nav items */}
          {navItems.map(({ path, label, icon }) => (
            <NavBtn key={path} path={path} label={label} icon={icon} />
          ))}

          {/* Custom menus section */}
          {visibleCustomMenus.length > 0 && (
            <>
              <div style={{
                margin: '8px 0 2px',
                borderTop: '1px solid rgba(255,255,255,.07)',
                paddingTop: 8,
              }}>
                <div style={{
                  paddingLeft: 16, paddingBottom: 4,
                  fontFamily: 'var(--fm)', fontSize: 9, fontWeight: 700,
                  letterSpacing: '.10em', textTransform: 'uppercase',
                  color: 'rgba(255,255,255,.28)',
                  opacity: expanded ? 1 : 0,
                  transition: 'opacity .18s ease',
                  whiteSpace: 'nowrap',
                }}>Custom</div>
              </div>
              {visibleCustomMenus.map(m => (
                <NavBtn key={m.slug} path={`menu/${m.slug}`} label={m.name} icon={m.icon ?? 'list'} />
              ))}
            </>
          )}
        </nav>

        {/* ── POC unit badge ── */}
        {user?.role === 'poc' && user?.unit_name && (
          <div style={{
            display: 'flex', alignItems: 'center',
            margin: '6px 0 14px', flexShrink: 0,
          }}>
            <span style={{
              width: W_RAIL, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: user.unit_color ?? '#fff', display: 'block',
              }} />
            </span>
            <div style={{
              whiteSpace: 'nowrap',
              opacity: expanded ? 1 : 0,
              transition: 'opacity .15s ease',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{user.unit_name}</div>
              <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'rgba(255,255,255,.45)' }}>workspace</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
