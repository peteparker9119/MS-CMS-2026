import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { getCustomMenus } from '../api/admin';

const W = 240;

/* ── SVG icons ── */
const Icon = ({ name, active }) => {
  const c = active ? '#fff' : 'rgba(255,255,255,.55)';
  const s = { width: 17, height: 17, display: 'block', flexShrink: 0 };
  switch (name) {
    case 'dashboard': return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>;
    case 'meetings':  return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><rect x="1.5" y="2.5" width="13" height="12" rx="2"/><path d="M5 1v3M11 1v3M1.5 6.5h13"/></svg>;
    case 'planner':   return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><rect x="1.5" y="2.5" width="13" height="12" rx="2"/><path d="M5 1v3M11 1v3M1.5 6.5h13M5 10.5l2 2 4-4"/></svg>;
    case 'minutes':   return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><rect x="2.5" y="1" width="11" height="14" rx="1.5"/><path d="M5 5h6M5 8h6M5 11h4"/></svg>;
    case 'items':     return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M8 5v3.5L10.5 10"/></svg>;
    case 'documents': return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><path d="M9.5 1H3.5A1.5 1.5 0 0 0 2 2.5v11A1.5 1.5 0 0 0 3.5 15h9A1.5 1.5 0 0 0 14 13.5V5.5L9.5 1z"/><path d="M9 1v5h5M5 9h6M5 12h4"/></svg>;
    case 'worklog':   return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><rect x="1.5" y="1.5" width="13" height="13" rx="2"/><path d="M5 8h6M5 5h6M5 11h3"/></svg>;
    case 'activity':  return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><polyline points="1,10 4,6 7,9 10,4 15,7"/></svg>;
    case 'admin':     return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41"/></svg>;
    case 'list':      return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><line x1="1" y1="4" x2="15" y2="4"/><line x1="1" y1="8" x2="15" y2="8"/><line x1="1" y1="12" x2="15" y2="12"/></svg>;
    case 'taskboard': return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><rect x="1" y="1" width="14" height="14" rx="2"/><line x1="1" y1="6" x2="15" y2="6"/><line x1="6" y1="6" x2="6" y2="15"/></svg>;
    default:          return <svg viewBox="0 0 16 16" style={s} fill="none" stroke={c} strokeWidth="1.5"><circle cx="8" cy="8" r="6.5"/></svg>;
  }
};

// Access matrix — which roles see each menu item
const ACTIVE_PATHS = new Set(['dashboard', 'planner', 'meetings']);
const NAV_ITEMS = [
  { path: 'dashboard',   label: 'Dashboard',      icon: 'dashboard', roles: ['super_admin','admin','poc','team'] },
  { path: 'planner',     label: 'Planner',        icon: 'planner',   roles: ['super_admin','admin'] },
  { path: 'meetings',    label: 'Meetings',        icon: 'meetings',  roles: ['super_admin','admin','poc','team'] },
  { path: 'items',       label: 'Item Tracker',   icon: 'items',     roles: ['super_admin','admin','poc','team'] },
  { path: 'documents',   label: 'D.O. Letters',   icon: 'documents', roles: ['super_admin','admin','poc','team'] },
  { path: 'worklog',     label: 'Daily Work',     icon: 'worklog',   roles: ['super_admin','poc','team'] },
  { path: 'reviews',     label: 'Team Activity',  icon: 'activity',  roles: ['super_admin','poc','team'] },
  { path: 'task-board',  label: 'Task Board',     icon: 'taskboard', roles: ['super_admin','admin'] },
  { path: 'admin-panel', label: 'Admin Panel',    icon: 'admin',     roles: ['super_admin','admin'] },
];

