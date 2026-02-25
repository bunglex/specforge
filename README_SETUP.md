# Spec Writer Local Setup

## 1) Install and run

```bash
npm install
npm run dev
```

Vite starts the app locally (typically at http://localhost:5173).

## 2) Environment variables

Create a `.env.local` file in the repository root:

```bash
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Notes:
- `.env.local` is ignored by git and should never be committed.
- `VITE_` prefix is required for browser exposure in Vite.

## 3) Apply schema + seed (self-hosted or SQL editor workflow)

Run SQL in this order:
1. `supabase/schema.sql`
2. `supabase/seed.sql`

Before running the seed script, replace `YOUR_AUTH_USER_ID_HERE` with your actual Auth user UUID so your account is attached to the demo workspace.

## 4) Document structure format (block-based)

`documents.structure` now stores sections with a block list:

```json
{
  "sections": [
    {
      "id": "uuid",
      "title": "Introduction",
      "blocks": [
        { "id": "uuid", "type": "text", "body": "Plain text block" },
        {
          "id": "uuid",
          "type": "clause_ref",
          "clause_id": "uuid",
          "level": "standard",
          "overrides": { "body": "Optional override text" }
        }
      ]
    }
  ]
}
```

Legacy section payloads with `content` are automatically converted on first document open and then saved back.

## 5) New editor interactions

The editor route is now a 3-pane interface:
- **Left (TOC):** section list + search.
- **Middle (Preview):** scrollable rendered section/block preview with anchors.
- **Right (Inspector):** block editor (text/clause settings + variable values).

Shortcuts:
- `Esc`: close the inspector (clear selected block).
- `Ctrl+S` / `Cmd+S`: force immediate save.

Autosave runs with a ~900ms debounce and shows **Saved / Unsaved** status in the header.
