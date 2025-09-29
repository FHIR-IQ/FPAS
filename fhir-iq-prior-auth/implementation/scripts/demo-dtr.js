#!/usr/bin/env node

const axios = require('axios');

// Configuration
const BASE_URL = process.env.FHIR_BASE_URL || 'http://localhost:8080/fhir';
const JWT_SECRET = process.env.JWT_SECRET || 'poc-jwt-secret-change-in-production';

// Parse command line arguments
const args = process.argv.slice(2);
const serviceType = args.find(arg => arg.startsWith('--service'))?.split('=')[1] ||
                   args[args.indexOf('--service') + 1] || 'lumbar-mri';
const patientId = args.find(arg => arg.startsWith('--patient'))?.split('=')[1] ||
                  args[args.indexOf('--patient') + 1] || 'patient-example-jane-doe';

// Generate mock JWT token
function generateMockJWT() {
  const jwt = require('jsonwebtoken');
  const payload = {
    sub: 'demo-practitioner',
    client_id: 'smart-ehr-client',
    scopes: ['user/*.read', 'user/Questionnaire.read'],
    practitioner: 'practitioner-dr-smith',
    organization: 'provider-organization-spine-clinic',
    iss: 'http://fhir-iq.com',
    aud: 'http://fhir-iq.com/pas',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000)
  };
  return jwt.sign(payload, JWT_SECRET);
}

