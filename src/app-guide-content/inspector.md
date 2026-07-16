# App Guide: Inspector

Inspector is a split-pane view: the same clinical domains as Clinical View on the left, but selecting a row highlights its exact underlying FHIR source on the right instead of showing a formatted view.

## Selecting a record

Pick a domain from the left-hand sidebar, then click a row — the matching resource (or resources) will scroll into view and highlight on the right.

## Jumping to source

Clicking "View FHIR" anywhere else in the app — Clinical View, the patient banner, a reference chip — brings you here, already scrolled to and highlighting the correct resource, so you rarely need to search for it manually.

## Section navigation

Some clinical items are made up of more than one FHIR resource (for example, a MedicationStatement plus its associated MedicationRequests). When that's the case, a small section navigator (with a step counter) lets you move between each one in turn.

## Text selection

Selecting any text in the source pane pops up a small floating toolbar with quick Copy and Search actions for exactly what you selected.

## Search

The search bar in the source pane finds text anywhere in the currently displayed resources, with Enter/Shift+Enter moving between matches and a live match counter.

## Indent guides

The "Indent" toggle turns on vertical guide lines in the JSON, which helps when tracking deeply nested structure in long resources.

## Inspector vs Raw Source

Inspector is scoped to one clinical item at a time and is cross-linked from the rest of the app. If you want to see the entire loaded file with no filtering, use Raw Source instead.
