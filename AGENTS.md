# Volumetric Monorepo

Monorepo using pnpm workspaces and Turborepo.

## Tech Stack

- **Canister**: Rust ICP canister
- **Web**: Next.js with TypeScript, Tailwind CSS, Shadcn UI
- **Build**: Makefile (`make build` local, `make release` Docker)
- **Package Manager**: pnpm with Turborepo

## Canister Structure (apps/volumetric_canister/src/volumetric)

- `storage/` - Stable memory: CBOR wrapper, config cell, whitelist map
- `api/` - Canister endpoints
- `guards.rs` - Authorization checks (is_controller, is_whitelisted)
- `errors.rs` - VolumetricError enum
- `lib.rs` - Entry point, init, candid export

---

# Conventions

## Commits

- Use conventional commits: feat, fix, chore, refactor, docs
- Scopes: `(canister)` for canister, `(web)` for web app
- Keep commit messages short (under 72 chars)
- Never use commit description/body, only the subject line (no multi-line commits)
- Format: `type(scope): short message`

## General

- Run `cargo fmt` after Rust changes
- Run `cargo check` before committing
- Run `make generate` to update TypeScript types after API changes
- Never commit without explicit permission
- Minimal comments; only document non-obvious logic
- Preserve existing comments unless they are outdated or incorrect
- No emojis in logs or code

## Code Quality

- Always use guard clauses and early returns
- Prefer readable code over micro-optimizations
- Handle edge cases explicitly
- Keep functions small and single-purpose
- Validate all user input at boundaries
- Never use magic numbers or literals; define named constants or variables for clarity

## Security

- Use guards on all state-modifying endpoints
- Never expose sensitive data client-side
- Principle of least privilege for canister access

---

# Rust Patterns

- Write idiomatic Rust; embrace ownership and type system
- snake_case for variables/functions, PascalCase for types/structs
- Use `Result` and `Option` for error handling; propagate with `?`
- Use `thiserror` for custom error types
- Avoid code duplication; modularize into functions and modules
- Write unit tests with `#[test]` in `#[cfg(test)]` modules

## ICP Canister Patterns

- Use `ic-stable-structures` with CBOR wrapper for persistent state
- Use `thread_local!` with `RefCell` for state management
- Guards return `Result<(), VolumetricError>` and are awaited in update calls
- Use `#[ic_cdk::query]` for reads, `#[ic_cdk::update]` for writes
- Export interface with `ic_cdk::export_candid!()` (keep Principal in scope)
- Regenerate .did via `make build` after API changes

---

# Web App Patterns

- Functional and declarative; avoid classes
- Favor React Server Components (RSC) and Next.js SSR
- Minimize `'use client'`, `useEffect`, `setState`
- Use Zustand for global state, TanStack Query for data fetching
- Use Zod for schema validation
- Use Tailwind CSS with Shadcn UI and Radix UI
- Mobile-first responsive design
- Descriptive variable names: `isLoading`, `hasError`

## Naming Conventions

- **Folders**: lowercase-with-dashes (e.g., `layout/`, `wallet/`)
- **Component files**: PascalCase (e.g., `ConnectButton.tsx`, `Navbar.tsx`)
- **shadcn ui/**: Keep lowercase (shadcn convention)
- **Time constants**: Include explicit duration and unit in the name (e.g., `BASE_BACKOFF_1_MINUTE_MS`, `MAX_AGE_6_MINUTES_MS`)

## TypeScript File Organization

- Place the primary exported/public function near the top of the file (after imports, types, and constants)
- Keep internal helper functions below the exported API
- If helper logic grows beyond simple private functions, move it into a colocated `_internal/` directory
- Keep internal module tests in the same `_internal/` directory (e.g., `_internal/*.test.ts`)

## Directory Structure

```
src/
  components/           # Shared components (used across multiple pages)
    ui/                 # shadcn primitives (lowercase)
    layout/             # App-wide layout (Navbar, ThemeProvider)
    wallet/             # Wallet-related (ConnectButton)
    navigation/         # Navigation helpers (AnimatedToggle)

  app/
    _components/        # Page-specific components (colocated)
    page.tsx
    
    [route]/
      _components/      # Route-specific components
      page.tsx
```

## Component Organization

- **Shared components** (`components/`): Used by 2+ pages
- **Page-specific components** (`app/[route]/_components/`): Only used by one page, colocated for easy maintenance
- Use `_components/` prefix to signal "not a route" to Next.js router

---

# Testing Conventions

Use the **given/when/then** pattern for all tests.

Each comment (`// given`, `// when`, `// then`) must be:
- On its own line (never combined like `// given/when`)
- Separated by a blank line from the previous section

## Rust Tests

Add a `/// Given: ... / When: ... / Then: ...` doc comment above each test function, with each clause on its own line.

```rust
/// Given: a valid input
/// When: calling function_under_test
/// Then: returns the expected result
#[test]
fn test_example() {
    // given
    let input = setup_test_data();

    // when
    let result = function_under_test(input);

    // then
    assert_eq!(result, expected);
}
```

## TypeScript Tests (Vitest)

Use a descriptive test name that reads as a behavioral assertion. No doc comments above the test -- the name is the description.

```typescript
test("should return expected result for valid input", () => {
  // given
  const input = setupTestData();

  // when
  const result = functionUnderTest(input);

  // then
  expect(result).toBe(expected);
});
```

## Guidelines

- Use descriptive variable names in tests to make assertions self-documenting
- Avoid magic numbers; use named constants for all values (seeds, amounts, expected results)
- Use constants for domain-specific numbers (e.g., `SATS_PER_BTC`, `CENTS_PER_DOLLAR`)
- Keep each test focused on a single behavior
- Code should be self-documenting; prefer clear naming over comments
- Define test inputs as constants in the `// given` section
- Define assertion-only values (prefixed with `EXPECTED_`) in the `// then` section
- Reuse input constants for assertions when verifying the input was stored correctly
