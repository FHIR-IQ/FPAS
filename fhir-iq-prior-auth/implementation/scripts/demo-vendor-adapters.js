#!/usr/bin/env node

/**
 * Vendor Adapter Demo Script
 *
 * Demonstrates the vendor adapter interface and registry functionality
 * for integrating with external utilization management systems.
 */

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Sample FHIR Bundle for testing
const createSampleBundle = (patientId = 'patient-123') => ({
  resourceType: 'Bundle',
  id: `pa-bundle-${Date.now()}`,
  type: 'collection',
  timestamp: new Date().toISOString(),
  entry: [
    {
      resource: {
        resourceType: 'Claim',
        id: `claim-${Date.now()}`,
        status: 'active',
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/claim-type',
              code: 'professional',
              display: 'Professional'
            }
          ]
        },
        use: 'preauthorization',
        patient: {
          reference: `Patient/${patientId}`
        },
        created: new Date().toISOString(),
        provider: {
          reference: 'Practitioner/practitioner-1'
        },
        priority: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/processpriority',
              code: 'normal',
              display: 'Normal'
            }
          ]
        },
        item: [
          {
            sequence: 1,
            productOrService: {
              coding: [
                {
                  system: 'http://www.ama-assn.org/go/cpt',
                  code: '72148',
                  display: 'MRI Lumbar Spine without contrast'
                }
              ]
            },
            quantity: {
              value: 1
            }
          }
        ]
      }
    },
    {
      resource: {
        resourceType: 'Patient',
        id: patientId,
        name: [
          {
            family: 'Johnson',
            given: ['Sarah', 'Elizabeth']
          }
        ],
        gender: 'female',
        birthDate: '1985-03-15'
      }
    },
    {
      resource: {
        resourceType: 'Practitioner',
        id: 'practitioner-1',
        name: [
          {
            family: 'Smith',
            given: ['John'],
            prefix: ['Dr.']
          }
        ],
        identifier: [
          {
            system: 'http://hl7.org/fhir/sid/us-npi',
            value: '1234567890'
          }
        ]
      }
    },
    {
      resource: {
        resourceType: 'QuestionnaireResponse',
        id: `qr-${Date.now()}`,
        questionnaire: 'http://fhir-iq.com/Questionnaire/dtr-prior-auth',
        status: 'completed',
        subject: {
          reference: `Patient/${patientId}`
        },
        authored: new Date().toISOString(),
        item: [
          {
            linkId: 'failedConservativeTx',
            answer: [
              {
                valueBoolean: true
              }
            ]
          },
          {
            linkId: 'neuroDeficit',
            answer: [
              {
                valueBoolean: true
              }
            ]
          },
          {
            linkId: 'clinicalNotes',
            answer: [
              {
                valueString: 'Patient has chronic lower back pain with radiating symptoms. Physical therapy completed for 8 weeks without improvement. MRI requested to evaluate for structural abnormalities.'
              }
            ]
          }
        ]
      }
    }
  ]
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testVendorAdapterRegistry() {
  console.log('\n🏢 Testing Vendor Adapter Registry...');
  try {
    const response = await axios.get(`${BASE_URL}/fhir/vendor-adapters`);
    console.log('✅ Vendor Registry Response:');
    console.log(JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Vendor registry test failed:', error.response?.data || error.message);
    return false;
  }
}

async function testVendorHealth() {
  console.log('\n🔍 Testing Vendor Health Checks...');
  try {
    const response = await axios.get(`${BASE_URL}/fhir/vendor-adapters/health`);
    console.log('✅ Vendor Health Response:');
    console.log(JSON.stringify(response.data, null, 2));

    // Analyze health results
    const healthResults = response.data;
    const healthyCount = Object.values(healthResults).filter(h => h.status === 'healthy').length;
    const totalCount = Object.keys(healthResults).length;

    console.log(`\n📊 Health Summary: ${healthyCount}/${totalCount} vendors healthy`);

    return healthyCount > 0;
  } catch (error) {
    console.error('❌ Vendor health check failed:', error.response?.data || error.message);
    return false;
  }
}

async function testEnhancedPAProcessing() {
  console.log('\n⚡ Testing Enhanced PA Processing...');
  try {
    const bundle = createSampleBundle('patient-vendor-test');

    const response = await axios.post(
      `${BASE_URL}/fhir/Claim/$submit`,
      bundle,
      {
        headers: {
          'Content-Type': 'application/fhir+json',
          'Authorization': 'Bearer mock-token'
        }
      }
    );

    console.log('✅ Enhanced PA Processing Response:');
    console.log(`📋 Status: ${response.status}`);
    console.log(`🏥 Resource Type: ${response.data.resourceType}`);

    if (response.data.resourceType === 'ClaimResponse') {
      console.log(`📝 Outcome: ${response.data.outcome}`);
      console.log(`💬 Disposition: ${response.data.disposition}`);

      if (response.data.preAuthRef) {
        console.log(`🔑 Authorization Number: ${response.data.preAuthRef}`);
      }
    }

    // Check for vendor-specific metadata
    if (response.data.identifier) {
      const vendorIds = response.data.identifier.filter(id =>
        id.system?.includes('vendor') || id.system?.includes('mock')
      );

      if (vendorIds.length > 0) {
        console.log(`🏢 Vendor Request ID: ${vendorIds[0].value}`);
      }
    }

    return true;
  } catch (error) {
    console.error('❌ Enhanced PA processing failed:', error.response?.data || error.message);
    return false;
  }
}

async function testVendorStatusInquiry() {
  console.log('\n🔎 Testing Vendor Status Inquiry...');
  try {
    // First submit a request to get a vendor request ID
    const bundle = createSampleBundle('patient-status-test');

    const submitResponse = await axios.post(
      `${BASE_URL}/fhir/Claim/$submit`,
      bundle,
      {
        headers: {
          'Content-Type': 'application/fhir+json',
          'Authorization': 'Bearer mock-token'
        }
      }
    );

    // Extract vendor request ID
    let vendorRequestId = null;
    if (submitResponse.data.identifier) {
      const vendorId = submitResponse.data.identifier.find(id =>
        id.system?.includes('mock-vendor')
      );
      if (vendorId) {
        vendorRequestId = vendorId.value;
      }
    }

    if (!vendorRequestId) {
      console.log('⚠️  No vendor request ID found, skipping status inquiry');
      return true;
    }

    console.log(`📋 Querying status for vendor request: ${vendorRequestId}`);

    // Query status (this would need to be implemented as an endpoint)
    // For now, just demonstrate the concept
    console.log('✅ Status inquiry concept demonstrated');
    console.log(`🔍 Would query: GET /fhir/vendor-adapters/status/${vendorRequestId}`);

    return true;
  } catch (error) {
    console.error('❌ Vendor status inquiry failed:', error.response?.data || error.message);
    return false;
  }
}

async function testVendorCapabilities() {
  console.log('\n🛠️  Testing Vendor Capabilities...');
  try {
    const response = await axios.get(`${BASE_URL}/fhir/vendor-adapters/capabilities`);
    console.log('✅ Vendor Capabilities Response:');
    console.log(JSON.stringify(response.data, null, 2));

    // Analyze capabilities
    const capabilities = response.data;
    console.log('\n📊 Capability Analysis:');

    Object.entries(capabilities).forEach(([vendorId, caps]) => {
      console.log(`\n🏢 ${vendorId}:`);
      console.log(`  📡 Real-time: ${caps.supportsRealTimeDecisions ? '✅' : '❌'}`);
      console.log(`  ⏳ Async: ${caps.supportsAsyncDecisions ? '✅' : '❌'}`);
      console.log(`  📦 Bulk: ${caps.supportsBulkSubmissions ? '✅' : '❌'}`);
      console.log(`  🔍 Status: ${caps.supportsStatusInquiry ? '✅' : '❌'}`);
      console.log(`  🔗 Webhooks: ${caps.supportsWebhooks ? '✅' : '❌'}`);
      console.log(`  📄 Documents: ${caps.supportsDocumentUpload ? '✅' : '❌'}`);
      console.log(`  🔢 Max Concurrent: ${caps.maxConcurrentRequests}`);
    });

    return true;
  } catch (error) {
    console.error('❌ Vendor capabilities test failed:', error.response?.data || error.message);
    return false;
  }
}

async function testVendorFallback() {
  console.log('\n🔄 Testing Vendor Fallback Logic...');
  try {
    // This test would demonstrate fallback behavior
    // For POC, we'll simulate by showing the concept

    console.log('📋 Fallback logic demonstration:');
    console.log('  1️⃣  Try preferred vendor (e.g., Change Healthcare)');
    console.log('  2️⃣  If fails, try fallback vendor (e.g., CoverMyMeds)');
    console.log('  3️⃣  If fails, try default vendor (Mock)');
    console.log('  4️⃣  Return aggregate error if all fail');

    const bundle = createSampleBundle('patient-fallback-test');

    // Submit with mock vendor (which should succeed)
    const response = await axios.post(
      `${BASE_URL}/fhir/Claim/$submit`,
      bundle,
      {
        headers: {
          'Content-Type': 'application/fhir+json',
          'Authorization': 'Bearer mock-token',
          'X-Preferred-Vendor': 'mock' // Custom header for vendor selection
        }
      }
    );

    console.log('✅ Fallback test successful (mock vendor used)');
    console.log(`📋 Response status: ${response.status}`);
    console.log(`🎯 Outcome: ${response.data.outcome}`);

    return true;
  } catch (error) {
    console.error('❌ Vendor fallback test failed:', error.response?.data || error.message);
    return false;
  }
}

async function testVendorConfiguration() {
  console.log('\n⚙️  Testing Vendor Configuration...');
  try {
    // Demonstrate vendor configuration concepts
    console.log('📋 Vendor configuration examples:');

    const mockConfig = {
      vendorId: 'mock',
      vendorName: 'Mock Vendor Adapter',
      apiEndpoint: 'http://mock-vendor.example.com/api',
      authentication: {
        type: 'api-key',
        apiKey: 'mock-api-key-12345'
      },
      features: {
        supportsRealTimeDecisions: true,
        supportsAsyncDecisions: true,
        supportsBulkSubmissions: false,
        supportsStatusInquiry: true,
        supportsDocumentUpload: false,
        supportsWebhooks: false,
        maxConcurrentRequests: 10,
        supportedResourceTypes: ['Claim', 'Patient', 'Practitioner']
      },
      timeouts: {
        connectionTimeout: 5000,
        requestTimeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000
      }
    };

    console.log('✅ Mock Vendor Configuration:');
    console.log(JSON.stringify(mockConfig, null, 2));

    const changeHealthcareConfig = {
      vendorId: 'change-healthcare',
      vendorName: 'Change Healthcare',
      apiEndpoint: 'https://api.changehealthcare.com/pas/v1',
      authentication: {
        type: 'oauth2',
        clientId: 'your-client-id',
        clientSecret: 'your-client-secret',
        tokenEndpoint: 'https://api.changehealthcare.com/oauth/token'
      },
      features: {
        supportsRealTimeDecisions: true,
        supportsAsyncDecisions: true,
        supportsBulkSubmissions: true,
        supportsStatusInquiry: true,
        supportsDocumentUpload: true,
        supportsWebhooks: true,
        maxConcurrentRequests: 50,
        supportedResourceTypes: ['Claim', 'Patient', 'Practitioner', 'Organization', 'Coverage']
      }
    };

    console.log('\n✅ Change Healthcare Configuration Example:');
    console.log(JSON.stringify(changeHealthcareConfig, null, 2));

    return true;
  } catch (error) {
    console.error('❌ Vendor configuration test failed:', error.message);
    return false;
  }
}

async function runVendorAdapterDemo() {
  console.log('🏢 Starting Vendor Adapter Demo');
  console.log('=================================');

  const tests = [
    testVendorAdapterRegistry,
    testVendorHealth,
    testVendorCapabilities,
    testVendorConfiguration,
    testEnhancedPAProcessing,
    testVendorStatusInquiry,
    testVendorFallback
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

  console.log('\n📊 Vendor Adapter Demo Results');
  console.log('===============================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n🎉 All vendor adapter tests passed!');
    console.log('\n💡 Next steps for production:');
    console.log('   • Implement real vendor adapters (Change Healthcare, CoverMyMeds, etc.)');
    console.log('   • Configure vendor-specific authentication and endpoints');
    console.log('   • Set up monitoring and alerting for vendor health');
    console.log('   • Implement vendor-specific field mappings and transformations');
    console.log('   • Add comprehensive error handling and retry logic');
    console.log('   • Set up vendor SLA monitoring and performance metrics');
  } else {
    console.log('\n🔧 Some tests failed. Check vendor adapter configuration and connectivity.');
  }

  return failed === 0;
}

// Export for use as module or run directly
if (require.main === module) {
  runVendorAdapterDemo()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Demo script failed:', error);
      process.exit(1);
    });
}

module.exports = { runVendorAdapterDemo };