# 🔀 Three-Way Match Engine

A high-performance **Three-Way Match Engine** for automated reconciliation of **Purchase Orders (PO)**, **Goods Receipt Notes (GRN)**, and **Invoices**. Built with **Node.js**, **Express**, **MongoDB**, and **Google Gemini API** for intelligent document extraction.

---

## 📑 Table of Contents

- [Architecture](#architecture)
- [Match Logic Flow](#match-logic-flow)
- [Database Schema](#database-schema)
- [Handling Out-of-Order Uploads](#handling-out-of-order-uploads)
- [API Documentation](#api-documentation)
- [Setup & Installation](#setup--installation)

---

## 🏗️ Architecture

```
three-way-match-engine/
├── server.js                          # Express entry point
├── package.json
├── .env.example                       # Environment template
├── .env                               # Your local config (not committed)
├── src/
│   ├── config/
│   │   └── db.js                      # MongoDB connection
│   ├── controllers/
│   │   ├── documentController.js      # Upload, list, get, delete documents
│   │   └── matchController.js         # Match results & re-evaluation
│   ├── middleware/
│   │   └── errorHandler.js            # Global error middleware
│   ├── models/
│   │   ├── Document.js                # Mongoose schema for extracted docs
│   │   └── MatchResult.js             # Mongoose schema for match outcomes
│   ├── routes/
│   │   ├── documentRoutes.js          # /api/documents/*
│   │   └── matchRoutes.js             # /api/match/*
│   ├── services/
│   │   ├── ExtractionService.js       # Gemini API OCR/extraction
│   │   └── MatchEngineService.js      # Core three-way match algorithm
│   └── utils/
│       ├── dateUtils.js               # Multi-format date normalization
│       ├── geminiClient.js            # Gemini API client singleton
│       └── logger.js                  # Winston structured logger
```

---

## 🔄 Match Logic Flow

```
Upload Document (PO / GRN / Invoice)
         │
         ▼
┌─────────────────────┐
│  ExtractionService   │ ── Gemini API extracts structured JSON
│  (OCR + Normalize)   │    from the PDF document
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Save to MongoDB     │ ── Document model stores extracted data
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  MatchEngineService.runMatch(poNumber)   │ ◄── TRIGGERED AUTOMATICALLY
│                                          │
│  1. Fetch ALL docs for this PO number    │
│  2. Build Hash Maps (O(1) lookup)        │
│     • PO Map:      itemCode → qty        │
│     • GRN Map:     itemCode → total qty  │
│     • Invoice Map: itemCode → qty        │
│  3. Validate per item:                   │
│     ✓ GRN Qty ≤ PO Qty                  │
│     ✓ Invoice Qty ≤ GRN Qty             │
│     ✓ Invoice Qty ≤ PO Qty              │
│  4. Validate dates:                      │
│     ✓ Invoice Date ≥ PO Date            │
│  5. Determine status:                    │
│     • matched                            │
│     • partially_matched                  │
│     • mismatch                           │
│     • insufficient_documents             │
│  6. Upsert MatchResult                   │
└─────────────────────────────────────────┘
```

### Validation Rules

| # | Rule | Condition | Result on Violation |
|---|------|-----------|-------------------|
| 1 | GRN ≤ PO | `grnQty > poQty` | Discrepancy flagged |
| 2 | Invoice ≤ GRN | `invoiceQty > totalGrnQty` | Discrepancy flagged |
| 3 | Invoice ≤ PO | `invoiceQty > poQty` | Discrepancy flagged |
| 4 | Date Check | `invoiceDate > poDate` | Date mismatch flagged |

### Status Determination

| Status | Condition |
|--------|-----------|
| `matched` | All items pass all rules + valid dates + all 3 doc types present |
| `partially_matched` | Some items match, some have discrepancies |
| `mismatch` | All items have discrepancies OR date validation fails |
| `insufficient_documents` | Missing PO or both GRN and Invoice |

---

## 📊 Database Schema

### Document Collection

| Field | Type | Description |
|-------|------|-------------|
| `poNumber` | String (indexed) | Purchase Order reference |
| `documentType` | Enum: PO, GRN, INVOICE | Type of document |
| `documentNumber` | String | Document's own identifier |
| `vendorName` | String | Vendor/supplier name |
| `date` | Date | Normalized date (ISO) |
| `rawDate` | String | Date exactly as extracted |
| `items` | Array | Embedded item sub-documents |
| `items.itemCode` | String | SKU / material code |
| `items.description` | String | Item name |
| `items.quantity` | Number | Quantity (ordered/received/billed) |
| `originalFilename` | String | Uploaded file name |
| `rawExtraction` | Mixed | Raw Gemini response for debugging |

### MatchResult Collection

| Field | Type | Description |
|-------|------|-------------|
| `poNumber` | String (unique) | PO reference (one result per PO) |
| `status` | Enum | Overall match status |
| `documentsPresent` | Object | `{ po, grn, invoice }` booleans |
| `dateValidation` | Object | PO/Invoice date comparison |
| `itemDetails` | Array | Per-item match results |
| `summary` | Object | Aggregate counts |

---

## 🔃 Handling Out-of-Order Uploads

The engine uses a **Trigger-Based Re-evaluation** strategy:

1. **Any document** can be uploaded in **any order** (Invoice first, GRN second, PO last — works fine).
2. On **every upload**, the system:
   - Extracts the `poNumber` from the document
   - Fetches **all existing documents** with that same `poNumber` from MongoDB
   - Re-runs `MatchEngineService.runMatch()` against the complete set
3. The `MatchResult` is **upserted** (created or updated), so the status always reflects the latest state.
4. On **document deletion**, re-evaluation is triggered again.

**Example scenario:**
```
Upload Invoice → status: insufficient_documents (no PO yet)
Upload PO      → status: partially_matched (no GRN yet, but PO+Invoice compared)
Upload GRN     → status: matched / partially_matched / mismatch (full 3-way evaluation)
```

---

## 📡 API Documentation

### Base URL: `http://localhost:3000`

### Document Endpoints

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| `POST` | `/api/documents/upload` | Upload a PDF document | `multipart/form-data`: `file` (PDF), `documentType` (PO/GRN/INVOICE) |
| `GET` | `/api/documents` | List all documents | Query: `?poNumber=X&documentType=PO` |
| `GET` | `/api/documents/:id` | Get document by ID | — |
| `DELETE` | `/api/documents/:id` | Delete document + re-evaluate | — |

### Match Endpoints

| Method | Endpoint | Description | Query |
|--------|----------|-------------|-------|
| `GET` | `/api/match` | List all match results | `?status=matched` |
| `GET` | `/api/match/:poNumber` | Get match result for a PO | — |
| `POST` | `/api/match/:poNumber/re-evaluate` | Force re-evaluation | — |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Server status |

### Example: Upload a Document (cURL)

```bash
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@./PO.pdf" \
  -F "documentType=PO"
```

### Example Response

```json
{
  "success": true,
  "data": {
    "document": {
      "_id": "...",
      "poNumber": "CI4PO05788",
      "documentType": "PO",
      "vendorName": "M/s AFP",
      "items": [
        { "itemCode": "11423", "description": "psm Cheesy Spicy Veg Momos", "quantity": 50 }
      ]
    },
    "matchResult": {
      "poNumber": "CI4PO05788",
      "status": "insufficient_documents",
      "documentsPresent": { "po": true, "grn": false, "invoice": false }
    }
  }
}
```

---

## 🚀 Setup & Installation

### Prerequisites

- **Node.js** v18+
- **MongoDB** running locally (default: `mongodb://localhost:27017`)
- **Google Gemini API Key** ([Get one here](https://aistudio.google.com/app/apikey))

### Steps

```bash
# 1. Clone / navigate to the project
cd "3 way machine"

# 2. Install dependencies
npm install

# 3. Configure environment
#    Open .env and replace YOUR_GEMINI_API_KEY_HERE with your actual key
#    File location: .env (in project root)

# 4. Start MongoDB (if not already running)
mongod

# 5. Start the server
npm run dev
```

### Where to Add Your Gemini API Key

Open the **`.env`** file in the project root and set:

```env
GEMINI_API_KEY=your_actual_api_key_here
```

The key is used in `src/utils/geminiClient.js` which auto-initializes on first document upload.

---

## 🛠️ Technical Highlights

- **O(1) Hash Map Matching** — Items are indexed by `itemCode` for constant-time lookups instead of nested loops
- **Multi-GRN Aggregation** — Quantities across multiple GRN documents are summed per item code
- **Winston Logging** — Structured logs with timestamps, service context, and file output
- **Global Error Handling** — Multer, Mongoose, and Gemini errors all caught gracefully
- **ES6+ Modules** — Modern `import/export` syntax throughout
- **Auto Date Normalization** — Handles `DD-MM-YYYY`, `MM/DD/YYYY`, `Mar 17, 2026`, ISO, and more
- **Confidence Scoring** — Gemini extraction includes a 0-1 confidence score per field and item, which is stored in the database for auditing and review of low-confidence extractions.

### ⏱️ Performance Benchmark & Algorithmic Complexity

The core matching algorithm `MatchEngineService.runMatch()` is highly optimized for performance, especially when dealing with large procurement documents containing thousands of line items.

#### Time Complexity: $O(N)$
- **Building Hash Maps**: We iterate through each item in the PO, GRN, and Invoice documents exactly once to build the `qtyMap` and `descMap`. If $N$ is the total number of items across all three documents, map construction takes $O(N)$ time.
- **Matching Logic**: We create a `Set` of all unique item codes across the hash maps, and iterate through this set exactly once. For each item, lookups in the hash maps are $O(1)$. Therefore, the matching phase takes $O(U)$ time, where $U$ is the number of unique items ($U \le N$).
- **Overall Time Complexity**: $O(N) + O(U) = \mathbf{O(N)}$

#### Space Complexity: $O(U)$
- We store the aggregated quantities and descriptions in hash maps, and unique keys in a Set. In the worst-case scenario where there are no overlapping items between the documents, the number of entries scales linearly with $N$.
- **Overall Space Complexity**: $\mathbf{O(U)}$ where $U$ is the number of unique items.

*Note: Database queries are indexed on `poNumber` and `documentType`, making retrieval extremely fast before the matching logic even begins.*

---

## 📋 Assignment Deliverables Checklist

✅ **Three API Endpoints Implemented:**
- `POST /api/documents/upload` — Upload and extract PO/GRN/Invoice from PDF
- `GET /api/match/:poNumber` — Retrieve three-way match result for a PO
- `POST /api/match/:poNumber/re-evaluate` — Force re-evaluation after document changes

✅ **Six Matching Rules Enforced:**
1. GRN Quantity ≤ PO Quantity (flagged: `grn_qty_exceeds_po_qty`)
2. Invoice Quantity ≤ GRN Quantity (flagged: `invoice_qty_exceeds_grn_qty`)
3. Invoice Quantity ≤ PO Quantity (flagged: `invoice_qty_exceeds_po_qty`)
4. Invoice Date ≥ PO Date (flagged: `invoice_date_after_po_date`)
5. Duplicate PO Detection (flagged: `duplicate_po`)
6. Missing Items (flagged: `item_missing_in_po`)

✅ **Four Match Statuses:**
- `matched` — All items & dates pass validation
- `partially_matched` — Some items match, some discrepancies
- `mismatch` — All items or dates fail validation
- `insufficient_documents` — Missing required documents

✅ **Out-of-Order Arrival Support:**
- Documents can be uploaded in **any sequence** (Invoice → GRN → PO works)
- Match status updates **dynamically** on each upload
- See [Handling Out-of-Order Uploads](#handling-out-of-order-uploads) section

✅ **OpenAPI/Swagger Documentation:**
- Complete endpoint specs in `openapi.yaml`
- Runnable with Swagger UI at [Swagger Editor](https://editor.swagger.io/)

✅ **Real-World Test Outputs:**
- Sample extracted documents stored in root directory
- Full match result with reason codes and item-level discrepancies

---

## 📊 Example Outputs from Real PDFs

The following examples were generated by running the three-way match engine against real procurement documents (PO: CI4PO05788).

### Sample PO Extraction (`sample_po_extracted.json`)
```json
{
  "documentType": "PO",
  "poNumber": "CI4PO05788",
  "vendorName": "M/s AFP",
  "date": "Mar 17, 2026",
  "items": [
    {
      "itemCode": "11423",
      "description": "psm Cheesy Spicy Veg Momos 24.0 Pieces",
      "quantity": 50,
      "unitPrice": 220.762,
      "totalAmount": 11590
    },
    {
      "itemCode": "11797",
      "description": "Meatigo Hot Wings 250.0 g",
      "quantity": 75,
      "unitPrice": 126.667,
      "totalAmount": 9975
    }
  ]
}
```

### Sample Match Result (`sample_match_extracted.json`)
**Status: `partially_matched`** (38 of 40 items matched)

```json
{
  "poNumber": "CI4PO05788",
  "status": "partially_matched",
  "reasonCodes": [
    "invoice_date_after_po_date",
    "invoice_qty_exceeds_po_qty",
    "invoice_qty_exceeds_grn_qty",
    "total_amount_mismatch"
  ],
  "summary": "Status: PARTIALLY_MATCHED. Invoice date is after PO date. 38 of 40 item(s) matched. 2 item(s) have discrepancies.",
  "totalItems": 40,
  "totalMatchedItems": 38,
  "totalMismatchedItems": 2,
  "itemDetails": [
    {
      "itemCode": "11423",
      "description": "psm Cheesy Spicy Veg Momos 24.0 Pieces",
      "poQty": 50,
      "grnQty": 50,
      "invoiceQty": 50,
      "isMatched": true,
      "reasonCodes": []
    },
    {
      "itemCode": "33387",
      "description": "psm Frozen Chicken Chilli Salami 200.0 g",
      "poQty": 75,
      "grnQty": 75,
      "invoiceQty": 100,
      "isMatched": false,
      "reasonCodes": [
        "invoice_qty_exceeds_po_qty",
        "invoice_qty_exceeds_grn_qty",
        "total_amount_mismatch"
      ],
      "discrepancies": [
        "Invoice qty (100) exceeds PO qty (75)",
        "Invoice qty (100) exceeds GRN qty (75)",
        "Invoice total (13585.16) != qty(100) * price(126.67) = 12667 (outside 6% tax tolerance)"
      ]
    }
  ]
}
```

### Key Findings
- **Total Items:** 40
- **Matched:** 38 ✓
- **Mismatched:** 2 ✗
  - Item code **33387** (Invoice qty 100 exceeds PO/GRN qty 75)
  - Item code **398656** (Invoice qty 630 exceeds PO/GRN qty 270)
- **Date Violation:** Invoice date after PO date
- **Total Amount Mismatch:** Detected on 2 items with amount inconsistencies beyond 6% tax tolerance

---

## 🧪 Running Tests

```bash
# Run the full test suite (17 tests covering all rules)
npm test

# Expected output:
# ✓ test_create_simple_match
# ✓ test_grn_qty_exceeds_po
# ✓ test_invoice_qty_exceeds_po
# ✓ test_invoice_qty_exceeds_grn
# ✓ test_invoice_date_after_po_date
# ✓ test_out_of_order_upload_sequence
# ... and 11 more
```

---

## 🧑‍💻 Testing with Your Own PDFs

```bash
# Start the server
npm run dev

# In another terminal, upload your documents in any order
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@./Invoice.pdf" \
  -F "documentType=INVOICE"

curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@./PO.pdf" \
  -F "documentType=PO"

curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@./GRN.pdf" \
  -F "documentType=GRN"

# Retrieve the three-way match result
curl http://localhost:3000/api/match/YOUR_PO_NUMBER
```

---

## 🤖 Technical Stack

- **Backend:** Node.js 18+ with Express.js
- **Database:** MongoDB (with in-memory fallback for testing)
- **PDF Extraction:** Google Gemini 2.5-Flash API
- **Logging:** Winston with file & console transports
- **Testing:** Node native test runner (no external framework)
- **Documentation:** OpenAPI 3.0.3 (Swagger compatible)

---

## 📝 License

This project is part of a competitive three-way match engine evaluation. All rights reserved.
