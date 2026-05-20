# GYM-SaaS Database Architecture - Professional Documentation

**Date:** May 5, 2026  
**Version:** 1.0  
**Database Technology:** SQLite + Prisma ORM  
**Architecture Style:** Relational with transactional consistency guarantees

---

## 1. ARCHITECTURAL OVERVIEW

### 1.1 Database Design Principles

The GYM-SaaS database follows a **normalized relational schema** with the following design principles:

- **Third Normal Form (3NF):** All entities are normalized to eliminate data redundancy and maintain referential integrity
- **ACID Compliance:** Transaction support for critical business operations (member inscription, subscription renewal, payment processing)
- **Referential Integrity:** Foreign key constraints with explicit delete strategies (CASCADE, RESTRICT, SET NULL)
- **Audit Trail:** Comprehensive logging of all state mutations via AuditLog entity
- **Type Safety:** Enum types for status and categorical fields to prevent invalid states

### 1.2 Core Bounded Contexts

The schema is organized into four logical domains:

1. **Identity & Audit** (User, AuditLog)
2. **Members & Subscriptions** (Member, MemberSubscription, SubscriptionPlan, Payment)
3. **Training Programs** (Sport, Coach, Group, GroupMember, GroupSchedule)
4. **Attendance & Sessions** (Session, Attendance)

---

## 2. ENTITY DESCRIPTIONS

### 2.1 Identity & Audit

#### **User**
- **Purpose:** Authentication and authorization
- **Primary Key:** `id: String (CUID)`
- **Unique Constraints:** `email`
- **Key Attributes:**
  - `role: UserRole` → ADMIN | STAFF (controls authorization scope)
  - `isActive: Boolean` → Soft-enable/disable user accounts
  - `passwordHash: String` → Bcrypt/argon2 hashed credentials
- **Relationships:** None direct (referenced by audit logs via userId)
- **Lifecycle:** Account creation at deployment; manual activation/deactivation; soft deletion via isActive flag
- **Notes:** Passwords never stored in plaintext; roles enforce API endpoint access control

#### **AuditLog**
- **Purpose:** Immutable record of all data mutations for compliance, debugging, and accountability
- **Primary Key:** `id: String (CUID)`
- **Key Attributes:**
  - `action: String` → Mutation operation (MEMBER_CREATED, SUBSCRIPTION_RENEWED, PAYMENT_RECORDED, etc.)
  - `entityType: String` → Type of entity modified (Member, MemberSubscription, Payment, etc.)
  - `entityId: String` → Reference to the specific entity instance
  - `userId: String` → User who performed the action (optional; system actions have null userId)
  - `details: String (JSON)` → Serialized before/after state or additional context
  - `createdAt: DateTime` → Immutable timestamp (UTC)
- **Relationships:** Implicit link to User (not enforced as FK; allows historical references to deleted users)
- **Lifecycle:** Write-once; never updated or deleted; kept indefinitely for audit trail
- **Cardinality:** Unbounded (grows with application lifetime; eventually requires archival strategy)
- **Query Patterns:**
  - Retrieve audit history for an entity: `WHERE entityId = ? AND entityType = ?`
  - Retrieve user actions: `WHERE userId = ? ORDER BY createdAt DESC`
  - Timeline reconstruction: `WHERE createdAt BETWEEN ? AND ? ORDER BY createdAt`

---

### 2.2 Members & Subscriptions

#### **Member**
- **Purpose:** Core identity for all gym participants; both adults and children
- **Primary Key:** `id: String (CUID)`
- **Unique Constraints:** `phone`
- **Key Attributes:**
  - **Identity:** `firstName`, `lastName`, `phone` (contact), `email` (optional, for notifications)
  - **Demographics:** `memberType: MemberType` → ADULT | KID | NOT_SPECIFIED
    - Determines if parent contact information is required (kids require `parentName`, `parentPhone`, `parentAddress`)
    - Affects group eligibility filtering (KIDS groups restricted to KID-type members)
  - **Dates:** `joinedAt` (inscription date), `archivedAt` (soft deletion marker)
  - **Status:** `MemberStatus` → ACTIVE | ARCHIVED
    - ACTIVE: Can create subscriptions, be assigned to groups, record attendance
    - ARCHIVED: Soft-deleted; retained for audit trail; cannot participate in new activities
