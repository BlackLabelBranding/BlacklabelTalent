# Black Label Talent Portal

Standalone front-facing app for Black Label talent: models, brand ambassadors, influencers, hosts, photographers, and promo staff.

Black Label Hub remains the backend/admin control center. This app only exposes talent-facing workflows.

## Live Supabase Wiring

The portal now talks directly to the shared Black Label Hub Supabase project:

- Project ref: `xopcttkrmjvwdddawdaa`
- Auth: Supabase email/password login
- Profile: `team_members` plus `roster_profiles`
- Open Gigs: `opportunity_invitations`
- My Gigs: `work_assignments`
- Calendar: `talent_availability`, invitations, and assignments
- Responses: updates `opportunity_invitations.status` to `interested`, `accepted`, or `declined`

The browser client uses the project publishable/anon key only. Do not add service-role keys or secrets to this repo.

## Product Boundary

- `blacklabelhub.com`: admin control, master event calendar, gig creation, contracts, payments, internal notes
- Talent Portal: talent login, profile, availability, open gigs, accepted gigs, contract status, pay status
- Production/worker portal: separate future app for merch/manual work

## Core Data Rule

Do not duplicate event records in this app.

The Talent Portal consumes event-linked gig opportunities from Hub/Supabase:

```text
work_opportunities
  -> opportunity_invitations
  -> work_assignments
  -> assignment_contracts
```

## Local Development

```bash
npm run dev
```

This app intentionally has no package dependencies. It can also be served with any static file server.

## Deployment

On Vercel, deploy with:

```text
Build Command: npm run build
Output Directory: dist
Framework Preset: Other
```

## Notes For Hub Setup

For a talent login to show live records, the Supabase auth user must match a `team_members` row by either:

- `team_members.user_id = auth.users.id`
- `team_members.email = auth.users.email`

Talent-specific RLS policies must allow authenticated talent to read their own `team_members`, `roster_profiles`, `opportunity_invitations`, `work_opportunities`, `work_opportunity_roles`, `work_assignments`, `assignment_contracts`, and `talent_availability` rows, plus update only their own `opportunity_invitations.status` response fields.
