import { Injectable, OnModuleInit } from '@nestjs/common';
import { LoggingService } from '../logging/logging.service';

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface PerformanceStats {
  totalOperations: number;
  averageDuration: number;
  slowestOperation: PerformanceMetrics;
  fastestOperation: PerformanceMetrics;
  operationsByType: Record<string, { count: number; avgDuration: number }>;
}

@Injectable()
export class PerformanceService implements OnModuleInit {
  private metrics: PerformanceMetrics[] = [];
  private readonly maxMetrics = 10000; // Keep last 10,000 metrics
  private readonly slowOperationThreshold = 1000; // 1 second

  constructor(private readonly loggingService: LoggingService) {}

  onModuleInit() {
    // Clean up old metrics periodically
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 60000); // Every minute
  }

  // Measure execution time of any function
  async measureOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>,
  ): Promise<T> {
    const startHrTime = process.hrtime.bigint();

    try {
      const result = await fn();
      const endHrTime = process.hrtime.bigint();
      const duration = Number(endHrTime - startHrTime) / 1000000; // Convert to milliseconds

      this.recordMetric({
        operation,
        duration,
        timestamp: new Date().toISOString(),
        metadata,
      });

      // Log slow operations
      if (duration > this.slowOperationThreshold) {
        this.loggingService.warn(
          `Slow operation detected: ${operation} took ${duration.toFixed(2)}ms`,
          'PERFORMANCE',
          { operation, duration, metadata },
        );
      }

      return result;
    } catch (error) {
      const endHrTime = process.hrtime.bigint();
      const duration = Number(endHrTime - startHrTime) / 1000000;

      this.recordMetric({
        operation,
        duration,
        timestamp: new Date().toISOString(),
        metadata: { ...metadata, error: error.message },
      });

      this.loggingService.error(
        `Operation failed: ${operation} after ${duration.toFixed(2)}ms`,
        'PERFORMANCE',
        { operation, duration, error: error.message },
      );

      throw error;
    }
  }

  // Synchronous version for non-async operations
  measureSyncOperation<T>(
    operation: string,
    fn: () => T,
    metadata?: Record<string, any>,
  ): T {
    const startHrTime = process.hrtime.bigint();

    try {
      const result = fn();
      const endHrTime = process.hrtime.bigint();
      const duration = Number(endHrTime - startHrTime) / 1000000;

      this.recordMetric({
        operation,
        duration,
        timestamp: new Date().toISOString(),
        metadata,
      });

      if (duration > this.slowOperationThreshold) {
        this.loggingService.warn(
          `Slow operation detected: ${operation} took ${duration.toFixed(2)}ms`,
          'PERFORMANCE',
          { operation, duration, metadata },
        );
      }

      return result;
    } catch (error) {
      const endHrTime = process.hrtime.bigint();
      const duration = Number(endHrTime - startHrTime) / 1000000;

      this.recordMetric({
        operation,
        duration,
        timestamp: new Date().toISOString(),
        metadata: { ...metadata, error: error.message },
      });

      this.loggingService.error(
        `Operation failed: ${operation} after ${duration.toFixed(2)}ms`,
        'PERFORMANCE',
        { operation, duration, error: error.message },
      );

      throw error;
    }
  }

  public recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);

    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  private cleanupOldMetrics(): void {
    // Keep only metrics from the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.metrics = this.metrics.filter(
      (metric) => new Date(metric.timestamp) > oneHourAgo,
    );
  }

  // Get performance statistics
  getStats(): PerformanceStats {
    if (this.metrics.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        slowestOperation: null as any,
        fastestOperation: null as any,
        operationsByType: {},
      };
    }

    const totalOperations = this.metrics.length;
    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    const averageDuration = totalDuration / totalOperations;

    const slowestOperation = this.metrics.reduce((slowest, current) =>
      current.duration > slowest.duration ? current : slowest,
    );

    const fastestOperation = this.metrics.reduce((fastest, current) =>
      current.duration < fastest.duration ? current : fastest,
    );

    // Group by operation type
    const operationsByType: Record<string, PerformanceMetrics[]> = {};
    this.metrics.forEach((metric) => {
      if (!operationsByType[metric.operation]) {
        operationsByType[metric.operation] = [];
      }
      operationsByType[metric.operation].push(metric);
    });

    // Calculate stats for each operation type
    const operationStats: Record<
      string,
      { count: number; avgDuration: number }
    > = {};
    Object.entries(operationsByType).forEach(([operation, metrics]) => {
      const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
      operationStats[operation] = {
        count: metrics.length,
        avgDuration: totalDuration / metrics.length,
      };
    });

    return {
      totalOperations,
      averageDuration,
      slowestOperation,
      fastestOperation,
      operationsByType: operationStats,
    };
  }

  // Get recent slow operations
  getSlowOperations(limit: number = 10): PerformanceMetrics[] {
    return this.metrics
      .filter((m) => m.duration > this.slowOperationThreshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  // Get metrics for a specific operation
  getOperationMetrics(
    operation: string,
    limit: number = 100,
  ): PerformanceMetrics[] {
    return this.metrics
      .filter((m) => m.operation === operation)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, limit);
  }

  // Clear all metrics
  clearMetrics(): void {
    this.metrics = [];
    this.loggingService.info('Performance metrics cleared', 'PERFORMANCE');
  }

  // Get performance report
  getPerformanceReport(): string {
    const stats = this.getStats();
    const slowOps = this.getSlowOperations(5);

    return `
Performance Report - ${new Date().toISOString()}
===============================================
Total Operations: ${stats.totalOperations}
Average Duration: ${stats.averageDuration.toFixed(2)}ms
Slowest Operation: ${stats.slowestOperation.operation} (${stats.slowestOperation.duration.toFixed(2)}ms)
Fastest Operation: ${stats.fastestOperation.operation} (${stats.fastestOperation.duration.toFixed(2)}ms)

Top 5 Slow Operations:
${slowOps
  .map(
    (op, index) =>
      `${index + 1}. ${op.operation}: ${op.duration.toFixed(2)}ms at ${op.timestamp}`,
  )
  .join('\n')}

Operations by Type:
${Object.entries(stats.operationsByType)
  .map(
    ([op, stats]) =>
      `${op}: ${stats.count} operations, avg ${stats.avgDuration.toFixed(2)}ms`,
  )
  .join('\n')}
    `.trim();
  }
}