- **Relationships:**
  - **1:N → MemberSubscription** (CASCADE delete) — All subscriptions deleted if member is archived or hard-deleted
  - **1:N → GroupMember** (RESTRICT delete) — Prevents deletion while assigned to groups
  - **1:N → Attendance** (CASCADE delete) — Historical attendance deleted if member is purged
- **Lifecycle:**
  1. Creation: User creates new member via /api/members POST with mandatory subscription plan
  2. Active: Member can enroll in groups, create subscriptions, record attendance
  3. Archived: `PATCH /api/members/:id { status: 'ARCHIVED', archivedAt: now }` triggers soft deletion
  4. Permanent Deletion: Only via raw database operation (RESTRICT FK prevents cascading deletions)
- **Business Rules:**
  - Phone number is globally unique (prevents duplicate account creation)
  - Member type is immutable after creation (no business case for changing type)
  - KID members require complete parent contact information
  - Archival preserves audit trail; ARCHIVED members cannot participate in new activities

#### **MemberSubscription**
- **Purpose:** Links members to subscription plans with billing and session tracking
- **Primary Key:** `id: String (CUID)`
- **Foreign Keys:**
  - `memberId: String (FK → Member, RESTRICT)` — Mandatory; cannot be null
  - `planId: String (FK → SubscriptionPlan, RESTRICT)` — Mandatory; cannot be null
- **Key Attributes:**
  - **Billing:** `amount: Int (cents)` → Total billed (may differ from plan.price if partial/pro-rata)
  - **Dates:**
    - `startDate: DateTime` — When subscription becomes active
    - `endDate: DateTime (nullable)` → Open-ended if null; closed if set
    - Business logic: subscription is ACTIVE iff `startDate ≤ now AND (endDate = null OR endDate ≥ now)`
  - **Session Tracking:** `remainingSessions: Int` → Decremented per attendance (PRESENT status only)
  - **Status:** `SubscriptionStatus` → DRAFT | ACTIVE | EXPIRED | CANCELLED
    - DRAFT: Awaiting first payment (new subscription)
    - ACTIVE: Can decrement sessions; member can attend
    - EXPIRED: `endDate < now`; no new sessions can be consumed
    - CANCELLED: User-initiated termination; member cannot attend despite plan duration
- **Relationships:**
  - **N:1 ← Member** (RESTRICT delete) — Prevents member deletion while subscriptions exist
  - **N:1 ← SubscriptionPlan** (RESTRICT delete) — Prevents plan deletion while subscriptions reference it
  - **1:N → Payment** (CASCADE delete) — Payments deleted if subscription is removed
  - **1:N ← Attendance** (SET NULL) — Attendance records keep historical reference; FK set to null if subscription deleted
- **Cardinality:** 1 member → N subscriptions (multiple subscriptions per member; only 1 ACTIVE at a time)
- **Lifecycle:**
  1. Created during member inscription or via renewal endpoint
  2. Auto-closure: When new subscription created, previous ACTIVE subscription → EXPIRED (see renewal logic)
  3. Session consumption: Each PRESENT attendance decrements `remainingSessions`
  4. Expiration: If `remainingSessions = 0 OR endDate < now`, subscription becomes EXPIRED
- **Business Rules:**
  - **Mandatory Subscription at Inscription:** POST /api/members requires `subscriptionPlanId`
  - **Single ACTIVE Subscription:** Only one subscription per member can be ACTIVE at any given time
  - **Auto-Renewal:** Creating new subscription automatically closes previous ACTIVE subscription (EXPIRED status)
  - **Session Depletion:** Cannot record PRESENT attendance if `remainingSessions = 0` or subscription not ACTIVE
  - **Audit Logging:** Both creation and renewal trigger audit entries with action differentiation (MEMBER_SUBSCRIPTION_CREATED vs MEMBER_SUBSCRIPTION_RENEWED)

