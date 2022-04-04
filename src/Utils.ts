// #region Page Events

export type Callback = () => void;
export type DTCallback = (deltaTime: number) => void;
export type AlarmId = {
    id: number,
    period: number,
    continuous?: boolean
};

const INVALID_ALARM_ID: number = 0;

/**
 * Invokes a method when the page is finished loading.
 */
export function OnPageLoad(invoke: Callback) {
    window.addEventListener("load", () => {
        window.removeEventListener("load", invoke);
        invoke();
    });
}

/**
 * Invokes a method when the page is about to close.
 */
export function OnPageClose(invoke: Callback) {
    window.addEventListener("beforeunload", () => {
        window.removeEventListener("beforeunload", invoke);
        invoke();
    });
}

/**
 * Callback on animation frame.
 */
export function OnAnimationFrame(callback: DTCallback, maxDeltaTime: number = 0): AlarmId {
    let lastRecorded = performance.now();

    let id: AlarmId = {
        id: 0,
        period: 0,
        continuous: false
    };
    function RAF(timestamp: DOMHighResTimeStamp): void {
        let deltaTime = timestamp - lastRecorded;
        lastRecorded = timestamp;
        if (maxDeltaTime > 0 && deltaTime > maxDeltaTime) {
            deltaTime = maxDeltaTime;
        }

        callback && callback(deltaTime);
        if (id.id != INVALID_ALARM_ID) {
            id.id = requestAnimationFrame(RAF);
        }
    }

    id.id = requestAnimationFrame(RAF);
    return id;
}

/**
 * Cancels an animation frame callback.
 */
export function CancelAnimationFrame(id: AlarmId): boolean {
    if (id.id != INVALID_ALARM_ID) {
        cancelAnimationFrame(id.id);
        id.id = INVALID_ALARM_ID;
        return true;
    } else {
        return false;
    }
}

// #endregion // Page Events

// #region  Event Handlers

/**
 * List of callbacks.
 */
export class HandlerList<T extends Function> {
    private readonly _handlers: T[] = [];

    /**
     * Adds a callback.
     */
    public Add(callback: T): void {
        this._handlers.push(callback);
    }

    /**
     * Removes a callback.
     */
    public Remove(callback: T): boolean {
        return List.FastRemove(this._handlers, callback);
    }

    /**
     * Clears all callbacks.
     */
    public Clear(): void {
        this._handlers.length = 0;
    }

    /**
     * Dispatches all registered callbacks with the given arguments.
     */
    public Dispatch(...args: any[]): void {
        const length = this._handlers.length;
        for (let i = 0; i < length; i++) {
            this._handlers[i](...args);
        }
    }
}

// #endregion // Event Handlers

// #region Debug

/**
 * Asserts that a given value is true.
 */
export function assert(value: any, msg?: string, ...args: any[]): asserts value {
    if (!value) {
        msg = msg || "Assertion";
        throw new Error("Assert: ".concat(sprintf(msg, args)));
    }
}

/**
 * Reports a message to the console. 
 */
export function report(msg: string, ...args: any[]) {
    console.log(sprintf(msg, args));
}

/**
 * Reports a message to the console. 
 */
export function warn(msg: string, ...args: any[]) {
    console.warn(sprintf(msg, args));
}

// #endregion // Debug

// #region Properties

/**
 * Applies a default value if the given property isn't defined on the object.
 */
export function AssignDefault<T, K extends keyof T>(object: T, propertyName: K, defaultValue: any): any {
    return object[propertyName] = (typeof object[propertyName] !== 'undefined') ? object[propertyName] : defaultValue;
}

/**
 * Returns the given value, or a default if it is undefined.
 */
export function ValueOrDefault<T>(value: T, defaultValue: T): T {
    return typeof value == "undefined" ? defaultValue : value;
}

/**
 * Accumulates a value on an object.
 */
export function IncrementProperty<T, K extends keyof T>(object: T, propertyName: K, add: any): any {
    return (object[propertyName] = (typeof object[propertyName] !== 'undefined') ? (object[propertyName] + add) : add);
}

/**
 * Returns if the given object is undefined.
 */
