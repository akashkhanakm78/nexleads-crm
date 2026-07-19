import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { clearCache } from '../redis';
import { publish, ROUTING_KEYS } from '../rabbitmq';
import type { ActivityEvent } from '../consumers/activityConsumer';
import type { NotificationEvent } from '../consumers/notificationConsumer';

const prisma = new PrismaClient();

export async function getTasks(req: AuthenticatedRequest, res: Response) {
  try {
    const tasks = await prisma.task.findMany({
      where: { 
        userId: req.user!.id,
        organisationId: req.user!.organisationId
      },
      include: {
        lead: {
          include: { company: true }
        }
      },
      orderBy: { dueDate: 'asc' }
    });
    return res.json(tasks);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function createTask(req: AuthenticatedRequest, res: Response) {
  const { title, dueDate, leadId } = req.body;

  try {
    const task = await prisma.task.create({
      data: {
        title,
        dueDate: new Date(dueDate),
        isDone: false,
        userId: req.user!.id,
        leadId,
        organisationId: req.user!.organisationId
      }
    });

    // Async activity log (if linked to a lead)
    if (leadId) {
      publish<ActivityEvent>(ROUTING_KEYS.TASK_CREATED, {
        routingKey: ROUTING_KEYS.TASK_CREATED,
        content: `Task created: "${title}"`,
        userId:  req.user!.id,
        orgId:   req.user!.organisationId,
        leadId,
      });
    }

    // Async notification for upcoming due date
    const formattedDue = new Date(dueDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    publish<NotificationEvent>(ROUTING_KEYS.NOTIFICATION_SEND, {
      title:   'New Task',
      message: `"${title}" is due by ${formattedDue}`,
      userId:  req.user!.id,
      orgId:   req.user!.organisationId,
      leadId,
      dueAt:   new Date(dueDate).toISOString(),
    });

    await clearCache(`analytics:${req.user!.organisationId}`);
    return res.status(201).json(task);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function toggleTask(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;

  try {
    const existing = await prisma.task.findFirst({
      where: { 
        id, 
        userId: req.user!.id,
        organisationId: req.user!.organisationId
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updated = await prisma.task.update({
      where: { id },
      data: { isDone: !existing.isDone }
    });

    // Async activity event for lead timeline
    if (existing.leadId) {
      publish<ActivityEvent>(ROUTING_KEYS.TASK_UPDATED, {
        routingKey: ROUTING_KEYS.TASK_UPDATED,
        content: `Task "${existing.title}" marked ${updated.isDone ? 'done' : 'pending'}`,
        userId:  req.user!.id,
        orgId:   req.user!.organisationId,
        leadId:  existing.leadId,
      });
    }

    await clearCache(`analytics:${req.user!.organisationId}`);

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}
