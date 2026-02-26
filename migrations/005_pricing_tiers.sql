-- Migration 005: Update pricing tiers from free/growth/enterprise to PPC model
--
-- Tiers: paygo ($0.05/call), starter ($250/10K), growth ($500/25K),
--         scale ($1,000/75K), enterprise ($2,000/200K)

-- 1. Add monthly_limit column (replacing daily_limit)
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS monthly_limit INTEGER NOT NULL DEFAULT 999999999;

-- 2. Migrate existing data
UPDATE api_keys SET monthly_limit = 999999999 WHERE tier = 'free';
UPDATE api_keys SET tier = 'paygo' WHERE tier = 'free';

-- 3. Drop old constraint, add new one
ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_tier_check;
ALTER TABLE api_keys ADD CONSTRAINT api_keys_tier_check
    CHECK (tier IN ('paygo', 'starter', 'growth', 'scale', 'enterprise'));

-- 4. Update subscriptions tier constraint
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_tier_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_tier_check
    CHECK (tier IN ('paygo', 'starter', 'growth', 'scale', 'enterprise'));

-- 5. Drop daily_limit if it exists (keep monthly_limit)
ALTER TABLE api_keys DROP COLUMN IF EXISTS daily_limit;
