/* --------------------------------------------------------------------------------------------
 * Copyright (c) Jan Dolejsi 2020. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Uri, workspace, window, EventEmitter, Event, FileStat, Disposable, TextDocument, WorkspaceEdit, Range, Position } from 'vscode';
import { BehaviorTree } from 'behavior_tree_service';
import * as path from 'path';
import { TreeParser } from './TreeParser';
import * as jsonc from 'jsonc-parser';

/* eslint-disable @typescript-eslint/no-non-null-assertion */

export interface WorkspaceTreeEvent {
    workspace: TreeWorkspace;
    uri: Uri;
    tree: BehaviorTree;
}

export interface WorkspaceEvent {
    workspace: TreeWorkspace;
}

interface TreeWorkspaceManifest {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actions?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conditions?: any;
}

/**
 * Holds info about all files in a folder.
 */
export class TreeWorkspace implements Disposable {
    /** Trees in this folder. */
    private trees = new Map<string, BehaviorTree>();

    /** Actions used in all trees in this folder. */
    private actionsUsed = new Array<string>();

    /** Conditions used in all trees in this folder. */
    private conditionsUsed = new Array<string>();

    private actionsDeclared: string[] | undefined;
    private conditionsDeclared: string[] | undefined;

    private manifestPath: string;

    private _onChanged = new EventEmitter<WorkspaceTreeEvent>();
    private _onInitialized = new EventEmitter<WorkspaceEvent>();
    private _onManifestChanged = new EventEmitter<WorkspaceEvent>();

    private initialized = false;

    constructor(public readonly folderPath: string, private parser: TreeParser) {
        this.manifestPath = path.join(this.folderPath, 'btrees.json');

        this.initialize();
    }

    getTree(treeUri: Uri): BehaviorTree | undefined {
        return this.trees.get(treeUri.toString());
    }

    getTrees(): BehaviorTree[] {
        return [...this.trees.values()];
    }

    getTreeUris(): Uri[] {
        return [...this.trees.keys()]
            .map(treePath => Uri.parse(treePath));
    }

    /**
     * Action names in this tree that are not among the declared actions in the manifest.
     * @param tree behavior tree to test
     */
    getUndeclaredActions(tree: BehaviorTree): string[] {
        const actionsDeclared = this.getActionsDeclared();

        if (actionsDeclared === undefined) { return []; }

        const treeNames = [...this.trees.keys()].
            map(f => path.basename(f, '.tree'));

        const supportedActions = actionsDeclared.concat(treeNames);

        return [...tree.actions.keys()]
            .filter(actionUsed => !supportedActions.includes(actionUsed));
    }

    /**
     * Condition names in this tree that are not among the declared conditions in the manifest.
     * @param tree behavior tree to test
     */
    getUndeclaredConditions(tree: BehaviorTree): string[] {
        const conditionsDeclared = this.getConditionsDeclared();

        if (conditionsDeclared === undefined) { return []; }

        return [...tree.conditions.keys()]
            .filter(conditionUsed => !conditionsDeclared.includes(conditionUsed));
    }

    /**
     * Adds action to the manifest.
     * @param actionNames actions to add
     */
    async addDeclaredActions(actionNames: string[]): Promise<void> {
        if (!this.actionsDeclared) {
            this.actionsDeclared = [];
        }

        const newActions = actionNames
            .filter(actionName => !this.actionsDeclared?.includes(actionName));

        if (newActions.length > 0) {
            this.actionsDeclared.push(...newActions);

            await this.saveManifest();
        }
    }

    /**
     * Adds action to the manifest.
     * @param actionName action to add
     */
    async addDeclaredAction(actionName: string): Promise<void> {
        this.addDeclaredActions([actionName]);
    }

    /**
     * Adds condition to the manifest.
     * @param conditionName condition to add
     */
    async addDeclaredConditions(conditionNames: string[]): Promise<void> {
        if (!this.conditionsDeclared) {
            this.conditionsDeclared = [];
        }

        const newConditions = conditionNames
            .filter(conditionName => !this.conditionsDeclared?.includes(conditionName));

        if (newConditions.length > 0) {
            this.conditionsDeclared.push(...newConditions);

            await this.saveManifest();
        }
    }

