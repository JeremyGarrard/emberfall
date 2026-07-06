const config = {
  // "?canvas" forces the Canvas renderer — handy for headless captures/debugging
  type: location.search.includes('canvas') ? Phaser.CANVAS : Phaser.AUTO,
  pixelArt: true,
  transparent: true, // the three.js world shows through; Phaser draws the UI
  backgroundColor: 'rgba(0,0,0,0)',
  scale: {
    parent: 'game',
    mode: Phaser.Scale.FIT,          // fill the window, keep 3:2, letterbox the rest
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,
    height: 640,
  },
  scene: [BootScene, WorldScene],
};

window.game = new Phaser.Game(config);
