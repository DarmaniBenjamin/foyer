import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import DataProvider from "./DataProvider";
import "./index.css";
import App from "./App.jsx";
import { startKeyboardLift } from "./keyboardLift";

startKeyboardLift();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <DataProvider>
        <App />
      </DataProvider>
    </BrowserRouter>
  </StrictMode>,
);