'use strict';

/**
 * AgentManager
 *
 * Registry and run-state tracker for all agents.
 * Execution is delegated to the worker process (agents/_runtime/worker.js);
 * this class only tracks registration and lifecycle state.
 *
 * Usage (from main.js):
 *   const agentManager = new AgentManager();
 *   agentManager.register({ id, title, description, manifest, dir });
 *   agentManager.markRunning(agentId, runId);
 *   agentManager.markFinished(agentId, 'done' | 'error' | 'cancelled', errorMsg?);
 *   agentManager.markCancelling(agentId);
 */
class AgentManager {
  constructor() {
    this._registry = new Map(); // agentId → descriptor { id, title, description, manifest, dir }
    this._runs = new Map(); // agentId → run-state
  }

  // ── Registration ────────────────────────────────────────────────────────────

  /**
   * @param {{ id: string, title: string, description: string, manifest: object, dir: string }} descriptor
   */
  register(descriptor) {
    this._registry.set(descriptor.id, descriptor);
  }

  unregister(agentId) {
    this._registry.delete(agentId);
    this._runs.delete(agentId);
  }

  clear() {
    this._registry.clear();
    this._runs.clear();
  }

  listAgents() {
    return [...this._registry.values()].map(({ id, title, description, manifest }) => ({
      id,
      // Preserve "name" for renderer compatibility — it's the display label.
      name: title,
      title,
      description,
      manifest,
    }));
  }

  getDescriptor(agentId) {
    return this._registry.get(agentId);
  }

  getManifest(agentId) {
    return this._registry.get(agentId)?.manifest;
  }

  // ── State ────────────────────────────────────────────────────────────────────

  getRunState(agentId) {
    return this._runs.get(agentId);
  }

  markRunning(agentId, runId) {
    this._runs.set(agentId, { status: 'running', startedAt: Date.now(), runId });
  }

  markCancelling(agentId) {
    const r = this._runs.get(agentId);
    if (r) r.status = 'cancelling';
  }

  markFinished(agentId, status, error = null) {
    const r = this._runs.get(agentId) || {};
    this._runs.set(agentId, { ...r, status, finishedAt: Date.now(), error });
  }

  // ── Status ───────────────────────────────────────────────────────────────────

  status(agentId) {
    const run = this._runs.get(agentId);
    if (!run) return { status: 'idle' };
    const { status, startedAt, finishedAt, error } = run;
    return { status, startedAt, finishedAt, error };
  }
}

module.exports = { AgentManager };
