import React from 'react';

function healthRGB(r) {
  r = Math.max(0, Math.min(1, r));
  const [c1, c2, t] = r < 0.5
    ? [[216,90,48],[224,162,28], r/0.5]
    : [[224,162,28],[29,158,117], (r-0.5)/0.5];
  return c1.map((v,i) => Math.round(v + (c2[i]-v)*t));
}
const rgba = (a, al) => `rgba(${a[0]},${a[1]},${a[2]},${al})`;

export default function ConvergenceMatrix({ units, matrixData, selectedPair, onSelect }) {
  if (!units.length || !matrixData.length) return null;

  const byKey = {};
  matrixData.forEach(d => { byKey[`${d.unit_a}|${d.unit_b}`] = d; byKey[`${d.unit_b}|${d.unit_a}`] = d; });

  const n = units.length;
  const colW = `58px repeat(${n},1fr)`;

  return (
    <div style={{ overflowX:'auto' }}>
      <div style={{ display:'grid', gridTemplateColumns:colW, gap:4, minWidth:520 }}>
        <div />
        {units.map(u => (
          <div key={u.slug} style={{
            fontFamily:'var(--fm)', fontSize:11, textTransform:'uppercase', letterSpacing:'.03em',
            display:'flex', alignItems:'center', justifyContent:'center', padding:2, color:u.color,
          }}>
            {u.abbr.slice(0,4)}
          </div>
        ))}

        {units.map((rowU) => (
          <React.Fragment key={`frag-${rowU.slug}`}>
            <div style={{
              fontFamily:'var(--fm)', fontSize:11, textTransform:'uppercase', letterSpacing:'.03em',
              display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:7, color:rowU.color,
            }}>
              {rowU.abbr.slice(0,5)}
            </div>
            {units.map((colU) => {
              if (rowU.slug === colU.slug) {
                return (
                  <div key={`${rowU.slug}|${colU.slug}`} style={{
                    aspectRatio:'1.5/1', borderRadius:6, background:rowU.color, color:'#fff',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:'var(--fm)', fontSize:11, fontWeight:600,
                  }}>
                    {rowU.abbr.slice(0,3)}
                  </div>
                );
              }
              const key = `${rowU.slug}|${colU.slug}`;
              const d = byKey[key];
              const isSelected = selectedPair && (
                (selectedPair.unit_a?.slug === rowU.slug && selectedPair.unit_b?.slug === colU.slug) ||
                (selectedPair.unit_a?.slug === colU.slug && selectedPair.unit_b?.slug === rowU.slug)
              );

              if (!d || d.planned === 0) {
                return (
                  <div key={key} style={{
                    aspectRatio:'1.5/1', borderRadius:6, background:'var(--line2)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:'var(--fm)', fontSize:11, color:'var(--ink3)', cursor:'pointer',
                    border: isSelected ? '2px solid var(--ink)' : '1px solid transparent',
                  }}>–</div>
                );
              }
              const col = healthRGB(d.rate ?? 0);
              return (
                <div
                  key={key}
                  onClick={() => onSelect?.(d)}
                  style={{
                    aspectRatio:'1.5/1', borderRadius:6, cursor:'pointer',
                    background: rgba(col,.2), color: rgba(col,1),
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:'var(--fm)', fontSize:11, fontWeight:500,
                    border: isSelected ? '2px solid var(--ink)' : '1px solid transparent',
                    transition:'.13s',
                  }}
                  title={`${rowU.name} × ${colU.name}`}
                >
                  {d.conducted}/{d.planned}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:8, fontFamily:'var(--fm)', fontSize:11, color:'var(--ink3)', marginTop:14 }}>
        Low
        <span style={{ display:'flex', height:9, width:120, borderRadius:99, overflow:'hidden' }}>
          {['#D85A30','#E0A21C','#1D9E75'].map(c => <i key={c} style={{ flex:1, background:c }} />)}
        </span>
        High participation
      </div>
    </div>
  );
}
