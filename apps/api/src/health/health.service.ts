import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  check() {
    return {
      status: 'ok',
      service: 'billable-api',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }
}
