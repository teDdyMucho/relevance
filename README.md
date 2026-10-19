# Relevance

Meeting prep assistant. Pick an upcoming Google Calendar event, press **Generate brief**, and the app collects
Monday.com, Gmail, Semrush and BrightLocal data for the matched client, then writes a bullet summary and a
full report you can copy or download as PDF.

## Run

```bash
npm install
npm run dev
# open http://localhost:3000
```

Everything runs in **mock mode** out of the box. No API keys needed for the demo.

## How it works

```
Calendar event ──► matchClient() ──► client record (name, domain, board id, ...)
                                        │
          ┌─────────────┬───────────────┼───────────────┬──────────────┐
          ▼             ▼               ▼               ▼              │
      Monday.com      Gmail          Semrush       BrightLocal         │
          └─────────────┴───────────────┴───────────────┘              │
                                        ▼                              │
                                  summarize() ──► Meeting brief ◄──────┘
```

| Piece | File |
| --- | --- |
| Shared types | `src/lib/types.ts` |
| Mock data (clients, events, per-source data) | `src/lib/mock/data.ts` |
| Event to client matching | `src/lib/match.ts` |
| One adapter per source, each with `mock` + `live` branches | `src/lib/sources/*.ts` |
| Summary builder (rule-based now, Claude later) | `src/lib/summarize.ts` |
| Mode switches + required env vars | `src/lib/config.ts` |
| API: list events | `GET /api/events` |
| API: collect one source | `POST /api/sources/:source` `{ eventId }` |
| API: build the brief | `POST /api/brief` `{ eventId, results }` |
| Dashboard UI | `src/components/Dashboard.tsx` |
| Connection status page | `/settings` |

## Going live, one panel at a time

Each source has a `live*` function that currently throws "not implemented". To make a panel real:

1. Get the credentials (see below) and put them in `.env.local` (copy from `.env.example`).
2. Set that source's `*_MODE=live`.
3. Implement the `live*` function in `src/lib/sources/<source>.ts` so it returns the same shape as the mock.
4. Restart `npm run dev`. The panel badge flips from `mock` to `live`.

### Where to get each API key

**Google Calendar + Gmail** (one OAuth app for both)
1. https://console.cloud.google.com → create a project.
2. APIs & Services → Library → enable **Google Calendar API** and **Gmail API**.
3. APIs & Services → OAuth consent screen → Internal (if Google Workspace) or External + add your email as test user.
4. APIs & Services → Credentials → Create credentials → **OAuth client ID** → Web application.
   Add redirect URI `http://localhost:3000/api/auth/google/callback`.
5. Copy **Client ID** and **Client secret** into `.env.local`. The app will do the one-time sign-in
   and store the refresh token.

**Monday.com**
1. Click your avatar (bottom left) → **Developers** → **My access tokens** → Show → copy.
2. Paste as `MONDAY_API_TOKEN`.

How the Monday data is used (board ids are in `.env.local`, column ids in `src/lib/monday/*.ts`):
- **CRM → Accounts** board is the client list. Accounts with status Active or Onboarding become clients.
  The client's email domain comes from the linked Contacts, which is what Gmail and Semrush match on.
- **PMO → Retainer** and **PMO → Non Retainer** boards hold the work. Items linked to the account are
  fetched, and their subitems become the tasks (owner, status, due date, latest update).
- Helper routes: `GET /api/clients` (the live client list) and `GET /api/monday/boards` (boards + columns).
- Accounts with no contact email show as "no domain" in the client picker. Add a contact with an email
  on the Accounts board to fix matching for that client.

**Semrush**
1. https://www.semrush.com/api-documentation/ → your API key is on the **API units** page under Subscription info.
2. API access needs the Business plan (or API units add-on). Check your plan first.
3. Paste as `SEMRUSH_API_KEY`.

**BrightLocal**
1. Account → **API Access** (https://tools.brightlocal.com/seo-tools/admin/api) → generate key + secret.
2. Paste as `BRIGHTLOCAL_API_KEY` and `BRIGHTLOCAL_API_SECRET`.

**Claude (AI summary)**
1. https://console.anthropic.com → API keys → create.
2. Paste as `ANTHROPIC_API_KEY`.

## Build order

1. Google Calendar (OAuth flow, list upcoming events from one calendar)
2. Gmail (reuse the Google OAuth app, add the read-only scope)
3. Monday.com
4. Semrush
5. BrightLocal
6. AI summary with Claude
7. Move the client list from `mock/data.ts` to a database or a Monday "Clients" board
