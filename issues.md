# Known Issues

## #1 FileUploader width stretches to container width

**Status**: Open

**Symptom**: The internal `FileUploader` expands to fill the full width of the Object Page section, even though `width="auto"` is set in `init()`.

**Root cause**: `width="auto"` controls the `FileUploader` widget's own width, but the enclosing wrapper `<div>` rendered by `SingleFileUploadRenderer` has no width constraint and stretches to fill its parent (the Custom Section grid cell).

**Proposed fix**: Add a `width` property to `SingleFileUpload` and apply it to the wrapper `<div>` in the renderer (via `rm.style("width", control.getWidth())`). Default to `"auto"`.

---

## #2 Filename link not displayed after upload

**Status**: Resolved

**Symptom**: After uploading a file (PATCH + PUT succeed), the filename is not shown as a download link. The File Upload section shows only the FileUploader input, not an `sap.m.Link` above it.

**Root cause (suspected)**: `onBeforeRendering` reads `context.getObject()[fileNameProperty]` to decide whether to show the link. In OData V4, `getObject()` returns the locally cached entity snapshot. If the upload writes to the backend but the OData model cache is not refreshed afterwards, `getObject()` still returns the old (empty) value and the link stays hidden.

**Fix**: After a successful upload, update the link and delete button directly in `_onFileChange` (no need to wait for model refresh since the filename is already known), then call `context.refresh()` to sync the OData model.

---

## #3 Filename link and delete button not shown in display mode after browser refresh

**Status**: Resolved

**Symptom**: After uploading a file, saving (draft activate), and refreshing the browser, the "File Upload" custom section shows only the FileUploader input with no filename link or delete button. Switching to Edit mode causes them to appear correctly.

**Root cause**: Fiori Elements loads Object Page data asynchronously. When `onBeforeRendering` is called on initial render (display mode, `IsActiveEntity=true`), `context.getObject()` returns `undefined` because the OData fetch is still in progress. The control renders with no link/button. Since `SingleFileUpload` does not use UI5 property bindings, the subsequent data arrival does not trigger a re-render automatically — only a context change (e.g. switching to Edit mode) causes `onBeforeRendering` to fire again with the loaded data.

**Fix**: In `onBeforeRendering`, when `context.getObject()` returns `undefined`, call `context.requestObject()` (ODataV4 async API). When the Promise resolves and the loaded data contains a non-empty `fileNameProperty` value, call `this.invalidate()` to trigger a re-render with the now-available data.

```ts
if (obj === undefined || obj === null) {
    (context as ODataV4Context).requestObject().then((loaded: unknown) => {
        const asyncFileName = (loaded as Record<string, unknown>)?.[fileNameProp] as string;
        if (asyncFileName) {
            this.invalidate();
        }
    }).catch(() => {});
}
```
