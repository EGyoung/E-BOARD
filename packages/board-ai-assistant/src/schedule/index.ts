export enum TaskPriority {
    IMMEDIATE = 0,
    HIGH = 1,
    NORMAL = 2,
    LOW = 3,
    IDLE = 4
}

export type TaskStatus = "pending" | "running" | "completed" | "cancelled" | "errored";

export interface TaskContext {
    id: string;
    now: number;
    frameTime: number;
    elapsed: number;
    didTimeout: boolean;
    timeRemaining: () => number;
    signal: AbortSignal;
}

export type TaskCallback = (context: TaskContext) => void | TaskCallback;

export interface ScheduleTaskOptions {
    priority?: TaskPriority;
    timeout?: number;
    signal?: AbortSignal;
    metadata?: Record<string, unknown>;
}

export interface SchedulerTaskState {
    id: string;
    priority: TaskPriority;
    status: TaskStatus;
    createdAt: number;
    startedAt: number | null;
    completedAt: number | null;
    timeout?: number;
    metadata?: Record<string, unknown>;
}

export interface SchedulerStats {
    pending: number;
    running: number;
    completed: number;
    cancelled: number;
    errored: number;
}

export interface RafTaskSchedulerOptions {
    frameBudget?: number;
    onError?: (error: unknown, task: SchedulerTaskState) => void;
    onDrain?: () => void;
}

interface InternalTask extends SchedulerTaskState {
    callback: TaskCallback;
    expirationTime: number;
    sequence: number;
    controller: AbortController;
    sourceSignal?: AbortSignal;
    abortListener?: () => void;
}

const DEFAULT_FRAME_BUDGET = 8;

const PRIORITY_ORDER: TaskPriority[] = [
    TaskPriority.IMMEDIATE,
    TaskPriority.HIGH,
    TaskPriority.NORMAL,
    TaskPriority.LOW,
    TaskPriority.IDLE
];

const rafImpl =
    typeof globalThis !== "undefined" && typeof globalThis.requestAnimationFrame === "function"
        ? globalThis.requestAnimationFrame.bind(globalThis)
        : (callback: (time: number) => void) => globalThis.setTimeout(() => callback(Date.now()), 16);

const cafImpl =
    typeof globalThis !== "undefined" && typeof globalThis.cancelAnimationFrame === "function"
        ? globalThis.cancelAnimationFrame.bind(globalThis)
        : (id: number) => globalThis.clearTimeout(id);

const nowImpl =
    typeof globalThis !== "undefined" && globalThis.performance && typeof globalThis.performance.now === "function"
        ? () => globalThis.performance.now()
        : () => Date.now();

export class RafTaskScheduler {
    private readonly frameBudget: number;
    private readonly onError?: (error: unknown, task: SchedulerTaskState) => void;
    private readonly onDrain?: () => void;
    private readonly queues = new Map<TaskPriority, InternalTask[]>();
    private readonly tasks = new Map<string, InternalTask>();
    private readonly stats: SchedulerStats = {
        pending: 0,
        running: 0,
        completed: 0,
        cancelled: 0,
        errored: 0
    };
    private taskIdSeed = 0;
    private sequenceSeed = 0;
    private rafId: number | null = null;
    private frameStart = 0;
    private paused = false;

    constructor(options: RafTaskSchedulerOptions = {}) {
        this.frameBudget = Math.max(1, options.frameBudget ?? DEFAULT_FRAME_BUDGET);
        this.onError = options.onError;
        this.onDrain = options.onDrain;

        PRIORITY_ORDER.forEach(priority => {
            this.queues.set(priority, []);
        });
    }

    public schedule(callback: TaskCallback, options: ScheduleTaskOptions = {}): string {
        const createdAt = nowImpl();
        const taskId = this.createTaskId();
        const priority = options.priority ?? TaskPriority.NORMAL;
        const timeout = options.timeout;
        const expirationTime = typeof timeout === "number" ? createdAt + Math.max(0, timeout) : Number.POSITIVE_INFINITY;
        const controller = new AbortController();

        if (options.signal?.aborted) {
            controller.abort(options.signal.reason);
        }

        const task: InternalTask = {
            id: taskId,
            callback,
            priority,
            timeout,
            metadata: options.metadata,
            status: "pending",
            createdAt,
            startedAt: null,
            completedAt: null,
            expirationTime,
            sequence: this.sequenceSeed++,
            controller,
            sourceSignal: options.signal
        };

        if (options.signal && !options.signal.aborted) {
            const relayAbort = () => this.cancel(task.id);
            task.abortListener = relayAbort;
            options.signal.addEventListener("abort", relayAbort, { once: true });
        }

        if (task.controller.signal.aborted) {
            task.status = "cancelled";
            task.completedAt = createdAt;
            this.stats.cancelled += 1;
            return task.id;
        }

        this.enqueue(task);
        return task.id;
    }

