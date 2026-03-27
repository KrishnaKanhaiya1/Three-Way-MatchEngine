import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema(
  {
    itemCode: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, default: null },
    totalAmount: { type: Number, default: null },
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema(
  {
    documentType: {
      type: String,
      required: true,
      enum: ['PO', 'GRN', 'INVOICE'],
      uppercase: true,
    },
    poNumber: { type: String, required: true, trim: true, index: true },
    documentNumber: { type: String, required: true, trim: true },
    vendorName: { type: String, default: '' },
    date: { type: String, default: null },
    dateISO: { type: Date, default: null },
    items: { type: [itemSchema], default: [] },
    originalFileName: { type: String, default: '' },
    filePath: { type: String, default: '' },
    mimeType: { type: String, default: 'application/pdf' },
    extractionConfidence: { type: Number, default: null },
    rawExtraction: { type: mongoose.Schema.Types.Mixed, default: null },
    fileHash: { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

documentSchema.index(
  { documentNumber: 1, poNumber: 1, documentType: 1 },
  { unique: true, name: 'unique_document' }
);

documentSchema.index({ vendorName: 'text', 'items.description': 'text' });

const Document = mongoose.model('Document', documentSchema);
export default Document;
