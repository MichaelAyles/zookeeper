# Code Review: Zookeeper App

**Reviewed:** 2026-01-06
**Scope:** Full codebase review for tech debt, bugs, race conditions, and bad practices

---

## Critical Security Issues

### 1. Insecure Fallback JWT Secret
**Files:** `functions/lib/auth.ts:122`, `functions/api/auth/demo.ts:56`

```typescript
const secret = env.JWT_SECRET || 'demo-secret-not-for-production';
```

The code uses a hardcoded fallback secret when `JWT_SECRET` environment variable is not set. In production, if the secret isn't configured, JWTs would be signed with a known, predictable key, allowing attackers to forge authentication tokens.

**Recommendation:** Remove the fallback and fail explicitly if `JWT_SECRET` is not set.

---

### 2. Missing Admin Authorization on Generate Endpoint
**File:** `functions/api/zoos/[id]/animals/generate.ts:27-28`

```typescript
// Only admins can generate animals
// TODO: Add admin check here
```

The endpoint to generate animals via AI has a TODO comment for admin authorization but no actual implementation. Any authenticated user can regenerate the animal list for any zoo, potentially causing data loss (existing sightings reference deleted animal IDs).

**Recommendation:** Add admin check similar to `Admin.tsx:26` pattern:
```typescript
const adminEmails = (env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
if (!adminEmails.includes(data.user.email.toLowerCase())) {
  return error('Forbidden', 403);
}
```

---

### 3. No CSRF Protection in OAuth Flow
**File:** `functions/api/auth/callback.ts`

The OAuth callback doesn't validate a `state` parameter to prevent CSRF attacks. An attacker could trick a user into authenticating with an attacker-controlled Google account.

**Recommendation:** Generate and validate a random state token:
```typescript
// In /api/auth/google - generate state
const state = crypto.randomUUID();
// Store in cookie or session, include in redirect URL

// In callback - verify state matches
```

---

### 4. No Rate Limiting on AI Endpoints
**Files:** `functions/api/identify.ts`, `functions/api/zoos/[id]/animals/generate.ts`

AI-powered endpoints make external API calls to OpenRouter without rate limiting. A malicious user could:
- Run up significant API costs
- Perform DoS attacks on the service

**Recommendation:** Implement rate limiting using Cloudflare's rate limiting features or a simple token bucket in D1.

---

## Race Conditions

### 5. Non-Atomic Toggle Sighting Operation
**File:** `src/services/sightings.ts:24-45`

```typescript
export async function toggleSighting(visitId: string, animalId: string) {
  const sightings = await getSightingsByVisit(visitId);  // Read
  const existing = sightings.find((s) => s.animalId === animalId);

  if (existing) {
    await deleteSighting(existing.id);  // Write
    return { added: false };
  }
  // ... create new sighting
}
```

This read-then-write pattern is not atomic. Rapid double-taps on an animal could:
- Create duplicate sightings if both reads happen before either write
- Throw errors from concurrent delete/create operations

**Recommendation:** Move toggle logic to the backend as a single atomic operation, or use optimistic UI updates with error recovery.

---

### 6. Non-Transactional Visit Creation
**File:** `functions/api/visits/index.ts:49-60`

```typescript
// End any active visits for this user
await env.DB.prepare(
  'UPDATE visits SET ended_at = ? WHERE user_id = ? AND ended_at IS NULL'
).bind(new Date().toISOString(), data.user.id).run();

// Create new visit
const id = generateId();
await env.DB.prepare(
  'INSERT INTO visits (id, user_id, zoo_id, started_at) VALUES (?, ?, ?, ?)'
).bind(id, data.user.id, body.zooId, now).run();
```

If the INSERT fails after the UPDATE succeeds, the user ends up with no active visit. These operations should be wrapped in a transaction.

**Recommendation:** Use D1 batch operations or implement proper error handling with rollback.

---

## Bugs

