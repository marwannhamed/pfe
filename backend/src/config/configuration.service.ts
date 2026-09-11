import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigurationService {
  // Server Configuration
  get port(): number {
    return parseInt(process.env.APP_PORT || process.env.PORT || '6001', 10);
  }

  get nodeEnv(): string {
    return process.env.NODE_ENV || 'development';
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  // Database Configuration
  get databaseUrl(): string {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    return url;
  }

  // JWT Configuration
  get jwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret === 'secret') {
      throw new Error(
        'JWT_SECRET environment variable must be set and not be "secret"',
      );
    }
    return secret;
  }

  get jwtRefreshSecret(): string {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret || secret === 'secret2') {
      throw new Error(
        'JWT_REFRESH_SECRET environment variable must be set and not be "secret2"',
      );
    }
    return secret;
  }

  get jwtExpirationTime(): string {
    return process.env.JWT_EXP_IN || '1h';
  }

  get jwtRefreshExpirationTime(): string {
    return process.env.JWT_REFRESH_EXP_IN || '7d';
  }

  // Frontend Configuration
  get frontendUrl(): string {
    return process.env.FRONTEND_URL || 'http://localhost:3000';
  }

  // Email Configuration
  get mailHost(): string {
    return process.env.MAIL_HOST || 'localhost';
  }

  get mailPort(): number {
    return parseInt(process.env.MAIL_PORT || '587', 10);
  }

  get mailUser(): string {
    const user = process.env.MAIL_USER;
    if (!user) {
      throw new Error('MAIL_USER environment variable is required');
    }
    return user;
  }

  get mailPassword(): string {
    const password = process.env.MAIL_PASSWORD;
    if (!password) {
      throw new Error('MAIL_PASSWORD environment variable is required');
    }
    return password;
  }

  get mailFrom(): string {
    return process.env.MAIL_FROM || 'noreply@localhost';
  }

  get mailFromName(): string {
    return process.env.MAIL_FROM_NAME || 'LeaseManager Support';
  }

  // File Upload Configuration
  get uploadDir(): string {
    return process.env.UPLOAD_DIR || './uploads';
  }

  get maxFileSize(): number {
    return parseInt(process.env.MAX_FILE_SIZE || '10485760', 10); // 10MB default
  }

  // Cloudinary Configuration
  get cloudinaryCloudName(): string {
    return process.env.CLOUDINARY_CLOUD_NAME || '';
  }

  get cloudinaryApiKey(): string {
    return process.env.CLOUDINARY_API_KEY || '';
  }

  get cloudinaryApiSecret(): string {
    return process.env.CLOUDINARY_API_SECRET || '';
  }

  // Rate Limiting Configuration (disabled in development — dashboard fires many parallel requests)
  get rateLimitEnabled(): boolean {
    if (this.isDevelopment) return process.env.RATE_LIMIT_ENABLED === 'true';
    return process.env.RATE_LIMIT_ENABLED !== 'false';
  }

  get rateLimitWindowMs(): number {
    return parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 minutes default
  }

  get rateLimitMaxRequests(): number {
    const fallback = this.isDevelopment ? '10000' : '100';
    return parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || fallback, 10);
  }

  // Logging Configuration
  get logLevel(): string {
    return process.env.LOG_LEVEL || 'info';
  }

  get logFile(): string {
    return process.env.LOG_FILE || './logs/app.log';
  }

  // Security Configuration
  get bcryptRounds(): number {
    return parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
  }

  get sessionSecret(): string {
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
      throw new Error('SESSION_SECRET environment variable is required');
    }
    return secret;
  }

  // Monitoring Configuration
  get enableMetrics(): boolean {
    return process.env.ENABLE_METRICS === 'true';
  }

  get healthCheckEndpoint(): string {
    return process.env.HEALTH_CHECK_ENDPOINT || '/health';
  }

  // Backup Configuration
  get backupEnabled(): boolean {
    return process.env.BACKUP_ENABLED === 'true';
  }

  get backupSchedule(): string {
    return process.env.BACKUP_SCHEDULE || '0 2 * * *'; // Daily at 2 AM
  }

  get backupRetentionDays(): number {
    return parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
  }

  // Validation Methods
  validateConfiguration(): void {
    const requiredVars = [
      'DATABASE_URL',
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'MAIL_USER',
      'MAIL_PASSWORD',
      'SESSION_SECRET',
    ];

    const missingVars = requiredVars.filter((varName) => !process.env[varName]);

    if (missingVars.length > 0) {
      console.warn(`Missing environment variables: ${missingVars.join(', ')}`);
      // For development, allow missing vars but warn
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          `Missing required environment variables: ${missingVars.join(', ')}`,
        );
      }
    }

    // Validate that secrets are not default values
    const defaultSecrets = {
      JWT_SECRET: 'secret',
      JWT_REFRESH_SECRET: 'secret2',
    };

    for (const [key, defaultValue] of Object.entries(defaultSecrets)) {
      if (process.env[key] === defaultValue) {
        throw new Error(
          `${key} cannot be set to default value "${defaultValue}" in production`,
        );
      }
    }
  }
}
