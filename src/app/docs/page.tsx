"use client";

import React, { useEffect, useRef } from "react";

/**
 * Interactive API documentation page using Swagger UI.
 *
 * Loads Swagger UI from CDN and points it at our /api/docs OpenAPI spec.
 * No extra npm packages needed — just a <link> and <script>.
 */
export default function ApiDocsPage() {
  const swaggerContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Dynamically load Swagger UI CSS + JS from CDN
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/swagger-ui-dist@5/swagger-ui.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js";
    script.onload = () => {
      const swaggerUI = (window as unknown as { SwaggerUIBundle: (config: Record<string, unknown>) => void }).SwaggerUIBundle;
      if (swaggerUI && swaggerContainerRef.current) {
        swaggerUI({
          url: "/api/docs",
          domNode: swaggerContainerRef.current,
          presets: [
            (window as unknown as { SwaggerUIBundle: { presets: { apis: unknown; SwaggerUIStandalonePreset: unknown } } }).SwaggerUIBundle.presets.apis,
            (window as unknown as { SwaggerUIBundle: { presets: { apis: unknown; SwaggerUIStandalonePreset: unknown } } }).SwaggerUIBundle.presets.SwaggerUIStandalonePreset,
          ],
          layout: "StandaloneLayout",
          docExpansion: "list",
          defaultModelsExpandDepth: -1,
          deepLinking: true,
          tryItOutEnabled: true,
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      document.head.removeChild(link);
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-indigo-900/50 bg-slate-50 dark:bg-black px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-mono font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Agent Studio API
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
              Interactive documentation — try requests directly from the browser
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/api/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 text-xs font-mono font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all"
            >
              Raw JSON Spec ↗
            </a>
            <a
              href="/dashboard"
              className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              ← Dashboard
            </a>
          </div>
        </div>
      </div>

      {/* Swagger UI container */}
      <div ref={swaggerContainerRef} className="swagger-ui-wrapper" />
    </div>
  );
}

export const metadata = {
  title: "API Documentation — Agent Studio",
  description: "Interactive API documentation for the Agent Studio platform",
};
