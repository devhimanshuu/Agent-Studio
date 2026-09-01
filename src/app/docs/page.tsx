import type { Metadata } from "next";
import ApiDocsClient from "./ApiDocsClient";

export const metadata: Metadata = {
  title: "API Documentation — Agent Studio",
  description: "Interactive API documentation for the Agent Studio platform",
};

export default function ApiDocsPage() {
  return <ApiDocsClient />;
}

