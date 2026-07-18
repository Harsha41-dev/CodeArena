import { EventEmitter } from "node:events";
import { logger } from "../config/logger";
import type { SubmissionStatus } from "../types/domain";

// event payload when submission status changes
export interface SubmissionStatusEvent {
  submissionId: string;
  status: SubmissionStatus;
  passedTestCases: number;
  totalTestCases: number;
  runtime: number | null;
  memory: number | null;
  updatedAt: string;
}

export type SubmissionStatusListener = (event: SubmissionStatusEvent) => void;

export interface SubmissionEventPublisher {
  publishSubmissionStatus(event: SubmissionStatusEvent): Promise<void>;
}

export interface SubmissionEventSubscriber {
  subscribeToSubmission(submissionId: string, listener: SubmissionStatusListener): () => void;
}

export interface SubmissionEventBus extends SubmissionEventPublisher, SubmissionEventSubscriber {}

// statuses that mean judging is done
export const terminalSubmissionStatuses: readonly SubmissionStatus[] = [
  "ACCEPTED",
  "WRONG_ANSWER",
  "TIME_LIMIT_EXCEEDED",
  "MEMORY_LIMIT_EXCEEDED",
  "RUNTIME_ERROR",
  "COMPILATION_ERROR",
  "INTERNAL_ERROR"
];

export function isTerminalSubmissionStatus(status: SubmissionStatus): boolean {
  return terminalSubmissionStatuses.includes(status);
}

// simple in-process bus (used when no redis)
export class InMemorySubmissionEventBus implements SubmissionEventBus {
  private readonly emitter = new EventEmitter();

  async publishSubmissionStatus(event: SubmissionStatusEvent): Promise<void> {
    const channel = channelForSubmission(event.submissionId);
    this.emitter.emit(channel, event);
  }

  subscribeToSubmission(submissionId: string, listener: SubmissionStatusListener): () => void {
    const channel = channelForSubmission(submissionId);
    this.emitter.on(channel, listener);

    // return unsubscribe function
    return () => {
      this.emitter.off(channel, listener);
    };
  }
}

export interface RedisPublisher {
  publish(channel: string, message: string): Promise<unknown>;
}

export interface RedisSubscriber {
  subscribe(channel: string): Promise<unknown>;
  unsubscribe(channel: string): Promise<unknown>;
  on(event: "message", listener: (channel: string, message: string) => void): unknown;
  off?(event: "message", listener: (channel: string, message: string) => void): unknown;
}

// redis-backed bus for multi-process setups
export class RedisSubmissionEventBus implements SubmissionEventBus {
  private readonly listeners = new Map<string, Set<SubmissionStatusListener>>();

  // handle messages from redis
  private readonly onMessage = (channel: string, message: string): void => {
    const listeners = this.listeners.get(channel);
    if (!listeners) {
      return;
    }
    if (listeners.size === 0) {
      return;
    }

    try {
      const event = JSON.parse(message) as SubmissionStatusEvent;
      // call each listener
      for (const listener of listeners) {
        listener(event);
      }
    } catch (error) {
      logger.warn({ err: error, channel }, "Invalid submission event payload from Redis");
    }
  };

  constructor(
    private readonly publisher: RedisPublisher,
    private readonly subscriber: RedisSubscriber
  ) {
    this.subscriber.on("message", this.onMessage);
  }

  async publishSubmissionStatus(event: SubmissionStatusEvent): Promise<void> {
    const channel = channelForSubmission(event.submissionId);
    const message = JSON.stringify(event);
    await this.publisher.publish(channel, message);
  }

  subscribeToSubmission(submissionId: string, listener: SubmissionStatusListener): () => void {
    const channel = channelForSubmission(submissionId);

    // get or create the set of listeners for this channel
    let listeners = this.listeners.get(channel);
    let shouldSubscribe = false;
    if (!listeners) {
      listeners = new Set<SubmissionStatusListener>();
      shouldSubscribe = true;
    } else if (listeners.size === 0) {
      shouldSubscribe = true;
    }

    listeners.add(listener);
    this.listeners.set(channel, listeners);

    // only subscribe to redis once per channel
    if (shouldSubscribe) {
      this.subscriber.subscribe(channel).catch((error: unknown) => {
        logger.error({ err: error, channel }, "Redis submission event subscription failed");
      });
    }

    // unsubscribe helper
    return () => {
      const activeListeners = this.listeners.get(channel);
      if (!activeListeners) {
        return;
      }

      activeListeners.delete(listener);

      // if nobody is listening, drop the redis sub too
      if (activeListeners.size === 0) {
        this.listeners.delete(channel);
        this.subscriber.unsubscribe(channel).catch((error: unknown) => {
          logger.warn({ err: error, channel }, "Redis submission event unsubscribe failed");
        });
      }
    };
  }

  close(): void {
    if (this.subscriber.off) {
      this.subscriber.off("message", this.onMessage);
    }
  }
}

// channel name helper
function channelForSubmission(submissionId: string): string {
  return `submission:${submissionId}`;
}
