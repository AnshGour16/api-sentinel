import React from 'react';
import { CheckRecord } from '../types';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface LiveCheckFeedProps {
  checks: CheckRecord[];
  isLoading?: boolean;
}

export const LiveCheckFeed: React.FC<LiveCheckFeedProps> = ({ checks, isLoading }) => {
  const getOutcomeBadge = (outcome: string, statusCode: number | null) => {
    if (outcome === 'success') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color: '#10b981',
            background: 'rgba(16, 185, 129, 0.1)',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={12} />
          {statusCode || 200} OK
        </span>
      );
    }
    if (outcome === 'timeout') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color: '#f59e0b',
            background: 'rgba(245, 158, 11, 0.1)',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        >
          <Clock size={12} />
          TIMEOUT
        </span>
      );
    }
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          color: '#ef4444',
          background: 'rgba(239, 68, 68, 0.1)',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '0.75rem',
          fontWeight: 600,
        }}
      >
        <AlertCircle size={12} />
        {statusCode ? `HTTP ${statusCode}` : outcome.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="glass-panel" style={{ padding: '24px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Live Check History</h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Real-time feed of health check executions
          </p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Loading checks...
        </div>
      ) : checks.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          No health checks recorded yet. Checks will populate automatically as workers run.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 12px', fontWeight: 500 }}>Time</th>
                <th style={{ padding: '10px 12px', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '10px 12px', fontWeight: 500 }}>Latency</th>
                <th style={{ padding: '10px 12px', fontWeight: 500 }}>Outcome</th>
                <th style={{ padding: '10px 12px', fontWeight: 500 }}>Execution ID</th>
              </tr>
            </thead>
            <tbody>
              {checks.slice(0, 15).map((c) => {
                const date = new Date(c.checkedAt);
                return (
                  <tr
                    key={c.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                      {date.toLocaleTimeString()} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{date.toLocaleDateString()}</span>
                    </td>
                    <td style={{ padding: '12px' }}>{getOutcomeBadge(c.outcome, c.statusCode)}</td>
                    <td style={{ padding: '12px', fontWeight: 600, color: c.latencyMs && c.latencyMs > 500 ? '#f59e0b' : '#10b981' }}>
                      {c.latencyMs !== null ? `${c.latencyMs} ms` : '—'}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                      <span className="code-badge">{c.errorCode || c.outcome}</span>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                      {c.executionId ? c.executionId.slice(0, 8) + '...' : c.id.slice(0, 8)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
