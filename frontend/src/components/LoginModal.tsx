import React, { useState } from 'react';
import { LogIn, Shield, Sparkles, User as UserIcon } from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onSuccess: (user: User) => void;
  onClose?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onSuccess, onClose }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (targetEmail: string, targetName?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.auth.login(targetEmail, targetName);
      onSuccess(res.user);
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please verify the backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter a valid email address');
      return;
    }
    handleLogin(email.trim(), name.trim() || undefined);
  };

  const handleDemoLogin = () => {
    setEmail('developer@apisentinel.dev');
    setName('Demo Developer');
    handleLogin('developer@apisentinel.dev', 'Demo Developer');
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(59, 130, 246, 0.2))',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-emerald)',
              }}
            >
              <Shield size={22} />
            </div>
            <div>
              <h2 className="modal-title">Sign In to API Sentinel</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Mission-critical API monitoring & real-time telemetry
              </p>
            </div>
          </div>
          {onClose && (
            <button className="btn btn-secondary" onClick={onClose} style={{ padding: '0.4rem 0.6rem' }}>
              ✕
            </button>
          )}
        </div>

        {error && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid var(--accent-rose)',
              color: 'var(--accent-rose)',
              fontSize: '0.875rem',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              Work Email
            </label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="e.g. engineer@enterprise.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-name">
              Full Name (Optional)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-name"
                type="text"
                className="form-input"
                placeholder="e.g. Alex Rivera"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <UserIcon
                size={16}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
              style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
            >
              <LogIn size={18} />
              {isLoading ? 'Signing In...' : 'Continue to Dashboard'}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDemoLogin}
              disabled={isLoading}
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '0.75rem',
                border: '1px dashed var(--accent-emerald)',
                background: 'rgba(16, 185, 129, 0.05)',
                color: 'var(--accent-emerald)',
              }}
            >
              <Sparkles size={18} />
              1-Click Demo Access (developer@apisentinel.dev)
            </button>
          </div>
        </form>

        <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Session tokens are securely signed with HMAC SHA-256 and stored locally.
        </div>
      </div>
    </div>
  );
};
