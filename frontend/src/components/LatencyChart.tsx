import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { LatencyChartPoint } from '../types';

interface LatencyChartProps {
  points: LatencyChartPoint[];
  timeWindow: string;
  onWindowChange: (window: string) => void;
  isLoading?: boolean;
}

export const LatencyChart: React.FC<LatencyChartProps> = ({
  points,
  timeWindow,
  onWindowChange,
  isLoading,
}) => {
  const chartData = points.map((p) => {
    const d = new Date(p.timestamp);
    return {
      id: p.id,
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      fullTime: d.toLocaleString(),
      latency: p.latencyMs ?? 0,
      statusCode: p.statusCode,
      outcome: p.outcome,
    };
  });

  return (
    <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Response Latency History</h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            High-precision monotonic request latency over time
          </p>
        </div>

        {/* Window Selector */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-surface)', padding: '4px', borderRadius: '8px' }}>
          {['1h', '24h', '7d', '30d'].map((w) => (
            <button
              key={w}
              onClick={() => onWindowChange(w)}
              style={{
                background: timeWindow === w ? 'var(--primary)' : 'transparent',
                color: timeWindow === w ? '#042f2e' : 'var(--text-secondary)',
                fontWeight: timeWindow === w ? 600 : 500,
                border: 'none',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div
          style={{
            height: '240px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.875rem',
          }}
        >
          Loading latency metrics...
        </div>
      ) : chartData.length === 0 ? (
        <div
          style={{
            height: '240px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '8px',
            color: 'var(--text-muted)',
            fontSize: '0.875rem',
          }}
        >
          <span>No check data recorded in this window</span>
          <span style={{ fontSize: '0.75rem' }}>Checks are executed by workers based on monitor interval</span>
        </div>
      ) : (
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
              <XAxis
                dataKey="time"
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
              />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                unit="ms"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div
                        style={{
                          background: 'rgba(16, 22, 38, 0.95)',
                          border: '1px solid var(--border-medium)',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                          fontSize: '0.8125rem',
                        }}
                      >
                        <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>{data.fullTime}</div>
                        <div style={{ fontWeight: 600, color: '#10b981', display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span>Latency: {data.latency} ms</span>
                          <span className="code-badge">{data.statusCode || 'ERR'}</span>
                        </div>
                        <div style={{ color: data.outcome === 'success' ? '#34d399' : '#f87171', fontSize: '0.75rem', marginTop: '2px' }}>
                          Outcome: {data.outcome}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="latency"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#latencyGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