    /**
     * Adds condition to the manifest.
     * @param conditionName condition to add
     */
    async addDeclaredCondition(conditionName: string): Promise<void> {
        this.addDeclaredConditions([conditionName]);
    }

    async addAllUndeclared(treeUri: Uri): Promise<void> {
        const tree = this.getTree(treeUri);

        if (tree) {
            await this.addDeclaredActions([...tree.actions.keys()]);
            await this.addDeclaredConditions([...tree.conditions.keys()]);
        }
    }

    public getManifestPath(): string {
        return this.manifestPath;
    }

    async saveManifest(): Promise<void> {
        let manifest = await this.readManifest();
        const manifestExisted = !!manifest;

        if (!manifest) {
            manifest = {};
        }
        // augment actions in manifest
        {
            if (this.getActionsDeclared() !== undefined) {
                if (manifest.actions === undefined) {
                    manifest.actions = {};
                }
                const actionsInManifest = Object.keys(manifest.actions);
                this.getActionsDeclared()?.filter(declaredAction => !actionsInManifest.includes(declaredAction))
                    .forEach(declaredAction => manifest!.actions[declaredAction] = {});// Object.defineProperty(manifest?.actions, declaredAction, new Object(1)));
            }
        }
        // augment conditions in manifest
        {
            if (this.getConditionsDeclared() !== undefined) {
                if (manifest.conditions === undefined) {
                    manifest.conditions = {};
                }
                const conditionsInManifest = Object.keys(manifest.conditions);
                this.getConditionsDeclared()?.filter(declaredCondition => !conditionsInManifest.includes(declaredCondition))
                    .forEach(declaredCondition => manifest!.conditions[declaredCondition] = {});
            }
        }

        // write it to file
        const newManifestText = JSON.stringify(manifest, null, 2);
        const manifestUri = Uri.file(this.getManifestPath());
        if (manifestExisted) {
            const manifestDoc = await workspace.openTextDocument(manifestUri);
            const manifestDocRange = manifestDoc.validateRange(new Range(new Position(0, 0), new Position(manifestDoc.lineCount, Number.MAX_VALUE)));
            const replaceManifestText = new WorkspaceEdit();
            replaceManifestText.replace(manifestUri, manifestDocRange, newManifestText);
            await workspace.applyEdit(replaceManifestText);
        } else {
            await workspace.fs.writeFile(manifestUri, Buffer.from(newManifestText, 'utf-8'));
        }
        this._onInitialized.fire({ workspace: this });
    }

    public get onChanged(): Event<WorkspaceTreeEvent> {
        return this._onChanged.event;
    }

    public get onInitialized(): Event<WorkspaceEvent> {
        return this._onInitialized.event;
    }

    public get onManifestChanged(): Event<WorkspaceEvent> {
        return this._onManifestChanged.event;
    }

    public isInitialized(): boolean {
        return this.initialized;
    }

    async initialize(): Promise<void> {
        this.reloadManifest();

        const manifestWatcher =
            workspace.createFileSystemWatcher(this.manifestPath);

        manifestWatcher.onDidChange(() => this.reloadManifest());
        manifestWatcher.onDidCreate(() => this.reloadManifest());
        manifestWatcher.onDidDelete(() => this.reloadManifest());

        const relativeGlob = workspace.asRelativePath(path.join(this.folderPath, '*.tree'));
        const allTreeUris = await workspace.findFiles(relativeGlob);
        const allTreeParsingPromises = allTreeUris
            .map(async (treeUri) =>
                this.parseAndUpsert(treeUri, await workspace.openTextDocument(treeUri)));

        // wait for all trees to be open and parsed
        await Promise.all(allTreeParsingPromises);

        this.initialized = true;
        this._onInitialized.fire({ workspace: this });
    }

