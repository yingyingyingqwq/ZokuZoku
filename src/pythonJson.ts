import { pymport, proxify } from "pymport";
import { Proxify } from "./pythonInterop";

export const json: Proxify<{
    loads(s: string): any,
    dumps(obj: any, options?: { ensure_ascii?: boolean, indent?: number }): string
}> = proxify(pymport("json"));

export default json;