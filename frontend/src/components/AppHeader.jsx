import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { getNotifications, markRead, markAllRead, respondToNotification } from '../api/notifications';
import { CHeader, CHeaderNav } from '@coreui/react';

const PAGE_TITLES = {
  'dashboard':   { title: 'Dashboard',    sub: 'Overview & stats' },
  'meetings':    { title: 'Meetings',     sub: 'Schedule & records' },
  'planner':     { title: 'Planner',      sub: 'Calendar view' },
  'minutes':     { title: 'Minutes',      sub: 'Meeting minutes & action points' },
  'items':       { title: 'Item Tracker', sub: 'Track & manage action items' },
  'documents':   { title: 'D.O. Letters', sub: 'Official correspondence archive' },
  'admin-panel': { title: 'Admin Panel',  sub: 'System configuration' },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function NotifIcon({ type }) {
  const icons = {
    meeting_scheduled: '📅',
    item_created:      '📦',
    deadline_changed:  '⏰',
    action:            '✅',
  };
  return <span style={{ fontSize: 18 }}>{icons[type] ?? '🔔'}</span>;
}

export default function AppHeader() {
  const { user, logout, switchDevRole, IS_DEV } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const pageKey = location.pathname.replace(/^\//, '').split('/')[0];
  const page = PAGE_TITLES[pageKey] ?? { title: 'CMS', sub: '' };

  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen,  setUserOpen]  = useState(false);
  const notifRef = useRef(null);
  const userRef  = useRef(null);

  const initials  = user?.role === 'admin' ? 'AD' : (user?.unit_slug ?? '').slice(0, 2).toUpperCase();
  const roleLabel = user?.role === 'admin' ? 'Admin' : `${user?.unit_slug?.toUpperCase() ?? ''} POC`;
  const fullName  = user?.first_name ? `${user.first_name} ${user.last_name ?? ''}`.trim() : roleLabel;
  const avatarBg  = user?.role === 'admin' ? '#1e2333' : (user?.unit_color ?? 'var(--accent)');

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchInterval: 30000,
  });

  const unread    = notifications.filter(n => !n.read).length;
  const prevUnread = useRef(0);

  /* Request browser notification permission once on mount */
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  /* Fire a browser push when the unread count increases */
  useEffect(() => {
    if (
      unread > prevUnread.current &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      const newCount = unread - prevUnread.current;
      notifications
        .filter(n => !n.read)
        .slice(0, newCount)
        .forEach(n => {
          new Notification(n.title, {
            body: n.message,
            icon: '/favicon.ico',
            tag: `cms-${n.id}`,
            silent: false,
          });
        });
    }
    prevUnread.current = unread;
  }, [unread, notifications]);

  const markReadMut = useMutation({
    mutationFn: markRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markAllReadMut = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const respondMut = useMutation({
    mutationFn: ({ id, response }) => respondToNotification(id, response),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  /* Close on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (userRef.current  && !userRef.current.contains(e.target))  setUserOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <CHeader style={{ position: 'fixed', top: 0, left: 240, right: 0, background: '#fff', borderBottom: '1px solid rgba(15,23,42,.08)', boxShadow: '0 1px 3px rgba(15,23,42,.06)', zIndex: 1031, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12 }}>

      {/* ── Dev view switcher (only in development) ── */}
      {IS_DEV && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fefce8', border: '1px solid #fde047', borderRadius: 8, padding: '4px 8px', flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--fm)', fontSize: 10, fontWeight: 700, color: '#854d0e', letterSpacing: '.06em', textTransform: 'uppercase', marginRight: 2 }}>DEV</span>
          {[
            { key: 'super_admin', label: 'S.Admin' },
            { key: 'admin',       label: 'Admin'   },
            { key: 'poc',         label: 'POC'     },
            { key: 'team',        label: 'Team'    },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => switchDevRole(key)}
              style={{
                border: 'none', borderRadius: 6, padding: '3px 8px',
                fontFamily: 'var(--fb)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: user?.role === key ? '#854d0e' : 'transparent',
                color: user?.role === key ? '#fff' : '#92400e',
                transition: '.13s',
              }}
            >{label}</button>
          ))}
        </div>
      )}

      {/* Page title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 17, color: 'var(--ink)', lineHeight: 1, letterSpacing: '-.01em' }}>{page.title}</div>
        {page.sub && <div style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--ink3)', marginTop: 3, lineHeight: 1 }}>{page.sub}</div>}
      </div>

      <CHeaderNav style={{ alignItems: 'center', gap: 6 }}>

        {/* ── Notification bell ── */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            onClick={() => { setNotifOpen(o => !o); setUserOpen(false); }}
            aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
            style={{
              position: 'relative', cursor: 'pointer', padding: '8px 10px',
              border: notifOpen ? '1px solid var(--accent)' : '1px solid var(--line)',
              borderRadius: 10, background: notifOpen ? 'var(--accent-light)' : '#fff',
              transition: '.15s', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>🔔</span>
            {unread > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 4,
                background: 'var(--bad)', color: '#fff',
                borderRadius: '50%', minWidth: 16, height: 16, padding: '0 3px',
                fontSize: 11, fontWeight: 700, fontFamily: 'var(--fm)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1,
              }}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>

          {/* Notification panel */}
          {notifOpen && (
            <div style={{
              position: 'fixed', top: 52, right: 12,
              width: 'min(360px, calc(100vw - 24px))',
              background: '#fff', border: '1px solid var(--line)', borderRadius: 14,
              boxShadow: '0 12px 32px -8px rgba(15,23,42,.18), 0 2px 8px rgba(15,23,42,.06)',
              overflow: 'hidden', zIndex: 9999,
              animation: 'dropIn .15s cubic-bezier(.4,0,.2,1)',
            }}>
              {/* Panel header */}
              <div style={{ padding: '13px 16px 11px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--panel)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--fd)', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Notifications</span>
                  {unread > 0 && (
                    <span style={{ background: 'var(--bad)', color: '#fff', borderRadius: 99, padding: '2px 7px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--fm)' }}>
                      {unread} new
                    </span>
                  )}
                </div>
                {unread > 0 && (
                  <button
                    onClick={() => markAllReadMut.mutate()}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--accent)', fontFamily: 'var(--fb)', fontWeight: 600, padding: '4px 8px', borderRadius: 6 }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Notification list */}
              <div style={{ maxHeight: 380, overflowY: 'auto', overscrollBehavior: 'contain' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '36px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>🔕</div>
                    <div style={{ fontFamily: 'var(--fd)', fontSize: 15, fontWeight: 600, color: 'var(--ink2)', marginBottom: 4 }}>All caught up</div>
                    <div style={{ fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--ink3)' }}>No notifications yet</div>
                  </div>
                ) : (
                  notifications.slice(0, 25).map(n => (
                    <div key={n.id}
                      onClick={() => { if (!n.read && !n.action_type) markReadMut.mutate(n.id); }}
                      style={{
                        display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10,
                        padding: '12px 16px', borderBottom: '1px solid var(--line)',
                        background: n.read ? '#fff' : 'rgba(99,102,241,.04)',
                        cursor: (!n.read && !n.action_type) ? 'pointer' : 'default',
                        transition: '.13s',
                      }}
                      onMouseEnter={e => { if (!n.read && !n.action_type) e.currentTarget.style.background = 'rgba(99,102,241,.08)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = n.read ? '#fff' : 'rgba(99,102,241,.04)'; }}
                    >
                      {/* Icon bubble */}
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: n.read ? 'var(--paper)' : 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                        <NotifIcon type={n.notif_type} />
                      </div>

                      {/* Content */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontFamily: 'var(--fb)', fontSize: 15, fontWeight: n.read ? 500 : 700, color: 'var(--ink)', lineHeight: 1.3 }}>{n.title}</span>
                          {!n.read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 4 }} />}
                        </div>
                        <div style={{ fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--ink2)', marginBottom: 4, lineHeight: 1.4 }}>{n.message}</div>

                        {/* Action context (date/units for meetings) */}
                        {n.action_type === 'rsvp' && n.action_data?.date && (
                          <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--ink3)', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 6, padding: '2px 7px' }}>
                              📅 {n.action_data.date}{n.action_data.time ? ` · ${n.action_data.time}` : ''}
                            </span>
                            {n.action_data.mtype && (
                              <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--ink3)', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 6, padding: '2px 7px' }}>
                                {n.action_data.mtype === 'Online' ? '💻' : '📍'} {n.action_data.mtype}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Quick-reply buttons or responded badge */}
                        {n.action_type && !n.responded && (
                          <div style={{ display: 'flex', gap: 6, marginBottom: 4, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                            {n.action_type === 'rsvp' && <>
                              <button
                                onClick={() => respondMut.mutate({ id: n.id, response: 'accept' })}
                                disabled={respondMut.isPending}
                                style={{ border: 'none', borderRadius: 7, padding: '5px 12px', background: '#dcfce7', color: '#166534', fontFamily: 'var(--fb)', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: '.13s' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#bbf7d0'}
                                onMouseLeave={e => e.currentTarget.style.background = '#dcfce7'}
                              >✅ Accept</button>
                              <button
                                onClick={() => respondMut.mutate({ id: n.id, response: 'decline' })}
                                disabled={respondMut.isPending}
                                style={{ border: 'none', borderRadius: 7, padding: '5px 12px', background: '#fee2e2', color: '#991b1b', fontFamily: 'var(--fb)', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: '.13s' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#fecaca'}
                                onMouseLeave={e => e.currentTarget.style.background = '#fee2e2'}
                              >❌ Decline</button>
                            </>}
                            {n.action_type === 'acknowledge' && (
                              <button
                                onClick={() => respondMut.mutate({ id: n.id, response: 'acknowledge' })}
                                disabled={respondMut.isPending}
                                style={{ border: 'none', borderRadius: 7, padding: '5px 12px', background: 'var(--accent-light)', color: 'var(--accent-dark)', fontFamily: 'var(--fb)', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: '.13s' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#c7d2fe'}
                                onMouseLeave={e => e.currentTarget.style.background = 'var(--accent-light)'}
                              >👍 Acknowledge</button>
                            )}
                          </div>
                        )}

                        {/* Responded state */}
                        {n.responded && n.response && (
                          <div style={{ marginBottom: 4 }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 600,
                              padding: '3px 9px', borderRadius: 99,
                              background: n.response === 'accept' ? '#dcfce7' : n.response === 'decline' ? '#fee2e2' : 'var(--paper)',
                              color: n.response === 'accept' ? '#166534' : n.response === 'decline' ? '#991b1b' : 'var(--ink3)',
                            }}>
                              {n.response === 'accept' ? '✅' : n.response === 'decline' ? '❌' : '👍'}
                              {' '}{n.response.charAt(0).toUpperCase() + n.response.slice(1)}
                            </span>
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ fontSize: 11, color: 'var(--ink3)', fontFamily: 'var(--fm)' }}>{timeAgo(n.created_at)}</div>
                          {(n.notif_type === 'item_created' || n.notif_type === 'deadline_changed') && n.object_id && (
                            <button
                              onClick={e => { e.stopPropagation(); setNotifOpen(false); if (!n.read) markReadMut.mutate(n.id); navigate(`/items?item=${n.object_id}`); }}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--fb)', padding: '2px 0', whiteSpace: 'nowrap' }}
                            >
                              See more →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Panel footer */}
              {notifications.length > 0 && (
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line)', background: 'var(--panel)', textAlign: 'center' }}>
                  <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--ink3)' }}>
                    {notifications.length} total · updates every 30s
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── User menu ── */}
        <div ref={userRef} style={{ position: 'relative' }}>
          <button
            onClick={() => { setUserOpen(o => !o); setNotifOpen(false); }}
            aria-label="User menu"
            style={{
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
              background: userOpen ? 'var(--accent-light)' : '#fff',
              border: userOpen ? '1px solid var(--accent)' : '1px solid var(--line)',
              borderRadius: 10, padding: '5px 10px 5px 5px', transition: '.15s',
            }}
          >
            <span style={{
              background: avatarBg, width: 30, height: 30, borderRadius: 8,
              color: '#fff', fontFamily: 'var(--fm)', fontSize: 11,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0,
            }}>
              {initials}
            </span>
            <span style={{ fontFamily: 'var(--fb)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {roleLabel}
            </span>
            <span style={{ color: 'var(--ink3)', fontSize: 11, lineHeight: 1 }}>▾</span>
          </button>

          {/* User dropdown */}
          {userOpen && (
            <div style={{
              position: 'fixed', top: 52, right: 16,
              width: 220, background: '#fff',
              border: '1px solid var(--line)', borderRadius: 14,
              boxShadow: '0 12px 32px -8px rgba(15,23,42,.18)',
              overflow: 'hidden', zIndex: 9999,
              animation: 'dropIn .15s cubic-bezier(.4,0,.2,1)',
            }}>
              {/* Profile card */}
              <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--line)', background: 'var(--panel)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 40, height: 40, borderRadius: 10, background: avatarBg, color: '#fff', fontFamily: 'var(--fm)', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {initials}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--fb)', fontSize: 15, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fullName}</div>
                    <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--ink3)', marginTop: 1 }}>{roleLabel}</div>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              <div style={{ padding: '6px 0' }}>
                <button
                  onClick={handleLogout}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--fb)', fontSize: 13, fontWeight: 600, color: '#ef4444', textAlign: 'left', transition: '.13s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fff1f2'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: 13 }}>⏻</span>
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>

      </CHeaderNav>

      <style>{`
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </CHeader>
  );
}
