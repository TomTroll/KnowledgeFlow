import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('obsidian', () => {
  return {
    Notice: vi.fn(),
  };
});

import { ClipQueue } from '../clip-queue';
import { ClipLog } from '../clip-log';
import { GeminiRateLimitError } from '../gemini-api';
import type { ClipRequest } from '@knowledgeflow/shared';

describe('ClipQueue', () => {
  const mockReq: ClipRequest = {
    selectedText: 'Test text',
    sourceUrl: 'https://test.com',
    pageTitle: 'Test Page',
    tags: [],
    comment: ''
  };

  let clipLog: ClipLog;
  let processor: any;
  let persist: any;
  let showNotice: any;
  let queue: ClipQueue;

  beforeEach(() => {
    vi.useFakeTimers();
    clipLog = new ClipLog();
    processor = vi.fn();
    persist = vi.fn();
    showNotice = vi.fn();
    queue = new ClipQueue(processor, clipLog, persist, showNotice);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('bypasses queue entirely if successful', async () => {
    processor.mockResolvedValueOnce({
      success: true,
      clipId: '123',
      matchedPath: 'Notes/1.md',
      justification: null
    });

    const res = await queue.handleClip(mockReq);
    expect(res.success).toBe(true);
    expect(queue.size).toBe(0);
    expect(clipLog.size).toBe(0); // routing pipeline handles log insertion for successful synchronous clips
  });

  it('converts GeminiRateLimitError to 202 Queued Response', async () => {
    processor.mockRejectedValueOnce(new GeminiRateLimitError('Too many requests', 60000));

    const res = await queue.handleClip(mockReq);
    
    // Check response
    expect(res.success).toBe(false);
    if (!res.success && 'queued' in res) {
      expect(res.queued).toBe(true);
      expect(res.retryAfter).toBeGreaterThan(Date.now());
      expect(res.clipId).toBeDefined();
    } else {
      expect.fail('Response should be queued');
    }

    // Check queue state
    expect(queue.size).toBe(1);

    // Check log entry is inserted with 'queued' status
    expect(clipLog.size).toBe(1);
    expect(clipLog.getRecent()[0].status).toBe('queued');
    expect(clipLog.getRecent()[0].id).toBe((res as any).clipId);

    // Notice shown
    expect(showNotice).toHaveBeenCalledWith('Rate limit hit! Retrying in 60s');
    expect(persist).toHaveBeenCalled();
  });

  it('automatically retries after the window expires and updates status', async () => {
    processor.mockRejectedValueOnce(new GeminiRateLimitError('Too many requests', 60000));
    processor.mockResolvedValueOnce({
      success: true,
      clipId: 'temp-id',
      matchedPath: 'Notes/Success.md',
      justification: null
    });

    const res = await queue.handleClip(mockReq) as any;
    
    expect(queue.size).toBe(1);
    expect(clipLog.getRecent()[0].status).toBe('queued');
    
    // Fast-forward 60s
    await vi.advanceTimersByTimeAsync(60000);

    // The queue should be empty after processing
    expect(queue.size).toBe(0);

    // The clip log should be updated to 'inserted'
    const updatedEntry = clipLog.getRecent()[0];
    expect(updatedEntry.status).toBe('inserted');
    expect(updatedEntry.matchedPath).toBe('Notes/Success.md');
    
    // Ensure persist was called again to save the inserted state
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it('re-queues if retry hits another 429', async () => {
    processor.mockRejectedValueOnce(new GeminiRateLimitError('Too many requests', 60000));
    // Second try also fails with a longer wait
    processor.mockRejectedValueOnce(new GeminiRateLimitError('Still too many', 120000));

    await queue.handleClip(mockReq);
    
    expect(queue.size).toBe(1);
    
    // First retry
    await vi.advanceTimersByTimeAsync(60000);
    
    // Queue should STILL be 1 because it failed again
    expect(queue.size).toBe(1);
    expect(clipLog.getRecent()[0].status).toBe('queued');
    
    // Notice should have been shown again
    expect(showNotice).toHaveBeenCalledWith('Rate limit hit! Retrying in 120s');
  });

  it('throws non-rate-limit errors to the caller', async () => {
    processor.mockRejectedValueOnce(new Error('Random network failure'));

    await expect(queue.handleClip(mockReq)).rejects.toThrow('Random network failure');
    expect(queue.size).toBe(0);
    expect(clipLog.size).toBe(0);
  });
});
