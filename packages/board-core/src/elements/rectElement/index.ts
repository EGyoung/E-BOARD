import { IElement } from "../../services";
import { RectCtrlElement } from "./ctrlElement";
import SaveInfoProvider from "./saveInfoProvider";

const rectElement: IElement = {
    type: "rectangle",
    ctrlElement: RectCtrlElement,
    saveInfoProvider: SaveInfoProvider
}

export default rectElement;