### 7. Progress Count Shows Wrong Value
**File:** `src/pages/Camera.tsx:70`

```typescript
const spottedCount = animals.length > 0 ? Math.floor(animals.length * 0.3) : 0;
// Placeholder until we load real data
```

The camera page shows a hardcoded 30% as "spotted count" instead of actual sightings. This misleads users about their progress.

**Recommendation:** Load actual sightings count:
```typescript
const [spottedCount, setSpottedCount] = useState(0);
useEffect(() => {
  if (activeVisit) {
    getSightingsByVisit(activeVisit.id).then(s => setSpottedCount(s.length));
  }
}, [activeVisit]);
```

---

### 8. Animal Regeneration Breaks Sightings
**File:** `functions/api/zoos/[id]/animals/generate.ts:108`

```typescript
await env.DB.prepare('DELETE FROM animals WHERE zoo_id = ?').bind(zooId).run();
```

Deleting all animals for a zoo invalidates foreign key references in the `sightings` table. While SQLite won't enforce this without explicit FK pragma, it causes orphaned sightings that reference non-existent animals.

**Recommendation:**
- Add foreign key constraints with ON DELETE CASCADE or SET NULL
- Alternatively, soft-delete animals instead of hard delete
- Consider preserving sightings by matching on animal name when regenerating

---

### 9. Redundant API Call in toggleSighting
**File:** `src/services/sightings.ts:29-35`

The frontend checks for existing sightings before creating, but the backend (`functions/api/sightings.ts:72-108`) already handles upsert logic. This causes an unnecessary round-trip.

**Recommendation:** Create a dedicated `/api/sightings/toggle` endpoint that handles the entire operation atomically.

---

## Tech Debt

### 10. Duplicate Type Definitions
**Files:** `functions/lib/db.ts`, `src/types/index.ts`

Types like `Zoo`, `Sighting`, `Visit`, and `User` are defined in both backend and frontend with different naming conventions (snake_case vs camelCase). This creates maintenance burden and type drift risk.

**Recommendation:**
- Create a shared types package
- Or use a code generator to produce types from the D1 schema

---

### 11. Large Component Files
**File:** `src/pages/Camera.tsx` (1150+ lines)

The Camera component handles multiple states (scanning, identifying, result, error, funFail), camera management, test mode, and all associated UI. This makes it difficult to test and maintain.

**Recommendation:** Extract into smaller components:
- `CameraViewfinder.tsx`
- `IdentificationResult.tsx`
- `CameraControls.tsx`
- `useCameraStream.ts` (custom hook)

---

### 12. Inconsistent Error Handling
**File:** `src/services/identification.ts:21-24`

```typescript
} catch (error) {
  console.error('Identification failed:', error);
  return { animal: null, confidence: 0 };  // Silent failure
}
```

Some services silently swallow errors and return default values, while others throw. This inconsistency makes debugging difficult and can hide real issues.

**Recommendation:** Establish a consistent error handling strategy:
- Always throw and let the caller handle
- Or use a Result type pattern
- Log errors consistently with context

---

### 13. Non-null Assertions After DB Queries
**Files:** `functions/api/sightings.ts:99`, `functions/api/visits/[id].ts:83-88`

```typescript
return json({
  id: updated!.id,  // Dangerous!
  visitId: updated!.visit_id,
  // ...
});
```

Using `!` assertions assumes the database query always returns data. If there's a race condition or data inconsistency, this causes runtime crashes.

**Recommendation:** Handle null cases explicitly:
```typescript
if (!updated) {
  return error('Failed to update', 500);
}
return json({ id: updated.id, ... });
```

---

### 14. Missing React Query Integration
**File:** `src/App.tsx:20-27`

TanStack Query is configured but most data fetching uses manual `useEffect` + `useState` patterns. This means:
- No automatic caching
- No background refetching
- No deduplication of requests
- Manual loading/error state management

