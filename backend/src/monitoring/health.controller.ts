import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { LoggingService } from '../logging/logging.service';
import { PerformanceService } from '../performance/performance.service';
import { ConfigurationService } from '../config/configuration.service';
import * as os from 'os';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Health & Monitoring')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
    private readonly performanceService: PerformanceService,
    private readonly configService: ConfigurationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'LeaseManager API',
      version: '1.0.0',
    };
  }

  @Get('detailed')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Detailed health check with system info' })
  @ApiResponse({ status: 200, description: 'Detailed health information' })
  async detailedHealth() {
    const startTime = Date.now();
    
    try {
      // Check database connection
      const dbStatus = await this.checkDatabase();
      
      // Check system resources
      const systemInfo = this.getSystemInfo();
      
      // Check logging service
      const logStats = this.loggingService.getLogStats();
      
      // Check performance metrics
      const perfStats = this.performanceService.getStats();
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'LeaseManager API',
        version: '1.0.0',
        responseTime: `${responseTime}ms`,
        checks: {
          database: dbStatus,
          logging: {
            status: 'ok',
            logFileSize: `${(logStats.size / 1024 / 1024).toFixed(2)}MB`,
            lastModified: logStats.lastModified,
          },
          performance: {
            status: 'ok',
            totalOperations: perfStats.totalOperations,
            averageResponseTime: `${perfStats.averageDuration.toFixed(2)}ms`,
          },
        },
        system: systemInfo,
      };
    } catch (error) {
      this.loggingService.error('Health check failed', 'HEALTH_CHECK', { error: error.message });
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  @Get('metrics')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get application metrics' })
  @ApiResponse({ status: 200, description: 'Application metrics' })
  async metrics() {
    const perfStats = this.performanceService.getStats();
    const slowOperations = this.performanceService.getSlowOperations(10);
    const logStats = this.loggingService.getLogStats();
    
    return {
      timestamp: new Date().toISOString(),
      performance: {
        totalOperations: perfStats.totalOperations,
        averageDuration: perfStats.averageDuration,
        slowestOperation: perfStats.slowestOperation,
        fastestOperation: perfStats.fastestOperation,
        operationsByType: perfStats.operationsByType,
      },
      slowOperations: slowOperations.map(op => ({
        operation: op.operation,
        duration: `${op.duration.toFixed(2)}ms`,
        timestamp: op.timestamp,
      })),
      logging: {
        logFileSize: `${(logStats.size / 1024 / 1024).toFixed(2)}MB`,
        lastModified: logStats.lastModified,
      },
      system: this.getSystemInfo(),
    };
  }

  @Get('performance-report')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get detailed performance report' })
  @ApiResponse({ status: 200, description: 'Performance report' })
  async performanceReport() {
    return {
      report: this.performanceService.getPerformanceReport(),
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<any> {
    try {
      const startTime = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'ok',
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private getSystemInfo(): any {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptime: {
        process: `${Math.floor(process.uptime())}s`,
        system: `${Math.floor(os.uptime())}s`,
      },
      memory: {
        total: `${(totalMem / 1024 / 1024).toFixed(2)}MB`,
        free: `${(freeMem / 1024 / 1024).toFixed(2)}MB`,
        used: `${(usedMem / 1024 / 1024).toFixed(2)}MB`,
        process: {
          rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)}MB`,
          heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
          heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
          external: `${(memUsage.external / 1024 / 1024).toFixed(2)}MB`,
        },
      },
      cpu: {
        count: os.cpus().length,
        loadAverage: os.loadavg(),
      },
    };
  }
}
