import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { Request, Response } from 'express';
import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggingInterceptor],
    }).compile();

    interceptor = module.get<LoggingInterceptor>(LoggingInterceptor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('intercept', () => {
    it('should log HTTP requests and responses', async () => {
      const mockRequest = {
        ip: '127.0.0.1',
        method: 'GET',
        url: '/test',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      } as unknown as Request;

      const mockResponse = {
        statusCode: 200,
        get: jest.fn().mockReturnValue('1024'),
      } as unknown as Response;

      const mockContext = {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      } as ExecutionContext;

      const mockCallHandler = {
        handle: () => of('test result'),
      } as CallHandler;

      const logSpy = jest.spyOn(interceptor['logger'], 'log');

      const result = interceptor.intercept(mockContext, mockCallHandler);

      await result.toPromise();

      expect(logSpy).toHaveBeenCalledWith('GET /test - 127.0.0.1 - Mozilla/5.0 - START');
      expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/GET \/test - 200 - 1024b - \d+ms - 127.0.0.1/));
    });

    it('should handle requests without user agent', async () => {
      const mockRequest = {
        ip: '192.168.1.1',
        method: 'POST',
        url: '/api/upload',
        get: jest.fn().mockReturnValue(undefined),
      } as unknown as Request;

      const mockResponse = {
        statusCode: 201,
        get: jest.fn().mockReturnValue(undefined),
      } as unknown as Response;

      const mockContext = {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      } as ExecutionContext;

      const mockCallHandler = {
        handle: () => of('created'),
      } as CallHandler;

      const logSpy = jest.spyOn(interceptor['logger'], 'log');

      const result = interceptor.intercept(mockContext, mockCallHandler);

      await result.toPromise();

      expect(logSpy).toHaveBeenCalledWith('POST /api/upload - 192.168.1.1 -  - START');
      expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/POST \/api\/upload - 201 - 0b - \d+ms - 192.168.1.1/));
    });

    it('should not intercept non-HTTP contexts', () => {
      const mockContext = {
        getType: () => 'ws',
      } as ExecutionContext;

      const mockObservable = of('websocket result');
      const mockCallHandler = {
        handle: () => mockObservable,
      } as CallHandler;

      const logSpy = jest.spyOn(interceptor['logger'], 'log');

      const result = interceptor.intercept(mockContext, mockCallHandler);

      expect(result).toBe(mockObservable);
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should log start but not completion when the handler throws an error', async () => {
      const mockRequest = {
        ip: '127.0.0.1',
        method: 'GET',
        url: '/error',
        get: jest.fn().mockReturnValue('TestAgent'),
      } as unknown as Request;

      const mockResponse = {
        statusCode: 500,
        get: jest.fn().mockReturnValue('0'),
      } as unknown as Response;

      const mockContext = {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      } as ExecutionContext;

      const mockCallHandler = {
        handle: () => throwError(() => new Error('Test error')),
      } as CallHandler;

      const logSpy = jest.spyOn(interceptor['logger'], 'log');

      const result = interceptor.intercept(mockContext, mockCallHandler);

      try {
        await result.toPromise();
      } catch {
        // Expected to throw
      }

      expect(logSpy).toHaveBeenCalledWith('GET /error - 127.0.0.1 - TestAgent - START');
      expect(logSpy).toHaveBeenCalledTimes(1);
    });
  });
});