export default function AppSidebar() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const location   = useLocation();

  const { data: customMenus = [] } = useQuery({
    queryKey: ['custom-menus'],
    queryFn:  getCustomMenus,
    staleTime: 60_000,
  });

  const role     = user?.role ?? '';
  const navItems = NAV_ITEMS.filter(item => item.roles.includes(role));
  const cur      = location.pathname.replace(/^\//, '');

  const visibleCustomMenus = customMenus.filter(m => {
    if (!m.is_active) return false;
    if (m.access === 'admin'       && !['super_admin','admin'].includes(role)) return false;
    if (m.access === 'poc'         && !['super_admin','admin','poc'].includes(role)) return false;
    return true;
  });

  const NavBtn = ({ path, label, icon }) => {
    const isActive = cur === path || cur.startsWith(path + '/');
    const comingSoon = !ACTIVE_PATHS.has(path);
    return (
      <button
        onClick={() => navigate(`/${path}`)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', border: 'none', cursor: 'pointer',
          padding: '9px 16px', margin: '1px 0',
          background: isActive ? 'rgba(99,102,241,.18)' : 'transparent',
          borderLeft: `3px solid ${isActive ? '#818cf8' : 'transparent'}`,
          borderRadius: '0 8px 8px 0',
          transition: 'background .13s',
          opacity: comingSoon ? 0.5 : 1,
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,.06)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = isActive ? 'rgba(99,102,241,.18)' : 'transparent'; }}
      >
        <Icon name={icon} active={isActive} />
        <span style={{
          fontFamily: 'var(--fb)', fontSize: 13,
          fontWeight: isActive ? 600 : 400,
          color: isActive ? '#fff' : 'rgba(255,255,255,.72)',
          whiteSpace: 'nowrap', flex: 1,
        }}>
          {label}
        </span>
        {comingSoon && (
          <span style={{
            fontSize: 8, fontFamily: 'var(--fm)', fontWeight: 700,
            color: '#fbbf24', background: 'rgba(251,191,36,.15)',
            padding: '2px 6px', borderRadius: 4,
            letterSpacing: '.04em', textTransform: 'uppercase', whiteSpace: 'nowrap',
          }}>Soon</span>
        )}
      </button>
    );
  };

  const unitColor = user?.unit_color ?? '#6366f1';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, bottom: 0,
      width: W, background: '#1e2333',
      zIndex: 1029, display: 'flex', flexDirection: 'column',
      userSelect: 'none',
    }}>

      {/* ── Brand ── */}
      <div style={{
        height: 57, flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: 10,
        borderBottom: '1px solid rgba(255,255,255,.08)',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: 'linear-gradient(135deg,#6366f1,#818cf8)',
          color: '#fff', fontFamily: 'var(--fd)', fontWeight: 800,
          fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>M</div>
        <div>
          <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 15, color: '#fff', lineHeight: 1, letterSpacing: '-.01em' }}>MS CMS</div>
          <div style={{ fontFamily: 'var(--fm)', fontSize: 10, color: 'rgba(255,255,255,.4)', lineHeight: 1, marginTop: 3, letterSpacing: '.04em', textTransform: 'uppercase' }}>Model Schools</div>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 0', overflowY: 'auto' }}>
        <div style={{
          padding: '4px 16px 6px',
          fontFamily: 'var(--fm)', fontSize: 10, fontWeight: 700,
          letterSpacing: '.1em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,.28)',
        }}>Main</div>

        {navItems.map(({ path, label, icon }) => (
          <NavBtn key={path} path={path} label={label} icon={icon} />
        ))}

        {visibleCustomMenus.length > 0 && (
          <>
            <div style={{
              padding: '12px 16px 6px',
              fontFamily: 'var(--fm)', fontSize: 10, fontWeight: 700,
              letterSpacing: '.1em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,.28)',
              borderTop: '1px solid rgba(255,255,255,.07)',
              marginTop: 8,
            }}>Custom</div>
            {visibleCustomMenus.map(m => (
              <NavBtn key={m.slug} path={`menu/${m.slug}`} label={m.name} icon={m.icon ?? 'list'} />
            ))}
          </>
        )}
      </nav>

      {/* ── Unit badge (TL / Team) ── */}
      {user?.unit_name && (
        <div style={{
          padding: '10px 16px 14px',
          borderTop: '1px solid rgba(255,255,255,.08)',
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: unitColor, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{user.unit_name}</div>
            <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'rgba(255,255,255,.45)' }}>workspace</div>
          </div>
        </div>
      )}
    </div>
  );
}
