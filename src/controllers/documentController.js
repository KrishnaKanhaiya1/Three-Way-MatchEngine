import path from 'path';
import fs from 'fs';
import multer from 'multer';
import crypto from 'crypto';
import Document from '../models/Document.js';
import MatchEngineService from '../services/MatchEngineService.js';
import { extractFromPDF } from '../services/ExtractionService.js';
import logger from '../utils/logger.js';

const log = logger.child ? logger.child({ service: 'DocController' }) : logger;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.resolve('uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (file.mimetype === 'application/pdf') cb(null, true);
  else cb(new Error('Only PDF files are allowed'), false);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

const hashFile = (filePath) => {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
};

export const uploadDocument = async (req, res, next) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'No file uploaded. Send a PDF in the "file" field.' });
  }

  const validTypes = ['PO', 'GRN', 'INVOICE'];
  let docType = null;

  if (req.body.documentType) {
    docType = req.body.documentType.toUpperCase();
    if (!validTypes.includes(docType)) {
      fs.unlinkSync(file.path);
      return res.status(400).json({
        success: false,
        error: `Invalid documentType. Must be one of: ${validTypes.join(', ')}`,
      });
    }
  }

  try {
    const fileHash = hashFile(file.path);
    const hashDup = await Document.findOne({ fileHash });
    if (hashDup) {
      fs.unlinkSync(file.path);
      return res.status(409).json({
        success: false,
        error: 'This exact file has already been uploaded.',
        existingDocumentId: hashDup._id,
        poNumber: hashDup.poNumber,
      });
    }

    log.info(`Extracting: ${file.originalname} (type: ${docType || 'auto-detect'})`);
    const extracted = await extractFromPDF(file.path, docType);

    if (!docType) {
      docType = extracted.documentType;
      if (!validTypes.includes(docType)) {
        fs.unlinkSync(file.path);
        return res.status(422).json({
          success: false,
          error: `Could not determine document type. Gemini returned: "${docType}"`,
        });
      }
    }

    if (!extracted.poNumber) {
      fs.unlinkSync(file.path);
      return res.status(422).json({
        success: false,
        error: 'Could not extract PO number from document.',
      });
    }

    const logicalDup = await Document.findOne({
      documentNumber: extracted.documentNumber,
      poNumber: extracted.poNumber,
      documentType: docType,
    });

    if (logicalDup) {
      fs.unlinkSync(file.path);
      return res.status(409).json({
        success: false,
        error: `A ${docType} with number "${extracted.documentNumber}" for PO "${extracted.poNumber}" already exists.`,
        existingDocumentId: logicalDup._id,
      });
    }

    const document = await Document.create({
      documentType: docType,
      poNumber: extracted.poNumber,
      documentNumber: extracted.documentNumber || `${docType}-${Date.now()}`,
      vendorName: extracted.vendorName,
      date: extracted.date,
      dateISO: extracted.dateISO ? new Date(extracted.dateISO) : null,
      items: extracted.items,
      originalFileName: file.originalname,
      filePath: file.path,
      mimeType: file.mimetype,
      fileHash,
      extractionConfidence: extracted.extractionConfidence,
      rawExtraction: extracted.rawExtraction,
    });

    log.info(`Saved: ${docType} #${document.documentNumber} | PO#${extracted.poNumber} | ${document.items.length} items`);

    let matchResult = null;
    try {
      matchResult = await MatchEngineService.runMatch(extracted.poNumber);
    } catch (matchErr) {
      log.error(`Match failed for PO#${extracted.poNumber}: ${matchErr.message}`);
    }

    return res.status(201).json({
      success: true,
      message: `${docType} uploaded and processed successfully.`,
      document: {
        id: document._id,
        documentType: document.documentType,
        poNumber: document.poNumber,
        documentNumber: document.documentNumber,
        vendorName: document.vendorName,
        date: document.date,
        itemCount: document.items.length,
      },
      matchResult: matchResult
        ? {
            status: matchResult.status,
            reasonCodes: matchResult.reasonCodes,
            summary: matchResult.summary,
          }
        : null,
    });
  } catch (err) {
    if (file?.path && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch {}
    }
    next(err);
  }
};

export const getDocuments = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.poNumber) filter.poNumber = req.query.poNumber;
    if (req.query.documentType) filter.documentType = req.query.documentType.toUpperCase();

    const documents = await Document.find(filter)
      .select('-rawExtraction -filePath')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, count: documents.length, data: documents });
  } catch (err) {
    next(err);
  }
};

export const getDocumentById = async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id).select('-filePath');
    if (!document) {
      return res.status(404).json({ success: false, error: `Document not found: ${req.params.id}` });
    }
    return res.status(200).json({ success: true, data: document });
  } catch (err) {
    next(err);
  }
};

export const deleteDocument = async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ success: false, error: `Document not found: ${req.params.id}` });
    }

    const { poNumber } = document;

    if (document.filePath && fs.existsSync(document.filePath)) {
      try { fs.unlinkSync(document.filePath); } catch {}
    }

    await document.deleteOne();

    let matchResult = null;
    try {
      matchResult = await MatchEngineService.runMatch(poNumber);
    } catch (matchErr) {
      log.error(`Match re-eval failed after delete for PO#${poNumber}: ${matchErr.message}`);
    }

    return res.status(200).json({
      success: true,
      message: `Document deleted. Match re-evaluated for PO#${poNumber}.`,
      matchResult: matchResult
        ? { status: matchResult.status, summary: matchResult.summary }
        : null,
    });
  } catch (err) {
    next(err);
  }
};
