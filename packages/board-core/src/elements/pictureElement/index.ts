import { IElement } from "../../services";
import { PictureCtrlElement } from "./ctrlElement";
import { Render } from "./render";
import SaveInfoProvider from "./saveInfoProvider";
import { IPictureModel } from "./type";

const pictureElement = {
    type: "picture",
    ctrlElement: PictureCtrlElement,
    saveInfoProvider: SaveInfoProvider,
    render: Render
} satisfies IElement<IPictureModel>;

export default pictureElement;