import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface PerformanceMetric {
  method: string;
  url: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
}

interface SystemMetrics {
  timestamp: Date;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  activeConnections: number;
  cacheHitRate: number;
}

@Injectable()
export class PerformanceService implements OnModuleInit {
  private readonly logger = new Logger(PerformanceService.name);
  private metrics: PerformanceMetric[] = [];
  private systemMetrics: SystemMetrics[] = [];
  private maxMetrics = 10000; // Keep last 10k metrics
  private activeConnections = 0;

  onModuleInit() {
    // Start collecting system metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);
  }

  // Request interceptor
  logRequest(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    this.activeConnections++;

    res.on('finish', () => {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      this.activeConnections--;

      const metric: PerformanceMetric = {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        responseTime,
        timestamp: new Date(),
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      };

      this.addMetric(metric);

      // Log slow requests
      if (responseTime > 2000) {
        this.logger.warn(
          `Slow request: ${req.method} ${req.url} - ${responseTime}ms`,
        );
      }

      // Log errors
      if (res.statusCode >= 400) {
        this.logger.error(
          `Error response: ${req.method} ${req.url} - ${res.statusCode} - ${responseTime}ms`,
        );
      }
    });

    next();
  }

  private addMetric(metric: PerformanceMetric) {
    this.metrics.push(metric);
    
    // Keep only the last N metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  private collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const metric: SystemMetrics = {
      timestamp: new Date(),
      memoryUsage: memUsage,
      cpuUsage,
      activeConnections: this.activeConnections,
      cacheHitRate: this.calculateCacheHitRate(),
    };

    this.systemMetrics.push(metric);

    // Keep only last 100 system metrics
    if (this.systemMetrics.length > 100) {
      this.systemMetrics = this.systemMetrics.slice(-100);
    }