    async reloadManifest(): Promise<void> {
        try {
            const manifest = await this.readManifest();
            if (manifest) {
                this.actionsDeclared = manifest.actions && Object.keys(manifest.actions);
                this.conditionsDeclared = manifest.conditions && Object.keys(manifest.conditions);
                this._onManifestChanged.fire({ workspace: this });
            }
        }
        catch (ex) {
            window.showWarningMessage(`Unable to read manifest from ${this.manifestPath}.`);
        }
    }

    private async readManifestText(): Promise<string | undefined> {
        const manifestUri = Uri.file(this.manifestPath);
        let manifestStat: FileStat | undefined;
        try {
            manifestStat = await workspace.fs.stat(manifestUri);
        }
        catch (ex) {
            // the file does not exist
            return undefined;
        }

        if (manifestStat) {
            return (await workspace.openTextDocument(manifestUri)).getText();
        }
    }

    async readManifest(): Promise<TreeWorkspaceManifest | undefined> {
        const manifestText = await this.readManifestText();
        if (!manifestText) { return undefined; }
        return jsonc.parse(manifestText) as TreeWorkspaceManifest;
    }

    async readManifestTree(): Promise<jsonc.Node | undefined> {
        const manifestText = await this.readManifestText();
        if (!manifestText) { return undefined; }
        return jsonc.parseTree(manifestText);
    }

    getConditionsUsed(): string[] {
        return this.conditionsUsed;
    }

    getActionsUsed(): string[] {
        return this.actionsUsed;
    }

    getConditionsDeclared(): string[] | undefined {
        return this.conditionsDeclared;
    }

    getActionsDeclared(): string[] | undefined {
        return this.actionsDeclared;
    }

    parseAndUpsert(uri: Uri, document: TextDocument): void {
        const tree = this.parser.parseAndValidate(document);
        this.upsert(uri, tree);
    }

    upsert(uri: Uri, tree: BehaviorTree): void {
        this.trees.set(uri.toString(), tree);
        this.updateConditionsUsed();
        this.updateActionsUsed();
        this._onChanged.fire({
            workspace: this,
            tree: tree,
            uri: uri
        });
    }

    updateActionsUsed(): void {
        const uniqueActions = new Set<string>();
        [...this.trees.values()]
            .map(tree =>
                [...tree.actions.keys()].map(key => key as string)).forEach(treeActions => treeActions
                    .forEach(c => uniqueActions.add(c)));

        this.actionsUsed.length = 0;
        this.actionsUsed.push(...uniqueActions);
    }
    updateConditionsUsed(): void {
        const uniqueConditions = new Set<string>();
        [...this.trees.values()]
            .map(tree =>
                [...tree.conditions.keys()].map(key => key as string)).forEach(treeConditions => treeConditions
                    .forEach(c => uniqueConditions.add(c)));

        this.conditionsUsed.length = 0;
        this.conditionsUsed.push(...uniqueConditions);
    }

    /**
     * Awaits a `WorkspaceTreeEvent` change.
     * @param action action to perform after subscribing to the event
     * @param filter event filter
     */
    async change({ action, filter }: { action?: () => void; filter?: (event: WorkspaceTreeEvent) => boolean } = {}): Promise<WorkspaceTreeEvent> {
        return waitFor(this._onChanged.event, { action, filter });
    }

    /**
     * Awaits a `WorkspaceEvent` initialization change.
     * @param action action to perform after subscribing to the event
     * @param filter event filter
     */
    async initialization({ action, filter }: { action?: () => void; filter?: (event: WorkspaceEvent) => boolean } = {}): Promise<WorkspaceEvent> {
        return waitFor(this._onInitialized.event, { action, filter });
    }

    dispose(): void {
        this._onChanged.dispose();
        this._onInitialized.dispose();
    }
}

/**
 * Awaits a `T` event.
 * @param event event emitter to subscribe to 
 * @param param1 action to execute after subscribing to the event and filter to apply to events
 */
export async function waitFor<T>(event: Event<T>, { action, filter }: { action?: () => void; filter?: (event: T) => boolean } = {}): Promise<T> {
    return new Promise<T>(resolve => {
        const subscription = event(e => {
            if ((filter && filter(e)) ?? true) {
                resolve(e);
                subscription.dispose();
            }
        });

        action && action();
    });
}
