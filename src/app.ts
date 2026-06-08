import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import rateLimit from 'express-rate-limit';
import { verifyDatabaseReady } from './db';
import userRoutes from './routes/users';
import authRoutes from './routes/auth';
import curriculumRoutes from './routes/curriculum';
import uploadRoutes from './routes/upload';
import edgeRoutes from './routes/edges';
import studyRoutes from './routes/study';
import pulseRoutes from './routes/pulse';
import sleepRoutes from './routes/sleep';
import notificationRoutes from './routes/notifications';
import statsRoutes from './routes/stats';
import importRoutes from './routes/import';
import logger from './utils/logger';
import multer from 'multer';

const app = express();

// Configure Express trust proxy for secure client IP detection behind reverse proxies
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

// CORS Configuration (supports hybrid local/prod environments)
const DEFAULT_ALLOWED_ORIGINS = [
  'https://vidyarcflow.vercel.app',
  'https://memorizecom.vercel.app',
];

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or SSE initial request)
      if (!origin) return callback(null, true);
      
      // In development mode, always allow localhost/127.0.0.1 for easy local testing
      const isLocal = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
      
      if (
        isLocal ||
        allowedOrigins.length === 0 ||
        allowedOrigins.includes(origin) ||
        DEFAULT_ALLOWED_ORIGINS.includes(origin)
      ) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Global Request Logger Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      ip: req.ip,
    });
  });
  next();
});

// Global Rate Limiter (applies to all routes not specifically limited)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});
app.use(globalLimiter);

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per windowMs
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: () => process.env.NODE_ENV === 'test', // Skip rate limiting in tests
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 signup attempts per hour per IP
  message: 'Too many accounts created from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test', // Skip rate limiting in tests
});

// Health check endpoints
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/ready', async (_req: Request, res: Response) => {
  try {
    const isReady = await verifyDatabaseReady();
    if (isReady) {
      return res.status(200).json({ ready: true, timestamp: new Date().toISOString() });
    }
    return res.status(503).json({ ready: false, reason: 'db_not_ready' });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return res.status(503).json({ ready: false, error: errorMessage });
  }
});

// Auth routes with rate limiting
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', signupLimiter);
app.use('/api/auth', authRoutes);

// Main Application Routes
app.use('/api/users', userRoutes);
app.use('/api/curriculum', curriculumRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api', edgeRoutes);
app.use('/api', studyRoutes);
app.use('/api', pulseRoutes);
app.use('/api', sleepRoutes);
app.use('/api', notificationRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/import', importRoutes);

// Root welcome (only for GET /)
app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Welcome to the Memorize API', timestamp: new Date().toISOString(), success: true });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    method: req.method,
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    logger.warn('Multer error:', { code: err.code, message: err.message, path: req.path });
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'File size exceeds the limit of 20MB.',
      });
    }
    return res.status(400).json({
      error: 'Upload error',
      message: err.message,
    });
  }

  logger.error('Unhandled error:', { error: err.message, stack: err.stack, path: req.path });
  return res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

export default app;

