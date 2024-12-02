import * as vscode from 'vscode';
import { getEditorHtml, makeEditForArray, makeEditForStringProperty } from './utils';
import { StoryEditorControllerMessage, EditorMessage, IEntryTreeNode, IStoryTextSlot, ITreeNode, StoryTextSlotType, TreeNodeId } from './sharedTypes';
import { JsonArrayEdit, JsonDocument, JsonEdit, JsonObjectEdit, LocalizedDataManager } from '../core';
import assetHelper from '../core/assetHelper';
import { ClassIDType } from '../unityPy/enums';
import { Proxify } from '../pythonInterop';
import fontHelper from './fontHelper';
import { EditorBase } from './editorBase';
import { AssetBundle } from '../unityPy/classes/assetBundle';
import { PPtr } from '../unityPy/classes/pPtr';
import { ObjectBase } from '../unityPy/classes';
import path from 'path';
import os from 'os';

const STORY_VIEW_CATEGORIES = new Set<string>(["02", "04", "09"]);

export class StoryEditorProvider extends EditorBase implements vscode.CustomTextEditorProvider {
    static readonly viewType = 'zokuzoku.storyEditor';

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new StoryEditorProvider(context);
        return vscode.window.registerCustomEditorProvider(StoryEditorProvider.viewType, provider);
    }

    resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, _token: vscode.CancellationToken) {
        // Json document setup
        let json = new JsonDocument<StoryTimelineDataDict | null>(document.uri, null, async () => {
            const subscribedKey = this.subscribedPath[0];
            if (subscribedKey === "title") {
                const content = await getDictValue(subscribedKey);
                postMessage({
                    type: "setTextSlotContent",
                    entryPath: this.subscribedPath,
                    index: 0,
                    content
                });
                postMessage({
                    type: "setExists",
                    path: this.subscribedPath,
                    exists: content !== null
                });
            }
            else {
                const blockIndex = +subscribedKey;
                const ranges = (await dataPromise).contentRanges[+blockIndex];
                if (!ranges) { return; }

                const count = 2 + ranges.choiceDataList.length + ranges.colorTextInfoList.length;
                let exists = false;
                for (let i = 0; i < count; ++i) {
                    const content = await getDictValue(blockIndex, i);
                    postMessage({
                        type: "setTextSlotContent",
                        entryPath: this.subscribedPath,
                        index: i,
                        content
                    });
                    if (content !== null) {
                        exists = true;
                    }
                }
                postMessage({
                    type: "setExists",
                    path: this.subscribedPath,
                    exists
                });
            }
        });
        this.disposables.push(json);

        let initReadPromise = json.readTextDocument().catch(_ => {});
        json.watchTextDocument(document);
        async function getDictValueNode(id: TreeNodeId, index?: number): Promise<jsonToAst.ValueNode | undefined> {
            if (json.ast.type !== "Object") { return; }
            if (id === "title") {
                return json.astObjectsProps.get(json.ast)?.title?.value;
            }

            id = Number(id);
            if (isNaN(id)) { return; }

            let textBlockList = json.astObjectsProps.get(json.ast)?.text_block_list?.value;
            if (!textBlockList || textBlockList.type !== "Array") { return; }

            let textBlock = textBlockList.children.at(id);
            if (!textBlock || textBlock.type !== "Object") { return; }

            if (index === undefined) {
                return textBlock;
            }

            let textBlockProps = json.astObjectsProps.get(textBlock);
            if (!textBlockProps) { return; }

            const ranges = (await dataPromise).contentRanges[id];
            if (index === 0) {
                return textBlockProps.name?.value;
            }
            else if (index === 1) {
                return textBlockProps.text?.value;
            }
            else if (ranges.choiceDataList.contains(index)) {
                const choiceDataList = textBlockProps.choice_data_list?.value;
                if (!choiceDataList || choiceDataList.type !== "Array") { return; }
                return choiceDataList.children[ranges.choiceDataList.offset(index)];
            }
            else if (ranges.colorTextInfoList.contains(index)) {
                const colorTextInfoList = textBlockProps.color_text_info_list?.value;
                if (!colorTextInfoList || colorTextInfoList.type !== "Array") { return; }
                return colorTextInfoList.children[ranges.colorTextInfoList.offset(index)];
            }
        }
        async function getDictValue(id: "title"): Promise<string | null>;
        async function getDictValue(id: TreeNodeId, index: number): Promise<string | null>;
        async function getDictValue(id: TreeNodeId, index?: number): Promise<string | null> {
            const valueNode = await getDictValueNode(id, index);
            return (!valueNode || valueNode.type !== "Literal" || typeof valueNode.value !== "string") ?
                null :
                valueNode.value;
        }

        async function applyEdit(edit: JsonEdit<StoryTimelineDataDict>) {
            try {
                const applied = await json.applyEdit(edit);
                if (!applied) {
                    vscode.window.showErrorMessage("Failed to apply edit");
                }
            }
            catch (e) {
                vscode.window.showErrorMessage("" + e);
            }
        }

        function applyTextBlockListEdit(edit: JsonArrayEdit<TextBlockDict>) {
            return applyEdit({
                type: "object",
                action: "update",
                property: {
                    key: "text_block_list",
                    value: edit
                }
            });
        }
        
        // Init webview
        let assetInfo = StoryEditorProvider.parseFilename(document.uri);
        this.setupWebview(webviewPanel);

        // Messaging setup
        function postMessage(message: StoryEditorControllerMessage) {
            webviewPanel.webview.postMessage(message);
        }

        let dataPromise = StoryEditorProvider.generateData(assetInfo);
        let prevEditPromise: Promise<any> = Promise.resolve();
        webviewPanel.webview.onDidReceiveMessage(async (message: EditorMessage) => {
            let data: InitData;
            try {
                data = await dataPromise;
            }
            catch (e) {
                return vscode.window.showErrorMessage("" + e);
            }
            switch (message.type) {
                case "init":
                    postMessage({ type: "setExplorerTitle", title: "Story" });
                    initReadPromise.finally(async () => {
                        let noWrap = false;
                        if (json.ast.type === "Object") {
                            const noWrapValue = json.astObjectsProps.get(json.ast)?.no_wrap?.value;
                            noWrap = noWrapValue?.type === "Literal" && noWrapValue.value === true;
                        }
                        const ldManager = await LocalizedDataManager.instancePromise;
                        const config = ldManager.config;
                        postMessage({
                            type: "setConfig",
                            config: {
                                noWrap: !config?.use_text_wrapper || noWrap,
                                isStoryView: assetInfo.isStoryView,
                                lineSpacingMultiplier: config?.text_frame_line_spacing_multiplier,
                                fontSizeMultiplier: config?.text_frame_font_size_multiplier,
                                lineWidthMultiplier: config?.line_width_multiplier
                            }
                        });
                        postMessage({ type: "setNodes", nodes: data.nodes });
                        if (data.title) {
                            postMessage({ type: "setExplorerTitle", title: "Story: " + data.title });
                        }
                    });
                    fontHelper.onInit(webviewPanel.webview);
                    break;
                
                case "getTextSlotContent": {
                    let key = message.entryPath[0];
                    postMessage({
                        type: "setTextSlotContent",
                        entryPath: message.entryPath,
                        index: message.index,
                        content: await getDictValue(key, message.index)
                    });
                    break;
                }
                
                case "getExists": {
                    let key = message.path[0];
                    postMessage({
                        type: "setExists",
                        path: message.path,
                        // eslint-disable-next-line eqeqeq
                        exists: (await getDictValueNode(key)) != null
                    });
                    break;
                }

                case "setTextSlotContent": {
                    prevEditPromise = prevEditPromise.then(async () => {
                        let key = message.entryPath[0];
                        if (key === "title") {
                            await applyEdit(makeEditForStringProperty("title", message.content));
                            return;
                        }

                        let blockIndex = +key;
                        let ranges = data.contentRanges[blockIndex];
                        if (!ranges) { return; } // also validates the index

                        if (json.ast.type !== "Object") { return; }
                        let textBlockList = json.astObjectsProps.get(json.ast)?.text_block_list?.value;
                        if (!textBlockList || textBlockList.type !== "Array") {
                            await applyTextBlockListEdit({
                                type: "array",
                                action: "set",
                                values: new Array(blockIndex + 1).fill({})
                            });
                        }
                        else if (textBlockList.children.length <= blockIndex) {
                            await applyTextBlockListEdit(makeEditForArray(textBlockList, {}, blockIndex, {}));
                        }
                        textBlockList = json.astObjectsProps.get(json.ast)!.text_block_list.value as jsonToAst.ArrayNode;

                        let textBlockEdit: JsonObjectEdit<TextBlockDict> | undefined;
                        let index = message.index;
                        if (index === 0 || index === 1) {
                            textBlockEdit = makeEditForStringProperty(index === 0 ? "name" : "text", message.content);
                        }
                        else {
                            let isChoiceData = ranges.choiceDataList.contains(index);
                            if (isChoiceData || ranges.colorTextInfoList.contains(index)) {
                                const textBlock = textBlockList.children[blockIndex];
                                if (!textBlock || textBlock.type !== "Object") {
                                    return vscode.window.showErrorMessage("Invalid text block dict at index " + blockIndex);
                                }

                                const arrayName = isChoiceData ? "choice_data_list" : "color_text_info_list";
                                const listRange = isChoiceData ? ranges.choiceDataList : ranges.colorTextInfoList;

                                const array = json.astObjectsProps.get(textBlock)?.[arrayName]?.value;
                                const listIndex = listRange.offset(index);
                                let listEdit: JsonEdit<string[]>;
                                if (!array || array.type !== "Array") {
                                    if (message.content !== null) {
                                        let values = new Array<string>(listIndex + 1).fill("");
                                        values[listIndex] = message.content;
                                        listEdit = {
                                            type: "array",
                                            action: "set",
                                            values
                                        };
                                    }
                                    else {
                                        return vscode.window.showErrorMessage("Attempted to clear nonexistent list entry");
                                    }
                                }
                                else {
                                    listEdit = makeEditForArray(array, "", listIndex, message.content);
                                }
                                textBlockEdit = {
                                    type: "object",
                                    action: "update",
                                    property: {
                                        key: arrayName,
                                        value: listEdit
                                    }
                                };
                            }
                            else {
                                return vscode.window.showErrorMessage("Invalid text slot");
                            }
                        }

                        if (textBlockEdit) {
                            await applyTextBlockListEdit({
                                type: "array",
                                action: "update",
                                index: blockIndex,
                                value: textBlockEdit
                            });
                        }
                    });
                }
            }
        });
    }

    static parseFilename(uri: vscode.Uri): StoryAssetInfo {
        const pathSplit = uri.path.split("/");
        const filename = pathSplit.at(-1);
        if (!filename) {
            throw new Error("Failed to parse filename");
        }

        let assetBundleName: string;
        let assetName: string;
        let isStoryView: boolean;
        let voiceAssetName: string;
        let voiceCacheDir: string;
        //                               1              2 3      4
        const matches = filename.match(/^(storytimeline_((\d{2})(\d{4})\d{3}))\.json$/) ||
            filename.match(/^(hometimeline_((\d{5})_(\d{2})_\d{7}))\.json$/);
        if (matches) {
            let timelineType = filename.startsWith("story") ? "story" : "home";
            isStoryView = timelineType === "story" ? STORY_VIEW_CATEGORIES.has(matches[3]) : false;
            assetBundleName = `${timelineType}/data/${matches[3]}/${matches[4]}/${matches[1]}`;
            assetName = `assets/_gallopresources/bundle/resources/${assetBundleName}.asset`;
            voiceAssetName = `sound/c/snd_voi_story_${matches[2]}.awb`;
            voiceCacheDir = path.join(os.homedir(), ".zokuzoku", "cache", `snd_voi_story_${matches[2]}`);
        }
        else {
            throw new Error("Failed to parse filename");
        }

        return {
            assetBundleName,
            assetName,
            isStoryView,
            voiceAssetName,
            voiceCacheDir
        }
    }

    static async generateData(info: StoryAssetInfo): Promise<InitData> {
        const { assetBundleName, assetName, isStoryView } = info;

        const env = await assetHelper.loadBundle(assetBundleName);
        const objects = env.objects;
        if (!objects.length) {
            throw new Error("Failed to load asset bundle");
        }
        let assetBundle: Proxify<AssetBundle> | undefined;
        for (const obj of objects) {
            if (obj.type.toJS() === ClassIDType.AssetBundle) {
                assetBundle = obj.read<AssetBundle>(false);
                break;
            }
        }
        if (!assetBundle) {
            throw new Error("Failed to find asset bundle object");
        }
        let assetInfo = assetBundle.m_Container.item(assetName);
        if (!assetInfo) {
            throw new Error("Failed to find timeline data asset");
        }
        let timelineData = assetInfo.asset.get_obj().read(false).type_tree;

        const nodes: ITreeNode<IStoryTextSlot>[] = [];
        const title = (timelineData.item("Title") as Proxify<string>).toJS();
        let resTitle: string | undefined;
        if (title && title !== "0") {
            nodes.push({
                type: "entry",
                id: "title",
                name: "Title",
                icon: "whole-word",
                content: [{ content: title }],
                next: 0
            });
            resTitle = title;
        }

        const blockList = (timelineData.item("BlockList") as Proxify<StoryTimelineBlockData[]>);
        const contentRanges: BlockContentRanges[] = [];
        let prevMaleNode: IEntryTreeNode | undefined;
        let prevFemaleNode: IEntryTreeNode | undefined;
        for (let i = 1; i < blockList.length; ++i) {
            const block = blockList.item(i);
            const textClip = block.TextTrack.ClipList.item(0).get_obj().read<StoryTimelineTextClipData>(false);

            let content: IStoryTextSlot[] = [
                {
                    content: textClip.Name.toJS(),
                    userData: {
                        type: StoryTextSlotType.Name
                    },
                    tooltip: "Name"
                },
                {
                    content: textClip.Text.toJS(),
                    multiline: true,
                    userData: {
                        type: StoryTextSlotType.Content
                    },
                    tooltip: "Content"
                }
            ];

            let start = 2;
            let end = start;
            for (const choiceData of textClip.ChoiceDataList) {
                let tooltip: string | undefined;
                let gender: "male" | "female" | undefined;
                switch (choiceData.DifferenceFlag.toJS()) {
                    case DifferenceFlag.GenderMale:
                        tooltip = "Male trainer choice";
                        gender = "male";
                        break;
                    
                    case DifferenceFlag.GenderFemale:
                        tooltip = "Female trainer choice";
                        gender = "female";
                        break;
                    
                    default:
                        tooltip = "Choice";
                        break;
                }

                content.push({
                    content: choiceData.Text.toJS(),
                    userData: {
                        type: StoryTextSlotType.Choice,
                        gender
                    },
                    link: choiceData.NextBlock.toJS() - 1,
                    tooltip
                });
                ++end;
            }
            const choiceRange = new ContentRange(start, end);

            start = end;
            for (const colorTextInfo of textClip.ColorTextInfoList) {
                content.push({
                    content: colorTextInfo.Text.toJS(),
                    userData: {
                        type: StoryTextSlotType.ColorText
                    },
                    tooltip: "Color text"
                });
                ++end;
            }
            const colorRange = new ContentRange(start, end);

            const id = i - 1;
            let name = id.toString();
            const differenceFlag = textClip.DifferenceFlag.toJS();

            function updatePrevMaleNode() {
                if (prevMaleNode && id >= +prevMaleNode.next!) {
                    prevMaleNode.next = id;
                    prevMaleNode = undefined;
                }
            }

            function updatePrevFemaleNode() {
                if (prevFemaleNode && id >= +prevFemaleNode.next!) {
                    prevFemaleNode.next = id;
                    // Choices always point to the male block
                    for (const slot of prevFemaleNode.content) {
                        if (slot.link) {
                            slot.link = id;
                        }
                    }

                    prevFemaleNode = undefined;
                }
            }

            switch (differenceFlag) {
                case DifferenceFlag.GenderMale:
                    name += " (male trainer)";
                    updatePrevMaleNode();
                    break;

                case DifferenceFlag.GenderFemale:
                    name += " (female trainer)";
                    updatePrevFemaleNode();
                    break;
                
                default:
                    updatePrevMaleNode();
                    updatePrevFemaleNode();
                    break;
            }

            const node: ITreeNode<IStoryTextSlot> = {
                type: "entry",
                id,
                name,
                content,
                prev: nodes[nodes.length - 1]?.id,
                next: textClip.NextBlock.toJS() - 1
            };
            nodes.push(node);
            contentRanges.push({
                choiceDataList: choiceRange,
                colorTextInfoList: colorRange
            });

            switch (differenceFlag) {
                case DifferenceFlag.GenderMale:
                    prevMaleNode = node;
                    break;

                case DifferenceFlag.GenderFemale:
                    prevFemaleNode = node;
                    break;
            }
        }

        return {
            title: resTitle,
            nodes,
            contentRanges
        };
    }

    protected override getHtmlForWebview(webview: vscode.Webview): string {
        return getEditorHtml(this.context.extensionUri, webview, "storyEditor", "Story Editor");
    }
}

