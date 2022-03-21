import { Amount } from "./Config";
import { TraversalState } from "./Traverse";
import { List } from "./Utils";

type Counter = {
    sum: number,
    values: number[]
}

type CounterMap = {
    [id: string]: Counter
};

export type Statistic = {
    mean: number,
    median: number,
    mode: number
};

export type StatisticMap = {
    [id: string]: Statistic
};

export class AggregateState {
    public steps: CounterMap = { };
    public open: CounterMap = { };
    public addedTokens: CounterMap = { };
    public consumedTokens: CounterMap = { };
    public endState: CounterMap = { };
    public unfinished: CounterMap = { };
    public sampleCount: number = 0;
    public stepCount: number = 0;
};

export type AggregateStatistics = {
    steps: StatisticMap,
    open: StatisticMap,
    addedTokens: StatisticMap,
    consumedTokens: StatisticMap,
    endState: StatisticMap,
    unfinished: StatisticMap,
    sampleCount: number,
    stepCount: number
};

export function ResetAggregator(aggregator: AggregateState) {
    aggregator.steps = { };
    aggregator.open = { };
    aggregator.endState = { };
    aggregator.addedTokens = { };
    aggregator.consumedTokens = { };
    aggregator.unfinished = { };
    aggregator.sampleCount = 0;
    aggregator.stepCount = 0;
}

export function AggregateTraversal(aggregator: AggregateState, state: TraversalState): void {
    for(let i = 0, len = state.path.length; i < len; i++) {
        const step = state.path[i];
        const key = i > 0 ? state.path[i - 1].id.concat("->", step.id) : step.id;
        AddKeyedCounter(aggregator.steps, key, 1);
        for(const [key, val] of Object.entries(step.available)) {
            AddKeyedCounter(aggregator.open, key, val);
        }
        aggregator.stepCount++;
    }
    for(const [key, val] of Object.entries(state.status)) {
        AddKeyedCounter(aggregator.endState, key, ConvertAmount(val));
    }
    for(const key of state.hidden) {
        AddKeyedCounter(aggregator.unfinished, key, 1);
    }
    for(const [key, value] of Object.entries(state.addedTokens)) {
        AddKeyedCounter(aggregator.addedTokens, key, <number> value);
    }
    for(const [key, value] of Object.entries(state.consumedTokens)) {
        AddKeyedCounter(aggregator.consumedTokens, key, <number> value);
    }
    aggregator.sampleCount++;
}

export function AggregateProcess(aggregator: AggregateState): AggregateStatistics {
    if (aggregator.sampleCount == 0) {
        return null;
    }

    const stats: AggregateStatistics = {
        steps: { },
        open: { },
        addedTokens: { },
        consumedTokens: { },
        endState: { },
        unfinished: { },
        sampleCount: aggregator.sampleCount,
        stepCount: aggregator.stepCount
    };

    Average(aggregator.steps, stats.steps, aggregator.sampleCount);
    Average(aggregator.open, stats.open, aggregator.stepCount);
    Average(aggregator.addedTokens, stats.addedTokens, aggregator.sampleCount);
    Average(aggregator.consumedTokens, stats.consumedTokens, aggregator.sampleCount);
    Average(aggregator.endState, stats.endState, aggregator.sampleCount);
    Average(aggregator.unfinished, stats.unfinished, aggregator.sampleCount);

    return stats;
}

function Average(counters: CounterMap, statistics: StatisticMap, sampleCount: number): void {
    for(const [key, val] of Object.entries(counters)) {
        const statVal = statistics[key] = {
            mean: 0,
            median: 0,
            mode: 0
        };

        let needsZero = sampleCount - val.values.length;
        while(needsZero-- > 0) {
            val.values.unshift(0);
        }
        List.ValueSort(val.values);

        statVal.mean = val.sum / sampleCount;
        statVal.median = val.values[(val.values.length / 2) | 0];
        statVal.mode = FindMode(val.values);
    }
}

function FindMode(values: number[]): number {
    let commonVal: number | null = null;
    let commonCount: number = 0;

    let currentVal: number;
    let currentCount: number = 0;
    for(let i = 0, len = values.length; i < len; i++) {
        const now = values[i];
        if (now != currentVal) {
            currentVal = now;
            currentCount = 0;
        }
        currentCount++;
        if (currentCount > commonCount) {
            commonCount = currentCount;
            commonVal = now;
        }
    }

    return commonVal;
}

function AddKeyedCounter(map: CounterMap, id: string, value: number = 1) {
    const counter = map[id] || (map[id] = { sum: 0, values: [] });
    counter.sum += value;
    counter.values.push(value);
}

function ConvertAmount(amount: Amount): number {
    if (amount === undefined) {
        return 0;
    } else if (typeof amount == "boolean") {
        return amount ? 1 : 0;
    } else {
        return amount;
    }
}