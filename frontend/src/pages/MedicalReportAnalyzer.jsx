import React from "react";

const MedicalReportAnalyzer = () => {
  return (
    <div style={{ padding: "2rem" }}>
      <h2>Medical Report Analyzer (AI)</h2>
      <p>Upload your medical report to get an AI-powered analysis.</p>
      {/* TODO: Add file upload and AI analysis logic here */}
      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
      <button style={{ marginLeft: "1rem" }}>Analyze</button>
      <div style={{ marginTop: "2rem" }}>
        {/* Analysis results will appear here */}
      </div>
    </div>
  );
};

export default MedicalReportAnalyzer;
