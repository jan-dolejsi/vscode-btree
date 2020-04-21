/* --------------------------------------------------------------------------------------------
 * Copyright (c) Jan Dolejsi 2020. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as jsonc from 'jsonc-parser';
import { TextDocument, Range } from 'vscode';

export function throwForUndefined<T>(part: string): T {
    throw new Error(`No ${part} defined.`);
}

export function assertDefined<T>(value: T | undefined, message: string): T {
    if (value === undefined || value === null) {
        throw new Error("Assertion error: " + message);
    }
    else {
        return value;
    }
}


export function jsonNodeToRange(document: TextDocument, node: jsonc.Node): Range {
    return new Range(
        document.positionAt(node.offset),
        document.positionAt(node.offset + node.length));
}
