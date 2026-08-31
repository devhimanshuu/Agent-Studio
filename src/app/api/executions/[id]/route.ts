import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, serverError, notFound, forbidden } from "@/lib/api/handlers";
import { apiServices } from "@/lib/api/services";
import { RBACService } from "@/services/RBACService";

const { executionService, executionRepo } = apiServices();
const rbacService = new RBACService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    
    // 1. Check if user is the direct owner
    const userExecution = await executionService.getExecutionForUser(id, userId);
    if (userExecution) {
      return NextResponse.json({ success: true, data: userExecution });
    }

    // 2. If not direct owner, check if it's an organization execution
    const execution = await executionRepo.findById(id);
    if (!execution) return notFound("Execution not found");

    if (execution.organizationId) {
      const hasAccess = await rbacService.canAccessResource(
        userId,
        execution.organizationId,
        "execution",
        id,
        "read"
      );
      if (hasAccess) {
        return NextResponse.json({ success: true, data: execution });
      }
      return forbidden();
    }

    return notFound("Execution not found");
  } catch (error) {
    return serverError(error);
  }
}
