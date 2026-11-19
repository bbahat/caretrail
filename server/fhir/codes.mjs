// Code systems used by CareTrail's FHIR R4 mapping.
// Standard terminologies (SNOMED CT, LOINC, HL7) are used where a well-known
// code exists. Program-specific concepts (IFHAS packages, Well-Child results)
// use CareTrail code systems under the project's own URL.

export const BASE = "https://bbahat.github.io/caretrail/fhir";
export const EXT = `${BASE}/StructureDefinition/`;
export const CS = {
  package: `${BASE}/CodeSystem/ifhas-package`,
  result: `${BASE}/CodeSystem/screening-result`,
  consent: `${BASE}/CodeSystem/consent-category`,
  wcvVisit: `${BASE}/CodeSystem/wcv-visit`,
  wcvResult: `${BASE}/CodeSystem/wcv-result`,
  slotService: `${BASE}/CodeSystem/slot-service`,
  suggestion: `${BASE}/CodeSystem/ai-suggestion`,
};
export const SNOMED = "http://snomed.info/sct";
export const LOINC = "http://loinc.org";
export const V3_ROLE = "http://terminology.hl7.org/CodeSystem/v3-RoleCode";
export const V3_MARITAL = "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus";
export const OBS_CAT = "http://terminology.hl7.org/CodeSystem/observation-category";
export const CONSENT_SCOPE = "http://terminology.hl7.org/CodeSystem/consentscope";

export const CONDITIONS = {
  diabetes: ["44054006", "Diabetes mellitus type 2"],
  hypertension: ["38341003", "Hypertensive disorder"],
  high_cholesterol: ["55822004", "Hyperlipidemia"],
  obesity: ["414916001", "Obesity"],
  copd: ["13645005", "Chronic obstructive lung disease"],
  type1_diabetes: ["46635009", "Diabetes mellitus type 1"],
};
export const FAMILY = {
  diabetes: ["73211009", "Diabetes mellitus"],
  hypertension: ["38341003", "Hypertensive disorder"],
  heart_disease: ["56265001", "Heart disease"],
  cancer: ["363346000", "Malignant neoplastic disease"],
  osteoporosis: ["64859006", "Osteoporosis"],
};
export const TOBACCO = {
  never: ["266919005", "Never smoked tobacco"],
  former: ["8517006", "Ex-smoker"],
  current: ["77176002", "Smoker"],
};
// Longitudinal labs and vitals (used by the trend engine, not by the rules).
export const LABS = {
  hba1c: { loinc: "4548-4", display: "Hemoglobin A1c/Hemoglobin.total in Blood", unit: "%" },
  sbp: { loinc: "8480-6", display: "Systolic blood pressure", unit: "mm[Hg]" },
  ldl: { loinc: "2089-1", display: "Cholesterol in LDL [Mass/volume] in Serum or Plasma", unit: "mg/dL" },
  bmi: { loinc: "39156-5", display: "Body mass index (BMI) [Ratio]", unit: "kg/m2" },
};
// Wearable telemetry (weekly means).
export const WEAR = {
  steps: { loinc: "41950-7", display: "Number of steps in 24 hour Measured", unit: "/d", key: "steps_per_day" },
  sleep: { loinc: "93832-4", display: "Sleep duration", unit: "h", key: "sleep_hours" },
  rhr: { loinc: "40443-4", display: "Heart rate --resting", unit: "/min", key: "resting_hr" },
};
export const GENOMIC = { loinc: "69548-6", display: "Genetic variant assessment" };
export const HEMOGLOBIN = { loinc: "718-7", display: "Hemoglobin [Mass/volume] in Blood" };
// Standard procedure codes recognised when importing from other FHIR servers.
export const SNOMED_PROCEDURES = {
  "73761001": { pkg: "colorectal", modality: "colonoscopy" }, // Colonoscopy
  "71651007": { pkg: "mammography", modality: null }, // Mammography
};

export const coding = (system, code, display) => ({ system, code, ...(display ? { display } : {}) });
export const cc = (system, code, display, text) => ({ coding: [coding(system, code, display)], ...(text ? { text } : {}) });
export const findCode = (concept, system) => concept?.coding?.find((c) => c.system === system)?.code;
export const keyBySnomed = (table, code) => Object.keys(table).find((k) => table[k][0] === code);
