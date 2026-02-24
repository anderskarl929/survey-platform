"use client";

import SurveysManager from "@/components/admin/SurveysManager";

export default function SurveysPage() {
  return <SurveysManager apiBase="/api" resultsBasePath="/admin/surveys" />;
}
