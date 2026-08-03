# Agent Studio API — Skills Reference

Complete request/response reference for the **Skill Management REST API**.

- **Base URL:** `http://localhost:3000` (dev) — no global prefix
- **Auth:** every endpoint requires a valid Clerk session (session cookie; `Authorization: Bearer <sessionToken>` also accepted by Clerk). Unauthenticated → `401`.
- **Content-Type:** `application/json` for all requests and responses.
- **Ownership:** every handler scopes queries to the authenticated `userId`. You can never read or mutate another user's skills.

---

## 📦 Response Envelope

All endpoints return a consistent JSON envelope.

### Success
```jsonc
{ "success": true, "data": { /* endpoint-specific payload */ } }
```
> **Note:** `DELETE /api/skills/:id` is the only success case that omits `data` — it returns `{ "success": true }`.

### Error
```jsonc
{
  "success": false,
  "error": "Human-readable message",
  "code": "VALIDATION_ERROR",          // one of the codes below
  "fields": {                          // present only on VALIDATION_ERROR
    "allowedTools": ["At least one allowed tool is required"]
  }
}
```

### Error codes

| Status | Code | When |
|---|---|---|
| `401` | `UNAUTHENTICATED` | No/invalid Clerk session |
| `400` | `VALIDATION_ERROR` | Zod validation failed — includes a `fields` map of `path → messages[]` |
| `400` | `BAD_REQUEST` | Business-rule violation (e.g. re-publishing, deleting a published skill) |
| `403` | `FORBIDDEN` | Resource not found **or** not owned by you (deliberately ambiguous — never leaks which IDs exist) |
| `404` | `NOT_FOUND` | Resource not found (only on `GET`/`DELETE` — other handlers use `403`) |
| `500` | `INTERNAL_ERROR` | Unexpected failure. Body is always the generic message — real details are logged server-side, never returned |

---

## 🧩 Shared Types

### `SkillVersion` (`SkillVersionDTO`)

Returned by `PATCH`, `publish`, and embedded in every `Skill` payload.

```jsonc
{
  "id": "cm5f…cuid",                 // string — unique version id
  "skillId": "cm5f…cuid",            // string — parent skill id
  "versionNumber": 2,                // int ≥ 1 — unique per skill
  "status": "DRAFT",                 // "DRAFT" | "PUBLISHED" | "ARCHIVED"
  "inputSchema": { "type": "object" },      // JSON object — input schema
  "outputSchema": { "type": "object" },     // JSON object — output schema
  "instructions": "Read the input…",        // string
  "examples": [                             // array of { input, output, description? }
    { "input": { "text": "Great!" }, "output": { "label": "positive" } }
  ],
  "allowedTools": ["calculator"],           // string[]
  "actionsRequiringApproval": [],           // string[]
  "maxExecutionSteps": 10,                  // int 1–100
  "changelog": null,                        // string | null
  "notes": null,                            // string | null
  "createdAt": "2026-08-03T10:00:00.000Z",  // ISO-8601 (DateTime serialized)
  "publishedAt": null                       // ISO-8601 | null — set when published
}
```

### `Skill` (`SkillDTO`)

Returned by `POST /api/skills`, `GET /api/skills/:id`, `archive`, `duplicate`, and each item in the list.

```jsonc
{
  "id": "cm5f…cuid",
  "userId": "user_2abc…",                 // Clerk user id — always your own
  "name": "Sentiment Analyzer",
  "purpose": "Classify feedback as positive, neutral, or negative.",
  "status": "DRAFT",                      // "DRAFT" | "PUBLISHED" | "ARCHIVED"
  "currentDraftId": "cm5f…cuid",          // string | null — the editable draft
  "publishedVersionId": null,             // string | null — the immutable published version
  "createdAt": "2026-08-03T10:00:00.000Z",
  "updatedAt": "2026-08-03T10:00:00.000Z",
  "currentDraft": { /* SkillVersion | null — the draft, denormalized for convenience */ },
  "publishedVersion": null,               // SkillVersion | null
  "versions": [ /* SkillVersion[] — newest-first… see note below */ ]
}
```

