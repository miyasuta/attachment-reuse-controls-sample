# Fix #11: MultiFileUpload — アップロード後にテーブルが更新されない

## 問題の概要

`MultiFileUpload` でファイルをアップロードすると POST/PUT は成功するが、テーブルの GET が発生しない。ドラフト保存（draftActivate）でページリロードが起きた時点で初めてファイルが表示される。

---

## 根本原因

### OData V4 モデルのキャッシュ問題

アップロードは生の `fetch` で直接 OData エンドポイントに送信される。OData V4 モデルを経由しないため、**モデルのキャッシュには古いデータが残ったまま**になる。

アップロード後に `_bindTableItems(context)` を呼んでも、`table.bindItems({path: "attachments"})` で作成される新しいリストバインディングは同じパス・同じコンテキストを参照するため、**OData V4 モデルがキャッシュのデータを返し、ネットワークリクエストが発生しない**。

### なぜ #10 で問題が顕在化したか

annotation datasource がある場合、Fiori Elements の Object Page は `$expand=attachments` を含むリクエストでエンティティデータを取得する。これにより `attachments` のデータが OData V4 モデルのキャッシュに格納される。

```
# annotation datasource あり（#10 以降の再現環境）
GET /Projects(ID=...,IsActiveEntity=false)?$expand=attachments
→ キャッシュに attachments が格納される
→ 後から _bindTableItems を呼んでもキャッシュが返される → GET 不発

# annotation datasource なし（#8 以前の環境）
GET /Projects(ID=...,IsActiveEntity=false)  ← $expand なし
→ attachments がキャッシュにない
→ bindItems が毎回個別 GET を発行 → 正常に動作
```

`_bindTableItems` 自体は #8 と現在で同一のコードだが、annotation datasource の有無によって OData V4 モデルのキャッシュ状態が変わるため、挙動が異なっていた。

---

## 修正内容

アップロード/削除の成功後、`_bindTableItems()` を呼ぶ代わりに `context.requestSideEffects()` を呼ぶ。

`requestSideEffects` は OData V4 モデルに「サーバー側でこの navigation property のデータが変わった」と通知する API であり、**キャッシュを破棄して GET を強制する**。バインディングを再構築せず、FE のライフサイクルとも協調する。

### `_handleUpload`（MultiFileUpload.ts）

```ts
// 変更前
this._bindTableItems(context as ODataV4Context);

// 変更後
await (context as ODataV4Context).requestSideEffects([{ $NavigationPropertyPath: this.getAttachmentsSegment() }]);
```

### `_onRowDeletePress`（MultiFileUpload.ts）

```ts
// 変更前
this._bindTableItems(this.getBindingContext() as ODataV4Context);

// 変更後
await parentContext.requestSideEffects([{ $NavigationPropertyPath: this.getAttachmentsSegment() }]);
```

### テスト修正（MultiFileUpload.qunit.ts）

- 各モックコンテキストに `requestSideEffects: sinon.stub().resolves()` を追加
- アップロード成功後に `requestSideEffects` が呼ばれること・`attachmentsSegment` を正しく渡していることを検証するアサーションを追加
- 削除成功後に同様の検証を追加

---

## 影響ファイル

- `ui5-upload-controls/src/miyasuta/ui5uploadcontrols/MultiFileUpload.ts`
- `ui5-upload-controls/test/miyasuta/ui5uploadcontrols/qunit/MultiFileUpload.qunit.ts`

---

## 検証方法

1. `npm test` でユニットテストが通ること（66 tests SUCCESS）
2. ブラウザで Edit モード（`IsActiveEntity=false`）でファイルをアップロード → POST/PUT 後に GET が発生し、テーブルに即時反映されること
3. アップロード失敗時（ネットワークエラー等）に `requestSideEffects` が呼ばれないこと
4. ファイル削除後も同様にテーブルが即時更新されること
