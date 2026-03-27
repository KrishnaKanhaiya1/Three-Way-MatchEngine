import { Router } from 'express';
import {
  getMatchResult,
  getAllMatchResults,
  reEvaluateMatch,
} from '../controllers/matchController.js';

const router = Router();

router.get('/', getAllMatchResults);
router.get('/:poNumber', getMatchResult);
router.post('/:poNumber/re-evaluate', reEvaluateMatch);

export default router;
