You are now acting as a **Senior QA Engineer + Backend Engineer + Frontend Engineer + Database Engineer + Security Reviewer**.

Your job is NOT to add features.

Your job is to independently verify whether the previous coding agent actually implemented the four core modules correctly.

We have received multiple reports claiming that the work is complete.

**Do NOT trust those reports.**
**Do NOT assume anything is correct because a previous agent said it was tested.**

You must inspect the actual repository, database schema/migrations, backend code, frontend code, API behavior, and runtime behavior.

The goal is to determine whether the current implementation is genuinely production-ready for the current scope.

---

# 0. ABSOLUTE SCOPE

The current product scope is ONLY:

1. Projects
2. Archive / Document Control
3. BOQ / المقايسات
4. IPC / المستخلصات

Everything else is OUT OF SCOPE.

Do NOT implement or expand:

* Warehouses
* Inventory
* Stock
* Material Requests
* Procurement
* Purchase Orders
* Suppliers
* Payments
* Accounting
* HR
* Notifications
* Advanced ERP
* Future modules

If you discover bugs outside these four modules, report them separately as OUT OF SCOPE.

Do not fix them.

---

# 1. PRIMARY OBJECTIVE

Perform a real **End-to-End Acceptance Test** of:

Project
↓
Archive / Documents
↓
BOQ
↓
IPC
↓
Financial Position / Contractual Position

And independently verify:

* UI
* API
* database
* validation
* business rules
* relationships
* permissions
* delete safety
* status transitions
* file handling
* Excel import/export
* search/filtering
* calculations
* error handling
* null handling
* Docker/runtime
* regression safety

Do not only inspect code.

Where possible, actually execute the application and test the API/database/runtime.

---

# 2. FIRST — UNDERSTAND THE ACTUAL SYSTEM

Before testing, inspect the repository.

Identify:

* monorepo structure
* frontend
* backend
* shared package
* PostgreSQL setup
* migrations
* Docker Compose
* Dockerfiles
* Nginx
* environment variables
* storage directories
* authentication
* permissions
* repositories
* services
* routes
* schemas/validation
* audit system

Determine the actual architecture from the code.

Do NOT rely on old PLAN.md documentation if it contradicts the actual implementation.

The actual runtime implementation is authoritative.

---

# 3. DATABASE AUDIT

Inspect the PostgreSQL schema and migrations.

Verify all tables/relations used by the four modules.

At minimum inspect the relationships around:

* projects
* documents
* document_revisions
* BOQ
* BOQ items
* IPC
* IPC items
* archive references

Check:

* primary keys
* foreign keys
* nullable fields
* CHECK constraints
* unique constraints
* indexes
* ON DELETE behavior
* data types
* status values
* migration order

Look specifically for:

### Dangerous issues

* missing foreign keys
* wrong foreign keys
* inconsistent cascade behavior
* application-level validation without DB protection where DB protection is required
* nullable fields that frontend/API cannot round-trip
* duplicate records allowed unintentionally
* orphan records
* cross-project references
* status values accepted by frontend but rejected by DB
* status values accepted by DB but not by application

Do not modify the schema during the audit unless explicitly necessary to reproduce/test something.

---

# 4. MODULE 1 — PROJECTS

Perform a complete acceptance test of Projects.

## 4.1 Create

Test:

* valid project creation
* required fields
* optional fields
* empty values
* null values
* invalid dates
* invalid numeric values
* duplicate project code/number if applicable
* owner
* client
* project status

Verify:

Frontend → API → DB → GET

and confirm the saved object matches what the user entered.

---

## 4.2 Read

Verify:

* project list
* project details
* search
* filters
* pagination if present
* sorting if present
* owner
* client
* dates
* status
* contract information

Make sure nullable DB fields do not cause frontend crashes.

---

## 4.3 Update

Test:

1. Create project.
2. GET project.
3. PUT the exact returned data.
4. Confirm success.

This is especially important for nullable fields.

Verify:

`GET → UI/Form → PUT`

does not generate 400 validation errors.

---

## 4.4 Delete

Test:

### Empty project

Should delete successfully if that is the intended behavior.

### Project with BOQ

Test expected behavior.

### Project with IPC

Test expected behavior.

### Project with BOQ + IPC

This is important because a previous bug existed here.

Verify there are:

* no FK crashes
* no 500
* no partial deletion
* no orphan BOQ items
* no orphan IPC items
* no orphan records

If deletion is intentionally blocked, verify the correct status code and error.

If deletion is allowed, verify the complete cascade/explicit cleanup.

---

## 4.5 Owner

