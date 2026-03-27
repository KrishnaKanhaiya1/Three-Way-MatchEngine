import MatchResult from '../models/MatchResult.js';
import MatchEngineService from '../services/MatchEngineService.js';

// GET /api/match/:poNumber
export const getMatchResult = async (req, res, next) => {
  try {
    const { poNumber } = req.params;
    const result = await MatchResult.findOne({ poNumber });

    if (!result) {
      return res.status(404).json({
        success: false,
        error: `No match result found for PO: ${poNumber}`,
      });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// GET /api/match
export const getAllMatchResults = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const results = await MatchResult.find(filter).sort({ updatedAt: -1 });
    return res.status(200).json({ success: true, count: results.length, data: results });
  } catch (error) {
    next(error);
  }
};

// POST /api/match/:poNumber/re-evaluate
export const reEvaluateMatch = async (req, res, next) => {
  try {
    const { poNumber } = req.params;
    const result = await MatchEngineService.runMatch(poNumber);

    return res.status(200).json({
      success: true,
      message: `Match re-evaluated for PO: ${poNumber}`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
