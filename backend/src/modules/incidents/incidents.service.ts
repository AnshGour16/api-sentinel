import { PoolClient } from 'pg';
import { NotFoundError } from '../../lib/errors';
import { monitorsRepository } from '../monitors/monitors.repository';
import { CheckOutcome } from '../checks/checks.types';
import { incidentsRepository, IncidentsRepository } from './incidents.repository';
import {
  IncidentResponse,
  IncidentTransitionResult,
  toIncidentResponse,
} from './incidents.types';

export class IncidentsService {
  constructor(private readonly repo: IncidentsRepository = incidentsRepository) {}

  async processCheckOutcome(
    monitorId: string,
    outcome: CheckOutcome,
    checkedAt: Date = new Date(),
    client?: PoolClient
  ): Promise<IncidentTransitionResult> {
    const isHealthy = outcome === 'success';

    if (isHealthy) {
      // Monitor is healthy. Check if an active incident needs resolution.
      const activeIncident = await this.repo.findActiveByMonitorId(monitorId, client);
      if (activeIncident) {
        const resolved = await this.repo.resolveIncident(activeIncident.id, checkedAt, client);
        return {
          incident: resolved,
          transitionType: 'resolved',
        };
      }

      return {
        incident: null,
        transitionType: 'none',
      };
    }

    // Monitor is unhealthy (failure outcome).
    const activeIncident = await this.repo.findActiveByMonitorId(monitorId, client);

    if (activeIncident) {
      // Existing incident is already open, increment failure count
      const updated = await this.repo.incrementFailure(activeIncident.id, checkedAt, client);
      return {
        incident: updated,
        transitionType: 'updated',
      };
    }

    // No existing unresolved incident, open a new incident
    const opened = await this.repo.createIncident(monitorId, checkedAt, client);
    return {
      incident: opened,
      transitionType: 'opened',
    };
  }

  async getMonitorIncidents(
    monitorId: string,
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<{ incidents: IncidentResponse[]; total: number }> {
    // Enforce ownership: monitor must exist and belong to the user
    const monitor = await monitorsRepository.findByIdAndUserId(monitorId, userId);
    if (!monitor) {
      throw new NotFoundError(`Monitor with ID "${monitorId}" was not found`);
    }

    const { incidents, total } = await this.repo.findByMonitorId(monitorId, limit, offset);

    return {
      incidents: incidents.map(toIncidentResponse),
      total,
    };
  }
}

export const incidentsService = new IncidentsService();
