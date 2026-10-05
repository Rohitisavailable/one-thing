# One Thing

One Thing turns a tangled task into a few small next steps. It uses Backboard for AI and a private anonymous Supabase session to keep each browser's plans separated, without an email or password sign-in screen.

## Privacy boundary

- A user's task is sent to Backboard and the model provider configured by the site operator. It is not local or offline inference. Do not enter highly sensitive information.
- Plans are private to a browser profile, not protected by a personal login. Anyone using that same profile can see them. The same profile can see them after returning; clearing site data, private browsing, or switching profiles/devices loses access because the anonymous session has no recovery identity.
- Supabase's anonymous Auth session identifies that browser privately. The `plans` table enforces `auth.uid() = user_id` for reads and inserts. Browser clients cannot update or delete rows directly; the delete function first proves ownership under the session's JWT, requests deletion of the associated Backboard thread, then deletes that row server-side.
- The site operator and service providers may access data under their own account-level controls and policies. This is not end-to-end encryption.
- Delete removes the saved row and its Backboard thread. Export downloads one plan as Markdown or all plans as JSON.

## Configure Supabase

1. Create a Supabase project and enable **Allow anonymous sign-ins** in Authentication settings. The app creates a private anonymous session automatically; visitors do not enter an email or password.
2. Run `supabase/schema.sql` in the SQL editor.
3. For local work, copy `public/config.example.js` to `public/config.js` and fill in the project URL and publishable/anon key. The browser key is public by design; protect data with RLS. Never put a service-role key in `public/`.
4. In Supabase Auth, add the local and public site URLs to the allowed redirect/site URL list.
5. Install the Supabase CLI and link this project. Set these Edge Function secrets using `supabase secrets set`:

   - `BACKBOARD_API_KEY` — the Backboard API key, server-side only.
   - `BACKBOARD_LLM_PROVIDER` — defaults to `featherless`, Backboard's open-source model provider.
   - `BACKBOARD_MODEL_NAME` — defaults to `Qwen/Qwen2.5-7B-Instruct` ([Apache-2.0 model card](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct)). Confirm that it is available in your Backboard account and supports JSON output; replace it with another open-weight model if needed.
   - `APP_ORIGIN` — exact public site origin; locally the default is `http://localhost:8000`.

   Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions. Keep the service-role key server-side only.
6. Deploy both functions: `supabase functions deploy generate-plan` and `supabase functions deploy delete-plan`.

For a public launch, follow Supabase's recommendation to enable CAPTCHA or Cloudflare Turnstile for anonymous sign-ins. Anonymous users can generate disposable identities, so CAPTCHA helps reduce automated sign-up abuse.

The generation function verifies the browser's Supabase session, limits each anonymous identity to 30 generation attempts per rolling 24 hours, calls Backboard with memory disabled, and saves the plan using that session's JWT so the database's own ownership policy is enforced. If saving fails, it attempts to delete the just-created Backboard thread.

## Run the frontend locally

1. Copy `public/config.example.js` to `public/config.js` and configure Supabase.
2. Set `APP_ORIGIN` for the Edge Functions to `http://localhost:8000`.
3. From this project/repository root, run `python -m http.server 8000 --directory public` and visit `http://localhost:8000`.
4. The page creates an anonymous session on first visit. Generate a plan, then reload the page in the same browser to confirm that it is still there.

## Deploy the public site

The frontend is a static site. Use this folder's contents as the repository root so `render.yaml` is at the top level. Create/link that Git repository in Render. Set Render's `SUPABASE_URL` and `SUPABASE_ANON_KEY` build variables; these are public browser configuration values, and the build script writes the ignored `public/config.js` into the published site. Enable anonymous sign-ins in Supabase Authentication settings. Set the Supabase Edge Function secret `APP_ORIGIN` to the assigned `https://…onrender.com` origin. The Supabase project and its Edge Functions deploy separately from the static site.

There are no provider credentials in this repository. Do not commit `public/config.js`, any Backboard API key, or a Supabase service-role key. A public deployment is not ready until real Supabase and Backboard projects are configured and isolation between two separate browser sessions has been checked.
