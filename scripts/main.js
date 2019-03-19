var morseTextContainer = document.getElementById('morse-text');
var isTrue = true;
var charBuffer = '';
var charSet = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
];

var morseDataSet = {
  MCA: '01',
  MCB: '1000',
  MCC: '1010',
  MCD: '100',
  MCE: '0',
  MCF: '0010',
  MCG: '110',
  MCH: '0000',
  MCI: '00',
  MCJ: '0111',
  MCK: '101',
  MCL: '0100',
  MCM: '11',
  MCN: '10',
  MCO: '111',
  MCP: '0110',
  MCQ: '1101',
  MCR: '010',
  MCS: '000',
  MCT: '1',
  MCU: '001',
  MCV: '0001',
  MCW: '011',
  MCX: '1001',
  MCY: '1011',
  MCZ: '1100',
  MC0: '11111',
  MC1: '01111',
  MC2: '00111',
  MC3: '00011',
  MC4: '00001',
  MC5: '00000',
  MC6: '10000',
  MC7: '11000',
  MC8: '11100',
  MC9: '11110',
};

function getRandom(max) {
  return (Math.random() * (max - 1 - +0) + +0).toFixed(0);
}

function showRandomCharacter() {
  let charSelected = charSet[getRandom(charSet.length)];
  morseTextContainer.setAttribute('data-text', charSelected);
  morseTextContainer.innerHTML = charSelected;
}

function validateMorse(mc) {
  console.log(mc);
  let mcc = document.getElementById('morse-text').getAttribute('data-text');
  charBuffer += mc;
  if (charBuffer.includes(morseDataSet[`MC${mcc}`])) {
    console.log('found...');
    charBuffer = '';
    showRandomCharacter();
  } else {
    console.log('not yet');
  }
}

function myKeyPress(e) {
  var keynum;
  if (window.event) {
    keynum = e.keyCode;
  } else if (e.which) {
    keynum = e.which;
  }
  validateMorse(String.fromCharCode(keynum));
}

(function() {
  showRandomCharacter();
})();