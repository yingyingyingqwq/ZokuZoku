import { NamedObject } from "./namedObject";

export interface TextAsset extends NamedObject {
    script: Buffer,
    text: string
}