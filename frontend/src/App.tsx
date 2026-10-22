import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Plus,
  RefreshCw,
  Search,
  Server,
  Shield,
  Zap,
} from 'lucide-react';
import { api, getStoredToken, removeStoredToken } from './services/api';
import { connectSocket, disconnectSocket } from './services/socket';
import {
  AnalyticsSummary,
  CheckRecord,
  CreateMonitorPayload,
  Incident,
  Monitor,
  User,
} from './types';
import { Navbar } from './components/Navbar';
import { MetricsOverview } from './components/MetricsOverview';
import { MonitorCard } from './components/MonitorCard';
import { LatencyChart } from './components/LatencyChart';
import { LiveCheckFeed } from './components/LiveCheckFeed';
import { IncidentTimeline } from './components/IncidentTimeline';
import { CreateMonitorModal } from './components/CreateMonitorModal';
import { EditMonitorModal } from './components/EditMonitorModal';
import { LoginModal } from './components/LoginModal';
import { StatusBadge } from './components/StatusBadge';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  // Monitor list state
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [selectedMonitorId, setSelectedMonitorId] = useState<string | null>(null);
  const [isLoadingMonitors, setIsLoadingMonitors] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'healthy' | 'unhealthy' | 'paused'>('all');

  // Selected monitor details
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [analyticsWindow, setAnalyticsWindow] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [checks, setChecks] = useState<CheckRecord[]>([]);
  const [isLoadingChecks, setIsLoadingChecks] = useState(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoadingIncidents, setIsLoadingIncidents] = useState(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState<Monitor | null>(null);
  const [activeTab, setActiveTab] = useState<'checks' | 'incidents'>('checks');

  // 1. Initial auth check
  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      api.auth
        .getMe()
        .then((res) => {
          setUser(res.user);
        })
        .catch(() => {
          removeStoredToken();
          setUser(null);
        });
    }
  }, []);

  // 2. Fetch monitors
  const loadMonitors = useCallback(async () => {
    if (!user) return;
    setIsLoadingMonitors(true);
    try {
      const res = await api.monitors.list();
      setMonitors(res.monitors);
      if (res.monitors.length > 0) {
        setSelectedMonitorId((current) => current || res.monitors[0].id);
      }
    } catch (err) {
      console.error('Failed to load monitors:', err);
    } finally {
      setIsLoadingMonitors(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadMonitors();
    } else {
      setMonitors([]);
      setSelectedMonitorId(null);
    }
  }, [user, loadMonitors]);

  // Selected monitor object
  const selectedMonitor = useMemo(
    () => monitors.find((m) => m.id === selectedMonitorId),
    [monitors, selectedMonitorId]
  );

  // 3. Load analytics, checks, and incidents when selected monitor changes
  const loadMonitorData = useCallback(
    async (monitorId: string, window = analyticsWindow) => {
      setIsLoadingAnalytics(true);
      setIsLoadingChecks(true);
      setIsLoadingIncidents(true);

      try {
        const [analyticsRes, checksRes, incidentsRes] = await Promise.all([
          api.monitors.getAnalytics(monitorId, window).catch(() => null),
          api.monitors.getChecks(monitorId, 30).catch(() => ({ checks: [] })),
          api.monitors.getIncidents(monitorId, 20).catch(() => ({ incidents: [] })),
        ]);

        if (analyticsRes) setAnalytics(analyticsRes);
        if (checksRes) setChecks(checksRes.checks);
        if (incidentsRes) setIncidents(incidentsRes.incidents);
      } finally {
        setIsLoadingAnalytics(false);
        setIsLoadingChecks(false);
        setIsLoadingIncidents(false);
      }
    },
    [analyticsWindow]
  );

  useEffect(() => {
    if (selectedMonitorId) {
      loadMonitorData(selectedMonitorId, analyticsWindow);
    } else {
      setAnalytics(null);
      setChecks([]);
      setIncidents([]);
    }
  }, [selectedMonitorId, analyticsWindow, loadMonitorData]);

  // 4. Socket.IO real-time subscriptions
  useEffect(() => {
    if (!user) {
      disconnectSocket();
      setSocketConnected(false);
      return;
    }

    const socket = connectSocket();

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);

    const onCheckCompleted = (data: {
      monitorId: string;
      checkId: string;
      statusCode: number | null;
      latencyMs: number | null;
      outcome: any;
      errorCode: string | null;
      checkedAt: string;
    }) => {
      const newCheck: CheckRecord = {
        id: data.checkId,
        monitorId: data.monitorId,
        executionId: null,
        statusCode: data.statusCode,
        latencyMs: data.latencyMs,
        outcome: data.outcome,
        errorCode: data.errorCode,
        checkedAt: data.checkedAt,
        completedAt: null,
      };

      // Update monitor in list
      setMonitors((prev) =>
        prev.map((m) => {
          if (m.id === data.monitorId) {
            return {
              ...m,
              status: data.outcome === 'success' ? 'healthy' : 'unhealthy',
              lastCheck: newCheck,
            };
          }
          return m;
        })
      );

      // Prepend check if belongs to currently selected monitor
      if (data.monitorId === selectedMonitorId) {
        setChecks((prev) => [newCheck, ...prev.slice(0, 49)]);

        // Optimistically update chart point in analytics
        setAnalytics((prev) => {
          if (!prev) return null;
          const newPoint = {
            id: data.checkId,
            timestamp: data.checkedAt,
            latencyMs: data.latencyMs,
            statusCode: data.statusCode,
            outcome: data.outcome,
          };
          return {
            ...prev,
            totalChecks: prev.totalChecks + 1,
            successfulChecks:
              data.outcome === 'success' ? prev.successfulChecks + 1 : prev.successfulChecks,
            failedChecks:
              data.outcome !== 'success' ? prev.failedChecks + 1 : prev.failedChecks,
            recentPoints: [...prev.recentPoints.slice(-99), newPoint],
          };
        });
      }
    };

    const onStatusChanged = (data: {
      monitorId: string;
      status: 'healthy' | 'unhealthy';
      timestamp: string;
    }) => {
      setMonitors((prev) =>
        prev.map((m) => (m.id === data.monitorId ? { ...m, status: data.status } : m))
      );
    };

    const onIncidentEvent = (data: {
      incidentId: string;
      monitorId: string;
      status: 'open' | 'resolved';
      failureCount: number;
      startedAt: string;
      resolvedAt: string | null;
    }) => {
      const incident: Incident = {
        id: data.incidentId,
        monitorId: data.monitorId,
        status: data.status,
        failureCount: data.failureCount,
        startedAt: data.startedAt,
        resolvedAt: data.resolvedAt,
        lastFailureAt: data.startedAt,
        createdAt: data.startedAt,
        updatedAt: data.resolvedAt || data.startedAt,
      };

      if (data.monitorId === selectedMonitorId) {
        setIncidents((prev) => {
          const index = prev.findIndex((inc) => inc.id === data.incidentId);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = incident;
            return updated;
          }
          return [incident, ...prev];
        });
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('check:completed', onCheckCompleted);
    socket.on('monitor:status_changed', onStatusChanged);
    socket.on('incident:opened', onIncidentEvent);
    socket.on('incident:updated', onIncidentEvent);
    socket.on('incident:resolved', onIncidentEvent);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('check:completed', onCheckCompleted);
      socket.off('monitor:status_changed', onStatusChanged);
      socket.off('incident:opened', onIncidentEvent);
      socket.off('incident:updated', onIncidentEvent);
      socket.off('incident:resolved', onIncidentEvent);
    };
  }, [user, selectedMonitorId]);

  // Actions
  const handleLogout = () => {
    removeStoredToken();
    disconnectSocket();
    setUser(null);
    setMonitors([]);
    setSelectedMonitorId(null);
  };

  const handlePause = async (m: Monitor) => {
    try {
      await api.monitors.pause(m.id);
      setMonitors((prev) =>
        prev.map((item) => (item.id === m.id ? { ...item, isActive: false, status: 'paused' } : item))
      );
    } catch (err) {
      console.error('Failed to pause monitor:', err);
    }
  };

  const handleResume = async (m: Monitor) => {
    try {
      await api.monitors.resume(m.id);
      setMonitors((prev) =>
        prev.map((item) => (item.id === m.id ? { ...item, isActive: true, status: 'healthy' } : item))
      );
    } catch (err) {
      console.error('Failed to resume monitor:', err);
    }
  };

  const handleDeleteMonitor = async (monitorId: string) => {
    if (!window.confirm('Are you sure you want to delete this monitor? All check telemetry will be deleted.')) {
      return;
    }
    try {
      await api.monitors.delete(monitorId);
      setMonitors((prev) => prev.filter((m) => m.id !== monitorId));
      if (selectedMonitorId === monitorId) {
        setSelectedMonitorId(null);
      }
    } catch (err) {
      console.error('Failed to delete monitor:', err);
    }
  };

  const handleCreateMonitor = async (payload: CreateMonitorPayload) => {
    const res = await api.monitors.create(payload);
    setMonitors((prev) => [res.monitor, ...prev]);
    setSelectedMonitorId(res.monitor.id);
  };

  const handleUpdateMonitor = async (id: string, payload: Partial<CreateMonitorPayload>) => {
    const res = await api.monitors.update(id, payload);
    setMonitors((prev) => prev.map((m) => (m.id === id ? res.monitor : m)));
  };

  // Filtered monitors
  const filteredMonitors = useMemo(() => {
    return monitors.filter((m) => {
      const matchesSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.targetUrl.toLowerCase().includes(searchQuery.toLowerCase());

      const status = !m.isActive ? 'paused' : m.status || 'healthy';
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'healthy' && status === 'healthy') ||
        (statusFilter === 'unhealthy' && status === 'unhealthy') ||
        (statusFilter === 'paused' && status === 'paused');

      return matchesSearch && matchesStatus;
    });
  }, [monitors, searchQuery, statusFilter]);

  return (
    <div className="app-container">
      <Navbar
        user={user}
        isConnected={socketConnected}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        onRefresh={loadMonitors}
        onOpenAuthModal={() => {
          if (user) {
            handleLogout();
          } else {
            setIsLoginModalOpen(true);
          }
        }}
        isRefreshing={isLoadingMonitors}
      />

      <main className="main-content">
        {!user ? (
          /* Unauthenticated Landing / Hero */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '65vh',
              textAlign: 'center',
              padding: '2rem',
            }}
          >
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '20px',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(59, 130, 246, 0.2))',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-emerald)',
                marginBottom: '1.5rem',
                boxShadow: '0 8px 32px rgba(16, 185, 129, 0.2)',
              }}
            >
              <Shield size={38} />
            </div>

            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0 0 1rem 0', letterSpacing: '-0.02em' }}>
              Real-Time API Reliability & Telemetry
            </h1>

            <p
              style={{
                fontSize: '1.15rem',
                color: 'var(--text-muted)',
                maxWidth: '620px',
                lineHeight: 1.6,
                margin: '0 0 2rem 0',
              }}
            >
              Autonomous health probing, distributed Redis scheduling, microsecond latency percentile calculation,
              and instant incident lifecycle state machines.
            </p>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                className="btn btn-primary"
                onClick={() => setIsLoginModalOpen(true)}
                style={{ padding: '0.8rem 1.75rem', fontSize: '1rem' }}
              >
                <Zap size={20} />
                Access Sentinel Dashboard
              </button>
            </div>

            {/* Feature Highlights Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '1.25rem',
                maxWidth: '900px',
                width: '100%',
                marginTop: '3.5rem',
                textAlign: 'left',
              }}
            >
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <div style={{ color: 'var(--accent-emerald)', marginBottom: '0.5rem' }}>
                  <Server size={22} />
                </div>
                <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '1rem' }}>Zero-Trust SSRF Shield</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Strict DNS resolving blocks private IP ranges, loopbacks, and AWS metadata probes.
                </p>
              </div>

              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <div style={{ color: 'var(--accent-cyan)', marginBottom: '0.5rem' }}>
                  <Activity size={22} />
                </div>
                <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '1rem' }}>Distributed Queue Workers</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  BullMQ and Redis concurrency handle high-throughput parallel checks without duplicate runs.
                </p>
              </div>

              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <div style={{ color: 'var(--accent-amber)', marginBottom: '0.5rem' }}>
                  <AlertTriangle size={22} />
                </div>
                <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '1rem' }}>Strict Incident State Machine</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Consecutive failure thresholds trigger incidents with database transaction locks and live updates.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Authenticated Dashboard View */
          <>
            <MetricsOverview analytics={analytics} isLoading={isLoadingAnalytics} />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '360px 1fr',
                gap: '1.5rem',
                alignItems: 'start',
              }}
            >
              {/* Left Column: Fleet Monitor List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Search & Filter Header */}
                <div className="glass-panel" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search
                        size={16}
                        style={{
                          position: 'absolute',
                          left: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: 'var(--text-muted)',
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Search endpoints..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="form-input"
                        style={{ paddingLeft: '2.25rem', height: '36px', fontSize: '0.85rem' }}
                      />
                    </div>
                    <button
                      className="btn btn-secondary"
                      onClick={loadMonitors}
                      title="Refresh list"
                      style={{ padding: '0.5rem', height: '36px' }}
                    >
                      <RefreshCw size={15} className={isLoadingMonitors ? 'animate-spin' : ''} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    {(['all', 'healthy', 'unhealthy', 'paused'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setStatusFilter(filter)}
                        className="btn"
                        style={{
                          flex: 1,
                          padding: '0.3rem 0.5rem',
                          fontSize: '0.75rem',
                          textTransform: 'capitalize',
                          backgroundColor:
                            statusFilter === filter ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                          color: statusFilter === filter ? 'var(--text-primary)' : 'var(--text-muted)',
                          border:
                            statusFilter === filter
                              ? '1px solid var(--border-medium)'
                              : '1px solid transparent',
                        }}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Monitors Stack */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {filteredMonitors.length === 0 ? (
                    <div
                      className="glass-panel"
                      style={{
                        padding: '2.5rem 1rem',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontSize: '0.9rem',
                      }}
                    >
                      {monitors.length === 0 ? (
                        <>
                          <Server size={32} style={{ margin: '0 auto 0.75rem auto', opacity: 0.4 }} />
                          <p style={{ margin: '0 0 1rem 0' }}>No monitors configured yet</p>
                          <button
                            className="btn btn-primary"
                            onClick={() => setIsCreateModalOpen(true)}
                            style={{ margin: '0 auto', fontSize: '0.85rem' }}
                          >
                            <Plus size={16} /> Create First Monitor
                          </button>
                        </>
                      ) : (
                        <p style={{ margin: 0 }}>No monitors match your search filter.</p>
                      )}
                    </div>
                  ) : (
                    filteredMonitors.map((m) => (
                      <MonitorCard
                        key={m.id}
                        monitor={m}
                        isSelected={m.id === selectedMonitorId}
                        onSelect={() => setSelectedMonitorId(m.id)}
                        onPause={(e) => {
                          e.stopPropagation();
                          handlePause(m);
                        }}
                        onResume={(e) => {
                          e.stopPropagation();
                          handleResume(m);
                        }}
                        onEdit={(e) => {
                          e.stopPropagation();
                          setEditingMonitor(m);
                        }}
                        onDelete={(e) => {
                          e.stopPropagation();
                          handleDeleteMonitor(m.id);
                        }}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Right Column: Selected Monitor Analytics & Telemetry */}
              {selectedMonitor ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Selected Monitor Header Bar */}
                  <div
                    className="glass-panel"
                    style={{
                      padding: '1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor: 'rgba(59, 130, 246, 0.15)',
                            color: 'var(--accent-blue)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                          }}
                        >
                          {selectedMonitor.method}
                        </span>
                        <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>
                          {selectedMonitor.name}
                        </h2>
                        <StatusBadge status={!selectedMonitor.isActive ? 'paused' : selectedMonitor.status || 'healthy'} />
                      </div>
                      <div
                        style={{
                          fontSize: '0.85rem',
                          color: 'var(--text-muted)',
                          fontFamily: 'monospace',
                          wordBreak: 'break-all',
                        }}
                      >
                        {selectedMonitor.targetUrl}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => (selectedMonitor.isActive ? handlePause(selectedMonitor) : handleResume(selectedMonitor))}
                        title={selectedMonitor.isActive ? 'Pause checks' : 'Resume checks'}
                        style={{ fontSize: '0.85rem' }}
                      >
                        {selectedMonitor.isActive ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setEditingMonitor(selectedMonitor)}
                        style={{ fontSize: '0.85rem' }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleDeleteMonitor(selectedMonitor.id)}
                        style={{
                          fontSize: '0.85rem',
                          color: 'var(--accent-rose)',
                          borderColor: 'rgba(239, 68, 68, 0.3)',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Latency Percentile Chart */}
                  <LatencyChart
                    points={analytics?.recentPoints || []}
                    timeWindow={analyticsWindow}
                    onWindowChange={(w) => setAnalyticsWindow(w as '1h' | '24h' | '7d' | '30d')}
                    isLoading={isLoadingAnalytics}
                  />

                  {/* Telemetry Tabs: Check History vs Incidents */}
                  <div className="glass-panel" style={{ padding: '1.25rem' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid var(--border-subtle)',
                        paddingBottom: '0.75rem',
                        marginBottom: '1rem',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => setActiveTab('checks')}
                          className="btn"
                          style={{
                            padding: '0.4rem 0.8rem',
                            fontSize: '0.85rem',
                            backgroundColor:
                              activeTab === 'checks' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                            color:
                              activeTab === 'checks' ? 'var(--accent-emerald)' : 'var(--text-muted)',
                            border:
                              activeTab === 'checks'
                                ? '1px solid rgba(16, 185, 129, 0.3)'
                                : '1px solid transparent',
                          }}
                        >
                          <Activity size={15} />
                          Live Check Feed ({checks.length})
                        </button>
                        <button
                          onClick={() => setActiveTab('incidents')}
                          className="btn"
                          style={{
                            padding: '0.4rem 0.8rem',
                            fontSize: '0.85rem',
                            backgroundColor:
                              activeTab === 'incidents' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                            color:
                              activeTab === 'incidents' ? 'var(--accent-rose)' : 'var(--text-muted)',
                            border:
                              activeTab === 'incidents'
                                ? '1px solid rgba(239, 68, 68, 0.3)'
                                : '1px solid transparent',
                          }}
                        >
                          <AlertTriangle size={15} />
                          Incidents ({incidents.length})
                        </button>
                      </div>

                      <button
                        className="btn btn-secondary"
                        onClick={() => loadMonitorData(selectedMonitor.id)}
                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                        title="Refresh data"
                      >
                        <RefreshCw size={13} className={isLoadingChecks ? 'animate-spin' : ''} />
                        Refresh
                      </button>
                    </div>

                    {activeTab === 'checks' ? (
                      <LiveCheckFeed checks={checks} isLoading={isLoadingChecks} />
                    ) : (
                      <IncidentTimeline incidents={incidents} isLoading={isLoadingIncidents} />
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className="glass-panel"
                  style={{
                    padding: '4rem 2rem',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                  }}
                >
                  <Server size={42} style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
                  <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>No Monitor Selected</h3>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>
                    Select a monitor from the left sidebar to view real-time latency graphs, percentiles, check logs, and incidents.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Modals */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={(loggedUser) => {
          setUser(loggedUser);
          setIsLoginModalOpen(false);
        }}
      />

      <CreateMonitorModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateMonitor}
      />

      <EditMonitorModal
        isOpen={!!editingMonitor}
        monitor={editingMonitor}
        onClose={() => setEditingMonitor(null)}
        onSubmit={handleUpdateMonitor}
      />
    </div>
  );
};

export default App;
