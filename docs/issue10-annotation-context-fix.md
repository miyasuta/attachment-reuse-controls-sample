# Fix #10: Binding context not propagated with annotation datasource

## Context

Fiori Elements Object Page のカスタムセクションに配置した `SingleFileUpload` / `MultiFileUpload` で、annotation datasource（`<edmx:Reference Uri="/odata/v4/quote/$metadata">`）が存在する場合に `getBindingContext()` が `undefined` のままになる。結果として：
- MultiFileUpload: テーブルバインディングが行われず、attachments が表示されない
- SingleFileUpload: ファイル名リンクが表示されない
- draftOnly=true 時に upload ボタンが有効のままになる

## Root Cause

UI5 の `_propagateProperties` にはガード条件 `if (oObject.oPropagatedProperties !== oProperties)` がある。annotation datasource 使用時、annotation モデルの初期化が先行し `oPropagatedProperties` の参照が設定される。その後 default model の binding context が到着した際、`oPropagatedProperties` は共有 mutable オブジェクトのため **参照が同じでガードが失敗**し、`updateBindingContext` / `fireModelContextChange` / `updateBindings` が呼ばれない。

**ただし重要**: `getBindingContext()` 自体は共有 `oPropagatedProperties` 経由で後からコンテキストを正常に返す（確認済み）。問題は**通知メカニズムが動かない**こと。

### 観察された動作の差異

| 条件 | modelContextChange 発火回数 | 最終回の context |
|---|---|---|
| annotation datasource なし | 9回 | あり（_bindTableItems 呼ばれる） |
| annotation datasource あり | 7回 | すべて `undefined` |

annotation datasource ありの場合、binding context が伝播する最後の `modelContextChange` が発火しない。

## Approach: CustomData binding による context 検出

UI5 のバインディングシステムを活用する。初回 propagation 時（ガード通過時）に `updateBindings` が呼ばれ、バインディングがモデルに登録される。その後 OData モデルがデータを受信すると、モデルから直接 `checkUpdate` が発火し（control tree の propagation とは独立）、バインディングが `getBindingContext()` で context を解決 → `invalidate()` が伝播 → `onBeforeRendering` が再実行される。

```
初回 propagation (guard pass) → updateBindings → binding がモデルに登録
OData レスポンス到着 → モデルが checkUpdate 発火 → binding が解決
→ CustomData.invalidate() → 親 control.invalidate() → onBeforeRendering
→ getBindingContext() で context 取得可能
```

### 代替手段が機能しない理由

| 手段 | 理由 |
|---|---|
| `setBindingContext` override | `_propagateProperties` は `setBindingContext` を呼ばず `oPropagatedProperties` を直接設定するため、override は呼ばれない |
| `propagateProperties` override | override はガードブロック内で呼ばれるため、ガード失敗時はそもそも呼ばれない |
| `setTimeout` | UI5 のアンチパターン。タイミング依存で不安定 |
| `requestAnimationFrame` / polling | 同様にタイミング依存 |

### CustomData binding が動く理由

`ODataPropertyBinding` の `change` イベントは reason `Context` で "when the parent context is changed" に発火する（UI5 API docs 確認済み）。`_propagateProperties` のガードが失敗しても、binding は OData モデルに直接登録されており、モデルの `checkUpdate` でコンテキスト変更を検知できる。

## Implementation

### Files modified

1. [MultiFileUpload.ts](../ui5-upload-controls/src/miyasuta/ui5uploadcontrols/MultiFileUpload.ts)
2. [SingleFileUpload.ts](../ui5-upload-controls/src/miyasuta/ui5uploadcontrols/SingleFileUpload.ts)
3. [MultiFileUpload.qunit.ts](../ui5-upload-controls/test/miyasuta/ui5uploadcontrols/qunit/MultiFileUpload.qunit.ts)
4. [SingleFileUpload.qunit.ts](../ui5-upload-controls/test/miyasuta/ui5uploadcontrols/qunit/SingleFileUpload.qunit.ts)

### MultiFileUpload — CustomData binding + onBeforeRendering

**import 追加:**
```typescript
import CustomData from "sap/ui/core/CustomData";
```

**private フィールド追加:**
```typescript
private _contextDetectorSetup = false;
```

