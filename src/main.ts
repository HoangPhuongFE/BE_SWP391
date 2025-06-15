import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { JsonInterceptor } from '../src/common/json.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1) Tất cả controller sẽ dùng prefix /api
  app.setGlobalPrefix('api');

  // 2) Áp ValidationPipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: false,
  }));

  // 3) Áp interceptor để set header JSON chỉ cho controller
  app.useGlobalInterceptors(new JsonInterceptor());

  // 4) Cấu hình Swagger (nếu vẫn muốn ở /api, hoặc đổi sang /docs)
  const config = new DocumentBuilder()
    .setTitle('SWP - Graduation Thesis API')
    .setDescription('API Quản lí chu kỳ kinh nguyệt')
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'Authorization',
      in: 'header',
    }, 'access-token')
    .build();
  const document = SwaggerModule.createDocument(app, config);

  // **Lựa chọn A**: Giữ Swagger UI trên /api (cẩn thận: path trùng controller)
  // SwaggerModule.setup('api', app, document);

  // **Lựa chọn B (khuyến nghị)**: Tách hẳn Swagger UI ra /docs
   SwaggerModule.setup('docs', app, document);
    
  //https://learnup.work/api
  //https://learnup.work/docs (Swagger UI)
  //https://learnup.work/api/auth/google

  //http://localhost:3001/docs (Swagger UI) chạy được API 
  //http://localhost:3001/api (API gốc)
  //http://localhost:3001/api/auth/google

  // 5) CORS và listen
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL_PROD,
      process.env.FRONTEND_URL_LOCAL,
      'http://localhost:3000',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  await app.listen(3001);
}
bootstrap();
