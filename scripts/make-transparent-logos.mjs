import sharp from "sharp";

async function removeDarkBg(input, output) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r < 40 && g < 40 && b < 40) data[i + 3] = 0;
  }

  await sharp(data, { raw: info }).png().toFile(output);
  console.log(`created ${output}`);
}

async function removeLightGrayBg(input, output) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const avg = (r + g + b) / 3;
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    const isLightGrayBg = spread < 18 && avg > 205 && avg < 252;

    if (isLightGrayBg) data[i + 3] = 0;
  }

  await sharp(data, { raw: info }).png().toFile(output);
  console.log(`created ${output}`);
}

await removeDarkBg("focus branca.png", "src/assets/focus-branca.png");
await removeLightGrayBg("HubOn Branco.jpeg", "src/assets/hub-on-branco.png");
await removeLightGrayBg("HubOn Branco.jpeg", "public/hub-on-branco.png");
