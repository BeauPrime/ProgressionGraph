import Swal from "sweetalert2";
import { Configuration, ParseConfig } from "./Config";
import { AlphabetCompare, DefaultCompare, List, OnAnimationFrame, OnPageClose, OnPageLoad, report, sprintf, TaskId, TaskQueue, TaskResult } from "./Utils";
import { ReadFileAsText } from "./File"
import { TraversalReset, TraversalState, TraversalPerformStep, TraversalStep, GetMissingRequirements, StepToString, TraversalFlags } from "./Traverse";
import { LogError, LogFlush, LogInitialize, LogReset, LogWarn, LogWrite } from "./Interface";
import { AggregateProcess, AggregateState, AggregateStatistics, AggregateTraversal, Statistic } from "./Analysis";
import { CopyModifiers, RuntimeModifiers } from "./Modifiers";

let loadedConfig: Configuration = null;
let configButton: HTMLButtonElement;
let runButton: HTMLButtonElement;
let runFullButton: HTMLButtonElement;
let sampleCountInput: HTMLInputElement;
let showPathInput: HTMLInputElement;

let runQueue: TaskQueue;
let currentRun: TaskId = 0;

let modifiers: RuntimeModifiers = {};

OnPageLoad(() => {
    LogInitialize();
    LogReset();
    
    runQueue = new TaskQueue();

    configButton = <HTMLButtonElement> document.getElementById("button-config");
    runButton = <HTMLButtonElement> document.getElementById("button-run");
    runFullButton = <HTMLButtonElement> document.getElementById("button-silentRun");
    sampleCountInput = <HTMLInputElement> document.getElementById("input-sampleSize");
    showPathInput = <HTMLInputElement> document.getElementById("input-showPathToggle");
    
    configButton.onclick = OnConfigClicked;
    runButton.onclick = OnRunClicked;
    runFullButton.onclick = OnRunSilentClicked;
    runButton.disabled = true;
    runFullButton.disabled = true;

    const clearBtn = <HTMLButtonElement> document.getElementById("button-clear")
    clearBtn.onclick = () => LogReset();

    OnAnimationFrame((dt) => {
        runQueue.Tick(dt * 0.5);
        LogFlush();
    }, 50);

    LogWrite("---- Progression Graph (v0.1.1) ---- ");
    LogWrite("---- © 2022, Autumn Beauchesne ----- ");
    LogWrite("\n\nClick on 'Load Configuration' to start!");
});

OnPageClose(() => {
    LogReset();
    runQueue.Cancel(currentRun);
    currentRun = null;
});

function OnConfigClicked() {
    Swal.fire({
        "titleText": "Select a Progression JSON to import",
        "input": "file",
        "inputAttributes": {
            'accept': ".json",
            "aria-label": "Upload your Progression JSON"
        }
    }).then((result) => {
        const file: File = result.value;
        file && ReadFileAsText(file, OnConfigurationRead);
    });
}

function OnRunClicked() {
    if (!loadedConfig) {
        LogWrite("No configuration loaded!");
        return;
    }

    runQueue.Cancel(currentRun);

    const state: TraversalState = new TraversalState();
    TraversalReset(state, loadedConfig, null, modifiers, TraversalFlags.DEBUG);

    LogWrite("-- Starting traversal steps --");

    currentRun = runQueue.ScheduleWithContext(RunStep, state);
}

function OnRunSilentClicked() {
    if (!loadedConfig) {
        LogWrite("No configuration loaded!");
        return;
    }

    if (!sampleCountInput.validity.valid) {
        Swal.fire({
            icon: 'error',
            title: 'Cannot run samples',
            text: 'Make sure you specify a valid number of samples'
        });
        return;
    }

    runQueue.Cancel(currentRun);
    currentRun = runQueue.Schedule(RunAggregateTrial(sampleCountInput.valueAsNumber, modifiers), "Aggregate Trial");
}

