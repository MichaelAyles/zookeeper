# Code Review: Zookeeper App

**Reviewed:** 2026-01-06
**Scope:** Full codebase review for tech debt, bugs, race conditions, and bad practices
**Status:** ✅ All critical, high, and medium priority issues fixed

---

## Critical Security Issues

### 1. ✅ FIXED: Insecure Fallback JWT Secret
**Files:** `functions/lib/auth.ts`, `functions/api/auth/demo.ts`

~~The code used a hardcoded fallback secret when `JWT_SECRET` environment variable is not set.~~

**Fix:** Now returns null/error when JWT_SECRET is not configured instead of using fallback.

---

### 2. ✅ FIXED: Missing Admin Authorization on Generate Endpoint
**File:** `functions/api/zoos/[id]/animals/generate.ts`

~~The endpoint to generate animals via AI had no admin authorization.~~

**Fix:** Added admin email check that verifies `ADMIN_EMAILS` environment variable.

---

### 3. ✅ FIXED: No CSRF Protection in OAuth Flow
**Files:** `functions/api/auth/google.ts`, `functions/api/auth/callback.ts`

~~The OAuth callback didn't validate a `state` parameter to prevent CSRF attacks.~~

**Fix:** Added state parameter generation in google.ts, stored in httpOnly cookie, and validated in callback.ts.

---

### 4. No Rate Limiting on AI Endpoints
**Files:** `functions/api/identify.ts`, `functions/api/zoos/[id]/animals/generate.ts`

AI-powered endpoints make external API calls to OpenRouter without rate limiting.

**Note:** This requires Cloudflare rate limiting configuration, not code changes. Should be addressed at infrastructure level.

---

## Race Conditions

### 5. ✅ FIXED: Non-Atomic Toggle Sighting Operation
**File:** `src/services/sightings.ts`, `functions/api/sightings/toggle.ts`

~~The read-then-write pattern was not atomic.~~

**Fix:** Created new `/api/sightings/toggle` backend endpoint that handles the operation atomically.

---

### 6. ✅ FIXED: Non-Transactional Visit Creation
**File:** `functions/api/visits/index.ts`

~~If the INSERT failed after the UPDATE succeeded, the user would end up with no active visit.~~

**Fix:** Now uses D1 batch operations to execute both statements atomically.

---

## Bugs

### 7. ✅ FIXED: Progress Count Shows Wrong Value
**File:** `src/pages/Camera.tsx`

~~The camera page showed a hardcoded 30% as "spotted count" instead of actual sightings.~~

**Fix:** Added state for spottedCount and loads actual sightings count from API.

---

### 8. ✅ FIXED: Animal Regeneration Breaks Sightings
**File:** `functions/api/zoos/[id]/animals/generate.ts`

~~Deleting all animals for a zoo invalidated foreign key references in the sightings table.~~

**Fix:** Now nullifies animal_id in sightings before deleting animals, preserving sighting records.

---

### 9. ✅ FIXED: Redundant API Call in toggleSighting
**File:** `src/services/sightings.ts`

~~The frontend checked for existing sightings before creating, causing unnecessary round-trip.~~

**Fix:** Frontend now calls the atomic `/api/sightings/toggle` endpoint directly.

---

## Tech Debt

### 10. Duplicate Type Definitions (Not Fixed)
**Files:** `functions/lib/db.ts`, `src/types/index.ts`

Types are defined in both backend and frontend with different naming conventions.

**Recommendation:** Create a shared types package or use a code generator.

---

### 11. Large Component Files (Not Fixed)
**File:** `src/pages/Camera.tsx` (1150+ lines)

The Camera component handles multiple concerns.

**Recommendation:** Extract into smaller components when time permits.

---

### 12. Inconsistent Error Handling (Not Fixed)
**File:** `src/services/identification.ts`

Some services silently swallow errors while others throw.

**Recommendation:** Establish a consistent error handling strategy.

---

### 13. ✅ FIXED: Non-null Assertions After DB Queries
**Files:** `functions/api/sightings.ts`, `functions/api/visits/[id].ts`

~~Using `!` assertions assumed the database query always returns data.~~

**Fix:** Added explicit null checks with proper error responses.

---

### 14. Missing React Query Integration (Not Fixed)
**File:** `src/App.tsx`

TanStack Query is configured but most data fetching uses manual patterns.

**Recommendation:** Refactor data fetching to use React Query hooks consistently.

---

### 15. ✅ FIXED: Legacy Code Artifacts
**Files:** `src/stores/useStore.ts`, `src/types/index.ts`

~~Legacy aliases `useProfile` and `UserProfile` added confusion.~~

**Fix:** Removed unused legacy exports.

---

## Performance Issues

### 16. ✅ FIXED: N+1 Insert Pattern
**File:** `functions/api/zoos/[id]/animals/generate.ts`

~~Inserted animals one at a time.~~

**Fix:** Now uses D1 batch API to insert all animals in a single operation.

---

### 17. ✅ FIXED: No Pagination on Zoo List
**File:** `functions/api/zoos/index.ts`

~~Fetched all zoos without pagination.~~

**Fix:** Added optional pagination with `page` and `limit` query parameters.

---

### 18. ✅ FIXED: Missing HTTP Cache Headers
**Files:** `functions/lib/db.ts`, `functions/api/zoos/index.ts`, `functions/api/zoos/[id]/animals.ts`

~~The json() helper didn't set cache headers.~~

**Fix:** Updated json() helper to support cache headers. Zoo list cached for 5 minutes, animal list cached for 10 minutes.

---

## Minor Issues

### 19. ✅ FIXED: useEffect Missing Cleanup
**File:** `src/pages/Camera.tsx`

~~The loadAnimals() async operation had no cancellation mechanism.~~

**Fix:** Added cancellation flag to prevent state updates after unmount.

---

### 20. Hardcoded External URLs (Not Fixed)
**File:** `src/pages/Camera.tsx`

Test images use external Wikipedia URLs.

**Recommendation:** Bundle locally or add fallback handling.

---

### 21. wrangler.toml Contains Google Client ID (Not Fixed)
**File:** `wrangler.toml`

While not a secret, could be moved to environment variables.

---

## Summary

| Category | Total | Fixed | Remaining |
|----------|-------|-------|-----------|
| Security | 4 | 3 | 1 (rate limiting - infra) |
| Race Conditions | 2 | 2 | 0 |
| Bugs | 3 | 3 | 0 |
| Tech Debt | 6 | 2 | 4 |
| Performance | 3 | 3 | 0 |
| Minor | 3 | 1 | 2 |
| **Total** | **21** | **14** | **7** |

**Remaining items are either:**
- Infrastructure-level changes (rate limiting)
- Larger refactoring efforts (component splitting, React Query migration)
- Low-priority cosmetic issues
