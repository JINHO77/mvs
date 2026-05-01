-- Fix: announcements table had only a RESTRICTIVE policy with no PERMISSIVE policy.
-- PostgreSQL requires at least one PERMISSIVE policy to pass; RESTRICTIVE-only = deny all.
-- Direct SELECT on announcements (e.g. /announcements/[id]) was always blocked for non-owners.
-- get_my_announcements RPC worked because it is SECURITY DEFINER (bypasses RLS).

DROP POLICY IF EXISTS announcements_select_visible_targets ON public.announcements;

CREATE POLICY announcements_select_visible_targets
  ON public.announcements
  FOR SELECT
  TO authenticated
  USING (public.can_current_user_read_announcement(id));
