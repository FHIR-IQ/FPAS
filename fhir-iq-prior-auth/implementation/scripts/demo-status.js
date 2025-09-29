#!/usr/bin/env node

const axios = require('axios');

// Configuration
const BASE_URL = process.env.FHIR_BASE_URL || 'http://localhost:8080/fhir';
const JWT_SECRET = process.env.JWT_SECRET || 'poc-jwt-secret-change-in-production';

// Parse command line arguments
const args = process.argv.slice(2);
const claimId = args.find(arg => arg.startsWith('--claim-id'))?.split('=')[1] ||
               args[args.indexOf('--claim-id') + 1];
const patientId = args.find(arg => arg.startsWith('--patient'))?.split('=')[1] ||
                  args[args.indexOf('--patient') + 1] || 'patient-example-jane-doe';

// Generate mock JWT token
function generateMockJWT() {
  const jwt = require('jsonwebtoken');
  const payload = {
    sub: 'demo-practitioner',
    client_id: 'smart-ehr-client',
    scopes: ['user/*.read', 'user/ClaimResponse.read'],
    practitioner: 'practitioner-dr-smith',
    organization: 'provider-organization-spine-clinic',
    iss: 'http://fhir-iq.com',
    aud: 'http://fhir-iq.com/pas',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000)
  };
  return jwt.sign(payload, JWT_SECRET);
}

async function inquireStatus() {
  try {
    console.log('🔍 FHIR IQ PAS Demo: Check Authorization Status');
    console.log('===============================================');
    console.log();

    const token = generateMockJWT();

    // Build inquiry parameters
    const inquiryParams = {
      resourceType: 'Parameters',
      parameter: []
    };

    if (claimId) {
      inquiryParams.parameter.push({
        name: 'identifier',
        valueIdentifier: {
          system: 'http://fhir-iq.com/identifier/claim',
          value: claimId
        }
      });
      console.log(`🎯 Searching by Claim ID: ${claimId}`);
    } else {
      inquiryParams.parameter.push({
        name: 'patient',
        valueReference: {
          reference: `Patient/${patientId}`
        }
      });
      console.log(`👤 Searching by Patient: ${patientId}`);
    }

    console.log();
    console.log('📤 Sending inquiry to:', `${BASE_URL}/Claim/$inquire`);
    console.log();

    const response = await axios.post(`${BASE_URL}/Claim/$inquire`, inquiryParams, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json'
      }
    });

    console.log('✅ Inquiry successful!');
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log();

    const bundle = response.data;

    if (bundle.total === 0) {
      console.log('🔍 No prior authorization requests found.');
      console.log();
      console.log('💡 This could mean:');
      console.log('   • The claim ID doesn\'t exist');
      console.log('   • The patient has no authorization requests');
      console.log('   • The request is still being processed');
    } else {
      console.log(`📋 Found ${bundle.total} authorization request(s):`);
      console.log('================================================');
      console.log();

      bundle.entry.forEach((entry, index) => {
        const resource = entry.resource;

        if (resource.resourceType === 'ClaimResponse') {
          console.log(`🏥 Authorization #${index + 1}:`);
          console.log(`   📋 ID: ${resource.id}`);
          console.log(`   🎯 Outcome: ${resource.outcome}`);
          console.log(`   ✅ Status: ${resource.status}`);
          console.log(`   📅 Created: ${new Date(resource.created).toLocaleString()}`);

          if (resource.disposition) {
            console.log(`   💬 Disposition: ${resource.disposition}`);
          }

          if (resource.preAuthRef) {
            console.log(`   🔢 Pre-auth Number: ${resource.preAuthRef}`);
          }

          if (resource.request?.reference) {
            const originalClaimId = resource.request.reference.split('/').pop();
            console.log(`   🔗 Original Claim: ${originalClaimId}`);
          }

          // Show adjudication details
          if (resource.item && resource.item[0] && resource.item[0].adjudication) {
            console.log(`   💰 Adjudication Details:`);
            resource.item[0].adjudication.forEach(adj => {
              const category = adj.category?.coding?.[0];
              if (category) {
                console.log(`      • ${category.display || category.code}: ${adj.reason?.text || adj.amount?.value || 'See disposition'}`);
              }
            });
          }

          console.log();
        } else if (resource.resourceType === 'Task') {
          console.log(`⏳ Processing Task #${index + 1}:`);
          console.log(`   📋 ID: ${resource.id}`);
          console.log(`   📊 Status: ${resource.status}`);
          console.log(`   📅 Last Modified: ${new Date(resource.meta?.lastUpdated || resource.authoredOn).toLocaleString()}`);

          if (resource.focus?.reference) {
            console.log(`   🎯 Focus: ${resource.focus.reference}`);
          }

          if (resource.status === 'completed' && resource.output) {
            console.log(`   ✅ Output:`);
            resource.output.forEach(output => {
              if (output.valueReference?.reference) {
                console.log(`      • ${output.type?.text || 'Result'}: ${output.valueReference.reference}`);
              }
            });
          }

          console.log();
        }
      });
    }

    // Generate curl equivalent
    console.log('📝 Equivalent curl command:');
    console.log('============================');
    console.log('curl -X POST \\');
    console.log(`  "${BASE_URL}/Claim/\\$inquire" \\`);
    console.log('  -H "Content-Type: application/fhir+json" \\');
    console.log('  -H "Accept: application/fhir+json" \\');
    console.log(`  -H "Authorization: Bearer ${token.substring(0, 20)}..." \\`);
    console.log(`  -d '${JSON.stringify(inquiryParams)}'`);

    console.log();
    console.log('🎉 Status check completed successfully!');

  } catch (error) {
    console.error('❌ Error checking authorization status:', error.message);

    if (error.response) {
      console.error('📊 Status:', error.response.status);
      console.error('📋 Response:', JSON.stringify(error.response.data, null, 2));

      if (error.response.status === 404) {
        console.error();
        console.error('🔍 No matching authorization found. Try:');
        console.error('   • Check the claim ID is correct');
        console.error('   • Verify the patient ID exists');
        console.error('   • Ensure you have permission to access this data');
      }

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

function showUsage() {
  console.log('📖 Usage:');
  console.log('  npm run demo:status -- --claim-id <claim-id>');
  console.log('  npm run demo:status -- --patient <patient-id>');
  console.log();
  console.log('📋 Examples:');
  console.log('  npm run demo:status -- --claim-id demo-claim-123');
  console.log('  npm run demo:status -- --patient patient-example-jane-doe');
  console.log();
}

// Run the demo
if (require.main === module) {
  if (args.includes('--help') || args.includes('-h')) {
    showUsage();
  } else if (!claimId && !patientId) {
    console.log('⚠️  Please specify either a claim ID or patient ID');
    console.log();
    showUsage();
    process.exit(1);
  } else {
    inquireStatus();
  }
}