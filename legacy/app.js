require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");

const db = require("../src/model");

const app = express();


app.use(cors());
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health check endpoints
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.get('/ready', async (req, res) => {
    try {
        if (db && db.sequelize && typeof db.sequelize.authenticate === 'function') {
            await db.sequelize.authenticate();
            return res.status(200).json({ ready: true });
        }
        return res.status(200).json({ ready: false, reason: 'db_not_configured' });
    } catch (err) {
        return res.status(503).json({ ready: false, error: err.message });
    }
});

const startServer = async () => {
    try {
        if (db && typeof db.SyncDatabase === 'function') {
            console.log('Syncing database...');
            await db.SyncDatabase();
        } else {
            console.warn('db.SyncDatabase is not available. Skipping DB sync.');
        }

        const PORT = process.env.PORT || 3000;
        const server = app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

        const shutdown = async (signal) => {
            try {
                console.log(`Received ${signal}. Closing server...`);
                server.close(() => console.log('HTTP server closed'));
                if (db && db.sequelize && typeof db.sequelize.close === 'function') {
                    await db.sequelize.close();
                    console.log('Database connection closed');
                }
                process.exit(0);
            } catch (err) {
                console.error('Error during shutdown', err);
                process.exit(1);
            }
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('uncaughtException', (err) => {
            console.error('Uncaught Exception', err);
            process.exit(1);
        });
        process.on('unhandledRejection', (reason) => {
            console.error('Unhandled Rejection', reason);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
};

startServer();
