import React from 'react';
import { Shield, Plus, Wifi, WifiOff, User as UserIcon, RefreshCw } from 'lucide-react';
import { User } from '../types';

interface NavbarProps {
  user: User | null;
  isConnected: boolean;
  onOpenCreateModal: () => void;
  onRefresh: () => void;
  onOpenAuthModal: () => void;
  isRefreshing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  isConnected,
  onOpenCreateModal,
  onRefresh,
  onOpenAuthModal,
  isRefreshing,
}) => {
  return (
    <header
      style={{
        background: 'rgba(10, 13, 20, 0.8)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          padding: '14px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.2))',
              padding: '8px',
              borderRadius: '10px',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(16, 185, 129, 0.2)',
            }}
          >
            <Shield size={20} color="#10b981" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '1.125rem', letterSpacing: '-0.02em' }}>
                API Sentinel
              </span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontWeight: 600,
                }}
              >
                v1.0
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Real-Time Observability & Monitoring
            </div>
          </div>
        </div>

        {/* Right Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Socket Status Indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '9999px',
              fontSize: '0.75rem',
            }}
          >
            {isConnected ? (
              <>
                <Wifi size={13} color="#10b981" />
                <span style={{ color: '#10b981', fontWeight: 500 }}>Live Feed</span>
              </>
            ) : (
              <>
                <WifiOff size={13} color="#ef4444" />
                <span style={{ color: '#ef4444', fontWeight: 500 }}>Disconnected</span>
              </>
            )}
          </div>

          {/* Refresh Button */}
          <button
            className="btn btn-secondary"
            onClick={onRefresh}
            disabled={isRefreshing}
            style={{ padding: '8px 12px' }}
            title="Refresh monitors"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          </button>

          {/* User Pill / Login Trigger */}
          <button
            className="btn btn-secondary"
            onClick={onOpenAuthModal}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <UserIcon size={14} color="var(--primary)" />
            <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user ? user.email : 'Log In'}
            </span>
          </button>

          {/* New Monitor Button */}
          <button className="btn btn-primary" onClick={onOpenCreateModal}>
            <Plus size={16} />
            <span>New Monitor</span>
          </button>
        </div>
      </div>
    </header>
  );
};
