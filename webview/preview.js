//@ts-check

var vscode = null;
try {
    vscode = acquireVsCodeApi();
} catch (error) {
    console.warn(error);
    // swallow, so in the script can be tested in a browser
}

const HOST = "tree";

/** @type {HTMLElement} Html element that hosts the tree */
var TREE_EL = undefined;

/** @type {BehaviorTree} */
var displayedTree = undefined;

/** @type {() => void} */
var treeRefresh = undefined;

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

function postCommand(command) {
    postMessage({ 'command': command });
}

function postMessage(message) {
    if (vscode) { vscode.postMessage(message); }
}

function initialize() {
    TREE_EL = document.getElementById(HOST);
    if (!TREE_EL) {
        console.error(`Cannot find any '${HOST}' element in the document.`);
        return;
    }

    if (!vscode) { populateWithTestData(); }
    postCommand('initialized');
}

function nodeDoubleClicked(node, shiftKey) {
    if (displayedTree) {
        switch (node.kind) {
            case CONDITION:
                displayedTree.setConditionStatus(node.name, 1 - node.status());
                if (treeRefresh) {
                    treeRefresh();
                };
                break;
            case ACTION:
                const previousActionStatus = displayedTree.getActionStatus(node.name);

                var newValue = -1;
                if (previousActionStatus === RUNNING) {
                    newValue = shiftKey ? FAILED : SUCCESS;
                } else {
                    newValue = RUNNING;
                }

                displayedTree.setActionStatus(node.name, newValue);
                if (treeRefresh) {
                    treeRefresh();
                };
                break;
        }
    }
}

function renderBehaviorTree(tree) {
    displayedTree = tree;
    treeRefresh = showTree(tree, TREE_EL, nodeDoubleClicked);
}

function showUpdatedTree(treeAsJson) {
    const tree = BehaviorTree.fromJson(treeAsJson);
    if (tree.error) {
        console.error(`Tree parsing error: ${tree.error} on line ${tree.line}.`);
    }
    renderBehaviorTree(tree);
}

function populateWithTestData() {
    const tree = BehaviorTree.fromText(`->
    |   [Action1]
    |   (Condition1)`);
    renderBehaviorTree(tree);
}
