import { Image } from "../../pil/image";
import { Texture } from "./texture";

export interface Texture2D extends Texture {
    m_Width: number,
    m_Height: number,

    image: Image
}