import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Security headers
  app.use(helmet());

  // Global prefix for all API routes
  app.setGlobalPrefix('api/v1');

  // CORS configuration
  const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  app.enableCors({
    origin: allowedOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  });

  // Global DTO validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter for uniform error responses
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`Billable API is running on http://localhost:${port}/api/v1`);
  logger.log(`Health endpoint: http://localhost:${port}/api/v1/health`);
}

bootstrap();
