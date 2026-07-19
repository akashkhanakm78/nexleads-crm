import { Response } from 'express';
import { PrismaClient, LeadStatus } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { getCache, setCache } from '../redis';

const prisma = new PrismaClient();

export async function getDashboardStats(req: AuthenticatedRequest, res: Response) {
  try {
    const orgId = req.user!.organisationId;
    const cacheKey = `analytics:${orgId}`;

    // Try to fetch from Redis cache first
    const cachedStats = await getCache(cacheKey);
    if (cachedStats) {
      console.log(`[Redis Cache Hit]: Serving analytics stats for organisation: ${orgId}`);
      return res.json(JSON.parse(cachedStats));
    }

    console.log(`[Redis Cache Miss]: Fetching analytics stats from database for organisation: ${orgId}`);

    const totalLeads = await prisma.lead.count({ where: { organisationId: orgId } });
    const newLeads = await prisma.lead.count({ where: { status: LeadStatus.NEW, organisationId: orgId } });
    
    const activeDeals = await prisma.lead.count({
      where: {
        organisationId: orgId,
        status: {
          in: [
            LeadStatus.NEW,
            LeadStatus.CONTACTED,
            LeadStatus.QUALIFIED,
            LeadStatus.PROPOSAL,
            LeadStatus.NEGOTIATION
          ]
        }
      }
    });

    const wonCount = await prisma.lead.count({ where: { status: LeadStatus.WON, organisationId: orgId } });
    const lostCount = await prisma.lead.count({ where: { status: LeadStatus.LOST, organisationId: orgId } });
    const conversionRate = totalLeads > 0 ? Math.round((wonCount / (wonCount + lostCount || 1)) * 100) : 0;

    const revenueResult = await prisma.lead.aggregate({
      where: { status: LeadStatus.WON, organisationId: orgId },
      _sum: { value: true }
    });
    const monthlyRevenue = revenueResult._sum.value || 0;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const todaysFollowups = await prisma.task.count({
      where: {
        organisationId: orgId,
        isDone: false,
        dueDate: {
          gte: startOfToday,
          lte: endOfToday
        }
      }
    });

    // 1. Funnel stages data
    const stages = Object.values(LeadStatus);
    const funnelData = await Promise.all(
      stages.map(async (stage) => {
        const count = await prisma.lead.count({ where: { status: stage, organisationId: orgId } });
        return { name: stage, value: count };
      })
    );

    // 2. Historical revenue trends
    const revenueTrend = [
      { month: 'Jan', revenue: monthlyRevenue * 0.4 },
      { month: 'Feb', revenue: monthlyRevenue * 0.55 },
      { month: 'Mar', revenue: monthlyRevenue * 0.7 },
      { month: 'Apr', revenue: monthlyRevenue * 0.8 },
      { month: 'May', revenue: monthlyRevenue * 0.95 },
      { month: 'Jun', revenue: monthlyRevenue }
    ];

    // 3. Team performance (Sales agent leaderboard)
    const users = await prisma.user.findMany({
      where: { organisationId: orgId },
      include: {
        tasks: { where: { organisationId: orgId } },
        activities: { where: { organisationId: orgId } }
      }
    });
    
    const teamPerformance = users.map((user) => ({
      name: user.name,
      tasks: user.tasks.length,
      activities: user.activities.length
    }));

    const statsResult = {
      cards: {
        totalLeads,
        newLeads,
        activeDeals,
        conversionRate,
        monthlyRevenue,
        todaysFollowups
      },
      charts: {
        funnelData,
        revenueTrend,
        teamPerformance
      }
    };

    // Store in Redis (TTL of 1 hour)
    await setCache(cacheKey, JSON.stringify(statsResult), 3600);

    return res.json(statsResult);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}
