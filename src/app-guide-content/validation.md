# App Guide: Validation

Validation checks whether the loaded bundle is structurally valid FHIR and surfaces any dangling references.

## Reading the results

The summary bar at the top shows either a green "Bundle is structurally valid" message or a red "Validation errors found" message, alongside count pills for errors and warnings. Resource-type counts (e.g. `Patient: 1`, `MedicationRequest: 12`) are shown as small chips, and the full issue list below gives each problem's severity, message, and FHIR path. The Validation tab itself carries a live error/warning count badge even before you open it.

## Cleaning dangling references

If the bundle contains dangling references (links to resources that don't actually exist in the file), a "Remove dangling refs" button appears. Clicking it does two things at once: it downloads a corrected `-cleaned.json` copy of your file with those references stripped, **and** immediately reloads that cleaned version back into this tab so you can confirm the fix worked.
