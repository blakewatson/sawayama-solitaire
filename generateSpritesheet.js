// one-off I ran manually with CodeRunner

function generateSpritesheet() {
  const frames = {};
  const suits = ['spades', 'hearts', 'clubs', 'diamonds'];
  const width = 3900;
  const height = 2000;
  const cardWidth = 300;
  const cardHeight = 400;

  let suit = 0;

  for (let y = 0; y <= height - cardHeight; y += cardHeight) {
    let num = 1;
    let row = y / cardHeight;

    // if row 4, then we are on the back of the cards, so loop through red, blue, and green backs
    if (row === 4) {
      const colors = ['red', 'blue', 'green'];
      for (let x = 0; x <= cardWidth * (colors.length - 1); x += cardWidth) {
        const color = colors[(x / cardWidth) % colors.length];
        const label = `back_${color}`;
        frames[label] = {
          frame: { x, y, w: cardWidth, h: cardHeight },
          sourceSize: { w: cardWidth, h: cardHeight },
          spriteSourceSize: { x: 0, y: 0, w: cardWidth, h: cardHeight }
        };
      }

      // deck card sprite
      frames['deck_blank'] = {
        frame: { x: colors.length * cardWidth, y, w: cardWidth, h: cardHeight },
        sourceSize: { w: cardWidth, h: cardHeight },
        spriteSourceSize: { x: 0, y: 0, w: cardWidth, h: cardHeight }
      };
      continue;
    }

    for (let x = 0; x < width; x += cardWidth) {
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
        frame: { x: x, y: y, w: cardWidth, h: cardHeight },
        sourceSize: { w: cardWidth, h: cardHeight },
        spriteSourceSize: { x: 0, y: 0, w: cardWidth, h: cardHeight }
      };

      num++;
    }
    suit++;
  }

  return { frames, meta: { scale: 1 } };
}

console.log(JSON.stringify(generateSpritesheet()));
