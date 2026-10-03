# One Thing

One Thing turns a tangled task into a few small next steps. The public version uses Backboard for AI, Supabase Auth for accounts, and Postgres row-level security to keep signed-in users' plans separated.

## Privacy boundary

- A user's task is sent to Backboard and the model provider configured by the site operator. It is not local or offline inference. Do not enter highly sensitive information.
- The task and generated plan are saved in Supabase so the same account can see them after leaving and returning.
- The `plans` table enforces `auth.uid() = user_id` for reads and inserts. Browser clients cannot update or delete rows directly; the delete function first proves ownership under the user's JWT, removes the associated Backboard thread, then deletes that row server-side.
- The site operator and service providers may access data under their own account-level controls and policies. This is not end-to-end encryption.
- Delete removes the saved row and its Backboard thread. Export downloads one plan as Markdown or all plans as JSON.

## Configure Supabase

1. Create a Supabase project and enable email confirmation for new accounts.
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

The generation function verifies the signed-in user, requires a confirmed email, limits each user to 30 generation attempts per rolling 24 hours, calls Backboard with memory disabled, and saves the plan using the user's JWT so the database's own ownership policy is enforced. If saving fails, it attempts to delete the just-created Backboard thread.

## Run the frontend locally

1. Copy `public/config.example.js` to `public/config.js` and configure Supabase.
2. Set `APP_ORIGIN` for the Edge Functions to `http://localhost:8000`.
3. From this project/repository root, run `python -m http.server 8000 --directory public` and visit `http://localhost:8000`.
4. Create an account, confirm the email, sign in, and generate a plan.

## Deploy the public site

The frontend is a static site. Use this folder's contents as the repository root so `render.yaml` is at the top level. Create/link that Git repository in Render. Set Render's `SUPABASE_URL` and `SUPABASE_ANON_KEY` build variables; these are public browser configuration values, and the build script writes the ignored `public/config.js` into the published site. Set the Supabase Edge Function secret `APP_ORIGIN` to the assigned `https://…onrender.com` origin and add that URL to Supabase Auth's allowed URLs. The Supabase project and its Edge Functions deploy separately from the static site.

There are no provider credentials in this repository. Do not commit `public/config.js`, any Backboard API key, or a Supabase service-role key. A public deployment is not ready until real Supabase and Backboard projects are configured and the two accounts/ownership paths have been checked.
