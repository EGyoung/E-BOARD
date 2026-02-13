import { IElement } from "../../services";
import { PictureCtrlElement } from "./ctrlElement";
import { Render } from "./render";
import SaveInfoProvider from "./saveInfoProvider";

const pictureElement = {
    type: "picture",
    ctrlElement: PictureCtrlElement,
    saveInfoProvider: SaveInfoProvider,
    render: Render
} satisfies IElement;

export default pictureElement;