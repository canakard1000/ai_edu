# Seller Margin PRO Server

Vercel serverless backend for Seller Margin subscription state.

## Endpoints

- `POST /api/toss/subscription-webhook`: receives subscription state notifications.
- `GET /api/pro/entitlement?userId=<trusted-user-id>`: returns only `granted`, `plan`, and `expiresAt` from server storage.

## Security rules

- The webhook rejects every request until `TOSS_WEBHOOK_AUTHORIZATION` matches the exact Basic Auth header configured in the Apps in Toss console.
- Only `PRO_MONTHLY_SKU` and `PRO_ANNUAL_SKU` are accepted.
- A repeated event ID is idempotent and cannot overwrite the stored state again.
- GET requests never create or modify entitlements.
- Production requires a persistent Redis REST-compatible store. The in-memory store exists only in tests.

## Required deployment setup

1. Deploy this directory as a Vercel project.
2. Configure the values listed in `.env.example` as production environment variables.
3. Register `https://<deployment-domain>/api/toss/subscription-webhook` in the Apps in Toss payment notification URL setting and enter the same Basic Auth value in `TOSS_WEBHOOK_AUTHORIZATION`.
4. Integrate Toss Login or another server-verified identity flow before the miniapp calls the entitlement endpoint. Do not trust a client-generated `userId` in production.

The Apps in Toss documentation describes the notification URL and optional Basic Auth header, but does not publish a notification body signature or payload schema. This implementation therefore rejects missing or unsupported fields rather than inferring a grant. Confirm the live payload schema during sandbox testing before enabling the webhook.
