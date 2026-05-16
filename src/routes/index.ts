// Routes index
// Centralized route exports. Import routers here to keep route registration tidy.
export { default as usersRouter } from './users';
export { default as authRouter } from './auth';

// Example usage in `src/app.ts`:
// import { usersRouter, authRouter } from './routes';
// app.use('/api/users', usersRouter);
// app.use('/api/auth', authRouter);

