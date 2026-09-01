import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, handleApiError } from "@/lib/api/handlers";
import { NotFoundError } from "@/services/RBACService";
import { apiServices } from "@/lib/api/services";

const { executionService, executionRepo, rbacService } = apiServices();

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
    if (!execution) throw new NotFoundError("Execution not found");

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
      throw new NotFoundError("Execution not found");
    }

    throw new NotFoundError("Execution not found");
  } catch (error) {
    return handleApiError(error);
  }
}
