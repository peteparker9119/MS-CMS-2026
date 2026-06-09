import { CModal, CModalHeader, CModalTitle, CModalBody } from '@coreui/react';

export default function Modal({ title, onClose, children }) {
  return (
    <CModal visible alignment="center" onClose={onClose} scrollable size="lg">
      {title && (
        <CModalHeader onClose={onClose}>
          <CModalTitle style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: 18 }}>{title}</CModalTitle>
        </CModalHeader>
      )}
      <CModalBody style={{ padding: 0 }}>
        {children}
      </CModalBody>
    </CModal>
  );
}
