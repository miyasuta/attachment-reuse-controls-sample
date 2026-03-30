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

**Status**: Resolved

**Symptom**: In the Object Page Edit mode (draft entity, `IsActiveEntity=false`), the toolbar above the attachments table shows no upload button, even though `_computeCanOperate()` should return `true`. Drag & drop still works as a fallback.

**Design question**: `UploadSetwithTable` supports two upload entry points: drag & drop and a dedicated upload button rendered by the `ActionsPlaceholder` (`UploadButtonPlaceholder`). Having both is the expected UX — the button is needed for users who cannot drag & drop (e.g. touch devices).

**Root cause**: `ActionsPlaceholder` was added to the toolbar but never associated with the plugin. Per the `UploadSetwithTable` API: *"Action buttons are rendered only when the association to the placeholder control is set."* The `actions` association (`addAction()`) was missing, so the plugin never knew which placeholder to inject its button into. Note: `addDependent` is correct and intentional — the API docs confirm this is the expected way to attach the plugin.

**Fix**:
- Give `ActionsPlaceholder` a stable ID (`this.getId() + "--uploadButton"`) and pass it to `UploadSetwithTable` via the `actions` property (array of IDs) in the constructor.
- Add `ToolbarSpacer` before `ActionsPlaceholder` in the toolbar so the Upload button is right-aligned.
- Add `this._uploadPlugin.setUploadEnabled(canOperate)` in `setEnabled()` so the upload button is disabled in display mode when `draftOnly=true`.

```ts
const sPlaceholderId = this.getId() + "--uploadButton";

this._uploadPlugin = new UploadSetwithTable(sPluginId, {
    beforeUploadStarts: this._onBeforeUploadStarts.bind(this),
    actions: [sPlaceholderId]  // associate by ID
});

const oPlaceholder = new ActionsPlaceholder(sPlaceholderId, {
    placeholderFor: UploadSetwithTableActionPlaceHolder.UploadButtonPlaceholder
});

new Toolbar({ content: [new ToolbarSpacer(), oPlaceholder] })
```

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

## #9 MultiFileUpload: Upload button stays enabled when `draftOnly="true"` and entity is active

**Status**: Resolved

**Symptom**: When `draftOnly="true"` is set and the entity is in display mode (`IsActiveEntity=true`), the Upload button in the `MultiFileUpload` toolbar remains visually enabled. Clicking it does not send any request to the backend.

**Root cause**: `_bindTableItems` computed `canOperate` and applied it to the delete button template, but did not call `this._uploadPlugin.setUploadEnabled(canOperate)`. As a result, `UploadSetwithTable` kept its default `uploadEnabled=true` regardless of the draft state.

**Fix**: Added `this._uploadPlugin.setUploadEnabled(canOperate)` in `_bindTableItems` immediately after computing `canOperate`.

```ts
const canOperate = this._computeCanOperate();
this._uploadPlugin.setUploadEnabled(canOperate);  // ← added
```

**Tests added** (`ui5-upload-controls` — `MultiFileUpload.qunit.ts`):
- `_computeCanOperate` module: 2 additional cases — `draftOnly=true + IsActiveEntity=true → false`, no binding context → `true`
- New module "Upload Button State": 4 cases verifying `_uploadPlugin.getUploadEnabled()` after `_bindTableItems`, covering all combinations of `draftOnly` × `enabled` × entity state

---

## #10 binding context が伝播されない（annotation datasource 使用時）

**Status**: Resolved

**Symptom**: Fiori Elements Object Page のカスタムセクションに配置した `SingleFileUpload` / `MultiFileUpload` で、`getBindingContext()` が常に `undefined` を返す。結果として `draftOnly="true"` 時に Upload ボタンが有効のままになり、テーブルバインディングも行われない。

**再現条件**: annotation.xml 内にサービス `$metadata` への Reference がある場合に発生する。annotation datasource を削除すると正常に動作する。

**根本原因**: UI5 `ManagedObject._propagateProperties` の参照等価ガード（`if (oObject.oPropagatedProperties !== oProperties)`）が、shared mutable object への変更を検知できずに `updateBindingContext` / `fireModelContextChange` をブロックする。ただし `getBindingContext()` は shared mutable `oPropagatedProperties` から直接読み取るため、ガード後でも正常にコンテキストを返す。問題は「通知が来ない」だけ。

