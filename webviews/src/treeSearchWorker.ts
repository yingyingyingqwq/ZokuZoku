import type { ITreeNode, TreeNodeId } from "./sharedTypes"

export interface SearchOptions {
    caseSensitive: boolean,
    regex: boolean,
    searchInContent: boolean,
    excludeCategoryNames: boolean
}

export type SearchRequest = {
    type: "start",
    nodes: ITreeNode[],
    query: string,
    options: SearchOptions
}

export type SearchResponse = {
    type: "result",
    node: ITreeNode,
    parents: { id: TreeNodeId, name: string }[]
} | {
    type: "end"
};

type Matcher = (input: string) => boolean;

function createMatcher(query: string, options: SearchOptions): Matcher {
    if (options.regex) {
        return input => new RegExp(query, options.caseSensitive ? undefined : "i").test(input);
    }

    if (options.caseSensitive) {
        return input => input.includes(query);
    }

    query = query.toLowerCase();
    return input => input.toLowerCase().includes(query);
}

function treeSearch(
    nodes: ITreeNode[], matchString: Matcher, options: SearchOptions,
    parents: { id: TreeNodeId, name: string }[] = []
) {
    function pushResult(node: ITreeNode) {
        let message: SearchResponse = {
            type: "result",
            node,
            parents
        };
        postMessage(message);
    }

    for (const node of nodes) {
        let nameMatch = matchString(node.name);
        switch (node.type) {
            case "category": {
                if (nameMatch && !options.excludeCategoryNames) {
                    pushResult({
                        ...node,
                        children: []
                    });
                }
                treeSearch(
                    node.children, matchString, options,
                    [...parents, { id: node.id, name: node.name }]
                );
                break;
            }
            
            case "entry":
                let contentMatch = false;
                if (options.searchInContent) {
                    for (const slot of node.content) {
                        if (matchString(slot.content)) {
                            contentMatch = true;
                            break;
                        }
                    }
                }

                if (nameMatch || contentMatch) {
                    pushResult(node);
                }
                break;
        }
    }
}

addEventListener("message", e => {
    const message: SearchRequest = e.data;
    switch (message.type) {
        case "start": {
            const matcher = createMatcher(message.query, message.options);
            treeSearch(message.nodes, matcher, message.options);

            const res: SearchResponse = { type: "end" };
            postMessage(res);
            close();
            break;
        }
    }
});