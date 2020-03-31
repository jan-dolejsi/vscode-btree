/* --------------------------------------------------------------------------------------------
 * Copyright (c) Jan Dolejsi 2020. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { workspace, ExtensionContext, TextDocumentChangeEvent, TextDocument, commands, Uri, ViewColumn, window, languages, LanguageConfiguration } from 'vscode';
import { BehaviorTreePreviewGenerator } from './BehaviorTreePreviewGenerator';
import { TreeOnTypeFormattingEditProvider } from './TreeOnTypeFormattingEditProvider';
import { TreeParser } from './TreeParser';
import { TreeWorkspaceRegistry } from './TreeWorkspaceRegistry';

const TREE = 'tree';
export const treeWorkspaceRegistry = new TreeWorkspaceRegistry();
export const parser = new TreeParser();

export function activate(context: ExtensionContext) {

    console.log('"vscode-btree" was activated');
    const behaviorTreePreviewGenerator = new BehaviorTreePreviewGenerator(context);

    context.subscriptions.push(workspace.onDidOpenTextDocument((doc: TextDocument) => {
        if (doc.languageId === TREE) {
            validateAndUpdateWorkspace(parser, doc);
        }
    }));

    context.subscriptions.push(workspace.onDidCloseTextDocument((doc: TextDocument) => {
        if (doc.languageId === TREE) {
            parser.clearValidation(doc);
        }
    }));

    // When the active document is changed set the provider for rebuild
    // this only occurs after an edit in a document
    context.subscriptions.push(workspace.onDidChangeTextDocument((e: TextDocumentChangeEvent) => {
        if (e.document.languageId === TREE) {
            behaviorTreePreviewGenerator.setNeedsRebuild(e.document.uri, true);
            validateAndUpdateWorkspace(parser, e.document);
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

    context.subscriptions.push(languages.registerOnTypeFormattingEditProvider(TREE, new TreeOnTypeFormattingEditProvider(), '|', '\n')); // not working '\x08' or \b

    context.subscriptions.push(commands.registerCommand('behaviortree.backspace', TreeOnTypeFormattingEditProvider.backspace));
    context.subscriptions.push(commands.registerCommand('behaviortree.tab', TreeOnTypeFormattingEditProvider.tab));
    context.subscriptions.push(commands.registerCommand('behaviortree.indent', TreeOnTypeFormattingEditProvider.indent));
    context.subscriptions.push(commands.registerCommand('behaviortree.unindent', TreeOnTypeFormattingEditProvider.unindent));

    context.subscriptions.push(languages.setLanguageConfiguration(TREE, languageConfiguration()));
    context.subscriptions.push(previewToSide, preview, behaviorTreePreviewGenerator);

    // when the editor re-opens a workspace, this will re-validate the visible documents
    workspace.textDocuments
        .filter(doc => doc.languageId === TREE)
        .forEach(doc => validateAndUpdateWorkspace(parser, doc));
}

export function validateAndUpdateWorkspace(parser: TreeParser, doc: TextDocument): void {
    const tree = parser.validate(doc);
    treeWorkspaceRegistry.updateWorkspace(doc.uri, tree);
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
export function deactivate() { }

function languageConfiguration(): LanguageConfiguration {
    return {
        brackets: [['(', ')'], ['[', ']']],
        wordPattern: /\w[\w- ]*/,
        comments: {
            lineComment: ';;'
        }
    };
}