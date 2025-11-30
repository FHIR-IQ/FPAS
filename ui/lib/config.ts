/**
 * Centralized configuration from environment variables
 */
export const config = {
  fhirBase: process.env.NEXT_PUBLIC_FHIR_BASE || 'https://fpas-phi.vercel.app/fhir',
  cdsBase: process.env.NEXT_PUBLIC_CDS_BASE || 'https://fpas-phi.vercel.app',
  defaultPatient: process.env.NEXT_PUBLIC_DEFAULT_PATIENT || 'pat-001',
} as const;

export default config;