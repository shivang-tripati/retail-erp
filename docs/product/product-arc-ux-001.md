Locked. These decisions are now part of the **RetailERP production UX and architecture baseline**.

I have also incorporated your Excel/CSV onboarding requirement as a core product capability, not an optional future enhancement.

## **RetailERP — Confirmed product decisions**

**1. Barcode scanning**

Locked

Support both:

- USB/Bluetooth barcode scanners.
- Camera-based barcode and QR scanning on compatible devices.

Both should use a common scanning and validation workflow.

**2. Location management**

Locked

- Centrally maintained country, state, city and PIN-code master.
- Verified PIN-code suggestions.
- Dependent state and city selectors.
- Manual correction where permitted.

**3. Master data management**

Locked

- Central organization-level master data.
- Shared products, brands, categories, suppliers and other common records.
- Store-level access controlled by permissions.
- Controlled local additions only where business rules permit.
- No independent, disconnected master datasets per store.

**4. Excel/CSV onboarding imports**

Core requirement

Support importing:

- Existing product catalogues.
- Customer records.
- Supplier records.
- Opening stock.

## **New UX capability: Bulk Data Import & Onboarding**

This should become a dedicated feature in RetailERP Administration, called **Data Import & Migration**.

[nuvo Software Reviews, Demo & Pricing - 2026](https://images.openai.com/static-rsc-4/eG1bwZ6rLA3ruuiBDx9SDoA0cbNmQvaju0NJDF1ee0liTBxikADM56ehtwz53uMOhC103h-fEssMyM5X7NtUvfTJQ-WKhU65TBJFldncfrNE6DdDRfDciEVg_KGGsCn88Chbydmj91qMjBkpDMOAHpKCuiYma3g8nrgo5vmF_W4?purpose=inline)

[softwareadvice.com](https://www.softwareadvice.com/data-quality/nuvo-profile/?utm_source=chatgpt.com)

### **Recommended import workflow**

1. **Choose import type**

   Products, customers, suppliers or opening stock.
2. **Download template or upload file**

   Support `.xlsx`, `.xls` and `.csv`, with downloadable templates and example rows.
3. **Map columns**

   Match the retailer's spreadsheet columns to RetailERP fields. Automatically suggest mappings based on column names.
4. **Validate and preview**

   Show valid rows, warnings, errors and duplicates before importing.
5. **Resolve issues**

   Allow correction, mapping changes, duplicate resolution and invalid-row exclusion.
6. **Confirm import**

   Import only after explicit confirmation. Display progress and results.
7. **Import report**

   Provide successful, skipped and failed row counts, with downloadable error details.

### **Important business rules**

| Import type   | Key validation                                                        |
| ------------- | --------------------------------------------------------------------- |
| Products      | SKU uniqueness, brand, category, barcode and required attributes      |
| Customers     | Mobile number, duplicate detection and address validation             |
| Suppliers     | Supplier identity, contact details and applicable tax identifiers     |
| Opening stock | Store, warehouse, product, quantity and serial numbers where required |

**Particularly important for opening stock:** it must create an auditable opening-stock entry, not silently overwrite inventory quantities. Serial-tracked stock must include valid, unique serial numbers. Importing the same opening stock twice must not duplicate inventory.

### **Additional controls I recommend**

- Import history and downloadable reports.
- Preview before committing.
- Duplicate detection against existing master data.
- Safe retry of failed rows without duplicating successful rows.
- Explicit organization and store selection.
- Permission checks.
- Import batch ID and audit trail.
- Large-file processing without freezing the user interface.
- Rollback or controlled reversal strategy for committed batches.

## **Architecture implications**

These decisions affect the production backend from day one.

| Backend capability | Required foundation                         |
| ------------------ | ------------------------------------------- |
| Master data        | Central organization-scoped entities        |
| Search             | Paginated search and lookup APIs            |
| Location           | Maintained location master                  |
| Scanning           | Barcode and serial resolution APIs          |
| Auto-fill          | Linked-record lookup APIs                   |
| Imports            | Import jobs, staging, validation and commit |
| Inventory          | Auditable opening-stock ledger entries      |
| Security           | Organization/store-scoped authorization     |

I would also introduce an **Import Staging Layer**: uploaded records are first staged and validated; only approved records enter the actual business tables. This is important because retailer spreadsheets are often inconsistent, contain duplicate rows or use different column names.

## **One thing before we finalize the specification**

Your message ends with "additionally below", so it looks like you intended to share more requirements after the import point.

Please send the remaining requirements. I will consolidate everything into **RetailERP UX Specification v1.1**, preserving the decisions already locked and then use that as the baseline for production architecture.