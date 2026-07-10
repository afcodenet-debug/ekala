/**
 * COMMAND BUS v7 — CQRS command execution engine
 * 
 * Flux obligatoire pour chaque commande :
 * 1. Commande créée avec validation
 * 2. Aggregate verrouillé (locking)
 * 3. Events bufferisés en mémoire (transaction)
 * 4. Commit atomique dans SQLite
 * 5. Rollback si erreur
 * 6. Projection mise à jour async
 * 7. Réponse retournée
 * 
 * INTERDICTION : aucun accès direct DB dans les handlers
 * SEULEMENT : events → replay → state
 */

import { acquireLock, releaseLock } from './aggregate-lock.service';
import { eventStore, EventStoreEntry, EventType } from './event-store.service';

// ── Types ──────────────────────────────────────────────────────────────────────

export type CommandStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'ROLLED_BACK';

export interface Command {
  type: string;
  id: string;
  trace_id: string;
  aggregate_id: string;
  aggregate_type: 'user' | 'session' | 'tenant' | 'system';
  payload: Record<string, unknown>;
  timestamp: number;
}

export interface CommandResult {
  command_id: string;
  trace_id: string;
  status: CommandStatus;
  events_appended: number;
  error?: string;
  data?: Record<string, unknown>;
}

export interface CommandHandler {
  commandType: string;
  handle(command: Command): Promise<CommandResult>;
}

// ── Command Bus ────────────────────────────────────────────────────────────────

class CommandBusImpl {
  private handlers = new Map<string, CommandHandler>();

  /**
   * Enregistre un handler pour un type de commande.
   */
  register(handler: CommandHandler): void {
    if (this.handlers.has(handler.commandType)) {
      console.warn(`[CommandBus] Handler already registered for: ${handler.commandType}`);
    }
    this.handlers.set(handler.commandType, handler);
  }

  /**
   * Exécute une commande avec le pattern :
   * Lock → Buffer Events → Commit → Unlock → Response
   */
  async execute(command: Command): Promise<CommandResult> {
    // Validation
    const handler = this.handlers.get(command.type);
    if (!handler) {
      return {
        command_id: command.id,
        trace_id: command.trace_id,
        status: 'FAILED',
        events_appended: 0,
        error: `No handler registered for command type: ${command.type}`,
      };
    }

    // Lock aggregate
    if (!acquireLock(command.aggregate_id, command.trace_id)) {
      return {
        command_id: command.id,
        trace_id: command.trace_id,
        status: 'FAILED',
        events_appended: 0,
        error: `Aggregate ${command.aggregate_id} is locked by another command`,
      };
    }

    try {
      // Begin transaction (buffer mode)
      eventStore.beginTransaction(command.trace_id);

      // Execute handler — generates events (buffered, not yet committed)
      const result = await handler.handle(command);

      if (result.status === 'FAILED') {
        // Rollback buffered events
        eventStore.rollbackTransaction(command.trace_id);
        releaseLock(command.aggregate_id);
        return result;
      }

      // Commit all buffered events atomically
      const committed = eventStore.commitTransaction(command.trace_id);

      releaseLock(command.aggregate_id);

      return {
        command_id: command.id,
        trace_id: command.trace_id,
        status: 'SUCCESS',
        events_appended: committed,
        data: result.data,
      };
    } catch (err: any) {
      // Rollback on any error
      eventStore.rollbackTransaction(command.trace_id);
      releaseLock(command.aggregate_id);

      return {
        command_id: command.id,
        trace_id: command.trace_id,
        status: 'ROLLED_BACK',
        events_appended: 0,
        error: err.message || 'Unknown command error',
      };
    }
  }

  /**
   * Vérifie si un handler existe pour un type de commande.
   */
  hasHandler(commandType: string): boolean {
    return this.handlers.has(commandType);
  }
}

export const commandBus = new CommandBusImpl();