#### **SubscriptionPlan**
- **Purpose:** Template for membership offerings; decoupled from specific member subscriptions
- **Primary Key:** `id: String (CUID)`
- **Unique Constraints:** `name`
- **Key Attributes:**
  - `description: String (optional)` → Marketing description
  - `price: Int (cents)` → Standard price (10€ → 1000 cents); basis for billing
  - `totalSessions: Int` → Session quota per subscription period (e.g., 12 séances/mois)
  - `sessionsPerWeek: Int (nullable)` → Weekly cap (e.g., 3 séances max/week); optional enforcement
  - `validityDays: Int` → Duration of subscription in days (e.g., 30 for monthly, 365 for yearly)
    - Used to calculate `endDate = startDate + validityDays` at subscription creation
  - `isActive: Boolean` → Soft toggle; INACTIVE plans cannot be assigned to new subscriptions
- **Relationships:**
  - **1:N → MemberSubscription** (RESTRICT delete) — Prevents plan deletion while active subscriptions reference it
- **Lifecycle:**
  1. Admin creates plan via admin panel
  2. ACTIVE: Can be selected during member inscription or subscription renewal
  3. INACTIVE: Deactivated by admin; existing subscriptions remain valid; new subscriptions cannot use this plan
- **Cardinality:** 1 plan → N subscriptions (many members may hold same plan type)
- **Business Rules:**
  - Plans are immutable after creation (except `isActive` toggle)
  - Deactivating a plan does NOT affect existing subscriptions
  - `sessionsPerWeek` is advisory; backend does not enforce weekly limits (future enhancement)
  - Price is fixed per plan; no per-member price overrides (custom pricing not supported)

#### **Payment**
- **Purpose:** Record financial transactions linked to subscription billing
- **Primary Key:** `id: String (CUID)`
- **Foreign Keys:**
  - `memberSubscriptionId: String (FK → MemberSubscription, CASCADE)` → Mandatory; payment must be tied to specific subscription
- **Key Attributes:**
  - `amount: Int (cents)` → Amount received (may be < plan.price for partial payments)
  - `paymentDate: DateTime` → When payment was recorded (defaults to current timestamp)
  - `paymentMethod: String (optional)` → Cash | Card | Transfer | Cheque (for bookkeeping)
  - `notes: String (optional)` → Free-form notes (e.g., "Partial payment - balance due")
- **Relationships:**
  - **N:1 ← MemberSubscription** (CASCADE delete) — Payments deleted if subscription is removed
- **Cardinality:** 1 subscription → N payments (supports partial payments over time)
- **Lifecycle:**
  1. Created automatically during member inscription (`POST /api/members` with optional payment)
  2. Manual addition: Payments can be recorded later via `POST /api/payments`
  3. Immutable: Once recorded, payments are never updated (audit trail integrity)
- **Business Rules:**
  - Payment amount can be < plan.price (supports partial/deposit payments)
  - Multiple payments per subscription supported (e.g., €50 + €50 for €100 plan)
  - No automatic reconciliation; business logic must track `paidAmount vs plan.price` for reporting
  - Payment history tied to specific subscription (useful for tracking partial payments during renewal)

---

### 2.3 Training Programs

#### **Sport**
- **Purpose:** Master list of training disciplines (Fitness, Football, Basketball, etc.)
- **Primary Key:** `id: String (CUID)`
- **Unique Constraints:** `name`
- **Key Attributes:**
  - `description: String (optional)` → Sport description
  - `isActive: Boolean` → Toggle active/inactive; affects group creation and filtering
- **Relationships:**
  - **1:N → Coach** (SET NULL on delete) — Coaches retain data if sport deleted; sportId becomes null
  - **1:N → Group** (RESTRICT delete) — Prevents deletion of sports with active groups
- **Lifecycle:**
  1. Admin creates sport
  2. ACTIVE: Available for group creation and filtering
  3. INACTIVE: Cannot assign to new groups; existing groups retain reference
- **Cardinality:** 1 sport → N coaches (coaches specialize in multiple sports)
- **Cardinality:** 1 sport → N groups (multiple groups per sport)

#### **Coach**
- **Purpose:** Trainers who lead groups and sessions
- **Primary Key:** `id: String (CUID)`
- **Unique Constraints:** `phone`
- **Foreign Keys:**
  - `sportId: String (FK → Sport, SET NULL on delete)` — Optional; coach can be sport-agnostic
