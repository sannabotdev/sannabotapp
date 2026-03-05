/**
 * DebugFileLogger – Writes debug logs to Downloads/sanna.txt
 *
 * Appends all log entries to a persistent file for debugging purposes.
 * The file can be accessed via file manager in the Downloads folder.
 */
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';

// Use Downloads directory on Android, DocumentDirectoryPath on iOS
const LOG_FILE_PATH = Platform.OS === 'android' 
  ? `${RNFS.DownloadDirectoryPath}/sanna.txt`
  : `${RNFS.DocumentDirectoryPath}/sanna.txt`;

class DebugFileLoggerImpl {
  private _enabled = false;
  private writeQueue: string[] = [];
  private isWriting = false;
  private hasRotated = false;

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(v: boolean) {
    this._enabled = v;
    // When enabled, rotate existing log file if it exists, then write initial entry
    if (v && !this.hasRotated) {
      this.hasRotated = true;
      this.rotateLogFile().then(() => {
        this.writeLog('INFO', `Debug file logging enabled. Log file: ${LOG_FILE_PATH}`).catch(() => {});
      }).catch(() => {});
    }
  }

  /**
   * Rotate existing log file only if its last modification was on a previous day.
   * This keeps one log file per day — rotation happens at most once daily.
   */
  private async rotateLogFile(): Promise<void> {
    try {
      const exists = await RNFS.exists(LOG_FILE_PATH);
      if (!exists) {
        return; // No file to rotate
      }

      // Get file stats to get modification time
      const stats = await RNFS.stat(LOG_FILE_PATH);
      // mtime can be a number (Unix timestamp in milliseconds) or Date
      let mtime: Date;
      if (typeof stats.mtime === 'number') {
        mtime = new Date(stats.mtime);
      } else if (stats.mtime && typeof stats.mtime === 'object' && 'getFullYear' in stats.mtime) {
        mtime = stats.mtime as Date;
      } else {
        mtime = new Date(); // Use current date as fallback
      }

      // Only rotate if the file's last modification was on a previous calendar day
      const now = new Date();
      const sameDay =
        mtime.getFullYear() === now.getFullYear() &&
        mtime.getMonth() === now.getMonth() &&
        mtime.getDate() === now.getDate();

      if (sameDay) {
        return; // Still today's log — keep appending
      }
      
      // Format the mtime date as YYYY-MM-DD for the rotated filename
      const year = mtime.getFullYear();
      const month = String(mtime.getMonth() + 1).padStart(2, '0');
      const day = String(mtime.getDate()).padStart(2, '0');
      
      const dateStr = `${year}-${month}-${day}`;
      const rotatedPath = Platform.OS === 'android'
        ? `${RNFS.DownloadDirectoryPath}/sanna-${dateStr}.txt`
        : `${RNFS.DocumentDirectoryPath}/sanna-${dateStr}.txt`;
      
      // Rename the file
      await RNFS.moveFile(LOG_FILE_PATH, rotatedPath);
    } catch (error) {
      // Silently ignore rotation errors - don't prevent logging from starting
      console.error('[DebugFileLogger] Error rotating log file:', error);
    }
  }

  /**
   * Write a log entry to the file.
   * Format: [YYYY-MM-DD HH:MM:SS.mmm] [LEVEL] message
   */
  async writeLog(level: string, message: string): Promise<void> {
    if (!this._enabled) return;

    const timestamp = new Date();
    const year = timestamp.getFullYear();
    const month = String(timestamp.getMonth() + 1).padStart(2, '0');
    const day = String(timestamp.getDate()).padStart(2, '0');
    const hours = String(timestamp.getHours()).padStart(2, '0');
    const minutes = String(timestamp.getMinutes()).padStart(2, '0');
    const seconds = String(timestamp.getSeconds()).padStart(2, '0');
    const milliseconds = String(timestamp.getMilliseconds()).padStart(3, '0');

    const timestampStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
    const logLine = `[${timestampStr}] [${level}] ${message}\n`;

    // Add to queue
    this.writeQueue.push(logLine);

    // Process queue asynchronously
    this.processQueue().catch(() => {
      // Silently ignore write errors to prevent infinite loops
    });
  }

  /**
   * Process the write queue, appending entries to the file.
   */
  private async processQueue(): Promise<void> {
    if (this.isWriting || this.writeQueue.length === 0) return;

    this.isWriting = true;

    try {
      // Collect all queued entries
      const entries = this.writeQueue.splice(0);
      const content = entries.join('');

      // Ensure directory exists
      const dirPath = LOG_FILE_PATH.substring(0, LOG_FILE_PATH.lastIndexOf('/'));
      const dirExists = await RNFS.exists(dirPath);
      if (!dirExists) {
        await RNFS.mkdir(dirPath);
      }

      // Check if file exists, if not create it
      const exists = await RNFS.exists(LOG_FILE_PATH);
      if (exists) {
        // Append to existing file
        await RNFS.appendFile(LOG_FILE_PATH, content, 'utf8');
      } else {
        // Create new file
        await RNFS.writeFile(LOG_FILE_PATH, content, 'utf8');
      }
    } catch (error) {
      // Log error to console only (not to file to avoid infinite loop)
      // Use original console to avoid recursion
      const originalConsoleError = console.error;
      if (originalConsoleError) {
        originalConsoleError('[DebugFileLogger] Error writing to file:', error);
      }
    } finally {
      this.isWriting = false;

      // Process remaining items in queue
      if (this.writeQueue.length > 0) {
        // Use setTimeout to avoid blocking
        setTimeout(() => {
          this.processQueue().catch(() => {});
        }, 0);
      }
    }
  }

  /**
   * Write a SYSTEM-level log entry that is ALWAYS written to disk,
   * regardless of the enabled flag.  Used for crash handlers, lifecycle
   * events, and anything that must survive even when debug logging is off.
   */
  async writeSystemLog(level: string, message: string): Promise<void> {
    const timestamp = new Date();
    const year = timestamp.getFullYear();
    const month = String(timestamp.getMonth() + 1).padStart(2, '0');
    const day = String(timestamp.getDate()).padStart(2, '0');
    const hours = String(timestamp.getHours()).padStart(2, '0');
    const minutes = String(timestamp.getMinutes()).padStart(2, '0');
    const seconds = String(timestamp.getSeconds()).padStart(2, '0');
    const milliseconds = String(timestamp.getMilliseconds()).padStart(3, '0');

    const timestampStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
    const logLine = `[${timestampStr}] [${level}] ${message}\n`;

    // Write synchronously to queue and flush — bypass enabled check
    this.writeQueue.push(logLine);
    this.processQueue().catch(() => {});
  }

  /**
   * Clear the log file.
   */
  async clear(): Promise<void> {
    try {
      const exists = await RNFS.exists(LOG_FILE_PATH);
      if (exists) {
        await RNFS.unlink(LOG_FILE_PATH);
      }
    } catch {
      // Silently ignore errors
    }
  }
}

/** Singleton debug file logger */
export const DebugFileLogger = new DebugFileLoggerImpl();
