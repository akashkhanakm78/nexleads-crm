import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { broadcastToOrganisation } from '../websocket';
import { clearCache } from '../redis';
import { publish, ROUTING_KEYS } from '../rabbitmq';
import type { ActivityEvent } from '../consumers/activityConsumer';

const prisma = new PrismaClient();

export async function getMeetings(req: AuthenticatedRequest, res: Response) {
  try {
    const meetings = await prisma.meeting.findMany({
      where: { 
        userId: req.user!.id,
        organisationId: req.user!.organisationId
      },
      include: {
        lead: {
          include: { company: true }
        }
      },
      orderBy: { startTime: 'asc' }
    });
    return res.json(meetings);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function createMeeting(req: AuthenticatedRequest, res: Response) {
  const { title, description, startTime, endTime, leadId } = req.body;

  try {
    const meeting = await prisma.meeting.create({
      data: {
        title,
        description,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        userId: req.user!.id,
        leadId,
        organisationId: req.user!.organisationId
      }
    });

    broadcastToOrganisation(req.user!.organisationId, { type: 'MEETINGS_UPDATE' });

    // Async activity log linked to lead (if any)
    if (leadId) {
      const formattedDate = new Date(startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      publish<ActivityEvent>(ROUTING_KEYS.MEETING_CREATED, {
        routingKey: ROUTING_KEYS.MEETING_CREATED,
        content:  `Scheduled meeting: "${title}" for ${formattedDate}`,
        userId:   req.user!.id,
        orgId:    req.user!.organisationId,
        leadId,
        activityType: 'MEETING',
      });
      broadcastToOrganisation(req.user!.organisationId, { type: 'LEADS_UPDATE' });
    }

    await clearCache(`analytics:${req.user!.organisationId}`);

    return res.status(201).json(meeting);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function deleteMeeting(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;

  try {
    const existing = await prisma.meeting.findFirst({
      where: { 
        id, 
        userId: req.user!.id,
        organisationId: req.user!.organisationId
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    await prisma.meeting.delete({
      where: { id }
    });

    broadcastToOrganisation(req.user!.organisationId, { type: 'MEETINGS_UPDATE' });

    if (existing.leadId) {
      broadcastToOrganisation(req.user!.organisationId, { type: 'LEADS_UPDATE' });
    }

    await clearCache(`analytics:${req.user!.organisationId}`);

    return res.json({ message: 'Meeting deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}
