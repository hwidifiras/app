-- Database-level tenant guardrails.
-- Prisma's request extension remains the first line of defense; these constraints
-- prevent raw SQL, nested writes, or future unscoped code from creating tenantless
-- or cross-tenant business records.

DO $$
DECLARE
  table_name TEXT;
  constraint_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'User',
    'UserPermission',
    'PasswordResetToken',
    'NotificationRead',
    'ClubSettings',
    'Member',
    'Household',
    'HouseholdMember',
    'Sport',
    'Coach',
    'CoachSportQualification',
    'Group',
    'GroupMember',
    'GroupSchedule',
    'ScheduleTemplate',
    'ScheduleTemplateSlot',
    'Session',
    'SubscriptionPlan',
    'MemberSubscription',
    'PlanEntitlement',
    'SubscriptionEntitlement',
    'Payment',
    'Receipt',
    'Offer',
    'OfferApplication',
    'Attendance',
    'AuditLog'
  ]
  LOOP
    constraint_name := table_name || '_tenantId_required';
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I CHECK ("tenantId" IS NOT NULL) NOT VALID',
      table_name,
      constraint_name
    );
    EXECUTE format(
      'ALTER TABLE %I VALIDATE CONSTRAINT %I',
      table_name,
      constraint_name
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION prevent_tenant_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."tenantId" IS DISTINCT FROM NEW."tenantId" THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = format('TENANT_REASSIGNMENT_FORBIDDEN: %s(%s)', TG_TABLE_NAME, OLD."id");
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_name TEXT;
  trigger_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'User',
    'UserPermission',
    'PasswordResetToken',
    'NotificationRead',
    'ClubSettings',
    'Member',
    'Household',
    'HouseholdMember',
    'Sport',
    'Coach',
    'CoachSportQualification',
    'Group',
    'GroupMember',
    'GroupSchedule',
    'ScheduleTemplate',
    'ScheduleTemplateSlot',
    'Session',
    'SubscriptionPlan',
    'MemberSubscription',
    'PlanEntitlement',
    'SubscriptionEntitlement',
    'Payment',
    'Receipt',
    'Offer',
    'OfferApplication',
    'Attendance',
    'TenantModule',
    'GymVisit',
    'AuditLog'
  ]
  LOOP
    trigger_name := lower(table_name || '_tenant_reassignment_guard');
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OF "tenantId" ON %I '
      || 'FOR EACH ROW EXECUTE FUNCTION prevent_tenant_reassignment()',
      trigger_name,
      table_name
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION enforce_same_tenant_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  reference_id TEXT;
  parent_tenant_id TEXT;
