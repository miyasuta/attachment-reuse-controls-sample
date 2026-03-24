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

## #6 Upload button not visible in MultiFileUpload toolbar (Edit mode)

**Status**: Open

**Symptom**: In the Object Page Edit mode (draft entity, `IsActiveEntity=false`), the toolbar above the attachments table shows no upload button, even though `_computeCanOperate()` should return `true`. Drag & drop still works as a fallback.

**Design question**: `UploadSetwithTable` supports two upload entry points: drag & drop and a dedicated upload button rendered by the `ActionsPlaceholder` (`UploadButtonPlaceholder`). Having both is the expected UX — the button is needed for users who cannot drag & drop (e.g. touch devices).

**Suspected root cause**: The upload button injected by `UploadSetwithTable` into the `ActionsPlaceholder` may not appear because the plugin is added via `oTable.addDependent(this._uploadPlugin)` instead of the `plugins` aggregation. `UploadSetwithTable` is a table plugin and is expected to be wired through `table.addPlugin()` (or the `plugins` aggregation). Using `addDependent` may skip the plugin lifecycle hook that injects the button.

**Proposed fix**: Replace `oTable.addDependent(this._uploadPlugin)` with `oTable.addPlugin(this._uploadPlugin)` (or add via the `plugins` aggregation) so the plugin can inject the upload button into the `ActionsPlaceholder`.

---

## #7 Attachments table stays empty after drag & drop upload (and after browser refresh)

**Status**: Resolved (partially — see also #8 for the initial load issue)

**Symptom**: After a successful drag & drop upload (POST + PUT return 2xx), the attachments table remains empty. Refreshing the browser does not help — the table is still empty. Data was reportedly persisted (upload did not error), but the table never shows it.

**Suspected root cause (binding not refreshing)**: After upload, `_handleUpload` calls:
```ts
((table).getBinding("items") as { refresh(): void }).refresh();
```
For an OData V4 `ListBinding` that was set up via `bindItems({path: "attachments"})` on a relative context, calling `refresh()` may not actually re-fetch if the binding was created before the parent binding context was fully activated, or if the binding is suspended. The Fiori Elements page may also suppress or throttle refreshes initiated outside its own flow.

**Suspected root cause (binding context mismatch after draft activate)**: With `draftOnly=true`, upload goes to the current draft entity (`IsActiveEntity=false`). After the Fiori Elements "Save" (draftActivate), the Object Page switches the binding context to the active entity (`IsActiveEntity=true`). The table binding, however, may still reference the draft entity path that no longer exists. On browser refresh, the active entity's attachments are loaded — but the binding path built in `_bindTableItems` at the time of first render may differ from what is needed after activation.

**Proposed investigation**:
1. Check whether `table.getBinding("items")` returns a valid binding immediately after `bindItems()` (it may return `null` if no context is set yet).
2. Verify the network request triggered by `refresh()` — confirm the correct URL is called and what is returned.
3. Check whether `draftOnly=true` with a draft entity causes the attachment POSTs to be committed only upon draftActivate (CAP behaviour may batch composition changes with the draft).

**Root cause (confirmed)**: `table.getBinding("items").refresh()` throws `"Refresh on this binding is not supported"`. UI5 OData V4 relative list bindings (created via `bindItems({path: "attachments"})` without `$$ownRequest: true`) do not support direct `refresh()` calls — they delegate request management to the parent binding. As a result, no GET request was issued after upload, and the table stayed empty.

**Fix**: After a successful upload or delete, call `_bindTableItems(context)` directly instead of `binding.refresh()`. This re-creates the list binding from scratch, which immediately fires a new GET request to fetch the latest attachments from the server.

---

## #8 MultiFileUpload table stays empty on initial load in Fiori Elements Object Page

**Status**: Resolved

**Symptom**: When an Object Page is opened with existing attachments, the `MultiFileUpload` table shows "No documents available" even though records exist in the backend. `SingleFileUpload` (via the standard Attachments plugin) displays correctly.

**Root cause**: Fiori Elements does not call `setBindingContext()` directly on child controls. Instead, the binding context propagates from the parent view through the UI5 internal chain `propagateProperties()` → `updateBindingContext()`. This means:

1. On initial render, `onBeforeRendering()` fires before the context is available → `if (!context) return` → `_bindTableItems()` is never called.
2. When the context later arrives via `updateBindingContext()`, `onBeforeRendering()` is **not** re-triggered automatically because `MultiFileUpload` has no property bindings (which are the normal mechanism that causes `invalidate()` to be scheduled).

**Fix**: Attach a `modelContextChange` listener in `init()`. This event is fired by `updateBindingContext()` whenever the effective binding context changes, covering both direct `setBindingContext()` calls and propagated context changes. In the handler, call `_bindTableItems()` with the same deduplication guard (`_lastBoundPath`) used in `onBeforeRendering()`.

```ts
// init()
this.attachModelContextChange(this._onModelContextChange.bind(this));

// handler
private _onModelContextChange(): void {
    const context = this.getBindingContext();
    if (!context) return;
    const currentPath = (context as ODataV4Context).getPath();
    if (this._lastBoundPath !== currentPath) {
        this._bindTableItems(context as ODataV4Context);
        this._lastBoundPath = currentPath;
    }
}
```

