export interface IPanelAction {
    icon: string, // codicon icon name
    tooltip?: string,
    onClick: (e: MouseEvent) => void
}