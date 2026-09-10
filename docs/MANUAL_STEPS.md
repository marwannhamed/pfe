# What YOU do manually (local PFE)

Everything else is already in the app. Follow only these steps.

## One-time accounts (free tiers are fine)

| # | Service | Why |
|---|---------|-----|
| 1 | **Mailtrap** | Catch emails locally (`MAIL_*` in `backend/.env`) |
| 2 | **Brevo** (optional) | Onboarding emails after lease sign |
| 3 | **Crisp** (optional) | Tenant live chat |
| 4 | **Typeform** (optional) | Tenant application form |
| 5 | **Google Cloud** (optional) | Google Business connect on site page |

You do **not** need Coworker/LiquidSpace API keys for a local demo.

## Copy keys into env files

### `backend/.env` — add these lines (keep your existing DB/JWT/Mail)

```env
FRONTEND_URL=http://localhost:5173
APP_PUBLIC_URL=http://localhost:6001

# Optional — see backend/.env.example for full list
BREVO_API_KEY=
BREVO_TEMPLATE_ONBOARDING_DAY0=
TYPEFORM_FORM_ID=
GOOGLE_GMB_CLIENT_ID=
GOOGLE_GMB_CLIENT_SECRET=
GOOGLE_GMB_REDIRECT_URI=http://localhost:6001/integrations/google-business/oauth/callback
```

### `frontend/.env` — create this file

```env
VITE_API_URL=http://localhost:6001
VITE_CRISP_WEBSITE_ID=
```

## Restart after editing env

1. Stop backend → `npm run start:dev` in `backend/`
2. Stop frontend → `npm run dev` in `frontend/`

## In the app (clicks only)

| Goal | Where |
|------|--------|
| Application demo (no ngrok) | **Applications** → Generate link → **Simulate submission** |
| Google listing | **Sites** → open site → **Google Business Profile** |
| Marketplace flag | **Spaces** → edit → **List on marketplaces** |
| Live chat | Log in as **tenant** → `/portal` (needs `VITE_CRISP_WEBSITE_ID`) |
| Brevo email | Sign first **contract** for a tenant (needs Brevo key + template) |

That’s all you need to do manually.
