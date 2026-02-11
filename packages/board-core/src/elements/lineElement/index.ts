import { IElement } from "../../services";
import { LineCtrlElement } from "./ctrlElement";
import SaveInfoProvider from "./saveInfoProvider";

const lineElement: IElement = {
    type: "line",
    ctrlElement: LineCtrlElement,
    saveInfoProvider: SaveInfoProvider
}

export default lineElement;