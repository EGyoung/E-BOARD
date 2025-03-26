import { IServiceInitParams } from "../../types";

class SelectionService {
  constructor() {
    console.log("SelectionService initialized");
  }

  init({ board }: IServiceInitParams) {
    console.log(board, "board");
    console.log("SelectionService init", board);
  }
}

export default SelectionService;
