/* --------------------------------------------------------------------------------------------
 * Copyright (c) Jan Dolejsi 2020. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import { workspace, ExtensionContext, TextDocumentChangeEvent, TextDocument, commands, Uri, ViewColumn, window, languages, LanguageConfiguration } from 'vscode';
import { BehaviorTreePreviewGenerator } from './BehaviorTreePreviewGenerator';
import { TreeOnTypeFormattingEditProvider } from './TreeOnTypeFormattingEditProvider';
import { TreeParser } from './TreeParser';
import { TreeWorkspaceRegistry } from './TreeWorkspaceRegistry';
import { TreeCompletionItemProvider } from './TreeCompletionItemProvider';
import { TreeCodeActionProvider, DiagnosticCode } from './TreeCodeActionProvider';

export const TREE = 'tree';
export const parser = new TreeParser();
export const treeWorkspaceRegistry = new TreeWorkspaceRegistry(parser);

export function activate(context: ExtensionContext): void {

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
        const treeDocument = await getTreeDocument(treeDocumentUri);
        if (treeDocument) {
            return behaviorTreePreviewGenerator.revealOrCreatePreview(treeDocument, ViewColumn.Beside);
        }
    });

    const preview = commands.registerCommand("behaviortree.preview", async (treeDocumentUri: Uri) => {
        const treeDocument = await getTreeDocument(treeDocumentUri);
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

    const completionItemProvider = new TreeCompletionItemProvider(treeWorkspaceRegistry);
    languages.registerCompletionItemProvider(TREE, completionItemProvider, '(', '[');

    context.subscriptions.push(commands.registerCommand(TreeCodeActionProvider.DECLARE_ALL, (documentUri?: Uri) => {
        if (!documentUri) {
            if (window.activeTextEditor) {
                addAllUndeclaredToManifest(window.activeTextEditor.document.uri);
            }
            else {
                window.showErrorMessage('No tree opened');
            }
        }
        else {
            addAllUndeclaredToManifest(documentUri);
        }
    }));

    context.subscriptions.push(languages.registerCodeActionsProvider(TREE,
        new TreeCodeActionProvider(treeWorkspaceRegistry)));
    
    context.subscriptions.push(commands.registerCommand(TreeCodeActionProvider.DECLARE_ACTION, (diagCode: DiagnosticCode) => {
        diagCode.treeWorkspace.addDeclaredAction(diagCode.undeclaredName);
    }));
    context.subscriptions.push(commands.registerCommand(TreeCodeActionProvider.DECLARE_CONDITION, (diagCode: DiagnosticCode) => {
        diagCode.treeWorkspace.addDeclaredCondition(diagCode.undeclaredName);
    }));

    // when the editor re-opens a workspace, this will re-validate the visible documents
    workspace.textDocuments
        .filter(doc => doc.languageId === TREE)
        .forEach(doc => validateAndUpdateWorkspace(parser, doc));
}

export function validateAndUpdateWorkspace(parser: TreeParser, doc: TextDocument): void {
    const tree = parser.parseAndValidate(doc);
    treeWorkspaceRegistry.updateWorkspace(doc, tree);
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
// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate(): void { }

function languageConfiguration(): LanguageConfiguration {
    return {
        brackets: [['(', ')'], ['[', ']']],
        wordPattern: /\w[\w- ]*/,
        comments: {
            lineComment: ';;'
        }
    };
}

function addAllUndeclaredToManifest(uri: Uri): void {
    const folderName = path.dirname(uri.fsPath);
    const folder = treeWorkspaceRegistry.getWorkspace(folderName);

    if (!folder) {
        window.showErrorMessage(`No Trees in the folder ${folderName}`);
    }
    else {
        folder.addAllUndeclared(uri);
    }
}