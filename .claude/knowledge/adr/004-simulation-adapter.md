# ADR-004: SimulationSystemAdapter vs LocalSystemAdapter

## Status

Accepted

## Context

The backend orchestrates real system operations: starting/stopping systemd services, managing Docker containers, querying NAS status, running update scripts. These operations cannot run safely in development, CI, or test environments.

## Decision

The `SystemAdapter` interface has two implementations, selected by `SYSTEM_ADAPTER` env var:

- `SimulationSystemAdapter`: returns plausible fake data, performs no I/O, never calls Docker or systemd. Always used in dev (`SYSTEM_ADAPTER=simulation`) and in all CI/test runs.
- `LocalSystemAdapter`: executes real commands from allowlists (`SYSTEM_SERVICE_MAP`, `TOOL_COMMANDS`, `NAS_SCRUB_COMMAND`, `NAS_STATUS_COMMAND`). Only used in production (`SYSTEM_ADAPTER=local`). Config validation rejects any other adapter in production.

Commands are injected at construction time as pre-parsed `string[]` arrays — no runtime string interpolation from user input.

## Consequences

- All features must degrade gracefully in simulation mode — the UI must not break when system data is mocked
- `SimulationSystemAdapter` must be kept complete — every method the interface defines must have a simulation implementation
- CI always runs with `SYSTEM_ADAPTER=simulation`, so CI passing does not guarantee the production adapter works correctly (manual validation on the real host is required)
- Adding a new system integration means adding the interface method to both adapter implementations
