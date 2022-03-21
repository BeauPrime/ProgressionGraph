import { Amount, Configuration, NodeAmountCollection, NodeData, UnlockAuto, UnlockManual } from "./Config";
import { CopyModifiers, FillModifierDefaults, RuntimeModifiers } from "./Modifiers";
import { IncrementProperty, List, report, Shuffle, warn } from "./Utils";

export class TraversalState {
    // name of traversal
    public name: string = null;

    // set of unlocked nodes
    public readonly unlocked: Set<string> = new Set();
    
    // status
    public status: NodeAmountCollection = { };
    public addedTokens: NodeAmountCollection = { };
    public consumedTokens: NodeAmountCollection = { };
    
    // set of visited nodes
    public readonly visited: Set<string> = new Set();

    // current available set of nodes
    public readonly available: string[] = [];

    // current hidden set of nodes
    public readonly hidden: string[] = [];

    // history
    public readonly path: TraversalStep[] = [];

    // modifiers
    public readonly modifiers: RuntimeModifiers = {
        tokenAddMultipliers: { },
        tokenConsumeMultipliers: { }
    };
}

export type TraversalStep = {
    id: string,
    changes?: TraversalChange[],
    available: AvailableNodeCount
};

export enum TraversalFlags {
    DEBUG = 0x01
}

export type TraversalChange = {
    id: string,
    adjust: Amount,
    unlock?: boolean
};

export type MissingRequirements = {
    manualUnlock?: boolean,
    ids: string[]
};

export type AvailableNodeCount = {
    [type: string]: number
};

enum ApplyResult {
    NO_CHANGE,
    MODIFIED,
    NEW_ASSET,
    REMOVED_ASSET
};

/**
 * Resets a traversal.
 */
export function TraversalReset(state: TraversalState, config: Configuration, name: string = null, modifiers?: RuntimeModifiers, flags: TraversalFlags = 0): void {
    state.name = name || performance.now().toString();
    state.unlocked.clear();
    state.status = { };
    state.addedTokens = { };
    state.consumedTokens = { };
    state.visited.clear();
    state.available.length = 0;
    state.hidden.length = 0;
    state.path.length = 0;

    Object.assign(state.status, config.startWith);
    
    config.nodes.forEach((n) => {
        if (!state.status[n.id]) {
            state.hidden.push(n.id);
        } else {
            state.visited.add(n.id);
        }
    });

    if (modifiers) {
        CopyModifiers(modifiers, state.modifiers);
    }

    FillModifierDefaults(state.modifiers, config);

    ScanForVisible(state, config, null, flags);
}

/**
 * Takes a traversal step.
 */
export function TraversalPerformStep(state: TraversalState, config: Configuration, flags: TraversalFlags = 0): TraversalStep {
    if (state.available.length == 0) {
        return null;
    }

    // shuffle currently available set
    Shuffle(state.available);

    const id = state.available[0];
    const stepTaken = Visit(state, config, [id], id, null, flags);
    const auto: string[] = [];
    ScanForVisible(state, config, auto, flags);

    if (auto.length > 0) {
        Visit(state, config, auto, id, stepTaken, flags);
    }

    if (stepTaken) {
        SumAvailableNodesByType(state, config, stepTaken.available);
    }

    return stepTaken;
}

/**
 * Retrieves the missing requirements for the given node.
 */
export function GetMissingRequirements(state: TraversalState, config: Configuration, id: string): MissingRequirements {
    const node = config.nodes.get(id);
    if (!node) {
        warn("node with id %1 unable to be found", id);
        return null;
    }

    const missing: MissingRequirements = {
        ids: []
    };

    if (node.unlockType == UnlockManual && !state.unlocked.has(id)) {
        missing.manualUnlock = true;
    }

    for(let i = 0, len = node.requires.length; i < len; i++) {
        const req = node.requires[i];
        if (typeof req.amount == "boolean") {
            if (state.status[req.id] != req.amount) {
                missing.ids.push(req.id);
            }
        } else {
            const val = ResolveValue(state, req.id, req.amount, true);
            if (state.status[req.id] < val) {
                missing.ids.push(req.id);
            }
        }
    }

    return missing;
}

export function StepToString(step: TraversalStep): string {
    let str = step.id;
    if (step.changes && step.changes.length > 0) {
        str += " / ";
        for(let i = 0; i < step.changes.length; i++) {
            const change = step.changes[i];
            if (i > 0) {
                str += ", ";
            }
            str += change.id;
            if (change.unlock) {
                str += " unlocked";
            } else if (typeof change.adjust == "boolean") {
                str += change.adjust ? " added" : " removed";
            } else {
                if (change.adjust > 0) {
                    str += " + " + change.adjust;
                } else {
                    str += " - " + -change.adjust;
                }
            }
        }
    }

    return str;
}

function ScanForVisible(state: TraversalState, config: Configuration, auto?: string[], flags: TraversalFlags = 0): number {
    let changed: number = 0;

    for(let i = state.hidden.length - 1; i >= 0; i--) {
        const id = state.hidden[i]
        const node = config.nodes.get(id);
        if (!node) {
            warn("node with id %1 unable to be found", id);
            continue;
        }

        if (node.unlockType == UnlockManual && !state.unlocked.has(id)) {
            continue;
        }

        if (!SatisfiesRequirements(state, node)) {
            continue;
        }

        List.FastRemoveAt(state.hidden, i);
        state.available.push(id);
        (flags & TraversalFlags.DEBUG) && report("[traversal %1] node %2 became available", state.name, id);
        if (node.unlockType == UnlockAuto && auto) {
            auto.push(id);
        }
        changed++;
    }

    for(let i = state.available.length - 1; i >= 0; i--) {
        const id = state.available[i]
        const node = config.nodes.get(id);

        if (!SatisfiesRequirements(state, node)) {
            List.FastRemoveAt(state.available, i);
            state.hidden.push(id);
            (flags & TraversalFlags.DEBUG) && report("[traversal %1] node %2 became unavailable", state.name, id);
            changed++;
        }
    }

    return changed;
}

