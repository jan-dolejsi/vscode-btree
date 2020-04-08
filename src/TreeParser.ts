/* --------------------------------------------------------------------------------------------
 * Copyright (c) Jan Dolejsi 2020. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { FormattingOptions, TextDocument, languages, DiagnosticCollection, Diagnostic, DiagnosticSeverity, Range } from 'vscode';
import { BehaviorTree } from 'behavior_tree_service';

export class TreeParser {
    diagnosticCollection: DiagnosticCollection;
    
    constructor() {
        this.diagnosticCollection = languages.createDiagnosticCollection("BehaviorTree");
    }

    parseAndValidate(document: TextDocument): BehaviorTree {
        const tree = TreeParser.parse(document.getText());

        const diagnostics = new Array<Diagnostic>();

        if (tree.error) {
            const range = new Range(tree.line-1, 0, tree.line-1, Number.MAX_VALUE);
            diagnostics.push(new Diagnostic(range, tree.error, DiagnosticSeverity.Error));
        }

        this.diagnosticCollection.set(document.uri, diagnostics);

        return tree;
    }

    clearValidation(document: TextDocument): void {
        this.diagnosticCollection.set(document.uri, []);
    }

    static splitSourceLine(lineText: string): [string, string] {
        const match = lineText.match(/^([|\s]*)/);

        if (match !== null) {
            const indents = match[1];
            const rest = lineText.substr(indents.length);
            return [indents, rest];
        }

        return ["", lineText];
    }

    static getParentNode(text: string): string | undefined {
        const match = text.match(/(->|\?|=[\d]+)$/);

        if (match !== null) {
            return match[1];
        }

        return undefined;
    }

    static isParentNode(text: string): boolean {
        return !!TreeParser.getParentNode(text);
    }

    static tab(options: FormattingOptions): string {
        return options.insertSpaces ? " ".repeat(options.tabSize) : "\t";
    }

    static unindent(text: string): string {
        const [indents, rest] = TreeParser.splitSourceLine(text);
        return indents.substring(0, indents.lastIndexOf('|')) + rest;
    }

    static indent(text: string, options: FormattingOptions): string {
        const [indents, rest] = TreeParser.splitSourceLine(text);
        return indents + '|' + TreeParser.tab(options) + rest;
    }

    static parse(text: string): BehaviorTree {
        return BehaviorTree.fromText(text);
    }
}
