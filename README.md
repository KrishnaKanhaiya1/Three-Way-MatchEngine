# Three-Way Match Engine

[![CI Build](https://github.com/KrishnaKanhaiya1/Three-Way-MatchEngine/actions/workflows/ci.yml/badge.svg)](https://github.com/KrishnaKanhaiya1/Three-Way-MatchEngine/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-v18.x-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-v4.18-blue.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-v6.0-green.svg)](https://www.mongodb.com/)
[![Google Gemini API](https://img.shields.io/badge/Gemini_API-v1.5_Pro-orange.svg)](https://deepmind.google/technologies/gemini/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An enterprise-grade, high-throughput financial reconciliation engine designed to automate the three-way matching lifecycle across **Purchase Orders (PO)**, **Goods Receipt Notes (GRN)**, and **Invoices**. Built with asynchronous document parsing pipelines, Levenshtein-distance fuzzy item matching, and Google Gemini API intelligent OCR extraction.

---

## ⚡ Architecture Flow

```mermaid
graph TD
    PO[Purchase Order PDF/JSON] --> Engine[Reconciliation Orchestrator]
    GRN[Goods Receipt Note PDF/JSON] --> Engine
    INV[Invoice PDF/JSON] --> Engine
    Engine --> OCR[Google Gemini OCR & Schema Parser]
    OCR --> Matcher[Levenshtein Fuzzy Matcher & Price Variance Evaluator]
    Matcher --> DB[(MongoDB Transaction Ledger)]
    Matcher --> Status{Match Status}
    Status -->|Tolerance <= 1%| PASSED[PASSED: Auto-Approved for Payout]
    Status -->|Tolerance > 1%| FLAGGED[FLAGGED: Variance Alert Dispatched]
```

---

## 🚀 Key Technical Features

* **Asynchronous Out-of-Order Uploads**: State-driven matching queue tolerates PO, GRN, and Invoice uploads arriving out of sequence.
* **Fuzzy Item Normalization**: Implements Levenshtein string distance algorithm to reconcile item descriptions across legacy vendor systems.
* **Tolerance & Variance Engine**: Configurable line-item price and quantity variance thresholds (default: 1.0%).
* **OpenAPI / Swagger Specification**: Full interactive API routing specification included in `openapi.yaml`.

---

## 🛠️ Quick Start (Docker)

```bash
# Clone the repository
git clone https://github.com/KrishnaKanhaiya1/Three-Way-MatchEngine.git
cd Three-Way-MatchEngine

# Copy environment template
cp .env.example .env

# Run with Docker Compose
docker-compose up --build
```
