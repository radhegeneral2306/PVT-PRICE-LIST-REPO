# API contract (Apps Script web app)

Transport: `POST <APPS_SCRIPT_URL>` with `Content-Type: text/plain;charset=utf-8` (avoids CORS preflight; Apps Script cannot answer OPTIONS) and body = JSON string. Response is always JSON: `{ ok: true, data }` or `{ ok: false, error: "message" }`. Follows redirects (script.google.com -> googleusercontent). All requests except `login` carry `token`.

Body: `{ action: string, token?: string, ...params }`

| action | params | data | who |
|---|---|---|---|
| `login` | `name`, `pin` | `Session` | anyone |
| `bootstrap` | | `Bootstrap` | any session |
| `getItems` | `pricelistId` | `Item[]` (rates null if hidden for role) | any |
| `getAllCurrentItems` | | `Item[]` of all current pricelists | any |
| `saveFactory` | `draft: FactoryDraft`, `id?` | `Factory` | any |
| `savePricelist` | `draft: PricelistDraft` | `Pricelist` (archives previous current list of same factoryId+category, writes Items rows) | any |
| `uploadFile` | `name`, `mime`, `base64` | `FileRef` (saved in Drive folder "Pricelist Vault Files") | any |
| `getFile` | `fileId` | `{ mime, base64 }` | any |
| `saveSettings` | `settings: Settings` | `Settings` | owner |
| `listUsers` | | `User[]` | owner |
| `saveUser` | `id?`, `name`, `role`, `pin?` | `User` | owner |
| `deleteUser` | `id` | `{}` | owner |

Rules
- Token = random string stored server side in CacheService (6h) mapped to user. Expired => `{ok:false, error:"SESSION_EXPIRED"}` and the client must show login.
- PIN stored as SHA-256(salt + pin) in `Users` sheet. 4-8 digits. Lockout: 5 wrong tries per name => 5 min wait.
- If `Settings.hideRatesFromStaff` and role === 'staff', server returns `rate: null` for every item.
- Never delete data: archiving only. `Log` sheet records every write (time, user, action, id).
- Ids: `Utilities.getUuid()` shortened to 10 chars.

Sheet tabs (row 1 = header, exact names)
- `Factories`: id, name, city, category, contactName, phone, notes, createdAt
- `Pricelists`: id, factoryId, title, category, effectiveDate, source, filesJson, itemCount, note, status, createdAt, createdBy
- `Items`: id, pricelistId, name, code, size, finish, thickness, boxPcs, unit, rate, note
- `Users`: id, name, role, pinHash, salt, failCount, lockedUntil
- `Settings`: key, value  (hideRatesFromStaff, staleWeeks)
- `Log`: time, user, action, detail

Limits: keep uploads under ~8 MB (client compresses images to max 2000 px, JPEG 0.82). Apps Script calls take 1-3 s; client must cache and show cached data first.

Dev mock: when `VITE_API_URL` is empty, `src/api/mock.ts` implements the same actions in memory (seeded) so the whole app runs and is testable without Google.
