import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from './logger.js';

let genAI = null;
let model = null;

const initializeClient = () => {
  if (model) return model;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    logger.warn('GEMINI_API_KEY not set. Document extraction will fail.');
    return null;
  }

  genAI = new GoogleGenerativeAI(apiKey);

  model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: `You are a document data extractor. Extract structured data from procurement documents (Purchase Orders, Goods Receipt Notes, Invoices).

Always respond with valid JSON matching this schema — no markdown, no extra text:

{
  "poNumber": "string — the Purchase Order number referenced in the document",
  "documentType": "string — one of: PO, GRN, INVOICE",
  "vendorName": "string — the vendor/supplier name",
  "date": "string — the document date exactly as printed",
  "documentNumber": "string — the document's own identifier (PO number, GRN number, or Invoice number)",
  "items": [
    {
      "itemCode": "string — NUMERIC internal SKU / material code",
      "description": "string — clean item description",
      "quantity": number,
      "unitPrice": number or null,
      "totalAmount": number or null,
      "confidence": number 0-1
    }
  ],
  "confidence": {
    "overall": number 0-1,
    "poNumber": number 0-1,
    "vendorName": number 0-1,
    "date": number 0-1,
    "items": number 0-1
  }
}

ITEM CODE RULES:
1. Always use the NUMERIC internal SKU / material code as itemCode (e.g. "11423", "33390").
2. Never use FG-style product codes (like "FG-P-F-0503") as itemCode.
3. If both a numeric and FG-style code exist, use the numeric one.
4. If only FG-style codes exist, strip the "FG-" prefix and use the remainder.

DESCRIPTION RULES:
5. Strip metadata noise. Remove "Colour: Size: size Brand:Band_1" etc. Keep only product name and size/weight.

EXTRACTION RULES:
6. Extract ALL line items from the entire document, not just the first page.
7. quantity must be a number. unitPrice and totalAmount must be numbers or null.
8. Always populate poNumber if the document references a PO.
9. For GRN: use "Received Qty" / "Accepted Qty" as quantity, NOT ordered qty.
10. For Invoice: use "Billed Qty" as quantity. Extract unitPrice AND totalAmount per item.
11. For PO: use "Ordered Qty" as quantity. Extract unitPrice per item.
12. Respond ONLY with the JSON object.
13. Set confidence scores honestly: 1.0 = clearly visible, 0.5 = partially visible, 0.0 = not found.`,
  });

  logger.info('Gemini API client initialized');
  return model;
};

export const getModel = () => {
  if (!model) initializeClient();
  return model;
};

export default { getModel, initializeClient };
