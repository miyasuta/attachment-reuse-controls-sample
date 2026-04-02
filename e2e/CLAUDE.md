# Claude Code Instructions — e2e テスト

## 概要

wdi5（WebdriverIO + UI5 ブリッジ）を使った E2E テストプロジェクト。
バックエンド（`backend`）と 各フロントエンドアプリが起動している状態で実行する。

## テスト実行方法

```bash
# このディレクトリで実行
cd e2e

npm run test:app1   # App1 のみ
npm run test:app2   # App2 のみ
npm run test:app3   # App3 のみ
npm test            # 全アプリ順番に実行
```

## アプリ構成とポート

| アプリ | フロントエンドディレクトリ | ポート | wdio 設定 | スペック |
|---|---|---|---|---|
| App1 | `frontend/fiorielements` | 8080 | `wdio.conf.app1.ts` | `specs/app1/` |
| App2 | `frontend/fiorielements.no.annotations` | 8081 | `wdio.conf.app2.ts` | `specs/app2/` |
| App3 | `frontend/freestyle-nondraft` | 8082 | `wdio.conf.app3.ts` | `specs/app3/` |

## 事前条件

テスト実行前に以下をすべて起動しておくこと：

```bash
# Terminal 1: バックエンド
cd backend && cds watch

# Terminal 2: App1
cd frontend/fiorielements && npm start

# Terminal 3: App2
cd frontend/fiorielements.no.annotations && npm start

# Terminal 4: App3
cd frontend/freestyle-nondraft && npm start
```

## ファイル構成

```
e2e/
├── package.json
├── tsconfig.json
├── wdio.conf.base.ts         # 共通設定
├── wdio.conf.app1.ts         # App1 用（port 8080）
├── wdio.conf.app2.ts         # App2 用（port 8081）
├── wdio.conf.app3.ts         # App3 用（port 8082）
├── fixtures/
│   └── upload.txt            # アップロード用テストファイル
└── specs/
    ├── shared/
    │   └── fioriElements.shared.ts   # App1/App2 共通テストスイート
    ├── app1/
    │   └── index.e2e.ts      # runFioriElementsTests("1") を呼ぶだけ
    ├── app2/
    │   └── index.e2e.ts      # runFioriElementsTests("2") を呼ぶだけ
    └── app3/
        └── singleFileUpload.e2e.ts   # App3 専用（スモークテストのみ）
```

## 共通テストスイート（App1 / App2）

`specs/shared/fioriElements.shared.ts` に `runFioriElementsTests(appNum: string)` をエクスポート。
App1 は `"1"`、App2 は `"2"` を渡して呼び出す。これにより TC 番号（`TC-1-2-3` / `TC-2-2-3`）が自動的に切り替わる。

**テスト実行順序**（describe ブロックの順）：
1. `x-2. Single File Upload（draftOnly=false）` — 照会モードから開始
2. `x-4. Multi File Upload（draftOnly=false）` — 照会モードから開始
3. `x-1. Single File Upload（draftOnly=true）`
4. `x-3. Multi File Upload（draftOnly=true）`

draftOnly=false を先に実行するのは、照会モード（Edit ボタンを押さない状態）でのテストを
before フック直後の状態で行えるようにするため。

**before フック**：
1. `waitForUI5()` でブリッジ確認
2. `navigateToObjectPage()` でオブジェクトページに遷移（`IsActiveEntity=true` を URL で確認）
3. `clickEdit()` → 4コントロール全ファイル削除（クリーンアップ） → `clickSave()`

## 依存パッケージ

| パッケージ | バージョン | 用途 |
|---|---|---|
| `wdio-ui5-service` | `^3` | wdi5 本体（npm パッケージ名）|
| `@wdio/cli` | `^9` | WebdriverIO v9 |
| `@wdio/local-runner` | `^9` | ローカル実行ランナー |
| `@wdio/mocha-framework` | `^9` | Mocha フレームワーク |
| `@wdio/spec-reporter` | `^9` | テスト結果レポーター |

> **注意**: `@wdi5/wdi5` というパッケージは存在しない。正しい npm パッケージ名は `wdio-ui5-service`。

---

## wdi5 ブリッジに関する重要な知見

### ブリッジが失われる問題（最重要）

wdi5 サービスは WebdriverIO の `before` フック内で次の処理を行う：

1. `baseUrl`（`http://localhost:8080/index.html` など）へ遷移
2. wdi5 ブリッジ（`window.wdi5`）をページに注入

**この後でテストコードが `browser.url()` を呼ぶとページがリロードされ、ブリッジが消える。**

```typescript
// ❌ NG: before フックで url() を呼ぶとブリッジが失われる
before(async () => {
    await browser.url("/index.html"); // ← これがブリッジを壊す
});

// ✅ OK: url() を呼ばず、ブリッジの準備完了を待つ
before(async () => {
    await (browser as any).waitForUI5();
});
```

