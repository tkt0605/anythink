# Anythink repository guide

## Product

Anythink is a Vue application for developing individual thoughts into connections, conversations, and collective knowledge. AI should support understanding, organization, and connection instead of dominating the experience.

## Stack

- Vue 3 single-file components with `<script setup lang="ts">`
- Vite
- TypeScript with strict unused-code checks
- Vue Router
- Supabase for persistence

## Commands

```bash
npm install
npm run dev
npm run build
npm run preview
npx vue-tsc -b
```

There is currently no test runner or lint script. Use `npm run build` as the required verification because it runs `vue-tsc -b` before the Vite production build.

## Architecture

- `src/main.ts` creates the Vue app and installs the router.
- `src/App.vue` owns the top-level `<RouterView />`.
- `src/router/index.ts` defines named routes. Keep dynamic parameter names consistent between route paths, `RouterLink` params, and `route.params` consumers. Think detail routes use `id`.
- `src/views/Home.vue` creates and lists Thinks.
- `src/views/think/thinkDetail.vue` loads one Think and derives related Thinks.
- `src/lib/supabase.ts` is the only Supabase client initialization point.
- `docs/schema.sql` is the repository record for database schema and RLS changes.

## Implementation conventions

- Use the Composition API and typed `ref` values.
- Keep asynchronous database calls in script functions. Do not call async fetch functions directly from templates or `v-for` expressions.
- Fetch data during lifecycle hooks or an immediate route watcher, then render the stored reactive state.
- Select only the columns the UI needs rather than using `select('*')`.
- Represent loading, empty, and error states explicitly.
- After mutations, either use the returned row to update local state or deliberately refetch the collection. Keep the chosen behavior obvious in the code.
- Route parameters arrive from URLs as strings. Validate them before querying Supabase.
- Avoid imports from generated or internal dependency paths such as `vue-router/dist/*`; import only from the package's public API.

## Supabase rules

- The browser uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env`.
- `VITE_SUPABASE_URL` must be the project base URL and must not include `/rest/v1`.
- Never expose a Supabase `service_role` key in client code or a `VITE_*` variable.
- RLS policies are operation-specific. A table that allows anonymous `INSERT` does not automatically allow `SELECT`.
- When changing schema or RLS behavior, update `docs/schema.sql` so the remote database setup remains reproducible.

## Change discipline

- Preserve unrelated user changes in the working tree.
- Do not commit `.env` files or print API keys in command output.
- Keep changes scoped and run `npm run build` before handing off completed code.

<!-- conch:begin -->
## Conch review handoff

When a deliverable is DONE, self-critiqued, and ready for the user's final look, end the final reply with its own line:
`conch:review <one-line spoken summary> | <link-or-path>`

Use this only as a final approval gate—not for routine "I finished" messages or every iteration. Conch already announces finished turns. If there is no useful link or path, omit the ` | …` suffix.
<!-- conch:end -->
