// one-off I ran manually with CodeRunner

function generateSpritesheet() {
  const frames = {};
  const suits = ['spades', 'hearts', 'clubs', 'diamonds'];
  const width = 2730;
  const height = 1450;

  let suit = 0;

  for (let y = 0; y < height - 290; y += 290) {
    let num = 1;

    for (let x = 0; x < width; x += 210) {
      const label =
        num === 11
          ? 'j'
          : num === 12
          ? 'q'
          : num === 13
          ? 'k'
          : num === 1
          ? 'a'
          : num;

      frames[`${suits[suit]}_${label}`] = {
        frame: { x: x, y: y, w: 210, h: 290 },
        sourceSize: { w: 210, h: 290 },
        spriteSourceSize: { x: 0, y: 0, w: 210, h: 290 }
      };

      num++;
    }
    suit++;
  }

  return frames;
}

console.log(JSON.stringify(generateSpritesheet()));
