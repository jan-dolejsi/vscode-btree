/* --------------------------------------------------------------------------------------------
 * Copyright (c) Jan Dolejsi 2020. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { workspace, ExtensionContext, TextDocumentChangeEvent, TextDocument, commands, Uri, ViewColumn, window } from 'vscode';
import { BehaviorTreePreviewGenerator } from './BehaviorTreePreviewGenerator';

const TREE = 'tree';

export function activate(context: ExtensionContext) {

	console.log('"vscode-btree" was activated');
    const behaviorTreePreviewGenerator = new BehaviorTreePreviewGenerator(context);

    // When the active document is changed set the provider for rebuild
    // this only occurs after an edit in a document
    context.subscriptions.push(workspace.onDidChangeTextDocument((e: TextDocumentChangeEvent) => {
        if (e.document.languageId === TREE) {
            behaviorTreePreviewGenerator.setNeedsRebuild(e.document.uri, true);
        }
    }));

	context.subscriptions.push(workspace.onDidSaveTextDocument((doc: TextDocument) => {
		if (doc.languageId === TREE) {
			behaviorTreePreviewGenerator.setNeedsRebuild(doc.uri, true);
		}
	}));

	const previewToSide = commands.registerCommand("behaviortree.previewToSide", async (treeDocumentUri: Uri) => {
		let treeDocument = await getTreeDocument(treeDocumentUri);
		if (treeDocument) {
			return behaviorTreePreviewGenerator.revealOrCreatePreview(treeDocument, ViewColumn.Beside);
		}
	});

	const preview = commands.registerCommand("behaviortree.preview", async (treeDocumentUri: Uri) => {
		let treeDocument = await getTreeDocument(treeDocumentUri);
		if (treeDocument) {
			return behaviorTreePreviewGenerator.revealOrCreatePreview(treeDocument, ViewColumn.Active);
		}
	});

    context.subscriptions.push(previewToSide, preview, behaviorTreePreviewGenerator);
}

async function getTreeDocument(treeDocumentUri: Uri | undefined): Promise<TextDocument | undefined> {
    if (treeDocumentUri) {
        return await workspace.openTextDocument(treeDocumentUri);
    } else {
        if (window.activeTextEditor?.document.languageId === TREE) {
            return window.activeTextEditor.document;
        }
        else {
            return undefined;
        }
    }
}

// this method is called when your extension is deactivated
export function deactivate() {}
