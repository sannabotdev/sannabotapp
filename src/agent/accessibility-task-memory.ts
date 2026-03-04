/**
 * AccessibilityTaskMemory – Task-spezifisches Memory für Accessibility Sub-Agent
 *
 * Speichert Informationen während eines Accessibility-Tasks mit Step-Context.
 * Wird in den System Prompt injiziert und hilft dem Agent, sich an wichtige
 * UI-Elemente, erfolgreiche Aktionen und Fehler zu erinnern.
 */

export interface TaskMemoryEntry {
  step: number;
  information: string;
  timestamp: number;
}

export class AccessibilityTaskMemory {
  private entries: TaskMemoryEntry[] = [];
  private maxEntries: number = 15;
  private currentStep: number = 0;

  /**
   * Erhöht den aktuellen Step-Counter
   */
  incrementStep(): void {
    this.currentStep++;
  }

  /**
   * Speichert eine Information mit aktuellem Step-Context
   */
  remember(information: string): void {
    if (!information || !information.trim()) {
      return;
    }

    const entry: TaskMemoryEntry = {
      step: this.currentStep,
      information: information.trim(),
      timestamp: Date.now(),
    };

    this.entries.push(entry);

    // FIFO: Entferne älteste Einträge wenn Limit überschritten
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  /**
   * Gibt alle Memory-Einträge als formatierte Markdown-Sektion zurück
   */
  getFormattedMemory(): string {
    if (this.entries.length === 0) {
      return '';
    }

    const lines = ['## Task Memory (Current Session)'];
    lines.push('');
    lines.push('Information discovered during this task:');
    lines.push('');

    for (const entry of this.entries) {
      lines.push(`- **Step ${entry.step}**: ${entry.information}`);
    }

    return lines.join('\n');
  }

  /**
   * Gibt die letzten N Einträge zurück (für kompakte Darstellung)
   */
  getRecentEntries(count: number = 5): TaskMemoryEntry[] {
    return this.entries.slice(-count);
  }

  /**
   * Löscht alle Einträge
   */
  clear(): void {
    this.entries = [];
    this.currentStep = 0;
  }

  /**
   * Gibt die Anzahl der Einträge zurück
   */
  getEntryCount(): number {
    return this.entries.length;
  }
}
