/**
 * ActionHistoryTracker – Tracks action execution history for Accessibility Sub-Agent
 *
 * Records successful and failed actions to help the agent avoid repeating mistakes
 * and make better decisions based on past attempts.
 */

export interface ActionHistoryEntry {
  step: number;
  action: string;
  nodeId?: string;
  success: boolean;
  error?: string;
  timestamp: number;
}

export class ActionHistoryTracker {
  private history: ActionHistoryEntry[] = [];
  private maxEntries: number = 10;
  private currentStep: number = 0;

  /**
   * Erhöht den aktuellen Step-Counter
   */
  incrementStep(): void {
    this.currentStep++;
  }

  /**
   * Speichert eine Action mit Ergebnis
   */
  record(action: string, nodeId: string | null, success: boolean, error?: string): void {
    const entry: ActionHistoryEntry = {
      step: this.currentStep,
      action,
      nodeId: nodeId || undefined,
      success,
      error,
      timestamp: Date.now(),
    };

    this.history.push(entry);

    // FIFO: Entferne älteste Einträge wenn Limit überschritten
    if (this.history.length > this.maxEntries) {
      this.history = this.history.slice(-this.maxEntries);
    }
  }

  /**
   * Gibt die letzten N fehlgeschlagenen Aktionen zurück
   */
  getRecentFailures(count: number = 3): ActionHistoryEntry[] {
    return this.history
      .filter(e => !e.success)
      .slice(-count);
  }

  /**
   * Gibt die Action History als formatierte Markdown-Sektion zurück
   */
  getFormattedHistory(): string {
    if (this.history.length === 0) {
      return '';
    }

    const lines = ['## Recent Actions'];
    lines.push('');

    for (const entry of this.history.slice(-5)) {
      const status = entry.success ? '✅' : '❌';
      const nodeInfo = entry.nodeId ? ` (node: ${entry.nodeId})` : '';
      const errorInfo = entry.error ? ` - ${entry.error}` : '';
      lines.push(`${status} Step ${entry.step}: ${entry.action}${nodeInfo}${errorInfo}`);
    }

    return lines.join('\n');
  }

  /**
   * Prüft ob mehrere Fehler in Folge aufgetreten sind
   */
  hasRecentFailures(threshold: number = 2): boolean {
    const recent = this.history.slice(-threshold);
    return recent.length >= threshold && recent.every(e => !e.success);
  }

  /**
   * Löscht alle Einträge
   */
  clear(): void {
    this.history = [];
    this.currentStep = 0;
  }

  /**
   * Gibt die Anzahl der Einträge zurück
   */
  getEntryCount(): number {
    return this.history.length;
  }
}
