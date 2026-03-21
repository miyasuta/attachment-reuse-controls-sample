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

## Requirements

- Node.js 20+
- `@sap/cds` 8 or 9
- SAPUI5 1.124+ (for `sap.m.plugins.UploadSetwithTable`)