#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.FHIR_BASE_URL || 'http://localhost:8080/fhir';
const JWT_SECRET = process.env.JWT_SECRET || 'poc-jwt-secret-change-in-production';

// Sample PAS Bundle
const pasBundle = {
  resourceType: 'Bundle',
  type: 'collection',
  timestamp: new Date().toISOString(),
  entry: [
    {
      fullUrl: `${BASE_URL}/Claim/demo-claim-${Date.now()}`,
      resource: {
        resourceType: 'Claim',
        id: `demo-claim-${Date.now()}`,
        status: 'active',
        type: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/claim-type',
            code: 'professional',
            display: 'Professional'
          }]
        },
        use: 'preauthorization',
        patient: {
          reference: 'Patient/patient-example-jane-doe'
        },
        created: new Date().toISOString(),
        provider: {
          reference: 'Practitioner/practitioner-dr-smith'
        },
        priority: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/processpriority',
            code: 'normal'
          }]
        },
        item: [{
          sequence: 1,
          productOrService: {
            coding: [{
              system: 'http://www.ama-assn.org/go/cpt',
              code: '72148',
              display: 'MRI lumbar spine without contrast'
            }]
          },
          locationCodeableConcept: {
            coding: [{
              system: 'https://www.cms.gov/Medicare/Coding/place-of-service-codes/Place_of_Service_Code_Set',
              code: '22',
              display: 'Outpatient Hospital'
            }]
          },
          quantity: { value: 1 },
          unitPrice: { value: 1200.00, currency: 'USD' }
        }]
      }
    },
    {
      fullUrl: `${BASE_URL}/Patient/patient-example-jane-doe`,
      resource: {
        resourceType: 'Patient',
        id: 'patient-example-jane-doe',
        name: [{
          use: 'official',
          family: 'Doe',
          given: ['Jane', 'Marie']
        }],
        gender: 'female',
        birthDate: '1985-03-15',
        address: [{
          use: 'home',
          line: ['123 Main Street'],
          city: 'Anytown',
          state: 'CA',
          postalCode: '90210',
          country: 'US'
        }]
      }
    },
    {
      fullUrl: `${BASE_URL}/Practitioner/practitioner-dr-smith`,
      resource: {
        resourceType: 'Practitioner',
        id: 'practitioner-dr-smith',
        name: [{
          use: 'official',
          family: 'Smith',
          given: ['John', 'Michael'],
          prefix: ['Dr.']
        }]
      }
    },
    {
      fullUrl: `${BASE_URL}/QuestionnaireResponse/demo-dtr-response-${Date.now()}`,
      resource: {
        resourceType: 'QuestionnaireResponse',
        id: `demo-dtr-response-${Date.now()}`,
        status: 'completed',
        questionnaire: 'http://fhir-iq.com/Questionnaire/imaging-lumbar-mri',
        subject: {
          reference: 'Patient/patient-example-jane-doe'
        },
        authored: new Date().toISOString(),
        item: [
          {
            linkId: 'conservative-therapy',
            text: 'Has the patient tried conservative therapy?',
            answer: [{ valueBoolean: true }]
          },
          {
            linkId: 'neurologic-deficit',
            text: 'Are there signs of neurologic deficit?',
            answer: [{ valueBoolean: true }]
          },
          {
            linkId: 'symptom-duration',
            text: 'How long has the patient had symptoms (weeks)?',
            answer: [{ valueInteger: 8 }]
          }
        ]
      }
    }
  ]
};

// Generate mock JWT token
function generateMockJWT() {
  const jwt = require('jsonwebtoken');
  const payload = {
    sub: 'demo-practitioner',
    client_id: 'smart-ehr-client',
    scopes: ['user/*.read', 'user/Claim.write'],
    practitioner: 'practitioner-dr-smith',
    organization: 'provider-organization-spine-clinic',
    iss: 'http://fhir-iq.com',
    aud: 'http://fhir-iq.com/pas',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000)
  };
  return jwt.sign(payload, JWT_SECRET);
}

