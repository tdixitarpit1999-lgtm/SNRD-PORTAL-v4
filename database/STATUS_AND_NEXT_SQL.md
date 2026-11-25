# Supabase status and next work

This file documents the current known state; it does not run migrations.

## Existing confirmed objects
- `students`: bigint `id`; admission_number, full_name, date_of_birth, gender, admission_date, address, student_phone, status, created_at. RLS enabled.
- `guardians`: bigint `id`; full_name, mobile_number, alternate_mobile, email, address, created_at. RLS enabled.
- `student_guardians`: guardian_id -> guardians.id; student_id -> students.id; composite PK.
- `enrollments`: bigint `id`, student_id, session_id, section_id, roll_number, enrollment_date, status.
- `family_accounts`: user_id uuid PK -> auth.users.id; guardian_id bigint unique -> guardians.id; created_at. RLS enabled.
- `user_profiles`: user_id, full_name, role, is_active, created_at. Roles include super_admin, office_admin, teacher, parent, student.
- `is_super_admin()` and `is_family_guardian(bigint)` exist as SECURITY DEFINER functions with empty search_path.
- Parent SELECT policies were created for family_accounts, guardians, student_guardians, students, enrollments.
- Authenticated SELECT policies were created for classes, sections, academic_sessions, class_offerings, mediums, streams.

## Must test before real data
1. Test each role with separate accounts using Supabase Auth and RLS.
2. Verify parent A cannot read parent B's students, guardian rows, or enrollments.
3. Verify parent cannot INSERT/UPDATE/DELETE on any school data or change user_profiles.role.
4. Verify super_admin access remains intact.
5. Review SECURITY DEFINER function EXECUTE grants and ensure only required roles can call.
6. Ensure no broad grants bypass intended RLS; review Supabase API exposed schemas.
7. Add Storage bucket `student-photos` as private and add policies scoped to admin upload and linked-parent read.
8. Add audit logging, backups, MFA for admin, rate limits and production monitoring.

## Important architecture note
One family login maps to one `guardians` row through `family_accounts`. That guardian can be connected to multiple students through `student_guardians`. If a family requires separate mother/father contact records, model that explicitly later; do not attach one Auth user to multiple guardian rows under this unique mapping.

## Not implemented yet
- Office Admin and Teacher detailed data permissions.
- Fee tables, fee receipts, payments.
- Attendance tables and policies.
- Exam/marks tables and policies.
- Private document storage.
- Student photo bucket/storage policies.
- Cross-device single active session enforcement.
- Android APK build/signing and deployment.
