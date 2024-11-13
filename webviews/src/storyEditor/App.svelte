<script lang="ts">
    import Workspace from "../lib/Workspace.svelte";
    import type { StoryEditorControllerMessage } from "../sharedTypes";
    import { config, originalPreview, translatedPreview } from "./stores";
    import WorkspaceInner from "./WorkspaceInner.svelte";

    function onMessage(e: MessageEvent<StoryEditorControllerMessage>) {
        const message = e.data;
        switch (message.type) {
            case "setConfig":
                $config = message.config;
                const defaultPreview = message.config.isStoryView ? "story" : "dialogue";
                if ($originalPreview === undefined) {
                    $originalPreview = defaultPreview;
                }
                if ($translatedPreview === undefined) {
                    $translatedPreview = defaultPreview;
                }
                break;
        };
    }
</script>

<svelte:window on:message={onMessage} />

<Workspace inner={WorkspaceInner} />