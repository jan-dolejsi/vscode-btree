import { expect } from 'chai';
import { suite, before, beforeEach } from 'mocha';

import { window, workspace, TextDocument, Uri, Position, CancellationTokenSource, Location } from 'vscode';
import * as path from 'path';
import * as extension from '../../extension';
import { fail, AssertionError } from 'assert';
import { openTreeDocument, activateExtension, primeWorkspaceFolder } from './testUtils';
import { assertDefined } from '../../utils';
import { SymbolProvider } from '../../SymbolProvider';

suite('Symbols Test Suite', () => {

    before(async () => {
        window.showInformationMessage('Start Symbols tests.');
        await primeWorkspaceFolder();
        await activateExtension();
    });

    beforeEach(async () => {
        extension.treeWorkspaceRegistry?.clear();
    });

    test('in folder without manifest points to first/any usage', async () => {
        const treeWorkspaceRegistry = assertDefined(extension.treeWorkspaceRegistry, 'tree workspace registry');

        if (!workspace.workspaceFolders) {
            fail('No workspace folder open');
        }

        const workspaceFolder = workspace.workspaceFolders[0];
        const folder1Path = path.join(workspaceFolder.uri.fsPath, 'folder1');
        const tree1Path = path.join(folder1Path, 'tree1.tree');

        let tree1Doc: TextDocument | undefined;

        const treeWorkspace = (await treeWorkspaceRegistry.change({
            action: async () => tree1Doc = await openTreeDocument(Uri.file(tree1Path)),
            filter: treeEvent => treeEvent.uri.fsPath === tree1Path
        })).workspace;

        if (!treeWorkspace.isInitialized()) {
            await treeWorkspace.initialization();
        }

        if(!tree1Doc) {
            throw new AssertionError({ message: "tree1 doc" });
        }

        // WHEN

        const declarations = await new SymbolProvider(treeWorkspaceRegistry).provideDefinition(tree1Doc, new Position(2, 10), new CancellationTokenSource().token);

        // THEN

        expect(declarations).not.undefined;
        expect(declarations, "condition2 declarations").has.lengthOf(1);
        if (!declarations) { fail(); }

        const declarationsArray: Location[] = declarations as Location[];
        const declaration = declarationsArray[0];
        expect(declaration.uri.fsPath).to.equal(tree1Doc.uri.fsPath);
        expect(declaration.range.isSingleLine);
        expect(declaration.range.start.line).to.equal(2);
    });

    test('in folder with manifest points to the manifest', async () => {
        const treeWorkspaceRegistry = assertDefined(extension.treeWorkspaceRegistry, 'tree workspace registry');

        if (!workspace.workspaceFolders) {
            fail('No workspace folder open');
        }

        const workspaceFolder = workspace.workspaceFolders[0];
        const folder4Path = path.join(workspaceFolder.uri.fsPath, 'folder4');
        const tree1Path = path.join(folder4Path, 'tree1.tree');

        let tree1Doc: TextDocument | undefined;

        const treeWorkspace = (await treeWorkspaceRegistry.change({
            action: async () => tree1Doc = await openTreeDocument(Uri.file(tree1Path)),
            filter: treeEvent => treeEvent.uri.fsPath === tree1Path
        })).workspace;

        if (!treeWorkspace.isInitialized()) {
            await treeWorkspace.initialization();
        }

        if(!tree1Doc) {
            throw new AssertionError({ message: "tree1 doc" });
        }

        // WHEN

        const declarations = await new SymbolProvider(treeWorkspaceRegistry).provideDefinition(tree1Doc, new Position(3, 10), new CancellationTokenSource().token);

        // THEN

        expect(declarations).not.undefined;
        expect(declarations, "action1 declarations").instanceof(Location);
        if (!declarations) { fail(); }

        const declaration: Location = declarations as Location;
        expect(declaration.uri.fsPath).to.equal(treeWorkspace.getManifestPath());
        expect(declaration.range.isSingleLine);
        expect(declaration.range.start.line).to.equal(7);
    });

});