**`onBeforeRendering` 追加:**
```typescript
override onBeforeRendering(): void {
    // Set up context detector binding on first render.
    // CustomData's value binding registers with the OData model via updateBindings
    // during the initial propagation pass (when _propagateProperties guard passes).
    // ODataPropertyBinding fires 'change' with reason 'Context' when parent context
    // changes — this works independently of the control tree propagation mechanism.
    // The binding triggers invalidate() → onBeforeRendering when context arrives. (#10)
    if (!this._contextDetectorSetup) {
        this._contextDetectorSetup = true;
        const oCustomData = new CustomData({ key: "ui5uploadcontrols-contextDetector" });
        oCustomData.bindProperty("value", { path: "" });
        this.addAggregation("customData", oCustomData, true); // suppressInvalidate
    }
    // When the binding triggers re-render, the context should now be available
    if (!this._lastBoundPath) {
        const context = this.getBindingContext();
        if (context) {
            this._bindTableItems(context as ODataV4Context);
            this._lastBoundPath = (context as ODataV4Context).getPath();
        }
    }
}
```

**`_onModelContextChange` は変更なし** — annotation なしの場合は既存メカニズムで即座に動作する。

### SingleFileUpload — CustomData binding

**import 追加:**
```typescript
import CustomData from "sap/ui/core/CustomData";
```

**private フィールド追加:**
```typescript
private _contextDetectorSetup = false;
```

**`onBeforeRendering` の先頭に追加:**
```typescript
override onBeforeRendering(): void {
    // Context detector binding — see MultiFileUpload for detailed explanation. (#10)
    if (!this._contextDetectorSetup) {
        this._contextDetectorSetup = true;
        const modelName = this.getModelName() || undefined;
        const oCustomData = new CustomData({ key: "ui5uploadcontrols-contextDetector" });
        oCustomData.bindProperty("value", { path: "", model: modelName });
        this.addAggregation("customData", oCustomData, true); // suppressInvalidate
    }
    // ... existing onBeforeRendering logic unchanged ...
}
```

既存の `onBeforeRendering` ロジック（context チェック → filename 表示 → requestObject fallback）は変更不要。CustomData の binding が resolve されたとき `invalidate()` → `onBeforeRendering` が再実行され、既存ロジックが context ありの状態で動く。

### Binding path `""` の理由

エンティティオブジェクト自体に解決されるため、draft/non-draft 問わず全エンティティで動作する。`IsActiveEntity` のような特定プロパティに依存しない。値は `undefined` → `{...}` に変化するため `checkUpdate` が変更を検知する。

## Tests

**MultiFileUpload.qunit.ts** — "MultiFileUpload - Context Detection (#10)" モジュール:

1. `"sets up context detector CustomData on first onBeforeRendering"` — `onBeforeRendering` 後に CustomData が1つ追加されていることを確認
2. `"does not duplicate CustomData on subsequent renders"` — `onBeforeRendering` を複数回呼んでも CustomData は1つだけ
3. `"calls _bindTableItems when context becomes available via onBeforeRendering"` — binding context ありの状態で `onBeforeRendering` を呼び、テーブルアイテムのバインディングが実行されることを確認
4. `"does not call _bindTableItems when context is absent in onBeforeRendering"` — binding context なしの状態では `_bindTableItems` が実行されないことを確認

**SingleFileUpload.qunit.ts** — "SingleFileUpload - Context Detection (#10)" モジュール:

1. `"sets up context detector CustomData on first onBeforeRendering"` — 同上
2. `"does not duplicate CustomData on subsequent renders"` — 同上
3. `"respects modelName property for context detector binding model"` — `modelName` 設定時に binding の model パラメータが正しいことを確認

## Design Decisions

1. **CustomData binding を採用**: UI5 のバインディングシステムを正しく活用。バインディングはモデルに直接登録され、`checkUpdate` / `change` イベント（reason: `Context`）は control tree propagation とは独立して動作する。`setTimeout` 不要。
2. **`onBeforeRendering` で setup**: `init()` では XML 属性（`modelName` 等）が未設定のため、`onBeforeRendering` 初回で設定。`addAggregation` は `suppressInvalidate=true` で無限ループを防止。
3. **`modelContextChange` は維持**: annotation なしの場合は既存メカニズムで即座に動作。CustomData binding はフォールバックとして機能する。
4. **Binding path `""` を使用**: エンティティオブジェクト自体に解決されるため、draft/non-draft 問わず全エンティティで動作。特定プロパティ（`IsActiveEntity` 等）に依存しない。

