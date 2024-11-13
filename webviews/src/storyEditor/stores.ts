import { writable, type Writable } from "svelte/store";
import type { StoryEditorConfig } from "../sharedTypes";
import { userData } from "../stores";

export interface StoryEditorState {
    originalPreview?: PreviewType | null,
    translatedPreview?: PreviewType | null
}
export type PreviewType = "dialogue" | "story";

export const config = writable<StoryEditorConfig | null>(null);
export const storyEditorState = userData as Writable<StoryEditorState>;

let initState: StoryEditorState;
storyEditorState.update(s => {
    initState = s ?? {}
    return initState;
});

export const originalPreview = writable<PreviewType | null>(initState!.originalPreview);
export const translatedPreview = writable<PreviewType | null>(initState!.translatedPreview);

originalPreview.subscribe(originalPreview => storyEditorState.update(s => ({ ...s, originalPreview })));
translatedPreview.subscribe(translatedPreview => storyEditorState.update(s => ({ ...s, translatedPreview })));