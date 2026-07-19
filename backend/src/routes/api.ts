import { Router } from 'express';
import { login, me, getUsers, createUser, updateUserRole, register } from '../controllers/auth';
import { getLeads, createLead, updateLead, deleteLead, getLeadActivities, createLeadActivity } from '../controllers/leads';
import { getCompanies, createCompany, updateCompany, deleteCompany } from '../controllers/companies';
import { getContacts, createContact, updateContact, deleteContact, bulkCreateContacts } from '../controllers/contacts';
import { getTasks, createTask, toggleTask } from '../controllers/tasks';
import { getMeetings, createMeeting, deleteMeeting } from '../controllers/meetings';
import { getDocuments, uploadDocument, downloadFile, upload } from '../controllers/documents';
import { getNotifications, markRead } from '../controllers/notifications';
import { getDashboardStats } from '../controllers/analytics';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/auth/login', login);
router.post('/auth/register', register);

// Protected routes (require valid JWT session)
router.use(authenticateJWT as any);

router.get('/auth/me', me);

// Users / Roles management
router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:id/role', updateUserRole);

// Leads
router.get('/leads', getLeads);
router.post('/leads', createLead);
router.put('/leads/:id', updateLead);
router.delete('/leads/:id', deleteLead);
router.get('/leads/:id/activities', getLeadActivities);
router.post('/leads/:id/activities', createLeadActivity);

// Companies
router.get('/companies', getCompanies);
router.post('/companies', createCompany);
router.put('/companies/:id', updateCompany);
router.delete('/companies/:id', deleteCompany);

// Contacts
router.get('/contacts', getContacts);
router.post('/contacts', createContact);
router.post('/contacts/bulk', bulkCreateContacts);
router.put('/contacts/:id', updateContact);
router.delete('/contacts/:id', deleteContact);

// Tasks
router.get('/tasks', getTasks);
router.post('/tasks', createTask);
router.put('/tasks/:id/toggle', toggleTask);

// Meetings
router.get('/meetings', getMeetings);
router.post('/meetings', createMeeting);
router.delete('/meetings/:id', deleteMeeting);

// Documents
router.get('/documents', getDocuments);
router.post('/documents/upload', upload.single('file'), uploadDocument);
router.get('/documents/download/:filename', downloadFile);

// Notifications
router.get('/notifications', getNotifications);
router.put('/notifications/:id/read', markRead);

router.get('/analytics', getDashboardStats);

export default router;
