import { Router } from 'express';
import {
  upload,
  uploadDocument,
  getDocuments,
  getDocumentById,
  deleteDocument,
} from '../controllers/documentController.js';

const router = Router();

router.post('/upload', upload.single('file'), uploadDocument);
router.get('/', getDocuments);
router.get('/:id', getDocumentById);
router.delete('/:id', deleteDocument);

export default router;