**Recommendation:** Refactor data fetching to use React Query hooks consistently:
```typescript
const { data: stats, isLoading } = useQuery({
  queryKey: ['stats'],
  queryFn: getUserStats,
});
```

---

### 15. Legacy Code Artifacts
**Files:** `src/stores/useStore.ts:75-81`, `src/types/index.ts:134-139`

```typescript
// Legacy alias for backwards compatibility
export const useProfile = () => { ... };

// Legacy type - now aliases to User
export interface UserProfile { ... }
```

These legacy aliases add confusion and maintenance burden. If they're no longer needed, they should be removed.

**Recommendation:** Search for usages, migrate any remaining code, and remove the legacy exports.

---

## Performance Issues

### 16. N+1 Insert Pattern
**File:** `functions/api/zoos/[id]/animals/generate.ts:114-128`

```typescript
for (const animal of animals) {
  const id = generateId();
  await env.DB.prepare(
    `INSERT INTO animals ...`
  ).bind(...).run();  // One query per animal!
}
```

Inserting animals one at a time is slow. D1 supports batch operations that would significantly improve performance.

**Recommendation:** Use D1 batch API:
```typescript
const statements = animals.map(animal =>
  env.DB.prepare('INSERT INTO animals ...').bind(...)
);
await env.DB.batch(statements);
```

---

### 17. No Pagination on Zoo List
**File:** `functions/api/zoos/index.ts:30`

```typescript
const zoosResult = await env.DB.prepare('SELECT * FROM zoos').all<Zoo>();
```

Fetches all zoos without pagination. As the database grows, this will become increasingly slow and memory-intensive.

**Recommendation:** Add pagination:
```typescript
const page = parseInt(url.searchParams.get('page') || '1');
const limit = 50;
const offset = (page - 1) * limit;
// ... LIMIT ? OFFSET ?
```

---

### 18. Missing HTTP Cache Headers
**Files:** `functions/lib/db.ts:76-81`

The `json()` helper doesn't set cache headers. Static data like zoo lists and animal data could benefit from caching.

**Recommendation:** Add appropriate cache headers:
```typescript
export function json<T>(data: T, status = 200, maxAge = 0): Response {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (maxAge > 0) {
    headers['Cache-Control'] = `public, max-age=${maxAge}`;
  }
  return new Response(JSON.stringify(data), { status, headers });
}
```

---

## Minor Issues

### 19. useEffect Missing Cleanup
**File:** `src/pages/Camera.tsx:80-86`

```typescript
useEffect(() => {
  if (!testCameraEnabled) {
    startCamera();
  }
  loadAnimals();  // No cleanup for this async operation
  return () => stopCamera();
}, [testCameraEnabled]);
```

The `loadAnimals()` async operation has no cancellation mechanism. If the component unmounts while loading, it will still try to update state.

---

### 20. Hardcoded External URLs
**File:** `src/pages/Camera.tsx:27-45`

Test images use external Wikipedia URLs that could change or become unavailable. These should either be bundled locally or have fallback handling.

---

### 21. wrangler.toml Contains Sensitive Info
**File:** `wrangler.toml:6`

```toml
GOOGLE_CLIENT_ID = "272681506012-d787rj7g211goia7tm5d7g14c0c7jp21.apps.googleusercontent.com"
```

While not a secret, the Google Client ID could be moved to environment variables for consistency and to avoid accidental exposure of patterns.

---

## Summary

| Category | Count | Severity |
|----------|-------|----------|
| Security | 4 | Critical |
| Race Conditions | 2 | High |
| Bugs | 3 | Medium |
| Tech Debt | 6 | Low-Medium |
| Performance | 3 | Medium |
| Minor | 3 | Low |

**Priority fixes:**
1. Remove hardcoded JWT secret fallback
2. Add admin authorization to generate endpoint
3. Implement CSRF protection for OAuth
4. Fix toggle sighting race condition
5. Fix progress count bug in Camera page
