import request from 'supertest';

// Mock multer before importing app
jest.mock('multer', () => {
  const multerMock: any = () => ({
    single: () => (req: any, _res: any, next: any) => {
      if (req.headers['simulate-file-large'] === 'true') {
        const err = new (multerMock.MulterError)('File too large', 'LIMIT_FILE_SIZE');
        return next(err);
      }
      if (req.headers['simulate-multer-generic-error'] === 'true') {
        const err = new (multerMock.MulterError)('Multer generic error', 'LIMIT_UNEXPECTED_FILE');
        return next(err);
      }
      next();
    },
  });
  multerMock.diskStorage = jest.fn().mockReturnValue({});
  multerMock.MulterError = class extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.name = 'MulterError';
      this.code = code;
    }
  };
  return multerMock;
});

import app from '@/app';
import * as dbConnection from '@/db';
import * as orchestrator from '@/services/import/orchestrator';
import * as saveService from '@/services/import/saveService';

// Mock DB connection
jest.mock('@/db', () => ({
  getDb: jest.fn(),
}));

// Mock services
jest.mock('@/services/import/extractorService', () => ({
  processFileSecurely: jest.fn(),
}));

jest.mock('@/services/import/orchestrator', () => ({
  orchestrateLlmAnalysis: jest.fn(),
}));

jest.mock('@/services/import/saveService', () => ({
  saveImport: jest.fn(),
}));

// Mock auth middleware to return a mock user
jest.mock('@/middlewares/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { id: '034bbc57-7dd6-4695-a895-fd096d454308' };
    next();
  },
}));

describe('Smart Import Pipeline', () => {
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn(),
    };

    (dbConnection.getDb as jest.Mock).mockReturnValue(mockDb);
  });

  describe('POST /api/import/smart', () => {
    it('should successfully parse smart import text and return cards/fields when node exists and is owned by user', async () => {
      mockDb.limit.mockResolvedValue([{ id: 'node-uuid' }]);

      const mockLlmResult = {
        fields: {
          theoryContent: 'Extracted theory',
          thingsToRemember: 'Key memory points',
          references: [],
          emotionalAnchor: 'Anchor description',
          isImportant: true,
        },
        cards: [
          {
            question: 'What is the theory?',
            answer: 'It is a mock theory.',
            questionType: 'free_recall',
            subTopic: 'Introduction',
            explanation: 'Detail info',
          },
        ],
        metrics: {
          chunkCount: 1,
        },
      };
      (orchestrator.orchestrateLlmAnalysis as jest.Mock).mockResolvedValue(mockLlmResult);

      const response = await request(app)
        .post('/api/import/smart')
        .send({
          nodeId: '491578cc-526a-4669-a0d5-d20375f1bfc1',
          textContent: 'This is a sample document for smart card generation.',
          nodeTitle: 'Mock Node',
          nodeType: 'concept',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('cards');
      expect(response.body.cards.length).toBe(1);
      expect(response.body.cards[0].question).toBe('What is the theory?');
      expect(response.body).toHaveProperty('fields');
      expect(response.body.fields.theoryContent).toBe('Extracted theory');
    });

    it('should return 404 target resource not found if user does not own the node (BOLA protection)', async () => {
      mockDb.limit.mockResolvedValue([]);

      const response = await request(app)
        .post('/api/import/smart')
        .send({
          nodeId: '491578cc-526a-4669-a0d5-d20375f1bfc1',
          textContent: 'Sample document text',
          nodeTitle: 'Mock Node',
          nodeType: 'concept',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Target resource not found.');
    });

    it('should return 400 bad request if node UUID is invalid', async () => {
      const response = await request(app)
        .post('/api/import/smart')
        .send({
          nodeId: 'invalid-uuid',
          textContent: 'Sample document text',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Valid node identifier is required.');
    });

    it('should return 400 bad request if neither textContent nor file is provided', async () => {
      mockDb.limit.mockResolvedValue([{ id: 'node-uuid' }]);

      const response = await request(app)
        .post('/api/import/smart')
        .send({
          nodeId: '491578cc-526a-4669-a0d5-d20375f1bfc1',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Provide a file or text content.');
    });

    it('should return 400 error if file uploaded exceeds Multer size limits', async () => {
      mockDb.limit.mockResolvedValue([{ id: 'node-uuid' }]);

      const response = await request(app)
        .post('/api/import/smart')
        .set('simulate-file-large', 'true')
        .send({
          nodeId: '491578cc-526a-4669-a0d5-d20375f1bfc1',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('File too large');
      expect(response.body.message).toContain('exceeds the limit of 20MB');
    });

    it('should return 400 error if a generic Multer error occurs', async () => {
      mockDb.limit.mockResolvedValue([{ id: 'node-uuid' }]);

      const response = await request(app)
        .post('/api/import/smart')
        .set('simulate-multer-generic-error', 'true')
        .send({
          nodeId: '491578cc-526a-4669-a0d5-d20375f1bfc1',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Upload error');
      expect(response.body.message).toBe('Multer generic error');
    });
  });

  describe('POST /api/import/confirm', () => {
    it('should successfully confirm and save the import when valid payload and user owns the node', async () => {
      mockDb.limit.mockResolvedValue([{ id: 'node-uuid' }]);
      (saveService.saveImport as jest.Mock).mockResolvedValue({ success: true, savedCardsCount: 1 });

      const response = await request(app)
        .post('/api/import/confirm')
        .send({
          nodeId: '491578cc-526a-4669-a0d5-d20375f1bfc1',
          fields: {
            theoryContent: 'Saved theory content',
            thingsToRemember: 'Things to remember',
            isImportant: true,
          },
          cards: [
            {
              question: 'Confirm question?',
              answer: 'Confirm answer',
              questionType: 'free_recall',
              subTopic: 'Sub topic',
              explanation: 'Exp',
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.savedCardsCount).toBe(1);
    });

    it('should reject payload structure validation failures (zod schema validation)', async () => {
      const response = await request(app)
        .post('/api/import/confirm')
        .send({
          nodeId: '491578cc-526a-4669-a0d5-d20375f1bfc1',
          fields: {},
          cards: [
            {
              // missing answer and question
              questionType: 'free_recall',
            },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid payload structure.');
    });
  });
});
