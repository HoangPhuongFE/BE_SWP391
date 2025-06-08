import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  //  Cấu hình đầy đủ ValidationPipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
// Cấu hình Swagger
  const config = new DocumentBuilder()
    .setTitle('SWP - Graduation Thesis API')
    .setDescription('API Quản lí chu kỳ kinh nguyệt')
    .setVersion('1.0')
    .addTag('students')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
//https://swp.learnup.work/api
//http://localhost:3001/api
  await app.listen(3001);
}

bootstrap();