async function demonstrateDTR() {
  try {
    console.log('📋 FHIR IQ PAS Demo: DTR Documentation Workflow');
    console.log('=================================================');
    console.log();

    const token = generateMockJWT();

    console.log('Step 1: Retrieve DTR Questionnaire');
    console.log('-----------------------------------');
    console.log(`🎯 Service Type: ${serviceType}`);
    console.log(`👤 Patient: ${patientId}`);
    console.log();

    // Step 1: Get questionnaire for service
    console.log('📤 Fetching questionnaire...');
    const questionnaireResponse = await axios.get(`${BASE_URL}/dtr/questionnaire`, {
      params: { service: serviceType },
      headers: {
        'Accept': 'application/fhir+json'
      }
    });

    const questionnaire = questionnaireResponse.data;
    console.log(`✅ Retrieved questionnaire: ${questionnaire.id}`);
    console.log(`📋 Title: ${questionnaire.title}`);
    console.log(`📝 Description: ${questionnaire.description || 'N/A'}`);
    console.log(`🔗 URL: ${questionnaire.url || 'N/A'}`);
    console.log();

    if (questionnaire.item) {
      console.log(`📊 Questionnaire items (${questionnaire.item.length}):`);
      questionnaire.item.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.text} (${item.linkId})`);
        if (item.type) {
          console.log(`      Type: ${item.type}${item.required ? ' (required)' : ''}`);
        }
        if (item.answerOption) {
          console.log(`      Options: ${item.answerOption.map(o => o.valueString || o.valueCoding?.display).join(', ')}`);
        }
      });
      console.log();
    }

    // Step 2: Launch and prepopulate workflow
    console.log('Step 2: Launch DTR and Prepopulate with Patient Data');
    console.log('----------------------------------------------------');

    const prepopulateRequest = {
      service: serviceType,
      context: {
        patient: patientId,
        practitioner: 'practitioner-dr-smith',
        organization: 'provider-organization-spine-clinic',
        encounter: 'encounter-spine-visit-001'
      }
    };

    console.log('📤 Launching DTR workflow with prepopulation...');
    console.log(`🏥 Context: ${JSON.stringify(prepopulateRequest.context, null, 2)}`);
    console.log();

    const prepopulateResponse = await axios.post(`${BASE_URL}/dtr/launch-and-prepopulate`, prepopulateRequest, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json'
      }
    });

    const dtrResult = prepopulateResponse.data;
    console.log('✅ DTR workflow completed successfully!');
    console.log();

    // Display prepopulation summary
    if (dtrResult.prepopulationSummary) {
      const summary = dtrResult.prepopulationSummary;
      console.log('📊 Prepopulation Summary:');
      console.log(`   ✅ Items populated: ${summary.itemsPopulated}/${summary.itemsTotal}`);
      console.log(`   📈 Success rate: ${Math.round((summary.itemsPopulated / summary.itemsTotal) * 100)}%`);
      console.log(`   🗄️  Data sources queried: ${summary.dataSourcesQueried?.join(', ') || 'N/A'}`);
      console.log(`   🎯 Population success: ${summary.populationSuccess ? 'Yes' : 'No'}`);
      console.log();
    }

    // Display prepopulated questionnaire response
    if (dtrResult.questionnaireResponse) {
      const qr = dtrResult.questionnaireResponse;
      console.log('📋 Prepopulated QuestionnaireResponse:');
      console.log(`   📋 ID: ${qr.id}`);
      console.log(`   📊 Status: ${qr.status}`);
      console.log(`   👤 Subject: ${qr.subject?.reference || 'N/A'}`);
      console.log(`   📅 Authored: ${new Date(qr.authored).toLocaleString()}`);
      console.log();

      if (qr.item && qr.item.length > 0) {
        console.log('📝 Prepopulated Answers:');
        qr.item.forEach((item, index) => {
          const questionText = questionnaire.item?.find(qi => qi.linkId === item.linkId)?.text || item.linkId;
          const answer = item.answer?.[0];
          let answerText = 'No answer';

          if (answer) {
            if (answer.valueBoolean !== undefined) {
              answerText = answer.valueBoolean ? '✅ Yes' : '❌ No';
            } else if (answer.valueString) {
              answerText = `"${answer.valueString}"`;
            } else if (answer.valueInteger !== undefined) {
              answerText = answer.valueInteger.toString();
            } else if (answer.valueCoding) {
              answerText = answer.valueCoding.display || answer.valueCoding.code;
            } else {
              answerText = JSON.stringify(answer);
            }
          }

          console.log(`   ${index + 1}. ${questionText}`);
          console.log(`      → ${answerText}`);
        });
        console.log();
      }
    }

    // Step 3: Show how this integrates with PAS
    console.log('Step 3: Integration with PAS Workflow');
    console.log('-------------------------------------');
    console.log('💡 This DTR data can now be used in several ways:');
    console.log();
    console.log('🔄 Automatic Integration:');
    console.log('   • When submitting a PAS Bundle without DTR data,');
    console.log('   • The system automatically runs this DTR workflow');
    console.log('   • And includes the prepopulated QuestionnaireResponse');
    console.log();
    console.log('📤 Manual Integration:');
    console.log('   • Copy the QuestionnaireResponse from above');
    console.log('   • Include it in your PAS Bundle entry array');
    console.log('   • Submit via Claim/$submit operation');
    console.log();
    console.log('🎯 Clinical Decision Impact:');
    console.log('   • DTR responses feed into authorization rules');
    console.log('   • Conservative therapy + neurologic deficit = approval');
    console.log('   • Missing clinical info = denial or pending review');

    // Generate curl examples
    console.log();
    console.log('📝 Equivalent curl commands:');
    console.log('=============================');
    console.log();
    console.log('# Step 1: Get questionnaire');
    console.log('curl -X GET \\');
    console.log(`  "${BASE_URL}/dtr/questionnaire?service=${serviceType}" \\`);
    console.log('  -H "Accept: application/fhir+json"');
    console.log();
    console.log('# Step 2: Launch and prepopulate');
    console.log('curl -X POST \\');
    console.log(`  "${BASE_URL}/dtr/launch-and-prepopulate" \\`);
    console.log('  -H "Content-Type: application/fhir+json" \\');
    console.log('  -H "Accept: application/fhir+json" \\');
    console.log(`  -H "Authorization: Bearer ${token.substring(0, 20)}..." \\`);
    console.log(`  -d '${JSON.stringify(prepopulateRequest)}'`);

    console.log();
    console.log('🎉 DTR demonstration completed successfully!');

  } catch (error) {
    console.error('❌ Error in DTR workflow:', error.message);

    if (error.response) {
      console.error('📊 Status:', error.response.status);
      console.error('📋 Response:', JSON.stringify(error.response.data, null, 2));

      if (error.response.status === 404) {
        console.error();
        console.error('🔍 Service not found. Available service types:');
        console.error('   • lumbar-mri (default)');
        console.error('   • cardiac-catheterization');
        console.error('   • knee-arthroscopy');
        console.error('   • ct-head');
        console.error();
        console.error('💡 Try: npm run demo:dtr -- --service lumbar-mri');
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
  console.log('  npm run demo:dtr [-- --service <service-type>] [-- --patient <patient-id>]');
  console.log();
  console.log('📋 Options:');
  console.log('  --service    Service type (default: lumbar-mri)');
  console.log('  --patient    Patient ID (default: patient-example-jane-doe)');
  console.log();
  console.log('🎯 Available service types:');
  console.log('  • lumbar-mri');
  console.log('  • cardiac-catheterization');
  console.log('  • knee-arthroscopy');
  console.log('  • ct-head');
  console.log();
  console.log('📋 Examples:');
  console.log('  npm run demo:dtr');
  console.log('  npm run demo:dtr -- --service cardiac-catheterization');
  console.log('  npm run demo:dtr -- --patient patient-123 --service lumbar-mri');
  console.log();
}

// Run the demo
if (require.main === module) {
  if (args.includes('--help') || args.includes('-h')) {
    showUsage();
  } else {
    demonstrateDTR();
  }
}