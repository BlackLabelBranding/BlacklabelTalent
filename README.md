# Black Label Talent Portal

Standalone front-facing app for Black Label talent: models, brand ambassadors, influencers, hosts, photographers, and promo staff.

Black Label Hub remains the backend/admin control center. This app should only expose talent-facing workflows.

## Product Boundary

- `blacklabelhub.com`: admin control, master event calendar, gig creation, contracts, payments, internal notes
- Talent Portal: talent login, profile, availability, open gigs, accepted gigs, contract status, pay status
- Production/worker portal: separate future app for merch/manual work

## Core Data Rule

Do not duplicate event records in this app.

The Talent Portal should consume event-linked gig opportunities from Hub/Supabase:

```text
events
  -> gig_opportunities
  -> gig_assignments
  -> contracts
  -> payments
```

## Local Development

```bash
npm run dev
```

This starter intentionally has no package dependencies. It can also be served with any static file server.

## Backend Wiring Plan

For the first UI pass, data comes from `src/data/mockData.js`.

When ready to connect the app:

1. Keep the master event table in Black Label Hub/Supabase as the source of truth.
2. Replace mock functions in `src/lib/hubApi.js`.
3. Fetch only talent-visible fields.
4. Keep internal notes, client-private details, and other talent pay private.
5. Use authenticated requests tied to the logged-in talent profile.

## MVP Screens

- Today / next gig summary
- Open gig opportunities
- Talent calendar
- My gigs
- Contract and payment status
- Profile and availability controls
