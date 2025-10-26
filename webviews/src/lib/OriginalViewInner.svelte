<script lang="ts">
    import { currentTextSlots } from "../stores";
    import type { IPanelAction } from "../types";
    import GenericSlots from "./GenericSlots.svelte";
    import TextSlot from "./TextSlot.svelte";
    import type { ControllerMessage } from "../sharedTypes";
    import { vscode } from "../vscode";

    export let actions: (IPanelAction | null)[] | undefined = undefined;

    function onMessage(e: MessageEvent<ControllerMessage>) {
        const message = e.data;
        if (message.type == "enableVoicePlayer") {
            actions = [{
                icon: "unmute",
                tooltip: "播放语音片段",
                onClick: () => {
                    vscode.postMessage({ type: "loadVoice" });
                }
            }];
        }
    }
</script>

<svelte:window on:message={onMessage} />

<GenericSlots>
    {#each $currentTextSlots as slot}
        <TextSlot readonly {...slot} />
    {/each}
</GenericSlots>