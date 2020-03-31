/* --------------------------------------------------------------------------------------------
 * Copyright (c) Jan Dolejsi 2020. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Uri, workspace, window, EventEmitter, Event, FileStat, Disposable } from 'vscode';
import { BehaviorTree } from 'behavior_tree_service';
import * as path from 'path';

export interface WorkspaceTreeEvent {
    workspace: Workspace;
    uri: Uri;
    tree: BehaviorTree;
}

export interface WorkspaceEvent {
    workspace: Workspace;
}

interface TreeWorkspaceManifest {
    actions?: any;
    conditions?: any;
}

/**
 * Holds info about all files in a folder.
 */
export class Workspace implements Disposable {
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

    private initialized = false;

    constructor(public readonly folderUri: string) {
        this.manifestPath = path.join(this.folderUri, 'btrees.json');

        this.initialize();
    }

    getTree(treeUri: Uri): BehaviorTree | undefined {
        return this.trees.get(treeUri.toString());
    }

    /**
     * Action names in this tree that are not among the declared actions in the manifest.
     * @param tree behavior tree to test
     */
    getUndeclaredActions(tree: BehaviorTree): string[] {
        const actionsDeclared = this.getActionsDeclared();

        if (actionsDeclared === undefined) { return []; }

        return [...tree.actions.keys()]
            .filter(actionUsed => !actionsDeclared.includes(actionUsed));
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
     * @param actionName action to add
     */
    async addDeclaredAction(actionName: string): Promise<void> {
        if (!this.actionsDeclared) {
            this.actionsDeclared = [];
        }
        this.actionsDeclared?.push(actionName);

        await this.saveManifest();
    }


    /**
     * Adds condition to the manifest.
     * @param conditionName action to add
     */
    async addDeclaredCondition(conditionName: string): Promise<void> {
        if (!this.conditionsDeclared) {
            this.conditionsDeclared = [];
        }
        this.conditionsDeclared?.push(conditionName);

        await this.saveManifest();
    }

    public getManifestPath(): string {
        return this.manifestPath;
    }

    async saveManifest(): Promise<void> {
        let manifest = await this.readManifest();

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
                    .forEach(declaredAction => Object.defineProperty(manifest, declaredAction, {}));
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
                    .forEach(declaredCondition => Object.defineProperty(manifest, declaredCondition, {}));
            }
        }

        // write it to file
        await workspace.fs.writeFile(Uri.file(this.getManifestPath()), Buffer.from(JSON.stringify(manifest), 'utf-8'));
        this._onInitialized.fire({ workspace: this });
    }

    public get onChanged(): Event<WorkspaceTreeEvent> {
        return this._onChanged.event;
    }

    public get onInitialized(): Event<WorkspaceEvent> {
        return this._onInitialized.event;
    }

    public isInitialized(): boolean {
        return this.initialized;
    }

    async initialize(): Promise<void> {
        try {
            const manifest = await this.readManifest();
            if (manifest) {
                this.actionsDeclared = manifest.actions && Object.keys(manifest.actions);
                this.conditionsDeclared = manifest.conditions && Object.keys(manifest.conditions);
            }
        }
        catch (ex) {
            window.showWarningMessage(`Unable to read manifest from ${this.manifestPath}.`);
        }

        const manifestWatcher = workspace.createFileSystemWatcher(this.manifestPath);
        manifestWatcher.onDidChange(() => this.initialize());
        manifestWatcher.onDidCreate(() => this.initialize());
        manifestWatcher.onDidDelete(() => this.initialize());

        this.initialized = true;
        this._onInitialized.fire({ workspace: this });
    }

    private async readManifest(): Promise<TreeWorkspaceManifest | undefined> {
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
            const manifestData = await workspace.fs.readFile(manifestUri);
            const manifestText = Buffer.from(manifestData).toString('utf8');
            return JSON.parse(manifestText) as TreeWorkspaceManifest;
        }
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

    upsert(uri: Uri, tree: BehaviorTree) {
        this.trees.set(uri.toString(), tree);
        this.updateConditionsUsed();
        this.updateActionsUsed();
        this._onChanged.fire({
            workspace: this,
            tree: tree,
            uri: uri
        });
    }

    updateActionsUsed() {
        const uniqueActions = new Set<string>();
        [...this.trees.values()]
            .map(tree =>
                [...tree.actions.keys()].map(key => key as string)).forEach(treeActions => treeActions
                    .forEach(c => uniqueActions.add(c)));

        this.actionsUsed.length = 0;
        this.actionsUsed.push(...uniqueActions);
    }
    updateConditionsUsed() {
        const uniqueConditions = new Set<string>();
        [...this.trees.values()]
            .map(tree =>
                [...tree.conditions.keys()].map(key => key as string)).forEach(treeConditions => treeConditions
                    .forEach(c => uniqueConditions.add(c)));

        this.conditionsUsed.length = 0;
        this.conditionsUsed.push(...uniqueConditions);
    }


    /**
     * Awaits a `T` event.
     * @param event event emitter to subscribe to 
     * @param param1 action to execute after subscribing to the event and filter to apply to events
     */
    private async waitFor<T>(event: EventEmitter<T>, { action, filter }: { action?: () => void; filter?: (event: T) => boolean; } = {}): Promise<T> {
        return new Promise<T>(resolve => {
            const subscription = event.event(e => {
                if ((filter && filter(e)) ?? true) {
                    resolve(e);
                    subscription.dispose();
                }
            });

            action && action();
        });
    }

    /**
     * Awaits a `WorkspaceTreeEvent` change.
     * @param action action to perform after subscribing to the event
     * @param filter event filter
     */
    async change({ action, filter }: { action?: () => void; filter?: (event: WorkspaceTreeEvent) => boolean; } = {}): Promise<WorkspaceTreeEvent> {
        return this.waitFor(this._onChanged, { action, filter });
    }

    /**
     * Awaits a `WorkspaceEvent` initialization change.
     * @param action action to perform after subscribing to the event
     * @param filter event filter
     */
    async initialization({ action, filter }: { action?: () => void; filter?: (event: WorkspaceEvent) => boolean; } = {}): Promise<WorkspaceEvent> {
        return this.waitFor(this._onInitialized, { action, filter });
    }

    dispose(): void {
        this._onChanged.dispose();
        this._onInitialized.dispose();
    }
}