## 実装後の調査（CustomData binding アプローチの失敗）

### 症状

実装・ビルド後に fiorielements アプリで検証したところ、active entity を開いた場合でもアップロードボタンが有効のままになっていた。

### デバッグ結果

#### ブレークポイントで `_bindTableItems` 呼び出し時を確認

`_bindTableItems` 先頭にブレークポイントを設定してコンソールで確認:

```js
this.getBindingContext().getObject()?.IsActiveEntity  // → undefined
this._computeCanOperate()                              // → true（誤）
```

`_bindTableItems` は1回だけ呼ばれており、その時点で `getObject()` が `IsActiveEntity` を持っていない（エンティティデータ未到着）。そのため `canOperate = true` になり、`setUploadEnabled(true)` が設定された。

#### `onBeforeRendering` のログ確認

一時的に `console.log` を追加してリビルドし確認:

```
[MultiFileUpload#onBeforeRendering] {
  hasContext: false,
  path: undefined,
  IsActiveEntity: undefined,
  IsActiveEntityInObj: "no obj",
  _lastBoundPath: undefined
}
```

**`onBeforeRendering` は1回しか呼ばれない**。その時点でコンテキストがなく、`requestObject()` + `invalidate()` による2回目の呼び出しも発生しない。

### 根本原因の再分析

CustomData binding アプローチの前提「初回 propagation (guard pass) → `updateBindings` → binding がモデルに登録 → OData レスポンス到着で `checkUpdate` → `invalidate()`」が成立しない。

**実際の流れ:**

1. `onBeforeRendering`（コンテキストなし）で CustomData を `addAggregation`
2. `addAggregation` → `propagateProperties` → CustomData の binding が初期化されるが、**この時点で伝播されているコンテキストはない**
3. binding はコンテキストなしの状態でモデルに登録される（または登録されない）
4. 後からコンテキストが `oPropagatedProperties` に届いても `_propagateProperties` ガードが失敗し、CustomData への `updateBindingContext` / `updateBindings` が呼ばれない
5. binding のコンテキストが更新されないため、OData モデルの `checkUpdate` でも変化を検知できない
6. → `change` イベントが発火しない → `invalidate()` が呼ばれない → `onBeforeRendering` が再実行されない

**設計文書の誤り**: CustomData を `onBeforeRendering` で追加する場合、初回の propagation (guard pass) はすでに完了している。CustomData の binding が guard pass のタイミングでモデルに登録されるという前提が崩れている。

### 試みた追加修正（効果なし）

`onBeforeRendering` の `_bindTableItems` 呼び出し前に、`getObject()` が不完全な場合（`IsActiveEntity` なし）は `requestObject()` + `invalidate()` でリトライする処理を追加した:

```typescript
if (path.includes("IsActiveEntity=") && !(obj && "IsActiveEntity" in obj)) {
    void (context as unknown as ODataV4Context).requestObject()
        .then(() => { this.invalidate(); })
        .catch(() => {});
    return;
}
```

これも効果がなかった。`onBeforeRendering` が2回目に呼ばれないため、`requestObject` が解決しても `invalidate()` の呼び出し先がない（またはガードにより無視される）。

### 現在の状態

- CustomData binding + `onBeforeRendering` によるコンテキスト検出アプローチは **機能しない**
- テスト（QUnit）は通過しているが、テストはモックコンテキストを使うため実際の propagation 問題を再現できていない
- 代替手段の検討が必要

### 次の検討課題

以下の代替手段を検討中:

| 手段 | 評価 |
|---|---|
| `_onModelContextChange` 内で `setTimeout` リトライ | 実装が単純。annotation なし時は既存フローで動作し、annotation あり時のフォールバックとして機能する |
| `this.getModel()` → `requestCompleted` イベント購読 | イベント駆動で clean だが OData V4 model が `requestCompleted` を発火するか不確実 |
| `requestAnimationFrame` ポーリング | 確実だがアンチパターン |

## Manual Verification

```bash
# Terminal 1 — backend
cd backend && cds watch

# Terminal 2 — frontend (annotation datasource あり)
cd frontend/fiorielements && npm start
```

Object Page を開き確認:
- MultiFileUpload テーブルにデータが表示されること
- SingleFileUpload のファイル名リンクが表示されること
- draftOnly=true で upload ボタンが active entity で無効になること

npm-test アプリ（annotation datasource なし）でも regression がないこと。
