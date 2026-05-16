import { Request, Response } from "express";
import { BasketService } from "@/services/basketService";
import {
  createBasketSchema,
  updateBasketSchema,
} from "@/validators/curriculum";
import logger from "@/utils/logger";

export class BasketController {
  static async createBasket(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const data = createBasketSchema.parse(req.body);

      const basket = await BasketService.createBasket(userId, data);
      res.status(201).json({ success: true, data: basket });
      logger.info("Basket created", { basketId: basket.id });
    } catch (error: any) {
      logger.error("Failed to create basket", { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async getBaskets(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const baskets = await BasketService.getBasketsByUser(userId);
      res.status(200).json({ success: true, data: baskets });
      logger.info("Baskets fetched", { basketsCount: baskets.length });
    } catch (error: any) {
      logger.error("Failed to fetch baskets", { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getBasketById(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const basket = await BasketService.getBasketById(userId, id);
      res.status(200).json({ success: true, data: basket });
      logger.info("Basket fetched", { basketId: basket.id });
    } catch (error: any) {
      logger.error("Failed to fetch basket", { error: error.message });
      res.status(404).json({ success: false, error: error.message });
    }
  }

  static async updateBasket(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const data = updateBasketSchema.parse(req.body);
      const basket = await BasketService.updateBasket(userId, id, data);
      res.status(200).json({ success: true, data: basket });
      logger.info("Basket updated", { basketId: basket.id });
    } catch (error: any) {
      logger.error("Failed to update basket", { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async deleteBasket(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      await BasketService.deleteBasket(userId, id);
      res.status(204).send();
      logger.info("Basket deleted", { basketId: id });
    } catch (error: any) {
      logger.error("Failed to delete basket", { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }
}
