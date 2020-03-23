# Change Log

## 1.2.x

Enable the `editor.formatOnType` in your VS Code settings. This enables following behaviors:

- When you type `|`, white-space corresponding to one `tab` (per your configuration) is inserted
- When you press `[Enter]`, the same indentation is inserted to the new line
- When you press `[Backspace]` one level of indentation is removed
- When you press `Ctrl+[` or `Cmd+[`, the active row (or all selected rows) are indented +1 level
- When you press `Ctrl+]` or `Cmd+]`, the active row (or all selected rows) are un-indented -1 level

![Tree editing](img/tree_editing.gif)

## 1.0.x

Basic tree visualization and status changing upon double-click.

![Tree visualization and state changes](img/tree_viz.gif)