class SaveInfoProvider {
    static parse(data: any) {
        return {
            type: data.type,
            points: data.points,
            options: { ...data.options },
        }
    }

    static importSaveInfo(info: any) {
        return {
            type: info.type,
            points: info.points,
            options: { ...info.options },
        }
    }
}



export default SaveInfoProvider;