BEGIN
  reference_id := to_jsonb(NEW) ->> TG_ARGV[1];

  IF reference_id IS NULL OR reference_id = '' THEN
    RETURN NEW;
  END IF;

  EXECUTE format('SELECT "tenantId" FROM %I WHERE "id" = $1', TG_ARGV[0])
    INTO parent_tenant_id
    USING reference_id;

  IF parent_tenant_id IS NULL OR NEW."tenantId" IS DISTINCT FROM parent_tenant_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = format(
        'TENANT_REFERENCE_MISMATCH: %s.%s -> %s(%s)',
        TG_TABLE_NAME,
        TG_ARGV[1],
        TG_ARGV[0],
        reference_id
      );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION create_tenant_reference_guard(
  child_table TEXT,
  foreign_column TEXT,
  parent_table TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  trigger_name TEXT := lower(child_table || '_' || foreign_column || '_tenant_guard');
BEGIN
  EXECUTE format(
    'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF "tenantId", %I ON %I '
    || 'FOR EACH ROW EXECUTE FUNCTION enforce_same_tenant_reference(%L, %L)',
    trigger_name,
    foreign_column,
    child_table,
    parent_table,
    foreign_column
  );
END;
$$;

SELECT create_tenant_reference_guard('UserPermission', 'userId', 'User');
SELECT create_tenant_reference_guard('PasswordResetToken', 'userId', 'User');
SELECT create_tenant_reference_guard('NotificationRead', 'userId', 'User');
SELECT create_tenant_reference_guard('HouseholdMember', 'householdId', 'Household');
SELECT create_tenant_reference_guard('HouseholdMember', 'memberId', 'Member');
SELECT create_tenant_reference_guard('Coach', 'sportId', 'Sport');
SELECT create_tenant_reference_guard('CoachSportQualification', 'coachId', 'Coach');
SELECT create_tenant_reference_guard('CoachSportQualification', 'sportId', 'Sport');
SELECT create_tenant_reference_guard('Group', 'sportId', 'Sport');
SELECT create_tenant_reference_guard('Group', 'coachId', 'Coach');
SELECT create_tenant_reference_guard('GroupMember', 'groupId', 'Group');
SELECT create_tenant_reference_guard('GroupMember', 'memberId', 'Member');
SELECT create_tenant_reference_guard('GroupSchedule', 'groupId', 'Group');
SELECT create_tenant_reference_guard('ScheduleTemplateSlot', 'templateId', 'ScheduleTemplate');
SELECT create_tenant_reference_guard('Session', 'groupId', 'Group');
SELECT create_tenant_reference_guard('Session', 'scheduleId', 'GroupSchedule');
SELECT create_tenant_reference_guard('Session', 'coachId', 'Coach');
SELECT create_tenant_reference_guard('SubscriptionPlan', 'sportId', 'Sport');
SELECT create_tenant_reference_guard('MemberSubscription', 'memberId', 'Member');
SELECT create_tenant_reference_guard('MemberSubscription', 'planId', 'SubscriptionPlan');
SELECT create_tenant_reference_guard('MemberSubscription', 'sportId', 'Sport');
SELECT create_tenant_reference_guard('MemberSubscription', 'offerApplicationId', 'OfferApplication');
SELECT create_tenant_reference_guard('PlanEntitlement', 'planId', 'SubscriptionPlan');
SELECT create_tenant_reference_guard('PlanEntitlement', 'sportId', 'Sport');
SELECT create_tenant_reference_guard('SubscriptionEntitlement', 'memberSubscriptionId', 'MemberSubscription');
SELECT create_tenant_reference_guard('SubscriptionEntitlement', 'planEntitlementId', 'PlanEntitlement');
SELECT create_tenant_reference_guard('SubscriptionEntitlement', 'sportId', 'Sport');
SELECT create_tenant_reference_guard('Payment', 'memberSubscriptionId', 'MemberSubscription');
SELECT create_tenant_reference_guard('Payment', 'correctsPaymentId', 'Payment');
SELECT create_tenant_reference_guard('Payment', 'createdById', 'User');
SELECT create_tenant_reference_guard('Receipt', 'paymentId', 'Payment');
SELECT create_tenant_reference_guard('Receipt', 'issuedById', 'User');
SELECT create_tenant_reference_guard('Offer', 'sportId', 'Sport');
SELECT create_tenant_reference_guard('Offer', 'createdById', 'User');
SELECT create_tenant_reference_guard('OfferApplication', 'offerId', 'Offer');
SELECT create_tenant_reference_guard('OfferApplication', 'createdById', 'User');
SELECT create_tenant_reference_guard('Attendance', 'sessionId', 'Session');
SELECT create_tenant_reference_guard('Attendance', 'memberId', 'Member');
SELECT create_tenant_reference_guard('Attendance', 'memberSubscriptionId', 'MemberSubscription');
SELECT create_tenant_reference_guard('Attendance', 'subscriptionEntitlementId', 'SubscriptionEntitlement');
SELECT create_tenant_reference_guard('GymVisit', 'memberId', 'Member');
SELECT create_tenant_reference_guard('GymVisit', 'memberSubscriptionId', 'MemberSubscription');
SELECT create_tenant_reference_guard('GymVisit', 'subscriptionEntitlementId', 'SubscriptionEntitlement');
SELECT create_tenant_reference_guard('GymVisit', 'correctsVisitId', 'GymVisit');
SELECT create_tenant_reference_guard('GymVisit', 'checkedById', 'User');
SELECT create_tenant_reference_guard('AuditLog', 'userId', 'User');

DROP FUNCTION create_tenant_reference_guard(TEXT, TEXT, TEXT);