function RunStep(state: TraversalState): boolean {
    LogWrite("<b>Current Status at %1:</b>", state.path.length);
    LogWrite("> %1", loadedConfig.ReportTokens(state.status));
    const step = TraversalPerformStep(state, loadedConfig, TraversalFlags.DEBUG);
    if (step != null) {
        LogWrite("<i>Step %1:</i> %2", state.path.length, StepToString(step));
        return true;
    } else {
        state.hidden.sort(AlphabetCompare);
        LogWrite("Finished with %1 unvisited nodes!", state.hidden.length);
        for(const [id, status] of Object.entries(state.status)) {
            LogWrite("<b>State></b> %1: %2", id, status);
        }
        for(const id of state.hidden) {
            const missing = GetMissingRequirements(state, loadedConfig, id);
            if (missing.manualUnlock) {
                LogError("<i>Unvisited></i> %1: Needed Manual Unlock, %2", id, missing.ids.join(", "));
            } else {
                LogError("<i>Unvisited></i> %1: Needed %2", id, missing.ids.join(", "));
            }
        }
        return false;
    }
}

function* RunAggregateTrial(count: number, modifiers: RuntimeModifiers) {
    const state: TraversalState = new TraversalState();
    const agg: AggregateState = new AggregateState();
    const localModifiers = CopyModifiers(modifiers);
    const showPaths = showPathInput.checked;
    
    let increment: number;
    if (count <= 100) {
        increment = 10;
    } else if (count <= 1000) {
        increment = 100;
    } else if (count < 10000) {
        increment = 500;
    } else {
        increment = 1000
    }

    LogWrite("-- Starting aggregate --");

    let total: number = 0;
    while(total++ < count) {
        TraversalReset(state, loadedConfig, null, localModifiers);
        while(TraversalPerformStep(state, loadedConfig)) {
            yield;
        }
        AggregateTraversal(agg, state);
        if ((total % increment) == 0) {
            LogWrite("Finished sample %1", total);
            yield TaskResult.NEXT_FRAME;
        } else {
            yield;
        }
    }

    LogWrite("Finished generating %1 samples; Aggregating results...", count);
    yield TaskResult.NEXT_FRAME;
    const result = AggregateProcess(agg);
    console.log(result);
    yield TaskResult.NEXT_FRAME;
    LogWrite("Aggregation complete - check the debug console for the full json object", count);
    LogWrite("\n-- Results --");
    yield;
    for(const [key, value] of Object.entries(result.open)) {
        LogWrite("Open <b>%1</b> nodes: Mean %2 / Median %3 / Mode %4 / Min %5 / Max %6", key,
            value.mean.toFixed(2), value.median.toFixed(0), value.mode.toFixed(0), value.min.toFixed(0), value.max.toFixed(0));
    }
    yield;
    const tokenEntries: TokenStatEntry[] = [];
    const completeEntries: NodeStatEntry[] = [];
    const unfinishedEntries: NodeStatEntry[] = [];
    const commonPaths: NodeStatEntry[] = [];
    for(const [key, value] of Object.entries(result.endState)) {
        if (List.Has(loadedConfig.tokenIds, key)) {
            tokenEntries.push({id: key, stat: value, added: result.addedTokens[key], consumed: result.consumedTokens[key]});
        } else {
            completeEntries.push({id: key, percentage: Math.floor(value.mean * 100)});
        }
    }

    for(const [key, value] of Object.entries(result.unfinished)) {
        unfinishedEntries.push({id: key, percentage: Math.ceil(value.mean * 100)});
    }
    yield;

    if (showPaths) {
        for(const [key, value] of Object.entries(result.steps)) {
            commonPaths.push({id: key, percentage: Math.ceil(value.mean * 100)});
        }
        yield;
    }

    yield;
    tokenEntries.sort((a, b) => {
        return b.stat.mean - a.stat.mean;
    });
    yield;
    completeEntries.sort((a, b) => {
        if (b.percentage == a.percentage) {
            return AlphabetCompare(a.id, b.id);
        } else {
            return b.percentage - a.percentage;
        }
    });
    yield;
    unfinishedEntries.sort((a, b) => {
        if (b.percentage == a.percentage) {
            return AlphabetCompare(a.id, b.id);
        } else {
            return b.percentage - a.percentage;
        }
    });
    yield;
    if (showPaths) {
        commonPaths.sort((a, b) => {
            if (b.percentage == a.percentage) {
                return AlphabetCompare(a.id, b.id);
            } else {
                return b.percentage - a.percentage;
            }
        });
        yield;
    }

    LogWrite("");
    for(const token of tokenEntries) {
        LogWrite("<b>%1</b> Final: Mean %2 / Median %3 / Mode %4 / Min %5 / Max %6", token.id,
            token.stat.mean.toFixed(2), token.stat.median, token.stat.mode, token.stat.min, token.stat.max);
        if (token.added) {
            LogWrite("> Added: Mean %2 / Median %3 / Mode %4 / Min %5 / Max %6", token.id,
                token.added.mean.toFixed(2), token.added.median, token.added.mode, token.stat.min, token.stat.max);
        }
        if (token.consumed) {
            LogWrite("> Consumed: Mean %2 / Median %3 / Mode %4 / Min %5 / Max %6", token.id,
                token.consumed.mean.toFixed(2), token.consumed.median, token.consumed.mode, token.stat.min, token.stat.max);
        }
    }
    yield TaskResult.NEXT_FRAME;
    
    LogWrite("\n-- %1 nodes completed", completeEntries.length);
    for(const node of completeEntries) {
        if (node.percentage < 100) {
            LogWarn("<b>%1</b> Completed: %2%", node.id, node.percentage);
        } else {
            LogWrite("<b>%1</b> Completed: %2%", node.id, node.percentage);
        }
    }
    yield TaskResult.NEXT_FRAME;

    LogWrite("\n-- %1 nodes unfinished", unfinishedEntries.length);
    for(const node of unfinishedEntries) {
        if (node.percentage < 100) {
            LogWarn("<b>%1</b> Unfinished: %2%", node.id, node.percentage);
        } else {
            LogError("<b>%1</b> Unfinished: %2%", node.id, node.percentage);
        }
    }
    yield TaskResult.NEXT_FRAME;

    if (showPaths) {
        LogWrite("\n-- %1 paths traversed", commonPaths.length);
        for(const node of commonPaths) {
            const sections = node.id.split("->");
            if (sections.length > 1) {
                LogWrite("<b>%1 to %2</b>: %3%", sections[0], sections[1], node.percentage);
            } else {
                LogWrite("<b>%1</b>: %2%", node.id, node.percentage);
            }
        }
    }
}

