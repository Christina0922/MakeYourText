import express from 'express';
import { TONE_PRESETS, AUDIENCE_LEVELS, PURPOSE_TYPES, VOICE_PRESETS, RELATIONSHIPS } from '../data/presets.js';

const router = express.Router();

/**
 * GET /api/presets/tones
 * 톤 프리셋 목록
 */
router.get('/tones', (req, res) => {
  res.json(TONE_PRESETS);
});

/**
 * GET /api/presets/audience
 * 독자/연령 레벨 목록
 */
router.get('/audience', (req, res) => {
  res.json(AUDIENCE_LEVELS);
});

/**
 * GET /api/presets/relationships
 * 관계 선택 목록
 */
router.get('/relationships', (req, res) => {
  res.json(RELATIONSHIPS);
});

/**
 * GET /api/presets/purpose
 * 목적/형식 목록
 */
router.get('/purpose', (req, res) => {
  res.json(PURPOSE_TYPES);
});

/**
 * GET /api/presets/voices
 * 보이스 프리셋 목록
 */
router.get('/voices', (req, res) => {
  res.json(VOICE_PRESETS);
});

export default router;

