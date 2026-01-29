-- =============================================
-- Migration: Feedback Table
-- Created: 2026-01-25
-- Description: Creates feedback table for user submissions
-- =============================================

-- Feedback table for user submissions
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('bug', 'feature', 'other')),
  message TEXT NOT NULL,
  email TEXT,
  device_info JSONB,
  app_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment to table
COMMENT ON TABLE public.feedback IS 'User feedback submissions from the app';

-- Enable Row Level Security
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to insert feedback (anonymous submissions allowed)
-- This allows both authenticated and unauthenticated users to submit feedback
CREATE POLICY "Anyone can insert feedback"
  ON public.feedback
  FOR INSERT
  WITH CHECK (true);

-- Policy: Only service role can read feedback (admin access)
-- Regular users cannot read other users' feedback
CREATE POLICY "Service role can read feedback"
  ON public.feedback
  FOR SELECT
  USING (auth.role() = 'service_role');

-- Create index for faster querying by date
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);

-- Create index for filtering by category
CREATE INDEX IF NOT EXISTS idx_feedback_category ON public.feedback(category);