> `versions` is included by the repository in every response. On `duplicate`/`archive`/`create` the created copy is v1 with `currentDraft` pointing at it. After `publish`, `currentDraftId` is cleared to `null` so the published version is never editable.

### Versioning rules

- **Published versions are immutable.** Editing a published skill auto-rotates a new `DRAFT` version (`versionNumber + 1`) cloned from the latest version.
- Publishing requires a `DRAFT` version; archived skills cannot be published; the same version can never be published twice.

---

## 1. List Skills

`GET /api/skills`

Search, filter, and sort your own skills.

### Query parameters

| Param | Type | Default | Rules |
|---|---|---|---|
| `search` | string | — | Optional, ≤ 100 chars. Case-insensitive substring match on `name` |
| `status` | string | — | `DRAFT` \| `PUBLISHED` \| `ARCHIVED` |
| `sortBy` | string | `updatedAt` | `updatedAt` \| `name` \| `createdAt` |
| `sortOrder` | string | `desc` | `asc` \| `desc` |

### Example
```
GET /api/skills?search=sentiment&status=DRAFT&sortBy=updatedAt&sortOrder=desc
```

### Success — `200`
```jsonc
{
  "success": true,
  "data": {
    "items": [ { /* Skill — full shape, see Shared Types */ } ],
    "total": 1
  }
}
```

### Errors

| Status | Code | Notes |
|---|---|---|
| `401` | `UNAUTHENTICATED` | Missing session |
| `400` | `VALIDATION_ERROR` | Unknown `status`/`sortBy`/`sortOrder` value, `search` > 100 chars |

---

## 2. Create Skill

`POST /api/skills`

Creates a skill with its first draft version (`versionNumber: 1`, `status: DRAFT`). `userId` is injected server-side from the session — **do not send it**.

### Request body — `createSkillSchema`

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | string | ✅ | 2–100 chars |
| `purpose` | string | ✅ | 5–1000 chars |
| `instructions` | string | ⬜ | 5–20000 chars |
| `inputSchema` | object | ⬜ | Plain JSON object (not array/null) |
| `outputSchema` | object | ⬜ | Plain JSON object |
| `examples` | array | ⬜ | ≤ 50 items, each `{ input: object, output: object, description?: string ≤ 300 }` |
| `allowedTools` | string[] | ✅ | 1–20 non-empty strings |
| `actionsRequiringApproval` | string[] | ⬜ | ≤ 20 non-empty strings |
| `maxExecutionSteps` | int | ⬜ | 1–100 (defaults to `10`) |
| `notes` | string | ⬜ | ≤ 5000 chars |

### Example
```bash
curl -X POST http://localhost:3000/api/skills \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sentiment Analyzer",
    "purpose": "Classify customer feedback as positive, neutral, or negative.",
    "instructions": "Read the input text and return a sentiment label with a confidence score.",
    "inputSchema": { "type": "object", "properties": { "text": { "type": "string" } } },
    "outputSchema": { "type": "object", "properties": { "label": { "type": "string" } } },
    "examples": [
      { "input": { "text": "Great service!" }, "output": { "label": "positive" } }
    ],
    "allowedTools": ["calculator"],
    "maxExecutionSteps": 10
  }'
```

### Success — `201 Created`
```jsonc
{
  "success": true,
  "data": {
    "id": "cm5f…",
    "userId": "user_2abc…",
    "name": "Sentiment Analyzer",
    "purpose": "Classify customer feedback…",
    "status": "DRAFT",
    "currentDraftId": "cm5f…",
    "publishedVersionId": null,
    "createdAt": "2026-08-03T10:00:00.000Z",
    "updatedAt": "2026-08-03T10:00:00.000Z",
    "currentDraft": { "id": "cm5f…", "versionNumber": 1, "status": "DRAFT", /* …full version */ },
    "publishedVersion": null,
    "versions": [ { /* v1 draft */ } ]
  }
}
```

### Errors

| Status | Code | Notes |
|---|---|---|
| `401` | `UNAUTHENTICATED` | Missing session |
| `400` | `VALIDATION_ERROR` | e.g. `"name": ["Skill name must be at least 2 characters"]`, `"allowedTools": ["At least one allowed tool is required"]` |
| `500` | `INTERNAL_ERROR` | DB failure |

