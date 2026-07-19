/**
 * RabbitMQ connection + channel manager.
 *
 * Features
 * ─────────
 * • Lazy singleton – one connection shared across the whole process.
 * • Automatic exponential-backoff reconnect (up to ~30 s gap).
 * • Topic exchange `crm_events` with durable queues.
 * • Type-safe publish / consume helpers.
 * • Graceful shutdown via process hooks.
 */

import amqplib, { Connection, Channel, ConsumeMessage } from 'amqplib';

// ── Constants ────────────────────────────────────────────────────────────────
export const EXCHANGE = 'crm_events';
export const QUEUES = {
  ACTIVITY_LOG:   'activity_logs',
  NOTIFICATION:   'notifications',
} as const;

export type QueueName = typeof QUEUES[keyof typeof QUEUES];

// Routing keys (publishers use these; consumers bind patterns to them)
export const ROUTING_KEYS = {
  LEAD_CREATED:       'lead.created',
  LEAD_UPDATED:       'lead.updated',
  LEAD_DELETED:       'lead.deleted',
  LEAD_ACTIVITY:      'lead.activity',
  MEETING_CREATED:    'meeting.created',
  MEETING_DELETED:    'meeting.deleted',
  TASK_CREATED:       'task.created',
  TASK_UPDATED:       'task.updated',
  CONTACT_UPDATED:    'contact.updated',
  NOTIFICATION_SEND:  'notification.send',
} as const;

export type RoutingKey = typeof ROUTING_KEYS[keyof typeof ROUTING_KEYS];

// ── State ────────────────────────────────────────────────────────────────────
let connection: any = null;
let publishChannel: any = null;
let reconnectAttempt = 0;
let isConnecting = false;

// ── Internal helpers ─────────────────────────────────────────────────────────
async function setupExchangeAndQueues(ch: Channel) {
  // Topic exchange – producers route by key, consumers bind patterns
  await ch.assertExchange(EXCHANGE, 'topic', { durable: true });

  // ── Activity log queue – binds lead.*, meeting.*, task.*, contact.*
  await ch.assertQueue(QUEUES.ACTIVITY_LOG, { durable: true });
  await ch.bindQueue(QUEUES.ACTIVITY_LOG, EXCHANGE, 'lead.*');
  await ch.bindQueue(QUEUES.ACTIVITY_LOG, EXCHANGE, 'meeting.*');
  await ch.bindQueue(QUEUES.ACTIVITY_LOG, EXCHANGE, 'task.*');
  await ch.bindQueue(QUEUES.ACTIVITY_LOG, EXCHANGE, 'contact.*');

  // ── Notification queue – binds notification.*
  await ch.assertQueue(QUEUES.NOTIFICATION, { durable: true });
  await ch.bindQueue(QUEUES.NOTIFICATION, EXCHANGE, 'notification.*');
}

async function createConnection(): Promise<void> {
  if (isConnecting) return;
  isConnecting = true;

  const url = process.env.RABBITMQ_URL || 'amqp://admin:adminpassword@rabbitmq:5672';

  try {
    const conn = await (amqplib as any).connect(url);
    connection = conn;
    reconnectAttempt = 0;
    isConnecting = false;
    console.log('[RabbitMQ] Connected');

    conn.on('error', (err) => {
      console.error('[RabbitMQ] Connection error:', err.message);
    });
    conn.on('close', () => {
      console.warn('[RabbitMQ] Connection closed – will reconnect…');
      connection = null;
      publishChannel = null;
      scheduleReconnect();
    });

    // Create a shared publish channel
    const ch = await conn.createChannel();
    await setupExchangeAndQueues(ch);
    publishChannel = ch;
    console.log('[RabbitMQ] Publish channel ready');
  } catch (err) {
    isConnecting = false;
    console.error('[RabbitMQ] Failed to connect:', (err as Error).message);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  reconnectAttempt += 1;
  // Exponential backoff: 2s, 4s, 8s, …, max 30s
  const delay = Math.min(2 ** reconnectAttempt * 1000, 30_000);
  console.log(`[RabbitMQ] Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempt})…`);
  setTimeout(createConnection, delay);
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Initialise the connection. Call once during app startup. */
export async function initRabbitMQ(): Promise<void> {
  await createConnection();
}

/**
 * Publish a JSON message to the `crm_events` exchange.
 * Fire-and-forget – safe to `void` from controllers.
 */
export function publish<T = unknown>(routingKey: RoutingKey, payload: T): boolean {
  if (!publishChannel) {
    console.warn('[RabbitMQ] publish() called before channel is ready – skipped');
    return false;
  }
  try {
    return publishChannel.publish(
      EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true, contentType: 'application/json' }
    );
  } catch (err) {
    console.error('[RabbitMQ] publish error:', (err as Error).message);
    return false;
  }
}

/**
 * Create a dedicated consumer channel bound to `queue` and call `handler`
 * for every message.  Returns the channel so callers can cancel if needed.
 */
export async function consume<T = unknown>(
  queue: QueueName,
  handler: (payload: T, msg: ConsumeMessage) => Promise<void>
): Promise<any> {
  if (!connection) {
    console.warn('[RabbitMQ] consume() called before connection is ready');
    return null;
  }

  try {
    const ch = await connection.createChannel();
    await setupExchangeAndQueues(ch);

    // Process one message at a time per consumer channel
    ch.prefetch(1);

    await ch.consume(queue, async (msg: ConsumeMessage | null) => {
      if (!msg) return;

      try {
        const payload = JSON.parse(msg.content.toString()) as T;
        await handler(payload, msg);
        ch.ack(msg);
      } catch (err) {
        console.error(`[RabbitMQ] Handler error on queue "${queue}":`, (err as Error).message);
        // Reject + requeue=false to avoid infinite loops; message goes to DLQ if configured
        ch.nack(msg, false, false);
      }
    });

    console.log(`[RabbitMQ] Consumer registered for queue: ${queue}`);
    return ch;
  } catch (err) {
    console.error('[RabbitMQ] consume() setup error:', (err as Error).message);
    return null;
  }
}

// ── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown() {
  console.log('[RabbitMQ] Shutting down…');
  try {
    await publishChannel?.close();
    await connection?.close();
  } catch (_) { /* ignore */ }
}

process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);
