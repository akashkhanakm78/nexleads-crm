import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';

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

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}
