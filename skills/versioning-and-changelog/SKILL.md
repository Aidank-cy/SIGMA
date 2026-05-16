# Versioning and Changelog

Use this project skill as the local contract for changelog compliance.

## Flow 1: Auto-update after code changes

After every completed phase or sub-feature:
1. Update `CHANGELOG.md` under `[Unreleased]`.
2. Place the entry under the category implied by the conventional commit prefix:
   - `feat:` -> `Added`
   - `fix:` -> `Fixed`
   - `refactor:` or `chore:` -> `Changed`
3. Start each entry with a verb.
4. Do not commit without the changelog update.

## Release format

Keep a Changelog sections are used:
- `Added`
- `Changed`
- `Deprecated`
- `Removed`
- `Fixed`
- `Security`

Semantic Versioning governs release tags once the project reaches releasable state.
