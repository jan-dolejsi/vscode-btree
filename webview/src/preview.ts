/* --------------------------------------------------------------------------------------------
 * Copyright (c) Jan Dolejsi 2020. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
    CONDITION, ACTION, RUNNING, FAILED, SUCCESS, BehaviorTree, Node,
} from 'behavior_tree_service';

interface VsCodeApi {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    postMessage(payload: any): void;
}

declare const acquireVsCodeApi: () => VsCodeApi;

declare const showTree: (tree: BehaviorTree,
    hostElement: string,
    onDoubleClick?: (node: Node, shiftKey: boolean) => void,
    onRightClick?: (node: Node) => void)
    => () => void;

let vscode: VsCodeApi | undefined;
try {
    vscode = acquireVsCodeApi();
} catch (error) {
    console.warn(error);
    // swallow, so in the script can be tested in a browser
}

const HOST = "tree";

/** Html element that hosts the tree */
let treeHostElement: HTMLElement | null = null;

/** The instance of the tree that is being displayed */
let displayedTree: BehaviorTree | undefined;

/** Function to refresh the tree visualization. */
let treeRefresh: () => void | undefined;

window.addEventListener('message', event => {
    const message = event.data;

    switch (message.command) {
        case 'treeChanged':
            showUpdatedTree(message.tree);
            break;
        default:
            console.error("Unexpected message: " + message.command);
    }
});

function postCommand(command: string): void {
    postMessage({ 'command': command });
}

function postMessage(message: unknown): void {
    if (vscode) { vscode.postMessage(message); }
}

export function initialize(): void {
    treeHostElement = document.getElementById(HOST);
    if (!treeHostElement) {
        console.error(`Cannot find any '${HOST}' element in the document.`);
        return;
    }

    if (!vscode) { populateWithTestData(); }
    postCommand('initialized');
}

window.document.body.onload = initialize;

function nodeDoubleClicked(node: Node, shiftKey: boolean): void {
    if (displayedTree) {
        switch (node.kind) {
            case CONDITION:
                const conditionStatus = node.hasNot ? 1 - node.status() : node.status();
                displayedTree.setConditionStatus(node.name, 1 - conditionStatus);
                if (treeRefresh) {
                    treeRefresh();
                }
                break;
            case ACTION:
                const previousActionStatus = displayedTree.getActionStatus(node.name);

                const newValue = previousActionStatus === RUNNING ?
                    (shiftKey ? FAILED : SUCCESS) :
                    RUNNING;

                displayedTree.setActionStatus(node.name, newValue);
                if (treeRefresh) {
                    treeRefresh();
                }
                break;
        }
    }
}

function renderBehaviorTree(tree: BehaviorTree): void {
    if (treeHostElement) {
        displayedTree = tree;
        treeRefresh = showTree(tree, treeHostElement.tagName, nodeDoubleClicked);
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function showUpdatedTree(treeAsJson: any): void {
    const tree = BehaviorTree.fromJson(treeAsJson);
    if (tree.error) {
        console.error(`Tree parsing error: ${tree.error} on line ${tree.line}.`);
    }
    renderBehaviorTree(tree);
}

function populateWithTestData(): void {
    const tree = BehaviorTree.fromText(`->
    |   [Action1]
    |   (Condition1)`);
    renderBehaviorTree(tree);
}
