import { IElement } from "../../services";
import { RectCtrlElement } from "./ctrlElement";
import { Render } from "./render";
import SaveInfoProvider from "./saveInfoProvider";
import { IShapeRectangle } from "./type";

const rectElement = {
    type: "rectangle",
    ctrlElement: RectCtrlElement,
    saveInfoProvider: SaveInfoProvider,
    render: Render
} satisfies IElement<IShapeRectangle>

export default rectElement;