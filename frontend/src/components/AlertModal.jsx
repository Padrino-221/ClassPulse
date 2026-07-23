import React from 'react';
import { Warning, XCircle, CheckCircle, Info } from '@phosphor-icons/react';

const icons = {
  warning: <Warning weight="duotone" size={32} />,
  error: <XCircle weight="duotone" size={32} />,
  success: <CheckCircle weight="duotone" size={32} />,
  info: <Info weight="duotone" size={32} />,
};

export default function AlertModal({ type = 'warning', message, onClose }) {
  return (
    <div className="alert-overlay" onClick={onClose}>
      <div className="alert-modal" onClick={(e) => e.stopPropagation()}>
        <div className={`alert-icon alert-icon-${type}`}>
          {icons[type] || icons.warning}
        </div>
        <p className="alert-message">{message}</p>
        <button className="alert-btn" onClick={onClose}>OK</button>
      </div>
    </div>
  );
}