interface StoryTimelineDataDict {
    title?: string,
    no_wrap?: boolean,
    text_block_list?: TextBlockDict[]
}

interface TextBlockDict {
    name?: string,
    text?: string,
    choice_data_list?: string[],
    color_text_info_list?: string[]
}

interface StoryAssetInfo {
    assetBundleName: string;
    assetName: string;
    isStoryView: boolean;
    voiceAssetName: string;
    voiceCacheDir: string;
}

interface InitData {
    title?: string;
    nodes: ITreeNode[];
    contentRanges: BlockContentRanges[];
}

interface BlockContentRanges {
    choiceDataList: ContentRange;
    colorTextInfoList: ContentRange;
}

class ContentRange {
    start: number;
    end: number;

    constructor(start: number, end: number) {
        this.start = start;
        this.end = end;
    }

    contains(i: number) {
        return i >= this.start && i < this.end;
    }

    offset(i: number) {
        return i - this.start;
    }

    at(i: number) {
        return this.start + i;
    }

    get length(): number {
        return this.end - this.start;
    }
}

interface StoryTimelineBlockData {
    TextTrack: StoryTimelineTextTrackData;
}

interface StoryTimelineTextTrackData {
    ClipList: PPtr[];
}

interface StoryTimelineTextClipData extends ObjectBase {
    Name: string;
    Text: string;
    ChoiceDataList: ChoiceData[];
    ColorTextInfoList: ColorTextInfo[];
    NextBlock: number;
    DifferenceFlag: DifferenceFlag;
}

enum DifferenceFlag {
    None = 0,
    GenderMale = 2,
    GenderFemale = 4
}

interface ChoiceData {
    Text: string;
    NextBlock: number;
    DifferenceFlag: DifferenceFlag;
}

interface ColorTextInfo {
    Text: string;
}