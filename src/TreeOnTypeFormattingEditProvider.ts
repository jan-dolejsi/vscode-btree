/* --------------------------------------------------------------------------------------------
 * Copyright (c) Jan Dolejsi 2020. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { OnTypeFormattingEditProvider, TextDocument, Position, FormattingOptions, CancellationToken, ProviderResult, TextEdit, Range, window, Selection, commands } from 'vscode';
import { TreeParser } from './TreeParser';

export class TreeOnTypeFormattingEditProvider implements OnTypeFormattingEditProvider {

    provideOnTypeFormattingEdits(document: TextDocument, position: Position, ch: string,
        options: FormattingOptions, token: CancellationToken): ProviderResult<TextEdit[]> {
        if (token.isCancellationRequested) { return undefined; }

        switch (ch) {
            case '|':
                return this.insertTab(document, position, options);
            case '\n':
                return this.repeatIndent(document, position, options);
            case '\b':
                return this.handleBackspace(document, position, options);
            default:
                return undefined;
        }
    }
    insertTab(document: TextDocument, position: Position, options: FormattingOptions): TextEdit[] {
        const insertedWhiteSpace = TreeParser.tab(options);
        return [new TextEdit(
            new Range(position, position),
            insertedWhiteSpace
        )];
    }

    repeatIndent(document: TextDocument, position: Position, options: FormattingOptions): TextEdit[] {
        
        const previousLineText = document.lineAt(position.translate({ lineDelta: -1 }).line).text;
        var [previousLineIndents, _] = TreeParser.getIndentsAndRest(previousLineText);

        if (TreeParser.isParentNode(previousLineText)) {
            previousLineIndents = TreeParser.indent(previousLineIndents, options);
        }

        return [new TextEdit(
            new Range(position, position),
            previousLineIndents
        )];
    }

    handleBackspace(document: TextDocument, position: Position, options: FormattingOptions): ProviderResult<TextEdit[]> {
        const lineRange = new Range(
            position.with({ character: 0 }),
            position.with({ character: Number.POSITIVE_INFINITY }));

        const lineText = document.lineAt(position.line).text;

        const leftPart = lineText.substr(0, position.character);

        // is on the left hand side only indent code?
        if (leftPart.match(/^[|\s]+$/)) {
            const previousPipePosition = leftPart.lastIndexOf('|');
            return [new TextEdit(
                new Range(new Position(position.line, previousPipePosition), position),
                ""
            )];
        }

        var [indents, rest] = TreeParser.getIndentsAndRest(lineText);
    }

    static backspace(): Thenable<unknown> {

        if (window.activeTextEditor) {
            const document = window.activeTextEditor.document;

            let selectionChanged = false;
            const newSelections = window.activeTextEditor.selections.map(selection => {
                if (!selection.isEmpty) {
                    return selection;
                }

                if (selection.start.character === 0) {
                    return selection;
                }
                
                const leftRange = new Range(selection.active.with({character: 0}), selection.active);
                const leftPart = document.getText(leftRange);

                if (leftPart.match(/^[|\s]+$/)) {
                    const previousPipePosition = leftPart.lastIndexOf('|');
                    selectionChanged = true;
                    return new Selection(selection.start.with({ character: previousPipePosition }), selection.start);
                }
                else {
                    return selection;
                }
            });

            if (selectionChanged) {
                window.activeTextEditor.selections = newSelections;
            }
        }
        
        return commands.executeCommand('deleteLeft');
    }

}