import 'dotenv/config';
import express, { Request, Response, NextFunction, response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import { initializeDatabase, closeDatabase, verifyDatabaseReady } from './db';
import userRoutes from './routes/users';

const app = express();

// Middleware
app.use(cors());
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

// API Routes
app.use("/", (req: Request, res: Response) => {
  res.json({ message: "Welcome to the Memorize API", timestamp: new Date().toISOString(), success: true });
});
app.use('/api/users', userRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    method: req.method,
  });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

/**
 * Start the server
 */
const startServer = async (): Promise<void> => {
  try {
    // Initialize database
    console.log('Initializing database...');
    await initializeDatabase();
    console.log('✅ Database initialized successfully');

    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server listening on port ${PORT}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
      try {
        console.log(`\n📍 Received ${signal}. Closing server gracefully...`);
        server.close(async () => {
          console.log('✅ HTTP server closed');
          await closeDatabase();
          console.log('✅ Database connection closed');
          process.exit(0);
        });

        // Force close after 10 seconds
        setTimeout(() => {
          console.error('❌ Forced shutdown after 10 seconds');
          process.exit(1);
        }, 10000);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
