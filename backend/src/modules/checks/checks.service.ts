import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { validateTargetUrl } from '../../utils/ssrf';
import { monitorsRepository } from '../monitors/monitors.repository';
import { checksRepository, ChecksRepository } from './checks.repository';
import { CheckRecord, MonitorCheckJob, SaveCheckInput } from './checks.types';
import { incidentsService } from '../incidents/incidents.service';
import {
  emitCheckCompleted,
  emitIncidentOpened,
  emitIncidentResolved,
  emitIncidentUpdated,
  emitMonitorStatusChanged,
} from '../../lib/socket';

export class ChecksService {
  constructor(private readonly repo: ChecksRepository = checksRepository) {}

  async executeCheck(job: MonitorCheckJob): Promise<CheckRecord | null> {
    const checkedAt = new Date(job.scheduledAt || Date.now());

    // 1. Fetch the latest monitor configuration directly from PostgreSQL before execution
    const monitor = await monitorsRepository.findById(job.monitorId);
    if (!monitor) {
      logger.warn({ monitorId: job.monitorId, executionId: job.executionId }, 'Monitor no longer exists, skipping check');
      return null;
    }

    if (!monitor.is_active) {
      logger.info({ monitorId: job.monitorId, executionId: job.executionId }, 'Monitor is paused, skipping check');
      return null;
    }

    // 2. Outbound SSRF & Target Security Validation
    const urlValidation = validateTargetUrl(monitor.target_url);
    if (!urlValidation.isValid) {
      logger.warn(
        { monitorId: monitor.id, url: monitor.target_url, error: urlValidation.error },
        'Target URL failed SSRF validation during check execution'
      );

      const checkData: SaveCheckInput = {
        monitorId: monitor.id,
        executionId: job.executionId,
        statusCode: null,
        latencyMs: 0,
        outcome: 'invalid_response',
        errorCode: 'SSRF_PROHIBITED',
        checkedAt,
        completedAt: new Date(),
      };

      const saved = await this.repo.saveCheck(checkData);
      await this.repo.updateLastCheckedAt(monitor.id, checkedAt);

      // Process incident & emit events for SSRF error
      const incidentResult = await incidentsService.processCheckOutcome(monitor.id, 'invalid_response', checkedAt);
      this.dispatchRealtimeEvents(monitor.user_id, monitor.id, saved, incidentResult, checkedAt);

      return saved;
    }

    const targetUrl = urlValidation.normalizedUrl || monitor.target_url;
    const timeoutMs = Math.min(monitor.timeout_ms || 5000, env.MONITOR_MAX_TIMEOUT_MS);
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    const startHrTime = process.hrtime.bigint();
    let checkData: SaveCheckInput;

    try {
      const response = await fetch(targetUrl, {
        method: monitor.method || 'GET',
        signal: controller.signal,
        redirect: 'manual', // Disable automatic redirect following to prevent redirect-based SSRF
        headers: {
          'User-Agent': 'APISentinel-Monitor/1.0',
          Accept: '*/*',
        },
      });

      const elapsedNs = process.hrtime.bigint() - startHrTime;
      const latencyMs = Math.round(Number(elapsedNs) / 1_000_000);
      const completedAt = new Date();

      const isStatusExpected =
        response.status >= monitor.expected_status_min &&
        response.status <= monitor.expected_status_max;

      checkData = {
        monitorId: monitor.id,
        executionId: job.executionId,
        statusCode: response.status,
        latencyMs,
        outcome: isStatusExpected ? 'success' : 'http_error',
        errorCode: isStatusExpected ? null : `HTTP_${response.status}`,
        checkedAt,
        completedAt,
      };
    } catch (err: unknown) {
      const elapsedNs = process.hrtime.bigint() - startHrTime;
      const latencyMs = Math.round(Number(elapsedNs) / 1_000_000);
      const completedAt = new Date();

      const error = err as Error & { code?: string };
      const isTimeout =
        error.name === 'AbortError' ||
        error.message?.toLowerCase().includes('timeout') ||
        error.code === 'ETIMEDOUT';

      checkData = {
        monitorId: monitor.id,
        executionId: job.executionId,
        statusCode: null,
        latencyMs,
        outcome: isTimeout ? 'timeout' : 'network_error',
        errorCode: isTimeout ? 'REQUEST_TIMEOUT' : error.code || 'CONNECTION_FAILED',
        checkedAt,
        completedAt,
      };
    } finally {
      clearTimeout(timeoutHandle);
    }

    // 3. Persist check outcome idempotently
    const savedRecord = await this.repo.saveCheck(checkData);

    // 4. Update monitor's last checked timestamp
    await this.repo.updateLastCheckedAt(monitor.id, checkedAt);

    // 5. Process incident transitions transactionally
    const incidentResult = await incidentsService.processCheckOutcome(
      monitor.id,
      savedRecord.outcome,
      checkedAt
    );

    // 6. Emit real-time events to the monitor owner's room
    this.dispatchRealtimeEvents(monitor.user_id, monitor.id, savedRecord, incidentResult, checkedAt);

    logger.info(
      {
        monitorId: monitor.id,
        executionId: job.executionId,
        outcome: savedRecord.outcome,
        statusCode: savedRecord.status_code,
        latencyMs: savedRecord.latency_ms,
        incidentTransition: incidentResult.transitionType,
      },
      'Monitor health check executed and recorded'
    );

    return savedRecord;
  }

  private dispatchRealtimeEvents(
    userId: string,
    monitorId: string,
    check: CheckRecord,
    incidentResult: { incident: any; transitionType: string },
    checkedAt: Date
  ): void {
    // 1. Emit check completed
    emitCheckCompleted(userId, {
      monitorId,
      checkId: check.id,
      statusCode: check.status_code,
      latencyMs: check.latency_ms,
      outcome: check.outcome,
      errorCode: check.error_code,
      checkedAt: check.checked_at.toISOString(),
    });

    const { incident, transitionType } = incidentResult;

    // 2. Emit incident transitions and status changes
    if (transitionType === 'opened' && incident) {
      emitIncidentOpened(userId, {
        incidentId: incident.id,
        monitorId,
        status: incident.status,
        failureCount: incident.failure_count,
        startedAt: incident.started_at.toISOString(),
        resolvedAt: null,
      });

      emitMonitorStatusChanged(userId, {
        monitorId,
        status: 'unhealthy',
        timestamp: checkedAt.toISOString(),
      });
    } else if (transitionType === 'updated' && incident) {
      emitIncidentUpdated(userId, {
        incidentId: incident.id,
        monitorId,
        status: incident.status,
        failureCount: incident.failure_count,
        startedAt: incident.started_at.toISOString(),
        resolvedAt: null,
      });
    } else if (transitionType === 'resolved' && incident) {
      emitIncidentResolved(userId, {
        incidentId: incident.id,
        monitorId,
        status: incident.status,
        failureCount: incident.failure_count,
        startedAt: incident.started_at.toISOString(),
        resolvedAt: incident.resolved_at ? incident.resolved_at.toISOString() : null,
      });

      emitMonitorStatusChanged(userId, {
        monitorId,
        status: 'healthy',
        timestamp: checkedAt.toISOString(),
      });
    }
  }
}

export const checksService = new ChecksService();
