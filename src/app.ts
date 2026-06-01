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
import logger from './utils/logger';

const app = express();

// Middleware
app.use(cors());
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
  skip: () => process.env.NODE_ENV === 'production',
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
  logger.error('Unhandled error:', { error: err.message, stack: err.stack, path: req.path });
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

export default app;

