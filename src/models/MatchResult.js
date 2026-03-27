import mongoose from 'mongoose';

const itemMatchDetailSchema = new mongoose.Schema(
  {
    itemCode: { type: String, required: true },
    description: { type: String, default: '' },
    poQty: { type: Number, default: 0 },
    grnQty: { type: Number, default: 0 },
    invoiceQty: { type: Number, default: 0 },
    poUnitPrice: { type: Number, default: null },
    invoiceUnitPrice: { type: Number, default: null },
    invoiceTotalAmount: { type: Number, default: null },
    isMatched: { type: Boolean, default: false },
    reasonCodes: { type: [String], default: [] },
    discrepancies: { type: [String], default: [] },
  },
  { _id: false }
);

const matchResultSchema = new mongoose.Schema(
  {
    poNumber: { type: String, required: true, unique: true, index: true },
    poDocumentIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Document', default: [] },
    grnDocumentIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Document', default: [] },
    invoiceDocumentIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Document', default: [] },
    status: {
      type: String,
      enum: ['matched', 'partially_matched', 'mismatch', 'insufficient_documents', 'duplicate_po'],
      default: 'insufficient_documents',
    },
    reasonCodes: { type: [String], default: [] },
    summary: { type: String, default: '' },
    invoiceDateAfterPoDate: { type: Boolean, default: false },
    poDate: { type: Date, default: null },
    invoiceDate: { type: Date, default: null },
    itemDetails: { type: [itemMatchDetailSchema], default: [] },
    totalMatchedItems: { type: Number, default: 0 },
    totalMismatchedItems: { type: Number, default: 0 },
    totalItems: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const MatchResult = mongoose.model('MatchResult', matchResultSchema);
export default MatchResult;
