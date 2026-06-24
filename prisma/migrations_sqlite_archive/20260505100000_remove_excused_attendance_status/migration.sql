-- Normalize legacy EXCUSED values to ABSENT
UPDATE "Attendance"
SET "status" = 'ABSENT'
WHERE "status" = 'EXCUSED';
