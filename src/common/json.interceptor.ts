import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class JsonInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const res = ctx.getResponse();

    // Chỉ gắn header này, không làm gì khác
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    return next.handle();
  }
}
