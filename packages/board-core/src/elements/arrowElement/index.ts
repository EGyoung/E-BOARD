import { IElement } from "../../services";
import { ArrowCtrlElement } from "./ctrlElement";
import { Render } from "./render";
import SaveInfoProvider from "./saveInfoProvider";
import { IArrowModel } from "./type";

const arrowElement = {
    type: "arrow",
    ctrlElement: ArrowCtrlElement,
    saveInfoProvider: SaveInfoProvider,
    render: Render
} satisfies IElement<IArrowModel>;

export default arrowElement;