Verify the canonical owner field is:

`projects.owner`

Do NOT introduce or assume another owner field.

Test:

* project with owner
* project without owner
* update owner
* owner appears correctly in financial position

---

# 5. MODULE 2 — ARCHIVE / DOCUMENT CONTROL

This module requires a serious test because it handles real files.

---

## 5.1 Upload

Test:

* PDF
* image if supported
* DOC/DOCX if supported
* XLS/XLSX if supported
* unsupported extension
* empty file
* large file within configured limit
* invalid metadata
* missing project
* invalid project
* invalid IPC reference
* invalid document type

Verify:

* file physically exists
* DB record exists
* metadata is correct
* project relation is correct
* storage path is correct
* no orphan DB/file state

---

## 5.2 Preview

Test actual document preview.

Verify:

* PDF preview works
* authenticated request works
* Blob/Object URL behavior works
* Content-Type is correct
* no false `204`
* empty document handled correctly
* missing file handled correctly
* unauthorized access blocked

Pay special attention to the previously reported:

`HTTP 204`

preview issue.

Do not accept "the code looks correct".

Actually test it.

---

## 5.3 Download

Test:

* authorized user
* unauthorized user
* valid file
* missing file
* correct filename
* correct Content-Type

Verify permission enforcement.

---

## 5.4 Metadata

Test create/update metadata:

* title
* category/type
* project
* IPC reference
* status
* notes
* dates
* other existing metadata

Check GET → edit → PUT round-trip.

---

## 5.5 Document Revisions

This is critical.

Verify the canonical revision system.

Test:

Revision 00
→ update/upload revision
→ Revision 01
→ update/upload revision
→ Revision 02

Verify:

* newest revision is correct
* previous revisions remain accessible
* revision numbers are correct
* file paths are correct
* DB relations are correct
* metadata is synchronized correctly where required
* old revisions cannot accidentally disappear
* revision history is displayed newest-first if that is the intended UI behavior

---

## 5.6 Delete Safety

Verify existing delete rules.

A protected/finalized document must NOT be deletable.

Draft/rejected behavior must match the intended business rules.

Verify:

* correct HTTP status
* useful error
* no partial delete
* audit event where applicable

Test the existing `DeleteSafetyService`.

Do not remove it.

---

## 5.7 Archive ↔ IPC

This is very important.

Verify that:

* creating an IPC does NOT unexpectedly create an Archive document
* manually uploading a document as `مستخلص` can reference an IPC
* `ipcId` is correct
* project is correct
* no cross-project IPC reference is possible
* duplicate archive records are not created accidentally

Verify the current design:

**IPC lifecycle and Archive document lifecycle are independent.**

IPC:

`draft → submitted → approved/rejected`

Archive document:

`draft → submitted → under-review → approved`

Do NOT merge these lifecycles.

Verify that approving an IPC does NOT automatically approve its Archive document.

---

# 6. MODULE 3 — BOQ / المقايسات

Perform complete BOQ acceptance testing.

---

## 6.1 CRUD

Test:

* create BOQ
* read BOQ
* update BOQ
* delete BOQ

Verify:

* project must exist
* BOQ belongs to correct project
* invalid project returns 404
* cross-project URL mismatch returns correct error

---

## 6.2 BOQ Items

Test:

* item code
* description
* unit
* quantity
* unit price
* total
* optional fields
* numeric coercion
* null handling

Verify calculations.

For example:

`quantity × unit price = total`

where applicable according to the existing implementation.

Do not invent business rules.

---

## 6.3 Cross-project protection

This is mandatory.

Create:

Project A
Project B

Create BOQ item in A.

Attempt to use that item in B.

Expected behavior:

REJECT.

No silent skipping.

No partial writes.

No cross-project references.

---

## 6.4 Delete Safety

If a BOQ item is referenced by IPC items:

Attempt deletion.

Expected:

* deletion blocked
* appropriate HTTP status
* no FK 500
* useful error
* audit where implemented

This previously required a `DeleteSafetyService.blockBoqItem` guard.

Verify it actually works.

---

## 6.5 Excel Export

Test:

`GET /:projectId/boq/export/xlsx`

Verify:

* file downloads
* valid XLSX
* correct project
* correct columns
* correct values
* no unrelated project data
* permissions enforced

---

## 6.6 Excel Import

Test:

* valid BOQ XLSX
* invalid rows
* numeric coercion
* missing required values
* invalid projectCode
* duplicate rows
* malformed workbook
* partial invalid input

Verify:

* valid rows imported correctly
* invalid rows are reported clearly
* no corrupted records
* no cross-project records
* import does not silently skip important errors

