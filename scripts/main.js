var morseTextContainer = document.getElementById('morse-text');
var bodyElement = document.getElementById('main');
var isTrue = true;
var charBuffer = '';
var mouseDownTime;
var mouseUpTime;
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

const newAudioContext = new AudioContext();

function beep(vol, freq, duration) {
  let v = newAudioContext.createOscillator();
  let u = newAudioContext.createGain();
  v.connect(u);
  v.frequency.value = freq;
  v.type = 'square';
  u.connect(newAudioContext.destination);
  u.gain.value = vol * 0.01;
  v.start(newAudioContext.currentTime);
  v.stop(newAudioContext.currentTime + duration * 0.001);
}

function playDit() {
  beep(50, 500, 100);
}

function playDah() {
  beep(50, 500, 300);
}

function itsError() {
  bodyElement.classList.remove('success');
  bodyElement.classList.add('error');
}

function itsSuccess() {
  bodyElement.classList.remove('error');
  bodyElement.classList.add('success');
}

function getRandom(max) {
  return (Math.random() * (max - 1 - +0) + +0).toFixed(0);
}

function showRandomCharacter() {
  charBuffer = '';
  bodyElement.classList.remove('error');
  bodyElement.classList.remove('success');
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
    itsSuccess();
    charBuffer = '';
    setTimeout(function(){
      showRandomCharacter();
    },1000);
  } else {
    if(charBuffer.length >= morseDataSet[`MC${mcc}`].length){
      itsError();
    }
    console.log('not yet');
  }
}


(function() {
  bodyElement.addEventListener("mousedown", function(){
    mouseDownTime = Date.now();
  });
bodyElement.addEventListener('mouseup', function() {
  mouseUpTime = Date.now();
  if (mouseUpTime - mouseDownTime < 100) {
    validateMorse('0');
    playDit();
  } else {
    validateMorse('1');
    playDah();
  }
});

  setTimeout(function(){
    showRandomCharacter();
  }, 3000)
})();