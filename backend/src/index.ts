import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

import apiRouter from './routes/api';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const prisma = new PrismaClient();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(morgan('dev'));

// Mount API routes
app.use('/api', apiRouter);

// Basic health check route
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    // Basic DB check
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'OK',
      database: 'Connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      database: 'Disconnected',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

import { createServer } from 'http';
import { initWebSocketServer } from './websocket';

// Start server
const server = createServer(app);
initWebSocketServer(server);

server.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
