import { IRectangleModel } from "src/plugins/drawShape/type";
import { IElement } from "../../services";
import { RectCtrlElement } from "./ctrlElement";
import { Render } from "./render";
import SaveInfoProvider from "./saveInfoProvider";

const rectElement = {
    type: "rectangle",
    ctrlElement: RectCtrlElement,
    saveInfoProvider: SaveInfoProvider,
    render: Render
} satisfies IElement<IRectangleModel>

export default rectElement;