/*
 * CQL Library: Imaging Lumbar MRI
 * Version: 0.0.1
 * Purpose: DTR prepopulation logic for lumbar MRI prior authorization
 *
 * POC Implementation Notes:
 * - Value sets and logic to be refined for production
 * - Currently uses simplified logic for demonstration
 * - Wire to SMART app/DTR service for prepopulation
 */

library ImagingLumbarMRI version '0.0.1'

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1' called FHIRHelpers

context Patient

// Value set placeholders for POC - to be defined with proper terminology
valueset "Physical Therapy Codes": 'http://fhir-iq.com/ValueSet/physical-therapy-codes'
valueset "Neurologic Deficit Observations": 'http://fhir-iq.com/ValueSet/neuro-deficit-observations'
valueset "Lumbar Spine Imaging Codes": 'http://fhir-iq.com/ValueSet/lumbar-spine-imaging-codes'
valueset "Red Flag Symptom Codes": 'http://fhir-iq.com/ValueSet/red-flag-symptoms'

// Helper function to convert FHIR date/dateTime to CQL
define function ToDate(value FHIR.date): value.value
define function ToDateTime(value FHIR.dateTime): value.value
define function ToInterval(period FHIR.Period):
  if period is null then null
  else Interval[ToDateTime(period."start"), ToDateTime(period."end")]

/*
 * Check if patient has failed conservative therapy for >= 6 weeks
 * Looks for completed physical therapy or other conservative treatments
 */
define ExistsFailedConservativeTx:
  exists(
    [ServiceRequest] R
    where R.code in "Physical Therapy Codes"
      and R.status = 'completed'
      and (
        case
          when R.occurrence is FHIR.Period then
            end of ToInterval(R.occurrence as FHIR.Period) <= Today() - 6 weeks
          when R.occurrence is FHIR.dateTime then
            ToDateTime(R.occurrence as FHIR.dateTime) <= Today() - 6 weeks
          else false
        end
      )
  )

/*
 * Check if patient has documented objective neurologic deficit
 * Looks for relevant observations indicating neurological deficits
 */
define HasNeuroDeficit:
  exists(
    [Observation] O
    where O.code in "Neurologic Deficit Observations"
      and O.status in {'final', 'amended', 'corrected'}
      and (
        (O.value as FHIR.boolean).value = true
        or
        (O.value as FHIR.CodeableConcept) is not null
      )
      and O.effective.latest() within 90 days of Today()
  )

/*
 * Check if patient has had prior lumbar spine imaging
 * Looks for previous imaging studies that might inform current request
 */
define HasPriorLumbarImaging:
  exists(
    [DiagnosticReport] D
    where D.code in "Lumbar Spine Imaging Codes"
      and D.status in {'final', 'amended', 'corrected'}
      and ToDateTime(D.effective as FHIR.dateTime) within 2 years of Today()
  )
  or
  exists(
    [ImagingStudy] I
    where I.procedureCode in "Lumbar Spine Imaging Codes"
      and ToDateTime(I.started) within 2 years of Today()
  )

/*
 * Check for red flag symptoms that would expedite authorization
 * Looks for urgent symptoms requiring immediate imaging
 */
define HasRedFlagSymptoms:
  exists(
    [Observation] O
    where O.code in "Red Flag Symptom Codes"
      and O.status in {'final', 'amended', 'corrected'}
      and (
        (O.value as FHIR.boolean).value = true
        or
        (O.value as FHIR.CodeableConcept) is not null
      )
      and O.effective.latest() within 30 days of Today()
  )
  or
  exists(
    [Condition] C
    where C.code in "Red Flag Symptom Codes"
      and C.clinicalStatus ~ 'active'
      and C.onset.latest() within 30 days of Today()
  )

/*
 * Helper function to get the most recent occurrence date from a choice type
 */
define function "GetLatestDate"(choice Choice<FHIR.dateTime, FHIR.Period>):
  case
    when choice is FHIR.dateTime then ToDateTime(choice as FHIR.dateTime)
    when choice is FHIR.Period then end of ToInterval(choice as FHIR.Period)
    else null
  end