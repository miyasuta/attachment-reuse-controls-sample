# Implementation Plan

## Current Status

- [x] Library skeleton (SingleFileUpload control, properties, renderer)
- [x] FileUploader rendering
- [x] Upload flow: PATCH filename → PUT binary content
- [x] Library integration into fiorielements Object Page (via fiori-tools-servestatic)
- [x] Filename display / download link
- [x] Draft detection and draftOnly enforcement
- [x] draftOnly=false flow (EditAction → upload → draftActivate)
- [ ] File deletion
- [ ] Error handling / user feedback
- [ ] MultiFileUpload control

---

## Known Issues / Concerns

- **FileUploader width**: FileUploader stretches to full container width in Object Page.
  → Fix: set `width="auto"` on the internal FileUploader in `init()`

---

## Next Steps (SingleFileUpload)

### 1. Fix FileUploader width (quick fix)
Set `width="auto"` on the internal FileUploader so it does not stretch.

### 2. Filename display + download link
- Read `fileNameProperty` value from binding context
- If a file exists: show filename as a download link (`<a href="{streamUrl}" download>`)
- Stream URL: `{serviceUrl}{entityPath}/{contentProperty}`

### 3. Draft detection and draftOnly enforcement
- On render: read `IsActiveEntity` from binding context
- `IsActiveEntity = true` and `draftOnly = true` → disable FileUploader
- `IsActiveEntity = false` or not present → enable FileUploader
- Re-evaluate on binding context change

### 4. draftOnly=false flow
- When `IsActiveEntity = true` and `draftOnly = false`:
  1. Call `draftEdit` action (EditAction) on the entity
  2. Upload to the resulting draft context
  3. Call `draftActivate` to activate

### 5. File deletion

- Layout: ファイルリンクは FileUploader の**下**に表示する
- リンクの横に ❌ ボタン（`sap.m.Button`）を表示する
- 削除ボタンは、FileUploader が enabled のときだけ有効化する（`draftOnly=true` かつ active entity のときは disabled）
- 削除処理: `PATCH {contentProperty: null}` を送信（ファイル本体を null にするだけで fileName も自動的にクリアされる）
- 削除完了後: `context.refresh()` でモデルを同期し、リンクと削除ボタンを非表示にする

### 6. Error handling
- Show `sap.m.MessageToast` or `sap.m.MessageBox` on upload failure
- Disable FileUploader during upload to prevent double submission

---

## Development Workflow

**Always follow TDD when adding features:**

1. Write a failing QUnit test in `SingleFileUpload.qunit.ts` (or a new `.qunit.ts` for new controls)
2. Run `npm test` in `ui5-upload-controls/` and confirm the test fails
3. Implement the feature
4. Run `npm test` again and confirm all tests pass

---

## Testing Strategy

### Library-side (QUnit in ui5-upload-controls)

Write unit tests for:
- Properties (getter/setter) — easy, already scaffolded
- Rendering (FileUploader is rendered, disabled state) — easy
- Upload logic (PATCH/PUT sequence) — feasible with Sinon mocks

Mocking approach for upload logic:
```ts
// Mock binding context
const mockContext = {
    getPath: () => "/Quotations(guid'123')",
    getModel: () => ({ getServiceUrl: () => "/odata/v4/quote/" }),
    getObject: () => ({ IsActiveEntity: false })
};
sinon.stub(oControl, "getBindingContext").returns(mockContext);

// Mock fetch
sinon.stub(window, "fetch").resolves(new Response(null, { status: 200 }));
```

Sinon v4 is already configured — no additional setup needed.

### Frontend-side (OPA in fiorielements)

Write integration tests for:
- FileUploader is disabled in display mode (IsActiveEntity = true, draftOnly = true)
- FileUploader is enabled after clicking Edit
- Actual upload against mock service (sap-fe-mockserver)

### Summary

| Concern | Where to test |
|---|---|
| Properties, rendering, upload logic | Library (QUnit + Sinon) |
| Object Page integration, draft lifecycle | Frontend (OPA) |

---

## Future: MultiFileUpload

- Uses `sap.m.plugins.UploadSetwithTable`
- Backed by `@cap-js/attachments` composition pattern
- Requires SAPUI5 1.124+
