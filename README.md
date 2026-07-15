# Three-Way Match Engine

A high-performance reconciliation engine designed to automate the matching of procurement documents: **Purchase Orders (PO)**, **Goods Receipt Notes (GRN)**, and **Invoices**. Built with **Node.js**, **Express**, **MongoDB**, and **Google Gemini API** for intelligent layout-independent document parsing.

Reconciliation engine designs like this are crucial for transactional business logic, auditing systems, and payment processing (similar to POS invoice and ledger reconciliation).

---

## 🛠️ Key Capabilities & Approach

### 1. Trigger-Based Re-Evaluating Architecture
Documents can be uploaded in any order (e.g., Invoice arrives before GRN). On every new upload or deletion, the matching engine runs an incremental check against all linked records for that specific PO, updating the reconciliation status deterministically.

### 2. Intelligent PDF Extraction
Integrates the Google Gemini 2.5-Flash API to parse structured JSON directly from unstructured billing and shipping PDFs. This eliminates layout-dependency, enabling layout-independent parsing of complex multi-vendor formats.

### 3. Fuzzy Item Reconciliation
Addresses real-world discrepancies (such as variable item prefixes, e.g., "FG-1124" vs "1124") using token-based similarity and Levenshtein-like logic to map invoice items back to original PO line items despite OCR or naming mismatches.

### 4. Out-of-Order Upload Resiliency
Calculates a transient "Partially Matched" or "Discrepancy" state. Once missing documents are uploaded, the matching is completed automatically.

---

## 🏗️ Architecture & Matching Logic

The matching logic relies on 3 key vectors:
1. **Quantity Verification**: Comparing GRN quantity with PO quantity to prevent over-billing.
2. **Price Verification**: Ensuring invoice unit price matches the PO price contract.
3. **Product Line Mapping**: Fuzzy matching items across schemas.

### Match Status States:
* `MATCHED`: Quantities and prices reconcile perfectly across PO, GRN, and Invoice.
* `PARTIAL_MATCH`: Documents are linked, but quantities or prices have small deviations.
* `DISCREPANCY`: Significant price/quantity variance detected, triggering audit flags.
* `PENDING`: Waiting for additional documents (e.g., PO exists, but GRN is missing).

---

## 📂 Tech Stack

* **Runtime**: Node.js
* **Backend Framework**: Express.js
* **Database**: MongoDB (Mongoose)
* **AI/LLM Integration**: Google GenAI SDK (Gemini 2.5 Flash)
* **API Documentation**: OpenAPI / Swagger
* **Testing & Tools**: Docker, Docker Compose, Postman

---

## ⚙️ Setup & Installation

1. **Clone the Repo**
   ```bash
   git clone https://github.com/KrishnaKanhaiya1/Three-Way-MatchEngine.git
   cd Three-Way-MatchEngine
   ```

2. **Environment Configuration**
   Copy `.env.example` to `.env` and fill in your details:
   ```env
   PORT=8080
   MONGODB_URI=your_mongodb_uri
   GEMINI_API_KEY=your_gemini_api_key
   ```

3. **Run Locally**
   ```bash
   npm install
   npm run start
   ```

4. **Docker Compose (Optional)**
   ```bash
   docker-compose up --build
   ```

---

## 💡 Key CS & Software Engineering Learnings

* **Asynchronous Flow Orchestration**: Dealt with real-time webhooks and OCR processing queues to prevent event bottlenecks.
* **Deterministic Matching Rules**: Implemented strict validation checks protecting data accuracy, mitigating double-billing scenarios.
* **API Schema Contract**: Leveraged OpenAPI definitions to maintain clean documentation and standardized request/response bodies.