- **Key Attributes:**
  - `firstName`, `lastName` → Identity
  - `phone` (UNIQUE), `email` (optional) → Contact
  - `isActive: Boolean` → Soft toggle; INACTIVE coaches cannot be assigned to new groups
- **Relationships:**
  - **N:1 ← Sport** (SET NULL) → Coach can specialize in one sport or be unassigned
  - **1:N → Group** (RESTRICT delete) → Prevents deletion while leading groups
  - **1:N → Session** (SET NULL on delete) → Sessions retain coach history; coachId becomes null
- **Cardinality:** 1 coach → N groups (coach may lead multiple groups)
- **Cardinality:** 1 coach → N sessions (coach holds multiple sessions)
- **Business Rules:**
  - Deletion prevention via RESTRICT on groups; can only delete coach if reassigned or groups archived

#### **Group**
- **Purpose:** Cohort of members in a specific sport with a coach; scheduling and attendance aggregation unit
- **Primary Key:** `id: String (CUID)`
- **Foreign Keys:**
  - `sportId: String (FK → Sport, RESTRICT)` — Mandatory; group must have a sport
  - `coachId: String (FK → Coach, RESTRICT)` → Mandatory; group must have assigned coach
- **Key Attributes:**
  - `name: String` → Group identifier (e.g., "Football - Tuesday 18:00")
  - `groupType: GroupType` → KIDS | ADULTS
    - Affects member eligibility filtering (KIDS groups restricted to KID-type members)
    - Drives UI/business logic for enrollment rules
  - `capacity: Int` → Maximum members in group
  - `room: String` → Physical location (e.g., "Salle A", "Terrain 1")
  - `isActive: Boolean` → Soft toggle; INACTIVE groups cannot accept new members
- **Relationships:**
  - **N:1 ← Sport** (RESTRICT delete)
  - **N:1 ← Coach** (RESTRICT delete)
  - **1:N → GroupMember** (CASCADE delete) → All memberships deleted if group is deleted
  - **1:N → GroupSchedule** (CASCADE delete) → All schedules deleted if group is deleted
  - **1:N → Session** (CASCADE delete) → All sessions deleted if group is deleted
- **Cardinality:** 1 group → N members (many members per group)
- **Cardinality:** 1 group → N schedules (multiple recurring time slots per group)
- **Cardinality:** 1 group → N sessions (each schedule generates sessions)
- **Business Rules:**
  - Grouptype filtering: Enrollment restricts KIDS groups to KID-type members
  - Capacity enforcement: UI should prevent enrollment beyond capacity
  - Cannot delete sport or coach if group references them (RESTRICT)

#### **GroupMember**
- **Purpose:** Junction table linking members to groups with temporal validity
- **Primary Key:** `id: String (CUID)`
- **Unique Constraint:** `[groupId, memberId]` → Prevents duplicate enrollment
- **Foreign Keys:**
  - `groupId: String (FK → Group, CASCADE)` → Mandatory
  - `memberId: String (FK → Member, RESTRICT)` → Mandatory
- **Key Attributes:**
  - `startDate: DateTime` → Enrollment start
  - `endDate: DateTime (nullable)` → Enrollment end; open-ended if null
  - `status: GroupMemberStatus` → ACTIVE | INACTIVE
    - ACTIVE: Member can attend sessions for this group
    - INACTIVE: Soft-exit; retains history; can be reactivated
- **Relationships:**
  - **N:1 ← Group** (CASCADE delete)
  - **N:1 ← Member** (RESTRICT delete)
- **Cardinality:** M:N relationship between Members and Groups
- **Business Rules:**
  - Only one ACTIVE enrollment per member per group (enforced by unique constraint + status filtering)
  - Soft-exit via INACTIVE status preserves history
  - Cannot delete member while enrolled in groups (RESTRICT)

#### **GroupSchedule**
- **Purpose:** Recurring time slots for group training; basis for session generation
- **Primary Key:** `id: String (CUID)`
- **Foreign Keys:**
  - `groupId: String (FK → Group, CASCADE)` → Mandatory
- **Key Attributes:**
  - `dayOfWeek: DayOfWeek` → MONDAY | TUESDAY | ... | SUNDAY (recurring day)
  - `startTime: String` → Session start time (e.g., "18:00"; stored as string for timezone flexibility)
  - `durationMinutes: Int` → Session duration (e.g., 60 minutes)
  - `effectiveFrom: DateTime` → When schedule becomes active
  - `effectiveTo: DateTime (nullable)` → When schedule ends; open-ended if null
