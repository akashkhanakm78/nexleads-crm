import { PrismaClient, Role, LeadStatus, LeadPriority, ActivityType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding B2B Market Tracker database...');

  // Clean existing data
  await prisma.activity.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.meeting.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.contact.deleteMany({});
  await prisma.company.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.organisation.deleteMany({});

  const defaultHashedPassword = await bcrypt.hash('password', 10);

  // Create default organization
  const org = await prisma.organisation.create({
    data: {
      name: 'Pied Piper',
    },
  });

  // 1. Create Users
  const admin = await prisma.user.create({
    data: {
      email: 'admin@nexleads.com',
      name: 'Sarah Connor',
      password: defaultHashedPassword,
      role: Role.ADMIN,
      organisationId: org.id,
    },
  });

  const exec = await prisma.user.create({
    data: {
      email: 'executive@nexleads.com',
      name: 'John Doe',
      password: defaultHashedPassword,
      role: Role.SALES_EXECUTIVE,
      organisationId: org.id,
    },
  });

  const viewer = await prisma.user.create({
    data: {
      email: 'viewer@nexleads.com',
      name: 'Jane Smith',
      password: defaultHashedPassword,
      role: Role.VIEWER,
      organisationId: org.id,
    },
  });

  console.log('Seeded Users');

  // 2. Create Companies
  const google = await prisma.company.create({
    data: {
      name: 'Google LLC',
      domain: 'google.com',
      industry: 'Technology',
      employeeCount: 150000,
      organisationId: org.id,
    },
  });

  const microsoft = await prisma.company.create({
    data: {
      name: 'Microsoft Corp',
      domain: 'microsoft.com',
      industry: 'Technology',
      employeeCount: 220000,
      organisationId: org.id,
    },
  });

  const stripe = await prisma.company.create({
    data: {
      name: 'Stripe Inc',
      domain: 'stripe.com',
      industry: 'Fintech',
      employeeCount: 8000,
      organisationId: org.id,
    },
  });

  console.log('Seeded Companies');

  // 3. Create Contacts
  const contactGoogle = await prisma.contact.create({
    data: {
      firstName: 'Sundar',
      lastName: 'Pichai',
      email: 'sundar@google.com',
      phone: '+1 650-253-0000',
      companyId: google.id,
      organisationId: org.id,
    },
  });

  const contactMicrosoft = await prisma.contact.create({
    data: {
      firstName: 'Satya',
      lastName: 'Nadella',
      email: 'satya@microsoft.com',
      phone: '+1 425-882-8080',
      companyId: microsoft.id,
      organisationId: org.id,
    },
  });

  const contactStripe = await prisma.contact.create({
    data: {
      firstName: 'John',
      lastName: 'Collison',
      email: 'john@stripe.com',
      phone: '+1 415-384-0000',
      companyId: stripe.id,
      organisationId: org.id,
    },
  });

  console.log('Seeded Contacts');

  // 4. Create Leads
  const leadGoogle = await prisma.lead.create({
    data: {
      title: 'Google Workspace Enterprise',
      status: LeadStatus.QUALIFIED,
      priority: LeadPriority.HIGH,
      value: 75000,
      companyId: google.id,
      contactId: contactGoogle.id,
      organisationId: org.id,
    },
  });

  const leadMicrosoft = await prisma.lead.create({
    data: {
      title: 'Office 365 Migration Deal',
      status: LeadStatus.PROPOSAL,
      priority: LeadPriority.HIGH,
      value: 120000,
      companyId: microsoft.id,
      contactId: contactMicrosoft.id,
      organisationId: org.id,
    },
  });

  const leadStripe = await prisma.lead.create({
    data: {
      title: 'Payment Gateway Integration',
      status: LeadStatus.NEGOTIATION,
      priority: LeadPriority.MEDIUM,
      value: 45000,
      companyId: stripe.id,
      contactId: contactStripe.id,
      organisationId: org.id,
    },
  });

  console.log('Seeded Leads');

  // 5. Create Activities
  await prisma.activity.createMany({
    data: [
      {
        type: ActivityType.CALL,
        content: 'Initial discovery call with Sundar. He showed high interest in the enterprise bundle.',
        userId: exec.id,
        leadId: leadGoogle.id,
        organisationId: org.id,
      },
      {
        type: ActivityType.EMAIL,
        content: 'Sent technical proposal deck and migration timeline document.',
        userId: exec.id,
        leadId: leadMicrosoft.id,
        organisationId: org.id,
      },
      {
        type: ActivityType.WHATSAPP,
        content: 'Quick chat with John regarding pricing adjustments. Agreed to schedule negotiation session.',
        userId: exec.id,
        leadId: leadStripe.id,
        organisationId: org.id,
      },
    ],
  });

  console.log('Seeded Activities');

  // 6. Create Tasks
  await prisma.task.createMany({
    data: [
      {
        title: 'Review proposal feedback with Sarah',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
        isDone: false,
        userId: exec.id,
        leadId: leadMicrosoft.id,
        organisationId: org.id,
      },
      {
        title: 'Draft contract SLA document',
        dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000), // day after
        isDone: false,
        userId: exec.id,
        leadId: leadStripe.id,
        organisationId: org.id,
      },
      {
        title: 'Call Sundar to schedule demo',
        dueDate: new Date(), // today
        isDone: true,
        userId: exec.id,
        leadId: leadGoogle.id,
        organisationId: org.id,
      },
    ],
  });

  console.log('Seeded Tasks');

  // 7. Create Meetings
  await prisma.meeting.create({
    data: {
      title: 'Stripe Pricing Alignment',
      description: 'Discuss potential merchant rates and regional volume commitments.',
      startTime: new Date(Date.now() + 3 * 60 * 60 * 1000), // in 3 hours
      endTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
      userId: exec.id,
      leadId: leadStripe.id,
      organisationId: org.id,
    },
  });

  await prisma.meeting.create({
    data: {
      title: 'Google Integration Technical Sync',
      description: 'Review API architectures and SSO access guidelines.',
      startTime: new Date(Date.now() + 26 * 60 * 60 * 1000), // tomorrow
      endTime: new Date(Date.now() + 27 * 60 * 60 * 1000),
      userId: viewer.id,
      leadId: leadGoogle.id,
      organisationId: org.id,
    },
  });

  console.log('Seeded Meetings');

  // 8. Create Documents
  await prisma.document.create({
    data: {
      fileName: 'Stripe_Integration_Proposal.pdf',
      fileUrl: '/api/documents/download/stripe_proposal.pdf',
      fileSize: 1024 * 342, // 342 KB
      userId: exec.id,
      leadId: leadStripe.id,
      organisationId: org.id,
    },
  });

  await prisma.document.create({
    data: {
      fileName: 'Google_Workspace_Agreement.docx',
      fileUrl: '/api/documents/download/google_agreement.docx',
      fileSize: 1024 * 148, // 148 KB
      userId: exec.id,
      leadId: leadGoogle.id,
      organisationId: org.id,
    },
  });

  console.log('Seeded Documents');

  // 9. Create Notifications
  await prisma.notification.create({
    data: {
      title: 'Deal Value Warning',
      message: 'Office 365 Migration Deal value exceeds normal manager limits ($120k).',
      userId: admin.id,
      organisationId: org.id,
    },
  });

  await prisma.notification.create({
    data: {
      title: 'Meeting Scheduled Today',
      message: 'You have a scheduled sync for Stripe Pricing Alignment in 3 hours.',
      userId: exec.id,
      organisationId: org.id,
    },
  });

  await prisma.notification.create({
    data: {
      title: 'Action Item Due',
      message: 'Task: Review proposal feedback with Sarah is due tomorrow.',
      userId: exec.id,
      organisationId: org.id,
    },
  });

  await prisma.notification.create({
    data: {
      title: 'SSO Sync Needed',
      message: 'Google Integration Technical Sync is scheduled for tomorrow.',
      userId: viewer.id,
      organisationId: org.id,
    },
  });

  console.log('Seeded Notifications');
  console.log('Database seeding successfully finished!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
