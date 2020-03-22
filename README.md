# VS Code Behavior Tree editor

Behavior trees are a technique used in video games and robotics to model behavior AI. Their use has become increasingly popular due to their simple implementation, ease of understanding, and flexibility.\
This extension provides visualization of trees authored in the language suggested by [Dan Abad's behavior_tree project](https://github.com/0xabad/behavior_tree/).

## Features

Open a `*.tree` that adheres to the [syntax](https://github.com/0xabad/behavior_tree/#syntax).\
Right-click on the editor text and select Preview or invoke the _Open Preview to the Side_ command.\
Double-click on a condition node to toggle its state between _success/_failed_.\
Double-click on an action node to switch its state between _running_/_success_/_failed_. Hold the _shift_ key to transition from _running_ to _failed_.

![Tree visualization and state changes](img/tree_viz.gif)

## Release Notes

### 0.0.1

Basic tree visualization and status changing upon double-click.
