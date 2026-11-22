-- Check Gmail when the Gmail app shows a notification (default on). The phone then reads new bank emails right away
-- instead of waiting for its next 5 minute check. Only the on/off choice is stored.
-- Rollback: alter table public.user_settings drop column gmail_alert_check;

alter table public.user_settings add column gmail_alert_check boolean not null default true;
