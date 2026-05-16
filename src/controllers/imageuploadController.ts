import imagekit from "@/utils/imagekit";
import { Request, Response } from "express";
import logger from "@/utils/logger";

export class ImageUploadController {
  static async uploadImage(req: Request, res: Response) {
    try {
      // Get the authenticated user ID from the auth middleware
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ success: false, error: 'No image file provided in the request' });
        return;
      }

      // Convert the buffer to base64 for ImageKit
      // Some versions of the ImageKit SDK prefer base64 over raw buffers
      const base64File = file.buffer.toString('base64');

      logger.info(`Uploading image ${file.originalname} for user ${userId} to ImageKit`);

      const result = await imagekit.upload({
        file: base64File, 
        fileName: file.originalname,
        folder: `/neurolearn/users/${userId}`, // Organized folder structure
        useUniqueFileName: true,
      });

      logger.info("Image uploaded successfully", { url: result.url });
      
      // Return the uploaded image data including the URL
      res.status(200).json({ 
        success: true, 
        data: {
          fileId: result.fileId,
          url: result.url,
          thumbnailUrl: result.thumbnailUrl,
          name: result.name,
        } 
      });
    } catch (error: any) {
      logger.error("Failed to upload image", { error: error.message || error });
      res.status(500).json({ success: false, error: error.message || "Failed to upload image to ImageKit" });
    }
  }
}