`browser.waitForUI5()` は wdi5 が `addCommand` で追加するメソッドで、UI5 と wdi5 ブリッジの
両方が ready になるまで待機する。TypeScript の型定義が解決されないため `as any` キャストが必要。

### asControl を使ったコントロール選択

DOM の CSS クラスセレクター（`.sapUiMdcTableInner tbody tr`）は UI5 バージョンや
テーブルタイプによって変わるため信頼性が低い。wdi5 の `asControl` API を使うこと。

```typescript
// ❌ NG: CSS クラスに依存（バージョンで変わる可能性あり）
const firstRow = await $(".sapUiMdcTableInner tbody tr:first-child");

// ✅ OK: wdi5 の UI5 コントロール選択（型定義が解決しないため as any が必要）
const firstRow = await (browser as any).asControl({
    selector: { controlType: "sap.m.ColumnListItem" }
});
await firstRow.press();
```

- Fiori Elements の List Report（Responsive Table）: `sap.m.ColumnListItem`
- Freestyle の List（`sap.m.List`）: `sap.m.StandardListItem`

---

## セレクターに関する知見

### Fiori Elements 標準アクションボタン

`sap.m.Button` の DOM 構造は button 本体の他に内部 span（`-inner`、`-content`）や
BDI 要素（`-BDI-content`）を持つ。`[id*="StandardAction::Edit"]` だけでは複数要素にマッチする。

**`button` タグで絞ること。**

```typescript
// ❌ NG: 内部 span にもマッチする可能性がある
const editBtn = $('[id*="StandardAction::Edit"]:not([id*="-content"])');

// ✅ OK: button 要素のみ対象
const editBtn = $('button[id*="StandardAction::Edit"]');
const saveBtn = $('button[id*="StandardAction::Save"]');
```

### Multi File Upload — 空状態の判定

UI5 の `sap.m.Table` は空のとき行を CSS で非表示にするが DOM には残す場合がある。
`isExisting()` では空かどうかを判定できない。空状態イラストの表示を使うこと。

```typescript
// ❌ NG: 行が CSS 非表示でも true を返す
const isEmpty = !(await $(`[id*="idDraftOnlyMultiFileUpload"] .sapMListTbl tbody tr.sapMLIB`).isExisting());

// ✅ OK: 空状態イラスト（DragFilesToUpload）の表示で判定
const MULTI_EMPTY = 'use[href="#sapIllus-Spot-DragFilesToUpload"]';
const isEmpty = await $(`[id*="idDraftOnlyMultiFileUpload"] ${MULTI_EMPTY}`).isDisplayed();
```

### 削除ボタンのクリック

フッターバーが画面下部を覆っているため、`browser.execute(e => e.click())` だと
UI5 の press イベントが発火しない場合がある。`scrollIntoView` してから WebdriverIO の
`element.click()` を使うこと（`jsClick` ヘルパー参照）。

```typescript
// ❌ NG: UI5 press イベントが発火しないケースがある
await browser.execute((e: HTMLElement) => e.click(), resolvedElement);

// ✅ OK: スクロール後に WebdriverIO click
async function jsClick(el: any): Promise<void> {
    const resolved = await el;
    await browser.execute((e: HTMLElement) => e.scrollIntoView({ block: "center" }), resolved as unknown as HTMLElement);
    await resolved.click();
}
```

---

## TypeScript 設定の注意点

`tsconfig.json` に以下を必ず含めること：

```json
{
  "compilerOptions": {
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "sap/*": ["node_modules/@openui5/types/types/sap/*"]
    }
  }
}
```

- `skipLibCheck: true` — `wdio-ui5-service` が依存する SAP 型モジュールが解決できないため必須
- `paths` — SAP UI5 型定義のパスマッピング（`controlType` などの型解決に使用）

## wdio.conf.ts の注意点

- `autoCompileOpts` は WebdriverIO v9 では不要（`wdi5Config` 型に存在しない）
- TypeScript のトランスパイルは WebdriverIO v9 が自動的に処理する
- `services: ["ui5"]` が wdi5 サービスの登録方法
- アプリごとに `wdio.conf.appN.ts` を用意し、`baseConfig` を spread して `baseUrl` と `specs` を上書きする

## 初期セットアップ方法

新しいプロジェクトに wdi5 を追加する場合は、`npm init wdi5@latest -- --ts` を使うと
`wdio.conf.ts` と `tsconfig.json` のテンプレートが自動生成される。

```bash
cd <project-dir>
npm init wdi5@latest -- --ts \
  --configPath . \
  --baseUrl "http://localhost:8080/index.html" \
  --specs "./specs/**/*.e2e.ts"
```

> `--specs` に glob パターンを渡すと、`create-wdi5` がそのパターン文字列をディレクトリ名として
> 解釈してしまう既知の不具合がある。生成後に `specs/**/*.e2e.ts/` という名前のディレクトリが
> できていたら手動で削除すること。
