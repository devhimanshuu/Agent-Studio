import {
  CreateOpenApiIntegrationInput,
  OpenApiEndpointDefinition,
  OpenApiIntegrationDTO,
  OpenApiParsedSpecDTO,
  OpenApiToolTestResult,
  UpdateOpenApiIntegrationInput,
} from "@/types/openapi";
import { Tool, ToolRegistry } from "@/modules/tools";
import { CreateOpenApiToolOptions } from "@/modules/openapi/dynamicTool";

export interface IOpenApiService {
  parseSpec(input: { specUrl?: string; rawSpec?: string | Record<string, unknown> }): Promise<OpenApiParsedSpecDTO>;
  listIntegrations(userId: string, limit?: number): Promise<OpenApiIntegrationDTO[]>;
  getIntegration(id: string, userId: string): Promise<OpenApiIntegrationDTO | null>;
  createIntegration(input: CreateOpenApiIntegrationInput): Promise<OpenApiIntegrationDTO>;
  updateIntegration(id: string, userId: string, input: UpdateOpenApiIntegrationInput): Promise<OpenApiIntegrationDTO>;
  deleteIntegration(id: string, userId: string): Promise<void>;
  testEndpoint(
    id: string,
    userId: string,
    operationId: string,
    inputArgs: Record<string, unknown>
  ): Promise<OpenApiToolTestResult>;
  testRawEndpoint(
    endpoint: OpenApiEndpointDefinition,
    options: CreateOpenApiToolOptions,
    inputArgs: Record<string, unknown>
  ): Promise<OpenApiToolTestResult>;
  getExecutableTools(userId: string): Promise<Tool[]>;
  syncRegistryTools(userId: string, registry: ToolRegistry): Promise<number>;
}
