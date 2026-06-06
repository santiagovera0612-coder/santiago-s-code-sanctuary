# CLERIVO AI V2 Work Instructions

You are working on CLERIVO AI V2.

## Mandatory Branch

Work only on:

```bash
v2-ui-redesign
```

Before making any change, run:

```bash
git status --short --branch
```

If the current branch is not `v2-ui-redesign`, stop and switch to it before editing.
Do not work on `main`.

## Current Phase

This branch is for Phase 2: frontend visual redesign only.

Allowed work:

- App shell
- Sidebar
- Topbar
- Dashboard UI
- Chats UI
- Agent IA UI
- Settings UI
- Integrations UI
- Shared visual components
- CSS and layout polish

## Hard Restrictions

Do not touch:

- WhatsApp backend logic
- WhatsApp webhook logic
- Supabase schema or migrations
- Message sending logic
- Message receiving logic
- Embedded Signup
- Production WhatsApp V2 backend

Forbidden paths unless explicitly approved:

```text
src/server/whatsapp.ts
src/server/auth.ts
src/server/supabase-server.ts
src/server/secrets.ts
src/server/router.ts
src/server/crud.ts
supabase/
```

Forbidden routes to modify:

```text
/api/whatsapp/*
/api/webhooks/whatsapp
```

## Goal

Improve the frontend so CLERIVO feels more premium and production-ready while keeping V1 behavior exactly the same.

Do not change data contracts, API behavior, authentication behavior, WhatsApp behavior, webhook behavior, or database behavior.

## Verification

After visual changes, run:

```bash
npm run build
npm run lint
```

Also verify manually that:

- The app still opens locally.
- Login still works.
- Dashboard still loads.
- Chats still load.
- Integrations still display the current WhatsApp V1 state.
- No WhatsApp backend files were changed.

