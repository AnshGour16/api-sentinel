import { NotFoundError, ValidationError } from '../../lib/errors';
import { validateTargetUrl } from '../../utils/ssrf';
import { MonitorsRepository, monitorsRepository } from './monitors.repository';
import {
  CreateMonitorInput,
  ListMonitorsFilter,
  MonitorResponse,
  toMonitorResponse,
  UpdateMonitorInput,
} from './monitors.types';

export class MonitorsService {
  constructor(private readonly repo: MonitorsRepository = monitorsRepository) {}

  async createMonitor(userId: string, input: CreateMonitorInput): Promise<MonitorResponse> {
    const urlValidation = validateTargetUrl(input.targetUrl);
    if (!urlValidation.isValid) {
      throw new ValidationError(urlValidation.error || 'Invalid target URL');
    }

    const row = await this.repo.create(userId, {
      ...input,
      targetUrl: urlValidation.normalizedUrl || input.targetUrl,
    });

    return toMonitorResponse(row);
  }

  async listMonitors(
    userId: string,
    filter: ListMonitorsFilter = {}
  ): Promise<{ monitors: MonitorResponse[]; pagination: { total: number; limit: number; offset: number } }> {
    const { monitors, total } = await this.repo.findByUserId(userId, filter);

    return {
      monitors: monitors.map(toMonitorResponse),
      pagination: {
        total,
        limit: filter.limit ?? 50,
        offset: filter.offset ?? 0,
      },
    };
  }

  async getMonitorById(id: string, userId: string): Promise<MonitorResponse> {
    const row = await this.repo.findByIdAndUserId(id, userId);
    if (!row) {
      throw new NotFoundError(`Monitor with ID "${id}" was not found`);
    }

    return toMonitorResponse(row);
  }

  async updateMonitor(
    id: string,
    userId: string,
    input: UpdateMonitorInput
  ): Promise<MonitorResponse> {
    if (input.targetUrl) {
      const urlValidation = validateTargetUrl(input.targetUrl);
      if (!urlValidation.isValid) {
        throw new ValidationError(urlValidation.error || 'Invalid target URL');
      }
      input.targetUrl = urlValidation.normalizedUrl || input.targetUrl;
    }

    const row = await this.repo.update(id, userId, input);
    if (!row) {
      throw new NotFoundError(`Monitor with ID "${id}" was not found`);
    }

    return toMonitorResponse(row);
  }

  async deleteMonitor(id: string, userId: string): Promise<void> {
    const deleted = await this.repo.delete(id, userId);
    if (!deleted) {
      throw new NotFoundError(`Monitor with ID "${id}" was not found`);
    }
  }

  async pauseMonitor(id: string, userId: string): Promise<MonitorResponse> {
    const row = await this.repo.setActiveState(id, userId, false);
    if (!row) {
      throw new NotFoundError(`Monitor with ID "${id}" was not found`);
    }

    return toMonitorResponse(row);
  }

  async resumeMonitor(id: string, userId: string): Promise<MonitorResponse> {
    const row = await this.repo.setActiveState(id, userId, true);
    if (!row) {
      throw new NotFoundError(`Monitor with ID "${id}" was not found`);
    }

    return toMonitorResponse(row);
  }
}

export const monitorsService = new MonitorsService();
