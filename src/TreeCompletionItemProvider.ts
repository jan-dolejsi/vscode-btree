/* --------------------------------------------------------------------------------------------
 * Copyright (c) Jan Dolejsi 2020. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';
import * as path from 'path';
import { CompletionItemProvider, TextDocument, Position, CancellationToken, CompletionContext, ProviderResult, CompletionItem, CompletionList, CompletionItemKind, CompletionTriggerKind } from 'vscode';
import { TreeWorkspaceRegistry } from './TreeWorkspaceRegistry';

export class TreeCompletionItemProvider implements CompletionItemProvider {
    constructor(private treeWorkspaceRegistry: TreeWorkspaceRegistry) {

    }

    provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): CompletionItem[] | undefined {
        let folderPath = path.dirname(document.uri.fsPath);
        let workspace = this.treeWorkspaceRegistry.getWorkspace(folderPath);

        if (!workspace) { return undefined; }

        if (context.triggerKind === CompletionTriggerKind.Invoke) {
            const controlNodes = ['?', '->', '=N']
                .map(node => new CompletionItem(node, CompletionItemKind.Operator));

            const conditions = (workspace.getConditionsDeclared() ?? workspace.getConditionsUsed())
                .map(condition => `(${condition})`)
                .map(condition => new CompletionItem(condition, CompletionItemKind.Field));

            const actions = (workspace.getActionsDeclared() ?? workspace.getActionsUsed())
                .map(action => `[${action}]`)
                .map(action => new CompletionItem(action, CompletionItemKind.Method));
            return controlNodes.concat(conditions).concat(actions);
        }

        switch (context.triggerCharacter) {
            case '(':
                return (workspace.getConditionsDeclared() ?? workspace.getConditionsUsed())
                    .map(condition => new CompletionItem(condition, CompletionItemKind.Field));
            case '[':
                return (workspace.getActionsDeclared() ?? workspace.getActionsUsed())
                    .map(action => new CompletionItem(action, CompletionItemKind.Method));
        }
    }

}