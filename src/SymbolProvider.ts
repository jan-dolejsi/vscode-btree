/* --------------------------------------------------------------------------------------------
 * Copyright (c) Jan Dolejsi 2020. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';
import { DefinitionProvider, TextDocument, Position, CancellationToken, Location, Uri, workspace, Range, ReferenceProvider, ReferenceContext } from 'vscode';
import { TreeWorkspaceRegistry } from './TreeWorkspaceRegistry';
import { TreeParser } from './TreeParser';
import { dirname } from 'path';
import { TreeWorkspace } from './TreeWorkspace';
import * as jsonc from 'jsonc-parser';
import { jsonNodeToRange, assertDefined } from './utils';
import { BehaviorTree, ACTION, CONDITION, Node } from 'behavior_tree_service';

export class SymbolProvider implements DefinitionProvider, ReferenceProvider {

    constructor(private treeWorkspaceRegistry: TreeWorkspaceRegistry) {

    }

    provideReferences(document: TextDocument, position: Position, context: ReferenceContext, token: CancellationToken): Location[] | undefined {
        if (token.isCancellationRequested) { return undefined; }

        const symbol = this.getSymbolAtPosition(document, position);
        if (!symbol) { return undefined; }
        const relevantTreeNodeSelector = this.getRelevantTreeNodeSelector(symbol);

        return this.getSymbolReferences(symbol.workspace, symbol.name, relevantTreeNodeSelector);
    }

    async provideDefinition(document: TextDocument, position: Position, token: CancellationToken): Promise<Location | Location[] | undefined> {
        if (token.isCancellationRequested) { return undefined; }

        const symbol = this.getSymbolAtPosition(document, position);

        if (!symbol) { return undefined; }

        const relevantTreeNodeSelector = this.getRelevantTreeNodeSelector(symbol);

        if (token.isCancellationRequested) { return undefined; }

        return await this.getManifestDeclaration(symbol.workspace, symbol.getKind(), symbol.name) ??
            this.getSymbolReferences(symbol.workspace, symbol.name, relevantTreeNodeSelector);
    }

    getSymbolAtPosition(document: TextDocument, position: Position): TreeSymbol | undefined {
        const workspace = this.getWorkspace(document);

        if (!workspace) {
            console.warn(`Document ${document.fileName} is not part of any Tree Workspace.`);
            return undefined;
        }

        const lineText = document.lineAt(position.line).text;
        if (TreeParser.isInComments(lineText, position.character)) {
            return undefined;
        }
        const [indents, code] = TreeParser.splitSourceLine(lineText);
        if (position.character < indents.length) {
            // inside indentation whitespace
            return undefined;
        }

        const positionWithinCode = position.character - indents.length;

        const leftCode = code.substr(0, positionWithinCode);
        const rightCode = code.substr(positionWithinCode);

        {
            const openRoundBracketMatch = leftCode.match(/^\s*\(/);
            const closedRoundBracketMatch = rightCode.match(/\)\s*(;;.*)?$/);
            if (openRoundBracketMatch && closedRoundBracketMatch) {
                // this is a condition
                const conditionName = leftCode.substring((openRoundBracketMatch.index ?? 0) + openRoundBracketMatch.length) +
                    rightCode.substr(0, closedRoundBracketMatch.index ?? 0);

                return new ConditionSymbol(conditionName, workspace);
            }
        }

        {
            const openSquareBracketMatch = leftCode.match(/^\s*\[/);
            const closedSquareBracketMatch = rightCode.match(/\]\s*(;;.*)?$/);
            if (openSquareBracketMatch && closedSquareBracketMatch) {
                // this is an action
                const actionName = leftCode.substring((openSquareBracketMatch.index ?? 0) + openSquareBracketMatch.length) +
                    rightCode.substr(0, closedSquareBracketMatch.index ?? 0);

                return new ActionSymbol(actionName, workspace);
            }
        }
    }

    private getRelevantTreeNodeSelector(symbol: TreeSymbol): (tree: BehaviorTree, symbolName: string) => Node[] {
        if (symbol instanceof ConditionSymbol) {
            return this.selectConditionNodes;
        }
        else if (symbol instanceof ActionSymbol) {
            return this.selectActionNodes;
        }
        else {
            throw new Error(`Unexpected symbol type: ${typeof (symbol)}`);
        }
    }

    private selectConditionNodes(tree: BehaviorTree, conditionName: string): Node[] {
        if (tree.conditions.has(conditionName)) {
            return [...tree.conditions.get(conditionName)];
        } else {
            return [];
        }
    }

    private selectActionNodes(tree: BehaviorTree, actionName: string): Node[] {
        if (tree.actions.has(actionName)) {
            return [...tree.actions.get(actionName)];
        } else {
            return [];
        }
    }

    private getSymbolDeclarations(treeWorkspace: TreeWorkspace, symbolKind: string): string[] | undefined {
        switch (symbolKind) {
            case ACTION:
                return treeWorkspace.getActionsDeclared();
            case CONDITION:
                return treeWorkspace.getConditionsDeclared();
            default:
                throw new Error(`Unexpected symbol kind: ${symbolKind}`);
        }
    }

    private async getManifestDeclaration(treeWorkspace: TreeWorkspace, symbolKind: string, symbolName: string): Promise<Location | undefined> {
        const symbolDeclarations = this.getSymbolDeclarations(treeWorkspace, symbolKind);

        if (symbolDeclarations?.includes(symbolName)) {

            const manifestUri = Uri.file(treeWorkspace.getManifestPath());

            let manifestDoc: TextDocument | undefined;
            try {
                manifestDoc = await workspace.openTextDocument(manifestUri);
            } catch (err) {
                return undefined;
            }
            const rootNode = jsonc.parseTree(manifestDoc.getText());
            const jsonSymbolNode = rootNode && jsonc.findNodeAtLocation(rootNode, [symbolKind + "s", symbolName]);

            const selection = jsonSymbolNode && jsonNodeToRange(manifestDoc, jsonSymbolNode);

            return selection && new Location(manifestUri, selection);
        } else {
            return undefined;
        }
    }

    private getSymbolReferences(workspace: TreeWorkspace, conditionName: string, symbolCollectionSelector: (tree: BehaviorTree, symbolName: string) => Node[]): Location[] {
        return workspace.getTreeUris()
            .map(treeUri => {
                const tree = assertDefined(workspace.getTree(treeUri), 'tree should exist');
                return this.getSymbolTreeReferences(treeUri, tree, conditionName, symbolCollectionSelector);
            })
            .reduce((previous, current) => previous.concat(current), []);
    }

    private getSymbolTreeReferences(uri: Uri, tree: BehaviorTree, symbolName: string, symbolCollectionSelector: (tree: BehaviorTree, symbolName: string) => Node[]): Location[] {
        return symbolCollectionSelector(tree, symbolName)
            .map((n: Node) => SymbolProvider.locationFromLine(uri, n.line));
    }

    static locationFromLine(uri: Uri, line: number): Location {
        return new Location(uri, new Range(line - 1, 0, line - 1, Number.MAX_VALUE));
    }

    private getWorkspace(document: TextDocument): TreeWorkspace | undefined {
        return this.treeWorkspaceRegistry.getWorkspace(dirname(document.uri.fsPath));
    }
}

abstract class TreeSymbol {
    constructor(private name_: string, private workspace_: TreeWorkspace) {

    }
    abstract getKind(): string;

    get name(): string {
        return this.name_;
    }

    get workspace(): TreeWorkspace {
        return this.workspace_;
    }
}

class ConditionSymbol extends TreeSymbol {
    constructor(name: string, workspace: TreeWorkspace) {
        super(name, workspace);
    }

    getKind(): string {
        return CONDITION;
    }
}
class ActionSymbol extends TreeSymbol {
    constructor(name: string, workspace: TreeWorkspace) {
        super(name, workspace);
    }

    getKind(): string {
        return ACTION;
    }
}