import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer disk storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

export const upload = multer({ storage });

export async function getDocuments(req: AuthenticatedRequest, res: Response) {
  const { leadId } = req.query;

  try {
    const documents = await prisma.document.findMany({
      where: {
        userId: req.user!.id,
        organisationId: req.user!.organisationId,
        ...(leadId ? { leadId: String(leadId) } : {})
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(documents);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function uploadDocument(req: AuthenticatedRequest, res: Response) {
  const { leadId } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    // Generate a relative URL/path for the file download endpoint
    const fileUrl = `/api/documents/download/${file.filename}`;

    const doc = await prisma.document.create({
      data: {
        fileName: file.originalname,
        fileUrl,
        fileSize: file.size,
        userId: req.user!.id,
        leadId: leadId || null,
        organisationId: req.user!.organisationId
      }
    });

    // Auto-create Activity Timeline log if linked to a lead
    if (leadId) {
      await prisma.activity.create({
        data: {
          type: 'NOTE',
          content: `Uploaded attachment: "${file.originalname}"`,
          userId: req.user!.id,
          leadId,
          organisationId: req.user!.organisationId
        }
      });
    }

    return res.status(201).json(doc);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function downloadFile(req: AuthenticatedRequest, res: Response) {
  const { filename } = req.params;
  const filePath = path.join(UPLOADS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  return res.download(filePath);
}
