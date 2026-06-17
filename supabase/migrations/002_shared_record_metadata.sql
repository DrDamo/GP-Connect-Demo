-- Add user-defined name, description, and version tracking to patient_drafts.
-- Run in Supabase SQL Editor after 001_initial.sql.

ALTER TABLE public.patient_drafts
  ADD COLUMN IF NOT EXISTS name        text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS version     integer not null default 1;
