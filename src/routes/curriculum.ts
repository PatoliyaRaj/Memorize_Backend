import { Router } from 'express';
import { BasketController } from '@/controllers/basketController';
import { SubjectController } from '@/controllers/subjectController';
import { PlaylistController } from '@/controllers/playlistController';
import { NodeController } from '@/controllers/nodeController';
import { authMiddleware } from '@/middlewares/auth';

const router = Router();

// All curriculum routes require authentication
router.use(authMiddleware);

// --- Baskets ---
router.post('/baskets', BasketController.createBasket);
router.get('/baskets', BasketController.getBaskets);
router.get('/baskets/:id', BasketController.getBasketById);
router.put('/baskets/:id', BasketController.updateBasket);
router.delete('/baskets/:id', BasketController.deleteBasket);

// --- Subjects ---
router.post('/subjects', SubjectController.createSubject);
router.get('/subjects', SubjectController.getSubjects); // uses ?basketId=...
router.get('/subjects/:id', SubjectController.getSubjectById);
router.put('/subjects/:id', SubjectController.updateSubject);
router.delete('/subjects/:id', SubjectController.deleteSubject);

// --- Playlists ---
router.post('/playlists', PlaylistController.createPlaylist);
router.get('/playlists', PlaylistController.getPlaylists); // uses ?subjectId=...
router.get('/playlists/:id', PlaylistController.getPlaylistById);
router.put('/playlists/:id', PlaylistController.updatePlaylist);
router.delete('/playlists/:id', PlaylistController.deletePlaylist);

// --- Nodes ---
router.post('/nodes', NodeController.createNode);
router.get('/nodes', NodeController.getNodes); // uses ?playlistId=...
router.get('/nodes/:id', NodeController.getNodeById);
router.put('/nodes/:id', NodeController.updateNode);
router.delete('/nodes/:id', NodeController.deleteNode);

// --- Node Details ---
router.get('/nodes/:id/details', NodeController.getNodeDetails);
router.put('/nodes/:id/details', NodeController.updateNodeDetails);

export default router;
