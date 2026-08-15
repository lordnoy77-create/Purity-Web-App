# Purity Plastic Defect Log

Static HTML/JavaScript/Tailwind web app for Netlify. Google Sheets access runs only in a Netlify Function, so service-account credentials are not exposed to the browser.

## Google setup

No Google Service Account is required. Sheet access is handled by the deployed Apps Script API. Confirm the sheet tabs are named exactly `dataBase` and `rawData`.

## Local development

Copy `.env.example` to `.env`, insert the service-account email and private key, then run:

```bash
npm install
npm run dev
```

Open the local URL printed by Netlify CLI. Do not open `index.html` directly because `/api/sheets` needs the local Netlify Function.

## Deploy to Netlify

1. Push this directory to a Git repository and import it in Netlify, or run `netlify deploy`.
2. In **Site configuration → Environment variables**, add:
   - `APP_SCRIPT_URL` is optional because the current deployment URL is built in.
   - `JWT_SECRET` is optional; set a random value of at least 32 characters for stronger production security.
3. Deploy. `netlify.toml` already configures the publish directory, Function directory, and `/api/sheets` route.

Never commit `.env` or the service-account JSON key.

## Apps Script API

The defect search/save API is proxied through Netlify to Google Apps Script. Copy the contents of `App script.txt` into the Apps Script project, then update the existing deployment with **Deploy → Manage deployments → Edit → New version**. Keep **Who has access** set to **Anyone** because the public Apps Script endpoint is protected from the web UI by the authenticated Netlify proxy.

## Login

Users are stored in the `users` sheet and authenticated by Apps Script, so Netlify does not need Google credentials. Add a new user with a temporary password; after the first successful login Apps Script hashes it and clears the temporary password automatically. API access still requires a signed HttpOnly session cookie.
