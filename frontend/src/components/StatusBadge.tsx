import React from 'react';

interface StatusBadgeProps {
  status?: 'healthy' | 'unhealthy' | 'paused';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status = 'healthy' }) => {
  return (
    <span className={`status-badge ${status}`}>
      <span className={`status-dot ${status !== 'paused' ? 'pulse' : ''}`} />
      {status}
    </span>
  );
};
