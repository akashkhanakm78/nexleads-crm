import { Response } from 'express';
import { PrismaClient, LeadStatus, LeadPriority, ActivityType } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { broadcastToOrganisation } from '../websocket';
import { clearCache } from '../redis';
import { publish, ROUTING_KEYS } from '../rabbitmq';
import type { ActivityEvent } from '../consumers/activityConsumer';

const prisma = new PrismaClient();

// Helper to check if string is a valid UUID
const isUUID = (str: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// Helper to get or create company
const getOrCreateCompany = async (companyInput: string, organisationId: string) => {
  if (isUUID(companyInput)) {
    const existing = await prisma.company.findFirst({ 
      where: { 
        id: companyInput,
        organisationId
      } 
    });
    if (existing) return existing;
  }

  // Treat as name
  const existingByName = await prisma.company.findFirst({ 
    where: { 
      name: companyInput,
      organisationId
    } 
  });
  if (existingByName) return existingByName;

  return await prisma.company.create({
    data: {
      name: companyInput,
      domain: companyInput.toLowerCase().includes('.') ? companyInput : null,
      industry: 'Unknown',
      organisationId
    }
  });
};

// Helper to automatically promote contact to lead
const syncContactToLead = async (contactId: string, status: string, remarks: string | null, organisationId: string, userId: string) => {
  const ignoreStatuses = ['No action', 'Ignore', 'Not Answer'];
  if (ignoreStatuses.includes(status)) {
    return;
  }

  // Find contact with company details
  const contact = await prisma.contact.findFirst({
    where: { 
      id: contactId,
      organisationId
    },
    include: { company: true }
  });
  if (!contact) return;

  const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.company.name;

  // Map contact status to LeadStatus enum
  let leadStatus: LeadStatus = LeadStatus.CONTACTED;
  const upperStatus = status.toUpperCase();
  if (upperStatus === 'NEW') leadStatus = LeadStatus.NEW;
  else if (upperStatus === 'CALLING') leadStatus = LeadStatus.CONTACTED;
  else if (upperStatus === 'QUALIFIED') leadStatus = LeadStatus.QUALIFIED;
  else if (upperStatus === 'PROPOSAL') leadStatus = LeadStatus.PROPOSAL;
  else if (upperStatus === 'NEGOTIATION') leadStatus = LeadStatus.NEGOTIATION;
  else if (upperStatus === 'WON') leadStatus = LeadStatus.WON;
  else if (upperStatus === 'LOST') leadStatus = LeadStatus.LOST;

  // Check if lead already exists
  const existingLead = await prisma.lead.findFirst({
    where: { 
      contactId,
      organisationId
    }
  });

  if (existingLead) {
    // Update existing lead
    const updatedLead = await prisma.lead.update({
      where: { id: existingLead.id },
      data: {
        status: leadStatus,
        title: `${contactName} Lead`
      }
    });

    broadcastToOrganisation(organisationId, { type: 'LEADS_UPDATE' });

    if (remarks) {
      publish<ActivityEvent>(ROUTING_KEYS.CONTACT_UPDATED, {
        routingKey: ROUTING_KEYS.CONTACT_UPDATED,
        content: `Contact status updated to "${status}". Remarks: ${remarks}`,
        userId,
        orgId: organisationId,
        leadId: updatedLead.id,
      });
    }
  } else {
    // Create new lead
    const newLead = await prisma.lead.create({
      data: {
        title: `${contactName} Lead`,
        status: leadStatus,
        priority: LeadPriority.MEDIUM,
        value: 0,
        companyId: contact.companyId,
        contactId: contact.id,
        organisationId
      }
    });

    broadcastToOrganisation(organisationId, { type: 'LEADS_UPDATE' });

    // Create initial activity logs via RabbitMQ
    publish<ActivityEvent>(ROUTING_KEYS.LEAD_CREATED, {
      routingKey: ROUTING_KEYS.LEAD_CREATED,
      content: `Lead automatically promoted from Contact status: "${status}"`,
      userId,
      orgId: organisationId,
      leadId: newLead.id,
    });

    if (remarks) {
      publish<ActivityEvent>(ROUTING_KEYS.CONTACT_UPDATED, {
        routingKey: ROUTING_KEYS.CONTACT_UPDATED,
        content: `Remarks: ${remarks}`,
        userId,
        orgId: organisationId,
        leadId: newLead.id,
      });
    }
  }
};

export async function getContacts(req: AuthenticatedRequest, res: Response) {
  try {
    const contacts = await prisma.contact.findMany({
      where: {
        organisationId: req.user!.organisationId
      },
      include: {
        company: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(contacts);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function createContact(req: AuthenticatedRequest, res: Response) {
  const { firstName, lastName, email, phone, companyId, status, remarks } = req.body;

  if (!phone || !companyId) {
    return res.status(400).json({ error: 'Phone number and Company are required fields' });
  }

  try {
    // Get or Create Company
    const company = await getOrCreateCompany(companyId, req.user!.organisationId);

    // Auto-fill blank names with company name
    let finalFirstName = firstName?.trim() || null;
    let finalLastName = lastName?.trim() || null;

    if (!finalFirstName && !finalLastName) {
      finalFirstName = company.name;
    }

    const contact = await prisma.contact.create({
      data: {
        firstName: finalFirstName,
        lastName: finalLastName,
        email: email || null,
        phone,
        companyId: company.id,
        status: status || 'No action',
        remarks: remarks || null,
        organisationId: req.user!.organisationId
      },
      include: {
        company: true
      }
    });

    broadcastToOrganisation(req.user!.organisationId, { type: 'CONTACTS_UPDATE' });

    // Check promotion criteria immediately
    await syncContactToLead(contact.id, contact.status, contact.remarks, req.user!.organisationId, req.user!.id);

    await clearCache(`analytics:${req.user!.organisationId}`);

    return res.status(201).json(contact);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function updateContact(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { firstName, lastName, email, phone, companyId, status, remarks } = req.body;

  try {
    const existing = await prisma.contact.findFirst({ 
      where: { 
        id,
        organisationId: req.user!.organisationId
      } 
    });
    if (!existing) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    let finalCompanyId = existing.companyId;
    if (companyId) {
      const company = await getOrCreateCompany(companyId, req.user!.organisationId);
      finalCompanyId = company.id;
    }

    const contact = await prisma.contact.update({
      where: { id },
      data: {
        firstName: firstName !== undefined ? firstName : existing.firstName,
        lastName: lastName !== undefined ? lastName : existing.lastName,
        email: email !== undefined ? email : existing.email,
        phone: phone !== undefined ? phone : existing.phone,
        companyId: finalCompanyId,
        status: status !== undefined ? status : existing.status,
        remarks: remarks !== undefined ? remarks : existing.remarks
      },
      include: {
        company: true
      }
    });

    broadcastToOrganisation(req.user!.organisationId, { type: 'CONTACTS_UPDATE' });
    // Also always fire LEADS_UPDATE so lead screens refresh when any contact status changes
    broadcastToOrganisation(req.user!.organisationId, { type: 'LEADS_UPDATE' });

    // Sync to Lead if status/remarks updated
    await syncContactToLead(contact.id, contact.status, contact.remarks, req.user!.organisationId, req.user!.id);

    await clearCache(`analytics:${req.user!.organisationId}`);

    return res.json(contact);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function deleteContact(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;

  try {
    const existing = await prisma.contact.findFirst({
      where: {
        id,
        organisationId: req.user!.organisationId
      }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Delete linked leads (and their sub-relations) to prevent foreign key crashes
    const linkedLeads = await prisma.lead.findMany({ 
      where: { 
        contactId: id,
        organisationId: req.user!.organisationId
      } 
    });
    for (const lead of linkedLeads) {
      await prisma.activity.deleteMany({ where: { leadId: lead.id, organisationId: req.user!.organisationId } });
      await prisma.task.deleteMany({ where: { leadId: lead.id, organisationId: req.user!.organisationId } });
      await prisma.meeting.deleteMany({ where: { leadId: lead.id, organisationId: req.user!.organisationId } });
      await prisma.document.deleteMany({ where: { leadId: lead.id, organisationId: req.user!.organisationId } });
      await prisma.lead.delete({ where: { id: lead.id } });
    }

    await prisma.contact.delete({
      where: { id }
    });

    broadcastToOrganisation(req.user!.organisationId, { type: 'CONTACTS_UPDATE' });

    await clearCache(`analytics:${req.user!.organisationId}`);

    return res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function bulkCreateContacts(req: AuthenticatedRequest, res: Response) {
  const { contacts } = req.body;

  if (!contacts || !Array.isArray(contacts)) {
    return res.status(400).json({ error: 'Contacts array is required' });
  }

  try {
    const created = [];
    for (const item of contacts) {
      const { company_name, phone } = item;
      if (!phone || !company_name) continue;

      // Get or Create Company
      const company = await getOrCreateCompany(String(company_name), req.user!.organisationId);

      // Create contact
      const contact = await prisma.contact.create({
        data: {
          firstName: company.name, // autofill
          phone: String(phone),
          companyId: company.id,
          status: 'No action',
          organisationId: req.user!.organisationId
        }
      });
      created.push(contact);
    }

    broadcastToOrganisation(req.user!.organisationId, { type: 'CONTACTS_UPDATE' });

    await clearCache(`analytics:${req.user!.organisationId}`);

    return res.status(201).json({ message: `Successfully imported ${created.length} contacts.`, count: created.length });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}
