import { expect, assert } from 'chai';
import { suite, before, beforeEach, afterEach } from 'mocha';

import * as vscode from 'vscode';
import * as path from 'path';
import * as extension from '../../extension';
import { TreeWorkspace } from '../../TreeWorkspace';
import { AssertionError, fail } from 'assert';
import { validateAndUpdateWorkspace, parser, TREE } from '../../extension';
import { TreeCompletionItemProvider } from '../../TreeCompletionItemProvider';
import { Uri } from 'vscode';
import { openTreeDocument } from './testUtils';

suite('Completion Item provider Test Suite', () => {

	before(() => {
		vscode.window.showInformationMessage('Start Completion Item tests.');
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

	test('auto-completion in folder without manifest', async () => {
		const treeWorkspaceRegistry = extension.treeWorkspaceRegistry;

		if (!vscode.workspace.workspaceFolders) {
			assert.fail('No workspace folder open');
		}

		const workspaceFolder = vscode.workspace.workspaceFolders[0];
		const folder1Path = path.join(workspaceFolder.uri.fsPath, 'folder1');
		const tree1Path = path.join(folder1Path, 'tree1.tree');
		const newTreePath = path.join(folder1Path, 'newTree.tree');
		const newTreeUri = Uri.file(newTreePath);
		const newTreeContent = '->\n|\t';
		filesToDelete.push(newTreeUri);
		let newTreeDoc: vscode.TextDocument | undefined;

		const treeWorkspace = (await treeWorkspaceRegistry.change({
			action: async () => {
				await vscode.workspace.fs.writeFile(newTreeUri, Buffer.from(newTreeContent));
				newTreeDoc = await vscode.workspace.openTextDocument(newTreeUri);
			},
			filter: treeEvent => treeEvent.uri.fsPath === newTreePath
		})).workspace;

		if (!treeWorkspace.isInitialized()) {
			await treeWorkspace.initialization();
		}

		if (!newTreeDoc) {
			throw new AssertionError({ message: 'document not open' });
		}

		{
			const completionItems = new TreeCompletionItemProvider(treeWorkspaceRegistry)
				.provideCompletionItems(newTreeDoc, newTreeDoc.positionAt(newTreeContent.length),
					new vscode.CancellationTokenSource().token,
					{
						triggerKind: vscode.CompletionTriggerKind.TriggerCharacter,
						triggerCharacter: '('
					});

			expect(completionItems, "completion item").to.not.be.undefined;
			expect(completionItems?.map(c => c.label), "completion items").to.include.members(['condition1', 'condition2']);
			expect(completionItems!, "completion item count").to.have.lengthOf(2);
		}

		{
			const completionItems = new TreeCompletionItemProvider(treeWorkspaceRegistry)
				.provideCompletionItems(newTreeDoc, newTreeDoc.positionAt(newTreeContent.length),
					new vscode.CancellationTokenSource().token,
					{
						triggerKind: vscode.CompletionTriggerKind.TriggerCharacter,
						triggerCharacter: '['
					});

			expect(completionItems, "completion item").to.not.be.undefined;
			expect(completionItems?.map(c => c.label), "completion items").to.include.members(['action1', 'action2']);
			expect(completionItems!, "completion item count").to.have.lengthOf(2);
		}

		{
			const completionItems = new TreeCompletionItemProvider(treeWorkspaceRegistry)
				.provideCompletionItems(newTreeDoc, newTreeDoc.positionAt(newTreeContent.length),
					new vscode.CancellationTokenSource().token,
					{
						triggerKind: vscode.CompletionTriggerKind.Invoke
					});

			expect(completionItems, "completion item").to.not.be.undefined;
			const expectedLabels = [
				'?', '->', '=N',
				'[action1]', '[action2]',
				'(condition1)', '(condition2)'
			];
			expect(completionItems?.map(c => c.label), "completion items").to.include.members(expectedLabels);
		}
	});

	test('auto-completion in folder with manifest', async () => {
		const treeWorkspaceRegistry = extension.treeWorkspaceRegistry;
		if (!vscode.workspace.workspaceFolders) {
			assert.fail('No workspace folder open');
		}

		const workspaceFolder = vscode.workspace.workspaceFolders[0];
		const folder2Path = path.join(workspaceFolder.uri.fsPath, 'folder2');
		const tree1Path = path.join(folder2Path, 'tree1.tree');
		const newTreePath = path.join(folder2Path, 'newTree.tree');
		const newTreeUri = Uri.file(newTreePath);
		const newTreeContent = '->\n|\t';
		filesToDelete.push(newTreeUri);
		let newTreeDoc: vscode.TextDocument | undefined;

		const treeWorkspace = (await treeWorkspaceRegistry.change({
			action: async () => {
				await vscode.workspace.fs.writeFile(newTreeUri, Buffer.from(newTreeContent));
				newTreeDoc = await vscode.workspace.openTextDocument(newTreeUri);
			},
			filter: treeEvent => treeEvent.uri.fsPath === newTreePath
		})).workspace;

		if (!treeWorkspace.isInitialized()) {
			await treeWorkspace.initialization();
		}

		if (!newTreeDoc) {
			throw new AssertionError({ message: 'document not open' });
		}

		{
			const completionItems = new TreeCompletionItemProvider(treeWorkspaceRegistry)
				.provideCompletionItems(newTreeDoc, newTreeDoc.positionAt(newTreeContent.length),
					new vscode.CancellationTokenSource().token,
					{
						triggerKind: vscode.CompletionTriggerKind.TriggerCharacter,
						triggerCharacter: '('
					});

			expect(completionItems, "completion item").to.not.be.undefined;
			expect(completionItems?.map(c => c.label), "completion items").to.include.members(['condition1']);
			expect(completionItems!, "completion item count").to.have.lengthOf(1);
		}

		{
			const completionItems = new TreeCompletionItemProvider(treeWorkspaceRegistry)
				.provideCompletionItems(newTreeDoc, newTreeDoc.positionAt(newTreeContent.length),
					new vscode.CancellationTokenSource().token,
					{
						triggerKind: vscode.CompletionTriggerKind.TriggerCharacter,
						triggerCharacter: '['
					});

			expect(completionItems, "completion item").to.not.be.undefined;
			expect(completionItems?.map(c => c.label), "completion items").to.include.members(['action1']);
			expect(completionItems!, "completion item count").to.have.lengthOf(1);
		}

		{
			const completionItems = new TreeCompletionItemProvider(treeWorkspaceRegistry)
				.provideCompletionItems(newTreeDoc, newTreeDoc.positionAt(newTreeContent.length),
					new vscode.CancellationTokenSource().token,
					{
						triggerKind: vscode.CompletionTriggerKind.Invoke
					});

			expect(completionItems, "completion item").to.not.be.undefined;
			const expectedLabels = [
				'?', '->', '=N',
				'[action1]',
				'(condition1)',
			];
			expect(completionItems?.map(c => c.label), "completion items").to.include.members(expectedLabels);
		}
	});
});
