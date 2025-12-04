import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createOpenAPIMiddleware, createOpenAPIErrorHandler, OpenAPIConfig } from '../src';
import { Request, Response, NextFunction } from 'express';

// Mock express-openapi-validator
vi.mock('express-openapi-validator', () => ({
  middleware: vi.fn(() => [
    (_req: Request, _res: Response, next: NextFunction) => next(),
  ]),
}));

describe('@railrepay/openapi-validator', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('createOpenAPIMiddleware', () => {
    it('should create middleware with required config', () => {
      const middleware = createOpenAPIMiddleware({
        schemaPath: './openapi.yaml',
      });
      expect(middleware).toBeDefined();
      expect(Array.isArray(middleware)).toBe(true);
    });

    it('should throw error when schemaPath is not provided', () => {
      expect(() =>
        createOpenAPIMiddleware({} as OpenAPIConfig)
      ).toThrow('OpenAPIConfig.schemaPath is required');
    });

    it('should call express-openapi-validator with correct options', async () => {
      const OpenApiValidator = await import('express-openapi-validator');
      const mockMiddleware = vi.mocked(OpenApiValidator.middleware);

      createOpenAPIMiddleware({
        schemaPath: './openapi.yaml',
        validateRequests: true,
        validateResponses: true,
        ignorePaths: ['/health'],
      });

      // ignorePaths is converted to a RegExp
      expect(mockMiddleware).toHaveBeenCalledWith(
        expect.objectContaining({
          apiSpec: './openapi.yaml',
          validateRequests: true,
          validateResponses: true,
        })
      );

      // Verify ignorePaths is a RegExp
      const callArgs = mockMiddleware.mock.calls[0][0];
      expect(callArgs.ignorePaths).toBeInstanceOf(RegExp);
    });

    it('should default validateRequests to true', async () => {
      const OpenApiValidator = await import('express-openapi-validator');
      const mockMiddleware = vi.mocked(OpenApiValidator.middleware);

      createOpenAPIMiddleware({
        schemaPath: './openapi.yaml',
      });

      expect(mockMiddleware).toHaveBeenCalledWith(
        expect.objectContaining({
          validateRequests: true,
        })
      );
    });

    it('should default validateResponses based on NODE_ENV', async () => {
      const OpenApiValidator = await import('express-openapi-validator');
      const mockMiddleware = vi.mocked(OpenApiValidator.middleware);

      // In test mode (not development)
      process.env.NODE_ENV = 'test';
      createOpenAPIMiddleware({
        schemaPath: './openapi.yaml',
      });

      expect(mockMiddleware).toHaveBeenCalledWith(
        expect.objectContaining({
          validateResponses: false,
        })
      );
    });

    it('should accept custom logger', () => {
      const customLogger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };

      createOpenAPIMiddleware({
        schemaPath: './openapi.yaml',
        logger: customLogger,
      });

      expect(customLogger.info).toHaveBeenCalledWith(
        'Initializing OpenAPI validator',
        expect.any(Object)
      );
    });
  });

  describe('createOpenAPIErrorHandler', () => {
    it('should create error handler middleware', () => {
      const errorHandler = createOpenAPIErrorHandler();
      expect(errorHandler).toBeDefined();
      expect(typeof errorHandler).toBe('function');
    });

    it('should format OpenAPI validation errors', () => {
      const errorHandler = createOpenAPIErrorHandler();

      const mockError = {
        status: 400,
        message: 'Validation failed',
        errors: [
          {
            path: '/body/name',
            message: 'must be string',
            errorCode: 'type.openapi.validation',
          },
        ],
      };

      const mockReq = {} as Request;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const mockNext = vi.fn();

      errorHandler(mockError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 400,
        message: 'Validation failed',
        errors: [
          {
            path: '/body/name',
            message: 'must be string',
            errorCode: 'type.openapi.validation',
          },
        ],
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass non-validation errors to next handler', () => {
      const errorHandler = createOpenAPIErrorHandler();

      const mockError = new Error('Some other error');

      const mockReq = {} as Request;
      const mockRes = {} as Response;
      const mockNext = vi.fn();

      errorHandler(mockError, mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });

    it('should use custom logger for validation errors', () => {
      const customLogger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };

      const errorHandler = createOpenAPIErrorHandler(customLogger);

      const mockError = {
        status: 400,
        message: 'Validation failed',
        errors: [],
      };

      const mockReq = {} as Request;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const mockNext = vi.fn();

      errorHandler(mockError, mockReq, mockRes, mockNext);

      expect(customLogger.warn).toHaveBeenCalledWith(
        'OpenAPI validation error',
        expect.any(Object)
      );
    });
  });
});
