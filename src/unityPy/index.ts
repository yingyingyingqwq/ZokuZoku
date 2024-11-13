import { pymport, proxify, PyObject } from "pymport";
import Environment from "./environment";
import { Proxify } from "../pythonInterop";

export const UnityPy: Proxify<{
    __version__: string,
    load: (...args: (string | PyObject | { fs: PyObject })[]) => Environment,
}> = proxify(pymport("UnityPy"));

export default UnityPy;