Also test the import template if one exists.

---

# 7. MODULE 4 — IPC / المستخلصات

This is the most critical module after Archive.

---

## 7.1 Create IPC

Test:

* valid IPC
* missing project
* invalid project
* missing BOQ item
* cross-project BOQ item
* invalid quantity
* invalid price
* invalid date
* nullable notes
* nullable deductions
* duplicate IPC number

Verify all validation.

---

## 7.2 Quantity Protection

Create BOQ item:

Quantity = 100

IPC #1:

Quantity = 30

IPC #2:

Quantity = 70

Expected:

Accepted.

Then attempt:

IPC #3:

Quantity = 1

Expected:

Rejected.

Verify cumulative logic.

Also verify:

* no partial IPC
* no partial IPC items
* no corrupted totals

---

## 7.3 Cross-project IPC

Project A:

BOQ Item A

Project B:

IPC

Attempt to attach BOQ Item A to Project B.

Expected:

HTTP 400 or equivalent validation error.

Never silently ignore the item.

No IPC should be partially created.

---

## 7.4 Duplicate IPC Number

Within the same project:

IPC #001

Attempt another:

IPC #001

Expected:

409 or existing intended conflict status.

Verify duplicates are impossible according to the application rules.

---

## 7.5 IPC Status Lifecycle

Verify exactly:

`draft → submitted`

`submitted → approved`

`submitted → rejected`

Verify:

* draft → approved is blocked if not allowed
* draft → rejected is blocked if not allowed
* approved → draft blocked
* approved → submitted blocked
* rejected → submitted blocked if terminal according to current implementation
* no backward transition

Do NOT invent transitions.

Test the actual transition matrix in code.

---

## 7.6 IPC Edit

Test:

GET IPC

→ load edit form

→ PUT exact GET response

Expected:

200.

This MUST work with:

* notes = null
* deductions = null
* other nullable fields

This regression must remain permanently protected.

---

## 7.7 IPC Delete

Test:

* draft IPC
* submitted IPC
* approved IPC
* rejected IPC

Verify existing deletion rules.

No FK crash.

No orphan IPC items.

No accidental deletion of BOQ.

---

## 7.8 Previous Quantity

Inspect how:

`previousQuantity`

is calculated.

Verify whether editing an older IPC can make later IPCs inconsistent.

Do not necessarily change it.

If the current implementation has a known limitation, report it accurately.

---

# 8. FINANCIAL POSITION / CONTRACTUAL POSITION

The `الموقف المالي والتعاقدي` page is part of the current scope and MUST be tested.

---

## 8.1 Owner grouping

Verify actual data.

Expected current behavior:

`ادارة المشروعات`
→ 003

`إدارة الفنادق`
→ 4

`بدون جهة`
→ 01, 02

Do not hardcode these values.

Verify grouping dynamically from:

`projects.owner`

---

## 8.2 Search

Test:

* project name
* project code
* owner
* partial search
* Arabic text
* empty search

---

## 8.3 Filters

Test all existing filters.

Verify filters do not change financial calculations incorrectly.

---

## 8.4 Financial calculations

Verify all visible calculations against actual DB data.

Do not only check that values render.

Trace:

Project
→ BOQ
→ IPC
→ calculations

Check:

* BOQ total
* IPC totals
* executed amounts
* deductions
* net amounts
* remaining amounts
* contractual totals
* any other existing financial values

Use independent calculations from DB where possible.

The UI must match the independent calculation.

---

## 8.5 Group totals / KPIs

Verify the new modern UI did NOT change the underlying calculations.

If the hero/KPI cards calculate totals from visible rows:

* test with no filters
* test with owner filter
* test with search
* test with multiple groups
* test with zero results

Make sure KPIs reflect the currently visible dataset exactly.

---

# 9. AUTHENTICATION / AUTHORIZATION

Do NOT skip this.

Identify the current roles and permissions.

For every sensitive operation, verify permissions.

At minimum:

* project create
* project edit
* project delete
* archive upload
* archive view
* archive download
* archive delete
* BOQ operations
* IPC operations
* financial position access

Test:

* authorized request
* unauthorized request
* missing token
* invalid token
* insufficient permission

Expected:

401/403 as appropriate.

Do not accept UI-only protection.

Verify backend protection.

---

# 10. AUDIT LOGGING

Inspect existing audit behavior.

Test important destructive/status-changing actions:

* project delete
* document delete
* document revision
* IPC status change
* BOQ delete if audited
* other existing audited actions

Verify audit records contain meaningful information.

