#!/usr/bin/env node

/**
 * CRD Hooks Demo Script
 *
 * Demonstrates Coverage Requirements Discovery (CRD) hooks integration
 * with order-select and order-sign events that trigger DTR workflows.
 */

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Sample CRD hook request data
const createOrderSelectRequest = (orderId, patientId, code, display) => ({
  hook: 'order-select',
  hookInstance: `hook-${Date.now()}`,
  fhirServer: 'http://fhir-server.example.com/fhir',
  fhirAuthorization: {
    access_token: 'sample-access-token',
    token_type: 'Bearer',
    expires_in: 3600,
    scope: 'user/*.read user/Claim.write patient/*.read',
    subject: 'Practitioner/practitioner-1'
  },
  context: {
    userId: 'Practitioner/practitioner-1',
    patientId: patientId,
    encounterId: 'Encounter/encounter-1',
    selections: [orderId],
    draftOrders: {
      resourceType: 'Bundle',
      id: 'draft-orders-bundle',
      type: 'collection',
      entry: [
        {
          resource: {
            resourceType: 'ServiceRequest',
            id: orderId,
            status: 'draft',
            intent: 'order',
            priority: 'routine',
            code: {
              coding: [
                {
                  system: 'http://www.ama-assn.org/go/cpt',
                  code: code,
                  display: display
                }
              ]
            },
            subject: {
              reference: `Patient/${patientId}`
            },
            authoredOn: new Date().toISOString(),
            requester: {
              reference: 'Practitioner/practitioner-1'
            }
          }
        }
      ]
    }
  },
  prefetch: {
    patient: {
      resourceType: 'Patient',
      id: patientId,
      name: [
        {
          family: 'Johnson',
          given: ['Sarah']
        }
      ],
      gender: 'female',
      birthDate: '1985-03-15'
    }
  }
});

