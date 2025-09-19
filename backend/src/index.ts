import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

// import { connectRedis } from './config/redis';
import { prisma } from './config/database';
import { pbxService } from './services/pbx';
import { sipServer } from './services/sipServer';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
// CORS configuration helper
const getCorsOrigins = () => {
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  return corsOrigin.includes(',') ? corsOrigin.split(',').map(origin => origin.trim()) : corsOrigin;
};

const io = new Server(server, {
  cors: {
    origin: getCorsOrigins(),
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: getCorsOrigins(),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Import routes
import authRoutes from './routes/auth';
import tenantRoutes from './routes/tenants';
import userRoutes from './routes/users';
import extensionRoutes from './routes/extensions';
import callRoutes from './routes/calls';
import queueRoutes from './routes/queues';
import pbxRoutes from './routes/pbx';
import subscriptionRoutes from './routes/subscriptionSimple';
import adminRoutes from './routes/admin';
import superadminRoutes from './routes/superadmin';
import docsRoutes from './routes/docs';
import invoiceRoutes from './routes/invoice';
import paymentRoutes from './routes/payment';
// import billingCycleRoutes from './routes/billingCycle';
import paymentReportingRoutes from './routes/paymentReporting';
// import paymentRetryRoutes from './routes/paymentRetry';
// import invoicePDFRoutes from './routes/invoicePDF';

// API routes (RE-ENABLED in controlled manner)
app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/users', userRoutes);
app.use('/api/extensions', extensionRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/queues', queueRoutes);
app.use('/api/pbx', pbxRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/docs', docsRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
// app.use('/api/billing-cycle', billingCycleRoutes);
app.use('/api/reports', paymentReportingRoutes);
// app.use('/api/payment-retry', paymentRetryRoutes);
// app.use('/api/pdf', invoicePDFRoutes);

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_tenant', (tenantId) => {
    socket.join(`tenant_${tenantId}`);
  });

  socket.on('agent_status', (data) => {
    socket.to(`tenant_${data.tenantId}`).emit('agent_status_update', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', error);
  res.status(error.status || 500).json({
    success: false,
    error: error.message || 'Internal server error',
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

const PORT = process.env.PORT || 3002;

async function startServer() {
  try {
    // Connect to Redis (disabled for local development)
    // await connectRedis();

    // Test database connection
    await prisma.$connect();
    console.log('Connected to database');

    // Initialize PBX Service
    try {
      await pbxService.initialize();
      console.log('PBX Service initialized successfully');
    } catch (pbxError) {
      console.warn('PBX Service initialization failed (running in development mode):', pbxError);
    }

    // Start SIP Server
    try {
      sipServer.start();
      console.log('🎙️ SIP Server started successfully on port 5060');
    } catch (sipError) {
      console.error('SIP Server failed to start:', sipError);
    }

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();