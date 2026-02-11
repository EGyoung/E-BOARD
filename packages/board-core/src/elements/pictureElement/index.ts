import { IElement } from "../../services";
import { PictureCtrlElement } from "./ctrlElement";
import SaveInfoProvider from "./saveInfoProvider";

const pictureElement: IElement = {
    type: "picture",
    ctrlElement: PictureCtrlElement,
    saveInfoProvider: SaveInfoProvider
}

export default pictureElement;