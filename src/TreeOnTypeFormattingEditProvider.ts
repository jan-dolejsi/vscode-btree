/* --------------------------------------------------------------------------------------------
 * Copyright (c) Jan Dolejsi 2020. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { OnTypeFormattingEditProvider, TextDocument, Position, FormattingOptions, CancellationToken, ProviderResult, TextEdit, Range, window, Selection, commands, TextEditor, TextEditorOptions } from 'vscode';
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
                // VS Code on-type formatting is unable to handle backspace, so this never fires
                return this.handleBackspace(document, position);
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
        let [previousLineIndents] = TreeParser.splitSourceLine(previousLineText);

        if (TreeParser.isParentNode(previousLineText)) {
            previousLineIndents = TreeParser.indent(previousLineIndents, options);
        }

        return [new TextEdit(
            new Range(position, position),
            previousLineIndents
        )];
    }

    /**
     * Removes one indentation
     * @param document document
     * @param position position where backspace was pressed
     */
    handleBackspace(document: TextDocument, position: Position): ProviderResult<TextEdit[]> {

        const lineText = document.lineAt(position.line).text;

        const leftPart = lineText.substr(0, position.character);

        const [indents, rest] = TreeParser.splitSourceLine(lineText);

        console.log(indents+rest);

        // is on the left hand side only indent code?
        if (leftPart.match(/^[|\s]+$/)) {
            const previousPipePosition = leftPart.lastIndexOf('|');
            return [new TextEdit(
                new Range(new Position(position.line, previousPipePosition), position),
                ""
            )];
        }
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

                const leftRange = new Range(selection.active.with({ character: 0 }), selection.active);
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

    static tab(): Thenable<unknown> {

        if (window.activeTextEditor) {
            const document = window.activeTextEditor.document;
            const selections = window.activeTextEditor.selections;
            const options = window.activeTextEditor.options;
            const formattingOptions = TreeOnTypeFormattingEditProvider.toFormattingOptions(options);

            // is the selection multi-line?
            const isMultilineSelection = selections.some(s => !s.isSingleLine);
            // is the cursor inside indentation (empty selection)?
            const isInIndentation = selections.every(s => TreeOnTypeFormattingEditProvider.isInIndentation(s, document));

            if (isMultilineSelection || isInIndentation) {
                const selectedLines = TreeOnTypeFormattingEditProvider.getSelectedLines(window.activeTextEditor);
                return TreeOnTypeFormattingEditProvider.indentLines(document, selectedLines, formattingOptions);
            }
        }

        return commands.executeCommand('tab');
    }

    static isInIndentation(s: Selection, document: TextDocument): boolean {
        if (!s.isEmpty) {
            return false;
        }

        const line = document.lineAt(s.anchor.line);

        const [indentation] = TreeParser.splitSourceLine(line.text);

        return s.start.character <= indentation.length;
    }

    static async indent(): Promise<void> {

        if (window.activeTextEditor) {
            const document = window.activeTextEditor.document;
            const options = window.activeTextEditor.options;
            const formattingOptions = TreeOnTypeFormattingEditProvider.toFormattingOptions(options);

            const selectedLines = TreeOnTypeFormattingEditProvider.getSelectedLines(window.activeTextEditor);
            return TreeOnTypeFormattingEditProvider.indentLines(document, selectedLines, formattingOptions);
        }
    }

    static toFormattingOptions(options: TextEditorOptions): FormattingOptions {
        return {
            insertSpaces: options.insertSpaces as boolean,
            tabSize: options.tabSize as number
        };
    }

    static async indentLines(document: TextDocument, selectedLines: Set<number>, formattingOptions: FormattingOptions): Promise<void> {
        for (const line of selectedLines) {
            const lineText = document.lineAt(line).text;
            const [indentations] = TreeParser.splitSourceLine(lineText);

            const success = await window.activeTextEditor?.edit(editBuilder => {
                editBuilder.insert(new Position(line, indentations.length), '|' + TreeParser.tab(formattingOptions));
            });

            if (!success) {
                console.error(`Failed to indent ${line}`);
            }
        }
    }

    private static getSelectedLines(editor: TextEditor): Set<number> {
        return new Set<number>(editor.selections
            .map(selection => range(selection.start.line, TreeOnTypeFormattingEditProvider.getAdjustedEndLine(selection)))
            .reduce((prev, cur) => prev.concat(cur), []));
    }

    private static getAdjustedEndLine(selection: Selection): number {
        if (!selection.isSingleLine && selection.end.character === 0) {
            return selection.end.line - 1;
        }
        else {
        return selection.end.line;
        }
    }

    static async unindent(): Promise<void> {
        if (window.activeTextEditor) {
            const document = window.activeTextEditor.document;

            const selectedLines = TreeOnTypeFormattingEditProvider.getSelectedLines(window.activeTextEditor);

            for (const line of selectedLines) {
                const lineText = document.lineAt(line).text;
                const [indentations] = TreeParser.splitSourceLine(lineText);
                const lastPipeIndex = indentations.lastIndexOf('|');

                const success = await window.activeTextEditor?.edit(editBuilder => {
                    editBuilder.delete(new Range(
                        new Position(line, lastPipeIndex),
                        new Position(line, indentations.length)
                    ));
                });

                if (!success) {
                    console.error(`Failed to unindent ${line}`);
                }
            }
        }
    }

}

function range(start: number, end: number): number[] {
    return [...Array(end - start + 1).keys()].map(i => i + start);
}