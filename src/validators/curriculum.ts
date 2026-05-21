import { z } from 'zod';

// --- Baskets ---
export const createBasketSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  description: z.string().optional(),
  fieldTag: z.string().optional(),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  icon: z.string().optional(),
  isPublic: z.boolean().optional(),
});

export const updateBasketSchema = createBasketSchema.partial();

// --- Subjects ---
export const createSubjectSchema = z.object({
  basketId: z.string().uuid('Invalid basket ID'),
  title: z.string().min(1, 'Title is required').max(100),
  description: z.string().optional(),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().optional(),
  position: z.number().int().optional(),
});

export const updateSubjectSchema = createSubjectSchema.partial();

// --- Playlists ---
export const createPlaylistSchema = z.object({
  subjectId: z.string().uuid('Invalid subject ID'),
  title: z.string().min(1, 'Title is required').max(100),
  description: z.string().optional(),
  orderIndex: z.number().int().optional(),
});

export const updatePlaylistSchema = createPlaylistSchema.partial();

// --- Nodes ---
export const createNodeSchema = z.object({
  playlistId: z.string().uuid('Invalid playlist ID'),
  title: z.string().min(1, 'Title is required').max(100),
  nodeType: z.enum(['concept', 'definition', 'formula', 'process', 'example', 'exception']).optional(),
  posX: z.number().int().optional(),
  posY: z.number().int().optional(),
  orderIndex: z.number().int().optional(),
});

export const updateNodeSchema = createNodeSchema.partial();

export const updateNodeDetailsSchema = z.object({
  theoryContent: z.string().optional(),
  theory: z.string().optional(),
  references: z.array(z.object({
    title: z.string(),
    url: z.string(),
    type: z.enum(['video', 'article', 'doc', 'book'])
  })).optional(),
  images: z.array(z.object({
    url: z.string(),
    caption: z.string().optional(),
    altText: z.string().optional()
  })).optional(),
  files: z.array(z.object({
    url: z.string(),
    name: z.string(),
    size: z.number().optional()
  })).optional(),
  thingsToRemember: z.string().optional(),
  takeaways: z.array(z.string()).optional(),
  emotionalAnchor: z.string().optional(),
  emotional_anchor: z.string().optional(),
  isImportant: z.boolean().optional(),
  examRelevance: z.array(z.string()).optional(),
});

