/**
 * Server entry point
 * Handles database initialization and server startup
 * Separate from app.ts to allow app export for testing
 */

import 'dotenv/config';
import { initializeDatabase, closeDatabase } from './db';
import app from './app';

const startServer = async (): Promise<void> => {
  try {
    // Initialize database
    console.log('Initializing database...');
    await initializeDatabase();
    console.log('✅ Database initialized successfully');

    const PORT = process.env.PORT || 5000;
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
