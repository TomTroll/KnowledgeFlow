import type { ClipRequest, ClipResponse, ClipQueuedResponse } from '@knowledgeflow/shared';
import { GeminiRateLimitError } from './gemini-api';
import type { ClipLog } from './clip-log';
import { Notice } from 'obsidian';

interface QueuedClip {
  clipId: string;
  req: ClipRequest;
  timer: ReturnType<typeof setTimeout>;
}

export class ClipQueue {
  private queue: Map<string, QueuedClip> = new Map();

  constructor(
    private processor: (req: ClipRequest, optionalClipId?: string) => Promise<ClipResponse>,
    private clipLog: ClipLog,
    private persist: () => void,
    private showNotice: (msg: string) => void = (msg) => new Notice(msg)
  ) {}

  get size(): number {
    return this.queue.size;
  }

  async handleClip(req: ClipRequest): Promise<ClipResponse | ClipQueuedResponse> {
    const clipId = crypto.randomUUID();
    return this.tryProcess(req, clipId, true);
  }

  private async tryProcess(req: ClipRequest, clipId: string, isInitial: boolean): Promise<ClipResponse | ClipQueuedResponse> {
    try {
      const response = await this.processor(req, clipId);
      
      // If this was a retry that succeeded, update the log to 'inserted'
      if (!isInitial) {
        this.queue.delete(clipId);
        
        // Find in log and update status
        const entries = this.clipLog.getAll();
        const entry = entries.find(e => e.id === clipId);
        if (entry) {
          entry.status = 'inserted';
          entry.matchedPath = response.matchedPath;
          // Force update the array in clipLog
          this.clipLog.loadAll(entries);
          this.persist();
        }
      }
      
      return response;
    } catch (e) {
      if (e instanceof GeminiRateLimitError) {
        return this.enqueue(req, clipId, e.retryAfterMs, isInitial);
      }
      // If it's a retry and it threw a non-rate-limit error, we should probably remove it from the queue
      if (!isInitial) {
        this.queue.delete(clipId);
      }
      throw e;
    }
  }

  private enqueue(req: ClipRequest, clipId: string, retryAfterMs: number, isInitial: boolean): ClipQueuedResponse {
    // Show Notice
    this.showNotice(`Rate limit hit! Retrying in ${Math.ceil(retryAfterMs / 1000)}s`);

    // If already in queue, clear old timer
    if (this.queue.has(clipId)) {
      clearTimeout(this.queue.get(clipId)!.timer);
    }

    const timer = setTimeout(() => {
      // Background retry
      this.tryProcess(req, clipId, false).catch(err => {
        console.error('Background retry failed:', err);
      });
    }, retryAfterMs);

    this.queue.set(clipId, { clipId, req, timer });

    // If it's the first time it failed, add to log as 'queued'
    if (isInitial) {
      this.clipLog.append({
        id: clipId,
        sourceUrl: req.sourceUrl,
        pageTitle: req.pageTitle,
        selectedText: req.selectedText,
        timestamp: new Date().toISOString(),
        matchedPath: '', // Will be updated on success
        justification: null,
        tags: req.tags,
        comment: req.comment,
        status: 'queued'
      });
      this.persist();
    }

    return {
      success: false,
      queued: true,
      clipId,
      retryAfter: Date.now() + retryAfterMs
    };
  }
}
