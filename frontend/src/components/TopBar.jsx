import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function TopBar() {
  const { user, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const adminNav  = [['dashboard','Dashboard'],['planner','Planner'],['minutes','Minutes']];
  const pocNav    = [['dashboard','My Dashboard'],['minutes','Minutes'],['items','Create Item']];
  const navItems  = user?.role === 'admin' ? adminNav : pocNav;

  const cur = location.pathname.replace('/', '');

  const handleLogout = () => { logout(); navigate('/login'); };

  const initials = user?.role === 'admin'
    ? 'A'
    : (user?.unit_slug ?? '').slice(0,2).toUpperCase();

  const avatarBg = user?.role === 'admin' ? 'var(--ink)' : (user?.unit_color ?? 'var(--ink)');
  const roleLabel = user?.role === 'admin' ? 'Admin' : `${user?.unit_slug?.toUpperCase() ?? ''} TL`;

  return (
    <div className="topbar">
      <div className="brand">
        <span className="mark">MS CMS</span>
        <span className="vseg">
          {navItems.map(([path, label]) => (
            <button
              key={path}
              className={cur === path ? 'on' : ''}
              onClick={() => navigate(`/${path}`)}
            >
              {label}
            </button>
          ))}
        </span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div className="usermenu" onClick={handleLogout} title="Sign out">
          <span className="uava" style={{ background: avatarBg }}>{initials}</span>
          <span className="urole">{roleLabel}</span>
          <span style={{ color:'var(--ink3)', fontSize:13 }}>⏻</span>
        </div>
      </div>
    </div>
  );
}
