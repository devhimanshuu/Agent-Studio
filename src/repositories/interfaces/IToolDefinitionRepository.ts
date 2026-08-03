export interface IToolDefinitionRepository {
  /** Number of tool definitions in the system registry. */
  count(): Promise<number>;
}
