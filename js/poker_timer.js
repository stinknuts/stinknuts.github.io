var CustomEvents = function() {
    var subscribers = {};
    return {
        on: function(topic, fn) {
            if (typeof topic === 'string' && typeof fn === 'function') {
                subscribers[topic] = subscribers[topic] || [];
                subscribers[topic].push(fn);
            }
        },
        off: function(topic, fn) {
            subscribers[topic].splice(subscribers[topic].indexOf(fn), 1);
        },
        emit: function(topic, data) {
            if (subscribers[topic]) {
                subscribers[topic].forEach(function(fn) {
                    fn(data);
                });
            }
        }
    };
};

function zeroPad(num) {
	return num < 10 ? '0' + num : num;
}

var Beeper = {
	audioCtx: new AudioContext(),
	oscillator: undefined,
	play: function() {
		var gainNode = this.audioCtx.createGain	();
		this.oscillator = this.audioCtx.createOscillator();
		this.oscillator.connect(gainNode);
		gainNode.connect(this.audioCtx.destination);
		this.oscillator.type = 'sine';
		this.oscillator.frequency.value = 880;
		this.oscillator.start();
	},
	stop: function() {
		this.oscillator.stop();
		this.oscillator = undefined;
	},
	beep: function() {
		var self = this;
		self.play();
		setTimeout(function() {
			self.stop();
		}, 500);
	},
	beeps: function(numBeeps) {
		var self = this;
		var times = 0;
		var intvl = setInterval(function() {
			times += 1;
			if (times >= numBeeps) {
				clearInterval(intvl);
			}
			self.beep();
		}, 1000);
	}
};

var Model =  {
	events: CustomEvents(),
	blindsSchedule: [
		{small: 1, big: 2},
		{small: 2, big: 4},
		{small: 5, big: 10}
	],
	currentBlindIndex: 0,
	roundTime: {
		minutes: 25,
		seconds: 0
	},
	currentRoundTime: {},
	initializeTimeRemaining: function() {
		this.currentRoundTime.minutes = this.roundTime.minutes;
		this.currentRoundTime.seconds = this.roundTime.seconds;
		this.events.emit('timeRemainingInitialized', this.currentRoundTime);		
	},
	resetCurrentRoundTime: function() {
		this.currentRoundTime.minutes = this.roundTime.minutes;
		this.currentRoundTime.seconds = this.roundTime.seconds;
	},
	updateTimeRemaining: function() {
		if (this.currentRoundTime.minutes === 0 && this.currentRoundTime.seconds === 0) {
			this.resetCurrentRoundTime();
			this.events.emit('newRoundStarted');
		}

		if (this.currentRoundTime.seconds === 0) {
			this.currentRoundTime.minutes = this.currentRoundTime.minutes - 1;
			this.currentRoundTime.seconds = 59;
		} else {
			this.currentRoundTime.seconds = this.currentRoundTime.seconds - 1;
		}

		if (this.currentRoundTime.minutes <= 1) {
			this.events.emit('roundEndWarning', this.currentRoundTime);
		}

		if (this.currentRoundTime.minutes === 2 && this.currentRoundTime.seconds === 0) {
			this.events.emit('twoMinuteWarning');
		}

		if (this.currentRoundTime.minutes === 0 && this.currentRoundTime.seconds === 10) {
			this.events.emit('tenSecondsWarning');
		}


		this.events.emit('timeUpdated', this.currentRoundTime);
	},
	initializeBlinds: function() {
		this.events.emit('blindsInitialized', this.blindsSchedule[this.currentBlindIndex]);
	},
	incrementCurrentBlind: function() {
		this.currentBlindIndex = this.currentBlindIndex + 1;
		if (this.blindsSchedule[this.currentBlindIndex] === undefined) {
			var lastBlinds = this.blindsSchedule[this.currentBlindIndex - 1];
			var newBlinds = {
				small: lastBlinds.small * 2,
				big : lastBlinds.big * 2
			};
			this.blindsSchedule.push(newBlinds);
		}
		this.events.emit('blindsIncremented', this.blindsSchedule[this.currentBlindIndex]);
	},
	setRoundTime: function(roundTime) {
		var roundTime = parseInt(roundTime, 10);
		if (!isNaN(roundTime)) {
			this.roundTime = {
				minutes: roundTime,
				seconds: 0
			}
			this.initializeTimeRemaining();
		}
	}
};

