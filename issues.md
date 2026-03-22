# Known Issues

## #1 FileUploader width stretches to container width

**Status**: Open

**Symptom**: The internal `FileUploader` expands to fill the full width of the Object Page section, even though `width="auto"` is set in `init()`.

**Root cause**: `width="auto"` controls the `FileUploader` widget's own width, but the enclosing wrapper `<div>` rendered by `SingleFileUploadRenderer` has no width constraint and stretches to fill its parent (the Custom Section grid cell).

**Proposed fix**: Add a `width` property to `SingleFileUpload` and apply it to the wrapper `<div>` in the renderer (via `rm.style("width", control.getWidth())`). Default to `"auto"`.

---

## #2 Filename link not displayed after upload

**Status**: Open

**Symptom**: After uploading a file (PATCH + PUT succeed), the filename is not shown as a download link. The File Upload section shows only the FileUploader input, not an `sap.m.Link` above it.

**Root cause (suspected)**: `onBeforeRendering` reads `context.getObject()[fileNameProperty]` to decide whether to show the link. In OData V4, `getObject()` returns the locally cached entity snapshot. If the upload writes to the backend but the OData model cache is not refreshed afterwards, `getObject()` still returns the old (empty) value and the link stays hidden.

**Proposed fix**: After a successful upload, call `context.getModel().refresh()` (or the context's `refresh()`) to force the OData model to re-fetch the entity, which will trigger a re-render with the updated filename.
