# @railrepay/kafka-client

Reusable Kafka consumer for RailRepay microservices with SASL/SSL authentication.

## Features

- SASL/SSL authentication support
- Configurable consumer groups
- Message handler callback pattern
- Graceful shutdown support
- Statistics tracking
- Optional logger injection

## Installation

```bash
npm install @railrepay/kafka-client
```

## Usage

### Basic Usage

```typescript
import { KafkaConsumer } from '@railrepay/kafka-client';

const consumer = new KafkaConsumer({
  serviceName: 'my-service',           // REQUIRED
  brokers: ['kafka:9092'],             // REQUIRED
  username: 'user',                    // REQUIRED
  password: 'pass',                    // REQUIRED
  groupId: 'my-consumer-group',        // REQUIRED
});

await consumer.connect();

await consumer.subscribe('my-topic', async (message) => {
  const value = message.message.value?.toString();
  console.log('Received:', value);
  // Process message...
});

// Graceful shutdown
await consumer.disconnect();
```

### With Full Configuration

```typescript
import { KafkaConsumer } from '@railrepay/kafka-client';
import { createLogger } from '@railrepay/winston-logger';

const logger = createLogger({ serviceName: 'darwin-ingestor' });

const consumer = new KafkaConsumer({
  serviceName: 'darwin-ingestor',      // REQUIRED
  brokers: ['kafka.example.com:9092'], // REQUIRED
  username: process.env.KAFKA_USER!,   // REQUIRED
  password: process.env.KAFKA_PASS!,   // REQUIRED
  groupId: 'darwin-consumers',         // REQUIRED
  ssl: true,                           // default: true
  saslMechanism: 'scram-sha-512',      // default: 'plain'
  clientId: 'darwin-ingestor-1',       // default: serviceName
  sessionTimeout: 30000,               // default: 30000ms
  heartbeatInterval: 3000,             // default: 3000ms
  logger: logger,                      // optional
});
```

### Message Handler

```typescript
import { KafkaMessage, MessageHandler } from '@railrepay/kafka-client';

const handler: MessageHandler = async (message: KafkaMessage) => {
  const { topic, partition, message: msg } = message;

  console.log({
    topic,
    partition,
    offset: msg.offset,
    key: msg.key?.toString(),
    value: msg.value?.toString(),
    headers: msg.headers,
  });

  // Your processing logic here
};

await consumer.subscribe('darwin-feed', handler);
```

### Reading from Beginning

```typescript
// Start consuming from the beginning of the topic
await consumer.subscribe('my-topic', handler, true);
```

### Statistics

```typescript
const stats = consumer.getStats();
console.log(stats);
// {
//   processedCount: 1234,
//   errorCount: 5,
//   lastProcessedAt: Date,
//   isRunning: true,
// }

// Check if running
if (consumer.isConsumerRunning()) {
  console.log('Consumer is active');
}
```

## Configuration

### KafkaConfig Interface

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `serviceName` | `string` | Yes | - | Service name for logging |
| `brokers` | `string[]` | Yes | - | Kafka broker URLs |
| `username` | `string` | Yes | - | SASL username |
| `password` | `string` | Yes | - | SASL password |
| `groupId` | `string` | Yes | - | Consumer group ID |
| `ssl` | `boolean` | No | `true` | Enable SSL |
| `saslMechanism` | `string` | No | `'plain'` | SASL mechanism |
| `clientId` | `string` | No | `serviceName` | Kafka client ID |
| `sessionTimeout` | `number` | No | `30000` | Session timeout (ms) |
| `heartbeatInterval` | `number` | No | `3000` | Heartbeat interval (ms) |
| `logger` | `Logger` | No | `console` | Logger instance |

### SASL Mechanisms

Supported mechanisms:
- `plain` (default)
- `scram-sha-256`
- `scram-sha-512`

## Error Handling

The consumer handles errors gracefully:

```typescript
const handler: MessageHandler = async (message) => {
  // If this throws, the error is logged and the consumer continues
  // processing other messages
  throw new Error('Processing failed');
};

// Consumer continues running, error is logged
await consumer.subscribe('my-topic', handler);
```

Check `getStats().errorCount` to monitor error rates.

## Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await consumer.disconnect();
  process.exit(0);
});
```

## License

Private - RailRepay