type TokenStatEntry = {
    id: string,
    stat: Statistic,
    added: Statistic,
    consumed: Statistic
};

type NodeStatEntry = {
    id: string,
    percentage: number
};

function OnConfigurationRead(txt: string): void {
    let config:Configuration;
    try {
        config = ParseConfig(txt);
        if (!config) {
            Swal.fire({
                icon: 'error',
                title: 'Could not load config',
                text: 'Your file was unable to be parsed into a progression JSON.\nCheck that you are uploading the right file'
            });
            return;
        }
    } catch(e) {
        Swal.fire({
            icon: 'error',
            title: 'Could not load config',
            text: sprintf("An error occurred: %1\nCheck that you are uploading the right file", e)
        });
        return;
    }

    const hadConfig = !!loadedConfig;
    loadedConfig = config;
    LogWrite("Loaded configuration: %1 nodes, %2 tokens", config.nodes.size, config.tokens.size);
    runButton.disabled = false;
    runFullButton.disabled = false;
    if (!hadConfig) {
        LogWrite("\n -- Testing Instructions --");
        LogWrite("Click 'Test (Debug)' to run a single trial");
        LogWrite("Click 'Run (Aggregate)' to run an aggregate trial");
        LogWrite("Adjust 'Sample Size' to change the number of samples");
    }
}