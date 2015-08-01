/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
// @version 0.7.7
window.WebComponents = window.WebComponents || {};

(function(scope) {
  var flags = scope.flags || {};
  var file = "webcomponents-lite.js";
  var script = document.querySelector('script[src*="' + file + '"]');
  if (!flags.noOpts) {
    location.search.slice(1).split("&").forEach(function(option) {
      var parts = option.split("=");
      var match;
      if (parts[0] && (match = parts[0].match(/wc-(.+)/))) {
        flags[match[1]] = parts[1] || true;
      }
    });
    if (script) {
      for (var i = 0, a; a = script.attributes[i]; i++) {
        if (a.name !== "src") {
          flags[a.name] = a.value || true;
        }
      }
    }
    if (flags.log) {
      var parts = flags.log.split(",");
      flags.log = {};
      parts.forEach(function(f) {
        flags.log[f] = true;
      });
    } else {
      flags.log = {};
    }
  }
  flags.shadow = flags.shadow || flags.shadowdom || flags.polyfill;
  if (flags.shadow === "native") {
    flags.shadow = false;
  } else {
    flags.shadow = flags.shadow || !HTMLElement.prototype.createShadowRoot;
  }
  if (flags.register) {
    window.CustomElements = window.CustomElements || {
      flags: {}
    };
    window.CustomElements.flags.register = flags.register;
  }
  scope.flags = flags;
})(window.WebComponents);

(function(scope) {
  "use strict";
  var hasWorkingUrl = false;
  if (!scope.forceJURL) {
    try {
      var u = new URL("b", "http://a");
      u.pathname = "c%20d";
      hasWorkingUrl = u.href === "http://a/c%20d";
    } catch (e) {}
  }
  if (hasWorkingUrl) return;
  var relative = Object.create(null);
  relative["ftp"] = 21;
  relative["file"] = 0;
  relative["gopher"] = 70;
  relative["http"] = 80;
  relative["https"] = 443;
  relative["ws"] = 80;
  relative["wss"] = 443;
  var relativePathDotMapping = Object.create(null);
  relativePathDotMapping["%2e"] = ".";
  relativePathDotMapping[".%2e"] = "..";
  relativePathDotMapping["%2e."] = "..";
  relativePathDotMapping["%2e%2e"] = "..";
  function isRelativeScheme(scheme) {
    return relative[scheme] !== undefined;
  }
  function invalid() {
    clear.call(this);
    this._isInvalid = true;
  }
  function IDNAToASCII(h) {
    if ("" == h) {
      invalid.call(this);
    }
    return h.toLowerCase();
  }
  function percentEscape(c) {
    var unicode = c.charCodeAt(0);
    if (unicode > 32 && unicode < 127 && [ 34, 35, 60, 62, 63, 96 ].indexOf(unicode) == -1) {
      return c;
    }
    return encodeURIComponent(c);
  }
  function percentEscapeQuery(c) {
    var unicode = c.charCodeAt(0);
    if (unicode > 32 && unicode < 127 && [ 34, 35, 60, 62, 96 ].indexOf(unicode) == -1) {
      return c;
    }
    return encodeURIComponent(c);
  }
  var EOF = undefined, ALPHA = /[a-zA-Z]/, ALPHANUMERIC = /[a-zA-Z0-9\+\-\.]/;
  function parse(input, stateOverride, base) {
    function err(message) {
      errors.push(message);
    }
    var state = stateOverride || "scheme start", cursor = 0, buffer = "", seenAt = false, seenBracket = false, errors = [];
    loop: while ((input[cursor - 1] != EOF || cursor == 0) && !this._isInvalid) {
      var c = input[cursor];
      switch (state) {
       case "scheme start":
        if (c && ALPHA.test(c)) {
          buffer += c.toLowerCase();
          state = "scheme";
        } else if (!stateOverride) {
          buffer = "";
          state = "no scheme";
          continue;
        } else {
          err("Invalid scheme.");
          break loop;
        }
        break;

       case "scheme":
        if (c && ALPHANUMERIC.test(c)) {
          buffer += c.toLowerCase();
        } else if (":" == c) {
          this._scheme = buffer;
          buffer = "";
          if (stateOverride) {
            break loop;
          }
          if (isRelativeScheme(this._scheme)) {
            this._isRelative = true;
          }
          if ("file" == this._scheme) {
            state = "relative";
          } else if (this._isRelative && base && base._scheme == this._scheme) {
            state = "relative or authority";
          } else if (this._isRelative) {
            state = "authority first slash";
          } else {
            state = "scheme data";
          }
        } else if (!stateOverride) {
          buffer = "";
          cursor = 0;
          state = "no scheme";
          continue;
        } else if (EOF == c) {
          break loop;
        } else {
          err("Code point not allowed in scheme: " + c);
          break loop;
        }
        break;

       case "scheme data":
        if ("?" == c) {
          this._query = "?";
          state = "query";
        } else if ("#" == c) {
          this._fragment = "#";
          state = "fragment";
        } else {
          if (EOF != c && "	" != c && "\n" != c && "\r" != c) {
            this._schemeData += percentEscape(c);
          }
        }
        break;

       case "no scheme":
        if (!base || !isRelativeScheme(base._scheme)) {
          err("Missing scheme.");
          invalid.call(this);
        } else {
          state = "relative";
          continue;
        }
        break;

       case "relative or authority":
        if ("/" == c && "/" == input[cursor + 1]) {
          state = "authority ignore slashes";
        } else {
          err("Expected /, got: " + c);
          state = "relative";
          continue;
        }
        break;

       case "relative":
        this._isRelative = true;
        if ("file" != this._scheme) this._scheme = base._scheme;
        if (EOF == c) {
          this._host = base._host;
          this._port = base._port;
          this._path = base._path.slice();
          this._query = base._query;
          this._username = base._username;
          this._password = base._password;
          break loop;
        } else if ("/" == c || "\\" == c) {
          if ("\\" == c) err("\\ is an invalid code point.");
          state = "relative slash";
        } else if ("?" == c) {
          this._host = base._host;
          this._port = base._port;
          this._path = base._path.slice();
          this._query = "?";
          this._username = base._username;
          this._password = base._password;
          state = "query";
        } else if ("#" == c) {
          this._host = base._host;
          this._port = base._port;
          this._path = base._path.slice();
          this._query = base._query;
          this._fragment = "#";
          this._username = base._username;
          this._password = base._password;
          state = "fragment";
        } else {
          var nextC = input[cursor + 1];
          var nextNextC = input[cursor + 2];
          if ("file" != this._scheme || !ALPHA.test(c) || nextC != ":" && nextC != "|" || EOF != nextNextC && "/" != nextNextC && "\\" != nextNextC && "?" != nextNextC && "#" != nextNextC) {
            this._host = base._host;
            this._port = base._port;
            this._username = base._username;
            this._password = base._password;
            this._path = base._path.slice();
            this._path.pop();
          }
          state = "relative path";
          continue;
        }
        break;

       case "relative slash":
        if ("/" == c || "\\" == c) {
          if ("\\" == c) {
            err("\\ is an invalid code point.");
          }
          if ("file" == this._scheme) {
            state = "file host";
          } else {
            state = "authority ignore slashes";
          }
        } else {
          if ("file" != this._scheme) {
            this._host = base._host;
            this._port = base._port;
            this._username = base._username;
            this._password = base._password;
          }
          state = "relative path";
          continue;
        }
        break;

       case "authority first slash":
        if ("/" == c) {
          state = "authority second slash";
        } else {
          err("Expected '/', got: " + c);
          state = "authority ignore slashes";
          continue;
        }
        break;

       case "authority second slash":
        state = "authority ignore slashes";
        if ("/" != c) {
          err("Expected '/', got: " + c);
          continue;
        }
        break;

       case "authority ignore slashes":
        if ("/" != c && "\\" != c) {
          state = "authority";
          continue;
        } else {
          err("Expected authority, got: " + c);
        }
        break;

       case "authority":
        if ("@" == c) {
          if (seenAt) {
            err("@ already seen.");
            buffer += "%40";
          }
          seenAt = true;
          for (var i = 0; i < buffer.length; i++) {
            var cp = buffer[i];
            if ("	" == cp || "\n" == cp || "\r" == cp) {
              err("Invalid whitespace in authority.");
              continue;
            }
            if (":" == cp && null === this._password) {
              this._password = "";
              continue;
            }
            var tempC = percentEscape(cp);
            null !== this._password ? this._password += tempC : this._username += tempC;
          }
          buffer = "";
        } else if (EOF == c || "/" == c || "\\" == c || "?" == c || "#" == c) {
          cursor -= buffer.length;
          buffer = "";
          state = "host";
          continue;
        } else {
          buffer += c;
        }
        break;

       case "file host":
        if (EOF == c || "/" == c || "\\" == c || "?" == c || "#" == c) {
          if (buffer.length == 2 && ALPHA.test(buffer[0]) && (buffer[1] == ":" || buffer[1] == "|")) {
            state = "relative path";
          } else if (buffer.length == 0) {
            state = "relative path start";
          } else {
            this._host = IDNAToASCII.call(this, buffer);
            buffer = "";
            state = "relative path start";
          }
          continue;
        } else if ("	" == c || "\n" == c || "\r" == c) {
          err("Invalid whitespace in file host.");
        } else {
          buffer += c;
        }
        break;

       case "host":
       case "hostname":
        if (":" == c && !seenBracket) {
          this._host = IDNAToASCII.call(this, buffer);
          buffer = "";
          state = "port";
          if ("hostname" == stateOverride) {
            break loop;
          }
        } else if (EOF == c || "/" == c || "\\" == c || "?" == c || "#" == c) {
          this._host = IDNAToASCII.call(this, buffer);
          buffer = "";
          state = "relative path start";
          if (stateOverride) {
            break loop;
          }
          continue;
        } else if ("	" != c && "\n" != c && "\r" != c) {
          if ("[" == c) {
            seenBracket = true;
          } else if ("]" == c) {
            seenBracket = false;
          }
          buffer += c;
        } else {
          err("Invalid code point in host/hostname: " + c);
        }
        break;

       case "port":
        if (/[0-9]/.test(c)) {
          buffer += c;
        } else if (EOF == c || "/" == c || "\\" == c || "?" == c || "#" == c || stateOverride) {
          if ("" != buffer) {
            var temp = parseInt(buffer, 10);
            if (temp != relative[this._scheme]) {
              this._port = temp + "";
            }
            buffer = "";
          }
          if (stateOverride) {
            break loop;
          }
          state = "relative path start";
          continue;
        } else if ("	" == c || "\n" == c || "\r" == c) {
          err("Invalid code point in port: " + c);
        } else {
          invalid.call(this);
        }
        break;

       case "relative path start":
        if ("\\" == c) err("'\\' not allowed in path.");
        state = "relative path";
        if ("/" != c && "\\" != c) {
          continue;
        }
        break;

       case "relative path":
        if (EOF == c || "/" == c || "\\" == c || !stateOverride && ("?" == c || "#" == c)) {
          if ("\\" == c) {
            err("\\ not allowed in relative path.");
          }
          var tmp;
          if (tmp = relativePathDotMapping[buffer.toLowerCase()]) {
            buffer = tmp;
          }
          if (".." == buffer) {
            this._path.pop();
            if ("/" != c && "\\" != c) {
              this._path.push("");
            }
          } else if ("." == buffer && "/" != c && "\\" != c) {
            this._path.push("");
          } else if ("." != buffer) {
            if ("file" == this._scheme && this._path.length == 0 && buffer.length == 2 && ALPHA.test(buffer[0]) && buffer[1] == "|") {
              buffer = buffer[0] + ":";
            }
            this._path.push(buffer);
          }
          buffer = "";
          if ("?" == c) {
            this._query = "?";
            state = "query";
          } else if ("#" == c) {
            this._fragment = "#";
            state = "fragment";
          }
        } else if ("	" != c && "\n" != c && "\r" != c) {
          buffer += percentEscape(c);
        }
        break;

       case "query":
        if (!stateOverride && "#" == c) {
          this._fragment = "#";
          state = "fragment";
        } else if (EOF != c && "	" != c && "\n" != c && "\r" != c) {
          this._query += percentEscapeQuery(c);
        }
        break;

       case "fragment":
        if (EOF != c && "	" != c && "\n" != c && "\r" != c) {
          this._fragment += c;
        }
        break;
      }
      cursor++;
    }
  }
  function clear() {
    this._scheme = "";
    this._schemeData = "";
    this._username = "";
    this._password = null;
    this._host = "";
    this._port = "";
    this._path = [];
    this._query = "";
    this._fragment = "";
    this._isInvalid = false;
    this._isRelative = false;
  }
  function jURL(url, base) {
    if (base !== undefined && !(base instanceof jURL)) base = new jURL(String(base));
    this._url = url;
    clear.call(this);
    var input = url.replace(/^[ \t\r\n\f]+|[ \t\r\n\f]+$/g, "");
    parse.call(this, input, null, base);
  }
  jURL.prototype = {
    toString: function() {
      return this.href;
    },
    get href() {
      if (this._isInvalid) return this._url;
      var authority = "";
      if ("" != this._username || null != this._password) {
        authority = this._username + (null != this._password ? ":" + this._password : "") + "@";
      }
      return this.protocol + (this._isRelative ? "//" + authority + this.host : "") + this.pathname + this._query + this._fragment;
    },
    set href(href) {
      clear.call(this);
      parse.call(this, href);
    },
    get protocol() {
      return this._scheme + ":";
    },
    set protocol(protocol) {
      if (this._isInvalid) return;
      parse.call(this, protocol + ":", "scheme start");
    },
    get host() {
      return this._isInvalid ? "" : this._port ? this._host + ":" + this._port : this._host;
    },
    set host(host) {
      if (this._isInvalid || !this._isRelative) return;
      parse.call(this, host, "host");
    },
    get hostname() {
      return this._host;
    },
    set hostname(hostname) {
      if (this._isInvalid || !this._isRelative) return;
      parse.call(this, hostname, "hostname");
    },
    get port() {
      return this._port;
    },
    set port(port) {
      if (this._isInvalid || !this._isRelative) return;
      parse.call(this, port, "port");
    },
    get pathname() {
      return this._isInvalid ? "" : this._isRelative ? "/" + this._path.join("/") : this._schemeData;
    },
    set pathname(pathname) {
      if (this._isInvalid || !this._isRelative) return;
      this._path = [];
      parse.call(this, pathname, "relative path start");
    },
    get search() {
      return this._isInvalid || !this._query || "?" == this._query ? "" : this._query;
    },
    set search(search) {
      if (this._isInvalid || !this._isRelative) return;
      this._query = "?";
      if ("?" == search[0]) search = search.slice(1);
      parse.call(this, search, "query");
    },
    get hash() {
      return this._isInvalid || !this._fragment || "#" == this._fragment ? "" : this._fragment;
    },
    set hash(hash) {
      if (this._isInvalid) return;
      this._fragment = "#";
      if ("#" == hash[0]) hash = hash.slice(1);
      parse.call(this, hash, "fragment");
    },
    get origin() {
      var host;
      if (this._isInvalid || !this._scheme) {
        return "";
      }
      switch (this._scheme) {
       case "data":
       case "file":
       case "javascript":
       case "mailto":
        return "null";
      }
      host = this.host;
      if (!host) {
        return "";
      }
      return this._scheme + "://" + host;
    }
  };
  var OriginalURL = scope.URL;
  if (OriginalURL) {
    jURL.createObjectURL = function(blob) {
      return OriginalURL.createObjectURL.apply(OriginalURL, arguments);
    };
    jURL.revokeObjectURL = function(url) {
      OriginalURL.revokeObjectURL(url);
    };
  }
  scope.URL = jURL;
})(this);

if (typeof WeakMap === "undefined") {
  (function() {
    var defineProperty = Object.defineProperty;
    var counter = Date.now() % 1e9;
    var WeakMap = function() {
      this.name = "__st" + (Math.random() * 1e9 >>> 0) + (counter++ + "__");
    };
    WeakMap.prototype = {
      set: function(key, value) {
        var entry = key[this.name];
        if (entry && entry[0] === key) entry[1] = value; else defineProperty(key, this.name, {
          value: [ key, value ],
          writable: true
        });
        return this;
      },
      get: function(key) {
        var entry;
        return (entry = key[this.name]) && entry[0] === key ? entry[1] : undefined;
      },
      "delete": function(key) {
        var entry = key[this.name];
        if (!entry || entry[0] !== key) return false;
        entry[0] = entry[1] = undefined;
        return true;
      },
      has: function(key) {
        var entry = key[this.name];
        if (!entry) return false;
        return entry[0] === key;
      }
    };
    window.WeakMap = WeakMap;
  })();
}

(function(global) {
  var registrationsTable = new WeakMap();
  var setImmediate;
  if (/Trident|Edge/.test(navigator.userAgent)) {
    setImmediate = setTimeout;
  } else if (window.setImmediate) {
    setImmediate = window.setImmediate;
  } else {
    var setImmediateQueue = [];
    var sentinel = String(Math.random());
    window.addEventListener("message", function(e) {
      if (e.data === sentinel) {
        var queue = setImmediateQueue;
        setImmediateQueue = [];
        queue.forEach(function(func) {
          func();
        });
      }
    });
    setImmediate = function(func) {
      setImmediateQueue.push(func);
      window.postMessage(sentinel, "*");
    };
  }
  var isScheduled = false;
  var scheduledObservers = [];
  function scheduleCallback(observer) {
    scheduledObservers.push(observer);
    if (!isScheduled) {
      isScheduled = true;
      setImmediate(dispatchCallbacks);
    }
  }
  function wrapIfNeeded(node) {
    return window.ShadowDOMPolyfill && window.ShadowDOMPolyfill.wrapIfNeeded(node) || node;
  }
  function dispatchCallbacks() {
    isScheduled = false;
    var observers = scheduledObservers;
    scheduledObservers = [];
    observers.sort(function(o1, o2) {
      return o1.uid_ - o2.uid_;
    });
    var anyNonEmpty = false;
    observers.forEach(function(observer) {
      var queue = observer.takeRecords();
      removeTransientObserversFor(observer);
      if (queue.length) {
        observer.callback_(queue, observer);
        anyNonEmpty = true;
      }
    });
    if (anyNonEmpty) dispatchCallbacks();
  }
  function removeTransientObserversFor(observer) {
    observer.nodes_.forEach(function(node) {
      var registrations = registrationsTable.get(node);
      if (!registrations) return;
      registrations.forEach(function(registration) {
        if (registration.observer === observer) registration.removeTransientObservers();
      });
    });
  }
  function forEachAncestorAndObserverEnqueueRecord(target, callback) {
    for (var node = target; node; node = node.parentNode) {
      var registrations = registrationsTable.get(node);
      if (registrations) {
        for (var j = 0; j < registrations.length; j++) {
          var registration = registrations[j];
          var options = registration.options;
          if (node !== target && !options.subtree) continue;
          var record = callback(options);
          if (record) registration.enqueue(record);
        }
      }
    }
  }
  var uidCounter = 0;
  function JsMutationObserver(callback) {
    this.callback_ = callback;
    this.nodes_ = [];
    this.records_ = [];
    this.uid_ = ++uidCounter;
  }
  JsMutationObserver.prototype = {
    observe: function(target, options) {
      target = wrapIfNeeded(target);
      if (!options.childList && !options.attributes && !options.characterData || options.attributeOldValue && !options.attributes || options.attributeFilter && options.attributeFilter.length && !options.attributes || options.characterDataOldValue && !options.characterData) {
        throw new SyntaxError();
      }
      var registrations = registrationsTable.get(target);
      if (!registrations) registrationsTable.set(target, registrations = []);
      var registration;
      for (var i = 0; i < registrations.length; i++) {
        if (registrations[i].observer === this) {
          registration = registrations[i];
          registration.removeListeners();
          registration.options = options;
          break;
        }
      }
      if (!registration) {
        registration = new Registration(this, target, options);
        registrations.push(registration);
        this.nodes_.push(target);
      }
      registration.addListeners();
    },
    disconnect: function() {
      this.nodes_.forEach(function(node) {
        var registrations = registrationsTable.get(node);
        for (var i = 0; i < registrations.length; i++) {
          var registration = registrations[i];
          if (registration.observer === this) {
            registration.removeListeners();
            registrations.splice(i, 1);
            break;
          }
        }
      }, this);
      this.records_ = [];
    },
    takeRecords: function() {
      var copyOfRecords = this.records_;
      this.records_ = [];
      return copyOfRecords;
    }
  };
  function MutationRecord(type, target) {
    this.type = type;
    this.target = target;
    this.addedNodes = [];
    this.removedNodes = [];
    this.previousSibling = null;
    this.nextSibling = null;
    this.attributeName = null;
    this.attributeNamespace = null;
    this.oldValue = null;
  }
  function copyMutationRecord(original) {
    var record = new MutationRecord(original.type, original.target);
    record.addedNodes = original.addedNodes.slice();
    record.removedNodes = original.removedNodes.slice();
    record.previousSibling = original.previousSibling;
    record.nextSibling = original.nextSibling;
    record.attributeName = original.attributeName;
    record.attributeNamespace = original.attributeNamespace;
    record.oldValue = original.oldValue;
    return record;
  }
  var currentRecord, recordWithOldValue;
  function getRecord(type, target) {
    return currentRecord = new MutationRecord(type, target);
  }
  function getRecordWithOldValue(oldValue) {
    if (recordWithOldValue) return recordWithOldValue;
    recordWithOldValue = copyMutationRecord(currentRecord);
    recordWithOldValue.oldValue = oldValue;
    return recordWithOldValue;
  }
  function clearRecords() {
    currentRecord = recordWithOldValue = undefined;
  }
  function recordRepresentsCurrentMutation(record) {
    return record === recordWithOldValue || record === currentRecord;
  }
  function selectRecord(lastRecord, newRecord) {
    if (lastRecord === newRecord) return lastRecord;
    if (recordWithOldValue && recordRepresentsCurrentMutation(lastRecord)) return recordWithOldValue;
    return null;
  }
  function Registration(observer, target, options) {
    this.observer = observer;
    this.target = target;
    this.options = options;
    this.transientObservedNodes = [];
  }
  Registration.prototype = {
    enqueue: function(record) {
      var records = this.observer.records_;
      var length = records.length;
      if (records.length > 0) {
        var lastRecord = records[length - 1];
        var recordToReplaceLast = selectRecord(lastRecord, record);
        if (recordToReplaceLast) {
          records[length - 1] = recordToReplaceLast;
          return;
        }
      } else {
        scheduleCallback(this.observer);
      }
      records[length] = record;
    },
    addListeners: function() {
      this.addListeners_(this.target);
    },
    addListeners_: function(node) {
      var options = this.options;
      if (options.attributes) node.addEventListener("DOMAttrModified", this, true);
      if (options.characterData) node.addEventListener("DOMCharacterDataModified", this, true);
      if (options.childList) node.addEventListener("DOMNodeInserted", this, true);
      if (options.childList || options.subtree) node.addEventListener("DOMNodeRemoved", this, true);
    },
    removeListeners: function() {
      this.removeListeners_(this.target);
    },
    removeListeners_: function(node) {
      var options = this.options;
      if (options.attributes) node.removeEventListener("DOMAttrModified", this, true);
      if (options.characterData) node.removeEventListener("DOMCharacterDataModified", this, true);
      if (options.childList) node.removeEventListener("DOMNodeInserted", this, true);
      if (options.childList || options.subtree) node.removeEventListener("DOMNodeRemoved", this, true);
    },
    addTransientObserver: function(node) {
      if (node === this.target) return;
      this.addListeners_(node);
      this.transientObservedNodes.push(node);
      var registrations = registrationsTable.get(node);
      if (!registrations) registrationsTable.set(node, registrations = []);
      registrations.push(this);
    },
    removeTransientObservers: function() {
      var transientObservedNodes = this.transientObservedNodes;
      this.transientObservedNodes = [];
      transientObservedNodes.forEach(function(node) {
        this.removeListeners_(node);
        var registrations = registrationsTable.get(node);
        for (var i = 0; i < registrations.length; i++) {
          if (registrations[i] === this) {
            registrations.splice(i, 1);
            break;
          }
        }
      }, this);
    },
    handleEvent: function(e) {
      e.stopImmediatePropagation();
      switch (e.type) {
       case "DOMAttrModified":
        var name = e.attrName;
        var namespace = e.relatedNode.namespaceURI;
        var target = e.target;
        var record = new getRecord("attributes", target);
        record.attributeName = name;
        record.attributeNamespace = namespace;
        var oldValue = e.attrChange === MutationEvent.ADDITION ? null : e.prevValue;
        forEachAncestorAndObserverEnqueueRecord(target, function(options) {
          if (!options.attributes) return;
          if (options.attributeFilter && options.attributeFilter.length && options.attributeFilter.indexOf(name) === -1 && options.attributeFilter.indexOf(namespace) === -1) {
            return;
          }
          if (options.attributeOldValue) return getRecordWithOldValue(oldValue);
          return record;
        });
        break;

       case "DOMCharacterDataModified":
        var target = e.target;
        var record = getRecord("characterData", target);
        var oldValue = e.prevValue;
        forEachAncestorAndObserverEnqueueRecord(target, function(options) {
          if (!options.characterData) return;
          if (options.characterDataOldValue) return getRecordWithOldValue(oldValue);
          return record;
        });
        break;

       case "DOMNodeRemoved":
        this.addTransientObserver(e.target);

       case "DOMNodeInserted":
        var changedNode = e.target;
        var addedNodes, removedNodes;
        if (e.type === "DOMNodeInserted") {
          addedNodes = [ changedNode ];
          removedNodes = [];
        } else {
          addedNodes = [];
          removedNodes = [ changedNode ];
        }
        var previousSibling = changedNode.previousSibling;
        var nextSibling = changedNode.nextSibling;
        var record = getRecord("childList", e.target.parentNode);
        record.addedNodes = addedNodes;
        record.removedNodes = removedNodes;
        record.previousSibling = previousSibling;
        record.nextSibling = nextSibling;
        forEachAncestorAndObserverEnqueueRecord(e.relatedNode, function(options) {
          if (!options.childList) return;
          return record;
        });
      }
      clearRecords();
    }
  };
  global.JsMutationObserver = JsMutationObserver;
  if (!global.MutationObserver) global.MutationObserver = JsMutationObserver;
})(this);

window.HTMLImports = window.HTMLImports || {
  flags: {}
};

(function(scope) {
  var IMPORT_LINK_TYPE = "import";
  var useNative = Boolean(IMPORT_LINK_TYPE in document.createElement("link"));
  var hasShadowDOMPolyfill = Boolean(window.ShadowDOMPolyfill);
  var wrap = function(node) {
    return hasShadowDOMPolyfill ? window.ShadowDOMPolyfill.wrapIfNeeded(node) : node;
  };
  var rootDocument = wrap(document);
  var currentScriptDescriptor = {
    get: function() {
      var script = window.HTMLImports.currentScript || document.currentScript || (document.readyState !== "complete" ? document.scripts[document.scripts.length - 1] : null);
      return wrap(script);
    },
    configurable: true
  };
  Object.defineProperty(document, "_currentScript", currentScriptDescriptor);
  Object.defineProperty(rootDocument, "_currentScript", currentScriptDescriptor);
  var isIE = /Trident/.test(navigator.userAgent);
  function whenReady(callback, doc) {
    doc = doc || rootDocument;
    whenDocumentReady(function() {
      watchImportsLoad(callback, doc);
    }, doc);
  }
  var requiredReadyState = isIE ? "complete" : "interactive";
  var READY_EVENT = "readystatechange";
  function isDocumentReady(doc) {
    return doc.readyState === "complete" || doc.readyState === requiredReadyState;
  }
  function whenDocumentReady(callback, doc) {
    if (!isDocumentReady(doc)) {
      var checkReady = function() {
        if (doc.readyState === "complete" || doc.readyState === requiredReadyState) {
          doc.removeEventListener(READY_EVENT, checkReady);
          whenDocumentReady(callback, doc);
        }
      };
      doc.addEventListener(READY_EVENT, checkReady);
    } else if (callback) {
      callback();
    }
  }
  function markTargetLoaded(event) {
    event.target.__loaded = true;
  }
  function watchImportsLoad(callback, doc) {
    var imports = doc.querySelectorAll("link[rel=import]");
    var parsedCount = 0, importCount = imports.length, newImports = [], errorImports = [];
    function checkDone() {
      if (parsedCount == importCount && callback) {
        callback({
          allImports: imports,
          loadedImports: newImports,
          errorImports: errorImports
        });
      }
    }
    function loadedImport(e) {
      markTargetLoaded(e);
      newImports.push(this);
      parsedCount++;
      checkDone();
    }
    function errorLoadingImport(e) {
      errorImports.push(this);
      parsedCount++;
      checkDone();
    }
    if (importCount) {
      for (var i = 0, imp; i < importCount && (imp = imports[i]); i++) {
        if (isImportLoaded(imp)) {
          parsedCount++;
          checkDone();
        } else {
          imp.addEventListener("load", loadedImport);
          imp.addEventListener("error", errorLoadingImport);
        }
      }
    } else {
      checkDone();
    }
  }
  function isImportLoaded(link) {
    return useNative ? link.__loaded || link.import && link.import.readyState !== "loading" : link.__importParsed;
  }
  if (useNative) {
    new MutationObserver(function(mxns) {
      for (var i = 0, l = mxns.length, m; i < l && (m = mxns[i]); i++) {
        if (m.addedNodes) {
          handleImports(m.addedNodes);
        }
      }
    }).observe(document.head, {
      childList: true
    });
    function handleImports(nodes) {
      for (var i = 0, l = nodes.length, n; i < l && (n = nodes[i]); i++) {
        if (isImport(n)) {
          handleImport(n);
        }
      }
    }
    function isImport(element) {
      return element.localName === "link" && element.rel === "import";
    }
    function handleImport(element) {
      var loaded = element.import;
      if (loaded) {
        markTargetLoaded({
          target: element
        });
      } else {
        element.addEventListener("load", markTargetLoaded);
        element.addEventListener("error", markTargetLoaded);
      }
    }
    (function() {
      if (document.readyState === "loading") {
        var imports = document.querySelectorAll("link[rel=import]");
        for (var i = 0, l = imports.length, imp; i < l && (imp = imports[i]); i++) {
          handleImport(imp);
        }
      }
    })();
  }
  whenReady(function(detail) {
    window.HTMLImports.ready = true;
    window.HTMLImports.readyTime = new Date().getTime();
    var evt = rootDocument.createEvent("CustomEvent");
    evt.initCustomEvent("HTMLImportsLoaded", true, true, detail);
    rootDocument.dispatchEvent(evt);
  });
  scope.IMPORT_LINK_TYPE = IMPORT_LINK_TYPE;
  scope.useNative = useNative;
  scope.rootDocument = rootDocument;
  scope.whenReady = whenReady;
  scope.isIE = isIE;
})(window.HTMLImports);

(function(scope) {
  var modules = [];
  var addModule = function(module) {
    modules.push(module);
  };
  var initializeModules = function() {
    modules.forEach(function(module) {
      module(scope);
    });
  };
  scope.addModule = addModule;
  scope.initializeModules = initializeModules;
})(window.HTMLImports);

window.HTMLImports.addModule(function(scope) {
  var CSS_URL_REGEXP = /(url\()([^)]*)(\))/g;
  var CSS_IMPORT_REGEXP = /(@import[\s]+(?!url\())([^;]*)(;)/g;
  var path = {
    resolveUrlsInStyle: function(style, linkUrl) {
      var doc = style.ownerDocument;
      var resolver = doc.createElement("a");
      style.textContent = this.resolveUrlsInCssText(style.textContent, linkUrl, resolver);
      return style;
    },
    resolveUrlsInCssText: function(cssText, linkUrl, urlObj) {
      var r = this.replaceUrls(cssText, urlObj, linkUrl, CSS_URL_REGEXP);
      r = this.replaceUrls(r, urlObj, linkUrl, CSS_IMPORT_REGEXP);
      return r;
    },
    replaceUrls: function(text, urlObj, linkUrl, regexp) {
      return text.replace(regexp, function(m, pre, url, post) {
        var urlPath = url.replace(/["']/g, "");
        if (linkUrl) {
          urlPath = new URL(urlPath, linkUrl).href;
        }
        urlObj.href = urlPath;
        urlPath = urlObj.href;
        return pre + "'" + urlPath + "'" + post;
      });
    }
  };
  scope.path = path;
});

window.HTMLImports.addModule(function(scope) {
  var xhr = {
    async: true,
    ok: function(request) {
      return request.status >= 200 && request.status < 300 || request.status === 304 || request.status === 0;
    },
    load: function(url, next, nextContext) {
      var request = new XMLHttpRequest();
      if (scope.flags.debug || scope.flags.bust) {
        url += "?" + Math.random();
      }
      request.open("GET", url, xhr.async);
      request.addEventListener("readystatechange", function(e) {
        if (request.readyState === 4) {
          var locationHeader = request.getResponseHeader("Location");
          var redirectedUrl = null;
          if (locationHeader) {
            var redirectedUrl = locationHeader.substr(0, 1) === "/" ? location.origin + locationHeader : locationHeader;
          }
          next.call(nextContext, !xhr.ok(request) && request, request.response || request.responseText, redirectedUrl);
        }
      });
      request.send();
      return request;
    },
    loadDocument: function(url, next, nextContext) {
      this.load(url, next, nextContext).responseType = "document";
    }
  };
  scope.xhr = xhr;
});

window.HTMLImports.addModule(function(scope) {
  var xhr = scope.xhr;
  var flags = scope.flags;
  var Loader = function(onLoad, onComplete) {
    this.cache = {};
    this.onload = onLoad;
    this.oncomplete = onComplete;
    this.inflight = 0;
    this.pending = {};
  };
  Loader.prototype = {
    addNodes: function(nodes) {
      this.inflight += nodes.length;
      for (var i = 0, l = nodes.length, n; i < l && (n = nodes[i]); i++) {
        this.require(n);
      }
      this.checkDone();
    },
    addNode: function(node) {
      this.inflight++;
      this.require(node);
      this.checkDone();
    },
    require: function(elt) {
      var url = elt.src || elt.href;
      elt.__nodeUrl = url;
      if (!this.dedupe(url, elt)) {
        this.fetch(url, elt);
      }
    },
    dedupe: function(url, elt) {
      if (this.pending[url]) {
        this.pending[url].push(elt);
        return true;
      }
      var resource;
      if (this.cache[url]) {
        this.onload(url, elt, this.cache[url]);
        this.tail();
        return true;
      }
      this.pending[url] = [ elt ];
      return false;
    },
    fetch: function(url, elt) {
      flags.load && console.log("fetch", url, elt);
      if (!url) {
        setTimeout(function() {
          this.receive(url, elt, {
            error: "href must be specified"
          }, null);
        }.bind(this), 0);
      } else if (url.match(/^data:/)) {
        var pieces = url.split(",");
        var header = pieces[0];
        var body = pieces[1];
        if (header.indexOf(";base64") > -1) {
          body = atob(body);
        } else {
          body = decodeURIComponent(body);
        }
        setTimeout(function() {
          this.receive(url, elt, null, body);
        }.bind(this), 0);
      } else {
        var receiveXhr = function(err, resource, redirectedUrl) {
          this.receive(url, elt, err, resource, redirectedUrl);
        }.bind(this);
        xhr.load(url, receiveXhr);
      }
    },
    receive: function(url, elt, err, resource, redirectedUrl) {
      this.cache[url] = resource;
      var $p = this.pending[url];
      for (var i = 0, l = $p.length, p; i < l && (p = $p[i]); i++) {
        this.onload(url, p, resource, err, redirectedUrl);
        this.tail();
      }
      this.pending[url] = null;
    },
    tail: function() {
      --this.inflight;
      this.checkDone();
    },
    checkDone: function() {
      if (!this.inflight) {
        this.oncomplete();
      }
    }
  };
  scope.Loader = Loader;
});

window.HTMLImports.addModule(function(scope) {
  var Observer = function(addCallback) {
    this.addCallback = addCallback;
    this.mo = new MutationObserver(this.handler.bind(this));
  };
  Observer.prototype = {
    handler: function(mutations) {
      for (var i = 0, l = mutations.length, m; i < l && (m = mutations[i]); i++) {
        if (m.type === "childList" && m.addedNodes.length) {
          this.addedNodes(m.addedNodes);
        }
      }
    },
    addedNodes: function(nodes) {
      if (this.addCallback) {
        this.addCallback(nodes);
      }
      for (var i = 0, l = nodes.length, n, loading; i < l && (n = nodes[i]); i++) {
        if (n.children && n.children.length) {
          this.addedNodes(n.children);
        }
      }
    },
    observe: function(root) {
      this.mo.observe(root, {
        childList: true,
        subtree: true
      });
    }
  };
  scope.Observer = Observer;
});

window.HTMLImports.addModule(function(scope) {
  var path = scope.path;
  var rootDocument = scope.rootDocument;
  var flags = scope.flags;
  var isIE = scope.isIE;
  var IMPORT_LINK_TYPE = scope.IMPORT_LINK_TYPE;
  var IMPORT_SELECTOR = "link[rel=" + IMPORT_LINK_TYPE + "]";
  var importParser = {
    documentSelectors: IMPORT_SELECTOR,
    importsSelectors: [ IMPORT_SELECTOR, "link[rel=stylesheet]", "style", "script:not([type])", 'script[type="application/javascript"]', 'script[type="text/javascript"]' ].join(","),
    map: {
      link: "parseLink",
      script: "parseScript",
      style: "parseStyle"
    },
    dynamicElements: [],
    parseNext: function() {
      var next = this.nextToParse();
      if (next) {
        this.parse(next);
      }
    },
    parse: function(elt) {
      if (this.isParsed(elt)) {
        flags.parse && console.log("[%s] is already parsed", elt.localName);
        return;
      }
      var fn = this[this.map[elt.localName]];
      if (fn) {
        this.markParsing(elt);
        fn.call(this, elt);
      }
    },
    parseDynamic: function(elt, quiet) {
      this.dynamicElements.push(elt);
      if (!quiet) {
        this.parseNext();
      }
    },
    markParsing: function(elt) {
      flags.parse && console.log("parsing", elt);
      this.parsingElement = elt;
    },
    markParsingComplete: function(elt) {
      elt.__importParsed = true;
      this.markDynamicParsingComplete(elt);
      if (elt.__importElement) {
        elt.__importElement.__importParsed = true;
        this.markDynamicParsingComplete(elt.__importElement);
      }
      this.parsingElement = null;
      flags.parse && console.log("completed", elt);
    },
    markDynamicParsingComplete: function(elt) {
      var i = this.dynamicElements.indexOf(elt);
      if (i >= 0) {
        this.dynamicElements.splice(i, 1);
      }
    },
    parseImport: function(elt) {
      if (window.HTMLImports.__importsParsingHook) {
        window.HTMLImports.__importsParsingHook(elt);
      }
      if (elt.import) {
        elt.import.__importParsed = true;
      }
      this.markParsingComplete(elt);
      if (elt.__resource && !elt.__error) {
        elt.dispatchEvent(new CustomEvent("load", {
          bubbles: false
        }));
      } else {
        elt.dispatchEvent(new CustomEvent("error", {
          bubbles: false
        }));
      }
      if (elt.__pending) {
        var fn;
        while (elt.__pending.length) {
          fn = elt.__pending.shift();
          if (fn) {
            fn({
              target: elt
            });
          }
        }
      }
      this.parseNext();
    },
    parseLink: function(linkElt) {
      if (nodeIsImport(linkElt)) {
        this.parseImport(linkElt);
      } else {
        linkElt.href = linkElt.href;
        this.parseGeneric(linkElt);
      }
    },
    parseStyle: function(elt) {
      var src = elt;
      elt = cloneStyle(elt);
      src.__appliedElement = elt;
      elt.__importElement = src;
      this.parseGeneric(elt);
    },
    parseGeneric: function(elt) {
      this.trackElement(elt);
      this.addElementToDocument(elt);
    },
    rootImportForElement: function(elt) {
      var n = elt;
      while (n.ownerDocument.__importLink) {
        n = n.ownerDocument.__importLink;
      }
      return n;
    },
    addElementToDocument: function(elt) {
      var port = this.rootImportForElement(elt.__importElement || elt);
      port.parentNode.insertBefore(elt, port);
    },
    trackElement: function(elt, callback) {
      var self = this;
      var done = function(e) {
        if (callback) {
          callback(e);
        }
        self.markParsingComplete(elt);
        self.parseNext();
      };
      elt.addEventListener("load", done);
      elt.addEventListener("error", done);
      if (isIE && elt.localName === "style") {
        var fakeLoad = false;
        if (elt.textContent.indexOf("@import") == -1) {
          fakeLoad = true;
        } else if (elt.sheet) {
          fakeLoad = true;
          var csr = elt.sheet.cssRules;
          var len = csr ? csr.length : 0;
          for (var i = 0, r; i < len && (r = csr[i]); i++) {
            if (r.type === CSSRule.IMPORT_RULE) {
              fakeLoad = fakeLoad && Boolean(r.styleSheet);
            }
          }
        }
        if (fakeLoad) {
          setTimeout(function() {
            elt.dispatchEvent(new CustomEvent("load", {
              bubbles: false
            }));
          });
        }
      }
    },
    parseScript: function(scriptElt) {
      var script = document.createElement("script");
      script.__importElement = scriptElt;
      script.src = scriptElt.src ? scriptElt.src : generateScriptDataUrl(scriptElt);
      scope.currentScript = scriptElt;
      this.trackElement(script, function(e) {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
        scope.currentScript = null;
      });
      this.addElementToDocument(script);
    },
    nextToParse: function() {
      this._mayParse = [];
      return !this.parsingElement && (this.nextToParseInDoc(rootDocument) || this.nextToParseDynamic());
    },
    nextToParseInDoc: function(doc, link) {
      if (doc && this._mayParse.indexOf(doc) < 0) {
        this._mayParse.push(doc);
        var nodes = doc.querySelectorAll(this.parseSelectorsForNode(doc));
        for (var i = 0, l = nodes.length, p = 0, n; i < l && (n = nodes[i]); i++) {
          if (!this.isParsed(n)) {
            if (this.hasResource(n)) {
              return nodeIsImport(n) ? this.nextToParseInDoc(n.import, n) : n;
            } else {
              return;
            }
          }
        }
      }
      return link;
    },
    nextToParseDynamic: function() {
      return this.dynamicElements[0];
    },
    parseSelectorsForNode: function(node) {
      var doc = node.ownerDocument || node;
      return doc === rootDocument ? this.documentSelectors : this.importsSelectors;
    },
    isParsed: function(node) {
      return node.__importParsed;
    },
    needsDynamicParsing: function(elt) {
      return this.dynamicElements.indexOf(elt) >= 0;
    },
    hasResource: function(node) {
      if (nodeIsImport(node) && node.import === undefined) {
        return false;
      }
      return true;
    }
  };
  function nodeIsImport(elt) {
    return elt.localName === "link" && elt.rel === IMPORT_LINK_TYPE;
  }
  function generateScriptDataUrl(script) {
    var scriptContent = generateScriptContent(script);
    return "data:text/javascript;charset=utf-8," + encodeURIComponent(scriptContent);
  }
  function generateScriptContent(script) {
    return script.textContent + generateSourceMapHint(script);
  }
  function generateSourceMapHint(script) {
    var owner = script.ownerDocument;
    owner.__importedScripts = owner.__importedScripts || 0;
    var moniker = script.ownerDocument.baseURI;
    var num = owner.__importedScripts ? "-" + owner.__importedScripts : "";
    owner.__importedScripts++;
    return "\n//# sourceURL=" + moniker + num + ".js\n";
  }
  function cloneStyle(style) {
    var clone = style.ownerDocument.createElement("style");
    clone.textContent = style.textContent;
    path.resolveUrlsInStyle(clone);
    return clone;
  }
  scope.parser = importParser;
  scope.IMPORT_SELECTOR = IMPORT_SELECTOR;
});

window.HTMLImports.addModule(function(scope) {
  var flags = scope.flags;
  var IMPORT_LINK_TYPE = scope.IMPORT_LINK_TYPE;
  var IMPORT_SELECTOR = scope.IMPORT_SELECTOR;
  var rootDocument = scope.rootDocument;
  var Loader = scope.Loader;
  var Observer = scope.Observer;
  var parser = scope.parser;
  var importer = {
    documents: {},
    documentPreloadSelectors: IMPORT_SELECTOR,
    importsPreloadSelectors: [ IMPORT_SELECTOR ].join(","),
    loadNode: function(node) {
      importLoader.addNode(node);
    },
    loadSubtree: function(parent) {
      var nodes = this.marshalNodes(parent);
      importLoader.addNodes(nodes);
    },
    marshalNodes: function(parent) {
      return parent.querySelectorAll(this.loadSelectorsForNode(parent));
    },
    loadSelectorsForNode: function(node) {
      var doc = node.ownerDocument || node;
      return doc === rootDocument ? this.documentPreloadSelectors : this.importsPreloadSelectors;
    },
    loaded: function(url, elt, resource, err, redirectedUrl) {
      flags.load && console.log("loaded", url, elt);
      elt.__resource = resource;
      elt.__error = err;
      if (isImportLink(elt)) {
        var doc = this.documents[url];
        if (doc === undefined) {
          doc = err ? null : makeDocument(resource, redirectedUrl || url);
          if (doc) {
            doc.__importLink = elt;
            this.bootDocument(doc);
          }
          this.documents[url] = doc;
        }
        elt.import = doc;
      }
      parser.parseNext();
    },
    bootDocument: function(doc) {
      this.loadSubtree(doc);
      this.observer.observe(doc);
      parser.parseNext();
    },
    loadedAll: function() {
      parser.parseNext();
    }
  };
  var importLoader = new Loader(importer.loaded.bind(importer), importer.loadedAll.bind(importer));
  importer.observer = new Observer();
  function isImportLink(elt) {
    return isLinkRel(elt, IMPORT_LINK_TYPE);
  }
  function isLinkRel(elt, rel) {
    return elt.localName === "link" && elt.getAttribute("rel") === rel;
  }
  function hasBaseURIAccessor(doc) {
    return !!Object.getOwnPropertyDescriptor(doc, "baseURI");
  }
  function makeDocument(resource, url) {
    var doc = document.implementation.createHTMLDocument(IMPORT_LINK_TYPE);
    doc._URL = url;
    var base = doc.createElement("base");
    base.setAttribute("href", url);
    if (!doc.baseURI && !hasBaseURIAccessor(doc)) {
      Object.defineProperty(doc, "baseURI", {
        value: url
      });
    }
    var meta = doc.createElement("meta");
    meta.setAttribute("charset", "utf-8");
    doc.head.appendChild(meta);
    doc.head.appendChild(base);
    doc.body.innerHTML = resource;
    if (window.HTMLTemplateElement && HTMLTemplateElement.bootstrap) {
      HTMLTemplateElement.bootstrap(doc);
    }
    return doc;
  }
  if (!document.baseURI) {
    var baseURIDescriptor = {
      get: function() {
        var base = document.querySelector("base");
        return base ? base.href : window.location.href;
      },
      configurable: true
    };
    Object.defineProperty(document, "baseURI", baseURIDescriptor);
    Object.defineProperty(rootDocument, "baseURI", baseURIDescriptor);
  }
  scope.importer = importer;
  scope.importLoader = importLoader;
});

window.HTMLImports.addModule(function(scope) {
  var parser = scope.parser;
  var importer = scope.importer;
  var dynamic = {
    added: function(nodes) {
      var owner, parsed, loading;
      for (var i = 0, l = nodes.length, n; i < l && (n = nodes[i]); i++) {
        if (!owner) {
          owner = n.ownerDocument;
          parsed = parser.isParsed(owner);
        }
        loading = this.shouldLoadNode(n);
        if (loading) {
          importer.loadNode(n);
        }
        if (this.shouldParseNode(n) && parsed) {
          parser.parseDynamic(n, loading);
        }
      }
    },
    shouldLoadNode: function(node) {
      return node.nodeType === 1 && matches.call(node, importer.loadSelectorsForNode(node));
    },
    shouldParseNode: function(node) {
      return node.nodeType === 1 && matches.call(node, parser.parseSelectorsForNode(node));
    }
  };
  importer.observer.addCallback = dynamic.added.bind(dynamic);
  var matches = HTMLElement.prototype.matches || HTMLElement.prototype.matchesSelector || HTMLElement.prototype.webkitMatchesSelector || HTMLElement.prototype.mozMatchesSelector || HTMLElement.prototype.msMatchesSelector;
});

(function(scope) {
  var initializeModules = scope.initializeModules;
  var isIE = scope.isIE;
  if (scope.useNative) {
    return;
  }
  if (isIE && typeof window.CustomEvent !== "function") {
    window.CustomEvent = function(inType, params) {
      params = params || {};
      var e = document.createEvent("CustomEvent");
      e.initCustomEvent(inType, Boolean(params.bubbles), Boolean(params.cancelable), params.detail);
      e.preventDefault = function() {
        Object.defineProperty(this, "defaultPrevented", {
          get: function() {
            return true;
          }
        });
      };
      return e;
    };
    window.CustomEvent.prototype = window.Event.prototype;
  }
  initializeModules();
  var rootDocument = scope.rootDocument;
  function bootstrap() {
    window.HTMLImports.importer.bootDocument(rootDocument);
  }
  if (document.readyState === "complete" || document.readyState === "interactive" && !window.attachEvent) {
    bootstrap();
  } else {
    document.addEventListener("DOMContentLoaded", bootstrap);
  }
})(window.HTMLImports);

window.CustomElements = window.CustomElements || {
  flags: {}
};

(function(scope) {
  var flags = scope.flags;
  var modules = [];
  var addModule = function(module) {
    modules.push(module);
  };
  var initializeModules = function() {
    modules.forEach(function(module) {
      module(scope);
    });
  };
  scope.addModule = addModule;
  scope.initializeModules = initializeModules;
  scope.hasNative = Boolean(document.registerElement);
  scope.useNative = !flags.register && scope.hasNative && !window.ShadowDOMPolyfill && (!window.HTMLImports || window.HTMLImports.useNative);
})(window.CustomElements);

window.CustomElements.addModule(function(scope) {
  var IMPORT_LINK_TYPE = window.HTMLImports ? window.HTMLImports.IMPORT_LINK_TYPE : "none";
  function forSubtree(node, cb) {
    findAllElements(node, function(e) {
      if (cb(e)) {
        return true;
      }
      forRoots(e, cb);
    });
    forRoots(node, cb);
  }
  function findAllElements(node, find, data) {
    var e = node.firstElementChild;
    if (!e) {
      e = node.firstChild;
      while (e && e.nodeType !== Node.ELEMENT_NODE) {
        e = e.nextSibling;
      }
    }
    while (e) {
      if (find(e, data) !== true) {
        findAllElements(e, find, data);
      }
      e = e.nextElementSibling;
    }
    return null;
  }
  function forRoots(node, cb) {
    var root = node.shadowRoot;
    while (root) {
      forSubtree(root, cb);
      root = root.olderShadowRoot;
    }
  }
  function forDocumentTree(doc, cb) {
    _forDocumentTree(doc, cb, []);
  }
  function _forDocumentTree(doc, cb, processingDocuments) {
    doc = window.wrap(doc);
    if (processingDocuments.indexOf(doc) >= 0) {
      return;
    }
    processingDocuments.push(doc);
    var imports = doc.querySelectorAll("link[rel=" + IMPORT_LINK_TYPE + "]");
    for (var i = 0, l = imports.length, n; i < l && (n = imports[i]); i++) {
      if (n.import) {
        _forDocumentTree(n.import, cb, processingDocuments);
      }
    }
    cb(doc);
  }
  scope.forDocumentTree = forDocumentTree;
  scope.forSubtree = forSubtree;
});

window.CustomElements.addModule(function(scope) {
  var flags = scope.flags;
  var forSubtree = scope.forSubtree;
  var forDocumentTree = scope.forDocumentTree;
  function addedNode(node, isAttached) {
    return added(node, isAttached) || addedSubtree(node, isAttached);
  }
  function added(node, isAttached) {
    if (scope.upgrade(node, isAttached)) {
      return true;
    }
    if (isAttached) {
      attached(node);
    }
  }
  function addedSubtree(node, isAttached) {
    forSubtree(node, function(e) {
      if (added(e, isAttached)) {
        return true;
      }
    });
  }
  var hasPolyfillMutations = !window.MutationObserver || window.MutationObserver === window.JsMutationObserver;
  scope.hasPolyfillMutations = hasPolyfillMutations;
  var isPendingMutations = false;
  var pendingMutations = [];
  function deferMutation(fn) {
    pendingMutations.push(fn);
    if (!isPendingMutations) {
      isPendingMutations = true;
      setTimeout(takeMutations);
    }
  }
  function takeMutations() {
    isPendingMutations = false;
    var $p = pendingMutations;
    for (var i = 0, l = $p.length, p; i < l && (p = $p[i]); i++) {
      p();
    }
    pendingMutations = [];
  }
  function attached(element) {
    if (hasPolyfillMutations) {
      deferMutation(function() {
        _attached(element);
      });
    } else {
      _attached(element);
    }
  }
  function _attached(element) {
    if (element.__upgraded__ && !element.__attached) {
      element.__attached = true;
      if (element.attachedCallback) {
        element.attachedCallback();
      }
    }
  }
  function detachedNode(node) {
    detached(node);
    forSubtree(node, function(e) {
      detached(e);
    });
  }
  function detached(element) {
    if (hasPolyfillMutations) {
      deferMutation(function() {
        _detached(element);
      });
    } else {
      _detached(element);
    }
  }
  function _detached(element) {
    if (element.__upgraded__ && element.__attached) {
      element.__attached = false;
      if (element.detachedCallback) {
        element.detachedCallback();
      }
    }
  }
  function inDocument(element) {
    var p = element;
    var doc = window.wrap(document);
    while (p) {
      if (p == doc) {
        return true;
      }
      p = p.parentNode || p.nodeType === Node.DOCUMENT_FRAGMENT_NODE && p.host;
    }
  }
  function watchShadow(node) {
    if (node.shadowRoot && !node.shadowRoot.__watched) {
      flags.dom && console.log("watching shadow-root for: ", node.localName);
      var root = node.shadowRoot;
      while (root) {
        observe(root);
        root = root.olderShadowRoot;
      }
    }
  }
  function handler(root, mutations) {
    if (flags.dom) {
      var mx = mutations[0];
      if (mx && mx.type === "childList" && mx.addedNodes) {
        if (mx.addedNodes) {
          var d = mx.addedNodes[0];
          while (d && d !== document && !d.host) {
            d = d.parentNode;
          }
          var u = d && (d.URL || d._URL || d.host && d.host.localName) || "";
          u = u.split("/?").shift().split("/").pop();
        }
      }
      console.group("mutations (%d) [%s]", mutations.length, u || "");
    }
    var isAttached = inDocument(root);
    mutations.forEach(function(mx) {
      if (mx.type === "childList") {
        forEach(mx.addedNodes, function(n) {
          if (!n.localName) {
            return;
          }
          addedNode(n, isAttached);
        });
        forEach(mx.removedNodes, function(n) {
          if (!n.localName) {
            return;
          }
          detachedNode(n);
        });
      }
    });
    flags.dom && console.groupEnd();
  }
  function takeRecords(node) {
    node = window.wrap(node);
    if (!node) {
      node = window.wrap(document);
    }
    while (node.parentNode) {
      node = node.parentNode;
    }
    var observer = node.__observer;
    if (observer) {
      handler(node, observer.takeRecords());
      takeMutations();
    }
  }
  var forEach = Array.prototype.forEach.call.bind(Array.prototype.forEach);
  function observe(inRoot) {
    if (inRoot.__observer) {
      return;
    }
    var observer = new MutationObserver(handler.bind(this, inRoot));
    observer.observe(inRoot, {
      childList: true,
      subtree: true
    });
    inRoot.__observer = observer;
  }
  function upgradeDocument(doc) {
    doc = window.wrap(doc);
    flags.dom && console.group("upgradeDocument: ", doc.baseURI.split("/").pop());
    var isMainDocument = doc === window.wrap(document);
    addedNode(doc, isMainDocument);
    observe(doc);
    flags.dom && console.groupEnd();
  }
  function upgradeDocumentTree(doc) {
    forDocumentTree(doc, upgradeDocument);
  }
  var originalCreateShadowRoot = Element.prototype.createShadowRoot;
  if (originalCreateShadowRoot) {
    Element.prototype.createShadowRoot = function() {
      var root = originalCreateShadowRoot.call(this);
      window.CustomElements.watchShadow(this);
      return root;
    };
  }
  scope.watchShadow = watchShadow;
  scope.upgradeDocumentTree = upgradeDocumentTree;
  scope.upgradeSubtree = addedSubtree;
  scope.upgradeAll = addedNode;
  scope.attached = attached;
  scope.takeRecords = takeRecords;
});

window.CustomElements.addModule(function(scope) {
  var flags = scope.flags;
  function upgrade(node, isAttached) {
    if (!node.__upgraded__ && node.nodeType === Node.ELEMENT_NODE) {
      var is = node.getAttribute("is");
      var definition = scope.getRegisteredDefinition(is || node.localName);
      if (definition) {
        if (is && definition.tag == node.localName) {
          return upgradeWithDefinition(node, definition, isAttached);
        } else if (!is && !definition.extends) {
          return upgradeWithDefinition(node, definition, isAttached);
        }
      }
    }
  }
  function upgradeWithDefinition(element, definition, isAttached) {
    flags.upgrade && console.group("upgrade:", element.localName);
    if (definition.is) {
      element.setAttribute("is", definition.is);
    }
    implementPrototype(element, definition);
    element.__upgraded__ = true;
    created(element);
    if (isAttached) {
      scope.attached(element);
    }
    scope.upgradeSubtree(element, isAttached);
    flags.upgrade && console.groupEnd();
    return element;
  }
  function implementPrototype(element, definition) {
    if (Object.__proto__) {
      element.__proto__ = definition.prototype;
    } else {
      customMixin(element, definition.prototype, definition.native);
      element.__proto__ = definition.prototype;
    }
  }
  function customMixin(inTarget, inSrc, inNative) {
    var used = {};
    var p = inSrc;
    while (p !== inNative && p !== HTMLElement.prototype) {
      var keys = Object.getOwnPropertyNames(p);
      for (var i = 0, k; k = keys[i]; i++) {
        if (!used[k]) {
          Object.defineProperty(inTarget, k, Object.getOwnPropertyDescriptor(p, k));
          used[k] = 1;
        }
      }
      p = Object.getPrototypeOf(p);
    }
  }
  function created(element) {
    if (element.createdCallback) {
      element.createdCallback();
    }
  }
  scope.upgrade = upgrade;
  scope.upgradeWithDefinition = upgradeWithDefinition;
  scope.implementPrototype = implementPrototype;
});

window.CustomElements.addModule(function(scope) {
  var isIE11OrOlder = scope.isIE11OrOlder;
  var upgradeDocumentTree = scope.upgradeDocumentTree;
  var upgradeAll = scope.upgradeAll;
  var upgradeWithDefinition = scope.upgradeWithDefinition;
  var implementPrototype = scope.implementPrototype;
  var useNative = scope.useNative;
  function register(name, options) {
    var definition = options || {};
    if (!name) {
      throw new Error("document.registerElement: first argument `name` must not be empty");
    }
    if (name.indexOf("-") < 0) {
      throw new Error("document.registerElement: first argument ('name') must contain a dash ('-'). Argument provided was '" + String(name) + "'.");
    }
    if (isReservedTag(name)) {
      throw new Error("Failed to execute 'registerElement' on 'Document': Registration failed for type '" + String(name) + "'. The type name is invalid.");
    }
    if (getRegisteredDefinition(name)) {
      throw new Error("DuplicateDefinitionError: a type with name '" + String(name) + "' is already registered");
    }
    if (!definition.prototype) {
      definition.prototype = Object.create(HTMLElement.prototype);
    }
    definition.__name = name.toLowerCase();
    definition.lifecycle = definition.lifecycle || {};
    definition.ancestry = ancestry(definition.extends);
    resolveTagName(definition);
    resolvePrototypeChain(definition);
    overrideAttributeApi(definition.prototype);
    registerDefinition(definition.__name, definition);
    definition.ctor = generateConstructor(definition);
    definition.ctor.prototype = definition.prototype;
    definition.prototype.constructor = definition.ctor;
    if (scope.ready) {
      upgradeDocumentTree(document);
    }
    return definition.ctor;
  }
  function overrideAttributeApi(prototype) {
    if (prototype.setAttribute._polyfilled) {
      return;
    }
    var setAttribute = prototype.setAttribute;
    prototype.setAttribute = function(name, value) {
      changeAttribute.call(this, name, value, setAttribute);
    };
    var removeAttribute = prototype.removeAttribute;
    prototype.removeAttribute = function(name) {
      changeAttribute.call(this, name, null, removeAttribute);
    };
    prototype.setAttribute._polyfilled = true;
  }
  function changeAttribute(name, value, operation) {
    name = name.toLowerCase();
    var oldValue = this.getAttribute(name);
    operation.apply(this, arguments);
    var newValue = this.getAttribute(name);
    if (this.attributeChangedCallback && newValue !== oldValue) {
      this.attributeChangedCallback(name, oldValue, newValue);
    }
  }
  function isReservedTag(name) {
    for (var i = 0; i < reservedTagList.length; i++) {
      if (name === reservedTagList[i]) {
        return true;
      }
    }
  }
  var reservedTagList = [ "annotation-xml", "color-profile", "font-face", "font-face-src", "font-face-uri", "font-face-format", "font-face-name", "missing-glyph" ];
  function ancestry(extnds) {
    var extendee = getRegisteredDefinition(extnds);
    if (extendee) {
      return ancestry(extendee.extends).concat([ extendee ]);
    }
    return [];
  }
  function resolveTagName(definition) {
    var baseTag = definition.extends;
    for (var i = 0, a; a = definition.ancestry[i]; i++) {
      baseTag = a.is && a.tag;
    }
    definition.tag = baseTag || definition.__name;
    if (baseTag) {
      definition.is = definition.__name;
    }
  }
  function resolvePrototypeChain(definition) {
    if (!Object.__proto__) {
      var nativePrototype = HTMLElement.prototype;
      if (definition.is) {
        var inst = document.createElement(definition.tag);
        nativePrototype = Object.getPrototypeOf(inst);
      }
      var proto = definition.prototype, ancestor;
      var foundPrototype = false;
      while (proto) {
        if (proto == nativePrototype) {
          foundPrototype = true;
        }
        ancestor = Object.getPrototypeOf(proto);
        if (ancestor) {
          proto.__proto__ = ancestor;
        }
        proto = ancestor;
      }
      if (!foundPrototype) {
        console.warn(definition.tag + " prototype not found in prototype chain for " + definition.is);
      }
      definition.native = nativePrototype;
    }
  }
  function instantiate(definition) {
    return upgradeWithDefinition(domCreateElement(definition.tag), definition);
  }
  var registry = {};
  function getRegisteredDefinition(name) {
    if (name) {
      return registry[name.toLowerCase()];
    }
  }
  function registerDefinition(name, definition) {
    registry[name] = definition;
  }
  function generateConstructor(definition) {
    return function() {
      return instantiate(definition);
    };
  }
  var HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
  function createElementNS(namespace, tag, typeExtension) {
    if (namespace === HTML_NAMESPACE) {
      return createElement(tag, typeExtension);
    } else {
      return domCreateElementNS(namespace, tag);
    }
  }
  function createElement(tag, typeExtension) {
    if (tag) {
      tag = tag.toLowerCase();
    }
    if (typeExtension) {
      typeExtension = typeExtension.toLowerCase();
    }
    var definition = getRegisteredDefinition(typeExtension || tag);
    if (definition) {
      if (tag == definition.tag && typeExtension == definition.is) {
        return new definition.ctor();
      }
      if (!typeExtension && !definition.is) {
        return new definition.ctor();
      }
    }
    var element;
    if (typeExtension) {
      element = createElement(tag);
      element.setAttribute("is", typeExtension);
      return element;
    }
    element = domCreateElement(tag);
    if (tag.indexOf("-") >= 0) {
      implementPrototype(element, HTMLElement);
    }
    return element;
  }
  var domCreateElement = document.createElement.bind(document);
  var domCreateElementNS = document.createElementNS.bind(document);
  var isInstance;
  if (!Object.__proto__ && !useNative) {
    isInstance = function(obj, ctor) {
      if (obj instanceof ctor) {
        return true;
      }
      var p = obj;
      while (p) {
        if (p === ctor.prototype) {
          return true;
        }
        p = p.__proto__;
      }
      return false;
    };
  } else {
    isInstance = function(obj, base) {
      return obj instanceof base;
    };
  }
  function wrapDomMethodToForceUpgrade(obj, methodName) {
    var orig = obj[methodName];
    obj[methodName] = function() {
      var n = orig.apply(this, arguments);
      upgradeAll(n);
      return n;
    };
  }
  wrapDomMethodToForceUpgrade(Node.prototype, "cloneNode");
  wrapDomMethodToForceUpgrade(document, "importNode");
  if (isIE11OrOlder) {
    (function() {
      var importNode = document.importNode;
      document.importNode = function() {
        var n = importNode.apply(document, arguments);
        if (n.nodeType == n.DOCUMENT_FRAGMENT_NODE) {
          var f = document.createDocumentFragment();
          f.appendChild(n);
          return f;
        } else {
          return n;
        }
      };
    })();
  }
  document.registerElement = register;
  document.createElement = createElement;
  document.createElementNS = createElementNS;
  scope.registry = registry;
  scope.instanceof = isInstance;
  scope.reservedTagList = reservedTagList;
  scope.getRegisteredDefinition = getRegisteredDefinition;
  document.register = document.registerElement;
});

(function(scope) {
  var useNative = scope.useNative;
  var initializeModules = scope.initializeModules;
  var isIE11OrOlder = /Trident/.test(navigator.userAgent);
  if (useNative) {
    var nop = function() {};
    scope.watchShadow = nop;
    scope.upgrade = nop;
    scope.upgradeAll = nop;
    scope.upgradeDocumentTree = nop;
    scope.upgradeSubtree = nop;
    scope.takeRecords = nop;
    scope.instanceof = function(obj, base) {
      return obj instanceof base;
    };
  } else {
    initializeModules();
  }
  var upgradeDocumentTree = scope.upgradeDocumentTree;
  if (!window.wrap) {
    if (window.ShadowDOMPolyfill) {
      window.wrap = window.ShadowDOMPolyfill.wrapIfNeeded;
      window.unwrap = window.ShadowDOMPolyfill.unwrapIfNeeded;
    } else {
      window.wrap = window.unwrap = function(node) {
        return node;
      };
    }
  }
  function bootstrap() {
    upgradeDocumentTree(window.wrap(document));
    if (window.HTMLImports) {
      window.HTMLImports.__importsParsingHook = function(elt) {
        upgradeDocumentTree(window.wrap(elt.import));
      };
    }
    window.CustomElements.ready = true;
    setTimeout(function() {
      window.CustomElements.readyTime = Date.now();
      if (window.HTMLImports) {
        window.CustomElements.elapsed = window.CustomElements.readyTime - window.HTMLImports.readyTime;
      }
      document.dispatchEvent(new CustomEvent("WebComponentsReady", {
        bubbles: true
      }));
    });
  }
  if (isIE11OrOlder && typeof window.CustomEvent !== "function") {
    window.CustomEvent = function(inType, params) {
      params = params || {};
      var e = document.createEvent("CustomEvent");
      e.initCustomEvent(inType, Boolean(params.bubbles), Boolean(params.cancelable), params.detail);
      e.preventDefault = function() {
        Object.defineProperty(this, "defaultPrevented", {
          get: function() {
            return true;
          }
        });
      };
      return e;
    };
    window.CustomEvent.prototype = window.Event.prototype;
  }
  if (document.readyState === "complete" || scope.flags.eager) {
    bootstrap();
  } else if (document.readyState === "interactive" && !window.attachEvent && (!window.HTMLImports || window.HTMLImports.ready)) {
    bootstrap();
  } else {
    var loadEvent = window.HTMLImports && !window.HTMLImports.ready ? "HTMLImportsLoaded" : "DOMContentLoaded";
    window.addEventListener(loadEvent, bootstrap);
  }
  scope.isIE11OrOlder = isIE11OrOlder;
})(window.CustomElements);

if (typeof HTMLTemplateElement === "undefined") {
  (function() {
    var TEMPLATE_TAG = "template";
    HTMLTemplateElement = function() {};
    HTMLTemplateElement.prototype = Object.create(HTMLElement.prototype);
    HTMLTemplateElement.decorate = function(template) {
      if (!template.content) {
        template.content = template.ownerDocument.createDocumentFragment();
      }
      var child;
      while (child = template.firstChild) {
        template.content.appendChild(child);
      }
    };
    HTMLTemplateElement.bootstrap = function(doc) {
      var templates = doc.querySelectorAll(TEMPLATE_TAG);
      for (var i = 0, l = templates.length, t; i < l && (t = templates[i]); i++) {
        HTMLTemplateElement.decorate(t);
      }
    };
    window.addEventListener("DOMContentLoaded", function() {
      HTMLTemplateElement.bootstrap(document);
    });
    var createElement = document.createElement;
    document.createElement = function() {
      "use strict";
      var el = createElement.apply(document, arguments);
      if (el.localName == "template") {
        HTMLTemplateElement.decorate(el);
      }
      return el;
    };
  })();
}

(function(scope) {
  var style = document.createElement("style");
  style.textContent = "" + "body {" + "transition: opacity ease-in 0.2s;" + " } \n" + "body[unresolved] {" + "opacity: 0; display: block; overflow: hidden; position: relative;" + " } \n";
  var head = document.querySelector("head");
  head.insertBefore(style, head.firstChild);
})(window.WebComponents);
/*!
 * jQuery JavaScript Library v1.11.1
 * http://jquery.com/
 *
 * Includes Sizzle.js
 * http://sizzlejs.com/
 *
 * Copyright 2005, 2014 jQuery Foundation, Inc. and other contributors
 * Released under the MIT license
 * http://jquery.org/license
 *
 * Date: 2014-05-01T17:42Z
 */


(function( global, factory ) {

	if ( typeof module === "object" && typeof module.exports === "object" ) {
		// For CommonJS and CommonJS-like environments where a proper window is present,
		// execute the factory and get jQuery
		// For environments that do not inherently posses a window with a document
		// (such as Node.js), expose a jQuery-making factory as module.exports
		// This accentuates the need for the creation of a real window
		// e.g. var jQuery = require("jquery")(window);
		// See ticket #14549 for more info
		module.exports = global.document ?
			factory( global, true ) :
			function( w ) {
				if ( !w.document ) {
					throw new Error( "jQuery requires a window with a document" );
				}
				return factory( w );
			};
	} else {
		factory( global );
	}

// Pass this if window is not defined yet
}(typeof window !== "undefined" ? window : this, function( window, noGlobal ) {

// Can't do this because several apps including ASP.NET trace
// the stack via arguments.caller.callee and Firefox dies if
// you try to trace through "use strict" call chains. (#13335)
// Support: Firefox 18+
//

var deletedIds = [];

var slice = deletedIds.slice;

var concat = deletedIds.concat;

var push = deletedIds.push;

var indexOf = deletedIds.indexOf;

var class2type = {};

var toString = class2type.toString;

var hasOwn = class2type.hasOwnProperty;

var support = {};



var
	version = "1.11.1",

	// Define a local copy of jQuery
	jQuery = function( selector, context ) {
		// The jQuery object is actually just the init constructor 'enhanced'
		// Need init if jQuery is called (just allow error to be thrown if not included)
		return new jQuery.fn.init( selector, context );
	},

	// Support: Android<4.1, IE<9
	// Make sure we trim BOM and NBSP
	rtrim = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,

	// Matches dashed string for camelizing
	rmsPrefix = /^-ms-/,
	rdashAlpha = /-([\da-z])/gi,

	// Used by jQuery.camelCase as callback to replace()
	fcamelCase = function( all, letter ) {
		return letter.toUpperCase();
	};

jQuery.fn = jQuery.prototype = {
	// The current version of jQuery being used
	jquery: version,

	constructor: jQuery,

	// Start with an empty selector
	selector: "",

	// The default length of a jQuery object is 0
	length: 0,

	toArray: function() {
		return slice.call( this );
	},

	// Get the Nth element in the matched element set OR
	// Get the whole matched element set as a clean array
	get: function( num ) {
		return num != null ?

			// Return just the one element from the set
			( num < 0 ? this[ num + this.length ] : this[ num ] ) :

			// Return all the elements in a clean array
			slice.call( this );
	},

	// Take an array of elements and push it onto the stack
	// (returning the new matched element set)
	pushStack: function( elems ) {

		// Build a new jQuery matched element set
		var ret = jQuery.merge( this.constructor(), elems );

		// Add the old object onto the stack (as a reference)
		ret.prevObject = this;
		ret.context = this.context;

		// Return the newly-formed element set
		return ret;
	},

	// Execute a callback for every element in the matched set.
	// (You can seed the arguments with an array of args, but this is
	// only used internally.)
	each: function( callback, args ) {
		return jQuery.each( this, callback, args );
	},

	map: function( callback ) {
		return this.pushStack( jQuery.map(this, function( elem, i ) {
			return callback.call( elem, i, elem );
		}));
	},

	slice: function() {
		return this.pushStack( slice.apply( this, arguments ) );
	},

	first: function() {
		return this.eq( 0 );
	},

	last: function() {
		return this.eq( -1 );
	},

	eq: function( i ) {
		var len = this.length,
			j = +i + ( i < 0 ? len : 0 );
		return this.pushStack( j >= 0 && j < len ? [ this[j] ] : [] );
	},

	end: function() {
		return this.prevObject || this.constructor(null);
	},

	// For internal use only.
	// Behaves like an Array's method, not like a jQuery method.
	push: push,
	sort: deletedIds.sort,
	splice: deletedIds.splice
};

jQuery.extend = jQuery.fn.extend = function() {
	var src, copyIsArray, copy, name, options, clone,
		target = arguments[0] || {},
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if ( typeof target === "boolean" ) {
		deep = target;

		// skip the boolean and the target
		target = arguments[ i ] || {};
		i++;
	}

	// Handle case when target is a string or something (possible in deep copy)
	if ( typeof target !== "object" && !jQuery.isFunction(target) ) {
		target = {};
	}

	// extend jQuery itself if only one argument is passed
	if ( i === length ) {
		target = this;
		i--;
	}

	for ( ; i < length; i++ ) {
		// Only deal with non-null/undefined values
		if ( (options = arguments[ i ]) != null ) {
			// Extend the base object
			for ( name in options ) {
				src = target[ name ];
				copy = options[ name ];

				// Prevent never-ending loop
				if ( target === copy ) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if ( deep && copy && ( jQuery.isPlainObject(copy) || (copyIsArray = jQuery.isArray(copy)) ) ) {
					if ( copyIsArray ) {
						copyIsArray = false;
						clone = src && jQuery.isArray(src) ? src : [];

					} else {
						clone = src && jQuery.isPlainObject(src) ? src : {};
					}

					// Never move original objects, clone them
					target[ name ] = jQuery.extend( deep, clone, copy );

				// Don't bring in undefined values
				} else if ( copy !== undefined ) {
					target[ name ] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};

jQuery.extend({
	// Unique for each copy of jQuery on the page
	expando: "jQuery" + ( version + Math.random() ).replace( /\D/g, "" ),

	// Assume jQuery is ready without the ready module
	isReady: true,

	error: function( msg ) {
		throw new Error( msg );
	},

	noop: function() {},

	// See test/unit/core.js for details concerning isFunction.
	// Since version 1.3, DOM methods and functions like alert
	// aren't supported. They return false on IE (#2968).
	isFunction: function( obj ) {
		return jQuery.type(obj) === "function";
	},

	isArray: Array.isArray || function( obj ) {
		return jQuery.type(obj) === "array";
	},

	isWindow: function( obj ) {
		/* jshint eqeqeq: false */
		return obj != null && obj == obj.window;
	},

	isNumeric: function( obj ) {
		// parseFloat NaNs numeric-cast false positives (null|true|false|"")
		// ...but misinterprets leading-number strings, particularly hex literals ("0x...")
		// subtraction forces infinities to NaN
		return !jQuery.isArray( obj ) && obj - parseFloat( obj ) >= 0;
	},

	isEmptyObject: function( obj ) {
		var name;
		for ( name in obj ) {
			return false;
		}
		return true;
	},

	isPlainObject: function( obj ) {
		var key;

		// Must be an Object.
		// Because of IE, we also have to check the presence of the constructor property.
		// Make sure that DOM nodes and window objects don't pass through, as well
		if ( !obj || jQuery.type(obj) !== "object" || obj.nodeType || jQuery.isWindow( obj ) ) {
			return false;
		}

		try {
			// Not own constructor property must be Object
			if ( obj.constructor &&
				!hasOwn.call(obj, "constructor") &&
				!hasOwn.call(obj.constructor.prototype, "isPrototypeOf") ) {
				return false;
			}
		} catch ( e ) {
			// IE8,9 Will throw exceptions on certain host objects #9897
			return false;
		}

		// Support: IE<9
		// Handle iteration over inherited properties before own properties.
		if ( support.ownLast ) {
			for ( key in obj ) {
				return hasOwn.call( obj, key );
			}
		}

		// Own properties are enumerated firstly, so to speed up,
		// if last one is own, then all properties are own.
		for ( key in obj ) {}

		return key === undefined || hasOwn.call( obj, key );
	},

	type: function( obj ) {
		if ( obj == null ) {
			return obj + "";
		}
		return typeof obj === "object" || typeof obj === "function" ?
			class2type[ toString.call(obj) ] || "object" :
			typeof obj;
	},

	// Evaluates a script in a global context
	// Workarounds based on findings by Jim Driscoll
	// http://weblogs.java.net/blog/driscoll/archive/2009/09/08/eval-javascript-global-context
	globalEval: function( data ) {
		if ( data && jQuery.trim( data ) ) {
			// We use execScript on Internet Explorer
			// We use an anonymous function so that context is window
			// rather than jQuery in Firefox
			( window.execScript || function( data ) {
				window[ "eval" ].call( window, data );
			} )( data );
		}
	},

	// Convert dashed to camelCase; used by the css and data modules
	// Microsoft forgot to hump their vendor prefix (#9572)
	camelCase: function( string ) {
		return string.replace( rmsPrefix, "ms-" ).replace( rdashAlpha, fcamelCase );
	},

	nodeName: function( elem, name ) {
		return elem.nodeName && elem.nodeName.toLowerCase() === name.toLowerCase();
	},

	// args is for internal usage only
	each: function( obj, callback, args ) {
		var value,
			i = 0,
			length = obj.length,
			isArray = isArraylike( obj );

		if ( args ) {
			if ( isArray ) {
				for ( ; i < length; i++ ) {
					value = callback.apply( obj[ i ], args );

					if ( value === false ) {
						break;
					}
				}
			} else {
				for ( i in obj ) {
					value = callback.apply( obj[ i ], args );

					if ( value === false ) {
						break;
					}
				}
			}

		// A special, fast, case for the most common use of each
		} else {
			if ( isArray ) {
				for ( ; i < length; i++ ) {
					value = callback.call( obj[ i ], i, obj[ i ] );

					if ( value === false ) {
						break;
					}
				}
			} else {
				for ( i in obj ) {
					value = callback.call( obj[ i ], i, obj[ i ] );

					if ( value === false ) {
						break;
					}
				}
			}
		}

		return obj;
	},

	// Support: Android<4.1, IE<9
	trim: function( text ) {
		return text == null ?
			"" :
			( text + "" ).replace( rtrim, "" );
	},

	// results is for internal usage only
	makeArray: function( arr, results ) {
		var ret = results || [];

		if ( arr != null ) {
			if ( isArraylike( Object(arr) ) ) {
				jQuery.merge( ret,
					typeof arr === "string" ?
					[ arr ] : arr
				);
			} else {
				push.call( ret, arr );
			}
		}

		return ret;
	},

	inArray: function( elem, arr, i ) {
		var len;

		if ( arr ) {
			if ( indexOf ) {
				return indexOf.call( arr, elem, i );
			}

			len = arr.length;
			i = i ? i < 0 ? Math.max( 0, len + i ) : i : 0;

			for ( ; i < len; i++ ) {
				// Skip accessing in sparse arrays
				if ( i in arr && arr[ i ] === elem ) {
					return i;
				}
			}
		}

		return -1;
	},

	merge: function( first, second ) {
		var len = +second.length,
			j = 0,
			i = first.length;

		while ( j < len ) {
			first[ i++ ] = second[ j++ ];
		}

		// Support: IE<9
		// Workaround casting of .length to NaN on otherwise arraylike objects (e.g., NodeLists)
		if ( len !== len ) {
			while ( second[j] !== undefined ) {
				first[ i++ ] = second[ j++ ];
			}
		}

		first.length = i;

		return first;
	},

	grep: function( elems, callback, invert ) {
		var callbackInverse,
			matches = [],
			i = 0,
			length = elems.length,
			callbackExpect = !invert;

		// Go through the array, only saving the items
		// that pass the validator function
		for ( ; i < length; i++ ) {
			callbackInverse = !callback( elems[ i ], i );
			if ( callbackInverse !== callbackExpect ) {
				matches.push( elems[ i ] );
			}
		}

		return matches;
	},

	// arg is for internal usage only
	map: function( elems, callback, arg ) {
		var value,
			i = 0,
			length = elems.length,
			isArray = isArraylike( elems ),
			ret = [];

		// Go through the array, translating each of the items to their new values
		if ( isArray ) {
			for ( ; i < length; i++ ) {
				value = callback( elems[ i ], i, arg );

				if ( value != null ) {
					ret.push( value );
				}
			}

		// Go through every key on the object,
		} else {
			for ( i in elems ) {
				value = callback( elems[ i ], i, arg );

				if ( value != null ) {
					ret.push( value );
				}
			}
		}

		// Flatten any nested arrays
		return concat.apply( [], ret );
	},

	// A global GUID counter for objects
	guid: 1,

	// Bind a function to a context, optionally partially applying any
	// arguments.
	proxy: function( fn, context ) {
		var args, proxy, tmp;

		if ( typeof context === "string" ) {
			tmp = fn[ context ];
			context = fn;
			fn = tmp;
		}

		// Quick check to determine if target is callable, in the spec
		// this throws a TypeError, but we will just return undefined.
		if ( !jQuery.isFunction( fn ) ) {
			return undefined;
		}

		// Simulated bind
		args = slice.call( arguments, 2 );
		proxy = function() {
			return fn.apply( context || this, args.concat( slice.call( arguments ) ) );
		};

		// Set the guid of unique handler to the same of original handler, so it can be removed
		proxy.guid = fn.guid = fn.guid || jQuery.guid++;

		return proxy;
	},

	now: function() {
		return +( new Date() );
	},

	// jQuery.support is not used in Core but other projects attach their
	// properties to it so it needs to exist.
	support: support
});

// Populate the class2type map
jQuery.each("Boolean Number String Function Array Date RegExp Object Error".split(" "), function(i, name) {
	class2type[ "[object " + name + "]" ] = name.toLowerCase();
});

function isArraylike( obj ) {
	var length = obj.length,
		type = jQuery.type( obj );

	if ( type === "function" || jQuery.isWindow( obj ) ) {
		return false;
	}

	if ( obj.nodeType === 1 && length ) {
		return true;
	}

	return type === "array" || length === 0 ||
		typeof length === "number" && length > 0 && ( length - 1 ) in obj;
}
var Sizzle =
/*!
 * Sizzle CSS Selector Engine v1.10.19
 * http://sizzlejs.com/
 *
 * Copyright 2013 jQuery Foundation, Inc. and other contributors
 * Released under the MIT license
 * http://jquery.org/license
 *
 * Date: 2014-04-18
 */
(function( window ) {

var i,
	support,
	Expr,
	getText,
	isXML,
	tokenize,
	compile,
	select,
	outermostContext,
	sortInput,
	hasDuplicate,

	// Local document vars
	setDocument,
	document,
	docElem,
	documentIsHTML,
	rbuggyQSA,
	rbuggyMatches,
	matches,
	contains,

	// Instance-specific data
	expando = "sizzle" + -(new Date()),
	preferredDoc = window.document,
	dirruns = 0,
	done = 0,
	classCache = createCache(),
	tokenCache = createCache(),
	compilerCache = createCache(),
	sortOrder = function( a, b ) {
		if ( a === b ) {
			hasDuplicate = true;
		}
		return 0;
	},

	// General-purpose constants
	strundefined = typeof undefined,
	MAX_NEGATIVE = 1 << 31,

	// Instance methods
	hasOwn = ({}).hasOwnProperty,
	arr = [],
	pop = arr.pop,
	push_native = arr.push,
	push = arr.push,
	slice = arr.slice,
	// Use a stripped-down indexOf if we can't use a native one
	indexOf = arr.indexOf || function( elem ) {
		var i = 0,
			len = this.length;
		for ( ; i < len; i++ ) {
			if ( this[i] === elem ) {
				return i;
			}
		}
		return -1;
	},

	booleans = "checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",

	// Regular expressions

	// Whitespace characters http://www.w3.org/TR/css3-selectors/#whitespace
	whitespace = "[\\x20\\t\\r\\n\\f]",
	// http://www.w3.org/TR/css3-syntax/#characters
	characterEncoding = "(?:\\\\.|[\\w-]|[^\\x00-\\xa0])+",

	// Loosely modeled on CSS identifier characters
	// An unquoted value should be a CSS identifier http://www.w3.org/TR/css3-selectors/#attribute-selectors
	// Proper syntax: http://www.w3.org/TR/CSS21/syndata.html#value-def-identifier
	identifier = characterEncoding.replace( "w", "w#" ),

	// Attribute selectors: http://www.w3.org/TR/selectors/#attribute-selectors
	attributes = "\\[" + whitespace + "*(" + characterEncoding + ")(?:" + whitespace +
		// Operator (capture 2)
		"*([*^$|!~]?=)" + whitespace +
		// "Attribute values must be CSS identifiers [capture 5] or strings [capture 3 or capture 4]"
		"*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|(" + identifier + "))|)" + whitespace +
		"*\\]",

	pseudos = ":(" + characterEncoding + ")(?:\\((" +
		// To reduce the number of selectors needing tokenize in the preFilter, prefer arguments:
		// 1. quoted (capture 3; capture 4 or capture 5)
		"('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|" +
		// 2. simple (capture 6)
		"((?:\\\\.|[^\\\\()[\\]]|" + attributes + ")*)|" +
		// 3. anything else (capture 2)
		".*" +
		")\\)|)",

	// Leading and non-escaped trailing whitespace, capturing some non-whitespace characters preceding the latter
	rtrim = new RegExp( "^" + whitespace + "+|((?:^|[^\\\\])(?:\\\\.)*)" + whitespace + "+$", "g" ),

	rcomma = new RegExp( "^" + whitespace + "*," + whitespace + "*" ),
	rcombinators = new RegExp( "^" + whitespace + "*([>+~]|" + whitespace + ")" + whitespace + "*" ),

	rattributeQuotes = new RegExp( "=" + whitespace + "*([^\\]'\"]*?)" + whitespace + "*\\]", "g" ),

	rpseudo = new RegExp( pseudos ),
	ridentifier = new RegExp( "^" + identifier + "$" ),

	matchExpr = {
		"ID": new RegExp( "^#(" + characterEncoding + ")" ),
		"CLASS": new RegExp( "^\\.(" + characterEncoding + ")" ),
		"TAG": new RegExp( "^(" + characterEncoding.replace( "w", "w*" ) + ")" ),
		"ATTR": new RegExp( "^" + attributes ),
		"PSEUDO": new RegExp( "^" + pseudos ),
		"CHILD": new RegExp( "^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\(" + whitespace +
			"*(even|odd|(([+-]|)(\\d*)n|)" + whitespace + "*(?:([+-]|)" + whitespace +
			"*(\\d+)|))" + whitespace + "*\\)|)", "i" ),
		"bool": new RegExp( "^(?:" + booleans + ")$", "i" ),
		// For use in libraries implementing .is()
		// We use this for POS matching in `select`
		"needsContext": new RegExp( "^" + whitespace + "*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\(" +
			whitespace + "*((?:-\\d)?\\d*)" + whitespace + "*\\)|)(?=[^-]|$)", "i" )
	},

	rinputs = /^(?:input|select|textarea|button)$/i,
	rheader = /^h\d$/i,

	rnative = /^[^{]+\{\s*\[native \w/,

	// Easily-parseable/retrievable ID or TAG or CLASS selectors
	rquickExpr = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,

	rsibling = /[+~]/,
	rescape = /'|\\/g,

	// CSS escapes http://www.w3.org/TR/CSS21/syndata.html#escaped-characters
	runescape = new RegExp( "\\\\([\\da-f]{1,6}" + whitespace + "?|(" + whitespace + ")|.)", "ig" ),
	funescape = function( _, escaped, escapedWhitespace ) {
		var high = "0x" + escaped - 0x10000;
		// NaN means non-codepoint
		// Support: Firefox<24
		// Workaround erroneous numeric interpretation of +"0x"
		return high !== high || escapedWhitespace ?
			escaped :
			high < 0 ?
				// BMP codepoint
				String.fromCharCode( high + 0x10000 ) :
				// Supplemental Plane codepoint (surrogate pair)
				String.fromCharCode( high >> 10 | 0xD800, high & 0x3FF | 0xDC00 );
	};

// Optimize for push.apply( _, NodeList )
try {
	push.apply(
		(arr = slice.call( preferredDoc.childNodes )),
		preferredDoc.childNodes
	);
	// Support: Android<4.0
	// Detect silently failing push.apply
	arr[ preferredDoc.childNodes.length ].nodeType;
} catch ( e ) {
	push = { apply: arr.length ?

		// Leverage slice if possible
		function( target, els ) {
			push_native.apply( target, slice.call(els) );
		} :

		// Support: IE<9
		// Otherwise append directly
		function( target, els ) {
			var j = target.length,
				i = 0;
			// Can't trust NodeList.length
			while ( (target[j++] = els[i++]) ) {}
			target.length = j - 1;
		}
	};
}

function Sizzle( selector, context, results, seed ) {
	var match, elem, m, nodeType,
		// QSA vars
		i, groups, old, nid, newContext, newSelector;

	if ( ( context ? context.ownerDocument || context : preferredDoc ) !== document ) {
		setDocument( context );
	}

	context = context || document;
	results = results || [];

	if ( !selector || typeof selector !== "string" ) {
		return results;
	}

	if ( (nodeType = context.nodeType) !== 1 && nodeType !== 9 ) {
		return [];
	}

	if ( documentIsHTML && !seed ) {

		// Shortcuts
		if ( (match = rquickExpr.exec( selector )) ) {
			// Speed-up: Sizzle("#ID")
			if ( (m = match[1]) ) {
				if ( nodeType === 9 ) {
					elem = context.getElementById( m );
					// Check parentNode to catch when Blackberry 4.6 returns
					// nodes that are no longer in the document (jQuery #6963)
					if ( elem && elem.parentNode ) {
						// Handle the case where IE, Opera, and Webkit return items
						// by name instead of ID
						if ( elem.id === m ) {
							results.push( elem );
							return results;
						}
					} else {
						return results;
					}
				} else {
					// Context is not a document
					if ( context.ownerDocument && (elem = context.ownerDocument.getElementById( m )) &&
						contains( context, elem ) && elem.id === m ) {
						results.push( elem );
						return results;
					}
				}

			// Speed-up: Sizzle("TAG")
			} else if ( match[2] ) {
				push.apply( results, context.getElementsByTagName( selector ) );
				return results;

			// Speed-up: Sizzle(".CLASS")
			} else if ( (m = match[3]) && support.getElementsByClassName && context.getElementsByClassName ) {
				push.apply( results, context.getElementsByClassName( m ) );
				return results;
			}
		}

		// QSA path
		if ( support.qsa && (!rbuggyQSA || !rbuggyQSA.test( selector )) ) {
			nid = old = expando;
			newContext = context;
			newSelector = nodeType === 9 && selector;

			// qSA works strangely on Element-rooted queries
			// We can work around this by specifying an extra ID on the root
			// and working up from there (Thanks to Andrew Dupont for the technique)
			// IE 8 doesn't work on object elements
			if ( nodeType === 1 && context.nodeName.toLowerCase() !== "object" ) {
				groups = tokenize( selector );

				if ( (old = context.getAttribute("id")) ) {
					nid = old.replace( rescape, "\\$&" );
				} else {
					context.setAttribute( "id", nid );
				}
				nid = "[id='" + nid + "'] ";

				i = groups.length;
				while ( i-- ) {
					groups[i] = nid + toSelector( groups[i] );
				}
				newContext = rsibling.test( selector ) && testContext( context.parentNode ) || context;
				newSelector = groups.join(",");
			}

			if ( newSelector ) {
				try {
					push.apply( results,
						newContext.querySelectorAll( newSelector )
					);
					return results;
				} catch(qsaError) {
				} finally {
					if ( !old ) {
						context.removeAttribute("id");
					}
				}
			}
		}
	}

	// All others
	return select( selector.replace( rtrim, "$1" ), context, results, seed );
}

/**
 * Create key-value caches of limited size
 * @returns {Function(string, Object)} Returns the Object data after storing it on itself with
 *	property name the (space-suffixed) string and (if the cache is larger than Expr.cacheLength)
 *	deleting the oldest entry
 */
function createCache() {
	var keys = [];

	function cache( key, value ) {
		// Use (key + " ") to avoid collision with native prototype properties (see Issue #157)
		if ( keys.push( key + " " ) > Expr.cacheLength ) {
			// Only keep the most recent entries
			delete cache[ keys.shift() ];
		}
		return (cache[ key + " " ] = value);
	}
	return cache;
}

/**
 * Mark a function for special use by Sizzle
 * @param {Function} fn The function to mark
 */
function markFunction( fn ) {
	fn[ expando ] = true;
	return fn;
}

/**
 * Support testing using an element
 * @param {Function} fn Passed the created div and expects a boolean result
 */
function assert( fn ) {
	var div = document.createElement("div");

	try {
		return !!fn( div );
	} catch (e) {
		return false;
	} finally {
		// Remove from its parent by default
		if ( div.parentNode ) {
			div.parentNode.removeChild( div );
		}
		// release memory in IE
		div = null;
	}
}

/**
 * Adds the same handler for all of the specified attrs
 * @param {String} attrs Pipe-separated list of attributes
 * @param {Function} handler The method that will be applied
 */
function addHandle( attrs, handler ) {
	var arr = attrs.split("|"),
		i = attrs.length;

	while ( i-- ) {
		Expr.attrHandle[ arr[i] ] = handler;
	}
}

/**
 * Checks document order of two siblings
 * @param {Element} a
 * @param {Element} b
 * @returns {Number} Returns less than 0 if a precedes b, greater than 0 if a follows b
 */
function siblingCheck( a, b ) {
	var cur = b && a,
		diff = cur && a.nodeType === 1 && b.nodeType === 1 &&
			( ~b.sourceIndex || MAX_NEGATIVE ) -
			( ~a.sourceIndex || MAX_NEGATIVE );

	// Use IE sourceIndex if available on both nodes
	if ( diff ) {
		return diff;
	}

	// Check if b follows a
	if ( cur ) {
		while ( (cur = cur.nextSibling) ) {
			if ( cur === b ) {
				return -1;
			}
		}
	}

	return a ? 1 : -1;
}

/**
 * Returns a function to use in pseudos for input types
 * @param {String} type
 */
function createInputPseudo( type ) {
	return function( elem ) {
		var name = elem.nodeName.toLowerCase();
		return name === "input" && elem.type === type;
	};
}

/**
 * Returns a function to use in pseudos for buttons
 * @param {String} type
 */
function createButtonPseudo( type ) {
	return function( elem ) {
		var name = elem.nodeName.toLowerCase();
		return (name === "input" || name === "button") && elem.type === type;
	};
}

/**
 * Returns a function to use in pseudos for positionals
 * @param {Function} fn
 */
function createPositionalPseudo( fn ) {
	return markFunction(function( argument ) {
		argument = +argument;
		return markFunction(function( seed, matches ) {
			var j,
				matchIndexes = fn( [], seed.length, argument ),
				i = matchIndexes.length;

			// Match elements found at the specified indexes
			while ( i-- ) {
				if ( seed[ (j = matchIndexes[i]) ] ) {
					seed[j] = !(matches[j] = seed[j]);
				}
			}
		});
	});
}

/**
 * Checks a node for validity as a Sizzle context
 * @param {Element|Object=} context
 * @returns {Element|Object|Boolean} The input node if acceptable, otherwise a falsy value
 */
function testContext( context ) {
	return context && typeof context.getElementsByTagName !== strundefined && context;
}

// Expose support vars for convenience
support = Sizzle.support = {};

/**
 * Detects XML nodes
 * @param {Element|Object} elem An element or a document
 * @returns {Boolean} True iff elem is a non-HTML XML node
 */
isXML = Sizzle.isXML = function( elem ) {
	// documentElement is verified for cases where it doesn't yet exist
	// (such as loading iframes in IE - #4833)
	var documentElement = elem && (elem.ownerDocument || elem).documentElement;
	return documentElement ? documentElement.nodeName !== "HTML" : false;
};

/**
 * Sets document-related variables once based on the current document
 * @param {Element|Object} [doc] An element or document object to use to set the document
 * @returns {Object} Returns the current document
 */
setDocument = Sizzle.setDocument = function( node ) {
	var hasCompare,
		doc = node ? node.ownerDocument || node : preferredDoc,
		parent = doc.defaultView;

	// If no document and documentElement is available, return
	if ( doc === document || doc.nodeType !== 9 || !doc.documentElement ) {
		return document;
	}

	// Set our document
	document = doc;
	docElem = doc.documentElement;

	// Support tests
	documentIsHTML = !isXML( doc );

	// Support: IE>8
	// If iframe document is assigned to "document" variable and if iframe has been reloaded,
	// IE will throw "permission denied" error when accessing "document" variable, see jQuery #13936
	// IE6-8 do not support the defaultView property so parent will be undefined
	if ( parent && parent !== parent.top ) {
		// IE11 does not have attachEvent, so all must suffer
		if ( parent.addEventListener ) {
			parent.addEventListener( "unload", function() {
				setDocument();
			}, false );
		} else if ( parent.attachEvent ) {
			parent.attachEvent( "onunload", function() {
				setDocument();
			});
		}
	}

	/* Attributes
	---------------------------------------------------------------------- */

	// Support: IE<8
	// Verify that getAttribute really returns attributes and not properties (excepting IE8 booleans)
	support.attributes = assert(function( div ) {
		div.className = "i";
		return !div.getAttribute("className");
	});

	/* getElement(s)By*
	---------------------------------------------------------------------- */

	// Check if getElementsByTagName("*") returns only elements
	support.getElementsByTagName = assert(function( div ) {
		div.appendChild( doc.createComment("") );
		return !div.getElementsByTagName("*").length;
	});

	// Check if getElementsByClassName can be trusted
	support.getElementsByClassName = rnative.test( doc.getElementsByClassName ) && assert(function( div ) {
		div.innerHTML = "<div class='a'></div><div class='a i'></div>";

		// Support: Safari<4
		// Catch class over-caching
		div.firstChild.className = "i";
		// Support: Opera<10
		// Catch gEBCN failure to find non-leading classes
		return div.getElementsByClassName("i").length === 2;
	});

	// Support: IE<10
	// Check if getElementById returns elements by name
	// The broken getElementById methods don't pick up programatically-set names,
	// so use a roundabout getElementsByName test
	support.getById = assert(function( div ) {
		docElem.appendChild( div ).id = expando;
		return !doc.getElementsByName || !doc.getElementsByName( expando ).length;
	});

	// ID find and filter
	if ( support.getById ) {
		Expr.find["ID"] = function( id, context ) {
			if ( typeof context.getElementById !== strundefined && documentIsHTML ) {
				var m = context.getElementById( id );
				// Check parentNode to catch when Blackberry 4.6 returns
				// nodes that are no longer in the document #6963
				return m && m.parentNode ? [ m ] : [];
			}
		};
		Expr.filter["ID"] = function( id ) {
			var attrId = id.replace( runescape, funescape );
			return function( elem ) {
				return elem.getAttribute("id") === attrId;
			};
		};
	} else {
		// Support: IE6/7
		// getElementById is not reliable as a find shortcut
		delete Expr.find["ID"];

		Expr.filter["ID"] =  function( id ) {
			var attrId = id.replace( runescape, funescape );
			return function( elem ) {
				var node = typeof elem.getAttributeNode !== strundefined && elem.getAttributeNode("id");
				return node && node.value === attrId;
			};
		};
	}

	// Tag
	Expr.find["TAG"] = support.getElementsByTagName ?
		function( tag, context ) {
			if ( typeof context.getElementsByTagName !== strundefined ) {
				return context.getElementsByTagName( tag );
			}
		} :
		function( tag, context ) {
			var elem,
				tmp = [],
				i = 0,
				results = context.getElementsByTagName( tag );

			// Filter out possible comments
			if ( tag === "*" ) {
				while ( (elem = results[i++]) ) {
					if ( elem.nodeType === 1 ) {
						tmp.push( elem );
					}
				}

				return tmp;
			}
			return results;
		};

	// Class
	Expr.find["CLASS"] = support.getElementsByClassName && function( className, context ) {
		if ( typeof context.getElementsByClassName !== strundefined && documentIsHTML ) {
			return context.getElementsByClassName( className );
		}
	};

	/* QSA/matchesSelector
	---------------------------------------------------------------------- */

	// QSA and matchesSelector support

	// matchesSelector(:active) reports false when true (IE9/Opera 11.5)
	rbuggyMatches = [];

	// qSa(:focus) reports false when true (Chrome 21)
	// We allow this because of a bug in IE8/9 that throws an error
	// whenever `document.activeElement` is accessed on an iframe
	// So, we allow :focus to pass through QSA all the time to avoid the IE error
	// See http://bugs.jquery.com/ticket/13378
	rbuggyQSA = [];

	if ( (support.qsa = rnative.test( doc.querySelectorAll )) ) {
		// Build QSA regex
		// Regex strategy adopted from Diego Perini
		assert(function( div ) {
			// Select is set to empty string on purpose
			// This is to test IE's treatment of not explicitly
			// setting a boolean content attribute,
			// since its presence should be enough
			// http://bugs.jquery.com/ticket/12359
			div.innerHTML = "<select msallowclip=''><option selected=''></option></select>";

			// Support: IE8, Opera 11-12.16
			// Nothing should be selected when empty strings follow ^= or $= or *=
			// The test attribute must be unknown in Opera but "safe" for WinRT
			// http://msdn.microsoft.com/en-us/library/ie/hh465388.aspx#attribute_section
			if ( div.querySelectorAll("[msallowclip^='']").length ) {
				rbuggyQSA.push( "[*^$]=" + whitespace + "*(?:''|\"\")" );
			}

			// Support: IE8
			// Boolean attributes and "value" are not treated correctly
			if ( !div.querySelectorAll("[selected]").length ) {
				rbuggyQSA.push( "\\[" + whitespace + "*(?:value|" + booleans + ")" );
			}

			// Webkit/Opera - :checked should return selected option elements
			// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
			// IE8 throws error here and will not see later tests
			if ( !div.querySelectorAll(":checked").length ) {
				rbuggyQSA.push(":checked");
			}
		});

		assert(function( div ) {
			// Support: Windows 8 Native Apps
			// The type and name attributes are restricted during .innerHTML assignment
			var input = doc.createElement("input");
			input.setAttribute( "type", "hidden" );
			div.appendChild( input ).setAttribute( "name", "D" );

			// Support: IE8
			// Enforce case-sensitivity of name attribute
			if ( div.querySelectorAll("[name=d]").length ) {
				rbuggyQSA.push( "name" + whitespace + "*[*^$|!~]?=" );
			}

			// FF 3.5 - :enabled/:disabled and hidden elements (hidden elements are still enabled)
			// IE8 throws error here and will not see later tests
			if ( !div.querySelectorAll(":enabled").length ) {
				rbuggyQSA.push( ":enabled", ":disabled" );
			}

			// Opera 10-11 does not throw on post-comma invalid pseudos
			div.querySelectorAll("*,:x");
			rbuggyQSA.push(",.*:");
		});
	}

	if ( (support.matchesSelector = rnative.test( (matches = docElem.matches ||
		docElem.webkitMatchesSelector ||
		docElem.mozMatchesSelector ||
		docElem.oMatchesSelector ||
		docElem.msMatchesSelector) )) ) {

		assert(function( div ) {
			// Check to see if it's possible to do matchesSelector
			// on a disconnected node (IE 9)
			support.disconnectedMatch = matches.call( div, "div" );

			// This should fail with an exception
			// Gecko does not error, returns false instead
			matches.call( div, "[s!='']:x" );
			rbuggyMatches.push( "!=", pseudos );
		});
	}

	rbuggyQSA = rbuggyQSA.length && new RegExp( rbuggyQSA.join("|") );
	rbuggyMatches = rbuggyMatches.length && new RegExp( rbuggyMatches.join("|") );

	/* Contains
	---------------------------------------------------------------------- */
	hasCompare = rnative.test( docElem.compareDocumentPosition );

	// Element contains another
	// Purposefully does not implement inclusive descendent
	// As in, an element does not contain itself
	contains = hasCompare || rnative.test( docElem.contains ) ?
		function( a, b ) {
			var adown = a.nodeType === 9 ? a.documentElement : a,
				bup = b && b.parentNode;
			return a === bup || !!( bup && bup.nodeType === 1 && (
				adown.contains ?
					adown.contains( bup ) :
					a.compareDocumentPosition && a.compareDocumentPosition( bup ) & 16
			));
		} :
		function( a, b ) {
			if ( b ) {
				while ( (b = b.parentNode) ) {
					if ( b === a ) {
						return true;
					}
				}
			}
			return false;
		};

	/* Sorting
	---------------------------------------------------------------------- */

	// Document order sorting
	sortOrder = hasCompare ?
	function( a, b ) {

		// Flag for duplicate removal
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		// Sort on method existence if only one input has compareDocumentPosition
		var compare = !a.compareDocumentPosition - !b.compareDocumentPosition;
		if ( compare ) {
			return compare;
		}

		// Calculate position if both inputs belong to the same document
		compare = ( a.ownerDocument || a ) === ( b.ownerDocument || b ) ?
			a.compareDocumentPosition( b ) :

			// Otherwise we know they are disconnected
			1;

		// Disconnected nodes
		if ( compare & 1 ||
			(!support.sortDetached && b.compareDocumentPosition( a ) === compare) ) {

			// Choose the first element that is related to our preferred document
			if ( a === doc || a.ownerDocument === preferredDoc && contains(preferredDoc, a) ) {
				return -1;
			}
			if ( b === doc || b.ownerDocument === preferredDoc && contains(preferredDoc, b) ) {
				return 1;
			}

			// Maintain original order
			return sortInput ?
				( indexOf.call( sortInput, a ) - indexOf.call( sortInput, b ) ) :
				0;
		}

		return compare & 4 ? -1 : 1;
	} :
	function( a, b ) {
		// Exit early if the nodes are identical
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		var cur,
			i = 0,
			aup = a.parentNode,
			bup = b.parentNode,
			ap = [ a ],
			bp = [ b ];

		// Parentless nodes are either documents or disconnected
		if ( !aup || !bup ) {
			return a === doc ? -1 :
				b === doc ? 1 :
				aup ? -1 :
				bup ? 1 :
				sortInput ?
				( indexOf.call( sortInput, a ) - indexOf.call( sortInput, b ) ) :
				0;

		// If the nodes are siblings, we can do a quick check
		} else if ( aup === bup ) {
			return siblingCheck( a, b );
		}

		// Otherwise we need full lists of their ancestors for comparison
		cur = a;
		while ( (cur = cur.parentNode) ) {
			ap.unshift( cur );
		}
		cur = b;
		while ( (cur = cur.parentNode) ) {
			bp.unshift( cur );
		}

		// Walk down the tree looking for a discrepancy
		while ( ap[i] === bp[i] ) {
			i++;
		}

		return i ?
			// Do a sibling check if the nodes have a common ancestor
			siblingCheck( ap[i], bp[i] ) :

			// Otherwise nodes in our document sort first
			ap[i] === preferredDoc ? -1 :
			bp[i] === preferredDoc ? 1 :
			0;
	};

	return doc;
};

Sizzle.matches = function( expr, elements ) {
	return Sizzle( expr, null, null, elements );
};

Sizzle.matchesSelector = function( elem, expr ) {
	// Set document vars if needed
	if ( ( elem.ownerDocument || elem ) !== document ) {
		setDocument( elem );
	}

	// Make sure that attribute selectors are quoted
	expr = expr.replace( rattributeQuotes, "='$1']" );

	if ( support.matchesSelector && documentIsHTML &&
		( !rbuggyMatches || !rbuggyMatches.test( expr ) ) &&
		( !rbuggyQSA     || !rbuggyQSA.test( expr ) ) ) {

		try {
			var ret = matches.call( elem, expr );

			// IE 9's matchesSelector returns false on disconnected nodes
			if ( ret || support.disconnectedMatch ||
					// As well, disconnected nodes are said to be in a document
					// fragment in IE 9
					elem.document && elem.document.nodeType !== 11 ) {
				return ret;
			}
		} catch(e) {}
	}

	return Sizzle( expr, document, null, [ elem ] ).length > 0;
};

Sizzle.contains = function( context, elem ) {
	// Set document vars if needed
	if ( ( context.ownerDocument || context ) !== document ) {
		setDocument( context );
	}
	return contains( context, elem );
};

Sizzle.attr = function( elem, name ) {
	// Set document vars if needed
	if ( ( elem.ownerDocument || elem ) !== document ) {
		setDocument( elem );
	}

	var fn = Expr.attrHandle[ name.toLowerCase() ],
		// Don't get fooled by Object.prototype properties (jQuery #13807)
		val = fn && hasOwn.call( Expr.attrHandle, name.toLowerCase() ) ?
			fn( elem, name, !documentIsHTML ) :
			undefined;

	return val !== undefined ?
		val :
		support.attributes || !documentIsHTML ?
			elem.getAttribute( name ) :
			(val = elem.getAttributeNode(name)) && val.specified ?
				val.value :
				null;
};

Sizzle.error = function( msg ) {
	throw new Error( "Syntax error, unrecognized expression: " + msg );
};

/**
 * Document sorting and removing duplicates
 * @param {ArrayLike} results
 */
Sizzle.uniqueSort = function( results ) {
	var elem,
		duplicates = [],
		j = 0,
		i = 0;

	// Unless we *know* we can detect duplicates, assume their presence
	hasDuplicate = !support.detectDuplicates;
	sortInput = !support.sortStable && results.slice( 0 );
	results.sort( sortOrder );

	if ( hasDuplicate ) {
		while ( (elem = results[i++]) ) {
			if ( elem === results[ i ] ) {
				j = duplicates.push( i );
			}
		}
		while ( j-- ) {
			results.splice( duplicates[ j ], 1 );
		}
	}

	// Clear input after sorting to release objects
	// See https://github.com/jquery/sizzle/pull/225
	sortInput = null;

	return results;
};

/**
 * Utility function for retrieving the text value of an array of DOM nodes
 * @param {Array|Element} elem
 */
getText = Sizzle.getText = function( elem ) {
	var node,
		ret = "",
		i = 0,
		nodeType = elem.nodeType;

	if ( !nodeType ) {
		// If no nodeType, this is expected to be an array
		while ( (node = elem[i++]) ) {
			// Do not traverse comment nodes
			ret += getText( node );
		}
	} else if ( nodeType === 1 || nodeType === 9 || nodeType === 11 ) {
		// Use textContent for elements
		// innerText usage removed for consistency of new lines (jQuery #11153)
		if ( typeof elem.textContent === "string" ) {
			return elem.textContent;
		} else {
			// Traverse its children
			for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
				ret += getText( elem );
			}
		}
	} else if ( nodeType === 3 || nodeType === 4 ) {
		return elem.nodeValue;
	}
	// Do not include comment or processing instruction nodes

	return ret;
};

Expr = Sizzle.selectors = {

	// Can be adjusted by the user
	cacheLength: 50,

	createPseudo: markFunction,

	match: matchExpr,

	attrHandle: {},

	find: {},

	relative: {
		">": { dir: "parentNode", first: true },
		" ": { dir: "parentNode" },
		"+": { dir: "previousSibling", first: true },
		"~": { dir: "previousSibling" }
	},

	preFilter: {
		"ATTR": function( match ) {
			match[1] = match[1].replace( runescape, funescape );

			// Move the given value to match[3] whether quoted or unquoted
			match[3] = ( match[3] || match[4] || match[5] || "" ).replace( runescape, funescape );

			if ( match[2] === "~=" ) {
				match[3] = " " + match[3] + " ";
			}

			return match.slice( 0, 4 );
		},

		"CHILD": function( match ) {
			/* matches from matchExpr["CHILD"]
				1 type (only|nth|...)
				2 what (child|of-type)
				3 argument (even|odd|\d*|\d*n([+-]\d+)?|...)
				4 xn-component of xn+y argument ([+-]?\d*n|)
				5 sign of xn-component
				6 x of xn-component
				7 sign of y-component
				8 y of y-component
			*/
			match[1] = match[1].toLowerCase();

			if ( match[1].slice( 0, 3 ) === "nth" ) {
				// nth-* requires argument
				if ( !match[3] ) {
					Sizzle.error( match[0] );
				}

				// numeric x and y parameters for Expr.filter.CHILD
				// remember that false/true cast respectively to 0/1
				match[4] = +( match[4] ? match[5] + (match[6] || 1) : 2 * ( match[3] === "even" || match[3] === "odd" ) );
				match[5] = +( ( match[7] + match[8] ) || match[3] === "odd" );

			// other types prohibit arguments
			} else if ( match[3] ) {
				Sizzle.error( match[0] );
			}

			return match;
		},

		"PSEUDO": function( match ) {
			var excess,
				unquoted = !match[6] && match[2];

			if ( matchExpr["CHILD"].test( match[0] ) ) {
				return null;
			}

			// Accept quoted arguments as-is
			if ( match[3] ) {
				match[2] = match[4] || match[5] || "";

			// Strip excess characters from unquoted arguments
			} else if ( unquoted && rpseudo.test( unquoted ) &&
				// Get excess from tokenize (recursively)
				(excess = tokenize( unquoted, true )) &&
				// advance to the next closing parenthesis
				(excess = unquoted.indexOf( ")", unquoted.length - excess ) - unquoted.length) ) {

				// excess is a negative index
				match[0] = match[0].slice( 0, excess );
				match[2] = unquoted.slice( 0, excess );
			}

			// Return only captures needed by the pseudo filter method (type and argument)
			return match.slice( 0, 3 );
		}
	},

	filter: {

		"TAG": function( nodeNameSelector ) {
			var nodeName = nodeNameSelector.replace( runescape, funescape ).toLowerCase();
			return nodeNameSelector === "*" ?
				function() { return true; } :
				function( elem ) {
					return elem.nodeName && elem.nodeName.toLowerCase() === nodeName;
				};
		},

		"CLASS": function( className ) {
			var pattern = classCache[ className + " " ];

			return pattern ||
				(pattern = new RegExp( "(^|" + whitespace + ")" + className + "(" + whitespace + "|$)" )) &&
				classCache( className, function( elem ) {
					return pattern.test( typeof elem.className === "string" && elem.className || typeof elem.getAttribute !== strundefined && elem.getAttribute("class") || "" );
				});
		},

		"ATTR": function( name, operator, check ) {
			return function( elem ) {
				var result = Sizzle.attr( elem, name );

				if ( result == null ) {
					return operator === "!=";
				}
				if ( !operator ) {
					return true;
				}

				result += "";

				return operator === "=" ? result === check :
					operator === "!=" ? result !== check :
					operator === "^=" ? check && result.indexOf( check ) === 0 :
					operator === "*=" ? check && result.indexOf( check ) > -1 :
					operator === "$=" ? check && result.slice( -check.length ) === check :
					operator === "~=" ? ( " " + result + " " ).indexOf( check ) > -1 :
					operator === "|=" ? result === check || result.slice( 0, check.length + 1 ) === check + "-" :
					false;
			};
		},

		"CHILD": function( type, what, argument, first, last ) {
			var simple = type.slice( 0, 3 ) !== "nth",
				forward = type.slice( -4 ) !== "last",
				ofType = what === "of-type";

			return first === 1 && last === 0 ?

				// Shortcut for :nth-*(n)
				function( elem ) {
					return !!elem.parentNode;
				} :

				function( elem, context, xml ) {
					var cache, outerCache, node, diff, nodeIndex, start,
						dir = simple !== forward ? "nextSibling" : "previousSibling",
						parent = elem.parentNode,
						name = ofType && elem.nodeName.toLowerCase(),
						useCache = !xml && !ofType;

					if ( parent ) {

						// :(first|last|only)-(child|of-type)
						if ( simple ) {
							while ( dir ) {
								node = elem;
								while ( (node = node[ dir ]) ) {
									if ( ofType ? node.nodeName.toLowerCase() === name : node.nodeType === 1 ) {
										return false;
									}
								}
								// Reverse direction for :only-* (if we haven't yet done so)
								start = dir = type === "only" && !start && "nextSibling";
							}
							return true;
						}

						start = [ forward ? parent.firstChild : parent.lastChild ];

						// non-xml :nth-child(...) stores cache data on `parent`
						if ( forward && useCache ) {
							// Seek `elem` from a previously-cached index
							outerCache = parent[ expando ] || (parent[ expando ] = {});
							cache = outerCache[ type ] || [];
							nodeIndex = cache[0] === dirruns && cache[1];
							diff = cache[0] === dirruns && cache[2];
							node = nodeIndex && parent.childNodes[ nodeIndex ];

							while ( (node = ++nodeIndex && node && node[ dir ] ||

								// Fallback to seeking `elem` from the start
								(diff = nodeIndex = 0) || start.pop()) ) {

								// When found, cache indexes on `parent` and break
								if ( node.nodeType === 1 && ++diff && node === elem ) {
									outerCache[ type ] = [ dirruns, nodeIndex, diff ];
									break;
								}
							}

						// Use previously-cached element index if available
						} else if ( useCache && (cache = (elem[ expando ] || (elem[ expando ] = {}))[ type ]) && cache[0] === dirruns ) {
							diff = cache[1];

						// xml :nth-child(...) or :nth-last-child(...) or :nth(-last)?-of-type(...)
						} else {
							// Use the same loop as above to seek `elem` from the start
							while ( (node = ++nodeIndex && node && node[ dir ] ||
								(diff = nodeIndex = 0) || start.pop()) ) {

								if ( ( ofType ? node.nodeName.toLowerCase() === name : node.nodeType === 1 ) && ++diff ) {
									// Cache the index of each encountered element
									if ( useCache ) {
										(node[ expando ] || (node[ expando ] = {}))[ type ] = [ dirruns, diff ];
									}

									if ( node === elem ) {
										break;
									}
								}
							}
						}

						// Incorporate the offset, then check against cycle size
						diff -= last;
						return diff === first || ( diff % first === 0 && diff / first >= 0 );
					}
				};
		},

		"PSEUDO": function( pseudo, argument ) {
			// pseudo-class names are case-insensitive
			// http://www.w3.org/TR/selectors/#pseudo-classes
			// Prioritize by case sensitivity in case custom pseudos are added with uppercase letters
			// Remember that setFilters inherits from pseudos
			var args,
				fn = Expr.pseudos[ pseudo ] || Expr.setFilters[ pseudo.toLowerCase() ] ||
					Sizzle.error( "unsupported pseudo: " + pseudo );

			// The user may use createPseudo to indicate that
			// arguments are needed to create the filter function
			// just as Sizzle does
			if ( fn[ expando ] ) {
				return fn( argument );
			}

			// But maintain support for old signatures
			if ( fn.length > 1 ) {
				args = [ pseudo, pseudo, "", argument ];
				return Expr.setFilters.hasOwnProperty( pseudo.toLowerCase() ) ?
					markFunction(function( seed, matches ) {
						var idx,
							matched = fn( seed, argument ),
							i = matched.length;
						while ( i-- ) {
							idx = indexOf.call( seed, matched[i] );
							seed[ idx ] = !( matches[ idx ] = matched[i] );
						}
					}) :
					function( elem ) {
						return fn( elem, 0, args );
					};
			}

			return fn;
		}
	},

	pseudos: {
		// Potentially complex pseudos
		"not": markFunction(function( selector ) {
			// Trim the selector passed to compile
			// to avoid treating leading and trailing
			// spaces as combinators
			var input = [],
				results = [],
				matcher = compile( selector.replace( rtrim, "$1" ) );

			return matcher[ expando ] ?
				markFunction(function( seed, matches, context, xml ) {
					var elem,
						unmatched = matcher( seed, null, xml, [] ),
						i = seed.length;

					// Match elements unmatched by `matcher`
					while ( i-- ) {
						if ( (elem = unmatched[i]) ) {
							seed[i] = !(matches[i] = elem);
						}
					}
				}) :
				function( elem, context, xml ) {
					input[0] = elem;
					matcher( input, null, xml, results );
					return !results.pop();
				};
		}),

		"has": markFunction(function( selector ) {
			return function( elem ) {
				return Sizzle( selector, elem ).length > 0;
			};
		}),

		"contains": markFunction(function( text ) {
			return function( elem ) {
				return ( elem.textContent || elem.innerText || getText( elem ) ).indexOf( text ) > -1;
			};
		}),

		// "Whether an element is represented by a :lang() selector
		// is based solely on the element's language value
		// being equal to the identifier C,
		// or beginning with the identifier C immediately followed by "-".
		// The matching of C against the element's language value is performed case-insensitively.
		// The identifier C does not have to be a valid language name."
		// http://www.w3.org/TR/selectors/#lang-pseudo
		"lang": markFunction( function( lang ) {
			// lang value must be a valid identifier
			if ( !ridentifier.test(lang || "") ) {
				Sizzle.error( "unsupported lang: " + lang );
			}
			lang = lang.replace( runescape, funescape ).toLowerCase();
			return function( elem ) {
				var elemLang;
				do {
					if ( (elemLang = documentIsHTML ?
						elem.lang :
						elem.getAttribute("xml:lang") || elem.getAttribute("lang")) ) {

						elemLang = elemLang.toLowerCase();
						return elemLang === lang || elemLang.indexOf( lang + "-" ) === 0;
					}
				} while ( (elem = elem.parentNode) && elem.nodeType === 1 );
				return false;
			};
		}),

		// Miscellaneous
		"target": function( elem ) {
			var hash = window.location && window.location.hash;
			return hash && hash.slice( 1 ) === elem.id;
		},

		"root": function( elem ) {
			return elem === docElem;
		},

		"focus": function( elem ) {
			return elem === document.activeElement && (!document.hasFocus || document.hasFocus()) && !!(elem.type || elem.href || ~elem.tabIndex);
		},

		// Boolean properties
		"enabled": function( elem ) {
			return elem.disabled === false;
		},

		"disabled": function( elem ) {
			return elem.disabled === true;
		},

		"checked": function( elem ) {
			// In CSS3, :checked should return both checked and selected elements
			// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
			var nodeName = elem.nodeName.toLowerCase();
			return (nodeName === "input" && !!elem.checked) || (nodeName === "option" && !!elem.selected);
		},

		"selected": function( elem ) {
			// Accessing this property makes selected-by-default
			// options in Safari work properly
			if ( elem.parentNode ) {
				elem.parentNode.selectedIndex;
			}

			return elem.selected === true;
		},

		// Contents
		"empty": function( elem ) {
			// http://www.w3.org/TR/selectors/#empty-pseudo
			// :empty is negated by element (1) or content nodes (text: 3; cdata: 4; entity ref: 5),
			//   but not by others (comment: 8; processing instruction: 7; etc.)
			// nodeType < 6 works because attributes (2) do not appear as children
			for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
				if ( elem.nodeType < 6 ) {
					return false;
				}
			}
			return true;
		},

		"parent": function( elem ) {
			return !Expr.pseudos["empty"]( elem );
		},

		// Element/input types
		"header": function( elem ) {
			return rheader.test( elem.nodeName );
		},

		"input": function( elem ) {
			return rinputs.test( elem.nodeName );
		},

		"button": function( elem ) {
			var name = elem.nodeName.toLowerCase();
			return name === "input" && elem.type === "button" || name === "button";
		},

		"text": function( elem ) {
			var attr;
			return elem.nodeName.toLowerCase() === "input" &&
				elem.type === "text" &&

				// Support: IE<8
				// New HTML5 attribute values (e.g., "search") appear with elem.type === "text"
				( (attr = elem.getAttribute("type")) == null || attr.toLowerCase() === "text" );
		},

		// Position-in-collection
		"first": createPositionalPseudo(function() {
			return [ 0 ];
		}),

		"last": createPositionalPseudo(function( matchIndexes, length ) {
			return [ length - 1 ];
		}),

		"eq": createPositionalPseudo(function( matchIndexes, length, argument ) {
			return [ argument < 0 ? argument + length : argument ];
		}),

		"even": createPositionalPseudo(function( matchIndexes, length ) {
			var i = 0;
			for ( ; i < length; i += 2 ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"odd": createPositionalPseudo(function( matchIndexes, length ) {
			var i = 1;
			for ( ; i < length; i += 2 ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"lt": createPositionalPseudo(function( matchIndexes, length, argument ) {
			var i = argument < 0 ? argument + length : argument;
			for ( ; --i >= 0; ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"gt": createPositionalPseudo(function( matchIndexes, length, argument ) {
			var i = argument < 0 ? argument + length : argument;
			for ( ; ++i < length; ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		})
	}
};

Expr.pseudos["nth"] = Expr.pseudos["eq"];

// Add button/input type pseudos
for ( i in { radio: true, checkbox: true, file: true, password: true, image: true } ) {
	Expr.pseudos[ i ] = createInputPseudo( i );
}
for ( i in { submit: true, reset: true } ) {
	Expr.pseudos[ i ] = createButtonPseudo( i );
}

// Easy API for creating new setFilters
function setFilters() {}
setFilters.prototype = Expr.filters = Expr.pseudos;
Expr.setFilters = new setFilters();

tokenize = Sizzle.tokenize = function( selector, parseOnly ) {
	var matched, match, tokens, type,
		soFar, groups, preFilters,
		cached = tokenCache[ selector + " " ];

	if ( cached ) {
		return parseOnly ? 0 : cached.slice( 0 );
	}

	soFar = selector;
	groups = [];
	preFilters = Expr.preFilter;

	while ( soFar ) {

		// Comma and first run
		if ( !matched || (match = rcomma.exec( soFar )) ) {
			if ( match ) {
				// Don't consume trailing commas as valid
				soFar = soFar.slice( match[0].length ) || soFar;
			}
			groups.push( (tokens = []) );
		}

		matched = false;

		// Combinators
		if ( (match = rcombinators.exec( soFar )) ) {
			matched = match.shift();
			tokens.push({
				value: matched,
				// Cast descendant combinators to space
				type: match[0].replace( rtrim, " " )
			});
			soFar = soFar.slice( matched.length );
		}

		// Filters
		for ( type in Expr.filter ) {
			if ( (match = matchExpr[ type ].exec( soFar )) && (!preFilters[ type ] ||
				(match = preFilters[ type ]( match ))) ) {
				matched = match.shift();
				tokens.push({
					value: matched,
					type: type,
					matches: match
				});
				soFar = soFar.slice( matched.length );
			}
		}

		if ( !matched ) {
			break;
		}
	}

	// Return the length of the invalid excess
	// if we're just parsing
	// Otherwise, throw an error or return tokens
	return parseOnly ?
		soFar.length :
		soFar ?
			Sizzle.error( selector ) :
			// Cache the tokens
			tokenCache( selector, groups ).slice( 0 );
};

function toSelector( tokens ) {
	var i = 0,
		len = tokens.length,
		selector = "";
	for ( ; i < len; i++ ) {
		selector += tokens[i].value;
	}
	return selector;
}

function addCombinator( matcher, combinator, base ) {
	var dir = combinator.dir,
		checkNonElements = base && dir === "parentNode",
		doneName = done++;

	return combinator.first ?
		// Check against closest ancestor/preceding element
		function( elem, context, xml ) {
			while ( (elem = elem[ dir ]) ) {
				if ( elem.nodeType === 1 || checkNonElements ) {
					return matcher( elem, context, xml );
				}
			}
		} :

		// Check against all ancestor/preceding elements
		function( elem, context, xml ) {
			var oldCache, outerCache,
				newCache = [ dirruns, doneName ];

			// We can't set arbitrary data on XML nodes, so they don't benefit from dir caching
			if ( xml ) {
				while ( (elem = elem[ dir ]) ) {
					if ( elem.nodeType === 1 || checkNonElements ) {
						if ( matcher( elem, context, xml ) ) {
							return true;
						}
					}
				}
			} else {
				while ( (elem = elem[ dir ]) ) {
					if ( elem.nodeType === 1 || checkNonElements ) {
						outerCache = elem[ expando ] || (elem[ expando ] = {});
						if ( (oldCache = outerCache[ dir ]) &&
							oldCache[ 0 ] === dirruns && oldCache[ 1 ] === doneName ) {

							// Assign to newCache so results back-propagate to previous elements
							return (newCache[ 2 ] = oldCache[ 2 ]);
						} else {
							// Reuse newcache so results back-propagate to previous elements
							outerCache[ dir ] = newCache;

							// A match means we're done; a fail means we have to keep checking
							if ( (newCache[ 2 ] = matcher( elem, context, xml )) ) {
								return true;
							}
						}
					}
				}
			}
		};
}

function elementMatcher( matchers ) {
	return matchers.length > 1 ?
		function( elem, context, xml ) {
			var i = matchers.length;
			while ( i-- ) {
				if ( !matchers[i]( elem, context, xml ) ) {
					return false;
				}
			}
			return true;
		} :
		matchers[0];
}

function multipleContexts( selector, contexts, results ) {
	var i = 0,
		len = contexts.length;
	for ( ; i < len; i++ ) {
		Sizzle( selector, contexts[i], results );
	}
	return results;
}

function condense( unmatched, map, filter, context, xml ) {
	var elem,
		newUnmatched = [],
		i = 0,
		len = unmatched.length,
		mapped = map != null;

	for ( ; i < len; i++ ) {
		if ( (elem = unmatched[i]) ) {
			if ( !filter || filter( elem, context, xml ) ) {
				newUnmatched.push( elem );
				if ( mapped ) {
					map.push( i );
				}
			}
		}
	}

	return newUnmatched;
}

function setMatcher( preFilter, selector, matcher, postFilter, postFinder, postSelector ) {
	if ( postFilter && !postFilter[ expando ] ) {
		postFilter = setMatcher( postFilter );
	}
	if ( postFinder && !postFinder[ expando ] ) {
		postFinder = setMatcher( postFinder, postSelector );
	}
	return markFunction(function( seed, results, context, xml ) {
		var temp, i, elem,
			preMap = [],
			postMap = [],
			preexisting = results.length,

			// Get initial elements from seed or context
			elems = seed || multipleContexts( selector || "*", context.nodeType ? [ context ] : context, [] ),

			// Prefilter to get matcher input, preserving a map for seed-results synchronization
			matcherIn = preFilter && ( seed || !selector ) ?
				condense( elems, preMap, preFilter, context, xml ) :
				elems,

			matcherOut = matcher ?
				// If we have a postFinder, or filtered seed, or non-seed postFilter or preexisting results,
				postFinder || ( seed ? preFilter : preexisting || postFilter ) ?

					// ...intermediate processing is necessary
					[] :

					// ...otherwise use results directly
					results :
				matcherIn;

		// Find primary matches
		if ( matcher ) {
			matcher( matcherIn, matcherOut, context, xml );
		}

		// Apply postFilter
		if ( postFilter ) {
			temp = condense( matcherOut, postMap );
			postFilter( temp, [], context, xml );

			// Un-match failing elements by moving them back to matcherIn
			i = temp.length;
			while ( i-- ) {
				if ( (elem = temp[i]) ) {
					matcherOut[ postMap[i] ] = !(matcherIn[ postMap[i] ] = elem);
				}
			}
		}

		if ( seed ) {
			if ( postFinder || preFilter ) {
				if ( postFinder ) {
					// Get the final matcherOut by condensing this intermediate into postFinder contexts
					temp = [];
					i = matcherOut.length;
					while ( i-- ) {
						if ( (elem = matcherOut[i]) ) {
							// Restore matcherIn since elem is not yet a final match
							temp.push( (matcherIn[i] = elem) );
						}
					}
					postFinder( null, (matcherOut = []), temp, xml );
				}

				// Move matched elements from seed to results to keep them synchronized
				i = matcherOut.length;
				while ( i-- ) {
					if ( (elem = matcherOut[i]) &&
						(temp = postFinder ? indexOf.call( seed, elem ) : preMap[i]) > -1 ) {

						seed[temp] = !(results[temp] = elem);
					}
				}
			}

		// Add elements to results, through postFinder if defined
		} else {
			matcherOut = condense(
				matcherOut === results ?
					matcherOut.splice( preexisting, matcherOut.length ) :
					matcherOut
			);
			if ( postFinder ) {
				postFinder( null, results, matcherOut, xml );
			} else {
				push.apply( results, matcherOut );
			}
		}
	});
}

function matcherFromTokens( tokens ) {
	var checkContext, matcher, j,
		len = tokens.length,
		leadingRelative = Expr.relative[ tokens[0].type ],
		implicitRelative = leadingRelative || Expr.relative[" "],
		i = leadingRelative ? 1 : 0,

		// The foundational matcher ensures that elements are reachable from top-level context(s)
		matchContext = addCombinator( function( elem ) {
			return elem === checkContext;
		}, implicitRelative, true ),
		matchAnyContext = addCombinator( function( elem ) {
			return indexOf.call( checkContext, elem ) > -1;
		}, implicitRelative, true ),
		matchers = [ function( elem, context, xml ) {
			return ( !leadingRelative && ( xml || context !== outermostContext ) ) || (
				(checkContext = context).nodeType ?
					matchContext( elem, context, xml ) :
					matchAnyContext( elem, context, xml ) );
		} ];

	for ( ; i < len; i++ ) {
		if ( (matcher = Expr.relative[ tokens[i].type ]) ) {
			matchers = [ addCombinator(elementMatcher( matchers ), matcher) ];
		} else {
			matcher = Expr.filter[ tokens[i].type ].apply( null, tokens[i].matches );

			// Return special upon seeing a positional matcher
			if ( matcher[ expando ] ) {
				// Find the next relative operator (if any) for proper handling
				j = ++i;
				for ( ; j < len; j++ ) {
					if ( Expr.relative[ tokens[j].type ] ) {
						break;
					}
				}
				return setMatcher(
					i > 1 && elementMatcher( matchers ),
					i > 1 && toSelector(
						// If the preceding token was a descendant combinator, insert an implicit any-element `*`
						tokens.slice( 0, i - 1 ).concat({ value: tokens[ i - 2 ].type === " " ? "*" : "" })
					).replace( rtrim, "$1" ),
					matcher,
					i < j && matcherFromTokens( tokens.slice( i, j ) ),
					j < len && matcherFromTokens( (tokens = tokens.slice( j )) ),
					j < len && toSelector( tokens )
				);
			}
			matchers.push( matcher );
		}
	}

	return elementMatcher( matchers );
}

function matcherFromGroupMatchers( elementMatchers, setMatchers ) {
	var bySet = setMatchers.length > 0,
		byElement = elementMatchers.length > 0,
		superMatcher = function( seed, context, xml, results, outermost ) {
			var elem, j, matcher,
				matchedCount = 0,
				i = "0",
				unmatched = seed && [],
				setMatched = [],
				contextBackup = outermostContext,
				// We must always have either seed elements or outermost context
				elems = seed || byElement && Expr.find["TAG"]( "*", outermost ),
				// Use integer dirruns iff this is the outermost matcher
				dirrunsUnique = (dirruns += contextBackup == null ? 1 : Math.random() || 0.1),
				len = elems.length;

			if ( outermost ) {
				outermostContext = context !== document && context;
			}

			// Add elements passing elementMatchers directly to results
			// Keep `i` a string if there are no elements so `matchedCount` will be "00" below
			// Support: IE<9, Safari
			// Tolerate NodeList properties (IE: "length"; Safari: <number>) matching elements by id
			for ( ; i !== len && (elem = elems[i]) != null; i++ ) {
				if ( byElement && elem ) {
					j = 0;
					while ( (matcher = elementMatchers[j++]) ) {
						if ( matcher( elem, context, xml ) ) {
							results.push( elem );
							break;
						}
					}
					if ( outermost ) {
						dirruns = dirrunsUnique;
					}
				}

				// Track unmatched elements for set filters
				if ( bySet ) {
					// They will have gone through all possible matchers
					if ( (elem = !matcher && elem) ) {
						matchedCount--;
					}

					// Lengthen the array for every element, matched or not
					if ( seed ) {
						unmatched.push( elem );
					}
				}
			}

			// Apply set filters to unmatched elements
			matchedCount += i;
			if ( bySet && i !== matchedCount ) {
				j = 0;
				while ( (matcher = setMatchers[j++]) ) {
					matcher( unmatched, setMatched, context, xml );
				}

				if ( seed ) {
					// Reintegrate element matches to eliminate the need for sorting
					if ( matchedCount > 0 ) {
						while ( i-- ) {
							if ( !(unmatched[i] || setMatched[i]) ) {
								setMatched[i] = pop.call( results );
							}
						}
					}

					// Discard index placeholder values to get only actual matches
					setMatched = condense( setMatched );
				}

				// Add matches to results
				push.apply( results, setMatched );

				// Seedless set matches succeeding multiple successful matchers stipulate sorting
				if ( outermost && !seed && setMatched.length > 0 &&
					( matchedCount + setMatchers.length ) > 1 ) {

					Sizzle.uniqueSort( results );
				}
			}

			// Override manipulation of globals by nested matchers
			if ( outermost ) {
				dirruns = dirrunsUnique;
				outermostContext = contextBackup;
			}

			return unmatched;
		};

	return bySet ?
		markFunction( superMatcher ) :
		superMatcher;
}

compile = Sizzle.compile = function( selector, match /* Internal Use Only */ ) {
	var i,
		setMatchers = [],
		elementMatchers = [],
		cached = compilerCache[ selector + " " ];

	if ( !cached ) {
		// Generate a function of recursive functions that can be used to check each element
		if ( !match ) {
			match = tokenize( selector );
		}
		i = match.length;
		while ( i-- ) {
			cached = matcherFromTokens( match[i] );
			if ( cached[ expando ] ) {
				setMatchers.push( cached );
			} else {
				elementMatchers.push( cached );
			}
		}

		// Cache the compiled function
		cached = compilerCache( selector, matcherFromGroupMatchers( elementMatchers, setMatchers ) );

		// Save selector and tokenization
		cached.selector = selector;
	}
	return cached;
};

/**
 * A low-level selection function that works with Sizzle's compiled
 *  selector functions
 * @param {String|Function} selector A selector or a pre-compiled
 *  selector function built with Sizzle.compile
 * @param {Element} context
 * @param {Array} [results]
 * @param {Array} [seed] A set of elements to match against
 */
select = Sizzle.select = function( selector, context, results, seed ) {
	var i, tokens, token, type, find,
		compiled = typeof selector === "function" && selector,
		match = !seed && tokenize( (selector = compiled.selector || selector) );

	results = results || [];

	// Try to minimize operations if there is no seed and only one group
	if ( match.length === 1 ) {

		// Take a shortcut and set the context if the root selector is an ID
		tokens = match[0] = match[0].slice( 0 );
		if ( tokens.length > 2 && (token = tokens[0]).type === "ID" &&
				support.getById && context.nodeType === 9 && documentIsHTML &&
				Expr.relative[ tokens[1].type ] ) {

			context = ( Expr.find["ID"]( token.matches[0].replace(runescape, funescape), context ) || [] )[0];
			if ( !context ) {
				return results;

			// Precompiled matchers will still verify ancestry, so step up a level
			} else if ( compiled ) {
				context = context.parentNode;
			}

			selector = selector.slice( tokens.shift().value.length );
		}

		// Fetch a seed set for right-to-left matching
		i = matchExpr["needsContext"].test( selector ) ? 0 : tokens.length;
		while ( i-- ) {
			token = tokens[i];

			// Abort if we hit a combinator
			if ( Expr.relative[ (type = token.type) ] ) {
				break;
			}
			if ( (find = Expr.find[ type ]) ) {
				// Search, expanding context for leading sibling combinators
				if ( (seed = find(
					token.matches[0].replace( runescape, funescape ),
					rsibling.test( tokens[0].type ) && testContext( context.parentNode ) || context
				)) ) {

					// If seed is empty or no tokens remain, we can return early
					tokens.splice( i, 1 );
					selector = seed.length && toSelector( tokens );
					if ( !selector ) {
						push.apply( results, seed );
						return results;
					}

					break;
				}
			}
		}
	}

	// Compile and execute a filtering function if one is not provided
	// Provide `match` to avoid retokenization if we modified the selector above
	( compiled || compile( selector, match ) )(
		seed,
		context,
		!documentIsHTML,
		results,
		rsibling.test( selector ) && testContext( context.parentNode ) || context
	);
	return results;
};

// One-time assignments

// Sort stability
support.sortStable = expando.split("").sort( sortOrder ).join("") === expando;

// Support: Chrome<14
// Always assume duplicates if they aren't passed to the comparison function
support.detectDuplicates = !!hasDuplicate;

// Initialize against the default document
setDocument();

// Support: Webkit<537.32 - Safari 6.0.3/Chrome 25 (fixed in Chrome 27)
// Detached nodes confoundingly follow *each other*
support.sortDetached = assert(function( div1 ) {
	// Should return 1, but returns 4 (following)
	return div1.compareDocumentPosition( document.createElement("div") ) & 1;
});

// Support: IE<8
// Prevent attribute/property "interpolation"
// http://msdn.microsoft.com/en-us/library/ms536429%28VS.85%29.aspx
if ( !assert(function( div ) {
	div.innerHTML = "<a href='#'></a>";
	return div.firstChild.getAttribute("href") === "#" ;
}) ) {
	addHandle( "type|href|height|width", function( elem, name, isXML ) {
		if ( !isXML ) {
			return elem.getAttribute( name, name.toLowerCase() === "type" ? 1 : 2 );
		}
	});
}

// Support: IE<9
// Use defaultValue in place of getAttribute("value")
if ( !support.attributes || !assert(function( div ) {
	div.innerHTML = "<input/>";
	div.firstChild.setAttribute( "value", "" );
	return div.firstChild.getAttribute( "value" ) === "";
}) ) {
	addHandle( "value", function( elem, name, isXML ) {
		if ( !isXML && elem.nodeName.toLowerCase() === "input" ) {
			return elem.defaultValue;
		}
	});
}

// Support: IE<9
// Use getAttributeNode to fetch booleans when getAttribute lies
if ( !assert(function( div ) {
	return div.getAttribute("disabled") == null;
}) ) {
	addHandle( booleans, function( elem, name, isXML ) {
		var val;
		if ( !isXML ) {
			return elem[ name ] === true ? name.toLowerCase() :
					(val = elem.getAttributeNode( name )) && val.specified ?
					val.value :
				null;
		}
	});
}

return Sizzle;

})( window );



jQuery.find = Sizzle;
jQuery.expr = Sizzle.selectors;
jQuery.expr[":"] = jQuery.expr.pseudos;
jQuery.unique = Sizzle.uniqueSort;
jQuery.text = Sizzle.getText;
jQuery.isXMLDoc = Sizzle.isXML;
jQuery.contains = Sizzle.contains;



var rneedsContext = jQuery.expr.match.needsContext;

var rsingleTag = (/^<(\w+)\s*\/?>(?:<\/\1>|)$/);



var risSimple = /^.[^:#\[\.,]*$/;

// Implement the identical functionality for filter and not
function winnow( elements, qualifier, not ) {
	if ( jQuery.isFunction( qualifier ) ) {
		return jQuery.grep( elements, function( elem, i ) {
			/* jshint -W018 */
			return !!qualifier.call( elem, i, elem ) !== not;
		});

	}

	if ( qualifier.nodeType ) {
		return jQuery.grep( elements, function( elem ) {
			return ( elem === qualifier ) !== not;
		});

	}

	if ( typeof qualifier === "string" ) {
		if ( risSimple.test( qualifier ) ) {
			return jQuery.filter( qualifier, elements, not );
		}

		qualifier = jQuery.filter( qualifier, elements );
	}

	return jQuery.grep( elements, function( elem ) {
		return ( jQuery.inArray( elem, qualifier ) >= 0 ) !== not;
	});
}

jQuery.filter = function( expr, elems, not ) {
	var elem = elems[ 0 ];

	if ( not ) {
		expr = ":not(" + expr + ")";
	}

	return elems.length === 1 && elem.nodeType === 1 ?
		jQuery.find.matchesSelector( elem, expr ) ? [ elem ] : [] :
		jQuery.find.matches( expr, jQuery.grep( elems, function( elem ) {
			return elem.nodeType === 1;
		}));
};

jQuery.fn.extend({
	find: function( selector ) {
		var i,
			ret = [],
			self = this,
			len = self.length;

		if ( typeof selector !== "string" ) {
			return this.pushStack( jQuery( selector ).filter(function() {
				for ( i = 0; i < len; i++ ) {
					if ( jQuery.contains( self[ i ], this ) ) {
						return true;
					}
				}
			}) );
		}

		for ( i = 0; i < len; i++ ) {
			jQuery.find( selector, self[ i ], ret );
		}

		// Needed because $( selector, context ) becomes $( context ).find( selector )
		ret = this.pushStack( len > 1 ? jQuery.unique( ret ) : ret );
		ret.selector = this.selector ? this.selector + " " + selector : selector;
		return ret;
	},
	filter: function( selector ) {
		return this.pushStack( winnow(this, selector || [], false) );
	},
	not: function( selector ) {
		return this.pushStack( winnow(this, selector || [], true) );
	},
	is: function( selector ) {
		return !!winnow(
			this,

			// If this is a positional/relative selector, check membership in the returned set
			// so $("p:first").is("p:last") won't return true for a doc with two "p".
			typeof selector === "string" && rneedsContext.test( selector ) ?
				jQuery( selector ) :
				selector || [],
			false
		).length;
	}
});


// Initialize a jQuery object


// A central reference to the root jQuery(document)
var rootjQuery,

	// Use the correct document accordingly with window argument (sandbox)
	document = window.document,

	// A simple way to check for HTML strings
	// Prioritize #id over <tag> to avoid XSS via location.hash (#9521)
	// Strict HTML recognition (#11290: must start with <)
	rquickExpr = /^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]*))$/,

	init = jQuery.fn.init = function( selector, context ) {
		var match, elem;

		// HANDLE: $(""), $(null), $(undefined), $(false)
		if ( !selector ) {
			return this;
		}

		// Handle HTML strings
		if ( typeof selector === "string" ) {
			if ( selector.charAt(0) === "<" && selector.charAt( selector.length - 1 ) === ">" && selector.length >= 3 ) {
				// Assume that strings that start and end with <> are HTML and skip the regex check
				match = [ null, selector, null ];

			} else {
				match = rquickExpr.exec( selector );
			}

			// Match html or make sure no context is specified for #id
			if ( match && (match[1] || !context) ) {

				// HANDLE: $(html) -> $(array)
				if ( match[1] ) {
					context = context instanceof jQuery ? context[0] : context;

					// scripts is true for back-compat
					// Intentionally let the error be thrown if parseHTML is not present
					jQuery.merge( this, jQuery.parseHTML(
						match[1],
						context && context.nodeType ? context.ownerDocument || context : document,
						true
					) );

					// HANDLE: $(html, props)
					if ( rsingleTag.test( match[1] ) && jQuery.isPlainObject( context ) ) {
						for ( match in context ) {
							// Properties of context are called as methods if possible
							if ( jQuery.isFunction( this[ match ] ) ) {
								this[ match ]( context[ match ] );

							// ...and otherwise set as attributes
							} else {
								this.attr( match, context[ match ] );
							}
						}
					}

					return this;

				// HANDLE: $(#id)
				} else {
					elem = document.getElementById( match[2] );

					// Check parentNode to catch when Blackberry 4.6 returns
					// nodes that are no longer in the document #6963
					if ( elem && elem.parentNode ) {
						// Handle the case where IE and Opera return items
						// by name instead of ID
						if ( elem.id !== match[2] ) {
							return rootjQuery.find( selector );
						}

						// Otherwise, we inject the element directly into the jQuery object
						this.length = 1;
						this[0] = elem;
					}

					this.context = document;
					this.selector = selector;
					return this;
				}

			// HANDLE: $(expr, $(...))
			} else if ( !context || context.jquery ) {
				return ( context || rootjQuery ).find( selector );

			// HANDLE: $(expr, context)
			// (which is just equivalent to: $(context).find(expr)
			} else {
				return this.constructor( context ).find( selector );
			}

		// HANDLE: $(DOMElement)
		} else if ( selector.nodeType ) {
			this.context = this[0] = selector;
			this.length = 1;
			return this;

		// HANDLE: $(function)
		// Shortcut for document ready
		} else if ( jQuery.isFunction( selector ) ) {
			return typeof rootjQuery.ready !== "undefined" ?
				rootjQuery.ready( selector ) :
				// Execute immediately if ready is not present
				selector( jQuery );
		}

		if ( selector.selector !== undefined ) {
			this.selector = selector.selector;
			this.context = selector.context;
		}

		return jQuery.makeArray( selector, this );
	};

// Give the init function the jQuery prototype for later instantiation
init.prototype = jQuery.fn;

// Initialize central reference
rootjQuery = jQuery( document );


var rparentsprev = /^(?:parents|prev(?:Until|All))/,
	// methods guaranteed to produce a unique set when starting from a unique set
	guaranteedUnique = {
		children: true,
		contents: true,
		next: true,
		prev: true
	};

jQuery.extend({
	dir: function( elem, dir, until ) {
		var matched = [],
			cur = elem[ dir ];

		while ( cur && cur.nodeType !== 9 && (until === undefined || cur.nodeType !== 1 || !jQuery( cur ).is( until )) ) {
			if ( cur.nodeType === 1 ) {
				matched.push( cur );
			}
			cur = cur[dir];
		}
		return matched;
	},

	sibling: function( n, elem ) {
		var r = [];

		for ( ; n; n = n.nextSibling ) {
			if ( n.nodeType === 1 && n !== elem ) {
				r.push( n );
			}
		}

		return r;
	}
});

jQuery.fn.extend({
	has: function( target ) {
		var i,
			targets = jQuery( target, this ),
			len = targets.length;

		return this.filter(function() {
			for ( i = 0; i < len; i++ ) {
				if ( jQuery.contains( this, targets[i] ) ) {
					return true;
				}
			}
		});
	},

	closest: function( selectors, context ) {
		var cur,
			i = 0,
			l = this.length,
			matched = [],
			pos = rneedsContext.test( selectors ) || typeof selectors !== "string" ?
				jQuery( selectors, context || this.context ) :
				0;

		for ( ; i < l; i++ ) {
			for ( cur = this[i]; cur && cur !== context; cur = cur.parentNode ) {
				// Always skip document fragments
				if ( cur.nodeType < 11 && (pos ?
					pos.index(cur) > -1 :

					// Don't pass non-elements to Sizzle
					cur.nodeType === 1 &&
						jQuery.find.matchesSelector(cur, selectors)) ) {

					matched.push( cur );
					break;
				}
			}
		}

		return this.pushStack( matched.length > 1 ? jQuery.unique( matched ) : matched );
	},

	// Determine the position of an element within
	// the matched set of elements
	index: function( elem ) {

		// No argument, return index in parent
		if ( !elem ) {
			return ( this[0] && this[0].parentNode ) ? this.first().prevAll().length : -1;
		}

		// index in selector
		if ( typeof elem === "string" ) {
			return jQuery.inArray( this[0], jQuery( elem ) );
		}

		// Locate the position of the desired element
		return jQuery.inArray(
			// If it receives a jQuery object, the first element is used
			elem.jquery ? elem[0] : elem, this );
	},

	add: function( selector, context ) {
		return this.pushStack(
			jQuery.unique(
				jQuery.merge( this.get(), jQuery( selector, context ) )
			)
		);
	},

	addBack: function( selector ) {
		return this.add( selector == null ?
			this.prevObject : this.prevObject.filter(selector)
		);
	}
});

function sibling( cur, dir ) {
	do {
		cur = cur[ dir ];
	} while ( cur && cur.nodeType !== 1 );

	return cur;
}

jQuery.each({
	parent: function( elem ) {
		var parent = elem.parentNode;
		return parent && parent.nodeType !== 11 ? parent : null;
	},
	parents: function( elem ) {
		return jQuery.dir( elem, "parentNode" );
	},
	parentsUntil: function( elem, i, until ) {
		return jQuery.dir( elem, "parentNode", until );
	},
	next: function( elem ) {
		return sibling( elem, "nextSibling" );
	},
	prev: function( elem ) {
		return sibling( elem, "previousSibling" );
	},
	nextAll: function( elem ) {
		return jQuery.dir( elem, "nextSibling" );
	},
	prevAll: function( elem ) {
		return jQuery.dir( elem, "previousSibling" );
	},
	nextUntil: function( elem, i, until ) {
		return jQuery.dir( elem, "nextSibling", until );
	},
	prevUntil: function( elem, i, until ) {
		return jQuery.dir( elem, "previousSibling", until );
	},
	siblings: function( elem ) {
		return jQuery.sibling( ( elem.parentNode || {} ).firstChild, elem );
	},
	children: function( elem ) {
		return jQuery.sibling( elem.firstChild );
	},
	contents: function( elem ) {
		return jQuery.nodeName( elem, "iframe" ) ?
			elem.contentDocument || elem.contentWindow.document :
			jQuery.merge( [], elem.childNodes );
	}
}, function( name, fn ) {
	jQuery.fn[ name ] = function( until, selector ) {
		var ret = jQuery.map( this, fn, until );

		if ( name.slice( -5 ) !== "Until" ) {
			selector = until;
		}

		if ( selector && typeof selector === "string" ) {
			ret = jQuery.filter( selector, ret );
		}

		if ( this.length > 1 ) {
			// Remove duplicates
			if ( !guaranteedUnique[ name ] ) {
				ret = jQuery.unique( ret );
			}

			// Reverse order for parents* and prev-derivatives
			if ( rparentsprev.test( name ) ) {
				ret = ret.reverse();
			}
		}

		return this.pushStack( ret );
	};
});
var rnotwhite = (/\S+/g);



// String to Object options format cache
var optionsCache = {};

// Convert String-formatted options into Object-formatted ones and store in cache
function createOptions( options ) {
	var object = optionsCache[ options ] = {};
	jQuery.each( options.match( rnotwhite ) || [], function( _, flag ) {
		object[ flag ] = true;
	});
	return object;
}

/*
 * Create a callback list using the following parameters:
 *
 *	options: an optional list of space-separated options that will change how
 *			the callback list behaves or a more traditional option object
 *
 * By default a callback list will act like an event callback list and can be
 * "fired" multiple times.
 *
 * Possible options:
 *
 *	once:			will ensure the callback list can only be fired once (like a Deferred)
 *
 *	memory:			will keep track of previous values and will call any callback added
 *					after the list has been fired right away with the latest "memorized"
 *					values (like a Deferred)
 *
 *	unique:			will ensure a callback can only be added once (no duplicate in the list)
 *
 *	stopOnFalse:	interrupt callings when a callback returns false
 *
 */
jQuery.Callbacks = function( options ) {

	// Convert options from String-formatted to Object-formatted if needed
	// (we check in cache first)
	options = typeof options === "string" ?
		( optionsCache[ options ] || createOptions( options ) ) :
		jQuery.extend( {}, options );

	var // Flag to know if list is currently firing
		firing,
		// Last fire value (for non-forgettable lists)
		memory,
		// Flag to know if list was already fired
		fired,
		// End of the loop when firing
		firingLength,
		// Index of currently firing callback (modified by remove if needed)
		firingIndex,
		// First callback to fire (used internally by add and fireWith)
		firingStart,
		// Actual callback list
		list = [],
		// Stack of fire calls for repeatable lists
		stack = !options.once && [],
		// Fire callbacks
		fire = function( data ) {
			memory = options.memory && data;
			fired = true;
			firingIndex = firingStart || 0;
			firingStart = 0;
			firingLength = list.length;
			firing = true;
			for ( ; list && firingIndex < firingLength; firingIndex++ ) {
				if ( list[ firingIndex ].apply( data[ 0 ], data[ 1 ] ) === false && options.stopOnFalse ) {
					memory = false; // To prevent further calls using add
					break;
				}
			}
			firing = false;
			if ( list ) {
				if ( stack ) {
					if ( stack.length ) {
						fire( stack.shift() );
					}
				} else if ( memory ) {
					list = [];
				} else {
					self.disable();
				}
			}
		},
		// Actual Callbacks object
		self = {
			// Add a callback or a collection of callbacks to the list
			add: function() {
				if ( list ) {
					// First, we save the current length
					var start = list.length;
					(function add( args ) {
						jQuery.each( args, function( _, arg ) {
							var type = jQuery.type( arg );
							if ( type === "function" ) {
								if ( !options.unique || !self.has( arg ) ) {
									list.push( arg );
								}
							} else if ( arg && arg.length && type !== "string" ) {
								// Inspect recursively
								add( arg );
							}
						});
					})( arguments );
					// Do we need to add the callbacks to the
					// current firing batch?
					if ( firing ) {
						firingLength = list.length;
					// With memory, if we're not firing then
					// we should call right away
					} else if ( memory ) {
						firingStart = start;
						fire( memory );
					}
				}
				return this;
			},
			// Remove a callback from the list
			remove: function() {
				if ( list ) {
					jQuery.each( arguments, function( _, arg ) {
						var index;
						while ( ( index = jQuery.inArray( arg, list, index ) ) > -1 ) {
							list.splice( index, 1 );
							// Handle firing indexes
							if ( firing ) {
								if ( index <= firingLength ) {
									firingLength--;
								}
								if ( index <= firingIndex ) {
									firingIndex--;
								}
							}
						}
					});
				}
				return this;
			},
			// Check if a given callback is in the list.
			// If no argument is given, return whether or not list has callbacks attached.
			has: function( fn ) {
				return fn ? jQuery.inArray( fn, list ) > -1 : !!( list && list.length );
			},
			// Remove all callbacks from the list
			empty: function() {
				list = [];
				firingLength = 0;
				return this;
			},
			// Have the list do nothing anymore
			disable: function() {
				list = stack = memory = undefined;
				return this;
			},
			// Is it disabled?
			disabled: function() {
				return !list;
			},
			// Lock the list in its current state
			lock: function() {
				stack = undefined;
				if ( !memory ) {
					self.disable();
				}
				return this;
			},
			// Is it locked?
			locked: function() {
				return !stack;
			},
			// Call all callbacks with the given context and arguments
			fireWith: function( context, args ) {
				if ( list && ( !fired || stack ) ) {
					args = args || [];
					args = [ context, args.slice ? args.slice() : args ];
					if ( firing ) {
						stack.push( args );
					} else {
						fire( args );
					}
				}
				return this;
			},
			// Call all the callbacks with the given arguments
			fire: function() {
				self.fireWith( this, arguments );
				return this;
			},
			// To know if the callbacks have already been called at least once
			fired: function() {
				return !!fired;
			}
		};

	return self;
};


jQuery.extend({

	Deferred: function( func ) {
		var tuples = [
				// action, add listener, listener list, final state
				[ "resolve", "done", jQuery.Callbacks("once memory"), "resolved" ],
				[ "reject", "fail", jQuery.Callbacks("once memory"), "rejected" ],
				[ "notify", "progress", jQuery.Callbacks("memory") ]
			],
			state = "pending",
			promise = {
				state: function() {
					return state;
				},
				always: function() {
					deferred.done( arguments ).fail( arguments );
					return this;
				},
				then: function( /* fnDone, fnFail, fnProgress */ ) {
					var fns = arguments;
					return jQuery.Deferred(function( newDefer ) {
						jQuery.each( tuples, function( i, tuple ) {
							var fn = jQuery.isFunction( fns[ i ] ) && fns[ i ];
							// deferred[ done | fail | progress ] for forwarding actions to newDefer
							deferred[ tuple[1] ](function() {
								var returned = fn && fn.apply( this, arguments );
								if ( returned && jQuery.isFunction( returned.promise ) ) {
									returned.promise()
										.done( newDefer.resolve )
										.fail( newDefer.reject )
										.progress( newDefer.notify );
								} else {
									newDefer[ tuple[ 0 ] + "With" ]( this === promise ? newDefer.promise() : this, fn ? [ returned ] : arguments );
								}
							});
						});
						fns = null;
					}).promise();
				},
				// Get a promise for this deferred
				// If obj is provided, the promise aspect is added to the object
				promise: function( obj ) {
					return obj != null ? jQuery.extend( obj, promise ) : promise;
				}
			},
			deferred = {};

		// Keep pipe for back-compat
		promise.pipe = promise.then;

		// Add list-specific methods
		jQuery.each( tuples, function( i, tuple ) {
			var list = tuple[ 2 ],
				stateString = tuple[ 3 ];

			// promise[ done | fail | progress ] = list.add
			promise[ tuple[1] ] = list.add;

			// Handle state
			if ( stateString ) {
				list.add(function() {
					// state = [ resolved | rejected ]
					state = stateString;

				// [ reject_list | resolve_list ].disable; progress_list.lock
				}, tuples[ i ^ 1 ][ 2 ].disable, tuples[ 2 ][ 2 ].lock );
			}

			// deferred[ resolve | reject | notify ]
			deferred[ tuple[0] ] = function() {
				deferred[ tuple[0] + "With" ]( this === deferred ? promise : this, arguments );
				return this;
			};
			deferred[ tuple[0] + "With" ] = list.fireWith;
		});

		// Make the deferred a promise
		promise.promise( deferred );

		// Call given func if any
		if ( func ) {
			func.call( deferred, deferred );
		}

		// All done!
		return deferred;
	},

	// Deferred helper
	when: function( subordinate /* , ..., subordinateN */ ) {
		var i = 0,
			resolveValues = slice.call( arguments ),
			length = resolveValues.length,

			// the count of uncompleted subordinates
			remaining = length !== 1 || ( subordinate && jQuery.isFunction( subordinate.promise ) ) ? length : 0,

			// the master Deferred. If resolveValues consist of only a single Deferred, just use that.
			deferred = remaining === 1 ? subordinate : jQuery.Deferred(),

			// Update function for both resolve and progress values
			updateFunc = function( i, contexts, values ) {
				return function( value ) {
					contexts[ i ] = this;
					values[ i ] = arguments.length > 1 ? slice.call( arguments ) : value;
					if ( values === progressValues ) {
						deferred.notifyWith( contexts, values );

					} else if ( !(--remaining) ) {
						deferred.resolveWith( contexts, values );
					}
				};
			},

			progressValues, progressContexts, resolveContexts;

		// add listeners to Deferred subordinates; treat others as resolved
		if ( length > 1 ) {
			progressValues = new Array( length );
			progressContexts = new Array( length );
			resolveContexts = new Array( length );
			for ( ; i < length; i++ ) {
				if ( resolveValues[ i ] && jQuery.isFunction( resolveValues[ i ].promise ) ) {
					resolveValues[ i ].promise()
						.done( updateFunc( i, resolveContexts, resolveValues ) )
						.fail( deferred.reject )
						.progress( updateFunc( i, progressContexts, progressValues ) );
				} else {
					--remaining;
				}
			}
		}

		// if we're not waiting on anything, resolve the master
		if ( !remaining ) {
			deferred.resolveWith( resolveContexts, resolveValues );
		}

		return deferred.promise();
	}
});


// The deferred used on DOM ready
var readyList;

jQuery.fn.ready = function( fn ) {
	// Add the callback
	jQuery.ready.promise().done( fn );

	return this;
};

jQuery.extend({
	// Is the DOM ready to be used? Set to true once it occurs.
	isReady: false,

	// A counter to track how many items to wait for before
	// the ready event fires. See #6781
	readyWait: 1,

	// Hold (or release) the ready event
	holdReady: function( hold ) {
		if ( hold ) {
			jQuery.readyWait++;
		} else {
			jQuery.ready( true );
		}
	},

	// Handle when the DOM is ready
	ready: function( wait ) {

		// Abort if there are pending holds or we're already ready
		if ( wait === true ? --jQuery.readyWait : jQuery.isReady ) {
			return;
		}

		// Make sure body exists, at least, in case IE gets a little overzealous (ticket #5443).
		if ( !document.body ) {
			return setTimeout( jQuery.ready );
		}

		// Remember that the DOM is ready
		jQuery.isReady = true;

		// If a normal DOM Ready event fired, decrement, and wait if need be
		if ( wait !== true && --jQuery.readyWait > 0 ) {
			return;
		}

		// If there are functions bound, to execute
		readyList.resolveWith( document, [ jQuery ] );

		// Trigger any bound ready events
		if ( jQuery.fn.triggerHandler ) {
			jQuery( document ).triggerHandler( "ready" );
			jQuery( document ).off( "ready" );
		}
	}
});

/**
 * Clean-up method for dom ready events
 */
function detach() {
	if ( document.addEventListener ) {
		document.removeEventListener( "DOMContentLoaded", completed, false );
		window.removeEventListener( "load", completed, false );

	} else {
		document.detachEvent( "onreadystatechange", completed );
		window.detachEvent( "onload", completed );
	}
}

/**
 * The ready event handler and self cleanup method
 */
function completed() {
	// readyState === "complete" is good enough for us to call the dom ready in oldIE
	if ( document.addEventListener || event.type === "load" || document.readyState === "complete" ) {
		detach();
		jQuery.ready();
	}
}

jQuery.ready.promise = function( obj ) {
	if ( !readyList ) {

		readyList = jQuery.Deferred();

		// Catch cases where $(document).ready() is called after the browser event has already occurred.
		// we once tried to use readyState "interactive" here, but it caused issues like the one
		// discovered by ChrisS here: http://bugs.jquery.com/ticket/12282#comment:15
		if ( document.readyState === "complete" ) {
			// Handle it asynchronously to allow scripts the opportunity to delay ready
			setTimeout( jQuery.ready );

		// Standards-based browsers support DOMContentLoaded
		} else if ( document.addEventListener ) {
			// Use the handy event callback
			document.addEventListener( "DOMContentLoaded", completed, false );

			// A fallback to window.onload, that will always work
			window.addEventListener( "load", completed, false );

		// If IE event model is used
		} else {
			// Ensure firing before onload, maybe late but safe also for iframes
			document.attachEvent( "onreadystatechange", completed );

			// A fallback to window.onload, that will always work
			window.attachEvent( "onload", completed );

			// If IE and not a frame
			// continually check to see if the document is ready
			var top = false;

			try {
				top = window.frameElement == null && document.documentElement;
			} catch(e) {}

			if ( top && top.doScroll ) {
				(function doScrollCheck() {
					if ( !jQuery.isReady ) {

						try {
							// Use the trick by Diego Perini
							// http://javascript.nwbox.com/IEContentLoaded/
							top.doScroll("left");
						} catch(e) {
							return setTimeout( doScrollCheck, 50 );
						}

						// detach all dom ready events
						detach();

						// and execute any waiting functions
						jQuery.ready();
					}
				})();
			}
		}
	}
	return readyList.promise( obj );
};


var strundefined = typeof undefined;



// Support: IE<9
// Iteration over object's inherited properties before its own
var i;
for ( i in jQuery( support ) ) {
	break;
}
support.ownLast = i !== "0";

// Note: most support tests are defined in their respective modules.
// false until the test is run
support.inlineBlockNeedsLayout = false;

// Execute ASAP in case we need to set body.style.zoom
jQuery(function() {
	// Minified: var a,b,c,d
	var val, div, body, container;

	body = document.getElementsByTagName( "body" )[ 0 ];
	if ( !body || !body.style ) {
		// Return for frameset docs that don't have a body
		return;
	}

	// Setup
	div = document.createElement( "div" );
	container = document.createElement( "div" );
	container.style.cssText = "position:absolute;border:0;width:0;height:0;top:0;left:-9999px";
	body.appendChild( container ).appendChild( div );

	if ( typeof div.style.zoom !== strundefined ) {
		// Support: IE<8
		// Check if natively block-level elements act like inline-block
		// elements when setting their display to 'inline' and giving
		// them layout
		div.style.cssText = "display:inline;margin:0;border:0;padding:1px;width:1px;zoom:1";

		support.inlineBlockNeedsLayout = val = div.offsetWidth === 3;
		if ( val ) {
			// Prevent IE 6 from affecting layout for positioned elements #11048
			// Prevent IE from shrinking the body in IE 7 mode #12869
			// Support: IE<8
			body.style.zoom = 1;
		}
	}

	body.removeChild( container );
});




(function() {
	var div = document.createElement( "div" );

	// Execute the test only if not already executed in another module.
	if (support.deleteExpando == null) {
		// Support: IE<9
		support.deleteExpando = true;
		try {
			delete div.test;
		} catch( e ) {
			support.deleteExpando = false;
		}
	}

	// Null elements to avoid leaks in IE.
	div = null;
})();


/**
 * Determines whether an object can have data
 */
jQuery.acceptData = function( elem ) {
	var noData = jQuery.noData[ (elem.nodeName + " ").toLowerCase() ],
		nodeType = +elem.nodeType || 1;

	// Do not set data on non-element DOM nodes because it will not be cleared (#8335).
	return nodeType !== 1 && nodeType !== 9 ?
		false :

		// Nodes accept data unless otherwise specified; rejection can be conditional
		!noData || noData !== true && elem.getAttribute("classid") === noData;
};


var rbrace = /^(?:\{[\w\W]*\}|\[[\w\W]*\])$/,
	rmultiDash = /([A-Z])/g;

function dataAttr( elem, key, data ) {
	// If nothing was found internally, try to fetch any
	// data from the HTML5 data-* attribute
	if ( data === undefined && elem.nodeType === 1 ) {

		var name = "data-" + key.replace( rmultiDash, "-$1" ).toLowerCase();

		data = elem.getAttribute( name );

		if ( typeof data === "string" ) {
			try {
				data = data === "true" ? true :
					data === "false" ? false :
					data === "null" ? null :
					// Only convert to a number if it doesn't change the string
					+data + "" === data ? +data :
					rbrace.test( data ) ? jQuery.parseJSON( data ) :
					data;
			} catch( e ) {}

			// Make sure we set the data so it isn't changed later
			jQuery.data( elem, key, data );

		} else {
			data = undefined;
		}
	}

	return data;
}

// checks a cache object for emptiness
function isEmptyDataObject( obj ) {
	var name;
	for ( name in obj ) {

		// if the public data object is empty, the private is still empty
		if ( name === "data" && jQuery.isEmptyObject( obj[name] ) ) {
			continue;
		}
		if ( name !== "toJSON" ) {
			return false;
		}
	}

	return true;
}

function internalData( elem, name, data, pvt /* Internal Use Only */ ) {
	if ( !jQuery.acceptData( elem ) ) {
		return;
	}

	var ret, thisCache,
		internalKey = jQuery.expando,

		// We have to handle DOM nodes and JS objects differently because IE6-7
		// can't GC object references properly across the DOM-JS boundary
		isNode = elem.nodeType,

		// Only DOM nodes need the global jQuery cache; JS object data is
		// attached directly to the object so GC can occur automatically
		cache = isNode ? jQuery.cache : elem,

		// Only defining an ID for JS objects if its cache already exists allows
		// the code to shortcut on the same path as a DOM node with no cache
		id = isNode ? elem[ internalKey ] : elem[ internalKey ] && internalKey;

	// Avoid doing any more work than we need to when trying to get data on an
	// object that has no data at all
	if ( (!id || !cache[id] || (!pvt && !cache[id].data)) && data === undefined && typeof name === "string" ) {
		return;
	}

	if ( !id ) {
		// Only DOM nodes need a new unique ID for each element since their data
		// ends up in the global cache
		if ( isNode ) {
			id = elem[ internalKey ] = deletedIds.pop() || jQuery.guid++;
		} else {
			id = internalKey;
		}
	}

	if ( !cache[ id ] ) {
		// Avoid exposing jQuery metadata on plain JS objects when the object
		// is serialized using JSON.stringify
		cache[ id ] = isNode ? {} : { toJSON: jQuery.noop };
	}

	// An object can be passed to jQuery.data instead of a key/value pair; this gets
	// shallow copied over onto the existing cache
	if ( typeof name === "object" || typeof name === "function" ) {
		if ( pvt ) {
			cache[ id ] = jQuery.extend( cache[ id ], name );
		} else {
			cache[ id ].data = jQuery.extend( cache[ id ].data, name );
		}
	}

	thisCache = cache[ id ];

	// jQuery data() is stored in a separate object inside the object's internal data
	// cache in order to avoid key collisions between internal data and user-defined
	// data.
	if ( !pvt ) {
		if ( !thisCache.data ) {
			thisCache.data = {};
		}

		thisCache = thisCache.data;
	}

	if ( data !== undefined ) {
		thisCache[ jQuery.camelCase( name ) ] = data;
	}

	// Check for both converted-to-camel and non-converted data property names
	// If a data property was specified
	if ( typeof name === "string" ) {

		// First Try to find as-is property data
		ret = thisCache[ name ];

		// Test for null|undefined property data
		if ( ret == null ) {

			// Try to find the camelCased property
			ret = thisCache[ jQuery.camelCase( name ) ];
		}
	} else {
		ret = thisCache;
	}

	return ret;
}

function internalRemoveData( elem, name, pvt ) {
	if ( !jQuery.acceptData( elem ) ) {
		return;
	}

	var thisCache, i,
		isNode = elem.nodeType,

		// See jQuery.data for more information
		cache = isNode ? jQuery.cache : elem,
		id = isNode ? elem[ jQuery.expando ] : jQuery.expando;

	// If there is already no cache entry for this object, there is no
	// purpose in continuing
	if ( !cache[ id ] ) {
		return;
	}

	if ( name ) {

		thisCache = pvt ? cache[ id ] : cache[ id ].data;

		if ( thisCache ) {

			// Support array or space separated string names for data keys
			if ( !jQuery.isArray( name ) ) {

				// try the string as a key before any manipulation
				if ( name in thisCache ) {
					name = [ name ];
				} else {

					// split the camel cased version by spaces unless a key with the spaces exists
					name = jQuery.camelCase( name );
					if ( name in thisCache ) {
						name = [ name ];
					} else {
						name = name.split(" ");
					}
				}
			} else {
				// If "name" is an array of keys...
				// When data is initially created, via ("key", "val") signature,
				// keys will be converted to camelCase.
				// Since there is no way to tell _how_ a key was added, remove
				// both plain key and camelCase key. #12786
				// This will only penalize the array argument path.
				name = name.concat( jQuery.map( name, jQuery.camelCase ) );
			}

			i = name.length;
			while ( i-- ) {
				delete thisCache[ name[i] ];
			}

			// If there is no data left in the cache, we want to continue
			// and let the cache object itself get destroyed
			if ( pvt ? !isEmptyDataObject(thisCache) : !jQuery.isEmptyObject(thisCache) ) {
				return;
			}
		}
	}

	// See jQuery.data for more information
	if ( !pvt ) {
		delete cache[ id ].data;

		// Don't destroy the parent cache unless the internal data object
		// had been the only thing left in it
		if ( !isEmptyDataObject( cache[ id ] ) ) {
			return;
		}
	}

	// Destroy the cache
	if ( isNode ) {
		jQuery.cleanData( [ elem ], true );

	// Use delete when supported for expandos or `cache` is not a window per isWindow (#10080)
	/* jshint eqeqeq: false */
	} else if ( support.deleteExpando || cache != cache.window ) {
		/* jshint eqeqeq: true */
		delete cache[ id ];

	// When all else fails, null
	} else {
		cache[ id ] = null;
	}
}

jQuery.extend({
	cache: {},

	// The following elements (space-suffixed to avoid Object.prototype collisions)
	// throw uncatchable exceptions if you attempt to set expando properties
	noData: {
		"applet ": true,
		"embed ": true,
		// ...but Flash objects (which have this classid) *can* handle expandos
		"object ": "clsid:D27CDB6E-AE6D-11cf-96B8-444553540000"
	},

	hasData: function( elem ) {
		elem = elem.nodeType ? jQuery.cache[ elem[jQuery.expando] ] : elem[ jQuery.expando ];
		return !!elem && !isEmptyDataObject( elem );
	},

	data: function( elem, name, data ) {
		return internalData( elem, name, data );
	},

	removeData: function( elem, name ) {
		return internalRemoveData( elem, name );
	},

	// For internal use only.
	_data: function( elem, name, data ) {
		return internalData( elem, name, data, true );
	},

	_removeData: function( elem, name ) {
		return internalRemoveData( elem, name, true );
	}
});

jQuery.fn.extend({
	data: function( key, value ) {
		var i, name, data,
			elem = this[0],
			attrs = elem && elem.attributes;

		// Special expections of .data basically thwart jQuery.access,
		// so implement the relevant behavior ourselves

		// Gets all values
		if ( key === undefined ) {
			if ( this.length ) {
				data = jQuery.data( elem );

				if ( elem.nodeType === 1 && !jQuery._data( elem, "parsedAttrs" ) ) {
					i = attrs.length;
					while ( i-- ) {

						// Support: IE11+
						// The attrs elements can be null (#14894)
						if ( attrs[ i ] ) {
							name = attrs[ i ].name;
							if ( name.indexOf( "data-" ) === 0 ) {
								name = jQuery.camelCase( name.slice(5) );
								dataAttr( elem, name, data[ name ] );
							}
						}
					}
					jQuery._data( elem, "parsedAttrs", true );
				}
			}

			return data;
		}

		// Sets multiple values
		if ( typeof key === "object" ) {
			return this.each(function() {
				jQuery.data( this, key );
			});
		}

		return arguments.length > 1 ?

			// Sets one value
			this.each(function() {
				jQuery.data( this, key, value );
			}) :

			// Gets one value
			// Try to fetch any internally stored data first
			elem ? dataAttr( elem, key, jQuery.data( elem, key ) ) : undefined;
	},

	removeData: function( key ) {
		return this.each(function() {
			jQuery.removeData( this, key );
		});
	}
});


jQuery.extend({
	queue: function( elem, type, data ) {
		var queue;

		if ( elem ) {
			type = ( type || "fx" ) + "queue";
			queue = jQuery._data( elem, type );

			// Speed up dequeue by getting out quickly if this is just a lookup
			if ( data ) {
				if ( !queue || jQuery.isArray(data) ) {
					queue = jQuery._data( elem, type, jQuery.makeArray(data) );
				} else {
					queue.push( data );
				}
			}
			return queue || [];
		}
	},

	dequeue: function( elem, type ) {
		type = type || "fx";

		var queue = jQuery.queue( elem, type ),
			startLength = queue.length,
			fn = queue.shift(),
			hooks = jQuery._queueHooks( elem, type ),
			next = function() {
				jQuery.dequeue( elem, type );
			};

		// If the fx queue is dequeued, always remove the progress sentinel
		if ( fn === "inprogress" ) {
			fn = queue.shift();
			startLength--;
		}

		if ( fn ) {

			// Add a progress sentinel to prevent the fx queue from being
			// automatically dequeued
			if ( type === "fx" ) {
				queue.unshift( "inprogress" );
			}

			// clear up the last queue stop function
			delete hooks.stop;
			fn.call( elem, next, hooks );
		}

		if ( !startLength && hooks ) {
			hooks.empty.fire();
		}
	},

	// not intended for public consumption - generates a queueHooks object, or returns the current one
	_queueHooks: function( elem, type ) {
		var key = type + "queueHooks";
		return jQuery._data( elem, key ) || jQuery._data( elem, key, {
			empty: jQuery.Callbacks("once memory").add(function() {
				jQuery._removeData( elem, type + "queue" );
				jQuery._removeData( elem, key );
			})
		});
	}
});

jQuery.fn.extend({
	queue: function( type, data ) {
		var setter = 2;

		if ( typeof type !== "string" ) {
			data = type;
			type = "fx";
			setter--;
		}

		if ( arguments.length < setter ) {
			return jQuery.queue( this[0], type );
		}

		return data === undefined ?
			this :
			this.each(function() {
				var queue = jQuery.queue( this, type, data );

				// ensure a hooks for this queue
				jQuery._queueHooks( this, type );

				if ( type === "fx" && queue[0] !== "inprogress" ) {
					jQuery.dequeue( this, type );
				}
			});
	},
	dequeue: function( type ) {
		return this.each(function() {
			jQuery.dequeue( this, type );
		});
	},
	clearQueue: function( type ) {
		return this.queue( type || "fx", [] );
	},
	// Get a promise resolved when queues of a certain type
	// are emptied (fx is the type by default)
	promise: function( type, obj ) {
		var tmp,
			count = 1,
			defer = jQuery.Deferred(),
			elements = this,
			i = this.length,
			resolve = function() {
				if ( !( --count ) ) {
					defer.resolveWith( elements, [ elements ] );
				}
			};

		if ( typeof type !== "string" ) {
			obj = type;
			type = undefined;
		}
		type = type || "fx";

		while ( i-- ) {
			tmp = jQuery._data( elements[ i ], type + "queueHooks" );
			if ( tmp && tmp.empty ) {
				count++;
				tmp.empty.add( resolve );
			}
		}
		resolve();
		return defer.promise( obj );
	}
});
var pnum = (/[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/).source;

var cssExpand = [ "Top", "Right", "Bottom", "Left" ];

var isHidden = function( elem, el ) {
		// isHidden might be called from jQuery#filter function;
		// in that case, element will be second argument
		elem = el || elem;
		return jQuery.css( elem, "display" ) === "none" || !jQuery.contains( elem.ownerDocument, elem );
	};



// Multifunctional method to get and set values of a collection
// The value/s can optionally be executed if it's a function
var access = jQuery.access = function( elems, fn, key, value, chainable, emptyGet, raw ) {
	var i = 0,
		length = elems.length,
		bulk = key == null;

	// Sets many values
	if ( jQuery.type( key ) === "object" ) {
		chainable = true;
		for ( i in key ) {
			jQuery.access( elems, fn, i, key[i], true, emptyGet, raw );
		}

	// Sets one value
	} else if ( value !== undefined ) {
		chainable = true;

		if ( !jQuery.isFunction( value ) ) {
			raw = true;
		}

		if ( bulk ) {
			// Bulk operations run against the entire set
			if ( raw ) {
				fn.call( elems, value );
				fn = null;

			// ...except when executing function values
			} else {
				bulk = fn;
				fn = function( elem, key, value ) {
					return bulk.call( jQuery( elem ), value );
				};
			}
		}

		if ( fn ) {
			for ( ; i < length; i++ ) {
				fn( elems[i], key, raw ? value : value.call( elems[i], i, fn( elems[i], key ) ) );
			}
		}
	}

	return chainable ?
		elems :

		// Gets
		bulk ?
			fn.call( elems ) :
			length ? fn( elems[0], key ) : emptyGet;
};
var rcheckableType = (/^(?:checkbox|radio)$/i);



(function() {
	// Minified: var a,b,c
	var input = document.createElement( "input" ),
		div = document.createElement( "div" ),
		fragment = document.createDocumentFragment();

	// Setup
	div.innerHTML = "  <link/><table></table><a href='/a'>a</a><input type='checkbox'/>";

	// IE strips leading whitespace when .innerHTML is used
	support.leadingWhitespace = div.firstChild.nodeType === 3;

	// Make sure that tbody elements aren't automatically inserted
	// IE will insert them into empty tables
	support.tbody = !div.getElementsByTagName( "tbody" ).length;

	// Make sure that link elements get serialized correctly by innerHTML
	// This requires a wrapper element in IE
	support.htmlSerialize = !!div.getElementsByTagName( "link" ).length;

	// Makes sure cloning an html5 element does not cause problems
	// Where outerHTML is undefined, this still works
	support.html5Clone =
		document.createElement( "nav" ).cloneNode( true ).outerHTML !== "<:nav></:nav>";

	// Check if a disconnected checkbox will retain its checked
	// value of true after appended to the DOM (IE6/7)
	input.type = "checkbox";
	input.checked = true;
	fragment.appendChild( input );
	support.appendChecked = input.checked;

	// Make sure textarea (and checkbox) defaultValue is properly cloned
	// Support: IE6-IE11+
	div.innerHTML = "<textarea>x</textarea>";
	support.noCloneChecked = !!div.cloneNode( true ).lastChild.defaultValue;

	// #11217 - WebKit loses check when the name is after the checked attribute
	fragment.appendChild( div );
	div.innerHTML = "<input type='radio' checked='checked' name='t'/>";

	// Support: Safari 5.1, iOS 5.1, Android 4.x, Android 2.3
	// old WebKit doesn't clone checked state correctly in fragments
	support.checkClone = div.cloneNode( true ).cloneNode( true ).lastChild.checked;

	// Support: IE<9
	// Opera does not clone events (and typeof div.attachEvent === undefined).
	// IE9-10 clones events bound via attachEvent, but they don't trigger with .click()
	support.noCloneEvent = true;
	if ( div.attachEvent ) {
		div.attachEvent( "onclick", function() {
			support.noCloneEvent = false;
		});

		div.cloneNode( true ).click();
	}

	// Execute the test only if not already executed in another module.
	if (support.deleteExpando == null) {
		// Support: IE<9
		support.deleteExpando = true;
		try {
			delete div.test;
		} catch( e ) {
			support.deleteExpando = false;
		}
	}
})();


(function() {
	var i, eventName,
		div = document.createElement( "div" );

	// Support: IE<9 (lack submit/change bubble), Firefox 23+ (lack focusin event)
	for ( i in { submit: true, change: true, focusin: true }) {
		eventName = "on" + i;

		if ( !(support[ i + "Bubbles" ] = eventName in window) ) {
			// Beware of CSP restrictions (https://developer.mozilla.org/en/Security/CSP)
			div.setAttribute( eventName, "t" );
			support[ i + "Bubbles" ] = div.attributes[ eventName ].expando === false;
		}
	}

	// Null elements to avoid leaks in IE.
	div = null;
})();


var rformElems = /^(?:input|select|textarea)$/i,
	rkeyEvent = /^key/,
	rmouseEvent = /^(?:mouse|pointer|contextmenu)|click/,
	rfocusMorph = /^(?:focusinfocus|focusoutblur)$/,
	rtypenamespace = /^([^.]*)(?:\.(.+)|)$/;

function returnTrue() {
	return true;
}

function returnFalse() {
	return false;
}

function safeActiveElement() {
	try {
		return document.activeElement;
	} catch ( err ) { }
}

/*
 * Helper functions for managing events -- not part of the public interface.
 * Props to Dean Edwards' addEvent library for many of the ideas.
 */
jQuery.event = {

	global: {},

	add: function( elem, types, handler, data, selector ) {
		var tmp, events, t, handleObjIn,
			special, eventHandle, handleObj,
			handlers, type, namespaces, origType,
			elemData = jQuery._data( elem );

		// Don't attach events to noData or text/comment nodes (but allow plain objects)
		if ( !elemData ) {
			return;
		}

		// Caller can pass in an object of custom data in lieu of the handler
		if ( handler.handler ) {
			handleObjIn = handler;
			handler = handleObjIn.handler;
			selector = handleObjIn.selector;
		}

		// Make sure that the handler has a unique ID, used to find/remove it later
		if ( !handler.guid ) {
			handler.guid = jQuery.guid++;
		}

		// Init the element's event structure and main handler, if this is the first
		if ( !(events = elemData.events) ) {
			events = elemData.events = {};
		}
		if ( !(eventHandle = elemData.handle) ) {
			eventHandle = elemData.handle = function( e ) {
				// Discard the second event of a jQuery.event.trigger() and
				// when an event is called after a page has unloaded
				return typeof jQuery !== strundefined && (!e || jQuery.event.triggered !== e.type) ?
					jQuery.event.dispatch.apply( eventHandle.elem, arguments ) :
					undefined;
			};
			// Add elem as a property of the handle fn to prevent a memory leak with IE non-native events
			eventHandle.elem = elem;
		}

		// Handle multiple events separated by a space
		types = ( types || "" ).match( rnotwhite ) || [ "" ];
		t = types.length;
		while ( t-- ) {
			tmp = rtypenamespace.exec( types[t] ) || [];
			type = origType = tmp[1];
			namespaces = ( tmp[2] || "" ).split( "." ).sort();

			// There *must* be a type, no attaching namespace-only handlers
			if ( !type ) {
				continue;
			}

			// If event changes its type, use the special event handlers for the changed type
			special = jQuery.event.special[ type ] || {};

			// If selector defined, determine special event api type, otherwise given type
			type = ( selector ? special.delegateType : special.bindType ) || type;

			// Update special based on newly reset type
			special = jQuery.event.special[ type ] || {};

			// handleObj is passed to all event handlers
			handleObj = jQuery.extend({
				type: type,
				origType: origType,
				data: data,
				handler: handler,
				guid: handler.guid,
				selector: selector,
				needsContext: selector && jQuery.expr.match.needsContext.test( selector ),
				namespace: namespaces.join(".")
			}, handleObjIn );

			// Init the event handler queue if we're the first
			if ( !(handlers = events[ type ]) ) {
				handlers = events[ type ] = [];
				handlers.delegateCount = 0;

				// Only use addEventListener/attachEvent if the special events handler returns false
				if ( !special.setup || special.setup.call( elem, data, namespaces, eventHandle ) === false ) {
					// Bind the global event handler to the element
					if ( elem.addEventListener ) {
						elem.addEventListener( type, eventHandle, false );

					} else if ( elem.attachEvent ) {
						elem.attachEvent( "on" + type, eventHandle );
					}
				}
			}

			if ( special.add ) {
				special.add.call( elem, handleObj );

				if ( !handleObj.handler.guid ) {
					handleObj.handler.guid = handler.guid;
				}
			}

			// Add to the element's handler list, delegates in front
			if ( selector ) {
				handlers.splice( handlers.delegateCount++, 0, handleObj );
			} else {
				handlers.push( handleObj );
			}

			// Keep track of which events have ever been used, for event optimization
			jQuery.event.global[ type ] = true;
		}

		// Nullify elem to prevent memory leaks in IE
		elem = null;
	},

	// Detach an event or set of events from an element
	remove: function( elem, types, handler, selector, mappedTypes ) {
		var j, handleObj, tmp,
			origCount, t, events,
			special, handlers, type,
			namespaces, origType,
			elemData = jQuery.hasData( elem ) && jQuery._data( elem );

		if ( !elemData || !(events = elemData.events) ) {
			return;
		}

		// Once for each type.namespace in types; type may be omitted
		types = ( types || "" ).match( rnotwhite ) || [ "" ];
		t = types.length;
		while ( t-- ) {
			tmp = rtypenamespace.exec( types[t] ) || [];
			type = origType = tmp[1];
			namespaces = ( tmp[2] || "" ).split( "." ).sort();

			// Unbind all events (on this namespace, if provided) for the element
			if ( !type ) {
				for ( type in events ) {
					jQuery.event.remove( elem, type + types[ t ], handler, selector, true );
				}
				continue;
			}

			special = jQuery.event.special[ type ] || {};
			type = ( selector ? special.delegateType : special.bindType ) || type;
			handlers = events[ type ] || [];
			tmp = tmp[2] && new RegExp( "(^|\\.)" + namespaces.join("\\.(?:.*\\.|)") + "(\\.|$)" );

			// Remove matching events
			origCount = j = handlers.length;
			while ( j-- ) {
				handleObj = handlers[ j ];

				if ( ( mappedTypes || origType === handleObj.origType ) &&
					( !handler || handler.guid === handleObj.guid ) &&
					( !tmp || tmp.test( handleObj.namespace ) ) &&
					( !selector || selector === handleObj.selector || selector === "**" && handleObj.selector ) ) {
					handlers.splice( j, 1 );

					if ( handleObj.selector ) {
						handlers.delegateCount--;
					}
					if ( special.remove ) {
						special.remove.call( elem, handleObj );
					}
				}
			}

			// Remove generic event handler if we removed something and no more handlers exist
			// (avoids potential for endless recursion during removal of special event handlers)
			if ( origCount && !handlers.length ) {
				if ( !special.teardown || special.teardown.call( elem, namespaces, elemData.handle ) === false ) {
					jQuery.removeEvent( elem, type, elemData.handle );
				}

				delete events[ type ];
			}
		}

		// Remove the expando if it's no longer used
		if ( jQuery.isEmptyObject( events ) ) {
			delete elemData.handle;

			// removeData also checks for emptiness and clears the expando if empty
			// so use it instead of delete
			jQuery._removeData( elem, "events" );
		}
	},

	trigger: function( event, data, elem, onlyHandlers ) {
		var handle, ontype, cur,
			bubbleType, special, tmp, i,
			eventPath = [ elem || document ],
			type = hasOwn.call( event, "type" ) ? event.type : event,
			namespaces = hasOwn.call( event, "namespace" ) ? event.namespace.split(".") : [];

		cur = tmp = elem = elem || document;

		// Don't do events on text and comment nodes
		if ( elem.nodeType === 3 || elem.nodeType === 8 ) {
			return;
		}

		// focus/blur morphs to focusin/out; ensure we're not firing them right now
		if ( rfocusMorph.test( type + jQuery.event.triggered ) ) {
			return;
		}

		if ( type.indexOf(".") >= 0 ) {
			// Namespaced trigger; create a regexp to match event type in handle()
			namespaces = type.split(".");
			type = namespaces.shift();
			namespaces.sort();
		}
		ontype = type.indexOf(":") < 0 && "on" + type;

		// Caller can pass in a jQuery.Event object, Object, or just an event type string
		event = event[ jQuery.expando ] ?
			event :
			new jQuery.Event( type, typeof event === "object" && event );

		// Trigger bitmask: & 1 for native handlers; & 2 for jQuery (always true)
		event.isTrigger = onlyHandlers ? 2 : 3;
		event.namespace = namespaces.join(".");
		event.namespace_re = event.namespace ?
			new RegExp( "(^|\\.)" + namespaces.join("\\.(?:.*\\.|)") + "(\\.|$)" ) :
			null;

		// Clean up the event in case it is being reused
		event.result = undefined;
		if ( !event.target ) {
			event.target = elem;
		}

		// Clone any incoming data and prepend the event, creating the handler arg list
		data = data == null ?
			[ event ] :
			jQuery.makeArray( data, [ event ] );

		// Allow special events to draw outside the lines
		special = jQuery.event.special[ type ] || {};
		if ( !onlyHandlers && special.trigger && special.trigger.apply( elem, data ) === false ) {
			return;
		}

		// Determine event propagation path in advance, per W3C events spec (#9951)
		// Bubble up to document, then to window; watch for a global ownerDocument var (#9724)
		if ( !onlyHandlers && !special.noBubble && !jQuery.isWindow( elem ) ) {

			bubbleType = special.delegateType || type;
			if ( !rfocusMorph.test( bubbleType + type ) ) {
				cur = cur.parentNode;
			}
			for ( ; cur; cur = cur.parentNode ) {
				eventPath.push( cur );
				tmp = cur;
			}

			// Only add window if we got to document (e.g., not plain obj or detached DOM)
			if ( tmp === (elem.ownerDocument || document) ) {
				eventPath.push( tmp.defaultView || tmp.parentWindow || window );
			}
		}

		// Fire handlers on the event path
		i = 0;
		while ( (cur = eventPath[i++]) && !event.isPropagationStopped() ) {

			event.type = i > 1 ?
				bubbleType :
				special.bindType || type;

			// jQuery handler
			handle = ( jQuery._data( cur, "events" ) || {} )[ event.type ] && jQuery._data( cur, "handle" );
			if ( handle ) {
				handle.apply( cur, data );
			}

			// Native handler
			handle = ontype && cur[ ontype ];
			if ( handle && handle.apply && jQuery.acceptData( cur ) ) {
				event.result = handle.apply( cur, data );
				if ( event.result === false ) {
					event.preventDefault();
				}
			}
		}
		event.type = type;

		// If nobody prevented the default action, do it now
		if ( !onlyHandlers && !event.isDefaultPrevented() ) {

			if ( (!special._default || special._default.apply( eventPath.pop(), data ) === false) &&
				jQuery.acceptData( elem ) ) {

				// Call a native DOM method on the target with the same name name as the event.
				// Can't use an .isFunction() check here because IE6/7 fails that test.
				// Don't do default actions on window, that's where global variables be (#6170)
				if ( ontype && elem[ type ] && !jQuery.isWindow( elem ) ) {

					// Don't re-trigger an onFOO event when we call its FOO() method
					tmp = elem[ ontype ];

					if ( tmp ) {
						elem[ ontype ] = null;
					}

					// Prevent re-triggering of the same event, since we already bubbled it above
					jQuery.event.triggered = type;
					try {
						elem[ type ]();
					} catch ( e ) {
						// IE<9 dies on focus/blur to hidden element (#1486,#12518)
						// only reproducible on winXP IE8 native, not IE9 in IE8 mode
					}
					jQuery.event.triggered = undefined;

					if ( tmp ) {
						elem[ ontype ] = tmp;
					}
				}
			}
		}

		return event.result;
	},

	dispatch: function( event ) {

		// Make a writable jQuery.Event from the native event object
		event = jQuery.event.fix( event );

		var i, ret, handleObj, matched, j,
			handlerQueue = [],
			args = slice.call( arguments ),
			handlers = ( jQuery._data( this, "events" ) || {} )[ event.type ] || [],
			special = jQuery.event.special[ event.type ] || {};

		// Use the fix-ed jQuery.Event rather than the (read-only) native event
		args[0] = event;
		event.delegateTarget = this;

		// Call the preDispatch hook for the mapped type, and let it bail if desired
		if ( special.preDispatch && special.preDispatch.call( this, event ) === false ) {
			return;
		}

		// Determine handlers
		handlerQueue = jQuery.event.handlers.call( this, event, handlers );

		// Run delegates first; they may want to stop propagation beneath us
		i = 0;
		while ( (matched = handlerQueue[ i++ ]) && !event.isPropagationStopped() ) {
			event.currentTarget = matched.elem;

			j = 0;
			while ( (handleObj = matched.handlers[ j++ ]) && !event.isImmediatePropagationStopped() ) {

				// Triggered event must either 1) have no namespace, or
				// 2) have namespace(s) a subset or equal to those in the bound event (both can have no namespace).
				if ( !event.namespace_re || event.namespace_re.test( handleObj.namespace ) ) {

					event.handleObj = handleObj;
					event.data = handleObj.data;

					ret = ( (jQuery.event.special[ handleObj.origType ] || {}).handle || handleObj.handler )
							.apply( matched.elem, args );

					if ( ret !== undefined ) {
						if ( (event.result = ret) === false ) {
							event.preventDefault();
							event.stopPropagation();
						}
					}
				}
			}
		}

		// Call the postDispatch hook for the mapped type
		if ( special.postDispatch ) {
			special.postDispatch.call( this, event );
		}

		return event.result;
	},

	handlers: function( event, handlers ) {
		var sel, handleObj, matches, i,
			handlerQueue = [],
			delegateCount = handlers.delegateCount,
			cur = event.target;

		// Find delegate handlers
		// Black-hole SVG <use> instance trees (#13180)
		// Avoid non-left-click bubbling in Firefox (#3861)
		if ( delegateCount && cur.nodeType && (!event.button || event.type !== "click") ) {

			/* jshint eqeqeq: false */
			for ( ; cur != this; cur = cur.parentNode || this ) {
				/* jshint eqeqeq: true */

				// Don't check non-elements (#13208)
				// Don't process clicks on disabled elements (#6911, #8165, #11382, #11764)
				if ( cur.nodeType === 1 && (cur.disabled !== true || event.type !== "click") ) {
					matches = [];
					for ( i = 0; i < delegateCount; i++ ) {
						handleObj = handlers[ i ];

						// Don't conflict with Object.prototype properties (#13203)
						sel = handleObj.selector + " ";

						if ( matches[ sel ] === undefined ) {
							matches[ sel ] = handleObj.needsContext ?
								jQuery( sel, this ).index( cur ) >= 0 :
								jQuery.find( sel, this, null, [ cur ] ).length;
						}
						if ( matches[ sel ] ) {
							matches.push( handleObj );
						}
					}
					if ( matches.length ) {
						handlerQueue.push({ elem: cur, handlers: matches });
					}
				}
			}
		}

		// Add the remaining (directly-bound) handlers
		if ( delegateCount < handlers.length ) {
			handlerQueue.push({ elem: this, handlers: handlers.slice( delegateCount ) });
		}

		return handlerQueue;
	},

	fix: function( event ) {
		if ( event[ jQuery.expando ] ) {
			return event;
		}

		// Create a writable copy of the event object and normalize some properties
		var i, prop, copy,
			type = event.type,
			originalEvent = event,
			fixHook = this.fixHooks[ type ];

		if ( !fixHook ) {
			this.fixHooks[ type ] = fixHook =
				rmouseEvent.test( type ) ? this.mouseHooks :
				rkeyEvent.test( type ) ? this.keyHooks :
				{};
		}
		copy = fixHook.props ? this.props.concat( fixHook.props ) : this.props;

		event = new jQuery.Event( originalEvent );

		i = copy.length;
		while ( i-- ) {
			prop = copy[ i ];
			event[ prop ] = originalEvent[ prop ];
		}

		// Support: IE<9
		// Fix target property (#1925)
		if ( !event.target ) {
			event.target = originalEvent.srcElement || document;
		}

		// Support: Chrome 23+, Safari?
		// Target should not be a text node (#504, #13143)
		if ( event.target.nodeType === 3 ) {
			event.target = event.target.parentNode;
		}

		// Support: IE<9
		// For mouse/key events, metaKey==false if it's undefined (#3368, #11328)
		event.metaKey = !!event.metaKey;

		return fixHook.filter ? fixHook.filter( event, originalEvent ) : event;
	},

	// Includes some event props shared by KeyEvent and MouseEvent
	props: "altKey bubbles cancelable ctrlKey currentTarget eventPhase metaKey relatedTarget shiftKey target timeStamp view which".split(" "),

	fixHooks: {},

	keyHooks: {
		props: "char charCode key keyCode".split(" "),
		filter: function( event, original ) {

			// Add which for key events
			if ( event.which == null ) {
				event.which = original.charCode != null ? original.charCode : original.keyCode;
			}

			return event;
		}
	},

	mouseHooks: {
		props: "button buttons clientX clientY fromElement offsetX offsetY pageX pageY screenX screenY toElement".split(" "),
		filter: function( event, original ) {
			var body, eventDoc, doc,
				button = original.button,
				fromElement = original.fromElement;

			// Calculate pageX/Y if missing and clientX/Y available
			if ( event.pageX == null && original.clientX != null ) {
				eventDoc = event.target.ownerDocument || document;
				doc = eventDoc.documentElement;
				body = eventDoc.body;

				event.pageX = original.clientX + ( doc && doc.scrollLeft || body && body.scrollLeft || 0 ) - ( doc && doc.clientLeft || body && body.clientLeft || 0 );
				event.pageY = original.clientY + ( doc && doc.scrollTop  || body && body.scrollTop  || 0 ) - ( doc && doc.clientTop  || body && body.clientTop  || 0 );
			}

			// Add relatedTarget, if necessary
			if ( !event.relatedTarget && fromElement ) {
				event.relatedTarget = fromElement === event.target ? original.toElement : fromElement;
			}

			// Add which for click: 1 === left; 2 === middle; 3 === right
			// Note: button is not normalized, so don't use it
			if ( !event.which && button !== undefined ) {
				event.which = ( button & 1 ? 1 : ( button & 2 ? 3 : ( button & 4 ? 2 : 0 ) ) );
			}

			return event;
		}
	},

	special: {
		load: {
			// Prevent triggered image.load events from bubbling to window.load
			noBubble: true
		},
		focus: {
			// Fire native event if possible so blur/focus sequence is correct
			trigger: function() {
				if ( this !== safeActiveElement() && this.focus ) {
					try {
						this.focus();
						return false;
					} catch ( e ) {
						// Support: IE<9
						// If we error on focus to hidden element (#1486, #12518),
						// let .trigger() run the handlers
					}
				}
			},
			delegateType: "focusin"
		},
		blur: {
			trigger: function() {
				if ( this === safeActiveElement() && this.blur ) {
					this.blur();
					return false;
				}
			},
			delegateType: "focusout"
		},
		click: {
			// For checkbox, fire native event so checked state will be right
			trigger: function() {
				if ( jQuery.nodeName( this, "input" ) && this.type === "checkbox" && this.click ) {
					this.click();
					return false;
				}
			},

			// For cross-browser consistency, don't fire native .click() on links
			_default: function( event ) {
				return jQuery.nodeName( event.target, "a" );
			}
		},

		beforeunload: {
			postDispatch: function( event ) {

				// Support: Firefox 20+
				// Firefox doesn't alert if the returnValue field is not set.
				if ( event.result !== undefined && event.originalEvent ) {
					event.originalEvent.returnValue = event.result;
				}
			}
		}
	},

	simulate: function( type, elem, event, bubble ) {
		// Piggyback on a donor event to simulate a different one.
		// Fake originalEvent to avoid donor's stopPropagation, but if the
		// simulated event prevents default then we do the same on the donor.
		var e = jQuery.extend(
			new jQuery.Event(),
			event,
			{
				type: type,
				isSimulated: true,
				originalEvent: {}
			}
		);
		if ( bubble ) {
			jQuery.event.trigger( e, null, elem );
		} else {
			jQuery.event.dispatch.call( elem, e );
		}
		if ( e.isDefaultPrevented() ) {
			event.preventDefault();
		}
	}
};

jQuery.removeEvent = document.removeEventListener ?
	function( elem, type, handle ) {
		if ( elem.removeEventListener ) {
			elem.removeEventListener( type, handle, false );
		}
	} :
	function( elem, type, handle ) {
		var name = "on" + type;

		if ( elem.detachEvent ) {

			// #8545, #7054, preventing memory leaks for custom events in IE6-8
			// detachEvent needed property on element, by name of that event, to properly expose it to GC
			if ( typeof elem[ name ] === strundefined ) {
				elem[ name ] = null;
			}

			elem.detachEvent( name, handle );
		}
	};

jQuery.Event = function( src, props ) {
	// Allow instantiation without the 'new' keyword
	if ( !(this instanceof jQuery.Event) ) {
		return new jQuery.Event( src, props );
	}

	// Event object
	if ( src && src.type ) {
		this.originalEvent = src;
		this.type = src.type;

		// Events bubbling up the document may have been marked as prevented
		// by a handler lower down the tree; reflect the correct value.
		this.isDefaultPrevented = src.defaultPrevented ||
				src.defaultPrevented === undefined &&
				// Support: IE < 9, Android < 4.0
				src.returnValue === false ?
			returnTrue :
			returnFalse;

	// Event type
	} else {
		this.type = src;
	}

	// Put explicitly provided properties onto the event object
	if ( props ) {
		jQuery.extend( this, props );
	}

	// Create a timestamp if incoming event doesn't have one
	this.timeStamp = src && src.timeStamp || jQuery.now();

	// Mark it as fixed
	this[ jQuery.expando ] = true;
};

// jQuery.Event is based on DOM3 Events as specified by the ECMAScript Language Binding
// http://www.w3.org/TR/2003/WD-DOM-Level-3-Events-20030331/ecma-script-binding.html
jQuery.Event.prototype = {
	isDefaultPrevented: returnFalse,
	isPropagationStopped: returnFalse,
	isImmediatePropagationStopped: returnFalse,

	preventDefault: function() {
		var e = this.originalEvent;

		this.isDefaultPrevented = returnTrue;
		if ( !e ) {
			return;
		}

		// If preventDefault exists, run it on the original event
		if ( e.preventDefault ) {
			e.preventDefault();

		// Support: IE
		// Otherwise set the returnValue property of the original event to false
		} else {
			e.returnValue = false;
		}
	},
	stopPropagation: function() {
		var e = this.originalEvent;

		this.isPropagationStopped = returnTrue;
		if ( !e ) {
			return;
		}
		// If stopPropagation exists, run it on the original event
		if ( e.stopPropagation ) {
			e.stopPropagation();
		}

		// Support: IE
		// Set the cancelBubble property of the original event to true
		e.cancelBubble = true;
	},
	stopImmediatePropagation: function() {
		var e = this.originalEvent;

		this.isImmediatePropagationStopped = returnTrue;

		if ( e && e.stopImmediatePropagation ) {
			e.stopImmediatePropagation();
		}

		this.stopPropagation();
	}
};

// Create mouseenter/leave events using mouseover/out and event-time checks
jQuery.each({
	mouseenter: "mouseover",
	mouseleave: "mouseout",
	pointerenter: "pointerover",
	pointerleave: "pointerout"
}, function( orig, fix ) {
	jQuery.event.special[ orig ] = {
		delegateType: fix,
		bindType: fix,

		handle: function( event ) {
			var ret,
				target = this,
				related = event.relatedTarget,
				handleObj = event.handleObj;

			// For mousenter/leave call the handler if related is outside the target.
			// NB: No relatedTarget if the mouse left/entered the browser window
			if ( !related || (related !== target && !jQuery.contains( target, related )) ) {
				event.type = handleObj.origType;
				ret = handleObj.handler.apply( this, arguments );
				event.type = fix;
			}
			return ret;
		}
	};
});

// IE submit delegation
if ( !support.submitBubbles ) {

	jQuery.event.special.submit = {
		setup: function() {
			// Only need this for delegated form submit events
			if ( jQuery.nodeName( this, "form" ) ) {
				return false;
			}

			// Lazy-add a submit handler when a descendant form may potentially be submitted
			jQuery.event.add( this, "click._submit keypress._submit", function( e ) {
				// Node name check avoids a VML-related crash in IE (#9807)
				var elem = e.target,
					form = jQuery.nodeName( elem, "input" ) || jQuery.nodeName( elem, "button" ) ? elem.form : undefined;
				if ( form && !jQuery._data( form, "submitBubbles" ) ) {
					jQuery.event.add( form, "submit._submit", function( event ) {
						event._submit_bubble = true;
					});
					jQuery._data( form, "submitBubbles", true );
				}
			});
			// return undefined since we don't need an event listener
		},

		postDispatch: function( event ) {
			// If form was submitted by the user, bubble the event up the tree
			if ( event._submit_bubble ) {
				delete event._submit_bubble;
				if ( this.parentNode && !event.isTrigger ) {
					jQuery.event.simulate( "submit", this.parentNode, event, true );
				}
			}
		},

		teardown: function() {
			// Only need this for delegated form submit events
			if ( jQuery.nodeName( this, "form" ) ) {
				return false;
			}

			// Remove delegated handlers; cleanData eventually reaps submit handlers attached above
			jQuery.event.remove( this, "._submit" );
		}
	};
}

// IE change delegation and checkbox/radio fix
if ( !support.changeBubbles ) {

	jQuery.event.special.change = {

		setup: function() {

			if ( rformElems.test( this.nodeName ) ) {
				// IE doesn't fire change on a check/radio until blur; trigger it on click
				// after a propertychange. Eat the blur-change in special.change.handle.
				// This still fires onchange a second time for check/radio after blur.
				if ( this.type === "checkbox" || this.type === "radio" ) {
					jQuery.event.add( this, "propertychange._change", function( event ) {
						if ( event.originalEvent.propertyName === "checked" ) {
							this._just_changed = true;
						}
					});
					jQuery.event.add( this, "click._change", function( event ) {
						if ( this._just_changed && !event.isTrigger ) {
							this._just_changed = false;
						}
						// Allow triggered, simulated change events (#11500)
						jQuery.event.simulate( "change", this, event, true );
					});
				}
				return false;
			}
			// Delegated event; lazy-add a change handler on descendant inputs
			jQuery.event.add( this, "beforeactivate._change", function( e ) {
				var elem = e.target;

				if ( rformElems.test( elem.nodeName ) && !jQuery._data( elem, "changeBubbles" ) ) {
					jQuery.event.add( elem, "change._change", function( event ) {
						if ( this.parentNode && !event.isSimulated && !event.isTrigger ) {
							jQuery.event.simulate( "change", this.parentNode, event, true );
						}
					});
					jQuery._data( elem, "changeBubbles", true );
				}
			});
		},

		handle: function( event ) {
			var elem = event.target;

			// Swallow native change events from checkbox/radio, we already triggered them above
			if ( this !== elem || event.isSimulated || event.isTrigger || (elem.type !== "radio" && elem.type !== "checkbox") ) {
				return event.handleObj.handler.apply( this, arguments );
			}
		},

		teardown: function() {
			jQuery.event.remove( this, "._change" );

			return !rformElems.test( this.nodeName );
		}
	};
}

// Create "bubbling" focus and blur events
if ( !support.focusinBubbles ) {
	jQuery.each({ focus: "focusin", blur: "focusout" }, function( orig, fix ) {

		// Attach a single capturing handler on the document while someone wants focusin/focusout
		var handler = function( event ) {
				jQuery.event.simulate( fix, event.target, jQuery.event.fix( event ), true );
			};

		jQuery.event.special[ fix ] = {
			setup: function() {
				var doc = this.ownerDocument || this,
					attaches = jQuery._data( doc, fix );

				if ( !attaches ) {
					doc.addEventListener( orig, handler, true );
				}
				jQuery._data( doc, fix, ( attaches || 0 ) + 1 );
			},
			teardown: function() {
				var doc = this.ownerDocument || this,
					attaches = jQuery._data( doc, fix ) - 1;

				if ( !attaches ) {
					doc.removeEventListener( orig, handler, true );
					jQuery._removeData( doc, fix );
				} else {
					jQuery._data( doc, fix, attaches );
				}
			}
		};
	});
}

jQuery.fn.extend({

	on: function( types, selector, data, fn, /*INTERNAL*/ one ) {
		var type, origFn;

		// Types can be a map of types/handlers
		if ( typeof types === "object" ) {
			// ( types-Object, selector, data )
			if ( typeof selector !== "string" ) {
				// ( types-Object, data )
				data = data || selector;
				selector = undefined;
			}
			for ( type in types ) {
				this.on( type, selector, data, types[ type ], one );
			}
			return this;
		}

		if ( data == null && fn == null ) {
			// ( types, fn )
			fn = selector;
			data = selector = undefined;
		} else if ( fn == null ) {
			if ( typeof selector === "string" ) {
				// ( types, selector, fn )
				fn = data;
				data = undefined;
			} else {
				// ( types, data, fn )
				fn = data;
				data = selector;
				selector = undefined;
			}
		}
		if ( fn === false ) {
			fn = returnFalse;
		} else if ( !fn ) {
			return this;
		}

		if ( one === 1 ) {
			origFn = fn;
			fn = function( event ) {
				// Can use an empty set, since event contains the info
				jQuery().off( event );
				return origFn.apply( this, arguments );
			};
			// Use same guid so caller can remove using origFn
			fn.guid = origFn.guid || ( origFn.guid = jQuery.guid++ );
		}
		return this.each( function() {
			jQuery.event.add( this, types, fn, data, selector );
		});
	},
	one: function( types, selector, data, fn ) {
		return this.on( types, selector, data, fn, 1 );
	},
	off: function( types, selector, fn ) {
		var handleObj, type;
		if ( types && types.preventDefault && types.handleObj ) {
			// ( event )  dispatched jQuery.Event
			handleObj = types.handleObj;
			jQuery( types.delegateTarget ).off(
				handleObj.namespace ? handleObj.origType + "." + handleObj.namespace : handleObj.origType,
				handleObj.selector,
				handleObj.handler
			);
			return this;
		}
		if ( typeof types === "object" ) {
			// ( types-object [, selector] )
			for ( type in types ) {
				this.off( type, selector, types[ type ] );
			}
			return this;
		}
		if ( selector === false || typeof selector === "function" ) {
			// ( types [, fn] )
			fn = selector;
			selector = undefined;
		}
		if ( fn === false ) {
			fn = returnFalse;
		}
		return this.each(function() {
			jQuery.event.remove( this, types, fn, selector );
		});
	},

	trigger: function( type, data ) {
		return this.each(function() {
			jQuery.event.trigger( type, data, this );
		});
	},
	triggerHandler: function( type, data ) {
		var elem = this[0];
		if ( elem ) {
			return jQuery.event.trigger( type, data, elem, true );
		}
	}
});


function createSafeFragment( document ) {
	var list = nodeNames.split( "|" ),
		safeFrag = document.createDocumentFragment();

	if ( safeFrag.createElement ) {
		while ( list.length ) {
			safeFrag.createElement(
				list.pop()
			);
		}
	}
	return safeFrag;
}

var nodeNames = "abbr|article|aside|audio|bdi|canvas|data|datalist|details|figcaption|figure|footer|" +
		"header|hgroup|mark|meter|nav|output|progress|section|summary|time|video",
	rinlinejQuery = / jQuery\d+="(?:null|\d+)"/g,
	rnoshimcache = new RegExp("<(?:" + nodeNames + ")[\\s/>]", "i"),
	rleadingWhitespace = /^\s+/,
	rxhtmlTag = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi,
	rtagName = /<([\w:]+)/,
	rtbody = /<tbody/i,
	rhtml = /<|&#?\w+;/,
	rnoInnerhtml = /<(?:script|style|link)/i,
	// checked="checked" or checked
	rchecked = /checked\s*(?:[^=]|=\s*.checked.)/i,
	rscriptType = /^$|\/(?:java|ecma)script/i,
	rscriptTypeMasked = /^true\/(.*)/,
	rcleanScript = /^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g,

	// We have to close these tags to support XHTML (#13200)
	wrapMap = {
		option: [ 1, "<select multiple='multiple'>", "</select>" ],
		legend: [ 1, "<fieldset>", "</fieldset>" ],
		area: [ 1, "<map>", "</map>" ],
		param: [ 1, "<object>", "</object>" ],
		thead: [ 1, "<table>", "</table>" ],
		tr: [ 2, "<table><tbody>", "</tbody></table>" ],
		col: [ 2, "<table><tbody></tbody><colgroup>", "</colgroup></table>" ],
		td: [ 3, "<table><tbody><tr>", "</tr></tbody></table>" ],

		// IE6-8 can't serialize link, script, style, or any html5 (NoScope) tags,
		// unless wrapped in a div with non-breaking characters in front of it.
		_default: support.htmlSerialize ? [ 0, "", "" ] : [ 1, "X<div>", "</div>"  ]
	},
	safeFragment = createSafeFragment( document ),
	fragmentDiv = safeFragment.appendChild( document.createElement("div") );

wrapMap.optgroup = wrapMap.option;
wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead;
wrapMap.th = wrapMap.td;

function getAll( context, tag ) {
	var elems, elem,
		i = 0,
		found = typeof context.getElementsByTagName !== strundefined ? context.getElementsByTagName( tag || "*" ) :
			typeof context.querySelectorAll !== strundefined ? context.querySelectorAll( tag || "*" ) :
			undefined;

	if ( !found ) {
		for ( found = [], elems = context.childNodes || context; (elem = elems[i]) != null; i++ ) {
			if ( !tag || jQuery.nodeName( elem, tag ) ) {
				found.push( elem );
			} else {
				jQuery.merge( found, getAll( elem, tag ) );
			}
		}
	}

	return tag === undefined || tag && jQuery.nodeName( context, tag ) ?
		jQuery.merge( [ context ], found ) :
		found;
}

// Used in buildFragment, fixes the defaultChecked property
function fixDefaultChecked( elem ) {
	if ( rcheckableType.test( elem.type ) ) {
		elem.defaultChecked = elem.checked;
	}
}

// Support: IE<8
// Manipulating tables requires a tbody
function manipulationTarget( elem, content ) {
	return jQuery.nodeName( elem, "table" ) &&
		jQuery.nodeName( content.nodeType !== 11 ? content : content.firstChild, "tr" ) ?

		elem.getElementsByTagName("tbody")[0] ||
			elem.appendChild( elem.ownerDocument.createElement("tbody") ) :
		elem;
}

// Replace/restore the type attribute of script elements for safe DOM manipulation
function disableScript( elem ) {
	elem.type = (jQuery.find.attr( elem, "type" ) !== null) + "/" + elem.type;
	return elem;
}
function restoreScript( elem ) {
	var match = rscriptTypeMasked.exec( elem.type );
	if ( match ) {
		elem.type = match[1];
	} else {
		elem.removeAttribute("type");
	}
	return elem;
}

// Mark scripts as having already been evaluated
function setGlobalEval( elems, refElements ) {
	var elem,
		i = 0;
	for ( ; (elem = elems[i]) != null; i++ ) {
		jQuery._data( elem, "globalEval", !refElements || jQuery._data( refElements[i], "globalEval" ) );
	}
}

function cloneCopyEvent( src, dest ) {

	if ( dest.nodeType !== 1 || !jQuery.hasData( src ) ) {
		return;
	}

	var type, i, l,
		oldData = jQuery._data( src ),
		curData = jQuery._data( dest, oldData ),
		events = oldData.events;

	if ( events ) {
		delete curData.handle;
		curData.events = {};

		for ( type in events ) {
			for ( i = 0, l = events[ type ].length; i < l; i++ ) {
				jQuery.event.add( dest, type, events[ type ][ i ] );
			}
		}
	}

	// make the cloned public data object a copy from the original
	if ( curData.data ) {
		curData.data = jQuery.extend( {}, curData.data );
	}
}

function fixCloneNodeIssues( src, dest ) {
	var nodeName, e, data;

	// We do not need to do anything for non-Elements
	if ( dest.nodeType !== 1 ) {
		return;
	}

	nodeName = dest.nodeName.toLowerCase();

	// IE6-8 copies events bound via attachEvent when using cloneNode.
	if ( !support.noCloneEvent && dest[ jQuery.expando ] ) {
		data = jQuery._data( dest );

		for ( e in data.events ) {
			jQuery.removeEvent( dest, e, data.handle );
		}

		// Event data gets referenced instead of copied if the expando gets copied too
		dest.removeAttribute( jQuery.expando );
	}

	// IE blanks contents when cloning scripts, and tries to evaluate newly-set text
	if ( nodeName === "script" && dest.text !== src.text ) {
		disableScript( dest ).text = src.text;
		restoreScript( dest );

	// IE6-10 improperly clones children of object elements using classid.
	// IE10 throws NoModificationAllowedError if parent is null, #12132.
	} else if ( nodeName === "object" ) {
		if ( dest.parentNode ) {
			dest.outerHTML = src.outerHTML;
		}

		// This path appears unavoidable for IE9. When cloning an object
		// element in IE9, the outerHTML strategy above is not sufficient.
		// If the src has innerHTML and the destination does not,
		// copy the src.innerHTML into the dest.innerHTML. #10324
		if ( support.html5Clone && ( src.innerHTML && !jQuery.trim(dest.innerHTML) ) ) {
			dest.innerHTML = src.innerHTML;
		}

	} else if ( nodeName === "input" && rcheckableType.test( src.type ) ) {
		// IE6-8 fails to persist the checked state of a cloned checkbox
		// or radio button. Worse, IE6-7 fail to give the cloned element
		// a checked appearance if the defaultChecked value isn't also set

		dest.defaultChecked = dest.checked = src.checked;

		// IE6-7 get confused and end up setting the value of a cloned
		// checkbox/radio button to an empty string instead of "on"
		if ( dest.value !== src.value ) {
			dest.value = src.value;
		}

	// IE6-8 fails to return the selected option to the default selected
	// state when cloning options
	} else if ( nodeName === "option" ) {
		dest.defaultSelected = dest.selected = src.defaultSelected;

	// IE6-8 fails to set the defaultValue to the correct value when
	// cloning other types of input fields
	} else if ( nodeName === "input" || nodeName === "textarea" ) {
		dest.defaultValue = src.defaultValue;
	}
}

jQuery.extend({
	clone: function( elem, dataAndEvents, deepDataAndEvents ) {
		var destElements, node, clone, i, srcElements,
			inPage = jQuery.contains( elem.ownerDocument, elem );

		if ( support.html5Clone || jQuery.isXMLDoc(elem) || !rnoshimcache.test( "<" + elem.nodeName + ">" ) ) {
			clone = elem.cloneNode( true );

		// IE<=8 does not properly clone detached, unknown element nodes
		} else {
			fragmentDiv.innerHTML = elem.outerHTML;
			fragmentDiv.removeChild( clone = fragmentDiv.firstChild );
		}

		if ( (!support.noCloneEvent || !support.noCloneChecked) &&
				(elem.nodeType === 1 || elem.nodeType === 11) && !jQuery.isXMLDoc(elem) ) {

			// We eschew Sizzle here for performance reasons: http://jsperf.com/getall-vs-sizzle/2
			destElements = getAll( clone );
			srcElements = getAll( elem );

			// Fix all IE cloning issues
			for ( i = 0; (node = srcElements[i]) != null; ++i ) {
				// Ensure that the destination node is not null; Fixes #9587
				if ( destElements[i] ) {
					fixCloneNodeIssues( node, destElements[i] );
				}
			}
		}

		// Copy the events from the original to the clone
		if ( dataAndEvents ) {
			if ( deepDataAndEvents ) {
				srcElements = srcElements || getAll( elem );
				destElements = destElements || getAll( clone );

				for ( i = 0; (node = srcElements[i]) != null; i++ ) {
					cloneCopyEvent( node, destElements[i] );
				}
			} else {
				cloneCopyEvent( elem, clone );
			}
		}

		// Preserve script evaluation history
		destElements = getAll( clone, "script" );
		if ( destElements.length > 0 ) {
			setGlobalEval( destElements, !inPage && getAll( elem, "script" ) );
		}

		destElements = srcElements = node = null;

		// Return the cloned set
		return clone;
	},

	buildFragment: function( elems, context, scripts, selection ) {
		var j, elem, contains,
			tmp, tag, tbody, wrap,
			l = elems.length,

			// Ensure a safe fragment
			safe = createSafeFragment( context ),

			nodes = [],
			i = 0;

		for ( ; i < l; i++ ) {
			elem = elems[ i ];

			if ( elem || elem === 0 ) {

				// Add nodes directly
				if ( jQuery.type( elem ) === "object" ) {
					jQuery.merge( nodes, elem.nodeType ? [ elem ] : elem );

				// Convert non-html into a text node
				} else if ( !rhtml.test( elem ) ) {
					nodes.push( context.createTextNode( elem ) );

				// Convert html into DOM nodes
				} else {
					tmp = tmp || safe.appendChild( context.createElement("div") );

					// Deserialize a standard representation
					tag = (rtagName.exec( elem ) || [ "", "" ])[ 1 ].toLowerCase();
					wrap = wrapMap[ tag ] || wrapMap._default;

					tmp.innerHTML = wrap[1] + elem.replace( rxhtmlTag, "<$1></$2>" ) + wrap[2];

					// Descend through wrappers to the right content
					j = wrap[0];
					while ( j-- ) {
						tmp = tmp.lastChild;
					}

					// Manually add leading whitespace removed by IE
					if ( !support.leadingWhitespace && rleadingWhitespace.test( elem ) ) {
						nodes.push( context.createTextNode( rleadingWhitespace.exec( elem )[0] ) );
					}

					// Remove IE's autoinserted <tbody> from table fragments
					if ( !support.tbody ) {

						// String was a <table>, *may* have spurious <tbody>
						elem = tag === "table" && !rtbody.test( elem ) ?
							tmp.firstChild :

							// String was a bare <thead> or <tfoot>
							wrap[1] === "<table>" && !rtbody.test( elem ) ?
								tmp :
								0;

						j = elem && elem.childNodes.length;
						while ( j-- ) {
							if ( jQuery.nodeName( (tbody = elem.childNodes[j]), "tbody" ) && !tbody.childNodes.length ) {
								elem.removeChild( tbody );
							}
						}
					}

					jQuery.merge( nodes, tmp.childNodes );

					// Fix #12392 for WebKit and IE > 9
					tmp.textContent = "";

					// Fix #12392 for oldIE
					while ( tmp.firstChild ) {
						tmp.removeChild( tmp.firstChild );
					}

					// Remember the top-level container for proper cleanup
					tmp = safe.lastChild;
				}
			}
		}

		// Fix #11356: Clear elements from fragment
		if ( tmp ) {
			safe.removeChild( tmp );
		}

		// Reset defaultChecked for any radios and checkboxes
		// about to be appended to the DOM in IE 6/7 (#8060)
		if ( !support.appendChecked ) {
			jQuery.grep( getAll( nodes, "input" ), fixDefaultChecked );
		}

		i = 0;
		while ( (elem = nodes[ i++ ]) ) {

			// #4087 - If origin and destination elements are the same, and this is
			// that element, do not do anything
			if ( selection && jQuery.inArray( elem, selection ) !== -1 ) {
				continue;
			}

			contains = jQuery.contains( elem.ownerDocument, elem );

			// Append to fragment
			tmp = getAll( safe.appendChild( elem ), "script" );

			// Preserve script evaluation history
			if ( contains ) {
				setGlobalEval( tmp );
			}

			// Capture executables
			if ( scripts ) {
				j = 0;
				while ( (elem = tmp[ j++ ]) ) {
					if ( rscriptType.test( elem.type || "" ) ) {
						scripts.push( elem );
					}
				}
			}
		}

		tmp = null;

		return safe;
	},

	cleanData: function( elems, /* internal */ acceptData ) {
		var elem, type, id, data,
			i = 0,
			internalKey = jQuery.expando,
			cache = jQuery.cache,
			deleteExpando = support.deleteExpando,
			special = jQuery.event.special;

		for ( ; (elem = elems[i]) != null; i++ ) {
			if ( acceptData || jQuery.acceptData( elem ) ) {

				id = elem[ internalKey ];
				data = id && cache[ id ];

				if ( data ) {
					if ( data.events ) {
						for ( type in data.events ) {
							if ( special[ type ] ) {
								jQuery.event.remove( elem, type );

							// This is a shortcut to avoid jQuery.event.remove's overhead
							} else {
								jQuery.removeEvent( elem, type, data.handle );
							}
						}
					}

					// Remove cache only if it was not already removed by jQuery.event.remove
					if ( cache[ id ] ) {

						delete cache[ id ];

						// IE does not allow us to delete expando properties from nodes,
						// nor does it have a removeAttribute function on Document nodes;
						// we must handle all of these cases
						if ( deleteExpando ) {
							delete elem[ internalKey ];

						} else if ( typeof elem.removeAttribute !== strundefined ) {
							elem.removeAttribute( internalKey );

						} else {
							elem[ internalKey ] = null;
						}

						deletedIds.push( id );
					}
				}
			}
		}
	}
});

jQuery.fn.extend({
	text: function( value ) {
		return access( this, function( value ) {
			return value === undefined ?
				jQuery.text( this ) :
				this.empty().append( ( this[0] && this[0].ownerDocument || document ).createTextNode( value ) );
		}, null, value, arguments.length );
	},

	append: function() {
		return this.domManip( arguments, function( elem ) {
			if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
				var target = manipulationTarget( this, elem );
				target.appendChild( elem );
			}
		});
	},

	prepend: function() {
		return this.domManip( arguments, function( elem ) {
			if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
				var target = manipulationTarget( this, elem );
				target.insertBefore( elem, target.firstChild );
			}
		});
	},

	before: function() {
		return this.domManip( arguments, function( elem ) {
			if ( this.parentNode ) {
				this.parentNode.insertBefore( elem, this );
			}
		});
	},

	after: function() {
		return this.domManip( arguments, function( elem ) {
			if ( this.parentNode ) {
				this.parentNode.insertBefore( elem, this.nextSibling );
			}
		});
	},

	remove: function( selector, keepData /* Internal Use Only */ ) {
		var elem,
			elems = selector ? jQuery.filter( selector, this ) : this,
			i = 0;

		for ( ; (elem = elems[i]) != null; i++ ) {

			if ( !keepData && elem.nodeType === 1 ) {
				jQuery.cleanData( getAll( elem ) );
			}

			if ( elem.parentNode ) {
				if ( keepData && jQuery.contains( elem.ownerDocument, elem ) ) {
					setGlobalEval( getAll( elem, "script" ) );
				}
				elem.parentNode.removeChild( elem );
			}
		}

		return this;
	},

	empty: function() {
		var elem,
			i = 0;

		for ( ; (elem = this[i]) != null; i++ ) {
			// Remove element nodes and prevent memory leaks
			if ( elem.nodeType === 1 ) {
				jQuery.cleanData( getAll( elem, false ) );
			}

			// Remove any remaining nodes
			while ( elem.firstChild ) {
				elem.removeChild( elem.firstChild );
			}

			// If this is a select, ensure that it displays empty (#12336)
			// Support: IE<9
			if ( elem.options && jQuery.nodeName( elem, "select" ) ) {
				elem.options.length = 0;
			}
		}

		return this;
	},

	clone: function( dataAndEvents, deepDataAndEvents ) {
		dataAndEvents = dataAndEvents == null ? false : dataAndEvents;
		deepDataAndEvents = deepDataAndEvents == null ? dataAndEvents : deepDataAndEvents;

		return this.map(function() {
			return jQuery.clone( this, dataAndEvents, deepDataAndEvents );
		});
	},

	html: function( value ) {
		return access( this, function( value ) {
			var elem = this[ 0 ] || {},
				i = 0,
				l = this.length;

			if ( value === undefined ) {
				return elem.nodeType === 1 ?
					elem.innerHTML.replace( rinlinejQuery, "" ) :
					undefined;
			}

			// See if we can take a shortcut and just use innerHTML
			if ( typeof value === "string" && !rnoInnerhtml.test( value ) &&
				( support.htmlSerialize || !rnoshimcache.test( value )  ) &&
				( support.leadingWhitespace || !rleadingWhitespace.test( value ) ) &&
				!wrapMap[ (rtagName.exec( value ) || [ "", "" ])[ 1 ].toLowerCase() ] ) {

				value = value.replace( rxhtmlTag, "<$1></$2>" );

				try {
					for (; i < l; i++ ) {
						// Remove element nodes and prevent memory leaks
						elem = this[i] || {};
						if ( elem.nodeType === 1 ) {
							jQuery.cleanData( getAll( elem, false ) );
							elem.innerHTML = value;
						}
					}

					elem = 0;

				// If using innerHTML throws an exception, use the fallback method
				} catch(e) {}
			}

			if ( elem ) {
				this.empty().append( value );
			}
		}, null, value, arguments.length );
	},

	replaceWith: function() {
		var arg = arguments[ 0 ];

		// Make the changes, replacing each context element with the new content
		this.domManip( arguments, function( elem ) {
			arg = this.parentNode;

			jQuery.cleanData( getAll( this ) );

			if ( arg ) {
				arg.replaceChild( elem, this );
			}
		});

		// Force removal if there was no new content (e.g., from empty arguments)
		return arg && (arg.length || arg.nodeType) ? this : this.remove();
	},

	detach: function( selector ) {
		return this.remove( selector, true );
	},

	domManip: function( args, callback ) {

		// Flatten any nested arrays
		args = concat.apply( [], args );

		var first, node, hasScripts,
			scripts, doc, fragment,
			i = 0,
			l = this.length,
			set = this,
			iNoClone = l - 1,
			value = args[0],
			isFunction = jQuery.isFunction( value );

		// We can't cloneNode fragments that contain checked, in WebKit
		if ( isFunction ||
				( l > 1 && typeof value === "string" &&
					!support.checkClone && rchecked.test( value ) ) ) {
			return this.each(function( index ) {
				var self = set.eq( index );
				if ( isFunction ) {
					args[0] = value.call( this, index, self.html() );
				}
				self.domManip( args, callback );
			});
		}

		if ( l ) {
			fragment = jQuery.buildFragment( args, this[ 0 ].ownerDocument, false, this );
			first = fragment.firstChild;

			if ( fragment.childNodes.length === 1 ) {
				fragment = first;
			}

			if ( first ) {
				scripts = jQuery.map( getAll( fragment, "script" ), disableScript );
				hasScripts = scripts.length;

				// Use the original fragment for the last item instead of the first because it can end up
				// being emptied incorrectly in certain situations (#8070).
				for ( ; i < l; i++ ) {
					node = fragment;

					if ( i !== iNoClone ) {
						node = jQuery.clone( node, true, true );

						// Keep references to cloned scripts for later restoration
						if ( hasScripts ) {
							jQuery.merge( scripts, getAll( node, "script" ) );
						}
					}

					callback.call( this[i], node, i );
				}

				if ( hasScripts ) {
					doc = scripts[ scripts.length - 1 ].ownerDocument;

					// Reenable scripts
					jQuery.map( scripts, restoreScript );

					// Evaluate executable scripts on first document insertion
					for ( i = 0; i < hasScripts; i++ ) {
						node = scripts[ i ];
						if ( rscriptType.test( node.type || "" ) &&
							!jQuery._data( node, "globalEval" ) && jQuery.contains( doc, node ) ) {

							if ( node.src ) {
								// Optional AJAX dependency, but won't run scripts if not present
								if ( jQuery._evalUrl ) {
									jQuery._evalUrl( node.src );
								}
							} else {
								jQuery.globalEval( ( node.text || node.textContent || node.innerHTML || "" ).replace( rcleanScript, "" ) );
							}
						}
					}
				}

				// Fix #11809: Avoid leaking memory
				fragment = first = null;
			}
		}

		return this;
	}
});

jQuery.each({
	appendTo: "append",
	prependTo: "prepend",
	insertBefore: "before",
	insertAfter: "after",
	replaceAll: "replaceWith"
}, function( name, original ) {
	jQuery.fn[ name ] = function( selector ) {
		var elems,
			i = 0,
			ret = [],
			insert = jQuery( selector ),
			last = insert.length - 1;

		for ( ; i <= last; i++ ) {
			elems = i === last ? this : this.clone(true);
			jQuery( insert[i] )[ original ]( elems );

			// Modern browsers can apply jQuery collections as arrays, but oldIE needs a .get()
			push.apply( ret, elems.get() );
		}

		return this.pushStack( ret );
	};
});


var iframe,
	elemdisplay = {};

/**
 * Retrieve the actual display of a element
 * @param {String} name nodeName of the element
 * @param {Object} doc Document object
 */
// Called only from within defaultDisplay
function actualDisplay( name, doc ) {
	var style,
		elem = jQuery( doc.createElement( name ) ).appendTo( doc.body ),

		// getDefaultComputedStyle might be reliably used only on attached element
		display = window.getDefaultComputedStyle && ( style = window.getDefaultComputedStyle( elem[ 0 ] ) ) ?

			// Use of this method is a temporary fix (more like optmization) until something better comes along,
			// since it was removed from specification and supported only in FF
			style.display : jQuery.css( elem[ 0 ], "display" );

	// We don't have any data stored on the element,
	// so use "detach" method as fast way to get rid of the element
	elem.detach();

	return display;
}

/**
 * Try to determine the default display value of an element
 * @param {String} nodeName
 */
function defaultDisplay( nodeName ) {
	var doc = document,
		display = elemdisplay[ nodeName ];

	if ( !display ) {
		display = actualDisplay( nodeName, doc );

		// If the simple way fails, read from inside an iframe
		if ( display === "none" || !display ) {

			// Use the already-created iframe if possible
			iframe = (iframe || jQuery( "<iframe frameborder='0' width='0' height='0'/>" )).appendTo( doc.documentElement );

			// Always write a new HTML skeleton so Webkit and Firefox don't choke on reuse
			doc = ( iframe[ 0 ].contentWindow || iframe[ 0 ].contentDocument ).document;

			// Support: IE
			doc.write();
			doc.close();

			display = actualDisplay( nodeName, doc );
			iframe.detach();
		}

		// Store the correct default display
		elemdisplay[ nodeName ] = display;
	}

	return display;
}


(function() {
	var shrinkWrapBlocksVal;

	support.shrinkWrapBlocks = function() {
		if ( shrinkWrapBlocksVal != null ) {
			return shrinkWrapBlocksVal;
		}

		// Will be changed later if needed.
		shrinkWrapBlocksVal = false;

		// Minified: var b,c,d
		var div, body, container;

		body = document.getElementsByTagName( "body" )[ 0 ];
		if ( !body || !body.style ) {
			// Test fired too early or in an unsupported environment, exit.
			return;
		}

		// Setup
		div = document.createElement( "div" );
		container = document.createElement( "div" );
		container.style.cssText = "position:absolute;border:0;width:0;height:0;top:0;left:-9999px";
		body.appendChild( container ).appendChild( div );

		// Support: IE6
		// Check if elements with layout shrink-wrap their children
		if ( typeof div.style.zoom !== strundefined ) {
			// Reset CSS: box-sizing; display; margin; border
			div.style.cssText =
				// Support: Firefox<29, Android 2.3
				// Vendor-prefix box-sizing
				"-webkit-box-sizing:content-box;-moz-box-sizing:content-box;" +
				"box-sizing:content-box;display:block;margin:0;border:0;" +
				"padding:1px;width:1px;zoom:1";
			div.appendChild( document.createElement( "div" ) ).style.width = "5px";
			shrinkWrapBlocksVal = div.offsetWidth !== 3;
		}

		body.removeChild( container );

		return shrinkWrapBlocksVal;
	};

})();
var rmargin = (/^margin/);

var rnumnonpx = new RegExp( "^(" + pnum + ")(?!px)[a-z%]+$", "i" );



var getStyles, curCSS,
	rposition = /^(top|right|bottom|left)$/;

if ( window.getComputedStyle ) {
	getStyles = function( elem ) {
		return elem.ownerDocument.defaultView.getComputedStyle( elem, null );
	};

	curCSS = function( elem, name, computed ) {
		var width, minWidth, maxWidth, ret,
			style = elem.style;

		computed = computed || getStyles( elem );

		// getPropertyValue is only needed for .css('filter') in IE9, see #12537
		ret = computed ? computed.getPropertyValue( name ) || computed[ name ] : undefined;

		if ( computed ) {

			if ( ret === "" && !jQuery.contains( elem.ownerDocument, elem ) ) {
				ret = jQuery.style( elem, name );
			}

			// A tribute to the "awesome hack by Dean Edwards"
			// Chrome < 17 and Safari 5.0 uses "computed value" instead of "used value" for margin-right
			// Safari 5.1.7 (at least) returns percentage for a larger set of values, but width seems to be reliably pixels
			// this is against the CSSOM draft spec: http://dev.w3.org/csswg/cssom/#resolved-values
			if ( rnumnonpx.test( ret ) && rmargin.test( name ) ) {

				// Remember the original values
				width = style.width;
				minWidth = style.minWidth;
				maxWidth = style.maxWidth;

				// Put in the new values to get a computed value out
				style.minWidth = style.maxWidth = style.width = ret;
				ret = computed.width;

				// Revert the changed values
				style.width = width;
				style.minWidth = minWidth;
				style.maxWidth = maxWidth;
			}
		}

		// Support: IE
		// IE returns zIndex value as an integer.
		return ret === undefined ?
			ret :
			ret + "";
	};
} else if ( document.documentElement.currentStyle ) {
	getStyles = function( elem ) {
		return elem.currentStyle;
	};

	curCSS = function( elem, name, computed ) {
		var left, rs, rsLeft, ret,
			style = elem.style;

		computed = computed || getStyles( elem );
		ret = computed ? computed[ name ] : undefined;

		// Avoid setting ret to empty string here
		// so we don't default to auto
		if ( ret == null && style && style[ name ] ) {
			ret = style[ name ];
		}

		// From the awesome hack by Dean Edwards
		// http://erik.eae.net/archives/2007/07/27/18.54.15/#comment-102291

		// If we're not dealing with a regular pixel number
		// but a number that has a weird ending, we need to convert it to pixels
		// but not position css attributes, as those are proportional to the parent element instead
		// and we can't measure the parent instead because it might trigger a "stacking dolls" problem
		if ( rnumnonpx.test( ret ) && !rposition.test( name ) ) {

			// Remember the original values
			left = style.left;
			rs = elem.runtimeStyle;
			rsLeft = rs && rs.left;

			// Put in the new values to get a computed value out
			if ( rsLeft ) {
				rs.left = elem.currentStyle.left;
			}
			style.left = name === "fontSize" ? "1em" : ret;
			ret = style.pixelLeft + "px";

			// Revert the changed values
			style.left = left;
			if ( rsLeft ) {
				rs.left = rsLeft;
			}
		}

		// Support: IE
		// IE returns zIndex value as an integer.
		return ret === undefined ?
			ret :
			ret + "" || "auto";
	};
}




function addGetHookIf( conditionFn, hookFn ) {
	// Define the hook, we'll check on the first run if it's really needed.
	return {
		get: function() {
			var condition = conditionFn();

			if ( condition == null ) {
				// The test was not ready at this point; screw the hook this time
				// but check again when needed next time.
				return;
			}

			if ( condition ) {
				// Hook not needed (or it's not possible to use it due to missing dependency),
				// remove it.
				// Since there are no other hooks for marginRight, remove the whole object.
				delete this.get;
				return;
			}

			// Hook needed; redefine it so that the support test is not executed again.

			return (this.get = hookFn).apply( this, arguments );
		}
	};
}


(function() {
	// Minified: var b,c,d,e,f,g, h,i
	var div, style, a, pixelPositionVal, boxSizingReliableVal,
		reliableHiddenOffsetsVal, reliableMarginRightVal;

	// Setup
	div = document.createElement( "div" );
	div.innerHTML = "  <link/><table></table><a href='/a'>a</a><input type='checkbox'/>";
	a = div.getElementsByTagName( "a" )[ 0 ];
	style = a && a.style;

	// Finish early in limited (non-browser) environments
	if ( !style ) {
		return;
	}

	style.cssText = "float:left;opacity:.5";

	// Support: IE<9
	// Make sure that element opacity exists (as opposed to filter)
	support.opacity = style.opacity === "0.5";

	// Verify style float existence
	// (IE uses styleFloat instead of cssFloat)
	support.cssFloat = !!style.cssFloat;

	div.style.backgroundClip = "content-box";
	div.cloneNode( true ).style.backgroundClip = "";
	support.clearCloneStyle = div.style.backgroundClip === "content-box";

	// Support: Firefox<29, Android 2.3
	// Vendor-prefix box-sizing
	support.boxSizing = style.boxSizing === "" || style.MozBoxSizing === "" ||
		style.WebkitBoxSizing === "";

	jQuery.extend(support, {
		reliableHiddenOffsets: function() {
			if ( reliableHiddenOffsetsVal == null ) {
				computeStyleTests();
			}
			return reliableHiddenOffsetsVal;
		},

		boxSizingReliable: function() {
			if ( boxSizingReliableVal == null ) {
				computeStyleTests();
			}
			return boxSizingReliableVal;
		},

		pixelPosition: function() {
			if ( pixelPositionVal == null ) {
				computeStyleTests();
			}
			return pixelPositionVal;
		},

		// Support: Android 2.3
		reliableMarginRight: function() {
			if ( reliableMarginRightVal == null ) {
				computeStyleTests();
			}
			return reliableMarginRightVal;
		}
	});

	function computeStyleTests() {
		// Minified: var b,c,d,j
		var div, body, container, contents;

		body = document.getElementsByTagName( "body" )[ 0 ];
		if ( !body || !body.style ) {
			// Test fired too early or in an unsupported environment, exit.
			return;
		}

		// Setup
		div = document.createElement( "div" );
		container = document.createElement( "div" );
		container.style.cssText = "position:absolute;border:0;width:0;height:0;top:0;left:-9999px";
		body.appendChild( container ).appendChild( div );

		div.style.cssText =
			// Support: Firefox<29, Android 2.3
			// Vendor-prefix box-sizing
			"-webkit-box-sizing:border-box;-moz-box-sizing:border-box;" +
			"box-sizing:border-box;display:block;margin-top:1%;top:1%;" +
			"border:1px;padding:1px;width:4px;position:absolute";

		// Support: IE<9
		// Assume reasonable values in the absence of getComputedStyle
		pixelPositionVal = boxSizingReliableVal = false;
		reliableMarginRightVal = true;

		// Check for getComputedStyle so that this code is not run in IE<9.
		if ( window.getComputedStyle ) {
			pixelPositionVal = ( window.getComputedStyle( div, null ) || {} ).top !== "1%";
			boxSizingReliableVal =
				( window.getComputedStyle( div, null ) || { width: "4px" } ).width === "4px";

			// Support: Android 2.3
			// Div with explicit width and no margin-right incorrectly
			// gets computed margin-right based on width of container (#3333)
			// WebKit Bug 13343 - getComputedStyle returns wrong value for margin-right
			contents = div.appendChild( document.createElement( "div" ) );

			// Reset CSS: box-sizing; display; margin; border; padding
			contents.style.cssText = div.style.cssText =
				// Support: Firefox<29, Android 2.3
				// Vendor-prefix box-sizing
				"-webkit-box-sizing:content-box;-moz-box-sizing:content-box;" +
				"box-sizing:content-box;display:block;margin:0;border:0;padding:0";
			contents.style.marginRight = contents.style.width = "0";
			div.style.width = "1px";

			reliableMarginRightVal =
				!parseFloat( ( window.getComputedStyle( contents, null ) || {} ).marginRight );
		}

		// Support: IE8
		// Check if table cells still have offsetWidth/Height when they are set
		// to display:none and there are still other visible table cells in a
		// table row; if so, offsetWidth/Height are not reliable for use when
		// determining if an element has been hidden directly using
		// display:none (it is still safe to use offsets if a parent element is
		// hidden; don safety goggles and see bug #4512 for more information).
		div.innerHTML = "<table><tr><td></td><td>t</td></tr></table>";
		contents = div.getElementsByTagName( "td" );
		contents[ 0 ].style.cssText = "margin:0;border:0;padding:0;display:none";
		reliableHiddenOffsetsVal = contents[ 0 ].offsetHeight === 0;
		if ( reliableHiddenOffsetsVal ) {
			contents[ 0 ].style.display = "";
			contents[ 1 ].style.display = "none";
			reliableHiddenOffsetsVal = contents[ 0 ].offsetHeight === 0;
		}

		body.removeChild( container );
	}

})();


// A method for quickly swapping in/out CSS properties to get correct calculations.
jQuery.swap = function( elem, options, callback, args ) {
	var ret, name,
		old = {};

	// Remember the old values, and insert the new ones
	for ( name in options ) {
		old[ name ] = elem.style[ name ];
		elem.style[ name ] = options[ name ];
	}

	ret = callback.apply( elem, args || [] );

	// Revert the old values
	for ( name in options ) {
		elem.style[ name ] = old[ name ];
	}

	return ret;
};


var
		ralpha = /alpha\([^)]*\)/i,
	ropacity = /opacity\s*=\s*([^)]*)/,

	// swappable if display is none or starts with table except "table", "table-cell", or "table-caption"
	// see here for display values: https://developer.mozilla.org/en-US/docs/CSS/display
	rdisplayswap = /^(none|table(?!-c[ea]).+)/,
	rnumsplit = new RegExp( "^(" + pnum + ")(.*)$", "i" ),
	rrelNum = new RegExp( "^([+-])=(" + pnum + ")", "i" ),

	cssShow = { position: "absolute", visibility: "hidden", display: "block" },
	cssNormalTransform = {
		letterSpacing: "0",
		fontWeight: "400"
	},

	cssPrefixes = [ "Webkit", "O", "Moz", "ms" ];


// return a css property mapped to a potentially vendor prefixed property
function vendorPropName( style, name ) {

	// shortcut for names that are not vendor prefixed
	if ( name in style ) {
		return name;
	}

	// check for vendor prefixed names
	var capName = name.charAt(0).toUpperCase() + name.slice(1),
		origName = name,
		i = cssPrefixes.length;

	while ( i-- ) {
		name = cssPrefixes[ i ] + capName;
		if ( name in style ) {
			return name;
		}
	}

	return origName;
}

function showHide( elements, show ) {
	var display, elem, hidden,
		values = [],
		index = 0,
		length = elements.length;

	for ( ; index < length; index++ ) {
		elem = elements[ index ];
		if ( !elem.style ) {
			continue;
		}

		values[ index ] = jQuery._data( elem, "olddisplay" );
		display = elem.style.display;
		if ( show ) {
			// Reset the inline display of this element to learn if it is
			// being hidden by cascaded rules or not
			if ( !values[ index ] && display === "none" ) {
				elem.style.display = "";
			}

			// Set elements which have been overridden with display: none
			// in a stylesheet to whatever the default browser style is
			// for such an element
			if ( elem.style.display === "" && isHidden( elem ) ) {
				values[ index ] = jQuery._data( elem, "olddisplay", defaultDisplay(elem.nodeName) );
			}
		} else {
			hidden = isHidden( elem );

			if ( display && display !== "none" || !hidden ) {
				jQuery._data( elem, "olddisplay", hidden ? display : jQuery.css( elem, "display" ) );
			}
		}
	}

	// Set the display of most of the elements in a second loop
	// to avoid the constant reflow
	for ( index = 0; index < length; index++ ) {
		elem = elements[ index ];
		if ( !elem.style ) {
			continue;
		}
		if ( !show || elem.style.display === "none" || elem.style.display === "" ) {
			elem.style.display = show ? values[ index ] || "" : "none";
		}
	}

	return elements;
}

function setPositiveNumber( elem, value, subtract ) {
	var matches = rnumsplit.exec( value );
	return matches ?
		// Guard against undefined "subtract", e.g., when used as in cssHooks
		Math.max( 0, matches[ 1 ] - ( subtract || 0 ) ) + ( matches[ 2 ] || "px" ) :
		value;
}

function augmentWidthOrHeight( elem, name, extra, isBorderBox, styles ) {
	var i = extra === ( isBorderBox ? "border" : "content" ) ?
		// If we already have the right measurement, avoid augmentation
		4 :
		// Otherwise initialize for horizontal or vertical properties
		name === "width" ? 1 : 0,

		val = 0;

	for ( ; i < 4; i += 2 ) {
		// both box models exclude margin, so add it if we want it
		if ( extra === "margin" ) {
			val += jQuery.css( elem, extra + cssExpand[ i ], true, styles );
		}

		if ( isBorderBox ) {
			// border-box includes padding, so remove it if we want content
			if ( extra === "content" ) {
				val -= jQuery.css( elem, "padding" + cssExpand[ i ], true, styles );
			}

			// at this point, extra isn't border nor margin, so remove border
			if ( extra !== "margin" ) {
				val -= jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );
			}
		} else {
			// at this point, extra isn't content, so add padding
			val += jQuery.css( elem, "padding" + cssExpand[ i ], true, styles );

			// at this point, extra isn't content nor padding, so add border
			if ( extra !== "padding" ) {
				val += jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );
			}
		}
	}

	return val;
}

function getWidthOrHeight( elem, name, extra ) {

	// Start with offset property, which is equivalent to the border-box value
	var valueIsBorderBox = true,
		val = name === "width" ? elem.offsetWidth : elem.offsetHeight,
		styles = getStyles( elem ),
		isBorderBox = support.boxSizing && jQuery.css( elem, "boxSizing", false, styles ) === "border-box";

	// some non-html elements return undefined for offsetWidth, so check for null/undefined
	// svg - https://bugzilla.mozilla.org/show_bug.cgi?id=649285
	// MathML - https://bugzilla.mozilla.org/show_bug.cgi?id=491668
	if ( val <= 0 || val == null ) {
		// Fall back to computed then uncomputed css if necessary
		val = curCSS( elem, name, styles );
		if ( val < 0 || val == null ) {
			val = elem.style[ name ];
		}

		// Computed unit is not pixels. Stop here and return.
		if ( rnumnonpx.test(val) ) {
			return val;
		}

		// we need the check for style in case a browser which returns unreliable values
		// for getComputedStyle silently falls back to the reliable elem.style
		valueIsBorderBox = isBorderBox && ( support.boxSizingReliable() || val === elem.style[ name ] );

		// Normalize "", auto, and prepare for extra
		val = parseFloat( val ) || 0;
	}

	// use the active box-sizing model to add/subtract irrelevant styles
	return ( val +
		augmentWidthOrHeight(
			elem,
			name,
			extra || ( isBorderBox ? "border" : "content" ),
			valueIsBorderBox,
			styles
		)
	) + "px";
}

jQuery.extend({
	// Add in style property hooks for overriding the default
	// behavior of getting and setting a style property
	cssHooks: {
		opacity: {
			get: function( elem, computed ) {
				if ( computed ) {
					// We should always get a number back from opacity
					var ret = curCSS( elem, "opacity" );
					return ret === "" ? "1" : ret;
				}
			}
		}
	},

	// Don't automatically add "px" to these possibly-unitless properties
	cssNumber: {
		"columnCount": true,
		"fillOpacity": true,
		"flexGrow": true,
		"flexShrink": true,
		"fontWeight": true,
		"lineHeight": true,
		"opacity": true,
		"order": true,
		"orphans": true,
		"widows": true,
		"zIndex": true,
		"zoom": true
	},

	// Add in properties whose names you wish to fix before
	// setting or getting the value
	cssProps: {
		// normalize float css property
		"float": support.cssFloat ? "cssFloat" : "styleFloat"
	},

	// Get and set the style property on a DOM Node
	style: function( elem, name, value, extra ) {
		// Don't set styles on text and comment nodes
		if ( !elem || elem.nodeType === 3 || elem.nodeType === 8 || !elem.style ) {
			return;
		}

		// Make sure that we're working with the right name
		var ret, type, hooks,
			origName = jQuery.camelCase( name ),
			style = elem.style;

		name = jQuery.cssProps[ origName ] || ( jQuery.cssProps[ origName ] = vendorPropName( style, origName ) );

		// gets hook for the prefixed version
		// followed by the unprefixed version
		hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];

		// Check if we're setting a value
		if ( value !== undefined ) {
			type = typeof value;

			// convert relative number strings (+= or -=) to relative numbers. #7345
			if ( type === "string" && (ret = rrelNum.exec( value )) ) {
				value = ( ret[1] + 1 ) * ret[2] + parseFloat( jQuery.css( elem, name ) );
				// Fixes bug #9237
				type = "number";
			}

			// Make sure that null and NaN values aren't set. See: #7116
			if ( value == null || value !== value ) {
				return;
			}

			// If a number was passed in, add 'px' to the (except for certain CSS properties)
			if ( type === "number" && !jQuery.cssNumber[ origName ] ) {
				value += "px";
			}

			// Fixes #8908, it can be done more correctly by specifing setters in cssHooks,
			// but it would mean to define eight (for every problematic property) identical functions
			if ( !support.clearCloneStyle && value === "" && name.indexOf("background") === 0 ) {
				style[ name ] = "inherit";
			}

			// If a hook was provided, use that value, otherwise just set the specified value
			if ( !hooks || !("set" in hooks) || (value = hooks.set( elem, value, extra )) !== undefined ) {

				// Support: IE
				// Swallow errors from 'invalid' CSS values (#5509)
				try {
					style[ name ] = value;
				} catch(e) {}
			}

		} else {
			// If a hook was provided get the non-computed value from there
			if ( hooks && "get" in hooks && (ret = hooks.get( elem, false, extra )) !== undefined ) {
				return ret;
			}

			// Otherwise just get the value from the style object
			return style[ name ];
		}
	},

	css: function( elem, name, extra, styles ) {
		var num, val, hooks,
			origName = jQuery.camelCase( name );

		// Make sure that we're working with the right name
		name = jQuery.cssProps[ origName ] || ( jQuery.cssProps[ origName ] = vendorPropName( elem.style, origName ) );

		// gets hook for the prefixed version
		// followed by the unprefixed version
		hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];

		// If a hook was provided get the computed value from there
		if ( hooks && "get" in hooks ) {
			val = hooks.get( elem, true, extra );
		}

		// Otherwise, if a way to get the computed value exists, use that
		if ( val === undefined ) {
			val = curCSS( elem, name, styles );
		}

		//convert "normal" to computed value
		if ( val === "normal" && name in cssNormalTransform ) {
			val = cssNormalTransform[ name ];
		}

		// Return, converting to number if forced or a qualifier was provided and val looks numeric
		if ( extra === "" || extra ) {
			num = parseFloat( val );
			return extra === true || jQuery.isNumeric( num ) ? num || 0 : val;
		}
		return val;
	}
});

jQuery.each([ "height", "width" ], function( i, name ) {
	jQuery.cssHooks[ name ] = {
		get: function( elem, computed, extra ) {
			if ( computed ) {
				// certain elements can have dimension info if we invisibly show them
				// however, it must have a current display style that would benefit from this
				return rdisplayswap.test( jQuery.css( elem, "display" ) ) && elem.offsetWidth === 0 ?
					jQuery.swap( elem, cssShow, function() {
						return getWidthOrHeight( elem, name, extra );
					}) :
					getWidthOrHeight( elem, name, extra );
			}
		},

		set: function( elem, value, extra ) {
			var styles = extra && getStyles( elem );
			return setPositiveNumber( elem, value, extra ?
				augmentWidthOrHeight(
					elem,
					name,
					extra,
					support.boxSizing && jQuery.css( elem, "boxSizing", false, styles ) === "border-box",
					styles
				) : 0
			);
		}
	};
});

if ( !support.opacity ) {
	jQuery.cssHooks.opacity = {
		get: function( elem, computed ) {
			// IE uses filters for opacity
			return ropacity.test( (computed && elem.currentStyle ? elem.currentStyle.filter : elem.style.filter) || "" ) ?
				( 0.01 * parseFloat( RegExp.$1 ) ) + "" :
				computed ? "1" : "";
		},

		set: function( elem, value ) {
			var style = elem.style,
				currentStyle = elem.currentStyle,
				opacity = jQuery.isNumeric( value ) ? "alpha(opacity=" + value * 100 + ")" : "",
				filter = currentStyle && currentStyle.filter || style.filter || "";

			// IE has trouble with opacity if it does not have layout
			// Force it by setting the zoom level
			style.zoom = 1;

			// if setting opacity to 1, and no other filters exist - attempt to remove filter attribute #6652
			// if value === "", then remove inline opacity #12685
			if ( ( value >= 1 || value === "" ) &&
					jQuery.trim( filter.replace( ralpha, "" ) ) === "" &&
					style.removeAttribute ) {

				// Setting style.filter to null, "" & " " still leave "filter:" in the cssText
				// if "filter:" is present at all, clearType is disabled, we want to avoid this
				// style.removeAttribute is IE Only, but so apparently is this code path...
				style.removeAttribute( "filter" );

				// if there is no filter style applied in a css rule or unset inline opacity, we are done
				if ( value === "" || currentStyle && !currentStyle.filter ) {
					return;
				}
			}

			// otherwise, set new filter values
			style.filter = ralpha.test( filter ) ?
				filter.replace( ralpha, opacity ) :
				filter + " " + opacity;
		}
	};
}

jQuery.cssHooks.marginRight = addGetHookIf( support.reliableMarginRight,
	function( elem, computed ) {
		if ( computed ) {
			// WebKit Bug 13343 - getComputedStyle returns wrong value for margin-right
			// Work around by temporarily setting element display to inline-block
			return jQuery.swap( elem, { "display": "inline-block" },
				curCSS, [ elem, "marginRight" ] );
		}
	}
);

// These hooks are used by animate to expand properties
jQuery.each({
	margin: "",
	padding: "",
	border: "Width"
}, function( prefix, suffix ) {
	jQuery.cssHooks[ prefix + suffix ] = {
		expand: function( value ) {
			var i = 0,
				expanded = {},

				// assumes a single number if not a string
				parts = typeof value === "string" ? value.split(" ") : [ value ];

			for ( ; i < 4; i++ ) {
				expanded[ prefix + cssExpand[ i ] + suffix ] =
					parts[ i ] || parts[ i - 2 ] || parts[ 0 ];
			}

			return expanded;
		}
	};

	if ( !rmargin.test( prefix ) ) {
		jQuery.cssHooks[ prefix + suffix ].set = setPositiveNumber;
	}
});

jQuery.fn.extend({
	css: function( name, value ) {
		return access( this, function( elem, name, value ) {
			var styles, len,
				map = {},
				i = 0;

			if ( jQuery.isArray( name ) ) {
				styles = getStyles( elem );
				len = name.length;

				for ( ; i < len; i++ ) {
					map[ name[ i ] ] = jQuery.css( elem, name[ i ], false, styles );
				}

				return map;
			}

			return value !== undefined ?
				jQuery.style( elem, name, value ) :
				jQuery.css( elem, name );
		}, name, value, arguments.length > 1 );
	},
	show: function() {
		return showHide( this, true );
	},
	hide: function() {
		return showHide( this );
	},
	toggle: function( state ) {
		if ( typeof state === "boolean" ) {
			return state ? this.show() : this.hide();
		}

		return this.each(function() {
			if ( isHidden( this ) ) {
				jQuery( this ).show();
			} else {
				jQuery( this ).hide();
			}
		});
	}
});


function Tween( elem, options, prop, end, easing ) {
	return new Tween.prototype.init( elem, options, prop, end, easing );
}
jQuery.Tween = Tween;

Tween.prototype = {
	constructor: Tween,
	init: function( elem, options, prop, end, easing, unit ) {
		this.elem = elem;
		this.prop = prop;
		this.easing = easing || "swing";
		this.options = options;
		this.start = this.now = this.cur();
		this.end = end;
		this.unit = unit || ( jQuery.cssNumber[ prop ] ? "" : "px" );
	},
	cur: function() {
		var hooks = Tween.propHooks[ this.prop ];

		return hooks && hooks.get ?
			hooks.get( this ) :
			Tween.propHooks._default.get( this );
	},
	run: function( percent ) {
		var eased,
			hooks = Tween.propHooks[ this.prop ];

		if ( this.options.duration ) {
			this.pos = eased = jQuery.easing[ this.easing ](
				percent, this.options.duration * percent, 0, 1, this.options.duration
			);
		} else {
			this.pos = eased = percent;
		}
		this.now = ( this.end - this.start ) * eased + this.start;

		if ( this.options.step ) {
			this.options.step.call( this.elem, this.now, this );
		}

		if ( hooks && hooks.set ) {
			hooks.set( this );
		} else {
			Tween.propHooks._default.set( this );
		}
		return this;
	}
};

Tween.prototype.init.prototype = Tween.prototype;

Tween.propHooks = {
	_default: {
		get: function( tween ) {
			var result;

			if ( tween.elem[ tween.prop ] != null &&
				(!tween.elem.style || tween.elem.style[ tween.prop ] == null) ) {
				return tween.elem[ tween.prop ];
			}

			// passing an empty string as a 3rd parameter to .css will automatically
			// attempt a parseFloat and fallback to a string if the parse fails
			// so, simple values such as "10px" are parsed to Float.
			// complex values such as "rotate(1rad)" are returned as is.
			result = jQuery.css( tween.elem, tween.prop, "" );
			// Empty strings, null, undefined and "auto" are converted to 0.
			return !result || result === "auto" ? 0 : result;
		},
		set: function( tween ) {
			// use step hook for back compat - use cssHook if its there - use .style if its
			// available and use plain properties where available
			if ( jQuery.fx.step[ tween.prop ] ) {
				jQuery.fx.step[ tween.prop ]( tween );
			} else if ( tween.elem.style && ( tween.elem.style[ jQuery.cssProps[ tween.prop ] ] != null || jQuery.cssHooks[ tween.prop ] ) ) {
				jQuery.style( tween.elem, tween.prop, tween.now + tween.unit );
			} else {
				tween.elem[ tween.prop ] = tween.now;
			}
		}
	}
};

// Support: IE <=9
// Panic based approach to setting things on disconnected nodes

Tween.propHooks.scrollTop = Tween.propHooks.scrollLeft = {
	set: function( tween ) {
		if ( tween.elem.nodeType && tween.elem.parentNode ) {
			tween.elem[ tween.prop ] = tween.now;
		}
	}
};

jQuery.easing = {
	linear: function( p ) {
		return p;
	},
	swing: function( p ) {
		return 0.5 - Math.cos( p * Math.PI ) / 2;
	}
};

jQuery.fx = Tween.prototype.init;

// Back Compat <1.8 extension point
jQuery.fx.step = {};




var
	fxNow, timerId,
	rfxtypes = /^(?:toggle|show|hide)$/,
	rfxnum = new RegExp( "^(?:([+-])=|)(" + pnum + ")([a-z%]*)$", "i" ),
	rrun = /queueHooks$/,
	animationPrefilters = [ defaultPrefilter ],
	tweeners = {
		"*": [ function( prop, value ) {
			var tween = this.createTween( prop, value ),
				target = tween.cur(),
				parts = rfxnum.exec( value ),
				unit = parts && parts[ 3 ] || ( jQuery.cssNumber[ prop ] ? "" : "px" ),

				// Starting value computation is required for potential unit mismatches
				start = ( jQuery.cssNumber[ prop ] || unit !== "px" && +target ) &&
					rfxnum.exec( jQuery.css( tween.elem, prop ) ),
				scale = 1,
				maxIterations = 20;

			if ( start && start[ 3 ] !== unit ) {
				// Trust units reported by jQuery.css
				unit = unit || start[ 3 ];

				// Make sure we update the tween properties later on
				parts = parts || [];

				// Iteratively approximate from a nonzero starting point
				start = +target || 1;

				do {
					// If previous iteration zeroed out, double until we get *something*
					// Use a string for doubling factor so we don't accidentally see scale as unchanged below
					scale = scale || ".5";

					// Adjust and apply
					start = start / scale;
					jQuery.style( tween.elem, prop, start + unit );

				// Update scale, tolerating zero or NaN from tween.cur()
				// And breaking the loop if scale is unchanged or perfect, or if we've just had enough
				} while ( scale !== (scale = tween.cur() / target) && scale !== 1 && --maxIterations );
			}

			// Update tween properties
			if ( parts ) {
				start = tween.start = +start || +target || 0;
				tween.unit = unit;
				// If a +=/-= token was provided, we're doing a relative animation
				tween.end = parts[ 1 ] ?
					start + ( parts[ 1 ] + 1 ) * parts[ 2 ] :
					+parts[ 2 ];
			}

			return tween;
		} ]
	};

// Animations created synchronously will run synchronously
function createFxNow() {
	setTimeout(function() {
		fxNow = undefined;
	});
	return ( fxNow = jQuery.now() );
}

// Generate parameters to create a standard animation
function genFx( type, includeWidth ) {
	var which,
		attrs = { height: type },
		i = 0;

	// if we include width, step value is 1 to do all cssExpand values,
	// if we don't include width, step value is 2 to skip over Left and Right
	includeWidth = includeWidth ? 1 : 0;
	for ( ; i < 4 ; i += 2 - includeWidth ) {
		which = cssExpand[ i ];
		attrs[ "margin" + which ] = attrs[ "padding" + which ] = type;
	}

	if ( includeWidth ) {
		attrs.opacity = attrs.width = type;
	}

	return attrs;
}

function createTween( value, prop, animation ) {
	var tween,
		collection = ( tweeners[ prop ] || [] ).concat( tweeners[ "*" ] ),
		index = 0,
		length = collection.length;
	for ( ; index < length; index++ ) {
		if ( (tween = collection[ index ].call( animation, prop, value )) ) {

			// we're done with this property
			return tween;
		}
	}
}

function defaultPrefilter( elem, props, opts ) {
	/* jshint validthis: true */
	var prop, value, toggle, tween, hooks, oldfire, display, checkDisplay,
		anim = this,
		orig = {},
		style = elem.style,
		hidden = elem.nodeType && isHidden( elem ),
		dataShow = jQuery._data( elem, "fxshow" );

	// handle queue: false promises
	if ( !opts.queue ) {
		hooks = jQuery._queueHooks( elem, "fx" );
		if ( hooks.unqueued == null ) {
			hooks.unqueued = 0;
			oldfire = hooks.empty.fire;
			hooks.empty.fire = function() {
				if ( !hooks.unqueued ) {
					oldfire();
				}
			};
		}
		hooks.unqueued++;

		anim.always(function() {
			// doing this makes sure that the complete handler will be called
			// before this completes
			anim.always(function() {
				hooks.unqueued--;
				if ( !jQuery.queue( elem, "fx" ).length ) {
					hooks.empty.fire();
				}
			});
		});
	}

	// height/width overflow pass
	if ( elem.nodeType === 1 && ( "height" in props || "width" in props ) ) {
		// Make sure that nothing sneaks out
		// Record all 3 overflow attributes because IE does not
		// change the overflow attribute when overflowX and
		// overflowY are set to the same value
		opts.overflow = [ style.overflow, style.overflowX, style.overflowY ];

		// Set display property to inline-block for height/width
		// animations on inline elements that are having width/height animated
		display = jQuery.css( elem, "display" );

		// Test default display if display is currently "none"
		checkDisplay = display === "none" ?
			jQuery._data( elem, "olddisplay" ) || defaultDisplay( elem.nodeName ) : display;

		if ( checkDisplay === "inline" && jQuery.css( elem, "float" ) === "none" ) {

			// inline-level elements accept inline-block;
			// block-level elements need to be inline with layout
			if ( !support.inlineBlockNeedsLayout || defaultDisplay( elem.nodeName ) === "inline" ) {
				style.display = "inline-block";
			} else {
				style.zoom = 1;
			}
		}
	}

	if ( opts.overflow ) {
		style.overflow = "hidden";
		if ( !support.shrinkWrapBlocks() ) {
			anim.always(function() {
				style.overflow = opts.overflow[ 0 ];
				style.overflowX = opts.overflow[ 1 ];
				style.overflowY = opts.overflow[ 2 ];
			});
		}
	}

	// show/hide pass
	for ( prop in props ) {
		value = props[ prop ];
		if ( rfxtypes.exec( value ) ) {
			delete props[ prop ];
			toggle = toggle || value === "toggle";
			if ( value === ( hidden ? "hide" : "show" ) ) {

				// If there is dataShow left over from a stopped hide or show and we are going to proceed with show, we should pretend to be hidden
				if ( value === "show" && dataShow && dataShow[ prop ] !== undefined ) {
					hidden = true;
				} else {
					continue;
				}
			}
			orig[ prop ] = dataShow && dataShow[ prop ] || jQuery.style( elem, prop );

		// Any non-fx value stops us from restoring the original display value
		} else {
			display = undefined;
		}
	}

	if ( !jQuery.isEmptyObject( orig ) ) {
		if ( dataShow ) {
			if ( "hidden" in dataShow ) {
				hidden = dataShow.hidden;
			}
		} else {
			dataShow = jQuery._data( elem, "fxshow", {} );
		}

		// store state if its toggle - enables .stop().toggle() to "reverse"
		if ( toggle ) {
			dataShow.hidden = !hidden;
		}
		if ( hidden ) {
			jQuery( elem ).show();
		} else {
			anim.done(function() {
				jQuery( elem ).hide();
			});
		}
		anim.done(function() {
			var prop;
			jQuery._removeData( elem, "fxshow" );
			for ( prop in orig ) {
				jQuery.style( elem, prop, orig[ prop ] );
			}
		});
		for ( prop in orig ) {
			tween = createTween( hidden ? dataShow[ prop ] : 0, prop, anim );

			if ( !( prop in dataShow ) ) {
				dataShow[ prop ] = tween.start;
				if ( hidden ) {
					tween.end = tween.start;
					tween.start = prop === "width" || prop === "height" ? 1 : 0;
				}
			}
		}

	// If this is a noop like .hide().hide(), restore an overwritten display value
	} else if ( (display === "none" ? defaultDisplay( elem.nodeName ) : display) === "inline" ) {
		style.display = display;
	}
}

function propFilter( props, specialEasing ) {
	var index, name, easing, value, hooks;

	// camelCase, specialEasing and expand cssHook pass
	for ( index in props ) {
		name = jQuery.camelCase( index );
		easing = specialEasing[ name ];
		value = props[ index ];
		if ( jQuery.isArray( value ) ) {
			easing = value[ 1 ];
			value = props[ index ] = value[ 0 ];
		}

		if ( index !== name ) {
			props[ name ] = value;
			delete props[ index ];
		}

		hooks = jQuery.cssHooks[ name ];
		if ( hooks && "expand" in hooks ) {
			value = hooks.expand( value );
			delete props[ name ];

			// not quite $.extend, this wont overwrite keys already present.
			// also - reusing 'index' from above because we have the correct "name"
			for ( index in value ) {
				if ( !( index in props ) ) {
					props[ index ] = value[ index ];
					specialEasing[ index ] = easing;
				}
			}
		} else {
			specialEasing[ name ] = easing;
		}
	}
}

function Animation( elem, properties, options ) {
	var result,
		stopped,
		index = 0,
		length = animationPrefilters.length,
		deferred = jQuery.Deferred().always( function() {
			// don't match elem in the :animated selector
			delete tick.elem;
		}),
		tick = function() {
			if ( stopped ) {
				return false;
			}
			var currentTime = fxNow || createFxNow(),
				remaining = Math.max( 0, animation.startTime + animation.duration - currentTime ),
				// archaic crash bug won't allow us to use 1 - ( 0.5 || 0 ) (#12497)
				temp = remaining / animation.duration || 0,
				percent = 1 - temp,
				index = 0,
				length = animation.tweens.length;

			for ( ; index < length ; index++ ) {
				animation.tweens[ index ].run( percent );
			}

			deferred.notifyWith( elem, [ animation, percent, remaining ]);

			if ( percent < 1 && length ) {
				return remaining;
			} else {
				deferred.resolveWith( elem, [ animation ] );
				return false;
			}
		},
		animation = deferred.promise({
			elem: elem,
			props: jQuery.extend( {}, properties ),
			opts: jQuery.extend( true, { specialEasing: {} }, options ),
			originalProperties: properties,
			originalOptions: options,
			startTime: fxNow || createFxNow(),
			duration: options.duration,
			tweens: [],
			createTween: function( prop, end ) {
				var tween = jQuery.Tween( elem, animation.opts, prop, end,
						animation.opts.specialEasing[ prop ] || animation.opts.easing );
				animation.tweens.push( tween );
				return tween;
			},
			stop: function( gotoEnd ) {
				var index = 0,
					// if we are going to the end, we want to run all the tweens
					// otherwise we skip this part
					length = gotoEnd ? animation.tweens.length : 0;
				if ( stopped ) {
					return this;
				}
				stopped = true;
				for ( ; index < length ; index++ ) {
					animation.tweens[ index ].run( 1 );
				}

				// resolve when we played the last frame
				// otherwise, reject
				if ( gotoEnd ) {
					deferred.resolveWith( elem, [ animation, gotoEnd ] );
				} else {
					deferred.rejectWith( elem, [ animation, gotoEnd ] );
				}
				return this;
			}
		}),
		props = animation.props;

	propFilter( props, animation.opts.specialEasing );

	for ( ; index < length ; index++ ) {
		result = animationPrefilters[ index ].call( animation, elem, props, animation.opts );
		if ( result ) {
			return result;
		}
	}

	jQuery.map( props, createTween, animation );

	if ( jQuery.isFunction( animation.opts.start ) ) {
		animation.opts.start.call( elem, animation );
	}

	jQuery.fx.timer(
		jQuery.extend( tick, {
			elem: elem,
			anim: animation,
			queue: animation.opts.queue
		})
	);

	// attach callbacks from options
	return animation.progress( animation.opts.progress )
		.done( animation.opts.done, animation.opts.complete )
		.fail( animation.opts.fail )
		.always( animation.opts.always );
}

jQuery.Animation = jQuery.extend( Animation, {
	tweener: function( props, callback ) {
		if ( jQuery.isFunction( props ) ) {
			callback = props;
			props = [ "*" ];
		} else {
			props = props.split(" ");
		}

		var prop,
			index = 0,
			length = props.length;

		for ( ; index < length ; index++ ) {
			prop = props[ index ];
			tweeners[ prop ] = tweeners[ prop ] || [];
			tweeners[ prop ].unshift( callback );
		}
	},

	prefilter: function( callback, prepend ) {
		if ( prepend ) {
			animationPrefilters.unshift( callback );
		} else {
			animationPrefilters.push( callback );
		}
	}
});

jQuery.speed = function( speed, easing, fn ) {
	var opt = speed && typeof speed === "object" ? jQuery.extend( {}, speed ) : {
		complete: fn || !fn && easing ||
			jQuery.isFunction( speed ) && speed,
		duration: speed,
		easing: fn && easing || easing && !jQuery.isFunction( easing ) && easing
	};

	opt.duration = jQuery.fx.off ? 0 : typeof opt.duration === "number" ? opt.duration :
		opt.duration in jQuery.fx.speeds ? jQuery.fx.speeds[ opt.duration ] : jQuery.fx.speeds._default;

	// normalize opt.queue - true/undefined/null -> "fx"
	if ( opt.queue == null || opt.queue === true ) {
		opt.queue = "fx";
	}

	// Queueing
	opt.old = opt.complete;

	opt.complete = function() {
		if ( jQuery.isFunction( opt.old ) ) {
			opt.old.call( this );
		}

		if ( opt.queue ) {
			jQuery.dequeue( this, opt.queue );
		}
	};

	return opt;
};

jQuery.fn.extend({
	fadeTo: function( speed, to, easing, callback ) {

		// show any hidden elements after setting opacity to 0
		return this.filter( isHidden ).css( "opacity", 0 ).show()

			// animate to the value specified
			.end().animate({ opacity: to }, speed, easing, callback );
	},
	animate: function( prop, speed, easing, callback ) {
		var empty = jQuery.isEmptyObject( prop ),
			optall = jQuery.speed( speed, easing, callback ),
			doAnimation = function() {
				// Operate on a copy of prop so per-property easing won't be lost
				var anim = Animation( this, jQuery.extend( {}, prop ), optall );

				// Empty animations, or finishing resolves immediately
				if ( empty || jQuery._data( this, "finish" ) ) {
					anim.stop( true );
				}
			};
			doAnimation.finish = doAnimation;

		return empty || optall.queue === false ?
			this.each( doAnimation ) :
			this.queue( optall.queue, doAnimation );
	},
	stop: function( type, clearQueue, gotoEnd ) {
		var stopQueue = function( hooks ) {
			var stop = hooks.stop;
			delete hooks.stop;
			stop( gotoEnd );
		};

		if ( typeof type !== "string" ) {
			gotoEnd = clearQueue;
			clearQueue = type;
			type = undefined;
		}
		if ( clearQueue && type !== false ) {
			this.queue( type || "fx", [] );
		}

		return this.each(function() {
			var dequeue = true,
				index = type != null && type + "queueHooks",
				timers = jQuery.timers,
				data = jQuery._data( this );

			if ( index ) {
				if ( data[ index ] && data[ index ].stop ) {
					stopQueue( data[ index ] );
				}
			} else {
				for ( index in data ) {
					if ( data[ index ] && data[ index ].stop && rrun.test( index ) ) {
						stopQueue( data[ index ] );
					}
				}
			}

			for ( index = timers.length; index--; ) {
				if ( timers[ index ].elem === this && (type == null || timers[ index ].queue === type) ) {
					timers[ index ].anim.stop( gotoEnd );
					dequeue = false;
					timers.splice( index, 1 );
				}
			}

			// start the next in the queue if the last step wasn't forced
			// timers currently will call their complete callbacks, which will dequeue
			// but only if they were gotoEnd
			if ( dequeue || !gotoEnd ) {
				jQuery.dequeue( this, type );
			}
		});
	},
	finish: function( type ) {
		if ( type !== false ) {
			type = type || "fx";
		}
		return this.each(function() {
			var index,
				data = jQuery._data( this ),
				queue = data[ type + "queue" ],
				hooks = data[ type + "queueHooks" ],
				timers = jQuery.timers,
				length = queue ? queue.length : 0;

			// enable finishing flag on private data
			data.finish = true;

			// empty the queue first
			jQuery.queue( this, type, [] );

			if ( hooks && hooks.stop ) {
				hooks.stop.call( this, true );
			}

			// look for any active animations, and finish them
			for ( index = timers.length; index--; ) {
				if ( timers[ index ].elem === this && timers[ index ].queue === type ) {
					timers[ index ].anim.stop( true );
					timers.splice( index, 1 );
				}
			}

			// look for any animations in the old queue and finish them
			for ( index = 0; index < length; index++ ) {
				if ( queue[ index ] && queue[ index ].finish ) {
					queue[ index ].finish.call( this );
				}
			}

			// turn off finishing flag
			delete data.finish;
		});
	}
});

jQuery.each([ "toggle", "show", "hide" ], function( i, name ) {
	var cssFn = jQuery.fn[ name ];
	jQuery.fn[ name ] = function( speed, easing, callback ) {
		return speed == null || typeof speed === "boolean" ?
			cssFn.apply( this, arguments ) :
			this.animate( genFx( name, true ), speed, easing, callback );
	};
});

// Generate shortcuts for custom animations
jQuery.each({
	slideDown: genFx("show"),
	slideUp: genFx("hide"),
	slideToggle: genFx("toggle"),
	fadeIn: { opacity: "show" },
	fadeOut: { opacity: "hide" },
	fadeToggle: { opacity: "toggle" }
}, function( name, props ) {
	jQuery.fn[ name ] = function( speed, easing, callback ) {
		return this.animate( props, speed, easing, callback );
	};
});

jQuery.timers = [];
jQuery.fx.tick = function() {
	var timer,
		timers = jQuery.timers,
		i = 0;

	fxNow = jQuery.now();

	for ( ; i < timers.length; i++ ) {
		timer = timers[ i ];
		// Checks the timer has not already been removed
		if ( !timer() && timers[ i ] === timer ) {
			timers.splice( i--, 1 );
		}
	}

	if ( !timers.length ) {
		jQuery.fx.stop();
	}
	fxNow = undefined;
};

jQuery.fx.timer = function( timer ) {
	jQuery.timers.push( timer );
	if ( timer() ) {
		jQuery.fx.start();
	} else {
		jQuery.timers.pop();
	}
};

jQuery.fx.interval = 13;

jQuery.fx.start = function() {
	if ( !timerId ) {
		timerId = setInterval( jQuery.fx.tick, jQuery.fx.interval );
	}
};

jQuery.fx.stop = function() {
	clearInterval( timerId );
	timerId = null;
};

jQuery.fx.speeds = {
	slow: 600,
	fast: 200,
	// Default speed
	_default: 400
};


// Based off of the plugin by Clint Helfers, with permission.
// http://blindsignals.com/index.php/2009/07/jquery-delay/
jQuery.fn.delay = function( time, type ) {
	time = jQuery.fx ? jQuery.fx.speeds[ time ] || time : time;
	type = type || "fx";

	return this.queue( type, function( next, hooks ) {
		var timeout = setTimeout( next, time );
		hooks.stop = function() {
			clearTimeout( timeout );
		};
	});
};


(function() {
	// Minified: var a,b,c,d,e
	var input, div, select, a, opt;

	// Setup
	div = document.createElement( "div" );
	div.setAttribute( "className", "t" );
	div.innerHTML = "  <link/><table></table><a href='/a'>a</a><input type='checkbox'/>";
	a = div.getElementsByTagName("a")[ 0 ];

	// First batch of tests.
	select = document.createElement("select");
	opt = select.appendChild( document.createElement("option") );
	input = div.getElementsByTagName("input")[ 0 ];

	a.style.cssText = "top:1px";

	// Test setAttribute on camelCase class. If it works, we need attrFixes when doing get/setAttribute (ie6/7)
	support.getSetAttribute = div.className !== "t";

	// Get the style information from getAttribute
	// (IE uses .cssText instead)
	support.style = /top/.test( a.getAttribute("style") );

	// Make sure that URLs aren't manipulated
	// (IE normalizes it by default)
	support.hrefNormalized = a.getAttribute("href") === "/a";

	// Check the default checkbox/radio value ("" on WebKit; "on" elsewhere)
	support.checkOn = !!input.value;

	// Make sure that a selected-by-default option has a working selected property.
	// (WebKit defaults to false instead of true, IE too, if it's in an optgroup)
	support.optSelected = opt.selected;

	// Tests for enctype support on a form (#6743)
	support.enctype = !!document.createElement("form").enctype;

	// Make sure that the options inside disabled selects aren't marked as disabled
	// (WebKit marks them as disabled)
	select.disabled = true;
	support.optDisabled = !opt.disabled;

	// Support: IE8 only
	// Check if we can trust getAttribute("value")
	input = document.createElement( "input" );
	input.setAttribute( "value", "" );
	support.input = input.getAttribute( "value" ) === "";

	// Check if an input maintains its value after becoming a radio
	input.value = "t";
	input.setAttribute( "type", "radio" );
	support.radioValue = input.value === "t";
})();


var rreturn = /\r/g;

jQuery.fn.extend({
	val: function( value ) {
		var hooks, ret, isFunction,
			elem = this[0];

		if ( !arguments.length ) {
			if ( elem ) {
				hooks = jQuery.valHooks[ elem.type ] || jQuery.valHooks[ elem.nodeName.toLowerCase() ];

				if ( hooks && "get" in hooks && (ret = hooks.get( elem, "value" )) !== undefined ) {
					return ret;
				}

				ret = elem.value;

				return typeof ret === "string" ?
					// handle most common string cases
					ret.replace(rreturn, "") :
					// handle cases where value is null/undef or number
					ret == null ? "" : ret;
			}

			return;
		}

		isFunction = jQuery.isFunction( value );

		return this.each(function( i ) {
			var val;

			if ( this.nodeType !== 1 ) {
				return;
			}

			if ( isFunction ) {
				val = value.call( this, i, jQuery( this ).val() );
			} else {
				val = value;
			}

			// Treat null/undefined as ""; convert numbers to string
			if ( val == null ) {
				val = "";
			} else if ( typeof val === "number" ) {
				val += "";
			} else if ( jQuery.isArray( val ) ) {
				val = jQuery.map( val, function( value ) {
					return value == null ? "" : value + "";
				});
			}

			hooks = jQuery.valHooks[ this.type ] || jQuery.valHooks[ this.nodeName.toLowerCase() ];

			// If set returns undefined, fall back to normal setting
			if ( !hooks || !("set" in hooks) || hooks.set( this, val, "value" ) === undefined ) {
				this.value = val;
			}
		});
	}
});

jQuery.extend({
	valHooks: {
		option: {
			get: function( elem ) {
				var val = jQuery.find.attr( elem, "value" );
				return val != null ?
					val :
					// Support: IE10-11+
					// option.text throws exceptions (#14686, #14858)
					jQuery.trim( jQuery.text( elem ) );
			}
		},
		select: {
			get: function( elem ) {
				var value, option,
					options = elem.options,
					index = elem.selectedIndex,
					one = elem.type === "select-one" || index < 0,
					values = one ? null : [],
					max = one ? index + 1 : options.length,
					i = index < 0 ?
						max :
						one ? index : 0;

				// Loop through all the selected options
				for ( ; i < max; i++ ) {
					option = options[ i ];

					// oldIE doesn't update selected after form reset (#2551)
					if ( ( option.selected || i === index ) &&
							// Don't return options that are disabled or in a disabled optgroup
							( support.optDisabled ? !option.disabled : option.getAttribute("disabled") === null ) &&
							( !option.parentNode.disabled || !jQuery.nodeName( option.parentNode, "optgroup" ) ) ) {

						// Get the specific value for the option
						value = jQuery( option ).val();

						// We don't need an array for one selects
						if ( one ) {
							return value;
						}

						// Multi-Selects return an array
						values.push( value );
					}
				}

				return values;
			},

			set: function( elem, value ) {
				var optionSet, option,
					options = elem.options,
					values = jQuery.makeArray( value ),
					i = options.length;

				while ( i-- ) {
					option = options[ i ];

					if ( jQuery.inArray( jQuery.valHooks.option.get( option ), values ) >= 0 ) {

						// Support: IE6
						// When new option element is added to select box we need to
						// force reflow of newly added node in order to workaround delay
						// of initialization properties
						try {
							option.selected = optionSet = true;

						} catch ( _ ) {

							// Will be executed only in IE6
							option.scrollHeight;
						}

					} else {
						option.selected = false;
					}
				}

				// Force browsers to behave consistently when non-matching value is set
				if ( !optionSet ) {
					elem.selectedIndex = -1;
				}

				return options;
			}
		}
	}
});

// Radios and checkboxes getter/setter
jQuery.each([ "radio", "checkbox" ], function() {
	jQuery.valHooks[ this ] = {
		set: function( elem, value ) {
			if ( jQuery.isArray( value ) ) {
				return ( elem.checked = jQuery.inArray( jQuery(elem).val(), value ) >= 0 );
			}
		}
	};
	if ( !support.checkOn ) {
		jQuery.valHooks[ this ].get = function( elem ) {
			// Support: Webkit
			// "" is returned instead of "on" if a value isn't specified
			return elem.getAttribute("value") === null ? "on" : elem.value;
		};
	}
});




var nodeHook, boolHook,
	attrHandle = jQuery.expr.attrHandle,
	ruseDefault = /^(?:checked|selected)$/i,
	getSetAttribute = support.getSetAttribute,
	getSetInput = support.input;

jQuery.fn.extend({
	attr: function( name, value ) {
		return access( this, jQuery.attr, name, value, arguments.length > 1 );
	},

	removeAttr: function( name ) {
		return this.each(function() {
			jQuery.removeAttr( this, name );
		});
	}
});

jQuery.extend({
	attr: function( elem, name, value ) {
		var hooks, ret,
			nType = elem.nodeType;

		// don't get/set attributes on text, comment and attribute nodes
		if ( !elem || nType === 3 || nType === 8 || nType === 2 ) {
			return;
		}

		// Fallback to prop when attributes are not supported
		if ( typeof elem.getAttribute === strundefined ) {
			return jQuery.prop( elem, name, value );
		}

		// All attributes are lowercase
		// Grab necessary hook if one is defined
		if ( nType !== 1 || !jQuery.isXMLDoc( elem ) ) {
			name = name.toLowerCase();
			hooks = jQuery.attrHooks[ name ] ||
				( jQuery.expr.match.bool.test( name ) ? boolHook : nodeHook );
		}

		if ( value !== undefined ) {

			if ( value === null ) {
				jQuery.removeAttr( elem, name );

			} else if ( hooks && "set" in hooks && (ret = hooks.set( elem, value, name )) !== undefined ) {
				return ret;

			} else {
				elem.setAttribute( name, value + "" );
				return value;
			}

		} else if ( hooks && "get" in hooks && (ret = hooks.get( elem, name )) !== null ) {
			return ret;

		} else {
			ret = jQuery.find.attr( elem, name );

			// Non-existent attributes return null, we normalize to undefined
			return ret == null ?
				undefined :
				ret;
		}
	},

	removeAttr: function( elem, value ) {
		var name, propName,
			i = 0,
			attrNames = value && value.match( rnotwhite );

		if ( attrNames && elem.nodeType === 1 ) {
			while ( (name = attrNames[i++]) ) {
				propName = jQuery.propFix[ name ] || name;

				// Boolean attributes get special treatment (#10870)
				if ( jQuery.expr.match.bool.test( name ) ) {
					// Set corresponding property to false
					if ( getSetInput && getSetAttribute || !ruseDefault.test( name ) ) {
						elem[ propName ] = false;
					// Support: IE<9
					// Also clear defaultChecked/defaultSelected (if appropriate)
					} else {
						elem[ jQuery.camelCase( "default-" + name ) ] =
							elem[ propName ] = false;
					}

				// See #9699 for explanation of this approach (setting first, then removal)
				} else {
					jQuery.attr( elem, name, "" );
				}

				elem.removeAttribute( getSetAttribute ? name : propName );
			}
		}
	},

	attrHooks: {
		type: {
			set: function( elem, value ) {
				if ( !support.radioValue && value === "radio" && jQuery.nodeName(elem, "input") ) {
					// Setting the type on a radio button after the value resets the value in IE6-9
					// Reset value to default in case type is set after value during creation
					var val = elem.value;
					elem.setAttribute( "type", value );
					if ( val ) {
						elem.value = val;
					}
					return value;
				}
			}
		}
	}
});

// Hook for boolean attributes
boolHook = {
	set: function( elem, value, name ) {
		if ( value === false ) {
			// Remove boolean attributes when set to false
			jQuery.removeAttr( elem, name );
		} else if ( getSetInput && getSetAttribute || !ruseDefault.test( name ) ) {
			// IE<8 needs the *property* name
			elem.setAttribute( !getSetAttribute && jQuery.propFix[ name ] || name, name );

		// Use defaultChecked and defaultSelected for oldIE
		} else {
			elem[ jQuery.camelCase( "default-" + name ) ] = elem[ name ] = true;
		}

		return name;
	}
};

// Retrieve booleans specially
jQuery.each( jQuery.expr.match.bool.source.match( /\w+/g ), function( i, name ) {

	var getter = attrHandle[ name ] || jQuery.find.attr;

	attrHandle[ name ] = getSetInput && getSetAttribute || !ruseDefault.test( name ) ?
		function( elem, name, isXML ) {
			var ret, handle;
			if ( !isXML ) {
				// Avoid an infinite loop by temporarily removing this function from the getter
				handle = attrHandle[ name ];
				attrHandle[ name ] = ret;
				ret = getter( elem, name, isXML ) != null ?
					name.toLowerCase() :
					null;
				attrHandle[ name ] = handle;
			}
			return ret;
		} :
		function( elem, name, isXML ) {
			if ( !isXML ) {
				return elem[ jQuery.camelCase( "default-" + name ) ] ?
					name.toLowerCase() :
					null;
			}
		};
});

// fix oldIE attroperties
if ( !getSetInput || !getSetAttribute ) {
	jQuery.attrHooks.value = {
		set: function( elem, value, name ) {
			if ( jQuery.nodeName( elem, "input" ) ) {
				// Does not return so that setAttribute is also used
				elem.defaultValue = value;
			} else {
				// Use nodeHook if defined (#1954); otherwise setAttribute is fine
				return nodeHook && nodeHook.set( elem, value, name );
			}
		}
	};
}

// IE6/7 do not support getting/setting some attributes with get/setAttribute
if ( !getSetAttribute ) {

	// Use this for any attribute in IE6/7
	// This fixes almost every IE6/7 issue
	nodeHook = {
		set: function( elem, value, name ) {
			// Set the existing or create a new attribute node
			var ret = elem.getAttributeNode( name );
			if ( !ret ) {
				elem.setAttributeNode(
					(ret = elem.ownerDocument.createAttribute( name ))
				);
			}

			ret.value = value += "";

			// Break association with cloned elements by also using setAttribute (#9646)
			if ( name === "value" || value === elem.getAttribute( name ) ) {
				return value;
			}
		}
	};

	// Some attributes are constructed with empty-string values when not defined
	attrHandle.id = attrHandle.name = attrHandle.coords =
		function( elem, name, isXML ) {
			var ret;
			if ( !isXML ) {
				return (ret = elem.getAttributeNode( name )) && ret.value !== "" ?
					ret.value :
					null;
			}
		};

	// Fixing value retrieval on a button requires this module
	jQuery.valHooks.button = {
		get: function( elem, name ) {
			var ret = elem.getAttributeNode( name );
			if ( ret && ret.specified ) {
				return ret.value;
			}
		},
		set: nodeHook.set
	};

	// Set contenteditable to false on removals(#10429)
	// Setting to empty string throws an error as an invalid value
	jQuery.attrHooks.contenteditable = {
		set: function( elem, value, name ) {
			nodeHook.set( elem, value === "" ? false : value, name );
		}
	};

	// Set width and height to auto instead of 0 on empty string( Bug #8150 )
	// This is for removals
	jQuery.each([ "width", "height" ], function( i, name ) {
		jQuery.attrHooks[ name ] = {
			set: function( elem, value ) {
				if ( value === "" ) {
					elem.setAttribute( name, "auto" );
					return value;
				}
			}
		};
	});
}

if ( !support.style ) {
	jQuery.attrHooks.style = {
		get: function( elem ) {
			// Return undefined in the case of empty string
			// Note: IE uppercases css property names, but if we were to .toLowerCase()
			// .cssText, that would destroy case senstitivity in URL's, like in "background"
			return elem.style.cssText || undefined;
		},
		set: function( elem, value ) {
			return ( elem.style.cssText = value + "" );
		}
	};
}




var rfocusable = /^(?:input|select|textarea|button|object)$/i,
	rclickable = /^(?:a|area)$/i;

jQuery.fn.extend({
	prop: function( name, value ) {
		return access( this, jQuery.prop, name, value, arguments.length > 1 );
	},

	removeProp: function( name ) {
		name = jQuery.propFix[ name ] || name;
		return this.each(function() {
			// try/catch handles cases where IE balks (such as removing a property on window)
			try {
				this[ name ] = undefined;
				delete this[ name ];
			} catch( e ) {}
		});
	}
});

jQuery.extend({
	propFix: {
		"for": "htmlFor",
		"class": "className"
	},

	prop: function( elem, name, value ) {
		var ret, hooks, notxml,
			nType = elem.nodeType;

		// don't get/set properties on text, comment and attribute nodes
		if ( !elem || nType === 3 || nType === 8 || nType === 2 ) {
			return;
		}

		notxml = nType !== 1 || !jQuery.isXMLDoc( elem );

		if ( notxml ) {
			// Fix name and attach hooks
			name = jQuery.propFix[ name ] || name;
			hooks = jQuery.propHooks[ name ];
		}

		if ( value !== undefined ) {
			return hooks && "set" in hooks && (ret = hooks.set( elem, value, name )) !== undefined ?
				ret :
				( elem[ name ] = value );

		} else {
			return hooks && "get" in hooks && (ret = hooks.get( elem, name )) !== null ?
				ret :
				elem[ name ];
		}
	},

	propHooks: {
		tabIndex: {
			get: function( elem ) {
				// elem.tabIndex doesn't always return the correct value when it hasn't been explicitly set
				// http://fluidproject.org/blog/2008/01/09/getting-setting-and-removing-tabindex-values-with-javascript/
				// Use proper attribute retrieval(#12072)
				var tabindex = jQuery.find.attr( elem, "tabindex" );

				return tabindex ?
					parseInt( tabindex, 10 ) :
					rfocusable.test( elem.nodeName ) || rclickable.test( elem.nodeName ) && elem.href ?
						0 :
						-1;
			}
		}
	}
});

// Some attributes require a special call on IE
// http://msdn.microsoft.com/en-us/library/ms536429%28VS.85%29.aspx
if ( !support.hrefNormalized ) {
	// href/src property should get the full normalized URL (#10299/#12915)
	jQuery.each([ "href", "src" ], function( i, name ) {
		jQuery.propHooks[ name ] = {
			get: function( elem ) {
				return elem.getAttribute( name, 4 );
			}
		};
	});
}

// Support: Safari, IE9+
// mis-reports the default selected property of an option
// Accessing the parent's selectedIndex property fixes it
if ( !support.optSelected ) {
	jQuery.propHooks.selected = {
		get: function( elem ) {
			var parent = elem.parentNode;

			if ( parent ) {
				parent.selectedIndex;

				// Make sure that it also works with optgroups, see #5701
				if ( parent.parentNode ) {
					parent.parentNode.selectedIndex;
				}
			}
			return null;
		}
	};
}

jQuery.each([
	"tabIndex",
	"readOnly",
	"maxLength",
	"cellSpacing",
	"cellPadding",
	"rowSpan",
	"colSpan",
	"useMap",
	"frameBorder",
	"contentEditable"
], function() {
	jQuery.propFix[ this.toLowerCase() ] = this;
});

// IE6/7 call enctype encoding
if ( !support.enctype ) {
	jQuery.propFix.enctype = "encoding";
}




var rclass = /[\t\r\n\f]/g;

jQuery.fn.extend({
	addClass: function( value ) {
		var classes, elem, cur, clazz, j, finalValue,
			i = 0,
			len = this.length,
			proceed = typeof value === "string" && value;

		if ( jQuery.isFunction( value ) ) {
			return this.each(function( j ) {
				jQuery( this ).addClass( value.call( this, j, this.className ) );
			});
		}

		if ( proceed ) {
			// The disjunction here is for better compressibility (see removeClass)
			classes = ( value || "" ).match( rnotwhite ) || [];

			for ( ; i < len; i++ ) {
				elem = this[ i ];
				cur = elem.nodeType === 1 && ( elem.className ?
					( " " + elem.className + " " ).replace( rclass, " " ) :
					" "
				);

				if ( cur ) {
					j = 0;
					while ( (clazz = classes[j++]) ) {
						if ( cur.indexOf( " " + clazz + " " ) < 0 ) {
							cur += clazz + " ";
						}
					}

					// only assign if different to avoid unneeded rendering.
					finalValue = jQuery.trim( cur );
					if ( elem.className !== finalValue ) {
						elem.className = finalValue;
					}
				}
			}
		}

		return this;
	},

	removeClass: function( value ) {
		var classes, elem, cur, clazz, j, finalValue,
			i = 0,
			len = this.length,
			proceed = arguments.length === 0 || typeof value === "string" && value;

		if ( jQuery.isFunction( value ) ) {
			return this.each(function( j ) {
				jQuery( this ).removeClass( value.call( this, j, this.className ) );
			});
		}
		if ( proceed ) {
			classes = ( value || "" ).match( rnotwhite ) || [];

			for ( ; i < len; i++ ) {
				elem = this[ i ];
				// This expression is here for better compressibility (see addClass)
				cur = elem.nodeType === 1 && ( elem.className ?
					( " " + elem.className + " " ).replace( rclass, " " ) :
					""
				);

				if ( cur ) {
					j = 0;
					while ( (clazz = classes[j++]) ) {
						// Remove *all* instances
						while ( cur.indexOf( " " + clazz + " " ) >= 0 ) {
							cur = cur.replace( " " + clazz + " ", " " );
						}
					}

					// only assign if different to avoid unneeded rendering.
					finalValue = value ? jQuery.trim( cur ) : "";
					if ( elem.className !== finalValue ) {
						elem.className = finalValue;
					}
				}
			}
		}

		return this;
	},

	toggleClass: function( value, stateVal ) {
		var type = typeof value;

		if ( typeof stateVal === "boolean" && type === "string" ) {
			return stateVal ? this.addClass( value ) : this.removeClass( value );
		}

		if ( jQuery.isFunction( value ) ) {
			return this.each(function( i ) {
				jQuery( this ).toggleClass( value.call(this, i, this.className, stateVal), stateVal );
			});
		}

		return this.each(function() {
			if ( type === "string" ) {
				// toggle individual class names
				var className,
					i = 0,
					self = jQuery( this ),
					classNames = value.match( rnotwhite ) || [];

				while ( (className = classNames[ i++ ]) ) {
					// check each className given, space separated list
					if ( self.hasClass( className ) ) {
						self.removeClass( className );
					} else {
						self.addClass( className );
					}
				}

			// Toggle whole class name
			} else if ( type === strundefined || type === "boolean" ) {
				if ( this.className ) {
					// store className if set
					jQuery._data( this, "__className__", this.className );
				}

				// If the element has a class name or if we're passed "false",
				// then remove the whole classname (if there was one, the above saved it).
				// Otherwise bring back whatever was previously saved (if anything),
				// falling back to the empty string if nothing was stored.
				this.className = this.className || value === false ? "" : jQuery._data( this, "__className__" ) || "";
			}
		});
	},

	hasClass: function( selector ) {
		var className = " " + selector + " ",
			i = 0,
			l = this.length;
		for ( ; i < l; i++ ) {
			if ( this[i].nodeType === 1 && (" " + this[i].className + " ").replace(rclass, " ").indexOf( className ) >= 0 ) {
				return true;
			}
		}

		return false;
	}
});




// Return jQuery for attributes-only inclusion


jQuery.each( ("blur focus focusin focusout load resize scroll unload click dblclick " +
	"mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave " +
	"change select submit keydown keypress keyup error contextmenu").split(" "), function( i, name ) {

	// Handle event binding
	jQuery.fn[ name ] = function( data, fn ) {
		return arguments.length > 0 ?
			this.on( name, null, data, fn ) :
			this.trigger( name );
	};
});

jQuery.fn.extend({
	hover: function( fnOver, fnOut ) {
		return this.mouseenter( fnOver ).mouseleave( fnOut || fnOver );
	},

	bind: function( types, data, fn ) {
		return this.on( types, null, data, fn );
	},
	unbind: function( types, fn ) {
		return this.off( types, null, fn );
	},

	delegate: function( selector, types, data, fn ) {
		return this.on( types, selector, data, fn );
	},
	undelegate: function( selector, types, fn ) {
		// ( namespace ) or ( selector, types [, fn] )
		return arguments.length === 1 ? this.off( selector, "**" ) : this.off( types, selector || "**", fn );
	}
});


var nonce = jQuery.now();

var rquery = (/\?/);



var rvalidtokens = /(,)|(\[|{)|(}|])|"(?:[^"\\\r\n]|\\["\\\/bfnrt]|\\u[\da-fA-F]{4})*"\s*:?|true|false|null|-?(?!0\d)\d+(?:\.\d+|)(?:[eE][+-]?\d+|)/g;

jQuery.parseJSON = function( data ) {
	// Attempt to parse using the native JSON parser first
	if ( window.JSON && window.JSON.parse ) {
		// Support: Android 2.3
		// Workaround failure to string-cast null input
		return window.JSON.parse( data + "" );
	}

	var requireNonComma,
		depth = null,
		str = jQuery.trim( data + "" );

	// Guard against invalid (and possibly dangerous) input by ensuring that nothing remains
	// after removing valid tokens
	return str && !jQuery.trim( str.replace( rvalidtokens, function( token, comma, open, close ) {

		// Force termination if we see a misplaced comma
		if ( requireNonComma && comma ) {
			depth = 0;
		}

		// Perform no more replacements after returning to outermost depth
		if ( depth === 0 ) {
			return token;
		}

		// Commas must not follow "[", "{", or ","
		requireNonComma = open || comma;

		// Determine new depth
		// array/object open ("[" or "{"): depth += true - false (increment)
		// array/object close ("]" or "}"): depth += false - true (decrement)
		// other cases ("," or primitive): depth += true - true (numeric cast)
		depth += !close - !open;

		// Remove this token
		return "";
	}) ) ?
		( Function( "return " + str ) )() :
		jQuery.error( "Invalid JSON: " + data );
};


// Cross-browser xml parsing
jQuery.parseXML = function( data ) {
	var xml, tmp;
	if ( !data || typeof data !== "string" ) {
		return null;
	}
	try {
		if ( window.DOMParser ) { // Standard
			tmp = new DOMParser();
			xml = tmp.parseFromString( data, "text/xml" );
		} else { // IE
			xml = new ActiveXObject( "Microsoft.XMLDOM" );
			xml.async = "false";
			xml.loadXML( data );
		}
	} catch( e ) {
		xml = undefined;
	}
	if ( !xml || !xml.documentElement || xml.getElementsByTagName( "parsererror" ).length ) {
		jQuery.error( "Invalid XML: " + data );
	}
	return xml;
};


var
	// Document location
	ajaxLocParts,
	ajaxLocation,

	rhash = /#.*$/,
	rts = /([?&])_=[^&]*/,
	rheaders = /^(.*?):[ \t]*([^\r\n]*)\r?$/mg, // IE leaves an \r character at EOL
	// #7653, #8125, #8152: local protocol detection
	rlocalProtocol = /^(?:about|app|app-storage|.+-extension|file|res|widget):$/,
	rnoContent = /^(?:GET|HEAD)$/,
	rprotocol = /^\/\//,
	rurl = /^([\w.+-]+:)(?:\/\/(?:[^\/?#]*@|)([^\/?#:]*)(?::(\d+)|)|)/,

	/* Prefilters
	 * 1) They are useful to introduce custom dataTypes (see ajax/jsonp.js for an example)
	 * 2) These are called:
	 *    - BEFORE asking for a transport
	 *    - AFTER param serialization (s.data is a string if s.processData is true)
	 * 3) key is the dataType
	 * 4) the catchall symbol "*" can be used
	 * 5) execution will start with transport dataType and THEN continue down to "*" if needed
	 */
	prefilters = {},

	/* Transports bindings
	 * 1) key is the dataType
	 * 2) the catchall symbol "*" can be used
	 * 3) selection will start with transport dataType and THEN go to "*" if needed
	 */
	transports = {},

	// Avoid comment-prolog char sequence (#10098); must appease lint and evade compression
	allTypes = "*/".concat("*");

// #8138, IE may throw an exception when accessing
// a field from window.location if document.domain has been set
try {
	ajaxLocation = location.href;
} catch( e ) {
	// Use the href attribute of an A element
	// since IE will modify it given document.location
	ajaxLocation = document.createElement( "a" );
	ajaxLocation.href = "";
	ajaxLocation = ajaxLocation.href;
}

// Segment location into parts
ajaxLocParts = rurl.exec( ajaxLocation.toLowerCase() ) || [];

// Base "constructor" for jQuery.ajaxPrefilter and jQuery.ajaxTransport
function addToPrefiltersOrTransports( structure ) {

	// dataTypeExpression is optional and defaults to "*"
	return function( dataTypeExpression, func ) {

		if ( typeof dataTypeExpression !== "string" ) {
			func = dataTypeExpression;
			dataTypeExpression = "*";
		}

		var dataType,
			i = 0,
			dataTypes = dataTypeExpression.toLowerCase().match( rnotwhite ) || [];

		if ( jQuery.isFunction( func ) ) {
			// For each dataType in the dataTypeExpression
			while ( (dataType = dataTypes[i++]) ) {
				// Prepend if requested
				if ( dataType.charAt( 0 ) === "+" ) {
					dataType = dataType.slice( 1 ) || "*";
					(structure[ dataType ] = structure[ dataType ] || []).unshift( func );

				// Otherwise append
				} else {
					(structure[ dataType ] = structure[ dataType ] || []).push( func );
				}
			}
		}
	};
}

// Base inspection function for prefilters and transports
function inspectPrefiltersOrTransports( structure, options, originalOptions, jqXHR ) {

	var inspected = {},
		seekingTransport = ( structure === transports );

	function inspect( dataType ) {
		var selected;
		inspected[ dataType ] = true;
		jQuery.each( structure[ dataType ] || [], function( _, prefilterOrFactory ) {
			var dataTypeOrTransport = prefilterOrFactory( options, originalOptions, jqXHR );
			if ( typeof dataTypeOrTransport === "string" && !seekingTransport && !inspected[ dataTypeOrTransport ] ) {
				options.dataTypes.unshift( dataTypeOrTransport );
				inspect( dataTypeOrTransport );
				return false;
			} else if ( seekingTransport ) {
				return !( selected = dataTypeOrTransport );
			}
		});
		return selected;
	}

	return inspect( options.dataTypes[ 0 ] ) || !inspected[ "*" ] && inspect( "*" );
}

// A special extend for ajax options
// that takes "flat" options (not to be deep extended)
// Fixes #9887
function ajaxExtend( target, src ) {
	var deep, key,
		flatOptions = jQuery.ajaxSettings.flatOptions || {};

	for ( key in src ) {
		if ( src[ key ] !== undefined ) {
			( flatOptions[ key ] ? target : ( deep || (deep = {}) ) )[ key ] = src[ key ];
		}
	}
	if ( deep ) {
		jQuery.extend( true, target, deep );
	}

	return target;
}

/* Handles responses to an ajax request:
 * - finds the right dataType (mediates between content-type and expected dataType)
 * - returns the corresponding response
 */
function ajaxHandleResponses( s, jqXHR, responses ) {
	var firstDataType, ct, finalDataType, type,
		contents = s.contents,
		dataTypes = s.dataTypes;

	// Remove auto dataType and get content-type in the process
	while ( dataTypes[ 0 ] === "*" ) {
		dataTypes.shift();
		if ( ct === undefined ) {
			ct = s.mimeType || jqXHR.getResponseHeader("Content-Type");
		}
	}

	// Check if we're dealing with a known content-type
	if ( ct ) {
		for ( type in contents ) {
			if ( contents[ type ] && contents[ type ].test( ct ) ) {
				dataTypes.unshift( type );
				break;
			}
		}
	}

	// Check to see if we have a response for the expected dataType
	if ( dataTypes[ 0 ] in responses ) {
		finalDataType = dataTypes[ 0 ];
	} else {
		// Try convertible dataTypes
		for ( type in responses ) {
			if ( !dataTypes[ 0 ] || s.converters[ type + " " + dataTypes[0] ] ) {
				finalDataType = type;
				break;
			}
			if ( !firstDataType ) {
				firstDataType = type;
			}
		}
		// Or just use first one
		finalDataType = finalDataType || firstDataType;
	}

	// If we found a dataType
	// We add the dataType to the list if needed
	// and return the corresponding response
	if ( finalDataType ) {
		if ( finalDataType !== dataTypes[ 0 ] ) {
			dataTypes.unshift( finalDataType );
		}
		return responses[ finalDataType ];
	}
}

/* Chain conversions given the request and the original response
 * Also sets the responseXXX fields on the jqXHR instance
 */
function ajaxConvert( s, response, jqXHR, isSuccess ) {
	var conv2, current, conv, tmp, prev,
		converters = {},
		// Work with a copy of dataTypes in case we need to modify it for conversion
		dataTypes = s.dataTypes.slice();

	// Create converters map with lowercased keys
	if ( dataTypes[ 1 ] ) {
		for ( conv in s.converters ) {
			converters[ conv.toLowerCase() ] = s.converters[ conv ];
		}
	}

	current = dataTypes.shift();

	// Convert to each sequential dataType
	while ( current ) {

		if ( s.responseFields[ current ] ) {
			jqXHR[ s.responseFields[ current ] ] = response;
		}

		// Apply the dataFilter if provided
		if ( !prev && isSuccess && s.dataFilter ) {
			response = s.dataFilter( response, s.dataType );
		}

		prev = current;
		current = dataTypes.shift();

		if ( current ) {

			// There's only work to do if current dataType is non-auto
			if ( current === "*" ) {

				current = prev;

			// Convert response if prev dataType is non-auto and differs from current
			} else if ( prev !== "*" && prev !== current ) {

				// Seek a direct converter
				conv = converters[ prev + " " + current ] || converters[ "* " + current ];

				// If none found, seek a pair
				if ( !conv ) {
					for ( conv2 in converters ) {

						// If conv2 outputs current
						tmp = conv2.split( " " );
						if ( tmp[ 1 ] === current ) {

							// If prev can be converted to accepted input
							conv = converters[ prev + " " + tmp[ 0 ] ] ||
								converters[ "* " + tmp[ 0 ] ];
							if ( conv ) {
								// Condense equivalence converters
								if ( conv === true ) {
									conv = converters[ conv2 ];

								// Otherwise, insert the intermediate dataType
								} else if ( converters[ conv2 ] !== true ) {
									current = tmp[ 0 ];
									dataTypes.unshift( tmp[ 1 ] );
								}
								break;
							}
						}
					}
				}

				// Apply converter (if not an equivalence)
				if ( conv !== true ) {

					// Unless errors are allowed to bubble, catch and return them
					if ( conv && s[ "throws" ] ) {
						response = conv( response );
					} else {
						try {
							response = conv( response );
						} catch ( e ) {
							return { state: "parsererror", error: conv ? e : "No conversion from " + prev + " to " + current };
						}
					}
				}
			}
		}
	}

	return { state: "success", data: response };
}

jQuery.extend({

	// Counter for holding the number of active queries
	active: 0,

	// Last-Modified header cache for next request
	lastModified: {},
	etag: {},

	ajaxSettings: {
		url: ajaxLocation,
		type: "GET",
		isLocal: rlocalProtocol.test( ajaxLocParts[ 1 ] ),
		global: true,
		processData: true,
		async: true,
		contentType: "application/x-www-form-urlencoded; charset=UTF-8",
		/*
		timeout: 0,
		data: null,
		dataType: null,
		username: null,
		password: null,
		cache: null,
		throws: false,
		traditional: false,
		headers: {},
		*/

		accepts: {
			"*": allTypes,
			text: "text/plain",
			html: "text/html",
			xml: "application/xml, text/xml",
			json: "application/json, text/javascript"
		},

		contents: {
			xml: /xml/,
			html: /html/,
			json: /json/
		},

		responseFields: {
			xml: "responseXML",
			text: "responseText",
			json: "responseJSON"
		},

		// Data converters
		// Keys separate source (or catchall "*") and destination types with a single space
		converters: {

			// Convert anything to text
			"* text": String,

			// Text to html (true = no transformation)
			"text html": true,

			// Evaluate text as a json expression
			"text json": jQuery.parseJSON,

			// Parse text as xml
			"text xml": jQuery.parseXML
		},

		// For options that shouldn't be deep extended:
		// you can add your own custom options here if
		// and when you create one that shouldn't be
		// deep extended (see ajaxExtend)
		flatOptions: {
			url: true,
			context: true
		}
	},

	// Creates a full fledged settings object into target
	// with both ajaxSettings and settings fields.
	// If target is omitted, writes into ajaxSettings.
	ajaxSetup: function( target, settings ) {
		return settings ?

			// Building a settings object
			ajaxExtend( ajaxExtend( target, jQuery.ajaxSettings ), settings ) :

			// Extending ajaxSettings
			ajaxExtend( jQuery.ajaxSettings, target );
	},

	ajaxPrefilter: addToPrefiltersOrTransports( prefilters ),
	ajaxTransport: addToPrefiltersOrTransports( transports ),

	// Main method
	ajax: function( url, options ) {

		// If url is an object, simulate pre-1.5 signature
		if ( typeof url === "object" ) {
			options = url;
			url = undefined;
		}

		// Force options to be an object
		options = options || {};

		var // Cross-domain detection vars
			parts,
			// Loop variable
			i,
			// URL without anti-cache param
			cacheURL,
			// Response headers as string
			responseHeadersString,
			// timeout handle
			timeoutTimer,

			// To know if global events are to be dispatched
			fireGlobals,

			transport,
			// Response headers
			responseHeaders,
			// Create the final options object
			s = jQuery.ajaxSetup( {}, options ),
			// Callbacks context
			callbackContext = s.context || s,
			// Context for global events is callbackContext if it is a DOM node or jQuery collection
			globalEventContext = s.context && ( callbackContext.nodeType || callbackContext.jquery ) ?
				jQuery( callbackContext ) :
				jQuery.event,
			// Deferreds
			deferred = jQuery.Deferred(),
			completeDeferred = jQuery.Callbacks("once memory"),
			// Status-dependent callbacks
			statusCode = s.statusCode || {},
			// Headers (they are sent all at once)
			requestHeaders = {},
			requestHeadersNames = {},
			// The jqXHR state
			state = 0,
			// Default abort message
			strAbort = "canceled",
			// Fake xhr
			jqXHR = {
				readyState: 0,

				// Builds headers hashtable if needed
				getResponseHeader: function( key ) {
					var match;
					if ( state === 2 ) {
						if ( !responseHeaders ) {
							responseHeaders = {};
							while ( (match = rheaders.exec( responseHeadersString )) ) {
								responseHeaders[ match[1].toLowerCase() ] = match[ 2 ];
							}
						}
						match = responseHeaders[ key.toLowerCase() ];
					}
					return match == null ? null : match;
				},

				// Raw string
				getAllResponseHeaders: function() {
					return state === 2 ? responseHeadersString : null;
				},

				// Caches the header
				setRequestHeader: function( name, value ) {
					var lname = name.toLowerCase();
					if ( !state ) {
						name = requestHeadersNames[ lname ] = requestHeadersNames[ lname ] || name;
						requestHeaders[ name ] = value;
					}
					return this;
				},

				// Overrides response content-type header
				overrideMimeType: function( type ) {
					if ( !state ) {
						s.mimeType = type;
					}
					return this;
				},

				// Status-dependent callbacks
				statusCode: function( map ) {
					var code;
					if ( map ) {
						if ( state < 2 ) {
							for ( code in map ) {
								// Lazy-add the new callback in a way that preserves old ones
								statusCode[ code ] = [ statusCode[ code ], map[ code ] ];
							}
						} else {
							// Execute the appropriate callbacks
							jqXHR.always( map[ jqXHR.status ] );
						}
					}
					return this;
				},

				// Cancel the request
				abort: function( statusText ) {
					var finalText = statusText || strAbort;
					if ( transport ) {
						transport.abort( finalText );
					}
					done( 0, finalText );
					return this;
				}
			};

		// Attach deferreds
		deferred.promise( jqXHR ).complete = completeDeferred.add;
		jqXHR.success = jqXHR.done;
		jqXHR.error = jqXHR.fail;

		// Remove hash character (#7531: and string promotion)
		// Add protocol if not provided (#5866: IE7 issue with protocol-less urls)
		// Handle falsy url in the settings object (#10093: consistency with old signature)
		// We also use the url parameter if available
		s.url = ( ( url || s.url || ajaxLocation ) + "" ).replace( rhash, "" ).replace( rprotocol, ajaxLocParts[ 1 ] + "//" );

		// Alias method option to type as per ticket #12004
		s.type = options.method || options.type || s.method || s.type;

		// Extract dataTypes list
		s.dataTypes = jQuery.trim( s.dataType || "*" ).toLowerCase().match( rnotwhite ) || [ "" ];

		// A cross-domain request is in order when we have a protocol:host:port mismatch
		if ( s.crossDomain == null ) {
			parts = rurl.exec( s.url.toLowerCase() );
			s.crossDomain = !!( parts &&
				( parts[ 1 ] !== ajaxLocParts[ 1 ] || parts[ 2 ] !== ajaxLocParts[ 2 ] ||
					( parts[ 3 ] || ( parts[ 1 ] === "http:" ? "80" : "443" ) ) !==
						( ajaxLocParts[ 3 ] || ( ajaxLocParts[ 1 ] === "http:" ? "80" : "443" ) ) )
			);
		}

		// Convert data if not already a string
		if ( s.data && s.processData && typeof s.data !== "string" ) {
			s.data = jQuery.param( s.data, s.traditional );
		}

		// Apply prefilters
		inspectPrefiltersOrTransports( prefilters, s, options, jqXHR );

		// If request was aborted inside a prefilter, stop there
		if ( state === 2 ) {
			return jqXHR;
		}

		// We can fire global events as of now if asked to
		fireGlobals = s.global;

		// Watch for a new set of requests
		if ( fireGlobals && jQuery.active++ === 0 ) {
			jQuery.event.trigger("ajaxStart");
		}

		// Uppercase the type
		s.type = s.type.toUpperCase();

		// Determine if request has content
		s.hasContent = !rnoContent.test( s.type );

		// Save the URL in case we're toying with the If-Modified-Since
		// and/or If-None-Match header later on
		cacheURL = s.url;

		// More options handling for requests with no content
		if ( !s.hasContent ) {

			// If data is available, append data to url
			if ( s.data ) {
				cacheURL = ( s.url += ( rquery.test( cacheURL ) ? "&" : "?" ) + s.data );
				// #9682: remove data so that it's not used in an eventual retry
				delete s.data;
			}

			// Add anti-cache in url if needed
			if ( s.cache === false ) {
				s.url = rts.test( cacheURL ) ?

					// If there is already a '_' parameter, set its value
					cacheURL.replace( rts, "$1_=" + nonce++ ) :

					// Otherwise add one to the end
					cacheURL + ( rquery.test( cacheURL ) ? "&" : "?" ) + "_=" + nonce++;
			}
		}

		// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
		if ( s.ifModified ) {
			if ( jQuery.lastModified[ cacheURL ] ) {
				jqXHR.setRequestHeader( "If-Modified-Since", jQuery.lastModified[ cacheURL ] );
			}
			if ( jQuery.etag[ cacheURL ] ) {
				jqXHR.setRequestHeader( "If-None-Match", jQuery.etag[ cacheURL ] );
			}
		}

		// Set the correct header, if data is being sent
		if ( s.data && s.hasContent && s.contentType !== false || options.contentType ) {
			jqXHR.setRequestHeader( "Content-Type", s.contentType );
		}

		// Set the Accepts header for the server, depending on the dataType
		jqXHR.setRequestHeader(
			"Accept",
			s.dataTypes[ 0 ] && s.accepts[ s.dataTypes[0] ] ?
				s.accepts[ s.dataTypes[0] ] + ( s.dataTypes[ 0 ] !== "*" ? ", " + allTypes + "; q=0.01" : "" ) :
				s.accepts[ "*" ]
		);

		// Check for headers option
		for ( i in s.headers ) {
			jqXHR.setRequestHeader( i, s.headers[ i ] );
		}

		// Allow custom headers/mimetypes and early abort
		if ( s.beforeSend && ( s.beforeSend.call( callbackContext, jqXHR, s ) === false || state === 2 ) ) {
			// Abort if not done already and return
			return jqXHR.abort();
		}

		// aborting is no longer a cancellation
		strAbort = "abort";

		// Install callbacks on deferreds
		for ( i in { success: 1, error: 1, complete: 1 } ) {
			jqXHR[ i ]( s[ i ] );
		}

		// Get transport
		transport = inspectPrefiltersOrTransports( transports, s, options, jqXHR );

		// If no transport, we auto-abort
		if ( !transport ) {
			done( -1, "No Transport" );
		} else {
			jqXHR.readyState = 1;

			// Send global event
			if ( fireGlobals ) {
				globalEventContext.trigger( "ajaxSend", [ jqXHR, s ] );
			}
			// Timeout
			if ( s.async && s.timeout > 0 ) {
				timeoutTimer = setTimeout(function() {
					jqXHR.abort("timeout");
				}, s.timeout );
			}

			try {
				state = 1;
				transport.send( requestHeaders, done );
			} catch ( e ) {
				// Propagate exception as error if not done
				if ( state < 2 ) {
					done( -1, e );
				// Simply rethrow otherwise
				} else {
					throw e;
				}
			}
		}

		// Callback for when everything is done
		function done( status, nativeStatusText, responses, headers ) {
			var isSuccess, success, error, response, modified,
				statusText = nativeStatusText;

			// Called once
			if ( state === 2 ) {
				return;
			}

			// State is "done" now
			state = 2;

			// Clear timeout if it exists
			if ( timeoutTimer ) {
				clearTimeout( timeoutTimer );
			}

			// Dereference transport for early garbage collection
			// (no matter how long the jqXHR object will be used)
			transport = undefined;

			// Cache response headers
			responseHeadersString = headers || "";

			// Set readyState
			jqXHR.readyState = status > 0 ? 4 : 0;

			// Determine if successful
			isSuccess = status >= 200 && status < 300 || status === 304;

			// Get response data
			if ( responses ) {
				response = ajaxHandleResponses( s, jqXHR, responses );
			}

			// Convert no matter what (that way responseXXX fields are always set)
			response = ajaxConvert( s, response, jqXHR, isSuccess );

			// If successful, handle type chaining
			if ( isSuccess ) {

				// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
				if ( s.ifModified ) {
					modified = jqXHR.getResponseHeader("Last-Modified");
					if ( modified ) {
						jQuery.lastModified[ cacheURL ] = modified;
					}
					modified = jqXHR.getResponseHeader("etag");
					if ( modified ) {
						jQuery.etag[ cacheURL ] = modified;
					}
				}

				// if no content
				if ( status === 204 || s.type === "HEAD" ) {
					statusText = "nocontent";

				// if not modified
				} else if ( status === 304 ) {
					statusText = "notmodified";

				// If we have data, let's convert it
				} else {
					statusText = response.state;
					success = response.data;
					error = response.error;
					isSuccess = !error;
				}
			} else {
				// We extract error from statusText
				// then normalize statusText and status for non-aborts
				error = statusText;
				if ( status || !statusText ) {
					statusText = "error";
					if ( status < 0 ) {
						status = 0;
					}
				}
			}

			// Set data for the fake xhr object
			jqXHR.status = status;
			jqXHR.statusText = ( nativeStatusText || statusText ) + "";

			// Success/Error
			if ( isSuccess ) {
				deferred.resolveWith( callbackContext, [ success, statusText, jqXHR ] );
			} else {
				deferred.rejectWith( callbackContext, [ jqXHR, statusText, error ] );
			}

			// Status-dependent callbacks
			jqXHR.statusCode( statusCode );
			statusCode = undefined;

			if ( fireGlobals ) {
				globalEventContext.trigger( isSuccess ? "ajaxSuccess" : "ajaxError",
					[ jqXHR, s, isSuccess ? success : error ] );
			}

			// Complete
			completeDeferred.fireWith( callbackContext, [ jqXHR, statusText ] );

			if ( fireGlobals ) {
				globalEventContext.trigger( "ajaxComplete", [ jqXHR, s ] );
				// Handle the global AJAX counter
				if ( !( --jQuery.active ) ) {
					jQuery.event.trigger("ajaxStop");
				}
			}
		}

		return jqXHR;
	},

	getJSON: function( url, data, callback ) {
		return jQuery.get( url, data, callback, "json" );
	},

	getScript: function( url, callback ) {
		return jQuery.get( url, undefined, callback, "script" );
	}
});

jQuery.each( [ "get", "post" ], function( i, method ) {
	jQuery[ method ] = function( url, data, callback, type ) {
		// shift arguments if data argument was omitted
		if ( jQuery.isFunction( data ) ) {
			type = type || callback;
			callback = data;
			data = undefined;
		}

		return jQuery.ajax({
			url: url,
			type: method,
			dataType: type,
			data: data,
			success: callback
		});
	};
});

// Attach a bunch of functions for handling common AJAX events
jQuery.each( [ "ajaxStart", "ajaxStop", "ajaxComplete", "ajaxError", "ajaxSuccess", "ajaxSend" ], function( i, type ) {
	jQuery.fn[ type ] = function( fn ) {
		return this.on( type, fn );
	};
});


jQuery._evalUrl = function( url ) {
	return jQuery.ajax({
		url: url,
		type: "GET",
		dataType: "script",
		async: false,
		global: false,
		"throws": true
	});
};


jQuery.fn.extend({
	wrapAll: function( html ) {
		if ( jQuery.isFunction( html ) ) {
			return this.each(function(i) {
				jQuery(this).wrapAll( html.call(this, i) );
			});
		}

		if ( this[0] ) {
			// The elements to wrap the target around
			var wrap = jQuery( html, this[0].ownerDocument ).eq(0).clone(true);

			if ( this[0].parentNode ) {
				wrap.insertBefore( this[0] );
			}

			wrap.map(function() {
				var elem = this;

				while ( elem.firstChild && elem.firstChild.nodeType === 1 ) {
					elem = elem.firstChild;
				}

				return elem;
			}).append( this );
		}

		return this;
	},

	wrapInner: function( html ) {
		if ( jQuery.isFunction( html ) ) {
			return this.each(function(i) {
				jQuery(this).wrapInner( html.call(this, i) );
			});
		}

		return this.each(function() {
			var self = jQuery( this ),
				contents = self.contents();

			if ( contents.length ) {
				contents.wrapAll( html );

			} else {
				self.append( html );
			}
		});
	},

	wrap: function( html ) {
		var isFunction = jQuery.isFunction( html );

		return this.each(function(i) {
			jQuery( this ).wrapAll( isFunction ? html.call(this, i) : html );
		});
	},

	unwrap: function() {
		return this.parent().each(function() {
			if ( !jQuery.nodeName( this, "body" ) ) {
				jQuery( this ).replaceWith( this.childNodes );
			}
		}).end();
	}
});


jQuery.expr.filters.hidden = function( elem ) {
	// Support: Opera <= 12.12
	// Opera reports offsetWidths and offsetHeights less than zero on some elements
	return elem.offsetWidth <= 0 && elem.offsetHeight <= 0 ||
		(!support.reliableHiddenOffsets() &&
			((elem.style && elem.style.display) || jQuery.css( elem, "display" )) === "none");
};

jQuery.expr.filters.visible = function( elem ) {
	return !jQuery.expr.filters.hidden( elem );
};




var r20 = /%20/g,
	rbracket = /\[\]$/,
	rCRLF = /\r?\n/g,
	rsubmitterTypes = /^(?:submit|button|image|reset|file)$/i,
	rsubmittable = /^(?:input|select|textarea|keygen)/i;

function buildParams( prefix, obj, traditional, add ) {
	var name;

	if ( jQuery.isArray( obj ) ) {
		// Serialize array item.
		jQuery.each( obj, function( i, v ) {
			if ( traditional || rbracket.test( prefix ) ) {
				// Treat each array item as a scalar.
				add( prefix, v );

			} else {
				// Item is non-scalar (array or object), encode its numeric index.
				buildParams( prefix + "[" + ( typeof v === "object" ? i : "" ) + "]", v, traditional, add );
			}
		});

	} else if ( !traditional && jQuery.type( obj ) === "object" ) {
		// Serialize object item.
		for ( name in obj ) {
			buildParams( prefix + "[" + name + "]", obj[ name ], traditional, add );
		}

	} else {
		// Serialize scalar item.
		add( prefix, obj );
	}
}

// Serialize an array of form elements or a set of
// key/values into a query string
jQuery.param = function( a, traditional ) {
	var prefix,
		s = [],
		add = function( key, value ) {
			// If value is a function, invoke it and return its value
			value = jQuery.isFunction( value ) ? value() : ( value == null ? "" : value );
			s[ s.length ] = encodeURIComponent( key ) + "=" + encodeURIComponent( value );
		};

	// Set traditional to true for jQuery <= 1.3.2 behavior.
	if ( traditional === undefined ) {
		traditional = jQuery.ajaxSettings && jQuery.ajaxSettings.traditional;
	}

	// If an array was passed in, assume that it is an array of form elements.
	if ( jQuery.isArray( a ) || ( a.jquery && !jQuery.isPlainObject( a ) ) ) {
		// Serialize the form elements
		jQuery.each( a, function() {
			add( this.name, this.value );
		});

	} else {
		// If traditional, encode the "old" way (the way 1.3.2 or older
		// did it), otherwise encode params recursively.
		for ( prefix in a ) {
			buildParams( prefix, a[ prefix ], traditional, add );
		}
	}

	// Return the resulting serialization
	return s.join( "&" ).replace( r20, "+" );
};

jQuery.fn.extend({
	serialize: function() {
		return jQuery.param( this.serializeArray() );
	},
	serializeArray: function() {
		return this.map(function() {
			// Can add propHook for "elements" to filter or add form elements
			var elements = jQuery.prop( this, "elements" );
			return elements ? jQuery.makeArray( elements ) : this;
		})
		.filter(function() {
			var type = this.type;
			// Use .is(":disabled") so that fieldset[disabled] works
			return this.name && !jQuery( this ).is( ":disabled" ) &&
				rsubmittable.test( this.nodeName ) && !rsubmitterTypes.test( type ) &&
				( this.checked || !rcheckableType.test( type ) );
		})
		.map(function( i, elem ) {
			var val = jQuery( this ).val();

			return val == null ?
				null :
				jQuery.isArray( val ) ?
					jQuery.map( val, function( val ) {
						return { name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
					}) :
					{ name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
		}).get();
	}
});


// Create the request object
// (This is still attached to ajaxSettings for backward compatibility)
jQuery.ajaxSettings.xhr = window.ActiveXObject !== undefined ?
	// Support: IE6+
	function() {

		// XHR cannot access local files, always use ActiveX for that case
		return !this.isLocal &&

			// Support: IE7-8
			// oldIE XHR does not support non-RFC2616 methods (#13240)
			// See http://msdn.microsoft.com/en-us/library/ie/ms536648(v=vs.85).aspx
			// and http://www.w3.org/Protocols/rfc2616/rfc2616-sec9.html#sec9
			// Although this check for six methods instead of eight
			// since IE also does not support "trace" and "connect"
			/^(get|post|head|put|delete|options)$/i.test( this.type ) &&

			createStandardXHR() || createActiveXHR();
	} :
	// For all other browsers, use the standard XMLHttpRequest object
	createStandardXHR;

var xhrId = 0,
	xhrCallbacks = {},
	xhrSupported = jQuery.ajaxSettings.xhr();

// Support: IE<10
// Open requests must be manually aborted on unload (#5280)
if ( window.ActiveXObject ) {
	jQuery( window ).on( "unload", function() {
		for ( var key in xhrCallbacks ) {
			xhrCallbacks[ key ]( undefined, true );
		}
	});
}

// Determine support properties
support.cors = !!xhrSupported && ( "withCredentials" in xhrSupported );
xhrSupported = support.ajax = !!xhrSupported;

// Create transport if the browser can provide an xhr
if ( xhrSupported ) {

	jQuery.ajaxTransport(function( options ) {
		// Cross domain only allowed if supported through XMLHttpRequest
		if ( !options.crossDomain || support.cors ) {

			var callback;

			return {
				send: function( headers, complete ) {
					var i,
						xhr = options.xhr(),
						id = ++xhrId;

					// Open the socket
					xhr.open( options.type, options.url, options.async, options.username, options.password );

					// Apply custom fields if provided
					if ( options.xhrFields ) {
						for ( i in options.xhrFields ) {
							xhr[ i ] = options.xhrFields[ i ];
						}
					}

					// Override mime type if needed
					if ( options.mimeType && xhr.overrideMimeType ) {
						xhr.overrideMimeType( options.mimeType );
					}

					// X-Requested-With header
					// For cross-domain requests, seeing as conditions for a preflight are
					// akin to a jigsaw puzzle, we simply never set it to be sure.
					// (it can always be set on a per-request basis or even using ajaxSetup)
					// For same-domain requests, won't change header if already provided.
					if ( !options.crossDomain && !headers["X-Requested-With"] ) {
						headers["X-Requested-With"] = "XMLHttpRequest";
					}

					// Set headers
					for ( i in headers ) {
						// Support: IE<9
						// IE's ActiveXObject throws a 'Type Mismatch' exception when setting
						// request header to a null-value.
						//
						// To keep consistent with other XHR implementations, cast the value
						// to string and ignore `undefined`.
						if ( headers[ i ] !== undefined ) {
							xhr.setRequestHeader( i, headers[ i ] + "" );
						}
					}

					// Do send the request
					// This may raise an exception which is actually
					// handled in jQuery.ajax (so no try/catch here)
					xhr.send( ( options.hasContent && options.data ) || null );

					// Listener
					callback = function( _, isAbort ) {
						var status, statusText, responses;

						// Was never called and is aborted or complete
						if ( callback && ( isAbort || xhr.readyState === 4 ) ) {
							// Clean up
							delete xhrCallbacks[ id ];
							callback = undefined;
							xhr.onreadystatechange = jQuery.noop;

							// Abort manually if needed
							if ( isAbort ) {
								if ( xhr.readyState !== 4 ) {
									xhr.abort();
								}
							} else {
								responses = {};
								status = xhr.status;

								// Support: IE<10
								// Accessing binary-data responseText throws an exception
								// (#11426)
								if ( typeof xhr.responseText === "string" ) {
									responses.text = xhr.responseText;
								}

								// Firefox throws an exception when accessing
								// statusText for faulty cross-domain requests
								try {
									statusText = xhr.statusText;
								} catch( e ) {
									// We normalize with Webkit giving an empty statusText
									statusText = "";
								}

								// Filter status for non standard behaviors

								// If the request is local and we have data: assume a success
								// (success with no data won't get notified, that's the best we
								// can do given current implementations)
								if ( !status && options.isLocal && !options.crossDomain ) {
									status = responses.text ? 200 : 404;
								// IE - #1450: sometimes returns 1223 when it should be 204
								} else if ( status === 1223 ) {
									status = 204;
								}
							}
						}

						// Call complete if needed
						if ( responses ) {
							complete( status, statusText, responses, xhr.getAllResponseHeaders() );
						}
					};

					if ( !options.async ) {
						// if we're in sync mode we fire the callback
						callback();
					} else if ( xhr.readyState === 4 ) {
						// (IE6 & IE7) if it's in cache and has been
						// retrieved directly we need to fire the callback
						setTimeout( callback );
					} else {
						// Add to the list of active xhr callbacks
						xhr.onreadystatechange = xhrCallbacks[ id ] = callback;
					}
				},

				abort: function() {
					if ( callback ) {
						callback( undefined, true );
					}
				}
			};
		}
	});
}

// Functions to create xhrs
function createStandardXHR() {
	try {
		return new window.XMLHttpRequest();
	} catch( e ) {}
}

function createActiveXHR() {
	try {
		return new window.ActiveXObject( "Microsoft.XMLHTTP" );
	} catch( e ) {}
}




// Install script dataType
jQuery.ajaxSetup({
	accepts: {
		script: "text/javascript, application/javascript, application/ecmascript, application/x-ecmascript"
	},
	contents: {
		script: /(?:java|ecma)script/
	},
	converters: {
		"text script": function( text ) {
			jQuery.globalEval( text );
			return text;
		}
	}
});

// Handle cache's special case and global
jQuery.ajaxPrefilter( "script", function( s ) {
	if ( s.cache === undefined ) {
		s.cache = false;
	}
	if ( s.crossDomain ) {
		s.type = "GET";
		s.global = false;
	}
});

// Bind script tag hack transport
jQuery.ajaxTransport( "script", function(s) {

	// This transport only deals with cross domain requests
	if ( s.crossDomain ) {

		var script,
			head = document.head || jQuery("head")[0] || document.documentElement;

		return {

			send: function( _, callback ) {

				script = document.createElement("script");

				script.async = true;

				if ( s.scriptCharset ) {
					script.charset = s.scriptCharset;
				}

				script.src = s.url;

				// Attach handlers for all browsers
				script.onload = script.onreadystatechange = function( _, isAbort ) {

					if ( isAbort || !script.readyState || /loaded|complete/.test( script.readyState ) ) {

						// Handle memory leak in IE
						script.onload = script.onreadystatechange = null;

						// Remove the script
						if ( script.parentNode ) {
							script.parentNode.removeChild( script );
						}

						// Dereference the script
						script = null;

						// Callback if not abort
						if ( !isAbort ) {
							callback( 200, "success" );
						}
					}
				};

				// Circumvent IE6 bugs with base elements (#2709 and #4378) by prepending
				// Use native DOM manipulation to avoid our domManip AJAX trickery
				head.insertBefore( script, head.firstChild );
			},

			abort: function() {
				if ( script ) {
					script.onload( undefined, true );
				}
			}
		};
	}
});




var oldCallbacks = [],
	rjsonp = /(=)\?(?=&|$)|\?\?/;

// Default jsonp settings
jQuery.ajaxSetup({
	jsonp: "callback",
	jsonpCallback: function() {
		var callback = oldCallbacks.pop() || ( jQuery.expando + "_" + ( nonce++ ) );
		this[ callback ] = true;
		return callback;
	}
});

// Detect, normalize options and install callbacks for jsonp requests
jQuery.ajaxPrefilter( "json jsonp", function( s, originalSettings, jqXHR ) {

	var callbackName, overwritten, responseContainer,
		jsonProp = s.jsonp !== false && ( rjsonp.test( s.url ) ?
			"url" :
			typeof s.data === "string" && !( s.contentType || "" ).indexOf("application/x-www-form-urlencoded") && rjsonp.test( s.data ) && "data"
		);

	// Handle iff the expected data type is "jsonp" or we have a parameter to set
	if ( jsonProp || s.dataTypes[ 0 ] === "jsonp" ) {

		// Get callback name, remembering preexisting value associated with it
		callbackName = s.jsonpCallback = jQuery.isFunction( s.jsonpCallback ) ?
			s.jsonpCallback() :
			s.jsonpCallback;

		// Insert callback into url or form data
		if ( jsonProp ) {
			s[ jsonProp ] = s[ jsonProp ].replace( rjsonp, "$1" + callbackName );
		} else if ( s.jsonp !== false ) {
			s.url += ( rquery.test( s.url ) ? "&" : "?" ) + s.jsonp + "=" + callbackName;
		}

		// Use data converter to retrieve json after script execution
		s.converters["script json"] = function() {
			if ( !responseContainer ) {
				jQuery.error( callbackName + " was not called" );
			}
			return responseContainer[ 0 ];
		};

		// force json dataType
		s.dataTypes[ 0 ] = "json";

		// Install callback
		overwritten = window[ callbackName ];
		window[ callbackName ] = function() {
			responseContainer = arguments;
		};

		// Clean-up function (fires after converters)
		jqXHR.always(function() {
			// Restore preexisting value
			window[ callbackName ] = overwritten;

			// Save back as free
			if ( s[ callbackName ] ) {
				// make sure that re-using the options doesn't screw things around
				s.jsonpCallback = originalSettings.jsonpCallback;

				// save the callback name for future use
				oldCallbacks.push( callbackName );
			}

			// Call if it was a function and we have a response
			if ( responseContainer && jQuery.isFunction( overwritten ) ) {
				overwritten( responseContainer[ 0 ] );
			}

			responseContainer = overwritten = undefined;
		});

		// Delegate to script
		return "script";
	}
});




// data: string of html
// context (optional): If specified, the fragment will be created in this context, defaults to document
// keepScripts (optional): If true, will include scripts passed in the html string
jQuery.parseHTML = function( data, context, keepScripts ) {
	if ( !data || typeof data !== "string" ) {
		return null;
	}
	if ( typeof context === "boolean" ) {
		keepScripts = context;
		context = false;
	}
	context = context || document;

	var parsed = rsingleTag.exec( data ),
		scripts = !keepScripts && [];

	// Single tag
	if ( parsed ) {
		return [ context.createElement( parsed[1] ) ];
	}

	parsed = jQuery.buildFragment( [ data ], context, scripts );

	if ( scripts && scripts.length ) {
		jQuery( scripts ).remove();
	}

	return jQuery.merge( [], parsed.childNodes );
};


// Keep a copy of the old load method
var _load = jQuery.fn.load;

/**
 * Load a url into a page
 */
jQuery.fn.load = function( url, params, callback ) {
	if ( typeof url !== "string" && _load ) {
		return _load.apply( this, arguments );
	}

	var selector, response, type,
		self = this,
		off = url.indexOf(" ");

	if ( off >= 0 ) {
		selector = jQuery.trim( url.slice( off, url.length ) );
		url = url.slice( 0, off );
	}

	// If it's a function
	if ( jQuery.isFunction( params ) ) {

		// We assume that it's the callback
		callback = params;
		params = undefined;

	// Otherwise, build a param string
	} else if ( params && typeof params === "object" ) {
		type = "POST";
	}

	// If we have elements to modify, make the request
	if ( self.length > 0 ) {
		jQuery.ajax({
			url: url,

			// if "type" variable is undefined, then "GET" method will be used
			type: type,
			dataType: "html",
			data: params
		}).done(function( responseText ) {

			// Save response for use in complete callback
			response = arguments;

			self.html( selector ?

				// If a selector was specified, locate the right elements in a dummy div
				// Exclude scripts to avoid IE 'Permission Denied' errors
				jQuery("<div>").append( jQuery.parseHTML( responseText ) ).find( selector ) :

				// Otherwise use the full result
				responseText );

		}).complete( callback && function( jqXHR, status ) {
			self.each( callback, response || [ jqXHR.responseText, status, jqXHR ] );
		});
	}

	return this;
};




jQuery.expr.filters.animated = function( elem ) {
	return jQuery.grep(jQuery.timers, function( fn ) {
		return elem === fn.elem;
	}).length;
};





var docElem = window.document.documentElement;

/**
 * Gets a window from an element
 */
function getWindow( elem ) {
	return jQuery.isWindow( elem ) ?
		elem :
		elem.nodeType === 9 ?
			elem.defaultView || elem.parentWindow :
			false;
}

jQuery.offset = {
	setOffset: function( elem, options, i ) {
		var curPosition, curLeft, curCSSTop, curTop, curOffset, curCSSLeft, calculatePosition,
			position = jQuery.css( elem, "position" ),
			curElem = jQuery( elem ),
			props = {};

		// set position first, in-case top/left are set even on static elem
		if ( position === "static" ) {
			elem.style.position = "relative";
		}

		curOffset = curElem.offset();
		curCSSTop = jQuery.css( elem, "top" );
		curCSSLeft = jQuery.css( elem, "left" );
		calculatePosition = ( position === "absolute" || position === "fixed" ) &&
			jQuery.inArray("auto", [ curCSSTop, curCSSLeft ] ) > -1;

		// need to be able to calculate position if either top or left is auto and position is either absolute or fixed
		if ( calculatePosition ) {
			curPosition = curElem.position();
			curTop = curPosition.top;
			curLeft = curPosition.left;
		} else {
			curTop = parseFloat( curCSSTop ) || 0;
			curLeft = parseFloat( curCSSLeft ) || 0;
		}

		if ( jQuery.isFunction( options ) ) {
			options = options.call( elem, i, curOffset );
		}

		if ( options.top != null ) {
			props.top = ( options.top - curOffset.top ) + curTop;
		}
		if ( options.left != null ) {
			props.left = ( options.left - curOffset.left ) + curLeft;
		}

		if ( "using" in options ) {
			options.using.call( elem, props );
		} else {
			curElem.css( props );
		}
	}
};

jQuery.fn.extend({
	offset: function( options ) {
		if ( arguments.length ) {
			return options === undefined ?
				this :
				this.each(function( i ) {
					jQuery.offset.setOffset( this, options, i );
				});
		}

		var docElem, win,
			box = { top: 0, left: 0 },
			elem = this[ 0 ],
			doc = elem && elem.ownerDocument;

		if ( !doc ) {
			return;
		}

		docElem = doc.documentElement;

		// Make sure it's not a disconnected DOM node
		if ( !jQuery.contains( docElem, elem ) ) {
			return box;
		}

		// If we don't have gBCR, just use 0,0 rather than error
		// BlackBerry 5, iOS 3 (original iPhone)
		if ( typeof elem.getBoundingClientRect !== strundefined ) {
			box = elem.getBoundingClientRect();
		}
		win = getWindow( doc );
		return {
			top: box.top  + ( win.pageYOffset || docElem.scrollTop )  - ( docElem.clientTop  || 0 ),
			left: box.left + ( win.pageXOffset || docElem.scrollLeft ) - ( docElem.clientLeft || 0 )
		};
	},

	position: function() {
		if ( !this[ 0 ] ) {
			return;
		}

		var offsetParent, offset,
			parentOffset = { top: 0, left: 0 },
			elem = this[ 0 ];

		// fixed elements are offset from window (parentOffset = {top:0, left: 0}, because it is its only offset parent
		if ( jQuery.css( elem, "position" ) === "fixed" ) {
			// we assume that getBoundingClientRect is available when computed position is fixed
			offset = elem.getBoundingClientRect();
		} else {
			// Get *real* offsetParent
			offsetParent = this.offsetParent();

			// Get correct offsets
			offset = this.offset();
			if ( !jQuery.nodeName( offsetParent[ 0 ], "html" ) ) {
				parentOffset = offsetParent.offset();
			}

			// Add offsetParent borders
			parentOffset.top  += jQuery.css( offsetParent[ 0 ], "borderTopWidth", true );
			parentOffset.left += jQuery.css( offsetParent[ 0 ], "borderLeftWidth", true );
		}

		// Subtract parent offsets and element margins
		// note: when an element has margin: auto the offsetLeft and marginLeft
		// are the same in Safari causing offset.left to incorrectly be 0
		return {
			top:  offset.top  - parentOffset.top - jQuery.css( elem, "marginTop", true ),
			left: offset.left - parentOffset.left - jQuery.css( elem, "marginLeft", true)
		};
	},

	offsetParent: function() {
		return this.map(function() {
			var offsetParent = this.offsetParent || docElem;

			while ( offsetParent && ( !jQuery.nodeName( offsetParent, "html" ) && jQuery.css( offsetParent, "position" ) === "static" ) ) {
				offsetParent = offsetParent.offsetParent;
			}
			return offsetParent || docElem;
		});
	}
});

// Create scrollLeft and scrollTop methods
jQuery.each( { scrollLeft: "pageXOffset", scrollTop: "pageYOffset" }, function( method, prop ) {
	var top = /Y/.test( prop );

	jQuery.fn[ method ] = function( val ) {
		return access( this, function( elem, method, val ) {
			var win = getWindow( elem );

			if ( val === undefined ) {
				return win ? (prop in win) ? win[ prop ] :
					win.document.documentElement[ method ] :
					elem[ method ];
			}

			if ( win ) {
				win.scrollTo(
					!top ? val : jQuery( win ).scrollLeft(),
					top ? val : jQuery( win ).scrollTop()
				);

			} else {
				elem[ method ] = val;
			}
		}, method, val, arguments.length, null );
	};
});

// Add the top/left cssHooks using jQuery.fn.position
// Webkit bug: https://bugs.webkit.org/show_bug.cgi?id=29084
// getComputedStyle returns percent when specified for top/left/bottom/right
// rather than make the css module depend on the offset module, we just check for it here
jQuery.each( [ "top", "left" ], function( i, prop ) {
	jQuery.cssHooks[ prop ] = addGetHookIf( support.pixelPosition,
		function( elem, computed ) {
			if ( computed ) {
				computed = curCSS( elem, prop );
				// if curCSS returns percentage, fallback to offset
				return rnumnonpx.test( computed ) ?
					jQuery( elem ).position()[ prop ] + "px" :
					computed;
			}
		}
	);
});


// Create innerHeight, innerWidth, height, width, outerHeight and outerWidth methods
jQuery.each( { Height: "height", Width: "width" }, function( name, type ) {
	jQuery.each( { padding: "inner" + name, content: type, "": "outer" + name }, function( defaultExtra, funcName ) {
		// margin is only for outerHeight, outerWidth
		jQuery.fn[ funcName ] = function( margin, value ) {
			var chainable = arguments.length && ( defaultExtra || typeof margin !== "boolean" ),
				extra = defaultExtra || ( margin === true || value === true ? "margin" : "border" );

			return access( this, function( elem, type, value ) {
				var doc;

				if ( jQuery.isWindow( elem ) ) {
					// As of 5/8/2012 this will yield incorrect results for Mobile Safari, but there
					// isn't a whole lot we can do. See pull request at this URL for discussion:
					// https://github.com/jquery/jquery/pull/764
					return elem.document.documentElement[ "client" + name ];
				}

				// Get document width or height
				if ( elem.nodeType === 9 ) {
					doc = elem.documentElement;

					// Either scroll[Width/Height] or offset[Width/Height] or client[Width/Height], whichever is greatest
					// unfortunately, this causes bug #3838 in IE6/8 only, but there is currently no good, small way to fix it.
					return Math.max(
						elem.body[ "scroll" + name ], doc[ "scroll" + name ],
						elem.body[ "offset" + name ], doc[ "offset" + name ],
						doc[ "client" + name ]
					);
				}

				return value === undefined ?
					// Get width or height on the element, requesting but not forcing parseFloat
					jQuery.css( elem, type, extra ) :

					// Set width or height on the element
					jQuery.style( elem, type, value, extra );
			}, type, chainable ? margin : undefined, chainable, null );
		};
	});
});


// The number of elements contained in the matched element set
jQuery.fn.size = function() {
	return this.length;
};

jQuery.fn.andSelf = jQuery.fn.addBack;




// Register as a named AMD module, since jQuery can be concatenated with other
// files that may use define, but not via a proper concatenation script that
// understands anonymous AMD modules. A named AMD is safest and most robust
// way to register. Lowercase jquery is used because AMD module names are
// derived from file names, and jQuery is normally delivered in a lowercase
// file name. Do this after creating the global so that if an AMD module wants
// to call noConflict to hide this version of jQuery, it will work.

// Note that for maximum portability, libraries that are not jQuery should
// declare themselves as anonymous modules, and avoid setting a global if an
// AMD loader is present. jQuery is a special case. For more information, see
// https://github.com/jrburke/requirejs/wiki/Updating-existing-libraries#wiki-anon

if ( typeof define === "function" && define.amd ) {
	define( "jquery", [], function() {
		return jQuery;
	});
}




var
	// Map over jQuery in case of overwrite
	_jQuery = window.jQuery,

	// Map over the $ in case of overwrite
	_$ = window.$;

jQuery.noConflict = function( deep ) {
	if ( window.$ === jQuery ) {
		window.$ = _$;
	}

	if ( deep && window.jQuery === jQuery ) {
		window.jQuery = _jQuery;
	}

	return jQuery;
};

// Expose jQuery and $ identifiers, even in
// AMD (#7102#comment:10, https://github.com/jquery/jquery/pull/557)
// and CommonJS for browser emulators (#13566)
if ( typeof noGlobal === strundefined ) {
	window.jQuery = window.$ = jQuery;
}




return jQuery;

}));
(function($, undefined) {

/**
 * Unobtrusive scripting adapter for jQuery
 * https://github.com/rails/jquery-ujs
 *
 * Requires jQuery 1.8.0 or later.
 *
 * Released under the MIT license
 *
 */

  // Cut down on the number of issues from people inadvertently including jquery_ujs twice
  // by detecting and raising an error when it happens.
  if ( $.rails !== undefined ) {
    $.error('jquery-ujs has already been loaded!');
  }

  // Shorthand to make it a little easier to call public rails functions from within rails.js
  var rails;
  var $document = $(document);

  $.rails = rails = {
    // Link elements bound by jquery-ujs
    linkClickSelector: 'a[data-confirm], a[data-method], a[data-remote], a[data-disable-with], a[data-disable]',

    // Button elements bound by jquery-ujs
    buttonClickSelector: 'button[data-remote]:not(form button), button[data-confirm]:not(form button)',

    // Select elements bound by jquery-ujs
    inputChangeSelector: 'select[data-remote], input[data-remote], textarea[data-remote]',

    // Form elements bound by jquery-ujs
    formSubmitSelector: 'form',

    // Form input elements bound by jquery-ujs
    formInputClickSelector: 'form input[type=submit], form input[type=image], form button[type=submit], form button:not([type]), input[type=submit][form], input[type=image][form], button[type=submit][form], button[form]:not([type])',

    // Form input elements disabled during form submission
    disableSelector: 'input[data-disable-with]:enabled, button[data-disable-with]:enabled, textarea[data-disable-with]:enabled, input[data-disable]:enabled, button[data-disable]:enabled, textarea[data-disable]:enabled',

    // Form input elements re-enabled after form submission
    enableSelector: 'input[data-disable-with]:disabled, button[data-disable-with]:disabled, textarea[data-disable-with]:disabled, input[data-disable]:disabled, button[data-disable]:disabled, textarea[data-disable]:disabled',

    // Form required input elements
    requiredInputSelector: 'input[name][required]:not([disabled]),textarea[name][required]:not([disabled])',

    // Form file input elements
    fileInputSelector: 'input[type=file]',

    // Link onClick disable selector with possible reenable after remote submission
    linkDisableSelector: 'a[data-disable-with], a[data-disable]',

    // Button onClick disable selector with possible reenable after remote submission
    buttonDisableSelector: 'button[data-remote][data-disable-with], button[data-remote][data-disable]',

    // Make sure that every Ajax request sends the CSRF token
    CSRFProtection: function(xhr) {
      var token = $('meta[name="csrf-token"]').attr('content');
      if (token) xhr.setRequestHeader('X-CSRF-Token', token);
    },

    // making sure that all forms have actual up-to-date token(cached forms contain old one)
    refreshCSRFTokens: function(){
      var csrfToken = $('meta[name=csrf-token]').attr('content');
      var csrfParam = $('meta[name=csrf-param]').attr('content');
      $('form input[name="' + csrfParam + '"]').val(csrfToken);
    },

    // Triggers an event on an element and returns false if the event result is false
    fire: function(obj, name, data) {
      var event = $.Event(name);
      obj.trigger(event, data);
      return event.result !== false;
    },

    // Default confirm dialog, may be overridden with custom confirm dialog in $.rails.confirm
    confirm: function(message) {
      return confirm(message);
    },

    // Default ajax function, may be overridden with custom function in $.rails.ajax
    ajax: function(options) {
      return $.ajax(options);
    },

    // Default way to get an element's href. May be overridden at $.rails.href.
    href: function(element) {
      return element[0].href;
    },

    // Submits "remote" forms and links with ajax
    handleRemote: function(element) {
      var method, url, data, withCredentials, dataType, options;

      if (rails.fire(element, 'ajax:before')) {
        withCredentials = element.data('with-credentials') || null;
        dataType = element.data('type') || ($.ajaxSettings && $.ajaxSettings.dataType);

        if (element.is('form')) {
          method = element.attr('method');
          url = element.attr('action');
          data = element.serializeArray();
          // memoized value from clicked submit button
          var button = element.data('ujs:submit-button');
          if (button) {
            data.push(button);
            element.data('ujs:submit-button', null);
          }
        } else if (element.is(rails.inputChangeSelector)) {
          method = element.data('method');
          url = element.data('url');
          data = element.serialize();
          if (element.data('params')) data = data + "&" + element.data('params');
        } else if (element.is(rails.buttonClickSelector)) {
          method = element.data('method') || 'get';
          url = element.data('url');
          data = element.serialize();
          if (element.data('params')) data = data + "&" + element.data('params');
        } else {
          method = element.data('method');
          url = rails.href(element);
          data = element.data('params') || null;
        }

        options = {
          type: method || 'GET', data: data, dataType: dataType,
          // stopping the "ajax:beforeSend" event will cancel the ajax request
          beforeSend: function(xhr, settings) {
            if (settings.dataType === undefined) {
              xhr.setRequestHeader('accept', '*/*;q=0.5, ' + settings.accepts.script);
            }
            if (rails.fire(element, 'ajax:beforeSend', [xhr, settings])) {
              element.trigger('ajax:send', xhr);
            } else {
              return false;
            }
          },
          success: function(data, status, xhr) {
            element.trigger('ajax:success', [data, status, xhr]);
          },
          complete: function(xhr, status) {
            element.trigger('ajax:complete', [xhr, status]);
          },
          error: function(xhr, status, error) {
            element.trigger('ajax:error', [xhr, status, error]);
          },
          crossDomain: rails.isCrossDomain(url)
        };

        // There is no withCredentials for IE6-8 when
        // "Enable native XMLHTTP support" is disabled
        if (withCredentials) {
          options.xhrFields = {
            withCredentials: withCredentials
          };
        }

        // Only pass url to `ajax` options if not blank
        if (url) { options.url = url; }

        return rails.ajax(options);
      } else {
        return false;
      }
    },

    // Determines if the request is a cross domain request.
    isCrossDomain: function(url) {
      var originAnchor = document.createElement("a");
      originAnchor.href = location.href;
      var urlAnchor = document.createElement("a");

      try {
        urlAnchor.href = url;
        // This is a workaround to a IE bug.
        urlAnchor.href = urlAnchor.href;

        // Make sure that the browser parses the URL and that the protocols and hosts match.
        return !urlAnchor.protocol || !urlAnchor.host ||
          (originAnchor.protocol + "//" + originAnchor.host !==
            urlAnchor.protocol + "//" + urlAnchor.host);
      } catch (e) {
        // If there is an error parsing the URL, assume it is crossDomain.
        return true;
      }
    },

    // Handles "data-method" on links such as:
    // <a href="/users/5" data-method="delete" rel="nofollow" data-confirm="Are you sure?">Delete</a>
    handleMethod: function(link) {
      var href = rails.href(link),
        method = link.data('method'),
        target = link.attr('target'),
        csrfToken = $('meta[name=csrf-token]').attr('content'),
        csrfParam = $('meta[name=csrf-param]').attr('content'),
        form = $('<form method="post" action="' + href + '"></form>'),
        metadataInput = '<input name="_method" value="' + method + '" type="hidden" />';

      if (csrfParam !== undefined && csrfToken !== undefined && !rails.isCrossDomain(href)) {
        metadataInput += '<input name="' + csrfParam + '" value="' + csrfToken + '" type="hidden" />';
      }

      if (target) { form.attr('target', target); }

      form.hide().append(metadataInput).appendTo('body');
      form.submit();
    },

    // Helper function that returns form elements that match the specified CSS selector
    // If form is actually a "form" element this will return associated elements outside the from that have
    // the html form attribute set
    formElements: function(form, selector) {
      return form.is('form') ? $(form[0].elements).filter(selector) : form.find(selector);
    },

    /* Disables form elements:
      - Caches element value in 'ujs:enable-with' data store
      - Replaces element text with value of 'data-disable-with' attribute
      - Sets disabled property to true
    */
    disableFormElements: function(form) {
      rails.formElements(form, rails.disableSelector).each(function() {
        rails.disableFormElement($(this));
      });
    },

    disableFormElement: function(element) {
      var method, replacement;

      method = element.is('button') ? 'html' : 'val';
      replacement = element.data('disable-with');

      element.data('ujs:enable-with', element[method]());
      if (replacement !== undefined) {
        element[method](replacement);
      }

      element.prop('disabled', true);
    },

    /* Re-enables disabled form elements:
      - Replaces element text with cached value from 'ujs:enable-with' data store (created in `disableFormElements`)
      - Sets disabled property to false
    */
    enableFormElements: function(form) {
      rails.formElements(form, rails.enableSelector).each(function() {
        rails.enableFormElement($(this));
      });
    },

    enableFormElement: function(element) {
      var method = element.is('button') ? 'html' : 'val';
      if (element.data('ujs:enable-with')) element[method](element.data('ujs:enable-with'));
      element.prop('disabled', false);
    },

   /* For 'data-confirm' attribute:
      - Fires `confirm` event
      - Shows the confirmation dialog
      - Fires the `confirm:complete` event

      Returns `true` if no function stops the chain and user chose yes; `false` otherwise.
      Attaching a handler to the element's `confirm` event that returns a `falsy` value cancels the confirmation dialog.
      Attaching a handler to the element's `confirm:complete` event that returns a `falsy` value makes this function
      return false. The `confirm:complete` event is fired whether or not the user answered true or false to the dialog.
   */
    allowAction: function(element) {
      var message = element.data('confirm'),
          answer = false, callback;
      if (!message) { return true; }

      if (rails.fire(element, 'confirm')) {
        answer = rails.confirm(message);
        callback = rails.fire(element, 'confirm:complete', [answer]);
      }
      return answer && callback;
    },

    // Helper function which checks for blank inputs in a form that match the specified CSS selector
    blankInputs: function(form, specifiedSelector, nonBlank) {
      var inputs = $(), input, valueToCheck,
          selector = specifiedSelector || 'input,textarea',
          allInputs = form.find(selector);

      allInputs.each(function() {
        input = $(this);
        valueToCheck = input.is('input[type=checkbox],input[type=radio]') ? input.is(':checked') : input.val();
        // If nonBlank and valueToCheck are both truthy, or nonBlank and valueToCheck are both falsey
        if (!valueToCheck === !nonBlank) {

          // Don't count unchecked required radio if other radio with same name is checked
          if (input.is('input[type=radio]') && allInputs.filter('input[type=radio]:checked[name="' + input.attr('name') + '"]').length) {
            return true; // Skip to next input
          }

          inputs = inputs.add(input);
        }
      });
      return inputs.length ? inputs : false;
    },

    // Helper function which checks for non-blank inputs in a form that match the specified CSS selector
    nonBlankInputs: function(form, specifiedSelector) {
      return rails.blankInputs(form, specifiedSelector, true); // true specifies nonBlank
    },

    // Helper function, needed to provide consistent behavior in IE
    stopEverything: function(e) {
      $(e.target).trigger('ujs:everythingStopped');
      e.stopImmediatePropagation();
      return false;
    },

    //  replace element's html with the 'data-disable-with' after storing original html
    //  and prevent clicking on it
    disableElement: function(element) {
      var replacement = element.data('disable-with');

      element.data('ujs:enable-with', element.html()); // store enabled state
      if (replacement !== undefined) {
        element.html(replacement);
      }

      element.bind('click.railsDisable', function(e) { // prevent further clicking
        return rails.stopEverything(e);
      });
    },

    // restore element to its original state which was disabled by 'disableElement' above
    enableElement: function(element) {
      if (element.data('ujs:enable-with') !== undefined) {
        element.html(element.data('ujs:enable-with')); // set to old enabled state
        element.removeData('ujs:enable-with'); // clean up cache
      }
      element.unbind('click.railsDisable'); // enable element
    }
  };

  if (rails.fire($document, 'rails:attachBindings')) {

    $.ajaxPrefilter(function(options, originalOptions, xhr){ if ( !options.crossDomain ) { rails.CSRFProtection(xhr); }});

    $document.delegate(rails.linkDisableSelector, 'ajax:complete', function() {
        rails.enableElement($(this));
    });

    $document.delegate(rails.buttonDisableSelector, 'ajax:complete', function() {
        rails.enableFormElement($(this));
    });

    $document.delegate(rails.linkClickSelector, 'click.rails', function(e) {
      var link = $(this), method = link.data('method'), data = link.data('params'), metaClick = e.metaKey || e.ctrlKey;
      if (!rails.allowAction(link)) return rails.stopEverything(e);

      if (!metaClick && link.is(rails.linkDisableSelector)) rails.disableElement(link);

      if (link.data('remote') !== undefined) {
        if (metaClick && (!method || method === 'GET') && !data) { return true; }

        var handleRemote = rails.handleRemote(link);
        // response from rails.handleRemote() will either be false or a deferred object promise.
        if (handleRemote === false) {
          rails.enableElement(link);
        } else {
          handleRemote.error( function() { rails.enableElement(link); } );
        }
        return false;

      } else if (link.data('method')) {
        rails.handleMethod(link);
        return false;
      }
    });

    $document.delegate(rails.buttonClickSelector, 'click.rails', function(e) {
      var button = $(this);

      if (!rails.allowAction(button)) return rails.stopEverything(e);

      if (button.is(rails.buttonDisableSelector)) rails.disableFormElement(button);

      var handleRemote = rails.handleRemote(button);
      // response from rails.handleRemote() will either be false or a deferred object promise.
      if (handleRemote === false) {
        rails.enableFormElement(button);
      } else {
        handleRemote.error( function() { rails.enableFormElement(button); } );
      }
      return false;
    });

    $document.delegate(rails.inputChangeSelector, 'change.rails', function(e) {
      var link = $(this);
      if (!rails.allowAction(link)) return rails.stopEverything(e);

      rails.handleRemote(link);
      return false;
    });

    $document.delegate(rails.formSubmitSelector, 'submit.rails', function(e) {
      var form = $(this),
        remote = form.data('remote') !== undefined,
        blankRequiredInputs,
        nonBlankFileInputs;

      if (!rails.allowAction(form)) return rails.stopEverything(e);

      // skip other logic when required values are missing or file upload is present
      if (form.attr('novalidate') == undefined) {
        blankRequiredInputs = rails.blankInputs(form, rails.requiredInputSelector);
        if (blankRequiredInputs && rails.fire(form, 'ajax:aborted:required', [blankRequiredInputs])) {
          return rails.stopEverything(e);
        }
      }

      if (remote) {
        nonBlankFileInputs = rails.nonBlankInputs(form, rails.fileInputSelector);
        if (nonBlankFileInputs) {
          // slight timeout so that the submit button gets properly serialized
          // (make it easy for event handler to serialize form without disabled values)
          setTimeout(function(){ rails.disableFormElements(form); }, 13);
          var aborted = rails.fire(form, 'ajax:aborted:file', [nonBlankFileInputs]);

          // re-enable form elements if event bindings return false (canceling normal form submission)
          if (!aborted) { setTimeout(function(){ rails.enableFormElements(form); }, 13); }

          return aborted;
        }

        rails.handleRemote(form);
        return false;

      } else {
        // slight timeout so that the submit button gets properly serialized
        setTimeout(function(){ rails.disableFormElements(form); }, 13);
      }
    });

    $document.delegate(rails.formInputClickSelector, 'click.rails', function(event) {
      var button = $(this);

      if (!rails.allowAction(button)) return rails.stopEverything(event);

      // register the pressed submit button
      var name = button.attr('name'),
        data = name ? {name:name, value:button.val()} : null;

      button.closest('form').data('ujs:submit-button', data);
    });

    $document.delegate(rails.formSubmitSelector, 'ajax:send.rails', function(event) {
      if (this == event.target) rails.disableFormElements($(this));
    });

    $document.delegate(rails.formSubmitSelector, 'ajax:complete.rails', function(event) {
      if (this == event.target) rails.enableFormElements($(this));
    });

    $(function(){
      rails.refreshCSRFTokens();
    });
  }

})( jQuery );

/* jshint debug: true, expr: true */


;(function($){

	/* Constants & defaults. */
	var DATA_COLOR    = 'data-ab-color';
	var DATA_PARENT   = 'data-ab-parent';
	var DATA_CSS_BG   = 'data-ab-css-background';
	var EVENT_CF      = 'ab-color-found';

	var DEFAULTS      = {
		node:                   null,
		selector:             '[data-adaptive-background]',
		parent:               null,
		exclude:              [ 'rgb(0,0,0)', 'rgba(255,255,255)' ],
		normalizeTextColor:   false,
		normalizedTextColors:  {
			light:      "#fff",
			dark:       "#000"
		},
		lumaClasses:  {
			light:      "ab-light",
			dark:       "ab-dark"
		}
	};

	// Include RGBaster - https://github.com/briangonzalez/rgbaster.js
	/* jshint ignore:start */
	!function(n){"use strict";var t=function(){return document.createElement("canvas").getContext("2d")},e=function(n,e){var a=new Image,o=n.src||n;"data:"!==o.substring(0,5)&&(a.crossOrigin="Anonymous"),a.onload=function(){var n=t("2d");n.drawImage(a,0,0);var o=n.getImageData(0,0,a.width,a.height);e&&e(o.data)},a.src=o},a=function(n){return["rgb(",n,")"].join("")},o=function(n){return n.map(function(n){return a(n.name)})},r=5,i=10,c={};c.colors=function(n,t){t=t||{};var c=t.exclude||[],u=t.paletteSize||i;e(n,function(e){for(var i=n.width*n.height||e.length,m={},s="",d=[],f={dominant:{name:"",count:0},palette:Array.apply(null,new Array(u)).map(Boolean).map(function(){return{name:"0,0,0",count:0}})},l=0;i>l;){if(d[0]=e[l],d[1]=e[l+1],d[2]=e[l+2],s=d.join(","),m[s]=s in m?m[s]+1:1,-1===c.indexOf(a(s))){var g=m[s];g>f.dominant.count?(f.dominant.name=s,f.dominant.count=g):f.palette.some(function(n){return g>n.count?(n.name=s,n.count=g,!0):void 0})}l+=4*r}if(t.success){var p=o(f.palette);t.success({dominant:a(f.dominant.name),secondary:p[0],palette:p})}})},n.RGBaster=n.RGBaster||c}(window);
	/* jshint ignore:end */


	/*
		Our main function declaration.
	*/
	$.adaptiveBackground = {
		run: function( options ){
			var opts = $.extend({}, DEFAULTS, options);
			// var colors;

			var handleColors = function (node) {
				var img = node;
				var colors;

				colors = RGBaster.colors(img, {
					paletteSize: 20,
					exclude:  [ 'rgb(0,0,0)', 'rgba(255,255,255)' ],
					success: function(colors) {
						return colors.dominant;
					}
				});
				console.log(colors);
			};

			/* Handle the colors. */
			return handleColors(opts.node);
		},
	};

})(jQuery);
(function() {
  $(function() {});

}).call(this);
/*!
 * caption.js | easily and semantically add captions to your images
 * http://captionjs.com
 *
 * Copyright 2013-2014, Eric Magnuson
 * Released under the MIT license
 * https://github.com/jquery/jquery/blob/master/MIT-LICENSE.txt
 *
 * v0.9.8
 * Date: 2014-10-13
 */

(function($, window, undefined){
	$.fn.captionjs = function(opts){

		// Default values for options
		var defaults = {
			'class_name'      : 'captionjs', // Class name for each <figure>
			'schema'          : true,        // Use schema.org markup (i.e., itemtype, itemprop)
			'mode'            : 'default',   // default | stacked | animated | hide
			'debug_mode'      : false,       // Output debug info to the JS console
			'force_dimensions': true,        // Force the dimensions in case they cannot be detected (e.g., image is not yet painted to viewport)
			'is_responsive'   : false,       // Ensure the figure and image change size when in responsive layout. Requires a container to control responsiveness!
			'inherit_styles'  : false        // Have the caption.js container inherit box-model properties from the original image
		};

		// Extend the options from defaults with user's options
		var options = $.extend(defaults, opts || {});

		// Function to copy styles
		var transferStyles = function(property, reset_val, $origin, $target){
			if ($origin.jquery && $target.jquery) // Check that they are jQuery objects
			{
				$origin.css(property, $target.css(property));
				$target.css(property, reset_val);
			}
		};

		// jQuery chainability -- do the magic below
		return this.each(function(){

			if (options.debug_mode) console.log('caption.js | Starting.');

			// Form basic structures and assign vars
			var $this       = $(this),  // The image
				$caption    = $this.data('caption') ? $this.data('caption') : $this.attr('alt'),
				$figure     = $this.wrap('<figure class="' + options.class_name + ' ' + options.mode + '"/>').after('<figcaption/>').parent(),
				$figcaption = $this.next('figcaption').html($caption),
				$link       = $this.data('link') ? $figcaption.wrapInner('<a href="' + $this.data('link') + '"/>').children('a').css('padding', '0').css('margin', '0') : null,
				target_width,
				target_height;

			// If no caption is supplied, just remove the figcaption.
			if ($caption === '') $figcaption.remove();

			if (options.debug_mode) console.log('caption.js | Caption: ' + $caption);

			// Determine the appropriate dimensions for the figure, our top-most container for caption.js.
			if (options.force_dimensions)
			{
				if (options.debug_mode) console.log('caption.js | Forcing dimensions with a clone.');

				// Create a clone outside of the viewport to detect and then set the dimensions.
				var $clone = $figure.clone().css({
					'position': 'absolute',
					'left'    : '-9999px'
				}).appendTo('body');

				target_width = $('img', $clone).outerWidth();
				target_height = $('figcaption', $clone).css('width', target_width).css('clear', 'both').outerHeight(); // Make sure width (and thus line wrapping) is enforced so that the height is correct

				$clone.remove();
			}
			else
			{
				target_width = $this.outerWidth();
				target_height = $figcaption.outerHeight();
			}

			// If responsive, set widths across the board to 100%. We will rely on a
			// responsive container to constrain the size of the image.
			if (options.is_responsive)
			{
				target_width = '100%';
				$this.width(target_width);
			}

			// Copy styles if need be
			if (options.inherit_styles)
			{
				if ($this.css('display') == 'inline')
					$figure.css('display', 'inline-block');
				else
					transferStyles('display', 'block', $figure, $this);

				if ($this.css('position') == 'static')
					$figure.css('position', 'relative');
				else
					transferStyles('position', 'relative', $figure, $this);

				transferStyles('clear', 'both', $figure, $this);
				transferStyles('float', 'none', $figure, $this);
				transferStyles('margin', '0', $figure, $this);
				// transferStyles('padding', '0', $figure, $this); // Finish this
				$this.css('padding', '0');
				transferStyles('left', 'auto', $figure, $this);
				transferStyles('right', 'auto', $figure, $this);
				transferStyles('top', 'auto', $figure, $this);
				transferStyles('bottom', 'auto', $figure, $this);
				transferStyles('z-index', $this.css('z-index'), $figure, $this);
			}

			// Set the width of the figure.
			$figure.width(target_width);

			// Schema markup if enabled
			if (options.schema)
			{
				$figure.attr({
					'itemscope': 'itemscope',
					'itemtype':  'http://schema.org/Photograph'
				});
				$figcaption.attr('itemprop', 'name');
				$this.attr('itemprop', 'image');
			}

			// Stacked mode
			if (options.mode === 'stacked')
			{
				$figcaption.css({
					'margin-bottom': '0',
					'bottom': '0',
				});
			}

			// Animated mode
			if (options.mode === 'animated')
			{
				$figcaption.css({
					'margin-bottom': '0',
					'bottom': -target_height,
				});
			}

			// Hide mode
			if (options.mode === 'hide')
			{
				$figcaption.css({
					'margin-bottom': target_height,
					'bottom': -target_height,
				});
			}

		});
	};
})(jQuery, window);
!function(a){function b(){}function c(a){function c(b){b.prototype.option||(b.prototype.option=function(b){a.isPlainObject(b)&&(this.options=a.extend(!0,this.options,b))})}function e(b,c){a.fn[b]=function(e){if("string"==typeof e){for(var g=d.call(arguments,1),h=0,i=this.length;i>h;h++){var j=this[h],k=a.data(j,b);if(k)if(a.isFunction(k[e])&&"_"!==e.charAt(0)){var l=k[e].apply(k,g);if(void 0!==l)return l}else f("no such method '"+e+"' for "+b+" instance");else f("cannot call methods on "+b+" prior to initialization; attempted to call '"+e+"'")}return this}return this.each(function(){var d=a.data(this,b);d?(d.option(e),d._init()):(d=new c(this,e),a.data(this,b,d))})}}if(a){var f="undefined"==typeof console?b:function(a){console.error(a)};return a.bridget=function(a,b){c(b),e(a,b)},a.bridget}}var d=Array.prototype.slice;"function"==typeof define&&define.amd?define("jquery-bridget/jquery.bridget",["jquery"],c):c("object"==typeof exports?require("jquery"):a.jQuery)}(window),function(a){function b(b){var c=a.event;return c.target=c.target||c.srcElement||b,c}var c=document.documentElement,d=function(){};c.addEventListener?d=function(a,b,c){a.addEventListener(b,c,!1)}:c.attachEvent&&(d=function(a,c,d){a[c+d]=d.handleEvent?function(){var c=b(a);d.handleEvent.call(d,c)}:function(){var c=b(a);d.call(a,c)},a.attachEvent("on"+c,a[c+d])});var e=function(){};c.removeEventListener?e=function(a,b,c){a.removeEventListener(b,c,!1)}:c.detachEvent&&(e=function(a,b,c){a.detachEvent("on"+b,a[b+c]);try{delete a[b+c]}catch(d){a[b+c]=void 0}});var f={bind:d,unbind:e};"function"==typeof define&&define.amd?define("eventie/eventie",f):"object"==typeof exports?module.exports=f:a.eventie=f}(window),function(){function a(){}function b(a,b){for(var c=a.length;c--;)if(a[c].listener===b)return c;return-1}function c(a){return function(){return this[a].apply(this,arguments)}}var d=a.prototype,e=this,f=e.EventEmitter;d.getListeners=function(a){var b,c,d=this._getEvents();if(a instanceof RegExp){b={};for(c in d)d.hasOwnProperty(c)&&a.test(c)&&(b[c]=d[c])}else b=d[a]||(d[a]=[]);return b},d.flattenListeners=function(a){var b,c=[];for(b=0;b<a.length;b+=1)c.push(a[b].listener);return c},d.getListenersAsObject=function(a){var b,c=this.getListeners(a);return c instanceof Array&&(b={},b[a]=c),b||c},d.addListener=function(a,c){var d,e=this.getListenersAsObject(a),f="object"==typeof c;for(d in e)e.hasOwnProperty(d)&&-1===b(e[d],c)&&e[d].push(f?c:{listener:c,once:!1});return this},d.on=c("addListener"),d.addOnceListener=function(a,b){return this.addListener(a,{listener:b,once:!0})},d.once=c("addOnceListener"),d.defineEvent=function(a){return this.getListeners(a),this},d.defineEvents=function(a){for(var b=0;b<a.length;b+=1)this.defineEvent(a[b]);return this},d.removeListener=function(a,c){var d,e,f=this.getListenersAsObject(a);for(e in f)f.hasOwnProperty(e)&&(d=b(f[e],c),-1!==d&&f[e].splice(d,1));return this},d.off=c("removeListener"),d.addListeners=function(a,b){return this.manipulateListeners(!1,a,b)},d.removeListeners=function(a,b){return this.manipulateListeners(!0,a,b)},d.manipulateListeners=function(a,b,c){var d,e,f=a?this.removeListener:this.addListener,g=a?this.removeListeners:this.addListeners;if("object"!=typeof b||b instanceof RegExp)for(d=c.length;d--;)f.call(this,b,c[d]);else for(d in b)b.hasOwnProperty(d)&&(e=b[d])&&("function"==typeof e?f.call(this,d,e):g.call(this,d,e));return this},d.removeEvent=function(a){var b,c=typeof a,d=this._getEvents();if("string"===c)delete d[a];else if(a instanceof RegExp)for(b in d)d.hasOwnProperty(b)&&a.test(b)&&delete d[b];else delete this._events;return this},d.removeAllListeners=c("removeEvent"),d.emitEvent=function(a,b){var c,d,e,f,g=this.getListenersAsObject(a);for(e in g)if(g.hasOwnProperty(e))for(d=g[e].length;d--;)c=g[e][d],c.once===!0&&this.removeListener(a,c.listener),f=c.listener.apply(this,b||[]),f===this._getOnceReturnValue()&&this.removeListener(a,c.listener);return this},d.trigger=c("emitEvent"),d.emit=function(a){var b=Array.prototype.slice.call(arguments,1);return this.emitEvent(a,b)},d.setOnceReturnValue=function(a){return this._onceReturnValue=a,this},d._getOnceReturnValue=function(){return this.hasOwnProperty("_onceReturnValue")?this._onceReturnValue:!0},d._getEvents=function(){return this._events||(this._events={})},a.noConflict=function(){return e.EventEmitter=f,a},"function"==typeof define&&define.amd?define("eventEmitter/EventEmitter",[],function(){return a}):"object"==typeof module&&module.exports?module.exports=a:e.EventEmitter=a}.call(this),function(a){function b(a){if(a){if("string"==typeof d[a])return a;a=a.charAt(0).toUpperCase()+a.slice(1);for(var b,e=0,f=c.length;f>e;e++)if(b=c[e]+a,"string"==typeof d[b])return b}}var c="Webkit Moz ms Ms O".split(" "),d=document.documentElement.style;"function"==typeof define&&define.amd?define("get-style-property/get-style-property",[],function(){return b}):"object"==typeof exports?module.exports=b:a.getStyleProperty=b}(window),function(a){function b(a){var b=parseFloat(a),c=-1===a.indexOf("%")&&!isNaN(b);return c&&b}function c(){}function d(){for(var a={width:0,height:0,innerWidth:0,innerHeight:0,outerWidth:0,outerHeight:0},b=0,c=g.length;c>b;b++){var d=g[b];a[d]=0}return a}function e(c){function e(){if(!m){m=!0;var d=a.getComputedStyle;if(j=function(){var a=d?function(a){return d(a,null)}:function(a){return a.currentStyle};return function(b){var c=a(b);return c||f("Style returned "+c+". Are you running this code in a hidden iframe on Firefox? See http://bit.ly/getsizebug1"),c}}(),k=c("boxSizing")){var e=document.createElement("div");e.style.width="200px",e.style.padding="1px 2px 3px 4px",e.style.borderStyle="solid",e.style.borderWidth="1px 2px 3px 4px",e.style[k]="border-box";var g=document.body||document.documentElement;g.appendChild(e);var h=j(e);l=200===b(h.width),g.removeChild(e)}}}function h(a){if(e(),"string"==typeof a&&(a=document.querySelector(a)),a&&"object"==typeof a&&a.nodeType){var c=j(a);if("none"===c.display)return d();var f={};f.width=a.offsetWidth,f.height=a.offsetHeight;for(var h=f.isBorderBox=!(!k||!c[k]||"border-box"!==c[k]),m=0,n=g.length;n>m;m++){var o=g[m],p=c[o];p=i(a,p);var q=parseFloat(p);f[o]=isNaN(q)?0:q}var r=f.paddingLeft+f.paddingRight,s=f.paddingTop+f.paddingBottom,t=f.marginLeft+f.marginRight,u=f.marginTop+f.marginBottom,v=f.borderLeftWidth+f.borderRightWidth,w=f.borderTopWidth+f.borderBottomWidth,x=h&&l,y=b(c.width);y!==!1&&(f.width=y+(x?0:r+v));var z=b(c.height);return z!==!1&&(f.height=z+(x?0:s+w)),f.innerWidth=f.width-(r+v),f.innerHeight=f.height-(s+w),f.outerWidth=f.width+t,f.outerHeight=f.height+u,f}}function i(b,c){if(a.getComputedStyle||-1===c.indexOf("%"))return c;var d=b.style,e=d.left,f=b.runtimeStyle,g=f&&f.left;return g&&(f.left=b.currentStyle.left),d.left=c,c=d.pixelLeft,d.left=e,g&&(f.left=g),c}var j,k,l,m=!1;return h}var f="undefined"==typeof console?c:function(a){console.error(a)},g=["paddingLeft","paddingRight","paddingTop","paddingBottom","marginLeft","marginRight","marginTop","marginBottom","borderLeftWidth","borderRightWidth","borderTopWidth","borderBottomWidth"];"function"==typeof define&&define.amd?define("get-size/get-size",["get-style-property/get-style-property"],e):"object"==typeof exports?module.exports=e(require("desandro-get-style-property")):a.getSize=e(a.getStyleProperty)}(window),function(a){function b(a){"function"==typeof a&&(b.isReady?a():g.push(a))}function c(a){var c="readystatechange"===a.type&&"complete"!==f.readyState;b.isReady||c||d()}function d(){b.isReady=!0;for(var a=0,c=g.length;c>a;a++){var d=g[a];d()}}function e(e){return"complete"===f.readyState?d():(e.bind(f,"DOMContentLoaded",c),e.bind(f,"readystatechange",c),e.bind(a,"load",c)),b}var f=a.document,g=[];b.isReady=!1,"function"==typeof define&&define.amd?define("doc-ready/doc-ready",["eventie/eventie"],e):"object"==typeof exports?module.exports=e(require("eventie")):a.docReady=e(a.eventie)}(window),function(a){function b(a,b){return a[g](b)}function c(a){if(!a.parentNode){var b=document.createDocumentFragment();b.appendChild(a)}}function d(a,b){c(a);for(var d=a.parentNode.querySelectorAll(b),e=0,f=d.length;f>e;e++)if(d[e]===a)return!0;return!1}function e(a,d){return c(a),b(a,d)}var f,g=function(){if(a.matches)return"matches";if(a.matchesSelector)return"matchesSelector";for(var b=["webkit","moz","ms","o"],c=0,d=b.length;d>c;c++){var e=b[c],f=e+"MatchesSelector";if(a[f])return f}}();if(g){var h=document.createElement("div"),i=b(h,"div");f=i?b:e}else f=d;"function"==typeof define&&define.amd?define("matches-selector/matches-selector",[],function(){return f}):"object"==typeof exports?module.exports=f:window.matchesSelector=f}(Element.prototype),function(a,b){"function"==typeof define&&define.amd?define("fizzy-ui-utils/utils",["doc-ready/doc-ready","matches-selector/matches-selector"],function(c,d){return b(a,c,d)}):"object"==typeof exports?module.exports=b(a,require("doc-ready"),require("desandro-matches-selector")):a.fizzyUIUtils=b(a,a.docReady,a.matchesSelector)}(window,function(a,b,c){var d={};d.extend=function(a,b){for(var c in b)a[c]=b[c];return a},d.modulo=function(a,b){return(a%b+b)%b};var e=Object.prototype.toString;d.isArray=function(a){return"[object Array]"==e.call(a)},d.makeArray=function(a){var b=[];if(d.isArray(a))b=a;else if(a&&"number"==typeof a.length)for(var c=0,e=a.length;e>c;c++)b.push(a[c]);else b.push(a);return b},d.indexOf=Array.prototype.indexOf?function(a,b){return a.indexOf(b)}:function(a,b){for(var c=0,d=a.length;d>c;c++)if(a[c]===b)return c;return-1},d.removeFrom=function(a,b){var c=d.indexOf(a,b);-1!=c&&a.splice(c,1)},d.isElement="function"==typeof HTMLElement||"object"==typeof HTMLElement?function(a){return a instanceof HTMLElement}:function(a){return a&&"object"==typeof a&&1==a.nodeType&&"string"==typeof a.nodeName},d.setText=function(){function a(a,c){b=b||(void 0!==document.documentElement.textContent?"textContent":"innerText"),a[b]=c}var b;return a}(),d.getParent=function(a,b){for(;a!=document.body;)if(a=a.parentNode,c(a,b))return a},d.getQueryElement=function(a){return"string"==typeof a?document.querySelector(a):a},d.handleEvent=function(a){var b="on"+a.type;this[b]&&this[b](a)},d.filterFindElements=function(a,b){a=d.makeArray(a);for(var e=[],f=0,g=a.length;g>f;f++){var h=a[f];if(d.isElement(h))if(b){c(h,b)&&e.push(h);for(var i=h.querySelectorAll(b),j=0,k=i.length;k>j;j++)e.push(i[j])}else e.push(h)}return e},d.debounceMethod=function(a,b,c){var d=a.prototype[b],e=b+"Timeout";a.prototype[b]=function(){var a=this[e];a&&clearTimeout(a);var b=arguments,f=this;this[e]=setTimeout(function(){d.apply(f,b),delete f[e]},c||100)}},d.toDashed=function(a){return a.replace(/(.)([A-Z])/g,function(a,b,c){return b+"-"+c}).toLowerCase()};var f=a.console;return d.htmlInit=function(c,e){b(function(){for(var b=d.toDashed(e),g=document.querySelectorAll(".js-"+b),h="data-"+b+"-options",i=0,j=g.length;j>i;i++){var k,l=g[i],m=l.getAttribute(h);try{k=m&&JSON.parse(m)}catch(n){f&&f.error("Error parsing "+h+" on "+l.nodeName.toLowerCase()+(l.id?"#"+l.id:"")+": "+n);continue}var o=new c(l,k),p=a.jQuery;p&&p.data(l,e,o)}})},d}),function(a,b){"function"==typeof define&&define.amd?define("outlayer/item",["eventEmitter/EventEmitter","get-size/get-size","get-style-property/get-style-property","fizzy-ui-utils/utils"],function(c,d,e,f){return b(a,c,d,e,f)}):"object"==typeof exports?module.exports=b(a,require("wolfy87-eventemitter"),require("get-size"),require("desandro-get-style-property"),require("fizzy-ui-utils")):(a.Outlayer={},a.Outlayer.Item=b(a,a.EventEmitter,a.getSize,a.getStyleProperty,a.fizzyUIUtils))}(window,function(a,b,c,d,e){function f(a){for(var b in a)return!1;return b=null,!0}function g(a,b){a&&(this.element=a,this.layout=b,this.position={x:0,y:0},this._create())}function h(a){return a.replace(/([A-Z])/g,function(a){return"-"+a.toLowerCase()})}var i=a.getComputedStyle,j=i?function(a){return i(a,null)}:function(a){return a.currentStyle},k=d("transition"),l=d("transform"),m=k&&l,n=!!d("perspective"),o={WebkitTransition:"webkitTransitionEnd",MozTransition:"transitionend",OTransition:"otransitionend",transition:"transitionend"}[k],p=["transform","transition","transitionDuration","transitionProperty"],q=function(){for(var a={},b=0,c=p.length;c>b;b++){var e=p[b],f=d(e);f&&f!==e&&(a[e]=f)}return a}();e.extend(g.prototype,b.prototype),g.prototype._create=function(){this._transn={ingProperties:{},clean:{},onEnd:{}},this.css({position:"absolute"})},g.prototype.handleEvent=function(a){var b="on"+a.type;this[b]&&this[b](a)},g.prototype.getSize=function(){this.size=c(this.element)},g.prototype.css=function(a){var b=this.element.style;for(var c in a){var d=q[c]||c;b[d]=a[c]}},g.prototype.getPosition=function(){var a=j(this.element),b=this.layout.options,c=b.isOriginLeft,d=b.isOriginTop,e=a[c?"left":"right"],f=a[d?"top":"bottom"],g=parseInt(e,10),h=parseInt(f,10),i=this.layout.size;g=-1!=e.indexOf("%")?g/100*i.width:g,h=-1!=f.indexOf("%")?h/100*i.height:h,g=isNaN(g)?0:g,h=isNaN(h)?0:h,g-=c?i.paddingLeft:i.paddingRight,h-=d?i.paddingTop:i.paddingBottom,this.position.x=g,this.position.y=h},g.prototype.layoutPosition=function(){var a=this.layout.size,b=this.layout.options,c={},d=b.isOriginLeft?"paddingLeft":"paddingRight",e=b.isOriginLeft?"left":"right",f=b.isOriginLeft?"right":"left",g=this.position.x+a[d];c[e]=this.getXValue(g),c[f]="";var h=b.isOriginTop?"paddingTop":"paddingBottom",i=b.isOriginTop?"top":"bottom",j=b.isOriginTop?"bottom":"top",k=this.position.y+a[h];c[i]=this.getYValue(k),c[j]="",this.css(c),this.emitEvent("layout",[this])},g.prototype.getXValue=function(a){var b=this.layout.options;return b.percentPosition&&!b.isHorizontal?a/this.layout.size.width*100+"%":a+"px"},g.prototype.getYValue=function(a){var b=this.layout.options;return b.percentPosition&&b.isHorizontal?a/this.layout.size.height*100+"%":a+"px"},g.prototype._transitionTo=function(a,b){this.getPosition();var c=this.position.x,d=this.position.y,e=parseInt(a,10),f=parseInt(b,10),g=e===this.position.x&&f===this.position.y;if(this.setPosition(a,b),g&&!this.isTransitioning)return void this.layoutPosition();var h=a-c,i=b-d,j={};j.transform=this.getTranslate(h,i),this.transition({to:j,onTransitionEnd:{transform:this.layoutPosition},isCleaning:!0})},g.prototype.getTranslate=function(a,b){var c=this.layout.options;return a=c.isOriginLeft?a:-a,b=c.isOriginTop?b:-b,a=this.getXValue(a),b=this.getYValue(b),n?"translate3d("+a+", "+b+", 0)":"translate("+a+", "+b+")"},g.prototype.goTo=function(a,b){this.setPosition(a,b),this.layoutPosition()},g.prototype.moveTo=m?g.prototype._transitionTo:g.prototype.goTo,g.prototype.setPosition=function(a,b){this.position.x=parseInt(a,10),this.position.y=parseInt(b,10)},g.prototype._nonTransition=function(a){this.css(a.to),a.isCleaning&&this._removeStyles(a.to);for(var b in a.onTransitionEnd)a.onTransitionEnd[b].call(this)},g.prototype._transition=function(a){if(!parseFloat(this.layout.options.transitionDuration))return void this._nonTransition(a);var b=this._transn;for(var c in a.onTransitionEnd)b.onEnd[c]=a.onTransitionEnd[c];for(c in a.to)b.ingProperties[c]=!0,a.isCleaning&&(b.clean[c]=!0);if(a.from){this.css(a.from);var d=this.element.offsetHeight;d=null}this.enableTransition(a.to),this.css(a.to),this.isTransitioning=!0};var r="opacity,"+h(q.transform||"transform");g.prototype.enableTransition=function(){this.isTransitioning||(this.css({transitionProperty:r,transitionDuration:this.layout.options.transitionDuration}),this.element.addEventListener(o,this,!1))},g.prototype.transition=g.prototype[k?"_transition":"_nonTransition"],g.prototype.onwebkitTransitionEnd=function(a){this.ontransitionend(a)},g.prototype.onotransitionend=function(a){this.ontransitionend(a)};var s={"-webkit-transform":"transform","-moz-transform":"transform","-o-transform":"transform"};g.prototype.ontransitionend=function(a){if(a.target===this.element){var b=this._transn,c=s[a.propertyName]||a.propertyName;if(delete b.ingProperties[c],f(b.ingProperties)&&this.disableTransition(),c in b.clean&&(this.element.style[a.propertyName]="",delete b.clean[c]),c in b.onEnd){var d=b.onEnd[c];d.call(this),delete b.onEnd[c]}this.emitEvent("transitionEnd",[this])}},g.prototype.disableTransition=function(){this.removeTransitionStyles(),this.element.removeEventListener(o,this,!1),this.isTransitioning=!1},g.prototype._removeStyles=function(a){var b={};for(var c in a)b[c]="";this.css(b)};var t={transitionProperty:"",transitionDuration:""};return g.prototype.removeTransitionStyles=function(){this.css(t)},g.prototype.removeElem=function(){this.element.parentNode.removeChild(this.element),this.css({display:""}),this.emitEvent("remove",[this])},g.prototype.remove=function(){if(!k||!parseFloat(this.layout.options.transitionDuration))return void this.removeElem();var a=this;this.once("transitionEnd",function(){a.removeElem()}),this.hide()},g.prototype.reveal=function(){delete this.isHidden,this.css({display:""});var a=this.layout.options,b={},c=this.getHideRevealTransitionEndProperty("visibleStyle");b[c]=this.onRevealTransitionEnd,this.transition({from:a.hiddenStyle,to:a.visibleStyle,isCleaning:!0,onTransitionEnd:b})},g.prototype.onRevealTransitionEnd=function(){this.isHidden||this.emitEvent("reveal")},g.prototype.getHideRevealTransitionEndProperty=function(a){var b=this.layout.options[a];if(b.opacity)return"opacity";for(var c in b)return c},g.prototype.hide=function(){this.isHidden=!0,this.css({display:""});var a=this.layout.options,b={},c=this.getHideRevealTransitionEndProperty("hiddenStyle");b[c]=this.onHideTransitionEnd,this.transition({from:a.visibleStyle,to:a.hiddenStyle,isCleaning:!0,onTransitionEnd:b})},g.prototype.onHideTransitionEnd=function(){this.isHidden&&(this.css({display:"none"}),this.emitEvent("hide"))},g.prototype.destroy=function(){this.css({position:"",left:"",right:"",top:"",bottom:"",transition:"",transform:""})},g}),function(a,b){"function"==typeof define&&define.amd?define("outlayer/outlayer",["eventie/eventie","eventEmitter/EventEmitter","get-size/get-size","fizzy-ui-utils/utils","./item"],function(c,d,e,f,g){return b(a,c,d,e,f,g)}):"object"==typeof exports?module.exports=b(a,require("eventie"),require("wolfy87-eventemitter"),require("get-size"),require("fizzy-ui-utils"),require("./item")):a.Outlayer=b(a,a.eventie,a.EventEmitter,a.getSize,a.fizzyUIUtils,a.Outlayer.Item)}(window,function(a,b,c,d,e,f){function g(a,b){var c=e.getQueryElement(a);if(!c)return void(h&&h.error("Bad element for "+this.constructor.namespace+": "+(c||a)));this.element=c,i&&(this.$element=i(this.element)),this.options=e.extend({},this.constructor.defaults),this.option(b);var d=++k;this.element.outlayerGUID=d,l[d]=this,this._create(),this.options.isInitLayout&&this.layout()}var h=a.console,i=a.jQuery,j=function(){},k=0,l={};return g.namespace="outlayer",g.Item=f,g.defaults={containerStyle:{position:"relative"},isInitLayout:!0,isOriginLeft:!0,isOriginTop:!0,isResizeBound:!0,isResizingContainer:!0,transitionDuration:"0.4s",hiddenStyle:{opacity:0,transform:"scale(0.001)"},visibleStyle:{opacity:1,transform:"scale(1)"}},e.extend(g.prototype,c.prototype),g.prototype.option=function(a){e.extend(this.options,a)},g.prototype._create=function(){this.reloadItems(),this.stamps=[],this.stamp(this.options.stamp),e.extend(this.element.style,this.options.containerStyle),this.options.isResizeBound&&this.bindResize()},g.prototype.reloadItems=function(){this.items=this._itemize(this.element.children)},g.prototype._itemize=function(a){for(var b=this._filterFindItemElements(a),c=this.constructor.Item,d=[],e=0,f=b.length;f>e;e++){var g=b[e],h=new c(g,this);d.push(h)}return d},g.prototype._filterFindItemElements=function(a){return e.filterFindElements(a,this.options.itemSelector)},g.prototype.getItemElements=function(){for(var a=[],b=0,c=this.items.length;c>b;b++)a.push(this.items[b].element);return a},g.prototype.layout=function(){this._resetLayout(),this._manageStamps();var a=void 0!==this.options.isLayoutInstant?this.options.isLayoutInstant:!this._isLayoutInited;this.layoutItems(this.items,a),this._isLayoutInited=!0},g.prototype._init=g.prototype.layout,g.prototype._resetLayout=function(){this.getSize()},g.prototype.getSize=function(){this.size=d(this.element)},g.prototype._getMeasurement=function(a,b){var c,f=this.options[a];f?("string"==typeof f?c=this.element.querySelector(f):e.isElement(f)&&(c=f),this[a]=c?d(c)[b]:f):this[a]=0},g.prototype.layoutItems=function(a,b){a=this._getItemsForLayout(a),this._layoutItems(a,b),this._postLayout()},g.prototype._getItemsForLayout=function(a){for(var b=[],c=0,d=a.length;d>c;c++){var e=a[c];e.isIgnored||b.push(e)}return b},g.prototype._layoutItems=function(a,b){if(this._emitCompleteOnItems("layout",a),a&&a.length){for(var c=[],d=0,e=a.length;e>d;d++){var f=a[d],g=this._getItemLayoutPosition(f);g.item=f,g.isInstant=b||f.isLayoutInstant,c.push(g)}this._processLayoutQueue(c)}},g.prototype._getItemLayoutPosition=function(){return{x:0,y:0}},g.prototype._processLayoutQueue=function(a){for(var b=0,c=a.length;c>b;b++){var d=a[b];this._positionItem(d.item,d.x,d.y,d.isInstant)}},g.prototype._positionItem=function(a,b,c,d){d?a.goTo(b,c):a.moveTo(b,c)},g.prototype._postLayout=function(){this.resizeContainer()},g.prototype.resizeContainer=function(){if(this.options.isResizingContainer){var a=this._getContainerSize();a&&(this._setContainerMeasure(a.width,!0),this._setContainerMeasure(a.height,!1))}},g.prototype._getContainerSize=j,g.prototype._setContainerMeasure=function(a,b){if(void 0!==a){var c=this.size;c.isBorderBox&&(a+=b?c.paddingLeft+c.paddingRight+c.borderLeftWidth+c.borderRightWidth:c.paddingBottom+c.paddingTop+c.borderTopWidth+c.borderBottomWidth),a=Math.max(a,0),this.element.style[b?"width":"height"]=a+"px"}},g.prototype._emitCompleteOnItems=function(a,b){function c(){e.dispatchEvent(a+"Complete",null,[b])}function d(){g++,g===f&&c()}var e=this,f=b.length;if(!b||!f)return void c();for(var g=0,h=0,i=b.length;i>h;h++){var j=b[h];j.once(a,d)}},g.prototype.dispatchEvent=function(a,b,c){var d=b?[b].concat(c):c;if(this.emitEvent(a,d),i)if(this.$element=this.$element||i(this.element),b){var e=i.Event(b);e.type=a,this.$element.trigger(e,c)}else this.$element.trigger(a,c)},g.prototype.ignore=function(a){var b=this.getItem(a);b&&(b.isIgnored=!0)},g.prototype.unignore=function(a){var b=this.getItem(a);b&&delete b.isIgnored},g.prototype.stamp=function(a){if(a=this._find(a)){this.stamps=this.stamps.concat(a);for(var b=0,c=a.length;c>b;b++){var d=a[b];this.ignore(d)}}},g.prototype.unstamp=function(a){if(a=this._find(a))for(var b=0,c=a.length;c>b;b++){var d=a[b];e.removeFrom(this.stamps,d),this.unignore(d)}},g.prototype._find=function(a){return a?("string"==typeof a&&(a=this.element.querySelectorAll(a)),a=e.makeArray(a)):void 0},g.prototype._manageStamps=function(){if(this.stamps&&this.stamps.length){this._getBoundingRect();for(var a=0,b=this.stamps.length;b>a;a++){var c=this.stamps[a];this._manageStamp(c)}}},g.prototype._getBoundingRect=function(){var a=this.element.getBoundingClientRect(),b=this.size;this._boundingRect={left:a.left+b.paddingLeft+b.borderLeftWidth,top:a.top+b.paddingTop+b.borderTopWidth,right:a.right-(b.paddingRight+b.borderRightWidth),bottom:a.bottom-(b.paddingBottom+b.borderBottomWidth)}},g.prototype._manageStamp=j,g.prototype._getElementOffset=function(a){var b=a.getBoundingClientRect(),c=this._boundingRect,e=d(a),f={left:b.left-c.left-e.marginLeft,top:b.top-c.top-e.marginTop,right:c.right-b.right-e.marginRight,bottom:c.bottom-b.bottom-e.marginBottom};return f},g.prototype.handleEvent=function(a){var b="on"+a.type;this[b]&&this[b](a)},g.prototype.bindResize=function(){this.isResizeBound||(b.bind(a,"resize",this),this.isResizeBound=!0)},g.prototype.unbindResize=function(){this.isResizeBound&&b.unbind(a,"resize",this),this.isResizeBound=!1},g.prototype.onresize=function(){function a(){b.resize(),delete b.resizeTimeout}this.resizeTimeout&&clearTimeout(this.resizeTimeout);var b=this;this.resizeTimeout=setTimeout(a,100)},g.prototype.resize=function(){this.isResizeBound&&this.needsResizeLayout()&&this.layout()},g.prototype.needsResizeLayout=function(){var a=d(this.element),b=this.size&&a;return b&&a.innerWidth!==this.size.innerWidth},g.prototype.addItems=function(a){var b=this._itemize(a);return b.length&&(this.items=this.items.concat(b)),b},g.prototype.appended=function(a){var b=this.addItems(a);b.length&&(this.layoutItems(b,!0),this.reveal(b))},g.prototype.prepended=function(a){var b=this._itemize(a);if(b.length){var c=this.items.slice(0);this.items=b.concat(c),this._resetLayout(),this._manageStamps(),this.layoutItems(b,!0),this.reveal(b),this.layoutItems(c)}},g.prototype.reveal=function(a){this._emitCompleteOnItems("reveal",a);for(var b=a&&a.length,c=0;b&&b>c;c++){var d=a[c];d.reveal()}},g.prototype.hide=function(a){this._emitCompleteOnItems("hide",a);for(var b=a&&a.length,c=0;b&&b>c;c++){var d=a[c];d.hide()}},g.prototype.revealItemElements=function(a){var b=this.getItems(a);this.reveal(b)},g.prototype.hideItemElements=function(a){var b=this.getItems(a);this.hide(b)},g.prototype.getItem=function(a){for(var b=0,c=this.items.length;c>b;b++){var d=this.items[b];if(d.element===a)return d}},g.prototype.getItems=function(a){a=e.makeArray(a);for(var b=[],c=0,d=a.length;d>c;c++){var f=a[c],g=this.getItem(f);g&&b.push(g)}return b},g.prototype.remove=function(a){var b=this.getItems(a);if(this._emitCompleteOnItems("remove",b),b&&b.length)for(var c=0,d=b.length;d>c;c++){var f=b[c];f.remove(),e.removeFrom(this.items,f)}},g.prototype.destroy=function(){var a=this.element.style;a.height="",a.position="",a.width="";for(var b=0,c=this.items.length;c>b;b++){var d=this.items[b];d.destroy()}this.unbindResize();var e=this.element.outlayerGUID;delete l[e],delete this.element.outlayerGUID,i&&i.removeData(this.element,this.constructor.namespace)},g.data=function(a){a=e.getQueryElement(a);var b=a&&a.outlayerGUID;return b&&l[b]},g.create=function(a,b){function c(){g.apply(this,arguments)}return Object.create?c.prototype=Object.create(g.prototype):e.extend(c.prototype,g.prototype),c.prototype.constructor=c,c.defaults=e.extend({},g.defaults),e.extend(c.defaults,b),c.prototype.settings={},c.namespace=a,c.data=g.data,c.Item=function(){f.apply(this,arguments)},c.Item.prototype=new f,e.htmlInit(c,a),i&&i.bridget&&i.bridget(a,c),c},g.Item=f,g}),function(a,b){"function"==typeof define&&define.amd?define(["outlayer/outlayer","get-size/get-size","fizzy-ui-utils/utils"],b):"object"==typeof exports?module.exports=b(require("outlayer"),require("get-size"),require("fizzy-ui-utils")):a.Masonry=b(a.Outlayer,a.getSize,a.fizzyUIUtils)}(window,function(a,b,c){var d=a.create("masonry");return d.prototype._resetLayout=function(){this.getSize(),this._getMeasurement("columnWidth","outerWidth"),this._getMeasurement("gutter","outerWidth"),this.measureColumns();var a=this.cols;for(this.colYs=[];a--;)this.colYs.push(0);this.maxY=0},d.prototype.measureColumns=function(){if(this.getContainerWidth(),!this.columnWidth){var a=this.items[0],c=a&&a.element;this.columnWidth=c&&b(c).outerWidth||this.containerWidth}var d=this.columnWidth+=this.gutter,e=this.containerWidth+this.gutter,f=e/d,g=d-e%d,h=g&&1>g?"round":"floor";f=Math[h](f),this.cols=Math.max(f,1)},d.prototype.getContainerWidth=function(){var a=this.options.isFitWidth?this.element.parentNode:this.element,c=b(a);this.containerWidth=c&&c.innerWidth},d.prototype._getItemLayoutPosition=function(a){a.getSize();var b=a.size.outerWidth%this.columnWidth,d=b&&1>b?"round":"ceil",e=Math[d](a.size.outerWidth/this.columnWidth);e=Math.min(e,this.cols);for(var f=this._getColGroup(e),g=Math.min.apply(Math,f),h=c.indexOf(f,g),i={x:this.columnWidth*h,y:g},j=g+a.size.outerHeight,k=this.cols+1-f.length,l=0;k>l;l++)this.colYs[h+l]=j;return i},d.prototype._getColGroup=function(a){if(2>a)return this.colYs;for(var b=[],c=this.cols+1-a,d=0;c>d;d++){var e=this.colYs.slice(d,d+a);b[d]=Math.max.apply(Math,e)}return b},d.prototype._manageStamp=function(a){var c=b(a),d=this._getElementOffset(a),e=this.options.isOriginLeft?d.left:d.right,f=e+c.outerWidth,g=Math.floor(e/this.columnWidth);g=Math.max(0,g);var h=Math.floor(f/this.columnWidth);h-=f%this.columnWidth?0:1,h=Math.min(this.cols-1,h);for(var i=(this.options.isOriginTop?d.top:d.bottom)+c.outerHeight,j=g;h>=j;j++)this.colYs[j]=Math.max(i,this.colYs[j])},d.prototype._getContainerSize=function(){this.maxY=Math.max.apply(Math,this.colYs);var a={height:this.maxY};return this.options.isFitWidth&&(a.width=this._getContainerFitWidth()),a},d.prototype._getContainerFitWidth=function(){for(var a=0,b=this.cols;--b&&0===this.colYs[b];)a++;return(this.cols-a)*this.columnWidth-this.gutter},d.prototype.needsResizeLayout=function(){var a=this.containerWidth;return this.getContainerWidth(),a!==this.containerWidth},d});
(function() {


}).call(this);
(function() {


}).call(this);
(function() {
  var flag, index, post, scrollpos;

  scrollpos = 0;

  flag = 0;

  $(window).load(function() {
    twttr.widgets.load();
    if ($("#page-notice-toast").length > 0) {
      $('#page-notice-toast')[0].toggle();
    }
    if (document.location.pathname.split("/")[2] === "new" || document.location.pathname.split("/")[3] === "edit") {
      $($(".froala-box").children()[1]).attr("hidden", "");
      $("div.froala-wrapper.f-basic").removeAttr("hidden");
    }
    $('img.fr-fin').captionjs({
      'mode': 'stacked',
      'is_responsive': true
    });
    $('.grid').masonry({
      itemSelector: '.grid-item',
      gutter: 12
    });
    $('.new-comment').editable({
      theme: "dark",
      inlineMode: false,
      spellcheck: true,
      countCharacters: false,
      mediaManager: false,
      buttons: ['bold', 'italic', 'underline', 'strikeThrough', 'sep', 'color', 'formatBlock', 'insertOrderedList', 'insertUnorderedList', 'createLink', 'insertImage', 'sep', 'undo', 'redo'],
      blockTags: {
        n: "Normal",
        pre: "Code"
      },
      icons: {
        bold: {
          type: 'font',
          value: 'mdi mdi-format-bold'
        },
        italic: {
          type: 'font',
          value: 'mdi mdi-format-italic'
        },
        underline: {
          type: 'font',
          value: 'mdi mdi-format-underline'
        },
        strikeThrough: {
          type: 'font',
          value: 'mdi mdi-format-strikethrough'
        },
        color: {
          type: 'font',
          value: 'mdi mdi-format-paint'
        },
        formatBlock: {
          type: 'font',
          value: 'mdi mdi-format-paragraph'
        },
        insertOrderedList: {
          type: 'font',
          value: 'mdi mdi-format-list-numbers'
        },
        insertUnorderedList: {
          type: 'font',
          value: 'mdi mdi-format-list-bulleted'
        },
        createLink: {
          type: 'font',
          value: 'mdi mdi-link'
        },
        insertImage: {
          type: 'font',
          value: 'mdi mdi-file-image-box'
        },
        undo: {
          type: 'font',
          value: 'mdi mdi-undo'
        },
        redo: {
          type: 'font',
          value: 'mdi mdi-redo'
        }
      }
    });
    $(".froala-box").each(function() {
      return $($(this).children()[2]).attr("hidden", "");
    });
    if (document.location.pathname === "/" || document.location.pathname === "/posts") {
      page('/', index);
      page('/posts', function() {
        return page.redirect('/');
      });
      page('/:id', post);
      page({
        hashbang: true
      });
    }
    setTimeout((function() {
      if ($('home-toolbar').length > 0) {
        $('.grid').masonry({
          itemSelector: '.grid-item',
          gutter: 12
        });
        $('home-toolbar')[0].show();
        $("animated-grid")[0].show();
        $('about-section')[0].show();
        flag = 1;
      }
    }), 1000);
  });

  index = function() {
    $('#new-post-fab').fadeIn();
    $("#about").fadeIn();
    if (flag === 1) {
      $('home-toolbar')[0].show();
      $('about-section')[0].show();
    }
    $("#posts_pagination").fadeIn();
    if ($('neon-animated-pages')[1]) {
      $('neon-animated-pages')[1].selected = 0;
    }
    window.scrollTo(0, scrollpos);
    document.title = 'While True';
    $("body")[0].style.overflowY = "";
    $('.grid').masonry({
      itemSelector: '.grid-item',
      gutter: 12
    });
  };

  post = function(id) {
    var fullPage, selected;
    $("body")[0].style.overflowY = "hidden";
    scrollpos = document.body.scrollTop;
    $('home-toolbar')[0].dontshow();
    $('about-section')[0].dontshow();
    $("#new-post-fab").fadeOut();
    $("#about").fadeOut();
    fullPage = $("neon-animated-pages").find("#" + id.params.id)[0];
    selected = $("show-post").index(fullPage);
    document.title = fullPage.childNodes[3].childNodes[3].childNodes[1].childNodes[4].childNodes[1].childNodes[1].textContent;
    $('neon-animated-pages')[1].selected = selected + 1;
    $("animated-grid")[0].showPost(id.params.id);
  };

  jQuery(function() {
    $(window).resize(function() {
      $('.grid').masonry({
        itemSelector: '.grid-item',
        gutter: 12
      });
    });
    $('#new-post-fab').click(function() {
      document.location = '/posts/new';
    });
    $('body').on('click', '#usernames', function() {
      $('#overlay2')[0].toggle();
    });
    $('body').on('click', "#show_post_edit", function() {
      document.location = document.location.pathname + '/edit';
    });
    $("#home_page_back").on('click', function() {
      document.location = '/';
    });
    $('body').on('click', "#show_post_delete", function() {
      $(this).parent().find('a').click();
    });
    $('body').on('click', "#home_post_edit", function() {
      document.location = '/posts/' + $(this)[0].getAttribute("slug") + '/edit';
    });
    $('body').on('click', "#home_post_delete", function() {
      $(this).parent().find('a').click();
    });
    $('body').on('click', ".gshare-button", function() {
      window.open($(this).find('div').attr('href'), '_blank', 'height=500,width=550');
    });
    $('body').on('click', ".fshare-button", function() {
      window.open($(this).find('div').attr('href'), '_blank', 'height=500,width=550');
    });
    $("#about_facebook").click(function() {
      document.location = 'https://www.facebook.com/pages/While-True/546036762189676';
    });
    $('body').on('click', '#signup_button', function() {
      $("#paperTabs")[0].selected = 1;
      $("#baluga")[0].selected = 1;
      $("#new_session_overlay")[0].toggle();
      $("#baluga").attr('entry-animation', 'slide-from-left-animation');
      $("#baluga").attr('exit-animation', 'slide-right-animation');
    });
    $('body').on('click', '#login_button', function() {
      $("#paperTabs")[0].selected = 0;
      $("#baluga")[0].selected = 0;
      $("#new_session_overlay")[0].toggle();
      $("#baluga").attr('entry-animation', 'slide-from-right-animation');
      $("#baluga").attr('exit-animation', 'slide-left-animation');
    });
    $('body').on('click', '.next', function() {
      page.stop();
      $(this).find("a").click();
    });
    $('body').on('click', '.prev', function() {
      page.stop();
      $(this).find("a").click();
    });
    $('#about_twitter').click(function() {
      document.location = 'https://twitter.com/while_true0';
    });
    $('#about_gp').click(function() {
      document.location = 'https://plus.google.com/107587555244815719248';
    });
    if (document.location.pathname === "/" || document.location.pathname === "/posts") {
      $('template[is="dom-bind"]')[0]._onTileClick = function(event) {
        var selectedPost;
        selectedPost = event.detail.tile.parentNode.parentNode.postid;
        page('/' + selectedPost);
      };
      return $('template[is="dom-bind"]')[0]._onFullsizeClick = function(event) {
        page("/");
      };
    }
  });

}).call(this);
(function() {
  jQuery(function() {
    $("#forgot_password").click(function() {
      $("#forgot-dialog")[0].toggle();
    });
    $("#one").click(function(e) {
      if ($("#paperTabs")[0].selected !== "0") {
        $("#baluga")[0].selected = 0;
        $("#baluga").attr('entry-animation', 'slide-from-right-animation');
        $("#baluga").attr('exit-animation', 'slide-left-animation');
      }
    });
    return $("#two").click(function(e) {
      $("#baluga")[0].selected = 1;
      $("#baluga").attr('entry-animation', 'slide-from-left-animation');
      $("#baluga").attr('exit-animation', 'slide-right-animation');
    });
  });

}).call(this);
(function() {
  jQuery(function() {
    $("#cancel-form").click(function() {
      window.history.back();
    });
    $(".back-button").click(function() {
      document.location.href = '/';
    });
    $('#avatar_upload_link').click(function() {
      $("#avatar_upload_field").click();
    });
    $('#avatar_upload_field').change(function() {
      $('.edit_user').submit();
    });
    $('#usernames').click(function() {
      $('#overlay2').toggle();
    });
    $('#paper_admin_toggle').change(function() {
      if ($('#invisible_admin_toggle').is(':checked')) {
        return $('#invisible_admin_toggle').prop('checked', false);
      } else {
        return $('#invisible_admin_toggle').prop('checked', true);
      }
    });
    $("#user_back_button").click(function() {
      return document.location = '/users';
    });
    $("body").on("click", "#manage_button_1", function() {
      document.location = '/users';
    });
    $("body").on("click", "#edit_user_button", function() {
      document.location = 'users/' + $("#edit_user_button")[0].classList[0] + '/edit';
    });
    $('body').on({
      mouseenter: function() {
        $("#avatar-overaly-text").fadeIn();
      },
      mouseleave: function() {
        $("#avatar-overaly-text").fadeOut();
      }
    }, '#profile-avatar');
    $(".edit_user_link").on("click", function() {
      document.location = 'users/' + $(this)[0].classList[0] + '/edit';
    });
    $(".users-admin-toggle").on("change", function() {
      $(this).parent().find('.toggle_user_admin').prop('checked', !$(this).parent().find('.toggle_user_admin').prop('checked'));
      $(this).parent().submit();
    });
    return $(".delete-user-button").on("click", function() {
      $(this).parent().find("a").click();
    });
  });

}).call(this);
/*!
 * froala_editor v1.2.8 (https://www.froala.com/wysiwyg-editor)
 * License https://www.froala.com/wysiwyg-editor/terms
 * Copyright 2014-2015 Froala Labs
 */

if("undefined"==typeof jQuery)throw new Error("Froala requires jQuery");!function(a){"use strict";var b=function(c,d){return this.options=a.extend({},b.DEFAULTS,a(c).data(),"object"==typeof d&&d),this.options.unsupportedAgents.test(navigator.userAgent)?!1:(this.valid_nodes=a.merge([],b.VALID_NODES),this.valid_nodes=a.merge(this.valid_nodes,a.map(Object.keys(this.options.blockTags),function(a){return a.toUpperCase()})),this.browser=b.browser(),this.disabledList=[],this._id=++b.count,this._events={},this.blurred=!0,this.$original_element=a(c),this.document=c.ownerDocument,this.window="defaultView"in this.document?this.document.defaultView:this.document.parentWindow,this.$document=a(this.document),this.$window=a(this.window),this.br=this.browser.msie&&a.Editable.getIEversion()<=10?"":"<br/>",this.init(c),void a(c).on("editable.focus",a.proxy(function(){for(var b=1;b<=a.Editable.count;b++)b!=this._id&&this.$window.trigger("blur."+b)},this)))};b.initializers=[],b.count=0,b.VALID_NODES=["P","DIV","LI","TD","TH"],b.LANGS=[],b.INVISIBLE_SPACE="&#x200b;",b.DEFAULTS={allowComments:!0,allowScript:!1,allowStyle:!1,allowedAttrs:["accept","accept-charset","accesskey","action","align","alt","async","autocomplete","autofocus","autoplay","autosave","background","bgcolor","border","charset","cellpadding","cellspacing","checked","cite","class","color","cols","colspan","content","contenteditable","contextmenu","controls","coords","data","data-.*","datetime","default","defer","dir","dirname","disabled","download","draggable","dropzone","enctype","for","form","formaction","headers","height","hidden","high","href","hreflang","http-equiv","icon","id","ismap","itemprop","keytype","kind","label","lang","language","list","loop","low","max","maxlength","media","method","min","multiple","name","novalidate","open","optimum","pattern","ping","placeholder","poster","preload","pubdate","radiogroup","readonly","rel","required","reversed","rows","rowspan","sandbox","scope","scoped","scrolling","seamless","selected","shape","size","sizes","span","src","srcdoc","srclang","srcset","start","step","summary","spellcheck","style","tabindex","target","title","type","translate","usemap","value","valign","width","wrap"],allowedTags:["a","abbr","address","area","article","aside","audio","b","base","bdi","bdo","blockquote","br","button","canvas","caption","cite","code","col","colgroup","datalist","dd","del","details","dfn","dialog","div","dl","dt","em","embed","fieldset","figcaption","figure","footer","form","h1","h2","h3","h4","h5","h6","header","hgroup","hr","i","iframe","img","input","ins","kbd","keygen","label","legend","li","link","main","map","mark","menu","menuitem","meter","nav","noscript","object","ol","optgroup","option","output","p","param","pre","progress","queue","rp","rt","ruby","s","samp","script","section","select","small","source","span","strike","strong","sub","summary","sup","table","tbody","td","textarea","tfoot","th","thead","time","title","tr","track","u","ul","var","video","wbr"],alwaysBlank:!1,alwaysVisible:!1,autosave:!1,autosaveInterval:1e4,beautifyCode:!0,blockTags:{n:"Normal",blockquote:"Quote",pre:"Code",h1:"Heading 1",h2:"Heading 2",h3:"Heading 3",h4:"Heading 4",h5:"Heading 5",h6:"Heading 6"},buttons:["bold","italic","underline","strikeThrough","fontSize","fontFamily","color","sep","formatBlock","blockStyle","align","insertOrderedList","insertUnorderedList","outdent","indent","sep","createLink","insertImage","insertVideo","insertHorizontalRule","undo","redo","html"],crossDomain:!0,convertMailAddresses:!0,customButtons:{},customDropdowns:{},customText:!1,defaultTag:"P",direction:"ltr",disableRightClick:!1,editInPopup:!1,editorClass:"",formatTags:["p","pre","blockquote","h1","h2","h3","h4","h5","h6","div","ul","ol","li","table","tbody","thead","tfoot","tr","th","td","body","head","html","title","meta","link","base","script","style"],headers:{},height:"auto",icons:{},inlineMode:!0,initOnClick:!1,fullPage:!1,language:"en_us",linkList:[],linkText:!1,linkClasses:{},linkAttributes:{},linkAutoPrefix:"",maxHeight:"auto",minHeight:"auto",multiLine:!0,noFollow:!0,paragraphy:!0,placeholder:"Type something",plainPaste:!1,preloaderSrc:"",saveURL:null,saveParam:"body",saveParams:{},saveRequestType:"POST",scrollableContainer:"body",simpleAmpersand:!1,shortcuts:!0,shortcutsAvailable:["show","bold","italic","underline","createLink","insertImage","indent","outdent","html","formatBlock n","formatBlock h1","formatBlock h2","formatBlock h3","formatBlock h4","formatBlock h5","formatBlock h6","formatBlock blockquote","formatBlock pre","strikeThrough"],showNextToCursor:!1,spellcheck:!1,theme:null,toolbarFixed:!0,trackScroll:!1,unlinkButton:!0,useClasses:!0,tabSpaces:!0,typingTimer:500,pastedImagesUploadRequestType:"POST",pastedImagesUploadURL:"http://i.froala.com/upload_base64",unsupportedAgents:/Opera Mini/i,useFrTag:!1,width:"auto",withCredentials:!1,zIndex:2e3},b.prototype.destroy=function(){this.sync(),this.options.useFrTag&&this.addFrTag(),this.hide(),this.isHTML&&this.html(),this.$bttn_wrapper&&this.$bttn_wrapper.html("").removeData().remove(),this.$editor&&this.$editor.html("").removeData().remove(),this.raiseEvent("destroy"),this.$popup_editor&&this.$popup_editor.html("").removeData().remove(),this.$placeholder&&this.$placeholder.html("").removeData().remove(),clearTimeout(this.ajaxInterval),clearTimeout(this.typingTimer),this.$element.off("mousedown mouseup click keydown keyup cut copy paste focus keypress touchstart touchend touch drop"),this.$element.off("mousedown mouseup click keydown keyup cut copy paste focus keypress touchstart touchend touch drop","**"),this.$window.off("mouseup."+this._id),this.$window.off("keydown."+this._id),this.$window.off("keyup."+this._id),this.$window.off("blur."+this._id),this.$window.off("hide."+this._id),this.$window.off("scroll."+this._id),this.$window.off("resize."+this._id),this.$window.off("orientationchange."+this._id),this.$document.off("selectionchange."+this._id),this.$original_element.off("editable"),void 0!==this.$upload_frame&&this.$upload_frame.remove(),this.$textarea&&(this.$box.remove(),this.$textarea.removeData("fa.editable"),this.$textarea.show());for(var a in this._events)delete this._events[a];this.$placeholder&&this.$placeholder.remove(),this.isLink?this.$element.removeData("fa.editable"):(this.$wrapper?this.$wrapper.replaceWith(this.getHTML(!1,!1)):this.$element.replaceWith(this.getHTML(!1,!1)),this.$box&&!this.editableDisabled&&(this.$box.removeClass("froala-box f-rtl"),this.$box.find(".html-switch").remove(),this.$box.removeData("fa.editable"),clearTimeout(this.typingTimer))),this.$lb&&this.$lb.remove()},b.prototype.triggerEvent=function(b,c,d,e){void 0===d&&(d=!0),void 0===e&&(e=!1),d===!0&&(this.isResizing()||this.editableDisabled||this.imageMode||!e||this.cleanify(),this.sync());var f=!0;return c||(c=[]),f=this.$original_element.triggerHandler("editable."+b,a.merge([this],c)),void 0===f?!0:f},b.prototype.syncStyle=function(){if(this.options.fullPage){var a=this.$element.html().match(/\[style[^\]]*\].*\[\/style\]/gi);if(this.$document.find("head style[data-id]").remove(),a)for(var b=0;b<a.length;b++)this.$document.find("head").append(a[b].replace(/\[/gi,"<").replace(/\]/gi,">"))}},b.prototype.sync=function(){if(!this.isHTML){this.raiseEvent("sync"),this.disableImageResize(),this.isLink||this.isImage||this.checkPlaceholder();var a=this.getHTML();this.trackHTML!==a&&null!=this.trackHTML?(this.refreshImageList(),this.refreshButtons(),this.trackHTML=a,this.$textarea&&this.$textarea.val(a),this.doingRedo||this.saveUndoStep(),this.triggerEvent("contentChanged",[],!1)):null==this.trackHTML&&(this.trackHTML=a),this.syncStyle()}},b.prototype.emptyElement=function(b){if("IMG"==b.tagName||a(b).find("img").length>0)return!1;if(a(b).find("input, iframe, object").length>0)return!1;for(var c=a(b).text(),d=0;d<c.length;d++)if("\n"!==c[d]&&"\r"!==c[d]&&"	"!==c[d]&&8203!=c[d].charCodeAt(0))return!1;return!0},b.prototype.initEvents=function(){this.mobile()?(this.mousedown="touchstart",this.mouseup="touchend",this.move="touchmove"):(this.mousedown="mousedown",this.mouseup="mouseup",this.move="")},b.prototype.initDisable=function(){this.$element.on("keypress keydown keyup",a.proxy(function(a){return this.isDisabled?(a.stopPropagation(),a.preventDefault(),!1):void 0},this))},b.prototype.continueInit=function(){this.initDisable(),this.initEvents(),this.browserFixes(),this.handleEnter(),this.editableDisabled||(this.initUndoRedo(),this.enableTyping(),this.initShortcuts()),this.initTabs(),this.initEditor();for(var b=0;b<a.Editable.initializers.length;b++)a.Editable.initializers[b].call(this);this.initOptions(),this.initEditorSelection(),this.initAjaxSaver(),this.setLanguage(),this.setCustomText(),this.editableDisabled||this.registerPaste(),this.refreshDisabledState(),this.refreshUndo(),this.refreshRedo(),this.initPopupSubmit(),this.initialized=!0,this.triggerEvent("initialized",[],!1,!1)},b.prototype.initPopupSubmit=function(){this.$popup_editor.find(".froala-popup input").keydown(function(b){var c=b.which;13==c&&(b.preventDefault(),b.stopPropagation(),a(this).blur(),a(this).parents(".froala-popup").find("button.f-submit").click())})},b.prototype.lateInit=function(){this.saveSelectionByMarkers(),this.continueInit(),this.restoreSelectionByMarkers(),this.$element.focus(),this.hideOtherEditors()},b.prototype.init=function(b){this.options.paragraphy||(this.options.defaultTag="DIV"),this.options.allowStyle&&this.setAllowStyle(),this.options.allowScript&&this.setAllowScript(),this.initElement(b),this.initElementStyle(),(!this.isLink||this.isImage)&&(this.initImageEvents(),this.buildImageMove()),this.options.initOnClick?(this.editableDisabled||(this.$element.attr("contenteditable",!0),this.$element.attr("spellcheck",!1)),this.$element.bind("mousedown.element focus.element",a.proxy(function(a){return this.isLink||a.stopPropagation(),this.isDisabled?!1:(this.$element.unbind("mousedown.element focus.element"),this.browser.webkit&&(this.initMouseUp=!1),void this.lateInit())},this))):this.continueInit()},b.prototype.phone=function(){var a=!1;return function(b){(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(b)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(b.substr(0,4)))&&(a=!0)}(navigator.userAgent||navigator.vendor||window.opera),a},b.prototype.mobile=function(){return this.phone()||this.android()||this.iOS()||this.blackberry()},b.prototype.iOS=function(){return/(iPad|iPhone|iPod)/g.test(navigator.userAgent)},b.prototype.iOSVersion=function(){if(/iP(hone|od|ad)/.test(navigator.platform)){var a=navigator.appVersion.match(/OS (\d+)_(\d+)_?(\d+)?/),b=[parseInt(a[1],10),parseInt(a[2],10),parseInt(a[3]||0,10)];if(b&&b[0])return b[0]}return 0},b.prototype.iPad=function(){return/(iPad)/g.test(navigator.userAgent)},b.prototype.iPhone=function(){return/(iPhone)/g.test(navigator.userAgent)},b.prototype.iPod=function(){return/(iPod)/g.test(navigator.userAgent)},b.prototype.android=function(){return/(Android)/g.test(navigator.userAgent)},b.prototype.blackberry=function(){return/(Blackberry)/g.test(navigator.userAgent)},b.prototype.initOnTextarea=function(b){this.$textarea=a(b),void 0!==this.$textarea.attr("placeholder")&&"Type something"==this.options.placeholder&&(this.options.placeholder=this.$textarea.attr("placeholder")),this.$element=a("<div>").html(this.clean(this.$textarea.val(),!0,!1)),this.$element.find("pre br").replaceWith("\n"),this.$textarea.before(this.$element).hide(),this.$textarea.parents("form").bind("submit",a.proxy(function(){this.isHTML?this.html():this.sync()},this)),this.addListener("destroy",a.proxy(function(){this.$textarea.parents("form").unbind("submit")},this))},b.prototype.initOnLink=function(b){this.isLink=!0,this.options.linkText=!0,this.selectionDisabled=!0,this.editableDisabled=!0,this.options.buttons=[],this.$element=a(b),this.options.paragraphy=!1,this.options.countCharacters=!1,this.$box=this.$element},b.prototype.initOnImage=function(b){var c=a(b).css("float");"A"==a(b).parent().get(0).tagName&&(b=a(b).parent()),this.isImage=!0,this.editableDisabled=!0,this.imageList=[],this.options.buttons=[],this.options.paragraphy=!1,this.options.imageMargin="auto",a(b).wrap("<div>"),this.$element=a(b).parent(),this.$element.css("display","inline-block"),this.$element.css("max-width","100%"),this.$element.css("margin-left","auto"),this.$element.css("margin-right","auto"),this.$element.css("float",c),this.$element.addClass("f-image"),this.$box=a(b)},b.prototype.initForPopup=function(b){this.$element=a(b),this.$box=this.$element,this.editableDisabled=!0,this.options.countCharacters=!1,this.options.buttons=[],this.$element.on("click",a.proxy(function(a){a.preventDefault()},this))},b.prototype.initOnDefault=function(b){"DIV"!=b.tagName&&this.options.buttons.indexOf("formatBlock")>=0&&this.disabledList.push("formatBlock"),this.$element=a(b)},b.prototype.initElement=function(b){if("TEXTAREA"==b.tagName?this.initOnTextarea(b):"A"==b.tagName?this.initOnLink(b):"IMG"==b.tagName?this.initOnImage(b):this.options.editInPopup?this.initForPopup(b):this.initOnDefault(b),!this.editableDisabled){this.$box=this.$element.addClass("froala-box"),this.$wrapper=a('<div class="froala-wrapper">'),this.$element=a("<div>");var c=this.$box.html();this.$box.html(this.$wrapper.html(this.$element)),this.$element.on("keyup",a.proxy(function(){this.$element.find("ul, ol").length>1&&this.cleanupLists()},this)),this.setHTML(c,!0)}this.$element.on("drop",a.proxy(function(){setTimeout(a.proxy(function(){a("html").click(),this.$element.find(".f-img-wrap").each(function(b,c){0===a(c).find("img").length&&a(c).remove()}),this.$element.find(this.options.defaultTag+":empty").remove()},this),1)},this))},b.prototype.trim=function(a){return a=String(a).replace(/^\s+|\s+$/g,""),a=a.replace(/\u200B/gi,"")},b.prototype.unwrapText=function(){this.options.paragraphy||this.$element.find(this.options.defaultTag).each(a.proxy(function(b,c){if(0===c.attributes.length){var d=a(c).find("br:last");a(c).replaceWith(d.length&&this.isLastSibling(d.get(0))?a(c).html():a(c).html()+"<br/>")}},this))},b.prototype.wrapTextInElement=function(b,c){void 0===c&&(c=!1);var d=[],e=["SPAN","A","B","I","EM","U","S","STRONG","STRIKE","FONT","IMG","SUB","SUP","BUTTON","INPUT"],f=this;this.no_verify=!0;var g=function(){if(0===d.length)return!1;var b=a("<"+f.options.defaultTag+">"),c=a(d[0]);if(1==d.length&&"f-marker"==c.attr("class"))return void(d=[]);for(var e=0;e<d.length;e++){var g=a(d[e]);b.append(g.clone()),e==d.length-1?g.replaceWith(b):g.remove()}d=[]},h=!1,i=!1,j=!1;b.contents().filter(function(){var b=a(this);if(b.hasClass("f-marker")||b.find(".f-marker").length){var k=b;if(1==b.find(".f-marker").length||b.hasClass("f-marker")){k=b.find(".f-marker").length?a(b.find(".f-marker")[0]):b;var l=k.prev();"true"===k.attr("data-type")?l.length&&a(l[0]).hasClass("f-marker")?j=!0:(h=!0,i=!1):i=!0}else j=!0}this.nodeType==Node.TEXT_NODE&&b.text().length>0||e.indexOf(this.tagName)>=0?d.push(this):this.nodeType==Node.TEXT_NODE&&0===b.text().length&&f.options.beautifyCode?b.remove():h||c||j?("BR"===this.tagName&&(d.length>0?b.remove():d.push(this)),g(),i&&(h=!1),j=!1):d=[]}),(h||c||j)&&g(),b.find("> "+this.options.defaultTag).each(function(b,c){0===a(c).text().trim().length&&0===a(c).find("img").length&&0===a(c).find("br").length&&a(c).append(this.br)}),b.find("div:empty:not([class])").remove(),b.is(":empty")&&b.append(f.options.paragraphy===!0?"<"+this.options.defaultTag+">"+this.br+"</"+this.options.defaultTag+">":this.br),this.no_verify=!1},b.prototype.wrapText=function(b){if(this.isImage||this.isLink)return!1;this.allow_div=!0,this.removeBlankSpans();for(var c=this.getSelectionElements(),d=0;d<c.length;d++){var e=a(c[d]);["LI","TH","TD"].indexOf(e.get(0).tagName)>=0?this.wrapTextInElement(e,!0):this.parents(e,"li").length?this.wrapTextInElement(a(this.parents(e,"li")[0]),b):this.wrapTextInElement(this.$element,b)}this.allow_div=!1},b.prototype.convertNewLines=function(){this.$element.find("pre").each(function(b,c){var d=a(c),e=a(c).html();e.indexOf("\n")>=0&&d.html(e.replace(/\n/g,"<br>"))})},b.prototype.setHTML=function(b,c){this.no_verify=!0,this.allow_div=!0,void 0===c&&(c=!0),b=this.clean(b,!0,!1),b=b.replace(/>\s+</g,"><"),this.$element.html(b),this.cleanAttrs(this.$element.get(0)),this.convertNewLines(),this.imageList=[],this.refreshImageList(),this.options.paragraphy&&this.wrapText(!0),this.$element.find("li:empty").append(a.Editable.INVISIBLE_SPACE),this.cleanupLists(),this.cleanify(!1,!0,!1),c&&(this.restoreSelectionByMarkers(),this.sync()),this.$element.find("span").attr("data-fr-verified",!0),this.initialized&&(this.hide(),this.closeImageMode(),this.imageMode=!1),this.no_verify=!1,this.allow_div=!1},b.prototype.beforePaste=function(){this.saveSelectionByMarkers(),this.clipboardHTML=null,this.scrollPosition=this.$window.scrollTop(),this.$pasteDiv?this.$pasteDiv.html(""):(this.$pasteDiv=a('<div contenteditable="true" style="position: fixed; top: 0; left: -9999px; height: 100%; width: 0; z-index: 4000; line-height: 140%;" tabindex="-1"></div>'),this.$box.after(this.$pasteDiv)),this.$pasteDiv.focus(),this.window.setTimeout(a.proxy(this.processPaste,this),1)},b.prototype.processPaste=function(){var c=this.clipboardHTML;null===this.clipboardHTML&&(c=this.$pasteDiv.html(),this.restoreSelectionByMarkers(),this.$window.scrollTop(this.scrollPosition));var d,e=this.triggerEvent("onPaste",[c],!1);"string"==typeof e&&(c=e),c=c.replace(/<img /gi,'<img data-fr-image-pasted="true" '),c.match(/(class=\"?Mso|style=\"[^\"]*\bmso\-|w:WordDocument)/gi)?(d=this.wordClean(c),d=this.clean(a("<div>").append(d).html(),!1,!0),d=this.removeEmptyTags(d)):(d=this.clean(c,!1,!0),d=this.removeEmptyTags(d),b.copiedText&&a("<div>").html(d).text().replace(/\u00A0/gi," ")==b.copiedText.replace(/(\u00A0|\r|\n)/gi," ")&&(d=b.copiedHTML)),this.options.plainPaste&&(d=this.plainPasteClean(d)),e=this.triggerEvent("afterPasteCleanup",[d],!1),"string"==typeof e&&(d=e),""!==d&&(this.insertHTML(d,!0,!0),this.saveSelectionByMarkers(),this.removeBlankSpans(),this.$element.find(this.valid_nodes.join(":empty, ")+":empty").remove(),this.restoreSelectionByMarkers(),this.$element.find("li[data-indent]").each(a.proxy(function(b,c){this.indentLi?(a(c).removeAttr("data-indent"),this.indentLi(a(c))):a(c).removeAttr("data-indent")},this)),this.$element.find("li").each(a.proxy(function(b,c){this.wrapTextInElement(a(c),!0)},this)),this.options.paragraphy&&this.wrapText(!0),this.cleanupLists()),this.afterPaste()},b.prototype.afterPaste=function(){this.uploadPastedImages(),this.checkPlaceholder(),this.pasting=!1,this.triggerEvent("afterPaste",[],!0,!1)},b.prototype.getSelectedHTML=function(){function b(b,d){for(;3==d.nodeType||c.valid_nodes.indexOf(d.tagName)<0;)3!=d.nodeType&&a(b).wrapInner("<"+d.tagName+c.attrs(d)+"></"+d.tagName+">"),d=d.parentNode}var c=this,d="";if("undefined"!=typeof window.getSelection)for(var e=this.getRanges(),f=0;f<e.length;f++){var g=document.createElement("div");g.appendChild(e[f].cloneContents()),b(g,this.getSelectionParent()),d+=g.innerHTML}else"undefined"!=typeof document.selection&&"Text"==document.selection.type&&(d=document.selection.createRange().htmlText);return d},b.prototype.registerPaste=function(){this.$element.on("copy cut",a.proxy(function(){this.isHTML||(b.copiedHTML=this.getSelectedHTML(),b.copiedText=a("<div>").html(b.copiedHTML).text())},this)),this.$element.on("paste",a.proxy(function(b){if(!this.isHTML){if(b.originalEvent&&(b=b.originalEvent),!this.triggerEvent("beforePaste",[],!1))return!1;if(this.clipboardPaste(b))return!1;this.clipboardHTML="",this.pasting=!0,this.scrollPosition=this.$window.scrollTop();var c=!1;if(b&&b.clipboardData&&b.clipboardData.getData){var d="",e=b.clipboardData.types;if(a.Editable.isArray(e))for(var f=0;f<e.length;f++)d+=e[f]+";";else d=e;if(/text\/html/.test(d)?this.clipboardHTML=b.clipboardData.getData("text/html"):/text\/rtf/.test(d)&&this.browser.safari?this.clipboardHTML=b.clipboardData.getData("text/rtf"):/text\/plain/.test(d)&&!this.browser.mozilla&&(this.clipboardHTML=this.escapeEntities(b.clipboardData.getData("text/plain")).replace(/\n/g,"<br/>")),""!==this.clipboardHTML?c=!0:this.clipboardHTML=null,c)return this.processPaste(),b.preventDefault&&(b.stopPropagation(),b.preventDefault()),!1}this.beforePaste()}},this))},b.prototype.clipboardPaste=function(b){if(b&&b.clipboardData&&b.clipboardData.items&&b.clipboardData.items[0]){var c=b.clipboardData.items[0].getAsFile();if(c){var d=new FileReader;return d.onload=a.proxy(function(a){var b=a.target.result;this.insertHTML('<img data-fr-image-pasted="true" src="'+b+'" />'),this.afterPaste()},this),d.readAsDataURL(c),!0}}return!1},b.prototype.uploadPastedImages=function(){this.options.pasteImage?this.options.imageUpload&&this.$element.find("img[data-fr-image-pasted]").each(a.proxy(function(b,c){if(0===c.src.indexOf("data:")){if(this.options.defaultImageWidth&&a(c).attr("width",this.options.defaultImageWidth),this.options.pastedImagesUploadURL){if(!this.triggerEvent("beforeUploadPastedImage",[c],!1))return!1;setTimeout(a.proxy(function(){this.showImageLoader(),this.$progress_bar.find("span").css("width","100%").text("Please wait!"),this.showByCoordinates(a(c).offset().left+a(c).width()/2,a(c).offset().top+a(c).height()+10),this.isDisabled=!0},this),10),a.ajax({type:this.options.pastedImagesUploadRequestType,url:this.options.pastedImagesUploadURL,data:a.extend({image:decodeURIComponent(c.src)},this.options.imageUploadParams),crossDomain:this.options.crossDomain,xhrFields:{withCredentials:this.options.withCredentials},headers:this.options.headers,dataType:"json"}).done(a.proxy(function(b){try{if(b.link){var d=new Image;d.onerror=a.proxy(function(){a(c).remove(),this.hide(),this.throwImageError(1)},this),d.onload=a.proxy(function(){c.src=b.link,this.hideImageLoader(),this.hide(),this.enable(),setTimeout(function(){a(c).trigger("touchend")},50),this.triggerEvent("afterUploadPastedImage",[a(c)])},this),d.src=b.link}else b.error?(a(c).remove(),this.hide(),this.throwImageErrorWithMessage(b.error)):(a(c).remove(),this.hide(),this.throwImageError(2))}catch(e){a(c).remove(),this.hide(),this.throwImageError(4)}},this)).fail(a.proxy(function(){a(c).remove(),this.hide(),this.throwImageError(3)},this))}}else 0!==c.src.indexOf("http")&&a(c).remove();a(c).removeAttr("data-fr-image-pasted")},this)):this.$element.find("img[data-fr-image-pasted]").remove()},b.prototype.disable=function(){this.isDisabled=!0,this.$element.blur(),this.$box.addClass("fr-disabled"),this.$element.attr("contenteditable",!1)},b.prototype.enable=function(){this.isDisabled=!1,this.$box.removeClass("fr-disabled"),this.$element.attr("contenteditable",!0)},b.prototype.wordClean=function(a){a.indexOf("<body")>=0&&(a=a.replace(/[.\s\S\w\W<>]*<body[^>]*>([.\s\S\w\W<>]*)<\/body>[.\s\S\w\W<>]*/g,"$1")),a=a.replace(/<p(.*?)class="?'?MsoListParagraph"?'? ([\s\S]*?)>([\s\S]*?)<\/p>/gi,"<ul><li>$3</li></ul>"),a=a.replace(/<p(.*?)class="?'?NumberedText"?'? ([\s\S]*?)>([\s\S]*?)<\/p>/gi,"<ol><li>$3</li></ol>"),a=a.replace(/<p(.*?)class="?'?MsoListParagraphCxSpFirst"?'?([\s\S]*?)(level\d)?([\s\S]*?)>([\s\S]*?)<\/p>/gi,"<ul><li$3>$5</li>"),a=a.replace(/<p(.*?)class="?'?NumberedTextCxSpFirst"?'?([\s\S]*?)(level\d)?([\s\S]*?)>([\s\S]*?)<\/p>/gi,"<ol><li$3>$5</li>"),a=a.replace(/<p(.*?)class="?'?MsoListParagraphCxSpMiddle"?'?([\s\S]*?)(level\d)?([\s\S]*?)>([\s\S]*?)<\/p>/gi,"<li$3>$5</li>"),a=a.replace(/<p(.*?)class="?'?NumberedTextCxSpMiddle"?'?([\s\S]*?)(level\d)?([\s\S]*?)>([\s\S]*?)<\/p>/gi,"<li$3>$5</li>"),a=a.replace(/<p(.*?)class="?'?MsoListParagraphCxSpLast"?'?([\s\S]*?)(level\d)?([\s\S]*?)>([\s\S]*?)<\/p>/gi,"<li$3>$5</li></ul>"),a=a.replace(/<p(.*?)class="?'?NumberedTextCxSpLast"?'?([\s\S]*?)(level\d)?([\s\S]*?)>([\s\S]*?)<\/p>/gi,"<li$3>$5</li></ol>"),a=a.replace(/<span([^<]*?)style="?'?mso-list:Ignore"?'?([\s\S]*?)>([\s\S]*?)<span/gi,"<span><span"),a=a.replace(/<!--\[if \!supportLists\]-->([\s\S]*?)<!--\[endif\]-->/gi,""),a=a.replace(/<!\[if \!supportLists\]>([\s\S]*?)<!\[endif\]>/gi,""),a=a.replace(/(\n|\r| class=(")?Mso[a-zA-Z0-9]+(")?)/gi," "),a=a.replace(/<!--[\s\S]*?-->/gi,""),a=a.replace(/<(\/)*(meta|link|span|\\?xml:|st1:|o:|font)(.*?)>/gi,"");for(var b=["style","script","applet","embed","noframes","noscript"],c=0;c<b.length;c++){var d=new RegExp("<"+b[c]+".*?"+b[c]+"(.*?)>","gi");a=a.replace(d,"")}a=a.replace(/&nbsp;/gi," ");var e;do e=a,a=a.replace(/<[^\/>][^>]*><\/[^>]+>/gi,"");while(a!=e);return a=a.replace(/<lilevel([^1])([^>]*)>/gi,'<li data-indent="true"$2>'),a=a.replace(/<lilevel1([^>]*)>/gi,"<li$1>"),a=this.clean(a),a=a.replace(/<a>(.[^<]+)<\/a>/gi,"$1")},b.prototype.tabs=function(a){for(var b="",c=0;a>c;c++)b+="  ";return b},b.prototype.cleanTags=function(a,b){void 0===b&&(b=!1);var c,d,e,f,g=[],h=[],i=!1,j=!1,k=this.options.formatTags;for(d=0;d<a.length;d++)if(c=a.charAt(d),"<"==c){var l=a.indexOf(">",d+1);if(-1!==l){var m=a.substring(d,l+1),n=this.tagName(m);if(0===n.indexOf("!--")&&(l=a.indexOf("-->",d+1),-1!==l)){m=a.substring(d,l+3),h.push(m),d=l+2;continue}if(0===n.indexOf("!")&&h.length&&h[h.length-1]!=m){h.push(m),d=l;continue}if("head"==n&&this.options.fullPage&&(j=!0),j){h.push(m),d=l,"head"==n&&this.isClosingTag(m)&&(j=!1);continue}if(this.options.allowedTags.indexOf(n)<0&&(!this.options.fullPage||["html","head","body","!doctype"].indexOf(n)<0)){d=l;continue}var o=this.isClosingTag(m);if("pre"===n&&(i=o?!1:!0),this.isSelfClosingTag(m))h.push("br"===n&&i?"\n":m);else if(o)for(e=!1,f=!0;e===!1&&void 0!==f;)f=g.pop(),void 0!==f&&f.tag_name!==n?h.splice(f.i,1):(e=!0,void 0!==f&&h.push(m));else h.push(m),g.push({tag_name:n,i:h.length-1});d=l}}else"\n"===c&&this.options.beautifyCode?b&&i?h.push("<br/>"):i?h.push(c):g.length>0&&h.push(" "):9!=c.charCodeAt(0)&&h.push(c);for(;g.length>0;)f=g.pop(),h.splice(f.i,1);var p="\n";this.options.beautifyCode||(p=""),a="",g=0;var q=!0;for(d=0;d<h.length;d++)1==h[d].length?q&&" "===h[d]||(a+=h[d],q=!1):k.indexOf(this.tagName(h[d]).toLowerCase())<0?(a+=h[d],"br"==this.tagName(h[d])&&(a+=p)):this.isSelfClosingTag(h[d])?k.indexOf(this.tagName(h[d]).toLowerCase())>=0?(a+=this.tabs(g)+h[d]+p,q=!1):a+=h[d]:this.isClosingTag(h[d])?(g-=1,0===g&&(q=!0),a.length>0&&a[a.length-1]==p&&(a+=this.tabs(g)),a+=h[d]+p):(a+=p+this.tabs(g)+h[d],g+=1,q=!1);return a[0]==p&&(a=a.substring(1,a.length)),a[a.length-1]==p&&(a=a.substring(0,a.length-1)),a},b.prototype.cleanupLists=function(){this.$element.find("ul, ol").each(a.proxy(function(b,c){var d=a(c);if(this.parents(a(c),"ul, ol").length>0)return!0;if(d.find(".close-ul, .open-ul, .close-ol, .open-ol, .open-li, .close-li").length>0){var e="<"+c.tagName.toLowerCase()+">"+d.html()+"</"+c.tagName.toLowerCase()+">";e=e.replace(new RegExp('<span class="close-ul" data-fr-verified="true"></span>',"g"),"</ul>"),e=e.replace(new RegExp('<span class="open-ul" data-fr-verified="true"></span>',"g"),"<ul>"),e=e.replace(new RegExp('<span class="close-ol" data-fr-verified="true"></span>',"g"),"</ol>"),e=e.replace(new RegExp('<span class="open-ol" data-fr-verified="true"></span>',"g"),"<ol>"),e=e.replace(new RegExp('<span class="close-li" data-fr-verified="true"></span>',"g"),"</li>"),e=e.replace(new RegExp('<span class="open-li" data-fr-verified="true"></span>',"g"),"<li>"),e=e.replace(new RegExp("<li></li>","g"),""),d.replaceWith(e)}},this)),this.$element.find("li > td").remove(),this.$element.find("li td:empty").append(a.Editable.INVISIBLE_SPACE),this.$element.find(" > li").wrap("<ul>"),this.$element.find("ul, ol").each(a.proxy(function(b,c){var d=a(c);0===d.find(this.valid_nodes.join(",")).length&&d.remove()},this)),this.$element.find("li > ul, li > ol").each(a.proxy(function(b,c){var d=a(c).parent().get(0).previousSibling;this.isFirstSibling(c)&&(d&&"LI"==d.tagName?a(d).append(a(c)):a(c).before("<br/>"))},this)),this.$element.find("li:empty").remove();for(var b=this.$element.find("ol + ol, ul + ul"),c=0;c<b.length;c++){var d=a(b[c]);this.attrs(b[c])==this.attrs(d.prev().get(0))&&(d.prev().append(d.html()),d.remove())}this.$element.find("li > td").remove(),this.$element.find("li td:empty").append(a.Editable.INVISIBLE_SPACE),this.$element.find("li > "+this.options.defaultTag).each(function(b,c){0===c.attributes.length&&a(c).replaceWith(a(c).html())})},b.prototype.escapeEntities=function(a){return a.replace(/</gi,"&lt;").replace(/>/gi,"&gt;").replace(/"/gi,"&quot;").replace(/'/gi,"&apos;")},b.prototype.cleanNodeAttrs=function(a,b){var c=a.attributes;if(c)for(var d=new RegExp("^"+b.join("$|^")+"$","i"),e=0;e<c.length;e++){var f=c[e];d.test(f.nodeName)?a.setAttribute(f.nodeName,f.nodeValue.replace(/</gi,"&lt;").replace(/>/gi,"&gt;")):a.removeAttribute(f.nodeName)}},b.prototype.cleanAttrs=function(a){1==a.nodeType&&a.className.indexOf("f-marker")<0&&a!==this.$element.get(0)&&"IFRAME"!=a.tagName&&this.cleanNodeAttrs(a,this.options.allowedAttrs,!0);for(var b=a.childNodes,c=0;c<b.length;c++)this.cleanAttrs(b[c])},b.prototype.clean=function(c,d,e,f,g){this.pasting&&b.copiedText===a("<div>").html(c).text()&&(e=!1,d=!0),g||(g=a.merge([],this.options.allowedAttrs)),f||(f=a.merge([],this.options.allowedTags)),d||g.indexOf("id")>-1&&g.splice(g.indexOf("id"),1),this.options.fullPage&&(c=c.replace(/<!DOCTYPE([^>]*?)>/i,"<!-- DOCTYPE$1 -->"),c=c.replace(/<html([^>]*?)>/i,"<!-- html$1 -->"),c=c.replace(/<\/html([^>]*?)>/i,"<!-- /html$1 -->"),c=c.replace(/<body([^>]*?)>/i,"<!-- body$1 -->"),c=c.replace(/<\/body([^>]*?)>/i,"<!-- /body$1 -->"),c=c.replace(/<head>([\w\W]*)<\/head>/i,function(a,b){var c=1;return b=b.replace(/(<style)/gi,function(a,b){return b+" data-id="+c++}),"<!-- head "+b.replace(/(>)([\s|\t]*)(<)/gi,"$1$3").replace(/</gi,"[").replace(/>/gi,"]")+" -->"})),this.options.allowComments?(this.options.allowedTags.push("!--"),this.options.allowedTags.push("!")):c=c.replace(/(<!--[.\s\w\W]*?-->)/gi,""),this.options.allowScript||(c=c.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,"")),this.options.allowStyle||(c=c.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,"")),c=c.replace(/<!--([.\s\w\W]*?)-->/gi,function(a,b){return"<!--"+b.replace(/</g,"[[").replace(/>/g,"]]")+"-->"
});var h=new RegExp("<\\/?((?!(?:"+f.join(" |")+" |"+f.join(">|")+">|"+f.join("/>|")+"/>))\\w+)[^>]*?>","gi");if(c=c.replace(h,""),c=c.replace(/<!--([.\s\w\W]*?)-->/gi,function(a,b){return"<!--"+b.replace(/\[\[/g,"<").replace(/\]\]/g,">")+"-->"}),e){var i=new RegExp("style=(\"[a-zA-Z0-9:;\\.\\s\\(\\)\\-\\,!\\/'%]*\"|'[a-zA-Z0-9:;\\.\\s\\(\\)\\-\\,!\\/\"%]*')","gi");c=c.replace(i,""),c=c.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,"")}c=this.cleanTags(c,!0),c=c.replace(/(\r|\n)/gi,"");var j=new RegExp("<([^>]*)( src| href)=('[^']*'|\"[^\"]*\"|[^\\s>]+)([^>]*)>","gi");if(c=c.replace(j,a.proxy(function(a,b,c,d,e){return"<"+b+c+'="'+this.sanitizeURL(d.replace(/^["'](.*)["']\/?$/gi,"$1"))+'"'+e+">"},this)),!d){var k=a("<div>").append(c);k.find('[class]:not([class^="fr-"])').each(function(b,c){a(c).removeAttr("class")}),c=k.html()}return c},b.prototype.removeBlankSpans=function(){this.no_verify=!0,this.$element.find("span").removeAttr("data-fr-verified"),this.$element.find("span").each(a.proxy(function(b,c){0===this.attrs(c).length&&a(c).replaceWith(a(c).html())},this)),this.$element.find("span").attr("data-fr-verified",!0),this.no_verify=!1},b.prototype.plainPasteClean=function(b){var c=a("<div>").html(b);c.find("p, div, h1, h2, h3, h4, h5, h6, pre, blockquote").each(a.proxy(function(b,c){a(c).replaceWith("<"+this.options.defaultTag+">"+a(c).html()+"</"+this.options.defaultTag+">")},this)),a(c.find("*").not("p, div, h1, h2, h3, h4, h5, h6, pre, blockquote, ul, ol, li, table, tbody, thead, tr, td, br").get().reverse()).each(function(){a(this).replaceWith(a(this).html())});var d=function(b){for(var c=b.contents(),e=0;e<c.length;e++)3!=c[e].nodeType&&1!=c[e].nodeType?a(c[e]).remove():d(a(c[e]))};return d(c),c.html()},b.prototype.removeEmptyTags=function(b){for(var c,d=a("<div>").html(b),e=d.find("*:empty:not(br, img, td, th)");e.length;){for(c=0;c<e.length;c++)a(e[c]).remove();e=d.find("*:empty:not(br, img, td, th)")}for(var f=d.find("> div, td > div, th > div, li > div");f.length;){var g=a(f[f.length-1]);g.replaceWith(g.html()+"<br/>"),f=d.find("> div, td > div, th > div, li > div")}for(f=d.find("div");f.length;){for(c=0;c<f.length;c++){var h=a(f[c]),i=h.html().replace(/\u0009/gi,"").trim();h.replaceWith(i)}f=d.find("div")}return d.html()},b.prototype.initElementStyle=function(){this.editableDisabled||this.$element.attr("contenteditable",!0);var a="froala-view froala-element "+this.options.editorClass;this.browser.msie&&b.getIEversion()<9&&(a+=" ie8"),this.$element.css("outline",0),this.browser.msie||(a+=" not-msie"),this.$element.addClass(a)},b.prototype.CJKclean=function(a){var b=/[\u3041-\u3096\u30A0-\u30FF\u4E00-\u9FFF\u3130-\u318F\uAC00-\uD7AF]/gi;return a.replace(b,"")},b.prototype.enableTyping=function(){this.typingTimer=null,this.$element.on("keydown","textarea, input",function(a){a.stopPropagation()}),this.$element.on("keydown cut",a.proxy(function(b){if(!this.isHTML){if(!this.options.multiLine&&13==b.which)return b.preventDefault(),b.stopPropagation(),!1;if("keydown"===b.type&&!this.triggerEvent("keydown",[b],!1))return!1;clearTimeout(this.typingTimer),this.ajaxSave=!1,this.oldHTML=this.getHTML(!0,!1),this.typingTimer=setTimeout(a.proxy(function(){var a=this.getHTML(!0,!1);this.ime||this.CJKclean(a)===this.CJKclean(this.oldHTML)||this.CJKclean(a)!==a||this.sync()},this),Math.max(this.options.typingTimer,500))}},this))},b.prototype.removeMarkersByRegex=function(a){return a.replace(/<span[^>]*? class\s*=\s*["']?f-marker["']?[^>]+>([\S\s][^\/])*<\/span>/gi,"")},b.prototype.getImageHTML=function(){return JSON.stringify({src:this.$element.find("img").attr("src"),style:this.$element.find("img").attr("style"),alt:this.$element.find("img").attr("alt"),width:this.$element.find("img").attr("width"),link:this.$element.find("a").attr("href"),link_title:this.$element.find("a").attr("title"),link_target:this.$element.find("a").attr("target")})},b.prototype.getLinkHTML=function(){return JSON.stringify({body:this.$element.html(),href:this.$element.attr("href"),title:this.$element.attr("title"),popout:this.$element.hasClass("popout"),nofollow:"nofollow"==this.$element.attr("ref"),blank:"_blank"==this.$element.attr("target"),cls:this.$element.attr("class")?this.$element.attr("class").replace(/froala-element ?|not-msie ?|froala-view ?/gi,"").trim():""})},b.prototype.addFrTag=function(){this.$element.find(this.valid_nodes.join(",")+", table, ul, ol, img").addClass("fr-tag")},b.prototype.removeFrTag=function(){this.$element.find(this.valid_nodes.join(",")+", table, ul, ol, img").removeClass("fr-tag")},b.prototype.getHTML=function(b,c,d){if(void 0===b&&(b=!1),void 0===c&&(c=this.options.useFrTag),void 0===d&&(d=!0),this.$element.hasClass("f-placeholder")&&!b)return"";if(this.isHTML)return this.$html_area.val();if(this.isImage)return this.getImageHTML();if(this.isLink)return this.getLinkHTML();this.$element.find("a").data("fr-link",!0),c&&this.addFrTag(),this.$element.find(".f-img-editor > img").each(a.proxy(function(b,c){a(c).removeClass("fr-fin fr-fil fr-fir fr-dib fr-dii").addClass(this.getImageClass(a(c).parent().attr("class")))},this)),this.options.useClasses||this.$element.find("img").each(a.proxy(function(b,c){var d=a(c);d.attr("data-style",this.getImageStyle(d))},this)),this.$element.find("pre").each(a.proxy(function(b,c){var d=a(c),e=d.html(),f=e.replace(/\&nbsp;/gi," ").replace(/\n/gi,"<br>");e!=f&&(this.saveSelectionByMarkers(),d.html(f),this.restoreSelectionByMarkers())},this)),this.$element.find("pre br").addClass("fr-br"),this.$element.find('[class=""]').removeAttr("class"),this.cleanAttrs(this.$element.get(0));var e=this.$element.html();this.removeFrTag(),this.$element.find("pre br").removeAttr("class"),e=e.replace(/<a[^>]*?><\/a>/g,""),b||(e=this.removeMarkersByRegex(e)),e=e.replace(/<span[^>]*? class\s*=\s*["']?f-img-handle[^>]+><\/span>/gi,""),e=e.replace(/^([\S\s]*)<span[^>]*? class\s*=\s*["']?f-img-editor[^>]+>([\S\s]*)<\/span>([\S\s]*)$/gi,"$1$2$3"),e=e.replace(/^([\S\s]*)<span[^>]*? class\s*=\s*["']?f-img-wrap[^>]+>([\S\s]*)<\/span>([\S\s]*)$/gi,"$1$2$3"),this.options.useClasses||(e=e.replace(/data-style/gi,"style"),e=e.replace(/(<img[^>]*)( class\s*=['"]?[a-zA-Z0-9- ]+['"]?)([^>]*\/?>)/gi,"$1$3")),this.options.simpleAmpersand&&(e=e.replace(/\&amp;/gi,"&")),d&&(e=e.replace(/ data-fr-verified="true"/gi,"")),this.options.beautifyCode&&(e=e.replace(/\n/gi,"")),e=e.replace(/<br class="fr-br">/gi,"\n"),e=e.replace(/\u200B/gi,""),this.options.fullPage&&(e=e.replace(/<!-- DOCTYPE([^>]*?) -->/i,"<!DOCTYPE$1>"),e=e.replace(/<!-- html([^>]*?) -->/i,"<html$1>"),e=e.replace(/<!-- \/html([^>]*?) -->/i,"</html$1>"),e=e.replace(/<!-- body([^>]*?) -->/i,"<body$1>"),e=e.replace(/<!-- \/body([^>]*?) -->/i,"</body$1>"),e=e.replace(/<!-- head ([\w\W]*?) -->/i,function(a,b){return"<head>"+b.replace(/\[/gi,"<").replace(/\]/gi,">")+"</head>"}));var f=this.triggerEvent("getHTML",[e],!1);return"string"==typeof f?f:e},b.prototype.getText=function(){return this.$element.text()},b.prototype.setDirty=function(a){this.dirty=a,a||(clearTimeout(this.ajaxInterval),this.ajaxHTML=this.getHTML(!1,!1))},b.prototype.initAjaxSaver=function(){this.ajaxHTML=this.getHTML(!1,!1),this.ajaxSave=!0,this.ajaxInterval=setInterval(a.proxy(function(){var a=this.getHTML(!1,!1);(this.ajaxHTML!=a||this.dirty)&&this.ajaxSave&&(this.options.autosave&&this.save(),this.dirty=!1,this.ajaxHTML=a),this.ajaxSave=!0},this),Math.max(this.options.autosaveInterval,100))},b.prototype.disableBrowserUndo=function(){this.$element.keydown(a.proxy(function(a){var b=a.which,c=(a.ctrlKey||a.metaKey)&&!a.altKey;if(!this.isHTML&&c){if(90==b&&a.shiftKey)return a.preventDefault(),!1;if(90==b)return a.preventDefault(),!1}},this))},b.prototype.shortcutEnabled=function(a){return this.options.shortcutsAvailable.indexOf(a)>=0},b.prototype.shortcuts_map={69:{cmd:"show",params:[null],id:"show"},66:{cmd:"exec",params:["bold"],id:"bold"},73:{cmd:"exec",params:["italic"],id:"italic"},85:{cmd:"exec",params:["underline"],id:"underline"},83:{cmd:"exec",params:["strikeThrough"],id:"strikeThrough"},75:{cmd:"exec",params:["createLink"],id:"createLink"},80:{cmd:"exec",params:["insertImage"],id:"insertImage"},221:{cmd:"exec",params:["indent"],id:"indent"},219:{cmd:"exec",params:["outdent"],id:"outdent"},72:{cmd:"exec",params:["html"],id:"html"},48:{cmd:"exec",params:["formatBlock","n"],id:"formatBlock n"},49:{cmd:"exec",params:["formatBlock","h1"],id:"formatBlock h1"},50:{cmd:"exec",params:["formatBlock","h2"],id:"formatBlock h2"},51:{cmd:"exec",params:["formatBlock","h3"],id:"formatBlock h3"},52:{cmd:"exec",params:["formatBlock","h4"],id:"formatBlock h4"},53:{cmd:"exec",params:["formatBlock","h5"],id:"formatBlock h5"},54:{cmd:"exec",params:["formatBlock","h6"],id:"formatBlock h6"},222:{cmd:"exec",params:["formatBlock","blockquote"],id:"formatBlock blockquote"},220:{cmd:"exec",params:["formatBlock","pre"],id:"formatBlock pre"}},b.prototype.ctrlKey=function(a){if(-1!=navigator.userAgent.indexOf("Mac OS X")){if(a.metaKey&&!a.altKey)return!0}else if(a.ctrlKey&&!a.altKey)return!0;return!1},b.prototype.initShortcuts=function(){this.options.shortcuts&&this.$element.on("keydown",a.proxy(function(a){var b=a.which,c=this.ctrlKey(a);if(!this.isHTML&&c){if(this.shortcuts_map[b]&&this.shortcutEnabled(this.shortcuts_map[b].id))return this.execDefaultShortcut(this.shortcuts_map[b].cmd,this.shortcuts_map[b].params);if(90==b&&a.shiftKey)return a.preventDefault(),a.stopPropagation(),this.redo(),!1;if(90==b)return a.preventDefault(),a.stopPropagation(),this.undo(),!1}},this))},b.prototype.initTabs=function(){this.$element.on("keydown",a.proxy(function(a){var b=a.which;if(9!=b||a.shiftKey)9==b&&a.shiftKey&&(this.raiseEvent("shift+tab")?this.options.tabSpaces?a.preventDefault():this.blur():a.preventDefault());else if(this.raiseEvent("tab"))if(this.options.tabSpaces){a.preventDefault();var c="&nbsp;&nbsp;&nbsp;&nbsp;",d=this.getSelectionElements()[0];"PRE"===d.tagName&&(c="    "),this.insertHTML(c,!1)}else this.blur();else a.preventDefault()},this))},b.prototype.textEmpty=function(b){var c=a(b).text().replace(/(\r\n|\n|\r|\t)/gm,"");return(""===c||b===this.$element.get(0))&&0===a(b).find("br").length},b.prototype.inEditor=function(a){for(;a&&"BODY"!==a.tagName;){if(a===this.$element.get(0))return!0;a=a.parentNode}return!1},b.prototype.focus=function(b){if(this.isDisabled)return!1;if(void 0===b&&(b=!0),""!==this.text()&&!this.$element.is(":focus"))return void(this.browser.msie||(this.clearSelection(),this.$element.focus()));if(!this.isHTML){if(b&&!this.pasting&&this.$element.focus(),this.pasting&&!this.$element.is(":focus")&&this.$element.focus(),this.$element.hasClass("f-placeholder"))return void this.setSelection(this.$element.find(this.options.defaultTag).length>0?this.$element.find(this.options.defaultTag)[0]:this.$element.get(0));var c=this.getRange();if(""===this.text()&&c&&(0===c.startOffset||c.startContainer===this.$element.get(0)||!this.inEditor(c.startContainer))){var d,e,f=this.getSelectionElements();if(a.merge(["IMG","BR"],this.valid_nodes).indexOf(this.getSelectionElement().tagName)<0)return!1;if(c.startOffset>0&&this.valid_nodes.indexOf(this.getSelectionElement().tagName)>=0&&"BODY"!=c.startContainer.tagName||c.startContainer&&3===c.startContainer.nodeType)return;if(!this.options.paragraphy&&f.length>=1&&f[0]===this.$element.get(0)){var g=function(b){if(!b)return null;if(3==b.nodeType&&b.textContent.length>0)return b;if(1==b.nodeType&&"BR"==b.tagName)return b;for(var c=a(b).contents(),d=0;d<c.length;d++){var e=g(c[d]);if(null!=e)return e}return null};if(0===c.startOffset&&this.$element.contents().length>0&&3!=this.$element.contents()[0].nodeType){var h=g(this.$element.get(0));null!=h&&("BR"==h.tagName?this.$element.is(":focus")&&(a(h).before(this.markers_html),this.restoreSelectionByMarkers()):this.setSelection(h))}return!1}if(f.length>=1&&f[0]!==this.$element.get(0))for(d=0;d<f.length;d++){if(e=f[d],!this.textEmpty(e)||this.browser.msie)return void this.setSelection(e);if(this.textEmpty(e)&&["LI","TD"].indexOf(e.tagName)>=0)return}if(c.startContainer===this.$element.get(0)&&c.startOffset>0&&!this.options.paragraphy)return void this.setSelection(this.$element.get(0),c.startOffset);for(f=this.$element.find(this.valid_nodes.join(",")),d=0;d<f.length;d++)if(e=f[d],!this.textEmpty(e)&&0===a(e).find(this.valid_nodes.join(",")).length)return void this.setSelection(e);this.setSelection(this.$element.get(0))}}},b.prototype.addMarkersAtEnd=function(b){if(b.find(".fr-marker").length>0)return!1;for(var c=b.get(0),d=a(c).contents();d.length&&this.valid_nodes.indexOf(d[d.length-1].tagName)>=0;)c=d[d.length-1],d=a(d[d.length-1]).contents();a(c).append(this.markers_html)},b.prototype.setFocusAtEnd=function(a){void 0===a&&(a=this.$element),this.addMarkersAtEnd(a),this.restoreSelectionByMarkers()},b.prototype.breakHTML=function(b,c){"undefined"==typeof c&&(c=!0),this.removeMarkers(),0===this.$element.find("break").length&&this.insertSimpleHTML("<break></break>");var d=this.parents(this.$element.find("break"),a.merge(["UL","OL"],this.valid_nodes).join(","))[0];if(this.parents(a(d),"ul, ol").length&&(d=this.parents(a(d),"ul, ol")[0]),void 0===d&&(d=this.$element.get(0)),["UL","OL"].indexOf(d.tagName)>=0){var e=a("<div>").html(b);e.find("> li").wrap("<"+d.tagName+">"),b=e.html()}if(d==this.$element.get(0)){if(this.$element.find("break").next().length){this.insertSimpleHTML('<div id="inserted-div">'+b+"</div>");var f=this.$element.find("div#inserted-div");this.setFocusAtEnd(f),this.saveSelectionByMarkers(),f.replaceWith(f.contents()),this.restoreSelectionByMarkers()}else this.insertSimpleHTML(b),this.setFocusAtEnd();return this.$element.find("break").remove(),this.checkPlaceholder(),!0}if("TD"===d.tagName)return this.$element.find("break").remove(),this.insertSimpleHTML(b),!0;var g=a("<div>").html(b);if(this.addMarkersAtEnd(g),b=g.html(),this.emptyElement(a(d)))return a(d).replaceWith(b),this.restoreSelectionByMarkers(),this.checkPlaceholder(),!0;this.$element.find("li").each(a.proxy(function(b,c){this.emptyElement(c)&&a(c).addClass("empty-li")},this));for(var h,i,j=a("<div></div>").append(a(d).clone()).html(),k=[],l={},m=[],n=0,o=0;o<j.length;o++)if(i=j.charAt(o),"<"==i){var p=j.indexOf(">",o+1);if(-1!==p){h=j.substring(o,p+1);var q=this.tagName(h);if(o=p,"break"==q){if(!this.isClosingTag(h)){for(var r=!0,s=[],t=k.length-1;t>=0;t--){var u=this.tagName(k[t]);if(!c&&"LI"==u.toUpperCase()){r=!1;break}m.push("</"+u+">"),s.push(k[t])}m.push(b),r||m.push("</li><li>");for(var v=0;v<s.length;v++)m.push(s[v])}}else if(m.push(h),!this.isSelfClosingTag(h))if(this.isClosingTag(h)){var w=l[q].pop();k.splice(w,1)}else k.push(h),void 0===l[q]&&(l[q]=[]),l[q].push(k.length-1)}}else n++,m.push(i);a(d).replaceWith(m.join("")),this.$element.find("li").each(a.proxy(function(b,c){var d=a(c);d.hasClass("empty-li")?d.removeClass("empty-li"):this.emptyElement(c)&&d.remove()},this)),this.cleanupLists(),this.restoreSelectionByMarkers()},b.prototype.insertSimpleHTML=function(a){var b,c;if(this.no_verify=!0,this.window.getSelection){if(b=this.window.getSelection(),b.getRangeAt&&b.rangeCount){c=b.getRangeAt(0),this.browser.webkit?c.collapsed||this.document.execCommand("delete"):c.deleteContents(),this.$element.find(this.valid_nodes.join(":empty, ")+":empty").remove();var d=this.document.createElement("div");d.innerHTML=a;for(var e,f,g=this.document.createDocumentFragment();e=d.firstChild;)f=g.appendChild(e);c.insertNode(g),f&&(c=c.cloneRange(),c.setStartAfter(f),c.collapse(!0),b.removeAllRanges(),b.addRange(c))}}else if((b=this.document.selection)&&"Control"!=b.type){var h=b.createRange();h.collapse(!0),b.createRange().pasteHTML(a)}this.no_verify=!1},b.prototype.insertHTML=function(b,c,d){if(void 0===c&&(c=!0),void 0===d&&(d=!1),!this.isHTML&&c&&this.focus(),this.removeMarkers(),this.insertSimpleHTML("<break></break>"),this.checkPlaceholder(!0),this.$element.hasClass("f-placeholder"))return this.$element.html(b),this.options.paragraphy&&this.wrapText(!0),this.$element.find("p > br").each(function(){var b=this.parentNode;1==a(b).contents().length&&a(b).remove()}),this.$element.find("break").remove(),this.setFocusAtEnd(),this.checkPlaceholder(),this.convertNewLines(),!1;for(var e=a("<div>").append(b).find("*"),f=0;f<e.length;f++)if(this.valid_nodes.indexOf(e[f].tagName)>=0)return this.breakHTML(b),this.$element.find("break").remove(),this.convertNewLines(),!1;this.$element.find("break").remove(),this.insertSimpleHTML(b),this.convertNewLines()},b.prototype.execDefaultShortcut=function(a,b){return this[a].apply(this,b),!1},b.prototype.initEditor=function(){var c="froala-editor";this.mobile()&&(c+=" touch"),this.browser.msie&&b.getIEversion()<9&&(c+=" ie8"),this.$editor=a('<div class="'+c+'" style="display: none;">');var d=this.$document.find(this.options.scrollableContainer);d.append(this.$editor),this.options.inlineMode?this.initInlineEditor():this.initBasicEditor()},b.prototype.refreshToolbarPosition=function(){this.$window.scrollTop()>this.$box.offset().top&&this.$window.scrollTop()<this.$box.offset().top+this.$box.outerHeight()-this.$editor.outerHeight()?(this.$element.css("padding-top",this.$editor.outerHeight()+this.$element.data("padding-top")),this.$placeholder.css("margin-top",this.$editor.outerHeight()+this.$element.data("padding-top")),this.$editor.addClass("f-scroll").removeClass("f-scroll-abs").css("bottom","").css("left",this.$box.offset().left+parseFloat(this.$box.css("padding-left"),10)-this.$window.scrollLeft()).width(this.$box.width()-parseFloat(this.$editor.css("border-left-width"),10)-parseFloat(this.$editor.css("border-right-width"),10)),this.iOS()&&(this.$element.is(":focus")?this.$editor.css("top",this.$window.scrollTop()):this.$editor.css("top",""))):this.$window.scrollTop()<this.$box.offset().top?this.iOS()&&this.$element.is(":focus")?(this.$element.css("padding-top",this.$editor.outerHeight()+this.$element.data("padding-top")),this.$placeholder.css("margin-top",this.$editor.outerHeight()+this.$element.data("padding-top")),this.$editor.addClass("f-scroll").removeClass("f-scroll-abs").css("bottom","").css("left",this.$box.offset().left+parseFloat(this.$box.css("padding-left"),10)-this.$window.scrollLeft()).width(this.$box.width()-parseFloat(this.$editor.css("border-left-width"),10)-parseFloat(this.$editor.css("border-right-width"),10)),this.$editor.css("top",this.$box.offset().top)):(this.$editor.removeClass("f-scroll f-scroll-abs").css("bottom","").css("top","").width(""),this.$element.css("padding-top",""),this.$placeholder.css("margin-top","")):this.$window.scrollTop()>this.$box.offset().top+this.$box.outerHeight()-this.$editor.outerHeight()&&!this.$editor.hasClass("f-scroll-abs")?(this.$element.css("padding-top",this.$editor.outerHeight()+this.$element.data("padding-top")),this.$placeholder.css("margin-top",this.$editor.outerHeight()+this.$element.data("padding-top")),this.$editor.removeClass("f-scroll").addClass("f-scroll-abs"),this.$editor.css("bottom",0).css("top","").css("left","")):this.$editor.removeClass("f-scroll").css("bottom","").css("top","").css("left","").width("")},b.prototype.toolbarTop=function(){this.options.toolbarFixed||this.options.inlineMode||(this.$element.data("padding-top",parseInt(this.$element.css("padding-top"),10)),this.$window.on("scroll resize load",a.proxy(function(){this.refreshToolbarPosition()},this)),this.iOS()&&this.$element.on("focus blur",a.proxy(function(){this.refreshToolbarPosition()},this)))},b.prototype.initBasicEditor=function(){this.$element.addClass("f-basic"),this.$wrapper.addClass("f-basic"),this.$popup_editor=this.$editor.clone();var a=this.$document.find(this.options.scrollableContainer);this.$popup_editor.appendTo(a).addClass("f-inline"),this.$editor.addClass("f-basic").show(),this.$editor.insertBefore(this.$wrapper),this.toolbarTop()},b.prototype.initInlineEditor=function(){this.$editor.addClass("f-inline"),this.$element.addClass("f-inline"),this.$popup_editor=this.$editor},b.prototype.initDrag=function(){this.drag_support={filereader:"undefined"!=typeof FileReader,formdata:!!this.window.FormData,progress:"upload"in new XMLHttpRequest}},b.prototype.initOptions=function(){this.setDimensions(),this.setSpellcheck(),this.setImageUploadURL(),this.setButtons(),this.setDirection(),this.setZIndex(),this.setTheme(),this.options.editInPopup&&this.buildEditPopup(),this.editableDisabled||(this.setPlaceholder(),this.setPlaceholderEvents())},b.prototype.setAllowStyle=function(a){"undefined"==typeof a&&(a=this.options.allowStyle),a?this.options.allowedTags.push("style"):this.options.allowedTags.splice(this.options.allowedTags.indexOf("style"),1)},b.prototype.setAllowScript=function(a){"undefined"==typeof a&&(a=this.options.allowScript),a?this.options.allowedTags.push("script"):this.options.allowedTags.splice(this.options.allowedTags.indexOf("script"),1)},b.prototype.isTouch=function(){return WYSIWYGModernizr.touch&&void 0!==this.window.Touch},b.prototype.initEditorSelection=function(){this.$element.on("keyup",a.proxy(function(a){return this.triggerEvent("keyup",[a],!1)},this)),this.$element.on("focus",a.proxy(function(){this.blurred&&(this.blurred=!1,this.pasting||""!==this.text()||this.focus(!1),this.triggerEvent("focus",[],!1))},this)),this.$element.on("mousedown touchstart",a.proxy(function(){return this.isDisabled?!1:void(this.isResizing()||(this.closeImageMode(),this.hide()))},this)),this.options.disableRightClick&&this.$element.contextmenu(a.proxy(function(a){return a.preventDefault(),this.options.inlineMode&&this.$element.focus(),!1},this)),this.$element.on(this.mouseup,a.proxy(function(b){if(this.isDisabled)return!1;if(!this.isResizing()){var c=this.text();b.stopPropagation(),this.imageMode=!1,!(""!==c||this.options.alwaysVisible||this.options.editInPopup||(3==b.which||2==b.button)&&this.options.inlineMode&&!this.isImage&&this.options.disableRightClick)||this.link||this.imageMode?this.options.inlineMode||this.refreshButtons():setTimeout(a.proxy(function(){c=this.text(),!(""!==c||this.options.alwaysVisible||this.options.editInPopup||(3==b.which||2==b.button)&&this.options.inlineMode&&!this.isImage&&this.options.disableRightClick)||this.link||this.imageMode||(this.show(b),this.options.editInPopup&&this.showEditPopup())},this),0)}this.hideDropdowns(),this.hideOtherEditors()},this)),this.$editor.on(this.mouseup,a.proxy(function(a){return this.isDisabled?!1:void(this.isResizing()||(a.stopPropagation(),this.options.inlineMode===!1&&this.hide()))},this)),this.$editor.on("mousedown",".fr-dropdown-menu",a.proxy(function(a){return this.isDisabled?!1:(a.stopPropagation(),void(this.noHide=!0))},this)),this.$popup_editor.on("mousedown",".fr-dropdown-menu",a.proxy(function(a){return this.isDisabled?!1:(a.stopPropagation(),void(this.noHide=!0))},this)),this.$popup_editor.on("mouseup",a.proxy(function(a){return this.isDisabled?!1:void(this.isResizing()||a.stopPropagation())},this)),this.$edit_popup_wrapper&&this.$edit_popup_wrapper.on("mouseup",a.proxy(function(a){return this.isDisabled?!1:void(this.isResizing()||a.stopPropagation())},this)),this.setDocumentSelectionChangeEvent(),this.setWindowMouseUpEvent(),this.setWindowKeyDownEvent(),this.setWindowKeyUpEvent(),this.setWindowOrientationChangeEvent(),this.setWindowHideEvent(),this.setWindowBlurEvent(),this.options.trackScroll&&this.setWindowScrollEvent(),this.setWindowResize()},b.prototype.setWindowResize=function(){this.$window.on("resize."+this._id,a.proxy(function(){this.hide(),this.closeImageMode(),this.imageMode=!1},this))},b.prototype.blur=function(b){this.blurred||this.pasting||(this.selectionDisabled=!0,this.triggerEvent("blur",[]),b&&0===a("*:focus").length&&this.clearSelection(),this.isLink||this.isImage||(this.selectionDisabled=!1),this.blurred=!0)},b.prototype.setWindowBlurEvent=function(){this.$window.on("blur."+this._id,a.proxy(function(a,b){this.blur(b)},this))},b.prototype.setWindowHideEvent=function(){this.$window.on("hide."+this._id,a.proxy(function(){this.isResizing()?this.$element.find(".f-img-handle").trigger("moveend"):this.hide(!1)},this))},b.prototype.setWindowOrientationChangeEvent=function(){this.$window.on("orientationchange."+this._id,a.proxy(function(){setTimeout(a.proxy(function(){this.hide()},this),10)},this))},b.prototype.setDocumentSelectionChangeEvent=function(){this.$document.on("selectionchange."+this._id,a.proxy(function(b){return this.isDisabled?!1:void(this.isResizing()||this.isScrolling||(clearTimeout(this.selectionChangedTimeout),this.selectionChangedTimeout=setTimeout(a.proxy(function(){if(this.options.inlineMode&&this.selectionInEditor()&&this.link!==!0&&this.isTouch()){var a=this.text();""!==a?(this.iPod()?this.options.alwaysVisible&&this.hide():this.show(null),b.stopPropagation()):this.options.alwaysVisible?this.show(null):(this.hide(),this.closeImageMode(),this.imageMode=!1)}},this),75)))},this))},b.prototype.setWindowMouseUpEvent=function(){this.$window.on(this.mouseup+"."+this._id,a.proxy(function(){return this.browser.webkit&&!this.initMouseUp?(this.initMouseUp=!0,!1):(this.isResizing()||this.isScrolling||this.isDisabled||(this.$bttn_wrapper.find("button.fr-trigger").removeClass("active"),this.selectionInEditor()&&""!==this.text()&&!this.isTouch()?this.show(null):this.$popup_editor.is(":visible")&&(this.hide(),this.closeImageMode(),this.imageMode=!1),this.blur(!0)),void a("[data-down]").removeAttr("data-down"))},this))},b.prototype.setWindowKeyDownEvent=function(){this.$window.on("keydown."+this._id,a.proxy(function(b){var c=b.which;if(27==c&&(this.focus(),this.restoreSelection(),this.hide(),this.closeImageMode(),this.imageMode=!1),this.imageMode){if(13==c)return this.$element.find(".f-img-editor").parents(".f-img-wrap").before("<br/>"),this.sync(),this.$element.find(".f-img-editor img").click(),!1;if(46==c||8==c)return b.stopPropagation(),b.preventDefault(),setTimeout(a.proxy(function(){this.removeImage(this.$element.find(".f-img-editor img"))},this),0),!1}else if(this.selectionInEditor()){if(this.isDisabled)return!0;var d=(b.ctrlKey||b.metaKey)&&!b.altKey;!d&&this.$popup_editor.is(":visible")&&this.$bttn_wrapper.is(":visible")&&this.options.inlineMode&&(this.hide(),this.closeImageMode(),this.imageMode=!1)}},this))},b.prototype.setWindowKeyUpEvent=function(){this.$window.on("keyup."+this._id,a.proxy(function(){return this.isDisabled?!1:void(this.selectionInEditor()&&""!==this.text()&&!this.$popup_editor.is(":visible")&&this.repositionEditor())},this))},b.prototype.setWindowScrollEvent=function(){a.merge(this.$window,a(this.options.scrollableContainer)).on("scroll."+this._id,a.proxy(function(){return this.isDisabled?!1:(clearTimeout(this.scrollTimer),this.isScrolling=!0,void(this.scrollTimer=setTimeout(a.proxy(function(){this.isScrolling=!1},this),2500)))},this))},b.prototype.setPlaceholder=function(b){b&&(this.options.placeholder=b),this.$textarea&&this.$textarea.attr("placeholder",this.options.placeholder),this.$placeholder||(this.$placeholder=a('<span class="fr-placeholder" unselectable="on"></span>').bind("click",a.proxy(function(){this.focus()},this)),this.$element.after(this.$placeholder)),this.$placeholder.text(this.options.placeholder)},b.prototype.isEmpty=function(){var b=this.$element.text().replace(/(\r\n|\n|\r|\t|\u200B|\u0020)/gm,"");return""===b&&0===this.$element.find("img, table, iframe, input, textarea, hr, li, object").length&&0===this.$element.find(this.options.defaultTag+" > br, br").length&&0===this.$element.find(a.map(this.valid_nodes,a.proxy(function(a){return this.options.defaultTag==a?null:a},this)).join(", ")).length},b.prototype.checkPlaceholder=function(c){if(this.isDisabled&&!c)return!1;if(this.pasting&&!c)return!1;if(this.$element.find("td:empty, th:empty").append(a.Editable.INVISIBLE_SPACE),this.$element.find(this.valid_nodes.join(":empty, ")+":empty").append(this.br),!this.isHTML)if(this.isEmpty()&&!this.fakeEmpty()){var d,e=this.selectionInEditor()||this.$element.is(":focus");this.options.paragraphy?(d=a("<"+this.options.defaultTag+">"+this.br+"</"+this.options.defaultTag+">"),this.$element.html(d),e&&this.setSelection(d.get(0)),this.$element.addClass("f-placeholder")):(0!==this.$element.find("br").length||this.browser.msie&&b.getIEversion()<=10||(this.$element.append(this.br),e&&this.browser.msie&&this.focus()),this.$element.addClass("f-placeholder"))}else!this.$element.find(this.options.defaultTag+", li, td, th").length&&this.options.paragraphy?(this.wrapText(!0),this.$element.find(this.options.defaultTag).length&&""===this.text()?this.setSelection(this.$element.find(this.options.defaultTag)[0],this.$element.find(this.options.defaultTag).text().length,null,this.$element.find(this.options.defaultTag).text().length):this.$element.removeClass("f-placeholder")):this.fakeEmpty()===!1&&(!this.options.paragraphy||this.$element.find(this.valid_nodes.join(",")).length>=1)?this.$element.removeClass("f-placeholder"):!this.options.paragraphy&&this.$element.find(this.valid_nodes.join(",")).length>=1?this.$element.removeClass("f-placeholder"):this.$element.addClass("f-placeholder");return!0},b.prototype.fakeEmpty=function(a){void 0===a&&(a=this.$element);var b=!0;this.options.paragraphy&&(b=1==a.find(this.options.defaultTag).length?!0:!1);var c=a.text().replace(/(\r\n|\n|\r|\t|\u200B)/gm,"");return""===c&&b&&1==a.find("br, li").length&&0===a.find("img, table, iframe, input, textarea, hr, li").length},b.prototype.setPlaceholderEvents=function(){this.browser.msie&&b.getIEversion()<9||(this.$element.on("focus click",a.proxy(function(a){return this.isDisabled?!1:void(""!==this.$element.text()||this.pasting||(this.$element.data("focused")||"click"!==a.type?"focus"==a.type&&this.focus(!1):this.$element.focus(),this.$element.data("focused",!0)))},this)),this.$element.on("keyup keydown input focus placeholderCheck",a.proxy(function(){return this.checkPlaceholder()},this)),this.$element.trigger("placeholderCheck"))},b.prototype.setDimensions=function(a,b,c,d){a&&(this.options.height=a),b&&(this.options.width=b),c&&(this.options.minHeight=c),d&&(this.options.maxHeight=d),"auto"!=this.options.height&&(this.$wrapper.css("height",this.options.height),this.$element.css("minHeight",this.options.height-parseInt(this.$element.css("padding-top"),10)-parseInt(this.$element.css("padding-bottom"),10))),"auto"!=this.options.minHeight&&(this.$wrapper.css("minHeight",this.options.minHeight),this.$element.css("minHeight",this.options.minHeight)),"auto"!=this.options.maxHeight&&this.$wrapper.css("maxHeight",this.options.maxHeight),"auto"!=this.options.width&&this.$box.css("width",this.options.width)},b.prototype.setDirection=function(a){a&&(this.options.direction=a),"ltr"!=this.options.direction&&"rtl"!=this.options.direction&&(this.options.direction="ltr"),"rtl"==this.options.direction?(this.$element.removeAttr("dir"),this.$box.addClass("f-rtl"),this.$element.addClass("f-rtl"),this.$editor.addClass("f-rtl"),this.$popup_editor.addClass("f-rtl"),this.$image_modal&&this.$image_modal.addClass("f-rtl")):(this.$element.attr("dir","auto"),this.$box.removeClass("f-rtl"),this.$element.removeClass("f-rtl"),this.$editor.removeClass("f-rtl"),this.$popup_editor.removeClass("f-rtl"),this.$image_modal&&this.$image_modal.removeClass("f-rtl"))},b.prototype.setZIndex=function(a){a&&(this.options.zIndex=a),this.$editor.css("z-index",this.options.zIndex),this.$popup_editor.css("z-index",this.options.zIndex+1),this.$overlay&&this.$overlay.css("z-index",this.options.zIndex+1002),this.$image_modal&&this.$image_modal.css("z-index",this.options.zIndex+1003)},b.prototype.setTheme=function(a){a&&(this.options.theme=a),null!=this.options.theme&&(this.$editor.addClass(this.options.theme+"-theme"),this.$popup_editor.addClass(this.options.theme+"-theme"),this.$box&&this.$box.addClass(this.options.theme+"-theme"),this.$image_modal&&this.$image_modal.addClass(this.options.theme+"-theme"))},b.prototype.setSpellcheck=function(a){void 0!==a&&(this.options.spellcheck=a),this.$element.attr("spellcheck",this.options.spellcheck)
},b.prototype.customizeText=function(b){if(b){var c=this.$editor.find("[title]").add(this.$popup_editor.find("[title]"));this.$image_modal&&(c=c.add(this.$image_modal.find("[title]"))),c.each(a.proxy(function(c,d){for(var e in b)a(d).attr("title").toLowerCase()==e.toLowerCase()&&a(d).attr("title",b[e])},this)),c=this.$editor.find('[data-text="true"]').add(this.$popup_editor.find('[data-text="true"]')),this.$image_modal&&(c=c.add(this.$image_modal.find('[data-text="true"]'))),c.each(a.proxy(function(c,d){for(var e in b)a(d).text().toLowerCase()==e.toLowerCase()&&a(d).text(b[e])},this))}},b.prototype.setLanguage=function(b){void 0!==b&&(this.options.language=b),a.Editable.LANGS[this.options.language]&&(this.customizeText(a.Editable.LANGS[this.options.language].translation),a.Editable.LANGS[this.options.language].direction&&a.Editable.LANGS[this.options.language].direction!=a.Editable.DEFAULTS.direction&&this.setDirection(a.Editable.LANGS[this.options.language].direction),a.Editable.LANGS[this.options.language].translation[this.options.placeholder]&&this.setPlaceholder(a.Editable.LANGS[this.options.language].translation[this.options.placeholder]))},b.prototype.setCustomText=function(a){a&&(this.options.customText=a),this.options.customText&&this.customizeText(this.options.customText)},b.prototype.execHTML=function(){this.html()},b.prototype.initHTMLArea=function(){this.$html_area=a('<textarea wrap="hard">').keydown(function(b){var c=b.keyCode||b.which;if(9==c){b.preventDefault();var d=a(this).get(0).selectionStart,e=a(this).get(0).selectionEnd;a(this).val(a(this).val().substring(0,d)+"	"+a(this).val().substring(e)),a(this).get(0).selectionStart=a(this).get(0).selectionEnd=d+1}}).focus(a.proxy(function(){this.blurred&&(this.blurred=!1,this.triggerEvent("focus",[],!1))},this)).mouseup(a.proxy(function(){this.blurred&&(this.blurred=!1,this.triggerEvent("focus",[],!1))},this))},b.prototype.command_dispatcher={align:function(a){var b=this.buildDropdownAlign(a),c=this.buildDropdownButton(a,b);return c},formatBlock:function(a){var b=this.buildDropdownFormatBlock(a),c=this.buildDropdownButton(a,b);return c},html:function(b){var c=this.buildDefaultButton(b);return this.options.inlineMode&&this.$box.append(a(c).clone(!0).addClass("html-switch").attr("title","Hide HTML").click(a.proxy(this.execHTML,this))),this.initHTMLArea(),c}},b.prototype.setButtons=function(a){a&&(this.options.buttons=a),this.$editor.append('<div class="bttn-wrapper" id="bttn-wrapper-'+this._id+'">'),this.$bttn_wrapper=this.$editor.find("#bttn-wrapper-"+this._id),this.mobile()&&this.$bttn_wrapper.addClass("touch");for(var c,d,e="",f=0;f<this.options.buttons.length;f++){var g=this.options.buttons[f];if("sep"!=g){var h=b.commands[g];if(void 0!==h){h.cmd=g;var i=this.command_dispatcher[h.cmd];i?e+=i.apply(this,[h]):h.seed?(c=this.buildDefaultDropdown(h),d=this.buildDropdownButton(h,c),e+=d):(d=this.buildDefaultButton(h),e+=d,this.bindRefreshListener(h))}else{if(h=this.options.customButtons[g],void 0===h){if(h=this.options.customDropdowns[g],void 0===h)continue;d=this.buildCustomDropdown(h,g),e+=d,this.bindRefreshListener(h);continue}d=this.buildCustomButton(h,g),e+=d,this.bindRefreshListener(h)}}else e+=this.options.inlineMode?'<div class="f-clear"></div><hr/>':'<span class="f-sep"></span>'}this.$bttn_wrapper.html(e),this.$bttn_wrapper.find('button[data-cmd="undo"], button[data-cmd="redo"]').prop("disabled",!0),this.bindButtonEvents()},b.prototype.bindRefreshListener=function(b){b.refresh&&this.addListener("refresh",a.proxy(function(){b.refresh.apply(this,[b.cmd])},this))},b.prototype.buildDefaultButton=function(a){var b='<button tabIndex="-1" type="button" class="fr-bttn" title="'+a.title+'" data-cmd="'+a.cmd+'">';return b+=void 0===this.options.icons[a.cmd]?this.addButtonIcon(a):this.prepareIcon(this.options.icons[a.cmd],a.title),b+="</button>"},b.prototype.prepareIcon=function(a,b){switch(a.type){case"font":return this.addButtonIcon({icon:a.value});case"img":return this.addButtonIcon({icon_img:a.value,title:b});case"txt":return this.addButtonIcon({icon_txt:a.value})}},b.prototype.addButtonIcon=function(a){return a.icon?'<i class="'+a.icon+'"></i>':a.icon_alt?'<i class="for-text">'+a.icon_alt+"</i>":a.icon_img?'<img src="'+a.icon_img+'" alt="'+a.title+'"/>':a.icon_txt?"<i>"+a.icon_txt+"</i>":a.title},b.prototype.buildCustomButton=function(a,b){this["call_"+b]=a.callback;var c='<button tabIndex="-1" type="button" class="fr-bttn" data-callback="call_'+b+'" data-cmd="button_name" data-name="'+b+'" title="'+a.title+'">'+this.prepareIcon(a.icon,a.title)+"</button>";return c},b.prototype.callDropdown=function(b,c){this.$bttn_wrapper.on("click touch",'[data-name="'+b+'"]',a.proxy(function(a){a.preventDefault(),a.stopPropagation(),c.apply(this)},this))},b.prototype.buildCustomDropdown=function(a,b){var c='<div class="fr-bttn fr-dropdown">';c+='<button tabIndex="-1" type="button" class="fr-trigger" title="'+a.title+'" data-name="'+b+'">'+this.prepareIcon(a.icon,a.title)+"</button>",c+='<ul class="fr-dropdown-menu">';var d=0;for(var e in a.options){this["call_"+b+d]=a.options[e];var f='<li data-callback="call_'+b+d+'" data-cmd="'+b+d+'" data-name="'+b+d+'"><a href="#">'+e+"</a></li>";c+=f,d++}return c+="</ul></div>"},b.prototype.buildDropdownButton=function(a,b,c){c=c||"";var d='<div class="fr-bttn fr-dropdown '+c+'">',e="";e+=void 0===this.options.icons[a.cmd]?this.addButtonIcon(a):this.prepareIcon(this.options.icons[a.cmd],a.title);var f='<button tabIndex="-1" type="button" data-name="'+a.cmd+'" class="fr-trigger" title="'+a.title+'">'+e+"</button>";return d+=f,d+=b,d+="</div>"},b.prototype.buildDropdownAlign=function(a){this.bindRefreshListener(a);for(var b='<ul class="fr-dropdown-menu f-align">',c=0;c<a.seed.length;c++){var d=a.seed[c];b+='<li data-cmd="align" data-val="'+d.cmd+'" title="'+d.title+'"><a href="#"><i class="'+d.icon+'"></i></a></li>'}return b+="</ul>"},b.prototype.buildDropdownFormatBlock=function(a){var b='<ul class="fr-dropdown-menu">';for(var c in this.options.blockTags){var d='<li data-cmd="'+a.cmd+'" data-val="'+c+'">';d+='<a href="#" data-text="true" class="format-'+c+'" title="'+this.options.blockTags[c]+'">'+this.options.blockTags[c]+"</a></li>",b+=d}return b+="</ul>"},b.prototype.buildDefaultDropdown=function(a){for(var b='<ul class="fr-dropdown-menu">',c=0;c<a.seed.length;c++){var d=a.seed[c],e='<li data-namespace="'+a.namespace+'" data-cmd="'+(d.cmd||a.cmd)+'" data-val="'+d.value+'" data-param="'+(d.param||a.param)+'">';e+='<a href="#" data-text="true" class="'+d.value+'" title="'+d.title+'">'+d.title+"</a></li>",b+=e}return b+="</ul>"},b.prototype.createEditPopupHTML=function(){var a='<div class="froala-popup froala-text-popup" style="display:none;">';return a+='<h4><span data-text="true">Edit text</span><i title="Cancel" class="fa fa-times" id="f-text-close-'+this._id+'"></i></h4></h4>',a+='<div class="f-popup-line"><input type="text" placeholder="http://www.example.com" class="f-lu" id="f-ti-'+this._id+'">',a+='<button data-text="true" type="button" class="f-ok" id="f-edit-popup-ok-'+this._id+'">OK</button>',a+="</div>",a+="</div>"},b.prototype.buildEditPopup=function(){this.$edit_popup_wrapper=a(this.createEditPopupHTML()),this.$popup_editor.append(this.$edit_popup_wrapper),this.$edit_popup_wrapper.find("#f-ti-"+this._id).on("mouseup keydown",function(a){a.stopPropagation()}),this.addListener("hidePopups",a.proxy(function(){this.$edit_popup_wrapper.hide()},this)),this.$edit_popup_wrapper.on("click","#f-edit-popup-ok-"+this._id,a.proxy(function(){this.$element.text(this.$edit_popup_wrapper.find("#f-ti-"+this._id).val()),this.sync(),this.hide()},this)),this.$edit_popup_wrapper.on("click","i#f-text-close-"+this._id,a.proxy(function(){this.hide()},this))},b.prototype.createCORSRequest=function(a,b){var c=new XMLHttpRequest;if("withCredentials"in c){c.open(a,b,!0),this.options.withCredentials&&(c.withCredentials=!0);for(var d in this.options.headers)c.setRequestHeader(d,this.options.headers[d])}else"undefined"!=typeof XDomainRequest?(c=new XDomainRequest,c.open(a,b)):c=null;return c},b.prototype.isEnabled=function(b){return a.inArray(b,this.options.buttons)>=0},b.prototype.bindButtonEvents=function(){this.bindDropdownEvents(this.$bttn_wrapper),this.bindCommandEvents(this.$bttn_wrapper)},b.prototype.bindDropdownEvents=function(c){var d=this;c.on(this.mousedown,".fr-dropdown .fr-trigger:not([disabled])",function(b){return"mousedown"===b.type&&1!==b.which?!0:("LI"===this.tagName&&"touchstart"===b.type&&d.android()||d.iOS()||b.preventDefault(),void a(this).attr("data-down",!0))}),c.on(this.mouseup,".fr-dropdown .fr-trigger:not([disabled])",function(e){if(d.isDisabled)return!1;if(e.stopPropagation(),e.preventDefault(),!a(this).attr("data-down"))return a("[data-down]").removeAttr("data-down"),!1;a("[data-down]").removeAttr("data-down"),d.options.inlineMode===!1&&0===a(this).parents(".froala-popup").length&&(d.hide(),d.closeImageMode(),d.imageMode=!1),a(this).toggleClass("active").trigger("blur");var f,g=a(this).attr("data-name");return b.commands[g]?f=b.commands[g].refreshOnShow:d.options.customDropdowns[g]?f=d.options.customDropdowns[g].refreshOnShow:b.image_commands[g]&&(f=b.image_commands[g].refreshOnShow),f&&f.call(d),c.find("button.fr-trigger").not(this).removeClass("active"),!1}),c.on(this.mouseup,".fr-dropdown",function(a){a.stopPropagation(),a.preventDefault()}),this.$element.on("mouseup","img, a",a.proxy(function(){return this.isDisabled?!1:void c.find(".fr-dropdown .fr-trigger").removeClass("active")},this)),c.on("click","li[data-cmd] > a",function(a){a.preventDefault()})},b.prototype.bindCommandEvents=function(b){var c=this;b.on(this.mousedown,"button[data-cmd], li[data-cmd], span[data-cmd], a[data-cmd]",function(b){return"mousedown"===b.type&&1!==b.which?!0:("LI"===this.tagName&&"touchstart"===b.type&&c.android()||c.iOS()||b.preventDefault(),void a(this).attr("data-down",!0))}),b.on(this.mouseup+" "+this.move,"button[data-cmd], li[data-cmd], span[data-cmd], a[data-cmd]",a.proxy(function(b){if(c.isDisabled)return!1;if("mouseup"===b.type&&1!==b.which)return!0;var d=b.currentTarget;if("touchmove"!=b.type){if(b.stopPropagation(),b.preventDefault(),!a(d).attr("data-down"))return a("[data-down]").removeAttr("data-down"),!1;if(a("[data-down]").removeAttr("data-down"),a(d).data("dragging")||a(d).attr("disabled"))return a(d).removeData("dragging"),!1;var e=a(d).data("timeout");e&&(clearTimeout(e),a(d).removeData("timeout"));var f=a(d).attr("data-callback");if(c.options.inlineMode===!1&&0===a(d).parents(".froala-popup").length&&(c.hide(),c.closeImageMode(),c.imageMode=!1),f)a(d).parents(".fr-dropdown").find(".fr-trigger.active").removeClass("active"),c[f]();else{var g=a(d).attr("data-namespace"),h=a(d).attr("data-cmd"),i=a(d).attr("data-val"),j=a(d).attr("data-param");g?c["exec"+g](h,i,j):(c.exec(h,i,j),c.$bttn_wrapper.find(".fr-dropdown .fr-trigger").removeClass("active"))}return!1}a(d).data("timeout")||a(d).data("timeout",setTimeout(function(){a(d).data("dragging",!0)},200))},this))},b.prototype.save=function(){if(!this.triggerEvent("beforeSave",[],!1))return!1;if(this.options.saveURL){var b={};for(var c in this.options.saveParams){var d=this.options.saveParams[c];b[c]="function"==typeof d?d.call(this):d}var e={};e[this.options.saveParam]=this.getHTML(),a.ajax({type:this.options.saveRequestType,url:this.options.saveURL,data:a.extend(e,b),crossDomain:this.options.crossDomain,xhrFields:{withCredentials:this.options.withCredentials},headers:this.options.headers}).done(a.proxy(function(a){this.triggerEvent("afterSave",[a])},this)).fail(a.proxy(function(){this.triggerEvent("saveError",["Save request failed on the server."])},this))}else this.triggerEvent("saveError",["Missing save URL."])},b.prototype.isURL=function(a){if(!/^(https?:|ftps?:|)\/\//.test(a))return!1;a=String(a).replace(/</g,"%3C").replace(/>/g,"%3E").replace(/"/g,"%22").replace(/ /g,"%20");var b=/\(?(?:(https?:|ftps?:|)\/\/)?(?:((?:[^\W\s]|\.|-|[:]{1})+)@{1})?((?:www.)?(?:[^\W\s]|\.|-)+[\.][^\W\s]{2,4}|(?:www.)?(?:[^\W\s]|\.|-)|localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::(\d*))?([\/]?[^\s\?]*[\/]{1})*(?:\/?([^\s\n\?\[\]\{\}\#]*(?:(?=\.)){1}|[^\s\n\?\[\]\{\}\.\#]*)?([\.]{1}[^\s\?\#]*)?)?(?:\?{1}([^\s\n\#\[\]]*))?([\#][^\s\n]*)?\)?/gi;return b.test(a)},b.prototype.sanitizeURL=function(a){if(/^(https?:|ftps?:|)\/\//.test(a)){if(!this.isURL(a))return""}else a=encodeURIComponent(a).replace(/%23/g,"#").replace(/%2F/g,"/").replace(/%25/g,"%").replace(/mailto%3A/g,"mailto:").replace(/tel%3A/g,"tel:").replace(/data%3Aimage/g,"data:image").replace(/webkit-fake-url%3A/g,"webkit-fake-url:").replace(/%3F/g,"?").replace(/%3D/g,"=").replace(/%26/g,"&").replace(/&amp;/g,"&").replace(/%2C/g,",").replace(/%3B/g,";").replace(/%2B/g,"+").replace(/%40/g,"@");return a},b.prototype.parents=function(a,b){return a.get(0)!=this.$element.get(0)?a.parentsUntil(this.$element,b):[]},b.prototype.option=function(b,c){if(void 0===b)return this.options;if(b instanceof Object)this.options=a.extend({},this.options,b),this.initOptions(),this.setCustomText(),this.setLanguage(),this.setAllowScript(),this.setAllowStyle();else{if(void 0===c)return this.options[b];switch(this.options[b]=c,b){case"direction":this.setDirection();break;case"height":case"width":case"minHeight":case"maxHeight":this.setDimensions();break;case"spellcheck":this.setSpellcheck();break;case"placeholder":this.setPlaceholder();break;case"customText":this.setCustomText();break;case"language":this.setLanguage();break;case"textNearImage":this.setTextNearImage();break;case"zIndex":this.setZIndex();break;case"theme":this.setTheme();break;case"allowScript":this.setAllowScript();break;case"allowStyle":this.setAllowStyle()}}};var c=a.fn.editable;a.fn.editable=function(c){for(var d=[],e=0;e<arguments.length;e++)d.push(arguments[e]);if("string"==typeof c){var f=[];return this.each(function(){var b=a(this),e=b.data("fa.editable");if(!e[c])return a.error("Method "+c+" does not exist in Froala Editor.");var g=e[c].apply(e,d.slice(1));void 0===g?f.push(this):0===f.length&&f.push(g)}),1==f.length?f[0]:f}return"object"!=typeof c&&c?void 0:this.each(function(){var d=this,e=a(d),f=e.data("fa.editable");f||e.data("fa.editable",f=new b(d,c))})},a.fn.editable.Constructor=b,a.Editable=b,a.fn.editable.noConflict=function(){return a.fn.editable=c,this}}(window.jQuery),function(a){a.Editable.prototype.initUndoRedo=function(){this.undoStack=[],this.undoIndex=0,this.saveUndoStep(),this.disableBrowserUndo()},a.Editable.prototype.undo=function(){if(this.no_verify=!0,this.undoIndex>1){clearTimeout(this.typingTimer),this.triggerEvent("beforeUndo",[],!1);var a=this.undoStack[--this.undoIndex-1];this.restoreSnapshot(a),this.doingRedo=!0,this.triggerEvent("afterUndo",[]),this.doingRedo=!1,""!==this.text()?this.repositionEditor():this.hide(),this.$element.trigger("placeholderCheck"),this.focus(),this.refreshButtons()}this.no_verify=!1},a.Editable.prototype.redo=function(){if(this.no_verify=!0,this.undoIndex<this.undoStack.length){clearTimeout(this.typingTimer),this.triggerEvent("beforeRedo",[],!1);var a=this.undoStack[this.undoIndex++];this.restoreSnapshot(a),this.doingRedo=!0,this.triggerEvent("afterRedo",[]),this.doingRedo=!1,""!==this.text()?this.repositionEditor():this.hide(),this.$element.trigger("placeholderCheck"),this.focus(),this.refreshButtons()}this.no_verify=!1},a.Editable.prototype.saveUndoStep=function(){if(!this.undoStack)return!1;for(;this.undoStack.length>this.undoIndex;)this.undoStack.pop();var a=this.getSnapshot();this.undoStack[this.undoIndex-1]&&this.identicSnapshots(this.undoStack[this.undoIndex-1],a)||(this.undoStack.push(a),this.undoIndex++),this.refreshUndo(),this.refreshRedo()},a.Editable.prototype.refreshUndo=function(){if(this.isEnabled("undo")){if(void 0===this.$editor)return;this.$bttn_wrapper.find('[data-cmd="undo"]').removeAttr("disabled"),(0===this.undoStack.length||this.undoIndex<=1||this.isHTML)&&this.$bttn_wrapper.find('[data-cmd="undo"]').attr("disabled",!0)}},a.Editable.prototype.refreshRedo=function(){if(this.isEnabled("redo")){if(void 0===this.$editor)return;this.$bttn_wrapper.find('[data-cmd="redo"]').removeAttr("disabled"),(this.undoIndex==this.undoStack.length||this.isHTML)&&this.$bttn_wrapper.find('[data-cmd="redo"]').prop("disabled",!0)}},a.Editable.prototype.getNodeIndex=function(a){for(var b=a.parentNode.childNodes,c=0,d=null,e=0;e<b.length;e++){if(d){var f=3===b[e].nodeType&&""===b[e].textContent,g=3===d.nodeType&&3===b[e].nodeType;f||g||c++}if(b[e]==a)return c;d=b[e]}},a.Editable.prototype.getNodeLocation=function(a){var b=[];if(!a.parentNode)return[];for(;a!=this.$element.get(0);)b.push(this.getNodeIndex(a)),a=a.parentNode;return b.reverse()},a.Editable.prototype.getNodeByLocation=function(a){for(var b=this.$element.get(0),c=0;c<a.length;c++)b=b.childNodes[a[c]];return b},a.Editable.prototype.getRealNodeOffset=function(a,b){for(;a&&3===a.nodeType;){var c=a.previousSibling;c&&3==c.nodeType&&(b+=c.textContent.length),a=c}return b},a.Editable.prototype.getRangeSnapshot=function(a){return{scLoc:this.getNodeLocation(a.startContainer),scOffset:this.getRealNodeOffset(a.startContainer,a.startOffset),ecLoc:this.getNodeLocation(a.endContainer),ecOffset:this.getRealNodeOffset(a.endContainer,a.endOffset)}},a.Editable.prototype.getSnapshot=function(){var a={};if(a.html=this.$element.html(),a.ranges=[],this.selectionInEditor()&&this.$element.is(":focus"))for(var b=this.getRanges(),c=0;c<b.length;c++)a.ranges.push(this.getRangeSnapshot(b[c]));return a},a.Editable.prototype.identicSnapshots=function(a,b){return a.html!=b.html?!1:JSON.stringify(a.ranges)!=JSON.stringify(b.ranges)?!1:!0},a.Editable.prototype.restoreRangeSnapshot=function(a,b){try{var c=this.getNodeByLocation(a.scLoc),d=a.scOffset,e=this.getNodeByLocation(a.ecLoc),f=a.ecOffset,g=this.document.createRange();g.setStart(c,d),g.setEnd(e,f),b.addRange(g)}catch(h){}},a.Editable.prototype.restoreSnapshot=function(b){this.$element.html()!=b.html&&this.$element.html(b.html);var c=this.getSelection();this.clearSelection(),this.$element.focus();for(var d=0;d<b.ranges.length;d++)this.restoreRangeSnapshot(b.ranges[d],c);setTimeout(a.proxy(function(){this.$element.find(".f-img-wrap img").click()},this),0)}}(jQuery),function(a){a.Editable.prototype.refreshButtons=function(b){return this.initialized&&(this.selectionInEditor()&&!this.isHTML||this.browser.msie&&a.Editable.getIEversion()<9||b)?(this.$editor.find("button[data-cmd]").removeClass("active"),this.refreshDisabledState(),void this.raiseEvent("refresh")):!1},a.Editable.prototype.refreshDisabledState=function(){if(this.isHTML)return!1;if(this.$editor){for(var b=0;b<this.options.buttons.length;b++){var c=this.options.buttons[b];if(void 0!==a.Editable.commands[c]){var d=!1;a.isFunction(a.Editable.commands[c].disabled)?d=a.Editable.commands[c].disabled.apply(this):void 0!==a.Editable.commands[c].disabled&&(d=!0),d?(this.$editor.find('button[data-cmd="'+c+'"]').prop("disabled",!0),this.$editor.find('button[data-name="'+c+'"]').prop("disabled",!0)):(this.$editor.find('button[data-cmd="'+c+'"]').removeAttr("disabled"),this.$editor.find('button[data-name="'+c+'"]').removeAttr("disabled"))}}this.refreshUndo(),this.refreshRedo()}},a.Editable.prototype.refreshFormatBlocks=function(){var a=this.getSelectionElements()[0],b=a.tagName.toLowerCase();this.options.paragraphy&&b===this.options.defaultTag.toLowerCase()&&(b="n"),this.$editor.find('.fr-bttn > button[data-name="formatBlock"] + ul li').removeClass("active"),this.$bttn_wrapper.find('.fr-bttn > button[data-name="formatBlock"] + ul li[data-val="'+b+'"]').addClass("active")},a.Editable.prototype.refreshDefault=function(a){try{this.document.queryCommandState(a)===!0&&this.$editor.find('[data-cmd="'+a+'"]').addClass("active")}catch(b){}},a.Editable.prototype.refreshAlign=function(){var b=a(this.getSelectionElements()[0]);this.$editor.find('.fr-dropdown > button[data-name="align"] + ul li').removeClass("active");var c,d=b.css("text-align");["left","right","justify","center"].indexOf(d)<0&&(d="left"),"left"==d?c="justifyLeft":"right"==d?c="justifyRight":"justify"==d?c="justifyFull":"center"==d&&(c="justifyCenter"),this.$editor.find('.fr-dropdown > button[data-name="align"].fr-trigger i').attr("class","fa fa-align-"+d),this.$editor.find('.fr-dropdown > button[data-name="align"] + ul li[data-val="'+c+'"]').addClass("active")},a.Editable.prototype.refreshHTML=function(){this.isActive("html")?this.$editor.find('[data-cmd="html"]').addClass("active"):this.$editor.find('[data-cmd="html"]').removeClass("active")}}(jQuery),function(a){a.Editable.commands={bold:{title:"Bold",icon:"fa fa-bold",shortcut:"(Ctrl + B)",refresh:a.Editable.prototype.refreshDefault,undo:!0,callbackWithoutSelection:function(a){this._startInDefault(a)}},italic:{title:"Italic",icon:"fa fa-italic",shortcut:"(Ctrl + I)",refresh:a.Editable.prototype.refreshDefault,undo:!0,callbackWithoutSelection:function(a){this._startInDefault(a)}},underline:{cmd:"underline",title:"Underline",icon:"fa fa-underline",shortcut:"(Ctrl + U)",refresh:a.Editable.prototype.refreshDefault,undo:!0,callbackWithoutSelection:function(a){this._startInDefault(a)}},strikeThrough:{title:"Strikethrough",icon:"fa fa-strikethrough",refresh:a.Editable.prototype.refreshDefault,undo:!0,callbackWithoutSelection:function(a){this._startInDefault(a)}},subscript:{title:"Subscript",icon:"fa fa-subscript",refresh:a.Editable.prototype.refreshDefault,undo:!0,callbackWithoutSelection:function(a){this._startInDefault(a)}},superscript:{title:"Superscript",icon:"fa fa-superscript",refresh:a.Editable.prototype.refreshDefault,undo:!0,callbackWithoutSelection:function(a){this._startInDefault(a)}},formatBlock:{title:"Format Block",icon:"fa fa-paragraph",refreshOnShow:a.Editable.prototype.refreshFormatBlocks,callback:function(a,b){this.formatBlock(b)},undo:!0},align:{title:"Alignment",icon:"fa fa-align-left",refresh:a.Editable.prototype.refreshAlign,refreshOnShow:a.Editable.prototype.refreshAlign,seed:[{cmd:"justifyLeft",title:"Align Left",icon:"fa fa-align-left"},{cmd:"justifyCenter",title:"Align Center",icon:"fa fa-align-center"},{cmd:"justifyRight",title:"Align Right",icon:"fa fa-align-right"},{cmd:"justifyFull",title:"Justify",icon:"fa fa-align-justify"}],callback:function(a,b){this.align(b)},undo:!0},outdent:{title:"Indent Less",icon:"fa fa-dedent",activeless:!0,shortcut:"(Ctrl + <)",callback:function(){this.outdent(!0)},undo:!0},indent:{title:"Indent More",icon:"fa fa-indent",activeless:!0,shortcut:"(Ctrl + >)",callback:function(){this.indent()},undo:!0},selectAll:{title:"Select All",icon:"fa fa-file-text",shortcut:"(Ctrl + A)",callback:function(a,b){this.$element.focus(),this.execDefault(a,b)},undo:!1},createLink:{title:"Insert Link",icon:"fa fa-link",shortcut:"(Ctrl + K)",callback:function(){this.insertLink()},undo:!1},insertImage:{title:"Insert Image",icon:"fa fa-picture-o",activeless:!0,shortcut:"(Ctrl + P)",callback:function(){this.insertImage()},undo:!1},undo:{title:"Undo",icon:"fa fa-undo",activeless:!0,shortcut:"(Ctrl+Z)",refresh:a.Editable.prototype.refreshUndo,callback:function(){this.undo()},undo:!1},redo:{title:"Redo",icon:"fa fa-repeat",activeless:!0,shortcut:"(Shift+Ctrl+Z)",refresh:a.Editable.prototype.refreshRedo,callback:function(){this.redo()},undo:!1},html:{title:"Show HTML",icon:"fa fa-code",refresh:a.Editable.prototype.refreshHTML,callback:function(){this.html()},undo:!1},save:{title:"Save",icon:"fa fa-floppy-o",callback:function(){this.save()},undo:!1},insertHorizontalRule:{title:"Insert Horizontal Line",icon:"fa fa-minus",callback:function(a){this.insertHR(a)},undo:!0},removeFormat:{title:"Clear formatting",icon:"fa fa-eraser",activeless:!0,callback:function(){this.removeFormat()},undo:!0}},a.Editable.prototype.exec=function(b,c,d){return!this.selectionInEditor()&&a.Editable.commands[b].undo&&this.focus(),this.selectionInEditor()&&""===this.text()&&a.Editable.commands[b].callbackWithoutSelection?(a.Editable.commands[b].callbackWithoutSelection.apply(this,[b,c,d]),!1):void(a.Editable.commands[b].callback?a.Editable.commands[b].callback.apply(this,[b,c,d]):this.execDefault(b,c))},a.Editable.prototype.html=function(){var a;this.isHTML?(this.isHTML=!1,a=this.$html_area.val(),this.$box.removeClass("f-html"),this.$element.attr("contenteditable",!0),this.setHTML(a,!1),this.$editor.find('.fr-bttn:not([data-cmd="html"]), .fr-trigger').removeAttr("disabled"),this.$editor.find('.fr-bttn[data-cmd="html"]').removeClass("active"),this.$element.blur(),this.focus(),this.refreshButtons(),this.triggerEvent("htmlHide",[a],!0,!1)):(this.$box.removeClass("f-placeholder"),this.clearSelection(),this.cleanify(!1,!0,!1),a=this.cleanTags(this.getHTML(!1,!1)),this.$html_area.val(a).trigger("resize"),this.$html_area.css("height",this.$element.height()-1),this.$element.html("").append(this.$html_area).removeAttr("contenteditable"),this.$box.addClass("f-html"),this.$editor.find('button.fr-bttn:not([data-cmd="html"]), button.fr-trigger').attr("disabled",!0),this.$editor.find('.fr-bttn[data-cmd="html"]').addClass("active"),this.isHTML=!0,this.hide(),this.imageMode=!1,this.$element.blur(),this.$element.removeAttr("contenteditable"),this.triggerEvent("htmlShow",[a],!0,!1))},a.Editable.prototype.insertHR=function(b){this.$element.find("hr").addClass("fr-tag"),this.$element.hasClass("f-placeholder")?a(this.$element.find("> "+this.valid_nodes.join(", >"))[0]).before("<hr/>"):this.document.execCommand(b),this.hide();var c=this.$element.find("hr:not(.fr-tag)").next(this.valid_nodes.join(","));c.length>0?a(c[0]).prepend(this.markers_html):this.$element.find("hr:not(.fr-tag)").after(this.options.paragraphy?"<p>"+this.markers_html+"<br/></p>":this.markers_html),this.restoreSelectionByMarkers(),this.triggerEvent(b,[],!0,!1)},a.Editable.prototype.formatBlock=function(b){if(this.disabledList.indexOf("formatBlock")>=0)return!1;if(this.browser.msie&&a.Editable.getIEversion()<9)return"n"==b&&(b=this.options.defaultTag),this.document.execCommand("formatBlock",!1,"<"+b+">"),this.triggerEvent("formatBlock"),!1;if(this.$element.hasClass("f-placeholder")){if(this.options.paragraphy||"n"!=b){"n"==b&&(b=this.options.defaultTag);var c=a("<"+b+"><br/></"+b+">");this.$element.html(c),this.setSelection(c.get(0),0),this.$element.removeClass("f-placeholder")}}else{this.saveSelectionByMarkers(),this.wrapText(),this.restoreSelectionByMarkers();var d=this.getSelectionElements();d[0]==this.$element.get(0)&&(d=this.$element.find("> "+this.valid_nodes.join(", >"))),this.saveSelectionByMarkers();for(var e,f=function(b){if("PRE"==b.get(0).tagName)for(;b.find("br + br").length>0;){var c=a(b.find("br + br")[0]);c.prev().remove(),c.replaceWith("\n\n")}},g=0;g<d.length;g++){var h=a(d[g]);if(!this.fakeEmpty(h)){if(f(h),!this.options.paragraphy&&this.emptyElement(h.get(0))&&h.append("<br/>"),"n"==b)if(this.options.paragraphy){var i="<"+this.options.defaultTag+this.attrs(h.get(0))+">"+h.html()+"</"+this.options.defaultTag+">";e=a(i)}else e=h.html()+"<br/>";else e=a("<"+b+this.attrs(h.get(0))+">").html(h.html());h.get(0)!=this.$element.get(0)?h.replaceWith(e):h.html(e)}}this.unwrapText(),this.$element.find("pre + pre").each(function(){a(this).prepend(a(this).prev().html()+"<br/><br/>"),a(this).prev().remove()});var j=this;this.$element.find(this.valid_nodes.join(",")).each(function(){"PRE"!=this.tagName&&a(this).replaceWith("<"+this.tagName+j.attrs(this)+">"+a(this).html().replace(/\n\n/gi,"</"+this.tagName+"><"+this.tagName+">")+"</"+this.tagName+">")}),this.$element.find(this.valid_nodes.join(":empty ,")+":empty").append("<br/>"),this.cleanupLists(),this.restoreSelectionByMarkers()}this.triggerEvent("formatBlock"),this.repositionEditor()},a.Editable.prototype.align=function(b){if(this.browser.msie&&a.Editable.getIEversion()<9)return this.document.execCommand(b,!1,!1),this.triggerEvent("align",[b]),!1;this.saveSelectionByMarkers(),this.wrapText(),this.restoreSelectionByMarkers(),this.saveSelectionByMarkers();var c=this.getSelectionElements();"justifyLeft"==b?b="left":"justifyRight"==b?b="right":"justifyCenter"==b?b="center":"justifyFull"==b&&(b="justify");for(var d=0;d<c.length;d++)this.parents(a(c[d]),"LI").length>0&&(c[d]=a(c[d]).parents("LI").get(0)),a(c[d]).css("text-align",b);this.cleanupLists(),this.unwrapText(),this.restoreSelectionByMarkers(),this.repositionEditor(),this.triggerEvent("align",[b])},a.Editable.prototype.indent=function(b,c){if(void 0===c&&(c=!0),this.browser.msie&&a.Editable.getIEversion()<9)return b?this.document.execCommand("outdent",!1,!1):this.document.execCommand("indent",!1,!1),!1;var d=20;b&&(d=-20),this.saveSelectionByMarkers(),this.wrapText(),this.restoreSelectionByMarkers();var e=this.getSelectionElements();this.saveSelectionByMarkers();for(var f=0;f<e.length;f++)a(e[f]).parentsUntil(this.$element,"li").length>0&&(e[f]=a(e[f]).closest("li").get(0));for(var g=0;g<e.length;g++){var h=a(e[g]);if(this.raiseEvent("indent",[h,b]))if(h.get(0)!=this.$element.get(0)){var i=parseInt(h.css("margin-left"),10),j=Math.max(0,i+d);h.css("marginLeft",j),0===j&&(h.css("marginLeft",""),void 0===h.css("style")&&h.removeAttr("style"))}else{var k=a("<div>").html(h.html());h.html(k),k.css("marginLeft",Math.max(0,d)),0===Math.max(0,d)&&(k.css("marginLeft",""),void 0===k.css("style")&&k.removeAttr("style"))}}this.unwrapText(),this.restoreSelectionByMarkers(),c&&this.repositionEditor(),b||this.triggerEvent("indent")},a.Editable.prototype.outdent=function(a){this.indent(!0,a),this.triggerEvent("outdent")},a.Editable.prototype.execDefault=function(a,b){this.saveUndoStep(),this.document.execCommand(a,!1,b),this.triggerEvent(a,[],!0,!0)},a.Editable.prototype._startInDefault=function(a){this.focus(),this.document.execCommand(a,!1,!1),this.refreshButtons()},a.Editable.prototype._startInFontExec=function(b,c,d){this.focus();try{var e=this.getRange(),f=e.cloneRange();f.collapse(!1);var g=a('<span data-inserted="true" data-fr-verified="true" style="'+b+": "+d+';">'+a.Editable.INVISIBLE_SPACE+"</span>",this.document);f.insertNode(g[0]),g=this.$element.find("[data-inserted]"),g.removeAttr("data-inserted"),this.setSelection(g.get(0),1),null!=c&&this.triggerEvent(c,[d],!0,!0)}catch(h){}},a.Editable.prototype.removeFormat=function(){this.document.execCommand("removeFormat",!1,!1),this.document.execCommand("unlink",!1,!1),this.refreshButtons()},a.Editable.prototype.inlineStyle=function(b,c,d){if(this.browser.webkit){var e=function(a){return a.attr("style").indexOf("font-size")>=0};this.$element.find("[style]").each(function(b,c){var d=a(c);e(d)&&(d.attr("data-font-size",d.css("font-size")),d.css("font-size",""))})}this.document.execCommand("fontSize",!1,4),this.saveSelectionByMarkers(),this.browser.webkit&&this.$element.find("[data-font-size]").each(function(b,c){var d=a(c);d.css("font-size",d.attr("data-font-size")),d.removeAttr("data-font-size")});var f=function(c){var e=a(c);e.css(b)!=d&&e.css(b,""),""===e.attr("style")&&e.replaceWith(e.html())};this.$element.find("font").each(function(c,e){var g=a('<span data-fr-verified="true" style="'+b+": "+d+';">'+a(e).html()+"</span>");a(e).replaceWith(g);for(var h=g.find("span"),i=h.length-1;i>=0;i--)f(h[i])}),this.removeBlankSpans(),this.restoreSelectionByMarkers(),this.repositionEditor(),null!=c&&this.triggerEvent(c,[d],!0,!0)}}(jQuery),function(a){a.Editable.prototype.addListener=function(a,b){var c=this._events,d=c[a]=c[a]||[];d.push(b)},a.Editable.prototype.raiseEvent=function(a,b){void 0===b&&(b=[]);var c=!0,d=this._events[a];if(d)for(var e=0,f=d.length;f>e;e++){var g=d[e].apply(this,b);void 0!==g&&c!==!1&&(c=g)}return void 0===c&&(c=!0),c}}(jQuery),function(a){a.Editable.prototype.start_marker='<span class="f-marker" data-id="0" data-fr-verified="true" data-type="true"></span>',a.Editable.prototype.end_marker='<span class="f-marker" data-id="0" data-fr-verified="true" data-type="false"></span>',a.Editable.prototype.markers_html='<span class="f-marker" data-id="0" data-fr-verified="true" data-type="false"></span><span class="f-marker" data-id="0" data-fr-verified="true" data-type="true"></span>',a.Editable.prototype.text=function(){var a="";
return this.window.getSelection?a=this.window.getSelection():this.document.getSelection?a=this.document.getSelection():this.document.selection&&(a=this.document.selection.createRange().text),a.toString()},a.Editable.prototype.selectionInEditor=function(){var b=this.getSelectionParent(),c=!1;return b==this.$element.get(0)&&(c=!0),c===!1&&a(b).parents().each(a.proxy(function(a,b){b==this.$element.get(0)&&(c=!0)},this)),c},a.Editable.prototype.getSelection=function(){var a="";return a=this.window.getSelection?this.window.getSelection():this.document.getSelection?this.document.getSelection():this.document.selection.createRange()},a.Editable.prototype.getRange=function(){var a=this.getRanges();return a.length>0?a[0]:null},a.Editable.prototype.getRanges=function(){var a=this.getSelection();if(a.getRangeAt&&a.rangeCount){for(var b=[],c=0;c<a.rangeCount;c++)b.push(a.getRangeAt(c));return b}return this.document.createRange?[this.document.createRange()]:[]},a.Editable.prototype.clearSelection=function(){var a=this.getSelection();try{a.removeAllRanges?a.removeAllRanges():a.empty?a.empty():a.clear&&a.clear()}catch(b){}},a.Editable.prototype.getSelectionElement=function(){var b=this.getSelection();if(b&&b.rangeCount){var c=this.getRange(),d=c.startContainer;if(1==d.nodeType){var e=!1;d.childNodes.length>0&&d.childNodes[c.startOffset]&&a(d.childNodes[c.startOffset]).text()===this.text()&&(d=d.childNodes[c.startOffset],e=!0),!e&&d.childNodes.length>0&&a(d.childNodes[0]).text()===this.text()&&["BR","IMG","HR"].indexOf(d.childNodes[0].tagName)<0&&(d=d.childNodes[0])}for(;1!=d.nodeType&&d.parentNode;)d=d.parentNode;for(var f=d;f&&"BODY"!=f.tagName;){if(f==this.$element.get(0))return d;f=a(f).parent()[0]}}return this.$element.get(0)},a.Editable.prototype.getSelectionParent=function(){var b,c=null;return this.window.getSelection?(b=this.window.getSelection(),b&&b.rangeCount&&(c=b.getRangeAt(0).commonAncestorContainer,1!=c.nodeType&&(c=c.parentNode))):(b=this.document.selection)&&"Control"!=b.type&&(c=b.createRange().parentElement()),null!=c&&(a.inArray(this.$element.get(0),a(c).parents())>=0||c==this.$element.get(0))?c:null},a.Editable.prototype.nodeInRange=function(a,b){var c;if(a.intersectsNode)return a.intersectsNode(b);c=b.ownerthis.document.createRange();try{c.selectNode(b)}catch(d){c.selectNodeContents(b)}return-1==a.compareBoundaryPoints(Range.END_TO_START,c)&&1==a.compareBoundaryPoints(Range.START_TO_END,c)},a.Editable.prototype.getElementFromNode=function(b){for(1!=b.nodeType&&(b=b.parentNode);null!==b&&this.valid_nodes.indexOf(b.tagName)<0;)b=b.parentNode;return null!=b&&"LI"==b.tagName&&a(b).find(this.valid_nodes.join(",")).not("li").length>0?null:a.makeArray(a(b).parents()).indexOf(this.$element.get(0))>=0?b:null},a.Editable.prototype.nextNode=function(a,b){if(a.hasChildNodes())return a.firstChild;for(;a&&!a.nextSibling&&a!=b;)a=a.parentNode;return a&&a!=b?a.nextSibling:null},a.Editable.prototype.getRangeSelectedNodes=function(a){var b=[],c=a.startContainer,d=a.endContainer;if(c==d&&"TR"!=c.tagName){if(c.hasChildNodes()&&0!==c.childNodes.length){for(var e=c.childNodes,f=a.startOffset;f<a.endOffset;f++)e[f]&&b.push(e[f]);return 0===b.length&&b.push(c),b}return[c]}if(c==d&&"TR"==c.tagName){var g=c.childNodes,h=a.startOffset;if(g.length>h&&h>=0){var i=g[h];if("TD"==i.tagName||"TH"==i.tagName)return[i]}}for(;c&&c!=d;)c=this.nextNode(c,d),(c!=d||a.endOffset>0)&&b.push(c);for(c=a.startContainer;c&&c!=a.commonAncestorContainer;)b.unshift(c),c=c.parentNode;return b},a.Editable.prototype.getSelectedNodes=function(){if(this.window.getSelection){var b=this.window.getSelection();if(!b.isCollapsed){for(var c=this.getRanges(),d=[],e=0;e<c.length;e++)d=a.merge(d,this.getRangeSelectedNodes(c[e]));return d}if(this.selectionInEditor()){var f=b.getRangeAt(0).startContainer;return 3==f.nodeType?[f.parentNode]:[f]}}return[]},a.Editable.prototype.getSelectionElements=function(){var b=this.getSelectedNodes(),c=[];return a.each(b,a.proxy(function(a,b){if(null!==b){var d=this.getElementFromNode(b);c.indexOf(d)<0&&d!=this.$element.get(0)&&null!==d&&c.push(d)}},this)),0===c.length&&c.push(this.$element.get(0)),c},a.Editable.prototype.getSelectionLink=function(){var b=this.getSelectionLinks();return b.length>0?a(b[0]).attr("href"):null},a.Editable.prototype.saveSelection=function(){if(!this.selectionDisabled){this.savedRanges=[];for(var a=this.getRanges(),b=0;b<a.length;b++)this.savedRanges.push(a[b].cloneRange())}},a.Editable.prototype.restoreSelection=function(){if(!this.selectionDisabled){var a,b,c=this.getSelection();if(this.savedRanges&&this.savedRanges.length)for(c.removeAllRanges(),a=0,b=this.savedRanges.length;b>a;a+=1)c.addRange(this.savedRanges[a]);this.savedRanges=null}},a.Editable.prototype.insertMarkersAtPoint=function(a){var b=a.clientX,c=a.clientY;this.removeMarkers();var d,e=null;if("undefined"!=typeof this.document.caretPositionFromPoint?(d=this.document.caretPositionFromPoint(b,c),e=this.document.createRange(),e.setStart(d.offsetNode,d.offset),e.setEnd(d.offsetNode,d.offset)):"undefined"!=typeof this.document.caretRangeFromPoint&&(d=this.document.caretRangeFromPoint(b,c),e=this.document.createRange(),e.setStart(d.startContainer,d.startOffset),e.setEnd(d.startContainer,d.startOffset)),null!==e&&"undefined"!=typeof this.window.getSelection){var f=this.window.getSelection();f.removeAllRanges(),f.addRange(e)}else if("undefined"!=typeof this.document.body.createTextRange)try{e=this.document.body.createTextRange(),e.moveToPoint(b,c);var g=e.duplicate();g.moveToPoint(b,c),e.setEndPoint("EndToEnd",g),e.select()}catch(h){}this.placeMarker(e,!0,0),this.placeMarker(e,!1,0)},a.Editable.prototype.saveSelectionByMarkers=function(){if(!this.selectionDisabled){this.selectionInEditor()||this.focus(),this.removeMarkers();for(var a=this.getRanges(),b=0;b<a.length;b++)if(a[b].startContainer!==this.document){var c=a[b];this.placeMarker(c,!0,b),this.placeMarker(c,!1,b)}}},a.Editable.prototype.hasSelectionByMarkers=function(){var a=this.$element.find('.f-marker[data-type="true"]');return a.length>0?!0:!1},a.Editable.prototype.restoreSelectionByMarkers=function(b){if(void 0===b&&(b=!0),!this.selectionDisabled){var c=this.$element.find('.f-marker[data-type="true"]');if(0===c.length)return!1;this.$element.is(":focus")||this.browser.msie||this.$element.focus();var d=this.getSelection();(b||this.getRange()&&!this.getRange().collapsed||!a(c[0]).attr("data-collapsed"))&&(this.browser.msie&&a.Editable.getIEversion()<9||(this.clearSelection(),b=!0));for(var e=0;e<c.length;e++){var f=a(c[e]).data("id"),g=c[e],h=this.$element.find('.f-marker[data-type="false"][data-id="'+f+'"]');if(this.browser.msie&&a.Editable.getIEversion()<9)return this.setSelection(g,0,h,0),this.removeMarkers(),!1;var i;if(i=b?this.document.createRange():this.getRange(),h.length>0){h=h[0];try{i.setStartAfter(g),i.setEndBefore(h)}catch(j){}}b&&d.addRange(i)}this.removeMarkers()}},a.Editable.prototype.setSelection=function(a,b,c,d){var e=this.getSelection();if(e){this.clearSelection();try{c||(c=a),void 0===b&&(b=0),void 0===d&&(d=b);var f=this.getRange();f.setStart(a,b),f.setEnd(c,d),e.addRange(f)}catch(g){}}},a.Editable.prototype.buildMarker=function(b,c,d){return void 0===d&&(d=""),a('<span class="f-marker"'+d+' style="display:none; line-height: 0;" data-fr-verified="true" data-id="'+c+'" data-type="'+b+'">',this.document)[0]},a.Editable.prototype.placeMarker=function(b,c,d){var e="";b.collapsed&&(e=' data-collapsed="true"');try{var f=b.cloneRange();f.collapse(c);var g,h,i;if(f.insertNode(this.buildMarker(c,d,e)),c===!0&&e)for(g=this.$element.find('span.f-marker[data-type="true"][data-id="'+d+'"]').get(0).nextSibling;3===g.nodeType&&0===g.data.length;)a(g).remove(),g=this.$element.find('span.f-marker[data-type="true"][data-id="'+d+'"]').get(0).nextSibling;if(c===!0&&""===e&&(i=this.$element.find('span.f-marker[data-type="true"][data-id="'+d+'"]').get(0),g=i.nextSibling,g&&g.nodeType===Node.ELEMENT_NODE&&this.valid_nodes.indexOf(g.tagName)>=0)){h=[g];do g=h[0],h=a(g).contents();while(h[0]&&this.valid_nodes.indexOf(h[0].tagName)>=0);a(g).prepend(a(i))}if(c===!1&&""===e&&(i=this.$element.find('span.f-marker[data-type="false"][data-id="'+d+'"]').get(0),g=i.previousSibling,g&&g.nodeType===Node.ELEMENT_NODE&&this.valid_nodes.indexOf(g.tagName)>=0)){h=[g];do g=h[h.length-1],h=a(g).contents();while(h[h.length-1]&&this.valid_nodes.indexOf(h[h.length-1].tagName)>=0);a(g).append(a(i))}}catch(j){}},a.Editable.prototype.removeMarkers=function(){this.$element.find(".f-marker").remove()},a.Editable.prototype.getSelectionTextInfo=function(a){var b,c,d=!1,e=!1;if(this.window.getSelection){var f=this.window.getSelection();f&&f.rangeCount&&(b=f.getRangeAt(0),c=b.cloneRange(),c.selectNodeContents(a),c.setEnd(b.startContainer,b.startOffset),d=""===c.toString(),c.selectNodeContents(a),c.setStart(b.endContainer,b.endOffset),e=""===c.toString())}else this.document.selection&&"Control"!=this.document.selection.type&&(b=this.document.selection.createRange(),c=b.duplicate(),c.moveToElementText(a),c.setEndPoint("EndToStart",b),d=""===c.text,c.moveToElementText(a),c.setEndPoint("StartToEnd",b),e=""===c.text);return{atStart:d,atEnd:e}},a.Editable.prototype.endsWith=function(a,b){return-1!==a.indexOf(b,a.length-b.length)}}(jQuery),function(a){a.Editable.hexToRGB=function(a){var b=/^#?([a-f\d])([a-f\d])([a-f\d])$/i;a=a.replace(b,function(a,b,c,d){return b+b+c+c+d+d});var c=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(a);return c?{r:parseInt(c[1],16),g:parseInt(c[2],16),b:parseInt(c[3],16)}:null},a.Editable.hexToRGBString=function(a){var b=this.hexToRGB(a);return b?"rgb("+b.r+", "+b.g+", "+b.b+")":""},a.Editable.RGBToHex=function(a){function b(a){return("0"+parseInt(a,10).toString(16)).slice(-2)}try{return a&&"transparent"!==a?/^#[0-9A-F]{6}$/i.test(a)?a:(a=a.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/),("#"+b(a[1])+b(a[2])+b(a[3])).toUpperCase()):""}catch(c){return null}},a.Editable.getIEversion=function(){var a,b,c=-1;return"Microsoft Internet Explorer"==navigator.appName?(a=navigator.userAgent,b=new RegExp("MSIE ([0-9]{1,}[\\.0-9]{0,})"),null!==b.exec(a)&&(c=parseFloat(RegExp.$1))):"Netscape"==navigator.appName&&(a=navigator.userAgent,b=new RegExp("Trident/.*rv:([0-9]{1,}[\\.0-9]{0,})"),null!==b.exec(a)&&(c=parseFloat(RegExp.$1))),c},a.Editable.browser=function(){var a={};if(this.getIEversion()>0)a.msie=!0;else{var b=navigator.userAgent.toLowerCase(),c=/(chrome)[ \/]([\w.]+)/.exec(b)||/(webkit)[ \/]([\w.]+)/.exec(b)||/(opera)(?:.*version|)[ \/]([\w.]+)/.exec(b)||/(msie) ([\w.]+)/.exec(b)||b.indexOf("compatible")<0&&/(mozilla)(?:.*? rv:([\w.]+)|)/.exec(b)||[],d={browser:c[1]||"",version:c[2]||"0"};c[1]&&(a[d.browser]=!0),parseInt(d.version,10)<9&&a.msie&&(a.oldMsie=!0),a.chrome?a.webkit=!0:a.webkit&&(a.safari=!0)}return a},a.Editable.isArray=function(a){return a&&!a.propertyIsEnumerable("length")&&"object"==typeof a&&"number"==typeof a.length},a.Editable.uniq=function(b){return a.grep(b,function(c,d){return d==a.inArray(c,b)})},a.Editable.cleanWhitespace=function(b){b.contents().filter(function(){return 1==this.nodeType&&a.Editable.cleanWhitespace(a(this)),3==this.nodeType&&!/\S/.test(this.nodeValue)}).remove()}}(jQuery),function(a){a.Editable.prototype.show=function(b){if(this.hideDropdowns(),void 0!==b){if(this.options.inlineMode||this.options.editInPopup)if(null!==b&&"touchend"!==b.type){if(this.options.showNextToCursor){var c=b.pageX,d=b.pageY;c<this.$element.offset().left&&(c=this.$element.offset().left),c>this.$element.offset().left+this.$element.width()&&(c=this.$element.offset().left+this.$element.width()),d<this.$element.offset.top&&(d=this.$element.offset().top),d>this.$element.offset().top+this.$element.height()&&(d=this.$element.offset().top+this.$element.height()),20>c&&(c=20),0>d&&(d=0),this.showByCoordinates(c,d)}else this.repositionEditor();a(".froala-editor:not(.f-basic)").hide(),this.$editor.show(),0!==this.options.buttons.length||this.options.editInPopup||this.$editor.hide()}else a(".froala-editor:not(.f-basic)").hide(),this.$editor.show(),this.repositionEditor();this.hidePopups(),this.options.editInPopup||this.showEditPopupWrapper(),this.$bttn_wrapper.show(),this.refreshButtons(),this.imageMode=!1}},a.Editable.prototype.hideDropdowns=function(){this.$bttn_wrapper.find(".fr-dropdown .fr-trigger").removeClass("active"),this.$bttn_wrapper.find(".fr-dropdown .fr-trigger")},a.Editable.prototype.hide=function(a){return this.initialized?(void 0===a&&(a=!0),a?this.hideOtherEditors():(this.closeImageMode(),this.imageMode=!1),this.$popup_editor.hide(),this.hidePopups(!1),void(this.link=!1)):!1},a.Editable.prototype.hideOtherEditors=function(){for(var b=1;b<=a.Editable.count;b++)b!=this._id&&this.$window.trigger("hide."+b)},a.Editable.prototype.hideBttnWrapper=function(){this.options.inlineMode&&this.$bttn_wrapper.hide()},a.Editable.prototype.showBttnWrapper=function(){this.options.inlineMode&&this.$bttn_wrapper.show()},a.Editable.prototype.showEditPopupWrapper=function(){this.$edit_popup_wrapper&&(this.$edit_popup_wrapper.show(),setTimeout(a.proxy(function(){this.$edit_popup_wrapper.find("input").val(this.$element.text()).focus().select()},this),1))},a.Editable.prototype.hidePopups=function(a){void 0===a&&(a=!0),a&&this.hideBttnWrapper(),this.raiseEvent("hidePopups")},a.Editable.prototype.showEditPopup=function(){this.showEditPopupWrapper()}}(jQuery),function(a){a.Editable.prototype.getBoundingRect=function(){var b;if(this.isLink){b={};var c=this.$element;b.left=c.offset().left-this.$window.scrollLeft(),b.top=c.offset().top-this.$window.scrollTop(),b.width=c.outerWidth(),b.height=parseInt(c.css("padding-top").replace("px",""),10)+c.height(),b.right=1,b.bottom=1,b.ok=!0}else if(this.getRange()&&this.getRange().collapsed){var d=a(this.getSelectionElement());this.saveSelectionByMarkers();var e=this.$element.find(".f-marker:first");e.css("display","inline");var f=e.offset();e.css("display","none"),b={},b.left=f.left-this.$window.scrollLeft(),b.width=0,b.height=(parseInt(d.css("line-height").replace("px",""),10)||10)-10-this.$window.scrollTop(),b.top=f.top,b.right=1,b.bottom=1,b.ok=!0,this.removeMarkers()}else this.getRange()&&(b=this.getRange().getBoundingClientRect());return b},a.Editable.prototype.repositionEditor=function(a){var b,c,d;if(this.options.inlineMode||a){if(b=this.getBoundingRect(),this.showBttnWrapper(),b.ok||b.left>=0&&b.top>=0&&b.right>0&&b.bottom>0)c=b.left+b.width/2,d=b.top+b.height,this.iOS()&&this.iOSVersion()<8||(c+=this.$window.scrollLeft(),d+=this.$window.scrollTop()),this.showByCoordinates(c,d);else if(this.options.alwaysVisible)this.hide();else{var e=this.$element.offset();this.showByCoordinates(e.left,e.top+10)}0===this.options.buttons.length&&this.hide()}},a.Editable.prototype.showByCoordinates=function(a,b){a-=22,b+=8;var c=this.$document.find(this.options.scrollableContainer);"body"!=this.options.scrollableContainer&&(a-=c.offset().left,b-=c.offset().top,this.iPad()||(a+=c.scrollLeft(),b+=c.scrollTop()));var d=Math.max(this.$popup_editor.outerWidth(),250);a+d>=c.outerWidth()-50&&a+44-d>0?(this.$popup_editor.addClass("right-side"),a=c.outerWidth()-(a+44),"static"==c.css("position")&&(a=a+parseFloat(c.css("margin-left"),10)+parseFloat(c.css("margin-right"),10)),this.$popup_editor.css("top",b),this.$popup_editor.css("right",a),this.$popup_editor.css("left","auto")):a+d<c.outerWidth()-50?(this.$popup_editor.removeClass("right-side"),this.$popup_editor.css("top",b),this.$popup_editor.css("left",a),this.$popup_editor.css("right","auto")):(this.$popup_editor.removeClass("right-side"),this.$popup_editor.css("top",b),this.$popup_editor.css("left",Math.max(c.outerWidth()-d,10)/2),this.$popup_editor.css("right","auto")),this.$popup_editor.show()},a.Editable.prototype.positionPopup=function(b){if(a(this.$editor.find('button.fr-bttn[data-cmd="'+b+'"]')).length){var c=this.$editor.find('button.fr-bttn[data-cmd="'+b+'"]'),d=c.width(),e=c.height(),f=c.offset().left+d/2,g=c.offset().top+e;this.showByCoordinates(f,g)}}}(jQuery),function(a){a.Editable.prototype.refreshImageAlign=function(a){this.$image_editor.find('.fr-dropdown > button[data-name="align"] + ul li').removeClass("active");var b="floatImageNone",c="center";a.hasClass("fr-fil")?(c="left",b="floatImageLeft"):a.hasClass("fr-fir")&&(c="right",b="floatImageRight"),this.$image_editor.find('.fr-dropdown > button[data-name="align"].fr-trigger i').attr("class","fa fa-align-"+c),this.$image_editor.find('.fr-dropdown > button[data-name="align"] + ul li[data-val="'+b+'"]').addClass("active")},a.Editable.prototype.refreshImageDisplay=function(){var a=this.$element.find(".f-img-editor");this.$image_editor.find('.fr-dropdown > button[data-name="display"] + ul li').removeClass("active"),a.hasClass("fr-dib")?this.$image_editor.find('.fr-dropdown > button[data-name="display"] + ul li[data-val="fr-dib"]').addClass("active"):this.$image_editor.find('.fr-dropdown > button[data-name="display"] + ul li[data-val="fr-dii"]').addClass("active")},a.Editable.image_commands={align:{title:"Alignment",icon:"fa fa-align-center",refresh:a.Editable.prototype.refreshImageAlign,refreshOnShow:a.Editable.prototype.refreshImageAlign,seed:[{cmd:"floatImageLeft",title:"Align Left",icon:"fa fa-align-left"},{cmd:"floatImageNone",title:"Align Center",icon:"fa fa-align-center"},{cmd:"floatImageRight",title:"Align Right",icon:"fa fa-align-right"}],callback:function(a,b,c){this[c](a)},undo:!0},display:{title:"Text Wrap",icon:"fa fa-star",refreshOnShow:a.Editable.prototype.refreshImageDisplay,namespace:"Image",seed:[{title:"Inline",value:"fr-dii"},{title:"Break Text",value:"fr-dib"}],callback:function(a,b,c){this.displayImage(a,c)},undo:!0},linkImage:{title:"Insert Link",icon:{type:"font",value:"fa fa-link"},callback:function(a){this.linkImage(a)}},replaceImage:{title:"Replace Image",icon:{type:"font",value:"fa fa-exchange"},callback:function(a){this.replaceImage(a)}},removeImage:{title:"Remove Image",icon:{type:"font",value:"fa fa-trash-o"},callback:function(a){this.removeImage(a)}}},a.Editable.DEFAULTS=a.extend(a.Editable.DEFAULTS,{allowedImageTypes:["jpeg","jpg","png","gif"],customImageButtons:{},defaultImageTitle:"Image title",defaultImageWidth:300,defaultImageDisplay:"block",defaultImageAlignment:"center",imageButtons:["display","align","linkImage","replaceImage","removeImage"],imageDeleteConfirmation:!0,imageDeleteURL:null,imageDeleteParams:{},imageMove:!0,imageResize:!0,imageLink:!0,imageTitle:!0,imageUpload:!0,imageUploadParams:{},imageUploadParam:"file",imageUploadToS3:!1,imageUploadURL:"http://i.froala.com/upload",maxImageSize:10485760,pasteImage:!0,textNearImage:!0}),a.Editable.prototype.hideImageEditorPopup=function(){this.$image_editor&&this.$image_editor.hide()},a.Editable.prototype.showImageEditorPopup=function(){this.$image_editor&&this.$image_editor.show(),this.options.imageMove||this.$element.attr("contenteditable",!1)},a.Editable.prototype.showImageWrapper=function(){this.$image_wrapper&&this.$image_wrapper.show()},a.Editable.prototype.hideImageWrapper=function(a){this.$image_wrapper&&(this.$element.attr("data-resize")||a||(this.closeImageMode(),this.imageMode=!1),this.$image_wrapper.hide(),this.$image_wrapper.find("input").blur())},a.Editable.prototype.showInsertImage=function(){this.hidePopups(),this.showImageWrapper()},a.Editable.prototype.showImageEditor=function(){this.hidePopups(),this.showImageEditorPopup()},a.Editable.prototype.insertImageHTML=function(){var b='<div class="froala-popup froala-image-popup" style="display: none;"><h4><span data-text="true">Insert Image</span><span data-text="true">Uploading image</span><i title="Cancel" class="fa fa-times" id="f-image-close-'+this._id+'"></i></h4>';return b+='<div id="f-image-list-'+this._id+'">',this.options.imageUpload&&(b+='<div class="f-popup-line drop-upload">',b+='<div class="f-upload" id="f-upload-div-'+this._id+'"><strong data-text="true">Drop Image</strong><br>(<span data-text="true">or click</span>)<form target="frame-'+this._id+'" enctype="multipart/form-data" encoding="multipart/form-data" action="'+this.options.imageUploadURL+'" method="post" id="f-upload-form-'+this._id+'"><input id="f-file-upload-'+this._id+'" type="file" name="'+this.options.imageUploadParam+'" accept="image/*"></form></div>',this.browser.msie&&a.Editable.getIEversion()<=9&&(b+='<iframe id="frame-'+this._id+'" name="frame-'+this._id+'" src="javascript:false;" style="width:0; height:0; border:0px solid #FFF; position: fixed; z-index: -1;"></iframe>'),b+="</div>"),this.options.imageLink&&(b+='<div class="f-popup-line"><label><span data-text="true">Enter URL</span>: </label><input id="f-image-url-'+this._id+'" type="text" placeholder="http://example.com"><button class="f-browse fr-p-bttn" id="f-browser-'+this._id+'"><i class="fa fa-search"></i></button><button data-text="true" class="f-ok fr-p-bttn f-submit" id="f-image-ok-'+this._id+'">OK</button></div>'),b+="</div>",b+='<p class="f-progress" id="f-progress-'+this._id+'"><span></span></p>',b+="</div>"},a.Editable.prototype.iFrameLoad=function(){var a=this.$image_wrapper.find("iframe#frame-"+this._id);if(!a.attr("data-loaded"))return a.attr("data-loaded",!0),!1;try{var b=this.$image_wrapper.find("#f-upload-form-"+this._id);if(this.options.imageUploadToS3){var c=b.attr("action"),d=b.find('input[name="key"]').val(),e=c+d;this.writeImage(e),this.options.imageUploadToS3.callback&&this.options.imageUploadToS3.callback.call(this,e,d)}else{var f=a.contents().text();this.parseImageResponse(f)}}catch(g){this.throwImageError(7)}},a.Editable.prototype.initImage=function(){this.buildInsertImage(),(!this.isLink||this.isImage)&&this.initImagePopup(),this.addListener("destroy",this.destroyImage)},a.Editable.initializers.push(a.Editable.prototype.initImage),a.Editable.prototype.destroyImage=function(){this.$image_editor&&this.$image_editor.html("").removeData().remove(),this.$image_wrapper&&this.$image_wrapper.html("").removeData().remove()},a.Editable.prototype.buildInsertImage=function(){this.$image_wrapper=a(this.insertImageHTML()),this.$popup_editor.append(this.$image_wrapper);var b=this;if(this.$image_wrapper.on("mouseup touchend",a.proxy(function(a){this.isResizing()||a.stopPropagation()},this)),this.addListener("hidePopups",a.proxy(function(){this.hideImageWrapper(!0)},this)),this.$progress_bar=this.$image_wrapper.find("p#f-progress-"+this._id),this.options.imageUpload){if(this.browser.msie&&a.Editable.getIEversion()<=9){var c=this.$image_wrapper.find("iframe").get(0);c.attachEvent?c.attachEvent("onload",function(){b.iFrameLoad()}):c.onload=function(){b.iFrameLoad()}}this.$image_wrapper.on("change",'input[type="file"]',function(){if(void 0!==this.files)b.uploadImage(this.files);else{if(!b.triggerEvent("beforeImageUpload",[],!1))return!1;var c=a(this).parents("form");c.find('input[type="hidden"]').remove();var d;for(d in b.options.imageUploadParams)c.prepend('<input type="hidden" name="'+d+'" value="'+b.options.imageUploadParams[d]+'" />');if(b.options.imageUploadToS3!==!1){for(d in b.options.imageUploadToS3.params)c.prepend('<input type="hidden" name="'+d+'" value="'+b.options.imageUploadToS3.params[d]+'" />');c.prepend('<input type="hidden" name="success_action_status" value="201" />'),c.prepend('<input type="hidden" name="X-Requested-With" value="xhr" />'),c.prepend('<input type="hidden" name="Content-Type" value="" />'),c.prepend('<input type="hidden" name="key" value="'+b.options.imageUploadToS3.keyStart+(new Date).getTime()+"-"+a(this).val().match(/[^\/\\]+$/)+'" />')}else c.prepend('<input type="hidden" name="XHR_CORS_TRARGETORIGIN" value="'+b.window.location.href+'" />');b.showInsertImage(),b.showImageLoader(!0),b.disable(),c.submit()}a(this).val("")})}this.buildDragUpload(),this.$image_wrapper.on("mouseup keydown","#f-image-url-"+this._id,a.proxy(function(a){var b=a.which;b&&27===b||a.stopPropagation()},this)),this.$image_wrapper.on("click","#f-image-ok-"+this._id,a.proxy(function(){this.writeImage(this.$image_wrapper.find("#f-image-url-"+this._id).val(),!0)},this)),this.$image_wrapper.on(this.mouseup,"#f-image-close-"+this._id,a.proxy(function(a){return this.isDisabled?!1:(a.stopPropagation(),this.$bttn_wrapper.show(),this.hideImageWrapper(!0),this.options.inlineMode&&0===this.options.buttons.length&&(this.imageMode?this.showImageEditor():this.hide()),this.imageMode||(this.restoreSelection(),this.focus()),void(this.options.inlineMode||this.imageMode?this.imageMode&&this.showImageEditor():this.hide()))},this)),this.$image_wrapper.on("click",function(a){a.stopPropagation()}),this.$image_wrapper.on("click","*",function(a){a.stopPropagation()})},a.Editable.prototype.deleteImage=function(b){if(this.options.imageDeleteURL){var c=this.options.imageDeleteParams;c.info=b.data("info"),c.src=b.attr("src"),a.ajax({type:"POST",url:this.options.imageDeleteURL,data:c,crossDomain:this.options.crossDomain,xhrFields:{withCredentials:this.options.withCredentials},headers:this.options.headers}).done(a.proxy(function(a){b.parent().parent().hasClass("f-image-list")?b.parent().remove():b.parent().removeClass("f-img-deleting"),this.triggerEvent("imageDeleteSuccess",[a],!1)},this)).fail(a.proxy(function(){b.parent().removeClass("f-img-deleting"),this.triggerEvent("imageDeleteError",["Error during image delete."],!1)},this))}else b.parent().removeClass("f-img-deleting"),this.triggerEvent("imageDeleteError",["Missing imageDeleteURL option."],!1)},a.Editable.prototype.imageHandle=function(){var b=this,c=a('<span data-fr-verified="true">').addClass("f-img-handle").on({movestart:function(c){b.hide(),b.$element.addClass("f-non-selectable").attr("contenteditable",!1),b.$element.attr("data-resize",!0),a(this).attr("data-start-x",c.startX),a(this).attr("data-start-y",c.startY)},move:function(c){var d=a(this),e=c.pageX-parseInt(d.attr("data-start-x"),10);d.attr("data-start-x",c.pageX),d.attr("data-start-y",c.pageY);var f=d.prevAll("img"),g=f.width();d.hasClass("f-h-ne")||d.hasClass("f-h-se")?f.attr("width",g+e):f.attr("width",g-e),b.triggerEvent("imageResize",[f],!1)},moveend:function(){a(this).removeAttr("data-start-x"),a(this).removeAttr("data-start-y");var c=a(this),d=c.prevAll("img");b.$element.removeClass("f-non-selectable"),b.isImage||b.$element.attr("contenteditable",!0),b.triggerEvent("imageResizeEnd",[d]),a(this).trigger("mouseup")},touchend:function(){a(this).trigger("moveend")}});return c},a.Editable.prototype.disableImageResize=function(){if(this.browser.mozilla)try{document.execCommand("enableObjectResizing",!1,!1),document.execCommand("enableInlineTableEditing",!1,!1)}catch(a){}},a.Editable.prototype.isResizing=function(){return this.$element.attr("data-resize")},a.Editable.prototype.getImageStyle=function(a){var b="z-index: 1; position: relative; overflow: auto;",c=a,d="padding";return a.parent().hasClass("f-img-editor")&&(c=a.parent(),d="margin"),b+=" padding-left:"+c.css(d+"-left")+";",b+=" padding-right:"+c.css(d+"-right")+";",b+=" padding-bottom:"+c.css(d+"-bottom")+";",b+=" padding-top:"+c.css(d+"-top")+";",a.hasClass("fr-dib")?(b+=" vertical-align: top; display: block;",b+=a.hasClass("fr-fir")?" float: none; margin-right: 0; margin-left: auto;":a.hasClass("fr-fil")?" float: none; margin-left: 0; margin-right: auto;":" float: none; margin: auto;"):(b+=" display: inline-block;",b+=a.hasClass("fr-fir")?" float: right;":a.hasClass("fr-fil")?" float: left;":" float: none;"),b},a.Editable.prototype.getImageClass=function(a){var b=a.split(" ");return a="fr-fin",b.indexOf("fr-fir")>=0&&(a="fr-fir"),b.indexOf("fr-fil")>=0&&(a="fr-fil"),b.indexOf("fr-dib")>=0&&(a+=" fr-dib"),b.indexOf("fr-dii")>=0&&(a+=" fr-dii"),a},a.Editable.prototype.refreshImageButtons=function(a){this.$image_editor.find("button").removeClass("active");var b=a.css("float");b=a.hasClass("fr-fil")?"Left":a.hasClass("fr-fir")?"Right":"None",this.$image_editor.find('button[data-cmd="floatImage'+b+'"]').addClass("active"),this.raiseEvent("refreshImage",[a])},a.Editable.prototype.initImageEvents=function(){document.addEventListener&&!document.dropAssigned&&(document.dropAssigned=!0,document.addEventListener("drop",a.proxy(function(b){return a(".froala-element img.fr-image-move").length?(b.preventDefault(),b.stopPropagation(),a(".froala-element img.fr-image-move").removeClass("fr-image-move"),!1):void 0},this))),this.disableImageResize();var b=this;this.$element.on("mousedown",'img:not([contenteditable="false"])',function(c){return b.isDisabled?!1:void(b.isResizing()||(b.initialized&&c.stopPropagation(),b.$element.attr("contenteditable",!1),a(this).addClass("fr-image-move")))}),this.$element.on("mouseup",'img:not([contenteditable="false"])',function(){return b.isDisabled?!1:void(b.isResizing()||(b.options.imageMove||b.isImage||b.isHTML||b.$element.attr("contenteditable",!0),a(this).removeClass("fr-image-move")))}),this.$element.on("click touchend",'img:not([contenteditable="false"])',function(c){if(b.isDisabled)return!1;if(!b.isResizing()&&b.initialized){if(c.preventDefault(),c.stopPropagation(),b.closeImageMode(),b.$element.blur(),b.refreshImageButtons(a(this)),b.$image_editor.find('.f-image-alt input[type="text"]').val(a(this).attr("alt")||a(this).attr("title")),b.showImageEditor(),!a(this).parent().hasClass("f-img-editor")||"SPAN"!=a(this).parent().get(0).tagName){var d=b.getImageClass(a(this).attr("class"));a(this).wrap('<span data-fr-verified="true" class="f-img-editor '+d+'"></span>'),0!==a(this).parents(".f-img-wrap").length||b.isImage?a(this).parents(".f-img-wrap").attr("class",d+" f-img-wrap"):a(this).parents("a").length>0?a(this).parents("a:first").wrap('<span data-fr-verified="true" class="f-img-wrap '+d+'"></span>'):a(this).parent().wrap('<span data-fr-verified="true" class="f-img-wrap '+d+'"></span>')}if(a(this).parent().find(".f-img-handle").remove(),b.options.imageResize){var e=b.imageHandle();a(this).parent().append(e.clone(!0).addClass("f-h-ne")),a(this).parent().append(e.clone(!0).addClass("f-h-se")),a(this).parent().append(e.clone(!0).addClass("f-h-sw")),a(this).parent().append(e.clone(!0).addClass("f-h-nw"))}b.showByCoordinates(a(this).offset().left+a(this).width()/2,a(this).offset().top+a(this).height()),b.imageMode=!0,b.$bttn_wrapper.find(".fr-bttn").removeClass("active"),b.clearSelection()}}),this.$element.on("mousedown touchstart",".f-img-handle",a.proxy(function(){return b.isDisabled?!1:void this.$element.attr("data-resize",!0)},this)),this.$element.on("mouseup",".f-img-handle",a.proxy(function(c){if(b.isDisabled)return!1;var d=a(c.target).prevAll("img");setTimeout(a.proxy(function(){this.$element.removeAttr("data-resize"),d.click()},this),0)},this))},a.Editable.prototype.execImage=function(b,c,d){var e=this.$element.find("span.f-img-editor"),f=e.find("img"),g=a.Editable.image_commands[b]||this.options.customImageButtons[b];g&&g.callback&&g.callback.apply(this,[f,b,c,d])},a.Editable.prototype.bindImageRefreshListener=function(b){b.refresh&&this.addListener("refreshImage",a.proxy(function(a){b.refresh.apply(this,[a])},this))},a.Editable.prototype.buildImageButton=function(a,b){var c='<button class="fr-bttn" data-namespace="Image" data-cmd="'+b+'" title="'+a.title+'">';return c+=void 0!==this.options.icons[b]?this.prepareIcon(this.options.icons[b],a.title):this.prepareIcon(a.icon,a.title),c+="</button>",this.bindImageRefreshListener(a),c},a.Editable.prototype.buildImageAlignDropdown=function(a){this.bindImageRefreshListener(a);for(var b='<ul class="fr-dropdown-menu f-align">',c=0;c<a.seed.length;c++){var d=a.seed[c];b+='<li data-cmd="align" data-namespace="Image" data-val="'+d.cmd+'" title="'+d.title+'"><a href="#"><i class="'+d.icon+'"></i></a></li>'}return b+="</ul>"},a.Editable.prototype.buildImageDropdown=function(a){return dropdown=this.buildDefaultDropdown(a),btn=this.buildDropdownButton(a,dropdown),btn},a.Editable.prototype.image_command_dispatcher={align:function(a){var b=this.buildImageAlignDropdown(a),c=this.buildDropdownButton(a,b);return c}},a.Editable.prototype.buildImageButtons=function(){for(var b="",c=0;c<this.options.imageButtons.length;c++){var d=this.options.imageButtons[c];
if(void 0!==a.Editable.image_commands[d]||void 0!==this.options.customImageButtons[d]){var e=a.Editable.image_commands[d]||this.options.customImageButtons[d];e.cmd=d;var f=this.image_command_dispatcher[d];b+=f?f.apply(this,[e]):e.seed?this.buildImageDropdown(e,d):this.buildImageButton(e,d)}}return b},a.Editable.prototype.initImagePopup=function(){this.$image_editor=a('<div class="froala-popup froala-image-editor-popup" style="display: none">');var b=a('<div class="f-popup-line f-popup-toolbar">').appendTo(this.$image_editor);b.append(this.buildImageButtons()),this.addListener("hidePopups",this.hideImageEditorPopup),this.options.imageTitle&&a('<div class="f-popup-line f-image-alt">').append('<label><span data-text="true">Title</span>: </label>').append(a('<input type="text">').on("mouseup keydown touchend",function(a){var b=a.which;b&&27===b||a.stopPropagation()})).append('<button class="fr-p-bttn f-ok" data-text="true" data-callback="setImageAlt" data-cmd="setImageAlt" title="OK">OK</button>').appendTo(this.$image_editor),this.$popup_editor.append(this.$image_editor),this.bindCommandEvents(this.$image_editor),this.bindDropdownEvents(this.$image_editor)},a.Editable.prototype.displayImage=function(a,b){var c=a.parents("span.f-img-editor");c.removeClass("fr-dii fr-dib").addClass(b),this.triggerEvent("imageDisplayed",[a,b]),a.click()},a.Editable.prototype.floatImageLeft=function(a){var b=a.parents("span.f-img-editor");b.removeClass("fr-fin fr-fil fr-fir").addClass("fr-fil"),this.isImage&&this.$element.css("float","left"),this.triggerEvent("imageFloatedLeft",[a]),a.click()},a.Editable.prototype.floatImageNone=function(a){var b=a.parents("span.f-img-editor");b.removeClass("fr-fin fr-fil fr-fir").addClass("fr-fin"),this.isImage||(b.parent().get(0)==this.$element.get(0)?b.wrap('<div style="text-align: center;"></div>'):b.parents(".f-img-wrap:first").css("text-align","center")),this.isImage&&this.$element.css("float","none"),this.triggerEvent("imageFloatedNone",[a]),a.click()},a.Editable.prototype.floatImageRight=function(a){var b=a.parents("span.f-img-editor");b.removeClass("fr-fin fr-fil fr-fir").addClass("fr-fir"),this.isImage&&this.$element.css("float","right"),this.triggerEvent("imageFloatedRight",[a]),a.click()},a.Editable.prototype.linkImage=function(a){this.imageMode=!0,this.showInsertLink();var b=a.parents("span.f-img-editor");"A"==b.parent().get(0).tagName?this.updateLinkValues(b.parent()):this.resetLinkValues()},a.Editable.prototype.replaceImage=function(a){this.showInsertImage(),this.imageMode=!0,this.$image_wrapper.find('input[type="text"]').val(a.attr("src")),this.showByCoordinates(a.offset().left+a.width()/2,a.offset().top+a.height())},a.Editable.prototype.removeImage=function(b){var c=b.parents("span.f-img-editor");if(0===c.length)return!1;var d=b.get(0),e="Are you sure? Image will be deleted.";if(a.Editable.LANGS[this.options.language]&&(e=a.Editable.LANGS[this.options.language].translation[e]),!this.options.imageDeleteConfirmation||confirm(e)){if(this.triggerEvent("beforeRemoveImage",[a(d)],!1)){var f=c.parents(this.valid_nodes.join(","));c.parents(".f-img-wrap").length?c.parents(".f-img-wrap").remove():c.remove(),this.refreshImageList(!0),this.hide(),f.length&&f[0]!=this.$element.get(0)&&""===a(f[0]).text()&&1==f[0].childNodes.length&&a(f[0]).remove(),this.wrapText(),this.triggerEvent("afterRemoveImage",[b]),this.focus(),this.imageMode=!1}}else b.click()},a.Editable.prototype.setImageAlt=function(){var a=this.$element.find("span.f-img-editor"),b=a.find("img");b.attr("alt",this.$image_editor.find('.f-image-alt input[type="text"]').val()),b.attr("title",this.$image_editor.find('.f-image-alt input[type="text"]').val()),this.hide(),this.closeImageMode(),this.triggerEvent("imageAltSet",[b])},a.Editable.prototype.buildImageMove=function(){var b=this;this.isLink||this.initDrag(),b.$element.on("dragover dragenter dragend",function(a){a.preventDefault()}),b.$element.on("drop",function(c){if(b.isDisabled)return!1;if(b.closeImageMode(),b.hide(),b.imageMode=!1,b.initialized||(b.$element.unbind("mousedown.element"),b.lateInit()),!b.options.imageUpload||0!==a(".froala-element img.fr-image-move").length){if(a(".froala-element .fr-image-move").length>0&&b.options.imageMove){c.preventDefault(),c.stopPropagation(),b.insertMarkersAtPoint(c.originalEvent),b.restoreSelectionByMarkers();var d=a("<div>").append(a(".froala-element img.fr-image-move").clone().removeClass("fr-image-move").addClass("fr-image-dropped")).html();b.insertHTML(d);var e=a(".froala-element img.fr-image-move").parent();a(".froala-element img.fr-image-move").remove(),e.get(0)!=b.$element.get(0)&&e.is(":empty")&&e.remove(),b.clearSelection(),b.initialized?setTimeout(function(){b.$element.find(".fr-image-dropped").removeClass(".fr-image-dropped").click()},0):b.$element.find(".fr-image-dropped").removeClass(".fr-image-dropped"),b.sync(),b.hideOtherEditors()}else c.preventDefault(),c.stopPropagation(),a(".froala-element img.fr-image-move").removeClass("fr-image-move");return!1}if(c.originalEvent.dataTransfer&&c.originalEvent.dataTransfer.files&&c.originalEvent.dataTransfer.files.length){if(b.isDisabled)return!1;var f=c.originalEvent.dataTransfer.files;b.options.allowedImageTypes.indexOf(f[0].type.replace(/image\//g,""))>=0&&(b.insertMarkersAtPoint(c.originalEvent),b.showByCoordinates(c.originalEvent.pageX,c.originalEvent.pageY),b.uploadImage(f),c.preventDefault(),c.stopPropagation())}})},a.Editable.prototype.buildDragUpload=function(){var b=this;b.$image_wrapper.on("dragover","#f-upload-div-"+this._id,function(){return a(this).addClass("f-hover"),!1}),b.$image_wrapper.on("dragend","#f-upload-div-"+this._id,function(){return a(this).removeClass("f-hover"),!1}),b.$image_wrapper.on("drop","#f-upload-div-"+this._id,function(c){return c.preventDefault(),c.stopPropagation(),b.options.imageUpload?(a(this).removeClass("f-hover"),void b.uploadImage(c.originalEvent.dataTransfer.files)):!1})},a.Editable.prototype.showImageLoader=function(b){if(void 0===b&&(b=!1),b){var c="Please wait!";a.Editable.LANGS[this.options.language]&&(c=a.Editable.LANGS[this.options.language].translation[c]),this.$progress_bar.find("span").css("width","100%").text(c)}else this.$image_wrapper.find("h4").addClass("uploading");this.$image_wrapper.find("#f-image-list-"+this._id).hide(),this.$progress_bar.show(),this.showInsertImage()},a.Editable.prototype.hideImageLoader=function(){this.$progress_bar.hide(),this.$progress_bar.find("span").css("width","0%").text(""),this.$image_wrapper.find("#f-image-list-"+this._id).show(),this.$image_wrapper.find("h4").removeClass("uploading")},a.Editable.prototype.writeImage=function(b,c,d){if(c&&(b=this.sanitizeURL(b),""===b))return!1;var e=new Image;e.onerror=a.proxy(function(){this.hideImageLoader(),this.throwImageError(1)},this),e.onload=this.imageMode?a.proxy(function(){var a=this.$element.find(".f-img-editor > img");a.attr("src",b),this.hide(),this.hideImageLoader(),this.$image_editor.show(),this.enable(),this.triggerEvent("imageReplaced",[a,d]),setTimeout(function(){a.trigger("click")},0)},this):a.proxy(function(){this.insertLoadedImage(b,d)},this),this.showImageLoader(!0),e.src=b},a.Editable.prototype.processInsertImage=function(b,c){void 0===c&&(c=!0),this.enable(),this.focus(),this.restoreSelection();var d="";parseInt(this.options.defaultImageWidth,10)&&(d=' width="'+this.options.defaultImageWidth+'"');var e="fr-fin";"left"==this.options.defaultImageAlignment&&(e="fr-fil"),"right"==this.options.defaultImageAlignment&&(e="fr-fir"),e+=" fr-di"+this.options.defaultImageDisplay[0];var f='<img class="'+e+' fr-just-inserted" alt="'+this.options.defaultImageTitle+'" src="'+b+'"'+d+">",g=this.getSelectionElements()[0],h=this.getRange(),i=!this.browser.msie&&a.Editable.getIEversion()>8?a(h.startContainer):null;i&&i.hasClass("f-img-wrap")?(1===h.startOffset?(i.after("<"+this.options.defaultTag+'><span class="f-marker" data-type="true" data-id="0"></span><br/><span class="f-marker" data-type="false" data-id="0"></span></'+this.options.defaultTag+">"),this.restoreSelectionByMarkers(),this.getSelection().collapseToStart()):0===h.startOffset&&(i.before("<"+this.options.defaultTag+'><span class="f-marker" data-type="true" data-id="0"></span><br/><span class="f-marker" data-type="false" data-id="0"></span></'+this.options.defaultTag+">"),this.restoreSelectionByMarkers(),this.getSelection().collapseToStart()),this.insertHTML(f)):this.getSelectionTextInfo(g).atStart&&g!=this.$element.get(0)&&"TD"!=g.tagName&&"TH"!=g.tagName&&"LI"!=g.tagName?a(g).before("<"+this.options.defaultTag+">"+f+"</"+this.options.defaultTag+">"):this.insertHTML(f),this.disable()},a.Editable.prototype.insertLoadedImage=function(b,c){this.triggerEvent("imageLoaded",[b],!1),this.processInsertImage(b,!1),this.browser.msie&&this.$element.find("img").each(function(a,b){b.oncontrolselect=function(){return!1}}),this.enable(),this.hide(),this.hideImageLoader(),this.wrapText(),this.cleanupLists();var d,e=this.$element.find("img.fr-just-inserted").get(0);e&&(d=e.previousSibling),d&&3==d.nodeType&&/\u200B/gi.test(d.textContent)&&a(d).remove(),this.triggerEvent("imageInserted",[this.$element.find("img.fr-just-inserted"),c]),setTimeout(a.proxy(function(){this.$element.find("img.fr-just-inserted").removeClass("fr-just-inserted").trigger("touchend")},this),50)},a.Editable.prototype.throwImageErrorWithMessage=function(a){this.enable(),this.triggerEvent("imageError",[{message:a,code:0}],!1),this.hideImageLoader()},a.Editable.prototype.throwImageError=function(a){this.enable();var b="Unknown image upload error.";1==a?b="Bad link.":2==a?b="No link in upload response.":3==a?b="Error during file upload.":4==a?b="Parsing response failed.":5==a?b="Image too large.":6==a?b="Invalid image type.":7==a&&(b="Image can be uploaded only to same domain in IE 8 and IE 9."),this.triggerEvent("imageError",[{code:a,message:b}],!1),this.hideImageLoader()},a.Editable.prototype.uploadImage=function(b){if(!this.triggerEvent("beforeImageUpload",[b],!1))return!1;if(void 0!==b&&b.length>0){var c;if(this.drag_support.formdata&&(c=this.drag_support.formdata?new FormData:null),c){var d;for(d in this.options.imageUploadParams)c.append(d,this.options.imageUploadParams[d]);if(this.options.imageUploadToS3!==!1){for(d in this.options.imageUploadToS3.params)c.append(d,this.options.imageUploadToS3.params[d]);c.append("success_action_status","201"),c.append("X-Requested-With","xhr"),c.append("Content-Type",b[0].type),c.append("key",this.options.imageUploadToS3.keyStart+(new Date).getTime()+"-"+b[0].name)}if(c.append(this.options.imageUploadParam,b[0]),b[0].size>this.options.maxImageSize)return this.throwImageError(5),!1;if(this.options.allowedImageTypes.indexOf(b[0].type.replace(/image\//g,""))<0)return this.throwImageError(6),!1}if(c){var e;if(this.options.crossDomain)e=this.createCORSRequest("POST",this.options.imageUploadURL);else{e=new XMLHttpRequest,e.open("POST",this.options.imageUploadURL);for(var f in this.options.headers)e.setRequestHeader(f,this.options.headers[f])}e.onload=a.proxy(function(){var b="Please wait!";a.Editable.LANGS[this.options.language]&&(b=a.Editable.LANGS[this.options.language].translation[b]),this.$progress_bar.find("span").css("width","100%").text(b);try{if(this.options.imageUploadToS3)201==e.status?this.parseImageResponseXML(e.responseXML):this.throwImageError(3);else if(e.status>=200&&e.status<300)this.parseImageResponse(e.responseText);else try{var c=a.parseJSON(e.responseText);c.error?this.throwImageErrorWithMessage(c.error):this.throwImageError(3)}catch(d){this.throwImageError(3)}}catch(d){this.throwImageError(4)}},this),e.onerror=a.proxy(function(){this.throwImageError(3)},this),e.upload.onprogress=a.proxy(function(a){if(a.lengthComputable){var b=a.loaded/a.total*100|0;this.$progress_bar.find("span").css("width",b+"%")}},this),this.disable(),e.send(c),this.showImageLoader()}}},a.Editable.prototype.parseImageResponse=function(b){try{if(!this.triggerEvent("afterImageUpload",[b],!1))return!1;var c=a.parseJSON(b);c.link?this.writeImage(c.link,!1,b):c.error?this.throwImageErrorWithMessage(c.error):this.throwImageError(2)}catch(d){this.throwImageError(4)}},a.Editable.prototype.parseImageResponseXML=function(b){try{var c=a(b).find("Location").text(),d=a(b).find("Key").text();this.options.imageUploadToS3.callback&&this.options.imageUploadToS3.callback.call(this,c,d),c?this.writeImage(c):this.throwImageError(2)}catch(e){this.throwImageError(4)}},a.Editable.prototype.setImageUploadURL=function(a){a&&(this.options.imageUploadURL=a),this.options.imageUploadToS3&&(this.options.imageUploadURL="https://"+this.options.imageUploadToS3.bucket+"."+this.options.imageUploadToS3.region+".amazonaws.com/")},a.Editable.prototype.closeImageMode=function(){this.$element.find("span.f-img-editor > img").each(a.proxy(function(b,c){a(c).removeClass("fr-fin fr-fil fr-fir fr-dib fr-dii").addClass(this.getImageClass(a(c).parent().attr("class"))),a(c).parents(".f-img-wrap").length>0?"A"==a(c).parent().parent().get(0).tagName?a(c).siblings("span.f-img-handle").remove().end().unwrap().parent().unwrap():a(c).siblings("span.f-img-handle").remove().end().unwrap().unwrap():a(c).siblings("span.f-img-handle").remove().end().unwrap()},this)),this.$element.find("span.f-img-editor").length&&(this.$element.find("span.f-img-editor").remove(),this.$element.parents("span.f-img-editor").remove()),this.$element.removeClass("f-non-selectable"),this.editableDisabled||this.isHTML||this.$element.attr("contenteditable",!0),this.$image_editor&&this.$image_editor.hide(),this.$link_wrapper&&this.options.linkText&&this.$link_wrapper.find('input[type="text"].f-lt').parent().removeClass("fr-hidden")},a.Editable.prototype.refreshImageList=function(b){if(!this.isLink&&!this.options.editInPopup){var c=[],d=[],e=this;if(this.$element.find("img").each(function(b,f){var g=a(f);if(c.push(g.attr("src")),d.push(g),"false"==g.attr("contenteditable"))return!0;if(0!==g.parents(".f-img-editor").length||g.hasClass("fr-dii")||g.hasClass("fr-dib")||(e.options.textNearImage?g.addClass(g.hasClass("fr-fin")?"fr-dib":g.hasClass("fr-fil")||g.hasClass("fr-fir")?"fr-dii":"block"==g.css("display")&&"none"==g.css("float")?"fr-dib":"fr-dii"):(g.addClass("fr-dib"),e.options.imageButtons.splice(e.options.imageButtons.indexOf("display"),1))),e.options.textNearImage||g.removeClass("fr-dii").addClass("fr-dib"),0===g.parents(".f-img-editor").length&&!g.hasClass("fr-fil")&&!g.hasClass("fr-fir")&&!g.hasClass("fr-fin"))if(g.hasClass("fr-dii"))g.addClass("right"==g.css("float")?"fr-fir":"left"==g.css("float")?"fr-fil":"fr-fin");else{var h=g.attr("style");g.hide(),g.addClass(0===parseInt(g.css("margin-right"),10)&&h?"fr-fir":0===parseInt(g.css("margin-left"),10)&&h?"fr-fil":"fr-fin"),g.show()}g.css("margin",""),g.css("float",""),g.css("display",""),g.removeAttr("data-style")}),void 0===b)for(var f=0;f<this.imageList.length;f++)c.indexOf(this.imageList[f].attr("src"))<0&&this.triggerEvent("afterRemoveImage",[this.imageList[f]],!1);this.imageList=d}},a.Editable.prototype.insertImage=function(){this.options.inlineMode||(this.closeImageMode(),this.imageMode=!1,this.positionPopup("insertImage")),this.selectionInEditor()&&this.saveSelection(),this.showInsertImage(),this.imageMode=!1,this.$image_wrapper.find('input[type="text"]').val("")}}(jQuery),function(a){a.Editable.prototype.showLinkWrapper=function(){this.$link_wrapper&&(this.$link_wrapper.show(),this.$link_wrapper.trigger("hideLinkList"),this.$link_wrapper.trigger("hideLinkClassList"),this.$link_wrapper.find("input.f-lu").removeClass("fr-error"),this.imageMode||!this.options.linkText?this.$link_wrapper.find('input[type="text"].f-lt').parent().addClass("fr-hidden"):this.$link_wrapper.find('input[type="text"].f-lt').parent().removeClass("fr-hidden"),this.imageMode&&this.$link_wrapper.find('input[type="text"].f-lu').removeAttr("disabled"),this.phone()?this.$document.scrollTop(this.$link_wrapper.offset().top+30):setTimeout(a.proxy(function(){this.imageMode&&this.iPad()||this.$link_wrapper.find('input[type="text"].f-lu').focus().select()},this),0),this.link=!0),this.refreshDisabledState()},a.Editable.prototype.hideLinkWrapper=function(){this.$link_wrapper&&(this.$link_wrapper.hide(),this.$link_wrapper.find("input").blur()),this.refreshDisabledState()},a.Editable.prototype.showInsertLink=function(){this.hidePopups(),this.showLinkWrapper()},a.Editable.prototype.updateLinkValues=function(b){var c=b.attr("href")||"http://";this.$link_wrapper.find("input.f-lt").val(b.text()),this.isLink?("#"==c&&(c=""),this.$link_wrapper.find("input#f-lu-"+this._id).val(c.replace(/\&amp;/g,"&")),this.$link_wrapper.find(".f-external-link").attr("href",c||"#")):(this.$link_wrapper.find("input.f-lu").val(c.replace(/\&amp;/g,"&")),this.$link_wrapper.find(".f-external-link").attr("href",c)),this.$link_wrapper.find("input.f-target").prop("checked","_blank"==b.attr("target")),this.$link_wrapper.find("li.f-choose-link-class").each(a.proxy(function(c,d){b.hasClass(a(d).data("class"))&&a(d).click()},this));for(var d in this.options.linkAttributes){var e=b.attr(d);this.$link_wrapper.find("input.fl-"+d).val(e?e:"")}this.$link_wrapper.find("a.f-external-link, button.f-unlink").show()},a.Editable.prototype.initLinkEvents=function(){var b=this,c=function(a){a.stopPropagation(),a.preventDefault()},d=function(c){return c.stopPropagation(),c.preventDefault(),b.isDisabled?!1:""!==b.text()?(b.hide(),!1):(b.link=!0,b.clearSelection(),b.removeMarkers(),b.selectionDisabled||(a(this).before('<span class="f-marker" data-type="true" data-id="0" data-fr-verified="true"></span>'),a(this).after('<span class="f-marker" data-type="false" data-id="0" data-fr-verified="true"></span>'),b.restoreSelectionByMarkers()),b.exec("createLink"),b.updateLinkValues(a(this)),b.showByCoordinates(a(this).offset().left+a(this).outerWidth()/2,a(this).offset().top+(parseInt(a(this).css("padding-top"),10)||0)+a(this).height()),b.showInsertLink(),a(this).hasClass("fr-file")?b.$link_wrapper.find("input.f-lu").attr("disabled","disabled"):b.$link_wrapper.find("input.f-lu").removeAttr("disabled"),void b.closeImageMode())};this.$element.on("mousedown","a",a.proxy(function(a){this.isResizing()||a.stopPropagation()},this)),this.isLink?this.iOS()?(this.$element.on("touchstart",c),this.$element.on("touchend",d)):this.$element.on("click",d):this.iOS()?(this.$element.on("touchstart",'a:not([contenteditable="false"])',c),this.$element.on("touchend",'a:not([contenteditable="false"])',d),this.$element.on("touchstart",'a[contenteditable="false"]',c),this.$element.on("touchend",'a[contenteditable="false"]',c)):(this.$element.on("click",'a:not([contenteditable="false"])',d),this.$element.on("click",'a[contenteditable="false"]',c))},a.Editable.prototype.destroyLink=function(){this.$link_wrapper.html("").removeData().remove()},a.Editable.prototype.initLink=function(){this.buildCreateLink(),this.initLinkEvents(),this.addListener("destroy",this.destroyLink)},a.Editable.initializers.push(a.Editable.prototype.initLink),a.Editable.prototype.removeLink=function(){this.imageMode?("A"==this.$element.find(".f-img-editor").parent().get(0).tagName&&a(this.$element.find(".f-img-editor").get(0)).unwrap(),this.triggerEvent("imageLinkRemoved"),this.showImageEditor(),this.$element.find(".f-img-editor").find("img").click(),this.link=!1):(this.restoreSelection(),this.document.execCommand("unlink",!1,null),this.isLink||this.$element.find("a:empty").remove(),this.triggerEvent("linkRemoved"),this.hideLinkWrapper(),this.$bttn_wrapper.show(),(!this.options.inlineMode||this.isLink)&&this.hide(),this.link=!1)},a.Editable.prototype.writeLink=function(b,c,d,e,f){var g,h=this.options.noFollow;this.options.alwaysBlank&&(e=!0);var i,j="",k="",l="";h===!0&&/^https?:\/\//.test(b)&&(j='rel="nofollow"'),e===!0&&(k='target="_blank"');for(i in f)l+=" "+i+'="'+f[i]+'"';var m=b;if(b=this.sanitizeURL(b),this.options.convertMailAddresses){var n=/^\w+@[a-zA-Z_]+?\.[a-zA-Z]{2,3}$/i;n.test(b)&&0!==b.indexOf("mailto:")&&(b="mailto:"+b)}if(0===b.indexOf("mailto:")||""===this.options.linkAutoPrefix||/^(https?:|ftps?:|)\/\//.test(b)||(b=this.options.linkAutoPrefix+b),""===b)return this.$link_wrapper.find("input.f-lu").addClass("fr-error").focus(),this.triggerEvent("badLink",[m],!1),!1;if(this.$link_wrapper.find("input.f-lu").removeClass("fr-error"),this.imageMode){if("A"!=this.$element.find(".f-img-editor").parent().get(0).tagName)this.$element.find(".f-img-editor").wrap('<a data-fr-link="true" href="'+b+'" '+k+" "+j+l+"></a>");else{var o=this.$element.find(".f-img-editor").parent();e===!0?o.attr("target","_blank"):o.removeAttr("target"),h===!0?o.attr("rel","nofollow"):o.removeAttr("rel");for(i in f)f[i]?o.attr(i,f[i]):o.removeAttr(i);o.removeClass(Object.keys(this.options.linkClasses).join(" ")),o.attr("href",b).addClass(d)}this.triggerEvent("imageLinkInserted",[b]),this.showImageEditor(),this.$element.find(".f-img-editor").find("img").click(),this.link=!1}else{var p=null;this.isLink?""===c&&(c=this.$element.text()):(this.restoreSelection(),g=this.getSelectionLinks(),g.length>0&&(p=g[0].attributes,is_file=a(g[0]).hasClass("fr-file")),this.saveSelectionByMarkers(),this.document.execCommand("unlink",!1,b),this.$element.find('span[data-fr-link="true"]').each(function(b,c){a(c).replaceWith(a(c).html())}),this.restoreSelectionByMarkers()),this.isLink?(this.$element.text(c),g=[this.$element.attr("href",b).get(0)]):(this.removeMarkers(),(this.options.linkText||""===this.text())&&(this.insertHTML('<span class="f-marker" data-fr-verified="true" data-id="0" data-type="true"></span>'+(c||this.clean(m))+'<span class="f-marker" data-fr-verified="true" data-id="0" data-type="false"></span>'),this.restoreSelectionByMarkers()),this.document.execCommand("createLink",!1,b),g=this.getSelectionLinks());for(var q=0;q<g.length;q++){if(p)for(var r=0;r<p.length;r++)"href"!=p[r].nodeName&&a(g[q]).attr(p[r].nodeName,p[r].value);e===!0?a(g[q]).attr("target","_blank"):a(g[q]).removeAttr("target"),h===!0&&/^https?:\/\//.test(b)?a(g[q]).attr("rel","nofollow"):a(g[q]).removeAttr("rel"),a(g[q]).data("fr-link",!0),a(g[q]).removeClass(Object.keys(this.options.linkClasses).join(" ")),a(g[q]).addClass(d);for(i in f)f[i]?a(g[q]).attr(i,f[i]):a(g[q]).removeAttr(i)}this.$element.find("a:empty").remove(),this.triggerEvent("linkInserted",[b]),this.hideLinkWrapper(),this.$bttn_wrapper.show(),(!this.options.inlineMode||this.isLink)&&this.hide(),this.link=!1}},a.Editable.prototype.createLinkHTML=function(){var a='<div class="froala-popup froala-link-popup" style="display: none;">';a+='<h4><span data-text="true">Insert Link</span><a target="_blank" title="Open Link" class="f-external-link" href="#"><i class="fa fa-external-link"></i></a><i title="Cancel" class="fa fa-times" id="f-link-close-'+this._id+'"></i></h4>',a+='<div class="f-popup-line fr-hidden"><input type="text" placeholder="Text" class="f-lt" id="f-lt-'+this._id+'"></div>';var b="";if(this.options.linkList.length&&(b="f-bi"),a+='<div class="f-popup-line"><input type="text" placeholder="http://www.example.com" class="f-lu '+b+'" id="f-lu-'+this._id+'"/>',this.options.linkList.length){a+='<button class="fr-p-bttn f-browse-links" id="f-browse-links-'+this._id+'"><i class="fa fa-chevron-down"></i></button>',a+='<ul id="f-link-list-'+this._id+'">';for(var c=0;c<this.options.linkList.length;c++){var d=this.options.linkList[c],e="";for(var f in d)e+=" data-"+f+'="'+d[f]+'"';a+='<li class="f-choose-link"'+e+">"+d.body+"</li>"}a+="</ul>"}if(a+="</div>",Object.keys(this.options.linkClasses).length){a+='<div class="f-popup-line"><input type="text" placeholder="Choose link type" class="f-bi" id="f-luc-'+this._id+'" disabled="disabled"/>',a+='<button class="fr-p-bttn f-browse-links" id="f-links-class-'+this._id+'"><i class="fa fa-chevron-down"></i></button>',a+='<ul id="f-link-class-list-'+this._id+'">';for(var g in this.options.linkClasses){var h=this.options.linkClasses[g];a+='<li class="f-choose-link-class" data-class="'+g+'">'+h+"</li>"}a+="</ul>",a+="</div>"}for(var i in this.options.linkAttributes){var j=this.options.linkAttributes[i];a+='<div class="f-popup-line"><input class="fl-'+i+'" type="text" placeholder="'+j+'" id="fl-'+i+"-"+this._id+'"/></div>'}return a+='<div class="f-popup-line"><input type="checkbox" class="f-target" id="f-target-'+this._id+'"> <label data-text="true" for="f-target-'+this._id+'">Open in new tab</label><button data-text="true" type="button" class="fr-p-bttn f-ok f-submit" id="f-ok-'+this._id+'">OK</button>',this.options.unlinkButton&&(a+='<button type="button" data-text="true" class="fr-p-bttn f-ok f-unlink" id="f-unlink-'+this._id+'">UNLINK</button>'),a+="</div></div>"},a.Editable.prototype.buildCreateLink=function(){this.$link_wrapper=a(this.createLinkHTML()),this.$popup_editor.append(this.$link_wrapper);var b=this;this.addListener("hidePopups",this.hideLinkWrapper),this.$link_wrapper.on("mouseup touchend",a.proxy(function(a){this.isResizing()||(a.stopPropagation(),this.$link_wrapper.trigger("hideLinkList"))},this)),this.$link_wrapper.on("click",function(a){a.stopPropagation()}),this.$link_wrapper.on("click","*",function(a){a.stopPropagation()}),this.options.linkText&&this.$link_wrapper.on("mouseup keydown","input#f-lt-"+this._id,a.proxy(function(a){var b=a.which;b&&27===b||a.stopPropagation(),this.$link_wrapper.trigger("hideLinkList"),this.$link_wrapper.trigger("hideLinkClassList")},this)),this.$link_wrapper.on("mouseup keydown touchend touchstart","input#f-lu-"+this._id,a.proxy(function(a){var b=a.which;b&&27===b||a.stopPropagation(),this.$link_wrapper.trigger("hideLinkList"),this.$link_wrapper.trigger("hideLinkClassList")},this)),this.$link_wrapper.on("click keydown","input#f-target-"+this._id,function(a){var b=a.which;b&&27===b||a.stopPropagation()}),this.$link_wrapper.on("touchend","button#f-ok-"+this._id,function(a){a.stopPropagation()}).on("click","button#f-ok-"+this._id,a.proxy(function(){var a,b=this.$link_wrapper.find("input#f-lt-"+this._id),c=this.$link_wrapper.find("input#f-lu-"+this._id),d=this.$link_wrapper.find("input#f-luc-"+this._id),e=this.$link_wrapper.find("input#f-target-"+this._id);a=b?b.val():"";var f=c.val();this.isLink&&""===f&&(f="#");var g="";d&&(g=d.data("class"));var h={};for(var i in this.options.linkAttributes)h[i]=this.$link_wrapper.find("input#fl-"+i+"-"+this._id).val();this.writeLink(f,a,g,e.prop("checked"),h)},this)),this.$link_wrapper.on("click touch","button#f-unlink-"+this._id,a.proxy(function(){this.link=!0,this.removeLink()},this)),this.options.linkList.length&&(this.$link_wrapper.on("click touch","li.f-choose-link",function(){b.resetLinkValues();var c=b.$link_wrapper.find("button#f-browse-links-"+b._id),d=b.$link_wrapper.find("input#f-lt-"+b._id),e=b.$link_wrapper.find("input#f-lu-"+b._id),f=b.$link_wrapper.find("input#f-target-"+b._id);d&&d.val(a(this).data("body")),e.val(a(this).data("href")),f.prop("checked",a(this).data("blank"));for(var g in b.options.linkAttributes)a(this).data(g)&&b.$link_wrapper.find("input#fl-"+g+"-"+b._id).val(a(this).data(g));c.click()}).on("mouseup","li.f-choose-link",function(a){a.stopPropagation()}),this.$link_wrapper.on("click","button#f-browse-links-"+this._id+", button#f-browse-links-"+this._id+" > i",function(c){c.stopPropagation();var d=b.$link_wrapper.find("ul#f-link-list-"+b._id);b.$link_wrapper.trigger("hideLinkClassList"),a(this).find("i").toggleClass("fa-chevron-down"),a(this).find("i").toggleClass("fa-chevron-up"),d.toggle()}).on("mouseup","button#f-browse-links-"+this._id+", button#f-browse-links-"+this._id+" > i",function(a){a.stopPropagation()}),this.$link_wrapper.bind("hideLinkList",function(){var a=b.$link_wrapper.find("ul#f-link-list-"+b._id),c=b.$link_wrapper.find("button#f-browse-links-"+b._id);a&&a.is(":visible")&&c.click()})),Object.keys(this.options.linkClasses).length&&(this.$link_wrapper.on("mouseup keydown","input#f-luc-"+this._id,a.proxy(function(a){var b=a.which;b&&27===b||a.stopPropagation(),this.$link_wrapper.trigger("hideLinkList"),this.$link_wrapper.trigger("hideLinkClassList")},this)),this.$link_wrapper.on("click touch","li.f-choose-link-class",function(){var c=b.$link_wrapper.find("input#f-luc-"+b._id);c.val(a(this).text()),c.data("class",a(this).data("class")),b.$link_wrapper.trigger("hideLinkClassList")}).on("mouseup","li.f-choose-link-class",function(a){a.stopPropagation()}),this.$link_wrapper.on("click","button#f-links-class-"+this._id,function(c){c.stopPropagation(),b.$link_wrapper.trigger("hideLinkList");var d=b.$link_wrapper.find("ul#f-link-class-list-"+b._id);a(this).find("i").toggleClass("fa-chevron-down"),a(this).find("i").toggleClass("fa-chevron-up"),d.toggle()}).on("mouseup","button#f-links-class-"+this._id,function(a){a.stopPropagation()}),this.$link_wrapper.bind("hideLinkClassList",function(){var a=b.$link_wrapper.find("ul#f-link-class-list-"+b._id),c=b.$link_wrapper.find("button#f-links-class-"+b._id);a&&a.is(":visible")&&c.click()})),this.$link_wrapper.on(this.mouseup,"i#f-link-close-"+this._id,a.proxy(function(){this.$bttn_wrapper.show(),this.hideLinkWrapper(),(!this.options.inlineMode&&!this.imageMode||this.isLink||0===this.options.buttons.length)&&this.hide(),this.imageMode?this.showImageEditor():(this.restoreSelection(),this.focus())},this))},a.Editable.prototype.getSelectionLinks=function(){var a,b,c,d,e=[];if(this.window.getSelection){var f=this.window.getSelection();if(f.getRangeAt&&f.rangeCount){d=this.document.createRange();for(var g=0;g<f.rangeCount;++g)if(a=f.getRangeAt(g),b=a.commonAncestorContainer,b&&1!=b.nodeType&&(b=b.parentNode),b&&"a"==b.nodeName.toLowerCase())e.push(b);else{c=b.getElementsByTagName("a");for(var h=0;h<c.length;++h)d.selectNodeContents(c[h]),d.compareBoundaryPoints(a.END_TO_START,a)<1&&d.compareBoundaryPoints(a.START_TO_END,a)>-1&&e.push(c[h])}}}else if(this.document.selection&&"Control"!=this.document.selection.type)if(a=this.document.selection.createRange(),b=a.parentElement(),"a"==b.nodeName.toLowerCase())e.push(b);else{c=b.getElementsByTagName("a"),d=this.document.body.createTextRange();for(var i=0;i<c.length;++i)d.moveToElementText(c[i]),d.compareEndPoints("StartToEnd",a)>-1&&d.compareEndPoints("EndToStart",a)<1&&e.push(c[i])}return e},a.Editable.prototype.resetLinkValues=function(){this.$link_wrapper.find("input").val(""),this.$link_wrapper.find('input[type="checkbox"].f-target').prop("checked",this.options.alwaysBlank),this.$link_wrapper.find('input[type="text"].f-lt').val(this.text()),this.$link_wrapper.find('input[type="text"].f-lu').val("http://"),this.$link_wrapper.find('input[type="text"].f-lu').removeAttr("disabled"),this.$link_wrapper.find("a.f-external-link, button.f-unlink").hide();for(var a in this.options.linkAttributes)this.$link_wrapper.find('input[type="text"].fl-'+a).val("")},a.Editable.prototype.insertLink=function(){this.options.inlineMode||(this.closeImageMode(),this.imageMode=!1,this.positionPopup("createLink")),this.selectionInEditor()&&this.saveSelection(),this.showInsertLink();var b=this.getSelectionLinks();b.length>0?this.updateLinkValues(a(b[0])):this.resetLinkValues()}}(jQuery),function(a){a.Editable.prototype.browserFixes=function(){this.backspaceEmpty(),this.backspaceInEmptyBlock(),this.fixHR(),this.domInsert(),this.fixIME(),this.cleanInvisibleSpace(),this.cleanBR(),this.insertSpace()},a.Editable.prototype.backspaceInEmptyBlock=function(){this.$element.on("keyup",a.proxy(function(b){var c=b.which;if(this.browser.mozilla&&!this.isHTML&&8==c){var d=a(this.getSelectionElement());this.valid_nodes.indexOf(d.get(0).tagName)>=0&&1==d.find("*").length&&""===d.text()&&1==d.find("br").length&&this.setSelection(d.get(0))}},this))},a.Editable.prototype.insertSpace=function(){this.browser.mozilla&&this.$element.on("keypress",a.proxy(function(a){var b=a.which,c=this.getSelectionElements()[0];this.isHTML||32!=b||"PRE"==c.tagName||(a.preventDefault(),this.insertSimpleHTML("&nbsp;"))},this))},a.Editable.prototype.cleanBR=function(){this.$element.on("keyup",a.proxy(function(){this.$element.find(this.valid_nodes.join(",")).each(a.proxy(function(b,c){if(["TH","TD","LI"].indexOf(c.tagName)>=0)return!0;
var d=c.childNodes,e=null;if(!d.length||"BR"!=d[d.length-1].tagName)return!0;e=d[d.length-1];var f=e.previousSibling;f&&"BR"!=f.tagName&&a(e).parent().text().length>0&&this.valid_nodes.indexOf(f.tagName)<0&&a(e).remove()},this))},this))},a.Editable.prototype.replaceU200B=function(b){for(var c=0;c<b.length;c++)3==b[c].nodeType&&/\u200B/gi.test(b[c].textContent)?b[c].textContent=b[c].textContent.replace(/\u200B/gi,""):1==b[c].nodeType&&this.replaceU200B(a(b[c]).contents())},a.Editable.prototype.cleanInvisibleSpace=function(){var b=function(b){var c=a(b).text();return b&&/\u200B/.test(a(b).text())&&c.replace(/\u200B/gi,"").length>0?!0:!1};this.$element.on("keyup",a.proxy(function(){var c=this.getSelectionElement();b(c)&&0===a(c).find("li").length&&(this.saveSelectionByMarkers(),this.replaceU200B(a(c).contents()),this.restoreSelectionByMarkers())},this))},a.Editable.prototype.fixHR=function(){this.$element.on("keypress",a.proxy(function(b){var c=a(this.getSelectionElement());if(c.is("hr")||c.parents("hr").length)return!1;var d=b.which;if(8==d){var e=a(this.getSelectionElements()[0]);e.prev().is("hr")&&this.getSelectionTextInfo(e.get(0)).atStart&&(this.saveSelectionByMarkers(),e.prev().remove(),this.restoreSelectionByMarkers(),b.preventDefault())}},this))},a.Editable.prototype.backspaceEmpty=function(){this.$element.on("keydown",a.proxy(function(a){var b=a.which;!this.isHTML&&8==b&&this.$element.hasClass("f-placeholder")&&a.preventDefault()},this))},a.Editable.prototype.domInsert=function(){this.$element.on("keydown",a.proxy(function(a){var b=a.which;13===b&&(this.add_br=!0)},this)),this.$element.on("DOMNodeInserted",a.proxy(function(b){if("SPAN"!==b.target.tagName||a(b.target).attr("data-fr-verified")||this.no_verify||this.textEmpty(b.target)||a(b.target).replaceWith(a(b.target).contents()),"BR"===b.target.tagName&&setTimeout(function(){a(b.target).removeAttr("type")},0),"A"===b.target.tagName&&setTimeout(function(){a(b.target).removeAttr("_moz_dirty")},0),this.options.paragraphy&&this.add_br&&"BR"===b.target.tagName&&(a(b.target).prev().length&&"TABLE"===a(b.target).prev().get(0).tagName||a(b.target).next().length&&"TABLE"===a(b.target).next().get(0).tagName)){a(b.target).wrap('<p class="fr-p-wrap">');var c=this.$element.find("p.fr-p-wrap").removeAttr("class");this.setSelection(c.get(0))}"BR"===b.target.tagName&&this.isLastSibling(b.target)&&"LI"==b.target.parentNode.tagName&&this.textEmpty(b.target.parentNode)&&a(b.target).remove()},this)),this.$element.on("keyup",a.proxy(function(a){var b=a.which;8===b&&this.$element.find("span:not([data-fr-verified])").attr("data-fr-verified",!0),13===b&&(this.add_br=!1)},this))},a.Editable.prototype.fixIME=function(){try{this.$element.get(0).msGetInputContext&&(this.$element.get(0).msGetInputContext().addEventListener("MSCandidateWindowShow",a.proxy(function(){this.ime=!0},this)),this.$element.get(0).msGetInputContext().addEventListener("MSCandidateWindowHide",a.proxy(function(){this.ime=!1,this.$element.trigger("keydown"),this.oldHTML=""},this)))}catch(b){}}}(jQuery),function(a){a.Editable.prototype.handleEnter=function(){var b=a.proxy(function(){var b=this.getSelectionElement();return"LI"==b.tagName||this.parents(a(b),"li").length>0?!0:!1},this);this.$element.on("keypress",a.proxy(function(a){if(!this.isHTML&&!b()){var c=a.which;if(13==c&&!a.shiftKey){a.preventDefault(),this.saveUndoStep(),this.insertSimpleHTML("<break></break>");var d=this.getSelectionElements();if(d[0]==this.$element.get(0)?this.enterInMainElement(d[0]):this.enterInElement(d[0]),this.getSelectionTextInfo(this.$element.get(0)).atEnd)this.$wrapper.scrollTop(this.$element.height());else{var e=this.getBoundingRect();this.$wrapper.offset().top+this.$wrapper.height()<e.top+e.height&&this.$wrapper.scrollTop(e.top+this.$wrapper.scrollTop()-(this.$wrapper.height()+this.$wrapper.offset().top)+e.height+10)}}}},this))},a.Editable.prototype.enterInMainElement=function(b){var c=a(b).find("break").get(0);if(a(c).parent().get(0)==b)this.isLastSibling(c)?this.insertSimpleHTML("</br>"+this.markers_html+this.br):a(b).hasClass("f-placeholder")?a(b).html("</br>"+this.markers_html+this.br):this.insertSimpleHTML("</br>"+this.markers_html),a(b).find("break").remove(),this.restoreSelectionByMarkers();else if(a(c).parents(this.$element).length){for(b=this.getSelectionElement();"BREAK"==b.tagName||0===a(b).text().length&&b.parentNode!=this.$element.get(0);)b=b.parentNode;if(this.getSelectionTextInfo(b).atEnd)a(b).after(this.breakEnd(this.getDeepParent(b),!0)),this.$element.find("break").remove(),this.restoreSelectionByMarkers();else if(this.getSelectionTextInfo(b).atStart){for(;c.parentNode!=this.$element.get(0);)c=c.parentNode;a(c).before("<br/>"),this.$element.find("break").remove(),this.$element.find("a:empty").replaceWith(this.markers_html+"<br/>"),this.restoreSelectionByMarkers()}else this.breakMiddle(this.getDeepParent(b),!0),this.restoreSelectionByMarkers()}else a(c).remove()},a.Editable.prototype.enterInElement=function(b){if(["TD","TH"].indexOf(b.tagName)<0){var c=!1;if(this.emptyElement(b)&&b.parentNode&&"BLOCKQUOTE"==b.parentNode.tagName){a(b).before(this.$element.find("break"));var d=b;b=b.parentNode,a(d).remove(),c=!0}this.getSelectionTextInfo(b).atEnd?(a(b).after(this.breakEnd(b),!1),this.$element.find("break").remove(),this.restoreSelectionByMarkers()):this.getSelectionTextInfo(b).atStart?(this.options.paragraphy?c?(a(b).before("<"+this.options.defaultTag+">"+this.markers_html+this.br+"</"+this.options.defaultTag+">"),this.restoreSelectionByMarkers()):a(b).before("<"+this.options.defaultTag+">"+this.br+"</"+this.options.defaultTag+">"):c?(a(b).before(this.markers_html+"<br/>"),this.restoreSelectionByMarkers()):a(b).before("<br/>"),this.$element.find("break").remove()):"PRE"==b.tagName?(this.$element.find("break").after("<br/>"+this.markers_html),this.$element.find("break").remove(),this.restoreSelectionByMarkers()):(this.breakMiddle(b,!1,c),this.restoreSelectionByMarkers())}else this.enterInMainElement(b)},a.Editable.prototype.breakEnd=function(b,c){if(void 0===c&&(c=!1),"BLOCKQUOTE"==b.tagName){var d=a(b).contents();d.length&&"BR"==d[d.length-1].tagName&&a(d[d.length-1]).remove()}var e=a(b).find("break").get(0),f=this.br;this.options.paragraphy||(f="<br/>");var g=this.markers_html+f;for(c&&(g=this.markers_html+a.Editable.INVISIBLE_SPACE);e!=b;)"A"!=e.tagName&&"BREAK"!=e.tagName&&(g="<"+e.tagName+this.attrs(e)+">"+g+"</"+e.tagName+">"),e=e.parentNode;return c&&"A"!=e.tagName&&"BREAK"!=e.tagName&&(g="<"+e.tagName+this.attrs(e)+">"+g+"</"+e.tagName+">"),this.options.paragraphy&&(g="<"+this.options.defaultTag+">"+g+"</"+this.options.defaultTag+">"),c&&(g=f+g),g},a.Editable.prototype.breakMiddle=function(b,c,d){void 0===c&&(c=!1),void 0===d&&(d=!1);var e=a(b).find("break").get(0),f=this.markers_html;d&&(f="");for(var g="";e!=b;)e=e.parentNode,g=g+"</"+e.tagName+">",f="<"+e.tagName+this.attrs(e)+">"+f;var h="";d&&(h=this.options.paragraphy?"<"+this.options.defaultTag+">"+this.markers_html+"<br/></"+this.options.defaultTag+">":this.markers_html+"<br/>");var i="<"+b.tagName+this.attrs(b)+">"+a(b).html()+"</"+b.tagName+">";i=i.replace(/<break><\/break>/,g+(c?this.br:"")+h+f),a(b).replaceWith(i)}}(jQuery),function(a){a.Editable.prototype.isFirstSibling=function(a){var b=a.previousSibling;return b?3==b.nodeType&&""===b.textContent?this.isFirstSibling(b):!1:!0},a.Editable.prototype.isLastSibling=function(a){var b=a.nextSibling;return b?3==b.nodeType&&""===b.textContent?this.isLastSibling(b):!1:!0},a.Editable.prototype.getDeepParent=function(a){return a.parentNode==this.$element.get(0)?a:this.getDeepParent(a.parentNode)},a.Editable.prototype.attrs=function(a){for(var b="",c=a.attributes,d=0;d<c.length;d++){var e=c[d];b+=" "+e.nodeName+'="'+e.value+'"'}return b}}(jQuery),function(a){"function"==typeof define&&define.amd?define(["jquery"],a):a(jQuery)}(function(a,b){function c(a){function b(){d?(c(),M(b),e=!0,d=!1):e=!1}var c=a,d=!1,e=!1;this.kick=function(){d=!0,e||b()},this.end=function(a){var b=c;a&&(e?(c=d?function(){b(),a()}:a,d=!0):a())}}function d(){return!0}function e(){return!1}function f(a){a.preventDefault()}function g(a){N[a.target.tagName.toLowerCase()]||a.preventDefault()}function h(a){return 1===a.which&&!a.ctrlKey&&!a.altKey}function i(a,b){var c,d;if(a.identifiedTouch)return a.identifiedTouch(b);for(c=-1,d=a.length;++c<d;)if(a[c].identifier===b)return a[c]}function j(a,b){var c=i(a.changedTouches,b.identifier);if(c&&(c.pageX!==b.pageX||c.pageY!==b.pageY))return c}function k(a){var b;h(a)&&(b={target:a.target,startX:a.pageX,startY:a.pageY,timeStamp:a.timeStamp},J(document,O.move,l,b),J(document,O.cancel,m,b))}function l(a){var b=a.data;s(a,b,a,n)}function m(){n()}function n(){K(document,O.move,l),K(document,O.cancel,m)}function o(a){var b,c;N[a.target.tagName.toLowerCase()]||(b=a.changedTouches[0],c={target:b.target,startX:b.pageX,startY:b.pageY,timeStamp:a.timeStamp,identifier:b.identifier},J(document,P.move+"."+b.identifier,p,c),J(document,P.cancel+"."+b.identifier,q,c))}function p(a){var b=a.data,c=j(a,b);c&&s(a,b,c,r)}function q(a){var b=a.data,c=i(a.changedTouches,b.identifier);c&&r(b.identifier)}function r(a){K(document,"."+a,p),K(document,"."+a,q)}function s(a,b,c,d){var e=c.pageX-b.startX,f=c.pageY-b.startY;I*I>e*e+f*f||v(a,b,c,e,f,d)}function t(){return this._handled=d,!1}function u(a){try{a._handled()}catch(b){return!1}}function v(a,b,c,d,e,f){{var g,h;b.target}g=a.targetTouches,h=a.timeStamp-b.timeStamp,b.type="movestart",b.distX=d,b.distY=e,b.deltaX=d,b.deltaY=e,b.pageX=c.pageX,b.pageY=c.pageY,b.velocityX=d/h,b.velocityY=e/h,b.targetTouches=g,b.finger=g?g.length:1,b._handled=t,b._preventTouchmoveDefault=function(){a.preventDefault()},L(b.target,b),f(b.identifier)}function w(a){var b=a.data.timer;a.data.touch=a,a.data.timeStamp=a.timeStamp,b.kick()}function x(a){var b=a.data.event,c=a.data.timer;y(),D(b,c,function(){setTimeout(function(){K(b.target,"click",e)},0)})}function y(){K(document,O.move,w),K(document,O.end,x)}function z(a){var b=a.data.event,c=a.data.timer,d=j(a,b);d&&(a.preventDefault(),b.targetTouches=a.targetTouches,a.data.touch=d,a.data.timeStamp=a.timeStamp,c.kick())}function A(a){var b=a.data.event,c=a.data.timer,d=i(a.changedTouches,b.identifier);d&&(B(b),D(b,c))}function B(a){K(document,"."+a.identifier,z),K(document,"."+a.identifier,A)}function C(a,b,c){var d=c-a.timeStamp;a.type="move",a.distX=b.pageX-a.startX,a.distY=b.pageY-a.startY,a.deltaX=b.pageX-a.pageX,a.deltaY=b.pageY-a.pageY,a.velocityX=.3*a.velocityX+.7*a.deltaX/d,a.velocityY=.3*a.velocityY+.7*a.deltaY/d,a.pageX=b.pageX,a.pageY=b.pageY}function D(a,b,c){b.end(function(){return a.type="moveend",L(a.target,a),c&&c()})}function E(){return J(this,"movestart.move",u),!0}function F(){return K(this,"dragstart drag",f),K(this,"mousedown touchstart",g),K(this,"movestart",u),!0}function G(a){"move"!==a.namespace&&"moveend"!==a.namespace&&(J(this,"dragstart."+a.guid+" drag."+a.guid,f,b,a.selector),J(this,"mousedown."+a.guid,g,b,a.selector))}function H(a){"move"!==a.namespace&&"moveend"!==a.namespace&&(K(this,"dragstart."+a.guid+" drag."+a.guid),K(this,"mousedown."+a.guid))}var I=6,J=a.event.add,K=a.event.remove,L=function(b,c,d){a.event.trigger(c,d,b)},M=function(){return window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame||window.oRequestAnimationFrame||window.msRequestAnimationFrame||function(a){return window.setTimeout(function(){a()},25)}}(),N={textarea:!0,input:!0,select:!0,button:!0},O={move:"mousemove",cancel:"mouseup dragstart",end:"mouseup"},P={move:"touchmove",cancel:"touchend",end:"touchend"};a.event.special.movestart={setup:E,teardown:F,add:G,remove:H,_default:function(a){function d(){C(f,g.touch,g.timeStamp),L(a.target,f)}var f,g;a._handled()&&(f={target:a.target,startX:a.startX,startY:a.startY,pageX:a.pageX,pageY:a.pageY,distX:a.distX,distY:a.distY,deltaX:a.deltaX,deltaY:a.deltaY,velocityX:a.velocityX,velocityY:a.velocityY,timeStamp:a.timeStamp,identifier:a.identifier,targetTouches:a.targetTouches,finger:a.finger},g={event:f,timer:new c(d),touch:b,timeStamp:b},a.identifier===b?(J(a.target,"click",e),J(document,O.move,w,g),J(document,O.end,x,g)):(a._preventTouchmoveDefault(),J(document,P.move+"."+a.identifier,z,g),J(document,P.end+"."+a.identifier,A,g)))}},a.event.special.move={setup:function(){J(this,"movestart.move",a.noop)},teardown:function(){K(this,"movestart.move",a.noop)}},a.event.special.moveend={setup:function(){J(this,"movestart.moveend",a.noop)},teardown:function(){K(this,"movestart.moveend",a.noop)}},J(document,"mousedown.move",k),J(document,"touchstart.move",o),"function"==typeof Array.prototype.indexOf&&!function(a){for(var b=["changedTouches","targetTouches"],c=b.length;c--;)-1===a.event.props.indexOf(b[c])&&a.event.props.push(b[c])}(a)}),window.WYSIWYGModernizr=function(a,b,c){function d(a){n.cssText=a}function e(a,b){return typeof a===b}var f,g,h,i="2.7.1",j={},k=b.documentElement,l="modernizr",m=b.createElement(l),n=m.style,o=({}.toString," -webkit- -moz- -o- -ms- ".split(" ")),p={},q=[],r=q.slice,s=function(a,c,d,e){var f,g,h,i,j=b.createElement("div"),m=b.body,n=m||b.createElement("body");if(parseInt(d,10))for(;d--;)h=b.createElement("div"),h.id=e?e[d]:l+(d+1),j.appendChild(h);return f=["&#173;",'<style id="s',l,'">',a,"</style>"].join(""),j.id=l,(m?j:n).innerHTML+=f,n.appendChild(j),m||(n.style.background="",n.style.overflow="hidden",i=k.style.overflow,k.style.overflow="hidden",k.appendChild(n)),g=c(j,a),m?j.parentNode.removeChild(j):(n.parentNode.removeChild(n),k.style.overflow=i),!!g},t=function(b){var c=a.matchMedia||a.msMatchMedia;if(c)return c(b).matches;var d;return s("@media "+b+" { #"+l+" { position: absolute; } }",function(b){d="absolute"==(a.getComputedStyle?getComputedStyle(b,null):b.currentStyle).position}),d},u={}.hasOwnProperty;h=e(u,"undefined")||e(u.call,"undefined")?function(a,b){return b in a&&e(a.constructor.prototype[b],"undefined")}:function(a,b){return u.call(a,b)},Function.prototype.bind||(Function.prototype.bind=function(a){var b=this;if("function"!=typeof b)throw new TypeError;var c=r.call(arguments,1),d=function(){if(this instanceof d){var e=function(){};e.prototype=b.prototype;var f=new e,g=b.apply(f,c.concat(r.call(arguments)));return Object(g)===g?g:f}return b.apply(a,c.concat(r.call(arguments)))};return d}),p.touch=function(){var c;return"ontouchstart"in a||a.DocumentTouch&&b instanceof DocumentTouch?c=!0:s(["@media (",o.join("touch-enabled),("),l,")","{#modernizr{top:9px;position:absolute}}"].join(""),function(a){c=9===a.offsetTop}),c};for(var v in p)h(p,v)&&(g=v.toLowerCase(),j[g]=p[v](),q.push((j[g]?"":"no-")+g));return j.addTest=function(a,b){if("object"==typeof a)for(var d in a)h(a,d)&&j.addTest(d,a[d]);else{if(a=a.toLowerCase(),j[a]!==c)return j;b="function"==typeof b?b():b,"undefined"!=typeof enableClasses&&enableClasses&&(k.className+=" "+(b?"":"no-")+a),j[a]=b}return j},d(""),m=f=null,j._version=i,j._prefixes=o,j.mq=t,j.testStyles=s,j}(this,document),!function(a){a.Editable.prototype.coreInit=function(){var a=this,b="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",c=function(a){for(var b=a.toString(),c=0,d=0;d<b.length;d++)c+=parseInt(b.charAt(d),10);return c>10?c%9+1:c};if(a.options.key!==!1){var d=function(a,b,c){for(var d=Math.abs(c);d-->0;)a-=b;return 0>c&&(a+=123),a},e=function(a){return a},f=function(a){if(!a)return a;for(var f="",g=e("charCodeAt"),h=e("fromCharCode"),i=b.indexOf(a[0]),j=1;j<a.length-2;j++){for(var k=c(++i),l=a[g](j),m="";/[0-9-]/.test(a[j+1]);)m+=a[++j];m=parseInt(m,10)||0,l=d(l,k,m),l^=i-1&31,f+=String[h](l)}return f},g=e(f),h=function(a){return"none"==a.css("display")?(a.attr("style",a.attr("style")+g("zD4D2qJ-7dhuB-11bB4E1wqlhlfE4gjhkbB6C5eg1C-8h1besB-16e1==")),!0):!1},i=function(){for(var a=0,b=document.domain,c=b.split("."),d="_gd"+(new Date).getTime();a<c.length-1&&-1==document.cookie.indexOf(d+"="+d);)b=c.slice(-1-++a).join("."),document.cookie=d+"="+d+";domain="+b+";";return document.cookie=d+"=;expires=Thu, 01 Jan 1970 00:00:01 GMT;domain="+b+";",b}(),j=function(){var b=g(a.options.key)||"";return b!==g("eQZMe1NJGC1HTMVANU==")&&b.indexOf(i,b.length-i.length)<0&&[g("9qqG-7amjlwq=="),g("KA3B3C2A6D1D5H5H1A3==")].indexOf(i)<0?(a.$box.append(g("uA5kygD3g1h1lzrA7E2jtotjvooB2A5eguhdC-22C-16nC2B3lh1deA-21C-16B4A2B4gi1F4D1wyA-13jA4H5C2rA-65A1C10dhzmoyJ2A10A-21d1B-13xvC2I4enC4C2B5B4G4G4H1H4A10aA8jqacD1C3c1B-16D-13A-13B2E5A4jtxfB-13fA1pewxvzA3E-11qrB4E4qwB-16icA1B3ykohde1hF4A2E4clA4C7E6haA4D1xtmolf1F-10A1H4lhkagoD5naalB-22B8B4quvB-8pjvouxB3A-9plnpA2B6D6BD2D1C2H1C3C3A4mf1G-10C-8i1G3C5B3pqB-9E5B1oyejA3ddalvdrnggE3C3bbj1jC6B3D3gugqrlD8B2DB-9qC-7qkA10D2VjiodmgynhA4HA-9D-8pI-7rD4PrE-11lvhE3B5A-16C7A6A3ekuD1==")),a.$lb=a.$box.find("> div:last"),a.$ab=a.$lb.find("> a"),h(a.$lb)||h(a.$ab)):void 0};j()}},a.Editable.initializers.push(a.Editable.prototype.coreInit)}(jQuery),function(a){a.Editable.DEFAULTS=a.extend(a.Editable.DEFAULTS,{allowedBlankTags:["TEXTAREA"],selfClosingTags:["br","input","img","hr","param","!--","source","embed","!","meta","link","base"],doNotJoinTags:["a"],iconClasses:["fa-"]}),a.Editable.prototype.isClosingTag=function(a){return a?null!==a.match(/^<\/([a-zA-Z0-9]+)([^<]+)*>$/gi):!1},a.Editable.prototype.tagName=function(a){return a.replace(/^<\/?([a-zA-Z0-9-!]+)([^>]+)*>$/gi,"$1").toLowerCase()},a.Editable.SELF_CLOSING_AFTER=["source"],a.Editable.prototype.isSelfClosingTag=function(a){var b=this.tagName(a);return this.options.selfClosingTags.indexOf(b.toLowerCase())>=0},a.Editable.prototype.tagKey=function(a){return a.type+(a.attrs||[]).sort().join("|")},a.Editable.prototype.extendedKey=function(a){return this.tagKey(a)+JSON.stringify(a.style)},a.Editable.prototype.mapDOM=function(b){var c=[],d={},e={},f=0,g=this;a(b).find(".f-marker").html(a.Editable.INVISIBLE_SPACE);var h=function(b,c){if(3===b.nodeType)return[];if(8===b.nodeType)return[{comment:!0,attrs:{},styles:{},idx:f++,sp:c,ep:c,text:b.textContent}];var d=b.tagName;"B"==d&&(d="STRONG"),"I"!=d||b.className&&null!=b.className.match(new RegExp(g.options.iconClasses.join("|"),"gi"))||(d="EM");var e={},h={},i=null;if(b.attributes)for(var j=0;j<b.attributes.length;j++){var k=b.attributes[j];"style"==k.nodeName?i=k.value:e[k.nodeName]=k.value}if(i){var l=i.match(/([^:]*):([^:;]*(;|$))/gi);if(l)for(var m=0;m<l.length;m++){var n=l[m].split(":"),o=n.slice(1).join(":").trim();";"==o[o.length-1]&&(o=o.substr(0,o.length-1)),h[n[0].trim()]=o}}var p=[];if(a.isEmptyObject(e)&&"SPAN"==b.tagName&&!a.isEmptyObject(h)){for(var q in h){var r={};r[q]=h[q],p.push({selfClosing:!1,attrs:e,styles:r,idx:f++,sp:c,ep:c+b.textContent.length,tagName:d,noJoin:b.nextSibling&&"BR"===b.nextSibling.tagName})}return p}return[{selfClosing:g.options.selfClosingTags.indexOf(d.toLowerCase())>=0,attrs:e,styles:h,idx:f++,sp:c,ep:c+b.textContent.length,tagName:d,noJoin:b.nextSibling&&"BR"===b.nextSibling.tagName}]},i=function(a,g){var j,k,l;if(a!=b)for(k=h(a,g),j=0;j<k.length;j++)l=k[j],c.push(l),d[l.sp]||(d[l.sp]={}),e[l.ep]||(e[l.ep]={}),d[l.sp][l.tagName]||(d[l.sp][l.tagName]=[]),e[l.ep][l.tagName]||(e[l.ep][l.tagName]=[]),d[l.sp][l.tagName].push(l),e[l.ep][l.tagName].push(l);var m=a.childNodes;if(m){for(j=0;j<m.length;j++)j>0&&8!=m[j-1].nodeType&&(g+=m[j-1].textContent.length),i(m[j],g);if(k)for(j=0;j<k.length;j++)l=k[j],l.ci=f++,d[l.ep]||(d[l.ep]={}),d[l.ep][l.tagName]||(d[l.ep][l.tagName]=[]),d[l.ep][l.tagName].push({shadow:!0,ci:f-1})}},j=function(){var b,e,f,h;for(b in d)for(var i in d[b])for(f=0;f<d[b][i].length;f++)if(e=d[b][i][f],!e.selfClosing&&!(e.dirty||e.shadow||e.comment||e.noJoin))for(var j=f+1;j<d[b][i].length;j++)if(h=d[b][i][j],!h.selfClosing&&!(h.dirty||h.shadow||h.comment||h.noJoin||1!=Object.keys(e.styles).length||1!=Object.keys(h.styles).length||h.sp==h.ep)){var k=Object.keys(e.styles)[0];if(h.styles[k]){e.sp=h.ep;for(var l=0;l<d[e.sp][e.tagName].length;l++){var m=d[e.sp][e.tagName][l];if(m.shadow&&m.ci==h.ci){d[e.sp][e.tagName].splice(l,0,e);break}}d[b][i].splice(f,1),f--;break}}for(b=0;b<c.length;b++)if(e=c[b],!(e.dirty||e.selfClosing||e.comment||e.noJoin||e.shadow||g.options.doNotJoinTags.indexOf(e.tagName.toLowerCase())>=0||!a.isEmptyObject(e.attrs)))if(e.sp==e.ep&&a.isEmptyObject(e.attrs)&&a.isEmptyObject(e.styles)&&g.options.allowedBlankTags.indexOf(e.tagName)<0)e.dirty=!0;else if(d[e.ep]&&d[e.ep][e.tagName])for(f=0;f<d[e.ep][e.tagName].length;f++)if(h=d[e.ep][e.tagName][f],e!=h&&!(h.dirty||h.selfClosing||h.shadow||h.comment||h.noJoin||!a.isEmptyObject(h.attrs)||JSON.stringify(h.styles)!=JSON.stringify(e.styles))){e.ep<h.ep&&(e.ep=h.ep),e.sp>h.sp&&(e.sp=h.sp),h.dirty=!0,b--;break}for(b=0;b<c.length;b++)if(e=c[b],!(e.dirty||e.selfClosing||e.comment||e.noJoin||e.shadow||!a.isEmptyObject(e.attrs)))if(e.sp==e.ep&&a.isEmptyObject(e.attrs)&&a.isEmptyObject(e.style)&&g.options.allowedBlankTags.indexOf(e.tagName)<0)e.dirty=!0;else if(d[e.sp]&&d[e.sp][e.tagName])for(f=d[e.sp][e.tagName].length-1;f>=0;f--)h=d[e.sp][e.tagName][f],e!=h&&(h.dirty||h.selfClosing||h.shadow||h.comment||h.noJoin||e.ep==h.ep&&a.isEmptyObject(h.attrs)&&(e.styles=a.extend(e.styles,h.styles),h.dirty=!0))};i(b,0),j();for(var k=c.length-1;k>=0;k--)c.dirty&&c.splice(k,1);return c},a.Editable.prototype.sortNodes=function(a,b){if(a.comment)return 1;if(a.selfClosing||b.selfClosing)return a.idx-b.idx;var c=a.ep-a.sp,d=b.ep-b.sp;return 0===c&&0===d?a.idx-b.idx:c===d?b.ci-a.ci:d-c},a.Editable.prototype.openTag=function(a){var b,c="<"+a.tagName.toLowerCase(),d=Object.keys(a.attrs).sort();for(b=0;b<d.length;b++){var e=d[b];c+=" "+e+'="'+a.attrs[e]+'"'}var f="",g=Object.keys(a.styles).sort();for(b=0;b<g.length;b++){var h=g[b];null!=a.styles[h]&&(f+=h.replace("_","-")+": "+a.styles[h]+"; ")}return""!==f&&(c+=' style="'+f.trim()+'"'),c+=">"},a.Editable.prototype.commentTag=function(a){var b="";if(a.selfClosing){var c;b="<"+a.tagName.toLowerCase();var d=Object.keys(a.attrs).sort();for(c=0;c<d.length;c++){var e=d[c];b+=" "+e+'="'+a.attrs[e]+'"'}var f="",g=Object.keys(a.styles).sort();for(c=0;c<g.length;c++){var h=g[c];null!=a.styles[h]&&(f+=h.replace("_","-")+": "+a.styles[h]+"; ")}""!==f&&(b+=' style="'+f.trim()+'"'),b+="/>"}else a.comment&&(b="<!--"+a.text+"-->");return b},a.Editable.prototype.closeTag=function(a){return"</"+a.tagName.toLowerCase()+">"},a.Editable.prototype.nodesOpenedAt=function(a,b){for(var c=[],d=a.length-1;d>=0&&a[d].sp==b;)c.push(a.pop()),d--;return c},a.Editable.prototype.entity=function(a){return ch_map={">":"&gt;","<":"&lt;","&":"&amp;"},ch_map[a]?ch_map[a]:a},a.Editable.prototype.removeInvisibleWhitespace=function(a){for(var b=0;b<a.childNodes.length;b++){var c=a.childNodes[b];c.childNodes.length?this.removeInvisibleWhitespace(c):c.textContent=c.textContent.replace(/\u200B/gi,"")}},a.Editable.prototype.cleanOutput=function(b,c){var d,e,f,g;c&&this.removeInvisibleWhitespace(b);var h=this.mapDOM(b,c).sort(function(a,b){return b.sp-a.sp}),i=b.textContent;html="";var j=[],k=-1,l=a.proxy(function(){var b="";for(simple_nodes_to_close=[],j=j.sort(function(a,b){return a.idx-b.idx}).reverse();j.length;){for(var c=j.pop();simple_nodes_to_close.length&&simple_nodes_to_close[simple_nodes_to_close.length-1].ci<c.ci;)b+=this.closeTag(simple_nodes_to_close.pop());c.selfClosing||c.comment?b+=this.commentTag(c):(!a.isEmptyObject(c.attrs)||this.options.allowedBlankTags.indexOf(c.tagName)>=0)&&(b+=this.openTag(c),simple_nodes_to_close.push(c))}for(;simple_nodes_to_close.length;)b+=this.closeTag(simple_nodes_to_close.pop());html+=b},this),m={},n=[];for(d=0;d<=i.length;d++){if(m[d])for(e=m[d].length-1;e>=0;e--)if(n.length&&n[n.length-1].tagName==m[d][e].tagName&&JSON.stringify(n[n.length-1].styles)==JSON.stringify(m[d][e].styles))html+=this.closeTag(m[d][e]),n.pop();else{for(var o=[];n.length&&(n[n.length-1].tagName!==m[d][e].tagName||JSON.stringify(n[n.length-1].styles)!==JSON.stringify(m[d][e].styles));)g=n.pop(),html+=this.closeTag(g),o.push(g);for(html+=this.closeTag(m[d][e]),n.pop();o.length;){var p=o.pop();html+=this.openTag(p),n.push(p)}}for(var q=this.nodesOpenedAt(h,d).sort(this.sortNodes).reverse();q.length;){var r=q.pop();if(!r.dirty)if(r.selfClosing||r.comment)r.ci>k||"BR"==r.tagName?(l(),html+=this.commentTag(r),k=r.ci):j.length?(j.push(r),k<r.ci&&(k=r.ci)):(html+=this.commentTag(r),k<r.ci&&(k=r.ci));else if(r.ep>r.sp){r.ci>k&&l();var s=[];if("A"==r.tagName)for(var t=r.sp+1;t<r.ep;t++)if(m[t]&&m[t].length)for(f=0;f<m[t].length;f++)s.push(m[t][f]),html+=this.closeTag(m[t][f]),n.pop();var u=[];if("SPAN"==r.tagName&&("#123456"==r.styles["background-color"]||"#123456"===a.Editable.RGBToHex(r.styles["background-color"])||"#123456"==r.styles.color||"#123456"===a.Editable.RGBToHex(r.styles.color)))for(;n.length;){var v=n.pop();html+=this.closeTag(v),u.push(v)}for(html+=this.openTag(r),k<r.ci&&(k=r.ci),n.push(r),m[r.ep]||(m[r.ep]=[]),m[r.ep].push(r);s.length;)r=s.pop(),html+=this.openTag(r),n.push(r);for(;u.length;)r=u.pop(),html+=this.openTag(r),n.push(r)}else r.sp==r.ep&&(j.push(r),k<r.ci&&(k=r.ci))}l(),d!=i.length&&(html+=this.entity(i[d]))}return html=html.replace(/(<span[^>]*? class\s*=\s*["']?f-marker["']?[^>]+>)\u200B(<\/span>)/gi,"$1$2"),html},a.Editable.prototype.wrapDirectContent=function(){var b=a.merge(["UL","OL","TABLE"],this.valid_nodes);if(!this.options.paragraphy)for(var c=null,d=this.$element.contents(),e=0;e<d.length;e++)1!=d[e].nodeType||b.indexOf(d[e].tagName)<0?(c||(c=a('<div class="fr-wrap">'),a(d[e]).before(c)),c.append(d[e])):c=null},a.Editable.prototype.cleanify=function(b,c,d){if(this.browser.msie&&a.Editable.getIEversion()<9)return!1;var e;if(this.isHTML)return!1;void 0===b&&(b=!0),void 0===d&&(d=!0),this.no_verify=!0,this.$element.find("span").removeAttr("data-fr-verified"),d&&this.saveSelectionByMarkers(),b?e=this.getSelectionElements():(this.wrapDirectContent(),e=this.$element.find(this.valid_nodes.join(",")),0===e.length&&(e=[this.$element.get(0)]));var f,g;if(e[0]!=this.$element.get(0))for(var h=0;h<e.length;h++){var i=a(e[h]);0===i.find(this.valid_nodes.join(",")).length&&(f=i.html(),g=this.cleanOutput(i.get(0),c),g!==f&&i.html(g))}else 0===this.$element.find(this.valid_nodes.join(",")).length&&(f=this.$element.html(),g=this.cleanOutput(this.$element.get(0),c),g!==f&&this.$element.html(g));this.$element.find("[data-fr-idx]").removeAttr("data-fr-idx"),this.$element.find(".fr-wrap").each(function(){a(this).replaceWith(a(this).html())}),this.$element.find(".f-marker").html(""),d&&this.restoreSelectionByMarkers(),this.$element.find("span").attr("data-fr-verified",!0),this.no_verify=!1}}(jQuery);
/*!
 * froala_editor v1.2.8 (https://www.froala.com/wysiwyg-editor)
 * License https://www.froala.com/wysiwyg-editor/terms
 * Copyright 2014-2015 Froala Labs
 */

!function(a){a.Editable.prototype.refreshBlockStyles=function(){var b=this.getSelectionElements()[0],c=b.tagName.toLowerCase();this.$bttn_wrapper.find(".fr-block-style").empty();var d=this.options.blockStyles[c];if(void 0===d&&(d=this.options.defaultBlockStyle),void 0!==d){this.$bttn_wrapper.find('.fr-dropdown > button[data-name="blockStyle"].fr-trigger').removeAttr("disabled");for(var e in d){var f=d[e],g="";a(b).hasClass(e)&&(g=' class="active"'),this.$bttn_wrapper.find(".fr-block-style").append(a("<li"+g+">").append(a('<a href="#" data-text="true">').text(f).addClass(e)).attr("data-cmd","blockStyle").attr("data-val",e))}}},a.Editable.commands=a.extend(a.Editable.commands,{blockStyle:{title:"Block Style",icon:"fa fa-magic",refreshOnShow:a.Editable.prototype.refreshBlockStyles,callback:function(a,b,c){this.blockStyle(b,c)},undo:!0}}),a.Editable.DEFAULTS=a.extend(a.Editable.DEFAULTS,{defaultBlockStyle:{"f-italic":"Italic","f-typewriter":"Typewriter","f-spaced":"Spaced","f-uppercase":"Uppercase"},blockStylesToggle:!0,blockStyles:{}}),a.Editable.prototype.command_dispatcher=a.extend(a.Editable.prototype.command_dispatcher,{blockStyle:function(a){var b=this.buildDropdownBlockStyle(a),c=this.buildDropdownButton(a,b);return c}}),a.Editable.prototype.buildDropdownBlockStyle=function(){var a='<ul class="fr-dropdown-menu fr-block-style">';return a+="</ul>"},a.Editable.prototype.blockStyle=function(b){this.saveSelectionByMarkers(),this.wrapText(),this.restoreSelectionByMarkers();var c=this.getSelectionElements()[0].tagName;this.saveSelectionByMarkers();for(var d=this.getSelectionElements(),e=0;e<d.length;e++){var f=d[e];f!=this.$element.get(0)&&f.tagName==c&&(a(f).find(d).length>0||(a(f).hasClass(b)?(a(f).removeClass(b),""===a(f).attr("class")&&a(f).removeAttr("class")):(this.options.blockStylesToggle&&a(f).removeAttr("class"),a(f).addClass(b))))}this.cleanupLists(),this.restoreSelectionByMarkers(),this.triggerEvent("blockStyle")}}(jQuery);
/*!
 * froala_editor v1.2.8 (https://www.froala.com/wysiwyg-editor)
 * License https://www.froala.com/wysiwyg-editor/terms
 * Copyright 2014-2015 Froala Labs
 */

!function(a){a.Editable.DEFAULTS=a.extend(a.Editable.DEFAULTS,{colors:["#61BD6D","#1ABC9C","#54ACD2","#2C82C9","#9365B8","#475577","#CCCCCC","#41A85F","#00A885","#3D8EB9","#2969B0","#553982","#28324E","#000000","#F7DA64","#FBA026","#EB6B56","#E25041","#A38F84","#EFEFEF","#FFFFFF","#FAC51C","#F37934","#D14841","#B8312F","#7C706B","#D1D5D8","REMOVE"],colorsStep:7,colorGroups:[{text:"Text",cmd:"foreColor"},{text:"Background",cmd:"backColor"}],defaultColorGroup:"foreColor"}),a.Editable.prototype.refreshColors=function(){var a=this.getSelectionElement();this.$editor.find(".fr-color-picker button.fr-color-bttn").removeClass("active"),this.refreshColor(a,"background-color","backColor"),this.refreshColor(a,"color","foreColor")},a.Editable.prototype.refreshColor=function(b,c,d){for(;a(b).get(0)!=this.$element.get(0);){if("transparent"!==a(b).css(c)&&"rgba(0, 0, 0, 0)"!==a(b).css(c)){this.$editor.find('.fr-color-picker button.fr-color-bttn[data-param="'+d+'"][data-val="'+a.Editable.RGBToHex(a(b).css(c))+'"]').addClass("active");break}b=a(b).parent()}},a.Editable.commands=a.extend(a.Editable.commands,{color:{icon:"fa fa-tint",title:"Color",refreshOnShow:a.Editable.prototype.refreshColors,callback:function(a,b,c){this[c].apply(this,[b])},callbackWithoutSelection:function(b,c,d){"backColor"===d&&(d="background-color"),"foreColor"===d&&(d="color"),this._startInFontExec(d,b,c),"#123456"===c&&""===this.text()&&(this.cleanify(!0,!1),this.$element.find("span").each(function(b,c){var d=a(c),e=d.css("background-color");("#123456"===e||"#123456"===a.Editable.RGBToHex(e))&&d.css("background-color",""),e=d.css("color"),("#123456"===e||"#123456"===a.Editable.RGBToHex(e))&&d.css("color","")}))},undo:!0}}),a.Editable.prototype.command_dispatcher=a.extend(a.Editable.prototype.command_dispatcher,{color:function(a){var b=this.buildDropdownColor(a),c=this.buildDropdownButton(a,b,"fr-color-picker");return c}}),a.Editable.prototype.buildColorList=function(a,b){for(var c=this.options.defaultColorGroup==a?"block":"none",d='<div class="fr-color-set fr-'+a+'" style="display: '+c+'">',e=0;e<b.length;e++){var f=b[e];d+="REMOVE"!==f?'<button type="button" class="fr-color-bttn" data-val="'+f+'" data-cmd="color" data-param="'+a+'" style="background: '+f+';">&nbsp;</button>':'<button type="button" class="fr-color-bttn" data-val="#123456" data-cmd="color" data-param="'+a+'" style="background: #FFF;"><i class="fa fa-eraser"></i></button>',e%this.options.colorsStep==this.options.colorsStep-1&&e>0&&(d+="<hr/>",e!=this.options.colorsStep-1&&e!=2*this.options.colorsStep-1||!this.options.colorsTopChoices||(d+='<div class="separator"></div>'))}return d+="</div>"},a.Editable.prototype.buildDropdownColor=function(){for(var b="",c='<div class="fr-dropdown-menu">',d=0;d<this.options.colorGroups.length;d++)c+=this.buildColorList(this.options.colorGroups[d].cmd,this.options.colorGroups[d].colors||this.options.colors);for(c+="<p>",d=0;d<this.options.colorGroups.length;d++)b=this.options.defaultColorGroup==this.options.colorGroups[d].cmd?"active":"",c+='<span class="fr-choose-color '+b+'" data-text="true" data-param="'+this.options.colorGroups[d].cmd+'" style="width: '+100/this.options.colorGroups.length+'%;">'+this.options.colorGroups[d].text+"</span>";c+="</p></div>",this.$bttn_wrapper.on(this.mousedown,".fr-choose-color",function(a){return a.preventDefault(),a.stopPropagation(),"mousedown"===a.type&&1!==a.which?!0:void 0});var e=this;return this.$bttn_wrapper.on(this.mouseup,".fr-choose-color",function(b){if(b.preventDefault(),b.stopPropagation(),"mouseup"===b.type&&1!==b.which)return!0;var c=a(this);c.siblings().removeClass("active"),c.addClass("active"),c.parents(".fr-dropdown-menu").find("button").attr("data-param",c.attr("data-param")),c.parents(".fr-dropdown-menu").find(".fr-color-set").hide(),c.parents(".fr-dropdown-menu").find(".fr-color-set.fr-"+c.attr("data-param")).show(),e.refreshColors()}),c},a.Editable.prototype.backColor=function(b){this.inlineStyle("background-color","backColor",b),this.saveSelectionByMarkers(),this.$element.find("span").each(function(b,c){var d=a(c),e=d.css("background-color");("#123456"===e||"#123456"===a.Editable.RGBToHex(e))&&(d.css("background-color",""),d.find("span").each(function(b,c){var d=a(c);d.css("background-color",""),""!==d.attr("style")||d.hasClass("f-marker")||d.replaceWith(d.contents())})),""!==d.attr("style")||d.hasClass("f-marker")||d.replaceWith(d.contents())}),this.restoreSelectionByMarkers(),this.cleanify();var c=this.$editor.find('button.fr-color-bttn[data-cmd="backColor"][data-val="'+b+'"]');c.addClass("active"),c.siblings().removeClass("active")},a.Editable.prototype.foreColor=function(b){this.inlineStyle("color","foreColor",b),this.saveSelectionByMarkers(),this.$element.find("span").each(function(b,c){var d=a(c),e=d.css("color");("#123456"===e||"#123456"===a.Editable.RGBToHex(e))&&(d.css("color",""),d.find("span").each(function(b,c){var d=a(c);d.css("color",""),""!==d.attr("style")||d.hasClass("f-marker")||d.replaceWith(d.contents())})),""!==d.attr("style")||d.hasClass("f-marker")||d.replaceWith(d.contents())}),this.restoreSelectionByMarkers(),this.cleanify();var c=this.$editor.find('button.fr-color-bttn[data-cmd="foreColor"][data-val="'+b+'"]');c.addClass("active"),c.siblings().removeClass("active")}}(jQuery);
/*!
 * froala_editor v1.2.8 (https://www.froala.com/wysiwyg-editor)
 * License https://www.froala.com/wysiwyg-editor/terms
 * Copyright 2014-2015 Froala Labs
 */

!function(a){a.Editable.DEFAULTS=a.extend(a.Editable.DEFAULTS,{mediaManager:!0,imagesLoadURL:"http://i.froala.com/images",imagesLoadParams:{}}),a.Editable.prototype.showMediaManager=function(){this.$image_modal.show(),this.$overlay.show(),this.loadImages(),this.$document.find("body").css("overflow","hidden")},a.Editable.prototype.hideMediaManager=function(){this.$image_modal.hide(),this.$overlay.hide(),this.$document.find("body").css("overflow","")},a.Editable.prototype.mediaModalHTML=function(){var a='<div class="froala-modal"><div class="f-modal-wrapper"><h4><span data-text="true">Manage images</span><i title="Cancel" class="fa fa-times" id="f-modal-close-'+this._id+'"></i></h4>';return a+='<img class="f-preloader" id="f-preloader-'+this._id+'" alt="Loading..." src="'+this.options.preloaderSrc+'" style="display: none;">',a+=WYSIWYGModernizr.touch?'<div class="f-image-list f-touch" id="f-image-list-'+this._id+'"></div>':'<div class="f-image-list" id="f-image-list-'+this._id+'"></div>',a+="</div></div>"},a.Editable.prototype.buildMediaManager=function(){this.$image_modal=a(this.mediaModalHTML()).appendTo("body"),this.$preloader=this.$image_modal.find("#f-preloader-"+this._id),this.$media_images=this.$image_modal.find("#f-image-list-"+this._id),this.$overlay=a('<div class="froala-overlay">').appendTo("body"),this.$overlay.on("mouseup",a.proxy(function(a){this.isResizing()||a.stopPropagation()},this)),this.$image_modal.on("mouseup",a.proxy(function(a){this.isResizing()||a.stopPropagation()},this)),this.$image_modal.find("i#f-modal-close-"+this._id).click(a.proxy(function(){this.hideMediaManager()},this)),this.$media_images.on(this.mouseup,"img",a.proxy(function(b){b.stopPropagation();var c=b.currentTarget;this.writeImage(a(c).attr("src")),this.hideMediaManager()},this)),this.$media_images.on(this.mouseup,".f-delete-img",a.proxy(function(b){b.stopPropagation();var c=a(b.currentTarget).prev(),d="Are you sure? Image will be deleted.";a.Editable.LANGS[this.options.language]&&(d=a.Editable.LANGS[this.options.language].translation[d]),confirm(d)&&this.triggerEvent("beforeDeleteImage",[a(c)],!1)!==!1&&(a(c).parent().addClass("f-img-deleting"),this.deleteImage(a(c)))},this)),this.options.mediaManager&&(this.$image_wrapper.on("click","#f-browser-"+this._id,a.proxy(function(){this.showMediaManager()},this)).on("click","#f-browser-"+this._id+" i",a.proxy(function(){this.showMediaManager()},this)),this.$image_wrapper.find("#f-browser-"+this._id).show()),this.hideMediaManager()},a.Editable.prototype.destroyMediaManager=function(){this.hideMediaManager(),this.$overlay.html("").removeData().remove(),this.$image_modal.html("").removeData().remove()},a.Editable.prototype.initMediaManager=function(){return this.options.mediaManager?(this.buildMediaManager(),void this.addListener("destroy",this.destroyMediaManager)):!1},a.Editable.initializers.push(a.Editable.prototype.initMediaManager),a.Editable.prototype.processLoadedImages=function(a){try{if(a.error)this.throwImagesLoadErrorWithMessage(a.error);else{this.$media_images.empty();for(var b=0;b<a.length;b++)a[b].src?this.loadImage(a[b].src,a[b].info):this.loadImage(a[b])}}catch(c){this.throwLoadImagesError(4)}},a.Editable.prototype.throwImagesLoadErrorWithMessage=function(a){this.triggerEvent("imagesLoadError",[{message:a,code:0}],!1),this.hideImageLoader()},a.Editable.prototype.loadImages=function(){this.$preloader.show(),this.$media_images.empty(),this.options.imagesLoadURL?(a.support.cors=!0,a.getJSON(this.options.imagesLoadURL,this.options.imagesLoadParams,a.proxy(function(a){this.triggerEvent("imagesLoaded",[a],!1),this.processLoadedImages(a),this.$preloader.hide()},this)).fail(a.proxy(function(){this.throwLoadImagesError(2)},this))):this.throwLoadImagesError(3)},a.Editable.prototype.throwLoadImagesError=function(a){void 0===a&&(a=-1);var b="Unknown image upload error.";1==a?b="Bad link.":2==a?b="Error during request.":3==a?b="Missing imagesLoadURL option.":4==a&&(b="Parsing response failed."),this.triggerEvent("imagesLoadError",[{code:a,message:b}],!1),this.$preloader.hide()},a.Editable.prototype.loadImage=function(b,c){var d=new Image,e=a("<div>").addClass("f-empty");d.onload=a.proxy(function(){var d="Delete";a.Editable.LANGS[this.options.language]&&(d=a.Editable.LANGS[this.options.language].translation[d]);var f=a('<img src="'+b+'"/>');for(var g in c)f.attr("data-"+g,c[g]);e.append(f).append('<a class="f-delete-img"><span data-text="true">'+d+"</span></a>"),e.removeClass("f-empty"),this.$media_images.hide(),this.$media_images.show(),this.triggerEvent("imageLoaded",[b],!1)},this),d.onerror=a.proxy(function(){e.remove(),this.throwLoadImagesError(1)},this),d.src=b,this.$media_images.append(e)}}(jQuery);
/*!
 * froala_editor v1.2.8 (https://www.froala.com/wysiwyg-editor)
 * License https://www.froala.com/wysiwyg-editor/terms
 * Copyright 2014-2015 Froala Labs
 */

!function(a){a.Editable.commands=a.extend(a.Editable.commands,{table:{title:"Table",icon:"fa fa-table",callback:function(a,b,c){this.table_commands[b]?this.table_commands[b].apply(this,[b,c]):this.table_commands.insertTable.apply(this,[b,c]),this.cleanupTables()}}}),a.Editable.DEFAULTS.buttons[a.Editable.DEFAULTS.buttons.indexOf("insertHorizontalRule")]="table",a.Editable.prototype.table_commands={insertTable:function(a,b){this.insertTable(a,b)},insertRowAbove:function(){this.insertRow("above")},insertRowBelow:function(){this.insertRow("below")},insertColumnBefore:function(){this.insertColumn("before")},insertColumnAfter:function(){this.insertColumn("after")},deleteColumn:function(){this.deleteColumn()},deleteRow:function(){this.deleteRow()},insertCellBefore:function(){this.insertCell("before")},insertCellAfter:function(){this.insertCell("after")},mergeCells:function(){this.mergeCells()},deleteCell:function(){this.deleteCell()},splitVertical:function(){this.splitVertical()},splitHorizontal:function(){this.splitHorizontal()},insertHeader:function(){this.insertHeader()},deleteHeader:function(){this.deleteHeader()},deleteTable:function(){this.deleteTable()}},a.Editable.prototype.command_dispatcher=a.extend(a.Editable.prototype.command_dispatcher,{table:function(a){var b=this.buildDropdownTable(),c=this.buildDropdownButton(a,b,"fr-table");return this.bindTableDropdownEvents(),c}}),a.Editable.prototype.tableTab=function(){var b;this.currentCell&&(b=this.currentCell());var c=a(this.getSelectionElement());return c.parents("ul, ol").length>0?!0:b&&this.nextCell()?(this.setSelection(this.nextCell()),!1):void 0},a.Editable.prototype.tableShiftTab=function(){var b;this.currentCell&&(b=this.currentCell());var c=a(this.getSelectionElement());return c.parents("ul, ol").length>0?!0:b&&this.prevCell()?(this.setSelection(this.prevCell()),!1):void 0},a.Editable.prototype.initTable=function(){var b=this;this.$editor.on("click mouseup touch touchend",".fr-table a",function(c){c.preventDefault(),c.stopPropagation(),b.android()&&(a(this).parent().siblings().removeClass("hover"),a(this).parent().addClass("hover"))}),this.addListener("tab",this.tableTab),this.addListener("shift+tab",this.tableShiftTab)},a.Editable.initializers.push(a.Editable.prototype.initTable),a.Editable.prototype.buildDropdownTable=function(){var a='<ul class="fr-dropdown-menu fr-table">';a+='<li> <a href="#"><span data-text="true">Insert table</span> <i class="fa fa-chevron-right"></i></a><div class="select-table"> ',a+='<div class="fr-t-info">1 x 1</div>';for(var b=1;10>=b;b++){for(var c=1;10>=c;c++){var d="inline-block";(b>5||c>5)&&(d="none");var e="fr-bttn ";1==b&&1==c&&(e+=" hover"),a+='<span class="'+e+'" data-cmd="table" data-val="'+b+'" data-param="'+c+'" style="display: '+d+';"><span></span></span>'}a+='<div class="new-line"></div>'}return a+="</div> </li>",a+='<li><a href="#"><span data-text="true">Cell</span> <i class="fa fa-chevron-right"></i></a> <ul> <li data-cmd="table" data-val="insertCellBefore"><a href="#" data-text="true">Insert cell before</a></li><li data-cmd="table" data-val="insertCellAfter"><a href="#" data-text="true">Insert cell after</a></li><li data-cmd="table" data-val="deleteCell"><a href="#" data-text="true">Delete cell</a></li><li data-cmd="table" data-val="mergeCells"><a href="#" data-text="true">Merge cells</a></li><li data-cmd="table" data-val="splitHorizontal"><a href="#" data-text="true">Horizontal split</a></li><li data-cmd="table" data-val="splitVertical"><a href="#" data-text="true">Vertical split</a></li></ul></li>',a+='<li><a href="#"><span data-text="true">Row</span> <i class="fa fa-chevron-right"></i></a> <ul><li data-cmd="table" data-val="insertRowAbove"><a href="#" data-text="true">Insert row above</a></li><li data-cmd="table" data-val="insertRowBelow"><a href="#" data-text="true">Insert row below</a></li><li data-cmd="table" data-val="deleteRow"><a href="#" data-text="true">Delete row</a></li></ul></li>',a+='<li><a href="#"><span data-text="true">Column</span> <i class="fa fa-chevron-right"></i></a> <ul> <li data-cmd="table" data-val="insertColumnBefore"><a href="#" data-text="true">Insert column before</a></li> <li data-cmd="table" data-val="insertColumnAfter"><a href="#" data-text="true">Insert column after</a></li> <li data-cmd="table" data-val="deleteColumn"><a href="#" data-text="true">Delete column</a></li> </ul></li>',a+='<li data-cmd="table" data-val="deleteTable"><a href="#" data-text="true">Delete table</a></li>',a+="</ul>"},a.Editable.prototype.bindTableDropdownEvents=function(){var b=this;this.$bttn_wrapper.on("mouseenter",".fr-table .select-table > span",function(){var c=a(this).data("val"),d=a(this).data("param");b.$bttn_wrapper.find(".fr-table .select-table .fr-t-info").text(c+" x "+d),b.$bttn_wrapper.find(".fr-table .select-table > span").removeClass("hover");for(var e=1;10>=e;e++)for(var f=0;10>=f;f++){var g=b.$bttn_wrapper.find('.fr-table .select-table > span[data-val="'+e+'"][data-param="'+f+'"]');c>=e&&d>=f?g.addClass("hover"):(c+1>=e||5>=e)&&(d+1>=f||5>=f)?g.css("display","inline-block"):(e>5||f>5)&&g.css("display","none")}}),this.$bttn_wrapper.on("mouseleave",".fr-table .select-table",function(){b.$bttn_wrapper.find('.fr-table .select-table > span[data-val="1"][data-param="1"]').trigger("mouseenter")}),this.android()&&this.$bttn_wrapper.on("touchend",".fr-table .fr-trigger",function(){a(this).parents(".fr-table").find(".hover").removeClass("hover")})},a.Editable.prototype.tableMap=function(){var b=this.currentTable(),c=[];return b&&b.find("tr:not(:empty)").each(function(b,d){var e=a(d),f=0;e.find("th, td").each(function(d,e){for(var g=a(e),h=parseInt(g.attr("colspan"),10)||1,i=parseInt(g.attr("rowspan"),10)||1,j=b;b+i>j;j++)for(var k=f;f+h>k;k++)c[j]||(c[j]=[]),c[j][k]?f++:c[j][k]=e;f+=h})}),c},a.Editable.prototype.cellOrigin=function(a,b){for(var c=0;c<b.length;c++)for(var d=0;d<b[c].length;d++)if(b[c][d]==a)return{row:c,col:d}},a.Editable.prototype.canMergeCells=function(){var b=this.getSelectionCells();if(b.length<2)return!1;for(var c=this.tableMap(),d=0,e=32e3,f=0,g=32e3,h=0,i=0;i<b.length;i++){var j=a(b[i]),k=parseInt(j.attr("colspan"),10)||1,l=parseInt(j.attr("rowspan"),10)||1,m=this.cellOrigin(b[i],c);d+=k*l,e=Math.min(e,m.col),f=Math.max(f,m.col+k),g=Math.min(g,m.row),h=Math.max(h,m.row+l)}return d==(f-e)*(h-g)?{row:g,col:e,colspan:f-e,rowspan:h-g,map:c,cells:b}:null},a.Editable.prototype.getSelectionCells=function(){var b,c=[];if(this.browser.webkit||this.browser.msie){var d=this.getSelectionElements();for(b=0;b<d.length;b++)("TD"==d[b].tagName||"TH"==d[b].tagName)&&c.push(d[b])}else{var e=this.getRanges();for(b=0;b<e.length;b++){var f=e[b],g=!1;if("TD"==f.startContainer.tagName||"TH"==f.startContainer.tagName)c.push(f.startContainer),g=!0;else{var h=f.startContainer.childNodes,i=f.startOffset;if(h.length>i&&i>=0){var j=h[i];("TD"==j.tagName||"TH"==j.tagName)&&(c.push(j),g=!0)}}if(g===!1){var k=a(f.startContainer).parents("td:first, th:first");k.length>0&&c.push(k.get(0))}}}return c},a.Editable.prototype.currentCell=function(){var a=this.getSelectionCells();return a.length>0?a[0]:null},a.Editable.prototype.prevCell=function(){var b=this.currentCell();if(b){if(a(b).prev("td").length)return a(b).prev("td").get(0);if(a(b).parent().prev("tr").find("td").length)return a(b).parent().prev("tr").find("td:last").get(0)}return null},a.Editable.prototype.nextCell=function(){var b=this.currentCell();if(b){if(a(b).next("td").length)return a(b).next("td").get(0);if(a(b).parent().next("tr").find("td").length)return a(b).parent().next("tr").find("td").get(0)}return null},a.Editable.prototype.currentTable=function(){for(var b=a(this.getSelectionElement());b.get(0)!=this.$element.get(0)&&b.get(0)!=this.$document.find("body").get(0)&&"TABLE"!=b.get(0).tagName;)b=b.parent();return b.get(0)!=this.$element.get(0)?b:null},a.Editable.prototype.focusOnTable=function(){var a=this.currentTable();if(a){var b=a.find("td:first");this.setSelection(b.get(0))}},a.Editable.prototype.insertCell=function(b){for(var c=this.getSelectionCells(),d=0;d<c.length;d++){var e=a(c[d]);"before"==b?e.before(e.clone().removeAttr("colspan").removeAttr("rowspan").html(a.Editable.INVISIBLE_SPACE)):"after"==b&&e.after(e.clone().removeAttr("colspan").removeAttr("rowspan").html(a.Editable.INVISIBLE_SPACE))}"before"==b?this.triggerEvent("cellInsertedBefore"):"after"==b&&this.triggerEvent("cellInsertedAfter")},a.Editable.prototype.mergeCells=function(){var b=this.canMergeCells();if(b){var c=a(b.map[b.row][b.col]);c.attr("colspan",b.colspan),c.attr("rowspan",b.rowspan);for(var d=0;d<b.cells.length;d++){var e=b.cells[d];if(c.get(0)!=e){var f=a(e);c.append(f.html()),f.remove()}}this.setSelection(c.get(0))}this.hide(),this.triggerEvent("cellsMerged")},a.Editable.prototype.deleteCell=function(){for(var b=this.getSelectionCells(),c=0;c<b.length;c++){var d=a(b[c]);d.remove()}this.focusOnTable(),this.hide(),this.triggerEvent("cellDeleted")},a.Editable.prototype.insertHeader=function(){var a=this.currentTable();a&&a.find(" > thead").length>0&&this.triggerEvent("headerInserted")},a.Editable.prototype.deleteHeader=function(){},a.Editable.prototype.insertColumn=function(b){var c=this.currentCell();if(c)for(var d=a(c),e=this.tableMap(),f=this.cellOrigin(d.get(0),e),g=0;g<e.length;g++){var h=e[g][f.col],i=parseInt(a(h).attr("colspan"),10)||1,j=parseInt(a(h).attr("rowspan"),10)||1;if("before"==b){var k=e[g][f.col-1];k?k==h?a(k).attr("colspan",i+1):j>1?a(k).after("<"+k.tagName+">"+a.Editable.INVISIBLE_SPACE+"</"+k.tagName+">"):a(h).before("<"+h.tagName+">"+a.Editable.INVISIBLE_SPACE+"</"+h.tagName+">"):a(h).before("<"+h.tagName+">"+a.Editable.INVISIBLE_SPACE+"</"+h.tagName+">")}else if("after"==b){var l=e[g][f.col+1];l?l==h?a(l).attr("colspan",i+1):j>1?a(l).before("<"+l.tagName+">"+a.Editable.INVISIBLE_SPACE+"</"+l.tagName+">"):a(h).after("<"+h.tagName+">"+a.Editable.INVISIBLE_SPACE+"</"+h.tagName+">"):a(h).after("<"+h.tagName+">"+a.Editable.INVISIBLE_SPACE+"</"+h.tagName+">")}}this.hide(),"before"==b?this.triggerEvent("columnInsertedBefore"):"after"==b&&this.triggerEvent("columnInsertedAfter")},a.Editable.prototype.deleteColumn=function(){for(var b=this.getSelectionCells(),c=0;c<b.length;c++)for(var d=a(b[c]),e=this.tableMap(),f=this.cellOrigin(d.get(0),e),g=0;g<e.length;g++){var h=e[g][f.col],i=parseInt(a(h).attr("colspan"),10)||1;1==i?a(h).remove():a(h).attr("colspan",i-1)}this.focusOnTable(),this.hide(),this.triggerEvent("columnDeleted")},a.Editable.prototype.insertRow=function(b){var c,d=this.currentCell();if(d){var e=a(d),f=this.tableMap(),g=this.cellOrigin(e.get(0),f),h=0,i=null;for(c=0;c<f[g.row].length;c++){var j=f[g.row][c],k=parseInt(a(j).attr("rowspan"),10)||1;if("above"==b)if(0===g.row)h++;else{var l=f[g.row-1][c];l==j&&i!=j?a(j).attr("rowspan",k+1):h++}else if("below"==b)if(g.row==f.length-1)h++;else{var m=f[g.row+1][c];m==j&&i!=j?a(j).attr("rowspan",k+1):h++}i=f[g.row][c]}var n="<tr>";for(c=0;h>c;c++)n+="<td>"+a.Editable.INVISIBLE_SPACE+"</td>";n+="</tr>","below"==b?e.closest("tr").after(n):"above"==b&&e.closest("tr").before(n)}this.hide(),"below"==b?this.triggerEvent("rowInsertedBelow"):"above"==b&&this.triggerEvent("rowInsertedAbove")},a.Editable.prototype.deleteRow=function(){for(var b=this.getSelectionCells(),c=0;c<b.length;c++){var d=a(b[c]),e=this.tableMap(),f=this.cellOrigin(d.get(0),e),g=d.parents("tr:first");if(f)for(var h=0;h<e[f.row].length;h++){var i=e[f.row][h],j=parseInt(a(i).attr("rowspan"),10)||1;if(1==j)a(i).remove();else{var k=this.cellOrigin(i,e);if(a(i).attr("rowspan",j-1),k.row==f.row){var l=e[f.row+1];l&&l[h-1]&&(a(l[h-1]).after(a(i).clone()),a(i).remove())}}}g.remove()}this.focusOnTable(),this.hide(),this.triggerEvent("rowDeleted")},a.Editable.prototype.splitVertical=function(){for(var b=this.getSelectionCells(),c=0;c<b.length;c++){var d=a(b[c]),e=this.tableMap(),f=this.cellOrigin(d.get(0),e),g=parseInt(d.attr("colspan"),10)||1,h=parseInt(d.attr("rowspan"),10)||1;if(h>1){var i=Math.floor(h/2),j=f.row+(h-i),k=e[j][f.col-1];k||(k=e[j][f.col+g]),k?a(k).before(d.clone().attr("rowspan",i).html(a.Editable.INVISIBLE_SPACE)):d.parents("tr:first").after(a("<tr>").append(d.clone().attr("rowspan",i).html(a.Editable.INVISIBLE_SPACE))),d.attr("rowspan",h-i)}else{for(var l=a("<tr>").append(d.clone().html(a.Editable.INVISIBLE_SPACE)),m=null,n=0;n<e[f.row].length;n++){var o=e[f.row][n],p=parseInt(a(o).attr("rowspan"),10)||1;m!=o&&o!=d.get(0)&&a(o).attr("rowspan",p+1),m=o}d.parents("tr:first").after(l)}}this.hide(),this.triggerEvent("cellVerticalSplit")},a.Editable.prototype.splitHorizontal=function(){for(var b=this.getSelectionCells(),c=0;c<b.length;c++){var d=a(b[c]),e=this.tableMap(),f=this.cellOrigin(d.get(0),e),g=parseInt(d.attr("colspan"),10)||1;if(g>1){var h=Math.floor(g/2);d.after(d.clone().attr("colspan",h).html(a.Editable.INVISIBLE_SPACE)),d.attr("colspan",g-h)}else{for(var i=null,j=0;j<e.length;j++){var k=e[j][f.col],l=parseInt(a(k).attr("colspan"),10)||1;i!=k&&k!=d.get(0)&&a(k).attr("colspan",l+1),i=k}d.after(d.clone().html(a.Editable.INVISIBLE_SPACE))}}this.hide(),this.triggerEvent("cellHorizontalSplit")},a.Editable.prototype.insertTable=function(b,c){for(var d='<table data-last-table="true" width="100%">',e=0;b>e;e++){d+="<tr>";for(var f=0;c>f;f++)d+="<td>"+a.Editable.INVISIBLE_SPACE+"</td>";d+="</tr>"}d+="</table>",this.focus();var g=this.getSelectionElement();this.breakHTML(d,this.parents(a(g),"li").length<0);var h=this.$element.find('table[data-last-table="true"]');h.removeAttr("data-last-table"),this.setSelection(h.find("td:first").get(0)),this.hide(),this.triggerEvent("tableInserted")},a.Editable.prototype.deleteTable=function(){var a=this.currentTable();a&&(a.remove(),this.focus(),this.hide(),this.triggerEvent("tableDeleted"))},a.Editable.prototype.cleanupTables=function(){this.$element.find('td[colspan="1"], th[colspan="1"]').each(function(){a(this).removeAttr("colspan")}),this.$element.find('td[rowspan="1"], th[rowspan="1"]').each(function(){a(this).removeAttr("rowspan")})}}(jQuery);
/*!
 * froala_editor v1.2.8 (https://www.froala.com/wysiwyg-editor)
 * License https://www.froala.com/wysiwyg-editor/terms
 * Copyright 2014-2015 Froala Labs
 */

!function(a){a.Editable.DEFAULTS=a.extend(a.Editable.DEFAULTS,{videoAllowedAttrs:["src","width","height","frameborder","allowfullscreen","webkitallowfullscreen","mozallowfullscreen","href","target","id","controls","value","name"],videoAllowedTags:["iframe","object","param","video","source","embed"],defaultVideoAlignment:"center",textNearVideo:!0}),a.Editable.VIDEO_PROVIDERS=[{test_regex:/^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/,url_regex:/(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/)?(.+)/g,url_text:"//www.youtube.com/embed/$1",html:'<iframe width="640" height="360" src="{url}" frameborder="0" allowfullscreen></iframe>'},{test_regex:/^.*(vimeo\.com\/)((channels\/[A-z]+\/)|(groups\/[A-z]+\/videos\/))?([0-9]+)/,url_regex:/(?:https?:\/\/)?(?:www\.)?(?:vimeo\.com)\/(?:channels\/[A-z]+\/|groups\/[A-z]+\/videos\/)?(.+)/g,url_text:"//player.vimeo.com/video/$1",html:'<iframe width="640" height="360" src="{url}" frameborder="0" allowfullscreen></iframe>'},{test_regex:/^.+(dailymotion.com|dai.ly)\/(video|hub)?\/?([^_]+)[^#]*(#video=([^_&]+))?/,url_regex:/(?:https?:\/\/)?(?:www\.)?(?:dailymotion\.com|dai\.ly)\/(?:video|hub)?\/?(.+)/g,url_text:"//www.dailymotion.com/embed/video/$1",html:'<iframe width="640" height="360" src="{url}" frameborder="0" allowfullscreen></iframe>'},{test_regex:/^.+(screen.yahoo.com)\/(videos-for-you|popular)?\/[^_&]+/,url_regex:"",url_text:"",html:'<iframe width="640" height="360" src="{url}?format=embed" frameborder="0" allowfullscreen="true" mozallowfullscreen="true" webkitallowfullscreen="true" allowtransparency="true"></iframe>'}],a.Editable.video_commands={floatVideoLeft:{title:"Float Left",icon:{type:"font",value:"fa fa-align-left"}},floatVideoNone:{title:"Float None",icon:{type:"font",value:"fa fa-align-justify"}},floatVideoRight:{title:"Float Right",icon:{type:"font",value:"fa fa-align-right"}},removeVideo:{title:"Remove Video",icon:{type:"font",value:"fa fa-trash-o"}}},a.Editable.DEFAULTS=a.extend(a.Editable.DEFAULTS,{videoButtons:["floatVideoLeft","floatVideoNone","floatVideoRight","removeVideo"]}),a.Editable.commands=a.extend(a.Editable.commands,{insertVideo:{title:"Insert Video",icon:"fa fa-video-camera",callback:function(){this.insertVideo()},undo:!1}}),a.Editable.prototype.insertVideo=function(){this.options.inlineMode||(this.closeImageMode(),this.imageMode=!1,this.positionPopup("insertVideo")),this.selectionInEditor()&&this.saveSelection(),this.showInsertVideo(),this.$video_wrapper.find("textarea").val("")},a.Editable.prototype.insertVideoHTML=function(){var a='<div class="froala-popup froala-video-popup" style="display: none;"><h4><span data-text="true">Insert Video</span><i title="Cancel" class="fa fa-times" id="f-video-close-'+this._id+'"></i></h4><div class="f-popup-line"><textarea placeholder="Embedded code" id="f-video-textarea-'+this._id+'"></textarea></div><p class="or"><span data-text="true">or</span></p><div class="f-popup-line"><input type="text" placeholder="http://youtube.com/" id="f-video-input-'+this._id+'"/><button data-text="true" class="f-ok f-submit fr-p-bttn" id="f-video-ok-'+this._id+'">OK</button></div></div>';return a},a.Editable.prototype.buildInsertVideo=function(){this.$video_wrapper=a(this.insertVideoHTML()),this.$popup_editor.append(this.$video_wrapper),this.addListener("hidePopups",this.hideVideoWrapper),this.$video_wrapper.on("mouseup touchend",a.proxy(function(a){this.isResizing()||a.stopPropagation()},this)),this.$video_wrapper.on("mouseup keydown","input#f-video-input-"+this._id+", textarea#f-video-textarea-"+this._id,a.proxy(function(a){a.stopPropagation()},this));var b=this;this.$video_wrapper.on("change","input#f-video-input-"+this._id+", textarea#f-video-textarea-"+this._id,function(){"INPUT"==this.tagName?b.$video_wrapper.find("textarea#f-video-textarea-"+b._id).val(""):"TEXTAREA"==this.tagName&&b.$video_wrapper.find("input#f-video-input-"+b._id).val("")}),this.$video_wrapper.on("click","button#f-video-ok-"+this._id,a.proxy(function(){var a=this.$video_wrapper.find("input#f-video-input-"+this._id),b=this.$video_wrapper.find("textarea#f-video-textarea-"+this._id);""!==a.val()?this.writeVideo(a.val(),!1):""!==b.val()&&this.writeVideo(b.val(),!0)},this)),this.$video_wrapper.on(this.mouseup,"i#f-video-close-"+this._id,a.proxy(function(){this.$bttn_wrapper.show(),this.hideVideoWrapper(),this.options.inlineMode&&!this.imageMode&&0===this.options.buttons.length&&this.hide(),this.restoreSelection(),this.focus(),this.options.inlineMode||this.hide()},this)),this.$video_wrapper.on("click",function(a){a.stopPropagation()}),this.$video_wrapper.on("click","*",function(a){a.stopPropagation()}),this.$window.on("keydown."+this._id,a.proxy(function(b){if(this.$element.find(".f-video-editor.active").length>0){var c=b.which;if(46==c||8==c)return b.stopPropagation(),b.preventDefault(),setTimeout(a.proxy(function(){this.removeVideo()},this),0),!1}},this))},a.Editable.prototype.destroyVideo=function(){this.$video_wrapper.html("").removeData().remove()},a.Editable.prototype.initVideo=function(){this.buildInsertVideo(),this.addVideoControls(),this.addListener("destroy",this.destroyVideo)},a.Editable.initializers.push(a.Editable.prototype.initVideo),a.Editable.prototype.hideVideoEditorPopup=function(){this.$video_editor&&(this.$video_editor.hide(),a("span.f-video-editor").removeClass("active"),this.$element.removeClass("f-non-selectable"),this.editableDisabled||this.isHTML||this.$element.attr("contenteditable",!0))},a.Editable.prototype.showVideoEditorPopup=function(){this.hidePopups(),this.$video_editor&&this.$video_editor.show(),this.$element.removeAttr("contenteditable")},a.Editable.prototype.addVideoControlsHTML=function(){this.$video_editor=a('<div class="froala-popup froala-video-editor-popup" style="display: none">');for(var b=a('<div class="f-popup-line">').appendTo(this.$video_editor),c=0;c<this.options.videoButtons.length;c++){var d=this.options.videoButtons[c];if(void 0!==a.Editable.video_commands[d]){var e=a.Editable.video_commands[d],f='<button class="fr-bttn" data-callback="'+d+'" data-cmd="'+d+'" title="'+e.title+'">';f+=void 0!==this.options.icons[d]?this.prepareIcon(this.options.icons[d],e.title):this.prepareIcon(e.icon,e.title),f+="</button>",b.append(f)}}this.addListener("hidePopups",this.hideVideoEditorPopup),this.$popup_editor.append(this.$video_editor),this.bindCommandEvents(this.$video_editor)},a.Editable.prototype.floatVideoLeft=function(){a("span.f-video-editor.active").attr("class","f-video-editor active fr-fvl"),this.triggerEvent("videoFloatedLeft"),a("span.f-video-editor.active").click()},a.Editable.prototype.floatVideoRight=function(){a("span.f-video-editor.active").attr("class","f-video-editor active fr-fvr"),this.triggerEvent("videoFloatedRight"),a("span.f-video-editor.active").click()},a.Editable.prototype.floatVideoNone=function(){a("span.f-video-editor.active").attr("class","f-video-editor active fr-fvn"),this.triggerEvent("videoFloatedNone"),a("span.f-video-editor.active").click()},a.Editable.prototype.removeVideo=function(){a("span.f-video-editor.active").remove(),this.hide(),this.triggerEvent("videoRemoved"),this.focus()},a.Editable.prototype.refreshVideo=function(){this.$element.find("iframe, object").each(function(b,c){for(var d=a(c),e=0;e<a.Editable.VIDEO_PROVIDERS.length;e++){var f=a.Editable.VIDEO_PROVIDERS[e];if(f.test_regex.test(d.attr("src"))){0===d.parents(".f-video-editor").length&&d.wrap('<span class="f-video-editor fr-fvn" data-fr-verified="true" contenteditable="false">');break}}}),this.browser.msie&&this.$element.find(".f-video-editor").each(function(){this.oncontrolselect=function(){return!1}}),this.options.textNearVideo||this.$element.find(".f-video-editor").attr("contenteditable",!1).addClass("fr-tnv")},a.Editable.prototype.addVideoControls=function(){this.addVideoControlsHTML(),this.addListener("sync",this.refreshVideo),this.$element.on("mousedown","span.f-video-editor",a.proxy(function(a){a.stopPropagation()},this)),this.$element.on("click touchend","span.f-video-editor",a.proxy(function(b){if(this.isDisabled)return!1;b.preventDefault(),b.stopPropagation();var c=b.currentTarget;this.clearSelection(),this.showVideoEditorPopup(),this.showByCoordinates(a(c).offset().left+a(c).width()/2,a(c).offset().top+a(c).height()+3),a(c).addClass("active"),this.refreshVideoButtons(c)},this))},a.Editable.prototype.refreshVideoButtons=function(b){var c=a(b).attr("class");this.$video_editor.find("[data-cmd]").removeClass("active"),c.indexOf("fr-fvl")>=0?this.$video_editor.find('[data-cmd="floatVideoLeft"]').addClass("active"):c.indexOf("fr-fvr")>=0?this.$video_editor.find('[data-cmd="floatVideoRight"]').addClass("active"):this.$video_editor.find('[data-cmd="floatVideoNone"]').addClass("active")},a.Editable.prototype.writeVideo=function(b,c){var d=null;if(c)d=this.clean(b,!0,!1,this.options.videoAllowedTags,this.options.videoAllowedAttrs);else for(var e=0;e<a.Editable.VIDEO_PROVIDERS.length;e++){var f=a.Editable.VIDEO_PROVIDERS[e];if(f.test_regex.test(b)){b=b.replace(f.url_regex,f.url_text),d=f.html.replace(/\{url\}/,b);break}}if(d){this.restoreSelection(),this.$element.focus();var g="fr-fvn";"left"==this.options.defaultVideoAlignment&&(g="fr-fvl"),"right"==this.options.defaultVideoAlignment&&(g="fr-fvr"),this.textNearVideo||(g+=" fr-tnv");try{this.insertHTML('<span contenteditable="false" class="f-video-editor '+g+'" data-fr-verified="true">'+d+"</span>")}catch(h){}this.$bttn_wrapper.show(),this.hideVideoWrapper(),this.hide(),this.triggerEvent("videoInserted",[d])}else this.triggerEvent("videoError")},a.Editable.prototype.showVideoWrapper=function(){this.$video_wrapper&&(this.$video_wrapper.show(),this.$video_wrapper.find(".f-popup-line input").val(""))},a.Editable.prototype.hideVideoWrapper=function(){this.$video_wrapper&&(this.$video_wrapper.hide(),this.$video_wrapper.find("input").blur())},a.Editable.prototype.showInsertVideo=function(){this.hidePopups(),this.showVideoWrapper()}}(jQuery);
/*!
 * froala_editor v1.2.8 (https://www.froala.com/wysiwyg-editor)
 * License https://www.froala.com/wysiwyg-editor/terms
 * Copyright 2014-2015 Froala Labs
 */

!function(a){a.Editable.DEFAULTS=a.extend(a.Editable.DEFAULTS,{fontList:{"Arial,Helvetica":"Arial, Helvetica","Courier,Courier New":"Courier, Courier New",Georgia:"Georgia","Times New Roman,Times":"Times New Roman,Times","Trebuchet MS":"Trebuchet MS","Verdana, Geneva":"Verdana,Geneva"}}),a.Editable.prototype.refreshFontFamily=function(){var b=a(this.getSelectionElement());this.$editor.find('.fr-dropdown > button[data-name="fontFamily"] + ul li').removeClass("active"),this.$editor.find('.fr-dropdown > button[data-name="fontFamily"] + ul li[data-val="'+b.css("font-family").replace(/"/gi,'\\"')+'"]').addClass("active")},a.Editable.commands=a.extend(a.Editable.commands,{fontFamily:{title:"Font Family",icon:"fa fa-font",refreshOnShow:a.Editable.prototype.refreshFontFamily,callback:function(a,b){this.inlineStyle("font-family",a,b)},undo:!0,callbackWithoutSelection:function(a,b){this._startInFontExec("font-family",a,b)}}}),a.Editable.prototype.command_dispatcher=a.extend(a.Editable.prototype.command_dispatcher,{fontFamily:function(a){var b=this.buildDropdownFontFamily(),c=this.buildDropdownButton(a,b,"fr-family");return c}}),a.Editable.prototype.buildDropdownFontFamily=function(){var a='<ul class="fr-dropdown-menu">';for(var b in this.options.fontList){var c=this.options.fontList[b],d='<li data-cmd="fontFamily" data-val="'+b+'">';d+='<a href="#" data-text="true" title="'+c+'" style="font-family: '+b+';">'+c+"</a></li>",a+=d}return a+="</ul>"}}(jQuery);
/*!
 * froala_editor v1.2.8 (https://www.froala.com/wysiwyg-editor)
 * License https://www.froala.com/wysiwyg-editor/terms
 * Copyright 2014-2015 Froala Labs
 */

!function(a){a.Editable.prototype.refreshFontSize=function(){var b=a(this.getSelectionElement()),c=parseInt(b.css("font-size").replace(/px/g,""),10)||16;this.$editor.find('.fr-dropdown > button[data-name="fontSize"] + ul li').removeClass("active"),this.$editor.find('.fr-dropdown > button[data-name="fontSize"] + ul li[data-val="'+c+'px"]').addClass("active")},a.Editable.commands=a.extend(a.Editable.commands,{fontSize:{title:"Font Size",icon:"fa fa-text-height",refreshOnShow:a.Editable.prototype.refreshFontSize,seed:[{min:11,max:52}],undo:!0,callback:function(a,b){this.inlineStyle("font-size",a,b)},callbackWithoutSelection:function(a,b){this._startInFontExec("font-size",a,b)}}}),a.Editable.prototype.command_dispatcher=a.extend(a.Editable.prototype.command_dispatcher,{fontSize:function(a){var b=this.buildDropdownFontsize(a),c=this.buildDropdownButton(a,b);return c}}),a.Editable.prototype.buildDropdownFontsize=function(a){for(var b='<ul class="fr-dropdown-menu f-font-sizes">',c=0;c<a.seed.length;c++)for(var d=a.seed[c],e=d.min;e<=d.max;e++)b+='<li data-cmd="'+a.cmd+'" data-val="'+e+'px"><a href="#"><span>'+e+"px</span></a></li>";return b+="</ul>"}}(jQuery);
/*!
 * froala_editor v1.2.8 (https://www.froala.com/wysiwyg-editor)
 * License https://www.froala.com/wysiwyg-editor/terms
 * Copyright 2014-2015 Froala Labs
 */

!function(a){a.Editable.commands=a.extend(a.Editable.commands,{uploadFile:{title:"Upload File",icon:"fa fa-paperclip",callback:function(){this.insertFile()},undo:!1}}),a.Editable.DEFAULTS=a.extend(a.Editable.DEFAULTS,{allowedFileTypes:["*"],fileDeleteUrl:null,fileDeleteParams:{},fileUploadParams:{},fileUploadURL:"http://i.froala.com/upload",fileUploadParam:"file",maxFileSize:10485760,useFileName:!0}),a.Editable.prototype.showFileWrapper=function(){this.$file_wrapper&&this.$file_wrapper.show()},a.Editable.prototype.hideFileWrapper=function(){this.$file_wrapper&&(this.$file_wrapper.hide(),this.$file_wrapper.find("input").blur())},a.Editable.prototype.showFileUpload=function(){this.hidePopups(),this.showFileWrapper()},a.Editable.prototype.insertFile=function(){this.closeImageMode(),this.imageMode=!1,this.showFileUpload(),this.saveSelectionByMarkers(),this.options.inlineMode||this.positionPopup("uploadFile")},a.Editable.prototype.fileUploadHTML=function(){var b='<div class="froala-popup froala-file-popup" style="display: none;"><h4><span data-text="true">Upload file</span><i title="Cancel" class="fa fa-times" id="f-file-close-'+this._id+'"></i></h4>';return b+='<div id="f-file-list-'+this._id+'">',b+='<div class="f-popup-line drop-upload">',b+='<div class="f-upload" id="f-file-upload-div-'+this._id+'"><strong data-text="true">Drop File</strong><br>(<span data-text="true">or click</span>)<form target="file-frame-'+this._id+'" enctype="multipart/form-data" encoding="multipart/form-data" action="'+this.options.fileUploadURL+'" method="post" id="f-file-form-'+this._id+'"><input id="f-file-upload-'+this._id+'" type="file" name="'+this.options.fileUploadParam+'" accept="/*"></form></div>',this.browser.msie&&a.Editable.getIEversion()<=9&&(b+='<iframe id="file-frame-'+this._id+'" name="file-frame-'+this._id+'" src="javascript:false;" style="width:0; height:0; border:0px solid #FFF; position: fixed; z-index: -1;" data-loaded="true"></iframe>'),b+="</div>",b+="</div>",b+='<p class="f-progress" id="f-file-progress-'+this._id+'"><span></span></p>',b+="</div>"},a.Editable.prototype.buildFileDrag=function(){var b=this;b.$file_wrapper.on("dragover","#f-file-upload-div-"+this._id,function(){return a(this).addClass("f-hover"),!1}),b.$file_wrapper.on("dragend","#f-file-upload-div-"+this._id,function(){return a(this).removeClass("f-hover"),!1}),b.$file_wrapper.on("drop","#f-file-upload-div-"+this._id,function(c){c.preventDefault(),c.stopPropagation(),a(this).removeClass("f-hover"),b.uploadFile(c.originalEvent.dataTransfer.files)}),b.$element.on("drop",function(c){var d=c.originalEvent.dataTransfer.files;if(0===a(".froala-element img.fr-image-move").length&&c.originalEvent.dataTransfer&&d&&d.length){if(b.isDisabled)return!1;b.options.allowedImageTypes.indexOf(d[0].type.replace(/image\//g,""))<0&&(b.closeImageMode(),b.hide(),b.imageMode=!1,b.initialized||(b.$element.unbind("mousedown.element"),b.lateInit()),b.insertMarkersAtPoint(c.originalEvent),b.showByCoordinates(c.originalEvent.pageX,c.originalEvent.pageY),b.uploadFile(d),c.preventDefault(),c.stopPropagation())}})},a.Editable.prototype.buildFileUpload=function(){this.$file_wrapper=a(this.fileUploadHTML()),this.$popup_editor.append(this.$file_wrapper),this.buildFileDrag();var b=this;if(this.$file_wrapper.on("mouseup touchend",a.proxy(function(a){this.isResizing()||a.stopPropagation()},this)),this.addListener("hidePopups",a.proxy(function(){this.hideFileWrapper()},this)),this.$file_progress_bar=this.$file_wrapper.find("p#f-file-progress-"+this._id),this.browser.msie&&a.Editable.getIEversion()<=9){var c=this.$file_wrapper.find("iframe").get(0);c.attachEvent?c.attachEvent("onload",function(){b.iFrameLoad()}):c.onload=function(){b.iFrameLoad()}}this.$file_wrapper.on("change",'input[type="file"]',function(){if(void 0!==this.files)b.uploadFile(this.files);else{var c=a(this).parents("form");c.find('input[type="hidden"]').remove();var d;for(d in b.options.fileUploadParams)c.prepend('<input type="hidden" name="'+d+'" value="'+b.options.fileUploadParams[d]+'" />');b.$file_wrapper.find("#f-file-list-"+b._id).hide(),b.$file_progress_bar.show(),b.$file_progress_bar.find("span").css("width","100%").text("Please wait!"),b.showFileUpload(),c.submit()}a(this).val("")}),this.$file_wrapper.on(this.mouseup,"#f-file-close-"+this._id,a.proxy(function(a){a.stopPropagation(),a.preventDefault(),this.$bttn_wrapper.show(),this.hideFileWrapper(),this.restoreSelection(),this.focus(),this.hide()},this)),this.$file_wrapper.on("click",function(a){a.stopPropagation()}),this.$file_wrapper.on("click","*",function(a){a.stopPropagation()})},a.Editable.initializers.push(a.Editable.prototype.buildFileUpload),a.Editable.prototype.uploadFile=function(b){if(!this.triggerEvent("beforeFileUpload",[b],!1))return!1;if(void 0!==b&&b.length>0){var c;if(this.drag_support.formdata&&(c=this.drag_support.formdata?new FormData:null),c){var d;for(d in this.options.fileUploadParams)c.append(d,this.options.fileUploadParams[d]);if(c.append(this.options.fileUploadParam,b[0]),b[0].size>this.options.maxFileSize)return this.throwFileError(5),!1;if(this.options.allowedFileTypes.indexOf(b[0].type)<0&&this.options.allowedFileTypes.indexOf("*")<0)return this.throwFileError(6),!1}if(c){var e;if(this.options.crossDomain)e=this.createCORSRequest("POST",this.options.fileUploadURL);else{e=new XMLHttpRequest,e.open("POST",this.options.fileUploadURL);for(var f in this.options.headers)e.setRequestHeader(f,this.options.headers[f])}var g=b[0].name;e.onload=a.proxy(function(){this.$file_progress_bar.find("span").css("width","100%").text("Please wait!");try{e.status>=200&&e.status<300?this.parseFileResponse(e.responseText,g):this.throwFileError(3)}catch(a){this.throwFileError(4)}},this),e.onerror=a.proxy(function(){this.throwFileError(3)},this),e.upload.onprogress=a.proxy(function(a){if(a.lengthComputable){var b=a.loaded/a.total*100|0;this.$file_progress_bar.find("span").css("width",b+"%")}},this),e.send(c),this.$file_wrapper.find("#f-file-list-"+this._id).hide(),this.$file_progress_bar.show(),this.showFileUpload()}}},a.Editable.prototype.throwFileError=function(a){var b="Unknown file upload error.";1==a?b="Bad link.":2==a?b="No link in upload response.":3==a?b="Error during file upload.":4==a?b="Parsing response failed.":5==a?b="File too large.":6==a?b="Invalid file type.":7==a&&(b="File can be uploaded only to same domain in IE 8 and IE 9."),this.triggerEvent("fileError",[{code:a,message:b}],!1),this.hideFileLoader()},a.Editable.prototype.hideFileLoader=function(){this.$file_progress_bar.hide(),this.$file_progress_bar.find("span").css("width","0%").text(""),this.$file_wrapper.find("#f-file-list-"+this._id).show()},a.Editable.prototype.throwFileErrorWithMessage=function(a){this.triggerEvent("fileError",[{message:a,code:0}],!1),this.hideFileLoader()},a.Editable.prototype.parseFileResponse=function(b,c){try{if(!this.triggerEvent("afterFileUpload",[b],!1))return!1;var d=a.parseJSON(b);d.link?this.writeFile(d.link,c,b):d.error?this.throwFileErrorWithMessage(d.error):this.throwFileError(2)}catch(e){this.throwFileError(4)}},a.Editable.prototype.writeFile=function(a,b,c){this.restoreSelectionByMarkers(),this.focus(),this.options.useFileName||""===this.text()||(b=this.text()),this.insertHTML('<a class="fr-file" href="'+this.sanitizeURL(a)+'">'+b+"</a>"),this.hide(),this.hideFileLoader(),this.focus(),this.triggerEvent("fileUploaded",[b,a,c])}}(jQuery);
/*!
 * froala_editor v1.2.8 (https://www.froala.com/wysiwyg-editor)
 * License https://www.froala.com/wysiwyg-editor/terms
 * Copyright 2014-2015 Froala Labs
 */

!function(a){a.Editable.commands=a.extend(a.Editable.commands,{insertOrderedList:{title:"Numbered List",icon:"fa fa-list-ol",refresh:function(){},callback:function(a){this.formatList(a)},undo:!0},insertUnorderedList:{title:"Bulleted List",icon:"fa fa-list-ul",refresh:function(){},callback:function(a){this.formatList(a)},undo:!0}}),a.Editable.prototype.refreshLists=function(){var b=a(this.getSelectionElement()),c=this.parents(b,"ul, ol");if(c.length>0){var d="insertUnorderedList";"OL"==c[0].tagName&&(d="insertOrderedList"),this.$editor.find('button[data-cmd="'+d+'"]').addClass("active")}},a.Editable.prototype.processBackspace=function(b){var c=b.prev();if(c.length){for(this.removeMarkers(),("UL"==c.get(0).tagName||"OL"==c.get(0).tagName)&&(c=c.find("li:last"));c.find("> ul, > ol").length;)c=c.find("> ul li:last, > ol li:last");var d=c.find("> p, > h1, > h3, > h4, > h5, > h6, > div, > pre, > blockquote");if(0===c.text().length&&0===c.find("img, table, input, iframe, video").length)c.remove();else{if(this.emptyElement(c.get(0))||(this.keep_enter=!0,b.find("> p, > h1, > h3, > h4, > h5, > h6, > div, > pre, > blockquote").each(function(b,c){a(c).replaceWith(a(c).html())}),this.keep_enter=!1),d.length)if(a(d[d.length-1]).append(this.markers_html),0===b.find("ul, ol").length)a(d[d.length-1]).append(b.html());else{for(var e=!1,f=b.contents(),g=0;g<f.length;g++){var h=f[g];["OL","UL"].indexOf(f[g].tagName)>=0&&(e=!0),e?a(d[d.length-1]).after(h):a(d[d.length-1]).append(h)}this.$element.find("breakli").remove();var i=d[d.length-1].nextSibling;i&&"BR"==i.tagName&&a(i).remove()}else this.emptyElement(c.get(0))?(this.$element.find("breakli").replaceWith(this.markers_html),c.html(b.html())):(c.append(this.markers_html),c.append(b.html()));b.remove(),this.cleanupLists(),this.restoreSelectionByMarkers()}this.$element.find("breakli").remove()}else this.$element.find("breakli").remove(),this.parents(b,"ul").length?this.formatList("insertUnorderedList",!1):this.formatList("insertOrderedList",!1);this.sync()},a.Editable.prototype.liBackspace=function(){if(""!==this.text())return!0;var b,c=this.getSelectionElement(),d=this.parents(a(c),"table, li");if(d.length>0&&"TABLE"===d[0].tagName)return!0;if(b="LI"==c.tagName?a(c):this.parents(a(c),"li:first"),this.removeMarkers(),this.emptyElement(b.get(0))?(b.prepend("<breakli></breakli>"),1==b.find("br").length&&b.find("br").remove()):this.insertHTML("<breakli></breakli>"),b.find("breakli").prev().length&&"TABLE"===b.find("breakli").prev().get(0).tagName&&b.find("breakli").next().length&&"BR"===b.find("breakli").next().get(0).tagName)return this.setSelection(b.find("breakli").prev().find("td:first").get(0)),b.find("breakli").next().remove(),this.$element.find("breakli").remove(),!1;for(var e,f=b.html(),g=[],h=0;h<f.length;h++){if(chr=f.charAt(h),"<"!=chr)return this.$element.find("breakli").remove(),!0;var i=f.indexOf(">",h+1);if(-1!==i){e=f.substring(h,i+1);var j=this.tagName(e);if(h=i,"breakli"==j){if(!this.isClosingTag(e)&&!this.isClosingTag(g[g.length-1]))return this.processBackspace(b),!1}else g.push(e)}}return this.$element.find("breakli").remove(),!0},a.Editable.prototype.textLiEnter=function(b){this.removeMarkers(),this.insertSimpleHTML("<breakli></breakli>",!1);var c,d,e=b.html(),f=[],g={},h=[],i=0,j=b.prop("attributes"),k="";for(d=0;d<j.length;d++)k+=" "+j[d].name+'="'+j[d].value+'"';var l=!1;for(d=0;d<e.length;d++)if(chr=e.charAt(d),"<"==chr){var m=e.indexOf(">",d+1);if(-1!==m){c=e.substring(d,m+1);var n=this.tagName(c);if(d=m,"breakli"==n){if(!this.isClosingTag(c)){for(var o=f.length-1;o>=0;o--){var p=this.tagName(f[o]);h.push("</"+p+">")}h.push("</li>"),h.push("<li"+k+">");for(var q=0;q<f.length;q++)h.push(f[q]);h.push('<span class="f-marker" data-type="false" data-collapsed="true" data-id="0" data-fr-verified="true"></span><span class="f-marker" data-type="true" data-collapsed="true" data-id="0" data-fr-verified="true"></span>'),l=!1}}else if(h.push(c),l=!1,!this.isSelfClosingTag(c))if(this.isClosingTag(c)){var r=g[n].pop();f.splice(r,1)}else f.push(c),void 0===g[n]&&(g[n]=[]),g[n].push(f.length-1)}}else i++,32!=chr.charCodeAt(0)||l?(h.push(chr),l=!0):h.push("&nbsp;");var s=a(b.parents("ul, ol")[0]);b.replaceWith("<li"+k+">"+h.join("")+"</li>"),s.find("p:empty + table").prev().remove(),s.find("p + table").each(function(b,c){var d=a(c);d.prev().append(d.clone()),d.remove()}),s.find("table + p").each(function(b,c){var d=a(c);d.append(d.prev().clone()),d.prev().remove()}),this.keep_enter=!0,s.find(this.valid_nodes.join(",")).each(a.proxy(function(b,c){""===a(c).text().trim()&&0===a(c).find(this.valid_nodes.join(",")).length&&a(c).prepend(a.Editable.INVISIBLE_SPACE)},this)),this.keep_enter=!1},a.Editable.prototype.liEnter=function(){var b,c=this.getSelectionElement(),d=this.parents(a(c),"table, li");if(d.length>0&&"TABLE"==d[0].tagName)return!0;if(b="LI"==c.tagName?a(c):this.parents(a(c),"li:first"),this.getSelectionTextInfo(b.get(0)).atStart&&""===this.text())b.before("<li>"+a.Editable.INVISIBLE_SPACE+"</li>");else{if(0===this.trim(b.text()).length&&0===b.find("img, table, iframe, input, object").length)return this.outdent(!1),!1;this.textLiEnter(b),this.$element.find("breakli").remove(),this.restoreSelectionByMarkers()}return this.sync(),!1},a.Editable.prototype.listTab=function(){var b=a(this.getSelectionElement());return this.parents(b,"ul, ol").length>0&&0===this.parents(b,"table").length?(this.indent(),!1):void 0},a.Editable.prototype.listShiftTab=function(){var b=a(this.getSelectionElement());return this.parents(b,"ul, ol").length>0&&0===this.parents(b,"table").length?(this.outdent(),!1):void 0},a.Editable.prototype.indentList=function(a,b){return"LI"===a.get(0).tagName?(b?this.outdentLi(a):this.indentLi(a),this.cleanupLists(),!1):!0},a.Editable.prototype.initList=function(){this.addListener("tab",this.listTab),this.addListener("shift+tab",this.listShiftTab),this.addListener("refresh",this.refreshLists),this.addListener("indent",this.indentList),this.isImage||this.isLink||this.options.editInPopup||this.$element.on("keypress",a.proxy(function(b){if(["TEXTAREA","INPUT"].indexOf(b.target.tagName)<0&&!this.isHTML){var c=b.which,d=this.getSelectionElement();if("LI"==d.tagName||this.parents(a(d),"li").length>0){if(13==c&&!b.shiftKey&&this.options.multiLine)return this.liEnter();if(8==c)return this.liBackspace()}}},this))},a.Editable.initializers.push(a.Editable.prototype.initList),a.Editable.prototype.formatList=function(b,c){if(this.browser.msie&&a.Editable.getIEversion()<9)return document.execCommand(b,!1,!1),!1;void 0===c&&(c=!0);var d,e,f=!1,g=!0,h=!1,i=this.getSelectionElements(),j=this.parents(a(i[0]),"ul, ol");if(j.length&&("UL"===j[0].tagName?"insertUnorderedList"!=b&&(f=!0):"insertOrderedList"!=b&&(f=!0)),this.saveSelectionByMarkers(),f){d="ol","insertUnorderedList"===b&&(d="ul");var k=a(j[0]);k.replaceWith("<"+d+">"+k.html()+"</"+d+">")}else{for(var l=0;l<i.length;l++)if(e=a(i[l]),("TD"==e.get(0).tagName||"TH"==e.get(0).tagName)&&this.wrapTextInElement(e),this.parents(e,"li").length>0||"LI"==e.get(0).tagName){var m;m="LI"==e.get(0).tagName?e:a(e.parents("li")[0]);var n=this.parents(e,"ul, ol");if(n.length>0&&(d=n[0].tagName.toLowerCase(),m.before('<span class="close-'+d+'" data-fr-verified="true"></span>'),m.after('<span class="open-'+d+'" data-fr-verified="true"></span>')),0===this.parents(a(n[0]),"ol, ul").length||f)if(0===m.find(this.valid_nodes.join(",")).length){var o=m.html().replace(/\u200B/gi,"");this.options.paragraphy?(0===m.text().replace(/\u200B/gi,"").length&&(o+=m.find("br").length>0?"":this.br),o="<"+this.options.defaultTag+this.attrs(m.get(0))+">"+o,o=o+"</"+this.options.defaultTag+">"):o+=m.find("br").length>0?"":this.br,m.replaceWith(o)}else m.replaceWith(m.html().replace(/\u200B/gi,""));else this.parents(a(n[0]),"ol, ul").length>0&&(m.append('<span class="open-li" data-fr-verified="true"></span>'),m.before('<span class="close-li" data-fr-verified="true"></span>'));h=!0}else g=!1;h&&this.cleanupLists(),(g===!1||f===!0)&&(this.wrapText(),this.restoreSelectionByMarkers(),i=this.getSelectionElements(),this.saveSelectionByMarkers(),this.elementsToList(i,b),this.unwrapText(),this.cleanupLists())}this.options.paragraphy&&!f&&this.wrapText(!0),this.restoreSelectionByMarkers(),c&&this.repositionEditor(),b="insertUnorderedList"==b?"unorderedListInserted":"orderedListInserted",this.triggerEvent(b)},a.Editable.prototype.elementsToList=function(b,c){var d="<ol>";"insertUnorderedList"==c&&(d="<ul>"),b[0]==this.$element.get(0)&&(b=this.$element.find("> "+this.valid_nodes.join(", >")));for(var e=0;e<b.length;e++){var f=a(d);$element=a(b[e]),$element.get(0)!=this.$element.get(0)&&("TD"===$element.get(0).tagName||"TH"===$element.get(0).tagName?(this.wrapTextInElement($element,!0),this.elementsToList($element.find("> "+this.valid_nodes.join(", >")),c)):(""===$element.attr("class")&&$element.removeAttr("class"),f.append($element.get(0).tagName==this.options.defaultTag&&0===$element.get(0).attributes.length?a("<li>").html($element.clone().html()):a("<li>").html($element.clone())),$element.replaceWith(f)))}},a.Editable.prototype.indentLi=function(b){var c=b.parents("ul, ol"),d=c.get(0).tagName.toLowerCase();b.find("> ul, > ol").length>0&&b.prev("li").length>0?(this.wrapTextInElement(b),b.find("> "+this.valid_nodes.join(" , > ")).each(function(b,c){a(c).wrap("<"+d+"></"+d+">").wrap("<li></li>")}),b.prev("li").append(b.find("> ul, > ol")),b.remove()):0===b.find("> ul, > ol").length&&b.prev("li").length>0&&(b.prev().append(a("<"+d+">").append(b.clone())),b.remove(),a(c.find("li").get().reverse()).each(function(b,c){var d=a(c);d.find(" > ul, > ol").length>0&&d.prev()&&d.prev().find(" > ul, > ol").length>0&&1===d.contents().length&&(d.prev().append(d.html()),d.remove())}))},a.Editable.prototype.outdentLi=function(b){var c=a(b.parents("ul, ol")[0]),d=this.parents(c,"ul, ol"),e=c.get(0).tagName.toLowerCase();0===b.prev("li").length&&this.parents(b,"li").length>0?(b.before('<span class="close-'+e+'" data-fr-verified="true"></span>'),b.before('<span class="close-li" data-fr-verified="true"></span>'),b.before('<span class="open-li" data-fr-verified="true"></span>'),b.after('<span class="open-'+e+'" data-fr-verified="true"></span>'),b.replaceWith(b.html())):(b.before('<span class="close-'+e+'" data-fr-verified="true"></span>'),b.after('<span class="open-'+e+'" data-fr-verified="true"></span>'),this.parents(b,"li").length>0&&(b.before('<span class="close-li" data-fr-verified="true"></span>'),b.after('<span class="open-li" data-fr-verified="true"></span>'))),d.length||(0===b.find(this.valid_nodes.join(",")).length?b.replaceWith(b.html().replace(/\u200b/gi,"")+this.br):(b.find(this.valid_nodes.join(", ")).each(a.proxy(function(b,c){this.emptyElement(c)&&a(c).append(this.br)},this)),b.replaceWith(b.html().replace(/\u200b/gi,""))))},a.Editable.prototype.listTextEmpty=function(b){var c=a(b).text().replace(/(\r\n|\n|\r|\t|\u200B)/gm,"");return(""===c||b===this.$element.get(0))&&1===a(b).find("br").length}}(jQuery);
/*!
 * froala_editor v1.2.8 (https://www.froala.com/wysiwyg-editor)
 * License https://www.froala.com/wysiwyg-editor/terms
 * Copyright 2014-2015 Froala Labs
 */

!function(a){a.Editable.DEFAULTS=a.extend(a.Editable.DEFAULTS,{maxCharacters:-1,countCharacters:!0}),a.Editable.prototype.validKeyCode=function(a,b){return b?!1:a>47&&58>a||32==a||13==a||a>64&&91>a||a>95&&112>a||a>185&&193>a||a>218&&223>a},a.Editable.prototype.charNumber=function(){return this.getText().length},a.Editable.prototype.checkCharNumber=function(a,b,c){if(b.options.maxCharacters<0)return!0;if(b.charNumber()<b.options.maxCharacters)return!0;var d=c.which,e=(c.ctrlKey||c.metaKey)&&!c.altKey;return b.validKeyCode(d,e)?(b.triggerEvent("maxCharNumberExceeded",[],!1),!1):!0},a.Editable.prototype.checkCharNumberOnPaste=function(b,c,d){if(c.options.maxCharacters<0)return!0;var e=a("<div>").html(d).text().length;return e+c.charNumber()<=c.options.maxCharacters?d:(c.triggerEvent("maxCharNumberExceeded",[],!1),"")},a.Editable.prototype.updateCharNumber=function(a,b){if(b.options.countCharacters){var c=b.charNumber()+(b.options.maxCharacters>0?"/"+b.options.maxCharacters:"");b.$box.attr("data-chars",c)}},a.Editable.prototype.initCharNumber=function(){this.$original_element.on("editable.keydown",this.checkCharNumber),this.$original_element.on("editable.afterPasteCleanup",this.checkCharNumberOnPaste),this.$original_element.on("editable.keyup",this.updateCharNumber),this.$original_element.on("editable.contentChanged",this.updateCharNumber),this.updateCharNumber(null,this)},a.Editable.initializers.push(a.Editable.prototype.initCharNumber)}(jQuery);
/*!
 * froala_editor v1.2.8 (https://www.froala.com/wysiwyg-editor)
 * License https://www.froala.com/wysiwyg-editor/terms
 * Copyright 2014-2015 Froala Labs
 */

!function(a){a.Editable.prototype.refreshFullscreen=function(){this.$box.hasClass("fr-fullscreen")?this.$editor.find('[data-cmd="fullscreen"]').addClass("active"):this.$editor.find('[data-cmd="fullscreen"]').removeClass("active")},a.Editable.commands=a.extend(a.Editable.commands,{fullscreen:{icon:"fa fa-expand",title:"Fullscreen",callback:function(){if(this.$box.toggleClass("fr-fullscreen"),a("body").toggleClass("fr-fullscreen"),this.$editor.find('[data-cmd="fullscreen"] i').toggleClass("fa-expand fa-compress"),this.refreshFullscreen(),this.$box.hasClass("fr-fullscreen"))this.$fullscreen_marker=a("<div>"),this.$box.after(this.$fullscreen_marker),this.$box.appendTo("body"),this.computeElementHeight();else{this.$wrapper.css("height",""),this.$element.css("minHeight",""),this.setDimensions(),this.options.scrollableContainer=this.oldScrollableContainer;var b=this.$document.find(this.options.scrollableContainer);b.append(this.$popup_editor),this.$fullscreen_marker.replaceWith(this.$box)}},refresh:a.Editable.prototype.refreshFullscreen}}),a.Editable.prototype.computeElementHeight=function(){var a=this.$window.height()-this.$editor.outerHeight()-parseFloat(this.$wrapper.css("padding-top"),10)-parseFloat(this.$wrapper.css("padding-bottom"),10)-parseFloat((this.$wrapper||this.$element).css("border-top-width"),10)-parseFloat((this.$wrapper||this.$element).css("border-bottom-width"),10)+2;this.$wrapper.css("height",a),this.$element.css("minHeight",a-parseInt(this.$element.css("padding-top"),10)-parseInt(this.$element.css("padding-bottom"),10)),this.$element.css("maxHeight",""),this.$wrapper.css("maxHeight",""),this.oldScrollableContainer=this.options.scrollableContainer,this.options.scrollableContainer=this.$wrapper,this.$wrapper.append(this.$popup_editor)},a.Editable.prototype.initFullscreen=function(){this.$window.on("resize",a.proxy(function(){this.$box.hasClass("fr-fullscreen")&&this.computeElementHeight()},this))},a.Editable.initializers.push(a.Editable.prototype.initFullscreen)}(jQuery);
/*!
 * froala_editor v1.2.8 (https://www.froala.com/wysiwyg-editor)
 * License https://www.froala.com/wysiwyg-editor/terms
 * Copyright 2014-2015 Froala Labs
 */

!function(a){a.Editable.URLRegEx=/(\s|^|>)((http|https|ftp|ftps)\:\/\/[a-zA-Z0-9\-\.]+(\.[a-zA-Z]{2,3})?(:\d*)?(\/[^\s<]*)?)(\s|$|<)/gi,a.Editable.prototype.convertURLs=function(b){var c=this;b.each(function(){if("IFRAME"!=this.tagName)if(3==this.nodeType){var b=this.textContent.replace(/&nbsp;/gi,"");a.Editable.URLRegEx.test(b)&&(a(this).before(b.replace(a.Editable.URLRegEx,'$1<a href="$2">$2</a>$7')),a(this).remove())}else 1==this.nodeType&&["A","BUTTON","TEXTAREA"].indexOf(this.tagName)<0&&c.convertURLs(a(this).contents())})},a.Editable.prototype.processURLs=function(){this.$original_element.on("editable.afterPasteCleanup",function(b,c,d){return a.Editable.URLRegEx.test(d)?d.replace(a.Editable.URLRegEx,'$1<a href="$2">$2</a>$7'):void 0}),this.$original_element.on("editable.keyup",function(a,b,c){var d=c.which;(32==d||13==d)&&b.convertURLs(b.$element.contents())}),this.$original_element.on("editable.keydown",function(b,c,d){var e=d.which;if(32==e){var f=c.getSelectionElement();if(("A"==f.tagName||a(f).parents("a").length)&&c.getSelectionTextInfo(f).atEnd)return b.stopImmediatePropagation(),"A"!==f.tagName&&(f=a(f).parents("a")[0]),a(f).after('&nbsp;<span class="f-marker" data-type="false" data-id="0" data-fr-verified="true"></span><span class="f-marker" data-type="true" data-id="0" data-fr-verified="true"></span>'),c.restoreSelectionByMarkers(),!1}})},a.Editable.initializers.push(a.Editable.prototype.processURLs)}(jQuery);
/*!
 * froala_editor v1.2.8 (https://www.froala.com/wysiwyg-editor)
 * License https://www.froala.com/wysiwyg-editor/terms
 * Copyright 2014-2015 Froala Labs
 */

!function(a){a.Editable.prototype.refreshInlineStyles=function(){var b=this.getSelectionElements()[0],c=b.tagName.toLowerCase();this.$bttn_wrapper.find(".fr-block-style").empty();var d=this.options.blockStyles[c];if(void 0===d&&(d=this.options.defaultBlockStyle),void 0!==d){this.$bttn_wrapper.find('.fr-dropdown > button[data-name="blockStyle"].fr-trigger').removeAttr("disabled");for(var e in d){var f=d[e],g="";a(b).hasClass(e)&&(g=' class="active"'),this.$bttn_wrapper.find(".fr-block-style").append(a("<li"+g+">").append(a('<a href="#" data-text="true">').text(f).addClass(e)).attr("data-cmd","blockStyle").attr("data-val",e))}}},a.Editable.commands=a.extend(a.Editable.commands,{inlineStyle:{title:"Inline Style",icon:"fa fa-paint-brush",refreshOnShow:a.Editable.prototype.refreshInlineStyles,callback:function(a,b){this.applyInlineStyles(b)},callbackWithoutSelection:function(a,b){this.applyInlineStyles(b)}}}),a.Editable.DEFAULTS=a.extend(a.Editable.DEFAULTS,{inlineStyles:{"Big Red":"font-size: 20px; color: red;","Small Blue":"font-size: 14px; color: blue;"}}),a.Editable.prototype.command_dispatcher=a.extend(a.Editable.prototype.command_dispatcher,{inlineStyle:function(a){var b=this.buildDropdownInlineStyle(),c=this.buildDropdownButton(a,b);return c}}),a.Editable.prototype.buildDropdownInlineStyle=function(){var a='<ul class="fr-dropdown-menu fr-inline-style">';for(var b in this.options.inlineStyles)a+='<li data-cmd="inlineStyle" data-val="'+b+'"><a href="#" style="'+this.options.inlineStyles[b]+'">'+b+"</a></li>";return a+="</ul>"},a.Editable.prototype.applyInlineStyles=function(b){this.insertHTML(""!==this.text()?this.start_marker+'<span data-fr-verified="true" style="'+this.options.inlineStyles[b]+'">'+this.text()+"</span>"+this.end_marker:'<span data-fr-verified="true" style="'+this.options.inlineStyles[b]+'">'+this.markers_html+a.Editable.INVISIBLE_SPACE+"</span>"),this.restoreSelectionByMarkers(),this.triggerEvent("inlineStyle")},a.Editable.prototype.startInInlineStyles=function(a){for(var b in this.options.inlineStyles[a])this._startInFontExec(b.replace(/([A-Z])/g,"-$1").toLowerCase(),null,this.options.inlineStyles[a][b]);this.triggerEvent("inlineStyle")}}(jQuery);
/*!
 * froala_editor v1.2.8 (https://www.froala.com/wysiwyg-editor)
 * License https://www.froala.com/wysiwyg-editor/terms
 * Copyright 2014-2015 Froala Labs
 */

!function(a){a.Editable.DEFAULTS=a.extend(a.Editable.DEFAULTS,{entities:"&quot;&apos;&iexcl;&cent;&pound;&curren;&yen;&brvbar;&sect;&uml;&copy;&ordf;&laquo;&not;&shy;&reg;&macr;&deg;&plusmn;&sup2;&sup3;&acute;&micro;&para;&middot;&cedil;&sup1;&ordm;&raquo;&frac14;&frac12;&frac34;&iquest;&Agrave;&Aacute;&Acirc;&Atilde;&Auml;&Aring;&AElig;&Ccedil;&Egrave;&Eacute;&Ecirc;&Euml;&Igrave;&Iacute;&Icirc;&Iuml;&ETH;&Ntilde;&Ograve;&Oacute;&Ocirc;&Otilde;&Ouml;&times;&Oslash;&Ugrave;&Uacute;&Ucirc;&Uuml;&Yacute;&THORN;&szlig;&agrave;&aacute;&acirc;&atilde;&auml;&aring;&aelig;&ccedil;&egrave;&eacute;&ecirc;&euml;&igrave;&iacute;&icirc;&iuml;&eth;&ntilde;&ograve;&oacute;&ocirc;&otilde;&ouml;&divide;&oslash;&ugrave;&uacute;&ucirc;&uuml;&yacute;&thorn;&yuml;&OElig;&oelig;&Scaron;&scaron;&Yuml;&fnof;&circ;&tilde;&Alpha;&Beta;&Gamma;&Delta;&Epsilon;&Zeta;&Eta;&Theta;&Iota;&Kappa;&Lambda;&Mu;&Nu;&Xi;&Omicron;&Pi;&Rho;&Sigma;&Tau;&Upsilon;&Phi;&Chi;&Psi;&Omega;&alpha;&beta;&gamma;&delta;&epsilon;&zeta;&eta;&theta;&iota;&kappa;&lambda;&mu;&nu;&xi;&omicron;&pi;&rho;&sigmaf;&sigma;&tau;&upsilon;&phi;&chi;&psi;&omega;&thetasym;&upsih;&piv;&ensp;&emsp;&thinsp;&zwnj;&zwj;&lrm;&rlm;&ndash;&mdash;&lsquo;&rsquo;&sbquo;&ldquo;&rdquo;&bdquo;&dagger;&Dagger;&bull;&hellip;&permil;&prime;&Prime;&lsaquo;&rsaquo;&oline;&frasl;&euro;&image;&weierp;&real;&trade;&alefsym;&larr;&uarr;&rarr;&darr;&harr;&crarr;&lArr;&uArr;&rArr;&dArr;&hArr;&forall;&part;&exist;&empty;&nabla;&isin;&notin;&ni;&prod;&sum;&minus;&lowast;&radic;&prop;&infin;&ang;&and;&or;&cap;&cup;&int;&there4;&sim;&cong;&asymp;&ne;&equiv;&le;&ge;&sub;&sup;&nsub;&sube;&supe;&oplus;&otimes;&perp;&sdot;&lceil;&rceil;&lfloor;&rfloor;&lang;&rang;&loz;&spades;&clubs;&hearts;&diams;"}),a.Editable.prototype.encodeEntities=function(a,b,c){var d="";for(i=0;i<c.length;i++)if(chr=c.charAt(i),"<"==chr){var e=c.indexOf(">",i+1);if(-1!==e){var f=c.substring(i,e+1);d+=f,i=e}}else d+=b.entities_map[chr]?b.entities_map[chr]:chr;return d},a.Editable.prototype.initEntities=function(){var b=a("<div>").html(this.options.entities).text(),c=this.options.entities.split(";");this.entities_reg_exp=new RegExp(b,"g"),this.entities_map={};for(var d=0;d<b.length;d++){var e=b.charAt(d);this.entities_map[e]=c[d]+";"}this.$original_element.on("editable.getHTML",this.encodeEntities)},a.Editable.initializers.push(a.Editable.prototype.initEntities)}(jQuery);
// Copyright 2014 Google Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
//     You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//     See the License for the specific language governing permissions and
// limitations under the License.

!function(a,b){b["true"]=a;var c={},d={},e={},f=null;!function(a){function b(b,c){var d={delay:0,endDelay:0,fill:c?"both":"none",iterationStart:0,iterations:1,duration:c?"auto":0,playbackRate:1,direction:"normal",easing:"linear"};return"number"!=typeof b||isNaN(b)?void 0!==b&&Object.getOwnPropertyNames(b).forEach(function(c){if("auto"!=b[c]){if(("number"==typeof d[c]||"duration"==c)&&("number"!=typeof b[c]||isNaN(b[c])))return;if("fill"==c&&-1==p.indexOf(b[c]))return;if("direction"==c&&-1==q.indexOf(b[c]))return;if("playbackRate"==c&&1!==b[c]&&a.isDeprecated("AnimationEffectTiming.playbackRate","2014-11-28","Use Animation.playbackRate instead."))return;d[c]=b[c]}}):d.duration=b,d}function c(a,c){var d=b(a,c);return d.easing=f(d.easing),d}function d(a,b,c,d){return 0>a||a>1||0>c||c>1?y:function(e){function f(a,b,c){return 3*a*(1-c)*(1-c)*c+3*b*(1-c)*c*c+c*c*c}for(var g=0,h=1;;){var i=(g+h)/2,j=f(a,c,i);if(Math.abs(e-j)<.001)return f(b,d,i);e>j?g=i:h=i}}}function e(a,b){return function(c){if(c>=1)return 1;var d=1/a;return c+=b*d,c-c%d}}function f(a){var b=w.exec(a);if(b)return d.apply(this,b.slice(1).map(Number));var c=x.exec(a);if(c)return e(Number(c[1]),{start:r,middle:s,end:t}[c[2]]);var f=u[a];return f?f:y}function g(a){return Math.abs(h(a)/a.playbackRate)}function h(a){return a.duration*a.iterations}function i(a,b,c){return null==b?z:b<c.delay?A:b>=c.delay+a?B:C}function j(a,b,c,d,e){switch(d){case A:return"backwards"==b||"both"==b?0:null;case C:return c-e;case B:return"forwards"==b||"both"==b?a:null;case z:return null}}function k(a,b,c,d){return(d.playbackRate<0?b-a:b)*d.playbackRate+c}function l(a,b,c,d,e){return 1/0===c||c===-1/0||c-d==b&&e.iterations&&(e.iterations+e.iterationStart)%1==0?a:c%a}function m(a,b,c,d){return 0===c?0:b==a?d.iterationStart+d.iterations-1:Math.floor(c/a)}function n(a,b,c,d){var e=a%2>=1,f="normal"==d.direction||d.direction==(e?"alternate-reverse":"alternate"),g=f?c:b-c,h=g/b;return b*d.easing(h)}function o(a,b,c){var d=i(a,b,c),e=j(a,c.fill,b,d,c.delay);if(null===e)return null;if(0===a)return d===A?0:1;var f=c.iterationStart*c.duration,g=k(a,e,f,c),o=l(c.duration,h(c),g,f,c),p=m(c.duration,o,g,c);return n(p,c.duration,o,c)/c.duration}var p="backwards|forwards|both|none".split("|"),q="reverse|alternate|alternate-reverse".split("|"),r=1,s=.5,t=0,u={ease:d(.25,.1,.25,1),"ease-in":d(.42,0,1,1),"ease-out":d(0,0,.58,1),"ease-in-out":d(.42,0,.58,1),"step-start":e(1,r),"step-middle":e(1,s),"step-end":e(1,t)},v="\\s*(-?\\d+\\.?\\d*|-?\\.\\d+)\\s*",w=new RegExp("cubic-bezier\\("+v+","+v+","+v+","+v+"\\)"),x=/steps\(\s*(\d+)\s*,\s*(start|middle|end)\s*\)/,y=function(a){return a},z=0,A=1,B=2,C=3;a.makeTiming=b,a.normalizeTimingInput=c,a.calculateActiveDuration=g,a.calculateTimeFraction=o,a.calculatePhase=i,a.toTimingFunction=f}(c,f),function(a){function b(a,b){return a in h?h[a][b]||b:b}function c(a,c,d){var g=e[a];if(g){f.style[a]=c;for(var h in g){var i=g[h],j=f.style[i];d[i]=b(i,j)}}else d[a]=b(a,c)}function d(b){function d(){var a=e.length;null==e[a-1].offset&&(e[a-1].offset=1),a>1&&null==e[0].offset&&(e[0].offset=0);for(var b=0,c=e[0].offset,d=1;a>d;d++){var f=e[d].offset;if(null!=f){for(var g=1;d-b>g;g++)e[b+g].offset=c+(f-c)*g/(d-b);b=d,c=f}}}if(!Array.isArray(b)&&null!==b)throw new TypeError("Keyframes must be null or an array of keyframes");if(null==b)return[];for(var e=b.map(function(b){var d={};for(var e in b){var f=b[e];if("offset"==e){if(null!=f&&(f=Number(f),!isFinite(f)))throw new TypeError("keyframe offsets must be numbers.")}else{if("composite"==e)throw{type:DOMException.NOT_SUPPORTED_ERR,name:"NotSupportedError",message:"add compositing is not supported"};f="easing"==e?a.toTimingFunction(f):""+f}c(e,f,d)}return void 0==d.offset&&(d.offset=null),void 0==d.easing&&(d.easing=a.toTimingFunction("linear")),d}),f=!0,g=-1/0,h=0;h<e.length;h++){var i=e[h].offset;if(null!=i){if(g>i)throw{code:DOMException.INVALID_MODIFICATION_ERR,name:"InvalidModificationError",message:"Keyframes are not loosely sorted by offset. Sort or specify offsets."};g=i}else f=!1}return e=e.filter(function(a){return a.offset>=0&&a.offset<=1}),f||d(),e}var e={background:["backgroundImage","backgroundPosition","backgroundSize","backgroundRepeat","backgroundAttachment","backgroundOrigin","backgroundClip","backgroundColor"],border:["borderTopColor","borderTopStyle","borderTopWidth","borderRightColor","borderRightStyle","borderRightWidth","borderBottomColor","borderBottomStyle","borderBottomWidth","borderLeftColor","borderLeftStyle","borderLeftWidth"],borderBottom:["borderBottomWidth","borderBottomStyle","borderBottomColor"],borderColor:["borderTopColor","borderRightColor","borderBottomColor","borderLeftColor"],borderLeft:["borderLeftWidth","borderLeftStyle","borderLeftColor"],borderRadius:["borderTopLeftRadius","borderTopRightRadius","borderBottomRightRadius","borderBottomLeftRadius"],borderRight:["borderRightWidth","borderRightStyle","borderRightColor"],borderTop:["borderTopWidth","borderTopStyle","borderTopColor"],borderWidth:["borderTopWidth","borderRightWidth","borderBottomWidth","borderLeftWidth"],flex:["flexGrow","flexShrink","flexBasis"],font:["fontFamily","fontSize","fontStyle","fontVariant","fontWeight","lineHeight"],margin:["marginTop","marginRight","marginBottom","marginLeft"],outline:["outlineColor","outlineStyle","outlineWidth"],padding:["paddingTop","paddingRight","paddingBottom","paddingLeft"]},f=document.createElementNS("http://www.w3.org/1999/xhtml","div"),g={thin:"1px",medium:"3px",thick:"5px"},h={borderBottomWidth:g,borderLeftWidth:g,borderRightWidth:g,borderTopWidth:g,fontSize:{"xx-small":"60%","x-small":"75%",small:"89%",medium:"100%",large:"120%","x-large":"150%","xx-large":"200%"},fontWeight:{normal:"400",bold:"700"},outlineWidth:g,textShadow:{none:"0px 0px 0px transparent"},boxShadow:{none:"0px 0px 0px 0px transparent"}};a.normalizeKeyframes=d}(c,f),function(a){var b={};a.isDeprecated=function(a,c,d,e){var f=e?"are":"is",g=new Date,h=new Date(c);return h.setMonth(h.getMonth()+3),h>g?(a in b||console.warn("Web Animations: "+a+" "+f+" deprecated and will stop working on "+h.toDateString()+". "+d),b[a]=!0,!1):!0},a.deprecated=function(b,c,d,e){var f=e?"are":"is";if(a.isDeprecated(b,c,d,e))throw new Error(b+" "+f+" no longer supported. "+d)}}(c),function(){if(document.documentElement.animate){var a=document.documentElement.animate([],0),b=!0;if(a&&(b=!1,"play|currentTime|pause|reverse|playbackRate|cancel|finish|startTime|playState".split("|").forEach(function(c){void 0===a[c]&&(b=!0)})),!b)return}!function(a,b){function c(a){for(var b={},c=0;c<a.length;c++)for(var d in a[c])if("offset"!=d&&"easing"!=d&&"composite"!=d){var e={offset:a[c].offset,easing:a[c].easing,value:a[c][d]};b[d]=b[d]||[],b[d].push(e)}for(var f in b){var g=b[f];if(0!=g[0].offset||1!=g[g.length-1].offset)throw{type:DOMException.NOT_SUPPORTED_ERR,name:"NotSupportedError",message:"Partial keyframes are not supported"}}return b}function d(a){var c=[];for(var d in a)for(var e=a[d],f=0;f<e.length-1;f++){var g=e[f].offset,h=e[f+1].offset,i=e[f].value,j=e[f+1].value;g==h&&(1==h?i=j:j=i),c.push({startTime:g,endTime:h,easing:e[f].easing,property:d,interpolation:b.propertyInterpolation(d,i,j)})}return c.sort(function(a,b){return a.startTime-b.startTime}),c}b.convertEffectInput=function(e){var f=a.normalizeKeyframes(e),g=c(f),h=d(g);return function(a,c){if(null!=c)h.filter(function(a){return 0>=c&&0==a.startTime||c>=1&&1==a.endTime||c>=a.startTime&&c<=a.endTime}).forEach(function(d){var e=c-d.startTime,f=d.endTime-d.startTime,g=0==f?0:d.easing(e/f);b.apply(a,d.property,d.interpolation(g))});else for(var d in g)"offset"!=d&&"easing"!=d&&"composite"!=d&&b.clear(a,d)}}}(c,d,f),function(a){function b(a,b,c){e[c]=e[c]||[],e[c].push([a,b])}function c(a,c,d){for(var e=0;e<d.length;e++){var f=d[e];b(a,c,f),/-/.test(f)&&b(a,c,f.replace(/-(.)/g,function(a,b){return b.toUpperCase()}))}}function d(b,c,d){for(var f=c==d?[]:e[b],g=0;f&&g<f.length;g++){var h=f[g][0](c),i=f[g][0](d);if(void 0!==h&&void 0!==i){var j=f[g][1](h,i);if(j){var k=a.Interpolation.apply(null,j);return function(a){return 0==a?c:1==a?d:k(a)}}}}return a.Interpolation(!1,!0,function(a){return a?d:c})}var e={};a.addPropertiesHandler=c,a.propertyInterpolation=d}(d,f),function(a,b){function c(b){var c=a.calculateActiveDuration(b),d=function(d){return a.calculateTimeFraction(c,d,b)};return d._totalDuration=b.delay+c+b.endDelay,d._isCurrent=function(d){var e=a.calculatePhase(c,d,b);return e===PhaseActive||e===PhaseBefore},d}b.KeyframeEffect=function(d,e,f){var g,h=c(a.normalizeTimingInput(f)),i=b.convertEffectInput(e),j=function(){i(d,g)};return j._update=function(a){return g=h(a),null!==g},j._clear=function(){i(d,null)},j._hasSameTarget=function(a){return d===a},j._isCurrent=h._isCurrent,j._totalDuration=h._totalDuration,j},b.NullEffect=function(a){var b=function(){a&&(a(),a=null)};return b._update=function(){return null},b._totalDuration=0,b._isCurrent=function(){return!1},b._hasSameTarget=function(){return!1},b}}(c,d,f),function(a){a.apply=function(b,c,d){b.style[a.propertyName(c)]=d},a.clear=function(b,c){b.style[a.propertyName(c)]=""}}(d,f),function(a){window.Element.prototype.animate=function(b,c){return a.timeline._play(a.KeyframeEffect(this,b,c))}}(d),function(a){function b(a,c,d){if("number"==typeof a&&"number"==typeof c)return a*(1-d)+c*d;if("boolean"==typeof a&&"boolean"==typeof c)return.5>d?a:c;if(a.length==c.length){for(var e=[],f=0;f<a.length;f++)e.push(b(a[f],c[f],d));return e}throw"Mismatched interpolation arguments "+a+":"+c}a.Interpolation=function(a,c,d){return function(e){return d(b(a,c,e))}}}(d,f),function(a){var b=0,c=function(a,b,c){this.target=a,this.currentTime=b,this.timelineTime=c,this.type="finish",this.bubbles=!1,this.cancelable=!1,this.currentTarget=a,this.defaultPrevented=!1,this.eventPhase=Event.AT_TARGET,this.timeStamp=Date.now()};a.Animation=function(a){this._sequenceNumber=b++,this._currentTime=0,this._startTime=null,this.paused=!1,this._playbackRate=1,this._inTimeline=!0,this._finishedFlag=!1,this.onfinish=null,this._finishHandlers=[],this._effect=a,this._inEffect=this._effect._update(0),this._idle=!0,this._currentTimePending=!1},a.Animation.prototype={_ensureAlive:function(){this._inEffect=this._effect._update(this.playbackRate<0&&0===this.currentTime?-1:this.currentTime),this._inTimeline||!this._inEffect&&this._finishedFlag||(this._inTimeline=!0,a.timeline._animations.push(this))},_tickCurrentTime:function(a,b){a!=this._currentTime&&(this._currentTime=a,this.finished&&!b&&(this._currentTime=this._playbackRate>0?this._totalDuration:0),this._ensureAlive())},get currentTime(){return this._idle||this._currentTimePending?null:this._currentTime},set currentTime(b){b=+b,isNaN(b)||(a.restart(),this.paused||null==this._startTime||(this._startTime=this._timeline.currentTime-b/this._playbackRate),this._currentTimePending=!1,this._currentTime!=b&&(this._tickCurrentTime(b,!0),a.invalidateEffects()))},get startTime(){return this._startTime},set startTime(b){b=+b,isNaN(b)||this.paused||this._idle||(this._startTime=b,this._tickCurrentTime((this._timeline.currentTime-this._startTime)*this.playbackRate),a.invalidateEffects())},get playbackRate(){return this._playbackRate},set playbackRate(a){if(a!=this._playbackRate){var b=this.currentTime;this._playbackRate=a,this._startTime=null,"paused"!=this.playState&&"idle"!=this.playState&&this.play(),null!=b&&(this.currentTime=b)}},get finished(){return!this._idle&&(this._playbackRate>0&&this._currentTime>=this._totalDuration||this._playbackRate<0&&this._currentTime<=0)},get _totalDuration(){return this._effect._totalDuration},get playState(){return this._idle?"idle":null==this._startTime&&!this.paused&&0!=this.playbackRate||this._currentTimePending?"pending":this.paused?"paused":this.finished?"finished":"running"},play:function(){this.paused=!1,(this.finished||this._idle)&&(this._currentTime=this._playbackRate>0?0:this._totalDuration,this._startTime=null,a.invalidateEffects()),this._finishedFlag=!1,a.restart(),this._idle=!1,this._ensureAlive()},pause:function(){this.finished||this.paused||this._idle||(this._currentTimePending=!0),this._startTime=null,this.paused=!0},finish:function(){this._idle||(this.currentTime=this._playbackRate>0?this._totalDuration:0,this._startTime=this._totalDuration-this.currentTime,this._currentTimePending=!1)},cancel:function(){this._inEffect=!1,this._idle=!0,this.currentTime=0,this._startTime=null},reverse:function(){this.playbackRate*=-1,this.play()},addEventListener:function(a,b){"function"==typeof b&&"finish"==a&&this._finishHandlers.push(b)},removeEventListener:function(a,b){if("finish"==a){var c=this._finishHandlers.indexOf(b);c>=0&&this._finishHandlers.splice(c,1)}},_fireEvents:function(a){var b=this.finished;if((b||this._idle)&&!this._finishedFlag){var d=new c(this,this._currentTime,a),e=this._finishHandlers.concat(this.onfinish?[this.onfinish]:[]);setTimeout(function(){e.forEach(function(a){a.call(d.target,d)})},0)}this._finishedFlag=b},_tick:function(a){return this._idle||this.paused||(null==this._startTime?this.startTime=a-this._currentTime/this.playbackRate:this.finished||this._tickCurrentTime((a-this._startTime)*this.playbackRate)),this._currentTimePending=!1,this._fireEvents(a),!this._idle&&(this._inEffect||!this._finishedFlag)}}}(d,f),function(a,b){function c(a){var b=i;i=[],g(a),b.forEach(function(b){b[1](a)}),m&&g(a),f()}function d(a,b){return a._sequenceNumber-b._sequenceNumber}function e(){this._animations=[],this.currentTime=window.performance&&performance.now?performance.now():0}function f(){n.forEach(function(a){a()}),n.length=0}function g(a){l=!1;var c=b.timeline;c.currentTime=a,c._animations.sort(d),k=!1;var e=c._animations;c._animations=[];var f=[],g=[];e=e.filter(function(b){return b._inTimeline=b._tick(a),b._inEffect?g.push(b._effect):f.push(b._effect),b.finished||b.paused||b._idle||(k=!0),b._inTimeline}),n.push.apply(n,f),n.push.apply(n,g),c._animations.push.apply(c._animations,e),m=!1,k&&requestAnimationFrame(function(){})}var h=window.requestAnimationFrame,i=[],j=0;window.requestAnimationFrame=function(a){var b=j++;return 0==i.length&&h(c),i.push([b,a]),b},window.cancelAnimationFrame=function(a){i.forEach(function(b){b[0]==a&&(b[1]=function(){})})},e.prototype={_play:function(c){c._timing=a.normalizeTimingInput(c.timing);var d=new b.Animation(c);return d._idle=!1,d._timeline=this,this._animations.push(d),b.restart(),b.invalidateEffects(),d}};var k=!1,l=!1;b.restart=function(){return k||(k=!0,requestAnimationFrame(function(){}),l=!0),l};var m=!1;b.invalidateEffects=function(){m=!0};var n=[],o=window.getComputedStyle;Object.defineProperty(window,"getComputedStyle",{configurable:!0,enumerable:!0,value:function(){return m&&g(p.currentTime),f(),o.apply(this,arguments)}});var p=new e;b.timeline=p}(c,d,f),function(a){function b(a,b){var c=a.exec(b);return c?(c=a.ignoreCase?c[0].toLowerCase():c[0],[c,b.substr(c.length)]):void 0}function c(a,b){b=b.replace(/^\s*/,"");var c=a(b);return c?[c[0],c[1].replace(/^\s*/,"")]:void 0}function d(a,d,e){a=c.bind(null,a);for(var f=[];;){var g=a(e);if(!g)return[f,e];if(f.push(g[0]),e=g[1],g=b(d,e),!g||""==g[1])return[f,e];e=g[1]}}function e(a,b){for(var c=0,d=0;d<b.length&&(!/\s|,/.test(b[d])||0!=c);d++)if("("==b[d])c++;else if(")"==b[d]&&(c--,0==c&&d++,0>=c))break;var e=a(b.substr(0,d));return void 0==e?void 0:[e,b.substr(d)]}function f(a,b){for(var c=a,d=b;c&&d;)c>d?c%=d:d%=c;return c=a*b/(c+d)}function g(a){return function(b){var c=a(b);return c&&(c[0]=void 0),c}}function h(a,b){return function(c){var d=a(c);return d?d:[b,c]}}function i(b,c){for(var d=[],e=0;e<b.length;e++){var f=a.consumeTrimmed(b[e],c);if(!f||""==f[0])return;void 0!==f[0]&&d.push(f[0]),c=f[1]}return""==c?d:void 0}function j(a,b,c,d,e){for(var g=[],h=[],i=[],j=f(d.length,e.length),k=0;j>k;k++){var l=b(d[k%d.length],e[k%e.length]);if(!l)return;g.push(l[0]),h.push(l[1]),i.push(l[2])}return[g,h,function(b){var d=b.map(function(a,b){return i[b](a)}).join(c);return a?a(d):d}]}function k(a,b,c){for(var d=[],e=[],f=[],g=0,h=0;h<c.length;h++)if("function"==typeof c[h]){var i=c[h](a[g],b[g++]);d.push(i[0]),e.push(i[1]),f.push(i[2])}else!function(a){d.push(!1),e.push(!1),f.push(function(){return c[a]})}(h);return[d,e,function(a){for(var b="",c=0;c<a.length;c++)b+=f[c](a[c]);return b}]}a.consumeToken=b,a.consumeTrimmed=c,a.consumeRepeated=d,a.consumeParenthesised=e,a.ignore=g,a.optional=h,a.consumeList=i,a.mergeNestedRepeated=j.bind(null,null),a.mergeWrappedNestedRepeated=j,a.mergeList=k}(d),function(a){function b(b){function c(b){var c=a.consumeToken(/^inset/i,b);if(c)return d.inset=!0,c;var c=a.consumeLengthOrPercent(b);if(c)return d.lengths.push(c[0]),c;var c=a.consumeColor(b);return c?(d.color=c[0],c):void 0}var d={inset:!1,lengths:[],color:null},e=a.consumeRepeated(c,/^/,b);return e&&e[0].length?[d,e[1]]:void 0}function c(c){var d=a.consumeRepeated(b,/^,/,c);return d&&""==d[1]?d[0]:void 0}function d(b,c){for(;b.lengths.length<Math.max(b.lengths.length,c.lengths.length);)b.lengths.push({px:0});for(;c.lengths.length<Math.max(b.lengths.length,c.lengths.length);)c.lengths.push({px:0});if(b.inset==c.inset&&!!b.color==!!c.color){for(var d,e=[],f=[[],0],g=[[],0],h=0;h<b.lengths.length;h++){var i=a.mergeDimensions(b.lengths[h],c.lengths[h],2==h);f[0].push(i[0]),g[0].push(i[1]),e.push(i[2])}if(b.color&&c.color){var j=a.mergeColors(b.color,c.color);f[1]=j[0],g[1]=j[1],d=j[2]}return[f,g,function(a){for(var c=b.inset?"inset ":" ",f=0;f<e.length;f++)c+=e[f](a[0][f])+" ";return d&&(c+=d(a[1])),c}]}}function e(b,c,d,e){function f(a){return{inset:a,color:[0,0,0,0],lengths:[{px:0},{px:0},{px:0},{px:0}]}}for(var g=[],h=[],i=0;i<d.length||i<e.length;i++){var j=d[i]||f(e[i].inset),k=e[i]||f(d[i].inset);g.push(j),h.push(k)}return a.mergeNestedRepeated(b,c,g,h)}var f=e.bind(null,d,", ");a.addPropertiesHandler(c,f,["box-shadow","text-shadow"])}(d),function(a){function b(a){return a.toFixed(3).replace(".000","")}function c(a,b,c){return Math.min(b,Math.max(a,c))}function d(a){return/^\s*[-+]?(\d*\.)?\d+\s*$/.test(a)?Number(a):void 0}function e(a,c){return[a,c,b]}function f(a,b){return 0!=a?h(0,1/0)(a,b):void 0}function g(a,b){return[a,b,function(a){return Math.round(c(1,1/0,a))}]}function h(a,d){return function(e,f){return[e,f,function(e){return b(c(a,d,e))}]}}function i(a,b){return[a,b,Math.round]}a.clamp=c,a.addPropertiesHandler(d,h(0,1/0),["border-image-width","line-height"]),a.addPropertiesHandler(d,h(0,1),["opacity","shape-image-threshold"]),a.addPropertiesHandler(d,f,["flex-grow","flex-shrink"]),a.addPropertiesHandler(d,g,["orphans","widows"]),a.addPropertiesHandler(d,i,["z-index"]),a.parseNumber=d,a.mergeNumbers=e,a.numberToString=b}(d,f),function(a){function b(a,b){return"visible"==a||"visible"==b?[0,1,function(c){return 0>=c?a:c>=1?b:"visible"}]:void 0}a.addPropertiesHandler(String,b,["visibility"])}(d),function(a){function b(a){a=a.trim(),e.fillStyle="#000",e.fillStyle=a;var b=e.fillStyle;if(e.fillStyle="#fff",e.fillStyle=a,b==e.fillStyle){e.fillRect(0,0,1,1);var c=e.getImageData(0,0,1,1).data;e.clearRect(0,0,1,1);var d=c[3]/255;return[c[0]*d,c[1]*d,c[2]*d,d]}}function c(b,c){return[b,c,function(b){function c(a){return Math.max(0,Math.min(255,a))}if(b[3])for(var d=0;3>d;d++)b[d]=Math.round(c(b[d]/b[3]));return b[3]=a.numberToString(a.clamp(0,1,b[3])),"rgba("+b.join(",")+")"}]}var d=document.createElementNS("http://www.w3.org/1999/xhtml","canvas");d.width=d.height=1;var e=d.getContext("2d");a.addPropertiesHandler(b,c,["background-color","border-bottom-color","border-left-color","border-right-color","border-top-color","color","outline-color","text-decoration-color"]),a.consumeColor=a.consumeParenthesised.bind(null,b),a.mergeColors=c}(d,f),function(a,b){function c(a,b){if(b=b.trim().toLowerCase(),"0"==b&&"px".search(a)>=0)return{px:0};if(/^[^(]*$|^calc/.test(b)){b=b.replace(/calc\(/g,"(");var c={};b=b.replace(a,function(a){return c[a]=null,"U"+a});for(var d="U("+a.source+")",e=b.replace(/[-+]?(\d*\.)?\d+/g,"N").replace(new RegExp("N"+d,"g"),"D").replace(/\s[+-]\s/g,"O").replace(/\s/g,""),f=[/N\*(D)/g,/(N|D)[*/]N/g,/(N|D)O\1/g,/\((N|D)\)/g],g=0;g<f.length;)f[g].test(e)?(e=e.replace(f[g],"$1"),g=0):g++;if("D"==e){for(var h in c){var i=eval(b.replace(new RegExp("U"+h,"g"),"").replace(new RegExp(d,"g"),"*0"));if(!isFinite(i))return;c[h]=i}return c}}}function d(a,b){return e(a,b,!0)}function e(b,c,d){var e,f=[];for(e in b)f.push(e);for(e in c)f.indexOf(e)<0&&f.push(e);return b=f.map(function(a){return b[a]||0}),c=f.map(function(a){return c[a]||0}),[b,c,function(b){var c=b.map(function(c,e){return 1==b.length&&d&&(c=Math.max(c,0)),a.numberToString(c)+f[e]}).join(" + ");return b.length>1?"calc("+c+")":c}]}var f="px|em|ex|ch|rem|vw|vh|vmin|vmax|cm|mm|in|pt|pc",g=c.bind(null,new RegExp(f,"g")),h=c.bind(null,new RegExp(f+"|%","g")),i=c.bind(null,/deg|rad|grad|turn/g);a.parseLength=g,a.parseLengthOrPercent=h,a.consumeLengthOrPercent=a.consumeParenthesised.bind(null,h),a.parseAngle=i,a.mergeDimensions=e;var j=a.consumeParenthesised.bind(null,g),k=a.consumeRepeated.bind(void 0,j,/^/),l=a.consumeRepeated.bind(void 0,k,/^,/);a.consumeSizePairList=l;var m=function(a){var b=l(a);return b&&""==b[1]?b[0]:void 0},n=a.mergeNestedRepeated.bind(void 0,d," "),o=a.mergeNestedRepeated.bind(void 0,n,",");a.mergeNonNegativeSizePair=n,a.addPropertiesHandler(m,o,["background-size"]),a.addPropertiesHandler(h,d,["border-bottom-width","border-image-width","border-left-width","border-right-width","border-top-width","flex-basis","font-size","height","line-height","max-height","max-width","outline-width","width"]),a.addPropertiesHandler(h,e,["border-bottom-left-radius","border-bottom-right-radius","border-top-left-radius","border-top-right-radius","bottom","left","letter-spacing","margin-bottom","margin-left","margin-right","margin-top","min-height","min-width","outline-offset","padding-bottom","padding-left","padding-right","padding-top","perspective","right","shape-margin","text-indent","top","vertical-align","word-spacing"])}(d,f),function(a){function b(b){return a.consumeLengthOrPercent(b)||a.consumeToken(/^auto/,b)}function c(c){var d=a.consumeList([a.ignore(a.consumeToken.bind(null,/^rect/)),a.ignore(a.consumeToken.bind(null,/^\(/)),a.consumeRepeated.bind(null,b,/^,/),a.ignore(a.consumeToken.bind(null,/^\)/))],c);return d&&4==d[0].length?d[0]:void 0}function d(b,c){return"auto"==b||"auto"==c?[!0,!1,function(d){var e=d?b:c;if("auto"==e)return"auto";var f=a.mergeDimensions(e,e);return f[2](f[0])}]:a.mergeDimensions(b,c)}function e(a){return"rect("+a+")"}var f=a.mergeWrappedNestedRepeated.bind(null,e,d,", ");a.parseBox=c,a.mergeBoxes=f,a.addPropertiesHandler(c,f,["clip"])}(d,f),function(a){function b(a){return function(b){var c=0;return a.map(function(a){return a===j?b[c++]:a})}}function c(a){return a}function d(b){if(b=b.toLowerCase().trim(),"none"==b)return[];for(var c,d=/\s*(\w+)\(([^)]*)\)/g,e=[],f=0;c=d.exec(b);){if(c.index!=f)return;f=c.index+c[0].length;var g=c[1],h=m[g];if(!h)return;var i=c[2].split(","),j=h[0];if(j.length<i.length)return;for(var n=[],o=0;o<j.length;o++){var p,q=i[o],r=j[o];if(p=q?{A:function(b){return"0"==b.trim()?l:a.parseAngle(b)},N:a.parseNumber,T:a.parseLengthOrPercent,L:a.parseLength}[r.toUpperCase()](q):{a:l,n:n[0],t:k}[r],void 0===p)return;n.push(p)}if(e.push({t:g,d:n}),d.lastIndex==b.length)return e}}function e(a){return a.toFixed(6).replace(".000000","")}function f(b,c){if(b.decompositionPair!==c){b.decompositionPair=c;var d=a.makeMatrixDecomposition(b)}if(c.decompositionPair!==b){c.decompositionPair=b;var f=a.makeMatrixDecomposition(c)}return null==d[0]||null==f[0]?[[!1],[!0],function(a){return a?c[0].d:b[0].d}]:(d[0].push(0),f[0].push(1),[d,f,function(b){var c=a.quat(d[0][3],f[0][3],b[5]),g=a.composeMatrix(b[0],b[1],b[2],c,b[4]),h=g.map(e).join(",");return h}])}function g(a){return a.replace(/[xy]/,"")}function h(a){return a.replace(/(x|y|z|3d)?$/,"3d")}function i(b,c){var d=a.makeMatrixDecomposition&&!0,e=!1;if(!b.length||!c.length){b.length||(e=!0,b=c,c=[]);for(var i=0;i<b.length;i++){var j=b[i].t,k=b[i].d,l="scale"==j.substr(0,5)?1:0;c.push({t:j,d:k.map(function(a){if("number"==typeof a)return l;var b={};for(var c in a)b[c]=l;return b})})}}var n=function(a,b){return"perspective"==a&&"perspective"==b||("matrix"==a||"matrix3d"==a)&&("matrix"==b||"matrix3d"==b)},o=[],p=[],q=[];if(b.length!=c.length){if(!d)return;var r=f(b,c);o=[r[0]],p=[r[1]],q=[["matrix",[r[2]]]]}else for(var i=0;i<b.length;i++){var j,s=b[i].t,t=c[i].t,u=b[i].d,v=c[i].d,w=m[s],x=m[t];if(n(s,t)){if(!d)return;var r=f([b[i]],[c[i]]);o.push(r[0]),p.push(r[1]),q.push(["matrix",[r[2]]])}else{if(s==t)j=s;else if(w[2]&&x[2]&&g(s)==g(t))j=g(s),u=w[2](u),v=x[2](v);else{if(!w[1]||!x[1]||h(s)!=h(t)){if(!d)return;var r=f(b,c);o=[r[0]],p=[r[1]],q=[["matrix",[r[2]]]];break}j=h(s),u=w[1](u),v=x[1](v)}for(var y=[],z=[],A=[],B=0;B<u.length;B++){var C="number"==typeof u[B]?a.mergeNumbers:a.mergeDimensions,r=C(u[B],v[B]);y[B]=r[0],z[B]=r[1],A.push(r[2])}o.push(y),p.push(z),q.push([j,A])}}if(e){var D=o;o=p,p=D}return[o,p,function(a){return a.map(function(a,b){var c=a.map(function(a,c){return q[b][1][c](a)}).join(",");return"matrix"==q[b][0]&&16==c.split(",").length&&(q[b][0]="matrix3d"),q[b][0]+"("+c+")"}).join(" ")}]}var j=null,k={px:0},l={deg:0},m={matrix:["NNNNNN",[j,j,0,0,j,j,0,0,0,0,1,0,j,j,0,1],c],matrix3d:["NNNNNNNNNNNNNNNN",c],rotate:["A"],rotatex:["A"],rotatey:["A"],rotatez:["A"],rotate3d:["NNNA"],perspective:["L"],scale:["Nn",b([j,j,1]),c],scalex:["N",b([j,1,1]),b([j,1])],scaley:["N",b([1,j,1]),b([1,j])],scalez:["N",b([1,1,j])],scale3d:["NNN",c],skew:["Aa",null,c],skewx:["A",null,b([j,l])],skewy:["A",null,b([l,j])],translate:["Tt",b([j,j,k]),c],translatex:["T",b([j,k,k]),b([j,k])],translatey:["T",b([k,j,k]),b([k,j])],translatez:["L",b([k,k,j])],translate3d:["TTL",c]};a.addPropertiesHandler(d,i,["transform"])}(d,f),function(a){function b(a,b){b.concat([a]).forEach(function(b){b in document.documentElement.style&&(c[a]=b)})}var c={};b("transform",["webkitTransform","msTransform"]),b("transformOrigin",["webkitTransformOrigin"]),b("perspective",["webkitPerspective"]),b("perspectiveOrigin",["webkitPerspectiveOrigin"]),a.propertyName=function(a){return c[a]||a}}(d,f)}(),!function(a,b){function c(a){var b=window.document.timeline;b.currentTime=a,b._discardAnimations(),0==b._animations.length?d=!1:requestAnimationFrame(c)}b.AnimationTimeline=function(){this._animations=[],this.currentTime=void 0},b.AnimationTimeline.prototype={getAnimations:function(){return this._discardAnimations(),this._animations.slice()},getAnimationPlayers:function(){return a.deprecated("AnimationTimeline.getAnimationPlayers","2015-03-23","Use AnimationTimeline.getAnimations instead."),this.getAnimations()},_discardAnimations:function(){this._animations=this._animations.filter(function(a){return"finished"!=a.playState&&"idle"!=a.playState})},play:function(a){var c=new b.Animation(a);return this._animations.push(c),b.restartWebAnimationsNextTick(),c._animation.play(),c}};var d=!1;b.restartWebAnimationsNextTick=function(){d||(d=!0,requestAnimationFrame(c))};var e=new b.AnimationTimeline;b.timeline=e;try{Object.defineProperty(window.document,"timeline",{configurable:!0,get:function(){return e}})}catch(f){}try{window.document.timeline=e}catch(f){}}(c,e,f),function(a,b){b.Animation=function(a){this.effect=a,a&&(a.animation=this),this._isGroup=!1,this._animation=null,this._childAnimations=[],this._callback=null,this._rebuildUnderlyingAnimation(),this._animation.cancel()},b.Animation.prototype={_rebuildUnderlyingAnimation:function(){this._animation&&(this._animation.cancel(),this._animation=null),(!this.effect||this.effect instanceof window.KeyframeEffect)&&(this._animation=b.newUnderlyingAnimationForKeyframeEffect(this.effect),b.bindAnimationForKeyframeEffect(this)),(this.effect instanceof window.SequenceEffect||this.effect instanceof window.GroupEffect)&&(this._animation=b.newUnderlyingAnimationForGroup(this.effect),b.bindAnimationForGroup(this))},_updateChildren:function(){if(this.effect&&"idle"!=this.playState){var a=this.effect._timing.delay;this._childAnimations.forEach(function(c){this._arrangeChildren(c,a),this.effect instanceof window.SequenceEffect&&(a+=b.groupChildDuration(c.effect))}.bind(this))}},_setExternalAnimation:function(a){if(this.effect&&this._isGroup)for(var b=0;b<this.effect.children.length;b++)this.effect.children[b].animation=a,this._childAnimations[b]._setExternalAnimation(a)},_constructChildren:function(){if(this.effect&&this._isGroup){var a=this.effect._timing.delay;this.effect.children.forEach(function(c){var d=window.document.timeline.play(c);this._childAnimations.push(d),d.playbackRate=this.playbackRate,this.paused&&d.pause(),c.animation=this.effect.animation,this._arrangeChildren(d,a),this.effect instanceof window.SequenceEffect&&(a+=b.groupChildDuration(c))}.bind(this))}},_arrangeChildren:function(a,b){null===this.startTime?(a.currentTime=this.currentTime-b/this.playbackRate,a._startTime=null):a.startTime!==this.startTime+b/this.playbackRate&&(a.startTime=this.startTime+b/this.playbackRate)},get paused(){return this._animation.paused},get playState(){return this._animation.playState},get onfinish(){return this._onfinish},set onfinish(a){"function"==typeof a?(this._onfinish=a,this._animation.onfinish=function(b){b.target=this,a.call(this,b)}.bind(this)):(this._animation.onfinish=a,this.onfinish=this._animation.onfinish)},get currentTime(){return this._animation.currentTime},set currentTime(a){this._animation.currentTime=a,this._register(),this._forEachChild(function(b,c){b.currentTime=a-c})},get startTime(){return this._animation.startTime},set startTime(a){this._animation.startTime=a,this._register(),this._forEachChild(function(b,c){b.startTime=a+c})},get playbackRate(){return this._animation.playbackRate},set playbackRate(a){var b=this.currentTime;this._animation.playbackRate=a,this._forEachChild(function(b){b.playbackRate=a}),"paused"!=this.playState&&"idle"!=this.playState&&this.play(),null!==b&&(this.currentTime=b)},get finished(){return this._animation.finished},get source(){return a.deprecated("Animation.source","2015-03-23","Use Animation.effect instead."),this.effect},play:function(){this._animation.play(),this._register(),b.awaitStartTime(this),this._forEachChild(function(a){var b=a.currentTime;a.play(),a.currentTime=b})},pause:function(){this._animation.pause(),this._register(),this._forEachChild(function(a){a.pause()})},finish:function(){this._animation.finish(),this._register()},cancel:function(){this._animation.cancel(),this._register(),this._removeChildren()},reverse:function(){var a=this.currentTime;this._animation.reverse(),this._forEachChild(function(a){a.reverse()}),null!==a&&(this.currentTime=a)},addEventListener:function(a,b){var c=b;"function"==typeof b&&(c=function(a){a.target=this,b.call(this,a)}.bind(this),b._wrapper=c),this._animation.addEventListener(a,c)},removeEventListener:function(a,b){this._animation.removeEventListener(a,b&&b._wrapper||b)},_removeChildren:function(){for(;this._childAnimations.length;)this._childAnimations.pop().cancel()},_forEachChild:function(b){var c=0;if(this.effect.children&&this._childAnimations.length<this.effect.children.length&&this._constructChildren(),this._childAnimations.forEach(function(a){b.call(this,a,c),this.effect instanceof window.SequenceEffect&&(c+=a.effect.activeDuration)}.bind(this)),"pending"!=this._animation.playState){var d=this.effect._timing,e=this._animation.currentTime;null!==e&&(e=a.calculateTimeFraction(a.calculateActiveDuration(d),e,d)),(null==e||isNaN(e))&&this._removeChildren()}}}}(c,e,f),function(a,b){function c(b){this._frames=a.normalizeKeyframes(b)}function d(){for(var a=!1;g.length;)g.shift()._updateChildren(),a=!0;return a}b.KeyframeEffect=function(b,d,e){return this.target=b,this._timingInput=e,this._timing=a.normalizeTimingInput(e),this.timing=a.makeTiming(e),this._normalizedKeyframes="function"==typeof d?d:new c(d),this._keyframes=d,this.activeDuration=a.calculateActiveDuration(this._timing),this
},b.KeyframeEffect.prototype={getFrames:function(){return"function"==typeof this._normalizedKeyframes?this._normalizedKeyframes:this._normalizedKeyframes._frames},get effect(){return a.deprecated("KeyframeEffect.effect","2015-03-23","Use KeyframeEffect.getFrames() instead."),this._normalizedKeyframes}};var e=Element.prototype.animate;Element.prototype.animate=function(a,c){return b.timeline.play(new b.KeyframeEffect(this,a,c))};var f=document.createElementNS("http://www.w3.org/1999/xhtml","div");b.newUnderlyingAnimationForKeyframeEffect=function(a){var b=a.target||f,c=a._keyframes;return"function"==typeof c&&(c=[]),e.apply(b,[c,a._timingInput])},b.bindAnimationForKeyframeEffect=function(a){a.effect&&"function"==typeof a.effect._normalizedKeyframes&&b.bindAnimationForCustomEffect(a)};var g=[];b.awaitStartTime=function(a){null===a.startTime&&a._isGroup&&(0==g.length&&requestAnimationFrame(d),g.push(a))};var h=window.getComputedStyle;Object.defineProperty(window,"getComputedStyle",{configurable:!0,enumerable:!0,value:function(){var a=h.apply(this,arguments);return d()&&(a=h.apply(this,arguments)),a}}),window.KeyframeEffect=b.KeyframeEffect,window.Element.prototype.getAnimations=function(){return document.timeline.getAnimations().filter(function(a){return null!==a.effect&&a.effect.target==this}.bind(this))},window.Element.prototype.getAnimationPlayers=function(){return a.deprecated("Element.getAnimationPlayers","2015-03-23","Use Element.getAnimations instead."),this.getAnimations()},window.Animation=function(){a.deprecated("window.Animation","2015-03-23","Use window.KeyframeEffect instead."),window.KeyframeEffect.apply(this,arguments)},window.Animation.prototype=Object.create(window.KeyframeEffect.prototype),window.Animation.prototype.constructor=window.Animation}(c,e,f),function(a,b){function c(a){a._registered||(a._registered=!0,f.push(a),g||(g=!0,requestAnimationFrame(d)))}function d(){var a=f;f=[],a.sort(function(a,b){return a._sequenceNumber-b._sequenceNumber}),a=a.filter(function(a){a();var b=a._animation?a._animation.playState:"idle";return"running"!=b&&"pending"!=b&&(a._registered=!1),a._registered}),f.push.apply(f,a),f.length?(g=!0,requestAnimationFrame(d)):g=!1}var e=(document.createElementNS("http://www.w3.org/1999/xhtml","div"),0);b.bindAnimationForCustomEffect=function(b){var d=b.effect.target,f=b.effect._normalizedKeyframes,g=b.effect.timing,h=null;g=a.normalizeTimingInput(g);var i=function(){var c=i._animation?i._animation.currentTime:null;null!==c&&(c=a.calculateTimeFraction(a.calculateActiveDuration(g),c,g),isNaN(c)&&(c=null)),c!==h&&f(c,d,b.effect),h=c};i._animation=b,i._registered=!1,i._sequenceNumber=e++,b._callback=i,c(i)};var f=[],g=!1;b.Animation.prototype._register=function(){this._callback&&c(this._callback)}}(c,e,f),function(a,b){function c(a){return a._timing.delay+a.activeDuration+a._timing.endDelay}function d(b,c){this.children=b||[],this._timing=a.normalizeTimingInput(c,!0),this.timing=a.makeTiming(c,!0),"auto"===this._timing.duration&&(this._timing.duration=this.activeDuration)}window.SequenceEffect=function(){d.apply(this,arguments)},window.GroupEffect=function(){d.apply(this,arguments)},window.SequenceEffect.prototype={get activeDuration(){var a=0;return this.children.forEach(function(b){a+=c(b)}),Math.max(a,0)}},window.GroupEffect.prototype={get activeDuration(){var a=0;return this.children.forEach(function(b){a=Math.max(a,c(b))}),a}},b.newUnderlyingAnimationForGroup=function(c){var d,e=null,f=function(b){var c=d._wrapper;return"pending"!=c.playState&&c.effect?null==b?void c._removeChildren():0==b&&c.playbackRate<0&&(e||(e=a.normalizeTimingInput(c.effect.timing)),b=a.calculateTimeFraction(a.calculateActiveDuration(e),-1,e),isNaN(b)||null==b)?(c._forEachChild(function(a){a.currentTime=-1}),void c._removeChildren()):void 0:void 0};return d=b.timeline.play(new b.KeyframeEffect(null,f,c._timing))},b.bindAnimationForGroup=function(a){a._animation._wrapper=a,a._isGroup=!0,b.awaitStartTime(a),a._constructChildren(),a._setExternalAnimation(a)},b.groupChildDuration=c,window.AnimationSequence=function(){a.deprecated("window.AnimationSequence","2015-03-23","Use window.SequenceEffect instead."),window.SequenceEffect.apply(this,arguments)},window.AnimationSequence.prototype=Object.create(window.SequenceEffect.prototype),window.AnimationSequence.prototype.constructor=window.AnimationSequence,window.AnimationGroup=function(){a.deprecated("window.AnimationGroup","2015-03-23","Use window.GroupEffect instead."),window.GroupEffect.apply(this,arguments)},window.AnimationGroup.prototype=Object.create(window.GroupEffect.prototype),window.AnimationGroup.prototype.constructor=window.AnimationGroup}(c,e,f)}({},function(){return this}());
//# sourceMappingURL=web-animations-next-lite.min.js.map
;
// This is a manifest file that'll be compiled into application.js, which will include all the files
// listed below.
//
// Any JavaScript/Coffee file within this directory, lib/assets/javascripts, vendor/assets/javascripts,
// or vendor/assets/javascripts of plugins, if any, can be referenced here using a relative path.
//
// It's not advisable to add code directly here, but if you do, it'll appear at the bottom of the
// compiled file.
//
// Read Sprockets README (https://github.com/sstephenson/sprockets#sprockets-directives) for details
// about supported directives.
//




















;
