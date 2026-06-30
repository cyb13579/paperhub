# Edit Uploaded Paper Design

## Scope

Add an owner-only edit flow for uploaded paper records. The owner can update metadata and optionally replace the uploaded file while preserving the original paper ID, reviews, ratings, favorites, and download count.

## Behavior

- Detail page shows an `编辑` button only when the current user owns the paper.
- The edit page route is `#/edit/:id`.
- Editable fields: title, subject, year, nickname/display email, tags, and description.
- File replacement is optional. If no new file is chosen, existing file fields stay unchanged.
- If a new file is chosen, upload the new file, update `file_path`, `file_type`, and `file_size`, then best-effort delete the old Storage object.
- The edit form validates title length, allowed file extensions, non-empty files, and 100MB maximum size.
- If replacement upload succeeds but database update fails, show the error and best-effort delete the newly uploaded file to avoid orphaned files.
- If the current user is not the owner, redirect to the detail page and show a toast.

## Implementation

Reuse existing Supabase storage and database APIs. Add small pure helpers in `js/utils.js` for allowed upload extensions and file validation. Use these helpers in both upload and edit flows so the rules stay consistent.

## Verification

- Run helper tests.
- Run `node --check` for changed JS files.
- Run `git diff --check`.