    // Alert on high memory usage
    const memoryUsageMB = memUsage.heapUsed / 1024 / 1024;
    if (memoryUsageMB > 500) {
      this.logger.warn(`High memory usage: ${memoryUsageMB.toFixed(2)}MB`);
    }
  }

  private calculateCacheHitRate(): number {
    // This would integrate with your cache service
    // For now, return a placeholder
    return 0.85;
  }

  // Analytics methods
  getPerformanceMetrics(timeRange?: { from: Date; to: Date }) {
    let filteredMetrics = this.metrics;

    if (timeRange) {
      filteredMetrics = this.metrics.filter(
        m => m.timestamp >= timeRange.from && m.timestamp <= timeRange.to,
      );
    }

    return {
      totalRequests: filteredMetrics.length,
      averageResponseTime: this.calculateAverageResponseTime(filteredMetrics),
      requestsPerSecond: this.calculateRequestsPerSecond(filteredMetrics),
      errorRate: this.calculateErrorRate(filteredMetrics),
      slowestRequests: this.getSlowestRequests(filteredMetrics, 10),
      fastestRequests: this.getFastestRequests(filteredMetrics, 10),
      statusCodes: this.getStatusCodeDistribution(filteredMetrics),
      endpoints: this.getEndpointStats(filteredMetrics),
    };
  }

  getSystemMetrics() {
    return {
      current: this.systemMetrics[this.systemMetrics.length - 1],
      history: this.systemMetrics,
      memoryTrend: this.getMemoryTrend(),
      cpuTrend: this.getCpuTrend(),
    };
  }

  private calculateAverageResponseTime(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 0;
    const total = metrics.reduce((sum, m) => sum + m.responseTime, 0);
    return total / metrics.length;
  }

  private calculateRequestsPerSecond(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 0;
    
    const timeSpan = metrics[metrics.length - 1].timestamp.getTime() - metrics[0].timestamp.getTime();
    if (timeSpan === 0) return 0;
    
    return (metrics.length / timeSpan) * 1000;
  }

  private calculateErrorRate(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 0;
    const errors = metrics.filter(m => m.statusCode >= 400).length;
    return (errors / metrics.length) * 100;
  }

  private getSlowestRequests(metrics: PerformanceMetric[], limit: number) {
    return metrics
      .sort((a, b) => b.responseTime - a.responseTime)
      .slice(0, limit);
  }

  private getFastestRequests(metrics: PerformanceMetric[], limit: number) {
    return metrics
      .sort((a, b) => a.responseTime - b.responseTime)
      .slice(0, limit);
  }

  private getStatusCodeDistribution(metrics: PerformanceMetric[]) {
    const distribution: Record<number, number> = {};
    
    metrics.forEach(m => {
      distribution[m.statusCode] = (distribution[m.statusCode] || 0) + 1;
    });

    return distribution;
  }

  private getEndpointStats(metrics: PerformanceMetric[]) {
    const stats: Record<string, { count: number; avgResponseTime: number; errorRate: number }> = {};
    
    metrics.forEach(m => {
      const endpoint = `${m.method} ${this.simplifyUrl(m.url)}`;
      
      if (!stats[endpoint]) {
        stats[endpoint] = { count: 0, avgResponseTime: 0, errorRate: 0 };
      }
      
      stats[endpoint].count++;
    });

    // Calculate averages and error rates
    Object.keys(stats).forEach(endpoint => {
      const endpointMetrics = metrics.filter(m => 
        `${m.method} ${this.simplifyUrl(m.url)}` === endpoint
      );
      
      const totalResponseTime = endpointMetrics.reduce((sum, m) => sum + m.responseTime, 0);
      const errorCount = endpointMetrics.filter(m => m.statusCode >= 400).length;
      
      stats[endpoint].avgResponseTime = totalResponseTime / endpointMetrics.length;
      stats[endpoint].errorRate = (errorCount / endpointMetrics.length) * 100;
    });

    return stats;
  }

  private simplifyUrl(url: string): string {
    // Replace dynamic segments with placeholders
    return url
      .replace(/\/[a-f0-9-]{36}/g, '/:id') // UUIDs
      .replace(/\/\d+/g, '/:id') // Numbers
      .replace(/\?.*$/, ''); // Query params
  }

  private getMemoryTrend() {
    return this.systemMetrics.map(m => ({
      timestamp: m.timestamp,
      heapUsed: m.memoryUsage.heapUsed,
      heapTotal: m.memoryUsage.heapTotal,
    }));
  }

  private getCpuTrend() {
    return this.systemMetrics.map(m => ({
      timestamp: m.timestamp,
      user: m.cpuUsage.user,
      system: m.cpuUsage.system,
    }));
  }

  // Health check
  async getHealthStatus() {
    const memUsage = process.memoryUsage();
    const memoryUsageMB = memUsage.heapUsed / 1024 / 1024;
    
    const recentMetrics = this.metrics.slice(-100);
    const avgResponseTime = this.calculateAverageResponseTime(recentMetrics);
    const errorRate = this.calculateErrorRate(recentMetrics);

    return {
      status: this.getOverallStatus(memoryUsageMB, avgResponseTime, errorRate),
      memory: {
        usage: `${memoryUsageMB.toFixed(2)}MB`,
        status: memoryUsageMB > 500 ? 'warning' : 'healthy',
      },
      performance: {
        avgResponseTime: `${avgResponseTime.toFixed(2)}ms`,
        status: avgResponseTime > 1000 ? 'warning' : 'healthy',
      },
      errors: {
        rate: `${errorRate.toFixed(2)}%`,
        status: errorRate > 5 ? 'warning' : 'healthy',
      },
      activeConnections: this.activeConnections,
    };
  }

  private getOverallStatus(memory: number, avgResponseTime: number, errorRate: number) {
    if (memory > 800 || avgResponseTime > 3000 || errorRate > 10) {
      return 'unhealthy';
    }
    if (memory > 500 || avgResponseTime > 1000 || errorRate > 5) {
      return 'warning';
    }
    return 'healthy';
  }
}
