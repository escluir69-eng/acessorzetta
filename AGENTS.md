<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Preserve original imported records in an owner-scoped, content-hash-keyed import archive before additive conversion into existing document collections; this retains unmapped history and prevents overwriting existing records.

- ZettaPreferences owns global theme and accent state; persist preferences in owner-scoped user_settings and private avatar paths to avoid competing theme writers.
- Keep banking credentials encrypted in the existing owner-scoped vault; settings contain only safe preferences, never plaintext banking secrets.
- Use protected TanStack server functions for new app-internal integration calls and preserve existing import document identifiers for compatibility.
- Financial history uses one regime-aware reference-month helper for grouping, filters and years; competence comes from the obligation period or due date, never payment date.
- Generic payment-date repair is an explicit owner-scoped action that archives original documents before date-only updates; never move cash, change amounts or repair on page load.