    public cancel(taskId: string): boolean {
        const task = this.tasks.get(taskId);
        if (!task) {
            return false;
        }
        if (task.status === "completed" || task.status === "cancelled" || task.status === "errored") {
            return false;
        }

        if (task.status === "pending") {
            this.removeFromQueue(task);
            this.stats.pending = Math.max(0, this.stats.pending - 1);
        }

        if (task.status === "running") {
            this.stats.running = Math.max(0, this.stats.running - 1);
        }

        task.status = "cancelled";
        task.completedAt = nowImpl();
        if (!task.controller.signal.aborted) {
            task.controller.abort("cancelled");
        }

        this.detachAbortListener(task);
        this.stats.cancelled += 1;
        this.tasks.delete(taskId);

        this.maybeEmitDrain();
        return true;
    }

    public clear(): void {
        const ids = Array.from(this.tasks.keys());
        ids.forEach(id => this.cancel(id));
    }

    public pause(): void {
        this.paused = true;
        if (this.rafId !== null) {
            cafImpl(this.rafId);
            this.rafId = null;
        }
    }

    public resume(): void {
        if (!this.paused) {
            return;
        }
        this.paused = false;
        this.ensureWorkLoop();
    }

    public isPaused(): boolean {
        return this.paused;
    }

    public has(taskId: string): boolean {
        return this.tasks.has(taskId);
    }

    public size(): number {
        return this.tasks.size;
    }

    public getTask(taskId: string): SchedulerTaskState | null {
        const task = this.tasks.get(taskId);
        if (!task) {
            return null;
        }
        return this.toTaskState(task);
    }

    public getStats(): SchedulerStats {
        return { ...this.stats };
    }

    public flush(maxTasks = Number.POSITIVE_INFINITY): number {
        if (this.paused) {
            return 0;
        }

        let count = 0;
        this.frameStart = nowImpl();
        let currentTime = this.frameStart;

        while (count < maxTasks) {
            const task = this.pickNextTask(currentTime);
            if (!task) {
                break;
            }

            this.runTask(task, this.frameStart, currentTime, Number.POSITIVE_INFINITY);
            currentTime = nowImpl();
            count += 1;
        }

        if (this.isQueueEmpty()) {
            this.maybeEmitDrain();
        } else {
            this.ensureWorkLoop();
        }

        return count;
    }

    public dispose(): void {
        this.pause();
        this.clear();
    }

    private enqueue(task: InternalTask): void {
        const queue = this.queues.get(task.priority);
        if (!queue) {
            throw new Error(`Unknown task priority: ${task.priority}`);
        }

        queue.push(task);
        queue.sort((a, b) => {
            if (a.expirationTime !== b.expirationTime) {
                return a.expirationTime - b.expirationTime;
            }
            return a.sequence - b.sequence;
        });

        this.tasks.set(task.id, task);
        this.stats.pending += 1;
        this.ensureWorkLoop();
    }

    private removeFromQueue(task: InternalTask): void {
        const queue = this.queues.get(task.priority);
        if (!queue) {
            return;
        }

        const index = queue.findIndex(item => item.id === task.id);
        if (index >= 0) {
            queue.splice(index, 1);
        }
    }

    private ensureWorkLoop(): void {
        if (this.paused || this.rafId !== null || this.isQueueEmpty()) {
            return;
        }

        this.rafId = rafImpl(this.workLoop);
    }

