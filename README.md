# attachment-reuse-controls

A sample project demonstrating reusable UI5 file upload controls integrated with a CAP backend using the `@cap-js/attachments` plugin.

## Overview

This project provides a reusable UI5 control library (`ui5-upload-controls`) with file upload components for use across multiple projects. The library is backend-agnostic: it connects to any CAP service using `@cap-js/attachments` by receiving the OData service URL and navigation path via properties, and resolves the full navigation path from the binding context automatically.

The Fiori Elements frontend demonstrates how to embed the controls as a Custom Section in an Object Page.

## Repository Structure

```
attachment-reuse-controls/
├── backend/              # CAP Node.js app — OData V4 service with @cap-js/attachments
├── frontend/
│   └── fiorielements/    # Fiori Elements List Report / Object Page (OData V4)
│                         # Embeds ui5-upload-controls via Custom Section
├── ui5-upload-controls/  # UI5 control library (git submodule)
└── .gitmodules
```

> `ui5-upload-controls/` is a **git submodule** pointing to a separate repository.
> See [Setup](#setup) for initialization instructions.

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

Both controls are compatible with Fiori Elements Custom Sections and Freestyle XML Views/Fragments.

## Requirements

- Node.js 20+
- `@sap/cds` 8 or 9
- SAPUI5 1.124+ (for `sap.m.plugins.UploadSetwithTable`)

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
cd backend && npm install
cd ../ui5-upload-controls && npm install
cd ../frontend/fiorielements && npm install
```

### 3. Run

```bash
# Terminal 1 — backend
cd backend
cds watch

# Terminal 2 — frontend
cd frontend/fiorielements
npm start
```

## Updating the submodule

To pull the latest commits from the `ui5-upload-controls` repository:

```bash
git submodule update --remote ui5-upload-controls
git add ui5-upload-controls
git commit -m "chore: update ui5-upload-controls submodule"
```

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
