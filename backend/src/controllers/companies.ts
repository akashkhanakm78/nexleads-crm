import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export async function getCompanies(req: AuthenticatedRequest, res: Response) {
  try {
    const companies = await prisma.company.findMany({
      where: {
        organisationId: req.user!.organisationId
      },
      include: {
        contacts: true,
        leads: true
      },
      orderBy: { name: 'asc' }
    });
    return res.json(companies);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function createCompany(req: AuthenticatedRequest, res: Response) {
  const { name, domain, industry, employeeCount } = req.body;

  try {
    const company = await prisma.company.create({
      data: {
        name,
        domain,
        industry,
        employeeCount: employeeCount ? parseInt(employeeCount) : null,
        organisationId: req.user!.organisationId
      }
    });
    return res.status(201).json(company);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function updateCompany(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { name, domain, industry, employeeCount } = req.body;

  try {
    const existing = await prisma.company.findFirst({
      where: {
        id,
        organisationId: req.user!.organisationId
      }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const company = await prisma.company.update({
      where: { id },
      data: {
        name,
        domain,
        industry,
        employeeCount: employeeCount ? parseInt(employeeCount) : null
      }
    });
    return res.json(company);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function deleteCompany(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;

  try {
    const existing = await prisma.company.findFirst({
      where: {
        id,
        organisationId: req.user!.organisationId
      }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Company not found' });
    }

    await prisma.company.delete({
      where: { id }
    });
    return res.json({ message: 'Company deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}
