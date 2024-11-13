import { PreProxied, Proxify } from "../../pythonInterop";
import { ObjectBase } from "../classes";
import { ClassIDType } from "../enums";

export interface ObjectReader {
    type: ClassIDType,
    // Function signature forces return object
    read: PreProxied<<T extends ObjectBase = ObjectBase>(return_typetree_on_error: false) => Proxify<T>>;
    read_typetree: (nodes?: any[], wrap?: boolean) => Map<string, any>;
}