import { IOpenApiRepository } from "@/repositories/interfaces/IOpenApiRepository";
import { IOpenApiService } from "./interfaces/IOpenApiService";
import {
  CreateOpenApiIntegrationInput,
  OpenApiEndpointDefinition,
  OpenApiIntegrationDTO,
  OpenApiParsedSpecDTO,
  OpenApiToolTestResult,
  UpdateOpenApiIntegrationInput,
} from "@/types/openapi";
import { parseOpenApiSpec } from "@/modules/openapi/parser";
import {
  createOpenApiTool,
  CreateOpenApiToolOptions,
  executeOpenApiRequest,
} from "@/modules/openapi/dynamicTool";
import { Tool, ToolRegistry } from "@/modules/tools";
import { logger } from "@/lib/logger";

export class OpenApiService implements IOpenApiService {
  constructor(private openApiRepo: IOpenApiRepository) {}

  async parseSpec(input: {
    specUrl?: string;
    rawSpec?: string | Record<string, unknown>;
  }): Promise<OpenApiParsedSpecDTO> {
    let specContent = input.rawSpec;

    if (input.specUrl && !specContent) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      try {
        const res = await fetch(input.specUrl, {
          headers: { Accept: "application/json, application/yaml, text/yaml, */*" },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
          throw new Error(`Failed to fetch OpenAPI spec from ${input.specUrl} (HTTP ${res.status})`);
        }

        specContent = await res.text();
      } catch (error) {
        clearTimeout(timeout);
        const msg = error instanceof Error ? error.message : "Network error fetching spec";
        throw new Error(`Failed to load OpenAPI spec from URL: ${msg}`);
      }
    }

    if (!specContent) {
      throw new Error("Must provide either a specUrl or rawSpec to parse");
    }

    return parseOpenApiSpec(specContent);
  }

  async listIntegrations(userId: string): Promise<OpenApiIntegrationDTO[]> {
    return this.openApiRepo.findByUserId(userId);
  }

  async getIntegration(id: string, userId: string): Promise<OpenApiIntegrationDTO | null> {
    return this.openApiRepo.findByIdForUser(id, userId);
  }

  async createIntegration(input: CreateOpenApiIntegrationInput): Promise<OpenApiIntegrationDTO> {
    const integration = await this.openApiRepo.create(input);
    logger.info(
      { integrationId: integration.id, userId: input.userId, endpointsCount: input.endpoints.length },
      "OpenAPI integration created"
    );
    return integration;
  }

  async updateIntegration(
    id: string,
    userId: string,
    input: UpdateOpenApiIntegrationInput
  ): Promise<OpenApiIntegrationDTO> {
    return this.openApiRepo.update(id, userId, input);
  }

  async deleteIntegration(id: string, userId: string): Promise<void> {
    await this.openApiRepo.delete(id, userId);
    logger.info({ integrationId: id, userId }, "OpenAPI integration deleted");
  }

  async testEndpoint(
    id: string,
    userId: string,
    operationId: string,
    inputArgs: Record<string, unknown>
  ): Promise<OpenApiToolTestResult> {
    const integration = await this.openApiRepo.findByIdForUser(id, userId);
    if (!integration) {
      throw new Error("OpenAPI integration not found or access denied");
    }

    const endpoint = integration.endpoints.find(
      (ep) => ep.operationId === operationId || ep.id === operationId
    );
    if (!endpoint) {
      throw new Error(`Endpoint with operationId "${operationId}" not found in integration`);
    }

    const options: CreateOpenApiToolOptions = {
      integrationId: integration.id,
      integrationName: integration.name,
      baseUrl: integration.baseUrl,
      authType: integration.authType,
      authConfig: integration.authConfig,
    };

    return executeOpenApiRequest(endpoint, options, inputArgs);
  }

  async testRawEndpoint(
    endpoint: OpenApiEndpointDefinition,
    options: CreateOpenApiToolOptions,
    inputArgs: Record<string, unknown>
  ): Promise<OpenApiToolTestResult> {
    return executeOpenApiRequest(endpoint, options, inputArgs);
  }

  async getExecutableTools(userId: string): Promise<Tool[]> {
    const integrations = await this.openApiRepo.findByUserId(userId);
    const tools: Tool[] = [];

    for (const integration of integrations) {
      if (integration.status === "ERROR") continue;

      const options: CreateOpenApiToolOptions = {
        integrationId: integration.id,
        integrationName: integration.name,
        baseUrl: integration.baseUrl,
        authType: integration.authType,
        authConfig: integration.authConfig,
      };

      for (const endpoint of integration.endpoints) {
        if (endpoint.enabled !== false) {
          tools.push(createOpenApiTool(endpoint, options));
        }
      }
    }

    return tools;
  }

  async syncRegistryTools(userId: string, registry: ToolRegistry): Promise<number> {
    const tools = await this.getExecutableTools(userId);
    registry.syncTools(tools);
    return tools.length;
  }
}
