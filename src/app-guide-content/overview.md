# App Guide: Overview

This guide covers how to *use* the GP Connect Demonstrator — where things are, what controls do, and why the app is shaped the way it is. It does not cover GP Connect or FHIR clinical/domain knowledge — for that, use the separate **Training** section.

## What this app is

The GP Connect Demonstrator is a viewer and inspector for GP Connect Access Record Structured FHIR bundles, plus a tool for building synthetic test patients. It's aimed at testing, demonstration, and learning — it is **not a clinical system**.

## Three ways to get a patient into the app

1. **Upload or paste your own FHIR file** — loads straight into the live Clinical View / Inspector.
2. **Load a sample bundle** — also loads straight into the viewer, no editing.
3. **Build one in the Record Builder** — this instead loads into an *editable draft*. You need an explicit "Load into viewer" click afterwards to actually see it in the clinical tabs.

## Pasting JSON

You can paste a full Bundle, a partial bundle, or even a single FHIR resource — the app will parse whatever's on your clipboard, so you don't need a complete file to try something out.

## Sample data

Two samples are built in:
- **Full GP Connect sample** — covers every clinical domain (medications, problems, consultations, and more).
- **Medications-only sample** — a smaller bundle that loads instantly with no download, useful for a quick look.

## Where to go next

- [Clinical View](#) — the main formatted patient record view.
- [Builder](#) — building a synthetic patient from scratch.
