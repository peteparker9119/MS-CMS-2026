import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Thin accent-colour progress bar at the top of the viewport.
 * Starts on route change, sweeps to ~80%, finishes + fades out once mounted.
 */
export default function NavProgress() {
  const location = useLocation();
  const [state, setState]   = useState({ pct: 0, vis: false });
  const timers = useRef([]);

  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => {
    clear();

    let raf1, raf2;
    // Use rAF to avoid calling setState synchronously in the effect body
    raf1 = requestAnimationFrame(() => {
      setState({ pct: 0, vis: true });
      raf2 = requestAnimationFrame(() => {
        setState({ pct: 72, vis: true });

        const t1 = setTimeout(() => setState({ pct: 90, vis: true }), 300);
        const t2 = setTimeout(() => {
          setState({ pct: 100, vis: true });
          const t3 = setTimeout(() => setState({ pct: 0, vis: false }), 300);
          timers.current.push(t3);
        }, 480);
        timers.current.push(t1, t2);
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  if (!state.vis) return null;

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: 2.5, zIndex: 99999,
        pointerEvents: 'none',
      }}
    >
      <div style={{
        height: '100%',
        width: `${state.pct}%`,
        background: 'linear-gradient(90deg, var(--accent) 0%, #818cf8 100%)',
        transition: state.pct === 100
          ? 'width .18s ease-in'
          : state.pct === 72
          ? 'width .28s cubic-bezier(.4,0,.2,1)'
          : 'width .6s cubic-bezier(.1,0,.2,1)',
        boxShadow: '0 0 8px 0 var(--accent)',
      }} />
    </div>
  );
}