export function IsUndefined(obj: any): boolean {
    return typeof obj == "undefined";
}

// #endregion // Properties

// #region String

/**
 * Formats a string.
 * @param format 
 * @param args 
 */
export function sprintf(format: string, ...args: any[]): string {
    args = args && args[0];
    if (!args || !args.length) {
        return format;
    }

    return format.replace(sprintf_regex, sprintf_replacer(...args));
}

const sprintf_regex: RegExp = /(?=[\b\W])%(\d+)/g;

function sprintf_replacer(...args: any[]): (substring: string, ...captures: any[]) => string {
    return (substring: string, ...captures: any[]) => {
        const idx = parseInt(captures[0]) - 1;
        return idx < 0 || idx >= args.length ? "" : toString(args[idx]);
    };
}

export function toString(obj: any): string {
    return obj !== null && obj !== undefined ? obj.toString() : null;
}

// #endregion // Strings

// #region Arrays

/**
 * Comparison method.
 */
export type Comparison<T> = (a: T, b: T) => number;

/**
 * Default comparison.
 */
export function DefaultCompare(a: any, b: any): number {
    return a < b ? -1 : (a > b ? 1 : 0);
}

/**
 * Alphabet comparison.
 */
export function AlphabetCompare(a: string, b: string): number {
    return a.toLowerCase().localeCompare(b.toLowerCase());
}

/**
 * Contains array utility methods.
 */
export module List {
    export function RemoveAt<T>(array: T[], index: number): void {
        assert(index >= 0 && index < array.length, "Array index %1 is out of range for array with length %2", index, array.length);
        if (index == 0) {
            array.shift();
        } else {
            array.splice(index, 1);
        }
    }

    export function Remove<T>(array: T[], value: T): boolean {
        const index = array.indexOf(value);
        if (index >= 0) {
            if (index == 0) {
                array.shift();
            } else {
                array.splice(index, 1);
            }
            return true;
        }

        return false;
    }

    export function FastRemoveAt<T>(array: T[], index: number): void {
        const end = array.length - 1;
        assert(index >= 0 && index <= end, "Array index %1 is out of range for array with length %2", index, array.length);
        if (index != end) {
            array[index] = array[end];
        }
        array.pop();
    }

    export function FastRemove<T>(array: T[], value: T): boolean {
        const index = array.indexOf(value);
        if (index >= 0) {
            const end = array.length - 1;
            if (index != end) {
                array[index] = array[end];
            }
            array.pop();
            return true;
        } else {
            return false;
        }
    }

    export function Has<T>(array: T[], value: T): boolean {
        return array.indexOf(value) >= 0;
    }

    /**
     * Sorts an array based on value.
     */
    export function ValueSort<T>(array: T[]): void {
        array.sort(DefaultCompare);
    }
}

// #endregion // Arrays

// #region Random

export function RandomF(): number {
    return Math.random();
}

export function RandomI(): number {
    return Math.random() * Number.MAX_SAFE_INTEGER;
}

export function RandomRangeF(minOrMax: number, max?: number): number {
    if (IsUndefined(max)) {
        max = minOrMax;
        minOrMax = 0;
    }

    return Math.random() * (max - minOrMax) + minOrMax;
}

export function RandomRangeI(minOrMax: number, max?: number): number {
    if (IsUndefined(max)) {
        max = minOrMax;
        minOrMax = 0;
    }

    max = max | 0;
    minOrMax = minOrMax | 0;

    return minOrMax + Math.floor(Math.random() * (max - minOrMax)) | 0;
}

export function Shuffle<T>(array: T[], offset?: number, count?: number): void {
    offset = ValueOrDefault(offset, 0);
    count = ValueOrDefault(count, array.length);

    let i: number = Math.min(offset + count, array.length);
    let j: number;
    while (--i > offset) {
        const old = array[i];
        array[i] = array[j = RandomRangeI(offset, i + 1)];
        array[j] = old;
    }
}

// #endregion // Random

// #region Async Work

enum TaskMethodType {
    FUNCTION,
    GENERATOR
}

