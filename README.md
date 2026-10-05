# One Thing

One Thing turns an overwhelming task into a kind, realistic first step. Add what is on your mind, how much time you have, and your energy level. The app asks an open-weight AI model for a short plan, then saves it so you can return to it later.

There is no email or password form. The app creates an anonymous Supabase session for the current browser profile.

- **Live demo:** [one-thing-3y6j.onrender.com](https://one-thing-3y6j.onrender.com/)
- **Source:** [Rohitisavailable/one-thing](https://github.com/Rohitisavailable/one-thing)
- **AI:** Backboard API with Featherless and `Qwen/Qwen2.5-7B-Instruct` by default

## Try it

1. Open the live demo or run it locally using the instructions below.
2. Enter a task, such as “I need to tidy my desk before my next meeting.”
3. Choose the time and energy you have, then select **Find one small step**.
4. Select a saved plan to reopen it. Export one plan as Markdown, export the library as JSON, or delete a plan.

## How it works

1. The browser creates or restores an anonymous Supabase Auth session.
2. A Supabase Edge Function verifies the session and sends the task to Backboard.
3. Backboard calls the configured model with memory disabled and asks it for a short JSON plan.
4. The Edge Function saves the plan in Supabase Postgres. Row-level security limits reads and inserts to the session's `auth.uid()`.
5. Deletion checks ownership, requests removal of the corresponding Backboard thread, and deletes the database row.

JWT verification remains enabled for both Edge Functions. The generation endpoint limits each session to 30 attempts in a rolling 24-hour window.

## Open AI choice

Backboard is the hosted API layer. The default model is the open-weight `Qwen/Qwen2.5-7B-Instruct`, served through Backboard's Featherless provider. Its [model card](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct) lists the Apache-2.0 license. The provider and model can be changed with server-side settings, and the planning prompt is part of the Edge Function source.

This is **not** offline or local inference: generating a plan needs an internet connection, sends the task to Backboard and its configured model provider, and may use paid credits. Open model weights and a replaceable provider make it possible to change the model or hosting arrangement without redesigning the app around a single closed model.

## Privacy and limitations

- Plans are isolated by anonymous Supabase session using Postgres row-level security. This is browser-profile privacy, **not a verified personal account**.
- Anyone using the same browser profile can see its plans. Return using the same browser profile with site data intact. Clearing browser data, using private browsing, or switching profiles/devices loses access to that anonymous session and its plans.
- Tasks and plans are stored in Supabase. The task is also sent to Backboard and its configured model provider. This is not end-to-end encryption; service operators may have access under their own systems and policies. Avoid entering highly sensitive information.
- Supabase's service-side generation limit is per anonymous session. Anonymous sessions can be recreated, so enable CAPTCHA or Cloudflare Turnstile before opening a public deployment to broad use.
- Deleting a plan removes its database row and requests deletion of its Backboard thread. Export data before deleting if you need a copy.

For implementation details, see Supabase's guides for [anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), and [Edge Functions](https://supabase.com/docs/guides/functions).

## Run locally

### Prerequisites

- A Supabase project with the schema and Edge Functions configured below
- Python 3, to serve the static files
- Node.js, only if you use the Render config-generation build step locally

### Configure Supabase

1. In Supabase, enable **Allow anonymous sign-ins** under **Authentication → Sign In / Providers**.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL Editor. This creates the plans table, usage ledger, row-level security policies, and generation-limit function.
3. Copy [`public/config.example.js`](public/config.example.js) to `public/config.js`. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` to your project's URL and publishable/legacy anon key.
4. Set these Supabase Edge Function secrets:

   | Secret | Purpose |
   | --- | --- |
   | `BACKBOARD_API_KEY` | Backboard API credential; server-side only |
   | `BACKBOARD_LLM_PROVIDER` | Model provider; defaults to `featherless` |
   | `BACKBOARD_MODEL_NAME` | Model name; defaults to `Qwen/Qwen2.5-7B-Instruct` |
   | `APP_ORIGIN` | Exact browser origin allowed by function CORS; use `http://localhost:8000` locally |

   Supabase provides its project URL and keys to Edge Functions. Never put a service-role key or the Backboard API key in `public/` or in browser configuration.
5. Deploy the functions from the project root using the Supabase CLI:

   ```sh
   supabase functions deploy generate-plan --project-ref YOUR_PROJECT_REF
   supabase functions deploy delete-plan --project-ref YOUR_PROJECT_REF
   ```

   Keep JWT verification enabled. If deploying through the Supabase Dashboard or MCP instead, deploy both function source files from `supabase/functions/` with JWT verification enabled.

### Start the app

1. In VS Code, open this project folder (the one containing `public/` and `supabase/`).
2. Open **Terminal → New Terminal** and run:

   ```powershell
   python -m http.server 8000 --directory public
   ```

3. Visit **http://localhost:8000/**. Use `localhost` exactly: the local Edge Function CORS origin is `http://localhost:8000`; `127.0.0.1` is a different origin and can cause `Failed to fetch`.
4. Generate a sample plan, then refresh the page. The plan should remain in the saved list in that same browser profile.

Stop the server with **Ctrl+C** in the terminal.

## Deploy to Render

This is a static site. The [`render.yaml`](render.yaml) blueprint sets the build command and publishes `public/`.

1. Connect the GitHub repository to Render and create a **Static Site** from the repository root.
2. Set the build environment variables `SUPABASE_URL` and `SUPABASE_ANON_KEY`. These values are intended for browser use; RLS protects the data. The build script writes them into the ignored `public/config.js`.
3. Enable anonymous sign-ins in Supabase and configure CAPTCHA or Turnstile for public use.
4. Set the Supabase Edge Function secret `APP_ORIGIN` to the exact Render origin, for example `https://one-thing-3y6j.onrender.com` (no trailing slash). Deploy both Edge Functions to Supabase.

The static site and the Supabase Edge Functions deploy separately. Updating the frontend on Render does not automatically deploy Edge Function changes.

## Project layout

```text
public/
  app.js                 Browser application
  config.example.js      Supabase config template
  index.html             Static UI
scripts/
  generate-config.mjs    Writes public/config.js during Render builds
supabase/
  schema.sql             Tables, RLS policies, and generation quota
  functions/
    generate-plan/       Verify session, call Backboard, save plan
    delete-plan/         Verify ownership, remove plan and thread
render.yaml              Render static-site blueprint
```

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| “Anonymous sign-ins are not enabled” | Enable **Allow anonymous sign-ins** under Supabase **Authentication → Sign In / Providers**, then reload. |
| “Failed to fetch” locally | Open `http://localhost:8000/`, not `127.0.0.1`; make sure the Edge Function `APP_ORIGIN` is exactly `http://localhost:8000`. |
| “Confirm your email before generating plans” | An older Edge Function is still deployed. Deploy the current `generate-plan` function; anonymous sessions do not have a confirmed email. |
| Supabase config missing | Confirm `public/config.js` exists locally, or that Render has both build variables and completed a fresh build. Never commit the local config file. |
| Backboard generation error | Check the server-side API key, provider/model names, JSON output support, and available Backboard credits. |

## Security reminders

- The Supabase publishable/anon key is public by design; access control comes from RLS and the Edge Functions.
- Never commit `public/config.js`, Backboard credentials, Supabase service-role keys, or `.env` files.
- Do not disable Edge Function JWT verification.
- Anonymous session data cannot be recovered after browser storage is cleared. Add a real sign-in and identity-linking flow if cross-device recovery is needed.
