import { CBadge } from '@coreui/react';

const STATUS_COLOR = {
  conducted: 'success',
  scheduled: 'info',
  postponed: 'warning',
  missed:    'danger',
};

export default function Badge({ status }) {
  return (
    <CBadge color={STATUS_COLOR[status] ?? 'secondary'} style={{ fontFamily: 'var(--fm)', fontSize: 13, letterSpacing: '.03em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 99 }}>
      {status}
    </CBadge>
  );
}
