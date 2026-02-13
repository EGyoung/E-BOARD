import { eBoardContainer } from "src/common/IocContainer";
import { IConfigService } from "src/services";

class SaveInfoProvider {

    static parse(data: any) {
        return {
            type: data.type,
            points: data.points,
            options: data.options,
            id: data.id,
        }
    }

    static importSaveInfo(info: any) {
        return {
            type: info.type,
            points: info.points,
            options: info?.options ? { ...info.options } : undefined,
            id: info.id
        }
    }
}



export default SaveInfoProvider;