'use strict';
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) =>
  function __require() {
    return (
      mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod),
      mod.exports
    );
  };

// node_modules/requires-port/index.js
var require_requires_port = __commonJS({
  'node_modules/requires-port/index.js'(exports2, module2) {
    'use strict';
    module2.exports = function required(port, protocol) {
      protocol = protocol.split(':')[0];
      port = +port;
      if (!port) return false;
      switch (protocol) {
        case 'http':
        case 'ws':
          return port !== 80;
        case 'https':
        case 'wss':
          return port !== 443;
        case 'ftp':
          return port !== 21;
        case 'gopher':
          return port !== 70;
        case 'file':
          return false;
      }
      return port !== 0;
    };
  },
});

// node_modules/querystringify/index.js
var require_querystringify = __commonJS({
  'node_modules/querystringify/index.js'(exports2) {
    'use strict';
    var has = Object.prototype.hasOwnProperty;
    var undef;
    function decode(input) {
      try {
        return decodeURIComponent(input.replace(/\+/g, ' '));
      } catch (e) {
        return null;
      }
    }
    function encode(input) {
      try {
        return encodeURIComponent(input);
      } catch (e) {
        return null;
      }
    }
    function querystring(query) {
      var parser = /([^=?#&]+)=?([^&]*)/g,
        result = {},
        part;
      while ((part = parser.exec(query))) {
        var key = decode(part[1]),
          value = decode(part[2]);
        if (key === null || value === null || key in result) continue;
        result[key] = value;
      }
      return result;
    }
    function querystringify(obj, prefix) {
      prefix = prefix || '';
      var pairs = [],
        value,
        key;
      if ('string' !== typeof prefix) prefix = '?';
      for (key in obj) {
        if (has.call(obj, key)) {
          value = obj[key];
          if (!value && (value === null || value === undef || isNaN(value))) {
            value = '';
          }
          key = encode(key);
          value = encode(value);
          if (key === null || value === null) continue;
          pairs.push(key + '=' + value);
        }
      }
      return pairs.length ? prefix + pairs.join('&') : '';
    }
    exports2.stringify = querystringify;
    exports2.parse = querystring;
  },
});

// node_modules/url-parse/index.js
var require_url_parse = __commonJS({
  'node_modules/url-parse/index.js'(exports2, module2) {
    'use strict';
    var required = require_requires_port();
    var qs = require_querystringify();
    var controlOrWhitespace =
      /^[\x00-\x20\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/;
    var CRHTLF = /[\n\r\t]/g;
    var slashes = /^[A-Za-z][A-Za-z0-9+-.]*:\/\//;
    var port = /:\d+$/;
    var protocolre = /^([a-z][a-z0-9.+-]*:)?(\/\/)?([\\/]+)?([\S\s]*)/i;
    var windowsDriveLetter = /^[a-zA-Z]:/;
    function trimLeft(str) {
      return (str ? str : '').toString().replace(controlOrWhitespace, '');
    }
    var rules = [
      ['#', 'hash'],
      // Extract from the back.
      ['?', 'query'],
      // Extract from the back.
      function sanitize(address, url) {
        return isSpecial(url.protocol) ? address.replace(/\\/g, '/') : address;
      },
      ['/', 'pathname'],
      // Extract from the back.
      ['@', 'auth', 1],
      // Extract from the front.
      [NaN, 'host', void 0, 1, 1],
      // Set left over value.
      [/:(\d*)$/, 'port', void 0, 1],
      // RegExp the back.
      [NaN, 'hostname', void 0, 1, 1],
      // Set left over.
    ];
    var ignore = { hash: 1, query: 1 };
    function lolcation(loc) {
      var globalVar;
      if (typeof window !== 'undefined') globalVar = window;
      else if (typeof global !== 'undefined') globalVar = global;
      else if (typeof self !== 'undefined') globalVar = self;
      else globalVar = {};
      var location = globalVar.location || {};
      loc = loc || location;
      var finaldestination = {},
        type = typeof loc,
        key;
      if ('blob:' === loc.protocol) {
        finaldestination = new Url(unescape(loc.pathname), {});
      } else if ('string' === type) {
        finaldestination = new Url(loc, {});
        for (key in ignore) delete finaldestination[key];
      } else if ('object' === type) {
        for (key in loc) {
          if (key in ignore) continue;
          finaldestination[key] = loc[key];
        }
        if (finaldestination.slashes === void 0) {
          finaldestination.slashes = slashes.test(loc.href);
        }
      }
      return finaldestination;
    }
    function isSpecial(scheme) {
      return (
        scheme === 'file:' ||
        scheme === 'ftp:' ||
        scheme === 'http:' ||
        scheme === 'https:' ||
        scheme === 'ws:' ||
        scheme === 'wss:'
      );
    }
    function extractProtocol(address, location) {
      address = trimLeft(address);
      address = address.replace(CRHTLF, '');
      location = location || {};
      var match = protocolre.exec(address);
      var protocol = match[1] ? match[1].toLowerCase() : '';
      var forwardSlashes = !!match[2];
      var otherSlashes = !!match[3];
      var slashesCount = 0;
      var rest;
      if (forwardSlashes) {
        if (otherSlashes) {
          rest = match[2] + match[3] + match[4];
          slashesCount = match[2].length + match[3].length;
        } else {
          rest = match[2] + match[4];
          slashesCount = match[2].length;
        }
      } else {
        if (otherSlashes) {
          rest = match[3] + match[4];
          slashesCount = match[3].length;
        } else {
          rest = match[4];
        }
      }
      if (protocol === 'file:') {
        if (slashesCount >= 2) {
          rest = rest.slice(2);
        }
      } else if (isSpecial(protocol)) {
        rest = match[4];
      } else if (protocol) {
        if (forwardSlashes) {
          rest = rest.slice(2);
        }
      } else if (slashesCount >= 2 && isSpecial(location.protocol)) {
        rest = match[4];
      }
      return {
        protocol,
        slashes: forwardSlashes || isSpecial(protocol),
        slashesCount,
        rest,
      };
    }
    function resolve(relative, base) {
      if (relative === '') return base;
      var path = (base || '/').split('/').slice(0, -1).concat(relative.split('/')),
        i = path.length,
        last = path[i - 1],
        unshift = false,
        up = 0;
      while (i--) {
        if (path[i] === '.') {
          path.splice(i, 1);
        } else if (path[i] === '..') {
          path.splice(i, 1);
          up++;
        } else if (up) {
          if (i === 0) unshift = true;
          path.splice(i, 1);
          up--;
        }
      }
      if (unshift) path.unshift('');
      if (last === '.' || last === '..') path.push('');
      return path.join('/');
    }
    function Url(address, location, parser) {
      address = trimLeft(address);
      address = address.replace(CRHTLF, '');
      if (!(this instanceof Url)) {
        return new Url(address, location, parser);
      }
      var relative,
        extracted,
        parse,
        instruction,
        index,
        key,
        instructions = rules.slice(),
        type = typeof location,
        url = this,
        i = 0;
      if ('object' !== type && 'string' !== type) {
        parser = location;
        location = null;
      }
      if (parser && 'function' !== typeof parser) parser = qs.parse;
      location = lolcation(location);
      extracted = extractProtocol(address || '', location);
      relative = !extracted.protocol && !extracted.slashes;
      url.slashes = extracted.slashes || (relative && location.slashes);
      url.protocol = extracted.protocol || location.protocol || '';
      address = extracted.rest;
      if (
        (extracted.protocol === 'file:' &&
          (extracted.slashesCount !== 2 || windowsDriveLetter.test(address))) ||
        (!extracted.slashes &&
          (extracted.protocol || extracted.slashesCount < 2 || !isSpecial(url.protocol)))
      ) {
        instructions[3] = [/(.*)/, 'pathname'];
      }
      for (; i < instructions.length; i++) {
        instruction = instructions[i];
        if (typeof instruction === 'function') {
          address = instruction(address, url);
          continue;
        }
        parse = instruction[0];
        key = instruction[1];
        if (parse !== parse) {
          url[key] = address;
        } else if ('string' === typeof parse) {
          index = parse === '@' ? address.lastIndexOf(parse) : address.indexOf(parse);
          if (~index) {
            if ('number' === typeof instruction[2]) {
              url[key] = address.slice(0, index);
              address = address.slice(index + instruction[2]);
            } else {
              url[key] = address.slice(index);
              address = address.slice(0, index);
            }
          }
        } else if ((index = parse.exec(address))) {
          url[key] = index[1];
          address = address.slice(0, index.index);
        }
        url[key] = url[key] || (relative && instruction[3] ? location[key] || '' : '');
        if (instruction[4]) url[key] = url[key].toLowerCase();
      }
      if (parser) url.query = parser(url.query);
      if (
        relative &&
        location.slashes &&
        url.pathname.charAt(0) !== '/' &&
        (url.pathname !== '' || location.pathname !== '')
      ) {
        url.pathname = resolve(url.pathname, location.pathname);
      }
      if (url.pathname.charAt(0) !== '/' && isSpecial(url.protocol)) {
        url.pathname = '/' + url.pathname;
      }
      if (!required(url.port, url.protocol)) {
        url.host = url.hostname;
        url.port = '';
      }
      url.username = url.password = '';
      if (url.auth) {
        index = url.auth.indexOf(':');
        if (~index) {
          url.username = url.auth.slice(0, index);
          url.username = encodeURIComponent(decodeURIComponent(url.username));
          url.password = url.auth.slice(index + 1);
          url.password = encodeURIComponent(decodeURIComponent(url.password));
        } else {
          url.username = encodeURIComponent(decodeURIComponent(url.auth));
        }
        url.auth = url.password ? url.username + ':' + url.password : url.username;
      }
      url.origin =
        url.protocol !== 'file:' && isSpecial(url.protocol) && url.host
          ? url.protocol + '//' + url.host
          : 'null';
      url.href = url.toString();
    }
    function set(part, value, fn) {
      var url = this;
      switch (part) {
        case 'query':
          if ('string' === typeof value && value.length) {
            value = (fn || qs.parse)(value);
          }
          url[part] = value;
          break;
        case 'port':
          url[part] = value;
          if (!required(value, url.protocol)) {
            url.host = url.hostname;
            url[part] = '';
          } else if (value) {
            url.host = url.hostname + ':' + value;
          }
          break;
        case 'hostname':
          url[part] = value;
          if (url.port) value += ':' + url.port;
          url.host = value;
          break;
        case 'host':
          url[part] = value;
          if (port.test(value)) {
            value = value.split(':');
            url.port = value.pop();
            url.hostname = value.join(':');
          } else {
            url.hostname = value;
            url.port = '';
          }
          break;
        case 'protocol':
          url.protocol = value.toLowerCase();
          url.slashes = !fn;
          break;
        case 'pathname':
        case 'hash':
          if (value) {
            var char = part === 'pathname' ? '/' : '#';
            url[part] = value.charAt(0) !== char ? char + value : value;
          } else {
            url[part] = value;
          }
          break;
        case 'username':
        case 'password':
          url[part] = encodeURIComponent(value);
          break;
        case 'auth':
          var index = value.indexOf(':');
          if (~index) {
            url.username = value.slice(0, index);
            url.username = encodeURIComponent(decodeURIComponent(url.username));
            url.password = value.slice(index + 1);
            url.password = encodeURIComponent(decodeURIComponent(url.password));
          } else {
            url.username = encodeURIComponent(decodeURIComponent(value));
          }
      }
      for (var i = 0; i < rules.length; i++) {
        var ins = rules[i];
        if (ins[4]) url[ins[1]] = url[ins[1]].toLowerCase();
      }
      url.auth = url.password ? url.username + ':' + url.password : url.username;
      url.origin =
        url.protocol !== 'file:' && isSpecial(url.protocol) && url.host
          ? url.protocol + '//' + url.host
          : 'null';
      url.href = url.toString();
      return url;
    }
    function toString(stringify) {
      if (!stringify || 'function' !== typeof stringify) stringify = qs.stringify;
      var query,
        url = this,
        host = url.host,
        protocol = url.protocol;
      if (protocol && protocol.charAt(protocol.length - 1) !== ':') protocol += ':';
      var result =
        protocol + ((url.protocol && url.slashes) || isSpecial(url.protocol) ? '//' : '');
      if (url.username) {
        result += url.username;
        if (url.password) result += ':' + url.password;
        result += '@';
      } else if (url.password) {
        result += ':' + url.password;
        result += '@';
      } else if (
        url.protocol !== 'file:' &&
        isSpecial(url.protocol) &&
        !host &&
        url.pathname !== '/'
      ) {
        result += '@';
      }
      if (host[host.length - 1] === ':' || (port.test(url.hostname) && !url.port)) {
        host += ':';
      }
      result += host + url.pathname;
      query = 'object' === typeof url.query ? stringify(url.query) : url.query;
      if (query) result += '?' !== query.charAt(0) ? '?' + query : query;
      if (url.hash) result += url.hash;
      return result;
    }
    Url.prototype = { set, toString };
    Url.extractProtocol = extractProtocol;
    Url.location = lolcation;
    Url.trimLeft = trimLeft;
    Url.qs = qs;
    module2.exports = Url;
  },
});

// node_modules/url-join/lib/url-join.js
var require_url_join = __commonJS({
  'node_modules/url-join/lib/url-join.js'(exports2, module2) {
    (function (name, context, definition) {
      if (typeof module2 !== 'undefined' && module2.exports) module2.exports = definition();
      else if (typeof define === 'function' && define.amd) define(definition);
      else context[name] = definition();
    })('urljoin', exports2, function () {
      function normalize(strArray) {
        var resultArray = [];
        if (strArray.length === 0) {
          return '';
        }
        if (typeof strArray[0] !== 'string') {
          throw new TypeError('Url must be a string. Received ' + strArray[0]);
        }
        if (strArray[0].match(/^[^/:]+:\/*$/) && strArray.length > 1) {
          var first = strArray.shift();
          strArray[0] = first + strArray[0];
        }
        if (strArray[0].match(/^file:\/\/\//)) {
          strArray[0] = strArray[0].replace(/^([^/:]+):\/*/, '$1:///');
        } else {
          strArray[0] = strArray[0].replace(/^([^/:]+):\/*/, '$1://');
        }
        for (var i = 0; i < strArray.length; i++) {
          var component = strArray[i];
          if (typeof component !== 'string') {
            throw new TypeError('Url must be a string. Received ' + component);
          }
          if (component === '') {
            continue;
          }
          if (i > 0) {
            component = component.replace(/^[\/]+/, '');
          }
          if (i < strArray.length - 1) {
            component = component.replace(/[\/]+$/, '');
          } else {
            component = component.replace(/[\/]+$/, '/');
          }
          resultArray.push(component);
        }
        var str = resultArray.join('/');
        str = str.replace(/\/(\?|&|#[^!])/g, '$1');
        var parts = str.split('?');
        str = parts.shift() + (parts.length > 0 ? '?' : '') + parts.join('&');
        return str;
      }
      return function () {
        var input;
        if (typeof arguments[0] === 'object') {
          input = arguments[0];
        } else {
          input = [].slice.call(arguments);
        }
        return normalize(input);
      };
    });
  },
});

// node_modules/path-posix/index.js
var require_path_posix = __commonJS({
  'node_modules/path-posix/index.js'(exports2, module2) {
    'use strict';
    var util = require('util');
    var isString = function (x) {
      return typeof x === 'string';
    };
    function normalizeArray(parts, allowAboveRoot) {
      var res = [];
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (!p || p === '.') continue;
        if (p === '..') {
          if (res.length && res[res.length - 1] !== '..') {
            res.pop();
          } else if (allowAboveRoot) {
            res.push('..');
          }
        } else {
          res.push(p);
        }
      }
      return res;
    }
    var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
    var posix = {};
    function posixSplitPath(filename) {
      return splitPathRe.exec(filename).slice(1);
    }
    posix.resolve = function () {
      var resolvedPath = '',
        resolvedAbsolute = false;
      for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
        var path = i >= 0 ? arguments[i] : process.cwd();
        if (!isString(path)) {
          throw new TypeError('Arguments to path.resolve must be strings');
        } else if (!path) {
          continue;
        }
        resolvedPath = path + '/' + resolvedPath;
        resolvedAbsolute = path.charAt(0) === '/';
      }
      resolvedPath = normalizeArray(resolvedPath.split('/'), !resolvedAbsolute).join('/');
      return (resolvedAbsolute ? '/' : '') + resolvedPath || '.';
    };
    posix.normalize = function (path) {
      var isAbsolute = posix.isAbsolute(path),
        trailingSlash = path.substr(-1) === '/';
      path = normalizeArray(path.split('/'), !isAbsolute).join('/');
      if (!path && !isAbsolute) {
        path = '.';
      }
      if (path && trailingSlash) {
        path += '/';
      }
      return (isAbsolute ? '/' : '') + path;
    };
    posix.isAbsolute = function (path) {
      return path.charAt(0) === '/';
    };
    posix.join = function () {
      var path = '';
      for (var i = 0; i < arguments.length; i++) {
        var segment = arguments[i];
        if (!isString(segment)) {
          throw new TypeError('Arguments to path.join must be strings');
        }
        if (segment) {
          if (!path) {
            path += segment;
          } else {
            path += '/' + segment;
          }
        }
      }
      return posix.normalize(path);
    };
    posix.relative = function (from, to) {
      from = posix.resolve(from).substr(1);
      to = posix.resolve(to).substr(1);
      function trim(arr) {
        var start = 0;
        for (; start < arr.length; start++) {
          if (arr[start] !== '') break;
        }
        var end = arr.length - 1;
        for (; end >= 0; end--) {
          if (arr[end] !== '') break;
        }
        if (start > end) return [];
        return arr.slice(start, end + 1);
      }
      var fromParts = trim(from.split('/'));
      var toParts = trim(to.split('/'));
      var length = Math.min(fromParts.length, toParts.length);
      var samePartsLength = length;
      for (var i = 0; i < length; i++) {
        if (fromParts[i] !== toParts[i]) {
          samePartsLength = i;
          break;
        }
      }
      var outputParts = [];
      for (var i = samePartsLength; i < fromParts.length; i++) {
        outputParts.push('..');
      }
      outputParts = outputParts.concat(toParts.slice(samePartsLength));
      return outputParts.join('/');
    };
    posix._makeLong = function (path) {
      return path;
    };
    posix.dirname = function (path) {
      var result = posixSplitPath(path),
        root = result[0],
        dir = result[1];
      if (!root && !dir) {
        return '.';
      }
      if (dir) {
        dir = dir.substr(0, dir.length - 1);
      }
      return root + dir;
    };
    posix.basename = function (path, ext) {
      var f = posixSplitPath(path)[2];
      if (ext && f.substr(-1 * ext.length) === ext) {
        f = f.substr(0, f.length - ext.length);
      }
      return f;
    };
    posix.extname = function (path) {
      return posixSplitPath(path)[3];
    };
    posix.format = function (pathObject) {
      if (!util.isObject(pathObject)) {
        throw new TypeError("Parameter 'pathObject' must be an object, not " + typeof pathObject);
      }
      var root = pathObject.root || '';
      if (!isString(root)) {
        throw new TypeError(
          "'pathObject.root' must be a string or undefined, not " + typeof pathObject.root
        );
      }
      var dir = pathObject.dir ? pathObject.dir + posix.sep : '';
      var base = pathObject.base || '';
      return dir + base;
    };
    posix.parse = function (pathString) {
      if (!isString(pathString)) {
        throw new TypeError("Parameter 'pathString' must be a string, not " + typeof pathString);
      }
      var allParts = posixSplitPath(pathString);
      if (!allParts || allParts.length !== 4) {
        throw new TypeError("Invalid path '" + pathString + "'");
      }
      allParts[1] = allParts[1] || '';
      allParts[2] = allParts[2] || '';
      allParts[3] = allParts[3] || '';
      return {
        root: allParts[0],
        dir: allParts[0] + allParts[1].slice(0, allParts[1].length - 1),
        base: allParts[2],
        ext: allParts[3],
        name: allParts[2].slice(0, allParts[2].length - allParts[3].length),
      };
    };
    posix.sep = '/';
    posix.delimiter = ':';
    module2.exports = posix;
  },
});

// node_modules/webdav/dist/node/tools/path.js
var require_path = __commonJS({
  'node_modules/webdav/dist/node/tools/path.js'(exports2) {
    'use strict';
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.normalisePath = exports2.getAllDirectories = exports2.encodePath = void 0;
    var path_posix_1 = require_path_posix();
    var SEP_PATH_POSIX = '__PATH_SEPARATOR_POSIX__';
    var SEP_PATH_WINDOWS = '__PATH_SEPARATOR_WINDOWS__';
    function encodePath(path) {
      var replaced = path.replace(/\//g, SEP_PATH_POSIX).replace(/\\\\/g, SEP_PATH_WINDOWS);
      var formatted = encodeURIComponent(replaced);
      return formatted.split(SEP_PATH_WINDOWS).join('\\\\').split(SEP_PATH_POSIX).join('/');
    }
    exports2.encodePath = encodePath;
    function getAllDirectories(path) {
      if (!path || path === '/') return [];
      var currentPath = path;
      var output = [];
      do {
        output.push(currentPath);
        currentPath = (0, path_posix_1.dirname)(currentPath);
      } while (currentPath && currentPath !== '/');
      return output;
    }
    exports2.getAllDirectories = getAllDirectories;
    function normalisePath(pathStr) {
      var normalisedPath = pathStr;
      if (normalisedPath[0] !== '/') {
        normalisedPath = '/' + normalisedPath;
      }
      if (/^.+\/$/.test(normalisedPath)) {
        normalisedPath = normalisedPath.substr(0, normalisedPath.length - 1);
      }
      return normalisedPath;
    }
    exports2.normalisePath = normalisePath;
  },
});

// node_modules/webdav/dist/node/tools/url.js
var require_url = __commonJS({
  'node_modules/webdav/dist/node/tools/url.js'(exports2) {
    'use strict';
    var __importDefault =
      (exports2 && exports2.__importDefault) ||
      function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
      };
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.normaliseHREF = exports2.joinURL = exports2.extractURLPath = void 0;
    var url_parse_1 = __importDefault(require_url_parse());
    var url_join_1 = __importDefault(require_url_join());
    var path_1 = require_path();
    function extractURLPath(fullURL) {
      var url = new url_parse_1.default(fullURL);
      var urlPath = url.pathname;
      if (urlPath.length <= 0) {
        urlPath = '/';
      }
      return (0, path_1.normalisePath)(urlPath);
    }
    exports2.extractURLPath = extractURLPath;
    function joinURL() {
      var parts = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        parts[_i] = arguments[_i];
      }
      return (0, url_join_1.default)(
        parts.reduce(function (output, nextPart, partIndex) {
          if (
            partIndex === 0 ||
            nextPart !== '/' ||
            (nextPart === '/' && output[output.length - 1] !== '/')
          ) {
            output.push(nextPart);
          }
          return output;
        }, [])
      );
    }
    exports2.joinURL = joinURL;
    function normaliseHREF(href) {
      var normalisedHref = href.replace(/^https?:\/\/[^\/]+/, '');
      return normalisedHref;
    }
    exports2.normaliseHREF = normaliseHREF;
  },
});

// node_modules/layerr/dist/error.js
var require_error = __commonJS({
  'node_modules/layerr/dist/error.js'(exports2) {
    'use strict';
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.isError = exports2.inherit = exports2.assertError = void 0;
    function assertError(err) {
      if (!isError(err)) {
        throw new Error('Parameter was not an error');
      }
    }
    exports2.assertError = assertError;
    function inherit(ctor, superCtor) {
      ctor.super_ = superCtor;
      ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
          value: ctor,
          enumerable: false,
          writable: true,
          configurable: true,
        },
      });
    }
    exports2.inherit = inherit;
    function isError(err) {
      return objectToString(err) === '[object Error]' || err instanceof Error;
    }
    exports2.isError = isError;
    function objectToString(obj) {
      return Object.prototype.toString.call(obj);
    }
  },
});

// node_modules/layerr/dist/tools.js
var require_tools = __commonJS({
  'node_modules/layerr/dist/tools.js'(exports2) {
    'use strict';
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.parseArguments = void 0;
    var error_1 = require_error();
    function parseArguments(args) {
      let options,
        shortMessage = '';
      if (args.length === 0) {
        options = {};
      } else if (error_1.isError(args[0])) {
        options = {
          cause: args[0],
        };
        shortMessage = args.slice(1).join(' ') || '';
      } else if (args[0] && typeof args[0] === 'object') {
        options = Object.assign({}, args[0]);
        shortMessage = args.slice(1).join(' ') || '';
      } else if (typeof args[0] === 'string') {
        options = {};
        shortMessage = shortMessage = args.join(' ') || '';
      } else {
        throw new Error('Invalid arguments passed to Layerr');
      }
      return {
        options,
        shortMessage,
      };
    }
    exports2.parseArguments = parseArguments;
  },
});

// node_modules/layerr/dist/layerr.js
var require_layerr = __commonJS({
  'node_modules/layerr/dist/layerr.js'(exports2) {
    'use strict';
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.Layerr = void 0;
    var error_1 = require_error();
    var tools_1 = require_tools();
    function Layerr(errorOptionsOrMessage, messageText) {
      const args = [...arguments];
      if (this instanceof Layerr === false) {
        throw new Error("Cannot invoke 'Layerr' like a function: It must be called with 'new'");
      }
      const { options, shortMessage } = tools_1.parseArguments(args);
      this.name = 'Layerr';
      if (options.name && typeof options.name === 'string') {
        this.name = options.name;
      }
      let message = shortMessage;
      if (options.cause) {
        Object.defineProperty(this, '_cause', { value: options.cause });
        message = `${message}: ${options.cause.message}`;
      }
      this.message = message;
      Object.defineProperty(this, '_info', { value: {} });
      if (options.info && typeof options.info === 'object') {
        Object.assign(this._info, options.info);
      }
      Error.call(this, message);
      if (Error.captureStackTrace) {
        const ctor = options.constructorOpt || this.constructor;
        Error.captureStackTrace(this, ctor);
      }
      return this;
    }
    exports2.Layerr = Layerr;
    error_1.inherit(Layerr, Error);
    Layerr.prototype.cause = function _getCause() {
      return Layerr.cause(this) || void 0;
    };
    Layerr.prototype.toString = function _toString() {
      let output = this.name || this.constructor.name || this.constructor.prototype.name;
      if (this.message) {
        output = `${output}: ${this.message}`;
      }
      return output;
    };
    Layerr.cause = function __getCause(err) {
      error_1.assertError(err);
      return error_1.isError(err._cause) ? err._cause : null;
    };
    Layerr.fullStack = function __getFullStack(err) {
      error_1.assertError(err);
      const cause = Layerr.cause(err);
      if (cause) {
        return `${err.stack}
caused by: ${Layerr.fullStack(cause)}`;
      }
      return err.stack;
    };
    Layerr.info = function __getInfo(err) {
      error_1.assertError(err);
      const output = {};
      const cause = Layerr.cause(err);
      if (cause) {
        Object.assign(output, Layerr.info(cause));
      }
      if (err._info) {
        Object.assign(output, err._info);
      }
      return output;
    };
  },
});

// node_modules/layerr/dist/types.js
var require_types = __commonJS({
  'node_modules/layerr/dist/types.js'(exports2) {
    'use strict';
    Object.defineProperty(exports2, '__esModule', { value: true });
  },
});

// node_modules/layerr/dist/index.js
var require_dist = __commonJS({
  'node_modules/layerr/dist/index.js'(exports2) {
    'use strict';
    var __createBinding2 =
      (exports2 && exports2.__createBinding) ||
      (Object.create
        ? function (o, m, k, k2) {
            if (k2 === void 0) k2 = k;
            Object.defineProperty(o, k2, {
              enumerable: true,
              get: function () {
                return m[k];
              },
            });
          }
        : function (o, m, k, k2) {
            if (k2 === void 0) k2 = k;
            o[k2] = m[k];
          });
    var __exportStar2 =
      (exports2 && exports2.__exportStar) ||
      function (m, exports3) {
        for (var p in m)
          if (p !== 'default' && !Object.prototype.hasOwnProperty.call(exports3, p))
            __createBinding2(exports3, m, p);
      };
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.Layerr = void 0;
    var layerr_1 = require_layerr();
    Object.defineProperty(exports2, 'Layerr', {
      enumerable: true,
      get: function () {
        return layerr_1.Layerr;
      },
    });
    __exportStar2(require_types(), exports2);
  },
});

// node_modules/crypt/crypt.js
var require_crypt = __commonJS({
  'node_modules/crypt/crypt.js'(exports2, module2) {
    (function () {
      var base64map = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
        crypt = {
          // Bit-wise rotation left
          rotl: function (n, b) {
            return (n << b) | (n >>> (32 - b));
          },
          // Bit-wise rotation right
          rotr: function (n, b) {
            return (n << (32 - b)) | (n >>> b);
          },
          // Swap big-endian to little-endian and vice versa
          endian: function (n) {
            if (n.constructor == Number) {
              return (crypt.rotl(n, 8) & 16711935) | (crypt.rotl(n, 24) & 4278255360);
            }
            for (var i = 0; i < n.length; i++) n[i] = crypt.endian(n[i]);
            return n;
          },
          // Generate an array of any length of random bytes
          randomBytes: function (n) {
            for (var bytes = []; n > 0; n--) bytes.push(Math.floor(Math.random() * 256));
            return bytes;
          },
          // Convert a byte array to big-endian 32-bit words
          bytesToWords: function (bytes) {
            for (var words = [], i = 0, b = 0; i < bytes.length; i++, b += 8)
              words[b >>> 5] |= bytes[i] << (24 - (b % 32));
            return words;
          },
          // Convert big-endian 32-bit words to a byte array
          wordsToBytes: function (words) {
            for (var bytes = [], b = 0; b < words.length * 32; b += 8)
              bytes.push((words[b >>> 5] >>> (24 - (b % 32))) & 255);
            return bytes;
          },
          // Convert a byte array to a hex string
          bytesToHex: function (bytes) {
            for (var hex = [], i = 0; i < bytes.length; i++) {
              hex.push((bytes[i] >>> 4).toString(16));
              hex.push((bytes[i] & 15).toString(16));
            }
            return hex.join('');
          },
          // Convert a hex string to a byte array
          hexToBytes: function (hex) {
            for (var bytes = [], c = 0; c < hex.length; c += 2)
              bytes.push(parseInt(hex.substr(c, 2), 16));
            return bytes;
          },
          // Convert a byte array to a base-64 string
          bytesToBase64: function (bytes) {
            for (var base64 = [], i = 0; i < bytes.length; i += 3) {
              var triplet = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
              for (var j = 0; j < 4; j++)
                if (i * 8 + j * 6 <= bytes.length * 8)
                  base64.push(base64map.charAt((triplet >>> (6 * (3 - j))) & 63));
                else base64.push('=');
            }
            return base64.join('');
          },
          // Convert a base-64 string to a byte array
          base64ToBytes: function (base64) {
            base64 = base64.replace(/[^A-Z0-9+\/]/gi, '');
            for (var bytes = [], i = 0, imod4 = 0; i < base64.length; imod4 = ++i % 4) {
              if (imod4 == 0) continue;
              bytes.push(
                ((base64map.indexOf(base64.charAt(i - 1)) & (Math.pow(2, -2 * imod4 + 8) - 1)) <<
                  (imod4 * 2)) |
                  (base64map.indexOf(base64.charAt(i)) >>> (6 - imod4 * 2))
              );
            }
            return bytes;
          },
        };
      module2.exports = crypt;
    })();
  },
});

// node_modules/charenc/charenc.js
var require_charenc = __commonJS({
  'node_modules/charenc/charenc.js'(exports2, module2) {
    var charenc = {
      // UTF-8 encoding
      utf8: {
        // Convert a string to a byte array
        stringToBytes: function (str) {
          return charenc.bin.stringToBytes(unescape(encodeURIComponent(str)));
        },
        // Convert a byte array to a string
        bytesToString: function (bytes) {
          return decodeURIComponent(escape(charenc.bin.bytesToString(bytes)));
        },
      },
      // Binary encoding
      bin: {
        // Convert a string to a byte array
        stringToBytes: function (str) {
          for (var bytes = [], i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i) & 255);
          return bytes;
        },
        // Convert a byte array to a string
        bytesToString: function (bytes) {
          for (var str = [], i = 0; i < bytes.length; i++) str.push(String.fromCharCode(bytes[i]));
          return str.join('');
        },
      },
    };
    module2.exports = charenc;
  },
});

// node_modules/is-buffer/index.js
var require_is_buffer = __commonJS({
  'node_modules/is-buffer/index.js'(exports2, module2) {
    module2.exports = function (obj) {
      return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer);
    };
    function isBuffer(obj) {
      return (
        !!obj.constructor &&
        typeof obj.constructor.isBuffer === 'function' &&
        obj.constructor.isBuffer(obj)
      );
    }
    function isSlowBuffer(obj) {
      return (
        typeof obj.readFloatLE === 'function' &&
        typeof obj.slice === 'function' &&
        isBuffer(obj.slice(0, 0))
      );
    }
  },
});

// node_modules/md5/md5.js
var require_md5 = __commonJS({
  'node_modules/md5/md5.js'(exports2, module2) {
    (function () {
      var crypt = require_crypt(),
        utf8 = require_charenc().utf8,
        isBuffer = require_is_buffer(),
        bin = require_charenc().bin,
        md5 = function (message, options) {
          if (message.constructor == String)
            if (options && options.encoding === 'binary') message = bin.stringToBytes(message);
            else message = utf8.stringToBytes(message);
          else if (isBuffer(message)) message = Array.prototype.slice.call(message, 0);
          else if (!Array.isArray(message) && message.constructor !== Uint8Array)
            message = message.toString();
          var m = crypt.bytesToWords(message),
            l = message.length * 8,
            a = 1732584193,
            b = -271733879,
            c = -1732584194,
            d = 271733878;
          for (var i = 0; i < m.length; i++) {
            m[i] =
              (((m[i] << 8) | (m[i] >>> 24)) & 16711935) |
              (((m[i] << 24) | (m[i] >>> 8)) & 4278255360);
          }
          m[l >>> 5] |= 128 << (l % 32);
          m[(((l + 64) >>> 9) << 4) + 14] = l;
          var FF = md5._ff,
            GG = md5._gg,
            HH = md5._hh,
            II = md5._ii;
          for (var i = 0; i < m.length; i += 16) {
            var aa = a,
              bb = b,
              cc = c,
              dd = d;
            a = FF(a, b, c, d, m[i + 0], 7, -680876936);
            d = FF(d, a, b, c, m[i + 1], 12, -389564586);
            c = FF(c, d, a, b, m[i + 2], 17, 606105819);
            b = FF(b, c, d, a, m[i + 3], 22, -1044525330);
            a = FF(a, b, c, d, m[i + 4], 7, -176418897);
            d = FF(d, a, b, c, m[i + 5], 12, 1200080426);
            c = FF(c, d, a, b, m[i + 6], 17, -1473231341);
            b = FF(b, c, d, a, m[i + 7], 22, -45705983);
            a = FF(a, b, c, d, m[i + 8], 7, 1770035416);
            d = FF(d, a, b, c, m[i + 9], 12, -1958414417);
            c = FF(c, d, a, b, m[i + 10], 17, -42063);
            b = FF(b, c, d, a, m[i + 11], 22, -1990404162);
            a = FF(a, b, c, d, m[i + 12], 7, 1804603682);
            d = FF(d, a, b, c, m[i + 13], 12, -40341101);
            c = FF(c, d, a, b, m[i + 14], 17, -1502002290);
            b = FF(b, c, d, a, m[i + 15], 22, 1236535329);
            a = GG(a, b, c, d, m[i + 1], 5, -165796510);
            d = GG(d, a, b, c, m[i + 6], 9, -1069501632);
            c = GG(c, d, a, b, m[i + 11], 14, 643717713);
            b = GG(b, c, d, a, m[i + 0], 20, -373897302);
            a = GG(a, b, c, d, m[i + 5], 5, -701558691);
            d = GG(d, a, b, c, m[i + 10], 9, 38016083);
            c = GG(c, d, a, b, m[i + 15], 14, -660478335);
            b = GG(b, c, d, a, m[i + 4], 20, -405537848);
            a = GG(a, b, c, d, m[i + 9], 5, 568446438);
            d = GG(d, a, b, c, m[i + 14], 9, -1019803690);
            c = GG(c, d, a, b, m[i + 3], 14, -187363961);
            b = GG(b, c, d, a, m[i + 8], 20, 1163531501);
            a = GG(a, b, c, d, m[i + 13], 5, -1444681467);
            d = GG(d, a, b, c, m[i + 2], 9, -51403784);
            c = GG(c, d, a, b, m[i + 7], 14, 1735328473);
            b = GG(b, c, d, a, m[i + 12], 20, -1926607734);
            a = HH(a, b, c, d, m[i + 5], 4, -378558);
            d = HH(d, a, b, c, m[i + 8], 11, -2022574463);
            c = HH(c, d, a, b, m[i + 11], 16, 1839030562);
            b = HH(b, c, d, a, m[i + 14], 23, -35309556);
            a = HH(a, b, c, d, m[i + 1], 4, -1530992060);
            d = HH(d, a, b, c, m[i + 4], 11, 1272893353);
            c = HH(c, d, a, b, m[i + 7], 16, -155497632);
            b = HH(b, c, d, a, m[i + 10], 23, -1094730640);
            a = HH(a, b, c, d, m[i + 13], 4, 681279174);
            d = HH(d, a, b, c, m[i + 0], 11, -358537222);
            c = HH(c, d, a, b, m[i + 3], 16, -722521979);
            b = HH(b, c, d, a, m[i + 6], 23, 76029189);
            a = HH(a, b, c, d, m[i + 9], 4, -640364487);
            d = HH(d, a, b, c, m[i + 12], 11, -421815835);
            c = HH(c, d, a, b, m[i + 15], 16, 530742520);
            b = HH(b, c, d, a, m[i + 2], 23, -995338651);
            a = II(a, b, c, d, m[i + 0], 6, -198630844);
            d = II(d, a, b, c, m[i + 7], 10, 1126891415);
            c = II(c, d, a, b, m[i + 14], 15, -1416354905);
            b = II(b, c, d, a, m[i + 5], 21, -57434055);
            a = II(a, b, c, d, m[i + 12], 6, 1700485571);
            d = II(d, a, b, c, m[i + 3], 10, -1894986606);
            c = II(c, d, a, b, m[i + 10], 15, -1051523);
            b = II(b, c, d, a, m[i + 1], 21, -2054922799);
            a = II(a, b, c, d, m[i + 8], 6, 1873313359);
            d = II(d, a, b, c, m[i + 15], 10, -30611744);
            c = II(c, d, a, b, m[i + 6], 15, -1560198380);
            b = II(b, c, d, a, m[i + 13], 21, 1309151649);
            a = II(a, b, c, d, m[i + 4], 6, -145523070);
            d = II(d, a, b, c, m[i + 11], 10, -1120210379);
            c = II(c, d, a, b, m[i + 2], 15, 718787259);
            b = II(b, c, d, a, m[i + 9], 21, -343485551);
            a = (a + aa) >>> 0;
            b = (b + bb) >>> 0;
            c = (c + cc) >>> 0;
            d = (d + dd) >>> 0;
          }
          return crypt.endian([a, b, c, d]);
        };
      md5._ff = function (a, b, c, d, x, s, t) {
        var n = a + ((b & c) | (~b & d)) + (x >>> 0) + t;
        return ((n << s) | (n >>> (32 - s))) + b;
      };
      md5._gg = function (a, b, c, d, x, s, t) {
        var n = a + ((b & d) | (c & ~d)) + (x >>> 0) + t;
        return ((n << s) | (n >>> (32 - s))) + b;
      };
      md5._hh = function (a, b, c, d, x, s, t) {
        var n = a + (b ^ c ^ d) + (x >>> 0) + t;
        return ((n << s) | (n >>> (32 - s))) + b;
      };
      md5._ii = function (a, b, c, d, x, s, t) {
        var n = a + (c ^ (b | ~d)) + (x >>> 0) + t;
        return ((n << s) | (n >>> (32 - s))) + b;
      };
      md5._blocksize = 16;
      md5._digestsize = 16;
      module2.exports = function (message, options) {
        if (message === void 0 || message === null) throw new Error('Illegal argument ' + message);
        var digestbytes = crypt.wordsToBytes(md5(message, options));
        return options && options.asBytes
          ? digestbytes
          : options && options.asString
            ? bin.bytesToString(digestbytes)
            : crypt.bytesToHex(digestbytes);
      };
    })();
  },
});

// node_modules/webdav/dist/node/tools/crypto.js
var require_crypto = __commonJS({
  'node_modules/webdav/dist/node/tools/crypto.js'(exports2) {
    'use strict';
    var __importDefault =
      (exports2 && exports2.__importDefault) ||
      function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
      };
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.ha1Compute = void 0;
    var md5_1 = __importDefault(require_md5());
    function ha1Compute(algorithm, user, realm, pass, nonce, cnonce) {
      var ha1 = (0, md5_1.default)(''.concat(user, ':').concat(realm, ':').concat(pass));
      if (algorithm && algorithm.toLowerCase() === 'md5-sess') {
        return (0, md5_1.default)(''.concat(ha1, ':').concat(nonce, ':').concat(cnonce));
      }
      return ha1;
    }
    exports2.ha1Compute = ha1Compute;
  },
});

// node_modules/webdav/dist/node/auth/digest.js
var require_digest = __commonJS({
  'node_modules/webdav/dist/node/auth/digest.js'(exports2) {
    'use strict';
    var __importDefault =
      (exports2 && exports2.__importDefault) ||
      function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
      };
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.parseDigestAuth =
      exports2.generateDigestAuthHeader =
      exports2.createDigestContext =
        void 0;
    var md5_1 = __importDefault(require_md5());
    var crypto_1 = require_crypto();
    var NONCE_CHARS = 'abcdef0123456789';
    var NONCE_SIZE = 32;
    function createDigestContext(username, password) {
      return { username, password, nc: 0, algorithm: 'md5', hasDigestAuth: false };
    }
    exports2.createDigestContext = createDigestContext;
    function generateDigestAuthHeader(options, digest) {
      var url = options.url.replace('//', '');
      var uri = url.indexOf('/') == -1 ? '/' : url.slice(url.indexOf('/'));
      var method = options.method ? options.method.toUpperCase() : 'GET';
      var qop = /(^|,)\s*auth\s*($|,)/.test(digest.qop) ? 'auth' : false;
      var ncString = '00000000'.concat(digest.nc).slice(-8);
      var ha1 = (0, crypto_1.ha1Compute)(
        digest.algorithm,
        digest.username,
        digest.realm,
        digest.password,
        digest.nonce,
        digest.cnonce
      );
      var ha2 = (0, md5_1.default)(''.concat(method, ':').concat(uri));
      var digestResponse = qop
        ? (0, md5_1.default)(
            ''
              .concat(ha1, ':')
              .concat(digest.nonce, ':')
              .concat(ncString, ':')
              .concat(digest.cnonce, ':')
              .concat(qop, ':')
              .concat(ha2)
          )
        : (0, md5_1.default)(''.concat(ha1, ':').concat(digest.nonce, ':').concat(ha2));
      var authValues = {
        username: digest.username,
        realm: digest.realm,
        nonce: digest.nonce,
        uri,
        qop,
        response: digestResponse,
        nc: ncString,
        cnonce: digest.cnonce,
        algorithm: digest.algorithm,
        opaque: digest.opaque,
      };
      var authHeader = [];
      for (var k in authValues) {
        if (authValues[k]) {
          if (k === 'qop' || k === 'nc' || k === 'algorithm') {
            authHeader.push(''.concat(k, '=').concat(authValues[k]));
          } else {
            authHeader.push(''.concat(k, '="').concat(authValues[k], '"'));
          }
        }
      }
      return 'Digest '.concat(authHeader.join(', '));
    }
    exports2.generateDigestAuthHeader = generateDigestAuthHeader;
    function makeNonce() {
      var uid = '';
      for (var i = 0; i < NONCE_SIZE; ++i) {
        uid = ''.concat(uid).concat(NONCE_CHARS[Math.floor(Math.random() * NONCE_CHARS.length)]);
      }
      return uid;
    }
    function parseDigestAuth(response, _digest) {
      var authHeader = response.headers['www-authenticate'] || '';
      if (authHeader.split(/\s/)[0].toLowerCase() !== 'digest') {
        return false;
      }
      var re = /([a-z0-9_-]+)=(?:"([^"]+)"|([a-z0-9_-]+))/gi;
      for (;;) {
        var match = re.exec(authHeader);
        if (!match) {
          break;
        }
        _digest[match[1]] = match[2] || match[3];
      }
      _digest.nc += 1;
      _digest.cnonce = makeNonce();
      return true;
    }
    exports2.parseDigestAuth = parseDigestAuth;
  },
});

// node_modules/base-64/base64.js
var require_base64 = __commonJS({
  'node_modules/base-64/base64.js'(exports2, module2) {
    (function (root) {
      var freeExports = typeof exports2 == 'object' && exports2;
      var freeModule =
        typeof module2 == 'object' && module2 && module2.exports == freeExports && module2;
      var freeGlobal = typeof global == 'object' && global;
      if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
        root = freeGlobal;
      }
      var InvalidCharacterError = function (message) {
        this.message = message;
      };
      InvalidCharacterError.prototype = new Error();
      InvalidCharacterError.prototype.name = 'InvalidCharacterError';
      var error = function (message) {
        throw new InvalidCharacterError(message);
      };
      var TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      var REGEX_SPACE_CHARACTERS = /[\t\n\f\r ]/g;
      var decode = function (input) {
        input = String(input).replace(REGEX_SPACE_CHARACTERS, '');
        var length = input.length;
        if (length % 4 == 0) {
          input = input.replace(/==?$/, '');
          length = input.length;
        }
        if (
          length % 4 == 1 || // http://whatwg.org/C#alphanumeric-ascii-characters
          /[^+a-zA-Z0-9/]/.test(input)
        ) {
          error('Invalid character: the string to be decoded is not correctly encoded.');
        }
        var bitCounter = 0;
        var bitStorage;
        var buffer;
        var output = '';
        var position = -1;
        while (++position < length) {
          buffer = TABLE.indexOf(input.charAt(position));
          bitStorage = bitCounter % 4 ? bitStorage * 64 + buffer : buffer;
          if (bitCounter++ % 4) {
            output += String.fromCharCode(255 & (bitStorage >> ((-2 * bitCounter) & 6)));
          }
        }
        return output;
      };
      var encode = function (input) {
        input = String(input);
        if (/[^\0-\xFF]/.test(input)) {
          error('The string to be encoded contains characters outside of the Latin1 range.');
        }
        var padding = input.length % 3;
        var output = '';
        var position = -1;
        var a;
        var b;
        var c;
        var buffer;
        var length = input.length - padding;
        while (++position < length) {
          a = input.charCodeAt(position) << 16;
          b = input.charCodeAt(++position) << 8;
          c = input.charCodeAt(++position);
          buffer = a + b + c;
          output +=
            TABLE.charAt((buffer >> 18) & 63) +
            TABLE.charAt((buffer >> 12) & 63) +
            TABLE.charAt((buffer >> 6) & 63) +
            TABLE.charAt(buffer & 63);
        }
        if (padding == 2) {
          a = input.charCodeAt(position) << 8;
          b = input.charCodeAt(++position);
          buffer = a + b;
          output +=
            TABLE.charAt(buffer >> 10) +
            TABLE.charAt((buffer >> 4) & 63) +
            TABLE.charAt((buffer << 2) & 63) +
            '=';
        } else if (padding == 1) {
          buffer = input.charCodeAt(position);
          output += TABLE.charAt(buffer >> 2) + TABLE.charAt((buffer << 4) & 63) + '==';
        }
        return output;
      };
      var base64 = {
        encode: encode,
        decode: decode,
        version: '1.0.0',
      };
      if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
        define(function () {
          return base64;
        });
      } else if (freeExports && !freeExports.nodeType) {
        if (freeModule) {
          freeModule.exports = base64;
        } else {
          for (var key in base64) {
            base64.hasOwnProperty(key) && (freeExports[key] = base64[key]);
          }
        }
      } else {
        root.base64 = base64;
      }
    })(exports2);
  },
});

// node_modules/he/he.js
var require_he = __commonJS({
  'node_modules/he/he.js'(exports2, module2) {
    (function (root) {
      var freeExports = typeof exports2 == 'object' && exports2;
      var freeModule =
        typeof module2 == 'object' && module2 && module2.exports == freeExports && module2;
      var freeGlobal = typeof global == 'object' && global;
      if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
        root = freeGlobal;
      }
      var regexAstralSymbols = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
      var regexAsciiWhitelist = /[\x01-\x7F]/g;
      var regexBmpWhitelist = /[\x01-\t\x0B\f\x0E-\x1F\x7F\x81\x8D\x8F\x90\x9D\xA0-\uFFFF]/g;
      var regexEncodeNonAscii =
        /<\u20D2|=\u20E5|>\u20D2|\u205F\u200A|\u219D\u0338|\u2202\u0338|\u2220\u20D2|\u2229\uFE00|\u222A\uFE00|\u223C\u20D2|\u223D\u0331|\u223E\u0333|\u2242\u0338|\u224B\u0338|\u224D\u20D2|\u224E\u0338|\u224F\u0338|\u2250\u0338|\u2261\u20E5|\u2264\u20D2|\u2265\u20D2|\u2266\u0338|\u2267\u0338|\u2268\uFE00|\u2269\uFE00|\u226A\u0338|\u226A\u20D2|\u226B\u0338|\u226B\u20D2|\u227F\u0338|\u2282\u20D2|\u2283\u20D2|\u228A\uFE00|\u228B\uFE00|\u228F\u0338|\u2290\u0338|\u2293\uFE00|\u2294\uFE00|\u22B4\u20D2|\u22B5\u20D2|\u22D8\u0338|\u22D9\u0338|\u22DA\uFE00|\u22DB\uFE00|\u22F5\u0338|\u22F9\u0338|\u2933\u0338|\u29CF\u0338|\u29D0\u0338|\u2A6D\u0338|\u2A70\u0338|\u2A7D\u0338|\u2A7E\u0338|\u2AA1\u0338|\u2AA2\u0338|\u2AAC\uFE00|\u2AAD\uFE00|\u2AAF\u0338|\u2AB0\u0338|\u2AC5\u0338|\u2AC6\u0338|\u2ACB\uFE00|\u2ACC\uFE00|\u2AFD\u20E5|[\xA0-\u0113\u0116-\u0122\u0124-\u012B\u012E-\u014D\u0150-\u017E\u0192\u01B5\u01F5\u0237\u02C6\u02C7\u02D8-\u02DD\u0311\u0391-\u03A1\u03A3-\u03A9\u03B1-\u03C9\u03D1\u03D2\u03D5\u03D6\u03DC\u03DD\u03F0\u03F1\u03F5\u03F6\u0401-\u040C\u040E-\u044F\u0451-\u045C\u045E\u045F\u2002-\u2005\u2007-\u2010\u2013-\u2016\u2018-\u201A\u201C-\u201E\u2020-\u2022\u2025\u2026\u2030-\u2035\u2039\u203A\u203E\u2041\u2043\u2044\u204F\u2057\u205F-\u2063\u20AC\u20DB\u20DC\u2102\u2105\u210A-\u2113\u2115-\u211E\u2122\u2124\u2127-\u2129\u212C\u212D\u212F-\u2131\u2133-\u2138\u2145-\u2148\u2153-\u215E\u2190-\u219B\u219D-\u21A7\u21A9-\u21AE\u21B0-\u21B3\u21B5-\u21B7\u21BA-\u21DB\u21DD\u21E4\u21E5\u21F5\u21FD-\u2205\u2207-\u2209\u220B\u220C\u220F-\u2214\u2216-\u2218\u221A\u221D-\u2238\u223A-\u2257\u2259\u225A\u225C\u225F-\u2262\u2264-\u228B\u228D-\u229B\u229D-\u22A5\u22A7-\u22B0\u22B2-\u22BB\u22BD-\u22DB\u22DE-\u22E3\u22E6-\u22F7\u22F9-\u22FE\u2305\u2306\u2308-\u2310\u2312\u2313\u2315\u2316\u231C-\u231F\u2322\u2323\u232D\u232E\u2336\u233D\u233F\u237C\u23B0\u23B1\u23B4-\u23B6\u23DC-\u23DF\u23E2\u23E7\u2423\u24C8\u2500\u2502\u250C\u2510\u2514\u2518\u251C\u2524\u252C\u2534\u253C\u2550-\u256C\u2580\u2584\u2588\u2591-\u2593\u25A1\u25AA\u25AB\u25AD\u25AE\u25B1\u25B3-\u25B5\u25B8\u25B9\u25BD-\u25BF\u25C2\u25C3\u25CA\u25CB\u25EC\u25EF\u25F8-\u25FC\u2605\u2606\u260E\u2640\u2642\u2660\u2663\u2665\u2666\u266A\u266D-\u266F\u2713\u2717\u2720\u2736\u2758\u2772\u2773\u27C8\u27C9\u27E6-\u27ED\u27F5-\u27FA\u27FC\u27FF\u2902-\u2905\u290C-\u2913\u2916\u2919-\u2920\u2923-\u292A\u2933\u2935-\u2939\u293C\u293D\u2945\u2948-\u294B\u294E-\u2976\u2978\u2979\u297B-\u297F\u2985\u2986\u298B-\u2996\u299A\u299C\u299D\u29A4-\u29B7\u29B9\u29BB\u29BC\u29BE-\u29C5\u29C9\u29CD-\u29D0\u29DC-\u29DE\u29E3-\u29E5\u29EB\u29F4\u29F6\u2A00-\u2A02\u2A04\u2A06\u2A0C\u2A0D\u2A10-\u2A17\u2A22-\u2A27\u2A29\u2A2A\u2A2D-\u2A31\u2A33-\u2A3C\u2A3F\u2A40\u2A42-\u2A4D\u2A50\u2A53-\u2A58\u2A5A-\u2A5D\u2A5F\u2A66\u2A6A\u2A6D-\u2A75\u2A77-\u2A9A\u2A9D-\u2AA2\u2AA4-\u2AB0\u2AB3-\u2AC8\u2ACB\u2ACC\u2ACF-\u2ADB\u2AE4\u2AE6-\u2AE9\u2AEB-\u2AF3\u2AFD\uFB00-\uFB04]|\uD835[\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDCCF\uDD04\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDD6B]/g;
      var encodeMap = {
        '\xAD': 'shy',
        '\u200C': 'zwnj',
        '\u200D': 'zwj',
        '\u200E': 'lrm',
        '\u2063': 'ic',
        '\u2062': 'it',
        '\u2061': 'af',
        '\u200F': 'rlm',
        '\u200B': 'ZeroWidthSpace',
        '\u2060': 'NoBreak',
        '\u0311': 'DownBreve',
        '\u20DB': 'tdot',
        '\u20DC': 'DotDot',
        '	': 'Tab',
        '\n': 'NewLine',
        '\u2008': 'puncsp',
        '\u205F': 'MediumSpace',
        '\u2009': 'thinsp',
        '\u200A': 'hairsp',
        '\u2004': 'emsp13',
        '\u2002': 'ensp',
        '\u2005': 'emsp14',
        '\u2003': 'emsp',
        '\u2007': 'numsp',
        '\xA0': 'nbsp',
        '\u205F\u200A': 'ThickSpace',
        '\u203E': 'oline',
        _: 'lowbar',
        '\u2010': 'dash',
        '\u2013': 'ndash',
        '\u2014': 'mdash',
        '\u2015': 'horbar',
        ',': 'comma',
        ';': 'semi',
        '\u204F': 'bsemi',
        ':': 'colon',
        '\u2A74': 'Colone',
        '!': 'excl',
        '\xA1': 'iexcl',
        '?': 'quest',
        '\xBF': 'iquest',
        '.': 'period',
        '\u2025': 'nldr',
        '\u2026': 'mldr',
        '\xB7': 'middot',
        "'": 'apos',
        '\u2018': 'lsquo',
        '\u2019': 'rsquo',
        '\u201A': 'sbquo',
        '\u2039': 'lsaquo',
        '\u203A': 'rsaquo',
        '"': 'quot',
        '\u201C': 'ldquo',
        '\u201D': 'rdquo',
        '\u201E': 'bdquo',
        '\xAB': 'laquo',
        '\xBB': 'raquo',
        '(': 'lpar',
        ')': 'rpar',
        '[': 'lsqb',
        ']': 'rsqb',
        '{': 'lcub',
        '}': 'rcub',
        '\u2308': 'lceil',
        '\u2309': 'rceil',
        '\u230A': 'lfloor',
        '\u230B': 'rfloor',
        '\u2985': 'lopar',
        '\u2986': 'ropar',
        '\u298B': 'lbrke',
        '\u298C': 'rbrke',
        '\u298D': 'lbrkslu',
        '\u298E': 'rbrksld',
        '\u298F': 'lbrksld',
        '\u2990': 'rbrkslu',
        '\u2991': 'langd',
        '\u2992': 'rangd',
        '\u2993': 'lparlt',
        '\u2994': 'rpargt',
        '\u2995': 'gtlPar',
        '\u2996': 'ltrPar',
        '\u27E6': 'lobrk',
        '\u27E7': 'robrk',
        '\u27E8': 'lang',
        '\u27E9': 'rang',
        '\u27EA': 'Lang',
        '\u27EB': 'Rang',
        '\u27EC': 'loang',
        '\u27ED': 'roang',
        '\u2772': 'lbbrk',
        '\u2773': 'rbbrk',
        '\u2016': 'Vert',
        '\xA7': 'sect',
        '\xB6': 'para',
        '@': 'commat',
        '*': 'ast',
        '/': 'sol',
        undefined: null,
        '&': 'amp',
        '#': 'num',
        '%': 'percnt',
        '\u2030': 'permil',
        '\u2031': 'pertenk',
        '\u2020': 'dagger',
        '\u2021': 'Dagger',
        '\u2022': 'bull',
        '\u2043': 'hybull',
        '\u2032': 'prime',
        '\u2033': 'Prime',
        '\u2034': 'tprime',
        '\u2057': 'qprime',
        '\u2035': 'bprime',
        '\u2041': 'caret',
        '`': 'grave',
        '\xB4': 'acute',
        '\u02DC': 'tilde',
        '^': 'Hat',
        '\xAF': 'macr',
        '\u02D8': 'breve',
        '\u02D9': 'dot',
        '\xA8': 'die',
        '\u02DA': 'ring',
        '\u02DD': 'dblac',
        '\xB8': 'cedil',
        '\u02DB': 'ogon',
        '\u02C6': 'circ',
        '\u02C7': 'caron',
        '\xB0': 'deg',
        '\xA9': 'copy',
        '\xAE': 'reg',
        '\u2117': 'copysr',
        '\u2118': 'wp',
        '\u211E': 'rx',
        '\u2127': 'mho',
        '\u2129': 'iiota',
        '\u2190': 'larr',
        '\u219A': 'nlarr',
        '\u2192': 'rarr',
        '\u219B': 'nrarr',
        '\u2191': 'uarr',
        '\u2193': 'darr',
        '\u2194': 'harr',
        '\u21AE': 'nharr',
        '\u2195': 'varr',
        '\u2196': 'nwarr',
        '\u2197': 'nearr',
        '\u2198': 'searr',
        '\u2199': 'swarr',
        '\u219D': 'rarrw',
        '\u219D\u0338': 'nrarrw',
        '\u219E': 'Larr',
        '\u219F': 'Uarr',
        '\u21A0': 'Rarr',
        '\u21A1': 'Darr',
        '\u21A2': 'larrtl',
        '\u21A3': 'rarrtl',
        '\u21A4': 'mapstoleft',
        '\u21A5': 'mapstoup',
        '\u21A6': 'map',
        '\u21A7': 'mapstodown',
        '\u21A9': 'larrhk',
        '\u21AA': 'rarrhk',
        '\u21AB': 'larrlp',
        '\u21AC': 'rarrlp',
        '\u21AD': 'harrw',
        '\u21B0': 'lsh',
        '\u21B1': 'rsh',
        '\u21B2': 'ldsh',
        '\u21B3': 'rdsh',
        '\u21B5': 'crarr',
        '\u21B6': 'cularr',
        '\u21B7': 'curarr',
        '\u21BA': 'olarr',
        '\u21BB': 'orarr',
        '\u21BC': 'lharu',
        '\u21BD': 'lhard',
        '\u21BE': 'uharr',
        '\u21BF': 'uharl',
        '\u21C0': 'rharu',
        '\u21C1': 'rhard',
        '\u21C2': 'dharr',
        '\u21C3': 'dharl',
        '\u21C4': 'rlarr',
        '\u21C5': 'udarr',
        '\u21C6': 'lrarr',
        '\u21C7': 'llarr',
        '\u21C8': 'uuarr',
        '\u21C9': 'rrarr',
        '\u21CA': 'ddarr',
        '\u21CB': 'lrhar',
        '\u21CC': 'rlhar',
        '\u21D0': 'lArr',
        '\u21CD': 'nlArr',
        '\u21D1': 'uArr',
        '\u21D2': 'rArr',
        '\u21CF': 'nrArr',
        '\u21D3': 'dArr',
        '\u21D4': 'iff',
        '\u21CE': 'nhArr',
        '\u21D5': 'vArr',
        '\u21D6': 'nwArr',
        '\u21D7': 'neArr',
        '\u21D8': 'seArr',
        '\u21D9': 'swArr',
        '\u21DA': 'lAarr',
        '\u21DB': 'rAarr',
        '\u21DD': 'zigrarr',
        '\u21E4': 'larrb',
        '\u21E5': 'rarrb',
        '\u21F5': 'duarr',
        '\u21FD': 'loarr',
        '\u21FE': 'roarr',
        '\u21FF': 'hoarr',
        '\u2200': 'forall',
        '\u2201': 'comp',
        '\u2202': 'part',
        '\u2202\u0338': 'npart',
        '\u2203': 'exist',
        '\u2204': 'nexist',
        '\u2205': 'empty',
        '\u2207': 'Del',
        '\u2208': 'in',
        '\u2209': 'notin',
        '\u220B': 'ni',
        '\u220C': 'notni',
        '\u03F6': 'bepsi',
        '\u220F': 'prod',
        '\u2210': 'coprod',
        '\u2211': 'sum',
        '+': 'plus',
        '\xB1': 'pm',
        '\xF7': 'div',
        '\xD7': 'times',
        '<': 'lt',
        '\u226E': 'nlt',
        '<\u20D2': 'nvlt',
        '=': 'equals',
        '\u2260': 'ne',
        '=\u20E5': 'bne',
        '\u2A75': 'Equal',
        '>': 'gt',
        '\u226F': 'ngt',
        '>\u20D2': 'nvgt',
        '\xAC': 'not',
        '|': 'vert',
        '\xA6': 'brvbar',
        '\u2212': 'minus',
        '\u2213': 'mp',
        '\u2214': 'plusdo',
        '\u2044': 'frasl',
        '\u2216': 'setmn',
        '\u2217': 'lowast',
        '\u2218': 'compfn',
        '\u221A': 'Sqrt',
        '\u221D': 'prop',
        '\u221E': 'infin',
        '\u221F': 'angrt',
        '\u2220': 'ang',
        '\u2220\u20D2': 'nang',
        '\u2221': 'angmsd',
        '\u2222': 'angsph',
        '\u2223': 'mid',
        '\u2224': 'nmid',
        '\u2225': 'par',
        '\u2226': 'npar',
        '\u2227': 'and',
        '\u2228': 'or',
        '\u2229': 'cap',
        '\u2229\uFE00': 'caps',
        '\u222A': 'cup',
        '\u222A\uFE00': 'cups',
        '\u222B': 'int',
        '\u222C': 'Int',
        '\u222D': 'tint',
        '\u2A0C': 'qint',
        '\u222E': 'oint',
        '\u222F': 'Conint',
        '\u2230': 'Cconint',
        '\u2231': 'cwint',
        '\u2232': 'cwconint',
        '\u2233': 'awconint',
        '\u2234': 'there4',
        '\u2235': 'becaus',
        '\u2236': 'ratio',
        '\u2237': 'Colon',
        '\u2238': 'minusd',
        '\u223A': 'mDDot',
        '\u223B': 'homtht',
        '\u223C': 'sim',
        '\u2241': 'nsim',
        '\u223C\u20D2': 'nvsim',
        '\u223D': 'bsim',
        '\u223D\u0331': 'race',
        '\u223E': 'ac',
        '\u223E\u0333': 'acE',
        '\u223F': 'acd',
        '\u2240': 'wr',
        '\u2242': 'esim',
        '\u2242\u0338': 'nesim',
        '\u2243': 'sime',
        '\u2244': 'nsime',
        '\u2245': 'cong',
        '\u2247': 'ncong',
        '\u2246': 'simne',
        '\u2248': 'ap',
        '\u2249': 'nap',
        '\u224A': 'ape',
        '\u224B': 'apid',
        '\u224B\u0338': 'napid',
        '\u224C': 'bcong',
        '\u224D': 'CupCap',
        '\u226D': 'NotCupCap',
        '\u224D\u20D2': 'nvap',
        '\u224E': 'bump',
        '\u224E\u0338': 'nbump',
        '\u224F': 'bumpe',
        '\u224F\u0338': 'nbumpe',
        '\u2250': 'doteq',
        '\u2250\u0338': 'nedot',
        '\u2251': 'eDot',
        '\u2252': 'efDot',
        '\u2253': 'erDot',
        '\u2254': 'colone',
        '\u2255': 'ecolon',
        '\u2256': 'ecir',
        '\u2257': 'cire',
        '\u2259': 'wedgeq',
        '\u225A': 'veeeq',
        '\u225C': 'trie',
        '\u225F': 'equest',
        '\u2261': 'equiv',
        '\u2262': 'nequiv',
        '\u2261\u20E5': 'bnequiv',
        '\u2264': 'le',
        '\u2270': 'nle',
        '\u2264\u20D2': 'nvle',
        '\u2265': 'ge',
        '\u2271': 'nge',
        '\u2265\u20D2': 'nvge',
        '\u2266': 'lE',
        '\u2266\u0338': 'nlE',
        '\u2267': 'gE',
        '\u2267\u0338': 'ngE',
        '\u2268\uFE00': 'lvnE',
        '\u2268': 'lnE',
        '\u2269': 'gnE',
        '\u2269\uFE00': 'gvnE',
        '\u226A': 'll',
        '\u226A\u0338': 'nLtv',
        '\u226A\u20D2': 'nLt',
        '\u226B': 'gg',
        '\u226B\u0338': 'nGtv',
        '\u226B\u20D2': 'nGt',
        '\u226C': 'twixt',
        '\u2272': 'lsim',
        '\u2274': 'nlsim',
        '\u2273': 'gsim',
        '\u2275': 'ngsim',
        '\u2276': 'lg',
        '\u2278': 'ntlg',
        '\u2277': 'gl',
        '\u2279': 'ntgl',
        '\u227A': 'pr',
        '\u2280': 'npr',
        '\u227B': 'sc',
        '\u2281': 'nsc',
        '\u227C': 'prcue',
        '\u22E0': 'nprcue',
        '\u227D': 'sccue',
        '\u22E1': 'nsccue',
        '\u227E': 'prsim',
        '\u227F': 'scsim',
        '\u227F\u0338': 'NotSucceedsTilde',
        '\u2282': 'sub',
        '\u2284': 'nsub',
        '\u2282\u20D2': 'vnsub',
        '\u2283': 'sup',
        '\u2285': 'nsup',
        '\u2283\u20D2': 'vnsup',
        '\u2286': 'sube',
        '\u2288': 'nsube',
        '\u2287': 'supe',
        '\u2289': 'nsupe',
        '\u228A\uFE00': 'vsubne',
        '\u228A': 'subne',
        '\u228B\uFE00': 'vsupne',
        '\u228B': 'supne',
        '\u228D': 'cupdot',
        '\u228E': 'uplus',
        '\u228F': 'sqsub',
        '\u228F\u0338': 'NotSquareSubset',
        '\u2290': 'sqsup',
        '\u2290\u0338': 'NotSquareSuperset',
        '\u2291': 'sqsube',
        '\u22E2': 'nsqsube',
        '\u2292': 'sqsupe',
        '\u22E3': 'nsqsupe',
        '\u2293': 'sqcap',
        '\u2293\uFE00': 'sqcaps',
        '\u2294': 'sqcup',
        '\u2294\uFE00': 'sqcups',
        '\u2295': 'oplus',
        '\u2296': 'ominus',
        '\u2297': 'otimes',
        '\u2298': 'osol',
        '\u2299': 'odot',
        '\u229A': 'ocir',
        '\u229B': 'oast',
        '\u229D': 'odash',
        '\u229E': 'plusb',
        '\u229F': 'minusb',
        '\u22A0': 'timesb',
        '\u22A1': 'sdotb',
        '\u22A2': 'vdash',
        '\u22AC': 'nvdash',
        '\u22A3': 'dashv',
        '\u22A4': 'top',
        '\u22A5': 'bot',
        '\u22A7': 'models',
        '\u22A8': 'vDash',
        '\u22AD': 'nvDash',
        '\u22A9': 'Vdash',
        '\u22AE': 'nVdash',
        '\u22AA': 'Vvdash',
        '\u22AB': 'VDash',
        '\u22AF': 'nVDash',
        '\u22B0': 'prurel',
        '\u22B2': 'vltri',
        '\u22EA': 'nltri',
        '\u22B3': 'vrtri',
        '\u22EB': 'nrtri',
        '\u22B4': 'ltrie',
        '\u22EC': 'nltrie',
        '\u22B4\u20D2': 'nvltrie',
        '\u22B5': 'rtrie',
        '\u22ED': 'nrtrie',
        '\u22B5\u20D2': 'nvrtrie',
        '\u22B6': 'origof',
        '\u22B7': 'imof',
        '\u22B8': 'mumap',
        '\u22B9': 'hercon',
        '\u22BA': 'intcal',
        '\u22BB': 'veebar',
        '\u22BD': 'barvee',
        '\u22BE': 'angrtvb',
        '\u22BF': 'lrtri',
        '\u22C0': 'Wedge',
        '\u22C1': 'Vee',
        '\u22C2': 'xcap',
        '\u22C3': 'xcup',
        '\u22C4': 'diam',
        '\u22C5': 'sdot',
        '\u22C6': 'Star',
        '\u22C7': 'divonx',
        '\u22C8': 'bowtie',
        '\u22C9': 'ltimes',
        '\u22CA': 'rtimes',
        '\u22CB': 'lthree',
        '\u22CC': 'rthree',
        '\u22CD': 'bsime',
        '\u22CE': 'cuvee',
        '\u22CF': 'cuwed',
        '\u22D0': 'Sub',
        '\u22D1': 'Sup',
        '\u22D2': 'Cap',
        '\u22D3': 'Cup',
        '\u22D4': 'fork',
        '\u22D5': 'epar',
        '\u22D6': 'ltdot',
        '\u22D7': 'gtdot',
        '\u22D8': 'Ll',
        '\u22D8\u0338': 'nLl',
        '\u22D9': 'Gg',
        '\u22D9\u0338': 'nGg',
        '\u22DA\uFE00': 'lesg',
        '\u22DA': 'leg',
        '\u22DB': 'gel',
        '\u22DB\uFE00': 'gesl',
        '\u22DE': 'cuepr',
        '\u22DF': 'cuesc',
        '\u22E6': 'lnsim',
        '\u22E7': 'gnsim',
        '\u22E8': 'prnsim',
        '\u22E9': 'scnsim',
        '\u22EE': 'vellip',
        '\u22EF': 'ctdot',
        '\u22F0': 'utdot',
        '\u22F1': 'dtdot',
        '\u22F2': 'disin',
        '\u22F3': 'isinsv',
        '\u22F4': 'isins',
        '\u22F5': 'isindot',
        '\u22F5\u0338': 'notindot',
        '\u22F6': 'notinvc',
        '\u22F7': 'notinvb',
        '\u22F9': 'isinE',
        '\u22F9\u0338': 'notinE',
        '\u22FA': 'nisd',
        '\u22FB': 'xnis',
        '\u22FC': 'nis',
        '\u22FD': 'notnivc',
        '\u22FE': 'notnivb',
        '\u2305': 'barwed',
        '\u2306': 'Barwed',
        '\u230C': 'drcrop',
        '\u230D': 'dlcrop',
        '\u230E': 'urcrop',
        '\u230F': 'ulcrop',
        '\u2310': 'bnot',
        '\u2312': 'profline',
        '\u2313': 'profsurf',
        '\u2315': 'telrec',
        '\u2316': 'target',
        '\u231C': 'ulcorn',
        '\u231D': 'urcorn',
        '\u231E': 'dlcorn',
        '\u231F': 'drcorn',
        '\u2322': 'frown',
        '\u2323': 'smile',
        '\u232D': 'cylcty',
        '\u232E': 'profalar',
        '\u2336': 'topbot',
        '\u233D': 'ovbar',
        '\u233F': 'solbar',
        '\u237C': 'angzarr',
        '\u23B0': 'lmoust',
        '\u23B1': 'rmoust',
        '\u23B4': 'tbrk',
        '\u23B5': 'bbrk',
        '\u23B6': 'bbrktbrk',
        '\u23DC': 'OverParenthesis',
        '\u23DD': 'UnderParenthesis',
        '\u23DE': 'OverBrace',
        '\u23DF': 'UnderBrace',
        '\u23E2': 'trpezium',
        '\u23E7': 'elinters',
        '\u2423': 'blank',
        '\u2500': 'boxh',
        '\u2502': 'boxv',
        '\u250C': 'boxdr',
        '\u2510': 'boxdl',
        '\u2514': 'boxur',
        '\u2518': 'boxul',
        '\u251C': 'boxvr',
        '\u2524': 'boxvl',
        '\u252C': 'boxhd',
        '\u2534': 'boxhu',
        '\u253C': 'boxvh',
        '\u2550': 'boxH',
        '\u2551': 'boxV',
        '\u2552': 'boxdR',
        '\u2553': 'boxDr',
        '\u2554': 'boxDR',
        '\u2555': 'boxdL',
        '\u2556': 'boxDl',
        '\u2557': 'boxDL',
        '\u2558': 'boxuR',
        '\u2559': 'boxUr',
        '\u255A': 'boxUR',
        '\u255B': 'boxuL',
        '\u255C': 'boxUl',
        '\u255D': 'boxUL',
        '\u255E': 'boxvR',
        '\u255F': 'boxVr',
        '\u2560': 'boxVR',
        '\u2561': 'boxvL',
        '\u2562': 'boxVl',
        '\u2563': 'boxVL',
        '\u2564': 'boxHd',
        '\u2565': 'boxhD',
        '\u2566': 'boxHD',
        '\u2567': 'boxHu',
        '\u2568': 'boxhU',
        '\u2569': 'boxHU',
        '\u256A': 'boxvH',
        '\u256B': 'boxVh',
        '\u256C': 'boxVH',
        '\u2580': 'uhblk',
        '\u2584': 'lhblk',
        '\u2588': 'block',
        '\u2591': 'blk14',
        '\u2592': 'blk12',
        '\u2593': 'blk34',
        '\u25A1': 'squ',
        '\u25AA': 'squf',
        '\u25AB': 'EmptyVerySmallSquare',
        '\u25AD': 'rect',
        '\u25AE': 'marker',
        '\u25B1': 'fltns',
        '\u25B3': 'xutri',
        '\u25B4': 'utrif',
        '\u25B5': 'utri',
        '\u25B8': 'rtrif',
        '\u25B9': 'rtri',
        '\u25BD': 'xdtri',
        '\u25BE': 'dtrif',
        '\u25BF': 'dtri',
        '\u25C2': 'ltrif',
        '\u25C3': 'ltri',
        '\u25CA': 'loz',
        '\u25CB': 'cir',
        '\u25EC': 'tridot',
        '\u25EF': 'xcirc',
        '\u25F8': 'ultri',
        '\u25F9': 'urtri',
        '\u25FA': 'lltri',
        '\u25FB': 'EmptySmallSquare',
        '\u25FC': 'FilledSmallSquare',
        '\u2605': 'starf',
        '\u2606': 'star',
        '\u260E': 'phone',
        '\u2640': 'female',
        '\u2642': 'male',
        '\u2660': 'spades',
        '\u2663': 'clubs',
        '\u2665': 'hearts',
        '\u2666': 'diams',
        '\u266A': 'sung',
        '\u2713': 'check',
        '\u2717': 'cross',
        '\u2720': 'malt',
        '\u2736': 'sext',
        '\u2758': 'VerticalSeparator',
        '\u27C8': 'bsolhsub',
        '\u27C9': 'suphsol',
        '\u27F5': 'xlarr',
        '\u27F6': 'xrarr',
        '\u27F7': 'xharr',
        '\u27F8': 'xlArr',
        '\u27F9': 'xrArr',
        '\u27FA': 'xhArr',
        '\u27FC': 'xmap',
        '\u27FF': 'dzigrarr',
        '\u2902': 'nvlArr',
        '\u2903': 'nvrArr',
        '\u2904': 'nvHarr',
        '\u2905': 'Map',
        '\u290C': 'lbarr',
        '\u290D': 'rbarr',
        '\u290E': 'lBarr',
        '\u290F': 'rBarr',
        '\u2910': 'RBarr',
        '\u2911': 'DDotrahd',
        '\u2912': 'UpArrowBar',
        '\u2913': 'DownArrowBar',
        '\u2916': 'Rarrtl',
        '\u2919': 'latail',
        '\u291A': 'ratail',
        '\u291B': 'lAtail',
        '\u291C': 'rAtail',
        '\u291D': 'larrfs',
        '\u291E': 'rarrfs',
        '\u291F': 'larrbfs',
        '\u2920': 'rarrbfs',
        '\u2923': 'nwarhk',
        '\u2924': 'nearhk',
        '\u2925': 'searhk',
        '\u2926': 'swarhk',
        '\u2927': 'nwnear',
        '\u2928': 'toea',
        '\u2929': 'tosa',
        '\u292A': 'swnwar',
        '\u2933': 'rarrc',
        '\u2933\u0338': 'nrarrc',
        '\u2935': 'cudarrr',
        '\u2936': 'ldca',
        '\u2937': 'rdca',
        '\u2938': 'cudarrl',
        '\u2939': 'larrpl',
        '\u293C': 'curarrm',
        '\u293D': 'cularrp',
        '\u2945': 'rarrpl',
        '\u2948': 'harrcir',
        '\u2949': 'Uarrocir',
        '\u294A': 'lurdshar',
        '\u294B': 'ldrushar',
        '\u294E': 'LeftRightVector',
        '\u294F': 'RightUpDownVector',
        '\u2950': 'DownLeftRightVector',
        '\u2951': 'LeftUpDownVector',
        '\u2952': 'LeftVectorBar',
        '\u2953': 'RightVectorBar',
        '\u2954': 'RightUpVectorBar',
        '\u2955': 'RightDownVectorBar',
        '\u2956': 'DownLeftVectorBar',
        '\u2957': 'DownRightVectorBar',
        '\u2958': 'LeftUpVectorBar',
        '\u2959': 'LeftDownVectorBar',
        '\u295A': 'LeftTeeVector',
        '\u295B': 'RightTeeVector',
        '\u295C': 'RightUpTeeVector',
        '\u295D': 'RightDownTeeVector',
        '\u295E': 'DownLeftTeeVector',
        '\u295F': 'DownRightTeeVector',
        '\u2960': 'LeftUpTeeVector',
        '\u2961': 'LeftDownTeeVector',
        '\u2962': 'lHar',
        '\u2963': 'uHar',
        '\u2964': 'rHar',
        '\u2965': 'dHar',
        '\u2966': 'luruhar',
        '\u2967': 'ldrdhar',
        '\u2968': 'ruluhar',
        '\u2969': 'rdldhar',
        '\u296A': 'lharul',
        '\u296B': 'llhard',
        '\u296C': 'rharul',
        '\u296D': 'lrhard',
        '\u296E': 'udhar',
        '\u296F': 'duhar',
        '\u2970': 'RoundImplies',
        '\u2971': 'erarr',
        '\u2972': 'simrarr',
        '\u2973': 'larrsim',
        '\u2974': 'rarrsim',
        '\u2975': 'rarrap',
        '\u2976': 'ltlarr',
        '\u2978': 'gtrarr',
        '\u2979': 'subrarr',
        '\u297B': 'suplarr',
        '\u297C': 'lfisht',
        '\u297D': 'rfisht',
        '\u297E': 'ufisht',
        '\u297F': 'dfisht',
        '\u299A': 'vzigzag',
        '\u299C': 'vangrt',
        '\u299D': 'angrtvbd',
        '\u29A4': 'ange',
        '\u29A5': 'range',
        '\u29A6': 'dwangle',
        '\u29A7': 'uwangle',
        '\u29A8': 'angmsdaa',
        '\u29A9': 'angmsdab',
        '\u29AA': 'angmsdac',
        '\u29AB': 'angmsdad',
        '\u29AC': 'angmsdae',
        '\u29AD': 'angmsdaf',
        '\u29AE': 'angmsdag',
        '\u29AF': 'angmsdah',
        '\u29B0': 'bemptyv',
        '\u29B1': 'demptyv',
        '\u29B2': 'cemptyv',
        '\u29B3': 'raemptyv',
        '\u29B4': 'laemptyv',
        '\u29B5': 'ohbar',
        '\u29B6': 'omid',
        '\u29B7': 'opar',
        '\u29B9': 'operp',
        '\u29BB': 'olcross',
        '\u29BC': 'odsold',
        '\u29BE': 'olcir',
        '\u29BF': 'ofcir',
        '\u29C0': 'olt',
        '\u29C1': 'ogt',
        '\u29C2': 'cirscir',
        '\u29C3': 'cirE',
        '\u29C4': 'solb',
        '\u29C5': 'bsolb',
        '\u29C9': 'boxbox',
        '\u29CD': 'trisb',
        '\u29CE': 'rtriltri',
        '\u29CF': 'LeftTriangleBar',
        '\u29CF\u0338': 'NotLeftTriangleBar',
        '\u29D0': 'RightTriangleBar',
        '\u29D0\u0338': 'NotRightTriangleBar',
        '\u29DC': 'iinfin',
        '\u29DD': 'infintie',
        '\u29DE': 'nvinfin',
        '\u29E3': 'eparsl',
        '\u29E4': 'smeparsl',
        '\u29E5': 'eqvparsl',
        '\u29EB': 'lozf',
        '\u29F4': 'RuleDelayed',
        '\u29F6': 'dsol',
        '\u2A00': 'xodot',
        '\u2A01': 'xoplus',
        '\u2A02': 'xotime',
        '\u2A04': 'xuplus',
        '\u2A06': 'xsqcup',
        '\u2A0D': 'fpartint',
        '\u2A10': 'cirfnint',
        '\u2A11': 'awint',
        '\u2A12': 'rppolint',
        '\u2A13': 'scpolint',
        '\u2A14': 'npolint',
        '\u2A15': 'pointint',
        '\u2A16': 'quatint',
        '\u2A17': 'intlarhk',
        '\u2A22': 'pluscir',
        '\u2A23': 'plusacir',
        '\u2A24': 'simplus',
        '\u2A25': 'plusdu',
        '\u2A26': 'plussim',
        '\u2A27': 'plustwo',
        '\u2A29': 'mcomma',
        '\u2A2A': 'minusdu',
        '\u2A2D': 'loplus',
        '\u2A2E': 'roplus',
        '\u2A2F': 'Cross',
        '\u2A30': 'timesd',
        '\u2A31': 'timesbar',
        '\u2A33': 'smashp',
        '\u2A34': 'lotimes',
        '\u2A35': 'rotimes',
        '\u2A36': 'otimesas',
        '\u2A37': 'Otimes',
        '\u2A38': 'odiv',
        '\u2A39': 'triplus',
        '\u2A3A': 'triminus',
        '\u2A3B': 'tritime',
        '\u2A3C': 'iprod',
        '\u2A3F': 'amalg',
        '\u2A40': 'capdot',
        '\u2A42': 'ncup',
        '\u2A43': 'ncap',
        '\u2A44': 'capand',
        '\u2A45': 'cupor',
        '\u2A46': 'cupcap',
        '\u2A47': 'capcup',
        '\u2A48': 'cupbrcap',
        '\u2A49': 'capbrcup',
        '\u2A4A': 'cupcup',
        '\u2A4B': 'capcap',
        '\u2A4C': 'ccups',
        '\u2A4D': 'ccaps',
        '\u2A50': 'ccupssm',
        '\u2A53': 'And',
        '\u2A54': 'Or',
        '\u2A55': 'andand',
        '\u2A56': 'oror',
        '\u2A57': 'orslope',
        '\u2A58': 'andslope',
        '\u2A5A': 'andv',
        '\u2A5B': 'orv',
        '\u2A5C': 'andd',
        '\u2A5D': 'ord',
        '\u2A5F': 'wedbar',
        '\u2A66': 'sdote',
        '\u2A6A': 'simdot',
        '\u2A6D': 'congdot',
        '\u2A6D\u0338': 'ncongdot',
        '\u2A6E': 'easter',
        '\u2A6F': 'apacir',
        '\u2A70': 'apE',
        '\u2A70\u0338': 'napE',
        '\u2A71': 'eplus',
        '\u2A72': 'pluse',
        '\u2A73': 'Esim',
        '\u2A77': 'eDDot',
        '\u2A78': 'equivDD',
        '\u2A79': 'ltcir',
        '\u2A7A': 'gtcir',
        '\u2A7B': 'ltquest',
        '\u2A7C': 'gtquest',
        '\u2A7D': 'les',
        '\u2A7D\u0338': 'nles',
        '\u2A7E': 'ges',
        '\u2A7E\u0338': 'nges',
        '\u2A7F': 'lesdot',
        '\u2A80': 'gesdot',
        '\u2A81': 'lesdoto',
        '\u2A82': 'gesdoto',
        '\u2A83': 'lesdotor',
        '\u2A84': 'gesdotol',
        '\u2A85': 'lap',
        '\u2A86': 'gap',
        '\u2A87': 'lne',
        '\u2A88': 'gne',
        '\u2A89': 'lnap',
        '\u2A8A': 'gnap',
        '\u2A8B': 'lEg',
        '\u2A8C': 'gEl',
        '\u2A8D': 'lsime',
        '\u2A8E': 'gsime',
        '\u2A8F': 'lsimg',
        '\u2A90': 'gsiml',
        '\u2A91': 'lgE',
        '\u2A92': 'glE',
        '\u2A93': 'lesges',
        '\u2A94': 'gesles',
        '\u2A95': 'els',
        '\u2A96': 'egs',
        '\u2A97': 'elsdot',
        '\u2A98': 'egsdot',
        '\u2A99': 'el',
        '\u2A9A': 'eg',
        '\u2A9D': 'siml',
        '\u2A9E': 'simg',
        '\u2A9F': 'simlE',
        '\u2AA0': 'simgE',
        '\u2AA1': 'LessLess',
        '\u2AA1\u0338': 'NotNestedLessLess',
        '\u2AA2': 'GreaterGreater',
        '\u2AA2\u0338': 'NotNestedGreaterGreater',
        '\u2AA4': 'glj',
        '\u2AA5': 'gla',
        '\u2AA6': 'ltcc',
        '\u2AA7': 'gtcc',
        '\u2AA8': 'lescc',
        '\u2AA9': 'gescc',
        '\u2AAA': 'smt',
        '\u2AAB': 'lat',
        '\u2AAC': 'smte',
        '\u2AAC\uFE00': 'smtes',
        '\u2AAD': 'late',
        '\u2AAD\uFE00': 'lates',
        '\u2AAE': 'bumpE',
        '\u2AAF': 'pre',
        '\u2AAF\u0338': 'npre',
        '\u2AB0': 'sce',
        '\u2AB0\u0338': 'nsce',
        '\u2AB3': 'prE',
        '\u2AB4': 'scE',
        '\u2AB5': 'prnE',
        '\u2AB6': 'scnE',
        '\u2AB7': 'prap',
        '\u2AB8': 'scap',
        '\u2AB9': 'prnap',
        '\u2ABA': 'scnap',
        '\u2ABB': 'Pr',
        '\u2ABC': 'Sc',
        '\u2ABD': 'subdot',
        '\u2ABE': 'supdot',
        '\u2ABF': 'subplus',
        '\u2AC0': 'supplus',
        '\u2AC1': 'submult',
        '\u2AC2': 'supmult',
        '\u2AC3': 'subedot',
        '\u2AC4': 'supedot',
        '\u2AC5': 'subE',
        '\u2AC5\u0338': 'nsubE',
        '\u2AC6': 'supE',
        '\u2AC6\u0338': 'nsupE',
        '\u2AC7': 'subsim',
        '\u2AC8': 'supsim',
        '\u2ACB\uFE00': 'vsubnE',
        '\u2ACB': 'subnE',
        '\u2ACC\uFE00': 'vsupnE',
        '\u2ACC': 'supnE',
        '\u2ACF': 'csub',
        '\u2AD0': 'csup',
        '\u2AD1': 'csube',
        '\u2AD2': 'csupe',
        '\u2AD3': 'subsup',
        '\u2AD4': 'supsub',
        '\u2AD5': 'subsub',
        '\u2AD6': 'supsup',
        '\u2AD7': 'suphsub',
        '\u2AD8': 'supdsub',
        '\u2AD9': 'forkv',
        '\u2ADA': 'topfork',
        '\u2ADB': 'mlcp',
        '\u2AE4': 'Dashv',
        '\u2AE6': 'Vdashl',
        '\u2AE7': 'Barv',
        '\u2AE8': 'vBar',
        '\u2AE9': 'vBarv',
        '\u2AEB': 'Vbar',
        '\u2AEC': 'Not',
        '\u2AED': 'bNot',
        '\u2AEE': 'rnmid',
        '\u2AEF': 'cirmid',
        '\u2AF0': 'midcir',
        '\u2AF1': 'topcir',
        '\u2AF2': 'nhpar',
        '\u2AF3': 'parsim',
        '\u2AFD': 'parsl',
        '\u2AFD\u20E5': 'nparsl',
        '\u266D': 'flat',
        '\u266E': 'natur',
        '\u266F': 'sharp',
        '\xA4': 'curren',
        '\xA2': 'cent',
        $: 'dollar',
        '\xA3': 'pound',
        '\xA5': 'yen',
        '\u20AC': 'euro',
        '\xB9': 'sup1',
        '\xBD': 'half',
        '\u2153': 'frac13',
        '\xBC': 'frac14',
        '\u2155': 'frac15',
        '\u2159': 'frac16',
        '\u215B': 'frac18',
        '\xB2': 'sup2',
        '\u2154': 'frac23',
        '\u2156': 'frac25',
        '\xB3': 'sup3',
        '\xBE': 'frac34',
        '\u2157': 'frac35',
        '\u215C': 'frac38',
        '\u2158': 'frac45',
        '\u215A': 'frac56',
        '\u215D': 'frac58',
        '\u215E': 'frac78',
        '\u{1D4B6}': 'ascr',
        '\u{1D552}': 'aopf',
        '\u{1D51E}': 'afr',
        '\u{1D538}': 'Aopf',
        '\u{1D504}': 'Afr',
        '\u{1D49C}': 'Ascr',
        '\xAA': 'ordf',
        '\xE1': 'aacute',
        '\xC1': 'Aacute',
        '\xE0': 'agrave',
        '\xC0': 'Agrave',
        '\u0103': 'abreve',
        '\u0102': 'Abreve',
        '\xE2': 'acirc',
        '\xC2': 'Acirc',
        '\xE5': 'aring',
        '\xC5': 'angst',
        '\xE4': 'auml',
        '\xC4': 'Auml',
        '\xE3': 'atilde',
        '\xC3': 'Atilde',
        '\u0105': 'aogon',
        '\u0104': 'Aogon',
        '\u0101': 'amacr',
        '\u0100': 'Amacr',
        '\xE6': 'aelig',
        '\xC6': 'AElig',
        '\u{1D4B7}': 'bscr',
        '\u{1D553}': 'bopf',
        '\u{1D51F}': 'bfr',
        '\u{1D539}': 'Bopf',
        '\u212C': 'Bscr',
        '\u{1D505}': 'Bfr',
        '\u{1D520}': 'cfr',
        '\u{1D4B8}': 'cscr',
        '\u{1D554}': 'copf',
        '\u212D': 'Cfr',
        '\u{1D49E}': 'Cscr',
        '\u2102': 'Copf',
        '\u0107': 'cacute',
        '\u0106': 'Cacute',
        '\u0109': 'ccirc',
        '\u0108': 'Ccirc',
        '\u010D': 'ccaron',
        '\u010C': 'Ccaron',
        '\u010B': 'cdot',
        '\u010A': 'Cdot',
        '\xE7': 'ccedil',
        '\xC7': 'Ccedil',
        '\u2105': 'incare',
        '\u{1D521}': 'dfr',
        '\u2146': 'dd',
        '\u{1D555}': 'dopf',
        '\u{1D4B9}': 'dscr',
        '\u{1D49F}': 'Dscr',
        '\u{1D507}': 'Dfr',
        '\u2145': 'DD',
        '\u{1D53B}': 'Dopf',
        '\u010F': 'dcaron',
        '\u010E': 'Dcaron',
        '\u0111': 'dstrok',
        '\u0110': 'Dstrok',
        '\xF0': 'eth',
        '\xD0': 'ETH',
        '\u2147': 'ee',
        '\u212F': 'escr',
        '\u{1D522}': 'efr',
        '\u{1D556}': 'eopf',
        '\u2130': 'Escr',
        '\u{1D508}': 'Efr',
        '\u{1D53C}': 'Eopf',
        '\xE9': 'eacute',
        '\xC9': 'Eacute',
        '\xE8': 'egrave',
        '\xC8': 'Egrave',
        '\xEA': 'ecirc',
        '\xCA': 'Ecirc',
        '\u011B': 'ecaron',
        '\u011A': 'Ecaron',
        '\xEB': 'euml',
        '\xCB': 'Euml',
        '\u0117': 'edot',
        '\u0116': 'Edot',
        '\u0119': 'eogon',
        '\u0118': 'Eogon',
        '\u0113': 'emacr',
        '\u0112': 'Emacr',
        '\u{1D523}': 'ffr',
        '\u{1D557}': 'fopf',
        '\u{1D4BB}': 'fscr',
        '\u{1D509}': 'Ffr',
        '\u{1D53D}': 'Fopf',
        '\u2131': 'Fscr',
        '\uFB00': 'fflig',
        '\uFB03': 'ffilig',
        '\uFB04': 'ffllig',
        '\uFB01': 'filig',
        fj: 'fjlig',
        '\uFB02': 'fllig',
        '\u0192': 'fnof',
        '\u210A': 'gscr',
        '\u{1D558}': 'gopf',
        '\u{1D524}': 'gfr',
        '\u{1D4A2}': 'Gscr',
        '\u{1D53E}': 'Gopf',
        '\u{1D50A}': 'Gfr',
        '\u01F5': 'gacute',
        '\u011F': 'gbreve',
        '\u011E': 'Gbreve',
        '\u011D': 'gcirc',
        '\u011C': 'Gcirc',
        '\u0121': 'gdot',
        '\u0120': 'Gdot',
        '\u0122': 'Gcedil',
        '\u{1D525}': 'hfr',
        '\u210E': 'planckh',
        '\u{1D4BD}': 'hscr',
        '\u{1D559}': 'hopf',
        '\u210B': 'Hscr',
        '\u210C': 'Hfr',
        '\u210D': 'Hopf',
        '\u0125': 'hcirc',
        '\u0124': 'Hcirc',
        '\u210F': 'hbar',
        '\u0127': 'hstrok',
        '\u0126': 'Hstrok',
        '\u{1D55A}': 'iopf',
        '\u{1D526}': 'ifr',
        '\u{1D4BE}': 'iscr',
        '\u2148': 'ii',
        '\u{1D540}': 'Iopf',
        '\u2110': 'Iscr',
        '\u2111': 'Im',
        '\xED': 'iacute',
        '\xCD': 'Iacute',
        '\xEC': 'igrave',
        '\xCC': 'Igrave',
        '\xEE': 'icirc',
        '\xCE': 'Icirc',
        '\xEF': 'iuml',
        '\xCF': 'Iuml',
        '\u0129': 'itilde',
        '\u0128': 'Itilde',
        '\u0130': 'Idot',
        '\u012F': 'iogon',
        '\u012E': 'Iogon',
        '\u012B': 'imacr',
        '\u012A': 'Imacr',
        '\u0133': 'ijlig',
        '\u0132': 'IJlig',
        '\u0131': 'imath',
        '\u{1D4BF}': 'jscr',
        '\u{1D55B}': 'jopf',
        '\u{1D527}': 'jfr',
        '\u{1D4A5}': 'Jscr',
        '\u{1D50D}': 'Jfr',
        '\u{1D541}': 'Jopf',
        '\u0135': 'jcirc',
        '\u0134': 'Jcirc',
        '\u0237': 'jmath',
        '\u{1D55C}': 'kopf',
        '\u{1D4C0}': 'kscr',
        '\u{1D528}': 'kfr',
        '\u{1D4A6}': 'Kscr',
        '\u{1D542}': 'Kopf',
        '\u{1D50E}': 'Kfr',
        '\u0137': 'kcedil',
        '\u0136': 'Kcedil',
        '\u{1D529}': 'lfr',
        '\u{1D4C1}': 'lscr',
        '\u2113': 'ell',
        '\u{1D55D}': 'lopf',
        '\u2112': 'Lscr',
        '\u{1D50F}': 'Lfr',
        '\u{1D543}': 'Lopf',
        '\u013A': 'lacute',
        '\u0139': 'Lacute',
        '\u013E': 'lcaron',
        '\u013D': 'Lcaron',
        '\u013C': 'lcedil',
        '\u013B': 'Lcedil',
        '\u0142': 'lstrok',
        '\u0141': 'Lstrok',
        '\u0140': 'lmidot',
        '\u013F': 'Lmidot',
        '\u{1D52A}': 'mfr',
        '\u{1D55E}': 'mopf',
        '\u{1D4C2}': 'mscr',
        '\u{1D510}': 'Mfr',
        '\u{1D544}': 'Mopf',
        '\u2133': 'Mscr',
        '\u{1D52B}': 'nfr',
        '\u{1D55F}': 'nopf',
        '\u{1D4C3}': 'nscr',
        '\u2115': 'Nopf',
        '\u{1D4A9}': 'Nscr',
        '\u{1D511}': 'Nfr',
        '\u0144': 'nacute',
        '\u0143': 'Nacute',
        '\u0148': 'ncaron',
        '\u0147': 'Ncaron',
        '\xF1': 'ntilde',
        '\xD1': 'Ntilde',
        '\u0146': 'ncedil',
        '\u0145': 'Ncedil',
        '\u2116': 'numero',
        '\u014B': 'eng',
        '\u014A': 'ENG',
        '\u{1D560}': 'oopf',
        '\u{1D52C}': 'ofr',
        '\u2134': 'oscr',
        '\u{1D4AA}': 'Oscr',
        '\u{1D512}': 'Ofr',
        '\u{1D546}': 'Oopf',
        '\xBA': 'ordm',
        '\xF3': 'oacute',
        '\xD3': 'Oacute',
        '\xF2': 'ograve',
        '\xD2': 'Ograve',
        '\xF4': 'ocirc',
        '\xD4': 'Ocirc',
        '\xF6': 'ouml',
        '\xD6': 'Ouml',
        '\u0151': 'odblac',
        '\u0150': 'Odblac',
        '\xF5': 'otilde',
        '\xD5': 'Otilde',
        '\xF8': 'oslash',
        '\xD8': 'Oslash',
        '\u014D': 'omacr',
        '\u014C': 'Omacr',
        '\u0153': 'oelig',
        '\u0152': 'OElig',
        '\u{1D52D}': 'pfr',
        '\u{1D4C5}': 'pscr',
        '\u{1D561}': 'popf',
        '\u2119': 'Popf',
        '\u{1D513}': 'Pfr',
        '\u{1D4AB}': 'Pscr',
        '\u{1D562}': 'qopf',
        '\u{1D52E}': 'qfr',
        '\u{1D4C6}': 'qscr',
        '\u{1D4AC}': 'Qscr',
        '\u{1D514}': 'Qfr',
        '\u211A': 'Qopf',
        '\u0138': 'kgreen',
        '\u{1D52F}': 'rfr',
        '\u{1D563}': 'ropf',
        '\u{1D4C7}': 'rscr',
        '\u211B': 'Rscr',
        '\u211C': 'Re',
        '\u211D': 'Ropf',
        '\u0155': 'racute',
        '\u0154': 'Racute',
        '\u0159': 'rcaron',
        '\u0158': 'Rcaron',
        '\u0157': 'rcedil',
        '\u0156': 'Rcedil',
        '\u{1D564}': 'sopf',
        '\u{1D4C8}': 'sscr',
        '\u{1D530}': 'sfr',
        '\u{1D54A}': 'Sopf',
        '\u{1D516}': 'Sfr',
        '\u{1D4AE}': 'Sscr',
        '\u24C8': 'oS',
        '\u015B': 'sacute',
        '\u015A': 'Sacute',
        '\u015D': 'scirc',
        '\u015C': 'Scirc',
        '\u0161': 'scaron',
        '\u0160': 'Scaron',
        '\u015F': 'scedil',
        '\u015E': 'Scedil',
        '\xDF': 'szlig',
        '\u{1D531}': 'tfr',
        '\u{1D4C9}': 'tscr',
        '\u{1D565}': 'topf',
        '\u{1D4AF}': 'Tscr',
        '\u{1D517}': 'Tfr',
        '\u{1D54B}': 'Topf',
        '\u0165': 'tcaron',
        '\u0164': 'Tcaron',
        '\u0163': 'tcedil',
        '\u0162': 'Tcedil',
        '\u2122': 'trade',
        '\u0167': 'tstrok',
        '\u0166': 'Tstrok',
        '\u{1D4CA}': 'uscr',
        '\u{1D566}': 'uopf',
        '\u{1D532}': 'ufr',
        '\u{1D54C}': 'Uopf',
        '\u{1D518}': 'Ufr',
        '\u{1D4B0}': 'Uscr',
        '\xFA': 'uacute',
        '\xDA': 'Uacute',
        '\xF9': 'ugrave',
        '\xD9': 'Ugrave',
        '\u016D': 'ubreve',
        '\u016C': 'Ubreve',
        '\xFB': 'ucirc',
        '\xDB': 'Ucirc',
        '\u016F': 'uring',
        '\u016E': 'Uring',
        '\xFC': 'uuml',
        '\xDC': 'Uuml',
        '\u0171': 'udblac',
        '\u0170': 'Udblac',
        '\u0169': 'utilde',
        '\u0168': 'Utilde',
        '\u0173': 'uogon',
        '\u0172': 'Uogon',
        '\u016B': 'umacr',
        '\u016A': 'Umacr',
        '\u{1D533}': 'vfr',
        '\u{1D567}': 'vopf',
        '\u{1D4CB}': 'vscr',
        '\u{1D519}': 'Vfr',
        '\u{1D54D}': 'Vopf',
        '\u{1D4B1}': 'Vscr',
        '\u{1D568}': 'wopf',
        '\u{1D4CC}': 'wscr',
        '\u{1D534}': 'wfr',
        '\u{1D4B2}': 'Wscr',
        '\u{1D54E}': 'Wopf',
        '\u{1D51A}': 'Wfr',
        '\u0175': 'wcirc',
        '\u0174': 'Wcirc',
        '\u{1D535}': 'xfr',
        '\u{1D4CD}': 'xscr',
        '\u{1D569}': 'xopf',
        '\u{1D54F}': 'Xopf',
        '\u{1D51B}': 'Xfr',
        '\u{1D4B3}': 'Xscr',
        '\u{1D536}': 'yfr',
        '\u{1D4CE}': 'yscr',
        '\u{1D56A}': 'yopf',
        '\u{1D4B4}': 'Yscr',
        '\u{1D51C}': 'Yfr',
        '\u{1D550}': 'Yopf',
        '\xFD': 'yacute',
        '\xDD': 'Yacute',
        '\u0177': 'ycirc',
        '\u0176': 'Ycirc',
        '\xFF': 'yuml',
        '\u0178': 'Yuml',
        '\u{1D4CF}': 'zscr',
        '\u{1D537}': 'zfr',
        '\u{1D56B}': 'zopf',
        '\u2128': 'Zfr',
        '\u2124': 'Zopf',
        '\u{1D4B5}': 'Zscr',
        '\u017A': 'zacute',
        '\u0179': 'Zacute',
        '\u017E': 'zcaron',
        '\u017D': 'Zcaron',
        '\u017C': 'zdot',
        '\u017B': 'Zdot',
        '\u01B5': 'imped',
        '\xFE': 'thorn',
        '\xDE': 'THORN',
        '\u0149': 'napos',
        '\u03B1': 'alpha',
        '\u0391': 'Alpha',
        '\u03B2': 'beta',
        '\u0392': 'Beta',
        '\u03B3': 'gamma',
        '\u0393': 'Gamma',
        '\u03B4': 'delta',
        '\u0394': 'Delta',
        '\u03B5': 'epsi',
        '\u03F5': 'epsiv',
        '\u0395': 'Epsilon',
        '\u03DD': 'gammad',
        '\u03DC': 'Gammad',
        '\u03B6': 'zeta',
        '\u0396': 'Zeta',
        '\u03B7': 'eta',
        '\u0397': 'Eta',
        '\u03B8': 'theta',
        '\u03D1': 'thetav',
        '\u0398': 'Theta',
        '\u03B9': 'iota',
        '\u0399': 'Iota',
        '\u03BA': 'kappa',
        '\u03F0': 'kappav',
        '\u039A': 'Kappa',
        '\u03BB': 'lambda',
        '\u039B': 'Lambda',
        '\u03BC': 'mu',
        '\xB5': 'micro',
        '\u039C': 'Mu',
        '\u03BD': 'nu',
        '\u039D': 'Nu',
        '\u03BE': 'xi',
        '\u039E': 'Xi',
        '\u03BF': 'omicron',
        '\u039F': 'Omicron',
        '\u03C0': 'pi',
        '\u03D6': 'piv',
        '\u03A0': 'Pi',
        '\u03C1': 'rho',
        '\u03F1': 'rhov',
        '\u03A1': 'Rho',
        '\u03C3': 'sigma',
        '\u03A3': 'Sigma',
        '\u03C2': 'sigmaf',
        '\u03C4': 'tau',
        '\u03A4': 'Tau',
        '\u03C5': 'upsi',
        '\u03A5': 'Upsilon',
        '\u03D2': 'Upsi',
        '\u03C6': 'phi',
        '\u03D5': 'phiv',
        '\u03A6': 'Phi',
        '\u03C7': 'chi',
        '\u03A7': 'Chi',
        '\u03C8': 'psi',
        '\u03A8': 'Psi',
        '\u03C9': 'omega',
        '\u03A9': 'ohm',
        '\u0430': 'acy',
        '\u0410': 'Acy',
        '\u0431': 'bcy',
        '\u0411': 'Bcy',
        '\u0432': 'vcy',
        '\u0412': 'Vcy',
        '\u0433': 'gcy',
        '\u0413': 'Gcy',
        '\u0453': 'gjcy',
        '\u0403': 'GJcy',
        '\u0434': 'dcy',
        '\u0414': 'Dcy',
        '\u0452': 'djcy',
        '\u0402': 'DJcy',
        '\u0435': 'iecy',
        '\u0415': 'IEcy',
        '\u0451': 'iocy',
        '\u0401': 'IOcy',
        '\u0454': 'jukcy',
        '\u0404': 'Jukcy',
        '\u0436': 'zhcy',
        '\u0416': 'ZHcy',
        '\u0437': 'zcy',
        '\u0417': 'Zcy',
        '\u0455': 'dscy',
        '\u0405': 'DScy',
        '\u0438': 'icy',
        '\u0418': 'Icy',
        '\u0456': 'iukcy',
        '\u0406': 'Iukcy',
        '\u0457': 'yicy',
        '\u0407': 'YIcy',
        '\u0439': 'jcy',
        '\u0419': 'Jcy',
        '\u0458': 'jsercy',
        '\u0408': 'Jsercy',
        '\u043A': 'kcy',
        '\u041A': 'Kcy',
        '\u045C': 'kjcy',
        '\u040C': 'KJcy',
        '\u043B': 'lcy',
        '\u041B': 'Lcy',
        '\u0459': 'ljcy',
        '\u0409': 'LJcy',
        '\u043C': 'mcy',
        '\u041C': 'Mcy',
        '\u043D': 'ncy',
        '\u041D': 'Ncy',
        '\u045A': 'njcy',
        '\u040A': 'NJcy',
        '\u043E': 'ocy',
        '\u041E': 'Ocy',
        '\u043F': 'pcy',
        '\u041F': 'Pcy',
        '\u0440': 'rcy',
        '\u0420': 'Rcy',
        '\u0441': 'scy',
        '\u0421': 'Scy',
        '\u0442': 'tcy',
        '\u0422': 'Tcy',
        '\u045B': 'tshcy',
        '\u040B': 'TSHcy',
        '\u0443': 'ucy',
        '\u0423': 'Ucy',
        '\u045E': 'ubrcy',
        '\u040E': 'Ubrcy',
        '\u0444': 'fcy',
        '\u0424': 'Fcy',
        '\u0445': 'khcy',
        '\u0425': 'KHcy',
        '\u0446': 'tscy',
        '\u0426': 'TScy',
        '\u0447': 'chcy',
        '\u0427': 'CHcy',
        '\u045F': 'dzcy',
        '\u040F': 'DZcy',
        '\u0448': 'shcy',
        '\u0428': 'SHcy',
        '\u0449': 'shchcy',
        '\u0429': 'SHCHcy',
        '\u044A': 'hardcy',
        '\u042A': 'HARDcy',
        '\u044B': 'ycy',
        '\u042B': 'Ycy',
        '\u044C': 'softcy',
        '\u042C': 'SOFTcy',
        '\u044D': 'ecy',
        '\u042D': 'Ecy',
        '\u044E': 'yucy',
        '\u042E': 'YUcy',
        '\u044F': 'yacy',
        '\u042F': 'YAcy',
        '\u2135': 'aleph',
        '\u2136': 'beth',
        '\u2137': 'gimel',
        '\u2138': 'daleth',
      };
      var regexEscape = /["&'<>`]/g;
      var escapeMap = {
        '"': '&quot;',
        '&': '&amp;',
        "'": '&#x27;',
        '<': '&lt;',
        // See https://mathiasbynens.be/notes/ambiguous-ampersands: in HTML, the
        // following is not strictly necessary unless it’s part of a tag or an
        // unquoted attribute value. We’re only escaping it to support those
        // situations, and for XML support.
        '>': '&gt;',
        // In Internet Explorer ≤ 8, the backtick character can be used
        // to break out of (un)quoted attribute values or HTML comments.
        // See http://html5sec.org/#102, http://html5sec.org/#108, and
        // http://html5sec.org/#133.
        '`': '&#x60;',
      };
      var regexInvalidEntity = /&#(?:[xX][^a-fA-F0-9]|[^0-9xX])/;
      var regexInvalidRawCodePoint =
        /[\0-\x08\x0B\x0E-\x1F\x7F-\x9F\uFDD0-\uFDEF\uFFFE\uFFFF]|[\uD83F\uD87F\uD8BF\uD8FF\uD93F\uD97F\uD9BF\uD9FF\uDA3F\uDA7F\uDABF\uDAFF\uDB3F\uDB7F\uDBBF\uDBFF][\uDFFE\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
      var regexDecode =
        /&(CounterClockwiseContourIntegral|DoubleLongLeftRightArrow|ClockwiseContourIntegral|NotNestedGreaterGreater|NotSquareSupersetEqual|DiacriticalDoubleAcute|NotRightTriangleEqual|NotSucceedsSlantEqual|NotPrecedesSlantEqual|CloseCurlyDoubleQuote|NegativeVeryThinSpace|DoubleContourIntegral|FilledVerySmallSquare|CapitalDifferentialD|OpenCurlyDoubleQuote|EmptyVerySmallSquare|NestedGreaterGreater|DoubleLongRightArrow|NotLeftTriangleEqual|NotGreaterSlantEqual|ReverseUpEquilibrium|DoubleLeftRightArrow|NotSquareSubsetEqual|NotDoubleVerticalBar|RightArrowLeftArrow|NotGreaterFullEqual|NotRightTriangleBar|SquareSupersetEqual|DownLeftRightVector|DoubleLongLeftArrow|leftrightsquigarrow|LeftArrowRightArrow|NegativeMediumSpace|blacktriangleright|RightDownVectorBar|PrecedesSlantEqual|RightDoubleBracket|SucceedsSlantEqual|NotLeftTriangleBar|RightTriangleEqual|SquareIntersection|RightDownTeeVector|ReverseEquilibrium|NegativeThickSpace|longleftrightarrow|Longleftrightarrow|LongLeftRightArrow|DownRightTeeVector|DownRightVectorBar|GreaterSlantEqual|SquareSubsetEqual|LeftDownVectorBar|LeftDoubleBracket|VerticalSeparator|rightleftharpoons|NotGreaterGreater|NotSquareSuperset|blacktriangleleft|blacktriangledown|NegativeThinSpace|LeftDownTeeVector|NotLessSlantEqual|leftrightharpoons|DoubleUpDownArrow|DoubleVerticalBar|LeftTriangleEqual|FilledSmallSquare|twoheadrightarrow|NotNestedLessLess|DownLeftTeeVector|DownLeftVectorBar|RightAngleBracket|NotTildeFullEqual|NotReverseElement|RightUpDownVector|DiacriticalTilde|NotSucceedsTilde|circlearrowright|NotPrecedesEqual|rightharpoondown|DoubleRightArrow|NotSucceedsEqual|NonBreakingSpace|NotRightTriangle|LessEqualGreater|RightUpTeeVector|LeftAngleBracket|GreaterFullEqual|DownArrowUpArrow|RightUpVectorBar|twoheadleftarrow|GreaterEqualLess|downharpoonright|RightTriangleBar|ntrianglerighteq|NotSupersetEqual|LeftUpDownVector|DiacriticalAcute|rightrightarrows|vartriangleright|UpArrowDownArrow|DiacriticalGrave|UnderParenthesis|EmptySmallSquare|LeftUpVectorBar|leftrightarrows|DownRightVector|downharpoonleft|trianglerighteq|ShortRightArrow|OverParenthesis|DoubleLeftArrow|DoubleDownArrow|NotSquareSubset|bigtriangledown|ntrianglelefteq|UpperRightArrow|curvearrowright|vartriangleleft|NotLeftTriangle|nleftrightarrow|LowerRightArrow|NotHumpDownHump|NotGreaterTilde|rightthreetimes|LeftUpTeeVector|NotGreaterEqual|straightepsilon|LeftTriangleBar|rightsquigarrow|ContourIntegral|rightleftarrows|CloseCurlyQuote|RightDownVector|LeftRightVector|nLeftrightarrow|leftharpoondown|circlearrowleft|SquareSuperset|OpenCurlyQuote|hookrightarrow|HorizontalLine|DiacriticalDot|NotLessGreater|ntriangleright|DoubleRightTee|InvisibleComma|InvisibleTimes|LowerLeftArrow|DownLeftVector|NotSubsetEqual|curvearrowleft|trianglelefteq|NotVerticalBar|TildeFullEqual|downdownarrows|NotGreaterLess|RightTeeVector|ZeroWidthSpace|looparrowright|LongRightArrow|doublebarwedge|ShortLeftArrow|ShortDownArrow|RightVectorBar|GreaterGreater|ReverseElement|rightharpoonup|LessSlantEqual|leftthreetimes|upharpoonright|rightarrowtail|LeftDownVector|Longrightarrow|NestedLessLess|UpperLeftArrow|nshortparallel|leftleftarrows|leftrightarrow|Leftrightarrow|LeftRightArrow|longrightarrow|upharpoonleft|RightArrowBar|ApplyFunction|LeftTeeVector|leftarrowtail|NotEqualTilde|varsubsetneqq|varsupsetneqq|RightTeeArrow|SucceedsEqual|SucceedsTilde|LeftVectorBar|SupersetEqual|hookleftarrow|DifferentialD|VerticalTilde|VeryThinSpace|blacktriangle|bigtriangleup|LessFullEqual|divideontimes|leftharpoonup|UpEquilibrium|ntriangleleft|RightTriangle|measuredangle|shortparallel|longleftarrow|Longleftarrow|LongLeftArrow|DoubleLeftTee|Poincareplane|PrecedesEqual|triangleright|DoubleUpArrow|RightUpVector|fallingdotseq|looparrowleft|PrecedesTilde|NotTildeEqual|NotTildeTilde|smallsetminus|Proportional|triangleleft|triangledown|UnderBracket|NotHumpEqual|exponentiale|ExponentialE|NotLessTilde|HilbertSpace|RightCeiling|blacklozenge|varsupsetneq|HumpDownHump|GreaterEqual|VerticalLine|LeftTeeArrow|NotLessEqual|DownTeeArrow|LeftTriangle|varsubsetneq|Intersection|NotCongruent|DownArrowBar|LeftUpVector|LeftArrowBar|risingdotseq|GreaterTilde|RoundImplies|SquareSubset|ShortUpArrow|NotSuperset|quaternions|precnapprox|backepsilon|preccurlyeq|OverBracket|blacksquare|MediumSpace|VerticalBar|circledcirc|circleddash|CircleMinus|CircleTimes|LessGreater|curlyeqprec|curlyeqsucc|diamondsuit|UpDownArrow|Updownarrow|RuleDelayed|Rrightarrow|updownarrow|RightVector|nRightarrow|nrightarrow|eqslantless|LeftCeiling|Equilibrium|SmallCircle|expectation|NotSucceeds|thickapprox|GreaterLess|SquareUnion|NotPrecedes|NotLessLess|straightphi|succnapprox|succcurlyeq|SubsetEqual|sqsupseteq|Proportion|Laplacetrf|ImaginaryI|supsetneqq|NotGreater|gtreqqless|NotElement|ThickSpace|TildeEqual|TildeTilde|Fouriertrf|rmoustache|EqualTilde|eqslantgtr|UnderBrace|LeftVector|UpArrowBar|nLeftarrow|nsubseteqq|subsetneqq|nsupseteqq|nleftarrow|succapprox|lessapprox|UpTeeArrow|upuparrows|curlywedge|lesseqqgtr|varepsilon|varnothing|RightFloor|complement|CirclePlus|sqsubseteq|Lleftarrow|circledast|RightArrow|Rightarrow|rightarrow|lmoustache|Bernoullis|precapprox|mapstoleft|mapstodown|longmapsto|dotsquare|downarrow|DoubleDot|nsubseteq|supsetneq|leftarrow|nsupseteq|subsetneq|ThinSpace|ngeqslant|subseteqq|HumpEqual|NotSubset|triangleq|NotCupCap|lesseqgtr|heartsuit|TripleDot|Leftarrow|Coproduct|Congruent|varpropto|complexes|gvertneqq|LeftArrow|LessTilde|supseteqq|MinusPlus|CircleDot|nleqslant|NotExists|gtreqless|nparallel|UnionPlus|LeftFloor|checkmark|CenterDot|centerdot|Mellintrf|gtrapprox|bigotimes|OverBrace|spadesuit|therefore|pitchfork|rationals|PlusMinus|Backslash|Therefore|DownBreve|backsimeq|backprime|DownArrow|nshortmid|Downarrow|lvertneqq|eqvparsl|imagline|imagpart|infintie|integers|Integral|intercal|LessLess|Uarrocir|intlarhk|sqsupset|angmsdaf|sqsubset|llcorner|vartheta|cupbrcap|lnapprox|Superset|SuchThat|succnsim|succneqq|angmsdag|biguplus|curlyvee|trpezium|Succeeds|NotTilde|bigwedge|angmsdah|angrtvbd|triminus|cwconint|fpartint|lrcorner|smeparsl|subseteq|urcorner|lurdshar|laemptyv|DDotrahd|approxeq|ldrushar|awconint|mapstoup|backcong|shortmid|triangle|geqslant|gesdotol|timesbar|circledR|circledS|setminus|multimap|naturals|scpolint|ncongdot|RightTee|boxminus|gnapprox|boxtimes|andslope|thicksim|angmsdaa|varsigma|cirfnint|rtriltri|angmsdab|rppolint|angmsdac|barwedge|drbkarow|clubsuit|thetasym|bsolhsub|capbrcup|dzigrarr|doteqdot|DotEqual|dotminus|UnderBar|NotEqual|realpart|otimesas|ulcorner|hksearow|hkswarow|parallel|PartialD|elinters|emptyset|plusacir|bbrktbrk|angmsdad|pointint|bigoplus|angmsdae|Precedes|bigsqcup|varkappa|notindot|supseteq|precneqq|precnsim|profalar|profline|profsurf|leqslant|lesdotor|raemptyv|subplus|notnivb|notnivc|subrarr|zigrarr|vzigzag|submult|subedot|Element|between|cirscir|larrbfs|larrsim|lotimes|lbrksld|lbrkslu|lozenge|ldrdhar|dbkarow|bigcirc|epsilon|simrarr|simplus|ltquest|Epsilon|luruhar|gtquest|maltese|npolint|eqcolon|npreceq|bigodot|ddagger|gtrless|bnequiv|harrcir|ddotseq|equivDD|backsim|demptyv|nsqsube|nsqsupe|Upsilon|nsubset|upsilon|minusdu|nsucceq|swarrow|nsupset|coloneq|searrow|boxplus|napprox|natural|asympeq|alefsym|congdot|nearrow|bigstar|diamond|supplus|tritime|LeftTee|nvinfin|triplus|NewLine|nvltrie|nvrtrie|nwarrow|nexists|Diamond|ruluhar|Implies|supmult|angzarr|suplarr|suphsub|questeq|because|digamma|Because|olcross|bemptyv|omicron|Omicron|rotimes|NoBreak|intprod|angrtvb|orderof|uwangle|suphsol|lesdoto|orslope|DownTee|realine|cudarrl|rdldhar|OverBar|supedot|lessdot|supdsub|topfork|succsim|rbrkslu|rbrksld|pertenk|cudarrr|isindot|planckh|lessgtr|pluscir|gesdoto|plussim|plustwo|lesssim|cularrp|rarrsim|Cayleys|notinva|notinvb|notinvc|UpArrow|Uparrow|uparrow|NotLess|dwangle|precsim|Product|curarrm|Cconint|dotplus|rarrbfs|ccupssm|Cedilla|cemptyv|notniva|quatint|frac35|frac38|frac45|frac56|frac58|frac78|tridot|xoplus|gacute|gammad|Gammad|lfisht|lfloor|bigcup|sqsupe|gbreve|Gbreve|lharul|sqsube|sqcups|Gcedil|apacir|llhard|lmidot|Lmidot|lmoust|andand|sqcaps|approx|Abreve|spades|circeq|tprime|divide|topcir|Assign|topbot|gesdot|divonx|xuplus|timesd|gesles|atilde|solbar|SOFTcy|loplus|timesb|lowast|lowbar|dlcorn|dlcrop|softcy|dollar|lparlt|thksim|lrhard|Atilde|lsaquo|smashp|bigvee|thinsp|wreath|bkarow|lsquor|lstrok|Lstrok|lthree|ltimes|ltlarr|DotDot|simdot|ltrPar|weierp|xsqcup|angmsd|sigmav|sigmaf|zeetrf|Zcaron|zcaron|mapsto|vsupne|thetav|cirmid|marker|mcomma|Zacute|vsubnE|there4|gtlPar|vsubne|bottom|gtrarr|SHCHcy|shchcy|midast|midcir|middot|minusb|minusd|gtrdot|bowtie|sfrown|mnplus|models|colone|seswar|Colone|mstpos|searhk|gtrsim|nacute|Nacute|boxbox|telrec|hairsp|Tcedil|nbumpe|scnsim|ncaron|Ncaron|ncedil|Ncedil|hamilt|Scedil|nearhk|hardcy|HARDcy|tcedil|Tcaron|commat|nequiv|nesear|tcaron|target|hearts|nexist|varrho|scedil|Scaron|scaron|hellip|Sacute|sacute|hercon|swnwar|compfn|rtimes|rthree|rsquor|rsaquo|zacute|wedgeq|homtht|barvee|barwed|Barwed|rpargt|horbar|conint|swarhk|roplus|nltrie|hslash|hstrok|Hstrok|rmoust|Conint|bprime|hybull|hyphen|iacute|Iacute|supsup|supsub|supsim|varphi|coprod|brvbar|agrave|Supset|supset|igrave|Igrave|notinE|Agrave|iiiint|iinfin|copysr|wedbar|Verbar|vangrt|becaus|incare|verbar|inodot|bullet|drcorn|intcal|drcrop|cularr|vellip|Utilde|bumpeq|cupcap|dstrok|Dstrok|CupCap|cupcup|cupdot|eacute|Eacute|supdot|iquest|easter|ecaron|Ecaron|ecolon|isinsv|utilde|itilde|Itilde|curarr|succeq|Bumpeq|cacute|ulcrop|nparsl|Cacute|nprcue|egrave|Egrave|nrarrc|nrarrw|subsup|subsub|nrtrie|jsercy|nsccue|Jsercy|kappav|kcedil|Kcedil|subsim|ulcorn|nsimeq|egsdot|veebar|kgreen|capand|elsdot|Subset|subset|curren|aacute|lacute|Lacute|emptyv|ntilde|Ntilde|lagran|lambda|Lambda|capcap|Ugrave|langle|subdot|emsp13|numero|emsp14|nvdash|nvDash|nVdash|nVDash|ugrave|ufisht|nvHarr|larrfs|nvlArr|larrhk|larrlp|larrpl|nvrArr|Udblac|nwarhk|larrtl|nwnear|oacute|Oacute|latail|lAtail|sstarf|lbrace|odblac|Odblac|lbrack|udblac|odsold|eparsl|lcaron|Lcaron|ograve|Ograve|lcedil|Lcedil|Aacute|ssmile|ssetmn|squarf|ldquor|capcup|ominus|cylcty|rharul|eqcirc|dagger|rfloor|rfisht|Dagger|daleth|equals|origof|capdot|equest|dcaron|Dcaron|rdquor|oslash|Oslash|otilde|Otilde|otimes|Otimes|urcrop|Ubreve|ubreve|Yacute|Uacute|uacute|Rcedil|rcedil|urcorn|parsim|Rcaron|Vdashl|rcaron|Tstrok|percnt|period|permil|Exists|yacute|rbrack|rbrace|phmmat|ccaron|Ccaron|planck|ccedil|plankv|tstrok|female|plusdo|plusdu|ffilig|plusmn|ffllig|Ccedil|rAtail|dfisht|bernou|ratail|Rarrtl|rarrtl|angsph|rarrpl|rarrlp|rarrhk|xwedge|xotime|forall|ForAll|Vvdash|vsupnE|preceq|bigcap|frac12|frac13|frac14|primes|rarrfs|prnsim|frac15|Square|frac16|square|lesdot|frac18|frac23|propto|prurel|rarrap|rangle|puncsp|frac25|Racute|qprime|racute|lesges|frac34|abreve|AElig|eqsim|utdot|setmn|urtri|Equal|Uring|seArr|uring|searr|dashv|Dashv|mumap|nabla|iogon|Iogon|sdote|sdotb|scsim|napid|napos|equiv|natur|Acirc|dblac|erarr|nbump|iprod|erDot|ucirc|awint|esdot|angrt|ncong|isinE|scnap|Scirc|scirc|ndash|isins|Ubrcy|nearr|neArr|isinv|nedot|ubrcy|acute|Ycirc|iukcy|Iukcy|xutri|nesim|caret|jcirc|Jcirc|caron|twixt|ddarr|sccue|exist|jmath|sbquo|ngeqq|angst|ccaps|lceil|ngsim|UpTee|delta|Delta|rtrif|nharr|nhArr|nhpar|rtrie|jukcy|Jukcy|kappa|rsquo|Kappa|nlarr|nlArr|TSHcy|rrarr|aogon|Aogon|fflig|xrarr|tshcy|ccirc|nleqq|filig|upsih|nless|dharl|nlsim|fjlig|ropar|nltri|dharr|robrk|roarr|fllig|fltns|roang|rnmid|subnE|subne|lAarr|trisb|Ccirc|acirc|ccups|blank|VDash|forkv|Vdash|langd|cedil|blk12|blk14|laquo|strns|diams|notin|vDash|larrb|blk34|block|disin|uplus|vdash|vBarv|aelig|starf|Wedge|check|xrArr|lates|lbarr|lBarr|notni|lbbrk|bcong|frasl|lbrke|frown|vrtri|vprop|vnsup|gamma|Gamma|wedge|xodot|bdquo|srarr|doteq|ldquo|boxdl|boxdL|gcirc|Gcirc|boxDl|boxDL|boxdr|boxdR|boxDr|TRADE|trade|rlhar|boxDR|vnsub|npart|vltri|rlarr|boxhd|boxhD|nprec|gescc|nrarr|nrArr|boxHd|boxHD|boxhu|boxhU|nrtri|boxHu|clubs|boxHU|times|colon|Colon|gimel|xlArr|Tilde|nsime|tilde|nsmid|nspar|THORN|thorn|xlarr|nsube|nsubE|thkap|xhArr|comma|nsucc|boxul|boxuL|nsupe|nsupE|gneqq|gnsim|boxUl|boxUL|grave|boxur|boxuR|boxUr|boxUR|lescc|angle|bepsi|boxvh|varpi|boxvH|numsp|Theta|gsime|gsiml|theta|boxVh|boxVH|boxvl|gtcir|gtdot|boxvL|boxVl|boxVL|crarr|cross|Cross|nvsim|boxvr|nwarr|nwArr|sqsup|dtdot|Uogon|lhard|lharu|dtrif|ocirc|Ocirc|lhblk|duarr|odash|sqsub|Hacek|sqcup|llarr|duhar|oelig|OElig|ofcir|boxvR|uogon|lltri|boxVr|csube|uuarr|ohbar|csupe|ctdot|olarr|olcir|harrw|oline|sqcap|omacr|Omacr|omega|Omega|boxVR|aleph|lneqq|lnsim|loang|loarr|rharu|lobrk|hcirc|operp|oplus|rhard|Hcirc|orarr|Union|order|ecirc|Ecirc|cuepr|szlig|cuesc|breve|reals|eDDot|Breve|hoarr|lopar|utrif|rdquo|Umacr|umacr|efDot|swArr|ultri|alpha|rceil|ovbar|swarr|Wcirc|wcirc|smtes|smile|bsemi|lrarr|aring|parsl|lrhar|bsime|uhblk|lrtri|cupor|Aring|uharr|uharl|slarr|rbrke|bsolb|lsime|rbbrk|RBarr|lsimg|phone|rBarr|rbarr|icirc|lsquo|Icirc|emacr|Emacr|ratio|simne|plusb|simlE|simgE|simeq|pluse|ltcir|ltdot|empty|xharr|xdtri|iexcl|Alpha|ltrie|rarrw|pound|ltrif|xcirc|bumpe|prcue|bumpE|asymp|amacr|cuvee|Sigma|sigma|iiint|udhar|iiota|ijlig|IJlig|supnE|imacr|Imacr|prime|Prime|image|prnap|eogon|Eogon|rarrc|mdash|mDDot|cuwed|imath|supne|imped|Amacr|udarr|prsim|micro|rarrb|cwint|raquo|infin|eplus|range|rangd|Ucirc|radic|minus|amalg|veeeq|rAarr|epsiv|ycirc|quest|sharp|quot|zwnj|Qscr|race|qscr|Qopf|qopf|qint|rang|Rang|Zscr|zscr|Zopf|zopf|rarr|rArr|Rarr|Pscr|pscr|prop|prod|prnE|prec|ZHcy|zhcy|prap|Zeta|zeta|Popf|popf|Zdot|plus|zdot|Yuml|yuml|phiv|YUcy|yucy|Yscr|yscr|perp|Yopf|yopf|part|para|YIcy|Ouml|rcub|yicy|YAcy|rdca|ouml|osol|Oscr|rdsh|yacy|real|oscr|xvee|andd|rect|andv|Xscr|oror|ordm|ordf|xscr|ange|aopf|Aopf|rHar|Xopf|opar|Oopf|xopf|xnis|rhov|oopf|omid|xmap|oint|apid|apos|ogon|ascr|Ascr|odot|odiv|xcup|xcap|ocir|oast|nvlt|nvle|nvgt|nvge|nvap|Wscr|wscr|auml|ntlg|ntgl|nsup|nsub|nsim|Nscr|nscr|nsce|Wopf|ring|npre|wopf|npar|Auml|Barv|bbrk|Nopf|nopf|nmid|nLtv|beta|ropf|Ropf|Beta|beth|nles|rpar|nleq|bnot|bNot|nldr|NJcy|rscr|Rscr|Vscr|vscr|rsqb|njcy|bopf|nisd|Bopf|rtri|Vopf|nGtv|ngtr|vopf|boxh|boxH|boxv|nges|ngeq|boxV|bscr|scap|Bscr|bsim|Vert|vert|bsol|bull|bump|caps|cdot|ncup|scnE|ncap|nbsp|napE|Cdot|cent|sdot|Vbar|nang|vBar|chcy|Mscr|mscr|sect|semi|CHcy|Mopf|mopf|sext|circ|cire|mldr|mlcp|cirE|comp|shcy|SHcy|vArr|varr|cong|copf|Copf|copy|COPY|malt|male|macr|lvnE|cscr|ltri|sime|ltcc|simg|Cscr|siml|csub|Uuml|lsqb|lsim|uuml|csup|Lscr|lscr|utri|smid|lpar|cups|smte|lozf|darr|Lopf|Uscr|solb|lopf|sopf|Sopf|lneq|uscr|spar|dArr|lnap|Darr|dash|Sqrt|LJcy|ljcy|lHar|dHar|Upsi|upsi|diam|lesg|djcy|DJcy|leqq|dopf|Dopf|dscr|Dscr|dscy|ldsh|ldca|squf|DScy|sscr|Sscr|dsol|lcub|late|star|Star|Uopf|Larr|lArr|larr|uopf|dtri|dzcy|sube|subE|Lang|lang|Kscr|kscr|Kopf|kopf|KJcy|kjcy|KHcy|khcy|DZcy|ecir|edot|eDot|Jscr|jscr|succ|Jopf|jopf|Edot|uHar|emsp|ensp|Iuml|iuml|eopf|isin|Iscr|iscr|Eopf|epar|sung|epsi|escr|sup1|sup2|sup3|Iota|iota|supe|supE|Iopf|iopf|IOcy|iocy|Escr|esim|Esim|imof|Uarr|QUOT|uArr|uarr|euml|IEcy|iecy|Idot|Euml|euro|excl|Hscr|hscr|Hopf|hopf|TScy|tscy|Tscr|hbar|tscr|flat|tbrk|fnof|hArr|harr|half|fopf|Fopf|tdot|gvnE|fork|trie|gtcc|fscr|Fscr|gdot|gsim|Gscr|gscr|Gopf|gopf|gneq|Gdot|tosa|gnap|Topf|topf|geqq|toea|GJcy|gjcy|tint|gesl|mid|Sfr|ggg|top|ges|gla|glE|glj|geq|gne|gEl|gel|gnE|Gcy|gcy|gap|Tfr|tfr|Tcy|tcy|Hat|Tau|Ffr|tau|Tab|hfr|Hfr|ffr|Fcy|fcy|icy|Icy|iff|ETH|eth|ifr|Ifr|Eta|eta|int|Int|Sup|sup|ucy|Ucy|Sum|sum|jcy|ENG|ufr|Ufr|eng|Jcy|jfr|els|ell|egs|Efr|efr|Jfr|uml|kcy|Kcy|Ecy|ecy|kfr|Kfr|lap|Sub|sub|lat|lcy|Lcy|leg|Dot|dot|lEg|leq|les|squ|div|die|lfr|Lfr|lgE|Dfr|dfr|Del|deg|Dcy|dcy|lne|lnE|sol|loz|smt|Cup|lrm|cup|lsh|Lsh|sim|shy|map|Map|mcy|Mcy|mfr|Mfr|mho|gfr|Gfr|sfr|cir|Chi|chi|nap|Cfr|vcy|Vcy|cfr|Scy|scy|ncy|Ncy|vee|Vee|Cap|cap|nfr|scE|sce|Nfr|nge|ngE|nGg|vfr|Vfr|ngt|bot|nGt|nis|niv|Rsh|rsh|nle|nlE|bne|Bfr|bfr|nLl|nlt|nLt|Bcy|bcy|not|Not|rlm|wfr|Wfr|npr|nsc|num|ocy|ast|Ocy|ofr|xfr|Xfr|Ofr|ogt|ohm|apE|olt|Rho|ape|rho|Rfr|rfr|ord|REG|ang|reg|orv|And|and|AMP|Rcy|amp|Afr|ycy|Ycy|yen|yfr|Yfr|rcy|par|pcy|Pcy|pfr|Pfr|phi|Phi|afr|Acy|acy|zcy|Zcy|piv|acE|acd|zfr|Zfr|pre|prE|psi|Psi|qfr|Qfr|zwj|Or|ge|Gg|gt|gg|el|oS|lt|Lt|LT|Re|lg|gl|eg|ne|Im|it|le|DD|wp|wr|nu|Nu|dd|lE|Sc|sc|pi|Pi|ee|af|ll|Ll|rx|gE|xi|pm|Xi|ic|pr|Pr|in|ni|mp|mu|ac|Mu|or|ap|Gt|GT|ii);|&(Aacute|Agrave|Atilde|Ccedil|Eacute|Egrave|Iacute|Igrave|Ntilde|Oacute|Ograve|Oslash|Otilde|Uacute|Ugrave|Yacute|aacute|agrave|atilde|brvbar|ccedil|curren|divide|eacute|egrave|frac12|frac14|frac34|iacute|igrave|iquest|middot|ntilde|oacute|ograve|oslash|otilde|plusmn|uacute|ugrave|yacute|AElig|Acirc|Aring|Ecirc|Icirc|Ocirc|THORN|Ucirc|acirc|acute|aelig|aring|cedil|ecirc|icirc|iexcl|laquo|micro|ocirc|pound|raquo|szlig|thorn|times|ucirc|Auml|COPY|Euml|Iuml|Ouml|QUOT|Uuml|auml|cent|copy|euml|iuml|macr|nbsp|ordf|ordm|ouml|para|quot|sect|sup1|sup2|sup3|uuml|yuml|AMP|ETH|REG|amp|deg|eth|not|reg|shy|uml|yen|GT|LT|gt|lt)(?!;)([=a-zA-Z0-9]?)|&#([0-9]+)(;?)|&#[xX]([a-fA-F0-9]+)(;?)|&([0-9a-zA-Z]+)/g;
      var decodeMap = {
        aacute: '\xE1',
        Aacute: '\xC1',
        abreve: '\u0103',
        Abreve: '\u0102',
        ac: '\u223E',
        acd: '\u223F',
        acE: '\u223E\u0333',
        acirc: '\xE2',
        Acirc: '\xC2',
        acute: '\xB4',
        acy: '\u0430',
        Acy: '\u0410',
        aelig: '\xE6',
        AElig: '\xC6',
        af: '\u2061',
        afr: '\u{1D51E}',
        Afr: '\u{1D504}',
        agrave: '\xE0',
        Agrave: '\xC0',
        alefsym: '\u2135',
        aleph: '\u2135',
        alpha: '\u03B1',
        Alpha: '\u0391',
        amacr: '\u0101',
        Amacr: '\u0100',
        amalg: '\u2A3F',
        amp: '&',
        AMP: '&',
        and: '\u2227',
        And: '\u2A53',
        andand: '\u2A55',
        andd: '\u2A5C',
        andslope: '\u2A58',
        andv: '\u2A5A',
        ang: '\u2220',
        ange: '\u29A4',
        angle: '\u2220',
        angmsd: '\u2221',
        angmsdaa: '\u29A8',
        angmsdab: '\u29A9',
        angmsdac: '\u29AA',
        angmsdad: '\u29AB',
        angmsdae: '\u29AC',
        angmsdaf: '\u29AD',
        angmsdag: '\u29AE',
        angmsdah: '\u29AF',
        angrt: '\u221F',
        angrtvb: '\u22BE',
        angrtvbd: '\u299D',
        angsph: '\u2222',
        angst: '\xC5',
        angzarr: '\u237C',
        aogon: '\u0105',
        Aogon: '\u0104',
        aopf: '\u{1D552}',
        Aopf: '\u{1D538}',
        ap: '\u2248',
        apacir: '\u2A6F',
        ape: '\u224A',
        apE: '\u2A70',
        apid: '\u224B',
        apos: "'",
        ApplyFunction: '\u2061',
        approx: '\u2248',
        approxeq: '\u224A',
        aring: '\xE5',
        Aring: '\xC5',
        ascr: '\u{1D4B6}',
        Ascr: '\u{1D49C}',
        Assign: '\u2254',
        ast: '*',
        asymp: '\u2248',
        asympeq: '\u224D',
        atilde: '\xE3',
        Atilde: '\xC3',
        auml: '\xE4',
        Auml: '\xC4',
        awconint: '\u2233',
        awint: '\u2A11',
        backcong: '\u224C',
        backepsilon: '\u03F6',
        backprime: '\u2035',
        backsim: '\u223D',
        backsimeq: '\u22CD',
        Backslash: '\u2216',
        Barv: '\u2AE7',
        barvee: '\u22BD',
        barwed: '\u2305',
        Barwed: '\u2306',
        barwedge: '\u2305',
        bbrk: '\u23B5',
        bbrktbrk: '\u23B6',
        bcong: '\u224C',
        bcy: '\u0431',
        Bcy: '\u0411',
        bdquo: '\u201E',
        becaus: '\u2235',
        because: '\u2235',
        Because: '\u2235',
        bemptyv: '\u29B0',
        bepsi: '\u03F6',
        bernou: '\u212C',
        Bernoullis: '\u212C',
        beta: '\u03B2',
        Beta: '\u0392',
        beth: '\u2136',
        between: '\u226C',
        bfr: '\u{1D51F}',
        Bfr: '\u{1D505}',
        bigcap: '\u22C2',
        bigcirc: '\u25EF',
        bigcup: '\u22C3',
        bigodot: '\u2A00',
        bigoplus: '\u2A01',
        bigotimes: '\u2A02',
        bigsqcup: '\u2A06',
        bigstar: '\u2605',
        bigtriangledown: '\u25BD',
        bigtriangleup: '\u25B3',
        biguplus: '\u2A04',
        bigvee: '\u22C1',
        bigwedge: '\u22C0',
        bkarow: '\u290D',
        blacklozenge: '\u29EB',
        blacksquare: '\u25AA',
        blacktriangle: '\u25B4',
        blacktriangledown: '\u25BE',
        blacktriangleleft: '\u25C2',
        blacktriangleright: '\u25B8',
        blank: '\u2423',
        blk12: '\u2592',
        blk14: '\u2591',
        blk34: '\u2593',
        block: '\u2588',
        bne: '=\u20E5',
        bnequiv: '\u2261\u20E5',
        bnot: '\u2310',
        bNot: '\u2AED',
        bopf: '\u{1D553}',
        Bopf: '\u{1D539}',
        bot: '\u22A5',
        bottom: '\u22A5',
        bowtie: '\u22C8',
        boxbox: '\u29C9',
        boxdl: '\u2510',
        boxdL: '\u2555',
        boxDl: '\u2556',
        boxDL: '\u2557',
        boxdr: '\u250C',
        boxdR: '\u2552',
        boxDr: '\u2553',
        boxDR: '\u2554',
        boxh: '\u2500',
        boxH: '\u2550',
        boxhd: '\u252C',
        boxhD: '\u2565',
        boxHd: '\u2564',
        boxHD: '\u2566',
        boxhu: '\u2534',
        boxhU: '\u2568',
        boxHu: '\u2567',
        boxHU: '\u2569',
        boxminus: '\u229F',
        boxplus: '\u229E',
        boxtimes: '\u22A0',
        boxul: '\u2518',
        boxuL: '\u255B',
        boxUl: '\u255C',
        boxUL: '\u255D',
        boxur: '\u2514',
        boxuR: '\u2558',
        boxUr: '\u2559',
        boxUR: '\u255A',
        boxv: '\u2502',
        boxV: '\u2551',
        boxvh: '\u253C',
        boxvH: '\u256A',
        boxVh: '\u256B',
        boxVH: '\u256C',
        boxvl: '\u2524',
        boxvL: '\u2561',
        boxVl: '\u2562',
        boxVL: '\u2563',
        boxvr: '\u251C',
        boxvR: '\u255E',
        boxVr: '\u255F',
        boxVR: '\u2560',
        bprime: '\u2035',
        breve: '\u02D8',
        Breve: '\u02D8',
        brvbar: '\xA6',
        bscr: '\u{1D4B7}',
        Bscr: '\u212C',
        bsemi: '\u204F',
        bsim: '\u223D',
        bsime: '\u22CD',
        bsol: '\\',
        bsolb: '\u29C5',
        bsolhsub: '\u27C8',
        bull: '\u2022',
        bullet: '\u2022',
        bump: '\u224E',
        bumpe: '\u224F',
        bumpE: '\u2AAE',
        bumpeq: '\u224F',
        Bumpeq: '\u224E',
        cacute: '\u0107',
        Cacute: '\u0106',
        cap: '\u2229',
        Cap: '\u22D2',
        capand: '\u2A44',
        capbrcup: '\u2A49',
        capcap: '\u2A4B',
        capcup: '\u2A47',
        capdot: '\u2A40',
        CapitalDifferentialD: '\u2145',
        caps: '\u2229\uFE00',
        caret: '\u2041',
        caron: '\u02C7',
        Cayleys: '\u212D',
        ccaps: '\u2A4D',
        ccaron: '\u010D',
        Ccaron: '\u010C',
        ccedil: '\xE7',
        Ccedil: '\xC7',
        ccirc: '\u0109',
        Ccirc: '\u0108',
        Cconint: '\u2230',
        ccups: '\u2A4C',
        ccupssm: '\u2A50',
        cdot: '\u010B',
        Cdot: '\u010A',
        cedil: '\xB8',
        Cedilla: '\xB8',
        cemptyv: '\u29B2',
        cent: '\xA2',
        centerdot: '\xB7',
        CenterDot: '\xB7',
        cfr: '\u{1D520}',
        Cfr: '\u212D',
        chcy: '\u0447',
        CHcy: '\u0427',
        check: '\u2713',
        checkmark: '\u2713',
        chi: '\u03C7',
        Chi: '\u03A7',
        cir: '\u25CB',
        circ: '\u02C6',
        circeq: '\u2257',
        circlearrowleft: '\u21BA',
        circlearrowright: '\u21BB',
        circledast: '\u229B',
        circledcirc: '\u229A',
        circleddash: '\u229D',
        CircleDot: '\u2299',
        circledR: '\xAE',
        circledS: '\u24C8',
        CircleMinus: '\u2296',
        CirclePlus: '\u2295',
        CircleTimes: '\u2297',
        cire: '\u2257',
        cirE: '\u29C3',
        cirfnint: '\u2A10',
        cirmid: '\u2AEF',
        cirscir: '\u29C2',
        ClockwiseContourIntegral: '\u2232',
        CloseCurlyDoubleQuote: '\u201D',
        CloseCurlyQuote: '\u2019',
        clubs: '\u2663',
        clubsuit: '\u2663',
        colon: ':',
        Colon: '\u2237',
        colone: '\u2254',
        Colone: '\u2A74',
        coloneq: '\u2254',
        comma: ',',
        commat: '@',
        comp: '\u2201',
        compfn: '\u2218',
        complement: '\u2201',
        complexes: '\u2102',
        cong: '\u2245',
        congdot: '\u2A6D',
        Congruent: '\u2261',
        conint: '\u222E',
        Conint: '\u222F',
        ContourIntegral: '\u222E',
        copf: '\u{1D554}',
        Copf: '\u2102',
        coprod: '\u2210',
        Coproduct: '\u2210',
        copy: '\xA9',
        COPY: '\xA9',
        copysr: '\u2117',
        CounterClockwiseContourIntegral: '\u2233',
        crarr: '\u21B5',
        cross: '\u2717',
        Cross: '\u2A2F',
        cscr: '\u{1D4B8}',
        Cscr: '\u{1D49E}',
        csub: '\u2ACF',
        csube: '\u2AD1',
        csup: '\u2AD0',
        csupe: '\u2AD2',
        ctdot: '\u22EF',
        cudarrl: '\u2938',
        cudarrr: '\u2935',
        cuepr: '\u22DE',
        cuesc: '\u22DF',
        cularr: '\u21B6',
        cularrp: '\u293D',
        cup: '\u222A',
        Cup: '\u22D3',
        cupbrcap: '\u2A48',
        cupcap: '\u2A46',
        CupCap: '\u224D',
        cupcup: '\u2A4A',
        cupdot: '\u228D',
        cupor: '\u2A45',
        cups: '\u222A\uFE00',
        curarr: '\u21B7',
        curarrm: '\u293C',
        curlyeqprec: '\u22DE',
        curlyeqsucc: '\u22DF',
        curlyvee: '\u22CE',
        curlywedge: '\u22CF',
        curren: '\xA4',
        curvearrowleft: '\u21B6',
        curvearrowright: '\u21B7',
        cuvee: '\u22CE',
        cuwed: '\u22CF',
        cwconint: '\u2232',
        cwint: '\u2231',
        cylcty: '\u232D',
        dagger: '\u2020',
        Dagger: '\u2021',
        daleth: '\u2138',
        darr: '\u2193',
        dArr: '\u21D3',
        Darr: '\u21A1',
        dash: '\u2010',
        dashv: '\u22A3',
        Dashv: '\u2AE4',
        dbkarow: '\u290F',
        dblac: '\u02DD',
        dcaron: '\u010F',
        Dcaron: '\u010E',
        dcy: '\u0434',
        Dcy: '\u0414',
        dd: '\u2146',
        DD: '\u2145',
        ddagger: '\u2021',
        ddarr: '\u21CA',
        DDotrahd: '\u2911',
        ddotseq: '\u2A77',
        deg: '\xB0',
        Del: '\u2207',
        delta: '\u03B4',
        Delta: '\u0394',
        demptyv: '\u29B1',
        dfisht: '\u297F',
        dfr: '\u{1D521}',
        Dfr: '\u{1D507}',
        dHar: '\u2965',
        dharl: '\u21C3',
        dharr: '\u21C2',
        DiacriticalAcute: '\xB4',
        DiacriticalDot: '\u02D9',
        DiacriticalDoubleAcute: '\u02DD',
        DiacriticalGrave: '`',
        DiacriticalTilde: '\u02DC',
        diam: '\u22C4',
        diamond: '\u22C4',
        Diamond: '\u22C4',
        diamondsuit: '\u2666',
        diams: '\u2666',
        die: '\xA8',
        DifferentialD: '\u2146',
        digamma: '\u03DD',
        disin: '\u22F2',
        div: '\xF7',
        divide: '\xF7',
        divideontimes: '\u22C7',
        divonx: '\u22C7',
        djcy: '\u0452',
        DJcy: '\u0402',
        dlcorn: '\u231E',
        dlcrop: '\u230D',
        dollar: '$',
        dopf: '\u{1D555}',
        Dopf: '\u{1D53B}',
        dot: '\u02D9',
        Dot: '\xA8',
        DotDot: '\u20DC',
        doteq: '\u2250',
        doteqdot: '\u2251',
        DotEqual: '\u2250',
        dotminus: '\u2238',
        dotplus: '\u2214',
        dotsquare: '\u22A1',
        doublebarwedge: '\u2306',
        DoubleContourIntegral: '\u222F',
        DoubleDot: '\xA8',
        DoubleDownArrow: '\u21D3',
        DoubleLeftArrow: '\u21D0',
        DoubleLeftRightArrow: '\u21D4',
        DoubleLeftTee: '\u2AE4',
        DoubleLongLeftArrow: '\u27F8',
        DoubleLongLeftRightArrow: '\u27FA',
        DoubleLongRightArrow: '\u27F9',
        DoubleRightArrow: '\u21D2',
        DoubleRightTee: '\u22A8',
        DoubleUpArrow: '\u21D1',
        DoubleUpDownArrow: '\u21D5',
        DoubleVerticalBar: '\u2225',
        downarrow: '\u2193',
        Downarrow: '\u21D3',
        DownArrow: '\u2193',
        DownArrowBar: '\u2913',
        DownArrowUpArrow: '\u21F5',
        DownBreve: '\u0311',
        downdownarrows: '\u21CA',
        downharpoonleft: '\u21C3',
        downharpoonright: '\u21C2',
        DownLeftRightVector: '\u2950',
        DownLeftTeeVector: '\u295E',
        DownLeftVector: '\u21BD',
        DownLeftVectorBar: '\u2956',
        DownRightTeeVector: '\u295F',
        DownRightVector: '\u21C1',
        DownRightVectorBar: '\u2957',
        DownTee: '\u22A4',
        DownTeeArrow: '\u21A7',
        drbkarow: '\u2910',
        drcorn: '\u231F',
        drcrop: '\u230C',
        dscr: '\u{1D4B9}',
        Dscr: '\u{1D49F}',
        dscy: '\u0455',
        DScy: '\u0405',
        dsol: '\u29F6',
        dstrok: '\u0111',
        Dstrok: '\u0110',
        dtdot: '\u22F1',
        dtri: '\u25BF',
        dtrif: '\u25BE',
        duarr: '\u21F5',
        duhar: '\u296F',
        dwangle: '\u29A6',
        dzcy: '\u045F',
        DZcy: '\u040F',
        dzigrarr: '\u27FF',
        eacute: '\xE9',
        Eacute: '\xC9',
        easter: '\u2A6E',
        ecaron: '\u011B',
        Ecaron: '\u011A',
        ecir: '\u2256',
        ecirc: '\xEA',
        Ecirc: '\xCA',
        ecolon: '\u2255',
        ecy: '\u044D',
        Ecy: '\u042D',
        eDDot: '\u2A77',
        edot: '\u0117',
        eDot: '\u2251',
        Edot: '\u0116',
        ee: '\u2147',
        efDot: '\u2252',
        efr: '\u{1D522}',
        Efr: '\u{1D508}',
        eg: '\u2A9A',
        egrave: '\xE8',
        Egrave: '\xC8',
        egs: '\u2A96',
        egsdot: '\u2A98',
        el: '\u2A99',
        Element: '\u2208',
        elinters: '\u23E7',
        ell: '\u2113',
        els: '\u2A95',
        elsdot: '\u2A97',
        emacr: '\u0113',
        Emacr: '\u0112',
        empty: '\u2205',
        emptyset: '\u2205',
        EmptySmallSquare: '\u25FB',
        emptyv: '\u2205',
        EmptyVerySmallSquare: '\u25AB',
        emsp: '\u2003',
        emsp13: '\u2004',
        emsp14: '\u2005',
        eng: '\u014B',
        ENG: '\u014A',
        ensp: '\u2002',
        eogon: '\u0119',
        Eogon: '\u0118',
        eopf: '\u{1D556}',
        Eopf: '\u{1D53C}',
        epar: '\u22D5',
        eparsl: '\u29E3',
        eplus: '\u2A71',
        epsi: '\u03B5',
        epsilon: '\u03B5',
        Epsilon: '\u0395',
        epsiv: '\u03F5',
        eqcirc: '\u2256',
        eqcolon: '\u2255',
        eqsim: '\u2242',
        eqslantgtr: '\u2A96',
        eqslantless: '\u2A95',
        Equal: '\u2A75',
        equals: '=',
        EqualTilde: '\u2242',
        equest: '\u225F',
        Equilibrium: '\u21CC',
        equiv: '\u2261',
        equivDD: '\u2A78',
        eqvparsl: '\u29E5',
        erarr: '\u2971',
        erDot: '\u2253',
        escr: '\u212F',
        Escr: '\u2130',
        esdot: '\u2250',
        esim: '\u2242',
        Esim: '\u2A73',
        eta: '\u03B7',
        Eta: '\u0397',
        eth: '\xF0',
        ETH: '\xD0',
        euml: '\xEB',
        Euml: '\xCB',
        euro: '\u20AC',
        excl: '!',
        exist: '\u2203',
        Exists: '\u2203',
        expectation: '\u2130',
        exponentiale: '\u2147',
        ExponentialE: '\u2147',
        fallingdotseq: '\u2252',
        fcy: '\u0444',
        Fcy: '\u0424',
        female: '\u2640',
        ffilig: '\uFB03',
        fflig: '\uFB00',
        ffllig: '\uFB04',
        ffr: '\u{1D523}',
        Ffr: '\u{1D509}',
        filig: '\uFB01',
        FilledSmallSquare: '\u25FC',
        FilledVerySmallSquare: '\u25AA',
        fjlig: 'fj',
        flat: '\u266D',
        fllig: '\uFB02',
        fltns: '\u25B1',
        fnof: '\u0192',
        fopf: '\u{1D557}',
        Fopf: '\u{1D53D}',
        forall: '\u2200',
        ForAll: '\u2200',
        fork: '\u22D4',
        forkv: '\u2AD9',
        Fouriertrf: '\u2131',
        fpartint: '\u2A0D',
        frac12: '\xBD',
        frac13: '\u2153',
        frac14: '\xBC',
        frac15: '\u2155',
        frac16: '\u2159',
        frac18: '\u215B',
        frac23: '\u2154',
        frac25: '\u2156',
        frac34: '\xBE',
        frac35: '\u2157',
        frac38: '\u215C',
        frac45: '\u2158',
        frac56: '\u215A',
        frac58: '\u215D',
        frac78: '\u215E',
        frasl: '\u2044',
        frown: '\u2322',
        fscr: '\u{1D4BB}',
        Fscr: '\u2131',
        gacute: '\u01F5',
        gamma: '\u03B3',
        Gamma: '\u0393',
        gammad: '\u03DD',
        Gammad: '\u03DC',
        gap: '\u2A86',
        gbreve: '\u011F',
        Gbreve: '\u011E',
        Gcedil: '\u0122',
        gcirc: '\u011D',
        Gcirc: '\u011C',
        gcy: '\u0433',
        Gcy: '\u0413',
        gdot: '\u0121',
        Gdot: '\u0120',
        ge: '\u2265',
        gE: '\u2267',
        gel: '\u22DB',
        gEl: '\u2A8C',
        geq: '\u2265',
        geqq: '\u2267',
        geqslant: '\u2A7E',
        ges: '\u2A7E',
        gescc: '\u2AA9',
        gesdot: '\u2A80',
        gesdoto: '\u2A82',
        gesdotol: '\u2A84',
        gesl: '\u22DB\uFE00',
        gesles: '\u2A94',
        gfr: '\u{1D524}',
        Gfr: '\u{1D50A}',
        gg: '\u226B',
        Gg: '\u22D9',
        ggg: '\u22D9',
        gimel: '\u2137',
        gjcy: '\u0453',
        GJcy: '\u0403',
        gl: '\u2277',
        gla: '\u2AA5',
        glE: '\u2A92',
        glj: '\u2AA4',
        gnap: '\u2A8A',
        gnapprox: '\u2A8A',
        gne: '\u2A88',
        gnE: '\u2269',
        gneq: '\u2A88',
        gneqq: '\u2269',
        gnsim: '\u22E7',
        gopf: '\u{1D558}',
        Gopf: '\u{1D53E}',
        grave: '`',
        GreaterEqual: '\u2265',
        GreaterEqualLess: '\u22DB',
        GreaterFullEqual: '\u2267',
        GreaterGreater: '\u2AA2',
        GreaterLess: '\u2277',
        GreaterSlantEqual: '\u2A7E',
        GreaterTilde: '\u2273',
        gscr: '\u210A',
        Gscr: '\u{1D4A2}',
        gsim: '\u2273',
        gsime: '\u2A8E',
        gsiml: '\u2A90',
        gt: '>',
        Gt: '\u226B',
        GT: '>',
        gtcc: '\u2AA7',
        gtcir: '\u2A7A',
        gtdot: '\u22D7',
        gtlPar: '\u2995',
        gtquest: '\u2A7C',
        gtrapprox: '\u2A86',
        gtrarr: '\u2978',
        gtrdot: '\u22D7',
        gtreqless: '\u22DB',
        gtreqqless: '\u2A8C',
        gtrless: '\u2277',
        gtrsim: '\u2273',
        gvertneqq: '\u2269\uFE00',
        gvnE: '\u2269\uFE00',
        Hacek: '\u02C7',
        hairsp: '\u200A',
        half: '\xBD',
        hamilt: '\u210B',
        hardcy: '\u044A',
        HARDcy: '\u042A',
        harr: '\u2194',
        hArr: '\u21D4',
        harrcir: '\u2948',
        harrw: '\u21AD',
        Hat: '^',
        hbar: '\u210F',
        hcirc: '\u0125',
        Hcirc: '\u0124',
        hearts: '\u2665',
        heartsuit: '\u2665',
        hellip: '\u2026',
        hercon: '\u22B9',
        hfr: '\u{1D525}',
        Hfr: '\u210C',
        HilbertSpace: '\u210B',
        hksearow: '\u2925',
        hkswarow: '\u2926',
        hoarr: '\u21FF',
        homtht: '\u223B',
        hookleftarrow: '\u21A9',
        hookrightarrow: '\u21AA',
        hopf: '\u{1D559}',
        Hopf: '\u210D',
        horbar: '\u2015',
        HorizontalLine: '\u2500',
        hscr: '\u{1D4BD}',
        Hscr: '\u210B',
        hslash: '\u210F',
        hstrok: '\u0127',
        Hstrok: '\u0126',
        HumpDownHump: '\u224E',
        HumpEqual: '\u224F',
        hybull: '\u2043',
        hyphen: '\u2010',
        iacute: '\xED',
        Iacute: '\xCD',
        ic: '\u2063',
        icirc: '\xEE',
        Icirc: '\xCE',
        icy: '\u0438',
        Icy: '\u0418',
        Idot: '\u0130',
        iecy: '\u0435',
        IEcy: '\u0415',
        iexcl: '\xA1',
        iff: '\u21D4',
        ifr: '\u{1D526}',
        Ifr: '\u2111',
        igrave: '\xEC',
        Igrave: '\xCC',
        ii: '\u2148',
        iiiint: '\u2A0C',
        iiint: '\u222D',
        iinfin: '\u29DC',
        iiota: '\u2129',
        ijlig: '\u0133',
        IJlig: '\u0132',
        Im: '\u2111',
        imacr: '\u012B',
        Imacr: '\u012A',
        image: '\u2111',
        ImaginaryI: '\u2148',
        imagline: '\u2110',
        imagpart: '\u2111',
        imath: '\u0131',
        imof: '\u22B7',
        imped: '\u01B5',
        Implies: '\u21D2',
        in: '\u2208',
        incare: '\u2105',
        infin: '\u221E',
        infintie: '\u29DD',
        inodot: '\u0131',
        int: '\u222B',
        Int: '\u222C',
        intcal: '\u22BA',
        integers: '\u2124',
        Integral: '\u222B',
        intercal: '\u22BA',
        Intersection: '\u22C2',
        intlarhk: '\u2A17',
        intprod: '\u2A3C',
        InvisibleComma: '\u2063',
        InvisibleTimes: '\u2062',
        iocy: '\u0451',
        IOcy: '\u0401',
        iogon: '\u012F',
        Iogon: '\u012E',
        iopf: '\u{1D55A}',
        Iopf: '\u{1D540}',
        iota: '\u03B9',
        Iota: '\u0399',
        iprod: '\u2A3C',
        iquest: '\xBF',
        iscr: '\u{1D4BE}',
        Iscr: '\u2110',
        isin: '\u2208',
        isindot: '\u22F5',
        isinE: '\u22F9',
        isins: '\u22F4',
        isinsv: '\u22F3',
        isinv: '\u2208',
        it: '\u2062',
        itilde: '\u0129',
        Itilde: '\u0128',
        iukcy: '\u0456',
        Iukcy: '\u0406',
        iuml: '\xEF',
        Iuml: '\xCF',
        jcirc: '\u0135',
        Jcirc: '\u0134',
        jcy: '\u0439',
        Jcy: '\u0419',
        jfr: '\u{1D527}',
        Jfr: '\u{1D50D}',
        jmath: '\u0237',
        jopf: '\u{1D55B}',
        Jopf: '\u{1D541}',
        jscr: '\u{1D4BF}',
        Jscr: '\u{1D4A5}',
        jsercy: '\u0458',
        Jsercy: '\u0408',
        jukcy: '\u0454',
        Jukcy: '\u0404',
        kappa: '\u03BA',
        Kappa: '\u039A',
        kappav: '\u03F0',
        kcedil: '\u0137',
        Kcedil: '\u0136',
        kcy: '\u043A',
        Kcy: '\u041A',
        kfr: '\u{1D528}',
        Kfr: '\u{1D50E}',
        kgreen: '\u0138',
        khcy: '\u0445',
        KHcy: '\u0425',
        kjcy: '\u045C',
        KJcy: '\u040C',
        kopf: '\u{1D55C}',
        Kopf: '\u{1D542}',
        kscr: '\u{1D4C0}',
        Kscr: '\u{1D4A6}',
        lAarr: '\u21DA',
        lacute: '\u013A',
        Lacute: '\u0139',
        laemptyv: '\u29B4',
        lagran: '\u2112',
        lambda: '\u03BB',
        Lambda: '\u039B',
        lang: '\u27E8',
        Lang: '\u27EA',
        langd: '\u2991',
        langle: '\u27E8',
        lap: '\u2A85',
        Laplacetrf: '\u2112',
        laquo: '\xAB',
        larr: '\u2190',
        lArr: '\u21D0',
        Larr: '\u219E',
        larrb: '\u21E4',
        larrbfs: '\u291F',
        larrfs: '\u291D',
        larrhk: '\u21A9',
        larrlp: '\u21AB',
        larrpl: '\u2939',
        larrsim: '\u2973',
        larrtl: '\u21A2',
        lat: '\u2AAB',
        latail: '\u2919',
        lAtail: '\u291B',
        late: '\u2AAD',
        lates: '\u2AAD\uFE00',
        lbarr: '\u290C',
        lBarr: '\u290E',
        lbbrk: '\u2772',
        lbrace: '{',
        lbrack: '[',
        lbrke: '\u298B',
        lbrksld: '\u298F',
        lbrkslu: '\u298D',
        lcaron: '\u013E',
        Lcaron: '\u013D',
        lcedil: '\u013C',
        Lcedil: '\u013B',
        lceil: '\u2308',
        lcub: '{',
        lcy: '\u043B',
        Lcy: '\u041B',
        ldca: '\u2936',
        ldquo: '\u201C',
        ldquor: '\u201E',
        ldrdhar: '\u2967',
        ldrushar: '\u294B',
        ldsh: '\u21B2',
        le: '\u2264',
        lE: '\u2266',
        LeftAngleBracket: '\u27E8',
        leftarrow: '\u2190',
        Leftarrow: '\u21D0',
        LeftArrow: '\u2190',
        LeftArrowBar: '\u21E4',
        LeftArrowRightArrow: '\u21C6',
        leftarrowtail: '\u21A2',
        LeftCeiling: '\u2308',
        LeftDoubleBracket: '\u27E6',
        LeftDownTeeVector: '\u2961',
        LeftDownVector: '\u21C3',
        LeftDownVectorBar: '\u2959',
        LeftFloor: '\u230A',
        leftharpoondown: '\u21BD',
        leftharpoonup: '\u21BC',
        leftleftarrows: '\u21C7',
        leftrightarrow: '\u2194',
        Leftrightarrow: '\u21D4',
        LeftRightArrow: '\u2194',
        leftrightarrows: '\u21C6',
        leftrightharpoons: '\u21CB',
        leftrightsquigarrow: '\u21AD',
        LeftRightVector: '\u294E',
        LeftTee: '\u22A3',
        LeftTeeArrow: '\u21A4',
        LeftTeeVector: '\u295A',
        leftthreetimes: '\u22CB',
        LeftTriangle: '\u22B2',
        LeftTriangleBar: '\u29CF',
        LeftTriangleEqual: '\u22B4',
        LeftUpDownVector: '\u2951',
        LeftUpTeeVector: '\u2960',
        LeftUpVector: '\u21BF',
        LeftUpVectorBar: '\u2958',
        LeftVector: '\u21BC',
        LeftVectorBar: '\u2952',
        leg: '\u22DA',
        lEg: '\u2A8B',
        leq: '\u2264',
        leqq: '\u2266',
        leqslant: '\u2A7D',
        les: '\u2A7D',
        lescc: '\u2AA8',
        lesdot: '\u2A7F',
        lesdoto: '\u2A81',
        lesdotor: '\u2A83',
        lesg: '\u22DA\uFE00',
        lesges: '\u2A93',
        lessapprox: '\u2A85',
        lessdot: '\u22D6',
        lesseqgtr: '\u22DA',
        lesseqqgtr: '\u2A8B',
        LessEqualGreater: '\u22DA',
        LessFullEqual: '\u2266',
        LessGreater: '\u2276',
        lessgtr: '\u2276',
        LessLess: '\u2AA1',
        lesssim: '\u2272',
        LessSlantEqual: '\u2A7D',
        LessTilde: '\u2272',
        lfisht: '\u297C',
        lfloor: '\u230A',
        lfr: '\u{1D529}',
        Lfr: '\u{1D50F}',
        lg: '\u2276',
        lgE: '\u2A91',
        lHar: '\u2962',
        lhard: '\u21BD',
        lharu: '\u21BC',
        lharul: '\u296A',
        lhblk: '\u2584',
        ljcy: '\u0459',
        LJcy: '\u0409',
        ll: '\u226A',
        Ll: '\u22D8',
        llarr: '\u21C7',
        llcorner: '\u231E',
        Lleftarrow: '\u21DA',
        llhard: '\u296B',
        lltri: '\u25FA',
        lmidot: '\u0140',
        Lmidot: '\u013F',
        lmoust: '\u23B0',
        lmoustache: '\u23B0',
        lnap: '\u2A89',
        lnapprox: '\u2A89',
        lne: '\u2A87',
        lnE: '\u2268',
        lneq: '\u2A87',
        lneqq: '\u2268',
        lnsim: '\u22E6',
        loang: '\u27EC',
        loarr: '\u21FD',
        lobrk: '\u27E6',
        longleftarrow: '\u27F5',
        Longleftarrow: '\u27F8',
        LongLeftArrow: '\u27F5',
        longleftrightarrow: '\u27F7',
        Longleftrightarrow: '\u27FA',
        LongLeftRightArrow: '\u27F7',
        longmapsto: '\u27FC',
        longrightarrow: '\u27F6',
        Longrightarrow: '\u27F9',
        LongRightArrow: '\u27F6',
        looparrowleft: '\u21AB',
        looparrowright: '\u21AC',
        lopar: '\u2985',
        lopf: '\u{1D55D}',
        Lopf: '\u{1D543}',
        loplus: '\u2A2D',
        lotimes: '\u2A34',
        lowast: '\u2217',
        lowbar: '_',
        LowerLeftArrow: '\u2199',
        LowerRightArrow: '\u2198',
        loz: '\u25CA',
        lozenge: '\u25CA',
        lozf: '\u29EB',
        lpar: '(',
        lparlt: '\u2993',
        lrarr: '\u21C6',
        lrcorner: '\u231F',
        lrhar: '\u21CB',
        lrhard: '\u296D',
        lrm: '\u200E',
        lrtri: '\u22BF',
        lsaquo: '\u2039',
        lscr: '\u{1D4C1}',
        Lscr: '\u2112',
        lsh: '\u21B0',
        Lsh: '\u21B0',
        lsim: '\u2272',
        lsime: '\u2A8D',
        lsimg: '\u2A8F',
        lsqb: '[',
        lsquo: '\u2018',
        lsquor: '\u201A',
        lstrok: '\u0142',
        Lstrok: '\u0141',
        lt: '<',
        Lt: '\u226A',
        LT: '<',
        ltcc: '\u2AA6',
        ltcir: '\u2A79',
        ltdot: '\u22D6',
        lthree: '\u22CB',
        ltimes: '\u22C9',
        ltlarr: '\u2976',
        ltquest: '\u2A7B',
        ltri: '\u25C3',
        ltrie: '\u22B4',
        ltrif: '\u25C2',
        ltrPar: '\u2996',
        lurdshar: '\u294A',
        luruhar: '\u2966',
        lvertneqq: '\u2268\uFE00',
        lvnE: '\u2268\uFE00',
        macr: '\xAF',
        male: '\u2642',
        malt: '\u2720',
        maltese: '\u2720',
        map: '\u21A6',
        Map: '\u2905',
        mapsto: '\u21A6',
        mapstodown: '\u21A7',
        mapstoleft: '\u21A4',
        mapstoup: '\u21A5',
        marker: '\u25AE',
        mcomma: '\u2A29',
        mcy: '\u043C',
        Mcy: '\u041C',
        mdash: '\u2014',
        mDDot: '\u223A',
        measuredangle: '\u2221',
        MediumSpace: '\u205F',
        Mellintrf: '\u2133',
        mfr: '\u{1D52A}',
        Mfr: '\u{1D510}',
        mho: '\u2127',
        micro: '\xB5',
        mid: '\u2223',
        midast: '*',
        midcir: '\u2AF0',
        middot: '\xB7',
        minus: '\u2212',
        minusb: '\u229F',
        minusd: '\u2238',
        minusdu: '\u2A2A',
        MinusPlus: '\u2213',
        mlcp: '\u2ADB',
        mldr: '\u2026',
        mnplus: '\u2213',
        models: '\u22A7',
        mopf: '\u{1D55E}',
        Mopf: '\u{1D544}',
        mp: '\u2213',
        mscr: '\u{1D4C2}',
        Mscr: '\u2133',
        mstpos: '\u223E',
        mu: '\u03BC',
        Mu: '\u039C',
        multimap: '\u22B8',
        mumap: '\u22B8',
        nabla: '\u2207',
        nacute: '\u0144',
        Nacute: '\u0143',
        nang: '\u2220\u20D2',
        nap: '\u2249',
        napE: '\u2A70\u0338',
        napid: '\u224B\u0338',
        napos: '\u0149',
        napprox: '\u2249',
        natur: '\u266E',
        natural: '\u266E',
        naturals: '\u2115',
        nbsp: '\xA0',
        nbump: '\u224E\u0338',
        nbumpe: '\u224F\u0338',
        ncap: '\u2A43',
        ncaron: '\u0148',
        Ncaron: '\u0147',
        ncedil: '\u0146',
        Ncedil: '\u0145',
        ncong: '\u2247',
        ncongdot: '\u2A6D\u0338',
        ncup: '\u2A42',
        ncy: '\u043D',
        Ncy: '\u041D',
        ndash: '\u2013',
        ne: '\u2260',
        nearhk: '\u2924',
        nearr: '\u2197',
        neArr: '\u21D7',
        nearrow: '\u2197',
        nedot: '\u2250\u0338',
        NegativeMediumSpace: '\u200B',
        NegativeThickSpace: '\u200B',
        NegativeThinSpace: '\u200B',
        NegativeVeryThinSpace: '\u200B',
        nequiv: '\u2262',
        nesear: '\u2928',
        nesim: '\u2242\u0338',
        NestedGreaterGreater: '\u226B',
        NestedLessLess: '\u226A',
        NewLine: '\n',
        nexist: '\u2204',
        nexists: '\u2204',
        nfr: '\u{1D52B}',
        Nfr: '\u{1D511}',
        nge: '\u2271',
        ngE: '\u2267\u0338',
        ngeq: '\u2271',
        ngeqq: '\u2267\u0338',
        ngeqslant: '\u2A7E\u0338',
        nges: '\u2A7E\u0338',
        nGg: '\u22D9\u0338',
        ngsim: '\u2275',
        ngt: '\u226F',
        nGt: '\u226B\u20D2',
        ngtr: '\u226F',
        nGtv: '\u226B\u0338',
        nharr: '\u21AE',
        nhArr: '\u21CE',
        nhpar: '\u2AF2',
        ni: '\u220B',
        nis: '\u22FC',
        nisd: '\u22FA',
        niv: '\u220B',
        njcy: '\u045A',
        NJcy: '\u040A',
        nlarr: '\u219A',
        nlArr: '\u21CD',
        nldr: '\u2025',
        nle: '\u2270',
        nlE: '\u2266\u0338',
        nleftarrow: '\u219A',
        nLeftarrow: '\u21CD',
        nleftrightarrow: '\u21AE',
        nLeftrightarrow: '\u21CE',
        nleq: '\u2270',
        nleqq: '\u2266\u0338',
        nleqslant: '\u2A7D\u0338',
        nles: '\u2A7D\u0338',
        nless: '\u226E',
        nLl: '\u22D8\u0338',
        nlsim: '\u2274',
        nlt: '\u226E',
        nLt: '\u226A\u20D2',
        nltri: '\u22EA',
        nltrie: '\u22EC',
        nLtv: '\u226A\u0338',
        nmid: '\u2224',
        NoBreak: '\u2060',
        NonBreakingSpace: '\xA0',
        nopf: '\u{1D55F}',
        Nopf: '\u2115',
        not: '\xAC',
        Not: '\u2AEC',
        NotCongruent: '\u2262',
        NotCupCap: '\u226D',
        NotDoubleVerticalBar: '\u2226',
        NotElement: '\u2209',
        NotEqual: '\u2260',
        NotEqualTilde: '\u2242\u0338',
        NotExists: '\u2204',
        NotGreater: '\u226F',
        NotGreaterEqual: '\u2271',
        NotGreaterFullEqual: '\u2267\u0338',
        NotGreaterGreater: '\u226B\u0338',
        NotGreaterLess: '\u2279',
        NotGreaterSlantEqual: '\u2A7E\u0338',
        NotGreaterTilde: '\u2275',
        NotHumpDownHump: '\u224E\u0338',
        NotHumpEqual: '\u224F\u0338',
        notin: '\u2209',
        notindot: '\u22F5\u0338',
        notinE: '\u22F9\u0338',
        notinva: '\u2209',
        notinvb: '\u22F7',
        notinvc: '\u22F6',
        NotLeftTriangle: '\u22EA',
        NotLeftTriangleBar: '\u29CF\u0338',
        NotLeftTriangleEqual: '\u22EC',
        NotLess: '\u226E',
        NotLessEqual: '\u2270',
        NotLessGreater: '\u2278',
        NotLessLess: '\u226A\u0338',
        NotLessSlantEqual: '\u2A7D\u0338',
        NotLessTilde: '\u2274',
        NotNestedGreaterGreater: '\u2AA2\u0338',
        NotNestedLessLess: '\u2AA1\u0338',
        notni: '\u220C',
        notniva: '\u220C',
        notnivb: '\u22FE',
        notnivc: '\u22FD',
        NotPrecedes: '\u2280',
        NotPrecedesEqual: '\u2AAF\u0338',
        NotPrecedesSlantEqual: '\u22E0',
        NotReverseElement: '\u220C',
        NotRightTriangle: '\u22EB',
        NotRightTriangleBar: '\u29D0\u0338',
        NotRightTriangleEqual: '\u22ED',
        NotSquareSubset: '\u228F\u0338',
        NotSquareSubsetEqual: '\u22E2',
        NotSquareSuperset: '\u2290\u0338',
        NotSquareSupersetEqual: '\u22E3',
        NotSubset: '\u2282\u20D2',
        NotSubsetEqual: '\u2288',
        NotSucceeds: '\u2281',
        NotSucceedsEqual: '\u2AB0\u0338',
        NotSucceedsSlantEqual: '\u22E1',
        NotSucceedsTilde: '\u227F\u0338',
        NotSuperset: '\u2283\u20D2',
        NotSupersetEqual: '\u2289',
        NotTilde: '\u2241',
        NotTildeEqual: '\u2244',
        NotTildeFullEqual: '\u2247',
        NotTildeTilde: '\u2249',
        NotVerticalBar: '\u2224',
        npar: '\u2226',
        nparallel: '\u2226',
        nparsl: '\u2AFD\u20E5',
        npart: '\u2202\u0338',
        npolint: '\u2A14',
        npr: '\u2280',
        nprcue: '\u22E0',
        npre: '\u2AAF\u0338',
        nprec: '\u2280',
        npreceq: '\u2AAF\u0338',
        nrarr: '\u219B',
        nrArr: '\u21CF',
        nrarrc: '\u2933\u0338',
        nrarrw: '\u219D\u0338',
        nrightarrow: '\u219B',
        nRightarrow: '\u21CF',
        nrtri: '\u22EB',
        nrtrie: '\u22ED',
        nsc: '\u2281',
        nsccue: '\u22E1',
        nsce: '\u2AB0\u0338',
        nscr: '\u{1D4C3}',
        Nscr: '\u{1D4A9}',
        nshortmid: '\u2224',
        nshortparallel: '\u2226',
        nsim: '\u2241',
        nsime: '\u2244',
        nsimeq: '\u2244',
        nsmid: '\u2224',
        nspar: '\u2226',
        nsqsube: '\u22E2',
        nsqsupe: '\u22E3',
        nsub: '\u2284',
        nsube: '\u2288',
        nsubE: '\u2AC5\u0338',
        nsubset: '\u2282\u20D2',
        nsubseteq: '\u2288',
        nsubseteqq: '\u2AC5\u0338',
        nsucc: '\u2281',
        nsucceq: '\u2AB0\u0338',
        nsup: '\u2285',
        nsupe: '\u2289',
        nsupE: '\u2AC6\u0338',
        nsupset: '\u2283\u20D2',
        nsupseteq: '\u2289',
        nsupseteqq: '\u2AC6\u0338',
        ntgl: '\u2279',
        ntilde: '\xF1',
        Ntilde: '\xD1',
        ntlg: '\u2278',
        ntriangleleft: '\u22EA',
        ntrianglelefteq: '\u22EC',
        ntriangleright: '\u22EB',
        ntrianglerighteq: '\u22ED',
        nu: '\u03BD',
        Nu: '\u039D',
        num: '#',
        numero: '\u2116',
        numsp: '\u2007',
        nvap: '\u224D\u20D2',
        nvdash: '\u22AC',
        nvDash: '\u22AD',
        nVdash: '\u22AE',
        nVDash: '\u22AF',
        nvge: '\u2265\u20D2',
        nvgt: '>\u20D2',
        nvHarr: '\u2904',
        nvinfin: '\u29DE',
        nvlArr: '\u2902',
        nvle: '\u2264\u20D2',
        nvlt: '<\u20D2',
        nvltrie: '\u22B4\u20D2',
        nvrArr: '\u2903',
        nvrtrie: '\u22B5\u20D2',
        nvsim: '\u223C\u20D2',
        nwarhk: '\u2923',
        nwarr: '\u2196',
        nwArr: '\u21D6',
        nwarrow: '\u2196',
        nwnear: '\u2927',
        oacute: '\xF3',
        Oacute: '\xD3',
        oast: '\u229B',
        ocir: '\u229A',
        ocirc: '\xF4',
        Ocirc: '\xD4',
        ocy: '\u043E',
        Ocy: '\u041E',
        odash: '\u229D',
        odblac: '\u0151',
        Odblac: '\u0150',
        odiv: '\u2A38',
        odot: '\u2299',
        odsold: '\u29BC',
        oelig: '\u0153',
        OElig: '\u0152',
        ofcir: '\u29BF',
        ofr: '\u{1D52C}',
        Ofr: '\u{1D512}',
        ogon: '\u02DB',
        ograve: '\xF2',
        Ograve: '\xD2',
        ogt: '\u29C1',
        ohbar: '\u29B5',
        ohm: '\u03A9',
        oint: '\u222E',
        olarr: '\u21BA',
        olcir: '\u29BE',
        olcross: '\u29BB',
        oline: '\u203E',
        olt: '\u29C0',
        omacr: '\u014D',
        Omacr: '\u014C',
        omega: '\u03C9',
        Omega: '\u03A9',
        omicron: '\u03BF',
        Omicron: '\u039F',
        omid: '\u29B6',
        ominus: '\u2296',
        oopf: '\u{1D560}',
        Oopf: '\u{1D546}',
        opar: '\u29B7',
        OpenCurlyDoubleQuote: '\u201C',
        OpenCurlyQuote: '\u2018',
        operp: '\u29B9',
        oplus: '\u2295',
        or: '\u2228',
        Or: '\u2A54',
        orarr: '\u21BB',
        ord: '\u2A5D',
        order: '\u2134',
        orderof: '\u2134',
        ordf: '\xAA',
        ordm: '\xBA',
        origof: '\u22B6',
        oror: '\u2A56',
        orslope: '\u2A57',
        orv: '\u2A5B',
        oS: '\u24C8',
        oscr: '\u2134',
        Oscr: '\u{1D4AA}',
        oslash: '\xF8',
        Oslash: '\xD8',
        osol: '\u2298',
        otilde: '\xF5',
        Otilde: '\xD5',
        otimes: '\u2297',
        Otimes: '\u2A37',
        otimesas: '\u2A36',
        ouml: '\xF6',
        Ouml: '\xD6',
        ovbar: '\u233D',
        OverBar: '\u203E',
        OverBrace: '\u23DE',
        OverBracket: '\u23B4',
        OverParenthesis: '\u23DC',
        par: '\u2225',
        para: '\xB6',
        parallel: '\u2225',
        parsim: '\u2AF3',
        parsl: '\u2AFD',
        part: '\u2202',
        PartialD: '\u2202',
        pcy: '\u043F',
        Pcy: '\u041F',
        percnt: '%',
        period: '.',
        permil: '\u2030',
        perp: '\u22A5',
        pertenk: '\u2031',
        pfr: '\u{1D52D}',
        Pfr: '\u{1D513}',
        phi: '\u03C6',
        Phi: '\u03A6',
        phiv: '\u03D5',
        phmmat: '\u2133',
        phone: '\u260E',
        pi: '\u03C0',
        Pi: '\u03A0',
        pitchfork: '\u22D4',
        piv: '\u03D6',
        planck: '\u210F',
        planckh: '\u210E',
        plankv: '\u210F',
        plus: '+',
        plusacir: '\u2A23',
        plusb: '\u229E',
        pluscir: '\u2A22',
        plusdo: '\u2214',
        plusdu: '\u2A25',
        pluse: '\u2A72',
        PlusMinus: '\xB1',
        plusmn: '\xB1',
        plussim: '\u2A26',
        plustwo: '\u2A27',
        pm: '\xB1',
        Poincareplane: '\u210C',
        pointint: '\u2A15',
        popf: '\u{1D561}',
        Popf: '\u2119',
        pound: '\xA3',
        pr: '\u227A',
        Pr: '\u2ABB',
        prap: '\u2AB7',
        prcue: '\u227C',
        pre: '\u2AAF',
        prE: '\u2AB3',
        prec: '\u227A',
        precapprox: '\u2AB7',
        preccurlyeq: '\u227C',
        Precedes: '\u227A',
        PrecedesEqual: '\u2AAF',
        PrecedesSlantEqual: '\u227C',
        PrecedesTilde: '\u227E',
        preceq: '\u2AAF',
        precnapprox: '\u2AB9',
        precneqq: '\u2AB5',
        precnsim: '\u22E8',
        precsim: '\u227E',
        prime: '\u2032',
        Prime: '\u2033',
        primes: '\u2119',
        prnap: '\u2AB9',
        prnE: '\u2AB5',
        prnsim: '\u22E8',
        prod: '\u220F',
        Product: '\u220F',
        profalar: '\u232E',
        profline: '\u2312',
        profsurf: '\u2313',
        prop: '\u221D',
        Proportion: '\u2237',
        Proportional: '\u221D',
        propto: '\u221D',
        prsim: '\u227E',
        prurel: '\u22B0',
        pscr: '\u{1D4C5}',
        Pscr: '\u{1D4AB}',
        psi: '\u03C8',
        Psi: '\u03A8',
        puncsp: '\u2008',
        qfr: '\u{1D52E}',
        Qfr: '\u{1D514}',
        qint: '\u2A0C',
        qopf: '\u{1D562}',
        Qopf: '\u211A',
        qprime: '\u2057',
        qscr: '\u{1D4C6}',
        Qscr: '\u{1D4AC}',
        quaternions: '\u210D',
        quatint: '\u2A16',
        quest: '?',
        questeq: '\u225F',
        quot: '"',
        QUOT: '"',
        rAarr: '\u21DB',
        race: '\u223D\u0331',
        racute: '\u0155',
        Racute: '\u0154',
        radic: '\u221A',
        raemptyv: '\u29B3',
        rang: '\u27E9',
        Rang: '\u27EB',
        rangd: '\u2992',
        range: '\u29A5',
        rangle: '\u27E9',
        raquo: '\xBB',
        rarr: '\u2192',
        rArr: '\u21D2',
        Rarr: '\u21A0',
        rarrap: '\u2975',
        rarrb: '\u21E5',
        rarrbfs: '\u2920',
        rarrc: '\u2933',
        rarrfs: '\u291E',
        rarrhk: '\u21AA',
        rarrlp: '\u21AC',
        rarrpl: '\u2945',
        rarrsim: '\u2974',
        rarrtl: '\u21A3',
        Rarrtl: '\u2916',
        rarrw: '\u219D',
        ratail: '\u291A',
        rAtail: '\u291C',
        ratio: '\u2236',
        rationals: '\u211A',
        rbarr: '\u290D',
        rBarr: '\u290F',
        RBarr: '\u2910',
        rbbrk: '\u2773',
        rbrace: '}',
        rbrack: ']',
        rbrke: '\u298C',
        rbrksld: '\u298E',
        rbrkslu: '\u2990',
        rcaron: '\u0159',
        Rcaron: '\u0158',
        rcedil: '\u0157',
        Rcedil: '\u0156',
        rceil: '\u2309',
        rcub: '}',
        rcy: '\u0440',
        Rcy: '\u0420',
        rdca: '\u2937',
        rdldhar: '\u2969',
        rdquo: '\u201D',
        rdquor: '\u201D',
        rdsh: '\u21B3',
        Re: '\u211C',
        real: '\u211C',
        realine: '\u211B',
        realpart: '\u211C',
        reals: '\u211D',
        rect: '\u25AD',
        reg: '\xAE',
        REG: '\xAE',
        ReverseElement: '\u220B',
        ReverseEquilibrium: '\u21CB',
        ReverseUpEquilibrium: '\u296F',
        rfisht: '\u297D',
        rfloor: '\u230B',
        rfr: '\u{1D52F}',
        Rfr: '\u211C',
        rHar: '\u2964',
        rhard: '\u21C1',
        rharu: '\u21C0',
        rharul: '\u296C',
        rho: '\u03C1',
        Rho: '\u03A1',
        rhov: '\u03F1',
        RightAngleBracket: '\u27E9',
        rightarrow: '\u2192',
        Rightarrow: '\u21D2',
        RightArrow: '\u2192',
        RightArrowBar: '\u21E5',
        RightArrowLeftArrow: '\u21C4',
        rightarrowtail: '\u21A3',
        RightCeiling: '\u2309',
        RightDoubleBracket: '\u27E7',
        RightDownTeeVector: '\u295D',
        RightDownVector: '\u21C2',
        RightDownVectorBar: '\u2955',
        RightFloor: '\u230B',
        rightharpoondown: '\u21C1',
        rightharpoonup: '\u21C0',
        rightleftarrows: '\u21C4',
        rightleftharpoons: '\u21CC',
        rightrightarrows: '\u21C9',
        rightsquigarrow: '\u219D',
        RightTee: '\u22A2',
        RightTeeArrow: '\u21A6',
        RightTeeVector: '\u295B',
        rightthreetimes: '\u22CC',
        RightTriangle: '\u22B3',
        RightTriangleBar: '\u29D0',
        RightTriangleEqual: '\u22B5',
        RightUpDownVector: '\u294F',
        RightUpTeeVector: '\u295C',
        RightUpVector: '\u21BE',
        RightUpVectorBar: '\u2954',
        RightVector: '\u21C0',
        RightVectorBar: '\u2953',
        ring: '\u02DA',
        risingdotseq: '\u2253',
        rlarr: '\u21C4',
        rlhar: '\u21CC',
        rlm: '\u200F',
        rmoust: '\u23B1',
        rmoustache: '\u23B1',
        rnmid: '\u2AEE',
        roang: '\u27ED',
        roarr: '\u21FE',
        robrk: '\u27E7',
        ropar: '\u2986',
        ropf: '\u{1D563}',
        Ropf: '\u211D',
        roplus: '\u2A2E',
        rotimes: '\u2A35',
        RoundImplies: '\u2970',
        rpar: ')',
        rpargt: '\u2994',
        rppolint: '\u2A12',
        rrarr: '\u21C9',
        Rrightarrow: '\u21DB',
        rsaquo: '\u203A',
        rscr: '\u{1D4C7}',
        Rscr: '\u211B',
        rsh: '\u21B1',
        Rsh: '\u21B1',
        rsqb: ']',
        rsquo: '\u2019',
        rsquor: '\u2019',
        rthree: '\u22CC',
        rtimes: '\u22CA',
        rtri: '\u25B9',
        rtrie: '\u22B5',
        rtrif: '\u25B8',
        rtriltri: '\u29CE',
        RuleDelayed: '\u29F4',
        ruluhar: '\u2968',
        rx: '\u211E',
        sacute: '\u015B',
        Sacute: '\u015A',
        sbquo: '\u201A',
        sc: '\u227B',
        Sc: '\u2ABC',
        scap: '\u2AB8',
        scaron: '\u0161',
        Scaron: '\u0160',
        sccue: '\u227D',
        sce: '\u2AB0',
        scE: '\u2AB4',
        scedil: '\u015F',
        Scedil: '\u015E',
        scirc: '\u015D',
        Scirc: '\u015C',
        scnap: '\u2ABA',
        scnE: '\u2AB6',
        scnsim: '\u22E9',
        scpolint: '\u2A13',
        scsim: '\u227F',
        scy: '\u0441',
        Scy: '\u0421',
        sdot: '\u22C5',
        sdotb: '\u22A1',
        sdote: '\u2A66',
        searhk: '\u2925',
        searr: '\u2198',
        seArr: '\u21D8',
        searrow: '\u2198',
        sect: '\xA7',
        semi: ';',
        seswar: '\u2929',
        setminus: '\u2216',
        setmn: '\u2216',
        sext: '\u2736',
        sfr: '\u{1D530}',
        Sfr: '\u{1D516}',
        sfrown: '\u2322',
        sharp: '\u266F',
        shchcy: '\u0449',
        SHCHcy: '\u0429',
        shcy: '\u0448',
        SHcy: '\u0428',
        ShortDownArrow: '\u2193',
        ShortLeftArrow: '\u2190',
        shortmid: '\u2223',
        shortparallel: '\u2225',
        ShortRightArrow: '\u2192',
        ShortUpArrow: '\u2191',
        shy: '\xAD',
        sigma: '\u03C3',
        Sigma: '\u03A3',
        sigmaf: '\u03C2',
        sigmav: '\u03C2',
        sim: '\u223C',
        simdot: '\u2A6A',
        sime: '\u2243',
        simeq: '\u2243',
        simg: '\u2A9E',
        simgE: '\u2AA0',
        siml: '\u2A9D',
        simlE: '\u2A9F',
        simne: '\u2246',
        simplus: '\u2A24',
        simrarr: '\u2972',
        slarr: '\u2190',
        SmallCircle: '\u2218',
        smallsetminus: '\u2216',
        smashp: '\u2A33',
        smeparsl: '\u29E4',
        smid: '\u2223',
        smile: '\u2323',
        smt: '\u2AAA',
        smte: '\u2AAC',
        smtes: '\u2AAC\uFE00',
        softcy: '\u044C',
        SOFTcy: '\u042C',
        sol: '/',
        solb: '\u29C4',
        solbar: '\u233F',
        sopf: '\u{1D564}',
        Sopf: '\u{1D54A}',
        spades: '\u2660',
        spadesuit: '\u2660',
        spar: '\u2225',
        sqcap: '\u2293',
        sqcaps: '\u2293\uFE00',
        sqcup: '\u2294',
        sqcups: '\u2294\uFE00',
        Sqrt: '\u221A',
        sqsub: '\u228F',
        sqsube: '\u2291',
        sqsubset: '\u228F',
        sqsubseteq: '\u2291',
        sqsup: '\u2290',
        sqsupe: '\u2292',
        sqsupset: '\u2290',
        sqsupseteq: '\u2292',
        squ: '\u25A1',
        square: '\u25A1',
        Square: '\u25A1',
        SquareIntersection: '\u2293',
        SquareSubset: '\u228F',
        SquareSubsetEqual: '\u2291',
        SquareSuperset: '\u2290',
        SquareSupersetEqual: '\u2292',
        SquareUnion: '\u2294',
        squarf: '\u25AA',
        squf: '\u25AA',
        srarr: '\u2192',
        sscr: '\u{1D4C8}',
        Sscr: '\u{1D4AE}',
        ssetmn: '\u2216',
        ssmile: '\u2323',
        sstarf: '\u22C6',
        star: '\u2606',
        Star: '\u22C6',
        starf: '\u2605',
        straightepsilon: '\u03F5',
        straightphi: '\u03D5',
        strns: '\xAF',
        sub: '\u2282',
        Sub: '\u22D0',
        subdot: '\u2ABD',
        sube: '\u2286',
        subE: '\u2AC5',
        subedot: '\u2AC3',
        submult: '\u2AC1',
        subne: '\u228A',
        subnE: '\u2ACB',
        subplus: '\u2ABF',
        subrarr: '\u2979',
        subset: '\u2282',
        Subset: '\u22D0',
        subseteq: '\u2286',
        subseteqq: '\u2AC5',
        SubsetEqual: '\u2286',
        subsetneq: '\u228A',
        subsetneqq: '\u2ACB',
        subsim: '\u2AC7',
        subsub: '\u2AD5',
        subsup: '\u2AD3',
        succ: '\u227B',
        succapprox: '\u2AB8',
        succcurlyeq: '\u227D',
        Succeeds: '\u227B',
        SucceedsEqual: '\u2AB0',
        SucceedsSlantEqual: '\u227D',
        SucceedsTilde: '\u227F',
        succeq: '\u2AB0',
        succnapprox: '\u2ABA',
        succneqq: '\u2AB6',
        succnsim: '\u22E9',
        succsim: '\u227F',
        SuchThat: '\u220B',
        sum: '\u2211',
        Sum: '\u2211',
        sung: '\u266A',
        sup: '\u2283',
        Sup: '\u22D1',
        sup1: '\xB9',
        sup2: '\xB2',
        sup3: '\xB3',
        supdot: '\u2ABE',
        supdsub: '\u2AD8',
        supe: '\u2287',
        supE: '\u2AC6',
        supedot: '\u2AC4',
        Superset: '\u2283',
        SupersetEqual: '\u2287',
        suphsol: '\u27C9',
        suphsub: '\u2AD7',
        suplarr: '\u297B',
        supmult: '\u2AC2',
        supne: '\u228B',
        supnE: '\u2ACC',
        supplus: '\u2AC0',
        supset: '\u2283',
        Supset: '\u22D1',
        supseteq: '\u2287',
        supseteqq: '\u2AC6',
        supsetneq: '\u228B',
        supsetneqq: '\u2ACC',
        supsim: '\u2AC8',
        supsub: '\u2AD4',
        supsup: '\u2AD6',
        swarhk: '\u2926',
        swarr: '\u2199',
        swArr: '\u21D9',
        swarrow: '\u2199',
        swnwar: '\u292A',
        szlig: '\xDF',
        Tab: '	',
        target: '\u2316',
        tau: '\u03C4',
        Tau: '\u03A4',
        tbrk: '\u23B4',
        tcaron: '\u0165',
        Tcaron: '\u0164',
        tcedil: '\u0163',
        Tcedil: '\u0162',
        tcy: '\u0442',
        Tcy: '\u0422',
        tdot: '\u20DB',
        telrec: '\u2315',
        tfr: '\u{1D531}',
        Tfr: '\u{1D517}',
        there4: '\u2234',
        therefore: '\u2234',
        Therefore: '\u2234',
        theta: '\u03B8',
        Theta: '\u0398',
        thetasym: '\u03D1',
        thetav: '\u03D1',
        thickapprox: '\u2248',
        thicksim: '\u223C',
        ThickSpace: '\u205F\u200A',
        thinsp: '\u2009',
        ThinSpace: '\u2009',
        thkap: '\u2248',
        thksim: '\u223C',
        thorn: '\xFE',
        THORN: '\xDE',
        tilde: '\u02DC',
        Tilde: '\u223C',
        TildeEqual: '\u2243',
        TildeFullEqual: '\u2245',
        TildeTilde: '\u2248',
        times: '\xD7',
        timesb: '\u22A0',
        timesbar: '\u2A31',
        timesd: '\u2A30',
        tint: '\u222D',
        toea: '\u2928',
        top: '\u22A4',
        topbot: '\u2336',
        topcir: '\u2AF1',
        topf: '\u{1D565}',
        Topf: '\u{1D54B}',
        topfork: '\u2ADA',
        tosa: '\u2929',
        tprime: '\u2034',
        trade: '\u2122',
        TRADE: '\u2122',
        triangle: '\u25B5',
        triangledown: '\u25BF',
        triangleleft: '\u25C3',
        trianglelefteq: '\u22B4',
        triangleq: '\u225C',
        triangleright: '\u25B9',
        trianglerighteq: '\u22B5',
        tridot: '\u25EC',
        trie: '\u225C',
        triminus: '\u2A3A',
        TripleDot: '\u20DB',
        triplus: '\u2A39',
        trisb: '\u29CD',
        tritime: '\u2A3B',
        trpezium: '\u23E2',
        tscr: '\u{1D4C9}',
        Tscr: '\u{1D4AF}',
        tscy: '\u0446',
        TScy: '\u0426',
        tshcy: '\u045B',
        TSHcy: '\u040B',
        tstrok: '\u0167',
        Tstrok: '\u0166',
        twixt: '\u226C',
        twoheadleftarrow: '\u219E',
        twoheadrightarrow: '\u21A0',
        uacute: '\xFA',
        Uacute: '\xDA',
        uarr: '\u2191',
        uArr: '\u21D1',
        Uarr: '\u219F',
        Uarrocir: '\u2949',
        ubrcy: '\u045E',
        Ubrcy: '\u040E',
        ubreve: '\u016D',
        Ubreve: '\u016C',
        ucirc: '\xFB',
        Ucirc: '\xDB',
        ucy: '\u0443',
        Ucy: '\u0423',
        udarr: '\u21C5',
        udblac: '\u0171',
        Udblac: '\u0170',
        udhar: '\u296E',
        ufisht: '\u297E',
        ufr: '\u{1D532}',
        Ufr: '\u{1D518}',
        ugrave: '\xF9',
        Ugrave: '\xD9',
        uHar: '\u2963',
        uharl: '\u21BF',
        uharr: '\u21BE',
        uhblk: '\u2580',
        ulcorn: '\u231C',
        ulcorner: '\u231C',
        ulcrop: '\u230F',
        ultri: '\u25F8',
        umacr: '\u016B',
        Umacr: '\u016A',
        uml: '\xA8',
        UnderBar: '_',
        UnderBrace: '\u23DF',
        UnderBracket: '\u23B5',
        UnderParenthesis: '\u23DD',
        Union: '\u22C3',
        UnionPlus: '\u228E',
        uogon: '\u0173',
        Uogon: '\u0172',
        uopf: '\u{1D566}',
        Uopf: '\u{1D54C}',
        uparrow: '\u2191',
        Uparrow: '\u21D1',
        UpArrow: '\u2191',
        UpArrowBar: '\u2912',
        UpArrowDownArrow: '\u21C5',
        updownarrow: '\u2195',
        Updownarrow: '\u21D5',
        UpDownArrow: '\u2195',
        UpEquilibrium: '\u296E',
        upharpoonleft: '\u21BF',
        upharpoonright: '\u21BE',
        uplus: '\u228E',
        UpperLeftArrow: '\u2196',
        UpperRightArrow: '\u2197',
        upsi: '\u03C5',
        Upsi: '\u03D2',
        upsih: '\u03D2',
        upsilon: '\u03C5',
        Upsilon: '\u03A5',
        UpTee: '\u22A5',
        UpTeeArrow: '\u21A5',
        upuparrows: '\u21C8',
        urcorn: '\u231D',
        urcorner: '\u231D',
        urcrop: '\u230E',
        uring: '\u016F',
        Uring: '\u016E',
        urtri: '\u25F9',
        uscr: '\u{1D4CA}',
        Uscr: '\u{1D4B0}',
        utdot: '\u22F0',
        utilde: '\u0169',
        Utilde: '\u0168',
        utri: '\u25B5',
        utrif: '\u25B4',
        uuarr: '\u21C8',
        uuml: '\xFC',
        Uuml: '\xDC',
        uwangle: '\u29A7',
        vangrt: '\u299C',
        varepsilon: '\u03F5',
        varkappa: '\u03F0',
        varnothing: '\u2205',
        varphi: '\u03D5',
        varpi: '\u03D6',
        varpropto: '\u221D',
        varr: '\u2195',
        vArr: '\u21D5',
        varrho: '\u03F1',
        varsigma: '\u03C2',
        varsubsetneq: '\u228A\uFE00',
        varsubsetneqq: '\u2ACB\uFE00',
        varsupsetneq: '\u228B\uFE00',
        varsupsetneqq: '\u2ACC\uFE00',
        vartheta: '\u03D1',
        vartriangleleft: '\u22B2',
        vartriangleright: '\u22B3',
        vBar: '\u2AE8',
        Vbar: '\u2AEB',
        vBarv: '\u2AE9',
        vcy: '\u0432',
        Vcy: '\u0412',
        vdash: '\u22A2',
        vDash: '\u22A8',
        Vdash: '\u22A9',
        VDash: '\u22AB',
        Vdashl: '\u2AE6',
        vee: '\u2228',
        Vee: '\u22C1',
        veebar: '\u22BB',
        veeeq: '\u225A',
        vellip: '\u22EE',
        verbar: '|',
        Verbar: '\u2016',
        vert: '|',
        Vert: '\u2016',
        VerticalBar: '\u2223',
        VerticalLine: '|',
        VerticalSeparator: '\u2758',
        VerticalTilde: '\u2240',
        VeryThinSpace: '\u200A',
        vfr: '\u{1D533}',
        Vfr: '\u{1D519}',
        vltri: '\u22B2',
        vnsub: '\u2282\u20D2',
        vnsup: '\u2283\u20D2',
        vopf: '\u{1D567}',
        Vopf: '\u{1D54D}',
        vprop: '\u221D',
        vrtri: '\u22B3',
        vscr: '\u{1D4CB}',
        Vscr: '\u{1D4B1}',
        vsubne: '\u228A\uFE00',
        vsubnE: '\u2ACB\uFE00',
        vsupne: '\u228B\uFE00',
        vsupnE: '\u2ACC\uFE00',
        Vvdash: '\u22AA',
        vzigzag: '\u299A',
        wcirc: '\u0175',
        Wcirc: '\u0174',
        wedbar: '\u2A5F',
        wedge: '\u2227',
        Wedge: '\u22C0',
        wedgeq: '\u2259',
        weierp: '\u2118',
        wfr: '\u{1D534}',
        Wfr: '\u{1D51A}',
        wopf: '\u{1D568}',
        Wopf: '\u{1D54E}',
        wp: '\u2118',
        wr: '\u2240',
        wreath: '\u2240',
        wscr: '\u{1D4CC}',
        Wscr: '\u{1D4B2}',
        xcap: '\u22C2',
        xcirc: '\u25EF',
        xcup: '\u22C3',
        xdtri: '\u25BD',
        xfr: '\u{1D535}',
        Xfr: '\u{1D51B}',
        xharr: '\u27F7',
        xhArr: '\u27FA',
        xi: '\u03BE',
        Xi: '\u039E',
        xlarr: '\u27F5',
        xlArr: '\u27F8',
        xmap: '\u27FC',
        xnis: '\u22FB',
        xodot: '\u2A00',
        xopf: '\u{1D569}',
        Xopf: '\u{1D54F}',
        xoplus: '\u2A01',
        xotime: '\u2A02',
        xrarr: '\u27F6',
        xrArr: '\u27F9',
        xscr: '\u{1D4CD}',
        Xscr: '\u{1D4B3}',
        xsqcup: '\u2A06',
        xuplus: '\u2A04',
        xutri: '\u25B3',
        xvee: '\u22C1',
        xwedge: '\u22C0',
        yacute: '\xFD',
        Yacute: '\xDD',
        yacy: '\u044F',
        YAcy: '\u042F',
        ycirc: '\u0177',
        Ycirc: '\u0176',
        ycy: '\u044B',
        Ycy: '\u042B',
        yen: '\xA5',
        yfr: '\u{1D536}',
        Yfr: '\u{1D51C}',
        yicy: '\u0457',
        YIcy: '\u0407',
        yopf: '\u{1D56A}',
        Yopf: '\u{1D550}',
        yscr: '\u{1D4CE}',
        Yscr: '\u{1D4B4}',
        yucy: '\u044E',
        YUcy: '\u042E',
        yuml: '\xFF',
        Yuml: '\u0178',
        zacute: '\u017A',
        Zacute: '\u0179',
        zcaron: '\u017E',
        Zcaron: '\u017D',
        zcy: '\u0437',
        Zcy: '\u0417',
        zdot: '\u017C',
        Zdot: '\u017B',
        zeetrf: '\u2128',
        ZeroWidthSpace: '\u200B',
        zeta: '\u03B6',
        Zeta: '\u0396',
        zfr: '\u{1D537}',
        Zfr: '\u2128',
        zhcy: '\u0436',
        ZHcy: '\u0416',
        zigrarr: '\u21DD',
        zopf: '\u{1D56B}',
        Zopf: '\u2124',
        zscr: '\u{1D4CF}',
        Zscr: '\u{1D4B5}',
        zwj: '\u200D',
        zwnj: '\u200C',
      };
      var decodeMapLegacy = {
        aacute: '\xE1',
        Aacute: '\xC1',
        acirc: '\xE2',
        Acirc: '\xC2',
        acute: '\xB4',
        aelig: '\xE6',
        AElig: '\xC6',
        agrave: '\xE0',
        Agrave: '\xC0',
        amp: '&',
        AMP: '&',
        aring: '\xE5',
        Aring: '\xC5',
        atilde: '\xE3',
        Atilde: '\xC3',
        auml: '\xE4',
        Auml: '\xC4',
        brvbar: '\xA6',
        ccedil: '\xE7',
        Ccedil: '\xC7',
        cedil: '\xB8',
        cent: '\xA2',
        copy: '\xA9',
        COPY: '\xA9',
        curren: '\xA4',
        deg: '\xB0',
        divide: '\xF7',
        eacute: '\xE9',
        Eacute: '\xC9',
        ecirc: '\xEA',
        Ecirc: '\xCA',
        egrave: '\xE8',
        Egrave: '\xC8',
        eth: '\xF0',
        ETH: '\xD0',
        euml: '\xEB',
        Euml: '\xCB',
        frac12: '\xBD',
        frac14: '\xBC',
        frac34: '\xBE',
        gt: '>',
        GT: '>',
        iacute: '\xED',
        Iacute: '\xCD',
        icirc: '\xEE',
        Icirc: '\xCE',
        iexcl: '\xA1',
        igrave: '\xEC',
        Igrave: '\xCC',
        iquest: '\xBF',
        iuml: '\xEF',
        Iuml: '\xCF',
        laquo: '\xAB',
        lt: '<',
        LT: '<',
        macr: '\xAF',
        micro: '\xB5',
        middot: '\xB7',
        nbsp: '\xA0',
        not: '\xAC',
        ntilde: '\xF1',
        Ntilde: '\xD1',
        oacute: '\xF3',
        Oacute: '\xD3',
        ocirc: '\xF4',
        Ocirc: '\xD4',
        ograve: '\xF2',
        Ograve: '\xD2',
        ordf: '\xAA',
        ordm: '\xBA',
        oslash: '\xF8',
        Oslash: '\xD8',
        otilde: '\xF5',
        Otilde: '\xD5',
        ouml: '\xF6',
        Ouml: '\xD6',
        para: '\xB6',
        plusmn: '\xB1',
        pound: '\xA3',
        quot: '"',
        QUOT: '"',
        raquo: '\xBB',
        reg: '\xAE',
        REG: '\xAE',
        sect: '\xA7',
        shy: '\xAD',
        sup1: '\xB9',
        sup2: '\xB2',
        sup3: '\xB3',
        szlig: '\xDF',
        thorn: '\xFE',
        THORN: '\xDE',
        times: '\xD7',
        uacute: '\xFA',
        Uacute: '\xDA',
        ucirc: '\xFB',
        Ucirc: '\xDB',
        ugrave: '\xF9',
        Ugrave: '\xD9',
        uml: '\xA8',
        uuml: '\xFC',
        Uuml: '\xDC',
        yacute: '\xFD',
        Yacute: '\xDD',
        yen: '\xA5',
        yuml: '\xFF',
      };
      var decodeMapNumeric = {
        0: '\uFFFD',
        128: '\u20AC',
        130: '\u201A',
        131: '\u0192',
        132: '\u201E',
        133: '\u2026',
        134: '\u2020',
        135: '\u2021',
        136: '\u02C6',
        137: '\u2030',
        138: '\u0160',
        139: '\u2039',
        140: '\u0152',
        142: '\u017D',
        145: '\u2018',
        146: '\u2019',
        147: '\u201C',
        148: '\u201D',
        149: '\u2022',
        150: '\u2013',
        151: '\u2014',
        152: '\u02DC',
        153: '\u2122',
        154: '\u0161',
        155: '\u203A',
        156: '\u0153',
        158: '\u017E',
        159: '\u0178',
      };
      var invalidReferenceCodePoints = [
        1, 2, 3, 4, 5, 6, 7, 8, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28,
        29, 30, 31, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142,
        143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 64976,
        64977, 64978, 64979, 64980, 64981, 64982, 64983, 64984, 64985, 64986, 64987, 64988, 64989,
        64990, 64991, 64992, 64993, 64994, 64995, 64996, 64997, 64998, 64999, 65e3, 65001, 65002,
        65003, 65004, 65005, 65006, 65007, 65534, 65535, 131070, 131071, 196606, 196607, 262142,
        262143, 327678, 327679, 393214, 393215, 458750, 458751, 524286, 524287, 589822, 589823,
        655358, 655359, 720894, 720895, 786430, 786431, 851966, 851967, 917502, 917503, 983038,
        983039, 1048574, 1048575, 1114110, 1114111,
      ];
      var stringFromCharCode = String.fromCharCode;
      var object = {};
      var hasOwnProperty = object.hasOwnProperty;
      var has = function (object2, propertyName) {
        return hasOwnProperty.call(object2, propertyName);
      };
      var contains = function (array, value) {
        var index = -1;
        var length = array.length;
        while (++index < length) {
          if (array[index] == value) {
            return true;
          }
        }
        return false;
      };
      var merge = function (options, defaults) {
        if (!options) {
          return defaults;
        }
        var result = {};
        var key2;
        for (key2 in defaults) {
          result[key2] = has(options, key2) ? options[key2] : defaults[key2];
        }
        return result;
      };
      var codePointToSymbol = function (codePoint, strict) {
        var output = '';
        if ((codePoint >= 55296 && codePoint <= 57343) || codePoint > 1114111) {
          if (strict) {
            parseError('character reference outside the permissible Unicode range');
          }
          return '\uFFFD';
        }
        if (has(decodeMapNumeric, codePoint)) {
          if (strict) {
            parseError('disallowed character reference');
          }
          return decodeMapNumeric[codePoint];
        }
        if (strict && contains(invalidReferenceCodePoints, codePoint)) {
          parseError('disallowed character reference');
        }
        if (codePoint > 65535) {
          codePoint -= 65536;
          output += stringFromCharCode(((codePoint >>> 10) & 1023) | 55296);
          codePoint = 56320 | (codePoint & 1023);
        }
        output += stringFromCharCode(codePoint);
        return output;
      };
      var hexEscape = function (codePoint) {
        return '&#x' + codePoint.toString(16).toUpperCase() + ';';
      };
      var decEscape = function (codePoint) {
        return '&#' + codePoint + ';';
      };
      var parseError = function (message) {
        throw Error('Parse error: ' + message);
      };
      var encode = function (string, options) {
        options = merge(options, encode.options);
        var strict = options.strict;
        if (strict && regexInvalidRawCodePoint.test(string)) {
          parseError('forbidden code point');
        }
        var encodeEverything = options.encodeEverything;
        var useNamedReferences = options.useNamedReferences;
        var allowUnsafeSymbols = options.allowUnsafeSymbols;
        var escapeCodePoint = options.decimal ? decEscape : hexEscape;
        var escapeBmpSymbol = function (symbol) {
          return escapeCodePoint(symbol.charCodeAt(0));
        };
        if (encodeEverything) {
          string = string.replace(regexAsciiWhitelist, function (symbol) {
            if (useNamedReferences && has(encodeMap, symbol)) {
              return '&' + encodeMap[symbol] + ';';
            }
            return escapeBmpSymbol(symbol);
          });
          if (useNamedReferences) {
            string = string
              .replace(/&gt;\u20D2/g, '&nvgt;')
              .replace(/&lt;\u20D2/g, '&nvlt;')
              .replace(/&#x66;&#x6A;/g, '&fjlig;');
          }
          if (useNamedReferences) {
            string = string.replace(regexEncodeNonAscii, function (string2) {
              return '&' + encodeMap[string2] + ';';
            });
          }
        } else if (useNamedReferences) {
          if (!allowUnsafeSymbols) {
            string = string.replace(regexEscape, function (string2) {
              return '&' + encodeMap[string2] + ';';
            });
          }
          string = string.replace(/&gt;\u20D2/g, '&nvgt;').replace(/&lt;\u20D2/g, '&nvlt;');
          string = string.replace(regexEncodeNonAscii, function (string2) {
            return '&' + encodeMap[string2] + ';';
          });
        } else if (!allowUnsafeSymbols) {
          string = string.replace(regexEscape, escapeBmpSymbol);
        }
        return string
          .replace(regexAstralSymbols, function ($0) {
            var high = $0.charCodeAt(0);
            var low = $0.charCodeAt(1);
            var codePoint = (high - 55296) * 1024 + low - 56320 + 65536;
            return escapeCodePoint(codePoint);
          })
          .replace(regexBmpWhitelist, escapeBmpSymbol);
      };
      encode.options = {
        allowUnsafeSymbols: false,
        encodeEverything: false,
        strict: false,
        useNamedReferences: false,
        decimal: false,
      };
      var decode = function (html, options) {
        options = merge(options, decode.options);
        var strict = options.strict;
        if (strict && regexInvalidEntity.test(html)) {
          parseError('malformed character reference');
        }
        return html.replace(regexDecode, function ($0, $1, $2, $3, $4, $5, $6, $7, $8) {
          var codePoint;
          var semicolon;
          var decDigits;
          var hexDigits;
          var reference;
          var next;
          if ($1) {
            reference = $1;
            return decodeMap[reference];
          }
          if ($2) {
            reference = $2;
            next = $3;
            if (next && options.isAttributeValue) {
              if (strict && next == '=') {
                parseError('`&` did not start a character reference');
              }
              return $0;
            } else {
              if (strict) {
                parseError('named character reference was not terminated by a semicolon');
              }
              return decodeMapLegacy[reference] + (next || '');
            }
          }
          if ($4) {
            decDigits = $4;
            semicolon = $5;
            if (strict && !semicolon) {
              parseError('character reference was not terminated by a semicolon');
            }
            codePoint = parseInt(decDigits, 10);
            return codePointToSymbol(codePoint, strict);
          }
          if ($6) {
            hexDigits = $6;
            semicolon = $7;
            if (strict && !semicolon) {
              parseError('character reference was not terminated by a semicolon');
            }
            codePoint = parseInt(hexDigits, 16);
            return codePointToSymbol(codePoint, strict);
          }
          if (strict) {
            parseError('named character reference was not terminated by a semicolon');
          }
          return $0;
        });
      };
      decode.options = {
        isAttributeValue: false,
        strict: false,
      };
      var escape2 = function (string) {
        return string.replace(regexEscape, function ($0) {
          return escapeMap[$0];
        });
      };
      var he = {
        version: '1.2.0',
        encode: encode,
        decode: decode,
        escape: escape2,
        unescape: decode,
      };
      if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
        define(function () {
          return he;
        });
      } else if (freeExports && !freeExports.nodeType) {
        if (freeModule) {
          freeModule.exports = he;
        } else {
          for (var key in he) {
            has(he, key) && (freeExports[key] = he[key]);
          }
        }
      } else {
        root.he = he;
      }
    })(exports2);
  },
});

// node_modules/webdav/dist/node/tools/encode.js
var require_encode = __commonJS({
  'node_modules/webdav/dist/node/tools/encode.js'(exports2) {
    'use strict';
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.toBase64 = exports2.fromBase64 = exports2.decodeHTMLEntities = void 0;
    var base_64_1 = require_base64();
    function decodeHTMLEntities(text) {
      if (typeof WEB === 'undefined') {
        var he = require_he();
        return he.decode(text);
      } else {
        var txt = document.createElement('textarea');
        txt.innerHTML = text;
        return txt.value;
      }
    }
    exports2.decodeHTMLEntities = decodeHTMLEntities;
    function fromBase64(text) {
      return (0, base_64_1.decode)(text);
    }
    exports2.fromBase64 = fromBase64;
    function toBase64(text) {
      return (0, base_64_1.encode)(text);
    }
    exports2.toBase64 = toBase64;
  },
});

// node_modules/webdav/dist/node/auth/basic.js
var require_basic = __commonJS({
  'node_modules/webdav/dist/node/auth/basic.js'(exports2) {
    'use strict';
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.generateBasicAuthHeader = void 0;
    var encode_1 = require_encode();
    function generateBasicAuthHeader(username, password) {
      var encoded = (0, encode_1.toBase64)(''.concat(username, ':').concat(password));
      return 'Basic '.concat(encoded);
    }
    exports2.generateBasicAuthHeader = generateBasicAuthHeader;
  },
});

// node_modules/webdav/dist/node/auth/oauth.js
var require_oauth = __commonJS({
  'node_modules/webdav/dist/node/auth/oauth.js'(exports2) {
    'use strict';
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.generateTokenAuthHeader = void 0;
    function generateTokenAuthHeader(token) {
      return ''.concat(token.token_type, ' ').concat(token.access_token);
    }
    exports2.generateTokenAuthHeader = generateTokenAuthHeader;
  },
});

// node_modules/webdav/dist/node/types.js
var require_types2 = __commonJS({
  'node_modules/webdav/dist/node/types.js'(exports2) {
    'use strict';
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.ErrorCode = exports2.AuthType = void 0;
    var AuthType;
    (function (AuthType2) {
      AuthType2['Digest'] = 'digest';
      AuthType2['None'] = 'none';
      AuthType2['Password'] = 'password';
      AuthType2['Token'] = 'token';
    })((AuthType = exports2.AuthType || (exports2.AuthType = {})));
    var ErrorCode;
    (function (ErrorCode2) {
      ErrorCode2['DataTypeNoLength'] = 'data-type-no-length';
      ErrorCode2['InvalidAuthType'] = 'invalid-auth-type';
      ErrorCode2['InvalidOutputFormat'] = 'invalid-output-format';
      ErrorCode2['LinkUnsupportedAuthType'] = 'link-unsupported-auth';
    })((ErrorCode = exports2.ErrorCode || (exports2.ErrorCode = {})));
  },
});

// node_modules/webdav/dist/node/auth/index.js
var require_auth = __commonJS({
  'node_modules/webdav/dist/node/auth/index.js'(exports2) {
    'use strict';
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.setupAuth = void 0;
    var layerr_1 = require_dist();
    var digest_1 = require_digest();
    var basic_1 = require_basic();
    var oauth_1 = require_oauth();
    var types_1 = require_types2();
    function setupAuth(context, username, password, oauthToken) {
      switch (context.authType) {
        case types_1.AuthType.Digest:
          context.digest = (0, digest_1.createDigestContext)(username, password);
          break;
        case types_1.AuthType.None:
          break;
        case types_1.AuthType.Password:
          context.headers.Authorization = (0, basic_1.generateBasicAuthHeader)(username, password);
          break;
        case types_1.AuthType.Token:
          context.headers.Authorization = (0, oauth_1.generateTokenAuthHeader)(oauthToken);
          break;
        default:
          throw new layerr_1.Layerr(
            {
              info: {
                code: types_1.ErrorCode.InvalidAuthType,
              },
            },
            'Invalid auth type: '.concat(context.authType)
          );
      }
    }
    exports2.setupAuth = setupAuth;
  },
});

// node_modules/axios/lib/helpers/bind.js
var require_bind = __commonJS({
  'node_modules/axios/lib/helpers/bind.js'(exports2, module2) {
    'use strict';
    module2.exports = function bind(fn, thisArg) {
      return function wrap() {
        return fn.apply(thisArg, arguments);
      };
    };
  },
});

// node_modules/axios/lib/utils.js
var require_utils = __commonJS({
  'node_modules/axios/lib/utils.js'(exports2, module2) {
    'use strict';
    var bind = require_bind();
    var toString = Object.prototype.toString;
    var kindOf = /* @__PURE__ */ (function (cache) {
      return function (thing) {
        var str = toString.call(thing);
        return cache[str] || (cache[str] = str.slice(8, -1).toLowerCase());
      };
    })(/* @__PURE__ */ Object.create(null));
    function kindOfTest(type) {
      type = type.toLowerCase();
      return function isKindOf(thing) {
        return kindOf(thing) === type;
      };
    }
    function isArray(val) {
      return Array.isArray(val);
    }
    function isUndefined(val) {
      return typeof val === 'undefined';
    }
    function isBuffer(val) {
      return (
        val !== null &&
        !isUndefined(val) &&
        val.constructor !== null &&
        !isUndefined(val.constructor) &&
        typeof val.constructor.isBuffer === 'function' &&
        val.constructor.isBuffer(val)
      );
    }
    var isArrayBuffer = kindOfTest('ArrayBuffer');
    function isArrayBufferView(val) {
      var result;
      if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView) {
        result = ArrayBuffer.isView(val);
      } else {
        result = val && val.buffer && isArrayBuffer(val.buffer);
      }
      return result;
    }
    function isString(val) {
      return typeof val === 'string';
    }
    function isNumber(val) {
      return typeof val === 'number';
    }
    function isObject(val) {
      return val !== null && typeof val === 'object';
    }
    function isPlainObject(val) {
      if (kindOf(val) !== 'object') {
        return false;
      }
      var prototype = Object.getPrototypeOf(val);
      return prototype === null || prototype === Object.prototype;
    }
    function isEmptyObject(val) {
      return (
        val && Object.keys(val).length === 0 && Object.getPrototypeOf(val) === Object.prototype
      );
    }
    var isDate = kindOfTest('Date');
    var isFile = kindOfTest('File');
    var isBlob = kindOfTest('Blob');
    var isFileList = kindOfTest('FileList');
    function isFunction(val) {
      return toString.call(val) === '[object Function]';
    }
    function isStream(val) {
      return isObject(val) && isFunction(val.pipe);
    }
    function isFormData(thing) {
      var pattern = '[object FormData]';
      return (
        thing &&
        ((typeof FormData === 'function' && thing instanceof FormData) ||
          toString.call(thing) === pattern ||
          (isFunction(thing.toString) && thing.toString() === pattern))
      );
    }
    var isURLSearchParams = kindOfTest('URLSearchParams');
    function trim(str) {
      return str.trim ? str.trim() : str.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
    }
    function isStandardBrowserEnv() {
      var product;
      if (
        typeof navigator !== 'undefined' &&
        ((product = navigator.product) === 'ReactNative' ||
          product === 'NativeScript' ||
          product === 'NS')
      ) {
        return false;
      }
      return typeof window !== 'undefined' && typeof document !== 'undefined';
    }
    function forEach(obj, fn) {
      if (obj === null || typeof obj === 'undefined') {
        return;
      }
      if (typeof obj !== 'object') {
        obj = [obj];
      }
      if (isArray(obj)) {
        for (var i = 0, l = obj.length; i < l; i++) {
          fn.call(null, obj[i], i, obj);
        }
      } else {
        for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            fn.call(null, obj[key], key, obj);
          }
        }
      }
    }
    function merge() {
      var result = {};
      function assignValue(val, key) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          return;
        }
        if (isPlainObject(result[key]) && isPlainObject(val)) {
          result[key] = merge(result[key], val);
        } else if (isPlainObject(val)) {
          result[key] = merge({}, val);
        } else if (isArray(val)) {
          result[key] = val.slice();
        } else {
          result[key] = val;
        }
      }
      for (var i = 0, l = arguments.length; i < l; i++) {
        forEach(arguments[i], assignValue);
      }
      return result;
    }
    function extend(a, b, thisArg) {
      forEach(b, function assignValue(val, key) {
        if (thisArg && typeof val === 'function') {
          a[key] = bind(val, thisArg);
        } else {
          a[key] = val;
        }
      });
      return a;
    }
    function stripBOM(content) {
      if (content.charCodeAt(0) === 65279) {
        content = content.slice(1);
      }
      return content;
    }
    function inherits(constructor, superConstructor, props, descriptors) {
      constructor.prototype = Object.create(superConstructor.prototype, descriptors);
      constructor.prototype.constructor = constructor;
      props && Object.assign(constructor.prototype, props);
    }
    function toFlatObject(sourceObj, destObj, filter, propFilter) {
      var props;
      var i;
      var prop;
      var merged = {};
      destObj = destObj || {};
      if (sourceObj == null) return destObj;
      do {
        props = Object.getOwnPropertyNames(sourceObj);
        i = props.length;
        while (i-- > 0) {
          prop = props[i];
          if ((!propFilter || propFilter(prop, sourceObj, destObj)) && !merged[prop]) {
            destObj[prop] = sourceObj[prop];
            merged[prop] = true;
          }
        }
        sourceObj = filter !== false && Object.getPrototypeOf(sourceObj);
      } while (
        sourceObj &&
        (!filter || filter(sourceObj, destObj)) &&
        sourceObj !== Object.prototype
      );
      return destObj;
    }
    function endsWith(str, searchString, position) {
      str = String(str);
      if (position === void 0 || position > str.length) {
        position = str.length;
      }
      position -= searchString.length;
      var lastIndex = str.indexOf(searchString, position);
      return lastIndex !== -1 && lastIndex === position;
    }
    function toArray(thing) {
      if (!thing) return null;
      if (isArray(thing)) return thing;
      var i = thing.length;
      if (!isNumber(i)) return null;
      var arr = new Array(i);
      while (i-- > 0) {
        arr[i] = thing[i];
      }
      return arr;
    }
    var isTypedArray = /* @__PURE__ */ (function (TypedArray) {
      return function (thing) {
        return TypedArray && thing instanceof TypedArray;
      };
    })(typeof Uint8Array !== 'undefined' && Object.getPrototypeOf(Uint8Array));
    function forEachEntry(obj, fn) {
      var generator = obj && obj[Symbol.iterator];
      var iterator = generator.call(obj);
      var result;
      while ((result = iterator.next()) && !result.done) {
        var pair = result.value;
        fn.call(obj, pair[0], pair[1]);
      }
    }
    function matchAll(regExp, str) {
      var matches;
      var arr = [];
      while ((matches = regExp.exec(str)) !== null) {
        arr.push(matches);
      }
      return arr;
    }
    var isHTMLForm = kindOfTest('HTMLFormElement');
    var hasOwnProperty = /* @__PURE__ */ (function resolver(_hasOwnProperty) {
      return function (obj, prop) {
        return _hasOwnProperty.call(obj, prop);
      };
    })(Object.prototype.hasOwnProperty);
    module2.exports = {
      isArray,
      isArrayBuffer,
      isBuffer,
      isFormData,
      isArrayBufferView,
      isString,
      isNumber,
      isObject,
      isPlainObject,
      isEmptyObject,
      isUndefined,
      isDate,
      isFile,
      isBlob,
      isFunction,
      isStream,
      isURLSearchParams,
      isStandardBrowserEnv,
      forEach,
      merge,
      extend,
      trim,
      stripBOM,
      inherits,
      toFlatObject,
      kindOf,
      kindOfTest,
      endsWith,
      toArray,
      isTypedArray,
      isFileList,
      forEachEntry,
      matchAll,
      isHTMLForm,
      hasOwnProperty,
    };
  },
});

// node_modules/axios/lib/core/AxiosError.js
var require_AxiosError = __commonJS({
  'node_modules/axios/lib/core/AxiosError.js'(exports2, module2) {
    'use strict';
    var utils = require_utils();
    function AxiosError(message, code, config, request, response) {
      Error.call(this);
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
      } else {
        this.stack = new Error().stack;
      }
      this.message = message;
      this.name = 'AxiosError';
      code && (this.code = code);
      config && (this.config = config);
      request && (this.request = request);
      response && (this.response = response);
    }
    utils.inherits(AxiosError, Error, {
      toJSON: function toJSON() {
        return {
          // Standard
          message: this.message,
          name: this.name,
          // Microsoft
          description: this.description,
          number: this.number,
          // Mozilla
          fileName: this.fileName,
          lineNumber: this.lineNumber,
          columnNumber: this.columnNumber,
          stack: this.stack,
          // Axios
          config: this.config,
          code: this.code,
          status: this.response && this.response.status ? this.response.status : null,
        };
      },
    });
    var prototype = AxiosError.prototype;
    var descriptors = {};
    [
      'ERR_BAD_OPTION_VALUE',
      'ERR_BAD_OPTION',
      'ECONNABORTED',
      'ETIMEDOUT',
      'ERR_NETWORK',
      'ERR_FR_TOO_MANY_REDIRECTS',
      'ERR_DEPRECATED',
      'ERR_BAD_RESPONSE',
      'ERR_BAD_REQUEST',
      'ERR_CANCELED',
      'ERR_NOT_SUPPORT',
      'ERR_INVALID_URL',
      // eslint-disable-next-line func-names
    ].forEach(function (code) {
      descriptors[code] = { value: code };
    });
    Object.defineProperties(AxiosError, descriptors);
    Object.defineProperty(prototype, 'isAxiosError', { value: true });
    AxiosError.from = function (error, code, config, request, response, customProps) {
      var axiosError = Object.create(prototype);
      utils.toFlatObject(error, axiosError, function filter(obj) {
        return obj !== Error.prototype;
      });
      AxiosError.call(axiosError, error.message, code, config, request, response);
      axiosError.cause = error;
      axiosError.name = error.name;
      customProps && Object.assign(axiosError, customProps);
      return axiosError;
    };
    module2.exports = AxiosError;
  },
});

// node_modules/delayed-stream/lib/delayed_stream.js
var require_delayed_stream = __commonJS({
  'node_modules/delayed-stream/lib/delayed_stream.js'(exports2, module2) {
    var Stream = require('stream').Stream;
    var util = require('util');
    module2.exports = DelayedStream;
    function DelayedStream() {
      this.source = null;
      this.dataSize = 0;
      this.maxDataSize = 1024 * 1024;
      this.pauseStream = true;
      this._maxDataSizeExceeded = false;
      this._released = false;
      this._bufferedEvents = [];
    }
    util.inherits(DelayedStream, Stream);
    DelayedStream.create = function (source, options) {
      var delayedStream = new this();
      options = options || {};
      for (var option in options) {
        delayedStream[option] = options[option];
      }
      delayedStream.source = source;
      var realEmit = source.emit;
      source.emit = function () {
        delayedStream._handleEmit(arguments);
        return realEmit.apply(source, arguments);
      };
      source.on('error', function () {});
      if (delayedStream.pauseStream) {
        source.pause();
      }
      return delayedStream;
    };
    Object.defineProperty(DelayedStream.prototype, 'readable', {
      configurable: true,
      enumerable: true,
      get: function () {
        return this.source.readable;
      },
    });
    DelayedStream.prototype.setEncoding = function () {
      return this.source.setEncoding.apply(this.source, arguments);
    };
    DelayedStream.prototype.resume = function () {
      if (!this._released) {
        this.release();
      }
      this.source.resume();
    };
    DelayedStream.prototype.pause = function () {
      this.source.pause();
    };
    DelayedStream.prototype.release = function () {
      this._released = true;
      this._bufferedEvents.forEach(
        function (args) {
          this.emit.apply(this, args);
        }.bind(this)
      );
      this._bufferedEvents = [];
    };
    DelayedStream.prototype.pipe = function () {
      var r = Stream.prototype.pipe.apply(this, arguments);
      this.resume();
      return r;
    };
    DelayedStream.prototype._handleEmit = function (args) {
      if (this._released) {
        this.emit.apply(this, args);
        return;
      }
      if (args[0] === 'data') {
        this.dataSize += args[1].length;
        this._checkIfMaxDataSizeExceeded();
      }
      this._bufferedEvents.push(args);
    };
    DelayedStream.prototype._checkIfMaxDataSizeExceeded = function () {
      if (this._maxDataSizeExceeded) {
        return;
      }
      if (this.dataSize <= this.maxDataSize) {
        return;
      }
      this._maxDataSizeExceeded = true;
      var message = 'DelayedStream#maxDataSize of ' + this.maxDataSize + ' bytes exceeded.';
      this.emit('error', new Error(message));
    };
  },
});

// node_modules/combined-stream/lib/combined_stream.js
var require_combined_stream = __commonJS({
  'node_modules/combined-stream/lib/combined_stream.js'(exports2, module2) {
    var util = require('util');
    var Stream = require('stream').Stream;
    var DelayedStream = require_delayed_stream();
    module2.exports = CombinedStream;
    function CombinedStream() {
      this.writable = false;
      this.readable = true;
      this.dataSize = 0;
      this.maxDataSize = 2 * 1024 * 1024;
      this.pauseStreams = true;
      this._released = false;
      this._streams = [];
      this._currentStream = null;
      this._insideLoop = false;
      this._pendingNext = false;
    }
    util.inherits(CombinedStream, Stream);
    CombinedStream.create = function (options) {
      var combinedStream = new this();
      options = options || {};
      for (var option in options) {
        combinedStream[option] = options[option];
      }
      return combinedStream;
    };
    CombinedStream.isStreamLike = function (stream) {
      return (
        typeof stream !== 'function' &&
        typeof stream !== 'string' &&
        typeof stream !== 'boolean' &&
        typeof stream !== 'number' &&
        !Buffer.isBuffer(stream)
      );
    };
    CombinedStream.prototype.append = function (stream) {
      var isStreamLike = CombinedStream.isStreamLike(stream);
      if (isStreamLike) {
        if (!(stream instanceof DelayedStream)) {
          var newStream = DelayedStream.create(stream, {
            maxDataSize: Infinity,
            pauseStream: this.pauseStreams,
          });
          stream.on('data', this._checkDataSize.bind(this));
          stream = newStream;
        }
        this._handleErrors(stream);
        if (this.pauseStreams) {
          stream.pause();
        }
      }
      this._streams.push(stream);
      return this;
    };
    CombinedStream.prototype.pipe = function (dest, options) {
      Stream.prototype.pipe.call(this, dest, options);
      this.resume();
      return dest;
    };
    CombinedStream.prototype._getNext = function () {
      this._currentStream = null;
      if (this._insideLoop) {
        this._pendingNext = true;
        return;
      }
      this._insideLoop = true;
      try {
        do {
          this._pendingNext = false;
          this._realGetNext();
        } while (this._pendingNext);
      } finally {
        this._insideLoop = false;
      }
    };
    CombinedStream.prototype._realGetNext = function () {
      var stream = this._streams.shift();
      if (typeof stream == 'undefined') {
        this.end();
        return;
      }
      if (typeof stream !== 'function') {
        this._pipeNext(stream);
        return;
      }
      var getStream = stream;
      getStream(
        function (stream2) {
          var isStreamLike = CombinedStream.isStreamLike(stream2);
          if (isStreamLike) {
            stream2.on('data', this._checkDataSize.bind(this));
            this._handleErrors(stream2);
          }
          this._pipeNext(stream2);
        }.bind(this)
      );
    };
    CombinedStream.prototype._pipeNext = function (stream) {
      this._currentStream = stream;
      var isStreamLike = CombinedStream.isStreamLike(stream);
      if (isStreamLike) {
        stream.on('end', this._getNext.bind(this));
        stream.pipe(this, { end: false });
        return;
      }
      var value = stream;
      this.write(value);
      this._getNext();
    };
    CombinedStream.prototype._handleErrors = function (stream) {
      var self2 = this;
      stream.on('error', function (err) {
        self2._emitError(err);
      });
    };
    CombinedStream.prototype.write = function (data) {
      this.emit('data', data);
    };
    CombinedStream.prototype.pause = function () {
      if (!this.pauseStreams) {
        return;
      }
      if (
        this.pauseStreams &&
        this._currentStream &&
        typeof this._currentStream.pause == 'function'
      )
        this._currentStream.pause();
      this.emit('pause');
    };
    CombinedStream.prototype.resume = function () {
      if (!this._released) {
        this._released = true;
        this.writable = true;
        this._getNext();
      }
      if (
        this.pauseStreams &&
        this._currentStream &&
        typeof this._currentStream.resume == 'function'
      )
        this._currentStream.resume();
      this.emit('resume');
    };
    CombinedStream.prototype.end = function () {
      this._reset();
      this.emit('end');
    };
    CombinedStream.prototype.destroy = function () {
      this._reset();
      this.emit('close');
    };
    CombinedStream.prototype._reset = function () {
      this.writable = false;
      this._streams = [];
      this._currentStream = null;
    };
    CombinedStream.prototype._checkDataSize = function () {
      this._updateDataSize();
      if (this.dataSize <= this.maxDataSize) {
        return;
      }
      var message = 'DelayedStream#maxDataSize of ' + this.maxDataSize + ' bytes exceeded.';
      this._emitError(new Error(message));
    };
    CombinedStream.prototype._updateDataSize = function () {
      this.dataSize = 0;
      var self2 = this;
      this._streams.forEach(function (stream) {
        if (!stream.dataSize) {
          return;
        }
        self2.dataSize += stream.dataSize;
      });
      if (this._currentStream && this._currentStream.dataSize) {
        this.dataSize += this._currentStream.dataSize;
      }
    };
    CombinedStream.prototype._emitError = function (err) {
      this._reset();
      this.emit('error', err);
    };
  },
});

// node_modules/mime-db/db.json
var require_db = __commonJS({
  'node_modules/mime-db/db.json'(exports2, module2) {
    module2.exports = {
      'application/1d-interleaved-parityfec': {
        source: 'iana',
      },
      'application/3gpdash-qoe-report+xml': {
        source: 'iana',
        charset: 'UTF-8',
        compressible: true,
      },
      'application/3gpp-ims+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/3gpphal+json': {
        source: 'iana',
        compressible: true,
      },
      'application/3gpphalforms+json': {
        source: 'iana',
        compressible: true,
      },
      'application/a2l': {
        source: 'iana',
      },
      'application/ace+cbor': {
        source: 'iana',
      },
      'application/activemessage': {
        source: 'iana',
      },
      'application/activity+json': {
        source: 'iana',
        compressible: true,
      },
      'application/alto-costmap+json': {
        source: 'iana',
        compressible: true,
      },
      'application/alto-costmapfilter+json': {
        source: 'iana',
        compressible: true,
      },
      'application/alto-directory+json': {
        source: 'iana',
        compressible: true,
      },
      'application/alto-endpointcost+json': {
        source: 'iana',
        compressible: true,
      },
      'application/alto-endpointcostparams+json': {
        source: 'iana',
        compressible: true,
      },
      'application/alto-endpointprop+json': {
        source: 'iana',
        compressible: true,
      },
      'application/alto-endpointpropparams+json': {
        source: 'iana',
        compressible: true,
      },
      'application/alto-error+json': {
        source: 'iana',
        compressible: true,
      },
      'application/alto-networkmap+json': {
        source: 'iana',
        compressible: true,
      },
      'application/alto-networkmapfilter+json': {
        source: 'iana',
        compressible: true,
      },
      'application/alto-updatestreamcontrol+json': {
        source: 'iana',
        compressible: true,
      },
      'application/alto-updatestreamparams+json': {
        source: 'iana',
        compressible: true,
      },
      'application/aml': {
        source: 'iana',
      },
      'application/andrew-inset': {
        source: 'iana',
        extensions: ['ez'],
      },
      'application/applefile': {
        source: 'iana',
      },
      'application/applixware': {
        source: 'apache',
        extensions: ['aw'],
      },
      'application/at+jwt': {
        source: 'iana',
      },
      'application/atf': {
        source: 'iana',
      },
      'application/atfx': {
        source: 'iana',
      },
      'application/atom+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['atom'],
      },
      'application/atomcat+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['atomcat'],
      },
      'application/atomdeleted+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['atomdeleted'],
      },
      'application/atomicmail': {
        source: 'iana',
      },
      'application/atomsvc+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['atomsvc'],
      },
      'application/atsc-dwd+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['dwd'],
      },
      'application/atsc-dynamic-event-message': {
        source: 'iana',
      },
      'application/atsc-held+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['held'],
      },
      'application/atsc-rdt+json': {
        source: 'iana',
        compressible: true,
      },
      'application/atsc-rsat+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['rsat'],
      },
      'application/atxml': {
        source: 'iana',
      },
      'application/auth-policy+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/bacnet-xdd+zip': {
        source: 'iana',
        compressible: false,
      },
      'application/batch-smtp': {
        source: 'iana',
      },
      'application/bdoc': {
        compressible: false,
        extensions: ['bdoc'],
      },
      'application/beep+xml': {
        source: 'iana',
        charset: 'UTF-8',
        compressible: true,
      },
      'application/calendar+json': {
        source: 'iana',
        compressible: true,
      },
      'application/calendar+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['xcs'],
      },
      'application/call-completion': {
        source: 'iana',
      },
      'application/cals-1840': {
        source: 'iana',
      },
      'application/captive+json': {
        source: 'iana',
        compressible: true,
      },
      'application/cbor': {
        source: 'iana',
      },
      'application/cbor-seq': {
        source: 'iana',
      },
      'application/cccex': {
        source: 'iana',
      },
      'application/ccmp+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/ccxml+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['ccxml'],
      },
      'application/cdfx+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['cdfx'],
      },
      'application/cdmi-capability': {
        source: 'iana',
        extensions: ['cdmia'],
      },
      'application/cdmi-container': {
        source: 'iana',
        extensions: ['cdmic'],
      },
      'application/cdmi-domain': {
        source: 'iana',
        extensions: ['cdmid'],
      },
      'application/cdmi-object': {
        source: 'iana',
        extensions: ['cdmio'],
      },
      'application/cdmi-queue': {
        source: 'iana',
        extensions: ['cdmiq'],
      },
      'application/cdni': {
        source: 'iana',
      },
      'application/cea': {
        source: 'iana',
      },
      'application/cea-2018+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/cellml+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/cfw': {
        source: 'iana',
      },
      'application/city+json': {
        source: 'iana',
        compressible: true,
      },
      'application/clr': {
        source: 'iana',
      },
      'application/clue+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/clue_info+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/cms': {
        source: 'iana',
      },
      'application/cnrp+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/coap-group+json': {
        source: 'iana',
        compressible: true,
      },
      'application/coap-payload': {
        source: 'iana',
      },
      'application/commonground': {
        source: 'iana',
      },
      'application/conference-info+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/cose': {
        source: 'iana',
      },
      'application/cose-key': {
        source: 'iana',
      },
      'application/cose-key-set': {
        source: 'iana',
      },
      'application/cpl+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['cpl'],
      },
      'application/csrattrs': {
        source: 'iana',
      },
      'application/csta+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/cstadata+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/csvm+json': {
        source: 'iana',
        compressible: true,
      },
      'application/cu-seeme': {
        source: 'apache',
        extensions: ['cu'],
      },
      'application/cwt': {
        source: 'iana',
      },
      'application/cybercash': {
        source: 'iana',
      },
      'application/dart': {
        compressible: true,
      },
      'application/dash+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['mpd'],
      },
      'application/dash-patch+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['mpp'],
      },
      'application/dashdelta': {
        source: 'iana',
      },
      'application/davmount+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['davmount'],
      },
      'application/dca-rft': {
        source: 'iana',
      },
      'application/dcd': {
        source: 'iana',
      },
      'application/dec-dx': {
        source: 'iana',
      },
      'application/dialog-info+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/dicom': {
        source: 'iana',
      },
      'application/dicom+json': {
        source: 'iana',
        compressible: true,
      },
      'application/dicom+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/dii': {
        source: 'iana',
      },
      'application/dit': {
        source: 'iana',
      },
      'application/dns': {
        source: 'iana',
      },
      'application/dns+json': {
        source: 'iana',
        compressible: true,
      },
      'application/dns-message': {
        source: 'iana',
      },
      'application/docbook+xml': {
        source: 'apache',
        compressible: true,
        extensions: ['dbk'],
      },
      'application/dots+cbor': {
        source: 'iana',
      },
      'application/dskpp+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/dssc+der': {
        source: 'iana',
        extensions: ['dssc'],
      },
      'application/dssc+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['xdssc'],
      },
      'application/dvcs': {
        source: 'iana',
      },
      'application/ecmascript': {
        source: 'iana',
        compressible: true,
        extensions: ['es', 'ecma'],
      },
      'application/edi-consent': {
        source: 'iana',
      },
      'application/edi-x12': {
        source: 'iana',
        compressible: false,
      },
      'application/edifact': {
        source: 'iana',
        compressible: false,
      },
      'application/efi': {
        source: 'iana',
      },
      'application/elm+json': {
        source: 'iana',
        charset: 'UTF-8',
        compressible: true,
      },
      'application/elm+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/emergencycalldata.cap+xml': {
        source: 'iana',
        charset: 'UTF-8',
        compressible: true,
      },
      'application/emergencycalldata.comment+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/emergencycalldata.control+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/emergencycalldata.deviceinfo+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/emergencycalldata.ecall.msd': {
        source: 'iana',
      },
      'application/emergencycalldata.providerinfo+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/emergencycalldata.serviceinfo+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/emergencycalldata.subscriberinfo+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/emergencycalldata.veds+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/emma+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['emma'],
      },
      'application/emotionml+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['emotionml'],
      },
      'application/encaprtp': {
        source: 'iana',
      },
      'application/epp+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/epub+zip': {
        source: 'iana',
        compressible: false,
        extensions: ['epub'],
      },
      'application/eshop': {
        source: 'iana',
      },
      'application/exi': {
        source: 'iana',
        extensions: ['exi'],
      },
      'application/expect-ct-report+json': {
        source: 'iana',
        compressible: true,
      },
      'application/express': {
        source: 'iana',
        extensions: ['exp'],
      },
      'application/fastinfoset': {
        source: 'iana',
      },
      'application/fastsoap': {
        source: 'iana',
      },
      'application/fdt+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['fdt'],
      },
      'application/fhir+json': {
        source: 'iana',
        charset: 'UTF-8',
        compressible: true,
      },
      'application/fhir+xml': {
        source: 'iana',
        charset: 'UTF-8',
        compressible: true,
      },
      'application/fido.trusted-apps+json': {
        compressible: true,
      },
      'application/fits': {
        source: 'iana',
      },
      'application/flexfec': {
        source: 'iana',
      },
      'application/font-sfnt': {
        source: 'iana',
      },
      'application/font-tdpfr': {
        source: 'iana',
        extensions: ['pfr'],
      },
      'application/font-woff': {
        source: 'iana',
        compressible: false,
      },
      'application/framework-attributes+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/geo+json': {
        source: 'iana',
        compressible: true,
        extensions: ['geojson'],
      },
      'application/geo+json-seq': {
        source: 'iana',
      },
      'application/geopackage+sqlite3': {
        source: 'iana',
      },
      'application/geoxacml+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/gltf-buffer': {
        source: 'iana',
      },
      'application/gml+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['gml'],
      },
      'application/gpx+xml': {
        source: 'apache',
        compressible: true,
        extensions: ['gpx'],
      },
      'application/gxf': {
        source: 'apache',
        extensions: ['gxf'],
      },
      'application/gzip': {
        source: 'iana',
        compressible: false,
        extensions: ['gz'],
      },
      'application/h224': {
        source: 'iana',
      },
      'application/held+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/hjson': {
        extensions: ['hjson'],
      },
      'application/http': {
        source: 'iana',
      },
      'application/hyperstudio': {
        source: 'iana',
        extensions: ['stk'],
      },
      'application/ibe-key-request+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/ibe-pkg-reply+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/ibe-pp-data': {
        source: 'iana',
      },
      'application/iges': {
        source: 'iana',
      },
      'application/im-iscomposing+xml': {
        source: 'iana',
        charset: 'UTF-8',
        compressible: true,
      },
      'application/index': {
        source: 'iana',
      },
      'application/index.cmd': {
        source: 'iana',
      },
      'application/index.obj': {
        source: 'iana',
      },
      'application/index.response': {
        source: 'iana',
      },
      'application/index.vnd': {
        source: 'iana',
      },
      'application/inkml+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['ink', 'inkml'],
      },
      'application/iotp': {
        source: 'iana',
      },
      'application/ipfix': {
        source: 'iana',
        extensions: ['ipfix'],
      },
      'application/ipp': {
        source: 'iana',
      },
      'application/isup': {
        source: 'iana',
      },
      'application/its+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['its'],
      },
      'application/java-archive': {
        source: 'apache',
        compressible: false,
        extensions: ['jar', 'war', 'ear'],
      },
      'application/java-serialized-object': {
        source: 'apache',
        compressible: false,
        extensions: ['ser'],
      },
      'application/java-vm': {
        source: 'apache',
        compressible: false,
        extensions: ['class'],
      },
      'application/javascript': {
        source: 'iana',
        charset: 'UTF-8',
        compressible: true,
        extensions: ['js', 'mjs'],
      },
      'application/jf2feed+json': {
        source: 'iana',
        compressible: true,
      },
      'application/jose': {
        source: 'iana',
      },
      'application/jose+json': {
        source: 'iana',
        compressible: true,
      },
      'application/jrd+json': {
        source: 'iana',
        compressible: true,
      },
      'application/jscalendar+json': {
        source: 'iana',
        compressible: true,
      },
      'application/json': {
        source: 'iana',
        charset: 'UTF-8',
        compressible: true,
        extensions: ['json', 'map'],
      },
      'application/json-patch+json': {
        source: 'iana',
        compressible: true,
      },
      'application/json-seq': {
        source: 'iana',
      },
      'application/json5': {
        extensions: ['json5'],
      },
      'application/jsonml+json': {
        source: 'apache',
        compressible: true,
        extensions: ['jsonml'],
      },
      'application/jwk+json': {
        source: 'iana',
        compressible: true,
      },
      'application/jwk-set+json': {
        source: 'iana',
        compressible: true,
      },
      'application/jwt': {
        source: 'iana',
      },
      'application/kpml-request+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/kpml-response+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/ld+json': {
        source: 'iana',
        compressible: true,
        extensions: ['jsonld'],
      },
      'application/lgr+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['lgr'],
      },
      'application/link-format': {
        source: 'iana',
      },
      'application/load-control+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/lost+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['lostxml'],
      },
      'application/lostsync+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/lpf+zip': {
        source: 'iana',
        compressible: false,
      },
      'application/lxf': {
        source: 'iana',
      },
      'application/mac-binhex40': {
        source: 'iana',
        extensions: ['hqx'],
      },
      'application/mac-compactpro': {
        source: 'apache',
        extensions: ['cpt'],
      },
      'application/macwriteii': {
        source: 'iana',
      },
      'application/mads+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['mads'],
      },
      'application/manifest+json': {
        source: 'iana',
        charset: 'UTF-8',
        compressible: true,
        extensions: ['webmanifest'],
      },
      'application/marc': {
        source: 'iana',
        extensions: ['mrc'],
      },
      'application/marcxml+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['mrcx'],
      },
      'application/mathematica': {
        source: 'iana',
        extensions: ['ma', 'nb', 'mb'],
      },
      'application/mathml+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['mathml'],
      },
      'application/mathml-content+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/mathml-presentation+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/mbms-associated-procedure-description+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/mbms-deregister+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/mbms-envelope+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/mbms-msk+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/mbms-msk-response+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/mbms-protection-description+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/mbms-reception-report+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/mbms-register+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/mbms-register-response+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/mbms-schedule+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/mbms-user-service-description+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/mbox': {
        source: 'iana',
        extensions: ['mbox'],
      },
      'application/media-policy-dataset+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['mpf'],
      },
      'application/media_control+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/mediaservercontrol+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['mscml'],
      },
      'application/merge-patch+json': {
        source: 'iana',
        compressible: true,
      },
      'application/metalink+xml': {
        source: 'apache',
        compressible: true,
        extensions: ['metalink'],
      },
      'application/metalink4+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['meta4'],
      },
      'application/mets+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['mets'],
      },
      'application/mf4': {
        source: 'iana',
      },
      'application/mikey': {
        source: 'iana',
      },
      'application/mipc': {
        source: 'iana',
      },
      'application/missing-blocks+cbor-seq': {
        source: 'iana',
      },
      'application/mmt-aei+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['maei'],
      },
      'application/mmt-usd+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['musd'],
      },
      'application/mods+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['mods'],
      },
      'application/moss-keys': {
        source: 'iana',
      },
      'application/moss-signature': {
        source: 'iana',
      },
      'application/mosskey-data': {
        source: 'iana',
      },
      'application/mosskey-request': {
        source: 'iana',
      },
      'application/mp21': {
        source: 'iana',
        extensions: ['m21', 'mp21'],
      },
      'application/mp4': {
        source: 'iana',
        extensions: ['mp4s', 'm4p'],
      },
      'application/mpeg4-generic': {
        source: 'iana',
      },
      'application/mpeg4-iod': {
        source: 'iana',
      },
      'application/mpeg4-iod-xmt': {
        source: 'iana',
      },
      'application/mrb-consumer+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/mrb-publish+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/msc-ivr+xml': {
        source: 'iana',
        charset: 'UTF-8',
        compressible: true,
      },
      'application/msc-mixer+xml': {
        source: 'iana',
        charset: 'UTF-8',
        compressible: true,
      },
      'application/msword': {
        source: 'iana',
        compressible: false,
        extensions: ['doc', 'dot'],
      },
      'application/mud+json': {
        source: 'iana',
        compressible: true,
      },
      'application/multipart-core': {
        source: 'iana',
      },
      'application/mxf': {
        source: 'iana',
        extensions: ['mxf'],
      },
      'application/n-quads': {
        source: 'iana',
        extensions: ['nq'],
      },
      'application/n-triples': {
        source: 'iana',
        extensions: ['nt'],
      },
      'application/nasdata': {
        source: 'iana',
      },
      'application/news-checkgroups': {
        source: 'iana',
        charset: 'US-ASCII',
      },
      'application/news-groupinfo': {
        source: 'iana',
        charset: 'US-ASCII',
      },
      'application/news-transmission': {
        source: 'iana',
      },
      'application/nlsml+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/node': {
        source: 'iana',
        extensions: ['cjs'],
      },
      'application/nss': {
        source: 'iana',
      },
      'application/oauth-authz-req+jwt': {
        source: 'iana',
      },
      'application/oblivious-dns-message': {
        source: 'iana',
      },
      'application/ocsp-request': {
        source: 'iana',
      },
      'application/ocsp-response': {
        source: 'iana',
      },
      'application/octet-stream': {
        source: 'iana',
        compressible: false,
        extensions: [
          'bin',
          'dms',
          'lrf',
          'mar',
          'so',
          'dist',
          'distz',
          'pkg',
          'bpk',
          'dump',
          'elc',
          'deploy',
          'exe',
          'dll',
          'deb',
          'dmg',
          'iso',
          'img',
          'msi',
          'msp',
          'msm',
          'buffer',
        ],
      },
      'application/oda': {
        source: 'iana',
        extensions: ['oda'],
      },
      'application/odm+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/odx': {
        source: 'iana',
      },
      'application/oebps-package+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['opf'],
      },
      'application/ogg': {
        source: 'iana',
        compressible: false,
        extensions: ['ogx'],
      },
      'application/omdoc+xml': {
        source: 'apache',
        compressible: true,
        extensions: ['omdoc'],
      },
      'application/onenote': {
        source: 'apache',
        extensions: ['onetoc', 'onetoc2', 'onetmp', 'onepkg'],
      },
      'application/opc-nodeset+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/oscore': {
        source: 'iana',
      },
      'application/oxps': {
        source: 'iana',
        extensions: ['oxps'],
      },
      'application/p21': {
        source: 'iana',
      },
      'application/p21+zip': {
        source: 'iana',
        compressible: false,
      },
      'application/p2p-overlay+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['relo'],
      },
      'application/parityfec': {
        source: 'iana',
      },
      'application/passport': {
        source: 'iana',
      },
      'application/patch-ops-error+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['xer'],
      },
      'application/pdf': {
        source: 'iana',
        compressible: false,
        extensions: ['pdf'],
      },
      'application/pdx': {
        source: 'iana',
      },
      'application/pem-certificate-chain': {
        source: 'iana',
      },
      'application/pgp-encrypted': {
        source: 'iana',
        compressible: false,
        extensions: ['pgp'],
      },
      'application/pgp-keys': {
        source: 'iana',
        extensions: ['asc'],
      },
      'application/pgp-signature': {
        source: 'iana',
        extensions: ['asc', 'sig'],
      },
      'application/pics-rules': {
        source: 'apache',
        extensions: ['prf'],
      },
      'application/pidf+xml': {
        source: 'iana',
        charset: 'UTF-8',
        compressible: true,
      },
      'application/pidf-diff+xml': {
        source: 'iana',
        charset: 'UTF-8',
        compressible: true,
      },
      'application/pkcs10': {
        source: 'iana',
        extensions: ['p10'],
      },
      'application/pkcs12': {
        source: 'iana',
      },
      'application/pkcs7-mime': {
        source: 'iana',
        extensions: ['p7m', 'p7c'],
      },
      'application/pkcs7-signature': {
        source: 'iana',
        extensions: ['p7s'],
      },
      'application/pkcs8': {
        source: 'iana',
        extensions: ['p8'],
      },
      'application/pkcs8-encrypted': {
        source: 'iana',
      },
      'application/pkix-attr-cert': {
        source: 'iana',
        extensions: ['ac'],
      },
      'application/pkix-cert': {
        source: 'iana',
        extensions: ['cer'],
      },
      'application/pkix-crl': {
        source: 'iana',
        extensions: ['crl'],
      },
      'application/pkix-pkipath': {
        source: 'iana',
        extensions: ['pkipath'],
      },
      'application/pkixcmp': {
        source: 'iana',
        extensions: ['pki'],
      },
      'application/pls+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['pls'],
      },
      'application/poc-settings+xml': {
        source: 'iana',
        charset: 'UTF-8',
        compressible: true,
      },
      'application/postscript': {
        source: 'iana',
        compressible: true,
        extensions: ['ai', 'eps', 'ps'],
      },
      'application/ppsp-tracker+json': {
        source: 'iana',
        compressible: true,
      },
      'application/problem+json': {
        source: 'iana',
        compressible: true,
      },
      'application/problem+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/provenance+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['provx'],
      },
      'application/prs.alvestrand.titrax-sheet': {
        source: 'iana',
      },
      'application/prs.cww': {
        source: 'iana',
        extensions: ['cww'],
      },
      'application/prs.cyn': {
        source: 'iana',
        charset: '7-BIT',
      },
      'application/prs.hpub+zip': {
        source: 'iana',
        compressible: false,
      },
      'application/prs.nprend': {
        source: 'iana',
      },
      'application/prs.plucker': {
        source: 'iana',
      },
      'application/prs.rdf-xml-crypt': {
        source: 'iana',
      },
      'application/prs.xsf+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/pskc+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['pskcxml'],
      },
      'application/pvd+json': {
        source: 'iana',
        compressible: true,
      },
      'application/qsig': {
        source: 'iana',
      },
      'application/raml+yaml': {
        compressible: true,
        extensions: ['raml'],
      },
      'application/raptorfec': {
        source: 'iana',
      },
      'application/rdap+json': {
        source: 'iana',
        compressible: true,
      },
      'application/rdf+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['rdf', 'owl'],
      },
      'application/reginfo+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['rif'],
      },
      'application/relax-ng-compact-syntax': {
        source: 'iana',
        extensions: ['rnc'],
      },
      'application/remote-printing': {
        source: 'iana',
      },
      'application/reputon+json': {
        source: 'iana',
        compressible: true,
      },
      'application/resource-lists+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['rl'],
      },
      'application/resource-lists-diff+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['rld'],
      },
      'application/rfc+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/riscos': {
        source: 'iana',
      },
      'application/rlmi+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/rls-services+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['rs'],
      },
      'application/route-apd+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['rapd'],
      },
      'application/route-s-tsid+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['sls'],
      },
      'application/route-usd+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['rusd'],
      },
      'application/rpki-ghostbusters': {
        source: 'iana',
        extensions: ['gbr'],
      },
      'application/rpki-manifest': {
        source: 'iana',
        extensions: ['mft'],
      },
      'application/rpki-publication': {
        source: 'iana',
      },
      'application/rpki-roa': {
        source: 'iana',
        extensions: ['roa'],
      },
      'application/rpki-updown': {
        source: 'iana',
      },
      'application/rsd+xml': {
        source: 'apache',
        compressible: true,
        extensions: ['rsd'],
      },
      'application/rss+xml': {
        source: 'apache',
        compressible: true,
        extensions: ['rss'],
      },
      'application/rtf': {
        source: 'iana',
        compressible: true,
        extensions: ['rtf'],
      },
      'application/rtploopback': {
        source: 'iana',
      },
      'application/rtx': {
        source: 'iana',
      },
      'application/samlassertion+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/samlmetadata+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/sarif+json': {
        source: 'iana',
        compressible: true,
      },
      'application/sarif-external-properties+json': {
        source: 'iana',
        compressible: true,
      },
      'application/sbe': {
        source: 'iana',
      },
      'application/sbml+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['sbml'],
      },
      'application/scaip+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/scim+json': {
        source: 'iana',
        compressible: true,
      },
      'application/scvp-cv-request': {
        source: 'iana',
        extensions: ['scq'],
      },
      'application/scvp-cv-response': {
        source: 'iana',
        extensions: ['scs'],
      },
      'application/scvp-vp-request': {
        source: 'iana',
        extensions: ['spq'],
      },
      'application/scvp-vp-response': {
        source: 'iana',
        extensions: ['spp'],
      },
      'application/sdp': {
        source: 'iana',
        extensions: ['sdp'],
      },
      'application/secevent+jwt': {
        source: 'iana',
      },
      'application/senml+cbor': {
        source: 'iana',
      },
      'application/senml+json': {
        source: 'iana',
        compressible: true,
      },
      'application/senml+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['senmlx'],
      },
      'application/senml-etch+cbor': {
        source: 'iana',
      },
      'application/senml-etch+json': {
        source: 'iana',
        compressible: true,
      },
      'application/senml-exi': {
        source: 'iana',
      },
      'application/sensml+cbor': {
        source: 'iana',
      },
      'application/sensml+json': {
        source: 'iana',
        compressible: true,
      },
      'application/sensml+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['sensmlx'],
      },
      'application/sensml-exi': {
        source: 'iana',
      },
      'application/sep+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/sep-exi': {
        source: 'iana',
      },
      'application/session-info': {
        source: 'iana',
      },
      'application/set-payment': {
        source: 'iana',
      },
      'application/set-payment-initiation': {
        source: 'iana',
        extensions: ['setpay'],
      },
      'application/set-registration': {
        source: 'iana',
      },
      'application/set-registration-initiation': {
        source: 'iana',
        extensions: ['setreg'],
      },
      'application/sgml': {
        source: 'iana',
      },
      'application/sgml-open-catalog': {
        source: 'iana',
      },
      'application/shf+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['shf'],
      },
      'application/sieve': {
        source: 'iana',
        extensions: ['siv', 'sieve'],
      },
      'application/simple-filter+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/simple-message-summary': {
        source: 'iana',
      },
      'application/simplesymbolcontainer': {
        source: 'iana',
      },
      'application/sipc': {
        source: 'iana',
      },
      'application/slate': {
        source: 'iana',
      },
      'application/smil': {
        source: 'iana',
      },
      'application/smil+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['smi', 'smil'],
      },
      'application/smpte336m': {
        source: 'iana',
      },
      'application/soap+fastinfoset': {
        source: 'iana',
      },
      'application/soap+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/sparql-query': {
        source: 'iana',
        extensions: ['rq'],
      },
      'application/sparql-results+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['srx'],
      },
      'application/spdx+json': {
        source: 'iana',
        compressible: true,
      },
      'application/spirits-event+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/sql': {
        source: 'iana',
      },
      'application/srgs': {
        source: 'iana',
        extensions: ['gram'],
      },
      'application/srgs+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['grxml'],
      },
      'application/sru+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['sru'],
      },
      'application/ssdl+xml': {
        source: 'apache',
        compressible: true,
        extensions: ['ssdl'],
      },
      'application/ssml+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['ssml'],
      },
      'application/stix+json': {
        source: 'iana',
        compressible: true,
      },
      'application/swid+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['swidtag'],
      },
      'application/tamp-apex-update': {
        source: 'iana',
      },
      'application/tamp-apex-update-confirm': {
        source: 'iana',
      },
      'application/tamp-community-update': {
        source: 'iana',
      },
      'application/tamp-community-update-confirm': {
        source: 'iana',
      },
      'application/tamp-error': {
        source: 'iana',
      },
      'application/tamp-sequence-adjust': {
        source: 'iana',
      },
      'application/tamp-sequence-adjust-confirm': {
        source: 'iana',
      },
      'application/tamp-status-query': {
        source: 'iana',
      },
      'application/tamp-status-response': {
        source: 'iana',
      },
      'application/tamp-update': {
        source: 'iana',
      },
      'application/tamp-update-confirm': {
        source: 'iana',
      },
      'application/tar': {
        compressible: true,
      },
      'application/taxii+json': {
        source: 'iana',
        compressible: true,
      },
      'application/td+json': {
        source: 'iana',
        compressible: true,
      },
      'application/tei+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['tei', 'teicorpus'],
      },
      'application/tetra_isi': {
        source: 'iana',
      },
      'application/thraud+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['tfi'],
      },
      'application/timestamp-query': {
        source: 'iana',
      },
      'application/timestamp-reply': {
        source: 'iana',
      },
      'application/timestamped-data': {
        source: 'iana',
        extensions: ['tsd'],
      },
      'application/tlsrpt+gzip': {
        source: 'iana',
      },
      'application/tlsrpt+json': {
        source: 'iana',
        compressible: true,
      },
      'application/tnauthlist': {
        source: 'iana',
      },
      'application/token-introspection+jwt': {
        source: 'iana',
      },
      'application/toml': {
        compressible: true,
        extensions: ['toml'],
      },
      'application/trickle-ice-sdpfrag': {
        source: 'iana',
      },
      'application/trig': {
        source: 'iana',
        extensions: ['trig'],
      },
      'application/ttml+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['ttml'],
      },
      'application/tve-trigger': {
        source: 'iana',
      },
      'application/tzif': {
        source: 'iana',
      },
      'application/tzif-leap': {
        source: 'iana',
      },
      'application/ubjson': {
        compressible: false,
        extensions: ['ubj'],
      },
      'application/ulpfec': {
        source: 'iana',
      },
      'application/urc-grpsheet+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/urc-ressheet+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['rsheet'],
      },
      'application/urc-targetdesc+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['td'],
      },
      'application/urc-uisocketdesc+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vcard+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vcard+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vemmi': {
        source: 'iana',
      },
      'application/vividence.scriptfile': {
        source: 'apache',
      },
      'application/vnd.1000minds.decision-model+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['1km'],
      },
      'application/vnd.3gpp-prose+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp-prose-pc3ch+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp-v2x-local-service-information': {
        source: 'iana',
      },
      'application/vnd.3gpp.5gnas': {
        source: 'iana',
      },
      'application/vnd.3gpp.access-transfer-events+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.bsf+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.gmop+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.gtpc': {
        source: 'iana',
      },
      'application/vnd.3gpp.interworking-data': {
        source: 'iana',
      },
      'application/vnd.3gpp.lpp': {
        source: 'iana',
      },
      'application/vnd.3gpp.mc-signalling-ear': {
        source: 'iana',
      },
      'application/vnd.3gpp.mcdata-affiliation-command+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.mcdata-info+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.mcdata-payload': {
        source: 'iana',
      },
      'application/vnd.3gpp.mcdata-service-config+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.mcdata-signalling': {
        source: 'iana',
      },
      'application/vnd.3gpp.mcdata-ue-config+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.mcdata-user-profile+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.mcptt-affiliation-command+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.mcptt-floor-request+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.mcptt-info+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.mcptt-location-info+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.mcptt-mbms-usage-info+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.mcptt-service-config+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.mcptt-signed+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.mcptt-ue-config+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.mcptt-ue-init-config+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.mcptt-user-profile+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.mcvideo-affiliation-command+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.mcvideo-affiliation-info+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.mcvideo-info+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.mcvideo-location-info+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.mcvideo-mbms-usage-info+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.mcvideo-service-config+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.mcvideo-transmission-request+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.mcvideo-ue-config+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.mcvideo-user-profile+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.mid-call+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.ngap': {
        source: 'iana',
      },
      'application/vnd.3gpp.pfcp': {
        source: 'iana',
      },
      'application/vnd.3gpp.pic-bw-large': {
        source: 'iana',
        extensions: ['plb'],
      },
      'application/vnd.3gpp.pic-bw-small': {
        source: 'iana',
        extensions: ['psb'],
      },
      'application/vnd.3gpp.pic-bw-var': {
        source: 'iana',
        extensions: ['pvb'],
      },
      'application/vnd.3gpp.s1ap': {
        source: 'iana',
      },
      'application/vnd.3gpp.sms': {
        source: 'iana',
      },
      'application/vnd.3gpp.sms+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.srvcc-ext+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.srvcc-info+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.state-and-event-info+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp.ussd+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp2.bcmcsinfo+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.3gpp2.sms': {
        source: 'iana',
      },
      'application/vnd.3gpp2.tcap': {
        source: 'iana',
        extensions: ['tcap'],
      },
      'application/vnd.3lightssoftware.imagescal': {
        source: 'iana',
      },
      'application/vnd.3m.post-it-notes': {
        source: 'iana',
        extensions: ['pwn'],
      },
      'application/vnd.accpac.simply.aso': {
        source: 'iana',
        extensions: ['aso'],
      },
      'application/vnd.accpac.simply.imp': {
        source: 'iana',
        extensions: ['imp'],
      },
      'application/vnd.acucobol': {
        source: 'iana',
        extensions: ['acu'],
      },
      'application/vnd.acucorp': {
        source: 'iana',
        extensions: ['atc', 'acutc'],
      },
      'application/vnd.adobe.air-application-installer-package+zip': {
        source: 'apache',
        compressible: false,
        extensions: ['air'],
      },
      'application/vnd.adobe.flash.movie': {
        source: 'iana',
      },
      'application/vnd.adobe.formscentral.fcdt': {
        source: 'iana',
        extensions: ['fcdt'],
      },
      'application/vnd.adobe.fxp': {
        source: 'iana',
        extensions: ['fxp', 'fxpl'],
      },
      'application/vnd.adobe.partial-upload': {
        source: 'iana',
      },
      'application/vnd.adobe.xdp+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['xdp'],
      },
      'application/vnd.adobe.xfdf': {
        source: 'iana',
        extensions: ['xfdf'],
      },
      'application/vnd.aether.imp': {
        source: 'iana',
      },
      'application/vnd.afpc.afplinedata': {
        source: 'iana',
      },
      'application/vnd.afpc.afplinedata-pagedef': {
        source: 'iana',
      },
      'application/vnd.afpc.cmoca-cmresource': {
        source: 'iana',
      },
      'application/vnd.afpc.foca-charset': {
        source: 'iana',
      },
      'application/vnd.afpc.foca-codedfont': {
        source: 'iana',
      },
      'application/vnd.afpc.foca-codepage': {
        source: 'iana',
      },
      'application/vnd.afpc.modca': {
        source: 'iana',
      },
      'application/vnd.afpc.modca-cmtable': {
        source: 'iana',
      },
      'application/vnd.afpc.modca-formdef': {
        source: 'iana',
      },
      'application/vnd.afpc.modca-mediummap': {
        source: 'iana',
      },
      'application/vnd.afpc.modca-objectcontainer': {
        source: 'iana',
      },
      'application/vnd.afpc.modca-overlay': {
        source: 'iana',
      },
      'application/vnd.afpc.modca-pagesegment': {
        source: 'iana',
      },
      'application/vnd.age': {
        source: 'iana',
        extensions: ['age'],
      },
      'application/vnd.ah-barcode': {
        source: 'iana',
      },
      'application/vnd.ahead.space': {
        source: 'iana',
        extensions: ['ahead'],
      },
      'application/vnd.airzip.filesecure.azf': {
        source: 'iana',
        extensions: ['azf'],
      },
      'application/vnd.airzip.filesecure.azs': {
        source: 'iana',
        extensions: ['azs'],
      },
      'application/vnd.amadeus+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.amazon.ebook': {
        source: 'apache',
        extensions: ['azw'],
      },
      'application/vnd.amazon.mobi8-ebook': {
        source: 'iana',
      },
      'application/vnd.americandynamics.acc': {
        source: 'iana',
        extensions: ['acc'],
      },
      'application/vnd.amiga.ami': {
        source: 'iana',
        extensions: ['ami'],
      },
      'application/vnd.amundsen.maze+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.android.ota': {
        source: 'iana',
      },
      'application/vnd.android.package-archive': {
        source: 'apache',
        compressible: false,
        extensions: ['apk'],
      },
      'application/vnd.anki': {
        source: 'iana',
      },
      'application/vnd.anser-web-certificate-issue-initiation': {
        source: 'iana',
        extensions: ['cii'],
      },
      'application/vnd.anser-web-funds-transfer-initiation': {
        source: 'apache',
        extensions: ['fti'],
      },
      'application/vnd.antix.game-component': {
        source: 'iana',
        extensions: ['atx'],
      },
      'application/vnd.apache.arrow.file': {
        source: 'iana',
      },
      'application/vnd.apache.arrow.stream': {
        source: 'iana',
      },
      'application/vnd.apache.thrift.binary': {
        source: 'iana',
      },
      'application/vnd.apache.thrift.compact': {
        source: 'iana',
      },
      'application/vnd.apache.thrift.json': {
        source: 'iana',
      },
      'application/vnd.api+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.aplextor.warrp+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.apothekende.reservation+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.apple.installer+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['mpkg'],
      },
      'application/vnd.apple.keynote': {
        source: 'iana',
        extensions: ['key'],
      },
      'application/vnd.apple.mpegurl': {
        source: 'iana',
        extensions: ['m3u8'],
      },
      'application/vnd.apple.numbers': {
        source: 'iana',
        extensions: ['numbers'],
      },
      'application/vnd.apple.pages': {
        source: 'iana',
        extensions: ['pages'],
      },
      'application/vnd.apple.pkpass': {
        compressible: false,
        extensions: ['pkpass'],
      },
      'application/vnd.arastra.swi': {
        source: 'iana',
      },
      'application/vnd.aristanetworks.swi': {
        source: 'iana',
        extensions: ['swi'],
      },
      'application/vnd.artisan+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.artsquare': {
        source: 'iana',
      },
      'application/vnd.astraea-software.iota': {
        source: 'iana',
        extensions: ['iota'],
      },
      'application/vnd.audiograph': {
        source: 'iana',
        extensions: ['aep'],
      },
      'application/vnd.autopackage': {
        source: 'iana',
      },
      'application/vnd.avalon+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.avistar+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.balsamiq.bmml+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['bmml'],
      },
      'application/vnd.balsamiq.bmpr': {
        source: 'iana',
      },
      'application/vnd.banana-accounting': {
        source: 'iana',
      },
      'application/vnd.bbf.usp.error': {
        source: 'iana',
      },
      'application/vnd.bbf.usp.msg': {
        source: 'iana',
      },
      'application/vnd.bbf.usp.msg+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.bekitzur-stech+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.bint.med-content': {
        source: 'iana',
      },
      'application/vnd.biopax.rdf+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.blink-idb-value-wrapper': {
        source: 'iana',
      },
      'application/vnd.blueice.multipass': {
        source: 'iana',
        extensions: ['mpm'],
      },
      'application/vnd.bluetooth.ep.oob': {
        source: 'iana',
      },
      'application/vnd.bluetooth.le.oob': {
        source: 'iana',
      },
      'application/vnd.bmi': {
        source: 'iana',
        extensions: ['bmi'],
      },
      'application/vnd.bpf': {
        source: 'iana',
      },
      'application/vnd.bpf3': {
        source: 'iana',
      },
      'application/vnd.businessobjects': {
        source: 'iana',
        extensions: ['rep'],
      },
      'application/vnd.byu.uapi+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.cab-jscript': {
        source: 'iana',
      },
      'application/vnd.canon-cpdl': {
        source: 'iana',
      },
      'application/vnd.canon-lips': {
        source: 'iana',
      },
      'application/vnd.capasystems-pg+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.cendio.thinlinc.clientconf': {
        source: 'iana',
      },
      'application/vnd.century-systems.tcp_stream': {
        source: 'iana',
      },
      'application/vnd.chemdraw+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['cdxml'],
      },
      'application/vnd.chess-pgn': {
        source: 'iana',
      },
      'application/vnd.chipnuts.karaoke-mmd': {
        source: 'iana',
        extensions: ['mmd'],
      },
      'application/vnd.ciedi': {
        source: 'iana',
      },
      'application/vnd.cinderella': {
        source: 'iana',
        extensions: ['cdy'],
      },
      'application/vnd.cirpack.isdn-ext': {
        source: 'iana',
      },
      'application/vnd.citationstyles.style+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['csl'],
      },
      'application/vnd.claymore': {
        source: 'iana',
        extensions: ['cla'],
      },
      'application/vnd.cloanto.rp9': {
        source: 'iana',
        extensions: ['rp9'],
      },
      'application/vnd.clonk.c4group': {
        source: 'iana',
        extensions: ['c4g', 'c4d', 'c4f', 'c4p', 'c4u'],
      },
      'application/vnd.cluetrust.cartomobile-config': {
        source: 'iana',
        extensions: ['c11amc'],
      },
      'application/vnd.cluetrust.cartomobile-config-pkg': {
        source: 'iana',
        extensions: ['c11amz'],
      },
      'application/vnd.coffeescript': {
        source: 'iana',
      },
      'application/vnd.collabio.xodocuments.document': {
        source: 'iana',
      },
      'application/vnd.collabio.xodocuments.document-template': {
        source: 'iana',
      },
      'application/vnd.collabio.xodocuments.presentation': {
        source: 'iana',
      },
      'application/vnd.collabio.xodocuments.presentation-template': {
        source: 'iana',
      },
      'application/vnd.collabio.xodocuments.spreadsheet': {
        source: 'iana',
      },
      'application/vnd.collabio.xodocuments.spreadsheet-template': {
        source: 'iana',
      },
      'application/vnd.collection+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.collection.doc+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.collection.next+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.comicbook+zip': {
        source: 'iana',
        compressible: false,
      },
      'application/vnd.comicbook-rar': {
        source: 'iana',
      },
      'application/vnd.commerce-battelle': {
        source: 'iana',
      },
      'application/vnd.commonspace': {
        source: 'iana',
        extensions: ['csp'],
      },
      'application/vnd.contact.cmsg': {
        source: 'iana',
        extensions: ['cdbcmsg'],
      },
      'application/vnd.coreos.ignition+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.cosmocaller': {
        source: 'iana',
        extensions: ['cmc'],
      },
      'application/vnd.crick.clicker': {
        source: 'iana',
        extensions: ['clkx'],
      },
      'application/vnd.crick.clicker.keyboard': {
        source: 'iana',
        extensions: ['clkk'],
      },
      'application/vnd.crick.clicker.palette': {
        source: 'iana',
        extensions: ['clkp'],
      },
      'application/vnd.crick.clicker.template': {
        source: 'iana',
        extensions: ['clkt'],
      },
      'application/vnd.crick.clicker.wordbank': {
        source: 'iana',
        extensions: ['clkw'],
      },
      'application/vnd.criticaltools.wbs+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['wbs'],
      },
      'application/vnd.cryptii.pipe+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.crypto-shade-file': {
        source: 'iana',
      },
      'application/vnd.cryptomator.encrypted': {
        source: 'iana',
      },
      'application/vnd.cryptomator.vault': {
        source: 'iana',
      },
      'application/vnd.ctc-posml': {
        source: 'iana',
        extensions: ['pml'],
      },
      'application/vnd.ctct.ws+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.cups-pdf': {
        source: 'iana',
      },
      'application/vnd.cups-postscript': {
        source: 'iana',
      },
      'application/vnd.cups-ppd': {
        source: 'iana',
        extensions: ['ppd'],
      },
      'application/vnd.cups-raster': {
        source: 'iana',
      },
      'application/vnd.cups-raw': {
        source: 'iana',
      },
      'application/vnd.curl': {
        source: 'iana',
      },
      'application/vnd.curl.car': {
        source: 'apache',
        extensions: ['car'],
      },
      'application/vnd.curl.pcurl': {
        source: 'apache',
        extensions: ['pcurl'],
      },
      'application/vnd.cyan.dean.root+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.cybank': {
        source: 'iana',
      },
      'application/vnd.cyclonedx+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.cyclonedx+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.d2l.coursepackage1p0+zip': {
        source: 'iana',
        compressible: false,
      },
      'application/vnd.d3m-dataset': {
        source: 'iana',
      },
      'application/vnd.d3m-problem': {
        source: 'iana',
      },
      'application/vnd.dart': {
        source: 'iana',
        compressible: true,
        extensions: ['dart'],
      },
      'application/vnd.data-vision.rdz': {
        source: 'iana',
        extensions: ['rdz'],
      },
      'application/vnd.datapackage+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.dataresource+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.dbf': {
        source: 'iana',
        extensions: ['dbf'],
      },
      'application/vnd.debian.binary-package': {
        source: 'iana',
      },
      'application/vnd.dece.data': {
        source: 'iana',
        extensions: ['uvf', 'uvvf', 'uvd', 'uvvd'],
      },
      'application/vnd.dece.ttml+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['uvt', 'uvvt'],
      },
      'application/vnd.dece.unspecified': {
        source: 'iana',
        extensions: ['uvx', 'uvvx'],
      },
      'application/vnd.dece.zip': {
        source: 'iana',
        extensions: ['uvz', 'uvvz'],
      },
      'application/vnd.denovo.fcselayout-link': {
        source: 'iana',
        extensions: ['fe_launch'],
      },
      'application/vnd.desmume.movie': {
        source: 'iana',
      },
      'application/vnd.dir-bi.plate-dl-nosuffix': {
        source: 'iana',
      },
      'application/vnd.dm.delegation+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.dna': {
        source: 'iana',
        extensions: ['dna'],
      },
      'application/vnd.document+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.dolby.mlp': {
        source: 'apache',
        extensions: ['mlp'],
      },
      'application/vnd.dolby.mobile.1': {
        source: 'iana',
      },
      'application/vnd.dolby.mobile.2': {
        source: 'iana',
      },
      'application/vnd.doremir.scorecloud-binary-document': {
        source: 'iana',
      },
      'application/vnd.dpgraph': {
        source: 'iana',
        extensions: ['dpg'],
      },
      'application/vnd.dreamfactory': {
        source: 'iana',
        extensions: ['dfac'],
      },
      'application/vnd.drive+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.ds-keypoint': {
        source: 'apache',
        extensions: ['kpxx'],
      },
      'application/vnd.dtg.local': {
        source: 'iana',
      },
      'application/vnd.dtg.local.flash': {
        source: 'iana',
      },
      'application/vnd.dtg.local.html': {
        source: 'iana',
      },
      'application/vnd.dvb.ait': {
        source: 'iana',
        extensions: ['ait'],
      },
      'application/vnd.dvb.dvbisl+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.dvb.dvbj': {
        source: 'iana',
      },
      'application/vnd.dvb.esgcontainer': {
        source: 'iana',
      },
      'application/vnd.dvb.ipdcdftnotifaccess': {
        source: 'iana',
      },
      'application/vnd.dvb.ipdcesgaccess': {
        source: 'iana',
      },
      'application/vnd.dvb.ipdcesgaccess2': {
        source: 'iana',
      },
      'application/vnd.dvb.ipdcesgpdd': {
        source: 'iana',
      },
      'application/vnd.dvb.ipdcroaming': {
        source: 'iana',
      },
      'application/vnd.dvb.iptv.alfec-base': {
        source: 'iana',
      },
      'application/vnd.dvb.iptv.alfec-enhancement': {
        source: 'iana',
      },
      'application/vnd.dvb.notif-aggregate-root+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.dvb.notif-container+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.dvb.notif-generic+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.dvb.notif-ia-msglist+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.dvb.notif-ia-registration-request+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.dvb.notif-ia-registration-response+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.dvb.notif-init+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.dvb.pfr': {
        source: 'iana',
      },
      'application/vnd.dvb.service': {
        source: 'iana',
        extensions: ['svc'],
      },
      'application/vnd.dxr': {
        source: 'iana',
      },
      'application/vnd.dynageo': {
        source: 'iana',
        extensions: ['geo'],
      },
      'application/vnd.dzr': {
        source: 'iana',
      },
      'application/vnd.easykaraoke.cdgdownload': {
        source: 'iana',
      },
      'application/vnd.ecdis-update': {
        source: 'iana',
      },
      'application/vnd.ecip.rlp': {
        source: 'iana',
      },
      'application/vnd.eclipse.ditto+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.ecowin.chart': {
        source: 'iana',
        extensions: ['mag'],
      },
      'application/vnd.ecowin.filerequest': {
        source: 'iana',
      },
      'application/vnd.ecowin.fileupdate': {
        source: 'iana',
      },
      'application/vnd.ecowin.series': {
        source: 'iana',
      },
      'application/vnd.ecowin.seriesrequest': {
        source: 'iana',
      },
      'application/vnd.ecowin.seriesupdate': {
        source: 'iana',
      },
      'application/vnd.efi.img': {
        source: 'iana',
      },
      'application/vnd.efi.iso': {
        source: 'iana',
      },
      'application/vnd.emclient.accessrequest+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.enliven': {
        source: 'iana',
        extensions: ['nml'],
      },
      'application/vnd.enphase.envoy': {
        source: 'iana',
      },
      'application/vnd.eprints.data+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.epson.esf': {
        source: 'iana',
        extensions: ['esf'],
      },
      'application/vnd.epson.msf': {
        source: 'iana',
        extensions: ['msf'],
      },
      'application/vnd.epson.quickanime': {
        source: 'iana',
        extensions: ['qam'],
      },
      'application/vnd.epson.salt': {
        source: 'iana',
        extensions: ['slt'],
      },
      'application/vnd.epson.ssf': {
        source: 'iana',
        extensions: ['ssf'],
      },
      'application/vnd.ericsson.quickcall': {
        source: 'iana',
      },
      'application/vnd.espass-espass+zip': {
        source: 'iana',
        compressible: false,
      },
      'application/vnd.eszigno3+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['es3', 'et3'],
      },
      'application/vnd.etsi.aoc+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.etsi.asic-e+zip': {
        source: 'iana',
        compressible: false,
      },
      'application/vnd.etsi.asic-s+zip': {
        source: 'iana',
        compressible: false,
      },
      'application/vnd.etsi.cug+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.etsi.iptvcommand+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.etsi.iptvdiscovery+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.etsi.iptvprofile+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.etsi.iptvsad-bc+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.etsi.iptvsad-cod+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.etsi.iptvsad-npvr+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.etsi.iptvservice+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.etsi.iptvsync+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.etsi.iptvueprofile+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.etsi.mcid+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.etsi.mheg5': {
        source: 'iana',
      },
      'application/vnd.etsi.overload-control-policy-dataset+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.etsi.pstn+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.etsi.sci+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.etsi.simservs+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.etsi.timestamp-token': {
        source: 'iana',
      },
      'application/vnd.etsi.tsl+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.etsi.tsl.der': {
        source: 'iana',
      },
      'application/vnd.eu.kasparian.car+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.eudora.data': {
        source: 'iana',
      },
      'application/vnd.evolv.ecig.profile': {
        source: 'iana',
      },
      'application/vnd.evolv.ecig.settings': {
        source: 'iana',
      },
      'application/vnd.evolv.ecig.theme': {
        source: 'iana',
      },
      'application/vnd.exstream-empower+zip': {
        source: 'iana',
        compressible: false,
      },
      'application/vnd.exstream-package': {
        source: 'iana',
      },
      'application/vnd.ezpix-album': {
        source: 'iana',
        extensions: ['ez2'],
      },
      'application/vnd.ezpix-package': {
        source: 'iana',
        extensions: ['ez3'],
      },
      'application/vnd.f-secure.mobile': {
        source: 'iana',
      },
      'application/vnd.familysearch.gedcom+zip': {
        source: 'iana',
        compressible: false,
      },
      'application/vnd.fastcopy-disk-image': {
        source: 'iana',
      },
      'application/vnd.fdf': {
        source: 'iana',
        extensions: ['fdf'],
      },
      'application/vnd.fdsn.mseed': {
        source: 'iana',
        extensions: ['mseed'],
      },
      'application/vnd.fdsn.seed': {
        source: 'iana',
        extensions: ['seed', 'dataless'],
      },
      'application/vnd.ffsns': {
        source: 'iana',
      },
      'application/vnd.ficlab.flb+zip': {
        source: 'iana',
        compressible: false,
      },
      'application/vnd.filmit.zfc': {
        source: 'iana',
      },
      'application/vnd.fints': {
        source: 'iana',
      },
      'application/vnd.firemonkeys.cloudcell': {
        source: 'iana',
      },
      'application/vnd.flographit': {
        source: 'iana',
        extensions: ['gph'],
      },
      'application/vnd.fluxtime.clip': {
        source: 'iana',
        extensions: ['ftc'],
      },
      'application/vnd.font-fontforge-sfd': {
        source: 'iana',
      },
      'application/vnd.framemaker': {
        source: 'iana',
        extensions: ['fm', 'frame', 'maker', 'book'],
      },
      'application/vnd.frogans.fnc': {
        source: 'iana',
        extensions: ['fnc'],
      },
      'application/vnd.frogans.ltf': {
        source: 'iana',
        extensions: ['ltf'],
      },
      'application/vnd.fsc.weblaunch': {
        source: 'iana',
        extensions: ['fsc'],
      },
      'application/vnd.fujifilm.fb.docuworks': {
        source: 'iana',
      },
      'application/vnd.fujifilm.fb.docuworks.binder': {
        source: 'iana',
      },
      'application/vnd.fujifilm.fb.docuworks.container': {
        source: 'iana',
      },
      'application/vnd.fujifilm.fb.jfi+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.fujitsu.oasys': {
        source: 'iana',
        extensions: ['oas'],
      },
      'application/vnd.fujitsu.oasys2': {
        source: 'iana',
        extensions: ['oa2'],
      },
      'application/vnd.fujitsu.oasys3': {
        source: 'iana',
        extensions: ['oa3'],
      },
      'application/vnd.fujitsu.oasysgp': {
        source: 'iana',
        extensions: ['fg5'],
      },
      'application/vnd.fujitsu.oasysprs': {
        source: 'iana',
        extensions: ['bh2'],
      },
      'application/vnd.fujixerox.art-ex': {
        source: 'iana',
      },
      'application/vnd.fujixerox.art4': {
        source: 'iana',
      },
      'application/vnd.fujixerox.ddd': {
        source: 'iana',
        extensions: ['ddd'],
      },
      'application/vnd.fujixerox.docuworks': {
        source: 'iana',
        extensions: ['xdw'],
      },
      'application/vnd.fujixerox.docuworks.binder': {
        source: 'iana',
        extensions: ['xbd'],
      },
      'application/vnd.fujixerox.docuworks.container': {
        source: 'iana',
      },
      'application/vnd.fujixerox.hbpl': {
        source: 'iana',
      },
      'application/vnd.fut-misnet': {
        source: 'iana',
      },
      'application/vnd.futoin+cbor': {
        source: 'iana',
      },
      'application/vnd.futoin+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.fuzzysheet': {
        source: 'iana',
        extensions: ['fzs'],
      },
      'application/vnd.genomatix.tuxedo': {
        source: 'iana',
        extensions: ['txd'],
      },
      'application/vnd.gentics.grd+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.geo+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.geocube+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.geogebra.file': {
        source: 'iana',
        extensions: ['ggb'],
      },
      'application/vnd.geogebra.slides': {
        source: 'iana',
      },
      'application/vnd.geogebra.tool': {
        source: 'iana',
        extensions: ['ggt'],
      },
      'application/vnd.geometry-explorer': {
        source: 'iana',
        extensions: ['gex', 'gre'],
      },
      'application/vnd.geonext': {
        source: 'iana',
        extensions: ['gxt'],
      },
      'application/vnd.geoplan': {
        source: 'iana',
        extensions: ['g2w'],
      },
      'application/vnd.geospace': {
        source: 'iana',
        extensions: ['g3w'],
      },
      'application/vnd.gerber': {
        source: 'iana',
      },
      'application/vnd.globalplatform.card-content-mgt': {
        source: 'iana',
      },
      'application/vnd.globalplatform.card-content-mgt-response': {
        source: 'iana',
      },
      'application/vnd.gmx': {
        source: 'iana',
        extensions: ['gmx'],
      },
      'application/vnd.google-apps.document': {
        compressible: false,
        extensions: ['gdoc'],
      },
      'application/vnd.google-apps.presentation': {
        compressible: false,
        extensions: ['gslides'],
      },
      'application/vnd.google-apps.spreadsheet': {
        compressible: false,
        extensions: ['gsheet'],
      },
      'application/vnd.google-earth.kml+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['kml'],
      },
      'application/vnd.google-earth.kmz': {
        source: 'iana',
        compressible: false,
        extensions: ['kmz'],
      },
      'application/vnd.gov.sk.e-form+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.gov.sk.e-form+zip': {
        source: 'iana',
        compressible: false,
      },
      'application/vnd.gov.sk.xmldatacontainer+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.grafeq': {
        source: 'iana',
        extensions: ['gqf', 'gqs'],
      },
      'application/vnd.gridmp': {
        source: 'iana',
      },
      'application/vnd.groove-account': {
        source: 'iana',
        extensions: ['gac'],
      },
      'application/vnd.groove-help': {
        source: 'iana',
        extensions: ['ghf'],
      },
      'application/vnd.groove-identity-message': {
        source: 'iana',
        extensions: ['gim'],
      },
      'application/vnd.groove-injector': {
        source: 'iana',
        extensions: ['grv'],
      },
      'application/vnd.groove-tool-message': {
        source: 'iana',
        extensions: ['gtm'],
      },
      'application/vnd.groove-tool-template': {
        source: 'iana',
        extensions: ['tpl'],
      },
      'application/vnd.groove-vcard': {
        source: 'iana',
        extensions: ['vcg'],
      },
      'application/vnd.hal+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.hal+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['hal'],
      },
      'application/vnd.handheld-entertainment+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['zmm'],
      },
      'application/vnd.hbci': {
        source: 'iana',
        extensions: ['hbci'],
      },
      'application/vnd.hc+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.hcl-bireports': {
        source: 'iana',
      },
      'application/vnd.hdt': {
        source: 'iana',
      },
      'application/vnd.heroku+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.hhe.lesson-player': {
        source: 'iana',
        extensions: ['les'],
      },
      'application/vnd.hl7cda+xml': {
        source: 'iana',
        charset: 'UTF-8',
        compressible: true,
      },
      'application/vnd.hl7v2+xml': {
        source: 'iana',
        charset: 'UTF-8',
        compressible: true,
      },
      'application/vnd.hp-hpgl': {
        source: 'iana',
        extensions: ['hpgl'],
      },
      'application/vnd.hp-hpid': {
        source: 'iana',
        extensions: ['hpid'],
      },
      'application/vnd.hp-hps': {
        source: 'iana',
        extensions: ['hps'],
      },
      'application/vnd.hp-jlyt': {
        source: 'iana',
        extensions: ['jlt'],
      },
      'application/vnd.hp-pcl': {
        source: 'iana',
        extensions: ['pcl'],
      },
      'application/vnd.hp-pclxl': {
        source: 'iana',
        extensions: ['pclxl'],
      },
      'application/vnd.httphone': {
        source: 'iana',
      },
      'application/vnd.hydrostatix.sof-data': {
        source: 'iana',
        extensions: ['sfd-hdstx'],
      },
      'application/vnd.hyper+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.hyper-item+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.hyperdrive+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.hzn-3d-crossword': {
        source: 'iana',
      },
      'application/vnd.ibm.afplinedata': {
        source: 'iana',
      },
      'application/vnd.ibm.electronic-media': {
        source: 'iana',
      },
      'application/vnd.ibm.minipay': {
        source: 'iana',
        extensions: ['mpy'],
      },
      'application/vnd.ibm.modcap': {
        source: 'iana',
        extensions: ['afp', 'listafp', 'list3820'],
      },
      'application/vnd.ibm.rights-management': {
        source: 'iana',
        extensions: ['irm'],
      },
      'application/vnd.ibm.secure-container': {
        source: 'iana',
        extensions: ['sc'],
      },
      'application/vnd.iccprofile': {
        source: 'iana',
        extensions: ['icc', 'icm'],
      },
      'application/vnd.ieee.1905': {
        source: 'iana',
      },
      'application/vnd.igloader': {
        source: 'iana',
        extensions: ['igl'],
      },
      'application/vnd.imagemeter.folder+zip': {
        source: 'iana',
        compressible: false,
      },
      'application/vnd.imagemeter.image+zip': {
        source: 'iana',
        compressible: false,
      },
      'application/vnd.immervision-ivp': {
        source: 'iana',
        extensions: ['ivp'],
      },
      'application/vnd.immervision-ivu': {
        source: 'iana',
        extensions: ['ivu'],
      },
      'application/vnd.ims.imsccv1p1': {
        source: 'iana',
      },
      'application/vnd.ims.imsccv1p2': {
        source: 'iana',
      },
      'application/vnd.ims.imsccv1p3': {
        source: 'iana',
      },
      'application/vnd.ims.lis.v2.result+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.ims.lti.v2.toolconsumerprofile+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.ims.lti.v2.toolproxy+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.ims.lti.v2.toolproxy.id+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.ims.lti.v2.toolsettings+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.ims.lti.v2.toolsettings.simple+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.informedcontrol.rms+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.informix-visionary': {
        source: 'iana',
      },
      'application/vnd.infotech.project': {
        source: 'iana',
      },
      'application/vnd.infotech.project+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.innopath.wamp.notification': {
        source: 'iana',
      },
      'application/vnd.insors.igm': {
        source: 'iana',
        extensions: ['igm'],
      },
      'application/vnd.intercon.formnet': {
        source: 'iana',
        extensions: ['xpw', 'xpx'],
      },
      'application/vnd.intergeo': {
        source: 'iana',
        extensions: ['i2g'],
      },
      'application/vnd.intertrust.digibox': {
        source: 'iana',
      },
      'application/vnd.intertrust.nncp': {
        source: 'iana',
      },
      'application/vnd.intu.qbo': {
        source: 'iana',
        extensions: ['qbo'],
      },
      'application/vnd.intu.qfx': {
        source: 'iana',
        extensions: ['qfx'],
      },
      'application/vnd.iptc.g2.catalogitem+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.iptc.g2.conceptitem+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.iptc.g2.knowledgeitem+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.iptc.g2.newsitem+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.iptc.g2.newsmessage+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.iptc.g2.packageitem+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.iptc.g2.planningitem+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.ipunplugged.rcprofile': {
        source: 'iana',
        extensions: ['rcprofile'],
      },
      'application/vnd.irepository.package+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['irp'],
      },
      'application/vnd.is-xpr': {
        source: 'iana',
        extensions: ['xpr'],
      },
      'application/vnd.isac.fcs': {
        source: 'iana',
        extensions: ['fcs'],
      },
      'application/vnd.iso11783-10+zip': {
        source: 'iana',
        compressible: false,
      },
      'application/vnd.jam': {
        source: 'iana',
        extensions: ['jam'],
      },
      'application/vnd.japannet-directory-service': {
        source: 'iana',
      },
      'application/vnd.japannet-jpnstore-wakeup': {
        source: 'iana',
      },
      'application/vnd.japannet-payment-wakeup': {
        source: 'iana',
      },
      'application/vnd.japannet-registration': {
        source: 'iana',
      },
      'application/vnd.japannet-registration-wakeup': {
        source: 'iana',
      },
      'application/vnd.japannet-setstore-wakeup': {
        source: 'iana',
      },
      'application/vnd.japannet-verification': {
        source: 'iana',
      },
      'application/vnd.japannet-verification-wakeup': {
        source: 'iana',
      },
      'application/vnd.jcp.javame.midlet-rms': {
        source: 'iana',
        extensions: ['rms'],
      },
      'application/vnd.jisp': {
        source: 'iana',
        extensions: ['jisp'],
      },
      'application/vnd.joost.joda-archive': {
        source: 'iana',
        extensions: ['joda'],
      },
      'application/vnd.jsk.isdn-ngn': {
        source: 'iana',
      },
      'application/vnd.kahootz': {
        source: 'iana',
        extensions: ['ktz', 'ktr'],
      },
      'application/vnd.kde.karbon': {
        source: 'iana',
        extensions: ['karbon'],
      },
      'application/vnd.kde.kchart': {
        source: 'iana',
        extensions: ['chrt'],
      },
      'application/vnd.kde.kformula': {
        source: 'iana',
        extensions: ['kfo'],
      },
      'application/vnd.kde.kivio': {
        source: 'iana',
        extensions: ['flw'],
      },
      'application/vnd.kde.kontour': {
        source: 'iana',
        extensions: ['kon'],
      },
      'application/vnd.kde.kpresenter': {
        source: 'iana',
        extensions: ['kpr', 'kpt'],
      },
      'application/vnd.kde.kspread': {
        source: 'iana',
        extensions: ['ksp'],
      },
      'application/vnd.kde.kword': {
        source: 'iana',
        extensions: ['kwd', 'kwt'],
      },
      'application/vnd.kenameaapp': {
        source: 'iana',
        extensions: ['htke'],
      },
      'application/vnd.kidspiration': {
        source: 'iana',
        extensions: ['kia'],
      },
      'application/vnd.kinar': {
        source: 'iana',
        extensions: ['kne', 'knp'],
      },
      'application/vnd.koan': {
        source: 'iana',
        extensions: ['skp', 'skd', 'skt', 'skm'],
      },
      'application/vnd.kodak-descriptor': {
        source: 'iana',
        extensions: ['sse'],
      },
      'application/vnd.las': {
        source: 'iana',
      },
      'application/vnd.las.las+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.las.las+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['lasxml'],
      },
      'application/vnd.laszip': {
        source: 'iana',
      },
      'application/vnd.leap+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.liberty-request+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.llamagraphics.life-balance.desktop': {
        source: 'iana',
        extensions: ['lbd'],
      },
      'application/vnd.llamagraphics.life-balance.exchange+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['lbe'],
      },
      'application/vnd.logipipe.circuit+zip': {
        source: 'iana',
        compressible: false,
      },
      'application/vnd.loom': {
        source: 'iana',
      },
      'application/vnd.lotus-1-2-3': {
        source: 'iana',
        extensions: ['123'],
      },
      'application/vnd.lotus-approach': {
        source: 'iana',
        extensions: ['apr'],
      },
      'application/vnd.lotus-freelance': {
        source: 'iana',
        extensions: ['pre'],
      },
      'application/vnd.lotus-notes': {
        source: 'iana',
        extensions: ['nsf'],
      },
      'application/vnd.lotus-organizer': {
        source: 'iana',
        extensions: ['org'],
      },
      'application/vnd.lotus-screencam': {
        source: 'iana',
        extensions: ['scm'],
      },
      'application/vnd.lotus-wordpro': {
        source: 'iana',
        extensions: ['lwp'],
      },
      'application/vnd.macports.portpkg': {
        source: 'iana',
        extensions: ['portpkg'],
      },
      'application/vnd.mapbox-vector-tile': {
        source: 'iana',
        extensions: ['mvt'],
      },
      'application/vnd.marlin.drm.actiontoken+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.marlin.drm.conftoken+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.marlin.drm.license+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.marlin.drm.mdcf': {
        source: 'iana',
      },
      'application/vnd.mason+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.maxar.archive.3tz+zip': {
        source: 'iana',
        compressible: false,
      },
      'application/vnd.maxmind.maxmind-db': {
        source: 'iana',
      },
      'application/vnd.mcd': {
        source: 'iana',
        extensions: ['mcd'],
      },
      'application/vnd.medcalcdata': {
        source: 'iana',
        extensions: ['mc1'],
      },
      'application/vnd.mediastation.cdkey': {
        source: 'iana',
        extensions: ['cdkey'],
      },
      'application/vnd.meridian-slingshot': {
        source: 'iana',
      },
      'application/vnd.mfer': {
        source: 'iana',
        extensions: ['mwf'],
      },
      'application/vnd.mfmp': {
        source: 'iana',
        extensions: ['mfm'],
      },
      'application/vnd.micro+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.micrografx.flo': {
        source: 'iana',
        extensions: ['flo'],
      },
      'application/vnd.micrografx.igx': {
        source: 'iana',
        extensions: ['igx'],
      },
      'application/vnd.microsoft.portable-executable': {
        source: 'iana',
      },
      'application/vnd.microsoft.windows.thumbnail-cache': {
        source: 'iana',
      },
      'application/vnd.miele+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.mif': {
        source: 'iana',
        extensions: ['mif'],
      },
      'application/vnd.minisoft-hp3000-save': {
        source: 'iana',
      },
      'application/vnd.mitsubishi.misty-guard.trustweb': {
        source: 'iana',
      },
      'application/vnd.mobius.daf': {
        source: 'iana',
        extensions: ['daf'],
      },
      'application/vnd.mobius.dis': {
        source: 'iana',
        extensions: ['dis'],
      },
      'application/vnd.mobius.mbk': {
        source: 'iana',
        extensions: ['mbk'],
      },
      'application/vnd.mobius.mqy': {
        source: 'iana',
        extensions: ['mqy'],
      },
      'application/vnd.mobius.msl': {
        source: 'iana',
        extensions: ['msl'],
      },
      'application/vnd.mobius.plc': {
        source: 'iana',
        extensions: ['plc'],
      },
      'application/vnd.mobius.txf': {
        source: 'iana',
        extensions: ['txf'],
      },
      'application/vnd.mophun.application': {
        source: 'iana',
        extensions: ['mpn'],
      },
      'application/vnd.mophun.certificate': {
        source: 'iana',
        extensions: ['mpc'],
      },
      'application/vnd.motorola.flexsuite': {
        source: 'iana',
      },
      'application/vnd.motorola.flexsuite.adsi': {
        source: 'iana',
      },
      'application/vnd.motorola.flexsuite.fis': {
        source: 'iana',
      },
      'application/vnd.motorola.flexsuite.gotap': {
        source: 'iana',
      },
      'application/vnd.motorola.flexsuite.kmr': {
        source: 'iana',
      },
      'application/vnd.motorola.flexsuite.ttc': {
        source: 'iana',
      },
      'application/vnd.motorola.flexsuite.wem': {
        source: 'iana',
      },
      'application/vnd.motorola.iprm': {
        source: 'iana',
      },
      'application/vnd.mozilla.xul+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['xul'],
      },
      'application/vnd.ms-3mfdocument': {
        source: 'iana',
      },
      'application/vnd.ms-artgalry': {
        source: 'iana',
        extensions: ['cil'],
      },
      'application/vnd.ms-asf': {
        source: 'iana',
      },
      'application/vnd.ms-cab-compressed': {
        source: 'iana',
        extensions: ['cab'],
      },
      'application/vnd.ms-color.iccprofile': {
        source: 'apache',
      },
      'application/vnd.ms-excel': {
        source: 'iana',
        compressible: false,
        extensions: ['xls', 'xlm', 'xla', 'xlc', 'xlt', 'xlw'],
      },
      'application/vnd.ms-excel.addin.macroenabled.12': {
        source: 'iana',
        extensions: ['xlam'],
      },
      'application/vnd.ms-excel.sheet.binary.macroenabled.12': {
        source: 'iana',
        extensions: ['xlsb'],
      },
      'application/vnd.ms-excel.sheet.macroenabled.12': {
        source: 'iana',
        extensions: ['xlsm'],
      },
      'application/vnd.ms-excel.template.macroenabled.12': {
        source: 'iana',
        extensions: ['xltm'],
      },
      'application/vnd.ms-fontobject': {
        source: 'iana',
        compressible: true,
        extensions: ['eot'],
      },
      'application/vnd.ms-htmlhelp': {
        source: 'iana',
        extensions: ['chm'],
      },
      'application/vnd.ms-ims': {
        source: 'iana',
        extensions: ['ims'],
      },
      'application/vnd.ms-lrm': {
        source: 'iana',
        extensions: ['lrm'],
      },
      'application/vnd.ms-office.activex+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.ms-officetheme': {
        source: 'iana',
        extensions: ['thmx'],
      },
      'application/vnd.ms-opentype': {
        source: 'apache',
        compressible: true,
      },
      'application/vnd.ms-outlook': {
        compressible: false,
        extensions: ['msg'],
      },
      'application/vnd.ms-package.obfuscated-opentype': {
        source: 'apache',
      },
      'application/vnd.ms-pki.seccat': {
        source: 'apache',
        extensions: ['cat'],
      },
      'application/vnd.ms-pki.stl': {
        source: 'apache',
        extensions: ['stl'],
      },
      'application/vnd.ms-playready.initiator+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.ms-powerpoint': {
        source: 'iana',
        compressible: false,
        extensions: ['ppt', 'pps', 'pot'],
      },
      'application/vnd.ms-powerpoint.addin.macroenabled.12': {
        source: 'iana',
        extensions: ['ppam'],
      },
      'application/vnd.ms-powerpoint.presentation.macroenabled.12': {
        source: 'iana',
        extensions: ['pptm'],
      },
      'application/vnd.ms-powerpoint.slide.macroenabled.12': {
        source: 'iana',
        extensions: ['sldm'],
      },
      'application/vnd.ms-powerpoint.slideshow.macroenabled.12': {
        source: 'iana',
        extensions: ['ppsm'],
      },
      'application/vnd.ms-powerpoint.template.macroenabled.12': {
        source: 'iana',
        extensions: ['potm'],
      },
      'application/vnd.ms-printdevicecapabilities+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.ms-printing.printticket+xml': {
        source: 'apache',
        compressible: true,
      },
      'application/vnd.ms-printschematicket+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.ms-project': {
        source: 'iana',
        extensions: ['mpp', 'mpt'],
      },
      'application/vnd.ms-tnef': {
        source: 'iana',
      },
      'application/vnd.ms-windows.devicepairing': {
        source: 'iana',
      },
      'application/vnd.ms-windows.nwprinting.oob': {
        source: 'iana',
      },
      'application/vnd.ms-windows.printerpairing': {
        source: 'iana',
      },
      'application/vnd.ms-windows.wsd.oob': {
        source: 'iana',
      },
      'application/vnd.ms-wmdrm.lic-chlg-req': {
        source: 'iana',
      },
      'application/vnd.ms-wmdrm.lic-resp': {
        source: 'iana',
      },
      'application/vnd.ms-wmdrm.meter-chlg-req': {
        source: 'iana',
      },
      'application/vnd.ms-wmdrm.meter-resp': {
        source: 'iana',
      },
      'application/vnd.ms-word.document.macroenabled.12': {
        source: 'iana',
        extensions: ['docm'],
      },
      'application/vnd.ms-word.template.macroenabled.12': {
        source: 'iana',
        extensions: ['dotm'],
      },
      'application/vnd.ms-works': {
        source: 'iana',
        extensions: ['wps', 'wks', 'wcm', 'wdb'],
      },
      'application/vnd.ms-wpl': {
        source: 'iana',
        extensions: ['wpl'],
      },
      'application/vnd.ms-xpsdocument': {
        source: 'iana',
        compressible: false,
        extensions: ['xps'],
      },
      'application/vnd.msa-disk-image': {
        source: 'iana',
      },
      'application/vnd.mseq': {
        source: 'iana',
        extensions: ['mseq'],
      },
      'application/vnd.msign': {
        source: 'iana',
      },
      'application/vnd.multiad.creator': {
        source: 'iana',
      },
      'application/vnd.multiad.creator.cif': {
        source: 'iana',
      },
      'application/vnd.music-niff': {
        source: 'iana',
      },
      'application/vnd.musician': {
        source: 'iana',
        extensions: ['mus'],
      },
      'application/vnd.muvee.style': {
        source: 'iana',
        extensions: ['msty'],
      },
      'application/vnd.mynfc': {
        source: 'iana',
        extensions: ['taglet'],
      },
      'application/vnd.nacamar.ybrid+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.ncd.control': {
        source: 'iana',
      },
      'application/vnd.ncd.reference': {
        source: 'iana',
      },
      'application/vnd.nearst.inv+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.nebumind.line': {
        source: 'iana',
      },
      'application/vnd.nervana': {
        source: 'iana',
      },
      'application/vnd.netfpx': {
        source: 'iana',
      },
      'application/vnd.neurolanguage.nlu': {
        source: 'iana',
        extensions: ['nlu'],
      },
      'application/vnd.nimn': {
        source: 'iana',
      },
      'application/vnd.nintendo.nitro.rom': {
        source: 'iana',
      },
      'application/vnd.nintendo.snes.rom': {
        source: 'iana',
      },
      'application/vnd.nitf': {
        source: 'iana',
        extensions: ['ntf', 'nitf'],
      },
      'application/vnd.noblenet-directory': {
        source: 'iana',
        extensions: ['nnd'],
      },
      'application/vnd.noblenet-sealer': {
        source: 'iana',
        extensions: ['nns'],
      },
      'application/vnd.noblenet-web': {
        source: 'iana',
        extensions: ['nnw'],
      },
      'application/vnd.nokia.catalogs': {
        source: 'iana',
      },
      'application/vnd.nokia.conml+wbxml': {
        source: 'iana',
      },
      'application/vnd.nokia.conml+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.nokia.iptv.config+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.nokia.isds-radio-presets': {
        source: 'iana',
      },
      'application/vnd.nokia.landmark+wbxml': {
        source: 'iana',
      },
      'application/vnd.nokia.landmark+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.nokia.landmarkcollection+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.nokia.n-gage.ac+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['ac'],
      },
      'application/vnd.nokia.n-gage.data': {
        source: 'iana',
        extensions: ['ngdat'],
      },
      'application/vnd.nokia.n-gage.symbian.install': {
        source: 'iana',
        extensions: ['n-gage'],
      },
      'application/vnd.nokia.ncd': {
        source: 'iana',
      },
      'application/vnd.nokia.pcd+wbxml': {
        source: 'iana',
      },
      'application/vnd.nokia.pcd+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.nokia.radio-preset': {
        source: 'iana',
        extensions: ['rpst'],
      },
      'application/vnd.nokia.radio-presets': {
        source: 'iana',
        extensions: ['rpss'],
      },
      'application/vnd.novadigm.edm': {
        source: 'iana',
        extensions: ['edm'],
      },
      'application/vnd.novadigm.edx': {
        source: 'iana',
        extensions: ['edx'],
      },
      'application/vnd.novadigm.ext': {
        source: 'iana',
        extensions: ['ext'],
      },
      'application/vnd.ntt-local.content-share': {
        source: 'iana',
      },
      'application/vnd.ntt-local.file-transfer': {
        source: 'iana',
      },
      'application/vnd.ntt-local.ogw_remote-access': {
        source: 'iana',
      },
      'application/vnd.ntt-local.sip-ta_remote': {
        source: 'iana',
      },
      'application/vnd.ntt-local.sip-ta_tcp_stream': {
        source: 'iana',
      },
      'application/vnd.oasis.opendocument.chart': {
        source: 'iana',
        extensions: ['odc'],
      },
      'application/vnd.oasis.opendocument.chart-template': {
        source: 'iana',
        extensions: ['otc'],
      },
      'application/vnd.oasis.opendocument.database': {
        source: 'iana',
        extensions: ['odb'],
      },
      'application/vnd.oasis.opendocument.formula': {
        source: 'iana',
        extensions: ['odf'],
      },
      'application/vnd.oasis.opendocument.formula-template': {
        source: 'iana',
        extensions: ['odft'],
      },
      'application/vnd.oasis.opendocument.graphics': {
        source: 'iana',
        compressible: false,
        extensions: ['odg'],
      },
      'application/vnd.oasis.opendocument.graphics-template': {
        source: 'iana',
        extensions: ['otg'],
      },
      'application/vnd.oasis.opendocument.image': {
        source: 'iana',
        extensions: ['odi'],
      },
      'application/vnd.oasis.opendocument.image-template': {
        source: 'iana',
        extensions: ['oti'],
      },
      'application/vnd.oasis.opendocument.presentation': {
        source: 'iana',
        compressible: false,
        extensions: ['odp'],
      },
      'application/vnd.oasis.opendocument.presentation-template': {
        source: 'iana',
        extensions: ['otp'],
      },
      'application/vnd.oasis.opendocument.spreadsheet': {
        source: 'iana',
        compressible: false,
        extensions: ['ods'],
      },
      'application/vnd.oasis.opendocument.spreadsheet-template': {
        source: 'iana',
        extensions: ['ots'],
      },
      'application/vnd.oasis.opendocument.text': {
        source: 'iana',
        compressible: false,
        extensions: ['odt'],
      },
      'application/vnd.oasis.opendocument.text-master': {
        source: 'iana',
        extensions: ['odm'],
      },
      'application/vnd.oasis.opendocument.text-template': {
        source: 'iana',
        extensions: ['ott'],
      },
      'application/vnd.oasis.opendocument.text-web': {
        source: 'iana',
        extensions: ['oth'],
      },
      'application/vnd.obn': {
        source: 'iana',
      },
      'application/vnd.ocf+cbor': {
        source: 'iana',
      },
      'application/vnd.oci.image.manifest.v1+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oftn.l10n+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oipf.contentaccessdownload+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oipf.contentaccessstreaming+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oipf.cspg-hexbinary': {
        source: 'iana',
      },
      'application/vnd.oipf.dae.svg+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oipf.dae.xhtml+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oipf.mippvcontrolmessage+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oipf.pae.gem': {
        source: 'iana',
      },
      'application/vnd.oipf.spdiscovery+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oipf.spdlist+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oipf.ueprofile+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oipf.userprofile+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.olpc-sugar': {
        source: 'iana',
        extensions: ['xo'],
      },
      'application/vnd.oma-scws-config': {
        source: 'iana',
      },
      'application/vnd.oma-scws-http-request': {
        source: 'iana',
      },
      'application/vnd.oma-scws-http-response': {
        source: 'iana',
      },
      'application/vnd.oma.bcast.associated-procedure-parameter+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oma.bcast.drm-trigger+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oma.bcast.imd+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oma.bcast.ltkm': {
        source: 'iana',
      },
      'application/vnd.oma.bcast.notification+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oma.bcast.provisioningtrigger': {
        source: 'iana',
      },
      'application/vnd.oma.bcast.sgboot': {
        source: 'iana',
      },
      'application/vnd.oma.bcast.sgdd+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oma.bcast.sgdu': {
        source: 'iana',
      },
      'application/vnd.oma.bcast.simple-symbol-container': {
        source: 'iana',
      },
      'application/vnd.oma.bcast.smartcard-trigger+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oma.bcast.sprov+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oma.bcast.stkm': {
        source: 'iana',
      },
      'application/vnd.oma.cab-address-book+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oma.cab-feature-handler+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oma.cab-pcc+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oma.cab-subs-invite+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oma.cab-user-prefs+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oma.dcd': {
        source: 'iana',
      },
      'application/vnd.oma.dcdc': {
        source: 'iana',
      },
      'application/vnd.oma.dd2+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['dd2'],
      },
      'application/vnd.oma.drm.risd+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oma.group-usage-list+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oma.lwm2m+cbor': {
        source: 'iana',
      },
      'application/vnd.oma.lwm2m+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oma.lwm2m+tlv': {
        source: 'iana',
      },
      'application/vnd.oma.pal+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oma.poc.detailed-progress-report+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oma.poc.final-report+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oma.poc.groups+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oma.poc.invocation-descriptor+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oma.poc.optimized-progress-report+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oma.push': {
        source: 'iana',
      },
      'application/vnd.oma.scidm.messages+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oma.xcap-directory+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.omads-email+xml': {
        source: 'iana',
        charset: 'UTF-8',
        compressible: true,
      },
      'application/vnd.omads-file+xml': {
        source: 'iana',
        charset: 'UTF-8',
        compressible: true,
      },
      'application/vnd.omads-folder+xml': {
        source: 'iana',
        charset: 'UTF-8',
        compressible: true,
      },
      'application/vnd.omaloc-supl-init': {
        source: 'iana',
      },
      'application/vnd.onepager': {
        source: 'iana',
      },
      'application/vnd.onepagertamp': {
        source: 'iana',
      },
      'application/vnd.onepagertamx': {
        source: 'iana',
      },
      'application/vnd.onepagertat': {
        source: 'iana',
      },
      'application/vnd.onepagertatp': {
        source: 'iana',
      },
      'application/vnd.onepagertatx': {
        source: 'iana',
      },
      'application/vnd.openblox.game+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['obgx'],
      },
      'application/vnd.openblox.game-binary': {
        source: 'iana',
      },
      'application/vnd.openeye.oeb': {
        source: 'iana',
      },
      'application/vnd.openofficeorg.extension': {
        source: 'apache',
        extensions: ['oxt'],
      },
      'application/vnd.openstreetmap.data+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['osm'],
      },
      'application/vnd.opentimestamps.ots': {
        source: 'iana',
      },
      'application/vnd.openxmlformats-officedocument.custom-properties+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.customxmlproperties+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.drawing+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.drawingml.chart+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.drawingml.chartshapes+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.drawingml.diagramcolors+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.drawingml.diagramdata+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.drawingml.diagramlayout+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.drawingml.diagramstyle+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.extended-properties+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.presentationml.commentauthors+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.presentationml.comments+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.presentationml.handoutmaster+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.presentationml.notesmaster+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.presentationml.notesslide+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
        source: 'iana',
        compressible: false,
        extensions: ['pptx'],
      },
      'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.presentationml.presprops+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.presentationml.slide': {
        source: 'iana',
        extensions: ['sldx'],
      },
      'application/vnd.openxmlformats-officedocument.presentationml.slide+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.presentationml.slidelayout+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.presentationml.slidemaster+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.presentationml.slideshow': {
        source: 'iana',
        extensions: ['ppsx'],
      },
      'application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.presentationml.slideupdateinfo+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.presentationml.tablestyles+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.presentationml.tags+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.presentationml.template': {
        source: 'iana',
        extensions: ['potx'],
      },
      'application/vnd.openxmlformats-officedocument.presentationml.template.main+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.presentationml.viewprops+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.calcchain+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.chartsheet+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.connections+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.dialogsheet+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.externallink+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.pivotcachedefinition+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.pivotcacherecords+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.pivottable+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.querytable+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.revisionheaders+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.revisionlog+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sharedstrings+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        source: 'iana',
        compressible: false,
        extensions: ['xlsx'],
      },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheetmetadata+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.tablesinglecells+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.template': {
        source: 'iana',
        extensions: ['xltx'],
      },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.usernames+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.volatiledependencies+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.theme+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.themeoverride+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.vmldrawing': {
        source: 'iana',
      },
      'application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
        source: 'iana',
        compressible: false,
        extensions: ['docx'],
      },
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document.glossary+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.wordprocessingml.fonttable+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.wordprocessingml.template': {
        source: 'iana',
        extensions: ['dotx'],
      },
      'application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-officedocument.wordprocessingml.websettings+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-package.core-properties+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-package.digital-signature-xmlsignature+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.openxmlformats-package.relationships+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oracle.resource+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.orange.indata': {
        source: 'iana',
      },
      'application/vnd.osa.netdeploy': {
        source: 'iana',
      },
      'application/vnd.osgeo.mapguide.package': {
        source: 'iana',
        extensions: ['mgp'],
      },
      'application/vnd.osgi.bundle': {
        source: 'iana',
      },
      'application/vnd.osgi.dp': {
        source: 'iana',
        extensions: ['dp'],
      },
      'application/vnd.osgi.subsystem': {
        source: 'iana',
        extensions: ['esa'],
      },
      'application/vnd.otps.ct-kip+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.oxli.countgraph': {
        source: 'iana',
      },
      'application/vnd.pagerduty+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.palm': {
        source: 'iana',
        extensions: ['pdb', 'pqa', 'oprc'],
      },
      'application/vnd.panoply': {
        source: 'iana',
      },
      'application/vnd.paos.xml': {
        source: 'iana',
      },
      'application/vnd.patentdive': {
        source: 'iana',
      },
      'application/vnd.patientecommsdoc': {
        source: 'iana',
      },
      'application/vnd.pawaafile': {
        source: 'iana',
        extensions: ['paw'],
      },
      'application/vnd.pcos': {
        source: 'iana',
      },
      'application/vnd.pg.format': {
        source: 'iana',
        extensions: ['str'],
      },
      'application/vnd.pg.osasli': {
        source: 'iana',
        extensions: ['ei6'],
      },
      'application/vnd.piaccess.application-licence': {
        source: 'iana',
      },
      'application/vnd.picsel': {
        source: 'iana',
        extensions: ['efif'],
      },
      'application/vnd.pmi.widget': {
        source: 'iana',
        extensions: ['wg'],
      },
      'application/vnd.poc.group-advertisement+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.pocketlearn': {
        source: 'iana',
        extensions: ['plf'],
      },
      'application/vnd.powerbuilder6': {
        source: 'iana',
        extensions: ['pbd'],
      },
      'application/vnd.powerbuilder6-s': {
        source: 'iana',
      },
      'application/vnd.powerbuilder7': {
        source: 'iana',
      },
      'application/vnd.powerbuilder7-s': {
        source: 'iana',
      },
      'application/vnd.powerbuilder75': {
        source: 'iana',
      },
      'application/vnd.powerbuilder75-s': {
        source: 'iana',
      },
      'application/vnd.preminet': {
        source: 'iana',
      },
      'application/vnd.previewsystems.box': {
        source: 'iana',
        extensions: ['box'],
      },
      'application/vnd.proteus.magazine': {
        source: 'iana',
        extensions: ['mgz'],
      },
      'application/vnd.psfs': {
        source: 'iana',
      },
      'application/vnd.publishare-delta-tree': {
        source: 'iana',
        extensions: ['qps'],
      },
      'application/vnd.pvi.ptid1': {
        source: 'iana',
        extensions: ['ptid'],
      },
      'application/vnd.pwg-multiplexed': {
        source: 'iana',
      },
      'application/vnd.pwg-xhtml-print+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.qualcomm.brew-app-res': {
        source: 'iana',
      },
      'application/vnd.quarantainenet': {
        source: 'iana',
      },
      'application/vnd.quark.quarkxpress': {
        source: 'iana',
        extensions: ['qxd', 'qxt', 'qwd', 'qwt', 'qxl', 'qxb'],
      },
      'application/vnd.quobject-quoxdocument': {
        source: 'iana',
      },
      'application/vnd.radisys.moml+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.radisys.msml+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.radisys.msml-audit+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.radisys.msml-audit-conf+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.radisys.msml-audit-conn+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.radisys.msml-audit-dialog+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.radisys.msml-audit-stream+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.radisys.msml-conf+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.radisys.msml-dialog+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.radisys.msml-dialog-base+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.radisys.msml-dialog-fax-detect+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.radisys.msml-dialog-fax-sendrecv+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.radisys.msml-dialog-group+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.radisys.msml-dialog-speech+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.radisys.msml-dialog-transform+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.rainstor.data': {
        source: 'iana',
      },
      'application/vnd.rapid': {
        source: 'iana',
      },
      'application/vnd.rar': {
        source: 'iana',
        extensions: ['rar'],
      },
      'application/vnd.realvnc.bed': {
        source: 'iana',
        extensions: ['bed'],
      },
      'application/vnd.recordare.musicxml': {
        source: 'iana',
        extensions: ['mxl'],
      },
      'application/vnd.recordare.musicxml+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['musicxml'],
      },
      'application/vnd.renlearn.rlprint': {
        source: 'iana',
      },
      'application/vnd.resilient.logic': {
        source: 'iana',
      },
      'application/vnd.restful+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.rig.cryptonote': {
        source: 'iana',
        extensions: ['cryptonote'],
      },
      'application/vnd.rim.cod': {
        source: 'apache',
        extensions: ['cod'],
      },
      'application/vnd.rn-realmedia': {
        source: 'apache',
        extensions: ['rm'],
      },
      'application/vnd.rn-realmedia-vbr': {
        source: 'apache',
        extensions: ['rmvb'],
      },
      'application/vnd.route66.link66+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['link66'],
      },
      'application/vnd.rs-274x': {
        source: 'iana',
      },
      'application/vnd.ruckus.download': {
        source: 'iana',
      },
      'application/vnd.s3sms': {
        source: 'iana',
      },
      'application/vnd.sailingtracker.track': {
        source: 'iana',
        extensions: ['st'],
      },
      'application/vnd.sar': {
        source: 'iana',
      },
      'application/vnd.sbm.cid': {
        source: 'iana',
      },
      'application/vnd.sbm.mid2': {
        source: 'iana',
      },
      'application/vnd.scribus': {
        source: 'iana',
      },
      'application/vnd.sealed.3df': {
        source: 'iana',
      },
      'application/vnd.sealed.csf': {
        source: 'iana',
      },
      'application/vnd.sealed.doc': {
        source: 'iana',
      },
      'application/vnd.sealed.eml': {
        source: 'iana',
      },
      'application/vnd.sealed.mht': {
        source: 'iana',
      },
      'application/vnd.sealed.net': {
        source: 'iana',
      },
      'application/vnd.sealed.ppt': {
        source: 'iana',
      },
      'application/vnd.sealed.tiff': {
        source: 'iana',
      },
      'application/vnd.sealed.xls': {
        source: 'iana',
      },
      'application/vnd.sealedmedia.softseal.html': {
        source: 'iana',
      },
      'application/vnd.sealedmedia.softseal.pdf': {
        source: 'iana',
      },
      'application/vnd.seemail': {
        source: 'iana',
        extensions: ['see'],
      },
      'application/vnd.seis+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.sema': {
        source: 'iana',
        extensions: ['sema'],
      },
      'application/vnd.semd': {
        source: 'iana',
        extensions: ['semd'],
      },
      'application/vnd.semf': {
        source: 'iana',
        extensions: ['semf'],
      },
      'application/vnd.shade-save-file': {
        source: 'iana',
      },
      'application/vnd.shana.informed.formdata': {
        source: 'iana',
        extensions: ['ifm'],
      },
      'application/vnd.shana.informed.formtemplate': {
        source: 'iana',
        extensions: ['itp'],
      },
      'application/vnd.shana.informed.interchange': {
        source: 'iana',
        extensions: ['iif'],
      },
      'application/vnd.shana.informed.package': {
        source: 'iana',
        extensions: ['ipk'],
      },
      'application/vnd.shootproof+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.shopkick+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.shp': {
        source: 'iana',
      },
      'application/vnd.shx': {
        source: 'iana',
      },
      'application/vnd.sigrok.session': {
        source: 'iana',
      },
      'application/vnd.simtech-mindmapper': {
        source: 'iana',
        extensions: ['twd', 'twds'],
      },
      'application/vnd.siren+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.smaf': {
        source: 'iana',
        extensions: ['mmf'],
      },
      'application/vnd.smart.notebook': {
        source: 'iana',
      },
      'application/vnd.smart.teacher': {
        source: 'iana',
        extensions: ['teacher'],
      },
      'application/vnd.snesdev-page-table': {
        source: 'iana',
      },
      'application/vnd.software602.filler.form+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['fo'],
      },
      'application/vnd.software602.filler.form-xml-zip': {
        source: 'iana',
      },
      'application/vnd.solent.sdkm+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['sdkm', 'sdkd'],
      },
      'application/vnd.spotfire.dxp': {
        source: 'iana',
        extensions: ['dxp'],
      },
      'application/vnd.spotfire.sfs': {
        source: 'iana',
        extensions: ['sfs'],
      },
      'application/vnd.sqlite3': {
        source: 'iana',
      },
      'application/vnd.sss-cod': {
        source: 'iana',
      },
      'application/vnd.sss-dtf': {
        source: 'iana',
      },
      'application/vnd.sss-ntf': {
        source: 'iana',
      },
      'application/vnd.stardivision.calc': {
        source: 'apache',
        extensions: ['sdc'],
      },
      'application/vnd.stardivision.draw': {
        source: 'apache',
        extensions: ['sda'],
      },
      'application/vnd.stardivision.impress': {
        source: 'apache',
        extensions: ['sdd'],
      },
      'application/vnd.stardivision.math': {
        source: 'apache',
        extensions: ['smf'],
      },
      'application/vnd.stardivision.writer': {
        source: 'apache',
        extensions: ['sdw', 'vor'],
      },
      'application/vnd.stardivision.writer-global': {
        source: 'apache',
        extensions: ['sgl'],
      },
      'application/vnd.stepmania.package': {
        source: 'iana',
        extensions: ['smzip'],
      },
      'application/vnd.stepmania.stepchart': {
        source: 'iana',
        extensions: ['sm'],
      },
      'application/vnd.street-stream': {
        source: 'iana',
      },
      'application/vnd.sun.wadl+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['wadl'],
      },
      'application/vnd.sun.xml.calc': {
        source: 'apache',
        extensions: ['sxc'],
      },
      'application/vnd.sun.xml.calc.template': {
        source: 'apache',
        extensions: ['stc'],
      },
      'application/vnd.sun.xml.draw': {
        source: 'apache',
        extensions: ['sxd'],
      },
      'application/vnd.sun.xml.draw.template': {
        source: 'apache',
        extensions: ['std'],
      },
      'application/vnd.sun.xml.impress': {
        source: 'apache',
        extensions: ['sxi'],
      },
      'application/vnd.sun.xml.impress.template': {
        source: 'apache',
        extensions: ['sti'],
      },
      'application/vnd.sun.xml.math': {
        source: 'apache',
        extensions: ['sxm'],
      },
      'application/vnd.sun.xml.writer': {
        source: 'apache',
        extensions: ['sxw'],
      },
      'application/vnd.sun.xml.writer.global': {
        source: 'apache',
        extensions: ['sxg'],
      },
      'application/vnd.sun.xml.writer.template': {
        source: 'apache',
        extensions: ['stw'],
      },
      'application/vnd.sus-calendar': {
        source: 'iana',
        extensions: ['sus', 'susp'],
      },
      'application/vnd.svd': {
        source: 'iana',
        extensions: ['svd'],
      },
      'application/vnd.swiftview-ics': {
        source: 'iana',
      },
      'application/vnd.sycle+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.syft+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.symbian.install': {
        source: 'apache',
        extensions: ['sis', 'sisx'],
      },
      'application/vnd.syncml+xml': {
        source: 'iana',
        charset: 'UTF-8',
        compressible: true,
        extensions: ['xsm'],
      },
      'application/vnd.syncml.dm+wbxml': {
        source: 'iana',
        charset: 'UTF-8',
        extensions: ['bdm'],
      },
      'application/vnd.syncml.dm+xml': {
        source: 'iana',
        charset: 'UTF-8',
        compressible: true,
        extensions: ['xdm'],
      },
      'application/vnd.syncml.dm.notification': {
        source: 'iana',
      },
      'application/vnd.syncml.dmddf+wbxml': {
        source: 'iana',
      },
      'application/vnd.syncml.dmddf+xml': {
        source: 'iana',
        charset: 'UTF-8',
        compressible: true,
        extensions: ['ddf'],
      },
      'application/vnd.syncml.dmtnds+wbxml': {
        source: 'iana',
      },
      'application/vnd.syncml.dmtnds+xml': {
        source: 'iana',
        charset: 'UTF-8',
        compressible: true,
      },
      'application/vnd.syncml.ds.notification': {
        source: 'iana',
      },
      'application/vnd.tableschema+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.tao.intent-module-archive': {
        source: 'iana',
        extensions: ['tao'],
      },
      'application/vnd.tcpdump.pcap': {
        source: 'iana',
        extensions: ['pcap', 'cap', 'dmp'],
      },
      'application/vnd.think-cell.ppttc+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.tmd.mediaflex.api+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.tml': {
        source: 'iana',
      },
      'application/vnd.tmobile-livetv': {
        source: 'iana',
        extensions: ['tmo'],
      },
      'application/vnd.tri.onesource': {
        source: 'iana',
      },
      'application/vnd.trid.tpt': {
        source: 'iana',
        extensions: ['tpt'],
      },
      'application/vnd.triscape.mxs': {
        source: 'iana',
        extensions: ['mxs'],
      },
      'application/vnd.trueapp': {
        source: 'iana',
        extensions: ['tra'],
      },
      'application/vnd.truedoc': {
        source: 'iana',
      },
      'application/vnd.ubisoft.webplayer': {
        source: 'iana',
      },
      'application/vnd.ufdl': {
        source: 'iana',
        extensions: ['ufd', 'ufdl'],
      },
      'application/vnd.uiq.theme': {
        source: 'iana',
        extensions: ['utz'],
      },
      'application/vnd.umajin': {
        source: 'iana',
        extensions: ['umj'],
      },
      'application/vnd.unity': {
        source: 'iana',
        extensions: ['unityweb'],
      },
      'application/vnd.uoml+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['uoml'],
      },
      'application/vnd.uplanet.alert': {
        source: 'iana',
      },
      'application/vnd.uplanet.alert-wbxml': {
        source: 'iana',
      },
      'application/vnd.uplanet.bearer-choice': {
        source: 'iana',
      },
      'application/vnd.uplanet.bearer-choice-wbxml': {
        source: 'iana',
      },
      'application/vnd.uplanet.cacheop': {
        source: 'iana',
      },
      'application/vnd.uplanet.cacheop-wbxml': {
        source: 'iana',
      },
      'application/vnd.uplanet.channel': {
        source: 'iana',
      },
      'application/vnd.uplanet.channel-wbxml': {
        source: 'iana',
      },
      'application/vnd.uplanet.list': {
        source: 'iana',
      },
      'application/vnd.uplanet.list-wbxml': {
        source: 'iana',
      },
      'application/vnd.uplanet.listcmd': {
        source: 'iana',
      },
      'application/vnd.uplanet.listcmd-wbxml': {
        source: 'iana',
      },
      'application/vnd.uplanet.signal': {
        source: 'iana',
      },
      'application/vnd.uri-map': {
        source: 'iana',
      },
      'application/vnd.valve.source.material': {
        source: 'iana',
      },
      'application/vnd.vcx': {
        source: 'iana',
        extensions: ['vcx'],
      },
      'application/vnd.vd-study': {
        source: 'iana',
      },
      'application/vnd.vectorworks': {
        source: 'iana',
      },
      'application/vnd.vel+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.verimatrix.vcas': {
        source: 'iana',
      },
      'application/vnd.veritone.aion+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.veryant.thin': {
        source: 'iana',
      },
      'application/vnd.ves.encrypted': {
        source: 'iana',
      },
      'application/vnd.vidsoft.vidconference': {
        source: 'iana',
      },
      'application/vnd.visio': {
        source: 'iana',
        extensions: ['vsd', 'vst', 'vss', 'vsw'],
      },
      'application/vnd.visionary': {
        source: 'iana',
        extensions: ['vis'],
      },
      'application/vnd.vividence.scriptfile': {
        source: 'iana',
      },
      'application/vnd.vsf': {
        source: 'iana',
        extensions: ['vsf'],
      },
      'application/vnd.wap.sic': {
        source: 'iana',
      },
      'application/vnd.wap.slc': {
        source: 'iana',
      },
      'application/vnd.wap.wbxml': {
        source: 'iana',
        charset: 'UTF-8',
        extensions: ['wbxml'],
      },
      'application/vnd.wap.wmlc': {
        source: 'iana',
        extensions: ['wmlc'],
      },
      'application/vnd.wap.wmlscriptc': {
        source: 'iana',
        extensions: ['wmlsc'],
      },
      'application/vnd.webturbo': {
        source: 'iana',
        extensions: ['wtb'],
      },
      'application/vnd.wfa.dpp': {
        source: 'iana',
      },
      'application/vnd.wfa.p2p': {
        source: 'iana',
      },
      'application/vnd.wfa.wsc': {
        source: 'iana',
      },
      'application/vnd.windows.devicepairing': {
        source: 'iana',
      },
      'application/vnd.wmc': {
        source: 'iana',
      },
      'application/vnd.wmf.bootstrap': {
        source: 'iana',
      },
      'application/vnd.wolfram.mathematica': {
        source: 'iana',
      },
      'application/vnd.wolfram.mathematica.package': {
        source: 'iana',
      },
      'application/vnd.wolfram.player': {
        source: 'iana',
        extensions: ['nbp'],
      },
      'application/vnd.wordperfect': {
        source: 'iana',
        extensions: ['wpd'],
      },
      'application/vnd.wqd': {
        source: 'iana',
        extensions: ['wqd'],
      },
      'application/vnd.wrq-hp3000-labelled': {
        source: 'iana',
      },
      'application/vnd.wt.stf': {
        source: 'iana',
        extensions: ['stf'],
      },
      'application/vnd.wv.csp+wbxml': {
        source: 'iana',
      },
      'application/vnd.wv.csp+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.wv.ssp+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.xacml+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.xara': {
        source: 'iana',
        extensions: ['xar'],
      },
      'application/vnd.xfdl': {
        source: 'iana',
        extensions: ['xfdl'],
      },
      'application/vnd.xfdl.webform': {
        source: 'iana',
      },
      'application/vnd.xmi+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/vnd.xmpie.cpkg': {
        source: 'iana',
      },
      'application/vnd.xmpie.dpkg': {
        source: 'iana',
      },
      'application/vnd.xmpie.plan': {
        source: 'iana',
      },
      'application/vnd.xmpie.ppkg': {
        source: 'iana',
      },
      'application/vnd.xmpie.xlim': {
        source: 'iana',
      },
      'application/vnd.yamaha.hv-dic': {
        source: 'iana',
        extensions: ['hvd'],
      },
      'application/vnd.yamaha.hv-script': {
        source: 'iana',
        extensions: ['hvs'],
      },
      'application/vnd.yamaha.hv-voice': {
        source: 'iana',
        extensions: ['hvp'],
      },
      'application/vnd.yamaha.openscoreformat': {
        source: 'iana',
        extensions: ['osf'],
      },
      'application/vnd.yamaha.openscoreformat.osfpvg+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['osfpvg'],
      },
      'application/vnd.yamaha.remote-setup': {
        source: 'iana',
      },
      'application/vnd.yamaha.smaf-audio': {
        source: 'iana',
        extensions: ['saf'],
      },
      'application/vnd.yamaha.smaf-phrase': {
        source: 'iana',
        extensions: ['spf'],
      },
      'application/vnd.yamaha.through-ngn': {
        source: 'iana',
      },
      'application/vnd.yamaha.tunnel-udpencap': {
        source: 'iana',
      },
      'application/vnd.yaoweme': {
        source: 'iana',
      },
      'application/vnd.yellowriver-custom-menu': {
        source: 'iana',
        extensions: ['cmp'],
      },
      'application/vnd.youtube.yt': {
        source: 'iana',
      },
      'application/vnd.zul': {
        source: 'iana',
        extensions: ['zir', 'zirz'],
      },
      'application/vnd.zzazz.deck+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['zaz'],
      },
      'application/voicexml+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['vxml'],
      },
      'application/voucher-cms+json': {
        source: 'iana',
        compressible: true,
      },
      'application/vq-rtcpxr': {
        source: 'iana',
      },
      'application/wasm': {
        source: 'iana',
        compressible: true,
        extensions: ['wasm'],
      },
      'application/watcherinfo+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['wif'],
      },
      'application/webpush-options+json': {
        source: 'iana',
        compressible: true,
      },
      'application/whoispp-query': {
        source: 'iana',
      },
      'application/whoispp-response': {
        source: 'iana',
      },
      'application/widget': {
        source: 'iana',
        extensions: ['wgt'],
      },
      'application/winhlp': {
        source: 'apache',
        extensions: ['hlp'],
      },
      'application/wita': {
        source: 'iana',
      },
      'application/wordperfect5.1': {
        source: 'iana',
      },
      'application/wsdl+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['wsdl'],
      },
      'application/wspolicy+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['wspolicy'],
      },
      'application/x-7z-compressed': {
        source: 'apache',
        compressible: false,
        extensions: ['7z'],
      },
      'application/x-abiword': {
        source: 'apache',
        extensions: ['abw'],
      },
      'application/x-ace-compressed': {
        source: 'apache',
        extensions: ['ace'],
      },
      'application/x-amf': {
        source: 'apache',
      },
      'application/x-apple-diskimage': {
        source: 'apache',
        extensions: ['dmg'],
      },
      'application/x-arj': {
        compressible: false,
        extensions: ['arj'],
      },
      'application/x-authorware-bin': {
        source: 'apache',
        extensions: ['aab', 'x32', 'u32', 'vox'],
      },
      'application/x-authorware-map': {
        source: 'apache',
        extensions: ['aam'],
      },
      'application/x-authorware-seg': {
        source: 'apache',
        extensions: ['aas'],
      },
      'application/x-bcpio': {
        source: 'apache',
        extensions: ['bcpio'],
      },
      'application/x-bdoc': {
        compressible: false,
        extensions: ['bdoc'],
      },
      'application/x-bittorrent': {
        source: 'apache',
        extensions: ['torrent'],
      },
      'application/x-blorb': {
        source: 'apache',
        extensions: ['blb', 'blorb'],
      },
      'application/x-bzip': {
        source: 'apache',
        compressible: false,
        extensions: ['bz'],
      },
      'application/x-bzip2': {
        source: 'apache',
        compressible: false,
        extensions: ['bz2', 'boz'],
      },
      'application/x-cbr': {
        source: 'apache',
        extensions: ['cbr', 'cba', 'cbt', 'cbz', 'cb7'],
      },
      'application/x-cdlink': {
        source: 'apache',
        extensions: ['vcd'],
      },
      'application/x-cfs-compressed': {
        source: 'apache',
        extensions: ['cfs'],
      },
      'application/x-chat': {
        source: 'apache',
        extensions: ['chat'],
      },
      'application/x-chess-pgn': {
        source: 'apache',
        extensions: ['pgn'],
      },
      'application/x-chrome-extension': {
        extensions: ['crx'],
      },
      'application/x-cocoa': {
        source: 'nginx',
        extensions: ['cco'],
      },
      'application/x-compress': {
        source: 'apache',
      },
      'application/x-conference': {
        source: 'apache',
        extensions: ['nsc'],
      },
      'application/x-cpio': {
        source: 'apache',
        extensions: ['cpio'],
      },
      'application/x-csh': {
        source: 'apache',
        extensions: ['csh'],
      },
      'application/x-deb': {
        compressible: false,
      },
      'application/x-debian-package': {
        source: 'apache',
        extensions: ['deb', 'udeb'],
      },
      'application/x-dgc-compressed': {
        source: 'apache',
        extensions: ['dgc'],
      },
      'application/x-director': {
        source: 'apache',
        extensions: ['dir', 'dcr', 'dxr', 'cst', 'cct', 'cxt', 'w3d', 'fgd', 'swa'],
      },
      'application/x-doom': {
        source: 'apache',
        extensions: ['wad'],
      },
      'application/x-dtbncx+xml': {
        source: 'apache',
        compressible: true,
        extensions: ['ncx'],
      },
      'application/x-dtbook+xml': {
        source: 'apache',
        compressible: true,
        extensions: ['dtb'],
      },
      'application/x-dtbresource+xml': {
        source: 'apache',
        compressible: true,
        extensions: ['res'],
      },
      'application/x-dvi': {
        source: 'apache',
        compressible: false,
        extensions: ['dvi'],
      },
      'application/x-envoy': {
        source: 'apache',
        extensions: ['evy'],
      },
      'application/x-eva': {
        source: 'apache',
        extensions: ['eva'],
      },
      'application/x-font-bdf': {
        source: 'apache',
        extensions: ['bdf'],
      },
      'application/x-font-dos': {
        source: 'apache',
      },
      'application/x-font-framemaker': {
        source: 'apache',
      },
      'application/x-font-ghostscript': {
        source: 'apache',
        extensions: ['gsf'],
      },
      'application/x-font-libgrx': {
        source: 'apache',
      },
      'application/x-font-linux-psf': {
        source: 'apache',
        extensions: ['psf'],
      },
      'application/x-font-pcf': {
        source: 'apache',
        extensions: ['pcf'],
      },
      'application/x-font-snf': {
        source: 'apache',
        extensions: ['snf'],
      },
      'application/x-font-speedo': {
        source: 'apache',
      },
      'application/x-font-sunos-news': {
        source: 'apache',
      },
      'application/x-font-type1': {
        source: 'apache',
        extensions: ['pfa', 'pfb', 'pfm', 'afm'],
      },
      'application/x-font-vfont': {
        source: 'apache',
      },
      'application/x-freearc': {
        source: 'apache',
        extensions: ['arc'],
      },
      'application/x-futuresplash': {
        source: 'apache',
        extensions: ['spl'],
      },
      'application/x-gca-compressed': {
        source: 'apache',
        extensions: ['gca'],
      },
      'application/x-glulx': {
        source: 'apache',
        extensions: ['ulx'],
      },
      'application/x-gnumeric': {
        source: 'apache',
        extensions: ['gnumeric'],
      },
      'application/x-gramps-xml': {
        source: 'apache',
        extensions: ['gramps'],
      },
      'application/x-gtar': {
        source: 'apache',
        extensions: ['gtar'],
      },
      'application/x-gzip': {
        source: 'apache',
      },
      'application/x-hdf': {
        source: 'apache',
        extensions: ['hdf'],
      },
      'application/x-httpd-php': {
        compressible: true,
        extensions: ['php'],
      },
      'application/x-install-instructions': {
        source: 'apache',
        extensions: ['install'],
      },
      'application/x-iso9660-image': {
        source: 'apache',
        extensions: ['iso'],
      },
      'application/x-iwork-keynote-sffkey': {
        extensions: ['key'],
      },
      'application/x-iwork-numbers-sffnumbers': {
        extensions: ['numbers'],
      },
      'application/x-iwork-pages-sffpages': {
        extensions: ['pages'],
      },
      'application/x-java-archive-diff': {
        source: 'nginx',
        extensions: ['jardiff'],
      },
      'application/x-java-jnlp-file': {
        source: 'apache',
        compressible: false,
        extensions: ['jnlp'],
      },
      'application/x-javascript': {
        compressible: true,
      },
      'application/x-keepass2': {
        extensions: ['kdbx'],
      },
      'application/x-latex': {
        source: 'apache',
        compressible: false,
        extensions: ['latex'],
      },
      'application/x-lua-bytecode': {
        extensions: ['luac'],
      },
      'application/x-lzh-compressed': {
        source: 'apache',
        extensions: ['lzh', 'lha'],
      },
      'application/x-makeself': {
        source: 'nginx',
        extensions: ['run'],
      },
      'application/x-mie': {
        source: 'apache',
        extensions: ['mie'],
      },
      'application/x-mobipocket-ebook': {
        source: 'apache',
        extensions: ['prc', 'mobi'],
      },
      'application/x-mpegurl': {
        compressible: false,
      },
      'application/x-ms-application': {
        source: 'apache',
        extensions: ['application'],
      },
      'application/x-ms-shortcut': {
        source: 'apache',
        extensions: ['lnk'],
      },
      'application/x-ms-wmd': {
        source: 'apache',
        extensions: ['wmd'],
      },
      'application/x-ms-wmz': {
        source: 'apache',
        extensions: ['wmz'],
      },
      'application/x-ms-xbap': {
        source: 'apache',
        extensions: ['xbap'],
      },
      'application/x-msaccess': {
        source: 'apache',
        extensions: ['mdb'],
      },
      'application/x-msbinder': {
        source: 'apache',
        extensions: ['obd'],
      },
      'application/x-mscardfile': {
        source: 'apache',
        extensions: ['crd'],
      },
      'application/x-msclip': {
        source: 'apache',
        extensions: ['clp'],
      },
      'application/x-msdos-program': {
        extensions: ['exe'],
      },
      'application/x-msdownload': {
        source: 'apache',
        extensions: ['exe', 'dll', 'com', 'bat', 'msi'],
      },
      'application/x-msmediaview': {
        source: 'apache',
        extensions: ['mvb', 'm13', 'm14'],
      },
      'application/x-msmetafile': {
        source: 'apache',
        extensions: ['wmf', 'wmz', 'emf', 'emz'],
      },
      'application/x-msmoney': {
        source: 'apache',
        extensions: ['mny'],
      },
      'application/x-mspublisher': {
        source: 'apache',
        extensions: ['pub'],
      },
      'application/x-msschedule': {
        source: 'apache',
        extensions: ['scd'],
      },
      'application/x-msterminal': {
        source: 'apache',
        extensions: ['trm'],
      },
      'application/x-mswrite': {
        source: 'apache',
        extensions: ['wri'],
      },
      'application/x-netcdf': {
        source: 'apache',
        extensions: ['nc', 'cdf'],
      },
      'application/x-ns-proxy-autoconfig': {
        compressible: true,
        extensions: ['pac'],
      },
      'application/x-nzb': {
        source: 'apache',
        extensions: ['nzb'],
      },
      'application/x-perl': {
        source: 'nginx',
        extensions: ['pl', 'pm'],
      },
      'application/x-pilot': {
        source: 'nginx',
        extensions: ['prc', 'pdb'],
      },
      'application/x-pkcs12': {
        source: 'apache',
        compressible: false,
        extensions: ['p12', 'pfx'],
      },
      'application/x-pkcs7-certificates': {
        source: 'apache',
        extensions: ['p7b', 'spc'],
      },
      'application/x-pkcs7-certreqresp': {
        source: 'apache',
        extensions: ['p7r'],
      },
      'application/x-pki-message': {
        source: 'iana',
      },
      'application/x-rar-compressed': {
        source: 'apache',
        compressible: false,
        extensions: ['rar'],
      },
      'application/x-redhat-package-manager': {
        source: 'nginx',
        extensions: ['rpm'],
      },
      'application/x-research-info-systems': {
        source: 'apache',
        extensions: ['ris'],
      },
      'application/x-sea': {
        source: 'nginx',
        extensions: ['sea'],
      },
      'application/x-sh': {
        source: 'apache',
        compressible: true,
        extensions: ['sh'],
      },
      'application/x-shar': {
        source: 'apache',
        extensions: ['shar'],
      },
      'application/x-shockwave-flash': {
        source: 'apache',
        compressible: false,
        extensions: ['swf'],
      },
      'application/x-silverlight-app': {
        source: 'apache',
        extensions: ['xap'],
      },
      'application/x-sql': {
        source: 'apache',
        extensions: ['sql'],
      },
      'application/x-stuffit': {
        source: 'apache',
        compressible: false,
        extensions: ['sit'],
      },
      'application/x-stuffitx': {
        source: 'apache',
        extensions: ['sitx'],
      },
      'application/x-subrip': {
        source: 'apache',
        extensions: ['srt'],
      },
      'application/x-sv4cpio': {
        source: 'apache',
        extensions: ['sv4cpio'],
      },
      'application/x-sv4crc': {
        source: 'apache',
        extensions: ['sv4crc'],
      },
      'application/x-t3vm-image': {
        source: 'apache',
        extensions: ['t3'],
      },
      'application/x-tads': {
        source: 'apache',
        extensions: ['gam'],
      },
      'application/x-tar': {
        source: 'apache',
        compressible: true,
        extensions: ['tar'],
      },
      'application/x-tcl': {
        source: 'apache',
        extensions: ['tcl', 'tk'],
      },
      'application/x-tex': {
        source: 'apache',
        extensions: ['tex'],
      },
      'application/x-tex-tfm': {
        source: 'apache',
        extensions: ['tfm'],
      },
      'application/x-texinfo': {
        source: 'apache',
        extensions: ['texinfo', 'texi'],
      },
      'application/x-tgif': {
        source: 'apache',
        extensions: ['obj'],
      },
      'application/x-ustar': {
        source: 'apache',
        extensions: ['ustar'],
      },
      'application/x-virtualbox-hdd': {
        compressible: true,
        extensions: ['hdd'],
      },
      'application/x-virtualbox-ova': {
        compressible: true,
        extensions: ['ova'],
      },
      'application/x-virtualbox-ovf': {
        compressible: true,
        extensions: ['ovf'],
      },
      'application/x-virtualbox-vbox': {
        compressible: true,
        extensions: ['vbox'],
      },
      'application/x-virtualbox-vbox-extpack': {
        compressible: false,
        extensions: ['vbox-extpack'],
      },
      'application/x-virtualbox-vdi': {
        compressible: true,
        extensions: ['vdi'],
      },
      'application/x-virtualbox-vhd': {
        compressible: true,
        extensions: ['vhd'],
      },
      'application/x-virtualbox-vmdk': {
        compressible: true,
        extensions: ['vmdk'],
      },
      'application/x-wais-source': {
        source: 'apache',
        extensions: ['src'],
      },
      'application/x-web-app-manifest+json': {
        compressible: true,
        extensions: ['webapp'],
      },
      'application/x-www-form-urlencoded': {
        source: 'iana',
        compressible: true,
      },
      'application/x-x509-ca-cert': {
        source: 'iana',
        extensions: ['der', 'crt', 'pem'],
      },
      'application/x-x509-ca-ra-cert': {
        source: 'iana',
      },
      'application/x-x509-next-ca-cert': {
        source: 'iana',
      },
      'application/x-xfig': {
        source: 'apache',
        extensions: ['fig'],
      },
      'application/x-xliff+xml': {
        source: 'apache',
        compressible: true,
        extensions: ['xlf'],
      },
      'application/x-xpinstall': {
        source: 'apache',
        compressible: false,
        extensions: ['xpi'],
      },
      'application/x-xz': {
        source: 'apache',
        extensions: ['xz'],
      },
      'application/x-zmachine': {
        source: 'apache',
        extensions: ['z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7', 'z8'],
      },
      'application/x400-bp': {
        source: 'iana',
      },
      'application/xacml+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/xaml+xml': {
        source: 'apache',
        compressible: true,
        extensions: ['xaml'],
      },
      'application/xcap-att+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['xav'],
      },
      'application/xcap-caps+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['xca'],
      },
      'application/xcap-diff+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['xdf'],
      },
      'application/xcap-el+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['xel'],
      },
      'application/xcap-error+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/xcap-ns+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['xns'],
      },
      'application/xcon-conference-info+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/xcon-conference-info-diff+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/xenc+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['xenc'],
      },
      'application/xhtml+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['xhtml', 'xht'],
      },
      'application/xhtml-voice+xml': {
        source: 'apache',
        compressible: true,
      },
      'application/xliff+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['xlf'],
      },
      'application/xml': {
        source: 'iana',
        compressible: true,
        extensions: ['xml', 'xsl', 'xsd', 'rng'],
      },
      'application/xml-dtd': {
        source: 'iana',
        compressible: true,
        extensions: ['dtd'],
      },
      'application/xml-external-parsed-entity': {
        source: 'iana',
      },
      'application/xml-patch+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/xmpp+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/xop+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['xop'],
      },
      'application/xproc+xml': {
        source: 'apache',
        compressible: true,
        extensions: ['xpl'],
      },
      'application/xslt+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['xsl', 'xslt'],
      },
      'application/xspf+xml': {
        source: 'apache',
        compressible: true,
        extensions: ['xspf'],
      },
      'application/xv+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['mxml', 'xhvml', 'xvml', 'xvm'],
      },
      'application/yang': {
        source: 'iana',
        extensions: ['yang'],
      },
      'application/yang-data+json': {
        source: 'iana',
        compressible: true,
      },
      'application/yang-data+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/yang-patch+json': {
        source: 'iana',
        compressible: true,
      },
      'application/yang-patch+xml': {
        source: 'iana',
        compressible: true,
      },
      'application/yin+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['yin'],
      },
      'application/zip': {
        source: 'iana',
        compressible: false,
        extensions: ['zip'],
      },
      'application/zlib': {
        source: 'iana',
      },
      'application/zstd': {
        source: 'iana',
      },
      'audio/1d-interleaved-parityfec': {
        source: 'iana',
      },
      'audio/32kadpcm': {
        source: 'iana',
      },
      'audio/3gpp': {
        source: 'iana',
        compressible: false,
        extensions: ['3gpp'],
      },
      'audio/3gpp2': {
        source: 'iana',
      },
      'audio/aac': {
        source: 'iana',
      },
      'audio/ac3': {
        source: 'iana',
      },
      'audio/adpcm': {
        source: 'apache',
        extensions: ['adp'],
      },
      'audio/amr': {
        source: 'iana',
        extensions: ['amr'],
      },
      'audio/amr-wb': {
        source: 'iana',
      },
      'audio/amr-wb+': {
        source: 'iana',
      },
      'audio/aptx': {
        source: 'iana',
      },
      'audio/asc': {
        source: 'iana',
      },
      'audio/atrac-advanced-lossless': {
        source: 'iana',
      },
      'audio/atrac-x': {
        source: 'iana',
      },
      'audio/atrac3': {
        source: 'iana',
      },
      'audio/basic': {
        source: 'iana',
        compressible: false,
        extensions: ['au', 'snd'],
      },
      'audio/bv16': {
        source: 'iana',
      },
      'audio/bv32': {
        source: 'iana',
      },
      'audio/clearmode': {
        source: 'iana',
      },
      'audio/cn': {
        source: 'iana',
      },
      'audio/dat12': {
        source: 'iana',
      },
      'audio/dls': {
        source: 'iana',
      },
      'audio/dsr-es201108': {
        source: 'iana',
      },
      'audio/dsr-es202050': {
        source: 'iana',
      },
      'audio/dsr-es202211': {
        source: 'iana',
      },
      'audio/dsr-es202212': {
        source: 'iana',
      },
      'audio/dv': {
        source: 'iana',
      },
      'audio/dvi4': {
        source: 'iana',
      },
      'audio/eac3': {
        source: 'iana',
      },
      'audio/encaprtp': {
        source: 'iana',
      },
      'audio/evrc': {
        source: 'iana',
      },
      'audio/evrc-qcp': {
        source: 'iana',
      },
      'audio/evrc0': {
        source: 'iana',
      },
      'audio/evrc1': {
        source: 'iana',
      },
      'audio/evrcb': {
        source: 'iana',
      },
      'audio/evrcb0': {
        source: 'iana',
      },
      'audio/evrcb1': {
        source: 'iana',
      },
      'audio/evrcnw': {
        source: 'iana',
      },
      'audio/evrcnw0': {
        source: 'iana',
      },
      'audio/evrcnw1': {
        source: 'iana',
      },
      'audio/evrcwb': {
        source: 'iana',
      },
      'audio/evrcwb0': {
        source: 'iana',
      },
      'audio/evrcwb1': {
        source: 'iana',
      },
      'audio/evs': {
        source: 'iana',
      },
      'audio/flexfec': {
        source: 'iana',
      },
      'audio/fwdred': {
        source: 'iana',
      },
      'audio/g711-0': {
        source: 'iana',
      },
      'audio/g719': {
        source: 'iana',
      },
      'audio/g722': {
        source: 'iana',
      },
      'audio/g7221': {
        source: 'iana',
      },
      'audio/g723': {
        source: 'iana',
      },
      'audio/g726-16': {
        source: 'iana',
      },
      'audio/g726-24': {
        source: 'iana',
      },
      'audio/g726-32': {
        source: 'iana',
      },
      'audio/g726-40': {
        source: 'iana',
      },
      'audio/g728': {
        source: 'iana',
      },
      'audio/g729': {
        source: 'iana',
      },
      'audio/g7291': {
        source: 'iana',
      },
      'audio/g729d': {
        source: 'iana',
      },
      'audio/g729e': {
        source: 'iana',
      },
      'audio/gsm': {
        source: 'iana',
      },
      'audio/gsm-efr': {
        source: 'iana',
      },
      'audio/gsm-hr-08': {
        source: 'iana',
      },
      'audio/ilbc': {
        source: 'iana',
      },
      'audio/ip-mr_v2.5': {
        source: 'iana',
      },
      'audio/isac': {
        source: 'apache',
      },
      'audio/l16': {
        source: 'iana',
      },
      'audio/l20': {
        source: 'iana',
      },
      'audio/l24': {
        source: 'iana',
        compressible: false,
      },
      'audio/l8': {
        source: 'iana',
      },
      'audio/lpc': {
        source: 'iana',
      },
      'audio/melp': {
        source: 'iana',
      },
      'audio/melp1200': {
        source: 'iana',
      },
      'audio/melp2400': {
        source: 'iana',
      },
      'audio/melp600': {
        source: 'iana',
      },
      'audio/mhas': {
        source: 'iana',
      },
      'audio/midi': {
        source: 'apache',
        extensions: ['mid', 'midi', 'kar', 'rmi'],
      },
      'audio/mobile-xmf': {
        source: 'iana',
        extensions: ['mxmf'],
      },
      'audio/mp3': {
        compressible: false,
        extensions: ['mp3'],
      },
      'audio/mp4': {
        source: 'iana',
        compressible: false,
        extensions: ['m4a', 'mp4a'],
      },
      'audio/mp4a-latm': {
        source: 'iana',
      },
      'audio/mpa': {
        source: 'iana',
      },
      'audio/mpa-robust': {
        source: 'iana',
      },
      'audio/mpeg': {
        source: 'iana',
        compressible: false,
        extensions: ['mpga', 'mp2', 'mp2a', 'mp3', 'm2a', 'm3a'],
      },
      'audio/mpeg4-generic': {
        source: 'iana',
      },
      'audio/musepack': {
        source: 'apache',
      },
      'audio/ogg': {
        source: 'iana',
        compressible: false,
        extensions: ['oga', 'ogg', 'spx', 'opus'],
      },
      'audio/opus': {
        source: 'iana',
      },
      'audio/parityfec': {
        source: 'iana',
      },
      'audio/pcma': {
        source: 'iana',
      },
      'audio/pcma-wb': {
        source: 'iana',
      },
      'audio/pcmu': {
        source: 'iana',
      },
      'audio/pcmu-wb': {
        source: 'iana',
      },
      'audio/prs.sid': {
        source: 'iana',
      },
      'audio/qcelp': {
        source: 'iana',
      },
      'audio/raptorfec': {
        source: 'iana',
      },
      'audio/red': {
        source: 'iana',
      },
      'audio/rtp-enc-aescm128': {
        source: 'iana',
      },
      'audio/rtp-midi': {
        source: 'iana',
      },
      'audio/rtploopback': {
        source: 'iana',
      },
      'audio/rtx': {
        source: 'iana',
      },
      'audio/s3m': {
        source: 'apache',
        extensions: ['s3m'],
      },
      'audio/scip': {
        source: 'iana',
      },
      'audio/silk': {
        source: 'apache',
        extensions: ['sil'],
      },
      'audio/smv': {
        source: 'iana',
      },
      'audio/smv-qcp': {
        source: 'iana',
      },
      'audio/smv0': {
        source: 'iana',
      },
      'audio/sofa': {
        source: 'iana',
      },
      'audio/sp-midi': {
        source: 'iana',
      },
      'audio/speex': {
        source: 'iana',
      },
      'audio/t140c': {
        source: 'iana',
      },
      'audio/t38': {
        source: 'iana',
      },
      'audio/telephone-event': {
        source: 'iana',
      },
      'audio/tetra_acelp': {
        source: 'iana',
      },
      'audio/tetra_acelp_bb': {
        source: 'iana',
      },
      'audio/tone': {
        source: 'iana',
      },
      'audio/tsvcis': {
        source: 'iana',
      },
      'audio/uemclip': {
        source: 'iana',
      },
      'audio/ulpfec': {
        source: 'iana',
      },
      'audio/usac': {
        source: 'iana',
      },
      'audio/vdvi': {
        source: 'iana',
      },
      'audio/vmr-wb': {
        source: 'iana',
      },
      'audio/vnd.3gpp.iufp': {
        source: 'iana',
      },
      'audio/vnd.4sb': {
        source: 'iana',
      },
      'audio/vnd.audiokoz': {
        source: 'iana',
      },
      'audio/vnd.celp': {
        source: 'iana',
      },
      'audio/vnd.cisco.nse': {
        source: 'iana',
      },
      'audio/vnd.cmles.radio-events': {
        source: 'iana',
      },
      'audio/vnd.cns.anp1': {
        source: 'iana',
      },
      'audio/vnd.cns.inf1': {
        source: 'iana',
      },
      'audio/vnd.dece.audio': {
        source: 'iana',
        extensions: ['uva', 'uvva'],
      },
      'audio/vnd.digital-winds': {
        source: 'iana',
        extensions: ['eol'],
      },
      'audio/vnd.dlna.adts': {
        source: 'iana',
      },
      'audio/vnd.dolby.heaac.1': {
        source: 'iana',
      },
      'audio/vnd.dolby.heaac.2': {
        source: 'iana',
      },
      'audio/vnd.dolby.mlp': {
        source: 'iana',
      },
      'audio/vnd.dolby.mps': {
        source: 'iana',
      },
      'audio/vnd.dolby.pl2': {
        source: 'iana',
      },
      'audio/vnd.dolby.pl2x': {
        source: 'iana',
      },
      'audio/vnd.dolby.pl2z': {
        source: 'iana',
      },
      'audio/vnd.dolby.pulse.1': {
        source: 'iana',
      },
      'audio/vnd.dra': {
        source: 'iana',
        extensions: ['dra'],
      },
      'audio/vnd.dts': {
        source: 'iana',
        extensions: ['dts'],
      },
      'audio/vnd.dts.hd': {
        source: 'iana',
        extensions: ['dtshd'],
      },
      'audio/vnd.dts.uhd': {
        source: 'iana',
      },
      'audio/vnd.dvb.file': {
        source: 'iana',
      },
      'audio/vnd.everad.plj': {
        source: 'iana',
      },
      'audio/vnd.hns.audio': {
        source: 'iana',
      },
      'audio/vnd.lucent.voice': {
        source: 'iana',
        extensions: ['lvp'],
      },
      'audio/vnd.ms-playready.media.pya': {
        source: 'iana',
        extensions: ['pya'],
      },
      'audio/vnd.nokia.mobile-xmf': {
        source: 'iana',
      },
      'audio/vnd.nortel.vbk': {
        source: 'iana',
      },
      'audio/vnd.nuera.ecelp4800': {
        source: 'iana',
        extensions: ['ecelp4800'],
      },
      'audio/vnd.nuera.ecelp7470': {
        source: 'iana',
        extensions: ['ecelp7470'],
      },
      'audio/vnd.nuera.ecelp9600': {
        source: 'iana',
        extensions: ['ecelp9600'],
      },
      'audio/vnd.octel.sbc': {
        source: 'iana',
      },
      'audio/vnd.presonus.multitrack': {
        source: 'iana',
      },
      'audio/vnd.qcelp': {
        source: 'iana',
      },
      'audio/vnd.rhetorex.32kadpcm': {
        source: 'iana',
      },
      'audio/vnd.rip': {
        source: 'iana',
        extensions: ['rip'],
      },
      'audio/vnd.rn-realaudio': {
        compressible: false,
      },
      'audio/vnd.sealedmedia.softseal.mpeg': {
        source: 'iana',
      },
      'audio/vnd.vmx.cvsd': {
        source: 'iana',
      },
      'audio/vnd.wave': {
        compressible: false,
      },
      'audio/vorbis': {
        source: 'iana',
        compressible: false,
      },
      'audio/vorbis-config': {
        source: 'iana',
      },
      'audio/wav': {
        compressible: false,
        extensions: ['wav'],
      },
      'audio/wave': {
        compressible: false,
        extensions: ['wav'],
      },
      'audio/webm': {
        source: 'apache',
        compressible: false,
        extensions: ['weba'],
      },
      'audio/x-aac': {
        source: 'apache',
        compressible: false,
        extensions: ['aac'],
      },
      'audio/x-aiff': {
        source: 'apache',
        extensions: ['aif', 'aiff', 'aifc'],
      },
      'audio/x-caf': {
        source: 'apache',
        compressible: false,
        extensions: ['caf'],
      },
      'audio/x-flac': {
        source: 'apache',
        extensions: ['flac'],
      },
      'audio/x-m4a': {
        source: 'nginx',
        extensions: ['m4a'],
      },
      'audio/x-matroska': {
        source: 'apache',
        extensions: ['mka'],
      },
      'audio/x-mpegurl': {
        source: 'apache',
        extensions: ['m3u'],
      },
      'audio/x-ms-wax': {
        source: 'apache',
        extensions: ['wax'],
      },
      'audio/x-ms-wma': {
        source: 'apache',
        extensions: ['wma'],
      },
      'audio/x-pn-realaudio': {
        source: 'apache',
        extensions: ['ram', 'ra'],
      },
      'audio/x-pn-realaudio-plugin': {
        source: 'apache',
        extensions: ['rmp'],
      },
      'audio/x-realaudio': {
        source: 'nginx',
        extensions: ['ra'],
      },
      'audio/x-tta': {
        source: 'apache',
      },
      'audio/x-wav': {
        source: 'apache',
        extensions: ['wav'],
      },
      'audio/xm': {
        source: 'apache',
        extensions: ['xm'],
      },
      'chemical/x-cdx': {
        source: 'apache',
        extensions: ['cdx'],
      },
      'chemical/x-cif': {
        source: 'apache',
        extensions: ['cif'],
      },
      'chemical/x-cmdf': {
        source: 'apache',
        extensions: ['cmdf'],
      },
      'chemical/x-cml': {
        source: 'apache',
        extensions: ['cml'],
      },
      'chemical/x-csml': {
        source: 'apache',
        extensions: ['csml'],
      },
      'chemical/x-pdb': {
        source: 'apache',
      },
      'chemical/x-xyz': {
        source: 'apache',
        extensions: ['xyz'],
      },
      'font/collection': {
        source: 'iana',
        extensions: ['ttc'],
      },
      'font/otf': {
        source: 'iana',
        compressible: true,
        extensions: ['otf'],
      },
      'font/sfnt': {
        source: 'iana',
      },
      'font/ttf': {
        source: 'iana',
        compressible: true,
        extensions: ['ttf'],
      },
      'font/woff': {
        source: 'iana',
        extensions: ['woff'],
      },
      'font/woff2': {
        source: 'iana',
        extensions: ['woff2'],
      },
      'image/aces': {
        source: 'iana',
        extensions: ['exr'],
      },
      'image/apng': {
        compressible: false,
        extensions: ['apng'],
      },
      'image/avci': {
        source: 'iana',
        extensions: ['avci'],
      },
      'image/avcs': {
        source: 'iana',
        extensions: ['avcs'],
      },
      'image/avif': {
        source: 'iana',
        compressible: false,
        extensions: ['avif'],
      },
      'image/bmp': {
        source: 'iana',
        compressible: true,
        extensions: ['bmp'],
      },
      'image/cgm': {
        source: 'iana',
        extensions: ['cgm'],
      },
      'image/dicom-rle': {
        source: 'iana',
        extensions: ['drle'],
      },
      'image/emf': {
        source: 'iana',
        extensions: ['emf'],
      },
      'image/fits': {
        source: 'iana',
        extensions: ['fits'],
      },
      'image/g3fax': {
        source: 'iana',
        extensions: ['g3'],
      },
      'image/gif': {
        source: 'iana',
        compressible: false,
        extensions: ['gif'],
      },
      'image/heic': {
        source: 'iana',
        extensions: ['heic'],
      },
      'image/heic-sequence': {
        source: 'iana',
        extensions: ['heics'],
      },
      'image/heif': {
        source: 'iana',
        extensions: ['heif'],
      },
      'image/heif-sequence': {
        source: 'iana',
        extensions: ['heifs'],
      },
      'image/hej2k': {
        source: 'iana',
        extensions: ['hej2'],
      },
      'image/hsj2': {
        source: 'iana',
        extensions: ['hsj2'],
      },
      'image/ief': {
        source: 'iana',
        extensions: ['ief'],
      },
      'image/jls': {
        source: 'iana',
        extensions: ['jls'],
      },
      'image/jp2': {
        source: 'iana',
        compressible: false,
        extensions: ['jp2', 'jpg2'],
      },
      'image/jpeg': {
        source: 'iana',
        compressible: false,
        extensions: ['jpeg', 'jpg', 'jpe'],
      },
      'image/jph': {
        source: 'iana',
        extensions: ['jph'],
      },
      'image/jphc': {
        source: 'iana',
        extensions: ['jhc'],
      },
      'image/jpm': {
        source: 'iana',
        compressible: false,
        extensions: ['jpm'],
      },
      'image/jpx': {
        source: 'iana',
        compressible: false,
        extensions: ['jpx', 'jpf'],
      },
      'image/jxr': {
        source: 'iana',
        extensions: ['jxr'],
      },
      'image/jxra': {
        source: 'iana',
        extensions: ['jxra'],
      },
      'image/jxrs': {
        source: 'iana',
        extensions: ['jxrs'],
      },
      'image/jxs': {
        source: 'iana',
        extensions: ['jxs'],
      },
      'image/jxsc': {
        source: 'iana',
        extensions: ['jxsc'],
      },
      'image/jxsi': {
        source: 'iana',
        extensions: ['jxsi'],
      },
      'image/jxss': {
        source: 'iana',
        extensions: ['jxss'],
      },
      'image/ktx': {
        source: 'iana',
        extensions: ['ktx'],
      },
      'image/ktx2': {
        source: 'iana',
        extensions: ['ktx2'],
      },
      'image/naplps': {
        source: 'iana',
      },
      'image/pjpeg': {
        compressible: false,
      },
      'image/png': {
        source: 'iana',
        compressible: false,
        extensions: ['png'],
      },
      'image/prs.btif': {
        source: 'iana',
        extensions: ['btif'],
      },
      'image/prs.pti': {
        source: 'iana',
        extensions: ['pti'],
      },
      'image/pwg-raster': {
        source: 'iana',
      },
      'image/sgi': {
        source: 'apache',
        extensions: ['sgi'],
      },
      'image/svg+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['svg', 'svgz'],
      },
      'image/t38': {
        source: 'iana',
        extensions: ['t38'],
      },
      'image/tiff': {
        source: 'iana',
        compressible: false,
        extensions: ['tif', 'tiff'],
      },
      'image/tiff-fx': {
        source: 'iana',
        extensions: ['tfx'],
      },
      'image/vnd.adobe.photoshop': {
        source: 'iana',
        compressible: true,
        extensions: ['psd'],
      },
      'image/vnd.airzip.accelerator.azv': {
        source: 'iana',
        extensions: ['azv'],
      },
      'image/vnd.cns.inf2': {
        source: 'iana',
      },
      'image/vnd.dece.graphic': {
        source: 'iana',
        extensions: ['uvi', 'uvvi', 'uvg', 'uvvg'],
      },
      'image/vnd.djvu': {
        source: 'iana',
        extensions: ['djvu', 'djv'],
      },
      'image/vnd.dvb.subtitle': {
        source: 'iana',
        extensions: ['sub'],
      },
      'image/vnd.dwg': {
        source: 'iana',
        extensions: ['dwg'],
      },
      'image/vnd.dxf': {
        source: 'iana',
        extensions: ['dxf'],
      },
      'image/vnd.fastbidsheet': {
        source: 'iana',
        extensions: ['fbs'],
      },
      'image/vnd.fpx': {
        source: 'iana',
        extensions: ['fpx'],
      },
      'image/vnd.fst': {
        source: 'iana',
        extensions: ['fst'],
      },
      'image/vnd.fujixerox.edmics-mmr': {
        source: 'iana',
        extensions: ['mmr'],
      },
      'image/vnd.fujixerox.edmics-rlc': {
        source: 'iana',
        extensions: ['rlc'],
      },
      'image/vnd.globalgraphics.pgb': {
        source: 'iana',
      },
      'image/vnd.microsoft.icon': {
        source: 'iana',
        compressible: true,
        extensions: ['ico'],
      },
      'image/vnd.mix': {
        source: 'iana',
      },
      'image/vnd.mozilla.apng': {
        source: 'iana',
      },
      'image/vnd.ms-dds': {
        compressible: true,
        extensions: ['dds'],
      },
      'image/vnd.ms-modi': {
        source: 'iana',
        extensions: ['mdi'],
      },
      'image/vnd.ms-photo': {
        source: 'apache',
        extensions: ['wdp'],
      },
      'image/vnd.net-fpx': {
        source: 'iana',
        extensions: ['npx'],
      },
      'image/vnd.pco.b16': {
        source: 'iana',
        extensions: ['b16'],
      },
      'image/vnd.radiance': {
        source: 'iana',
      },
      'image/vnd.sealed.png': {
        source: 'iana',
      },
      'image/vnd.sealedmedia.softseal.gif': {
        source: 'iana',
      },
      'image/vnd.sealedmedia.softseal.jpg': {
        source: 'iana',
      },
      'image/vnd.svf': {
        source: 'iana',
      },
      'image/vnd.tencent.tap': {
        source: 'iana',
        extensions: ['tap'],
      },
      'image/vnd.valve.source.texture': {
        source: 'iana',
        extensions: ['vtf'],
      },
      'image/vnd.wap.wbmp': {
        source: 'iana',
        extensions: ['wbmp'],
      },
      'image/vnd.xiff': {
        source: 'iana',
        extensions: ['xif'],
      },
      'image/vnd.zbrush.pcx': {
        source: 'iana',
        extensions: ['pcx'],
      },
      'image/webp': {
        source: 'apache',
        extensions: ['webp'],
      },
      'image/wmf': {
        source: 'iana',
        extensions: ['wmf'],
      },
      'image/x-3ds': {
        source: 'apache',
        extensions: ['3ds'],
      },
      'image/x-cmu-raster': {
        source: 'apache',
        extensions: ['ras'],
      },
      'image/x-cmx': {
        source: 'apache',
        extensions: ['cmx'],
      },
      'image/x-freehand': {
        source: 'apache',
        extensions: ['fh', 'fhc', 'fh4', 'fh5', 'fh7'],
      },
      'image/x-icon': {
        source: 'apache',
        compressible: true,
        extensions: ['ico'],
      },
      'image/x-jng': {
        source: 'nginx',
        extensions: ['jng'],
      },
      'image/x-mrsid-image': {
        source: 'apache',
        extensions: ['sid'],
      },
      'image/x-ms-bmp': {
        source: 'nginx',
        compressible: true,
        extensions: ['bmp'],
      },
      'image/x-pcx': {
        source: 'apache',
        extensions: ['pcx'],
      },
      'image/x-pict': {
        source: 'apache',
        extensions: ['pic', 'pct'],
      },
      'image/x-portable-anymap': {
        source: 'apache',
        extensions: ['pnm'],
      },
      'image/x-portable-bitmap': {
        source: 'apache',
        extensions: ['pbm'],
      },
      'image/x-portable-graymap': {
        source: 'apache',
        extensions: ['pgm'],
      },
      'image/x-portable-pixmap': {
        source: 'apache',
        extensions: ['ppm'],
      },
      'image/x-rgb': {
        source: 'apache',
        extensions: ['rgb'],
      },
      'image/x-tga': {
        source: 'apache',
        extensions: ['tga'],
      },
      'image/x-xbitmap': {
        source: 'apache',
        extensions: ['xbm'],
      },
      'image/x-xcf': {
        compressible: false,
      },
      'image/x-xpixmap': {
        source: 'apache',
        extensions: ['xpm'],
      },
      'image/x-xwindowdump': {
        source: 'apache',
        extensions: ['xwd'],
      },
      'message/cpim': {
        source: 'iana',
      },
      'message/delivery-status': {
        source: 'iana',
      },
      'message/disposition-notification': {
        source: 'iana',
        extensions: ['disposition-notification'],
      },
      'message/external-body': {
        source: 'iana',
      },
      'message/feedback-report': {
        source: 'iana',
      },
      'message/global': {
        source: 'iana',
        extensions: ['u8msg'],
      },
      'message/global-delivery-status': {
        source: 'iana',
        extensions: ['u8dsn'],
      },
      'message/global-disposition-notification': {
        source: 'iana',
        extensions: ['u8mdn'],
      },
      'message/global-headers': {
        source: 'iana',
        extensions: ['u8hdr'],
      },
      'message/http': {
        source: 'iana',
        compressible: false,
      },
      'message/imdn+xml': {
        source: 'iana',
        compressible: true,
      },
      'message/news': {
        source: 'iana',
      },
      'message/partial': {
        source: 'iana',
        compressible: false,
      },
      'message/rfc822': {
        source: 'iana',
        compressible: true,
        extensions: ['eml', 'mime'],
      },
      'message/s-http': {
        source: 'iana',
      },
      'message/sip': {
        source: 'iana',
      },
      'message/sipfrag': {
        source: 'iana',
      },
      'message/tracking-status': {
        source: 'iana',
      },
      'message/vnd.si.simp': {
        source: 'iana',
      },
      'message/vnd.wfa.wsc': {
        source: 'iana',
        extensions: ['wsc'],
      },
      'model/3mf': {
        source: 'iana',
        extensions: ['3mf'],
      },
      'model/e57': {
        source: 'iana',
      },
      'model/gltf+json': {
        source: 'iana',
        compressible: true,
        extensions: ['gltf'],
      },
      'model/gltf-binary': {
        source: 'iana',
        compressible: true,
        extensions: ['glb'],
      },
      'model/iges': {
        source: 'iana',
        compressible: false,
        extensions: ['igs', 'iges'],
      },
      'model/mesh': {
        source: 'iana',
        compressible: false,
        extensions: ['msh', 'mesh', 'silo'],
      },
      'model/mtl': {
        source: 'iana',
        extensions: ['mtl'],
      },
      'model/obj': {
        source: 'iana',
        extensions: ['obj'],
      },
      'model/step': {
        source: 'iana',
      },
      'model/step+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['stpx'],
      },
      'model/step+zip': {
        source: 'iana',
        compressible: false,
        extensions: ['stpz'],
      },
      'model/step-xml+zip': {
        source: 'iana',
        compressible: false,
        extensions: ['stpxz'],
      },
      'model/stl': {
        source: 'iana',
        extensions: ['stl'],
      },
      'model/vnd.collada+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['dae'],
      },
      'model/vnd.dwf': {
        source: 'iana',
        extensions: ['dwf'],
      },
      'model/vnd.flatland.3dml': {
        source: 'iana',
      },
      'model/vnd.gdl': {
        source: 'iana',
        extensions: ['gdl'],
      },
      'model/vnd.gs-gdl': {
        source: 'apache',
      },
      'model/vnd.gs.gdl': {
        source: 'iana',
      },
      'model/vnd.gtw': {
        source: 'iana',
        extensions: ['gtw'],
      },
      'model/vnd.moml+xml': {
        source: 'iana',
        compressible: true,
      },
      'model/vnd.mts': {
        source: 'iana',
        extensions: ['mts'],
      },
      'model/vnd.opengex': {
        source: 'iana',
        extensions: ['ogex'],
      },
      'model/vnd.parasolid.transmit.binary': {
        source: 'iana',
        extensions: ['x_b'],
      },
      'model/vnd.parasolid.transmit.text': {
        source: 'iana',
        extensions: ['x_t'],
      },
      'model/vnd.pytha.pyox': {
        source: 'iana',
      },
      'model/vnd.rosette.annotated-data-model': {
        source: 'iana',
      },
      'model/vnd.sap.vds': {
        source: 'iana',
        extensions: ['vds'],
      },
      'model/vnd.usdz+zip': {
        source: 'iana',
        compressible: false,
        extensions: ['usdz'],
      },
      'model/vnd.valve.source.compiled-map': {
        source: 'iana',
        extensions: ['bsp'],
      },
      'model/vnd.vtu': {
        source: 'iana',
        extensions: ['vtu'],
      },
      'model/vrml': {
        source: 'iana',
        compressible: false,
        extensions: ['wrl', 'vrml'],
      },
      'model/x3d+binary': {
        source: 'apache',
        compressible: false,
        extensions: ['x3db', 'x3dbz'],
      },
      'model/x3d+fastinfoset': {
        source: 'iana',
        extensions: ['x3db'],
      },
      'model/x3d+vrml': {
        source: 'apache',
        compressible: false,
        extensions: ['x3dv', 'x3dvz'],
      },
      'model/x3d+xml': {
        source: 'iana',
        compressible: true,
        extensions: ['x3d', 'x3dz'],
      },
      'model/x3d-vrml': {
        source: 'iana',
        extensions: ['x3dv'],
      },
      'multipart/alternative': {
        source: 'iana',
        compressible: false,
      },
      'multipart/appledouble': {
        source: 'iana',
      },
      'multipart/byteranges': {
        source: 'iana',
      },
      'multipart/digest': {
        source: 'iana',
      },
      'multipart/encrypted': {
        source: 'iana',
        compressible: false,
      },
      'multipart/form-data': {
        source: 'iana',
        compressible: false,
      },
      'multipart/header-set': {
        source: 'iana',
      },
      'multipart/mixed': {
        source: 'iana',
      },
      'multipart/multilingual': {
        source: 'iana',
      },
      'multipart/parallel': {
        source: 'iana',
      },
      'multipart/related': {
        source: 'iana',
        compressible: false,
      },
      'multipart/report': {
        source: 'iana',
      },
      'multipart/signed': {
        source: 'iana',
        compressible: false,
      },
      'multipart/vnd.bint.med-plus': {
        source: 'iana',
      },
      'multipart/voice-message': {
        source: 'iana',
      },
      'multipart/x-mixed-replace': {
        source: 'iana',
      },
      'text/1d-interleaved-parityfec': {
        source: 'iana',
      },
      'text/cache-manifest': {
        source: 'iana',
        compressible: true,
        extensions: ['appcache', 'manifest'],
      },
      'text/calendar': {
        source: 'iana',
        extensions: ['ics', 'ifb'],
      },
      'text/calender': {
        compressible: true,
      },
      'text/cmd': {
        compressible: true,
      },
      'text/coffeescript': {
        extensions: ['coffee', 'litcoffee'],
      },
      'text/cql': {
        source: 'iana',
      },
      'text/cql-expression': {
        source: 'iana',
      },
      'text/cql-identifier': {
        source: 'iana',
      },
      'text/css': {
        source: 'iana',
        charset: 'UTF-8',
        compressible: true,
        extensions: ['css'],
      },
      'text/csv': {
        source: 'iana',
        compressible: true,
        extensions: ['csv'],
      },
      'text/csv-schema': {
        source: 'iana',
      },
      'text/directory': {
        source: 'iana',
      },
      'text/dns': {
        source: 'iana',
      },
      'text/ecmascript': {
        source: 'iana',
      },
      'text/encaprtp': {
        source: 'iana',
      },
      'text/enriched': {
        source: 'iana',
      },
      'text/fhirpath': {
        source: 'iana',
      },
      'text/flexfec': {
        source: 'iana',
      },
      'text/fwdred': {
        source: 'iana',
      },
      'text/gff3': {
        source: 'iana',
      },
      'text/grammar-ref-list': {
        source: 'iana',
      },
      'text/html': {
        source: 'iana',
        compressible: true,
        extensions: ['html', 'htm', 'shtml'],
      },
      'text/jade': {
        extensions: ['jade'],
      },
      'text/javascript': {
        source: 'iana',
        compressible: true,
      },
      'text/jcr-cnd': {
        source: 'iana',
      },
      'text/jsx': {
        compressible: true,
        extensions: ['jsx'],
      },
      'text/less': {
        compressible: true,
        extensions: ['less'],
      },
      'text/markdown': {
        source: 'iana',
        compressible: true,
        extensions: ['markdown', 'md'],
      },
      'text/mathml': {
        source: 'nginx',
        extensions: ['mml'],
      },
      'text/mdx': {
        compressible: true,
        extensions: ['mdx'],
      },
      'text/mizar': {
        source: 'iana',
      },
      'text/n3': {
        source: 'iana',
        charset: 'UTF-8',
        compressible: true,
        extensions: ['n3'],
      },
      'text/parameters': {
        source: 'iana',
        charset: 'UTF-8',
      },
      'text/parityfec': {
        source: 'iana',
      },
      'text/plain': {
        source: 'iana',
        compressible: true,
        extensions: ['txt', 'text', 'conf', 'def', 'list', 'log', 'in', 'ini'],
      },
      'text/provenance-notation': {
        source: 'iana',
        charset: 'UTF-8',
      },
      'text/prs.fallenstein.rst': {
        source: 'iana',
      },
      'text/prs.lines.tag': {
        source: 'iana',
        extensions: ['dsc'],
      },
      'text/prs.prop.logic': {
        source: 'iana',
      },
      'text/raptorfec': {
        source: 'iana',
      },
      'text/red': {
        source: 'iana',
      },
      'text/rfc822-headers': {
        source: 'iana',
      },
      'text/richtext': {
        source: 'iana',
        compressible: true,
        extensions: ['rtx'],
      },
      'text/rtf': {
        source: 'iana',
        compressible: true,
        extensions: ['rtf'],
      },
      'text/rtp-enc-aescm128': {
        source: 'iana',
      },
      'text/rtploopback': {
        source: 'iana',
      },
      'text/rtx': {
        source: 'iana',
      },
      'text/sgml': {
        source: 'iana',
        extensions: ['sgml', 'sgm'],
      },
      'text/shaclc': {
        source: 'iana',
      },
      'text/shex': {
        source: 'iana',
        extensions: ['shex'],
      },
      'text/slim': {
        extensions: ['slim', 'slm'],
      },
      'text/spdx': {
        source: 'iana',
        extensions: ['spdx'],
      },
      'text/strings': {
        source: 'iana',
      },
      'text/stylus': {
        extensions: ['stylus', 'styl'],
      },
      'text/t140': {
        source: 'iana',
      },
      'text/tab-separated-values': {
        source: 'iana',
        compressible: true,
        extensions: ['tsv'],
      },
      'text/troff': {
        source: 'iana',
        extensions: ['t', 'tr', 'roff', 'man', 'me', 'ms'],
      },
      'text/turtle': {
        source: 'iana',
        charset: 'UTF-8',
        extensions: ['ttl'],
      },
      'text/ulpfec': {
        source: 'iana',
      },
      'text/uri-list': {
        source: 'iana',
        compressible: true,
        extensions: ['uri', 'uris', 'urls'],
      },
      'text/vcard': {
        source: 'iana',
        compressible: true,
        extensions: ['vcard'],
      },
      'text/vnd.a': {
        source: 'iana',
      },
      'text/vnd.abc': {
        source: 'iana',
      },
      'text/vnd.ascii-art': {
        source: 'iana',
      },
      'text/vnd.curl': {
        source: 'iana',
        extensions: ['curl'],
      },
      'text/vnd.curl.dcurl': {
        source: 'apache',
        extensions: ['dcurl'],
      },
      'text/vnd.curl.mcurl': {
        source: 'apache',
        extensions: ['mcurl'],
      },
      'text/vnd.curl.scurl': {
        source: 'apache',
        extensions: ['scurl'],
      },
      'text/vnd.debian.copyright': {
        source: 'iana',
        charset: 'UTF-8',
      },
      'text/vnd.dmclientscript': {
        source: 'iana',
      },
      'text/vnd.dvb.subtitle': {
        source: 'iana',
        extensions: ['sub'],
      },
      'text/vnd.esmertec.theme-descriptor': {
        source: 'iana',
        charset: 'UTF-8',
      },
      'text/vnd.familysearch.gedcom': {
        source: 'iana',
        extensions: ['ged'],
      },
      'text/vnd.ficlab.flt': {
        source: 'iana',
      },
      'text/vnd.fly': {
        source: 'iana',
        extensions: ['fly'],
      },
      'text/vnd.fmi.flexstor': {
        source: 'iana',
        extensions: ['flx'],
      },
      'text/vnd.gml': {
        source: 'iana',
      },
      'text/vnd.graphviz': {
        source: 'iana',
        extensions: ['gv'],
      },
      'text/vnd.hans': {
        source: 'iana',
      },
      'text/vnd.hgl': {
        source: 'iana',
      },
      'text/vnd.in3d.3dml': {
        source: 'iana',
        extensions: ['3dml'],
      },
      'text/vnd.in3d.spot': {
        source: 'iana',
        extensions: ['spot'],
      },
      'text/vnd.iptc.newsml': {
        source: 'iana',
      },
      'text/vnd.iptc.nitf': {
        source: 'iana',
      },
      'text/vnd.latex-z': {
        source: 'iana',
      },
      'text/vnd.motorola.reflex': {
        source: 'iana',
      },
      'text/vnd.ms-mediapackage': {
        source: 'iana',
      },
      'text/vnd.net2phone.commcenter.command': {
        source: 'iana',
      },
      'text/vnd.radisys.msml-basic-layout': {
        source: 'iana',
      },
      'text/vnd.senx.warpscript': {
        source: 'iana',
      },
      'text/vnd.si.uricatalogue': {
        source: 'iana',
      },
      'text/vnd.sosi': {
        source: 'iana',
      },
      'text/vnd.sun.j2me.app-descriptor': {
        source: 'iana',
        charset: 'UTF-8',
        extensions: ['jad'],
      },
      'text/vnd.trolltech.linguist': {
        source: 'iana',
        charset: 'UTF-8',
      },
      'text/vnd.wap.si': {
        source: 'iana',
      },
      'text/vnd.wap.sl': {
        source: 'iana',
      },
      'text/vnd.wap.wml': {
        source: 'iana',
        extensions: ['wml'],
      },
      'text/vnd.wap.wmlscript': {
        source: 'iana',
        extensions: ['wmls'],
      },
      'text/vtt': {
        source: 'iana',
        charset: 'UTF-8',
        compressible: true,
        extensions: ['vtt'],
      },
      'text/x-asm': {
        source: 'apache',
        extensions: ['s', 'asm'],
      },
      'text/x-c': {
        source: 'apache',
        extensions: ['c', 'cc', 'cxx', 'cpp', 'h', 'hh', 'dic'],
      },
      'text/x-component': {
        source: 'nginx',
        extensions: ['htc'],
      },
      'text/x-fortran': {
        source: 'apache',
        extensions: ['f', 'for', 'f77', 'f90'],
      },
      'text/x-gwt-rpc': {
        compressible: true,
      },
      'text/x-handlebars-template': {
        extensions: ['hbs'],
      },
      'text/x-java-source': {
        source: 'apache',
        extensions: ['java'],
      },
      'text/x-jquery-tmpl': {
        compressible: true,
      },
      'text/x-lua': {
        extensions: ['lua'],
      },
      'text/x-markdown': {
        compressible: true,
        extensions: ['mkd'],
      },
      'text/x-nfo': {
        source: 'apache',
        extensions: ['nfo'],
      },
      'text/x-opml': {
        source: 'apache',
        extensions: ['opml'],
      },
      'text/x-org': {
        compressible: true,
        extensions: ['org'],
      },
      'text/x-pascal': {
        source: 'apache',
        extensions: ['p', 'pas'],
      },
      'text/x-processing': {
        compressible: true,
        extensions: ['pde'],
      },
      'text/x-sass': {
        extensions: ['sass'],
      },
      'text/x-scss': {
        extensions: ['scss'],
      },
      'text/x-setext': {
        source: 'apache',
        extensions: ['etx'],
      },
      'text/x-sfv': {
        source: 'apache',
        extensions: ['sfv'],
      },
      'text/x-suse-ymp': {
        compressible: true,
        extensions: ['ymp'],
      },
      'text/x-uuencode': {
        source: 'apache',
        extensions: ['uu'],
      },
      'text/x-vcalendar': {
        source: 'apache',
        extensions: ['vcs'],
      },
      'text/x-vcard': {
        source: 'apache',
        extensions: ['vcf'],
      },
      'text/xml': {
        source: 'iana',
        compressible: true,
        extensions: ['xml'],
      },
      'text/xml-external-parsed-entity': {
        source: 'iana',
      },
      'text/yaml': {
        compressible: true,
        extensions: ['yaml', 'yml'],
      },
      'video/1d-interleaved-parityfec': {
        source: 'iana',
      },
      'video/3gpp': {
        source: 'iana',
        extensions: ['3gp', '3gpp'],
      },
      'video/3gpp-tt': {
        source: 'iana',
      },
      'video/3gpp2': {
        source: 'iana',
        extensions: ['3g2'],
      },
      'video/av1': {
        source: 'iana',
      },
      'video/bmpeg': {
        source: 'iana',
      },
      'video/bt656': {
        source: 'iana',
      },
      'video/celb': {
        source: 'iana',
      },
      'video/dv': {
        source: 'iana',
      },
      'video/encaprtp': {
        source: 'iana',
      },
      'video/ffv1': {
        source: 'iana',
      },
      'video/flexfec': {
        source: 'iana',
      },
      'video/h261': {
        source: 'iana',
        extensions: ['h261'],
      },
      'video/h263': {
        source: 'iana',
        extensions: ['h263'],
      },
      'video/h263-1998': {
        source: 'iana',
      },
      'video/h263-2000': {
        source: 'iana',
      },
      'video/h264': {
        source: 'iana',
        extensions: ['h264'],
      },
      'video/h264-rcdo': {
        source: 'iana',
      },
      'video/h264-svc': {
        source: 'iana',
      },
      'video/h265': {
        source: 'iana',
      },
      'video/iso.segment': {
        source: 'iana',
        extensions: ['m4s'],
      },
      'video/jpeg': {
        source: 'iana',
        extensions: ['jpgv'],
      },
      'video/jpeg2000': {
        source: 'iana',
      },
      'video/jpm': {
        source: 'apache',
        extensions: ['jpm', 'jpgm'],
      },
      'video/jxsv': {
        source: 'iana',
      },
      'video/mj2': {
        source: 'iana',
        extensions: ['mj2', 'mjp2'],
      },
      'video/mp1s': {
        source: 'iana',
      },
      'video/mp2p': {
        source: 'iana',
      },
      'video/mp2t': {
        source: 'iana',
        extensions: ['ts'],
      },
      'video/mp4': {
        source: 'iana',
        compressible: false,
        extensions: ['mp4', 'mp4v', 'mpg4'],
      },
      'video/mp4v-es': {
        source: 'iana',
      },
      'video/mpeg': {
        source: 'iana',
        compressible: false,
        extensions: ['mpeg', 'mpg', 'mpe', 'm1v', 'm2v'],
      },
      'video/mpeg4-generic': {
        source: 'iana',
      },
      'video/mpv': {
        source: 'iana',
      },
      'video/nv': {
        source: 'iana',
      },
      'video/ogg': {
        source: 'iana',
        compressible: false,
        extensions: ['ogv'],
      },
      'video/parityfec': {
        source: 'iana',
      },
      'video/pointer': {
        source: 'iana',
      },
      'video/quicktime': {
        source: 'iana',
        compressible: false,
        extensions: ['qt', 'mov'],
      },
      'video/raptorfec': {
        source: 'iana',
      },
      'video/raw': {
        source: 'iana',
      },
      'video/rtp-enc-aescm128': {
        source: 'iana',
      },
      'video/rtploopback': {
        source: 'iana',
      },
      'video/rtx': {
        source: 'iana',
      },
      'video/scip': {
        source: 'iana',
      },
      'video/smpte291': {
        source: 'iana',
      },
      'video/smpte292m': {
        source: 'iana',
      },
      'video/ulpfec': {
        source: 'iana',
      },
      'video/vc1': {
        source: 'iana',
      },
      'video/vc2': {
        source: 'iana',
      },
      'video/vnd.cctv': {
        source: 'iana',
      },
      'video/vnd.dece.hd': {
        source: 'iana',
        extensions: ['uvh', 'uvvh'],
      },
      'video/vnd.dece.mobile': {
        source: 'iana',
        extensions: ['uvm', 'uvvm'],
      },
      'video/vnd.dece.mp4': {
        source: 'iana',
      },
      'video/vnd.dece.pd': {
        source: 'iana',
        extensions: ['uvp', 'uvvp'],
      },
      'video/vnd.dece.sd': {
        source: 'iana',
        extensions: ['uvs', 'uvvs'],
      },
      'video/vnd.dece.video': {
        source: 'iana',
        extensions: ['uvv', 'uvvv'],
      },
      'video/vnd.directv.mpeg': {
        source: 'iana',
      },
      'video/vnd.directv.mpeg-tts': {
        source: 'iana',
      },
      'video/vnd.dlna.mpeg-tts': {
        source: 'iana',
      },
      'video/vnd.dvb.file': {
        source: 'iana',
        extensions: ['dvb'],
      },
      'video/vnd.fvt': {
        source: 'iana',
        extensions: ['fvt'],
      },
      'video/vnd.hns.video': {
        source: 'iana',
      },
      'video/vnd.iptvforum.1dparityfec-1010': {
        source: 'iana',
      },
      'video/vnd.iptvforum.1dparityfec-2005': {
        source: 'iana',
      },
      'video/vnd.iptvforum.2dparityfec-1010': {
        source: 'iana',
      },
      'video/vnd.iptvforum.2dparityfec-2005': {
        source: 'iana',
      },
      'video/vnd.iptvforum.ttsavc': {
        source: 'iana',
      },
      'video/vnd.iptvforum.ttsmpeg2': {
        source: 'iana',
      },
      'video/vnd.motorola.video': {
        source: 'iana',
      },
      'video/vnd.motorola.videop': {
        source: 'iana',
      },
      'video/vnd.mpegurl': {
        source: 'iana',
        extensions: ['mxu', 'm4u'],
      },
      'video/vnd.ms-playready.media.pyv': {
        source: 'iana',
        extensions: ['pyv'],
      },
      'video/vnd.nokia.interleaved-multimedia': {
        source: 'iana',
      },
      'video/vnd.nokia.mp4vr': {
        source: 'iana',
      },
      'video/vnd.nokia.videovoip': {
        source: 'iana',
      },
      'video/vnd.objectvideo': {
        source: 'iana',
      },
      'video/vnd.radgamettools.bink': {
        source: 'iana',
      },
      'video/vnd.radgamettools.smacker': {
        source: 'iana',
      },
      'video/vnd.sealed.mpeg1': {
        source: 'iana',
      },
      'video/vnd.sealed.mpeg4': {
        source: 'iana',
      },
      'video/vnd.sealed.swf': {
        source: 'iana',
      },
      'video/vnd.sealedmedia.softseal.mov': {
        source: 'iana',
      },
      'video/vnd.uvvu.mp4': {
        source: 'iana',
        extensions: ['uvu', 'uvvu'],
      },
      'video/vnd.vivo': {
        source: 'iana',
        extensions: ['viv'],
      },
      'video/vnd.youtube.yt': {
        source: 'iana',
      },
      'video/vp8': {
        source: 'iana',
      },
      'video/vp9': {
        source: 'iana',
      },
      'video/webm': {
        source: 'apache',
        compressible: false,
        extensions: ['webm'],
      },
      'video/x-f4v': {
        source: 'apache',
        extensions: ['f4v'],
      },
      'video/x-fli': {
        source: 'apache',
        extensions: ['fli'],
      },
      'video/x-flv': {
        source: 'apache',
        compressible: false,
        extensions: ['flv'],
      },
      'video/x-m4v': {
        source: 'apache',
        extensions: ['m4v'],
      },
      'video/x-matroska': {
        source: 'apache',
        compressible: false,
        extensions: ['mkv', 'mk3d', 'mks'],
      },
      'video/x-mng': {
        source: 'apache',
        extensions: ['mng'],
      },
      'video/x-ms-asf': {
        source: 'apache',
        extensions: ['asf', 'asx'],
      },
      'video/x-ms-vob': {
        source: 'apache',
        extensions: ['vob'],
      },
      'video/x-ms-wm': {
        source: 'apache',
        extensions: ['wm'],
      },
      'video/x-ms-wmv': {
        source: 'apache',
        compressible: false,
        extensions: ['wmv'],
      },
      'video/x-ms-wmx': {
        source: 'apache',
        extensions: ['wmx'],
      },
      'video/x-ms-wvx': {
        source: 'apache',
        extensions: ['wvx'],
      },
      'video/x-msvideo': {
        source: 'apache',
        extensions: ['avi'],
      },
      'video/x-sgi-movie': {
        source: 'apache',
        extensions: ['movie'],
      },
      'video/x-smv': {
        source: 'apache',
        extensions: ['smv'],
      },
      'x-conference/x-cooltalk': {
        source: 'apache',
        extensions: ['ice'],
      },
      'x-shader/x-fragment': {
        compressible: true,
      },
      'x-shader/x-vertex': {
        compressible: true,
      },
    };
  },
});

// node_modules/mime-db/index.js
var require_mime_db = __commonJS({
  'node_modules/mime-db/index.js'(exports2, module2) {
    module2.exports = require_db();
  },
});

// node_modules/mime-types/index.js
var require_mime_types = __commonJS({
  'node_modules/mime-types/index.js'(exports2) {
    'use strict';
    var db = require_mime_db();
    var extname = require('path').extname;
    var EXTRACT_TYPE_REGEXP = /^\s*([^;\s]*)(?:;|\s|$)/;
    var TEXT_TYPE_REGEXP = /^text\//i;
    exports2.charset = charset;
    exports2.charsets = { lookup: charset };
    exports2.contentType = contentType;
    exports2.extension = extension;
    exports2.extensions = /* @__PURE__ */ Object.create(null);
    exports2.lookup = lookup;
    exports2.types = /* @__PURE__ */ Object.create(null);
    populateMaps(exports2.extensions, exports2.types);
    function charset(type) {
      if (!type || typeof type !== 'string') {
        return false;
      }
      var match = EXTRACT_TYPE_REGEXP.exec(type);
      var mime = match && db[match[1].toLowerCase()];
      if (mime && mime.charset) {
        return mime.charset;
      }
      if (match && TEXT_TYPE_REGEXP.test(match[1])) {
        return 'UTF-8';
      }
      return false;
    }
    function contentType(str) {
      if (!str || typeof str !== 'string') {
        return false;
      }
      var mime = str.indexOf('/') === -1 ? exports2.lookup(str) : str;
      if (!mime) {
        return false;
      }
      if (mime.indexOf('charset') === -1) {
        var charset2 = exports2.charset(mime);
        if (charset2) mime += '; charset=' + charset2.toLowerCase();
      }
      return mime;
    }
    function extension(type) {
      if (!type || typeof type !== 'string') {
        return false;
      }
      var match = EXTRACT_TYPE_REGEXP.exec(type);
      var exts = match && exports2.extensions[match[1].toLowerCase()];
      if (!exts || !exts.length) {
        return false;
      }
      return exts[0];
    }
    function lookup(path) {
      if (!path || typeof path !== 'string') {
        return false;
      }
      var extension2 = extname('x.' + path)
        .toLowerCase()
        .substr(1);
      if (!extension2) {
        return false;
      }
      return exports2.types[extension2] || false;
    }
    function populateMaps(extensions, types) {
      var preference = ['nginx', 'apache', void 0, 'iana'];
      Object.keys(db).forEach(function forEachMimeType(type) {
        var mime = db[type];
        var exts = mime.extensions;
        if (!exts || !exts.length) {
          return;
        }
        extensions[type] = exts;
        for (var i = 0; i < exts.length; i++) {
          var extension2 = exts[i];
          if (types[extension2]) {
            var from = preference.indexOf(db[types[extension2]].source);
            var to = preference.indexOf(mime.source);
            if (
              types[extension2] !== 'application/octet-stream' &&
              (from > to || (from === to && types[extension2].substr(0, 12) === 'application/'))
            ) {
              continue;
            }
          }
          types[extension2] = type;
        }
      });
    }
  },
});

// node_modules/asynckit/lib/defer.js
var require_defer = __commonJS({
  'node_modules/asynckit/lib/defer.js'(exports2, module2) {
    module2.exports = defer;
    function defer(fn) {
      var nextTick =
        typeof setImmediate == 'function'
          ? setImmediate
          : typeof process == 'object' && typeof process.nextTick == 'function'
            ? process.nextTick
            : null;
      if (nextTick) {
        nextTick(fn);
      } else {
        setTimeout(fn, 0);
      }
    }
  },
});

// node_modules/asynckit/lib/async.js
var require_async = __commonJS({
  'node_modules/asynckit/lib/async.js'(exports2, module2) {
    var defer = require_defer();
    module2.exports = async;
    function async(callback) {
      var isAsync = false;
      defer(function () {
        isAsync = true;
      });
      return function async_callback(err, result) {
        if (isAsync) {
          callback(err, result);
        } else {
          defer(function nextTick_callback() {
            callback(err, result);
          });
        }
      };
    }
  },
});

// node_modules/asynckit/lib/abort.js
var require_abort = __commonJS({
  'node_modules/asynckit/lib/abort.js'(exports2, module2) {
    module2.exports = abort;
    function abort(state) {
      Object.keys(state.jobs).forEach(clean.bind(state));
      state.jobs = {};
    }
    function clean(key) {
      if (typeof this.jobs[key] == 'function') {
        this.jobs[key]();
      }
    }
  },
});

// node_modules/asynckit/lib/iterate.js
var require_iterate = __commonJS({
  'node_modules/asynckit/lib/iterate.js'(exports2, module2) {
    var async = require_async();
    var abort = require_abort();
    module2.exports = iterate;
    function iterate(list, iterator, state, callback) {
      var key = state['keyedList'] ? state['keyedList'][state.index] : state.index;
      state.jobs[key] = runJob(iterator, key, list[key], function (error, output) {
        if (!(key in state.jobs)) {
          return;
        }
        delete state.jobs[key];
        if (error) {
          abort(state);
        } else {
          state.results[key] = output;
        }
        callback(error, state.results);
      });
    }
    function runJob(iterator, key, item, callback) {
      var aborter;
      if (iterator.length == 2) {
        aborter = iterator(item, async(callback));
      } else {
        aborter = iterator(item, key, async(callback));
      }
      return aborter;
    }
  },
});

// node_modules/asynckit/lib/state.js
var require_state = __commonJS({
  'node_modules/asynckit/lib/state.js'(exports2, module2) {
    module2.exports = state;
    function state(list, sortMethod) {
      var isNamedList = !Array.isArray(list),
        initState = {
          index: 0,
          keyedList: isNamedList || sortMethod ? Object.keys(list) : null,
          jobs: {},
          results: isNamedList ? {} : [],
          size: isNamedList ? Object.keys(list).length : list.length,
        };
      if (sortMethod) {
        initState.keyedList.sort(
          isNamedList
            ? sortMethod
            : function (a, b) {
                return sortMethod(list[a], list[b]);
              }
        );
      }
      return initState;
    }
  },
});

// node_modules/asynckit/lib/terminator.js
var require_terminator = __commonJS({
  'node_modules/asynckit/lib/terminator.js'(exports2, module2) {
    var abort = require_abort();
    var async = require_async();
    module2.exports = terminator;
    function terminator(callback) {
      if (!Object.keys(this.jobs).length) {
        return;
      }
      this.index = this.size;
      abort(this);
      async(callback)(null, this.results);
    }
  },
});

// node_modules/asynckit/parallel.js
var require_parallel = __commonJS({
  'node_modules/asynckit/parallel.js'(exports2, module2) {
    var iterate = require_iterate();
    var initState = require_state();
    var terminator = require_terminator();
    module2.exports = parallel;
    function parallel(list, iterator, callback) {
      var state = initState(list);
      while (state.index < (state['keyedList'] || list).length) {
        iterate(list, iterator, state, function (error, result) {
          if (error) {
            callback(error, result);
            return;
          }
          if (Object.keys(state.jobs).length === 0) {
            callback(null, state.results);
            return;
          }
        });
        state.index++;
      }
      return terminator.bind(state, callback);
    }
  },
});

// node_modules/asynckit/serialOrdered.js
var require_serialOrdered = __commonJS({
  'node_modules/asynckit/serialOrdered.js'(exports2, module2) {
    var iterate = require_iterate();
    var initState = require_state();
    var terminator = require_terminator();
    module2.exports = serialOrdered;
    module2.exports.ascending = ascending;
    module2.exports.descending = descending;
    function serialOrdered(list, iterator, sortMethod, callback) {
      var state = initState(list, sortMethod);
      iterate(list, iterator, state, function iteratorHandler(error, result) {
        if (error) {
          callback(error, result);
          return;
        }
        state.index++;
        if (state.index < (state['keyedList'] || list).length) {
          iterate(list, iterator, state, iteratorHandler);
          return;
        }
        callback(null, state.results);
      });
      return terminator.bind(state, callback);
    }
    function ascending(a, b) {
      return a < b ? -1 : a > b ? 1 : 0;
    }
    function descending(a, b) {
      return -1 * ascending(a, b);
    }
  },
});

// node_modules/asynckit/serial.js
var require_serial = __commonJS({
  'node_modules/asynckit/serial.js'(exports2, module2) {
    var serialOrdered = require_serialOrdered();
    module2.exports = serial;
    function serial(list, iterator, callback) {
      return serialOrdered(list, iterator, null, callback);
    }
  },
});

// node_modules/asynckit/index.js
var require_asynckit = __commonJS({
  'node_modules/asynckit/index.js'(exports2, module2) {
    module2.exports = {
      parallel: require_parallel(),
      serial: require_serial(),
      serialOrdered: require_serialOrdered(),
    };
  },
});

// node_modules/es-object-atoms/index.js
var require_es_object_atoms = __commonJS({
  'node_modules/es-object-atoms/index.js'(exports2, module2) {
    'use strict';
    module2.exports = Object;
  },
});

// node_modules/es-errors/index.js
var require_es_errors = __commonJS({
  'node_modules/es-errors/index.js'(exports2, module2) {
    'use strict';
    module2.exports = Error;
  },
});

// node_modules/es-errors/eval.js
var require_eval = __commonJS({
  'node_modules/es-errors/eval.js'(exports2, module2) {
    'use strict';
    module2.exports = EvalError;
  },
});

// node_modules/es-errors/range.js
var require_range = __commonJS({
  'node_modules/es-errors/range.js'(exports2, module2) {
    'use strict';
    module2.exports = RangeError;
  },
});

// node_modules/es-errors/ref.js
var require_ref = __commonJS({
  'node_modules/es-errors/ref.js'(exports2, module2) {
    'use strict';
    module2.exports = ReferenceError;
  },
});

// node_modules/es-errors/syntax.js
var require_syntax = __commonJS({
  'node_modules/es-errors/syntax.js'(exports2, module2) {
    'use strict';
    module2.exports = SyntaxError;
  },
});

// node_modules/es-errors/type.js
var require_type = __commonJS({
  'node_modules/es-errors/type.js'(exports2, module2) {
    'use strict';
    module2.exports = TypeError;
  },
});

// node_modules/es-errors/uri.js
var require_uri = __commonJS({
  'node_modules/es-errors/uri.js'(exports2, module2) {
    'use strict';
    module2.exports = URIError;
  },
});

// node_modules/math-intrinsics/abs.js
var require_abs = __commonJS({
  'node_modules/math-intrinsics/abs.js'(exports2, module2) {
    'use strict';
    module2.exports = Math.abs;
  },
});

// node_modules/math-intrinsics/floor.js
var require_floor = __commonJS({
  'node_modules/math-intrinsics/floor.js'(exports2, module2) {
    'use strict';
    module2.exports = Math.floor;
  },
});

// node_modules/math-intrinsics/max.js
var require_max = __commonJS({
  'node_modules/math-intrinsics/max.js'(exports2, module2) {
    'use strict';
    module2.exports = Math.max;
  },
});

// node_modules/math-intrinsics/min.js
var require_min = __commonJS({
  'node_modules/math-intrinsics/min.js'(exports2, module2) {
    'use strict';
    module2.exports = Math.min;
  },
});

// node_modules/math-intrinsics/pow.js
var require_pow = __commonJS({
  'node_modules/math-intrinsics/pow.js'(exports2, module2) {
    'use strict';
    module2.exports = Math.pow;
  },
});

// node_modules/math-intrinsics/round.js
var require_round = __commonJS({
  'node_modules/math-intrinsics/round.js'(exports2, module2) {
    'use strict';
    module2.exports = Math.round;
  },
});

// node_modules/math-intrinsics/isNaN.js
var require_isNaN = __commonJS({
  'node_modules/math-intrinsics/isNaN.js'(exports2, module2) {
    'use strict';
    module2.exports =
      Number.isNaN ||
      function isNaN2(a) {
        return a !== a;
      };
  },
});

// node_modules/math-intrinsics/sign.js
var require_sign = __commonJS({
  'node_modules/math-intrinsics/sign.js'(exports2, module2) {
    'use strict';
    var $isNaN = require_isNaN();
    module2.exports = function sign(number) {
      if ($isNaN(number) || number === 0) {
        return number;
      }
      return number < 0 ? -1 : 1;
    };
  },
});

// node_modules/gopd/gOPD.js
var require_gOPD = __commonJS({
  'node_modules/gopd/gOPD.js'(exports2, module2) {
    'use strict';
    module2.exports = Object.getOwnPropertyDescriptor;
  },
});

// node_modules/gopd/index.js
var require_gopd = __commonJS({
  'node_modules/gopd/index.js'(exports2, module2) {
    'use strict';
    var $gOPD = require_gOPD();
    if ($gOPD) {
      try {
        $gOPD([], 'length');
      } catch (e) {
        $gOPD = null;
      }
    }
    module2.exports = $gOPD;
  },
});

// node_modules/es-define-property/index.js
var require_es_define_property = __commonJS({
  'node_modules/es-define-property/index.js'(exports2, module2) {
    'use strict';
    var $defineProperty = Object.defineProperty || false;
    if ($defineProperty) {
      try {
        $defineProperty({}, 'a', { value: 1 });
      } catch (e) {
        $defineProperty = false;
      }
    }
    module2.exports = $defineProperty;
  },
});

// node_modules/has-symbols/shams.js
var require_shams = __commonJS({
  'node_modules/has-symbols/shams.js'(exports2, module2) {
    'use strict';
    module2.exports = function hasSymbols() {
      if (typeof Symbol !== 'function' || typeof Object.getOwnPropertySymbols !== 'function') {
        return false;
      }
      if (typeof Symbol.iterator === 'symbol') {
        return true;
      }
      var obj = {};
      var sym = /* @__PURE__ */ Symbol('test');
      var symObj = Object(sym);
      if (typeof sym === 'string') {
        return false;
      }
      if (Object.prototype.toString.call(sym) !== '[object Symbol]') {
        return false;
      }
      if (Object.prototype.toString.call(symObj) !== '[object Symbol]') {
        return false;
      }
      var symVal = 42;
      obj[sym] = symVal;
      for (var _ in obj) {
        return false;
      }
      if (typeof Object.keys === 'function' && Object.keys(obj).length !== 0) {
        return false;
      }
      if (
        typeof Object.getOwnPropertyNames === 'function' &&
        Object.getOwnPropertyNames(obj).length !== 0
      ) {
        return false;
      }
      var syms = Object.getOwnPropertySymbols(obj);
      if (syms.length !== 1 || syms[0] !== sym) {
        return false;
      }
      if (!Object.prototype.propertyIsEnumerable.call(obj, sym)) {
        return false;
      }
      if (typeof Object.getOwnPropertyDescriptor === 'function') {
        var descriptor =
          /** @type {PropertyDescriptor} */
          Object.getOwnPropertyDescriptor(obj, sym);
        if (descriptor.value !== symVal || descriptor.enumerable !== true) {
          return false;
        }
      }
      return true;
    };
  },
});

// node_modules/has-symbols/index.js
var require_has_symbols = __commonJS({
  'node_modules/has-symbols/index.js'(exports2, module2) {
    'use strict';
    var origSymbol = typeof Symbol !== 'undefined' && Symbol;
    var hasSymbolSham = require_shams();
    module2.exports = function hasNativeSymbols() {
      if (typeof origSymbol !== 'function') {
        return false;
      }
      if (typeof Symbol !== 'function') {
        return false;
      }
      if (typeof origSymbol('foo') !== 'symbol') {
        return false;
      }
      if (typeof (/* @__PURE__ */ Symbol('bar')) !== 'symbol') {
        return false;
      }
      return hasSymbolSham();
    };
  },
});

// node_modules/get-proto/Reflect.getPrototypeOf.js
var require_Reflect_getPrototypeOf = __commonJS({
  'node_modules/get-proto/Reflect.getPrototypeOf.js'(exports2, module2) {
    'use strict';
    module2.exports = (typeof Reflect !== 'undefined' && Reflect.getPrototypeOf) || null;
  },
});

// node_modules/get-proto/Object.getPrototypeOf.js
var require_Object_getPrototypeOf = __commonJS({
  'node_modules/get-proto/Object.getPrototypeOf.js'(exports2, module2) {
    'use strict';
    var $Object = require_es_object_atoms();
    module2.exports = $Object.getPrototypeOf || null;
  },
});

// node_modules/function-bind/implementation.js
var require_implementation = __commonJS({
  'node_modules/function-bind/implementation.js'(exports2, module2) {
    'use strict';
    var ERROR_MESSAGE = 'Function.prototype.bind called on incompatible ';
    var toStr = Object.prototype.toString;
    var max = Math.max;
    var funcType = '[object Function]';
    var concatty = function concatty2(a, b) {
      var arr = [];
      for (var i = 0; i < a.length; i += 1) {
        arr[i] = a[i];
      }
      for (var j = 0; j < b.length; j += 1) {
        arr[j + a.length] = b[j];
      }
      return arr;
    };
    var slicy = function slicy2(arrLike, offset) {
      var arr = [];
      for (var i = offset || 0, j = 0; i < arrLike.length; i += 1, j += 1) {
        arr[j] = arrLike[i];
      }
      return arr;
    };
    var joiny = function (arr, joiner) {
      var str = '';
      for (var i = 0; i < arr.length; i += 1) {
        str += arr[i];
        if (i + 1 < arr.length) {
          str += joiner;
        }
      }
      return str;
    };
    module2.exports = function bind(that) {
      var target = this;
      if (typeof target !== 'function' || toStr.apply(target) !== funcType) {
        throw new TypeError(ERROR_MESSAGE + target);
      }
      var args = slicy(arguments, 1);
      var bound;
      var binder = function () {
        if (this instanceof bound) {
          var result = target.apply(this, concatty(args, arguments));
          if (Object(result) === result) {
            return result;
          }
          return this;
        }
        return target.apply(that, concatty(args, arguments));
      };
      var boundLength = max(0, target.length - args.length);
      var boundArgs = [];
      for (var i = 0; i < boundLength; i++) {
        boundArgs[i] = '$' + i;
      }
      bound = Function(
        'binder',
        'return function (' + joiny(boundArgs, ',') + '){ return binder.apply(this,arguments); }'
      )(binder);
      if (target.prototype) {
        var Empty = function Empty2() {};
        Empty.prototype = target.prototype;
        bound.prototype = new Empty();
        Empty.prototype = null;
      }
      return bound;
    };
  },
});

// node_modules/function-bind/index.js
var require_function_bind = __commonJS({
  'node_modules/function-bind/index.js'(exports2, module2) {
    'use strict';
    var implementation = require_implementation();
    module2.exports = Function.prototype.bind || implementation;
  },
});

// node_modules/call-bind-apply-helpers/functionCall.js
var require_functionCall = __commonJS({
  'node_modules/call-bind-apply-helpers/functionCall.js'(exports2, module2) {
    'use strict';
    module2.exports = Function.prototype.call;
  },
});

// node_modules/call-bind-apply-helpers/functionApply.js
var require_functionApply = __commonJS({
  'node_modules/call-bind-apply-helpers/functionApply.js'(exports2, module2) {
    'use strict';
    module2.exports = Function.prototype.apply;
  },
});

// node_modules/call-bind-apply-helpers/reflectApply.js
var require_reflectApply = __commonJS({
  'node_modules/call-bind-apply-helpers/reflectApply.js'(exports2, module2) {
    'use strict';
    module2.exports = typeof Reflect !== 'undefined' && Reflect && Reflect.apply;
  },
});

// node_modules/call-bind-apply-helpers/actualApply.js
var require_actualApply = __commonJS({
  'node_modules/call-bind-apply-helpers/actualApply.js'(exports2, module2) {
    'use strict';
    var bind = require_function_bind();
    var $apply = require_functionApply();
    var $call = require_functionCall();
    var $reflectApply = require_reflectApply();
    module2.exports = $reflectApply || bind.call($call, $apply);
  },
});

// node_modules/call-bind-apply-helpers/index.js
var require_call_bind_apply_helpers = __commonJS({
  'node_modules/call-bind-apply-helpers/index.js'(exports2, module2) {
    'use strict';
    var bind = require_function_bind();
    var $TypeError = require_type();
    var $call = require_functionCall();
    var $actualApply = require_actualApply();
    module2.exports = function callBindBasic(args) {
      if (args.length < 1 || typeof args[0] !== 'function') {
        throw new $TypeError('a function is required');
      }
      return $actualApply(bind, $call, args);
    };
  },
});

// node_modules/dunder-proto/get.js
var require_get = __commonJS({
  'node_modules/dunder-proto/get.js'(exports2, module2) {
    'use strict';
    var callBind = require_call_bind_apply_helpers();
    var gOPD = require_gopd();
    var hasProtoAccessor;
    try {
      hasProtoAccessor =
        /** @type {{ __proto__?: typeof Array.prototype }} */
        [].__proto__ === Array.prototype;
    } catch (e) {
      if (!e || typeof e !== 'object' || !('code' in e) || e.code !== 'ERR_PROTO_ACCESS') {
        throw e;
      }
    }
    var desc =
      !!hasProtoAccessor &&
      gOPD &&
      gOPD(
        Object.prototype,
        /** @type {keyof typeof Object.prototype} */
        '__proto__'
      );
    var $Object = Object;
    var $getPrototypeOf = $Object.getPrototypeOf;
    module2.exports =
      desc && typeof desc.get === 'function'
        ? callBind([desc.get])
        : typeof $getPrototypeOf === 'function'
          ? /** @type {import('./get')} */
            function getDunder(value) {
              return $getPrototypeOf(value == null ? value : $Object(value));
            }
          : false;
  },
});

// node_modules/get-proto/index.js
var require_get_proto = __commonJS({
  'node_modules/get-proto/index.js'(exports2, module2) {
    'use strict';
    var reflectGetProto = require_Reflect_getPrototypeOf();
    var originalGetProto = require_Object_getPrototypeOf();
    var getDunderProto = require_get();
    module2.exports = reflectGetProto
      ? function getProto(O) {
          return reflectGetProto(O);
        }
      : originalGetProto
        ? function getProto(O) {
            if (!O || (typeof O !== 'object' && typeof O !== 'function')) {
              throw new TypeError('getProto: not an object');
            }
            return originalGetProto(O);
          }
        : getDunderProto
          ? function getProto(O) {
              return getDunderProto(O);
            }
          : null;
  },
});

// node_modules/hasown/index.js
var require_hasown = __commonJS({
  'node_modules/hasown/index.js'(exports2, module2) {
    'use strict';
    var call = Function.prototype.call;
    var $hasOwn = Object.prototype.hasOwnProperty;
    var bind = require_function_bind();
    module2.exports = bind.call(call, $hasOwn);
  },
});

// node_modules/get-intrinsic/index.js
var require_get_intrinsic = __commonJS({
  'node_modules/get-intrinsic/index.js'(exports2, module2) {
    'use strict';
    var undefined2;
    var $Object = require_es_object_atoms();
    var $Error = require_es_errors();
    var $EvalError = require_eval();
    var $RangeError = require_range();
    var $ReferenceError = require_ref();
    var $SyntaxError = require_syntax();
    var $TypeError = require_type();
    var $URIError = require_uri();
    var abs = require_abs();
    var floor = require_floor();
    var max = require_max();
    var min = require_min();
    var pow = require_pow();
    var round = require_round();
    var sign = require_sign();
    var $Function = Function;
    var getEvalledConstructor = function (expressionSyntax) {
      try {
        return $Function('"use strict"; return (' + expressionSyntax + ').constructor;')();
      } catch (e) {}
    };
    var $gOPD = require_gopd();
    var $defineProperty = require_es_define_property();
    var throwTypeError = function () {
      throw new $TypeError();
    };
    var ThrowTypeError = $gOPD
      ? (function () {
          try {
            arguments.callee;
            return throwTypeError;
          } catch (calleeThrows) {
            try {
              return $gOPD(arguments, 'callee').get;
            } catch (gOPDthrows) {
              return throwTypeError;
            }
          }
        })()
      : throwTypeError;
    var hasSymbols = require_has_symbols()();
    var getProto = require_get_proto();
    var $ObjectGPO = require_Object_getPrototypeOf();
    var $ReflectGPO = require_Reflect_getPrototypeOf();
    var $apply = require_functionApply();
    var $call = require_functionCall();
    var needsEval = {};
    var TypedArray =
      typeof Uint8Array === 'undefined' || !getProto ? undefined2 : getProto(Uint8Array);
    var INTRINSICS = {
      __proto__: null,
      '%AggregateError%': typeof AggregateError === 'undefined' ? undefined2 : AggregateError,
      '%Array%': Array,
      '%ArrayBuffer%': typeof ArrayBuffer === 'undefined' ? undefined2 : ArrayBuffer,
      '%ArrayIteratorPrototype%':
        hasSymbols && getProto ? getProto([][Symbol.iterator]()) : undefined2,
      '%AsyncFromSyncIteratorPrototype%': undefined2,
      '%AsyncFunction%': needsEval,
      '%AsyncGenerator%': needsEval,
      '%AsyncGeneratorFunction%': needsEval,
      '%AsyncIteratorPrototype%': needsEval,
      '%Atomics%': typeof Atomics === 'undefined' ? undefined2 : Atomics,
      '%BigInt%': typeof BigInt === 'undefined' ? undefined2 : BigInt,
      '%BigInt64Array%': typeof BigInt64Array === 'undefined' ? undefined2 : BigInt64Array,
      '%BigUint64Array%': typeof BigUint64Array === 'undefined' ? undefined2 : BigUint64Array,
      '%Boolean%': Boolean,
      '%DataView%': typeof DataView === 'undefined' ? undefined2 : DataView,
      '%Date%': Date,
      '%decodeURI%': decodeURI,
      '%decodeURIComponent%': decodeURIComponent,
      '%encodeURI%': encodeURI,
      '%encodeURIComponent%': encodeURIComponent,
      '%Error%': $Error,
      '%eval%': eval,
      // eslint-disable-line no-eval
      '%EvalError%': $EvalError,
      '%Float16Array%': typeof Float16Array === 'undefined' ? undefined2 : Float16Array,
      '%Float32Array%': typeof Float32Array === 'undefined' ? undefined2 : Float32Array,
      '%Float64Array%': typeof Float64Array === 'undefined' ? undefined2 : Float64Array,
      '%FinalizationRegistry%':
        typeof FinalizationRegistry === 'undefined' ? undefined2 : FinalizationRegistry,
      '%Function%': $Function,
      '%GeneratorFunction%': needsEval,
      '%Int8Array%': typeof Int8Array === 'undefined' ? undefined2 : Int8Array,
      '%Int16Array%': typeof Int16Array === 'undefined' ? undefined2 : Int16Array,
      '%Int32Array%': typeof Int32Array === 'undefined' ? undefined2 : Int32Array,
      '%isFinite%': isFinite,
      '%isNaN%': isNaN,
      '%IteratorPrototype%':
        hasSymbols && getProto ? getProto(getProto([][Symbol.iterator]())) : undefined2,
      '%JSON%': typeof JSON === 'object' ? JSON : undefined2,
      '%Map%': typeof Map === 'undefined' ? undefined2 : Map,
      '%MapIteratorPrototype%':
        typeof Map === 'undefined' || !hasSymbols || !getProto
          ? undefined2
          : getProto(/* @__PURE__ */ new Map()[Symbol.iterator]()),
      '%Math%': Math,
      '%Number%': Number,
      '%Object%': $Object,
      '%Object.getOwnPropertyDescriptor%': $gOPD,
      '%parseFloat%': parseFloat,
      '%parseInt%': parseInt,
      '%Promise%': typeof Promise === 'undefined' ? undefined2 : Promise,
      '%Proxy%': typeof Proxy === 'undefined' ? undefined2 : Proxy,
      '%RangeError%': $RangeError,
      '%ReferenceError%': $ReferenceError,
      '%Reflect%': typeof Reflect === 'undefined' ? undefined2 : Reflect,
      '%RegExp%': RegExp,
      '%Set%': typeof Set === 'undefined' ? undefined2 : Set,
      '%SetIteratorPrototype%':
        typeof Set === 'undefined' || !hasSymbols || !getProto
          ? undefined2
          : getProto(/* @__PURE__ */ new Set()[Symbol.iterator]()),
      '%SharedArrayBuffer%':
        typeof SharedArrayBuffer === 'undefined' ? undefined2 : SharedArrayBuffer,
      '%String%': String,
      '%StringIteratorPrototype%':
        hasSymbols && getProto ? getProto(''[Symbol.iterator]()) : undefined2,
      '%Symbol%': hasSymbols ? Symbol : undefined2,
      '%SyntaxError%': $SyntaxError,
      '%ThrowTypeError%': ThrowTypeError,
      '%TypedArray%': TypedArray,
      '%TypeError%': $TypeError,
      '%Uint8Array%': typeof Uint8Array === 'undefined' ? undefined2 : Uint8Array,
      '%Uint8ClampedArray%':
        typeof Uint8ClampedArray === 'undefined' ? undefined2 : Uint8ClampedArray,
      '%Uint16Array%': typeof Uint16Array === 'undefined' ? undefined2 : Uint16Array,
      '%Uint32Array%': typeof Uint32Array === 'undefined' ? undefined2 : Uint32Array,
      '%URIError%': $URIError,
      '%WeakMap%': typeof WeakMap === 'undefined' ? undefined2 : WeakMap,
      '%WeakRef%': typeof WeakRef === 'undefined' ? undefined2 : WeakRef,
      '%WeakSet%': typeof WeakSet === 'undefined' ? undefined2 : WeakSet,
      '%Function.prototype.call%': $call,
      '%Function.prototype.apply%': $apply,
      '%Object.defineProperty%': $defineProperty,
      '%Object.getPrototypeOf%': $ObjectGPO,
      '%Math.abs%': abs,
      '%Math.floor%': floor,
      '%Math.max%': max,
      '%Math.min%': min,
      '%Math.pow%': pow,
      '%Math.round%': round,
      '%Math.sign%': sign,
      '%Reflect.getPrototypeOf%': $ReflectGPO,
    };
    if (getProto) {
      try {
        null.error;
      } catch (e) {
        errorProto = getProto(getProto(e));
        INTRINSICS['%Error.prototype%'] = errorProto;
      }
    }
    var errorProto;
    var doEval = function doEval2(name) {
      var value;
      if (name === '%AsyncFunction%') {
        value = getEvalledConstructor('async function () {}');
      } else if (name === '%GeneratorFunction%') {
        value = getEvalledConstructor('function* () {}');
      } else if (name === '%AsyncGeneratorFunction%') {
        value = getEvalledConstructor('async function* () {}');
      } else if (name === '%AsyncGenerator%') {
        var fn = doEval2('%AsyncGeneratorFunction%');
        if (fn) {
          value = fn.prototype;
        }
      } else if (name === '%AsyncIteratorPrototype%') {
        var gen = doEval2('%AsyncGenerator%');
        if (gen && getProto) {
          value = getProto(gen.prototype);
        }
      }
      INTRINSICS[name] = value;
      return value;
    };
    var LEGACY_ALIASES = {
      __proto__: null,
      '%ArrayBufferPrototype%': ['ArrayBuffer', 'prototype'],
      '%ArrayPrototype%': ['Array', 'prototype'],
      '%ArrayProto_entries%': ['Array', 'prototype', 'entries'],
      '%ArrayProto_forEach%': ['Array', 'prototype', 'forEach'],
      '%ArrayProto_keys%': ['Array', 'prototype', 'keys'],
      '%ArrayProto_values%': ['Array', 'prototype', 'values'],
      '%AsyncFunctionPrototype%': ['AsyncFunction', 'prototype'],
      '%AsyncGenerator%': ['AsyncGeneratorFunction', 'prototype'],
      '%AsyncGeneratorPrototype%': ['AsyncGeneratorFunction', 'prototype', 'prototype'],
      '%BooleanPrototype%': ['Boolean', 'prototype'],
      '%DataViewPrototype%': ['DataView', 'prototype'],
      '%DatePrototype%': ['Date', 'prototype'],
      '%ErrorPrototype%': ['Error', 'prototype'],
      '%EvalErrorPrototype%': ['EvalError', 'prototype'],
      '%Float32ArrayPrototype%': ['Float32Array', 'prototype'],
      '%Float64ArrayPrototype%': ['Float64Array', 'prototype'],
      '%FunctionPrototype%': ['Function', 'prototype'],
      '%Generator%': ['GeneratorFunction', 'prototype'],
      '%GeneratorPrototype%': ['GeneratorFunction', 'prototype', 'prototype'],
      '%Int8ArrayPrototype%': ['Int8Array', 'prototype'],
      '%Int16ArrayPrototype%': ['Int16Array', 'prototype'],
      '%Int32ArrayPrototype%': ['Int32Array', 'prototype'],
      '%JSONParse%': ['JSON', 'parse'],
      '%JSONStringify%': ['JSON', 'stringify'],
      '%MapPrototype%': ['Map', 'prototype'],
      '%NumberPrototype%': ['Number', 'prototype'],
      '%ObjectPrototype%': ['Object', 'prototype'],
      '%ObjProto_toString%': ['Object', 'prototype', 'toString'],
      '%ObjProto_valueOf%': ['Object', 'prototype', 'valueOf'],
      '%PromisePrototype%': ['Promise', 'prototype'],
      '%PromiseProto_then%': ['Promise', 'prototype', 'then'],
      '%Promise_all%': ['Promise', 'all'],
      '%Promise_reject%': ['Promise', 'reject'],
      '%Promise_resolve%': ['Promise', 'resolve'],
      '%RangeErrorPrototype%': ['RangeError', 'prototype'],
      '%ReferenceErrorPrototype%': ['ReferenceError', 'prototype'],
      '%RegExpPrototype%': ['RegExp', 'prototype'],
      '%SetPrototype%': ['Set', 'prototype'],
      '%SharedArrayBufferPrototype%': ['SharedArrayBuffer', 'prototype'],
      '%StringPrototype%': ['String', 'prototype'],
      '%SymbolPrototype%': ['Symbol', 'prototype'],
      '%SyntaxErrorPrototype%': ['SyntaxError', 'prototype'],
      '%TypedArrayPrototype%': ['TypedArray', 'prototype'],
      '%TypeErrorPrototype%': ['TypeError', 'prototype'],
      '%Uint8ArrayPrototype%': ['Uint8Array', 'prototype'],
      '%Uint8ClampedArrayPrototype%': ['Uint8ClampedArray', 'prototype'],
      '%Uint16ArrayPrototype%': ['Uint16Array', 'prototype'],
      '%Uint32ArrayPrototype%': ['Uint32Array', 'prototype'],
      '%URIErrorPrototype%': ['URIError', 'prototype'],
      '%WeakMapPrototype%': ['WeakMap', 'prototype'],
      '%WeakSetPrototype%': ['WeakSet', 'prototype'],
    };
    var bind = require_function_bind();
    var hasOwn = require_hasown();
    var $concat = bind.call($call, Array.prototype.concat);
    var $spliceApply = bind.call($apply, Array.prototype.splice);
    var $replace = bind.call($call, String.prototype.replace);
    var $strSlice = bind.call($call, String.prototype.slice);
    var $exec = bind.call($call, RegExp.prototype.exec);
    var rePropName =
      /[^%.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|%$))/g;
    var reEscapeChar = /\\(\\)?/g;
    var stringToPath = function stringToPath2(string) {
      var first = $strSlice(string, 0, 1);
      var last = $strSlice(string, -1);
      if (first === '%' && last !== '%') {
        throw new $SyntaxError('invalid intrinsic syntax, expected closing `%`');
      } else if (last === '%' && first !== '%') {
        throw new $SyntaxError('invalid intrinsic syntax, expected opening `%`');
      }
      var result = [];
      $replace(string, rePropName, function (match, number, quote, subString) {
        result[result.length] = quote ? $replace(subString, reEscapeChar, '$1') : number || match;
      });
      return result;
    };
    var getBaseIntrinsic = function getBaseIntrinsic2(name, allowMissing) {
      var intrinsicName = name;
      var alias;
      if (hasOwn(LEGACY_ALIASES, intrinsicName)) {
        alias = LEGACY_ALIASES[intrinsicName];
        intrinsicName = '%' + alias[0] + '%';
      }
      if (hasOwn(INTRINSICS, intrinsicName)) {
        var value = INTRINSICS[intrinsicName];
        if (value === needsEval) {
          value = doEval(intrinsicName);
        }
        if (typeof value === 'undefined' && !allowMissing) {
          throw new $TypeError(
            'intrinsic ' + name + ' exists, but is not available. Please file an issue!'
          );
        }
        return {
          alias,
          name: intrinsicName,
          value,
        };
      }
      throw new $SyntaxError('intrinsic ' + name + ' does not exist!');
    };
    module2.exports = function GetIntrinsic(name, allowMissing) {
      if (typeof name !== 'string' || name.length === 0) {
        throw new $TypeError('intrinsic name must be a non-empty string');
      }
      if (arguments.length > 1 && typeof allowMissing !== 'boolean') {
        throw new $TypeError('"allowMissing" argument must be a boolean');
      }
      if ($exec(/^%?[^%]*%?$/, name) === null) {
        throw new $SyntaxError(
          '`%` may not be present anywhere but at the beginning and end of the intrinsic name'
        );
      }
      var parts = stringToPath(name);
      var intrinsicBaseName = parts.length > 0 ? parts[0] : '';
      var intrinsic = getBaseIntrinsic('%' + intrinsicBaseName + '%', allowMissing);
      var intrinsicRealName = intrinsic.name;
      var value = intrinsic.value;
      var skipFurtherCaching = false;
      var alias = intrinsic.alias;
      if (alias) {
        intrinsicBaseName = alias[0];
        $spliceApply(parts, $concat([0, 1], alias));
      }
      for (var i = 1, isOwn = true; i < parts.length; i += 1) {
        var part = parts[i];
        var first = $strSlice(part, 0, 1);
        var last = $strSlice(part, -1);
        if (
          (first === '"' ||
            first === "'" ||
            first === '`' ||
            last === '"' ||
            last === "'" ||
            last === '`') &&
          first !== last
        ) {
          throw new $SyntaxError('property names with quotes must have matching quotes');
        }
        if (part === 'constructor' || !isOwn) {
          skipFurtherCaching = true;
        }
        intrinsicBaseName += '.' + part;
        intrinsicRealName = '%' + intrinsicBaseName + '%';
        if (hasOwn(INTRINSICS, intrinsicRealName)) {
          value = INTRINSICS[intrinsicRealName];
        } else if (value != null) {
          if (!(part in value)) {
            if (!allowMissing) {
              throw new $TypeError(
                'base intrinsic for ' + name + ' exists, but the property is not available.'
              );
            }
            return void undefined2;
          }
          if ($gOPD && i + 1 >= parts.length) {
            var desc = $gOPD(value, part);
            isOwn = !!desc;
            if (isOwn && 'get' in desc && !('originalValue' in desc.get)) {
              value = desc.get;
            } else {
              value = value[part];
            }
          } else {
            isOwn = hasOwn(value, part);
            value = value[part];
          }
          if (isOwn && !skipFurtherCaching) {
            INTRINSICS[intrinsicRealName] = value;
          }
        }
      }
      return value;
    };
  },
});

// node_modules/has-tostringtag/shams.js
var require_shams2 = __commonJS({
  'node_modules/has-tostringtag/shams.js'(exports2, module2) {
    'use strict';
    var hasSymbols = require_shams();
    module2.exports = function hasToStringTagShams() {
      return hasSymbols() && !!Symbol.toStringTag;
    };
  },
});

// node_modules/es-set-tostringtag/index.js
var require_es_set_tostringtag = __commonJS({
  'node_modules/es-set-tostringtag/index.js'(exports2, module2) {
    'use strict';
    var GetIntrinsic = require_get_intrinsic();
    var $defineProperty = GetIntrinsic('%Object.defineProperty%', true);
    var hasToStringTag = require_shams2()();
    var hasOwn = require_hasown();
    var $TypeError = require_type();
    var toStringTag = hasToStringTag ? Symbol.toStringTag : null;
    module2.exports = function setToStringTag(object, value) {
      var overrideIfSet = arguments.length > 2 && !!arguments[2] && arguments[2].force;
      var nonConfigurable = arguments.length > 2 && !!arguments[2] && arguments[2].nonConfigurable;
      if (
        (typeof overrideIfSet !== 'undefined' && typeof overrideIfSet !== 'boolean') ||
        (typeof nonConfigurable !== 'undefined' && typeof nonConfigurable !== 'boolean')
      ) {
        throw new $TypeError(
          'if provided, the `overrideIfSet` and `nonConfigurable` options must be booleans'
        );
      }
      if (toStringTag && (overrideIfSet || !hasOwn(object, toStringTag))) {
        if ($defineProperty) {
          $defineProperty(object, toStringTag, {
            configurable: !nonConfigurable,
            enumerable: false,
            value,
            writable: false,
          });
        } else {
          object[toStringTag] = value;
        }
      }
    };
  },
});

// node_modules/form-data/lib/populate.js
var require_populate = __commonJS({
  'node_modules/form-data/lib/populate.js'(exports2, module2) {
    'use strict';
    module2.exports = function (dst, src) {
      Object.keys(src).forEach(function (prop) {
        dst[prop] = dst[prop] || src[prop];
      });
      return dst;
    };
  },
});

// node_modules/form-data/lib/form_data.js
var require_form_data = __commonJS({
  'node_modules/form-data/lib/form_data.js'(exports2, module2) {
    'use strict';
    var CombinedStream = require_combined_stream();
    var util = require('util');
    var path = require('path');
    var http = require('http');
    var https = require('https');
    var parseUrl = require('url').parse;
    var fs = require('fs');
    var Stream = require('stream').Stream;
    var crypto = require('crypto');
    var mime = require_mime_types();
    var asynckit = require_asynckit();
    var setToStringTag = require_es_set_tostringtag();
    var hasOwn = require_hasown();
    var populate = require_populate();
    function FormData2(options) {
      if (!(this instanceof FormData2)) {
        return new FormData2(options);
      }
      this._overheadLength = 0;
      this._valueLength = 0;
      this._valuesToMeasure = [];
      CombinedStream.call(this);
      options = options || {};
      for (var option in options) {
        this[option] = options[option];
      }
    }
    util.inherits(FormData2, CombinedStream);
    FormData2.LINE_BREAK = '\r\n';
    FormData2.DEFAULT_CONTENT_TYPE = 'application/octet-stream';
    FormData2.prototype.append = function (field, value, options) {
      options = options || {};
      if (typeof options === 'string') {
        options = { filename: options };
      }
      var append = CombinedStream.prototype.append.bind(this);
      if (typeof value === 'number' || value == null) {
        value = String(value);
      }
      if (Array.isArray(value)) {
        this._error(new Error('Arrays are not supported.'));
        return;
      }
      var header = this._multiPartHeader(field, value, options);
      var footer = this._multiPartFooter();
      append(header);
      append(value);
      append(footer);
      this._trackLength(header, value, options);
    };
    FormData2.prototype._trackLength = function (header, value, options) {
      var valueLength = 0;
      if (options.knownLength != null) {
        valueLength += Number(options.knownLength);
      } else if (Buffer.isBuffer(value)) {
        valueLength = value.length;
      } else if (typeof value === 'string') {
        valueLength = Buffer.byteLength(value);
      }
      this._valueLength += valueLength;
      this._overheadLength += Buffer.byteLength(header) + FormData2.LINE_BREAK.length;
      if (
        !value ||
        (!value.path &&
          !(value.readable && hasOwn(value, 'httpVersion')) &&
          !(value instanceof Stream))
      ) {
        return;
      }
      if (!options.knownLength) {
        this._valuesToMeasure.push(value);
      }
    };
    FormData2.prototype._lengthRetriever = function (value, callback) {
      if (hasOwn(value, 'fd')) {
        if (value.end != void 0 && value.end != Infinity && value.start != void 0) {
          callback(null, value.end + 1 - (value.start ? value.start : 0));
        } else {
          fs.stat(value.path, function (err, stat) {
            if (err) {
              callback(err);
              return;
            }
            var fileSize = stat.size - (value.start ? value.start : 0);
            callback(null, fileSize);
          });
        }
      } else if (hasOwn(value, 'httpVersion')) {
        callback(null, Number(value.headers['content-length']));
      } else if (hasOwn(value, 'httpModule')) {
        value.on('response', function (response) {
          value.pause();
          callback(null, Number(response.headers['content-length']));
        });
        value.resume();
      } else {
        callback('Unknown stream');
      }
    };
    FormData2.prototype._multiPartHeader = function (field, value, options) {
      if (typeof options.header === 'string') {
        return options.header;
      }
      var contentDisposition = this._getContentDisposition(value, options);
      var contentType = this._getContentType(value, options);
      var contents = '';
      var headers = {
        // add custom disposition as third element or keep it two elements if not
        'Content-Disposition': ['form-data', 'name="' + field + '"'].concat(
          contentDisposition || []
        ),
        // if no content type. allow it to be empty array
        'Content-Type': [].concat(contentType || []),
      };
      if (typeof options.header === 'object') {
        populate(headers, options.header);
      }
      var header;
      for (var prop in headers) {
        if (hasOwn(headers, prop)) {
          header = headers[prop];
          if (header == null) {
            continue;
          }
          if (!Array.isArray(header)) {
            header = [header];
          }
          if (header.length) {
            contents += prop + ': ' + header.join('; ') + FormData2.LINE_BREAK;
          }
        }
      }
      return '--' + this.getBoundary() + FormData2.LINE_BREAK + contents + FormData2.LINE_BREAK;
    };
    FormData2.prototype._getContentDisposition = function (value, options) {
      var filename;
      if (typeof options.filepath === 'string') {
        filename = path.normalize(options.filepath).replace(/\\/g, '/');
      } else if (options.filename || (value && (value.name || value.path))) {
        filename = path.basename(options.filename || (value && (value.name || value.path)));
      } else if (value && value.readable && hasOwn(value, 'httpVersion')) {
        filename = path.basename(value.client._httpMessage.path || '');
      }
      if (filename) {
        return 'filename="' + filename + '"';
      }
    };
    FormData2.prototype._getContentType = function (value, options) {
      var contentType = options.contentType;
      if (!contentType && value && value.name) {
        contentType = mime.lookup(value.name);
      }
      if (!contentType && value && value.path) {
        contentType = mime.lookup(value.path);
      }
      if (!contentType && value && value.readable && hasOwn(value, 'httpVersion')) {
        contentType = value.headers['content-type'];
      }
      if (!contentType && (options.filepath || options.filename)) {
        contentType = mime.lookup(options.filepath || options.filename);
      }
      if (!contentType && value && typeof value === 'object') {
        contentType = FormData2.DEFAULT_CONTENT_TYPE;
      }
      return contentType;
    };
    FormData2.prototype._multiPartFooter = function () {
      return function (next) {
        var footer = FormData2.LINE_BREAK;
        var lastPart = this._streams.length === 0;
        if (lastPart) {
          footer += this._lastBoundary();
        }
        next(footer);
      }.bind(this);
    };
    FormData2.prototype._lastBoundary = function () {
      return '--' + this.getBoundary() + '--' + FormData2.LINE_BREAK;
    };
    FormData2.prototype.getHeaders = function (userHeaders) {
      var header;
      var formHeaders = {
        'content-type': 'multipart/form-data; boundary=' + this.getBoundary(),
      };
      for (header in userHeaders) {
        if (hasOwn(userHeaders, header)) {
          formHeaders[header.toLowerCase()] = userHeaders[header];
        }
      }
      return formHeaders;
    };
    FormData2.prototype.setBoundary = function (boundary) {
      if (typeof boundary !== 'string') {
        throw new TypeError('FormData boundary must be a string');
      }
      this._boundary = boundary;
    };
    FormData2.prototype.getBoundary = function () {
      if (!this._boundary) {
        this._generateBoundary();
      }
      return this._boundary;
    };
    FormData2.prototype.getBuffer = function () {
      var dataBuffer = new Buffer.alloc(0);
      var boundary = this.getBoundary();
      for (var i = 0, len = this._streams.length; i < len; i++) {
        if (typeof this._streams[i] !== 'function') {
          if (Buffer.isBuffer(this._streams[i])) {
            dataBuffer = Buffer.concat([dataBuffer, this._streams[i]]);
          } else {
            dataBuffer = Buffer.concat([dataBuffer, Buffer.from(this._streams[i])]);
          }
          if (
            typeof this._streams[i] !== 'string' ||
            this._streams[i].substring(2, boundary.length + 2) !== boundary
          ) {
            dataBuffer = Buffer.concat([dataBuffer, Buffer.from(FormData2.LINE_BREAK)]);
          }
        }
      }
      return Buffer.concat([dataBuffer, Buffer.from(this._lastBoundary())]);
    };
    FormData2.prototype._generateBoundary = function () {
      this._boundary = '--------------------------' + crypto.randomBytes(12).toString('hex');
    };
    FormData2.prototype.getLengthSync = function () {
      var knownLength = this._overheadLength + this._valueLength;
      if (this._streams.length) {
        knownLength += this._lastBoundary().length;
      }
      if (!this.hasKnownLength()) {
        this._error(new Error('Cannot calculate proper length in synchronous way.'));
      }
      return knownLength;
    };
    FormData2.prototype.hasKnownLength = function () {
      var hasKnownLength = true;
      if (this._valuesToMeasure.length) {
        hasKnownLength = false;
      }
      return hasKnownLength;
    };
    FormData2.prototype.getLength = function (cb) {
      var knownLength = this._overheadLength + this._valueLength;
      if (this._streams.length) {
        knownLength += this._lastBoundary().length;
      }
      if (!this._valuesToMeasure.length) {
        process.nextTick(cb.bind(this, null, knownLength));
        return;
      }
      asynckit.parallel(this._valuesToMeasure, this._lengthRetriever, function (err, values) {
        if (err) {
          cb(err);
          return;
        }
        values.forEach(function (length) {
          knownLength += length;
        });
        cb(null, knownLength);
      });
    };
    FormData2.prototype.submit = function (params, cb) {
      var request;
      var options;
      var defaults = { method: 'post' };
      if (typeof params === 'string') {
        params = parseUrl(params);
        options = populate(
          {
            port: params.port,
            path: params.pathname,
            host: params.hostname,
            protocol: params.protocol,
          },
          defaults
        );
      } else {
        options = populate(params, defaults);
        if (!options.port) {
          options.port = options.protocol === 'https:' ? 443 : 80;
        }
      }
      options.headers = this.getHeaders(params.headers);
      if (options.protocol === 'https:') {
        request = https.request(options);
      } else {
        request = http.request(options);
      }
      this.getLength(
        function (err, length) {
          if (err && err !== 'Unknown stream') {
            this._error(err);
            return;
          }
          if (length) {
            request.setHeader('Content-Length', length);
          }
          this.pipe(request);
          if (cb) {
            var onResponse;
            var callback = function (error, responce) {
              request.removeListener('error', callback);
              request.removeListener('response', onResponse);
              return cb.call(this, error, responce);
            };
            onResponse = callback.bind(this, null);
            request.on('error', callback);
            request.on('response', onResponse);
          }
        }.bind(this)
      );
      return request;
    };
    FormData2.prototype._error = function (err) {
      if (!this.error) {
        this.error = err;
        this.pause();
        this.emit('error', err);
      }
    };
    FormData2.prototype.toString = function () {
      return '[object FormData]';
    };
    setToStringTag(FormData2.prototype, 'FormData');
    module2.exports = FormData2;
  },
});

// node_modules/axios/lib/env/classes/FormData.js
var require_FormData = __commonJS({
  'node_modules/axios/lib/env/classes/FormData.js'(exports2, module2) {
    module2.exports = require_form_data();
  },
});

// node_modules/axios/lib/helpers/toFormData.js
var require_toFormData = __commonJS({
  'node_modules/axios/lib/helpers/toFormData.js'(exports2, module2) {
    'use strict';
    var utils = require_utils();
    var AxiosError = require_AxiosError();
    var envFormData = require_FormData();
    function isVisitable(thing) {
      return utils.isPlainObject(thing) || utils.isArray(thing);
    }
    function removeBrackets(key) {
      return utils.endsWith(key, '[]') ? key.slice(0, -2) : key;
    }
    function renderKey(path, key, dots) {
      if (!path) return key;
      return path
        .concat(key)
        .map(function each(token, i) {
          token = removeBrackets(token);
          return !dots && i ? '[' + token + ']' : token;
        })
        .join(dots ? '.' : '');
    }
    function isFlatArray(arr) {
      return utils.isArray(arr) && !arr.some(isVisitable);
    }
    var predicates = utils.toFlatObject(utils, {}, null, function filter(prop) {
      return /^is[A-Z]/.test(prop);
    });
    function isSpecCompliant(thing) {
      return (
        thing &&
        utils.isFunction(thing.append) &&
        thing[Symbol.toStringTag] === 'FormData' &&
        thing[Symbol.iterator]
      );
    }
    function toFormData(obj, formData, options) {
      if (!utils.isObject(obj)) {
        throw new TypeError('target must be an object');
      }
      formData = formData || new (envFormData || FormData)();
      options = utils.toFlatObject(
        options,
        {
          metaTokens: true,
          dots: false,
          indexes: false,
        },
        false,
        function defined(option, source) {
          return !utils.isUndefined(source[option]);
        }
      );
      var metaTokens = options.metaTokens;
      var visitor = options.visitor || defaultVisitor;
      var dots = options.dots;
      var indexes = options.indexes;
      var _Blob = options.Blob || (typeof Blob !== 'undefined' && Blob);
      var useBlob = _Blob && isSpecCompliant(formData);
      if (!utils.isFunction(visitor)) {
        throw new TypeError('visitor must be a function');
      }
      function convertValue(value) {
        if (value === null) return '';
        if (utils.isDate(value)) {
          return value.toISOString();
        }
        if (!useBlob && utils.isBlob(value)) {
          throw new AxiosError('Blob is not supported. Use a Buffer instead.');
        }
        if (utils.isArrayBuffer(value) || utils.isTypedArray(value)) {
          return useBlob && typeof Blob === 'function' ? new Blob([value]) : Buffer.from(value);
        }
        return value;
      }
      function defaultVisitor(value, key, path) {
        var arr = value;
        if (value && !path && typeof value === 'object') {
          if (utils.endsWith(key, '{}')) {
            key = metaTokens ? key : key.slice(0, -2);
            value = JSON.stringify(value);
          } else if (
            (utils.isArray(value) && isFlatArray(value)) ||
            utils.isFileList(value) ||
            (utils.endsWith(key, '[]') && (arr = utils.toArray(value)))
          ) {
            key = removeBrackets(key);
            arr.forEach(function each(el, index) {
              !(utils.isUndefined(el) || el === null) &&
                formData.append(
                  // eslint-disable-next-line no-nested-ternary
                  indexes === true
                    ? renderKey([key], index, dots)
                    : indexes === null
                      ? key
                      : key + '[]',
                  convertValue(el)
                );
            });
            return false;
          }
        }
        if (isVisitable(value)) {
          return true;
        }
        formData.append(renderKey(path, key, dots), convertValue(value));
        return false;
      }
      var stack = [];
      var exposedHelpers = Object.assign(predicates, {
        defaultVisitor,
        convertValue,
        isVisitable,
      });
      function build(value, path) {
        if (utils.isUndefined(value)) return;
        if (stack.indexOf(value) !== -1) {
          throw Error('Circular reference detected in ' + path.join('.'));
        }
        stack.push(value);
        utils.forEach(value, function each(el, key) {
          var result =
            !(utils.isUndefined(el) || el === null) &&
            visitor.call(
              formData,
              el,
              utils.isString(key) ? key.trim() : key,
              path,
              exposedHelpers
            );
          if (result === true) {
            build(el, path ? path.concat(key) : [key]);
          }
        });
        stack.pop();
      }
      if (!utils.isObject(obj)) {
        throw new TypeError('data must be an object');
      }
      build(obj);
      return formData;
    }
    module2.exports = toFormData;
  },
});

// node_modules/axios/lib/helpers/AxiosURLSearchParams.js
var require_AxiosURLSearchParams = __commonJS({
  'node_modules/axios/lib/helpers/AxiosURLSearchParams.js'(exports2, module2) {
    'use strict';
    var toFormData = require_toFormData();
    function encode(str) {
      var charMap = {
        '!': '%21',
        "'": '%27',
        '(': '%28',
        ')': '%29',
        '~': '%7E',
        '%20': '+',
        '%00': '\0',
      };
      return encodeURIComponent(str).replace(/[!'\(\)~]|%20|%00/g, function replacer(match) {
        return charMap[match];
      });
    }
    function AxiosURLSearchParams(params, options) {
      this._pairs = [];
      params && toFormData(params, this, options);
    }
    var prototype = AxiosURLSearchParams.prototype;
    prototype.append = function append(name, value) {
      this._pairs.push([name, value]);
    };
    prototype.toString = function toString(encoder) {
      var _encode = encoder
        ? function (value) {
            return encoder.call(this, value, encode);
          }
        : encode;
      return this._pairs
        .map(function each(pair) {
          return _encode(pair[0]) + '=' + _encode(pair[1]);
        }, '')
        .join('&');
    };
    module2.exports = AxiosURLSearchParams;
  },
});

// node_modules/axios/lib/helpers/buildURL.js
var require_buildURL = __commonJS({
  'node_modules/axios/lib/helpers/buildURL.js'(exports2, module2) {
    'use strict';
    var utils = require_utils();
    var AxiosURLSearchParams = require_AxiosURLSearchParams();
    function encode(val) {
      return encodeURIComponent(val)
        .replace(/%3A/gi, ':')
        .replace(/%24/g, '$')
        .replace(/%2C/gi, ',')
        .replace(/%20/g, '+')
        .replace(/%5B/gi, '[')
        .replace(/%5D/gi, ']');
    }
    module2.exports = function buildURL(url, params, options) {
      if (!params) {
        return url;
      }
      var hashmarkIndex = url.indexOf('#');
      if (hashmarkIndex !== -1) {
        url = url.slice(0, hashmarkIndex);
      }
      var _encode = (options && options.encode) || encode;
      var serializeFn = options && options.serialize;
      var serializedParams;
      if (serializeFn) {
        serializedParams = serializeFn(params, options);
      } else {
        serializedParams = utils.isURLSearchParams(params)
          ? params.toString()
          : new AxiosURLSearchParams(params, options).toString(_encode);
      }
      if (serializedParams) {
        url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
      }
      return url;
    };
  },
});

// node_modules/axios/lib/core/InterceptorManager.js
var require_InterceptorManager = __commonJS({
  'node_modules/axios/lib/core/InterceptorManager.js'(exports2, module2) {
    'use strict';
    var utils = require_utils();
    function InterceptorManager() {
      this.handlers = [];
    }
    InterceptorManager.prototype.use = function use(fulfilled, rejected, options) {
      this.handlers.push({
        fulfilled,
        rejected,
        synchronous: options ? options.synchronous : false,
        runWhen: options ? options.runWhen : null,
      });
      return this.handlers.length - 1;
    };
    InterceptorManager.prototype.eject = function eject(id) {
      if (this.handlers[id]) {
        this.handlers[id] = null;
      }
    };
    InterceptorManager.prototype.clear = function clear() {
      if (this.handlers) {
        this.handlers = [];
      }
    };
    InterceptorManager.prototype.forEach = function forEach(fn) {
      utils.forEach(this.handlers, function forEachHandler(h) {
        if (h !== null) {
          fn(h);
        }
      });
    };
    module2.exports = InterceptorManager;
  },
});

// node_modules/axios/lib/helpers/normalizeHeaderName.js
var require_normalizeHeaderName = __commonJS({
  'node_modules/axios/lib/helpers/normalizeHeaderName.js'(exports2, module2) {
    'use strict';
    var utils = require_utils();
    module2.exports = function normalizeHeaderName(headers, normalizedName) {
      utils.forEach(headers, function processHeader(value, name) {
        if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
          headers[normalizedName] = value;
          delete headers[name];
        }
      });
    };
  },
});

// node_modules/axios/lib/defaults/transitional.js
var require_transitional = __commonJS({
  'node_modules/axios/lib/defaults/transitional.js'(exports2, module2) {
    'use strict';
    module2.exports = {
      silentJSONParsing: true,
      forcedJSONParsing: true,
      clarifyTimeoutError: false,
    };
  },
});

// node_modules/axios/lib/platform/node/classes/URLSearchParams.js
var require_URLSearchParams = __commonJS({
  'node_modules/axios/lib/platform/node/classes/URLSearchParams.js'(exports2, module2) {
    'use strict';
    var url = require('url');
    module2.exports = url.URLSearchParams;
  },
});

// node_modules/axios/lib/platform/node/classes/FormData.js
var require_FormData2 = __commonJS({
  'node_modules/axios/lib/platform/node/classes/FormData.js'(exports2, module2) {
    'use strict';
    module2.exports = require_form_data();
  },
});

// node_modules/axios/lib/platform/node/index.js
var require_node = __commonJS({
  'node_modules/axios/lib/platform/node/index.js'(exports2, module2) {
    'use strict';
    module2.exports = {
      isNode: true,
      classes: {
        URLSearchParams: require_URLSearchParams(),
        FormData: require_FormData2(),
        Blob: (typeof Blob !== 'undefined' && Blob) || null,
      },
      protocols: ['http', 'https', 'file', 'data'],
    };
  },
});

// node_modules/axios/lib/platform/index.js
var require_platform = __commonJS({
  'node_modules/axios/lib/platform/index.js'(exports2, module2) {
    'use strict';
    module2.exports = require_node();
  },
});

// node_modules/axios/lib/helpers/toURLEncodedForm.js
var require_toURLEncodedForm = __commonJS({
  'node_modules/axios/lib/helpers/toURLEncodedForm.js'(exports2, module2) {
    'use strict';
    var utils = require_utils();
    var toFormData = require_toFormData();
    var platform = require_platform();
    module2.exports = function toURLEncodedForm(data, options) {
      return toFormData(
        data,
        new platform.classes.URLSearchParams(),
        Object.assign(
          {
            visitor: function (value, key, path, helpers) {
              if (platform.isNode && utils.isBuffer(value)) {
                this.append(key, value.toString('base64'));
                return false;
              }
              return helpers.defaultVisitor.apply(this, arguments);
            },
          },
          options
        )
      );
    };
  },
});

// node_modules/axios/lib/helpers/formDataToJSON.js
var require_formDataToJSON = __commonJS({
  'node_modules/axios/lib/helpers/formDataToJSON.js'(exports2, module2) {
    'use strict';
    var utils = require_utils();
    function parsePropPath(name) {
      return utils.matchAll(/\w+|\[(\w*)]/g, name).map(function (match) {
        return match[0] === '[]' ? '' : match[1] || match[0];
      });
    }
    function arrayToObject(arr) {
      var obj = {};
      var keys = Object.keys(arr);
      var i;
      var len = keys.length;
      var key;
      for (i = 0; i < len; i++) {
        key = keys[i];
        obj[key] = arr[key];
      }
      return obj;
    }
    function formDataToJSON(formData) {
      function buildPath(path, value, target, index) {
        var name = path[index++];
        if (name === '__proto__') return true;
        var isNumericKey = Number.isFinite(+name);
        var isLast = index >= path.length;
        name = !name && utils.isArray(target) ? target.length : name;
        if (isLast) {
          if (utils.hasOwnProperty(target, name)) {
            target[name] = [target[name], value];
          } else {
            target[name] = value;
          }
          return !isNumericKey;
        }
        if (!target[name] || !utils.isObject(target[name])) {
          target[name] = [];
        }
        var result = buildPath(path, value, target[name], index);
        if (result && utils.isArray(target[name])) {
          target[name] = arrayToObject(target[name]);
        }
        return !isNumericKey;
      }
      if (utils.isFormData(formData) && utils.isFunction(formData.entries)) {
        var obj = {};
        utils.forEachEntry(formData, function (name, value) {
          buildPath(parsePropPath(name), value, obj, 0);
        });
        return obj;
      }
      return null;
    }
    module2.exports = formDataToJSON;
  },
});

// node_modules/axios/lib/core/settle.js
var require_settle = __commonJS({
  'node_modules/axios/lib/core/settle.js'(exports2, module2) {
    'use strict';
    var AxiosError = require_AxiosError();
    module2.exports = function settle(resolve, reject, response) {
      var validateStatus = response.config.validateStatus;
      if (!response.status || !validateStatus || validateStatus(response.status)) {
        resolve(response);
      } else {
        reject(
          new AxiosError(
            'Request failed with status code ' + response.status,
            [AxiosError.ERR_BAD_REQUEST, AxiosError.ERR_BAD_RESPONSE][
              Math.floor(response.status / 100) - 4
            ],
            response.config,
            response.request,
            response
          )
        );
      }
    };
  },
});

// node_modules/axios/lib/helpers/cookies.js
var require_cookies = __commonJS({
  'node_modules/axios/lib/helpers/cookies.js'(exports2, module2) {
    'use strict';
    var utils = require_utils();
    module2.exports = utils.isStandardBrowserEnv()
      ? // Standard browser envs support document.cookie
        /* @__PURE__ */ (function standardBrowserEnv() {
          return {
            write: function write(name, value, expires, path, domain, secure) {
              var cookie = [];
              cookie.push(name + '=' + encodeURIComponent(value));
              if (utils.isNumber(expires)) {
                cookie.push('expires=' + new Date(expires).toGMTString());
              }
              if (utils.isString(path)) {
                cookie.push('path=' + path);
              }
              if (utils.isString(domain)) {
                cookie.push('domain=' + domain);
              }
              if (secure === true) {
                cookie.push('secure');
              }
              document.cookie = cookie.join('; ');
            },
            read: function read(name) {
              var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
              return match ? decodeURIComponent(match[3]) : null;
            },
            remove: function remove(name) {
              this.write(name, '', Date.now() - 864e5);
            },
          };
        })()
      : // Non standard browser env (web workers, react-native) lack needed support.
        /* @__PURE__ */ (function nonStandardBrowserEnv() {
          return {
            write: function write() {},
            read: function read() {
              return null;
            },
            remove: function remove() {},
          };
        })();
  },
});

// node_modules/axios/lib/helpers/isAbsoluteURL.js
var require_isAbsoluteURL = __commonJS({
  'node_modules/axios/lib/helpers/isAbsoluteURL.js'(exports2, module2) {
    'use strict';
    module2.exports = function isAbsoluteURL(url) {
      return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
    };
  },
});

// node_modules/axios/lib/helpers/combineURLs.js
var require_combineURLs = __commonJS({
  'node_modules/axios/lib/helpers/combineURLs.js'(exports2, module2) {
    'use strict';
    module2.exports = function combineURLs(baseURL, relativeURL) {
      return relativeURL
        ? baseURL.replace(/\/?\/$/, '') + '/' + relativeURL.replace(/^\/+/, '')
        : baseURL;
    };
  },
});

// node_modules/axios/lib/core/buildFullPath.js
var require_buildFullPath = __commonJS({
  'node_modules/axios/lib/core/buildFullPath.js'(exports2, module2) {
    'use strict';
    var isAbsoluteURL = require_isAbsoluteURL();
    var combineURLs = require_combineURLs();
    module2.exports = function buildFullPath(baseURL, requestedURL, allowAbsoluteUrls) {
      var isRelativeURL = !isAbsoluteURL(requestedURL);
      if (baseURL && (isRelativeURL || allowAbsoluteUrls === false)) {
        return combineURLs(baseURL, requestedURL);
      }
      return requestedURL;
    };
  },
});

// node_modules/axios/lib/helpers/parseHeaders.js
var require_parseHeaders = __commonJS({
  'node_modules/axios/lib/helpers/parseHeaders.js'(exports2, module2) {
    'use strict';
    var utils = require_utils();
    var ignoreDuplicateOf = [
      'age',
      'authorization',
      'content-length',
      'content-type',
      'etag',
      'expires',
      'from',
      'host',
      'if-modified-since',
      'if-unmodified-since',
      'last-modified',
      'location',
      'max-forwards',
      'proxy-authorization',
      'referer',
      'retry-after',
      'user-agent',
    ];
    module2.exports = function parseHeaders(headers) {
      var parsed = {};
      var key;
      var val;
      var i;
      if (!headers) {
        return parsed;
      }
      utils.forEach(headers.split('\n'), function parser(line) {
        i = line.indexOf(':');
        key = utils.trim(line.slice(0, i)).toLowerCase();
        val = utils.trim(line.slice(i + 1));
        if (key) {
          if (parsed[key] && ignoreDuplicateOf.indexOf(key) >= 0) {
            return;
          }
          if (key === 'set-cookie') {
            parsed[key] = (parsed[key] ? parsed[key] : []).concat([val]);
          } else {
            parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
          }
        }
      });
      return parsed;
    };
  },
});

// node_modules/axios/lib/helpers/isURLSameOrigin.js
var require_isURLSameOrigin = __commonJS({
  'node_modules/axios/lib/helpers/isURLSameOrigin.js'(exports2, module2) {
    'use strict';
    var utils = require_utils();
    module2.exports = utils.isStandardBrowserEnv()
      ? // Standard browser envs have full support of the APIs needed to test
        // whether the request URL is of the same origin as current location.
        (function standardBrowserEnv() {
          var msie = /(msie|trident)/i.test(navigator.userAgent);
          var urlParsingNode = document.createElement('a');
          var originURL;
          function resolveURL(url) {
            var href = url;
            if (msie) {
              urlParsingNode.setAttribute('href', href);
              href = urlParsingNode.href;
            }
            urlParsingNode.setAttribute('href', href);
            return {
              href: urlParsingNode.href,
              protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
              host: urlParsingNode.host,
              search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
              hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
              hostname: urlParsingNode.hostname,
              port: urlParsingNode.port,
              pathname:
                urlParsingNode.pathname.charAt(0) === '/'
                  ? urlParsingNode.pathname
                  : '/' + urlParsingNode.pathname,
            };
          }
          originURL = resolveURL(window.location.href);
          return function isURLSameOrigin(requestURL) {
            var parsed = utils.isString(requestURL) ? resolveURL(requestURL) : requestURL;
            return parsed.protocol === originURL.protocol && parsed.host === originURL.host;
          };
        })()
      : // Non standard browser envs (web workers, react-native) lack needed support.
        /* @__PURE__ */ (function nonStandardBrowserEnv() {
          return function isURLSameOrigin() {
            return true;
          };
        })();
  },
});

// node_modules/axios/lib/cancel/CanceledError.js
var require_CanceledError = __commonJS({
  'node_modules/axios/lib/cancel/CanceledError.js'(exports2, module2) {
    'use strict';
    var AxiosError = require_AxiosError();
    var utils = require_utils();
    function CanceledError(message, config, request) {
      AxiosError.call(
        this,
        message == null ? 'canceled' : message,
        AxiosError.ERR_CANCELED,
        config,
        request
      );
      this.name = 'CanceledError';
    }
    utils.inherits(CanceledError, AxiosError, {
      __CANCEL__: true,
    });
    module2.exports = CanceledError;
  },
});

// node_modules/axios/lib/helpers/parseProtocol.js
var require_parseProtocol = __commonJS({
  'node_modules/axios/lib/helpers/parseProtocol.js'(exports2, module2) {
    'use strict';
    module2.exports = function parseProtocol(url) {
      var match = /^([-+\w]{1,25})(:?\/\/|:)/.exec(url);
      return (match && match[1]) || '';
    };
  },
});

// node_modules/axios/lib/adapters/xhr.js
var require_xhr = __commonJS({
  'node_modules/axios/lib/adapters/xhr.js'(exports2, module2) {
    'use strict';
    var utils = require_utils();
    var settle = require_settle();
    var cookies = require_cookies();
    var buildURL = require_buildURL();
    var buildFullPath = require_buildFullPath();
    var parseHeaders = require_parseHeaders();
    var isURLSameOrigin = require_isURLSameOrigin();
    var transitionalDefaults = require_transitional();
    var AxiosError = require_AxiosError();
    var CanceledError = require_CanceledError();
    var parseProtocol = require_parseProtocol();
    var platform = require_platform();
    module2.exports = function xhrAdapter(config) {
      return new Promise(function dispatchXhrRequest(resolve, reject) {
        var requestData = config.data;
        var requestHeaders = config.headers;
        var responseType = config.responseType;
        var withXSRFToken = config.withXSRFToken;
        var onCanceled;
        function done() {
          if (config.cancelToken) {
            config.cancelToken.unsubscribe(onCanceled);
          }
          if (config.signal) {
            config.signal.removeEventListener('abort', onCanceled);
          }
        }
        if (utils.isFormData(requestData) && utils.isStandardBrowserEnv()) {
          delete requestHeaders['Content-Type'];
        }
        var request = new XMLHttpRequest();
        if (config.auth) {
          var username = config.auth.username || '';
          var password = config.auth.password
            ? unescape(encodeURIComponent(config.auth.password))
            : '';
          requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
        }
        var fullPath = buildFullPath(config.baseURL, config.url, config.allowAbsoluteUrls);
        request.open(
          config.method.toUpperCase(),
          buildURL(fullPath, config.params, config.paramsSerializer),
          true
        );
        request.timeout = config.timeout;
        function onloadend() {
          if (!request) {
            return;
          }
          var responseHeaders =
            'getAllResponseHeaders' in request
              ? parseHeaders(request.getAllResponseHeaders())
              : null;
          var responseData =
            !responseType || responseType === 'text' || responseType === 'json'
              ? request.responseText
              : request.response;
          var response = {
            data: responseData,
            status: request.status,
            statusText: request.statusText,
            headers: responseHeaders,
            config,
            request,
          };
          settle(
            function _resolve(value) {
              resolve(value);
              done();
            },
            function _reject(err) {
              reject(err);
              done();
            },
            response
          );
          request = null;
        }
        if ('onloadend' in request) {
          request.onloadend = onloadend;
        } else {
          request.onreadystatechange = function handleLoad() {
            if (!request || request.readyState !== 4) {
              return;
            }
            if (
              request.status === 0 &&
              !(request.responseURL && request.responseURL.indexOf('file:') === 0)
            ) {
              return;
            }
            setTimeout(onloadend);
          };
        }
        request.onabort = function handleAbort() {
          if (!request) {
            return;
          }
          reject(new AxiosError('Request aborted', AxiosError.ECONNABORTED, config, request));
          request = null;
        };
        request.onerror = function handleError() {
          reject(new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, request));
          request = null;
        };
        request.ontimeout = function handleTimeout() {
          var timeoutErrorMessage = config.timeout
            ? 'timeout of ' + config.timeout + 'ms exceeded'
            : 'timeout exceeded';
          var transitional = config.transitional || transitionalDefaults;
          if (config.timeoutErrorMessage) {
            timeoutErrorMessage = config.timeoutErrorMessage;
          }
          reject(
            new AxiosError(
              timeoutErrorMessage,
              transitional.clarifyTimeoutError ? AxiosError.ETIMEDOUT : AxiosError.ECONNABORTED,
              config,
              request
            )
          );
          request = null;
        };
        if (utils.isStandardBrowserEnv()) {
          withXSRFToken &&
            utils.isFunction(withXSRFToken) &&
            (withXSRFToken = withXSRFToken(config));
          if (withXSRFToken || (withXSRFToken !== false && isURLSameOrigin(fullPath))) {
            var xsrfValue =
              config.xsrfHeaderName && config.xsrfCookieName && cookies.read(config.xsrfCookieName);
            if (xsrfValue) {
              requestHeaders[config.xsrfHeaderName] = xsrfValue;
            }
          }
        }
        if ('setRequestHeader' in request) {
          utils.forEach(requestHeaders, function setRequestHeader(val, key) {
            if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
              delete requestHeaders[key];
            } else {
              request.setRequestHeader(key, val);
            }
          });
        }
        if (!utils.isUndefined(config.withCredentials)) {
          request.withCredentials = !!config.withCredentials;
        }
        if (responseType && responseType !== 'json') {
          request.responseType = config.responseType;
        }
        if (typeof config.onDownloadProgress === 'function') {
          request.addEventListener('progress', config.onDownloadProgress);
        }
        if (typeof config.onUploadProgress === 'function' && request.upload) {
          request.upload.addEventListener('progress', config.onUploadProgress);
        }
        if (config.cancelToken || config.signal) {
          onCanceled = function (cancel) {
            if (!request) {
              return;
            }
            reject(!cancel || cancel.type ? new CanceledError(null, config, request) : cancel);
            request.abort();
            request = null;
          };
          config.cancelToken && config.cancelToken.subscribe(onCanceled);
          if (config.signal) {
            config.signal.aborted
              ? onCanceled()
              : config.signal.addEventListener('abort', onCanceled);
          }
        }
        if (!requestData && requestData !== false && requestData !== 0 && requestData !== '') {
          requestData = null;
        }
        var protocol = parseProtocol(fullPath);
        if (protocol && platform.protocols.indexOf(protocol) === -1) {
          reject(
            new AxiosError(
              'Unsupported protocol ' + protocol + ':',
              AxiosError.ERR_BAD_REQUEST,
              config
            )
          );
          return;
        }
        request.send(requestData);
      });
    };
  },
});

// node_modules/proxy-from-env/index.js
var require_proxy_from_env = __commonJS({
  'node_modules/proxy-from-env/index.js'(exports2) {
    'use strict';
    var parseUrl = require('url').parse;
    var DEFAULT_PORTS = {
      ftp: 21,
      gopher: 70,
      http: 80,
      https: 443,
      ws: 80,
      wss: 443,
    };
    var stringEndsWith =
      String.prototype.endsWith ||
      function (s) {
        return s.length <= this.length && this.indexOf(s, this.length - s.length) !== -1;
      };
    function getProxyForUrl(url) {
      var parsedUrl = typeof url === 'string' ? parseUrl(url) : url || {};
      var proto = parsedUrl.protocol;
      var hostname = parsedUrl.host;
      var port = parsedUrl.port;
      if (typeof hostname !== 'string' || !hostname || typeof proto !== 'string') {
        return '';
      }
      proto = proto.split(':', 1)[0];
      hostname = hostname.replace(/:\d*$/, '');
      port = parseInt(port) || DEFAULT_PORTS[proto] || 0;
      if (!shouldProxy(hostname, port)) {
        return '';
      }
      var proxy =
        getEnv('npm_config_' + proto + '_proxy') ||
        getEnv(proto + '_proxy') ||
        getEnv('npm_config_proxy') ||
        getEnv('all_proxy');
      if (proxy && proxy.indexOf('://') === -1) {
        proxy = proto + '://' + proxy;
      }
      return proxy;
    }
    function shouldProxy(hostname, port) {
      var NO_PROXY = (getEnv('npm_config_no_proxy') || getEnv('no_proxy')).toLowerCase();
      if (!NO_PROXY) {
        return true;
      }
      if (NO_PROXY === '*') {
        return false;
      }
      return NO_PROXY.split(/[,\s]/).every(function (proxy) {
        if (!proxy) {
          return true;
        }
        var parsedProxy = proxy.match(/^(.+):(\d+)$/);
        var parsedProxyHostname = parsedProxy ? parsedProxy[1] : proxy;
        var parsedProxyPort = parsedProxy ? parseInt(parsedProxy[2]) : 0;
        if (parsedProxyPort && parsedProxyPort !== port) {
          return true;
        }
        if (!/^[.*]/.test(parsedProxyHostname)) {
          return hostname !== parsedProxyHostname;
        }
        if (parsedProxyHostname.charAt(0) === '*') {
          parsedProxyHostname = parsedProxyHostname.slice(1);
        }
        return !stringEndsWith.call(hostname, parsedProxyHostname);
      });
    }
    function getEnv(key) {
      return process.env[key.toLowerCase()] || process.env[key.toUpperCase()] || '';
    }
    exports2.getProxyForUrl = getProxyForUrl;
  },
});

// node_modules/ms/index.js
var require_ms = __commonJS({
  'node_modules/ms/index.js'(exports2, module2) {
    var s = 1e3;
    var m = s * 60;
    var h = m * 60;
    var d = h * 24;
    var w = d * 7;
    var y = d * 365.25;
    module2.exports = function (val, options) {
      options = options || {};
      var type = typeof val;
      if (type === 'string' && val.length > 0) {
        return parse(val);
      } else if (type === 'number' && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error(
        'val is not a non-empty string or a valid number. val=' + JSON.stringify(val)
      );
    };
    function parse(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match =
        /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
          str
        );
      if (!match) {
        return;
      }
      var n = parseFloat(match[1]);
      var type = (match[2] || 'ms').toLowerCase();
      switch (type) {
        case 'years':
        case 'year':
        case 'yrs':
        case 'yr':
        case 'y':
          return n * y;
        case 'weeks':
        case 'week':
        case 'w':
          return n * w;
        case 'days':
        case 'day':
        case 'd':
          return n * d;
        case 'hours':
        case 'hour':
        case 'hrs':
        case 'hr':
        case 'h':
          return n * h;
        case 'minutes':
        case 'minute':
        case 'mins':
        case 'min':
        case 'm':
          return n * m;
        case 'seconds':
        case 'second':
        case 'secs':
        case 'sec':
        case 's':
          return n * s;
        case 'milliseconds':
        case 'millisecond':
        case 'msecs':
        case 'msec':
        case 'ms':
          return n;
        default:
          return void 0;
      }
    }
    function fmtShort(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return Math.round(ms / d) + 'd';
      }
      if (msAbs >= h) {
        return Math.round(ms / h) + 'h';
      }
      if (msAbs >= m) {
        return Math.round(ms / m) + 'm';
      }
      if (msAbs >= s) {
        return Math.round(ms / s) + 's';
      }
      return ms + 'ms';
    }
    function fmtLong(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return plural(ms, msAbs, d, 'day');
      }
      if (msAbs >= h) {
        return plural(ms, msAbs, h, 'hour');
      }
      if (msAbs >= m) {
        return plural(ms, msAbs, m, 'minute');
      }
      if (msAbs >= s) {
        return plural(ms, msAbs, s, 'second');
      }
      return ms + ' ms';
    }
    function plural(ms, msAbs, n, name) {
      var isPlural = msAbs >= n * 1.5;
      return Math.round(ms / n) + ' ' + name + (isPlural ? 's' : '');
    }
  },
});

// node_modules/debug/src/common.js
var require_common = __commonJS({
  'node_modules/debug/src/common.js'(exports2, module2) {
    function setup(env) {
      createDebug.debug = createDebug;
      createDebug.default = createDebug;
      createDebug.coerce = coerce;
      createDebug.disable = disable;
      createDebug.enable = enable;
      createDebug.enabled = enabled;
      createDebug.humanize = require_ms();
      createDebug.destroy = destroy;
      Object.keys(env).forEach((key) => {
        createDebug[key] = env[key];
      });
      createDebug.names = [];
      createDebug.skips = [];
      createDebug.formatters = {};
      function selectColor(namespace) {
        let hash = 0;
        for (let i = 0; i < namespace.length; i++) {
          hash = (hash << 5) - hash + namespace.charCodeAt(i);
          hash |= 0;
        }
        return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
      }
      createDebug.selectColor = selectColor;
      function createDebug(namespace) {
        let prevTime;
        let enableOverride = null;
        let namespacesCache;
        let enabledCache;
        function debug(...args) {
          if (!debug.enabled) {
            return;
          }
          const self2 = debug;
          const curr = Number(/* @__PURE__ */ new Date());
          const ms = curr - (prevTime || curr);
          self2.diff = ms;
          self2.prev = prevTime;
          self2.curr = curr;
          prevTime = curr;
          args[0] = createDebug.coerce(args[0]);
          if (typeof args[0] !== 'string') {
            args.unshift('%O');
          }
          let index = 0;
          args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
            if (match === '%%') {
              return '%';
            }
            index++;
            const formatter = createDebug.formatters[format];
            if (typeof formatter === 'function') {
              const val = args[index];
              match = formatter.call(self2, val);
              args.splice(index, 1);
              index--;
            }
            return match;
          });
          createDebug.formatArgs.call(self2, args);
          const logFn = self2.log || createDebug.log;
          logFn.apply(self2, args);
        }
        debug.namespace = namespace;
        debug.useColors = createDebug.useColors();
        debug.color = createDebug.selectColor(namespace);
        debug.extend = extend;
        debug.destroy = createDebug.destroy;
        Object.defineProperty(debug, 'enabled', {
          enumerable: true,
          configurable: false,
          get: () => {
            if (enableOverride !== null) {
              return enableOverride;
            }
            if (namespacesCache !== createDebug.namespaces) {
              namespacesCache = createDebug.namespaces;
              enabledCache = createDebug.enabled(namespace);
            }
            return enabledCache;
          },
          set: (v) => {
            enableOverride = v;
          },
        });
        if (typeof createDebug.init === 'function') {
          createDebug.init(debug);
        }
        return debug;
      }
      function extend(namespace, delimiter) {
        const newDebug = createDebug(
          this.namespace + (typeof delimiter === 'undefined' ? ':' : delimiter) + namespace
        );
        newDebug.log = this.log;
        return newDebug;
      }
      function enable(namespaces) {
        createDebug.save(namespaces);
        createDebug.namespaces = namespaces;
        createDebug.names = [];
        createDebug.skips = [];
        const split = (typeof namespaces === 'string' ? namespaces : '')
          .trim()
          .replace(/\s+/g, ',')
          .split(',')
          .filter(Boolean);
        for (const ns of split) {
          if (ns[0] === '-') {
            createDebug.skips.push(ns.slice(1));
          } else {
            createDebug.names.push(ns);
          }
        }
      }
      function matchesTemplate(search, template) {
        let searchIndex = 0;
        let templateIndex = 0;
        let starIndex = -1;
        let matchIndex = 0;
        while (searchIndex < search.length) {
          if (
            templateIndex < template.length &&
            (template[templateIndex] === search[searchIndex] || template[templateIndex] === '*')
          ) {
            if (template[templateIndex] === '*') {
              starIndex = templateIndex;
              matchIndex = searchIndex;
              templateIndex++;
            } else {
              searchIndex++;
              templateIndex++;
            }
          } else if (starIndex !== -1) {
            templateIndex = starIndex + 1;
            matchIndex++;
            searchIndex = matchIndex;
          } else {
            return false;
          }
        }
        while (templateIndex < template.length && template[templateIndex] === '*') {
          templateIndex++;
        }
        return templateIndex === template.length;
      }
      function disable() {
        const namespaces = [
          ...createDebug.names,
          ...createDebug.skips.map((namespace) => '-' + namespace),
        ].join(',');
        createDebug.enable('');
        return namespaces;
      }
      function enabled(name) {
        for (const skip of createDebug.skips) {
          if (matchesTemplate(name, skip)) {
            return false;
          }
        }
        for (const ns of createDebug.names) {
          if (matchesTemplate(name, ns)) {
            return true;
          }
        }
        return false;
      }
      function coerce(val) {
        if (val instanceof Error) {
          return val.stack || val.message;
        }
        return val;
      }
      function destroy() {
        console.warn(
          'Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.'
        );
      }
      createDebug.enable(createDebug.load());
      return createDebug;
    }
    module2.exports = setup;
  },
});

// node_modules/debug/src/browser.js
var require_browser = __commonJS({
  'node_modules/debug/src/browser.js'(exports2, module2) {
    exports2.formatArgs = formatArgs;
    exports2.save = save;
    exports2.load = load;
    exports2.useColors = useColors;
    exports2.storage = localstorage();
    exports2.destroy = /* @__PURE__ */ (() => {
      let warned = false;
      return () => {
        if (!warned) {
          warned = true;
          console.warn(
            'Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.'
          );
        }
      };
    })();
    exports2.colors = [
      '#0000CC',
      '#0000FF',
      '#0033CC',
      '#0033FF',
      '#0066CC',
      '#0066FF',
      '#0099CC',
      '#0099FF',
      '#00CC00',
      '#00CC33',
      '#00CC66',
      '#00CC99',
      '#00CCCC',
      '#00CCFF',
      '#3300CC',
      '#3300FF',
      '#3333CC',
      '#3333FF',
      '#3366CC',
      '#3366FF',
      '#3399CC',
      '#3399FF',
      '#33CC00',
      '#33CC33',
      '#33CC66',
      '#33CC99',
      '#33CCCC',
      '#33CCFF',
      '#6600CC',
      '#6600FF',
      '#6633CC',
      '#6633FF',
      '#66CC00',
      '#66CC33',
      '#9900CC',
      '#9900FF',
      '#9933CC',
      '#9933FF',
      '#99CC00',
      '#99CC33',
      '#CC0000',
      '#CC0033',
      '#CC0066',
      '#CC0099',
      '#CC00CC',
      '#CC00FF',
      '#CC3300',
      '#CC3333',
      '#CC3366',
      '#CC3399',
      '#CC33CC',
      '#CC33FF',
      '#CC6600',
      '#CC6633',
      '#CC9900',
      '#CC9933',
      '#CCCC00',
      '#CCCC33',
      '#FF0000',
      '#FF0033',
      '#FF0066',
      '#FF0099',
      '#FF00CC',
      '#FF00FF',
      '#FF3300',
      '#FF3333',
      '#FF3366',
      '#FF3399',
      '#FF33CC',
      '#FF33FF',
      '#FF6600',
      '#FF6633',
      '#FF9900',
      '#FF9933',
      '#FFCC00',
      '#FFCC33',
    ];
    function useColors() {
      if (
        typeof window !== 'undefined' &&
        window.process &&
        (window.process.type === 'renderer' || window.process.__nwjs)
      ) {
        return true;
      }
      if (
        typeof navigator !== 'undefined' &&
        navigator.userAgent &&
        navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)
      ) {
        return false;
      }
      let m;
      return (
        (typeof document !== 'undefined' &&
          document.documentElement &&
          document.documentElement.style &&
          document.documentElement.style.WebkitAppearance) || // Is firebug? http://stackoverflow.com/a/398120/376773
        (typeof window !== 'undefined' &&
          window.console &&
          (window.console.firebug || (window.console.exception && window.console.table))) || // Is firefox >= v31?
        // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
        (typeof navigator !== 'undefined' &&
          navigator.userAgent &&
          (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) &&
          parseInt(m[1], 10) >= 31) || // Double check webkit in userAgent just in case we are in a worker
        (typeof navigator !== 'undefined' &&
          navigator.userAgent &&
          navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/))
      );
    }
    function formatArgs(args) {
      args[0] =
        (this.useColors ? '%c' : '') +
        this.namespace +
        (this.useColors ? ' %c' : ' ') +
        args[0] +
        (this.useColors ? '%c ' : ' ') +
        '+' +
        module2.exports.humanize(this.diff);
      if (!this.useColors) {
        return;
      }
      const c = 'color: ' + this.color;
      args.splice(1, 0, c, 'color: inherit');
      let index = 0;
      let lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, (match) => {
        if (match === '%%') {
          return;
        }
        index++;
        if (match === '%c') {
          lastC = index;
        }
      });
      args.splice(lastC, 0, c);
    }
    exports2.log = console.debug || console.log || (() => {});
    function save(namespaces) {
      try {
        if (namespaces) {
          exports2.storage.setItem('debug', namespaces);
        } else {
          exports2.storage.removeItem('debug');
        }
      } catch (error) {}
    }
    function load() {
      let r;
      try {
        r = exports2.storage.getItem('debug') || exports2.storage.getItem('DEBUG');
      } catch (error) {}
      if (!r && typeof process !== 'undefined' && 'env' in process) {
        r = process.env.DEBUG;
      }
      return r;
    }
    function localstorage() {
      try {
        return localStorage;
      } catch (error) {}
    }
    module2.exports = require_common()(exports2);
    var { formatters } = module2.exports;
    formatters.j = function (v) {
      try {
        return JSON.stringify(v);
      } catch (error) {
        return '[UnexpectedJSONParseError]: ' + error.message;
      }
    };
  },
});

// node_modules/has-flag/index.js
var require_has_flag = __commonJS({
  'node_modules/has-flag/index.js'(exports2, module2) {
    'use strict';
    module2.exports = (flag, argv = process.argv) => {
      const prefix = flag.startsWith('-') ? '' : flag.length === 1 ? '-' : '--';
      const position = argv.indexOf(prefix + flag);
      const terminatorPosition = argv.indexOf('--');
      return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
    };
  },
});

// node_modules/supports-color/index.js
var require_supports_color = __commonJS({
  'node_modules/supports-color/index.js'(exports2, module2) {
    'use strict';
    var os = require('os');
    var tty = require('tty');
    var hasFlag = require_has_flag();
    var { env } = process;
    var forceColor;
    if (
      hasFlag('no-color') ||
      hasFlag('no-colors') ||
      hasFlag('color=false') ||
      hasFlag('color=never')
    ) {
      forceColor = 0;
    } else if (
      hasFlag('color') ||
      hasFlag('colors') ||
      hasFlag('color=true') ||
      hasFlag('color=always')
    ) {
      forceColor = 1;
    }
    if ('FORCE_COLOR' in env) {
      if (env.FORCE_COLOR === 'true') {
        forceColor = 1;
      } else if (env.FORCE_COLOR === 'false') {
        forceColor = 0;
      } else {
        forceColor = env.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(env.FORCE_COLOR, 10), 3);
      }
    }
    function translateLevel(level) {
      if (level === 0) {
        return false;
      }
      return {
        level,
        hasBasic: true,
        has256: level >= 2,
        has16m: level >= 3,
      };
    }
    function supportsColor(haveStream, streamIsTTY) {
      if (forceColor === 0) {
        return 0;
      }
      if (hasFlag('color=16m') || hasFlag('color=full') || hasFlag('color=truecolor')) {
        return 3;
      }
      if (hasFlag('color=256')) {
        return 2;
      }
      if (haveStream && !streamIsTTY && forceColor === void 0) {
        return 0;
      }
      const min = forceColor || 0;
      if (env.TERM === 'dumb') {
        return min;
      }
      if (process.platform === 'win32') {
        const osRelease = os.release().split('.');
        if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
          return Number(osRelease[2]) >= 14931 ? 3 : 2;
        }
        return 1;
      }
      if ('CI' in env) {
        if (
          ['TRAVIS', 'CIRCLECI', 'APPVEYOR', 'GITLAB_CI', 'GITHUB_ACTIONS', 'BUILDKITE'].some(
            (sign) => sign in env
          ) ||
          env.CI_NAME === 'codeship'
        ) {
          return 1;
        }
        return min;
      }
      if ('TEAMCITY_VERSION' in env) {
        return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
      }
      if (env.COLORTERM === 'truecolor') {
        return 3;
      }
      if ('TERM_PROGRAM' in env) {
        const version = parseInt((env.TERM_PROGRAM_VERSION || '').split('.')[0], 10);
        switch (env.TERM_PROGRAM) {
          case 'iTerm.app':
            return version >= 3 ? 3 : 2;
          case 'Apple_Terminal':
            return 2;
        }
      }
      if (/-256(color)?$/i.test(env.TERM)) {
        return 2;
      }
      if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
        return 1;
      }
      if ('COLORTERM' in env) {
        return 1;
      }
      return min;
    }
    function getSupportLevel(stream) {
      const level = supportsColor(stream, stream && stream.isTTY);
      return translateLevel(level);
    }
    module2.exports = {
      supportsColor: getSupportLevel,
      stdout: translateLevel(supportsColor(true, tty.isatty(1))),
      stderr: translateLevel(supportsColor(true, tty.isatty(2))),
    };
  },
});

// node_modules/debug/src/node.js
var require_node2 = __commonJS({
  'node_modules/debug/src/node.js'(exports2, module2) {
    var tty = require('tty');
    var util = require('util');
    exports2.init = init;
    exports2.log = log;
    exports2.formatArgs = formatArgs;
    exports2.save = save;
    exports2.load = load;
    exports2.useColors = useColors;
    exports2.destroy = util.deprecate(
      () => {},
      'Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.'
    );
    exports2.colors = [6, 2, 3, 4, 5, 1];
    try {
      const supportsColor = require_supports_color();
      if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
        exports2.colors = [
          20, 21, 26, 27, 32, 33, 38, 39, 40, 41, 42, 43, 44, 45, 56, 57, 62, 63, 68, 69, 74, 75,
          76, 77, 78, 79, 80, 81, 92, 93, 98, 99, 112, 113, 128, 129, 134, 135, 148, 149, 160, 161,
          162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 178, 179, 184, 185, 196, 197,
          198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 214, 215, 220, 221,
        ];
      }
    } catch (error) {}
    exports2.inspectOpts = Object.keys(process.env)
      .filter((key) => {
        return /^debug_/i.test(key);
      })
      .reduce((obj, key) => {
        const prop = key
          .substring(6)
          .toLowerCase()
          .replace(/_([a-z])/g, (_, k) => {
            return k.toUpperCase();
          });
        let val = process.env[key];
        if (/^(yes|on|true|enabled)$/i.test(val)) {
          val = true;
        } else if (/^(no|off|false|disabled)$/i.test(val)) {
          val = false;
        } else if (val === 'null') {
          val = null;
        } else {
          val = Number(val);
        }
        obj[prop] = val;
        return obj;
      }, {});
    function useColors() {
      return 'colors' in exports2.inspectOpts
        ? Boolean(exports2.inspectOpts.colors)
        : tty.isatty(process.stderr.fd);
    }
    function formatArgs(args) {
      const { namespace: name, useColors: useColors2 } = this;
      if (useColors2) {
        const c = this.color;
        const colorCode = '\x1B[3' + (c < 8 ? c : '8;5;' + c);
        const prefix = `  ${colorCode};1m${name} \x1B[0m`;
        args[0] = prefix + args[0].split('\n').join('\n' + prefix);
        args.push(colorCode + 'm+' + module2.exports.humanize(this.diff) + '\x1B[0m');
      } else {
        args[0] = getDate() + name + ' ' + args[0];
      }
    }
    function getDate() {
      if (exports2.inspectOpts.hideDate) {
        return '';
      }
      return /* @__PURE__ */ new Date().toISOString() + ' ';
    }
    function log(...args) {
      return process.stderr.write(util.formatWithOptions(exports2.inspectOpts, ...args) + '\n');
    }
    function save(namespaces) {
      if (namespaces) {
        process.env.DEBUG = namespaces;
      } else {
        delete process.env.DEBUG;
      }
    }
    function load() {
      return process.env.DEBUG;
    }
    function init(debug) {
      debug.inspectOpts = {};
      const keys = Object.keys(exports2.inspectOpts);
      for (let i = 0; i < keys.length; i++) {
        debug.inspectOpts[keys[i]] = exports2.inspectOpts[keys[i]];
      }
    }
    module2.exports = require_common()(exports2);
    var { formatters } = module2.exports;
    formatters.o = function (v) {
      this.inspectOpts.colors = this.useColors;
      return util
        .inspect(v, this.inspectOpts)
        .split('\n')
        .map((str) => str.trim())
        .join(' ');
    };
    formatters.O = function (v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts);
    };
  },
});

// node_modules/debug/src/index.js
var require_src = __commonJS({
  'node_modules/debug/src/index.js'(exports2, module2) {
    if (
      typeof process === 'undefined' ||
      process.type === 'renderer' ||
      process.browser === true ||
      process.__nwjs
    ) {
      module2.exports = require_browser();
    } else {
      module2.exports = require_node2();
    }
  },
});

// node_modules/follow-redirects/debug.js
var require_debug = __commonJS({
  'node_modules/follow-redirects/debug.js'(exports2, module2) {
    var debug;
    module2.exports = function () {
      if (!debug) {
        try {
          debug = require_src()('follow-redirects');
        } catch (error) {}
        if (typeof debug !== 'function') {
          debug = function () {};
        }
      }
      debug.apply(null, arguments);
    };
  },
});

// node_modules/follow-redirects/index.js
var require_follow_redirects = __commonJS({
  'node_modules/follow-redirects/index.js'(exports2, module2) {
    var url = require('url');
    var URL = url.URL;
    var http = require('http');
    var https = require('https');
    var Writable = require('stream').Writable;
    var assert = require('assert');
    var debug = require_debug();
    (function detectUnsupportedEnvironment() {
      var looksLikeNode = typeof process !== 'undefined';
      var looksLikeBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
      var looksLikeV8 = isFunction(Error.captureStackTrace);
      if (!looksLikeNode && (looksLikeBrowser || !looksLikeV8)) {
        console.warn('The follow-redirects package should be excluded from browser builds.');
      }
    })();
    var useNativeURL = false;
    try {
      assert(new URL(''));
    } catch (error) {
      useNativeURL = error.code === 'ERR_INVALID_URL';
    }
    var preservedUrlFields = [
      'auth',
      'host',
      'hostname',
      'href',
      'path',
      'pathname',
      'port',
      'protocol',
      'query',
      'search',
      'hash',
    ];
    var events = ['abort', 'aborted', 'connect', 'error', 'socket', 'timeout'];
    var eventHandlers = /* @__PURE__ */ Object.create(null);
    events.forEach(function (event) {
      eventHandlers[event] = function (arg1, arg2, arg3) {
        this._redirectable.emit(event, arg1, arg2, arg3);
      };
    });
    var InvalidUrlError = createErrorType('ERR_INVALID_URL', 'Invalid URL', TypeError);
    var RedirectionError = createErrorType(
      'ERR_FR_REDIRECTION_FAILURE',
      'Redirected request failed'
    );
    var TooManyRedirectsError = createErrorType(
      'ERR_FR_TOO_MANY_REDIRECTS',
      'Maximum number of redirects exceeded',
      RedirectionError
    );
    var MaxBodyLengthExceededError = createErrorType(
      'ERR_FR_MAX_BODY_LENGTH_EXCEEDED',
      'Request body larger than maxBodyLength limit'
    );
    var WriteAfterEndError = createErrorType('ERR_STREAM_WRITE_AFTER_END', 'write after end');
    var destroy = Writable.prototype.destroy || noop;
    function RedirectableRequest(options, responseCallback) {
      Writable.call(this);
      this._sanitizeOptions(options);
      this._options = options;
      this._ended = false;
      this._ending = false;
      this._redirectCount = 0;
      this._redirects = [];
      this._requestBodyLength = 0;
      this._requestBodyBuffers = [];
      if (responseCallback) {
        this.on('response', responseCallback);
      }
      var self2 = this;
      this._onNativeResponse = function (response) {
        try {
          self2._processResponse(response);
        } catch (cause) {
          self2.emit(
            'error',
            cause instanceof RedirectionError ? cause : new RedirectionError({ cause })
          );
        }
      };
      this._performRequest();
    }
    RedirectableRequest.prototype = Object.create(Writable.prototype);
    RedirectableRequest.prototype.abort = function () {
      destroyRequest(this._currentRequest);
      this._currentRequest.abort();
      this.emit('abort');
    };
    RedirectableRequest.prototype.destroy = function (error) {
      destroyRequest(this._currentRequest, error);
      destroy.call(this, error);
      return this;
    };
    RedirectableRequest.prototype.write = function (data, encoding, callback) {
      if (this._ending) {
        throw new WriteAfterEndError();
      }
      if (!isString(data) && !isBuffer(data)) {
        throw new TypeError('data should be a string, Buffer or Uint8Array');
      }
      if (isFunction(encoding)) {
        callback = encoding;
        encoding = null;
      }
      if (data.length === 0) {
        if (callback) {
          callback();
        }
        return;
      }
      if (this._requestBodyLength + data.length <= this._options.maxBodyLength) {
        this._requestBodyLength += data.length;
        this._requestBodyBuffers.push({ data, encoding });
        this._currentRequest.write(data, encoding, callback);
      } else {
        this.emit('error', new MaxBodyLengthExceededError());
        this.abort();
      }
    };
    RedirectableRequest.prototype.end = function (data, encoding, callback) {
      if (isFunction(data)) {
        callback = data;
        data = encoding = null;
      } else if (isFunction(encoding)) {
        callback = encoding;
        encoding = null;
      }
      if (!data) {
        this._ended = this._ending = true;
        this._currentRequest.end(null, null, callback);
      } else {
        var self2 = this;
        var currentRequest = this._currentRequest;
        this.write(data, encoding, function () {
          self2._ended = true;
          currentRequest.end(null, null, callback);
        });
        this._ending = true;
      }
    };
    RedirectableRequest.prototype.setHeader = function (name, value) {
      this._options.headers[name] = value;
      this._currentRequest.setHeader(name, value);
    };
    RedirectableRequest.prototype.removeHeader = function (name) {
      delete this._options.headers[name];
      this._currentRequest.removeHeader(name);
    };
    RedirectableRequest.prototype.setTimeout = function (msecs, callback) {
      var self2 = this;
      function destroyOnTimeout(socket) {
        socket.setTimeout(msecs);
        socket.removeListener('timeout', socket.destroy);
        socket.addListener('timeout', socket.destroy);
      }
      function startTimer(socket) {
        if (self2._timeout) {
          clearTimeout(self2._timeout);
        }
        self2._timeout = setTimeout(function () {
          self2.emit('timeout');
          clearTimer();
        }, msecs);
        destroyOnTimeout(socket);
      }
      function clearTimer() {
        if (self2._timeout) {
          clearTimeout(self2._timeout);
          self2._timeout = null;
        }
        self2.removeListener('abort', clearTimer);
        self2.removeListener('error', clearTimer);
        self2.removeListener('response', clearTimer);
        self2.removeListener('close', clearTimer);
        if (callback) {
          self2.removeListener('timeout', callback);
        }
        if (!self2.socket) {
          self2._currentRequest.removeListener('socket', startTimer);
        }
      }
      if (callback) {
        this.on('timeout', callback);
      }
      if (this.socket) {
        startTimer(this.socket);
      } else {
        this._currentRequest.once('socket', startTimer);
      }
      this.on('socket', destroyOnTimeout);
      this.on('abort', clearTimer);
      this.on('error', clearTimer);
      this.on('response', clearTimer);
      this.on('close', clearTimer);
      return this;
    };
    ['flushHeaders', 'getHeader', 'setNoDelay', 'setSocketKeepAlive'].forEach(function (method) {
      RedirectableRequest.prototype[method] = function (a, b) {
        return this._currentRequest[method](a, b);
      };
    });
    ['aborted', 'connection', 'socket'].forEach(function (property) {
      Object.defineProperty(RedirectableRequest.prototype, property, {
        get: function () {
          return this._currentRequest[property];
        },
      });
    });
    RedirectableRequest.prototype._sanitizeOptions = function (options) {
      if (!options.headers) {
        options.headers = {};
      }
      if (options.host) {
        if (!options.hostname) {
          options.hostname = options.host;
        }
        delete options.host;
      }
      if (!options.pathname && options.path) {
        var searchPos = options.path.indexOf('?');
        if (searchPos < 0) {
          options.pathname = options.path;
        } else {
          options.pathname = options.path.substring(0, searchPos);
          options.search = options.path.substring(searchPos);
        }
      }
    };
    RedirectableRequest.prototype._performRequest = function () {
      var protocol = this._options.protocol;
      var nativeProtocol = this._options.nativeProtocols[protocol];
      if (!nativeProtocol) {
        throw new TypeError('Unsupported protocol ' + protocol);
      }
      if (this._options.agents) {
        var scheme = protocol.slice(0, -1);
        this._options.agent = this._options.agents[scheme];
      }
      var request = (this._currentRequest = nativeProtocol.request(
        this._options,
        this._onNativeResponse
      ));
      request._redirectable = this;
      for (var event of events) {
        request.on(event, eventHandlers[event]);
      }
      this._currentUrl = /^\//.test(this._options.path)
        ? url.format(this._options)
        : // When making a request to a proxy, […]
          // a client MUST send the target URI in absolute-form […].
          this._options.path;
      if (this._isRedirect) {
        var i = 0;
        var self2 = this;
        var buffers = this._requestBodyBuffers;
        (function writeNext(error) {
          if (request === self2._currentRequest) {
            if (error) {
              self2.emit('error', error);
            } else if (i < buffers.length) {
              var buffer = buffers[i++];
              if (!request.finished) {
                request.write(buffer.data, buffer.encoding, writeNext);
              }
            } else if (self2._ended) {
              request.end();
            }
          }
        })();
      }
    };
    RedirectableRequest.prototype._processResponse = function (response) {
      var statusCode = response.statusCode;
      if (this._options.trackRedirects) {
        this._redirects.push({
          url: this._currentUrl,
          headers: response.headers,
          statusCode,
        });
      }
      var location = response.headers.location;
      if (
        !location ||
        this._options.followRedirects === false ||
        statusCode < 300 ||
        statusCode >= 400
      ) {
        response.responseUrl = this._currentUrl;
        response.redirects = this._redirects;
        this.emit('response', response);
        this._requestBodyBuffers = [];
        return;
      }
      destroyRequest(this._currentRequest);
      response.destroy();
      if (++this._redirectCount > this._options.maxRedirects) {
        throw new TooManyRedirectsError();
      }
      var requestHeaders;
      var beforeRedirect = this._options.beforeRedirect;
      if (beforeRedirect) {
        requestHeaders = Object.assign(
          {
            // The Host header was set by nativeProtocol.request
            Host: response.req.getHeader('host'),
          },
          this._options.headers
        );
      }
      var method = this._options.method;
      if (
        ((statusCode === 301 || statusCode === 302) && this._options.method === 'POST') || // RFC7231§6.4.4: The 303 (See Other) status code indicates that
        // the server is redirecting the user agent to a different resource […]
        // A user agent can perform a retrieval request targeting that URI
        // (a GET or HEAD request if using HTTP) […]
        (statusCode === 303 && !/^(?:GET|HEAD)$/.test(this._options.method))
      ) {
        this._options.method = 'GET';
        this._requestBodyBuffers = [];
        removeMatchingHeaders(/^content-/i, this._options.headers);
      }
      var currentHostHeader = removeMatchingHeaders(/^host$/i, this._options.headers);
      var currentUrlParts = parseUrl(this._currentUrl);
      var currentHost = currentHostHeader || currentUrlParts.host;
      var currentUrl = /^\w+:/.test(location)
        ? this._currentUrl
        : url.format(Object.assign(currentUrlParts, { host: currentHost }));
      var redirectUrl = resolveUrl(location, currentUrl);
      debug('redirecting to', redirectUrl.href);
      this._isRedirect = true;
      spreadUrlObject(redirectUrl, this._options);
      if (
        (redirectUrl.protocol !== currentUrlParts.protocol && redirectUrl.protocol !== 'https:') ||
        (redirectUrl.host !== currentHost && !isSubdomain(redirectUrl.host, currentHost))
      ) {
        removeMatchingHeaders(/^(?:(?:proxy-)?authorization|cookie)$/i, this._options.headers);
      }
      if (isFunction(beforeRedirect)) {
        var responseDetails = {
          headers: response.headers,
          statusCode,
        };
        var requestDetails = {
          url: currentUrl,
          method,
          headers: requestHeaders,
        };
        beforeRedirect(this._options, responseDetails, requestDetails);
        this._sanitizeOptions(this._options);
      }
      this._performRequest();
    };
    function wrap(protocols) {
      var exports3 = {
        maxRedirects: 21,
        maxBodyLength: 10 * 1024 * 1024,
      };
      var nativeProtocols = {};
      Object.keys(protocols).forEach(function (scheme) {
        var protocol = scheme + ':';
        var nativeProtocol = (nativeProtocols[protocol] = protocols[scheme]);
        var wrappedProtocol = (exports3[scheme] = Object.create(nativeProtocol));
        function request(input, options, callback) {
          if (isURL(input)) {
            input = spreadUrlObject(input);
          } else if (isString(input)) {
            input = spreadUrlObject(parseUrl(input));
          } else {
            callback = options;
            options = validateUrl(input);
            input = { protocol };
          }
          if (isFunction(options)) {
            callback = options;
            options = null;
          }
          options = Object.assign(
            {
              maxRedirects: exports3.maxRedirects,
              maxBodyLength: exports3.maxBodyLength,
            },
            input,
            options
          );
          options.nativeProtocols = nativeProtocols;
          if (!isString(options.host) && !isString(options.hostname)) {
            options.hostname = '::1';
          }
          assert.equal(options.protocol, protocol, 'protocol mismatch');
          debug('options', options);
          return new RedirectableRequest(options, callback);
        }
        function get(input, options, callback) {
          var wrappedRequest = wrappedProtocol.request(input, options, callback);
          wrappedRequest.end();
          return wrappedRequest;
        }
        Object.defineProperties(wrappedProtocol, {
          request: { value: request, configurable: true, enumerable: true, writable: true },
          get: { value: get, configurable: true, enumerable: true, writable: true },
        });
      });
      return exports3;
    }
    function noop() {}
    function parseUrl(input) {
      var parsed;
      if (useNativeURL) {
        parsed = new URL(input);
      } else {
        parsed = validateUrl(url.parse(input));
        if (!isString(parsed.protocol)) {
          throw new InvalidUrlError({ input });
        }
      }
      return parsed;
    }
    function resolveUrl(relative, base) {
      return useNativeURL ? new URL(relative, base) : parseUrl(url.resolve(base, relative));
    }
    function validateUrl(input) {
      if (/^\[/.test(input.hostname) && !/^\[[:0-9a-f]+\]$/i.test(input.hostname)) {
        throw new InvalidUrlError({ input: input.href || input });
      }
      if (/^\[/.test(input.host) && !/^\[[:0-9a-f]+\](:\d+)?$/i.test(input.host)) {
        throw new InvalidUrlError({ input: input.href || input });
      }
      return input;
    }
    function spreadUrlObject(urlObject, target) {
      var spread = target || {};
      for (var key of preservedUrlFields) {
        spread[key] = urlObject[key];
      }
      if (spread.hostname.startsWith('[')) {
        spread.hostname = spread.hostname.slice(1, -1);
      }
      if (spread.port !== '') {
        spread.port = Number(spread.port);
      }
      spread.path = spread.search ? spread.pathname + spread.search : spread.pathname;
      return spread;
    }
    function removeMatchingHeaders(regex, headers) {
      var lastValue;
      for (var header in headers) {
        if (regex.test(header)) {
          lastValue = headers[header];
          delete headers[header];
        }
      }
      return lastValue === null || typeof lastValue === 'undefined'
        ? void 0
        : String(lastValue).trim();
    }
    function createErrorType(code, message, baseClass) {
      function CustomError(properties) {
        if (isFunction(Error.captureStackTrace)) {
          Error.captureStackTrace(this, this.constructor);
        }
        Object.assign(this, properties || {});
        this.code = code;
        this.message = this.cause ? message + ': ' + this.cause.message : message;
      }
      CustomError.prototype = new (baseClass || Error)();
      Object.defineProperties(CustomError.prototype, {
        constructor: {
          value: CustomError,
          enumerable: false,
        },
        name: {
          value: 'Error [' + code + ']',
          enumerable: false,
        },
      });
      return CustomError;
    }
    function destroyRequest(request, error) {
      for (var event of events) {
        request.removeListener(event, eventHandlers[event]);
      }
      request.on('error', noop);
      request.destroy(error);
    }
    function isSubdomain(subdomain, domain) {
      assert(isString(subdomain) && isString(domain));
      var dot = subdomain.length - domain.length - 1;
      return dot > 0 && subdomain[dot] === '.' && subdomain.endsWith(domain);
    }
    function isString(value) {
      return typeof value === 'string' || value instanceof String;
    }
    function isFunction(value) {
      return typeof value === 'function';
    }
    function isBuffer(value) {
      return typeof value === 'object' && 'length' in value;
    }
    function isURL(value) {
      return URL && value instanceof URL;
    }
    module2.exports = wrap({ http, https });
    module2.exports.wrap = wrap;
  },
});

// node_modules/follow-redirects/http.js
var require_http = __commonJS({
  'node_modules/follow-redirects/http.js'(exports2, module2) {
    module2.exports = require_follow_redirects().http;
  },
});

// node_modules/follow-redirects/https.js
var require_https = __commonJS({
  'node_modules/follow-redirects/https.js'(exports2, module2) {
    module2.exports = require_follow_redirects().https;
  },
});

// node_modules/axios/lib/env/data.js
var require_data = __commonJS({
  'node_modules/axios/lib/env/data.js'(exports2, module2) {
    module2.exports = {
      version: '0.30.3',
    };
  },
});

// node_modules/axios/lib/helpers/fromDataURI.js
var require_fromDataURI = __commonJS({
  'node_modules/axios/lib/helpers/fromDataURI.js'(exports2, module2) {
    'use strict';
    var AxiosError = require_AxiosError();
    var parseProtocol = require_parseProtocol();
    var platform = require_platform();
    var DATA_URL_PATTERN = /^(?:([^;]+);)?(?:[^;]+;)?(base64|),([\s\S]*)$/;
    module2.exports = function fromDataURI(uri, asBlob, options) {
      var _Blob = (options && options.Blob) || platform.classes.Blob;
      var protocol = parseProtocol(uri);
      if (asBlob === void 0 && _Blob) {
        asBlob = true;
      }
      if (protocol === 'data') {
        uri = protocol.length ? uri.slice(protocol.length + 1) : uri;
        var match = DATA_URL_PATTERN.exec(uri);
        if (!match) {
          throw new AxiosError('Invalid URL', AxiosError.ERR_INVALID_URL);
        }
        var mime = match[1];
        var isBase64 = match[2];
        var body = match[3];
        var buffer = Buffer.from(decodeURIComponent(body), isBase64 ? 'base64' : 'utf8');
        if (asBlob) {
          if (!_Blob) {
            throw new AxiosError('Blob is not supported', AxiosError.ERR_NOT_SUPPORT);
          }
          return new _Blob([buffer], { type: mime });
        }
        return buffer;
      }
      throw new AxiosError('Unsupported protocol ' + protocol, AxiosError.ERR_NOT_SUPPORT);
    };
  },
});

// node_modules/axios/lib/helpers/estimateDataURLDecodedBytes.js
var require_estimateDataURLDecodedBytes = __commonJS({
  'node_modules/axios/lib/helpers/estimateDataURLDecodedBytes.js'(exports2, module2) {
    'use strict';
    function estimateDataURLDecodedBytes(url) {
      if (!url || typeof url !== 'string') return 0;
      if (!url.startsWith('data:')) return 0;
      var comma = url.indexOf(',');
      if (comma < 0) return 0;
      var meta = url.slice(5, comma);
      var body = url.slice(comma + 1);
      var isBase64 = /;base64/i.test(meta);
      if (isBase64) {
        let tailIsPct3D = function (j) {
          return (
            j >= 2 &&
            body.charCodeAt(j - 2) === 37 && // '%'
            body.charCodeAt(j - 1) === 51 && // '3'
            (body.charCodeAt(j) === 68 || body.charCodeAt(j) === 100)
          );
        };
        var effectiveLen = body.length;
        var len = body.length;
        for (var i = 0; i < len; i++) {
          if (body.charCodeAt(i) === 37 && i + 2 < len) {
            var a = body.charCodeAt(i + 1);
            var b = body.charCodeAt(i + 2);
            var isHex =
              ((a >= 48 && a <= 57) || (a >= 65 && a <= 70) || (a >= 97 && a <= 102)) &&
              ((b >= 48 && b <= 57) || (b >= 65 && b <= 70) || (b >= 97 && b <= 102));
            if (isHex) {
              effectiveLen -= 2;
              i += 2;
            }
          }
        }
        var pad = 0;
        var idx = len - 1;
        if (idx >= 0) {
          if (body.charCodeAt(idx) === 61) {
            pad++;
            idx--;
          } else if (tailIsPct3D(idx)) {
            pad++;
            idx -= 3;
          }
        }
        if (pad === 1 && idx >= 0) {
          if (body.charCodeAt(idx) === 61) {
            pad++;
          } else if (tailIsPct3D(idx)) {
            pad++;
          }
        }
        var groups = Math.floor(effectiveLen / 4);
        var bytes = groups * 3 - (pad || 0);
        return bytes > 0 ? bytes : 0;
      }
      return Buffer.byteLength(body, 'utf8');
    }
    module2.exports = estimateDataURLDecodedBytes;
  },
});

// node_modules/axios/lib/adapters/http.js
var require_http2 = __commonJS({
  'node_modules/axios/lib/adapters/http.js'(exports2, module2) {
    'use strict';
    var utils = require_utils();
    var settle = require_settle();
    var buildFullPath = require_buildFullPath();
    var buildURL = require_buildURL();
    var getProxyForUrl = require_proxy_from_env().getProxyForUrl;
    var http = require('http');
    var https = require('https');
    var httpFollow = require_http();
    var httpsFollow = require_https();
    var url = require('url');
    var zlib = require('zlib');
    var VERSION = require_data().version;
    var transitionalDefaults = require_transitional();
    var AxiosError = require_AxiosError();
    var CanceledError = require_CanceledError();
    var platform = require_platform();
    var fromDataURI = require_fromDataURI();
    var stream = require('stream');
    var estimateDataURLDecodedBytes = require_estimateDataURLDecodedBytes();
    var isHttps = /https:?/;
    var supportedProtocols = platform.protocols.map(function (protocol) {
      return protocol + ':';
    });
    function dispatchBeforeRedirect(options) {
      if (options.beforeRedirects.proxy) {
        options.beforeRedirects.proxy(options);
      }
      if (options.beforeRedirects.config) {
        options.beforeRedirects.config(options);
      }
    }
    function setProxy(options, configProxy, location) {
      var proxy = configProxy;
      if (!proxy && proxy !== false) {
        var proxyUrl = getProxyForUrl(location);
        if (proxyUrl) {
          proxy = url.parse(proxyUrl);
          proxy.host = proxy.hostname;
        }
      }
      if (proxy) {
        if (proxy.auth) {
          if (proxy.auth.username || proxy.auth.password) {
            proxy.auth = (proxy.auth.username || '') + ':' + (proxy.auth.password || '');
          }
          var base64 = Buffer.from(proxy.auth, 'utf8').toString('base64');
          options.headers['Proxy-Authorization'] = 'Basic ' + base64;
        }
        options.headers.host = options.hostname + (options.port ? ':' + options.port : '');
        options.hostname = proxy.host;
        options.host = proxy.host;
        options.port = proxy.port;
        options.path = location;
        if (proxy.protocol) {
          options.protocol = proxy.protocol;
        }
      }
      options.beforeRedirects.proxy = function beforeRedirect(redirectOptions) {
        setProxy(redirectOptions, configProxy, redirectOptions.href);
      };
    }
    module2.exports = function httpAdapter(config) {
      return new Promise(function dispatchHttpRequest(resolvePromise, rejectPromise) {
        var onCanceled;
        function done() {
          if (config.cancelToken) {
            config.cancelToken.unsubscribe(onCanceled);
          }
          if (config.signal) {
            config.signal.removeEventListener('abort', onCanceled);
          }
        }
        var resolve = function resolve2(value) {
          done();
          resolvePromise(value);
        };
        var rejected = false;
        var reject = function reject2(value) {
          done();
          rejected = true;
          rejectPromise(value);
        };
        var data = config.data;
        var responseType = config.responseType;
        var responseEncoding = config.responseEncoding;
        var method = config.method.toUpperCase();
        var fullPath = buildFullPath(config.baseURL, config.url, config.allowAbsoluteUrls);
        var parsed = url.parse(fullPath);
        var protocol = parsed.protocol || supportedProtocols[0];
        if (protocol === 'data:') {
          if (config.maxContentLength > -1) {
            var dataUrl = String(config.url || fullPath || '');
            var estimated = estimateDataURLDecodedBytes(dataUrl);
            if (estimated > config.maxContentLength) {
              return reject(
                new AxiosError(
                  'maxContentLength size of ' + config.maxContentLength + ' exceeded',
                  AxiosError.ERR_BAD_RESPONSE,
                  config
                )
              );
            }
          }
          var convertedData;
          if (method !== 'GET') {
            return settle(resolve, reject, {
              status: 405,
              statusText: 'method not allowed',
              headers: {},
              config,
            });
          }
          try {
            convertedData = fromDataURI(config.url, responseType === 'blob', {
              Blob: config.env && config.env.Blob,
            });
          } catch (err) {
            throw AxiosError.from(err, AxiosError.ERR_BAD_REQUEST, config);
          }
          if (responseType === 'text') {
            convertedData = convertedData.toString(responseEncoding);
            if (!responseEncoding || responseEncoding === 'utf8') {
              data = utils.stripBOM(convertedData);
            }
          } else if (responseType === 'stream') {
            convertedData = stream.Readable.from(convertedData);
          }
          return settle(resolve, reject, {
            data: convertedData,
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          });
        }
        if (supportedProtocols.indexOf(protocol) === -1) {
          return reject(
            new AxiosError('Unsupported protocol ' + protocol, AxiosError.ERR_BAD_REQUEST, config)
          );
        }
        var headers = config.headers;
        var headerNames = {};
        Object.keys(headers).forEach(function storeLowerName(name) {
          headerNames[name.toLowerCase()] = name;
        });
        if ('user-agent' in headerNames) {
          if (!headers[headerNames['user-agent']]) {
            delete headers[headerNames['user-agent']];
          }
        } else {
          headers['User-Agent'] = 'axios/' + VERSION;
        }
        if (utils.isFormData(data) && utils.isFunction(data.getHeaders)) {
          Object.assign(headers, data.getHeaders());
        } else if (data && !utils.isStream(data)) {
          if (Buffer.isBuffer(data)) {
          } else if (utils.isArrayBuffer(data)) {
            data = Buffer.from(new Uint8Array(data));
          } else if (utils.isString(data)) {
            data = Buffer.from(data, 'utf-8');
          } else {
            return reject(
              new AxiosError(
                'Data after transformation must be a string, an ArrayBuffer, a Buffer, or a Stream',
                AxiosError.ERR_BAD_REQUEST,
                config
              )
            );
          }
          if (config.maxBodyLength > -1 && data.length > config.maxBodyLength) {
            return reject(
              new AxiosError(
                'Request body larger than maxBodyLength limit',
                AxiosError.ERR_BAD_REQUEST,
                config
              )
            );
          }
          if (!headerNames['content-length']) {
            headers['Content-Length'] = data.length;
          }
        }
        var auth = void 0;
        if (config.auth) {
          var username = config.auth.username || '';
          var password = config.auth.password || '';
          auth = username + ':' + password;
        }
        if (!auth && parsed.auth) {
          var urlAuth = parsed.auth.split(':');
          var urlUsername = urlAuth[0] || '';
          var urlPassword = urlAuth[1] || '';
          auth = urlUsername + ':' + urlPassword;
        }
        if (auth && headerNames.authorization) {
          delete headers[headerNames.authorization];
        }
        try {
          buildURL(parsed.path, config.params, config.paramsSerializer).replace(/^\?/, '');
        } catch (err) {
          var customErr = new Error(err.message);
          customErr.config = config;
          customErr.url = config.url;
          customErr.exists = true;
          reject(customErr);
        }
        var options = {
          path: buildURL(parsed.path, config.params, config.paramsSerializer).replace(/^\?/, ''),
          method,
          headers,
          agents: { http: config.httpAgent, https: config.httpsAgent },
          auth,
          protocol,
          beforeRedirect: dispatchBeforeRedirect,
          beforeRedirects: {},
        };
        if (config.socketPath) {
          options.socketPath = config.socketPath;
        } else {
          options.hostname = parsed.hostname;
          options.port = parsed.port;
          setProxy(
            options,
            config.proxy,
            protocol +
              '//' +
              parsed.hostname +
              (parsed.port ? ':' + parsed.port : '') +
              options.path
          );
        }
        var transport;
        var isHttpsRequest = isHttps.test(options.protocol);
        options.agent = isHttpsRequest ? config.httpsAgent : config.httpAgent;
        if (config.transport) {
          transport = config.transport;
        } else if (config.maxRedirects === 0) {
          transport = isHttpsRequest ? https : http;
        } else {
          if (config.maxRedirects) {
            options.maxRedirects = config.maxRedirects;
          }
          if (config.beforeRedirect) {
            options.beforeRedirects.config = config.beforeRedirect;
          }
          transport = isHttpsRequest ? httpsFollow : httpFollow;
        }
        if (config.maxBodyLength > -1) {
          options.maxBodyLength = config.maxBodyLength;
        } else {
          options.maxBodyLength = Infinity;
        }
        if (config.insecureHTTPParser) {
          options.insecureHTTPParser = config.insecureHTTPParser;
        }
        var req = transport.request(options, function handleResponse(res) {
          if (req.aborted) return;
          var responseStream = res;
          var lastRequest = res.req || req;
          if (config.decompress !== false) {
            if (data && data.length === 0 && res.headers['content-encoding']) {
              delete res.headers['content-encoding'];
            }
            switch (res.headers['content-encoding']) {
              /*eslint default-case:0*/
              case 'gzip':
              case 'compress':
              case 'deflate':
                responseStream = responseStream.pipe(zlib.createUnzip());
                delete res.headers['content-encoding'];
                break;
            }
          }
          var response = {
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
            config,
            request: lastRequest,
          };
          if (responseType === 'stream') {
            response.data = responseStream;
            settle(resolve, reject, response);
          } else {
            var responseBuffer = [];
            var totalResponseBytes = 0;
            responseStream.on('data', function handleStreamData(chunk) {
              responseBuffer.push(chunk);
              totalResponseBytes += chunk.length;
              if (config.maxContentLength > -1 && totalResponseBytes > config.maxContentLength) {
                rejected = true;
                responseStream.destroy();
                reject(
                  new AxiosError(
                    'maxContentLength size of ' + config.maxContentLength + ' exceeded',
                    AxiosError.ERR_BAD_RESPONSE,
                    config,
                    lastRequest
                  )
                );
              }
            });
            responseStream.on('aborted', function handlerStreamAborted() {
              if (rejected) {
                return;
              }
              responseStream.destroy();
              reject(
                new AxiosError(
                  'response stream aborted',
                  AxiosError.ECONNABORTED,
                  config,
                  lastRequest
                )
              );
            });
            responseStream.on('error', function handleStreamError(err) {
              if (req.aborted) return;
              reject(AxiosError.from(err, null, config, lastRequest));
            });
            responseStream.on('end', function handleStreamEnd() {
              try {
                var responseData =
                  responseBuffer.length === 1 ? responseBuffer[0] : Buffer.concat(responseBuffer);
                if (responseType !== 'arraybuffer') {
                  responseData = responseData.toString(responseEncoding);
                  if (!responseEncoding || responseEncoding === 'utf8') {
                    responseData = utils.stripBOM(responseData);
                  }
                }
                response.data = responseData;
              } catch (err) {
                reject(AxiosError.from(err, null, config, response.request, response));
              }
              settle(resolve, reject, response);
            });
          }
        });
        req.on('error', function handleRequestError(err) {
          reject(AxiosError.from(err, null, config, req));
        });
        req.on('socket', function handleRequestSocket(socket) {
          socket.setKeepAlive(true, 1e3 * 60);
        });
        if (config.timeout) {
          var timeout = parseInt(config.timeout, 10);
          if (isNaN(timeout)) {
            reject(
              new AxiosError(
                'error trying to parse `config.timeout` to int',
                AxiosError.ERR_BAD_OPTION_VALUE,
                config,
                req
              )
            );
            return;
          }
          req.setTimeout(timeout, function handleRequestTimeout() {
            req.abort();
            var timeoutErrorMessage = config.timeout
              ? 'timeout of ' + config.timeout + 'ms exceeded'
              : 'timeout exceeded';
            var transitional = config.transitional || transitionalDefaults;
            if (config.timeoutErrorMessage) {
              timeoutErrorMessage = config.timeoutErrorMessage;
            }
            reject(
              new AxiosError(
                timeoutErrorMessage,
                transitional.clarifyTimeoutError ? AxiosError.ETIMEDOUT : AxiosError.ECONNABORTED,
                config,
                req
              )
            );
          });
        }
        if (config.cancelToken || config.signal) {
          onCanceled = function (cancel) {
            if (req.aborted) return;
            req.abort();
            reject(!cancel || cancel.type ? new CanceledError(null, config, req) : cancel);
          };
          config.cancelToken && config.cancelToken.subscribe(onCanceled);
          if (config.signal) {
            config.signal.aborted
              ? onCanceled()
              : config.signal.addEventListener('abort', onCanceled);
          }
        }
        if (utils.isStream(data)) {
          data
            .on('error', function handleStreamError(err) {
              reject(AxiosError.from(err, config, null, req));
            })
            .pipe(req);
        } else {
          req.end(data);
        }
      });
    };
  },
});

// node_modules/axios/lib/defaults/index.js
var require_defaults = __commonJS({
  'node_modules/axios/lib/defaults/index.js'(exports2, module2) {
    'use strict';
    var utils = require_utils();
    var normalizeHeaderName = require_normalizeHeaderName();
    var AxiosError = require_AxiosError();
    var transitionalDefaults = require_transitional();
    var toFormData = require_toFormData();
    var toURLEncodedForm = require_toURLEncodedForm();
    var platform = require_platform();
    var formDataToJSON = require_formDataToJSON();
    var DEFAULT_CONTENT_TYPE = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    function setContentTypeIfUnset(headers, value) {
      if (!utils.isUndefined(headers) && utils.isUndefined(headers['Content-Type'])) {
        headers['Content-Type'] = value;
      }
    }
    function getDefaultAdapter() {
      var adapter;
      if (typeof XMLHttpRequest !== 'undefined') {
        adapter = require_xhr();
      } else if (
        typeof process !== 'undefined' &&
        Object.prototype.toString.call(process) === '[object process]'
      ) {
        adapter = require_http2();
      }
      return adapter;
    }
    function stringifySafely(rawValue, parser, encoder) {
      if (utils.isString(rawValue)) {
        try {
          (parser || JSON.parse)(rawValue);
          return utils.trim(rawValue);
        } catch (e) {
          if (e.name !== 'SyntaxError') {
            throw e;
          }
        }
      }
      return (encoder || JSON.stringify)(rawValue);
    }
    var defaults = {
      transitional: transitionalDefaults,
      adapter: getDefaultAdapter(),
      transformRequest: [
        function transformRequest(data, headers) {
          normalizeHeaderName(headers, 'Accept');
          normalizeHeaderName(headers, 'Content-Type');
          var contentType = (headers && headers['Content-Type']) || '';
          var hasJSONContentType = contentType.indexOf('application/json') > -1;
          var isObjectPayload = utils.isObject(data);
          if (isObjectPayload && utils.isHTMLForm(data)) {
            data = new FormData(data);
          }
          var isFormData = utils.isFormData(data);
          if (isFormData) {
            return hasJSONContentType ? JSON.stringify(formDataToJSON(data)) : data;
          }
          if (
            utils.isArrayBuffer(data) ||
            utils.isBuffer(data) ||
            utils.isStream(data) ||
            utils.isFile(data) ||
            utils.isBlob(data)
          ) {
            return data;
          }
          if (utils.isArrayBufferView(data)) {
            return data.buffer;
          }
          if (utils.isURLSearchParams(data)) {
            setContentTypeIfUnset(headers, 'application/x-www-form-urlencoded;charset=utf-8');
            return data.toString();
          }
          var isFileList;
          if (isObjectPayload) {
            if (contentType.indexOf('application/x-www-form-urlencoded') !== -1) {
              return toURLEncodedForm(data, this.formSerializer).toString();
            }
            if (
              (isFileList = utils.isFileList(data)) ||
              contentType.indexOf('multipart/form-data') > -1
            ) {
              var _FormData = this.env && this.env.FormData;
              return toFormData(
                isFileList ? { 'files[]': data } : data,
                _FormData && new _FormData(),
                this.formSerializer
              );
            }
          }
          if (isObjectPayload || hasJSONContentType) {
            setContentTypeIfUnset(headers, 'application/json');
            return stringifySafely(data);
          }
          return data;
        },
      ],
      transformResponse: [
        function transformResponse(data) {
          var transitional = this.transitional || defaults.transitional;
          var forcedJSONParsing = transitional && transitional.forcedJSONParsing;
          var JSONRequested = this.responseType === 'json';
          if (
            data &&
            utils.isString(data) &&
            ((forcedJSONParsing && !this.responseType) || JSONRequested)
          ) {
            var silentJSONParsing = transitional && transitional.silentJSONParsing;
            var strictJSONParsing = !silentJSONParsing && JSONRequested;
            try {
              return JSON.parse(data);
            } catch (e) {
              if (strictJSONParsing) {
                if (e.name === 'SyntaxError') {
                  throw AxiosError.from(e, AxiosError.ERR_BAD_RESPONSE, this, null, this.response);
                }
                throw e;
              }
            }
          }
          return data;
        },
      ],
      /**
       * A timeout in milliseconds to abort a request. If set to 0 (default) a
       * timeout is not created.
       */
      timeout: 0,
      xsrfCookieName: 'XSRF-TOKEN',
      xsrfHeaderName: 'X-XSRF-TOKEN',
      maxContentLength: -1,
      maxBodyLength: -1,
      env: {
        FormData: platform.classes.FormData,
        Blob: platform.classes.Blob,
      },
      validateStatus: function validateStatus(status) {
        return status >= 200 && status < 300;
      },
      headers: {
        common: {
          Accept: 'application/json, text/plain, */*',
        },
      },
    };
    utils.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
      defaults.headers[method] = {};
    });
    utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
      defaults.headers[method] = utils.merge(DEFAULT_CONTENT_TYPE);
    });
    module2.exports = defaults;
  },
});

// node_modules/axios/lib/core/transformData.js
var require_transformData = __commonJS({
  'node_modules/axios/lib/core/transformData.js'(exports2, module2) {
    'use strict';
    var utils = require_utils();
    var defaults = require_defaults();
    module2.exports = function transformData(data, headers, status, fns) {
      var context = this || defaults;
      utils.forEach(fns, function transform(fn) {
        data = fn.call(context, data, headers, status);
      });
      return data;
    };
  },
});

// node_modules/axios/lib/cancel/isCancel.js
var require_isCancel = __commonJS({
  'node_modules/axios/lib/cancel/isCancel.js'(exports2, module2) {
    'use strict';
    module2.exports = function isCancel(value) {
      return !!(value && value.__CANCEL__);
    };
  },
});

// node_modules/axios/lib/core/dispatchRequest.js
var require_dispatchRequest = __commonJS({
  'node_modules/axios/lib/core/dispatchRequest.js'(exports2, module2) {
    'use strict';
    var utils = require_utils();
    var transformData = require_transformData();
    var isCancel = require_isCancel();
    var defaults = require_defaults();
    var CanceledError = require_CanceledError();
    var normalizeHeaderName = require_normalizeHeaderName();
    function throwIfCancellationRequested(config) {
      if (config.cancelToken) {
        config.cancelToken.throwIfRequested();
      }
      if (config.signal && config.signal.aborted) {
        throw new CanceledError();
      }
    }
    module2.exports = function dispatchRequest(config) {
      throwIfCancellationRequested(config);
      config.headers = config.headers || {};
      config.data = transformData.call(
        config,
        config.data,
        config.headers,
        null,
        config.transformRequest
      );
      normalizeHeaderName(config.headers, 'Accept');
      normalizeHeaderName(config.headers, 'Content-Type');
      config.headers = utils.merge(
        config.headers.common || {},
        config.headers[config.method] || {},
        config.headers
      );
      utils.forEach(
        ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
        function cleanHeaderConfig(method) {
          delete config.headers[method];
        }
      );
      var adapter = config.adapter || defaults.adapter;
      return adapter(config).then(
        function onAdapterResolution(response) {
          throwIfCancellationRequested(config);
          response.data = transformData.call(
            config,
            response.data,
            response.headers,
            response.status,
            config.transformResponse
          );
          return response;
        },
        function onAdapterRejection(reason) {
          if (!isCancel(reason)) {
            throwIfCancellationRequested(config);
            if (reason && reason.response) {
              reason.response.data = transformData.call(
                config,
                reason.response.data,
                reason.response.headers,
                reason.response.status,
                config.transformResponse
              );
            }
          }
          return Promise.reject(reason);
        }
      );
    };
  },
});

// node_modules/axios/lib/core/mergeConfig.js
var require_mergeConfig = __commonJS({
  'node_modules/axios/lib/core/mergeConfig.js'(exports2, module2) {
    'use strict';
    var utils = require_utils();
    module2.exports = function mergeConfig(config1, config2) {
      config2 = config2 || {};
      var config = {};
      function getMergedValue(target, source) {
        if (utils.isPlainObject(target) && utils.isPlainObject(source)) {
          return utils.merge(target, source);
        } else if (utils.isEmptyObject(source)) {
          return utils.merge({}, target);
        } else if (utils.isPlainObject(source)) {
          return utils.merge({}, source);
        } else if (utils.isArray(source)) {
          return source.slice();
        }
        return source;
      }
      function mergeDeepProperties(prop) {
        if (!utils.isUndefined(config2[prop])) {
          return getMergedValue(config1[prop], config2[prop]);
        } else if (!utils.isUndefined(config1[prop])) {
          return getMergedValue(void 0, config1[prop]);
        }
      }
      function valueFromConfig2(prop) {
        if (!utils.isUndefined(config2[prop])) {
          return getMergedValue(void 0, config2[prop]);
        }
      }
      function defaultToConfig2(prop) {
        if (!utils.isUndefined(config2[prop])) {
          return getMergedValue(void 0, config2[prop]);
        } else if (!utils.isUndefined(config1[prop])) {
          return getMergedValue(void 0, config1[prop]);
        }
      }
      function mergeDirectKeys(prop) {
        if (prop in config2) {
          return getMergedValue(config1[prop], config2[prop]);
        } else if (prop in config1) {
          return getMergedValue(void 0, config1[prop]);
        }
      }
      var mergeMap = {
        url: valueFromConfig2,
        method: valueFromConfig2,
        data: valueFromConfig2,
        baseURL: defaultToConfig2,
        transformRequest: defaultToConfig2,
        transformResponse: defaultToConfig2,
        paramsSerializer: defaultToConfig2,
        timeout: defaultToConfig2,
        timeoutMessage: defaultToConfig2,
        withCredentials: defaultToConfig2,
        withXSRFToken: defaultToConfig2,
        adapter: defaultToConfig2,
        responseType: defaultToConfig2,
        xsrfCookieName: defaultToConfig2,
        xsrfHeaderName: defaultToConfig2,
        onUploadProgress: defaultToConfig2,
        onDownloadProgress: defaultToConfig2,
        decompress: defaultToConfig2,
        maxContentLength: defaultToConfig2,
        maxBodyLength: defaultToConfig2,
        beforeRedirect: defaultToConfig2,
        transport: defaultToConfig2,
        httpAgent: defaultToConfig2,
        httpsAgent: defaultToConfig2,
        cancelToken: defaultToConfig2,
        socketPath: defaultToConfig2,
        responseEncoding: defaultToConfig2,
        validateStatus: mergeDirectKeys,
      };
      utils.forEach(
        Object.keys(config1).concat(Object.keys(config2)),
        function computeConfigValue(prop) {
          if (prop === '__proto__' || prop === 'constructor' || prop === 'prototype') {
            return;
          }
          var merge = utils.hasOwnProperty(mergeMap, prop) ? mergeMap[prop] : mergeDeepProperties;
          var configValue = merge(prop);
          (utils.isUndefined(configValue) && merge !== mergeDirectKeys) ||
            (config[prop] = configValue);
        }
      );
      return config;
    };
  },
});

// node_modules/axios/lib/helpers/validator.js
var require_validator = __commonJS({
  'node_modules/axios/lib/helpers/validator.js'(exports2, module2) {
    'use strict';
    var VERSION = require_data().version;
    var AxiosError = require_AxiosError();
    var validators = {};
    ['object', 'boolean', 'number', 'function', 'string', 'symbol'].forEach(function (type, i) {
      validators[type] = function validator(thing) {
        return typeof thing === type || 'a' + (i < 1 ? 'n ' : ' ') + type;
      };
    });
    var deprecatedWarnings = {};
    validators.transitional = function transitional(validator, version, message) {
      function formatMessage(opt, desc) {
        return (
          '[Axios v' +
          VERSION +
          "] Transitional option '" +
          opt +
          "'" +
          desc +
          (message ? '. ' + message : '')
        );
      }
      return function (value, opt, opts) {
        if (validator === false) {
          throw new AxiosError(
            formatMessage(opt, ' has been removed' + (version ? ' in ' + version : '')),
            AxiosError.ERR_DEPRECATED
          );
        }
        if (version && !deprecatedWarnings[opt]) {
          deprecatedWarnings[opt] = true;
          console.warn(
            formatMessage(
              opt,
              ' has been deprecated since v' + version + ' and will be removed in the near future'
            )
          );
        }
        return validator ? validator(value, opt, opts) : true;
      };
    };
    function assertOptions(options, schema, allowUnknown) {
      if (typeof options !== 'object') {
        throw new AxiosError('options must be an object', AxiosError.ERR_BAD_OPTION_VALUE);
      }
      var keys = Object.keys(options);
      var i = keys.length;
      while (i-- > 0) {
        var opt = keys[i];
        var validator = schema[opt];
        if (validator) {
          var value = options[opt];
          var result = value === void 0 || validator(value, opt, options);
          if (result !== true) {
            throw new AxiosError(
              'option ' + opt + ' must be ' + result,
              AxiosError.ERR_BAD_OPTION_VALUE
            );
          }
          continue;
        }
        if (allowUnknown !== true) {
          throw new AxiosError('Unknown option ' + opt, AxiosError.ERR_BAD_OPTION);
        }
      }
    }
    module2.exports = {
      assertOptions,
      validators,
    };
  },
});

// node_modules/axios/lib/core/Axios.js
var require_Axios = __commonJS({
  'node_modules/axios/lib/core/Axios.js'(exports2, module2) {
    'use strict';
    var utils = require_utils();
    var buildURL = require_buildURL();
    var InterceptorManager = require_InterceptorManager();
    var dispatchRequest = require_dispatchRequest();
    var mergeConfig = require_mergeConfig();
    var buildFullPath = require_buildFullPath();
    var validator = require_validator();
    var validators = validator.validators;
    function Axios(instanceConfig) {
      this.defaults = instanceConfig;
      this.interceptors = {
        request: new InterceptorManager(),
        response: new InterceptorManager(),
      };
    }
    Axios.prototype.request = function request(configOrUrl, config) {
      if (typeof configOrUrl === 'string') {
        config = config || {};
        config.url = configOrUrl;
      } else {
        config = configOrUrl || {};
      }
      config = mergeConfig(this.defaults, config);
      if (config.method) {
        config.method = config.method.toLowerCase();
      } else if (this.defaults.method) {
        config.method = this.defaults.method.toLowerCase();
      } else {
        config.method = 'get';
      }
      var transitional = config.transitional;
      if (transitional !== void 0) {
        validator.assertOptions(
          transitional,
          {
            silentJSONParsing: validators.transitional(validators.boolean),
            forcedJSONParsing: validators.transitional(validators.boolean),
            clarifyTimeoutError: validators.transitional(validators.boolean),
          },
          false
        );
      }
      var paramsSerializer = config.paramsSerializer;
      if (paramsSerializer != null) {
        if (utils.isFunction(paramsSerializer)) {
          config.paramsSerializer = {
            serialize: paramsSerializer,
          };
        } else {
          validator.assertOptions(
            paramsSerializer,
            {
              encode: validators.function,
              serialize: validators.function,
            },
            true
          );
        }
      }
      var requestInterceptorChain = [];
      var synchronousRequestInterceptors = true;
      this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
        if (typeof interceptor.runWhen === 'function' && interceptor.runWhen(config) === false) {
          return;
        }
        synchronousRequestInterceptors = synchronousRequestInterceptors && interceptor.synchronous;
        requestInterceptorChain.unshift(interceptor.fulfilled, interceptor.rejected);
      });
      var responseInterceptorChain = [];
      this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
        responseInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
      });
      var promise;
      if (!synchronousRequestInterceptors) {
        var chain = [dispatchRequest, void 0];
        Array.prototype.unshift.apply(chain, requestInterceptorChain);
        chain = chain.concat(responseInterceptorChain);
        promise = Promise.resolve(config);
        while (chain.length) {
          promise = promise.then(chain.shift(), chain.shift());
        }
        return promise;
      }
      var newConfig = config;
      while (requestInterceptorChain.length) {
        var onFulfilled = requestInterceptorChain.shift();
        var onRejected = requestInterceptorChain.shift();
        try {
          newConfig = onFulfilled(newConfig);
        } catch (error) {
          onRejected(error);
          break;
        }
      }
      try {
        promise = dispatchRequest(newConfig);
      } catch (error) {
        return Promise.reject(error);
      }
      while (responseInterceptorChain.length) {
        promise = promise.then(responseInterceptorChain.shift(), responseInterceptorChain.shift());
      }
      return promise;
    };
    Axios.prototype.getUri = function getUri(config) {
      config = mergeConfig(this.defaults, config);
      var fullPath = buildFullPath(config.baseURL, config.url, config.allowAbsoluteUrls);
      return buildURL(fullPath, config.params, config.paramsSerializer);
    };
    utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
      Axios.prototype[method] = function (url, config) {
        return this.request(
          mergeConfig(config || {}, {
            method,
            url,
            data: (config || {}).data,
          })
        );
      };
    });
    utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
      function generateHTTPMethod(isForm) {
        return function httpMethod(url, data, config) {
          return this.request(
            mergeConfig(config || {}, {
              method,
              headers: isForm
                ? {
                    'Content-Type': 'multipart/form-data',
                  }
                : {},
              url,
              data,
            })
          );
        };
      }
      Axios.prototype[method] = generateHTTPMethod();
      Axios.prototype[method + 'Form'] = generateHTTPMethod(true);
    });
    module2.exports = Axios;
  },
});

// node_modules/axios/lib/cancel/CancelToken.js
var require_CancelToken = __commonJS({
  'node_modules/axios/lib/cancel/CancelToken.js'(exports2, module2) {
    'use strict';
    var CanceledError = require_CanceledError();
    function CancelToken(executor) {
      if (typeof executor !== 'function') {
        throw new TypeError('executor must be a function.');
      }
      var resolvePromise;
      this.promise = new Promise(function promiseExecutor(resolve) {
        resolvePromise = resolve;
      });
      var token = this;
      this.promise.then(function (cancel) {
        if (!token._listeners) return;
        var i = token._listeners.length;
        while (i-- > 0) {
          token._listeners[i](cancel);
        }
        token._listeners = null;
      });
      this.promise.then = function (onfulfilled) {
        var _resolve;
        var promise = new Promise(function (resolve) {
          token.subscribe(resolve);
          _resolve = resolve;
        }).then(onfulfilled);
        promise.cancel = function reject() {
          token.unsubscribe(_resolve);
        };
        return promise;
      };
      executor(function cancel(message, config, request) {
        if (token.reason) {
          return;
        }
        token.reason = new CanceledError(message, config, request);
        resolvePromise(token.reason);
      });
    }
    CancelToken.prototype.throwIfRequested = function throwIfRequested() {
      if (this.reason) {
        throw this.reason;
      }
    };
    CancelToken.prototype.subscribe = function subscribe(listener) {
      if (this.reason) {
        listener(this.reason);
        return;
      }
      if (this._listeners) {
        this._listeners.push(listener);
      } else {
        this._listeners = [listener];
      }
    };
    CancelToken.prototype.unsubscribe = function unsubscribe(listener) {
      if (!this._listeners) {
        return;
      }
      var index = this._listeners.indexOf(listener);
      if (index !== -1) {
        this._listeners.splice(index, 1);
      }
    };
    CancelToken.source = function source() {
      var cancel;
      var token = new CancelToken(function executor(c) {
        cancel = c;
      });
      return {
        token,
        cancel,
      };
    };
    module2.exports = CancelToken;
  },
});

// node_modules/axios/lib/helpers/spread.js
var require_spread = __commonJS({
  'node_modules/axios/lib/helpers/spread.js'(exports2, module2) {
    'use strict';
    module2.exports = function spread(callback) {
      return function wrap(arr) {
        return callback.apply(null, arr);
      };
    };
  },
});

// node_modules/axios/lib/helpers/isAxiosError.js
var require_isAxiosError = __commonJS({
  'node_modules/axios/lib/helpers/isAxiosError.js'(exports2, module2) {
    'use strict';
    var utils = require_utils();
    module2.exports = function isAxiosError(payload) {
      return utils.isObject(payload) && payload.isAxiosError === true;
    };
  },
});

// node_modules/axios/lib/axios.js
var require_axios = __commonJS({
  'node_modules/axios/lib/axios.js'(exports2, module2) {
    'use strict';
    var utils = require_utils();
    var bind = require_bind();
    var Axios = require_Axios();
    var mergeConfig = require_mergeConfig();
    var defaults = require_defaults();
    var formDataToJSON = require_formDataToJSON();
    function createInstance(defaultConfig) {
      var context = new Axios(defaultConfig);
      var instance = bind(Axios.prototype.request, context);
      utils.extend(instance, Axios.prototype, context);
      utils.extend(instance, context);
      instance.create = function create(instanceConfig) {
        return createInstance(mergeConfig(defaultConfig, instanceConfig));
      };
      return instance;
    }
    var axios = createInstance(defaults);
    axios.Axios = Axios;
    axios.CanceledError = require_CanceledError();
    axios.CancelToken = require_CancelToken();
    axios.isCancel = require_isCancel();
    axios.VERSION = require_data().version;
    axios.toFormData = require_toFormData();
    axios.AxiosError = require_AxiosError();
    axios.Cancel = axios.CanceledError;
    axios.all = function all(promises) {
      return Promise.all(promises);
    };
    axios.spread = require_spread();
    axios.isAxiosError = require_isAxiosError();
    axios.formToJSON = function (thing) {
      return formDataToJSON(utils.isHTMLForm(thing) ? new FormData(thing) : thing);
    };
    module2.exports = axios;
    module2.exports.default = axios;
  },
});

// node_modules/axios/index.js
var require_axios2 = __commonJS({
  'node_modules/axios/index.js'(exports2, module2) {
    module2.exports = require_axios();
  },
});

// node_modules/hot-patcher/dist/functions.js
var require_functions = __commonJS({
  'node_modules/hot-patcher/dist/functions.js'(exports2) {
    'use strict';
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.sequence = void 0;
    function sequence() {
      var methods = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        methods[_i] = arguments[_i];
      }
      if (methods.length === 0) {
        throw new Error('Failed creating sequence: No functions provided');
      }
      return function __executeSequence() {
        var args = [];
        for (var _i2 = 0; _i2 < arguments.length; _i2++) {
          args[_i2] = arguments[_i2];
        }
        var result = args;
        var _this = this;
        while (methods.length > 0) {
          var method = methods.shift();
          result = [method.apply(_this, result)];
        }
        return result[0];
      };
    }
    exports2.sequence = sequence;
  },
});

// node_modules/hot-patcher/dist/patcher.js
var require_patcher = __commonJS({
  'node_modules/hot-patcher/dist/patcher.js'(exports2) {
    'use strict';
    var __spreadArray =
      (exports2 && exports2.__spreadArray) ||
      function (to, from, pack) {
        if (pack || arguments.length === 2)
          for (var i = 0, l = from.length, ar; i < l; i++) {
            if (ar || !(i in from)) {
              if (!ar) ar = Array.prototype.slice.call(from, 0, i);
              ar[i] = from[i];
            }
          }
        return to.concat(ar || Array.prototype.slice.call(from));
      };
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.HotPatcher = void 0;
    var functions_1 = require_functions();
    var HOT_PATCHER_TYPE = '@@HOTPATCHER';
    var NOOP = function () {};
    function createNewItem(method) {
      return {
        original: method,
        methods: [method],
        final: false,
      };
    }
    var HotPatcher =
      /** @class */
      (function () {
        function HotPatcher2() {
          this._configuration = {
            registry: {},
            getEmptyAction: 'null',
          };
          this.__type__ = HOT_PATCHER_TYPE;
        }
        Object.defineProperty(HotPatcher2.prototype, 'configuration', {
          /**
           * Configuration object reference
           * @readonly
           */
          get: function () {
            return this._configuration;
          },
          enumerable: false,
          configurable: true,
        });
        Object.defineProperty(HotPatcher2.prototype, 'getEmptyAction', {
          /**
           * The action to take when a non-set method is requested
           * Possible values: null/throw
           */
          get: function () {
            return this.configuration.getEmptyAction;
          },
          set: function (newAction) {
            this.configuration.getEmptyAction = newAction;
          },
          enumerable: false,
          configurable: true,
        });
        HotPatcher2.prototype.control = function (target, allowTargetOverrides) {
          var _this = this;
          if (allowTargetOverrides === void 0) {
            allowTargetOverrides = false;
          }
          if (!target || target.__type__ !== HOT_PATCHER_TYPE) {
            throw new Error(
              'Failed taking control of target HotPatcher instance: Invalid type or object'
            );
          }
          Object.keys(target.configuration.registry).forEach(function (foreignKey) {
            if (_this.configuration.registry.hasOwnProperty(foreignKey)) {
              if (allowTargetOverrides) {
                _this.configuration.registry[foreignKey] = Object.assign(
                  {},
                  target.configuration.registry[foreignKey]
                );
              }
            } else {
              _this.configuration.registry[foreignKey] = Object.assign(
                {},
                target.configuration.registry[foreignKey]
              );
            }
          });
          target._configuration = this.configuration;
          return this;
        };
        HotPatcher2.prototype.execute = function (key) {
          var args = [];
          for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
          }
          var method = this.get(key) || NOOP;
          return method.apply(void 0, args);
        };
        HotPatcher2.prototype.get = function (key) {
          var item = this.configuration.registry[key];
          if (!item) {
            switch (this.getEmptyAction) {
              case 'null':
                return null;
              case 'throw':
                throw new Error(
                  'Failed handling method request: No method provided for override: '.concat(key)
                );
              default:
                throw new Error(
                  'Failed handling request which resulted in an empty method: Invalid empty-action specified: '.concat(
                    this.getEmptyAction
                  )
                );
            }
          }
          return functions_1.sequence.apply(void 0, item.methods);
        };
        HotPatcher2.prototype.isPatched = function (key) {
          return !!this.configuration.registry[key];
        };
        HotPatcher2.prototype.patch = function (key, method, opts) {
          if (opts === void 0) {
            opts = {};
          }
          var _a = opts.chain,
            chain = _a === void 0 ? false : _a;
          if (this.configuration.registry[key] && this.configuration.registry[key].final) {
            throw new Error("Failed patching '".concat(key, "': Method marked as being final"));
          }
          if (typeof method !== 'function') {
            throw new Error(
              "Failed patching '".concat(key, "': Provided method is not a function")
            );
          }
          if (chain) {
            if (!this.configuration.registry[key]) {
              this.configuration.registry[key] = createNewItem(method);
            } else {
              this.configuration.registry[key].methods.push(method);
            }
          } else {
            if (this.isPatched(key)) {
              var original = this.configuration.registry[key].original;
              this.configuration.registry[key] = Object.assign(createNewItem(method), {
                original,
              });
            } else {
              this.configuration.registry[key] = createNewItem(method);
            }
          }
          return this;
        };
        HotPatcher2.prototype.patchInline = function (key, method) {
          var args = [];
          for (var _i = 2; _i < arguments.length; _i++) {
            args[_i - 2] = arguments[_i];
          }
          if (!this.isPatched(key)) {
            this.patch(key, method);
          }
          return this.execute.apply(this, __spreadArray([key], args, false));
        };
        HotPatcher2.prototype.plugin = function (key) {
          var _this = this;
          var methods = [];
          for (var _i = 1; _i < arguments.length; _i++) {
            methods[_i - 1] = arguments[_i];
          }
          methods.forEach(function (method) {
            _this.patch(key, method, { chain: true });
          });
          return this;
        };
        HotPatcher2.prototype.restore = function (key) {
          if (!this.isPatched(key)) {
            throw new Error('Failed restoring method: No method present for key: '.concat(key));
          } else if (typeof this.configuration.registry[key].original !== 'function') {
            throw new Error(
              'Failed restoring method: Original method not found or of invalid type for key: '.concat(
                key
              )
            );
          }
          this.configuration.registry[key].methods = [this.configuration.registry[key].original];
          return this;
        };
        HotPatcher2.prototype.setFinal = function (key) {
          if (!this.configuration.registry.hasOwnProperty(key)) {
            throw new Error("Failed marking '".concat(key, "' as final: No method found for key"));
          }
          this.configuration.registry[key].final = true;
          return this;
        };
        return HotPatcher2;
      })();
    exports2.HotPatcher = HotPatcher;
  },
});

// node_modules/hot-patcher/dist/types.js
var require_types3 = __commonJS({
  'node_modules/hot-patcher/dist/types.js'(exports2) {
    'use strict';
    Object.defineProperty(exports2, '__esModule', { value: true });
  },
});

// node_modules/hot-patcher/dist/index.js
var require_dist2 = __commonJS({
  'node_modules/hot-patcher/dist/index.js'(exports2) {
    'use strict';
    var __createBinding2 =
      (exports2 && exports2.__createBinding) ||
      (Object.create
        ? function (o, m, k, k2) {
            if (k2 === void 0) k2 = k;
            var desc = Object.getOwnPropertyDescriptor(m, k);
            if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
              desc = {
                enumerable: true,
                get: function () {
                  return m[k];
                },
              };
            }
            Object.defineProperty(o, k2, desc);
          }
        : function (o, m, k, k2) {
            if (k2 === void 0) k2 = k;
            o[k2] = m[k];
          });
    var __exportStar2 =
      (exports2 && exports2.__exportStar) ||
      function (m, exports3) {
        for (var p in m)
          if (p !== 'default' && !Object.prototype.hasOwnProperty.call(exports3, p))
            __createBinding2(exports3, m, p);
      };
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.HotPatcher = void 0;
    var patcher_12 = require_patcher();
    Object.defineProperty(exports2, 'HotPatcher', {
      enumerable: true,
      get: function () {
        return patcher_12.HotPatcher;
      },
    });
    __exportStar2(require_types3(), exports2);
  },
});

// node_modules/webdav/dist/node/compat/patcher.js
var require_patcher2 = __commonJS({
  'node_modules/webdav/dist/node/compat/patcher.js'(exports2) {
    'use strict';
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.getPatcher = void 0;
    var hot_patcher_1 = require_dist2();
    var __patcher = null;
    function getPatcher() {
      if (!__patcher) {
        __patcher = new hot_patcher_1.HotPatcher();
      }
      return __patcher;
    }
    exports2.getPatcher = getPatcher;
  },
});

// node_modules/webdav/dist/node/tools/merge.js
var require_merge = __commonJS({
  'node_modules/webdav/dist/node/tools/merge.js'(exports2) {
    'use strict';
    var __spreadArray =
      (exports2 && exports2.__spreadArray) ||
      function (to, from, pack) {
        if (pack || arguments.length === 2)
          for (var i = 0, l = from.length, ar; i < l; i++) {
            if (ar || !(i in from)) {
              if (!ar) ar = Array.prototype.slice.call(from, 0, i);
              ar[i] = from[i];
            }
          }
        return to.concat(ar || Array.prototype.slice.call(from));
      };
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.merge = exports2.cloneShallow = void 0;
    function cloneShallow(obj) {
      return isPlainObject(obj)
        ? Object.assign({}, obj)
        : Object.setPrototypeOf(Object.assign({}, obj), Object.getPrototypeOf(obj));
    }
    exports2.cloneShallow = cloneShallow;
    function isPlainObject(obj) {
      if (
        typeof obj !== 'object' ||
        obj === null ||
        Object.prototype.toString.call(obj) != '[object Object]'
      ) {
        return false;
      }
      if (Object.getPrototypeOf(obj) === null) {
        return true;
      }
      var proto = obj;
      while (Object.getPrototypeOf(proto) !== null) {
        proto = Object.getPrototypeOf(proto);
      }
      return Object.getPrototypeOf(obj) === proto;
    }
    function merge() {
      var args = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
      }
      var output = null,
        items = __spreadArray([], args, true);
      while (items.length > 0) {
        var nextItem = items.shift();
        if (!output) {
          output = cloneShallow(nextItem);
        } else {
          output = mergeObjects(output, nextItem);
        }
      }
      return output;
    }
    exports2.merge = merge;
    function mergeObjects(obj1, obj2) {
      var output = cloneShallow(obj1);
      Object.keys(obj2).forEach(function (key) {
        if (!output.hasOwnProperty(key)) {
          output[key] = obj2[key];
          return;
        }
        if (Array.isArray(obj2[key])) {
          output[key] = Array.isArray(output[key])
            ? __spreadArray(__spreadArray([], output[key], true), obj2[key], true)
            : __spreadArray([], obj2[key], true);
        } else if (typeof obj2[key] === 'object' && !!obj2[key]) {
          output[key] =
            typeof output[key] === 'object' && !!output[key]
              ? mergeObjects(output[key], obj2[key])
              : cloneShallow(obj2[key]);
        } else {
          output[key] = obj2[key];
        }
      });
      return output;
    }
  },
});

// node_modules/webdav/dist/node/tools/headers.js
var require_headers = __commonJS({
  'node_modules/webdav/dist/node/tools/headers.js'(exports2) {
    'use strict';
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.mergeHeaders = void 0;
    function mergeHeaders() {
      var headerPayloads = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        headerPayloads[_i] = arguments[_i];
      }
      if (headerPayloads.length === 0) return {};
      var headerKeys = {};
      return headerPayloads.reduce(function (output, headers) {
        Object.keys(headers).forEach(function (header) {
          var lowerHeader = header.toLowerCase();
          if (headerKeys.hasOwnProperty(lowerHeader)) {
            output[headerKeys[lowerHeader]] = headers[header];
          } else {
            headerKeys[lowerHeader] = header;
            output[header] = headers[header];
          }
        });
        return output;
      }, {});
    }
    exports2.mergeHeaders = mergeHeaders;
  },
});

// node_modules/webdav/dist/node/request.js
var require_request = __commonJS({
  'node_modules/webdav/dist/node/request.js'(exports2) {
    'use strict';
    var __importDefault =
      (exports2 && exports2.__importDefault) ||
      function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
      };
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.request = exports2.prepareRequestOptions = void 0;
    var axios_1 = __importDefault(require_axios2());
    var patcher_12 = require_patcher2();
    var digest_1 = require_digest();
    var merge_1 = require_merge();
    var headers_1 = require_headers();
    function _request(requestOptions) {
      return (0, patcher_12.getPatcher)().patchInline(
        'request',
        function (options) {
          return (0, axios_1.default)(options);
        },
        requestOptions
      );
    }
    function prepareRequestOptions(requestOptions, context, userOptions) {
      var finalOptions = (0, merge_1.cloneShallow)(requestOptions);
      finalOptions.headers = (0, headers_1.mergeHeaders)(
        context.headers,
        finalOptions.headers || {},
        userOptions.headers || {}
      );
      if (typeof userOptions.data !== 'undefined') {
        finalOptions.data = userOptions.data;
      }
      if (userOptions.signal) {
        finalOptions.signal = userOptions.signal;
      }
      if (context.httpAgent) {
        finalOptions.httpAgent = context.httpAgent;
      }
      if (context.httpsAgent) {
        finalOptions.httpsAgent = context.httpsAgent;
      }
      if (context.digest) {
        finalOptions._digest = context.digest;
      }
      if (typeof context.withCredentials === 'boolean') {
        finalOptions.withCredentials = context.withCredentials;
      }
      if (context.maxContentLength) {
        finalOptions.maxContentLength = context.maxContentLength;
      }
      if (context.maxBodyLength) {
        finalOptions.maxBodyLength = context.maxBodyLength;
      }
      if (userOptions.hasOwnProperty('onUploadProgress')) {
        finalOptions.onUploadProgress = userOptions['onUploadProgress'];
      }
      if (userOptions.hasOwnProperty('onDownloadProgress')) {
        finalOptions.onDownloadProgress = userOptions['onDownloadProgress'];
      }
      finalOptions.validateStatus = function () {
        return true;
      };
      return finalOptions;
    }
    exports2.prepareRequestOptions = prepareRequestOptions;
    function request(requestOptions) {
      if (!requestOptions._digest) {
        return _request(requestOptions);
      }
      var _digest = requestOptions._digest;
      delete requestOptions._digest;
      if (_digest.hasDigestAuth) {
        requestOptions = (0, merge_1.merge)(requestOptions, {
          headers: {
            Authorization: (0, digest_1.generateDigestAuthHeader)(requestOptions, _digest),
          },
        });
      }
      return _request(requestOptions).then(function (response) {
        if (response.status == 401) {
          _digest.hasDigestAuth = (0, digest_1.parseDigestAuth)(response, _digest);
          if (_digest.hasDigestAuth) {
            requestOptions = (0, merge_1.merge)(requestOptions, {
              headers: {
                Authorization: (0, digest_1.generateDigestAuthHeader)(requestOptions, _digest),
              },
            });
            return _request(requestOptions).then(function (response2) {
              if (response2.status == 401) {
                _digest.hasDigestAuth = false;
              } else {
                _digest.nc++;
              }
              return response2;
            });
          }
        } else {
          _digest.nc++;
        }
        return response;
      });
    }
    exports2.request = request;
  },
});

// node_modules/webdav/node_modules/minimatch/lib/path.js
var require_path2 = __commonJS({
  'node_modules/webdav/node_modules/minimatch/lib/path.js'(exports2, module2) {
    var isWindows = typeof process === 'object' && process && process.platform === 'win32';
    module2.exports = isWindows ? { sep: '\\' } : { sep: '/' };
  },
});

// node_modules/webdav/node_modules/balanced-match/index.js
var require_balanced_match = __commonJS({
  'node_modules/webdav/node_modules/balanced-match/index.js'(exports2, module2) {
    'use strict';
    module2.exports = balanced;
    function balanced(a, b, str) {
      if (a instanceof RegExp) a = maybeMatch(a, str);
      if (b instanceof RegExp) b = maybeMatch(b, str);
      var r = range(a, b, str);
      return (
        r && {
          start: r[0],
          end: r[1],
          pre: str.slice(0, r[0]),
          body: str.slice(r[0] + a.length, r[1]),
          post: str.slice(r[1] + b.length),
        }
      );
    }
    function maybeMatch(reg, str) {
      var m = str.match(reg);
      return m ? m[0] : null;
    }
    balanced.range = range;
    function range(a, b, str) {
      var begs, beg, left, right, result;
      var ai = str.indexOf(a);
      var bi = str.indexOf(b, ai + 1);
      var i = ai;
      if (ai >= 0 && bi > 0) {
        if (a === b) {
          return [ai, bi];
        }
        begs = [];
        left = str.length;
        while (i >= 0 && !result) {
          if (i == ai) {
            begs.push(i);
            ai = str.indexOf(a, i + 1);
          } else if (begs.length == 1) {
            result = [begs.pop(), bi];
          } else {
            beg = begs.pop();
            if (beg < left) {
              left = beg;
              right = bi;
            }
            bi = str.indexOf(b, i + 1);
          }
          i = ai < bi && ai >= 0 ? ai : bi;
        }
        if (begs.length) {
          result = [left, right];
        }
      }
      return result;
    }
  },
});

// node_modules/webdav/node_modules/brace-expansion/index.js
var require_brace_expansion = __commonJS({
  'node_modules/webdav/node_modules/brace-expansion/index.js'(exports2, module2) {
    var balanced = require_balanced_match();
    module2.exports = expandTop;
    var escSlash = '\0SLASH' + Math.random() + '\0';
    var escOpen = '\0OPEN' + Math.random() + '\0';
    var escClose = '\0CLOSE' + Math.random() + '\0';
    var escComma = '\0COMMA' + Math.random() + '\0';
    var escPeriod = '\0PERIOD' + Math.random() + '\0';
    function numeric(str) {
      return parseInt(str, 10) == str ? parseInt(str, 10) : str.charCodeAt(0);
    }
    function escapeBraces(str) {
      return str
        .split('\\\\')
        .join(escSlash)
        .split('\\{')
        .join(escOpen)
        .split('\\}')
        .join(escClose)
        .split('\\,')
        .join(escComma)
        .split('\\.')
        .join(escPeriod);
    }
    function unescapeBraces(str) {
      return str
        .split(escSlash)
        .join('\\')
        .split(escOpen)
        .join('{')
        .split(escClose)
        .join('}')
        .split(escComma)
        .join(',')
        .split(escPeriod)
        .join('.');
    }
    function parseCommaParts(str) {
      if (!str) return [''];
      var parts = [];
      var m = balanced('{', '}', str);
      if (!m) return str.split(',');
      var pre = m.pre;
      var body = m.body;
      var post = m.post;
      var p = pre.split(',');
      p[p.length - 1] += '{' + body + '}';
      var postParts = parseCommaParts(post);
      if (post.length) {
        p[p.length - 1] += postParts.shift();
        p.push.apply(p, postParts);
      }
      parts.push.apply(parts, p);
      return parts;
    }
    function expandTop(str) {
      if (!str) return [];
      if (str.substr(0, 2) === '{}') {
        str = '\\{\\}' + str.substr(2);
      }
      return expand(escapeBraces(str), true).map(unescapeBraces);
    }
    function embrace(str) {
      return '{' + str + '}';
    }
    function isPadded(el) {
      return /^-?0\d/.test(el);
    }
    function lte(i, y) {
      return i <= y;
    }
    function gte(i, y) {
      return i >= y;
    }
    function expand(str, isTop) {
      var expansions = [];
      var m = balanced('{', '}', str);
      if (!m) return [str];
      var pre = m.pre;
      var post = m.post.length ? expand(m.post, false) : [''];
      if (/\$$/.test(m.pre)) {
        for (var k = 0; k < post.length; k++) {
          var expansion = pre + '{' + m.body + '}' + post[k];
          expansions.push(expansion);
        }
      } else {
        var isNumericSequence = /^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(m.body);
        var isAlphaSequence = /^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(m.body);
        var isSequence = isNumericSequence || isAlphaSequence;
        var isOptions = m.body.indexOf(',') >= 0;
        if (!isSequence && !isOptions) {
          if (m.post.match(/,(?!,).*\}/)) {
            str = m.pre + '{' + m.body + escClose + m.post;
            return expand(str);
          }
          return [str];
        }
        var n;
        if (isSequence) {
          n = m.body.split(/\.\./);
        } else {
          n = parseCommaParts(m.body);
          if (n.length === 1) {
            n = expand(n[0], false).map(embrace);
            if (n.length === 1) {
              return post.map(function (p) {
                return m.pre + n[0] + p;
              });
            }
          }
        }
        var N;
        if (isSequence) {
          var x = numeric(n[0]);
          var y = numeric(n[1]);
          var width = Math.max(n[0].length, n[1].length);
          var incr = n.length == 3 ? Math.max(Math.abs(numeric(n[2])), 1) : 1;
          var test = lte;
          var reverse = y < x;
          if (reverse) {
            incr *= -1;
            test = gte;
          }
          var pad = n.some(isPadded);
          N = [];
          for (var i = x; test(i, y); i += incr) {
            var c;
            if (isAlphaSequence) {
              c = String.fromCharCode(i);
              if (c === '\\') c = '';
            } else {
              c = String(i);
              if (pad) {
                var need = width - c.length;
                if (need > 0) {
                  var z = new Array(need + 1).join('0');
                  if (i < 0) c = '-' + z + c.slice(1);
                  else c = z + c;
                }
              }
            }
            N.push(c);
          }
        } else {
          N = [];
          for (var j = 0; j < n.length; j++) {
            N.push.apply(N, expand(n[j], false));
          }
        }
        for (var j = 0; j < N.length; j++) {
          for (var k = 0; k < post.length; k++) {
            var expansion = pre + N[j] + post[k];
            if (!isTop || isSequence || expansion) expansions.push(expansion);
          }
        }
      }
      return expansions;
    }
  },
});

// node_modules/webdav/node_modules/minimatch/minimatch.js
var require_minimatch = __commonJS({
  'node_modules/webdav/node_modules/minimatch/minimatch.js'(exports2, module2) {
    var minimatch = (module2.exports = (p, pattern, options = {}) => {
      assertValidPattern(pattern);
      if (!options.nocomment && pattern.charAt(0) === '#') {
        return false;
      }
      return new Minimatch(pattern, options).match(p);
    });
    module2.exports = minimatch;
    var path = require_path2();
    minimatch.sep = path.sep;
    var GLOBSTAR = /* @__PURE__ */ Symbol('globstar **');
    minimatch.GLOBSTAR = GLOBSTAR;
    var expand = require_brace_expansion();
    var plTypes = {
      '!': { open: '(?:(?!(?:', close: '))[^/]*?)' },
      '?': { open: '(?:', close: ')?' },
      '+': { open: '(?:', close: ')+' },
      '*': { open: '(?:', close: ')*' },
      '@': { open: '(?:', close: ')' },
    };
    var qmark = '[^/]';
    var star = qmark + '*?';
    var twoStarDot = '(?:(?!(?:\\/|^)(?:\\.{1,2})($|\\/)).)*?';
    var twoStarNoDot = '(?:(?!(?:\\/|^)\\.).)*?';
    var charSet = (s) =>
      s.split('').reduce((set, c) => {
        set[c] = true;
        return set;
      }, {});
    var reSpecials = charSet('().*{}+?[]^$\\!');
    var addPatternStartSet = charSet('[.(');
    var slashSplit = /\/+/;
    minimatch.filter =
      (pattern, options = {}) =>
      (p, i, list) =>
        minimatch(p, pattern, options);
    var ext = (a, b = {}) => {
      const t = {};
      Object.keys(a).forEach((k) => (t[k] = a[k]));
      Object.keys(b).forEach((k) => (t[k] = b[k]));
      return t;
    };
    minimatch.defaults = (def) => {
      if (!def || typeof def !== 'object' || !Object.keys(def).length) {
        return minimatch;
      }
      const orig = minimatch;
      const m = (p, pattern, options) => orig(p, pattern, ext(def, options));
      m.Minimatch = class Minimatch extends orig.Minimatch {
        constructor(pattern, options) {
          super(pattern, ext(def, options));
        }
      };
      m.Minimatch.defaults = (options) => orig.defaults(ext(def, options)).Minimatch;
      m.filter = (pattern, options) => orig.filter(pattern, ext(def, options));
      m.defaults = (options) => orig.defaults(ext(def, options));
      m.makeRe = (pattern, options) => orig.makeRe(pattern, ext(def, options));
      m.braceExpand = (pattern, options) => orig.braceExpand(pattern, ext(def, options));
      m.match = (list, pattern, options) => orig.match(list, pattern, ext(def, options));
      return m;
    };
    minimatch.braceExpand = (pattern, options) => braceExpand(pattern, options);
    var braceExpand = (pattern, options = {}) => {
      assertValidPattern(pattern);
      if (options.nobrace || !/\{(?:(?!\{).)*\}/.test(pattern)) {
        return [pattern];
      }
      return expand(pattern);
    };
    var MAX_PATTERN_LENGTH = 1024 * 64;
    var assertValidPattern = (pattern) => {
      if (typeof pattern !== 'string') {
        throw new TypeError('invalid pattern');
      }
      if (pattern.length > MAX_PATTERN_LENGTH) {
        throw new TypeError('pattern is too long');
      }
    };
    var SUBPARSE = /* @__PURE__ */ Symbol('subparse');
    minimatch.makeRe = (pattern, options) => new Minimatch(pattern, options || {}).makeRe();
    minimatch.match = (list, pattern, options = {}) => {
      const mm = new Minimatch(pattern, options);
      list = list.filter((f) => mm.match(f));
      if (mm.options.nonull && !list.length) {
        list.push(pattern);
      }
      return list;
    };
    var globUnescape = (s) => s.replace(/\\(.)/g, '$1');
    var charUnescape = (s) => s.replace(/\\([^-\]])/g, '$1');
    var regExpEscape = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    var braExpEscape = (s) => s.replace(/[[\]\\]/g, '\\$&');
    var Minimatch = class {
      constructor(pattern, options) {
        assertValidPattern(pattern);
        if (!options) options = {};
        this.options = options;
        this.maxGlobstarRecursion =
          options.maxGlobstarRecursion !== void 0 ? options.maxGlobstarRecursion : 200;
        this.set = [];
        this.pattern = pattern;
        this.windowsPathsNoEscape =
          !!options.windowsPathsNoEscape || options.allowWindowsEscape === false;
        if (this.windowsPathsNoEscape) {
          this.pattern = this.pattern.replace(/\\/g, '/');
        }
        this.regexp = null;
        this.negate = false;
        this.comment = false;
        this.empty = false;
        this.partial = !!options.partial;
        this.make();
      }
      debug() {}
      make() {
        const pattern = this.pattern;
        const options = this.options;
        if (!options.nocomment && pattern.charAt(0) === '#') {
          this.comment = true;
          return;
        }
        if (!pattern) {
          this.empty = true;
          return;
        }
        this.parseNegate();
        let set = (this.globSet = this.braceExpand());
        if (options.debug) this.debug = (...args) => console.error(...args);
        this.debug(this.pattern, set);
        set = this.globParts = set.map((s) => s.split(slashSplit));
        this.debug(this.pattern, set);
        set = set.map((s, si, set2) => s.map(this.parse, this));
        this.debug(this.pattern, set);
        set = set.filter((s) => s.indexOf(false) === -1);
        this.debug(this.pattern, set);
        this.set = set;
      }
      parseNegate() {
        if (this.options.nonegate) return;
        const pattern = this.pattern;
        let negate = false;
        let negateOffset = 0;
        for (let i = 0; i < pattern.length && pattern.charAt(i) === '!'; i++) {
          negate = !negate;
          negateOffset++;
        }
        if (negateOffset) this.pattern = pattern.slice(negateOffset);
        this.negate = negate;
      }
      // set partial to true to test if, for example,
      // "/a/b" matches the start of "/*/b/*/d"
      // Partial means, if you run out of file before you run
      // out of pattern, then that's fine, as long as all
      // the parts match.
      matchOne(file, pattern, partial) {
        if (pattern.indexOf(GLOBSTAR) !== -1) {
          return this._matchGlobstar(file, pattern, partial, 0, 0);
        }
        return this._matchOne(file, pattern, partial, 0, 0);
      }
      _matchGlobstar(file, pattern, partial, fileIndex, patternIndex) {
        let firstgs = -1;
        for (let i = patternIndex; i < pattern.length; i++) {
          if (pattern[i] === GLOBSTAR) {
            firstgs = i;
            break;
          }
        }
        let lastgs = -1;
        for (let i = pattern.length - 1; i >= 0; i--) {
          if (pattern[i] === GLOBSTAR) {
            lastgs = i;
            break;
          }
        }
        const head = pattern.slice(patternIndex, firstgs);
        const body = partial ? pattern.slice(firstgs + 1) : pattern.slice(firstgs + 1, lastgs);
        const tail = partial ? [] : pattern.slice(lastgs + 1);
        if (head.length) {
          const fileHead = file.slice(fileIndex, fileIndex + head.length);
          if (!this._matchOne(fileHead, head, partial, 0, 0)) {
            return false;
          }
          fileIndex += head.length;
        }
        let fileTailMatch = 0;
        if (tail.length) {
          if (tail.length + fileIndex > file.length) return false;
          const tailStart = file.length - tail.length;
          if (this._matchOne(file, tail, partial, tailStart, 0)) {
            fileTailMatch = tail.length;
          } else {
            if (file[file.length - 1] !== '' || fileIndex + tail.length === file.length) {
              return false;
            }
            if (!this._matchOne(file, tail, partial, tailStart - 1, 0)) {
              return false;
            }
            fileTailMatch = tail.length + 1;
          }
        }
        if (!body.length) {
          let sawSome = !!fileTailMatch;
          for (let i = fileIndex; i < file.length - fileTailMatch; i++) {
            const f = String(file[i]);
            sawSome = true;
            if (f === '.' || f === '..' || (!this.options.dot && f.charAt(0) === '.')) {
              return false;
            }
          }
          return partial || sawSome;
        }
        const bodySegments = [[[], 0]];
        let currentBody = bodySegments[0];
        let nonGsParts = 0;
        const nonGsPartsSums = [0];
        for (const b of body) {
          if (b === GLOBSTAR) {
            nonGsPartsSums.push(nonGsParts);
            currentBody = [[], 0];
            bodySegments.push(currentBody);
          } else {
            currentBody[0].push(b);
            nonGsParts++;
          }
        }
        let idx = bodySegments.length - 1;
        const fileLength = file.length - fileTailMatch;
        for (const b of bodySegments) {
          b[1] = fileLength - (nonGsPartsSums[idx--] + b[0].length);
        }
        return !!this._matchGlobStarBodySections(
          file,
          bodySegments,
          fileIndex,
          0,
          partial,
          0,
          !!fileTailMatch
        );
      }
      // return false for "nope, not matching"
      // return null for "not matching, cannot keep trying"
      _matchGlobStarBodySections(
        file,
        bodySegments,
        fileIndex,
        bodyIndex,
        partial,
        globStarDepth,
        sawTail
      ) {
        const bs = bodySegments[bodyIndex];
        if (!bs) {
          for (let i = fileIndex; i < file.length; i++) {
            sawTail = true;
            const f = file[i];
            if (f === '.' || f === '..' || (!this.options.dot && f.charAt(0) === '.')) {
              return false;
            }
          }
          return sawTail;
        }
        const [body, after] = bs;
        while (fileIndex <= after) {
          const m = this._matchOne(
            file.slice(0, fileIndex + body.length),
            body,
            partial,
            fileIndex,
            0
          );
          if (m && globStarDepth < this.maxGlobstarRecursion) {
            const sub = this._matchGlobStarBodySections(
              file,
              bodySegments,
              fileIndex + body.length,
              bodyIndex + 1,
              partial,
              globStarDepth + 1,
              sawTail
            );
            if (sub !== false) {
              return sub;
            }
          }
          const f = file[fileIndex];
          if (f === '.' || f === '..' || (!this.options.dot && f.charAt(0) === '.')) {
            return false;
          }
          fileIndex++;
        }
        return partial || null;
      }
      _matchOne(file, pattern, partial, fileIndex, patternIndex) {
        let fi, pi, fl, pl;
        for (
          fi = fileIndex, pi = patternIndex, fl = file.length, pl = pattern.length;
          fi < fl && pi < pl;
          fi++, pi++
        ) {
          this.debug('matchOne loop');
          const p = pattern[pi];
          const f = file[fi];
          this.debug(pattern, p, f);
          if (p === false || p === GLOBSTAR) return false;
          let hit;
          if (typeof p === 'string') {
            hit = f === p;
            this.debug('string match', p, f, hit);
          } else {
            hit = f.match(p);
            this.debug('pattern match', p, f, hit);
          }
          if (!hit) return false;
        }
        if (fi === fl && pi === pl) {
          return true;
        } else if (fi === fl) {
          return partial;
        } else if (pi === pl) {
          return fi === fl - 1 && file[fi] === '';
        }
        throw new Error('wtf?');
      }
      braceExpand() {
        return braceExpand(this.pattern, this.options);
      }
      parse(pattern, isSub) {
        assertValidPattern(pattern);
        const options = this.options;
        if (pattern === '**') {
          if (!options.noglobstar) return GLOBSTAR;
          else pattern = '*';
        }
        if (pattern === '') return '';
        let re = '';
        let hasMagic = false;
        let escaping = false;
        const patternListStack = [];
        const negativeLists = [];
        let stateChar;
        let inClass = false;
        let reClassStart = -1;
        let classStart = -1;
        let cs;
        let pl;
        let sp;
        let dotTravAllowed = pattern.charAt(0) === '.';
        let dotFileAllowed = options.dot || dotTravAllowed;
        const patternStart = () =>
          dotTravAllowed ? '' : dotFileAllowed ? '(?!(?:^|\\/)\\.{1,2}(?:$|\\/))' : '(?!\\.)';
        const subPatternStart = (p) =>
          p.charAt(0) === '.' ? '' : options.dot ? '(?!(?:^|\\/)\\.{1,2}(?:$|\\/))' : '(?!\\.)';
        const clearStateChar = () => {
          if (stateChar) {
            switch (stateChar) {
              case '*':
                re += star;
                hasMagic = true;
                break;
              case '?':
                re += qmark;
                hasMagic = true;
                break;
              default:
                re += '\\' + stateChar;
                break;
            }
            this.debug('clearStateChar %j %j', stateChar, re);
            stateChar = false;
          }
        };
        for (let i = 0, c; i < pattern.length && (c = pattern.charAt(i)); i++) {
          this.debug('%s	%s %s %j', pattern, i, re, c);
          if (escaping) {
            if (c === '/') {
              return false;
            }
            if (reSpecials[c]) {
              re += '\\';
            }
            re += c;
            escaping = false;
            continue;
          }
          switch (c) {
            /* istanbul ignore next */
            case '/': {
              return false;
            }
            case '\\':
              if (inClass && pattern.charAt(i + 1) === '-') {
                re += c;
                continue;
              }
              clearStateChar();
              escaping = true;
              continue;
            // the various stateChar values
            // for the "extglob" stuff.
            case '?':
            case '*':
            case '+':
            case '@':
            case '!':
              this.debug('%s	%s %s %j <-- stateChar', pattern, i, re, c);
              if (inClass) {
                this.debug('  in class');
                if (c === '!' && i === classStart + 1) c = '^';
                re += c;
                continue;
              }
              if (c === '*' && stateChar === '*') continue;
              this.debug('call clearStateChar %j', stateChar);
              clearStateChar();
              stateChar = c;
              if (options.noext) clearStateChar();
              continue;
            case '(': {
              if (inClass) {
                re += '(';
                continue;
              }
              if (!stateChar) {
                re += '\\(';
                continue;
              }
              const plEntry = {
                type: stateChar,
                start: i - 1,
                reStart: re.length,
                open: plTypes[stateChar].open,
                close: plTypes[stateChar].close,
              };
              this.debug(this.pattern, '	', plEntry);
              patternListStack.push(plEntry);
              re += plEntry.open;
              if (plEntry.start === 0 && plEntry.type !== '!') {
                dotTravAllowed = true;
                re += subPatternStart(pattern.slice(i + 1));
              }
              this.debug('plType %j %j', stateChar, re);
              stateChar = false;
              continue;
            }
            case ')': {
              const plEntry = patternListStack[patternListStack.length - 1];
              if (inClass || !plEntry) {
                re += '\\)';
                continue;
              }
              patternListStack.pop();
              clearStateChar();
              hasMagic = true;
              pl = plEntry;
              re += pl.close;
              if (pl.type === '!') {
                negativeLists.push(Object.assign(pl, { reEnd: re.length }));
              }
              continue;
            }
            case '|': {
              const plEntry = patternListStack[patternListStack.length - 1];
              if (inClass || !plEntry) {
                re += '\\|';
                continue;
              }
              clearStateChar();
              re += '|';
              if (plEntry.start === 0 && plEntry.type !== '!') {
                dotTravAllowed = true;
                re += subPatternStart(pattern.slice(i + 1));
              }
              continue;
            }
            // these are mostly the same in regexp and glob
            case '[':
              clearStateChar();
              if (inClass) {
                re += '\\' + c;
                continue;
              }
              inClass = true;
              classStart = i;
              reClassStart = re.length;
              re += c;
              continue;
            case ']':
              if (i === classStart + 1 || !inClass) {
                re += '\\' + c;
                continue;
              }
              cs = pattern.substring(classStart + 1, i);
              try {
                RegExp('[' + braExpEscape(charUnescape(cs)) + ']');
                re += c;
              } catch (er) {
                re = re.substring(0, reClassStart) + '(?:$.)';
              }
              hasMagic = true;
              inClass = false;
              continue;
            default:
              clearStateChar();
              if (reSpecials[c] && !(c === '^' && inClass)) {
                re += '\\';
              }
              re += c;
              break;
          }
        }
        if (inClass) {
          cs = pattern.slice(classStart + 1);
          sp = this.parse(cs, SUBPARSE);
          re = re.substring(0, reClassStart) + '\\[' + sp[0];
          hasMagic = hasMagic || sp[1];
        }
        for (pl = patternListStack.pop(); pl; pl = patternListStack.pop()) {
          let tail;
          tail = re.slice(pl.reStart + pl.open.length);
          this.debug('setting tail', re, pl);
          tail = tail.replace(/((?:\\{2}){0,64})(\\?)\|/g, (_, $1, $2) => {
            if (!$2) {
              $2 = '\\';
            }
            return $1 + $1 + $2 + '|';
          });
          this.debug('tail=%j\n   %s', tail, tail, pl, re);
          const t = pl.type === '*' ? star : pl.type === '?' ? qmark : '\\' + pl.type;
          hasMagic = true;
          re = re.slice(0, pl.reStart) + t + '\\(' + tail;
        }
        clearStateChar();
        if (escaping) {
          re += '\\\\';
        }
        const addPatternStart = addPatternStartSet[re.charAt(0)];
        for (let n = negativeLists.length - 1; n > -1; n--) {
          const nl = negativeLists[n];
          const nlBefore = re.slice(0, nl.reStart);
          const nlFirst = re.slice(nl.reStart, nl.reEnd - 8);
          let nlAfter = re.slice(nl.reEnd);
          const nlLast = re.slice(nl.reEnd - 8, nl.reEnd) + nlAfter;
          const closeParensBefore = nlBefore.split(')').length;
          const openParensBefore = nlBefore.split('(').length - closeParensBefore;
          let cleanAfter = nlAfter;
          for (let i = 0; i < openParensBefore; i++) {
            cleanAfter = cleanAfter.replace(/\)[+*?]?/, '');
          }
          nlAfter = cleanAfter;
          const dollar = nlAfter === '' && isSub !== SUBPARSE ? '(?:$|\\/)' : '';
          re = nlBefore + nlFirst + nlAfter + dollar + nlLast;
        }
        if (re !== '' && hasMagic) {
          re = '(?=.)' + re;
        }
        if (addPatternStart) {
          re = patternStart() + re;
        }
        if (isSub === SUBPARSE) {
          return [re, hasMagic];
        }
        if (options.nocase && !hasMagic) {
          hasMagic = pattern.toUpperCase() !== pattern.toLowerCase();
        }
        if (!hasMagic) {
          return globUnescape(pattern);
        }
        const flags = options.nocase ? 'i' : '';
        try {
          return Object.assign(new RegExp('^' + re + '$', flags), {
            _glob: pattern,
            _src: re,
          });
        } catch (er) {
          return new RegExp('$.');
        }
      }
      makeRe() {
        if (this.regexp || this.regexp === false) return this.regexp;
        const set = this.set;
        if (!set.length) {
          this.regexp = false;
          return this.regexp;
        }
        const options = this.options;
        const twoStar = options.noglobstar ? star : options.dot ? twoStarDot : twoStarNoDot;
        const flags = options.nocase ? 'i' : '';
        let re = set
          .map((pattern) => {
            pattern = pattern
              .map((p) =>
                typeof p === 'string' ? regExpEscape(p) : p === GLOBSTAR ? GLOBSTAR : p._src
              )
              .reduce((set2, p) => {
                if (!(set2[set2.length - 1] === GLOBSTAR && p === GLOBSTAR)) {
                  set2.push(p);
                }
                return set2;
              }, []);
            pattern.forEach((p, i) => {
              if (p !== GLOBSTAR || pattern[i - 1] === GLOBSTAR) {
                return;
              }
              if (i === 0) {
                if (pattern.length > 1) {
                  pattern[i + 1] = '(?:\\/|' + twoStar + '\\/)?' + pattern[i + 1];
                } else {
                  pattern[i] = twoStar;
                }
              } else if (i === pattern.length - 1) {
                pattern[i - 1] += '(?:\\/|' + twoStar + ')?';
              } else {
                pattern[i - 1] += '(?:\\/|\\/' + twoStar + '\\/)' + pattern[i + 1];
                pattern[i + 1] = GLOBSTAR;
              }
            });
            return pattern.filter((p) => p !== GLOBSTAR).join('/');
          })
          .join('|');
        re = '^(?:' + re + ')$';
        if (this.negate) re = '^(?!' + re + ').*$';
        try {
          this.regexp = new RegExp(re, flags);
        } catch (ex) {
          this.regexp = false;
        }
        return this.regexp;
      }
      match(f, partial = this.partial) {
        this.debug('match', f, this.pattern);
        if (this.comment) return false;
        if (this.empty) return f === '';
        if (f === '/' && partial) return true;
        const options = this.options;
        if (path.sep !== '/') {
          f = f.split(path.sep).join('/');
        }
        f = f.split(slashSplit);
        this.debug(this.pattern, 'split', f);
        const set = this.set;
        this.debug(this.pattern, 'set', set);
        let filename;
        for (let i = f.length - 1; i >= 0; i--) {
          filename = f[i];
          if (filename) break;
        }
        for (let i = 0; i < set.length; i++) {
          const pattern = set[i];
          let file = f;
          if (options.matchBase && pattern.length === 1) {
            file = [filename];
          }
          const hit = this.matchOne(file, pattern, partial);
          if (hit) {
            if (options.flipNegate) return true;
            return !this.negate;
          }
        }
        if (options.flipNegate) return false;
        return this.negate;
      }
      static defaults(def) {
        return minimatch.defaults(def).Minimatch;
      }
    };
    minimatch.Minimatch = Minimatch;
  },
});

// node_modules/webdav/dist/node/response.js
var require_response = __commonJS({
  'node_modules/webdav/dist/node/response.js'(exports2) {
    'use strict';
    var __importDefault =
      (exports2 && exports2.__importDefault) ||
      function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
      };
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.processResponsePayload =
      exports2.processGlobFilter =
      exports2.handleResponseCode =
      exports2.createErrorFromResponse =
        void 0;
    var minimatch_1 = __importDefault(require_minimatch());
    function createErrorFromResponse(response, prefix) {
      if (prefix === void 0) {
        prefix = '';
      }
      var err = new Error(
        ''
          .concat(prefix, 'Invalid response: ')
          .concat(response.status, ' ')
          .concat(response.statusText)
      );
      err.status = response.status;
      err.response = response;
      return err;
    }
    exports2.createErrorFromResponse = createErrorFromResponse;
    function handleResponseCode(context, response) {
      var status = response.status;
      if (status === 401 && context.digest) return response;
      if (status >= 400) {
        var err = createErrorFromResponse(response);
        throw err;
      }
      return response;
    }
    exports2.handleResponseCode = handleResponseCode;
    function processGlobFilter(files, glob) {
      return files.filter(function (file) {
        return (0, minimatch_1.default)(file.filename, glob, { matchBase: true });
      });
    }
    exports2.processGlobFilter = processGlobFilter;
    function processResponsePayload(response, data, isDetailed) {
      if (isDetailed === void 0) {
        isDetailed = false;
      }
      return isDetailed
        ? {
            data,
            headers: response.headers || {},
            status: response.status,
            statusText: response.statusText,
          }
        : data;
    }
    exports2.processResponsePayload = processResponsePayload;
  },
});

// node_modules/webdav/dist/node/operations/copyFile.js
var require_copyFile = __commonJS({
  'node_modules/webdav/dist/node/operations/copyFile.js'(exports2) {
    'use strict';
    var __awaiter =
      (exports2 && exports2.__awaiter) ||
      function (thisArg, _arguments, P, generator) {
        function adopt(value) {
          return value instanceof P
            ? value
            : new P(function (resolve) {
                resolve(value);
              });
        }
        return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) {
            try {
              step(generator.next(value));
            } catch (e) {
              reject(e);
            }
          }
          function rejected(value) {
            try {
              step(generator['throw'](value));
            } catch (e) {
              reject(e);
            }
          }
          function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
          }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
      };
    var __generator =
      (exports2 && exports2.__generator) ||
      function (thisArg, body) {
        var _ = {
            label: 0,
            sent: function () {
              if (t[0] & 1) throw t[1];
              return t[1];
            },
            trys: [],
            ops: [],
          },
          f,
          y,
          t,
          g;
        return (
          (g = { next: verb(0), throw: verb(1), return: verb(2) }),
          typeof Symbol === 'function' &&
            (g[Symbol.iterator] = function () {
              return this;
            }),
          g
        );
        function verb(n) {
          return function (v) {
            return step([n, v]);
          };
        }
        function step(op) {
          if (f) throw new TypeError('Generator is already executing.');
          while (_)
            try {
              if (
                ((f = 1),
                y &&
                  (t =
                    op[0] & 2
                      ? y['return']
                      : op[0]
                        ? y['throw'] || ((t = y['return']) && t.call(y), 0)
                        : y.next) &&
                  !(t = t.call(y, op[1])).done)
              )
                return t;
              if (((y = 0), t)) op = [op[0] & 2, t.value];
              switch (op[0]) {
                case 0:
                case 1:
                  t = op;
                  break;
                case 4:
                  _.label++;
                  return { value: op[1], done: false };
                case 5:
                  _.label++;
                  y = op[1];
                  op = [0];
                  continue;
                case 7:
                  op = _.ops.pop();
                  _.trys.pop();
                  continue;
                default:
                  if (
                    !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                    (op[0] === 6 || op[0] === 2)
                  ) {
                    _ = 0;
                    continue;
                  }
                  if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                    _.label = op[1];
                    break;
                  }
                  if (op[0] === 6 && _.label < t[1]) {
                    _.label = t[1];
                    t = op;
                    break;
                  }
                  if (t && _.label < t[2]) {
                    _.label = t[2];
                    _.ops.push(op);
                    break;
                  }
                  if (t[2]) _.ops.pop();
                  _.trys.pop();
                  continue;
              }
              op = body.call(thisArg, _);
            } catch (e) {
              op = [6, e];
              y = 0;
            } finally {
              f = t = 0;
            }
          if (op[0] & 5) throw op[1];
          return { value: op[0] ? op[1] : void 0, done: true };
        }
      };
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.copyFile = void 0;
    var url_1 = require_url();
    var path_1 = require_path();
    var request_1 = require_request();
    var response_1 = require_response();
    function copyFile(context, filename, destination, options) {
      if (options === void 0) {
        options = {};
      }
      return __awaiter(this, void 0, void 0, function () {
        var requestOptions, response;
        return __generator(this, function (_a) {
          switch (_a.label) {
            case 0:
              requestOptions = (0, request_1.prepareRequestOptions)(
                {
                  url: (0, url_1.joinURL)(context.remoteURL, (0, path_1.encodePath)(filename)),
                  method: 'COPY',
                  headers: {
                    Destination: (0, url_1.joinURL)(
                      context.remoteURL,
                      (0, path_1.encodePath)(destination)
                    ),
                  },
                },
                context,
                options
              );
              return [4, (0, request_1.request)(requestOptions)];
            case 1:
              response = _a.sent();
              (0, response_1.handleResponseCode)(context, response);
              return [
                2,
                /*return*/
              ];
          }
        });
      });
    }
    exports2.copyFile = copyFile;
  },
});

// node_modules/fast-xml-parser/src/util.js
var require_util = __commonJS({
  'node_modules/fast-xml-parser/src/util.js'(exports2) {
    'use strict';
    var nameStartChar =
      ':A-Za-z_\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD';
    var nameChar = nameStartChar + '\\-.\\d\\u00B7\\u0300-\\u036F\\u203F-\\u2040';
    var nameRegexp = '[' + nameStartChar + '][' + nameChar + ']*';
    var regexName = new RegExp('^' + nameRegexp + '$');
    var getAllMatches = function (string, regex) {
      const matches = [];
      let match = regex.exec(string);
      while (match) {
        const allmatches = [];
        allmatches.startIndex = regex.lastIndex - match[0].length;
        const len = match.length;
        for (let index = 0; index < len; index++) {
          allmatches.push(match[index]);
        }
        matches.push(allmatches);
        match = regex.exec(string);
      }
      return matches;
    };
    var isName = function (string) {
      const match = regexName.exec(string);
      return !(match === null || typeof match === 'undefined');
    };
    exports2.isExist = function (v) {
      return typeof v !== 'undefined';
    };
    exports2.isEmptyObject = function (obj) {
      return Object.keys(obj).length === 0;
    };
    exports2.merge = function (target, a, arrayMode) {
      if (a) {
        const keys = Object.keys(a);
        const len = keys.length;
        for (let i = 0; i < len; i++) {
          if (arrayMode === 'strict') {
            target[keys[i]] = [a[keys[i]]];
          } else {
            target[keys[i]] = a[keys[i]];
          }
        }
      }
    };
    exports2.getValue = function (v) {
      if (exports2.isExist(v)) {
        return v;
      } else {
        return '';
      }
    };
    var DANGEROUS_PROPERTY_NAMES = [
      // '__proto__',
      // 'constructor',
      // 'prototype',
      'hasOwnProperty',
      'toString',
      'valueOf',
      '__defineGetter__',
      '__defineSetter__',
      '__lookupGetter__',
      '__lookupSetter__',
    ];
    var criticalProperties = ['__proto__', 'constructor', 'prototype'];
    exports2.isName = isName;
    exports2.getAllMatches = getAllMatches;
    exports2.nameRegexp = nameRegexp;
    exports2.DANGEROUS_PROPERTY_NAMES = DANGEROUS_PROPERTY_NAMES;
    exports2.criticalProperties = criticalProperties;
  },
});

// node_modules/fast-xml-parser/src/validator.js
var require_validator2 = __commonJS({
  'node_modules/fast-xml-parser/src/validator.js'(exports2) {
    'use strict';
    var util = require_util();
    var defaultOptions = {
      allowBooleanAttributes: false,
      //A tag can have attributes without any value
      unpairedTags: [],
    };
    exports2.validate = function (xmlData, options) {
      options = Object.assign({}, defaultOptions, options);
      const tags = [];
      let tagFound = false;
      let reachedRoot = false;
      if (xmlData[0] === '\uFEFF') {
        xmlData = xmlData.substr(1);
      }
      for (let i = 0; i < xmlData.length; i++) {
        if (xmlData[i] === '<' && xmlData[i + 1] === '?') {
          i += 2;
          i = readPI(xmlData, i);
          if (i.err) return i;
        } else if (xmlData[i] === '<') {
          let tagStartPos = i;
          i++;
          if (xmlData[i] === '!') {
            i = readCommentAndCDATA(xmlData, i);
            continue;
          } else {
            let closingTag = false;
            if (xmlData[i] === '/') {
              closingTag = true;
              i++;
            }
            let tagName = '';
            for (
              ;
              i < xmlData.length &&
              xmlData[i] !== '>' &&
              xmlData[i] !== ' ' &&
              xmlData[i] !== '	' &&
              xmlData[i] !== '\n' &&
              xmlData[i] !== '\r';
              i++
            ) {
              tagName += xmlData[i];
            }
            tagName = tagName.trim();
            if (tagName[tagName.length - 1] === '/') {
              tagName = tagName.substring(0, tagName.length - 1);
              i--;
            }
            if (!validateTagName(tagName)) {
              let msg;
              if (tagName.trim().length === 0) {
                msg = "Invalid space after '<'.";
              } else {
                msg = "Tag '" + tagName + "' is an invalid name.";
              }
              return getErrorObject('InvalidTag', msg, getLineNumberForPosition(xmlData, i));
            }
            const result = readAttributeStr(xmlData, i);
            if (result === false) {
              return getErrorObject(
                'InvalidAttr',
                "Attributes for '" + tagName + "' have open quote.",
                getLineNumberForPosition(xmlData, i)
              );
            }
            let attrStr = result.value;
            i = result.index;
            if (attrStr[attrStr.length - 1] === '/') {
              const attrStrStart = i - attrStr.length;
              attrStr = attrStr.substring(0, attrStr.length - 1);
              const isValid = validateAttributeString(attrStr, options);
              if (isValid === true) {
                tagFound = true;
              } else {
                return getErrorObject(
                  isValid.err.code,
                  isValid.err.msg,
                  getLineNumberForPosition(xmlData, attrStrStart + isValid.err.line)
                );
              }
            } else if (closingTag) {
              if (!result.tagClosed) {
                return getErrorObject(
                  'InvalidTag',
                  "Closing tag '" + tagName + "' doesn't have proper closing.",
                  getLineNumberForPosition(xmlData, i)
                );
              } else if (attrStr.trim().length > 0) {
                return getErrorObject(
                  'InvalidTag',
                  "Closing tag '" + tagName + "' can't have attributes or invalid starting.",
                  getLineNumberForPosition(xmlData, tagStartPos)
                );
              } else if (tags.length === 0) {
                return getErrorObject(
                  'InvalidTag',
                  "Closing tag '" + tagName + "' has not been opened.",
                  getLineNumberForPosition(xmlData, tagStartPos)
                );
              } else {
                const otg = tags.pop();
                if (tagName !== otg.tagName) {
                  let openPos = getLineNumberForPosition(xmlData, otg.tagStartPos);
                  return getErrorObject(
                    'InvalidTag',
                    "Expected closing tag '" +
                      otg.tagName +
                      "' (opened in line " +
                      openPos.line +
                      ', col ' +
                      openPos.col +
                      ") instead of closing tag '" +
                      tagName +
                      "'.",
                    getLineNumberForPosition(xmlData, tagStartPos)
                  );
                }
                if (tags.length == 0) {
                  reachedRoot = true;
                }
              }
            } else {
              const isValid = validateAttributeString(attrStr, options);
              if (isValid !== true) {
                return getErrorObject(
                  isValid.err.code,
                  isValid.err.msg,
                  getLineNumberForPosition(xmlData, i - attrStr.length + isValid.err.line)
                );
              }
              if (reachedRoot === true) {
                return getErrorObject(
                  'InvalidXml',
                  'Multiple possible root nodes found.',
                  getLineNumberForPosition(xmlData, i)
                );
              } else if (options.unpairedTags.indexOf(tagName) !== -1) {
              } else {
                tags.push({ tagName, tagStartPos });
              }
              tagFound = true;
            }
            for (i++; i < xmlData.length; i++) {
              if (xmlData[i] === '<') {
                if (xmlData[i + 1] === '!') {
                  i++;
                  i = readCommentAndCDATA(xmlData, i);
                  continue;
                } else if (xmlData[i + 1] === '?') {
                  i = readPI(xmlData, ++i);
                  if (i.err) return i;
                } else {
                  break;
                }
              } else if (xmlData[i] === '&') {
                const afterAmp = validateAmpersand(xmlData, i);
                if (afterAmp == -1)
                  return getErrorObject(
                    'InvalidChar',
                    "char '&' is not expected.",
                    getLineNumberForPosition(xmlData, i)
                  );
                i = afterAmp;
              } else {
                if (reachedRoot === true && !isWhiteSpace(xmlData[i])) {
                  return getErrorObject(
                    'InvalidXml',
                    'Extra text at the end',
                    getLineNumberForPosition(xmlData, i)
                  );
                }
              }
            }
            if (xmlData[i] === '<') {
              i--;
            }
          }
        } else {
          if (isWhiteSpace(xmlData[i])) {
            continue;
          }
          return getErrorObject(
            'InvalidChar',
            "char '" + xmlData[i] + "' is not expected.",
            getLineNumberForPosition(xmlData, i)
          );
        }
      }
      if (!tagFound) {
        return getErrorObject('InvalidXml', 'Start tag expected.', 1);
      } else if (tags.length == 1) {
        return getErrorObject(
          'InvalidTag',
          "Unclosed tag '" + tags[0].tagName + "'.",
          getLineNumberForPosition(xmlData, tags[0].tagStartPos)
        );
      } else if (tags.length > 0) {
        return getErrorObject(
          'InvalidXml',
          "Invalid '" +
            JSON.stringify(
              tags.map((t) => t.tagName),
              null,
              4
            ).replace(/\r?\n/g, '') +
            "' found.",
          { line: 1, col: 1 }
        );
      }
      return true;
    };
    function isWhiteSpace(char) {
      return char === ' ' || char === '	' || char === '\n' || char === '\r';
    }
    function readPI(xmlData, i) {
      const start = i;
      for (; i < xmlData.length; i++) {
        if (xmlData[i] == '?' || xmlData[i] == ' ') {
          const tagname = xmlData.substr(start, i - start);
          if (i > 5 && tagname === 'xml') {
            return getErrorObject(
              'InvalidXml',
              'XML declaration allowed only at the start of the document.',
              getLineNumberForPosition(xmlData, i)
            );
          } else if (xmlData[i] == '?' && xmlData[i + 1] == '>') {
            i++;
            break;
          } else {
            continue;
          }
        }
      }
      return i;
    }
    function readCommentAndCDATA(xmlData, i) {
      if (xmlData.length > i + 5 && xmlData[i + 1] === '-' && xmlData[i + 2] === '-') {
        for (i += 3; i < xmlData.length; i++) {
          if (xmlData[i] === '-' && xmlData[i + 1] === '-' && xmlData[i + 2] === '>') {
            i += 2;
            break;
          }
        }
      } else if (
        xmlData.length > i + 8 &&
        xmlData[i + 1] === 'D' &&
        xmlData[i + 2] === 'O' &&
        xmlData[i + 3] === 'C' &&
        xmlData[i + 4] === 'T' &&
        xmlData[i + 5] === 'Y' &&
        xmlData[i + 6] === 'P' &&
        xmlData[i + 7] === 'E'
      ) {
        let angleBracketsCount = 1;
        for (i += 8; i < xmlData.length; i++) {
          if (xmlData[i] === '<') {
            angleBracketsCount++;
          } else if (xmlData[i] === '>') {
            angleBracketsCount--;
            if (angleBracketsCount === 0) {
              break;
            }
          }
        }
      } else if (
        xmlData.length > i + 9 &&
        xmlData[i + 1] === '[' &&
        xmlData[i + 2] === 'C' &&
        xmlData[i + 3] === 'D' &&
        xmlData[i + 4] === 'A' &&
        xmlData[i + 5] === 'T' &&
        xmlData[i + 6] === 'A' &&
        xmlData[i + 7] === '['
      ) {
        for (i += 8; i < xmlData.length; i++) {
          if (xmlData[i] === ']' && xmlData[i + 1] === ']' && xmlData[i + 2] === '>') {
            i += 2;
            break;
          }
        }
      }
      return i;
    }
    var doubleQuote = '"';
    var singleQuote = "'";
    function readAttributeStr(xmlData, i) {
      let attrStr = '';
      let startChar = '';
      let tagClosed = false;
      for (; i < xmlData.length; i++) {
        if (xmlData[i] === doubleQuote || xmlData[i] === singleQuote) {
          if (startChar === '') {
            startChar = xmlData[i];
          } else if (startChar !== xmlData[i]) {
          } else {
            startChar = '';
          }
        } else if (xmlData[i] === '>') {
          if (startChar === '') {
            tagClosed = true;
            break;
          }
        }
        attrStr += xmlData[i];
      }
      if (startChar !== '') {
        return false;
      }
      return {
        value: attrStr,
        index: i,
        tagClosed,
      };
    }
    var validAttrStrRegxp = new RegExp(
      `(\\s*)([^\\s=]+)(\\s*=)?(\\s*(['"])(([\\s\\S])*?)\\5)?`,
      'g'
    );
    function validateAttributeString(attrStr, options) {
      const matches = util.getAllMatches(attrStr, validAttrStrRegxp);
      const attrNames = {};
      for (let i = 0; i < matches.length; i++) {
        if (matches[i][1].length === 0) {
          return getErrorObject(
            'InvalidAttr',
            "Attribute '" + matches[i][2] + "' has no space in starting.",
            getPositionFromMatch(matches[i])
          );
        } else if (matches[i][3] !== void 0 && matches[i][4] === void 0) {
          return getErrorObject(
            'InvalidAttr',
            "Attribute '" + matches[i][2] + "' is without value.",
            getPositionFromMatch(matches[i])
          );
        } else if (matches[i][3] === void 0 && !options.allowBooleanAttributes) {
          return getErrorObject(
            'InvalidAttr',
            "boolean attribute '" + matches[i][2] + "' is not allowed.",
            getPositionFromMatch(matches[i])
          );
        }
        const attrName = matches[i][2];
        if (!validateAttrName(attrName)) {
          return getErrorObject(
            'InvalidAttr',
            "Attribute '" + attrName + "' is an invalid name.",
            getPositionFromMatch(matches[i])
          );
        }
        if (!attrNames.hasOwnProperty(attrName)) {
          attrNames[attrName] = 1;
        } else {
          return getErrorObject(
            'InvalidAttr',
            "Attribute '" + attrName + "' is repeated.",
            getPositionFromMatch(matches[i])
          );
        }
      }
      return true;
    }
    function validateNumberAmpersand(xmlData, i) {
      let re = /\d/;
      if (xmlData[i] === 'x') {
        i++;
        re = /[\da-fA-F]/;
      }
      for (; i < xmlData.length; i++) {
        if (xmlData[i] === ';') return i;
        if (!xmlData[i].match(re)) break;
      }
      return -1;
    }
    function validateAmpersand(xmlData, i) {
      i++;
      if (xmlData[i] === ';') return -1;
      if (xmlData[i] === '#') {
        i++;
        return validateNumberAmpersand(xmlData, i);
      }
      let count = 0;
      for (; i < xmlData.length; i++, count++) {
        if (xmlData[i].match(/\w/) && count < 20) continue;
        if (xmlData[i] === ';') break;
        return -1;
      }
      return i;
    }
    function getErrorObject(code, message, lineNumber) {
      return {
        err: {
          code,
          msg: message,
          line: lineNumber.line || lineNumber,
          col: lineNumber.col,
        },
      };
    }
    function validateAttrName(attrName) {
      return util.isName(attrName);
    }
    function validateTagName(tagname) {
      return util.isName(tagname);
    }
    function getLineNumberForPosition(xmlData, index) {
      const lines = xmlData.substring(0, index).split(/\r?\n/);
      return {
        line: lines.length,
        // column number is last line's length + 1, because column numbering starts at 1:
        col: lines[lines.length - 1].length + 1,
      };
    }
    function getPositionFromMatch(match) {
      return match.startIndex + match[1].length;
    }
  },
});

// node_modules/fast-xml-parser/src/xmlparser/OptionsBuilder.js
var require_OptionsBuilder = __commonJS({
  'node_modules/fast-xml-parser/src/xmlparser/OptionsBuilder.js'(exports2) {
    var { DANGEROUS_PROPERTY_NAMES, criticalProperties } = require_util();
    var defaultOnDangerousProperty = (name) => {
      if (DANGEROUS_PROPERTY_NAMES.includes(name)) {
        return '__' + name;
      }
      return name;
    };
    var defaultOptions = {
      preserveOrder: false,
      attributeNamePrefix: '@_',
      attributesGroupName: false,
      textNodeName: '#text',
      ignoreAttributes: true,
      removeNSPrefix: false,
      // remove NS from tag name or attribute name if true
      allowBooleanAttributes: false,
      //a tag can have attributes without any value
      //ignoreRootElement : false,
      parseTagValue: true,
      parseAttributeValue: false,
      trimValues: true,
      //Trim string values of tag and attributes
      cdataPropName: false,
      numberParseOptions: {
        hex: true,
        leadingZeros: true,
        eNotation: true,
      },
      tagValueProcessor: function (tagName, val) {
        return val;
      },
      attributeValueProcessor: function (attrName, val) {
        return val;
      },
      stopNodes: [],
      //nested tags will not be parsed even for errors
      alwaysCreateTextNode: false,
      isArray: () => false,
      commentPropName: false,
      unpairedTags: [],
      processEntities: true,
      htmlEntities: false,
      ignoreDeclaration: false,
      ignorePiTags: false,
      transformTagName: false,
      transformAttributeName: false,
      updateTag: function (tagName, jPath, attrs) {
        return tagName;
      },
      // skipEmptyListItem: false
      captureMetaData: false,
      maxNestedTags: 100,
      strictReservedNames: true,
      onDangerousProperty: defaultOnDangerousProperty,
    };
    function validatePropertyName(propertyName, optionName) {
      if (typeof propertyName !== 'string') {
        return;
      }
      const normalized = propertyName.toLowerCase();
      if (DANGEROUS_PROPERTY_NAMES.some((dangerous) => normalized === dangerous.toLowerCase())) {
        throw new Error(
          `[SECURITY] Invalid ${optionName}: "${propertyName}" is a reserved JavaScript keyword that could cause prototype pollution`
        );
      }
      if (criticalProperties.some((dangerous) => normalized === dangerous.toLowerCase())) {
        throw new Error(
          `[SECURITY] Invalid ${optionName}: "${propertyName}" is a reserved JavaScript keyword that could cause prototype pollution`
        );
      }
    }
    function normalizeProcessEntities(value) {
      if (typeof value === 'boolean') {
        return {
          enabled: value,
          // true or false
          maxEntitySize: 1e4,
          maxExpansionDepth: 10,
          maxTotalExpansions: 1e3,
          maxExpandedLength: 1e5,
          allowedTags: null,
          tagFilter: null,
        };
      }
      if (typeof value === 'object' && value !== null) {
        return {
          enabled: value.enabled !== false,
          maxEntitySize: Math.max(1, value.maxEntitySize ?? 1e4),
          maxExpansionDepth: Math.max(1, value.maxExpansionDepth ?? 1e4),
          maxTotalExpansions: Math.max(1, value.maxTotalExpansions ?? Infinity),
          maxExpandedLength: Math.max(1, value.maxExpandedLength ?? 1e5),
          maxEntityCount: Math.max(1, value.maxEntityCount ?? 1e3),
          allowedTags: value.allowedTags ?? null,
          tagFilter: value.tagFilter ?? null,
        };
      }
      return normalizeProcessEntities(true);
    }
    var buildOptions = function (options) {
      const built = Object.assign({}, defaultOptions, options);
      const propertyNameOptions = [
        { value: built.attributeNamePrefix, name: 'attributeNamePrefix' },
        { value: built.attributesGroupName, name: 'attributesGroupName' },
        { value: built.textNodeName, name: 'textNodeName' },
        { value: built.cdataPropName, name: 'cdataPropName' },
        { value: built.commentPropName, name: 'commentPropName' },
      ];
      for (const { value, name } of propertyNameOptions) {
        if (value) {
          validatePropertyName(value, name);
        }
      }
      if (built.onDangerousProperty === null) {
        built.onDangerousProperty = defaultOnDangerousProperty;
      }
      built.processEntities = normalizeProcessEntities(built.processEntities);
      return built;
    };
    exports2.buildOptions = buildOptions;
    exports2.defaultOptions = defaultOptions;
  },
});

// node_modules/fast-xml-parser/src/xmlparser/xmlNode.js
var require_xmlNode = __commonJS({
  'node_modules/fast-xml-parser/src/xmlparser/xmlNode.js'(exports2, module2) {
    'use strict';
    var XmlNode = class {
      constructor(tagname) {
        this.tagname = tagname;
        this.child = [];
        this[':@'] = {};
      }
      add(key, val) {
        if (key === '__proto__') key = '#__proto__';
        this.child.push({ [key]: val });
      }
      addChild(node) {
        if (node.tagname === '__proto__') node.tagname = '#__proto__';
        if (node[':@'] && Object.keys(node[':@']).length > 0) {
          this.child.push({ [node.tagname]: node.child, [':@']: node[':@'] });
        } else {
          this.child.push({ [node.tagname]: node.child });
        }
      }
    };
    module2.exports = XmlNode;
  },
});

// node_modules/fast-xml-parser/src/xmlparser/DocTypeReader.js
var require_DocTypeReader = __commonJS({
  'node_modules/fast-xml-parser/src/xmlparser/DocTypeReader.js'(exports2, module2) {
    var util = require_util();
    var DocTypeReader = class {
      constructor(options) {
        this.suppressValidationErr = !options;
        this.options = options || {};
      }
      readDocType(xmlData, i) {
        const entities = /* @__PURE__ */ Object.create(null);
        let entityCount = 0;
        if (
          xmlData[i + 3] === 'O' &&
          xmlData[i + 4] === 'C' &&
          xmlData[i + 5] === 'T' &&
          xmlData[i + 6] === 'Y' &&
          xmlData[i + 7] === 'P' &&
          xmlData[i + 8] === 'E'
        ) {
          i = i + 9;
          let angleBracketsCount = 1;
          let hasBody = false,
            comment = false;
          let exp = '';
          for (; i < xmlData.length; i++) {
            if (xmlData[i] === '<' && !comment) {
              if (hasBody && hasSeq(xmlData, '!ENTITY', i)) {
                i += 7;
                let entityName, val;
                [entityName, val, i] = this.readEntityExp(
                  xmlData,
                  i + 1,
                  this.suppressValidationErr
                );
                if (val.indexOf('&') === -1) {
                  if (
                    this.options.enabled !== false &&
                    this.options.maxEntityCount != null &&
                    entityCount >= this.options.maxEntityCount
                  ) {
                    throw new Error(
                      `Entity count (${entityCount + 1}) exceeds maximum allowed (${this.options.maxEntityCount})`
                    );
                  }
                  const escaped = entityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                  entities[entityName] = {
                    regx: RegExp(`&${escaped};`, 'g'),
                    val,
                  };
                  entityCount++;
                }
              } else if (hasBody && hasSeq(xmlData, '!ELEMENT', i)) {
                i += 8;
                const { index } = this.readElementExp(xmlData, i + 1);
                i = index;
              } else if (hasBody && hasSeq(xmlData, '!ATTLIST', i)) {
                i += 8;
              } else if (hasBody && hasSeq(xmlData, '!NOTATION', i)) {
                i += 9;
                const { index } = this.readNotationExp(xmlData, i + 1, this.suppressValidationErr);
                i = index;
              } else if (hasSeq(xmlData, '!--', i)) {
                comment = true;
              } else {
                throw new Error(`Invalid DOCTYPE`);
              }
              angleBracketsCount++;
              exp = '';
            } else if (xmlData[i] === '>') {
              if (comment) {
                if (xmlData[i - 1] === '-' && xmlData[i - 2] === '-') {
                  comment = false;
                  angleBracketsCount--;
                }
              } else {
                angleBracketsCount--;
              }
              if (angleBracketsCount === 0) {
                break;
              }
            } else if (xmlData[i] === '[') {
              hasBody = true;
            } else {
              exp += xmlData[i];
            }
          }
          if (angleBracketsCount !== 0) {
            throw new Error(`Unclosed DOCTYPE`);
          }
        } else {
          throw new Error(`Invalid Tag instead of DOCTYPE`);
        }
        return { entities, i };
      }
      readEntityExp(xmlData, i) {
        i = skipWhitespace(xmlData, i);
        let entityName = '';
        while (
          i < xmlData.length &&
          !/\s/.test(xmlData[i]) &&
          xmlData[i] !== '"' &&
          xmlData[i] !== "'"
        ) {
          entityName += xmlData[i];
          i++;
        }
        validateEntityName(entityName);
        i = skipWhitespace(xmlData, i);
        if (!this.suppressValidationErr) {
          if (xmlData.substring(i, i + 6).toUpperCase() === 'SYSTEM') {
            throw new Error('External entities are not supported');
          } else if (xmlData[i] === '%') {
            throw new Error('Parameter entities are not supported');
          }
        }
        let entityValue = '';
        [i, entityValue] = this.readIdentifierVal(xmlData, i, 'entity');
        if (
          this.options.enabled !== false &&
          this.options.maxEntitySize != null &&
          entityValue.length > this.options.maxEntitySize
        ) {
          throw new Error(
            `Entity "${entityName}" size (${entityValue.length}) exceeds maximum allowed size (${this.options.maxEntitySize})`
          );
        }
        i--;
        return [entityName, entityValue, i];
      }
      readNotationExp(xmlData, i) {
        i = skipWhitespace(xmlData, i);
        let notationName = '';
        while (i < xmlData.length && !/\s/.test(xmlData[i])) {
          notationName += xmlData[i];
          i++;
        }
        !this.suppressValidationErr && validateEntityName(notationName);
        i = skipWhitespace(xmlData, i);
        const identifierType = xmlData.substring(i, i + 6).toUpperCase();
        if (
          !this.suppressValidationErr &&
          identifierType !== 'SYSTEM' &&
          identifierType !== 'PUBLIC'
        ) {
          throw new Error(`Expected SYSTEM or PUBLIC, found "${identifierType}"`);
        }
        i += identifierType.length;
        i = skipWhitespace(xmlData, i);
        let publicIdentifier = null;
        let systemIdentifier = null;
        if (identifierType === 'PUBLIC') {
          [i, publicIdentifier] = this.readIdentifierVal(xmlData, i, 'publicIdentifier');
          i = skipWhitespace(xmlData, i);
          if (xmlData[i] === '"' || xmlData[i] === "'") {
            [i, systemIdentifier] = this.readIdentifierVal(xmlData, i, 'systemIdentifier');
          }
        } else if (identifierType === 'SYSTEM') {
          [i, systemIdentifier] = this.readIdentifierVal(xmlData, i, 'systemIdentifier');
          if (!this.suppressValidationErr && !systemIdentifier) {
            throw new Error('Missing mandatory system identifier for SYSTEM notation');
          }
        }
        return { notationName, publicIdentifier, systemIdentifier, index: --i };
      }
      readIdentifierVal(xmlData, i, type) {
        let identifierVal = '';
        const startChar = xmlData[i];
        if (startChar !== '"' && startChar !== "'") {
          throw new Error(`Expected quoted string, found "${startChar}"`);
        }
        i++;
        while (i < xmlData.length && xmlData[i] !== startChar) {
          identifierVal += xmlData[i];
          i++;
        }
        if (xmlData[i] !== startChar) {
          throw new Error(`Unterminated ${type} value`);
        }
        i++;
        return [i, identifierVal];
      }
      readElementExp(xmlData, i) {
        i = skipWhitespace(xmlData, i);
        let elementName = '';
        while (i < xmlData.length && !/\s/.test(xmlData[i])) {
          elementName += xmlData[i];
          i++;
        }
        if (!this.suppressValidationErr && !util.isName(elementName)) {
          throw new Error(`Invalid element name: "${elementName}"`);
        }
        i = skipWhitespace(xmlData, i);
        let contentModel = '';
        if (xmlData[i] === 'E' && hasSeq(xmlData, 'MPTY', i)) {
          i += 4;
        } else if (xmlData[i] === 'A' && hasSeq(xmlData, 'NY', i)) {
          i += 2;
        } else if (xmlData[i] === '(') {
          i++;
          while (i < xmlData.length && xmlData[i] !== ')') {
            contentModel += xmlData[i];
            i++;
          }
          if (xmlData[i] !== ')') {
            throw new Error('Unterminated content model');
          }
        } else if (!this.suppressValidationErr) {
          throw new Error(`Invalid Element Expression, found "${xmlData[i]}"`);
        }
        return {
          elementName,
          contentModel: contentModel.trim(),
          index: i,
        };
      }
      readAttlistExp(xmlData, i) {
        i = skipWhitespace(xmlData, i);
        let elementName = '';
        while (i < xmlData.length && !/\s/.test(xmlData[i])) {
          elementName += xmlData[i];
          i++;
        }
        validateEntityName(elementName);
        i = skipWhitespace(xmlData, i);
        let attributeName = '';
        while (i < xmlData.length && !/\s/.test(xmlData[i])) {
          attributeName += xmlData[i];
          i++;
        }
        if (!validateEntityName(attributeName)) {
          throw new Error(`Invalid attribute name: "${attributeName}"`);
        }
        i = skipWhitespace(xmlData, i);
        let attributeType = '';
        if (xmlData.substring(i, i + 8).toUpperCase() === 'NOTATION') {
          attributeType = 'NOTATION';
          i += 8;
          i = skipWhitespace(xmlData, i);
          if (xmlData[i] !== '(') {
            throw new Error(`Expected '(', found "${xmlData[i]}"`);
          }
          i++;
          let allowedNotations = [];
          while (i < xmlData.length && xmlData[i] !== ')') {
            let notation = '';
            while (i < xmlData.length && xmlData[i] !== '|' && xmlData[i] !== ')') {
              notation += xmlData[i];
              i++;
            }
            notation = notation.trim();
            if (!validateEntityName(notation)) {
              throw new Error(`Invalid notation name: "${notation}"`);
            }
            allowedNotations.push(notation);
            if (xmlData[i] === '|') {
              i++;
              i = skipWhitespace(xmlData, i);
            }
          }
          if (xmlData[i] !== ')') {
            throw new Error('Unterminated list of notations');
          }
          i++;
          attributeType += ' (' + allowedNotations.join('|') + ')';
        } else {
          while (i < xmlData.length && !/\s/.test(xmlData[i])) {
            attributeType += xmlData[i];
            i++;
          }
          const validTypes = [
            'CDATA',
            'ID',
            'IDREF',
            'IDREFS',
            'ENTITY',
            'ENTITIES',
            'NMTOKEN',
            'NMTOKENS',
          ];
          if (!this.suppressValidationErr && !validTypes.includes(attributeType.toUpperCase())) {
            throw new Error(`Invalid attribute type: "${attributeType}"`);
          }
        }
        i = skipWhitespace(xmlData, i);
        let defaultValue = '';
        if (xmlData.substring(i, i + 8).toUpperCase() === '#REQUIRED') {
          defaultValue = '#REQUIRED';
          i += 8;
        } else if (xmlData.substring(i, i + 7).toUpperCase() === '#IMPLIED') {
          defaultValue = '#IMPLIED';
          i += 7;
        } else {
          [i, defaultValue] = this.readIdentifierVal(xmlData, i, 'ATTLIST');
        }
        return {
          elementName,
          attributeName,
          attributeType,
          defaultValue,
          index: i,
        };
      }
    };
    var skipWhitespace = (data, index) => {
      while (index < data.length && /\s/.test(data[index])) {
        index++;
      }
      return index;
    };
    function hasSeq(data, seq, i) {
      for (let j = 0; j < seq.length; j++) {
        if (seq[j] !== data[i + j + 1]) return false;
      }
      return true;
    }
    function validateEntityName(name) {
      if (util.isName(name)) return name;
      else throw new Error(`Invalid entity name ${name}`);
    }
    module2.exports = DocTypeReader;
  },
});

// node_modules/strnum/strnum.js
var require_strnum = __commonJS({
  'node_modules/strnum/strnum.js'(exports2, module2) {
    var hexRegex = /^[-+]?0x[a-fA-F0-9]+$/;
    var numRegex = /^([\-\+])?(0*)([0-9]*(\.[0-9]*)?)$/;
    var consider = {
      hex: true,
      // oct: false,
      leadingZeros: true,
      decimalPoint: '.',
      eNotation: true,
      //skipLike: /regex/
    };
    function toNumber(str, options = {}) {
      options = Object.assign({}, consider, options);
      if (!str || typeof str !== 'string') return str;
      let trimmedStr = str.trim();
      if (options.skipLike !== void 0 && options.skipLike.test(trimmedStr)) return str;
      else if (str === '0') return 0;
      else if (options.hex && hexRegex.test(trimmedStr)) {
        return parse_int(trimmedStr, 16);
      } else if (trimmedStr.search(/[eE]/) !== -1) {
        const notation = trimmedStr.match(/^([-\+])?(0*)([0-9]*(\.[0-9]*)?[eE][-\+]?[0-9]+)$/);
        if (notation) {
          if (options.leadingZeros) {
            trimmedStr = (notation[1] || '') + notation[3];
          } else {
            if (notation[2] === '0' && notation[3][0] === '.') {
            } else {
              return str;
            }
          }
          return options.eNotation ? Number(trimmedStr) : str;
        } else {
          return str;
        }
      } else {
        const match = numRegex.exec(trimmedStr);
        if (match) {
          const sign = match[1];
          const leadingZeros = match[2];
          let numTrimmedByZeros = trimZeros(match[3]);
          if (!options.leadingZeros && leadingZeros.length > 0 && sign && trimmedStr[2] !== '.')
            return str;
          else if (
            !options.leadingZeros &&
            leadingZeros.length > 0 &&
            !sign &&
            trimmedStr[1] !== '.'
          )
            return str;
          else if (options.leadingZeros && leadingZeros === str) return 0;
          else {
            const num = Number(trimmedStr);
            const numStr = '' + num;
            if (numStr.search(/[eE]/) !== -1) {
              if (options.eNotation) return num;
              else return str;
            } else if (trimmedStr.indexOf('.') !== -1) {
              if (numStr === '0' && numTrimmedByZeros === '') return num;
              else if (numStr === numTrimmedByZeros) return num;
              else if (sign && numStr === '-' + numTrimmedByZeros) return num;
              else return str;
            }
            if (leadingZeros) {
              return numTrimmedByZeros === numStr || sign + numTrimmedByZeros === numStr
                ? num
                : str;
            } else {
              return trimmedStr === numStr || trimmedStr === sign + numStr ? num : str;
            }
          }
        } else {
          return str;
        }
      }
    }
    function trimZeros(numStr) {
      if (numStr && numStr.indexOf('.') !== -1) {
        numStr = numStr.replace(/0+$/, '');
        if (numStr === '.') numStr = '0';
        else if (numStr[0] === '.') numStr = '0' + numStr;
        else if (numStr[numStr.length - 1] === '.') numStr = numStr.substr(0, numStr.length - 1);
        return numStr;
      }
      return numStr;
    }
    function parse_int(numStr, base) {
      if (parseInt) return parseInt(numStr, base);
      else if (Number.parseInt) return Number.parseInt(numStr, base);
      else if (window && window.parseInt) return window.parseInt(numStr, base);
      else throw new Error('parseInt, Number.parseInt, window.parseInt are not supported');
    }
    module2.exports = toNumber;
  },
});

// node_modules/fast-xml-parser/src/ignoreAttributes.js
var require_ignoreAttributes = __commonJS({
  'node_modules/fast-xml-parser/src/ignoreAttributes.js'(exports2, module2) {
    function getIgnoreAttributesFn(ignoreAttributes) {
      if (typeof ignoreAttributes === 'function') {
        return ignoreAttributes;
      }
      if (Array.isArray(ignoreAttributes)) {
        return (attrName) => {
          for (const pattern of ignoreAttributes) {
            if (typeof pattern === 'string' && attrName === pattern) {
              return true;
            }
            if (pattern instanceof RegExp && pattern.test(attrName)) {
              return true;
            }
          }
        };
      }
      return () => false;
    }
    module2.exports = getIgnoreAttributesFn;
  },
});

// node_modules/fast-xml-parser/src/xmlparser/OrderedObjParser.js
var require_OrderedObjParser = __commonJS({
  'node_modules/fast-xml-parser/src/xmlparser/OrderedObjParser.js'(exports2, module2) {
    'use strict';
    var util = require_util();
    var xmlNode = require_xmlNode();
    var DocTypeReader = require_DocTypeReader();
    var toNumber = require_strnum();
    var getIgnoreAttributesFn = require_ignoreAttributes();
    var OrderedObjParser = class {
      constructor(options) {
        this.options = options;
        this.currentNode = null;
        this.tagsNodeStack = [];
        this.docTypeEntities = {};
        this.lastEntities = {
          apos: { regex: /&(apos|#39|#x27);/g, val: "'" },
          gt: { regex: /&(gt|#62|#x3E);/g, val: '>' },
          lt: { regex: /&(lt|#60|#x3C);/g, val: '<' },
          quot: { regex: /&(quot|#34|#x22);/g, val: '"' },
        };
        this.ampEntity = { regex: /&(amp|#38|#x26);/g, val: '&' };
        this.htmlEntities = {
          space: { regex: /&(nbsp|#160);/g, val: ' ' },
          // "lt" : { regex: /&(lt|#60);/g, val: "<" },
          // "gt" : { regex: /&(gt|#62);/g, val: ">" },
          // "amp" : { regex: /&(amp|#38);/g, val: "&" },
          // "quot" : { regex: /&(quot|#34);/g, val: "\"" },
          // "apos" : { regex: /&(apos|#39);/g, val: "'" },
          cent: { regex: /&(cent|#162);/g, val: '\xA2' },
          pound: { regex: /&(pound|#163);/g, val: '\xA3' },
          yen: { regex: /&(yen|#165);/g, val: '\xA5' },
          euro: { regex: /&(euro|#8364);/g, val: '\u20AC' },
          copyright: { regex: /&(copy|#169);/g, val: '\xA9' },
          reg: { regex: /&(reg|#174);/g, val: '\xAE' },
          inr: { regex: /&(inr|#8377);/g, val: '\u20B9' },
          num_dec: { regex: /&#([0-9]{1,7});/g, val: (_, str) => fromCodePoint(str, 10, '&#') },
          num_hex: {
            regex: /&#x([0-9a-fA-F]{1,6});/g,
            val: (_, str) => fromCodePoint(str, 16, '&#x'),
          },
        };
        this.addExternalEntities = addExternalEntities;
        this.parseXml = parseXml;
        this.parseTextData = parseTextData;
        this.resolveNameSpace = resolveNameSpace;
        this.buildAttributesMap = buildAttributesMap;
        this.isItStopNode = isItStopNode;
        this.replaceEntitiesValue = replaceEntitiesValue;
        this.readStopNodeData = readStopNodeData;
        this.saveTextToParentTag = saveTextToParentTag;
        this.addChild = addChild;
        this.ignoreAttributesFn = getIgnoreAttributesFn(this.options.ignoreAttributes);
        this.entityExpansionCount = 0;
        this.currentExpandedLength = 0;
        if (this.options.stopNodes && this.options.stopNodes.length > 0) {
          this.stopNodesExact = /* @__PURE__ */ new Set();
          this.stopNodesWildcard = /* @__PURE__ */ new Set();
          for (let i = 0; i < this.options.stopNodes.length; i++) {
            const stopNodeExp = this.options.stopNodes[i];
            if (typeof stopNodeExp !== 'string') continue;
            if (stopNodeExp.startsWith('*.')) {
              this.stopNodesWildcard.add(stopNodeExp.substring(2));
            } else {
              this.stopNodesExact.add(stopNodeExp);
            }
          }
        }
      }
    };
    function addExternalEntities(externalEntities) {
      const entKeys = Object.keys(externalEntities);
      for (let i = 0; i < entKeys.length; i++) {
        const ent = entKeys[i];
        const escaped = ent.replace(/[.\-+*:]/g, '\\.');
        this.lastEntities[ent] = {
          regex: new RegExp('&' + escaped + ';', 'g'),
          val: externalEntities[ent],
        };
      }
    }
    function parseTextData(
      val,
      tagName,
      jPath,
      dontTrim,
      hasAttributes,
      isLeafNode,
      escapeEntities
    ) {
      if (val !== void 0) {
        if (this.options.trimValues && !dontTrim) {
          val = val.trim();
        }
        if (val.length > 0) {
          if (!escapeEntities) val = this.replaceEntitiesValue(val, tagName, jPath);
          const newval = this.options.tagValueProcessor(
            tagName,
            val,
            jPath,
            hasAttributes,
            isLeafNode
          );
          if (newval === null || newval === void 0) {
            return val;
          } else if (typeof newval !== typeof val || newval !== val) {
            return newval;
          } else if (this.options.trimValues) {
            return parseValue(val, this.options.parseTagValue, this.options.numberParseOptions);
          } else {
            const trimmedVal = val.trim();
            if (trimmedVal === val) {
              return parseValue(val, this.options.parseTagValue, this.options.numberParseOptions);
            } else {
              return val;
            }
          }
        }
      }
    }
    function resolveNameSpace(tagname) {
      if (this.options.removeNSPrefix) {
        const tags = tagname.split(':');
        const prefix = tagname.charAt(0) === '/' ? '/' : '';
        if (tags[0] === 'xmlns') {
          return '';
        }
        if (tags.length === 2) {
          tagname = prefix + tags[1];
        }
      }
      return tagname;
    }
    var attrsRegx = new RegExp(`([^\\s=]+)\\s*(=\\s*(['"])([\\s\\S]*?)\\3)?`, 'gm');
    function buildAttributesMap(attrStr, jPath, tagName) {
      if (this.options.ignoreAttributes !== true && typeof attrStr === 'string') {
        const matches = util.getAllMatches(attrStr, attrsRegx);
        const len = matches.length;
        const attrs = {};
        for (let i = 0; i < len; i++) {
          const attrName = this.resolveNameSpace(matches[i][1]);
          if (this.ignoreAttributesFn(attrName, jPath)) {
            continue;
          }
          let oldVal = matches[i][4];
          let aName = this.options.attributeNamePrefix + attrName;
          if (attrName.length) {
            if (this.options.transformAttributeName) {
              aName = this.options.transformAttributeName(aName);
            }
            aName = sanitizeName(aName, this.options);
            if (oldVal !== void 0) {
              if (this.options.trimValues) {
                oldVal = oldVal.trim();
              }
              oldVal = this.replaceEntitiesValue(oldVal, tagName, jPath);
              const newVal = this.options.attributeValueProcessor(attrName, oldVal, jPath);
              if (newVal === null || newVal === void 0) {
                attrs[aName] = oldVal;
              } else if (typeof newVal !== typeof oldVal || newVal !== oldVal) {
                attrs[aName] = newVal;
              } else {
                attrs[aName] = parseValue(
                  oldVal,
                  this.options.parseAttributeValue,
                  this.options.numberParseOptions
                );
              }
            } else if (this.options.allowBooleanAttributes) {
              attrs[aName] = true;
            }
          }
        }
        if (!Object.keys(attrs).length) {
          return;
        }
        if (this.options.attributesGroupName) {
          const attrCollection = {};
          attrCollection[this.options.attributesGroupName] = attrs;
          return attrCollection;
        }
        return attrs;
      }
    }
    var parseXml = function (xmlData) {
      xmlData = xmlData.replace(/\r\n?/g, '\n');
      const xmlObj = new xmlNode('!xml');
      let currentNode = xmlObj;
      let textData = '';
      let jPath = '';
      this.entityExpansionCount = 0;
      this.currentExpandedLength = 0;
      const docTypeReader = new DocTypeReader(this.options.processEntities);
      for (let i = 0; i < xmlData.length; i++) {
        const ch = xmlData[i];
        if (ch === '<') {
          if (xmlData[i + 1] === '/') {
            const closeIndex = findClosingIndex(xmlData, '>', i, 'Closing Tag is not closed.');
            let tagName = xmlData.substring(i + 2, closeIndex).trim();
            if (this.options.removeNSPrefix) {
              const colonIndex = tagName.indexOf(':');
              if (colonIndex !== -1) {
                tagName = tagName.substr(colonIndex + 1);
              }
            }
            if (this.options.transformTagName) {
              tagName = this.options.transformTagName(tagName);
            }
            if (currentNode) {
              textData = this.saveTextToParentTag(textData, currentNode, jPath);
            }
            const lastTagName = jPath.substring(jPath.lastIndexOf('.') + 1);
            if (tagName && this.options.unpairedTags.indexOf(tagName) !== -1) {
              throw new Error(`Unpaired tag can not be used as closing tag: </${tagName}>`);
            }
            let propIndex = 0;
            if (lastTagName && this.options.unpairedTags.indexOf(lastTagName) !== -1) {
              propIndex = jPath.lastIndexOf('.', jPath.lastIndexOf('.') - 1);
              this.tagsNodeStack.pop();
            } else {
              propIndex = jPath.lastIndexOf('.');
            }
            jPath = jPath.substring(0, propIndex);
            currentNode = this.tagsNodeStack.pop();
            textData = '';
            i = closeIndex;
          } else if (xmlData[i + 1] === '?') {
            let tagData = readTagExp(xmlData, i, false, '?>');
            if (!tagData) throw new Error('Pi Tag is not closed.');
            textData = this.saveTextToParentTag(textData, currentNode, jPath);
            if (
              (this.options.ignoreDeclaration && tagData.tagName === '?xml') ||
              this.options.ignorePiTags
            ) {
            } else {
              const childNode = new xmlNode(tagData.tagName);
              childNode.add(this.options.textNodeName, '');
              if (tagData.tagName !== tagData.tagExp && tagData.attrExpPresent) {
                childNode[':@'] = this.buildAttributesMap(tagData.tagExp, jPath, tagData.tagName);
              }
              this.addChild(currentNode, childNode, jPath, i);
            }
            i = tagData.closeIndex + 1;
          } else if (xmlData.substr(i + 1, 3) === '!--') {
            const endIndex = findClosingIndex(xmlData, '-->', i + 4, 'Comment is not closed.');
            if (this.options.commentPropName) {
              const comment = xmlData.substring(i + 4, endIndex - 2);
              textData = this.saveTextToParentTag(textData, currentNode, jPath);
              currentNode.add(this.options.commentPropName, [
                { [this.options.textNodeName]: comment },
              ]);
            }
            i = endIndex;
          } else if (xmlData.substr(i + 1, 2) === '!D') {
            const result = docTypeReader.readDocType(xmlData, i);
            this.docTypeEntities = result.entities;
            i = result.i;
          } else if (xmlData.substr(i + 1, 2) === '![') {
            const closeIndex = findClosingIndex(xmlData, ']]>', i, 'CDATA is not closed.') - 2;
            const tagExp = xmlData.substring(i + 9, closeIndex);
            textData = this.saveTextToParentTag(textData, currentNode, jPath);
            let val = this.parseTextData(
              tagExp,
              currentNode.tagname,
              jPath,
              true,
              false,
              true,
              true
            );
            if (val == void 0) val = '';
            if (this.options.cdataPropName) {
              currentNode.add(this.options.cdataPropName, [
                { [this.options.textNodeName]: tagExp },
              ]);
            } else {
              currentNode.add(this.options.textNodeName, val);
            }
            i = closeIndex + 2;
          } else {
            let result = readTagExp(xmlData, i, this.options.removeNSPrefix);
            let tagName = result.tagName;
            const rawTagName = result.rawTagName;
            let tagExp = result.tagExp;
            let attrExpPresent = result.attrExpPresent;
            let closeIndex = result.closeIndex;
            if (this.options.transformTagName) {
              const newTagName = this.options.transformTagName(tagName);
              if (tagExp === tagName) {
                tagExp = newTagName;
              }
              tagName = newTagName;
            }
            if (
              this.options.strictReservedNames &&
              (tagName === this.options.commentPropName ||
                tagName === this.options.cdataPropName ||
                tagName === this.options.textNodeName ||
                tagName === this.options.attributesGroupName)
            ) {
              throw new Error(`Invalid tag name: ${tagName}`);
            }
            if (currentNode && textData) {
              if (currentNode.tagname !== '!xml') {
                textData = this.saveTextToParentTag(textData, currentNode, jPath, false);
              }
            }
            const lastTag = currentNode;
            if (lastTag && this.options.unpairedTags.indexOf(lastTag.tagname) !== -1) {
              currentNode = this.tagsNodeStack.pop();
              jPath = jPath.substring(0, jPath.lastIndexOf('.'));
            }
            if (tagName !== xmlObj.tagname) {
              jPath += jPath ? '.' + tagName : tagName;
            }
            const startIndex = i;
            if (this.isItStopNode(this.stopNodesExact, this.stopNodesWildcard, jPath, tagName)) {
              let tagContent = '';
              if (tagExp.length > 0 && tagExp.lastIndexOf('/') === tagExp.length - 1) {
                if (tagName[tagName.length - 1] === '/') {
                  tagName = tagName.substr(0, tagName.length - 1);
                  jPath = jPath.substr(0, jPath.length - 1);
                  tagExp = tagName;
                } else {
                  tagExp = tagExp.substr(0, tagExp.length - 1);
                }
                i = result.closeIndex;
              } else if (this.options.unpairedTags.indexOf(tagName) !== -1) {
                i = result.closeIndex;
              } else {
                const result2 = this.readStopNodeData(xmlData, rawTagName, closeIndex + 1);
                if (!result2) throw new Error(`Unexpected end of ${rawTagName}`);
                i = result2.i;
                tagContent = result2.tagContent;
              }
              const childNode = new xmlNode(tagName);
              if (tagName !== tagExp && attrExpPresent) {
                childNode[':@'] = this.buildAttributesMap(tagExp, jPath, tagName);
              }
              if (tagContent) {
                tagContent = this.parseTextData(
                  tagContent,
                  tagName,
                  jPath,
                  true,
                  attrExpPresent,
                  true,
                  true
                );
              }
              jPath = jPath.substr(0, jPath.lastIndexOf('.'));
              childNode.add(this.options.textNodeName, tagContent);
              this.addChild(currentNode, childNode, jPath, startIndex);
            } else {
              if (tagExp.length > 0 && tagExp.lastIndexOf('/') === tagExp.length - 1) {
                if (tagName[tagName.length - 1] === '/') {
                  tagName = tagName.substr(0, tagName.length - 1);
                  jPath = jPath.substr(0, jPath.length - 1);
                  tagExp = tagName;
                } else {
                  tagExp = tagExp.substr(0, tagExp.length - 1);
                }
                if (this.options.transformTagName) {
                  const newTagName = this.options.transformTagName(tagName);
                  if (tagExp === tagName) {
                    tagExp = newTagName;
                  }
                  tagName = newTagName;
                }
                const childNode = new xmlNode(tagName);
                if (tagName !== tagExp && attrExpPresent) {
                  childNode[':@'] = this.buildAttributesMap(tagExp, jPath, tagName);
                }
                this.addChild(currentNode, childNode, jPath, startIndex);
                jPath = jPath.substr(0, jPath.lastIndexOf('.'));
              } else if (this.options.unpairedTags.indexOf(tagName) !== -1) {
                const childNode = new xmlNode(tagName);
                if (tagName !== tagExp && attrExpPresent) {
                  childNode[':@'] = this.buildAttributesMap(tagExp, jPath);
                }
                this.addChild(currentNode, childNode, jPath, startIndex);
                jPath = jPath.substr(0, jPath.lastIndexOf('.'));
                i = result.closeIndex;
                continue;
              } else {
                const childNode = new xmlNode(tagName);
                if (this.tagsNodeStack.length > this.options.maxNestedTags) {
                  throw new Error('Maximum nested tags exceeded');
                }
                this.tagsNodeStack.push(currentNode);
                if (tagName !== tagExp && attrExpPresent) {
                  childNode[':@'] = this.buildAttributesMap(tagExp, jPath, tagName);
                }
                this.addChild(currentNode, childNode, jPath);
                currentNode = childNode;
              }
              textData = '';
              i = closeIndex;
            }
          }
        } else {
          textData += xmlData[i];
        }
      }
      return xmlObj.child;
    };
    function addChild(currentNode, childNode, jPath, startIndex) {
      if (!this.options.captureMetaData) startIndex = void 0;
      const result = this.options.updateTag(childNode.tagname, jPath, childNode[':@']);
      if (result === false) {
      } else if (typeof result === 'string') {
        childNode.tagname = result;
        currentNode.addChild(childNode, startIndex);
      } else {
        currentNode.addChild(childNode, startIndex);
      }
    }
    var replaceEntitiesValue = function (val, tagName, jPath) {
      if (val.indexOf('&') === -1) {
        return val;
      }
      const entityConfig = this.options.processEntities;
      if (!entityConfig.enabled) {
        return val;
      }
      if (entityConfig.allowedTags) {
        if (!entityConfig.allowedTags.includes(tagName)) {
          return val;
        }
      }
      if (entityConfig.tagFilter) {
        if (!entityConfig.tagFilter(tagName, jPath)) {
          return val;
        }
      }
      for (let entityName in this.docTypeEntities) {
        const entity = this.docTypeEntities[entityName];
        const matches = val.match(entity.regx);
        if (matches) {
          this.entityExpansionCount += matches.length;
          if (
            entityConfig.maxTotalExpansions &&
            this.entityExpansionCount > entityConfig.maxTotalExpansions
          ) {
            throw new Error(
              `Entity expansion limit exceeded: ${this.entityExpansionCount} > ${entityConfig.maxTotalExpansions}`
            );
          }
          const lengthBefore = val.length;
          val = val.replace(entity.regx, entity.val);
          if (entityConfig.maxExpandedLength) {
            this.currentExpandedLength += val.length - lengthBefore;
            if (this.currentExpandedLength > entityConfig.maxExpandedLength) {
              throw new Error(
                `Total expanded content size exceeded: ${this.currentExpandedLength} > ${entityConfig.maxExpandedLength}`
              );
            }
          }
        }
      }
      if (val.indexOf('&') === -1) return val;
      for (const entityName of Object.keys(this.lastEntities)) {
        const entity = this.lastEntities[entityName];
        const matches = val.match(entity.regex);
        if (matches) {
          this.entityExpansionCount += matches.length;
          if (
            entityConfig.maxTotalExpansions &&
            this.entityExpansionCount > entityConfig.maxTotalExpansions
          ) {
            throw new Error(
              `Entity expansion limit exceeded: ${this.entityExpansionCount} > ${entityConfig.maxTotalExpansions}`
            );
          }
        }
        val = val.replace(entity.regex, entity.val);
      }
      if (val.indexOf('&') === -1) return val;
      if (this.options.htmlEntities) {
        for (const entityName of Object.keys(this.htmlEntities)) {
          const entity = this.htmlEntities[entityName];
          const matches = val.match(entity.regex);
          if (matches) {
            this.entityExpansionCount += matches.length;
            if (
              entityConfig.maxTotalExpansions &&
              this.entityExpansionCount > entityConfig.maxTotalExpansions
            ) {
              throw new Error(
                `Entity expansion limit exceeded: ${this.entityExpansionCount} > ${entityConfig.maxTotalExpansions}`
              );
            }
          }
          val = val.replace(entity.regex, entity.val);
        }
      }
      val = val.replace(this.ampEntity.regex, this.ampEntity.val);
      return val;
    };
    function saveTextToParentTag(textData, parentNode, jPath, isLeafNode) {
      if (textData) {
        if (isLeafNode === void 0) isLeafNode = parentNode.child.length === 0;
        textData = this.parseTextData(
          textData,
          parentNode.tagname,
          jPath,
          false,
          parentNode[':@'] ? Object.keys(parentNode[':@']).length !== 0 : false,
          isLeafNode
        );
        if (textData !== void 0 && textData !== '')
          parentNode.add(this.options.textNodeName, textData);
        textData = '';
      }
      return textData;
    }
    function isItStopNode(stopNodesExact, stopNodesWildcard, jPath, currentTagName) {
      if (stopNodesWildcard && stopNodesWildcard.has(currentTagName)) return true;
      if (stopNodesExact && stopNodesExact.has(jPath)) return true;
      return false;
    }
    function tagExpWithClosingIndex(xmlData, i, closingChar = '>') {
      let attrBoundary;
      let tagExp = '';
      for (let index = i; index < xmlData.length; index++) {
        let ch = xmlData[index];
        if (attrBoundary) {
          if (ch === attrBoundary) attrBoundary = '';
        } else if (ch === '"' || ch === "'") {
          attrBoundary = ch;
        } else if (ch === closingChar[0]) {
          if (closingChar[1]) {
            if (xmlData[index + 1] === closingChar[1]) {
              return {
                data: tagExp,
                index,
              };
            }
          } else {
            return {
              data: tagExp,
              index,
            };
          }
        } else if (ch === '	') {
          ch = ' ';
        }
        tagExp += ch;
      }
    }
    function findClosingIndex(xmlData, str, i, errMsg) {
      const closingIndex = xmlData.indexOf(str, i);
      if (closingIndex === -1) {
        throw new Error(errMsg);
      } else {
        return closingIndex + str.length - 1;
      }
    }
    function readTagExp(xmlData, i, removeNSPrefix, closingChar = '>') {
      const result = tagExpWithClosingIndex(xmlData, i + 1, closingChar);
      if (!result) return;
      let tagExp = result.data;
      const closeIndex = result.index;
      const separatorIndex = tagExp.search(/\s/);
      let tagName = tagExp;
      let attrExpPresent = true;
      if (separatorIndex !== -1) {
        tagName = tagExp.substring(0, separatorIndex);
        tagExp = tagExp.substring(separatorIndex + 1).trimStart();
      }
      const rawTagName = tagName;
      if (removeNSPrefix) {
        const colonIndex = tagName.indexOf(':');
        if (colonIndex !== -1) {
          tagName = tagName.substr(colonIndex + 1);
          attrExpPresent = tagName !== result.data.substr(colonIndex + 1);
        }
      }
      return {
        tagName,
        tagExp,
        closeIndex,
        attrExpPresent,
        rawTagName,
      };
    }
    function readStopNodeData(xmlData, tagName, i) {
      const startIndex = i;
      let openTagCount = 1;
      for (; i < xmlData.length; i++) {
        if (xmlData[i] === '<') {
          if (xmlData[i + 1] === '/') {
            const closeIndex = findClosingIndex(xmlData, '>', i, `${tagName} is not closed`);
            let closeTagName = xmlData.substring(i + 2, closeIndex).trim();
            if (closeTagName === tagName) {
              openTagCount--;
              if (openTagCount === 0) {
                return {
                  tagContent: xmlData.substring(startIndex, i),
                  i: closeIndex,
                };
              }
            }
            i = closeIndex;
          } else if (xmlData[i + 1] === '?') {
            const closeIndex = findClosingIndex(xmlData, '?>', i + 1, 'StopNode is not closed.');
            i = closeIndex;
          } else if (xmlData.substr(i + 1, 3) === '!--') {
            const closeIndex = findClosingIndex(xmlData, '-->', i + 3, 'StopNode is not closed.');
            i = closeIndex;
          } else if (xmlData.substr(i + 1, 2) === '![') {
            const closeIndex = findClosingIndex(xmlData, ']]>', i, 'StopNode is not closed.') - 2;
            i = closeIndex;
          } else {
            const tagData = readTagExp(xmlData, i, '>');
            if (tagData) {
              const openTagName = tagData && tagData.tagName;
              if (openTagName === tagName && tagData.tagExp[tagData.tagExp.length - 1] !== '/') {
                openTagCount++;
              }
              i = tagData.closeIndex;
            }
          }
        }
      }
    }
    function parseValue(val, shouldParse, options) {
      if (shouldParse && typeof val === 'string') {
        const newval = val.trim();
        if (newval === 'true') return true;
        else if (newval === 'false') return false;
        else return toNumber(val, options);
      } else {
        if (util.isExist(val)) {
          return val;
        } else {
          return '';
        }
      }
    }
    function fromCodePoint(str, base, prefix) {
      const codePoint = Number.parseInt(str, base);
      if (codePoint >= 0 && codePoint <= 1114111) {
        return String.fromCodePoint(codePoint);
      } else {
        return prefix + str + ';';
      }
    }
    function sanitizeName(name, options) {
      if (util.criticalProperties.includes(name)) {
        throw new Error(
          `[SECURITY] Invalid name: "${name}" is a reserved JavaScript keyword that could cause prototype pollution`
        );
      } else if (util.DANGEROUS_PROPERTY_NAMES.includes(name)) {
        return options.onDangerousProperty(name);
      }
      return name;
    }
    module2.exports = OrderedObjParser;
  },
});

// node_modules/fast-xml-parser/src/xmlparser/node2json.js
var require_node2json = __commonJS({
  'node_modules/fast-xml-parser/src/xmlparser/node2json.js'(exports2) {
    'use strict';
    function prettify(node, options) {
      return compress(node, options);
    }
    function compress(arr, options, jPath) {
      let text;
      const compressedObj = {};
      for (let i = 0; i < arr.length; i++) {
        const tagObj = arr[i];
        const property = propName(tagObj);
        let newJpath = '';
        if (jPath === void 0) newJpath = property;
        else newJpath = jPath + '.' + property;
        if (property === options.textNodeName) {
          if (text === void 0) text = tagObj[property];
          else text += '' + tagObj[property];
        } else if (property === void 0) {
          continue;
        } else if (tagObj[property]) {
          let val = compress(tagObj[property], options, newJpath);
          const isLeaf = isLeafTag(val, options);
          if (tagObj[':@']) {
            assignAttributes(val, tagObj[':@'], newJpath, options);
          } else if (
            Object.keys(val).length === 1 &&
            val[options.textNodeName] !== void 0 &&
            !options.alwaysCreateTextNode
          ) {
            val = val[options.textNodeName];
          } else if (Object.keys(val).length === 0) {
            if (options.alwaysCreateTextNode) val[options.textNodeName] = '';
            else val = '';
          }
          if (compressedObj[property] !== void 0 && compressedObj.hasOwnProperty(property)) {
            if (!Array.isArray(compressedObj[property])) {
              compressedObj[property] = [compressedObj[property]];
            }
            compressedObj[property].push(val);
          } else {
            if (options.isArray(property, newJpath, isLeaf)) {
              compressedObj[property] = [val];
            } else {
              compressedObj[property] = val;
            }
          }
        }
      }
      if (typeof text === 'string') {
        if (text.length > 0) compressedObj[options.textNodeName] = text;
      } else if (text !== void 0) compressedObj[options.textNodeName] = text;
      return compressedObj;
    }
    function propName(obj) {
      const keys = Object.keys(obj);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (key !== ':@') return key;
      }
    }
    function assignAttributes(obj, attrMap, jpath, options) {
      if (attrMap) {
        const keys = Object.keys(attrMap);
        const len = keys.length;
        for (let i = 0; i < len; i++) {
          const atrrName = keys[i];
          if (options.isArray(atrrName, jpath + '.' + atrrName, true, true)) {
            obj[atrrName] = [attrMap[atrrName]];
          } else {
            obj[atrrName] = attrMap[atrrName];
          }
        }
      }
    }
    function isLeafTag(obj, options) {
      const { textNodeName } = options;
      const propCount = Object.keys(obj).length;
      if (propCount === 0) {
        return true;
      }
      if (
        propCount === 1 &&
        (obj[textNodeName] || typeof obj[textNodeName] === 'boolean' || obj[textNodeName] === 0)
      ) {
        return true;
      }
      return false;
    }
    exports2.prettify = prettify;
  },
});

// node_modules/fast-xml-parser/src/xmlparser/XMLParser.js
var require_XMLParser = __commonJS({
  'node_modules/fast-xml-parser/src/xmlparser/XMLParser.js'(exports2, module2) {
    var { buildOptions } = require_OptionsBuilder();
    var OrderedObjParser = require_OrderedObjParser();
    var { prettify } = require_node2json();
    var validator = require_validator2();
    var XMLParser = class {
      constructor(options) {
        this.externalEntities = {};
        this.options = buildOptions(options);
      }
      /**
       * Parse XML dats to JS object
       * @param {string|Buffer} xmlData
       * @param {boolean|Object} validationOption
       */
      parse(xmlData, validationOption) {
        if (typeof xmlData === 'string') {
        } else if (xmlData.toString) {
          xmlData = xmlData.toString();
        } else {
          throw new Error('XML data is accepted in String or Bytes[] form.');
        }
        if (validationOption) {
          if (validationOption === true) validationOption = {};
          const result = validator.validate(xmlData, validationOption);
          if (result !== true) {
            throw Error(`${result.err.msg}:${result.err.line}:${result.err.col}`);
          }
        }
        const orderedObjParser = new OrderedObjParser(this.options);
        orderedObjParser.addExternalEntities(this.externalEntities);
        const orderedResult = orderedObjParser.parseXml(xmlData);
        if (this.options.preserveOrder || orderedResult === void 0) return orderedResult;
        else return prettify(orderedResult, this.options);
      }
      /**
       * Add Entity which is not by default supported by this library
       * @param {string} key
       * @param {string} value
       */
      addEntity(key, value) {
        if (value.indexOf('&') !== -1) {
          throw new Error("Entity value can't have '&'");
        } else if (key.indexOf('&') !== -1 || key.indexOf(';') !== -1) {
          throw new Error("An entity must be set without '&' and ';'. Eg. use '#xD' for '&#xD;'");
        } else if (value === '&') {
          throw new Error("An entity with value '&' is not permitted");
        } else {
          this.externalEntities[key] = value;
        }
      }
    };
    module2.exports = XMLParser;
  },
});

// node_modules/fast-xml-parser/src/xmlbuilder/orderedJs2Xml.js
var require_orderedJs2Xml = __commonJS({
  'node_modules/fast-xml-parser/src/xmlbuilder/orderedJs2Xml.js'(exports2, module2) {
    var EOL = '\n';
    function toXml(jArray, options) {
      let indentation = '';
      if (options.format && options.indentBy.length > 0) {
        indentation = EOL;
      }
      return arrToStr(jArray, options, '', indentation);
    }
    function arrToStr(arr, options, jPath, indentation) {
      let xmlStr = '';
      let isPreviousElementTag = false;
      if (!Array.isArray(arr)) {
        if (arr !== void 0 && arr !== null) {
          let text = arr.toString();
          text = replaceEntitiesValue(text, options);
          return text;
        }
        return '';
      }
      for (let i = 0; i < arr.length; i++) {
        const tagObj = arr[i];
        const tagName = propName(tagObj);
        if (tagName === void 0) continue;
        let newJPath = '';
        if (jPath.length === 0) newJPath = tagName;
        else newJPath = `${jPath}.${tagName}`;
        if (tagName === options.textNodeName) {
          let tagText = tagObj[tagName];
          if (!isStopNode(newJPath, options)) {
            tagText = options.tagValueProcessor(tagName, tagText);
            tagText = replaceEntitiesValue(tagText, options);
          }
          if (isPreviousElementTag) {
            xmlStr += indentation;
          }
          xmlStr += tagText;
          isPreviousElementTag = false;
          continue;
        } else if (tagName === options.cdataPropName) {
          if (isPreviousElementTag) {
            xmlStr += indentation;
          }
          xmlStr += `<![CDATA[${tagObj[tagName][0][options.textNodeName]}]]>`;
          isPreviousElementTag = false;
          continue;
        } else if (tagName === options.commentPropName) {
          xmlStr += indentation + `<!--${tagObj[tagName][0][options.textNodeName]}-->`;
          isPreviousElementTag = true;
          continue;
        } else if (tagName[0] === '?') {
          const attStr2 = attr_to_str(tagObj[':@'], options);
          const tempInd = tagName === '?xml' ? '' : indentation;
          let piTextNodeName = tagObj[tagName][0][options.textNodeName];
          piTextNodeName = piTextNodeName.length !== 0 ? ' ' + piTextNodeName : '';
          xmlStr += tempInd + `<${tagName}${piTextNodeName}${attStr2}?>`;
          isPreviousElementTag = true;
          continue;
        }
        let newIdentation = indentation;
        if (newIdentation !== '') {
          newIdentation += options.indentBy;
        }
        const attStr = attr_to_str(tagObj[':@'], options);
        const tagStart = indentation + `<${tagName}${attStr}`;
        const tagValue = arrToStr(tagObj[tagName], options, newJPath, newIdentation);
        if (options.unpairedTags.indexOf(tagName) !== -1) {
          if (options.suppressUnpairedNode) xmlStr += tagStart + '>';
          else xmlStr += tagStart + '/>';
        } else if ((!tagValue || tagValue.length === 0) && options.suppressEmptyNode) {
          xmlStr += tagStart + '/>';
        } else if (tagValue && tagValue.endsWith('>')) {
          xmlStr += tagStart + `>${tagValue}${indentation}</${tagName}>`;
        } else {
          xmlStr += tagStart + '>';
          if (
            tagValue &&
            indentation !== '' &&
            (tagValue.includes('/>') || tagValue.includes('</'))
          ) {
            xmlStr += indentation + options.indentBy + tagValue + indentation;
          } else {
            xmlStr += tagValue;
          }
          xmlStr += `</${tagName}>`;
        }
        isPreviousElementTag = true;
      }
      return xmlStr;
    }
    function propName(obj) {
      const keys = Object.keys(obj);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        if (key !== ':@') return key;
      }
    }
    function attr_to_str(attrMap, options) {
      let attrStr = '';
      if (attrMap && !options.ignoreAttributes) {
        for (let attr in attrMap) {
          if (!Object.prototype.hasOwnProperty.call(attrMap, attr)) continue;
          let attrVal = options.attributeValueProcessor(attr, attrMap[attr]);
          attrVal = replaceEntitiesValue(attrVal, options);
          if (attrVal === true && options.suppressBooleanAttributes) {
            attrStr += ` ${attr.substr(options.attributeNamePrefix.length)}`;
          } else {
            attrStr += ` ${attr.substr(options.attributeNamePrefix.length)}="${attrVal}"`;
          }
        }
      }
      return attrStr;
    }
    function isStopNode(jPath, options) {
      jPath = jPath.substr(0, jPath.length - options.textNodeName.length - 1);
      let tagName = jPath.substr(jPath.lastIndexOf('.') + 1);
      for (let index in options.stopNodes) {
        if (options.stopNodes[index] === jPath || options.stopNodes[index] === '*.' + tagName)
          return true;
      }
      return false;
    }
    function replaceEntitiesValue(textValue, options) {
      if (textValue && textValue.length > 0 && options.processEntities) {
        for (let i = 0; i < options.entities.length; i++) {
          const entity = options.entities[i];
          textValue = textValue.replace(entity.regex, entity.val);
        }
      }
      return textValue;
    }
    module2.exports = toXml;
  },
});

// node_modules/fast-xml-parser/src/xmlbuilder/json2xml.js
var require_json2xml = __commonJS({
  'node_modules/fast-xml-parser/src/xmlbuilder/json2xml.js'(exports2, module2) {
    'use strict';
    var buildFromOrderedJs = require_orderedJs2Xml();
    var getIgnoreAttributesFn = require_ignoreAttributes();
    var defaultOptions = {
      attributeNamePrefix: '@_',
      attributesGroupName: false,
      textNodeName: '#text',
      ignoreAttributes: true,
      cdataPropName: false,
      format: false,
      indentBy: '  ',
      suppressEmptyNode: false,
      suppressUnpairedNode: true,
      suppressBooleanAttributes: true,
      tagValueProcessor: function (key, a) {
        return a;
      },
      attributeValueProcessor: function (attrName, a) {
        return a;
      },
      preserveOrder: false,
      commentPropName: false,
      unpairedTags: [],
      entities: [
        { regex: new RegExp('&', 'g'), val: '&amp;' },
        //it must be on top
        { regex: new RegExp('>', 'g'), val: '&gt;' },
        { regex: new RegExp('<', 'g'), val: '&lt;' },
        { regex: new RegExp("'", 'g'), val: '&apos;' },
        { regex: new RegExp('"', 'g'), val: '&quot;' },
      ],
      processEntities: true,
      stopNodes: [],
      // transformTagName: false,
      // transformAttributeName: false,
      oneListGroup: false,
    };
    function Builder(options) {
      this.options = Object.assign({}, defaultOptions, options);
      if (this.options.ignoreAttributes === true || this.options.attributesGroupName) {
        this.isAttribute = function () {
          return false;
        };
      } else {
        this.ignoreAttributesFn = getIgnoreAttributesFn(this.options.ignoreAttributes);
        this.attrPrefixLen = this.options.attributeNamePrefix.length;
        this.isAttribute = isAttribute;
      }
      this.processTextOrObjNode = processTextOrObjNode;
      if (this.options.format) {
        this.indentate = indentate;
        this.tagEndChar = '>\n';
        this.newLine = '\n';
      } else {
        this.indentate = function () {
          return '';
        };
        this.tagEndChar = '>';
        this.newLine = '';
      }
    }
    Builder.prototype.build = function (jObj) {
      if (this.options.preserveOrder) {
        return buildFromOrderedJs(jObj, this.options);
      } else {
        if (
          Array.isArray(jObj) &&
          this.options.arrayNodeName &&
          this.options.arrayNodeName.length > 1
        ) {
          jObj = {
            [this.options.arrayNodeName]: jObj,
          };
        }
        return this.j2x(jObj, 0, []).val;
      }
    };
    Builder.prototype.j2x = function (jObj, level, ajPath) {
      let attrStr = '';
      let val = '';
      const jPath = ajPath.join('.');
      for (let key in jObj) {
        if (!Object.prototype.hasOwnProperty.call(jObj, key)) continue;
        if (typeof jObj[key] === 'undefined') {
          if (this.isAttribute(key)) {
            val += '';
          }
        } else if (jObj[key] === null) {
          if (this.isAttribute(key)) {
            val += '';
          } else if (key === this.options.cdataPropName) {
            val += '';
          } else if (key[0] === '?') {
            val += this.indentate(level) + '<' + key + '?' + this.tagEndChar;
          } else {
            val += this.indentate(level) + '<' + key + '/' + this.tagEndChar;
          }
        } else if (jObj[key] instanceof Date) {
          val += this.buildTextValNode(jObj[key], key, '', level);
        } else if (typeof jObj[key] !== 'object') {
          const attr = this.isAttribute(key);
          if (attr && !this.ignoreAttributesFn(attr, jPath)) {
            attrStr += this.buildAttrPairStr(attr, '' + jObj[key]);
          } else if (!attr) {
            if (key === this.options.textNodeName) {
              let newval = this.options.tagValueProcessor(key, '' + jObj[key]);
              val += this.replaceEntitiesValue(newval);
            } else {
              val += this.buildTextValNode(jObj[key], key, '', level);
            }
          }
        } else if (Array.isArray(jObj[key])) {
          const arrLen = jObj[key].length;
          let listTagVal = '';
          let listTagAttr = '';
          for (let j = 0; j < arrLen; j++) {
            const item = jObj[key][j];
            if (typeof item === 'undefined') {
            } else if (item === null) {
              if (key[0] === '?') val += this.indentate(level) + '<' + key + '?' + this.tagEndChar;
              else val += this.indentate(level) + '<' + key + '/' + this.tagEndChar;
            } else if (typeof item === 'object') {
              if (this.options.oneListGroup) {
                const result = this.j2x(item, level + 1, ajPath.concat(key));
                listTagVal += result.val;
                if (
                  this.options.attributesGroupName &&
                  item.hasOwnProperty(this.options.attributesGroupName)
                ) {
                  listTagAttr += result.attrStr;
                }
              } else {
                listTagVal += this.processTextOrObjNode(item, key, level, ajPath);
              }
            } else {
              if (this.options.oneListGroup) {
                let textValue = this.options.tagValueProcessor(key, item);
                textValue = this.replaceEntitiesValue(textValue);
                listTagVal += textValue;
              } else {
                listTagVal += this.buildTextValNode(item, key, '', level);
              }
            }
          }
          if (this.options.oneListGroup) {
            listTagVal = this.buildObjectNode(listTagVal, key, listTagAttr, level);
          }
          val += listTagVal;
        } else {
          if (this.options.attributesGroupName && key === this.options.attributesGroupName) {
            const Ks = Object.keys(jObj[key]);
            const L = Ks.length;
            for (let j = 0; j < L; j++) {
              attrStr += this.buildAttrPairStr(Ks[j], '' + jObj[key][Ks[j]]);
            }
          } else {
            val += this.processTextOrObjNode(jObj[key], key, level, ajPath);
          }
        }
      }
      return { attrStr, val };
    };
    Builder.prototype.buildAttrPairStr = function (attrName, val) {
      val = this.options.attributeValueProcessor(attrName, '' + val);
      val = this.replaceEntitiesValue(val);
      if (this.options.suppressBooleanAttributes && val === 'true') {
        return ' ' + attrName;
      } else return ' ' + attrName + '="' + val + '"';
    };
    function processTextOrObjNode(object, key, level, ajPath) {
      const result = this.j2x(object, level + 1, ajPath.concat(key));
      if (object[this.options.textNodeName] !== void 0 && Object.keys(object).length === 1) {
        return this.buildTextValNode(object[this.options.textNodeName], key, result.attrStr, level);
      } else {
        return this.buildObjectNode(result.val, key, result.attrStr, level);
      }
    }
    Builder.prototype.buildObjectNode = function (val, key, attrStr, level) {
      if (val === '') {
        if (key[0] === '?')
          return this.indentate(level) + '<' + key + attrStr + '?' + this.tagEndChar;
        else {
          return this.indentate(level) + '<' + key + attrStr + this.closeTag(key) + this.tagEndChar;
        }
      } else {
        let tagEndExp = '</' + key + this.tagEndChar;
        let piClosingChar = '';
        if (key[0] === '?') {
          piClosingChar = '?';
          tagEndExp = '';
        }
        if ((attrStr || attrStr === '') && val.indexOf('<') === -1) {
          return (
            this.indentate(level) + '<' + key + attrStr + piClosingChar + '>' + val + tagEndExp
          );
        } else if (
          this.options.commentPropName !== false &&
          key === this.options.commentPropName &&
          piClosingChar.length === 0
        ) {
          return this.indentate(level) + `<!--${val}-->` + this.newLine;
        } else {
          return (
            this.indentate(level) +
            '<' +
            key +
            attrStr +
            piClosingChar +
            this.tagEndChar +
            val +
            this.indentate(level) +
            tagEndExp
          );
        }
      }
    };
    Builder.prototype.closeTag = function (key) {
      let closeTag = '';
      if (this.options.unpairedTags.indexOf(key) !== -1) {
        if (!this.options.suppressUnpairedNode) closeTag = '/';
      } else if (this.options.suppressEmptyNode) {
        closeTag = '/';
      } else {
        closeTag = `></${key}`;
      }
      return closeTag;
    };
    Builder.prototype.buildTextValNode = function (val, key, attrStr, level) {
      if (this.options.cdataPropName !== false && key === this.options.cdataPropName) {
        return this.indentate(level) + `<![CDATA[${val}]]>` + this.newLine;
      } else if (this.options.commentPropName !== false && key === this.options.commentPropName) {
        return this.indentate(level) + `<!--${val}-->` + this.newLine;
      } else if (key[0] === '?') {
        return this.indentate(level) + '<' + key + attrStr + '?' + this.tagEndChar;
      } else {
        let textValue = this.options.tagValueProcessor(key, val);
        textValue = this.replaceEntitiesValue(textValue);
        if (textValue === '') {
          return this.indentate(level) + '<' + key + attrStr + this.closeTag(key) + this.tagEndChar;
        } else {
          return (
            this.indentate(level) +
            '<' +
            key +
            attrStr +
            '>' +
            textValue +
            '</' +
            key +
            this.tagEndChar
          );
        }
      }
    };
    Builder.prototype.replaceEntitiesValue = function (textValue) {
      if (textValue && textValue.length > 0 && this.options.processEntities) {
        for (let i = 0; i < this.options.entities.length; i++) {
          const entity = this.options.entities[i];
          textValue = textValue.replace(entity.regex, entity.val);
        }
      }
      return textValue;
    };
    function indentate(level) {
      return this.options.indentBy.repeat(level);
    }
    function isAttribute(name) {
      if (name.startsWith(this.options.attributeNamePrefix) && name !== this.options.textNodeName) {
        return name.substr(this.attrPrefixLen);
      } else {
        return false;
      }
    }
    module2.exports = Builder;
  },
});

// node_modules/fast-xml-parser/src/fxp.js
var require_fxp = __commonJS({
  'node_modules/fast-xml-parser/src/fxp.js'(exports2, module2) {
    'use strict';
    var validator = require_validator2();
    var XMLParser = require_XMLParser();
    var XMLBuilder = require_json2xml();
    module2.exports = {
      XMLParser,
      XMLValidator: validator,
      XMLBuilder,
    };
  },
});

// node_modules/nested-property/dist/nested-property.js
var require_nested_property = __commonJS({
  'node_modules/nested-property/dist/nested-property.js'(exports2, module2) {
    'use strict';
    function _typeof(obj) {
      '@babel/helpers - typeof';
      if (typeof Symbol === 'function' && typeof Symbol.iterator === 'symbol') {
        _typeof = function _typeof2(obj2) {
          return typeof obj2;
        };
      } else {
        _typeof = function _typeof2(obj2) {
          return obj2 &&
            typeof Symbol === 'function' &&
            obj2.constructor === Symbol &&
            obj2 !== Symbol.prototype
            ? 'symbol'
            : typeof obj2;
        };
      }
      return _typeof(obj);
    }
    function _classCallCheck(instance, Constructor) {
      if (!(instance instanceof Constructor)) {
        throw new TypeError('Cannot call a class as a function');
      }
    }
    function _possibleConstructorReturn(self2, call) {
      if (call && (_typeof(call) === 'object' || typeof call === 'function')) {
        return call;
      }
      return _assertThisInitialized(self2);
    }
    function _assertThisInitialized(self2) {
      if (self2 === void 0) {
        throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
      }
      return self2;
    }
    function _inherits(subClass, superClass) {
      if (typeof superClass !== 'function' && superClass !== null) {
        throw new TypeError('Super expression must either be null or a function');
      }
      subClass.prototype = Object.create(superClass && superClass.prototype, {
        constructor: { value: subClass, writable: true, configurable: true },
      });
      if (superClass) _setPrototypeOf(subClass, superClass);
    }
    function _wrapNativeSuper(Class) {
      var _cache = typeof Map === 'function' ? /* @__PURE__ */ new Map() : void 0;
      _wrapNativeSuper = function _wrapNativeSuper2(Class2) {
        if (Class2 === null || !_isNativeFunction(Class2)) return Class2;
        if (typeof Class2 !== 'function') {
          throw new TypeError('Super expression must either be null or a function');
        }
        if (typeof _cache !== 'undefined') {
          if (_cache.has(Class2)) return _cache.get(Class2);
          _cache.set(Class2, Wrapper);
        }
        function Wrapper() {
          return _construct(Class2, arguments, _getPrototypeOf(this).constructor);
        }
        Wrapper.prototype = Object.create(Class2.prototype, {
          constructor: { value: Wrapper, enumerable: false, writable: true, configurable: true },
        });
        return _setPrototypeOf(Wrapper, Class2);
      };
      return _wrapNativeSuper(Class);
    }
    function _construct(Parent, args, Class) {
      if (_isNativeReflectConstruct()) {
        _construct = Reflect.construct;
      } else {
        _construct = function _construct2(Parent2, args2, Class2) {
          var a = [null];
          a.push.apply(a, args2);
          var Constructor = Function.bind.apply(Parent2, a);
          var instance = new Constructor();
          if (Class2) _setPrototypeOf(instance, Class2.prototype);
          return instance;
        };
      }
      return _construct.apply(null, arguments);
    }
    function _isNativeReflectConstruct() {
      if (typeof Reflect === 'undefined' || !Reflect.construct) return false;
      if (Reflect.construct.sham) return false;
      if (typeof Proxy === 'function') return true;
      try {
        Date.prototype.toString.call(Reflect.construct(Date, [], function () {}));
        return true;
      } catch (e) {
        return false;
      }
    }
    function _isNativeFunction(fn) {
      return Function.toString.call(fn).indexOf('[native code]') !== -1;
    }
    function _setPrototypeOf(o, p) {
      _setPrototypeOf =
        Object.setPrototypeOf ||
        function _setPrototypeOf2(o2, p2) {
          o2.__proto__ = p2;
          return o2;
        };
      return _setPrototypeOf(o, p);
    }
    function _getPrototypeOf(o) {
      _getPrototypeOf = Object.setPrototypeOf
        ? Object.getPrototypeOf
        : function _getPrototypeOf2(o2) {
            return o2.__proto__ || Object.getPrototypeOf(o2);
          };
      return _getPrototypeOf(o);
    }
    var ARRAY_WILDCARD = '+';
    var PATH_DELIMITER = '.';
    var ObjectPrototypeMutationError = /* @__PURE__ */ (function (_Error) {
      _inherits(ObjectPrototypeMutationError2, _Error);
      function ObjectPrototypeMutationError2(params) {
        var _this;
        _classCallCheck(this, ObjectPrototypeMutationError2);
        _this = _possibleConstructorReturn(
          this,
          _getPrototypeOf(ObjectPrototypeMutationError2).call(this, params)
        );
        _this.name = 'ObjectPrototypeMutationError';
        return _this;
      }
      return ObjectPrototypeMutationError2;
    })(_wrapNativeSuper(Error));
    module2.exports = {
      set: setNestedProperty,
      get: getNestedProperty,
      has: hasNestedProperty,
      hasOwn: function hasOwn(object, property, options) {
        return this.has(
          object,
          property,
          options || {
            own: true,
          }
        );
      },
      isIn: isInNestedProperty,
      ObjectPrototypeMutationError,
    };
    function getNestedProperty(object, property) {
      if (_typeof(object) != 'object' || object === null) {
        return object;
      }
      if (typeof property == 'undefined') {
        return object;
      }
      if (typeof property == 'number') {
        return object[property];
      }
      try {
        return traverse(
          object,
          property,
          function _getNestedProperty(currentObject, currentProperty) {
            return currentObject[currentProperty];
          }
        );
      } catch (err) {
        return object;
      }
    }
    function hasNestedProperty(object, property) {
      var options = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
      if (_typeof(object) != 'object' || object === null) {
        return false;
      }
      if (typeof property == 'undefined') {
        return false;
      }
      if (typeof property == 'number') {
        return property in object;
      }
      try {
        var has = false;
        traverse(
          object,
          property,
          function _hasNestedProperty(currentObject, currentProperty, segments, index) {
            if (isLastSegment(segments, index)) {
              if (options.own) {
                has = currentObject.hasOwnProperty(currentProperty);
              } else {
                has = currentProperty in currentObject;
              }
            } else {
              return currentObject && currentObject[currentProperty];
            }
          }
        );
        return has;
      } catch (err) {
        return false;
      }
    }
    function setNestedProperty(object, property, value) {
      if (_typeof(object) != 'object' || object === null) {
        return object;
      }
      if (typeof property == 'undefined') {
        return object;
      }
      if (typeof property == 'number') {
        object[property] = value;
        return object[property];
      }
      try {
        return traverse(
          object,
          property,
          function _setNestedProperty(currentObject, currentProperty, segments, index) {
            if (currentObject === Reflect.getPrototypeOf({})) {
              throw new ObjectPrototypeMutationError('Attempting to mutate Object.prototype');
            }
            if (!currentObject[currentProperty]) {
              var nextPropIsNumber = Number.isInteger(Number(segments[index + 1]));
              var nextPropIsArrayWildcard = segments[index + 1] === ARRAY_WILDCARD;
              if (nextPropIsNumber || nextPropIsArrayWildcard) {
                currentObject[currentProperty] = [];
              } else {
                currentObject[currentProperty] = {};
              }
            }
            if (isLastSegment(segments, index)) {
              currentObject[currentProperty] = value;
            }
            return currentObject[currentProperty];
          }
        );
      } catch (err) {
        if (err instanceof ObjectPrototypeMutationError) {
          throw err;
        } else {
          return object;
        }
      }
    }
    function isInNestedProperty(object, property, objectInPath) {
      var options = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : {};
      if (_typeof(object) != 'object' || object === null) {
        return false;
      }
      if (typeof property == 'undefined') {
        return false;
      }
      try {
        var isIn = false,
          pathExists = false;
        traverse(
          object,
          property,
          function _isInNestedProperty(currentObject, currentProperty, segments, index) {
            isIn =
              isIn ||
              currentObject === objectInPath ||
              (!!currentObject && currentObject[currentProperty] === objectInPath);
            pathExists =
              isLastSegment(segments, index) &&
              _typeof(currentObject) === 'object' &&
              currentProperty in currentObject;
            return currentObject && currentObject[currentProperty];
          }
        );
        if (options.validPath) {
          return isIn && pathExists;
        } else {
          return isIn;
        }
      } catch (err) {
        return false;
      }
    }
    function traverse(object, path) {
      var callback =
        arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : function () {};
      var segments = path.split(PATH_DELIMITER);
      var length = segments.length;
      var _loop = function _loop2(idx2) {
        var currentSegment = segments[idx2];
        if (!object) {
          return {
            v: void 0,
          };
        }
        if (currentSegment === ARRAY_WILDCARD) {
          if (Array.isArray(object)) {
            return {
              v: object.map(function (value, index) {
                var remainingSegments = segments.slice(idx2 + 1);
                if (remainingSegments.length > 0) {
                  return traverse(value, remainingSegments.join(PATH_DELIMITER), callback);
                } else {
                  return callback(object, index, segments, idx2);
                }
              }),
            };
          } else {
            var pathToHere = segments.slice(0, idx2).join(PATH_DELIMITER);
            throw new Error('Object at wildcard ('.concat(pathToHere, ') is not an array'));
          }
        } else {
          object = callback(object, currentSegment, segments, idx2);
        }
      };
      for (var idx = 0; idx < length; idx++) {
        var _ret = _loop(idx);
        if (_typeof(_ret) === 'object') return _ret.v;
      }
      return object;
    }
    function isLastSegment(segments, index) {
      return segments.length === index + 1;
    }
  },
});

// node_modules/webdav/dist/node/tools/dav.js
var require_dav = __commonJS({
  'node_modules/webdav/dist/node/tools/dav.js'(exports2) {
    'use strict';
    var __importDefault =
      (exports2 && exports2.__importDefault) ||
      function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
      };
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.translateDiskSpace =
      exports2.parseStat =
      exports2.prepareFileFromProps =
      exports2.parseXML =
        void 0;
    var path_posix_1 = __importDefault(require_path_posix());
    var fast_xml_parser_1 = require_fxp();
    var nested_property_1 = __importDefault(require_nested_property());
    var encode_1 = require_encode();
    var path_1 = require_path();
    var PropertyType;
    (function (PropertyType2) {
      PropertyType2['Array'] = 'array';
      PropertyType2['Object'] = 'object';
      PropertyType2['Original'] = 'original';
    })(PropertyType || (PropertyType = {}));
    function getPropertyOfType(obj, prop, type) {
      if (type === void 0) {
        type = PropertyType.Original;
      }
      var val = nested_property_1.default.get(obj, prop);
      if (type === 'array' && Array.isArray(val) === false) {
        return [val];
      } else if (type === 'object' && Array.isArray(val)) {
        return val[0];
      }
      return val;
    }
    function normaliseResponse(response) {
      var output = Object.assign({}, response);
      nested_property_1.default.set(
        output,
        'propstat',
        getPropertyOfType(output, 'propstat', PropertyType.Object)
      );
      nested_property_1.default.set(
        output,
        'propstat.prop',
        getPropertyOfType(output, 'propstat.prop', PropertyType.Object)
      );
      return output;
    }
    function normaliseResult(result) {
      var multistatus = result.multistatus;
      if (multistatus === '') {
        return {
          multistatus: {
            response: [],
          },
        };
      }
      if (!multistatus) {
        throw new Error('Invalid response: No root multistatus found');
      }
      var output = {
        multistatus: Array.isArray(multistatus) ? multistatus[0] : multistatus,
      };
      nested_property_1.default.set(
        output,
        'multistatus.response',
        getPropertyOfType(output, 'multistatus.response', PropertyType.Array)
      );
      nested_property_1.default.set(
        output,
        'multistatus.response',
        nested_property_1.default.get(output, 'multistatus.response').map(function (response) {
          return normaliseResponse(response);
        })
      );
      return output;
    }
    function getParser() {
      return new fast_xml_parser_1.XMLParser({
        removeNSPrefix: true,
        numberParseOptions: {
          hex: true,
          leadingZeros: false,
        },
        // // We don't use the processors here as decoding is done manually
        // // later on - decoding early would break some path checks.
        // attributeValueProcessor: val => decodeHTMLEntities(decodeURIComponent(val)),
        // tagValueProcessor: val => decodeHTMLEntities(decodeURIComponent(val))
      });
    }
    function parseXML(xml) {
      return new Promise(function (resolve) {
        var result = getParser().parse(xml);
        resolve(normaliseResult(result));
      });
    }
    exports2.parseXML = parseXML;
    function prepareFileFromProps(props, rawFilename, isDetailed) {
      if (isDetailed === void 0) {
        isDetailed = false;
      }
      var _a = props.getlastmodified,
        lastMod = _a === void 0 ? null : _a,
        _b = props.getcontentlength,
        rawSize = _b === void 0 ? '0' : _b,
        _c = props.resourcetype,
        resourceType = _c === void 0 ? null : _c,
        _d = props.getcontenttype,
        mimeType = _d === void 0 ? null : _d,
        _e = props.getetag,
        etag = _e === void 0 ? null : _e;
      var type =
        resourceType &&
        typeof resourceType === 'object' &&
        typeof resourceType.collection !== 'undefined'
          ? 'directory'
          : 'file';
      var filename = (0, encode_1.decodeHTMLEntities)(rawFilename);
      var stat = {
        filename,
        basename: path_posix_1.default.basename(filename),
        lastmod: lastMod,
        size: parseInt(rawSize, 10),
        type,
        etag: typeof etag === 'string' ? etag.replace(/"/g, '') : null,
      };
      if (type === 'file') {
        stat.mime = mimeType && typeof mimeType === 'string' ? mimeType.split(';')[0] : '';
      }
      if (isDetailed) {
        stat.props = props;
      }
      return stat;
    }
    exports2.prepareFileFromProps = prepareFileFromProps;
    function parseStat(result, filename, isDetailed) {
      if (isDetailed === void 0) {
        isDetailed = false;
      }
      var responseItem = null;
      try {
        responseItem = result.multistatus.response[0];
      } catch (e) {}
      if (!responseItem) {
        throw new Error('Failed getting item stat: bad response');
      }
      var _a = responseItem.propstat,
        props = _a.prop,
        statusLine = _a.status;
      var _b = statusLine.split(' ', 3),
        _ = _b[0],
        statusCodeStr = _b[1],
        statusText = _b[2];
      var statusCode = parseInt(statusCodeStr, 10);
      if (statusCode >= 400) {
        var err = new Error('Invalid response: '.concat(statusCode, ' ').concat(statusText));
        err.status = statusCode;
        throw err;
      }
      var filePath = (0, path_1.normalisePath)(filename);
      return prepareFileFromProps(props, filePath, isDetailed);
    }
    exports2.parseStat = parseStat;
    function translateDiskSpace(value) {
      switch (value.toString()) {
        case '-3':
          return 'unlimited';
        case '-2':
        /* falls-through */
        case '-1':
          return 'unknown';
        default:
          return parseInt(value, 10);
      }
    }
    exports2.translateDiskSpace = translateDiskSpace;
  },
});

// node_modules/webdav/dist/node/operations/stat.js
var require_stat = __commonJS({
  'node_modules/webdav/dist/node/operations/stat.js'(exports2) {
    'use strict';
    var __awaiter =
      (exports2 && exports2.__awaiter) ||
      function (thisArg, _arguments, P, generator) {
        function adopt(value) {
          return value instanceof P
            ? value
            : new P(function (resolve) {
                resolve(value);
              });
        }
        return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) {
            try {
              step(generator.next(value));
            } catch (e) {
              reject(e);
            }
          }
          function rejected(value) {
            try {
              step(generator['throw'](value));
            } catch (e) {
              reject(e);
            }
          }
          function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
          }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
      };
    var __generator =
      (exports2 && exports2.__generator) ||
      function (thisArg, body) {
        var _ = {
            label: 0,
            sent: function () {
              if (t[0] & 1) throw t[1];
              return t[1];
            },
            trys: [],
            ops: [],
          },
          f,
          y,
          t,
          g;
        return (
          (g = { next: verb(0), throw: verb(1), return: verb(2) }),
          typeof Symbol === 'function' &&
            (g[Symbol.iterator] = function () {
              return this;
            }),
          g
        );
        function verb(n) {
          return function (v) {
            return step([n, v]);
          };
        }
        function step(op) {
          if (f) throw new TypeError('Generator is already executing.');
          while (_)
            try {
              if (
                ((f = 1),
                y &&
                  (t =
                    op[0] & 2
                      ? y['return']
                      : op[0]
                        ? y['throw'] || ((t = y['return']) && t.call(y), 0)
                        : y.next) &&
                  !(t = t.call(y, op[1])).done)
              )
                return t;
              if (((y = 0), t)) op = [op[0] & 2, t.value];
              switch (op[0]) {
                case 0:
                case 1:
                  t = op;
                  break;
                case 4:
                  _.label++;
                  return { value: op[1], done: false };
                case 5:
                  _.label++;
                  y = op[1];
                  op = [0];
                  continue;
                case 7:
                  op = _.ops.pop();
                  _.trys.pop();
                  continue;
                default:
                  if (
                    !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                    (op[0] === 6 || op[0] === 2)
                  ) {
                    _ = 0;
                    continue;
                  }
                  if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                    _.label = op[1];
                    break;
                  }
                  if (op[0] === 6 && _.label < t[1]) {
                    _.label = t[1];
                    t = op;
                    break;
                  }
                  if (t && _.label < t[2]) {
                    _.label = t[2];
                    _.ops.push(op);
                    break;
                  }
                  if (t[2]) _.ops.pop();
                  _.trys.pop();
                  continue;
              }
              op = body.call(thisArg, _);
            } catch (e) {
              op = [6, e];
              y = 0;
            } finally {
              f = t = 0;
            }
          if (op[0] & 5) throw op[1];
          return { value: op[0] ? op[1] : void 0, done: true };
        }
      };
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.getStat = void 0;
    var dav_12 = require_dav();
    var url_1 = require_url();
    var path_1 = require_path();
    var request_1 = require_request();
    var response_1 = require_response();
    function getStat(context, filename, options) {
      if (options === void 0) {
        options = {};
      }
      return __awaiter(this, void 0, void 0, function () {
        var _a, isDetailed, requestOptions, response, result, stat;
        return __generator(this, function (_b) {
          switch (_b.label) {
            case 0:
              ((_a = options.details), (isDetailed = _a === void 0 ? false : _a));
              requestOptions = (0, request_1.prepareRequestOptions)(
                {
                  url: (0, url_1.joinURL)(context.remoteURL, (0, path_1.encodePath)(filename)),
                  method: 'PROPFIND',
                  headers: {
                    Accept: 'text/plain,application/xml',
                    Depth: '0',
                  },
                  responseType: 'text',
                },
                context,
                options
              );
              return [4, (0, request_1.request)(requestOptions)];
            case 1:
              response = _b.sent();
              (0, response_1.handleResponseCode)(context, response);
              return [4, (0, dav_12.parseXML)(response.data)];
            case 2:
              result = _b.sent();
              stat = (0, dav_12.parseStat)(result, filename, isDetailed);
              return [2, (0, response_1.processResponsePayload)(response, stat, isDetailed)];
          }
        });
      });
    }
    exports2.getStat = getStat;
  },
});

// node_modules/webdav/dist/node/operations/createDirectory.js
var require_createDirectory = __commonJS({
  'node_modules/webdav/dist/node/operations/createDirectory.js'(exports2) {
    'use strict';
    var __assign =
      (exports2 && exports2.__assign) ||
      function () {
        __assign =
          Object.assign ||
          function (t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
              s = arguments[i];
              for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
          };
        return __assign.apply(this, arguments);
      };
    var __awaiter =
      (exports2 && exports2.__awaiter) ||
      function (thisArg, _arguments, P, generator) {
        function adopt(value) {
          return value instanceof P
            ? value
            : new P(function (resolve) {
                resolve(value);
              });
        }
        return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) {
            try {
              step(generator.next(value));
            } catch (e) {
              reject(e);
            }
          }
          function rejected(value) {
            try {
              step(generator['throw'](value));
            } catch (e) {
              reject(e);
            }
          }
          function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
          }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
      };
    var __generator =
      (exports2 && exports2.__generator) ||
      function (thisArg, body) {
        var _ = {
            label: 0,
            sent: function () {
              if (t[0] & 1) throw t[1];
              return t[1];
            },
            trys: [],
            ops: [],
          },
          f,
          y,
          t,
          g;
        return (
          (g = { next: verb(0), throw: verb(1), return: verb(2) }),
          typeof Symbol === 'function' &&
            (g[Symbol.iterator] = function () {
              return this;
            }),
          g
        );
        function verb(n) {
          return function (v) {
            return step([n, v]);
          };
        }
        function step(op) {
          if (f) throw new TypeError('Generator is already executing.');
          while (_)
            try {
              if (
                ((f = 1),
                y &&
                  (t =
                    op[0] & 2
                      ? y['return']
                      : op[0]
                        ? y['throw'] || ((t = y['return']) && t.call(y), 0)
                        : y.next) &&
                  !(t = t.call(y, op[1])).done)
              )
                return t;
              if (((y = 0), t)) op = [op[0] & 2, t.value];
              switch (op[0]) {
                case 0:
                case 1:
                  t = op;
                  break;
                case 4:
                  _.label++;
                  return { value: op[1], done: false };
                case 5:
                  _.label++;
                  y = op[1];
                  op = [0];
                  continue;
                case 7:
                  op = _.ops.pop();
                  _.trys.pop();
                  continue;
                default:
                  if (
                    !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                    (op[0] === 6 || op[0] === 2)
                  ) {
                    _ = 0;
                    continue;
                  }
                  if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                    _.label = op[1];
                    break;
                  }
                  if (op[0] === 6 && _.label < t[1]) {
                    _.label = t[1];
                    t = op;
                    break;
                  }
                  if (t && _.label < t[2]) {
                    _.label = t[2];
                    _.ops.push(op);
                    break;
                  }
                  if (t[2]) _.ops.pop();
                  _.trys.pop();
                  continue;
              }
              op = body.call(thisArg, _);
            } catch (e) {
              op = [6, e];
              y = 0;
            } finally {
              f = t = 0;
            }
          if (op[0] & 5) throw op[1];
          return { value: op[0] ? op[1] : void 0, done: true };
        }
      };
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.createDirectory = void 0;
    var url_1 = require_url();
    var path_1 = require_path();
    var request_1 = require_request();
    var response_1 = require_response();
    var stat_1 = require_stat();
    function createDirectory(context, dirPath, options) {
      if (options === void 0) {
        options = {};
      }
      return __awaiter(this, void 0, void 0, function () {
        var requestOptions, response;
        return __generator(this, function (_a) {
          switch (_a.label) {
            case 0:
              if (options.recursive === true)
                return [2, createDirectoryRecursively(context, dirPath, options)];
              requestOptions = (0, request_1.prepareRequestOptions)(
                {
                  url: (0, url_1.joinURL)(
                    context.remoteURL,
                    ensureCollectionPath((0, path_1.encodePath)(dirPath))
                  ),
                  method: 'MKCOL',
                },
                context,
                options
              );
              return [4, (0, request_1.request)(requestOptions)];
            case 1:
              response = _a.sent();
              (0, response_1.handleResponseCode)(context, response);
              return [
                2,
                /*return*/
              ];
          }
        });
      });
    }
    exports2.createDirectory = createDirectory;
    function ensureCollectionPath(path) {
      if (!path.endsWith('/')) {
        return path + '/';
      }
      return path;
    }
    function createDirectoryRecursively(context, dirPath, options) {
      if (options === void 0) {
        options = {};
      }
      return __awaiter(this, void 0, void 0, function () {
        var paths, creating, _i, paths_1, testPath, testStat, err_1, error;
        return __generator(this, function (_a) {
          switch (_a.label) {
            case 0:
              paths = (0, path_1.getAllDirectories)((0, path_1.normalisePath)(dirPath));
              paths.sort(function (a, b) {
                if (a.length > b.length) {
                  return 1;
                } else if (b.length > a.length) {
                  return -1;
                }
                return 0;
              });
              creating = false;
              ((_i = 0), (paths_1 = paths));
              _a.label = 1;
            case 1:
              if (!(_i < paths_1.length)) return [3, 10];
              testPath = paths_1[_i];
              if (!creating) return [3, 3];
              return [
                4,
                createDirectory(
                  context,
                  testPath,
                  __assign(__assign({}, options), { recursive: false })
                ),
              ];
            case 2:
              _a.sent();
              return [3, 9];
            case 3:
              _a.trys.push([3, 5, , 9]);
              return [4, (0, stat_1.getStat)(context, testPath)];
            case 4:
              testStat = _a.sent();
              if (testStat.type !== 'directory') {
                throw new Error('Path includes a file: '.concat(dirPath));
              }
              return [3, 9];
            case 5:
              err_1 = _a.sent();
              error = err_1;
              if (!(error.status === 404)) return [3, 7];
              creating = true;
              return [
                4,
                createDirectory(
                  context,
                  testPath,
                  __assign(__assign({}, options), { recursive: false })
                ),
              ];
            case 6:
              _a.sent();
              return [3, 8];
            case 7:
              throw err_1;
            case 8:
              return [3, 9];
            case 9:
              _i++;
              return [3, 1];
            case 10:
              return [
                2,
                /*return*/
              ];
          }
        });
      });
    }
  },
});

// node_modules/webdav/dist/node/operations/createStream.js
var require_createStream = __commonJS({
  'node_modules/webdav/dist/node/operations/createStream.js'(exports2) {
    'use strict';
    var __awaiter =
      (exports2 && exports2.__awaiter) ||
      function (thisArg, _arguments, P, generator) {
        function adopt(value) {
          return value instanceof P
            ? value
            : new P(function (resolve) {
                resolve(value);
              });
        }
        return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) {
            try {
              step(generator.next(value));
            } catch (e) {
              reject(e);
            }
          }
          function rejected(value) {
            try {
              step(generator['throw'](value));
            } catch (e) {
              reject(e);
            }
          }
          function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
          }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
      };
    var __generator =
      (exports2 && exports2.__generator) ||
      function (thisArg, body) {
        var _ = {
            label: 0,
            sent: function () {
              if (t[0] & 1) throw t[1];
              return t[1];
            },
            trys: [],
            ops: [],
          },
          f,
          y,
          t,
          g;
        return (
          (g = { next: verb(0), throw: verb(1), return: verb(2) }),
          typeof Symbol === 'function' &&
            (g[Symbol.iterator] = function () {
              return this;
            }),
          g
        );
        function verb(n) {
          return function (v) {
            return step([n, v]);
          };
        }
        function step(op) {
          if (f) throw new TypeError('Generator is already executing.');
          while (_)
            try {
              if (
                ((f = 1),
                y &&
                  (t =
                    op[0] & 2
                      ? y['return']
                      : op[0]
                        ? y['throw'] || ((t = y['return']) && t.call(y), 0)
                        : y.next) &&
                  !(t = t.call(y, op[1])).done)
              )
                return t;
              if (((y = 0), t)) op = [op[0] & 2, t.value];
              switch (op[0]) {
                case 0:
                case 1:
                  t = op;
                  break;
                case 4:
                  _.label++;
                  return { value: op[1], done: false };
                case 5:
                  _.label++;
                  y = op[1];
                  op = [0];
                  continue;
                case 7:
                  op = _.ops.pop();
                  _.trys.pop();
                  continue;
                default:
                  if (
                    !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                    (op[0] === 6 || op[0] === 2)
                  ) {
                    _ = 0;
                    continue;
                  }
                  if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                    _.label = op[1];
                    break;
                  }
                  if (op[0] === 6 && _.label < t[1]) {
                    _.label = t[1];
                    t = op;
                    break;
                  }
                  if (t && _.label < t[2]) {
                    _.label = t[2];
                    _.ops.push(op);
                    break;
                  }
                  if (t[2]) _.ops.pop();
                  _.trys.pop();
                  continue;
              }
              op = body.call(thisArg, _);
            } catch (e) {
              op = [6, e];
              y = 0;
            } finally {
              f = t = 0;
            }
          if (op[0] & 5) throw op[1];
          return { value: op[0] ? op[1] : void 0, done: true };
        }
      };
    var __importDefault =
      (exports2 && exports2.__importDefault) ||
      function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
      };
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.createWriteStream = exports2.createReadStream = void 0;
    var stream_1 = __importDefault(require('stream'));
    var url_1 = require_url();
    var path_1 = require_path();
    var request_1 = require_request();
    var response_1 = require_response();
    var NOOP = function () {};
    function createReadStream(context, filePath, options) {
      if (options === void 0) {
        options = {};
      }
      var PassThroughStream = stream_1.default.PassThrough;
      var outStream = new PassThroughStream();
      getFileStream(context, filePath, options)
        .then(function (stream) {
          stream.pipe(outStream);
        })
        .catch(function (err) {
          outStream.emit('error', err);
        });
      return outStream;
    }
    exports2.createReadStream = createReadStream;
    function createWriteStream(context, filePath, options, callback) {
      if (options === void 0) {
        options = {};
      }
      if (callback === void 0) {
        callback = NOOP;
      }
      var PassThroughStream = stream_1.default.PassThrough;
      var writeStream = new PassThroughStream();
      var headers = {};
      if (options.overwrite === false) {
        headers['If-None-Match'] = '*';
      }
      var requestOptions = (0, request_1.prepareRequestOptions)(
        {
          url: (0, url_1.joinURL)(context.remoteURL, (0, path_1.encodePath)(filePath)),
          method: 'PUT',
          headers,
          data: writeStream,
          maxRedirects: 0,
        },
        context,
        options
      );
      (0, request_1.request)(requestOptions)
        .then(function (response) {
          return (0, response_1.handleResponseCode)(context, response);
        })
        .then(function (response) {
          setTimeout(function () {
            callback(response);
          }, 0);
        })
        .catch(function (err) {
          writeStream.emit('error', err);
        });
      return writeStream;
    }
    exports2.createWriteStream = createWriteStream;
    function getFileStream(context, filePath, options) {
      if (options === void 0) {
        options = {};
      }
      return __awaiter(this, void 0, void 0, function () {
        var headers, rangeHeader, requestOptions, response, responseError;
        return __generator(this, function (_a) {
          switch (_a.label) {
            case 0:
              headers = {};
              if (typeof options.range === 'object' && typeof options.range.start === 'number') {
                rangeHeader = 'bytes='.concat(options.range.start, '-');
                if (typeof options.range.end === 'number') {
                  rangeHeader = ''.concat(rangeHeader).concat(options.range.end);
                }
                headers.Range = rangeHeader;
              }
              requestOptions = (0, request_1.prepareRequestOptions)(
                {
                  url: (0, url_1.joinURL)(context.remoteURL, (0, path_1.encodePath)(filePath)),
                  method: 'GET',
                  headers,
                  responseType: 'stream',
                },
                context,
                options
              );
              return [4, (0, request_1.request)(requestOptions)];
            case 1:
              response = _a.sent();
              (0, response_1.handleResponseCode)(context, response);
              if (headers.Range && response.status !== 206) {
                responseError = new Error(
                  'Invalid response code for partial request: '.concat(response.status)
                );
                responseError.status = response.status;
                throw responseError;
              }
              if (options.callback) {
                setTimeout(function () {
                  options.callback(response);
                }, 0);
              }
              return [2, response.data];
          }
        });
      });
    }
  },
});

// node_modules/webdav/dist/node/operations/customRequest.js
var require_customRequest = __commonJS({
  'node_modules/webdav/dist/node/operations/customRequest.js'(exports2) {
    'use strict';
    var __awaiter =
      (exports2 && exports2.__awaiter) ||
      function (thisArg, _arguments, P, generator) {
        function adopt(value) {
          return value instanceof P
            ? value
            : new P(function (resolve) {
                resolve(value);
              });
        }
        return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) {
            try {
              step(generator.next(value));
            } catch (e) {
              reject(e);
            }
          }
          function rejected(value) {
            try {
              step(generator['throw'](value));
            } catch (e) {
              reject(e);
            }
          }
          function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
          }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
      };
    var __generator =
      (exports2 && exports2.__generator) ||
      function (thisArg, body) {
        var _ = {
            label: 0,
            sent: function () {
              if (t[0] & 1) throw t[1];
              return t[1];
            },
            trys: [],
            ops: [],
          },
          f,
          y,
          t,
          g;
        return (
          (g = { next: verb(0), throw: verb(1), return: verb(2) }),
          typeof Symbol === 'function' &&
            (g[Symbol.iterator] = function () {
              return this;
            }),
          g
        );
        function verb(n) {
          return function (v) {
            return step([n, v]);
          };
        }
        function step(op) {
          if (f) throw new TypeError('Generator is already executing.');
          while (_)
            try {
              if (
                ((f = 1),
                y &&
                  (t =
                    op[0] & 2
                      ? y['return']
                      : op[0]
                        ? y['throw'] || ((t = y['return']) && t.call(y), 0)
                        : y.next) &&
                  !(t = t.call(y, op[1])).done)
              )
                return t;
              if (((y = 0), t)) op = [op[0] & 2, t.value];
              switch (op[0]) {
                case 0:
                case 1:
                  t = op;
                  break;
                case 4:
                  _.label++;
                  return { value: op[1], done: false };
                case 5:
                  _.label++;
                  y = op[1];
                  op = [0];
                  continue;
                case 7:
                  op = _.ops.pop();
                  _.trys.pop();
                  continue;
                default:
                  if (
                    !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                    (op[0] === 6 || op[0] === 2)
                  ) {
                    _ = 0;
                    continue;
                  }
                  if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                    _.label = op[1];
                    break;
                  }
                  if (op[0] === 6 && _.label < t[1]) {
                    _.label = t[1];
                    t = op;
                    break;
                  }
                  if (t && _.label < t[2]) {
                    _.label = t[2];
                    _.ops.push(op);
                    break;
                  }
                  if (t[2]) _.ops.pop();
                  _.trys.pop();
                  continue;
              }
              op = body.call(thisArg, _);
            } catch (e) {
              op = [6, e];
              y = 0;
            } finally {
              f = t = 0;
            }
          if (op[0] & 5) throw op[1];
          return { value: op[0] ? op[1] : void 0, done: true };
        }
      };
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.customRequest = void 0;
    var url_1 = require_url();
    var path_1 = require_path();
    var request_1 = require_request();
    var response_1 = require_response();
    function customRequest(context, remotePath, requestOptions) {
      return __awaiter(this, void 0, void 0, function () {
        var finalOptions, response;
        return __generator(this, function (_a) {
          switch (_a.label) {
            case 0:
              if (!requestOptions.url) {
                requestOptions.url = (0, url_1.joinURL)(
                  context.remoteURL,
                  (0, path_1.encodePath)(remotePath)
                );
              }
              finalOptions = (0, request_1.prepareRequestOptions)(requestOptions, context, {});
              return [4, (0, request_1.request)(finalOptions)];
            case 1:
              response = _a.sent();
              (0, response_1.handleResponseCode)(context, response);
              return [2, response];
          }
        });
      });
    }
    exports2.customRequest = customRequest;
  },
});

// node_modules/webdav/dist/node/operations/deleteFile.js
var require_deleteFile = __commonJS({
  'node_modules/webdav/dist/node/operations/deleteFile.js'(exports2) {
    'use strict';
    var __awaiter =
      (exports2 && exports2.__awaiter) ||
      function (thisArg, _arguments, P, generator) {
        function adopt(value) {
          return value instanceof P
            ? value
            : new P(function (resolve) {
                resolve(value);
              });
        }
        return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) {
            try {
              step(generator.next(value));
            } catch (e) {
              reject(e);
            }
          }
          function rejected(value) {
            try {
              step(generator['throw'](value));
            } catch (e) {
              reject(e);
            }
          }
          function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
          }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
      };
    var __generator =
      (exports2 && exports2.__generator) ||
      function (thisArg, body) {
        var _ = {
            label: 0,
            sent: function () {
              if (t[0] & 1) throw t[1];
              return t[1];
            },
            trys: [],
            ops: [],
          },
          f,
          y,
          t,
          g;
        return (
          (g = { next: verb(0), throw: verb(1), return: verb(2) }),
          typeof Symbol === 'function' &&
            (g[Symbol.iterator] = function () {
              return this;
            }),
          g
        );
        function verb(n) {
          return function (v) {
            return step([n, v]);
          };
        }
        function step(op) {
          if (f) throw new TypeError('Generator is already executing.');
          while (_)
            try {
              if (
                ((f = 1),
                y &&
                  (t =
                    op[0] & 2
                      ? y['return']
                      : op[0]
                        ? y['throw'] || ((t = y['return']) && t.call(y), 0)
                        : y.next) &&
                  !(t = t.call(y, op[1])).done)
              )
                return t;
              if (((y = 0), t)) op = [op[0] & 2, t.value];
              switch (op[0]) {
                case 0:
                case 1:
                  t = op;
                  break;
                case 4:
                  _.label++;
                  return { value: op[1], done: false };
                case 5:
                  _.label++;
                  y = op[1];
                  op = [0];
                  continue;
                case 7:
                  op = _.ops.pop();
                  _.trys.pop();
                  continue;
                default:
                  if (
                    !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                    (op[0] === 6 || op[0] === 2)
                  ) {
                    _ = 0;
                    continue;
                  }
                  if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                    _.label = op[1];
                    break;
                  }
                  if (op[0] === 6 && _.label < t[1]) {
                    _.label = t[1];
                    t = op;
                    break;
                  }
                  if (t && _.label < t[2]) {
                    _.label = t[2];
                    _.ops.push(op);
                    break;
                  }
                  if (t[2]) _.ops.pop();
                  _.trys.pop();
                  continue;
              }
              op = body.call(thisArg, _);
            } catch (e) {
              op = [6, e];
              y = 0;
            } finally {
              f = t = 0;
            }
          if (op[0] & 5) throw op[1];
          return { value: op[0] ? op[1] : void 0, done: true };
        }
      };
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.deleteFile = void 0;
    var url_1 = require_url();
    var path_1 = require_path();
    var request_1 = require_request();
    var response_1 = require_response();
    function deleteFile(context, filename, options) {
      if (options === void 0) {
        options = {};
      }
      return __awaiter(this, void 0, void 0, function () {
        var requestOptions, response;
        return __generator(this, function (_a) {
          switch (_a.label) {
            case 0:
              requestOptions = (0, request_1.prepareRequestOptions)(
                {
                  url: (0, url_1.joinURL)(context.remoteURL, (0, path_1.encodePath)(filename)),
                  method: 'DELETE',
                },
                context,
                options
              );
              return [4, (0, request_1.request)(requestOptions)];
            case 1:
              response = _a.sent();
              (0, response_1.handleResponseCode)(context, response);
              return [
                2,
                /*return*/
              ];
          }
        });
      });
    }
    exports2.deleteFile = deleteFile;
  },
});

// node_modules/webdav/dist/node/operations/exists.js
var require_exists = __commonJS({
  'node_modules/webdav/dist/node/operations/exists.js'(exports2) {
    'use strict';
    var __awaiter =
      (exports2 && exports2.__awaiter) ||
      function (thisArg, _arguments, P, generator) {
        function adopt(value) {
          return value instanceof P
            ? value
            : new P(function (resolve) {
                resolve(value);
              });
        }
        return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) {
            try {
              step(generator.next(value));
            } catch (e) {
              reject(e);
            }
          }
          function rejected(value) {
            try {
              step(generator['throw'](value));
            } catch (e) {
              reject(e);
            }
          }
          function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
          }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
      };
    var __generator =
      (exports2 && exports2.__generator) ||
      function (thisArg, body) {
        var _ = {
            label: 0,
            sent: function () {
              if (t[0] & 1) throw t[1];
              return t[1];
            },
            trys: [],
            ops: [],
          },
          f,
          y,
          t,
          g;
        return (
          (g = { next: verb(0), throw: verb(1), return: verb(2) }),
          typeof Symbol === 'function' &&
            (g[Symbol.iterator] = function () {
              return this;
            }),
          g
        );
        function verb(n) {
          return function (v) {
            return step([n, v]);
          };
        }
        function step(op) {
          if (f) throw new TypeError('Generator is already executing.');
          while (_)
            try {
              if (
                ((f = 1),
                y &&
                  (t =
                    op[0] & 2
                      ? y['return']
                      : op[0]
                        ? y['throw'] || ((t = y['return']) && t.call(y), 0)
                        : y.next) &&
                  !(t = t.call(y, op[1])).done)
              )
                return t;
              if (((y = 0), t)) op = [op[0] & 2, t.value];
              switch (op[0]) {
                case 0:
                case 1:
                  t = op;
                  break;
                case 4:
                  _.label++;
                  return { value: op[1], done: false };
                case 5:
                  _.label++;
                  y = op[1];
                  op = [0];
                  continue;
                case 7:
                  op = _.ops.pop();
                  _.trys.pop();
                  continue;
                default:
                  if (
                    !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                    (op[0] === 6 || op[0] === 2)
                  ) {
                    _ = 0;
                    continue;
                  }
                  if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                    _.label = op[1];
                    break;
                  }
                  if (op[0] === 6 && _.label < t[1]) {
                    _.label = t[1];
                    t = op;
                    break;
                  }
                  if (t && _.label < t[2]) {
                    _.label = t[2];
                    _.ops.push(op);
                    break;
                  }
                  if (t[2]) _.ops.pop();
                  _.trys.pop();
                  continue;
              }
              op = body.call(thisArg, _);
            } catch (e) {
              op = [6, e];
              y = 0;
            } finally {
              f = t = 0;
            }
          if (op[0] & 5) throw op[1];
          return { value: op[0] ? op[1] : void 0, done: true };
        }
      };
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.exists = void 0;
    var stat_1 = require_stat();
    function exists(context, remotePath, options) {
      if (options === void 0) {
        options = {};
      }
      return __awaiter(this, void 0, void 0, function () {
        var err_1;
        return __generator(this, function (_a) {
          switch (_a.label) {
            case 0:
              _a.trys.push([0, 2, , 3]);
              return [4, (0, stat_1.getStat)(context, remotePath, options)];
            case 1:
              _a.sent();
              return [2, true];
            case 2:
              err_1 = _a.sent();
              if (err_1.status === 404) {
                return [2, false];
              }
              throw err_1;
            case 3:
              return [
                2,
                /*return*/
              ];
          }
        });
      });
    }
    exports2.exists = exists;
  },
});

// node_modules/webdav/dist/node/operations/directoryContents.js
var require_directoryContents = __commonJS({
  'node_modules/webdav/dist/node/operations/directoryContents.js'(exports2) {
    'use strict';
    var __awaiter =
      (exports2 && exports2.__awaiter) ||
      function (thisArg, _arguments, P, generator) {
        function adopt(value) {
          return value instanceof P
            ? value
            : new P(function (resolve) {
                resolve(value);
              });
        }
        return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) {
            try {
              step(generator.next(value));
            } catch (e) {
              reject(e);
            }
          }
          function rejected(value) {
            try {
              step(generator['throw'](value));
            } catch (e) {
              reject(e);
            }
          }
          function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
          }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
      };
    var __generator =
      (exports2 && exports2.__generator) ||
      function (thisArg, body) {
        var _ = {
            label: 0,
            sent: function () {
              if (t[0] & 1) throw t[1];
              return t[1];
            },
            trys: [],
            ops: [],
          },
          f,
          y,
          t,
          g;
        return (
          (g = { next: verb(0), throw: verb(1), return: verb(2) }),
          typeof Symbol === 'function' &&
            (g[Symbol.iterator] = function () {
              return this;
            }),
          g
        );
        function verb(n) {
          return function (v) {
            return step([n, v]);
          };
        }
        function step(op) {
          if (f) throw new TypeError('Generator is already executing.');
          while (_)
            try {
              if (
                ((f = 1),
                y &&
                  (t =
                    op[0] & 2
                      ? y['return']
                      : op[0]
                        ? y['throw'] || ((t = y['return']) && t.call(y), 0)
                        : y.next) &&
                  !(t = t.call(y, op[1])).done)
              )
                return t;
              if (((y = 0), t)) op = [op[0] & 2, t.value];
              switch (op[0]) {
                case 0:
                case 1:
                  t = op;
                  break;
                case 4:
                  _.label++;
                  return { value: op[1], done: false };
                case 5:
                  _.label++;
                  y = op[1];
                  op = [0];
                  continue;
                case 7:
                  op = _.ops.pop();
                  _.trys.pop();
                  continue;
                default:
                  if (
                    !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                    (op[0] === 6 || op[0] === 2)
                  ) {
                    _ = 0;
                    continue;
                  }
                  if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                    _.label = op[1];
                    break;
                  }
                  if (op[0] === 6 && _.label < t[1]) {
                    _.label = t[1];
                    t = op;
                    break;
                  }
                  if (t && _.label < t[2]) {
                    _.label = t[2];
                    _.ops.push(op);
                    break;
                  }
                  if (t[2]) _.ops.pop();
                  _.trys.pop();
                  continue;
              }
              op = body.call(thisArg, _);
            } catch (e) {
              op = [6, e];
              y = 0;
            } finally {
              f = t = 0;
            }
          if (op[0] & 5) throw op[1];
          return { value: op[0] ? op[1] : void 0, done: true };
        }
      };
    var __importDefault =
      (exports2 && exports2.__importDefault) ||
      function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
      };
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.getDirectoryContents = void 0;
    var path_posix_1 = __importDefault(require_path_posix());
    var url_1 = require_url();
    var path_1 = require_path();
    var dav_12 = require_dav();
    var request_1 = require_request();
    var response_1 = require_response();
    function getDirectoryContents(context, remotePath, options) {
      if (options === void 0) {
        options = {};
      }
      return __awaiter(this, void 0, void 0, function () {
        var requestOptions, response, davResp, _remotePath, files;
        return __generator(this, function (_a) {
          switch (_a.label) {
            case 0:
              requestOptions = (0, request_1.prepareRequestOptions)(
                {
                  url: (0, url_1.joinURL)(
                    context.remoteURL,
                    (0, path_1.encodePath)(remotePath),
                    '/'
                  ),
                  method: 'PROPFIND',
                  headers: {
                    Accept: 'text/plain',
                    Depth: options.deep ? 'infinity' : '1',
                  },
                  responseType: 'text',
                },
                context,
                options
              );
              return [4, (0, request_1.request)(requestOptions)];
            case 1:
              response = _a.sent();
              (0, response_1.handleResponseCode)(context, response);
              return [4, (0, dav_12.parseXML)(response.data)];
            case 2:
              davResp = _a.sent();
              _remotePath = remotePath.startsWith('/') ? remotePath : '/' + remotePath;
              files = getDirectoryFiles(davResp, context.remotePath, _remotePath, options.details);
              if (options.glob) {
                files = (0, response_1.processGlobFilter)(files, options.glob);
              }
              return [2, (0, response_1.processResponsePayload)(response, files, options.details)];
          }
        });
      });
    }
    exports2.getDirectoryContents = getDirectoryContents;
    function getDirectoryFiles(result, serverBasePath, requestPath, isDetailed) {
      if (isDetailed === void 0) {
        isDetailed = false;
      }
      var serverBase = path_posix_1.default.join(serverBasePath, '/');
      var responseItems = result.multistatus.response;
      return responseItems
        .map(function (item) {
          var href = (0, url_1.normaliseHREF)(item.href);
          var props = item.propstat.prop;
          var filename =
            serverBase === '/'
              ? decodeURIComponent((0, path_1.normalisePath)(href))
              : decodeURIComponent(
                  (0, path_1.normalisePath)(path_posix_1.default.relative(serverBase, href))
                );
          return (0, dav_12.prepareFileFromProps)(props, filename, isDetailed);
        })
        .filter(function (item) {
          return (
            item.basename &&
            (item.type === 'file' || item.filename !== requestPath.replace(/\/$/, ''))
          );
        });
    }
  },
});

// node_modules/webdav/dist/node/operations/getFileContents.js
var require_getFileContents = __commonJS({
  'node_modules/webdav/dist/node/operations/getFileContents.js'(exports2) {
    'use strict';
    var __awaiter =
      (exports2 && exports2.__awaiter) ||
      function (thisArg, _arguments, P, generator) {
        function adopt(value) {
          return value instanceof P
            ? value
            : new P(function (resolve) {
                resolve(value);
              });
        }
        return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) {
            try {
              step(generator.next(value));
            } catch (e) {
              reject(e);
            }
          }
          function rejected(value) {
            try {
              step(generator['throw'](value));
            } catch (e) {
              reject(e);
            }
          }
          function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
          }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
      };
    var __generator =
      (exports2 && exports2.__generator) ||
      function (thisArg, body) {
        var _ = {
            label: 0,
            sent: function () {
              if (t[0] & 1) throw t[1];
              return t[1];
            },
            trys: [],
            ops: [],
          },
          f,
          y,
          t,
          g;
        return (
          (g = { next: verb(0), throw: verb(1), return: verb(2) }),
          typeof Symbol === 'function' &&
            (g[Symbol.iterator] = function () {
              return this;
            }),
          g
        );
        function verb(n) {
          return function (v) {
            return step([n, v]);
          };
        }
        function step(op) {
          if (f) throw new TypeError('Generator is already executing.');
          while (_)
            try {
              if (
                ((f = 1),
                y &&
                  (t =
                    op[0] & 2
                      ? y['return']
                      : op[0]
                        ? y['throw'] || ((t = y['return']) && t.call(y), 0)
                        : y.next) &&
                  !(t = t.call(y, op[1])).done)
              )
                return t;
              if (((y = 0), t)) op = [op[0] & 2, t.value];
              switch (op[0]) {
                case 0:
                case 1:
                  t = op;
                  break;
                case 4:
                  _.label++;
                  return { value: op[1], done: false };
                case 5:
                  _.label++;
                  y = op[1];
                  op = [0];
                  continue;
                case 7:
                  op = _.ops.pop();
                  _.trys.pop();
                  continue;
                default:
                  if (
                    !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                    (op[0] === 6 || op[0] === 2)
                  ) {
                    _ = 0;
                    continue;
                  }
                  if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                    _.label = op[1];
                    break;
                  }
                  if (op[0] === 6 && _.label < t[1]) {
                    _.label = t[1];
                    t = op;
                    break;
                  }
                  if (t && _.label < t[2]) {
                    _.label = t[2];
                    _.ops.push(op);
                    break;
                  }
                  if (t[2]) _.ops.pop();
                  _.trys.pop();
                  continue;
              }
              op = body.call(thisArg, _);
            } catch (e) {
              op = [6, e];
              y = 0;
            } finally {
              f = t = 0;
            }
          if (op[0] & 5) throw op[1];
          return { value: op[0] ? op[1] : void 0, done: true };
        }
      };
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.getFileDownloadLink = exports2.getFileContents = void 0;
    var layerr_1 = require_dist();
    var url_1 = require_url();
    var path_1 = require_path();
    var encode_1 = require_encode();
    var request_1 = require_request();
    var response_1 = require_response();
    var types_1 = require_types2();
    var TRANSFORM_RETAIN_FORMAT = function (v) {
      return v;
    };
    function getFileContents(context, filePath, options) {
      if (options === void 0) {
        options = {};
      }
      return __awaiter(this, void 0, void 0, function () {
        var _a, format;
        return __generator(this, function (_b) {
          ((_a = options.format), (format = _a === void 0 ? 'binary' : _a));
          if (format !== 'binary' && format !== 'text') {
            throw new layerr_1.Layerr(
              {
                info: {
                  code: types_1.ErrorCode.InvalidOutputFormat,
                },
              },
              'Invalid output format: '.concat(format)
            );
          }
          return [
            2,
            format === 'text'
              ? getFileContentsString(context, filePath, options)
              : getFileContentsBuffer(context, filePath, options),
          ];
        });
      });
    }
    exports2.getFileContents = getFileContents;
    function getFileContentsBuffer(context, filePath, options) {
      if (options === void 0) {
        options = {};
      }
      return __awaiter(this, void 0, void 0, function () {
        var requestOptions, response;
        return __generator(this, function (_a) {
          switch (_a.label) {
            case 0:
              requestOptions = (0, request_1.prepareRequestOptions)(
                {
                  url: (0, url_1.joinURL)(context.remoteURL, (0, path_1.encodePath)(filePath)),
                  method: 'GET',
                  responseType: 'arraybuffer',
                },
                context,
                options
              );
              return [4, (0, request_1.request)(requestOptions)];
            case 1:
              response = _a.sent();
              (0, response_1.handleResponseCode)(context, response);
              return [
                2,
                (0, response_1.processResponsePayload)(response, response.data, options.details),
              ];
          }
        });
      });
    }
    function getFileContentsString(context, filePath, options) {
      if (options === void 0) {
        options = {};
      }
      return __awaiter(this, void 0, void 0, function () {
        var requestOptions, response;
        return __generator(this, function (_a) {
          switch (_a.label) {
            case 0:
              requestOptions = (0, request_1.prepareRequestOptions)(
                {
                  url: (0, url_1.joinURL)(context.remoteURL, (0, path_1.encodePath)(filePath)),
                  method: 'GET',
                  responseType: 'text',
                  transformResponse: [TRANSFORM_RETAIN_FORMAT],
                },
                context,
                options
              );
              return [4, (0, request_1.request)(requestOptions)];
            case 1:
              response = _a.sent();
              (0, response_1.handleResponseCode)(context, response);
              return [
                2,
                (0, response_1.processResponsePayload)(response, response.data, options.details),
              ];
          }
        });
      });
    }
    function getFileDownloadLink(context, filePath) {
      var url = (0, url_1.joinURL)(context.remoteURL, (0, path_1.encodePath)(filePath));
      var protocol = /^https:/i.test(url) ? 'https' : 'http';
      switch (context.authType) {
        case types_1.AuthType.None:
          break;
        case types_1.AuthType.Password: {
          var authPart = context.headers.Authorization.replace(/^Basic /i, '').trim();
          var authContents = (0, encode_1.fromBase64)(authPart);
          url = url.replace(/^https?:\/\//, ''.concat(protocol, '://').concat(authContents, '@'));
          break;
        }
        default:
          throw new layerr_1.Layerr(
            {
              info: {
                code: types_1.ErrorCode.LinkUnsupportedAuthType,
              },
            },
            'Unsupported auth type for file link: '.concat(context.authType)
          );
      }
      return url;
    }
    exports2.getFileDownloadLink = getFileDownloadLink;
  },
});

// node_modules/webdav/dist/node/tools/xml.js
var require_xml = __commonJS({
  'node_modules/webdav/dist/node/tools/xml.js'(exports2) {
    'use strict';
    var __assign =
      (exports2 && exports2.__assign) ||
      function () {
        __assign =
          Object.assign ||
          function (t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
              s = arguments[i];
              for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
          };
        return __assign.apply(this, arguments);
      };
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.parseGenericResponse = exports2.generateLockXML = void 0;
    var fast_xml_parser_1 = require_fxp();
    function generateLockXML(ownerHREF) {
      return getBuilder().build(
        namespace(
          {
            lockinfo: {
              '@_xmlns:d': 'DAV:',
              lockscope: {
                exclusive: {},
              },
              locktype: {
                write: {},
              },
              owner: {
                href: ownerHREF,
              },
            },
          },
          'd'
        )
      );
    }
    exports2.generateLockXML = generateLockXML;
    function getBuilder() {
      return new fast_xml_parser_1.XMLBuilder({
        attributeNamePrefix: '@_',
        format: true,
        ignoreAttributes: false,
        suppressEmptyNode: true,
      });
    }
    function getParser() {
      return new fast_xml_parser_1.XMLParser({
        removeNSPrefix: true,
        parseAttributeValue: true,
        parseTagValue: true,
      });
    }
    function namespace(obj, ns) {
      var copy = __assign({}, obj);
      for (var key in copy) {
        if (!copy.hasOwnProperty(key)) {
          continue;
        }
        if (copy[key] && typeof copy[key] === 'object' && key.indexOf(':') === -1) {
          copy[''.concat(ns, ':').concat(key)] = namespace(copy[key], ns);
          delete copy[key];
        } else if (/^@_/.test(key) === false) {
          copy[''.concat(ns, ':').concat(key)] = copy[key];
          delete copy[key];
        }
      }
      return copy;
    }
    function parseGenericResponse(xml) {
      return getParser().parse(xml);
    }
    exports2.parseGenericResponse = parseGenericResponse;
  },
});

// node_modules/webdav/dist/node/operations/lock.js
var require_lock = __commonJS({
  'node_modules/webdav/dist/node/operations/lock.js'(exports2) {
    'use strict';
    var __awaiter =
      (exports2 && exports2.__awaiter) ||
      function (thisArg, _arguments, P, generator) {
        function adopt(value) {
          return value instanceof P
            ? value
            : new P(function (resolve) {
                resolve(value);
              });
        }
        return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) {
            try {
              step(generator.next(value));
            } catch (e) {
              reject(e);
            }
          }
          function rejected(value) {
            try {
              step(generator['throw'](value));
            } catch (e) {
              reject(e);
            }
          }
          function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
          }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
      };
    var __generator =
      (exports2 && exports2.__generator) ||
      function (thisArg, body) {
        var _ = {
            label: 0,
            sent: function () {
              if (t[0] & 1) throw t[1];
              return t[1];
            },
            trys: [],
            ops: [],
          },
          f,
          y,
          t,
          g;
        return (
          (g = { next: verb(0), throw: verb(1), return: verb(2) }),
          typeof Symbol === 'function' &&
            (g[Symbol.iterator] = function () {
              return this;
            }),
          g
        );
        function verb(n) {
          return function (v) {
            return step([n, v]);
          };
        }
        function step(op) {
          if (f) throw new TypeError('Generator is already executing.');
          while (_)
            try {
              if (
                ((f = 1),
                y &&
                  (t =
                    op[0] & 2
                      ? y['return']
                      : op[0]
                        ? y['throw'] || ((t = y['return']) && t.call(y), 0)
                        : y.next) &&
                  !(t = t.call(y, op[1])).done)
              )
                return t;
              if (((y = 0), t)) op = [op[0] & 2, t.value];
              switch (op[0]) {
                case 0:
                case 1:
                  t = op;
                  break;
                case 4:
                  _.label++;
                  return { value: op[1], done: false };
                case 5:
                  _.label++;
                  y = op[1];
                  op = [0];
                  continue;
                case 7:
                  op = _.ops.pop();
                  _.trys.pop();
                  continue;
                default:
                  if (
                    !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                    (op[0] === 6 || op[0] === 2)
                  ) {
                    _ = 0;
                    continue;
                  }
                  if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                    _.label = op[1];
                    break;
                  }
                  if (op[0] === 6 && _.label < t[1]) {
                    _.label = t[1];
                    t = op;
                    break;
                  }
                  if (t && _.label < t[2]) {
                    _.label = t[2];
                    _.ops.push(op);
                    break;
                  }
                  if (t[2]) _.ops.pop();
                  _.trys.pop();
                  continue;
              }
              op = body.call(thisArg, _);
            } catch (e) {
              op = [6, e];
              y = 0;
            } finally {
              f = t = 0;
            }
          if (op[0] & 5) throw op[1];
          return { value: op[0] ? op[1] : void 0, done: true };
        }
      };
    var __importDefault =
      (exports2 && exports2.__importDefault) ||
      function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
      };
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.unlock = exports2.lock = void 0;
    var nested_property_1 = __importDefault(require_nested_property());
    var url_1 = require_url();
    var path_1 = require_path();
    var xml_1 = require_xml();
    var request_1 = require_request();
    var response_1 = require_response();
    var DEFAULT_TIMEOUT = 'Infinite, Second-4100000000';
    function lock(context, path, options) {
      if (options === void 0) {
        options = {};
      }
      return __awaiter(this, void 0, void 0, function () {
        var refreshToken,
          _a,
          timeout,
          headers,
          requestOptions,
          response,
          lockPayload,
          token,
          serverTimeout,
          err;
        return __generator(this, function (_b) {
          switch (_b.label) {
            case 0:
              ((refreshToken = options.refreshToken),
                (_a = options.timeout),
                (timeout = _a === void 0 ? DEFAULT_TIMEOUT : _a));
              headers = {
                Accept: 'text/plain,application/xml',
                Timeout: timeout,
              };
              if (refreshToken) {
                headers.If = refreshToken;
              }
              requestOptions = (0, request_1.prepareRequestOptions)(
                {
                  url: (0, url_1.joinURL)(context.remoteURL, (0, path_1.encodePath)(path)),
                  method: 'LOCK',
                  headers,
                  data: (0, xml_1.generateLockXML)(context.contactHref),
                  responseType: 'text',
                },
                context,
                options
              );
              return [4, (0, request_1.request)(requestOptions)];
            case 1:
              response = _b.sent();
              (0, response_1.handleResponseCode)(context, response);
              lockPayload = (0, xml_1.parseGenericResponse)(response.data);
              token = nested_property_1.default.get(
                lockPayload,
                'prop.lockdiscovery.activelock.locktoken.href'
              );
              serverTimeout = nested_property_1.default.get(
                lockPayload,
                'prop.lockdiscovery.activelock.timeout'
              );
              if (!token) {
                err = (0, response_1.createErrorFromResponse)(response, 'No lock token received: ');
                throw err;
              }
              return [
                2,
                {
                  token,
                  serverTimeout,
                },
              ];
          }
        });
      });
    }
    exports2.lock = lock;
    function unlock(context, path, token, options) {
      if (options === void 0) {
        options = {};
      }
      return __awaiter(this, void 0, void 0, function () {
        var requestOptions, response, err;
        return __generator(this, function (_a) {
          switch (_a.label) {
            case 0:
              requestOptions = (0, request_1.prepareRequestOptions)(
                {
                  url: (0, url_1.joinURL)(context.remoteURL, (0, path_1.encodePath)(path)),
                  method: 'UNLOCK',
                  headers: {
                    'Lock-Token': token,
                  },
                },
                context,
                options
              );
              return [4, (0, request_1.request)(requestOptions)];
            case 1:
              response = _a.sent();
              (0, response_1.handleResponseCode)(context, response);
              if (response.status !== 204 && response.status !== 200) {
                err = (0, response_1.createErrorFromResponse)(response);
                throw err;
              }
              return [
                2,
                /*return*/
              ];
          }
        });
      });
    }
    exports2.unlock = unlock;
  },
});

// node_modules/webdav/dist/node/tools/quota.js
var require_quota = __commonJS({
  'node_modules/webdav/dist/node/tools/quota.js'(exports2) {
    'use strict';
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.parseQuota = void 0;
    var dav_12 = require_dav();
    function parseQuota(result) {
      try {
        var responseItem = result.multistatus.response[0];
        var _a = responseItem.propstat.prop,
          quotaUsed = _a['quota-used-bytes'],
          quotaAvail = _a['quota-available-bytes'];
        return typeof quotaUsed !== 'undefined' && typeof quotaAvail !== 'undefined'
          ? {
              used: parseInt(quotaUsed, 10),
              available: (0, dav_12.translateDiskSpace)(quotaAvail),
            }
          : null;
      } catch (err) {}
      return null;
    }
    exports2.parseQuota = parseQuota;
  },
});

// node_modules/webdav/dist/node/operations/getQuota.js
var require_getQuota = __commonJS({
  'node_modules/webdav/dist/node/operations/getQuota.js'(exports2) {
    'use strict';
    var __awaiter =
      (exports2 && exports2.__awaiter) ||
      function (thisArg, _arguments, P, generator) {
        function adopt(value) {
          return value instanceof P
            ? value
            : new P(function (resolve) {
                resolve(value);
              });
        }
        return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) {
            try {
              step(generator.next(value));
            } catch (e) {
              reject(e);
            }
          }
          function rejected(value) {
            try {
              step(generator['throw'](value));
            } catch (e) {
              reject(e);
            }
          }
          function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
          }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
      };
    var __generator =
      (exports2 && exports2.__generator) ||
      function (thisArg, body) {
        var _ = {
            label: 0,
            sent: function () {
              if (t[0] & 1) throw t[1];
              return t[1];
            },
            trys: [],
            ops: [],
          },
          f,
          y,
          t,
          g;
        return (
          (g = { next: verb(0), throw: verb(1), return: verb(2) }),
          typeof Symbol === 'function' &&
            (g[Symbol.iterator] = function () {
              return this;
            }),
          g
        );
        function verb(n) {
          return function (v) {
            return step([n, v]);
          };
        }
        function step(op) {
          if (f) throw new TypeError('Generator is already executing.');
          while (_)
            try {
              if (
                ((f = 1),
                y &&
                  (t =
                    op[0] & 2
                      ? y['return']
                      : op[0]
                        ? y['throw'] || ((t = y['return']) && t.call(y), 0)
                        : y.next) &&
                  !(t = t.call(y, op[1])).done)
              )
                return t;
              if (((y = 0), t)) op = [op[0] & 2, t.value];
              switch (op[0]) {
                case 0:
                case 1:
                  t = op;
                  break;
                case 4:
                  _.label++;
                  return { value: op[1], done: false };
                case 5:
                  _.label++;
                  y = op[1];
                  op = [0];
                  continue;
                case 7:
                  op = _.ops.pop();
                  _.trys.pop();
                  continue;
                default:
                  if (
                    !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                    (op[0] === 6 || op[0] === 2)
                  ) {
                    _ = 0;
                    continue;
                  }
                  if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                    _.label = op[1];
                    break;
                  }
                  if (op[0] === 6 && _.label < t[1]) {
                    _.label = t[1];
                    t = op;
                    break;
                  }
                  if (t && _.label < t[2]) {
                    _.label = t[2];
                    _.ops.push(op);
                    break;
                  }
                  if (t[2]) _.ops.pop();
                  _.trys.pop();
                  continue;
              }
              op = body.call(thisArg, _);
            } catch (e) {
              op = [6, e];
              y = 0;
            } finally {
              f = t = 0;
            }
          if (op[0] & 5) throw op[1];
          return { value: op[0] ? op[1] : void 0, done: true };
        }
      };
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.getQuota = void 0;
    var request_1 = require_request();
    var response_1 = require_response();
    var dav_12 = require_dav();
    var url_1 = require_url();
    var quota_1 = require_quota();
    function getQuota(context, options) {
      if (options === void 0) {
        options = {};
      }
      return __awaiter(this, void 0, void 0, function () {
        var path, requestOptions, response, result, quota;
        return __generator(this, function (_a) {
          switch (_a.label) {
            case 0:
              path = options.path || '/';
              requestOptions = (0, request_1.prepareRequestOptions)(
                {
                  url: (0, url_1.joinURL)(context.remoteURL, path),
                  method: 'PROPFIND',
                  headers: {
                    Accept: 'text/plain',
                    Depth: '0',
                  },
                  responseType: 'text',
                },
                context,
                options
              );
              return [4, (0, request_1.request)(requestOptions)];
            case 1:
              response = _a.sent();
              (0, response_1.handleResponseCode)(context, response);
              return [4, (0, dav_12.parseXML)(response.data)];
            case 2:
              result = _a.sent();
              quota = (0, quota_1.parseQuota)(result);
              return [2, (0, response_1.processResponsePayload)(response, quota, options.details)];
          }
        });
      });
    }
    exports2.getQuota = getQuota;
  },
});

// node_modules/webdav/dist/node/operations/moveFile.js
var require_moveFile = __commonJS({
  'node_modules/webdav/dist/node/operations/moveFile.js'(exports2) {
    'use strict';
    var __awaiter =
      (exports2 && exports2.__awaiter) ||
      function (thisArg, _arguments, P, generator) {
        function adopt(value) {
          return value instanceof P
            ? value
            : new P(function (resolve) {
                resolve(value);
              });
        }
        return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) {
            try {
              step(generator.next(value));
            } catch (e) {
              reject(e);
            }
          }
          function rejected(value) {
            try {
              step(generator['throw'](value));
            } catch (e) {
              reject(e);
            }
          }
          function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
          }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
      };
    var __generator =
      (exports2 && exports2.__generator) ||
      function (thisArg, body) {
        var _ = {
            label: 0,
            sent: function () {
              if (t[0] & 1) throw t[1];
              return t[1];
            },
            trys: [],
            ops: [],
          },
          f,
          y,
          t,
          g;
        return (
          (g = { next: verb(0), throw: verb(1), return: verb(2) }),
          typeof Symbol === 'function' &&
            (g[Symbol.iterator] = function () {
              return this;
            }),
          g
        );
        function verb(n) {
          return function (v) {
            return step([n, v]);
          };
        }
        function step(op) {
          if (f) throw new TypeError('Generator is already executing.');
          while (_)
            try {
              if (
                ((f = 1),
                y &&
                  (t =
                    op[0] & 2
                      ? y['return']
                      : op[0]
                        ? y['throw'] || ((t = y['return']) && t.call(y), 0)
                        : y.next) &&
                  !(t = t.call(y, op[1])).done)
              )
                return t;
              if (((y = 0), t)) op = [op[0] & 2, t.value];
              switch (op[0]) {
                case 0:
                case 1:
                  t = op;
                  break;
                case 4:
                  _.label++;
                  return { value: op[1], done: false };
                case 5:
                  _.label++;
                  y = op[1];
                  op = [0];
                  continue;
                case 7:
                  op = _.ops.pop();
                  _.trys.pop();
                  continue;
                default:
                  if (
                    !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                    (op[0] === 6 || op[0] === 2)
                  ) {
                    _ = 0;
                    continue;
                  }
                  if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                    _.label = op[1];
                    break;
                  }
                  if (op[0] === 6 && _.label < t[1]) {
                    _.label = t[1];
                    t = op;
                    break;
                  }
                  if (t && _.label < t[2]) {
                    _.label = t[2];
                    _.ops.push(op);
                    break;
                  }
                  if (t[2]) _.ops.pop();
                  _.trys.pop();
                  continue;
              }
              op = body.call(thisArg, _);
            } catch (e) {
              op = [6, e];
              y = 0;
            } finally {
              f = t = 0;
            }
          if (op[0] & 5) throw op[1];
          return { value: op[0] ? op[1] : void 0, done: true };
        }
      };
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.moveFile = void 0;
    var url_1 = require_url();
    var path_1 = require_path();
    var request_1 = require_request();
    var response_1 = require_response();
    function moveFile(context, filename, destination, options) {
      if (options === void 0) {
        options = {};
      }
      return __awaiter(this, void 0, void 0, function () {
        var requestOptions, response;
        return __generator(this, function (_a) {
          switch (_a.label) {
            case 0:
              requestOptions = (0, request_1.prepareRequestOptions)(
                {
                  url: (0, url_1.joinURL)(context.remoteURL, (0, path_1.encodePath)(filename)),
                  method: 'MOVE',
                  headers: {
                    Destination: (0, url_1.joinURL)(
                      context.remoteURL,
                      (0, path_1.encodePath)(destination)
                    ),
                  },
                },
                context,
                options
              );
              return [4, (0, request_1.request)(requestOptions)];
            case 1:
              response = _a.sent();
              (0, response_1.handleResponseCode)(context, response);
              return [
                2,
                /*return*/
              ];
          }
        });
      });
    }
    exports2.moveFile = moveFile;
  },
});

// node_modules/byte-length/dist/index.js
var require_dist3 = __commonJS({
  'node_modules/byte-length/dist/index.js'(exports2) {
    'use strict';
    Object.defineProperty(exports2, '__esModule', { value: true });
    function byteLength(str) {
      if (!str) {
        return 0;
      }
      str = str.toString();
      var len = str.length;
      for (var i = str.length; i--; ) {
        var code = str.charCodeAt(i);
        if (56320 <= code && code <= 57343) {
          i--;
        }
        if (127 < code && code <= 2047) {
          len++;
        } else if (2047 < code && code <= 65535) {
          len += 2;
        }
      }
      return len;
    }
    exports2.byteLength = byteLength;
  },
});

// node_modules/webdav/dist/node/compat/arrayBuffer.js
var require_arrayBuffer = __commonJS({
  'node_modules/webdav/dist/node/compat/arrayBuffer.js'(exports2) {
    'use strict';
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.isArrayBuffer = void 0;
    var hasArrayBuffer = typeof ArrayBuffer === 'function';
    var objToString = Object.prototype.toString;
    function isArrayBuffer(value) {
      return (
        hasArrayBuffer &&
        (value instanceof ArrayBuffer || objToString.call(value) === '[object ArrayBuffer]')
      );
    }
    exports2.isArrayBuffer = isArrayBuffer;
  },
});

// node_modules/webdav/dist/node/compat/buffer.js
var require_buffer = __commonJS({
  'node_modules/webdav/dist/node/compat/buffer.js'(exports2) {
    'use strict';
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.isBuffer = void 0;
    function isBuffer(value) {
      return (
        value != null &&
        value.constructor != null &&
        typeof value.constructor.isBuffer === 'function' &&
        value.constructor.isBuffer(value)
      );
    }
    exports2.isBuffer = isBuffer;
  },
});

// node_modules/webdav/dist/node/tools/size.js
var require_size = __commonJS({
  'node_modules/webdav/dist/node/tools/size.js'(exports2) {
    'use strict';
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.calculateDataLength = void 0;
    var layerr_1 = require_dist();
    var byte_length_1 = require_dist3();
    var arrayBuffer_1 = require_arrayBuffer();
    var buffer_1 = require_buffer();
    var types_1 = require_types2();
    function calculateDataLength(data) {
      if ((0, arrayBuffer_1.isArrayBuffer)(data)) {
        return data.byteLength;
      } else if ((0, buffer_1.isBuffer)(data)) {
        return data.length;
      } else if (typeof data === 'string') {
        return (0, byte_length_1.byteLength)(data);
      }
      throw new layerr_1.Layerr(
        {
          info: {
            code: types_1.ErrorCode.DataTypeNoLength,
          },
        },
        'Cannot calculate data length: Invalid type'
      );
    }
    exports2.calculateDataLength = calculateDataLength;
  },
});

// node_modules/webdav/dist/node/operations/putFileContents.js
var require_putFileContents = __commonJS({
  'node_modules/webdav/dist/node/operations/putFileContents.js'(exports2) {
    'use strict';
    var __awaiter =
      (exports2 && exports2.__awaiter) ||
      function (thisArg, _arguments, P, generator) {
        function adopt(value) {
          return value instanceof P
            ? value
            : new P(function (resolve) {
                resolve(value);
              });
        }
        return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) {
            try {
              step(generator.next(value));
            } catch (e) {
              reject(e);
            }
          }
          function rejected(value) {
            try {
              step(generator['throw'](value));
            } catch (e) {
              reject(e);
            }
          }
          function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
          }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
      };
    var __generator =
      (exports2 && exports2.__generator) ||
      function (thisArg, body) {
        var _ = {
            label: 0,
            sent: function () {
              if (t[0] & 1) throw t[1];
              return t[1];
            },
            trys: [],
            ops: [],
          },
          f,
          y,
          t,
          g;
        return (
          (g = { next: verb(0), throw: verb(1), return: verb(2) }),
          typeof Symbol === 'function' &&
            (g[Symbol.iterator] = function () {
              return this;
            }),
          g
        );
        function verb(n) {
          return function (v) {
            return step([n, v]);
          };
        }
        function step(op) {
          if (f) throw new TypeError('Generator is already executing.');
          while (_)
            try {
              if (
                ((f = 1),
                y &&
                  (t =
                    op[0] & 2
                      ? y['return']
                      : op[0]
                        ? y['throw'] || ((t = y['return']) && t.call(y), 0)
                        : y.next) &&
                  !(t = t.call(y, op[1])).done)
              )
                return t;
              if (((y = 0), t)) op = [op[0] & 2, t.value];
              switch (op[0]) {
                case 0:
                case 1:
                  t = op;
                  break;
                case 4:
                  _.label++;
                  return { value: op[1], done: false };
                case 5:
                  _.label++;
                  y = op[1];
                  op = [0];
                  continue;
                case 7:
                  op = _.ops.pop();
                  _.trys.pop();
                  continue;
                default:
                  if (
                    !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                    (op[0] === 6 || op[0] === 2)
                  ) {
                    _ = 0;
                    continue;
                  }
                  if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                    _.label = op[1];
                    break;
                  }
                  if (op[0] === 6 && _.label < t[1]) {
                    _.label = t[1];
                    t = op;
                    break;
                  }
                  if (t && _.label < t[2]) {
                    _.label = t[2];
                    _.ops.push(op);
                    break;
                  }
                  if (t[2]) _.ops.pop();
                  _.trys.pop();
                  continue;
              }
              op = body.call(thisArg, _);
            } catch (e) {
              op = [6, e];
              y = 0;
            } finally {
              f = t = 0;
            }
          if (op[0] & 5) throw op[1];
          return { value: op[0] ? op[1] : void 0, done: true };
        }
      };
    var __importDefault =
      (exports2 && exports2.__importDefault) ||
      function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
      };
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.getFileUploadLink = exports2.putFileContents = void 0;
    var layerr_1 = require_dist();
    var stream_1 = __importDefault(require('stream'));
    var encode_1 = require_encode();
    var url_1 = require_url();
    var path_1 = require_path();
    var request_1 = require_request();
    var response_1 = require_response();
    var size_1 = require_size();
    var types_1 = require_types2();
    function putFileContents(context, filePath, data, options) {
      if (options === void 0) {
        options = {};
      }
      return __awaiter(this, void 0, void 0, function () {
        var _a, contentLength, _b, overwrite, headers, requestOptions, response, error;
        return __generator(this, function (_c) {
          switch (_c.label) {
            case 0:
              ((_a = options.contentLength),
                (contentLength = _a === void 0 ? true : _a),
                (_b = options.overwrite),
                (overwrite = _b === void 0 ? true : _b));
              headers = {
                'Content-Type': 'application/octet-stream',
              };
              if (
                typeof WEB === 'undefined' &&
                typeof stream_1.default !== 'undefined' &&
                typeof (stream_1.default === null || stream_1.default === void 0
                  ? void 0
                  : stream_1.default.Readable) !== 'undefined' &&
                data instanceof stream_1.default.Readable
              ) {
              } else if (contentLength === false) {
              } else if (typeof contentLength === 'number') {
                headers['Content-Length'] = ''.concat(contentLength);
              } else {
                headers['Content-Length'] = ''.concat((0, size_1.calculateDataLength)(data));
              }
              if (!overwrite) {
                headers['If-None-Match'] = '*';
              }
              requestOptions = (0, request_1.prepareRequestOptions)(
                {
                  url: (0, url_1.joinURL)(context.remoteURL, (0, path_1.encodePath)(filePath)),
                  method: 'PUT',
                  headers,
                  data,
                },
                context,
                options
              );
              return [4, (0, request_1.request)(requestOptions)];
            case 1:
              response = _c.sent();
              try {
                (0, response_1.handleResponseCode)(context, response);
              } catch (err) {
                error = err;
                if (error.status === 412 && !overwrite) {
                  return [2, false];
                } else {
                  throw error;
                }
              }
              return [2, true];
          }
        });
      });
    }
    exports2.putFileContents = putFileContents;
    function getFileUploadLink(context, filePath) {
      var url = ''.concat(
        (0, url_1.joinURL)(context.remoteURL, (0, path_1.encodePath)(filePath)),
        '?Content-Type=application/octet-stream'
      );
      var protocol = /^https:/i.test(url) ? 'https' : 'http';
      switch (context.authType) {
        case types_1.AuthType.None:
          break;
        case types_1.AuthType.Password: {
          var authPart = context.headers.Authorization.replace(/^Basic /i, '').trim();
          var authContents = (0, encode_1.fromBase64)(authPart);
          url = url.replace(/^https?:\/\//, ''.concat(protocol, '://').concat(authContents, '@'));
          break;
        }
        default:
          throw new layerr_1.Layerr(
            {
              info: {
                code: types_1.ErrorCode.LinkUnsupportedAuthType,
              },
            },
            'Unsupported auth type for file link: '.concat(context.authType)
          );
      }
      return url;
    }
    exports2.getFileUploadLink = getFileUploadLink;
  },
});

// node_modules/webdav/dist/node/factory.js
var require_factory = __commonJS({
  'node_modules/webdav/dist/node/factory.js'(exports2) {
    'use strict';
    Object.defineProperty(exports2, '__esModule', { value: true });
    exports2.createClient = void 0;
    var url_1 = require_url();
    var index_1 = require_auth();
    var copyFile_1 = require_copyFile();
    var createDirectory_1 = require_createDirectory();
    var createStream_1 = require_createStream();
    var customRequest_1 = require_customRequest();
    var deleteFile_1 = require_deleteFile();
    var exists_1 = require_exists();
    var directoryContents_1 = require_directoryContents();
    var getFileContents_1 = require_getFileContents();
    var lock_1 = require_lock();
    var getQuota_1 = require_getQuota();
    var stat_1 = require_stat();
    var moveFile_1 = require_moveFile();
    var putFileContents_1 = require_putFileContents();
    var types_1 = require_types2();
    var DEFAULT_CONTACT_HREF =
      'https://github.com/perry-mitchell/webdav-client/blob/master/LOCK_CONTACT.md';
    function createClient(remoteURL, options) {
      if (options === void 0) {
        options = {};
      }
      var _a = options.authType,
        authTypeRaw = _a === void 0 ? null : _a,
        _b = options.contactHref,
        contactHref = _b === void 0 ? DEFAULT_CONTACT_HREF : _b,
        _c = options.headers,
        headers = _c === void 0 ? {} : _c,
        httpAgent = options.httpAgent,
        httpsAgent = options.httpsAgent,
        maxBodyLength = options.maxBodyLength,
        maxContentLength = options.maxContentLength,
        password = options.password,
        token = options.token,
        username = options.username,
        withCredentials = options.withCredentials;
      var authType = authTypeRaw;
      if (!authType) {
        authType = username || password ? types_1.AuthType.Password : types_1.AuthType.None;
      }
      var context = {
        authType,
        contactHref,
        headers: Object.assign({}, headers),
        httpAgent,
        httpsAgent,
        maxBodyLength,
        maxContentLength,
        remotePath: (0, url_1.extractURLPath)(remoteURL),
        remoteURL,
        password,
        token,
        username,
        withCredentials,
      };
      (0, index_1.setupAuth)(context, username, password, token);
      return {
        copyFile: function (filename, destination, options2) {
          return (0, copyFile_1.copyFile)(context, filename, destination, options2);
        },
        createDirectory: function (path, options2) {
          return (0, createDirectory_1.createDirectory)(context, path, options2);
        },
        createReadStream: function (filename, options2) {
          return (0, createStream_1.createReadStream)(context, filename, options2);
        },
        createWriteStream: function (filename, options2, callback) {
          return (0, createStream_1.createWriteStream)(context, filename, options2, callback);
        },
        customRequest: function (path, requestOptions) {
          return (0, customRequest_1.customRequest)(context, path, requestOptions);
        },
        deleteFile: function (filename, options2) {
          return (0, deleteFile_1.deleteFile)(context, filename, options2);
        },
        exists: function (path, options2) {
          return (0, exists_1.exists)(context, path, options2);
        },
        getDirectoryContents: function (path, options2) {
          return (0, directoryContents_1.getDirectoryContents)(context, path, options2);
        },
        getFileContents: function (filename, options2) {
          return (0, getFileContents_1.getFileContents)(context, filename, options2);
        },
        getFileDownloadLink: function (filename) {
          return (0, getFileContents_1.getFileDownloadLink)(context, filename);
        },
        getFileUploadLink: function (filename) {
          return (0, putFileContents_1.getFileUploadLink)(context, filename);
        },
        getHeaders: function () {
          return Object.assign({}, context.headers);
        },
        getQuota: function (options2) {
          return (0, getQuota_1.getQuota)(context, options2);
        },
        lock: function (path, options2) {
          return (0, lock_1.lock)(context, path, options2);
        },
        moveFile: function (filename, destinationFilename, options2) {
          return (0, moveFile_1.moveFile)(context, filename, destinationFilename, options2);
        },
        putFileContents: function (filename, data, options2) {
          return (0, putFileContents_1.putFileContents)(context, filename, data, options2);
        },
        setHeaders: function (headers2) {
          context.headers = Object.assign({}, headers2);
        },
        stat: function (path, options2) {
          return (0, stat_1.getStat)(context, path, options2);
        },
        unlock: function (path, token2, options2) {
          return (0, lock_1.unlock)(context, path, token2, options2);
        },
      };
    }
    exports2.createClient = createClient;
  },
});

// node_modules/webdav/dist/node/index.js
var __createBinding =
  (exports && exports.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        o[k2] = m[k];
      });
var __exportStar =
  (exports && exports.__exportStar) ||
  function (m, exports2) {
    for (var p in m)
      if (p !== 'default' && !Object.prototype.hasOwnProperty.call(exports2, p))
        __createBinding(exports2, m, p);
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.parseXML = exports.parseStat = exports.getPatcher = exports.createClient = void 0;
var factory_1 = require_factory();
Object.defineProperty(exports, 'createClient', {
  enumerable: true,
  get: function () {
    return factory_1.createClient;
  },
});
var patcher_1 = require_patcher2();
Object.defineProperty(exports, 'getPatcher', {
  enumerable: true,
  get: function () {
    return patcher_1.getPatcher;
  },
});
__exportStar(require_types2(), exports);
var dav_1 = require_dav();
Object.defineProperty(exports, 'parseStat', {
  enumerable: true,
  get: function () {
    return dav_1.parseStat;
  },
});
Object.defineProperty(exports, 'parseXML', {
  enumerable: true,
  get: function () {
    return dav_1.parseXML;
  },
});
/*! Bundled license information:

is-buffer/index.js:
  (*!
   * Determine if an object is a Buffer
   *
   * @author   Feross Aboukhadijeh <https://feross.org>
   * @license  MIT
   *)

base-64/base64.js:
  (*! https://mths.be/base64 v1.0.0 by @mathias | MIT license *)

he/he.js:
  (*! https://mths.be/he v1.2.0 by @mathias | MIT license *)

mime-db/index.js:
  (*!
   * mime-db
   * Copyright(c) 2014 Jonathan Ong
   * Copyright(c) 2015-2022 Douglas Christopher Wilson
   * MIT Licensed
   *)

mime-types/index.js:
  (*!
   * mime-types
   * Copyright(c) 2014 Jonathan Ong
   * Copyright(c) 2015 Douglas Christopher Wilson
   * MIT Licensed
   *)

nested-property/dist/nested-property.js:
  (**
  * @license nested-property https://github.com/cosmosio/nested-property
  *
  * The MIT License (MIT)
  *
  * Copyright (c) 2014-2020 Olivier Scherrer <pode.fr@gmail.com>
  *)
*/
