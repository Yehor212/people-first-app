-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user_data table for storing all user app data
CREATE TABLE IF NOT EXISTS public.user_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_data_user_id ON public.user_data(user_id);

-- Enable Row Level Security
ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data
CREATE POLICY "Users can view their own data"
    ON public.user_data
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own data"
    ON public.user_data
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own data"
    ON public.user_data
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own data"
    ON public.user_data
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create push_subscriptions table for push notifications
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    endpoint TEXT NOT NULL,
    keys JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, endpoint)
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for push_subscriptions
CREATE POLICY "Users can view their own subscriptions"
    ON public.push_subscriptions
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
    ON public.push_subscriptions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
    ON public.push_subscriptions
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
    ON public.push_subscriptions
    FOR DELETE
    USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for user_data
CREATE TRIGGER update_user_data_updated_at
    BEFORE UPDATE ON public.user_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Note: push_subscriptions doesn't have updated_at, no trigger needed

-- Grant permissions
GRANT ALL ON public.user_data TO authenticated;
GRANT ALL ON public.push_subscriptions TO authenticated;