function SumAvailableNodesByType(state: TraversalState, config: Configuration, counters: AvailableNodeCount): void {
    for(let i = 0, len = state.available.length; i < len; i++) {
        const id = state.available[i];
        const node = config.nodes.get(id);
        if (node.type) {
            IncrementProperty(counters, node.type, 1);
        }
    }
}

function Visit(state: TraversalState, config: Configuration, visitQueue: string[], rootId: string, step?: TraversalStep, flags: TraversalFlags = 0): TraversalStep {
    const hadStep: boolean = !!step;
    step = step || {
        id: rootId,
        available: { }
    };

    let tookStep: boolean = false;

    while(visitQueue.length > 0) {
        const nodeId = visitQueue.shift();
        if (state.visited.has(nodeId)) {
            continue;
        }

        tookStep = true;
        
        state.visited.add(nodeId);
        state.status[nodeId] = true;
        List.FastRemove(state.hidden, nodeId);
        List.FastRemove(state.available, nodeId);

        (flags & TraversalFlags.DEBUG) && report("[traversal %1] node %2 visited!", state.name, nodeId);

        if (nodeId != rootId && hadStep) {
            AddChangeToStep(step, nodeId, true);
        }

        const node = config.nodes.get(nodeId);
        if (node) {
            if (nodeId == rootId) {
                ApplyRequirements(state, node, step);
            }
            ApplyResults(state, node, step, visitQueue);
        } else {
            warn("node with id %1 unable to be found", nodeId);
        }
    }

    if (tookStep) {
        if (!hadStep) {
            state.path.push(step);
        }
        return step;
    } else {
        return null;
    }
}

function SatisfiesRequirements(state: TraversalState, node: NodeData): boolean {
    for(let i = 0, len = node.requires.length; i < len; i++) {
        const req = node.requires[i];
        if (typeof req.amount == "boolean") {
            if (state.status[req.id] != req.amount) {
                return false;
            }
        } else {
            const val = ResolveValue(state, req.id, req.amount, true);
            if (state.status[req.id] < val) {
                return false;
            }
        }
    }

    return true;
}

function ApplyRequirements(state: TraversalState, node: NodeData, step: TraversalStep): void {
    for(let i = 0, len = node.requires.length; i < len; i++) {
        const req = node.requires[i];
        if (req.consume) {
            const flip = ResolveValue(state, req.id, ToConsume(req.amount));
            ChangeStatus(state, req.id, flip);
            AddChangeToStep(step, req.id, flip);
        }
    }
}

function ApplyResults(state: TraversalState, node: NodeData, step: TraversalStep, visitQueue: string[]): void {
    for(let i = 0, len = node.results.length; i < len; i++) {
        const res = node.results[i];
        if (res.consume) {
            const flip = ResolveValue(state, res.id, ToConsume(res.amount));
            ChangeStatus(state, res.id, flip);
            AddChangeToStep(step, res.id, flip);
        } else if (res.unlock) {
            if (!state.unlocked.has(res.id)) {
                state.unlocked.add(res.id);
                AddChangeToStep(step, res.id, 0, true);
            }
        } else {
            const val = ResolveValue(state, res.id, res.amount);
            const changed = ChangeStatus(state, res.id, val);
            if (changed != ApplyResult.NO_CHANGE) {
                AddChangeToStep(step, res.id, val);
                if (changed == ApplyResult.NEW_ASSET) {
                    visitQueue.push(res.id);
                }
            }
        }
    }
}

function ToConsume(amount: Amount): Amount {
    if (typeof amount == "boolean") {
        return !amount;
    } else {
        return -amount;
    }
}

function ResolveValue(state: TraversalState, id: string, amount: Amount, forceConsume?: boolean): Amount {
    if (typeof amount == "boolean") {
        return amount;
    } else {
        if (forceConsume || amount < 0) {
            return Math.round(amount * state.modifiers.tokenConsumeMultipliers[id]);
        } else {
            return Math.round(amount * state.modifiers.tokenAddMultipliers[id]);
        }
    }
}

function ChangeStatus(state: TraversalState, id: string, amount: Amount): ApplyResult {
    const oldVal = state.status[id];
    if (typeof amount == "boolean") {
        if (oldVal != amount) {
            state.status[id] = amount;
            return amount ? ApplyResult.NEW_ASSET : ApplyResult.REMOVED_ASSET;
        } else {
            return ApplyResult.NO_CHANGE;
        }
    } else {
        const newVal = Math.max(0, <number> oldVal + amount);
        state.status[id] = newVal;
        if (newVal < oldVal) {
            const change = <number> oldVal - newVal;
            IncrementProperty(state.consumedTokens, id, change);
            return ApplyResult.MODIFIED;
        } else if (newVal > oldVal) {
            const change = newVal - <number> oldVal;
            IncrementProperty(state.addedTokens, id, change);
            return ApplyResult.MODIFIED;
        } else {
            return ApplyResult.NO_CHANGE;
        }
    }
}

function AddChangeToStep(step: TraversalStep, id: string, amount: Amount, unlock?: boolean): void {
    const changes = step.changes || (step.changes = []);
    changes.push({
        id: id,
        adjust: amount,
        unlock: unlock
    });
}