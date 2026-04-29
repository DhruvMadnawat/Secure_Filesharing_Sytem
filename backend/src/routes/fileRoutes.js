import express from 'express';
import multer from 'multer';
import { uploadFile, downloadFile, listFiles, shareFile } from '../controllers/fileController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Configure multer for memory storage (for easy encryption before saving)
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post('/upload', protect, upload.single('file'), uploadFile);
router.get('/download/:fileId', protect, downloadFile);
router.get('/list', protect, listFiles);
router.post('/share/:fileId', protect, shareFile);

export default router;
