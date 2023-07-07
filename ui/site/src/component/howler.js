/*!
 *  howler.js v2.0.2
 *  howlerjs.com
 *
 *  (c) 2013-2016, James Simpson of GoldFire Studios
 *  goldfirestudios.com
 *
 *  MIT License
 */

export default function () {
  'use strict';

  /** Global Methods **/
  /***************************************************************************/

  /**
   * Create the global controller. All contained methods and properties apply
   * to all sounds that are currently playing or will be in the future.
   */
  const HowlerGlobal = function () {
    this.init();
  };
  HowlerGlobal.prototype = {
    /**
     * Initialize the global Howler object.
     * @return {Howler}
     */
    init: function () {
      const self = this || Howler;

      // Internal properties.
      self._codecs = {};
      self._howls = [];
      self._canPlayEvent = 'canplaythrough';

      // Public properties.
      self.noAudio = false;
      self.usingWebAudio = true;
      self.autoSuspend = true;
      self.ctx = null;

      // Set to false to disable the auto iOS enabler.
      self.mobileAutoEnable = true;

      // Setup the various state values for global tracking.
      self._setup();

      return self;
    },

    /**
     * Unload and destroy all currently loaded Howl objects.
     * @return {Howler}
     */
    unload: function () {
      const self = this || Howler;

      for (let i = self._howls.length - 1; i >= 0; i--) {
        self._howls[i].unload();
      }

      // Create a new AudioContext to make sure it is fully reset.
      if (self.usingWebAudio && self.ctx && typeof self.ctx.close !== 'undefined') {
        self.ctx.close();
        self.ctx = null;
        setupAudioContext();
      }

      return self;
    },

    /**
     * Check for codec support of specific extension.
     * @param  {String} ext Audio file extention.
     * @return {Boolean}
     */
    codecs: function (ext) {
      return (this || Howler)._codecs[ext.replace(/^x-/, '')];
    },

    /**
     * Setup various state values for global tracking.
     * @return {Howler}
     */
    _setup: function () {
      const self = this || Howler;

      // Keeps track of the suspend/resume state of the AudioContext.
      self.state = self.ctx ? self.ctx.state || 'running' : 'running';

      // Automatically begin the 30-second suspend process
      self._autoSuspend();

      // Check if audio is available.
      if (!self.usingWebAudio) {
        // No audio is available on this system if noAudio is set to true.
        if (typeof Audio !== 'undefined') {
          try {
            const test = new Audio();

            // Check if the canplaythrough event is available.
            if (typeof test.oncanplaythrough === 'undefined') {
              self._canPlayEvent = 'canplay';
            }
          } catch (e) {
            self.noAudio = true;
          }
        } else {
          self.noAudio = true;
        }
      }

      try {
        const test = new Audio();
        if (test.muted) {
          self.noAudio = true;
        } else {
          self._codecs = {
            mp3: !!(
              test.canPlayType('audio/mpeg;').replace(/^no$/, '') ||
              test.canPlayType('audio/mp3;').replace(/^no$/, '')
            ),
            ogg: !!test.canPlayType('audio/ogg; codecs="vorbis"').replace(/^no$/, ''),
          };
        }
      } catch (e) {
        //
      }

      return self;
    },

    /**
     * Mobile browsers will only allow audio to be played after a user interaction.
     * Attempt to automatically unlock audio on the first user interaction.
     * Concept from: http://paulbakaus.com/tutorials/html5/web-audio-on-ios/
     * @return {Howler}
     */
    _enableMobileAudio: function () {
      const self = this || Howler;

      // Only run this on mobile devices if audio isn't already eanbled.
      if (
        self._mobileEnabled ||
        !self.ctx ||
        (!/iPhone|iPad|iPod|Android|BlackBerry|BB10|Silk|Mobi/i.test(navigator.userAgent) &&
          !('ontouchend' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0))
      ) {
        return;
      }

      self._mobileEnabled = false;

      // Some mobile devices/platforms have distortion issues when opening/closing tabs and/or web views.
      // Bugs in the browser (especially Mobile Safari) can cause the sampleRate to change from 44100 to 48000.
      // By calling Howler.unload(), we create a new AudioContext with the correct sampleRate.
      if (!self._mobileUnloaded && self.ctx.sampleRate !== 44100) {
        self._mobileUnloaded = true;
        self.unload();
      }

      // Scratch buffer for enabling iOS to dispose of web audio buffers correctly, as per:
      // http://stackoverflow.com/questions/24119684
      self._scratchBuffer = self.ctx.createBuffer(1, 1, 22050);

      const unlockEvents = ['touchstart', 'touchend', 'click'];

      // Call this method on touch start to create and play a buffer,
      // then check if the audio actually played to determine if
      // audio has now been unlocked on iOS, Android, etc.
      const unlock = function () {
        // Create an empty buffer.
        const source = self.ctx.createBufferSource();
        source.buffer = self._scratchBuffer;
        source.connect(self.ctx.destination);

        // Play the empty buffer.
        if (typeof source.start === 'undefined') {
          source.noteOn(0);
        } else {
          source.start(0);
        }

        // Setup a timeout to check that we are unlocked on the next event loop.
        source.onended = function () {
          source.disconnect(0);

          // Update the unlocked state and prevent this check from happening again.
          self._mobileEnabled = true;
          self.mobileAutoEnable = false;

          // Remove the touch start listener.
          unlockEvents.forEach(e => document.removeEventListener(e, unlock, true));
        };
      };

      // Setup a touch start listener to attempt an unlock in.
      unlockEvents.forEach(e => document.addEventListener(e, unlock, true));

      return self;
    },

    /**
     * Automatically suspend the Web Audio AudioContext after no sound has played for 90 seconds.
     * This saves processing/energy and fixes various browser-specific bugs with audio getting stuck.
     * @return {Howler}
     */
    _autoSuspend: function () {
      const self = this;

      if (
        !self.autoSuspend ||
        !self.ctx ||
        typeof self.ctx.suspend === 'undefined' ||
        !Howler.usingWebAudio
      ) {
        return;
      }

      // Check if any sounds are playing.
      for (let i = 0; i < self._howls.length; i++) {
        if (self._howls[i]._webAudio) {
          return self._howls[i]._sounds.length > 0;
        }
      }

      if (self._suspendTimer) {
        clearTimeout(self._suspendTimer);
      }

      // If no sound has played after 90 seconds, suspend the context.
      self._suspendTimer = setTimeout(function () {
        if (!self.autoSuspend) {
          return;
        }

        self._suspendTimer = null;
        self.state = 'suspending';
        self.ctx.suspend().then(function () {
          self.state = 'suspended';

          if (self._resumeAfterSuspend) {
            delete self._resumeAfterSuspend;
            self._autoResume();
          }
        });
      }, 90000);

      return self;
    },

    /**
     * Automatically resume the Web Audio AudioContext when a new sound is played.
     * @return {Howler}
     */
    _autoResume: function () {
      const self = this;

      if (!self.ctx || typeof self.ctx.resume === 'undefined' || !Howler.usingWebAudio) {
        return;
      }

      if (self.state === 'running' && self._suspendTimer) {
        clearTimeout(self._suspendTimer);
        self._suspendTimer = null;
      } else if (self.state === 'suspended') {
        self.state = 'resuming';
        self.ctx.resume().then(function () {
          self.state = 'running';

          // Emit to all Howls that the audio has resumed.
          self._howls.forEach(h => h._emit('resume'));
        });

        if (self._suspendTimer) {
          clearTimeout(self._suspendTimer);
          self._suspendTimer = null;
        }
      } else if (self.state === 'suspending') {
        self._resumeAfterSuspend = true;
      }

      return self;
    },
  };

  // Setup the global audio controller.
  const Howler = new HowlerGlobal();

  /** Group Methods **/
  /***************************************************************************/

  /**
   * Create an audio group controller.
   * @param {Object} o Passed in properties for this group.
   */
  const Howl = function (o) {
    const self = this;

    // Throw an error if no source is provided.
    if (!o.src || o.src.length === 0) {
      console.error('An array of source files must be passed with any new Howl.');
      return;
    }

    self.init(o);
  };
  Howl.prototype = {
    /**
     * Initialize a new Howl group object.
     * @param  {Object} o Passed in properties for this group.
     * @return {Howl}
     */
    init: function (o) {
      const self = this;

      // If we don't have an AudioContext created yet, run the setup.
      if (!Howler.ctx) {
        setupAudioContext();
      }

      // Setup user-defined default properties.
      self._html5 = false;
      self._pool = 5;
      self._preload = true;
      self._src = typeof o.src !== 'string' ? o.src : [o.src];
      self._volume = o.volume !== undefined ? o.volume : 1;

      // Setup all other default properties.
      self._duration = 0;
      self._state = 'unloaded';
      self._sounds = [];
      self._endTimers = {};
      self._queue = [];

      // Setup event listeners.
      self._onload =
        self._onpause =
        self._onplay =
        self._onstop =
        self._onvolume =
        self._onresume =
        self._onend =
          [];

      // Web Audio or HTML5 Audio?
      self._webAudio = Howler.usingWebAudio && !self._html5;

      // Automatically try to enable audio on iOS.
      if (typeof Howler.ctx !== 'undefined' && Howler.ctx && Howler.mobileAutoEnable) {
        Howler._enableMobileAudio();
      }

      // Keep track of this Howl group in the global controller.
      Howler._howls.push(self);

      // Load the source file unless otherwise specified.
      if (self._preload) {
        self.load();
      }

      return self;
    },

    /**
     * Load the audio file.
     * @return {Howler}
     */
    load: function () {
      const self = this;
      let url = null;

      // If no audio is available, quit immediately.
      if (Howler.noAudio) return;

      // Make sure our source is in an array.
      if (typeof self._src === 'string') {
        self._src = [self._src];
      }

      // Loop through the sources and pick the first one that is compatible.
      for (let i = 0; i < self._src.length; i++) {
        // Make sure the source is a string.
        const str = self._src[i];

        // Extract the file extension from the URL or base64 data URI.
        let ext = /\.([^.]+)$/.exec(str.split('?', 1)[0]);

        if (ext) {
          ext = ext[1].toLowerCase();
        }

        // Check if this extension is available.
        if (Howler.codecs(ext)) {
          url = self._src[i];
          break;
        }
      }

      if (!url) return;

      self._src = url;
      self._state = 'loading';

      // Create a new sound object and add it to the pool.
      new Sound(self);

      // Load and decode the audio data for playback.
      if (self._webAudio) loadBuffer(self);

      return self;
    },

    /**
     * Play a sound or resume previous playback.
     * @param  {String/Number} sprite   **REMOVED** Sprite name for sprite playback or sound id to continue previous.
     * @return {Number}          Sound ID.
     */
    play: function () {
      const self = this;

      // Get the selected node, or get one from the pool.
      const sound = self._inactiveSound();

      // If we have no sprite and the sound hasn't loaded, we must wait
      // for the sound to load to get our audio's duration.
      if (self._state !== 'loaded') {
        self._queue.push({
          event: 'play',
          action() {
            self.play();
          },
        });

        return sound._id;
      }

      // Make sure the AudioContext isn't suspended, and resume it if it is.
      if (self._webAudio) {
        Howler._autoResume();
      }

      // Update the parameters of the sound
      sound._ended = false;

      // Begin the actual playback.
      const node = sound._node;
      if (self._webAudio) {
        // Fire this when the sound is ready to play to begin Web Audio playback.
        const playWebAudio = function () {
          self._refreshBuffer(sound);

          // Setup the playback params.
          node.gain.setValueAtTime(sound._volume, Howler.ctx.currentTime);
          sound._playStart = Howler.ctx.currentTime;

          // Play the sound using the supported method.
          if (typeof node.bufferSource.start === 'undefined') {
            node.bufferSource.noteGrainOn(0, 0, self._duration);
          } else {
            node.bufferSource.start(0, 0, self._duration);
          }

          // Start a new timer if none is present.
          self._endTimers[sound._id] = setTimeout(self._ended.bind(self, sound), self._duration * 1000);

          setTimeout(function () {
            self._emit('play', sound._id);
          }, 0);
        };

        const isRunning = Howler.state === 'running';
        if (self._state === 'loaded' && isRunning) {
          playWebAudio();
        } else {
          // Wait for the audio to load and then begin playback.
          self.on(isRunning ? 'load' : 'resume', playWebAudio, isRunning ? sound._id : null, 1);

          // Cancel the end timer.
          self._clearTimer(sound._id);
        }
      } else {
        // Fire this when the sound is ready to play to begin HTML5 Audio playback.
        const playHtml5 = function () {
          node.currentTime = 0;
          node.volume = sound._volume;

          setTimeout(function () {
            node.play();

            // Setup the new end timer.
            self._endTimers[sound._id] = setTimeout(self._ended.bind(self, sound), self._duration * 1000);

            self._emit('play', sound._id);
          }, 0);
        };

        // Play immediately if ready, or wait for the 'canplaythrough'e vent.
        const loadedNoReadyState = self._state === 'loaded';
        if (node.readyState === 4 || loadedNoReadyState) {
          playHtml5();
        } else {
          const listener = function () {
            // Begin playback.
            playHtml5();

            // Clear this listener.
            node.removeEventListener(Howler._canPlayEvent, listener, false);
          };
          node.addEventListener(Howler._canPlayEvent, listener, false);

          // Cancel the end timer.
          self._clearTimer(sound._id);
        }
      }

      return sound._id;
    },

    /**
     * Stop playback and reset to start.
     * @param  {Number} id The sound ID (empty to stop all in group).
     * @return {Howl}
     */
    stop: function (id) {
      const self = this;

      // If the sound hasn't loaded, add it to the load queue to stop when capable.
      if (self._state !== 'loaded') {
        self._queue.push({
          event: 'stop',
          action() {
            self.stop(id);
          },
        });

        return self;
      }

      // If no id is passed, get all ID's to be stopped.
      const ids = self._getSoundIds(id);

      for (let i = 0; i < ids.length; i++) {
        // Clear the end timer.
        self._clearTimer(ids[i]);

        // Get the sound.
        const sound = self._soundById(ids[i]);

        if (sound) {
          sound._ended = true;

          if (sound._node) {
            if (self._webAudio) {
              // make sure the sound has been created
              if (!sound._node.bufferSource) {
                self._emit('stop', sound._id);

                return self;
              }

              if (typeof sound._node.bufferSource.stop === 'undefined') {
                sound._node.bufferSource.noteOff(0);
              } else {
                sound._node.bufferSource.stop(0);
              }

              // Clean up the buffer source.
              self._cleanBuffer(sound._node);
            } else if (!isNaN(sound._node.duration) || sound._node.duration === Infinity) {
              sound._node.currentTime = sound._start || 0;
              sound._node.pause();
            }
          }
        }

        if (sound) self._emit('stop', sound._id);
      }

      return self;
    },

    /**
     * Get/set the volume of this sound or of the Howl group. This method can optionally take 0, 1 or 2 arguments.
     *   volume() -> Returns the group's volume value.
     *   volume(id) -> Returns the sound id's current volume.
     *   volume(vol) -> Sets the volume of all sounds in this Howl group.
     *   volume(vol, id) -> Sets the volume of passed sound id.
     * @return {Howl/Number} Returns self or current volume.
     */
    volume: function (vol) {
      const self = this;
      if (self._state !== 'loaded') {
        self._queue.push({
          event: 'volume',
          action() {
            self.volume.apply(self, [vol]);
          },
        });

        return self;
      }
      self._volume = vol;

      // Update one or all volumes.
      self._sounds.forEach(function (sound) {
        sound._volume = vol;

        if (self._webAudio && sound._node) {
          sound._node.gain.setValueAtTime(vol, Howler.ctx.currentTime);
        } else if (sound._node) {
          sound._node.volume = vol;
        }

        self._emit('volume', sound._id);
      });

      return self;
    },

    /**
     * Check if a specific sound is currently playing or not (if id is provided), or check if at least one of the sounds in the group is playing or not.
     * @param  {Number}  id The sound id to check. If none is passed, the whole sound group is checked.
     * @return {Boolean} True if playing and false if not.
     */
    playing: function (id) {
      const self = this;

      // Check the passed sound ID (if any).
      if (typeof id === 'number') {
        return !!self._soundById(id);
      }

      // Otherwise, loop through all sounds and check if any are playing.
      return self._sounds.length > 0;
    },

    /**
     * Returns the current loaded state of this Howl.
     * @return {String} 'unloaded', 'loading', 'loaded'
     */
    state: function () {
      return this._state;
    },

    /**
     * Listen to a custom event.
     * @param  {String}   event Event name.
     * @param  {Function} fn    Listener to call.
     * @param  {Number}   id    (optional) Only listen to events for this sound.
     * @return {Howl}
     */
    on: function (event, fn, id, once) {
      this['_on' + event].push({
        id: id,
        fn: fn,
        once: !!once,
      });
    },

    /**
     * Emit all events of a specific type and pass the sound id.
     * @param  {String} event Event name.
     * @param  {Number} id    Sound ID.
     * @param  {Number} msg   Message to go with event.
     * @return {Howl}
     */
    _emit: function (event, id, msg) {
      const self = this;
      const events = self['_on' + event];

      // Loop through event store and fire all functions.
      for (let i = events.length - 1; i >= 0; i--) {
        if (!events[i].id || events[i].id === id || event === 'load') {
          setTimeout(
            function (fn) {
              fn.call(this, id, msg);
            }.bind(self, events[i].fn),
            0
          );

          // If this event was setup with `once`, remove it.
          if (events[i].once) events.splice(i, 1);
        }
      }
    },

    /**
     * Queue of actions initiated before the sound has loaded.
     * These will be called in sequence, with the next only firing
     * after the previous has finished executing (even if async like play).
     * @return {Howl}
     */
    _loadQueue: function () {
      const self = this;

      if (self._queue.length > 0) {
        const task = self._queue[0];

        // don't move onto the next task until this one is done
        self.on(
          task.event,
          function () {
            self._queue.shift();
            self._loadQueue();
          },
          null,
          1
        );

        task.action();
      }

      return self;
    },

    /**
     * Fired when playback ends at the end of the duration.
     * @param  {Sound} sound The sound object to work with.
     * @return {Howl}
     */
    _ended: function (sound) {
      const self = this;

      // Fire the ended event.
      self._emit('end', sound._id);

      // Mark the node as paused.
      if (self._webAudio) {
        sound._ended = true;
        self._clearTimer(sound._id);

        // Clean up the buffer source.
        self._cleanBuffer(sound._node);

        // Attempt to auto-suspend AudioContext if no sounds are still playing.
        Howler._autoSuspend();
      }

      // When using a sprite, end the track.
      if (!self._webAudio) {
        self.stop(sound._id);
      }

      return self;
    },

    /**
     * Clear the end timer for a sound playback.
     * @param  {Number} id The sound ID.
     * @return {Howl}
     */
    _clearTimer: function (id) {
      const self = this;

      if (self._endTimers[id]) {
        clearTimeout(self._endTimers[id]);
        delete self._endTimers[id];
      }

      return self;
    },

    /**
     * Return the sound identified by this ID, or return null.
     * @param  {Number} id Sound ID
     * @return {Object}    Sound object or null.
     */
    _soundById: function (id) {
      const self = this;

      // Loop through all sounds and find the one with this ID.
      for (let i = 0; i < self._sounds.length; i++) {
        if (id === self._sounds[i]._id) {
          return self._sounds[i];
        }
      }

      return null;
    },

    /**
     * Return an inactive sound from the pool or create a new one.
     * @return {Sound} Sound playback object.
     */
    _inactiveSound: function () {
      const self = this;

      self._drain();

      // Find the first inactive node to recycle.
      for (let i = 0; i < self._sounds.length; i++) {
        if (self._sounds[i]._ended) {
          return self._sounds[i].reset();
        }
      }

      // If no inactive node was found, create a new one.
      return new Sound(self);
    },

    /**
     * Drain excess inactive sounds from the pool.
     */
    _drain: function () {
      const self = this;
      const limit = self._pool;
      let i = 0;

      // If there are less sounds than the max pool size, we are done.
      if (self._sounds.length < limit) {
        return;
      }

      // Count the number of inactive sounds.
      let cnt = self._sounds.reduce((a, s) => a + (s._ended ? 1 : 0), 0);

      // Remove excess inactive sounds, going in reverse order.
      for (i = self._sounds.length - 1; i >= 0; i--) {
        if (cnt <= limit) {
          return;
        }

        if (self._sounds[i]._ended) {
          // Disconnect the audio source when using Web Audio.
          if (self._webAudio && self._sounds[i]._node) {
            self._sounds[i]._node.disconnect(0);
          }

          // Remove sounds until we have the pool size.
          self._sounds.splice(i, 1);
          cnt--;
        }
      }
    },

    /**
     * Get all ID's from the sounds pool.
     * @param  {Number} id Only return one ID if one is passed.
     * @return {Array}    Array of IDs.
     */
    _getSoundIds: function (id) {
      const self = this;

      if (typeof id === 'undefined') {
        const ids = [];
        for (let i = 0; i < self._sounds.length; i++) {
          ids.push(self._sounds[i]._id);
        }

        return ids;
      } else {
        return [id];
      }
    },

    /**
     * Load the sound back into the buffer source.
     * @param  {Sound} sound The sound object to work with.
     * @return {Howl}
     */
    _refreshBuffer: function (sound) {
      const self = this;

      // Setup the buffer source for playback.
      sound._node.bufferSource = Howler.ctx.createBufferSource();
      sound._node.bufferSource.buffer = cache[self._src];

      // Connect to the correct node.
      if (sound._panner) {
        sound._node.bufferSource.connect(sound._panner);
      } else {
        sound._node.bufferSource.connect(sound._node);
      }

      return self;
    },

    /**
     * Prevent memory leaks by cleaning up the buffer source after playback.
     * @param  {Object} node Sound's audio node containing the buffer source.
     * @return {Howl}
     */
    _cleanBuffer: function (node) {
      const self = this;

      if (self._scratchBuffer) {
        node.bufferSource.onended = null;
        node.bufferSource.disconnect(0);
        try {
          node.bufferSource.buffer = self._scratchBuffer;
        } catch (e) {
          //
        }
      }
      node.bufferSource = null;

      return self;
    },
  };

  /** Single Sound Methods **/
  /***************************************************************************/

  /**
   * Setup the sound object, which each node attached to a Howl group is contained in.
   * @param {Object} howl The Howl parent group.
   */
  const Sound = function (howl) {
    this._parent = howl;
    this.init();
  };
  Sound.prototype = {
    /**
     * Initialize a new Sound object.
     * @return {Sound}
     */
    init: function () {
      const self = this;
      const parent = self._parent;

      // Setup the default parameters.
      self._volume = parent._volume;
      self._ended = true;

      // Generate a unique ID for this sound.
      self._id = Math.round(Date.now() * Math.random());

      // Add itself to the parent's pool.
      parent._sounds.push(self);

      // Create the new node.
      self.create();

      return self;
    },

    /**
     * Create and setup a new sound object, whether HTML5 Audio or Web Audio.
     * @return {Sound}
     */
    create: function () {
      const self = this;
      const parent = self._parent;
      const volume = self._volume;

      if (parent._webAudio) {
        // Create the gain node for controlling volume (the source will connect to this).
        self._node = Howler.ctx.createGain ? Howler.ctx.createGain() : Howler.ctx.createGainNode();
        self._node.gain.setValueAtTime(volume, Howler.ctx.currentTime);
        self._node.connect(Howler.ctx.destination);
      } else {
        self._node = new Audio();

        // Listen for 'canplaythrough' event to let us know the sound is ready.
        self._loadFn = self._loadListener.bind(self);
        self._node.addEventListener(Howler._canPlayEvent, self._loadFn, false);

        // Setup the new audio node.
        self._node.src = parent._src;
        self._node.preload = 'auto';
        self._node.volume = volume;

        // Begin loading the source.
        self._node.load();
      }

      return self;
    },

    /**
     * Reset the parameters of this sound to the original state (for recycle).
     * @return {Sound}
     */
    reset: function () {
      const self = this;
      const parent = self._parent;

      // Reset all of the parameters of this sound.
      self._volume = parent._volume;
      self._ended = true;

      // Generate a new ID so that it isn't confused with the previous sound.
      self._id = Math.round(Date.now() * Math.random());

      return self;
    },

    /**
     * HTML5 Audio canplaythrough listener callback.
     */
    _loadListener: function () {
      const self = this;
      const parent = self._parent;

      // Round up the duration to account for the lower precision in HTML5 Audio.
      parent._duration = Math.ceil(self._node.duration * 10) / 10;

      if (parent._state !== 'loaded') {
        parent._state = 'loaded';
        parent._emit('load');
        parent._loadQueue();
      }

      // Clear the event listener.
      self._node.removeEventListener(Howler._canPlayEvent, self._loadFn, false);
    },
  };

  /** Helper Methods **/
  /***************************************************************************/

  const cache = {};

  /**
   * Buffer a sound from URL, Data URI or cache and decode to audio source (Web Audio API).
   * @param  {Howl} self
   */
  const loadBuffer = function (self) {
    const url = self._src;

    // Check if the buffer has already been cached and use it instead.
    if (cache[url]) {
      // Set the duration from the cache.
      self._duration = cache[url].duration;

      // Load the sound into this Howl.
      loadSound(self);
    } else
      fetch(url, {})
        .then(res => {
          if (res.ok)
            res.arrayBuffer().then(ab =>
              Howler.ctx.decodeAudioData(ab, buffer => {
                if (buffer && self._sounds.length > 0) {
                  cache[self._src] = buffer;
                  loadSound(self, buffer);
                }
              })
            );
          else Promise.reject();
        })
        .catch(() => {
          self._html5 = true;
          self._webAudio = false;
          self._sounds = [];
          delete cache[url];
          self.load();
        });
  };

  /**
   * Sound is now loaded, so finish setting everything up and fire the loaded event.
   * @param  {Howl} self
   * @param  {Object} buffer The decoded buffer sound source.
   */
  const loadSound = function (self, buffer) {
    // Set the duration.
    if (buffer && !self._duration) {
      self._duration = buffer.duration;
    }

    // Fire the loaded event.
    if (self._state !== 'loaded') {
      self._state = 'loaded';
      self._emit('load');
      self._loadQueue();
    }
  };

  /**
   * Setup the audio context when available, or switch to HTML5 Audio mode.
   */
  const setupAudioContext = function () {
    // Check if we are using Web Audio and setup the AudioContext if we are.
    try {
      Howler.ctx = new AudioContext();
    } catch (e) {
      Howler.usingWebAudio = false;
    }

    // Check if a webview is being used on iOS8 or earlier (rather than the browser).
    // If it is, disable Web Audio as it causes crashing.
    const version =
      /iP(hone|od|ad)/.test(navigator) && navigator.appVersion.match(/OS (\d+)_(\d+)_?(\d+)?/)
        ? parseInt(navigator.appVersion[1], 10)
        : null;
    if (version && version < 9 && !/safari/.test(navigator.userAgent.toLowerCase())) {
      Howler.usingWebAudio = false;
    }

    // Re-run the setup on Howler.
    Howler._setup();
  };

  window.Howler = Howler;
  window.Howl = Howl;
}
