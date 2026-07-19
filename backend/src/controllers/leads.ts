import { Response } from 'express';
import { PrismaClient, LeadStatus, LeadPriority, ActivityType } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { broadcastToOrganisation } from '../websocket';

const prisma = new PrismaClient();

export async function getLeads(req: AuthenticatedRequest, res: Response) {
  try {
    const leads = await prisma.lead.findMany({
      where: {
        organisationId: req.user!.organisationId
      },
      include: {
        company: true,
        contact: true,
        activities: {
          orderBy: { createdAt: 'desc' }
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
  const { title, status, priority, value, companyId, contactId } = req.body;

  try {
    const lead = await prisma.lead.create({
      data: {
        title,
        status: status as LeadStatus || LeadStatus.NEW,
        priority: priority as LeadPriority || LeadPriority.MEDIUM,
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

    // Create system log activity
    await prisma.activity.create({
      data: {
        type: ActivityType.NOTE,
        content: `Lead created: "${title}"`,
        userId: req.user!.id,
        leadId: lead.id,
        organisationId: req.user!.organisationId
      }
    });

    return res.status(201).json(lead);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function updateLead(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { title, status, priority, value, companyId, contactId } = req.body;

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

    // Log status transitions or edits
    let logMsg = `Lead updated.`;
    if (existing.status !== status && status) {
      logMsg = `Status changed from ${existing.status} to ${status}`;
    }

    await prisma.activity.create({
      data: {
        type: ActivityType.NOTE,
        content: logMsg,
        userId: req.user!.id,
        leadId: updated.id,
        organisationId: req.user!.organisationId
      }
    });

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

    return res.status(201).json(activity);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}
