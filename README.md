# Kiro

PayFi platform that turns merchant sales into instant cash. Kiro sits at the intersection of traditional retail and Web3 finance, connecting merchants and investors through the Stellar blockchain.

**Live demo:**
- Landing page: https://kiropay.netlify.app
- Merchant dashboard: https://kiro-merchant-dashboard.netlify.app/resumo

---

## Overview

- **Merchant dashboard** with balance, incoming payments, yield, and receivables advance.
- **Stellar integration** for tokenization and on-chain settlement.
- **On-ramp / off-ramp** via Etherfuse (BRL ⇄ TESOURO token).
- **Instant PIX** deposits and withdrawals.
- **Non-custodial** — the Stellar keypair is derived client-side via HKDF from a deterministic EIP-191 signature on the user's Privy embedded EVM wallet. Kiro never holds private keys.
- **LGPD-compliant** — explicit consent logging and AES-256-GCM PII encryption at rest.

---

## Stack

### Frontend (`frontend/kiro-dashboard`)

| Category | Tech | Version |
|----------|------|---------|
| Runtime | Node.js | 20.x |
| Framework | React | 18.3 |
| Language | TypeScript | 5.4 |
| Build tool | Vite | 5.4 |
| Styling | Tailwind CSS | 3.4 |
| Routing | React Router DOM | 6.26 |
| Charts | Recharts | 2.13 |
| Icons | Lucide React | 0.451 |
| Stellar SDK | @stellar/stellar-sdk | 12.3 |
| Auth & wallet | @privy-io/react-auth | 3.27 |
| Lint / Format | ESLint 8 / Prettier 3 | — |
| Hosting | Netlify | — |

### Backend (`backend/`)

| Category | Tech | Version |
|----------|------|---------|
| Language | Go | 1.22 |
| HTTP router | chi | 5 |
| Postgres driver | pgx | 5 |
| Migrations | golang-migrate (embedded via `//go:embed`) | 4 |
| Auth | Privy JWT verification (lestrrat-go/jwx) | 2 |
| Crypto | AES-256-GCM + HMAC-SHA256, HKDF-derived | — |
| Runtime container | Alpine 3.19 (port 8000) | — |

### Infra

| Service | Tech |
|---------|------|
| Database | PostgreSQL 16 (alpine) |
| Database UI | Adminer |
| Orchestration | Docker Compose |
| Serverless proxies | Netlify Functions (Etherfuse, Stellar sponsor) |

---

## Project structure

```
kiro/
├── backend/                       # Go backend
│   ├── cmd/api/                   # Entrypoint (main.go)
│   ├── internal/
│   │   ├── api/                   # HTTP handlers, middleware, router
│   │   ├── auth/                  # Privy JWT verification
│   │   ├── config/                # Env loading
│   │   ├── crypto/                # AES-256-GCM vault for PII at rest
│   │   ├── db/sqlc/               # sqlc-style queries and models
│   │   └── migrate/               # golang-migrate runner
│   └── migrations/                # Versioned SQL migrations
├── frontend/
│   └── kiro-dashboard/            # React + Vite SPA
│       ├── netlify/functions/     # Serverless proxies (Etherfuse, Stellar)
│       └── src/                   # Dashboard source
├── docker-compose.yml             # Postgres + Adminer + Go backend
└── .env.example                   # Root environment variables
```

---

## Prerequisites

