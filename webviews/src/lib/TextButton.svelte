<button {...$$restProps}>
    <slot />
</button>

<style>
    button {
        align-items: center;
        border: 1px solid var(--vscode-button-border, transparent);
        border-radius: 2px;
        box-sizing: border-box;
        cursor: pointer;
        display: flex;
        justify-content: center;
        line-height: 18px;
        padding: 4px;
        text-align: center;
        width: 100%;
        color: var(--vscode-button-foreground);
        background-color: var(--vscode-button-background);
    }

    button:hover {
        background-color: var(--vscode-button-hoverBackground);
    }

    button:focus {
        opacity: 1;
        outline-color: var(--vscode-focusBorder);
        outline-offset: 2px;
        outline-style: solid;
        outline-width: 1px;
    }
</style>