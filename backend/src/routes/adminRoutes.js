import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';
import Log from '../models/Log.js';

const router = express.Router();

router.get('/logs', protect, admin, async (req, res) => {
  try {
    const logs = await Log.find({}).sort({ createdAt: -1 }).populate('userId', 'username email');
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
