export interface ILine {
  id: string;
  points: { x: number; y: number }[];
}

export interface TextLayoutInfo {
  lines: string[];
  lineHeight: number;
  fontSize: number;
  fontFamily: string;
  textAlign: string;
  paddingTop: number;
  paddingLeft: number;
  dpr: number;  // 设备像素比
}

export interface IRectangleModel {
  width: number;
  height: number;
  text?: string;
  textLayout?: TextLayoutInfo;
  fillStyle?: string;
}