type TaskFunction = (...args: any[]) => boolean | TaskResult;
type TaskGenerator = Generator<unknown, any | TaskResult, unknown>;

export type TaskId = number;
export type TaskMethod = TaskFunction | TaskGenerator
export enum TaskStatus {
    INVALID,
    SCHEDULED,
    EXECUTING,
    INTERRUPTED,
    ERROR,
    FINISHED
}

export type TaskContext = any | any[] | undefined;
export type TaskCallback = (name?: string) => void;

export enum TaskResult {
    DONE,
    CONTINUE,
    NEXT_FRAME,
}

type TaskWorkUnit = {
    id: TaskId,
    name: string,
    type: TaskMethodType,
    method: TaskMethod,
    context: any[] | undefined
    status: TaskStatus,
    onComplete?: TaskCallback
};

export const NullTask: TaskId = 0;

/**
 * Queue of tasks to execute.
 */
export class TaskQueue {
    private readonly _workUnits: TaskWorkUnit[] = [];
    _currentId: TaskId = 0;

    /**
     * Schedules a task at the back of the queue.
     */
    public Schedule(method: TaskMethod, name?: string, onComplete?: TaskCallback): number {
        return this.ScheduleWithContext(method, undefined, name, onComplete);
    }

    /**
     * Schedules a prioritized task at the front of the queue.
     */
    public Priority(method: TaskMethod, name?: string, onComplete?: TaskCallback): number {
        return this.PriorityWithContext(method, undefined, name, onComplete);
    }

    /**
     * Schedules a task at the back of the queue with some additional context.
     */
    public ScheduleWithContext(method: TaskMethod, context: TaskContext, name?: string, onComplete?: TaskCallback): number {
        const task: TaskWorkUnit = {
            name: name,
            id: this.NextId(),
            type: TypeOfMethod(method),
            method: method,
            context: ProcessContextIntoMethodArgs(context),
            status: TaskStatus.SCHEDULED,
            onComplete: onComplete
        };
        this._workUnits.push(task);
        return task.id;
    }

    /**
     * Schedules a prioritized task at the front of the queue with some additional context.
     */
    public PriorityWithContext(method: TaskMethod, context: TaskContext, name?: string, onComplete?: TaskCallback): number {
        const task: TaskWorkUnit = {
            name: name,
            id: this.NextId(),
            type: TypeOfMethod(method),
            method: method,
            context: ProcessContextIntoMethodArgs(context),
            status: TaskStatus.SCHEDULED,
            onComplete: onComplete
        };

        // interrupt the current task
        if (this._workUnits.length > 0) {
            const current = this._workUnits[0];
            if (current.status == TaskStatus.EXECUTING) {
                current.status = TaskStatus.INTERRUPTED;
            }
        }

        this._workUnits.unshift(task);
        return task.id;
    }

    /**
     * Performs as much work as possible on the task queue in the given number of milliseconds.
     */
    public Tick(milliseconds: number): void {
        const start = performance.now();
        let remaining: number;
        while (this._workUnits.length > 0 && (remaining = start + milliseconds - performance.now()) > 0) {
            const top = this._workUnits[0];
            top.status = TaskStatus.EXECUTING;
            switch (top.type) {
                case TaskMethodType.FUNCTION: {
                    const method = (<TaskFunction>top.method);
                    while ((remaining = start + milliseconds - performance.now()) > 0) {
                        const result = method.apply(undefined, top.context);
                        if (!result) {
                            top.status = TaskStatus.FINISHED;
                            List.Remove(this._workUnits, top);
                            top.onComplete && top.onComplete(top.name);
                            break;
                        } else if (top.status != TaskStatus.EXECUTING) {
                            break;
                        } else if (result == TaskResult.NEXT_FRAME) {
                            return;
                        }
                    }
                    break;
                }
                case TaskMethodType.GENERATOR: {
                    const generator = (<TaskGenerator>top.method);
                    while ((remaining = start + milliseconds - performance.now()) > 0) {
                        const result = generator.next(top.context);
                        if (result.done || (result.value !== undefined && !result.value)) {
                            top.status = TaskStatus.FINISHED;
                            List.Remove(this._workUnits, top);
                            top.onComplete && top.onComplete(top.name);
                            break;
                        } else if (top.status != TaskStatus.EXECUTING) {
                            break;
                        } else if (result.value == TaskResult.NEXT_FRAME) {
                            return;
                        }
                    }
                    break;
                }
            }
        }
    }

