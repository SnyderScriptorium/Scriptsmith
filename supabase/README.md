# ScriptSmith Sync — Supabase Setup

This is the cloud backend for ScriptSmith's **paid sync** feature. The app
itself stays free and offline-first; manuscripts sync between phone and
computer through here.

You only do this setup **once**. Afterwards the app handles everything.

## Step 1 — Create a Supabase account

1. Go to **https://supabase.com** and click **Start your project**.
2. Sign up (email or GitHub both work).

## Step 2 — Create a project

1. In the dashboard, click **New project**.
2. Name it `scriptsmith` (or anything you like).
3. **Database password:** Supabase will ask you to invent one. Write it down
   somewhere safe (a password manager, a notebook — just don't lose it).
4. **Region:** pick the one closest to you (US East if you're on the East Coast).
   Closer = faster syncing.
5. Click **Create new project** and wait a minute or two while it spins up.

## Step 3 — Create the manuscripts table

1. In the left sidebar, click the **SQL Editor** icon (`</>`).
2. Click **New query**.
3. Open the file `schema.sql` (in this same `supabase/` folder), copy the
   **entire contents**, and paste it into the query box.
4. Click **Run** (or press Ctrl+Enter). You should see "Success. No rows returned."
5. That's it — the table and all the security rules are now in place.

## Step 4 — Copy your API credentials

1. In the left sidebar, click the **gear icon** (Project Settings), then **API**.
2. Copy these two values:
   - **Project URL** — looks like `https://xyzcompany.supabase.co`
   - **anon public key** — a very long string starting with `eyJ...`
3. ⚠️ There is also a **`service_role` key** on that page. **NEVER use it in
   the app.** It bypasses all security rules. The `anon` key is the only one
   the app should ever see — it's safe *because* of the row-level security
   rules you installed in Step 3.

## Step 5 — Install the sync library (developer step)

In the `scriptsmith` repo, run:

```bash
npm install @supabase/supabase-js
```

## Step 6 — Tell the app your credentials

**Easiest (no rebuild needed):** paste the Project URL and anon key into the
app's Sync settings screen (once it's built). The app remembers them.

**Alternative (needs a rebuild):** create a file named `.env` in the repo root:

```
VITE_SUPABASE_URL=https://xyzcompany.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Never commit `.env` to git.

## Step 7 — Check that email login is on

1. In the Supabase sidebar, go to **Authentication → Providers**.
2. Make sure **Email** is enabled (it is by default).
3. Users sign up with email + password inside the app. Supabase handles the
   password hashing — the app never sees or stores passwords.

## How the security works (the short version)

- Every manuscript row is tagged with the owner's `user_id`.
- Database rules say: you can only touch rows where `user_id` matches *your*
  login. This is enforced by the database itself, not just the app — even if
  someone stole the anon key, they'd still only ever see their own data.
- Passwords are hashed by Supabase. There is nothing to leak from our side.

## What sync does today (v1)

- **Upload:** manuscripts saved on a device get pushed to your account.
- **Download:** manuscripts from your account get pulled onto the device.
- **Conflicts:** if the same manuscript was edited on two devices between
  syncs, the **newer edit wins** (compared by save time). There's no merge
  screen yet — so sync before switching devices when you can.
- **Not yet:** deleted manuscripts don't sync their deletion (the surviving
  copy comes back on next sync). Real-time live sync isn't on yet either.

## Cost

Supabase's free tier includes a 500 MB database. Manuscripts are just text —
500 MB holds an enormous library. You won't pay anything until you have
enough paying sync users to outgrow it, and by then the sync revenue covers it.
