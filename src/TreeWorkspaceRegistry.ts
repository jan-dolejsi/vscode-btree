/* --------------------------------------------------------------------------------------------
 * Copyright (c) Jan Dolejsi 2020. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

'use strict';

import * as path from 'path';
import { Uri, EventEmitter, Event, Disposable, languages, DiagnosticCollection, Diagnostic, DiagnosticSeverity, Range, TextDocument, workspace, DiagnosticRelatedInformation, Location, Position } from 'vscode';
import { TreeWorkspace, WorkspaceTreeEvent, WorkspaceEvent, waitFor } from './TreeWorkspace';
import { BehaviorTree, Action, Condition, Node } from 'behavior_tree_service';
import { TreeParser } from './TreeParser';
import { DiagnosticCode } from './TreeCodeActionProvider';
import { parseTree, findNodeAtLocation } from 'jsonc-parser';
import { jsonNodeToRange } from './utils';

export class TreeWorkspaceRegistry implements Disposable {
    private workspaces = new Map<string, TreeWorkspace>();
    private _onChanged = new EventEmitter<WorkspaceTreeEvent>();
    private _onWorkspaceInitialized = new EventEmitter<WorkspaceEvent>();
    private undeclaredSymbolDiagCollection: DiagnosticCollection;

    constructor(private parser: TreeParser) {
        this.undeclaredSymbolDiagCollection = languages.createDiagnosticCollection("Undeclared Behavior Tree symbols");
    }

    public get onWorkspaceInitialized(): Event<WorkspaceEvent> {
        return this._onWorkspaceInitialized.event;
    }

    public get onChanged(): Event<WorkspaceTreeEvent> {
        return this._onChanged.event;
    }

    /**
     * Folder path
     * @param folderPath path of the folder
     */
    getWorkspace(folderPath: string): TreeWorkspace | undefined {
        return this.workspaces.get(folderPath);
    }

    async updateWorkspace(doc: TextDocument, tree: BehaviorTree): Promise<void> {
        const folder = path.dirname(doc.uri.fsPath);
        if (!this.workspaces.has(folder)) {
            const newTreeWorkspace = new TreeWorkspace(folder, this.parser);
            newTreeWorkspace.onChanged(e => this._onChanged.fire(e));
            newTreeWorkspace.onInitialized(async (e) => {
                await this.populateWorkspaceDiagnostics(e.workspace);
                this._onWorkspaceInitialized.fire(e);
            });
            this.workspaces.set(folder, newTreeWorkspace);
        }

        const workspace = this.workspaces.get(folder);
        if (workspace) {
            workspace.upsert(doc.uri, tree);
            await this.populateUndeclaredSymbols(workspace, doc, tree);
        }
    }

    async populateWorkspaceDiagnostics(treeWorkspace: TreeWorkspace): Promise<void> {
        const treeUris = treeWorkspace.getTreeUris();

        const promises = treeUris
            .map(async (treeUri) => {
                const tree = treeWorkspace.getTree(treeUri);
                if (tree) {
                    await this.populateUndeclaredSymbols(treeWorkspace,
                        await workspace.openTextDocument(treeUri),
                        tree);
                }
                else {
                    console.error(`Tree not found for uri: ${treeUri}`);
                }
            });

        // wait for all to complete
        await Promise.all(promises);
    }

    async populateUndeclaredSymbols(treeWorkspace: TreeWorkspace, document: TextDocument, tree: BehaviorTree): Promise<void> {
        let manifestDoc: TextDocument | undefined;
        try {
            const manifestUri = Uri.file(treeWorkspace.getManifestPath());
            manifestDoc = await workspace.openTextDocument(manifestUri);
        }
        catch (err) {
            // manifest does not exist 
        }

        const actionDiags = treeWorkspace.getUndeclaredActions(tree)
            .map(undeclaredAction => tree.actions.get(undeclaredAction))
            .filter(actionNodes => actionNodes.length > 0)
            .map((action: Action[]) =>
                this.createDiagnostic(action[0], document, manifestDoc, treeWorkspace));

        const conditionDiags = treeWorkspace.getUndeclaredConditions(tree)
            .map(undeclaredCondition => tree.conditions.get(undeclaredCondition))
            .filter(conditionNodes => conditionNodes.length > 0)
            .map((condition: Condition[]) =>
                this.createDiagnostic(condition[0], document, manifestDoc, treeWorkspace));

        this.undeclaredSymbolDiagCollection.set(document.uri, actionDiags.concat(conditionDiags));
    }

    private createDiagnostic(node: Node, document: TextDocument, manifestDoc: TextDocument | undefined, treeWorkspace: TreeWorkspace): Diagnostic {
        const diagnostic = new Diagnostic(this.toRange(node, document), `Undeclared ${node.kind} ${node.name}`, DiagnosticSeverity.Warning);
        diagnostic.source = 'btree';

        if (manifestDoc) {
            const rootNode = parseTree(manifestDoc.getText());
            const jsonConditionNode = findNodeAtLocation(rootNode, [node.kind + "s", node.name]) ?? findNodeAtLocation(rootNode, [node.kind + "s"]);
            const selection = (jsonConditionNode && jsonNodeToRange(manifestDoc, jsonConditionNode)) ?? new Position(0, 0);

            diagnostic.relatedInformation = [
                new DiagnosticRelatedInformation(new Location(manifestDoc.uri, selection), `See supported ${node.kind}s.`)
            ];
        }
        
        const code: DiagnosticCode = {
            value: "undeclared_" + node.kind,
            target: Uri.parse('https://github.com/jan-dolejsi/vscode-btree#action-and-condition-name-validation'),
            kind: node.kind,
            undeclaredName: node.name,
            treeWorkspace: treeWorkspace
        };
        diagnostic.code = code;
        return diagnostic;
    }

    toRange(node: Node, document: TextDocument): Range {
        const lineText = document.lineAt(node.line - 1);
        let firstCharacter = lineText.text.indexOf(node.name);
        let lastCharacter;
        if (firstCharacter > -1) {
            lastCharacter = firstCharacter + node.name.length;
        } else {
            const [indentations] = TreeParser.splitSourceLine(lineText.text);
            firstCharacter = indentations.length;
            lastCharacter = Number.MAX_VALUE;
        }
        return new Range(node.line - 1, firstCharacter, node.line - 1, lastCharacter);
    }

    /**
     * Awaits a `WorkspaceTreeEvent` change.
     * @param param0 action to execute after subscribing to the event and filter to apply to events
     */
    async change({ action, filter }: { action?: () => void; filter?: (event: WorkspaceTreeEvent) => boolean } = {}): Promise<WorkspaceTreeEvent> {
        return waitFor(this._onChanged.event, { action, filter });
    }

    /**
     * Awaits a `WorkspaceEvent` initialization change.
     * @param param0 action to execute after subscribing to the event and filter to apply to events
     */
    async initialization({ action, filter }: { action?: () => void; filter?: (event: WorkspaceEvent) => boolean } = {}): Promise<WorkspaceEvent> {
        return waitFor(this._onWorkspaceInitialized.event, { action, filter });
    }

    clear(): void {
        this.workspaces.forEach(workspace => workspace.dispose());
        this.workspaces.clear();
    }

    dispose(): void {
        this._onChanged.dispose();
        this._onWorkspaceInitialized.dispose();
    }
}