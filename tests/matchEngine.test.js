import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Document from '../src/models/Document.js';
import MatchResult from '../src/models/MatchResult.js';
import MatchEngineService from '../src/services/MatchEngineService.js';

let mongod;

const createDoc = (overrides) =>
  Document.create({
    documentType: 'PO',
    poNumber: 'TEST-PO-001',
    documentNumber: `DOC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    vendorName: 'Test Vendor',
    date: '31-03-2026',
    dateISO: new Date('2026-03-31'),
    items: [],
    ...overrides,
  });

const PO_ITEMS = [
  { itemCode: 'ITEM-001', description: 'Widget A', quantity: 10, unitPrice: 100 },
  { itemCode: 'ITEM-002', description: 'Widget B', quantity: 5, unitPrice: 200 },
];

describe('MatchEngineService', () => {
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await Document.deleteMany({});
    await MatchResult.deleteMany({});
  });

  // 1. All items matched (qty + price)
  it('should return "matched" when all documents agree', async () => {
    await createDoc({ documentType: 'PO', items: PO_ITEMS });
    await createDoc({
      documentType: 'GRN',
      documentNumber: 'GRN-001',
      items: [
        { itemCode: 'ITEM-001', description: 'Widget A', quantity: 10 },
        { itemCode: 'ITEM-002', description: 'Widget B', quantity: 5 },
      ],
      dateISO: new Date('2026-03-20'),
    });
    await createDoc({
      documentType: 'INVOICE',
      documentNumber: 'INV-001',
      items: [
        { itemCode: 'ITEM-001', description: 'Widget A', quantity: 10, unitPrice: 100, totalAmount: 1000 },
        { itemCode: 'ITEM-002', description: 'Widget B', quantity: 5, unitPrice: 200, totalAmount: 1000 },
      ],
      dateISO: new Date('2026-03-24'),
    });

    const result = await MatchEngineService.runMatch('TEST-PO-001');
    assert.equal(result.status, 'matched');
    assert.equal(result.totalMatchedItems, 2);
    assert.equal(result.totalMismatchedItems, 0);
  });

  // 2. GRN qty exceeds PO qty
  it('should flag grn_qty_exceeds_po_qty', async () => {
    await createDoc({ documentType: 'PO', items: PO_ITEMS });
    await createDoc({
      documentType: 'GRN',
      documentNumber: 'GRN-002',
      items: [
        { itemCode: 'ITEM-001', description: 'Widget A', quantity: 15 },
        { itemCode: 'ITEM-002', description: 'Widget B', quantity: 5 },
      ],
      dateISO: new Date('2026-03-20'),
    });
    await createDoc({
      documentType: 'INVOICE',
      documentNumber: 'INV-002',
      items: [
        { itemCode: 'ITEM-001', description: 'Widget A', quantity: 10, unitPrice: 100, totalAmount: 1000 },
        { itemCode: 'ITEM-002', description: 'Widget B', quantity: 5, unitPrice: 200, totalAmount: 1000 },
      ],
      dateISO: new Date('2026-03-24'),
    });

    const result = await MatchEngineService.runMatch('TEST-PO-001');
    assert.notEqual(result.status, 'matched');
    const item1 = result.itemDetails.find(i => i.itemCode === 'ITEM-001');
    assert.ok(item1.reasonCodes.includes('grn_qty_exceeds_po_qty'));
  });

  // 3. Invoice qty exceeds PO qty
  it('should flag invoice_qty_exceeds_po_qty', async () => {
    await createDoc({ documentType: 'PO', items: PO_ITEMS });
    await createDoc({
      documentType: 'GRN',
      documentNumber: 'GRN-003',
      items: [
        { itemCode: 'ITEM-001', description: 'Widget A', quantity: 10 },
        { itemCode: 'ITEM-002', description: 'Widget B', quantity: 5 },
      ],
      dateISO: new Date('2026-03-20'),
    });
    await createDoc({
      documentType: 'INVOICE',
      documentNumber: 'INV-003',
      items: [
        { itemCode: 'ITEM-001', description: 'Widget A', quantity: 10, unitPrice: 100, totalAmount: 1000 },
        { itemCode: 'ITEM-002', description: 'Widget B', quantity: 8, unitPrice: 200, totalAmount: 1600 },
      ],
      dateISO: new Date('2026-03-24'),
    });

    const result = await MatchEngineService.runMatch('TEST-PO-001');
    const item2 = result.itemDetails.find(i => i.itemCode === 'ITEM-002');
    assert.ok(item2.reasonCodes.includes('invoice_qty_exceeds_po_qty'));
  });

  // 4. Invoice qty exceeds GRN qty
  it('should flag invoice_qty_exceeds_grn_qty', async () => {
    await createDoc({ documentType: 'PO', items: PO_ITEMS });
    await createDoc({
      documentType: 'GRN',
      documentNumber: 'GRN-004',
      items: [
        { itemCode: 'ITEM-001', description: 'Widget A', quantity: 7 },
        { itemCode: 'ITEM-002', description: 'Widget B', quantity: 5 },
      ],
      dateISO: new Date('2026-03-20'),
    });
    await createDoc({
      documentType: 'INVOICE',
      documentNumber: 'INV-004',
      items: [
        { itemCode: 'ITEM-001', description: 'Widget A', quantity: 10, unitPrice: 100, totalAmount: 1000 },
        { itemCode: 'ITEM-002', description: 'Widget B', quantity: 5, unitPrice: 200, totalAmount: 1000 },
      ],
      dateISO: new Date('2026-03-24'),
    });

    const result = await MatchEngineService.runMatch('TEST-PO-001');
    const item1 = result.itemDetails.find(i => i.itemCode === 'ITEM-001');
    assert.ok(item1.reasonCodes.includes('invoice_qty_exceeds_grn_qty'));
  });

  // 5. Item missing in PO
  it('should flag item_missing_in_po for extra items', async () => {
    await createDoc({ documentType: 'PO', items: PO_ITEMS });
    await createDoc({
      documentType: 'GRN',
      documentNumber: 'GRN-005',
      items: [
        ...PO_ITEMS.map(i => ({ itemCode: i.itemCode, description: i.description, quantity: i.quantity })),
        { itemCode: 'ITEM-EXTRA', description: 'Unrequested Widget', quantity: 3 },
      ],
      dateISO: new Date('2026-03-20'),
    });
    await createDoc({
      documentType: 'INVOICE',
      documentNumber: 'INV-005',
      items: PO_ITEMS.map(i => ({ ...i, totalAmount: i.quantity * i.unitPrice })),
      dateISO: new Date('2026-03-24'),
    });

    const result = await MatchEngineService.runMatch('TEST-PO-001');
    const extra = result.itemDetails.find(i => i.itemCode === 'ITEM-EXTRA');
    assert.ok(extra);
    assert.ok(extra.reasonCodes.includes('item_missing_in_po'));
  });

  // 6. Invoice date after PO date
  it('should flag when invoice date is after PO date', async () => {
    await createDoc({ documentType: 'PO', items: PO_ITEMS });
    await createDoc({
      documentType: 'GRN',
      documentNumber: 'GRN-006',
      items: PO_ITEMS.map(i => ({ itemCode: i.itemCode, description: i.description, quantity: i.quantity })),
      dateISO: new Date('2026-03-20'),
    });
    await createDoc({
      documentType: 'INVOICE',
      documentNumber: 'INV-006',
      items: PO_ITEMS.map(i => ({ ...i, totalAmount: i.quantity * i.unitPrice })),
      dateISO: new Date('2026-04-02'), // AFTER PO date
    });

    const result = await MatchEngineService.runMatch('TEST-PO-001');
    assert.ok(result.reasonCodes.includes('invoice_date_after_po_date'));
    assert.equal(result.invoiceDateAfterPoDate, true);
  });

  // 7. Invoice date before PO date should NOT flag
  it('should NOT flag when invoice date is before PO date', async () => {
    await createDoc({ documentType: 'PO', items: PO_ITEMS });
    await createDoc({
      documentType: 'GRN',
      documentNumber: 'GRN-007',
      items: PO_ITEMS.map(i => ({ itemCode: i.itemCode, description: i.description, quantity: i.quantity })),
      dateISO: new Date('2026-03-20'),
    });
    await createDoc({
      documentType: 'INVOICE',
      documentNumber: 'INV-007',
      items: PO_ITEMS.map(i => ({ ...i, totalAmount: i.quantity * i.unitPrice })),
      dateISO: new Date('2026-03-10'),
    });

    const result = await MatchEngineService.runMatch('TEST-PO-001');
    assert.equal(result.invoiceDateAfterPoDate, false);
  });

  // 8. Duplicate PO
  it('should return duplicate_po when multiple POs exist', async () => {
    await createDoc({ documentType: 'PO', documentNumber: 'PO-A', items: PO_ITEMS });
    await createDoc({ documentType: 'PO', documentNumber: 'PO-B', items: PO_ITEMS });

    const result = await MatchEngineService.runMatch('TEST-PO-001');
    assert.equal(result.status, 'duplicate_po');
    assert.ok(result.reasonCodes.includes('duplicate_po'));
  });

  // 9. Insufficient documents
  it('should return insufficient_documents when only PO is present', async () => {
    await createDoc({ documentType: 'PO', items: PO_ITEMS });
    const result = await MatchEngineService.runMatch('TEST-PO-001');
    assert.equal(result.status, 'insufficient_documents');
  });

  // 9b. Out-of-order arrival should still converge to correct latest state
  it('should handle out-of-order documents (Invoice -> GRN -> PO)', async () => {
    await createDoc({
      documentType: 'INVOICE',
      documentNumber: 'INV-OOO-1',
      items: PO_ITEMS.map(i => ({ ...i, totalAmount: i.quantity * i.unitPrice })),
      dateISO: new Date('2026-03-10'),
    });

    let result = await MatchEngineService.runMatch('TEST-PO-001');
    assert.equal(result.status, 'insufficient_documents');

    await createDoc({
      documentType: 'GRN',
      documentNumber: 'GRN-OOO-1',
      items: PO_ITEMS.map(i => ({ itemCode: i.itemCode, description: i.description, quantity: i.quantity })),
      dateISO: new Date('2026-03-12'),
    });

    result = await MatchEngineService.runMatch('TEST-PO-001');
    assert.equal(result.status, 'insufficient_documents');

    await createDoc({
      documentType: 'PO',
      documentNumber: 'PO-OOO-1',
      items: PO_ITEMS,
      dateISO: new Date('2026-03-31'),
    });

    result = await MatchEngineService.runMatch('TEST-PO-001');
    assert.equal(result.status, 'matched');
  });

  // 10. Partially matched
  it('should return partially_matched when some items match and others do not', async () => {
    await createDoc({ documentType: 'PO', items: PO_ITEMS });
    await createDoc({
      documentType: 'GRN',
      documentNumber: 'GRN-010',
      items: [
        { itemCode: 'ITEM-001', description: 'Widget A', quantity: 10 },
        { itemCode: 'ITEM-002', description: 'Widget B', quantity: 3 },
      ],
      dateISO: new Date('2026-03-20'),
    });
    await createDoc({
      documentType: 'INVOICE',
      documentNumber: 'INV-010',
      items: [
        { itemCode: 'ITEM-001', description: 'Widget A', quantity: 10, unitPrice: 100, totalAmount: 1000 },
        { itemCode: 'ITEM-002', description: 'Widget B', quantity: 5, unitPrice: 200, totalAmount: 1000 },
      ],
      dateISO: new Date('2026-03-24'),
    });

    const result = await MatchEngineService.runMatch('TEST-PO-001');
    assert.equal(result.status, 'partially_matched');
    assert.equal(result.totalMatchedItems, 1);
    assert.equal(result.totalMismatchedItems, 1);
  });

  // 11. No documents
  it('should return null when no documents exist', async () => {
    const result = await MatchEngineService.runMatch('NONEXISTENT-PO');
    assert.equal(result, null);
  });

  // 12. Multiple GRNs aggregate quantities
  it('should aggregate quantities across multiple GRNs', async () => {
    await createDoc({ documentType: 'PO', items: PO_ITEMS });
    await createDoc({
      documentType: 'GRN',
      documentNumber: 'GRN-012A',
      items: [
        { itemCode: 'ITEM-001', description: 'Widget A', quantity: 6 },
        { itemCode: 'ITEM-002', description: 'Widget B', quantity: 3 },
      ],
      dateISO: new Date('2026-03-20'),
    });
    await createDoc({
      documentType: 'GRN',
      documentNumber: 'GRN-012B',
      items: [
        { itemCode: 'ITEM-001', description: 'Widget A', quantity: 4 },
        { itemCode: 'ITEM-002', description: 'Widget B', quantity: 2 },
      ],
      dateISO: new Date('2026-03-21'),
    });
    await createDoc({
      documentType: 'INVOICE',
      documentNumber: 'INV-012',
      items: [
        { itemCode: 'ITEM-001', description: 'Widget A', quantity: 10, unitPrice: 100, totalAmount: 1000 },
        { itemCode: 'ITEM-002', description: 'Widget B', quantity: 5, unitPrice: 200, totalAmount: 1000 },
      ],
      dateISO: new Date('2026-03-24'),
    });

    const result = await MatchEngineService.runMatch('TEST-PO-001');
    assert.equal(result.status, 'matched');
    assert.equal(result.totalMatchedItems, 2);
  });

  // 13. Multiple Invoices aggregate
  it('should aggregate quantities across multiple Invoices', async () => {
    await createDoc({ documentType: 'PO', items: PO_ITEMS });
    await createDoc({
      documentType: 'GRN',
      documentNumber: 'GRN-013',
      items: PO_ITEMS.map(i => ({ itemCode: i.itemCode, description: i.description, quantity: i.quantity })),
      dateISO: new Date('2026-03-20'),
    });
    await createDoc({
      documentType: 'INVOICE',
      documentNumber: 'INV-013A',
      items: [
        { itemCode: 'ITEM-001', description: 'Widget A', quantity: 5, unitPrice: 100, totalAmount: 500 },
        { itemCode: 'ITEM-002', description: 'Widget B', quantity: 3, unitPrice: 200, totalAmount: 600 },
      ],
      dateISO: new Date('2026-03-24'),
    });
    await createDoc({
      documentType: 'INVOICE',
      documentNumber: 'INV-013B',
      items: [
        { itemCode: 'ITEM-001', description: 'Widget A', quantity: 5, unitPrice: 100, totalAmount: 500 },
        { itemCode: 'ITEM-002', description: 'Widget B', quantity: 2, unitPrice: 200, totalAmount: 400 },
      ],
      dateISO: new Date('2026-03-25'),
    });

    const result = await MatchEngineService.runMatch('TEST-PO-001');
    assert.equal(result.status, 'matched');
    assert.equal(result.totalMatchedItems, 2);
  });

  // 14. Price mismatch between PO and Invoice
  it('should flag price_mismatch_po_invoice when prices differ', async () => {
    await createDoc({ documentType: 'PO', items: PO_ITEMS });
    await createDoc({
      documentType: 'GRN',
      documentNumber: 'GRN-014',
      items: PO_ITEMS.map(i => ({ itemCode: i.itemCode, description: i.description, quantity: i.quantity })),
      dateISO: new Date('2026-03-20'),
    });
    await createDoc({
      documentType: 'INVOICE',
      documentNumber: 'INV-014',
      items: [
        { itemCode: 'ITEM-001', description: 'Widget A', quantity: 10, unitPrice: 120, totalAmount: 1200 }, // price differs
        { itemCode: 'ITEM-002', description: 'Widget B', quantity: 5, unitPrice: 200, totalAmount: 1000 },
      ],
      dateISO: new Date('2026-03-24'),
    });

    const result = await MatchEngineService.runMatch('TEST-PO-001');
    assert.notEqual(result.status, 'matched');
    const item1 = result.itemDetails.find(i => i.itemCode === 'ITEM-001');
    assert.ok(item1.reasonCodes.includes('price_mismatch_po_invoice'));
    assert.equal(item1.poUnitPrice, 100);
    assert.equal(item1.invoiceUnitPrice, 120);

    // Item 2 should match (price same)
    const item2 = result.itemDetails.find(i => i.itemCode === 'ITEM-002');
    assert.equal(item2.isMatched, true);
  });

  // 15. Total amount mismatch
  it('should flag total_amount_mismatch when totalAmount != qty * unitPrice', async () => {
    await createDoc({ documentType: 'PO', items: PO_ITEMS });
    await createDoc({
      documentType: 'GRN',
      documentNumber: 'GRN-015',
      items: PO_ITEMS.map(i => ({ itemCode: i.itemCode, description: i.description, quantity: i.quantity })),
      dateISO: new Date('2026-03-20'),
    });
    await createDoc({
      documentType: 'INVOICE',
      documentNumber: 'INV-015',
      items: [
        { itemCode: 'ITEM-001', description: 'Widget A', quantity: 10, unitPrice: 100, totalAmount: 1500 }, // wrong
        { itemCode: 'ITEM-002', description: 'Widget B', quantity: 5, unitPrice: 200, totalAmount: 1000 },
      ],
      dateISO: new Date('2026-03-24'),
    });

    const result = await MatchEngineService.runMatch('TEST-PO-001');
    const item1 = result.itemDetails.find(i => i.itemCode === 'ITEM-001');
    assert.ok(item1.reasonCodes.includes('total_amount_mismatch'));
  });

  // 16. Prices match when they agree
  it('should NOT flag price mismatch when prices match exactly', async () => {
    await createDoc({ documentType: 'PO', items: PO_ITEMS });
    await createDoc({
      documentType: 'GRN',
      documentNumber: 'GRN-016',
      items: PO_ITEMS.map(i => ({ itemCode: i.itemCode, description: i.description, quantity: i.quantity })),
      dateISO: new Date('2026-03-20'),
    });
    await createDoc({
      documentType: 'INVOICE',
      documentNumber: 'INV-016',
      items: [
        { itemCode: 'ITEM-001', description: 'Widget A', quantity: 10, unitPrice: 100, totalAmount: 1000 },
        { itemCode: 'ITEM-002', description: 'Widget B', quantity: 5, unitPrice: 200, totalAmount: 1000 },
      ],
      dateISO: new Date('2026-03-24'),
    });

    const result = await MatchEngineService.runMatch('TEST-PO-001');
    assert.equal(result.status, 'matched');
    for (const item of result.itemDetails) {
      assert.ok(!item.reasonCodes.includes('price_mismatch_po_invoice'));
      assert.ok(!item.reasonCodes.includes('total_amount_mismatch'));
    }
  });
});
