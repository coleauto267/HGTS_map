-- Run in the Supabase SQL editor to rename the projects.category column to job.
-- Postgres updates the existing check constraint and index automatically.

alter table projects rename column category to job;
