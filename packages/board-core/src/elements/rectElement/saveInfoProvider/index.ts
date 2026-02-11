class SaveInfoProvider {
    static parse(data: any) {
        /**
         *  points: [{ x: transformedPoint.x, y: transformedPoint.y }],
        width: 0,
        height: 0,
        isDrawing: true,
        options: {
          ...this.configService.getCtxConfig()
        },
         */
        return {
            points: [...data.points],
            width: data.width,
            height: data.height,
            options: { ...data.options },
        }
    }

    static importSaveInfo(info: any) {
        return {
            isDrawing: false,
            points: info.points,
            width: info.width,
            height: info.height,
            options: info.options,
        }
    }
}



export default SaveInfoProvider;