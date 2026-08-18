import React from "react";
import { AgentStudioPreloader } from "@/components/feedback/AgentStudioPreloader";

export default function RootLoading() {
  return (
    <AgentStudioPreloader
      fullscreen={false}
      className="min-h-[70vh] rounded-xl border border-[hsl(var(--preloader-border))] my-auto"
      title="AGENT STUDIO"
      subtitle="SYSTEM SUSPENSE // HYDRATING NODES"
      allowSkip={false}
    />
  );
}

