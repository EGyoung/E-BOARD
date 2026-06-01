import { IElement } from "../../services";
import { CircleCtrlElement } from "./ctrlElement";
import { Render } from "./render";
import SaveInfoProvider from "./saveInfoProvider";
import { ICircleModel } from "./type";

const circleElement = {
    type: "circle",
    ctrlElement: CircleCtrlElement,
    saveInfoProvider: SaveInfoProvider,
    render: Render
} satisfies IElement<ICircleModel>;

export default circleElement;
