# Legacy Wireless — Field Portal

A real, hosted door-performance portal: reps log into their own accounts,
see only the doors they cover, and get day-over-day / week-over-week
trends built from daily snapshots you upload. No Google account required —
you upload the daily workbook file directly.

This guide assumes no prior experience with any of these tools. Follow it
top to bottom.

## What you'll end up with

- A website (e.g. `https://your-portal.vercel.app`) reps open on their phone
- Real logins — each rep only sees their own doors
- An admin screen to upload each day's file
- A database that remembers every day you upload, so trends build over time

Total cost: **$0** at this scale (170 doors, ~8 reps). You'd only ever pay if
this grew dramatically (thousands of users/huge data volume).

---

## 1. Create a Supabase project (the database + login system)

1. Go to [supabase.com](https://supabase.com) and sign up (free).
2. Click **New project**. Pick any name (e.g. "legacy-wireless-portal") and
   a password for the database (save it somewhere — you likely won't need
   it day-to-day, but keep it safe).
3. Wait ~2 minutes for it to finish setting up.
4. In the left sidebar, go to **SQL Editor** → **New query**.
5. Open `supabase/schema.sql` from this project, copy the whole thing, paste
   it in, and click **Run**. This creates all the tables and security rules.
6. Go to **Project Settings → API**. You'll need three values from this page
   in step 3 below:
   Name: legacy-wireless-portal
   Project ID: tgwyvzdhvmzbzrjznneb
   - **Project URL** : NEXT_PUBLIC_SUPABASE_URL=https://tgwyvzdhvmzbzrjznneb.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_v_dx1AJTOZ3OVFHBDwl-2Q_LuoscplN
   - **anon public** key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnd3l2emRodm16YnpyanpubmViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMDQwMDgsImV4cCI6MjEwNDg4MDAwOH0.U760jmlfGQAkUoef_gBbvrgiX3hs4DoM7FzGX1rOEYk
   - **service_role** key (click "reveal" — keep this one secret, never put
     it in the browser-facing code):
     eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnd3l2emRodm16YnpyanpubmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTMwNDAwOCwiZXhwIjoyMTA0ODgwMDA4fQ.JHjREu8XmIyiz8QO53GV8QTDjOMG6L4hHTSvUIuRKNw

## 2. Invite your reps as users

1. In Supabase, go to **Authentication → Users**.
2. Click **Add user → Send invite email** (or "Create new user" if you'd
   rather set a temporary password yourself) for each Area/Field Rep and
   for yourself as an admin.
3. That's it for now — you'll link each of these accounts to a specific rep
   and role once the site is running (step 5 below).

## 3. Configure the project

1. Copy `.env.example` to a new file named `.env.local`.
2. Fill in the three Supabase values from step 1.6 above.

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

## 4. Put the code on GitHub

1. Create a free account at [github.com](https://github.com) if you don't
   have one.
2. Create a new repository (any name, e.g. `legacy-wireless-portal`).
3. Upload this project's files to that repository (GitHub's web UI lets you
   drag-and-drop files if you'd rather not use git from a terminal — look
   for "uploading an existing file" on the new repo page). Do **not** upload
   your `.env.local` file — GitHub should ignore it automatically because of
   the included `.gitignore`, but double check it's not there.

## 5. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up with your GitHub
   account (free).
2. Click **Add New → Project**, then pick the repository you just created.
3. Before deploying, open **Environment Variables** and add the same three
   values from your `.env.local`.
4. Click **Deploy**. After a minute or two you'll get a live URL like
   `https://legacy-wireless-portal.vercel.app` — this is what you share with
   your reps.

## 6. Assign each rep to their account

1. Open your new site and log in with the admin account you created in
   step 2 (use "Forgot password" if you set it up as an email invite).
2. Go to **Assign reps** (link on the dashboard, admin-only).
3. For each person, pick their role (**Rep** or **Admin**) and which rep
   they should see data as. Save.
4. Ask each rep to log in — they'll see their own doors and nothing else.

## 7. Import your first day of data

1. As an admin, click **Import data** on the dashboard.
2. Pick today's date, upload the workbook file (the .xlsx you get, or a CSV
   export of its "Data" tab — either works), and click **Import**.
3. Repeat this every day going forward. Each upload becomes a new dated
   snapshot — day-over-day and week-over-week views build in automatically
   as more days accumulate.

---

## How the data model works (so future changes make sense)

- **`doors`** — the current directory info for each store (address,
  contacts, which rep covers it). Gets refreshed on every import.
- **`snapshots`** — one row per store *per day*. Never overwritten, only
  added to. This is what powers all the trend views.
- **Row Level Security** (defined in `schema.sql`) enforces access control
  at the database level — a rep's account can only ever read rows tied to
  their `rep_id`, no matter what the app's frontend code does. This is the
  real security boundary, not just a UI convenience.

## If the sheet's column headers ever change

Update `lib/sheetMapping.js` — it's the single place that maps the
workbook's column headers to database fields. Nothing else needs to change.

## Local development (optional)

If you want to run this on your own computer before deploying:

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`. You'll still need the Supabase project
and `.env.local` set up first (steps 1 and 3 above).
