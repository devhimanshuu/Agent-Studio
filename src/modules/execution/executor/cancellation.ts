/**
 * Tracks in-flight executions so a cancellation request can abort the graph
 * run. Each execution gets an AbortController; nodes and the engine's timeout
 * wrapper listen to the signal.
 */
export class CancellationManager {
  private controllers = new Map<string, AbortController>();

  create(executionId: string): AbortSignal {
    const controller = new AbortController();
    this.controllers.set(executionId, controller);
    return controller.signal;
  }

  /** Returns false when no in-flight execution matched. */
  cancel(executionId: string): boolean {
    const controller = this.controllers.get(executionId);
    if (!controller) return false;
    controller.abort();
    return true;
  }

  dispose(executionId: string): void {
    this.controllers.delete(executionId);
  }
}