    /**
     * Flushes the top of the queue.
     */
    public FlushTop(): boolean {
        if (this._workUnits.length <= 0) {
            return false;
        }

        const top = this._workUnits[0];
        top.status = TaskStatus.EXECUTING;
        switch (top.type) {
            case TaskMethodType.FUNCTION: {
                const method = (<TaskFunction>top.method);
                let hasMore: boolean;
                while ((hasMore = method.apply(undefined, top.context))) {
                    if ((top.status as TaskStatus) == TaskStatus.INVALID) {
                        return true;
                    } else {
                        top.status == TaskStatus.EXECUTING;
                    }
                }
                top.status = TaskStatus.FINISHED;
                List.Remove(this._workUnits, top);
                top.onComplete && top.onComplete(top.name);
                break;
            }
            case TaskMethodType.GENERATOR: {
                const generator = (<TaskGenerator>top.method);
                let hasMore: boolean;
                while ((hasMore = !(generator.next(top.context)))) {
                    if ((top.status as TaskStatus) == TaskStatus.INVALID) {
                        return true;
                    } else {
                        top.status == TaskStatus.EXECUTING;
                    }
                }
                top.status = TaskStatus.FINISHED;
                List.Remove(this._workUnits, top);
                top.onComplete && top.onComplete(top.name);
                break;
            }
        }
    }

    /**
     * Flushes the whole queue.
     */
    public Flush(): boolean {
        if (this._workUnits.length > 0) {
            while (this._workUnits.length > 0) {
                this.FlushTop();
            }
            return true;
        }

        return false;
    }

    /**
     * Cancels the task with the given id or name.
     */
    public Cancel(taskId: TaskId | string): boolean {
        if (taskId == NullTask) {
            return false;
        }

        const idx = typeof taskId == "string" ? this.TaskIndexWithName(taskId) : this.TaskIndexWithId(taskId);
        if (idx >= 0) {
            this._workUnits[idx].status = TaskStatus.INVALID;
            List.RemoveAt(this._workUnits, idx);
            return true;
        }

        return false;
    }

    /**
     * Cancels all tasks.
     */
    public Clear(): void {
        for (let i = 0, len = this._workUnits.length; i < len; i++) {
            this._workUnits[i].status = TaskStatus.INVALID;
        }
        this._workUnits.length = 0;
    }

    /**
     * Returns the status of a given task.
     */
    public StatusOf(taskId: TaskId | string): TaskStatus {
        const idx = typeof taskId == "string" ? this.TaskIndexWithName(taskId) : this.TaskIndexWithId(taskId);
        if (idx >= 0) {
            return this._workUnits[idx].status;
        } else {
            return TaskStatus.INVALID;
        }
    }

    private TaskIndexWithId(id: TaskId): number {
        for (let i = 0, len = this._workUnits.length; i < len; i++) {
            if (id == this._workUnits[i].id) {
                return i;
            }
        }

        return -1;
    }

    private TaskIndexWithName(name: string): number {
        for (let i = 0, len = this._workUnits.length; i < len; i++) {
            if (name == this._workUnits[i].name) {
                return i;
            }
        }

        return -1;
    }

    private NextId(): TaskId {
        if (this._currentId == Number.MAX_SAFE_INTEGER) {
            return (this._currentId = 1);
        } else {
            return ++this._currentId;
        }
    }
}

function TypeOfMethod(method: TaskMethod): TaskMethodType {
    if (typeof method == "function") {
        return TaskMethodType.FUNCTION;
    } else {
        return TaskMethodType.GENERATOR;
    }
}

function ProcessContextIntoMethodArgs(context: TaskContext): any[] {
    if (typeof context == "undefined") {
        return context;
    } else if (Array.isArray(context)) {
        return context;
    } else {
        return [context];
    }
}

// #endregion // Async Work