- **Relationships:**
  - **N:1 ← Group** (CASCADE delete)
  - **1:N → Session** (SET NULL on delete) → Sessions retain schedule history; scheduleId becomes null
- **Cardinality:** 1 group → N schedules (e.g., Tuesday + Friday sessions for same group)
- **Business Rules:**
  - Schedule is a template; sessions are generated from schedules (not automated in schema; application logic)
  - Multiple schedules per group support various training times

---

### 2.4 Sessions & Attendance

#### **Session**
- **Purpose:** Specific instance of a training event; primary unit for attendance tracking
- **Primary Key:** `id: String (CUID)`
- **Unique Constraint:** `[groupId, sessionDate, startTime]` → Prevents duplicate sessions for same time/group
- **Foreign Keys:**
  - `groupId: String (FK → Group, CASCADE)` → Mandatory; session must belong to group
  - `scheduleId: String (FK → GroupSchedule, SET NULL)` → Optional; session linked to recurring schedule or standalone
  - `coachId: String (FK → Coach, SET NULL)` → Optional; coach may change; flexibility for ad-hoc substitutions
- **Key Attributes:**
  - **Scheduling:**
    - `sessionDate: DateTime` → Date of session
    - `startTime: String` → Session start time
    - `endTime: String` → Session end time
  - **Location:** `room: String` → Physical room/field
  - **Status:** `SessionStatus` → PLANNED | RESCHEDULED | CANCELLED | COMPLETED
    - PLANNED: Normal session
    - RESCHEDULED: Moved to different date; preserves audit trail
    - CANCELLED: Cancelled session; attendance not recorded
    - COMPLETED: Historical marker (optional; attendance suffices)
  - **Postponement:**
    - `postponedTo: DateTime` → If rescheduled, new date
    - `postponementReason: String` → Reason for postponement
    - `postponementDetails: String` → Additional context
  - **Exceptions:** `exceptionReason: String` → Reason if session deviates from schedule (e.g., "Coach absence")
- **Relationships:**
  - **N:1 ← Group** (CASCADE delete)
  - **N:1 ← GroupSchedule** (SET NULL on delete) → Preserves session history if schedule deleted
  - **N:1 ← Coach** (SET NULL on delete) → Preserves session history if coach deleted
  - **1:N → Attendance** (CASCADE delete)
- **Cardinality:** 1 group → N sessions (many sessions per group over time)
- **Lifecycle:**
  1. Created: Admin or system generates session from schedule or manually creates ad-hoc session
  2. PLANNED: Default state; awaiting session date
  3. RESCHEDULED: If moved, status changes and `postponedTo` is set
  4. Attendance Recording: On session date, members check in (creates Attendance records)
  5. COMPLETED: Optional state after attendance finalized (not enforced)
- **Business Rules:**
  - Cannot reschedule to same time (unique constraint prevents duplicates)
  - Cancelling a session should mark all associated attendances as CANCELLED (optional enforcement)
  - Only PRESENT attendance decrements subscription session counts

#### **Attendance**
- **Purpose:** Record of member participation (or non-participation) in a specific session
- **Primary Key:** `id: String (CUID)`
- **Unique Constraint:** `[sessionId, memberId]` → Prevents duplicate attendance records
- **Foreign Keys:**
  - `sessionId: String (FK → Session, CASCADE)` → Mandatory
  - `memberId: String (FK → Member, CASCADE)` → Mandatory
  - `memberSubscriptionId: String (FK → MemberSubscription, SET NULL)` → Optional; tracks which subscription session consumed from
- **Key Attributes:**
  - **Status:** `AttendanceStatus` → PRESENT | ABSENT | OVERRIDE
    - PRESENT: Member attended; `remainingSessions` decremented
    - ABSENT: Member didn't attend; no session consumed
    - OVERRIDE: Manual adjustment (e.g., mark present despite absence for medical reasons); no automatic session decrement
  - **Metadata:**
    - `overrideReason: String` → Reason for OVERRIDE status
    - `checkedBy: String` → User ID who recorded attendance
    - `checkedAt: DateTime` → When attendance was recorded
  - **Audit Timestamps:** `createdAt`, `updatedAt` → Record lifecycle
