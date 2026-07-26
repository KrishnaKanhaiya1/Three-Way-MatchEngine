# ⚖️ Three-Way Match Engine — Transactional Reconciliation System

[![Node.js](https://img.shields.io/badge/Node.js-v18.x-green.svg?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-v4.18-blue.svg?style=for-the-badge&logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-v6.0-green.svg?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![Google Gemini API](https://img.shields.io/badge/Gemini_API-OCR_Engine-orange.svg?style=for-the-badge&logo=google)](https://deepmind.google/technologies/gemini/)

> **An enterprise-grade financial reconciliation engine designed to automate three-way matching across Purchase Orders (PO), Goods Receipt Notes (GRN), and Invoices.** Features Levenshtein-distance fuzzy item matching ($\mathcal{O}(M \times N)$ complexity), configurable price/quantity variance tolerances, and Google Gemini API intelligent OCR extraction.

---

## 💡 Reconciliation Pipeline

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

## 🧮 Levenshtein Distance Matrix Formula

$$D(i, j) = \begin{cases} \max(i, j) & \text{if } \min(i, j) = 0, \\ \min \begin{cases} D(i-1, j) + 1 \\ D(i, j-1) + 1 \\ D(i-1, j-1) + 1_{(a_i \neq b_j)} \end{cases} & \text{otherwise.} \end{cases}$$

---

## 🛠️ Local Developer Setup

```bash
git clone https://github.com/KrishnaKanhaiya1/Three-Way-MatchEngine.git
cd Three-Way-MatchEngine
npm install
cp .env.example .env
npm start
```
