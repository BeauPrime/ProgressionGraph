import { Configuration } from "./Config";
import { AssignDefault } from "./Utils";

export type MultiplierSet = {
    [id: string]: number
};

export type RuntimeModifiers = {
    tokenAddMultipliers?: MultiplierSet;
    tokenConsumeMultipliers?: MultiplierSet;
}

/**
 * Resets all modifiers to default values.
 */
export function ResetModifiers(modifiers: RuntimeModifiers, config: Configuration) {
    modifiers.tokenAddMultipliers = { };
    modifiers.tokenConsumeMultipliers = { };

    for(let i = 0, len = config.tokenIds.length; i < len; i++) {
        const id = config.tokenIds[i];
        modifiers.tokenAddMultipliers[id] = 1;
        modifiers.tokenConsumeMultipliers[id] = 1;
    }
}

/**
 * Fills in modifier defaults.
 */
export function FillModifierDefaults(modifiers: RuntimeModifiers, config: Configuration) {
    modifiers.tokenAddMultipliers = modifiers.tokenAddMultipliers || { };
    modifiers.tokenConsumeMultipliers = modifiers.tokenConsumeMultipliers || { };
    for(let i = 0, len = config.tokenIds.length; i < len; i++) {
        const id = config.tokenIds[i];
        AssignDefault(modifiers.tokenAddMultipliers, id, 1);
        AssignDefault(modifiers.tokenConsumeMultipliers, id, 1);
    }
}

/**
 * Copies modifiers from one source to another.
 */
export function CopyModifiers(source: RuntimeModifiers, target?: RuntimeModifiers): RuntimeModifiers {
    if (!target) {
        target = { tokenAddMultipliers: { }, tokenConsumeMultipliers: { }};
    } else {
        target.tokenAddMultipliers = { };
        target.tokenConsumeMultipliers = { };
    }

    Object.assign(target.tokenAddMultipliers, source.tokenAddMultipliers);
    Object.assign(target.tokenConsumeMultipliers, source.tokenConsumeMultipliers);

    return target;
}