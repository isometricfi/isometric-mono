# Isometric Monorepo

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
- Prefer self-documenting code over large explanatory comments
- Keep the main method or primary public entry point near the top of the file after imports, types, and constants
- If a function reads like a sequence of commented steps, extract small named helpers instead of stacking narrative comments in one large method
- Preserve existing comments unless they are outdated or incorrect
- No emojis in logs or code

## Implementation Workflow

- State assumptions explicitly before coding when requirements are ambiguous
- If something is unclear, stop and ask instead of guessing
- If multiple reasonable interpretations exist, surface them instead of choosing silently
- If a simpler approach exists, call it out and push back on unnecessary complexity
- Prefer the simplest implementation that fully solves the requested problem
- Do not add speculative abstractions, configurability, or features that were not requested
- Avoid single-use abstractions unless they materially improve clarity
- Do not add defensive error handling for impossible scenarios
- If a solution feels overcomplicated, simplify it before shipping
- Keep changes surgical; every changed line should trace directly to the task
- Match the existing local style when making targeted edits
- Do not refactor, reformat, or clean up unrelated code, comments, or formatting while making a targeted change
- Remove imports, variables, and helpers made unused by your own changes, but leave unrelated dead code alone unless asked
- Turn tasks into verifiable success criteria before implementing
- For bug fixes, start with a failing test that reproduces the bug, then make it pass
- For multi-step work, define a brief plan with a verification step for each stage

## Code Quality

- Always use guard clauses and early returns
- Prefer readable code over micro-optimizations
- Handle edge cases explicitly
- Keep functions small and single-purpose
- Validate all user input at boundaries
- Never use magic numbers or literals; define named constants or variables for clarity
- Reduce duplicated logic by extracting shared helpers when behavior must remain identical
- For security-sensitive or arithmetic-heavy logic, prefer one well-named shared implementation over parallel copies
- Prefer explicit names over short ambiguous names, even when the explicit name is longer
- Prefer self-documenting names over explanatory comments when either would work
- Include role or phase in names when it clarifies workflow intent (e.g., `buyer_balance_sats`, `accept_journal_entry_id`)

## Security

- Use guards on all state-modifying endpoints
- Never expose sensitive data client-side
- Principle of least privilege for canister access

## Input Validation

- Define and enforce explicit lower and upper bounds for externally supplied amounts, indexes, limits, timestamps, and similar inputs
- Validate inputs at the boundary before business logic runs

## Error Handling

- Do not return success for internal failures
- Use typed errors consistently and make retriable versus non-retriable failures explicit
- Do not rely on panics as a safety mechanism

---

# Rust Patterns

- Write idiomatic Rust; embrace ownership and type system
- snake_case for variables/functions, PascalCase for types/structs
- Use `Result` and `Option` for error handling; propagate with `?`
- Use `thiserror` for custom error types
- Avoid code duplication; modularize into functions and modules
- Prefer checked, saturating, or otherwise explicitly validated arithmetic over panic-prone arithmetic
- Handle underflow, overflow, rounding, and decimal-scaling behavior explicitly
- Panic only for truly unreachable invariants, never for user-controlled inputs, cross-canister inputs, or expected failure paths
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
- **Variables and fields**: Include explicit units when the codebase mixes units for the same domain, such as `_sats`, `_cents`, `_ns`, `_seconds`, or `_basis_points`
- **Functions and methods**: Include units in the name when they compute, convert, or return values whose units are not otherwise obvious (e.g., `calculate_premium_in_sats`, `calculate_strike_price_in_cents`)
- **Default naming rule**: When choosing between a shorter ambiguous name and a longer explicit name, choose the longer explicit name

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
- Add focused unit tests for arithmetic-heavy, scaling-heavy, and boundary-sensitive functions
- Test boundary conditions explicitly: zero, minimum, maximum, underflow, overflow, rounding edges, and mismatched decimal scales
- Add regression tests for previously identified bugs before refactoring bug-prone logic

