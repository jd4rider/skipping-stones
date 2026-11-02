import Phaser from 'phaser'
import { H, W, makeTextures } from './common.js'
import { audioState } from '../sound.js'
import { data } from '../save.js'
import MenuScene from './MenuScene.js'
import LevelsScene from './LevelsScene.js'
import LakeScene from './LakeScene.js'
import ResultsScene from './ResultsScene.js'
import StonesScene from './StonesScene.js'
import SettingsScene from './SettingsScene.js'
import AchievementsScene from './AchievementsScene.js'

class BootScene extends Phaser.Scene {
  constructor() {
    super('boot')
  }

  create() {
    makeTextures(this)
    audioState.muted = !data.settings.sound
    audioState.musicOn = data.settings.music
    this.scene.start('menu')
  }
}

export function startGame(parent) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: W,
    height: H,
    backgroundColor: '#0c2333',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, roundPixels: false },
    scene: [BootScene, MenuScene, LevelsScene, LakeScene, ResultsScene, StonesScene, SettingsScene, AchievementsScene],
  })
}