- **Node.js** 20.x and **npm** 10.x
- **Docker** and **Docker Compose**
- **Privy account** (https://privy.io) — create an app and grab the App ID.
- **Etherfuse sandbox account** (https://etherfuse.com) — required for on-ramp / off-ramp credentials.
- **Git**

---

## Running locally

### 1. Clone and configure environment variables

```bash
git clone <repo-url>
cd kiro
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/kiro-dashboard/.env.example frontend/kiro-dashboard/.env
```

#### Root `.env`

```env
POSTGRES_USER=kiro
POSTGRES_PASSWORD=<your-password>
POSTGRES_DB=kiro
DB_HOST=db
DB_PORT=5432
DB_SSLMODE=disable
STELLAR_NETWORK=TESTNET
```

#### Backend `backend/.env`

```env
PORT=8000
DATABASE_URL=postgres://kiro:<password>@db:5432/kiro?sslmode=disable
PRIVY_APP_ID=<same-as-VITE_PRIVY_APP_ID>
ALLOWED_ORIGINS=http://localhost:5173
PII_MASTER_KEY=<base64, decodes to ≥ 32 bytes>
```

Generate a key:
```bash
openssl rand -base64 32
```

> **Warning:** `PII_MASTER_KEY` derives the AES-256-GCM key and the keyed HMAC used for CNPJ uniqueness. Rotating it makes every existing encrypted row unreadable — back it up before going to production.

#### Frontend `frontend/kiro-dashboard/.env`

```env
VITE_PRIVY_APP_ID=
VITE_BACKEND_URL=http://localhost:8000

VITE_STELLAR_NETWORK=TESTNET
VITE_HORIZON_URL=https://horizon-testnet.stellar.org
VITE_TESOURO_CODE=TESOURO
VITE_TESOURO_ISSUER=<asset-issuer-address>

STELLAR_SPONSOR_SECRET=<server-side only>

ETHERFUSE_BASE_URL=https://api.sand.etherfuse.com
ETHERFUSE_API_KEY=<server-side only>

# Shows the "Skip approval (sandbox)" link in the KYC modals.
VITE_ETHERFUSE_SANDBOX=true
```

> `ETHERFUSE_API_KEY` and `STELLAR_SPONSOR_SECRET` are read **only** by the server-side proxy (Vite middleware in dev, Netlify Functions in prod) — they are never exposed to the client.

### 2. Start backend + database

From the project root:

```bash
docker compose up -d --build
```

Services:

- **PostgreSQL** → `localhost:5432`
- **Adminer** → http://localhost:8080
- **Backend API** → http://localhost:8000

Migrations run automatically on backend startup. To apply a new migration, rebuild the backend image (the SQL files are embedded into the Go binary at build time):

```bash
docker compose up -d --build backend
```

### 3. Run the frontend

```bash
cd frontend/kiro-dashboard
npm install
npm run dev
```

Dashboard at http://localhost:5173.

---

## Frontend scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Starts Vite + the Etherfuse / Stellar dev proxies |
| `npm run build` | Type-checks with `tsc -b` and builds for production |
| `npm run preview` | Serves the production build locally |
| `npm run lint` | Runs ESLint (zero-warning policy) |
| `npm run format` | Formats with Prettier |

---

## Visual identity

Primary palette (see `src/styles/tokens.css`):

| Token | Hex | Usage |
|-------|-----|-------|
| Kiro Green | `#00FF87` | CTAs, positive values |
| Deep Black | `#0A0B10` | Background (dark mode) |
| Stellar Purple | `#7B2CBF` | Gradients, accents |
| Snow White | `#FFFFFF` | Primary typography |
| Slate Gray | `#8E92A3` | Secondary text |

**Typography:** Space Grotesk / Inter (display & sans), Roboto Mono (financial values).

**Philosophy:** Dark mode first, with glassmorphism.

---

## Security & compliance

- **Non-custodial.** The Stellar keypair is derived deterministically on the client from a fixed EIP-191 signature against the user's Privy embedded EVM wallet. The same Privy account always produces the same Stellar key on any device. Private keys never leave the browser and are never stored.
- **Privy MFA** (TOTP) is enrolled on first login and required on every authentication.
- **PII at rest** (CPF, CNPJ, email, PIX key, phone, name) is encrypted with AES-256-GCM. CNPJ uniqueness uses a separate HMAC-SHA256 column, so lookups never require decryption.
- **LGPD consent** is captured in the `consent_logs` table in the same transaction that creates the user, with policy type and version recorded for auditing.

---

## Deploy

- **Landing page:** Netlify — https://kiropay.netlify.app
- **Dashboard:** Netlify — https://kiro-merchant-dashboard.netlify.app/resumo
- **Backend + DB:** Docker Compose (self-hosted).

---

## Stellar network

The project defaults to **Stellar Testnet** (`horizon-testnet.stellar.org`). For mainnet, set `VITE_STELLAR_NETWORK=PUBLIC`, `VITE_HORIZON_URL=https://horizon.stellar.org`, and point `VITE_TESOURO_ISSUER` at the mainnet TESOURO issuer.