const createOrderSignRequest = (orderId, patientId, code, display) => ({
  hook: 'order-sign',
  hookInstance: `hook-${Date.now()}`,
  fhirServer: 'http://fhir-server.example.com/fhir',
  fhirAuthorization: {
    access_token: 'sample-access-token',
    token_type: 'Bearer',
    expires_in: 3600,
    scope: 'user/*.read user/Claim.write patient/*.read',
    subject: 'Practitioner/practitioner-1'
  },
  context: {
    userId: 'Practitioner/practitioner-1',
    patientId: patientId,
    encounterId: 'Encounter/encounter-1',
    draftOrders: {
      resourceType: 'Bundle',
      id: 'draft-orders-bundle',
      type: 'collection',
      entry: [
        {
          resource: {
            resourceType: 'ServiceRequest',
            id: orderId,
            status: 'draft',
            intent: 'order',
            priority: 'routine',
            code: {
              coding: [
                {
                  system: 'http://www.ama-assn.org/go/cpt',
                  code: code,
                  display: display
                }
              ]
            },
            subject: {
              reference: `Patient/${patientId}`
            },
            authoredOn: new Date().toISOString(),
            requester: {
              reference: 'Practitioner/practitioner-1'
            }
          }
        }
      ]
    }
  }
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testCDSHooksDiscovery() {
  console.log('\n🔍 Testing CDS Hooks Discovery...');
  try {
    const response = await axios.get(`${BASE_URL}/cds-services`);
    console.log('✅ CDS Hooks Discovery Response:');
    console.log(JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ CDS Hooks Discovery failed:', error.response?.data || error.message);
    return false;
  }
}

async function testOrderSelectHook() {
  console.log('\n📋 Testing Order-Select Hook (MRI requires PA)...');
  try {
    const hookRequest = createOrderSelectRequest(
      'service-request-1',
      'patient-123',
      '72148',  // Lumbar spine MRI - requires PA
      'MRI Lumbar Spine without contrast'
    );

    const response = await axios.post(
      `${BASE_URL}/cds-services/pa-order-select`,
      hookRequest,
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    console.log('✅ Order-Select Hook Response:');
    console.log(JSON.stringify(response.data, null, 2));

    // Check if PA card was generated
    const paCards = response.data.cards?.filter(card =>
      card.summary.includes('Prior Authorization Required')
    );

    if (paCards && paCards.length > 0) {
      console.log(`\n💡 Generated ${paCards.length} PA requirement card(s)`);
      console.log(`🔗 DTR Launch URL: ${paCards[0].links?.[0]?.url}`);
    }

    return true;
  } catch (error) {
    console.error('❌ Order-Select Hook failed:', error.response?.data || error.message);
    return false;
  }
}

async function testOrderSelectNoPA() {
  console.log('\n📋 Testing Order-Select Hook (No PA required)...');
  try {
    const hookRequest = createOrderSelectRequest(
      'service-request-2',
      'patient-123',
      '99213',  // Office visit - no PA required
      'Office visit, established patient'
    );

    const response = await axios.post(
      `${BASE_URL}/cds-services/pa-order-select`,
      hookRequest,
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    console.log('✅ Order-Select Hook Response (No PA):');
    console.log(`Cards generated: ${response.data.cards?.length || 0}`);

    if (response.data.cards?.length === 0) {
      console.log('✅ Correctly identified no PA requirements');
    }

    return true;
  } catch (error) {
    console.error('❌ Order-Select Hook (No PA) failed:', error.response?.data || error.message);
    return false;
  }
}

async function testOrderSignHook() {
  console.log('\n✍️  Testing Order-Sign Hook (DTR completion check)...');
  try {
    const hookRequest = createOrderSignRequest(
      'service-request-3',
      'patient-123',
      '70552',  // Brain MRI - requires PA and DTR
      'MRI Brain with contrast'
    );

    const response = await axios.post(
      `${BASE_URL}/cds-services/pa-order-sign`,
      hookRequest,
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    console.log('✅ Order-Sign Hook Response:');
    console.log(JSON.stringify(response.data, null, 2));

    // Check for DTR requirement cards
    const dtrCards = response.data.cards?.filter(card =>
      card.summary.includes('DTR Completion Required')
    );

    if (dtrCards && dtrCards.length > 0) {
      console.log(`\n🚫 Order blocked - DTR completion required`);
      console.log(`🔗 DTR Launch URL: ${dtrCards[0].links?.[0]?.url}`);
    }

    return true;
  } catch (error) {
    console.error('❌ Order-Sign Hook failed:', error.response?.data || error.message);
    return false;
  }
}

async function testDTRLaunch() {
  console.log('\n🚀 Testing DTR Launch...');
  try {
    const launchUrl = `${BASE_URL}/dtr-launch?` + new URLSearchParams({
      iss: 'http://fhir-server.example.com/fhir',
      launch: 'sample-launch-token',
      patient: 'patient-123',
      order: 'service-request-1',
      code: '72148'
    }).toString();

    const response = await axios.get(launchUrl);

    console.log('✅ DTR Launch successful');
    console.log(`📄 Response length: ${response.data.length} characters`);
    console.log('🎯 DTR interface HTML generated');

    return true;
  } catch (error) {
    console.error('❌ DTR Launch failed:', error.response?.data || error.message);
    return false;
  }
}

async function testSmartConfiguration() {
  console.log('\n⚙️  Testing SMART Configuration...');
  try {
    const response = await axios.get(`${BASE_URL}/.well-known/smart-configuration`);

    console.log('✅ SMART Configuration Response:');
    console.log(JSON.stringify(response.data, null, 2));

    return true;
  } catch (error) {
    console.error('❌ SMART Configuration failed:', error.response?.data || error.message);
    return false;
  }
}

async function testDTRSubmission() {
  console.log('\n📝 Testing DTR Submission...');
  try {
    const submission = {
      patient: 'patient-123',
      order: 'service-request-1',
      code: '72148',
      responses: {
        failedConservativeTx: 'true',
        neuroDeficit: 'true',
        clinicalNotes: 'Patient has chronic lower back pain with radiating symptoms. Conservative therapy including physical therapy and NSAIDs attempted for 8 weeks without improvement.',
        treatmentDuration: 'medium'
      },
      launchContext: {
        iss: 'http://fhir-server.example.com/fhir',
        launch: 'sample-launch-token'
      }
    };

    const response = await axios.post(
      `${BASE_URL}/dtr-submit`,
      submission,
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    console.log('✅ DTR Submission Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log(`📋 QuestionnaireResponse ID: ${response.data.id}`);

    return true;
  } catch (error) {
    console.error('❌ DTR Submission failed:', error.response?.data || error.message);
    return false;
  }
}

async function runCRDDemo() {
  console.log('🎯 Starting CRD (Coverage Requirements Discovery) Demo');
  console.log('======================================================');

  const tests = [
    testCDSHooksDiscovery,
    testOrderSelectHook,
    testOrderSelectNoPA,
    testOrderSignHook,
    testDTRLaunch,
    testSmartConfiguration,
    testDTRSubmission
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`❌ Test failed with exception:`, error.message);
      failed++;
    }

    await sleep(1000); // Brief pause between tests
  }

  console.log('\n📊 Test Results Summary');
  console.log('=======================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n🎉 All CRD hook tests passed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   • EHRs can now integrate with these CDS Hooks endpoints');
    console.log('   • Order-select hooks provide PA awareness during order entry');
    console.log('   • Order-sign hooks enforce DTR completion before submission');
    console.log('   • DTR SMART app launches provide seamless data collection');
  } else {
    console.log('\n🔧 Some tests failed. Check the server logs and configuration.');
  }

  return failed === 0;
}

// Export for use as module or run directly
if (require.main === module) {
  runCRDDemo()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Demo script failed:', error);
      process.exit(1);
    });
}

module.exports = { runCRDDemo };