import { IElement } from "../../services";
import { LineCtrlElement } from "./ctrlElement";
import { Render } from "./render";
import SaveInfoProvider from "./saveInfoProvider";

const lineElement = {
    type: "line",
    ctrlElement: LineCtrlElement,
    saveInfoProvider: SaveInfoProvider,
    render: Render
} satisfies IElement;

export default lineElement;