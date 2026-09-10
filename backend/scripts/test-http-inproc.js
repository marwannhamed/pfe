const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/src/app.module');
const { ValidationPipe } = require('@nestjs/common');
const { HttpExceptionFilter } = require('../dist/src/common/filters/http-exception.filter');
const { ResponseInterceptor } = require('../dist/src/common/interceptors/response.interceptor');
const { PerformanceInterceptor } = require('../dist/src/common/interceptors/performance.interceptor');
const { LoggingService } = require('../dist/src/logging/logging.service');
const { PerformanceService } = require('../dist/src/performance/performance.service');
const { PrismaService } = require('../dist/src/prisma/prisma.service');

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const loggingService = app.get(LoggingService);
  const performanceService = app.get(PerformanceService);
  app.useGlobalFilters(new HttpExceptionFilter(loggingService));
  app.useGlobalInterceptors(
    new PerformanceInterceptor(performanceService, loggingService),
    new ResponseInterceptor(),
  );
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();

  const prisma = app.get(PrismaService);
  const user = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  const { JwtService } = require('@nestjs/jwt');
  const jwt = app.get(JwtService);
  const token = await jwt.signAsync({ userId: user.id });

  const server = app.getHttpServer();
  const http = require('http');

  function req(path) {
    return new Promise((resolve) => {
      http.get(
        { hostname: '127.0.0.1', port: server.address().port, path, headers: { Authorization: `Bearer ${token}` } },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => resolve({ status: res.statusCode, body: data.slice(0, 400) }));
        },
      );
    });
  }

  await new Promise((r) => server.listen(0, r));
  for (const path of ['/maintenance', '/tenant-applications/pending']) {
    const res = await req(path);
    console.log(path, res.status, res.body);
  }
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