Do not invent new audit requirements unless clearly necessary.

---

# 11. API ERROR HANDLING

Test bad requests deliberately.

Examples:

* invalid UUID
* nonexistent project
* nonexistent IPC
* nonexistent document
* nonexistent BOQ item
* malformed JSON
* missing required fields
* wrong data types
* null values
* cross-project references

Verify:

* correct HTTP status
* consistent JSON error format
* no stack trace leaked
* no HTML error page
* no server crash
* no partial database write

---

# 12. FRONTEND ERROR HANDLING

Verify the UI properly handles:

* API 400
* API 401
* API 403
* API 404
* API 409
* API 500
* network failure
* empty data
* loading
* invalid form
* file upload failure
* preview failure

No silent failures.

No fake success messages.

---

# 13. SECURITY AUDIT

Perform a practical security review.

Check:

* authentication
* authorization
* CORS
* exposed ports
* file access
* path traversal risk
* unsafe file names
* MIME/content handling
* SQL injection risk
* parameterized queries
* arbitrary project access
* arbitrary IPC access
* arbitrary document access
* sensitive error leakage
* environment secrets accidentally committed
* production debug mode

Do not perform destructive security attacks.

Use safe validation tests only.

---

# 14. DOCKER / RUNTIME

Inspect actual Docker configuration.

Verify:

* web container
* API container
* PostgreSQL container
* internal networking
* port mappings
* persistent volumes
* storage persistence
* environment variables
* health checks
* Nginx proxy
* frontend → API routing

Verify:

`/api/health`

returns healthy and DB is connected.

Verify that restarting containers does NOT destroy:

* PostgreSQL data
* uploaded documents
* revisions

Also verify the difference between:

PERSISTENCE

and

BACKUP.

Do not claim backups exist unless an actual backup mechanism exists.

---

# 15. ONLINE ACCESS CHECK

Determine from the actual configuration:

Can the system currently be accessed:

1. localhost only?
2. LAN?
3. Internet?
4. through Cloudflare Tunnel?
5. through a public IP?
6. through a domain?
7. through HTTPS?

Do NOT guess.

Inspect:

* cloudflared
* Docker
* Nginx
* port mappings
* environment configuration

If Internet access cannot be verified from the local environment, clearly state:

`Not verified`

Do not claim it is online simply because Docker is running.

---

# 16. DATA INTEGRITY TEST

Create a complete isolated test scenario.

Use clearly identifiable TEST records.

Example:

Project TEST-A
Owner TEST-OWNER

BOQ:

Item A
Quantity 100
Unit price 10

IPC:

IPC-TEST-001
Quantity 30

Then:

IPC-TEST-002
Quantity 70

Then attempt:

IPC-TEST-003
Quantity 1

Verify rejection.

Create an Archive document related to IPC-TEST-001.

Create a revision.

Verify the entire chain.

Then clean up ONLY the test records.

Do NOT touch real user data.

Before deleting anything, identify test IDs explicitly.

---

# 17. REGRESSION TEST

After all tests, verify that existing real data remains intact.

At minimum verify:

* Projects still exist
* owner values remain correct
* BOQ totals unchanged
* IPC records unchanged
* Archive documents unchanged
* document revisions unchanged
* Financial Position calculations unchanged

Especially verify:

003 → إدارة المشروعات

4 → إدارة الفنادق

01 / 02 → بدون جهة

Do NOT modify those records during testing.

---

# 18. CODE QUALITY AUDIT

Inspect the implementation for:

* duplicated business logic
* dead code
* unreachable code
* unsafe `any`
* incorrect TypeScript types
* swallowed errors
* missing awaits
* missing transaction boundaries
* race conditions
* inconsistent status handling
* inconsistent null handling
* direct DB access from frontend
* business logic inside UI where it should be backend-enforced
* API validation gaps

Do not perform a broad refactor.

Only report findings unless a tiny safe fix is absolutely necessary.

---

# 19. TESTING RULES

This is extremely important.

DO NOT report:

"Looks good"

based only on code inspection.

For every important requirement, classify it as:

* PASS — actually tested
* FAIL — actually tested and failed
* PARTIAL — some verification but not complete
* NOT VERIFIED — could not test
* OUT OF SCOPE

For every FAIL:

Include:

* exact reproduction
* expected result
* actual result
* HTTP status if applicable
* affected file
* likely root cause
* severity

Severity:

* P0 = data loss/security/system unusable
* P1 = major business logic failure
* P2 = important bug but workaround exists
* P3 = minor/UI issue

---

# 20. DO NOT FIX FIRST

