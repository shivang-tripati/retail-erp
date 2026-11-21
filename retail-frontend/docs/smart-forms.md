# Smart Forms and Minimum Manual Input

RetailERP uses shared frontend primitives for minimum-manual-input workflows:

- `SearchableSelector` searches customer, product, serial and other master-data options by name, code, identifier or keywords.
- `ScanField` accepts typed or scanner-style keyboard input and supports Enter-key submission.
- Phase 4 selector fields use the searchable selector, including warehouse, store, product and related transaction fields.
- POS customer selection searches name, mobile number and customer ID.
- POS product and serial assignment reuse master data and prevent unavailable serial assignment.
- Serial scanning provides explicit sellable/damaged validation before GRN confirmation.
- State and city on customer registration and store administration are dropdowns. State lists the fixed Indian states and union territories. City lists only the cities for the selected state.

These are frontend prototype interactions. Production must replace local option lists with server-side search, pagination, authorization and master-data ownership. Scanner hardware, camera scanning and barcode integrations remain optional future integrations.
