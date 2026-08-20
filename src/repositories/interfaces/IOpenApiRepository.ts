import {
  CreateOpenApiIntegrationInput,
  OpenApiEndpointDefinition,
  OpenApiIntegrationDTO,
  OpenApiStatus,
  UpdateOpenApiIntegrationInput,
} from "@/types/openapi";

export interface IOpenApiRepository {
  findById(id: string): Promise<OpenApiIntegrationDTO | null>;
  findByIdForUser(id: string, userId: string): Promise<OpenApiIntegrationDTO | null>;
  findByUserId(userId: string): Promise<OpenApiIntegrationDTO[]>;
  create(input: CreateOpenApiIntegrationInput): Promise<OpenApiIntegrationDTO>;
  update(id: string, userId: string, input: UpdateOpenApiIntegrationInput): Promise<OpenApiIntegrationDTO>;
  delete(id: string, userId: string): Promise<void>;
  updateStatus(id: string, status: OpenApiStatus, lastError?: string | null): Promise<OpenApiIntegrationDTO>;
  updateEndpoints(id: string, userId: string, endpoints: OpenApiEndpointDefinition[]): Promise<OpenApiIntegrationDTO>;
}
