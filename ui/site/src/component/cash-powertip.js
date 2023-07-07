export default function () {
  'use strict';
  // core.js
  /**
   * PowerTip Core
   *
   * @fileoverview  Core variables, plugin object, and API.
   * @link          http://stevenbenner.github.com/jquery-powertip/
   * @author        Steven Benner (http://stevenbenner.com/)
   * @requires      Cash.js
   */

  // constants
  const DATA_DISPLAYCONTROLLER = 'displayController',
    DATA_HASACTIVEHOVER = 'hasActiveHover',
    DATA_FORCEDOPEN = 'forcedOpen';

  /**
   * Session data
   * Private properties global to all powerTip instances
   */
  const session = {
    // for each popupId
    scoped: {
      // isTipOpen: false,
      // isClosing: false,
      // tipOpenImminent: false,
      // activeHover: null,
      // desyncTimeout: null,
      // delayInProgress: false,
    },
    currentX: 0,
    currentY: 0,
    previousX: 0,
    previousY: 0,
    mouseTrackingActive: false,
    windowWidth: 0,
    windowHeight: 0,
    scrollTop: 0,
    scrollLeft: 0,
  };

  /**
   * Collision enumeration
   * @enum {number}
   */
  const Collision = {
    none: 0,
    top: 1,
    bottom: 2,
    left: 4,
    right: 8,
  };

  /**
   * Display hover tooltips on the matched elements.
   * @param {(Object|string)} opts The options object to use for the plugin, or
   *     the name of a method to invoke on the first matched element.
   * @param {*=} [arg] Argument for an invoked method (optional).
   * @return {jQuery} jQuery object for the matched selectors.
   */
  $.fn.powerTip = function (opts) {
    // don't do any work if there were no matched elements
    if (!this.length) {
      return this;
    }

    // extend options and instantiate TooltipController
    const options = Object.assign({}, $.fn.powerTip.defaults, opts),
      tipController = new TooltipController(options);

    // hook mouse and viewport dimension tracking
    initTracking();

    // setup the elements
    this.each(function () {
      const $this = $(this);

      // handle repeated powerTip calls on the same element by destroying the
      // original instance hooked to it and replacing it with this call
      if (this[DATA_DISPLAYCONTROLLER]) {
        $.powerTip.destroy($this);
      }

      // create hover controllers for each element
      this[DATA_DISPLAYCONTROLLER] = new DisplayController($this, options, tipController);
    });

    // attach events to matched elements if the manual options is not enabled
    this.on({
      // mouse events
      mouseenter: function (event) {
        $.powerTip.show(this, event);
      },
      mouseleave: function () {
        $.powerTip.hide(this);
      },
    });

    return this;
  };

  /**
   * Default options for the powerTip plugin.
   */
  $.fn.powerTip.defaults = {
    popupId: 'powerTip',
    intentSensitivity: 7,
    intentPollInterval: 150,
    closeDelay: 150,
    placement: 'n',
    smartPlacement: true,
    defaultSize: [260, 120],
    offset: 10,
  };

  /**
   * Default smart placement priority lists.
   * The first item in the array is the highest priority, the last is the lowest.
   * The last item is also the default, which will be used if all previous options
   * do not fit.
   */
  $.fn.powerTip.smartPlacementLists = {
    n: ['n', 'ne', 'nw', 's'],
    e: ['e', 'ne', 'se', 'w', 'nw', 'sw', 'n', 's', 'e'],
    s: ['s', 'se', 'sw', 'n'],
    w: ['w', 'nw', 'sw', 'e', 'ne', 'se', 'n', 's', 'w'],
    nw: ['nw', 'w', 'sw', 'n', 's', 'se', 'nw'],
    ne: ['ne', 'e', 'se', 'n', 's', 'sw', 'ne'],
    sw: ['sw', 'w', 'nw', 's', 'n', 'ne', 'sw'],
    se: ['se', 'e', 'ne', 's', 'n', 'nw', 'se'],
  };

  /**
   * Public API
   */
  $.powerTip = {
    /**
     * Attempts to show the tooltip for the specified element.
     * @param {jQuery|Element} element The element to open the tooltip for.
     * @param {jQuery.Event=} event jQuery event for hover intent and mouse
     *     tracking (optional).
     */
    show: function apiShowTip(element, event) {
      if (event) {
        trackMouse(event);
        session.previousX = event.pageX;
        session.previousY = event.pageY;
        $(element)[0][DATA_DISPLAYCONTROLLER].show();
      } else {
        $(element).first()[0][DATA_DISPLAYCONTROLLER].show(true, true);
      }
      return element;
    },

    /**
     * Repositions the tooltip on the element.
     * @param {jQuery|Element} element The element the tooltip is shown for.
     */
    reposition: function apiResetPosition(element) {
      $(element).first()[0][DATA_DISPLAYCONTROLLER].resetPosition();
      return element;
    },

    /**
     * Attempts to close any open tooltips.
     * @param {(jQuery|Element)=} element The element with the tooltip that
     *     should be closed.
     * @param {boolean=} immediate Disable close delay (optional).
     */
    hide: function apiCloseTip(element, immediate) {
      $(element).first()[0][DATA_DISPLAYCONTROLLER].hide(immediate);
      return element;
    },

    /**
     * Destroy and roll back any powerTip() instance on the specified element.
     * @param {jQuery|Element} element The element with the powerTip instance.
     */
    destroy: function apiDestroy(element) {
      $(element)
        .off('.powertip')
        .each(function () {
          delete this[DATA_DISPLAYCONTROLLER];
          delete this[DATA_HASACTIVEHOVER];
          delete this[DATA_FORCEDOPEN];
        });
      return element;
    },
  };

  // API aliasing
  $.powerTip.showTip = $.powerTip.show;
  $.powerTip.closeTip = $.powerTip.hide;

  // csscoordinates.js
  /**
   * PowerTip CSSCoordinates
   *
   * @fileoverview  CSSCoordinates object for describing CSS positions.
   * @link          http://stevenbenner.github.com/jquery-powertip/
   * @author        Steven Benner (http://stevenbenner.com/)
   * @requires      jQuery 1.7+
   */

  /**
   * Creates a new CSSCoordinates object.
   * @private
   * @constructor
   */
  function CSSCoordinates() {
    const me = this;

    // initialize object properties
    me.top = 'auto';
    me.left = 'auto';
    me.right = 'auto';
    me.bottom = 'auto';

    /**
     * Set a property to a value.
     * @private
     * @param {string} property The name of the property.
     * @param {number} value The value of the property.
     */
    me.set = function (property, value) {
      if ($.isNumeric(value)) {
        me[property] = Math.round(value);
      }
    };
  }

  // displaycontroller.js
  /**
   * PowerTip DisplayController
   *
   * @fileoverview  DisplayController object used to manage tooltips for elements.
   * @link          http://stevenbenner.github.com/jquery-powertip/
   * @author        Steven Benner (http://stevenbenner.com/)
   * @requires      jQuery 1.7+
   */

  /**
   * Creates a new tooltip display controller.
   * @private
   * @constructor
   * @param {jQuery} element The element that this controller will handle.
   * @param {Object} options Options object containing settings.
   * @param {TooltipController} tipController The TooltipController object for
   *     this instance.
   */
  function DisplayController(element, options, tipController) {
    let hoverTimer = null;
    const scopedSession = session.scoped[options.popupId];

    /**
     * Begins the process of showing a tooltip.
     * @private
     * @param {boolean=} immediate Skip intent testing (optional).
     * @param {boolean=} forceOpen Ignore cursor position and force tooltip to
     *     open (optional).
     */
    function openTooltip(immediate, forceOpen) {
      cancelTimer();
      if (!element[0][DATA_HASACTIVEHOVER]) {
        if (!immediate) {
          scopedSession.tipOpenImminent = true;
          hoverTimer = setTimeout(function () {
            hoverTimer = null;
            checkForIntent();
          }, options.intentPollInterval);
        } else {
          if (forceOpen) {
            element[0][DATA_FORCEDOPEN] = true;
          }
          tipController.showTip(element);
        }
      }
    }

    /**
     * Begins the process of closing a tooltip.
     * @private
     * @param {boolean=} disableDelay Disable close delay (optional).
     */
    function closeTooltip(disableDelay) {
      cancelTimer();
      scopedSession.tipOpenImminent = false;
      if (element[0][DATA_HASACTIVEHOVER]) {
        element[0][DATA_FORCEDOPEN] = false;
        if (!disableDelay) {
          scopedSession.delayInProgress = true;
          hoverTimer = setTimeout(function closeDelay() {
            hoverTimer = null;
            tipController.hideTip(element);
            session.delayInProgress = false;
          }, options.closeDelay);
        } else {
          tipController.hideTip(element);
        }
      }
    }

    /**
     * Checks mouse position to make sure that the user intended to hover on the
     * specified element before showing the tooltip.
     * @private
     */
    function checkForIntent() {
      // calculate mouse position difference
      const xDifference = Math.abs(session.previousX - session.currentX),
        yDifference = Math.abs(session.previousY - session.currentY),
        totalDifference = xDifference + yDifference;

      // check if difference has passed the sensitivity threshold
      if (totalDifference < options.intentSensitivity) {
        tipController.showTip(element);
      } else {
        // try again
        session.previousX = session.currentX;
        session.previousY = session.currentY;
        openTooltip();
      }
    }

    /**
     * Cancels active hover timer.
     * @private
     */
    function cancelTimer() {
      hoverTimer = clearTimeout(hoverTimer);
      scopedSession.delayInProgress = false;
    }

    /**
     * Repositions the tooltip on this element.
     * @private
     */
    function repositionTooltip() {
      tipController.resetPosition(element);
    }

    // expose the methods
    this.show = openTooltip;
    this.hide = closeTooltip;
    this.cancel = cancelTimer;
    this.resetPosition = repositionTooltip;
  }

  // placementcalculator.js
  /**
   * PowerTip PlacementCalculator
   *
   * @fileoverview  PlacementCalculator object that computes tooltip position.
   * @link          http://stevenbenner.github.com/jquery-powertip/
   * @author        Steven Benner (http://stevenbenner.com/)
   * @requires      jQuery 1.7+
   */

  /**
   * Creates a new Placement Calculator.
   * @private
   * @constructor
   */
  function PlacementCalculator() {
    /**
     * Compute the CSS position to display a tooltip at the specified placement
     * relative to the specified element.
     * @private
     * @param {jQuery} element The element that the tooltip should target.
     * @param {string} placement The placement for the tooltip.
     * @param {number} tipWidth Width of the tooltip element in pixels.
     * @param {number} tipHeight Height of the tooltip element in pixels.
     * @param {number} offset Distance to offset tooltips in pixels.
     * @return {CSSCoordinates} A CSSCoordinates object with the position.
     */
    function computePlacementCoords(element, placement, tipWidth, tipHeight, offset) {
      const placementBase = placement.split('-')[0], // ignore 'alt' for corners
        coords = new CSSCoordinates(),
        position = getHtmlPlacement(element, placementBase);

      // calculate the appropriate x and y position in the document
      switch (placement) {
        case 'n':
          coords.set('left', position.left - tipWidth / 2);
          coords.set('bottom', session.windowHeight - position.top + offset);
          break;
        case 'e':
          coords.set('left', position.left + offset);
          coords.set('top', position.top - tipHeight / 2);
          break;
        case 's':
          coords.set('left', position.left - tipWidth / 2);
          coords.set('top', position.top + offset);
          break;
        case 'w':
          coords.set('top', position.top - tipHeight / 2);
          coords.set('right', session.windowWidth - position.left + offset);
          break;
        case 'nw':
          coords.set('bottom', session.windowHeight - position.top + offset);
          coords.set('right', session.windowWidth - position.left - 20);
          break;
        case 'ne':
          coords.set('left', position.left - 20);
          coords.set('bottom', session.windowHeight - position.top + offset);
          break;
        case 'sw':
          coords.set('top', position.top + offset);
          coords.set('right', session.windowWidth - position.left - 20);
          break;
        case 'se':
          coords.set('left', position.left - 20);
          coords.set('top', position.top + offset);
          break;
      }

      return coords;
    }

    /**
     * Finds the tooltip attachment point in the document for a HTML DOM element
     * for the specified placement.
     * @private
     * @param {jQuery} element The element that the tooltip should target.
     * @param {string} placement The placement for the tooltip.
     * @return {Object} An object with the top,left position values.
     */
    function getHtmlPlacement(element, placement) {
      const objectOffset = element.offset(),
        objectWidth = element.outerWidth(),
        objectHeight = element.outerHeight();
      let left, top;

      // calculate the appropriate x and y position in the document
      switch (placement) {
        case 'n':
          left = objectOffset.left + objectWidth / 2;
          top = objectOffset.top;
          break;
        case 'e':
          left = objectOffset.left + objectWidth;
          top = objectOffset.top + objectHeight / 2;
          break;
        case 's':
          left = objectOffset.left + objectWidth / 2;
          top = objectOffset.top + objectHeight;
          break;
        case 'w':
          left = objectOffset.left;
          top = objectOffset.top + objectHeight / 2;
          break;
        case 'nw':
          left = objectOffset.left;
          top = objectOffset.top;
          break;
        case 'ne':
          left = objectOffset.left + objectWidth;
          top = objectOffset.top;
          break;
        case 'sw':
          left = objectOffset.left;
          top = objectOffset.top + objectHeight;
          break;
        case 'se':
          left = objectOffset.left + objectWidth;
          top = objectOffset.top + objectHeight;
          break;
      }

      return {
        top: top,
        left: left,
      };
    }

    // expose methods
    this.compute = computePlacementCoords;
  }

  // tooltipcontroller.js
  /**
   * PowerTip TooltipController
   *
   * @fileoverview  TooltipController object that manages tips for an instance.
   * @link          http://stevenbenner.github.com/jquery-powertip/
   * @author        Steven Benner (http://stevenbenner.com/)
   * @requires      jQuery 1.7+
   */

  /**
   * Creates a new tooltip controller.
   * @private
   * @constructor
   * @param {Object} options Options object containing settings.
   */
  function TooltipController(options) {
    const placementCalculator = new PlacementCalculator();
    let tipElement = $('#' + options.popupId);
    let scopedSession = session.scoped[options.popupId];
    if (!scopedSession) {
      session.scoped[options.popupId] = scopedSession = {};
    }

    // build and append tooltip div if it does not already exist
    if (tipElement.length === 0) {
      tipElement = $('<div id="' + options.popupId + '"/>');
      $('body').append(tipElement);
    }

    // if we want to be able to mouse onto the tooltip then we need to attach
    // hover events to the tooltip that will cancel a close request on hover and
    // start a new close request on mouseleave
    tipElement.on({
      mouseenter: function () {
        // check activeHover in case the mouse cursor entered the
        // tooltip during the fadeOut and close cycle
        if (scopedSession.activeHover) {
          scopedSession.activeHover[0][DATA_DISPLAYCONTROLLER].cancel();
        }
      },
      mouseleave: function () {
        // check activeHover in case the mouse cursor entered the
        // tooltip during the fadeOut and close cycle
        if (scopedSession.activeHover) {
          scopedSession.activeHover[0][DATA_DISPLAYCONTROLLER].hide();
        }
      },
    });

    /**
     * Gives the specified element the active-hover state and queues up the
     * showTip function.
     * @private
     * @param {jQuery} element The element that the tooltip should target.
     */
    function beginShowTip(element) {
      element[0][DATA_HASACTIVEHOVER] = true;
      showTip(element);
    }

    /**
     * Shows the tooltip, as soon as possible.
     * @private
     * @param {jQuery} element The element that the tooltip should target.
     */
    function showTip(element) {
      // it is possible, especially with keyboard navigation, to move on to
      // another element with a tooltip during the queue to get to this point
      // in the code. if that happens then we need to not proceed or we may
      // have the fadeout callback for the last tooltip execute immediately
      // after this code runs, causing bugs.
      if (!element[0][DATA_HASACTIVEHOVER]) {
        return;
      }

      // if the tooltip is open and we got asked to open another one then the
      // old one is still in its fadeOut cycle, so wait and try again
      if (scopedSession.isTipOpen) {
        if (!scopedSession.isClosing) {
          hideTip(scopedSession.activeHover);
        }
        setTimeout(function () {
          showTip(element);
        }, 100);
        return;
      }

      tipElement.empty();

      // trigger powerTipPreRender event
      if (options.preRender) {
        options.preRender(element[0]);
      }

      scopedSession.activeHover = element;
      scopedSession.isTipOpen = true;

      // set tooltip position
      positionTipOnElement(element);

      tipElement.show();

      // start desync polling
      if (!scopedSession.desyncTimeout) {
        scopedSession.desyncTimeout = setInterval(closeDesyncedTip, 500);
      }
    }

    /**
     * Hides the tooltip.
     * @private
     * @param {jQuery} element The element that the tooltip should target.
     */
    function hideTip(element) {
      // reset session
      scopedSession.isClosing = true;
      scopedSession.activeHover = null;
      scopedSession.isTipOpen = false;

      // stop desync polling
      scopedSession.desyncTimeout = clearInterval(scopedSession.desyncTimeout);

      // reset element state
      element[0][DATA_HASACTIVEHOVER] = false;
      element[0][DATA_FORCEDOPEN] = false;

      // fade out
      tipElement.hide();
      const coords = new CSSCoordinates();

      // reset session and tooltip element
      scopedSession.isClosing = false;
      tipElement.removeClass();

      // support mouse-follow and fixed position tips at the same time by
      // moving the tooltip to the last cursor location after it is hidden
      coords.set('top', session.currentY + options.offset);
      coords.set('left', session.currentX + options.offset);
      tipElement.css(coords);
    }

    /**
     * Sets the tooltip to the correct position relative to the specified target
     * element. Based on options settings.
     * @private
     * @param {jQuery} element The element that the tooltip should target.
     */
    function positionTipOnElement(element) {
      let priorityList, finalPlacement;

      if (options.smartPlacement) {
        priorityList = $.fn.powerTip.smartPlacementLists[options.placement];

        // iterate over the priority list and use the first placement option
        // that does not collide with the view port. if they all collide
        // then the last placement in the list will be used.
        $.each(priorityList, function (_, pos) {
          // place tooltip and find collisions
          const collisions = getViewportCollisions(
            placeTooltip(element, pos),
            tipElement.outerWidth() || options.defaultSize[0],
            tipElement.outerHeight() || options.defaultSize[1]
          );

          // update the final placement variable
          finalPlacement = pos;

          // break if there were no collisions
          if (collisions === Collision.none) {
            return false;
          }
        });
      } else {
        // if we're not going to use the smart placement feature then just
        // compute the coordinates and do it
        placeTooltip(element, options.placement);
        finalPlacement = options.placement;
      }
    }

    /**
     * Sets the tooltip position to the appropriate values to show the tip at
     * the specified placement. This function will iterate and test the tooltip
     * to support elastic tooltips.
     * @private
     * @param {jQuery} element The element that the tooltip should target.
     * @param {string} placement The placement for the tooltip.
     * @return {CSSCoordinates} A CSSCoordinates object with the top, left, and
     *     right position values.
     */
    function placeTooltip(element, placement) {
      let iterationCount = 0,
        tipWidth,
        tipHeight,
        coords = new CSSCoordinates();

      // set the tip to 0,0 to get the full expanded width
      coords.set('top', 0);
      coords.set('left', 0);
      tipElement.css(coords);

      // to support elastic tooltips we need to check for a change in the
      // rendered dimensions after the tooltip has been positioned
      do {
        // grab the current tip dimensions
        tipWidth = tipElement.outerWidth() || options.defaultSize[0];
        tipHeight = tipElement.outerHeight() || options.defaultSize[1];

        // get placement coordinates
        coords = placementCalculator.compute(element, placement, tipWidth, tipHeight, options.offset);

        // place the tooltip
        tipElement.css(coords);
      } while (
        // sanity check: limit to 5 iterations, and...
        ++iterationCount <= 5 &&
        // try again if the dimensions changed after placement
        (tipWidth !== tipElement.outerWidth() || tipHeight !== tipElement.outerHeight())
      );

      return coords;
    }

    /**
     * Checks for a tooltip desync and closes the tooltip if one occurs.
     * @private
     */
    function closeDesyncedTip() {
      let isDesynced = false;
      // It is possible for the mouse cursor to leave an element without
      // firing the mouseleave or blur event. This most commonly happens when
      // the element is disabled under mouse cursor. If this happens it will
      // result in a desynced tooltip because the tooltip was never asked to
      // close. So we should periodically check for a desync situation and
      // close the tip if such a situation arises.
      if (scopedSession.isTipOpen && !scopedSession.isClosing && !scopedSession.delayInProgress) {
        // user moused onto another tip or active hover is disabled
        if (
          scopedSession.activeHover[0][DATA_HASACTIVEHOVER] === false ||
          scopedSession.activeHover.is(':disabled')
        ) {
          isDesynced = true;
        } else {
          // hanging tip - have to test if mouse position is not over the
          // active hover and not over a tooltip set to let the user
          // interact with it.
          // for keyboard navigation: this only counts if the element does
          // not have focus.
          // for tooltips opened via the api: we need to check if it has
          // the forcedOpen flag.
          if (
            !isMouseOver(scopedSession.activeHover) &&
            !scopedSession.activeHover.is(':focus') &&
            !scopedSession.activeHover[0][DATA_FORCEDOPEN]
          ) {
            if (!isMouseOver(tipElement)) {
              isDesynced = true;
            }
          }
        }

        if (isDesynced) {
          // close the desynced tip
          hideTip(scopedSession.activeHover);
        }
      }
    }

    // expose methods
    this.showTip = beginShowTip;
    this.hideTip = hideTip;
    this.resetPosition = positionTipOnElement;
  }

  // utility.js
  /**
   * PowerTip Utility Functions
   *
   * @fileoverview  Private helper functions.
   * @link          http://stevenbenner.github.com/jquery-powertip/
   * @author        Steven Benner (http://stevenbenner.com/)
   * @requires      jQuery 1.7+
   */

  /**
   * Initializes the viewport dimension cache and hooks up the mouse position
   * tracking and viewport dimension tracking events.
   * Prevents attaching the events more than once.
   * @private
   */
  function initTracking() {
    if (!session.mouseTrackingActive) {
      session.mouseTrackingActive = true;
      const $window = $(window);

      // grab the current viewport dimensions on load
      session.scrollLeft = window.scrollX;
      session.scrollTop = window.scrollY;
      session.windowWidth = $window.width();
      session.windowHeight = $window.height();

      // hook mouse move tracking
      document.addEventListener('mousemove', trackMouse);

      // hook viewport dimensions tracking
      window.addEventListener(
        'resize',
        function () {
          session.windowWidth = $window.width();
          session.windowHeight = $window.height();
        },
        { passive: true }
      );

      window.addEventListener(
        'scroll',
        function () {
          const x = window.scrollX,
            y = window.scrollY;
          if (x !== session.scrollLeft) {
            session.currentX += x - session.scrollLeft;
            session.scrollLeft = x;
          }
          if (y !== session.scrollTop) {
            session.currentY += y - session.scrollTop;
            session.scrollTop = y;
          }
        },
        { passive: true }
      );
    }
  }

  /**
   * Saves the current mouse coordinates to the session object.
   * @private
   * @param {jQuery.Event} event The mousemove event for the document.
   */
  function trackMouse(event) {
    session.currentX = event.pageX;
    session.currentY = event.pageY;
  }

  /**
   * Tests if the mouse is currently over the specified element.
   * @private
   * @param {jQuery} element The element to check for hover.
   * @return {boolean}
   */
  function isMouseOver(element) {
    const elementPosition = element.offset();
    return (
      session.currentX >= elementPosition.left &&
      session.currentX <= elementPosition.left + element.width() &&
      session.currentY >= elementPosition.top &&
      session.currentY <= elementPosition.top + element.height()
    );
  }

  /**
   * Finds any viewport collisions that an element (the tooltip) would have if it
   * were absolutely positioned at the specified coordinates.
   * @private
   * @param {CSSCoordinates} coords Coordinates for the element.
   * @param {number} elementWidth Width of the element in pixels.
   * @param {number} elementHeight Height of the element in pixels.
   * @return {number} Value with the collision flags.
   */
  function getViewportCollisions(coords, elementWidth, elementHeight) {
    const viewportTop = session.scrollTop,
      viewportLeft = session.scrollLeft,
      viewportBottom = viewportTop + session.windowHeight,
      viewportRight = viewportLeft + session.windowWidth;
    let collisions = Collision.none;

    if (
      coords.top < viewportTop ||
      Math.abs(coords.bottom - session.windowHeight) - elementHeight < viewportTop
    ) {
      collisions |= Collision.top;
    }
    if (
      coords.top + elementHeight > viewportBottom ||
      Math.abs(coords.bottom - session.windowHeight) > viewportBottom
    ) {
      collisions |= Collision.bottom;
    }
    if (coords.left < viewportLeft || coords.right + elementWidth > viewportRight) {
      collisions |= Collision.left;
    }
    if (coords.left + elementWidth > viewportRight || coords.right < viewportLeft) {
      collisions |= Collision.right;
    }

    return collisions;
  }
}
