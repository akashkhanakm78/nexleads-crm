/**
 * Activity Log Consumer
 * ─────────────────────
 * Listens on the `activity_logs` queue and writes activity records to the DB
 * asynchronously, decoupling the HTTP response from the DB write.
 *
 * Message routing:
 *   lead.*     → activity.leadId = payload.leadId
 *   meeting.*  → activity.leadId = payload.leadId (meetings are linked to leads)
 *   task.*     → activity.leadId = payload.leadId
 *   contact.*  → no leadId (org-level activity)
 */

import { PrismaClient, ActivityType } from '@prisma/client';
import { ConsumeMessage } from 'amqplib';
import { consume, QUEUES, ROUTING_KEYS } from '../rabbitmq';
import { broadcastToOrganisation } from '../websocket';

const prisma = new PrismaClient();

// ── Message payload types ────────────────────────────────────────────────────
export interface ActivityEvent {
  routingKey: string;
  /** The text stored in activity.content */
  content: string;
  userId:   string;
  orgId:    string;
  leadId?:  string;
  /** Optional explicit activity type; defaults to NOTE */
  activityType?: ActivityType;
}

// ── Routing key → human-readable fallback content ────────────────────────────
function defaultContent(routingKey: string): string {
  const map: Record<string, string> = {
    [ROUTING_KEYS.LEAD_CREATED]:    'Lead created',
    [ROUTING_KEYS.LEAD_UPDATED]:    'Lead updated',
    [ROUTING_KEYS.LEAD_DELETED]:    'Lead deleted',
    [ROUTING_KEYS.LEAD_ACTIVITY]:   'Activity logged',
    [ROUTING_KEYS.MEETING_CREATED]: 'Meeting scheduled',
    [ROUTING_KEYS.MEETING_DELETED]: 'Meeting removed',
    [ROUTING_KEYS.TASK_CREATED]:    'Task created',
    [ROUTING_KEYS.TASK_UPDATED]:    'Task updated',
    [ROUTING_KEYS.CONTACT_UPDATED]: 'Contact updated',
  };
  return map[routingKey] ?? 'Activity recorded';
}

// ── Handler ───────────────────────────────────────────────────────────────────
async function handleActivityEvent(
  payload: ActivityEvent,
  msg: ConsumeMessage
): Promise<void> {
  const content = payload.content || defaultContent(payload.routingKey);

  // Skip if the routing key is lead.deleted – the lead (and FK) no longer
  // exists, so there is nothing to link to.
  if (payload.routingKey === ROUTING_KEYS.LEAD_DELETED) {
    return;
  }

  await prisma.activity.create({
    data: {
      type:           payload.activityType ?? ActivityType.NOTE,
      content,
      userId:         payload.userId,
      leadId:         payload.leadId ?? null,
      organisationId: payload.orgId,
    },
  });

  // Broadcast a UI refresh so open clients pick up the new timeline entry
  broadcastToOrganisation(payload.orgId, { type: 'LEADS_UPDATE' });
}

// ── Start consumer ────────────────────────────────────────────────────────────
export async function startActivityConsumer(): Promise<void> {
  await consume<ActivityEvent>(QUEUES.ACTIVITY_LOG, handleActivityEvent);
  console.log('[Consumer] Activity log consumer started');
}
