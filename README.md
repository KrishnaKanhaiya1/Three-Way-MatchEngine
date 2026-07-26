# ⚖️ Three-Way Match Engine — Procurement Reconciliation System

[![Node.js](https://img.shields.io/badge/Node.js-v18.x-green.svg?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-v4.18-blue.svg?style=for-the-badge&logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-v6.0-green.svg?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![Google Gemini API](https://img.shields.io/badge/Gemini_API-OCR_Engine-orange.svg?style=for-the-badge&logo=google)](https://deepmind.google/technologies/gemini/)

> **An enterprise-grade financial reconciliation engine designed to automate three-way matching across Purchase Orders (PO), Goods Receipt Notes (GRN), and Invoices.** Features Levenshtein-distance fuzzy item matching, configurable price/quantity variance tolerances, and Google Gemini API intelligent OCR extraction.

---

## 💡 Reconciliation Pipeline Architecture

```mermaid
graph TD
    PO[Purchase Order PDF/JSON] --> Engine[Reconciliation Orchestrator]
    GRN[Goods Receipt Note PDF/JSON] --> Engine
    INV[Invoice PDF/JSON] --> Engine
    Engine --> OCR[Google Gemini OCR & Schema Parser]
    OCR --> Matcher[Levenshtein Fuzzy Matcher & Variance Evaluator]
    Matcher --> DB[(MongoDB Ledger)]
    Matcher --> Status{Match Status}
    Status -->|Variance <= 1%| PASSED[PASSED: Auto-Approved for Payout]
    Status -->|Variance > 1%| FLAGGED[FLAGGED: Discrepancy Dispatched]
```

---

## ✨ UI Features & Functionality Inventory

| UI Feature Module | Interactive Functionality | Real User Flow |
| :--- | :--- | :--- |
| **Document Upload Dashboard** | Upload Purchase Orders, Goods Receipt Notes, and Invoices simultaneously or asynchronously. | Drag PO & Invoice files $\rightarrow$ Click "Run Reconciliation" $\rightarrow$ Real-time processing progress bar. |
| **Fuzzy Match Inspector** | Displays string similarity percentages for line item descriptions across vendor documents. | Inspect line item match list $\rightarrow$ View Levenshtein score (e.g. "Widget A-100" vs "Widget A100": 98% match). |
| **Discrepancy & Variance Alerts** | Highlights line items exceeding price or quantity tolerance thresholds (default: 1.0%). | Filter by "FLAGGED" status $\rightarrow$ View exact price discrepancy $\rightarrow$ Approve or Reject payout. |

---

## 🛠️ Local Developer Setup

```bash
git clone https://github.com/KrishnaKanhaiya1/Three-Way-MatchEngine.git
cd Three-Way-MatchEngine
npm install
cp .env.example .env
npm start
```
