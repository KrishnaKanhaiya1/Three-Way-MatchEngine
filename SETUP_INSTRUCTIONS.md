# Setup Instructions for Evaluators

## ✅ Deliverables Checklist

### 1. Working Code (Backend Project)
- ✓ `server.js` - Express entry point
- ✓ `package.json` - Dependencies and scripts
- ✓ `src/` - Complete source code
  - `controllers/` - API endpoint handlers
  - `services/` - Business logic (MatchEngine, Extraction)
  - `models/` - MongoDB schemas
  - `routes/` - API routing
  - `middleware/` - Error handling
  - `utils/` - Helper functions, Gemini client, logging

### 2. README.md - Complete Documentation
Includes all required sections:
- ✓ Approach & Design (strategy, parsing, algorithm)
- ✓ Data Model (database schema) 
- ✓ Parsing Method (Gemini extraction, multi-format dates)
- ✓ Matching Logic (6 rules, O(N) complexity)
- ✓ Out-of-Order Upload Handling (trigger-based re-evaluation)
- ✓ Assumptions (6 key assumptions)
- ✓ Tradeoffs (design choices table)
- ✓ Future Improvements (7 potential enhancements)

### 3. API Documentation
- ✓ `openapi.yaml` - Swagger/OpenAPI 3.0.3 spec
  - All 7 endpoints documented
  - Request/response examples included
  - Reason codes documented
  - Can be tested at: https://editor.swagger.io/

### 4. Example Outputs
- ✓ `sample_po_extracted.json` - Sample PO extraction (40 items)
- ✓ `sample_grn_extracted.json` - Sample GRN extraction (31 items)
- ✓ `sample_invoice_extracted.json` - Sample Invoice extraction (31 items)
- ✓ `sample_match_extracted.json` - Complete match result (37/40 matched)

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 18+ installed
- MongoDB running locally (OR will use in-memory fallback)
- Google Gemini API key (get from: https://aistudio.google.com/app/apikey)

### Step 1: Clone Repository
```bash
git clone https://github.com/KrishnaKanhaiya1/Three-Way-MatchEngine.git
cd Three-Way-MatchEngine
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment
Copy the template and add your Gemini API key:
```bash
cp .env.example .env
# Edit .env and set:
# GEMINI_API_KEY=your_api_key_here
```

**Note:** `.env` is git-ignored for security. Only `.env.example` (template) is in the repo.

### Step 4: Start Server
```bash
npm run dev
```

Server will start on: **http://localhost:3000**

---

## 🧪 Testing

### Run Unit Tests
```bash
npm test
```

Expected output:
```
✔ tests 17
✔ pass 17
✔ fail 0
```

All tests pass without dependencies on external APIs.

### Test API Manually

**Upload a Document:**
```bash
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@./your_document.pdf" \
  -F "documentType=PO"
```

**Get Match Result:**
```bash
curl http://localhost:3000/api/match/YOUR_PO_NUMBER
```

---

## 📋 Functionality Verification

### 1. Document Upload
- Upload PO, GRN, or Invoice PDFs
- Gemini API extracts structured data
- Returns: document ID, extracted items, initial match status

### 2. Three-Way Matching
- Automatically triggered after each upload
- Compares items across all 3 document types
- Returns: status, reason codes, per-item details

### 3. Out-of-Order Handling
- Upload Invoice first → status: `insufficient_documents`
- Upload GRN second → status recalculates
- Upload PO third → full 3-way match calculated
- Final status reflects ALL documents combined

### 4. All 6 Matching Rules
- ✓ GRN Qty ≤ PO Qty
- ✓ Invoice Qty ≤ GRN Qty
- ✓ Invoice Qty ≤ PO Qty
- ✓ Invoice Date ≥ PO Date
- ✓ Duplicate PO Detection
- ✓ Missing Items in PO

### 5. Four Match Statuses
- `matched` - All items pass all rules
- `partially_matched` - Some items match, some have discrepancies
- `mismatch` - All items or dates fail validation
- `insufficient_documents` - Missing required documents

---

## 🔒 Security Notes

**API Key Protection:**
- `.env` file is git-ignored (not on GitHub)
- Only `.env.example` with placeholder is in repo
- Real API key stays on your local machine only

**No Exposed Credentials:**
- MongoDB connection string in `.env.example` uses local default
- All sensitive data is in `.env` (not committed)

---

## 📊 Example Workflow

1. **Start Server:**
   ```bash
   npm run dev
   ```

2. **Upload 3 Documents (any order):**
   ```bash
   curl -F "file=@PO.pdf" -F "documentType=PO" http://localhost:3000/api/documents/upload
   curl -F "file=@GRN.pdf" -F "documentType=GRN" http://localhost:3000/api/documents/upload
   curl -F "file=@Invoice.pdf" -F "documentType=INVOICE" http://localhost:3000/api/documents/upload
   ```

3. **Get Match Result:**
   ```bash
   curl http://localhost:3000/api/match/CI4PO05788
   ```

4. **View Sample Output:**
   See `sample_match_extracted.json` for expected format

---

## 🆘 Troubleshooting

### "MongoDB connection failed"
- The system automatically falls back to in-memory storage
- Tests and API will still work normally
- No need to install/run MongoDB for basic testing

### "Gemini API rate limit"
- Fresh API key has a usage quota
- Each PDF extraction uses ~1 quota unit
- Wait 30-60 seconds between uploads if rate-limited
- 503 error returned when limit hit

### "Port 3000 already in use"
- Change PORT in `.env` to another port (e.g., 3001)
- Restart server

### "Cannot find module"
- Run `npm install` again to ensure all dependencies installed
- Check Node.js version: `node --version` (should be 18+)

---

## ✨ Success Criteria

Evaluator should see:
1. ✓ Server starts without errors
2. ✓ PDF uploads succeed and extract data
3. ✓ Documents appear in `/api/documents` endpoint
4. ✓ Match results auto-calculate in `/api/match` endpoint
5. ✓ `npm test` shows 17/17 passing
6. ✓ Out-of-order uploads work seamlessly
7. ✓ Sample JSON files show expected format

---

## 📞 Repository

**GitHub:** https://github.com/KrishnaKanhaiya1/Three-Way-MatchEngine

All code, tests, documentation, and examples are included and ready to run!
