import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import DataProvider from "./DataProvider";
// The fonts come with Foyer itself (not from Google), so the guest page
// loads nothing from other sites before the guest is on: a phone that
// isn't let out yet can't reach them, and Android warns about them
import "@fontsource/geist/400.css";
import "@fontsource/geist/500.css";
import "@fontsource/geist/600.css";
import "@fontsource/geist/700.css";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
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