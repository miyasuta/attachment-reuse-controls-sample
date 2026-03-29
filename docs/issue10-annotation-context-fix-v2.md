# Fix #10: Annotation datasource binding context propagation (v2)

## 問題の概要

Fiori Elements Object Page のカスタムセクションに配置した `MultiFileUpload` / `SingleFileUpload` で、annotation datasource が存在する場合に `modelContextChange` が binding context 付きで発火しない。原因は UI5 `_propagateProperties` のガード条件（参照等価チェック）が shared mutable object の変更を検知できないため。

**確認済み事実:**
- `getBindingContext()` はコンテキスト到着後に正常に値を返す（shared mutable `oPropagatedProperties` 経由）
- 問題は「通知メカニズムが動かない」ことだけ
- binding ベースのアプローチ（CustomData 等）は `updateBindingContext` がガード内でブロックされるため全て不可
- internal メソッドの override はバージョン保証がないため不採用

---

## Step 1: setTimeout ポーリングによるコンテキスト検出

### アプローチ

`_onModelContextChange` でコンテキストが undefined の場合、`setTimeout` で `getBindingContext()` をポーリングする。public API のみ使用。

```
modelContextChange (context=undefined)
  → _startDeferredContextCheck()
  → setTimeout(100ms) → getBindingContext() チェック
  → context あり → _bindTableItems() / invalidate()
  → context なし → リトライ（最大50回 = 5秒）
```

annotation datasource なしの場合は `_onModelContextChange` で即座にコンテキストが取得でき、ポーリングは開始されない。

### 実装内容

**MultiFileUpload.ts:**
- `import CustomData` / `_contextDetectorSetup` 削除
- `onBeforeRendering` 内の CustomData セットアップ・`requestObject` リトライ・`console.log` 削除
- `_deferredCheckTimer`, `_deferredCheckCount`, `MAX_DEFERRED_CHECKS` 追加
- `_onModelContextChange` にポーリング開始を追加
- `_startDeferredContextCheck()` / `exit()` 追加

**SingleFileUpload.ts:**
- `import CustomData` / `_contextDetectorSetup` 削除
- `onBeforeRendering` 内の CustomData セットアップ削除
- `init()` に `attachModelContextChange` 追加
- `_onModelContextChange` / `_startDeferredContextCheck()` / `exit()` 追加

### 結果

テスト・ビルド: ✅ 通過
手動検証: **NG** — upload ボタンがまだ有効のまま

---

## Step 2: _computeCanOperate タイミング問題の発見

### デバッグ（Chrome DevTools ブレークポイント）

`_bindTableItems` の先頭にブレークポイントを設定して確認:

```js
parentContext.getObject()  // → undefined  ← エンティティデータ未到着
parentContext.getPath()    // → '/Quotations(ID=...,IsActiveEntity=true)'
```

`_bindTableItems` は呼ばれている（ポーリング動作確認）。しかし `_computeCanOperate()` が `getObject()` を参照しており、データ未到着のため `undefined?.IsActiveEntity === true` = `false` → `true`（誤）を返す。

### 解決策: getPath() からの IsActiveEntity 取得

`IsActiveEntity` は OData キーの一部であり、`getBindingContext().getPath()` に**常に含まれる**。`getObject()` のロードを待たずに同期的に取得可能。

```typescript
// 変更前（getObject() に依存、データ未到着時に誤動作）
const obj = context?.getObject();
return !(obj?.IsActiveEntity === true && this.getDraftOnly());

// 変更後（path から同期的に取得、getObject() はフォールバック）
const path = context?.getPath?.() ?? "";
const match = path.match(/IsActiveEntity=(true|false)/i);
if (match) return match[1].toLowerCase() !== "true";
const obj = context?.getObject();
return !(obj?.IsActiveEntity === true);
```

対象: `MultiFileUpload._computeCanOperate()` / `SingleFileUpload._computeCanOperate()`
`SingleFileUpload.onBeforeRendering` の `IsActiveEntity` ロード待ちブロックも削除（不要）。

### 結果

テスト・ビルド: ✅ 通過
手動検証: ✅ — 照会モード（IsActiveEntity=true）でボタン無効、ドラフトモード（IsActiveEntity=false）でボタン有効を確認

---

## 現在の実装ファイル

- `ui5-upload-controls/src/miyasuta/ui5uploadcontrols/MultiFileUpload.ts`
- `ui5-upload-controls/src/miyasuta/ui5uploadcontrols/SingleFileUpload.ts`
- `ui5-upload-controls/test/miyasuta/ui5uploadcontrols/qunit/MultiFileUpload.qunit.ts`
- `ui5-upload-controls/test/miyasuta/ui5uploadcontrols/qunit/SingleFileUpload.qunit.ts`

## Verification

```bash
# テスト実行
cd ui5-upload-controls && npm test

# 手動検証 (annotation datasource あり)
cd backend && cds watch
cd frontend/fiorielements && npm start
# Object Page で: テーブルにデータ表示、ファイル名リンク表示、draftOnly=true で active entity のボタン無効

# Regression 確認 (annotation datasource なし — npm-test アプリ)
```
