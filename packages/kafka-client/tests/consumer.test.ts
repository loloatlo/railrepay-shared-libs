import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KafkaConsumer, KafkaConfig } from '../src';

// Mock kafkajs
vi.mock('kafkajs', () => {
  const mockConsumerConnect = vi.fn().mockResolvedValue(undefined);
  const mockConsumerDisconnect = vi.fn().mockResolvedValue(undefined);
  const mockConsumerSubscribe = vi.fn().mockResolvedValue(undefined);
  const mockConsumerRun = vi.fn().mockResolvedValue(undefined);

  const MockConsumer = vi.fn(() => ({
    connect: mockConsumerConnect,
    disconnect: mockConsumerDisconnect,
    subscribe: mockConsumerSubscribe,
    run: mockConsumerRun,
  }));

  const MockKafka = vi.fn(() => ({
    consumer: MockConsumer,
  }));

  return {
    Kafka: MockKafka,
    logLevel: {
      ERROR: 1,
      WARN: 2,
      INFO: 4,
      DEBUG: 5,
    },
    __mockConsumerConnect: mockConsumerConnect,
    __mockConsumerDisconnect: mockConsumerDisconnect,
    __mockConsumerSubscribe: mockConsumerSubscribe,
    __mockConsumerRun: mockConsumerRun,
  };
});

describe('@railrepay/kafka-client', () => {
  const originalEnv = process.env;
  const validConfig: KafkaConfig = {
    serviceName: 'test-service',
    brokers: ['kafka:9092'],
    username: 'test-user',
    password: 'test-pass',
    groupId: 'test-group',
  };

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('KafkaConsumer constructor', () => {
    it('should create consumer with valid config', () => {
      const consumer = new KafkaConsumer(validConfig);
      expect(consumer).toBeDefined();
    });

    it('should throw error when serviceName is not provided', () => {
      expect(() =>
        new KafkaConsumer({
          ...validConfig,
          serviceName: '',
        } as KafkaConfig)
      ).toThrow('KafkaConfig.serviceName is required');
    });

    it('should throw error when brokers is not provided', () => {
      expect(() =>
        new KafkaConsumer({
          ...validConfig,
          brokers: [],
        } as KafkaConfig)
      ).toThrow('KafkaConfig.brokers is required');
    });

    it('should throw error when username is not provided', () => {
      expect(() =>
        new KafkaConsumer({
          ...validConfig,
          username: '',
        } as KafkaConfig)
      ).toThrow('KafkaConfig.username is required');
    });

    it('should throw error when password is not provided', () => {
      expect(() =>
        new KafkaConsumer({
          ...validConfig,
          password: '',
        } as KafkaConfig)
      ).toThrow('KafkaConfig.password is required');
    });

    it('should throw error when groupId is not provided', () => {
      expect(() =>
        new KafkaConsumer({
          ...validConfig,
          groupId: '',
        } as KafkaConfig)
      ).toThrow('KafkaConfig.groupId is required');
    });

    it('should accept custom logger', () => {
      const customLogger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };

      const consumer = new KafkaConsumer({
        ...validConfig,
        logger: customLogger,
      });
      expect(consumer).toBeDefined();
    });

    it('should accept optional configuration', () => {
      const consumer = new KafkaConsumer({
        ...validConfig,
        ssl: false,
        saslMechanism: 'scram-sha-256',
        clientId: 'custom-client',
        sessionTimeout: 60000,
        heartbeatInterval: 5000,
      });
      expect(consumer).toBeDefined();
    });
  });

  describe('KafkaConsumer.connect', () => {
    it('should connect successfully', async () => {
      const consumer = new KafkaConsumer(validConfig);
      await expect(consumer.connect()).resolves.not.toThrow();
    });

    it('should throw on connection failure', async () => {
      const kafkajs = await import('kafkajs');
      const mockConnect = (kafkajs as any).__mockConsumerConnect;
      mockConnect.mockRejectedValueOnce(new Error('Connection failed'));

      const consumer = new KafkaConsumer(validConfig);
      await expect(consumer.connect()).rejects.toThrow('Connection failed');
    });
  });

  describe('KafkaConsumer.disconnect', () => {
    it('should handle disconnect when not running', async () => {
      const consumer = new KafkaConsumer(validConfig);
      await expect(consumer.disconnect()).resolves.not.toThrow();
    });
  });

  describe('KafkaConsumer.subscribe', () => {
    it('should subscribe to topic', async () => {
      const kafkajs = await import('kafkajs');
      const mockSubscribe = (kafkajs as any).__mockConsumerSubscribe;

      const consumer = new KafkaConsumer(validConfig);
      await consumer.connect();

      const handler = vi.fn().mockResolvedValue(undefined);
      await consumer.subscribe('test-topic', handler);

      expect(mockSubscribe).toHaveBeenCalledWith({
        topic: 'test-topic',
        fromBeginning: false,
      });
    });

    it('should subscribe from beginning when specified', async () => {
      const kafkajs = await import('kafkajs');
      const mockSubscribe = (kafkajs as any).__mockConsumerSubscribe;

      const consumer = new KafkaConsumer(validConfig);
      await consumer.connect();

      const handler = vi.fn().mockResolvedValue(undefined);
      await consumer.subscribe('test-topic', handler, true);

      expect(mockSubscribe).toHaveBeenCalledWith({
        topic: 'test-topic',
        fromBeginning: true,
      });
    });

    it('should start running after subscribe', async () => {
      const consumer = new KafkaConsumer(validConfig);
      await consumer.connect();

      const handler = vi.fn().mockResolvedValue(undefined);
      await consumer.subscribe('test-topic', handler);

      expect(consumer.isConsumerRunning()).toBe(true);
    });
  });

  describe('KafkaConsumer.getStats', () => {
    it('should return initial stats', () => {
      const consumer = new KafkaConsumer(validConfig);
      const stats = consumer.getStats();

      expect(stats).toEqual({
        processedCount: 0,
        errorCount: 0,
        lastProcessedAt: null,
        isRunning: false,
      });
    });
  });

  describe('KafkaConsumer.isConsumerRunning', () => {
    it('should return false initially', () => {
      const consumer = new KafkaConsumer(validConfig);
      expect(consumer.isConsumerRunning()).toBe(false);
    });

    it('should return true after subscribe', async () => {
      const consumer = new KafkaConsumer(validConfig);
      await consumer.connect();

      const handler = vi.fn().mockResolvedValue(undefined);
      await consumer.subscribe('test-topic', handler);

      expect(consumer.isConsumerRunning()).toBe(true);
    });
  });
});
