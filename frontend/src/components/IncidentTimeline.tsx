import React from 'react';
import { Incident } from '../types';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface IncidentTimelineProps {
  incidents: Incident[];
  isLoading?: boolean;
}

export const IncidentTimeline: React.FC<IncidentTimelineProps> = ({ incidents, isLoading }) => {
  if (isLoading) {
    return (
      <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading incident history...
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Incidents & Outages</h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Detected failures and recovery timeline
          </p>
        </div>
      </div>

      {incidents.length === 0 ? (
        <div
          style={{
            padding: '32px 16px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981',
            }}
          >
            <CheckCircle size={22} />
          </div>
          <span style={{ fontWeight: 600, color: '#10b981', fontSize: '0.9375rem' }}>
            All Systems Operational
          </span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            No recorded outages or open incidents for this monitor
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {incidents.map((inc) => {
            const isOpen = inc.status === 'open';
            const started = new Date(inc.startedAt);
            const resolved = inc.resolvedAt ? new Date(inc.resolvedAt) : null;

            return (
              <div
                key={inc.id}
                style={{
                  background: isOpen ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${isOpen ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-subtle)'}`,
                  borderRadius: '10px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div
                    style={{
                      marginTop: '2px',
                      color: isOpen ? '#ef4444' : '#10b981',
                    }}
                  >
                    {isOpen ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: '0.875rem',
                          color: isOpen ? '#f87171' : 'var(--text-primary)',
                        }}
                      >
                        {isOpen ? 'Ongoing Outage' : 'Incident Resolved'}
                      </span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: isOpen ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.1)',
                          color: isOpen ? '#f87171' : '#34d399',
                          fontWeight: 600,
                        }}
                      >
                        {inc.failureCount} failed check{inc.failureCount > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Started: {started.toLocaleString()}
                      {resolved && ` • Resolved: ${resolved.toLocaleString()}`}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <Clock size={12} />
                  <span>
                    {resolved
                      ? `${Math.round((resolved.getTime() - started.getTime()) / 1000)}s duration`
                      : 'Active now'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
