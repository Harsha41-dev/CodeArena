import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import "./styles/globals.css";

// defaults felt fine for a student project; tune later if needed
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000
    }
  }
});

// apply theme before first paint so we don't flash light mode
const darkMode = window.localStorage.getItem("codearena.theme") !== "light";
document.documentElement.classList.toggle("dark", darkMode);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
