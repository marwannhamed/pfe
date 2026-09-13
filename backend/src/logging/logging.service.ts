import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationService } from '../config/configuration.service';
import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'debug' | 'verbose' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  traceId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class LoggingService {
  private readonly logger = new Logger(LoggingService.name);
  private readonly logFile: string;
  private readonly logLevel: LogLevel;

  constructor(private configService: ConfigurationService) {
    this.logFile = configService.logFile;
    this.logLevel = this.getLogLevel(configService.logLevel);

    // Ensure log directory exists
    this.ensureLogDirectory();
  }

  private getLogLevel(level: string): LogLevel {
    const levels: Record<string, LogLevel> = {
      error: 'error' as LogLevel,
      warn: 'warn' as LogLevel,
      info: 'info' as LogLevel,
      debug: 'debug' as LogLevel,
      verbose: 'verbose' as LogLevel,
    };
    return levels[level.toLowerCase()] || ('info' as LogLevel);
  }

  private ensureLogDirectory(): void {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = [
      'debug' as LogLevel,
      'verbose' as LogLevel,
      'info' as LogLevel,
      'warn' as LogLevel,
      'error' as LogLevel,
    ];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatLogEntry(entry: LogEntry): string {
    const logObject = {
      timestamp: entry.timestamp,
      level: entry.level.toUpperCase(),
      message: entry.message,
      ...(entry.context && { context: entry.context }),
      ...(entry.traceId && { traceId: entry.traceId }),
      ...(entry.userId && { userId: entry.userId }),
      ...(entry.ip && { ip: entry.ip }),
      ...(entry.userAgent && { userAgent: entry.userAgent }),
      ...(entry.requestId && { requestId: entry.requestId }),
      ...(entry.metadata && { metadata: entry.metadata }),
    };

    return JSON.stringify(logObject);
  }

  private writeToFile(entry: LogEntry): void {
    try {
      const logLine = this.formatLogEntry(entry) + '\n';
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      this.logger.error('Failed to write to log file:', error);
    }
  }

  private log(
    level: LogLevel,
    message: string,
    context?: string,
    metadata?: Record<string, any>,
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      metadata,
    };

    // Write to file
    this.writeToFile(entry);

    // Also log to console for development
    if (this.configService.isDevelopment) {
      switch (level) {
        case 'error' as LogLevel:
          this.logger.error(message, metadata);
          break;
        case 'warn' as LogLevel:
          this.logger.warn(message, metadata);
          break;
        case 'info' as LogLevel:
          this.logger.log(message, metadata);
          break;
        case 'debug' as LogLevel:
          this.logger.debug(message, metadata);
          break;
        case 'verbose' as LogLevel:
          this.logger.verbose(message, metadata);
          break;
      }
    }
  }

  debug(
    message: string,
    context?: string,
    metadata?: Record<string, any>,
  ): void {
    this.log('debug' as LogLevel, message, context, metadata);
  }

  verbose(
    message: string,
    context?: string,
    metadata?: Record<string, any>,
  ): void {
    this.log('verbose' as LogLevel, message, context, metadata);
  }

  info(
    message: string,
    context?: string,
    metadata?: Record<string, any>,
  ): void {
    this.log('info' as LogLevel, message, context, metadata);
  }

  warn(
    message: string,
    context?: string,
    metadata?: Record<string, any>,
  ): void {
    this.log('warn' as LogLevel, message, context, metadata);
  }

  error(
    message: string,
    context?: string,
    metadata?: Record<string, any>,
  ): void {
    this.log('error' as LogLevel, message, context, metadata);
  }

  // Structured logging methods
  logUserAction(
    action: string,
    userId: string,
    metadata?: Record<string, any>,
  ): void {
    this.info(`User action: ${action}`, 'USER_ACTION', {
      userId,
      action,
      ...metadata,
    });
  }

  logApiRequest(
    method: string,
    url: string,
    userId?: string,
    metadata?: Record<string, any>,
  ): void {
    this.info(`${method} ${url}`, 'API_REQUEST', {
      method,
      url,
      userId,
      ...metadata,
    });
  }

  logSecurityEvent(event: string, metadata?: Record<string, any>): void {
    this.warn(`Security event: ${event}`, 'SECURITY', {
      event,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }

  logBusinessEvent(event: string, metadata?: Record<string, any>): void {
    this.info(`Business event: ${event}`, 'BUSINESS', {
      event,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }

  logPerformance(
    operation: string,
    duration: number,
    metadata?: Record<string, any>,
  ): void {
    this.info(`Performance: ${operation} took ${duration}ms`, 'PERFORMANCE', {
      operation,
      duration,
      ...metadata,
    });
  }

  // Log rotation and cleanup
  async cleanOldLogs(daysToKeep: number = 30): Promise<void> {
    try {
      const stats = fs.statSync(this.logFile);
      const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

      if (stats.mtime.getTime() < cutoffTime) {
        const archiveFile = `${this.logFile}.${stats.mtime.toISOString().split('T')[0]}`;
        fs.renameSync(this.logFile, archiveFile);
        this.info(`Log file rotated to ${archiveFile}`, 'LOG_ROTATION');
      }
    } catch (error) {
      this.error('Failed to rotate log file', 'LOG_ROTATION', {
        error: error.message,
      });
    }
  }

  // Get log statistics
  getLogStats(): { size: number; lastModified: Date } {
    try {
      const stats = fs.statSync(this.logFile);
      return {
        size: stats.size,
        lastModified: stats.mtime,
      };
    } catch {
      return { size: 0, lastModified: new Date() };
    }
  }
}
