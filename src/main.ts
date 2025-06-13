import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  interface CustomRequest extends Request {}
  interface CustomResponse extends Response {}

  app.use((_req: CustomRequest, res: CustomResponse, next: NextFunction) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
  });
  //  Cấu hình đầy đủ ValidationPipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  // --- Cấu hình Swagger có Bearer Auth ---
  const config = new DocumentBuilder()
    .setTitle('SWP - Graduation Thesis API')
    .setDescription('API Quản lí chu kỳ kinh nguyệt')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  //https://learnup.work/api
  //https://learnup.work/api/auth/google
  //http://localhost:3001/api
  //http://localhost:3001/api/auth/google
  // --- Cấu hình CORS ---
  ////
  app.enableCors({
    //
    origin: [
      process.env.FRONTEND_URL_PROD,
      process.env.FRONTEND_URL_LOCAL, 
      "http://localhost:3000"
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  await app.listen(3001);
}

bootstrap();
