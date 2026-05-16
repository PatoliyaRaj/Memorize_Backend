import { Request, Response } from 'express';
import { PlaylistService } from '@/services/playlistService';
import { createPlaylistSchema, updatePlaylistSchema } from '@/validators/curriculum';
import logger from '@/utils/logger';

export class PlaylistController {
  static async createPlaylist(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const data = createPlaylistSchema.parse(req.body);
      
      const playlist = await PlaylistService.createPlaylist(userId, data);
      res.status(201).json({ success: true, data: playlist });
      logger.info("Playlist created", { playlistId: playlist.id });
    } catch (error: any) {
      logger.error("Failed to create playlist", { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async getPlaylists(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { subjectId } = req.query;
      
      if (!subjectId) {
        res.status(400).json({ success: false, error: 'subjectId query param is required' });
        return;
      }

      const playlists = await PlaylistService.getPlaylistsBySubject(userId, subjectId as string);
      res.status(200).json({ success: true, data: playlists });
      logger.info("Playlists fetched", { playlistsCount: playlists.length });
    } catch (error: any) {
      logger.error("Failed to fetch playlists", { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getPlaylistById(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const playlist = await PlaylistService.getPlaylistById(userId, id);
      res.status(200).json({ success: true, data: playlist });
      logger.info("Playlist fetched", { playlistId: playlist.id });
    } catch (error: any) {
      logger.error("Failed to fetch playlist", { error: error.message });
      res.status(404).json({ success: false, error: error.message });
    }
  }

  static async updatePlaylist(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const data = updatePlaylistSchema.parse(req.body);
      const playlist = await PlaylistService.updatePlaylist(userId, id, data);
      res.status(200).json({ success: true, data: playlist });
      logger.info("Playlist updated", { playlistId: playlist.id });
    } catch (error: any) {
      logger.error("Failed to update playlist", { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async deletePlaylist(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      await PlaylistService.deletePlaylist(userId, id);
      res.status(204).send();
      logger.info("Playlist deleted", { playlistId: id });
    } catch (error: any) {
      logger.error("Failed to delete playlist", { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }
}
