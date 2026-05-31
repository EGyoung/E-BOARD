import { Point } from './type';

export function drawCursor(ctx: CanvasRenderingContext2D, point: Point, eraserSize: number) {
    const radius = eraserSize / 2;
    const bodyWidth = Math.max(18, radius * 1.45);
    const bodyHeight = Math.max(10, radius * 0.82);

    ctx.save();

    const haloGradient = ctx.createRadialGradient(point.x, point.y, radius * 0.2, point.x, point.y, radius * 1.55);
    haloGradient.addColorStop(0, 'rgba(255, 255, 255, 0.72)');
    haloGradient.addColorStop(0.62, 'rgba(145, 176, 255, 0.14)');
    haloGradient.addColorStop(1, 'rgba(145, 176, 255, 0)');
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius * 1.55, 0, 2 * Math.PI);
    ctx.fillStyle = haloGradient;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.strokeStyle = 'rgba(45, 58, 86, 0.58)';
    ctx.lineWidth = 1.25;
    ctx.setLineDash([4, 4]);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.translate(point.x, point.y);
    ctx.rotate(-Math.PI / 5);
    ctx.shadowColor = 'rgba(15, 23, 42, 0.22)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;

    const bodyGradient = ctx.createLinearGradient(-bodyWidth / 2, -bodyHeight / 2, bodyWidth / 2, bodyHeight / 2);
    bodyGradient.addColorStop(0, '#fff7fb');
    bodyGradient.addColorStop(0.46, '#eef4ff');
    bodyGradient.addColorStop(1, '#d9e7ff');

    ctx.beginPath();
    ctx.roundRect(-bodyWidth / 2, -bodyHeight / 2, bodyWidth, bodyHeight, 4);
    ctx.fillStyle = bodyGradient;
    ctx.strokeStyle = 'rgba(31, 41, 55, 0.62)';
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();

    ctx.shadowColor = 'transparent';
    ctx.beginPath();
    ctx.roundRect(bodyWidth * 0.04, -bodyHeight / 2 + 1, bodyWidth * 0.43, bodyHeight - 2, 3);
    ctx.fillStyle = 'rgba(247, 183, 200, 0.9)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(bodyWidth * 0.02, -bodyHeight / 2 + 1.5);
    ctx.lineTo(bodyWidth * 0.02, bodyHeight / 2 - 1.5);
    ctx.strokeStyle = 'rgba(31, 41, 55, 0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-bodyWidth * 0.34, -bodyHeight * 0.18);
    ctx.lineTo(-bodyWidth * 0.08, bodyHeight * 0.08);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.restore();
}
