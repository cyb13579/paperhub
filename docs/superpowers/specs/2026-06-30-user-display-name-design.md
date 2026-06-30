# User Display Name Design

## Scope

Add account-level display names backed by the `profiles` table. Display names should be used wherever the UI shows a person, while email remains the stable login and friend lookup identifier.

## Behavior

- `profiles` gets a `display_name` column.
- New signups create a profile with `email` and an empty `display_name`.
- Logged-in users can edit their display name from a profile page at `#/profile`.
- Header and sidebar show display name when set, otherwise email.
- Upload and edit flows default author display to the account display name and do not require per-upload nickname entry.
- Reviews store and show display name when available, with email fallback.
- Friend lists and requests show display name plus email when possible.
- Old records remain readable. Existing `user_email` values are treated as legacy display text.

## Data Compatibility

The app should work before the SQL migration is run. Profile reads and updates should fail softly and fall back to the authenticated user's email.

## Verification

- Test display name formatting helpers.
- Run JS syntax checks.
- Run `git diff --check`.
