# Setting up cloud sync (Supabase + PowerSync)

Cloud sync is optional. This guide sets up the backend it needs: a Supabase project for sign-in and Postgres, and a PowerSync instance that keeps your devices in step with it.

The tables below mirror the local schema in [`lib/db/schema.ts`](../lib/db/schema.ts). If you change that schema, change the backend to match. Treat the SQL as a reference setup and check it against your own project before relying on it.

## 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. **Authentication → Providers:** enable **Email** (magic link). Passwords are not used.
3. **Authentication → URL configuration:** add the URLs the app runs on to the redirect allow-list (for example `http://localhost:3000` and your production URL).

## 2. Tables and row-level security

Run this in the Supabase SQL editor. Every table carries a `user_id` that defaults to the caller, and a policy that limits each user to their own rows. The app never sends `user_id`; Postgres fills it in from the signed-in user.

```sql
create table public.subscriptions (
  id               uuid primary key,
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name             text,
  amount           double precision,
  currency         text,
  interval_count   integer,
  interval_unit    text,
  last_charge_date text,
  next_charge_date text,
  source           text,
  confidence       double precision,
  active           integer,
  created_at       bigint,
  updated_at       bigint,
  category         text,
  tags             text,
  is_variable      integer
);

create table public.profiles (
  id              uuid primary key,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name            text,
  monthly_income  double precision,
  currency        text,
  last_csv_upload bigint,
  created_at      bigint,
  updated_at      bigint
);

create table public.transactions (
  id           uuid primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date         text,
  description  text,
  amount_minor bigint,
  currency     text,
  merchant     text,
  category     text,
  import_id    text,
  dedupe_key   text,
  created_at   bigint
);

create index transactions_user_date on public.transactions (user_id, date);

-- Row-level security: each user sees and changes only their own rows.
alter table public.subscriptions enable row level security;
alter table public.profiles      enable row level security;
alter table public.transactions  enable row level security;

create policy "own rows" on public.subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.transactions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- PowerSync reads changes through logical replication.
create publication powersync for table public.subscriptions, public.profiles, public.transactions;
```

Notes:

- Dates are stored as ISO text and timestamps as epoch milliseconds, exactly as in the local database.
- Amounts in `transactions` are integer minor units (paise, cents); negative is a debit.
- The device-local `settings` table is never synced and has no counterpart here.

## 3. PowerSync

1. Create a PowerSync instance and connect it to your Supabase Postgres database (use a dedicated replication role, as PowerSync's Supabase guide describes).
2. Configure it to accept Supabase Auth tokens so `request.user_id()` is the signed-in user.
3. Deploy these **sync rules**:

```yaml
bucket_definitions:
  user_data:
    parameters: select request.user_id() as user_id
    data:
      - select * from subscriptions where user_id = bucket.user_id
      - select * from profiles      where user_id = bucket.user_id
      - select * from transactions  where user_id = bucket.user_id
```

4. Copy the instance URL.

## 4. Configure the app

Put the three values in `.env.local` (gitignored), then restart the dev server:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
NEXT_PUBLIC_POWERSYNC_URL=<your PowerSync instance URL>
```

The anon key is designed to be public; row-level security is what protects the data. Never put the `service_role` key in a `NEXT_PUBLIC_` variable.

## 5. Turn it on

Open **Settings**, choose cloud sync, and sign in with the magic link sent to your email. Existing local data is uploaded the first time you enable sync. Turning sync off stops it and keeps local data.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| The sync option is missing | One of the three environment variables is empty, or the dev server was not restarted. |
| Sign-in email never arrives | Email provider not enabled, or Supabase's built-in email rate limit was hit. Configure custom SMTP for regular use. |
| Sign-in works but nothing syncs | Sync rules not deployed, the publication does not include the tables, or PowerSync is not accepting Supabase tokens. |
| Uploads are rejected | A table is missing a column that the app sends, or a row-level security policy is missing for that table. |
| One device shows old data | The device is offline; changes upload when it reconnects. |
