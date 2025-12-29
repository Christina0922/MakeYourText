import express from 'express';
import { TEMPLATES } from '../data/templates.js';

const router = express.Router();

/**
 * GET /api/templates
 * 템플릿 목록 조회
 */
router.get('/', (req, res) => {
  res.json(TEMPLATES);
});

export default router;