**Fix**: `_onModelContextChange` でコンテキストが `undefined` の場合に `setTimeout` ポーリングを開始する。`getBindingContext()` を 100ms 間隔（最大50回 = 5秒）でポーリングし、コンテキストが到着したら `_bindTableItems()` / `invalidate()` を呼び出す。public API のみ使用。

annotation datasource なしの場合は `_onModelContextChange` で即座にコンテキストが取得でき、ポーリングは開始されない。

**合わせて修正（IsActiveEntity タイミング問題）**: `_computeCanOperate()` が `getObject()` に依存しており、データ未到着時に誤って `true` を返していた。`IsActiveEntity` は OData キーの一部であり `getBindingContext().getPath()` に常に含まれるため、`getPath()` の正規表現マッチを一次判定とし、`getObject()` をフォールバックに変更。

---

## #11 MultiFileUpload: アップロード後にテーブルが更新されない

**Status**: Resolved

**Symptom**: `MultiFileUpload` でファイルをアップロードすると POST/PUT リクエストは正常に送信されるが、アップロード後のテーブル再取得（GET）が行われない。ドラフトを保存（draftActivate）するとページリロードが発生し、その時点でファイルが表示される。

**再現手順**:
1. Fiori Elements Object Page の Edit モード（`IsActiveEntity=false`）で `MultiFileUpload` を使用
2. ファイルをドロップまたは Upload ボタンで選択
3. POST（attachment 作成）と PUT（content アップロード）は成功する
4. しかしテーブルの GET リクエストが発生せず、テーブルが更新されない
5. ドラフトを保存すると初めてファイルが表示される

**根本原因**: アップロードは raw `fetch` で行われ OData V4 モデルを経由しないため、モデルのキャッシュが古いまま残る。`_bindTableItems()` を再度呼んでも、同じパス・コンテキストに対してモデルがキャッシュを返し GET が発生しない。annotation datasource がある場合（#10 の再現環境）、FE が `$expand=attachments` でエンティティを取得するため `attachments` のキャッシュが格納されており、この問題が顕在化した。

**Fix**: アップロード/削除の成功後に `_bindTableItems()` を呼ぶ代わりに `context.requestSideEffects([{ $NavigationPropertyPath: attachmentsSegment }])` を呼ぶ。OData V4 モデルのキャッシュを破棄して GET を強制する正規の API。

---

## #12 MultiFileUpload: 表示モードでファイルを削除してもファイルが削除されない

**Status**: Resolved

**Symptom**: 表示モード（`IsActiveEntity=true`）の状態で `MultiFileUpload` からファイルを削除しても、ファイルが実際には削除されない。

**再現手順**:
1. Fiori Elements Object Page を表示モード（`IsActiveEntity=true`）で開く
2. `MultiFileUpload` の削除ボタンをクリック
3. 外見上は削除されたように見えるが、ページをリロードするとファイルが残っている

**根本原因**: 削除処理が DRAFT EDIT → DELETE → DRAFT ACTIVATE のシーケンスで実行されている。しかし `@cap-js/attachments` の attachment エンティティはドラフト対応コンポジションではなく、直接削除（DELETE リクエスト）が正しい操作である。ドラフトを介すると、draftActivate 時に CAP がドラフトの差分をアクティブエンティティに適用するが、attachment の削除はドラフトに記録されず、結果として削除が反映されない。

**期待する動作**: DELETE は常にドラフトライフサイクルを経由せず、直接 `IsActiveEntity=false` のドラフトエンティティの attachment に対して DELETE リクエストを送信すべき。または、表示モード（`IsActiveEntity=true`）の場合は attachment エンティティに直接 DELETE リクエストを送信する。

**Fix**:
- `_onRowDeletePress` のドラフトライフサイクル分岐（`_deleteWithDraftLifecycle`）を削除し、常に `_deleteDirect` を呼ぶように変更。
- `_deleteWithDraftLifecycle` メソッドを削除。
- 不要になった `parentEntityPath`・`obj` 変数を削除。
- テスト更新：`draftOnly=false` + `IsActiveEntity=true` の削除テストを「CSRF + DELETE の 2 呼び出し、アクティブエンティティの attachment に直接 DELETE」を検証する内容に変更。

