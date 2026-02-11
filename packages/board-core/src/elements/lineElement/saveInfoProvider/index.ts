class SaveInfoProvider {
    static parse(data: any) {
        return {
            points: data.points,
            options: { ...data.options },
        }
    }

    static importSaveInfo(info: any) {
        return {
            points: info.points,
            options: { ...info.options },
        }
    }
}



export default SaveInfoProvider;