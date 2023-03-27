// one-off I ran manually with CodeRunner

function generateSpritesheet() {
  const frames = {};
  const suits = ['hearts', 'clubs', 'diamonds', 'spades'];
  const width = 490;

  let suit = 0;

  for (let y = 0; y < 188; y += 47) {
    let num = 2;

    for (let x = 35; x < 490; x += 35) {
      const label =
        num === 11
          ? 'j'
          : num === 12
          ? 'q'
          : num === 13
          ? 'k'
          : num === 14
          ? 'a'
          : num;

      frames[`${suits[suit]}_${label}`] = {
        frame: { x: x + 1, y: y + 1, w: 33, h: 45 },
        sourceSize: { w: 33, h: 45 },
        spriteSourceSize: { x: 0, y: 0, w: 33, h: 45 }
      };

      num++;
    }
    suit++;
  }

  return frames;
}

console.log(generateSpritesheet());
