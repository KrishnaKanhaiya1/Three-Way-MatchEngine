# Three-Way Match Engine — Transactional Reconciliation System

[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-4.18-black.svg?style=for-the-badge&logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0-green.svg?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![Google Gemini API](https://img.shields.io/badge/Gemini_API-OCR_Extractor-orange.svg?style=for-the-badge&logo=google)](https://deepmind.google/technologies/gemini/)

An enterprise financial reconciliation engine designed to automate three-way matching across **Purchase Orders (PO)**, **Goods Receipt Notes (GRN)**, and **Invoices**. Uses fuzzy string comparison algorithms and Google Gemini API OCR parsing to reconcile line items and detect payout variances.

---

## 📌 Executive Overview

In procurement operations, manual verification of vendor invoices against purchase orders and receiving logs is error-prone and slow. **Three-Way Match Engine** automates line-item reconciliation, tolerating vendor nomenclature variations via Levenshtein distance calculations and flagging price/quantity variances exceeding configurable thresholds.

---

## 🏗️ Reconciliation Pipeline

```mermaid
flowchart TD
    PO[Purchase Order] --> Engine[Reconciliation Orchestrator]
    GRN[Goods Receipt Note] --> Engine
    INV[Vendor Invoice] --> Engine
    
    Engine --> GeminiOCR[Gemini OCR Schema Extraction]
    GeminiOCR --> FuzzyMatcher[Levenshtein Fuzzy String Matcher]
    FuzzyMatcher --> VarianceCalc[Price & Quantity Variance Evaluator]
    
    VarianceCalc --> Decision{Variance <= 1.0%?}
    Decision -->|Yes| AutoApprove[PASSED: Auto-Approved for Payout]
    Decision -->|No| Flagged[FLAGGED: Discrepancy Alert Generated]
    
    AutoApprove --> MongoDB[(MongoDB Ledger)]
    Flagged --> MongoDB
```

---

## ✨ Key Features

* **Asynchronous Upload Queue**: Handles out-of-order document uploads without failing state sequences.
* **Fuzzy Item Normalization**: Matches vendor item descriptions (e.g. "Widget A-100" vs "Widget A100") using Levenshtein distance scoring.
* **Configurable Variance Thresholds**: Automatically flags line items exceeding allowable price/quantity variances (default: 1.0%).

---

## 🚀 Getting Started

```bash
git clone https://github.com/KrishnaKanhaiya1/Three-Way-MatchEngine.git
cd Three-Way-MatchEngine

npm install
cp .env.example .env
npm start
```
