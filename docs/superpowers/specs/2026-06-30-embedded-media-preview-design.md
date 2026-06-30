# Embedded Media Preview Design

## Scope

Add inline preview support on the paper detail page for PDF and browser-playable video files. Keep the existing new-window preview button as a fallback.

## Behavior

- PDF files render in an inline preview panel below the paper metadata and action buttons.
- Video files with extensions `mp4`, `webm`, `ogg`, `mov`, and `m4v` render in an inline `<video controls>` player.
- Upload accepts the same video extensions.
- Non-PDF/video previewable files keep the existing new-window preview flow.
- If an inline preview cannot render, users still have the existing preview/download actions.

## UI

The inline preview panel is a restrained academic utility panel: compact title row, bordered media surface, and responsive dimensions. PDF preview uses `70vh` height on desktop and a shorter mobile height. Video uses a stable `16:9` aspect ratio.

## Implementation

Add pure helpers in `js/utils.js`:

- `isPdfPreview(ext)`
- `isVideoPreview(ext)`
- `getVideoMime(ext)`
- `isEmbeddedPreview(ext)`

Use these helpers in `js/pages.js` to render the correct inline preview block in `renderDetail()`.

## Verification

- Run focused Node tests for preview helper behavior.
- Run `node --check` on changed JS files.
- Run `git diff --check`.