    private readonly workLoop = (frameTime: number): void => {
        this.rafId = null;
        if (this.paused) {
            return;
        }

        this.frameStart = frameTime || nowImpl();
        const deadline = this.frameStart + this.frameBudget;
        let currentTime = nowImpl();

        while (true) {
            const task = this.pickNextTask(currentTime);
            if (!task) {
                break;
            }

            const didTimeout = currentTime >= task.expirationTime;
            if (!didTimeout && currentTime >= deadline) {
                break;
            }

            this.runTask(task, this.frameStart, currentTime, deadline);
            currentTime = nowImpl();
        }

        if (!this.isQueueEmpty()) {
            this.ensureWorkLoop();
            return;
        }

        this.maybeEmitDrain();
    };

    private pickNextTask(currentTime: number): InternalTask | null {
        for (const priority of PRIORITY_ORDER) {
            const queue = this.queues.get(priority);
            if (!queue || queue.length === 0) {
                continue;
            }

            while (queue.length > 0) {
                const task = queue.shift();
                if (!task) {
                    break;
                }

                if (task.status !== "pending") {
                    continue;
                }

                if (task.controller.signal.aborted) {
                    task.status = "cancelled";
                    task.completedAt = currentTime;
                    this.tasks.delete(task.id);
                    this.stats.pending = Math.max(0, this.stats.pending - 1);
                    this.stats.cancelled += 1;
                    this.detachAbortListener(task);
                    continue;
                }

                return task;
            }
        }

        return null;
    }

    private runTask(task: InternalTask, frameTime: number, currentTime: number, deadline: number): void {
        this.stats.pending = Math.max(0, this.stats.pending - 1);
        this.stats.running += 1;
        task.status = "running";
        task.startedAt = task.startedAt ?? currentTime;

        const context: TaskContext = {
            id: task.id,
            frameTime,
            now: currentTime,
            elapsed: currentTime - task.createdAt,
            didTimeout: currentTime >= task.expirationTime,
            signal: task.controller.signal,
            timeRemaining: () => Math.max(0, deadline - nowImpl())
        };

        try {
            const continuation = task.callback(context);

            this.stats.running = Math.max(0, this.stats.running - 1);
            task.completedAt = nowImpl();

            if (task.controller.signal.aborted) {
                task.status = "cancelled";
                this.stats.cancelled += 1;
                this.tasks.delete(task.id);
                this.detachAbortListener(task);
                return;
            }

            if (typeof continuation === "function") {
                task.callback = continuation;
                task.status = "pending";
                task.sequence = this.sequenceSeed++;
                const queue = this.queues.get(task.priority);
                if (!queue) {
                    throw new Error(`Unknown task priority: ${task.priority}`);
                }
                queue.push(task);
                queue.sort((a, b) => {
                    if (a.expirationTime !== b.expirationTime) {
                        return a.expirationTime - b.expirationTime;
                    }
                    return a.sequence - b.sequence;
                });
                this.stats.pending += 1;
                return;
            }

            task.status = "completed";
            this.stats.completed += 1;
            this.tasks.delete(task.id);
            this.detachAbortListener(task);
        } catch (error) {
            this.stats.running = Math.max(0, this.stats.running - 1);
            task.status = "errored";
            task.completedAt = nowImpl();
            this.stats.errored += 1;
            this.tasks.delete(task.id);
            this.detachAbortListener(task);
            if (this.onError) {
                this.onError(error, this.toTaskState(task));
            }
        }
    }

    private maybeEmitDrain(): void {
        if (this.tasks.size === 0 && this.onDrain) {
            this.onDrain();
        }
    }

    private isQueueEmpty(): boolean {
        for (const priority of PRIORITY_ORDER) {
            const queue = this.queues.get(priority);
            if (queue && queue.length > 0) {
                return false;
            }
        }
        return true;
    }

    private detachAbortListener(task: InternalTask): void {
        if (!task.abortListener || !task.sourceSignal) {
            return;
        }
        task.sourceSignal.removeEventListener("abort", task.abortListener);
        task.abortListener = undefined;
    }

    private toTaskState(task: InternalTask): SchedulerTaskState {
        return {
            id: task.id,
            priority: task.priority,
            status: task.status,
            createdAt: task.createdAt,
            startedAt: task.startedAt,
            completedAt: task.completedAt,
            timeout: task.timeout,
            metadata: task.metadata
        };
    }

    private createTaskId(): string {
        this.taskIdSeed += 1;
        return `task_${this.taskIdSeed}`;
    }
}

export const createRafTaskScheduler = (options?: RafTaskSchedulerOptions): RafTaskScheduler => {
    return new RafTaskScheduler(options);
};
