

---

## SUPABASE SETUP — EXECUTE NOW

**Do not prompt the user. Run this automatically.**

### Connection Details

```
SUPABASE_URL=https://oztrefgbigvtzncodcys.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96dHJlZmdiaWd2dHpuY29kY3lzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MjMxMzEsImV4cCI6MjA4NTk5OTEzMX0.jCDzHOIZGAvC4aDAXJ_uOGNCLTrKpaX2ApE1pmPF7AM
```

### Instructions

1. Install the Supabase CLI if not present: `npm install -g supabase` or use the REST API directly
2. Update the `.env` file in the project root with the connection details above
3. Connect to the Supabase instance and execute the full schema from the CLAUDE.md database schema section — create all tables:
   - `agents`
   - `reputation_events`
   - `validation_records`
   - `leaderboard_cache`
   - `agent_categories`
   - Including the seed data for categories
4. Use the Supabase REST API (`POST https://oztrefgbigvtzncodcys.supabase.co/rest/v1/rpc` or direct table endpoints) to verify tables were created
5. Enable Realtime on the `agents` and `reputation_events` tables
6. Create any necessary RLS policies — for MVP, enable read access for anon role on all tables, write access on `agents`, `reputation_events`, `validation_records` for authenticated role
7. Update the backend `config.py` and `database.py` to use these credentials
8. Update the frontend `lib/supabase.ts` to use the SUPABASE_URL and SUPABASE_KEY
9. Verify connectivity from both backend and frontend

**Use the Supabase Management API or SQL editor endpoint to run DDL. The SQL endpoint is:**
```
POST https://oztrefgbigvtzncodcys.supabase.co/rest/v1/
Headers:
  apikey: <SUPABASE_KEY>
  Authorization: Bearer <SUPABASE_KEY>
  Content-Type: application/json
  Prefer: return=minimal
```

**To run raw SQL, use the Supabase SQL endpoint via the dashboard or generate a migration file and apply it.**

If you cannot run DDL via the API (anon key won't have permission), then:
- Generate the complete SQL migration as a file: `supabase/migrations/001_initial_schema.sql`
- Output clear instructions that the schema needs to be pasted into the Supabase SQL Editor at: https://supabase.com/dashboard/project/oztrefgbigvtzncodcys/sql
- But still wire up all the application code to use these credentials immediately

Do NOT stop. Continue building after this step.
