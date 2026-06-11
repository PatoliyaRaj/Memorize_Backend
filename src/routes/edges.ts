import { Router } from 'express';
import { EdgeController } from '@/controllers/edgeController';
import { authMiddleware } from '@/middlewares/auth';

const router = Router();

// All edge routes require authentication
router.use(authMiddleware);

router.get('/playlists/:playlistId/edges', EdgeController.getEdgesByPlaylist);
router.post('/edges', EdgeController.createEdge);
router.delete('/edges/:id', EdgeController.deleteEdge);
router.put('/edges/:id', EdgeController.updateEdge);

export default router;