- **Relationships:**
  - **N:1 ← Session** (CASCADE delete)
  - **N:1 ← Member** (CASCADE delete)
  - **N:1 ← MemberSubscription** (SET NULL on delete) → Attendance retained; FK cleared if subscription deleted
- **Cardinality:** 1 session → N attendances (one per member attending)
- **Lifecycle:**
  1. Created: On session date, member checks in via UI (POST /api/attendances)
  2. Status Updated: Can be changed from PRESENT → ABSENT or vice versa (PATCH)
  3. Session Decrement: Only applied if status = PRESENT (idempotent: revisiting doesn't double-decrement)
  4. Historical Record: Never deleted; preserved for audit trail
- **Business Rules:**
  - Only one attendance record per (session, member) pair (unique constraint)
  - PRESENT status triggers `remainingSessions -= 1` on subscription
  - ABSENT and OVERRIDE status do NOT consume sessions
  - OVERRIDE status available only to ADMIN/STAFF users
  - Attendance can be recorded for members without active subscriptions (edge case; should be validated at API)

---

## 3. RELATIONSHIP CARDINALITY & DELETE STRATEGIES

### 3.1 Cardinality Summary

| From | To | Cardinality | Delete Strategy | Reason |
|------|-----|-------------|-----------------|--------|
| Member | MemberSubscription | 1:N | CASCADE | Subscriptions tied to member lifecycle |
| MemberSubscription | SubscriptionPlan | N:1 | RESTRICT | Plans are templates; prevent accidental deletion |
| MemberSubscription | Payment | 1:N | CASCADE | Payments belong to subscription; delete together |
| Member | Attendance | 1:N | CASCADE | Attendance is member activity; cascade deletion cleans audit trail |
| MemberSubscription | Attendance | 1:N | SET NULL | Attendance history preserved; FK cleared for deleted subscription |
| Sport | Coach | 1:N | SET NULL | Coach can exist without sport; flexible assignment |
| Coach | Group | 1:N | RESTRICT | Cannot delete coach if leading groups |
| Sport | Group | 1:N | RESTRICT | Cannot delete sport if groups reference it |
| Group | GroupMember | 1:N | CASCADE | Enrollment tied to group lifecycle |
| Member | GroupMember | 1:N | RESTRICT | Cannot delete member while enrolled in groups |
| Group | Session | 1:N | CASCADE | Sessions cascade from group deletion |
| Group | GroupSchedule | 1:N | CASCADE | Schedules cascade from group deletion |
| GroupSchedule | Session | 1:N | SET NULL | Sessions retain schedule history; FK cleared |
| Coach | Session | 1:N | SET NULL | Sessions retain coach history; FK cleared |
| Session | Attendance | 1:N | CASCADE | Attendance tied to session lifecycle |

### 3.2 Delete Strategy Rationale

- **CASCADE:** Used for composition relationships (part cannot exist without whole)
  - MemberSubscription ← Member
  - Payment ← MemberSubscription
  - Attendance ← Session
  - GroupMember ← Group
  - GroupSchedule ← Group
  - Session ← Group

- **RESTRICT:** Used for template/reference relationships (deletion would orphan dependent data)
  - Coach ← Group (cannot delete coach while leading)
  - Sport ← Group (cannot delete sport while groups exist)
  - SubscriptionPlan ← MemberSubscription (cannot delete plan template while active subscriptions exist)
  - Member ← GroupMember (cannot delete member while enrolled)

- **SET NULL:** Used for optional references that don't compose the entity
  - Sport ← Coach (coach can exist without sport assignment)
  - GroupSchedule ← Session (session can exist with null schedule if manually created)
  - Coach ← Session (session can exist with null coach if unassigned)
  - MemberSubscription ← Attendance (attendance history preserved; reference cleared)

---

## 4. TRANSACTION PATTERNS

### 4.1 Critical Multi-Step Operations

#### Member Inscription (Atomic Transaction)
```
BEGIN TRANSACTION
  1. Create Member { firstName, lastName, phone, ... }
  2. Create MemberSubscription { memberId, planId, status: ACTIVE, startDate: now, remainingSessions: plan.totalSessions }
  3. If payment provided:
     Create Payment { memberSubscriptionId, amount, paymentDate: now }
  4. Create AuditLog (entry for MEMBER_CREATED)
  5. Create AuditLog (entry for MEMBER_SUBSCRIPTION_CREATED)
  6. Create AuditLog (entry for PAYMENT_RECORDED) [if payment]
COMMIT
```
**Consistency Guarantee:** All-or-nothing; member, subscription, payment, and audit entries created together.

#### Subscription Renewal (Atomic Transaction)
```
BEGIN TRANSACTION
  1. Query existing ACTIVE subscription for member
  2. If found:
     - Update old subscription: status = EXPIRED, endDate = now
     - Create AuditLog (MEMBER_SUBSCRIPTION_EXPIRED)
  3. Create new MemberSubscription { status: ACTIVE, startDate: now, remainingSessions: plan.totalSessions }
  4. Create AuditLog (MEMBER_SUBSCRIPTION_RENEWED)
COMMIT
```
**Consistency Guarantee:** Old subscription atomically transitioned to EXPIRED; new subscription created; no window for duplicate ACTIVE subscriptions.

#### Session Attendance with Decrement (Atomic Transaction)
```
BEGIN TRANSACTION
  1. Validate: subscription is ACTIVE AND remainingSessions > 0
  2. Create Attendance { status: PRESENT, ... }
  3. If status = PRESENT:
     UPDATE MemberSubscription SET remainingSessions = remainingSessions - 1 WHERE id = memberSubscriptionId
  4. Create AuditLog (ATTENDANCE_RECORDED, details: { old: {...}, new: {...} })
COMMIT
```
**Consistency Guarantee:** Attendance recorded and session counter decremented atomically; no lost updates.

---

## 5. QUERY PATTERNS & INDEXES

### 5.1 High-Frequency Queries

```sql
-- Member Dashboard: Fetch all subscriptions for member
SELECT * FROM MemberSubscription 
WHERE memberId = ? 
ORDER BY createdAt DESC;

-- Active Subscription: Fetch active subscription for session recording
SELECT * FROM MemberSubscription 
WHERE memberId = ? AND status = 'ACTIVE' 
  AND startDate <= ? AND (endDate IS NULL OR endDate >= ?);

-- Attendance Today: Fetch all attendances for a session
SELECT a.*, m.firstName, m.lastName 
FROM Attendance a 
JOIN Member m ON a.memberId = m.id 
WHERE a.sessionId = ?;

-- Group Members: Fetch all members in a group (ACTIVE only)
SELECT m.* FROM Member m 
JOIN GroupMember gm ON m.id = gm.memberId 
WHERE gm.groupId = ? AND gm.status = 'ACTIVE';

-- Sessions for Group: Fetch upcoming sessions
SELECT * FROM Session 
WHERE groupId = ? AND sessionDate >= DATE('now') 
ORDER BY sessionDate, startTime;
```

### 5.2 Recommended Indexes

- `Member(phone)` — Unique lookup
- `MemberSubscription(memberId, status)` — Filter by member + status
- `MemberSubscription(planId)` — Foreign key lookup
- `Attendance(sessionId, memberId)` — Unique constraint enforcement
- `Attendance(memberId)` — Query attendance history by member
- `GroupMember(groupId, status)` — Filter by group + status
- `GroupMember(memberId)` — Query group membership for member
- `Session(groupId, sessionDate)` — Filter sessions by group and date
- `AuditLog(entityType, entityId)` — Query audit trail by entity
- `AuditLog(createdAt)` — Timeline queries

---

## 6. BUSINESS RULES & CONSTRAINTS

### 6.1 Member Rules
- Phone number is globally unique; prevents duplicate registrations
- Member type is immutable; determines parent contact requirements and group eligibility
- Archival (soft deletion) preserves audit trail; archived members cannot participate in new activities
- RESTRICT on deletion prevents removal while enrolled in groups

### 6.2 Subscription Rules
- Mandatory at member inscription; cannot create member without subscription plan
- Single ACTIVE subscription per member at any time; renewal auto-closes previous ACTIVE
- Subscription status determined by:
  - `remainingSessions > 0 AND startDate ≤ now AND (endDate = null OR endDate ≥ now)` → ACTIVE
  - Otherwise → EXPIRED (endDate < now) or CANCELLED (user action)
- Session consumption only for PRESENT attendance; ABSENT and OVERRIDE don't decrement
- Audit logging distinguishes between new subscription creation and renewal

### 6.3 Group Rules
- GroupType filtering: KIDS groups restrict enrollment to KID-type members
- Capacity enforcement: UI should prevent enrollment beyond capacity (optional API validation)
- Cannot delete sport or coach if referenced by groups (RESTRICT)

### 6.4 Session Rules
- Unique constraint on `[groupId, sessionDate, startTime]` prevents duplicate sessions
- Rescheduling changes status to RESCHEDULED and sets `postponedTo`
- Only PRESENT attendance counts toward subscription session limits
- Attendance can be recorded for members without active subscriptions (edge case; should warn in UI)

### 6.5 Audit Rules
- All critical mutations (member creation, subscription renewal, payment, attendance) logged
- Audit entries are immutable (write-once)
- User ID optional; system-triggered actions have null userId
- Details field stores JSON-serialized before/after state for transaction replay

---

## 7. SCALABILITY & PERFORMANCE CONSIDERATIONS

### 7.1 Scaling Points

- **Attendance Records:** Grows fastest (N members × M sessions/year); requires archival strategy
- **Audit Logs:** Unbounded growth; consider time-series archival (e.g., 3-year retention)
- **Members:** Manageable; soft-deletion preserves active/archived distinction

### 7.2 Optimization Strategies

- **Indexes on Foreign Keys:** Improve JOIN performance for common queries
- **Partitioning Attendance by Date:** For large datasets; monthly partitions reduce query scans
- **Audit Log Archival:** Archive logs older than 1-3 years to cold storage; keep hot logs in active DB
- **Caching Active Subscriptions:** Cache member's active subscription (TTL: 5 min) to reduce DB hits
- **Session Listing Pagination:** Always paginate session results; avoid full table scans

### 7.3 SQLite Limitations

- SQLite suitable for ~10-100K members; scaling beyond requires migration to PostgreSQL/MySQL
- No built-in partitioning; manual archival required for large audit logs
- Concurrent writes limited; transaction conflicts increase under high load

---

## 8. DATA MIGRATION & VERSIONING

### 8.1 Current Schema Version
- Version: 1.0 (as of May 5, 2026)
- Latest Migration: `/prisma/migrations/20260428171933_session_based_plans/`

### 8.2 Migration Strategy
- Each schema change creates new migration with timestamp
- Migrations are immutable; rollback requires reverse migration
- Audit logs preserve data lineage across schema versions

---

## 9. ERD DIAGRAM LEGEND

The accompanying `GYM-SaaS-ERD.drawio` file includes:

- **Entities (Blue Boxes):** UML-style entity representations
- **Primary Keys (Yellow):** Marked with 🔑 icon
- **Foreign Keys (Green):** Marked with 🔗 icon; includes cardinality notation
- **Relationships (Lines):**
  - **Solid Lines:** Mandatory relationships (NOT NULL foreign keys)
  - **Dashed Lines:** Optional relationships (nullable foreign keys)
  - **Cardinality Notation:** 1:N (one-to-many), N:1 (many-to-one), M:N (many-to-many via junction)
  - **Delete Strategy:** CASCADE, RESTRICT, SET NULL annotated on each relationship

---

## 10. REFERENCES & CONVENTIONS

- **CUID:** Cryptographically unique identifier (collision-resistant alternative to UUID)
- **UTC Timezone:** All timestamps in UTC; application converts to local timezone (Africa/Tunis)
- **Soft Deletion:** Records marked INACTIVE/ARCHIVED but not physically deleted; preserves audit trail
- **3NF Normalization:** Data is fully normalized; no redundant attributes
- **Referential Integrity:** All foreign keys enforced by database constraints
- **Type Safety:** Enums prevent invalid states; checked at database and application levels

---

**Document Version:** 1.0  
**Last Updated:** May 5, 2026  
**Maintainer:** GYM-SaaS Architecture Team
