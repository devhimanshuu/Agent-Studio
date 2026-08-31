import React from "react";
import { auth } from "@clerk/nextjs/server";
import { ensureUserExists } from "@/lib/user";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (userId) {
    await ensureUserExists(userId);
  }
  return <>{children}</>;
}
