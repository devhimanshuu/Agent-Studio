import React from "react";
import { AgentStudioPreloader } from "@/components/feedback/AgentStudioPreloader";

export default function RootLoading() {
  return (
    <AgentStudioPreloader
      fullscreen={true}
      className="min-h-screen"
      title="AGENT STUDIO"
      subtitle="SYSTEM SUSPENSE // HYDRATING NODES"
      allowSkip={false}
    />
  );
}
