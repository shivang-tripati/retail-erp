# RetailOS

RetailOS is a frontend-only, fictional retail demonstration for Sharma Electronics. It connects POS, CRM, products, inventory, warehouse operations, finance, fulfilment, after-sales and executive analytics in one browser session.

## Technology

- Next.js 16
- React 19
- TypeScript 5.7
- Tailwind CSS 4
- Recharts
- Base UI / shadcn UI primitives
- Vitest
- `sessionStorage` shared demo state

## Local setup

```powershell
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Validation

```powershell
pnpm exec tsc --noEmit
pnpm build
pnpm test
```

## Demo operation

The app uses fictional data and no backend, authentication provider or payment gateway.

- Use the profile menu to switch among the six simulated roles.
- Role switching changes demonstration context only; it does not enforce authorization.
- Open **Demo > Demo Centre** for the guided seven-workflow client presentation.
- Use **Reset demo data** on the Demo Centre. Confirmation is required.
- Reset affects only the current browser `sessionStorage` data and restores the known seed baseline.

## Module overview

- Demo: guided client presentation
- Sales: POS billing and sales history
- Customers: customer directory, footfall and enquiries
- Products: catalogue and serial registry
- Inventory: stock, ledger, adjustments, transfers, aging and outstanding analysis
- Warehouse: GRN, serial scanning, operations, buyback and scrap
- Finance: collections, receivables, recovery, reconciliation and audit history
- Fulfilment: delivery orders, scheduling, dispatch, proof and analytics
- After-sales: installation, warranty and service desk
- Analytics: executive, store, commercial, operational and unified reports
- Administration: users, stores, brands and settings

## Known limitations

- Data is stored in browser session storage only.
- Refresh behavior depends on that browser session; data is not persisted to a database.
- The role selector is demo context and is not real authentication or authorization.
- Document layouts are printable prototypes, not statutory GST or certification documents.
- Print preview, browser hardware, bank, UPI and GPS integrations are not implemented.
- Quantity-based stock aging is estimated where receipt-lot history is unavailable.
- Historical trends can be limited by the seed data and consistent reference dates.

