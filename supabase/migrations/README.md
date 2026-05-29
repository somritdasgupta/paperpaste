# Database Migrations

## Supabase Breaking Change (May 30, 2026)

Starting May 30, 2026, Supabase requires **explicit GRANT statements** for tables to be accessible via the Data API.

### What Changed
- **Before**: Tables were automatically exposed to `anon`, `authenticated`, and `service_role` roles
- **After**: You must explicitly grant permissions using SQL

### Migration Applied
The `20260527_add_explicit_grants.sql` migration ensures PaperPaste continues working by:
1. Opting into the new security model
2. Granting explicit permissions to existing tables
3. Ensuring functions remain executable

### For New Tables
When creating new tables, always include:
```sql
-- Create table
CREATE TABLE public.your_table (...);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.your_table TO anon;

-- Enable RLS
ALTER TABLE public.your_table ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "your_policy" ON public.your_table ...;
```

### Reference
- [Supabase Discussion #45329](https://github.com/orgs/supabase/discussions/45329)
