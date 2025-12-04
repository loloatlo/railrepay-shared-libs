/**
 * Kafka Client Types
 *
 * Type definitions for Kafka consumer configuration and message handling
 */

import { EachMessagePayload } from 'kafkajs';

/**
 * Logger interface for optional dependency injection
 */
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Kafka consumer configuration
 */
export interface KafkaConfig {
  /** REQUIRED - Service name for logging/metrics */
  serviceName: string;
  /** REQUIRED - Kafka broker URLs */
  brokers: string[];
  /** REQUIRED - SASL username */
  username: string;
  /** REQUIRED - SASL password */
  password: string;
  /** REQUIRED - Consumer group ID */
  groupId: string;
  /** Enable SSL (default: true) */
  ssl?: boolean;
  /** SASL mechanism (default: 'plain') */
  saslMechanism?: 'plain' | 'scram-sha-256' | 'scram-sha-512';
  /** Client ID (default: serviceName) */
  clientId?: string;
  /** Session timeout in ms (default: 30000) */
  sessionTimeout?: number;
  /** Heartbeat interval in ms (default: 3000) */
  heartbeatInterval?: number;
  /** Optional logger instance */
  logger?: Logger;
}

/**
 * Kafka message payload (re-export from kafkajs)
 */
export type KafkaMessage = EachMessagePayload;

/**
 * Message handler function type
 */
export type MessageHandler = (message: KafkaMessage) => Promise<void>;

/**
 * Consumer statistics
 */
export interface ConsumerStats {
  processedCount: number;
  errorCount: number;
  lastProcessedAt: Date | null;
  isRunning: boolean;
}