---

## 3. Get Skill

`GET /api/skills/:id`

Returns one skill with **all versions** included.

### Path parameters
| Param | Type | Rules |
|---|---|---|
| `id` | string | Skill id (CUID) |

### Success — `200`
```jsonc
{
  "success": true,
  "data": { /* Skill — full shape including `versions` (all of them) */ }
}
```

### Errors

| Status | Code | Notes |
|---|---|---|
| `401` | `UNAUTHENTICATED` | Missing session |
| `404` | `NOT_FOUND` | No skill with this id, or it belongs to another user — `"Skill not found"` |

---

## 4. Update Skill (edit draft)

`PATCH /api/skills/:id`

Updates the current **draft** version. All fields optional — send only what changed.

> **Published skills:** if the current draft is missing or no longer `DRAFT` (i.e. it was published), a fresh `DRAFT` version is **auto-rotated** (`versionNumber + 1`) from the latest version first, then updated. Published versions stay immutable.

### Request body — `updateSkillSchema` (all optional, same field rules as create)

| Field | Type | Rules |
|---|---|---|
| `name` | string | 2–100 |
| `purpose` | string | 5–1000 |
| `instructions` | string | 5–20000 |
| `inputSchema` | object | Plain JSON object |
| `outputSchema` | object | Plain JSON object |
| `examples` | array | ≤ 50, valid `{ input, output, description? }` |
| `allowedTools` | string[] | if provided: 1–20 non-empty |
| `actionsRequiringApproval` | string[] | ≤ 20 |
| `maxExecutionSteps` | int | 1–100 |
| `notes` | string | ≤ 5000 |

### Example
```bash
curl -X PATCH http://localhost:3000/api/skills/cm5f… \
  -H "Content-Type: application/json" \
  -d '{ "name": "Sentiment Analyzer v2", "maxExecutionSteps": 20 }'
```

### Success — `200`
Returns the **updated draft version** (not the whole skill):

```jsonc
{
  "success": true,
  "data": {
    "id": "cm5f…",
    "skillId": "cm5f…",
    "versionNumber": 2,          // rotated to 2 if the previous draft was published
    "status": "DRAFT",
    "name": "Sentiment Analyzer v2",   // note: name is top-level on the Skill, synced from the draft
    /* …full SkillVersion shape */
  }
}
```

### Errors

| Status | Code | Notes |
|---|---|---|
| `401` | `UNAUTHENTICATED` | Missing session |
| `400` | `VALIDATION_ERROR` | Zod failure with `fields` |
| `403` | `FORBIDDEN` | Skill doesn't exist or isn't yours |
| `500` | `INTERNAL_ERROR` | DB failure |

---

## 5. Delete Skill (draft only)

`DELETE /api/skills/:id`

Deletes a **draft** skill and all its versions. Published skills **cannot be deleted** — archive instead.

### Success — `200`
```jsonc
{ "success": true }
```
> No `data` key on this endpoint.

### Errors

| Status | Code | Notes |
|---|---|---|
| `401` | `UNAUTHENTICATED` | Missing session |
| `403` | `FORBIDDEN` | Skill exists but isn't yours |
| `400` | `BAD_REQUEST` | `"Published skills cannot be deleted. Archive them instead."` |
| `404` | `NOT_FOUND` | Skill doesn't exist |
| `500` | `INTERNAL_ERROR` | DB failure |

---

## 6. Publish Skill Version

`POST /api/skills/:id/publish`

Publishes a draft version — it becomes the immutable `PUBLISHED` version, the skill flips to `PUBLISHED`, and `currentDraftId` is cleared.

### Request body

| Field | Type | Required | Rules |
|---|---|---|---|
| `versionId` | string | ✅ | Id of the draft version to publish |

### Example
```bash
curl -X POST http://localhost:3000/api/skills/cm5f…/publish \
  -H "Content-Type: application/json" \
  -d '{ "versionId": "cm5f…" }'
```

### Success — `200`
Returns the **published version**:

