import { CCard, CCardBody } from '@coreui/react';

export default function KpiCard({ label, value, unit, delta, hero, amber, onClick }) {
  const cls = [
    onClick ? 'kpi-hover' : '',
    hero  ? 'kpi-hero'  : '',
    amber ? 'kpi-amber' : '',
  ].filter(Boolean).join(' ');

  return (
    <CCard
      onClick={onClick}
      className={`h-100 ${cls}`}
      style={{ cursor: onClick ? 'pointer' : 'default', transition: 'transform .15s, box-shadow .15s' }}
    >
      <CCardBody style={{ padding: '16px 17px', display: 'flex', flexDirection: 'column' }}>
        <div className="kpi-label">{label}</div>
        <div className="kpi-value" style={{ flex: 1 }}>
          {value}
          {unit && <small className="kpi-unit">{unit}</small>}
        </div>
        <div className="kpi-delta">{delta}</div>
      </CCardBody>
    </CCard>
  );
}
