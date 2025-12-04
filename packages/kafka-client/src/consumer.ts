/**
 * Kafka Consumer
 *
 * Reusable Kafka consumer for RailRepay microservices
 *
 * Features:
 * - SASL/SSL authentication
 * - Configurable consumer groups
 * - Message handler callback pattern
 * - Graceful shutdown support
 * - Statistics tracking
 *
 * Usage:
 * ```typescript
 * import { KafkaConsumer } from '@railrepay/kafka-client';
 *
 * const consumer = new KafkaConsumer({
 *   serviceName: 'my-service',
 *   brokers: ['kafka:9092'],
 *   username: 'user',
 *   password: 'pass',
 *   groupId: 'my-consumer-group',
 * });
 *
 * await consumer.connect();
 * await consumer.subscribe('my-topic', async (message) => {
 *   console.log('Received:', message.message.value?.toString());
 * });
 * ```
 */

import { Kafka, Consumer, logLevel as KafkaLogLevel } from 'kafkajs';
import { KafkaConfig, MessageHandler, ConsumerStats, Logger } from './types';

/**
 * Console-based fallback logger
 */
const consoleLogger: Logger = {
  info: (msg, meta) => console.log(`[INFO] ${msg}`, meta || ''),
  error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta || ''),
  warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta || ''),
  debug: (msg, meta) => console.debug(`[DEBUG] ${msg}`, meta || ''),
};

/**
 * Kafka Consumer Client
 */
export class KafkaConsumer {
  private kafka: Kafka;
  private consumer: Consumer;
  private config: KafkaConfig;
  private logger: Logger;
  private isRunning: boolean = false;
  private stats: ConsumerStats;

  constructor(config: KafkaConfig) {
    if (!config.serviceName) {
      throw new Error('KafkaConfig.serviceName is required');
    }
    if (!config.brokers || config.brokers.length === 0) {
      throw new Error('KafkaConfig.brokers is required');
    }
    if (!config.username) {
      throw new Error('KafkaConfig.username is required');
    }
    if (!config.password) {
      throw new Error('KafkaConfig.password is required');
    }
    if (!config.groupId) {
      throw new Error('KafkaConfig.groupId is required');
    }

    this.config = config;
    this.logger = config.logger || consoleLogger;

    // Initialize stats
    this.stats = {
      processedCount: 0,
      errorCount: 0,
      lastProcessedAt: null,
      isRunning: false,
    };

    // Create Kafka client with SASL/SSL
    const mechanism = config.saslMechanism || 'plain';
    this.kafka = new Kafka({
      clientId: config.clientId || config.serviceName,
      brokers: config.brokers,
      ssl: config.ssl !== false,
      sasl: {
        mechanism: mechanism as 'plain',
        username: config.username,
        password: config.password,
      },
      logLevel: KafkaLogLevel.ERROR, // Reduce noise in production
      logCreator: this.createLogCreator(),
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    // Create consumer instance
    this.consumer = this.kafka.consumer({
      groupId: config.groupId,
      sessionTimeout: config.sessionTimeout ?? 30000,
      heartbeatInterval: config.heartbeatInterval ?? 3000,
    });
  }

  /**
   * Create Winston-based logger for KafkaJS
   */
  private createLogCreator() {
    const logger = this.logger;
    const serviceName = this.config.serviceName;

    return (_kafkaLogLevel: KafkaLogLevel) => {
      return ({ namespace, level, label, log }: {
        namespace: string;
        level: KafkaLogLevel;
        label: string;
        log: { timestamp: string; message: string; [key: string]: unknown };
      }) => {
        // Map KafkaJS log levels to Winston log levels
        const winstonLevel =
          level === KafkaLogLevel.ERROR
            ? 'error'
            : level === KafkaLogLevel.WARN
              ? 'warn'
              : level === KafkaLogLevel.INFO
                ? 'info'
                : 'debug';

        const { message, timestamp, ...metadata } = log;

        logger[winstonLevel as keyof Logger](message, {
          component: `${serviceName}/KafkaJS`,
          namespace,
          label,
          ...metadata,
        });
      };
    };
  }

  /**
   * Connect to Kafka broker
   */
  async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to Kafka...', {
        component: `${this.config.serviceName}/KafkaConsumer`,
        brokers: this.config.brokers,
      });

      await this.consumer.connect();

      this.logger.info('Connected to Kafka successfully', {
        component: `${this.config.serviceName}/KafkaConsumer`,
      });
    } catch (error) {
      this.logger.error('Failed to connect to Kafka', {
        component: `${this.config.serviceName}/KafkaConsumer`,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect(): Promise<void> {
    if (!this.isRunning) {
      this.logger.info('Consumer not running, nothing to disconnect', {
        component: `${this.config.serviceName}/KafkaConsumer`,
      });
      return;
    }

    try {
      this.logger.info('Disconnecting from Kafka...', {
        component: `${this.config.serviceName}/KafkaConsumer`,
      });

      await this.consumer.disconnect();
      this.isRunning = false;
      this.stats.isRunning = false;

      this.logger.info('Disconnected from Kafka successfully', {
        component: `${this.config.serviceName}/KafkaConsumer`,
      });
    } catch (error) {
      this.logger.error('Error disconnecting from Kafka', {
        component: `${this.config.serviceName}/KafkaConsumer`,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - allow graceful shutdown to complete
    }
  }

  /**
   * Subscribe to a topic and process messages with handler
   *
   * @param topic - Kafka topic to subscribe to
   * @param handler - Message handler function
   * @param fromBeginning - Start from beginning of topic (default: false)
   */
  async subscribe(
    topic: string,
    handler: MessageHandler,
    fromBeginning: boolean = false
  ): Promise<void> {
    try {
      // Subscribe to topic
      await this.consumer.subscribe({
        topic,
        fromBeginning,
      });

      this.logger.info('Subscribed to topic', {
        component: `${this.config.serviceName}/KafkaConsumer`,
        topic,
        fromBeginning,
      });

      // Start consuming messages
      await this.consumer.run({
        eachMessage: async (payload) => {
          try {
            await handler(payload);
            this.stats.processedCount++;
            this.stats.lastProcessedAt = new Date();
          } catch (error) {
            this.stats.errorCount++;
            this.stats.lastProcessedAt = new Date();

            this.logger.error('Error processing message', {
              component: `${this.config.serviceName}/KafkaConsumer`,
              topic: payload.topic,
              partition: payload.partition,
              offset: payload.message.offset,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            // Don't throw - continue processing other messages
          }
        },
      });

      this.isRunning = true;
      this.stats.isRunning = true;

      this.logger.info('Consumer started successfully', {
        component: `${this.config.serviceName}/KafkaConsumer`,
        topic,
      });
    } catch (error) {
      this.logger.error('Failed to subscribe to topic', {
        component: `${this.config.serviceName}/KafkaConsumer`,
        topic,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get consumer statistics
   */
  getStats(): ConsumerStats {
    return { ...this.stats };
  }

  /**
   * Check if consumer is running
   */
  isConsumerRunning(): boolean {
    return this.isRunning;
  }
}
