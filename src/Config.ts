// #region Typedefs

import { AssignDefault, sprintf, warn } from "./Utils";

/**
 * A tracked amount of a node.
 * Either a boolean or a number.
 */
export type Amount = number | boolean;

export const UnlockTraverse: string = "traverse";
export const UnlockManual: string = "manual";
export const UnlockAuto: string = "auto";

/**
 * How this node is unlocked.
 */
export type UnlockType = "traverse" | "manual" | "auto";

/**
 * A reference to a node, with amounts specified
 * and whether or not that amount will be consumed.
 */
export type NodeRef = {
    id: string,
    amount: Amount,
    consume: boolean,
    unlock: boolean
};

/**
 * Node information.
 */
export type NodeData = {
    id: string,
    type?: string,
    isToken: boolean,
    disableTraversal: boolean,
    unlockType: UnlockType,
    requires: NodeRef[],
    results: NodeRef[]
};

/**
 * Collection of node amounts.
 */
export type NodeAmountCollection = {
    [id: string] : Amount
};

/**
 * Callback for exporting token amounts.
 */
export type NodeReportTokensCallback = (amounts: NodeAmountCollection) => string;

type ConfigJSON = {
    nodes: { [id: string]: NodeData },
    startWith?: NodeAmountCollection
};

// #endregion // Typedefs

export class Configuration {

    /**
     * Map of all nodes.
     */
    public readonly nodes: Map<string, NodeData> = new Map();

    /**
     * Map of all tokens.
     */
    public readonly tokens: Map<string, NodeData> = new Map();

    /**
     * Identifiers of all tokens.
     */
    public readonly tokenIds: string[] = [];

    /**
     * Token replace format.
     */
    public ReportTokens: NodeReportTokensCallback;
    
    /**
     * Set of nodes a traversal starts with.
     */
    public readonly startWith: NodeAmountCollection = { };

    /**
     * Set of node ids that will not be manually traversed.
     */
    public readonly disableManualTraversal: Set<string> = new Set();
}

/**
 * Parses configuration JSON into a usable configuration object.
 */
export function ParseConfig(data: string) : Configuration {
    const parsedJSON: ConfigJSON = JSON.parse(data);

    const config = new Configuration();

    if (parsedJSON.startWith) {
        Object.assign(config.startWith, parsedJSON.startWith);
    }

    if (!parsedJSON.nodes) {
        warn("Unrecognized format");
        return null;
    }

    for(let [key, value] of Object.entries(parsedJSON.nodes)) {
        ApplyDefaultsToNode(value, key);
        if (value.isToken) {
            config.tokens.set(value.id, value);
            config.tokenIds.push(value.id);
            AssignDefault(config.startWith, value.id, 0);
        } else {
            config.nodes.set(value.id, value);
        }

        if (value.disableTraversal) {
            config.disableManualTraversal.add(value.id);
        }
    }

    config.ReportTokens = GetTokenReportCallback(config);

    return config;
}

/**
 * Applies default values to the given node's data.
 */
function ApplyDefaultsToNode(node: NodeData, id: string) {
    AssignDefault(node, "id", id);
    AssignDefault(node, "unlockType", UnlockTraverse);
    AssignDefault(node, "isToken", false);
    AssignDefault(node, "disableTraversal", false);

    if (!node.requires) {
        node.requires = [];
    } else {
        for(var i = 0, len = node.requires.length; i < len; i++) {
            ApplyDefaultsToRef(node.requires[i]);
        }
    }
    if (!node.results) {
        node.results = [];
    } else {
        for(var i = 0, len = node.results.length; i < len; i++) {
            ApplyDefaultsToRef(node.results[i]);
        }
    }
}

/**
 * Applies default values to the given node reference.
 */
function ApplyDefaultsToRef(ref: NodeRef) {
    AssignDefault(ref, "amount", true);
    AssignDefault(ref, "consume", false);
    AssignDefault(ref, "unlock", false);
}

/**
 * Generates a token state reporting callback.
 */
function GetTokenReportCallback(config: Configuration): NodeReportTokensCallback {
    const tokenCount = config.tokenIds.length;
    if (tokenCount == 0) {
        return (s) => "[No Tokens Defined]";
    }
    let segments: string[] = new Array(tokenCount);
    for(let i = 0; i < tokenCount; i++) {
        segments[i] = config.tokenIds[i] + ": %" + (i + 1).toString();
    }

    const full = segments.join(" / ");
    const buffer: Amount[] = new Array(config.tokenIds.length);
    return (status) => {
        for(let i = 0; i < tokenCount; i++) {
            buffer[i] = status[config.tokenIds[i]];
        }
        return sprintf(full, buffer);
    };
}