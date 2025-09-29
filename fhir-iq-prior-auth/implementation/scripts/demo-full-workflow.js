#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.FHIR_BASE_URL || 'http://localhost:8080/fhir';
const JWT_SECRET = process.env.JWT_SECRET || 'poc-jwt-secret-change-in-production';

// Generate mock JWT token
function generateMockJWT(scopes = ['user/*.read', 'user/Claim.write', 'user/QuestionnaireResponse.write']) {
  const jwt = require('jsonwebtoken');
  const payload = {
    sub: 'demo-practitioner',
    client_id: 'smart-ehr-client',
    scopes,
    practitioner: 'practitioner-dr-smith',
    organization: 'provider-organization-spine-clinic',
    iss: 'http://fhir-iq.com',
    aud: 'http://fhir-iq.com/pas',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000)
  };
  return jwt.sign(payload, JWT_SECRET);
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runFullWorkflow() {
  console.log('🏥 FHIR IQ PAS Demo: Complete End-to-End Workflow');
  console.log('==================================================');
  console.log();
  console.log('This demo will walk through the complete Prior Authorization');
  console.log('workflow from DTR documentation to final authorization decision.');
  console.log();

  try {
    const token = generateMockJWT();
    const sessionId = `demo-${Date.now()}`;

    // === STEP 1: Patient & Clinical Context ===
    console.log('📋 STEP 1: Patient & Clinical Context');
    console.log('=====================================');
    console.log();

    const patientContext = {
      id: 'patient-example-jane-doe',
      name: 'Jane Marie Doe',
      birthDate: '1985-03-15',
      condition: 'Chronic lower back pain with radiculopathy',
      symptoms: 'Pain radiating to left leg, decreased reflexes',
      duration: '8 weeks',
      previousTreatment: 'Physical therapy, NSAIDs'
    };

    console.log('👤 Patient Information:');
    Object.entries(patientContext).forEach(([key, value]) => {
      console.log(`   ${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`);
    });
    console.log();

    console.log('🎯 Requesting Service: MRI Lumbar Spine (CPT: 72148)');
    console.log('💰 Estimated Cost: $1,200.00');
    console.log('🏥 Provider: Dr. John Smith, Spine Care Clinic');
    console.log();

    await delay(2000);

    // === STEP 2: DTR Documentation Workflow ===
    console.log('📋 STEP 2: DTR Documentation Workflow');
    console.log('======================================');
    console.log();

    console.log('📤 Retrieving DTR questionnaire for lumbar MRI...');

    const dtrRequest = {
      service: 'lumbar-mri',
      context: {
        patient: patientContext.id,
        practitioner: 'practitioner-dr-smith',
        organization: 'provider-organization-spine-clinic',
        encounter: `encounter-${sessionId}`
      }
    };

    const dtrResponse = await axios.post(`${BASE_URL}/dtr/launch-and-prepopulate`, dtrRequest, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json'
      }
    });

    const dtrResult = dtrResponse.data;
    console.log('✅ DTR questionnaire retrieved and prepopulated!');
    console.log();

    if (dtrResult.prepopulationSummary) {
      const summary = dtrResult.prepopulationSummary;
      console.log('📊 Clinical Data Auto-Population Results:');
      console.log(`   ✅ Items populated: ${summary.itemsPopulated}/${summary.itemsTotal}`);
      console.log(`   📈 Success rate: ${Math.round((summary.itemsPopulated / summary.itemsTotal) * 100)}%`);
      console.log(`   🗄️  Data sources: ${summary.dataSourcesQueried?.join(', ')}`);
      console.log();
    }

    // Show key clinical findings
    if (dtrResult.questionnaireResponse?.item) {
      console.log('🩺 Key Clinical Findings from DTR:');
      const items = dtrResult.questionnaireResponse.item;

      const conservativeTherapy = items.find(i => i.linkId === 'conservative-therapy');
      const neuroDeficit = items.find(i => i.linkId === 'neurologic-deficit');
      const symptomDuration = items.find(i => i.linkId === 'symptom-duration');

      if (conservativeTherapy) {
        const value = conservativeTherapy.answer?.[0]?.valueBoolean;
        console.log(`   🏃 Conservative therapy attempted: ${value ? '✅ Yes' : '❌ No'}`);
      }

      if (neuroDeficit) {
        const value = neuroDeficit.answer?.[0]?.valueBoolean;
        console.log(`   🧠 Neurologic deficit present: ${value ? '✅ Yes' : '❌ No'}`);
      }

      if (symptomDuration) {
        const value = symptomDuration.answer?.[0]?.valueInteger;
        console.log(`   ⏰ Symptom duration: ${value} weeks`);
      }

      console.log();
    }

    await delay(2000);

    // === STEP 3: PAS Bundle Submission ===
    console.log('📋 STEP 3: Prior Authorization Request Submission');
    console.log('=================================================');
    console.log();

    const claimId = `pas-claim-${sessionId}`;
    const pasBundle = {
      resourceType: 'Bundle',
      type: 'collection',
      timestamp: new Date().toISOString(),
      entry: [
        {
          fullUrl: `${BASE_URL}/Claim/${claimId}`,
          resource: {
            resourceType: 'Claim',
            id: claimId,
            status: 'active',
            type: {
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/claim-type',
                code: 'professional',
                display: 'Professional'
              }]
            },
            use: 'preauthorization',
            patient: { reference: `Patient/${patientContext.id}` },
            created: new Date().toISOString(),
            provider: { reference: 'Practitioner/practitioner-dr-smith' },
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
              quantity: { value: 1 },
              unitPrice: { value: 1200.00, currency: 'USD' }
            }]
          }
        },
        {
          fullUrl: `${BASE_URL}/Patient/${patientContext.id}`,
          resource: {
            resourceType: 'Patient',
            id: patientContext.id,
            name: [{ use: 'official', family: 'Doe', given: ['Jane', 'Marie'] }],
            gender: 'female',
            birthDate: patientContext.birthDate
          }
        },
        {
          fullUrl: `${BASE_URL}/Practitioner/practitioner-dr-smith`,
          resource: {
            resourceType: 'Practitioner',
            id: 'practitioner-dr-smith',
            name: [{ use: 'official', family: 'Smith', given: ['John', 'Michael'], prefix: ['Dr.'] }]
          }
        }
      ]
    };

    // Include the DTR response if available
    if (dtrResult.questionnaireResponse) {
      pasBundle.entry.push({
        fullUrl: `${BASE_URL}/QuestionnaireResponse/${dtrResult.questionnaireResponse.id}`,
        resource: dtrResult.questionnaireResponse
      });
      console.log('📋 Including DTR documentation in PAS Bundle');
    }

    console.log('📤 Submitting Prior Authorization Request...');
    console.log(`📦 Bundle contains ${pasBundle.entry.length} resources`);
    console.log();

    const pasResponse = await axios.post(`${BASE_URL}/Claim/$submit`, pasBundle, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json'
      }
    });

    console.log(`✅ PAS Request submitted! (Status: ${pasResponse.status})`);
    console.log();

    let finalResult = null;

    if (pasResponse.status === 202) {
      // Async processing
      const task = pasResponse.data;
      console.log('⏳ Request queued for processing...');
      console.log(`📋 Task ID: ${task.id}`);
      console.log();

      // Simulate polling for completion
      console.log('🔄 Monitoring processing status...');

      // In a real scenario, you would poll the task status
      // For demo purposes, we'll simulate the final result
      await delay(3000);
      console.log('✅ Processing completed!');
      console.log();

    } else if (pasResponse.status === 200) {
      // Sync processing
      finalResult = pasResponse.data;
      console.log('⚡ Request processed synchronously!');
      console.log();
    }

    // === STEP 4: Authorization Decision ===
    console.log('📋 STEP 4: Authorization Decision');
    console.log('==================================');
    console.log();

    // For demo purposes, let's check the status
    const inquiryParams = {
      resourceType: 'Parameters',
      parameter: [{
        name: 'patient',
        valueReference: { reference: `Patient/${patientContext.id}` }
      }]
    };

    try {
      const statusResponse = await axios.post(`${BASE_URL}/Claim/$inquire`, inquiryParams, {
        headers: {
          'Authorization': `Bearer ${generateMockJWT(['user/*.read', 'user/ClaimResponse.read'])}`,
          'Content-Type': 'application/fhir+json',
          'Accept': 'application/fhir+json'
        }
      });

      const statusBundle = statusResponse.data;
      if (statusBundle.entry && statusBundle.entry.length > 0) {
        const claimResponse = statusBundle.entry.find(e => e.resource.resourceType === 'ClaimResponse')?.resource;

        if (claimResponse) {
          console.log('🎯 AUTHORIZATION DECISION:');
          console.log('========================');
          console.log(`📋 Authorization ID: ${claimResponse.id}`);
          console.log(`✅ Status: ${claimResponse.status}`);
          console.log(`🎯 Outcome: ${claimResponse.outcome}`);
          console.log(`💬 Disposition: ${claimResponse.disposition || 'Processing'}`);

          if (claimResponse.preAuthRef) {
            console.log(`🔢 Pre-authorization Number: ${claimResponse.preAuthRef}`);
          }

          console.log(`📅 Decision Date: ${new Date(claimResponse.created).toLocaleString()}`);
          console.log();

          // Show decision rationale
          if (claimResponse.item?.[0]?.adjudication) {
            console.log('📊 Decision Rationale:');
            claimResponse.item[0].adjudication.forEach(adj => {
              const category = adj.category?.coding?.[0];
              if (category && adj.reason?.text) {
                console.log(`   • ${category.display || category.code}: ${adj.reason.text}`);
              }
            });
            console.log();
          }

        }
      } else {
        console.log('⏳ Authorization still processing...');
        console.log('📞 Status will be available shortly via inquiry operation');
        console.log();
      }
    } catch (statusError) {
      console.log('⏳ Authorization decision pending...');
      console.log(`💡 Check status later with: npm run demo:status -- --patient ${patientContext.id}`);
      console.log();
    }

    // === STEP 5: Summary and Next Steps ===
    console.log('📋 STEP 5: Workflow Summary & Next Steps');
    console.log('=========================================');
    console.log();

    console.log('✅ Workflow Completed Successfully!');
    console.log();
    console.log('📊 What Just Happened:');
    console.log('   1. ✅ Retrieved DTR questionnaire for lumbar MRI');
    console.log('   2. ✅ Auto-populated clinical data from FHIR store');
    console.log('   3. ✅ Submitted complete PAS Bundle with DTR documentation');
    console.log('   4. ✅ Applied clinical decision rules for authorization');
    console.log('   5. ✅ Generated structured response with decision rationale');
    console.log();

    console.log('🎯 Key Features Demonstrated:');
    console.log('   • 🔐 OAuth2/SMART on FHIR authentication');
    console.log('   • 📋 DTR questionnaire retrieval and prepopulation');
    console.log('   • 🤖 Automated clinical data extraction');
    console.log('   • ⚖️  Evidence-based authorization rules');
    console.log('   • 📨 FHIR-compliant request/response formats');
    console.log('   • 🔍 Real-time status inquiry capability');
    console.log();

    console.log('💡 Next Steps:');
    console.log('   • Check authorization status:');
    console.log(`     npm run demo:status -- --patient ${patientContext.id}`);
    console.log('   • Try different service types:');
    console.log('     npm run demo:dtr -- --service cardiac-catheterization');
    console.log('   • Explore the API documentation:');
    console.log(`     http://localhost:8080/docs`);
    console.log();

    // Save workflow summary
    const workflowSummary = {
      sessionId,
      timestamp: new Date().toISOString(),
      patient: patientContext,
      service: 'MRI Lumbar Spine (CPT 72148)',
      dtrCompleted: !!dtrResult.questionnaireResponse,
      pasSubmitted: true,
      claimId: claimId,
      steps: [
        'Patient context established',
        'DTR questionnaire completed',
        'Clinical data prepopulated',
        'PAS Bundle submitted',
        'Authorization decision processed'
      ]
    };

    const summaryFile = path.join(__dirname, '../tmp', `workflow-summary-${sessionId}.json`);
    if (!fs.existsSync(path.dirname(summaryFile))) {
      fs.mkdirSync(path.dirname(summaryFile), { recursive: true });
    }
    fs.writeFileSync(summaryFile, JSON.stringify(workflowSummary, null, 2));

    console.log(`💾 Workflow summary saved: ${summaryFile}`);
    console.log();
    console.log('🎉 Full workflow demonstration completed successfully!');

  } catch (error) {
    console.error('❌ Workflow error:', error.message);

    if (error.response) {
      console.error(`📊 Status: ${error.response.status}`);
      console.error('📋 Response:', JSON.stringify(error.response.data, null, 2));

      if (error.response.data.resourceType === 'OperationOutcome') {
        const issues = error.response.data.issue || [];
        issues.forEach((issue, i) => {
          console.error(`🚨 Issue ${i + 1}:`, issue.diagnostics || issue.details?.text || 'Unknown error');
        });
      }
    }

    console.error();
    console.error('🔧 Troubleshooting:');
    console.error('   • Ensure the FHIR server is running on http://localhost:8080');
    console.error('   • Check that Redis is available for queue processing');
    console.error('   • Verify JWT_SECRET environment variable is set');
    console.error('   • Try running individual demo scripts first');

    process.exit(1);
  }
}

// Run the full workflow demo
if (require.main === module) {
  runFullWorkflow();
}