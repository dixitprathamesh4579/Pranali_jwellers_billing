# Pranali Jewellers — Rebuilt Frontend

This frontend uses a new application structure rather than the previous dashboard-as-router layout.

## Run locally

```bash
npm install
npm run dev
```

## New structure

- `src/app/` — application bootstrap and session handling
- `src/components/layout/` — desktop sidebar, top bar, mobile drawer and bottom navigation
- `src/pages/` — new dashboard overview page
- `src/modules/` — existing business workflows (sales bill, SH customers, GI, history, statistics and OTP login)
- `src/styles/` — global responsive design system

## Responsive behaviour

- Desktop/tablet: persistent left navigation and top workspace bar.
- Mobile: compact header, slide-out navigation and fixed bottom navigation.
- Dashboard: responsive metric cards, quick actions, recent bills and active Girvi accounts.
- Module forms and tables remain owned by their feature components and can be refined independently.

## Integration notes

- Existing OTP login component and API calls are retained.
- Existing sales billing, PDF, customer and Girvi feature components are retained in `src/modules/` to avoid changing business calculations or API payloads during the structural redesign.
- The dashboard overview reads from the existing backend API endpoints. If the API response uses a different envelope, dashboard metrics may need a small mapping adjustment; the individual feature modules remain the source of truth.
- No backend, database schema, secrets or environment files are included.
- For production use, confirm all API endpoints and test OTP, bill creation/PDF, customer updates and GI workflows end-to-end.
