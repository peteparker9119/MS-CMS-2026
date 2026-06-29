/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from '../api/auth';

const AuthContext = createContext(null);

// ── Dev mode mock users ───────────────────────────────────────────────────────
const IS_DEV = import.meta.env.DEV;

const DEV_USERS = {
  super_admin: {
    id: 1, username: 'dev_super_admin', role: 'super_admin',
    first_name: 'Super', last_name: 'Admin',
    unit_slug: null, unit_name: null, unit_color: null,
    menu_permissions: [],
  },
  admin: {
    id: 2, username: 'dev_admin', role: 'admin',
    first_name: 'Admin', last_name: '',
    unit_slug: null, unit_name: null, unit_color: null,
    menu_permissions: [],
  },
  poc: {
    id: 3, username: 'dev_poc', role: 'poc',
    first_name: 'VP', last_name: 'TL',
    unit_slug: 'vp', unit_name: 'VETRI Palligal', unit_color: '#6366f1',
    menu_permissions: [],
  },
  team: {
    id: 4, username: 'dev_team', role: 'team',
    first_name: 'Team', last_name: 'Member',
    unit_slug: 'smc', unit_name: 'SMC', unit_color: '#8b5cf6',
    menu_permissions: [],
  },
};

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (IS_DEV) {
      // In dev mode: load role from localStorage, default to admin
      const role = localStorage.getItem('cms_dev_role') || 'admin';
      setUser(DEV_USERS[role] ?? DEV_USERS.admin);
      setLoading(false);
      return;
    }

    // Production: read token from URL params or localStorage
    const params   = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      localStorage.setItem('tnemis_token', urlToken);
      params.delete('token');
      const clean = params.toString()
        ? `${window.location.pathname}?${params}`
        : window.location.pathname;
      window.history.replaceState({}, '', clean);
    }

    const token = urlToken || localStorage.getItem('tnemis_token');
    if (token) {
      getMe()
        .then(setUser)
        .catch(() => localStorage.removeItem('tnemis_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Switch between admin and TL in dev mode
  const switchDevRole = (role) => {
    localStorage.setItem('cms_dev_role', role);
    setUser(DEV_USERS[role]);
  };

  const logout = () => {
    if (IS_DEV) {
      localStorage.setItem('cms_dev_role', 'admin');
      setUser(DEV_USERS.admin);
    } else {
      localStorage.removeItem('tnemis_token');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, switchDevRole, IS_DEV }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
