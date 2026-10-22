import React, { useState } from 'react';
import { CreateMonitorPayload } from '../types';
import { X, ShieldAlert } from 'lucide-react';

interface CreateMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateMonitorPayload) => Promise<void>;
}

export const CreateMonitorModal: React.FC<CreateMonitorModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [targetUrl, setTargetUrl] = useState('http://localhost:8080/health');
  const [method, setMethod] = useState<'GET' | 'HEAD'>('GET');
  const [intervalSeconds, setIntervalSeconds] = useState(60);
  const [timeoutMs, setTimeoutMs] = useState(5000);
  const [expectedStatusMin, setExpectedStatusMin] = useState(200);
  const [expectedStatusMax, setExpectedStatusMax] = useState(299);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

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
      await onSubmit({
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
      setError(err instanceof Error ? err.message : 'Failed to create monitor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Create New Monitor</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Configure endpoint checks and health parameters
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
              placeholder="e.g. Auth Gateway API"
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
              placeholder="https://api.example.com/health"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              required
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              SSRF Protected: Cloud metadata and internal network ranges are blocked.
            </span>
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
              {isSubmitting ? 'Creating...' : 'Create Monitor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
