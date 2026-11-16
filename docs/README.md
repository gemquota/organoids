# Organoids documentation

This directory contains current project documentation. The canonical feature and implementation status is maintained in one place; older parallel audit snapshots and duplicated pointer files have been removed.

## Start here

| Document | Purpose |
|---|---|
| [Project overview](organoids/PROJECT.md) | Identity, scope, lineage and governing principles |
| [Canonical feature catalogue](organoids/FEATURES.md) | Current capabilities, source/test evidence, limitations and next proposals |
| [161-item evolutionary ecology backlog](organoids/EVOLUTION_BACKLOG.md) | Preserved requirements lineage and historical upstream checkbox snapshot |
| [Runtime and emergence guide](EMERGENCE.md) | High-level explanation of the running substrate and emergence layers |

## Technical references

| Document | Purpose |
|---|---|
| [Architecture](organoids/ARCHITECTURE.md) | Core entities, state ownership, rules, transactions and physical quantities |
| [Execution semantics](organoids/EXECUTION_SEMANTICS.md) | Ordering, snapshots, mutation and rollback guarantees |
| [Modularity](organoids/MODULARITY.md) | Module topology, responsibilities and dependency boundaries |
| [Specification](organoids/SPECIFICATION.md) | Consolidated architectural contract |
| [Decisions](organoids/DECISIONS.md) | User-confirmed decisions and project constraints |
| [Implementation log](organoids/IMPLEMENTATION_LOG.md) | Chronological changes, not a live status table |

## Status authority

Only `docs/organoids/FEATURES.md` is authoritative for Organoids implementation status. The 161-item backlog is a separate inherited requirements list; its historical checkboxes must not be counted as verified Organoids implementation.
