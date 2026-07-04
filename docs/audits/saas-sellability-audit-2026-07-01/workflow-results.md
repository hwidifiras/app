# Workflow Results

Date: 2026-07-01  
Target: `https://we-discipline.com`  
Dataset: temporary `audit-ux-*`, cleaned after run

## Functional Workflow Script

Result: 23/23 passed.

Covered:
- unauthenticated `/api/auth/me`;
- audit admin login;
- authenticated `/api/auth/me` reloads current DB user;
- overpayment rejection;
- partial payment creation;
- payment correction reason requirement;
- payment correction ledger row creation;
- payment reversal reason requirement;
- payment reversal ledger row creation;
- payment audit log reason visibility;
- unpaid normal attendance rejection;
- override attendance reason requirement;
- incomplete session finalization rejection;
- paid attendance creation;
- partial-paid attendance allowed by club setting;
- unpaid exceptional attendance with reason;
- session finalization;
- finalized attendance edit rejection;
- import preview guarded by temporary reprise mode;
- import mode activation;
- French-header import preview with generated code;
- import mode deactivation;
- logout clears auth.

## Enrollment Smoke Script

Result: 8/8 passed.

Covered:
- tenant and audit records exist;
- stale smoke member cleanup;
- audit admin login;
- enrollment quote for a new member;
- enrollment apply creates member, subscription, payment, group assignment, and undo snapshot;
- created rows are present before revert;
- enrollment revert succeeds;
- reverted enrollment leaves no created rows.

## Interpretation

The core product logic is in better shape than the UI first impression suggests. The main readiness risk is now presentation and staff comprehension, not data integrity in these covered workflows.

## Cleanup

`seed-audit-ux-data.mjs cleanup` returned zero remaining temporary members, sessions, attendances, payments, offers, and users for prefix `audit-ux`.
