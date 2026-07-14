import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { PublicSurveyPage } from "./components/PublicSurveyPage";
import "./styles.css";

const surveyMatch = window.location.pathname.match(/^\/survey\/([^/]+)$/);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {surveyMatch ? <PublicSurveyPage slug={decodeURIComponent(surveyMatch[1])} /> : <App />}
  </React.StrictMode>,
);
