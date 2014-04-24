window.tinymce = window.tinymce || {
  base: '/assets/tinymce',
  suffix: ''
};(function (exports, undefined) {
  'use strict';
  var modules = {};
  function require(ids, callback) {
    var module, defs = [];
    for (var i = 0; i < ids.length; ++i) {
      module = modules[ids[i]] || resolve(ids[i]);
      if (!module) {
        throw 'module definition dependecy not found: ' + ids[i];
      }
      defs.push(module);
    }
    callback.apply(null, defs);
  }
  function define(id, dependencies, definition) {
    if (typeof id !== 'string') {
      throw 'invalid module definition, module id must be defined and be a string';
    }
    if (dependencies === undefined) {
      throw 'invalid module definition, dependencies must be specified';
    }
    if (definition === undefined) {
      throw 'invalid module definition, definition function must be specified';
    }
    require(dependencies, function () {
      modules[id] = definition.apply(null, arguments);
    });
  }
  function defined(id) {
    return !!modules[id];
  }
  function resolve(id) {
    var target = exports;
    var fragments = id.split(/[.\/]/);
    for (var fi = 0; fi < fragments.length; ++fi) {
      if (!target[fragments[fi]]) {
        return;
      }
      target = target[fragments[fi]];
    }
    return target;
  }
  function expose(ids) {
    for (var i = 0; i < ids.length; i++) {
      var target = exports;
      var id = ids[i];
      var fragments = id.split(/[.\/]/);
      for (var fi = 0; fi < fragments.length - 1; ++fi) {
        if (target[fragments[fi]] === undefined) {
          target[fragments[fi]] = {};
        }
        target = target[fragments[fi]];
      }
      target[fragments[fragments.length - 1]] = modules[id];
    }
  }
  define('tinymce/dom/EventUtils', [], function () {
    'use strict';
    var eventExpandoPrefix = 'mce-data-';
    var mouseEventRe = /^(?:mouse|contextmenu)|click/;
    var deprecated = {
        keyLocation: 1,
        layerX: 1,
        layerY: 1,
        returnValue: 1
      };
    function addEvent(target, name, callback, capture) {
      if (target.addEventListener) {
        target.addEventListener(name, callback, capture || false);
      } else if (target.attachEvent) {
        target.attachEvent('on' + name, callback);
      }
    }
    function removeEvent(target, name, callback, capture) {
      if (target.removeEventListener) {
        target.removeEventListener(name, callback, capture || false);
      } else if (target.detachEvent) {
        target.detachEvent('on' + name, callback);
      }
    }
    function fix(originalEvent, data) {
      var name, event = data || {}, undef;
      function returnFalse() {
        return false;
      }
      function returnTrue() {
        return true;
      }
      for (name in originalEvent) {
        if (!deprecated[name]) {
          event[name] = originalEvent[name];
        }
      }
      if (!event.target) {
        event.target = event.srcElement || document;
      }
      if (originalEvent && mouseEventRe.test(originalEvent.type) && originalEvent.pageX === undef && originalEvent.clientX !== undef) {
        var eventDoc = event.target.ownerDocument || document;
        var doc = eventDoc.documentElement;
        var body = eventDoc.body;
        event.pageX = originalEvent.clientX + (doc && doc.scrollLeft || body && body.scrollLeft || 0) - (doc && doc.clientLeft || body && body.clientLeft || 0);
        event.pageY = originalEvent.clientY + (doc && doc.scrollTop || body && body.scrollTop || 0) - (doc && doc.clientTop || body && body.clientTop || 0);
      }
      event.preventDefault = function () {
        event.isDefaultPrevented = returnTrue;
        if (originalEvent) {
          if (originalEvent.preventDefault) {
            originalEvent.preventDefault();
          } else {
            originalEvent.returnValue = false;
          }
        }
      };
      event.stopPropagation = function () {
        event.isPropagationStopped = returnTrue;
        if (originalEvent) {
          if (originalEvent.stopPropagation) {
            originalEvent.stopPropagation();
          } else {
            originalEvent.cancelBubble = true;
          }
        }
      };
      event.stopImmediatePropagation = function () {
        event.isImmediatePropagationStopped = returnTrue;
        event.stopPropagation();
      };
      if (!event.isDefaultPrevented) {
        event.isDefaultPrevented = returnFalse;
        event.isPropagationStopped = returnFalse;
        event.isImmediatePropagationStopped = returnFalse;
      }
      return event;
    }
    function bindOnReady(win, callback, eventUtils) {
      var doc = win.document, event = { type: 'ready' };
      if (eventUtils.domLoaded) {
        callback(event);
        return;
      }
      function readyHandler() {
        if (!eventUtils.domLoaded) {
          eventUtils.domLoaded = true;
          callback(event);
        }
      }
      function waitForDomLoaded() {
        if (doc.readyState === 'complete' || doc.readyState === 'interactive' && doc.body) {
          removeEvent(doc, 'readystatechange', waitForDomLoaded);
          readyHandler();
        }
      }
      function tryScroll() {
        try {
          doc.documentElement.doScroll('left');
        } catch (ex) {
          setTimeout(tryScroll, 0);
          return;
        }
        readyHandler();
      }
      if (doc.addEventListener) {
        if (doc.readyState === 'complete') {
          readyHandler();
        } else {
          addEvent(win, 'DOMContentLoaded', readyHandler);
        }
      } else {
        addEvent(doc, 'readystatechange', waitForDomLoaded);
        if (doc.documentElement.doScroll && win.self === win.top) {
          tryScroll();
        }
      }
      addEvent(win, 'load', readyHandler);
    }
    function EventUtils() {
      var self = this, events = {}, count, expando, hasFocusIn, hasMouseEnterLeave, mouseEnterLeave;
      expando = eventExpandoPrefix + (+new Date()).toString(32);
      hasMouseEnterLeave = 'onmouseenter' in document.documentElement;
      hasFocusIn = 'onfocusin' in document.documentElement;
      mouseEnterLeave = {
        mouseenter: 'mouseover',
        mouseleave: 'mouseout'
      };
      count = 1;
      self.domLoaded = false;
      self.events = events;
      function executeHandlers(evt, id) {
        var callbackList, i, l, callback, container = events[id];
        callbackList = container && container[evt.type];
        if (callbackList) {
          for (i = 0, l = callbackList.length; i < l; i++) {
            callback = callbackList[i];
            if (callback && callback.func.call(callback.scope, evt) === false) {
              evt.preventDefault();
            }
            if (evt.isImmediatePropagationStopped()) {
              return;
            }
          }
        }
      }
      self.bind = function (target, names, callback, scope) {
        var id, callbackList, i, name, fakeName, nativeHandler, capture, win = window;
        function defaultNativeHandler(evt) {
          executeHandlers(fix(evt || win.event), id);
        }
        if (!target || target.nodeType === 3 || target.nodeType === 8) {
          return;
        }
        if (!target[expando]) {
          id = count++;
          target[expando] = id;
          events[id] = {};
        } else {
          id = target[expando];
        }
        scope = scope || target;
        names = names.split(' ');
        i = names.length;
        while (i--) {
          name = names[i];
          nativeHandler = defaultNativeHandler;
          fakeName = capture = false;
          if (name === 'DOMContentLoaded') {
            name = 'ready';
          }
          if (self.domLoaded && name === 'ready' && target.readyState == 'complete') {
            callback.call(scope, fix({ type: name }));
            continue;
          }
          if (!hasMouseEnterLeave) {
            fakeName = mouseEnterLeave[name];
            if (fakeName) {
              nativeHandler = function (evt) {
                var current, related;
                current = evt.currentTarget;
                related = evt.relatedTarget;
                if (related && current.contains) {
                  related = current.contains(related);
                } else {
                  while (related && related !== current) {
                    related = related.parentNode;
                  }
                }
                if (!related) {
                  evt = fix(evt || win.event);
                  evt.type = evt.type === 'mouseout' ? 'mouseleave' : 'mouseenter';
                  evt.target = current;
                  executeHandlers(evt, id);
                }
              };
            }
          }
          if (!hasFocusIn && (name === 'focusin' || name === 'focusout')) {
            capture = true;
            fakeName = name === 'focusin' ? 'focus' : 'blur';
            nativeHandler = function (evt) {
              evt = fix(evt || win.event);
              evt.type = evt.type === 'focus' ? 'focusin' : 'focusout';
              executeHandlers(evt, id);
            };
          }
          callbackList = events[id][name];
          if (!callbackList) {
            events[id][name] = callbackList = [{
                func: callback,
                scope: scope
              }];
            callbackList.fakeName = fakeName;
            callbackList.capture = capture;
            callbackList.nativeHandler = nativeHandler;
            if (name === 'ready') {
              bindOnReady(target, nativeHandler, self);
            } else {
              addEvent(target, fakeName || name, nativeHandler, capture);
            }
          } else {
            if (name === 'ready' && self.domLoaded) {
              callback({ type: name });
            } else {
              callbackList.push({
                func: callback,
                scope: scope
              });
            }
          }
        }
        target = callbackList = 0;
        return callback;
      };
      self.unbind = function (target, names, callback) {
        var id, callbackList, i, ci, name, eventMap;
        if (!target || target.nodeType === 3 || target.nodeType === 8) {
          return self;
        }
        id = target[expando];
        if (id) {
          eventMap = events[id];
          if (names) {
            names = names.split(' ');
            i = names.length;
            while (i--) {
              name = names[i];
              callbackList = eventMap[name];
              if (callbackList) {
                if (callback) {
                  ci = callbackList.length;
                  while (ci--) {
                    if (callbackList[ci].func === callback) {
                      var nativeHandler = callbackList.nativeHandler;
                      callbackList = callbackList.slice(0, ci).concat(callbackList.slice(ci + 1));
                      callbackList.nativeHandler = nativeHandler;
                      eventMap[name] = callbackList;
                    }
                  }
                }
                if (!callback || callbackList.length === 0) {
                  delete eventMap[name];
                  removeEvent(target, callbackList.fakeName || name, callbackList.nativeHandler, callbackList.capture);
                }
              }
            }
          } else {
            for (name in eventMap) {
              callbackList = eventMap[name];
              removeEvent(target, callbackList.fakeName || name, callbackList.nativeHandler, callbackList.capture);
            }
            eventMap = {};
          }
          for (name in eventMap) {
            return self;
          }
          delete events[id];
          try {
            delete target[expando];
          } catch (ex) {
            target[expando] = null;
          }
        }
        return self;
      };
      self.fire = function (target, name, args) {
        var id;
        if (!target || target.nodeType === 3 || target.nodeType === 8) {
          return self;
        }
        args = fix(null, args);
        args.type = name;
        args.target = target;
        do {
          id = target[expando];
          if (id) {
            executeHandlers(args, id);
          }
          target = target.parentNode || target.ownerDocument || target.defaultView || target.parentWindow;
        } while (target && !args.isPropagationStopped());
        return self;
      };
      self.clean = function (target) {
        var i, children, unbind = self.unbind;
        if (!target || target.nodeType === 3 || target.nodeType === 8) {
          return self;
        }
        if (target[expando]) {
          unbind(target);
        }
        if (!target.getElementsByTagName) {
          target = target.document;
        }
        if (target && target.getElementsByTagName) {
          unbind(target);
          children = target.getElementsByTagName('*');
          i = children.length;
          while (i--) {
            target = children[i];
            if (target[expando]) {
              unbind(target);
            }
          }
        }
        return self;
      };
      self.destroy = function () {
        events = {};
      };
      self.cancel = function (e) {
        if (e) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
        return false;
      };
    }
    EventUtils.Event = new EventUtils();
    EventUtils.Event.bind(window, 'ready', function () {
    });
    return EventUtils;
  });
  define('tinymce/dom/Sizzle', [], function () {
    var i, cachedruns, Expr, getText, isXML, compile, outermostContext, recompare, sortInput, setDocument, document, docElem, documentIsHTML, rbuggyQSA, rbuggyMatches, matches, contains, expando = 'sizzle' + -new Date(), preferredDoc = window.document, support = {}, dirruns = 0, done = 0, classCache = createCache(), tokenCache = createCache(), compilerCache = createCache(), hasDuplicate = false, sortOrder = function () {
        return 0;
      }, strundefined = typeof undefined, MAX_NEGATIVE = 1 << 31, arr = [], pop = arr.pop, push_native = arr.push, push = arr.push, slice = arr.slice, indexOf = arr.indexOf || function (elem) {
        var i = 0, len = this.length;
        for (; i < len; i++) {
          if (this[i] === elem) {
            return i;
          }
        }
        return -1;
      }, whitespace = '[\\x20\\t\\r\\n\\f]', characterEncoding = '(?:\\\\.|[\\w-]|[^\\x00-\\xa0])+', identifier = characterEncoding.replace('w', 'w#'), operators = '([*^$|!~]?=)', attributes = '\\[' + whitespace + '*(' + characterEncoding + ')' + whitespace + '*(?:' + operators + whitespace + '*(?:([\'"])((?:\\\\.|[^\\\\])*?)\\3|(' + identifier + ')|)|)' + whitespace + '*\\]', pseudos = ':(' + characterEncoding + ')(?:\\((([\'"])((?:\\\\.|[^\\\\])*?)\\3|((?:\\\\.|[^\\\\()[\\]]|' + attributes.replace(3, 8) + ')*)|.*)\\)|)', rtrim = new RegExp('^' + whitespace + '+|((?:^|[^\\\\])(?:\\\\.)*)' + whitespace + '+$', 'g'), rcomma = new RegExp('^' + whitespace + '*,' + whitespace + '*'), rcombinators = new RegExp('^' + whitespace + '*([\\x20\\t\\r\\n\\f>+~])' + whitespace + '*'), rpseudo = new RegExp(pseudos), ridentifier = new RegExp('^' + identifier + '$'), matchExpr = {
        'ID': new RegExp('^#(' + characterEncoding + ')'),
        'CLASS': new RegExp('^\\.(' + characterEncoding + ')'),
        'NAME': new RegExp('^\\[name=[\'"]?(' + characterEncoding + ')[\'"]?\\]'),
        'TAG': new RegExp('^(' + characterEncoding.replace('w', 'w*') + ')'),
        'ATTR': new RegExp('^' + attributes),
        'PSEUDO': new RegExp('^' + pseudos),
        'CHILD': new RegExp('^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\(' + whitespace + '*(even|odd|(([+-]|)(\\d*)n|)' + whitespace + '*(?:([+-]|)' + whitespace + '*(\\d+)|))' + whitespace + '*\\)|)', 'i'),
        'needsContext': new RegExp('^' + whitespace + '*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\(' + whitespace + '*((?:-\\d)?\\d*)' + whitespace + '*\\)|)(?=[^-]|$)', 'i')
      }, rsibling = /[\x20\t\r\n\f]*[+~]/, rnative = /^[^{]+\{\s*\[native code/, rquickExpr = /^(?:#([\w\-]+)|(\w+)|\.([\w\-]+))$/, rinputs = /^(?:input|select|textarea|button)$/i, rheader = /^h\d$/i, rescape = /'|\\/g, rattributeQuotes = /\=[\x20\t\r\n\f]*([^'"\]]*)[\x20\t\r\n\f]*\]/g, runescape = /\\([\da-fA-F]{1,6}[\x20\t\r\n\f]?|.)/g, funescape = function (_, escaped) {
        var high = '0x' + escaped - 65536;
        return high !== high ? escaped : high < 0 ? String.fromCharCode(high + 65536) : String.fromCharCode(high >> 10 | 55296, high & 1023 | 56320);
      };
    try {
      push.apply(arr = slice.call(preferredDoc.childNodes), preferredDoc.childNodes);
      arr[preferredDoc.childNodes.length].nodeType;
    } catch (e) {
      push = {
        apply: arr.length ? function (target, els) {
          push_native.apply(target, slice.call(els));
        } : function (target, els) {
          var j = target.length, i = 0;
          while (target[j++] = els[i++]) {
          }
          target.length = j - 1;
        }
      };
    }
    function isNative(fn) {
      return rnative.test(fn + '');
    }
    function createCache() {
      var cache, keys = [];
      cache = function (key, value) {
        if (keys.push(key += ' ') > Expr.cacheLength) {
          delete cache[keys.shift()];
        }
        cache[key] = value;
        return value;
      };
      return cache;
    }
    function markFunction(fn) {
      fn[expando] = true;
      return fn;
    }
    function assert(fn) {
      var div = document.createElement('div');
      try {
        return !!fn(div);
      } catch (e) {
        return false;
      } finally {
        div = null;
      }
    }
    function Sizzle(selector, context, results, seed) {
      var match, elem, m, nodeType, i, groups, old, nid, newContext, newSelector;
      if ((context ? context.ownerDocument || context : preferredDoc) !== document) {
        setDocument(context);
      }
      context = context || document;
      results = results || [];
      if (!selector || typeof selector !== 'string') {
        return results;
      }
      if ((nodeType = context.nodeType) !== 1 && nodeType !== 9) {
        return [];
      }
      if (documentIsHTML && !seed) {
        if (match = rquickExpr.exec(selector)) {
          if (m = match[1]) {
            if (nodeType === 9) {
              elem = context.getElementById(m);
              if (elem && elem.parentNode) {
                if (elem.id === m) {
                  results.push(elem);
                  return results;
                }
              } else {
                return results;
              }
            } else {
              if (context.ownerDocument && (elem = context.ownerDocument.getElementById(m)) && contains(context, elem) && elem.id === m) {
                results.push(elem);
                return results;
              }
            }
          } else if (match[2]) {
            push.apply(results, context.getElementsByTagName(selector));
            return results;
          } else if ((m = match[3]) && support.getElementsByClassName && context.getElementsByClassName) {
            push.apply(results, context.getElementsByClassName(m));
            return results;
          }
        }
        if (support.qsa && !rbuggyQSA.test(selector)) {
          old = true;
          nid = expando;
          newContext = context;
          newSelector = nodeType === 9 && selector;
          if (nodeType === 1 && context.nodeName.toLowerCase() !== 'object') {
            groups = tokenize(selector);
            if (old = context.getAttribute('id')) {
              nid = old.replace(rescape, '\\$&');
            } else {
              context.setAttribute('id', nid);
            }
            nid = '[id=\'' + nid + '\'] ';
            i = groups.length;
            while (i--) {
              groups[i] = nid + toSelector(groups[i]);
            }
            newContext = rsibling.test(selector) && context.parentNode || context;
            newSelector = groups.join(',');
          }
          if (newSelector) {
            try {
              push.apply(results, newContext.querySelectorAll(newSelector));
              return results;
            } catch (qsaError) {
            } finally {
              if (!old) {
                context.removeAttribute('id');
              }
            }
          }
        }
      }
      return select(selector.replace(rtrim, '$1'), context, results, seed);
    }
    isXML = Sizzle.isXML = function (elem) {
      var documentElement = elem && (elem.ownerDocument || elem).documentElement;
      return documentElement ? documentElement.nodeName !== 'HTML' : false;
    };
    setDocument = Sizzle.setDocument = function (node) {
      var doc = node ? node.ownerDocument || node : preferredDoc;
      if (doc === document || doc.nodeType !== 9 || !doc.documentElement) {
        return document;
      }
      document = doc;
      docElem = doc.documentElement;
      documentIsHTML = !isXML(doc);
      support.getElementsByTagName = assert(function (div) {
        div.appendChild(doc.createComment(''));
        return !div.getElementsByTagName('*').length;
      });
      support.attributes = assert(function (div) {
        div.innerHTML = '<select></select>';
        var type = typeof div.lastChild.getAttribute('multiple');
        return type !== 'boolean' && type !== 'string';
      });
      support.getElementsByClassName = assert(function (div) {
        div.innerHTML = '<div class=\'hidden e\'></div><div class=\'hidden\'></div>';
        if (!div.getElementsByClassName || !div.getElementsByClassName('e').length) {
          return false;
        }
        div.lastChild.className = 'e';
        return div.getElementsByClassName('e').length === 2;
      });
      support.getByName = assert(function (div) {
        div.id = expando + 0;
        div.appendChild(document.createElement('a')).setAttribute('name', expando);
        div.appendChild(document.createElement('i')).setAttribute('name', expando);
        docElem.appendChild(div);
        var pass = doc.getElementsByName && doc.getElementsByName(expando).length === 2 + doc.getElementsByName(expando + 0).length;
        docElem.removeChild(div);
        return pass;
      });
      support.sortDetached = assert(function (div1) {
        return div1.compareDocumentPosition && div1.compareDocumentPosition(document.createElement('div')) & 1;
      });
      Expr.attrHandle = assert(function (div) {
        div.innerHTML = '<a href=\'#\'></a>';
        return div.firstChild && typeof div.firstChild.getAttribute !== strundefined && div.firstChild.getAttribute('href') === '#';
      }) ? {} : {
        'href': function (elem) {
          return elem.getAttribute('href', 2);
        },
        'type': function (elem) {
          return elem.getAttribute('type');
        }
      };
      if (support.getByName) {
        Expr.find['ID'] = function (id, context) {
          if (typeof context.getElementById !== strundefined && documentIsHTML) {
            var m = context.getElementById(id);
            return m && m.parentNode ? [m] : [];
          }
        };
        Expr.filter['ID'] = function (id) {
          var attrId = id.replace(runescape, funescape);
          return function (elem) {
            return elem.getAttribute('id') === attrId;
          };
        };
      } else {
        Expr.find['ID'] = function (id, context) {
          if (typeof context.getElementById !== strundefined && documentIsHTML) {
            var m = context.getElementById(id);
            return m ? m.id === id || typeof m.getAttributeNode !== strundefined && m.getAttributeNode('id').value === id ? [m] : undefined : [];
          }
        };
        Expr.filter['ID'] = function (id) {
          var attrId = id.replace(runescape, funescape);
          return function (elem) {
            var node = typeof elem.getAttributeNode !== strundefined && elem.getAttributeNode('id');
            return node && node.value === attrId;
          };
        };
      }
      Expr.find['TAG'] = support.getElementsByTagName ? function (tag, context) {
        if (typeof context.getElementsByTagName !== strundefined) {
          return context.getElementsByTagName(tag);
        }
      } : function (tag, context) {
        var elem, tmp = [], i = 0, results = context.getElementsByTagName(tag);
        if (tag === '*') {
          while (elem = results[i++]) {
            if (elem.nodeType === 1) {
              tmp.push(elem);
            }
          }
          return tmp;
        }
        return results;
      };
      Expr.find['NAME'] = support.getByName && function (tag, context) {
        if (typeof context.getElementsByName !== strundefined) {
          return context.getElementsByName(name);
        }
      };
      Expr.find['CLASS'] = support.getElementsByClassName && function (className, context) {
        if (typeof context.getElementsByClassName !== strundefined && documentIsHTML) {
          return context.getElementsByClassName(className);
        }
      };
      rbuggyMatches = [];
      rbuggyQSA = [':focus'];
      if (support.qsa = isNative(doc.querySelectorAll)) {
        assert(function (div) {
          div.innerHTML = '<select><option selected=\'\'></option></select>';
          if (!div.querySelectorAll('[selected]').length) {
            rbuggyQSA.push('\\[' + whitespace + '*(?:checked|disabled|ismap|multiple|readonly|selected|value)');
          }
          if (!div.querySelectorAll(':checked').length) {
            rbuggyQSA.push(':checked');
          }
        });
        assert(function (div) {
          div.innerHTML = '<input type=\'hidden\' i=\'\'/>';
          if (div.querySelectorAll('[i^=\'\']').length) {
            rbuggyQSA.push('[*^$]=' + whitespace + '*(?:""|\'\')');
          }
          if (!div.querySelectorAll(':enabled').length) {
            rbuggyQSA.push(':enabled', ':disabled');
          }
          div.querySelectorAll('*,:x');
          rbuggyQSA.push(',.*:');
        });
      }
      if (support.matchesSelector = isNative(matches = docElem.matchesSelector || docElem.mozMatchesSelector || docElem.webkitMatchesSelector || docElem.oMatchesSelector || docElem.msMatchesSelector)) {
        assert(function (div) {
          support.disconnectedMatch = matches.call(div, 'div');
          matches.call(div, '[s!=\'\']:x');
          rbuggyMatches.push('!=', pseudos);
        });
      }
      rbuggyQSA = new RegExp(rbuggyQSA.join('|'));
      rbuggyMatches = rbuggyMatches.length && new RegExp(rbuggyMatches.join('|'));
      contains = isNative(docElem.contains) || docElem.compareDocumentPosition ? function (a, b) {
        var adown = a.nodeType === 9 ? a.documentElement : a, bup = b && b.parentNode;
        return a === bup || !!(bup && bup.nodeType === 1 && (adown.contains ? adown.contains(bup) : a.compareDocumentPosition && a.compareDocumentPosition(bup) & 16));
      } : function (a, b) {
        if (b) {
          while (b = b.parentNode) {
            if (b === a) {
              return true;
            }
          }
        }
        return false;
      };
      sortOrder = docElem.compareDocumentPosition ? function (a, b) {
        if (a === b) {
          hasDuplicate = true;
          return 0;
        }
        var compare = b.compareDocumentPosition && a.compareDocumentPosition && a.compareDocumentPosition(b);
        if (compare) {
          if (compare & 1 || recompare && b.compareDocumentPosition(a) === compare) {
            if (a === doc || contains(preferredDoc, a)) {
              return -1;
            }
            if (b === doc || contains(preferredDoc, b)) {
              return 1;
            }
            return sortInput ? indexOf.call(sortInput, a) - indexOf.call(sortInput, b) : 0;
          }
          return compare & 4 ? -1 : 1;
        }
        return a.compareDocumentPosition ? -1 : 1;
      } : function (a, b) {
        var cur, i = 0, aup = a.parentNode, bup = b.parentNode, ap = [a], bp = [b];
        if (a === b) {
          hasDuplicate = true;
          return 0;
        } else if (!aup || !bup) {
          return a === doc ? -1 : b === doc ? 1 : aup ? -1 : bup ? 1 : 0;
        } else if (aup === bup) {
          return siblingCheck(a, b);
        }
        cur = a;
        while (cur = cur.parentNode) {
          ap.unshift(cur);
        }
        cur = b;
        while (cur = cur.parentNode) {
          bp.unshift(cur);
        }
        while (ap[i] === bp[i]) {
          i++;
        }
        return i ? siblingCheck(ap[i], bp[i]) : ap[i] === preferredDoc ? -1 : bp[i] === preferredDoc ? 1 : 0;
      };
      return document;
    };
    Sizzle.matches = function (expr, elements) {
      return Sizzle(expr, null, null, elements);
    };
    Sizzle.matchesSelector = function (elem, expr) {
      if ((elem.ownerDocument || elem) !== document) {
        setDocument(elem);
      }
      expr = expr.replace(rattributeQuotes, '=\'$1\']');
      if (support.matchesSelector && documentIsHTML && (!rbuggyMatches || !rbuggyMatches.test(expr)) && !rbuggyQSA.test(expr)) {
        try {
          var ret = matches.call(elem, expr);
          if (ret || support.disconnectedMatch || elem.document && elem.document.nodeType !== 11) {
            return ret;
          }
        } catch (e) {
        }
      }
      return Sizzle(expr, document, null, [elem]).length > 0;
    };
    Sizzle.contains = function (context, elem) {
      if ((context.ownerDocument || context) !== document) {
        setDocument(context);
      }
      return contains(context, elem);
    };
    Sizzle.attr = function (elem, name) {
      var val;
      if ((elem.ownerDocument || elem) !== document) {
        setDocument(elem);
      }
      if (documentIsHTML) {
        name = name.toLowerCase();
      }
      if (val = Expr.attrHandle[name]) {
        return val(elem);
      }
      if (!documentIsHTML || support.attributes) {
        return elem.getAttribute(name);
      }
      return ((val = elem.getAttributeNode(name)) || elem.getAttribute(name)) && elem[name] === true ? name : val && val.specified ? val.value : null;
    };
    Sizzle.error = function (msg) {
      throw new Error('Syntax error, unrecognized expression: ' + msg);
    };
    Sizzle.uniqueSort = function (results) {
      var elem, duplicates = [], j = 0, i = 0;
      hasDuplicate = !support.detectDuplicates;
      recompare = !support.sortDetached;
      sortInput = !support.sortStable && results.slice(0);
      results.sort(sortOrder);
      if (hasDuplicate) {
        while (elem = results[i++]) {
          if (elem === results[i]) {
            j = duplicates.push(i);
          }
        }
        while (j--) {
          results.splice(duplicates[j], 1);
        }
      }
      return results;
    };
    function siblingCheck(a, b) {
      var cur = b && a, diff = cur && (~b.sourceIndex || MAX_NEGATIVE) - (~a.sourceIndex || MAX_NEGATIVE);
      if (diff) {
        return diff;
      }
      if (cur) {
        while (cur = cur.nextSibling) {
          if (cur === b) {
            return -1;
          }
        }
      }
      return a ? 1 : -1;
    }
    function createInputPseudo(type) {
      return function (elem) {
        var name = elem.nodeName.toLowerCase();
        return name === 'input' && elem.type === type;
      };
    }
    function createButtonPseudo(type) {
      return function (elem) {
        var name = elem.nodeName.toLowerCase();
        return (name === 'input' || name === 'button') && elem.type === type;
      };
    }
    function createPositionalPseudo(fn) {
      return markFunction(function (argument) {
        argument = +argument;
        return markFunction(function (seed, matches) {
          var j, matchIndexes = fn([], seed.length, argument), i = matchIndexes.length;
          while (i--) {
            if (seed[j = matchIndexes[i]]) {
              seed[j] = !(matches[j] = seed[j]);
            }
          }
        });
      });
    }
    getText = Sizzle.getText = function (elem) {
      var node, ret = '', i = 0, nodeType = elem.nodeType;
      if (!nodeType) {
        for (; node = elem[i]; i++) {
          ret += getText(node);
        }
      } else if (nodeType === 1 || nodeType === 9 || nodeType === 11) {
        if (typeof elem.textContent === 'string') {
          return elem.textContent;
        } else {
          for (elem = elem.firstChild; elem; elem = elem.nextSibling) {
            ret += getText(elem);
          }
        }
      } else if (nodeType === 3 || nodeType === 4) {
        return elem.nodeValue;
      }
      return ret;
    };
    Expr = Sizzle.selectors = {
      cacheLength: 50,
      createPseudo: markFunction,
      match: matchExpr,
      find: {},
      relative: {
        '>': {
          dir: 'parentNode',
          first: true
        },
        ' ': { dir: 'parentNode' },
        '+': {
          dir: 'previousSibling',
          first: true
        },
        '~': { dir: 'previousSibling' }
      },
      preFilter: {
        'ATTR': function (match) {
          match[1] = match[1].replace(runescape, funescape);
          match[3] = (match[4] || match[5] || '').replace(runescape, funescape);
          if (match[2] === '~=') {
            match[3] = ' ' + match[3] + ' ';
          }
          return match.slice(0, 4);
        },
        'CHILD': function (match) {
          match[1] = match[1].toLowerCase();
          if (match[1].slice(0, 3) === 'nth') {
            if (!match[3]) {
              Sizzle.error(match[0]);
            }
            match[4] = +(match[4] ? match[5] + (match[6] || 1) : 2 * (match[3] === 'even' || match[3] === 'odd'));
            match[5] = +(match[7] + match[8] || match[3] === 'odd');
          } else if (match[3]) {
            Sizzle.error(match[0]);
          }
          return match;
        },
        'PSEUDO': function (match) {
          var excess, unquoted = !match[5] && match[2];
          if (matchExpr['CHILD'].test(match[0])) {
            return null;
          }
          if (match[4]) {
            match[2] = match[4];
          } else if (unquoted && rpseudo.test(unquoted) && (excess = tokenize(unquoted, true)) && (excess = unquoted.indexOf(')', unquoted.length - excess) - unquoted.length)) {
            match[0] = match[0].slice(0, excess);
            match[2] = unquoted.slice(0, excess);
          }
          return match.slice(0, 3);
        }
      },
      filter: {
        'TAG': function (nodeName) {
          if (nodeName === '*') {
            return function () {
              return true;
            };
          }
          nodeName = nodeName.replace(runescape, funescape).toLowerCase();
          return function (elem) {
            return elem.nodeName && elem.nodeName.toLowerCase() === nodeName;
          };
        },
        'CLASS': function (className) {
          var pattern = classCache[className + ' '];
          return pattern || (pattern = new RegExp('(^|' + whitespace + ')' + className + '(' + whitespace + '|$)')) && classCache(className, function (elem) {
            return pattern.test(elem.className || typeof elem.getAttribute !== strundefined && elem.getAttribute('class') || '');
          });
        },
        'ATTR': function (name, operator, check) {
          return function (elem) {
            var result = Sizzle.attr(elem, name);
            if (result == null) {
              return operator === '!=';
            }
            if (!operator) {
              return true;
            }
            result += '';
            return operator === '=' ? result === check : operator === '!=' ? result !== check : operator === '^=' ? check && result.indexOf(check) === 0 : operator === '*=' ? check && result.indexOf(check) > -1 : operator === '$=' ? check && result.slice(-check.length) === check : operator === '~=' ? (' ' + result + ' ').indexOf(check) > -1 : operator === '|=' ? result === check || result.slice(0, check.length + 1) === check + '-' : false;
          };
        },
        'CHILD': function (type, what, argument, first, last) {
          var simple = type.slice(0, 3) !== 'nth', forward = type.slice(-4) !== 'last', ofType = what === 'of-type';
          return first === 1 && last === 0 ? function (elem) {
            return !!elem.parentNode;
          } : function (elem, context, xml) {
            var cache, outerCache, node, diff, nodeIndex, start, dir = simple !== forward ? 'nextSibling' : 'previousSibling', parent = elem.parentNode, name = ofType && elem.nodeName.toLowerCase(), useCache = !xml && !ofType;
            if (parent) {
              if (simple) {
                while (dir) {
                  node = elem;
                  while (node = node[dir]) {
                    if (ofType ? node.nodeName.toLowerCase() === name : node.nodeType === 1) {
                      return false;
                    }
                  }
                  start = dir = type === 'only' && !start && 'nextSibling';
                }
                return true;
              }
              start = [forward ? parent.firstChild : parent.lastChild];
              if (forward && useCache) {
                outerCache = parent[expando] || (parent[expando] = {});
                cache = outerCache[type] || [];
                nodeIndex = cache[0] === dirruns && cache[1];
                diff = cache[0] === dirruns && cache[2];
                node = nodeIndex && parent.childNodes[nodeIndex];
                while (node = ++nodeIndex && node && node[dir] || (diff = nodeIndex = 0) || start.pop()) {
                  if (node.nodeType === 1 && ++diff && node === elem) {
                    outerCache[type] = [
                      dirruns,
                      nodeIndex,
                      diff
                    ];
                    break;
                  }
                }
              } else if (useCache && (cache = (elem[expando] || (elem[expando] = {}))[type]) && cache[0] === dirruns) {
                diff = cache[1];
              } else {
                while (node = ++nodeIndex && node && node[dir] || (diff = nodeIndex = 0) || start.pop()) {
                  if ((ofType ? node.nodeName.toLowerCase() === name : node.nodeType === 1) && ++diff) {
                    if (useCache) {
                      (node[expando] || (node[expando] = {}))[type] = [
                        dirruns,
                        diff
                      ];
                    }
                    if (node === elem) {
                      break;
                    }
                  }
                }
              }
              diff -= last;
              return diff === first || diff % first === 0 && diff / first >= 0;
            }
          };
        },
        'PSEUDO': function (pseudo, argument) {
          var args, fn = Expr.pseudos[pseudo] || Expr.setFilters[pseudo.toLowerCase()] || Sizzle.error('unsupported pseudo: ' + pseudo);
          if (fn[expando]) {
            return fn(argument);
          }
          if (fn.length > 1) {
            args = [
              pseudo,
              pseudo,
              '',
              argument
            ];
            return Expr.setFilters.hasOwnProperty(pseudo.toLowerCase()) ? markFunction(function (seed, matches) {
              var idx, matched = fn(seed, argument), i = matched.length;
              while (i--) {
                idx = indexOf.call(seed, matched[i]);
                seed[idx] = !(matches[idx] = matched[i]);
              }
            }) : function (elem) {
              return fn(elem, 0, args);
            };
          }
          return fn;
        }
      },
      pseudos: {
        'not': markFunction(function (selector) {
          var input = [], results = [], matcher = compile(selector.replace(rtrim, '$1'));
          return matcher[expando] ? markFunction(function (seed, matches, context, xml) {
            var elem, unmatched = matcher(seed, null, xml, []), i = seed.length;
            while (i--) {
              if (elem = unmatched[i]) {
                seed[i] = !(matches[i] = elem);
              }
            }
          }) : function (elem, context, xml) {
            input[0] = elem;
            matcher(input, null, xml, results);
            return !results.pop();
          };
        }),
        'has': markFunction(function (selector) {
          return function (elem) {
            return Sizzle(selector, elem).length > 0;
          };
        }),
        'contains': markFunction(function (text) {
          return function (elem) {
            return (elem.textContent || elem.innerText || getText(elem)).indexOf(text) > -1;
          };
        }),
        'lang': markFunction(function (lang) {
          if (!ridentifier.test(lang || '')) {
            Sizzle.error('unsupported lang: ' + lang);
          }
          lang = lang.replace(runescape, funescape).toLowerCase();
          return function (elem) {
            var elemLang;
            do {
              if (elemLang = documentIsHTML ? elem.lang : elem.getAttribute('xml:lang') || elem.getAttribute('lang')) {
                elemLang = elemLang.toLowerCase();
                return elemLang === lang || elemLang.indexOf(lang + '-') === 0;
              }
            } while ((elem = elem.parentNode) && elem.nodeType === 1);
            return false;
          };
        }),
        'target': function (elem) {
          var hash = window.location && window.location.hash;
          return hash && hash.slice(1) === elem.id;
        },
        'root': function (elem) {
          return elem === docElem;
        },
        'focus': function (elem) {
          return elem === document.activeElement && (!document.hasFocus || document.hasFocus()) && !!(elem.type || elem.href || ~elem.tabIndex);
        },
        'enabled': function (elem) {
          return elem.disabled === false;
        },
        'disabled': function (elem) {
          return elem.disabled === true;
        },
        'checked': function (elem) {
          var nodeName = elem.nodeName.toLowerCase();
          return nodeName === 'input' && !!elem.checked || nodeName === 'option' && !!elem.selected;
        },
        'selected': function (elem) {
          if (elem.parentNode) {
            elem.parentNode.selectedIndex;
          }
          return elem.selected === true;
        },
        'empty': function (elem) {
          for (elem = elem.firstChild; elem; elem = elem.nextSibling) {
            if (elem.nodeName > '@' || elem.nodeType === 3 || elem.nodeType === 4) {
              return false;
            }
          }
          return true;
        },
        'parent': function (elem) {
          return !Expr.pseudos['empty'](elem);
        },
        'header': function (elem) {
          return rheader.test(elem.nodeName);
        },
        'input': function (elem) {
          return rinputs.test(elem.nodeName);
        },
        'button': function (elem) {
          var name = elem.nodeName.toLowerCase();
          return name === 'input' && elem.type === 'button' || name === 'button';
        },
        'text': function (elem) {
          var attr;
          return elem.nodeName.toLowerCase() === 'input' && elem.type === 'text' && ((attr = elem.getAttribute('type')) == null || attr.toLowerCase() === elem.type);
        },
        'first': createPositionalPseudo(function () {
          return [0];
        }),
        'last': createPositionalPseudo(function (matchIndexes, length) {
          return [length - 1];
        }),
        'eq': createPositionalPseudo(function (matchIndexes, length, argument) {
          return [argument < 0 ? argument + length : argument];
        }),
        'even': createPositionalPseudo(function (matchIndexes, length) {
          var i = 0;
          for (; i < length; i += 2) {
            matchIndexes.push(i);
          }
          return matchIndexes;
        }),
        'odd': createPositionalPseudo(function (matchIndexes, length) {
          var i = 1;
          for (; i < length; i += 2) {
            matchIndexes.push(i);
          }
          return matchIndexes;
        }),
        'lt': createPositionalPseudo(function (matchIndexes, length, argument) {
          var i = argument < 0 ? argument + length : argument;
          for (; --i >= 0;) {
            matchIndexes.push(i);
          }
          return matchIndexes;
        }),
        'gt': createPositionalPseudo(function (matchIndexes, length, argument) {
          var i = argument < 0 ? argument + length : argument;
          for (; ++i < length;) {
            matchIndexes.push(i);
          }
          return matchIndexes;
        })
      }
    };
    for (i in {
        radio: true,
        checkbox: true,
        file: true,
        password: true,
        image: true
      }) {
      Expr.pseudos[i] = createInputPseudo(i);
    }
    for (i in {
        submit: true,
        reset: true
      }) {
      Expr.pseudos[i] = createButtonPseudo(i);
    }
    function tokenize(selector, parseOnly) {
      var matched, match, tokens, type, soFar, groups, preFilters, cached = tokenCache[selector + ' '];
      if (cached) {
        return parseOnly ? 0 : cached.slice(0);
      }
      soFar = selector;
      groups = [];
      preFilters = Expr.preFilter;
      while (soFar) {
        if (!matched || (match = rcomma.exec(soFar))) {
          if (match) {
            soFar = soFar.slice(match[0].length) || soFar;
          }
          groups.push(tokens = []);
        }
        matched = false;
        if (match = rcombinators.exec(soFar)) {
          matched = match.shift();
          tokens.push({
            value: matched,
            type: match[0].replace(rtrim, ' ')
          });
          soFar = soFar.slice(matched.length);
        }
        for (type in Expr.filter) {
          if ((match = matchExpr[type].exec(soFar)) && (!preFilters[type] || (match = preFilters[type](match)))) {
            matched = match.shift();
            tokens.push({
              value: matched,
              type: type,
              matches: match
            });
            soFar = soFar.slice(matched.length);
          }
        }
        if (!matched) {
          break;
        }
      }
      return parseOnly ? soFar.length : soFar ? Sizzle.error(selector) : tokenCache(selector, groups).slice(0);
    }
    function toSelector(tokens) {
      var i = 0, len = tokens.length, selector = '';
      for (; i < len; i++) {
        selector += tokens[i].value;
      }
      return selector;
    }
    function addCombinator(matcher, combinator, base) {
      var dir = combinator.dir, checkNonElements = base && dir === 'parentNode', doneName = done++;
      return combinator.first ? function (elem, context, xml) {
        while (elem = elem[dir]) {
          if (elem.nodeType === 1 || checkNonElements) {
            return matcher(elem, context, xml);
          }
        }
      } : function (elem, context, xml) {
        var data, cache, outerCache, dirkey = dirruns + ' ' + doneName;
        if (xml) {
          while (elem = elem[dir]) {
            if (elem.nodeType === 1 || checkNonElements) {
              if (matcher(elem, context, xml)) {
                return true;
              }
            }
          }
        } else {
          while (elem = elem[dir]) {
            if (elem.nodeType === 1 || checkNonElements) {
              outerCache = elem[expando] || (elem[expando] = {});
              if ((cache = outerCache[dir]) && cache[0] === dirkey) {
                if ((data = cache[1]) === true || data === cachedruns) {
                  return data === true;
                }
              } else {
                cache = outerCache[dir] = [dirkey];
                cache[1] = matcher(elem, context, xml) || cachedruns;
                if (cache[1] === true) {
                  return true;
                }
              }
            }
          }
        }
      };
    }
    function elementMatcher(matchers) {
      return matchers.length > 1 ? function (elem, context, xml) {
        var i = matchers.length;
        while (i--) {
          if (!matchers[i](elem, context, xml)) {
            return false;
          }
        }
        return true;
      } : matchers[0];
    }
    function condense(unmatched, map, filter, context, xml) {
      var elem, newUnmatched = [], i = 0, len = unmatched.length, mapped = map != null;
      for (; i < len; i++) {
        if (elem = unmatched[i]) {
          if (!filter || filter(elem, context, xml)) {
            newUnmatched.push(elem);
            if (mapped) {
              map.push(i);
            }
          }
        }
      }
      return newUnmatched;
    }
    function setMatcher(preFilter, selector, matcher, postFilter, postFinder, postSelector) {
      if (postFilter && !postFilter[expando]) {
        postFilter = setMatcher(postFilter);
      }
      if (postFinder && !postFinder[expando]) {
        postFinder = setMatcher(postFinder, postSelector);
      }
      return markFunction(function (seed, results, context, xml) {
        var temp, i, elem, preMap = [], postMap = [], preexisting = results.length, elems = seed || multipleContexts(selector || '*', context.nodeType ? [context] : context, []), matcherIn = preFilter && (seed || !selector) ? condense(elems, preMap, preFilter, context, xml) : elems, matcherOut = matcher ? postFinder || (seed ? preFilter : preexisting || postFilter) ? [] : results : matcherIn;
        if (matcher) {
          matcher(matcherIn, matcherOut, context, xml);
        }
        if (postFilter) {
          temp = condense(matcherOut, postMap);
          postFilter(temp, [], context, xml);
          i = temp.length;
          while (i--) {
            if (elem = temp[i]) {
              matcherOut[postMap[i]] = !(matcherIn[postMap[i]] = elem);
            }
          }
        }
        if (seed) {
          if (postFinder || preFilter) {
            if (postFinder) {
              temp = [];
              i = matcherOut.length;
              while (i--) {
                if (elem = matcherOut[i]) {
                  temp.push(matcherIn[i] = elem);
                }
              }
              postFinder(null, matcherOut = [], temp, xml);
            }
            i = matcherOut.length;
            while (i--) {
              if ((elem = matcherOut[i]) && (temp = postFinder ? indexOf.call(seed, elem) : preMap[i]) > -1) {
                seed[temp] = !(results[temp] = elem);
              }
            }
          }
        } else {
          matcherOut = condense(matcherOut === results ? matcherOut.splice(preexisting, matcherOut.length) : matcherOut);
          if (postFinder) {
            postFinder(null, results, matcherOut, xml);
          } else {
            push.apply(results, matcherOut);
          }
        }
      });
    }
    function matcherFromTokens(tokens) {
      var checkContext, matcher, j, len = tokens.length, leadingRelative = Expr.relative[tokens[0].type], implicitRelative = leadingRelative || Expr.relative[' '], i = leadingRelative ? 1 : 0, matchContext = addCombinator(function (elem) {
          return elem === checkContext;
        }, implicitRelative, true), matchAnyContext = addCombinator(function (elem) {
          return indexOf.call(checkContext, elem) > -1;
        }, implicitRelative, true), matchers = [function (elem, context, xml) {
            return !leadingRelative && (xml || context !== outermostContext) || ((checkContext = context).nodeType ? matchContext(elem, context, xml) : matchAnyContext(elem, context, xml));
          }];
      for (; i < len; i++) {
        if (matcher = Expr.relative[tokens[i].type]) {
          matchers = [addCombinator(elementMatcher(matchers), matcher)];
        } else {
          matcher = Expr.filter[tokens[i].type].apply(null, tokens[i].matches);
          if (matcher[expando]) {
            j = ++i;
            for (; j < len; j++) {
              if (Expr.relative[tokens[j].type]) {
                break;
              }
            }
            return setMatcher(i > 1 && elementMatcher(matchers), i > 1 && toSelector(tokens.slice(0, i - 1)).replace(rtrim, '$1'), matcher, i < j && matcherFromTokens(tokens.slice(i, j)), j < len && matcherFromTokens(tokens = tokens.slice(j)), j < len && toSelector(tokens));
          }
          matchers.push(matcher);
        }
      }
      return elementMatcher(matchers);
    }
    function matcherFromGroupMatchers(elementMatchers, setMatchers) {
      var matcherCachedRuns = 0, bySet = setMatchers.length > 0, byElement = elementMatchers.length > 0, superMatcher = function (seed, context, xml, results, expandContext) {
          var elem, j, matcher, setMatched = [], matchedCount = 0, i = '0', unmatched = seed && [], outermost = expandContext != null, contextBackup = outermostContext, elems = seed || byElement && Expr.find['TAG']('*', expandContext && context.parentNode || context), dirrunsUnique = dirruns += contextBackup == null ? 1 : Math.random() || 0.1;
          if (outermost) {
            outermostContext = context !== document && context;
            cachedruns = matcherCachedRuns;
          }
          for (; (elem = elems[i]) != null; i++) {
            if (byElement && elem) {
              j = 0;
              while (matcher = elementMatchers[j++]) {
                if (matcher(elem, context, xml)) {
                  results.push(elem);
                  break;
                }
              }
              if (outermost) {
                dirruns = dirrunsUnique;
                cachedruns = ++matcherCachedRuns;
              }
            }
            if (bySet) {
              if (elem = !matcher && elem) {
                matchedCount--;
              }
              if (seed) {
                unmatched.push(elem);
              }
            }
          }
          matchedCount += i;
          if (bySet && i !== matchedCount) {
            j = 0;
            while (matcher = setMatchers[j++]) {
              matcher(unmatched, setMatched, context, xml);
            }
            if (seed) {
              if (matchedCount > 0) {
                while (i--) {
                  if (!(unmatched[i] || setMatched[i])) {
                    setMatched[i] = pop.call(results);
                  }
                }
              }
              setMatched = condense(setMatched);
            }
            push.apply(results, setMatched);
            if (outermost && !seed && setMatched.length > 0 && matchedCount + setMatchers.length > 1) {
              Sizzle.uniqueSort(results);
            }
          }
          if (outermost) {
            dirruns = dirrunsUnique;
            outermostContext = contextBackup;
          }
          return unmatched;
        };
      return bySet ? markFunction(superMatcher) : superMatcher;
    }
    compile = Sizzle.compile = function (selector, group) {
      var i, setMatchers = [], elementMatchers = [], cached = compilerCache[selector + ' '];
      if (!cached) {
        if (!group) {
          group = tokenize(selector);
        }
        i = group.length;
        while (i--) {
          cached = matcherFromTokens(group[i]);
          if (cached[expando]) {
            setMatchers.push(cached);
          } else {
            elementMatchers.push(cached);
          }
        }
        cached = compilerCache(selector, matcherFromGroupMatchers(elementMatchers, setMatchers));
      }
      return cached;
    };
    function multipleContexts(selector, contexts, results) {
      var i = 0, len = contexts.length;
      for (; i < len; i++) {
        Sizzle(selector, contexts[i], results);
      }
      return results;
    }
    function select(selector, context, results, seed) {
      var i, tokens, token, type, find, match = tokenize(selector);
      if (!seed) {
        if (match.length === 1) {
          tokens = match[0] = match[0].slice(0);
          if (tokens.length > 2 && (token = tokens[0]).type === 'ID' && context.nodeType === 9 && documentIsHTML && Expr.relative[tokens[1].type]) {
            context = (Expr.find['ID'](token.matches[0].replace(runescape, funescape), context) || [])[0];
            if (!context) {
              return results;
            }
            selector = selector.slice(tokens.shift().value.length);
          }
          i = matchExpr['needsContext'].test(selector) ? 0 : tokens.length;
          while (i--) {
            token = tokens[i];
            if (Expr.relative[type = token.type]) {
              break;
            }
            if (find = Expr.find[type]) {
              if (seed = find(token.matches[0].replace(runescape, funescape), rsibling.test(tokens[0].type) && context.parentNode || context)) {
                tokens.splice(i, 1);
                selector = seed.length && toSelector(tokens);
                if (!selector) {
                  push.apply(results, seed);
                  return results;
                }
                break;
              }
            }
          }
        }
      }
      compile(selector, match)(seed, context, !documentIsHTML, results, rsibling.test(selector));
      return results;
    }
    Expr.pseudos['nth'] = Expr.pseudos['eq'];
    function setFilters() {
    }
    setFilters.prototype = Expr.filters = Expr.pseudos;
    Expr.setFilters = new setFilters();
    support.sortStable = expando.split('').sort(sortOrder).join('') === expando;
    setDocument();
    [
      0,
      0
    ].sort(sortOrder);
    support.detectDuplicates = hasDuplicate;
    return Sizzle;
  });
  define('tinymce/dom/DomQuery', [
    'tinymce/dom/EventUtils',
    'tinymce/dom/Sizzle'
  ], function (EventUtils, Sizzle) {
    var doc = document, push = Array.prototype.push, slice = Array.prototype.slice;
    var rquickExpr = /^(?:[^#<]*(<[\w\W]+>)[^>]*$|#([\w\-]*)$)/;
    var Event = EventUtils.Event;
    function isDefined(obj) {
      return typeof obj !== 'undefined';
    }
    function isString(obj) {
      return typeof obj === 'string';
    }
    function createFragment(html) {
      var frag, node, container;
      container = doc.createElement('div');
      frag = doc.createDocumentFragment();
      container.innerHTML = html;
      while (node = container.firstChild) {
        frag.appendChild(node);
      }
      return frag;
    }
    function domManipulate(targetNodes, sourceItem, callback) {
      var i;
      if (typeof sourceItem === 'string') {
        sourceItem = createFragment(sourceItem);
      } else if (sourceItem.length) {
        for (i = 0; i < sourceItem.length; i++) {
          domManipulate(targetNodes, sourceItem[i], callback);
        }
        return targetNodes;
      }
      i = targetNodes.length;
      while (i--) {
        callback.call(targetNodes[i], sourceItem.parentNode ? sourceItem : sourceItem);
      }
      return targetNodes;
    }
    function hasClass(node, className) {
      return node && className && (' ' + node.className + ' ').indexOf(' ' + className + ' ') !== -1;
    }
    function makeMap(items, map) {
      var i;
      items = items || [];
      if (typeof items == 'string') {
        items = items.split(' ');
      }
      map = map || {};
      i = items.length;
      while (i--) {
        map[items[i]] = {};
      }
      return map;
    }
    var numericCssMap = makeMap('fillOpacity fontWeight lineHeight opacity orphans widows zIndex zoom');
    function DomQuery(selector, context) {
      return new DomQuery.fn.init(selector, context);
    }
    function extend(target) {
      var args = arguments, arg, i, key;
      for (i = 1; i < args.length; i++) {
        arg = args[i];
        for (key in arg) {
          target[key] = arg[key];
        }
      }
      return target;
    }
    function toArray(obj) {
      var array = [], i, l;
      for (i = 0, l = obj.length; i < l; i++) {
        array[i] = obj[i];
      }
      return array;
    }
    function inArray(item, array) {
      var i;
      if (array.indexOf) {
        return array.indexOf(item);
      }
      i = array.length;
      while (i--) {
        if (array[i] === item) {
          return i;
        }
      }
      return -1;
    }
    var isArray = Array.isArray || function (obj) {
        return Object.prototype.toString.call(obj) === '[object Array]';
      };
    var whiteSpaceRegExp = /^\s*|\s*$/g;
    function trim(str) {
      return str === null || str === undefined ? '' : ('' + str).replace(whiteSpaceRegExp, '');
    }
    function each(obj, callback) {
      var length, key, i, undef, value;
      if (obj) {
        length = obj.length;
        if (length === undef) {
          for (key in obj) {
            if (obj.hasOwnProperty(key)) {
              value = obj[key];
              if (callback.call(value, value, key) === false) {
                break;
              }
            }
          }
        } else {
          for (i = 0; i < length; i++) {
            value = obj[i];
            if (callback.call(value, value, key) === false) {
              break;
            }
          }
        }
      }
      return obj;
    }
    DomQuery.fn = DomQuery.prototype = {
      constructor: DomQuery,
      selector: '',
      length: 0,
      init: function (selector, context) {
        var self = this, match, node;
        if (!selector) {
          return self;
        }
        if (selector.nodeType) {
          self.context = self[0] = selector;
          self.length = 1;
          return self;
        }
        if (isString(selector)) {
          if (selector.charAt(0) === '<' && selector.charAt(selector.length - 1) === '>' && selector.length >= 3) {
            match = [
              null,
              selector,
              null
            ];
          } else {
            match = rquickExpr.exec(selector);
          }
          if (match) {
            if (match[1]) {
              node = createFragment(selector).firstChild;
              while (node) {
                this.add(node);
                node = node.nextSibling;
              }
            } else {
              node = doc.getElementById(match[2]);
              if (node.id !== match[2]) {
                return self.find(selector);
              }
              self.length = 1;
              self[0] = node;
            }
          } else {
            return DomQuery(context || document).find(selector);
          }
        } else {
          this.add(selector);
        }
        return self;
      },
      toArray: function () {
        return toArray(this);
      },
      add: function (items) {
        var self = this;
        if (!isArray(items)) {
          if (items instanceof DomQuery) {
            self.add(items.toArray());
          } else {
            push.call(self, items);
          }
        } else {
          push.apply(self, items);
        }
        return self;
      },
      attr: function (name, value) {
        var self = this;
        if (typeof name === 'object') {
          each(name, function (value, name) {
            self.attr(name, value);
          });
        } else if (isDefined(value)) {
          this.each(function () {
            if (this.nodeType === 1) {
              this.setAttribute(name, value);
            }
          });
        } else {
          return self[0] && self[0].nodeType === 1 ? self[0].getAttribute(name) : undefined;
        }
        return self;
      },
      css: function (name, value) {
        var self = this;
        if (typeof name === 'object') {
          each(name, function (value, name) {
            self.css(name, value);
          });
        } else {
          name = name.replace(/-(\D)/g, function (a, b) {
            return b.toUpperCase();
          });
          if (isDefined(value)) {
            if (typeof value === 'number' && !numericCssMap[name]) {
              value += 'px';
            }
            self.each(function () {
              var style = this.style;
              if (name === 'opacity' && this.runtimeStyle && typeof this.runtimeStyle.opacity === 'undefined') {
                style.filter = value === '' ? '' : 'alpha(opacity=' + value * 100 + ')';
              }
              try {
                style[name] = value;
              } catch (ex) {
              }
            });
          } else {
            return self[0] ? self[0].style[name] : undefined;
          }
        }
        return self;
      },
      remove: function () {
        var self = this, node, i = this.length;
        while (i--) {
          node = self[i];
          Event.clean(node);
          if (node.parentNode) {
            node.parentNode.removeChild(node);
          }
        }
        return this;
      },
      empty: function () {
        var self = this, node, i = this.length;
        while (i--) {
          node = self[i];
          while (node.firstChild) {
            node.removeChild(node.firstChild);
          }
        }
        return this;
      },
      html: function (value) {
        var self = this, i;
        if (isDefined(value)) {
          i = self.length;
          while (i--) {
            self[i].innerHTML = value;
          }
          return self;
        }
        return self[0] ? self[0].innerHTML : '';
      },
      text: function (value) {
        var self = this, i;
        if (isDefined(value)) {
          i = self.length;
          while (i--) {
            self[i].innerText = self[0].textContent = value;
          }
          return self;
        }
        return self[0] ? self[0].innerText || self[0].textContent : '';
      },
      append: function () {
        return domManipulate(this, arguments, function (node) {
          if (this.nodeType === 1) {
            this.appendChild(node);
          }
        });
      },
      prepend: function () {
        return domManipulate(this, arguments, function (node) {
          if (this.nodeType === 1) {
            this.insertBefore(node, this.firstChild);
          }
        });
      },
      before: function () {
        var self = this;
        if (self[0] && self[0].parentNode) {
          return domManipulate(self, arguments, function (node) {
            this.parentNode.insertBefore(node, this.nextSibling);
          });
        }
        return self;
      },
      after: function () {
        var self = this;
        if (self[0] && self[0].parentNode) {
          return domManipulate(self, arguments, function (node) {
            this.parentNode.insertBefore(node, this);
          });
        }
        return self;
      },
      appendTo: function (val) {
        DomQuery(val).append(this);
        return this;
      },
      addClass: function (className) {
        return this.toggleClass(className, true);
      },
      removeClass: function (className) {
        return this.toggleClass(className, false);
      },
      toggleClass: function (className, state) {
        var self = this;
        if (className.indexOf(' ') !== -1) {
          each(className.split(' '), function () {
            self.toggleClass(this, state);
          });
        } else {
          self.each(function (node) {
            var existingClassName;
            if (hasClass(node, className) !== state) {
              existingClassName = node.className;
              if (state) {
                node.className += existingClassName ? ' ' + className : className;
              } else {
                node.className = trim((' ' + existingClassName + ' ').replace(' ' + className + ' ', ' '));
              }
            }
          });
        }
        return self;
      },
      hasClass: function (className) {
        return hasClass(this[0], className);
      },
      each: function (callback) {
        return each(this, callback);
      },
      on: function (name, callback) {
        return this.each(function () {
          Event.bind(this, name, callback);
        });
      },
      off: function (name, callback) {
        return this.each(function () {
          Event.unbind(this, name, callback);
        });
      },
      show: function () {
        return this.css('display', '');
      },
      hide: function () {
        return this.css('display', 'none');
      },
      slice: function () {
        return new DomQuery(slice.apply(this, arguments));
      },
      eq: function (index) {
        return index === -1 ? this.slice(index) : this.slice(index, +index + 1);
      },
      first: function () {
        return this.eq(0);
      },
      last: function () {
        return this.eq(-1);
      },
      replaceWith: function (content) {
        var self = this;
        if (self[0]) {
          self[0].parentNode.replaceChild(DomQuery(content)[0], self[0]);
        }
        return self;
      },
      wrap: function (wrapper) {
        wrapper = DomQuery(wrapper)[0];
        return this.each(function () {
          var self = this, newWrapper = wrapper.cloneNode(false);
          self.parentNode.insertBefore(newWrapper, self);
          newWrapper.appendChild(self);
        });
      },
      unwrap: function () {
        return this.each(function () {
          var self = this, node = self.firstChild, currentNode;
          while (node) {
            currentNode = node;
            node = node.nextSibling;
            self.parentNode.insertBefore(currentNode, self);
          }
        });
      },
      clone: function () {
        var result = [];
        this.each(function () {
          result.push(this.cloneNode(true));
        });
        return DomQuery(result);
      },
      find: function (selector) {
        var i, l, ret = [];
        for (i = 0, l = this.length; i < l; i++) {
          DomQuery.find(selector, this[i], ret);
        }
        return DomQuery(ret);
      },
      push: push,
      sort: [].sort,
      splice: [].splice
    };
    extend(DomQuery, {
      extend: extend,
      toArray: toArray,
      inArray: inArray,
      isArray: isArray,
      each: each,
      trim: trim,
      makeMap: makeMap,
      find: Sizzle,
      expr: Sizzle.selectors,
      unique: Sizzle.uniqueSort,
      text: Sizzle.getText,
      isXMLDoc: Sizzle.isXML,
      contains: Sizzle.contains,
      filter: function (expr, elems, not) {
        if (not) {
          expr = ':not(' + expr + ')';
        }
        if (elems.length === 1) {
          elems = DomQuery.find.matchesSelector(elems[0], expr) ? [elems[0]] : [];
        } else {
          elems = DomQuery.find.matches(expr, elems);
        }
        return elems;
      }
    });
    function dir(el, prop, until) {
      var matched = [], cur = el[prop];
      while (cur && cur.nodeType !== 9 && (until === undefined || cur.nodeType !== 1 || !DomQuery(cur).is(until))) {
        if (cur.nodeType === 1) {
          matched.push(cur);
        }
        cur = cur[prop];
      }
      return matched;
    }
    function sibling(n, el, siblingName, nodeType) {
      var r = [];
      for (; n; n = n[siblingName]) {
        if ((!nodeType || n.nodeType === nodeType) && n !== el) {
          r.push(n);
        }
      }
      return r;
    }
    each({
      parent: function (node) {
        var parent = node.parentNode;
        return parent && parent.nodeType !== 11 ? parent : null;
      },
      parents: function (node) {
        return dir(node, 'parentNode');
      },
      parentsUntil: function (node, until) {
        return dir(node, 'parentNode', until);
      },
      next: function (node) {
        return sibling(node, 'nextSibling', 1);
      },
      prev: function (node) {
        return sibling(node, 'previousSibling', 1);
      },
      nextNodes: function (node) {
        return sibling(node, 'nextSibling');
      },
      prevNodes: function (node) {
        return sibling(node, 'previousSibling');
      },
      children: function (node) {
        return sibling(node.firstChild, 'nextSibling', 1);
      },
      contents: function (node) {
        return toArray((node.nodeName === 'iframe' ? node.contentDocument || node.contentWindow.document : node).childNodes);
      }
    }, function (name, fn) {
      DomQuery.fn[name] = function (selector) {
        var self = this, result;
        if (self.length > 1) {
          throw new Error('DomQuery only supports traverse functions on a single node.');
        }
        if (self[0]) {
          result = fn(self[0], selector);
        }
        result = DomQuery(result);
        if (selector && name !== 'parentsUntil') {
          return result.filter(selector);
        }
        return result;
      };
    });
    DomQuery.fn.filter = function (selector) {
      return DomQuery.filter(selector);
    };
    DomQuery.fn.is = function (selector) {
      return !!selector && this.filter(selector).length > 0;
    };
    DomQuery.fn.init.prototype = DomQuery.fn;
    return DomQuery;
  });
  define('tinymce/html/Styles', [], function () {
    return function (settings, schema) {
      var rgbRegExp = /rgb\s*\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*\)/gi, urlOrStrRegExp = /(?:url(?:(?:\(\s*\"([^\"]+)\"\s*\))|(?:\(\s*\'([^\']+)\'\s*\))|(?:\(\s*([^)\s]+)\s*\))))|(?:\'([^\']+)\')|(?:\"([^\"]+)\")/gi, styleRegExp = /\s*([^:]+):\s*([^;]+);?/g, trimRightRegExp = /\s+$/, undef, i, encodingLookup = {}, encodingItems, invisibleChar = '\ufeff';
      settings = settings || {};
      encodingItems = ('\\" \\\' \\; \\: ; : ' + invisibleChar).split(' ');
      for (i = 0; i < encodingItems.length; i++) {
        encodingLookup[encodingItems[i]] = invisibleChar + i;
        encodingLookup[invisibleChar + i] = encodingItems[i];
      }
      function toHex(match, r, g, b) {
        function hex(val) {
          val = parseInt(val, 10).toString(16);
          return val.length > 1 ? val : '0' + val;
        }
        return '#' + hex(r) + hex(g) + hex(b);
      }
      return {
        toHex: function (color) {
          return color.replace(rgbRegExp, toHex);
        },
        parse: function (css) {
          var styles = {}, matches, name, value, isEncoded, urlConverter = settings.url_converter;
          var urlConverterScope = settings.url_converter_scope || this;
          function compress(prefix, suffix, noJoin) {
            var top, right, bottom, left;
            top = styles[prefix + '-top' + suffix];
            if (!top) {
              return;
            }
            right = styles[prefix + '-right' + suffix];
            if (!right) {
              return;
            }
            bottom = styles[prefix + '-bottom' + suffix];
            if (!bottom) {
              return;
            }
            left = styles[prefix + '-left' + suffix];
            if (!left) {
              return;
            }
            var box = [
                top,
                right,
                bottom,
                left
              ];
            i = box.length - 1;
            while (i--) {
              if (box[i] !== box[i + 1]) {
                break;
              }
            }
            if (i > -1 && noJoin) {
              return;
            }
            styles[prefix + suffix] = i == -1 ? box[0] : box.join(' ');
            delete styles[prefix + '-top' + suffix];
            delete styles[prefix + '-right' + suffix];
            delete styles[prefix + '-bottom' + suffix];
            delete styles[prefix + '-left' + suffix];
          }
          function canCompress(key) {
            var value = styles[key], i;
            if (!value) {
              return;
            }
            value = value.split(' ');
            i = value.length;
            while (i--) {
              if (value[i] !== value[0]) {
                return false;
              }
            }
            styles[key] = value[0];
            return true;
          }
          function compress2(target, a, b, c) {
            if (!canCompress(a)) {
              return;
            }
            if (!canCompress(b)) {
              return;
            }
            if (!canCompress(c)) {
              return;
            }
            styles[target] = styles[a] + ' ' + styles[b] + ' ' + styles[c];
            delete styles[a];
            delete styles[b];
            delete styles[c];
          }
          function encode(str) {
            isEncoded = true;
            return encodingLookup[str];
          }
          function decode(str, keep_slashes) {
            if (isEncoded) {
              str = str.replace(/\uFEFF[0-9]/g, function (str) {
                return encodingLookup[str];
              });
            }
            if (!keep_slashes) {
              str = str.replace(/\\([\'\";:])/g, '$1');
            }
            return str;
          }
          function processUrl(match, url, url2, url3, str, str2) {
            str = str || str2;
            if (str) {
              str = decode(str);
              return '\'' + str.replace(/\'/g, '\\\'') + '\'';
            }
            url = decode(url || url2 || url3);
            if (!settings.allow_script_urls && /(java|vb)script:/i.test(url.replace(/[\s\r\n]+/, ''))) {
              return '';
            }
            if (urlConverter) {
              url = urlConverter.call(urlConverterScope, url, 'style');
            }
            return 'url(\'' + url.replace(/\'/g, '\\\'') + '\')';
          }
          if (css) {
            css = css.replace(/[\u0000-\u001F]/g, '');
            css = css.replace(/\\[\"\';:\uFEFF]/g, encode).replace(/\"[^\"]+\"|\'[^\']+\'/g, function (str) {
              return str.replace(/[;:]/g, encode);
            });
            while (matches = styleRegExp.exec(css)) {
              name = matches[1].replace(trimRightRegExp, '').toLowerCase();
              value = matches[2].replace(trimRightRegExp, '');
              if (name && value.length > 0) {
                if (!settings.allow_script_urls && (name == 'behavior' || /expression\s*\(/.test(value))) {
                  continue;
                }
                if (name === 'font-weight' && value === '700') {
                  value = 'bold';
                } else if (name === 'color' || name === 'background-color') {
                  value = value.toLowerCase();
                }
                value = value.replace(rgbRegExp, toHex);
                value = value.replace(urlOrStrRegExp, processUrl);
                styles[name] = isEncoded ? decode(value, true) : value;
              }
              styleRegExp.lastIndex = matches.index + matches[0].length;
            }
            compress('border', '', true);
            compress('border', '-width');
            compress('border', '-color');
            compress('border', '-style');
            compress('padding', '');
            compress('margin', '');
            compress2('border', 'border-width', 'border-style', 'border-color');
            if (styles.border === 'medium none') {
              delete styles.border;
            }
            if (styles['border-image'] === 'none') {
              delete styles['border-image'];
            }
          }
          return styles;
        },
        serialize: function (styles, element_name) {
          var css = '', name, value;
          function serializeStyles(name) {
            var styleList, i, l, value;
            styleList = schema.styles[name];
            if (styleList) {
              for (i = 0, l = styleList.length; i < l; i++) {
                name = styleList[i];
                value = styles[name];
                if (value !== undef && value.length > 0) {
                  css += (css.length > 0 ? ' ' : '') + name + ': ' + value + ';';
                }
              }
            }
          }
          if (element_name && schema && schema.styles) {
            serializeStyles('*');
            serializeStyles(element_name);
          } else {
            for (name in styles) {
              value = styles[name];
              if (value !== undef && value.length > 0) {
                css += (css.length > 0 ? ' ' : '') + name + ': ' + value + ';';
              }
            }
          }
          return css;
        }
      };
    };
  });
  define('tinymce/dom/TreeWalker', [], function () {
    return function (start_node, root_node) {
      var node = start_node;
      function findSibling(node, start_name, sibling_name, shallow) {
        var sibling, parent;
        if (node) {
          if (!shallow && node[start_name]) {
            return node[start_name];
          }
          if (node != root_node) {
            sibling = node[sibling_name];
            if (sibling) {
              return sibling;
            }
            for (parent = node.parentNode; parent && parent != root_node; parent = parent.parentNode) {
              sibling = parent[sibling_name];
              if (sibling) {
                return sibling;
              }
            }
          }
        }
      }
      this.current = function () {
        return node;
      };
      this.next = function (shallow) {
        node = findSibling(node, 'firstChild', 'nextSibling', shallow);
        return node;
      };
      this.prev = function (shallow) {
        node = findSibling(node, 'lastChild', 'previousSibling', shallow);
        return node;
      };
    };
  });
  define('tinymce/util/Tools', [], function () {
    var whiteSpaceRegExp = /^\s*|\s*$/g;
    function trim(str) {
      return str === null || str === undefined ? '' : ('' + str).replace(whiteSpaceRegExp, '');
    }
    var isArray = Array.isArray || function (obj) {
        return Object.prototype.toString.call(obj) === '[object Array]';
      };
    function is(o, t) {
      if (!t) {
        return o !== undefined;
      }
      if (t == 'array' && isArray(o)) {
        return true;
      }
      return typeof o == t;
    }
    function toArray(obj) {
      var array = [], i, l;
      for (i = 0, l = obj.length; i < l; i++) {
        array[i] = obj[i];
      }
      return array;
    }
    function makeMap(items, delim, map) {
      var i;
      items = items || [];
      delim = delim || ',';
      if (typeof items == 'string') {
        items = items.split(delim);
      }
      map = map || {};
      i = items.length;
      while (i--) {
        map[items[i]] = {};
      }
      return map;
    }
    function each(o, cb, s) {
      var n, l;
      if (!o) {
        return 0;
      }
      s = s || o;
      if (o.length !== undefined) {
        for (n = 0, l = o.length; n < l; n++) {
          if (cb.call(s, o[n], n, o) === false) {
            return 0;
          }
        }
      } else {
        for (n in o) {
          if (o.hasOwnProperty(n)) {
            if (cb.call(s, o[n], n, o) === false) {
              return 0;
            }
          }
        }
      }
      return 1;
    }
    function map(a, f) {
      var o = [];
      each(a, function (v) {
        o.push(f(v));
      });
      return o;
    }
    function grep(a, f) {
      var o = [];
      each(a, function (v) {
        if (!f || f(v)) {
          o.push(v);
        }
      });
      return o;
    }
    function create(s, p, root) {
      var self = this, sp, ns, cn, scn, c, de = 0;
      s = /^((static) )?([\w.]+)(:([\w.]+))?/.exec(s);
      cn = s[3].match(/(^|\.)(\w+)$/i)[2];
      ns = self.createNS(s[3].replace(/\.\w+$/, ''), root);
      if (ns[cn]) {
        return;
      }
      if (s[2] == 'static') {
        ns[cn] = p;
        if (this.onCreate) {
          this.onCreate(s[2], s[3], ns[cn]);
        }
        return;
      }
      if (!p[cn]) {
        p[cn] = function () {
        };
        de = 1;
      }
      ns[cn] = p[cn];
      self.extend(ns[cn].prototype, p);
      if (s[5]) {
        sp = self.resolve(s[5]).prototype;
        scn = s[5].match(/\.(\w+)$/i)[1];
        c = ns[cn];
        if (de) {
          ns[cn] = function () {
            return sp[scn].apply(this, arguments);
          };
        } else {
          ns[cn] = function () {
            this.parent = sp[scn];
            return c.apply(this, arguments);
          };
        }
        ns[cn].prototype[cn] = ns[cn];
        self.each(sp, function (f, n) {
          ns[cn].prototype[n] = sp[n];
        });
        self.each(p, function (f, n) {
          if (sp[n]) {
            ns[cn].prototype[n] = function () {
              this.parent = sp[n];
              return f.apply(this, arguments);
            };
          } else {
            if (n != cn) {
              ns[cn].prototype[n] = f;
            }
          }
        });
      }
      self.each(p['static'], function (f, n) {
        ns[cn][n] = f;
      });
    }
    function inArray(a, v) {
      var i, l;
      if (a) {
        for (i = 0, l = a.length; i < l; i++) {
          if (a[i] === v) {
            return i;
          }
        }
      }
      return -1;
    }
    function extend(obj, ext) {
      var i, l, name, args = arguments, value;
      for (i = 1, l = args.length; i < l; i++) {
        ext = args[i];
        for (name in ext) {
          if (ext.hasOwnProperty(name)) {
            value = ext[name];
            if (value !== undefined) {
              obj[name] = value;
            }
          }
        }
      }
      return obj;
    }
    function walk(o, f, n, s) {
      s = s || this;
      if (o) {
        if (n) {
          o = o[n];
        }
        each(o, function (o, i) {
          if (f.call(s, o, i, n) === false) {
            return false;
          }
          walk(o, f, n, s);
        });
      }
    }
    function createNS(n, o) {
      var i, v;
      o = o || window;
      n = n.split('.');
      for (i = 0; i < n.length; i++) {
        v = n[i];
        if (!o[v]) {
          o[v] = {};
        }
        o = o[v];
      }
      return o;
    }
    function resolve(n, o) {
      var i, l;
      o = o || window;
      n = n.split('.');
      for (i = 0, l = n.length; i < l; i++) {
        o = o[n[i]];
        if (!o) {
          break;
        }
      }
      return o;
    }
    function explode(s, d) {
      if (!s || is(s, 'array')) {
        return s;
      }
      return map(s.split(d || ','), trim);
    }
    return {
      trim: trim,
      isArray: isArray,
      is: is,
      toArray: toArray,
      makeMap: makeMap,
      each: each,
      map: map,
      grep: grep,
      inArray: inArray,
      extend: extend,
      create: create,
      walk: walk,
      createNS: createNS,
      resolve: resolve,
      explode: explode
    };
  });
  define('tinymce/dom/Range', ['tinymce/util/Tools'], function (Tools) {
    function Range(dom) {
      var self = this, doc = dom.doc, EXTRACT = 0, CLONE = 1, DELETE = 2, TRUE = true, FALSE = false, START_OFFSET = 'startOffset', START_CONTAINER = 'startContainer', END_CONTAINER = 'endContainer', END_OFFSET = 'endOffset', extend = Tools.extend, nodeIndex = dom.nodeIndex;
      function createDocumentFragment() {
        return doc.createDocumentFragment();
      }
      function setStart(n, o) {
        _setEndPoint(TRUE, n, o);
      }
      function setEnd(n, o) {
        _setEndPoint(FALSE, n, o);
      }
      function setStartBefore(n) {
        setStart(n.parentNode, nodeIndex(n));
      }
      function setStartAfter(n) {
        setStart(n.parentNode, nodeIndex(n) + 1);
      }
      function setEndBefore(n) {
        setEnd(n.parentNode, nodeIndex(n));
      }
      function setEndAfter(n) {
        setEnd(n.parentNode, nodeIndex(n) + 1);
      }
      function collapse(ts) {
        if (ts) {
          self[END_CONTAINER] = self[START_CONTAINER];
          self[END_OFFSET] = self[START_OFFSET];
        } else {
          self[START_CONTAINER] = self[END_CONTAINER];
          self[START_OFFSET] = self[END_OFFSET];
        }
        self.collapsed = TRUE;
      }
      function selectNode(n) {
        setStartBefore(n);
        setEndAfter(n);
      }
      function selectNodeContents(n) {
        setStart(n, 0);
        setEnd(n, n.nodeType === 1 ? n.childNodes.length : n.nodeValue.length);
      }
      function compareBoundaryPoints(h, r) {
        var sc = self[START_CONTAINER], so = self[START_OFFSET], ec = self[END_CONTAINER], eo = self[END_OFFSET], rsc = r.startContainer, rso = r.startOffset, rec = r.endContainer, reo = r.endOffset;
        if (h === 0) {
          return _compareBoundaryPoints(sc, so, rsc, rso);
        }
        if (h === 1) {
          return _compareBoundaryPoints(ec, eo, rsc, rso);
        }
        if (h === 2) {
          return _compareBoundaryPoints(ec, eo, rec, reo);
        }
        if (h === 3) {
          return _compareBoundaryPoints(sc, so, rec, reo);
        }
      }
      function deleteContents() {
        _traverse(DELETE);
      }
      function extractContents() {
        return _traverse(EXTRACT);
      }
      function cloneContents() {
        return _traverse(CLONE);
      }
      function insertNode(n) {
        var startContainer = this[START_CONTAINER], startOffset = this[START_OFFSET], nn, o;
        if ((startContainer.nodeType === 3 || startContainer.nodeType === 4) && startContainer.nodeValue) {
          if (!startOffset) {
            startContainer.parentNode.insertBefore(n, startContainer);
          } else if (startOffset >= startContainer.nodeValue.length) {
            dom.insertAfter(n, startContainer);
          } else {
            nn = startContainer.splitText(startOffset);
            startContainer.parentNode.insertBefore(n, nn);
          }
        } else {
          if (startContainer.childNodes.length > 0) {
            o = startContainer.childNodes[startOffset];
          }
          if (o) {
            startContainer.insertBefore(n, o);
          } else {
            if (startContainer.nodeType == 3) {
              dom.insertAfter(n, startContainer);
            } else {
              startContainer.appendChild(n);
            }
          }
        }
      }
      function surroundContents(n) {
        var f = self.extractContents();
        self.insertNode(n);
        n.appendChild(f);
        self.selectNode(n);
      }
      function cloneRange() {
        return extend(new Range(dom), {
          startContainer: self[START_CONTAINER],
          startOffset: self[START_OFFSET],
          endContainer: self[END_CONTAINER],
          endOffset: self[END_OFFSET],
          collapsed: self.collapsed,
          commonAncestorContainer: self.commonAncestorContainer
        });
      }
      function _getSelectedNode(container, offset) {
        var child;
        if (container.nodeType == 3) {
          return container;
        }
        if (offset < 0) {
          return container;
        }
        child = container.firstChild;
        while (child && offset > 0) {
          --offset;
          child = child.nextSibling;
        }
        if (child) {
          return child;
        }
        return container;
      }
      function _isCollapsed() {
        return self[START_CONTAINER] == self[END_CONTAINER] && self[START_OFFSET] == self[END_OFFSET];
      }
      function _compareBoundaryPoints(containerA, offsetA, containerB, offsetB) {
        var c, offsetC, n, cmnRoot, childA, childB;
        if (containerA == containerB) {
          if (offsetA == offsetB) {
            return 0;
          }
          if (offsetA < offsetB) {
            return -1;
          }
          return 1;
        }
        c = containerB;
        while (c && c.parentNode != containerA) {
          c = c.parentNode;
        }
        if (c) {
          offsetC = 0;
          n = containerA.firstChild;
          while (n != c && offsetC < offsetA) {
            offsetC++;
            n = n.nextSibling;
          }
          if (offsetA <= offsetC) {
            return -1;
          }
          return 1;
        }
        c = containerA;
        while (c && c.parentNode != containerB) {
          c = c.parentNode;
        }
        if (c) {
          offsetC = 0;
          n = containerB.firstChild;
          while (n != c && offsetC < offsetB) {
            offsetC++;
            n = n.nextSibling;
          }
          if (offsetC < offsetB) {
            return -1;
          }
          return 1;
        }
        cmnRoot = dom.findCommonAncestor(containerA, containerB);
        childA = containerA;
        while (childA && childA.parentNode != cmnRoot) {
          childA = childA.parentNode;
        }
        if (!childA) {
          childA = cmnRoot;
        }
        childB = containerB;
        while (childB && childB.parentNode != cmnRoot) {
          childB = childB.parentNode;
        }
        if (!childB) {
          childB = cmnRoot;
        }
        if (childA == childB) {
          return 0;
        }
        n = cmnRoot.firstChild;
        while (n) {
          if (n == childA) {
            return -1;
          }
          if (n == childB) {
            return 1;
          }
          n = n.nextSibling;
        }
      }
      function _setEndPoint(st, n, o) {
        var ec, sc;
        if (st) {
          self[START_CONTAINER] = n;
          self[START_OFFSET] = o;
        } else {
          self[END_CONTAINER] = n;
          self[END_OFFSET] = o;
        }
        ec = self[END_CONTAINER];
        while (ec.parentNode) {
          ec = ec.parentNode;
        }
        sc = self[START_CONTAINER];
        while (sc.parentNode) {
          sc = sc.parentNode;
        }
        if (sc == ec) {
          if (_compareBoundaryPoints(self[START_CONTAINER], self[START_OFFSET], self[END_CONTAINER], self[END_OFFSET]) > 0) {
            self.collapse(st);
          }
        } else {
          self.collapse(st);
        }
        self.collapsed = _isCollapsed();
        self.commonAncestorContainer = dom.findCommonAncestor(self[START_CONTAINER], self[END_CONTAINER]);
      }
      function _traverse(how) {
        var c, endContainerDepth = 0, startContainerDepth = 0, p, depthDiff, startNode, endNode, sp, ep;
        if (self[START_CONTAINER] == self[END_CONTAINER]) {
          return _traverseSameContainer(how);
        }
        for (c = self[END_CONTAINER], p = c.parentNode; p; c = p, p = p.parentNode) {
          if (p == self[START_CONTAINER]) {
            return _traverseCommonStartContainer(c, how);
          }
          ++endContainerDepth;
        }
        for (c = self[START_CONTAINER], p = c.parentNode; p; c = p, p = p.parentNode) {
          if (p == self[END_CONTAINER]) {
            return _traverseCommonEndContainer(c, how);
          }
          ++startContainerDepth;
        }
        depthDiff = startContainerDepth - endContainerDepth;
        startNode = self[START_CONTAINER];
        while (depthDiff > 0) {
          startNode = startNode.parentNode;
          depthDiff--;
        }
        endNode = self[END_CONTAINER];
        while (depthDiff < 0) {
          endNode = endNode.parentNode;
          depthDiff++;
        }
        for (sp = startNode.parentNode, ep = endNode.parentNode; sp != ep; sp = sp.parentNode, ep = ep.parentNode) {
          startNode = sp;
          endNode = ep;
        }
        return _traverseCommonAncestors(startNode, endNode, how);
      }
      function _traverseSameContainer(how) {
        var frag, s, sub, n, cnt, sibling, xferNode, start, len;
        if (how != DELETE) {
          frag = createDocumentFragment();
        }
        if (self[START_OFFSET] == self[END_OFFSET]) {
          return frag;
        }
        if (self[START_CONTAINER].nodeType == 3) {
          s = self[START_CONTAINER].nodeValue;
          sub = s.substring(self[START_OFFSET], self[END_OFFSET]);
          if (how != CLONE) {
            n = self[START_CONTAINER];
            start = self[START_OFFSET];
            len = self[END_OFFSET] - self[START_OFFSET];
            if (start === 0 && len >= n.nodeValue.length - 1) {
              n.parentNode.removeChild(n);
            } else {
              n.deleteData(start, len);
            }
            self.collapse(TRUE);
          }
          if (how == DELETE) {
            return;
          }
          if (sub.length > 0) {
            frag.appendChild(doc.createTextNode(sub));
          }
          return frag;
        }
        n = _getSelectedNode(self[START_CONTAINER], self[START_OFFSET]);
        cnt = self[END_OFFSET] - self[START_OFFSET];
        while (n && cnt > 0) {
          sibling = n.nextSibling;
          xferNode = _traverseFullySelected(n, how);
          if (frag) {
            frag.appendChild(xferNode);
          }
          --cnt;
          n = sibling;
        }
        if (how != CLONE) {
          self.collapse(TRUE);
        }
        return frag;
      }
      function _traverseCommonStartContainer(endAncestor, how) {
        var frag, n, endIdx, cnt, sibling, xferNode;
        if (how != DELETE) {
          frag = createDocumentFragment();
        }
        n = _traverseRightBoundary(endAncestor, how);
        if (frag) {
          frag.appendChild(n);
        }
        endIdx = nodeIndex(endAncestor);
        cnt = endIdx - self[START_OFFSET];
        if (cnt <= 0) {
          if (how != CLONE) {
            self.setEndBefore(endAncestor);
            self.collapse(FALSE);
          }
          return frag;
        }
        n = endAncestor.previousSibling;
        while (cnt > 0) {
          sibling = n.previousSibling;
          xferNode = _traverseFullySelected(n, how);
          if (frag) {
            frag.insertBefore(xferNode, frag.firstChild);
          }
          --cnt;
          n = sibling;
        }
        if (how != CLONE) {
          self.setEndBefore(endAncestor);
          self.collapse(FALSE);
        }
        return frag;
      }
      function _traverseCommonEndContainer(startAncestor, how) {
        var frag, startIdx, n, cnt, sibling, xferNode;
        if (how != DELETE) {
          frag = createDocumentFragment();
        }
        n = _traverseLeftBoundary(startAncestor, how);
        if (frag) {
          frag.appendChild(n);
        }
        startIdx = nodeIndex(startAncestor);
        ++startIdx;
        cnt = self[END_OFFSET] - startIdx;
        n = startAncestor.nextSibling;
        while (n && cnt > 0) {
          sibling = n.nextSibling;
          xferNode = _traverseFullySelected(n, how);
          if (frag) {
            frag.appendChild(xferNode);
          }
          --cnt;
          n = sibling;
        }
        if (how != CLONE) {
          self.setStartAfter(startAncestor);
          self.collapse(TRUE);
        }
        return frag;
      }
      function _traverseCommonAncestors(startAncestor, endAncestor, how) {
        var n, frag, startOffset, endOffset, cnt, sibling, nextSibling;
        if (how != DELETE) {
          frag = createDocumentFragment();
        }
        n = _traverseLeftBoundary(startAncestor, how);
        if (frag) {
          frag.appendChild(n);
        }
        startOffset = nodeIndex(startAncestor);
        endOffset = nodeIndex(endAncestor);
        ++startOffset;
        cnt = endOffset - startOffset;
        sibling = startAncestor.nextSibling;
        while (cnt > 0) {
          nextSibling = sibling.nextSibling;
          n = _traverseFullySelected(sibling, how);
          if (frag) {
            frag.appendChild(n);
          }
          sibling = nextSibling;
          --cnt;
        }
        n = _traverseRightBoundary(endAncestor, how);
        if (frag) {
          frag.appendChild(n);
        }
        if (how != CLONE) {
          self.setStartAfter(startAncestor);
          self.collapse(TRUE);
        }
        return frag;
      }
      function _traverseRightBoundary(root, how) {
        var next = _getSelectedNode(self[END_CONTAINER], self[END_OFFSET] - 1), parent, clonedParent;
        var prevSibling, clonedChild, clonedGrandParent, isFullySelected = next != self[END_CONTAINER];
        if (next == root) {
          return _traverseNode(next, isFullySelected, FALSE, how);
        }
        parent = next.parentNode;
        clonedParent = _traverseNode(parent, FALSE, FALSE, how);
        while (parent) {
          while (next) {
            prevSibling = next.previousSibling;
            clonedChild = _traverseNode(next, isFullySelected, FALSE, how);
            if (how != DELETE) {
              clonedParent.insertBefore(clonedChild, clonedParent.firstChild);
            }
            isFullySelected = TRUE;
            next = prevSibling;
          }
          if (parent == root) {
            return clonedParent;
          }
          next = parent.previousSibling;
          parent = parent.parentNode;
          clonedGrandParent = _traverseNode(parent, FALSE, FALSE, how);
          if (how != DELETE) {
            clonedGrandParent.appendChild(clonedParent);
          }
          clonedParent = clonedGrandParent;
        }
      }
      function _traverseLeftBoundary(root, how) {
        var next = _getSelectedNode(self[START_CONTAINER], self[START_OFFSET]), isFullySelected = next != self[START_CONTAINER];
        var parent, clonedParent, nextSibling, clonedChild, clonedGrandParent;
        if (next == root) {
          return _traverseNode(next, isFullySelected, TRUE, how);
        }
        parent = next.parentNode;
        clonedParent = _traverseNode(parent, FALSE, TRUE, how);
        while (parent) {
          while (next) {
            nextSibling = next.nextSibling;
            clonedChild = _traverseNode(next, isFullySelected, TRUE, how);
            if (how != DELETE) {
              clonedParent.appendChild(clonedChild);
            }
            isFullySelected = TRUE;
            next = nextSibling;
          }
          if (parent == root) {
            return clonedParent;
          }
          next = parent.nextSibling;
          parent = parent.parentNode;
          clonedGrandParent = _traverseNode(parent, FALSE, TRUE, how);
          if (how != DELETE) {
            clonedGrandParent.appendChild(clonedParent);
          }
          clonedParent = clonedGrandParent;
        }
      }
      function _traverseNode(n, isFullySelected, isLeft, how) {
        var txtValue, newNodeValue, oldNodeValue, offset, newNode;
        if (isFullySelected) {
          return _traverseFullySelected(n, how);
        }
        if (n.nodeType == 3) {
          txtValue = n.nodeValue;
          if (isLeft) {
            offset = self[START_OFFSET];
            newNodeValue = txtValue.substring(offset);
            oldNodeValue = txtValue.substring(0, offset);
          } else {
            offset = self[END_OFFSET];
            newNodeValue = txtValue.substring(0, offset);
            oldNodeValue = txtValue.substring(offset);
          }
          if (how != CLONE) {
            n.nodeValue = oldNodeValue;
          }
          if (how == DELETE) {
            return;
          }
          newNode = dom.clone(n, FALSE);
          newNode.nodeValue = newNodeValue;
          return newNode;
        }
        if (how == DELETE) {
          return;
        }
        return dom.clone(n, FALSE);
      }
      function _traverseFullySelected(n, how) {
        if (how != DELETE) {
          return how == CLONE ? dom.clone(n, TRUE) : n;
        }
        n.parentNode.removeChild(n);
      }
      function toStringIE() {
        return dom.create('body', null, cloneContents()).outerText;
      }
      extend(self, {
        startContainer: doc,
        startOffset: 0,
        endContainer: doc,
        endOffset: 0,
        collapsed: TRUE,
        commonAncestorContainer: doc,
        START_TO_START: 0,
        START_TO_END: 1,
        END_TO_END: 2,
        END_TO_START: 3,
        setStart: setStart,
        setEnd: setEnd,
        setStartBefore: setStartBefore,
        setStartAfter: setStartAfter,
        setEndBefore: setEndBefore,
        setEndAfter: setEndAfter,
        collapse: collapse,
        selectNode: selectNode,
        selectNodeContents: selectNodeContents,
        compareBoundaryPoints: compareBoundaryPoints,
        deleteContents: deleteContents,
        extractContents: extractContents,
        cloneContents: cloneContents,
        insertNode: insertNode,
        surroundContents: surroundContents,
        cloneRange: cloneRange,
        toStringIE: toStringIE
      });
      return self;
    }
    Range.prototype.toString = function () {
      return this.toStringIE();
    };
    return Range;
  });
  define('tinymce/html/Entities', ['tinymce/util/Tools'], function (Tools) {
    var makeMap = Tools.makeMap;
    var namedEntities, baseEntities, reverseEntities, attrsCharsRegExp = /[&<>\"\u007E-\uD7FF\uE000-\uFFEF]|[\uD800-\uDBFF][\uDC00-\uDFFF]/g, textCharsRegExp = /[<>&\u007E-\uD7FF\uE000-\uFFEF]|[\uD800-\uDBFF][\uDC00-\uDFFF]/g, rawCharsRegExp = /[<>&\"\']/g, entityRegExp = /&(#x|#)?([\w]+);/g, asciiMap = {
        128: '\u20ac',
        130: '\u201a',
        131: '\u0192',
        132: '\u201e',
        133: '\u2026',
        134: '\u2020',
        135: '\u2021',
        136: '\u02c6',
        137: '\u2030',
        138: '\u0160',
        139: '\u2039',
        140: '\u0152',
        142: '\u017d',
        145: '\u2018',
        146: '\u2019',
        147: '\u201c',
        148: '\u201d',
        149: '\u2022',
        150: '\u2013',
        151: '\u2014',
        152: '\u02dc',
        153: '\u2122',
        154: '\u0161',
        155: '\u203a',
        156: '\u0153',
        158: '\u017e',
        159: '\u0178'
      };
    baseEntities = {
      '"': '&quot;',
      '\'': '&#39;',
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;'
    };
    reverseEntities = {
      '&lt;': '<',
      '&gt;': '>',
      '&amp;': '&',
      '&quot;': '"',
      '&apos;': '\''
    };
    function nativeDecode(text) {
      var elm;
      elm = document.createElement('div');
      elm.innerHTML = text;
      return elm.textContent || elm.innerText || text;
    }
    function buildEntitiesLookup(items, radix) {
      var i, chr, entity, lookup = {};
      if (items) {
        items = items.split(',');
        radix = radix || 10;
        for (i = 0; i < items.length; i += 2) {
          chr = String.fromCharCode(parseInt(items[i], radix));
          if (!baseEntities[chr]) {
            entity = '&' + items[i + 1] + ';';
            lookup[chr] = entity;
            lookup[entity] = chr;
          }
        }
        return lookup;
      }
    }
    namedEntities = buildEntitiesLookup('50,nbsp,51,iexcl,52,cent,53,pound,54,curren,55,yen,56,brvbar,57,sect,58,uml,59,copy,' + '5a,ordf,5b,laquo,5c,not,5d,shy,5e,reg,5f,macr,5g,deg,5h,plusmn,5i,sup2,5j,sup3,5k,acute,' + '5l,micro,5m,para,5n,middot,5o,cedil,5p,sup1,5q,ordm,5r,raquo,5s,frac14,5t,frac12,5u,frac34,' + '5v,iquest,60,Agrave,61,Aacute,62,Acirc,63,Atilde,64,Auml,65,Aring,66,AElig,67,Ccedil,' + '68,Egrave,69,Eacute,6a,Ecirc,6b,Euml,6c,Igrave,6d,Iacute,6e,Icirc,6f,Iuml,6g,ETH,6h,Ntilde,' + '6i,Ograve,6j,Oacute,6k,Ocirc,6l,Otilde,6m,Ouml,6n,times,6o,Oslash,6p,Ugrave,6q,Uacute,' + '6r,Ucirc,6s,Uuml,6t,Yacute,6u,THORN,6v,szlig,70,agrave,71,aacute,72,acirc,73,atilde,74,auml,' + '75,aring,76,aelig,77,ccedil,78,egrave,79,eacute,7a,ecirc,7b,euml,7c,igrave,7d,iacute,7e,icirc,' + '7f,iuml,7g,eth,7h,ntilde,7i,ograve,7j,oacute,7k,ocirc,7l,otilde,7m,ouml,7n,divide,7o,oslash,' + '7p,ugrave,7q,uacute,7r,ucirc,7s,uuml,7t,yacute,7u,thorn,7v,yuml,ci,fnof,sh,Alpha,si,Beta,' + 'sj,Gamma,sk,Delta,sl,Epsilon,sm,Zeta,sn,Eta,so,Theta,sp,Iota,sq,Kappa,sr,Lambda,ss,Mu,' + 'st,Nu,su,Xi,sv,Omicron,t0,Pi,t1,Rho,t3,Sigma,t4,Tau,t5,Upsilon,t6,Phi,t7,Chi,t8,Psi,' + 't9,Omega,th,alpha,ti,beta,tj,gamma,tk,delta,tl,epsilon,tm,zeta,tn,eta,to,theta,tp,iota,' + 'tq,kappa,tr,lambda,ts,mu,tt,nu,tu,xi,tv,omicron,u0,pi,u1,rho,u2,sigmaf,u3,sigma,u4,tau,' + 'u5,upsilon,u6,phi,u7,chi,u8,psi,u9,omega,uh,thetasym,ui,upsih,um,piv,812,bull,816,hellip,' + '81i,prime,81j,Prime,81u,oline,824,frasl,88o,weierp,88h,image,88s,real,892,trade,89l,alefsym,' + '8cg,larr,8ch,uarr,8ci,rarr,8cj,darr,8ck,harr,8dl,crarr,8eg,lArr,8eh,uArr,8ei,rArr,8ej,dArr,' + '8ek,hArr,8g0,forall,8g2,part,8g3,exist,8g5,empty,8g7,nabla,8g8,isin,8g9,notin,8gb,ni,8gf,prod,' + '8gh,sum,8gi,minus,8gn,lowast,8gq,radic,8gt,prop,8gu,infin,8h0,ang,8h7,and,8h8,or,8h9,cap,8ha,cup,' + '8hb,int,8hk,there4,8hs,sim,8i5,cong,8i8,asymp,8j0,ne,8j1,equiv,8j4,le,8j5,ge,8k2,sub,8k3,sup,8k4,' + 'nsub,8k6,sube,8k7,supe,8kl,oplus,8kn,otimes,8l5,perp,8m5,sdot,8o8,lceil,8o9,rceil,8oa,lfloor,8ob,' + 'rfloor,8p9,lang,8pa,rang,9ea,loz,9j0,spades,9j3,clubs,9j5,hearts,9j6,diams,ai,OElig,aj,oelig,b0,' + 'Scaron,b1,scaron,bo,Yuml,m6,circ,ms,tilde,802,ensp,803,emsp,809,thinsp,80c,zwnj,80d,zwj,80e,lrm,' + '80f,rlm,80j,ndash,80k,mdash,80o,lsquo,80p,rsquo,80q,sbquo,80s,ldquo,80t,rdquo,80u,bdquo,810,dagger,' + '811,Dagger,81g,permil,81p,lsaquo,81q,rsaquo,85c,euro', 32);
    var Entities = {
        encodeRaw: function (text, attr) {
          return text.replace(attr ? attrsCharsRegExp : textCharsRegExp, function (chr) {
            return baseEntities[chr] || chr;
          });
        },
        encodeAllRaw: function (text) {
          return ('' + text).replace(rawCharsRegExp, function (chr) {
            return baseEntities[chr] || chr;
          });
        },
        encodeNumeric: function (text, attr) {
          return text.replace(attr ? attrsCharsRegExp : textCharsRegExp, function (chr) {
            if (chr.length > 1) {
              return '&#' + ((chr.charCodeAt(0) - 55296) * 1024 + (chr.charCodeAt(1) - 56320) + 65536) + ';';
            }
            return baseEntities[chr] || '&#' + chr.charCodeAt(0) + ';';
          });
        },
        encodeNamed: function (text, attr, entities) {
          entities = entities || namedEntities;
          return text.replace(attr ? attrsCharsRegExp : textCharsRegExp, function (chr) {
            return baseEntities[chr] || entities[chr] || chr;
          });
        },
        getEncodeFunc: function (name, entities) {
          entities = buildEntitiesLookup(entities) || namedEntities;
          function encodeNamedAndNumeric(text, attr) {
            return text.replace(attr ? attrsCharsRegExp : textCharsRegExp, function (chr) {
              return baseEntities[chr] || entities[chr] || '&#' + chr.charCodeAt(0) + ';' || chr;
            });
          }
          function encodeCustomNamed(text, attr) {
            return Entities.encodeNamed(text, attr, entities);
          }
          name = makeMap(name.replace(/\+/g, ','));
          if (name.named && name.numeric) {
            return encodeNamedAndNumeric;
          }
          if (name.named) {
            if (entities) {
              return encodeCustomNamed;
            }
            return Entities.encodeNamed;
          }
          if (name.numeric) {
            return Entities.encodeNumeric;
          }
          return Entities.encodeRaw;
        },
        decode: function (text) {
          return text.replace(entityRegExp, function (all, numeric, value) {
            if (numeric) {
              value = parseInt(value, numeric.length === 2 ? 16 : 10);
              if (value > 65535) {
                value -= 65536;
                return String.fromCharCode(55296 + (value >> 10), 56320 + (value & 1023));
              } else {
                return asciiMap[value] || String.fromCharCode(value);
              }
            }
            return reverseEntities[all] || namedEntities[all] || nativeDecode(all);
          });
        }
      };
    return Entities;
  });
  define('tinymce/Env', [], function () {
    var nav = navigator, userAgent = nav.userAgent;
    var opera, webkit, ie, ie11, gecko, mac, iDevice;
    opera = window.opera && window.opera.buildNumber;
    webkit = /WebKit/.test(userAgent);
    ie = !webkit && !opera && /MSIE/gi.test(userAgent) && /Explorer/gi.test(nav.appName);
    ie = ie && /MSIE (\w+)\./.exec(userAgent)[1];
    ie11 = userAgent.indexOf('Trident/') != -1 && (userAgent.indexOf('rv:') != -1 || nav.appName.indexOf('Netscape') != -1) ? 11 : false;
    ie = ie || ie11;
    gecko = !webkit && !ie11 && /Gecko/.test(userAgent);
    mac = userAgent.indexOf('Mac') != -1;
    iDevice = /(iPad|iPhone)/.test(userAgent);
    var contentEditable = !iDevice || userAgent.match(/AppleWebKit\/(\d*)/)[1] >= 534;
    return {
      opera: opera,
      webkit: webkit,
      ie: ie,
      gecko: gecko,
      mac: mac,
      iOS: iDevice,
      contentEditable: contentEditable,
      transparentSrc: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      caretAfter: ie != 8,
      range: window.getSelection && 'Range' in window,
      documentMode: ie ? document.documentMode || 7 : 10
    };
  });
  define('tinymce/dom/StyleSheetLoader', [], function () {
    'use strict';
    return function (document, settings) {
      var idCount = 0, loadedStates = {}, maxLoadTime;
      settings = settings || {};
      maxLoadTime = settings.maxLoadTime || 5000;
      function appendToHead(node) {
        document.getElementsByTagName('head')[0].appendChild(node);
      }
      function load(url, loadedCallback, errorCallback) {
        var link, style, startTime, state;
        function passed() {
          var callbacks = state.passed, i = callbacks.length;
          while (i--) {
            callbacks[i]();
          }
          state.status = 2;
          state.passed = [];
          state.failed = [];
        }
        function failed() {
          var callbacks = state.failed, i = callbacks.length;
          while (i--) {
            callbacks[i]();
          }
          state.status = 3;
          state.passed = [];
          state.failed = [];
        }
        function isOldWebKit() {
          var webKitChunks = navigator.userAgent.match(/WebKit\/(\d*)/);
          return !!(webKitChunks && webKitChunks[1] < 536);
        }
        function wait(testCallback, waitCallback) {
          if (!testCallback()) {
            if (new Date().getTime() - startTime < maxLoadTime) {
              window.setTimeout(waitCallback, 0);
            } else {
              failed();
            }
          }
        }
        function waitForWebKitLinkLoaded() {
          wait(function () {
            var styleSheets = document.styleSheets, styleSheet, i = styleSheets.length, owner;
            while (i--) {
              styleSheet = styleSheets[i];
              owner = styleSheet.ownerNode ? styleSheet.ownerNode : styleSheet.owningElement;
              if (owner && owner.id === link.id) {
                passed();
                return true;
              }
            }
          }, waitForWebKitLinkLoaded);
        }
        function waitForGeckoLinkLoaded() {
          wait(function () {
            try {
              var cssRules = style.sheet.cssRules;
              passed();
              return !!cssRules;
            } catch (ex) {
            }
          }, waitForGeckoLinkLoaded);
        }
        if (!loadedStates[url]) {
          state = {
            passed: [],
            failed: []
          };
          loadedStates[url] = state;
        } else {
          state = loadedStates[url];
        }
        if (loadedCallback) {
          state.passed.push(loadedCallback);
        }
        if (errorCallback) {
          state.failed.push(errorCallback);
        }
        if (state.status == 1) {
          return;
        }
        if (state.status == 2) {
          passed();
          return;
        }
        if (state.status == 3) {
          failed();
          return;
        }
        state.status = 1;
        link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.id = 'u' + idCount++;
        link.async = false;
        link.defer = false;
        startTime = new Date().getTime();
        if ('onload' in link && !isOldWebKit()) {
          link.onload = waitForWebKitLinkLoaded;
          link.onerror = failed;
        } else {
          if (navigator.userAgent.indexOf('Firefox') > 0) {
            style = document.createElement('style');
            style.textContent = '@import "' + url + '"';
            waitForGeckoLinkLoaded();
            appendToHead(style);
            return;
          } else {
            waitForWebKitLinkLoaded();
          }
        }
        appendToHead(link);
        link.href = url;
      }
      this.load = load;
    };
  });
  define('tinymce/dom/DOMUtils', [
    'tinymce/dom/Sizzle',
    'tinymce/html/Styles',
    'tinymce/dom/EventUtils',
    'tinymce/dom/TreeWalker',
    'tinymce/dom/Range',
    'tinymce/html/Entities',
    'tinymce/Env',
    'tinymce/util/Tools',
    'tinymce/dom/StyleSheetLoader'
  ], function (Sizzle, Styles, EventUtils, TreeWalker, Range, Entities, Env, Tools, StyleSheetLoader) {
    var each = Tools.each, is = Tools.is, grep = Tools.grep, trim = Tools.trim, extend = Tools.extend;
    var isWebKit = Env.webkit, isIE = Env.ie;
    var simpleSelectorRe = /^([a-z0-9],?)+$/i;
    var whiteSpaceRegExp = /^[ \t\r\n]*$/;
    var numericCssMap = Tools.makeMap('fillOpacity fontWeight lineHeight opacity orphans widows zIndex zoom', ' ');
    function DOMUtils(doc, settings) {
      var self = this, blockElementsMap;
      self.doc = doc;
      self.win = window;
      self.files = {};
      self.counter = 0;
      self.stdMode = !isIE || doc.documentMode >= 8;
      self.boxModel = !isIE || doc.compatMode == 'CSS1Compat' || self.stdMode;
      self.hasOuterHTML = 'outerHTML' in doc.createElement('a');
      self.styleSheetLoader = new StyleSheetLoader(doc);
      this.boundEvents = [];
      self.settings = settings = extend({
        keep_values: false,
        hex_colors: 1
      }, settings);
      self.schema = settings.schema;
      self.styles = new Styles({
        url_converter: settings.url_converter,
        url_converter_scope: settings.url_converter_scope
      }, settings.schema);
      self.fixDoc(doc);
      self.events = settings.ownEvents ? new EventUtils(settings.proxy) : EventUtils.Event;
      blockElementsMap = settings.schema ? settings.schema.getBlockElements() : {};
      self.isBlock = function (node) {
        if (!node) {
          return false;
        }
        var type = node.nodeType;
        if (type) {
          return !!(type === 1 && blockElementsMap[node.nodeName]);
        }
        return !!blockElementsMap[node];
      };
    }
    DOMUtils.prototype = {
      root: null,
      props: {
        'for': 'htmlFor',
        'class': 'className',
        className: 'className',
        checked: 'checked',
        disabled: 'disabled',
        maxlength: 'maxLength',
        readonly: 'readOnly',
        selected: 'selected',
        value: 'value',
        id: 'id',
        name: 'name',
        type: 'type'
      },
      fixDoc: function (doc) {
        var settings = this.settings, name;
        if (isIE && settings.schema) {
          ('abbr article aside audio canvas ' + 'details figcaption figure footer ' + 'header hgroup mark menu meter nav ' + 'output progress section summary ' + 'time video').replace(/\w+/g, function (name) {
            doc.createElement(name);
          });
          for (name in settings.schema.getCustomElements()) {
            doc.createElement(name);
          }
        }
      },
      clone: function (node, deep) {
        var self = this, clone, doc;
        if (!isIE || node.nodeType !== 1 || deep) {
          return node.cloneNode(deep);
        }
        doc = self.doc;
        if (!deep) {
          clone = doc.createElement(node.nodeName);
          each(self.getAttribs(node), function (attr) {
            self.setAttrib(clone, attr.nodeName, self.getAttrib(node, attr.nodeName));
          });
          return clone;
        }
        return clone.firstChild;
      },
      getRoot: function () {
        var self = this;
        return self.get(self.settings.root_element) || self.doc.body;
      },
      getViewPort: function (win) {
        var doc, rootElm;
        win = !win ? this.win : win;
        doc = win.document;
        rootElm = this.boxModel ? doc.documentElement : doc.body;
        return {
          x: win.pageXOffset || rootElm.scrollLeft,
          y: win.pageYOffset || rootElm.scrollTop,
          w: win.innerWidth || rootElm.clientWidth,
          h: win.innerHeight || rootElm.clientHeight
        };
      },
      getRect: function (elm) {
        var self = this, pos, size;
        elm = self.get(elm);
        pos = self.getPos(elm);
        size = self.getSize(elm);
        return {
          x: pos.x,
          y: pos.y,
          w: size.w,
          h: size.h
        };
      },
      getSize: function (elm) {
        var self = this, w, h;
        elm = self.get(elm);
        w = self.getStyle(elm, 'width');
        h = self.getStyle(elm, 'height');
        if (w.indexOf('px') === -1) {
          w = 0;
        }
        if (h.indexOf('px') === -1) {
          h = 0;
        }
        return {
          w: parseInt(w, 10) || elm.offsetWidth || elm.clientWidth,
          h: parseInt(h, 10) || elm.offsetHeight || elm.clientHeight
        };
      },
      getParent: function (node, selector, root) {
        return this.getParents(node, selector, root, false);
      },
      getParents: function (node, selector, root, collect) {
        var self = this, selectorVal, result = [];
        node = self.get(node);
        collect = collect === undefined;
        root = root || (self.getRoot().nodeName != 'BODY' ? self.getRoot().parentNode : null);
        if (is(selector, 'string')) {
          selectorVal = selector;
          if (selector === '*') {
            selector = function (node) {
              return node.nodeType == 1;
            };
          } else {
            selector = function (node) {
              return self.is(node, selectorVal);
            };
          }
        }
        while (node) {
          if (node == root || !node.nodeType || node.nodeType === 9) {
            break;
          }
          if (!selector || selector(node)) {
            if (collect) {
              result.push(node);
            } else {
              return node;
            }
          }
          node = node.parentNode;
        }
        return collect ? result : null;
      },
      get: function (elm) {
        var name;
        if (elm && this.doc && typeof elm == 'string') {
          name = elm;
          elm = this.doc.getElementById(elm);
          if (elm && elm.id !== name) {
            return this.doc.getElementsByName(name)[1];
          }
        }
        return elm;
      },
      getNext: function (node, selector) {
        return this._findSib(node, selector, 'nextSibling');
      },
      getPrev: function (node, selector) {
        return this._findSib(node, selector, 'previousSibling');
      },
      select: function (selector, scope) {
        var self = this;
        return Sizzle(selector, self.get(scope) || self.get(self.settings.root_element) || self.doc, []);
      },
      is: function (elm, selector) {
        var i;
        if (elm.length === undefined) {
          if (selector === '*') {
            return elm.nodeType == 1;
          }
          if (simpleSelectorRe.test(selector)) {
            selector = selector.toLowerCase().split(/,/);
            elm = elm.nodeName.toLowerCase();
            for (i = selector.length - 1; i >= 0; i--) {
              if (selector[i] == elm) {
                return true;
              }
            }
            return false;
          }
        }
        if (elm.nodeType && elm.nodeType != 1) {
          return false;
        }
        return Sizzle.matches(selector, elm.nodeType ? [elm] : elm).length > 0;
      },
      add: function (parentElm, name, attrs, html, create) {
        var self = this;
        return this.run(parentElm, function (parentElm) {
          var newElm;
          newElm = is(name, 'string') ? self.doc.createElement(name) : name;
          self.setAttribs(newElm, attrs);
          if (html) {
            if (html.nodeType) {
              newElm.appendChild(html);
            } else {
              self.setHTML(newElm, html);
            }
          }
          return !create ? parentElm.appendChild(newElm) : newElm;
        });
      },
      create: function (name, attrs, html) {
        return this.add(this.doc.createElement(name), name, attrs, html, 1);
      },
      createHTML: function (name, attrs, html) {
        var outHtml = '', key;
        outHtml += '<' + name;
        for (key in attrs) {
          if (attrs.hasOwnProperty(key) && attrs[key] !== null) {
            outHtml += ' ' + key + '="' + this.encode(attrs[key]) + '"';
          }
        }
        if (typeof html != 'undefined') {
          return outHtml + '>' + html + '</' + name + '>';
        }
        return outHtml + ' />';
      },
      createFragment: function (html) {
        var frag, node, doc = this.doc, container;
        container = doc.createElement('div');
        frag = doc.createDocumentFragment();
        if (html) {
          container.innerHTML = html;
        }
        while (node = container.firstChild) {
          frag.appendChild(node);
        }
        return frag;
      },
      remove: function (node, keep_children) {
        return this.run(node, function (node) {
          var child, parent = node.parentNode;
          if (!parent) {
            return null;
          }
          if (keep_children) {
            while (child = node.firstChild) {
              if (!isIE || child.nodeType !== 3 || child.nodeValue) {
                parent.insertBefore(child, node);
              } else {
                node.removeChild(child);
              }
            }
          }
          return parent.removeChild(node);
        });
      },
      setStyle: function (elm, name, value) {
        return this.run(elm, function (elm) {
          var self = this, style, key;
          if (name) {
            if (typeof name === 'string') {
              style = elm.style;
              name = name.replace(/-(\D)/g, function (a, b) {
                return b.toUpperCase();
              });
              if (typeof value === 'number' && !numericCssMap[name]) {
                value += 'px';
              }
              if (name === 'opacity' && elm.runtimeStyle && typeof elm.runtimeStyle.opacity === 'undefined') {
                style.filter = value === '' ? '' : 'alpha(opacity=' + value * 100 + ')';
              }
              if (name == 'float') {
                name = 'cssFloat' in elm.style ? 'cssFloat' : 'styleFloat';
              }
              try {
                style[name] = value;
              } catch (ex) {
              }
              if (self.settings.update_styles) {
                elm.removeAttribute('data-mce-style');
              }
            } else {
              for (key in name) {
                self.setStyle(elm, key, name[key]);
              }
            }
          }
        });
      },
      getStyle: function (elm, name, computed) {
        elm = this.get(elm);
        if (!elm) {
          return;
        }
        if (this.doc.defaultView && computed) {
          name = name.replace(/[A-Z]/g, function (a) {
            return '-' + a;
          });
          try {
            return this.doc.defaultView.getComputedStyle(elm, null).getPropertyValue(name);
          } catch (ex) {
            return null;
          }
        }
        name = name.replace(/-(\D)/g, function (a, b) {
          return b.toUpperCase();
        });
        if (name == 'float') {
          name = isIE ? 'styleFloat' : 'cssFloat';
        }
        if (elm.currentStyle && computed) {
          return elm.currentStyle[name];
        }
        return elm.style ? elm.style[name] : undefined;
      },
      setStyles: function (elm, styles) {
        this.setStyle(elm, styles);
      },
      css: function (elm, name, value) {
        this.setStyle(elm, name, value);
      },
      removeAllAttribs: function (e) {
        return this.run(e, function (e) {
          var i, attrs = e.attributes;
          for (i = attrs.length - 1; i >= 0; i--) {
            e.removeAttributeNode(attrs.item(i));
          }
        });
      },
      setAttrib: function (e, n, v) {
        var self = this;
        if (!e || !n) {
          return;
        }
        return this.run(e, function (e) {
          var s = self.settings;
          var originalValue = e.getAttribute(n);
          if (v !== null) {
            switch (n) {
            case 'style':
              if (!is(v, 'string')) {
                each(v, function (v, n) {
                  self.setStyle(e, n, v);
                });
                return;
              }
              if (s.keep_values) {
                if (v) {
                  e.setAttribute('data-mce-style', v, 2);
                } else {
                  e.removeAttribute('data-mce-style', 2);
                }
              }
              e.style.cssText = v;
              break;
            case 'class':
              e.className = v || '';
              break;
            case 'src':
            case 'href':
              if (s.keep_values) {
                if (s.url_converter) {
                  v = s.url_converter.call(s.url_converter_scope || self, v, n, e);
                }
                self.setAttrib(e, 'data-mce-' + n, v, 2);
              }
              break;
            case 'shape':
              e.setAttribute('data-mce-style', v);
              break;
            }
          }
          if (is(v) && v !== null && v.length !== 0) {
            e.setAttribute(n, '' + v, 2);
          } else {
            e.removeAttribute(n, 2);
          }
          if (originalValue != v && s.onSetAttrib) {
            s.onSetAttrib({
              attrElm: e,
              attrName: n,
              attrValue: v
            });
          }
        });
      },
      setAttribs: function (elm, attrs) {
        var self = this;
        return this.run(elm, function (elm) {
          each(attrs, function (value, name) {
            self.setAttrib(elm, name, value);
          });
        });
      },
      getAttrib: function (elm, name, defaultVal) {
        var value, self = this, undef;
        elm = self.get(elm);
        if (!elm || elm.nodeType !== 1) {
          return defaultVal === undef ? false : defaultVal;
        }
        if (!is(defaultVal)) {
          defaultVal = '';
        }
        if (/^(src|href|style|coords|shape)$/.test(name)) {
          value = elm.getAttribute('data-mce-' + name);
          if (value) {
            return value;
          }
        }
        if (isIE && self.props[name]) {
          value = elm[self.props[name]];
          value = value && value.nodeValue ? value.nodeValue : value;
        }
        if (!value) {
          value = elm.getAttribute(name, 2);
        }
        if (/^(checked|compact|declare|defer|disabled|ismap|multiple|nohref|noshade|nowrap|readonly|selected)$/.test(name)) {
          if (elm[self.props[name]] === true && value === '') {
            return name;
          }
          return value ? name : '';
        }
        if (elm.nodeName === 'FORM' && elm.getAttributeNode(name)) {
          return elm.getAttributeNode(name).nodeValue;
        }
        if (name === 'style') {
          value = value || elm.style.cssText;
          if (value) {
            value = self.serializeStyle(self.parseStyle(value), elm.nodeName);
            if (self.settings.keep_values) {
              elm.setAttribute('data-mce-style', value);
            }
          }
        }
        if (isWebKit && name === 'class' && value) {
          value = value.replace(/(apple|webkit)\-[a-z\-]+/gi, '');
        }
        if (isIE) {
          switch (name) {
          case 'rowspan':
          case 'colspan':
            if (value === 1) {
              value = '';
            }
            break;
          case 'size':
            if (value === '+0' || value === 20 || value === 0) {
              value = '';
            }
            break;
          case 'width':
          case 'height':
          case 'vspace':
          case 'checked':
          case 'disabled':
          case 'readonly':
            if (value === 0) {
              value = '';
            }
            break;
          case 'hspace':
            if (value === -1) {
              value = '';
            }
            break;
          case 'maxlength':
          case 'tabindex':
            if (value === 32768 || value === 2147483647 || value === '32768') {
              value = '';
            }
            break;
          case 'multiple':
          case 'compact':
          case 'noshade':
          case 'nowrap':
            if (value === 65535) {
              return name;
            }
            return defaultVal;
          case 'shape':
            value = value.toLowerCase();
            break;
          default:
            if (name.indexOf('on') === 0 && value) {
              value = ('' + value).replace(/^function\s+\w+\(\)\s+\{\s+(.*)\s+\}$/, '$1');
            }
          }
        }
        return value !== undef && value !== null && value !== '' ? '' + value : defaultVal;
      },
      getPos: function (elm, rootElm) {
        var self = this, x = 0, y = 0, offsetParent, doc = self.doc, pos;
        elm = self.get(elm);
        rootElm = rootElm || doc.body;
        if (elm) {
          if (rootElm === doc.body && elm.getBoundingClientRect) {
            pos = elm.getBoundingClientRect();
            rootElm = self.boxModel ? doc.documentElement : doc.body;
            x = pos.left + (doc.documentElement.scrollLeft || doc.body.scrollLeft) - rootElm.clientLeft;
            y = pos.top + (doc.documentElement.scrollTop || doc.body.scrollTop) - rootElm.clientTop;
            return {
              x: x,
              y: y
            };
          }
          offsetParent = elm;
          while (offsetParent && offsetParent != rootElm && offsetParent.nodeType) {
            x += offsetParent.offsetLeft || 0;
            y += offsetParent.offsetTop || 0;
            offsetParent = offsetParent.offsetParent;
          }
          offsetParent = elm.parentNode;
          while (offsetParent && offsetParent != rootElm && offsetParent.nodeType) {
            x -= offsetParent.scrollLeft || 0;
            y -= offsetParent.scrollTop || 0;
            offsetParent = offsetParent.parentNode;
          }
        }
        return {
          x: x,
          y: y
        };
      },
      parseStyle: function (cssText) {
        return this.styles.parse(cssText);
      },
      serializeStyle: function (styles, name) {
        return this.styles.serialize(styles, name);
      },
      addStyle: function (cssText) {
        var self = this, doc = self.doc, head, styleElm;
        if (self !== DOMUtils.DOM && doc === document) {
          var addedStyles = DOMUtils.DOM.addedStyles;
          addedStyles = addedStyles || [];
          if (addedStyles[cssText]) {
            return;
          }
          addedStyles[cssText] = true;
          DOMUtils.DOM.addedStyles = addedStyles;
        }
        styleElm = doc.getElementById('mceDefaultStyles');
        if (!styleElm) {
          styleElm = doc.createElement('style');
          styleElm.id = 'mceDefaultStyles';
          styleElm.type = 'text/css';
          head = doc.getElementsByTagName('head')[0];
          if (head.firstChild) {
            head.insertBefore(styleElm, head.firstChild);
          } else {
            head.appendChild(styleElm);
          }
        }
        if (styleElm.styleSheet) {
          styleElm.styleSheet.cssText += cssText;
        } else {
          styleElm.appendChild(doc.createTextNode(cssText));
        }
      },
      loadCSS: function (url) {
        var self = this, doc = self.doc, head;
        if (self !== DOMUtils.DOM && doc === document) {
          DOMUtils.DOM.loadCSS(url);
          return;
        }
        if (!url) {
          url = '';
        }
        head = doc.getElementsByTagName('head')[0];
        each(url.split(','), function (url) {
          var link;
          if (self.files[url]) {
            return;
          }
          self.files[url] = true;
          link = self.create('link', {
            rel: 'stylesheet',
            href: url
          });
          if (isIE && doc.documentMode && doc.recalc) {
            link.onload = function () {
              if (doc.recalc) {
                doc.recalc();
              }
              link.onload = null;
            };
          }
          head.appendChild(link);
        });
      },
      addClass: function (elm, cls) {
        return this.run(elm, function (elm) {
          var clsVal;
          if (!cls) {
            return 0;
          }
          if (this.hasClass(elm, cls)) {
            return elm.className;
          }
          clsVal = this.removeClass(elm, cls);
          elm.className = clsVal = (clsVal !== '' ? clsVal + ' ' : '') + cls;
          return clsVal;
        });
      },
      removeClass: function (elm, cls) {
        var self = this, re;
        return self.run(elm, function (elm) {
          var val;
          if (self.hasClass(elm, cls)) {
            if (!re) {
              re = new RegExp('(^|\\s+)' + cls + '(\\s+|$)', 'g');
            }
            val = elm.className.replace(re, ' ');
            val = trim(val != ' ' ? val : '');
            elm.className = val;
            if (!val) {
              elm.removeAttribute('class');
              elm.removeAttribute('className');
            }
            return val;
          }
          return elm.className;
        });
      },
      hasClass: function (elm, cls) {
        elm = this.get(elm);
        if (!elm || !cls) {
          return false;
        }
        return (' ' + elm.className + ' ').indexOf(' ' + cls + ' ') !== -1;
      },
      toggleClass: function (elm, cls, state) {
        state = state === undefined ? !this.hasClass(elm, cls) : state;
        if (this.hasClass(elm, cls) !== state) {
          if (state) {
            this.addClass(elm, cls);
          } else {
            this.removeClass(elm, cls);
          }
        }
      },
      show: function (elm) {
        return this.setStyle(elm, 'display', 'block');
      },
      hide: function (elm) {
        return this.setStyle(elm, 'display', 'none');
      },
      isHidden: function (elm) {
        elm = this.get(elm);
        return !elm || elm.style.display == 'none' || this.getStyle(elm, 'display') == 'none';
      },
      uniqueId: function (prefix) {
        return (!prefix ? 'mce_' : prefix) + this.counter++;
      },
      setHTML: function (element, html) {
        var self = this;
        return self.run(element, function (element) {
          if (isIE) {
            while (element.firstChild) {
              element.removeChild(element.firstChild);
            }
            try {
              element.innerHTML = '<br />' + html;
              element.removeChild(element.firstChild);
            } catch (ex) {
              var newElement = self.create('div');
              newElement.innerHTML = '<br />' + html;
              each(grep(newElement.childNodes), function (node, i) {
                if (i && element.canHaveHTML) {
                  element.appendChild(node);
                }
              });
            }
          } else {
            element.innerHTML = html;
          }
          return html;
        });
      },
      getOuterHTML: function (elm) {
        var doc, self = this;
        elm = self.get(elm);
        if (!elm) {
          return null;
        }
        if (elm.nodeType === 1 && self.hasOuterHTML) {
          return elm.outerHTML;
        }
        doc = (elm.ownerDocument || self.doc).createElement('body');
        doc.appendChild(elm.cloneNode(true));
        return doc.innerHTML;
      },
      setOuterHTML: function (elm, html, doc) {
        var self = this;
        return self.run(elm, function (elm) {
          function set() {
            var node, tempElm;
            tempElm = doc.createElement('body');
            tempElm.innerHTML = html;
            node = tempElm.lastChild;
            while (node) {
              self.insertAfter(node.cloneNode(true), elm);
              node = node.previousSibling;
            }
            self.remove(elm);
          }
          if (elm.nodeType == 1) {
            doc = doc || elm.ownerDocument || self.doc;
            if (isIE) {
              try {
                if (elm.nodeType == 1 && self.hasOuterHTML) {
                  elm.outerHTML = html;
                } else {
                  set();
                }
              } catch (ex) {
                set();
              }
            } else {
              set();
            }
          }
        });
      },
      decode: Entities.decode,
      encode: Entities.encodeAllRaw,
      insertAfter: function (node, reference_node) {
        reference_node = this.get(reference_node);
        return this.run(node, function (node) {
          var parent, nextSibling;
          parent = reference_node.parentNode;
          nextSibling = reference_node.nextSibling;
          if (nextSibling) {
            parent.insertBefore(node, nextSibling);
          } else {
            parent.appendChild(node);
          }
          return node;
        });
      },
      replace: function (newElm, oldElm, keepChildren) {
        var self = this;
        return self.run(oldElm, function (oldElm) {
          if (is(oldElm, 'array')) {
            newElm = newElm.cloneNode(true);
          }
          if (keepChildren) {
            each(grep(oldElm.childNodes), function (node) {
              newElm.appendChild(node);
            });
          }
          return oldElm.parentNode.replaceChild(newElm, oldElm);
        });
      },
      rename: function (elm, name) {
        var self = this, newElm;
        if (elm.nodeName != name.toUpperCase()) {
          newElm = self.create(name);
          each(self.getAttribs(elm), function (attr_node) {
            self.setAttrib(newElm, attr_node.nodeName, self.getAttrib(elm, attr_node.nodeName));
          });
          self.replace(newElm, elm, 1);
        }
        return newElm || elm;
      },
      findCommonAncestor: function (a, b) {
        var ps = a, pe;
        while (ps) {
          pe = b;
          while (pe && ps != pe) {
            pe = pe.parentNode;
          }
          if (ps == pe) {
            break;
          }
          ps = ps.parentNode;
        }
        if (!ps && a.ownerDocument) {
          return a.ownerDocument.documentElement;
        }
        return ps;
      },
      toHex: function (rgbVal) {
        return this.styles.toHex(Tools.trim(rgbVal));
      },
      run: function (elm, func, scope) {
        var self = this, result;
        if (typeof elm === 'string') {
          elm = self.get(elm);
        }
        if (!elm) {
          return false;
        }
        scope = scope || this;
        if (!elm.nodeType && (elm.length || elm.length === 0)) {
          result = [];
          each(elm, function (elm, i) {
            if (elm) {
              if (typeof elm == 'string') {
                elm = self.get(elm);
              }
              result.push(func.call(scope, elm, i));
            }
          });
          return result;
        }
        return func.call(scope, elm);
      },
      getAttribs: function (elm) {
        var attrs;
        elm = this.get(elm);
        if (!elm) {
          return [];
        }
        if (isIE) {
          attrs = [];
          if (elm.nodeName == 'OBJECT') {
            return elm.attributes;
          }
          if (elm.nodeName === 'OPTION' && this.getAttrib(elm, 'selected')) {
            attrs.push({
              specified: 1,
              nodeName: 'selected'
            });
          }
          var attrRegExp = /<\/?[\w:\-]+ ?|=[\"][^\"]+\"|=\'[^\']+\'|=[\w\-]+|>/gi;
          elm.cloneNode(false).outerHTML.replace(attrRegExp, '').replace(/[\w:\-]+/gi, function (a) {
            attrs.push({
              specified: 1,
              nodeName: a
            });
          });
          return attrs;
        }
        return elm.attributes;
      },
      isEmpty: function (node, elements) {
        var self = this, i, attributes, type, walker, name, brCount = 0;
        node = node.firstChild;
        if (node) {
          walker = new TreeWalker(node, node.parentNode);
          elements = elements || self.schema ? self.schema.getNonEmptyElements() : null;
          do {
            type = node.nodeType;
            if (type === 1) {
              if (node.getAttribute('data-mce-bogus')) {
                continue;
              }
              name = node.nodeName.toLowerCase();
              if (elements && elements[name]) {
                if (name === 'br') {
                  brCount++;
                  continue;
                }
                return false;
              }
              attributes = self.getAttribs(node);
              i = node.attributes.length;
              while (i--) {
                name = node.attributes[i].nodeName;
                if (name === 'name' || name === 'data-mce-bookmark') {
                  return false;
                }
              }
            }
            if (type == 8) {
              return false;
            }
            if (type === 3 && !whiteSpaceRegExp.test(node.nodeValue)) {
              return false;
            }
          } while (node = walker.next());
        }
        return brCount <= 1;
      },
      createRng: function () {
        var doc = this.doc;
        return doc.createRange ? doc.createRange() : new Range(this);
      },
      nodeIndex: function (node, normalized) {
        var idx = 0, lastNodeType, nodeType;
        if (node) {
          for (lastNodeType = node.nodeType, node = node.previousSibling; node; node = node.previousSibling) {
            nodeType = node.nodeType;
            if (normalized && nodeType == 3) {
              if (nodeType == lastNodeType || !node.nodeValue.length) {
                continue;
              }
            }
            idx++;
            lastNodeType = nodeType;
          }
        }
        return idx;
      },
      split: function (parentElm, splitElm, replacementElm) {
        var self = this, r = self.createRng(), bef, aft, pa;
        function trimNode(node) {
          var i, children = node.childNodes, type = node.nodeType;
          function surroundedBySpans(node) {
            var previousIsSpan = node.previousSibling && node.previousSibling.nodeName == 'SPAN';
            var nextIsSpan = node.nextSibling && node.nextSibling.nodeName == 'SPAN';
            return previousIsSpan && nextIsSpan;
          }
          if (type == 1 && node.getAttribute('data-mce-type') == 'bookmark') {
            return;
          }
          for (i = children.length - 1; i >= 0; i--) {
            trimNode(children[i]);
          }
          if (type != 9) {
            if (type == 3 && node.nodeValue.length > 0) {
              var trimmedLength = trim(node.nodeValue).length;
              if (!self.isBlock(node.parentNode) || trimmedLength > 0 || trimmedLength === 0 && surroundedBySpans(node)) {
                return;
              }
            } else if (type == 1) {
              children = node.childNodes;
              if (children.length == 1 && children[0] && children[0].nodeType == 1 && children[0].getAttribute('data-mce-type') == 'bookmark') {
                node.parentNode.insertBefore(children[0], node);
              }
              if (children.length || /^(br|hr|input|img)$/i.test(node.nodeName)) {
                return;
              }
            }
            self.remove(node);
          }
          return node;
        }
        if (parentElm && splitElm) {
          r.setStart(parentElm.parentNode, self.nodeIndex(parentElm));
          r.setEnd(splitElm.parentNode, self.nodeIndex(splitElm));
          bef = r.extractContents();
          r = self.createRng();
          r.setStart(splitElm.parentNode, self.nodeIndex(splitElm) + 1);
          r.setEnd(parentElm.parentNode, self.nodeIndex(parentElm) + 1);
          aft = r.extractContents();
          pa = parentElm.parentNode;
          pa.insertBefore(trimNode(bef), parentElm);
          if (replacementElm) {
            pa.replaceChild(replacementElm, splitElm);
          } else {
            pa.insertBefore(splitElm, parentElm);
          }
          pa.insertBefore(trimNode(aft), parentElm);
          self.remove(parentElm);
          return replacementElm || splitElm;
        }
      },
      bind: function (target, name, func, scope) {
        var self = this;
        if (Tools.isArray(target)) {
          var i = target.length;
          while (i--) {
            target[i] = self.bind(target[i], name, func, scope);
          }
          return target;
        }
        if (self.settings.collect && (target === self.doc || target === self.win)) {
          self.boundEvents.push([
            target,
            name,
            func,
            scope
          ]);
        }
        return self.events.bind(target, name, func, scope || self);
      },
      unbind: function (target, name, func) {
        var self = this, i;
        if (Tools.isArray(target)) {
          i = target.length;
          while (i--) {
            target[i] = self.unbind(target[i], name, func);
          }
          return target;
        }
        if (self.boundEvents && (target === self.doc || target === self.win)) {
          i = self.boundEvents.length;
          while (i--) {
            var item = self.boundEvents[i];
            if (target == item[0] && (!name || name == item[1]) && (!func || func == item[2])) {
              this.events.unbind(item[0], item[1], item[2]);
            }
          }
        }
        return this.events.unbind(target, name, func);
      },
      fire: function (target, name, evt) {
        return this.events.fire(target, name, evt);
      },
      getContentEditable: function (node) {
        var contentEditable;
        if (node.nodeType != 1) {
          return null;
        }
        contentEditable = node.getAttribute('data-mce-contenteditable');
        if (contentEditable && contentEditable !== 'inherit') {
          return contentEditable;
        }
        return node.contentEditable !== 'inherit' ? node.contentEditable : null;
      },
      destroy: function () {
        var self = this;
        if (self.boundEvents) {
          var i = self.boundEvents.length;
          while (i--) {
            var item = self.boundEvents[i];
            this.events.unbind(item[0], item[1], item[2]);
          }
          self.boundEvents = null;
        }
        if (Sizzle.setDocument) {
          Sizzle.setDocument();
        }
        self.win = self.doc = self.root = self.events = self.frag = null;
      },
      dumpRng: function (r) {
        return 'startContainer: ' + r.startContainer.nodeName + ', startOffset: ' + r.startOffset + ', endContainer: ' + r.endContainer.nodeName + ', endOffset: ' + r.endOffset;
      },
      _findSib: function (node, selector, name) {
        var self = this, func = selector;
        if (node) {
          if (typeof func == 'string') {
            func = function (node) {
              return self.is(node, selector);
            };
          }
          for (node = node[name]; node; node = node[name]) {
            if (func(node)) {
              return node;
            }
          }
        }
        return null;
      }
    };
    DOMUtils.DOM = new DOMUtils(document);
    return DOMUtils;
  });
  define('tinymce/dom/ScriptLoader', [
    'tinymce/dom/DOMUtils',
    'tinymce/util/Tools'
  ], function (DOMUtils, Tools) {
    var DOM = DOMUtils.DOM;
    var each = Tools.each, grep = Tools.grep;
    function ScriptLoader() {
      var QUEUED = 0, LOADING = 1, LOADED = 2, states = {}, queue = [], scriptLoadedCallbacks = {}, queueLoadedCallbacks = [], loading = 0, undef;
      function loadScript(url, callback) {
        var dom = DOM, elm, id;
        function done() {
          dom.remove(id);
          if (elm) {
            elm.onreadystatechange = elm.onload = elm = null;
          }
          callback();
        }
        function error() {
          if (typeof console !== 'undefined' && console.log) {
            console.log('Failed to load: ' + url);
          }
        }
        id = dom.uniqueId();
        elm = document.createElement('script');
        elm.id = id;
        elm.type = 'text/javascript';
        elm.src = url;
        if ('onreadystatechange' in elm) {
          elm.onreadystatechange = function () {
            if (/loaded|complete/.test(elm.readyState)) {
              done();
            }
          };
        } else {
          elm.onload = done;
        }
        elm.onerror = error;
        (document.getElementsByTagName('head')[0] || document.body).appendChild(elm);
      }
      this.isDone = function (url) {
        return states[url] == LOADED;
      };
      this.markDone = function (url) {
        states[url] = LOADED;
      };
      this.add = this.load = function (url, callback, scope) {
        var state = states[url];
        if (state == undef) {
          queue.push(url);
          states[url] = QUEUED;
        }
        if (callback) {
          if (!scriptLoadedCallbacks[url]) {
            scriptLoadedCallbacks[url] = [];
          }
          scriptLoadedCallbacks[url].push({
            func: callback,
            scope: scope || this
          });
        }
      };
      this.loadQueue = function (callback, scope) {
        this.loadScripts(queue, callback, scope);
      };
      this.loadScripts = function (scripts, callback, scope) {
        var loadScripts;
        function execScriptLoadedCallbacks(url) {
          each(scriptLoadedCallbacks[url], function (callback) {
            callback.func.call(callback.scope);
          });
          scriptLoadedCallbacks[url] = undef;
        }
        queueLoadedCallbacks.push({
          func: callback,
          scope: scope || this
        });
        loadScripts = function () {
          var loadingScripts = grep(scripts);
          scripts.length = 0;
          each(loadingScripts, function (url) {
            if (states[url] == LOADED) {
              execScriptLoadedCallbacks(url);
              return;
            }
            if (states[url] != LOADING) {
              states[url] = LOADING;
              loading++;
              loadScript(url, function () {
                states[url] = LOADED;
                loading--;
                execScriptLoadedCallbacks(url);
                loadScripts();
              });
            }
          });
          if (!loading) {
            each(queueLoadedCallbacks, function (callback) {
              callback.func.call(callback.scope);
            });
            queueLoadedCallbacks.length = 0;
          }
        };
        loadScripts();
      };
    }
    ScriptLoader.ScriptLoader = new ScriptLoader();
    return ScriptLoader;
  });
  define('tinymce/AddOnManager', [
    'tinymce/dom/ScriptLoader',
    'tinymce/util/Tools'
  ], function (ScriptLoader, Tools) {
    var each = Tools.each;
    function AddOnManager() {
      var self = this;
      self.items = [];
      self.urls = {};
      self.lookup = {};
    }
    AddOnManager.prototype = {
      get: function (name) {
        if (this.lookup[name]) {
          return this.lookup[name].instance;
        } else {
          return undefined;
        }
      },
      dependencies: function (name) {
        var result;
        if (this.lookup[name]) {
          result = this.lookup[name].dependencies;
        }
        return result || [];
      },
      requireLangPack: function (name, languages) {
        if (AddOnManager.language && AddOnManager.languageLoad !== false) {
          if (languages && new RegExp('([, ]|\\b)' + AddOnManager.language + '([, ]|\\b)').test(languages) === false) {
            return;
          }
          ScriptLoader.ScriptLoader.add(this.urls[name] + '/langs/' + AddOnManager.language + '.js');
        }
      },
      add: function (id, addOn, dependencies) {
        this.items.push(addOn);
        this.lookup[id] = {
          instance: addOn,
          dependencies: dependencies
        };
        return addOn;
      },
      createUrl: function (baseUrl, dep) {
        if (typeof dep === 'object') {
          return dep;
        } else {
          return {
            prefix: baseUrl.prefix,
            resource: dep,
            suffix: baseUrl.suffix
          };
        }
      },
      addComponents: function (pluginName, scripts) {
        var pluginUrl = this.urls[pluginName];
        each(scripts, function (script) {
          ScriptLoader.ScriptLoader.add(pluginUrl + '/' + script);
        });
      },
      load: function (name, addOnUrl, callback, scope) {
        var self = this, url = addOnUrl;
        function loadDependencies() {
          var dependencies = self.dependencies(name);
          each(dependencies, function (dep) {
            var newUrl = self.createUrl(addOnUrl, dep);
            self.load(newUrl.resource, newUrl, undefined, undefined);
          });
          if (callback) {
            if (scope) {
              callback.call(scope);
            } else {
              callback.call(ScriptLoader);
            }
          }
        }
        if (self.urls[name]) {
          return;
        }
        if (typeof addOnUrl === 'object') {
          url = addOnUrl.prefix + addOnUrl.resource + addOnUrl.suffix;
        }
        if (url.indexOf('/') !== 0 && url.indexOf('://') == -1) {
          url = AddOnManager.baseURL + '/' + url;
        }
        self.urls[name] = url.substring(0, url.lastIndexOf('/'));
        if (self.lookup[name]) {
          loadDependencies();
        } else {
          ScriptLoader.ScriptLoader.add(url, loadDependencies, scope);
        }
      }
    };
    AddOnManager.PluginManager = new AddOnManager();
    AddOnManager.ThemeManager = new AddOnManager();
    return AddOnManager;
  });
  define('tinymce/html/Node', [], function () {
    var whiteSpaceRegExp = /^[ \t\r\n]*$/, typeLookup = {
        '#text': 3,
        '#comment': 8,
        '#cdata': 4,
        '#pi': 7,
        '#doctype': 10,
        '#document-fragment': 11
      };
    function walk(node, root_node, prev) {
      var sibling, parent, startName = prev ? 'lastChild' : 'firstChild', siblingName = prev ? 'prev' : 'next';
      if (node[startName]) {
        return node[startName];
      }
      if (node !== root_node) {
        sibling = node[siblingName];
        if (sibling) {
          return sibling;
        }
        for (parent = node.parent; parent && parent !== root_node; parent = parent.parent) {
          sibling = parent[siblingName];
          if (sibling) {
            return sibling;
          }
        }
      }
    }
    function Node(name, type) {
      this.name = name;
      this.type = type;
      if (type === 1) {
        this.attributes = [];
        this.attributes.map = {};
      }
    }
    Node.prototype = {
      replace: function (node) {
        var self = this;
        if (node.parent) {
          node.remove();
        }
        self.insert(node, self);
        self.remove();
        return self;
      },
      attr: function (name, value) {
        var self = this, attrs, i, undef;
        if (typeof name !== 'string') {
          for (i in name) {
            self.attr(i, name[i]);
          }
          return self;
        }
        if (attrs = self.attributes) {
          if (value !== undef) {
            if (value === null) {
              if (name in attrs.map) {
                delete attrs.map[name];
                i = attrs.length;
                while (i--) {
                  if (attrs[i].name === name) {
                    attrs = attrs.splice(i, 1);
                    return self;
                  }
                }
              }
              return self;
            }
            if (name in attrs.map) {
              i = attrs.length;
              while (i--) {
                if (attrs[i].name === name) {
                  attrs[i].value = value;
                  break;
                }
              }
            } else {
              attrs.push({
                name: name,
                value: value
              });
            }
            attrs.map[name] = value;
            return self;
          } else {
            return attrs.map[name];
          }
        }
      },
      clone: function () {
        var self = this, clone = new Node(self.name, self.type), i, l, selfAttrs, selfAttr, cloneAttrs;
        if (selfAttrs = self.attributes) {
          cloneAttrs = [];
          cloneAttrs.map = {};
          for (i = 0, l = selfAttrs.length; i < l; i++) {
            selfAttr = selfAttrs[i];
            if (selfAttr.name !== 'id') {
              cloneAttrs[cloneAttrs.length] = {
                name: selfAttr.name,
                value: selfAttr.value
              };
              cloneAttrs.map[selfAttr.name] = selfAttr.value;
            }
          }
          clone.attributes = cloneAttrs;
        }
        clone.value = self.value;
        clone.shortEnded = self.shortEnded;
        return clone;
      },
      wrap: function (wrapper) {
        var self = this;
        self.parent.insert(wrapper, self);
        wrapper.append(self);
        return self;
      },
      unwrap: function () {
        var self = this, node, next;
        for (node = self.firstChild; node;) {
          next = node.next;
          self.insert(node, self, true);
          node = next;
        }
        self.remove();
      },
      remove: function () {
        var self = this, parent = self.parent, next = self.next, prev = self.prev;
        if (parent) {
          if (parent.firstChild === self) {
            parent.firstChild = next;
            if (next) {
              next.prev = null;
            }
          } else {
            prev.next = next;
          }
          if (parent.lastChild === self) {
            parent.lastChild = prev;
            if (prev) {
              prev.next = null;
            }
          } else {
            next.prev = prev;
          }
          self.parent = self.next = self.prev = null;
        }
        return self;
      },
      append: function (node) {
        var self = this, last;
        if (node.parent) {
          node.remove();
        }
        last = self.lastChild;
        if (last) {
          last.next = node;
          node.prev = last;
          self.lastChild = node;
        } else {
          self.lastChild = self.firstChild = node;
        }
        node.parent = self;
        return node;
      },
      insert: function (node, ref_node, before) {
        var parent;
        if (node.parent) {
          node.remove();
        }
        parent = ref_node.parent || this;
        if (before) {
          if (ref_node === parent.firstChild) {
            parent.firstChild = node;
          } else {
            ref_node.prev.next = node;
          }
          node.prev = ref_node.prev;
          node.next = ref_node;
          ref_node.prev = node;
        } else {
          if (ref_node === parent.lastChild) {
            parent.lastChild = node;
          } else {
            ref_node.next.prev = node;
          }
          node.next = ref_node.next;
          node.prev = ref_node;
          ref_node.next = node;
        }
        node.parent = parent;
        return node;
      },
      getAll: function (name) {
        var self = this, node, collection = [];
        for (node = self.firstChild; node; node = walk(node, self)) {
          if (node.name === name) {
            collection.push(node);
          }
        }
        return collection;
      },
      empty: function () {
        var self = this, nodes, i, node;
        if (self.firstChild) {
          nodes = [];
          for (node = self.firstChild; node; node = walk(node, self)) {
            nodes.push(node);
          }
          i = nodes.length;
          while (i--) {
            node = nodes[i];
            node.parent = node.firstChild = node.lastChild = node.next = node.prev = null;
          }
        }
        self.firstChild = self.lastChild = null;
        return self;
      },
      isEmpty: function (elements) {
        var self = this, node = self.firstChild, i, name;
        if (node) {
          do {
            if (node.type === 1) {
              if (node.attributes.map['data-mce-bogus']) {
                continue;
              }
              if (elements[node.name]) {
                return false;
              }
              i = node.attributes.length;
              while (i--) {
                name = node.attributes[i].name;
                if (name === 'name' || name.indexOf('data-mce-') === 0) {
                  return false;
                }
              }
            }
            if (node.type === 8) {
              return false;
            }
            if (node.type === 3 && !whiteSpaceRegExp.test(node.value)) {
              return false;
            }
          } while (node = walk(node, self));
        }
        return true;
      },
      walk: function (prev) {
        return walk(this, null, prev);
      }
    };
    Node.create = function (name, attrs) {
      var node, attrName;
      node = new Node(name, typeLookup[name] || 1);
      if (attrs) {
        for (attrName in attrs) {
          node.attr(attrName, attrs[attrName]);
        }
      }
      return node;
    };
    return Node;
  });
  define('tinymce/html/Schema', ['tinymce/util/Tools'], function (Tools) {
    var mapCache = {};
    var makeMap = Tools.makeMap, each = Tools.each, extend = Tools.extend, explode = Tools.explode, inArray = Tools.inArray;
    function split(items, delim) {
      return items ? items.split(delim || ' ') : [];
    }
    function compileSchema(type) {
      var schema = {}, globalAttributes, blockContent;
      var phrasingContent, flowContent, html4BlockContent, html4PhrasingContent;
      function add(name, attributes, children) {
        var ni, i, attributesOrder, args = arguments;
        function arrayToMap(array) {
          var map = {}, i, l;
          for (i = 0, l = array.length; i < l; i++) {
            map[array[i]] = {};
          }
          return map;
        }
        children = children || [];
        attributes = attributes || '';
        if (typeof children === 'string') {
          children = split(children);
        }
        for (i = 3; i < args.length; i++) {
          if (typeof args[i] === 'string') {
            args[i] = split(args[i]);
          }
          children.push.apply(children, args[i]);
        }
        name = split(name);
        ni = name.length;
        while (ni--) {
          attributesOrder = [].concat(globalAttributes, split(attributes));
          schema[name[ni]] = {
            attributes: arrayToMap(attributesOrder),
            attributesOrder: attributesOrder,
            children: arrayToMap(children)
          };
        }
      }
      function addAttrs(name, attributes) {
        var ni, schemaItem, i, l;
        name = split(name);
        ni = name.length;
        attributes = split(attributes);
        while (ni--) {
          schemaItem = schema[name[ni]];
          for (i = 0, l = attributes.length; i < l; i++) {
            schemaItem.attributes[attributes[i]] = {};
            schemaItem.attributesOrder.push(attributes[i]);
          }
        }
      }
      if (mapCache[type]) {
        return mapCache[type];
      }
      globalAttributes = split('id accesskey class dir lang style tabindex title');
      blockContent = split('address blockquote div dl fieldset form h1 h2 h3 h4 h5 h6 hr menu ol p pre table ul');
      phrasingContent = split('a abbr b bdo br button cite code del dfn em embed i iframe img input ins kbd ' + 'label map noscript object q s samp script select small span strong sub sup ' + 'textarea u var #text #comment');
      if (type != 'html4') {
        globalAttributes.push.apply(globalAttributes, split('contenteditable contextmenu draggable dropzone ' + 'hidden spellcheck translate'));
        blockContent.push.apply(blockContent, split('article aside details dialog figure header footer hgroup section nav'));
        phrasingContent.push.apply(phrasingContent, split('audio canvas command datalist mark meter output progress time wbr ' + 'video ruby bdi keygen'));
      }
      if (type != 'html5-strict') {
        globalAttributes.push('xml:lang');
        html4PhrasingContent = split('acronym applet basefont big font strike tt');
        phrasingContent.push.apply(phrasingContent, html4PhrasingContent);
        each(html4PhrasingContent, function (name) {
          add(name, '', phrasingContent);
        });
        html4BlockContent = split('center dir isindex noframes');
        blockContent.push.apply(blockContent, html4BlockContent);
        flowContent = [].concat(blockContent, phrasingContent);
        each(html4BlockContent, function (name) {
          add(name, '', flowContent);
        });
      }
      flowContent = flowContent || [].concat(blockContent, phrasingContent);
      add('html', 'manifest', 'head body');
      add('head', '', 'base command link meta noscript script style title');
      add('title hr noscript br');
      add('base', 'href target');
      add('link', 'href rel media hreflang type sizes hreflang');
      add('meta', 'name http-equiv content charset');
      add('style', 'media type scoped');
      add('script', 'src async defer type charset');
      add('body', 'onafterprint onbeforeprint onbeforeunload onblur onerror onfocus ' + 'onhashchange onload onmessage onoffline ononline onpagehide onpageshow ' + 'onpopstate onresize onscroll onstorage onunload', flowContent);
      add('address dt dd div caption', '', flowContent);
      add('h1 h2 h3 h4 h5 h6 pre p abbr code var samp kbd sub sup i b u bdo span legend em strong small s cite dfn', '', phrasingContent);
      add('blockquote', 'cite', flowContent);
      add('ol', 'reversed start type', 'li');
      add('ul', '', 'li');
      add('li', 'value', flowContent);
      add('dl', '', 'dt dd');
      add('a', 'href target rel media hreflang type', phrasingContent);
      add('q', 'cite', phrasingContent);
      add('ins del', 'cite datetime', flowContent);
      add('img', 'src alt usemap ismap width height');
      add('iframe', 'src name width height', flowContent);
      add('embed', 'src type width height');
      add('object', 'data type typemustmatch name usemap form width height', flowContent, 'param');
      add('param', 'name value');
      add('map', 'name', flowContent, 'area');
      add('area', 'alt coords shape href target rel media hreflang type');
      add('table', 'border', 'caption colgroup thead tfoot tbody tr' + (type == 'html4' ? ' col' : ''));
      add('colgroup', 'span', 'col');
      add('col', 'span');
      add('tbody thead tfoot', '', 'tr');
      add('tr', '', 'td th');
      add('td', 'colspan rowspan headers', flowContent);
      add('th', 'colspan rowspan headers scope abbr', flowContent);
      add('form', 'accept-charset action autocomplete enctype method name novalidate target', flowContent);
      add('fieldset', 'disabled form name', flowContent, 'legend');
      add('label', 'form for', phrasingContent);
      add('input', 'accept alt autocomplete checked dirname disabled form formaction formenctype formmethod formnovalidate ' + 'formtarget height list max maxlength min multiple name pattern readonly required size src step type value width');
      add('button', 'disabled form formaction formenctype formmethod formnovalidate formtarget name type value', type == 'html4' ? flowContent : phrasingContent);
      add('select', 'disabled form multiple name required size', 'option optgroup');
      add('optgroup', 'disabled label', 'option');
      add('option', 'disabled label selected value');
      add('textarea', 'cols dirname disabled form maxlength name readonly required rows wrap');
      add('menu', 'type label', flowContent, 'li');
      add('noscript', '', flowContent);
      if (type != 'html4') {
        add('wbr');
        add('ruby', '', phrasingContent, 'rt rp');
        add('figcaption', '', flowContent);
        add('mark rt rp summary bdi', '', phrasingContent);
        add('canvas', 'width height', flowContent);
        add('video', 'src crossorigin poster preload autoplay mediagroup loop ' + 'muted controls width height', flowContent, 'track source');
        add('audio', 'src crossorigin preload autoplay mediagroup loop muted controls', flowContent, 'track source');
        add('source', 'src type media');
        add('track', 'kind src srclang label default');
        add('datalist', '', phrasingContent, 'option');
        add('article section nav aside header footer', '', flowContent);
        add('hgroup', '', 'h1 h2 h3 h4 h5 h6');
        add('figure', '', flowContent, 'figcaption');
        add('time', 'datetime', phrasingContent);
        add('dialog', 'open', flowContent);
        add('command', 'type label icon disabled checked radiogroup command');
        add('output', 'for form name', phrasingContent);
        add('progress', 'value max', phrasingContent);
        add('meter', 'value min max low high optimum', phrasingContent);
        add('details', 'open', flowContent, 'summary');
        add('keygen', 'autofocus challenge disabled form keytype name');
      }
      if (type != 'html5-strict') {
        addAttrs('script', 'language xml:space');
        addAttrs('style', 'xml:space');
        addAttrs('object', 'declare classid codebase codetype archive standby align border hspace vspace');
        addAttrs('param', 'valuetype type');
        addAttrs('a', 'charset name rev shape coords');
        addAttrs('br', 'clear');
        addAttrs('applet', 'codebase archive code object alt name width height align hspace vspace');
        addAttrs('img', 'name longdesc align border hspace vspace');
        addAttrs('iframe', 'longdesc frameborder marginwidth marginheight scrolling align');
        addAttrs('font basefont', 'size color face');
        addAttrs('input', 'usemap align');
        addAttrs('select', 'onchange');
        addAttrs('textarea');
        addAttrs('h1 h2 h3 h4 h5 h6 div p legend caption', 'align');
        addAttrs('ul', 'type compact');
        addAttrs('li', 'type');
        addAttrs('ol dl menu dir', 'compact');
        addAttrs('pre', 'width xml:space');
        addAttrs('hr', 'align noshade size width');
        addAttrs('isindex', 'prompt');
        addAttrs('table', 'summary width frame rules cellspacing cellpadding align bgcolor');
        addAttrs('col', 'width align char charoff valign');
        addAttrs('colgroup', 'width align char charoff valign');
        addAttrs('thead', 'align char charoff valign');
        addAttrs('tr', 'align char charoff valign bgcolor');
        addAttrs('th', 'axis align char charoff valign nowrap bgcolor width height');
        addAttrs('form', 'accept');
        addAttrs('td', 'abbr axis scope align char charoff valign nowrap bgcolor width height');
        addAttrs('tfoot', 'align char charoff valign');
        addAttrs('tbody', 'align char charoff valign');
        addAttrs('area', 'nohref');
        addAttrs('body', 'background bgcolor text link vlink alink');
      }
      if (type != 'html4') {
        addAttrs('input button select textarea', 'autofocus');
        addAttrs('input textarea', 'placeholder');
        addAttrs('a', 'download');
        addAttrs('link script img', 'crossorigin');
        addAttrs('iframe', 'srcdoc sandbox seamless allowfullscreen');
      }
      each(split('a form meter progress dfn'), function (name) {
        if (schema[name]) {
          delete schema[name].children[name];
        }
      });
      delete schema.caption.children.table;
      mapCache[type] = schema;
      return schema;
    }
    return function (settings) {
      var self = this, elements = {}, children = {}, patternElements = [], validStyles, schemaItems;
      var whiteSpaceElementsMap, selfClosingElementsMap, shortEndedElementsMap, boolAttrMap;
      var blockElementsMap, nonEmptyElementsMap, textBlockElementsMap, customElementsMap = {}, specialElements = {};
      function createLookupTable(option, default_value, extendWith) {
        var value = settings[option];
        if (!value) {
          value = mapCache[option];
          if (!value) {
            value = makeMap(default_value, ' ', makeMap(default_value.toUpperCase(), ' '));
            value = extend(value, extendWith);
            mapCache[option] = value;
          }
        } else {
          value = makeMap(value, ',', makeMap(value.toUpperCase(), ' '));
        }
        return value;
      }
      settings = settings || {};
      schemaItems = compileSchema(settings.schema);
      if (settings.verify_html === false) {
        settings.valid_elements = '*[*]';
      }
      if (settings.valid_styles) {
        validStyles = {};
        each(settings.valid_styles, function (value, key) {
          validStyles[key] = explode(value);
        });
      }
      whiteSpaceElementsMap = createLookupTable('whitespace_elements', 'pre script noscript style textarea video audio iframe object');
      selfClosingElementsMap = createLookupTable('self_closing_elements', 'colgroup dd dt li option p td tfoot th thead tr');
      shortEndedElementsMap = createLookupTable('short_ended_elements', 'area base basefont br col frame hr img input isindex link ' + 'meta param embed source wbr track');
      boolAttrMap = createLookupTable('boolean_attributes', 'checked compact declare defer disabled ismap multiple nohref noresize ' + 'noshade nowrap readonly selected autoplay loop controls');
      nonEmptyElementsMap = createLookupTable('non_empty_elements', 'td th iframe video audio object script', shortEndedElementsMap);
      textBlockElementsMap = createLookupTable('text_block_elements', 'h1 h2 h3 h4 h5 h6 p div address pre form ' + 'blockquote center dir fieldset header footer article section hgroup aside nav figure');
      blockElementsMap = createLookupTable('block_elements', 'hr table tbody thead tfoot ' + 'th tr td li ol ul caption dl dt dd noscript menu isindex option ' + 'datalist select optgroup', textBlockElementsMap);
      each((settings.special || 'script noscript style textarea').split(' '), function (name) {
        specialElements[name] = new RegExp('</' + name + '[^>]*>', 'gi');
      });
      function patternToRegExp(str) {
        return new RegExp('^' + str.replace(/([?+*])/g, '.$1') + '$');
      }
      function addValidElements(valid_elements) {
        var ei, el, ai, al, matches, element, attr, attrData, elementName, attrName, attrType, attributes, attributesOrder, prefix, outputName, globalAttributes, globalAttributesOrder, key, value, elementRuleRegExp = /^([#+\-])?([^\[!\/]+)(?:\/([^\[!]+))?(?:(!?)\[([^\]]+)\])?$/, attrRuleRegExp = /^([!\-])?(\w+::\w+|[^=:<]+)?(?:([=:<])(.*))?$/, hasPatternsRegExp = /[*?+]/;
        if (valid_elements) {
          valid_elements = split(valid_elements, ',');
          if (elements['@']) {
            globalAttributes = elements['@'].attributes;
            globalAttributesOrder = elements['@'].attributesOrder;
          }
          for (ei = 0, el = valid_elements.length; ei < el; ei++) {
            matches = elementRuleRegExp.exec(valid_elements[ei]);
            if (matches) {
              prefix = matches[1];
              elementName = matches[2];
              outputName = matches[3];
              attrData = matches[5];
              attributes = {};
              attributesOrder = [];
              element = {
                attributes: attributes,
                attributesOrder: attributesOrder
              };
              if (prefix === '#') {
                element.paddEmpty = true;
              }
              if (prefix === '-') {
                element.removeEmpty = true;
              }
              if (matches[4] === '!') {
                element.removeEmptyAttrs = true;
              }
              if (globalAttributes) {
                for (key in globalAttributes) {
                  attributes[key] = globalAttributes[key];
                }
                attributesOrder.push.apply(attributesOrder, globalAttributesOrder);
              }
              if (attrData) {
                attrData = split(attrData, '|');
                for (ai = 0, al = attrData.length; ai < al; ai++) {
                  matches = attrRuleRegExp.exec(attrData[ai]);
                  if (matches) {
                    attr = {};
                    attrType = matches[1];
                    attrName = matches[2].replace(/::/g, ':');
                    prefix = matches[3];
                    value = matches[4];
                    if (attrType === '!') {
                      element.attributesRequired = element.attributesRequired || [];
                      element.attributesRequired.push(attrName);
                      attr.required = true;
                    }
                    if (attrType === '-') {
                      delete attributes[attrName];
                      attributesOrder.splice(inArray(attributesOrder, attrName), 1);
                      continue;
                    }
                    if (prefix) {
                      if (prefix === '=') {
                        element.attributesDefault = element.attributesDefault || [];
                        element.attributesDefault.push({
                          name: attrName,
                          value: value
                        });
                        attr.defaultValue = value;
                      }
                      if (prefix === ':') {
                        element.attributesForced = element.attributesForced || [];
                        element.attributesForced.push({
                          name: attrName,
                          value: value
                        });
                        attr.forcedValue = value;
                      }
                      if (prefix === '<') {
                        attr.validValues = makeMap(value, '?');
                      }
                    }
                    if (hasPatternsRegExp.test(attrName)) {
                      element.attributePatterns = element.attributePatterns || [];
                      attr.pattern = patternToRegExp(attrName);
                      element.attributePatterns.push(attr);
                    } else {
                      if (!attributes[attrName]) {
                        attributesOrder.push(attrName);
                      }
                      attributes[attrName] = attr;
                    }
                  }
                }
              }
              if (!globalAttributes && elementName == '@') {
                globalAttributes = attributes;
                globalAttributesOrder = attributesOrder;
              }
              if (outputName) {
                element.outputName = elementName;
                elements[outputName] = element;
              }
              if (hasPatternsRegExp.test(elementName)) {
                element.pattern = patternToRegExp(elementName);
                patternElements.push(element);
              } else {
                elements[elementName] = element;
              }
            }
          }
        }
      }
      function setValidElements(valid_elements) {
        elements = {};
        patternElements = [];
        addValidElements(valid_elements);
        each(schemaItems, function (element, name) {
          children[name] = element.children;
        });
      }
      function addCustomElements(custom_elements) {
        var customElementRegExp = /^(~)?(.+)$/;
        if (custom_elements) {
          each(split(custom_elements, ','), function (rule) {
            var matches = customElementRegExp.exec(rule), inline = matches[1] === '~', cloneName = inline ? 'span' : 'div', name = matches[2];
            children[name] = children[cloneName];
            customElementsMap[name] = cloneName;
            if (!inline) {
              blockElementsMap[name.toUpperCase()] = {};
              blockElementsMap[name] = {};
            }
            if (!elements[name]) {
              var customRule = elements[cloneName];
              customRule = extend({}, customRule);
              delete customRule.removeEmptyAttrs;
              delete customRule.removeEmpty;
              elements[name] = customRule;
            }
            each(children, function (element) {
              if (element[cloneName]) {
                element[name] = element[cloneName];
              }
            });
          });
        }
      }
      function addValidChildren(valid_children) {
        var childRuleRegExp = /^([+\-]?)(\w+)\[([^\]]+)\]$/;
        if (valid_children) {
          each(split(valid_children, ','), function (rule) {
            var matches = childRuleRegExp.exec(rule), parent, prefix;
            if (matches) {
              prefix = matches[1];
              if (prefix) {
                parent = children[matches[2]];
              } else {
                parent = children[matches[2]] = { '#comment': {} };
              }
              parent = children[matches[2]];
              each(split(matches[3], '|'), function (child) {
                if (prefix === '-') {
                  delete parent[child];
                } else {
                  parent[child] = {};
                }
              });
            }
          });
        }
      }
      function getElementRule(name) {
        var element = elements[name], i;
        if (element) {
          return element;
        }
        i = patternElements.length;
        while (i--) {
          element = patternElements[i];
          if (element.pattern.test(name)) {
            return element;
          }
        }
      }
      if (!settings.valid_elements) {
        each(schemaItems, function (element, name) {
          elements[name] = {
            attributes: element.attributes,
            attributesOrder: element.attributesOrder
          };
          children[name] = element.children;
        });
        if (settings.schema != 'html5') {
          each(split('strong/b em/i'), function (item) {
            item = split(item, '/');
            elements[item[1]].outputName = item[0];
          });
        }
        elements.img.attributesDefault = [{
            name: 'alt',
            value: ''
          }];
        each(split('ol ul sub sup blockquote span font a table tbody tr strong em b i'), function (name) {
          if (elements[name]) {
            elements[name].removeEmpty = true;
          }
        });
        each(split('p h1 h2 h3 h4 h5 h6 th td pre div address caption'), function (name) {
          elements[name].paddEmpty = true;
        });
        each(split('span'), function (name) {
          elements[name].removeEmptyAttrs = true;
        });
      } else {
        setValidElements(settings.valid_elements);
      }
      addCustomElements(settings.custom_elements);
      addValidChildren(settings.valid_children);
      addValidElements(settings.extended_valid_elements);
      addValidChildren('+ol[ul|ol],+ul[ul|ol]');
      if (settings.invalid_elements) {
        each(explode(settings.invalid_elements), function (item) {
          if (elements[item]) {
            delete elements[item];
          }
        });
      }
      if (!getElementRule('span')) {
        addValidElements('span[!data-mce-type|*]');
      }
      self.children = children;
      self.styles = validStyles;
      self.getBoolAttrs = function () {
        return boolAttrMap;
      };
      self.getBlockElements = function () {
        return blockElementsMap;
      };
      self.getTextBlockElements = function () {
        return textBlockElementsMap;
      };
      self.getShortEndedElements = function () {
        return shortEndedElementsMap;
      };
      self.getSelfClosingElements = function () {
        return selfClosingElementsMap;
      };
      self.getNonEmptyElements = function () {
        return nonEmptyElementsMap;
      };
      self.getWhiteSpaceElements = function () {
        return whiteSpaceElementsMap;
      };
      self.getSpecialElements = function () {
        return specialElements;
      };
      self.isValidChild = function (name, child) {
        var parent = children[name];
        return !!(parent && parent[child]);
      };
      self.isValid = function (name, attr) {
        var attrPatterns, i, rule = getElementRule(name);
        if (rule) {
          if (attr) {
            if (rule.attributes[attr]) {
              return true;
            }
            attrPatterns = rule.attributePatterns;
            if (attrPatterns) {
              i = attrPatterns.length;
              while (i--) {
                if (attrPatterns[i].pattern.test(name)) {
                  return true;
                }
              }
            }
          } else {
            return true;
          }
        }
        return false;
      };
      self.getElementRule = getElementRule;
      self.getCustomElements = function () {
        return customElementsMap;
      };
      self.addValidElements = addValidElements;
      self.setValidElements = setValidElements;
      self.addCustomElements = addCustomElements;
      self.addValidChildren = addValidChildren;
      self.elements = elements;
    };
  });
  define('tinymce/html/SaxParser', [
    'tinymce/html/Schema',
    'tinymce/html/Entities',
    'tinymce/util/Tools'
  ], function (Schema, Entities, Tools) {
    var each = Tools.each;
    return function (settings, schema) {
      var self = this;
      function noop() {
      }
      settings = settings || {};
      self.schema = schema = schema || new Schema();
      if (settings.fix_self_closing !== false) {
        settings.fix_self_closing = true;
      }
      each('comment cdata text start end pi doctype'.split(' '), function (name) {
        if (name) {
          self[name] = settings[name] || noop;
        }
      });
      self.parse = function (html) {
        var self = this, matches, index = 0, value, endRegExp, stack = [], attrList, i, text, name;
        var isInternalElement, removeInternalElements, shortEndedElements, fillAttrsMap, isShortEnded;
        var validate, elementRule, isValidElement, attr, attribsValue, validAttributesMap, validAttributePatterns;
        var attributesRequired, attributesDefault, attributesForced;
        var anyAttributesRequired, selfClosing, tokenRegExp, attrRegExp, specialElements, attrValue, idCount = 0;
        var decode = Entities.decode, fixSelfClosing, filteredUrlAttrs = Tools.makeMap('src,href');
        var scriptUriRegExp = /(java|vb)script:/i;
        function processEndTag(name) {
          var pos, i;
          pos = stack.length;
          while (pos--) {
            if (stack[pos].name === name) {
              break;
            }
          }
          if (pos >= 0) {
            for (i = stack.length - 1; i >= pos; i--) {
              name = stack[i];
              if (name.valid) {
                self.end(name.name);
              }
            }
            stack.length = pos;
          }
        }
        function parseAttribute(match, name, value, val2, val3) {
          var attrRule, i, trimRegExp = /[\s\u0000-\u001F]+/g;
          name = name.toLowerCase();
          value = name in fillAttrsMap ? name : decode(value || val2 || val3 || '');
          if (validate && !isInternalElement && name.indexOf('data-') !== 0) {
            attrRule = validAttributesMap[name];
            if (!attrRule && validAttributePatterns) {
              i = validAttributePatterns.length;
              while (i--) {
                attrRule = validAttributePatterns[i];
                if (attrRule.pattern.test(name)) {
                  break;
                }
              }
              if (i === -1) {
                attrRule = null;
              }
            }
            if (!attrRule) {
              return;
            }
            if (attrRule.validValues && !(value in attrRule.validValues)) {
              return;
            }
          }
          if (filteredUrlAttrs[name] && !settings.allow_script_urls) {
            var uri = value.replace(trimRegExp, '');
            try {
              uri = decodeURIComponent(uri);
              if (scriptUriRegExp.test(uri)) {
                return;
              }
            } catch (ex) {
              uri = unescape(uri);
              if (scriptUriRegExp.test(uri)) {
                return;
              }
            }
          }
          attrList.map[name] = value;
          attrList.push({
            name: name,
            value: value
          });
        }
        tokenRegExp = new RegExp('<(?:' + '(?:!--([\\w\\W]*?)-->)|' + '(?:!\\[CDATA\\[([\\w\\W]*?)\\]\\]>)|' + '(?:!DOCTYPE([\\w\\W]*?)>)|' + '(?:\\?([^\\s\\/<>]+) ?([\\w\\W]*?)[?/]>)|' + '(?:\\/([^>]+)>)|' + '(?:([A-Za-z0-9\\-\\:\\.]+)((?:\\s+[^"\'>]+(?:(?:"[^"]*")|(?:\'[^\']*\')|[^>]*))*|\\/|\\s+)>)' + ')', 'g');
        attrRegExp = /([\w:\-]+)(?:\s*=\s*(?:(?:\"((?:[^\"])*)\")|(?:\'((?:[^\'])*)\')|([^>\s]+)))?/g;
        shortEndedElements = schema.getShortEndedElements();
        selfClosing = settings.self_closing_elements || schema.getSelfClosingElements();
        fillAttrsMap = schema.getBoolAttrs();
        validate = settings.validate;
        removeInternalElements = settings.remove_internals;
        fixSelfClosing = settings.fix_self_closing;
        specialElements = schema.getSpecialElements();
        while (matches = tokenRegExp.exec(html)) {
          if (index < matches.index) {
            self.text(decode(html.substr(index, matches.index - index)));
          }
          if (value = matches[6]) {
            value = value.toLowerCase();
            if (value.charAt(0) === ':') {
              value = value.substr(1);
            }
            processEndTag(value);
          } else if (value = matches[7]) {
            value = value.toLowerCase();
            if (value.charAt(0) === ':') {
              value = value.substr(1);
            }
            isShortEnded = value in shortEndedElements;
            if (fixSelfClosing && selfClosing[value] && stack.length > 0 && stack[stack.length - 1].name === value) {
              processEndTag(value);
            }
            if (!validate || (elementRule = schema.getElementRule(value))) {
              isValidElement = true;
              if (validate) {
                validAttributesMap = elementRule.attributes;
                validAttributePatterns = elementRule.attributePatterns;
              }
              if (attribsValue = matches[8]) {
                isInternalElement = attribsValue.indexOf('data-mce-type') !== -1;
                if (isInternalElement && removeInternalElements) {
                  isValidElement = false;
                }
                attrList = [];
                attrList.map = {};
                attribsValue.replace(attrRegExp, parseAttribute);
              } else {
                attrList = [];
                attrList.map = {};
              }
              if (validate && !isInternalElement) {
                attributesRequired = elementRule.attributesRequired;
                attributesDefault = elementRule.attributesDefault;
                attributesForced = elementRule.attributesForced;
                anyAttributesRequired = elementRule.removeEmptyAttrs;
                if (anyAttributesRequired && !attrList.length) {
                  isValidElement = false;
                }
                if (attributesForced) {
                  i = attributesForced.length;
                  while (i--) {
                    attr = attributesForced[i];
                    name = attr.name;
                    attrValue = attr.value;
                    if (attrValue === '{$uid}') {
                      attrValue = 'mce_' + idCount++;
                    }
                    attrList.map[name] = attrValue;
                    attrList.push({
                      name: name,
                      value: attrValue
                    });
                  }
                }
                if (attributesDefault) {
                  i = attributesDefault.length;
                  while (i--) {
                    attr = attributesDefault[i];
                    name = attr.name;
                    if (!(name in attrList.map)) {
                      attrValue = attr.value;
                      if (attrValue === '{$uid}') {
                        attrValue = 'mce_' + idCount++;
                      }
                      attrList.map[name] = attrValue;
                      attrList.push({
                        name: name,
                        value: attrValue
                      });
                    }
                  }
                }
                if (attributesRequired) {
                  i = attributesRequired.length;
                  while (i--) {
                    if (attributesRequired[i] in attrList.map) {
                      break;
                    }
                  }
                  if (i === -1) {
                    isValidElement = false;
                  }
                }
                if (attrList.map['data-mce-bogus']) {
                  isValidElement = false;
                }
              }
              if (isValidElement) {
                self.start(value, attrList, isShortEnded);
              }
            } else {
              isValidElement = false;
            }
            if (endRegExp = specialElements[value]) {
              endRegExp.lastIndex = index = matches.index + matches[0].length;
              if (matches = endRegExp.exec(html)) {
                if (isValidElement) {
                  text = html.substr(index, matches.index - index);
                }
                index = matches.index + matches[0].length;
              } else {
                text = html.substr(index);
                index = html.length;
              }
              if (isValidElement) {
                if (text.length > 0) {
                  self.text(text, true);
                }
                self.end(value);
              }
              tokenRegExp.lastIndex = index;
              continue;
            }
            if (!isShortEnded) {
              if (!attribsValue || attribsValue.indexOf('/') != attribsValue.length - 1) {
                stack.push({
                  name: value,
                  valid: isValidElement
                });
              } else if (isValidElement) {
                self.end(value);
              }
            }
          } else if (value = matches[1]) {
            if (value.charAt(0) === '>') {
              value = ' ' + value;
            }
            if (!settings.allow_conditional_comments && value.substr(0, 3) === '[if') {
              value = ' ' + value;
            }
            self.comment(value);
          } else if (value = matches[2]) {
            self.cdata(value);
          } else if (value = matches[3]) {
            self.doctype(value);
          } else if (value = matches[4]) {
            self.pi(value, matches[5]);
          }
          index = matches.index + matches[0].length;
        }
        if (index < html.length) {
          self.text(decode(html.substr(index)));
        }
        for (i = stack.length - 1; i >= 0; i--) {
          value = stack[i];
          if (value.valid) {
            self.end(value.name);
          }
        }
      };
    };
  });
  define('tinymce/html/DomParser', [
    'tinymce/html/Node',
    'tinymce/html/Schema',
    'tinymce/html/SaxParser',
    'tinymce/util/Tools'
  ], function (Node, Schema, SaxParser, Tools) {
    var makeMap = Tools.makeMap, each = Tools.each, explode = Tools.explode, extend = Tools.extend;
    return function (settings, schema) {
      var self = this, nodeFilters = {}, attributeFilters = [], matchedNodes = {}, matchedAttributes = {};
      settings = settings || {};
      settings.validate = 'validate' in settings ? settings.validate : true;
      settings.root_name = settings.root_name || 'body';
      self.schema = schema = schema || new Schema();
      function fixInvalidChildren(nodes) {
        var ni, node, parent, parents, newParent, currentNode, tempNode, childNode, i;
        var nonEmptyElements, nonSplitableElements, textBlockElements, sibling, nextNode;
        nonSplitableElements = makeMap('tr,td,th,tbody,thead,tfoot,table');
        nonEmptyElements = schema.getNonEmptyElements();
        textBlockElements = schema.getTextBlockElements();
        for (ni = 0; ni < nodes.length; ni++) {
          node = nodes[ni];
          if (!node.parent || node.fixed) {
            continue;
          }
          if (textBlockElements[node.name] && node.parent.name == 'li') {
            sibling = node.next;
            while (sibling) {
              if (textBlockElements[sibling.name]) {
                sibling.name = 'li';
                sibling.fixed = true;
                node.parent.insert(sibling, node.parent);
              } else {
                break;
              }
              sibling = sibling.next;
            }
            node.unwrap(node);
            continue;
          }
          parents = [node];
          for (parent = node.parent; parent && !schema.isValidChild(parent.name, node.name) && !nonSplitableElements[parent.name]; parent = parent.parent) {
            parents.push(parent);
          }
          if (parent && parents.length > 1) {
            parents.reverse();
            newParent = currentNode = self.filterNode(parents[0].clone());
            for (i = 0; i < parents.length - 1; i++) {
              if (schema.isValidChild(currentNode.name, parents[i].name)) {
                tempNode = self.filterNode(parents[i].clone());
                currentNode.append(tempNode);
              } else {
                tempNode = currentNode;
              }
              for (childNode = parents[i].firstChild; childNode && childNode != parents[i + 1];) {
                nextNode = childNode.next;
                tempNode.append(childNode);
                childNode = nextNode;
              }
              currentNode = tempNode;
            }
            if (!newParent.isEmpty(nonEmptyElements)) {
              parent.insert(newParent, parents[0], true);
              parent.insert(node, newParent);
            } else {
              parent.insert(node, parents[0], true);
            }
            parent = parents[0];
            if (parent.isEmpty(nonEmptyElements) || parent.firstChild === parent.lastChild && parent.firstChild.name === 'br') {
              parent.empty().remove();
            }
          } else if (node.parent) {
            if (node.name === 'li') {
              sibling = node.prev;
              if (sibling && (sibling.name === 'ul' || sibling.name === 'ul')) {
                sibling.append(node);
                continue;
              }
              sibling = node.next;
              if (sibling && (sibling.name === 'ul' || sibling.name === 'ul')) {
                sibling.insert(node, sibling.firstChild, true);
                continue;
              }
              node.wrap(self.filterNode(new Node('ul', 1)));
              continue;
            }
            if (schema.isValidChild(node.parent.name, 'div') && schema.isValidChild('div', node.name)) {
              node.wrap(self.filterNode(new Node('div', 1)));
            } else {
              if (node.name === 'style' || node.name === 'script') {
                node.empty().remove();
              } else {
                node.unwrap();
              }
            }
          }
        }
      }
      self.filterNode = function (node) {
        var i, name, list;
        if (name in nodeFilters) {
          list = matchedNodes[name];
          if (list) {
            list.push(node);
          } else {
            matchedNodes[name] = [node];
          }
        }
        i = attributeFilters.length;
        while (i--) {
          name = attributeFilters[i].name;
          if (name in node.attributes.map) {
            list = matchedAttributes[name];
            if (list) {
              list.push(node);
            } else {
              matchedAttributes[name] = [node];
            }
          }
        }
        return node;
      };
      self.addNodeFilter = function (name, callback) {
        each(explode(name), function (name) {
          var list = nodeFilters[name];
          if (!list) {
            nodeFilters[name] = list = [];
          }
          list.push(callback);
        });
      };
      self.addAttributeFilter = function (name, callback) {
        each(explode(name), function (name) {
          var i;
          for (i = 0; i < attributeFilters.length; i++) {
            if (attributeFilters[i].name === name) {
              attributeFilters[i].callbacks.push(callback);
              return;
            }
          }
          attributeFilters.push({
            name: name,
            callbacks: [callback]
          });
        });
      };
      self.parse = function (html, args) {
        var parser, rootNode, node, nodes, i, l, fi, fl, list, name, validate;
        var blockElements, startWhiteSpaceRegExp, invalidChildren = [], isInWhiteSpacePreservedElement;
        var endWhiteSpaceRegExp, allWhiteSpaceRegExp, isAllWhiteSpaceRegExp, whiteSpaceElements;
        var children, nonEmptyElements, rootBlockName;
        args = args || {};
        matchedNodes = {};
        matchedAttributes = {};
        blockElements = extend(makeMap('script,style,head,html,body,title,meta,param'), schema.getBlockElements());
        nonEmptyElements = schema.getNonEmptyElements();
        children = schema.children;
        validate = settings.validate;
        rootBlockName = 'forced_root_block' in args ? args.forced_root_block : settings.forced_root_block;
        whiteSpaceElements = schema.getWhiteSpaceElements();
        startWhiteSpaceRegExp = /^[ \t\r\n]+/;
        endWhiteSpaceRegExp = /[ \t\r\n]+$/;
        allWhiteSpaceRegExp = /[ \t\r\n]+/g;
        isAllWhiteSpaceRegExp = /^[ \t\r\n]+$/;
        function addRootBlocks() {
          var node = rootNode.firstChild, next, rootBlockNode;
          function trim(rootBlockNode) {
            if (rootBlockNode) {
              node = rootBlockNode.firstChild;
              if (node && node.type == 3) {
                node.value = node.value.replace(startWhiteSpaceRegExp, '');
              }
              node = rootBlockNode.lastChild;
              if (node && node.type == 3) {
                node.value = node.value.replace(endWhiteSpaceRegExp, '');
              }
            }
          }
          if (!schema.isValidChild(rootNode.name, rootBlockName.toLowerCase())) {
            return;
          }
          while (node) {
            next = node.next;
            if (node.type == 3 || node.type == 1 && node.name !== 'p' && !blockElements[node.name] && !node.attr('data-mce-type')) {
              if (!rootBlockNode) {
                rootBlockNode = createNode(rootBlockName, 1);
                rootBlockNode.attr(settings.forced_root_block_attrs);
                rootNode.insert(rootBlockNode, node);
                rootBlockNode.append(node);
              } else {
                rootBlockNode.append(node);
              }
            } else {
              trim(rootBlockNode);
              rootBlockNode = null;
            }
            node = next;
          }
          trim(rootBlockNode);
        }
        function createNode(name, type) {
          var node = new Node(name, type), list;
          if (name in nodeFilters) {
            list = matchedNodes[name];
            if (list) {
              list.push(node);
            } else {
              matchedNodes[name] = [node];
            }
          }
          return node;
        }
        function removeWhitespaceBefore(node) {
          var textNode, textVal, sibling;
          for (textNode = node.prev; textNode && textNode.type === 3;) {
            textVal = textNode.value.replace(endWhiteSpaceRegExp, '');
            if (textVal.length > 0) {
              textNode.value = textVal;
              textNode = textNode.prev;
            } else {
              sibling = textNode.prev;
              textNode.remove();
              textNode = sibling;
            }
          }
        }
        function cloneAndExcludeBlocks(input) {
          var name, output = {};
          for (name in input) {
            if (name !== 'li' && name != 'p') {
              output[name] = input[name];
            }
          }
          return output;
        }
        parser = new SaxParser({
          validate: validate,
          allow_script_urls: settings.allow_script_urls,
          allow_conditional_comments: settings.allow_conditional_comments,
          self_closing_elements: cloneAndExcludeBlocks(schema.getSelfClosingElements()),
          cdata: function (text) {
            node.append(createNode('#cdata', 4)).value = text;
          },
          text: function (text, raw) {
            var textNode;
            if (!isInWhiteSpacePreservedElement) {
              text = text.replace(allWhiteSpaceRegExp, ' ');
              if (node.lastChild && blockElements[node.lastChild.name]) {
                text = text.replace(startWhiteSpaceRegExp, '');
              }
            }
            if (text.length !== 0) {
              textNode = createNode('#text', 3);
              textNode.raw = !!raw;
              node.append(textNode).value = text;
            }
          },
          comment: function (text) {
            node.append(createNode('#comment', 8)).value = text;
          },
          pi: function (name, text) {
            node.append(createNode(name, 7)).value = text;
            removeWhitespaceBefore(node);
          },
          doctype: function (text) {
            var newNode;
            newNode = node.append(createNode('#doctype', 10));
            newNode.value = text;
            removeWhitespaceBefore(node);
          },
          start: function (name, attrs, empty) {
            var newNode, attrFiltersLen, elementRule, attrName, parent;
            elementRule = validate ? schema.getElementRule(name) : {};
            if (elementRule) {
              newNode = createNode(elementRule.outputName || name, 1);
              newNode.attributes = attrs;
              newNode.shortEnded = empty;
              node.append(newNode);
              parent = children[node.name];
              if (parent && children[newNode.name] && !parent[newNode.name]) {
                invalidChildren.push(newNode);
              }
              attrFiltersLen = attributeFilters.length;
              while (attrFiltersLen--) {
                attrName = attributeFilters[attrFiltersLen].name;
                if (attrName in attrs.map) {
                  list = matchedAttributes[attrName];
                  if (list) {
                    list.push(newNode);
                  } else {
                    matchedAttributes[attrName] = [newNode];
                  }
                }
              }
              if (blockElements[name]) {
                removeWhitespaceBefore(newNode);
              }
              if (!empty) {
                node = newNode;
              }
              if (!isInWhiteSpacePreservedElement && whiteSpaceElements[name]) {
                isInWhiteSpacePreservedElement = true;
              }
            }
          },
          end: function (name) {
            var textNode, elementRule, text, sibling, tempNode;
            elementRule = validate ? schema.getElementRule(name) : {};
            if (elementRule) {
              if (blockElements[name]) {
                if (!isInWhiteSpacePreservedElement) {
                  textNode = node.firstChild;
                  if (textNode && textNode.type === 3) {
                    text = textNode.value.replace(startWhiteSpaceRegExp, '');
                    if (text.length > 0) {
                      textNode.value = text;
                      textNode = textNode.next;
                    } else {
                      sibling = textNode.next;
                      textNode.remove();
                      textNode = sibling;
                      while (textNode && textNode.type === 3) {
                        text = textNode.value;
                        sibling = textNode.next;
                        if (text.length === 0 || isAllWhiteSpaceRegExp.test(text)) {
                          textNode.remove();
                          textNode = sibling;
                        }
                        textNode = sibling;
                      }
                    }
                  }
                  textNode = node.lastChild;
                  if (textNode && textNode.type === 3) {
                    text = textNode.value.replace(endWhiteSpaceRegExp, '');
                    if (text.length > 0) {
                      textNode.value = text;
                      textNode = textNode.prev;
                    } else {
                      sibling = textNode.prev;
                      textNode.remove();
                      textNode = sibling;
                      while (textNode && textNode.type === 3) {
                        text = textNode.value;
                        sibling = textNode.prev;
                        if (text.length === 0 || isAllWhiteSpaceRegExp.test(text)) {
                          textNode.remove();
                          textNode = sibling;
                        }
                        textNode = sibling;
                      }
                    }
                  }
                }
              }
              if (isInWhiteSpacePreservedElement && whiteSpaceElements[name]) {
                isInWhiteSpacePreservedElement = false;
              }
              if (elementRule.removeEmpty || elementRule.paddEmpty) {
                if (node.isEmpty(nonEmptyElements)) {
                  if (elementRule.paddEmpty) {
                    node.empty().append(new Node('#text', '3')).value = '\xa0';
                  } else {
                    if (!node.attributes.map.name && !node.attributes.map.id) {
                      tempNode = node.parent;
                      node.empty().remove();
                      node = tempNode;
                      return;
                    }
                  }
                }
              }
              node = node.parent;
            }
          }
        }, schema);
        rootNode = node = new Node(args.context || settings.root_name, 11);
        parser.parse(html);
        if (validate && invalidChildren.length) {
          if (!args.context) {
            fixInvalidChildren(invalidChildren);
          } else {
            args.invalid = true;
          }
        }
        if (rootBlockName && (rootNode.name == 'body' || args.isRootContent)) {
          addRootBlocks();
        }
        if (!args.invalid) {
          for (name in matchedNodes) {
            list = nodeFilters[name];
            nodes = matchedNodes[name];
            fi = nodes.length;
            while (fi--) {
              if (!nodes[fi].parent) {
                nodes.splice(fi, 1);
              }
            }
            for (i = 0, l = list.length; i < l; i++) {
              list[i](nodes, name, args);
            }
          }
          for (i = 0, l = attributeFilters.length; i < l; i++) {
            list = attributeFilters[i];
            if (list.name in matchedAttributes) {
              nodes = matchedAttributes[list.name];
              fi = nodes.length;
              while (fi--) {
                if (!nodes[fi].parent) {
                  nodes.splice(fi, 1);
                }
              }
              for (fi = 0, fl = list.callbacks.length; fi < fl; fi++) {
                list.callbacks[fi](nodes, list.name, args);
              }
            }
          }
        }
        return rootNode;
      };
      if (settings.remove_trailing_brs) {
        self.addNodeFilter('br', function (nodes) {
          var i, l = nodes.length, node, blockElements = extend({}, schema.getBlockElements());
          var nonEmptyElements = schema.getNonEmptyElements(), parent, lastParent, prev, prevName;
          var elementRule, textNode;
          blockElements.body = 1;
          for (i = 0; i < l; i++) {
            node = nodes[i];
            parent = node.parent;
            if (blockElements[node.parent.name] && node === parent.lastChild) {
              prev = node.prev;
              while (prev) {
                prevName = prev.name;
                if (prevName !== 'span' || prev.attr('data-mce-type') !== 'bookmark') {
                  if (prevName !== 'br') {
                    break;
                  }
                  if (prevName === 'br') {
                    node = null;
                    break;
                  }
                }
                prev = prev.prev;
              }
              if (node) {
                node.remove();
                if (parent.isEmpty(nonEmptyElements)) {
                  elementRule = schema.getElementRule(parent.name);
                  if (elementRule) {
                    if (elementRule.removeEmpty) {
                      parent.remove();
                    } else if (elementRule.paddEmpty) {
                      parent.empty().append(new Node('#text', 3)).value = '\xa0';
                    }
                  }
                }
              }
            } else {
              lastParent = node;
              while (parent && parent.firstChild === lastParent && parent.lastChild === lastParent) {
                lastParent = parent;
                if (blockElements[parent.name]) {
                  break;
                }
                parent = parent.parent;
              }
              if (lastParent === parent) {
                textNode = new Node('#text', 3);
                textNode.value = '\xa0';
                node.replace(textNode);
              }
            }
          }
        });
      }
      if (!settings.allow_html_in_named_anchor) {
        self.addAttributeFilter('id,name', function (nodes) {
          var i = nodes.length, sibling, prevSibling, parent, node;
          while (i--) {
            node = nodes[i];
            if (node.name === 'a' && node.firstChild && !node.attr('href')) {
              parent = node.parent;
              sibling = node.lastChild;
              do {
                prevSibling = sibling.prev;
                parent.insert(sibling, node);
                sibling = prevSibling;
              } while (sibling);
            }
          }
        });
      }
    };
  });
  define('tinymce/html/Writer', [
    'tinymce/html/Entities',
    'tinymce/util/Tools'
  ], function (Entities, Tools) {
    var makeMap = Tools.makeMap;
    return function (settings) {
      var html = [], indent, indentBefore, indentAfter, encode, htmlOutput;
      settings = settings || {};
      indent = settings.indent;
      indentBefore = makeMap(settings.indent_before || '');
      indentAfter = makeMap(settings.indent_after || '');
      encode = Entities.getEncodeFunc(settings.entity_encoding || 'raw', settings.entities);
      htmlOutput = settings.element_format == 'html';
      return {
        start: function (name, attrs, empty) {
          var i, l, attr, value;
          if (indent && indentBefore[name] && html.length > 0) {
            value = html[html.length - 1];
            if (value.length > 0 && value !== '\n') {
              html.push('\n');
            }
          }
          html.push('<', name);
          if (attrs) {
            for (i = 0, l = attrs.length; i < l; i++) {
              attr = attrs[i];
              html.push(' ', attr.name, '="', encode(attr.value, true), '"');
            }
          }
          if (!empty || htmlOutput) {
            html[html.length] = '>';
          } else {
            html[html.length] = ' />';
          }
          if (empty && indent && indentAfter[name] && html.length > 0) {
            value = html[html.length - 1];
            if (value.length > 0 && value !== '\n') {
              html.push('\n');
            }
          }
        },
        end: function (name) {
          var value;
          html.push('</', name, '>');
          if (indent && indentAfter[name] && html.length > 0) {
            value = html[html.length - 1];
            if (value.length > 0 && value !== '\n') {
              html.push('\n');
            }
          }
        },
        text: function (text, raw) {
          if (text.length > 0) {
            html[html.length] = raw ? text : encode(text);
          }
        },
        cdata: function (text) {
          html.push('<![CDATA[', text, ']]>');
        },
        comment: function (text) {
          html.push('<!--', text, '-->');
        },
        pi: function (name, text) {
          if (text) {
            html.push('<?', name, ' ', text, '?>');
          } else {
            html.push('<?', name, '?>');
          }
          if (indent) {
            html.push('\n');
          }
        },
        doctype: function (text) {
          html.push('<!DOCTYPE', text, '>', indent ? '\n' : '');
        },
        reset: function () {
          html.length = 0;
        },
        getContent: function () {
          return html.join('').replace(/\n$/, '');
        }
      };
    };
  });
  define('tinymce/html/Serializer', [
    'tinymce/html/Writer',
    'tinymce/html/Schema'
  ], function (Writer, Schema) {
    return function (settings, schema) {
      var self = this, writer = new Writer(settings);
      settings = settings || {};
      settings.validate = 'validate' in settings ? settings.validate : true;
      self.schema = schema = schema || new Schema();
      self.writer = writer;
      self.serialize = function (node) {
        var handlers, validate;
        validate = settings.validate;
        handlers = {
          3: function (node) {
            writer.text(node.value, node.raw);
          },
          8: function (node) {
            writer.comment(node.value);
          },
          7: function (node) {
            writer.pi(node.name, node.value);
          },
          10: function (node) {
            writer.doctype(node.value);
          },
          4: function (node) {
            writer.cdata(node.value);
          },
          11: function (node) {
            if (node = node.firstChild) {
              do {
                walk(node);
              } while (node = node.next);
            }
          }
        };
        writer.reset();
        function walk(node) {
          var handler = handlers[node.type], name, isEmpty, attrs, attrName, attrValue, sortedAttrs, i, l, elementRule;
          if (!handler) {
            name = node.name;
            isEmpty = node.shortEnded;
            attrs = node.attributes;
            if (validate && attrs && attrs.length > 1) {
              sortedAttrs = [];
              sortedAttrs.map = {};
              elementRule = schema.getElementRule(node.name);
              for (i = 0, l = elementRule.attributesOrder.length; i < l; i++) {
                attrName = elementRule.attributesOrder[i];
                if (attrName in attrs.map) {
                  attrValue = attrs.map[attrName];
                  sortedAttrs.map[attrName] = attrValue;
                  sortedAttrs.push({
                    name: attrName,
                    value: attrValue
                  });
                }
              }
              for (i = 0, l = attrs.length; i < l; i++) {
                attrName = attrs[i].name;
                if (!(attrName in sortedAttrs.map)) {
                  attrValue = attrs.map[attrName];
                  sortedAttrs.map[attrName] = attrValue;
                  sortedAttrs.push({
                    name: attrName,
                    value: attrValue
                  });
                }
              }
              attrs = sortedAttrs;
            }
            writer.start(node.name, attrs, isEmpty);
            if (!isEmpty) {
              if (node = node.firstChild) {
                do {
                  walk(node);
                } while (node = node.next);
              }
              writer.end(name);
            }
          } else {
            handler(node);
          }
        }
        if (node.type == 1 && !settings.inner) {
          walk(node);
        } else {
          handlers[11](node);
        }
        return writer.getContent();
      };
    };
  });
  define('tinymce/dom/Serializer', [
    'tinymce/dom/DOMUtils',
    'tinymce/html/DomParser',
    'tinymce/html/Entities',
    'tinymce/html/Serializer',
    'tinymce/html/Node',
    'tinymce/html/Schema',
    'tinymce/Env',
    'tinymce/util/Tools'
  ], function (DOMUtils, DomParser, Entities, Serializer, Node, Schema, Env, Tools) {
    var each = Tools.each, trim = Tools.trim;
    var DOM = DOMUtils.DOM;
    return function (settings, editor) {
      var dom, schema, htmlParser;
      if (editor) {
        dom = editor.dom;
        schema = editor.schema;
      }
      dom = dom || DOM;
      schema = schema || new Schema(settings);
      settings.entity_encoding = settings.entity_encoding || 'named';
      settings.remove_trailing_brs = 'remove_trailing_brs' in settings ? settings.remove_trailing_brs : true;
      htmlParser = new DomParser(settings, schema);
      htmlParser.addAttributeFilter('src,href,style', function (nodes, name) {
        var i = nodes.length, node, value, internalName = 'data-mce-' + name;
        var urlConverter = settings.url_converter, urlConverterScope = settings.url_converter_scope, undef;
        while (i--) {
          node = nodes[i];
          value = node.attributes.map[internalName];
          if (value !== undef) {
            node.attr(name, value.length > 0 ? value : null);
            node.attr(internalName, null);
          } else {
            value = node.attributes.map[name];
            if (name === 'style') {
              value = dom.serializeStyle(dom.parseStyle(value), node.name);
            } else if (urlConverter) {
              value = urlConverter.call(urlConverterScope, value, name, node.name);
            }
            node.attr(name, value.length > 0 ? value : null);
          }
        }
      });
      htmlParser.addAttributeFilter('class', function (nodes) {
        var i = nodes.length, node, value;
        while (i--) {
          node = nodes[i];
          value = node.attr('class').replace(/(?:^|\s)mce-item-\w+(?!\S)/g, '');
          node.attr('class', value.length > 0 ? value : null);
        }
      });
      htmlParser.addAttributeFilter('data-mce-type', function (nodes, name, args) {
        var i = nodes.length, node;
        while (i--) {
          node = nodes[i];
          if (node.attributes.map['data-mce-type'] === 'bookmark' && !args.cleanup) {
            node.remove();
          }
        }
      });
      htmlParser.addAttributeFilter('data-mce-expando', function (nodes, name) {
        var i = nodes.length;
        while (i--) {
          nodes[i].attr(name, null);
        }
      });
      htmlParser.addNodeFilter('noscript', function (nodes) {
        var i = nodes.length, node;
        while (i--) {
          node = nodes[i].firstChild;
          if (node) {
            node.value = Entities.decode(node.value);
          }
        }
      });
      htmlParser.addNodeFilter('script,style', function (nodes, name) {
        var i = nodes.length, node, value;
        function trim(value) {
          return value.replace(/(<!--\[CDATA\[|\]\]-->)/g, '\n').replace(/^[\r\n]*|[\r\n]*$/g, '').replace(/^\s*((<!--)?(\s*\/\/)?\s*<!\[CDATA\[|(<!--\s*)?\/\*\s*<!\[CDATA\[\s*\*\/|(\/\/)?\s*<!--|\/\*\s*<!--\s*\*\/)\s*[\r\n]*/gi, '').replace(/\s*(\/\*\s*\]\]>\s*\*\/(-->)?|\s*\/\/\s*\]\]>(-->)?|\/\/\s*(-->)?|\]\]>|\/\*\s*-->\s*\*\/|\s*-->\s*)\s*$/g, '');
        }
        while (i--) {
          node = nodes[i];
          value = node.firstChild ? node.firstChild.value : '';
          if (name === 'script') {
            var type = (node.attr('type') || 'text/javascript').replace(/^mce\-/, '');
            node.attr('type', type === 'text/javascript' ? null : type);
            if (value.length > 0) {
              node.firstChild.value = '// <![CDATA[\n' + trim(value) + '\n// ]]>';
            }
          } else {
            if (value.length > 0) {
              node.firstChild.value = '<!--\n' + trim(value) + '\n-->';
            }
          }
        }
      });
      htmlParser.addNodeFilter('#comment', function (nodes) {
        var i = nodes.length, node;
        while (i--) {
          node = nodes[i];
          if (node.value.indexOf('[CDATA[') === 0) {
            node.name = '#cdata';
            node.type = 4;
            node.value = node.value.replace(/^\[CDATA\[|\]\]$/g, '');
          } else if (node.value.indexOf('mce:protected ') === 0) {
            node.name = '#text';
            node.type = 3;
            node.raw = true;
            node.value = unescape(node.value).substr(14);
          }
        }
      });
      htmlParser.addNodeFilter('xml:namespace,input', function (nodes, name) {
        var i = nodes.length, node;
        while (i--) {
          node = nodes[i];
          if (node.type === 7) {
            node.remove();
          } else if (node.type === 1) {
            if (name === 'input' && !('type' in node.attributes.map)) {
              node.attr('type', 'text');
            }
          }
        }
      });
      if (settings.fix_list_elements) {
        htmlParser.addNodeFilter('ul,ol', function (nodes) {
          var i = nodes.length, node, parentNode;
          while (i--) {
            node = nodes[i];
            parentNode = node.parent;
            if (parentNode.name === 'ul' || parentNode.name === 'ol') {
              if (node.prev && node.prev.name === 'li') {
                node.prev.append(node);
              }
            }
          }
        });
      }
      htmlParser.addAttributeFilter('data-mce-src,data-mce-href,data-mce-style,data-mce-selected', function (nodes, name) {
        var i = nodes.length;
        while (i--) {
          nodes[i].attr(name, null);
        }
      });
      return {
        schema: schema,
        addNodeFilter: htmlParser.addNodeFilter,
        addAttributeFilter: htmlParser.addAttributeFilter,
        serialize: function (node, args) {
          var self = this, impl, doc, oldDoc, htmlSerializer, content;
          if (Env.ie && dom.select('script,style,select,map').length > 0) {
            content = node.innerHTML;
            node = node.cloneNode(false);
            dom.setHTML(node, content);
          } else {
            node = node.cloneNode(true);
          }
          impl = node.ownerDocument.implementation;
          if (impl.createHTMLDocument) {
            doc = impl.createHTMLDocument('');
            each(node.nodeName == 'BODY' ? node.childNodes : [node], function (node) {
              doc.body.appendChild(doc.importNode(node, true));
            });
            if (node.nodeName != 'BODY') {
              node = doc.body.firstChild;
            } else {
              node = doc.body;
            }
            oldDoc = dom.doc;
            dom.doc = doc;
          }
          args = args || {};
          args.format = args.format || 'html';
          if (args.selection) {
            args.forced_root_block = '';
          }
          if (!args.no_events) {
            args.node = node;
            self.onPreProcess(args);
          }
          htmlSerializer = new Serializer(settings, schema);
          args.content = htmlSerializer.serialize(htmlParser.parse(trim(args.getInner ? node.innerHTML : dom.getOuterHTML(node)), args));
          if (!args.cleanup) {
            args.content = args.content.replace(/\uFEFF/g, '');
          }
          if (!args.no_events) {
            self.onPostProcess(args);
          }
          if (oldDoc) {
            dom.doc = oldDoc;
          }
          args.node = null;
          return args.content;
        },
        addRules: function (rules) {
          schema.addValidElements(rules);
        },
        setRules: function (rules) {
          schema.setValidElements(rules);
        },
        onPreProcess: function (args) {
          if (editor) {
            editor.fire('PreProcess', args);
          }
        },
        onPostProcess: function (args) {
          if (editor) {
            editor.fire('PostProcess', args);
          }
        }
      };
    };
  });
  define('tinymce/dom/TridentSelection', [], function () {
    function Selection(selection) {
      var self = this, dom = selection.dom, FALSE = false;
      function getPosition(rng, start) {
        var checkRng, startIndex = 0, endIndex, inside, children, child, offset, index, position = -1, parent;
        checkRng = rng.duplicate();
        checkRng.collapse(start);
        parent = checkRng.parentElement();
        if (parent.ownerDocument !== selection.dom.doc) {
          return;
        }
        while (parent.contentEditable === 'false') {
          parent = parent.parentNode;
        }
        if (!parent.hasChildNodes()) {
          return {
            node: parent,
            inside: 1
          };
        }
        children = parent.children;
        endIndex = children.length - 1;
        while (startIndex <= endIndex) {
          index = Math.floor((startIndex + endIndex) / 2);
          child = children[index];
          checkRng.moveToElementText(child);
          position = checkRng.compareEndPoints(start ? 'StartToStart' : 'EndToEnd', rng);
          if (position > 0) {
            endIndex = index - 1;
          } else if (position < 0) {
            startIndex = index + 1;
          } else {
            return { node: child };
          }
        }
        if (position < 0) {
          if (!child) {
            checkRng.moveToElementText(parent);
            checkRng.collapse(true);
            child = parent;
            inside = true;
          } else {
            checkRng.collapse(false);
          }
          offset = 0;
          while (checkRng.compareEndPoints(start ? 'StartToStart' : 'StartToEnd', rng) !== 0) {
            if (checkRng.move('character', 1) === 0 || parent != checkRng.parentElement()) {
              break;
            }
            offset++;
          }
        } else {
          checkRng.collapse(true);
          offset = 0;
          while (checkRng.compareEndPoints(start ? 'StartToStart' : 'StartToEnd', rng) !== 0) {
            if (checkRng.move('character', -1) === 0 || parent != checkRng.parentElement()) {
              break;
            }
            offset++;
          }
        }
        return {
          node: child,
          position: position,
          offset: offset,
          inside: inside
        };
      }
      function getRange() {
        var ieRange = selection.getRng(), domRange = dom.createRng(), element, collapsed, tmpRange, element2, bookmark;
        element = ieRange.item ? ieRange.item(0) : ieRange.parentElement();
        if (element.ownerDocument != dom.doc) {
          return domRange;
        }
        collapsed = selection.isCollapsed();
        if (ieRange.item) {
          domRange.setStart(element.parentNode, dom.nodeIndex(element));
          domRange.setEnd(domRange.startContainer, domRange.startOffset + 1);
          return domRange;
        }
        function findEndPoint(start) {
          var endPoint = getPosition(ieRange, start), container, offset, textNodeOffset = 0, sibling, undef, nodeValue;
          container = endPoint.node;
          offset = endPoint.offset;
          if (endPoint.inside && !container.hasChildNodes()) {
            domRange[start ? 'setStart' : 'setEnd'](container, 0);
            return;
          }
          if (offset === undef) {
            domRange[start ? 'setStartBefore' : 'setEndAfter'](container);
            return;
          }
          if (endPoint.position < 0) {
            sibling = endPoint.inside ? container.firstChild : container.nextSibling;
            if (!sibling) {
              domRange[start ? 'setStartAfter' : 'setEndAfter'](container);
              return;
            }
            if (!offset) {
              if (sibling.nodeType == 3) {
                domRange[start ? 'setStart' : 'setEnd'](sibling, 0);
              } else {
                domRange[start ? 'setStartBefore' : 'setEndBefore'](sibling);
              }
              return;
            }
            while (sibling) {
              nodeValue = sibling.nodeValue;
              textNodeOffset += nodeValue.length;
              if (textNodeOffset >= offset) {
                container = sibling;
                textNodeOffset -= offset;
                textNodeOffset = nodeValue.length - textNodeOffset;
                break;
              }
              sibling = sibling.nextSibling;
            }
          } else {
            sibling = container.previousSibling;
            if (!sibling) {
              return domRange[start ? 'setStartBefore' : 'setEndBefore'](container);
            }
            if (!offset) {
              if (container.nodeType == 3) {
                domRange[start ? 'setStart' : 'setEnd'](sibling, container.nodeValue.length);
              } else {
                domRange[start ? 'setStartAfter' : 'setEndAfter'](sibling);
              }
              return;
            }
            while (sibling) {
              textNodeOffset += sibling.nodeValue.length;
              if (textNodeOffset >= offset) {
                container = sibling;
                textNodeOffset -= offset;
                break;
              }
              sibling = sibling.previousSibling;
            }
          }
          domRange[start ? 'setStart' : 'setEnd'](container, textNodeOffset);
        }
        try {
          findEndPoint(true);
          if (!collapsed) {
            findEndPoint();
          }
        } catch (ex) {
          if (ex.number == -2147024809) {
            bookmark = self.getBookmark(2);
            tmpRange = ieRange.duplicate();
            tmpRange.collapse(true);
            element = tmpRange.parentElement();
            if (!collapsed) {
              tmpRange = ieRange.duplicate();
              tmpRange.collapse(false);
              element2 = tmpRange.parentElement();
              element2.innerHTML = element2.innerHTML;
            }
            element.innerHTML = element.innerHTML;
            self.moveToBookmark(bookmark);
            ieRange = selection.getRng();
            findEndPoint(true);
            if (!collapsed) {
              findEndPoint();
            }
          } else {
            throw ex;
          }
        }
        return domRange;
      }
      this.getBookmark = function (type) {
        var rng = selection.getRng(), bookmark = {};
        function getIndexes(node) {
          var parent, root, children, i, indexes = [];
          parent = node.parentNode;
          root = dom.getRoot().parentNode;
          while (parent != root && parent.nodeType !== 9) {
            children = parent.children;
            i = children.length;
            while (i--) {
              if (node === children[i]) {
                indexes.push(i);
                break;
              }
            }
            node = parent;
            parent = parent.parentNode;
          }
          return indexes;
        }
        function getBookmarkEndPoint(start) {
          var position;
          position = getPosition(rng, start);
          if (position) {
            return {
              position: position.position,
              offset: position.offset,
              indexes: getIndexes(position.node),
              inside: position.inside
            };
          }
        }
        if (type === 2) {
          if (!rng.item) {
            bookmark.start = getBookmarkEndPoint(true);
            if (!selection.isCollapsed()) {
              bookmark.end = getBookmarkEndPoint();
            }
          } else {
            bookmark.start = {
              ctrl: true,
              indexes: getIndexes(rng.item(0))
            };
          }
        }
        return bookmark;
      };
      this.moveToBookmark = function (bookmark) {
        var rng, body = dom.doc.body;
        function resolveIndexes(indexes) {
          var node, i, idx, children;
          node = dom.getRoot();
          for (i = indexes.length - 1; i >= 0; i--) {
            children = node.children;
            idx = indexes[i];
            if (idx <= children.length - 1) {
              node = children[idx];
            }
          }
          return node;
        }
        function setBookmarkEndPoint(start) {
          var endPoint = bookmark[start ? 'start' : 'end'], moveLeft, moveRng, undef, offset;
          if (endPoint) {
            moveLeft = endPoint.position > 0;
            moveRng = body.createTextRange();
            moveRng.moveToElementText(resolveIndexes(endPoint.indexes));
            offset = endPoint.offset;
            if (offset !== undef) {
              moveRng.collapse(endPoint.inside || moveLeft);
              moveRng.moveStart('character', moveLeft ? -offset : offset);
            } else {
              moveRng.collapse(start);
            }
            rng.setEndPoint(start ? 'StartToStart' : 'EndToStart', moveRng);
            if (start) {
              rng.collapse(true);
            }
          }
        }
        if (bookmark.start) {
          if (bookmark.start.ctrl) {
            rng = body.createControlRange();
            rng.addElement(resolveIndexes(bookmark.start.indexes));
            rng.select();
          } else {
            rng = body.createTextRange();
            setBookmarkEndPoint(true);
            setBookmarkEndPoint();
            rng.select();
          }
        }
      };
      this.addRange = function (rng) {
        var ieRng, ctrlRng, startContainer, startOffset, endContainer, endOffset, sibling, doc = selection.dom.doc, body = doc.body, nativeRng, ctrlElm;
        function setEndPoint(start) {
          var container, offset, marker, tmpRng, nodes;
          marker = dom.create('a');
          container = start ? startContainer : endContainer;
          offset = start ? startOffset : endOffset;
          tmpRng = ieRng.duplicate();
          if (container == doc || container == doc.documentElement) {
            container = body;
            offset = 0;
          }
          if (container.nodeType == 3) {
            container.parentNode.insertBefore(marker, container);
            tmpRng.moveToElementText(marker);
            tmpRng.moveStart('character', offset);
            dom.remove(marker);
            ieRng.setEndPoint(start ? 'StartToStart' : 'EndToEnd', tmpRng);
          } else {
            nodes = container.childNodes;
            if (nodes.length) {
              if (offset >= nodes.length) {
                dom.insertAfter(marker, nodes[nodes.length - 1]);
              } else {
                container.insertBefore(marker, nodes[offset]);
              }
              tmpRng.moveToElementText(marker);
            } else if (container.canHaveHTML) {
              container.innerHTML = '<span>&#xFEFF;</span>';
              marker = container.firstChild;
              tmpRng.moveToElementText(marker);
              tmpRng.collapse(FALSE);
            }
            ieRng.setEndPoint(start ? 'StartToStart' : 'EndToEnd', tmpRng);
            dom.remove(marker);
          }
        }
        startContainer = rng.startContainer;
        startOffset = rng.startOffset;
        endContainer = rng.endContainer;
        endOffset = rng.endOffset;
        ieRng = body.createTextRange();
        if (startContainer == endContainer && startContainer.nodeType == 1) {
          if (startOffset == endOffset && !startContainer.hasChildNodes()) {
            if (startContainer.canHaveHTML) {
              sibling = startContainer.previousSibling;
              if (sibling && !sibling.hasChildNodes() && dom.isBlock(sibling)) {
                sibling.innerHTML = '&#xFEFF;';
              } else {
                sibling = null;
              }
              startContainer.innerHTML = '<span>&#xFEFF;</span><span>&#xFEFF;</span>';
              ieRng.moveToElementText(startContainer.lastChild);
              ieRng.select();
              dom.doc.selection.clear();
              startContainer.innerHTML = '';
              if (sibling) {
                sibling.innerHTML = '';
              }
              return;
            } else {
              startOffset = dom.nodeIndex(startContainer);
              startContainer = startContainer.parentNode;
            }
          }
          if (startOffset == endOffset - 1) {
            try {
              ctrlElm = startContainer.childNodes[startOffset];
              ctrlRng = body.createControlRange();
              ctrlRng.addElement(ctrlElm);
              ctrlRng.select();
              nativeRng = selection.getRng();
              if (nativeRng.item && ctrlElm === nativeRng.item(0)) {
                return;
              }
            } catch (ex) {
            }
          }
        }
        setEndPoint(true);
        setEndPoint();
        ieRng.select();
      };
      this.getRangeAt = getRange;
    }
    return Selection;
  });
  define('tinymce/util/VK', ['tinymce/Env'], function (Env) {
    return {
      BACKSPACE: 8,
      DELETE: 46,
      DOWN: 40,
      ENTER: 13,
      LEFT: 37,
      RIGHT: 39,
      SPACEBAR: 32,
      TAB: 9,
      UP: 38,
      modifierPressed: function (e) {
        return e.shiftKey || e.ctrlKey || e.altKey;
      },
      metaKeyPressed: function (e) {
        return (Env.mac ? e.metaKey : e.ctrlKey) && !e.altKey;
      }
    };
  });
  define('tinymce/dom/ControlSelection', [
    'tinymce/util/VK',
    'tinymce/util/Tools',
    'tinymce/Env'
  ], function (VK, Tools, Env) {
    return function (selection, editor) {
      var dom = editor.dom, each = Tools.each;
      var selectedElm, selectedElmGhost, resizeHandles, selectedHandle, lastMouseDownEvent;
      var startX, startY, selectedElmX, selectedElmY, startW, startH, ratio, resizeStarted;
      var width, height, editableDoc = editor.getDoc(), rootDocument = document, isIE = Env.ie && Env.ie < 11;
      resizeHandles = {
        n: [
          0.5,
          0,
          0,
          -1
        ],
        e: [
          1,
          0.5,
          1,
          0
        ],
        s: [
          0.5,
          1,
          0,
          1
        ],
        w: [
          0,
          0.5,
          -1,
          0
        ],
        nw: [
          0,
          0,
          -1,
          -1
        ],
        ne: [
          1,
          0,
          1,
          -1
        ],
        se: [
          1,
          1,
          1,
          1
        ],
        sw: [
          0,
          1,
          -1,
          1
        ]
      };
      var rootClass = '.mce-content-body';
      editor.contentStyles.push(rootClass + ' div.mce-resizehandle {' + 'position: absolute;' + 'border: 1px solid black;' + 'background: #FFF;' + 'width: 5px;' + 'height: 5px;' + 'z-index: 10000' + '}' + rootClass + ' .mce-resizehandle:hover {' + 'background: #000' + '}' + rootClass + ' img[data-mce-selected], hr[data-mce-selected] {' + 'outline: 1px solid black;' + 'resize: none' + '}' + rootClass + ' .mce-clonedresizable {' + 'position: absolute;' + (Env.gecko ? '' : 'outline: 1px dashed black;') + 'opacity: .5;' + 'filter: alpha(opacity=50);' + 'z-index: 10000' + '}');
      function isResizable(elm) {
        var selector = editor.settings.object_resizing;
        if (selector === false || Env.iOS) {
          return false;
        }
        if (typeof selector != 'string') {
          selector = 'table,img,div';
        }
        if (elm.getAttribute('data-mce-resize') === 'false') {
          return false;
        }
        return editor.dom.is(elm, selector);
      }
      function resizeGhostElement(e) {
        var deltaX, deltaY;
        deltaX = e.screenX - startX;
        deltaY = e.screenY - startY;
        width = deltaX * selectedHandle[2] + startW;
        height = deltaY * selectedHandle[3] + startH;
        width = width < 5 ? 5 : width;
        height = height < 5 ? 5 : height;
        if (VK.modifierPressed(e) || selectedElm.nodeName == 'IMG' && selectedHandle[2] * selectedHandle[3] !== 0) {
          width = Math.round(height / ratio);
          height = Math.round(width * ratio);
        }
        dom.setStyles(selectedElmGhost, {
          width: width,
          height: height
        });
        if (selectedHandle[2] < 0 && selectedElmGhost.clientWidth <= width) {
          dom.setStyle(selectedElmGhost, 'left', selectedElmX + (startW - width));
        }
        if (selectedHandle[3] < 0 && selectedElmGhost.clientHeight <= height) {
          dom.setStyle(selectedElmGhost, 'top', selectedElmY + (startH - height));
        }
        if (!resizeStarted) {
          editor.fire('ObjectResizeStart', {
            target: selectedElm,
            width: startW,
            height: startH
          });
          resizeStarted = true;
        }
      }
      function endGhostResize() {
        resizeStarted = false;
        function setSizeProp(name, value) {
          if (value) {
            if (selectedElm.style[name] || !editor.schema.isValid(selectedElm.nodeName.toLowerCase(), name)) {
              dom.setStyle(selectedElm, name, value);
            } else {
              dom.setAttrib(selectedElm, name, value);
            }
          }
        }
        setSizeProp('width', width);
        setSizeProp('height', height);
        dom.unbind(editableDoc, 'mousemove', resizeGhostElement);
        dom.unbind(editableDoc, 'mouseup', endGhostResize);
        if (rootDocument != editableDoc) {
          dom.unbind(rootDocument, 'mousemove', resizeGhostElement);
          dom.unbind(rootDocument, 'mouseup', endGhostResize);
        }
        dom.remove(selectedElmGhost);
        if (!isIE || selectedElm.nodeName == 'TABLE') {
          showResizeRect(selectedElm);
        }
        editor.fire('ObjectResized', {
          target: selectedElm,
          width: width,
          height: height
        });
        editor.nodeChanged();
      }
      function showResizeRect(targetElm, mouseDownHandleName, mouseDownEvent) {
        var position, targetWidth, targetHeight, e, rect, offsetParent = editor.getBody();
        position = dom.getPos(targetElm, offsetParent);
        selectedElmX = position.x;
        selectedElmY = position.y;
        rect = targetElm.getBoundingClientRect();
        targetWidth = rect.width || rect.right - rect.left;
        targetHeight = rect.height || rect.bottom - rect.top;
        if (selectedElm != targetElm) {
          detachResizeStartListener();
          selectedElm = targetElm;
          width = height = 0;
        }
        e = editor.fire('ObjectSelected', { target: targetElm });
        if (isResizable(targetElm) && !e.isDefaultPrevented()) {
          each(resizeHandles, function (handle, name) {
            var handleElm, handlerContainerElm;
            function startDrag(e) {
              startX = e.screenX;
              startY = e.screenY;
              startW = selectedElm.clientWidth;
              startH = selectedElm.clientHeight;
              ratio = startH / startW;
              selectedHandle = handle;
              selectedElmGhost = selectedElm.cloneNode(true);
              dom.addClass(selectedElmGhost, 'mce-clonedresizable');
              selectedElmGhost.contentEditable = false;
              selectedElmGhost.unSelectabe = true;
              dom.setStyles(selectedElmGhost, {
                left: selectedElmX,
                top: selectedElmY,
                margin: 0
              });
              selectedElmGhost.removeAttribute('data-mce-selected');
              editor.getBody().appendChild(selectedElmGhost);
              dom.bind(editableDoc, 'mousemove', resizeGhostElement);
              dom.bind(editableDoc, 'mouseup', endGhostResize);
              if (rootDocument != editableDoc) {
                dom.bind(rootDocument, 'mousemove', resizeGhostElement);
                dom.bind(rootDocument, 'mouseup', endGhostResize);
              }
            }
            if (mouseDownHandleName) {
              if (name == mouseDownHandleName) {
                startDrag(mouseDownEvent);
              }
              return;
            }
            handleElm = dom.get('mceResizeHandle' + name);
            if (!handleElm) {
              handlerContainerElm = editor.getBody();
              handleElm = dom.add(handlerContainerElm, 'div', {
                id: 'mceResizeHandle' + name,
                'data-mce-bogus': true,
                'class': 'mce-resizehandle',
                unselectable: true,
                style: 'cursor:' + name + '-resize; margin:0; padding:0'
              });
              if (Env.ie) {
                handleElm.contentEditable = false;
              }
              dom.bind(handleElm, 'mousedown', function (e) {
                e.stopImmediatePropagation();
                e.preventDefault();
                startDrag(e);
              });
            } else {
              dom.show(handleElm);
            }
            dom.setStyles(handleElm, {
              left: targetWidth * handle[0] + selectedElmX - handleElm.offsetWidth / 2,
              top: targetHeight * handle[1] + selectedElmY - handleElm.offsetHeight / 2
            });
          });
        } else {
          hideResizeRect();
        }
        selectedElm.setAttribute('data-mce-selected', '1');
      }
      function hideResizeRect() {
        var name, handleElm;
        if (selectedElm) {
          selectedElm.removeAttribute('data-mce-selected');
        }
        for (name in resizeHandles) {
          handleElm = dom.get('mceResizeHandle' + name);
          if (handleElm) {
            dom.unbind(handleElm);
            dom.remove(handleElm);
          }
        }
      }
      function updateResizeRect(e) {
        var controlElm;
        function isChildOrEqual(node, parent) {
          if (node) {
            do {
              if (node === parent) {
                return true;
              }
            } while (node = node.parentNode);
          }
        }
        each(dom.select('img[data-mce-selected],hr[data-mce-selected]'), function (img) {
          img.removeAttribute('data-mce-selected');
        });
        controlElm = e.type == 'mousedown' ? e.target : selection.getNode();
        controlElm = dom.getParent(controlElm, isIE ? 'table' : 'table,img,hr');
        if (isChildOrEqual(controlElm, editor.getBody())) {
          disableGeckoResize();
          if (isChildOrEqual(selection.getStart(), controlElm) && isChildOrEqual(selection.getEnd(), controlElm)) {
            if (!isIE || controlElm != selection.getStart() && selection.getStart().nodeName !== 'IMG') {
              showResizeRect(controlElm);
              return;
            }
          }
        }
        hideResizeRect();
      }
      function attachEvent(elm, name, func) {
        if (elm && elm.attachEvent) {
          elm.attachEvent('on' + name, func);
        }
      }
      function detachEvent(elm, name, func) {
        if (elm && elm.detachEvent) {
          elm.detachEvent('on' + name, func);
        }
      }
      function resizeNativeStart(e) {
        var target = e.srcElement, pos, name, corner, cornerX, cornerY, relativeX, relativeY;
        pos = target.getBoundingClientRect();
        relativeX = lastMouseDownEvent.clientX - pos.left;
        relativeY = lastMouseDownEvent.clientY - pos.top;
        for (name in resizeHandles) {
          corner = resizeHandles[name];
          cornerX = target.offsetWidth * corner[0];
          cornerY = target.offsetHeight * corner[1];
          if (Math.abs(cornerX - relativeX) < 8 && Math.abs(cornerY - relativeY) < 8) {
            selectedHandle = corner;
            break;
          }
        }
        resizeStarted = true;
        editor.getDoc().selection.empty();
        showResizeRect(target, name, lastMouseDownEvent);
      }
      function nativeControlSelect(e) {
        var target = e.srcElement;
        if (target != selectedElm) {
          detachResizeStartListener();
          if (target.id.indexOf('mceResizeHandle') === 0) {
            e.returnValue = false;
            return;
          }
          if (target.nodeName == 'IMG' || target.nodeName == 'TABLE') {
            hideResizeRect();
            selectedElm = target;
            attachEvent(target, 'resizestart', resizeNativeStart);
          }
        }
      }
      function detachResizeStartListener() {
        detachEvent(selectedElm, 'resizestart', resizeNativeStart);
      }
      function disableGeckoResize() {
        try {
          editor.getDoc().execCommand('enableObjectResizing', false, false);
        } catch (ex) {
        }
      }
      function controlSelect(elm) {
        var ctrlRng;
        if (!isIE) {
          return;
        }
        ctrlRng = editableDoc.body.createControlRange();
        try {
          ctrlRng.addElement(elm);
          ctrlRng.select();
          return true;
        } catch (ex) {
        }
      }
      editor.on('init', function () {
        if (isIE) {
          editor.on('ObjectResized', function (e) {
            if (e.target.nodeName != 'TABLE') {
              hideResizeRect();
              controlSelect(e.target);
            }
          });
          attachEvent(editor.getBody(), 'controlselect', nativeControlSelect);
          editor.on('mousedown', function (e) {
            lastMouseDownEvent = e;
          });
        } else {
          disableGeckoResize();
          if (Env.ie >= 11) {
            editor.on('mouseup', function (e) {
              var nodeName = e.target.nodeName;
              if (/^(TABLE|IMG|HR)$/.test(nodeName)) {
                editor.selection.select(e.target, nodeName == 'TABLE');
                editor.nodeChanged();
              }
            });
            editor.dom.bind(editor.getBody(), 'mscontrolselect', function (e) {
              if (/^(TABLE|IMG|HR)$/.test(e.target.nodeName)) {
                e.preventDefault();
                if (e.target.tagName == 'IMG') {
                  window.setTimeout(function () {
                    editor.selection.select(e.target);
                  }, 0);
                }
              }
            });
          }
        }
        editor.on('nodechange mousedown mouseup ResizeEditor', updateResizeRect);
        editor.on('keydown keyup', function (e) {
          if (selectedElm && selectedElm.nodeName == 'TABLE') {
            updateResizeRect(e);
          }
        });
      });
      function destroy() {
        selectedElm = selectedElmGhost = null;
        if (isIE) {
          detachResizeStartListener();
          detachEvent(editor.getBody(), 'controlselect', nativeControlSelect);
        }
      }
      return {
        isResizable: isResizable,
        showResizeRect: showResizeRect,
        hideResizeRect: hideResizeRect,
        updateResizeRect: updateResizeRect,
        controlSelect: controlSelect,
        destroy: destroy
      };
    };
  });
  define('tinymce/dom/RangeUtils', [
    'tinymce/util/Tools',
    'tinymce/dom/TreeWalker'
  ], function (Tools, TreeWalker) {
    var each = Tools.each;
    function RangeUtils(dom) {
      this.walk = function (rng, callback) {
        var startContainer = rng.startContainer, startOffset = rng.startOffset, endContainer = rng.endContainer, endOffset = rng.endOffset, ancestor, startPoint, endPoint, node, parent, siblings, nodes;
        nodes = dom.select('td.mce-item-selected,th.mce-item-selected');
        if (nodes.length > 0) {
          each(nodes, function (node) {
            callback([node]);
          });
          return;
        }
        function exclude(nodes) {
          var node;
          node = nodes[0];
          if (node.nodeType === 3 && node === startContainer && startOffset >= node.nodeValue.length) {
            nodes.splice(0, 1);
          }
          node = nodes[nodes.length - 1];
          if (endOffset === 0 && nodes.length > 0 && node === endContainer && node.nodeType === 3) {
            nodes.splice(nodes.length - 1, 1);
          }
          return nodes;
        }
        function collectSiblings(node, name, end_node) {
          var siblings = [];
          for (; node && node != end_node; node = node[name]) {
            siblings.push(node);
          }
          return siblings;
        }
        function findEndPoint(node, root) {
          do {
            if (node.parentNode == root) {
              return node;
            }
            node = node.parentNode;
          } while (node);
        }
        function walkBoundary(start_node, end_node, next) {
          var siblingName = next ? 'nextSibling' : 'previousSibling';
          for (node = start_node, parent = node.parentNode; node && node != end_node; node = parent) {
            parent = node.parentNode;
            siblings = collectSiblings(node == start_node ? node : node[siblingName], siblingName);
            if (siblings.length) {
              if (!next) {
                siblings.reverse();
              }
              callback(exclude(siblings));
            }
          }
        }
        if (startContainer.nodeType == 1 && startContainer.hasChildNodes()) {
          startContainer = startContainer.childNodes[startOffset];
        }
        if (endContainer.nodeType == 1 && endContainer.hasChildNodes()) {
          endContainer = endContainer.childNodes[Math.min(endOffset - 1, endContainer.childNodes.length - 1)];
        }
        if (startContainer == endContainer) {
          return callback(exclude([startContainer]));
        }
        ancestor = dom.findCommonAncestor(startContainer, endContainer);
        for (node = startContainer; node; node = node.parentNode) {
          if (node === endContainer) {
            return walkBoundary(startContainer, ancestor, true);
          }
          if (node === ancestor) {
            break;
          }
        }
        for (node = endContainer; node; node = node.parentNode) {
          if (node === startContainer) {
            return walkBoundary(endContainer, ancestor);
          }
          if (node === ancestor) {
            break;
          }
        }
        startPoint = findEndPoint(startContainer, ancestor) || startContainer;
        endPoint = findEndPoint(endContainer, ancestor) || endContainer;
        walkBoundary(startContainer, startPoint, true);
        siblings = collectSiblings(startPoint == startContainer ? startPoint : startPoint.nextSibling, 'nextSibling', endPoint == endContainer ? endPoint.nextSibling : endPoint);
        if (siblings.length) {
          callback(exclude(siblings));
        }
        walkBoundary(endContainer, endPoint);
      };
      this.split = function (rng) {
        var startContainer = rng.startContainer, startOffset = rng.startOffset, endContainer = rng.endContainer, endOffset = rng.endOffset;
        function splitText(node, offset) {
          return node.splitText(offset);
        }
        if (startContainer == endContainer && startContainer.nodeType == 3) {
          if (startOffset > 0 && startOffset < startContainer.nodeValue.length) {
            endContainer = splitText(startContainer, startOffset);
            startContainer = endContainer.previousSibling;
            if (endOffset > startOffset) {
              endOffset = endOffset - startOffset;
              startContainer = endContainer = splitText(endContainer, endOffset).previousSibling;
              endOffset = endContainer.nodeValue.length;
              startOffset = 0;
            } else {
              endOffset = 0;
            }
          }
        } else {
          if (startContainer.nodeType == 3 && startOffset > 0 && startOffset < startContainer.nodeValue.length) {
            startContainer = splitText(startContainer, startOffset);
            startOffset = 0;
          }
          if (endContainer.nodeType == 3 && endOffset > 0 && endOffset < endContainer.nodeValue.length) {
            endContainer = splitText(endContainer, endOffset).previousSibling;
            endOffset = endContainer.nodeValue.length;
          }
        }
        return {
          startContainer: startContainer,
          startOffset: startOffset,
          endContainer: endContainer,
          endOffset: endOffset
        };
      };
      this.normalize = function (rng) {
        var normalized, collapsed;
        function normalizeEndPoint(start) {
          var container, offset, walker, body = dom.getRoot(), node, nonEmptyElementsMap, nodeName;
          var directionLeft, isAfterNode;
          function hasBrBeforeAfter(node, left) {
            var walker = new TreeWalker(node, dom.getParent(node.parentNode, dom.isBlock) || body);
            while (node = walker[left ? 'prev' : 'next']()) {
              if (node.nodeName === 'BR') {
                return true;
              }
            }
          }
          function isPrevNode(node, name) {
            return node.previousSibling && node.previousSibling.nodeName == name;
          }
          function findTextNodeRelative(left, startNode) {
            var walker, lastInlineElement, parentBlockContainer;
            startNode = startNode || container;
            parentBlockContainer = dom.getParent(startNode.parentNode, dom.isBlock) || body;
            if (left && startNode.nodeName == 'BR' && isAfterNode && dom.isEmpty(parentBlockContainer)) {
              container = startNode.parentNode;
              offset = dom.nodeIndex(startNode);
              normalized = true;
              return;
            }
            walker = new TreeWalker(startNode, parentBlockContainer);
            while (node = walker[left ? 'prev' : 'next']()) {
              if (node.nodeType === 3 && node.nodeValue.length > 0) {
                container = node;
                offset = left ? node.nodeValue.length : 0;
                normalized = true;
                return;
              }
              if (dom.isBlock(node) || nonEmptyElementsMap[node.nodeName.toLowerCase()]) {
                return;
              }
              lastInlineElement = node;
            }
            if (collapsed && lastInlineElement) {
              container = lastInlineElement;
              normalized = true;
              offset = 0;
            }
          }
          container = rng[(start ? 'start' : 'end') + 'Container'];
          offset = rng[(start ? 'start' : 'end') + 'Offset'];
          isAfterNode = container.nodeType == 1 && offset === container.childNodes.length;
          nonEmptyElementsMap = dom.schema.getNonEmptyElements();
          directionLeft = start;
          if (container.nodeType == 1 && offset > container.childNodes.length - 1) {
            directionLeft = false;
          }
          if (container.nodeType === 9) {
            container = dom.getRoot();
            offset = 0;
          }
          if (container === body) {
            if (directionLeft) {
              node = container.childNodes[offset > 0 ? offset - 1 : 0];
              if (node) {
                nodeName = node.nodeName.toLowerCase();
                if (nonEmptyElementsMap[node.nodeName] || node.nodeName == 'TABLE') {
                  return;
                }
              }
            }
            if (container.hasChildNodes()) {
              offset = Math.min(!directionLeft && offset > 0 ? offset - 1 : offset, container.childNodes.length - 1);
              container = container.childNodes[offset];
              offset = 0;
              if (container.hasChildNodes() && !/TABLE/.test(container.nodeName)) {
                node = container;
                walker = new TreeWalker(container, body);
                do {
                  if (node.nodeType === 3 && node.nodeValue.length > 0) {
                    offset = directionLeft ? 0 : node.nodeValue.length;
                    container = node;
                    normalized = true;
                    break;
                  }
                  if (nonEmptyElementsMap[node.nodeName.toLowerCase()]) {
                    offset = dom.nodeIndex(node);
                    container = node.parentNode;
                    if (node.nodeName == 'IMG' && !directionLeft) {
                      offset++;
                    }
                    normalized = true;
                    break;
                  }
                } while (node = directionLeft ? walker.next() : walker.prev());
              }
            }
          }
          if (collapsed) {
            if (container.nodeType === 3 && offset === 0) {
              findTextNodeRelative(true);
            }
            if (container.nodeType === 1) {
              node = container.childNodes[offset];
              if (!node) {
                node = container.childNodes[offset - 1];
              }
              if (node && node.nodeName === 'BR' && !isPrevNode(node, 'A') && !hasBrBeforeAfter(node) && !hasBrBeforeAfter(node, true)) {
                findTextNodeRelative(true, node);
              }
            }
          }
          if (directionLeft && !collapsed && container.nodeType === 3 && offset === container.nodeValue.length) {
            findTextNodeRelative(false);
          }
          if (normalized) {
            rng['set' + (start ? 'Start' : 'End')](container, offset);
          }
        }
        collapsed = rng.collapsed;
        normalizeEndPoint(true);
        if (!collapsed) {
          normalizeEndPoint();
        }
        if (normalized && collapsed) {
          rng.collapse(true);
        }
        return normalized;
      };
    }
    RangeUtils.compareRanges = function (rng1, rng2) {
      if (rng1 && rng2) {
        if (rng1.item || rng1.duplicate) {
          if (rng1.item && rng2.item && rng1.item(0) === rng2.item(0)) {
            return true;
          }
          if (rng1.isEqual && rng2.isEqual && rng2.isEqual(rng1)) {
            return true;
          }
        } else {
          return rng1.startContainer == rng2.startContainer && rng1.startOffset == rng2.startOffset;
        }
      }
      return false;
    };
    return RangeUtils;
  });
  define('tinymce/dom/Selection', [
    'tinymce/dom/TreeWalker',
    'tinymce/dom/TridentSelection',
    'tinymce/dom/ControlSelection',
    'tinymce/dom/RangeUtils',
    'tinymce/Env',
    'tinymce/util/Tools'
  ], function (TreeWalker, TridentSelection, ControlSelection, RangeUtils, Env, Tools) {
    var each = Tools.each, grep = Tools.grep, trim = Tools.trim;
    var isIE = Env.ie, isOpera = Env.opera;
    function Selection(dom, win, serializer, editor) {
      var self = this;
      self.dom = dom;
      self.win = win;
      self.serializer = serializer;
      self.editor = editor;
      self.controlSelection = new ControlSelection(self, editor);
      if (!self.win.getSelection) {
        self.tridentSel = new TridentSelection(self);
      }
    }
    Selection.prototype = {
      setCursorLocation: function (node, offset) {
        var self = this, rng = self.dom.createRng();
        if (!node) {
          self._moveEndPoint(rng, self.editor.getBody(), true);
          self.setRng(rng);
        } else {
          rng.setStart(node, offset);
          rng.setEnd(node, offset);
          self.setRng(rng);
          self.collapse(false);
        }
      },
      getContent: function (args) {
        var self = this, rng = self.getRng(), tmpElm = self.dom.create('body');
        var se = self.getSel(), whiteSpaceBefore, whiteSpaceAfter, fragment;
        args = args || {};
        whiteSpaceBefore = whiteSpaceAfter = '';
        args.get = true;
        args.format = args.format || 'html';
        args.selection = true;
        self.editor.fire('BeforeGetContent', args);
        if (args.format == 'text') {
          return self.isCollapsed() ? '' : rng.text || (se.toString ? se.toString() : '');
        }
        if (rng.cloneContents) {
          fragment = rng.cloneContents();
          if (fragment) {
            tmpElm.appendChild(fragment);
          }
        } else if (rng.item !== undefined || rng.htmlText !== undefined) {
          tmpElm.innerHTML = '<br>' + (rng.item ? rng.item(0).outerHTML : rng.htmlText);
          tmpElm.removeChild(tmpElm.firstChild);
        } else {
          tmpElm.innerHTML = rng.toString();
        }
        if (/^\s/.test(tmpElm.innerHTML)) {
          whiteSpaceBefore = ' ';
        }
        if (/\s+$/.test(tmpElm.innerHTML)) {
          whiteSpaceAfter = ' ';
        }
        args.getInner = true;
        args.content = self.isCollapsed() ? '' : whiteSpaceBefore + self.serializer.serialize(tmpElm, args) + whiteSpaceAfter;
        self.editor.fire('GetContent', args);
        return args.content;
      },
      setContent: function (content, args) {
        var self = this, rng = self.getRng(), caretNode, doc = self.win.document, frag, temp;
        args = args || { format: 'html' };
        args.set = true;
        args.selection = true;
        content = args.content = content;
        if (!args.no_events) {
          self.editor.fire('BeforeSetContent', args);
        }
        content = args.content;
        if (rng.insertNode) {
          content += '<span id="__caret">_</span>';
          if (rng.startContainer == doc && rng.endContainer == doc) {
            doc.body.innerHTML = content;
          } else {
            rng.deleteContents();
            if (doc.body.childNodes.length === 0) {
              doc.body.innerHTML = content;
            } else {
              if (rng.createContextualFragment) {
                rng.insertNode(rng.createContextualFragment(content));
              } else {
                frag = doc.createDocumentFragment();
                temp = doc.createElement('div');
                frag.appendChild(temp);
                temp.outerHTML = content;
                rng.insertNode(frag);
              }
            }
          }
          caretNode = self.dom.get('__caret');
          rng = doc.createRange();
          rng.setStartBefore(caretNode);
          rng.setEndBefore(caretNode);
          self.setRng(rng);
          self.dom.remove('__caret');
          try {
            self.setRng(rng);
          } catch (ex) {
          }
        } else {
          if (rng.item) {
            doc.execCommand('Delete', false, null);
            rng = self.getRng();
          }
          if (/^\s+/.test(content)) {
            rng.pasteHTML('<span id="__mce_tmp">_</span>' + content);
            self.dom.remove('__mce_tmp');
          } else {
            rng.pasteHTML(content);
          }
        }
        if (!args.no_events) {
          self.editor.fire('SetContent', args);
        }
      },
      getStart: function () {
        var self = this, rng = self.getRng(), startElement, parentElement, checkRng, node;
        if (rng.duplicate || rng.item) {
          if (rng.item) {
            return rng.item(0);
          }
          checkRng = rng.duplicate();
          checkRng.collapse(1);
          startElement = checkRng.parentElement();
          if (startElement.ownerDocument !== self.dom.doc) {
            startElement = self.dom.getRoot();
          }
          parentElement = node = rng.parentElement();
          while (node = node.parentNode) {
            if (node == startElement) {
              startElement = parentElement;
              break;
            }
          }
          return startElement;
        } else {
          startElement = rng.startContainer;
          if (startElement.nodeType == 1 && startElement.hasChildNodes()) {
            startElement = startElement.childNodes[Math.min(startElement.childNodes.length - 1, rng.startOffset)];
          }
          if (startElement && startElement.nodeType == 3) {
            return startElement.parentNode;
          }
          return startElement;
        }
      },
      getEnd: function () {
        var self = this, rng = self.getRng(), endElement, endOffset;
        if (rng.duplicate || rng.item) {
          if (rng.item) {
            return rng.item(0);
          }
          rng = rng.duplicate();
          rng.collapse(0);
          endElement = rng.parentElement();
          if (endElement.ownerDocument !== self.dom.doc) {
            endElement = self.dom.getRoot();
          }
          if (endElement && endElement.nodeName == 'BODY') {
            return endElement.lastChild || endElement;
          }
          return endElement;
        } else {
          endElement = rng.endContainer;
          endOffset = rng.endOffset;
          if (endElement.nodeType == 1 && endElement.hasChildNodes()) {
            endElement = endElement.childNodes[endOffset > 0 ? endOffset - 1 : endOffset];
          }
          if (endElement && endElement.nodeType == 3) {
            return endElement.parentNode;
          }
          return endElement;
        }
      },
      getBookmark: function (type, normalized) {
        var self = this, dom = self.dom, rng, rng2, id, collapsed, name, element, chr = '&#xFEFF;', styles;
        function findIndex(name, element) {
          var index = 0;
          each(dom.select(name), function (node, i) {
            if (node == element) {
              index = i;
            }
          });
          return index;
        }
        function normalizeTableCellSelection(rng) {
          function moveEndPoint(start) {
            var container, offset, childNodes, prefix = start ? 'start' : 'end';
            container = rng[prefix + 'Container'];
            offset = rng[prefix + 'Offset'];
            if (container.nodeType == 1 && container.nodeName == 'TR') {
              childNodes = container.childNodes;
              container = childNodes[Math.min(start ? offset : offset - 1, childNodes.length - 1)];
              if (container) {
                offset = start ? 0 : container.childNodes.length;
                rng['set' + (start ? 'Start' : 'End')](container, offset);
              }
            }
          }
          moveEndPoint(true);
          moveEndPoint();
          return rng;
        }
        function getLocation() {
          var rng = self.getRng(true), root = dom.getRoot(), bookmark = {};
          function getPoint(rng, start) {
            var container = rng[start ? 'startContainer' : 'endContainer'], offset = rng[start ? 'startOffset' : 'endOffset'], point = [], node, childNodes, after = 0;
            if (container.nodeType == 3) {
              if (normalized) {
                for (node = container.previousSibling; node && node.nodeType == 3; node = node.previousSibling) {
                  offset += node.nodeValue.length;
                }
              }
              point.push(offset);
            } else {
              childNodes = container.childNodes;
              if (offset >= childNodes.length && childNodes.length) {
                after = 1;
                offset = Math.max(0, childNodes.length - 1);
              }
              point.push(self.dom.nodeIndex(childNodes[offset], normalized) + after);
            }
            for (; container && container != root; container = container.parentNode) {
              point.push(self.dom.nodeIndex(container, normalized));
            }
            return point;
          }
          bookmark.start = getPoint(rng, true);
          if (!self.isCollapsed()) {
            bookmark.end = getPoint(rng);
          }
          return bookmark;
        }
        if (type == 2) {
          element = self.getNode();
          name = element ? element.nodeName : null;
          if (name == 'IMG') {
            return {
              name: name,
              index: findIndex(name, element)
            };
          }
          if (self.tridentSel) {
            return self.tridentSel.getBookmark(type);
          }
          return getLocation();
        }
        if (type) {
          return { rng: self.getRng() };
        }
        rng = self.getRng();
        id = dom.uniqueId();
        collapsed = self.isCollapsed();
        styles = 'overflow:hidden;line-height:0px';
        if (rng.duplicate || rng.item) {
          if (!rng.item) {
            rng2 = rng.duplicate();
            try {
              rng.collapse();
              rng.pasteHTML('<span data-mce-type="bookmark" id="' + id + '_start" style="' + styles + '">' + chr + '</span>');
              if (!collapsed) {
                rng2.collapse(false);
                rng.moveToElementText(rng2.parentElement());
                if (rng.compareEndPoints('StartToEnd', rng2) === 0) {
                  rng2.move('character', -1);
                }
                rng2.pasteHTML('<span data-mce-type="bookmark" id="' + id + '_end" style="' + styles + '">' + chr + '</span>');
              }
            } catch (ex) {
              return null;
            }
          } else {
            element = rng.item(0);
            name = element.nodeName;
            return {
              name: name,
              index: findIndex(name, element)
            };
          }
        } else {
          element = self.getNode();
          name = element.nodeName;
          if (name == 'IMG') {
            return {
              name: name,
              index: findIndex(name, element)
            };
          }
          rng2 = normalizeTableCellSelection(rng.cloneRange());
          if (!collapsed) {
            rng2.collapse(false);
            rng2.insertNode(dom.create('span', {
              'data-mce-type': 'bookmark',
              id: id + '_end',
              style: styles
            }, chr));
          }
          rng = normalizeTableCellSelection(rng);
          rng.collapse(true);
          rng.insertNode(dom.create('span', {
            'data-mce-type': 'bookmark',
            id: id + '_start',
            style: styles
          }, chr));
        }
        self.moveToBookmark({
          id: id,
          keep: 1
        });
        return { id: id };
      },
      moveToBookmark: function (bookmark) {
        var self = this, dom = self.dom, rng, root, startContainer, endContainer, startOffset, endOffset;
        function setEndPoint(start) {
          var point = bookmark[start ? 'start' : 'end'], i, node, offset, children;
          if (point) {
            offset = point[0];
            for (node = root, i = point.length - 1; i >= 1; i--) {
              children = node.childNodes;
              if (point[i] > children.length - 1) {
                return;
              }
              node = children[point[i]];
            }
            if (node.nodeType === 3) {
              offset = Math.min(point[0], node.nodeValue.length);
            }
            if (node.nodeType === 1) {
              offset = Math.min(point[0], node.childNodes.length);
            }
            if (start) {
              rng.setStart(node, offset);
            } else {
              rng.setEnd(node, offset);
            }
          }
          return true;
        }
        function restoreEndPoint(suffix) {
          var marker = dom.get(bookmark.id + '_' + suffix), node, idx, next, prev, keep = bookmark.keep;
          if (marker) {
            node = marker.parentNode;
            if (suffix == 'start') {
              if (!keep) {
                idx = dom.nodeIndex(marker);
              } else {
                node = marker.firstChild;
                idx = 1;
              }
              startContainer = endContainer = node;
              startOffset = endOffset = idx;
            } else {
              if (!keep) {
                idx = dom.nodeIndex(marker);
              } else {
                node = marker.firstChild;
                idx = 1;
              }
              endContainer = node;
              endOffset = idx;
            }
            if (!keep) {
              prev = marker.previousSibling;
              next = marker.nextSibling;
              each(grep(marker.childNodes), function (node) {
                if (node.nodeType == 3) {
                  node.nodeValue = node.nodeValue.replace(/\uFEFF/g, '');
                }
              });
              while (marker = dom.get(bookmark.id + '_' + suffix)) {
                dom.remove(marker, 1);
              }
              if (prev && next && prev.nodeType == next.nodeType && prev.nodeType == 3 && !isOpera) {
                idx = prev.nodeValue.length;
                prev.appendData(next.nodeValue);
                dom.remove(next);
                if (suffix == 'start') {
                  startContainer = endContainer = prev;
                  startOffset = endOffset = idx;
                } else {
                  endContainer = prev;
                  endOffset = idx;
                }
              }
            }
          }
        }
        function addBogus(node) {
          if (dom.isBlock(node) && !node.innerHTML && !isIE) {
            node.innerHTML = '<br data-mce-bogus="1" />';
          }
          return node;
        }
        if (bookmark) {
          if (bookmark.start) {
            rng = dom.createRng();
            root = dom.getRoot();
            if (self.tridentSel) {
              return self.tridentSel.moveToBookmark(bookmark);
            }
            if (setEndPoint(true) && setEndPoint()) {
              self.setRng(rng);
            }
          } else if (bookmark.id) {
            restoreEndPoint('start');
            restoreEndPoint('end');
            if (startContainer) {
              rng = dom.createRng();
              rng.setStart(addBogus(startContainer), startOffset);
              rng.setEnd(addBogus(endContainer), endOffset);
              self.setRng(rng);
            }
          } else if (bookmark.name) {
            self.select(dom.select(bookmark.name)[bookmark.index]);
          } else if (bookmark.rng) {
            self.setRng(bookmark.rng);
          }
        }
      },
      select: function (node, content) {
        var self = this, dom = self.dom, rng = dom.createRng(), idx;
        self.lastFocusBookmark = null;
        if (node) {
          if (!content && self.controlSelection.controlSelect(node)) {
            return;
          }
          idx = dom.nodeIndex(node);
          rng.setStart(node.parentNode, idx);
          rng.setEnd(node.parentNode, idx + 1);
          if (content) {
            self._moveEndPoint(rng, node, true);
            self._moveEndPoint(rng, node);
          }
          self.setRng(rng);
        }
        return node;
      },
      isCollapsed: function () {
        var self = this, rng = self.getRng(), sel = self.getSel();
        if (!rng || rng.item) {
          return false;
        }
        if (rng.compareEndPoints) {
          return rng.compareEndPoints('StartToEnd', rng) === 0;
        }
        return !sel || rng.collapsed;
      },
      collapse: function (to_start) {
        var self = this, rng = self.getRng(), node;
        if (rng.item) {
          node = rng.item(0);
          rng = self.win.document.body.createTextRange();
          rng.moveToElementText(node);
        }
        rng.collapse(!!to_start);
        self.setRng(rng);
      },
      getSel: function () {
        var win = this.win;
        return win.getSelection ? win.getSelection() : win.document.selection;
      },
      getRng: function (w3c) {
        var self = this, selection, rng, elm, doc = self.win.document, ieRng;
        function tryCompareBounderyPoints(how, sourceRange, destinationRange) {
          try {
            return sourceRange.compareBoundaryPoints(how, destinationRange);
          } catch (ex) {
            return -1;
          }
        }
        if (!w3c && self.lastFocusBookmark) {
          var bookmark = self.lastFocusBookmark;
          if (bookmark.startContainer) {
            rng = doc.createRange();
            rng.setStart(bookmark.startContainer, bookmark.startOffset);
            rng.setEnd(bookmark.endContainer, bookmark.endOffset);
          } else {
            rng = bookmark;
          }
          return rng;
        }
        if (w3c && self.tridentSel) {
          return self.tridentSel.getRangeAt(0);
        }
        try {
          if (selection = self.getSel()) {
            if (selection.rangeCount > 0) {
              rng = selection.getRangeAt(0);
            } else {
              rng = selection.createRange ? selection.createRange() : doc.createRange();
            }
          }
        } catch (ex) {
        }
        if (isIE && rng && rng.setStart && doc.selection) {
          try {
            ieRng = doc.selection.createRange();
          } catch (ex) {
          }
          if (ieRng && ieRng.item) {
            elm = ieRng.item(0);
            rng = doc.createRange();
            rng.setStartBefore(elm);
            rng.setEndAfter(elm);
          }
        }
        if (!rng) {
          rng = doc.createRange ? doc.createRange() : doc.body.createTextRange();
        }
        if (rng.setStart && rng.startContainer.nodeType === 9 && rng.collapsed) {
          elm = self.dom.getRoot();
          rng.setStart(elm, 0);
          rng.setEnd(elm, 0);
        }
        if (self.selectedRange && self.explicitRange) {
          if (tryCompareBounderyPoints(rng.START_TO_START, rng, self.selectedRange) === 0 && tryCompareBounderyPoints(rng.END_TO_END, rng, self.selectedRange) === 0) {
            rng = self.explicitRange;
          } else {
            self.selectedRange = null;
            self.explicitRange = null;
          }
        }
        return rng;
      },
      setRng: function (rng, forward) {
        var self = this, sel;
        if (rng.select) {
          try {
            rng.select();
          } catch (ex) {
          }
          return;
        }
        if (!self.tridentSel) {
          sel = self.getSel();
          if (sel) {
            self.explicitRange = rng;
            try {
              sel.removeAllRanges();
              sel.addRange(rng);
            } catch (ex) {
            }
            if (forward === false && sel.extend) {
              sel.collapse(rng.endContainer, rng.endOffset);
              sel.extend(rng.startContainer, rng.startOffset);
            }
            self.selectedRange = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
          }
        } else {
          if (rng.cloneRange) {
            try {
              self.tridentSel.addRange(rng);
              return;
            } catch (ex) {
            }
          }
        }
      },
      setNode: function (elm) {
        var self = this;
        self.setContent(self.dom.getOuterHTML(elm));
        return elm;
      },
      getNode: function () {
        var self = this, rng = self.getRng(), elm;
        var startContainer = rng.startContainer, endContainer = rng.endContainer;
        var startOffset = rng.startOffset, endOffset = rng.endOffset, root = self.dom.getRoot();
        function skipEmptyTextNodes(node, forwards) {
          var orig = node;
          while (node && node.nodeType === 3 && node.length === 0) {
            node = forwards ? node.nextSibling : node.previousSibling;
          }
          return node || orig;
        }
        if (!rng) {
          return root;
        }
        if (rng.setStart) {
          elm = rng.commonAncestorContainer;
          if (!rng.collapsed) {
            if (startContainer == endContainer) {
              if (endOffset - startOffset < 2) {
                if (startContainer.hasChildNodes()) {
                  elm = startContainer.childNodes[startOffset];
                }
              }
            }
            if (startContainer.nodeType === 3 && endContainer.nodeType === 3) {
              if (startContainer.length === startOffset) {
                startContainer = skipEmptyTextNodes(startContainer.nextSibling, true);
              } else {
                startContainer = startContainer.parentNode;
              }
              if (endOffset === 0) {
                endContainer = skipEmptyTextNodes(endContainer.previousSibling, false);
              } else {
                endContainer = endContainer.parentNode;
              }
              if (startContainer && startContainer === endContainer) {
                return startContainer;
              }
            }
          }
          if (elm && elm.nodeType == 3) {
            return elm.parentNode;
          }
          return elm;
        }
        elm = rng.item ? rng.item(0) : rng.parentElement();
        if (elm.ownerDocument !== self.win.document) {
          elm = root;
        }
        return elm;
      },
      getSelectedBlocks: function (startElm, endElm) {
        var self = this, dom = self.dom, node, root, selectedBlocks = [];
        root = dom.getRoot();
        startElm = dom.getParent(startElm || self.getStart(), dom.isBlock);
        endElm = dom.getParent(endElm || self.getEnd(), dom.isBlock);
        if (startElm && startElm != root) {
          selectedBlocks.push(startElm);
        }
        if (startElm && endElm && startElm != endElm) {
          node = startElm;
          var walker = new TreeWalker(startElm, root);
          while ((node = walker.next()) && node != endElm) {
            if (dom.isBlock(node)) {
              selectedBlocks.push(node);
            }
          }
        }
        if (endElm && startElm != endElm && endElm != root) {
          selectedBlocks.push(endElm);
        }
        return selectedBlocks;
      },
      isForward: function () {
        var dom = this.dom, sel = this.getSel(), anchorRange, focusRange;
        if (!sel || !sel.anchorNode || !sel.focusNode) {
          return true;
        }
        anchorRange = dom.createRng();
        anchorRange.setStart(sel.anchorNode, sel.anchorOffset);
        anchorRange.collapse(true);
        focusRange = dom.createRng();
        focusRange.setStart(sel.focusNode, sel.focusOffset);
        focusRange.collapse(true);
        return anchorRange.compareBoundaryPoints(anchorRange.START_TO_START, focusRange) <= 0;
      },
      normalize: function () {
        var self = this, rng = self.getRng();
        if (!isIE && new RangeUtils(self.dom).normalize(rng)) {
          self.setRng(rng, self.isForward());
        }
        return rng;
      },
      selectorChanged: function (selector, callback) {
        var self = this, currentSelectors;
        if (!self.selectorChangedData) {
          self.selectorChangedData = {};
          currentSelectors = {};
          self.editor.on('NodeChange', function (e) {
            var node = e.element, dom = self.dom, parents = dom.getParents(node, null, dom.getRoot()), matchedSelectors = {};
            each(self.selectorChangedData, function (callbacks, selector) {
              each(parents, function (node) {
                if (dom.is(node, selector)) {
                  if (!currentSelectors[selector]) {
                    each(callbacks, function (callback) {
                      callback(true, {
                        node: node,
                        selector: selector,
                        parents: parents
                      });
                    });
                    currentSelectors[selector] = callbacks;
                  }
                  matchedSelectors[selector] = callbacks;
                  return false;
                }
              });
            });
            each(currentSelectors, function (callbacks, selector) {
              if (!matchedSelectors[selector]) {
                delete currentSelectors[selector];
                each(callbacks, function (callback) {
                  callback(false, {
                    node: node,
                    selector: selector,
                    parents: parents
                  });
                });
              }
            });
          });
        }
        if (!self.selectorChangedData[selector]) {
          self.selectorChangedData[selector] = [];
        }
        self.selectorChangedData[selector].push(callback);
        return self;
      },
      getScrollContainer: function () {
        var scrollContainer, node = this.dom.getRoot();
        while (node && node.nodeName != 'BODY') {
          if (node.scrollHeight > node.clientHeight) {
            scrollContainer = node;
            break;
          }
          node = node.parentNode;
        }
        return scrollContainer;
      },
      scrollIntoView: function (elm) {
        var y, viewPort, self = this, dom = self.dom, root = dom.getRoot(), viewPortY, viewPortH;
        function getPos(elm) {
          var x = 0, y = 0;
          var offsetParent = elm;
          while (offsetParent && offsetParent.nodeType) {
            x += offsetParent.offsetLeft || 0;
            y += offsetParent.offsetTop || 0;
            offsetParent = offsetParent.offsetParent;
          }
          return {
            x: x,
            y: y
          };
        }
        if (root.nodeName != 'BODY') {
          var scrollContainer = self.getScrollContainer();
          if (scrollContainer) {
            y = getPos(elm).y - getPos(scrollContainer).y;
            viewPortH = scrollContainer.clientHeight;
            viewPortY = scrollContainer.scrollTop;
            if (y < viewPortY || y + 25 > viewPortY + viewPortH) {
              scrollContainer.scrollTop = y < viewPortY ? y : y - viewPortH + 25;
            }
            return;
          }
        }
        viewPort = dom.getViewPort(self.editor.getWin());
        y = dom.getPos(elm).y;
        viewPortY = viewPort.y;
        viewPortH = viewPort.h;
        if (y < viewPort.y || y + 25 > viewPortY + viewPortH) {
          self.editor.getWin().scrollTo(0, y < viewPortY ? y : y - viewPortH + 25);
        }
      },
      _moveEndPoint: function (rng, node, start) {
        var root = node, walker = new TreeWalker(node, root);
        var nonEmptyElementsMap = this.dom.schema.getNonEmptyElements();
        do {
          if (node.nodeType == 3 && trim(node.nodeValue).length !== 0) {
            if (start) {
              rng.setStart(node, 0);
            } else {
              rng.setEnd(node, node.nodeValue.length);
            }
            return;
          }
          if (nonEmptyElementsMap[node.nodeName]) {
            if (start) {
              rng.setStartBefore(node);
            } else {
              if (node.nodeName == 'BR') {
                rng.setEndBefore(node);
              } else {
                rng.setEndAfter(node);
              }
            }
            return;
          }
          if (Env.ie && Env.ie < 11 && this.dom.isBlock(node) && this.dom.isEmpty(node)) {
            if (start) {
              rng.setStart(node, 0);
            } else {
              rng.setEnd(node, 0);
            }
            return;
          }
        } while (node = start ? walker.next() : walker.prev());
        if (root.nodeName == 'BODY') {
          if (start) {
            rng.setStart(root, 0);
          } else {
            rng.setEnd(root, root.childNodes.length);
          }
        }
      },
      destroy: function () {
        this.win = null;
        this.controlSelection.destroy();
      }
    };
    return Selection;
  });
  define('tinymce/Formatter', [
    'tinymce/dom/TreeWalker',
    'tinymce/dom/RangeUtils',
    'tinymce/util/Tools'
  ], function (TreeWalker, RangeUtils, Tools) {
    return function (ed) {
      var formats = {}, dom = ed.dom, selection = ed.selection, rangeUtils = new RangeUtils(dom), isValid = ed.schema.isValidChild, isBlock = dom.isBlock, forcedRootBlock = ed.settings.forced_root_block, nodeIndex = dom.nodeIndex, INVISIBLE_CHAR = '\ufeff', MCE_ATTR_RE = /^(src|href|style)$/, FALSE = false, TRUE = true, formatChangeData, undef, getContentEditable = dom.getContentEditable, disableCaretContainer, markCaretContainersBogus;
      var each = Tools.each, grep = Tools.grep, walk = Tools.walk, extend = Tools.extend;
      function isTextBlock(name) {
        if (name.nodeType) {
          name = name.nodeName;
        }
        return !!ed.schema.getTextBlockElements()[name.toLowerCase()];
      }
      function getParents(node, selector) {
        return dom.getParents(node, selector, dom.getRoot());
      }
      function isCaretNode(node) {
        return node.nodeType === 1 && node.id === '_mce_caret';
      }
      function defaultFormats() {
        register({
          alignleft: [
            {
              selector: 'figure,p,h1,h2,h3,h4,h5,h6,td,th,tr,div,ul,ol,li',
              styles: { textAlign: 'left' },
              defaultBlock: 'div'
            },
            {
              selector: 'img,table',
              collapsed: false,
              styles: { 'float': 'left' }
            }
          ],
          aligncenter: [
            {
              selector: 'figure,p,h1,h2,h3,h4,h5,h6,td,th,tr,div,ul,ol,li',
              styles: { textAlign: 'center' },
              defaultBlock: 'div'
            },
            {
              selector: 'img',
              collapsed: false,
              styles: {
                display: 'block',
                marginLeft: 'auto',
                marginRight: 'auto'
              }
            },
            {
              selector: 'table',
              collapsed: false,
              styles: {
                marginLeft: 'auto',
                marginRight: 'auto'
              }
            }
          ],
          alignright: [
            {
              selector: 'figure,p,h1,h2,h3,h4,h5,h6,td,th,tr,div,ul,ol,li',
              styles: { textAlign: 'right' },
              defaultBlock: 'div'
            },
            {
              selector: 'img,table',
              collapsed: false,
              styles: { 'float': 'right' }
            }
          ],
          alignjustify: [{
              selector: 'figure,p,h1,h2,h3,h4,h5,h6,td,th,tr,div,ul,ol,li',
              styles: { textAlign: 'justify' },
              defaultBlock: 'div'
            }],
          bold: [
            {
              inline: 'strong',
              remove: 'all'
            },
            {
              inline: 'span',
              styles: { fontWeight: 'bold' }
            },
            {
              inline: 'b',
              remove: 'all'
            }
          ],
          italic: [
            {
              inline: 'em',
              remove: 'all'
            },
            {
              inline: 'span',
              styles: { fontStyle: 'italic' }
            },
            {
              inline: 'i',
              remove: 'all'
            }
          ],
          underline: [
            {
              inline: 'span',
              styles: { textDecoration: 'underline' },
              exact: true
            },
            {
              inline: 'u',
              remove: 'all'
            }
          ],
          strikethrough: [
            {
              inline: 'span',
              styles: { textDecoration: 'line-through' },
              exact: true
            },
            {
              inline: 'strike',
              remove: 'all'
            }
          ],
          forecolor: {
            inline: 'span',
            styles: { color: '%value' },
            wrap_links: false
          },
          hilitecolor: {
            inline: 'span',
            styles: { backgroundColor: '%value' },
            wrap_links: false
          },
          fontname: {
            inline: 'span',
            styles: { fontFamily: '%value' }
          },
          fontsize: {
            inline: 'span',
            styles: { fontSize: '%value' }
          },
          fontsize_class: {
            inline: 'span',
            attributes: { 'class': '%value' }
          },
          blockquote: {
            block: 'blockquote',
            wrapper: 1,
            remove: 'all'
          },
          subscript: { inline: 'sub' },
          superscript: { inline: 'sup' },
          code: { inline: 'code' },
          link: {
            inline: 'a',
            selector: 'a',
            remove: 'all',
            split: true,
            deep: true,
            onmatch: function () {
              return true;
            },
            onformat: function (elm, fmt, vars) {
              each(vars, function (value, key) {
                dom.setAttrib(elm, key, value);
              });
            }
          },
          removeformat: [
            {
              selector: 'b,strong,em,i,font,u,strike,sub,sup,dfn,code,samp,kbd,var,cite,mark,q',
              remove: 'all',
              split: true,
              expand: false,
              block_expand: true,
              deep: true
            },
            {
              selector: 'span',
              attributes: [
                'style',
                'class'
              ],
              remove: 'empty',
              split: true,
              expand: false,
              deep: true
            },
            {
              selector: '*',
              attributes: [
                'style',
                'class'
              ],
              split: false,
              expand: false,
              deep: true
            }
          ]
        });
        each('p h1 h2 h3 h4 h5 h6 div address pre div dt dd samp'.split(/\s/), function (name) {
          register(name, {
            block: name,
            remove: 'all'
          });
        });
        register(ed.settings.formats);
      }
      function addKeyboardShortcuts() {
        ed.addShortcut('ctrl+b', 'bold_desc', 'Bold');
        ed.addShortcut('ctrl+i', 'italic_desc', 'Italic');
        ed.addShortcut('ctrl+u', 'underline_desc', 'Underline');
        for (var i = 1; i <= 6; i++) {
          ed.addShortcut('ctrl+' + i, '', [
            'FormatBlock',
            false,
            'h' + i
          ]);
        }
        ed.addShortcut('ctrl+7', '', [
          'FormatBlock',
          false,
          'p'
        ]);
        ed.addShortcut('ctrl+8', '', [
          'FormatBlock',
          false,
          'div'
        ]);
        ed.addShortcut('ctrl+9', '', [
          'FormatBlock',
          false,
          'address'
        ]);
      }
      function get(name) {
        return name ? formats[name] : formats;
      }
      function register(name, format) {
        if (name) {
          if (typeof name !== 'string') {
            each(name, function (format, name) {
              register(name, format);
            });
          } else {
            format = format.length ? format : [format];
            each(format, function (format) {
              if (format.deep === undef) {
                format.deep = !format.selector;
              }
              if (format.split === undef) {
                format.split = !format.selector || format.inline;
              }
              if (format.remove === undef && format.selector && !format.inline) {
                format.remove = 'none';
              }
              if (format.selector && format.inline) {
                format.mixed = true;
                format.block_expand = true;
              }
              if (typeof format.classes === 'string') {
                format.classes = format.classes.split(/\s+/);
              }
            });
            formats[name] = format;
          }
        }
      }
      function getTextDecoration(node) {
        var decoration;
        ed.dom.getParent(node, function (n) {
          decoration = ed.dom.getStyle(n, 'text-decoration');
          return decoration && decoration !== 'none';
        });
        return decoration;
      }
      function processUnderlineAndColor(node) {
        var textDecoration;
        if (node.nodeType === 1 && node.parentNode && node.parentNode.nodeType === 1) {
          textDecoration = getTextDecoration(node.parentNode);
          if (ed.dom.getStyle(node, 'color') && textDecoration) {
            ed.dom.setStyle(node, 'text-decoration', textDecoration);
          } else if (ed.dom.getStyle(node, 'textdecoration') === textDecoration) {
            ed.dom.setStyle(node, 'text-decoration', null);
          }
        }
      }
      function apply(name, vars, node) {
        var formatList = get(name), format = formatList[0], bookmark, rng, isCollapsed = !node && selection.isCollapsed();
        function setElementFormat(elm, fmt) {
          fmt = fmt || format;
          if (elm) {
            if (fmt.onformat) {
              fmt.onformat(elm, fmt, vars, node);
            }
            each(fmt.styles, function (value, name) {
              dom.setStyle(elm, name, replaceVars(value, vars));
            });
            each(fmt.attributes, function (value, name) {
              dom.setAttrib(elm, name, replaceVars(value, vars));
            });
            each(fmt.classes, function (value) {
              value = replaceVars(value, vars);
              if (!dom.hasClass(elm, value)) {
                dom.addClass(elm, value);
              }
            });
          }
        }
        function adjustSelectionToVisibleSelection() {
          function findSelectionEnd(start, end) {
            var walker = new TreeWalker(end);
            for (node = walker.current(); node; node = walker.prev()) {
              if (node.childNodes.length > 1 || node == start || node.tagName == 'BR') {
                return node;
              }
            }
          }
          var rng = ed.selection.getRng();
          var start = rng.startContainer;
          var end = rng.endContainer;
          if (start != end && rng.endOffset === 0) {
            var newEnd = findSelectionEnd(start, end);
            var endOffset = newEnd.nodeType == 3 ? newEnd.length : newEnd.childNodes.length;
            rng.setEnd(newEnd, endOffset);
          }
          return rng;
        }
        function applyStyleToList(node, bookmark, wrapElm, newWrappers, process) {
          var nodes = [], listIndex = -1, list, startIndex = -1, endIndex = -1, currentWrapElm;
          each(node.childNodes, function (n, index) {
            if (n.nodeName === 'UL' || n.nodeName === 'OL') {
              listIndex = index;
              list = n;
              return false;
            }
          });
          each(node.childNodes, function (n, index) {
            if (n.nodeName === 'SPAN' && dom.getAttrib(n, 'data-mce-type') == 'bookmark') {
              if (n.id == bookmark.id + '_start') {
                startIndex = index;
              } else if (n.id == bookmark.id + '_end') {
                endIndex = index;
              }
            }
          });
          if (listIndex <= 0 || startIndex < listIndex && endIndex > listIndex) {
            each(grep(node.childNodes), process);
            return 0;
          } else {
            currentWrapElm = dom.clone(wrapElm, FALSE);
            each(grep(node.childNodes), function (n, index) {
              if (startIndex < listIndex && index < listIndex || startIndex > listIndex && index > listIndex) {
                nodes.push(n);
                n.parentNode.removeChild(n);
              }
            });
            if (startIndex < listIndex) {
              node.insertBefore(currentWrapElm, list);
            } else if (startIndex > listIndex) {
              node.insertBefore(currentWrapElm, list.nextSibling);
            }
            newWrappers.push(currentWrapElm);
            each(nodes, function (node) {
              currentWrapElm.appendChild(node);
            });
            return currentWrapElm;
          }
        }
        function applyRngStyle(rng, bookmark, node_specific) {
          var newWrappers = [], wrapName, wrapElm, contentEditable = true;
          wrapName = format.inline || format.block;
          wrapElm = dom.create(wrapName);
          setElementFormat(wrapElm);
          rangeUtils.walk(rng, function (nodes) {
            var currentWrapElm;
            function process(node) {
              var nodeName, parentName, found, hasContentEditableState, lastContentEditable;
              lastContentEditable = contentEditable;
              nodeName = node.nodeName.toLowerCase();
              parentName = node.parentNode.nodeName.toLowerCase();
              if (node.nodeType === 1 && getContentEditable(node)) {
                lastContentEditable = contentEditable;
                contentEditable = getContentEditable(node) === 'true';
                hasContentEditableState = true;
              }
              if (isEq(nodeName, 'br')) {
                currentWrapElm = 0;
                if (format.block) {
                  dom.remove(node);
                }
                return;
              }
              if (format.wrapper && matchNode(node, name, vars)) {
                currentWrapElm = 0;
                return;
              }
              if (contentEditable && !hasContentEditableState && format.block && !format.wrapper && isTextBlock(nodeName) && isValid(parentName, wrapName)) {
                node = dom.rename(node, wrapName);
                setElementFormat(node);
                newWrappers.push(node);
                currentWrapElm = 0;
                return;
              }
              if (format.selector) {
                each(formatList, function (format) {
                  if ('collapsed' in format && format.collapsed !== isCollapsed) {
                    return;
                  }
                  if (dom.is(node, format.selector) && !isCaretNode(node)) {
                    setElementFormat(node, format);
                    found = true;
                  }
                });
                if (!format.inline || found) {
                  currentWrapElm = 0;
                  return;
                }
              }
              if (contentEditable && !hasContentEditableState && isValid(wrapName, nodeName) && isValid(parentName, wrapName) && !(!node_specific && node.nodeType === 3 && node.nodeValue.length === 1 && node.nodeValue.charCodeAt(0) === 65279) && !isCaretNode(node) && (!format.inline || !isBlock(node))) {
                if (!currentWrapElm) {
                  currentWrapElm = dom.clone(wrapElm, FALSE);
                  node.parentNode.insertBefore(currentWrapElm, node);
                  newWrappers.push(currentWrapElm);
                }
                currentWrapElm.appendChild(node);
              } else if (nodeName == 'li' && bookmark) {
                currentWrapElm = applyStyleToList(node, bookmark, wrapElm, newWrappers, process);
              } else {
                currentWrapElm = 0;
                each(grep(node.childNodes), process);
                if (hasContentEditableState) {
                  contentEditable = lastContentEditable;
                }
                currentWrapElm = 0;
              }
            }
            each(nodes, process);
          });
          if (format.wrap_links === false) {
            each(newWrappers, function (node) {
              function process(node) {
                var i, currentWrapElm, children;
                if (node.nodeName === 'A') {
                  currentWrapElm = dom.clone(wrapElm, FALSE);
                  newWrappers.push(currentWrapElm);
                  children = grep(node.childNodes);
                  for (i = 0; i < children.length; i++) {
                    currentWrapElm.appendChild(children[i]);
                  }
                  node.appendChild(currentWrapElm);
                }
                each(grep(node.childNodes), process);
              }
              process(node);
            });
          }
          each(newWrappers, function (node) {
            var childCount;
            function getChildCount(node) {
              var count = 0;
              each(node.childNodes, function (node) {
                if (!isWhiteSpaceNode(node) && !isBookmarkNode(node)) {
                  count++;
                }
              });
              return count;
            }
            function mergeStyles(node) {
              var child, clone;
              each(node.childNodes, function (node) {
                if (node.nodeType == 1 && !isBookmarkNode(node) && !isCaretNode(node)) {
                  child = node;
                  return FALSE;
                }
              });
              if (child && !isBookmarkNode(child) && matchName(child, format)) {
                clone = dom.clone(child, FALSE);
                setElementFormat(clone);
                dom.replace(clone, node, TRUE);
                dom.remove(child, 1);
              }
              return clone || node;
            }
            childCount = getChildCount(node);
            if ((newWrappers.length > 1 || !isBlock(node)) && childCount === 0) {
              dom.remove(node, 1);
              return;
            }
            if (format.inline || format.wrapper) {
              if (!format.exact && childCount === 1) {
                node = mergeStyles(node);
              }
              each(formatList, function (format) {
                each(dom.select(format.inline, node), function (child) {
                  var parent;
                  if (isBookmarkNode(child)) {
                    return;
                  }
                  if (format.wrap_links === false) {
                    parent = child.parentNode;
                    do {
                      if (parent.nodeName === 'A') {
                        return;
                      }
                    } while (parent = parent.parentNode);
                  }
                  removeFormat(format, vars, child, format.exact ? child : null);
                });
              });
              if (matchNode(node.parentNode, name, vars)) {
                dom.remove(node, 1);
                node = 0;
                return TRUE;
              }
              if (format.merge_with_parents) {
                dom.getParent(node.parentNode, function (parent) {
                  if (matchNode(parent, name, vars)) {
                    dom.remove(node, 1);
                    node = 0;
                    return TRUE;
                  }
                });
              }
              if (node && format.merge_siblings !== false) {
                node = mergeSiblings(getNonWhiteSpaceSibling(node), node);
                node = mergeSiblings(node, getNonWhiteSpaceSibling(node, TRUE));
              }
            }
          });
        }
        if (format) {
          if (node) {
            if (node.nodeType) {
              rng = dom.createRng();
              rng.setStartBefore(node);
              rng.setEndAfter(node);
              applyRngStyle(expandRng(rng, formatList), null, true);
            } else {
              applyRngStyle(node, null, true);
            }
          } else {
            if (!isCollapsed || !format.inline || dom.select('td.mce-item-selected,th.mce-item-selected').length) {
              var curSelNode = ed.selection.getNode();
              if (!forcedRootBlock && formatList[0].defaultBlock && !dom.getParent(curSelNode, dom.isBlock)) {
                apply(formatList[0].defaultBlock);
              }
              ed.selection.setRng(adjustSelectionToVisibleSelection());
              bookmark = selection.getBookmark();
              applyRngStyle(expandRng(selection.getRng(TRUE), formatList), bookmark);
              if (format.styles && (format.styles.color || format.styles.textDecoration)) {
                walk(curSelNode, processUnderlineAndColor, 'childNodes');
                processUnderlineAndColor(curSelNode);
              }
              selection.moveToBookmark(bookmark);
              moveStart(selection.getRng(TRUE));
              ed.nodeChanged();
            } else {
              performCaretAction('apply', name, vars);
            }
          }
        }
      }
      function remove(name, vars, node) {
        var formatList = get(name), format = formatList[0], bookmark, rng, contentEditable = true;
        function process(node) {
          var children, i, l, lastContentEditable, hasContentEditableState;
          if (node.nodeType === 1 && getContentEditable(node)) {
            lastContentEditable = contentEditable;
            contentEditable = getContentEditable(node) === 'true';
            hasContentEditableState = true;
          }
          children = grep(node.childNodes);
          if (contentEditable && !hasContentEditableState) {
            for (i = 0, l = formatList.length; i < l; i++) {
              if (removeFormat(formatList[i], vars, node, node)) {
                break;
              }
            }
          }
          if (format.deep) {
            if (children.length) {
              for (i = 0, l = children.length; i < l; i++) {
                process(children[i]);
              }
              if (hasContentEditableState) {
                contentEditable = lastContentEditable;
              }
            }
          }
        }
        function findFormatRoot(container) {
          var formatRoot;
          each(getParents(container.parentNode).reverse(), function (parent) {
            var format;
            if (!formatRoot && parent.id != '_start' && parent.id != '_end') {
              format = matchNode(parent, name, vars);
              if (format && format.split !== false) {
                formatRoot = parent;
              }
            }
          });
          return formatRoot;
        }
        function wrapAndSplit(format_root, container, target, split) {
          var parent, clone, lastClone, firstClone, i, formatRootParent;
          if (format_root) {
            formatRootParent = format_root.parentNode;
            for (parent = container.parentNode; parent && parent != formatRootParent; parent = parent.parentNode) {
              clone = dom.clone(parent, FALSE);
              for (i = 0; i < formatList.length; i++) {
                if (removeFormat(formatList[i], vars, clone, clone)) {
                  clone = 0;
                  break;
                }
              }
              if (clone) {
                if (lastClone) {
                  clone.appendChild(lastClone);
                }
                if (!firstClone) {
                  firstClone = clone;
                }
                lastClone = clone;
              }
            }
            if (split && (!format.mixed || !isBlock(format_root))) {
              container = dom.split(format_root, container);
            }
            if (lastClone) {
              target.parentNode.insertBefore(lastClone, target);
              firstClone.appendChild(target);
            }
          }
          return container;
        }
        function splitToFormatRoot(container) {
          return wrapAndSplit(findFormatRoot(container), container, container, true);
        }
        function unwrap(start) {
          var node = dom.get(start ? '_start' : '_end'), out = node[start ? 'firstChild' : 'lastChild'];
          if (isBookmarkNode(out)) {
            out = out[start ? 'firstChild' : 'lastChild'];
          }
          dom.remove(node, true);
          return out;
        }
        function removeRngStyle(rng) {
          var startContainer, endContainer;
          var commonAncestorContainer = rng.commonAncestorContainer;
          rng = expandRng(rng, formatList, TRUE);
          if (format.split) {
            startContainer = getContainer(rng, TRUE);
            endContainer = getContainer(rng);
            if (startContainer != endContainer) {
              if (/^(TR|TH|TD)$/.test(startContainer.nodeName) && startContainer.firstChild) {
                if (startContainer.nodeName == 'TR') {
                  startContainer = startContainer.firstChild.firstChild || startContainer;
                } else {
                  startContainer = startContainer.firstChild || startContainer;
                }
              }
              if (commonAncestorContainer && /^T(HEAD|BODY|FOOT|R)$/.test(commonAncestorContainer.nodeName) && /^(TH|TD)$/.test(endContainer.nodeName) && endContainer.firstChild) {
                endContainer = endContainer.firstChild || endContainer;
              }
              startContainer = wrap(startContainer, 'span', {
                id: '_start',
                'data-mce-type': 'bookmark'
              });
              endContainer = wrap(endContainer, 'span', {
                id: '_end',
                'data-mce-type': 'bookmark'
              });
              splitToFormatRoot(startContainer);
              splitToFormatRoot(endContainer);
              startContainer = unwrap(TRUE);
              endContainer = unwrap();
            } else {
              startContainer = endContainer = splitToFormatRoot(startContainer);
            }
            rng.startContainer = startContainer.parentNode;
            rng.startOffset = nodeIndex(startContainer);
            rng.endContainer = endContainer.parentNode;
            rng.endOffset = nodeIndex(endContainer) + 1;
          }
          rangeUtils.walk(rng, function (nodes) {
            each(nodes, function (node) {
              process(node);
              if (node.nodeType === 1 && ed.dom.getStyle(node, 'text-decoration') === 'underline' && node.parentNode && getTextDecoration(node.parentNode) === 'underline') {
                removeFormat({
                  'deep': false,
                  'exact': true,
                  'inline': 'span',
                  'styles': { 'textDecoration': 'underline' }
                }, null, node);
              }
            });
          });
        }
        if (node) {
          if (node.nodeType) {
            rng = dom.createRng();
            rng.setStartBefore(node);
            rng.setEndAfter(node);
            removeRngStyle(rng);
          } else {
            removeRngStyle(node);
          }
          return;
        }
        if (!selection.isCollapsed() || !format.inline || dom.select('td.mce-item-selected,th.mce-item-selected').length) {
          bookmark = selection.getBookmark();
          removeRngStyle(selection.getRng(TRUE));
          selection.moveToBookmark(bookmark);
          if (format.inline && match(name, vars, selection.getStart())) {
            moveStart(selection.getRng(true));
          }
          ed.nodeChanged();
        } else {
          performCaretAction('remove', name, vars);
        }
      }
      function toggle(name, vars, node) {
        var fmt = get(name);
        if (match(name, vars, node) && (!('toggle' in fmt[0]) || fmt[0].toggle)) {
          remove(name, vars, node);
        } else {
          apply(name, vars, node);
        }
      }
      function matchNode(node, name, vars, similar) {
        var formatList = get(name), format, i, classes;
        function matchItems(node, format, item_name) {
          var key, value, items = format[item_name], i;
          if (format.onmatch) {
            return format.onmatch(node, format, item_name);
          }
          if (items) {
            if (items.length === undef) {
              for (key in items) {
                if (items.hasOwnProperty(key)) {
                  if (item_name === 'attributes') {
                    value = dom.getAttrib(node, key);
                  } else {
                    value = getStyle(node, key);
                  }
                  if (similar && !value && !format.exact) {
                    return;
                  }
                  if ((!similar || format.exact) && !isEq(value, normalizeStyleValue(replaceVars(items[key], vars), key))) {
                    return;
                  }
                }
              }
            } else {
              for (i = 0; i < items.length; i++) {
                if (item_name === 'attributes' ? dom.getAttrib(node, items[i]) : getStyle(node, items[i])) {
                  return format;
                }
              }
            }
          }
          return format;
        }
        if (formatList && node) {
          for (i = 0; i < formatList.length; i++) {
            format = formatList[i];
            if (matchName(node, format) && matchItems(node, format, 'attributes') && matchItems(node, format, 'styles')) {
              if (classes = format.classes) {
                for (i = 0; i < classes.length; i++) {
                  if (!dom.hasClass(node, classes[i])) {
                    return;
                  }
                }
              }
              return format;
            }
          }
        }
      }
      function match(name, vars, node) {
        var startNode;
        function matchParents(node) {
          var root = dom.getRoot();
          if (node === root) {
            return false;
          }
          node = dom.getParent(node, function (node) {
            return node.parentNode === root || !!matchNode(node, name, vars, true);
          });
          return matchNode(node, name, vars);
        }
        if (node) {
          return matchParents(node);
        }
        node = selection.getNode();
        if (matchParents(node)) {
          return TRUE;
        }
        startNode = selection.getStart();
        if (startNode != node) {
          if (matchParents(startNode)) {
            return TRUE;
          }
        }
        return FALSE;
      }
      function matchAll(names, vars) {
        var startElement, matchedFormatNames = [], checkedMap = {};
        startElement = selection.getStart();
        dom.getParent(startElement, function (node) {
          var i, name;
          for (i = 0; i < names.length; i++) {
            name = names[i];
            if (!checkedMap[name] && matchNode(node, name, vars)) {
              checkedMap[name] = true;
              matchedFormatNames.push(name);
            }
          }
        }, dom.getRoot());
        return matchedFormatNames;
      }
      function canApply(name) {
        var formatList = get(name), startNode, parents, i, x, selector;
        if (formatList) {
          startNode = selection.getStart();
          parents = getParents(startNode);
          for (x = formatList.length - 1; x >= 0; x--) {
            selector = formatList[x].selector;
            if (!selector || formatList[x].defaultBlock) {
              return TRUE;
            }
            for (i = parents.length - 1; i >= 0; i--) {
              if (dom.is(parents[i], selector)) {
                return TRUE;
              }
            }
          }
        }
        return FALSE;
      }
      function formatChanged(formats, callback, similar) {
        var currentFormats;
        if (!formatChangeData) {
          formatChangeData = {};
          currentFormats = {};
          ed.on('NodeChange', function (e) {
            var parents = getParents(e.element), matchedFormats = {};
            each(formatChangeData, function (callbacks, format) {
              each(parents, function (node) {
                if (matchNode(node, format, {}, callbacks.similar)) {
                  if (!currentFormats[format]) {
                    each(callbacks, function (callback) {
                      callback(true, {
                        node: node,
                        format: format,
                        parents: parents
                      });
                    });
                    currentFormats[format] = callbacks;
                  }
                  matchedFormats[format] = callbacks;
                  return false;
                }
              });
            });
            each(currentFormats, function (callbacks, format) {
              if (!matchedFormats[format]) {
                delete currentFormats[format];
                each(callbacks, function (callback) {
                  callback(false, {
                    node: e.element,
                    format: format,
                    parents: parents
                  });
                });
              }
            });
          });
        }
        each(formats.split(','), function (format) {
          if (!formatChangeData[format]) {
            formatChangeData[format] = [];
            formatChangeData[format].similar = similar;
          }
          formatChangeData[format].push(callback);
        });
        return this;
      }
      extend(this, {
        get: get,
        register: register,
        apply: apply,
        remove: remove,
        toggle: toggle,
        match: match,
        matchAll: matchAll,
        matchNode: matchNode,
        canApply: canApply,
        formatChanged: formatChanged
      });
      defaultFormats();
      addKeyboardShortcuts();
      ed.on('BeforeGetContent', function () {
        if (markCaretContainersBogus) {
          markCaretContainersBogus();
        }
      });
      ed.on('mouseup keydown', function (e) {
        if (disableCaretContainer) {
          disableCaretContainer(e);
        }
      });
      function matchName(node, format) {
        if (isEq(node, format.inline)) {
          return TRUE;
        }
        if (isEq(node, format.block)) {
          return TRUE;
        }
        if (format.selector) {
          return node.nodeType == 1 && dom.is(node, format.selector);
        }
      }
      function isEq(str1, str2) {
        str1 = str1 || '';
        str2 = str2 || '';
        str1 = '' + (str1.nodeName || str1);
        str2 = '' + (str2.nodeName || str2);
        return str1.toLowerCase() == str2.toLowerCase();
      }
      function getStyle(node, name) {
        return normalizeStyleValue(dom.getStyle(node, name), name);
      }
      function normalizeStyleValue(value, name) {
        if (name == 'color' || name == 'backgroundColor') {
          value = dom.toHex(value);
        }
        if (name == 'fontWeight' && value == 700) {
          value = 'bold';
        }
        if (name == 'fontFamily') {
          value = value.replace(/[\'\"]/g, '').replace(/,\s+/g, ',');
        }
        return '' + value;
      }
      function replaceVars(value, vars) {
        if (typeof value != 'string') {
          value = value(vars);
        } else if (vars) {
          value = value.replace(/%(\w+)/g, function (str, name) {
            return vars[name] || str;
          });
        }
        return value;
      }
      function isWhiteSpaceNode(node) {
        return node && node.nodeType === 3 && /^([\t \r\n]+|)$/.test(node.nodeValue);
      }
      function wrap(node, name, attrs) {
        var wrapper = dom.create(name, attrs);
        node.parentNode.insertBefore(wrapper, node);
        wrapper.appendChild(node);
        return wrapper;
      }
      function expandRng(rng, format, remove) {
        var lastIdx, leaf, endPoint, startContainer = rng.startContainer, startOffset = rng.startOffset, endContainer = rng.endContainer, endOffset = rng.endOffset;
        function findParentContainer(start) {
          var container, parent, sibling, siblingName, root;
          container = parent = start ? startContainer : endContainer;
          siblingName = start ? 'previousSibling' : 'nextSibling';
          root = dom.getRoot();
          function isBogusBr(node) {
            return node.nodeName == 'BR' && node.getAttribute('data-mce-bogus') && !node.nextSibling;
          }
          if (container.nodeType == 3 && !isWhiteSpaceNode(container)) {
            if (start ? startOffset > 0 : endOffset < container.nodeValue.length) {
              return container;
            }
          }
          while (true) {
            if (!format[0].block_expand && isBlock(parent)) {
              return parent;
            }
            for (sibling = parent[siblingName]; sibling; sibling = sibling[siblingName]) {
              if (!isBookmarkNode(sibling) && !isWhiteSpaceNode(sibling) && !isBogusBr(sibling)) {
                return parent;
              }
            }
            if (parent.parentNode == root) {
              container = parent;
              break;
            }
            parent = parent.parentNode;
          }
          return container;
        }
        function findLeaf(node, offset) {
          if (offset === undef) {
            offset = node.nodeType === 3 ? node.length : node.childNodes.length;
          }
          while (node && node.hasChildNodes()) {
            node = node.childNodes[offset];
            if (node) {
              offset = node.nodeType === 3 ? node.length : node.childNodes.length;
            }
          }
          return {
            node: node,
            offset: offset
          };
        }
        if (startContainer.nodeType == 1 && startContainer.hasChildNodes()) {
          lastIdx = startContainer.childNodes.length - 1;
          startContainer = startContainer.childNodes[startOffset > lastIdx ? lastIdx : startOffset];
          if (startContainer.nodeType == 3) {
            startOffset = 0;
          }
        }
        if (endContainer.nodeType == 1 && endContainer.hasChildNodes()) {
          lastIdx = endContainer.childNodes.length - 1;
          endContainer = endContainer.childNodes[endOffset > lastIdx ? lastIdx : endOffset - 1];
          if (endContainer.nodeType == 3) {
            endOffset = endContainer.nodeValue.length;
          }
        }
        function findParentContentEditable(node) {
          var parent = node;
          while (parent) {
            if (parent.nodeType === 1 && getContentEditable(parent)) {
              return getContentEditable(parent) === 'false' ? parent : node;
            }
            parent = parent.parentNode;
          }
          return node;
        }
        function findWordEndPoint(container, offset, start) {
          var walker, node, pos, lastTextNode;
          function findSpace(node, offset) {
            var pos, pos2, str = node.nodeValue;
            if (typeof offset == 'undefined') {
              offset = start ? str.length : 0;
            }
            if (start) {
              pos = str.lastIndexOf(' ', offset);
              pos2 = str.lastIndexOf('\xa0', offset);
              pos = pos > pos2 ? pos : pos2;
              if (pos !== -1 && !remove) {
                pos++;
              }
            } else {
              pos = str.indexOf(' ', offset);
              pos2 = str.indexOf('\xa0', offset);
              pos = pos !== -1 && (pos2 === -1 || pos < pos2) ? pos : pos2;
            }
            return pos;
          }
          if (container.nodeType === 3) {
            pos = findSpace(container, offset);
            if (pos !== -1) {
              return {
                container: container,
                offset: pos
              };
            }
            lastTextNode = container;
          }
          walker = new TreeWalker(container, dom.getParent(container, isBlock) || ed.getBody());
          while (node = walker[start ? 'prev' : 'next']()) {
            if (node.nodeType === 3) {
              lastTextNode = node;
              pos = findSpace(node);
              if (pos !== -1) {
                return {
                  container: node,
                  offset: pos
                };
              }
            } else if (isBlock(node)) {
              break;
            }
          }
          if (lastTextNode) {
            if (start) {
              offset = 0;
            } else {
              offset = lastTextNode.length;
            }
            return {
              container: lastTextNode,
              offset: offset
            };
          }
        }
        function findSelectorEndPoint(container, sibling_name) {
          var parents, i, y, curFormat;
          if (container.nodeType == 3 && container.nodeValue.length === 0 && container[sibling_name]) {
            container = container[sibling_name];
          }
          parents = getParents(container);
          for (i = 0; i < parents.length; i++) {
            for (y = 0; y < format.length; y++) {
              curFormat = format[y];
              if ('collapsed' in curFormat && curFormat.collapsed !== rng.collapsed) {
                continue;
              }
              if (dom.is(parents[i], curFormat.selector)) {
                return parents[i];
              }
            }
          }
          return container;
        }
        function findBlockEndPoint(container, sibling_name) {
          var node, root = dom.getRoot();
          if (!format[0].wrapper) {
            node = dom.getParent(container, format[0].block, root);
          }
          if (!node) {
            node = dom.getParent(container.nodeType == 3 ? container.parentNode : container, function (node) {
              return node != root && isTextBlock(node);
            });
          }
          if (node && format[0].wrapper) {
            node = getParents(node, 'ul,ol').reverse()[0] || node;
          }
          if (!node) {
            node = container;
            while (node[sibling_name] && !isBlock(node[sibling_name])) {
              node = node[sibling_name];
              if (isEq(node, 'br')) {
                break;
              }
            }
          }
          return node || container;
        }
        startContainer = findParentContentEditable(startContainer);
        endContainer = findParentContentEditable(endContainer);
        if (isBookmarkNode(startContainer.parentNode) || isBookmarkNode(startContainer)) {
          startContainer = isBookmarkNode(startContainer) ? startContainer : startContainer.parentNode;
          startContainer = startContainer.nextSibling || startContainer;
          if (startContainer.nodeType == 3) {
            startOffset = 0;
          }
        }
        if (isBookmarkNode(endContainer.parentNode) || isBookmarkNode(endContainer)) {
          endContainer = isBookmarkNode(endContainer) ? endContainer : endContainer.parentNode;
          endContainer = endContainer.previousSibling || endContainer;
          if (endContainer.nodeType == 3) {
            endOffset = endContainer.length;
          }
        }
        if (format[0].inline) {
          if (rng.collapsed) {
            endPoint = findWordEndPoint(startContainer, startOffset, true);
            if (endPoint) {
              startContainer = endPoint.container;
              startOffset = endPoint.offset;
            }
            endPoint = findWordEndPoint(endContainer, endOffset);
            if (endPoint) {
              endContainer = endPoint.container;
              endOffset = endPoint.offset;
            }
          }
          leaf = findLeaf(endContainer, endOffset);
          if (leaf.node) {
            while (leaf.node && leaf.offset === 0 && leaf.node.previousSibling) {
              leaf = findLeaf(leaf.node.previousSibling);
            }
            if (leaf.node && leaf.offset > 0 && leaf.node.nodeType === 3 && leaf.node.nodeValue.charAt(leaf.offset - 1) === ' ') {
              if (leaf.offset > 1) {
                endContainer = leaf.node;
                endContainer.splitText(leaf.offset - 1);
              }
            }
          }
        }
        if (format[0].inline || format[0].block_expand) {
          if (!format[0].inline || (startContainer.nodeType != 3 || startOffset === 0)) {
            startContainer = findParentContainer(true);
          }
          if (!format[0].inline || (endContainer.nodeType != 3 || endOffset === endContainer.nodeValue.length)) {
            endContainer = findParentContainer();
          }
        }
        if (format[0].selector && format[0].expand !== FALSE && !format[0].inline) {
          startContainer = findSelectorEndPoint(startContainer, 'previousSibling');
          endContainer = findSelectorEndPoint(endContainer, 'nextSibling');
        }
        if (format[0].block || format[0].selector) {
          startContainer = findBlockEndPoint(startContainer, 'previousSibling');
          endContainer = findBlockEndPoint(endContainer, 'nextSibling');
          if (format[0].block) {
            if (!isBlock(startContainer)) {
              startContainer = findParentContainer(true);
            }
            if (!isBlock(endContainer)) {
              endContainer = findParentContainer();
            }
          }
        }
        if (startContainer.nodeType == 1) {
          startOffset = nodeIndex(startContainer);
          startContainer = startContainer.parentNode;
        }
        if (endContainer.nodeType == 1) {
          endOffset = nodeIndex(endContainer) + 1;
          endContainer = endContainer.parentNode;
        }
        return {
          startContainer: startContainer,
          startOffset: startOffset,
          endContainer: endContainer,
          endOffset: endOffset
        };
      }
      function removeFormat(format, vars, node, compare_node) {
        var i, attrs, stylesModified;
        if (!matchName(node, format)) {
          return FALSE;
        }
        if (format.remove != 'all') {
          each(format.styles, function (value, name) {
            value = normalizeStyleValue(replaceVars(value, vars), name);
            if (typeof name === 'number') {
              name = value;
              compare_node = 0;
            }
            if (!compare_node || isEq(getStyle(compare_node, name), value)) {
              dom.setStyle(node, name, '');
            }
            stylesModified = 1;
          });
          if (stylesModified && dom.getAttrib(node, 'style') === '') {
            node.removeAttribute('style');
            node.removeAttribute('data-mce-style');
          }
          each(format.attributes, function (value, name) {
            var valueOut;
            value = replaceVars(value, vars);
            if (typeof name === 'number') {
              name = value;
              compare_node = 0;
            }
            if (!compare_node || isEq(dom.getAttrib(compare_node, name), value)) {
              if (name == 'class') {
                value = dom.getAttrib(node, name);
                if (value) {
                  valueOut = '';
                  each(value.split(/\s+/), function (cls) {
                    if (/mce\w+/.test(cls)) {
                      valueOut += (valueOut ? ' ' : '') + cls;
                    }
                  });
                  if (valueOut) {
                    dom.setAttrib(node, name, valueOut);
                    return;
                  }
                }
              }
              if (name == 'class') {
                node.removeAttribute('className');
              }
              if (MCE_ATTR_RE.test(name)) {
                node.removeAttribute('data-mce-' + name);
              }
              node.removeAttribute(name);
            }
          });
          each(format.classes, function (value) {
            value = replaceVars(value, vars);
            if (!compare_node || dom.hasClass(compare_node, value)) {
              dom.removeClass(node, value);
            }
          });
          attrs = dom.getAttribs(node);
          for (i = 0; i < attrs.length; i++) {
            if (attrs[i].nodeName.indexOf('_') !== 0) {
              return FALSE;
            }
          }
        }
        if (format.remove != 'none') {
          removeNode(node, format);
          return TRUE;
        }
      }
      function removeNode(node, format) {
        var parentNode = node.parentNode, rootBlockElm;
        function find(node, next, inc) {
          node = getNonWhiteSpaceSibling(node, next, inc);
          return !node || (node.nodeName == 'BR' || isBlock(node));
        }
        if (format.block) {
          if (!forcedRootBlock) {
            if (isBlock(node) && !isBlock(parentNode)) {
              if (!find(node, FALSE) && !find(node.firstChild, TRUE, 1)) {
                node.insertBefore(dom.create('br'), node.firstChild);
              }
              if (!find(node, TRUE) && !find(node.lastChild, FALSE, 1)) {
                node.appendChild(dom.create('br'));
              }
            }
          } else {
            if (parentNode == dom.getRoot()) {
              if (!format.list_block || !isEq(node, format.list_block)) {
                each(grep(node.childNodes), function (node) {
                  if (isValid(forcedRootBlock, node.nodeName.toLowerCase())) {
                    if (!rootBlockElm) {
                      rootBlockElm = wrap(node, forcedRootBlock);
                      dom.setAttribs(rootBlockElm, ed.settings.forced_root_block_attrs);
                    } else {
                      rootBlockElm.appendChild(node);
                    }
                  } else {
                    rootBlockElm = 0;
                  }
                });
              }
            }
          }
        }
        if (format.selector && format.inline && !isEq(format.inline, node)) {
          return;
        }
        dom.remove(node, 1);
      }
      function getNonWhiteSpaceSibling(node, next, inc) {
        if (node) {
          next = next ? 'nextSibling' : 'previousSibling';
          for (node = inc ? node : node[next]; node; node = node[next]) {
            if (node.nodeType == 1 || !isWhiteSpaceNode(node)) {
              return node;
            }
          }
        }
      }
      function isBookmarkNode(node) {
        return node && node.nodeType == 1 && node.getAttribute('data-mce-type') == 'bookmark';
      }
      function mergeSiblings(prev, next) {
        var sibling, tmpSibling;
        function compareElements(node1, node2) {
          if (node1.nodeName != node2.nodeName) {
            return FALSE;
          }
          function getAttribs(node) {
            var attribs = {};
            each(dom.getAttribs(node), function (attr) {
              var name = attr.nodeName.toLowerCase();
              if (name.indexOf('_') !== 0 && name !== 'style' && name !== 'data-mce-style') {
                attribs[name] = dom.getAttrib(node, name);
              }
            });
            return attribs;
          }
          function compareObjects(obj1, obj2) {
            var value, name;
            for (name in obj1) {
              if (obj1.hasOwnProperty(name)) {
                value = obj2[name];
                if (value === undef) {
                  return FALSE;
                }
                if (obj1[name] != value) {
                  return FALSE;
                }
                delete obj2[name];
              }
            }
            for (name in obj2) {
              if (obj2.hasOwnProperty(name)) {
                return FALSE;
              }
            }
            return TRUE;
          }
          if (!compareObjects(getAttribs(node1), getAttribs(node2))) {
            return FALSE;
          }
          if (!compareObjects(dom.parseStyle(dom.getAttrib(node1, 'style')), dom.parseStyle(dom.getAttrib(node2, 'style')))) {
            return FALSE;
          }
          return !isBookmarkNode(node1) && !isBookmarkNode(node2);
        }
        function findElementSibling(node, sibling_name) {
          for (sibling = node; sibling; sibling = sibling[sibling_name]) {
            if (sibling.nodeType == 3 && sibling.nodeValue.length !== 0) {
              return node;
            }
            if (sibling.nodeType == 1 && !isBookmarkNode(sibling)) {
              return sibling;
            }
          }
          return node;
        }
        if (prev && next) {
          prev = findElementSibling(prev, 'previousSibling');
          next = findElementSibling(next, 'nextSibling');
          if (compareElements(prev, next)) {
            for (sibling = prev.nextSibling; sibling && sibling != next;) {
              tmpSibling = sibling;
              sibling = sibling.nextSibling;
              prev.appendChild(tmpSibling);
            }
            dom.remove(next);
            each(grep(next.childNodes), function (node) {
              prev.appendChild(node);
            });
            return prev;
          }
        }
        return next;
      }
      function getContainer(rng, start) {
        var container, offset, lastIdx;
        container = rng[start ? 'startContainer' : 'endContainer'];
        offset = rng[start ? 'startOffset' : 'endOffset'];
        if (container.nodeType == 1) {
          lastIdx = container.childNodes.length - 1;
          if (!start && offset) {
            offset--;
          }
          container = container.childNodes[offset > lastIdx ? lastIdx : offset];
        }
        if (container.nodeType === 3 && start && offset >= container.nodeValue.length) {
          container = new TreeWalker(container, ed.getBody()).next() || container;
        }
        if (container.nodeType === 3 && !start && offset === 0) {
          container = new TreeWalker(container, ed.getBody()).prev() || container;
        }
        return container;
      }
      function performCaretAction(type, name, vars) {
        var caretContainerId = '_mce_caret', debug = ed.settings.caret_debug;
        function createCaretContainer(fill) {
          var caretContainer = dom.create('span', {
              id: caretContainerId,
              'data-mce-bogus': true,
              style: debug ? 'color:red' : ''
            });
          if (fill) {
            caretContainer.appendChild(ed.getDoc().createTextNode(INVISIBLE_CHAR));
          }
          return caretContainer;
        }
        function isCaretContainerEmpty(node, nodes) {
          while (node) {
            if (node.nodeType === 3 && node.nodeValue !== INVISIBLE_CHAR || node.childNodes.length > 1) {
              return false;
            }
            if (nodes && node.nodeType === 1) {
              nodes.push(node);
            }
            node = node.firstChild;
          }
          return true;
        }
        function getParentCaretContainer(node) {
          while (node) {
            if (node.id === caretContainerId) {
              return node;
            }
            node = node.parentNode;
          }
        }
        function findFirstTextNode(node) {
          var walker;
          if (node) {
            walker = new TreeWalker(node, node);
            for (node = walker.current(); node; node = walker.next()) {
              if (node.nodeType === 3) {
                return node;
              }
            }
          }
        }
        function removeCaretContainer(node, move_caret) {
          var child, rng;
          if (!node) {
            node = getParentCaretContainer(selection.getStart());
            if (!node) {
              while (node = dom.get(caretContainerId)) {
                removeCaretContainer(node, false);
              }
            }
          } else {
            rng = selection.getRng(true);
            if (isCaretContainerEmpty(node)) {
              if (move_caret !== false) {
                rng.setStartBefore(node);
                rng.setEndBefore(node);
              }
              dom.remove(node);
            } else {
              child = findFirstTextNode(node);
              if (child.nodeValue.charAt(0) === INVISIBLE_CHAR) {
                child = child.deleteData(0, 1);
              }
              dom.remove(node, 1);
            }
            selection.setRng(rng);
          }
        }
        function applyCaretFormat() {
          var rng, caretContainer, textNode, offset, bookmark, container, text;
          rng = selection.getRng(true);
          offset = rng.startOffset;
          container = rng.startContainer;
          text = container.nodeValue;
          caretContainer = getParentCaretContainer(selection.getStart());
          if (caretContainer) {
            textNode = findFirstTextNode(caretContainer);
          }
          if (text && offset > 0 && offset < text.length && /\w/.test(text.charAt(offset)) && /\w/.test(text.charAt(offset - 1))) {
            bookmark = selection.getBookmark();
            rng.collapse(true);
            rng = expandRng(rng, get(name));
            rng = rangeUtils.split(rng);
            apply(name, vars, rng);
            selection.moveToBookmark(bookmark);
          } else {
            if (!caretContainer || textNode.nodeValue !== INVISIBLE_CHAR) {
              caretContainer = createCaretContainer(true);
              textNode = caretContainer.firstChild;
              rng.insertNode(caretContainer);
              offset = 1;
              apply(name, vars, caretContainer);
            } else {
              apply(name, vars, caretContainer);
            }
            selection.setCursorLocation(textNode, offset);
          }
        }
        function removeCaretFormat() {
          var rng = selection.getRng(true), container, offset, bookmark, hasContentAfter, node, formatNode, parents = [], i, caretContainer;
          container = rng.startContainer;
          offset = rng.startOffset;
          node = container;
          if (container.nodeType == 3) {
            if (offset != container.nodeValue.length || container.nodeValue === INVISIBLE_CHAR) {
              hasContentAfter = true;
            }
            node = node.parentNode;
          }
          while (node) {
            if (matchNode(node, name, vars)) {
              formatNode = node;
              break;
            }
            if (node.nextSibling) {
              hasContentAfter = true;
            }
            parents.push(node);
            node = node.parentNode;
          }
          if (!formatNode) {
            return;
          }
          if (hasContentAfter) {
            bookmark = selection.getBookmark();
            rng.collapse(true);
            rng = expandRng(rng, get(name), true);
            rng = rangeUtils.split(rng);
            remove(name, vars, rng);
            selection.moveToBookmark(bookmark);
          } else {
            caretContainer = createCaretContainer();
            node = caretContainer;
            for (i = parents.length - 1; i >= 0; i--) {
              node.appendChild(dom.clone(parents[i], false));
              node = node.firstChild;
            }
            node.appendChild(dom.doc.createTextNode(INVISIBLE_CHAR));
            node = node.firstChild;
            var block = dom.getParent(formatNode, isTextBlock);
            if (block && dom.isEmpty(block)) {
              formatNode.parentNode.replaceChild(caretContainer, formatNode);
            } else {
              dom.insertAfter(caretContainer, formatNode);
            }
            selection.setCursorLocation(node, 1);
            if (dom.isEmpty(formatNode)) {
              dom.remove(formatNode);
            }
          }
        }
        function unmarkBogusCaretParents() {
          var caretContainer;
          caretContainer = getParentCaretContainer(selection.getStart());
          if (caretContainer && !dom.isEmpty(caretContainer)) {
            walk(caretContainer, function (node) {
              if (node.nodeType == 1 && node.id !== caretContainerId && !dom.isEmpty(node)) {
                dom.setAttrib(node, 'data-mce-bogus', null);
              }
            }, 'childNodes');
          }
        }
        if (!ed._hasCaretEvents) {
          markCaretContainersBogus = function () {
            var nodes = [], i;
            if (isCaretContainerEmpty(getParentCaretContainer(selection.getStart()), nodes)) {
              i = nodes.length;
              while (i--) {
                dom.setAttrib(nodes[i], 'data-mce-bogus', '1');
              }
            }
          };
          disableCaretContainer = function (e) {
            var keyCode = e.keyCode;
            removeCaretContainer();
            if (keyCode == 8 || keyCode == 37 || keyCode == 39) {
              removeCaretContainer(getParentCaretContainer(selection.getStart()));
            }
            unmarkBogusCaretParents();
          };
          ed.on('SetContent', function (e) {
            if (e.selection) {
              unmarkBogusCaretParents();
            }
          });
          ed._hasCaretEvents = true;
        }
        if (type == 'apply') {
          applyCaretFormat();
        } else {
          removeCaretFormat();
        }
      }
      function moveStart(rng) {
        var container = rng.startContainer, offset = rng.startOffset, isAtEndOfText, walker, node, nodes, tmpNode;
        if (container.nodeType == 3 && offset >= container.nodeValue.length) {
          offset = nodeIndex(container);
          container = container.parentNode;
          isAtEndOfText = true;
        }
        if (container.nodeType == 1) {
          nodes = container.childNodes;
          container = nodes[Math.min(offset, nodes.length - 1)];
          walker = new TreeWalker(container, dom.getParent(container, dom.isBlock));
          if (offset > nodes.length - 1 || isAtEndOfText) {
            walker.next();
          }
          for (node = walker.current(); node; node = walker.next()) {
            if (node.nodeType == 3 && !isWhiteSpaceNode(node)) {
              tmpNode = dom.create('a', null, INVISIBLE_CHAR);
              node.parentNode.insertBefore(tmpNode, node);
              rng.setStart(node, 0);
              selection.setRng(rng);
              dom.remove(tmpNode);
              return;
            }
          }
        }
      }
    };
  });
  define('tinymce/UndoManager', [
    'tinymce/Env',
    'tinymce/util/Tools'
  ], function (Env, Tools) {
    var trim = Tools.trim, trimContentRegExp;
    trimContentRegExp = new RegExp([
      '<span[^>]+data-mce-bogus[^>]+>[\u200b\ufeff]+<\\/span>',
      '<div[^>]+data-mce-bogus[^>]+><\\/div>',
      '\\s?data-mce-selected="[^"]+"'
    ].join('|'), 'gi');
    return function (editor) {
      var self = this, index = 0, data = [], beforeBookmark, isFirstTypedCharacter, lock;
      function getContent() {
        return trim(editor.getContent({
          format: 'raw',
          no_events: 1
        }).replace(trimContentRegExp, ''));
      }
      function addNonTypingUndoLevel(e) {
        self.typing = false;
        self.add({}, e);
      }
      editor.on('init', function () {
        self.add();
      });
      editor.on('BeforeExecCommand', function (e) {
        var cmd = e.command;
        if (cmd != 'Undo' && cmd != 'Redo' && cmd != 'mceRepaint') {
          self.beforeChange();
        }
      });
      editor.on('ExecCommand', function (e) {
        var cmd = e.command;
        if (cmd != 'Undo' && cmd != 'Redo' && cmd != 'mceRepaint') {
          addNonTypingUndoLevel(e);
        }
      });
      editor.on('ObjectResizeStart', function () {
        self.beforeChange();
      });
      editor.on('SaveContent ObjectResized blur', addNonTypingUndoLevel);
      editor.dom.bind(editor.dom.getRoot(), 'dragend', addNonTypingUndoLevel);
      editor.on('KeyUp', function (e) {
        var keyCode = e.keyCode;
        if (keyCode >= 33 && keyCode <= 36 || keyCode >= 37 && keyCode <= 40 || keyCode == 45 || keyCode == 13 || e.ctrlKey) {
          addNonTypingUndoLevel();
          editor.nodeChanged();
        }
        if (keyCode == 46 || keyCode == 8 || Env.mac && (keyCode == 91 || keyCode == 93)) {
          editor.nodeChanged();
        }
        if (isFirstTypedCharacter && self.typing) {
          if (!editor.isDirty()) {
            editor.isNotDirty = !data[0] || getContent() == data[0].content;
            if (!editor.isNotDirty) {
              editor.fire('change', {
                level: data[0],
                lastLevel: null
              });
            }
          }
          editor.fire('TypingUndo');
          isFirstTypedCharacter = false;
          editor.nodeChanged();
        }
      });
      editor.on('KeyDown', function (e) {
        var keyCode = e.keyCode;
        if (keyCode >= 33 && keyCode <= 36 || keyCode >= 37 && keyCode <= 40 || keyCode == 45) {
          if (self.typing) {
            addNonTypingUndoLevel(e);
          }
          return;
        }
        if ((keyCode < 16 || keyCode > 20) && keyCode != 224 && keyCode != 91 && !self.typing) {
          self.beforeChange();
          self.typing = true;
          self.add({}, e);
          isFirstTypedCharacter = true;
        }
      });
      editor.on('MouseDown', function (e) {
        if (self.typing) {
          addNonTypingUndoLevel(e);
        }
      });
      editor.addShortcut('ctrl+z', '', 'Undo');
      editor.addShortcut('ctrl+y,ctrl+shift+z', '', 'Redo');
      editor.on('AddUndo Undo Redo ClearUndos MouseUp', function (e) {
        if (!e.isDefaultPrevented()) {
          editor.nodeChanged();
        }
      });
      self = {
        data: data,
        typing: false,
        beforeChange: function () {
          if (!lock) {
            beforeBookmark = editor.selection.getBookmark(2, true);
          }
        },
        add: function (level, event) {
          var i, settings = editor.settings, lastLevel;
          level = level || {};
          level.content = getContent();
          if (lock || editor.removed) {
            return null;
          }
          if (editor.fire('BeforeAddUndo', {
              level: level,
              originalEvent: event
            }).isDefaultPrevented()) {
            return null;
          }
          lastLevel = data[index];
          if (lastLevel && lastLevel.content == level.content) {
            return null;
          }
          if (data[index]) {
            data[index].beforeBookmark = beforeBookmark;
          }
          if (settings.custom_undo_redo_levels) {
            if (data.length > settings.custom_undo_redo_levels) {
              for (i = 0; i < data.length - 1; i++) {
                data[i] = data[i + 1];
              }
              data.length--;
              index = data.length;
            }
          }
          level.bookmark = editor.selection.getBookmark(2, true);
          if (index < data.length - 1) {
            data.length = index + 1;
          }
          data.push(level);
          index = data.length - 1;
          var args = {
              level: level,
              lastLevel: lastLevel,
              originalEvent: event
            };
          editor.fire('AddUndo', args);
          if (index > 0) {
            editor.isNotDirty = false;
            editor.fire('change', args);
          }
          return level;
        },
        undo: function () {
          var level;
          if (self.typing) {
            self.add();
            self.typing = false;
          }
          if (index > 0) {
            level = data[--index];
            if (index === 0) {
              editor.isNotDirty = true;
            }
            editor.setContent(level.content, { format: 'raw' });
            editor.selection.moveToBookmark(level.beforeBookmark);
            editor.fire('undo', { level: level });
          }
          return level;
        },
        redo: function () {
          var level;
          if (index < data.length - 1) {
            level = data[++index];
            editor.setContent(level.content, { format: 'raw' });
            editor.selection.moveToBookmark(level.bookmark);
            editor.fire('redo', { level: level });
          }
          return level;
        },
        clear: function () {
          data = [];
          index = 0;
          self.typing = false;
          editor.fire('ClearUndos');
        },
        hasUndo: function () {
          return index > 0 || self.typing && data[0] && getContent() != data[0].content;
        },
        hasRedo: function () {
          return index < data.length - 1 && !this.typing;
        },
        transact: function (callback) {
          self.beforeChange();
          lock = true;
          callback();
          lock = false;
          self.add();
        }
      };
      return self;
    };
  });
  define('tinymce/EnterKey', [
    'tinymce/dom/TreeWalker',
    'tinymce/dom/RangeUtils',
    'tinymce/Env'
  ], function (TreeWalker, RangeUtils, Env) {
    var isIE = Env.ie && Env.ie < 11;
    return function (editor) {
      var dom = editor.dom, selection = editor.selection, settings = editor.settings;
      var undoManager = editor.undoManager, schema = editor.schema, nonEmptyElementsMap = schema.getNonEmptyElements();
      function handleEnterKey(evt) {
        var rng, tmpRng, editableRoot, container, offset, parentBlock, documentMode, shiftKey, newBlock, fragment, containerBlock, parentBlockName, containerBlockName, newBlockName, isAfterLastNodeInContainer;
        function canSplitBlock(node) {
          return node && dom.isBlock(node) && !/^(TD|TH|CAPTION|FORM)$/.test(node.nodeName) && !/^(fixed|absolute)/i.test(node.style.position) && dom.getContentEditable(node) !== 'true';
        }
        function renderBlockOnIE(block) {
          var oldRng;
          if (dom.isBlock(block)) {
            oldRng = selection.getRng();
            block.appendChild(dom.create('span', null, '\xa0'));
            selection.select(block);
            block.lastChild.outerHTML = '';
            selection.setRng(oldRng);
          }
        }
        function trimInlineElementsOnLeftSideOfBlock(block) {
          var node = block, firstChilds = [], i;
          while (node = node.firstChild) {
            if (dom.isBlock(node)) {
              return;
            }
            if (node.nodeType == 1 && !nonEmptyElementsMap[node.nodeName.toLowerCase()]) {
              firstChilds.push(node);
            }
          }
          i = firstChilds.length;
          while (i--) {
            node = firstChilds[i];
            if (!node.hasChildNodes() || node.firstChild == node.lastChild && node.firstChild.nodeValue === '') {
              dom.remove(node);
            } else {
              if (node.nodeName == 'A' && (node.innerText || node.textContent) === ' ') {
                dom.remove(node);
              }
            }
          }
        }
        function moveToCaretPosition(root) {
          var walker, node, rng, lastNode = root, tempElm;
          function firstNonWhiteSpaceNodeSibling(node) {
            while (node) {
              if (node.nodeType == 1 || node.nodeType == 3 && node.data && /[\r\n\s]/.test(node.data)) {
                return node;
              }
              node = node.nextSibling;
            }
          }
          if (Env.ie && Env.ie < 9 && parentBlock && parentBlock.firstChild) {
            if (parentBlock.firstChild == parentBlock.lastChild && parentBlock.firstChild.tagName == 'BR') {
              dom.remove(parentBlock.firstChild);
            }
          }
          if (root.nodeName == 'LI') {
            var firstChild = firstNonWhiteSpaceNodeSibling(root.firstChild);
            if (firstChild && /^(UL|OL)$/.test(firstChild.nodeName)) {
              root.insertBefore(dom.doc.createTextNode('\xa0'), root.firstChild);
            }
          }
          rng = dom.createRng();
          if (root.hasChildNodes()) {
            walker = new TreeWalker(root, root);
            while (node = walker.current()) {
              if (node.nodeType == 3) {
                rng.setStart(node, 0);
                rng.setEnd(node, 0);
                break;
              }
              if (nonEmptyElementsMap[node.nodeName.toLowerCase()]) {
                rng.setStartBefore(node);
                rng.setEndBefore(node);
                break;
              }
              lastNode = node;
              node = walker.next();
            }
            if (!node) {
              rng.setStart(lastNode, 0);
              rng.setEnd(lastNode, 0);
            }
          } else {
            if (root.nodeName == 'BR') {
              if (root.nextSibling && dom.isBlock(root.nextSibling)) {
                if (!documentMode || documentMode < 9) {
                  tempElm = dom.create('br');
                  root.parentNode.insertBefore(tempElm, root);
                }
                rng.setStartBefore(root);
                rng.setEndBefore(root);
              } else {
                rng.setStartAfter(root);
                rng.setEndAfter(root);
              }
            } else {
              rng.setStart(root, 0);
              rng.setEnd(root, 0);
            }
          }
          selection.setRng(rng);
          dom.remove(tempElm);
          selection.scrollIntoView(root);
        }
        function setForcedBlockAttrs(node) {
          var forcedRootBlockName = settings.forced_root_block;
          if (forcedRootBlockName && forcedRootBlockName.toLowerCase() === node.tagName.toLowerCase()) {
            dom.setAttribs(node, settings.forced_root_block_attrs);
          }
        }
        function createNewBlock(name) {
          var node = container, block, clonedNode, caretNode;
          if (name || parentBlockName == 'TABLE') {
            block = dom.create(name || newBlockName);
            setForcedBlockAttrs(block);
          } else {
            block = parentBlock.cloneNode(false);
          }
          caretNode = block;
          if (settings.keep_styles !== false) {
            do {
              if (/^(SPAN|STRONG|B|EM|I|FONT|STRIKE|U|VAR|CITE|DFN|CODE|MARK|Q|SUP|SUB|SAMP)$/.test(node.nodeName)) {
                if (node.id == '_mce_caret') {
                  continue;
                }
                clonedNode = node.cloneNode(false);
                dom.setAttrib(clonedNode, 'id', '');
                if (block.hasChildNodes()) {
                  clonedNode.appendChild(block.firstChild);
                  block.appendChild(clonedNode);
                } else {
                  caretNode = clonedNode;
                  block.appendChild(clonedNode);
                }
              }
            } while (node = node.parentNode);
          }
          if (!isIE) {
            caretNode.innerHTML = '<br data-mce-bogus="1">';
          }
          return block;
        }
        function isCaretAtStartOrEndOfBlock(start) {
          var walker, node, name;
          if (container.nodeType == 3 && (start ? offset > 0 : offset < container.nodeValue.length)) {
            return false;
          }
          if (container.parentNode == parentBlock && isAfterLastNodeInContainer && !start) {
            return true;
          }
          if (start && container.nodeType == 1 && container == parentBlock.firstChild) {
            return true;
          }
          if (container.nodeName === 'TABLE' || container.previousSibling && container.previousSibling.nodeName == 'TABLE') {
            return isAfterLastNodeInContainer && !start || !isAfterLastNodeInContainer && start;
          }
          walker = new TreeWalker(container, parentBlock);
          if (container.nodeType == 3) {
            if (start && offset === 0) {
              walker.prev();
            } else if (!start && offset == container.nodeValue.length) {
              walker.next();
            }
          }
          while (node = walker.current()) {
            if (node.nodeType === 1) {
              if (!node.getAttribute('data-mce-bogus')) {
                name = node.nodeName.toLowerCase();
                if (nonEmptyElementsMap[name] && name !== 'br') {
                  return false;
                }
              }
            } else if (node.nodeType === 3 && !/^[ \t\r\n]*$/.test(node.nodeValue)) {
              return false;
            }
            if (start) {
              walker.prev();
            } else {
              walker.next();
            }
          }
          return true;
        }
        function wrapSelfAndSiblingsInDefaultBlock(container, offset) {
          var newBlock, parentBlock, startNode, node, next, rootBlockName, blockName = newBlockName || 'P';
          parentBlock = dom.getParent(container, dom.isBlock);
          rootBlockName = editor.getBody().nodeName.toLowerCase();
          if (!parentBlock || !canSplitBlock(parentBlock)) {
            parentBlock = parentBlock || editableRoot;
            if (!parentBlock.hasChildNodes()) {
              newBlock = dom.create(blockName);
              setForcedBlockAttrs(newBlock);
              parentBlock.appendChild(newBlock);
              rng.setStart(newBlock, 0);
              rng.setEnd(newBlock, 0);
              return newBlock;
            }
            node = container;
            while (node.parentNode != parentBlock) {
              node = node.parentNode;
            }
            while (node && !dom.isBlock(node)) {
              startNode = node;
              node = node.previousSibling;
            }
            if (startNode && schema.isValidChild(rootBlockName, blockName.toLowerCase())) {
              newBlock = dom.create(blockName);
              setForcedBlockAttrs(newBlock);
              startNode.parentNode.insertBefore(newBlock, startNode);
              node = startNode;
              while (node && !dom.isBlock(node)) {
                next = node.nextSibling;
                newBlock.appendChild(node);
                node = next;
              }
              rng.setStart(container, offset);
              rng.setEnd(container, offset);
            }
          }
          return container;
        }
        function handleEmptyListItem() {
          function isFirstOrLastLi(first) {
            var node = containerBlock[first ? 'firstChild' : 'lastChild'];
            while (node) {
              if (node.nodeType == 1) {
                break;
              }
              node = node[first ? 'nextSibling' : 'previousSibling'];
            }
            return node === parentBlock;
          }
          function getContainerBlock() {
            var containerBlockParent = containerBlock.parentNode;
            if (containerBlockParent.nodeName == 'LI') {
              return containerBlockParent;
            }
            return containerBlock;
          }
          var containerBlockParentName = containerBlock.parentNode.nodeName;
          if (/^(OL|UL|LI)$/.test(containerBlockParentName)) {
            newBlockName = 'LI';
          }
          newBlock = newBlockName ? createNewBlock(newBlockName) : dom.create('BR');
          if (isFirstOrLastLi(true) && isFirstOrLastLi()) {
            if (containerBlockParentName == 'LI') {
              dom.insertAfter(newBlock, getContainerBlock());
            } else {
              dom.replace(newBlock, containerBlock);
            }
          } else if (isFirstOrLastLi(true)) {
            if (containerBlockParentName == 'LI') {
              dom.insertAfter(newBlock, getContainerBlock());
              newBlock.appendChild(dom.doc.createTextNode(' '));
              newBlock.appendChild(containerBlock);
            } else {
              containerBlock.parentNode.insertBefore(newBlock, containerBlock);
            }
          } else if (isFirstOrLastLi()) {
            dom.insertAfter(newBlock, getContainerBlock());
            renderBlockOnIE(newBlock);
          } else {
            containerBlock = getContainerBlock();
            tmpRng = rng.cloneRange();
            tmpRng.setStartAfter(parentBlock);
            tmpRng.setEndAfter(containerBlock);
            fragment = tmpRng.extractContents();
            if (newBlockName == 'LI' && fragment.firstChild.nodeName == 'LI') {
              newBlock = fragment.firstChild;
              dom.insertAfter(fragment, containerBlock);
            } else {
              dom.insertAfter(fragment, containerBlock);
              dom.insertAfter(newBlock, containerBlock);
            }
          }
          dom.remove(parentBlock);
          moveToCaretPosition(newBlock);
          undoManager.add();
        }
        function hasRightSideContent() {
          var walker = new TreeWalker(container, parentBlock), node;
          while (node = walker.next()) {
            if (nonEmptyElementsMap[node.nodeName.toLowerCase()] || node.length > 0) {
              return true;
            }
          }
        }
        function insertBr() {
          var brElm, extraBr, marker;
          if (container && container.nodeType == 3 && offset >= container.nodeValue.length) {
            if (!isIE && !hasRightSideContent()) {
              brElm = dom.create('br');
              rng.insertNode(brElm);
              rng.setStartAfter(brElm);
              rng.setEndAfter(brElm);
              extraBr = true;
            }
          }
          brElm = dom.create('br');
          rng.insertNode(brElm);
          if (isIE && parentBlockName == 'PRE' && (!documentMode || documentMode < 8)) {
            brElm.parentNode.insertBefore(dom.doc.createTextNode('\r'), brElm);
          }
          marker = dom.create('span', {}, '&nbsp;');
          brElm.parentNode.insertBefore(marker, brElm);
          selection.scrollIntoView(marker);
          dom.remove(marker);
          if (!extraBr) {
            rng.setStartAfter(brElm);
            rng.setEndAfter(brElm);
          } else {
            rng.setStartBefore(brElm);
            rng.setEndBefore(brElm);
          }
          selection.setRng(rng);
          undoManager.add();
        }
        function trimLeadingLineBreaks(node) {
          do {
            if (node.nodeType === 3) {
              node.nodeValue = node.nodeValue.replace(/^[\r\n]+/, '');
            }
            node = node.firstChild;
          } while (node);
        }
        function getEditableRoot(node) {
          var root = dom.getRoot(), parent, editableRoot;
          parent = node;
          while (parent !== root && dom.getContentEditable(parent) !== 'false') {
            if (dom.getContentEditable(parent) === 'true') {
              editableRoot = parent;
            }
            parent = parent.parentNode;
          }
          return parent !== root ? editableRoot : root;
        }
        function addBrToBlockIfNeeded(block) {
          var lastChild;
          if (!isIE) {
            block.normalize();
            lastChild = block.lastChild;
            if (!lastChild || /^(left|right)$/gi.test(dom.getStyle(lastChild, 'float', true))) {
              dom.add(block, 'br');
            }
          }
        }
        rng = selection.getRng(true);
        if (evt.isDefaultPrevented()) {
          return;
        }
        if (!rng.collapsed) {
          editor.execCommand('Delete');
          return;
        }
        new RangeUtils(dom).normalize(rng);
        container = rng.startContainer;
        offset = rng.startOffset;
        newBlockName = (settings.force_p_newlines ? 'p' : '') || settings.forced_root_block;
        newBlockName = newBlockName ? newBlockName.toUpperCase() : '';
        documentMode = dom.doc.documentMode;
        shiftKey = evt.shiftKey;
        if (container.nodeType == 1 && container.hasChildNodes()) {
          isAfterLastNodeInContainer = offset > container.childNodes.length - 1;
          container = container.childNodes[Math.min(offset, container.childNodes.length - 1)] || container;
          if (isAfterLastNodeInContainer && container.nodeType == 3) {
            offset = container.nodeValue.length;
          } else {
            offset = 0;
          }
        }
        editableRoot = getEditableRoot(container);
        if (!editableRoot) {
          return;
        }
        undoManager.beforeChange();
        if (!dom.isBlock(editableRoot) && editableRoot != dom.getRoot()) {
          if (!newBlockName || shiftKey) {
            insertBr();
          }
          return;
        }
        if (newBlockName && !shiftKey || !newBlockName && shiftKey) {
          container = wrapSelfAndSiblingsInDefaultBlock(container, offset);
        }
        parentBlock = dom.getParent(container, dom.isBlock);
        containerBlock = parentBlock ? dom.getParent(parentBlock.parentNode, dom.isBlock) : null;
        parentBlockName = parentBlock ? parentBlock.nodeName.toUpperCase() : '';
        containerBlockName = containerBlock ? containerBlock.nodeName.toUpperCase() : '';
        if (containerBlockName == 'LI' && !evt.ctrlKey) {
          parentBlock = containerBlock;
          parentBlockName = containerBlockName;
        }
        if (parentBlockName == 'LI') {
          if (!newBlockName && shiftKey) {
            insertBr();
            return;
          }
          if (dom.isEmpty(parentBlock)) {
            handleEmptyListItem();
            return;
          }
        }
        if (parentBlockName == 'PRE' && settings.br_in_pre !== false) {
          if (!shiftKey) {
            insertBr();
            return;
          }
        } else {
          if (!newBlockName && !shiftKey && parentBlockName != 'LI' || newBlockName && shiftKey) {
            insertBr();
            return;
          }
        }
        if (newBlockName && parentBlock === editor.getBody()) {
          return;
        }
        newBlockName = newBlockName || 'P';
        if (isCaretAtStartOrEndOfBlock()) {
          if (/^(H[1-6]|PRE|FIGURE)$/.test(parentBlockName) && containerBlockName != 'HGROUP') {
            newBlock = createNewBlock(newBlockName);
          } else {
            newBlock = createNewBlock();
          }
          if (settings.end_container_on_empty_block && canSplitBlock(containerBlock) && dom.isEmpty(parentBlock)) {
            newBlock = dom.split(containerBlock, parentBlock);
          } else {
            dom.insertAfter(newBlock, parentBlock);
          }
          moveToCaretPosition(newBlock);
        } else if (isCaretAtStartOrEndOfBlock(true)) {
          newBlock = parentBlock.parentNode.insertBefore(createNewBlock(), parentBlock);
          renderBlockOnIE(newBlock);
          moveToCaretPosition(parentBlock);
        } else {
          tmpRng = rng.cloneRange();
          tmpRng.setEndAfter(parentBlock);
          fragment = tmpRng.extractContents();
          trimLeadingLineBreaks(fragment);
          newBlock = fragment.firstChild;
          dom.insertAfter(fragment, parentBlock);
          trimInlineElementsOnLeftSideOfBlock(newBlock);
          addBrToBlockIfNeeded(parentBlock);
          moveToCaretPosition(newBlock);
        }
        dom.setAttrib(newBlock, 'id', '');
        editor.fire('NewBlock', { newBlock: newBlock });
        undoManager.add();
      }
      editor.on('keydown', function (evt) {
        if (evt.keyCode == 13) {
          if (handleEnterKey(evt) !== false) {
            evt.preventDefault();
          }
        }
      });
    };
  });
  define('tinymce/ForceBlocks', [], function () {
    return function (editor) {
      var settings = editor.settings, dom = editor.dom, selection = editor.selection;
      var schema = editor.schema, blockElements = schema.getBlockElements();
      function addRootBlocks() {
        var node = selection.getStart(), rootNode = editor.getBody(), rng;
        var startContainer, startOffset, endContainer, endOffset, rootBlockNode;
        var tempNode, offset = -16777215, wrapped, restoreSelection;
        var tmpRng, rootNodeName, forcedRootBlock;
        forcedRootBlock = settings.forced_root_block;
        if (!node || node.nodeType !== 1 || !forcedRootBlock) {
          return;
        }
        while (node && node != rootNode) {
          if (blockElements[node.nodeName]) {
            return;
          }
          node = node.parentNode;
        }
        rng = selection.getRng();
        if (rng.setStart) {
          startContainer = rng.startContainer;
          startOffset = rng.startOffset;
          endContainer = rng.endContainer;
          endOffset = rng.endOffset;
          try {
            restoreSelection = editor.getDoc().activeElement === rootNode;
          } catch (ex) {
          }
        } else {
          if (rng.item) {
            node = rng.item(0);
            rng = editor.getDoc().body.createTextRange();
            rng.moveToElementText(node);
          }
          restoreSelection = rng.parentElement().ownerDocument === editor.getDoc();
          tmpRng = rng.duplicate();
          tmpRng.collapse(true);
          startOffset = tmpRng.move('character', offset) * -1;
          if (!tmpRng.collapsed) {
            tmpRng = rng.duplicate();
            tmpRng.collapse(false);
            endOffset = tmpRng.move('character', offset) * -1 - startOffset;
          }
        }
        node = rootNode.firstChild;
        rootNodeName = rootNode.nodeName.toLowerCase();
        while (node) {
          if ((node.nodeType === 3 || node.nodeType == 1 && !blockElements[node.nodeName]) && schema.isValidChild(rootNodeName, forcedRootBlock.toLowerCase())) {
            if (node.nodeType === 3 && node.nodeValue.length === 0) {
              tempNode = node;
              node = node.nextSibling;
              dom.remove(tempNode);
              continue;
            }
            if (!rootBlockNode) {
              rootBlockNode = dom.create(forcedRootBlock, editor.settings.forced_root_block_attrs);
              node.parentNode.insertBefore(rootBlockNode, node);
              wrapped = true;
            }
            tempNode = node;
            node = node.nextSibling;
            rootBlockNode.appendChild(tempNode);
          } else {
            rootBlockNode = null;
            node = node.nextSibling;
          }
        }
        if (wrapped && restoreSelection) {
          if (rng.setStart) {
            rng.setStart(startContainer, startOffset);
            rng.setEnd(endContainer, endOffset);
            selection.setRng(rng);
          } else {
            try {
              rng = editor.getDoc().body.createTextRange();
              rng.moveToElementText(rootNode);
              rng.collapse(true);
              rng.moveStart('character', startOffset);
              if (endOffset > 0) {
                rng.moveEnd('character', endOffset);
              }
              rng.select();
            } catch (ex) {
            }
          }
          editor.nodeChanged();
        }
      }
      if (settings.forced_root_block) {
        editor.on('NodeChange', addRootBlocks);
      }
    };
  });
  define('tinymce/EditorCommands', [
    'tinymce/html/Serializer',
    'tinymce/Env',
    'tinymce/util/Tools'
  ], function (Serializer, Env, Tools) {
    var each = Tools.each, extend = Tools.extend;
    var map = Tools.map, inArray = Tools.inArray, explode = Tools.explode;
    var isGecko = Env.gecko, isIE = Env.ie;
    var TRUE = true, FALSE = false;
    return function (editor) {
      var dom = editor.dom, selection = editor.selection, commands = {
          state: {},
          exec: {},
          value: {}
        }, settings = editor.settings, formatter = editor.formatter, bookmark;
      function execCommand(command, ui, value) {
        var func;
        command = command.toLowerCase();
        if (func = commands.exec[command]) {
          func(command, ui, value);
          return TRUE;
        }
        return FALSE;
      }
      function queryCommandState(command) {
        var func;
        command = command.toLowerCase();
        if (func = commands.state[command]) {
          return func(command);
        }
        return -1;
      }
      function queryCommandValue(command) {
        var func;
        command = command.toLowerCase();
        if (func = commands.value[command]) {
          return func(command);
        }
        return FALSE;
      }
      function addCommands(command_list, type) {
        type = type || 'exec';
        each(command_list, function (callback, command) {
          each(command.toLowerCase().split(','), function (command) {
            commands[type][command] = callback;
          });
        });
      }
      extend(this, {
        execCommand: execCommand,
        queryCommandState: queryCommandState,
        queryCommandValue: queryCommandValue,
        addCommands: addCommands
      });
      function execNativeCommand(command, ui, value) {
        if (ui === undefined) {
          ui = FALSE;
        }
        if (value === undefined) {
          value = null;
        }
        return editor.getDoc().execCommand(command, ui, value);
      }
      function isFormatMatch(name) {
        return formatter.match(name);
      }
      function toggleFormat(name, value) {
        formatter.toggle(name, value ? { value: value } : undefined);
        editor.nodeChanged();
      }
      function storeSelection(type) {
        bookmark = selection.getBookmark(type);
      }
      function restoreSelection() {
        selection.moveToBookmark(bookmark);
      }
      addCommands({
        'mceResetDesignMode,mceBeginUndoLevel': function () {
        },
        'mceEndUndoLevel,mceAddUndoLevel': function () {
          editor.undoManager.add();
        },
        'Cut,Copy,Paste': function (command) {
          var doc = editor.getDoc(), failed;
          try {
            execNativeCommand(command);
          } catch (ex) {
            failed = TRUE;
          }
          if (failed || !doc.queryCommandSupported(command)) {
            var msg = editor.translate('Your browser doesn\'t support direct access to the clipboard. ' + 'Please use the Ctrl+X/C/V keyboard shortcuts instead.');
            if (Env.mac) {
              msg = msg.replace(/Ctrl\+/g, '\u2318+');
            }
            editor.windowManager.alert(msg);
          }
        },
        unlink: function () {
          if (selection.isCollapsed()) {
            var elm = selection.getNode();
            if (elm.tagName == 'A') {
              editor.dom.remove(elm, true);
            }
            return;
          }
          formatter.remove('link');
        },
        'JustifyLeft,JustifyCenter,JustifyRight,JustifyFull': function (command) {
          var align = command.substring(7);
          if (align == 'full') {
            align = 'justify';
          }
          each('left,center,right,justify'.split(','), function (name) {
            if (align != name) {
              formatter.remove('align' + name);
            }
          });
          toggleFormat('align' + align);
          execCommand('mceRepaint');
        },
        'InsertUnorderedList,InsertOrderedList': function (command) {
          var listElm, listParent;
          execNativeCommand(command);
          listElm = dom.getParent(selection.getNode(), 'ol,ul');
          if (listElm) {
            listParent = listElm.parentNode;
            if (/^(H[1-6]|P|ADDRESS|PRE)$/.test(listParent.nodeName)) {
              storeSelection();
              dom.split(listParent, listElm);
              restoreSelection();
            }
          }
        },
        'Bold,Italic,Underline,Strikethrough,Superscript,Subscript': function (command) {
          toggleFormat(command);
        },
        'ForeColor,HiliteColor,FontName': function (command, ui, value) {
          toggleFormat(command, value);
        },
        FontSize: function (command, ui, value) {
          var fontClasses, fontSizes;
          if (value >= 1 && value <= 7) {
            fontSizes = explode(settings.font_size_style_values);
            fontClasses = explode(settings.font_size_classes);
            if (fontClasses) {
              value = fontClasses[value - 1] || value;
            } else {
              value = fontSizes[value - 1] || value;
            }
          }
          toggleFormat(command, value);
        },
        RemoveFormat: function (command) {
          formatter.remove(command);
        },
        mceBlockQuote: function () {
          toggleFormat('blockquote');
        },
        FormatBlock: function (command, ui, value) {
          return toggleFormat(value || 'p');
        },
        mceCleanup: function () {
          var bookmark = selection.getBookmark();
          editor.setContent(editor.getContent({ cleanup: TRUE }), { cleanup: TRUE });
          selection.moveToBookmark(bookmark);
        },
        mceRemoveNode: function (command, ui, value) {
          var node = value || selection.getNode();
          if (node != editor.getBody()) {
            storeSelection();
            editor.dom.remove(node, TRUE);
            restoreSelection();
          }
        },
        mceSelectNodeDepth: function (command, ui, value) {
          var counter = 0;
          dom.getParent(selection.getNode(), function (node) {
            if (node.nodeType == 1 && counter++ == value) {
              selection.select(node);
              return FALSE;
            }
          }, editor.getBody());
        },
        mceSelectNode: function (command, ui, value) {
          selection.select(value);
        },
        mceInsertContent: function (command, ui, value) {
          var parser, serializer, parentNode, rootNode, fragment, args;
          var marker, rng, node, node2, bookmarkHtml;
          function trimOrPaddLeftRight(html) {
            var rng, container, offset;
            rng = selection.getRng(true);
            container = rng.startContainer;
            offset = rng.startOffset;
            function hasSiblingText(siblingName) {
              return container[siblingName] && container[siblingName].nodeType == 3;
            }
            if (container.nodeType == 3) {
              if (offset > 0) {
                html = html.replace(/^&nbsp;/, ' ');
              } else if (!hasSiblingText('previousSibling')) {
                html = html.replace(/^ /, '&nbsp;');
              }
              if (offset < container.length) {
                html = html.replace(/&nbsp;(<br>|)$/, ' ');
              } else if (!hasSiblingText('nextSibling')) {
                html = html.replace(/(&nbsp;| )(<br>|)$/, '&nbsp;');
              }
            }
            return html;
          }
          if (/^ | $/.test(value)) {
            value = trimOrPaddLeftRight(value);
          }
          parser = editor.parser;
          serializer = new Serializer({}, editor.schema);
          bookmarkHtml = '<span id="mce_marker" data-mce-type="bookmark">&#xFEFF;&#200B;</span>';
          args = {
            content: value,
            format: 'html',
            selection: true
          };
          editor.fire('BeforeSetContent', args);
          value = args.content;
          if (value.indexOf('{$caret}') == -1) {
            value += '{$caret}';
          }
          value = value.replace(/\{\$caret\}/, bookmarkHtml);
          rng = selection.getRng();
          var caretElement = rng.startContainer || (rng.parentElement ? rng.parentElement() : null);
          var body = editor.getBody();
          if (caretElement === body && selection.isCollapsed()) {
            if (dom.isBlock(body.firstChild) && dom.isEmpty(body.firstChild)) {
              rng = dom.createRng();
              rng.setStart(body.firstChild, 0);
              rng.setEnd(body.firstChild, 0);
              selection.setRng(rng);
            }
          }
          if (!selection.isCollapsed()) {
            editor.getDoc().execCommand('Delete', false, null);
          }
          parentNode = selection.getNode();
          var parserArgs = { context: parentNode.nodeName.toLowerCase() };
          fragment = parser.parse(value, parserArgs);
          node = fragment.lastChild;
          if (node.attr('id') == 'mce_marker') {
            marker = node;
            for (node = node.prev; node; node = node.walk(true)) {
              if (node.type == 3 || !dom.isBlock(node.name)) {
                node.parent.insert(marker, node, node.name === 'br');
                break;
              }
            }
          }
          if (!parserArgs.invalid) {
            value = serializer.serialize(fragment);
            node = parentNode.firstChild;
            node2 = parentNode.lastChild;
            if (!node || node === node2 && node.nodeName === 'BR') {
              dom.setHTML(parentNode, value);
            } else {
              selection.setContent(value);
            }
          } else {
            selection.setContent(bookmarkHtml);
            parentNode = selection.getNode();
            rootNode = editor.getBody();
            if (parentNode.nodeType == 9) {
              parentNode = node = rootNode;
            } else {
              node = parentNode;
            }
            while (node !== rootNode) {
              parentNode = node;
              node = node.parentNode;
            }
            value = parentNode == rootNode ? rootNode.innerHTML : dom.getOuterHTML(parentNode);
            value = serializer.serialize(parser.parse(value.replace(/<span (id="mce_marker"|id=mce_marker).+?<\/span>/i, function () {
              return serializer.serialize(fragment);
            })));
            if (parentNode == rootNode) {
              dom.setHTML(rootNode, value);
            } else {
              dom.setOuterHTML(parentNode, value);
            }
          }
          marker = dom.get('mce_marker');
          selection.scrollIntoView(marker);
          rng = dom.createRng();
          node = marker.previousSibling;
          if (node && node.nodeType == 3) {
            rng.setStart(node, node.nodeValue.length);
            if (!isIE) {
              node2 = marker.nextSibling;
              if (node2 && node2.nodeType == 3) {
                node.appendData(node2.data);
                node2.parentNode.removeChild(node2);
              }
            }
          } else {
            rng.setStartBefore(marker);
            rng.setEndBefore(marker);
          }
          dom.remove(marker);
          selection.setRng(rng);
          editor.fire('SetContent', args);
          editor.addVisual();
        },
        mceInsertRawHTML: function (command, ui, value) {
          selection.setContent('tiny_mce_marker');
          editor.setContent(editor.getContent().replace(/tiny_mce_marker/g, function () {
            return value;
          }));
        },
        mceToggleFormat: function (command, ui, value) {
          toggleFormat(value);
        },
        mceSetContent: function (command, ui, value) {
          editor.setContent(value);
        },
        'Indent,Outdent': function (command) {
          var intentValue, indentUnit, value;
          intentValue = settings.indentation;
          indentUnit = /[a-z%]+$/i.exec(intentValue);
          intentValue = parseInt(intentValue, 10);
          if (!queryCommandState('InsertUnorderedList') && !queryCommandState('InsertOrderedList')) {
            if (!settings.forced_root_block && !dom.getParent(selection.getNode(), dom.isBlock)) {
              formatter.apply('div');
            }
            each(selection.getSelectedBlocks(), function (element) {
              if (element.nodeName != 'LI') {
                var indentStyleName = editor.getParam('indent_use_margin', false) ? 'margin' : 'padding';
                indentStyleName += dom.getStyle(element, 'direction', true) == 'rtl' ? 'Right' : 'Left';
                if (command == 'outdent') {
                  value = Math.max(0, parseInt(element.style[indentStyleName] || 0, 10) - intentValue);
                  dom.setStyle(element, indentStyleName, value ? value + indentUnit : '');
                } else {
                  value = parseInt(element.style[indentStyleName] || 0, 10) + intentValue + indentUnit;
                  dom.setStyle(element, indentStyleName, value);
                }
              }
            });
          } else {
            execNativeCommand(command);
          }
        },
        mceRepaint: function () {
          if (isGecko) {
            try {
              storeSelection(TRUE);
              if (selection.getSel()) {
                selection.getSel().selectAllChildren(editor.getBody());
              }
              selection.collapse(TRUE);
              restoreSelection();
            } catch (ex) {
            }
          }
        },
        InsertHorizontalRule: function () {
          editor.execCommand('mceInsertContent', false, '<hr />');
        },
        mceToggleVisualAid: function () {
          editor.hasVisual = !editor.hasVisual;
          editor.addVisual();
        },
        mceReplaceContent: function (command, ui, value) {
          editor.execCommand('mceInsertContent', false, value.replace(/\{\$selection\}/g, selection.getContent({ format: 'text' })));
        },
        mceInsertLink: function (command, ui, value) {
          var anchor;
          if (typeof value == 'string') {
            value = { href: value };
          }
          anchor = dom.getParent(selection.getNode(), 'a');
          value.href = value.href.replace(' ', '%20');
          if (!anchor || !value.href) {
            formatter.remove('link');
          }
          if (value.href) {
            formatter.apply('link', value, anchor);
          }
        },
        selectAll: function () {
          var root = dom.getRoot(), rng;
          if (selection.getRng().setStart) {
            rng = dom.createRng();
            rng.setStart(root, 0);
            rng.setEnd(root, root.childNodes.length);
            selection.setRng(rng);
          } else {
            rng = selection.getRng();
            if (!rng.item) {
              rng.moveToElementText(root);
              rng.select();
            }
          }
        },
        'delete': function () {
          execNativeCommand('Delete');
          var body = editor.getBody();
          if (dom.isEmpty(body)) {
            editor.setContent('');
            if (body.firstChild && dom.isBlock(body.firstChild)) {
              editor.selection.setCursorLocation(body.firstChild, 0);
            } else {
              editor.selection.setCursorLocation(body, 0);
            }
          }
        },
        mceNewDocument: function () {
          editor.setContent('');
        }
      });
      addCommands({
        'JustifyLeft,JustifyCenter,JustifyRight,JustifyFull': function (command) {
          var name = 'align' + command.substring(7);
          var nodes = selection.isCollapsed() ? [dom.getParent(selection.getNode(), dom.isBlock)] : selection.getSelectedBlocks();
          var matches = map(nodes, function (node) {
              return !!formatter.matchNode(node, name);
            });
          return inArray(matches, TRUE) !== -1;
        },
        'Bold,Italic,Underline,Strikethrough,Superscript,Subscript': function (command) {
          return isFormatMatch(command);
        },
        mceBlockQuote: function () {
          return isFormatMatch('blockquote');
        },
        Outdent: function () {
          var node;
          if (settings.inline_styles) {
            if ((node = dom.getParent(selection.getStart(), dom.isBlock)) && parseInt(node.style.paddingLeft, 10) > 0) {
              return TRUE;
            }
            if ((node = dom.getParent(selection.getEnd(), dom.isBlock)) && parseInt(node.style.paddingLeft, 10) > 0) {
              return TRUE;
            }
          }
          return queryCommandState('InsertUnorderedList') || queryCommandState('InsertOrderedList') || !settings.inline_styles && !!dom.getParent(selection.getNode(), 'BLOCKQUOTE');
        },
        'InsertUnorderedList,InsertOrderedList': function (command) {
          var list = dom.getParent(selection.getNode(), 'ul,ol');
          return list && (command === 'insertunorderedlist' && list.tagName === 'UL' || command === 'insertorderedlist' && list.tagName === 'OL');
        }
      }, 'state');
      addCommands({
        'FontSize,FontName': function (command) {
          var value = 0, parent;
          if (parent = dom.getParent(selection.getNode(), 'span')) {
            if (command == 'fontsize') {
              value = parent.style.fontSize;
            } else {
              value = parent.style.fontFamily.replace(/, /g, ',').replace(/[\'\"]/g, '').toLowerCase();
            }
          }
          return value;
        }
      }, 'value');
      addCommands({
        Undo: function () {
          editor.undoManager.undo();
        },
        Redo: function () {
          editor.undoManager.redo();
        }
      });
    };
  });
  define('tinymce/util/URI', ['tinymce/util/Tools'], function (Tools) {
    var each = Tools.each, trim = Tools.trim;
    function URI(url, settings) {
      var self = this, baseUri, base_url;
      url = trim(url);
      settings = self.settings = settings || {};
      if (/^([\w\-]+):([^\/]{2})/i.test(url) || /^\s*#/.test(url)) {
        self.source = url;
        return;
      }
      var isProtocolRelative = url.indexOf('//') === 0;
      if (url.indexOf('/') === 0 && !isProtocolRelative) {
        url = (settings.base_uri ? settings.base_uri.protocol || 'http' : 'http') + '://mce_host' + url;
      }
      if (!/^[\w\-]*:?\/\//.test(url)) {
        base_url = settings.base_uri ? settings.base_uri.path : new URI(location.href).directory;
        if (settings.base_uri.protocol === '') {
          url = '//mce_host' + self.toAbsPath(base_url, url);
        } else {
          url = (settings.base_uri && settings.base_uri.protocol || 'http') + '://mce_host' + self.toAbsPath(base_url, url);
        }
      }
      url = url.replace(/@@/g, '(mce_at)');
      url = /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@\/]*):?([^:@\/]*))?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/.exec(url);
      each([
        'source',
        'protocol',
        'authority',
        'userInfo',
        'user',
        'password',
        'host',
        'port',
        'relative',
        'path',
        'directory',
        'file',
        'query',
        'anchor'
      ], function (v, i) {
        var part = url[i];
        if (part) {
          part = part.replace(/\(mce_at\)/g, '@@');
        }
        self[v] = part;
      });
      baseUri = settings.base_uri;
      if (baseUri) {
        if (!self.protocol) {
          self.protocol = baseUri.protocol;
        }
        if (!self.userInfo) {
          self.userInfo = baseUri.userInfo;
        }
        if (!self.port && self.host === 'mce_host') {
          self.port = baseUri.port;
        }
        if (!self.host || self.host === 'mce_host') {
          self.host = baseUri.host;
        }
        self.source = '';
      }
      if (isProtocolRelative) {
        self.protocol = '';
      }
    }
    URI.prototype = {
      setPath: function (path) {
        var self = this;
        path = /^(.*?)\/?(\w+)?$/.exec(path);
        self.path = path[0];
        self.directory = path[1];
        self.file = path[2];
        self.source = '';
        self.getURI();
      },
      toRelative: function (uri) {
        var self = this, output;
        if (uri === './') {
          return uri;
        }
        uri = new URI(uri, { base_uri: self });
        if (uri.host != 'mce_host' && self.host != uri.host && uri.host || self.port != uri.port || self.protocol != uri.protocol && uri.protocol !== '') {
          return uri.getURI();
        }
        var tu = self.getURI(), uu = uri.getURI();
        if (tu == uu || tu.charAt(tu.length - 1) == '/' && tu.substr(0, tu.length - 1) == uu) {
          return tu;
        }
        output = self.toRelPath(self.path, uri.path);
        if (uri.query) {
          output += '?' + uri.query;
        }
        if (uri.anchor) {
          output += '#' + uri.anchor;
        }
        return output;
      },
      toAbsolute: function (uri, noHost) {
        uri = new URI(uri, { base_uri: this });
        return uri.getURI(this.host == uri.host && this.protocol == uri.protocol ? noHost : 0);
      },
      toRelPath: function (base, path) {
        var items, breakPoint = 0, out = '', i, l;
        base = base.substring(0, base.lastIndexOf('/'));
        base = base.split('/');
        items = path.split('/');
        if (base.length >= items.length) {
          for (i = 0, l = base.length; i < l; i++) {
            if (i >= items.length || base[i] != items[i]) {
              breakPoint = i + 1;
              break;
            }
          }
        }
        if (base.length < items.length) {
          for (i = 0, l = items.length; i < l; i++) {
            if (i >= base.length || base[i] != items[i]) {
              breakPoint = i + 1;
              break;
            }
          }
        }
        if (breakPoint === 1) {
          return path;
        }
        for (i = 0, l = base.length - (breakPoint - 1); i < l; i++) {
          out += '../';
        }
        for (i = breakPoint - 1, l = items.length; i < l; i++) {
          if (i != breakPoint - 1) {
            out += '/' + items[i];
          } else {
            out += items[i];
          }
        }
        return out;
      },
      toAbsPath: function (base, path) {
        var i, nb = 0, o = [], tr, outPath;
        tr = /\/$/.test(path) ? '/' : '';
        base = base.split('/');
        path = path.split('/');
        each(base, function (k) {
          if (k) {
            o.push(k);
          }
        });
        base = o;
        for (i = path.length - 1, o = []; i >= 0; i--) {
          if (path[i].length === 0 || path[i] === '.') {
            continue;
          }
          if (path[i] === '..') {
            nb++;
            continue;
          }
          if (nb > 0) {
            nb--;
            continue;
          }
          o.push(path[i]);
        }
        i = base.length - nb;
        if (i <= 0) {
          outPath = o.reverse().join('/');
        } else {
          outPath = base.slice(0, i).join('/') + '/' + o.reverse().join('/');
        }
        if (outPath.indexOf('/') !== 0) {
          outPath = '/' + outPath;
        }
        if (tr && outPath.lastIndexOf('/') !== outPath.length - 1) {
          outPath += tr;
        }
        return outPath;
      },
      getURI: function (noProtoHost) {
        var s, self = this;
        if (!self.source || noProtoHost) {
          s = '';
          if (!noProtoHost) {
            if (self.protocol) {
              s += self.protocol + '://';
            } else {
              s += '//';
            }
            if (self.userInfo) {
              s += self.userInfo + '@';
            }
            if (self.host) {
              s += self.host;
            }
            if (self.port) {
              s += ':' + self.port;
            }
          }
          if (self.path) {
            s += self.path;
          }
          if (self.query) {
            s += '?' + self.query;
          }
          if (self.anchor) {
            s += '#' + self.anchor;
          }
          self.source = s;
        }
        return self.source;
      }
    };
    return URI;
  });
  define('tinymce/util/Class', ['tinymce/util/Tools'], function (Tools) {
    var each = Tools.each, extend = Tools.extend;
    var extendClass, initializing;
    function Class() {
    }
    Class.extend = extendClass = function (prop) {
      var self = this, _super = self.prototype, prototype, name, member;
      function Class() {
        var i, mixins, mixin, self = this;
        if (!initializing) {
          if (self.init) {
            self.init.apply(self, arguments);
          }
          mixins = self.Mixins;
          if (mixins) {
            i = mixins.length;
            while (i--) {
              mixin = mixins[i];
              if (mixin.init) {
                mixin.init.apply(self, arguments);
              }
            }
          }
        }
      }
      function dummy() {
        return this;
      }
      function createMethod(name, fn) {
        return function () {
          var self = this, tmp = self._super, ret;
          self._super = _super[name];
          ret = fn.apply(self, arguments);
          self._super = tmp;
          return ret;
        };
      }
      initializing = true;
      prototype = new self();
      initializing = false;
      if (prop.Mixins) {
        each(prop.Mixins, function (mixin) {
          mixin = mixin;
          for (var name in mixin) {
            if (name !== 'init') {
              prop[name] = mixin[name];
            }
          }
        });
        if (_super.Mixins) {
          prop.Mixins = _super.Mixins.concat(prop.Mixins);
        }
      }
      if (prop.Methods) {
        each(prop.Methods.split(','), function (name) {
          prop[name] = dummy;
        });
      }
      if (prop.Properties) {
        each(prop.Properties.split(','), function (name) {
          var fieldName = '_' + name;
          prop[name] = function (value) {
            var self = this, undef;
            if (value !== undef) {
              self[fieldName] = value;
              return self;
            }
            return self[fieldName];
          };
        });
      }
      if (prop.Statics) {
        each(prop.Statics, function (func, name) {
          Class[name] = func;
        });
      }
      if (prop.Defaults && _super.Defaults) {
        prop.Defaults = extend({}, _super.Defaults, prop.Defaults);
      }
      for (name in prop) {
        member = prop[name];
        if (typeof member == 'function' && _super[name]) {
          prototype[name] = createMethod(name, member);
        } else {
          prototype[name] = member;
        }
      }
      Class.prototype = prototype;
      Class.constructor = Class;
      Class.extend = extendClass;
      return Class;
    };
    return Class;
  });
  define('tinymce/ui/Selector', ['tinymce/util/Class'], function (Class) {
    'use strict';
    function unique(array) {
      var uniqueItems = [], i = array.length, item;
      while (i--) {
        item = array[i];
        if (!item.__checked) {
          uniqueItems.push(item);
          item.__checked = 1;
        }
      }
      i = uniqueItems.length;
      while (i--) {
        delete uniqueItems[i].__checked;
      }
      return uniqueItems;
    }
    var expression = /^([\w\\*]+)?(?:#([\w\\]+))?(?:\.([\w\\\.]+))?(?:\[\@?([\w\\]+)([\^\$\*!~]?=)([\w\\]+)\])?(?:\:(.+))?/i;
    var chunker = /((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^\[\]]*\]|['"][^'"]*['"]|[^\[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?((?:.|\r|\n)*)/g, whiteSpace = /^\s*|\s*$/g, Collection;
    var Selector = Class.extend({
        init: function (selector) {
          var match = this.match;
          function compileNameFilter(name) {
            if (name) {
              name = name.toLowerCase();
              return function (item) {
                return name === '*' || item.type === name;
              };
            }
          }
          function compileIdFilter(id) {
            if (id) {
              return function (item) {
                return item._name === id;
              };
            }
          }
          function compileClassesFilter(classes) {
            if (classes) {
              classes = classes.split('.');
              return function (item) {
                var i = classes.length;
                while (i--) {
                  if (!item.hasClass(classes[i])) {
                    return false;
                  }
                }
                return true;
              };
            }
          }
          function compileAttrFilter(name, cmp, check) {
            if (name) {
              return function (item) {
                var value = item[name] ? item[name]() : '';
                return !cmp ? !!check : cmp === '=' ? value === check : cmp === '*=' ? value.indexOf(check) >= 0 : cmp === '~=' ? (' ' + value + ' ').indexOf(' ' + check + ' ') >= 0 : cmp === '!=' ? value != check : cmp === '^=' ? value.indexOf(check) === 0 : cmp === '$=' ? value.substr(value.length - check.length) === check : false;
              };
            }
          }
          function compilePsuedoFilter(name) {
            var notSelectors;
            if (name) {
              name = /(?:not\((.+)\))|(.+)/i.exec(name);
              if (!name[1]) {
                name = name[2];
                return function (item, index, length) {
                  return name === 'first' ? index === 0 : name === 'last' ? index === length - 1 : name === 'even' ? index % 2 === 0 : name === 'odd' ? index % 2 === 1 : item[name] ? item[name]() : false;
                };
              } else {
                notSelectors = parseChunks(name[1], []);
                return function (item) {
                  return !match(item, notSelectors);
                };
              }
            }
          }
          function compile(selector, filters, direct) {
            var parts;
            function add(filter) {
              if (filter) {
                filters.push(filter);
              }
            }
            parts = expression.exec(selector.replace(whiteSpace, ''));
            add(compileNameFilter(parts[1]));
            add(compileIdFilter(parts[2]));
            add(compileClassesFilter(parts[3]));
            add(compileAttrFilter(parts[4], parts[5], parts[6]));
            add(compilePsuedoFilter(parts[7]));
            filters.psuedo = !!parts[7];
            filters.direct = direct;
            return filters;
          }
          function parseChunks(selector, selectors) {
            var parts = [], extra, matches, i;
            do {
              chunker.exec('');
              matches = chunker.exec(selector);
              if (matches) {
                selector = matches[3];
                parts.push(matches[1]);
                if (matches[2]) {
                  extra = matches[3];
                  break;
                }
              }
            } while (matches);
            if (extra) {
              parseChunks(extra, selectors);
            }
            selector = [];
            for (i = 0; i < parts.length; i++) {
              if (parts[i] != '>') {
                selector.push(compile(parts[i], [], parts[i - 1] === '>'));
              }
            }
            selectors.push(selector);
            return selectors;
          }
          this._selectors = parseChunks(selector, []);
        },
        match: function (control, selectors) {
          var i, l, si, sl, selector, fi, fl, filters, index, length, siblings, count, item;
          selectors = selectors || this._selectors;
          for (i = 0, l = selectors.length; i < l; i++) {
            selector = selectors[i];
            sl = selector.length;
            item = control;
            count = 0;
            for (si = sl - 1; si >= 0; si--) {
              filters = selector[si];
              while (item) {
                if (filters.psuedo) {
                  siblings = item.parent().items();
                  index = length = siblings.length;
                  while (index--) {
                    if (siblings[index] === item) {
                      break;
                    }
                  }
                }
                for (fi = 0, fl = filters.length; fi < fl; fi++) {
                  if (!filters[fi](item, index, length)) {
                    fi = fl + 1;
                    break;
                  }
                }
                if (fi === fl) {
                  count++;
                  break;
                } else {
                  if (si === sl - 1) {
                    break;
                  }
                }
                item = item.parent();
              }
            }
            if (count === sl) {
              return true;
            }
          }
          return false;
        },
        find: function (container) {
          var matches = [], i, l, selectors = this._selectors;
          function collect(items, selector, index) {
            var i, l, fi, fl, item, filters = selector[index];
            for (i = 0, l = items.length; i < l; i++) {
              item = items[i];
              for (fi = 0, fl = filters.length; fi < fl; fi++) {
                if (!filters[fi](item, i, l)) {
                  fi = fl + 1;
                  break;
                }
              }
              if (fi === fl) {
                if (index == selector.length - 1) {
                  matches.push(item);
                } else {
                  if (item.items) {
                    collect(item.items(), selector, index + 1);
                  }
                }
              } else if (filters.direct) {
                return;
              }
              if (item.items) {
                collect(item.items(), selector, index);
              }
            }
          }
          if (container.items) {
            for (i = 0, l = selectors.length; i < l; i++) {
              collect(container.items(), selectors[i], 0);
            }
            if (l > 1) {
              matches = unique(matches);
            }
          }
          if (!Collection) {
            Collection = Selector.Collection;
          }
          return new Collection(matches);
        }
      });
    return Selector;
  });
  define('tinymce/ui/Collection', [
    'tinymce/util/Tools',
    'tinymce/ui/Selector',
    'tinymce/util/Class'
  ], function (Tools, Selector, Class) {
    'use strict';
    var Collection, proto, push = Array.prototype.push, slice = Array.prototype.slice;
    proto = {
      length: 0,
      init: function (items) {
        if (items) {
          this.add(items);
        }
      },
      add: function (items) {
        var self = this;
        if (!Tools.isArray(items)) {
          if (items instanceof Collection) {
            self.add(items.toArray());
          } else {
            push.call(self, items);
          }
        } else {
          push.apply(self, items);
        }
        return self;
      },
      set: function (items) {
        var self = this, len = self.length, i;
        self.length = 0;
        self.add(items);
        for (i = self.length; i < len; i++) {
          delete self[i];
        }
        return self;
      },
      filter: function (selector) {
        var self = this, i, l, matches = [], item, match;
        if (typeof selector === 'string') {
          selector = new Selector(selector);
          match = function (item) {
            return selector.match(item);
          };
        } else {
          match = selector;
        }
        for (i = 0, l = self.length; i < l; i++) {
          item = self[i];
          if (match(item)) {
            matches.push(item);
          }
        }
        return new Collection(matches);
      },
      slice: function () {
        return new Collection(slice.apply(this, arguments));
      },
      eq: function (index) {
        return index === -1 ? this.slice(index) : this.slice(index, +index + 1);
      },
      each: function (callback) {
        Tools.each(this, callback);
        return this;
      },
      toArray: function () {
        return Tools.toArray(this);
      },
      indexOf: function (ctrl) {
        var self = this, i = self.length;
        while (i--) {
          if (self[i] === ctrl) {
            break;
          }
        }
        return i;
      },
      reverse: function () {
        return new Collection(Tools.toArray(this).reverse());
      },
      hasClass: function (cls) {
        return this[0] ? this[0].hasClass(cls) : false;
      },
      prop: function (name, value) {
        var self = this, undef, item;
        if (value !== undef) {
          self.each(function (item) {
            if (item[name]) {
              item[name](value);
            }
          });
          return self;
        }
        item = self[0];
        if (item && item[name]) {
          return item[name]();
        }
      },
      exec: function (name) {
        var self = this, args = Tools.toArray(arguments).slice(1);
        self.each(function (item) {
          if (item[name]) {
            item[name].apply(item, args);
          }
        });
        return self;
      },
      remove: function () {
        var i = this.length;
        while (i--) {
          this[i].remove();
        }
        return this;
      }
    };
    Tools.each('fire on off show hide addClass removeClass append prepend before after reflow'.split(' '), function (name) {
      proto[name] = function () {
        var args = Tools.toArray(arguments);
        this.each(function (ctrl) {
          if (name in ctrl) {
            ctrl[name].apply(ctrl, args);
          }
        });
        return this;
      };
    });
    Tools.each('text name disabled active selected checked visible parent value data'.split(' '), function (name) {
      proto[name] = function (value) {
        return this.prop(name, value);
      };
    });
    Collection = Class.extend(proto);
    Selector.Collection = Collection;
    return Collection;
  });
  define('tinymce/ui/DomUtils', [
    'tinymce/util/Tools',
    'tinymce/dom/DOMUtils'
  ], function (Tools, DOMUtils) {
    'use strict';
    return {
      id: function () {
        return DOMUtils.DOM.uniqueId();
      },
      createFragment: function (html) {
        return DOMUtils.DOM.createFragment(html);
      },
      getWindowSize: function () {
        return DOMUtils.DOM.getViewPort();
      },
      getSize: function (elm) {
        var width, height;
        if (elm.getBoundingClientRect) {
          var rect = elm.getBoundingClientRect();
          width = Math.max(rect.width || rect.right - rect.left, elm.offsetWidth);
          height = Math.max(rect.height || rect.bottom - rect.bottom, elm.offsetHeight);
        } else {
          width = elm.offsetWidth;
          height = elm.offsetHeight;
        }
        return {
          width: width,
          height: height
        };
      },
      getPos: function (elm, root) {
        return DOMUtils.DOM.getPos(elm, root);
      },
      getViewPort: function (win) {
        return DOMUtils.DOM.getViewPort(win);
      },
      get: function (id) {
        return document.getElementById(id);
      },
      addClass: function (elm, cls) {
        return DOMUtils.DOM.addClass(elm, cls);
      },
      removeClass: function (elm, cls) {
        return DOMUtils.DOM.removeClass(elm, cls);
      },
      hasClass: function (elm, cls) {
        return DOMUtils.DOM.hasClass(elm, cls);
      },
      toggleClass: function (elm, cls, state) {
        return DOMUtils.DOM.toggleClass(elm, cls, state);
      },
      css: function (elm, name, value) {
        return DOMUtils.DOM.setStyle(elm, name, value);
      },
      on: function (target, name, callback, scope) {
        return DOMUtils.DOM.bind(target, name, callback, scope);
      },
      off: function (target, name, callback) {
        return DOMUtils.DOM.unbind(target, name, callback);
      },
      fire: function (target, name, args) {
        return DOMUtils.DOM.fire(target, name, args);
      },
      innerHtml: function (elm, html) {
        DOMUtils.DOM.setHTML(elm, html);
      }
    };
  });
  define('tinymce/ui/Control', [
    'tinymce/util/Class',
    'tinymce/util/Tools',
    'tinymce/ui/Collection',
    'tinymce/ui/DomUtils'
  ], function (Class, Tools, Collection, DomUtils) {
    'use strict';
    var nativeEvents = Tools.makeMap('focusin focusout scroll click dblclick mousedown mouseup mousemove mouseover' + ' mouseout mouseenter mouseleave wheel keydown keypress keyup contextmenu', ' ');
    var elementIdCache = {};
    var hasMouseWheelEventSupport = 'onmousewheel' in document;
    var hasWheelEventSupport = false;
    var Control = Class.extend({
        Statics: { elementIdCache: elementIdCache },
        isRtl: function () {
          return Control.rtl;
        },
        classPrefix: 'mce-',
        init: function (settings) {
          var self = this, classes, i;
          self.settings = settings = Tools.extend({}, self.Defaults, settings);
          self._id = settings.id || DomUtils.id();
          self._text = self._name = '';
          self._width = self._height = 0;
          self._aria = { role: settings.role };
          classes = settings.classes;
          if (classes) {
            classes = classes.split(' ');
            classes.map = {};
            i = classes.length;
            while (i--) {
              classes.map[classes[i]] = true;
            }
          }
          self._classes = classes || [];
          self.visible(true);
          Tools.each('title text width height name classes visible disabled active value'.split(' '), function (name) {
            var value = settings[name], undef;
            if (value !== undef) {
              self[name](value);
            } else if (self['_' + name] === undef) {
              self['_' + name] = false;
            }
          });
          self.on('click', function () {
            if (self.disabled()) {
              return false;
            }
          });
          if (settings.classes) {
            Tools.each(settings.classes.split(' '), function (cls) {
              self.addClass(cls);
            });
          }
          self.settings = settings;
          self._borderBox = self.parseBox(settings.border);
          self._paddingBox = self.parseBox(settings.padding);
          self._marginBox = self.parseBox(settings.margin);
          if (settings.hidden) {
            self.hide();
          }
        },
        Properties: 'parent,title,text,width,height,disabled,active,name,value',
        Methods: 'renderHtml',
        getContainerElm: function () {
          return document.body;
        },
        getParentCtrl: function (elm) {
          var ctrl, lookup = this.getRoot().controlIdLookup;
          while (elm && lookup) {
            ctrl = lookup[elm.id];
            if (ctrl) {
              break;
            }
            elm = elm.parentNode;
          }
          return ctrl;
        },
        parseBox: function (value) {
          var len, radix = 10;
          if (!value) {
            return;
          }
          if (typeof value === 'number') {
            value = value || 0;
            return {
              top: value,
              left: value,
              bottom: value,
              right: value
            };
          }
          value = value.split(' ');
          len = value.length;
          if (len === 1) {
            value[1] = value[2] = value[3] = value[0];
          } else if (len === 2) {
            value[2] = value[0];
            value[3] = value[1];
          } else if (len === 3) {
            value[3] = value[1];
          }
          return {
            top: parseInt(value[0], radix) || 0,
            right: parseInt(value[1], radix) || 0,
            bottom: parseInt(value[2], radix) || 0,
            left: parseInt(value[3], radix) || 0
          };
        },
        borderBox: function () {
          return this._borderBox;
        },
        paddingBox: function () {
          return this._paddingBox;
        },
        marginBox: function () {
          return this._marginBox;
        },
        measureBox: function (elm, prefix) {
          function getStyle(name) {
            var defaultView = document.defaultView;
            if (defaultView) {
              name = name.replace(/[A-Z]/g, function (a) {
                return '-' + a;
              });
              return defaultView.getComputedStyle(elm, null).getPropertyValue(name);
            }
            return elm.currentStyle[name];
          }
          function getSide(name) {
            var val = parseFloat(getStyle(name), 10);
            return isNaN(val) ? 0 : val;
          }
          return {
            top: getSide(prefix + 'TopWidth'),
            right: getSide(prefix + 'RightWidth'),
            bottom: getSide(prefix + 'BottomWidth'),
            left: getSide(prefix + 'LeftWidth')
          };
        },
        initLayoutRect: function () {
          var self = this, settings = self.settings, borderBox, layoutRect;
          var elm = self.getEl(), width, height, minWidth, minHeight, autoResize;
          var startMinWidth, startMinHeight, initialSize;
          borderBox = self._borderBox = self._borderBox || self.measureBox(elm, 'border');
          self._paddingBox = self._paddingBox || self.measureBox(elm, 'padding');
          self._marginBox = self._marginBox || self.measureBox(elm, 'margin');
          initialSize = DomUtils.getSize(elm);
          startMinWidth = settings.minWidth;
          startMinHeight = settings.minHeight;
          minWidth = startMinWidth || initialSize.width;
          minHeight = startMinHeight || initialSize.height;
          width = settings.width;
          height = settings.height;
          autoResize = settings.autoResize;
          autoResize = typeof autoResize != 'undefined' ? autoResize : !width && !height;
          width = width || minWidth;
          height = height || minHeight;
          var deltaW = borderBox.left + borderBox.right;
          var deltaH = borderBox.top + borderBox.bottom;
          var maxW = settings.maxWidth || 65535;
          var maxH = settings.maxHeight || 65535;
          self._layoutRect = layoutRect = {
            x: settings.x || 0,
            y: settings.y || 0,
            w: width,
            h: height,
            deltaW: deltaW,
            deltaH: deltaH,
            contentW: width - deltaW,
            contentH: height - deltaH,
            innerW: width - deltaW,
            innerH: height - deltaH,
            startMinWidth: startMinWidth || 0,
            startMinHeight: startMinHeight || 0,
            minW: Math.min(minWidth, maxW),
            minH: Math.min(minHeight, maxH),
            maxW: maxW,
            maxH: maxH,
            autoResize: autoResize,
            scrollW: 0
          };
          self._lastLayoutRect = {};
          return layoutRect;
        },
        layoutRect: function (newRect) {
          var self = this, curRect = self._layoutRect, lastLayoutRect, size, deltaWidth, deltaHeight, undef, repaintControls;
          if (!curRect) {
            curRect = self.initLayoutRect();
          }
          if (newRect) {
            deltaWidth = curRect.deltaW;
            deltaHeight = curRect.deltaH;
            if (newRect.x !== undef) {
              curRect.x = newRect.x;
            }
            if (newRect.y !== undef) {
              curRect.y = newRect.y;
            }
            if (newRect.minW !== undef) {
              curRect.minW = newRect.minW;
            }
            if (newRect.minH !== undef) {
              curRect.minH = newRect.minH;
            }
            size = newRect.w;
            if (size !== undef) {
              size = size < curRect.minW ? curRect.minW : size;
              size = size > curRect.maxW ? curRect.maxW : size;
              curRect.w = size;
              curRect.innerW = size - deltaWidth;
            }
            size = newRect.h;
            if (size !== undef) {
              size = size < curRect.minH ? curRect.minH : size;
              size = size > curRect.maxH ? curRect.maxH : size;
              curRect.h = size;
              curRect.innerH = size - deltaHeight;
            }
            size = newRect.innerW;
            if (size !== undef) {
              size = size < curRect.minW - deltaWidth ? curRect.minW - deltaWidth : size;
              size = size > curRect.maxW - deltaWidth ? curRect.maxW - deltaWidth : size;
              curRect.innerW = size;
              curRect.w = size + deltaWidth;
            }
            size = newRect.innerH;
            if (size !== undef) {
              size = size < curRect.minH - deltaHeight ? curRect.minH - deltaHeight : size;
              size = size > curRect.maxH - deltaHeight ? curRect.maxH - deltaHeight : size;
              curRect.innerH = size;
              curRect.h = size + deltaHeight;
            }
            if (newRect.contentW !== undef) {
              curRect.contentW = newRect.contentW;
            }
            if (newRect.contentH !== undef) {
              curRect.contentH = newRect.contentH;
            }
            lastLayoutRect = self._lastLayoutRect;
            if (lastLayoutRect.x !== curRect.x || lastLayoutRect.y !== curRect.y || lastLayoutRect.w !== curRect.w || lastLayoutRect.h !== curRect.h) {
              repaintControls = Control.repaintControls;
              if (repaintControls) {
                if (repaintControls.map && !repaintControls.map[self._id]) {
                  repaintControls.push(self);
                  repaintControls.map[self._id] = true;
                }
              }
              lastLayoutRect.x = curRect.x;
              lastLayoutRect.y = curRect.y;
              lastLayoutRect.w = curRect.w;
              lastLayoutRect.h = curRect.h;
            }
            return self;
          }
          return curRect;
        },
        repaint: function () {
          var self = this, style, bodyStyle, rect, borderBox, borderW = 0, borderH = 0, lastRepaintRect, round;
          round = !document.createRange ? Math.round : function (value) {
            return value;
          };
          style = self.getEl().style;
          rect = self._layoutRect;
          lastRepaintRect = self._lastRepaintRect || {};
          borderBox = self._borderBox;
          borderW = borderBox.left + borderBox.right;
          borderH = borderBox.top + borderBox.bottom;
          if (rect.x !== lastRepaintRect.x) {
            style.left = round(rect.x) + 'px';
            lastRepaintRect.x = rect.x;
          }
          if (rect.y !== lastRepaintRect.y) {
            style.top = round(rect.y) + 'px';
            lastRepaintRect.y = rect.y;
          }
          if (rect.w !== lastRepaintRect.w) {
            style.width = round(rect.w - borderW) + 'px';
            lastRepaintRect.w = rect.w;
          }
          if (rect.h !== lastRepaintRect.h) {
            style.height = round(rect.h - borderH) + 'px';
            lastRepaintRect.h = rect.h;
          }
          if (self._hasBody && rect.innerW !== lastRepaintRect.innerW) {
            bodyStyle = self.getEl('body').style;
            bodyStyle.width = round(rect.innerW) + 'px';
            lastRepaintRect.innerW = rect.innerW;
          }
          if (self._hasBody && rect.innerH !== lastRepaintRect.innerH) {
            bodyStyle = bodyStyle || self.getEl('body').style;
            bodyStyle.height = round(rect.innerH) + 'px';
            lastRepaintRect.innerH = rect.innerH;
          }
          self._lastRepaintRect = lastRepaintRect;
          self.fire('repaint', {}, false);
        },
        on: function (name, callback) {
          var self = this, bindings, handlers, names, i;
          function resolveCallbackName(name) {
            var callback, scope;
            return function (e) {
              if (!callback) {
                self.parents().each(function (ctrl) {
                  var callbacks = ctrl.settings.callbacks;
                  if (callbacks && (callback = callbacks[name])) {
                    scope = ctrl;
                    return false;
                  }
                });
              }
              return callback.call(scope, e);
            };
          }
          if (callback) {
            if (typeof callback == 'string') {
              callback = resolveCallbackName(callback);
            }
            names = name.toLowerCase().split(' ');
            i = names.length;
            while (i--) {
              name = names[i];
              bindings = self._bindings;
              if (!bindings) {
                bindings = self._bindings = {};
              }
              handlers = bindings[name];
              if (!handlers) {
                handlers = bindings[name] = [];
              }
              handlers.push(callback);
              if (nativeEvents[name]) {
                if (!self._nativeEvents) {
                  self._nativeEvents = { name: true };
                } else {
                  self._nativeEvents[name] = true;
                }
                if (self._rendered) {
                  self.bindPendingEvents();
                }
              }
            }
          }
          return self;
        },
        off: function (name, callback) {
          var self = this, i, bindings = self._bindings, handlers, bindingName, names, hi;
          if (bindings) {
            if (name) {
              names = name.toLowerCase().split(' ');
              i = names.length;
              while (i--) {
                name = names[i];
                handlers = bindings[name];
                if (!name) {
                  for (bindingName in bindings) {
                    bindings[bindingName].length = 0;
                  }
                  return self;
                }
                if (handlers) {
                  if (!callback) {
                    handlers.length = 0;
                  } else {
                    hi = handlers.length;
                    while (hi--) {
                      if (handlers[hi] === callback) {
                        handlers.splice(hi, 1);
                      }
                    }
                  }
                }
              }
            } else {
              self._bindings = [];
            }
          }
          return self;
        },
        fire: function (name, args, bubble) {
          var self = this, i, l, handlers, parentCtrl;
          name = name.toLowerCase();
          function returnFalse() {
            return false;
          }
          function returnTrue() {
            return true;
          }
          args = args || {};
          if (!args.type) {
            args.type = name;
          }
          if (!args.control) {
            args.control = self;
          }
          if (!args.preventDefault) {
            args.preventDefault = function () {
              args.isDefaultPrevented = returnTrue;
            };
            args.stopPropagation = function () {
              args.isPropagationStopped = returnTrue;
            };
            args.stopImmediatePropagation = function () {
              args.isImmediatePropagationStopped = returnTrue;
            };
            args.isDefaultPrevented = returnFalse;
            args.isPropagationStopped = returnFalse;
            args.isImmediatePropagationStopped = returnFalse;
          }
          if (self._bindings) {
            handlers = self._bindings[name];
            if (handlers) {
              for (i = 0, l = handlers.length; i < l; i++) {
                if (!args.isImmediatePropagationStopped() && handlers[i].call(self, args) === false) {
                  break;
                }
              }
            }
          }
          if (bubble !== false) {
            parentCtrl = self.parent();
            while (parentCtrl && !args.isPropagationStopped()) {
              parentCtrl.fire(name, args, false);
              parentCtrl = parentCtrl.parent();
            }
          }
          return args;
        },
        hasEventListeners: function (name) {
          return name in this._bindings;
        },
        parents: function (selector) {
          var self = this, ctrl, parents = new Collection();
          for (ctrl = self.parent(); ctrl; ctrl = ctrl.parent()) {
            parents.add(ctrl);
          }
          if (selector) {
            parents = parents.filter(selector);
          }
          return parents;
        },
        next: function () {
          var parentControls = this.parent().items();
          return parentControls[parentControls.indexOf(this) + 1];
        },
        prev: function () {
          var parentControls = this.parent().items();
          return parentControls[parentControls.indexOf(this) - 1];
        },
        findCommonAncestor: function (ctrl1, ctrl2) {
          var parentCtrl;
          while (ctrl1) {
            parentCtrl = ctrl2;
            while (parentCtrl && ctrl1 != parentCtrl) {
              parentCtrl = parentCtrl.parent();
            }
            if (ctrl1 == parentCtrl) {
              break;
            }
            ctrl1 = ctrl1.parent();
          }
          return ctrl1;
        },
        hasClass: function (cls, group) {
          var classes = this._classes[group || 'control'];
          cls = this.classPrefix + cls;
          return classes && !!classes.map[cls];
        },
        addClass: function (cls, group) {
          var self = this, classes, elm;
          cls = this.classPrefix + cls;
          classes = self._classes[group || 'control'];
          if (!classes) {
            classes = [];
            classes.map = {};
            self._classes[group || 'control'] = classes;
          }
          if (!classes.map[cls]) {
            classes.map[cls] = cls;
            classes.push(cls);
            if (self._rendered) {
              elm = self.getEl(group);
              if (elm) {
                elm.className = classes.join(' ');
              }
            }
          }
          return self;
        },
        removeClass: function (cls, group) {
          var self = this, classes, i, elm;
          cls = this.classPrefix + cls;
          classes = self._classes[group || 'control'];
          if (classes && classes.map[cls]) {
            delete classes.map[cls];
            i = classes.length;
            while (i--) {
              if (classes[i] === cls) {
                classes.splice(i, 1);
              }
            }
          }
          if (self._rendered) {
            elm = self.getEl(group);
            if (elm) {
              elm.className = classes.join(' ');
            }
          }
          return self;
        },
        toggleClass: function (cls, state, group) {
          var self = this;
          if (state) {
            self.addClass(cls, group);
          } else {
            self.removeClass(cls, group);
          }
          return self;
        },
        classes: function (group) {
          var classes = this._classes[group || 'control'];
          return classes ? classes.join(' ') : '';
        },
        innerHtml: function (html) {
          DomUtils.innerHtml(this.getEl(), html);
          return this;
        },
        getEl: function (suffix, dropCache) {
          var elm, id = suffix ? this._id + '-' + suffix : this._id;
          elm = elementIdCache[id] = (dropCache === true ? null : elementIdCache[id]) || DomUtils.get(id);
          return elm;
        },
        visible: function (state) {
          var self = this, parentCtrl;
          if (typeof state !== 'undefined') {
            if (self._visible !== state) {
              if (self._rendered) {
                self.getEl().style.display = state ? '' : 'none';
              }
              self._visible = state;
              parentCtrl = self.parent();
              if (parentCtrl) {
                parentCtrl._lastRect = null;
              }
              self.fire(state ? 'show' : 'hide');
            }
            return self;
          }
          return self._visible;
        },
        show: function () {
          return this.visible(true);
        },
        hide: function () {
          return this.visible(false);
        },
        focus: function () {
          try {
            this.getEl().focus();
          } catch (ex) {
          }
          return this;
        },
        blur: function () {
          this.getEl().blur();
          return this;
        },
        aria: function (name, value) {
          var self = this, elm = self.getEl(self.ariaTarget);
          if (typeof value === 'undefined') {
            return self._aria[name];
          } else {
            self._aria[name] = value;
          }
          if (self._rendered) {
            elm.setAttribute(name == 'role' ? name : 'aria-' + name, value);
          }
          return self;
        },
        encode: function (text, translate) {
          if (translate !== false && Control.translate) {
            text = Control.translate(text);
          }
          return (text || '').replace(/[&<>"]/g, function (match) {
            return '&#' + match.charCodeAt(0) + ';';
          });
        },
        before: function (items) {
          var self = this, parent = self.parent();
          if (parent) {
            parent.insert(items, parent.items().indexOf(self), true);
          }
          return self;
        },
        after: function (items) {
          var self = this, parent = self.parent();
          if (parent) {
            parent.insert(items, parent.items().indexOf(self));
          }
          return self;
        },
        remove: function () {
          var self = this, elm = self.getEl(), parent = self.parent(), newItems, i;
          if (self.items) {
            var controls = self.items().toArray();
            i = controls.length;
            while (i--) {
              controls[i].remove();
            }
          }
          if (parent && parent.items) {
            newItems = [];
            parent.items().each(function (item) {
              if (item !== self) {
                newItems.push(item);
              }
            });
            parent.items().set(newItems);
            parent._lastRect = null;
          }
          if (self._eventsRoot && self._eventsRoot == self) {
            DomUtils.off(elm);
          }
          var lookup = self.getRoot().controlIdLookup;
          if (lookup) {
            delete lookup[self._id];
          }
          delete elementIdCache[self._id];
          if (elm && elm.parentNode) {
            var nodes = elm.getElementsByTagName('*');
            i = nodes.length;
            while (i--) {
              delete elementIdCache[nodes[i].id];
            }
            elm.parentNode.removeChild(elm);
          }
          self._rendered = false;
          return self;
        },
        renderBefore: function (elm) {
          var self = this;
          elm.parentNode.insertBefore(DomUtils.createFragment(self.renderHtml()), elm);
          self.postRender();
          return self;
        },
        renderTo: function (elm) {
          var self = this;
          elm = elm || self.getContainerElm();
          elm.appendChild(DomUtils.createFragment(self.renderHtml()));
          self.postRender();
          return self;
        },
        postRender: function () {
          var self = this, settings = self.settings, elm, box, parent, name, parentEventsRoot;
          for (name in settings) {
            if (name.indexOf('on') === 0) {
              self.on(name.substr(2), settings[name]);
            }
          }
          if (self._eventsRoot) {
            for (parent = self.parent(); !parentEventsRoot && parent; parent = parent.parent()) {
              parentEventsRoot = parent._eventsRoot;
            }
            if (parentEventsRoot) {
              for (name in parentEventsRoot._nativeEvents) {
                self._nativeEvents[name] = true;
              }
            }
          }
          self.bindPendingEvents();
          if (settings.style) {
            elm = self.getEl();
            if (elm) {
              elm.setAttribute('style', settings.style);
              elm.style.cssText = settings.style;
            }
          }
          if (!self._visible) {
            DomUtils.css(self.getEl(), 'display', 'none');
          }
          if (self.settings.border) {
            box = self.borderBox();
            DomUtils.css(self.getEl(), {
              'border-top-width': box.top,
              'border-right-width': box.right,
              'border-bottom-width': box.bottom,
              'border-left-width': box.left
            });
          }
          var root = self.getRoot();
          if (!root.controlIdLookup) {
            root.controlIdLookup = {};
          }
          root.controlIdLookup[self._id] = self;
          for (var key in self._aria) {
            self.aria(key, self._aria[key]);
          }
          self.fire('postrender', {}, false);
        },
        scrollIntoView: function (align) {
          function getOffset(elm, rootElm) {
            var x, y, parent = elm;
            x = y = 0;
            while (parent && parent != rootElm && parent.nodeType) {
              x += parent.offsetLeft || 0;
              y += parent.offsetTop || 0;
              parent = parent.offsetParent;
            }
            return {
              x: x,
              y: y
            };
          }
          var elm = this.getEl(), parentElm = elm.parentNode;
          var x, y, width, height, parentWidth, parentHeight;
          var pos = getOffset(elm, parentElm);
          x = pos.x;
          y = pos.y;
          width = elm.offsetWidth;
          height = elm.offsetHeight;
          parentWidth = parentElm.clientWidth;
          parentHeight = parentElm.clientHeight;
          if (align == 'end') {
            x -= parentWidth - width;
            y -= parentHeight - height;
          } else if (align == 'center') {
            x -= parentWidth / 2 - width / 2;
            y -= parentHeight / 2 - height / 2;
          }
          parentElm.scrollLeft = x;
          parentElm.scrollTop = y;
          return this;
        },
        bindPendingEvents: function () {
          var self = this, i, l, parents, eventRootCtrl, nativeEvents, name;
          function delegate(e) {
            var control = self.getParentCtrl(e.target);
            if (control) {
              control.fire(e.type, e);
            }
          }
          function mouseLeaveHandler() {
            var ctrl = eventRootCtrl._lastHoverCtrl;
            if (ctrl) {
              ctrl.fire('mouseleave', { target: ctrl.getEl() });
              ctrl.parents().each(function (ctrl) {
                ctrl.fire('mouseleave', { target: ctrl.getEl() });
              });
              eventRootCtrl._lastHoverCtrl = null;
            }
          }
          function mouseEnterHandler(e) {
            var ctrl = self.getParentCtrl(e.target), lastCtrl = eventRootCtrl._lastHoverCtrl, idx = 0, i, parents, lastParents;
            if (ctrl !== lastCtrl) {
              eventRootCtrl._lastHoverCtrl = ctrl;
              parents = ctrl.parents().toArray().reverse();
              parents.push(ctrl);
              if (lastCtrl) {
                lastParents = lastCtrl.parents().toArray().reverse();
                lastParents.push(lastCtrl);
                for (idx = 0; idx < lastParents.length; idx++) {
                  if (parents[idx] !== lastParents[idx]) {
                    break;
                  }
                }
                for (i = lastParents.length - 1; i >= idx; i--) {
                  lastCtrl = lastParents[i];
                  lastCtrl.fire('mouseleave', { target: lastCtrl.getEl() });
                }
              }
              for (i = idx; i < parents.length; i++) {
                ctrl = parents[i];
                ctrl.fire('mouseenter', { target: ctrl.getEl() });
              }
            }
          }
          function fixWheelEvent(e) {
            e.preventDefault();
            if (e.type == 'mousewheel') {
              e.deltaY = -1 / 40 * e.wheelDelta;
              if (e.wheelDeltaX) {
                e.deltaX = -1 / 40 * e.wheelDeltaX;
              }
            } else {
              e.deltaX = 0;
              e.deltaY = e.detail;
            }
            e = self.fire('wheel', e);
          }
          self._rendered = true;
          nativeEvents = self._nativeEvents;
          if (nativeEvents) {
            parents = self.parents().toArray();
            parents.unshift(self);
            for (i = 0, l = parents.length; !eventRootCtrl && i < l; i++) {
              eventRootCtrl = parents[i]._eventsRoot;
            }
            if (!eventRootCtrl) {
              eventRootCtrl = parents[parents.length - 1] || self;
            }
            self._eventsRoot = eventRootCtrl;
            for (l = i, i = 0; i < l; i++) {
              parents[i]._eventsRoot = eventRootCtrl;
            }
            for (name in nativeEvents) {
              if (!nativeEvents) {
                return false;
              }
              if (name === 'wheel' && !hasWheelEventSupport) {
                if (hasMouseWheelEventSupport) {
                  DomUtils.on(self.getEl(), 'mousewheel', fixWheelEvent);
                } else {
                  DomUtils.on(self.getEl(), 'DOMMouseScroll', fixWheelEvent);
                }
                continue;
              }
              if (name === 'mouseenter' || name === 'mouseleave') {
                if (!eventRootCtrl._hasMouseEnter) {
                  DomUtils.on(eventRootCtrl.getEl(), 'mouseleave', mouseLeaveHandler);
                  DomUtils.on(eventRootCtrl.getEl(), 'mouseover', mouseEnterHandler);
                  eventRootCtrl._hasMouseEnter = 1;
                }
              } else if (!eventRootCtrl[name]) {
                DomUtils.on(eventRootCtrl.getEl(), name, delegate);
                eventRootCtrl[name] = true;
              }
              nativeEvents[name] = false;
            }
          }
        },
        getRoot: function () {
          var ctrl = this, rootControl, parents = [];
          while (ctrl) {
            if (ctrl.rootControl) {
              rootControl = ctrl.rootControl;
              break;
            }
            parents.push(ctrl);
            rootControl = ctrl;
            ctrl = ctrl.parent();
          }
          if (!rootControl) {
            rootControl = this;
          }
          var i = parents.length;
          while (i--) {
            parents[i].rootControl = rootControl;
          }
          return rootControl;
        },
        reflow: function () {
          this.repaint();
          return this;
        }
      });
    return Control;
  });
  define('tinymce/ui/Factory', [], function () {
    'use strict';
    var types = {}, namespaceInit;
    return {
      add: function (type, typeClass) {
        types[type.toLowerCase()] = typeClass;
      },
      has: function (type) {
        return !!types[type.toLowerCase()];
      },
      create: function (type, settings) {
        var ControlType, name, namespace;
        if (!namespaceInit) {
          namespace = tinymce.ui;
          for (name in namespace) {
            types[name.toLowerCase()] = namespace[name];
          }
          namespaceInit = true;
        }
        if (typeof type == 'string') {
          settings = settings || {};
          settings.type = type;
        } else {
          settings = type;
          type = settings.type;
        }
        type = type.toLowerCase();
        ControlType = types[type];
        if (!ControlType) {
          throw new Error('Could not find control by type: ' + type);
        }
        ControlType = new ControlType(settings);
        ControlType.type = type;
        return ControlType;
      }
    };
  });
  define('tinymce/ui/KeyboardNavigation', [], function () {
    'use strict';
    return function (settings) {
      var root = settings.root, focusedElement, focusedControl;
      focusedElement = document.activeElement;
      focusedControl = root.getParentCtrl(focusedElement);
      function getRole(elm) {
        elm = elm || focusedElement;
        return elm && elm.getAttribute('role');
      }
      function getParentRole(elm) {
        var role, parent = elm || focusedElement;
        while (parent = parent.parentNode) {
          if (role = getRole(parent)) {
            return role;
          }
        }
      }
      function getAriaProp(name) {
        var elm = focusedElement;
        if (elm) {
          return elm.getAttribute('aria-' + name);
        }
      }
      function isTextInputElement(elm) {
        return elm.tagName == 'INPUT' || elm.tagName == 'TEXTAREA';
      }
      function canFocus(elm) {
        if (isTextInputElement(elm) && !elm.hidden) {
          return true;
        }
        if (/^(button|menuitem|checkbox|tab|menuitemcheckbox|option|gridcell)$/.test(getRole(elm))) {
          return true;
        }
        return false;
      }
      function getFocusElements(elm) {
        var elements = [];
        function collect(elm) {
          if (elm.nodeType != 1 || elm.style.display == 'none') {
            return;
          }
          if (canFocus(elm)) {
            elements.push(elm);
          }
          for (var i = 0; i < elm.childNodes.length; i++) {
            collect(elm.childNodes[i]);
          }
        }
        collect(elm || root.getEl());
        return elements;
      }
      function getNavigationRoot(targetControl) {
        var navigationRoot, controls;
        targetControl = targetControl || focusedControl;
        controls = targetControl.parents().toArray();
        controls.unshift(targetControl);
        for (var i = 0; i < controls.length; i++) {
          navigationRoot = controls[i];
          if (navigationRoot.settings.ariaRoot) {
            break;
          }
        }
        return navigationRoot;
      }
      function focusFirst(targetControl) {
        var navigationRoot = getNavigationRoot(targetControl);
        var focusElements = getFocusElements(navigationRoot.getEl());
        if (navigationRoot.settings.ariaRemember && 'lastAriaIndex' in navigationRoot) {
          moveFocusToIndex(navigationRoot.lastAriaIndex, focusElements);
        } else {
          moveFocusToIndex(0, focusElements);
        }
      }
      function moveFocusToIndex(idx, elements) {
        if (idx < 0) {
          idx = elements.length - 1;
        } else if (idx >= elements.length) {
          idx = 0;
        }
        if (elements[idx]) {
          elements[idx].focus();
        }
        return idx;
      }
      function moveFocus(dir, elements) {
        var idx = -1, navigationRoot = getNavigationRoot();
        elements = elements || getFocusElements(navigationRoot.getEl());
        for (var i = 0; i < elements.length; i++) {
          if (elements[i] === focusedElement) {
            idx = i;
          }
        }
        idx += dir;
        navigationRoot.lastAriaIndex = moveFocusToIndex(idx, elements);
      }
      function left() {
        var parentRole = getParentRole();
        if (parentRole == 'tablist') {
          moveFocus(-1, getFocusElements(focusedElement.parentNode));
        } else if (focusedControl.parent().submenu) {
          cancel();
        } else {
          moveFocus(-1);
        }
      }
      function right() {
        var role = getRole(), parentRole = getParentRole();
        if (parentRole == 'tablist') {
          moveFocus(1, getFocusElements(focusedElement.parentNode));
        } else if (role == 'menuitem' && parentRole == 'menu' && getAriaProp('haspopup')) {
          enter();
        } else {
          moveFocus(1);
        }
      }
      function up() {
        moveFocus(-1);
      }
      function down() {
        var role = getRole(), parentRole = getParentRole();
        if (role == 'menuitem' && parentRole == 'menubar') {
          enter();
        } else if (role == 'button' && getAriaProp('haspopup')) {
          enter({ key: 'down' });
        } else {
          moveFocus(1);
        }
      }
      function tab(e) {
        var parentRole = getParentRole();
        if (parentRole == 'tablist') {
          var elm = getFocusElements(focusedControl.getEl('body'))[0];
          if (elm) {
            elm.focus();
          }
        } else {
          moveFocus(e.shiftKey ? -1 : 1);
        }
      }
      function cancel() {
        focusedControl.fire('cancel');
      }
      function enter(aria) {
        aria = aria || {};
        focusedControl.fire('click', {
          target: focusedElement,
          aria: aria
        });
      }
      root.on('keydown', function (e) {
        function handleNonTabEvent(e, handler) {
          if (isTextInputElement(focusedElement)) {
            return;
          }
          if (handler(e) !== false) {
            e.preventDefault();
          }
        }
        if (e.isDefaultPrevented()) {
          return;
        }
        switch (e.keyCode) {
        case 37:
          handleNonTabEvent(e, left);
          break;
        case 39:
          handleNonTabEvent(e, right);
          break;
        case 38:
          handleNonTabEvent(e, up);
          break;
        case 40:
          handleNonTabEvent(e, down);
          break;
        case 27:
          handleNonTabEvent(e, cancel);
          break;
        case 14:
        case 13:
        case 32:
          handleNonTabEvent(e, enter);
          break;
        case 9:
          if (tab(e) !== false) {
            e.preventDefault();
          }
          break;
        }
      });
      root.on('focusin', function (e) {
        focusedElement = e.target;
        focusedControl = e.control;
      });
      return { focusFirst: focusFirst };
    };
  });
  define('tinymce/ui/Container', [
    'tinymce/ui/Control',
    'tinymce/ui/Collection',
    'tinymce/ui/Selector',
    'tinymce/ui/Factory',
    'tinymce/ui/KeyboardNavigation',
    'tinymce/util/Tools',
    'tinymce/ui/DomUtils'
  ], function (Control, Collection, Selector, Factory, KeyboardNavigation, Tools, DomUtils) {
    'use strict';
    var selectorCache = {};
    return Control.extend({
      layout: '',
      innerClass: 'container-inner',
      init: function (settings) {
        var self = this;
        self._super(settings);
        settings = self.settings;
        self._fixed = settings.fixed;
        self._items = new Collection();
        if (self.isRtl()) {
          self.addClass('rtl');
        }
        self.addClass('container');
        self.addClass('container-body', 'body');
        if (settings.containerCls) {
          self.addClass(settings.containerCls);
        }
        self._layout = Factory.create((settings.layout || self.layout) + 'layout');
        if (self.settings.items) {
          self.add(self.settings.items);
        }
        self._hasBody = true;
      },
      items: function () {
        return this._items;
      },
      find: function (selector) {
        selector = selectorCache[selector] = selectorCache[selector] || new Selector(selector);
        return selector.find(this);
      },
      add: function (items) {
        var self = this;
        self.items().add(self.create(items)).parent(self);
        return self;
      },
      focus: function (keyboard) {
        var self = this, focusCtrl, keyboardNav, items;
        if (keyboard) {
          keyboardNav = self.keyboardNav || self.parents().eq(-1)[0].keyboardNav;
          if (keyboardNav) {
            keyboardNav.focusFirst(self);
            return;
          }
        }
        items = self.find('*');
        if (self.statusbar) {
          items.add(self.statusbar.items());
        }
        items.each(function (ctrl) {
          if (ctrl.settings.autofocus) {
            focusCtrl = null;
            return false;
          }
          if (ctrl.canFocus) {
            focusCtrl = focusCtrl || ctrl;
          }
        });
        if (focusCtrl) {
          focusCtrl.focus();
        }
        return self;
      },
      replace: function (oldItem, newItem) {
        var ctrlElm, items = this.items(), i = items.length;
        while (i--) {
          if (items[i] === oldItem) {
            items[i] = newItem;
            break;
          }
        }
        if (i >= 0) {
          ctrlElm = newItem.getEl();
          if (ctrlElm) {
            ctrlElm.parentNode.removeChild(ctrlElm);
          }
          ctrlElm = oldItem.getEl();
          if (ctrlElm) {
            ctrlElm.parentNode.removeChild(ctrlElm);
          }
        }
        newItem.parent(this);
      },
      create: function (items) {
        var self = this, settings, ctrlItems = [];
        if (!Tools.isArray(items)) {
          items = [items];
        }
        Tools.each(items, function (item) {
          if (item) {
            if (!(item instanceof Control)) {
              if (typeof item == 'string') {
                item = { type: item };
              }
              settings = Tools.extend({}, self.settings.defaults, item);
              item.type = settings.type = settings.type || item.type || self.settings.defaultType || (settings.defaults ? settings.defaults.type : null);
              item = Factory.create(settings);
            }
            ctrlItems.push(item);
          }
        });
        return ctrlItems;
      },
      renderNew: function () {
        var self = this;
        self.items().each(function (ctrl, index) {
          var containerElm, fragment;
          ctrl.parent(self);
          if (!ctrl._rendered) {
            containerElm = self.getEl('body');
            fragment = DomUtils.createFragment(ctrl.renderHtml());
            if (containerElm.hasChildNodes() && index <= containerElm.childNodes.length - 1) {
              containerElm.insertBefore(fragment, containerElm.childNodes[index]);
            } else {
              containerElm.appendChild(fragment);
            }
            ctrl.postRender();
          }
        });
        self._layout.applyClasses(self);
        self._lastRect = null;
        return self;
      },
      append: function (items) {
        return this.add(items).renderNew();
      },
      prepend: function (items) {
        var self = this;
        self.items().set(self.create(items).concat(self.items().toArray()));
        return self.renderNew();
      },
      insert: function (items, index, before) {
        var self = this, curItems, beforeItems, afterItems;
        items = self.create(items);
        curItems = self.items();
        if (!before && index < curItems.length - 1) {
          index += 1;
        }
        if (index >= 0 && index < curItems.length) {
          beforeItems = curItems.slice(0, index).toArray();
          afterItems = curItems.slice(index).toArray();
          curItems.set(beforeItems.concat(items, afterItems));
        }
        return self.renderNew();
      },
      fromJSON: function (data) {
        var self = this;
        for (var name in data) {
          self.find('#' + name).value(data[name]);
        }
        return self;
      },
      toJSON: function () {
        var self = this, data = {};
        self.find('*').each(function (ctrl) {
          var name = ctrl.name(), value = ctrl.value();
          if (name && typeof value != 'undefined') {
            data[name] = value;
          }
        });
        return data;
      },
      preRender: function () {
      },
      renderHtml: function () {
        var self = this, layout = self._layout, role = this.settings.role;
        self.preRender();
        layout.preRender(self);
        return '<div id="' + self._id + '" class="' + self.classes() + '"' + (role ? ' role="' + this.settings.role + '"' : '') + '>' + '<div id="' + self._id + '-body" class="' + self.classes('body') + '">' + (self.settings.html || '') + layout.renderHtml(self) + '</div>' + '</div>';
      },
      postRender: function () {
        var self = this, box;
        self.items().exec('postRender');
        self._super();
        self._layout.postRender(self);
        self._rendered = true;
        if (self.settings.style) {
          DomUtils.css(self.getEl(), self.settings.style);
        }
        if (self.settings.border) {
          box = self.borderBox();
          DomUtils.css(self.getEl(), {
            'border-top-width': box.top,
            'border-right-width': box.right,
            'border-bottom-width': box.bottom,
            'border-left-width': box.left
          });
        }
        if (!self.parent()) {
          self.keyboardNav = new KeyboardNavigation({ root: self });
        }
        return self;
      },
      initLayoutRect: function () {
        var self = this, layoutRect = self._super();
        self._layout.recalc(self);
        return layoutRect;
      },
      recalc: function () {
        var self = this, rect = self._layoutRect, lastRect = self._lastRect;
        if (!lastRect || lastRect.w != rect.w || lastRect.h != rect.h) {
          self._layout.recalc(self);
          rect = self.layoutRect();
          self._lastRect = {
            x: rect.x,
            y: rect.y,
            w: rect.w,
            h: rect.h
          };
          return true;
        }
      },
      reflow: function () {
        var i;
        if (this.visible()) {
          Control.repaintControls = [];
          Control.repaintControls.map = {};
          this.recalc();
          i = Control.repaintControls.length;
          while (i--) {
            Control.repaintControls[i].repaint();
          }
          if (this.settings.layout !== 'flow' && this.settings.layout !== 'stack') {
            this.repaint();
          }
          Control.repaintControls = [];
        }
        return this;
      }
    });
  });
  define('tinymce/ui/DragHelper', ['tinymce/ui/DomUtils'], function (DomUtils) {
    'use strict';
    function getDocumentSize() {
      var doc = document, documentElement, body, scrollWidth, clientWidth;
      var offsetWidth, scrollHeight, clientHeight, offsetHeight, max = Math.max;
      documentElement = doc.documentElement;
      body = doc.body;
      scrollWidth = max(documentElement.scrollWidth, body.scrollWidth);
      clientWidth = max(documentElement.clientWidth, body.clientWidth);
      offsetWidth = max(documentElement.offsetWidth, body.offsetWidth);
      scrollHeight = max(documentElement.scrollHeight, body.scrollHeight);
      clientHeight = max(documentElement.clientHeight, body.clientHeight);
      offsetHeight = max(documentElement.offsetHeight, body.offsetHeight);
      return {
        width: scrollWidth < offsetWidth ? clientWidth : scrollWidth,
        height: scrollHeight < offsetHeight ? clientHeight : scrollHeight
      };
    }
    return function (id, settings) {
      var eventOverlayElm, doc = document, downButton, start, stop, drag, startX, startY;
      settings = settings || {};
      function getHandleElm() {
        return doc.getElementById(settings.handle || id);
      }
      start = function (e) {
        var docSize = getDocumentSize(), handleElm, cursor;
        e.preventDefault();
        downButton = e.button;
        handleElm = getHandleElm();
        startX = e.screenX;
        startY = e.screenY;
        if (window.getComputedStyle) {
          cursor = window.getComputedStyle(handleElm, null).getPropertyValue('cursor');
        } else {
          cursor = handleElm.runtimeStyle.cursor;
        }
        eventOverlayElm = doc.createElement('div');
        DomUtils.css(eventOverlayElm, {
          position: 'absolute',
          top: 0,
          left: 0,
          width: docSize.width,
          height: docSize.height,
          zIndex: 2147483647,
          opacity: 0.0001,
          background: 'red',
          cursor: cursor
        });
        doc.body.appendChild(eventOverlayElm);
        DomUtils.on(doc, 'mousemove', drag);
        DomUtils.on(doc, 'mouseup', stop);
        settings.start(e);
      };
      drag = function (e) {
        if (e.button !== downButton) {
          return stop(e);
        }
        e.deltaX = e.screenX - startX;
        e.deltaY = e.screenY - startY;
        e.preventDefault();
        settings.drag(e);
      };
      stop = function (e) {
        DomUtils.off(doc, 'mousemove', drag);
        DomUtils.off(doc, 'mouseup', stop);
        eventOverlayElm.parentNode.removeChild(eventOverlayElm);
        if (settings.stop) {
          settings.stop(e);
        }
      };
      this.destroy = function () {
        DomUtils.off(getHandleElm());
      };
      DomUtils.on(getHandleElm(), 'mousedown', start);
    };
  });
  define('tinymce/ui/Scrollable', [
    'tinymce/ui/DomUtils',
    'tinymce/ui/DragHelper'
  ], function (DomUtils, DragHelper) {
    'use strict';
    return {
      init: function () {
        var self = this;
        self.on('repaint', self.renderScroll);
      },
      renderScroll: function () {
        var self = this, margin = 2;
        function repaintScroll() {
          var hasScrollH, hasScrollV, bodyElm;
          function repaintAxis(axisName, posName, sizeName, contentSizeName, hasScroll, ax) {
            var containerElm, scrollBarElm, scrollThumbElm;
            var containerSize, scrollSize, ratio, rect;
            var posNameLower, sizeNameLower;
            scrollBarElm = self.getEl('scroll' + axisName);
            if (scrollBarElm) {
              posNameLower = posName.toLowerCase();
              sizeNameLower = sizeName.toLowerCase();
              if (self.getEl('absend')) {
                DomUtils.css(self.getEl('absend'), posNameLower, self.layoutRect()[contentSizeName] - 1);
              }
              if (!hasScroll) {
                DomUtils.css(scrollBarElm, 'display', 'none');
                return;
              }
              DomUtils.css(scrollBarElm, 'display', 'block');
              containerElm = self.getEl('body');
              scrollThumbElm = self.getEl('scroll' + axisName + 't');
              containerSize = containerElm['client' + sizeName] - margin * 2;
              containerSize -= hasScrollH && hasScrollV ? scrollBarElm['client' + ax] : 0;
              scrollSize = containerElm['scroll' + sizeName];
              ratio = containerSize / scrollSize;
              rect = {};
              rect[posNameLower] = containerElm['offset' + posName] + margin;
              rect[sizeNameLower] = containerSize;
              DomUtils.css(scrollBarElm, rect);
              rect = {};
              rect[posNameLower] = containerElm['scroll' + posName] * ratio;
              rect[sizeNameLower] = containerSize * ratio;
              DomUtils.css(scrollThumbElm, rect);
            }
          }
          bodyElm = self.getEl('body');
          hasScrollH = bodyElm.scrollWidth > bodyElm.clientWidth;
          hasScrollV = bodyElm.scrollHeight > bodyElm.clientHeight;
          repaintAxis('h', 'Left', 'Width', 'contentW', hasScrollH, 'Height');
          repaintAxis('v', 'Top', 'Height', 'contentH', hasScrollV, 'Width');
        }
        function addScroll() {
          function addScrollAxis(axisName, posName, sizeName, deltaPosName, ax) {
            var scrollStart, axisId = self._id + '-scroll' + axisName, prefix = self.classPrefix;
            self.getEl().appendChild(DomUtils.createFragment('<div id="' + axisId + '" class="' + prefix + 'scrollbar ' + prefix + 'scrollbar-' + axisName + '">' + '<div id="' + axisId + 't" class="' + prefix + 'scrollbar-thumb"></div>' + '</div>'));
            self.draghelper = new DragHelper(axisId + 't', {
              start: function () {
                scrollStart = self.getEl('body')['scroll' + posName];
                DomUtils.addClass(DomUtils.get(axisId), prefix + 'active');
              },
              drag: function (e) {
                var ratio, hasScrollH, hasScrollV, containerSize, layoutRect = self.layoutRect();
                hasScrollH = layoutRect.contentW > layoutRect.innerW;
                hasScrollV = layoutRect.contentH > layoutRect.innerH;
                containerSize = self.getEl('body')['client' + sizeName] - margin * 2;
                containerSize -= hasScrollH && hasScrollV ? self.getEl('scroll' + axisName)['client' + ax] : 0;
                ratio = containerSize / self.getEl('body')['scroll' + sizeName];
                self.getEl('body')['scroll' + posName] = scrollStart + e['delta' + deltaPosName] / ratio;
              },
              stop: function () {
                DomUtils.removeClass(DomUtils.get(axisId), prefix + 'active');
              }
            });
          }
          self.addClass('scroll');
          addScrollAxis('v', 'Top', 'Height', 'Y', 'Width');
          addScrollAxis('h', 'Left', 'Width', 'X', 'Height');
        }
        if (self.settings.autoScroll) {
          if (!self._hasScroll) {
            self._hasScroll = true;
            addScroll();
            self.on('wheel', function (e) {
              var bodyEl = self.getEl('body');
              bodyEl.scrollLeft += (e.deltaX || 0) * 10;
              bodyEl.scrollTop += e.deltaY * 10;
              repaintScroll();
            });
            DomUtils.on(self.getEl('body'), 'scroll', repaintScroll);
          }
          repaintScroll();
        }
      }
    };
  });
  define('tinymce/ui/Panel', [
    'tinymce/ui/Container',
    'tinymce/ui/Scrollable'
  ], function (Container, Scrollable) {
    'use strict';
    return Container.extend({
      Defaults: {
        layout: 'fit',
        containerCls: 'panel'
      },
      Mixins: [Scrollable],
      renderHtml: function () {
        var self = this, layout = self._layout, innerHtml = self.settings.html;
        self.preRender();
        layout.preRender(self);
        if (typeof innerHtml == 'undefined') {
          innerHtml = '<div id="' + self._id + '-body" class="' + self.classes('body') + '">' + layout.renderHtml(self) + '</div>';
        } else {
          if (typeof innerHtml == 'function') {
            innerHtml = innerHtml.call(self);
          }
          self._hasBody = false;
        }
        return '<div id="' + self._id + '" class="' + self.classes() + '" hideFocus="1" tabIndex="-1" role="group">' + (self._preBodyHtml || '') + innerHtml + '</div>';
      }
    });
  });
  define('tinymce/ui/Movable', ['tinymce/ui/DomUtils'], function (DomUtils) {
    'use strict';
    function calculateRelativePosition(ctrl, targetElm, rel) {
      var ctrlElm, pos, x, y, selfW, selfH, targetW, targetH, viewport, size;
      viewport = DomUtils.getViewPort();
      pos = DomUtils.getPos(targetElm);
      x = pos.x;
      y = pos.y;
      if (ctrl._fixed) {
        x -= viewport.x;
        y -= viewport.y;
      }
      ctrlElm = ctrl.getEl();
      size = DomUtils.getSize(ctrlElm);
      selfW = size.width;
      selfH = size.height;
      size = DomUtils.getSize(targetElm);
      targetW = size.width;
      targetH = size.height;
      rel = (rel || '').split('');
      if (rel[0] === 'b') {
        y += targetH;
      }
      if (rel[1] === 'r') {
        x += targetW;
      }
      if (rel[0] === 'c') {
        y += Math.round(targetH / 2);
      }
      if (rel[1] === 'c') {
        x += Math.round(targetW / 2);
      }
      if (rel[3] === 'b') {
        y -= selfH;
      }
      if (rel[4] === 'r') {
        x -= selfW;
      }
      if (rel[3] === 'c') {
        y -= Math.round(selfH / 2);
      }
      if (rel[4] === 'c') {
        x -= Math.round(selfW / 2);
      }
      return {
        x: x,
        y: y,
        w: selfW,
        h: selfH
      };
    }
    return {
      testMoveRel: function (elm, rels) {
        var viewPortRect = DomUtils.getViewPort();
        for (var i = 0; i < rels.length; i++) {
          var pos = calculateRelativePosition(this, elm, rels[i]);
          if (this._fixed) {
            if (pos.x > 0 && pos.x + pos.w < viewPortRect.w && pos.y > 0 && pos.y + pos.h < viewPortRect.h) {
              return rels[i];
            }
          } else {
            if (pos.x > viewPortRect.x && pos.x + pos.w < viewPortRect.w + viewPortRect.x && pos.y > viewPortRect.y && pos.y + pos.h < viewPortRect.h + viewPortRect.y) {
              return rels[i];
            }
          }
        }
        return rels[0];
      },
      moveRel: function (elm, rel) {
        if (typeof rel != 'string') {
          rel = this.testMoveRel(elm, rel);
        }
        var pos = calculateRelativePosition(this, elm, rel);
        return this.moveTo(pos.x, pos.y);
      },
      moveBy: function (dx, dy) {
        var self = this, rect = self.layoutRect();
        self.moveTo(rect.x + dx, rect.y + dy);
        return self;
      },
      moveTo: function (x, y) {
        var self = this;
        function contrain(value, max, size) {
          if (value < 0) {
            return 0;
          }
          if (value + size > max) {
            value = max - size;
            return value < 0 ? 0 : value;
          }
          return value;
        }
        if (self.settings.constrainToViewport) {
          var viewPortRect = DomUtils.getViewPort(window);
          var layoutRect = self.layoutRect();
          x = contrain(x, viewPortRect.w + viewPortRect.x, layoutRect.w);
          y = contrain(y, viewPortRect.h + viewPortRect.y, layoutRect.h);
        }
        if (self._rendered) {
          self.layoutRect({
            x: x,
            y: y
          }).repaint();
        } else {
          self.settings.x = x;
          self.settings.y = y;
        }
        self.fire('move', {
          x: x,
          y: y
        });
        return self;
      }
    };
  });
  define('tinymce/ui/Resizable', ['tinymce/ui/DomUtils'], function (DomUtils) {
    'use strict';
    return {
      resizeToContent: function () {
        this._layoutRect.autoResize = true;
        this._lastRect = null;
        this.reflow();
      },
      resizeTo: function (w, h) {
        if (w <= 1 || h <= 1) {
          var rect = DomUtils.getWindowSize();
          w = w <= 1 ? w * rect.w : w;
          h = h <= 1 ? h * rect.h : h;
        }
        this._layoutRect.autoResize = false;
        return this.layoutRect({
          minW: w,
          minH: h,
          w: w,
          h: h
        }).reflow();
      },
      resizeBy: function (dw, dh) {
        var self = this, rect = self.layoutRect();
        return self.resizeTo(rect.w + dw, rect.h + dh);
      }
    };
  });
  define('tinymce/ui/FloatPanel', [
    'tinymce/ui/Panel',
    'tinymce/ui/Movable',
    'tinymce/ui/Resizable',
    'tinymce/ui/DomUtils'
  ], function (Panel, Movable, Resizable, DomUtils) {
    'use strict';
    var documentClickHandler, documentScrollHandler, visiblePanels = [];
    var zOrder = [], hasModal;
    var FloatPanel = Panel.extend({
        Mixins: [
          Movable,
          Resizable
        ],
        init: function (settings) {
          var self = this;
          function reorder() {
            var i, zIndex = FloatPanel.zIndex || 65535, topModal;
            if (zOrder.length) {
              for (i = 0; i < zOrder.length; i++) {
                if (zOrder[i].modal) {
                  zIndex++;
                  topModal = zOrder[i];
                }
                zOrder[i].getEl().style.zIndex = zIndex;
                zOrder[i].zIndex = zIndex;
                zIndex++;
              }
            }
            var modalBlockEl = document.getElementById(self.classPrefix + 'modal-block');
            if (topModal) {
              DomUtils.css(modalBlockEl, 'z-index', topModal.zIndex - 1);
            } else if (modalBlockEl) {
              modalBlockEl.parentNode.removeChild(modalBlockEl);
              hasModal = false;
            }
            FloatPanel.currentZIndex = zIndex;
          }
          function isChildOf(ctrl, parent) {
            while (ctrl) {
              if (ctrl == parent) {
                return true;
              }
              ctrl = ctrl.parent();
            }
          }
          function repositionPanel(panel) {
            var scrollY = DomUtils.getViewPort().y;
            function toggleFixedChildPanels(fixed, deltaY) {
              var parent;
              for (var i = 0; i < visiblePanels.length; i++) {
                if (visiblePanels[i] != panel) {
                  parent = visiblePanels[i].parent();
                  while (parent && (parent = parent.parent())) {
                    if (parent == panel) {
                      visiblePanels[i].fixed(fixed).moveBy(0, deltaY).repaint();
                    }
                  }
                }
              }
            }
            if (panel.settings.autofix) {
              if (!panel._fixed) {
                panel._autoFixY = panel.layoutRect().y;
                if (panel._autoFixY < scrollY) {
                  panel.fixed(true).layoutRect({ y: 0 }).repaint();
                  toggleFixedChildPanels(true, scrollY - panel._autoFixY);
                }
              } else {
                if (panel._autoFixY > scrollY) {
                  panel.fixed(false).layoutRect({ y: panel._autoFixY }).repaint();
                  toggleFixedChildPanels(false, panel._autoFixY - scrollY);
                }
              }
            }
          }
          self._super(settings);
          self._eventsRoot = self;
          self.addClass('floatpanel');
          if (settings.autohide) {
            if (!documentClickHandler) {
              documentClickHandler = function (e) {
                var i = visiblePanels.length;
                while (i--) {
                  var panel = visiblePanels[i], clickCtrl = panel.getParentCtrl(e.target);
                  if (panel.settings.autohide) {
                    if (clickCtrl) {
                      if (isChildOf(clickCtrl, panel) || panel.parent() === clickCtrl) {
                        continue;
                      }
                    }
                    e = panel.fire('autohide', { target: e.target });
                    if (!e.isDefaultPrevented()) {
                      panel.hide();
                    }
                  }
                }
              };
              DomUtils.on(document, 'click', documentClickHandler);
            }
            visiblePanels.push(self);
          }
          if (settings.autofix) {
            if (!documentScrollHandler) {
              documentScrollHandler = function () {
                var i;
                i = visiblePanels.length;
                while (i--) {
                  repositionPanel(visiblePanels[i]);
                }
              };
              DomUtils.on(window, 'scroll', documentScrollHandler);
            }
            self.on('move', function () {
              repositionPanel(this);
            });
          }
          self.on('postrender show', function (e) {
            if (e.control == self) {
              var modalBlockEl, prefix = self.classPrefix;
              if (self.modal && !hasModal) {
                modalBlockEl = DomUtils.createFragment('<div id="' + prefix + 'modal-block" class="' + prefix + 'reset ' + prefix + 'fade"></div>');
                modalBlockEl = modalBlockEl.firstChild;
                self.getContainerElm().appendChild(modalBlockEl);
                setTimeout(function () {
                  DomUtils.addClass(modalBlockEl, prefix + 'in');
                  DomUtils.addClass(self.getEl(), prefix + 'in');
                }, 0);
                hasModal = true;
              }
              zOrder.push(self);
              reorder();
            }
          });
          self.on('close hide', function (e) {
            if (e.control == self) {
              var i = zOrder.length;
              while (i--) {
                if (zOrder[i] === self) {
                  zOrder.splice(i, 1);
                }
              }
              reorder();
            }
          });
          self.on('show', function () {
            self.parents().each(function (ctrl) {
              if (ctrl._fixed) {
                self.fixed(true);
                return false;
              }
            });
          });
          if (settings.popover) {
            self._preBodyHtml = '<div class="' + self.classPrefix + 'arrow"></div>';
            self.addClass('popover').addClass('bottom').addClass(self.isRtl() ? 'end' : 'start');
          }
        },
        fixed: function (state) {
          var self = this;
          if (self._fixed != state) {
            if (self._rendered) {
              var viewport = DomUtils.getViewPort();
              if (state) {
                self.layoutRect().y -= viewport.y;
              } else {
                self.layoutRect().y += viewport.y;
              }
            }
            self.toggleClass('fixed', state);
            self._fixed = state;
          }
          return self;
        },
        show: function () {
          var self = this, i, state = self._super();
          i = visiblePanels.length;
          while (i--) {
            if (visiblePanels[i] === self) {
              break;
            }
          }
          if (i === -1) {
            visiblePanels.push(self);
          }
          return state;
        },
        hide: function () {
          removeVisiblePanel(this);
          return this._super();
        },
        hideAll: function () {
          FloatPanel.hideAll();
        },
        close: function () {
          var self = this;
          self.fire('close');
          return self.remove();
        },
        remove: function () {
          removeVisiblePanel(this);
          this._super();
        },
        postRender: function () {
          var self = this;
          if (self.settings.bodyRole) {
            this.getEl('body').setAttribute('role', self.settings.bodyRole);
          }
          return self._super();
        }
      });
    FloatPanel.hideAll = function () {
      var i = visiblePanels.length;
      while (i--) {
        var panel = visiblePanels[i];
        if (panel && panel.settings.autohide) {
          panel.hide();
          visiblePanels.splice(i, 1);
        }
      }
    };
    function removeVisiblePanel(panel) {
      var i;
      i = visiblePanels.length;
      while (i--) {
        if (visiblePanels[i] === panel) {
          visiblePanels.splice(i, 1);
        }
      }
      i = zOrder.length;
      while (i--) {
        if (zOrder[i] === panel) {
          zOrder.splice(i, 1);
        }
      }
    }
    return FloatPanel;
  });
  define('tinymce/ui/Window', [
    'tinymce/ui/FloatPanel',
    'tinymce/ui/Panel',
    'tinymce/ui/DomUtils',
    'tinymce/ui/DragHelper'
  ], function (FloatPanel, Panel, DomUtils, DragHelper) {
    'use strict';
    var Window = FloatPanel.extend({
        modal: true,
        Defaults: {
          border: 1,
          layout: 'flex',
          containerCls: 'panel',
          role: 'dialog',
          callbacks: {
            submit: function () {
              this.fire('submit', { data: this.toJSON() });
            },
            close: function () {
              this.close();
            }
          }
        },
        init: function (settings) {
          var self = this;
          self._super(settings);
          if (self.isRtl()) {
            self.addClass('rtl');
          }
          self.addClass('window');
          self._fixed = true;
          if (settings.buttons) {
            self.statusbar = new Panel({
              layout: 'flex',
              border: '1 0 0 0',
              spacing: 3,
              padding: 10,
              align: 'center',
              pack: self.isRtl() ? 'start' : 'end',
              defaults: { type: 'button' },
              items: settings.buttons
            });
            self.statusbar.addClass('foot');
            self.statusbar.parent(self);
          }
          self.on('click', function (e) {
            if (e.target.className.indexOf(self.classPrefix + 'close') != -1) {
              self.close();
            }
          });
          self.on('cancel', function () {
            self.close();
          });
          self.aria('describedby', self.describedBy || self._id + '-none');
          self.aria('label', settings.title);
          self._fullscreen = false;
        },
        recalc: function () {
          var self = this, statusbar = self.statusbar, layoutRect, width, x, needsRecalc;
          if (self._fullscreen) {
            self.layoutRect(DomUtils.getWindowSize());
            self.layoutRect().contentH = self.layoutRect().innerH;
          }
          self._super();
          layoutRect = self.layoutRect();
          if (self.settings.title && !self._fullscreen) {
            width = layoutRect.headerW;
            if (width > layoutRect.w) {
              x = layoutRect.x - Math.max(0, width / 2);
              self.layoutRect({
                w: width,
                x: x
              });
              needsRecalc = true;
            }
          }
          if (statusbar) {
            statusbar.layoutRect({ w: self.layoutRect().innerW }).recalc();
            width = statusbar.layoutRect().minW + layoutRect.deltaW;
            if (width > layoutRect.w) {
              x = layoutRect.x - Math.max(0, width - layoutRect.w);
              self.layoutRect({
                w: width,
                x: x
              });
              needsRecalc = true;
            }
          }
          if (needsRecalc) {
            self.recalc();
          }
        },
        initLayoutRect: function () {
          var self = this, layoutRect = self._super(), deltaH = 0, headEl;
          if (self.settings.title && !self._fullscreen) {
            headEl = self.getEl('head');
            var size = DomUtils.getSize(headEl);
            layoutRect.headerW = size.width;
            layoutRect.headerH = size.height;
            deltaH += layoutRect.headerH;
          }
          if (self.statusbar) {
            deltaH += self.statusbar.layoutRect().h;
          }
          layoutRect.deltaH += deltaH;
          layoutRect.minH += deltaH;
          layoutRect.h += deltaH;
          var rect = DomUtils.getWindowSize();
          layoutRect.x = Math.max(0, rect.w / 2 - layoutRect.w / 2);
          layoutRect.y = Math.max(0, rect.h / 2 - layoutRect.h / 2);
          return layoutRect;
        },
        renderHtml: function () {
          var self = this, layout = self._layout, id = self._id, prefix = self.classPrefix;
          var settings = self.settings, headerHtml = '', footerHtml = '', html = settings.html;
          self.preRender();
          layout.preRender(self);
          if (settings.title) {
            headerHtml = '<div id="' + id + '-head" class="' + prefix + 'window-head">' + '<div id="' + id + '-title" class="' + prefix + 'title">' + self.encode(settings.title) + '</div>' + '<button type="button" class="' + prefix + 'close" aria-hidden="true">&times;</button>' + '<div id="' + id + '-dragh" class="' + prefix + 'dragh"></div>' + '</div>';
          }
          if (settings.url) {
            html = '<iframe src="' + settings.url + '" tabindex="-1"></iframe>';
          }
          if (typeof html == 'undefined') {
            html = layout.renderHtml(self);
          }
          if (self.statusbar) {
            footerHtml = self.statusbar.renderHtml();
          }
          return '<div id="' + id + '" class="' + self.classes() + '" hideFocus="1">' + '<div class="' + self.classPrefix + 'reset" role="application">' + headerHtml + '<div id="' + id + '-body" class="' + self.classes('body') + '">' + html + '</div>' + footerHtml + '</div>' + '</div>';
        },
        fullscreen: function (state) {
          var self = this, documentElement = document.documentElement, slowRendering, prefix = self.classPrefix, layoutRect;
          if (state != self._fullscreen) {
            DomUtils.on(window, 'resize', function () {
              var time;
              if (self._fullscreen) {
                if (!slowRendering) {
                  time = new Date().getTime();
                  var rect = DomUtils.getWindowSize();
                  self.moveTo(0, 0).resizeTo(rect.w, rect.h);
                  if (new Date().getTime() - time > 50) {
                    slowRendering = true;
                  }
                } else {
                  if (!self._timer) {
                    self._timer = setTimeout(function () {
                      var rect = DomUtils.getWindowSize();
                      self.moveTo(0, 0).resizeTo(rect.w, rect.h);
                      self._timer = 0;
                    }, 50);
                  }
                }
              }
            });
            layoutRect = self.layoutRect();
            self._fullscreen = state;
            if (!state) {
              self._borderBox = self.parseBox(self.settings.border);
              self.getEl('head').style.display = '';
              layoutRect.deltaH += layoutRect.headerH;
              DomUtils.removeClass(documentElement, prefix + 'fullscreen');
              DomUtils.removeClass(document.body, prefix + 'fullscreen');
              self.removeClass('fullscreen');
              self.moveTo(self._initial.x, self._initial.y).resizeTo(self._initial.w, self._initial.h);
            } else {
              self._initial = {
                x: layoutRect.x,
                y: layoutRect.y,
                w: layoutRect.w,
                h: layoutRect.h
              };
              self._borderBox = self.parseBox('0');
              self.getEl('head').style.display = 'none';
              layoutRect.deltaH -= layoutRect.headerH + 2;
              DomUtils.addClass(documentElement, prefix + 'fullscreen');
              DomUtils.addClass(document.body, prefix + 'fullscreen');
              self.addClass('fullscreen');
              var rect = DomUtils.getWindowSize();
              self.moveTo(0, 0).resizeTo(rect.w, rect.h);
            }
          }
          return self.reflow();
        },
        postRender: function () {
          var self = this, startPos;
          setTimeout(function () {
            self.addClass('in');
          }, 0);
          self._super();
          if (self.statusbar) {
            self.statusbar.postRender();
          }
          self.focus();
          this.dragHelper = new DragHelper(self._id + '-dragh', {
            start: function () {
              startPos = {
                x: self.layoutRect().x,
                y: self.layoutRect().y
              };
            },
            drag: function (e) {
              self.moveTo(startPos.x + e.deltaX, startPos.y + e.deltaY);
            }
          });
          self.on('submit', function (e) {
            if (!e.isDefaultPrevented()) {
              self.close();
            }
          });
        },
        submit: function () {
          return this.fire('submit', { data: this.toJSON() });
        },
        remove: function () {
          var self = this, prefix = self.classPrefix;
          self.dragHelper.destroy();
          self._super();
          if (self.statusbar) {
            this.statusbar.remove();
          }
          if (self._fullscreen) {
            DomUtils.removeClass(document.documentElement, prefix + 'fullscreen');
            DomUtils.removeClass(document.body, prefix + 'fullscreen');
          }
        }
      });
    return Window;
  });
  define('tinymce/ui/MessageBox', ['tinymce/ui/Window'], function (Window) {
    'use strict';
    var MessageBox = Window.extend({
        init: function (settings) {
          settings = {
            border: 1,
            padding: 20,
            layout: 'flex',
            pack: 'center',
            align: 'center',
            containerCls: 'panel',
            autoScroll: true,
            buttons: {
              type: 'button',
              text: 'Ok',
              action: 'ok'
            },
            items: {
              type: 'label',
              multiline: true,
              maxWidth: 500,
              maxHeight: 200
            }
          };
          this._super(settings);
        },
        Statics: {
          OK: 1,
          OK_CANCEL: 2,
          YES_NO: 3,
          YES_NO_CANCEL: 4,
          msgBox: function (settings) {
            var buttons, callback = settings.callback || function () {
              };
            switch (settings.buttons) {
            case MessageBox.OK_CANCEL:
              buttons = [
                {
                  type: 'button',
                  text: 'Ok',
                  subtype: 'primary',
                  onClick: function (e) {
                    e.control.parents()[1].close();
                    callback(true);
                  }
                },
                {
                  type: 'button',
                  text: 'Cancel',
                  onClick: function (e) {
                    e.control.parents()[1].close();
                    callback(false);
                  }
                }
              ];
              break;
            case MessageBox.YES_NO:
              buttons = [{
                  type: 'button',
                  text: 'Ok',
                  subtype: 'primary',
                  onClick: function (e) {
                    e.control.parents()[1].close();
                    callback(true);
                  }
                }];
              break;
            case MessageBox.YES_NO_CANCEL:
              buttons = [{
                  type: 'button',
                  text: 'Ok',
                  subtype: 'primary',
                  onClick: function (e) {
                    e.control.parents()[1].close();
                  }
                }];
              break;
            default:
              buttons = [{
                  type: 'button',
                  text: 'Ok',
                  subtype: 'primary',
                  onClick: function (e) {
                    e.control.parents()[1].close();
                    callback(true);
                  }
                }];
              break;
            }
            return new Window({
              padding: 20,
              x: settings.x,
              y: settings.y,
              minWidth: 300,
              minHeight: 100,
              layout: 'flex',
              pack: 'center',
              align: 'center',
              buttons: buttons,
              title: settings.title,
              role: 'alertdialog',
              items: {
                type: 'label',
                multiline: true,
                maxWidth: 500,
                maxHeight: 200,
                text: settings.text
              },
              onPostRender: function () {
                this.aria('describedby', this.items()[0]._id);
              },
              onClose: settings.onClose,
              onCancel: function () {
                callback(false);
              }
            }).renderTo(document.body).reflow();
          },
          alert: function (settings, callback) {
            if (typeof settings == 'string') {
              settings = { text: settings };
            }
            settings.callback = callback;
            return MessageBox.msgBox(settings);
          },
          confirm: function (settings, callback) {
            if (typeof settings == 'string') {
              settings = { text: settings };
            }
            settings.callback = callback;
            settings.buttons = MessageBox.OK_CANCEL;
            return MessageBox.msgBox(settings);
          }
        }
      });
    return MessageBox;
  });
  define('tinymce/WindowManager', [
    'tinymce/ui/Window',
    'tinymce/ui/MessageBox'
  ], function (Window, MessageBox) {
    return function (editor) {
      var self = this, windows = [];
      function getTopMostWindow() {
        if (windows.length) {
          return windows[windows.length - 1];
        }
      }
      self.windows = windows;
      self.open = function (args, params) {
        var win;
        editor.editorManager.activeEditor = editor;
        args.title = args.title || ' ';
        args.url = args.url || args.file;
        if (args.url) {
          args.width = parseInt(args.width || 320, 10);
          args.height = parseInt(args.height || 240, 10);
        }
        if (args.body) {
          args.items = {
            defaults: args.defaults,
            type: args.bodyType || 'form',
            items: args.body
          };
        }
        if (!args.url && !args.buttons) {
          args.buttons = [
            {
              text: 'Ok',
              subtype: 'primary',
              onclick: function () {
                win.find('form')[0].submit();
                win.close();
              }
            },
            {
              text: 'Cancel',
              onclick: function () {
                win.close();
              }
            }
          ];
        }
        win = new Window(args);
        windows.push(win);
        win.on('close', function () {
          var i = windows.length;
          while (i--) {
            if (windows[i] === win) {
              windows.splice(i, 1);
            }
          }
          editor.focus();
        });
        if (args.data) {
          win.on('postRender', function () {
            this.find('*').each(function (ctrl) {
              var name = ctrl.name();
              if (name in args.data) {
                ctrl.value(args.data[name]);
              }
            });
          });
        }
        win.features = args || {};
        win.params = params || {};
        editor.nodeChanged();
        return win.renderTo(document.body).reflow();
      };
      self.alert = function (message, callback, scope) {
        MessageBox.alert(message, function () {
          if (callback) {
            callback.call(scope || this);
          } else {
            editor.focus();
          }
        });
      };
      self.confirm = function (message, callback, scope) {
        MessageBox.confirm(message, function (state) {
          callback.call(scope || this, state);
        });
      };
      self.close = function () {
        if (getTopMostWindow()) {
          getTopMostWindow().close();
        }
      };
      self.getParams = function () {
        return getTopMostWindow() ? getTopMostWindow().params : null;
      };
      self.setParams = function (params) {
        if (getTopMostWindow()) {
          getTopMostWindow().params = params;
        }
      };
    };
  });
  define('tinymce/util/Quirks', [
    'tinymce/util/VK',
    'tinymce/dom/RangeUtils',
    'tinymce/html/Node',
    'tinymce/html/Entities',
    'tinymce/Env',
    'tinymce/util/Tools'
  ], function (VK, RangeUtils, Node, Entities, Env, Tools) {
    return function (editor) {
      var each = Tools.each;
      var BACKSPACE = VK.BACKSPACE, DELETE = VK.DELETE, dom = editor.dom, selection = editor.selection, settings = editor.settings, parser = editor.parser, serializer = editor.serializer;
      var isGecko = Env.gecko, isIE = Env.ie, isWebKit = Env.webkit;
      function setEditorCommandState(cmd, state) {
        try {
          editor.getDoc().execCommand(cmd, false, state);
        } catch (ex) {
        }
      }
      function getDocumentMode() {
        var documentMode = editor.getDoc().documentMode;
        return documentMode ? documentMode : 6;
      }
      function isDefaultPrevented(e) {
        return e.isDefaultPrevented();
      }
      function cleanupStylesWhenDeleting() {
        var doc = editor.getDoc(), urlPrefix = 'data:text/mce-internal,';
        if (!window.MutationObserver) {
          return;
        }
        function customDelete(isForward) {
          var mutationObserver = new MutationObserver(function () {
            });
          Tools.each(editor.getBody().getElementsByTagName('*'), function (elm) {
            if (elm.tagName == 'SPAN') {
              elm.setAttribute('mce-data-marked', 1);
            }
            if (!elm.hasAttribute('data-mce-style') && elm.hasAttribute('style')) {
              editor.dom.setAttrib(elm, 'style', elm.getAttribute('style'));
            }
          });
          mutationObserver.observe(editor.getDoc(), {
            childList: true,
            attributes: true,
            subtree: true,
            attributeFilter: ['style']
          });
          editor.getDoc().execCommand(isForward ? 'ForwardDelete' : 'Delete', false, null);
          var rng = editor.selection.getRng();
          var caretElement = rng.startContainer.parentNode;
          Tools.each(mutationObserver.takeRecords(), function (record) {
            if (record.attributeName == 'style') {
              var oldValue = record.target.getAttribute('data-mce-style');
              if (oldValue) {
                record.target.setAttribute('style', oldValue);
              } else {
                record.target.removeAttribute('style');
              }
            }
            Tools.each(record.addedNodes, function (node) {
              if (node.nodeName == 'SPAN' && !node.getAttribute('mce-data-marked')) {
                var offset, container;
                if (node == caretElement) {
                  offset = rng.startOffset;
                  container = node.firstChild;
                }
                dom.remove(node, true);
                if (container) {
                  rng.setStart(container, offset);
                  rng.setEnd(container, offset);
                  editor.selection.setRng(rng);
                }
              }
            });
          });
          mutationObserver.disconnect();
          Tools.each(editor.dom.select('span[mce-data-marked]'), function (span) {
            span.removeAttribute('mce-data-marked');
          });
        }
        editor.on('keydown', function (e) {
          var isForward = e.keyCode == DELETE, isMeta = VK.metaKeyPressed(e);
          if (!isDefaultPrevented(e) && (isForward || e.keyCode == BACKSPACE)) {
            var rng = editor.selection.getRng(), container = rng.startContainer, offset = rng.startOffset;
            if (!isMeta && rng.collapsed && container.nodeType == 3) {
              if (isForward ? offset < container.data.length : offset > 0) {
                return;
              }
            }
            e.preventDefault();
            if (isMeta) {
              editor.selection.getSel().modify('extend', isForward ? 'forward' : 'backward', 'word');
            }
            customDelete(isForward);
          }
        });
        editor.on('keypress', function (e) {
          if (!isDefaultPrevented(e) && !selection.isCollapsed() && e.charCode && !VK.metaKeyPressed(e)) {
            e.preventDefault();
            customDelete(true);
            editor.selection.setContent(String.fromCharCode(e.charCode));
          }
        });
        editor.addCommand('Delete', function () {
          customDelete();
        });
        editor.addCommand('ForwardDelete', function () {
          customDelete(true);
        });
        editor.on('dragstart', function (e) {
          e.dataTransfer.setData('URL', 'data:text/mce-internal,' + escape(editor.selection.getContent()));
        });
        editor.on('drop', function (e) {
          if (!isDefaultPrevented(e)) {
            var internalContent = e.dataTransfer.getData('URL');
            if (!internalContent || internalContent.indexOf(urlPrefix) == -1 || !doc.caretRangeFromPoint) {
              return;
            }
            internalContent = unescape(internalContent.substr(urlPrefix.length));
            if (doc.caretRangeFromPoint) {
              e.preventDefault();
              customDelete();
              editor.selection.setRng(doc.caretRangeFromPoint(e.x, e.y));
              editor.insertContent(internalContent);
            }
          }
        });
        editor.on('cut', function (e) {
          if (!isDefaultPrevented(e) && e.clipboardData) {
            e.preventDefault();
            e.clipboardData.clearData();
            e.clipboardData.setData('text/html', editor.selection.getContent());
            e.clipboardData.setData('text/plain', editor.selection.getContent({ format: 'text' }));
            customDelete(true);
          }
        });
      }
      function emptyEditorWhenDeleting() {
        function serializeRng(rng) {
          var body = dom.create('body');
          var contents = rng.cloneContents();
          body.appendChild(contents);
          return selection.serializer.serialize(body, { format: 'html' });
        }
        function allContentsSelected(rng) {
          if (!rng.setStart) {
            if (rng.item) {
              return false;
            }
            var bodyRng = rng.duplicate();
            bodyRng.moveToElementText(editor.getBody());
            return RangeUtils.compareRanges(rng, bodyRng);
          }
          var selection = serializeRng(rng);
          var allRng = dom.createRng();
          allRng.selectNode(editor.getBody());
          var allSelection = serializeRng(allRng);
          return selection === allSelection;
        }
        editor.on('keydown', function (e) {
          var keyCode = e.keyCode, isCollapsed, body;
          if (!isDefaultPrevented(e) && (keyCode == DELETE || keyCode == BACKSPACE)) {
            isCollapsed = editor.selection.isCollapsed();
            body = editor.getBody();
            if (isCollapsed && !dom.isEmpty(body)) {
              return;
            }
            if (!isCollapsed && !allContentsSelected(editor.selection.getRng())) {
              return;
            }
            e.preventDefault();
            editor.setContent('');
            if (body.firstChild && dom.isBlock(body.firstChild)) {
              editor.selection.setCursorLocation(body.firstChild, 0);
            } else {
              editor.selection.setCursorLocation(body, 0);
            }
            editor.nodeChanged();
          }
        });
      }
      function selectAll() {
        editor.on('keydown', function (e) {
          if (!isDefaultPrevented(e) && e.keyCode == 65 && VK.metaKeyPressed(e)) {
            e.preventDefault();
            editor.execCommand('SelectAll');
          }
        });
      }
      function inputMethodFocus() {
        if (!editor.settings.content_editable) {
          dom.bind(editor.getDoc(), 'focusin', function () {
            selection.setRng(selection.getRng());
          });
          dom.bind(editor.getDoc(), 'mousedown', function (e) {
            if (e.target == editor.getDoc().documentElement) {
              editor.getBody().focus();
              selection.setRng(selection.getRng());
            }
          });
        }
      }
      function removeHrOnBackspace() {
        editor.on('keydown', function (e) {
          if (!isDefaultPrevented(e) && e.keyCode === BACKSPACE) {
            if (selection.isCollapsed() && selection.getRng(true).startOffset === 0) {
              var node = selection.getNode();
              var previousSibling = node.previousSibling;
              if (node.nodeName == 'HR') {
                dom.remove(node);
                e.preventDefault();
                return;
              }
              if (previousSibling && previousSibling.nodeName && previousSibling.nodeName.toLowerCase() === 'hr') {
                dom.remove(previousSibling);
                e.preventDefault();
              }
            }
          }
        });
      }
      function focusBody() {
        if (!window.Range.prototype.getClientRects) {
          editor.on('mousedown', function (e) {
            if (!isDefaultPrevented(e) && e.target.nodeName === 'HTML') {
              var body = editor.getBody();
              body.blur();
              setTimeout(function () {
                body.focus();
              }, 0);
            }
          });
        }
      }
      function selectControlElements() {
        editor.on('click', function (e) {
          e = e.target;
          if (/^(IMG|HR)$/.test(e.nodeName)) {
            selection.getSel().setBaseAndExtent(e, 0, e, 1);
          }
          if (e.nodeName == 'A' && dom.hasClass(e, 'mce-item-anchor')) {
            selection.select(e);
          }
          editor.nodeChanged();
        });
      }
      function removeStylesWhenDeletingAcrossBlockElements() {
        function getAttributeApplyFunction() {
          var template = dom.getAttribs(selection.getStart().cloneNode(false));
          return function () {
            var target = selection.getStart();
            if (target !== editor.getBody()) {
              dom.setAttrib(target, 'style', null);
              each(template, function (attr) {
                target.setAttributeNode(attr.cloneNode(true));
              });
            }
          };
        }
        function isSelectionAcrossElements() {
          return !selection.isCollapsed() && dom.getParent(selection.getStart(), dom.isBlock) != dom.getParent(selection.getEnd(), dom.isBlock);
        }
        editor.on('keypress', function (e) {
          var applyAttributes;
          if (!isDefaultPrevented(e) && (e.keyCode == 8 || e.keyCode == 46) && isSelectionAcrossElements()) {
            applyAttributes = getAttributeApplyFunction();
            editor.getDoc().execCommand('delete', false, null);
            applyAttributes();
            e.preventDefault();
            return false;
          }
        });
        dom.bind(editor.getDoc(), 'cut', function (e) {
          var applyAttributes;
          if (!isDefaultPrevented(e) && isSelectionAcrossElements()) {
            applyAttributes = getAttributeApplyFunction();
            setTimeout(function () {
              applyAttributes();
            }, 0);
          }
        });
      }
      function selectionChangeNodeChanged() {
        var lastRng, selectionTimer;
        editor.on('selectionchange', function () {
          if (selectionTimer) {
            clearTimeout(selectionTimer);
            selectionTimer = 0;
          }
          selectionTimer = window.setTimeout(function () {
            var rng = selection.getRng();
            if (!lastRng || !RangeUtils.compareRanges(rng, lastRng)) {
              editor.nodeChanged();
              lastRng = rng;
            }
          }, 50);
        });
      }
      function ensureBodyHasRoleApplication() {
        document.body.setAttribute('role', 'application');
      }
      function disableBackspaceIntoATable() {
        editor.on('keydown', function (e) {
          if (!isDefaultPrevented(e) && e.keyCode === BACKSPACE) {
            if (selection.isCollapsed() && selection.getRng(true).startOffset === 0) {
              var previousSibling = selection.getNode().previousSibling;
              if (previousSibling && previousSibling.nodeName && previousSibling.nodeName.toLowerCase() === 'table') {
                e.preventDefault();
                return false;
              }
            }
          }
        });
      }
      function addNewLinesBeforeBrInPre() {
        if (getDocumentMode() > 7) {
          return;
        }
        setEditorCommandState('RespectVisibilityInDesign', true);
        editor.contentStyles.push('.mceHideBrInPre pre br {display: none}');
        dom.addClass(editor.getBody(), 'mceHideBrInPre');
        parser.addNodeFilter('pre', function (nodes) {
          var i = nodes.length, brNodes, j, brElm, sibling;
          while (i--) {
            brNodes = nodes[i].getAll('br');
            j = brNodes.length;
            while (j--) {
              brElm = brNodes[j];
              sibling = brElm.prev;
              if (sibling && sibling.type === 3 && sibling.value.charAt(sibling.value - 1) != '\n') {
                sibling.value += '\n';
              } else {
                brElm.parent.insert(new Node('#text', 3), brElm, true).value = '\n';
              }
            }
          }
        });
        serializer.addNodeFilter('pre', function (nodes) {
          var i = nodes.length, brNodes, j, brElm, sibling;
          while (i--) {
            brNodes = nodes[i].getAll('br');
            j = brNodes.length;
            while (j--) {
              brElm = brNodes[j];
              sibling = brElm.prev;
              if (sibling && sibling.type == 3) {
                sibling.value = sibling.value.replace(/\r?\n$/, '');
              }
            }
          }
        });
      }
      function removePreSerializedStylesWhenSelectingControls() {
        dom.bind(editor.getBody(), 'mouseup', function () {
          var value, node = selection.getNode();
          if (node.nodeName == 'IMG') {
            if (value = dom.getStyle(node, 'width')) {
              dom.setAttrib(node, 'width', value.replace(/[^0-9%]+/g, ''));
              dom.setStyle(node, 'width', '');
            }
            if (value = dom.getStyle(node, 'height')) {
              dom.setAttrib(node, 'height', value.replace(/[^0-9%]+/g, ''));
              dom.setStyle(node, 'height', '');
            }
          }
        });
      }
      function removeBlockQuoteOnBackSpace() {
        editor.on('keydown', function (e) {
          var rng, container, offset, root, parent;
          if (isDefaultPrevented(e) || e.keyCode != VK.BACKSPACE) {
            return;
          }
          rng = selection.getRng();
          container = rng.startContainer;
          offset = rng.startOffset;
          root = dom.getRoot();
          parent = container;
          if (!rng.collapsed || offset !== 0) {
            return;
          }
          while (parent && parent.parentNode && parent.parentNode.firstChild == parent && parent.parentNode != root) {
            parent = parent.parentNode;
          }
          if (parent.tagName === 'BLOCKQUOTE') {
            editor.formatter.toggle('blockquote', null, parent);
            rng = dom.createRng();
            rng.setStart(container, 0);
            rng.setEnd(container, 0);
            selection.setRng(rng);
          }
        });
      }
      function setGeckoEditingOptions() {
        function setOpts() {
          editor._refreshContentEditable();
          setEditorCommandState('StyleWithCSS', false);
          setEditorCommandState('enableInlineTableEditing', false);
          if (!settings.object_resizing) {
            setEditorCommandState('enableObjectResizing', false);
          }
        }
        if (!settings.readonly) {
          editor.on('BeforeExecCommand MouseDown', setOpts);
        }
      }
      function addBrAfterLastLinks() {
        function fixLinks() {
          each(dom.select('a'), function (node) {
            var parentNode = node.parentNode, root = dom.getRoot();
            if (parentNode.lastChild === node) {
              while (parentNode && !dom.isBlock(parentNode)) {
                if (parentNode.parentNode.lastChild !== parentNode || parentNode === root) {
                  return;
                }
                parentNode = parentNode.parentNode;
              }
              dom.add(parentNode, 'br', { 'data-mce-bogus': 1 });
            }
          });
        }
        editor.on('SetContent ExecCommand', function (e) {
          if (e.type == 'setcontent' || e.command === 'mceInsertLink') {
            fixLinks();
          }
        });
      }
      function setDefaultBlockType() {
        if (settings.forced_root_block) {
          editor.on('init', function () {
            setEditorCommandState('DefaultParagraphSeparator', settings.forced_root_block);
          });
        }
      }
      function removeGhostSelection() {
        editor.on('Undo Redo SetContent', function (e) {
          if (!e.initial) {
            editor.execCommand('mceRepaint');
          }
        });
      }
      function deleteControlItemOnBackSpace() {
        editor.on('keydown', function (e) {
          var rng;
          if (!isDefaultPrevented(e) && e.keyCode == BACKSPACE) {
            rng = editor.getDoc().selection.createRange();
            if (rng && rng.item) {
              e.preventDefault();
              editor.undoManager.beforeChange();
              dom.remove(rng.item(0));
              editor.undoManager.add();
            }
          }
        });
      }
      function renderEmptyBlocksFix() {
        var emptyBlocksCSS;
        if (getDocumentMode() >= 10) {
          emptyBlocksCSS = '';
          each('p div h1 h2 h3 h4 h5 h6'.split(' '), function (name, i) {
            emptyBlocksCSS += (i > 0 ? ',' : '') + name + ':empty';
          });
          editor.contentStyles.push(emptyBlocksCSS + '{padding-right: 1px !important}');
        }
      }
      function keepNoScriptContents() {
        if (getDocumentMode() < 9) {
          parser.addNodeFilter('noscript', function (nodes) {
            var i = nodes.length, node, textNode;
            while (i--) {
              node = nodes[i];
              textNode = node.firstChild;
              if (textNode) {
                node.attr('data-mce-innertext', textNode.value);
              }
            }
          });
          serializer.addNodeFilter('noscript', function (nodes) {
            var i = nodes.length, node, textNode, value;
            while (i--) {
              node = nodes[i];
              textNode = nodes[i].firstChild;
              if (textNode) {
                textNode.value = Entities.decode(textNode.value);
              } else {
                value = node.attributes.map['data-mce-innertext'];
                if (value) {
                  node.attr('data-mce-innertext', null);
                  textNode = new Node('#text', 3);
                  textNode.value = value;
                  textNode.raw = true;
                  node.append(textNode);
                }
              }
            }
          });
        }
      }
      function fixCaretSelectionOfDocumentElementOnIe() {
        var doc = dom.doc, body = doc.body, started, startRng, htmlElm;
        function rngFromPoint(x, y) {
          var rng = body.createTextRange();
          try {
            rng.moveToPoint(x, y);
          } catch (ex) {
            rng = null;
          }
          return rng;
        }
        function selectionChange(e) {
          var pointRng;
          if (e.button) {
            pointRng = rngFromPoint(e.x, e.y);
            if (pointRng) {
              if (pointRng.compareEndPoints('StartToStart', startRng) > 0) {
                pointRng.setEndPoint('StartToStart', startRng);
              } else {
                pointRng.setEndPoint('EndToEnd', startRng);
              }
              pointRng.select();
            }
          } else {
            endSelection();
          }
        }
        function endSelection() {
          var rng = doc.selection.createRange();
          if (startRng && !rng.item && rng.compareEndPoints('StartToEnd', rng) === 0) {
            startRng.select();
          }
          dom.unbind(doc, 'mouseup', endSelection);
          dom.unbind(doc, 'mousemove', selectionChange);
          startRng = started = 0;
        }
        doc.documentElement.unselectable = true;
        dom.bind(doc, 'mousedown contextmenu', function (e) {
          if (e.target.nodeName === 'HTML') {
            if (started) {
              endSelection();
            }
            htmlElm = doc.documentElement;
            if (htmlElm.scrollHeight > htmlElm.clientHeight) {
              return;
            }
            started = 1;
            startRng = rngFromPoint(e.x, e.y);
            if (startRng) {
              dom.bind(doc, 'mouseup', endSelection);
              dom.bind(doc, 'mousemove', selectionChange);
              dom.getRoot().focus();
              startRng.select();
            }
          }
        });
      }
      function normalizeSelection() {
        editor.on('keyup focusin', function (e) {
          if (e.keyCode != 65 || !VK.metaKeyPressed(e)) {
            selection.normalize();
          }
        });
      }
      function showBrokenImageIcon() {
        editor.contentStyles.push('img:-moz-broken {' + '-moz-force-broken-image-icon:1;' + 'min-width:24px;' + 'min-height:24px' + '}');
      }
      function restoreFocusOnKeyDown() {
        if (!editor.inline) {
          editor.on('keydown', function () {
            if (document.activeElement == document.body) {
              editor.getWin().focus();
            }
          });
        }
      }
      function bodyHeight() {
        if (!editor.inline) {
          editor.contentStyles.push('body {min-height: 150px}');
          editor.on('click', function (e) {
            if (e.target.nodeName == 'HTML') {
              editor.getBody().focus();
              editor.selection.normalize();
              editor.nodeChanged();
            }
          });
        }
      }
      function blockCmdArrowNavigation() {
        if (Env.mac) {
          editor.on('keydown', function (e) {
            if (VK.metaKeyPressed(e) && (e.keyCode == 37 || e.keyCode == 39)) {
              e.preventDefault();
              editor.selection.getSel().modify('move', e.keyCode == 37 ? 'backward' : 'forward', 'word');
            }
          });
        }
      }
      function disableAutoUrlDetect() {
        setEditorCommandState('AutoUrlDetect', false);
      }
      function doubleTrailingBrElements() {
        if (!editor.inline) {
          editor.on('focus blur', function () {
            var br = editor.dom.create('br');
            editor.getBody().appendChild(br);
            br.parentNode.removeChild(br);
          }, true);
        }
      }
      disableBackspaceIntoATable();
      removeBlockQuoteOnBackSpace();
      emptyEditorWhenDeleting();
      normalizeSelection();
      if (isWebKit) {
        cleanupStylesWhenDeleting();
        inputMethodFocus();
        selectControlElements();
        setDefaultBlockType();
        if (Env.iOS) {
          selectionChangeNodeChanged();
          restoreFocusOnKeyDown();
          bodyHeight();
        } else {
          selectAll();
        }
      }
      if (isIE && Env.ie < 11) {
        removeHrOnBackspace();
        ensureBodyHasRoleApplication();
        addNewLinesBeforeBrInPre();
        removePreSerializedStylesWhenSelectingControls();
        deleteControlItemOnBackSpace();
        renderEmptyBlocksFix();
        keepNoScriptContents();
        fixCaretSelectionOfDocumentElementOnIe();
      }
      if (Env.ie >= 11) {
        bodyHeight();
        doubleTrailingBrElements();
      }
      if (Env.ie) {
        selectAll();
        disableAutoUrlDetect();
      }
      if (isGecko) {
        removeHrOnBackspace();
        focusBody();
        removeStylesWhenDeletingAcrossBlockElements();
        setGeckoEditingOptions();
        addBrAfterLastLinks();
        removeGhostSelection();
        showBrokenImageIcon();
        blockCmdArrowNavigation();
      }
    };
  });
  define('tinymce/util/Observable', ['tinymce/util/Tools'], function (Tools) {
    var bindingsName = '__bindings';
    var nativeEvents = Tools.makeMap('focusin focusout click dblclick mousedown mouseup mousemove mouseover beforepaste paste cut copy selectionchange' + ' mouseout mouseenter mouseleave keydown keypress keyup contextmenu dragstart dragend dragover draggesture dragdrop drop drag', ' ');
    function returnFalse() {
      return false;
    }
    function returnTrue() {
      return true;
    }
    return {
      fire: function (name, args, bubble) {
        var self = this, handlers, i, l, callback, parent;
        if (self.removed) {
          return;
        }
        name = name.toLowerCase();
        args = args || {};
        args.type = name;
        if (!args.target) {
          args.target = self;
        }
        if (!args.preventDefault) {
          args.preventDefault = function () {
            args.isDefaultPrevented = returnTrue;
          };
          args.stopPropagation = function () {
            args.isPropagationStopped = returnTrue;
          };
          args.stopImmediatePropagation = function () {
            args.isImmediatePropagationStopped = returnTrue;
          };
          args.isDefaultPrevented = returnFalse;
          args.isPropagationStopped = returnFalse;
          args.isImmediatePropagationStopped = returnFalse;
        }
        if (self[bindingsName]) {
          handlers = self[bindingsName][name];
          if (handlers) {
            for (i = 0, l = handlers.length; i < l; i++) {
              handlers[i] = callback = handlers[i];
              if (args.isImmediatePropagationStopped()) {
                break;
              }
              if (callback.call(self, args) === false) {
                args.preventDefault();
                return args;
              }
            }
          }
        }
        if (bubble !== false && self.parent) {
          parent = self.parent();
          while (parent && !args.isPropagationStopped()) {
            parent.fire(name, args, false);
            parent = parent.parent();
          }
        }
        return args;
      },
      on: function (name, callback, prepend) {
        var self = this, bindings, handlers, names, i;
        if (callback === false) {
          callback = function () {
            return false;
          };
        }
        if (callback) {
          names = name.toLowerCase().split(' ');
          i = names.length;
          while (i--) {
            name = names[i];
            bindings = self[bindingsName];
            if (!bindings) {
              bindings = self[bindingsName] = {};
            }
            handlers = bindings[name];
            if (!handlers) {
              handlers = bindings[name] = [];
              if (self.bindNative && nativeEvents[name]) {
                self.bindNative(name);
              }
            }
            if (prepend) {
              handlers.unshift(callback);
            } else {
              handlers.push(callback);
            }
          }
        }
        return self;
      },
      off: function (name, callback) {
        var self = this, i, bindings = self[bindingsName], handlers, bindingName, names, hi;
        if (bindings) {
          if (name) {
            names = name.toLowerCase().split(' ');
            i = names.length;
            while (i--) {
              name = names[i];
              handlers = bindings[name];
              if (!name) {
                for (bindingName in bindings) {
                  bindings[name].length = 0;
                }
                return self;
              }
              if (handlers) {
                if (!callback) {
                  handlers.length = 0;
                } else {
                  hi = handlers.length;
                  while (hi--) {
                    if (handlers[hi] === callback) {
                      handlers.splice(hi, 1);
                    }
                  }
                }
                if (!handlers.length && self.unbindNative && nativeEvents[name]) {
                  self.unbindNative(name);
                  delete bindings[name];
                }
              }
            }
          } else {
            if (self.unbindNative) {
              for (name in bindings) {
                self.unbindNative(name);
              }
            }
            self[bindingsName] = [];
          }
        }
        return self;
      },
      hasEventListeners: function (name) {
        var bindings = this[bindingsName];
        name = name.toLowerCase();
        return !(!bindings || !bindings[name] || bindings[name].length === 0);
      }
    };
  });
  define('tinymce/Shortcuts', [
    'tinymce/util/Tools',
    'tinymce/Env'
  ], function (Tools, Env) {
    var each = Tools.each, explode = Tools.explode;
    var keyCodeLookup = {
        'f9': 120,
        'f10': 121,
        'f11': 122
      };
    return function (editor) {
      var self = this, shortcuts = {};
      editor.on('keyup keypress keydown', function (e) {
        if (e.altKey || e.ctrlKey || e.metaKey) {
          each(shortcuts, function (shortcut) {
            var ctrlKey = Env.mac ? e.metaKey : e.ctrlKey;
            if (shortcut.ctrl != ctrlKey || shortcut.alt != e.altKey || shortcut.shift != e.shiftKey) {
              return;
            }
            if (e.keyCode == shortcut.keyCode || e.charCode && e.charCode == shortcut.charCode) {
              e.preventDefault();
              if (e.type == 'keydown') {
                shortcut.func.call(shortcut.scope);
              }
              return true;
            }
          });
        }
      });
      self.add = function (pattern, desc, cmdFunc, scope) {
        var cmd;
        cmd = cmdFunc;
        if (typeof cmdFunc === 'string') {
          cmdFunc = function () {
            editor.execCommand(cmd, false, null);
          };
        } else if (Tools.isArray(cmd)) {
          cmdFunc = function () {
            editor.execCommand(cmd[0], cmd[1], cmd[2]);
          };
        }
        each(explode(pattern.toLowerCase()), function (pattern) {
          var shortcut = {
              func: cmdFunc,
              scope: scope || editor,
              desc: editor.translate(desc),
              alt: false,
              ctrl: false,
              shift: false
            };
          each(explode(pattern, '+'), function (value) {
            switch (value) {
            case 'alt':
            case 'ctrl':
            case 'shift':
              shortcut[value] = true;
              break;
            default:
              shortcut.charCode = value.charCodeAt(0);
              shortcut.keyCode = keyCodeLookup[value] || value.toUpperCase().charCodeAt(0);
            }
          });
          shortcuts[(shortcut.ctrl ? 'ctrl' : '') + ',' + (shortcut.alt ? 'alt' : '') + ',' + (shortcut.shift ? 'shift' : '') + ',' + shortcut.keyCode] = shortcut;
        });
        return true;
      };
    };
  });
  define('tinymce/Editor', [
    'tinymce/dom/DOMUtils',
    'tinymce/AddOnManager',
    'tinymce/html/Node',
    'tinymce/dom/Serializer',
    'tinymce/html/Serializer',
    'tinymce/dom/Selection',
    'tinymce/Formatter',
    'tinymce/UndoManager',
    'tinymce/EnterKey',
    'tinymce/ForceBlocks',
    'tinymce/EditorCommands',
    'tinymce/util/URI',
    'tinymce/dom/ScriptLoader',
    'tinymce/dom/EventUtils',
    'tinymce/WindowManager',
    'tinymce/html/Schema',
    'tinymce/html/DomParser',
    'tinymce/util/Quirks',
    'tinymce/Env',
    'tinymce/util/Tools',
    'tinymce/util/Observable',
    'tinymce/Shortcuts'
  ], function (DOMUtils, AddOnManager, Node, DomSerializer, Serializer, Selection, Formatter, UndoManager, EnterKey, ForceBlocks, EditorCommands, URI, ScriptLoader, EventUtils, WindowManager, Schema, DomParser, Quirks, Env, Tools, Observable, Shortcuts) {
    var DOM = DOMUtils.DOM, ThemeManager = AddOnManager.ThemeManager, PluginManager = AddOnManager.PluginManager;
    var extend = Tools.extend, each = Tools.each, explode = Tools.explode;
    var inArray = Tools.inArray, trim = Tools.trim, resolve = Tools.resolve;
    var Event = EventUtils.Event;
    var isGecko = Env.gecko, ie = Env.ie;
    function getEventTarget(editor, eventName) {
      if (eventName == 'selectionchange') {
        return editor.getDoc();
      }
      if (!editor.inline && /^mouse|click|contextmenu|drop/.test(eventName)) {
        return editor.getDoc();
      }
      return editor.getBody();
    }
    function Editor(id, settings, editorManager) {
      var self = this, documentBaseUrl, baseUri;
      documentBaseUrl = self.documentBaseUrl = editorManager.documentBaseURL;
      baseUri = editorManager.baseURI;
      self.settings = settings = extend({
        id: id,
        theme: 'modern',
        delta_width: 0,
        delta_height: 0,
        popup_css: '',
        plugins: '',
        document_base_url: documentBaseUrl,
        add_form_submit_trigger: true,
        submit_patch: true,
        add_unload_trigger: true,
        convert_urls: true,
        relative_urls: true,
        remove_script_host: true,
        object_resizing: true,
        doctype: '<!DOCTYPE html>',
        visual: true,
        font_size_style_values: 'xx-small,x-small,small,medium,large,x-large,xx-large',
        font_size_legacy_values: 'xx-small,small,medium,large,x-large,xx-large,300%',
        forced_root_block: 'p',
        hidden_input: true,
        padd_empty_editor: true,
        render_ui: true,
        indentation: '30px',
        inline_styles: true,
        convert_fonts_to_spans: true,
        indent: 'simple',
        indent_before: 'p,h1,h2,h3,h4,h5,h6,blockquote,div,title,style,pre,script,td,ul,li,area,table,thead,' + 'tfoot,tbody,tr,section,article,hgroup,aside,figure,option,optgroup,datalist',
        indent_after: 'p,h1,h2,h3,h4,h5,h6,blockquote,div,title,style,pre,script,td,ul,li,area,table,thead,' + 'tfoot,tbody,tr,section,article,hgroup,aside,figure,option,optgroup,datalist',
        validate: true,
        entity_encoding: 'named',
        url_converter: self.convertURL,
        url_converter_scope: self,
        ie7_compat: true
      }, settings);
      AddOnManager.language = settings.language || 'en';
      AddOnManager.languageLoad = settings.language_load;
      AddOnManager.baseURL = editorManager.baseURL;
      self.id = settings.id = id;
      self.isNotDirty = true;
      self.plugins = {};
      self.documentBaseURI = new URI(settings.document_base_url || documentBaseUrl, { base_uri: baseUri });
      self.baseURI = baseUri;
      self.contentCSS = [];
      self.contentStyles = [];
      self.shortcuts = new Shortcuts(self);
      self.execCommands = {};
      self.queryStateCommands = {};
      self.queryValueCommands = {};
      self.loadedCSS = {};
      self.suffix = editorManager.suffix;
      self.editorManager = editorManager;
      self.inline = settings.inline;
      editorManager.fire('SetupEditor', self);
      self.execCallback('setup', self);
    }
    Editor.prototype = {
      render: function () {
        var self = this, settings = self.settings, id = self.id, suffix = self.suffix;
        function readyHandler() {
          DOM.unbind(window, 'ready', readyHandler);
          self.render();
        }
        if (!Event.domLoaded) {
          DOM.bind(window, 'ready', readyHandler);
          return;
        }
        if (!self.getElement()) {
          return;
        }
        if (!Env.contentEditable) {
          return;
        }
        if (!settings.inline) {
          self.orgVisibility = self.getElement().style.visibility;
          self.getElement().style.visibility = 'hidden';
        } else {
          self.inline = true;
        }
        var form = self.getElement().form || DOM.getParent(id, 'form');
        if (form) {
          self.formElement = form;
          if (settings.hidden_input && !/TEXTAREA|INPUT/i.test(self.getElement().nodeName)) {
            DOM.insertAfter(DOM.create('input', {
              type: 'hidden',
              name: id
            }), id);
            self.hasHiddenInput = true;
          }
          self.formEventDelegate = function (e) {
            self.fire(e.type, e);
          };
          DOM.bind(form, 'submit reset', self.formEventDelegate);
          self.on('reset', function () {
            self.setContent(self.startContent, { format: 'raw' });
          });
          if (settings.submit_patch && !form.submit.nodeType && !form.submit.length && !form._mceOldSubmit) {
            form._mceOldSubmit = form.submit;
            form.submit = function () {
              self.editorManager.triggerSave();
              self.isNotDirty = true;
              return form._mceOldSubmit(form);
            };
          }
        }
        self.windowManager = new WindowManager(self);
        if (settings.encoding == 'xml') {
          self.on('GetContent', function (e) {
            if (e.save) {
              e.content = DOM.encode(e.content);
            }
          });
        }
        if (settings.add_form_submit_trigger) {
          self.on('submit', function () {
            if (self.initialized) {
              self.save();
            }
          });
        }
        if (settings.add_unload_trigger) {
          self._beforeUnload = function () {
            if (self.initialized && !self.destroyed && !self.isHidden()) {
              self.save({
                format: 'raw',
                no_events: true,
                set_dirty: false
              });
            }
          };
          self.editorManager.on('BeforeUnload', self._beforeUnload);
        }
        function loadScripts() {
          var scriptLoader = ScriptLoader.ScriptLoader;
          if (settings.language && settings.language != 'en' && !settings.language_url) {
            settings.language_url = self.editorManager.baseURL + '/langs/' + settings.language + '.js';
          }
          if (settings.language_url) {
            scriptLoader.add(settings.language_url);
          }
          if (settings.theme && typeof settings.theme != 'function' && settings.theme.charAt(0) != '-' && !ThemeManager.urls[settings.theme]) {
            var themeUrl = settings.theme_url;
            if (themeUrl) {
              themeUrl = self.documentBaseURI.toAbsolute(themeUrl);
            } else {
              themeUrl = 'themes/' + settings.theme + '/theme' + suffix + '.js';
            }
            ThemeManager.load(settings.theme, themeUrl);
          }
          if (Tools.isArray(settings.plugins)) {
            settings.plugins = settings.plugins.join(' ');
          }
          each(settings.external_plugins, function (url, name) {
            PluginManager.load(name, url);
            settings.plugins += ' ' + name;
          });
          each(settings.plugins.split(/[ ,]/), function (plugin) {
            plugin = trim(plugin);
            if (plugin && !PluginManager.urls[plugin]) {
              if (plugin.charAt(0) == '-') {
                plugin = plugin.substr(1, plugin.length);
                var dependencies = PluginManager.dependencies(plugin);
                each(dependencies, function (dep) {
                  var defaultSettings = {
                      prefix: 'plugins/',
                      resource: dep,
                      suffix: '/plugin' + suffix + '.js'
                    };
                  dep = PluginManager.createUrl(defaultSettings, dep);
                  PluginManager.load(dep.resource, dep);
                });
              } else {
                PluginManager.load(plugin, {
                  prefix: 'plugins/',
                  resource: plugin,
                  suffix: '/plugin' + suffix + '.js'
                });
              }
            }
          });
          scriptLoader.loadQueue(function () {
            if (!self.removed) {
              self.init();
            }
          });
        }
        loadScripts();
      },
      init: function () {
        var self = this, settings = self.settings, elm = self.getElement();
        var w, h, minHeight, n, o, Theme, url, bodyId, bodyClass, re, i, initializedPlugins = [];
        self.rtl = this.editorManager.i18n.rtl;
        self.editorManager.add(self);
        settings.aria_label = settings.aria_label || DOM.getAttrib(elm, 'aria-label', self.getLang('aria.rich_text_area'));
        if (settings.theme) {
          if (typeof settings.theme != 'function') {
            settings.theme = settings.theme.replace(/-/, '');
            Theme = ThemeManager.get(settings.theme);
            self.theme = new Theme(self, ThemeManager.urls[settings.theme]);
            if (self.theme.init) {
              self.theme.init(self, ThemeManager.urls[settings.theme] || self.documentBaseUrl.replace(/\/$/, ''));
            }
          } else {
            self.theme = settings.theme;
          }
        }
        function initPlugin(plugin) {
          var Plugin = PluginManager.get(plugin), pluginUrl, pluginInstance;
          pluginUrl = PluginManager.urls[plugin] || self.documentBaseUrl.replace(/\/$/, '');
          plugin = trim(plugin);
          if (Plugin && inArray(initializedPlugins, plugin) === -1) {
            each(PluginManager.dependencies(plugin), function (dep) {
              initPlugin(dep);
            });
            pluginInstance = new Plugin(self, pluginUrl);
            self.plugins[plugin] = pluginInstance;
            if (pluginInstance.init) {
              pluginInstance.init(self, pluginUrl);
              initializedPlugins.push(plugin);
            }
          }
        }
        each(settings.plugins.replace(/\-/g, '').split(/[ ,]/), initPlugin);
        if (settings.render_ui && self.theme) {
          self.orgDisplay = elm.style.display;
          if (typeof settings.theme != 'function') {
            w = settings.width || elm.style.width || elm.offsetWidth;
            h = settings.height || elm.style.height || elm.offsetHeight;
            minHeight = settings.min_height || 100;
            re = /^[0-9\.]+(|px)$/i;
            if (re.test('' + w)) {
              w = Math.max(parseInt(w, 10), 100);
            }
            if (re.test('' + h)) {
              h = Math.max(parseInt(h, 10), minHeight);
            }
            o = self.theme.renderUI({
              targetNode: elm,
              width: w,
              height: h,
              deltaWidth: settings.delta_width,
              deltaHeight: settings.delta_height
            });
            if (!settings.content_editable) {
              DOM.setStyles(o.sizeContainer || o.editorContainer, {
                wi2dth: w,
                h2eight: h
              });
              h = (o.iframeHeight || h) + (typeof h == 'number' ? o.deltaHeight || 0 : '');
              if (h < minHeight) {
                h = minHeight;
              }
            }
          } else {
            o = settings.theme(self, elm);
            if (o.editorContainer.nodeType) {
              o.editorContainer = o.editorContainer.id = o.editorContainer.id || self.id + '_parent';
            }
            if (o.iframeContainer.nodeType) {
              o.iframeContainer = o.iframeContainer.id = o.iframeContainer.id || self.id + '_iframecontainer';
            }
            h = o.iframeHeight || elm.offsetHeight;
          }
          self.editorContainer = o.editorContainer;
        }
        if (settings.content_css) {
          each(explode(settings.content_css), function (u) {
            self.contentCSS.push(self.documentBaseURI.toAbsolute(u));
          });
        }
        if (settings.content_style) {
          self.contentStyles.push(settings.content_style);
        }
        if (settings.content_editable) {
          elm = n = o = null;
          return self.initContentBody();
        }
        self.iframeHTML = settings.doctype + '<html><head>';
        if (settings.document_base_url != self.documentBaseUrl) {
          self.iframeHTML += '<base href="' + self.documentBaseURI.getURI() + '" />';
        }
        if (!Env.caretAfter && settings.ie7_compat) {
          self.iframeHTML += '<meta http-equiv="X-UA-Compatible" content="IE=7" />';
        }
        self.iframeHTML += '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />';
        for (i = 0; i < self.contentCSS.length; i++) {
          var cssUrl = self.contentCSS[i];
          self.iframeHTML += '<link type="text/css" rel="stylesheet" href="' + cssUrl + '" />';
          self.loadedCSS[cssUrl] = true;
        }
        bodyId = settings.body_id || 'tinymce';
        if (bodyId.indexOf('=') != -1) {
          bodyId = self.getParam('body_id', '', 'hash');
          bodyId = bodyId[self.id] || bodyId;
        }
        bodyClass = settings.body_class || '';
        if (bodyClass.indexOf('=') != -1) {
          bodyClass = self.getParam('body_class', '', 'hash');
          bodyClass = bodyClass[self.id] || '';
        }
        self.iframeHTML += '</head><body id="' + bodyId + '" class="mce-content-body ' + bodyClass + '" ' + 'onload="window.parent.tinymce.get(\'' + self.id + '\').fire(\'load\');"><br></body></html>';
        var domainRelaxUrl = 'javascript:(function(){' + 'document.open();document.domain="' + document.domain + '";' + 'var ed = window.parent.tinymce.get("' + self.id + '");document.write(ed.iframeHTML);' + 'document.close();ed.initContentBody(true);})()';
        if (document.domain != location.hostname) {
          url = domainRelaxUrl;
        }
        n = DOM.add(o.iframeContainer, 'iframe', {
          id: self.id + '_ifr',
          src: url || 'javascript:""',
          frameBorder: '0',
          allowTransparency: 'true',
          title: self.editorManager.translate('Rich Text Area. Press ALT-F9 for menu. ' + 'Press ALT-F10 for toolbar. Press ALT-0 for help'),
          style: {
            width: '100%',
            height: h,
            display: 'block'
          }
        });
        if (ie) {
          try {
            self.getDoc();
          } catch (e) {
            n.src = url = domainRelaxUrl;
          }
        }
        self.contentAreaContainer = o.iframeContainer;
        if (o.editorContainer) {
          DOM.get(o.editorContainer).style.display = self.orgDisplay;
        }
        DOM.get(self.id).style.display = 'none';
        DOM.setAttrib(self.id, 'aria-hidden', true);
        if (!url) {
          self.initContentBody();
        }
        elm = n = o = null;
      },
      initContentBody: function (skipWrite) {
        var self = this, settings = self.settings, targetElm = DOM.get(self.id), doc = self.getDoc(), body, contentCssText;
        if (!settings.inline) {
          self.getElement().style.visibility = self.orgVisibility;
        }
        if (!skipWrite && !settings.content_editable) {
          doc.open();
          doc.write(self.iframeHTML);
          doc.close();
        }
        if (settings.content_editable) {
          self.on('remove', function () {
            var bodyEl = this.getBody();
            DOM.removeClass(bodyEl, 'mce-content-body');
            DOM.removeClass(bodyEl, 'mce-edit-focus');
            DOM.setAttrib(bodyEl, 'tabIndex', null);
            DOM.setAttrib(bodyEl, 'contentEditable', null);
          });
          DOM.addClass(targetElm, 'mce-content-body');
          targetElm.tabIndex = -1;
          self.contentDocument = doc = settings.content_document || document;
          self.contentWindow = settings.content_window || window;
          self.bodyElement = targetElm;
          settings.content_document = settings.content_window = null;
          settings.root_name = targetElm.nodeName.toLowerCase();
        }
        body = self.getBody();
        body.disabled = true;
        if (!settings.readonly) {
          if (self.inline && DOM.getStyle(body, 'position', true) == 'static') {
            body.style.position = 'relative';
          }
          body.contentEditable = self.getParam('content_editable_state', true);
        }
        body.disabled = false;
        self.schema = new Schema(settings);
        self.dom = new DOMUtils(doc, {
          keep_values: true,
          url_converter: self.convertURL,
          url_converter_scope: self,
          hex_colors: settings.force_hex_style_colors,
          class_filter: settings.class_filter,
          update_styles: true,
          root_element: settings.content_editable ? self.id : null,
          collect: settings.content_editable,
          schema: self.schema,
          onSetAttrib: function (e) {
            self.fire('SetAttrib', e);
          }
        });
        self.parser = new DomParser(settings, self.schema);
        self.parser.addAttributeFilter('src,href,style', function (nodes, name) {
          var i = nodes.length, node, dom = self.dom, value, internalName;
          while (i--) {
            node = nodes[i];
            value = node.attr(name);
            internalName = 'data-mce-' + name;
            if (!node.attributes.map[internalName]) {
              if (name === 'style') {
                node.attr(internalName, dom.serializeStyle(dom.parseStyle(value), node.name));
              } else {
                node.attr(internalName, self.convertURL(value, name, node.name));
              }
            }
          }
        });
        self.parser.addNodeFilter('script', function (nodes) {
          var i = nodes.length, node;
          while (i--) {
            node = nodes[i];
            node.attr('type', 'mce-' + (node.attr('type') || 'text/javascript'));
          }
        });
        self.parser.addNodeFilter('#cdata', function (nodes) {
          var i = nodes.length, node;
          while (i--) {
            node = nodes[i];
            node.type = 8;
            node.name = '#comment';
            node.value = '[CDATA[' + node.value + ']]';
          }
        });
        self.parser.addNodeFilter('p,h1,h2,h3,h4,h5,h6,div', function (nodes) {
          var i = nodes.length, node, nonEmptyElements = self.schema.getNonEmptyElements();
          while (i--) {
            node = nodes[i];
            if (node.isEmpty(nonEmptyElements)) {
              node.empty().append(new Node('br', 1)).shortEnded = true;
            }
          }
        });
        self.serializer = new DomSerializer(settings, self);
        self.selection = new Selection(self.dom, self.getWin(), self.serializer, self);
        self.formatter = new Formatter(self);
        self.undoManager = new UndoManager(self);
        self.forceBlocks = new ForceBlocks(self);
        self.enterKey = new EnterKey(self);
        self.editorCommands = new EditorCommands(self);
        self.fire('PreInit');
        if (!settings.browser_spellcheck && !settings.gecko_spellcheck) {
          doc.body.spellcheck = false;
          DOM.setAttrib(body, 'spellcheck', 'false');
        }
        self.fire('PostRender');
        self.quirks = Quirks(self);
        if (settings.directionality) {
          body.dir = settings.directionality;
        }
        if (settings.nowrap) {
          body.style.whiteSpace = 'nowrap';
        }
        if (settings.protect) {
          self.on('BeforeSetContent', function (e) {
            each(settings.protect, function (pattern) {
              e.content = e.content.replace(pattern, function (str) {
                return '<!--mce:protected ' + escape(str) + '-->';
              });
            });
          });
        }
        self.on('SetContent', function () {
          self.addVisual(self.getBody());
        });
        if (settings.padd_empty_editor) {
          self.on('PostProcess', function (e) {
            e.content = e.content.replace(/^(<p[^>]*>(&nbsp;|&#160;|\s|\u00a0|)<\/p>[\r\n]*|<br \/>[\r\n]*)$/, '');
          });
        }
        self.load({
          initial: true,
          format: 'html'
        });
        self.startContent = self.getContent({ format: 'raw' });
        self.initialized = true;
        each(self._pendingNativeEvents, function (name) {
          self.dom.bind(getEventTarget(self, name), name, function (e) {
            self.fire(e.type, e);
          });
        });
        self.fire('init');
        self.focus(true);
        self.nodeChanged({ initial: true });
        self.execCallback('init_instance_callback', self);
        if (self.contentStyles.length > 0) {
          contentCssText = '';
          each(self.contentStyles, function (style) {
            contentCssText += style + '\r\n';
          });
          self.dom.addStyle(contentCssText);
        }
        each(self.contentCSS, function (cssUrl) {
          if (!self.loadedCSS[cssUrl]) {
            self.dom.loadCSS(cssUrl);
            self.loadedCSS[cssUrl] = true;
          }
        });
        if (settings.auto_focus) {
          setTimeout(function () {
            var ed = self.editorManager.get(settings.auto_focus);
            ed.selection.select(ed.getBody(), 1);
            ed.selection.collapse(1);
            ed.getBody().focus();
            ed.getWin().focus();
          }, 100);
        }
        targetElm = doc = body = null;
      },
      focus: function (skip_focus) {
        var oed, self = this, selection = self.selection, contentEditable = self.settings.content_editable, rng;
        var controlElm, doc = self.getDoc(), body;
        if (!skip_focus) {
          rng = selection.getRng();
          if (rng.item) {
            controlElm = rng.item(0);
          }
          self._refreshContentEditable();
          if (!contentEditable) {
            if (!Env.opera) {
              self.getBody().focus();
            }
            self.getWin().focus();
          }
          if (isGecko || contentEditable) {
            body = self.getBody();
            if (body.setActive && Env.ie < 11) {
              body.setActive();
            } else {
              body.focus();
            }
            if (contentEditable) {
              selection.normalize();
            }
          }
          if (controlElm && controlElm.ownerDocument == doc) {
            rng = doc.body.createControlRange();
            rng.addElement(controlElm);
            rng.select();
          }
        }
        if (self.editorManager.activeEditor != self) {
          if (oed = self.editorManager.activeEditor) {
            oed.fire('deactivate', { relatedTarget: self });
          }
          self.fire('activate', { relatedTarget: oed });
        }
        self.editorManager.activeEditor = self;
      },
      execCallback: function (name) {
        var self = this, callback = self.settings[name], scope;
        if (!callback) {
          return;
        }
        if (self.callbackLookup && (scope = self.callbackLookup[name])) {
          callback = scope.func;
          scope = scope.scope;
        }
        if (typeof callback === 'string') {
          scope = callback.replace(/\.\w+$/, '');
          scope = scope ? resolve(scope) : 0;
          callback = resolve(callback);
          self.callbackLookup = self.callbackLookup || {};
          self.callbackLookup[name] = {
            func: callback,
            scope: scope
          };
        }
        return callback.apply(scope || self, Array.prototype.slice.call(arguments, 1));
      },
      translate: function (text) {
        var lang = this.settings.language || 'en', i18n = this.editorManager.i18n;
        if (!text) {
          return '';
        }
        return i18n.data[lang + '.' + text] || text.replace(/\{\#([^\}]+)\}/g, function (a, b) {
          return i18n.data[lang + '.' + b] || '{#' + b + '}';
        });
      },
      getLang: function (name, defaultVal) {
        return this.editorManager.i18n.data[(this.settings.language || 'en') + '.' + name] || (defaultVal !== undefined ? defaultVal : '{#' + name + '}');
      },
      getParam: function (name, defaultVal, type) {
        var value = name in this.settings ? this.settings[name] : defaultVal, output;
        if (type === 'hash') {
          output = {};
          if (typeof value === 'string') {
            each(value.indexOf('=') > 0 ? value.split(/[;,](?![^=;,]*(?:[;,]|$))/) : value.split(','), function (value) {
              value = value.split('=');
              if (value.length > 1) {
                output[trim(value[0])] = trim(value[1]);
              } else {
                output[trim(value[0])] = trim(value);
              }
            });
          } else {
            output = value;
          }
          return output;
        }
        return value;
      },
      nodeChanged: function () {
        var self = this, selection = self.selection, node, parents, root;
        if (self.initialized && !self.settings.disable_nodechange && !self.settings.readonly) {
          root = self.getBody();
          node = selection.getStart() || root;
          node = ie && node.ownerDocument != self.getDoc() ? self.getBody() : node;
          if (node.nodeName == 'IMG' && selection.isCollapsed()) {
            node = node.parentNode;
          }
          parents = [];
          self.dom.getParent(node, function (node) {
            if (node === root) {
              return true;
            }
            parents.push(node);
          });
          self.fire('NodeChange', {
            element: node,
            parents: parents
          });
        }
      },
      addButton: function (name, settings) {
        var self = this;
        if (settings.cmd) {
          settings.onclick = function () {
            self.execCommand(settings.cmd);
          };
        }
        if (!settings.text && !settings.icon) {
          settings.icon = name;
        }
        self.buttons = self.buttons || {};
        settings.tooltip = settings.tooltip || settings.title;
        self.buttons[name] = settings;
      },
      addMenuItem: function (name, settings) {
        var self = this;
        if (settings.cmd) {
          settings.onclick = function () {
            self.execCommand(settings.cmd);
          };
        }
        self.menuItems = self.menuItems || {};
        self.menuItems[name] = settings;
      },
      addCommand: function (name, callback, scope) {
        this.execCommands[name] = {
          func: callback,
          scope: scope || this
        };
      },
      addQueryStateHandler: function (name, callback, scope) {
        this.queryStateCommands[name] = {
          func: callback,
          scope: scope || this
        };
      },
      addQueryValueHandler: function (name, callback, scope) {
        this.queryValueCommands[name] = {
          func: callback,
          scope: scope || this
        };
      },
      addShortcut: function (pattern, desc, cmdFunc, scope) {
        this.shortcuts.add(pattern, desc, cmdFunc, scope);
      },
      execCommand: function (cmd, ui, value, args) {
        var self = this, state = 0, cmdItem;
        if (!/^(mceAddUndoLevel|mceEndUndoLevel|mceBeginUndoLevel|mceRepaint)$/.test(cmd) && (!args || !args.skip_focus)) {
          self.focus();
        }
        args = extend({}, args);
        args = self.fire('BeforeExecCommand', {
          command: cmd,
          ui: ui,
          value: value
        });
        if (args.isDefaultPrevented()) {
          return false;
        }
        if (cmdItem = self.execCommands[cmd]) {
          if (cmdItem.func.call(cmdItem.scope, ui, value) !== true) {
            self.fire('ExecCommand', {
              command: cmd,
              ui: ui,
              value: value
            });
            return true;
          }
        }
        each(self.plugins, function (p) {
          if (p.execCommand && p.execCommand(cmd, ui, value)) {
            self.fire('ExecCommand', {
              command: cmd,
              ui: ui,
              value: value
            });
            state = true;
            return false;
          }
        });
        if (state) {
          return state;
        }
        if (self.theme && self.theme.execCommand && self.theme.execCommand(cmd, ui, value)) {
          self.fire('ExecCommand', {
            command: cmd,
            ui: ui,
            value: value
          });
          return true;
        }
        if (self.editorCommands.execCommand(cmd, ui, value)) {
          self.fire('ExecCommand', {
            command: cmd,
            ui: ui,
            value: value
          });
          return true;
        }
        self.getDoc().execCommand(cmd, ui, value);
        self.fire('ExecCommand', {
          command: cmd,
          ui: ui,
          value: value
        });
      },
      queryCommandState: function (cmd) {
        var self = this, queryItem, returnVal;
        if (self._isHidden()) {
          return;
        }
        if (queryItem = self.queryStateCommands[cmd]) {
          returnVal = queryItem.func.call(queryItem.scope);
          if (returnVal !== true) {
            return returnVal;
          }
        }
        returnVal = self.editorCommands.queryCommandState(cmd);
        if (returnVal !== -1) {
          return returnVal;
        }
        try {
          return self.getDoc().queryCommandState(cmd);
        } catch (ex) {
        }
      },
      queryCommandValue: function (cmd) {
        var self = this, queryItem, returnVal;
        if (self._isHidden()) {
          return;
        }
        if (queryItem = self.queryValueCommands[cmd]) {
          returnVal = queryItem.func.call(queryItem.scope);
          if (returnVal !== true) {
            return returnVal;
          }
        }
        returnVal = self.editorCommands.queryCommandValue(cmd);
        if (returnVal !== undefined) {
          return returnVal;
        }
        try {
          return self.getDoc().queryCommandValue(cmd);
        } catch (ex) {
        }
      },
      show: function () {
        var self = this;
        DOM.show(self.getContainer());
        DOM.hide(self.id);
        self.load();
        self.fire('show');
      },
      hide: function () {
        var self = this, doc = self.getDoc();
        if (ie && doc && !self.inline) {
          doc.execCommand('SelectAll');
        }
        self.save();
        DOM.hide(self.getContainer());
        DOM.setStyle(self.id, 'display', self.orgDisplay);
        self.fire('hide');
      },
      isHidden: function () {
        return !DOM.isHidden(this.id);
      },
      setProgressState: function (state, time) {
        this.fire('ProgressState', {
          state: state,
          time: time
        });
      },
      load: function (args) {
        var self = this, elm = self.getElement(), html;
        if (elm) {
          args = args || {};
          args.load = true;
          html = self.setContent(elm.value !== undefined ? elm.value : elm.innerHTML, args);
          args.element = elm;
          if (!args.no_events) {
            self.fire('LoadContent', args);
          }
          args.element = elm = null;
          return html;
        }
      },
      save: function (args) {
        var self = this, elm = self.getElement(), html, form;
        if (!elm || !self.initialized) {
          return;
        }
        args = args || {};
        args.save = true;
        args.element = elm;
        html = args.content = self.getContent(args);
        if (!args.no_events) {
          self.fire('SaveContent', args);
        }
        html = args.content;
        if (!/TEXTAREA|INPUT/i.test(elm.nodeName)) {
          if (!self.inline) {
            elm.innerHTML = html;
          }
          if (form = DOM.getParent(self.id, 'form')) {
            each(form.elements, function (elm) {
              if (elm.name == self.id) {
                elm.value = html;
                return false;
              }
            });
          }
        } else {
          elm.value = html;
        }
        args.element = elm = null;
        if (args.set_dirty !== false) {
          self.isNotDirty = true;
        }
        return html;
      },
      setContent: function (content, args) {
        var self = this, body = self.getBody(), forcedRootBlockName;
        args = args || {};
        args.format = args.format || 'html';
        args.set = true;
        args.content = content;
        if (!args.no_events) {
          self.fire('BeforeSetContent', args);
        }
        content = args.content;
        if (content.length === 0 || /^\s+$/.test(content)) {
          forcedRootBlockName = self.settings.forced_root_block;
          if (forcedRootBlockName && self.schema.isValidChild(body.nodeName.toLowerCase(), forcedRootBlockName.toLowerCase())) {
            content = ie && ie < 11 ? '' : '<br data-mce-bogus="1">';
            content = self.dom.createHTML(forcedRootBlockName, self.settings.forced_root_block_attrs, content);
          } else if (!ie) {
            content = '<br data-mce-bogus="1">';
          }
          body.innerHTML = content;
          self.fire('SetContent', args);
        } else {
          if (args.format !== 'raw') {
            content = new Serializer({}, self.schema).serialize(self.parser.parse(content, { isRootContent: true }));
          }
          args.content = trim(content);
          self.dom.setHTML(body, args.content);
          if (!args.no_events) {
            self.fire('SetContent', args);
          }
        }
        return args.content;
      },
      getContent: function (args) {
        var self = this, content, body = self.getBody();
        args = args || {};
        args.format = args.format || 'html';
        args.get = true;
        args.getInner = true;
        if (!args.no_events) {
          self.fire('BeforeGetContent', args);
        }
        if (args.format == 'raw') {
          content = body.innerHTML;
        } else if (args.format == 'text') {
          content = body.innerText || body.textContent;
        } else {
          content = self.serializer.serialize(body, args);
        }
        if (args.format != 'text') {
          args.content = trim(content);
        } else {
          args.content = content;
        }
        if (!args.no_events) {
          self.fire('GetContent', args);
        }
        return args.content;
      },
      insertContent: function (content) {
        this.execCommand('mceInsertContent', false, content);
      },
      isDirty: function () {
        return !this.isNotDirty;
      },
      getContainer: function () {
        var self = this;
        if (!self.container) {
          self.container = DOM.get(self.editorContainer || self.id + '_parent');
        }
        return self.container;
      },
      getContentAreaContainer: function () {
        return this.contentAreaContainer;
      },
      getElement: function () {
        return DOM.get(this.settings.content_element || this.id);
      },
      getWin: function () {
        var self = this, elm;
        if (!self.contentWindow) {
          elm = DOM.get(self.id + '_ifr');
          if (elm) {
            self.contentWindow = elm.contentWindow;
          }
        }
        return self.contentWindow;
      },
      getDoc: function () {
        var self = this, win;
        if (!self.contentDocument) {
          win = self.getWin();
          if (win) {
            self.contentDocument = win.document;
          }
        }
        return self.contentDocument;
      },
      getBody: function () {
        return this.bodyElement || this.getDoc().body;
      },
      convertURL: function (url, name, elm) {
        var self = this, settings = self.settings;
        if (settings.urlconverter_callback) {
          return self.execCallback('urlconverter_callback', url, elm, true, name);
        }
        if (!settings.convert_urls || elm && elm.nodeName == 'LINK' || url.indexOf('file:') === 0 || url.length === 0) {
          return url;
        }
        if (settings.relative_urls) {
          return self.documentBaseURI.toRelative(url);
        }
        url = self.documentBaseURI.toAbsolute(url, settings.remove_script_host);
        return url;
      },
      addVisual: function (elm) {
        var self = this, settings = self.settings, dom = self.dom, cls;
        elm = elm || self.getBody();
        if (self.hasVisual === undefined) {
          self.hasVisual = settings.visual;
        }
        each(dom.select('table,a', elm), function (elm) {
          var value;
          switch (elm.nodeName) {
          case 'TABLE':
            cls = settings.visual_table_class || 'mce-item-table';
            value = dom.getAttrib(elm, 'border');
            if (!value || value == '0') {
              if (self.hasVisual) {
                dom.addClass(elm, cls);
              } else {
                dom.removeClass(elm, cls);
              }
            }
            return;
          case 'A':
            if (!dom.getAttrib(elm, 'href', false)) {
              value = dom.getAttrib(elm, 'name') || elm.id;
              cls = settings.visual_anchor_class || 'mce-item-anchor';
              if (value) {
                if (self.hasVisual) {
                  dom.addClass(elm, cls);
                } else {
                  dom.removeClass(elm, cls);
                }
              }
            }
            return;
          }
        });
        self.fire('VisualAid', {
          element: elm,
          hasVisual: self.hasVisual
        });
      },
      remove: function () {
        var self = this;
        if (!self.removed) {
          self.fire('remove');
          self.off();
          self.removed = 1;
          if (self.hasHiddenInput) {
            DOM.remove(self.getElement().nextSibling);
          }
          self.save();
          DOM.setStyle(self.id, 'display', self.orgDisplay);
          if (!self.settings.content_editable) {
            Event.unbind(self.getWin());
            Event.unbind(self.getDoc());
          }
          var elm = self.getContainer();
          Event.unbind(self.getBody());
          Event.unbind(elm);
          self.editorManager.remove(self);
          DOM.remove(elm);
          self.destroy();
        }
      },
      bindNative: function (name) {
        var self = this;
        if (self.settings.readonly) {
          return;
        }
        if (self.initialized) {
          self.dom.bind(getEventTarget(self, name), name, function (e) {
            self.fire(name, e);
          });
        } else {
          if (!self._pendingNativeEvents) {
            self._pendingNativeEvents = [name];
          } else {
            self._pendingNativeEvents.push(name);
          }
        }
      },
      unbindNative: function (name) {
        var self = this;
        if (self.initialized) {
          self.dom.unbind(name);
        }
      },
      destroy: function (automatic) {
        var self = this, form;
        if (self.destroyed) {
          return;
        }
        if (!automatic && !self.removed) {
          self.remove();
          return;
        }
        if (automatic && isGecko) {
          Event.unbind(self.getDoc());
          Event.unbind(self.getWin());
          Event.unbind(self.getBody());
        }
        if (!automatic) {
          self.editorManager.off('beforeunload', self._beforeUnload);
          if (self.theme && self.theme.destroy) {
            self.theme.destroy();
          }
          self.selection.destroy();
          self.dom.destroy();
        }
        form = self.formElement;
        if (form) {
          if (form._mceOldSubmit) {
            form.submit = form._mceOldSubmit;
            form._mceOldSubmit = null;
          }
          DOM.unbind(form, 'submit reset', self.formEventDelegate);
        }
        self.contentAreaContainer = self.formElement = self.container = self.editorContainer = null;
        self.settings.content_element = self.bodyElement = self.contentDocument = self.contentWindow = null;
        if (self.selection) {
          self.selection = self.selection.win = self.selection.dom = self.selection.dom.doc = null;
        }
        self.destroyed = 1;
      },
      _refreshContentEditable: function () {
        var self = this, body, parent;
        if (self._isHidden()) {
          body = self.getBody();
          parent = body.parentNode;
          parent.removeChild(body);
          parent.appendChild(body);
          body.focus();
        }
      },
      _isHidden: function () {
        var sel;
        if (!isGecko) {
          return 0;
        }
        sel = this.selection.getSel();
        return !sel || !sel.rangeCount || sel.rangeCount === 0;
      }
    };
    extend(Editor.prototype, Observable);
    return Editor;
  });
  define('tinymce/util/I18n', [], function () {
    'use strict';
    var data = {};
    return {
      rtl: false,
      add: function (code, items) {
        for (var name in items) {
          data[name] = items[name];
        }
        this.rtl = this.rtl || data._dir === 'rtl';
      },
      translate: function (text) {
        if (typeof text == 'undefined') {
          return text;
        }
        if (typeof text != 'string' && text.raw) {
          return text.raw;
        }
        if (text.push) {
          var values = text.slice(1);
          text = (data[text[0]] || text[0]).replace(/\{([^\}]+)\}/g, function (match1, match2) {
            return values[match2];
          });
        }
        return data[text] || text;
      },
      data: data
    };
  });
  define('tinymce/FocusManager', [
    'tinymce/dom/DOMUtils',
    'tinymce/Env'
  ], function (DOMUtils, Env) {
    var selectionChangeHandler, documentFocusInHandler, DOM = DOMUtils.DOM;
    function FocusManager(editorManager) {
      function getActiveElement() {
        try {
          return document.activeElement;
        } catch (ex) {
          return document.body;
        }
      }
      function createBookmark(rng) {
        if (rng && rng.startContainer) {
          return {
            startContainer: rng.startContainer,
            startOffset: rng.startOffset,
            endContainer: rng.endContainer,
            endOffset: rng.endOffset
          };
        }
        return rng;
      }
      function bookmarkToRng(editor, bookmark) {
        var rng;
        if (bookmark.startContainer) {
          rng = editor.getDoc().createRange();
          rng.setStart(bookmark.startContainer, bookmark.startOffset);
          rng.setEnd(bookmark.endContainer, bookmark.endOffset);
        } else {
          rng = bookmark;
        }
        return rng;
      }
      function isUIElement(elm) {
        return !!DOM.getParent(elm, FocusManager.isEditorUIElement);
      }
      function isNodeInBodyOfEditor(node, editor) {
        var body = editor.getBody();
        while (node) {
          if (node == body) {
            return true;
          }
          node = node.parentNode;
        }
      }
      function registerEvents(e) {
        var editor = e.editor;
        editor.on('init', function () {
          if ('onbeforedeactivate' in document && Env.ie < 11) {
            editor.dom.bind(editor.getBody(), 'beforedeactivate', function () {
              try {
                editor.pendingRng = editor.selection.getRng();
              } catch (ex) {
              }
            });
            editor.dom.bind(editor.getBody(), 'blur', function () {
              if (editor.pendingRng) {
                editor.lastRng = editor.pendingRng;
                editor.selection.lastFocusBookmark = createBookmark(editor.lastRng);
                editor.pendingRng = null;
              }
            });
          } else if (editor.inline || Env.ie > 10) {
            editor.on('nodechange keyup', function () {
              var node = document.activeElement;
              if (node && node.id == editor.id + '_ifr') {
                node = editor.getBody();
              }
              if (isNodeInBodyOfEditor(node, editor)) {
                editor.lastRng = editor.selection.getRng();
              }
            });
            if (Env.webkit && !selectionChangeHandler) {
              selectionChangeHandler = function () {
                var activeEditor = editorManager.activeEditor;
                if (activeEditor && activeEditor.selection) {
                  var rng = activeEditor.selection.getRng();
                  if (rng && !rng.collapsed) {
                    editor.lastRng = rng;
                  }
                }
              };
              DOM.bind(document, 'selectionchange', selectionChangeHandler);
            }
          }
        });
        editor.on('setcontent', function () {
          editor.lastRng = null;
        });
        editor.on('mousedown', function () {
          editor.selection.lastFocusBookmark = null;
        });
        editor.on('focusin', function () {
          var focusedEditor = editorManager.focusedEditor;
          if (editor.selection.lastFocusBookmark) {
            editor.selection.setRng(bookmarkToRng(editor, editor.selection.lastFocusBookmark));
            editor.selection.lastFocusBookmark = null;
          }
          if (focusedEditor != editor) {
            if (focusedEditor) {
              focusedEditor.fire('blur', { focusedEditor: editor });
            }
            editorManager.activeEditor = editor;
            editorManager.focusedEditor = editor;
            editor.fire('focus', { blurredEditor: focusedEditor });
            editor.focus(true);
          }
          editor.lastRng = null;
        });
        editor.on('focusout', function () {
          window.setTimeout(function () {
            var focusedEditor = editorManager.focusedEditor;
            if (!isUIElement(getActiveElement()) && focusedEditor == editor) {
              editor.fire('blur', { focusedEditor: null });
              editorManager.focusedEditor = null;
              if (editor.selection) {
                editor.selection.lastFocusBookmark = null;
              }
            }
          }, 0);
        });
        if (!documentFocusInHandler) {
          documentFocusInHandler = function (e) {
            var activeEditor = editorManager.activeEditor;
            if (activeEditor && e.target.ownerDocument == document) {
              if (activeEditor.selection) {
                activeEditor.selection.lastFocusBookmark = createBookmark(activeEditor.lastRng);
              }
              if (!isUIElement(e.target) && editorManager.focusedEditor == activeEditor) {
                activeEditor.fire('blur', { focusedEditor: null });
                editorManager.focusedEditor = null;
              }
            }
          };
          DOM.bind(document, 'focusin', documentFocusInHandler);
        }
      }
      function unregisterDocumentEvents() {
        if (!editorManager.activeEditor) {
          DOM.unbind(document, 'selectionchange', selectionChangeHandler);
          DOM.unbind(document, 'focusin', documentFocusInHandler);
          selectionChangeHandler = documentFocusInHandler = null;
        }
      }
      editorManager.on('AddEditor', registerEvents);
      editorManager.on('RemoveEditor', unregisterDocumentEvents);
    }
    FocusManager.isEditorUIElement = function (elm) {
      return elm.className.indexOf('mce-') !== -1;
    };
    return FocusManager;
  });
  define('tinymce/EditorManager', [
    'tinymce/Editor',
    'tinymce/dom/DOMUtils',
    'tinymce/util/URI',
    'tinymce/Env',
    'tinymce/util/Tools',
    'tinymce/util/Observable',
    'tinymce/util/I18n',
    'tinymce/FocusManager'
  ], function (Editor, DOMUtils, URI, Env, Tools, Observable, I18n, FocusManager) {
    var DOM = DOMUtils.DOM;
    var explode = Tools.explode, each = Tools.each, extend = Tools.extend;
    var instanceCounter = 0, beforeUnloadDelegate;
    var EditorManager = {
        majorVersion: '4',
        minorVersion: '0.19',
        releaseDate: '2014-03-11',
        editors: [],
        i18n: I18n,
        activeEditor: null,
        setup: function () {
          var self = this, baseURL, documentBaseURL, suffix = '', preInit;
          documentBaseURL = document.location.href.replace(/[\?#].*$/, '').replace(/[\/\\][^\/]+$/, '');
          if (!/[\/\\]$/.test(documentBaseURL)) {
            documentBaseURL += '/';
          }
          preInit = window.tinymce || window.tinyMCEPreInit;
          if (preInit) {
            baseURL = preInit.base || preInit.baseURL;
            suffix = preInit.suffix;
          } else {
            var scripts = document.getElementsByTagName('script');
            for (var i = 0; i < scripts.length; i++) {
              var src = scripts[i].src;
              if (/tinymce(\.full|\.jquery|)(\.min|\.dev|)\.js/.test(src)) {
                if (src.indexOf('.min') != -1) {
                  suffix = '.min';
                }
                baseURL = src.substring(0, src.lastIndexOf('/'));
                break;
              }
            }
          }
          self.baseURL = new URI(documentBaseURL).toAbsolute(baseURL);
          self.documentBaseURL = documentBaseURL;
          self.baseURI = new URI(self.baseURL);
          self.suffix = suffix;
          self.focusManager = new FocusManager(self);
        },
        init: function (settings) {
          var self = this, editors = [], editor;
          function createId(elm) {
            var id = elm.id;
            if (!id) {
              id = elm.name;
              if (id && !DOM.get(id)) {
                id = elm.name;
              } else {
                id = DOM.uniqueId();
              }
              elm.setAttribute('id', id);
            }
            return id;
          }
          function execCallback(se, n, s) {
            var f = se[n];
            if (!f) {
              return;
            }
            return f.apply(s || this, Array.prototype.slice.call(arguments, 2));
          }
          function hasClass(n, c) {
            return c.constructor === RegExp ? c.test(n.className) : DOM.hasClass(n, c);
          }
          function readyHandler() {
            var l, co;
            DOM.unbind(window, 'ready', readyHandler);
            execCallback(settings, 'onpageload');
            if (settings.types) {
              each(settings.types, function (type) {
                each(DOM.select(type.selector), function (elm) {
                  var editor = new Editor(createId(elm), extend({}, settings, type), self);
                  editors.push(editor);
                  editor.render(1);
                });
              });
              return;
            } else if (settings.selector) {
              each(DOM.select(settings.selector), function (elm) {
                var editor = new Editor(createId(elm), settings, self);
                editors.push(editor);
                editor.render(1);
              });
              return;
            }
            switch (settings.mode) {
            case 'exact':
              l = settings.elements || '';
              if (l.length > 0) {
                each(explode(l), function (v) {
                  if (DOM.get(v)) {
                    editor = new Editor(v, settings, self);
                    editors.push(editor);
                    editor.render(true);
                  } else {
                    each(document.forms, function (f) {
                      each(f.elements, function (e) {
                        if (e.name === v) {
                          v = 'mce_editor_' + instanceCounter++;
                          DOM.setAttrib(e, 'id', v);
                          editor = new Editor(v, settings, self);
                          editors.push(editor);
                          editor.render(1);
                        }
                      });
                    });
                  }
                });
              }
              break;
            case 'textareas':
            case 'specific_textareas':
              each(DOM.select('textarea'), function (elm) {
                if (settings.editor_deselector && hasClass(elm, settings.editor_deselector)) {
                  return;
                }
                if (!settings.editor_selector || hasClass(elm, settings.editor_selector)) {
                  editor = new Editor(createId(elm), settings, self);
                  editors.push(editor);
                  editor.render(true);
                }
              });
              break;
            }
            if (settings.oninit) {
              l = co = 0;
              each(editors, function (ed) {
                co++;
                if (!ed.initialized) {
                  ed.on('init', function () {
                    l++;
                    if (l == co) {
                      execCallback(settings, 'oninit');
                    }
                  });
                } else {
                  l++;
                }
                if (l == co) {
                  execCallback(settings, 'oninit');
                }
              });
            }
          }
          self.settings = settings;
          DOM.bind(window, 'ready', readyHandler);
        },
        get: function (id) {
          if (id === undefined) {
            return this.editors;
          }
          return this.editors[id];
        },
        add: function (editor) {
          var self = this, editors = self.editors;
          editors[editor.id] = editor;
          editors.push(editor);
          self.activeEditor = editor;
          self.fire('AddEditor', { editor: editor });
          if (!beforeUnloadDelegate) {
            beforeUnloadDelegate = function () {
              self.fire('BeforeUnload');
            };
            DOM.bind(window, 'beforeunload', beforeUnloadDelegate);
          }
          return editor;
        },
        createEditor: function (id, settings) {
          return this.add(new Editor(id, settings, this));
        },
        remove: function (selector) {
          var self = this, i, editors = self.editors, editor, removedFromList;
          if (!selector) {
            for (i = editors.length - 1; i >= 0; i--) {
              self.remove(editors[i]);
            }
            return;
          }
          if (typeof selector == 'string') {
            selector = selector.selector || selector;
            each(DOM.select(selector), function (elm) {
              self.remove(editors[elm.id]);
            });
            return;
          }
          editor = selector;
          if (!editors[editor.id]) {
            return null;
          }
          delete editors[editor.id];
          for (i = 0; i < editors.length; i++) {
            if (editors[i] == editor) {
              editors.splice(i, 1);
              removedFromList = true;
              break;
            }
          }
          if (self.activeEditor == editor) {
            self.activeEditor = editors[0];
          }
          if (removedFromList) {
            self.fire('RemoveEditor', { editor: editor });
          }
          if (!editors.length) {
            DOM.unbind(window, 'beforeunload', beforeUnloadDelegate);
          }
          editor.remove();
          return editor;
        },
        execCommand: function (cmd, ui, value) {
          var self = this, editor = self.get(value);
          switch (cmd) {
          case 'mceAddEditor':
            if (!self.get(value)) {
              new Editor(value, self.settings, self).render();
            }
            return true;
          case 'mceRemoveEditor':
            if (editor) {
              editor.remove();
            }
            return true;
          case 'mceToggleEditor':
            if (!editor) {
              self.execCommand('mceAddEditor', 0, value);
              return true;
            }
            if (editor.isHidden()) {
              editor.show();
            } else {
              editor.hide();
            }
            return true;
          }
          if (self.activeEditor) {
            return self.activeEditor.execCommand(cmd, ui, value);
          }
          return false;
        },
        triggerSave: function () {
          each(this.editors, function (editor) {
            editor.save();
          });
        },
        addI18n: function (code, items) {
          I18n.add(code, items);
        },
        translate: function (text) {
          return I18n.translate(text);
        }
      };
    extend(EditorManager, Observable);
    EditorManager.setup();
    window.tinymce = window.tinyMCE = EditorManager;
    return EditorManager;
  });
  define('tinymce/LegacyInput', [
    'tinymce/EditorManager',
    'tinymce/util/Tools'
  ], function (EditorManager, Tools) {
    var each = Tools.each, explode = Tools.explode;
    EditorManager.on('AddEditor', function (e) {
      var editor = e.editor;
      editor.on('preInit', function () {
        var filters, fontSizes, dom, settings = editor.settings;
        function replaceWithSpan(node, styles) {
          each(styles, function (value, name) {
            if (value) {
              dom.setStyle(node, name, value);
            }
          });
          dom.rename(node, 'span');
        }
        function convert(e) {
          dom = editor.dom;
          if (settings.convert_fonts_to_spans) {
            each(dom.select('font,u,strike', e.node), function (node) {
              filters[node.nodeName.toLowerCase()](dom, node);
            });
          }
        }
        if (settings.inline_styles) {
          fontSizes = explode(settings.font_size_legacy_values);
          filters = {
            font: function (dom, node) {
              replaceWithSpan(node, {
                backgroundColor: node.style.backgroundColor,
                color: node.color,
                fontFamily: node.face,
                fontSize: fontSizes[parseInt(node.size, 10) - 1]
              });
            },
            u: function (dom, node) {
              replaceWithSpan(node, { textDecoration: 'underline' });
            },
            strike: function (dom, node) {
              replaceWithSpan(node, { textDecoration: 'line-through' });
            }
          };
          editor.on('PreProcess SetContent', convert);
        }
      });
    });
  });
  define('tinymce/util/XHR', [], function () {
    return {
      send: function (settings) {
        var xhr, count = 0;
        function ready() {
          if (!settings.async || xhr.readyState == 4 || count++ > 10000) {
            if (settings.success && count < 10000 && xhr.status == 200) {
              settings.success.call(settings.success_scope, '' + xhr.responseText, xhr, settings);
            } else if (settings.error) {
              settings.error.call(settings.error_scope, count > 10000 ? 'TIMED_OUT' : 'GENERAL', xhr, settings);
            }
            xhr = null;
          } else {
            setTimeout(ready, 10);
          }
        }
        settings.scope = settings.scope || this;
        settings.success_scope = settings.success_scope || settings.scope;
        settings.error_scope = settings.error_scope || settings.scope;
        settings.async = settings.async === false ? false : true;
        settings.data = settings.data || '';
        xhr = new XMLHttpRequest();
        if (xhr) {
          if (xhr.overrideMimeType) {
            xhr.overrideMimeType(settings.content_type);
          }
          xhr.open(settings.type || (settings.data ? 'POST' : 'GET'), settings.url, settings.async);
          if (settings.content_type) {
            xhr.setRequestHeader('Content-Type', settings.content_type);
          }
          xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
          xhr.send(settings.data);
          if (!settings.async) {
            return ready();
          }
          setTimeout(ready, 10);
        }
      }
    };
  });
  define('tinymce/util/JSON', [], function () {
    function serialize(o, quote) {
      var i, v, t, name;
      quote = quote || '"';
      if (o === null) {
        return 'null';
      }
      t = typeof o;
      if (t == 'string') {
        v = '\bb\tt\nn\ff\rr""\'\'\\\\';
        return quote + o.replace(/([\u0080-\uFFFF\x00-\x1f\"\'\\])/g, function (a, b) {
          if (quote === '"' && a === '\'') {
            return a;
          }
          i = v.indexOf(b);
          if (i + 1) {
            return '\\' + v.charAt(i + 1);
          }
          a = b.charCodeAt().toString(16);
          return '\\u' + '0000'.substring(a.length) + a;
        }) + quote;
      }
      if (t == 'object') {
        if (o.hasOwnProperty && Object.prototype.toString.call(o) === '[object Array]') {
          for (i = 0, v = '['; i < o.length; i++) {
            v += (i > 0 ? ',' : '') + serialize(o[i], quote);
          }
          return v + ']';
        }
        v = '{';
        for (name in o) {
          if (o.hasOwnProperty(name)) {
            v += typeof o[name] != 'function' ? (v.length > 1 ? ',' + quote : quote) + name + quote + ':' + serialize(o[name], quote) : '';
          }
        }
        return v + '}';
      }
      return '' + o;
    }
    return {
      serialize: serialize,
      parse: function (text) {
        try {
          return window[String.fromCharCode(101) + 'val']('(' + text + ')');
        } catch (ex) {
        }
      }
    };
  });
  define('tinymce/util/JSONRequest', [
    'tinymce/util/JSON',
    'tinymce/util/XHR',
    'tinymce/util/Tools'
  ], function (JSON, XHR, Tools) {
    var extend = Tools.extend;
    function JSONRequest(settings) {
      this.settings = extend({}, settings);
      this.count = 0;
    }
    JSONRequest.sendRPC = function (o) {
      return new JSONRequest().send(o);
    };
    JSONRequest.prototype = {
      send: function (args) {
        var ecb = args.error, scb = args.success;
        args = extend(this.settings, args);
        args.success = function (c, x) {
          c = JSON.parse(c);
          if (typeof c == 'undefined') {
            c = { error: 'JSON Parse error.' };
          }
          if (c.error) {
            ecb.call(args.error_scope || args.scope, c.error, x);
          } else {
            scb.call(args.success_scope || args.scope, c.result);
          }
        };
        args.error = function (ty, x) {
          if (ecb) {
            ecb.call(args.error_scope || args.scope, ty, x);
          }
        };
        args.data = JSON.serialize({
          id: args.id || 'c' + this.count++,
          method: args.method,
          params: args.params
        });
        args.content_type = 'application/json';
        XHR.send(args);
      }
    };
    return JSONRequest;
  });
  define('tinymce/util/JSONP', ['tinymce/dom/DOMUtils'], function (DOMUtils) {
    return {
      callbacks: {},
      count: 0,
      send: function (settings) {
        var self = this, dom = DOMUtils.DOM, count = settings.count !== undefined ? settings.count : self.count;
        var id = 'tinymce_jsonp_' + count;
        self.callbacks[count] = function (json) {
          dom.remove(id);
          delete self.callbacks[count];
          settings.callback(json);
        };
        dom.add(dom.doc.body, 'script', {
          id: id,
          src: settings.url,
          type: 'text/javascript'
        });
        self.count++;
      }
    };
  });
  define('tinymce/util/LocalStorage', [], function () {
    var LocalStorage, storageElm, items, keys, userDataKey, hasOldIEDataSupport;
    try {
      if (window.localStorage) {
        return localStorage;
      }
    } catch (ex) {
    }
    userDataKey = 'tinymce';
    storageElm = document.documentElement;
    hasOldIEDataSupport = !!storageElm.addBehavior;
    if (hasOldIEDataSupport) {
      storageElm.addBehavior('#default#userData');
    }
    function updateKeys() {
      keys = [];
      for (var key in items) {
        keys.push(key);
      }
      LocalStorage.length = keys.length;
    }
    function load() {
      var key, data, value, pos = 0;
      items = {};
      if (!hasOldIEDataSupport) {
        return;
      }
      function next(end) {
        var value, nextPos;
        nextPos = end !== undefined ? pos + end : data.indexOf(',', pos);
        if (nextPos === -1 || nextPos > data.length) {
          return null;
        }
        value = data.substring(pos, nextPos);
        pos = nextPos + 1;
        return value;
      }
      storageElm.load(userDataKey);
      data = storageElm.getAttribute(userDataKey) || '';
      do {
        var offset = next();
        if (offset === null) {
          break;
        }
        key = next(parseInt(offset, 32) || 0);
        if (key !== null) {
          offset = next();
          if (offset === null) {
            break;
          }
          value = next(parseInt(offset, 32) || 0);
          if (key) {
            items[key] = value;
          }
        }
      } while (key !== null);
      updateKeys();
    }
    function save() {
      var value, data = '';
      if (!hasOldIEDataSupport) {
        return;
      }
      for (var key in items) {
        value = items[key];
        data += (data ? ',' : '') + key.length.toString(32) + ',' + key + ',' + value.length.toString(32) + ',' + value;
      }
      storageElm.setAttribute(userDataKey, data);
      try {
        storageElm.save(userDataKey);
      } catch (ex) {
      }
      updateKeys();
    }
    LocalStorage = {
      key: function (index) {
        return keys[index];
      },
      getItem: function (key) {
        return key in items ? items[key] : null;
      },
      setItem: function (key, value) {
        items[key] = '' + value;
        save();
      },
      removeItem: function (key) {
        delete items[key];
        save();
      },
      clear: function () {
        items = {};
        save();
      }
    };
    load();
    return LocalStorage;
  });
  define('tinymce/Compat', [
    'tinymce/dom/DOMUtils',
    'tinymce/dom/EventUtils',
    'tinymce/dom/ScriptLoader',
    'tinymce/AddOnManager',
    'tinymce/util/Tools',
    'tinymce/Env'
  ], function (DOMUtils, EventUtils, ScriptLoader, AddOnManager, Tools, Env) {
    var tinymce = window.tinymce;
    tinymce.DOM = DOMUtils.DOM;
    tinymce.ScriptLoader = ScriptLoader.ScriptLoader;
    tinymce.PluginManager = AddOnManager.PluginManager;
    tinymce.ThemeManager = AddOnManager.ThemeManager;
    tinymce.dom = tinymce.dom || {};
    tinymce.dom.Event = EventUtils.Event;
    Tools.each(Tools, function (func, key) {
      tinymce[key] = func;
    });
    Tools.each('isOpera isWebKit isIE isGecko isMac'.split(' '), function (name) {
      tinymce[name] = Env[name.substr(2).toLowerCase()];
    });
    return {};
  });
  define('tinymce/ui/Layout', [
    'tinymce/util/Class',
    'tinymce/util/Tools'
  ], function (Class, Tools) {
    'use strict';
    return Class.extend({
      Defaults: {
        firstControlClass: 'first',
        lastControlClass: 'last'
      },
      init: function (settings) {
        this.settings = Tools.extend({}, this.Defaults, settings);
      },
      preRender: function (container) {
        container.addClass(this.settings.containerClass, 'body');
      },
      applyClasses: function (container) {
        var self = this, settings = self.settings, items, firstClass, lastClass;
        items = container.items().filter(':visible');
        firstClass = settings.firstControlClass;
        lastClass = settings.lastControlClass;
        items.each(function (item) {
          item.removeClass(firstClass).removeClass(lastClass);
          if (settings.controlClass) {
            item.addClass(settings.controlClass);
          }
        });
        items.eq(0).addClass(firstClass);
        items.eq(-1).addClass(lastClass);
      },
      renderHtml: function (container) {
        var self = this, settings = self.settings, items, html = '';
        items = container.items();
        items.eq(0).addClass(settings.firstControlClass);
        items.eq(-1).addClass(settings.lastControlClass);
        items.each(function (item) {
          if (settings.controlClass) {
            item.addClass(settings.controlClass);
          }
          html += item.renderHtml();
        });
        return html;
      },
      recalc: function () {
      },
      postRender: function () {
      }
    });
  });
  define('tinymce/ui/AbsoluteLayout', ['tinymce/ui/Layout'], function (Layout) {
    'use strict';
    return Layout.extend({
      Defaults: {
        containerClass: 'abs-layout',
        controlClass: 'abs-layout-item'
      },
      recalc: function (container) {
        container.items().filter(':visible').each(function (ctrl) {
          var settings = ctrl.settings;
          ctrl.layoutRect({
            x: settings.x,
            y: settings.y,
            w: settings.w,
            h: settings.h
          });
          if (ctrl.recalc) {
            ctrl.recalc();
          }
        });
      },
      renderHtml: function (container) {
        return '<div id="' + container._id + '-absend" class="' + container.classPrefix + 'abs-end"></div>' + this._super(container);
      }
    });
  });
  define('tinymce/ui/Tooltip', [
    'tinymce/ui/Control',
    'tinymce/ui/Movable'
  ], function (Control, Movable) {
    return Control.extend({
      Mixins: [Movable],
      Defaults: { classes: 'widget tooltip tooltip-n' },
      text: function (value) {
        var self = this;
        if (typeof value != 'undefined') {
          self._value = value;
          if (self._rendered) {
            self.getEl().lastChild.innerHTML = self.encode(value);
          }
          return self;
        }
        return self._value;
      },
      renderHtml: function () {
        var self = this, prefix = self.classPrefix;
        return '<div id="' + self._id + '" class="' + self.classes() + '" role="presentation">' + '<div class="' + prefix + 'tooltip-arrow"></div>' + '<div class="' + prefix + 'tooltip-inner">' + self.encode(self._text) + '</div>' + '</div>';
      },
      repaint: function () {
        var self = this, style, rect;
        style = self.getEl().style;
        rect = self._layoutRect;
        style.left = rect.x + 'px';
        style.top = rect.y + 'px';
        style.zIndex = 65535 + 65535;
      }
    });
  });
  define('tinymce/ui/Widget', [
    'tinymce/ui/Control',
    'tinymce/ui/Tooltip'
  ], function (Control, Tooltip) {
    'use strict';
    var tooltip;
    var Widget = Control.extend({
        init: function (settings) {
          var self = this;
          self._super(settings);
          self.canFocus = true;
          if (settings.tooltip && Widget.tooltips !== false) {
            self.on('mouseenter', function (e) {
              var tooltip = self.tooltip().moveTo(-65535);
              if (e.control == self) {
                var rel = tooltip.text(settings.tooltip).show().testMoveRel(self.getEl(), [
                    'bc-tc',
                    'bc-tl',
                    'bc-tr'
                  ]);
                tooltip.toggleClass('tooltip-n', rel == 'bc-tc');
                tooltip.toggleClass('tooltip-nw', rel == 'bc-tl');
                tooltip.toggleClass('tooltip-ne', rel == 'bc-tr');
                tooltip.moveRel(self.getEl(), rel);
              } else {
                tooltip.hide();
              }
            });
            self.on('mouseleave mousedown click', function () {
              self.tooltip().hide();
            });
          }
          self.aria('label', settings.ariaLabel || settings.tooltip);
        },
        tooltip: function () {
          if (!tooltip) {
            tooltip = new Tooltip({ type: 'tooltip' });
            tooltip.renderTo();
          }
          return tooltip;
        },
        active: function (state) {
          var self = this, undef;
          if (state !== undef) {
            self.aria('pressed', state);
            self.toggleClass('active', state);
          }
          return self._super(state);
        },
        disabled: function (state) {
          var self = this, undef;
          if (state !== undef) {
            self.aria('disabled', state);
            self.toggleClass('disabled', state);
          }
          return self._super(state);
        },
        postRender: function () {
          var self = this, settings = self.settings;
          self._rendered = true;
          self._super();
          if (!self.parent() && (settings.width || settings.height)) {
            self.initLayoutRect();
            self.repaint();
          }
          if (settings.autofocus) {
            self.focus();
          }
        },
        remove: function () {
          this._super();
          if (tooltip) {
            tooltip.remove();
            tooltip = null;
          }
        }
      });
    return Widget;
  });
  define('tinymce/ui/Button', ['tinymce/ui/Widget'], function (Widget) {
    'use strict';
    return Widget.extend({
      Defaults: {
        classes: 'widget btn',
        role: 'button'
      },
      init: function (settings) {
        var self = this, size;
        self.on('click mousedown', function (e) {
          e.preventDefault();
        });
        self._super(settings);
        size = settings.size;
        if (settings.subtype) {
          self.addClass(settings.subtype);
        }
        if (size) {
          self.addClass('btn-' + size);
        }
      },
      icon: function (icon) {
        var self = this, prefix = self.classPrefix;
        if (typeof icon == 'undefined') {
          return self.settings.icon;
        }
        self.settings.icon = icon;
        icon = icon ? prefix + 'ico ' + prefix + 'i-' + self.settings.icon : '';
        if (self._rendered) {
          var btnElm = self.getEl().firstChild, iconElm = btnElm.getElementsByTagName('i')[0];
          if (icon) {
            if (!iconElm || iconElm != btnElm.firstChild) {
              iconElm = document.createElement('i');
              btnElm.insertBefore(iconElm, btnElm.firstChild);
            }
            iconElm.className = icon;
          } else if (iconElm) {
            btnElm.removeChild(iconElm);
          }
          self.text(self._text);
        }
        return self;
      },
      repaint: function () {
        var btnStyle = this.getEl().firstChild.style;
        btnStyle.width = btnStyle.height = '100%';
        this._super();
      },
      renderHtml: function () {
        var self = this, id = self._id, prefix = self.classPrefix;
        var icon = self.settings.icon, image = '';
        if (self.settings.image) {
          icon = 'none';
          image = ' style="background-image: url(\'' + self.settings.image + '\')"';
        }
        icon = self.settings.icon ? prefix + 'ico ' + prefix + 'i-' + icon : '';
        return '<div id="' + id + '" class="' + self.classes() + '" tabindex="-1" aria-labelledby="' + id + '">' + '<button role="presentation" type="button" tabindex="-1">' + (icon ? '<i class="' + icon + '"' + image + '></i>' : '') + (self._text ? (icon ? '\xa0' : '') + self.encode(self._text) : '') + '</button>' + '</div>';
      }
    });
  });
  define('tinymce/ui/ButtonGroup', ['tinymce/ui/Container'], function (Container) {
    'use strict';
    return Container.extend({
      Defaults: {
        defaultType: 'button',
        role: 'group'
      },
      renderHtml: function () {
        var self = this, layout = self._layout;
        self.addClass('btn-group');
        self.preRender();
        layout.preRender(self);
        return '<div id="' + self._id + '" class="' + self.classes() + '">' + '<div id="' + self._id + '-body">' + (self.settings.html || '') + layout.renderHtml(self) + '</div>' + '</div>';
      }
    });
  });
  define('tinymce/ui/Checkbox', ['tinymce/ui/Widget'], function (Widget) {
    'use strict';
    return Widget.extend({
      Defaults: {
        classes: 'checkbox',
        role: 'checkbox',
        checked: false
      },
      init: function (settings) {
        var self = this;
        self._super(settings);
        self.on('click mousedown', function (e) {
          e.preventDefault();
        });
        self.on('click', function (e) {
          e.preventDefault();
          if (!self.disabled()) {
            self.checked(!self.checked());
          }
        });
        self.checked(self.settings.checked);
      },
      checked: function (state) {
        var self = this;
        if (typeof state != 'undefined') {
          if (state) {
            self.addClass('checked');
          } else {
            self.removeClass('checked');
          }
          self._checked = state;
          self.aria('checked', state);
          return self;
        }
        return self._checked;
      },
      value: function (state) {
        return this.checked(state);
      },
      renderHtml: function () {
        var self = this, id = self._id, prefix = self.classPrefix;
        return '<div id="' + id + '" class="' + self.classes() + '" unselectable="on" aria-labelledby="' + id + '-al" tabindex="-1">' + '<i class="' + prefix + 'ico ' + prefix + 'i-checkbox"></i>' + '<span id="' + id + '-al" class="' + prefix + 'label">' + self.encode(self._text) + '</span>' + '</div>';
      }
    });
  });
  define('tinymce/ui/PanelButton', [
    'tinymce/ui/Button',
    'tinymce/ui/FloatPanel'
  ], function (Button, FloatPanel) {
    'use strict';
    return Button.extend({
      showPanel: function () {
        var self = this, settings = self.settings;
        self.active(true);
        if (!self.panel) {
          var panelSettings = settings.panel;
          if (panelSettings.type) {
            panelSettings = {
              layout: 'grid',
              items: panelSettings
            };
          }
          panelSettings.role = panelSettings.role || 'dialog';
          panelSettings.popover = true;
          panelSettings.autohide = true;
          panelSettings.ariaRoot = true;
          self.panel = new FloatPanel(panelSettings).on('hide', function () {
            self.active(false);
          }).on('cancel', function (e) {
            e.stopPropagation();
            self.focus();
            self.hidePanel();
          }).parent(self).renderTo(self.getContainerElm());
          self.panel.fire('show');
          self.panel.reflow();
        } else {
          self.panel.show();
        }
        self.panel.moveRel(self.getEl(), settings.popoverAlign || (self.isRtl() ? [
          'bc-tr',
          'bc-tc'
        ] : [
          'bc-tl',
          'bc-tc'
        ]));
      },
      hidePanel: function () {
        var self = this;
        if (self.panel) {
          self.panel.hide();
        }
      },
      postRender: function () {
        var self = this;
        self.aria('haspopup', true);
        self.on('click', function (e) {
          if (e.control === self) {
            if (self.panel && self.panel.visible()) {
              self.hidePanel();
            } else {
              self.showPanel();
              self.panel.focus(!!e.aria);
            }
          }
        });
        return self._super();
      }
    });
  });
  define('tinymce/ui/ColorButton', [
    'tinymce/ui/PanelButton',
    'tinymce/dom/DOMUtils'
  ], function (PanelButton, DomUtils) {
    'use strict';
    var DOM = DomUtils.DOM;
    return PanelButton.extend({
      init: function (settings) {
        this._super(settings);
        this.addClass('colorbutton');
      },
      color: function (color) {
        if (color) {
          this._color = color;
          this.getEl('preview').style.backgroundColor = color;
          return this;
        }
        return this._color;
      },
      renderHtml: function () {
        var self = this, id = self._id, prefix = self.classPrefix;
        var icon = self.settings.icon ? prefix + 'ico ' + prefix + 'i-' + self.settings.icon : '';
        var image = self.settings.image ? ' style="background-image: url(\'' + self.settings.image + '\')"' : '';
        return '<div id="' + id + '" class="' + self.classes() + '" role="button" tabindex="-1" aria-haspopup="true">' + '<button role="presentation" hidefocus type="button" tabindex="-1">' + (icon ? '<i class="' + icon + '"' + image + '></i>' : '') + '<span id="' + id + '-preview" class="' + prefix + 'preview"></span>' + (self._text ? (icon ? ' ' : '') + self._text : '') + '</button>' + '<button type="button" class="' + prefix + 'open" hidefocus tabindex="-1">' + ' <i class="' + prefix + 'caret"></i>' + '</button>' + '</div>';
      },
      postRender: function () {
        var self = this, onClickHandler = self.settings.onclick;
        self.on('click', function (e) {
          if (e.aria && e.aria.key == 'down') {
            return;
          }
          if (e.control == self && !DOM.getParent(e.target, '.' + self.classPrefix + 'open')) {
            e.stopImmediatePropagation();
            onClickHandler.call(self, e);
          }
        });
        delete self.settings.onclick;
        return self._super();
      }
    });
  });
  define('tinymce/ui/ComboBox', [
    'tinymce/ui/Widget',
    'tinymce/ui/Factory',
    'tinymce/ui/DomUtils'
  ], function (Widget, Factory, DomUtils) {
    'use strict';
    return Widget.extend({
      init: function (settings) {
        var self = this;
        self._super(settings);
        self.addClass('combobox');
        self.subinput = true;
        self.ariaTarget = 'inp';
        settings = self.settings;
        settings.menu = settings.menu || settings.values;
        if (settings.menu) {
          settings.icon = 'caret';
        }
        self.on('click', function (e) {
          var elm = e.target, root = self.getEl();
          while (elm && elm != root) {
            if (elm.id && elm.id.indexOf('-open') != -1) {
              self.fire('action');
              if (settings.menu) {
                self.showMenu();
                if (e.aria) {
                  self.menu.items()[0].focus();
                }
              }
            }
            elm = elm.parentNode;
          }
        });
        self.on('keydown', function (e) {
          if (e.target.nodeName == 'INPUT' && e.keyCode == 13) {
            self.parents().reverse().each(function (ctrl) {
              e.preventDefault();
              self.fire('change');
              if (ctrl.hasEventListeners('submit') && ctrl.toJSON) {
                ctrl.fire('submit', { data: ctrl.toJSON() });
                return false;
              }
            });
          }
        });
        if (settings.placeholder) {
          self.addClass('placeholder');
          self.on('focusin', function () {
            if (!self._hasOnChange) {
              DomUtils.on(self.getEl('inp'), 'change', function () {
                self.fire('change');
              });
              self._hasOnChange = true;
            }
            if (self.hasClass('placeholder')) {
              self.getEl('inp').value = '';
              self.removeClass('placeholder');
            }
          });
          self.on('focusout', function () {
            if (self.value().length === 0) {
              self.getEl('inp').value = settings.placeholder;
              self.addClass('placeholder');
            }
          });
        }
      },
      showMenu: function () {
        var self = this, settings = self.settings, menu;
        if (!self.menu) {
          menu = settings.menu || [];
          if (menu.length) {
            menu = {
              type: 'menu',
              items: menu
            };
          } else {
            menu.type = menu.type || 'menu';
          }
          self.menu = Factory.create(menu).parent(self).renderTo(self.getContainerElm());
          self.fire('createmenu');
          self.menu.reflow();
          self.menu.on('cancel', function (e) {
            if (e.control === self.menu) {
              self.focus();
            }
          });
          self.menu.on('show hide', function (e) {
            e.control.items().each(function (ctrl) {
              ctrl.active(ctrl.value() == self.value());
            });
          }).fire('show');
          self.menu.on('select', function (e) {
            self.value(e.control.value());
          });
          self.on('focusin', function (e) {
            if (e.target.tagName == 'INPUT') {
              self.menu.hide();
            }
          });
          self.aria('expanded', true);
        }
        self.menu.show();
        self.menu.layoutRect({ w: self.layoutRect().w });
        self.menu.moveRel(self.getEl(), self.isRtl() ? [
          'br-tr',
          'tr-br'
        ] : [
          'bl-tl',
          'tl-bl'
        ]);
      },
      value: function (value) {
        var self = this;
        if (typeof value != 'undefined') {
          self._value = value;
          self.removeClass('placeholder');
          if (self._rendered) {
            self.getEl('inp').value = value;
          }
          return self;
        }
        if (self._rendered) {
          value = self.getEl('inp').value;
          if (value != self.settings.placeholder) {
            return value;
          }
          return '';
        }
        return self._value;
      },
      disabled: function (state) {
        var self = this;
        if (self._rendered && typeof state != 'undefined') {
          self.getEl('inp').disabled = state;
        }
        return self._super(state);
      },
      focus: function () {
        this.getEl('inp').focus();
      },
      repaint: function () {
        var self = this, elm = self.getEl(), openElm = self.getEl('open'), rect = self.layoutRect();
        var width, lineHeight;
        if (openElm) {
          width = rect.w - DomUtils.getSize(openElm).width - 10;
        } else {
          width = rect.w - 10;
        }
        var doc = document;
        if (doc.all && (!doc.documentMode || doc.documentMode <= 8)) {
          lineHeight = self.layoutRect().h - 2 + 'px';
        }
        DomUtils.css(elm.firstChild, {
          width: width,
          lineHeight: lineHeight
        });
        self._super();
        return self;
      },
      postRender: function () {
        var self = this;
        DomUtils.on(this.getEl('inp'), 'change', function () {
          self.fire('change');
        });
        return self._super();
      },
      remove: function () {
        DomUtils.off(this.getEl('inp'));
        this._super();
      },
      renderHtml: function () {
        var self = this, id = self._id, settings = self.settings, prefix = self.classPrefix;
        var value = settings.value || settings.placeholder || '';
        var icon, text, openBtnHtml = '', extraAttrs = '';
        if ('spellcheck' in settings) {
          extraAttrs += ' spellcheck="' + settings.spellcheck + '"';
        }
        if (settings.maxLength) {
          extraAttrs += ' maxlength="' + settings.maxLength + '"';
        }
        if (settings.size) {
          extraAttrs += ' size="' + settings.size + '"';
        }
        if (settings.subtype) {
          extraAttrs += ' type="' + settings.subtype + '"';
        }
        if (self.disabled()) {
          extraAttrs += ' disabled="disabled"';
        }
        icon = settings.icon;
        if (icon && icon != 'caret') {
          icon = prefix + 'ico ' + prefix + 'i-' + settings.icon;
        }
        text = self._text;
        if (icon || text) {
          openBtnHtml = '<div id="' + id + '-open" class="' + prefix + 'btn ' + prefix + 'open" tabIndex="-1" role="button">' + '<button id="' + id + '-action" type="button" hidefocus tabindex="-1">' + (icon != 'caret' ? '<i class="' + icon + '"></i>' : '<i class="' + prefix + 'caret"></i>') + (text ? (icon ? ' ' : '') + text : '') + '</button>' + '</div>';
          self.addClass('has-open');
        }
        return '<div id="' + id + '" class="' + self.classes() + '">' + '<input id="' + id + '-inp" class="' + prefix + 'textbox ' + prefix + 'placeholder" value="' + value + '" hidefocus="true"' + extraAttrs + '>' + openBtnHtml + '</div>';
      }
    });
  });
  define('tinymce/ui/Path', ['tinymce/ui/Widget'], function (Widget) {
    'use strict';
    return Widget.extend({
      init: function (settings) {
        var self = this;
        if (!settings.delimiter) {
          settings.delimiter = '\xbb';
        }
        self._super(settings);
        self.addClass('path');
        self.canFocus = true;
        self.on('click', function (e) {
          var index, target = e.target;
          if (index = target.getAttribute('data-index')) {
            self.fire('select', {
              value: self.data()[index],
              index: index
            });
          }
        });
      },
      focus: function () {
        var self = this;
        self.getEl().firstChild.focus();
        return self;
      },
      data: function (data) {
        var self = this;
        if (typeof data !== 'undefined') {
          self._data = data;
          self.update();
          return self;
        }
        return self._data;
      },
      update: function () {
        this.innerHtml(this._getPathHtml());
      },
      postRender: function () {
        var self = this;
        self._super();
        self.data(self.settings.data);
      },
      renderHtml: function () {
        var self = this;
        return '<div id="' + self._id + '" class="' + self.classes() + '">' + self._getPathHtml() + '</div>';
      },
      _getPathHtml: function () {
        var self = this, parts = self._data || [], i, l, html = '', prefix = self.classPrefix;
        for (i = 0, l = parts.length; i < l; i++) {
          html += (i > 0 ? '<div class="' + prefix + 'divider" aria-hidden="true"> ' + self.settings.delimiter + ' </div>' : '') + '<div role="button" class="' + prefix + 'path-item' + (i == l - 1 ? ' ' + prefix + 'last' : '') + '" data-index="' + i + '" tabindex="-1" id="' + self._id + '-' + i + '" aria-level="' + i + '">' + parts[i].name + '</div>';
        }
        if (!html) {
          html = '<div class="' + prefix + 'path-item">&nbsp;</div>';
        }
        return html;
      }
    });
  });
  define('tinymce/ui/ElementPath', [
    'tinymce/ui/Path',
    'tinymce/EditorManager'
  ], function (Path, EditorManager) {
    return Path.extend({
      postRender: function () {
        var self = this, editor = EditorManager.activeEditor;
        function isHidden(elm) {
          if (elm.nodeType === 1) {
            if (elm.nodeName == 'BR' || !!elm.getAttribute('data-mce-bogus')) {
              return true;
            }
            if (elm.getAttribute('data-mce-type') === 'bookmark') {
              return true;
            }
          }
          return false;
        }
        self.on('select', function (e) {
          var parents = [], node, body = editor.getBody();
          editor.focus();
          node = editor.selection.getStart();
          while (node && node != body) {
            if (!isHidden(node)) {
              parents.push(node);
            }
            node = node.parentNode;
          }
          editor.selection.select(parents[parents.length - 1 - e.index]);
          editor.nodeChanged();
        });
        editor.on('nodeChange', function (e) {
          var parents = [], selectionParents = e.parents, i = selectionParents.length;
          while (i--) {
            if (selectionParents[i].nodeType == 1 && !isHidden(selectionParents[i])) {
              var args = editor.fire('ResolveName', {
                  name: selectionParents[i].nodeName.toLowerCase(),
                  target: selectionParents[i]
                });
              parents.push({ name: args.name });
            }
          }
          self.data(parents);
        });
        return self._super();
      }
    });
  });
  define('tinymce/ui/FormItem', ['tinymce/ui/Container'], function (Container) {
    'use strict';
    return Container.extend({
      Defaults: {
        layout: 'flex',
        align: 'center',
        defaults: { flex: 1 }
      },
      renderHtml: function () {
        var self = this, layout = self._layout, prefix = self.classPrefix;
        self.addClass('formitem');
        layout.preRender(self);
        return '<div id="' + self._id + '" class="' + self.classes() + '" hideFocus="1" tabIndex="-1">' + (self.settings.title ? '<div id="' + self._id + '-title" class="' + prefix + 'title">' + self.settings.title + '</div>' : '') + '<div id="' + self._id + '-body" class="' + self.classes('body') + '">' + (self.settings.html || '') + layout.renderHtml(self) + '</div>' + '</div>';
      }
    });
  });
  define('tinymce/ui/Form', [
    'tinymce/ui/Container',
    'tinymce/ui/FormItem'
  ], function (Container, FormItem) {
    'use strict';
    return Container.extend({
      Defaults: {
        containerCls: 'form',
        layout: 'flex',
        direction: 'column',
        align: 'stretch',
        flex: 1,
        padding: 20,
        labelGap: 30,
        spacing: 10,
        callbacks: {
          submit: function () {
            this.submit();
          }
        }
      },
      preRender: function () {
        var self = this, items = self.items();
        items.each(function (ctrl) {
          var formItem, label = ctrl.settings.label;
          if (label) {
            formItem = new FormItem({
              layout: 'flex',
              autoResize: 'overflow',
              defaults: { flex: 1 },
              items: [{
                  type: 'label',
                  id: ctrl._id + '-l',
                  text: label,
                  flex: 0,
                  forId: ctrl._id,
                  disabled: ctrl.disabled()
                }]
            });
            formItem.type = 'formitem';
            ctrl.aria('labelledby', ctrl._id + '-l');
            if (typeof ctrl.settings.flex == 'undefined') {
              ctrl.settings.flex = 1;
            }
            self.replace(ctrl, formItem);
            formItem.add(ctrl);
          }
        });
      },
      recalcLabels: function () {
        var self = this, maxLabelWidth = 0, labels = [], i, labelGap;
        if (self.settings.labelGapCalc === false) {
          return;
        }
        self.items().filter('formitem').each(function (item) {
          var labelCtrl = item.items()[0], labelWidth = labelCtrl.getEl().clientWidth;
          maxLabelWidth = labelWidth > maxLabelWidth ? labelWidth : maxLabelWidth;
          labels.push(labelCtrl);
        });
        labelGap = self.settings.labelGap || 0;
        i = labels.length;
        while (i--) {
          labels[i].settings.minWidth = maxLabelWidth + labelGap;
        }
      },
      visible: function (state) {
        var val = this._super(state);
        if (state === true && this._rendered) {
          this.recalcLabels();
        }
        return val;
      },
      submit: function () {
        return this.fire('submit', { data: this.toJSON() });
      },
      postRender: function () {
        var self = this;
        self._super();
        self.recalcLabels();
        self.fromJSON(self.settings.data);
      }
    });
  });
  define('tinymce/ui/FieldSet', ['tinymce/ui/Form'], function (Form) {
    'use strict';
    return Form.extend({
      Defaults: {
        containerCls: 'fieldset',
        layout: 'flex',
        direction: 'column',
        align: 'stretch',
        flex: 1,
        padding: '25 15 5 15',
        labelGap: 30,
        spacing: 10,
        border: 1
      },
      renderHtml: function () {
        var self = this, layout = self._layout, prefix = self.classPrefix;
        self.preRender();
        layout.preRender(self);
        return '<fieldset id="' + self._id + '" class="' + self.classes() + '" hideFocus="1" tabIndex="-1">' + (self.settings.title ? '<legend id="' + self._id + '-title" class="' + prefix + 'fieldset-title">' + self.settings.title + '</legend>' : '') + '<div id="' + self._id + '-body" class="' + self.classes('body') + '">' + (self.settings.html || '') + layout.renderHtml(self) + '</div>' + '</fieldset>';
      }
    });
  });
  define('tinymce/ui/FilePicker', ['tinymce/ui/ComboBox'], function (ComboBox) {
    'use strict';
    return ComboBox.extend({
      init: function (settings) {
        var self = this, editor = tinymce.activeEditor, fileBrowserCallback;
        settings.spellcheck = false;
        fileBrowserCallback = editor.settings.file_browser_callback;
        if (fileBrowserCallback) {
          settings.icon = 'browse';
          settings.onaction = function () {
            fileBrowserCallback(self.getEl('inp').id, self.getEl('inp').value, settings.filetype, window);
          };
        }
        self._super(settings);
      }
    });
  });
  define('tinymce/ui/FitLayout', ['tinymce/ui/AbsoluteLayout'], function (AbsoluteLayout) {
    'use strict';
    return AbsoluteLayout.extend({
      recalc: function (container) {
        var contLayoutRect = container.layoutRect(), paddingBox = container.paddingBox();
        container.items().filter(':visible').each(function (ctrl) {
          ctrl.layoutRect({
            x: paddingBox.left,
            y: paddingBox.top,
            w: contLayoutRect.innerW - paddingBox.right - paddingBox.left,
            h: contLayoutRect.innerH - paddingBox.top - paddingBox.bottom
          });
          if (ctrl.recalc) {
            ctrl.recalc();
          }
        });
      }
    });
  });
  define('tinymce/ui/FlexLayout', ['tinymce/ui/AbsoluteLayout'], function (AbsoluteLayout) {
    'use strict';
    return AbsoluteLayout.extend({
      recalc: function (container) {
        var i, l, items, contLayoutRect, contPaddingBox, contSettings, align, pack, spacing, totalFlex, availableSpace, direction;
        var ctrl, ctrlLayoutRect, ctrlSettings, flex, maxSizeItems = [], size, maxSize, ratio, rect, pos, maxAlignEndPos;
        var sizeName, minSizeName, posName, maxSizeName, beforeName, innerSizeName, deltaSizeName, contentSizeName;
        var alignAxisName, alignInnerSizeName, alignSizeName, alignMinSizeName, alignBeforeName, alignAfterName;
        var alignDeltaSizeName, alignContentSizeName;
        var max = Math.max, min = Math.min;
        items = container.items().filter(':visible');
        contLayoutRect = container.layoutRect();
        contPaddingBox = container._paddingBox;
        contSettings = container.settings;
        direction = container.isRtl() ? contSettings.direction || 'row-reversed' : contSettings.direction;
        align = contSettings.align;
        pack = container.isRtl() ? contSettings.pack || 'end' : contSettings.pack;
        spacing = contSettings.spacing || 0;
        if (direction == 'row-reversed' || direction == 'column-reverse') {
          items = items.set(items.toArray().reverse());
          direction = direction.split('-')[0];
        }
        if (direction == 'column') {
          posName = 'y';
          sizeName = 'h';
          minSizeName = 'minH';
          maxSizeName = 'maxH';
          innerSizeName = 'innerH';
          beforeName = 'top';
          deltaSizeName = 'deltaH';
          contentSizeName = 'contentH';
          alignBeforeName = 'left';
          alignSizeName = 'w';
          alignAxisName = 'x';
          alignInnerSizeName = 'innerW';
          alignMinSizeName = 'minW';
          alignAfterName = 'right';
          alignDeltaSizeName = 'deltaW';
          alignContentSizeName = 'contentW';
        } else {
          posName = 'x';
          sizeName = 'w';
          minSizeName = 'minW';
          maxSizeName = 'maxW';
          innerSizeName = 'innerW';
          beforeName = 'left';
          deltaSizeName = 'deltaW';
          contentSizeName = 'contentW';
          alignBeforeName = 'top';
          alignSizeName = 'h';
          alignAxisName = 'y';
          alignInnerSizeName = 'innerH';
          alignMinSizeName = 'minH';
          alignAfterName = 'bottom';
          alignDeltaSizeName = 'deltaH';
          alignContentSizeName = 'contentH';
        }
        availableSpace = contLayoutRect[innerSizeName] - contPaddingBox[beforeName] - contPaddingBox[beforeName];
        maxAlignEndPos = totalFlex = 0;
        for (i = 0, l = items.length; i < l; i++) {
          ctrl = items[i];
          ctrlLayoutRect = ctrl.layoutRect();
          ctrlSettings = ctrl.settings;
          flex = ctrlSettings.flex;
          availableSpace -= i < l - 1 ? spacing : 0;
          if (flex > 0) {
            totalFlex += flex;
            if (ctrlLayoutRect[maxSizeName]) {
              maxSizeItems.push(ctrl);
            }
            ctrlLayoutRect.flex = flex;
          }
          availableSpace -= ctrlLayoutRect[minSizeName];
          size = contPaddingBox[alignBeforeName] + ctrlLayoutRect[alignMinSizeName] + contPaddingBox[alignAfterName];
          if (size > maxAlignEndPos) {
            maxAlignEndPos = size;
          }
        }
        rect = {};
        if (availableSpace < 0) {
          rect[minSizeName] = contLayoutRect[minSizeName] - availableSpace + contLayoutRect[deltaSizeName];
        } else {
          rect[minSizeName] = contLayoutRect[innerSizeName] - availableSpace + contLayoutRect[deltaSizeName];
        }
        rect[alignMinSizeName] = maxAlignEndPos + contLayoutRect[alignDeltaSizeName];
        rect[contentSizeName] = contLayoutRect[innerSizeName] - availableSpace;
        rect[alignContentSizeName] = maxAlignEndPos;
        rect.minW = min(rect.minW, contLayoutRect.maxW);
        rect.minH = min(rect.minH, contLayoutRect.maxH);
        rect.minW = max(rect.minW, contLayoutRect.startMinWidth);
        rect.minH = max(rect.minH, contLayoutRect.startMinHeight);
        if (contLayoutRect.autoResize && (rect.minW != contLayoutRect.minW || rect.minH != contLayoutRect.minH)) {
          rect.w = rect.minW;
          rect.h = rect.minH;
          container.layoutRect(rect);
          this.recalc(container);
          if (container._lastRect === null) {
            var parentCtrl = container.parent();
            if (parentCtrl) {
              parentCtrl._lastRect = null;
              parentCtrl.recalc();
            }
          }
          return;
        }
        ratio = availableSpace / totalFlex;
        for (i = 0, l = maxSizeItems.length; i < l; i++) {
          ctrl = maxSizeItems[i];
          ctrlLayoutRect = ctrl.layoutRect();
          maxSize = ctrlLayoutRect[maxSizeName];
          size = ctrlLayoutRect[minSizeName] + ctrlLayoutRect.flex * ratio;
          if (size > maxSize) {
            availableSpace -= ctrlLayoutRect[maxSizeName] - ctrlLayoutRect[minSizeName];
            totalFlex -= ctrlLayoutRect.flex;
            ctrlLayoutRect.flex = 0;
            ctrlLayoutRect.maxFlexSize = maxSize;
          } else {
            ctrlLayoutRect.maxFlexSize = 0;
          }
        }
        ratio = availableSpace / totalFlex;
        pos = contPaddingBox[beforeName];
        rect = {};
        if (totalFlex === 0) {
          if (pack == 'end') {
            pos = availableSpace + contPaddingBox[beforeName];
          } else if (pack == 'center') {
            pos = Math.round(contLayoutRect[innerSizeName] / 2 - (contLayoutRect[innerSizeName] - availableSpace) / 2) + contPaddingBox[beforeName];
            if (pos < 0) {
              pos = contPaddingBox[beforeName];
            }
          } else if (pack == 'justify') {
            pos = contPaddingBox[beforeName];
            spacing = Math.floor(availableSpace / (items.length - 1));
          }
        }
        rect[alignAxisName] = contPaddingBox[alignBeforeName];
        for (i = 0, l = items.length; i < l; i++) {
          ctrl = items[i];
          ctrlLayoutRect = ctrl.layoutRect();
          size = ctrlLayoutRect.maxFlexSize || ctrlLayoutRect[minSizeName];
          if (align === 'center') {
            rect[alignAxisName] = Math.round(contLayoutRect[alignInnerSizeName] / 2 - ctrlLayoutRect[alignSizeName] / 2);
          } else if (align === 'stretch') {
            rect[alignSizeName] = max(ctrlLayoutRect[alignMinSizeName] || 0, contLayoutRect[alignInnerSizeName] - contPaddingBox[alignBeforeName] - contPaddingBox[alignAfterName]);
            rect[alignAxisName] = contPaddingBox[alignBeforeName];
          } else if (align === 'end') {
            rect[alignAxisName] = contLayoutRect[alignInnerSizeName] - ctrlLayoutRect[alignSizeName] - contPaddingBox.top;
          }
          if (ctrlLayoutRect.flex > 0) {
            size += ctrlLayoutRect.flex * ratio;
          }
          rect[sizeName] = size;
          rect[posName] = pos;
          ctrl.layoutRect(rect);
          if (ctrl.recalc) {
            ctrl.recalc();
          }
          pos += size + spacing;
        }
      }
    });
  });
  define('tinymce/ui/FlowLayout', ['tinymce/ui/Layout'], function (Layout) {
    return Layout.extend({
      Defaults: {
        containerClass: 'flow-layout',
        controlClass: 'flow-layout-item',
        endClass: 'break'
      },
      recalc: function (container) {
        container.items().filter(':visible').each(function (ctrl) {
          if (ctrl.recalc) {
            ctrl.recalc();
          }
        });
      }
    });
  });
  define('tinymce/ui/FormatControls', [
    'tinymce/ui/Control',
    'tinymce/ui/Widget',
    'tinymce/ui/FloatPanel',
    'tinymce/util/Tools',
    'tinymce/EditorManager',
    'tinymce/Env'
  ], function (Control, Widget, FloatPanel, Tools, EditorManager, Env) {
    var each = Tools.each;
    EditorManager.on('AddEditor', function (e) {
      if (e.editor.rtl) {
        Control.rtl = true;
      }
      registerControls(e.editor);
    });
    Control.translate = function (text) {
      return EditorManager.translate(text);
    };
    Widget.tooltips = !Env.iOS;
    function registerControls(editor) {
      var formatMenu;
      function getPreviewCss(format) {
        var name, previewElm, dom = editor.dom;
        var previewCss = '', parentFontSize, previewStyles;
        previewStyles = editor.settings.preview_styles;
        if (previewStyles === false) {
          return '';
        }
        if (!previewStyles) {
          previewStyles = 'font-family font-size font-weight font-style text-decoration ' + 'text-transform color background-color border border-radius outline text-shadow';
        }
        function removeVars(val) {
          return val.replace(/%(\w+)/g, '');
        }
        format = editor.formatter.get(format);
        if (!format) {
          return;
        }
        format = format[0];
        name = format.block || format.inline || 'span';
        previewElm = dom.create(name);
        each(format.styles, function (value, name) {
          value = removeVars(value);
          if (value) {
            dom.setStyle(previewElm, name, value);
          }
        });
        each(format.attributes, function (value, name) {
          value = removeVars(value);
          if (value) {
            dom.setAttrib(previewElm, name, value);
          }
        });
        each(format.classes, function (value) {
          value = removeVars(value);
          if (!dom.hasClass(previewElm, value)) {
            dom.addClass(previewElm, value);
          }
        });
        editor.fire('PreviewFormats');
        dom.setStyles(previewElm, {
          position: 'absolute',
          left: -65535
        });
        editor.getBody().appendChild(previewElm);
        parentFontSize = dom.getStyle(editor.getBody(), 'fontSize', true);
        parentFontSize = /px$/.test(parentFontSize) ? parseInt(parentFontSize, 10) : 0;
        each(previewStyles.split(' '), function (name) {
          var value = dom.getStyle(previewElm, name, true);
          if (name == 'background-color' && /transparent|rgba\s*\([^)]+,\s*0\)/.test(value)) {
            value = dom.getStyle(editor.getBody(), name, true);
            if (dom.toHex(value).toLowerCase() == '#ffffff') {
              return;
            }
          }
          if (name == 'color') {
            if (dom.toHex(value).toLowerCase() == '#000000') {
              return;
            }
          }
          if (name == 'font-size') {
            if (/em|%$/.test(value)) {
              if (parentFontSize === 0) {
                return;
              }
              value = parseFloat(value, 10) / (/%$/.test(value) ? 100 : 1);
              value = value * parentFontSize + 'px';
            }
          }
          if (name == 'border' && value) {
            previewCss += 'padding:0 2px;';
          }
          previewCss += name + ':' + value + ';';
        });
        editor.fire('AfterPreviewFormats');
        dom.remove(previewElm);
        return previewCss;
      }
      function createListBoxChangeHandler(items, formatName) {
        return function () {
          var self = this;
          editor.on('nodeChange', function (e) {
            var formatter = editor.formatter;
            var value = null;
            each(e.parents, function (node) {
              each(items, function (item) {
                if (formatName) {
                  if (formatter.matchNode(node, formatName, { value: item.value })) {
                    value = item.value;
                  }
                } else {
                  if (formatter.matchNode(node, item.value)) {
                    value = item.value;
                  }
                }
                if (value) {
                  return false;
                }
              });
              if (value) {
                return false;
              }
            });
            self.value(value);
          });
        };
      }
      function createFormats(formats) {
        formats = formats.split(';');
        var i = formats.length;
        while (i--) {
          formats[i] = formats[i].split('=');
        }
        return formats;
      }
      function createFormatMenu() {
        var count = 0, newFormats = [];
        var defaultStyleFormats = [
            {
              title: 'Headers',
              items: [
                {
                  title: 'Header 1',
                  format: 'h1'
                },
                {
                  title: 'Header 2',
                  format: 'h2'
                },
                {
                  title: 'Header 3',
                  format: 'h3'
                },
                {
                  title: 'Header 4',
                  format: 'h4'
                },
                {
                  title: 'Header 5',
                  format: 'h5'
                },
                {
                  title: 'Header 6',
                  format: 'h6'
                }
              ]
            },
            {
              title: 'Inline',
              items: [
                {
                  title: 'Bold',
                  icon: 'bold',
                  format: 'bold'
                },
                {
                  title: 'Italic',
                  icon: 'italic',
                  format: 'italic'
                },
                {
                  title: 'Underline',
                  icon: 'underline',
                  format: 'underline'
                },
                {
                  title: 'Strikethrough',
                  icon: 'strikethrough',
                  format: 'strikethrough'
                },
                {
                  title: 'Superscript',
                  icon: 'superscript',
                  format: 'superscript'
                },
                {
                  title: 'Subscript',
                  icon: 'subscript',
                  format: 'subscript'
                },
                {
                  title: 'Code',
                  icon: 'code',
                  format: 'code'
                }
              ]
            },
            {
              title: 'Blocks',
              items: [
                {
                  title: 'Paragraph',
                  format: 'p'
                },
                {
                  title: 'Blockquote',
                  format: 'blockquote'
                },
                {
                  title: 'Div',
                  format: 'div'
                },
                {
                  title: 'Pre',
                  format: 'pre'
                }
              ]
            },
            {
              title: 'Alignment',
              items: [
                {
                  title: 'Left',
                  icon: 'alignleft',
                  format: 'alignleft'
                },
                {
                  title: 'Center',
                  icon: 'aligncenter',
                  format: 'aligncenter'
                },
                {
                  title: 'Right',
                  icon: 'alignright',
                  format: 'alignright'
                },
                {
                  title: 'Justify',
                  icon: 'alignjustify',
                  format: 'alignjustify'
                }
              ]
            }
          ];
        function createMenu(formats) {
          var menu = [];
          if (!formats) {
            return;
          }
          each(formats, function (format) {
            var menuItem = {
                text: format.title,
                icon: format.icon
              };
            if (format.items) {
              menuItem.menu = createMenu(format.items);
            } else {
              var formatName = format.format || 'custom' + count++;
              if (!format.format) {
                format.name = formatName;
                newFormats.push(format);
              }
              menuItem.format = formatName;
            }
            menu.push(menuItem);
          });
          return menu;
        }
        function createStylesMenu() {
          var menu;
          if (editor.settings.style_formats_merge) {
            if (editor.settings.style_formats) {
              menu = createMenu(defaultStyleFormats.concat(editor.settings.style_formats));
            } else {
              menu = createMenu(defaultStyleFormats);
            }
          } else {
            menu = createMenu(editor.settings.style_formats || defaultStyleFormats);
          }
          return menu;
        }
        editor.on('init', function () {
          each(newFormats, function (format) {
            editor.formatter.register(format.name, format);
          });
        });
        return {
          type: 'menu',
          items: createStylesMenu(),
          onPostRender: function (e) {
            editor.fire('renderFormatsMenu', { control: e.control });
          },
          itemDefaults: {
            preview: true,
            textStyle: function () {
              if (this.settings.format) {
                return getPreviewCss(this.settings.format);
              }
            },
            onPostRender: function () {
              var self = this, formatName = this.settings.format;
              if (formatName) {
                self.parent().on('show', function () {
                  self.disabled(!editor.formatter.canApply(formatName));
                  self.active(editor.formatter.match(formatName));
                });
              }
            },
            onclick: function () {
              if (this.settings.format) {
                toggleFormat(this.settings.format);
              }
            }
          }
        };
      }
      formatMenu = createFormatMenu();
      each({
        bold: 'Bold',
        italic: 'Italic',
        underline: 'Underline',
        strikethrough: 'Strikethrough',
        subscript: 'Subscript',
        superscript: 'Superscript'
      }, function (text, name) {
        editor.addButton(name, {
          tooltip: text,
          onPostRender: function () {
            var self = this;
            if (editor.formatter) {
              editor.formatter.formatChanged(name, function (state) {
                self.active(state);
              });
            } else {
              editor.on('init', function () {
                editor.formatter.formatChanged(name, function (state) {
                  self.active(state);
                });
              });
            }
          },
          onclick: function () {
            toggleFormat(name);
          }
        });
      });
      each({
        outdent: [
          'Decrease indent',
          'Outdent'
        ],
        indent: [
          'Increase indent',
          'Indent'
        ],
        cut: [
          'Cut',
          'Cut'
        ],
        copy: [
          'Copy',
          'Copy'
        ],
        paste: [
          'Paste',
          'Paste'
        ],
        help: [
          'Help',
          'mceHelp'
        ],
        selectall: [
          'Select all',
          'SelectAll'
        ],
        hr: [
          'Insert horizontal rule',
          'InsertHorizontalRule'
        ],
        removeformat: [
          'Clear formatting',
          'RemoveFormat'
        ],
        visualaid: [
          'Visual aids',
          'mceToggleVisualAid'
        ],
        newdocument: [
          'New document',
          'mceNewDocument'
        ]
      }, function (item, name) {
        editor.addButton(name, {
          tooltip: item[0],
          cmd: item[1]
        });
      });
      each({
        blockquote: [
          'Blockquote',
          'mceBlockQuote'
        ],
        numlist: [
          'Numbered list',
          'InsertOrderedList'
        ],
        bullist: [
          'Bullet list',
          'InsertUnorderedList'
        ],
        subscript: [
          'Subscript',
          'Subscript'
        ],
        superscript: [
          'Superscript',
          'Superscript'
        ],
        alignleft: [
          'Align left',
          'JustifyLeft'
        ],
        aligncenter: [
          'Align center',
          'JustifyCenter'
        ],
        alignright: [
          'Align right',
          'JustifyRight'
        ],
        alignjustify: [
          'Justify',
          'JustifyFull'
        ]
      }, function (item, name) {
        editor.addButton(name, {
          tooltip: item[0],
          cmd: item[1],
          onPostRender: function () {
            var self = this;
            if (editor.formatter) {
              editor.formatter.formatChanged(name, function (state) {
                self.active(state);
              });
            } else {
              editor.on('init', function () {
                editor.formatter.formatChanged(name, function (state) {
                  self.active(state);
                });
              });
            }
          }
        });
      });
      function hasUndo() {
        return editor.undoManager ? editor.undoManager.hasUndo() : false;
      }
      function hasRedo() {
        return editor.undoManager ? editor.undoManager.hasRedo() : false;
      }
      function toggleUndoState() {
        var self = this;
        self.disabled(!hasUndo());
        editor.on('Undo Redo AddUndo TypingUndo', function () {
          self.disabled(!hasUndo());
        });
      }
      function toggleRedoState() {
        var self = this;
        self.disabled(!hasRedo());
        editor.on('Undo Redo AddUndo TypingUndo', function () {
          self.disabled(!hasRedo());
        });
      }
      function toggleVisualAidState() {
        var self = this;
        editor.on('VisualAid', function (e) {
          self.active(e.hasVisual);
        });
        self.active(editor.hasVisual);
      }
      editor.addButton('undo', {
        tooltip: 'Undo',
        onPostRender: toggleUndoState,
        cmd: 'undo'
      });
      editor.addButton('redo', {
        tooltip: 'Redo',
        onPostRender: toggleRedoState,
        cmd: 'redo'
      });
      editor.addMenuItem('newdocument', {
        text: 'New document',
        shortcut: 'Ctrl+N',
        icon: 'newdocument',
        cmd: 'mceNewDocument'
      });
      editor.addMenuItem('undo', {
        text: 'Undo',
        icon: 'undo',
        shortcut: 'Ctrl+Z',
        onPostRender: toggleUndoState,
        cmd: 'undo'
      });
      editor.addMenuItem('redo', {
        text: 'Redo',
        icon: 'redo',
        shortcut: 'Ctrl+Y',
        onPostRender: toggleRedoState,
        cmd: 'redo'
      });
      editor.addMenuItem('visualaid', {
        text: 'Visual aids',
        selectable: true,
        onPostRender: toggleVisualAidState,
        cmd: 'mceToggleVisualAid'
      });
      each({
        cut: [
          'Cut',
          'Cut',
          'Ctrl+X'
        ],
        copy: [
          'Copy',
          'Copy',
          'Ctrl+C'
        ],
        paste: [
          'Paste',
          'Paste',
          'Ctrl+V'
        ],
        selectall: [
          'Select all',
          'SelectAll',
          'Ctrl+A'
        ],
        bold: [
          'Bold',
          'Bold',
          'Ctrl+B'
        ],
        italic: [
          'Italic',
          'Italic',
          'Ctrl+I'
        ],
        underline: [
          'Underline',
          'Underline'
        ],
        strikethrough: [
          'Strikethrough',
          'Strikethrough'
        ],
        subscript: [
          'Subscript',
          'Subscript'
        ],
        superscript: [
          'Superscript',
          'Superscript'
        ],
        removeformat: [
          'Clear formatting',
          'RemoveFormat'
        ]
      }, function (item, name) {
        editor.addMenuItem(name, {
          text: item[0],
          icon: name,
          shortcut: item[2],
          cmd: item[1]
        });
      });
      editor.on('mousedown', function () {
        FloatPanel.hideAll();
      });
      function toggleFormat(fmt) {
        if (fmt.control) {
          fmt = fmt.control.value();
        }
        if (fmt) {
          editor.execCommand('mceToggleFormat', false, fmt);
        }
      }
      editor.addButton('styleselect', {
        type: 'menubutton',
        text: 'Formats',
        menu: formatMenu
      });
      editor.addButton('formatselect', function () {
        var items = [], blocks = createFormats(editor.settings.block_formats || 'Paragraph=p;' + 'Address=address;' + 'Pre=pre;' + 'Header 1=h1;' + 'Header 2=h2;' + 'Header 3=h3;' + 'Header 4=h4;' + 'Header 5=h5;' + 'Header 6=h6');
        each(blocks, function (block) {
          items.push({
            text: block[0],
            value: block[1],
            textStyle: function () {
              return getPreviewCss(block[1]);
            }
          });
        });
        return {
          type: 'listbox',
          text: blocks[0][0],
          values: items,
          fixedWidth: true,
          onselect: toggleFormat,
          onPostRender: createListBoxChangeHandler(items)
        };
      });
      editor.addButton('fontselect', function () {
        var defaultFontsFormats = 'Andale Mono=andale mono,times;' + 'Arial=arial,helvetica,sans-serif;' + 'Arial Black=arial black,avant garde;' + 'Book Antiqua=book antiqua,palatino;' + 'Comic Sans MS=comic sans ms,sans-serif;' + 'Courier New=courier new,courier;' + 'Georgia=georgia,palatino;' + 'Helvetica=helvetica;' + 'Impact=impact,chicago;' + 'Symbol=symbol;' + 'Tahoma=tahoma,arial,helvetica,sans-serif;' + 'Terminal=terminal,monaco;' + 'Times New Roman=times new roman,times;' + 'Trebuchet MS=trebuchet ms,geneva;' + 'Verdana=verdana,geneva;' + 'Webdings=webdings;' + 'Wingdings=wingdings,zapf dingbats';
        var items = [], fonts = createFormats(editor.settings.font_formats || defaultFontsFormats);
        each(fonts, function (font) {
          items.push({
            text: { raw: font[0] },
            value: font[1],
            textStyle: font[1].indexOf('dings') == -1 ? 'font-family:' + font[1] : ''
          });
        });
        return {
          type: 'listbox',
          text: 'Font Family',
          tooltip: 'Font Family',
          values: items,
          fixedWidth: true,
          onPostRender: createListBoxChangeHandler(items, 'fontname'),
          onselect: function (e) {
            if (e.control.settings.value) {
              editor.execCommand('FontName', false, e.control.settings.value);
            }
          }
        };
      });
      editor.addButton('fontsizeselect', function () {
        var items = [], defaultFontsizeFormats = '8pt 10pt 12pt 14pt 18pt 24pt 36pt';
        var fontsize_formats = editor.settings.fontsize_formats || defaultFontsizeFormats;
        each(fontsize_formats.split(' '), function (item) {
          items.push({
            text: item,
            value: item
          });
        });
        return {
          type: 'listbox',
          text: 'Font Sizes',
          tooltip: 'Font Sizes',
          values: items,
          fixedWidth: true,
          onPostRender: createListBoxChangeHandler(items, 'fontsize'),
          onclick: function (e) {
            if (e.control.settings.value) {
              editor.execCommand('FontSize', false, e.control.settings.value);
            }
          }
        };
      });
      editor.addMenuItem('formats', {
        text: 'Formats',
        menu: formatMenu
      });
    }
  });
  define('tinymce/ui/GridLayout', ['tinymce/ui/AbsoluteLayout'], function (AbsoluteLayout) {
    'use strict';
    return AbsoluteLayout.extend({
      recalc: function (container) {
        var settings = container.settings, rows, cols, items, contLayoutRect, width, height, rect, ctrlLayoutRect, ctrl, x, y, posX, posY, ctrlSettings, contPaddingBox, align, spacingH, spacingV, alignH, alignV, maxX, maxY, colWidths = [], rowHeights = [], ctrlMinWidth, ctrlMinHeight, availableWidth, availableHeight;
        settings = container.settings;
        items = container.items().filter(':visible');
        contLayoutRect = container.layoutRect();
        cols = settings.columns || Math.ceil(Math.sqrt(items.length));
        rows = Math.ceil(items.length / cols);
        spacingH = settings.spacingH || settings.spacing || 0;
        spacingV = settings.spacingV || settings.spacing || 0;
        alignH = settings.alignH || settings.align;
        alignV = settings.alignV || settings.align;
        contPaddingBox = container._paddingBox;
        if (alignH && typeof alignH == 'string') {
          alignH = [alignH];
        }
        if (alignV && typeof alignV == 'string') {
          alignV = [alignV];
        }
        for (x = 0; x < cols; x++) {
          colWidths.push(0);
        }
        for (y = 0; y < rows; y++) {
          rowHeights.push(0);
        }
        for (y = 0; y < rows; y++) {
          for (x = 0; x < cols; x++) {
            ctrl = items[y * cols + x];
            if (!ctrl) {
              break;
            }
            ctrlLayoutRect = ctrl.layoutRect();
            ctrlMinWidth = ctrlLayoutRect.minW;
            ctrlMinHeight = ctrlLayoutRect.minH;
            colWidths[x] = ctrlMinWidth > colWidths[x] ? ctrlMinWidth : colWidths[x];
            rowHeights[y] = ctrlMinHeight > rowHeights[y] ? ctrlMinHeight : rowHeights[y];
          }
        }
        availableWidth = contLayoutRect.innerW - contPaddingBox.left - contPaddingBox.right;
        for (maxX = 0, x = 0; x < cols; x++) {
          maxX += colWidths[x] + (x > 0 ? spacingH : 0);
          availableWidth -= (x > 0 ? spacingH : 0) + colWidths[x];
        }
        availableHeight = contLayoutRect.innerH - contPaddingBox.top - contPaddingBox.bottom;
        for (maxY = 0, y = 0; y < rows; y++) {
          maxY += rowHeights[y] + (y > 0 ? spacingV : 0);
          availableHeight -= (y > 0 ? spacingV : 0) + rowHeights[y];
        }
        maxX += contPaddingBox.left + contPaddingBox.right;
        maxY += contPaddingBox.top + contPaddingBox.bottom;
        rect = {};
        rect.minW = maxX + (contLayoutRect.w - contLayoutRect.innerW);
        rect.minH = maxY + (contLayoutRect.h - contLayoutRect.innerH);
        rect.contentW = rect.minW - contLayoutRect.deltaW;
        rect.contentH = rect.minH - contLayoutRect.deltaH;
        rect.minW = Math.min(rect.minW, contLayoutRect.maxW);
        rect.minH = Math.min(rect.minH, contLayoutRect.maxH);
        rect.minW = Math.max(rect.minW, contLayoutRect.startMinWidth);
        rect.minH = Math.max(rect.minH, contLayoutRect.startMinHeight);
        if (contLayoutRect.autoResize && (rect.minW != contLayoutRect.minW || rect.minH != contLayoutRect.minH)) {
          rect.w = rect.minW;
          rect.h = rect.minH;
          container.layoutRect(rect);
          this.recalc(container);
          if (container._lastRect === null) {
            var parentCtrl = container.parent();
            if (parentCtrl) {
              parentCtrl._lastRect = null;
              parentCtrl.recalc();
            }
          }
          return;
        }
        if (contLayoutRect.autoResize) {
          rect = container.layoutRect(rect);
          rect.contentW = rect.minW - contLayoutRect.deltaW;
          rect.contentH = rect.minH - contLayoutRect.deltaH;
        }
        var flexV;
        if (settings.packV == 'start') {
          flexV = 0;
        } else {
          flexV = availableHeight > 0 ? Math.floor(availableHeight / rows) : 0;
        }
        var totalFlex = 0;
        var flexWidths = settings.flexWidths;
        if (flexWidths) {
          for (x = 0; x < flexWidths.length; x++) {
            totalFlex += flexWidths[x];
          }
        } else {
          totalFlex = cols;
        }
        var ratio = availableWidth / totalFlex;
        for (x = 0; x < cols; x++) {
          colWidths[x] += flexWidths ? flexWidths[x] * ratio : ratio;
        }
        posY = contPaddingBox.top;
        for (y = 0; y < rows; y++) {
          posX = contPaddingBox.left;
          height = rowHeights[y] + flexV;
          for (x = 0; x < cols; x++) {
            ctrl = items[y * cols + x];
            if (!ctrl) {
              break;
            }
            ctrlSettings = ctrl.settings;
            ctrlLayoutRect = ctrl.layoutRect();
            width = Math.max(colWidths[x], ctrlLayoutRect.startMinWidth);
            ctrlLayoutRect.x = posX;
            ctrlLayoutRect.y = posY;
            align = ctrlSettings.alignH || (alignH ? alignH[x] || alignH[0] : null);
            if (align == 'center') {
              ctrlLayoutRect.x = posX + width / 2 - ctrlLayoutRect.w / 2;
            } else if (align == 'right') {
              ctrlLayoutRect.x = posX + width - ctrlLayoutRect.w;
            } else if (align == 'stretch') {
              ctrlLayoutRect.w = width;
            }
            align = ctrlSettings.alignV || (alignV ? alignV[x] || alignV[0] : null);
            if (align == 'center') {
              ctrlLayoutRect.y = posY + height / 2 - ctrlLayoutRect.h / 2;
            } else if (align == 'bottom') {
              ctrlLayoutRect.y = posY + height - ctrlLayoutRect.h;
            } else if (align == 'stretch') {
              ctrlLayoutRect.h = height;
            }
            ctrl.layoutRect(ctrlLayoutRect);
            posX += width + spacingH;
            if (ctrl.recalc) {
              ctrl.recalc();
            }
          }
          posY += height + spacingV;
        }
      }
    });
  });
  define('tinymce/ui/Iframe', ['tinymce/ui/Widget'], function (Widget) {
    'use strict';
    return Widget.extend({
      renderHtml: function () {
        var self = this;
        self.addClass('iframe');
        self.canFocus = false;
        return '<iframe id="' + self._id + '" class="' + self.classes() + '" tabindex="-1" src="' + (self.settings.url || 'javascript:\'\'') + '" frameborder="0"></iframe>';
      },
      src: function (src) {
        this.getEl().src = src;
      },
      html: function (html, callback) {
        var self = this, body = this.getEl().contentWindow.document.body;
        if (!body) {
          setTimeout(function () {
            self.html(html);
          }, 0);
        } else {
          body.innerHTML = html;
          if (callback) {
            callback();
          }
        }
        return this;
      }
    });
  });
  define('tinymce/ui/Label', [
    'tinymce/ui/Widget',
    'tinymce/ui/DomUtils'
  ], function (Widget, DomUtils) {
    'use strict';
    return Widget.extend({
      init: function (settings) {
        var self = this;
        self._super(settings);
        self.addClass('widget');
        self.addClass('label');
        self.canFocus = false;
        if (settings.multiline) {
          self.addClass('autoscroll');
        }
        if (settings.strong) {
          self.addClass('strong');
        }
      },
      initLayoutRect: function () {
        var self = this, layoutRect = self._super();
        if (self.settings.multiline) {
          var size = DomUtils.getSize(self.getEl());
          if (size.width > layoutRect.maxW) {
            layoutRect.minW = layoutRect.maxW;
            self.addClass('multiline');
          }
          self.getEl().style.width = layoutRect.minW + 'px';
          layoutRect.startMinH = layoutRect.h = layoutRect.minH = Math.min(layoutRect.maxH, DomUtils.getSize(self.getEl()).height);
        }
        return layoutRect;
      },
      repaint: function () {
        var self = this;
        if (!self.settings.multiline) {
          self.getEl().style.lineHeight = self.layoutRect().h + 'px';
        }
        return self._super();
      },
      text: function (text) {
        var self = this;
        if (self._rendered && text) {
          this.innerHtml(self.encode(text));
        }
        return self._super(text);
      },
      renderHtml: function () {
        var self = this, forId = self.settings.forId;
        return '<label id="' + self._id + '" class="' + self.classes() + '"' + (forId ? ' for="' + forId + '"' : '') + '>' + self.encode(self._text) + '</label>';
      }
    });
  });
  define('tinymce/ui/Toolbar', ['tinymce/ui/Container'], function (Container) {
    'use strict';
    return Container.extend({
      Defaults: {
        role: 'toolbar',
        layout: 'flow'
      },
      init: function (settings) {
        var self = this;
        self._super(settings);
        self.addClass('toolbar');
      },
      postRender: function () {
        var self = this;
        self.items().addClass('toolbar-item');
        return self._super();
      }
    });
  });
  define('tinymce/ui/MenuBar', ['tinymce/ui/Toolbar'], function (Toolbar) {
    'use strict';
    return Toolbar.extend({
      Defaults: {
        role: 'menubar',
        containerCls: 'menubar',
        ariaRoot: true,
        defaults: { type: 'menubutton' }
      }
    });
  });
  define('tinymce/ui/MenuButton', [
    'tinymce/ui/Button',
    'tinymce/ui/Factory',
    'tinymce/ui/MenuBar'
  ], function (Button, Factory, MenuBar) {
    'use strict';
    function isChildOf(node, parent) {
      while (node) {
        if (parent === node) {
          return true;
        }
        node = node.parentNode;
      }
      return false;
    }
    var MenuButton = Button.extend({
        init: function (settings) {
          var self = this;
          self._renderOpen = true;
          self._super(settings);
          self.addClass('menubtn');
          if (settings.fixedWidth) {
            self.addClass('fixed-width');
          }
          self.aria('haspopup', true);
          self.hasPopup = true;
        },
        showMenu: function () {
          var self = this, settings = self.settings, menu;
          if (self.menu && self.menu.visible()) {
            return self.hideMenu();
          }
          if (!self.menu) {
            menu = settings.menu || [];
            if (menu.length) {
              menu = {
                type: 'menu',
                items: menu
              };
            } else {
              menu.type = menu.type || 'menu';
            }
            self.menu = Factory.create(menu).parent(self).renderTo();
            self.fire('createmenu');
            self.menu.reflow();
            self.menu.on('cancel', function (e) {
              if (e.control.parent() === self.menu) {
                e.stopPropagation();
                self.focus();
                self.hideMenu();
              }
            });
            self.menu.on('select', function () {
              self.focus();
            });
            self.menu.on('show hide', function (e) {
              if (e.control == self.menu) {
                self.activeMenu(e.type == 'show');
              }
              self.aria('expanded', e.type == 'show');
            }).fire('show');
          }
          self.menu.show();
          self.menu.layoutRect({ w: self.layoutRect().w });
          self.menu.moveRel(self.getEl(), self.isRtl() ? [
            'br-tr',
            'tr-br'
          ] : [
            'bl-tl',
            'tl-bl'
          ]);
        },
        hideMenu: function () {
          var self = this;
          if (self.menu) {
            self.menu.items().each(function (item) {
              if (item.hideMenu) {
                item.hideMenu();
              }
            });
            self.menu.hide();
          }
        },
        activeMenu: function (state) {
          this.toggleClass('active', state);
        },
        renderHtml: function () {
          var self = this, id = self._id, prefix = self.classPrefix;
          var icon = self.settings.icon ? prefix + 'ico ' + prefix + 'i-' + self.settings.icon : '';
          self.aria('role', self.parent() instanceof MenuBar ? 'menuitem' : 'button');
          return '<div id="' + id + '" class="' + self.classes() + '" tabindex="-1" aria-labelledby="' + id + '">' + '<button id="' + id + '-open" role="presentation" type="button" tabindex="-1">' + (icon ? '<i class="' + icon + '"></i>' : '') + '<span>' + (self._text ? (icon ? '\xa0' : '') + self.encode(self._text) : '') + '</span>' + ' <i class="' + prefix + 'caret"></i>' + '</button>' + '</div>';
        },
        postRender: function () {
          var self = this;
          self.on('click', function (e) {
            if (e.control === self && isChildOf(e.target, self.getEl())) {
              self.showMenu();
              if (e.aria) {
                self.menu.items()[0].focus();
              }
            }
          });
          self.on('mouseenter', function (e) {
            var overCtrl = e.control, parent = self.parent(), hasVisibleSiblingMenu;
            if (overCtrl && parent && overCtrl instanceof MenuButton && overCtrl.parent() == parent) {
              parent.items().filter('MenuButton').each(function (ctrl) {
                if (ctrl.hideMenu && ctrl != overCtrl) {
                  if (ctrl.menu && ctrl.menu.visible()) {
                    hasVisibleSiblingMenu = true;
                  }
                  ctrl.hideMenu();
                }
              });
              if (hasVisibleSiblingMenu) {
                overCtrl.focus();
                overCtrl.showMenu();
              }
            }
          });
          return self._super();
        },
        text: function (text) {
          var self = this, i, children;
          if (self._rendered) {
            children = self.getEl('open').getElementsByTagName('span');
            for (i = 0; i < children.length; i++) {
              children[i].innerHTML = (self.settings.icon && text ? '\xa0' : '') + self.encode(text);
            }
          }
          return this._super(text);
        },
        remove: function () {
          this._super();
          if (this.menu) {
            this.menu.remove();
          }
        }
      });
    return MenuButton;
  });
  define('tinymce/ui/ListBox', ['tinymce/ui/MenuButton'], function (MenuButton) {
    'use strict';
    return MenuButton.extend({
      init: function (settings) {
        var self = this, values, i, selected, selectedText, lastItemCtrl;
        self._values = values = settings.values;
        if (values) {
          for (i = 0; i < values.length; i++) {
            selected = values[i].selected || settings.value === values[i].value;
            if (selected) {
              selectedText = selectedText || values[i].text;
              self._value = values[i].value;
              break;
            }
          }
          if (!selected && values.length > 0) {
            selectedText = values[0].text;
            self._value = values[0].value;
          }
          settings.menu = values;
        }
        settings.text = settings.text || selectedText || values[0].text;
        self._super(settings);
        self.addClass('listbox');
        self.on('select', function (e) {
          var ctrl = e.control;
          if (lastItemCtrl) {
            e.lastControl = lastItemCtrl;
          }
          if (settings.multiple) {
            ctrl.active(!ctrl.active());
          } else {
            self.value(e.control.settings.value);
          }
          lastItemCtrl = ctrl;
        });
      },
      value: function (value) {
        var self = this, active, selectedText, menu, i;
        function activateByValue(menu, value) {
          menu.items().each(function (ctrl) {
            active = ctrl.value() === value;
            if (active) {
              selectedText = selectedText || ctrl.text();
            }
            ctrl.active(active);
            if (ctrl.menu) {
              activateByValue(ctrl.menu, value);
            }
          });
        }
        if (typeof value != 'undefined') {
          if (self.menu) {
            activateByValue(self.menu, value);
          } else {
            menu = self.settings.menu;
            for (i = 0; i < menu.length; i++) {
              active = menu[i].value == value;
              if (active) {
                selectedText = selectedText || menu[i].text;
              }
              menu[i].active = active;
            }
          }
          self.text(selectedText || this.settings.text);
        }
        return self._super(value);
      }
    });
  });
  define('tinymce/ui/MenuItem', [
    'tinymce/ui/Widget',
    'tinymce/ui/Factory',
    'tinymce/Env'
  ], function (Widget, Factory, Env) {
    'use strict';
    return Widget.extend({
      Defaults: {
        border: 0,
        role: 'menuitem'
      },
      init: function (settings) {
        var self = this;
        self.hasPopup = true;
        self._super(settings);
        settings = self.settings;
        self.addClass('menu-item');
        if (settings.menu) {
          self.addClass('menu-item-expand');
        }
        if (settings.preview) {
          self.addClass('menu-item-preview');
        }
        if (self._text === '-' || self._text === '|') {
          self.addClass('menu-item-sep');
          self.aria('role', 'separator');
          self._text = '-';
        }
        if (settings.selectable) {
          self.aria('role', 'menuitemcheckbox');
          self.addClass('menu-item-checkbox');
          settings.icon = 'selected';
        }
        if (!settings.preview && !settings.selectable) {
          self.addClass('menu-item-normal');
        }
        self.on('mousedown', function (e) {
          e.preventDefault();
        });
        if (settings.menu) {
          self.aria('haspopup', true);
        }
      },
      hasMenus: function () {
        return !!this.settings.menu;
      },
      showMenu: function () {
        var self = this, settings = self.settings, menu, parent = self.parent();
        parent.items().each(function (ctrl) {
          if (ctrl !== self) {
            ctrl.hideMenu();
          }
        });
        if (settings.menu) {
          menu = self.menu;
          if (!menu) {
            menu = settings.menu;
            if (menu.length) {
              menu = {
                type: 'menu',
                items: menu
              };
            } else {
              menu.type = menu.type || 'menu';
            }
            if (parent.settings.itemDefaults) {
              menu.itemDefaults = parent.settings.itemDefaults;
            }
            menu = self.menu = Factory.create(menu).parent(self).renderTo();
            menu.reflow();
            menu.fire('show');
            menu.on('cancel', function (e) {
              e.stopPropagation();
              self.focus();
              menu.hide();
            });
            menu.on('hide', function (e) {
              if (e.control === menu) {
                self.removeClass('selected');
              }
            });
            menu.submenu = true;
          } else {
            menu.show();
          }
          menu._parentMenu = parent;
          menu.addClass('menu-sub');
          var rel = menu.testMoveRel(self.getEl(), self.isRtl() ? [
              'tl-tr',
              'bl-br',
              'tr-tl',
              'br-bl'
            ] : [
              'tr-tl',
              'br-bl',
              'tl-tr',
              'bl-br'
            ]);
          menu.moveRel(self.getEl(), rel);
          menu.rel = rel;
          rel = 'menu-sub-' + rel;
          menu.removeClass(menu._lastRel);
          menu.addClass(rel);
          menu._lastRel = rel;
          self.addClass('selected');
          self.aria('expanded', true);
        }
      },
      hideMenu: function () {
        var self = this;
        if (self.menu) {
          self.menu.items().each(function (item) {
            if (item.hideMenu) {
              item.hideMenu();
            }
          });
          self.menu.hide();
          self.aria('expanded', false);
        }
        return self;
      },
      renderHtml: function () {
        var self = this, id = self._id, settings = self.settings, prefix = self.classPrefix, text = self.encode(self._text);
        var icon = self.settings.icon, image = '', shortcut = settings.shortcut;
        if (icon) {
          self.parent().addClass('menu-has-icons');
        }
        if (settings.image) {
          icon = 'none';
          image = ' style="background-image: url(\'' + settings.image + '\')"';
        }
        if (shortcut && Env.mac) {
          shortcut = shortcut.replace(/ctrl\+alt\+/i, '&#x2325;&#x2318;');
          shortcut = shortcut.replace(/ctrl\+/i, '&#x2318;');
          shortcut = shortcut.replace(/alt\+/i, '&#x2325;');
          shortcut = shortcut.replace(/shift\+/i, '&#x21E7;');
        }
        icon = prefix + 'ico ' + prefix + 'i-' + (self.settings.icon || 'none');
        return '<div id="' + id + '" class="' + self.classes() + '" tabindex="-1">' + (text !== '-' ? '<i class="' + icon + '"' + image + '></i>&nbsp;' : '') + (text !== '-' ? '<span id="' + id + '-text" class="' + prefix + 'text">' + text + '</span>' : '') + (shortcut ? '<div id="' + id + '-shortcut" class="' + prefix + 'menu-shortcut">' + shortcut + '</div>' : '') + (settings.menu ? '<div class="' + prefix + 'caret"></div>' : '') + '</div>';
      },
      postRender: function () {
        var self = this, settings = self.settings;
        var textStyle = settings.textStyle;
        if (typeof textStyle == 'function') {
          textStyle = textStyle.call(this);
        }
        if (textStyle) {
          var textElm = self.getEl('text');
          if (textElm) {
            textElm.setAttribute('style', textStyle);
          }
        }
        self.on('mouseenter click', function (e) {
          if (e.control === self) {
            if (!settings.menu && e.type === 'click') {
              self.fire('select');
              self.parent().hideAll();
            } else {
              self.showMenu();
              if (e.aria) {
                self.menu.focus(true);
              }
            }
          }
        });
        self._super();
        return self;
      },
      active: function (state) {
        if (typeof state != 'undefined') {
          this.aria('checked', state);
        }
        return this._super(state);
      },
      remove: function () {
        this._super();
        if (this.menu) {
          this.menu.remove();
        }
      }
    });
  });
  define('tinymce/ui/Menu', [
    'tinymce/ui/FloatPanel',
    'tinymce/ui/MenuItem',
    'tinymce/util/Tools'
  ], function (FloatPanel, MenuItem, Tools) {
    'use strict';
    var Menu = FloatPanel.extend({
        Defaults: {
          defaultType: 'menuitem',
          border: 1,
          layout: 'stack',
          role: 'application',
          bodyRole: 'menu',
          ariaRoot: true
        },
        init: function (settings) {
          var self = this;
          settings.autohide = true;
          settings.constrainToViewport = true;
          if (settings.itemDefaults) {
            var items = settings.items, i = items.length;
            while (i--) {
              items[i] = Tools.extend({}, settings.itemDefaults, items[i]);
            }
          }
          self._super(settings);
          self.addClass('menu');
        },
        repaint: function () {
          this.toggleClass('menu-align', true);
          this._super();
          this.getEl().style.height = '';
          this.getEl('body').style.height = '';
          return this;
        },
        cancel: function () {
          var self = this;
          self.hideAll();
          self.fire('select');
        },
        hideAll: function () {
          var self = this;
          this.find('menuitem').exec('hideMenu');
          return self._super();
        },
        preRender: function () {
          var self = this;
          self.items().each(function (ctrl) {
            var settings = ctrl.settings;
            if (settings.icon || settings.selectable) {
              self._hasIcons = true;
              return false;
            }
          });
          return self._super();
        }
      });
    return Menu;
  });
  define('tinymce/ui/Radio', ['tinymce/ui/Checkbox'], function (Checkbox) {
    'use strict';
    return Checkbox.extend({
      Defaults: {
        classes: 'radio',
        role: 'radio'
      }
    });
  });
  define('tinymce/ui/ResizeHandle', [
    'tinymce/ui/Widget',
    'tinymce/ui/DragHelper'
  ], function (Widget, DragHelper) {
    'use strict';
    return Widget.extend({
      renderHtml: function () {
        var self = this, prefix = self.classPrefix;
        self.addClass('resizehandle');
        if (self.settings.direction == 'both') {
          self.addClass('resizehandle-both');
        }
        self.canFocus = false;
        return '<div id="' + self._id + '" class="' + self.classes() + '">' + '<i class="' + prefix + 'ico ' + prefix + 'i-resize"></i>' + '</div>';
      },
      postRender: function () {
        var self = this;
        self._super();
        self.resizeDragHelper = new DragHelper(this._id, {
          start: function () {
            self.fire('ResizeStart');
          },
          drag: function (e) {
            if (self.settings.direction != 'both') {
              e.deltaX = 0;
            }
            self.fire('Resize', e);
          },
          stop: function () {
            self.fire('ResizeEnd');
          }
        });
      },
      remove: function () {
        if (this.resizeDragHelper) {
          this.resizeDragHelper.destroy();
        }
        return this._super();
      }
    });
  });
  define('tinymce/ui/Spacer', ['tinymce/ui/Widget'], function (Widget) {
    'use strict';
    return Widget.extend({
      renderHtml: function () {
        var self = this;
        self.addClass('spacer');
        self.canFocus = false;
        return '<div id="' + self._id + '" class="' + self.classes() + '"></div>';
      }
    });
  });
  define('tinymce/ui/SplitButton', [
    'tinymce/ui/MenuButton',
    'tinymce/ui/DomUtils'
  ], function (MenuButton, DomUtils) {
    return MenuButton.extend({
      Defaults: {
        classes: 'widget btn splitbtn',
        role: 'button'
      },
      repaint: function () {
        var self = this, elm = self.getEl(), rect = self.layoutRect(), mainButtonElm, menuButtonElm;
        self._super();
        mainButtonElm = elm.firstChild;
        menuButtonElm = elm.lastChild;
        DomUtils.css(mainButtonElm, {
          width: rect.w - DomUtils.getSize(menuButtonElm).width,
          height: rect.h - 2
        });
        DomUtils.css(menuButtonElm, { height: rect.h - 2 });
        return self;
      },
      activeMenu: function (state) {
        var self = this;
        DomUtils.toggleClass(self.getEl().lastChild, self.classPrefix + 'active', state);
      },
      renderHtml: function () {
        var self = this, id = self._id, prefix = self.classPrefix;
        var icon = self.settings.icon ? prefix + 'ico ' + prefix + 'i-' + self.settings.icon : '';
        return '<div id="' + id + '" class="' + self.classes() + '" role="button" tabindex="-1">' + '<button type="button" hidefocus tabindex="-1">' + (icon ? '<i class="' + icon + '"></i>' : '') + (self._text ? (icon ? ' ' : '') + self._text : '') + '</button>' + '<button type="button" class="' + prefix + 'open" hidefocus tabindex="-1">' + (self._menuBtnText ? (icon ? '\xa0' : '') + self._menuBtnText : '') + ' <i class="' + prefix + 'caret"></i>' + '</button>' + '</div>';
      },
      postRender: function () {
        var self = this, onClickHandler = self.settings.onclick;
        self.on('click', function (e) {
          var node = e.target;
          if (e.control == this) {
            while (node) {
              if (e.aria && e.aria.key != 'down' || node.nodeName == 'BUTTON' && node.className.indexOf('open') == -1) {
                e.stopImmediatePropagation();
                onClickHandler.call(this, e);
                return;
              }
              node = node.parentNode;
            }
          }
        });
        delete self.settings.onclick;
        return self._super();
      }
    });
  });
  define('tinymce/ui/StackLayout', ['tinymce/ui/FlowLayout'], function (FlowLayout) {
    'use strict';
    return FlowLayout.extend({
      Defaults: {
        containerClass: 'stack-layout',
        controlClass: 'stack-layout-item',
        endClass: 'break'
      }
    });
  });
  define('tinymce/ui/TabPanel', [
    'tinymce/ui/Panel',
    'tinymce/ui/DomUtils'
  ], function (Panel, DomUtils) {
    'use strict';
    return Panel.extend({
      lastIdx: 0,
      Defaults: {
        layout: 'absolute',
        defaults: { type: 'panel' }
      },
      activateTab: function (idx) {
        var activeTabElm;
        if (this.activeTabId) {
          activeTabElm = this.getEl(this.activeTabId);
          DomUtils.removeClass(activeTabElm, this.classPrefix + 'active');
          activeTabElm.setAttribute('aria-selected', 'false');
        }
        this.activeTabId = 't' + idx;
        activeTabElm = this.getEl('t' + idx);
        activeTabElm.setAttribute('aria-selected', 'true');
        DomUtils.addClass(activeTabElm, this.classPrefix + 'active');
        if (idx != this.lastIdx) {
          this.items()[this.lastIdx].hide();
          this.lastIdx = idx;
        }
        this.items()[idx].show().fire('showtab');
        this.reflow();
      },
      renderHtml: function () {
        var self = this, layout = self._layout, tabsHtml = '', prefix = self.classPrefix;
        self.preRender();
        layout.preRender(self);
        self.items().each(function (ctrl, i) {
          var id = self._id + '-t' + i;
          ctrl.aria('role', 'tabpanel');
          ctrl.aria('labelledby', id);
          tabsHtml += '<div id="' + id + '" class="' + prefix + 'tab" ' + 'unselectable="on" role="tab" aria-controls="' + ctrl._id + '" aria-selected="false" tabIndex="-1">' + self.encode(ctrl.settings.title) + '</div>';
        });
        return '<div id="' + self._id + '" class="' + self.classes() + '" hideFocus="1" tabIndex="-1">' + '<div id="' + self._id + '-head" class="' + prefix + 'tabs" role="tablist">' + tabsHtml + '</div>' + '<div id="' + self._id + '-body" class="' + self.classes('body') + '">' + layout.renderHtml(self) + '</div>' + '</div>';
      },
      postRender: function () {
        var self = this;
        self._super();
        self.settings.activeTab = self.settings.activeTab || 0;
        self.activateTab(self.settings.activeTab);
        this.on('click', function (e) {
          var targetParent = e.target.parentNode;
          if (e.target.parentNode.id == self._id + '-head') {
            var i = targetParent.childNodes.length;
            while (i--) {
              if (targetParent.childNodes[i] == e.target) {
                self.activateTab(i);
              }
            }
          }
        });
      },
      initLayoutRect: function () {
        var self = this, rect, minW, minH;
        minW = DomUtils.getSize(self.getEl('head')).width;
        minW = minW < 0 ? 0 : minW;
        minH = 0;
        self.items().each(function (item, i) {
          minW = Math.max(minW, item.layoutRect().minW);
          minH = Math.max(minH, item.layoutRect().minH);
          if (self.settings.activeTab != i) {
            item.hide();
          }
        });
        self.items().each(function (ctrl) {
          ctrl.settings.x = 0;
          ctrl.settings.y = 0;
          ctrl.settings.w = minW;
          ctrl.settings.h = minH;
          ctrl.layoutRect({
            x: 0,
            y: 0,
            w: minW,
            h: minH
          });
        });
        var headH = DomUtils.getSize(self.getEl('head')).height;
        self.settings.minWidth = minW;
        self.settings.minHeight = minH + headH;
        rect = self._super();
        rect.deltaH += headH;
        rect.innerH = rect.h - rect.deltaH;
        return rect;
      }
    });
  });
  define('tinymce/ui/TextBox', [
    'tinymce/ui/Widget',
    'tinymce/ui/DomUtils'
  ], function (Widget, DomUtils) {
    'use strict';
    return Widget.extend({
      init: function (settings) {
        var self = this;
        self._super(settings);
        self._value = settings.value || '';
        self.addClass('textbox');
        if (settings.multiline) {
          self.addClass('multiline');
        } else {
          self.on('keydown', function (e) {
            if (e.keyCode == 13) {
              self.parents().reverse().each(function (ctrl) {
                e.preventDefault();
                if (ctrl.hasEventListeners('submit') && ctrl.toJSON) {
                  ctrl.fire('submit', { data: ctrl.toJSON() });
                  return false;
                }
              });
            }
          });
        }
      },
      disabled: function (state) {
        var self = this;
        if (self._rendered && typeof state != 'undefined') {
          self.getEl().disabled = state;
        }
        return self._super(state);
      },
      value: function (value) {
        var self = this;
        if (typeof value != 'undefined') {
          self._value = value;
          if (self._rendered) {
            self.getEl().value = value;
          }
          return self;
        }
        if (self._rendered) {
          return self.getEl().value;
        }
        return self._value;
      },
      repaint: function () {
        var self = this, style, rect, borderBox, borderW = 0, borderH = 0, lastRepaintRect;
        style = self.getEl().style;
        rect = self._layoutRect;
        lastRepaintRect = self._lastRepaintRect || {};
        var doc = document;
        if (!self.settings.multiline && doc.all && (!doc.documentMode || doc.documentMode <= 8)) {
          style.lineHeight = rect.h - borderH + 'px';
        }
        borderBox = self._borderBox;
        borderW = borderBox.left + borderBox.right + 8;
        borderH = borderBox.top + borderBox.bottom + (self.settings.multiline ? 8 : 0);
        if (rect.x !== lastRepaintRect.x) {
          style.left = rect.x + 'px';
          lastRepaintRect.x = rect.x;
        }
        if (rect.y !== lastRepaintRect.y) {
          style.top = rect.y + 'px';
          lastRepaintRect.y = rect.y;
        }
        if (rect.w !== lastRepaintRect.w) {
          style.width = rect.w - borderW + 'px';
          lastRepaintRect.w = rect.w;
        }
        if (rect.h !== lastRepaintRect.h) {
          style.height = rect.h - borderH + 'px';
          lastRepaintRect.h = rect.h;
        }
        self._lastRepaintRect = lastRepaintRect;
        self.fire('repaint', {}, false);
        return self;
      },
      renderHtml: function () {
        var self = this, id = self._id, settings = self.settings, value = self.encode(self._value, false), extraAttrs = '';
        if ('spellcheck' in settings) {
          extraAttrs += ' spellcheck="' + settings.spellcheck + '"';
        }
        if (settings.maxLength) {
          extraAttrs += ' maxlength="' + settings.maxLength + '"';
        }
        if (settings.size) {
          extraAttrs += ' size="' + settings.size + '"';
        }
        if (settings.subtype) {
          extraAttrs += ' type="' + settings.subtype + '"';
        }
        if (self.disabled()) {
          extraAttrs += ' disabled="disabled"';
        }
        if (settings.multiline) {
          return '<textarea id="' + id + '" class="' + self.classes() + '" ' + (settings.rows ? ' rows="' + settings.rows + '"' : '') + ' hidefocus="true"' + extraAttrs + '>' + value + '</textarea>';
        }
        return '<input id="' + id + '" class="' + self.classes() + '" value="' + value + '" hidefocus="true"' + extraAttrs + '>';
      },
      postRender: function () {
        var self = this;
        DomUtils.on(self.getEl(), 'change', function (e) {
          self.fire('change', e);
        });
        return self._super();
      },
      remove: function () {
        DomUtils.off(this.getEl());
        this._super();
      }
    });
  });
  define('tinymce/ui/Throbber', ['tinymce/ui/DomUtils'], function (DomUtils) {
    'use strict';
    return function (elm) {
      var self = this, state;
      self.show = function (time) {
        self.hide();
        state = true;
        window.setTimeout(function () {
          if (state) {
            elm.appendChild(DomUtils.createFragment('<div class="mce-throbber"></div>'));
          }
        }, time || 0);
        return self;
      };
      self.hide = function () {
        var child = elm.lastChild;
        if (child && child.className.indexOf('throbber') != -1) {
          child.parentNode.removeChild(child);
        }
        state = false;
        return self;
      };
    };
  });
  expose([
    'tinymce/dom/EventUtils',
    'tinymce/dom/Sizzle',
    'tinymce/dom/DomQuery',
    'tinymce/html/Styles',
    'tinymce/dom/TreeWalker',
    'tinymce/util/Tools',
    'tinymce/dom/Range',
    'tinymce/html/Entities',
    'tinymce/Env',
    'tinymce/dom/StyleSheetLoader',
    'tinymce/dom/DOMUtils',
    'tinymce/dom/ScriptLoader',
    'tinymce/AddOnManager',
    'tinymce/html/Node',
    'tinymce/html/Schema',
    'tinymce/html/SaxParser',
    'tinymce/html/DomParser',
    'tinymce/html/Writer',
    'tinymce/html/Serializer',
    'tinymce/dom/Serializer',
    'tinymce/dom/TridentSelection',
    'tinymce/util/VK',
    'tinymce/dom/ControlSelection',
    'tinymce/dom/RangeUtils',
    'tinymce/dom/Selection',
    'tinymce/Formatter',
    'tinymce/UndoManager',
    'tinymce/EnterKey',
    'tinymce/ForceBlocks',
    'tinymce/EditorCommands',
    'tinymce/util/URI',
    'tinymce/util/Class',
    'tinymce/ui/Selector',
    'tinymce/ui/Collection',
    'tinymce/ui/DomUtils',
    'tinymce/ui/Control',
    'tinymce/ui/Factory',
    'tinymce/ui/KeyboardNavigation',
    'tinymce/ui/Container',
    'tinymce/ui/DragHelper',
    'tinymce/ui/Scrollable',
    'tinymce/ui/Panel',
    'tinymce/ui/Movable',
    'tinymce/ui/Resizable',
    'tinymce/ui/FloatPanel',
    'tinymce/ui/Window',
    'tinymce/ui/MessageBox',
    'tinymce/WindowManager',
    'tinymce/util/Quirks',
    'tinymce/util/Observable',
    'tinymce/Shortcuts',
    'tinymce/Editor',
    'tinymce/util/I18n',
    'tinymce/FocusManager',
    'tinymce/EditorManager',
    'tinymce/LegacyInput',
    'tinymce/util/XHR',
    'tinymce/util/JSON',
    'tinymce/util/JSONRequest',
    'tinymce/util/JSONP',
    'tinymce/util/LocalStorage',
    'tinymce/Compat',
    'tinymce/ui/Layout',
    'tinymce/ui/AbsoluteLayout',
    'tinymce/ui/Tooltip',
    'tinymce/ui/Widget',
    'tinymce/ui/Button',
    'tinymce/ui/ButtonGroup',
    'tinymce/ui/Checkbox',
    'tinymce/ui/PanelButton',
    'tinymce/ui/ColorButton',
    'tinymce/ui/ComboBox',
    'tinymce/ui/Path',
    'tinymce/ui/ElementPath',
    'tinymce/ui/FormItem',
    'tinymce/ui/Form',
    'tinymce/ui/FieldSet',
    'tinymce/ui/FilePicker',
    'tinymce/ui/FitLayout',
    'tinymce/ui/FlexLayout',
    'tinymce/ui/FlowLayout',
    'tinymce/ui/FormatControls',
    'tinymce/ui/GridLayout',
    'tinymce/ui/Iframe',
    'tinymce/ui/Label',
    'tinymce/ui/Toolbar',
    'tinymce/ui/MenuBar',
    'tinymce/ui/MenuButton',
    'tinymce/ui/ListBox',
    'tinymce/ui/MenuItem',
    'tinymce/ui/Menu',
    'tinymce/ui/Radio',
    'tinymce/ui/ResizeHandle',
    'tinymce/ui/Spacer',
    'tinymce/ui/SplitButton',
    'tinymce/ui/StackLayout',
    'tinymce/ui/TabPanel',
    'tinymce/ui/TextBox',
    'tinymce/ui/Throbber'
  ]);
}(this));