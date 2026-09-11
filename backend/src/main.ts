import type { Response } from 'express';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigurationService } from './config/configuration.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { PerformanceInterceptor } from './common/interceptors/performance.interceptor';
import { PerformanceService } from './performance/performance.service';
import { LoggingService } from './logging/logging.service';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as compression from 'compression';
import 'dotenv/config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const configService = app.get(ConfigService);
  const configurationService = app.get(ConfigurationService);

  // Validate configuration
  configurationService.validateConfiguration();

  // ── Performance Middleware ───────────────────────────────────────────────────
  // Compression for better performance
  app.use(compression());

  // ── CORS ────────────────────────────────────────────────────────────────────
  const frontendUrl = configurationService.frontendUrl;
  const allowedOrigins = [
    frontendUrl,
    'http://localhost:5173', // Vite dev server
    'http://localhost:5174', // Vite dev server (current)
    'http://localhost:3000', // React dev server
    'http://localhost:4173', // Vite preview
  ];

  // Remove duplicates
  const uniqueOrigins = [...new Set(allowedOrigins)];

  app.enableCors({
    origin: uniqueOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  });

  // ── Security Middleware ─────────────────────────────────────────────────────
  // Helmet for security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Rate limiting (off in development unless RATE_LIMIT_ENABLED=true)
  if (configurationService.rateLimitEnabled) {
    app.use(
      rateLimit({
        windowMs: configurationService.rateLimitWindowMs,
        max: configurationService.rateLimitMaxRequests,
        skip: (req) =>
          req.method === 'OPTIONS' ||
          req.path?.includes('/webhooks/') ||
          req.path?.includes('/integrations/google-business/oauth/callback') ||
          req.path === '/health',
        message: {
          success: false,
          statusCode: 429,
          message: 'Too many requests from this IP, please try again later.',
          error: 'TooManyRequests',
          timestamp: new Date().toISOString(),
        },
        standardHeaders: true,
        legacyHeaders: false,
      }),
    );
  } else {
    console.log('⚠️  Rate limiting disabled (development mode)');
  }

  // ── Global exception filter ───────────────────────────────────────────────────
  const loggingService = app.get(LoggingService);
  const performanceService = app.get(PerformanceService);
  app.useGlobalFilters(new HttpExceptionFilter(loggingService));

  // ── Global interceptors ───────────────────────────────────────────────────────
  app.useGlobalInterceptors(
    new PerformanceInterceptor(performanceService, loggingService),
    new ResponseInterceptor(),
  );

  // ── Global validation pipe ───────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown fields
      forbidNonWhitelisted: true,
      transform: true, // auto-transform types
    }),
  );

  // ── Swagger ──────────────────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('LeaseManager API')
    .setDescription('Office Lease Management Platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // ── Health Check Endpoint ───────────────────────────────────────────────────
  if (configurationService.enableMetrics) {
    app
      .getHttpAdapter()
      .get(configurationService.healthCheckEndpoint, (_req, res: Response) => {
        res.status(200).json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: configurationService.nodeEnv,
          version: '1.0.0',
        });
      });
  }

  // ── Start ────────────────────────────────────────────────────────────────────
  const port = configurationService.port;
  await app.listen(port);

  if (configurationService.isDevelopment) {
    console.log(`🚀 Server running on http://localhost:${port}`);
    console.log(`📚 Swagger docs at http://localhost:${port}/api`);
    console.log(
      `🏥 Health check at http://localhost:${port}${configurationService.healthCheckEndpoint}`,
    );
    console.log(`🌍 Environment: ${configurationService.nodeEnv}`);
    console.log(`🔗 Frontend URL: ${frontendUrl}`);
  }
}

bootstrap();
