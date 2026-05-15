/**
 * Type definitions for database models
 * Re-exports from schema for cleaner imports across the application
 */

export type { User, NewUser, Node, NewNode } from '../db/schema';
export { users, nodes } from '../db/schema';
