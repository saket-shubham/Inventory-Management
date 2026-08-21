# Barcode-Based Product Lookup & Billing System

A lightweight inventory + billing web app: scan a product's barcode, see live
stock across warehouses/showrooms, build a cart, generate a printable invoice,
and auto-deduct stock in real time.

## Stack

- **Server**: Node.js + Express + TypeScript, Prisma ORM, PostgreSQL, JWT auth, pdfkit
- **Client**: React + Vite + TypeScript, react-router, axios, html5-qrcode

## Project layout

```
server/   Express API (Prisma schema, routes, controllers, services)
client/   React frontend (pages, components, contexts)
```

## Getting started

### 1. Database

Requires a running PostgreSQL server (local install or otherwise) and an
existing database. Set `DATABASE_URL` in `server/.env` accordingly, e.g.:

```
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/yourdbname"
```

URL-encode any special characters in the password (e.g. `@` → `%40`).

### 2. Server

```bash
cd server
cp .env.example .env   # set DATABASE_URL, JWT_SECRET, company info
npm install
npx prisma migrate dev --name init
npm run seed            # creates warehouses, products, demo users
npm run dev              # http://localhost:4000
```

Seeded logins: `admin@example.com` / `cashier@example.com`, password
`password123` for both.

### 3. Client

```bash
cd client
cp .env.example .env
npm install
npm run dev               # http://localhost:5173
```

## Core flow

1. Sign in, pick the billing counter (warehouse) for this session.
2. Scan a barcode — via a USB/Bluetooth scanner (acts as a keyboard, just
   focus the scan input) or the phone camera toggle (`html5-qrcode`).
3. The product card shows price/MRP/discount and stock at every
   warehouse, highlighting the current billing counter.
4. Add to cart, repeat for more items, optionally attach a customer.
5. Generate Invoice — creates the invoice, deducts stock at the billing
   warehouse, and writes a stock ledger entry. Download/print the PDF.
6. Invoice History lets you search past invoices by date, customer,
   product, or invoice number.

Admin-only pages (`/admin/products`, `/admin/stock`) let an admin add new
products with barcodes and correct or transfer stock between warehouses.

## API overview

All endpoints are under `/api` and (except `/auth/login`) require a
`Authorization: Bearer <token>` header.

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/login` | Returns a JWT + user |
| GET | `/products/lookup?barcode=` | Product + stock by warehouse |
| GET | `/products/:id/stock` | Stock across all warehouses |
| GET | `/products` | List/search products |
| POST | `/products` | Admin only — create product (+ initial stock) |
| POST | `/invoices` | Create invoice from cart, deducts stock |
| GET | `/invoices` | List/filter invoice history |
| GET | `/invoices/:id` | Invoice detail |
| GET | `/invoices/:id/pdf` | Streams a PDF invoice |
| POST | `/stock/adjust` | Admin only — manual correction/transfer |
| GET | `/warehouses` | List warehouses/showrooms |
| GET/POST | `/customers` | Search / create customers |
