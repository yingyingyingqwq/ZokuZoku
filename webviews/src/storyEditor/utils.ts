import { wrapText } from "hachimi_lib";
import type { StoryEditorConfig } from "../sharedTypes";

export function makeContentDisplayValue(
    value: string | null, lineWidth: number, config: StoryEditorConfig | null, readonly: boolean
) {
    return !readonly && config?.noWrap === false && config.lineWidthMultiplier ?
        wrapText(value ?? "", lineWidth, config.lineWidthMultiplier).join("\n") :
        value ?? "";
}