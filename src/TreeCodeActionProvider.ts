/* --------------------------------------------------------------------------------------------
 * Copyright (c) Jan Dolejsi 2020. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';
import { CodeActionProvider, TextDocument, Range, Selection, CodeActionContext, CancellationToken, ProviderResult, Command, CodeAction, Diagnostic, Uri, CodeActionKind } from 'vscode';
import { TreeWorkspaceRegistry } from './TreeWorkspaceRegistry';
import { TreeWorkspace } from './TreeWorkspace';

export class TreeCodeActionProvider implements CodeActionProvider {
    public static readonly DECLARE_ACTION = 'behaviortree.declareAction';
    public static readonly DECLARE_CONDITION = 'behaviortree.declareCondition';
    public static readonly DECLARE_ALL = 'behaviortree.addAllUndeclaredToManifest';

    constructor(private treeWorkspaceRegistry: TreeWorkspaceRegistry) {

    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    provideCodeActions(document: TextDocument, range: Range | Selection, context: CodeActionContext, token: CancellationToken): ProviderResult<(Command | CodeAction)[]> {
        return context.diagnostics
            .filter(diagnostic => isDiagnosticCode(diagnostic.code))
            .map(diagnostic => this.createCodeAction(document, diagnostic))
            .reduce((allDiagnostics, newDiagnostics) => allDiagnostics.concat(newDiagnostics), []);
    }

    createCodeAction(document: TextDocument, diagnostic: Diagnostic): CodeAction[] {
        if (!isDiagnosticCode(diagnostic.code)) {
            throw new Error(`Not a supported diagnostic: ` + diagnostic.message);
        }

        const code = diagnostic.code as DiagnosticCode;

        let addSingleCodeAction: CodeAction;

        {
            const message = `Declare '${code.undeclaredName}' in 'btrees.json'`;
            addSingleCodeAction = new CodeAction(message, CodeActionKind.QuickFix);
            addSingleCodeAction.diagnostics = [diagnostic];
            addSingleCodeAction.isPreferred = true;
            addSingleCodeAction.command = {
                title: message,
                command: code.kind === 'action' ? TreeCodeActionProvider.DECLARE_ACTION : TreeCodeActionProvider.DECLARE_CONDITION,
                arguments: [code]
            };
        }

        let addAllCodeAction: CodeAction;

        {
            const message = `Declare all undeclared conditions and actions from this tree in 'btrees.json'`;
            addAllCodeAction = new CodeAction(message, CodeActionKind.QuickFix);
            addAllCodeAction.diagnostics = [diagnostic];
            addAllCodeAction.command = {
                title: message,
                command: TreeCodeActionProvider.DECLARE_ALL,
                arguments: [document.uri]
            };
        }


        return [addSingleCodeAction, addAllCodeAction];
    }

}

export interface DiagnosticCode {
    value: string | number;
    target: Uri;
    /** `action` or `condition` */
    kind: string;
    undeclaredName: string;
    treeWorkspace: TreeWorkspace;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isDiagnosticCode(code: any): code is DiagnosticCode {
    return 'undeclaredName' in code;
}