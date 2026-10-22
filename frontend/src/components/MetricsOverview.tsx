import React from 'react';
import { AnalyticsSummary } from '../types';
import { Activity, AlertTriangle, Clock, Zap } from 'lucide-react';

interface MetricsOverviewProps {
  analytics: AnalyticsSummary | null;
  isLoading?: boolean;
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({ analytics, isLoading }) => {
  if (isLoading || !analytics) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-panel" style={{ padding: '20px', height: '110px' }} />
        ))}
      </div>
    );
  }

  const { uptimePercentage, errorRate, p50LatencyMs, p95LatencyMs, p99LatencyMs, totalChecks } = analytics;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}
    >
      {/* 1. Uptime Card */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Uptime (Window)
          </span>
          <Activity size={16} color="#10b981" />
        </div>
        <div style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#10b981' }}>
          {uptimePercentage !== null ? `${uptimePercentage.toFixed(2)}%` : 'No checks'}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          {totalChecks > 0 ? `${totalChecks.toLocaleString()} total checks evaluated` : 'Awaiting checks...'}
        </div>
      </div>

      {/* 2. Error Rate Card */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Error Rate
          </span>
          <AlertTriangle size={16} color={errorRate && errorRate > 0.05 ? '#ef4444' : '#f59e0b'} />
        </div>
        <div
          style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: errorRate && errorRate > 0 ? '#f87171' : 'var(--text-primary)',
          }}
        >
          {errorRate !== null ? `${(errorRate * 100).toFixed(2)}%` : '0.00%'}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          {analytics.failedChecks} failed requests
        </div>
      </div>

      {/* 3. p50 Latency (Median) */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Median Latency (p50)
          </span>
          <Clock size={16} color="#06b6d4" />
        </div>
        <div style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#06b6d4' }}>
          {p50LatencyMs !== null ? `${Math.round(p50LatencyMs)} ms` : '—'}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          50% of requests faster than this
        </div>
      </div>

      {/* 4. p95 / p99 Latency (Tail) */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Tail Latency (p95 / p99)
          </span>
          <Zap size={16} color="#8b5cf6" />
        </div>
        <div style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#a78bfa' }}>
          {p95LatencyMs !== null ? `${Math.round(p95LatencyMs)} ms` : '—'}
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '6px' }}>
            / {p99LatencyMs !== null ? `${Math.round(p99LatencyMs)} ms` : '—'}
          </span>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Percentiles measured monotonically
        </div>
      </div>
    </div>
  );
};