async function submitPASRequest() {
  try {
    console.log('🏥 FHIR IQ PAS Demo: Submit Prior Authorization Request');
    console.log('==================================================');
    console.log();

    const token = generateMockJWT();

    console.log('📋 Submitting PAS Bundle with:');
    console.log(`   • Patient: ${pasBundle.entry[1].resource.name[0].given[0]} ${pasBundle.entry[1].resource.name[0].family}`);
    console.log(`   • Provider: ${pasBundle.entry[2].resource.name[0].prefix[0]} ${pasBundle.entry[2].resource.name[0].given[0]} ${pasBundle.entry[2].resource.name[0].family}`);
    console.log(`   • Service: ${pasBundle.entry[0].resource.item[0].productOrService.coding[0].display}`);
    console.log(`   • Clinical Info: Conservative therapy attempted, neurologic deficit present`);
    console.log();

    // Save the request for reference
    const requestFile = path.join(__dirname, '../tmp', `pas-request-${Date.now()}.json`);
    if (!fs.existsSync(path.dirname(requestFile))) {
      fs.mkdirSync(path.dirname(requestFile), { recursive: true });
    }
    fs.writeFileSync(requestFile, JSON.stringify(pasBundle, null, 2));

    console.log('📤 Sending request to:', `${BASE_URL}/Claim/$submit`);
    console.log('🔗 Request saved to:', requestFile);
    console.log();

    const response = await axios.post(`${BASE_URL}/Claim/$submit`, pasBundle, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json'
      }
    });

    console.log('✅ Request submitted successfully!');
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log();

    if (response.status === 202) {
      // Async processing
      console.log('⏳ Processing asynchronously...');
      console.log(`📋 Task ID: ${response.data.id}`);
      console.log(`🔍 Task Status: ${response.data.status}`);
      console.log(`🎯 Focus: ${response.data.focus?.reference || 'N/A'}`);

      if (response.data.focus?.reference) {
        const claimId = response.data.focus.reference.split('/').pop();
        console.log();
        console.log('💡 To check status, run:');
        console.log(`   npm run demo:status -- --claim-id ${claimId}`);
      }
    } else if (response.status === 200) {
      // Sync processing
      console.log('⚡ Processed synchronously!');
      const bundle = response.data;

      if (bundle.entry) {
        const claimResponse = bundle.entry.find(e => e.resource.resourceType === 'ClaimResponse');
        if (claimResponse) {
          const cr = claimResponse.resource;
          console.log(`📋 Authorization ID: ${cr.id}`);
          console.log(`🎯 Outcome: ${cr.outcome}`);
          console.log(`✅ Disposition: ${cr.disposition || 'Not specified'}`);

          if (cr.preAuthRef) {
            console.log(`🔢 Pre-auth Number: ${cr.preAuthRef}`);
          }

          if (cr.item && cr.item[0] && cr.item[0].adjudication) {
            const decision = cr.item[0].adjudication.find(a => a.category.coding[0].code === 'benefit');
            if (decision) {
              console.log(`💰 Coverage Decision: ${decision.reason?.text || 'See disposition'}`);
            }
          }
        }
      }
    }

    // Save response for reference
    const responseFile = path.join(__dirname, '../tmp', `pas-response-${Date.now()}.json`);
    fs.writeFileSync(responseFile, JSON.stringify(response.data, null, 2));
    console.log();
    console.log('💾 Response saved to:', responseFile);

    console.log();
    console.log('🎉 Demo completed successfully!');

    // Generate curl equivalent
    console.log();
    console.log('📝 Equivalent curl command:');
    console.log('==========================');
    console.log('curl -X POST \\');
    console.log(`  "${BASE_URL}/Claim/\\$submit" \\`);
    console.log('  -H "Content-Type: application/fhir+json" \\');
    console.log('  -H "Accept: application/fhir+json" \\');
    console.log(`  -H "Authorization: Bearer ${token.substring(0, 20)}..." \\`);
    console.log(`  -d '@${requestFile}'`);

  } catch (error) {
    console.error('❌ Error submitting PAS request:', error.message);

    if (error.response) {
      console.error('📊 Status:', error.response.status);
      console.error('📋 Response:', JSON.stringify(error.response.data, null, 2));

      if (error.response.data.resourceType === 'OperationOutcome') {
        const issues = error.response.data.issue || [];
        issues.forEach((issue, i) => {
          console.error(`🚨 Issue ${i + 1}:`, issue.diagnostics || issue.details?.text || 'Unknown error');
        });
      }
    }

    process.exit(1);
  }
}

// Run the demo
if (require.main === module) {
  submitPASRequest();
}