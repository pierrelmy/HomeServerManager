# Coding Standards

## Language and module system

- **TypeScript** strict mode, both packages use `"type": "module"` (ESM)
- Imports in source files use the `.js` extension even for `.ts` files (Node.js ESM resolution)
- Node.js 24 minimum — native APIs preferred (`node:sqlite`, `node:crypto`, `node:fs`)

## Validation

- **Zod** is the single validation library. Every external input (request body, params, query, env vars) is validated with Zod before use.
- Schema definitions live alongside their consumers or in `shared/contracts.ts` if shared across packages
- Use `.strict()` on object schemas to reject extra fields
- Backend env vars are validated in `src/config.ts` via `loadConfig()`

## Comments

Default: **no comments**. Add a comment only when the WHY is non-obvious: a hidden constraint, a workaround for a bug, or behaviour that would surprise a reader. Never describe WHAT the code does — names do that.

## Abstractions

Do not introduce abstractions beyond what the task requires. Three similar lines is better than a premature abstraction. No helper utilities "just in case". No feature flags.

## Error handling

- At system boundaries (HTTP routes, WebSocket messages): catch and convert to typed errors
- Internal code: let errors propagate — do not add try/catch for scenarios that cannot happen
- Backend uses `HttpError`, `unauthorized()`, `forbidden()` from `src/shared/errors.ts`
- Zod validation errors are caught globally in `app.ts` `setErrorHandler` and returned as 400

## File organisation

- **Backend**: all routes in `src/app.ts`, business logic in `src/services/`, persistence in `src/repositories/`, system I/O in `src/system/`
- **Frontend**: pages in `src/pages/`, data access in `src/data/`, live system in `src/live/`, domain types in `src/domain/`
- Prefer editing existing files. Create new files only when the concept is genuinely new.

## Naming

- Functions and variables: `camelCase`
- Types and interfaces: `PascalCase`
- Files: `kebab-case`
- Zod schemas: `<name>Schema` (e.g. `createServiceSchema`)
- Event types use dot notation strings: `"service.updated"`, `"terminal.line.appended"`
