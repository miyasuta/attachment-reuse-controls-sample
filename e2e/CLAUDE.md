# Claude Code Instructions — e2e テスト

## 概要

wdi5（WebdriverIO + UI5 ブリッジ）を使った E2E テストプロジェクト。
フロントエンド（`frontend/fiorielements`）と バックエンド（`backend`）の両方が起動している状態で実行する。

## テスト実行方法

```bash
# このディレクトリで実行
cd e2e
npm test
```

## 事前条件

テスト実行前に以下を起動しておくこと：

```bash
# Terminal 1: バックエンド
cd backend && cds watch

# Terminal 2: フロントエンド
cd frontend/fiorielements && npm start
```

## 依存パッケージ

| パッケージ | バージョン | 用途 |
|---|---|---|
| `wdio-ui5-service` | `^3` | wdi5 本体（npm パッケージ名）|
| `@wdio/cli` | `^9` | WebdriverIO v9 |
| `@wdio/local-runner` | `^9` | ローカル実行ランナー |
| `@wdio/mocha-framework` | `^9` | Mocha フレームワーク |
| `@wdio/spec-reporter` | `^9` | テスト結果レポーター |

> **注意**: `@wdi5/wdi5` というパッケージは存在しない。正しい npm パッケージ名は `wdio-ui5-service`。

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

## wdi5 ブリッジに関する重要な知見

### ブリッジが失われる問題（最重要）

wdi5 サービスは WebdriverIO の `before` フック内で次の処理を行う：

1. `baseUrl`（`http://localhost:8080/index.html`）へ遷移
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
const firstRow = await browser.asControl({
    selector: { controlType: "sap.m.ColumnListItem" }
} as any);
await firstRow.press();
```

Fiori Elements の List Report はデフォルトで Responsive Table（`sap.m.Table`）を使用するため、
行アイテムのコントロールタイプは `sap.m.ColumnListItem`。

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

## ファイル構成

```
e2e/
├── package.json
├── tsconfig.json
├── wdio.conf.ts          # wdi5/WebdriverIO 設定
├── fixtures/
│   └── upload.txt        # アップロード用テストファイル
└── specs/
    └── *.e2e.ts          # テストスペック
```
