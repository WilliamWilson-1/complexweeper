// Sprites from 青月晓 / Yueqing-Chen's Complexweeper atlas.
// See ASSET-NOTICE.md for the separate image rights.
export const ATLAS = {"width":208,"height":207,"slots":{"icon":[0,175,32,32],"face_normal":[0,151,24,24],"face_down":[24,151,24,24],"face_dead":[96,151,24,24],"face_win":[72,151,24,24],"face_scan":[48,151,24,24],"led_0":[26,128,13,23],"led_1":[39,128,13,23],"led_2":[52,128,13,23],"led_3":[65,128,13,23],"led_4":[78,128,13,23],"led_5":[91,128,13,23],"led_6":[104,128,13,23],"led_7":[117,128,13,23],"led_8":[130,128,13,23],"led_9":[143,128,13,23],"led_blank":[0,128,13,23],"led_minus":[13,128,13,23],"led_i":[156,128,13,23],"num_0":[0,0,16,16],"num_1":[16,0,16,16],"num_2":[32,0,16,16],"num_4":[48,0,16,16],"num_5":[64,0,16,16],"num_8":[80,0,16,16],"num_9":[96,0,16,16],"num_10":[112,0,16,16],"num_13":[128,0,16,16],"num_16":[144,0,16,16],"num_17":[160,0,16,16],"num_18":[176,0,16,16],"num_20":[192,0,16,16],"num_25":[0,16,16,16],"num_26":[16,16,16,16],"num_29":[32,16,16,16],"num_32":[48,16,16,16],"num_34":[64,16,16,16],"num_36":[80,16,16,16],"num_37":[96,16,16,16],"num_40":[112,16,16,16],"num_49":[128,16,16,16],"num_50":[144,16,16,16],"num_64":[160,16,16,16],"closed":[0,64,16,16],"blank":[16,64,16,16],"flag_1":[32,64,16,16],"mine_1":[128,64,16,16],"boom_1":[16,80,16,16],"wrong_1":[0,96,16,16],"flag_2":[48,64,16,16],"mine_2":[144,64,16,16],"boom_2":[32,80,16,16],"wrong_2":[16,96,16,16],"flag_3":[64,64,16,16],"mine_3":[160,64,16,16],"boom_3":[48,80,16,16],"wrong_3":[32,96,16,16],"flag_4":[80,64,16,16],"mine_4":[176,64,16,16],"boom_4":[64,80,16,16],"wrong_4":[48,96,16,16],"hnum_3":[176,16,16,16],"hnum_7":[192,16,16,16],"hnum_12":[0,32,16,16],"hnum_15":[16,32,16,16],"hnum_21":[32,32,16,16],"hnum_24":[48,32,16,16],"hnum_35":[64,32,16,16],"hnum_48":[80,32,16,16],"hnum_64_i":[176,48,16,16],"hnum_49_i":[160,48,16,16],"hnum_48_i":[144,48,16,16],"hnum_36_i":[128,48,16,16],"hnum_35_i":[112,48,16,16],"hnum_32_i":[96,48,16,16],"hnum_25_i":[80,48,16,16],"hnum_24_i":[64,48,16,16],"hnum_21_i":[48,48,16,16],"hnum_16_i":[32,48,16,16],"hnum_15_i":[16,48,16,16],"hnum_12_i":[0,48,16,16],"hnum_9_i":[192,32,16,16],"hnum_8_i":[176,32,16,16],"hnum_7_i":[160,32,16,16],"hnum_5_i":[144,32,16,16],"hnum_4_i":[128,32,16,16],"hnum_3_i":[112,32,16,16],"hnum_1_i":[96,32,16,16],"led_j":[169,128,13,23],"hrightflag_3":[64,112,16,16],"hright_3":[160,96,16,16],"right_1":[96,96,16,16],"right_3":[128,96,16,16],"hrightflag_4":[80,112,16,16],"hright_4":[176,96,16,16],"right_2":[112,96,16,16],"right_4":[144,96,16,16],"hwrongflag_3":[160,112,16,16],"hwrong_3":[64,96,16,16],"wrongblank":[192,96,16,16],"hwrongflag_4":[176,112,16,16],"hwrong_4":[80,96,16,16],"hflag_3":[96,64,16,16],"hmine_3":[192,64,16,16],"hflag_4":[112,64,16,16],"hmine_4":[0,80,16,16],"hboom_3":[80,80,16,16],"hboom_4":[96,80,16,16],"rightflag_1":[0,112,16,16],"rightflag_3":[32,112,16,16],"rightflag_2":[16,112,16,16],"rightflag_4":[48,112,16,16],"wrongflag_1":[96,112,16,16],"wrongflag_3":[128,112,16,16],"wrongflag_2":[112,112,16,16],"wrongflag_4":[144,112,16,16]}};
export function clueSprite(value) {
  const name = value < 0 ? `hnum_${-value}_i` : Object.hasOwn(ATLAS.slots, `num_${value}`) ? `num_${value}` : `hnum_${value}`;
  return Object.hasOwn(ATLAS.slots, name) ? name : null;
}
export function sprite(name, extra = '') {
  if (!Object.hasOwn(ATLAS.slots, name)) return '';
  return `<span class="sprite sprite-${name}${extra ? ' ' + extra : ''}" aria-hidden="true"></span>`;
}
export function mineSprite(kind, type, mode) {
  return `${mode === 'hyper' && type > 2 ? 'h' : ''}${kind}_${type}`;
}
export function counterText(value) {
  return value < 0 ? '-' + String(-value).padStart(2, '0') : String(value).padStart(3, '0');
}
export function counterSprites(value) {
  return [...counterText(value)].map(digit => sprite(digit === '-' ? 'led_minus' : `led_${digit}`)).join('');
}
