# Security audit — Acesso Zetta

This repository-level checklist complements (and does not replace) the Lovable Security Quick and Deep Scans or a live Supabase project audit.

## Confirmed from the current source tree

- The browser Supabase client reads only the project URL and publishable key. A Supabase publishable/anon key is designed to be public; authorization must be enforced by RLS.
- The tracked `.env` currently contains the project identifier, Supabase URL, and publishable key variants. The reviewed key names do not include a service-role or secret key. Do not put secrets in this file.
- The service-role key is read by `src/integrations/supabase/client.server.ts`. Its documented intended use is server-side only; server handlers load it dynamically.
- The `firestore_docs` and `user_settings` migrations enable RLS and define owner-scoped policies using `auth.uid() = user_id`.
- Storage migrations define owner-folder policies for the `attachments` and `avatars` buckets. These SQL policies do not prove that the live buckets are private.
- API handlers for Pluggy and fiscal lookup/OCR call `requireUserId` before processing requests. Pluggy credentials are encrypted with AES-256-GCM and a server-side environment secret.
- A CodeQL and quality-check workflow is included to run on pull requests, pushes to main, weekly, and manually.

## Required checks outside this repository

These checks require access to the Lovable project and the connected Supabase dashboard; they cannot be verified from Git source alone.

1. Run Lovable Security > Quick Scan and Deep Scan. Review and resolve every red/yellow finding; retain the scan result as evidence.
2. In Supabase, enumerate every schema/table and confirm RLS is enabled where browser roles can access data. Review all policies, grants, views, RPCs, and exposed schemas for unintended public access.
3. Confirm the live `attachments` and `avatars` bucket visibility is private. Test anonymous and cross-user read/write attempts, including signed URL behavior.
4. In Lovable Cloud Secrets / server environment, verify `SUPABASE_SERVICE_ROLE_KEY`, `ORION_INTEGRATION_ENCRYPTION_KEY`, and third-party credentials are configured only server-side. Rotate any secret ever committed or exposed.
5. In Auth settings, verify production-only redirect URLs, leaked-password protection, minimum password policy, brute-force/rate limits, and SMTP configuration. These settings are managed outside this repository.
6. Review OAuth provider settings and production domain allowlists. Confirm HTTPS on the deployed domain.
7. Confirm whether the product is shipped inside a native Capacitor/Cordova/WebView wrapper. If so, separately assess secure token storage and the app's allowed network origins.

## Important boundaries

- The SQL migrations describe intended policies, not the current live database state. Existing tables, manually-created policies, grants, and bucket visibility must be checked in the Supabase project.
- The Lovable Security scan is a mandatory pre-publish gate and must be run in the Lovable UI by an authorized project user.
- Do not publish or merge this branch until the automated checks pass and the required Lovable/Supabase dashboard checks are complete.
