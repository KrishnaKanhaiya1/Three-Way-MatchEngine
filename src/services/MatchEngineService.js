import Document from '../models/Document.js';
import MatchResult from '../models/MatchResult.js';
import logger from '../utils/logger.js';

const svcLogger = logger.child ? logger.child({ service: 'MatchEngine' }) : logger;

const REASON = {
  GRN_QTY_EXCEEDS_PO:        'grn_qty_exceeds_po_qty',
  INVOICE_QTY_EXCEEDS_PO:    'invoice_qty_exceeds_po_qty',
  INVOICE_QTY_EXCEEDS_GRN:   'invoice_qty_exceeds_grn_qty',
  PRICE_MISMATCH:            'price_mismatch_po_invoice',
  TOTAL_AMOUNT_MISMATCH:     'total_amount_mismatch',
  INVOICE_DATE_AFTER_PO:     'invoice_date_after_po_date',
  DUPLICATE_PO:              'duplicate_po',
  ITEM_MISSING_IN_PO:        'item_missing_in_po',
};

const normalizeItemCode = (code) => {
  let c = (code || '').trim().toUpperCase();
  if (/^FG-[A-Z]-[A-Z]-/i.test(c)) {
    c = c.replace(/^FG-[A-Z]-[A-Z]-/i, '');
    c = c.replace(/^0+/, '') || '0';
  }
  return c;
};

const tokenize = (desc) => {
  return (desc || '')
    .toLowerCase()
    .replace(/\s*colour:.*$/i, '')
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
};

const similarity = (a, b) => {
  if (!a.length || !b.length) return 0;
  let fwd = 0;
  for (const t of a) {
    if (b.some(u => t.includes(u) || u.includes(t))) fwd++;
  }
  let rev = 0;
  for (const t of b) {
    if (a.some(u => t.includes(u) || u.includes(t))) rev++;
  }
  return ((fwd / a.length) + (rev / b.length)) / 2;
};

const buildQtyMap = (docs) => {
  const map = new Map();
  for (const doc of docs) {
    for (const item of doc.items || []) {
      const key = normalizeItemCode(item.itemCode);
      map.set(key, (map.get(key) || 0) + item.quantity);
    }
  }
  return map;
};

const buildPriceMap = (docs) => {
  const map = new Map();
  for (const doc of docs) {
    for (const item of doc.items || []) {
      const key = normalizeItemCode(item.itemCode);
      if (!map.has(key) && item.unitPrice != null) {
        map.set(key, item.unitPrice);
      }
    }
  }
  return map;
};

const buildTotalAmountMap = (docs) => {
  const map = new Map();
  for (const doc of docs) {
    for (const item of doc.items || []) {
      const key = normalizeItemCode(item.itemCode);
      if (item.totalAmount != null) {
        map.set(key, (map.get(key) || 0) + item.totalAmount);
      }
    }
  }
  return map;
};

const buildDescMap = (docs) => {
  const map = new Map();
  for (const doc of docs) {
    for (const item of doc.items || []) {
      const key = normalizeItemCode(item.itemCode);
      if (!map.has(key)) map.set(key, item.description || '');
    }
  }
  return map;
};

const buildTokenList = (docs) => {
  const list = [];
  const seen = new Set();
  for (const doc of docs) {
    for (const item of doc.items || []) {
      const code = normalizeItemCode(item.itemCode);
      if (!seen.has(code)) {
        list.push({ code, tokens: tokenize(item.description) });
        seen.add(code);
      }
    }
  }
  return list;
};