var View = {
	dom: {
		'timeRemainingColumn': document.querySelector('#TimeRemainingCol'),
		'timeRemaining': document.querySelector('#TimeRemaining'),
		'blindsSchedule': document.querySelector('#BlindsSchedule'),
		'startBtn': document.querySelector('#StartBtn'),
		'roundTimeInput': document.querySelector('#RoundTime'),
		'menuBtn': document.querySelector('#MenuBtn'),
		'menu': document.querySelector('#Menu'),
		'menuCloseBtn': document.querySelector('#MenuCloseBtn'),
		'setRoundTimeBtn': document.querySelector('#SetRoundTimeBtn')
	},
	bindUIEvents: function() {
		this.dom.startBtn.addEventListener('click', Controller.start.bind(Controller));
		this.dom.menuBtn.addEventListener('click', this.openMenu.bind(this));
		this.dom.menuCloseBtn.addEventListener('click', this.closeMenu.bind(this));
		this.dom.setRoundTimeBtn.addEventListener('click', Controller.setRoundTime.bind(Controller));
	},
	renderTimeRemaining: function(timeRemaining) {
		this.dom.timeRemaining.innerHTML = timeRemaining.minutes + ':' + zeroPad(timeRemaining.seconds);
	},
	renderBlinds: function(currentBlinds) {
		this.dom.blindsSchedule.innerHTML = currentBlinds.small + ' and ' + currentBlinds.big;
	},
	flashTimeRemaining: function(currentRoundTime) {
		if (currentRoundTime.seconds % 2 === 0) {
			this.dom.timeRemainingColumn.classList.remove('flash2');
			this.dom.timeRemainingColumn.classList.add('flash1');
		} else {
			this.dom.timeRemainingColumn.classList.remove('flash1');
			this.dom.timeRemainingColumn.classList.add('flash2');
		}
	},
	removeTimeRemainingFlash: function() {
		this.dom.timeRemainingColumn.classList.remove('flash1');
		this.dom.timeRemainingColumn.classList.remove('flash2');
	},
	openMenu: function() {
		this.dom.menu.style.display = 'inline-block';
	},
	closeMenu: function() {
		this.dom.menu.style.display = 'none';
	}
};

var Controller = {
	timer: undefined,
	initialize: function() {
		Model.events.on('timeRemainingInitialized', View.renderTimeRemaining.bind(View));
		Model.events.on('blindsInitialized', View.renderBlinds.bind(View));
		Model.events.on('timeUpdated', View.renderTimeRemaining.bind(View));
		Model.events.on('newRoundStarted', Model.incrementCurrentBlind.bind(Model));
		Model.events.on('blindsIncremented', View.renderBlinds.bind(View));
		Model.events.on('roundEndWarning', View.flashTimeRemaining.bind(View));
		Model.events.on('newRoundStarted', View.removeTimeRemainingFlash.bind(View));
		Model.events.on('twoMinuteWarning', this.twoBeeps.bind(Controller));
		Model.events.on('tenSecondsWarning', this.tenBeeps.bind(Controller));

		Model.setRoundTime(View.dom.roundTimeInput.value);
		Model.resetCurrentRoundTime();
		Model.initializeTimeRemaining();
		Model.initializeBlinds();
		View.bindUIEvents();
	},
	start: function() {
		if (!this.timer) {
			this.timer = setInterval(function() {
				Model.updateTimeRemaining();
			}, 1000);
			View.dom.startBtn.innerHTML = 'Pause';
		} else {
			clearInterval(this.timer);
			this.timer = undefined;
			View.dom.startBtn.innerHTML = 'Start';
		}
	},
	twoBeeps: function() {
		Beeper.beeps(2);
	},
	tenBeeps: function() {
		Beeper.beeps(10);
	},
	setRoundTime: function() {
		View.closeMenu();
		var roundTime = View.dom.roundTimeInput.value;
		Model.setRoundTime(roundTime);
	}
};

Controller.initialize();
