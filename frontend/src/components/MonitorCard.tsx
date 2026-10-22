import React from 'react';
import { Monitor } from '../types';
import { StatusBadge } from './StatusBadge';
import { Play, Pause, Edit2, Trash2, Globe, Clock, ChevronRight } from 'lucide-react';

interface MonitorCardProps {
  monitor: Monitor;
  isSelected: boolean;
  onSelect: () => void;
  onPause: (e: React.MouseEvent) => void;
  onResume: (e: React.MouseEvent) => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

export const MonitorCard: React.FC<MonitorCardProps> = ({
  monitor,
  isSelected,
  onSelect,
  onPause,
  onResume,
  onEdit,
  onDelete,
}) => {
  const status = !monitor.isActive
    ? 'paused'
    : monitor.status || 'healthy';

  return (
    <div
      onClick={onSelect}
      className="glass-panel"
      style={{
        padding: '18px 20px',
        cursor: 'pointer',
        borderLeft: isSelected ? '4px solid var(--primary)' : '1px solid var(--border-subtle)',
        background: isSelected ? 'var(--bg-card-hover)' : 'var(--bg-card)',
        transform: isSelected ? 'scale(1.01)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {monitor.name}
          </h4>
          <span className="code-badge" style={{ color: '#06b6d4', fontWeight: 600 }}>
            {monitor.method}
          </span>
        </div>
        <StatusBadge status={status} />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.8125rem',
          color: 'var(--text-secondary)',
          marginBottom: '14px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        <Globe size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{monitor.targetUrl}</span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid rgba(255, 255, 255, 0.04)',
          paddingTop: '12px',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={12} />
            Every {monitor.intervalSeconds}s
          </span>
          <span>Timeout {monitor.timeoutMs}ms</span>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
          {monitor.isActive ? (
            <button
              className="btn-icon"
              onClick={onPause}
              title="Pause monitor"
              style={{ color: '#f59e0b' }}
            >
              <Pause size={14} />
            </button>
          ) : (
            <button
              className="btn-icon"
              onClick={onResume}
              title="Resume monitor"
              style={{ color: '#10b981' }}
            >
              <Play size={14} />
            </button>
          )}

          <button
            className="btn-icon"
            onClick={onEdit}
            title="Edit configuration"
          >
            <Edit2 size={14} />
          </button>

          <button
            className="btn-icon"
            onClick={onDelete}
            title="Delete monitor"
            style={{ color: '#f87171' }}
          >
            <Trash2 size={14} />
          </button>

          <ChevronRight size={16} color="var(--text-muted)" style={{ marginLeft: '4px' }} />
        </div>
      </div>
    </div>
  );
};
