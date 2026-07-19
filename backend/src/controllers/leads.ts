import { Response } from 'express';
import { PrismaClient, LeadStatus, LeadPriority, ActivityType } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { broadcastToOrganisation } from '../websocket';
import { clearCache } from '../redis';
import { publish, ROUTING_KEYS } from '../rabbitmq';
import type { ActivityEvent } from '../consumers/activityConsumer';

const prisma = new PrismaClient();

export async function getLeads(req: AuthenticatedRequest, res: Response) {
  try {
    const {
      search,
      status,
      contactStatus,
      priority,
      minVal,
      maxVal,
      startDate,
      endDate
    } = req.query as Record<string, string>;

    const where: any = {
      organisationId: req.user!.organisationId
    };

    // Server-side search: title, company name, contact email, contact phone, or activity content
    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search } },
        { company: { name: { contains: search } } },
        { contact: { email: { contains: search } } },
        { contact: { phone: { contains: search } } },
        { activities: { some: { content: { contains: search } } } }
      ];
    }

    // Status (lead stage) filter
    if (status && status !== 'ALL') {
      where.status = status as LeadStatus;
    }

    // Contact status filter
    if (contactStatus && contactStatus !== 'ALL') {
      where.contactStatus = contactStatus;
    }

    // Priority filter
    if (priority && priority !== 'ALL') {
      where.priority = priority as LeadPriority;
    }

    // Value range filters
    if (minVal) {
      where.value = { ...where.value, gte: parseFloat(minVal) };
    }
    if (maxVal) {
      where.value = { ...where.value, lte: parseFloat(maxVal) };
    }

    // Date range filters
    if (startDate) {
      where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt = { ...where.createdAt, lte: end };
    }

    const leads = await prisma.lead.findMany({
      where,
      include: {
        company: true,
        contact: true,
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 1, // only fetch the latest activity for the "last log" column
          include: { user: { select: { name: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(leads);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function createLead(req: AuthenticatedRequest, res: Response) {
  const { title, status, priority, contactStatus, value, companyId, contactId } = req.body;

  try {
    const lead = await prisma.lead.create({
      data: {
        title,
        status: status as LeadStatus || LeadStatus.NEW,
        priority: priority as LeadPriority || LeadPriority.MEDIUM,
        contactStatus: contactStatus || null,
        value: value ? parseFloat(value) : null,
        companyId,
        contactId,
        organisationId: req.user!.organisationId
      },
      include: {
        company: true,
        contact: true
      }
    });

    broadcastToOrganisation(req.user!.organisationId, { type: 'LEADS_UPDATE' });

    // Async activity log – does NOT block the HTTP response
    publish<ActivityEvent>(ROUTING_KEYS.LEAD_CREATED, {
      routingKey: ROUTING_KEYS.LEAD_CREATED,
      content: `Lead created: "${title}"`,
      userId: req.user!.id,
      orgId:  req.user!.organisationId,
      leadId: lead.id,
    });

    await clearCache(`analytics:${req.user!.organisationId}`);

    return res.status(201).json(lead);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function updateLead(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { title, status, priority, contactStatus, value, companyId, contactId } = req.body;

  try {
    const existing = await prisma.lead.findFirst({ 
      where: { 
        id,
        organisationId: req.user!.organisationId
      } 
    });
    if (!existing) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        title,
        status: status as LeadStatus,
        priority: priority as LeadPriority,
        contactStatus: contactStatus !== undefined ? (contactStatus || null) : existing.contactStatus,
        value: value ? parseFloat(value) : null,
        companyId,
        contactId
      },
      include: {
        company: true,
        contact: true
      }
    });

    broadcastToOrganisation(req.user!.organisationId, { type: 'LEADS_UPDATE' });

    // Log status transitions or edits – async via RabbitMQ
    const changes: string[] = [];
    if (existing.status !== status && status) {
      changes.push(`Stage changed: ${existing.status} → ${status}`);
    }
    if (existing.contactStatus !== contactStatus && contactStatus !== undefined) {
      changes.push(`Contact status changed: ${existing.contactStatus || 'None'} → ${contactStatus || 'None'}`);
    }
    const logMsg = changes.length > 0 ? changes.join('. ') : 'Lead updated.';

    publish<ActivityEvent>(ROUTING_KEYS.LEAD_UPDATED, {
      routingKey: ROUTING_KEYS.LEAD_UPDATED,
      content:  logMsg,
      userId:   req.user!.id,
      orgId:    req.user!.organisationId,
      leadId:   updated.id,
    });

    await clearCache(`analytics:${req.user!.organisationId}`);

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function deleteLead(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;

  try {
    const existing = await prisma.lead.findFirst({
      where: {
        id,
        organisationId: req.user!.organisationId
      }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Delete linked activities, tasks, meetings, documents first
    await prisma.activity.deleteMany({ where: { leadId: id, organisationId: req.user!.organisationId } });
    await prisma.task.deleteMany({ where: { leadId: id, organisationId: req.user!.organisationId } });
    await prisma.meeting.deleteMany({ where: { leadId: id, organisationId: req.user!.organisationId } });
    await prisma.document.deleteMany({ where: { leadId: id, organisationId: req.user!.organisationId } });

    await prisma.lead.delete({ where: { id } });

    broadcastToOrganisation(req.user!.organisationId, { type: 'LEADS_UPDATE' });

    await clearCache(`analytics:${req.user!.organisationId}`);

    return res.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function getLeadActivities(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;

  try {
    const activities = await prisma.activity.findMany({
      where: { 
        leadId: id,
        organisationId: req.user!.organisationId
      },
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(activities);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function createLeadActivity(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { type, content } = req.body;

  try {
    const activity = await prisma.activity.create({
      data: {
        type: type as ActivityType,
        content,
        userId: req.user!.id,
        leadId: id,
        organisationId: req.user!.organisationId
      },
      include: { user: true }
    });

    broadcastToOrganisation(req.user!.organisationId, { type: 'LEADS_UPDATE' });

    await clearCache(`analytics:${req.user!.organisationId}`);

    return res.status(201).json(activity);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}
