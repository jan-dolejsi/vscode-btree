import { expect } from 'chai';
import { suite, before, beforeEach } from 'mocha';

import { window, workspace, TextDocument, Uri, Position, CancellationTokenSource, Location } from 'vscode';
import * as path from 'path';
import * as extension from '../../extension';
import { fail, AssertionError } from 'assert';
import { openTreeDocument, activateExtension, primeWorkspaceFolder } from './testUtils';
import { assertDefined } from '../../utils';
import { SymbolProvider } from '../../SymbolProvider';

suite('References Test Suite', () => {

    before(async () => {
        window.showInformationMessage('Start References tests.');
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

        if (!tree1Doc) {
            throw new AssertionError({ message: "tree1 doc" });
        }

        // WHEN

        const references = new SymbolProvider(treeWorkspaceRegistry).provideReferences(tree1Doc, new Position(2, 10), { includeDeclaration: true }, new CancellationTokenSource().token);

        // THEN

        expect(references).not.undefined;
        expect(references, "condition2 references").has.lengthOf(1);
        if (!references) { fail(); }

        const referencesAsArray: Location[] = references as Location[];
        const reference = referencesAsArray[0];
        expect(reference.uri.fsPath).to.equal(tree1Doc.uri.fsPath);
        expect(reference.range.isSingleLine);
        expect(reference.range.start.line).to.equal(2);
    });

    test('in folder with manifest points to the manifest', async () => {
        const treeWorkspaceRegistry = assertDefined(extension.treeWorkspaceRegistry, 'tree workspace registry');

        if (!workspace.workspaceFolders) {
            fail('No workspace folder open');
        }

        const workspaceFolder = workspace.workspaceFolders[0];
        const folder4Path = path.join(workspaceFolder.uri.fsPath, 'folder4');
        const tree1Path = path.join(folder4Path, 'tree1.tree');
        const tree2Path = path.join(folder4Path, 'tree2.tree');

        let tree1Doc: TextDocument | undefined;

        const treeWorkspace = (await treeWorkspaceRegistry.change({
            action: async () => tree1Doc = await openTreeDocument(Uri.file(tree1Path)),
            filter: treeEvent => treeEvent.uri.fsPath === tree1Path
        })).workspace;

        if (!treeWorkspace.isInitialized()) {
            await treeWorkspace.initialization();
        }

        if (!tree1Doc) {
            throw new AssertionError({ message: "tree1 doc" });
        }

        // WHEN

        const references = new SymbolProvider(treeWorkspaceRegistry).provideReferences(tree1Doc, new Position(3, 10), { includeDeclaration: true }, new CancellationTokenSource().token);

        // THEN

        expect(references).not.undefined;
        expect(references, "action1 references").has.lengthOf(2);
        if (!references) { fail(); }

        const referencesAsArray: Location[] = references as Location[];
        {
            const tree1Reference = referencesAsArray.find(d => d.uri.fsPath === tree1Path);
            expect(tree1Reference).to.not.be.undefined;
            if (!tree1Reference) { fail(); }
            expect(tree1Reference.range.isSingleLine);
            expect(tree1Reference.range.start.line).to.equal(3);
        }
        {
            const tree2Reference = referencesAsArray.find(d => d.uri.fsPath === tree2Path);
            expect(tree2Reference).to.not.be.undefined;
            if (!tree2Reference) { fail(); }
            expect(tree2Reference.range.isSingleLine);
            expect(tree2Reference.range.start.line).to.equal(3);
        }        
    });

    test('in folder with manifest for action only used in one tree', async () => {
        const treeWorkspaceRegistry = assertDefined(extension.treeWorkspaceRegistry, 'tree workspace registry');

        if (!workspace.workspaceFolders) {
            fail('No workspace folder open');
        }

        const workspaceFolder = workspace.workspaceFolders[0];
        const folder4Path = path.join(workspaceFolder.uri.fsPath, 'folder4');
        const tree2Path = path.join(folder4Path, 'tree2.tree');

        let tree2Doc: TextDocument | undefined;

        const treeWorkspace = (await treeWorkspaceRegistry.change({
            action: async () => tree2Doc = await openTreeDocument(Uri.file(tree2Path)),
            filter: treeEvent => treeEvent.uri.fsPath === tree2Path
        })).workspace;

        if (!treeWorkspace.isInitialized()) {
            await treeWorkspace.initialization();
        }

        if (!tree2Doc) {
            throw new AssertionError({ message: "tree2 doc" });
        }

        // WHEN

        const references = new SymbolProvider(treeWorkspaceRegistry).provideReferences(tree2Doc, new Position(4, 10), { includeDeclaration: true }, new CancellationTokenSource().token);

        // THEN
        
        expect(references).not.undefined;
        expect(references, "action3 references").has.lengthOf(1);
        if (!references) { fail(); }

        const referencesAsArray: Location[] = references as Location[];
        const reference = referencesAsArray[0];
        expect(reference.uri.fsPath).to.equal(tree2Doc.uri.fsPath);
        expect(reference.range.isSingleLine);
        expect(reference.range.start.line).to.equal(4);
    });
});