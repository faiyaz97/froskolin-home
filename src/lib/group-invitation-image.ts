const CANVAS_SIZE = 1080;
const HEADER_LOGO_SRC = "/assets/froskolin-header-logo.png";

type GroupInvitationImageInput = {
  groupName: string;
  houseCode: string;
  joinPin: string;
};

type CanvasContext = CanvasRenderingContext2D;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load invitation artwork: ${src}`));
    image.src = src;
  });
}

function roundedRect(
  context: CanvasContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function drawRoundedRect(
  context: CanvasContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
) {
  roundedRect(context, x, y, width, height, radius);
  context.fillStyle = fill;
  context.fill();
}

function normalizeValue(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function wrapText(context: CanvasContext, value: string, maxWidth: number) {
  const words = value.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    let remaining = word;
    while (remaining) {
      const candidate = current ? `${current} ${remaining}` : remaining;
      if (context.measureText(candidate).width <= maxWidth) {
        current = candidate;
        remaining = "";
        continue;
      }

      if (current) {
        lines.push(current);
        current = "";
        continue;
      }

      let splitAt = remaining.length;
      while (splitAt > 1 && context.measureText(remaining.slice(0, splitAt)).width > maxWidth) {
        splitAt -= 1;
      }
      lines.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt);
    }
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function drawContainImage(
  context: CanvasContext,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.drawImage(
    image,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

function drawLabel(context: CanvasContext, label: string, x: number, y: number) {
  context.fillStyle = "#5e7184";
  context.font = '700 21px "Arial", sans-serif';
  context.letterSpacing = "2px";
  context.fillText(label, x, y);
  context.letterSpacing = "0px";
}

function drawCredential(
  context: CanvasContext,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
) {
  drawLabel(context, label, x, y);
  context.fillStyle = "#11263d";
  let fontSize = 42;
  context.font = `800 ${fontSize}px "Arial", sans-serif`;
  while (fontSize > 12 && context.measureText(value).width > width) {
    fontSize -= 1;
    context.font = `800 ${fontSize}px "Arial", sans-serif`;
  }
  context.fillText(value, x, y + 56, width);
}

/**
 * Create a share-ready invitation card in the browser.
 * The output is a deterministic 1080 x 1080 PNG using same-origin artwork.
 */
export async function createGroupInvitationImage({
  groupName,
  houseCode,
  joinPin,
}: GroupInvitationImageInput): Promise<Blob> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Invitation images can only be created in a browser.");
  }

  const normalizedGroupName = normalizeValue(groupName, 80) || "Your group";
  const normalizedHouseCode = normalizeValue(houseCode, 24);
  const normalizedJoinPin = normalizeValue(joinPin, 24);
  const headerLogo = await loadImage(HEADER_LOGO_SRC);
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const context = canvas.getContext("2d");

  if (!context) throw new Error("Unable to create invitation image canvas.");

  // A single paper ticket keeps the title and joining details visually connected.
  context.fillStyle = "#ccebe2";
  context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  context.shadowColor = "rgba(17, 70, 61, 0.10)";
  context.shadowBlur = 40;
  context.shadowOffsetY = 14;
  drawRoundedRect(context, 64, 64, 952, 952, 48, "#fffdf8");
  context.shadowColor = "transparent";
  context.shadowBlur = 0;
  context.shadowOffsetY = 0;

  drawContainImage(context, headerLogo, 390, 125, 300, 100);

  // A small tilted sticker brings personality without competing with the name.
  context.save();
  context.translate(540, 326);
  context.rotate(-0.055);
  drawRoundedRect(context, -94, -43, 188, 86, 28, "#d7eee4");
  context.fillStyle = "#0f766e";
  context.font = '700 43px "Arial", sans-serif';
  context.textAlign = "center";
  context.fillText("Join", 0, 15);
  context.restore();

  context.fillStyle = "#172f32";
  context.textAlign = "center";
  let fontSize = 92;
  const maxNameLines = normalizedGroupName.length > 42 ? 3 : 2;
  let nameLines: string[];
  do {
    context.font = `800 ${fontSize}px "Arial", sans-serif`;
    nameLines = wrapText(context, normalizedGroupName, 784);
    if (nameLines.length <= maxNameLines && nameLines.length * fontSize * 1.12 <= 240) break;
    fontSize -= 2;
  } while (fontSize > 24);
  const lineHeight = fontSize * 1.12;
  const firstBaseline = 514 - ((nameLines.length - 1) * lineHeight) / 2;
  nameLines.forEach((line, index) =>
    context.fillText(line, 540, firstBaseline + index * lineHeight, 784),
  );
  context.textAlign = "left";

  // Ticket perforation and side notches separate the credentials from the title.
  const dividerY = 708;
  context.strokeStyle = "#d4ddd5";
  context.lineWidth = 2;
  context.setLineDash([8, 10]);
  context.beginPath();
  context.moveTo(112, dividerY);
  context.lineTo(968, dividerY);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = "#ccebe2";
  for (const x of [64, 1016]) {
    context.beginPath();
    context.arc(x, dividerY, 23, 0, Math.PI * 2);
    context.fill();
  }

  const wideCode = normalizedHouseCode.length > 14;
  if (wideCode) {
    drawCredential(context, "GROUP CODE", normalizedHouseCode, 144, 782, 792);
    drawLabel(context, "GROUP PIN", 144, 918);
    context.fillStyle = "#11263d";
    context.font = '800 42px "Arial", sans-serif';
    context.fillText(normalizedJoinPin, 400, 922, 536);
  } else {
    context.strokeStyle = "#dce4dd";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(540, 800);
    context.lineTo(540, 920);
    context.stroke();
    drawCredential(context, "GROUP CODE", normalizedHouseCode || "-", 144, 833, 340);
    drawCredential(context, "GROUP PIN", normalizedJoinPin || "-", 600, 833, 336);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Unable to encode invitation image as PNG."));
    }, "image/png");
  });
}