```jsonc
{
  "success": true,
  "data": {
    "id": "cm5f…",
    "skillId": "cm5f…",
    "versionNumber": 1,
    "status": "PUBLISHED",
    "publishedAt": "2026-08-03T10:00:00.000Z",
    /* …full SkillVersion shape */
  }
}
```

### Errors

| Status | Code | Notes |
|---|---|---|
| `401` | `UNAUTHENTICATED` | Missing session |
| `400` | `VALIDATION_ERROR` | Missing/invalid `versionId` |
| `400` | `BAD_REQUEST` | Business rules: `"Only draft versions can be published"` or `"Archived skills cannot be published"` |
| `403` | `FORBIDDEN` | Skill/version not found or not yours |
| `500` | `INTERNAL_ERROR` | DB failure |

---

## 7. Archive Skill

`POST /api/skills/:id/archive`

Archives the skill (`status: "ARCHIVED"`). No request body.

### Example
```bash
curl -X POST http://localhost:3000/api/skills/cm5f…/archive
```

### Success — `200`
Returns the **whole skill** with `status: "ARCHIVED"`:

```jsonc
{
  "success": true,
  "data": {
    "id": "cm5f…",
    "status": "ARCHIVED",
    /* …full Skill shape */
  }
}
```

### Errors

| Status | Code | Notes |
|---|---|---|
| `401` | `UNAUTHENTICATED` | Missing session |
| `403` | `FORBIDDEN` | Skill not found or not yours |
| `500` | `INTERNAL_ERROR` | DB failure |

---

## 8. Duplicate Skill

`POST /api/skills/:id/duplicate`

Creates a new `DRAFT` copy named `"<original> (Copy)"` with a fresh v1 draft cloned from the source's latest version. No request body.

### Example
```bash
curl -X POST http://localhost:3000/api/skills/cm5f…/duplicate
```

### Success — `201 Created`
Returns the **new duplicated skill** (full `Skill` shape):

```jsonc
{
  "success": true,
  "data": {
    "id": "cm5f…new…",
    "name": "Sentiment Analyzer (Copy)",
    "status": "DRAFT",
    "currentDraftId": "cm5f…new…",
    "versions": [ { "versionNumber": 1, "status": "DRAFT", /* …full version */ } ],
    /* …full Skill shape */
  }
}
```

### Errors

| Status | Code | Notes |
|---|---|---|
| `401` | `UNAUTHENTICATED` | Missing session |
| `403` | `FORBIDDEN` | Source skill not found or not yours |
| `500` | `INTERNAL_ERROR` | DB failure |

---

## 📋 Validation Rules Reference (Zod — `src/validators/skillSchema.ts`)

| Rule | Constraint |
|---|---|
| `name` | required · 2–100 chars |
| `purpose` | required · 5–1000 chars |
| `instructions` | 5–20000 chars |
| `inputSchema` / `outputSchema` | plain JSON object (not array/null) |
| `examples` | ≤ 50 · each `{ input: object, output: object, description? ≤ 300 }` |
| `allowedTools` | 1–20 non-empty strings |
| `actionsRequiringApproval` | ≤ 20 non-empty strings |
| `maxExecutionSteps` | integer · 1–100 |
| `notes` | ≤ 5000 chars |
| `versionId` (publish) | required non-empty string |
| List query | `search` ≤ 100 · `status`/`sortBy`/`sortOrder` enum-checked |

Unknown keys in bodies are **stripped** by Zod (default `.object` behavior), so extraneous fields are silently ignored rather than rejected.

---

## 🔐 Security Notes

- All queries are scoped to the authenticated `userId` — cross-user access is impossible.
- `PATCH` / `publish` / `archive` / `duplicate` map both "not found" **and** "not yours" to a single `403 FORBIDDEN`, so you can't probe which skill ids exist. Only `GET` and `DELETE` return `404`.
- `500` bodies never expose internals (Prisma/SQL details are logged server-side only).
- Every mutation writes an `AuditLog` row (`SKILL_CREATED`, `SKILL_UPDATED`, `SKILL_PUBLISHED`, `SKILL_ARCHIVED`, `SKILL_DELETED`, `SKILL_DUPLICATED`).
