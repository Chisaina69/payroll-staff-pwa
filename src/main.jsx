import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./auth/AuthContext";
import { flushPendingWrites } from "./lib/services";


window.addEventListener("online", () => {
  flushPendingWrites().catch((err) => console.error("Sync failed:", err));
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
