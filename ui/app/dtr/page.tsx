"use client";

import { useState } from "react";
import { JsonEditor } from "@/components/JsonEditor";
import { ResponseViewer } from "@/components/ResponseViewer";
import { fhirFetch, buildCurlCommand } from "@/lib/fhirClient";
import { Download, Send, Plus, Copy } from "lucide-react";

interface QuestionnaireItem {
  linkId: string;
  text: string;
  type: "boolean" | "string" | "text" | "choice" | "date" | "integer";
  answerOption?: Array<{ valueCoding: { code: string; display: string } }>;
  required?: boolean;
}

export default function DTRPage() {
  const [patientId, setPatientId] = useState("Patient/pat-001");
  const [questionnaireUrl, setQuestionnaireUrl] = useState(
    "http://example.org/fhir/Questionnaire/imaging-lumbar-mri"
  );
  const [questionnaire, setQuestionnaire] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [questionnaireResponse, setQuestionnaireResponse] = useState<any>(null);
  const [pasBundle, setPasBundle] = useState<string>("");
  const [attachedBundle, setAttachedBundle] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [curlCommand, setCurlCommand] = useState<string>("");

  const handleFetchQuestionnaire = async () => {
    setLoading(true);
    try {
      // In a real implementation, this would fetch from the FHIR server
      // For POC, we'll use a mock questionnaire structure
      const mockQuestionnaire = {
        resourceType: "Questionnaire",
        id: "imaging-lumbar-mri",
        url: questionnaireUrl,
        status: "active",
        title: "Lumbar MRI Prior Authorization",
        item: [
          {
            linkId: "1",
            text: "Clinical indication for imaging",
            type: "choice" as const,
            required: true,
            answerOption: [
              { valueCoding: { code: "low-back-pain", display: "Low back pain" } },
              { valueCoding: { code: "radiculopathy", display: "Radiculopathy" } },
              { valueCoding: { code: "trauma", display: "Trauma" } },
              { valueCoding: { code: "infection", display: "Suspected infection" } },
            ],
          },
          {
            linkId: "2",
            text: "Has patient completed conservative therapy for at least 6 weeks?",
            type: "boolean" as const,
            required: true,
          },
          {
            linkId: "3",
            text: "Does patient have neurologic deficits?",
            type: "boolean" as const,
            required: false,
          },
          {
            linkId: "4",
            text: "Red flag symptoms present (e.g., bowel/bladder dysfunction, progressive weakness)?",
            type: "boolean" as const,
            required: false,
          },
          {
            linkId: "5",
            text: "Additional clinical notes",
            type: "text" as const,
            required: false,
          },
        ],
      };

      const curl = buildCurlCommand(`/Questionnaire/${questionnaireUrl.split("/").pop()}`, {
        method: "GET",
        token: "mock-provider-token",
      });
      setCurlCommand(curl);

      setQuestionnaire(mockQuestionnaire);
      setAnswers({});
      setQuestionnaireResponse(null);
    } catch (error: any) {
      alert(`Error fetching questionnaire: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (linkId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [linkId]: value }));
  };

  const handleBuildQuestionnaireResponse = () => {
    if (!questionnaire) {
      alert("Please fetch a questionnaire first");
      return;
    }

    const qrItems = questionnaire.item.map((item: QuestionnaireItem) => {
      const answer = answers[item.linkId];
      if (answer === undefined || answer === null || answer === "") {
        return null;
      }

      let answerArray;
      if (item.type === "boolean") {
        answerArray = [{ valueBoolean: answer }];
      } else if (item.type === "choice") {
        answerArray = [{ valueCoding: answer }];
      } else if (item.type === "integer") {
        answerArray = [{ valueInteger: parseInt(answer) }];
      } else if (item.type === "date") {
        answerArray = [{ valueDate: answer }];
      } else {
        answerArray = [{ valueString: answer }];
      }

      return {
        linkId: item.linkId,
        text: item.text,
        answer: answerArray,
      };
    }).filter(Boolean);

    const qr = {
      resourceType: "QuestionnaireResponse",
      id: "qr-" + Date.now(),
      questionnaire: questionnaireUrl,
      status: "completed",
      subject: { reference: patientId },
      authored: new Date().toISOString(),
      author: { reference: "Practitioner/pract-001" },
      item: qrItems,
    };

    setQuestionnaireResponse(qr);
  };

  const handleAttachToPasBundle = () => {
    if (!questionnaireResponse) {
      alert("Please build a QuestionnaireResponse first");
      return;
    }

    let pasBundleObj;
    try {
      pasBundleObj = JSON.parse(pasBundle);
    } catch (error) {
      alert("Invalid PAS Bundle JSON");
      return;
    }

    // Add QuestionnaireResponse to bundle entries
    if (!pasBundleObj.entry) {
      pasBundleObj.entry = [];
    }

    // Check if QR already exists and replace it
    const qrIndex = pasBundleObj.entry.findIndex(
      (e: any) => e.resource?.resourceType === "QuestionnaireResponse"
    );

    if (qrIndex >= 0) {
      pasBundleObj.entry[qrIndex] = { resource: questionnaireResponse };
    } else {
      pasBundleObj.entry.push({ resource: questionnaireResponse });
    }

    // Update Claim to reference the QuestionnaireResponse
    const claimEntry = pasBundleObj.entry.find(
      (e: any) => e.resource?.resourceType === "Claim"
    );

    if (claimEntry) {
      if (!claimEntry.resource.supportingInfo) {
        claimEntry.resource.supportingInfo = [];
      }

      const qrSupportingInfo = {
        sequence: claimEntry.resource.supportingInfo.length + 1,
        category: {
          coding: [
            {
              system: "http://hl7.org/fhir/us/davinci-pas/CodeSystem/PASSupportingInfoType",
              code: "questionnaire-response",
            },
          ],
        },
        valueReference: {
          reference: `#${questionnaireResponse.id}`,
        },
      };

      claimEntry.resource.supportingInfo.push(qrSupportingInfo);
    }

    setAttachedBundle(pasBundleObj);
  };

  const handleCopyCurl = () => {
    if (curlCommand) {
      navigator.clipboard.writeText(curlCommand);
      alert("✅ cURL command copied to clipboard");
    }
  };

  const renderQuestionnaireItem = (item: QuestionnaireItem) => {
    const value = answers[item.linkId];

    switch (item.type) {
      case "boolean":
        return (
          <div key={item.linkId} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {item.text} {item.required && <span className="text-red-500">*</span>}
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name={item.linkId}
                  checked={value === true}
                  onChange={() => handleAnswerChange(item.linkId, true)}
                  className="mr-2"
                />
                Yes
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name={item.linkId}
                  checked={value === false}
                  onChange={() => handleAnswerChange(item.linkId, false)}
                  className="mr-2"
                />
                No
              </label>
            </div>
          </div>
        );

      case "choice":
        return (
          <div key={item.linkId} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {item.text} {item.required && <span className="text-red-500">*</span>}
            </label>
            <select
              value={value?.code || ""}
              onChange={(e) => {
                const option = item.answerOption?.find(
                  (opt) => opt.valueCoding.code === e.target.value
                );
                handleAnswerChange(item.linkId, option?.valueCoding);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select --</option>
              {item.answerOption?.map((opt) => (
                <option key={opt.valueCoding.code} value={opt.valueCoding.code}>
                  {opt.valueCoding.display}
                </option>
              ))}
            </select>
          </div>
        );

      case "text":
        return (
          <div key={item.linkId} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {item.text} {item.required && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={value || ""}
              onChange={(e) => handleAnswerChange(item.linkId, e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        );

      case "string":
      case "date":
      case "integer":
        return (
          <div key={item.linkId} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {item.text} {item.required && <span className="text-red-500">*</span>}
            </label>
            <input
              type={item.type === "date" ? "date" : item.type === "integer" ? "number" : "text"}
              value={value || ""}
              onChange={(e) => handleAnswerChange(item.linkId, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">DTR Workflow</h1>
        <p className="text-gray-600 mt-2">
          Fetch questionnaires, fill out responses, and attach to PAS bundles for documentation requirements.
        </p>
      </div>

      {/* Step 1: Fetch Questionnaire */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Step 1: Fetch Questionnaire</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Patient ID</label>
            <input
              type="text"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Questionnaire URL</label>
            <input
              type="text"
              value={questionnaireUrl}
              onChange={(e) => setQuestionnaireUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleFetchQuestionnaire}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {loading ? "Fetching..." : "Fetch Questionnaire"}
          </button>
          {curlCommand && (
            <button
              onClick={handleCopyCurl}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy cURL
            </button>
          )}
        </div>
      </div>

      {/* Step 2: Fill Questionnaire */}
      {questionnaire && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Step 2: Complete Questionnaire</h2>
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{questionnaire.title}</h3>
            {questionnaire.item.map((item: QuestionnaireItem) => renderQuestionnaireItem(item))}
          </div>
          <button
            onClick={handleBuildQuestionnaireResponse}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Send className="w-4 h-4" />
            Build QuestionnaireResponse
          </button>
        </div>
      )}

      {/* Step 3: View QuestionnaireResponse */}
      {questionnaireResponse && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Step 3: QuestionnaireResponse</h2>
          <ResponseViewer response={questionnaireResponse} />
        </div>
      )}

      {/* Step 4: Attach to PAS Bundle */}
      {questionnaireResponse && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Step 4: Attach to PAS Bundle</h2>
          <p className="text-sm text-gray-600 mb-4">
            Paste a PAS Bundle JSON below, then click &quot;Attach&quot; to add the QuestionnaireResponse.
          </p>
          <JsonEditor
            value={pasBundle}
            onChange={(val) => setPasBundle(val || "")}
            height="300px"
          />
          <button
            onClick={handleAttachToPasBundle}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors mt-4"
          >
            <Plus className="w-4 h-4" />
            Attach to Bundle
          </button>
        </div>
      )}

      {/* Step 5: View Attached Bundle */}
      {attachedBundle && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Step 5: Complete Bundle with DTR</h2>
          <p className="text-sm text-green-600 mb-4">
            ✅ QuestionnaireResponse has been attached to the PAS Bundle. You can now submit this bundle via the PAS Tester.
          </p>
          <ResponseViewer response={attachedBundle} />
        </div>
      )}
    </div>
  );
}