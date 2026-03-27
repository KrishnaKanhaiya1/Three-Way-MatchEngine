import fs from 'fs';
import path from 'path';
import { getModel } from '../utils/geminiClient.js';
import { normalizeDate } from '../utils/dateUtils.js';
import logger from '../utils/logger.js';

const svcLogger = logger.child ? logger.child({ service: 'Extraction' }) : logger;

// Extract structured data from a PDF via Gemini
export const extractFromPDF = async (filePath, documentType) => {
  const model = getModel();
  if (!model) {
    throw new Error('Gemini API not configured. Set GEMINI_API_KEY in .env');
  }

  const fileBuffer = fs.readFileSync(filePath);
  const base64Data = fileBuffer.toString('base64');

  svcLogger.info(`Extracting: ${path.basename(filePath)} (hint: ${documentType || 'auto-detect'})`);

  const typeHint = documentType
    ? `This is a ${documentType} document.`
    : 'Identify whether this is a PO, GRN, or INVOICE document.';

  const prompt = `${typeHint} Extract all data following the schema from your system instructions.
CRITICAL:
- For itemCode, use the NUMERIC internal SKU / material code (e.g., "11423", "33390"). NEVER use FG-style codes (e.g., "FG-P-F-0503").
- If the document only shows FG-style codes, look for an associated numeric code or material number nearby.
- For GRN: use "Received Qty" / "Accepted Qty" as quantity (NOT ordered qty)
- For INVOICE: use "Billed Qty" / "Invoice Qty" as quantity. Always extract unitPrice and totalAmount per item.
- For PO: use "Ordered Qty" as quantity. Always extract unitPrice per item.
- Extract ALL line items, not just the first one
- Clean descriptions: remove suffixes like "Colour: Size: size Brand:..." — keep only product name and size/weight
- If a field is not found, use null or empty string
Respond ONLY with valid JSON matching the schema - no markdown, no explanation.`;

  let rawResponse = '';
  try {
    const result = await model.generateContent([
      { inlineData: { mimeType: 'application/pdf', data: base64Data } },
      { text: prompt },
    ]);

    rawResponse = result.response.text().trim();

    // Strip markdown fences if present
    rawResponse = rawResponse
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const extracted = JSON.parse(rawResponse);

    if (!extracted.poNumber && !extracted.documentNumber) {
      throw new Error('Extraction failed: no poNumber or documentNumber in response');
    }

    if (!Array.isArray(extracted.items) || extracted.items.length === 0) {
      svcLogger.warn(`No items extracted from ${path.basename(filePath)}`);
    }

    // Normalize items
    if (Array.isArray(extracted.items)) {
      extracted.items = extracted.items.map((item) => {
        let code = String(item.itemCode || 'UNKNOWN').trim();
        if (/^FG-[A-Z]-[A-Z]-/i.test(code)) {
          code = code.replace(/^FG-[A-Z]-[A-Z]-/i, '');
          code = code.replace(/^0+/, '') || '0';
        }

        let desc = String(item.description || '').trim();
        desc = desc.replace(/\s*Colour:.*$/i, '').trim();

        return {
          itemCode: code,
          description: desc,
          quantity: Number(item.quantity) || 0,
          unitPrice: item.unitPrice != null ? Number(item.unitPrice) : null,
          totalAmount: item.totalAmount != null ? Number(item.totalAmount) : null,
        };
      });
    }

    const dateISO = normalizeDate(extracted.date);

    const confidenceData = extracted.confidence || {};
    const overallConfidence = Number(confidenceData.overall) || null;

    if (overallConfidence !== null && overallConfidence < 0.7) {
      svcLogger.warn(`Low confidence (${overallConfidence.toFixed(2)}) for ${path.basename(filePath)}`);
    }

    // Auto-detect document type from Gemini if not provided
    const detectedType = (extracted.documentType || documentType || 'UNKNOWN').toUpperCase();

    svcLogger.info(
      `Extracted: ${detectedType} | PO#${extracted.poNumber} | ` +
      `${extracted.items?.length || 0} items | date: ${dateISO} | confidence: ${overallConfidence ?? 'N/A'}`
    );

    return {
      documentType: detectedType,
      poNumber: String(extracted.poNumber || '').trim(),
      documentNumber: String(extracted.documentNumber || '').trim(),
      vendorName: String(extracted.vendorName || '').trim(),
      date: extracted.date || null,
      dateISO,
      items: extracted.items || [],
      extractionConfidence: overallConfidence,
      confidenceBreakdown: confidenceData,
      rawExtraction: extracted,
    };
  } catch (err) {
    if (err.message.includes('JSON')) {
      svcLogger.error(`JSON parse error. Raw response:\n${rawResponse}`);
      throw new Error(`Failed to parse Gemini response as JSON: ${err.message}`);
    }
    svcLogger.error(`Extraction error: ${err.message}`);
    throw err;
  }
};

export default { extractFromPDF };
