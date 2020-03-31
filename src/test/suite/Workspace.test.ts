import { expect, assert } from 'chai';
import { suite, before, beforeEach, afterEach } from 'mocha';

import * as vscode from 'vscode';
import * as path from 'path';
import * as extension from '../../extension';
import { TreeWorkspace } from '../../TreeWorkspace';
import { AssertionError, fail } from 'assert';
import { validateAndUpdateWorkspace, parser } from '../../extension';
import { openTreeDocument } from './testUtils';

suite('Workspace Test Suite', () => {

	before(() => {
		vscode.window.showInformationMessage('Start Workspace tests.');
	});

	beforeEach(() => {
		extension.treeWorkspaceRegistry.clear();
		console.log('Workspace cleared.');
	});

	let filesToDelete = new Array<vscode.Uri>();

	afterEach(async () => {
		await Promise.all(filesToDelete.map(fileUri => vscode.workspace.fs.delete(fileUri)));
		filesToDelete.length = 0;
	});

	test('initializes in folder without manifest', async () => {
		const treeWorkspaceRegistry = extension.treeWorkspaceRegistry;

		if (!vscode.workspace.workspaceFolders) {
			assert.fail('No workspace folder open');
		}

		const workspaceFolder = vscode.workspace.workspaceFolders[0];
		const folder1Path = path.join(workspaceFolder.uri.fsPath, 'folder1');
		const tree1Path = path.join(folder1Path, 'tree1.tree');

		const treeWorkspace = (await treeWorkspaceRegistry.change({
			action: () => openTreeDocument(vscode.Uri.file(tree1Path)),
			filter: treeEvent => treeEvent.uri.fsPath === tree1Path
		})).workspace;

		if (!treeWorkspace.isInitialized()) {
			await treeWorkspace.initialization();
		}

		expect(treeWorkspace.getActionsUsed(), "actions used").to.include.members(['action1', 'action2']);
		expect(treeWorkspace.getConditionsUsed(), "conditions used").to.include.members(['condition1', 'condition2']);

		expect(treeWorkspace.getActionsDeclared(), "actions declared").to.be.undefined;
		expect(treeWorkspace.getConditionsDeclared(), "conditions declared").to.be.undefined;

		const tree1 = treeWorkspace.getTree(vscode.Uri.file(tree1Path));
		if (!tree1) { fail('Tree should be in the workspace'); }
		expect(treeWorkspace.getUndeclaredActions(tree1), "no undeclared actions").to.be.empty;
	});

	test('undeclared actions show up when manifest is created', async () => {

		const treeWorkspaceRegistry = extension.treeWorkspaceRegistry;
		if (!vscode.workspace.workspaceFolders) {
			assert.fail('No workspace folder open');
		}

		const workspaceFolder = vscode.workspace.workspaceFolders[0];
		const folder1Path = path.join(workspaceFolder.uri.fsPath, 'folder1');
		const tree1Path = path.join(folder1Path, 'tree1.tree');

		const treeWorkspace = (await treeWorkspaceRegistry.change({
			action: () => openTreeDocument(vscode.Uri.file(tree1Path)),
			filter: treeEvent => treeEvent.uri.fsPath === tree1Path
		})).workspace;

		if (!treeWorkspace.isInitialized()) {
			await treeWorkspace.initialization();
		}

		expect(treeWorkspace.getActionsUsed(), "actions used").to.include.members(['action1', 'action2']);
		expect(treeWorkspace.getConditionsUsed(), "conditions used").to.include.members(['condition1', 'condition2']);

		expect(treeWorkspace.getActionsDeclared(), "actions declared").to.be.undefined;
		expect(treeWorkspace.getConditionsDeclared(), "conditions declared").to.be.undefined;

		const tree1 = treeWorkspace.getTree(vscode.Uri.file(tree1Path));
		if (!tree1) { fail('Tree should be in the workspace'); }

		await treeWorkspace.initialization({
			action: () => {
				// create empty manifest file
				treeWorkspace.saveManifest();
			}
		});

		filesToDelete.push(vscode.Uri.file(treeWorkspace.getManifestPath()));
		expect(treeWorkspace.getUndeclaredActions(tree1), "undeclared actions with empty manifest").to.be.empty;

		await treeWorkspace.initialization({
			action: () => treeWorkspace.addDeclaredAction('action1')
		});

		expect(treeWorkspace.getUndeclaredActions(tree1), "undeclared actions with manifest=[action1]").to.include.members(['action2']);

		await treeWorkspace.initialization({
			action: () => treeWorkspace.addDeclaredCondition('condition1')
		});

		expect(treeWorkspace.getUndeclaredConditions(tree1), "undeclared conditions").to.include.members(['condition2']);
	});

	test('initializes in folder with manifest', async () => {
		const treeWorkspaceRegistry = extension.treeWorkspaceRegistry;
		if (!vscode.workspace.workspaceFolders) {
			assert.fail('No workspace folder open');
		}

		const workspaceFolder = vscode.workspace.workspaceFolders[0];
		const folder2Path = path.join(workspaceFolder.uri.fsPath, 'folder2');
		const tree1Path = path.join(folder2Path, 'tree1.tree');

		const treeWorkspace = (await treeWorkspaceRegistry.change({
			action: () => openTreeDocument(vscode.Uri.file(tree1Path)),
			filter: treeEvent => treeEvent.uri.fsPath === tree1Path
		})).workspace;

		if (!treeWorkspace.isInitialized()) {
			await treeWorkspace.initialization();
		}

		expect(treeWorkspace.getActionsUsed(), "actions used").to.include.members(['action1', 'action2']);
		expect(treeWorkspace.getConditionsUsed(), "conditions used").to.include.members(['condition1', 'condition2']);

		expect(treeWorkspace.getActionsDeclared(), "actions declared").to.deep.equal(['action1']);
		expect(treeWorkspace.getConditionsDeclared(), "conditions declared").to.deep.equal(['condition1']);
	});

	test('initializes in folder with 2 trees', async () => {
		const treeWorkspaceRegistry = extension.treeWorkspaceRegistry;
		if (!vscode.workspace.workspaceFolders) {
			assert.fail('No workspace folder open');
		}

		const workspaceFolder = vscode.workspace.workspaceFolders[0];
		const folder3Path = path.join(workspaceFolder.uri.fsPath, 'folder3');
		const tree1Path = path.join(folder3Path, 'tree1.tree');

		const treeWorkspace = (await treeWorkspaceRegistry.change({
			action: () => openTreeDocument(vscode.Uri.file(tree1Path)),
			filter: treeEvent => treeEvent.uri.fsPath === tree1Path
		})).workspace;

		if (!treeWorkspace.isInitialized()) {
			await treeWorkspace.initialization();
		}

		expect(treeWorkspace.getTrees(), "trees in the folder").to.have.lengthOf(2);

		expect(treeWorkspace.getConditionsUsed(), "conditions used").to.include.members;
		expect(treeWorkspace.getActionsUsed(), "actions used").to.include.members(['action1', 'action2', 'action3']);
		expect(treeWorkspace.getConditionsUsed(), "conditions used").to.include.members(['condition1', 'condition2', 'condition3']);

		expect(treeWorkspace.getActionsDeclared(), "actions declared").to.be.undefined;
		expect(treeWorkspace.getConditionsDeclared(), "conditions declared").to.deep.equal(['condition1']);
	});
});
