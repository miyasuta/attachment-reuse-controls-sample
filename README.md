# attachment-reuse-controls

This repository is a sample project demonstrating reusable UI5 file upload controls integrated with a CAP backend using the `@cap-js/attachments` plugin.

## Purpose

The goal is to build a reusable UI5 control library (`ui5-upload-controls`) that provides file upload components for use across multiple projects. The library is designed to be backend-agnostic: it connects to any CAP service that uses the `@cap-js/attachments` plugin by receiving the OData service URL and navigation path via properties.

The sample includes a Fiori Elements frontend to demonstrate how the controls are consumed in practice.

## Repository Structure

```
attachment-reuse-controls/
├── backend/              # CAP application (Node.js)
│   └── ...               # Exposes OData V4 service with @cap-js/attachments plugin
├── frontend/
│   └── fiorielements/    # SAP Fiori Elements app (OData V4)
│                         # Embeds ui5-upload-controls via Custom Section
├── ui5-upload-controls/  # UI5 control library (git submodule)
│   └── ...               # See https://github.com/miyasuta/ui5-upload-controls
├── .gitmodules           # Submodule configuration
└── .mcp.json             # MCP server configuration for Claude
```

> `ui5-upload-controls/` is a **git submodule** pointing to a separate repository.
> See the [Setup](#setup) section for how to initialize it.

## Components

### backend

- Runtime: SAP Cloud Application Programming Model (CAP), Node.js
- Uses the `@cap-js/attachments` plugin for out-of-the-box attachment handling
- Exposes an OData V4 service with a draft-enabled entity that has an `attachments` composition

### frontend/fiorielements

- SAP Fiori Elements List Report / Object Page (OData V4)
- Embeds `ui5-upload-controls` as a Custom Section in the Object Page
- No manual upload/download logic — all delegated to the control library

### ui5-upload-controls (submodule)

A UI5 control library (`io.github.miyasuta.upload`) providing two controls:

| Control | Description |
|---|---|
| `SingleFileUpload` | Single file upload/download for entities with a `LargeBinary` property |
| `MultiFileUpload` | Table-style multi-file upload using `sap.m.plugins.UploadSetwithTable`, backed by the `@cap-js/attachments` composition pattern |

Both controls resolve the OData navigation path from the parent Binding Context automatically, so they can be placed statically in XML without controller code.

## Key Design Decisions

- **Controls are backend-agnostic**: they receive `serviceUrl` and `attachmentsSegment` as properties and derive the full navigation path from `getBindingContext()`.
- **Library is a separate Git repository**: `ui5-upload-controls` is maintained independently and included here as a submodule to demonstrate the intended production setup.
- **Fiori Elements and Freestyle compatible**: the controls are Custom Controls (`sap.ui.core.Control`) and can be placed in any XML View or Fragment, including Fiori Elements Custom Sections.

## Setup

### 1. Clone with submodule

```bash
git clone --recurse-submodules https://github.com/miyasuta/attachment-reuse-controls-sample.git
cd attachment-reuse-controls-sample
```

If you already cloned without `--recurse-submodules`:

```bash
git submodule update --init
```

### 2. Install dependencies

```bash
# Backend
cd backend
npm install

# Library
cd ../ui5-upload-controls
npm install

# Fiori Elements app
cd ../frontend/fiorielements
npm install
```

### 3. Run

```bash
# In backend/
cds watch

# In frontend/fiorielements/
npm start
```

## Updating the submodule

To pull the latest commits from the `ui5-upload-controls` repository:

```bash
git submodule update --remote ui5-upload-controls
git add ui5-upload-controls
git commit -m "chore: update ui5-upload-controls submodule"
```

## npm パッケージとしての利用（frontend/npm-test）

`frontend/npm-test` は、`ui5-upload-controls` を git submodule ではなく **npm パッケージ**として消費するサンプルです。

### セットアップ

```bash
cd frontend/npm-test
npm install
npm run start-local  # バックエンドも起動しておくこと
```

### 動作確認で得られた知見

#### 1. ライブラリの npm パッケージへの要件

UI5 Tooling によるライブラリの自動配信には、npm パッケージに以下が必要：

- **`ui5.yaml` を同梱すること**（`package.json` の `files` に含める）
- **`resources.configuration.paths.src` を `dist/resources` に設定すること**

```yaml
# ライブラリの ui5.yaml
resources:
  configuration:
    paths:
      src: dist/resources
```

`ui5.yaml` がないと、消費側で `fiori-tools-servestatic` を手動設定する必要がある。

#### 2. 消費側アプリの設定

`package.json` の `ui5.dependencies` にライブラリを列挙する：

```json
"ui5": {
  "dependencies": ["ui5-upload-controls"]
}
```

これにより `ui5 ls` でライブラリが依存として検出される。

#### 3. 開発サーバーの注意点

| コマンド | 挙動 |
|---|---|
| `npm start` | UI5 を CDN (`ui5.sap.com`) から取得。`/resources` を全て CDN に転送するため、カスタムライブラリが **404** になる |
| `npm run start-local` | SAPUI5 をローカルフレームワークとして使用。UI5 Tooling がカスタムライブラリを自動配信し、正常動作する |

`fiori-tools-proxy` の `ui5.path: [/resources]` が全リクエストを CDN に転送するのが原因。

#### 4. CF デプロイ向けビルド

`ui5 build --all` でライブラリリソースをアプリの `dist/` に含められる。ただしライブラリの `.source.less` を再コンパイルしようとしてエラーになるため、`--exclude-task=buildThemes` が必要：

```bash
ui5 build preload --all --exclude-task=buildThemes --config ui5-deploy.yaml
```

`--exclude-task=buildThemes` でスキップしても問題ない理由：ライブラリの `dist/resources` には既にコンパイル済みの CSS テーマが含まれているため。

---

## Requirements

- Node.js 20+
- `@sap/cds` 8 or 9
- SAPUI5 1.124+ (for `sap.m.plugins.UploadSetwithTable`)

---

## Library Development

The following sections are for contributors working on the `ui5-upload-controls` library itself.

### Build

```bash
cd ui5-upload-controls
npm install
npm run build
```

Output is placed in `dist/`. The consuming Fiori Elements app always loads from `dist/`, so rebuild after any library change.

### Run tests

```bash
# Headless (Karma + Chrome Headless)
npm test

# Open QUnit test suite in browser
npm run testsuite
```

### Start standalone test page

```bash
npm start    # opens SingleFileUpload.html
```

### Rebuild after changes

```bash
# After modifying library source, rebuild before testing in the consuming app
npm run build   # run in ui5-upload-controls/
```

---

## Testing Notes

### Mocking `fetch` in QUnit tests (Sinon v4 + Chrome Headless)

**Do NOT use `stub.onCall(n).resolves(new Response(...))`** for multiple call sequences.
This combination causes the test to hang indefinitely in Chrome Headless (Karma disconnects after 30 s with "Some of your tests did a full page reload!").

**Use `stub.callsFake(fn)` instead**, tracking the call index manually:

```ts
// ❌ Hangs in Chrome Headless
fetchStub.onCall(0).resolves(new Response(null, { status: 200, headers: { "x-csrf-token": "tok" } }));
fetchStub.onCall(1).resolves(new Response(JSON.stringify({...}), { status: 200 }));
fetchStub.resolves(new Response(null, { status: 200 }));

// ✅ Works reliably
fetchStub.callsFake(function() {
    const i = fetchStub.callCount - 1;
    if (i === 0) return Promise.resolve({ ok: true, headers: { get: (n) => n === "x-csrf-token" ? "tok" : null } });
    if (i === 1) return Promise.resolve({ ok: true, json: () => Promise.resolve({ "@odata.id": "..." }) });
    return Promise.resolve({ ok: true });
});
```

> Using plain objects instead of real `Response` instances also avoids potential issues
> with `Response` body streams being consumed across test runs.