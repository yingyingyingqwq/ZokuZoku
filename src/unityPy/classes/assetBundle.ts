import { NamedObject } from "./namedObject";
import { PPtr } from "./pPtr";

export interface AssetBundle extends NamedObject {
    // STUB
    m_Container: Map<string, AssetInfo>;
}

export interface AssetInfo {
    // STUB
    asset: PPtr
}