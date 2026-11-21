# RetailOS Phase 10 QA Report

## Overall result

**Passed with limitations.** The prototype routes load and the shared-state workflow, Vitest and build checks pass. Browser testing confirmed Demo Centre workflow switching, role switching, reset confirmation, POS serial/cart UI and report rendering. Several live end-to-end transaction submissions, thermal/print preview, and browser download capture could not be completed.

## Browser-tested workflows

- Opened the Demo Centre and switched through all seven workflow guides.
- Opened workflow links for inventory, transfer, POS and reporting.
- Switched through all six demo roles.
- Confirmed reset dialog behavior and executed the confirmed reset.
- Opened the POS, added a serialized product, assigned a cart entry and verified the delivery/counter-pickup selector and totals.
- Opened the transfer dialog and verified source, destination, product, quantity and serial fields.
- Rendered the Unified Reports table and verified report filters.
- Inspected 768px and 390px viewports; no document-level horizontal overflow was observed.

## Print and export

- Unified report CSV export was implemented with category-specific filenames and escaped headers/rows.
- Browser download capture could not be confirmed by the available browser automation at the time of testing.
- Print-only CSS exists for reports, but print previews for invoice, thermal receipt, challan, warranty and installation layouts were not performed.

## Defects fixed

- CSV export activation was changed to append and remove a hidden anchor and delay object URL cleanup.
- Package metadata was changed from the scaffold name to `retailos-client-demo`.
- Demo and prototype scope documentation was added.

## Remaining limitations

- The application is frontend-only.
- Browser data is isolated in session storage.
- Full warehouse, POS, finance, delivery, warranty and buyback browser submissions were not all exercised in this QA pass.
- Print previews and browser-confirmed CSV download remain limitations.
- Role and permission enforcement are intentionally not implemented.
