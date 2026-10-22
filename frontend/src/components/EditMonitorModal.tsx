import React, { useState, useEffect } from 'react';
import { CreateMonitorPayload, Monitor } from '../types';
import { X, ShieldAlert } from 'lucide-react';

interface EditMonitorModalProps {
  monitor: Monitor | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: string, data: Partial<CreateMonitorPayload>) => Promise<void>;
}

export const EditMonitorModal: React.FC<EditMonitorModalProps> = ({
  monitor,
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [method, setMethod] = useState<'GET' | 'HEAD'>('GET');
  const [intervalSeconds, setIntervalSeconds] = useState(60);
  const [timeoutMs, setTimeoutMs] = useState(5000);
  const [expectedStatusMin, setExpectedStatusMin] = useState(200);
  const [expectedStatusMax, setExpectedStatusMax] = useState(299);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (monitor) {
      setName(monitor.name);
      setTargetUrl(monitor.targetUrl);
      setMethod(monitor.method);
      setIntervalSeconds(monitor.intervalSeconds);
      setTimeoutMs(monitor.timeoutMs);
      setExpectedStatusMin(monitor.expectedStatusMin);
      setExpectedStatusMax(monitor.expectedStatusMax);
      setError(null);
    }
  }, [monitor]);

  if (!isOpen || !monitor) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Monitor name is required');
      return;
    }
    if (!targetUrl.trim() || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
      setError('Target URL must start with http:// or https://');
      return;
    }
    if (expectedStatusMin > expectedStatusMax) {
      setError('Expected minimum status code cannot exceed maximum status code');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(monitor.id, {
        name: name.trim(),
        targetUrl: targetUrl.trim(),
        method,
        intervalSeconds,
        timeoutMs,
        expectedStatusMin,
        expectedStatusMax,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update monitor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Edit Monitor</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Update monitor configuration and interval thresholds
            </p>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
            }}
          >
            <ShieldAlert size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Monitor Name</label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Target URL</label>
            <input
              type="url"
              className="form-input"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">HTTP Method</label>
              <select
                className="form-select"
                value={method}
                onChange={(e) => setMethod(e.target.value as 'GET' | 'HEAD')}
              >
                <option value="GET">GET</option>
                <option value="HEAD">HEAD</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Interval (Seconds)</label>
              <input
                type="number"
                className="form-input"
                min={10}
                max={86400}
                value={intervalSeconds}
                onChange={(e) => setIntervalSeconds(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Timeout (Milliseconds)</label>
              <input
                type="number"
                className="form-input"
                min={100}
                max={30000}
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(Number(e.target.value))}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Expected Status Range</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="number"
                  className="form-input"
                  style={{ width: '80px' }}
                  value={expectedStatusMin}
                  onChange={(e) => setExpectedStatusMin(Number(e.target.value))}
                  required
                />
                <span style={{ color: 'var(--text-muted)' }}>–</span>
                <input
                  type="number"
                  className="form-input"
                  style={{ width: '80px' }}
                  value={expectedStatusMax}
                  onChange={(e) => setExpectedStatusMax(Number(e.target.value))}
                  required
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
