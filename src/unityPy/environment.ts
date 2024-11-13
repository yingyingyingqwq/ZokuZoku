import { Proxify } from "../pythonInterop";
import { ObjectReader } from "./files";

export default interface Environment {
    objects: ObjectReader[]
}

// type alias for proxy
export type UnityPyEnv = Proxify<Environment>;