const runMatch = async (poNumber) => {
  svcLogger.info(`Running match for PO: ${poNumber}`);

  const [poDocs, grnDocs, invDocs] = await Promise.all([
    Document.find({ poNumber, documentType: 'PO' }),
    Document.find({ poNumber, documentType: 'GRN' }),
    Document.find({ poNumber, documentType: 'INVOICE' }),
  ]);

  const topReasons = [];

  if (poDocs.length > 1) {
    svcLogger.warn(`Duplicate PO for ${poNumber}: ${poDocs.length} docs`);
    topReasons.push(REASON.DUPLICATE_PO);

    return await MatchResult.findOneAndUpdate(
      { poNumber },
      {
        poDocumentIds: poDocs.map(d => d._id),
        grnDocumentIds: grnDocs.map(d => d._id),
        invoiceDocumentIds: invDocs.map(d => d._id),
        status: 'duplicate_po',
        reasonCodes: topReasons,
        summary: `${poDocs.length} PO documents found for ${poNumber}. Resolve duplicates first.`,
        itemDetails: [],
        totalMatchedItems: 0,
        totalMismatchedItems: 0,
        totalItems: 0,
      },
      { upsert: true, new: true }
    );
  }

  const hasAny = poDocs.length > 0 || grnDocs.length > 0 || invDocs.length > 0;
  if (!hasAny) {
    await MatchResult.findOneAndDelete({ poNumber });
    return null;
  }

  const missing = [];
  if (!poDocs.length) missing.push('PO');
  if (!grnDocs.length) missing.push('GRN');
  if (!invDocs.length) missing.push('Invoice');

  if (missing.length > 0) {
    return await MatchResult.findOneAndUpdate(
      { poNumber },
      {
        poDocumentIds: poDocs.map(d => d._id),
        grnDocumentIds: grnDocs.map(d => d._id),
        invoiceDocumentIds: invDocs.map(d => d._id),
        status: 'insufficient_documents',
        reasonCodes: [],
        summary: `Waiting for: ${missing.join(', ')}.`,
        itemDetails: [],
        totalMatchedItems: 0,
        totalMismatchedItems: 0,
        totalItems: 0,
        poDate: poDocs[0]?.dateISO || null,
        invoiceDate: null,
        invoiceDateAfterPoDate: false,
      },
      { upsert: true, new: true }
    );
  }

  const poTokenList = buildTokenList(poDocs);
  const poCodeSet = new Set(buildQtyMap(poDocs).keys());

  const alignCodes = (docs) => {
    for (const doc of docs) {
      for (const item of doc.items || []) {
        const normCode = normalizeItemCode(item.itemCode);
        if (!poCodeSet.has(normCode)) {
          const poCandidates = [...poCodeSet].filter(
            (code) => code.endsWith(normCode) || normCode.endsWith(code)
          );
          if (poCandidates.length === 1) {
            item.itemCode = poCandidates[0];
            continue;
          }

          const itemTokens = tokenize(item.description);
          let best = null, bestScore = 0;
          for (const { code, tokens } of poTokenList) {
            const s = similarity(itemTokens, tokens);
            if (s > bestScore) { bestScore = s; best = code; }
          }
          if (best && bestScore > 0.6) {
            svcLogger.debug(`Fuzzy aligned "${item.itemCode}" -> "${best}" (score: ${bestScore.toFixed(2)})`);
            item.itemCode = best;
          }
        }
      }
    }
  };

  alignCodes(grnDocs);
  alignCodes(invDocs);

  const poQtyMap = buildQtyMap(poDocs);
  const grnQtyMap = buildQtyMap(grnDocs);
  const invQtyMap = buildQtyMap(invDocs);
  const poPriceMap = buildPriceMap(poDocs);
  const invPriceMap = buildPriceMap(invDocs);
  const invTotalMap = buildTotalAmountMap(invDocs);
  const descMap = buildDescMap([...poDocs, ...grnDocs, ...invDocs]);

  const poDate = poDocs[0]?.dateISO || null;
  const latestInvDate = invDocs
    .map(d => d.dateISO)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0] || null;

  let invoiceDateAfterPo = false;
  if (poDate && latestInvDate) {
    if (new Date(latestInvDate) > new Date(poDate)) {
      invoiceDateAfterPo = true;
      topReasons.push(REASON.INVOICE_DATE_AFTER_PO);
      svcLogger.warn(`Date issue: Invoice date ${latestInvDate} > PO date ${poDate}`);
    }
  }

  const allCodes = new Set([
    ...poQtyMap.keys(),
    ...grnQtyMap.keys(),
    ...invQtyMap.keys(),
  ]);

  const itemDetails = [];
  let matched = 0, mismatched = 0;

  for (const code of allCodes) {
    const poQty = poQtyMap.get(code) || 0;
    const grnQty = grnQtyMap.get(code) || 0;
    const invQty = invQtyMap.get(code) || 0;
    const poPrice = poPriceMap.get(code) ?? null;
    const invPrice = invPriceMap.get(code) ?? null;
    const invTotal = invTotalMap.get(code) ?? null;
    const desc = descMap.get(code) || '';

    const reasons = [];
    const discrepancies = [];

    if (poQty === 0) {
      reasons.push(REASON.ITEM_MISSING_IN_PO);
      discrepancies.push(`Item ${code} not found in PO (GRN: ${grnQty}, Invoice: ${invQty})`);
    } else {
      if (grnQty > poQty) {
        reasons.push(REASON.GRN_QTY_EXCEEDS_PO);
        discrepancies.push(`GRN qty (${grnQty}) exceeds PO qty (${poQty})`);
      }
      if (invQty > poQty) {
        reasons.push(REASON.INVOICE_QTY_EXCEEDS_PO);
        discrepancies.push(`Invoice qty (${invQty}) exceeds PO qty (${poQty})`);
      }
      if (invQty > grnQty) {
        reasons.push(REASON.INVOICE_QTY_EXCEEDS_GRN);
        discrepancies.push(`Invoice qty (${invQty}) exceeds GRN qty (${grnQty})`);
      }

      if (poPrice != null && invPrice != null && Math.abs(poPrice - invPrice) > 0.05) {
        reasons.push(REASON.PRICE_MISMATCH);
        discrepancies.push(`Invoice price (${invPrice}) != PO price (${poPrice})`);
      }

      if (invTotal != null && invPrice != null && invQty > 0) {
        const expectedBase = invQty * invPrice;
        const diffRatio = Math.abs(invTotal - expectedBase) / expectedBase;

        if (Math.abs(invTotal - expectedBase) > 0.05 && diffRatio > 0.06) {
          reasons.push(REASON.TOTAL_AMOUNT_MISMATCH);
          discrepancies.push(`Invoice total (${invTotal}) != qty(${invQty}) * price(${invPrice}) = ${expectedBase} (outside 6% tax tolerance)`);
        }
      }
    }

    const ok = reasons.length === 0;
    if (ok) matched++;
    else mismatched++;

    itemDetails.push({
      itemCode: code,
      description: desc,
      poQty, grnQty, invoiceQty: invQty,
      poUnitPrice: poPrice,
      invoiceUnitPrice: invPrice,
      invoiceTotalAmount: invTotal,
      isMatched: ok,
      reasonCodes: reasons,
      discrepancies,
    });
  }

  const total = allCodes.size;
  let status;
  const hasIssues = mismatched > 0 || invoiceDateAfterPo;

  if (!hasIssues) {
    status = 'matched';
  } else if (matched > 0 && mismatched > 0) {
    status = 'partially_matched';
  } else {
    status = 'mismatch';
  }

  for (const item of itemDetails) {
    for (const r of item.reasonCodes) {
      if (!topReasons.includes(r)) topReasons.push(r);
    }
  }

  const summary = buildSummary(status, matched, mismatched, total, topReasons);

  const result = await MatchResult.findOneAndUpdate(
    { poNumber },
    {
      poDocumentIds: poDocs.map(d => d._id),
      grnDocumentIds: grnDocs.map(d => d._id),
      invoiceDocumentIds: invDocs.map(d => d._id),
      status,
      reasonCodes: topReasons,
      summary,
      poDate,
      invoiceDate: latestInvDate,
      invoiceDateAfterPoDate: invoiceDateAfterPo,
      itemDetails,
      totalMatchedItems: matched,
      totalMismatchedItems: mismatched,
      totalItems: total,
    },
    { upsert: true, new: true }
  );

  svcLogger.info(`Match done for ${poNumber}: ${status} (${matched}/${total} matched)`);
  return result;
};

const buildSummary = (status, matched, mismatched, total, reasons) => {
  const parts = [`Status: ${status.toUpperCase()}.`];

  if (reasons.includes(REASON.DUPLICATE_PO)) {
    parts.push('Multiple PO documents detected.');
    return parts.join(' ');
  }

  if (reasons.includes(REASON.INVOICE_DATE_AFTER_PO)) {
    parts.push('Invoice date is after PO date.');
  }

  if (reasons.includes(REASON.PRICE_MISMATCH)) {
    parts.push('Price discrepancy detected between PO and Invoice.');
  }

  parts.push(`${matched} of ${total} item(s) matched.`);
  if (mismatched > 0) parts.push(`${mismatched} item(s) have discrepancies.`);

  return parts.join(' ');
};

export default { runMatch };
