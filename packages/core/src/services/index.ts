import { IService } from "./type";

class BaseService implements IService {
    init(): void {
        console.log('BaseService init');
    }
    dispose(): void {
        console.log('BaseService dispose');
    }
}

export default BaseService;
export type { IService };
