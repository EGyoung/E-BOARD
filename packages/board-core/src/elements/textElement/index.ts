import { IElement } from "../../services";
import { TextCtrlElement } from "./ctrlElement";
import { Render } from "./render";
import SaveInfoProvider from "./saveInfoProvider";
import { ITextModel } from "./type";

const textElement = {
    type: "text",
    ctrlElement: TextCtrlElement,
    saveInfoProvider: SaveInfoProvider,
    render: Render
} satisfies IElement<ITextModel>

export default textElement;
