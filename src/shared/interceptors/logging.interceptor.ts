import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() === 'http') {
      return this.logHttpCall(context, next);
    }
    return next.handle();
  }

  private logHttpCall(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const userAgent = request.get('user-agent') || '';
    const { ip, method, url } = request;

    const startTime = Date.now();

    this.logger.log(`${method} ${url} - ${ip} - ${userAgent.substring(0, 20)} - START`);

    return next.handle().pipe(
      tap(() => {
        const { statusCode } = response;
        const contentLength = response.get('content-length');
        const duration = Date.now() - startTime;

        this.logger.log(`${method} ${url} - ${statusCode} - ${contentLength || 0}b - ${duration}ms - ${ip}`);
      }),
    );
  }
}
