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

---

## #5 Downloaded file is named "file.xlsx" instead of the actual stored filename

**Status**: Resolved (backend configuration)

**Symptom**: When the user clicks the filename link to download an attached file (e.g. `report.xlsx`), the browser saves it as `file.xlsx` (or `content`) instead of the name stored in the `fileNameProperty` field.

**Root cause**: The download link `href` points to the OData binary property endpoint (e.g. `.../Entity(key)/content`). The browser determines the save-as filename from the `Content-Disposition: attachment; filename="..."` response header. Without explicit configuration, CAP does not include this header, so the browser falls back to the URL's last path segment or a generic name.

**Fix**: Add `@Core.ContentDisposition.Filename` to the `LargeBinary` property in the CDS model:

```cds
entity YourEntity : managed {
  content  : LargeBinary @Core.MediaType: 'application/octet-stream'
                          @Core.ContentDisposition.Filename: fileName;
  fileName : String;
}
```

This causes CAP to include `Content-Disposition: attachment; filename="<storedFileName>"` in the response, and the browser uses the correct filename.

---

## #4 PATCH for filename fails when `draftOnly=false` in display mode

**Status**: Resolved

**Symptom**: When `draftOnly="false"` is set and the user uploads or deletes a file from display mode (`IsActiveEntity=true`), the PATCH request for updating the filename fails.

**Root cause**: `_uploadWithDraftLifecycle` read `@odata.id` from the `draftEdit` response body to derive the draft entity URL. However, CAP's `draftEdit` action does **not** include `@odata.id` in the response — only `@odata.context` is returned. As a result, `draftId` was `undefined`, and the PATCH was sent to `/odata/v4/<service>/undefined` (HTTP 404/500).

Additionally, `_onDeletePress` always patched the active entity directly, which fails on draft-enabled services where active entities are read-only.

**Fix**:
- In `_uploadWithDraftLifecycle`: derive the draft entity path by replacing `IsActiveEntity=true` with `IsActiveEntity=false` in the original `entityPath`, instead of parsing `@odata.id`.
- In `_onDeletePress`: when `draftOnly=false` and `IsActiveEntity=true`, delegate to `_deleteWithDraftLifecycle` (draftEdit → PATCH to clear file on draft → draftActivate) instead of patching the active entity directly.

```ts
// Before (broken)
const draftEntity = await draftEditResponse.json();
const draftId = draftEntity["@odata.id"]; // undefined in CAP
await this._uploadDirect(serviceUrl, `/${draftId}`, file, csrfToken);

// After
const draftEntityPath = entityPath.replace(/IsActiveEntity=true/i, "IsActiveEntity=false");
await this._uploadDirect(serviceUrl, draftEntityPath, file, csrfToken);
```
