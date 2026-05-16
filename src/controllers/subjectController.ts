import { Request, Response } from 'express';
import { SubjectService } from '@/services/subjectService';
import { createSubjectSchema, updateSubjectSchema } from '@/validators/curriculum';
import logger from '@/utils/logger';

export class SubjectController {
  static async createSubject(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const data = createSubjectSchema.parse(req.body);
      
      const subject = await SubjectService.createSubject(userId, data);
      res.status(201).json({ success: true, data: subject });
      logger.info("Subject created", { subjectId: subject.id });
    } catch (error: any) {
      logger.error("Failed to create subject", { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async getSubjects(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { basketId } = req.query;
      
      if (!basketId) {
        res.status(400).json({ success: false, error: 'basketId query param is required' });
        return;
      }

      const subjects = await SubjectService.getSubjectsByBasket(userId, basketId as string);
      res.status(200).json({ success: true, data: subjects });
      logger.info("Subjects fetched", { subjectsCount: subjects.length });
    } catch (error: any) {
      logger.error("Failed to fetch subjects", { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getSubjectById(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const subject = await SubjectService.getSubjectById(userId, id);
      res.status(200).json({ success: true, data: subject });
      logger.info("Subject fetched", { subjectId: subject.id });
    } catch (error: any) {
      logger.error("Failed to fetch subject", { error: error.message });
      res.status(404).json({ success: false, error: error.message });
    }
  }

  static async updateSubject(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const data = updateSubjectSchema.parse(req.body);
      const subject = await SubjectService.updateSubject(userId, id, data);
      res.status(200).json({ success: true, data: subject });
      logger.info("Subject updated", { subjectId: subject.id });
    } catch (error: any) {
      logger.error("Failed to update subject", { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async deleteSubject(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      await SubjectService.deleteSubject(userId, id);
      res.status(204).send();
      logger.info("Subject deleted", { subjectId: id });
    } catch (error: any) {
      logger.error("Failed to delete subject", { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }
}
