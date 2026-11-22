# Extra GP Connect terminology

STU3 CodeSystems and ValueSets used by GP Connect records that the validator's
main packages (`uk.gpc.struct#1.5.0`, `careconnect.stu3.03.00.00#3.1.0`) don't
contain, for example `GPConnect-ParticipantType-1` (Encounter participants).
They aren't on the NHS England Terminology Server either.

Copied unchanged from `gpc.stu3.fhir-assets#1.3.1` (NHS Digital, Simplifier).
That package can't be loaded whole, because its `NHSD.Assets.STU3` dependency
breaks the current validator. To refresh, copy every CodeSystem and ValueSet
from a newer release whose `url` isn't already in the two main packages.