IMPORTANT:

Do NOT immediately start changing code.

First:

1. Inspect.
2. Test.
3. Record failures.
4. Determine severity.
5. Produce an initial audit report.

Only after the initial audit report, if you discover a clear regression caused by the previous implementation, you may implement the smallest safe fix.

If you make fixes:

* document each change
* retest the affected area
* rerun regression tests

Do NOT silently modify things.

---

# 21. REQUIRED FINAL REPORT

Return a serious QA report.

Use this exact structure:

# FULL ACCEPTANCE AUDIT

## A. Executive Summary

Overall status:

`PASS / PASS WITH ISSUES / FAIL`

Production readiness:

`READY / NOT READY / CONDITIONAL`

Total tests:

PASS:
FAIL:
PARTIAL:
NOT VERIFIED:
OUT OF SCOPE:

---

## B. Projects

| Area            | Result | Evidence |
| --------------- | ------ | -------- |
| Create          |        |          |
| Read            |        |          |
| Update          |        |          |
| Delete          |        |          |
| Owner           |        |          |
| Client          |        |          |
| Validation      |        |          |
| Null round-trip |        |          |
| Search          |        |          |
| Filters         |        |          |
| Relations       |        |          |

---

## C. Archive

| Area             | Result | Evidence |
| ---------------- | ------ | -------- |
| Upload           |        |          |
| Preview          |        |          |
| Download         |        |          |
| Metadata         |        |          |
| Revisions        |        |          |
| Delete safety    |        |          |
| Permissions      |        |          |
| IPC linkage      |        |          |
| Project linkage  |        |          |
| File persistence |        |          |

---

## D. BOQ

| Area                     | Result | Evidence |
| ------------------------ | ------ | -------- |
| CRUD                     |        |          |
| Items                    |        |          |
| Validation               |        |          |
| Cross-project protection |        |          |
| Delete safety            |        |          |
| Excel import             |        |          |
| Excel export             |        |          |
| Calculations             |        |          |
| Permissions              |        |          |

---

## E. IPC

| Area                     | Result | Evidence |
| ------------------------ | ------ | -------- |
| Create                   |        |          |
| Edit                     |        |          |
| GET→PUT round-trip       |        |          |
| Null fields              |        |          |
| Quantity limits          |        |          |
| Cross-project protection |        |          |
| Duplicate number         |        |          |
| Status lifecycle         |        |          |
| Delete safety            |        |          |
| Previous quantity        |        |          |
| Permissions              |        |          |

---

## F. Financial Position

| Area             | Result | Evidence |
| ---------------- | ------ | -------- |
| Owner grouping   |        |          |
| Search           |        |          |
| Filters          |        |          |
| BOQ calculations |        |          |
| IPC calculations |        |          |
| Group totals     |        |          |
| KPI totals       |        |          |
| Empty state      |        |          |
| Loading state    |        |          |
| Responsive UI    |        |          |

---

## G. Security

List every security issue.

If none:

`No verified security issues found.`

Do NOT say "secure" absolutely.

---

## H. Docker / Deployment

Explain exactly:

* what containers exist
* what ports are exposed
* what is internal
* what is LAN accessible
* what is Internet accessible
* whether Cloudflare Tunnel exists
* whether HTTPS exists
* whether PostgreSQL is externally exposed
* what persists
* what is backed up

---

## I. Bugs Found

For each bug:

### BUG #1

Severity:
Module:
Description:
Reproduction:
Expected:
Actual:
Root cause:
Files:
Fix status:

Repeat for every bug.

---

## J. Fixes Made During Audit

If you changed anything:

| File | Change | Reason | Verification |
| ---- | ------ | ------ | ------------ |

If no changes:

`No code changes were required.`

---

## K. Final Verdict

Answer these questions explicitly:

1. Are Projects production-ready?
2. Is Archive production-ready?
3. Is BOQ production-ready?
4. Is IPC production-ready?
5. Is Financial Position production-ready?
6. Are the four modules correctly integrated?
7. Are there any P0 issues?
8. Are there any P1 issues?
9. Are there any P2 issues?
10. Is the current version safe to hand over to real users?
11. What is the single most important remaining issue, if any?

---

# FINAL RULE

The purpose of this task is NOT to make the report look good.

The purpose is to find the truth.

If the previous agent made mistakes, expose them.

If everything is correct, prove it with actual tests.

Do not give credit for claimed work unless the repository/runtime confirms it.

Do not hide failures.

Do not invent successful test results.

Do not modify unrelated functionality.

This is an independent acceptance test of the current system.
