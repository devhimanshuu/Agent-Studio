import { redirect } from "next/navigation";

// The version comparison UI lives at /dashboard/compare — keep the legacy
// /versions route working for any existing bookmarks/links.
export default function VersionsPage() {
  redirect("/dashboard/compare");
}
