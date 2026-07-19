/**
 * Notification Consumer
 * ─────────────────────
 * Listens on the `notifications` queue and creates Notification records in
 * the DB, then broadcasts a real-time WebSocket push so the UI badge updates.
 *
 * Message routing: notification.*
 */

import { PrismaClient } from '@prisma/client';
import { consume, QUEUES } from '../rabbitmq';
import { broadcastToOrganisation } from '../websocket';

const prisma = new PrismaClient();

// ── Payload ───────────────────────────────────────────────────────────────────
export interface NotificationEvent {
  title:   string;
  message: string;
  userId:  string;
  orgId:   string;
  leadId?: string;
  /** ISO-8601 string – used when the notification is time-sensitive */
  dueAt?:  string;
}

// ── Handler ───────────────────────────────────────────────────────────────────
async function handleNotificationEvent(payload: NotificationEvent): Promise<void> {
  // Check if the Notification table exists in the schema before writing
  // (gracefully skip if the model was not yet migrated)
  try {
    await (prisma as any).notification.create({
      data: {
        title:          payload.title,
        message:        payload.message,
        userId:         payload.userId,
        organisationId: payload.orgId,
        leadId:         payload.leadId ?? null,
        isRead:         false,
      },
    });

    // Push a badge-refresh signal to all connected clients in the org
    broadcastToOrganisation(payload.orgId, {
      type:    'NOTIFICATION',
      payload: {
        title:   payload.title,
        message: payload.message,
      },
    });
  } catch (err) {
    // If the model doesn't exist yet, log and skip (non-fatal)
    const msg = (err as Error).message;
    if (msg.includes('does not exist') || msg.includes('Unknown argument')) {
      console.warn('[NotificationConsumer] Notification model not found – skipped');
      return;
    }
    throw err;
  }
}

// ── Start consumer ────────────────────────────────────────────────────────────
export async function startNotificationConsumer(): Promise<void> {
  await consume<NotificationEvent>(QUEUES.NOTIFICATION, handleNotificationEvent);
  console.log('[Consumer] Notification consumer started');
}
